use crate::agent::{AgentTool, AssignmentMechanism};
use crate::models::{ConfigKind, PathScope};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Agent 工具注册表
pub struct AgentRegistry {
    agents: HashMap<String, Box<dyn AgentTool>>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            agents: HashMap::new(),
        };
        registry.register_builtin_agents();
        registry
    }

    pub fn register(&mut self, agent: Box<dyn AgentTool>) {
        self.agents.insert(agent.id().to_string(), agent);
    }

    pub fn get(&self, id: &str) -> Option<&dyn AgentTool> {
        self.agents.get(id).map(|a| a.as_ref())
    }

    pub fn list(&self) -> Vec<&dyn AgentTool> {
        self.agents.values().map(|a| a.as_ref()).collect()
    }

    pub fn ids(&self) -> Vec<String> {
        self.agents.keys().cloned().collect()
    }

    fn register_builtin_agents(&mut self) {
        self.register(Box::new(ClaudeCode));
        self.register(Box::new(Codex));
        self.register(Box::new(Cursor));
        self.register(Box::new(Kimi));
        self.register(Box::new(CodeBuddy));
        self.register(Box::new(ClaudeDesktop));
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// === 内置 Agent 工具实现 ===

struct ClaudeCode;

impl AgentTool for ClaudeCode {
    fn id(&self) -> &str {
        "claude_code"
    }

    fn name(&self) -> &str {
        "Claude Code"
    }

    fn supported_kinds(&self) -> &[ConfigKind] {
        &[ConfigKind::Skill, ConfigKind::Rule, ConfigKind::Agent, ConfigKind::Mcp]
    }

    fn supports_scope(&self, scope: PathScope) -> bool {
        matches!(scope, PathScope::User | PathScope::Project)
    }

    fn target_path(
        &self,
        kind: ConfigKind,
        scope: PathScope,
        project_dir: Option<&Path>,
        source_path: &Path,
    ) -> Option<PathBuf> {
        if !self.supported_kinds().contains(&kind) {
            return None;
        }
        let filename = source_path.file_name()?.to_str()?;
        match kind {
            ConfigKind::Skill => {
                let parent = source_path.parent()?.file_name()?.to_str()?;
                match scope {
                    PathScope::User => dirs::home_dir().map(|h| h.join(".claude").join(parent)),
                    PathScope::Project => project_dir.map(|p| p.join(".claude").join(parent)),
                }
            }
            ConfigKind::Mcp => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".claude.json")),
                PathScope::Project => project_dir.map(|p| p.join(".mcp.json")),
            },
            _ => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".claude").join(filename)),
                PathScope::Project => project_dir.map(|p| p.join(".claude").join(filename)),
            }
        }
    }

    fn mechanism(&self, kind: ConfigKind) -> AssignmentMechanism {
        match kind {
            ConfigKind::Mcp => AssignmentMechanism::JsonInject,
            _ => AssignmentMechanism::Symlink,
        }
    }

    fn default_home_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".claude"))
    }
}

struct Codex;

impl AgentTool for Codex {
    fn id(&self) -> &str {
        "codex"
    }

    fn name(&self) -> &str {
        "Codex"
    }

    fn supported_kinds(&self) -> &[ConfigKind] {
        &[ConfigKind::Skill, ConfigKind::Rule, ConfigKind::Agent, ConfigKind::Mcp]
    }

    fn supports_scope(&self, scope: PathScope) -> bool {
        matches!(scope, PathScope::User | PathScope::Project)
    }

