mod commands;
mod error;
mod project_files;
mod recent_projects;
mod recovery;

use project_files::AuthorizedProjectPaths;
use recovery::RecoveryState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AuthorizedProjectPaths::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let recovery_directory = app.path().app_data_dir()?.join("Recovery");
            app.manage(RecoveryState::start(recovery_directory)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::choose_open_project_path,
            commands::choose_save_project_path,
            commands::read_project_text,
            commands::write_project_text_atomic,
            commands::load_recent_project_paths,
            commands::save_recent_project_paths,
            commands::load_recovery_snapshot,
            commands::save_recovery_snapshot,
            commands::clear_recovery_snapshot,
        ])
        .build(tauri::generate_context!())
        .expect("error al construir Modelador");
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(recovery) = app_handle.try_state::<RecoveryState>() {
                if let Err(error) = recovery.finish_clean() {
                    eprintln!("No se pudo cerrar el marcador de recuperación: {error}");
                }
            }
        }
    });
}
