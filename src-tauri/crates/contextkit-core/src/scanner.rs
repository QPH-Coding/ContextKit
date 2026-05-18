use crate::error::Result;
use crate::models::{ConfigKind, ConfigSummary, DirNode};
use crate::token::count_tokens_in_file;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

/// 扫描指定目录，返回发现的配置列表
pub fn scan_directory(
    root: &Path,
    source_id: &str,
    source_name: &str,
    ignore_dirs: &[String],
) -> Result<Vec<ConfigSummary>> {
    let mut configs = Vec::new();
    visit_dir(root, root, source_id, source_name, ignore_dirs, &mut configs)?;
    Ok(configs)
}

/// 生成配置 ID：source_id + 路径短 hash
fn make_config_id(source_id: &str, relative_path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    source_id.hash(&mut hasher);
    relative_path.hash(&mut hasher);
    format!("{}:{:08x}", source_id, hasher.finish())
}

fn name_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn dir_name(path: &Path) -> String {
    path.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn relative_path<'a>(root: &Path, full: &'a Path) -> &'a Path {
    full.strip_prefix(root).unwrap_or(full)
}

fn is_ignored(path: &Path, root: &Path, ignore_dirs: &[String]) -> bool {
    let rel = relative_path(root, path)
        .to_string_lossy()
        .replace('\\', "/");
    let dir_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");

    for ignore in ignore_dirs {
        // 相对路径前缀匹配（新语义）
        if rel == *ignore || rel.starts_with(&format!("{}/", ignore)) {
            return true;
        }
        // 目录名精确匹配（向后兼容）
        if ignore == dir_name {
            return true;
        }
    }
    false
}

fn visit_dir(
    root: &Path,
    current: &Path,
    source_id: &str,
    source_name: &str,
    ignore_dirs: &[String],
    configs: &mut Vec<ConfigSummary>,
) -> Result<()> {
    if !current.is_dir() {
        return Ok(());
    }

    // 1. 检查当前目录是否有 SKILL.md → Skill
    let skill_md = current.join("SKILL.md");
    if skill_md.is_file() {
        let rel = relative_path(root, current);
        let token_count = count_tokens_in_file(&skill_md)?;
        configs.push(ConfigSummary {
            id: make_config_id(source_id, rel),
            name: dir_name(current),
            kind: ConfigKind::Skill,
            source_id: source_id.into(),
            source_name: source_name.into(),
            relative_path: rel.into(),
            token_count,
        });
    }

    // 2. 遍历子项
    for entry in std::fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if path.is_dir() {
            if is_ignored(&path, root, ignore_dirs) {
                continue;
            }
            if name_str == "rules" {
                scan_rules_dir(&path, root, source_id, source_name, configs)?;
            } else if name_str == "agents" {
                scan_agents_dir(&path, root, source_id, source_name, configs)?;
            } else {
                visit_dir(root, &path, source_id, source_name, ignore_dirs, configs)?;
            }
        } else if path.is_file() && (name_str == "mcp.json" || name_str == ".mcp.json") {
            let rel = relative_path(root, &path);
            let content = std::fs::read_to_string(&path)?;
            // Parse mcpServers from JSON
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(servers) = json.get("mcpServers").and_then(|v| v.as_object()) {
                    for (server_name, server_config) in servers {
                        let server_json = server_config.to_string();
                        let token_count = crate::token::count_tokens(&server_json)?;
                        configs.push(ConfigSummary {
                            id: make_config_id(source_id, &rel.join(server_name)),
                            name: server_name.clone(),
                            kind: ConfigKind::Mcp,
                            source_id: source_id.into(),
                            source_name: source_name.into(),
                            relative_path: rel.into(),
                            token_count,
                        });
                    }
                }
            }
        }
    }

    Ok(())
}

