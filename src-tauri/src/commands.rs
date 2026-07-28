use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

use crate::error::CommandError;
use crate::project_files::{
    read_authorized_text, write_authorized_text_atomic, AuthorizedProjectPaths,
};
use crate::recent_projects;

fn selected_path(
    file_path: FilePath,
    authorized_paths: &AuthorizedProjectPaths,
) -> Result<String, CommandError> {
    let path = file_path.into_path().map_err(|error| {
        CommandError::new(
            "PROJECT_PATH_INVALID",
            format!("El selector no devolvió una ruta de archivo local: {error}"),
        )
    })?;
    let raw = path.to_str().ok_or_else(|| {
        CommandError::new(
            "PROJECT_PATH_INVALID",
            "La ruta elegida no se puede representar como UTF-8.",
        )
    })?;
    authorized_paths.authorize(raw)?;
    Ok(raw.to_owned())
}

#[tauri::command]
pub async fn choose_open_project_path(
    app: AppHandle,
    authorized_paths: State<'_, AuthorizedProjectPaths>,
) -> Result<Option<String>, CommandError> {
    app.dialog()
        .file()
        .set_title("Abrir proyecto")
        .add_filter("Proyecto Modelador", &["modelador.json", "json"])
        .blocking_pick_file()
        .map(|path| selected_path(path, &authorized_paths))
        .transpose()
}

#[tauri::command]
pub async fn choose_save_project_path(
    app: AppHandle,
    authorized_paths: State<'_, AuthorizedProjectPaths>,
    current_path: Option<String>,
) -> Result<Option<String>, CommandError> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Guardar proyecto")
        .add_filter("Proyecto Modelador", &["modelador.json", "json"]);
    if let Some(current_path) = current_path {
        if let Ok(path) = authorized_paths.require(&current_path) {
            if let Some(parent) = path.parent() {
                dialog = dialog.set_directory(parent);
            }
            if let Some(filename) = path.file_name() {
                dialog = dialog.set_file_name(filename.to_string_lossy());
            }
        }
    } else {
        dialog = dialog.set_file_name("proyecto.modelador.json");
    }
    dialog
        .blocking_save_file()
        .map(|path| selected_path(path, &authorized_paths))
        .transpose()
}

#[tauri::command]
pub fn read_project_text(
    authorized_paths: State<'_, AuthorizedProjectPaths>,
    project_path: String,
) -> Result<String, CommandError> {
    read_authorized_text(&authorized_paths, &project_path)
}

#[tauri::command]
pub fn write_project_text_atomic(
    authorized_paths: State<'_, AuthorizedProjectPaths>,
    project_path: String,
    content: String,
    backup_limit: usize,
) -> Result<(), CommandError> {
    write_authorized_text_atomic(&authorized_paths, &project_path, &content, backup_limit)
}

fn recent_settings_path(app: &AppHandle) -> Result<std::path::PathBuf, CommandError> {
    let config_directory = app.path().app_config_dir().map_err(|error| {
        CommandError::new(
            "RECENT_PROJECTS_PATH_FAILED",
            format!("No se pudo resolver el directorio de configuración: {error}"),
        )
    })?;
    Ok(recent_projects::settings_path(config_directory))
}

#[tauri::command]
pub fn load_recent_project_paths(
    app: AppHandle,
    authorized_paths: State<'_, AuthorizedProjectPaths>,
) -> Result<Vec<String>, CommandError> {
    recent_projects::load_recent_paths(&recent_settings_path(&app)?, &authorized_paths)
}

#[tauri::command]
pub fn save_recent_project_paths(
    app: AppHandle,
    authorized_paths: State<'_, AuthorizedProjectPaths>,
    recent_paths: Vec<String>,
) -> Result<Vec<String>, CommandError> {
    recent_projects::save_recent_paths(
        &recent_settings_path(&app)?,
        recent_paths,
        &authorized_paths,
    )
}
