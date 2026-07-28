use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::CommandError;
use crate::project_files::{sync_directory, write_text_atomic};

const SESSION_MARKER: &str = "session-active";
const RECOVERY_SNAPSHOT: &str = "autosave-v2.json";
const MAX_RECOVERY_BYTES: u64 = 64 * 1024 * 1024;

pub struct RecoveryState {
    directory: PathBuf,
    previous_session_unclean: bool,
}

#[cfg(unix)]
fn create_private_marker(path: &Path) -> io::Result<File> {
    use std::os::unix::fs::OpenOptionsExt;
    OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
}

#[cfg(not(unix))]
fn create_private_marker(path: &Path) -> io::Result<File> {
    OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)
}

#[cfg(unix)]
fn make_directory_private(directory: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
}

#[cfg(not(unix))]
fn make_directory_private(_directory: &Path) -> io::Result<()> {
    Ok(())
}

fn validate_snapshot(raw: &str) -> Result<(), CommandError> {
    let value: Value = serde_json::from_str(raw).map_err(|error| {
        CommandError::new(
            "RECOVERY_SNAPSHOT_INVALID",
            format!("El snapshot de recuperación contiene JSON inválido: {error}"),
        )
    })?;
    let version = value.get("version").and_then(Value::as_u64);
    if !matches!(version, Some(1 | 2)) {
        return Err(CommandError::new(
            "RECOVERY_VERSION_UNSUPPORTED",
            "La versión del snapshot de recuperación no es compatible.",
        ));
    }
    if !value.get("model").is_some_and(Value::is_object) {
        return Err(CommandError::new(
            "RECOVERY_SNAPSHOT_INVALID",
            "El snapshot de recuperación no contiene un modelo.",
        ));
    }
    Ok(())
}

pub(crate) fn snapshot_project_path(raw: &str) -> Result<Option<String>, CommandError> {
    validate_snapshot(raw)?;
    let value: Value = serde_json::from_str(raw).map_err(|error| {
        CommandError::new(
            "RECOVERY_SNAPSHOT_INVALID",
            format!("El snapshot de recuperación contiene JSON inválido: {error}"),
        )
    })?;
    match value.get("projectPath") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(path)) if !path.is_empty() => Ok(Some(path.clone())),
        Some(_) => Err(CommandError::new(
            "RECOVERY_SNAPSHOT_INVALID",
            "La ruta asociada al snapshot de recuperación no es válida.",
        )),
    }
}

impl RecoveryState {
    pub fn start(directory: PathBuf) -> io::Result<Self> {
        fs::create_dir_all(&directory)?;
        make_directory_private(&directory)?;
        let marker = directory.join(SESSION_MARKER);
        let previous_session_unclean = marker.exists();
        let mut file = create_private_marker(&marker)?;
        file.write_all(b"active\n")?;
        file.sync_all()?;
        drop(file);
        sync_directory(&directory)?;
        Ok(Self {
            directory,
            previous_session_unclean,
        })
    }

    fn snapshot_path(&self) -> PathBuf {
        self.directory.join(RECOVERY_SNAPSHOT)
    }

