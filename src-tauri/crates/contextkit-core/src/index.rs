use std::path::Path;
use crate::config::ConfigManager;
use crate::error::{ContextKitError, Result};
use crate::models::{Assignment, Source};
use serde::{Deserialize, Serialize};

const CURRENT_INDEX_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Index {
    pub version: u32,
    pub sources: Vec<Source>,
    pub assignments: Vec<Assignment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SourcesWrapper {
    version: u32,
    sources: Vec<Source>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AssignmentsWrapper {
    version: u32,
    assignments: Vec<Assignment>,
}

impl Default for Index {
    fn default() -> Self {
        Self::new()
    }
}

impl Index {
    pub fn new() -> Self {
        Self {
            version: CURRENT_INDEX_VERSION,
            sources: Vec::new(),
            assignments: Vec::new(),
        }
    }

    /// 从拆分后的多文件加载索引，自动处理旧版迁移
    pub fn load(config: &ConfigManager) -> Result<Self> {
        Self::maybe_migrate(config)?;

        let sources = if config.sources_path().exists() {
            let content = std::fs::read_to_string(&config.sources_path())?;
            let wrapper: SourcesWrapper = toml::from_str(&content)
                .map_err(ContextKitError::from)?;
            wrapper.sources
        } else {
            Vec::new()
        };

        let assignments = if config.assignments_path().exists() {
            let content = std::fs::read_to_string(&config.assignments_path())?;
            let wrapper: AssignmentsWrapper = toml::from_str(&content)
                .map_err(ContextKitError::from)?;
            wrapper.assignments
        } else {
            Vec::new()
        };

        Ok(Self {
            version: CURRENT_INDEX_VERSION,
            sources,
            assignments,
        })
    }

    /// 保存索引到拆分后的多文件
    pub fn save(&self, config: &ConfigManager) -> Result<()> {
        let sources_wrapper = SourcesWrapper {
            version: self.version,
            sources: self.sources.clone(),
        };
        let assignments_wrapper = AssignmentsWrapper {
            version: self.version,
            assignments: self.assignments.clone(),
        };

        let sources_content = toml::to_string_pretty(&sources_wrapper)
            .map_err(ContextKitError::from)?;
        let assignments_content = toml::to_string_pretty(&assignments_wrapper)
            .map_err(ContextKitError::from)?;

        std::fs::write(&config.sources_path(), sources_content)?;
        std::fs::write(&config.assignments_path(), assignments_content)?;
        Ok(())
    }

    /// 从旧版单文件加载（兼容旧测试）
    pub fn load_from_file(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::new());
        }
        let content = std::fs::read_to_string(path)?;
        let index: Index = toml::from_str(&content)
            .map_err(ContextKitError::from)?;
        Ok(index)
    }

    /// 检测并执行迁移：旧 index.toml → sources.toml + assignments.toml
    fn maybe_migrate(config: &ConfigManager) -> Result<()> {
        let old_path = config.index_path();
        let sources_path = config.sources_path();
        let assignments_path = config.assignments_path();

        if old_path.exists() && !sources_path.exists() && !assignments_path.exists() {
            let old_index = Self::load_from_file(&old_path)?;

            let sources_wrapper = SourcesWrapper {
                version: CURRENT_INDEX_VERSION,
                sources: old_index.sources,
            };
            let assignments_wrapper = AssignmentsWrapper {
                version: CURRENT_INDEX_VERSION,
                assignments: old_index.assignments,
            };

            let sources_content = toml::to_string_pretty(&sources_wrapper)
                .map_err(ContextKitError::from)?;
            let assignments_content = toml::to_string_pretty(&assignments_wrapper)
                .map_err(ContextKitError::from)?;

            std::fs::write(&sources_path, sources_content)?;
            std::fs::write(&assignments_path, assignments_content)?;

            // 旧文件重命名备份
            let backup_path = old_path.with_extension("toml.backup");
            std::fs::rename(&old_path, backup_path)?;
        }
        Ok(())
    }

    pub fn add_source(&mut self, source: Source) {
        self.sources.push(source);
    }

    pub fn remove_source(&mut self, id: &str) -> Result<()> {
        let pos = self.sources
            .iter()
            .position(|s| s.id == id)
            .ok_or_else(|| ContextKitError::SourceNotFound { id: id.into() })?;
        self.sources.remove(pos);
        // 同时删除与该 Source 相关的 Assignment
        self.assignments.retain(|a| {
            !a.config_id.starts_with(&format!("{id}:"))
        });
        Ok(())
    }

    pub fn get_source(&self, id: &str) -> Option<&Source> {
        self.sources.iter().find(|s| s.id == id)
    }

    pub fn get_source_mut(&mut self, id: &str) -> Option<&mut Source> {
        self.sources.iter_mut().find(|s| s.id == id)
    }

    pub fn add_assignment(&mut self, assignment: Assignment) {
        self.assignments.push(assignment);
    }

    pub fn remove_assignment(&mut self, config_id: &str, agent_id: &str) {
        self.assignments.retain(|a| {
            !(a.config_id == config_id && a.agent_id == agent_id)
        });
    }

    pub fn get_assignments_for_config(&self, config_id: &str) -> Vec<&Assignment> {
        self.assignments
            .iter()
            .filter(|a| a.config_id == config_id)
            .collect()
    }

    pub fn get_assignments_for_agent(&self, agent_id: &str) -> Vec<&Assignment> {
        self.assignments
            .iter()
            .filter(|a| a.agent_id == agent_id)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{SourceType, SyncMode};
    use std::env;
    use std::path::PathBuf;

    fn temp_config(name: &str) -> ConfigManager {
        let dir = env::temp_dir().join(format!("ck-index-test-{}", std::process::id())).join(name);
        let _ = std::fs::remove_dir_all(&dir);
        ConfigManager::with_dir(&dir)
    }

    fn dummy_source(id: &str) -> Source {
        Source {
            id: id.into(),
            name: format!("source-{id}"),
            source_type: SourceType::Local {
                path: PathBuf::from(format!("/tmp/{id}")),
            },
            local_path: PathBuf::from(format!("/tmp/{id}")),
            mode: SyncMode::Reference,
            last_scan_at: None,
            config_count: None,
            configs: Vec::new(),
            ignore_dirs: Vec::new(),
        }
    }

    #[test]
    fn new_creates_empty_index() {
        let index = Index::new();
        assert_eq!(index.version, 1);
        assert!(index.sources.is_empty());
        assert!(index.assignments.is_empty());
    }

    #[test]
    fn save_and_load_split_roundtrip() {
        let config = temp_config("split-roundtrip");
        config.ensure_dirs().unwrap();
        let _ = std::fs::remove_file(config.sources_path());
        let _ = std::fs::remove_file(config.assignments_path());

        let mut index = Index::new();
        index.add_source(dummy_source("abc"));
        index.save(&config).unwrap();

        let loaded = Index::load(&config).unwrap();
        assert_eq!(index, loaded);

        let _ = std::fs::remove_dir_all(config.config_dir());
    }

    #[test]
    fn load_returns_default_if_file_missing() {
        let config = temp_config("missing");
        let index = Index::load(&config).unwrap();
        assert_eq!(index.version, 1);
        assert!(index.sources.is_empty());
        let _ = std::fs::remove_dir_all(config.config_dir());
    }

    #[test]
    fn migrate_old_index_toml() {
        let config = temp_config("migrate");
        config.ensure_dirs().unwrap();

        // 创建旧版 index.toml
        let old_index = Index {
            version: 1,
            sources: vec![dummy_source("old-src")],
            assignments: vec![Assignment {
                config_id: "cfg-1".into(),
                agent_id: "cursor".into(),
                project_path: None,
                assigned_at: "2026-05-15T10:00:00Z".into(),
            }],
        };
        let old_content = toml::to_string_pretty(&old_index).unwrap();
        std::fs::write(config.index_path(), old_content).unwrap();

        // 加载应触发迁移
        let loaded = Index::load(&config).unwrap();
        assert_eq!(loaded.sources.len(), 1);
        assert_eq!(loaded.assignments.len(), 1);

        // 验证新文件已创建
        assert!(config.sources_path().exists());
        assert!(config.assignments_path().exists());

        // 验证旧文件已备份
        assert!(!config.index_path().exists());
        assert!(config.index_path().with_extension("toml.backup").exists());

        let _ = std::fs::remove_dir_all(config.config_dir());
    }

    #[test]
    fn add_and_remove_source() {
        let mut index = Index::new();
        index.add_source(dummy_source("s1"));
        index.add_source(dummy_source("s2"));
        assert_eq!(index.sources.len(), 2);

        index.remove_source("s1").unwrap();
        assert_eq!(index.sources.len(), 1);
        assert_eq!(index.sources[0].id, "s2");
    }

    #[test]
    fn remove_source_not_found() {
        let mut index = Index::new();
        let err = index.remove_source("missing").unwrap_err();
        assert!(matches!(err, ContextKitError::SourceNotFound { .. }));
    }

    #[test]
    fn get_source_by_id() {
        let mut index = Index::new();
        index.add_source(dummy_source("found"));
        assert!(index.get_source("found").is_some());
        assert!(index.get_source("not-found").is_none());
    }

    #[test]
    fn add_and_remove_assignment() {
        let mut index = Index::new();
        let a1 = Assignment {
            config_id: "cfg-1".into(),
            agent_id: "cursor".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        };
        let a2 = Assignment {
            config_id: "cfg-2".into(),
            agent_id: "kimi".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        };
        index.add_assignment(a1);
        index.add_assignment(a2);
        assert_eq!(index.assignments.len(), 2);

        index.remove_assignment("cfg-1", "cursor");
        assert_eq!(index.assignments.len(), 1);
        assert_eq!(index.assignments[0].config_id, "cfg-2");
    }

    #[test]
    fn get_assignments_for_config() {
        let mut index = Index::new();
        index.add_assignment(Assignment {
            config_id: "cfg-1".into(),
            agent_id: "cursor".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });
        index.add_assignment(Assignment {
            config_id: "cfg-1".into(),
            agent_id: "kimi".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });
        index.add_assignment(Assignment {
            config_id: "cfg-2".into(),
            agent_id: "cursor".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });

        let cfg1 = index.get_assignments_for_config("cfg-1");
        assert_eq!(cfg1.len(), 2);

        let cfg2 = index.get_assignments_for_config("cfg-2");
        assert_eq!(cfg2.len(), 1);
    }

    #[test]
    fn get_assignments_for_agent() {
        let mut index = Index::new();
        index.add_assignment(Assignment {
            config_id: "cfg-1".into(),
            agent_id: "cursor".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });
        index.add_assignment(Assignment {
            config_id: "cfg-2".into(),
            agent_id: "cursor".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });
        index.add_assignment(Assignment {
            config_id: "cfg-3".into(),
            agent_id: "kimi".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });

        let cursor = index.get_assignments_for_agent("cursor");
        assert_eq!(cursor.len(), 2);

        let kimi = index.get_assignments_for_agent("kimi");
        assert_eq!(kimi.len(), 1);
    }

    #[test]
    fn remove_source_cleans_assignments() {
        let mut index = Index::new();
        index.add_source(dummy_source("src1"));
        index.add_assignment(Assignment {
            config_id: "src1:cfg-1".into(),
            agent_id: "cursor".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });
        index.add_assignment(Assignment {
            config_id: "src2:cfg-1".into(),
            agent_id: "kimi".into(),
            project_path: None,
            assigned_at: "2026-05-15T10:00:00Z".into(),
        });
        assert_eq!(index.assignments.len(), 2);

        index.remove_source("src1").unwrap();
        assert_eq!(index.assignments.len(), 1);
        assert_eq!(index.assignments[0].config_id, "src2:cfg-1");
    }
}
