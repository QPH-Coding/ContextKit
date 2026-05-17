use std::path::{Path, PathBuf};
use crate::error::{ContextKitError, Result};
use crate::models::{ConfigKind, PathScope};

pub mod registry;

/// 分配机制
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssignmentMechanism {
    Symlink,
    Copy,
    JsonInject,
}

/// Agent 工具抽象
pub trait AgentTool: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn supported_kinds(&self) -> &[ConfigKind];
    fn supports_scope(&self, scope: PathScope) -> bool;
    /// 返回目标文件路径（完整路径）
    ///
    /// `source_path` 用于推导目标文件名（某些 Agent 如 Cursor 项目级 `.cursorrules` 会忽略）
    fn target_path(
        &self,
        kind: ConfigKind,
        scope: PathScope,
        project_dir: Option<&Path>,
        source_path: &Path,
    ) -> Option<PathBuf>;
    fn mechanism(&self, kind: ConfigKind) -> AssignmentMechanism;
}

/// 分配操作管理器
pub struct AssignmentManager;

impl AssignmentManager {
    pub fn new() -> Self {
        Self
    }

    /// 检查目标路径是否已存在（冲突）
    pub fn check_conflict(&self, target: &Path) -> Result<bool> {
        Ok(target.exists())
    }

    /// 执行分配
    ///
    /// - `source_path`: 源配置文件路径
    /// - `target`: 目标文件路径（Symlink/Copy）或目标 MCP 配置文件路径（JsonInject）
    /// - `mechanism`: 分配机制
    pub fn assign(
        &self,
        source_path: &Path,
        target: &Path,
        mechanism: AssignmentMechanism,
    ) -> Result<PathBuf> {
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }

        match mechanism {
            AssignmentMechanism::Symlink => Self::assign_symlink(source_path, target),
            AssignmentMechanism::Copy => Self::assign_copy(source_path, target),
            AssignmentMechanism::JsonInject => Self::assign_json_inject(source_path, target),
        }
    }

    /// 取消分配
    ///
    /// - `target`: 目标文件路径
    /// - `mechanism`: 分配机制
    /// - `server_name`: MCP 取消分配时需要指定 server 名称
    pub fn unassign(
        &self,
        target: &Path,
        mechanism: AssignmentMechanism,
        server_name: Option<&str>,
    ) -> Result<()> {
        match mechanism {
            AssignmentMechanism::Symlink | AssignmentMechanism::Copy => {
                if target.exists() {
                    // 如果是符号链接或普通文件，都删除
                    if target.is_symlink() || target.is_file() {
                        std::fs::remove_file(target)?;
                    } else if target.is_dir() {
                        std::fs::remove_dir_all(target)?;
                    }
                }
                Ok(())
            }
            AssignmentMechanism::JsonInject => {
                let name = server_name.ok_or_else(|| {
                    ContextKitError::InvalidPath("MCP unassign requires server_name".into())
                })?;
                Self::unassign_json_inject(target, name)
            }
        }
    }

    fn assign_symlink(source: &Path, target: &Path) -> Result<PathBuf> {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(source, target)?;
        }
        #[cfg(windows)]
        {
            if std::os::windows::fs::symlink_file(source, target).is_err() {
                return Self::assign_copy(source, target);
            }
        }
        Ok(target.to_path_buf())
    }

    fn assign_copy(source: &Path, target: &Path) -> Result<PathBuf> {
        std::fs::copy(source, target)?;
        Ok(target.to_path_buf())
    }

    fn assign_json_inject(source: &Path, target: &Path) -> Result<PathBuf> {
        let source_content = std::fs::read_to_string(source)?;
        let source_value: serde_json::Value = serde_json::from_str(&source_content)
            .map_err(|e| ContextKitError::AssignmentConflict {
                message: format!("Invalid MCP JSON in source: {e}"),
            })?;

        let mut target_value = if target.exists() {
            let content = std::fs::read_to_string(target)?;
            serde_json::from_str(&content).unwrap_or_else(|_| {
                let mut map = serde_json::Map::new();
                map.insert(
                    "mcpServers".to_string(),
                    serde_json::Value::Object(serde_json::Map::new()),
                );
                serde_json::Value::Object(map)
            })
        } else {
            let mut map = serde_json::Map::new();
            map.insert(
                "mcpServers".to_string(),
                serde_json::Value::Object(serde_json::Map::new()),
            );
            serde_json::Value::Object(map)
        };

        let mcp_servers = target_value
            .get_mut("mcpServers")
            .and_then(|v| v.as_object_mut())
            .ok_or_else(|| ContextKitError::AssignmentConflict {
                message: "Target MCP JSON missing mcpServers".into(),
            })?;

        let server_name = source
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| {
                if s.ends_with(".mcp") {
                    s.trim_end_matches(".mcp").to_string()
                } else {
                    s.to_string()
                }
            })
            .unwrap_or_else(|| "unknown".to_string());

        let server_config = if let Some(servers) =
            source_value.get("mcpServers").and_then(|v| v.as_object())
        {
            servers
                .values()
                .next()
                .cloned()
                .unwrap_or(source_value.clone())
        } else {
            source_value.clone()
        };

        mcp_servers.insert(server_name, server_config);

        std::fs::write(target, serde_json::to_string_pretty(&target_value)?)?;
        Ok(target.to_path_buf())
    }

    fn unassign_json_inject(target: &Path, server_name: &str) -> Result<()> {
        if !target.exists() {
            return Ok(());
        }

        let content = std::fs::read_to_string(target)?;
        let mut value: serde_json::Value = serde_json::from_str(&content).map_err(|e| {
            ContextKitError::AssignmentConflict {
                message: format!("Invalid MCP JSON: {e}"),
            }
        })?;

        if let Some(servers) = value.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
            servers.remove(server_name);
            std::fs::write(target, serde_json::to_string_pretty(&value)?)?;
        }

        Ok(())
    }
}

