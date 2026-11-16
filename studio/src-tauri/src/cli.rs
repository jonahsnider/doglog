//! The `doglog` terminal command

use clap::{Arg, Command, value_parser};
use std::path::PathBuf;
#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager};

/// Parse the `doglog` command's arguments, which Windows and Linux also use to open files, returning the log to open.
/// Exits after `--help`, `--version`, or invalid arguments.
pub fn parse_args(version: String) -> Option<PathBuf> {
  Command::new("doglog")
    .bin_name("doglog")
    .about("Open logs in DogLog Studio")
    .version(version)
    .arg(Arg::new("log").help("Path to a .wpilog file").value_parser(value_parser!(PathBuf)))
    .get_matches()
    .remove_one("log")
}

/// Where the settings page installs the `doglog` command on macOS
#[cfg(target_os = "macos")]
const CLI_LINK: &str = "/usr/local/bin/doglog";

/// The `doglog` script in this copy of Studio's app bundle
#[cfg(target_os = "macos")]
fn cli_script(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(app.path().resource_dir().map_err(|error| error.to_string())?.join("bin/doglog"))
}

/// Whether the `doglog` command is `missing`, `installed` for this copy of Studio, or `other` when it's something else,
/// ex. a copy of Studio that was moved
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn cli_status(app: AppHandle) -> Result<&'static str, String> {
  let script = cli_script(&app)?;
  Ok(match std::fs::read_link(CLI_LINK) {
    Ok(target) if target == script => "installed",
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => "missing",
    _ => "other",
  })
}

/// Link `/usr/local/bin/doglog` to the script in the app bundle, macOS asks for an admin password to do it
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn install_cli(app: AppHandle) -> Result<(), String> {
  let output = std::process::Command::new("osascript")
    .args([
      "-e",
      "on run argv",
      "-e",
      r#"do shell script "mkdir -p /usr/local/bin && ln -sf " & quoted form of item 1 of argv & " " & quoted form of item 2 of argv with administrator privileges"#,
      "-e",
      "end run",
    ])
    .arg(cli_script(&app)?)
    .arg(CLI_LINK)
    .output()
    .map_err(|error| error.to_string())?;
  if output.status.success() {
    Ok(())
  } else {
    Err(String::from_utf8_lossy(&output.stderr).trim().to_owned())
  }
}