/// 获取指定路径下的直接子目录列表（懒加载目录树用）
pub fn get_directory_tree(root: &Path, relative_path: &str) -> Result<Vec<DirNode>> {
    let target = if relative_path.is_empty() {
        root.to_path_buf()
    } else {
        let mut path = root.to_path_buf();
        for part in relative_path.split('/') {
            if !part.is_empty() {
                path.push(part);
            }
        }
        path
    };

    eprintln!(
        "[get_directory_tree] root={:?}, relative_path={:?}, target={:?}, is_dir={}",
        root,
        relative_path,
        target,
        target.is_dir()
    );

    if !target.is_dir() {
        eprintln!("[get_directory_tree] target is not a dir, returning empty");
        return Ok(Vec::new());
    }

    let mut nodes = Vec::new();
    let entries = std::fs::read_dir(&target)?;
    eprintln!("[get_directory_tree] read_dir succeeded");
    for entry in entries {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = if relative_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", relative_path, name)
        };
        let has_children = std::fs::read_dir(entry.path())?
            .filter_map(|e| e.ok())
            .any(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false));
        nodes.push(DirNode {
            name,
            relative_path: rel,
            has_children,
        });
    }

    nodes.sort_by(|a, b| a.name.cmp(&b.name));
    eprintln!("[get_directory_tree] found {} nodes", nodes.len());
    for node in &nodes {
        eprintln!("  - {:?}", node);
    }
    Ok(nodes)
}

fn scan_rules_dir(
    dir: &Path,
    root: &Path,
    source_id: &str,
    source_name: &str,
    configs: &mut Vec<ConfigSummary>,
) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            let rel = relative_path(root, &path);
            let token_count = count_tokens_in_file(&path)?;
            configs.push(ConfigSummary {
                id: make_config_id(source_id, rel),
                name: name_from_path(&path),
                kind: ConfigKind::Rule,
                source_id: source_id.into(),
                source_name: source_name.into(),
                relative_path: rel.into(),
                token_count,
            });
        } else if path.is_dir() {
            scan_rules_dir(&path, root, source_id, source_name, configs)?;
        }
    }
    Ok(())
}