    pub fn load_snapshot(&self) -> Result<Option<String>, CommandError> {
        if !self.previous_session_unclean {
            return Ok(None);
        }
        let path = self.snapshot_path();
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => {
                return Err(CommandError::io(
                    "RECOVERY_READ_FAILED",
                    "No se pudo inspeccionar el snapshot de recuperación",
                    error,
                ))
            }
        };
        if metadata.len() > MAX_RECOVERY_BYTES {
            return Err(CommandError::new(
                "RECOVERY_SNAPSHOT_TOO_LARGE",
                "El snapshot de recuperación supera el límite de 64 MiB.",
            ));
        }
        let raw = fs::read_to_string(&path).map_err(|error| {
            CommandError::io(
                "RECOVERY_READ_FAILED",
                "No se pudo leer el snapshot de recuperación",
                error,
            )
        })?;
        validate_snapshot(&raw)?;
        Ok(Some(raw))
    }

    pub fn save_snapshot(&self, content: &str) -> Result<(), CommandError> {
        if content.len() as u64 > MAX_RECOVERY_BYTES {
            return Err(CommandError::new(
                "RECOVERY_SNAPSHOT_TOO_LARGE",
                "El snapshot de recuperación supera el límite de 64 MiB.",
            ));
        }
        validate_snapshot(content)?;
        write_text_atomic(&self.snapshot_path(), content, 0).map_err(|error| {
            CommandError::io(
                "RECOVERY_WRITE_FAILED",
                "No se pudo guardar el snapshot de recuperación",
                error,
            )
        })
    }

    pub fn clear_snapshot(&self) -> Result<(), CommandError> {
        match fs::remove_file(self.snapshot_path()) {
            Ok(()) => sync_directory(&self.directory).map_err(|error| {
                CommandError::io(
                    "RECOVERY_CLEAR_FAILED",
                    "No se pudo sincronizar la limpieza del snapshot",
                    error,
                )
            }),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(CommandError::io(
                "RECOVERY_CLEAR_FAILED",
                "No se pudo limpiar el snapshot de recuperación",
                error,
            )),
        }
    }

    pub fn finish_clean(&self) -> io::Result<()> {
        let marker = self.directory.join(SESSION_MARKER);
        match fs::remove_file(marker) {
            Ok(()) => sync_directory(&self.directory),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_directory(test_name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "modelador-recovery-{test_name}-{}-{stamp}",
            std::process::id()
        ))
    }

    fn snapshot() -> &'static str {
        r#"{"version":2,"timestamp":42,"projectPath":"/p/casa.json","model":{"modelVersion":2}}"#
    }

    #[test]
    fn crash_exposes_exact_snapshot_but_clean_exit_does_not() {
        let directory = temporary_directory("crash");
        let project = directory.with_extension("project");
        fs::write(&project, b"original-project\n").unwrap();

        let first = RecoveryState::start(directory.clone()).unwrap();
        assert!(!first.previous_session_unclean);
        first.save_snapshot(snapshot()).unwrap();
        drop(first);

        let second = RecoveryState::start(directory.clone()).unwrap();
        assert!(second.previous_session_unclean);
        assert_eq!(second.load_snapshot().unwrap().as_deref(), Some(snapshot()));
        assert_eq!(fs::read(&project).unwrap(), b"original-project\n");
        second.finish_clean().unwrap();

        let third = RecoveryState::start(directory.clone()).unwrap();
        assert!(!third.previous_session_unclean);
        assert_eq!(third.load_snapshot().unwrap(), None);
        third.finish_clean().unwrap();

        fs::remove_dir_all(directory).unwrap();
        fs::remove_file(project).unwrap();
    }

    #[test]
    fn corrupt_snapshot_is_reported_and_preserved() {
        let directory = temporary_directory("corrupt");
        let first = RecoveryState::start(directory.clone()).unwrap();
        fs::write(first.snapshot_path(), b"{broken").unwrap();
        drop(first);

        let second = RecoveryState::start(directory.clone()).unwrap();
        let error = second.load_snapshot().unwrap_err();
        assert_eq!(error.code, "RECOVERY_SNAPSHOT_INVALID");
        assert_eq!(fs::read(second.snapshot_path()).unwrap(), b"{broken");
        second.finish_clean().unwrap();
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn snapshot_clear_is_idempotent() {
        let directory = temporary_directory("clear");
        let state = RecoveryState::start(directory.clone()).unwrap();
        state.save_snapshot(snapshot()).unwrap();
        state.clear_snapshot().unwrap();
        state.clear_snapshot().unwrap();
        assert!(!state.snapshot_path().exists());
        state.finish_clean().unwrap();
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn unsupported_snapshot_is_rejected_before_publication() {
        let directory = temporary_directory("version");
        let state = RecoveryState::start(directory.clone()).unwrap();
        let error = state
            .save_snapshot(r#"{"version":99,"model":{}}"#)
            .unwrap_err();
        assert_eq!(error.code, "RECOVERY_VERSION_UNSUPPORTED");
        assert!(!state.snapshot_path().exists());
        state.finish_clean().unwrap();
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn snapshot_path_is_recovered_only_from_a_valid_envelope() {
        assert_eq!(
            snapshot_project_path(snapshot()).unwrap().as_deref(),
            Some("/p/casa.json")
        );
        assert_eq!(
            snapshot_project_path(r#"{"version":1,"timestamp":1,"model":{}}"#).unwrap(),
            None
        );
        let error =
            snapshot_project_path(r#"{"version":2,"projectPath":42,"model":{"modelVersion":2}}"#)
                .unwrap_err();
        assert_eq!(error.code, "RECOVERY_SNAPSHOT_INVALID");
    }
}
