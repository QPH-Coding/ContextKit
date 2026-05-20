use contextkit_core::app::App;

mod commands;
use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = App::new().expect("failed to initialize ContextKit app");
    let state = AppState {
        app: std::sync::Mutex::new(app),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::add_source,
            commands::remove_source,
            commands::update_source_name,
            commands::update_source_ignore_dirs,
            commands::check_source_updates,
            commands::check_all_source_updates,
            commands::pull_source_updates,
            commands::pull_all_source_updates,
            commands::get_source_directory_tree,
            commands::list_sources,
            commands::sync_source,
            commands::list_configs,
            commands::get_config,
            commands::assign_config,
            commands::unassign_config,
            commands::list_assignments,
            commands::get_stats,
            commands::get_settings,
            commands::update_settings,
            commands::list_agents,
            commands::list_agent_settings,
            commands::update_agent_setting,
            commands::list_mcps,
            commands::add_mcp,
            commands::update_mcp,
            commands::remove_mcp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
