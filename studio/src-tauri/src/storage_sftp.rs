//! Commands for a team's storage on an SFTP server, the frontend decides what to read and write

use std::{
    collections::{HashMap, HashSet},
    path::{Component, Path, PathBuf},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

use percent_encoding::percent_decode;
use russh::{
    client::{self, Handle, KeyboardInteractiveAuthResponse},
    keys::{PrivateKeyWithHashAlg, PublicKeyOrCertificate, decode_secret_key},
};
use russh_sftp::{
    client::{SftpSession, error::Error as SftpError},
    protocol::{OpenFlags, StatusCode},
};
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Manager, State,
    ipc::{Channel, InvokeBody, Request, Response},
};
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom},
    sync::Mutex,
};

use crate::sync::check_local_access;

/// Errors are messages for the frontend
type Result<T> = std::result::Result<T, String>;

/// How long to wait for a server to answer before giving up
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// How much of a file is read or written at a time, russh-sftp splits it into packets and keeps several in flight
const CHUNK_SIZE: usize = 256 * 1024;
/// How often to report transfer progress, sending every chunk floods the frontend
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
/// Added to a file's name while it's being uploaded or written, listing skips these files
const UPLOAD_SUFFIX: &str = ".doglog-upload";

/// The IPC header with the percent-encoded JSON [`StorageConnection`] for [`sftp_write`]
const CONNECTION_HEADER: &str = "doglog-connection";
/// The IPC header with the percent-encoded path for [`sftp_write`]
const PATH_HEADER: &str = "doglog-path";

/// How to reach a team's storage, sent by the frontend with every command
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageConnection {
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    /// An OpenSSH or PEM private key, decrypted with `password` if it has a passphrase
    private_key: Option<String>,
    /// The folder on the server that paths are relative to, empty for the login folder
    root: String,
}

/// Identifies a cached connection, the same login with different roots shares one
type Login = (String, u16, String, Option<String>, Option<String>);

impl StorageConnection {
    /// The key of the cached connection for this login
    fn login(&self) -> Login {
        (
            self.host.clone(),
            self.port,
            self.username.clone(),
            self.password.clone(),
            self.private_key.clone(),
        )
    }

    /// The server's path for `path`, which must be '/'-separated and relative to the root
    fn remote(&self, path: &str) -> Result<String> {
        if path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
        {
            return Err(format!("{path:?} isn't a valid storage path"));
        }
        Ok(join(&self.root, path))
    }
}

/// Open connections by login, reused between commands since connecting is slow
#[derive(Default)]
pub struct SftpServers(Mutex<HashMap<Login, Arc<Server>>>);

/// Cancel flags for running uploads, by upload ID
#[derive(Default)]
pub struct SftpUploads(std::sync::Mutex<HashMap<String, Arc<AtomicBool>>>);

/// A file in storage
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageFile {
    /// Relative to the root
    path: String,
    size: u64,
    /// Milliseconds since the Unix epoch
    modified: u64,
}

/// Handles the SSH connection's events for [`Server`]
struct Client;

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(&mut self, _key: &PublicKeyOrCertificate) -> std::result::Result<bool, Self::Error> {
        // Teams decided not to pin their server's host key
        Ok(true)
    }
}

/// An open connection to a storage server
pub struct Server {
    ssh: Handle<Client>,
    sftp: SftpSession,
}

/// `path` inside `dir`, where an empty `dir` is the login folder
fn join(dir: &str, path: &str) -> String {
    if dir.is_empty() {
        path.to_owned()
    } else if dir.ends_with('/') {
        format!("{dir}{path}")
    } else {
        format!("{dir}/{path}")
    }
}

/// The folder `path` is in, empty for the login folder
fn parent(path: &str) -> &str {
    match path.rfind('/') {
        Some(0) => "/",
        Some(index) => &path[..index],
        None => "",
    }
}

/// Whether `error` is the server saying the path doesn't exist
fn is_missing(error: &SftpError) -> bool {
    matches!(error, SftpError::Status(status) if status.status_code == StatusCode::NoSuchFile)
}