impl Default for AssignmentManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("ck-agent-test-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn check_conflict_detects_existing_file() {
        let dir = temp_dir("conflict");
        let existing = dir.join("exists.txt");
        fs::write(&existing, "hello").unwrap();

        let mgr = AssignmentManager::new();
        assert!(mgr.check_conflict(&existing).unwrap());
        assert!(!mgr.check_conflict(&dir.join("not-exists.txt")).unwrap());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn assign_symlink_creates_link() {
        let dir = temp_dir("symlink");
        let source = dir.join("source.txt");
        let target = dir.join("link.txt");
        fs::write(&source, "content").unwrap();

        let mgr = AssignmentManager::new();
        let result = mgr.assign(&source, &target, AssignmentMechanism::Symlink);
        assert!(result.is_ok());
        assert!(target.is_symlink());

        // 验证内容可通过链接读取
        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "content");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn assign_copy_copies_file() {
        let dir = temp_dir("copy");
        let source = dir.join("source.txt");
        let target = dir.join("copy.txt");
        fs::write(&source, "content").unwrap();

        let mgr = AssignmentManager::new();
        let result = mgr.assign(&source, &target, AssignmentMechanism::Copy);
        assert!(result.is_ok());
        assert!(target.exists());
        assert!(!target.is_symlink());

        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "content");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn assign_creates_parent_dirs() {
        let dir = temp_dir("mkdir");
        let source = dir.join("source.txt");
        let target = dir.join("deep").join("nested").join("target.txt");
        fs::write(&source, "content").unwrap();

        let mgr = AssignmentManager::new();
        mgr.assign(&source, &target, AssignmentMechanism::Copy).unwrap();
        assert!(target.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn unassign_removes_symlink() {
        let dir = temp_dir("unassign-symlink");
        let source = dir.join("source.txt");
        let target = dir.join("link.txt");
        fs::write(&source, "content").unwrap();

        let mgr = AssignmentManager::new();
        mgr.assign(&source, &target, AssignmentMechanism::Symlink).unwrap();
        assert!(target.exists());

        mgr.unassign(&target, AssignmentMechanism::Symlink, None).unwrap();
        assert!(!target.exists());
        assert!(source.exists()); // 源文件保留

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn unassign_removes_copy() {
        let dir = temp_dir("unassign-copy");
        let source = dir.join("source.txt");
        let target = dir.join("copy.txt");
        fs::write(&source, "content").unwrap();

        let mgr = AssignmentManager::new();
        mgr.assign(&source, &target, AssignmentMechanism::Copy).unwrap();

        mgr.unassign(&target, AssignmentMechanism::Copy, None).unwrap();
        assert!(!target.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn assign_json_inject_creates_mcp_file() {
        let dir = temp_dir("mcp-create");
        let source = dir.join("my-server.mcp.json");
        let target = dir.join("mcp.json");
        fs::write(
            &source,
            r#"{"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"]}"#,
        )
        .unwrap();

        let mgr = AssignmentManager::new();
        mgr.assign(&source, &target, AssignmentMechanism::JsonInject)
            .unwrap();

        assert!(target.exists());
        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("my-server"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn assign_json_inject_merges_existing() {
        let dir = temp_dir("mcp-merge");
        let source = dir.join("new-server.mcp.json");
        let target = dir.join("mcp.json");

        fs::write(
            &target,
            r#"{"mcpServers": {"existing": {"command": "old"}}}"#,
        )
        .unwrap();
        fs::write(&source, r#"{"command": "new"}"#).unwrap();

        let mgr = AssignmentManager::new();
        mgr.assign(&source, &target, AssignmentMechanism::JsonInject)
            .unwrap();

        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("existing"));
        assert!(servers.contains_key("new-server"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn unassign_json_inject_removes_server() {
        let dir = temp_dir("mcp-unassign");
        let target = dir.join("mcp.json");
        fs::write(
            &target,
            r#"{"mcpServers": {"keep": {"command": "a"}, "remove": {"command": "b"}}}"#,
        )
        .unwrap();

        let mgr = AssignmentManager::new();
        mgr.unassign(&target, AssignmentMechanism::JsonInject, Some("remove"))
            .unwrap();

        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("keep"));
        assert!(!servers.contains_key("remove"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn unassign_json_inject_noop_when_file_missing() {
        let dir = temp_dir("mcp-noop");
        let target = dir.join("mcp.json");

        let mgr = AssignmentManager::new();
        mgr.unassign(&target, AssignmentMechanism::JsonInject, Some("missing"))
            .unwrap();

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn assign_json_inject_extracts_from_mcp_servers() {
        let dir = temp_dir("mcp-extract");
        let source = dir.join("fs-server.mcp.json");
        let target = dir.join("mcp.json");
        fs::write(
            &source,
            r#"{"mcpServers": {"filesystem": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"]}}}"#,
        )
        .unwrap();

        let mgr = AssignmentManager::new();
        mgr.assign(&source, &target, AssignmentMechanism::JsonInject)
            .unwrap();

        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        // source 文件名是 fs-server，所以注入的 key 是 fs-server
        assert!(servers.contains_key("fs-server"));
        // 但配置内容应该是从 mcpServers.filesystem 提取的
        let cfg = servers.get("fs-server").unwrap();
        assert_eq!(cfg.get("command").unwrap(), "npx");

        let _ = fs::remove_dir_all(&dir);
    }
}