    fn target_path(
        &self,
        kind: ConfigKind,
        scope: PathScope,
        project_dir: Option<&Path>,
        source_path: &Path,
    ) -> Option<PathBuf> {
        if !self.supported_kinds().contains(&kind) {
            return None;
        }
        let filename = source_path.file_name()?.to_str()?;
        match kind {
            ConfigKind::Skill => {
                let parent = source_path.parent()?.file_name()?.to_str()?;
                match scope {
                    PathScope::User => dirs::home_dir().map(|h| h.join(".agents").join("skills").join(parent)),
                    PathScope::Project => project_dir.map(|p| p.join(".agents").join("skills").join(parent)),
                }
            }
            ConfigKind::Rule => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".codex").join("rules").join(filename)),
                PathScope::Project => project_dir.map(|p| p.join(".codex").join("rules").join(filename)),
            },
            ConfigKind::Agent => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".codex").join("agents").join(filename)),
                PathScope::Project => project_dir.map(|p| p.join(".codex").join("agents").join(filename)),
            },
            ConfigKind::Mcp => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".codex").join("config.toml")),
                PathScope::Project => project_dir.map(|p| p.join(".codex").join("config.toml")),
            },
        }
    }

    fn mechanism(&self, kind: ConfigKind) -> AssignmentMechanism {
        match kind {
            ConfigKind::Mcp => AssignmentMechanism::TomlInject,
            _ => AssignmentMechanism::Symlink,
        }
    }

    fn default_home_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".codex"))
    }
}

struct Cursor;

impl AgentTool for Cursor {
    fn id(&self) -> &str {
        "cursor"
    }

    fn name(&self) -> &str {
        "Cursor"
    }

    fn supported_kinds(&self) -> &[ConfigKind] {
        &[ConfigKind::Rule, ConfigKind::Mcp]
    }

    fn supports_scope(&self, scope: PathScope) -> bool {
        matches!(scope, PathScope::User | PathScope::Project)
    }

    fn target_path(
        &self,
        kind: ConfigKind,
        scope: PathScope,
        project_dir: Option<&Path>,
        source_path: &Path,
    ) -> Option<PathBuf> {
        match kind {
            ConfigKind::Rule => match scope {
                PathScope::User => {
                    let filename = source_path.file_name()?.to_str()?;
                    dirs::home_dir().map(|h| h.join(".cursor").join("rules").join(filename))
                }
                PathScope::Project => {
                    // Cursor 项目级 Rule 固定为 .cursorrules 文件
                    project_dir.map(|p| p.join(".cursorrules"))
                }
            },
            ConfigKind::Mcp => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".cursor").join("mcp.json")),
                PathScope::Project => project_dir.map(|p| p.join(".cursor").join("mcp.json")),
            },
            _ => None,
        }
    }

    fn mechanism(&self, kind: ConfigKind) -> AssignmentMechanism {
        match kind {
            ConfigKind::Mcp => AssignmentMechanism::JsonInject,
            _ => AssignmentMechanism::Symlink,
        }
    }

    fn default_home_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".cursor"))
    }
}

struct Kimi;

impl AgentTool for Kimi {
    fn id(&self) -> &str {
        "kimi"
    }

    fn name(&self) -> &str {
        "Kimi"
    }

    fn supported_kinds(&self) -> &[ConfigKind] {
        &[ConfigKind::Skill, ConfigKind::Mcp]
    }

    fn supports_scope(&self, scope: PathScope) -> bool {
        matches!(scope, PathScope::User | PathScope::Project)
    }

    fn target_path(
        &self,
        kind: ConfigKind,
        scope: PathScope,
        project_dir: Option<&Path>,
        source_path: &Path,
    ) -> Option<PathBuf> {
        if !self.supported_kinds().contains(&kind) {
            return None;
        }
        match kind {
            ConfigKind::Skill => {
                let parent = source_path.parent()?.file_name()?.to_str()?;
                match scope {
                    PathScope::User => dirs::home_dir().map(|h| h.join(".kimi").join("skills").join(parent)),
                    PathScope::Project => project_dir.map(|p| p.join(".kimi").join("skills").join(parent)),
                }
            }
            ConfigKind::Mcp => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".kimi").join("mcp.json")),
                PathScope::Project => None,
            },
            _ => None,
        }
    }

    fn mechanism(&self, kind: ConfigKind) -> AssignmentMechanism {
        match kind {
            ConfigKind::Mcp => AssignmentMechanism::JsonInject,
            _ => AssignmentMechanism::Symlink,
        }
    }

    fn default_home_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".kimi"))
    }
}

