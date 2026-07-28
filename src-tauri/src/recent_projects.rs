use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::CommandError;
use crate::project_files::{write_text_atomic, AuthorizedProjectPaths};

const RECENT_PROJECT_LIMIT: usize = 10;

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecentProjectsFile {
    recent_paths: Vec<String>,
}

fn normalize_recent_paths(
    recent_paths: Vec<String>,
    authorized_paths: &AuthorizedProjectPaths,
) -> Result<Vec<String>, CommandError> {
    let mut unique = HashSet::new();
    let mut normalized = Vec::new();
    for raw_path in recent_paths {
        let path = authorized_paths.require(&raw_path)?;
        let preserved = path.to_string_lossy().into_owned();
        if unique.insert(preserved.clone()) {
            normalized.push(preserved);
        }
        if normalized.len() == RECENT_PROJECT_LIMIT {
            break;
        }
    }
    Ok(normalized)
}

pub fn load_recent_paths(
    settings_path: &Path,
    authorized_paths: &AuthorizedProjectPaths,
) -> Result<Vec<String>, CommandError> {
    if !settings_path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(settings_path).map_err(|error| {
        CommandError::io(
            "RECENT_PROJECTS_READ_FAILED",
            "No se pudo leer la configuración de recientes",
            error,
        )
    })?;
    let settings: RecentProjectsFile = serde_json::from_str(&raw).map_err(|error| {
        CommandError::new(
            "RECENT_PROJECTS_INVALID",
            format!("La configuración de recientes no es JSON válido: {error}"),
        )
    })?;

    let mut unique = HashSet::new();
    let mut recent_paths = Vec::new();
    for raw_path in settings.recent_paths {
        let path = authorized_paths.authorize(&raw_path)?;
        let preserved = path.to_string_lossy().into_owned();
        if unique.insert(preserved.clone()) {
            recent_paths.push(preserved);
        }
        if recent_paths.len() == RECENT_PROJECT_LIMIT {
            break;
        }
    }
    Ok(recent_paths)
}

pub fn save_recent_paths(
    settings_path: &Path,
    recent_paths: Vec<String>,
    authorized_paths: &AuthorizedProjectPaths,
) -> Result<Vec<String>, CommandError> {
    let normalized = normalize_recent_paths(recent_paths, authorized_paths)?;
    let directory = settings_path.parent().ok_or_else(|| {
        CommandError::new(
            "RECENT_PROJECTS_WRITE_FAILED",
            "La configuración de recientes no tiene directorio padre.",
        )
    })?;
    fs::create_dir_all(directory).map_err(|error| {
        CommandError::io(
            "RECENT_PROJECTS_WRITE_FAILED",
            "No se pudo crear el directorio de configuración",
            error,
        )
    })?;
    let content = format!(
        "{}\n",
        serde_json::to_string_pretty(&RecentProjectsFile {
            recent_paths: normalized.clone(),
        })
        .map_err(|error| CommandError::new(
            "RECENT_PROJECTS_WRITE_FAILED",
            format!("No se pudo serializar la configuración de recientes: {error}"),
        ))?
    );
    write_text_atomic(settings_path, &content, 0).map_err(|error| {
        CommandError::io(
            "RECENT_PROJECTS_WRITE_FAILED",
            "No se pudo guardar la configuración de recientes",
            error,
        )
    })?;
    Ok(normalized)
}

pub fn settings_path(config_directory: PathBuf) -> PathBuf {
    config_directory.join("recent-projects.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_directory(test_name: &str) -> PathBuf {
        let directory = std::env::temp_dir().join(format!(
            "modelador-recent-{test_name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&directory).unwrap();
        directory
    }

    #[test]
    fn recent_paths_roundtrip_unique_authorized_and_limited() {
        let directory = temporary_directory("roundtrip");
        let settings = settings_path(directory.clone());
        let authorized = AuthorizedProjectPaths::default();
        let paths = (0..12)
            .map(|index| directory.join(format!("{index}.modelador.json")))
            .map(|path| path.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        for path in &paths {
            authorized.authorize(path).unwrap();
        }
        let mut requested = paths.clone();
        requested.insert(1, paths[0].clone());

        let saved = save_recent_paths(&settings, requested, &authorized).unwrap();
        assert_eq!(saved, paths[..10]);

        let reloaded_authorization = AuthorizedProjectPaths::default();
        assert_eq!(
            load_recent_paths(&settings, &reloaded_authorization).unwrap(),
            paths[..10]
        );
        assert!(reloaded_authorization.require(&paths[0]).is_ok());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn invalid_recent_json_is_never_discarded_silently() {
        let directory = temporary_directory("invalid");
        let settings = settings_path(directory.clone());
        fs::write(&settings, "{\"recentPaths\":").unwrap();

        let error = load_recent_paths(&settings, &AuthorizedProjectPaths::default()).unwrap_err();
        assert_eq!(error.code, "RECENT_PROJECTS_INVALID");
        fs::remove_dir_all(directory).unwrap();
    }
}
