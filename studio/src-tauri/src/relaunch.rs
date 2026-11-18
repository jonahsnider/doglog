//! Restarting Studio after an update

use tauri::AppHandle;

/// Restart Studio into the update that was just installed
#[tauri::command]
pub fn relaunch(app: AppHandle) {
    // Tauri's restart on macOS opens the new Studio while this one is still running, so the Dock gives it a second
    // tile instead of the one the user pinned, see https://github.com/tauri-apps/tauri/issues/16449
    #[cfg(target_os = "macos")]
    if let Some(bundle) = app_bundle()
        && open_after_exit(&bundle).is_ok()
    {
        app.exit(0);
        return;
    }

    app.restart();
}

/// The `.app` bundle Studio is running from, which development builds don't have
#[cfg(target_os = "macos")]
pub fn app_bundle() -> Option<std::path::PathBuf> {
    let executable = std::env::current_exe().ok()?;
    // `DogLog Studio.app/Contents/MacOS/DogLog Studio`
    let bundle = executable.parent()?.parent()?.parent()?;
    (bundle.extension()? == "app").then(|| bundle.to_path_buf())
}

/// Open `bundle` once this process exits, waiting at most 10 seconds so a Studio that hangs while quitting is still
/// replaced
#[cfg(target_os = "macos")]
fn open_after_exit(bundle: &std::path::Path) -> std::io::Result<()> {
    use std::os::unix::process::CommandExt;
    use std::process::{Command, Stdio};

    const SCRIPT: &str = r#"i=0; while kill -0 "$1" 2>/dev/null && [ "$i" -lt 100 ]; do sleep 0.1; i=$((i + 1)); done; exec /usr/bin/open -n "$2""#;

    Command::new("/bin/sh")
        .args(["-c", SCRIPT, "sh"])
        .arg(std::process::id().to_string())
        .arg(bundle)
        // Detached, so it isn't killed with this process's terminal or left writing to it
        .process_group(0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(drop)
}