struct CodeBuddy;

impl AgentTool for CodeBuddy {
    fn id(&self) -> &str {
        "codebuddy"
    }

    fn name(&self) -> &str {
        "CodeBuddy"
    }

    fn supported_kinds(&self) -> &[ConfigKind] {
        &[ConfigKind::Skill, ConfigKind::Rule, ConfigKind::Agent, ConfigKind::Mcp]
    }

    fn supports_scope(&self, scope: PathScope) -> bool {
        matches!(scope, PathScope::User | PathScope::Project)
    }

    fn target_path(
        &self,
        kind: ConfigKind,
        scope: PathScope,
        project_dir: Option<&Path>,
        source_path: &Path,
    ) -> Option<PathBuf> {
        if !self.supported_kinds().contains(&kind) {
            return None;
        }
        let filename = source_path.file_name()?.to_str()?;
        match kind {
            ConfigKind::Skill => {
                let parent = source_path.parent()?.file_name()?.to_str()?;
                match scope {
                    PathScope::User => dirs::home_dir().map(|h| h.join(".codebuddy").join("skills").join(parent)),
                    PathScope::Project => project_dir.map(|p| p.join(".codebuddy").join("skills").join(parent)),
                }
            }
            ConfigKind::Rule => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".codebuddy").join("rules").join(filename)),
                PathScope::Project => project_dir.map(|p| p.join(".codebuddy").join("rules").join(filename)),
            },
            ConfigKind::Agent => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".codebuddy").join("agents").join(filename)),
                PathScope::Project => project_dir.map(|p| p.join(".codebuddy").join("agents").join(filename)),
            },
            ConfigKind::Mcp => match scope {
                PathScope::User => dirs::home_dir().map(|h| h.join(".codebuddy").join("mcp.json")),
                PathScope::Project => project_dir.map(|p| p.join(".codebuddy").join("mcp.json")),
            },
        }
    }

    fn mechanism(&self, kind: ConfigKind) -> AssignmentMechanism {
        match kind {
            ConfigKind::Mcp => AssignmentMechanism::JsonInject,
            _ => AssignmentMechanism::Symlink,
        }
    }

    fn default_home_dir(&self) -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".codebuddy"))
    }
}

struct ClaudeDesktop;

impl AgentTool for ClaudeDesktop {
    fn id(&self) -> &str {
        "claude_desktop"
    }

    fn name(&self) -> &str {
        "Claude Desktop"
    }

    fn supported_kinds(&self) -> &[ConfigKind] {
        &[ConfigKind::Mcp]
    }

    fn supports_scope(&self, scope: PathScope) -> bool {
        matches!(scope, PathScope::User)
    }

