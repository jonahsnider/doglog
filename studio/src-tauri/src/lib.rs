mod agent;
mod camera_stream;
#[cfg(any(target_os = "macos", windows))]
mod capture;
mod cli;
mod cloud_keychain;
mod cloud_sign_in;
mod live_export;
mod log_url;
#[cfg(desktop)]
mod mcp_install;
mod new_window;
mod recent_logs;
mod relaunch;
mod storage_sftp;
mod sync;
#[cfg(any(target_os = "macos", windows))]
mod video;
#[cfg(target_os = "macos")]
mod window_backdrop;
mod window_state;

use liblzma::bufread::XzDecoder;
use serde::Serialize;
use std::{
    collections::HashMap,
    fs::File,
    io::{BufRead, BufReader, Read, Seek, SeekFrom, Write},
    ops::ControlFlow,
    path::PathBuf,
    process::ExitCode,
    sync::Mutex,
};
use tauri::{
    AppHandle, Emitter, Manager, RunEvent, State, WebviewWindow, WindowEvent, async_runtime::spawn_blocking,
    ipc::Response, window::Effect,
};
use tauri_plugin_deep_link::DeepLinkExt;

/// A log a window was asked to open from the OS, CLI, or a `doglog://open?url=...` link
#[derive(Clone, Serialize)]
#[serde(tag = "type", content = "value", rename_all = "lowercase")]
pub enum OpenedLogTarget {
    Path(PathBuf),
    Url(String),
}

/// The last log each window was asked to open, by window label, until its frontend takes it
#[derive(Default)]
struct OpenedLog(Mutex<HashMap<String, OpenedLogTarget>>);

/// Whether each window currently has a log or live session open, so `doglog://open?url=...` can reuse empty windows
#[derive(Default)]
struct WindowHasSource(Mutex<HashMap<String, bool>>);

#[tauri::command]
fn set_window_has_source(window: WebviewWindow, has_source: bool, state: State<WindowHasSource>) {
    state.0.lock().unwrap().insert(window.label().to_owned(), has_source);
}

/// Open `target` in the window with `label`
fn set_opened_log(app: &AppHandle, label: &str, target: OpenedLogTarget) {
    app.state::<OpenedLog>()
        .0
        .lock()
        .unwrap()
        .insert(label.to_owned(), target);
    // Before the frontend is listening this is dropped, it takes the log when it starts instead
    let _ = app.emit_to(label, "log-opened", ());
}

#[tauri::command]
fn take_opened_log(window: WebviewWindow, opened_log: State<OpenedLog>) -> Option<OpenedLogTarget> {
    opened_log.0.lock().unwrap().remove(window.label())
}

/// The dashboard ID from the last `doglog://shared/<dashboard-id>` link sent to each window, until its frontend takes it
#[derive(Default)]
struct OpenedDashboardLink(Mutex<HashMap<String, String>>);

/// Handle a `doglog://` deep link the OS asked Studio to open
fn handle_deep_link(app: &AppHandle, url: &tauri::Url) {
    if url.scheme() != "doglog" {
        return;
    }
    match url.host_str() {
        Some("shared") => {
            let dashboard_id = url.path().trim_start_matches('/').to_owned();
            let label = new_window::last_focused(app);
            app.state::<OpenedDashboardLink>()
                .0
                .lock()
                .unwrap()
                .insert(label.clone(), dashboard_id);
            // Before the frontend is listening this is dropped, it takes the link when it starts instead
            let _ = app.emit_to(label, "dashboard-link-opened", ());
        }
        Some("sign-in") => cloud_sign_in::forward_link(app, url),
        Some("open") => {
            let target_url = url
                .query_pairs()
                .find(|(key, _)| key == "url")
                .map(|(_, value)| value.into_owned())
                .unwrap_or_default();
            open_log_url_deep_link(app, target_url);
        }
        _ => {}
    }
}

/// Reuse the last-focused window when it has no log and no live session; otherwise open a new window for the URL log
fn open_log_url_deep_link(app: &AppHandle, url: String) {
    let label = new_window::last_focused(app);
    let can_reuse = app.get_webview_window(&label).is_some()
        && !app
            .state::<WindowHasSource>()
            .0
            .lock()
            .unwrap()
            .get(&label)
            .copied()
            .unwrap_or(false)
        && !app.state::<OpenedLog>().0.lock().unwrap().contains_key(&label);

    if can_reuse {
        set_opened_log(app, &label, OpenedLogTarget::Url(url));
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    } else {
        // On macOS the deep-link callback holds Tauri's plugin lock, which creating a webview also needs.
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = new_window::create(&app, Some(OpenedLogTarget::Url(url))) {
                log::error!("Couldn't open a window: {error}");
            }
        });
    }
}

