use std::collections::HashMap;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ConfigKind {
    Skill,
    Rule,
    Agent,
    Mcp,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum SyncMode {
    Reference,
    Copy,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum PathScope {
    User,
    Project,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SourceType {
    Git { url: String, branch: String },
    Local { path: PathBuf },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Source {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub source_type: SourceType,
    pub local_path: PathBuf,
    pub mode: SyncMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_scan_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_count: Option<usize>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub configs: Vec<ConfigSummary>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ignore_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfigSummary {
    pub id: String,
    pub name: String,
    pub kind: ConfigKind,
    pub source_id: String,
    pub source_name: String,
    pub relative_path: PathBuf,
    pub token_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfigDetail {
    pub id: String,
    pub name: String,
    pub kind: ConfigKind,
    pub source_id: String,
    pub source_name: String,
    pub relative_path: PathBuf,
    pub absolute_path: PathBuf,
    pub token_count: usize,
    pub content: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub assigned_agents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Assignment {
    pub config_id: String,
    pub agent_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_path: Option<PathBuf>,
    pub assigned_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Stats {
    pub source_count: usize,
    pub total_configs: usize,
    pub configs_by_kind: std::collections::HashMap<ConfigKind, usize>,
    pub configs_by_agent: std::collections::HashMap<String, usize>,
    pub total_tokens: usize,
    pub tokens_by_agent: std::collections::HashMap<String, usize>,
    pub tokens_by_kind: std::collections::HashMap<ConfigKind, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Settings {
    pub config_dir: PathBuf,
    pub default_sync_mode: SyncMode,
    pub agent_dirs: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub supported_kinds: Vec<ConfigKind>,
    pub supports_user_scope: bool,
    pub supports_project_scope: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentSetting {
    pub id: String,
    pub name: String,
    pub dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DirNode {
    pub name: String,
    pub relative_path: String,
    pub has_children: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Serialize, Deserialize)]
    struct ConfigKindWrapper {
        kind: ConfigKind,
    }

    #[test]
    fn config_kind_serialization() {
        let wrapper = ConfigKindWrapper { kind: ConfigKind::Skill };
        let toml_str = toml::to_string(&wrapper).unwrap();
        assert!(toml_str.contains("kind = \"skill\""));

        let wrapper = ConfigKindWrapper { kind: ConfigKind::Rule };
        let toml_str = toml::to_string(&wrapper).unwrap();
        assert!(toml_str.contains("kind = \"rule\""));
    }

    #[test]
    fn config_kind_deserialization() {
        let wrapper: ConfigKindWrapper = toml::from_str("kind = \"skill\"").unwrap();
        assert_eq!(wrapper.kind, ConfigKind::Skill);

        let wrapper: ConfigKindWrapper = toml::from_str("kind = \"mcp\"").unwrap();
        assert_eq!(wrapper.kind, ConfigKind::Mcp);
    }

    #[derive(Serialize, Deserialize)]
    struct SyncModeWrapper {
        mode: SyncMode,
    }

    #[test]
    fn sync_mode_roundtrip() {
        let modes = vec![SyncMode::Reference, SyncMode::Copy];
        for mode in modes {
            let wrapper = SyncModeWrapper { mode };
            let serialized = toml::to_string(&wrapper).unwrap();
            let deserialized: SyncModeWrapper = toml::from_str(&serialized).unwrap();
            assert_eq!(wrapper.mode, deserialized.mode);
        }
    }

    #[derive(Serialize, Deserialize)]
    struct PathScopeWrapper {
        scope: PathScope,
    }

    #[test]
    fn path_scope_roundtrip() {
        let scopes = vec![PathScope::User, PathScope::Project];
        for scope in scopes {
            let wrapper = PathScopeWrapper { scope };
            let serialized = toml::to_string(&wrapper).unwrap();
            let deserialized: PathScopeWrapper = toml::from_str(&serialized).unwrap();
            assert_eq!(wrapper.scope, deserialized.scope);
        }
    }

    #[test]
    fn source_type_git_roundtrip() {
        let source_type = SourceType::Git {
            url: "https://github.com/user/skills.git".into(),
            branch: "main".into(),
        };
        let serialized = toml::to_string(&source_type).unwrap();
        let deserialized: SourceType = toml::from_str(&serialized).unwrap();
        assert_eq!(source_type, deserialized);
    }

    #[test]
    fn source_type_local_roundtrip() {
        let source_type = SourceType::Local {
            path: PathBuf::from("/home/user/skills"),
        };
        let serialized = toml::to_string(&source_type).unwrap();
        let deserialized: SourceType = toml::from_str(&serialized).unwrap();
        assert_eq!(source_type, deserialized);
    }

    #[test]
    fn source_roundtrip() {
        let source = Source {
            id: "abc123".into(),
            name: "my-skills".into(),
            source_type: SourceType::Git {
                url: "https://github.com/user/skills.git".into(),
                branch: "main".into(),
            },
            local_path: PathBuf::from("/tmp/contextkit/repos/abc123"),
            mode: SyncMode::Reference,
            last_scan_at: Some("2026-05-15T10:00:00Z".into()),
            config_count: Some(5),
            configs: Vec::new(),
            ignore_dirs: Vec::new(),
        };
        let serialized = toml::to_string(&source).unwrap();
        let deserialized: Source = toml::from_str(&serialized).unwrap();
        assert_eq!(source, deserialized);
    }

    #[test]
    fn config_summary_roundtrip() {
        let summary = ConfigSummary {
            id: "skill-001".into(),
            name: "coding-helper".into(),
            kind: ConfigKind::Skill,
            source_id: "abc123".into(),
            source_name: "my-skills".into(),
            relative_path: PathBuf::from("skills/coding-helper/SKILL.md"),
            token_count: 128,
        };
        let serialized = toml::to_string(&summary).unwrap();
        let deserialized: ConfigSummary = toml::from_str(&serialized).unwrap();
        assert_eq!(summary, deserialized);
    }

    #[test]
    fn config_detail_roundtrip() {
        let detail = ConfigDetail {
            id: "skill-001".into(),
            name: "coding-helper".into(),
            kind: ConfigKind::Skill,
            source_id: "abc123".into(),
            source_name: "my-skills".into(),
            relative_path: PathBuf::from("skills/coding-helper/SKILL.md"),
            absolute_path: PathBuf::from("/tmp/contextkit/repos/abc123/skills/coding-helper/SKILL.md"),
            token_count: 128,
            content: "# Coding Helper\n\nThis skill helps with coding.".into(),
            assigned_agents: vec!["cursor".into()],
        };
        let serialized = toml::to_string(&detail).unwrap();
        let deserialized: ConfigDetail = toml::from_str(&serialized).unwrap();
        assert_eq!(detail, deserialized);
    }

    #[test]
    fn assignment_roundtrip() {
        let assignment = Assignment {
            config_id: "skill-001".into(),
            agent_id: "cursor".into(),
            project_path: None,
            assigned_at: "2026-05-15T11:00:00Z".into(),
        };
        let serialized = toml::to_string(&assignment).unwrap();
        let deserialized: Assignment = toml::from_str(&serialized).unwrap();
        assert_eq!(assignment, deserialized);
    }

    #[test]
    fn source_toml_format_matches_schema() {
        // 验证序列化后的格式符合 DESIGN.md 中的 index.toml schema
        let source = Source {
            id: "a1b2c3d4".into(),
            name: "my-ai-skills".into(),
            source_type: SourceType::Git {
                url: "https://github.com/user/skills.git".into(),
                branch: "main".into(),
            },
            local_path: PathBuf::from("~/.config/contextkit/repos/a1b2c3d4"),
            mode: SyncMode::Reference,
            last_scan_at: Some("2026-05-15T10:00:00Z".into()),
            config_count: Some(5),
            configs: Vec::new(),
            ignore_dirs: Vec::new(),
        };
        let toml_str = toml::to_string(&source).unwrap();
        
        // 验证关键字段存在
        assert!(toml_str.contains("id = \"a1b2c3d4\""));
        assert!(toml_str.contains("name = \"my-ai-skills\""));
        assert!(toml_str.contains("type = \"git\""));
        assert!(toml_str.contains("url = \"https://github.com/user/skills.git\""));
        assert!(toml_str.contains("branch = \"main\""));
        assert!(toml_str.contains("mode = \"reference\""));
    }
}
