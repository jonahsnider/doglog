//! Opening another Studio window

use std::process::{Command, Stdio};

/// Open another Studio window, each window is its own process
#[tauri::command]
pub fn new_window() -> Result<(), String> {
    // Launch Services keeps the new window on the Dock tile the user pinned, like the `doglog` command
    #[cfg(target_os = "macos")]
    let mut command = match crate::relaunch::app_bundle() {
        Some(bundle) => {
            let mut command = Command::new("/usr/bin/open");
            command.arg("-n").arg(bundle);
            command
        }
        // Development builds don't have a bundle
        None => Command::new(std::env::current_exe().map_err(|error| error.to_string())?),
    };
    #[cfg(not(target_os = "macos"))]
    let mut command = Command::new(std::env::current_exe().map_err(|error| error.to_string())?);

    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(drop)
        .map_err(|error| error.to_string())
}
