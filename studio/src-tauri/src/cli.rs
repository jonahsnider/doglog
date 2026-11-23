//! The `doglog` terminal command

use crate::agent;
use clap::{Arg, Command};
use std::ops::ControlFlow;
use std::path::PathBuf;
use std::process::ExitCode;
#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager};

/// Parse the `doglog` command's arguments, which Windows and Linux also use to open files. Continues with the log to
/// open, or breaks with an exit code after running a terminal command, `--help`, `--version`, or invalid arguments.
pub fn parse_args(version: String) -> ControlFlow<ExitCode, Option<PathBuf>> {
    // Windows and Linux open `doglog://` links by starting Studio with the link as its only argument, which the deep
    // link plugin reads
    if std::env::args_os()
        .nth(1)
        .is_some_and(|arg| arg.to_string_lossy().starts_with("doglog://"))
    {
        return ControlFlow::Continue(None);
    }

    let command = Command::new("doglog")
        .bin_name("doglog")
        .about(&agent::API.instructions)
        .version(&version)
        .args_conflicts_with_subcommands(true)
        .arg(
            Arg::new("log")
                .help("Path to a .wpilog or .wpilogxz file to open in a new window")
                .value_parser(log_path),
        )
        .subcommand(
            Command::new("mcp")
                .about("Run the MCP server for agents over standard input and output")
                .subcommand(Command::new("install").about("Add the doglog MCP server to your coding agents")),
        )
        .subcommands(agent::cli::subcommands());

    let mut matches = match command.try_get_matches() {
        Ok(matches) => matches,
        Err(error) => {
            attach_console();
            let _ = error.print();
            return ControlFlow::Break(ExitCode::from(error.exit_code() as u8));
        }
    };
    match matches.remove_subcommand() {
        None => ControlFlow::Continue(matches.remove_one("log")),
        Some((name, matches)) => {
            attach_console();
            ControlFlow::Break(match (name.as_str(), matches.subcommand_name()) {
                #[cfg(desktop)]
                ("mcp", Some("install")) => crate::mcp_install::run_cli(),
                ("mcp", _) => agent::mcp::run(version),
                (resource, _) => agent::cli::run(resource, &matches),
            })
        }
    }
}

/// A log to open must be a file, so a mistyped command (ex. `doglog dashbaord`) fails instead of opening Studio
fn log_path(value: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(value);
    if path.is_file() {
        Ok(path)
    } else {
        Err("not a command or a file".to_owned())
    }
}

/// Studio is a GUI app on Windows, which only has standard output when it's redirected, ex. by an MCP client. Otherwise
/// this writes to the terminal that ran it.
fn attach_console() {
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Console::{
            ATTACH_PARENT_PROCESS, AttachConsole, GetStdHandle, STD_OUTPUT_HANDLE,
        };
        // SAFETY: Both only read or set this process's standard handles
        unsafe {
            if GetStdHandle(STD_OUTPUT_HANDLE).is_null() {
                AttachConsole(ATTACH_PARENT_PROCESS);
            }
        }
    }
}

/// Where the settings page installs the `doglog` command on macOS
#[cfg(target_os = "macos")]
pub(crate) const CLI_LINK: &str = "/usr/local/bin/doglog";

/// The `doglog` script in this copy of Studio's app bundle
#[cfg(target_os = "macos")]
fn cli_script(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?
        .join("bin/doglog"))
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