fn scan_agents_dir(
    dir: &Path,
    root: &Path,
    source_id: &str,
    source_name: &str,
    configs: &mut Vec<ConfigSummary>,
) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            let rel = relative_path(root, &path);
            let token_count = count_tokens_in_file(&path)?;
            configs.push(ConfigSummary {
                id: make_config_id(source_id, rel),
                name: name_from_path(&path),
                kind: ConfigKind::Agent,
                source_id: source_id.into(),
                source_name: source_name.into(),
                relative_path: rel.into(),
                token_count,
            });
        } else if path.is_dir() {
            scan_agents_dir(&path, root, source_id, source_name, configs)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;
    use std::path::PathBuf;

    fn setup_test_dir(name: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("ck-scanner-test-{}-{}", std::process::id(), name));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn scan_empty_directory() {
        let dir = setup_test_dir("empty");
        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert!(configs.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn scan_finds_skill() {
        let dir = setup_test_dir("skill");
        let skill_dir = dir.join("skills").join("coding-helper");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Coding Helper").unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Skill);
        assert_eq!(configs[0].name, "coding-helper");
        assert!(configs[0].token_count > 0);

        cleanup(&dir);
    }

    #[test]
    fn scan_finds_rule() {
        let dir = setup_test_dir("rule");
        let rules_dir = dir.join("rules");
        fs::create_dir_all(&rules_dir).unwrap();
        fs::write(rules_dir.join("typescript-style.md"), "# TypeScript Rules").unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Rule);
        assert_eq!(configs[0].name, "typescript-style");
        assert!(configs[0].token_count > 0);

        cleanup(&dir);
    }

    #[test]
    fn scan_finds_agent() {
        let dir = setup_test_dir("agent");
        let agents_dir = dir.join("agents");
        fs::create_dir_all(&agents_dir).unwrap();
        fs::write(agents_dir.join("reviewer.md"), "# Reviewer Prompt").unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Agent);
        assert_eq!(configs[0].name, "reviewer");

        cleanup(&dir);
    }

    #[test]
    fn scan_finds_mcp_json() {
        let dir = setup_test_dir("mcp");
        fs::write(dir.join("mcp.json"), r#"{"mcpServers": {"test-server": {"command": "npx"}}}"#).unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Mcp);
        assert_eq!(configs[0].name, "test-server");

        cleanup(&dir);
    }

    #[test]
    fn scan_finds_dot_mcp_json() {
        let dir = setup_test_dir("dot-mcp");
        fs::write(dir.join(".mcp.json"), r#"{"mcpServers": {"test-server": {}}}"#).unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Mcp);
        assert_eq!(configs[0].name, "test-server");

        cleanup(&dir);
    }

    #[test]
    fn scan_finds_multiple_configs() {
        let dir = setup_test_dir("multiple");

        // Skill
        let skill_dir = dir.join("skills").join("coding");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Coding").unwrap();

        // Rule
        let rules_dir = dir.join("rules");
        fs::create_dir_all(&rules_dir).unwrap();
        fs::write(rules_dir.join("style.md"), "# Style").unwrap();

        // Agent
        let agents_dir = dir.join("agents");
        fs::create_dir_all(&agents_dir).unwrap();
        fs::write(agents_dir.join("prompt.md"), "# Prompt").unwrap();

        // MCP
        fs::write(dir.join("mcp.json"), r#"{"mcpServers": {"test-server": {}}}"#).unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 4);

        let kinds: Vec<_> = configs.iter().map(|c| c.kind).collect();
        assert!(kinds.contains(&ConfigKind::Skill));
        assert!(kinds.contains(&ConfigKind::Rule));
        assert!(kinds.contains(&ConfigKind::Agent));
        assert!(kinds.contains(&ConfigKind::Mcp));

        cleanup(&dir);
    }

    #[test]
    fn scan_nested_rules() {
        let dir = setup_test_dir("nested-rules");
        let nested = dir.join("rules").join("frontend");
        fs::create_dir_all(&nested).unwrap();
        fs::write(nested.join("react.md"), "# React Rules").unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Rule);
        assert_eq!(configs[0].name, "react");

        cleanup(&dir);
    }

    #[test]
    fn scan_skill_inside_other_dirs() {
        let dir = setup_test_dir("deep-skill");
        let deep = dir.join("a").join("b").join("c");
        fs::create_dir_all(&deep).unwrap();
        fs::write(deep.join("SKILL.md"), "# Deep Skill").unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].kind, ConfigKind::Skill);
        assert_eq!(configs[0].name, "c");
        let rel_str = configs[0]
            .relative_path
            .to_string_lossy()
            .replace('\\', "/");
        assert!(rel_str.contains("a/b/c"));

        cleanup(&dir);
    }

    #[test]
    fn scan_skips_non_matching_files() {
        let dir = setup_test_dir("skip");
        fs::write(dir.join("README.md"), "# Readme").unwrap();
        fs::write(dir.join("random.txt"), "random").unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert!(configs.is_empty());

        cleanup(&dir);
    }

    #[test]
    fn scan_rules_and_skill_in_same_tree() {
        let dir = setup_test_dir("skill-with-rules");
        // Skill directory that also contains rules
        let skill_dir = dir.join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# My Skill").unwrap();
        let rules_dir = skill_dir.join("rules");
        fs::create_dir_all(&rules_dir).unwrap();
        fs::write(rules_dir.join("sub-rule.md"), "# Sub Rule").unwrap();

        let configs = scan_directory(&dir, "src1", "test", &[]).unwrap();
        assert_eq!(configs.len(), 2);

        let kinds: Vec<_> = configs.iter().map(|c| c.kind).collect();
        assert!(kinds.contains(&ConfigKind::Skill));
        assert!(kinds.contains(&ConfigKind::Rule));

        cleanup(&dir);
    }
}
