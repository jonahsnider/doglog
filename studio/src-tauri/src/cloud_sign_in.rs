//! Signing in to Cloud. On macOS the OS's own sheet runs passkeys when the build is entitled to, see
//! `cloud_sign_in_macos.rs`. Otherwise sign-in runs on Studio's website, which hands the result back with a
//! `doglog://sign-in` link, see `src/cloud/sign-in-handoff.ts`.

#[cfg(target_os = "macos")]
#[path = "cloud_sign_in_macos.rs"]
pub mod macos;

use serde::Serialize;
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

/// Whether passkeys run in the OS's sheet instead of the browser
#[tauri::command]
pub fn native_passkeys() -> bool {
    #[cfg(target_os = "macos")]
    return macos::supported();
    #[cfg(not(target_os = "macos"))]
    false
}

/// Why a passkey ceremony in the app didn't finish
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
#[derive(Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "lowercase")]
pub enum NativeSignInError {
    Canceled,
    /// The authenticator already has a passkey for the account
    Excluded,
    Failed(String),
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
impl NativeSignInError {
    fn failed(message: String) -> Self {
        Self::Failed(message)
    }
}
