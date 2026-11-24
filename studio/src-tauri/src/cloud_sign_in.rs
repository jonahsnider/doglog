//! Signing in to Cloud through Studio's website, which hands the result back with a `doglog://sign-in` link. See
//! `src/cloud/sign-in-handoff.ts`.

use tauri::{
    AppHandle, Emitter, Runtime, Url,
    plugin::{Builder, TauriPlugin},
};

/// Opens Apple's sign-in page in the default browser instead of the window. Convex Auth navigates the window to it, and
/// Apple then returns to Studio's website, which can't return to a window.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("cloud-sign-in")
        .on_navigation(|_, url| {
            if url.scheme() != "https" || url.host_str() != Some("appleid.apple.com") {
                return true;
            }
            let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
            false
        })
        .build()
}

/// Sends a `doglog://sign-in` link to every window, only the one that started the sign-in can decrypt it
pub fn forward_link<R: Runtime>(app: &AppHandle<R>, url: &Url) {
    let _ = app.emit("sign-in-link", url.as_str());
}
