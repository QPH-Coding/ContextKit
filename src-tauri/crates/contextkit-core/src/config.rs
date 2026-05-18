use std::path::{Path, PathBuf};
use crate::error::{ContextKitError, Result};

#[derive(Clone)]
pub struct ConfigManager {
    base_dir: PathBuf,
}

impl ConfigManager {
    /// 使用平台默认配置目录创建
    pub fn new() -> Result<Self> {
        let base = dirs::config_dir()
            .ok_or(ContextKitError::ConfigDirNotFound)?
            .join("contextkit");
        Ok(Self { base_dir: base })
    }

    /// 使用指定路径创建（用于测试或自定义配置目录）
    pub fn with_dir<P: AsRef<Path>>(path: P) -> Self {
        Self {
            base_dir: path.as_ref().to_path_buf(),
        }
    }

    pub fn config_dir(&self) -> &Path {
        &self.base_dir
    }

    pub fn index_path(&self) -> PathBuf {
        self.base_dir.join("index.toml")
    }

    pub fn repos_dir(&self) -> PathBuf {
        self.base_dir.join("repos")
    }

    pub fn settings_path(&self) -> PathBuf {
        self.base_dir.join("settings.toml")
    }

    /// 从 settings.toml 加载配置
    pub fn load_settings(&self) -> Result<Option<(crate::models::SyncMode, std::collections::HashMap<String, String>)>> {
        let path = self.settings_path();
        if !path.exists() {
            return Ok(None);
        }
        let content = std::fs::read_to_string(&path)?;
        let value: toml::Value = toml::from_str(&content).map_err(crate::error::ContextKitError::from)?;

        let mode = value.get("default_sync_mode").and_then(|v| v.as_str()).and_then(|s| match s {
            "reference" => Some(crate::models::SyncMode::Reference),
            "copy" => Some(crate::models::SyncMode::Copy),
            _ => None,
        });

        let agent_dirs = value.get("agent_dirs")
            .and_then(|v| v.as_table())
            .map(|table| {
                table.iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect()
            })
            .unwrap_or_default();

        Ok(mode.map(|m| (m, agent_dirs)))
    }

    /// 保存配置到 settings.toml
    pub fn save_settings(&self, mode: crate::models::SyncMode, agent_dirs: &std::collections::HashMap<String, String>) -> Result<()> {
        let path = self.settings_path();
        let mode_str = match mode {
            crate::models::SyncMode::Reference => "reference",
            crate::models::SyncMode::Copy => "copy",
        };

        let mut content = format!("default_sync_mode = \"{}\"\n", mode_str);

        if !agent_dirs.is_empty() {
            content.push_str("\n[agent_dirs]\n");
            for (k, v) in agent_dirs {
                content.push_str(&format!("{} = \"{}\"\n", k, v.replace('\\', "\\\\").replace('"', "\\\"")));
            }
        }

        std::fs::write(&path, content)?;
        Ok(())
    }

    /// 确保配置目录及必要的子目录存在
    pub fn ensure_dirs(&self) -> Result<()> {
        std::fs::create_dir_all(&self.base_dir)?;
        std::fs::create_dir_all(self.repos_dir())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn new_returns_valid_default_dir() {
        let mgr = ConfigManager::new().unwrap();
        let dir = mgr.config_dir();
        // 验证路径不为空且最后一个组件是 "contextkit"
        assert!(!dir.as_os_str().is_empty());
        assert_eq!(dir.file_name().unwrap(), "contextkit");
    }

    #[test]
    fn with_dir_uses_custom_path() {
        let custom = PathBuf::from("/tmp/test-contextkit");
        let mgr = ConfigManager::with_dir(&custom);
        assert_eq!(mgr.config_dir(), custom.as_path());
    }

    #[test]
    fn subpaths_are_correct() {
        let mgr = ConfigManager::with_dir("/tmp/ck");
        assert_eq!(mgr.index_path(), PathBuf::from("/tmp/ck/index.toml"));
        assert_eq!(mgr.repos_dir(), PathBuf::from("/tmp/ck/repos"));
        assert_eq!(mgr.settings_path(), PathBuf::from("/tmp/ck/settings.toml"));
    }

    #[test]
    fn ensure_dirs_creates_directories() {
        // 使用临时目录
        let temp_dir = env::temp_dir().join(format!("ck-test-{}", std::process::id()));
        let mgr = ConfigManager::with_dir(&temp_dir);

        // 确保目录不存在
        let _ = std::fs::remove_dir_all(&temp_dir);
        assert!(!temp_dir.exists());

        // 创建目录
        mgr.ensure_dirs().unwrap();
        assert!(temp_dir.exists());
        assert!(mgr.repos_dir().exists());

        // 清理
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn ensure_dirs_is_idempotent() {
        let temp_dir = env::temp_dir().join(format!("ck-test-idemp-{}", std::process::id()));
        let mgr = ConfigManager::with_dir(&temp_dir);

        let _ = std::fs::remove_dir_all(&temp_dir);
        mgr.ensure_dirs().unwrap();
        mgr.ensure_dirs().unwrap(); // 第二次调用不应报错
        assert!(temp_dir.exists());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
