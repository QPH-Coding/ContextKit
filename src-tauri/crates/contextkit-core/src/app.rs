use crate::agent::registry::AgentRegistry;
use crate::agent::{AssignmentManager, AssignmentMechanism};
use crate::config::ConfigManager;
use crate::error::{ContextKitError, Result};
use crate::models::{
    AgentInfo, Assignment, ConfigDetail, ConfigKind, ConfigSummary, PathScope, Settings, Source,
    SourceType, Stats, SyncMode,
};
use crate::source::SourceManager;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// ContextKit 应用门面，封装所有业务逻辑
pub struct App {
    source_manager: SourceManager,
    agent_registry: AgentRegistry,
    assignment_manager: AssignmentManager,
    settings: Settings,
}

impl App {
    pub fn new() -> Result<Self> {
        let source_manager = SourceManager::new()?;
        let default_sync_mode = source_manager.config().load_settings()?.unwrap_or(SyncMode::Reference);
        let settings = Settings {
            config_dir: source_manager.config().config_dir().to_path_buf(),
            default_sync_mode,
        };
        Ok(Self {
            source_manager,
            agent_registry: AgentRegistry::new(),
            assignment_manager: AssignmentManager::new(),
            settings,
        })
    }

    pub fn with_config_dir<P: AsRef<Path>>(dir: P) -> Result<Self> {
        let config = ConfigManager::with_dir(dir);
        let source_manager = SourceManager::with_config(config)?;
        let default_sync_mode = source_manager.config().load_settings()?.unwrap_or(SyncMode::Reference);
        let settings = Settings {
            config_dir: source_manager.config().config_dir().to_path_buf(),
            default_sync_mode,
        };
        Ok(Self {
            source_manager,
            agent_registry: AgentRegistry::new(),
            assignment_manager: AssignmentManager::new(),
            settings,
        })
    }

    // === Source 管理 ===

    /// 自动判断 URL 或本地路径并添加 Source
    pub fn add_source(&mut self, url_or_path: String, name: Option<String>) -> Result<Source> {
        if looks_like_url(&url_or_path) {
            self.source_manager
                .add_git_source(url_or_path, name, SyncMode::Reference)
        } else {
            let path = PathBuf::from(&url_or_path);
            self.source_manager
                .add_local_source(path, name, SyncMode::Reference)
        }
    }

    pub fn remove_source(&mut self, id: &str) -> Result<()> {
        self.source_manager.remove_source(id)
    }

    pub fn update_source_name(&mut self, id: &str, name: String) -> Result<()> {
        self.source_manager.update_source_name(id, name)
    }

    pub fn update_source_ignore_dirs(&mut self, id: &str, ignore_dirs: Vec<String>) -> Result<()> {
        self.source_manager.update_source_ignore_dirs(id, ignore_dirs)
    }