    fn target_path(
        &self,
        kind: ConfigKind,
        scope: PathScope,
        _project_dir: Option<&Path>,
        _source_path: &Path,
    ) -> Option<PathBuf> {
        if !self.supported_kinds().contains(&kind) {
            return None;
        }
        match scope {
            PathScope::User => {
                // macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
                #[cfg(target_os = "macos")]
                {
                    dirs::home_dir().map(|h| {
                        h.join("Library/Application Support/Claude/claude_desktop_config.json")
                    })
                }
                #[cfg(target_os = "windows")]
                {
                    dirs::data_dir().map(|d| d.join("Claude").join("claude_desktop_config.json"))
                }
                #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                {
                    None
                }
            }
            PathScope::Project => None,
        }
    }

    fn mechanism(&self, _kind: ConfigKind) -> AssignmentMechanism {
        AssignmentMechanism::JsonInject
    }

    fn default_home_dir(&self) -> Option<PathBuf> {
        #[cfg(target_os = "macos")]
        {
            dirs::home_dir().map(|h| h.join("Library/Application Support/Claude"))
        }
        #[cfg(target_os = "windows")]
        {
            dirs::data_dir().map(|d| d.join("Claude"))
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::path::PathBuf;

    fn home_dir() -> PathBuf {
        dirs::home_dir().expect("home dir should exist")
    }

    #[test]
    fn registry_contains_all_builtin_agents() {
        let registry = AgentRegistry::new();
        let ids = registry.ids();
        assert!(ids.contains(&"claude_code".to_string()));
        assert!(ids.contains(&"codex".to_string()));
        assert!(ids.contains(&"cursor".to_string()));
        assert!(ids.contains(&"kimi".to_string()));
        assert!(ids.contains(&"codebuddy".to_string()));
        assert!(ids.contains(&"claude_desktop".to_string()));
        assert_eq!(ids.len(), 6);
    }

    #[test]
    fn registry_get_returns_correct_agent() {
        let registry = AgentRegistry::new();
        let agent = registry.get("cursor").expect("cursor should exist");
        assert_eq!(agent.id(), "cursor");
        assert_eq!(agent.name(), "Cursor");
    }

    #[test]
    fn registry_get_missing_returns_none() {
        let registry = AgentRegistry::new();
        assert!(registry.get("nonexistent").is_none());
    }

    #[test]
    fn claude_code_user_target_path() {
        let agent = ClaudeCode;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".claude/coding"));
    }

    #[test]
    fn claude_code_project_target_path() {
        let agent = ClaudeCode;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.claude/coding"));
    }

    #[test]
    fn claude_code_user_mcp_target_path() {
        let agent = ClaudeCode;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".claude.json"));
    }

    #[test]
    fn claude_code_project_mcp_target_path() {
        let agent = ClaudeCode;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.mcp.json"));
    }

    #[test]
    fn claude_code_mechanism() {
        let agent = ClaudeCode;
        assert_eq!(agent.mechanism(ConfigKind::Skill), AssignmentMechanism::Symlink);
        assert_eq!(agent.mechanism(ConfigKind::Mcp), AssignmentMechanism::JsonInject);
    }

    #[test]
    fn codex_user_rule_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/rules/style.md");
        let target = agent
            .target_path(ConfigKind::Rule, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".codex/rules/style.md"));
    }

    #[test]
    fn codex_project_rule_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/rules/style.md");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Rule, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.codex/rules/style.md"));
    }

    #[test]
    fn codex_user_skill_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".agents/skills/coding"));
    }

    #[test]
    fn codex_project_skill_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.agents/skills/coding"));
    }

    #[test]
    fn codex_user_agent_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/agents/reviewer.toml");
        let target = agent
            .target_path(ConfigKind::Agent, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".codex/agents/reviewer.toml"));
    }

    #[test]
    fn codex_project_agent_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/agents/reviewer.toml");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Agent, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.codex/agents/reviewer.toml"));
    }

    #[test]
    fn codex_user_mcp_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".codex/config.toml"));
    }

    #[test]
    fn codex_project_mcp_target_path() {
        let agent = Codex;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.codex/config.toml"));
    }

    #[test]
    fn codex_mechanism() {
        let agent = Codex;
        assert_eq!(
            agent.mechanism(ConfigKind::Skill),
            AssignmentMechanism::Symlink
        );
        assert_eq!(
            agent.mechanism(ConfigKind::Mcp),
            AssignmentMechanism::TomlInject
        );
    }

    #[test]
    fn cursor_user_rule_target_path() {
        let agent = Cursor;
        let source = Path::new("/tmp/rules/typescript-style.md");
        let target = agent
            .target_path(ConfigKind::Rule, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".cursor/rules/typescript-style.md"));
    }

    #[test]
    fn cursor_project_rule_target_path_is_cursorrules() {
        let agent = Cursor;
        let source = Path::new("/tmp/rules/typescript-style.md");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Rule, PathScope::Project, Some(project), source)
            .unwrap();
        // 项目级 Cursor Rule 固定为 .cursorrules，忽略 source 文件名
        assert_eq!(target, PathBuf::from("/projects/myapp/.cursorrules"));
    }

    #[test]
    fn cursor_user_mcp_target_path() {
        let agent = Cursor;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".cursor/mcp.json"));
    }

    #[test]
    fn cursor_project_mcp_target_path() {
        let agent = Cursor;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.cursor/mcp.json"));
    }

    #[test]
    fn cursor_mechanism() {
        let agent = Cursor;
        assert_eq!(
            agent.mechanism(ConfigKind::Rule),
            AssignmentMechanism::Symlink
        );
        assert_eq!(
            agent.mechanism(ConfigKind::Mcp),
            AssignmentMechanism::JsonInject
        );
    }

    #[test]
    fn kimi_user_target_path() {
        let agent = Kimi;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".kimi/skills/coding"));
    }

    #[test]
    fn kimi_project_skill_target_path() {
        let agent = Kimi;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.kimi/skills/coding"));
    }

    #[test]
    fn kimi_user_mcp_target_path() {
        let agent = Kimi;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".kimi/mcp.json"));
    }

    #[test]
    fn kimi_supported_kinds() {
        let agent = Kimi;
        assert!(agent.supported_kinds().contains(&ConfigKind::Skill));
        assert!(agent.supported_kinds().contains(&ConfigKind::Mcp));
        assert!(!agent.supported_kinds().contains(&ConfigKind::Rule));
    }

    #[test]
    fn codebuddy_user_skill_target_path() {
        let agent = CodeBuddy;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".codebuddy/skills/coding"));
    }

    #[test]
    fn codebuddy_project_skill_target_path() {
        let agent = CodeBuddy;
        let source = Path::new("/tmp/skills/coding/SKILL.md");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Skill, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.codebuddy/skills/coding"));
    }

    #[test]
    fn codebuddy_user_rule_target_path() {
        let agent = CodeBuddy;
        let source = Path::new("/tmp/rules/style.mdc");
        let target = agent
            .target_path(ConfigKind::Rule, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".codebuddy/rules/style.mdc"));
    }

    #[test]
    fn codebuddy_user_agent_target_path() {
        let agent = CodeBuddy;
        let source = Path::new("/tmp/agents/reviewer.md");
        let target = agent
            .target_path(ConfigKind::Agent, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".codebuddy/agents/reviewer.md"));
    }

    #[test]
    fn codebuddy_user_mcp_target_path() {
        let agent = CodeBuddy;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::User, None, source)
            .unwrap();
        assert_eq!(target, home_dir().join(".codebuddy/mcp.json"));
    }

    #[test]
    fn codebuddy_project_mcp_target_path() {
        let agent = CodeBuddy;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let project = Path::new("/projects/myapp");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::Project, Some(project), source)
            .unwrap();
        assert_eq!(target, PathBuf::from("/projects/myapp/.codebuddy/mcp.json"));
    }

    #[test]
    fn codebuddy_mechanism() {
        let agent = CodeBuddy;
        assert_eq!(
            agent.mechanism(ConfigKind::Skill),
            AssignmentMechanism::Symlink
        );
        assert_eq!(
            agent.mechanism(ConfigKind::Mcp),
            AssignmentMechanism::JsonInject
        );
    }

    #[test]
    fn codebuddy_default_home_dir() {
        let agent = CodeBuddy;
        assert_eq!(agent.default_home_dir().unwrap(), home_dir().join(".codebuddy"));
    }

    #[test]
    fn claude_desktop_user_mcp_target_path() {
        let agent = ClaudeDesktop;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let target = agent
            .target_path(ConfigKind::Mcp, PathScope::User, None, source);
        #[cfg(target_os = "macos")]
        assert_eq!(
            target.unwrap(),
            home_dir().join("Library/Application Support/Claude/claude_desktop_config.json")
        );
        #[cfg(target_os = "windows")]
        assert_eq!(
            target.unwrap(),
            dirs::data_dir().unwrap().join("Claude").join("claude_desktop_config.json")
        );
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        assert!(target.is_none());
    }

    #[test]
    fn claude_desktop_project_target_path_returns_none() {
        let agent = ClaudeDesktop;
        let source = Path::new("/tmp/mcp/my-mcp.json");
        let project = Path::new("/projects/myapp");
        let target = agent.target_path(ConfigKind::Mcp, PathScope::Project, Some(project), source);
        assert!(target.is_none());
    }

    #[test]
    fn agent_supports_scope_check() {
        assert!(ClaudeCode.supports_scope(PathScope::User));
        assert!(ClaudeCode.supports_scope(PathScope::Project));
        assert!(Kimi.supports_scope(PathScope::User));
        assert!(Kimi.supports_scope(PathScope::Project));
    }

    #[test]
    fn registry_list_returns_all() {
        let registry = AgentRegistry::new();
        let list = registry.list();
        assert_eq!(list.len(), 6);
    }

    // === 端到端分配测试 ===

    fn temp_dir(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("ck-registry-test-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn end_to_end_assign_claude_code_user_skill() {
        use crate::agent::ops_assign;

        let dir = temp_dir("e2e-claude");
        let source_dir = dir.join("coding");
        fs::create_dir_all(&source_dir).unwrap();
        let source = source_dir.join("SKILL.md");
        fs::write(&source, "# Coding Skill").unwrap();

        let registry = AgentRegistry::new();
        let agent = registry.get("claude_code").unwrap();
        let _target = agent
            .target_path(ConfigKind::Skill, PathScope::User, None, &source)
            .unwrap();

        // 将 target 重定向到临时目录（避免污染真实 ~/.claude）
        let redirected_target = dir.join("fake-claude").join("coding");

        ops_assign(
            &source_dir,
            &redirected_target,
            agent.mechanism(ConfigKind::Skill),
        )
        .unwrap();

        assert!(redirected_target.is_symlink());
        let content = fs::read_to_string(redirected_target.join("SKILL.md")).unwrap();
        assert_eq!(content, "# Coding Skill");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn end_to_end_assign_cursor_user_rule() {
        use crate::agent::ops_assign;

        let dir = temp_dir("e2e-cursor");
        let source = dir.join("typescript-style.md");
        fs::write(&source, "# TypeScript Rules").unwrap();

        let registry = AgentRegistry::new();
        let agent = registry.get("cursor").unwrap();
        let redirected_target = dir
            .join("fake-cursor")
            .join("rules")
            .join("typescript-style.md");

        ops_assign(
            &source,
            &redirected_target,
            agent.mechanism(ConfigKind::Rule),
        )
        .unwrap();

        assert!(redirected_target.is_symlink());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn end_to_end_assign_cursor_mcp() {
        use crate::agent::ops_assign;

        let dir = temp_dir("e2e-cursor-mcp");
        let source = dir.join("fs-server.mcp.json");
        fs::write(&source, r#"{"command": "npx", "args": ["-y", "server"]}"#).unwrap();

        let registry = AgentRegistry::new();
        let agent = registry.get("cursor").unwrap();
        let target = dir.join("fake-cursor").join("mcp.json");

        ops_assign(&source, &target, agent.mechanism(ConfigKind::Mcp))
            .unwrap();

        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert!(json
            .get("mcpServers")
            .unwrap()
            .as_object()
            .unwrap()
            .contains_key("fs-server"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn end_to_end_conflict_detection() {
        let dir = temp_dir("e2e-conflict");
        let source = dir.join("source.md");
        let target = dir.join("existing.md");
        fs::write(&source, "new").unwrap();
        fs::write(&target, "existing").unwrap();

        assert!(target.exists());

        let _ = fs::remove_dir_all(&dir);
    }
}
