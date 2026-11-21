//! Opening Studio windows. Every window is in one process, so they share a connection to the robot.

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Manager, WebviewWindowBuilder};

/// The label of the window that was focused last, `main` until another is focused
pub struct LastFocused(Mutex<String>);

impl Default for LastFocused {
    fn default() -> Self {
        Self(Mutex::new("main".to_owned()))
    }
}

pub fn set_focused(app: &AppHandle, label: &str) {
    *app.state::<LastFocused>().0.lock().unwrap() = label.to_owned();
}

/// The window that was focused last, for things the OS asks Studio to open
pub fn last_focused(app: &AppHandle) -> String {
    app.state::<LastFocused>().0.lock().unwrap().clone()
}

pub fn create(app: &AppHandle, log: Option<PathBuf>) -> tauri::Result<()> {
    static NEXT: AtomicU32 = AtomicU32::new(1);
    let mut config = app.config().app.windows[0].clone();
    config.label = format!("window-{}", NEXT.fetch_add(1, Ordering::Relaxed));
    // Taken by the window once it loads
    if let Some(log) = log {
        crate::set_opened_log(app, &config.label, log);
    }
    let window = WebviewWindowBuilder::from_config(app, &config)?.build()?;
    crate::window_state::restore(&window, false);
    Ok(())
}

/// Open another Studio window. Async, since creating a window in a synchronous command deadlocks on Windows.
#[tauri::command]
pub async fn new_window(app: AppHandle) -> Result<(), String> {
    create(&app, None).map_err(|error| error.to_string())
}

/// Start Studio for `doglog` commands that need a window, which opens one in the Studio that's running if there is one
pub fn open_window() -> std::io::Result<()> {
    // Launch Services keeps the new window on the Dock tile the user pinned, like the `doglog` command
    #[cfg(target_os = "macos")]
    let mut command = match crate::relaunch::app_bundle() {
        Some(bundle) => {
            let mut command = Command::new("/usr/bin/open");
            command.arg("-n").arg(bundle);
            command
        }
        // Development builds don't have a bundle
        None => Command::new(std::env::current_exe()?),
    };
    #[cfg(not(target_os = "macos"))]
    let mut command = Command::new(std::env::current_exe()?);

    // Detached, so it keeps running when the terminal or agent that ran a `doglog` command stops it
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(&mut command, 0);

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(drop)
}