/// Describe a failed `action` on `path`, with a consistent message for missing files
fn describe(error: SftpError, action: &str, path: &str) -> String {
    if is_missing(&error) {
        format!("{path} doesn't exist")
    } else {
        format!("Couldn't {action} {path}: {error}")
    }
}

impl Server {
    /// Connect and log in, with the private key if there is one and then the password
    async fn connect(connection: &StorageConnection) -> Result<Self> {
        let StorageConnection {
            host,
            port,
            username,
            password,
            private_key,
            ..
        } = connection;
        let config = Arc::new(client::Config {
            // Notice a server that left the network instead of waiting on it forever
            keepalive_interval: Some(Duration::from_secs(15)),
            keepalive_max: 3,
            nodelay: true,
            ..Default::default()
        });
        let mut ssh = tokio::time::timeout(CONNECT_TIMEOUT, client::connect(config, (host.as_str(), *port), Client))
            .await
            .map_err(|_| format!("Timed out connecting to {host}"))?
            .map_err(|error| format!("Couldn't connect to {host}: {error}"))?;

        let mut authenticated = false;
        if let Some(private_key) = private_key {
            let key = decode_secret_key(private_key, None)
                .or_else(|error| match password {
                    Some(password) => decode_secret_key(private_key, Some(password)),
                    None => Err(error),
                })
                .map_err(|error| format!("Couldn't read the private key: {error}"))?;
            let hash = ssh.best_supported_rsa_hash().await.ok().flatten().flatten();
            authenticated = ssh
                .authenticate_publickey(username, PrivateKeyWithHashAlg::new(Arc::new(key), hash))
                .await
                .map_err(|error| error.to_string())?
                .success();
        }
        if !authenticated && let Some(password) = password {
            authenticated = ssh
                .authenticate_password(username, password)
                .await
                .map_err(|error| error.to_string())?
                .success();
            // Some servers only take passwords through keyboard-interactive login, answer each prompt with it
            if !authenticated {
                let mut response = ssh
                    .authenticate_keyboard_interactive_start(username, None)
                    .await
                    .map_err(|error| error.to_string())?;
                while let KeyboardInteractiveAuthResponse::InfoRequest { prompts, .. } = response {
                    response = ssh
                        .authenticate_keyboard_interactive_respond(vec![password.clone(); prompts.len()])
                        .await
                        .map_err(|error| error.to_string())?;
                }
                authenticated = matches!(response, KeyboardInteractiveAuthResponse::Success);
            }
        }
        if !authenticated {
            return Err(format!("{host} didn't accept the login for {username}"));
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

    /// Whether the connection was lost, ex. the server restarted
    fn is_closed(&self) -> bool {
        self.ssh.is_closed()
    }

    /// Every regular file under `root`, with paths relative to it. A missing root has no files.
    /// Symbolic links are followed, but each folder is only listed once, so links can't make a loop.
    async fn list(&self, root: &str) -> Result<Vec<StorageFile>> {
        let base = if root.is_empty() { "." } else { root };
        let real_root = match self.sftp.canonicalize(base).await {
            Ok(path) => path,
            Err(error) if is_missing(&error) => return Ok(Vec::new()),
            Err(error) => return Err(describe(error, "open", base)),
        };

        let mut files = Vec::new();
        let mut seen = HashSet::from([real_root.clone()]);
        // Each folder's path relative to the root and its real path on the server
        let mut folders = vec![(String::new(), real_root)];
        while let Some((relative_dir, dir)) = folders.pop() {
            let entries = match self.sftp.read_dir(dir.as_str()).await {
                Ok(entries) => entries,
                Err(error) if is_missing(&error) => continue,
                Err(error) => return Err(describe(error, "list", &dir)),
            };
            for entry in entries {
                let name = entry.file_name();
                if name.ends_with(UPLOAD_SUFFIX) {
                    continue;
                }
                let relative = join(&relative_dir, &name);
                let path = join(&dir, &name);
                let mut metadata = entry.metadata();
                if metadata.is_symlink() {
                    // A link to nothing is skipped
                    let Ok(target) = self.sftp.metadata(path.as_str()).await else {
                        continue;
                    };
                    if target.is_dir() {
                        let Ok(real_path) = self.sftp.canonicalize(path.as_str()).await else {
                            continue;
                        };
                        if seen.insert(real_path.clone()) {
                            folders.push((relative, real_path));
                        }
                        continue;
                    }
                    metadata = target;
                } else if metadata.is_dir() {
                    if seen.insert(path.clone()) {
                        folders.push((relative, path));
                    }
                    continue;
                }

                if metadata.is_regular() {
                    files.push(StorageFile {
                        path: relative,
                        size: metadata.len(),
                        modified: u64::from(metadata.mtime.unwrap_or(0)) * 1000,
                    });
                }
            }
        }
        Ok(files)
    }

    /// The bytes of the file at `path`
    async fn read(&self, path: &str) -> Result<Vec<u8>> {
        let mut file = self
            .sftp
            .open(path)
            .await
            .map_err(|error| describe(error, "open", path))?;
        let size = file.metadata().await.map_or(0, |metadata| metadata.len());
        let mut bytes = Vec::with_capacity(usize::try_from(size).unwrap_or(0));
        file.read_to_end(&mut bytes)
            .await
            .map_err(|error| format!("Couldn't read {path}: {error}"))?;
        Ok(bytes)
    }

    /// Create the folder at `dir` and the folders it's in
    async fn create_dirs(&self, dir: &str) -> Result<()> {
        let mut missing = Vec::new();
        let mut current = dir;
        while !current.is_empty() && current != "/" {
            match self.sftp.metadata(current).await {
                Ok(metadata) if metadata.is_dir() => break,
                Ok(_) => return Err(format!("{current} isn't a folder")),
                Err(error) if is_missing(&error) => {
                    missing.push(current);
                    current = parent(current);
                }
                Err(error) => return Err(describe(error, "open", current)),
            }
        }
        for dir in missing.into_iter().rev() {
            if let Err(error) = self.sftp.create_dir(dir).await {
                // Another client may have just created it
                if !self.sftp.metadata(dir).await.is_ok_and(|metadata| metadata.is_dir()) {
                    return Err(describe(error, "create", dir));
                }
            }
        }
        Ok(())
    }

    /// Move `from` to `to`, replacing a file at `to`
    async fn replace(&self, from: &str, to: &str) -> Result<()> {
        // Atomic on servers that support it, so others never see `to` missing
        if self
            .sftp
            .posix_rename(from, to)
            .await
            .map_err(|error| describe(error, "move", from))?
        {
            return Ok(());
        }
        // Plain SFTP renames refuse to overwrite
        match self.sftp.symlink_metadata(to).await {
            Ok(metadata) if !metadata.is_dir() => self
                .sftp
                .remove_file(to)
                .await
                .map_err(|error| describe(error, "replace", to))?,
            _ => {}
        }
        self.sftp
            .rename(from, to)
            .await
            .map_err(|error| describe(error, "move", from))
    }

    /// Write all of `bytes` to `path`, replacing it once they're all written so it's never partly written
    async fn write(&self, path: &str, bytes: &[u8]) -> Result<()> {
        self.create_dirs(parent(path)).await?;
        let temp = format!("{path}{UPLOAD_SUFFIX}");
        let mut file = self
            .sftp
            .create(temp.as_str())
            .await
            .map_err(|error| describe(error, "create", &temp))?;
        file.write_all(bytes)
            .await
            .map_err(|error| format!("Couldn't write {path}: {error}"))?;
        file.shutdown()
            .await
            .map_err(|error| format!("Couldn't write {path}: {error}"))?;
        self.replace(&temp, path).await
    }

    /// Upload `local` to `remote`, resuming an earlier upload that was stopped.
    /// Stops early when `cancel` is set, leaving what was uploaded to resume later.
    /// `progress` is called with how much of the file is uploaded. Returns the number of bytes sent.
    async fn upload(
        &self,
        local: &Path,
        remote: &str,
        cancel: &AtomicBool,
        mut progress: impl FnMut(u64),
    ) -> Result<u64> {
        let mut local_file = fs::File::open(local)
            .await
            .map_err(|error| format!("Couldn't open {}: {error}", local.display()))?;
        let size = local_file.metadata().await.map_err(|error| error.to_string())?.len();

        self.create_dirs(parent(remote)).await?;
        let temp = format!("{remote}{UPLOAD_SUFFIX}");
        let offset = match self.sftp.metadata(temp.as_str()).await {
            Ok(metadata) if metadata.len() <= size => metadata.len(),
            Ok(_) => 0,
            Err(error) if is_missing(&error) => 0,
            Err(error) => return Err(describe(error, "open", &temp)),
        };
        let flags = if offset == 0 {
            OpenFlags::CREATE | OpenFlags::TRUNCATE | OpenFlags::WRITE
        } else {
            OpenFlags::WRITE
        };
        let mut remote_file = self
            .sftp
            .open_with_flags(temp.as_str(), flags)
            .await
            .map_err(|error| describe(error, "create", &temp))?;
        remote_file
            .seek(SeekFrom::Start(offset))
            .await
            .map_err(|error| error.to_string())?;
        local_file
            .seek(SeekFrom::Start(offset))
            .await
            .map_err(|error| error.to_string())?;

        let mut buffer = vec![0; CHUNK_SIZE];
        let mut sent = 0;
        let mut cancelled = false;
        loop {
            if cancel.load(Ordering::Relaxed) {
                cancelled = true;
                break;
            }
            let read = local_file.read(&mut buffer).await.map_err(|error| error.to_string())?;
            if read == 0 {
                break;
            }
            remote_file
                .write_all(&buffer[..read])
                .await
                .map_err(|error| format!("Couldn't upload {remote}: {error}"))?;
            sent += read as u64;
            progress(offset + sent);
        }

        // Waits for the writes still in flight, so a later upload resumes after all of them
        remote_file
            .shutdown()
            .await
            .map_err(|error| format!("Couldn't upload {remote}: {error}"))?;
        if !cancelled {
            self.replace(&temp, remote).await?;
        }
        Ok(sent)
    }

    /// Copy the file at `remote` to `local`, `progress` is called with the bytes copied so far
    async fn download(&self, remote: &str, local: &Path, mut progress: impl FnMut(u64)) -> Result<()> {
        let mut remote_file = self
            .sftp
            .open(remote)
            .await
            .map_err(|error| describe(error, "open", remote))?;
        if let Some(dir) = local.parent() {
            fs::create_dir_all(dir).await.map_err(|error| error.to_string())?;
        }
        // Written next to `local` first, so a stopped download doesn't leave a partial file there
        let mut temp = local.as_os_str().to_owned();
        temp.push(".part");
        let temp = PathBuf::from(temp);
        let mut local_file = fs::File::create(&temp)
            .await
            .map_err(|error| format!("Couldn't create {}: {error}", temp.display()))?;

        let mut buffer = vec![0; CHUNK_SIZE];
        let mut copied = 0;
        loop {
            let read = remote_file
                .read(&mut buffer)
                .await
                .map_err(|error| format!("Couldn't download {remote}: {error}"))?;
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
        drop(local_file);
        fs::rename(&temp, local).await.map_err(|error| error.to_string())
    }

    /// Delete the file at `path`, or the folder and everything in it. Missing is fine.
    async fn remove(&self, path: &str) -> Result<()> {
        match self.sftp.symlink_metadata(path).await {
            Ok(metadata) if metadata.is_dir() => {}
            Ok(_) => {
                return self
                    .sftp
                    .remove_file(path)
                    .await
                    .or_else(|error| if is_missing(&error) { Ok(()) } else { Err(error) })
                    .map_err(|error| describe(error, "delete", path));
            }
            Err(error) if is_missing(&error) => return Ok(()),
            Err(error) => return Err(describe(error, "delete", path)),
        }

        // Each folder is pushed again after its contents, so it's removed once they're gone.
        // Links are removed rather than followed.
        let mut folders = vec![(path.to_owned(), false)];
        while let Some((dir, emptied)) = folders.pop() {
            if emptied {
                self.sftp
                    .remove_dir(dir.as_str())
                    .await
                    .map_err(|error| describe(error, "delete", &dir))?;
                continue;
            }
            let entries = self
                .sftp
                .read_dir(dir.as_str())
                .await
                .map_err(|error| describe(error, "list", &dir))?;
            folders.push((dir.clone(), true));
            for entry in entries {
                let child = format!("{dir}/{}", entry.file_name());
                if entry.metadata().is_dir() {
                    folders.push((child, false));
                } else {
                    self.sftp
                        .remove_file(child.as_str())
                        .await
                        .map_err(|error| describe(error, "delete", &child))?;
                }
            }
        }
        Ok(())
    }
}

/// Run `action` with a connection for `connection`'s login, connecting first if needed.
/// The connection is dropped after an error, so the next command starts fresh.
async fn with_server<T>(
    servers: &SftpServers,
    connection: &StorageConnection,
    action: impl AsyncFnOnce(&Server) -> Result<T>,
) -> Result<T> {
    let login = connection.login();
    let server = {
        let mut servers = servers.0.lock().await;
        match servers.get(&login) {
            Some(server) if !server.is_closed() => server.clone(),
            _ => {
                servers.remove(&login);
                let server = Arc::new(Server::connect(connection).await?);
                servers.insert(login.clone(), server.clone());
                server
            }
        }
    };

    // Other commands can use the connection meanwhile, ex. listing files during an upload
    let result = action(&server).await;
    if result.is_err() {
        let mut servers = servers.0.lock().await;
        if servers.get(&login).is_some_and(|cached| Arc::ptr_eq(cached, &server)) {
            servers.remove(&login);
        }
    }
    result
}

/// Every file in storage, except unfinished uploads
#[tauri::command]
pub async fn sftp_list(servers: State<'_, SftpServers>, connection: StorageConnection) -> Result<Vec<StorageFile>> {
    with_server(&servers, &connection, async |server| {
        server.list(&connection.root).await
    })
    .await
}

/// The bytes of the file at `path`
#[tauri::command]
pub async fn sftp_read(
    servers: State<'_, SftpServers>,
    connection: StorageConnection,
    path: String,
) -> Result<Response> {
    let remote = connection.remote(&path)?;
    let bytes = with_server(&servers, &connection, async |server| server.read(&remote).await).await?;
    Ok(Response::new(bytes))
}

/// Write the request's raw body to a file, creating the folders it's in and replacing the file if it exists.
/// The connection and path are sent as percent-encoded headers, since the body is the file:
/// `invoke('sftp_write', bytes, { headers: { 'doglog-connection': encodeURIComponent(JSON.stringify(connection)),
/// 'doglog-path': encodeURIComponent(path) } })`
#[tauri::command]
pub async fn sftp_write(servers: State<'_, SftpServers>, request: Request<'_>) -> Result<()> {
    let header = |name: &str| {
        let value = request
            .headers()
            .get(name)
            .ok_or_else(|| format!("Missing the {name} header"))?;
        percent_decode(value.as_bytes())
            .decode_utf8()
            .map(|value| value.into_owned())
            .map_err(|error| format!("Couldn't read the {name} header: {error}"))
    };
    let connection: StorageConnection =
        serde_json::from_str(&header(CONNECTION_HEADER)?).map_err(|error| error.to_string())?;
    let remote = connection.remote(&header(PATH_HEADER)?)?;
    // The IPC fallback sends the body as a JSON array of bytes
    let json_bytes;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        InvokeBody::Json(value) => {
            json_bytes = Vec::<u8>::deserialize(value).map_err(|error| error.to_string())?;
            &json_bytes
        }
    };
    with_server(&servers, &connection, async |server| server.write(&remote, bytes).await).await
}

/// Upload the file at `local_path` to `path`, resuming an upload that was stopped.
/// Returns the number of bytes sent, which is less than the rest of the file if it was cancelled.
#[tauri::command]
#[expect(
    clippy::too_many_arguments,
    reason = "Tauri passes command arguments as function parameters"
)]
pub async fn sftp_upload(
    app: AppHandle,
    servers: State<'_, SftpServers>,
    uploads: State<'_, SftpUploads>,
    connection: StorageConnection,
    local_path: PathBuf,
    path: String,
    upload_id: String,
    on_progress: Channel<u64>,
) -> Result<u64> {
    check_local_access(&app, &local_path)?;
    let remote = connection.remote(&path)?;

    let cancel = Arc::new(AtomicBool::new(false));
    uploads.0.lock().unwrap().insert(upload_id.clone(), cancel.clone());
    let mut last_progress = Instant::now();
    let result = with_server(&servers, &connection, async |server| {
        server
            .upload(&local_path, &remote, &cancel, |uploaded| {
                if last_progress.elapsed() >= PROGRESS_INTERVAL {
                    last_progress = Instant::now();
                    let _ = on_progress.send(uploaded);
                }
            })
            .await
    })
    .await;
    uploads.0.lock().unwrap().remove(&upload_id);
    result
}

