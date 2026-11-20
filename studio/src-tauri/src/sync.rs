//! Commands for syncing logs from a roboRIO, the frontend decides what to sync and when

use std::{
    fs::{File, OpenOptions, TryLockError},
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

use robot_sftp::Robot;
use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewWindow, ipc::Channel, scope::fs::Scope, utils::config::FsScope};
use tauri_plugin_fs::FsExt;
use tokio::sync::Mutex;

/// Where WPILib and AdvantageKit save logs on a roboRIO, the USB drive and internal storage
const LOG_DIRS: [&str; 2] = ["/U/logs", "/home/lvuser/logs"];
const SSH_PORT: u16 = 22;
/// How often to report download progress, sending every chunk floods the frontend
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);

/// The open connection, reused between syncs since connecting is slow for a roboRIO
#[derive(Default)]
pub struct RobotConnection(Mutex<Option<(String, Robot)>>);

/// Set to stop the current download early
#[derive(Default)]
pub struct CancelDownload(AtomicBool);

/// The label of the one window that syncs, with a file lock the OS releases when Studio exits, so a development build
/// running alongside it doesn't sync too
#[derive(Default)]
pub struct SyncLock(std::sync::Mutex<Option<(String, File)>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteLog {
    path: String,
    name: String,
    size: u64,
}

/// Run `action` with a connection to `host`, connecting first if needed.
/// The connection is dropped after an error, so the next call starts fresh.
async fn with_robot<T>(
    connection: &RobotConnection,
    host: &str,
    action: impl AsyncFnOnce(&Robot) -> Result<T, String>,
) -> Result<T, String> {
    let mut connection = connection.0.lock().await;
    if !matches!(&*connection, Some((connected_host, robot)) if connected_host == host && !robot.is_closed()) {
        *connection = None;
        *connection = Some((host.to_owned(), Robot::connect(host, SSH_PORT).await?));
    }

    let (_, robot) = connection.as_ref().unwrap();
    let result = action(robot).await;
    if result.is_err() {
        *connection = None;
    }
    result
}

/// Try to become the window that syncs logs, taking over from one that closed. Returns whether this window syncs.
#[tauri::command]
pub fn lock_sync(app: AppHandle, window: WebviewWindow, lock: State<SyncLock>) -> Result<bool, String> {
    let mut held = lock.0.lock().unwrap();
    if let Some((label, _)) = &mut *held {
        if *label != window.label() && app.get_webview_window(label).is_some() {
            return Ok(false);
        }
        *label = window.label().to_owned();
        return Ok(true);
    }

    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(dir.join("log-sync.lock"))
        .map_err(|error| error.to_string())?;
    match file.try_lock() {
        Ok(()) => {
            *held = Some((window.label().to_owned(), file));
            Ok(true)
        }
        Err(TryLockError::WouldBlock) => Ok(false),
        Err(TryLockError::Error(error)) => Err(error.to_string()),
    }
}

#[tauri::command]
pub async fn list_robot_logs(connection: State<'_, RobotConnection>, host: String) -> Result<Vec<RemoteLog>, String> {
    let logs = with_robot(&connection, &host, async |robot| robot.list_logs(&LOG_DIRS).await).await?;
    Ok(logs
        .into_iter()
        .map(|log| RemoteLog {
            path: log.path,
            name: log.name,
            size: log.size,
        })
        .collect())
}

/// Copy a log from the robot, appending to the `offset` bytes already saved at `local_path`.
/// Returns the number of bytes copied, which is less than the rest of the file if it was cancelled.
#[tauri::command]
#[expect(
    clippy::too_many_arguments,
    reason = "Tauri passes command arguments as function parameters"
)]
pub async fn download_robot_log(
    app: AppHandle,
    connection: State<'_, RobotConnection>,
    cancel: State<'_, CancelDownload>,
    host: String,
    remote_path: String,
    local_path: PathBuf,
    offset: u64,
    on_progress: Channel<u64>,
) -> Result<u64, String> {
    // Same rules as the frontend's file access, so this can't write outside the sync folder.
    // The default folder is allowed in the capability file instead of `fs_scope()`, which would access it at startup.
    let default_folder = Scope::new(&app, &FsScope::AllowedPaths(vec!["$DOCUMENT/DogLog/**".into()]))
        .map_err(|error| error.to_string())?;
    if !app.fs_scope().is_allowed(&local_path) && !default_folder.is_allowed(&local_path) {
        return Err(format!("Studio doesn't have access to {}", local_path.display()));
    }

    cancel.0.store(false, Ordering::Relaxed);
    let mut last_progress = Instant::now();
    with_robot(&connection, &host, async |robot| {
        robot
            .download(&remote_path, &local_path, offset, &cancel.0, |copied| {
                if last_progress.elapsed() >= PROGRESS_INTERVAL {
                    last_progress = Instant::now();
                    let _ = on_progress.send(copied);
                }
            })
            .await
    })
    .await
}

#[tauri::command]
pub fn cancel_robot_download(cancel: State<CancelDownload>) {
    cancel.0.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub async fn disconnect_robot(connection: State<'_, RobotConnection>) -> Result<(), String> {
    *connection.0.lock().await = None;
    Ok(())
}