    pub fn check_source_updates(&self, id: &str) -> Result<bool> {
        let source = self.source_manager.list_sources()
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| ContextKitError::SourceNotFound { id: id.into() })?;
        if !matches!(source.source_type, SourceType::Git { .. }) {
            return Err(ContextKitError::InvalidPath("Not a git source".into()));
        }
        crate::source::git::has_updates(&source.local_path)
    }

    pub fn pull_source_updates(&self, id: &str) -> Result<()> {
        let source = self.source_manager.list_sources()
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| ContextKitError::SourceNotFound { id: id.into() })?;
        if !matches!(source.source_type, SourceType::Git { .. }) {
            return Err(ContextKitError::InvalidPath("Not a git source".into()));
        }
        crate::source::git::pull_repo(&source.local_path)
    }

    pub fn list_sources(&self) -> Vec<Source> {
        self.source_manager.list_sources().to_vec()
    }

    pub fn sync_source(&mut self, id: &str, force: bool) -> Result<Vec<ConfigSummary>> {
        self.source_manager.sync_source(id, force)
    }

    // === Config 查询 ===

    pub fn list_configs(
        &self,
        kind: Option<ConfigKind>,
        source_id: Option<&str>,
    ) -> Vec<ConfigSummary> {
        let mut result = Vec::new();
        for source in self.source_manager.list_sources() {
            if let Some(ref sid) = source_id {
                if &source.id != sid {
                    continue;
                }
            }
            for config in &source.configs {
                if let Some(k) = kind {
                    if config.kind != k {
                        continue;
                    }
                }
                result.push(config.clone());
            }
        }
        result
    }

    pub fn get_config(&self, id: &str) -> Result<ConfigDetail> {
        for source in self.source_manager.list_sources() {
            for config in &source.configs {
                if config.id == id {
                    let mut abs_path = source.local_path.join(&config.relative_path);
                    // Skill 配置指向目录，需要定位到 SKILL.md
                    if config.kind == ConfigKind::Skill && !abs_path.is_file() {
                        abs_path = abs_path.join("SKILL.md");
                    }
                    if !abs_path.is_file() {
                        return Err(ContextKitError::InvalidPath(format!(
                            "Config file does not exist: {}",
                            abs_path.display()
                        )));
                    }
                    let raw_content = std::fs::read_to_string(&abs_path)?;
                    let content = if config.kind == ConfigKind::Mcp {
                        // Extract individual server config from mcpServers
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw_content) {
                            if let Some(servers) = json.get("mcpServers").and_then(|v| v.as_object()) {
                                if let Some(server) = servers.get(&config.name) {
                                    server.to_string()
                                } else {
                                    raw_content
                                }
                            } else {
                                raw_content
                            }
                        } else {
                            raw_content
                        }
                    } else {
                        raw_content
                    };
                    let assigned_agents: Vec<String> = self
                        .source_manager
                        .index()
                        .get_assignments_for_config(id)
                        .into_iter()
                        .map(|a| a.agent_id.clone())
                        .collect();
                    return Ok(ConfigDetail {
                        id: config.id.clone(),
                        name: config.name.clone(),
                        kind: config.kind,
                        source_id: config.source_id.clone(),
                        source_name: config.source_name.clone(),
                        relative_path: config.relative_path.clone(),
                        absolute_path: abs_path,
                        token_count: config.token_count,
                        content,
                        assigned_agents,
                    });
                }
            }
        }
        Err(ContextKitError::ConfigNotFound { id: id.into() })
    }

    // === Assignment 管理 ===

    pub fn assign_config(
        &mut self,
        config_id: &str,
        agent_id: &str,
        scope: PathScope,
        project_path: Option<&Path>,
    ) -> Result<()> {
        let config = self.get_config(config_id)?;
        let agent = self.agent_registry.get(agent_id).ok_or_else(|| {
            ContextKitError::AgentToolNotFound {
                id: agent_id.into(),
            }
        })?;

        if !agent.supported_kinds().contains(&config.kind) {
            return Err(ContextKitError::InvalidPath(format!(
                "Agent {agent_id} does not support config kind {:?}",
                config.kind
            )));
        }

        if !agent.supports_scope(scope) {
            return Err(ContextKitError::InvalidPath(format!(
                "Agent {agent_id} does not support scope {scope:?}"
            )));
        }

        let source_path = &config.absolute_path;
        let target = agent
            .target_path(config.kind, scope, project_path, source_path)
            .ok_or_else(|| {
                ContextKitError::InvalidPath(format!(
                    "Agent {agent_id} has no target path for kind {:?} scope {:?}",
                    config.kind, scope
                ))
            })?;

        let mechanism = agent.mechanism(config.kind);

        // JsonInject merges into an existing config file; file-level conflicts only apply to
        // symlink/copy assignments.
        if mechanism != AssignmentMechanism::JsonInject
            && self.assignment_manager.check_conflict(&target)?
        {
            return Err(ContextKitError::AssignmentConflict {
                message: format!("Target already exists: {}", target.display()),
            });
        }

        self.assignment_manager
            .assign(source_path, &target, mechanism)?;

        let assignment = Assignment {
            config_id: config_id.into(),
            agent_id: agent_id.into(),
            project_path: project_path.map(|p| p.to_path_buf()),
            assigned_at: chrono::Utc::now().to_rfc3339(),
        };

        self.source_manager.add_assignment(assignment)?;
        Ok(())
    }

    pub fn unassign_config(&mut self, config_id: &str, agent_id: &str) -> Result<()> {
        let config = self.get_config(config_id)?;
        let agent = self.agent_registry.get(agent_id).ok_or_else(|| {
            ContextKitError::AgentToolNotFound {
                id: agent_id.into(),
            }
        })?;

        // 查找已有的 assignment 以确定 scope 和 project_path
        let assignment = self
            .source_manager
            .index()
            .get_assignments_for_config(config_id)
            .into_iter()
            .find(|a| a.agent_id == agent_id)
            .ok_or_else(|| ContextKitError::AssignmentConflict {
                message: format!("Config {config_id} is not assigned to agent {agent_id}"),
            })?;

        let scope = if assignment.project_path.is_some() {
            PathScope::Project
        } else {
            PathScope::User
        };
        let project_path = assignment.project_path.as_deref();
        let source_path = &config.absolute_path;
        let target = agent
            .target_path(config.kind, scope, project_path, source_path)
            .ok_or_else(|| {
                ContextKitError::InvalidPath(format!(
                    "Agent {agent_id} has no target path for kind {:?} scope {:?}",
                    config.kind, scope
                ))
            })?;

        let mechanism = agent.mechanism(config.kind);
        let server_name = if mechanism == AssignmentMechanism::JsonInject {
            source_path.file_stem().and_then(|s| s.to_str()).map(|s| {
                if s.ends_with(".mcp") {
                    s.trim_end_matches(".mcp").to_string()
                } else {
                    s.to_string()
                }
            })
        } else {
            None
        };

        self.assignment_manager
            .unassign(&target, mechanism, server_name.as_deref())?;

        self.source_manager.remove_assignment(config_id, agent_id)?;
        Ok(())
    }

    pub fn list_assignments(
        &self,
        config_id: Option<&str>,
        agent_id: Option<&str>,
    ) -> Vec<Assignment> {
        let index = self.source_manager.index();
        match (config_id, agent_id) {
            (Some(cid), _) => index
                .get_assignments_for_config(cid)
                .into_iter()
                .cloned()
                .collect(),
            (None, Some(aid)) => index
                .get_assignments_for_agent(aid)
                .into_iter()
                .cloned()
                .collect(),
            (None, None) => index.assignments.clone(),
        }
    }

    // === 全局 ===

    pub fn get_stats(&self) -> Stats {
        let mut total_configs = 0;
        let mut total_tokens = 0;
        let mut configs_by_kind: HashMap<ConfigKind, usize> = HashMap::new();
        let mut tokens_by_kind: HashMap<ConfigKind, usize> = HashMap::new();

        for source in self.source_manager.list_sources() {
            for config in &source.configs {
                total_configs += 1;
                total_tokens += config.token_count;
                *configs_by_kind.entry(config.kind).or_insert(0) += 1;
                *tokens_by_kind.entry(config.kind).or_insert(0) += config.token_count;
            }
        }

        let mut configs_by_agent: HashMap<String, usize> = HashMap::new();
        let mut tokens_by_agent: HashMap<String, usize> = HashMap::new();

        for assignment in &self.source_manager.index().assignments {
            let agent_id = assignment.agent_id.clone();
            *configs_by_agent.entry(agent_id.clone()).or_insert(0) += 1;

            // 尝试找到对应 config 的 token_count
            let token_count = self
                .find_config_summary(&assignment.config_id)
                .map(|c| c.token_count)
                .unwrap_or(0);
            *tokens_by_agent.entry(agent_id).or_insert(0) += token_count;
        }

        Stats {
            source_count: self.source_manager.list_sources().len(),
            total_configs,
            configs_by_kind,
            configs_by_agent,
            total_tokens,
            tokens_by_agent,
            tokens_by_kind,
        }
    }

    pub fn get_settings(&self) -> Settings {
        self.settings.clone()
    }

    pub fn update_settings(&mut self, mode: SyncMode) -> Result<()> {
        self.settings.default_sync_mode = mode;
        self.source_manager.config().save_settings(mode)
    }

    // === 内部辅助 ===

    fn find_config_summary(&self, id: &str) -> Option<ConfigSummary> {
        for source in self.source_manager.list_sources() {
            for config in &source.configs {
                if config.id == id {
                    return Some(config.clone());
                }
            }
        }
        None
    }

    pub fn list_agents(&self) -> Vec<AgentInfo> {
        self.agent_registry
            .list()
            .iter()
            .map(|a| AgentInfo {
                id: a.id().to_string(),
                name: a.name().to_string(),
                supported_kinds: a.supported_kinds().to_vec(),
                supports_user_scope: a.supports_scope(PathScope::User),
                supports_project_scope: a.supports_scope(PathScope::Project),
            })
            .collect()
    }

    pub fn agent_registry(&self) -> &AgentRegistry {
        &self.agent_registry
    }
}

