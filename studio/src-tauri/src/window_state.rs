use std::{
    collections::HashMap,
    fs::{File, OpenOptions},
};
use tauri::{App, AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow, plugin::TauriPlugin};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

/// Fullscreen isn't saved, so Studio reopens as a normal window
const FLAGS: StateFlags = StateFlags::SIZE
    .union(StateFlags::POSITION)
    .union(StateFlags::MAXIMIZED);

/// Saves the window's size, position, and whether it's maximized when Studio closes, `restore()` applies them
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_window_state::Builder::new()
        .with_state_flags(FLAGS)
        .skip_initial_state("main")
        .build()
}

/// This window's position among open Studio windows, `0` for the first. Each window is its own process, so it's claimed
/// with a lock file that's freed when the process exits, for the next window to take.
struct WindowSlot(
    u32,
    #[expect(dead_code, reason = "Only held so the lock stays locked")] File,
);

/// Take the lowest slot no other open window holds
fn claim_slot(app: &App) -> Option<WindowSlot> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    for slot in 0.. {
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(dir.join(format!("window-{slot}.lock")))
            .ok()?;
        if file.try_lock().is_ok() {
            return Some(WindowSlot(slot, file));
        }
    }
    None
}

/// This window's slot, `None` if it couldn't be claimed
#[tauri::command]
pub fn window_slot(app: AppHandle) -> Option<u32> {
    app.try_state::<WindowSlot>().map(|slot| slot.0)
}

/// Restore how the last closed window was set up.
/// Each window is its own process, so only the first one goes back to the saved position, the others are centered so they don't cover it.
///
/// The window starts hidden and the app shows it once it loads, since macOS animates a visible window zooming to fill
/// the screen when it was maximized. Showing it here would be too early, maximizing is queued on the main thread.
pub fn restore(app: &App) {
    let slot = claim_slot(app);
    let first_window = slot.as_ref().is_some_and(|slot| slot.0 == 0);
    if let Some(slot) = slot {
        app.manage(slot);
    }

    let window = app.get_webview_window("main").unwrap();
    let result = if first_window {
        window.restore_state(FLAGS)
    } else {
        center_saved_size(app, &window).and_then(|()| window.restore_state(StateFlags::MAXIMIZED))
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
fn center_saved_size(app: &App, window: &WebviewWindow) -> tauri::Result<()> {
    let path = app.path().app_config_dir()?.join(app.handle().filename());
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
