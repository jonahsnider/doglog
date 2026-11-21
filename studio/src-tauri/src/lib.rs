mod agent;
#[cfg(any(target_os = "macos", windows))]
mod capture;
mod cli;
mod context_menu;
mod live_export;
#[cfg(desktop)]
mod mcp_install;
mod new_window;
mod recent_logs;
mod relaunch;
mod sync;
#[cfg(any(target_os = "macos", windows))]
mod video;
mod window_state;

use std::{collections::HashMap, ops::ControlFlow, path::PathBuf, process::ExitCode, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewWindow, WindowEvent, ipc::Response, window::Effect};
use tauri_plugin_deep_link::DeepLinkExt;

/// The last log each window was asked to open, by window label, until its frontend takes it
#[derive(Default)]
struct OpenedLog(Mutex<HashMap<String, PathBuf>>);

/// Open `path` in the window with `label`
fn set_opened_log(app: &AppHandle, label: &str, path: PathBuf) {
    app.state::<OpenedLog>()
        .0
        .lock()
        .unwrap()
        .insert(label.to_owned(), path);
    // Before the frontend is listening this is dropped, it takes the log when it starts instead
    let _ = app.emit_to(label, "log-opened", ());
}

#[tauri::command]
fn take_opened_log(window: WebviewWindow, opened_log: State<OpenedLog>) -> Option<PathBuf> {
    opened_log.0.lock().unwrap().remove(window.label())
}

/// The last dashboard link each window was asked to open, ex. `v1.<payload>` from `doglog://import/v1.<payload>`, by
/// window label, until its frontend takes it
#[derive(Default)]
struct OpenedDashboardLink(Mutex<HashMap<String, String>>);

/// Open a dashboard link the OS asked Studio to open in the window that was focused last
fn set_opened_dashboard_link(app: &AppHandle, url: &tauri::Url) {
    if url.scheme() != "doglog" || url.host_str() != Some("import") {
        return;
    }
    let link = url.path().trim_start_matches('/').to_owned();
    let label = new_window::last_focused(app);
    app.state::<OpenedDashboardLink>()
        .0
        .lock()
        .unwrap()
        .insert(label.clone(), link);
    // Before the frontend is listening this is dropped, it takes the link when it starts instead
    let _ = app.emit_to(label, "dashboard-link-opened", ());
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
    // A log, the only argument `cli::parse_args()` lets reach here
    let log = arg.map(|arg| PathBuf::from(cwd).join(arg));
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

fn handle_run_event(app: &AppHandle, event: RunEvent) {
    if let RunEvent::Exit = event {
        agent::window::close_all(app);
    }

    // macOS sends opened files as an event, both on launch and while running
    #[cfg(target_os = "macos")]
    if let RunEvent::Opened { urls } = event
        && let Some(path) = urls.into_iter().filter_map(|url| url.to_file_path().ok()).next_back()
    {
        set_opened_log(app, &new_window::last_focused(app), path);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> ExitCode {
    let mut context = tauri::generate_context!();

    #[cfg(target_os = "macos")]
    let effects = vec![Effect::LiquidGlassRegular, Effect::Sidebar];
    #[cfg(windows)]
    // Windows 11 22H2 introduced system backdrops. Legacy Acrylic can lag when moving or resizing.
    let effects = if windows_version::OsVersion::current().build >= 22621 {
        vec![Effect::Acrylic]
    } else {
        Vec::new()
    };
    #[cfg(not(any(target_os = "macos", windows)))]
    let effects: Vec<Effect> = Vec::new();

    let frosted_frame = !effects.is_empty();
    if frosted_frame {
        // The opaque webview panes cover the native material, leaving it visible through the frame.
        for window in &mut context.config_mut().app.windows {
            window.transparent = true;
            window.window_effects = Some(tauri::utils::config::WindowEffectsConfig {
                effects: effects.clone(),
                ..Default::default()
            });
        }
    }
    // Reports panics from release builds, the frontend reports its own errors
    let _sentry = (!cfg!(debug_assertions)).then(|| {
        // Sentry's HTTP client needs a TLS provider, the same one the updater installs
        let _ = rustls::crypto::ring::default_provider().install_default();
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(window_state::plugin())
        .manage(OpenedLog::default())
        .manage(OpenedDashboardLink::default())
        .manage(sync::RobotConnection::default())
        .manage(sync::CancelDownload::default())
        .manage(sync::SyncLock::default())
        .manage(agent::window::AgentWindows::default())
        .manage(new_window::LastFocused::default())
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(focused) => {
                agent::window::set_focused(window, *focused);
                if *focused {
                    new_window::set_focused(window.app_handle(), window.label());
                }
            }
            WindowEvent::Destroyed => {
                let app = window.app_handle();
                agent::window::close(app, window.label());
                #[cfg(any(target_os = "macos", windows))]
                video::cancel_window_video(app, window.label());
                app.state::<OpenedLog>().0.lock().unwrap().remove(window.label());
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
            take_opened_dashboard_link,
            read_file,
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
            context_menu::popup_menu,
            live_export::save_live_export,
            new_window::new_window,
            recent_logs::note_recent_log,
            recent_logs::clear_recent_logs,
            relaunch::relaunch,
            sync::lock_sync,
            sync::list_robot_logs,
            sync::download_robot_log,
            sync::cancel_robot_download,
            sync::disconnect_robot,
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

            window_state::restore(&app.get_webview_window("main").unwrap(), true);

            if let Some(log) = log {
                set_opened_log(app.handle(), "main", log);
            }

            // Windows and Linux start a new process with a `doglog://` link as its argument, macOS sends it as an
            // event, both on launch and while running
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().last() {
                    set_opened_dashboard_link(&handle, url);
                }
            });
            if let Some(url) = app.deep_link().get_current()?.and_then(|urls| urls.into_iter().last()) {
                set_opened_dashboard_link(app.handle(), &url);
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
