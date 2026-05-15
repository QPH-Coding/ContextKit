use std::path::Path;
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

    /// 从文件加载索引，文件不存在则返回默认空索引
    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::new());
        }
        let content = std::fs::read_to_string(path)?;
        let index: Index = toml::from_str(&content)
            .map_err(ContextKitError::from)?;
        Ok(index)
    }

    /// 保存索引到文件
    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(self)
            .map_err(ContextKitError::from)?;
        std::fs::write(path, content)?;
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

    fn temp_index_path() -> PathBuf {
        env::temp_dir().join(format!("ck-index-test-{}", std::process::id()))
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
    fn save_and_load_roundtrip() {
        let temp_path = temp_index_path();
        let _ = std::fs::remove_file(&temp_path);

        let mut index = Index::new();
        index.add_source(dummy_source("abc"));
        index.save(&temp_path).unwrap();

        let loaded = Index::load(&temp_path).unwrap();
        assert_eq!(index, loaded);

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    fn load_returns_default_if_file_missing() {
        let temp_path = temp_index_path().join("nonexistent").join("index.toml");
        let index = Index::load(&temp_path).unwrap();
        assert_eq!(index.version, 1);
        assert!(index.sources.is_empty());
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
