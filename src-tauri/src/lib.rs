pub mod models;
pub mod commands;
pub mod git_navigator;
pub mod dependency_analyzer;
pub mod lakos_analyzer;
pub mod chronograph_engine;
pub mod chronograph_commands;
pub mod analysis_cache;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Arc and Mutex are already imported in chronograph_commands
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(chronograph_commands::ChronoGraphState::default())
        .manage(chronograph_commands::ProgressState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            // Legacy commands (for backward compatibility)
            commands::analyze_repository,
            commands::get_project_config,
            commands::get_dependency_view,
            commands::get_temporal_snapshots,
            commands::navigate_to_timestamp,
            commands::toggle_folder_expansion,
            commands::update_filters,
            // New ChronoGraph commands
            chronograph_commands::initialize_analysis,
            chronograph_commands::start_analysis,
            chronograph_commands::get_analysis_progress,
            chronograph_commands::get_analysis_snapshots,
            chronograph_commands::get_repository_info,
            chronograph_commands::get_analysis_statistics,
            chronograph_commands::list_analyzers,
            chronograph_commands::install_lakos,
            chronograph_commands::check_lakos_availability,
            chronograph_commands::get_commit_dependencies,
            chronograph_commands::get_commit_info,
            chronograph_commands::cleanup_analysis,
            chronograph_commands::get_analysis_config,
            chronograph_commands::export_analysis_results,
            // Repository management commands
            chronograph_commands::get_cached_repositories,
            chronograph_commands::cleanup_cached_repository,
            chronograph_commands::cleanup_all_cached_repositories,
            chronograph_commands::update_cached_repository,
            // Analysis cache management commands
            chronograph_commands::get_cache_statistics,
            chronograph_commands::clear_repository_cache,
            chronograph_commands::cleanup_old_cache,
            chronograph_commands::clear_all_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
