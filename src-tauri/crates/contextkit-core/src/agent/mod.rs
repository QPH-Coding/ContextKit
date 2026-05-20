use crate::error::{ContextKitError, Result};
use crate::models::{ConfigKind, PathScope};
use std::path::{Path, PathBuf};

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
    /// 返回 Agent 的默认配置根目录（用于检测和设置页展示）
    fn default_home_dir(&self) -> Option<PathBuf>;

    /// 是否支持安装该 kind
    fn can_install(&self, kind: ConfigKind) -> bool {
        self.supported_kinds().contains(&kind)
    }

    /// 执行安装（默认实现包含通用逻辑，Agent 可覆盖）
    fn install(&self, source: &Path, target: &Path, kind: ConfigKind, server_name: Option<&str>) -> Result<PathBuf> {
        match self.mechanism(kind) {
            AssignmentMechanism::Symlink | AssignmentMechanism::Copy => {
                ops_assign(source, target, self.mechanism(kind))
            }
            AssignmentMechanism::JsonInject => {
                let content = std::fs::read_to_string(source)?;
                let value: serde_json::Value = serde_json::from_str(&content).map_err(|e| {
                    ContextKitError::AssignmentConflict {
                        message: format!("Invalid MCP JSON in source: {e}"),
                    }
                })?;

                let name = server_name.map(|s| s.to_string()).unwrap_or_else(|| {
                    source
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .map(|s| {
                            if s.ends_with(".mcp") {
                                s.trim_end_matches(".mcp").to_string()
                            } else {
                                s.to_string()
                            }
                        })
                        .unwrap_or_else(|| "unknown".to_string())
                });

                let config = if let Some(servers) = value.get("mcpServers").and_then(|v| v.as_object()) {
                    if let Some(sn) = server_name {
                        servers.get(sn).cloned().unwrap_or(value.clone())
                    } else {
                        servers.values().next().cloned().unwrap_or(value.clone())
                    }
                } else {
                    value.clone()
                };

                ops_assign_json_server_value(target, &name, config)
            }
        }
    }

    /// 执行卸载（默认实现包含通用逻辑，Agent 可覆盖）
    fn uninstall(&self, target: &Path, kind: ConfigKind, server_name: Option<&str>) -> Result<()> {
        ops_unassign(target, self.mechanism(kind), server_name)
    }
}

// === 通用文件操作（模块级私有函数，不再通过 AssignmentManager 中转） ===

pub(crate) fn ops_assign(source_path: &Path, target: &Path, mechanism: AssignmentMechanism) -> Result<PathBuf> {
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    match mechanism {
        AssignmentMechanism::Symlink => ops_assign_symlink(source_path, target),
        AssignmentMechanism::Copy => ops_assign_copy(source_path, target),
        AssignmentMechanism::JsonInject => ops_assign_json_inject(source_path, target),
    }
}

pub(crate) fn ops_assign_symlink(source: &Path, target: &Path) -> Result<PathBuf> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(source, target)?;
    }
    #[cfg(windows)]
    {
        if source.is_dir() {
            if std::os::windows::fs::symlink_dir(source, target).is_err() {
                return ops_assign_copy(source, target);
            }
        } else {
            if std::os::windows::fs::symlink_file(source, target).is_err() {
                return ops_assign_copy(source, target);
            }
        }
    }
    Ok(target.to_path_buf())
}

pub(crate) fn ops_assign_copy(source: &Path, target: &Path) -> Result<PathBuf> {
    if source.is_dir() {
        ops_copy_dir_all(source, target)?;
    } else {
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(source, target)?;
    }
    Ok(target.to_path_buf())
}

