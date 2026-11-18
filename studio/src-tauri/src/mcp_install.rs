//! Add the doglog MCP server to coding agents, using each agent's own way to add MCP servers so they own their config
//! formats

use base64::{Engine, prelude::BASE64_STANDARD};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    ffi::{OsStr, OsString},
    path::{Path, PathBuf},
    process::{Command, ExitCode, Stdio},
};

/// The MCP server's name in agents' configs
const SERVER_NAME: &str = "doglog";

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Agent {
    ClaudeCode,
    Codex,
    GeminiCli,
    VsCode,
    Cursor,
}

/// How an agent adds an MCP server
#[derive(Debug, PartialEq)]
enum Installer {
    /// Arguments to the agent's command
    Run(Vec<String>),
    /// A link the agent opens to ask the user to add it
    Link(String),
}

impl Agent {
    const ALL: [Self; 5] = [
        Self::ClaudeCode,
        Self::Codex,
        Self::GeminiCli,
        Self::VsCode,
        Self::Cursor,
    ];

    fn name(self) -> &'static str {
        match self {
            Self::ClaudeCode => "Claude Code",
            Self::Codex => "Codex",
            Self::GeminiCli => "Gemini CLI",
            Self::VsCode => "VS Code",
            Self::Cursor => "Cursor",
        }
    }

    /// The agent's terminal command, which shows it's installed
    fn command(self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude",
            Self::Codex => "codex",
            Self::GeminiCli => "gemini",
            Self::VsCode => "code",
            Self::Cursor => "cursor",
        }
    }

    /// How to add the MCP server for every project, given the path to the `doglog` command
    fn installer(self, doglog: &str) -> Installer {
        let run = |args: &[&str]| Installer::Run(args.iter().map(|arg| arg.to_string()).collect());
        match self {
            // https://code.claude.com/docs/en/mcp
            Self::ClaudeCode => run(&["mcp", "add", "--scope", "user", SERVER_NAME, "--", doglog, "mcp"]),
            // https://developers.openai.com/codex/mcp
            Self::Codex => run(&["mcp", "add", SERVER_NAME, "--", doglog, "mcp"]),
            // https://geminicli.com/docs/tools/mcp-server/
            Self::GeminiCli => run(&["mcp", "add", "--scope", "user", SERVER_NAME, doglog, "mcp"]),
            // https://code.visualstudio.com/docs/agents/reference/mcp-configuration
            Self::VsCode => {
                let mut config = server_config(doglog);
                config["name"] = SERVER_NAME.into();
                config["type"] = "stdio".into();
                run(&["--add-mcp", &config.to_string()])
            }
            // https://cursor.com/docs/context/mcp/install-links
            Self::Cursor => {
                let config = BASE64_STANDARD.encode(server_config(doglog).to_string());
                let config = config.replace('+', "%2B").replace('/', "%2F").replace('=', "%3D");
                Installer::Link(format!(
                    "cursor://anysphere.cursor-deeplink/mcp/install?name={SERVER_NAME}&config={config}"
                ))
            }
        }
    }
}

/// The MCP server config, as most agents write it
fn server_config(doglog: &str) -> Value {
    json!({ "command": doglog, "args": ["mcp"] })
}

/// The path to the `doglog` command for agents to run, an absolute path since apps don't always have it in their PATH.
/// None when it isn't installed.
fn doglog_command() -> Option<String> {
    // Where the settings page installs it
    #[cfg(target_os = "macos")]
    let path = PathBuf::from(crate::cli::CLI_LINK);
    // Where the deb package installs it, AppImages don't have one
    #[cfg(target_os = "linux")]
    let path = PathBuf::from("/usr/bin/doglog");
    // Studio itself, since agents built on Node can't run `doglog.cmd` without a shell
    #[cfg(windows)]
    let path = std::env::current_exe().ok()?;

    path.exists().then(|| path.to_string_lossy().into_owned())
}

/// Find a command in a PATH
fn find_command(name: &str, path: &OsStr) -> Option<PathBuf> {
    #[cfg(windows)]
    const EXTENSIONS: &[&str] = &[".exe", ".cmd"];
    #[cfg(not(windows))]
    const EXTENSIONS: &[&str] = &[""];

    std::env::split_paths(path).find_map(|dir| {
        EXTENSIONS
            .iter()
            .map(|extension| dir.join(format!("{name}{extension}")))
            .find(|file| file.is_file())
    })
}

/// Add the MCP server to an agent, given the path to its command and the PATH to run it with
fn install(agent: Agent, program: &Path, doglog: &str, path: &OsStr) -> Result<(), String> {
    match agent.installer(doglog) {
        Installer::Link(url) => tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| error.to_string()),
        Installer::Run(args) => {
            // Claude Code won't replace a server that's already added
            if agent == Agent::ClaudeCode {
                let _ = run(program, &["mcp", "remove", "--scope", "user", SERVER_NAME], path);
            }
            run(program, &args, path)
        }
    }
}

fn run(program: &Path, args: &[impl AsRef<OsStr>], path: &OsStr) -> Result<(), String> {
    let mut command = Command::new(program);
    // Agents' commands often need others from the PATH, ex. `node`
    command.args(args).env("PATH", path).stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW, so running one from Studio doesn't flash a terminal
        command.creation_flags(0x0800_0000);
    }

    let output = command.output().map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(());
    }
    let error = String::from_utf8_lossy(if output.stderr.is_empty() {
        &output.stdout
    } else {
        &output.stderr
    });
    Err(error.trim().to_owned())
}

