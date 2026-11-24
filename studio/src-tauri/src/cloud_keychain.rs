//! Keeps the key that wraps a Cloud account's private key in the OS credential store: the Keychain on macOS, the
//! Credential Manager on Windows, and the Secret Service on Linux. The wrapped private key stays in the webview's
//! storage, so reading it from disk isn't enough to decrypt it.

use std::sync::Mutex;

use keyring::{Entry, Error};
use tauri::async_runtime::spawn_blocking;

const SERVICE: &str = "studio.doglog.cloud-account-key";
const KEY_LENGTH: usize = 32;

/// Every window runs in this process, so this keeps two windows from each creating a key for the same account
static LOCK: Mutex<()> = Mutex::new(());

fn get_or_create(account: &str) -> Result<Vec<u8>, String> {
    let _guard = LOCK.lock().map_err(|_| "Keychain lock poisoned".to_string())?;
    let entry = Entry::new(SERVICE, account).map_err(|error| error.to_string())?;
    match entry.get_secret() {
        Ok(key) if key.len() == KEY_LENGTH => return Ok(key),
        // A key of the wrong length can't unwrap anything, it's replaced like a missing one
        Ok(_) | Err(Error::NoEntry) => {}
        Err(error) => return Err(error.to_string()),
    }
    let mut key = vec![0; KEY_LENGTH];
    getrandom::fill(&mut key).map_err(|error| error.to_string())?;
    entry.set_secret(&key).map_err(|error| error.to_string())?;
    Ok(key)
}

/// The AES-256 key that wraps `account`'s private key, created the first time it's asked for.
/// `account` identifies the Cloud deployment and account, so each one gets its own key.
#[tauri::command]
pub async fn cloud_account_wrapping_key(account: String) -> Result<Vec<u8>, String> {
    // Credential stores can block, ex. on a macOS access prompt or D-Bus on Linux
    spawn_blocking(move || get_or_create(&account))
        .await
        .map_err(|error| error.to_string())?
}
