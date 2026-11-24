//! Signing in to Cloud through Studio's website, which hands the result back with a `doglog://sign-in` link. See
//! `src/cloud/sign-in-handoff.ts`.

use tauri::{
    AppHandle, Emitter, Runtime, Url,
    plugin::{Builder, TauriPlugin},
};

/// Convex Auth navigates the window to the identity provider. Open that URL in the default browser instead so the
/// sign-in works outside the embedded webview and the callback reaches Studio's website.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("cloud-sign-in")
        .on_navigation(|_, url| {
            if url.scheme() != "https"
                || !matches!(
                    (url.host_str(), url.path()),
                    (Some("appleid.apple.com"), _) | (Some("accounts.google.com"), "/o/oauth2/v2/auth")
                )
            {
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
