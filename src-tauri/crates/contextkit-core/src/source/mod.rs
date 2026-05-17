pub mod git;

use crate::config::ConfigManager;
use crate::error::{ContextKitError, Result};
use crate::index::Index;
use crate::models::{Assignment, ConfigSummary, Source, SourceType, SyncMode};
use crate::scanner::scan_directory;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

pub use git::{clone_repo, has_updates, pull_repo};

pub struct SourceManager {
    config: ConfigManager,
    index: Index,
}

impl SourceManager {
    pub fn new() -> Result<Self> {
        let config = ConfigManager::new()?;
        Self::with_config(config)
    }

    pub fn with_config(config: ConfigManager) -> Result<Self> {
        let index = Index::load(&config.index_path())?;
        config.ensure_dirs()?;
        Ok(Self { config, index })
    }

    /// 添加本地目录源
    pub fn add_local_source(
        &mut self,
        path: PathBuf,
        name: Option<String>,
        mode: SyncMode,
    ) -> Result<Source> {
        if !path.exists() {
            return Err(ContextKitError::InvalidPath(format!(
                "Path does not exist: {}",
                path.display()
            )));
        }
        if !path.is_dir() {
            return Err(ContextKitError::InvalidPath(format!(
                "Path is not a directory: {}",
                path.display()
            )));
        }

        let id = make_source_id(&path.to_string_lossy());
        if self.index.get_source(&id).is_some() {
            return Err(ContextKitError::InvalidPath(format!(
                "Source already exists: {id}"
            )));
        }
        let name = name.unwrap_or_else(|| {
            path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string()
        });

        let source = Source {
            id: id.clone(),
            name,
            source_type: SourceType::Local { path: path.clone() },
            local_path: path,
            mode,
            last_scan_at: None,
            config_count: None,
            configs: Vec::new(),
        };

        self.index.add_source(source.clone());
        self.save()?;
        Ok(source)
    }

    /// 添加 Git 仓库源
    pub fn add_git_source(
        &mut self,
        url: String,
        name: Option<String>,
        mode: SyncMode,
    ) -> Result<Source> {
        let id = make_source_id(&url);
        if self.index.get_source(&id).is_some() {
            return Err(ContextKitError::InvalidPath(format!(
                "Source already exists: {id}"
            )));
        }
        let dest = self.config.repos_dir().join(&id);

        // 克隆仓库
        git::clone_repo(&url, &dest)?;

        let name = name.unwrap_or_else(|| {
            url.split('/')
                .next_back()
                .and_then(|s| s.strip_suffix(".git"))
                .unwrap_or("unknown")
                .to_string()
        });

        let source = Source {
            id: id.clone(),
            name,
            source_type: SourceType::Git {
                url: url.clone(),
                branch: "main".into(),
            },
            local_path: dest,
            mode,
            last_scan_at: None,
            config_count: None,
            configs: Vec::new(),
        };

        self.index.add_source(source.clone());
        self.save()?;
        Ok(source)
    }

    pub fn remove_source(&mut self, id: &str) -> Result<()> {
        self.index.remove_source(id)?;
        self.save()?;
        Ok(())
    }

    pub fn list_sources(&self) -> &[Source] {
        &self.index.sources
    }

    /// 同步源：Git 源先 pull，然后扫描目录
    pub fn sync_source(&mut self, id: &str) -> Result<Vec<ConfigSummary>> {
        let source = self
            .index
            .get_source(id)
            .ok_or_else(|| ContextKitError::SourceNotFound { id: id.into() })?
            .clone();

        // Git 源：先 pull
        if let SourceType::Git { .. } = &source.source_type {
            git::pull_repo(&source.local_path)?;
        }

        // 扫描
        let configs = scan_directory(&source.local_path, &source.id, &source.name)?;

        // 更新 source 元数据
        if let Some(s) = self.index.get_source_mut(id) {
            s.last_scan_at = Some(chrono::Utc::now().to_rfc3339());
            s.config_count = Some(configs.len());
            s.configs = configs.clone();
        }

        self.save()?;
        Ok(configs)
    }

    pub fn save(&self) -> Result<()> {
        self.index.save(&self.config.index_path())
    }

    pub fn config(&self) -> &ConfigManager {
        &self.config
    }

    pub fn index(&self) -> &Index {
        &self.index
    }

    pub fn add_assignment(&mut self, assignment: Assignment) -> Result<()> {
        self.index.add_assignment(assignment);
        self.save()
    }

    pub fn remove_assignment(&mut self, config_id: &str, agent_id: &str) -> Result<()> {
        self.index.remove_assignment(config_id, agent_id);
        self.save()
    }
}