#[tauri::command]
fn take_opened_dashboard_link(window: WebviewWindow, opened_link: State<OpenedDashboardLink>) -> Option<String> {
    opened_link.0.lock().unwrap().remove(window.label())
}

/// Open a window for a Studio that was started while this one is running, which passed on its arguments and quit
fn open_started_window(app: &AppHandle, args: Vec<String>, cwd: String) {
    let arg = args.into_iter().nth(1);
    // The deep link plugin opens `doglog://` links
    if arg.as_deref().is_some_and(|arg| arg.starts_with("doglog://")) {
        return;
    }
    // A log file or HTTP(S) URL, the only arguments `cli::parse_args()` lets reach here
    let log = arg.map(|arg| {
        if log_url::is_http_url(&arg) {
            OpenedLogTarget::Url(arg)
        } else {
            OpenedLogTarget::Path(PathBuf::from(cwd).join(arg))
        }
    });
    if let Err(error) = new_window::create(app, log) {
        log::error!("Couldn't open a window: {error}");
    }
}

#[tauri::command]
fn read_file(path: PathBuf) -> Result<Response, String> {
    std::fs::read(path)
        .map(Response::new)
        .map_err(|error| error.to_string())
}

/// Read up to `length` bytes of a file from `offset`, ex. a part of an upload to the team's storage
#[tauri::command]
async fn read_file_range(path: PathBuf, offset: u64, length: u64) -> Result<Response, String> {
    spawn_blocking(move || {
        let mut file = File::open(&path)?;
        file.seek(SeekFrom::Start(offset))?;
        let mut contents = Vec::new();
        file.take(length).read_to_end(&mut contents)?;
        Ok(Response::new(contents))
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error: std::io::Error| error.to_string())
}

/// The magic bytes every XZ file starts with, ex. a `.wpilogxz` log
const XZ_MAGIC: [u8; 6] = [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00];

/// Read a log, decompressing it if it's a `.wpilogxz` log, since that's faster here than in the webview
#[tauri::command]
async fn read_log(path: PathBuf) -> Result<Response, String> {
    spawn_blocking(move || {
        let file = File::open(&path)?;
        let mut contents = Vec::with_capacity(usize::try_from(file.metadata()?.len()).unwrap_or_default());
        let mut reader = BufReader::new(file);
        if reader.fill_buf()?.starts_with(&XZ_MAGIC) {
            // A robot that loses power cuts the file off, so keep what was decompressed before an error
            if let Err(error) = XzDecoder::new(reader).read_to_end(&mut contents) {
                if contents.is_empty() {
                    return Err(std::io::Error::other(format!("Couldn't decompress it: {error}")));
                }
                log::warn!("Couldn't decompress all of {}: {error}", path.display());
            }
        } else {
            reader.read_to_end(&mut contents)?;
        }
        Ok(Response::new(contents))
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error: std::io::Error| error.to_string())
}

/// The files directly in `path` sorted by name, or `path` itself when it isn't a folder, ex. for logs dropped as a folder
#[tauri::command]
async fn folder_files(path: PathBuf) -> Result<Vec<PathBuf>, String> {
    spawn_blocking(move || {
        if !path.is_dir() {
            return Ok(vec![path]);
        }
        let mut files = std::fs::read_dir(&path)?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|file| file.is_file())
            .collect::<Vec<_>>();
        files.sort();
        Ok(files)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error: std::io::Error| error.to_string())
}

/// The names of the folders directly in `path` sorted by name, ex. to find AdvantageScope robots in a robot project
#[tauri::command]
async fn subfolders(path: PathBuf) -> Result<Vec<String>, String> {
    spawn_blocking(move || {
        let mut names = std::fs::read_dir(&path)?
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
            .filter_map(|entry| entry.file_name().into_string().ok())
            .collect::<Vec<_>>();
        names.sort();
        Ok(names)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error: std::io::Error| error.to_string())
}

/// Create a robot project's `doglog.jsonc` in `folder`, erroring instead of replacing one that's there
#[tauri::command]
fn create_robot_config(folder: PathBuf, contents: String) -> Result<(), String> {
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(folder.join("doglog.jsonc"))
        .and_then(|mut file| file.write_all(contents.as_bytes()))
        .map_err(|error| error.to_string())
}

/// Let the webview play the video widget's video at `path` from `asset://`, erroring when it isn't a file. Not added to
/// the asset protocol's scope by default, since videos can be anywhere, and `read_file()` can read any file anyway.
#[tauri::command]
fn allow_video(app: AppHandle, path: PathBuf) -> Result<(), String> {
    if !path.is_file() {
        return Err(format!("{} isn't a file", path.display()));
    }
    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|error| error.to_string())
}

fn handle_run_event(app: &AppHandle, event: RunEvent) {
    if let RunEvent::Exit = event {
        agent::window::close_all(app);
    }

    // macOS sends opened files as an event, both on launch and while running
    #[cfg(target_os = "macos")]
    if let RunEvent::Opened { urls } = event
        && let Some(path) = urls.into_iter().filter_map(|url| url.to_file_path().ok()).next_back()
    {
        set_opened_log(app, &new_window::last_focused(app), OpenedLogTarget::Path(path));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> ExitCode {
    let mut context = tauri::generate_context!();

    #[cfg(target_os = "macos")]
    // `window_backdrop` adds its own, Tauri's effects can't stack Liquid Glass over another material
    let effects: Vec<Effect> = Vec::new();
    #[cfg(windows)]
    // Windows 11 22H2 introduced system backdrops. Mica only samples the wallpaper, so other windows don't show through.
    let effects = if windows_version::OsVersion::current().build >= 22621 {
        vec![Effect::Mica]
    } else {
        Vec::new()
    };
    #[cfg(not(any(target_os = "macos", windows)))]
    let effects: Vec<Effect> = Vec::new();

    let frosted_frame = cfg!(target_os = "macos") || !effects.is_empty();
    if frosted_frame {
        // The opaque webview panes cover the native material, leaving it visible through the frame.
        for window in &mut context.config_mut().app.windows {
            window.transparent = true;
            if !effects.is_empty() {
                window.window_effects = Some(tauri::utils::config::WindowEffectsConfig {
                    effects: effects.clone(),
                    ..Default::default()
                });
            }
        }
    }
    // HTTP clients (remote log fetches, Sentry, and the updater) share this rustls crypto provider
    let _ = rustls::crypto::ring::default_provider().install_default();
    // Reports panics from release builds, the frontend reports its own errors
    let _sentry = (!cfg!(debug_assertions)).then(|| {
        sentry::init(
            sentry::ClientOptions::new()
                .dsn("https://cc0e3a691d3ee00a449b2ee4ea3d55f3@o141130.ingest.us.sentry.io/4512455446495232")
                .release(format!("doglog-studio@{}", context.package_info().version))
                .environment(if option_env!("VITE_DOGLOG_LOCAL_PREVIEW") == Some("1") {
                    "development"
                } else {
                    "production"
                })
                // The computer's hostname often has its owner's name in it
                .before_send(|mut event| {
                    event.server_name = None;
                    Some(event)
                }),
        )
    });
    // Before Tauri starts, so terminal commands like `--help` and `doglog mcp` don't open a window
    let log = match cli::parse_args(context.package_info().version.to_string()) {
        ControlFlow::Continue(log) => log,
        ControlFlow::Break(code) => return code,
    };

    let builder = tauri::Builder::default();
    // Windows opened later, ex. from the `doglog` command, open in this process, so all windows share a connection to the
    // robot. Development builds are left out, so they can run alongside an installed Studio, which has the same
    // identifier.
    let builder = if cfg!(debug_assertions) {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(open_started_window))
    };
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_plugin_macos_fps::init());
    #[cfg(any(target_os = "macos", windows))]
    let builder = builder.append_invoke_initialization_script("\nwindow.__DOGLOG_CAPTURE__ = true;");
    #[cfg(target_os = "macos")]
    let builder = builder.append_invoke_initialization_script("\nwindow.__DOGLOG_CAPTURE_COVER__ = true;");
    #[cfg(any(target_os = "macos", windows))]
    let builder = builder.manage(video::VideoExports::default());
    let builder = if frosted_frame {
        builder.append_invoke_initialization_script("\nwindow.__DOGLOG_FROSTED_FRAME__ = true;")
    } else {
        builder
    };
    #[cfg(target_os = "macos")]
    let builder = builder.append_invoke_initialization_script("\nwindow.__DOGLOG_NATIVE_BACKDROP__ = true;");
    // Lets agents inspect and drive the app with the Tauri MCP server, only on this computer
    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    builder
        .plugin(tauri_plugin_fs::init())
        // After the file system plugin, keeps access to the sync folder the user picked after Studio restarts
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(cloud_sign_in::plugin())
        .plugin(window_state::plugin())
        .manage(OpenedLog::default())
        .manage(WindowHasSource::default())
        .manage(OpenedDashboardLink::default())
        .manage(camera_stream::ActiveCameraStreams::default())
        .manage(log_url::ActiveUrlDownloads::default())
        .manage(sync::RobotConnection::default())
        .manage(sync::CancelDownload::default())
        .manage(sync::SyncLock::default())
        .manage(storage_sftp::SftpServers::default())
        .manage(storage_sftp::SftpUploads::default())
        .manage(agent::window::AgentWindows::default())
        .manage(new_window::LastFocused::default())
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(focused) => {
                agent::window::set_focused(window, *focused);
                #[cfg(target_os = "macos")]
                window_backdrop::set_active(window, *focused);
                if *focused {
                    new_window::set_focused(window.app_handle(), window.label());
                }
            }
            WindowEvent::Destroyed => {
                let app = window.app_handle();
                agent::window::close(app, window.label());
                #[cfg(target_os = "macos")]
                window_backdrop::remove(window.label());
                #[cfg(any(target_os = "macos", windows))]
                video::cancel_window_video(app, window.label());
                camera_stream::cancel_for_window(app, window.label());
                log_url::cancel_for_window(app, window.label());
                app.state::<OpenedLog>().0.lock().unwrap().remove(window.label());
                app.state::<WindowHasSource>().0.lock().unwrap().remove(window.label());
                app.state::<OpenedDashboardLink>()
                    .0
                    .lock()
                    .unwrap()
                    .remove(window.label());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            take_opened_log,
            cloud_keychain::cloud_account_wrapping_key,
            cloud_sign_in::native_passkeys,
            #[cfg(target_os = "macos")]
            cloud_sign_in::macos::native_passkey,
            set_window_has_source,
            take_opened_dashboard_link,
            read_file,
            read_file_range,
            read_log,
            folder_files,
            subfolders,
            create_robot_config,
            allow_video,
            camera_stream::start_camera_stream,
            camera_stream::read_camera_stream,
            camera_stream::close_camera_stream,
            log_url::start_log_url,
            log_url::cancel_log_url,
            #[cfg(any(target_os = "macos", windows))]
            capture::copy_capture,
            #[cfg(any(target_os = "macos", windows))]
            capture::save_capture,
            #[cfg(target_os = "macos")]
            capture::set_capture_cover,
            #[cfg(any(target_os = "macos", windows))]
            video::start_video,
            #[cfg(any(target_os = "macos", windows))]
            video::add_video_frame,
            #[cfg(any(target_os = "macos", windows))]
            video::finish_video,
            #[cfg(any(target_os = "macos", windows))]
            video::cancel_video,
            live_export::save_live_export,
            new_window::new_window,
            new_window::new_source_window,
            recent_logs::note_recent_log,
            recent_logs::clear_recent_logs,
            relaunch::relaunch,
            window_state::reveal_window,
            #[cfg(target_os = "macos")]
            window_backdrop::set_window_backdrop,
            sync::lock_sync,
            sync::list_robot_logs,
            sync::download_robot_log,
            sync::cancel_robot_download,
            sync::disconnect_robot,
            storage_sftp::sftp_list,
            storage_sftp::sftp_read,
            storage_sftp::sftp_write,
            storage_sftp::sftp_upload,
            storage_sftp::sftp_cancel_upload,
            storage_sftp::sftp_download,
            storage_sftp::sftp_remove,
            storage_sftp::sftp_rename,
            storage_sftp::sftp_mkdir,
            agent::window::agent_listen,
            agent::window::agent_respond,
            #[cfg(target_os = "macos")]
            cli::cli_status,
            #[cfg(target_os = "macos")]
            cli::install_cli,
            #[cfg(desktop)]
            mcp_install::mcp_agents,
            #[cfg(desktop)]
            mcp_install::install_mcp,
            #[cfg(desktop)]
            mcp_install::mcp_config
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let main_window = app.get_webview_window("main").unwrap();
            window_state::restore(&main_window, true);
            #[cfg(target_os = "macos")]
            window_backdrop::install(&main_window);

            if let Some(log) = log {
                set_opened_log(app.handle(), "main", log);
            }

            // Windows and Linux start a new process with a `doglog://` link as its argument, macOS sends it as an
            // event, both on launch and while running
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().last() {
                    handle_deep_link(&handle, url);
                }
            });
            if let Some(url) = app.deep_link().get_current()?.and_then(|urls| urls.into_iter().last()) {
                handle_deep_link(app.handle(), &url);
            }
            // AppImages aren't installed, so they register `doglog://` links each time they start
            #[cfg(all(target_os = "linux", not(debug_assertions)))]
            app.deep_link().register_all()?;

            Ok(())
        })
        .build(context)
        .expect("error while building tauri application")
        .run(handle_run_event);
    ExitCode::SUCCESS
}
