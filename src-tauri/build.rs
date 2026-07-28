fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "choose_open_project_path",
            "choose_save_project_path",
            "read_project_text",
            "write_project_text_atomic",
            "load_recent_project_paths",
            "save_recent_project_paths",
        ]),
    ))
    .expect("no se pudo generar el manifiesto Tauri");
}
