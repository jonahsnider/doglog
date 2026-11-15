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
  tauri::Builder::default()
    .manage(OpenedLog::default())
    .invoke_handler(tauri::generate_handler![take_opened_log, read_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Windows and Linux pass opened files as arguments
      #[cfg(any(windows, target_os = "linux"))]
      if let Some(path) = std::env::args_os().skip(1).map(PathBuf::from).find(|path| path.is_file()) {
        set_opened_log(app.handle(), path);
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(handle_run_event);
}
