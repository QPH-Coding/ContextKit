use std::path::Path;
use std::process::Command;
use crate::error::{ContextKitError, Result};

/// 克隆 Git 仓库到指定目录
pub fn clone_repo(url: &str, dest: &Path) -> Result<()> {
    let output = Command::new("git")
        .args(["clone", url, &dest.to_string_lossy()])
        .output()
        .map_err(|e| ContextKitError::GitError {
            message: format!("Failed to execute git clone: {e}"),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ContextKitError::GitError {
            message: format!("git clone failed: {stderr}"),
        });
    }
    Ok(())
}

/// 在已有仓库上执行 git pull
pub fn pull_repo(dest: &Path) -> Result<()> {
    let output = Command::new("git")
        .args(["-C", &dest.to_string_lossy(), "pull"])
        .output()
        .map_err(|e| ContextKitError::GitError {
            message: format!("Failed to execute git pull: {e}"),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ContextKitError::GitError {
            message: format!("git pull failed: {stderr}"),
        });
    }
    Ok(())
}

/// 检查远程是否有更新（不修改本地）
pub fn has_updates(dest: &Path) -> Result<bool> {
    // fetch 远程信息
    let fetch_output = Command::new("git")
        .args(["-C", &dest.to_string_lossy(), "fetch", "--dry-run"])
        .output()
        .map_err(|e| ContextKitError::GitError {
            message: format!("Failed to execute git fetch: {e}"),
        })?;

    // git fetch --dry-run 如果有更新会输出到 stderr
    let stderr = String::from_utf8_lossy(&fetch_output.stderr);
    Ok(stderr.contains("->"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn temp_git_dir(name: &str) -> std::path::PathBuf {
        env::temp_dir().join(format!("ck-git-test-{}-{}", std::process::id(), name))
    }

    fn cleanup(path: &std::path::Path) {
        let _ = fs::remove_dir_all(path);
    }

    /// 创建一个本地 bare 仓库用于测试
    fn create_bare_repo(path: &std::path::Path) {
        let _ = fs::remove_dir_all(path);
        let output = Command::new("git")
            .args(["init", "--bare", &path.to_string_lossy()])
            .output()
            .expect("git init --bare should work");
        assert!(output.status.success(), "Failed to create bare repo");
    }

    /// 向 bare 仓库推送一个提交（通过临时工作区）
    fn push_commit_to_bare(bare_path: &std::path::Path, content: &str) {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let work_dir = env::temp_dir().join(format!("ck-git-work-{unique}"));
        let _ = fs::remove_dir_all(&work_dir);

        // clone bare repo
        let out = Command::new("git")
            .args(["clone", &bare_path.to_string_lossy(), &work_dir.to_string_lossy()])
            .output()
            .unwrap();
        assert!(out.status.success());

        // config
        for cmd in [
            vec!["-C", &work_dir.to_string_lossy(), "config", "user.email", "test@test.com"],
            vec!["-C", &work_dir.to_string_lossy(), "config", "user.name", "Test"],
        ] {
            let out = Command::new("git").args(&cmd).output().unwrap();
            assert!(out.status.success());
        }

        // commit
        fs::write(work_dir.join("README.md"), content).unwrap();
        let out = Command::new("git")
            .args(["-C", &work_dir.to_string_lossy(), "add", "."])
            .output()
            .unwrap();
        assert!(out.status.success());

        let out = Command::new("git")
            .args(["-C", &work_dir.to_string_lossy(), "commit", "-m", content])
            .output()
            .unwrap();
        assert!(out.status.success(), "commit failed: {}", String::from_utf8_lossy(&out.stderr));

        // push
        let out = Command::new("git")
            .args(["-C", &work_dir.to_string_lossy(), "push", "origin", "HEAD"])
            .output()
            .unwrap();
        assert!(out.status.success(), "push failed: {}", String::from_utf8_lossy(&out.stderr));

        let _ = fs::remove_dir_all(&work_dir);
    }

    #[test]
    fn git_clone_creates_directory() {
        let bare = temp_git_dir("bare-clone");
        create_bare_repo(&bare);
        push_commit_to_bare(&bare, "initial");

        let dest = temp_git_dir("dest-clone");
        cleanup(&dest);

        clone_repo(&bare.to_string_lossy(), &dest).unwrap();
        assert!(dest.exists());
        assert!(dest.join(".git").exists());
        assert!(dest.join("README.md").exists());

        cleanup(&bare);
        cleanup(&dest);
    }

    #[test]
    fn git_clone_fails_on_invalid_url() {
        let dest = temp_git_dir("dest-invalid");
        cleanup(&dest);

        let result = clone_repo("https://invalid-url-that-does-not-exist.example.com/repo.git", &dest);
        assert!(result.is_err());

        cleanup(&dest);
    }

    #[test]
    fn git_pull_updates_repo() {
        let bare = temp_git_dir("bare-pull");
        create_bare_repo(&bare);
        push_commit_to_bare(&bare, "v1");

        let dest = temp_git_dir("dest-pull");
        cleanup(&dest);
        clone_repo(&bare.to_string_lossy(), &dest).unwrap();

        // 推送新提交到 bare
        push_commit_to_bare(&bare, "v2");

        // pull 更新
        pull_repo(&dest).unwrap();

        let content = fs::read_to_string(dest.join("README.md")).unwrap();
        assert!(content.contains("v2"));

        cleanup(&bare);
        cleanup(&dest);
    }

    #[test]
    fn git_has_updates_detects_new_commits() {
        let bare = temp_git_dir("bare-updates");
        create_bare_repo(&bare);
        push_commit_to_bare(&bare, "v1");

        let dest = temp_git_dir("dest-updates");
        cleanup(&dest);
        clone_repo(&bare.to_string_lossy(), &dest).unwrap();

        // 刚克隆完，没有更新
        let has = has_updates(&dest).unwrap();
        assert!(!has);

        // 推送新提交
        push_commit_to_bare(&bare, "v2");

        // 现在有更新
        let has = has_updates(&dest).unwrap();
        assert!(has);

        // pull 后更新消失
        pull_repo(&dest).unwrap();
        let has = has_updates(&dest).unwrap();
        assert!(!has);

        cleanup(&bare);
        cleanup(&dest);
    }
}