/// Stop the upload with `upload_id`, which returns early and can be resumed later
#[tauri::command]
pub fn sftp_cancel_upload(uploads: State<SftpUploads>, upload_id: String) {
    if let Some(cancel) = uploads.0.lock().unwrap().get(&upload_id) {
        cancel.store(true, Ordering::Relaxed);
    }
}

/// Copy the file at `path` to `local_path`, which must be in Studio's cache folder
#[tauri::command]
pub async fn sftp_download(
    app: AppHandle,
    servers: State<'_, SftpServers>,
    connection: StorageConnection,
    path: String,
    local_path: PathBuf,
    on_progress: Channel<u64>,
) -> Result<()> {
    let cache = app.path().app_cache_dir().map_err(|error| error.to_string())?;
    if local_path == cache
        || !local_path.starts_with(&cache)
        || local_path
            .components()
            .any(|component| component == Component::ParentDir)
    {
        return Err(format!(
            "Studio only downloads from storage to its cache folder, not {}",
            local_path.display()
        ));
    }
    let remote = connection.remote(&path)?;

    let mut last_progress = Instant::now();
    with_server(&servers, &connection, async |server| {
        server
            .download(&remote, &local_path, |copied| {
                if last_progress.elapsed() >= PROGRESS_INTERVAL {
                    last_progress = Instant::now();
                    let _ = on_progress.send(copied);
                }
            })
            .await
    })
    .await
}

/// Delete a file, or a folder and everything in it. Missing is fine.
#[tauri::command]
pub async fn sftp_remove(servers: State<'_, SftpServers>, connection: StorageConnection, path: String) -> Result<()> {
    let remote = connection.remote(&path)?;
    with_server(&servers, &connection, async |server| server.remove(&remote).await).await
}

/// Move a file or folder, creating the folders `to` is in and replacing a file at `to`
#[tauri::command]
pub async fn sftp_rename(
    servers: State<'_, SftpServers>,
    connection: StorageConnection,
    from: String,
    to: String,
) -> Result<()> {
    let from = connection.remote(&from)?;
    let to = connection.remote(&to)?;
    with_server(&servers, &connection, async |server| {
        server.create_dirs(parent(&to)).await?;
        server.replace(&from, &to).await
    })
    .await
}

/// Create a folder and the folders it's in
#[tauri::command]
pub async fn sftp_mkdir(servers: State<'_, SftpServers>, connection: StorageConnection, path: String) -> Result<()> {
    let remote = connection.remote(&path)?;
    with_server(&servers, &connection, async |server| server.create_dirs(&remote).await).await
}
