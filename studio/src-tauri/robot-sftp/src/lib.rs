//! Lists and downloads log files from a roboRIO over SFTP

use std::{
    collections::HashSet,
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use russh::{
    client::{self, Handle},
    keys::PublicKeyOrCertificate,
};
use russh_sftp::client::SftpSession;
use tokio::{
    fs::OpenOptions,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom},
};

/// roboRIO user that robot code runs as, it has a blank password
const USER: &str = "lvuser";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const CHUNK_SIZE: usize = 64 * 1024;

pub type Result<T> = std::result::Result<T, String>;

struct Client;

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(&mut self, _key: &PublicKeyOrCertificate) -> std::result::Result<bool, Self::Error> {
        // Reimaging a roboRIO changes its host key, and every team's robot uses the same addresses
        Ok(true)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteLog {
    /// Absolute path on the robot
    pub path: String,
    pub name: String,
    pub size: u64,
}

pub struct Robot {
    ssh: Handle<Client>,
    sftp: SftpSession,
}

impl Robot {
    pub async fn connect(host: &str, port: u16) -> Result<Self> {
        let config = Arc::new(client::Config {
            // Notice a robot that turned off or left the network instead of waiting on it forever
            keepalive_interval: Some(Duration::from_secs(5)),
            keepalive_max: 2,
            nodelay: true,
            ..Default::default()
        });

        let mut ssh = tokio::time::timeout(CONNECT_TIMEOUT, client::connect(config, (host, port), Client))
            .await
            .map_err(|_| format!("Timed out connecting to {host}"))?
            .map_err(|error| format!("Couldn't connect to {host}: {error}"))?;

        // The roboRIO allows logging in with no password, older images may only accept an empty one
        let authenticated = ssh
            .authenticate_none(USER)
            .await
            .map_err(|error| error.to_string())?
            .success()
            || ssh
                .authenticate_password(USER, "")
                .await
                .map_err(|error| error.to_string())?
                .success();
        if !authenticated {
            return Err(format!("{host} didn't accept a login for {USER} with no password"));
        }

        let channel = ssh.channel_open_session().await.map_err(|error| error.to_string())?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|error| error.to_string())?;
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|error| error.to_string())?;
        Ok(Self { ssh, sftp })
    }

    /// Whether the connection was lost, ex. the robot turned off
    pub fn is_closed(&self) -> bool {
        self.ssh.is_closed()
    }

    /// List the `.wpilog` files directly in each of `dirs`.
    /// Missing directories are skipped, and directories that are links to an earlier one are only listed once.
    pub async fn list_logs(&self, dirs: &[&str]) -> Result<Vec<RemoteLog>> {
        let mut seen = HashSet::new();
        let mut logs = Vec::new();
        for dir in dirs {
            // Fails when the directory doesn't exist, ex. no USB drive is plugged in
            let Ok(real_dir) = self.sftp.canonicalize(*dir).await else {
                continue;
            };
            if !seen.insert(real_dir.clone()) {
                continue;
            }

            let entries = self
                .sftp
                .read_dir(real_dir.as_str())
                .await
                .map_err(|error| error.to_string())?;
            for entry in entries {
                let name = entry.file_name();
                if entry.file_type().is_file() && (name.ends_with(".wpilog") || name.ends_with(".wpilogxz")) {
                    logs.push(RemoteLog {
                        path: format!("{}/{name}", real_dir.trim_end_matches('/')),
                        size: entry.metadata().len(),
                        name,
                    });
                }
            }
        }
        Ok(logs)
    }

    /// Copy the robot's file at `remote` to `local`, starting at byte `offset`.
    /// `local` must already have exactly `offset` bytes, they're kept and the rest is appended.
    /// Stops early when `cancel` is set, `progress` is called with the bytes copied so far.
    /// Returns the number of bytes copied.
    pub async fn download(
        &self,
        remote: &str,
        local: &Path,
        offset: u64,
        cancel: &AtomicBool,
        mut progress: impl FnMut(u64),
    ) -> Result<u64> {
        let mut local_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(local)
            .await
            .map_err(|error| format!("Couldn't open {}: {error}", local.display()))?;
        let local_size = local_file.metadata().await.map_err(|error| error.to_string())?.len();
        if local_size != offset {
            return Err(format!("{} has {local_size} bytes, expected {offset}", local.display()));
        }

        let mut remote_file = self
            .sftp
            .open(remote)
            .await
            .map_err(|error| format!("Couldn't open {remote}: {error}"))?;
        remote_file
            .seek(SeekFrom::Start(offset))
            .await
            .map_err(|error| error.to_string())?;

        let mut buffer = vec![0; CHUNK_SIZE];
        let mut copied = 0;
        while !cancel.load(Ordering::Relaxed) {
            let read = remote_file.read(&mut buffer).await.map_err(|error| error.to_string())?;
            if read == 0 {
                break;
            }
            local_file
                .write_all(&buffer[..read])
                .await
                .map_err(|error| error.to_string())?;
            copied += read as u64;
            progress(copied);
        }

        local_file.flush().await.map_err(|error| error.to_string())?;
        Ok(copied)
    }
}
