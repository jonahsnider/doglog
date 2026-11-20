mod agent;
#[cfg(any(target_os = "macos", windows))]
mod capture;
mod cli;
#[cfg(desktop)]
mod mcp_install;
mod new_window;
mod recent_logs;
mod relaunch;
mod sync;
mod window_state;

use std::{ops::ControlFlow, path::PathBuf, process::ExitCode, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent, ipc::Response, window::Effect};

/// The last log the OS asked Studio to open, until the frontend takes it
#[derive(Default)]
struct OpenedLog(Mutex<Option<PathBuf>>);

fn set_opened_log(app: &AppHandle, path: PathBuf) {
    *app.state::<OpenedLog>().0.lock().unwrap() = Some(path);
    // Before the frontend is listening this is dropped, it takes the log when it starts instead
    let _ = app.emit("log-opened", ());
}

#[tauri::command]
fn take_opened_log(opened_log: State<OpenedLog>) -> Option<PathBuf> {
    opened_log.0.lock().unwrap().take()
}

#[tauri::command]
fn read_file(path: PathBuf) -> Result<Response, String> {
    std::fs::read(path)
        .map(Response::new)
        .map_err(|error| error.to_string())
}

fn handle_run_event(app: &AppHandle, event: RunEvent) {
    if let RunEvent::Exit = event {
        agent::window::close(app);
    }

    // macOS sends opened files as an event, both on launch and while running
    #[cfg(target_os = "macos")]
    if let RunEvent::Opened { urls } = event
        && let Some(path) = urls.into_iter().filter_map(|url| url.to_file_path().ok()).next_back()
    {
        set_opened_log(app, path);
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
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_plugin_macos_fps::init());
    #[cfg(any(target_os = "macos", windows))]
    let builder = builder.append_invoke_initialization_script("\nwindow.__DOGLOG_CAPTURE__ = true;");
    #[cfg(target_os = "macos")]
    let builder = builder.append_invoke_initialization_script("\nwindow.__DOGLOG_CAPTURE_COVER__ = true;");
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
        .plugin(window_state::plugin())
        .manage(OpenedLog::default())
        .manage(sync::RobotConnection::default())
        .manage(sync::CancelDownload::default())
        .manage(sync::SyncLock::default())
        .manage(agent::window::AgentWindow::default())
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(focused) = event {
                agent::window::set_focused(window.app_handle(), *focused);
            }
        })
        .invoke_handler(tauri::generate_handler![
            take_opened_log,
            read_file,
            #[cfg(any(target_os = "macos", windows))]
            capture::copy_capture,
            #[cfg(target_os = "macos")]
            capture::set_capture_cover,
            new_window::new_window,
            recent_logs::note_recent_log,
            recent_logs::clear_recent_logs,
            relaunch::relaunch,
            sync::lock_sync,
            sync::list_robot_logs,
            sync::download_robot_log,
            sync::cancel_robot_download,
            sync::disconnect_robot,
            window_state::window_slot,
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

            window_state::restore(app);

            if let Some(log) = log {
                set_opened_log(app.handle(), log);
            }

            Ok(())
        })
        .build(context)
        .expect("error while building tauri application")
        .run(handle_run_event);
    ExitCode::SUCCESS
}