fn looks_like_url(input: &str) -> bool {
    input.starts_with("http://")
        || input.starts_with("https://")
        || input.starts_with("git@")
        || input.starts_with("ssh://")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn temp_app(name: &str) -> App {
        let dir = env::temp_dir().join(format!("ck-app-test-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        App::with_config_dir(&dir).unwrap()
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn looks_like_url_detects_various_formats() {
        assert!(looks_like_url("https://github.com/user/repo.git"));
        assert!(looks_like_url("http://example.com/repo"));
        assert!(looks_like_url("git@github.com:user/repo.git"));
        assert!(looks_like_url("ssh://git@server.com/repo"));
        assert!(!looks_like_url("/home/user/repo"));
        assert!(!looks_like_url("./local/repo"));
        assert!(!looks_like_url("C:\\Users\\repo"));
    }

    #[test]
    fn add_and_list_local_source() {
        let dir = env::temp_dir().join(format!("ck-app-local-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let mut app = temp_app("add-local");
        let source = app.add_source(dir.to_string_lossy().to_string(), Some("Test".into()));
        assert!(source.is_ok());
        assert_eq!(app.list_sources().len(), 1);

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn remove_source() {
        let dir = env::temp_dir().join(format!("ck-app-remove-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let mut app = temp_app("remove");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        assert_eq!(app.list_sources().len(), 1);

        app.remove_source(&source.id).unwrap();
        assert!(app.list_sources().is_empty());

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn sync_source_finds_configs() {
        let dir = env::temp_dir().join(format!("ck-app-sync-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("rules")).unwrap();
        fs::write(dir.join("rules").join("style.md"), "# Style").unwrap();

        let mut app = temp_app("sync");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        let configs = app.sync_source(&source.id, true).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Rule);

        // list_configs 应该能查到
        let all = app.list_configs(None, None);
        assert_eq!(all.len(), 1);

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn get_config_returns_detail() {
        let dir = env::temp_dir().join(format!("ck-app-getcfg-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("rules")).unwrap();
        fs::write(dir.join("rules").join("style.md"), "# Style Rules").unwrap();

        let mut app = temp_app("get-config");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();

        let config_id = app.list_configs(None, None)[0].id.clone();
        let detail = app.get_config(&config_id).unwrap();
        assert_eq!(detail.content, "# Style Rules");
        assert_eq!(detail.kind, ConfigKind::Rule);

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn get_config_not_found() {
        let app = temp_app("cfg-notfound");
        let err = app.get_config("nonexistent").unwrap_err();
        assert!(matches!(err, ContextKitError::ConfigNotFound { .. }));
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn assign_and_unassign_config() {
        let dir = env::temp_dir().join(format!("ck-app-assign-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("rules")).unwrap();
        fs::write(dir.join("rules").join("style.md"), "# Style").unwrap();

        let mut app = temp_app("assign");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();

        let config_id = app.list_configs(None, None)[0].id.clone();

        // 分配（使用用户自定义目录避免污染真实路径）
        // 由于 Claude Code 的目标路径是 ~/.claude/，我们在测试中使用一个 workaround
        // 直接测试 list_assignments 和 get_stats

        // 不直接测试文件系统分配（因为会写入 ~/.claude），而是测试冲突检测和错误处理
        let result = app.assign_config(&config_id, "nonexistent_agent", PathScope::User, None);
        assert!(result.is_err());

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn assign_rejects_unsupported_config_kind() {
        let dir = env::temp_dir().join(format!("ck-app-assign-kind-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("rules")).unwrap();
        fs::write(dir.join("rules").join("style.md"), "# Style").unwrap();

        let mut app = temp_app("assign-kind");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();

        let config_id = app.list_configs(None, None)[0].id.clone();
        let result = app.assign_config(&config_id, "kimi", PathScope::User, None);

        assert!(matches!(result, Err(ContextKitError::InvalidPath(_))));

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn assign_cursor_project_mcp_merges_existing_target() {
        let dir = env::temp_dir().join(format!("ck-app-mcp-src-{}", std::process::id()));
        let project = env::temp_dir().join(format!("ck-app-mcp-project-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_dir_all(&project);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(project.join(".cursor")).unwrap();
        fs::write(dir.join("mcp.json"), r#"{"mcpServers": {"mcp": {"command": "new"}}}"#).unwrap();
        fs::write(
            project.join(".cursor").join("mcp.json"),
            r#"{"mcpServers": {"existing": {"command": "old"}}}"#,
        )
        .unwrap();

        let mut app = temp_app("assign-mcp-merge");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();

        let config_id = app.list_configs(Some(ConfigKind::Mcp), None)[0].id.clone();
        app.assign_config(&config_id, "cursor", PathScope::Project, Some(&project))
            .unwrap();

        let content = fs::read_to_string(project.join(".cursor").join("mcp.json")).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("existing"));
        assert!(servers.contains_key("mcp"));

        cleanup(&dir);
        cleanup(&project);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn get_config_errors_when_indexed_file_is_missing() {
        let dir = env::temp_dir().join(format!("ck-app-missing-file-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("rules")).unwrap();
        let rule = dir.join("rules").join("style.md");
        fs::write(&rule, "# Style").unwrap();

        let mut app = temp_app("missing-file");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();
        let config_id = app.list_configs(None, None)[0].id.clone();

        fs::remove_file(rule).unwrap();
        let result = app.get_config(&config_id);

        assert!(matches!(result, Err(ContextKitError::InvalidPath(_))));

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn list_assignments_empty() {
        let app = temp_app("assign-empty");
        let assignments = app.list_assignments(None, None);
        assert!(assignments.is_empty());
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn get_stats_empty() {
        let app = temp_app("stats-empty");
        let stats = app.get_stats();
        assert_eq!(stats.source_count, 0);
        assert_eq!(stats.total_configs, 0);
        assert_eq!(stats.total_tokens, 0);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn get_stats_with_data() {
        let dir = env::temp_dir().join(format!("ck-app-stats-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("rules")).unwrap();
        fs::write(dir.join("rules").join("a.md"), "# A").unwrap();
        fs::write(dir.join("rules").join("b.md"), "# B").unwrap();

        let mut app = temp_app("stats");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();

        let stats = app.get_stats();
        assert_eq!(stats.source_count, 1);
        assert_eq!(stats.total_configs, 2);
        assert_eq!(stats.configs_by_kind.get(&ConfigKind::Rule), Some(&2));
        assert!(stats.total_tokens > 0);

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn get_settings_returns_config_dir() {
        let app = temp_app("settings");
        let settings = app.get_settings();
        // with_config_dir 使用自定义路径，不一定以 contextkit 结尾
        assert!(!settings.config_dir.as_os_str().is_empty());
        assert_eq!(settings.default_sync_mode, SyncMode::Reference);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn update_settings_persists_sync_mode() {
        let mut app = temp_app("update-settings");
        app.update_settings(SyncMode::Copy).unwrap();
        assert_eq!(app.get_settings().default_sync_mode, SyncMode::Copy);

        // 重新初始化应用，验证持久化
        let config_dir = app.source_manager.config().config_dir().to_path_buf();
        let app2 = App::with_config_dir(&config_dir).unwrap();
        assert_eq!(app2.get_settings().default_sync_mode, SyncMode::Copy);

        cleanup(&config_dir);
    }

    #[test]
    fn list_agents_returns_builtin_agents() {
        let app = temp_app("list-agents");
        let agents = app.list_agents();
        let ids: Vec<_> = agents.iter().map(|a| a.id.clone()).collect();
        assert!(ids.contains(&"claude_code".to_string()));
        assert!(ids.contains(&"cursor".to_string()));
        assert!(ids.contains(&"kimi".to_string()));
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn list_configs_filter_by_kind() {
        let dir = env::temp_dir().join(format!("ck-app-filter-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("rules")).unwrap();
        fs::write(dir.join("rules").join("style.md"), "# Style").unwrap();
        let skill_dir = dir.join("skills").join("coding");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Coding").unwrap();

        let mut app = temp_app("filter");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();

        let all = app.list_configs(None, None);
        assert_eq!(all.len(), 2);

        let rules = app.list_configs(Some(ConfigKind::Rule), None);
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].kind, ConfigKind::Rule);

        let skills = app.list_configs(Some(ConfigKind::Skill), None);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].kind, ConfigKind::Skill);

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }

    #[test]
    fn list_configs_filter_by_source_id() {
        let dir = env::temp_dir().join(format!("ck-app-filter-src2-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("mcp.json"), r#"{"mcpServers": {"test-server": {}}}"#).unwrap();

        let mut app = temp_app("filter-source");
        let source = app
            .add_source(dir.to_string_lossy().to_string(), None)
            .unwrap();
        app.sync_source(&source.id, true).unwrap();

        let by_source = app.list_configs(None, Some(&source.id));
        assert_eq!(by_source.len(), 1);

        let wrong_source = app.list_configs(None, Some("wrong"));
        assert!(wrong_source.is_empty());

        cleanup(&dir);
        cleanup(app.source_manager.config().config_dir());
    }
}
