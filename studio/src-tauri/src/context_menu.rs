//! Native context menus the frontend makes

use tauri::menu::{ContextMenu, Menu};
use tauri::{Manager, Position, ResourceId, Webview, Window};

/// Pop up a menu made with `Menu.new()` at `at`, or at the pointer, until the user closes it.
///
/// Tauri's own `popup` command keeps the webview's resource table locked while the menu is open. Menu commands the
/// frontend sends meanwhile, ex. enabling an app menu item as the live source reconnects, run on the main thread that's
/// showing the menu and wait for the table forever, hanging the app.
#[tauri::command]
pub async fn popup_menu(webview: Webview, window: Window, rid: ResourceId, at: Option<Position>) -> Result<(), String> {
    // The table is unlocked at the end of this statement
    let menu = webview
        .resources_table()
        .get::<Menu<tauri::Wry>>(rid)
        .map_err(|error| error.to_string())?;
    match at {
        Some(at) => menu.popup_at(window, at),
        None => menu.popup(window),
    }
    .map_err(|error| error.to_string())
}
