use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::CommandError;

const MAX_BACKUP_LIMIT: usize = 10;
static UNIQUE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
pub struct AuthorizedProjectPaths {
    paths: Mutex<HashSet<PathBuf>>,
}

fn checked_absolute_path(raw: &str) -> Result<PathBuf, CommandError> {
    if raw.is_empty() {
        return Err(CommandError::new(
            "PROJECT_PATH_REQUIRED",
            "La ruta del proyecto no puede estar vacía.",
        ));
    }
    let path = PathBuf::from(raw);
    if !path.is_absolute() || path.components().any(|part| part == Component::ParentDir) {
        return Err(CommandError::new(
            "PROJECT_PATH_INVALID",
            "La ruta del proyecto debe ser absoluta y normalizada.",
        ));
    }
    Ok(path)
}

impl AuthorizedProjectPaths {
    pub fn authorize(&self, raw: &str) -> Result<PathBuf, CommandError> {
        let path = checked_absolute_path(raw)?;
        self.paths
            .lock()
            .map_err(|_| {
                CommandError::new(
                    "PROJECT_AUTHORIZATION_FAILED",
                    "No se pudo actualizar la autorización de rutas.",
                )
            })?
            .insert(path.clone());
        Ok(path)
    }

    pub fn require(&self, raw: &str) -> Result<PathBuf, CommandError> {
        let path = checked_absolute_path(raw)?;
        let authorized = self
            .paths
            .lock()
            .map_err(|_| {
                CommandError::new(
                    "PROJECT_AUTHORIZATION_FAILED",
                    "No se pudo comprobar la autorización de rutas.",
                )
            })?
            .contains(&path);
        if !authorized {
            return Err(CommandError::new(
                "PROJECT_PATH_NOT_AUTHORIZED",
                "La ruta no fue elegida por el usuario ni pertenece a proyectos recientes.",
            ));
        }
        Ok(path)
    }
}

fn unique_identifier() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = UNIQUE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{nanos:020}-{:010}-{counter:020}", std::process::id())
}

fn sync_directory(directory: &Path) -> io::Result<()> {
    File::open(directory)?.sync_all()
}

fn backup_directory(target: &Path) -> io::Result<PathBuf> {
    let filename = target
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "ruta sin nombre de archivo"))?;
    Ok(target
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "ruta sin directorio padre"))?
        .join(format!(".{}.backups", filename.to_string_lossy())))
}

fn prune_backups(directory: &Path, backup_limit: usize) -> io::Result<()> {
    let mut backups = fs::read_dir(directory)?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .filter(|entry| entry.file_name().to_string_lossy().ends_with(".bak"))
        .collect::<Vec<_>>();
    backups.sort_by_key(|entry| entry.file_name());
    let expired = backups.len().saturating_sub(backup_limit);
    for entry in backups.into_iter().take(expired) {
        fs::remove_file(entry.path())?;
    }
    if expired > 0 {
        sync_directory(directory)?;
    }
    Ok(())
}

fn backup_current_target(target: &Path, backup_limit: usize) -> io::Result<()> {
    if backup_limit == 0 {
        return Ok(());
    }
    let directory = backup_directory(target)?;
    fs::create_dir_all(&directory)?;
    let identifier = unique_identifier();
    let temporary = directory.join(format!(".backup-{identifier}.tmp"));
    let published = directory.join(format!("backup-{identifier}.bak"));
    let result = (|| {
        fs::copy(target, &temporary)?;
        File::open(&temporary)?.sync_all()?;
        fs::rename(&temporary, &published)?;
        sync_directory(&directory)?;
        prune_backups(&directory, backup_limit)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(unix)]
fn create_temporary(path: &Path) -> io::Result<File> {
    use std::os::unix::fs::OpenOptionsExt;
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
}

#[cfg(not(unix))]
fn create_temporary(path: &Path) -> io::Result<File> {
    OpenOptions::new().write(true).create_new(true).open(path)
}

pub fn read_authorized_text(
    authorized_paths: &AuthorizedProjectPaths,
    raw_path: &str,
) -> Result<String, CommandError> {
    let path = authorized_paths.require(raw_path)?;
    fs::read_to_string(path).map_err(|error| {
        CommandError::io("PROJECT_READ_FAILED", "No se pudo leer el proyecto", error)
    })
}

pub fn write_authorized_text_atomic(
    authorized_paths: &AuthorizedProjectPaths,
    raw_path: &str,
    content: &str,
    backup_limit: usize,
) -> Result<(), CommandError> {
    let path = authorized_paths.require(raw_path)?;
    write_text_atomic(&path, content, backup_limit).map_err(|error| {
        CommandError::io(
            "PROJECT_WRITE_FAILED",
            "No se pudo guardar el proyecto",
            error,
        )
    })
}

pub fn write_text_atomic(target: &Path, content: &str, backup_limit: usize) -> io::Result<()> {
    if backup_limit > MAX_BACKUP_LIMIT {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "el límite de backups no puede superar diez",
        ));
    }
    let directory = target
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "ruta sin directorio padre"))?;
    let filename = target
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "ruta sin nombre de archivo"))?
        .to_string_lossy();
    let temporary = directory.join(format!(".{filename}.{}.tmp", unique_identifier()));

    let result = (|| {
        let mut file = create_temporary(&temporary)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
        drop(file);

        if target.exists() {
            backup_current_target(target, backup_limit)?;
        }
        fs::rename(&temporary, target)?;
        sync_directory(directory)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_directory(test_name: &str) -> PathBuf {
        let directory =
            std::env::temp_dir().join(format!("modelador-{test_name}-{}", unique_identifier()));
        fs::create_dir(&directory).expect("debe crear directorio temporal");
        directory
    }

    #[test]
    fn unauthorized_paths_are_rejected_before_filesystem_access() {
        let directory = temporary_directory("authorization");
        let target = directory.join("prohibido.modelador.json");
        let authorized = AuthorizedProjectPaths::default();
        let result =
            write_authorized_text_atomic(&authorized, target.to_str().unwrap(), "no escribir", 10);

        assert_eq!(result.unwrap_err().code, "PROJECT_PATH_NOT_AUTHORIZED");
        assert!(!target.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn atomic_write_preserves_exact_bytes_and_rotates_ten_backups() {
        let directory = temporary_directory("backups");
        let target = directory.join("casa.modelador.json");
        let authorized = AuthorizedProjectPaths::default();
        authorized.authorize(target.to_str().unwrap()).unwrap();

        for sequence in 0..=12 {
            write_authorized_text_atomic(
                &authorized,
                target.to_str().unwrap(),
                &format!("version-{sequence}\n"),
                10,
            )
            .unwrap();
        }

        assert_eq!(fs::read_to_string(&target).unwrap(), "version-12\n");
        let backups = backup_directory(&target).unwrap();
        let mut entries = fs::read_dir(backups)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.path().extension().is_some_and(|value| value == "bak"))
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name());
        assert_eq!(entries.len(), 10);
        let contents = entries
            .into_iter()
            .map(|entry| fs::read_to_string(entry.path()).unwrap())
            .collect::<Vec<_>>();
        assert_eq!(
            contents,
            (2..=11)
                .map(|sequence| format!("version-{sequence}\n"))
                .collect::<Vec<_>>()
        );
        fs::remove_dir_all(directory).unwrap();
    }
}
