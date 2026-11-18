//! Opening another Studio window

use std::process::{Command, Stdio};

/// Open another Studio window, each window is its own process
#[tauri::command]
pub fn new_window() -> Result<(), String> {
    open_window().map_err(|error| error.to_string())
}

/// Open a Studio window, also used by `doglog` commands that need one
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
