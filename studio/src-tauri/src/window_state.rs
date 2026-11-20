use std::collections::HashMap;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow, plugin::TauriPlugin};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

/// Fullscreen isn't saved, so Studio reopens as a normal window
const FLAGS: StateFlags = StateFlags::SIZE
    .union(StateFlags::POSITION)
    .union(StateFlags::MAXIMIZED);

/// Saves the size, position, and whether it's maximized of the window that closed last, `restore()` applies them
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_window_state::Builder::new()
        .with_state_flags(FLAGS)
        // Every window is saved as `main`, so whichever closes last is restored
        .map_label(|_| "main")
        .skip_initial_state("main")
        .build()
}

/// Restore how the last closed window was set up. Only the first window goes back to the saved position, the others are
/// centered so they don't cover it.
///
/// The window starts hidden and the app shows it once it loads, since macOS animates a visible window zooming to fill
/// the screen when it was maximized. Showing it here would be too early, maximizing is queued on the main thread.
pub fn restore(window: &WebviewWindow, first_window: bool) {
    let result = if first_window {
        window.restore_state(FLAGS)
    } else {
        center_saved_size(window).and_then(|()| window.restore_state(StateFlags::MAXIMIZED))
    };

    if let Err(error) = result {
        log::warn!("Couldn't restore the window: {error}");
    }
}

#[derive(serde::Deserialize)]
struct SavedSize {
    width: u32,
    height: u32,
}

/// Resize the window to the saved size, centered on its screen.
/// Read from the plugin's file since macOS resizes windows asynchronously, so `center()` after restoring the size would use the old size.
fn center_saved_size(window: &WebviewWindow) -> tauri::Result<()> {
    let app = window.app_handle();
    let path = app.path().app_config_dir()?.join(app.filename());
    let Some(saved) = std::fs::read(path)
        .ok()
        .and_then(|file| serde_json::from_slice::<HashMap<String, SavedSize>>(&file).ok())
        .and_then(|mut states| states.remove("main"))
        .filter(|saved| saved.width > 0 && saved.height > 0)
    else {
        return Ok(());
    };
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };

    let area = monitor.work_area();
    let size = PhysicalSize::new(saved.width.min(area.size.width), saved.height.min(area.size.height));
    window.set_size(size)?;
    window.set_position(PhysicalPosition::new(
        area.position.x + (area.size.width - size.width) as i32 / 2,
        area.position.y + (area.size.height - size.height) as i32 / 2,
    ))
}