/// `doglog mcp install`, which adds the MCP server to every agent it finds
pub fn run_cli() -> ExitCode {
    let Some(doglog) = doglog_command() else {
        eprintln!("The doglog command isn't installed");
        return ExitCode::FAILURE;
    };
    let path = std::env::var_os("PATH").unwrap_or_default();

    let mut result = ExitCode::SUCCESS;
    let mut found = false;
    for agent in Agent::ALL {
        let Some(program) = find_command(agent.command(), &path) else {
            continue;
        };
        found = true;
        match install(agent, &program, &doglog, &path) {
            Ok(()) if agent == Agent::Cursor => println!("Opened Cursor to add doglog"),
            Ok(()) => println!("Added doglog to {}", agent.name()),
            Err(error) => {
                eprintln!("Couldn't add doglog to {}: {error}", agent.name());
                result = ExitCode::FAILURE;
            }
        }
    }
    if !found {
        let names: Vec<_> = Agent::ALL.iter().map(|agent| agent.name()).collect();
        println!("Found no supported agents ({})", names.join(", "));
    }

    println!(
        "\nFor other agents, add this MCP server config:\n{}",
        manual_config(&doglog)
    );
    result
}

/// The config to add the MCP server to an agent by hand
fn manual_config(doglog: &str) -> String {
    // Written out so `command` comes first, serde_json sorts keys
    let doglog = Value::from(doglog);
    format!(
        r#"{{
  "mcpServers": {{
    "{SERVER_NAME}": {{
      "command": {doglog},
      "args": ["mcp"]
    }}
  }}
}}"#
    )
}

/// The PATH to find agents with. Apps opened from the desktop on macOS and Linux don't get the PATH terminals use, so
/// it comes from the user's login shell.
fn agent_path() -> &'static OsStr {
    static PATH: std::sync::LazyLock<OsString> = std::sync::LazyLock::new(|| {
        #[cfg(unix)]
        if let Some(path) = login_shell_path() {
            return path;
        }
        std::env::var_os("PATH").unwrap_or_default()
    });
    &PATH
}

#[cfg(unix)]
fn login_shell_path() -> Option<OsString> {
    // Interactive too, since some shells set PATH in files only interactive shells read, ex. `.zshrc`
    // Rc files can print, so the PATH follows a marker
    let output = Command::new(std::env::var_os("SHELL")?)
        .args(["-i", "-l", "-c", r#"printf '%s%s' __doglog_path__ "$PATH""#])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let stdout = String::from_utf8(output.stdout).ok()?;
    Some(stdout.rsplit_once("__doglog_path__")?.1.into())
}

#[derive(Serialize)]
pub struct DetectedAgent {
    id: Agent,
    name: &'static str,
}

/// The coding agents on this computer that Studio can add the MCP server to
#[tauri::command]
pub async fn mcp_agents() -> Vec<DetectedAgent> {
    Agent::ALL
        .into_iter()
        .filter(|agent| find_command(agent.command(), agent_path()).is_some())
        .map(|agent| DetectedAgent {
            id: agent,
            name: agent.name(),
        })
        .collect()
}

/// Add the MCP server to an agent
#[tauri::command]
pub async fn install_mcp(agent: Agent) -> Result<(), String> {
    let doglog = doglog_command().ok_or("The doglog command isn't installed")?;
    let program = find_command(agent.command(), agent_path()).ok_or(format!("Couldn't find {}", agent.name()))?;
    install(agent, &program, &doglog, agent_path())
}

/// The config to add the MCP server to an agent by hand, None when the `doglog` command isn't installed
#[tauri::command]
pub fn mcp_config() -> Option<String> {
    doglog_command().map(|doglog| manual_config(&doglog))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursor_link_decodes_to_server_config() {
        let Installer::Link(url) = Agent::Cursor.installer("/usr/local/bin/doglog") else {
            panic!("Cursor uses a link");
        };
        let (prefix, config) = url.split_once("&config=").unwrap();
        assert_eq!(prefix, "cursor://anysphere.cursor-deeplink/mcp/install?name=doglog");
        let config = config.replace("%2B", "+").replace("%2F", "/").replace("%3D", "=");
        let config: Value = serde_json::from_slice(&BASE64_STANDARD.decode(config).unwrap()).unwrap();
        assert_eq!(config, json!({ "command": "/usr/local/bin/doglog", "args": ["mcp"] }));
    }

    #[test]
    fn vs_code_gets_named_stdio_server() {
        let doglog = r"C:\Program Files\DogLog Studio\doglog-studio.exe";
        let Installer::Run(args) = Agent::VsCode.installer(doglog) else {
            panic!("VS Code uses its command");
        };
        assert_eq!(args[0], "--add-mcp");
        let config: Value = serde_json::from_str(&args[1]).unwrap();
        assert_eq!(
            config,
            json!({ "name": "doglog", "type": "stdio", "command": doglog, "args": ["mcp"] })
        );
    }

    #[test]
    fn manual_config_is_json() {
        let doglog = r"C:\Program Files\DogLog Studio\doglog-studio.exe";
        let config: Value = serde_json::from_str(&manual_config(doglog)).unwrap();
        assert_eq!(
            config,
            json!({ "mcpServers": { "doglog": { "command": doglog, "args": ["mcp"] } } })
        );
    }
}