pub(crate) fn ops_copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            ops_copy_dir_all(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

pub(crate) fn ops_assign_json_inject(source: &Path, target: &Path) -> Result<PathBuf> {
    let source_content = std::fs::read_to_string(source)?;
    let source_value: serde_json::Value =
        serde_json::from_str(&source_content).map_err(|e| {
            ContextKitError::AssignmentConflict {
                message: format!("Invalid MCP JSON in source: {e}"),
            }
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

    let server_config =
        if let Some(servers) = source_value.get("mcpServers").and_then(|v| v.as_object()) {
            servers
                .values()
                .next()
                .cloned()
                .unwrap_or(source_value.clone())
        } else {
            source_value.clone()
        };

    ops_assign_json_server_value(target, &server_name, server_config)
}

pub(crate) fn ops_assign_json_server_value(
    target: &Path,
    server_name: &str,
    server_config: serde_json::Value,
) -> Result<PathBuf> {
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut target_value = if target.exists() {
        let content = std::fs::read_to_string(target)?;
        serde_json::from_str(&content).map_err(|e| ContextKitError::AssignmentConflict {
            message: format!("Invalid MCP JSON in target: {e}"),
        })?
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

    if mcp_servers.contains_key(server_name) {
        return Err(ContextKitError::AssignmentConflict {
            message: format!("MCP server already exists: {server_name}"),
        });
    }

    mcp_servers.insert(server_name.to_string(), server_config);

    std::fs::write(target, serde_json::to_string_pretty(&target_value)?)?;
    Ok(target.to_path_buf())
}

pub(crate) fn ops_unassign(target: &Path, mechanism: AssignmentMechanism, server_name: Option<&str>) -> Result<()> {
    match mechanism {
        AssignmentMechanism::Symlink | AssignmentMechanism::Copy => {
            if target.exists() {
                if target.is_symlink() {
                    if std::fs::remove_file(target).is_err() {
                        let _ = std::fs::remove_dir(target);
                    }
                } else if target.is_file() {
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
            ops_unassign_json_inject(target, name)
        }
    }
}

pub(crate) fn ops_unassign_json_inject(target: &Path, server_name: &str) -> Result<()> {
    if !target.exists() {
        return Ok(());
    }

    let content = std::fs::read_to_string(target)?;
    let mut value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| ContextKitError::AssignmentConflict {
            message: format!("Invalid MCP JSON: {e}"),
        })?;

    if let Some(servers) = value.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        servers.remove(server_name);
        std::fs::write(target, serde_json::to_string_pretty(&value)?)?;
    }

    Ok(())
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
    fn ops_assign_symlink_creates_link() {
        let dir = temp_dir("symlink");
        let source = dir.join("source.txt");
        let target = dir.join("link.txt");
        fs::write(&source, "content").unwrap();

        let result = ops_assign(&source, &target, AssignmentMechanism::Symlink);
        assert!(result.is_ok());
        assert!(target.is_symlink());

        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "content");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_assign_copy_copies_file() {
        let dir = temp_dir("copy");
        let source = dir.join("source.txt");
        let target = dir.join("copy.txt");
        fs::write(&source, "content").unwrap();

        let result = ops_assign(&source, &target, AssignmentMechanism::Copy);
        assert!(result.is_ok());
        assert!(target.exists());
        assert!(!target.is_symlink());

        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "content");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_assign_creates_parent_dirs() {
        let dir = temp_dir("mkdir");
        let source = dir.join("source.txt");
        let target = dir.join("deep").join("nested").join("target.txt");
        fs::write(&source, "content").unwrap();

        ops_assign(&source, &target, AssignmentMechanism::Copy).unwrap();
        assert!(target.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_unassign_removes_symlink() {
        let dir = temp_dir("unassign-symlink");
        let source = dir.join("source.txt");
        let target = dir.join("link.txt");
        fs::write(&source, "content").unwrap();

        ops_assign(&source, &target, AssignmentMechanism::Symlink).unwrap();
        assert!(target.exists());

        ops_unassign(&target, AssignmentMechanism::Symlink, None).unwrap();
        assert!(!target.exists());
        assert!(source.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_unassign_removes_copy() {
        let dir = temp_dir("unassign-copy");
        let source = dir.join("source.txt");
        let target = dir.join("copy.txt");
        fs::write(&source, "content").unwrap();

        ops_assign(&source, &target, AssignmentMechanism::Copy).unwrap();

        ops_unassign(&target, AssignmentMechanism::Copy, None).unwrap();
        assert!(!target.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_assign_json_inject_creates_mcp_file() {
        let dir = temp_dir("mcp-create");
        let source = dir.join("my-server.mcp.json");
        let target = dir.join("mcp.json");
        fs::write(
            &source,
            r#"{"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"]}"#,
        )
        .unwrap();

        ops_assign(&source, &target, AssignmentMechanism::JsonInject).unwrap();

        assert!(target.exists());
        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("my-server"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_assign_json_inject_merges_existing() {
        let dir = temp_dir("mcp-merge");
        let source = dir.join("new-server.mcp.json");
        let target = dir.join("mcp.json");

        fs::write(
            &target,
            r#"{"mcpServers": {"existing": {"command": "old"}}}"#,
        )
        .unwrap();
        fs::write(&source, r#"{"command": "new"}"#).unwrap();

        ops_assign(&source, &target, AssignmentMechanism::JsonInject).unwrap();

        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("existing"));
        assert!(servers.contains_key("new-server"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_assign_json_inject_rejects_duplicate_server() {
        let dir = temp_dir("mcp-duplicate");
        let source = dir.join("existing.mcp.json");
        let target = dir.join("mcp.json");

        fs::write(
            &target,
            r#"{"mcpServers": {"existing": {"command": "old"}}}"#,
        )
        .unwrap();
        fs::write(&source, r#"{"command": "new"}"#).unwrap();

        let result = ops_assign(&source, &target, AssignmentMechanism::JsonInject);

        assert!(matches!(
            result,
            Err(ContextKitError::AssignmentConflict { .. })
        ));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_unassign_json_inject_removes_server() {
        let dir = temp_dir("mcp-unassign");
        let target = dir.join("mcp.json");
        fs::write(
            &target,
            r#"{"mcpServers": {"keep": {"command": "a"}, "remove": {"command": "b"}}}"#,
        )
        .unwrap();

        ops_unassign(&target, AssignmentMechanism::JsonInject, Some("remove")).unwrap();

        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("keep"));
        assert!(!servers.contains_key("remove"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_unassign_json_inject_noop_when_file_missing() {
        let dir = temp_dir("mcp-noop");
        let target = dir.join("mcp.json");

        ops_unassign(&target, AssignmentMechanism::JsonInject, Some("missing")).unwrap();

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ops_assign_json_inject_extracts_from_mcp_servers() {
        let dir = temp_dir("mcp-extract");
        let source = dir.join("fs-server.mcp.json");
        let target = dir.join("mcp.json");
        fs::write(
            &source,
            r#"{"mcpServers": {"filesystem": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"]}}}"#,
        )
        .unwrap();

        ops_assign(&source, &target, AssignmentMechanism::JsonInject).unwrap();

        let content = fs::read_to_string(&target).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let servers = json.get("mcpServers").unwrap().as_object().unwrap();
        assert!(servers.contains_key("fs-server"));
        let cfg = servers.get("fs-server").unwrap();
        assert_eq!(cfg.get("command").unwrap(), "npx");

        let _ = fs::remove_dir_all(&dir);
    }
}
