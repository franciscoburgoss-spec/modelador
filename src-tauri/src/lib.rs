mod commands;
mod error;
mod project_files;
mod recent_projects;

use project_files::AuthorizedProjectPaths;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AuthorizedProjectPaths::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::choose_open_project_path,
            commands::choose_save_project_path,
            commands::read_project_text,
            commands::write_project_text_atomic,
            commands::load_recent_project_paths,
            commands::save_recent_project_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar Modelador");
}
