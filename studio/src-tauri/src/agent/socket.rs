//! Per-user local sockets that windows listen on: Unix sockets in a directory only the user can open, or named pipes
//! only the user can open on Windows. Nothing listens on the network.

use std::io;
use std::path::PathBuf;

/// A random ID for this window, which also names its socket
pub fn window_id() -> String {
    let mut bytes = [0; 4];
    getrandom::fill(&mut bytes).expect("failed to generate a window ID");
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(unix)]
pub use unix::*;
#[cfg(windows)]
pub use windows::*;

#[cfg(unix)]
mod unix {
    use super::*;
    use std::os::unix::fs::DirBuilderExt;
    use tokio::net::{UnixListener, UnixStream};

    /// The directory for sockets, inside a per-user directory others can't open
    fn directory() -> io::Result<PathBuf> {
        // Not `$TMPDIR`, which MCP clients may not pass on
        #[cfg(target_os = "macos")]
        let user_directory = {
            use std::os::unix::ffi::OsStringExt;
            let mut buffer = vec![0u8; libc::PATH_MAX as usize];
            // SAFETY: `confstr` writes at most `buffer.len()` bytes, including the trailing NUL
            let length =
                unsafe { libc::confstr(libc::_CS_DARWIN_USER_TEMP_DIR, buffer.as_mut_ptr().cast(), buffer.len()) };
            if length == 0 || length > buffer.len() {
                return Err(io::Error::last_os_error());
            }
            buffer.truncate(length - 1);
            PathBuf::from(std::ffi::OsString::from_vec(buffer))
        };
        #[cfg(not(target_os = "macos"))]
        let user_directory = PathBuf::from(
            std::env::var_os("XDG_RUNTIME_DIR")
                .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "XDG_RUNTIME_DIR isn't set"))?,
        );
        // Socket paths are limited to about 100 bytes, so this is kept short
        Ok(user_directory.join("doglog-studio-agent"))
    }

    pub fn address(id: &str) -> io::Result<PathBuf> {
        Ok(directory()?.join(format!("{id}.sock")))
    }

    /// Every window's socket, including ones left behind by windows that crashed
    pub fn list() -> io::Result<Vec<PathBuf>> {
        match std::fs::read_dir(directory()?) {
            Ok(entries) => Ok(entries
                .filter_map(|entry| Some(entry.ok()?.path()))
                .filter(|path| path.extension().is_some_and(|extension| extension == "sock"))
                .collect()),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(error) => Err(error),
        }
    }

    pub type Connection = UnixStream;

    pub struct Listener(UnixListener);

    impl Listener {
        pub fn bind(id: &str) -> io::Result<Self> {
            match std::fs::DirBuilder::new().mode(0o700).create(directory()?) {
                Err(error) if error.kind() != io::ErrorKind::AlreadyExists => return Err(error),
                _ => {}
            }
            UnixListener::bind(address(id)?).map(Self)
        }

        pub async fn accept(&mut self) -> io::Result<Connection> {
            Ok(self.0.accept().await?.0)
        }
    }

    /// Remove this window's socket as it closes
    pub fn remove(id: &str) {
        if let Ok(address) = address(id) {
            let _ = std::fs::remove_file(address);
        }
    }

    pub async fn connect(address: &std::path::Path) -> io::Result<Connection> {
        let result = UnixStream::connect(address).await;
        if let Err(error) = &result
            && error.kind() == io::ErrorKind::ConnectionRefused
        {
            // Left behind by a window that crashed
            let _ = std::fs::remove_file(address);
        }
        result
    }
}

#[cfg(windows)]
mod windows {
    use super::*;
    use std::time::Duration;
    use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient, NamedPipeServer, ServerOptions};
    use windows_sys::Win32::Foundation::{ERROR_PIPE_BUSY, LocalFree};
    use windows_sys::Win32::Security::Authorization::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;

    const PIPES: &str = r"\\.\pipe\";
    const PREFIX: &str = "doglog-studio-agent-";

    pub fn address(id: &str) -> io::Result<PathBuf> {
        Ok(PathBuf::from(format!("{PIPES}{PREFIX}{id}")))
    }

    /// Every window's pipe, including other users' that can't be opened
    pub fn list() -> io::Result<Vec<PathBuf>> {
        Ok(std::fs::read_dir(PIPES)?
            .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
            .filter(|name| name.starts_with(PREFIX))
            .map(|name| PathBuf::from(format!("{PIPES}{name}")))
            .collect())
    }

    pub type Connection = NamedPipeServer;

    pub struct Listener {
        name: PathBuf,
        next: NamedPipeServer,
    }

    /// Create an instance of the pipe that only its owner, the current user, can open
    fn create(name: &PathBuf, first: bool) -> io::Result<NamedPipeServer> {
        // Protected so nothing is inherited, with full access for the owner only
        let sddl: Vec<u16> = "D:P(A;;GA;;;OW)\0".encode_utf16().collect();
        let mut descriptor = std::ptr::null_mut();
        // SAFETY: `sddl` is NUL-terminated, and the descriptor is freed once the pipe is created with it
        unsafe {
            if ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor,
                std::ptr::null_mut(),
            ) == 0
            {
                return Err(io::Error::last_os_error());
            }
            let mut attributes = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: descriptor,
                bInheritHandle: 0,
            };
            let pipe = ServerOptions::new()
                .first_pipe_instance(first)
                .create_with_security_attributes_raw(name, (&raw mut attributes).cast());
            LocalFree(descriptor);
            pipe
        }
    }

    impl Listener {
        pub fn bind(id: &str) -> io::Result<Self> {
            let name = address(id)?;
            let next = create(&name, true)?;
            Ok(Self { name, next })
        }

        pub async fn accept(&mut self) -> io::Result<Connection> {
            self.next.connect().await?;
            // A new instance for the next client, before handing this one off
            let next = create(&self.name, false)?;
            Ok(std::mem::replace(&mut self.next, next))
        }
    }

    /// Pipes close with the window, nothing to remove
    pub fn remove(_id: &str) {}

    pub async fn connect(address: &std::path::Path) -> io::Result<NamedPipeClient> {
        loop {
            match ClientOptions::new().open(address) {
                // Every instance is taken until the window creates the next one
                Err(error) if error.raw_os_error() == Some(ERROR_PIPE_BUSY as i32) => {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
                result => return result,
            }
        }
    }
}
