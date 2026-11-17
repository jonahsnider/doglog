mod cli;
mod sync;
mod window_state;

use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, ipc::Response};

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
  std::fs::read(path).map(Response::new).map_err(|error| error.to_string())
}

#[cfg_attr(not(target_os = "macos"), expect(unused_variables))]
fn handle_run_event(app: &AppHandle, event: RunEvent) {
  // macOS sends opened files as an event, both on launch and while running
  #[cfg(target_os = "macos")]
  if let RunEvent::Opened { urls } = event
    && let Some(path) = urls.into_iter().filter_map(|url| url.to_file_path().ok()).next_back()
  {
    set_opened_log(app, path);
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let context = tauri::generate_context!();
  // Before Tauri starts, so `--help` and `--version` don't open a window
  let log = cli::parse_args(context.package_info().version.to_string());

  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    // After the file system plugin, keeps access to the sync folder the user picked after Studio restarts
    .plugin(tauri_plugin_persisted_scope::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(window_state::plugin())
    .manage(OpenedLog::default())
    .manage(sync::RobotConnection::default())
    .manage(sync::CancelDownload::default())
    .manage(sync::SyncLock::default())
    .invoke_handler(tauri::generate_handler![
      take_opened_log,
      read_file,
      sync::lock_sync,
      sync::list_robot_logs,
      sync::download_robot_log,
      sync::cancel_robot_download,
      sync::disconnect_robot,
      #[cfg(target_os = "macos")]
      cli::cli_status,
      #[cfg(target_os = "macos")]
      cli::install_cli
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
}
