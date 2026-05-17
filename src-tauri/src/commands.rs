use contextkit_core::app::App;
use contextkit_core::models::{
    AgentInfo, Assignment, ConfigDetail, ConfigKind, ConfigSummary, PathScope, Settings, Source,
    Stats, SyncMode,
};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub app: Mutex<App>,
}

// === Source 管理 ===

#[tauri::command]
pub async fn add_source(
    state: State<'_, AppState>,
    url_or_path: String,
    name: Option<String>,
) -> Result<Source, String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.add_source(url_or_path, name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_source(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.remove_source(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_source_name(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.update_source_name(&id, name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_source_ignore_dirs(
    state: State<'_, AppState>,
    id: String,
    ignore_dirs: Vec<String>,
) -> Result<(), String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.update_source_ignore_dirs(&id, ignore_dirs)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_source_updates(state: State<AppState>, id: String) -> Result<bool, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    app.check_source_updates(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pull_source_updates(
    state: State<AppState>,
    id: String,
) -> Result<Vec<ConfigSummary>, String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.pull_source_updates(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sources(state: State<AppState>) -> Result<Vec<Source>, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    Ok(app.list_sources())
}

#[tauri::command]
pub async fn sync_source(
    state: State<'_, AppState>,
    id: String,
    force: Option<bool>,
) -> Result<Vec<ConfigSummary>, String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.sync_source(&id, force.unwrap_or(false))
        .map_err(|e| e.to_string())
}

// === Config 查询 ===

#[tauri::command]
pub fn list_configs(
    state: State<AppState>,
    kind: Option<ConfigKind>,
    source_id: Option<String>,
) -> Result<Vec<ConfigSummary>, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    Ok(app.list_configs(kind, source_id.as_deref()))
}

#[tauri::command]
pub fn get_config(state: State<AppState>, id: String) -> Result<ConfigDetail, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    app.get_config(&id).map_err(|e| e.to_string())
}

// === Assignment 管理 ===

#[tauri::command]
pub async fn assign_config(
    state: State<'_, AppState>,
    config_id: String,
    agent_id: String,
    scope: PathScope,
    project_path: Option<String>,
) -> Result<(), String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    let project = project_path.as_deref().map(std::path::Path::new);
    app.assign_config(&config_id, &agent_id, scope, project)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unassign_config(
    state: State<'_, AppState>,
    config_id: String,
    agent_id: String,
) -> Result<(), String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.unassign_config(&config_id, &agent_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_assignments(
    state: State<AppState>,
    config_id: Option<String>,
    agent_id: Option<String>,
) -> Result<Vec<Assignment>, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    Ok(app.list_assignments(config_id.as_deref(), agent_id.as_deref()))
}

// === 全局 ===

#[tauri::command]
pub fn get_stats(state: State<AppState>) -> Result<Stats, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    Ok(app.get_stats())
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    Ok(app.get_settings())
}

#[tauri::command]
pub fn update_settings(state: State<'_, AppState>, mode: SyncMode) -> Result<(), String> {
    let mut app = state.app.lock().map_err(|e| e.to_string())?;
    app.update_settings(mode).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_agents(state: State<AppState>) -> Result<Vec<AgentInfo>, String> {
    let app = state.app.lock().map_err(|e| e.to_string())?;
    Ok(app.list_agents())
}