fn make_source_id(input: &str) -> String {
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    format!("{:08x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::process::Command;

    fn temp_config(name: &str) -> ConfigManager {
        let dir = env::temp_dir().join(format!("ck-source-test-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        ConfigManager::with_dir(&dir)
    }

    fn cleanup(path: &std::path::Path) {
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn add_local_source_valid() {
        let config = temp_config("local-valid");
        let mut mgr = SourceManager::with_config(config.clone()).unwrap();

        let source_dir = env::temp_dir().join(format!("ck-local-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&source_dir);
        fs::create_dir_all(&source_dir).unwrap();

        let source = mgr
            .add_local_source(
                source_dir.clone(),
                Some("My Local".into()),
                SyncMode::Reference,
            )
            .unwrap();
        assert_eq!(source.name, "My Local");
        assert!(matches!(source.source_type, SourceType::Local { .. }));

        assert_eq!(mgr.list_sources().len(), 1);

        cleanup(&source_dir);
        cleanup(config.config_dir());
    }

    #[test]
    fn add_local_source_rejects_duplicate() {
        let config = temp_config("local-duplicate");
        let mut mgr = SourceManager::with_config(config.clone()).unwrap();

        let source_dir = env::temp_dir().join(format!("ck-local-dup-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&source_dir);
        fs::create_dir_all(&source_dir).unwrap();

        mgr.add_local_source(source_dir.clone(), None, SyncMode::Reference)
            .unwrap();
        let result = mgr.add_local_source(source_dir.clone(), None, SyncMode::Reference);

        assert!(matches!(result, Err(ContextKitError::InvalidPath(_))));
        assert_eq!(mgr.list_sources().len(), 1);

        cleanup(&source_dir);
        cleanup(config.config_dir());
    }

    #[test]
    fn add_local_source_missing_path() {
        let config = temp_config("local-missing");
        let mut mgr = SourceManager::with_config(config.clone()).unwrap();

        let missing = env::temp_dir().join("ck-does-not-exist-12345");
        let result = mgr.add_local_source(missing, None, SyncMode::Reference);
        assert!(result.is_err());

        cleanup(config.config_dir());
    }

    #[test]
    fn remove_source() {
        let config = temp_config("remove");
        let mut mgr = SourceManager::with_config(config.clone()).unwrap();

        let source_dir = env::temp_dir().join(format!("ck-remove-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&source_dir);
        fs::create_dir_all(&source_dir).unwrap();

        let source = mgr
            .add_local_source(source_dir.clone(), None, SyncMode::Reference)
            .unwrap();
        assert_eq!(mgr.list_sources().len(), 1);

        mgr.remove_source(&source.id).unwrap();
        assert!(mgr.list_sources().is_empty());

        cleanup(&source_dir);
        cleanup(config.config_dir());
    }

    #[test]
    fn sync_source_scans_configs() {
        let config = temp_config("sync");
        let mut mgr = SourceManager::with_config(config.clone()).unwrap();

        // 创建带配置的本地目录
        let source_dir = env::temp_dir().join(format!("ck-sync-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&source_dir);
        fs::create_dir_all(&source_dir).unwrap();
        fs::create_dir_all(source_dir.join("rules")).unwrap();
        fs::write(source_dir.join("rules").join("style.md"), "# Style").unwrap();

        let source = mgr
            .add_local_source(source_dir.clone(), None, SyncMode::Reference)
            .unwrap();
        let configs = mgr.sync_source(&source.id).unwrap();

        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, crate::models::ConfigKind::Rule);

        // 验证 source 元数据已更新
        let updated = mgr.index().get_source(&source.id).unwrap();
        assert!(updated.last_scan_at.is_some());
        assert_eq!(updated.config_count, Some(1));

        cleanup(&source_dir);
        cleanup(config.config_dir());
    }

    #[test]
    fn save_and_load_persists() {
        let config = temp_config("persist");
        let source_dir = env::temp_dir().join(format!("ck-persist-src-{}", std::process::id()));
        let _ = fs::remove_dir_all(&source_dir);
        fs::create_dir_all(&source_dir).unwrap();

        {
            let mut mgr = SourceManager::with_config(config.clone()).unwrap();
            mgr.add_local_source(source_dir.clone(), Some("Persisted".into()), SyncMode::Copy)
                .unwrap();
            mgr.save().unwrap();
        }

        // 重新加载
        let mgr2 = SourceManager::with_config(config.clone()).unwrap();
        assert_eq!(mgr2.list_sources().len(), 1);
        assert_eq!(mgr2.list_sources()[0].name, "Persisted");
        assert_eq!(mgr2.list_sources()[0].mode, SyncMode::Copy);

        cleanup(&source_dir);
        cleanup(config.config_dir());
    }

    #[test]
    fn add_git_source_clones_repo() {
        let config = temp_config("git-add");

        // 创建 bare 仓库
        let bare = env::temp_dir().join(format!("ck-git-add-bare-{}", std::process::id()));
        let _ = fs::remove_dir_all(&bare);
        let out = Command::new("git")
            .args(["init", "--bare", &bare.to_string_lossy()])
            .output()
            .unwrap();
        assert!(out.status.success());

        // 推送一个提交
        let work = env::temp_dir().join(format!("ck-git-add-work-{}", std::process::id()));
        let _ = fs::remove_dir_all(&work);
        let out = Command::new("git")
            .args(["clone", &bare.to_string_lossy(), &work.to_string_lossy()])
            .output()
            .unwrap();
        assert!(out.status.success());

        for cmd in [
            vec![
                "-C",
                &work.to_string_lossy(),
                "config",
                "user.email",
                "t@t.com",
            ],
            vec!["-C", &work.to_string_lossy(), "config", "user.name", "T"],
        ] {
            Command::new("git").args(&cmd).output().unwrap();
        }
        fs::write(work.join("README.md"), "# Test").unwrap();
        Command::new("git")
            .args(["-C", &work.to_string_lossy(), "add", "."])
            .output()
            .unwrap();
        Command::new("git")
            .args(["-C", &work.to_string_lossy(), "commit", "-m", "init"])
            .output()
            .unwrap();
        Command::new("git")
            .args(["-C", &work.to_string_lossy(), "push", "origin", "HEAD"])
            .output()
            .unwrap();

        // 添加 Git 源
        let mut mgr = SourceManager::with_config(config.clone()).unwrap();
        let source = mgr
            .add_git_source(
                bare.to_string_lossy().to_string(),
                Some("BareRepo".into()),
                SyncMode::Reference,
            )
            .unwrap();

        assert_eq!(source.name, "BareRepo");
        assert!(matches!(source.source_type, SourceType::Git { .. }));
        assert!(source.local_path.exists());
        assert!(source.local_path.join(".git").exists());

        cleanup(&bare);
        cleanup(&work);
        cleanup(config.config_dir());
    }
}
