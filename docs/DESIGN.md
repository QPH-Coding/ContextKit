# ContextKit 设计方案

> 本文档沉淀 ContextKit 的技术方案与架构决策。
> 技术栈：Tauri 2.0 + TypeScript + React + Rust
> 目标：管理本地 Skill、Rule、Agent Prompt、MCP 配置，支持 GUI + CLI + TUI

---

## 1. 项目概述

ContextKit 是一个**本地配置聚合与管理工具**，核心能力：

1. **发现**：扫描 Git 仓库或本地目录，自动识别其中的 Skill、Rule、Agent Prompt、MCP 配置
2. **浏览**：统一视图查看所有发现的配置，支持搜索、过滤、元数据展示
3. **管理**：将配置"分配/启用"给不同的 Agent 工具（Claude Code、Codex、Cursor、Kimi、CodeBuddy 等）
4. **洞察**：Dashboard 展示各 Agent 工具已启用的配置及 Token 占用情况

### 1.1 核心定位

- **聚合者模式为主**：不定义新的配置格式，而是发现和管理外部已有生态的配置
- **管理自己配置的**：ContextKit 只管理从 Source 扫描到的配置，不碰 Agent 工具自带的原有配置
- **只读浏览**：详情页为只读，ContextKit 不做编辑器
- **用户不直接编辑存储文件**：所有操作通过 GUI/CLI 完成

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | GUI 界面 |
| 包管理器 | Bun | 前端依赖统一使用 `bun` |
| UI 组件 | shadcn/ui + Tailwind CSS | 组件库 + 样式 |
| 状态管理 | TanStack Query | 处理异步数据获取与缓存 |
| 后端核心 | Rust | 业务逻辑、文件系统、Git 操作 |
| GUI 框架 | Tauri 2.0 | 桌面应用壳 |
| CLI/TUI | Rust | 独立的命令行/终端界面（规划中） |
| 存储格式 | TOML | 索引与配置持久化 |
| Token 计算 | tiktoken-rs | 精确的 Token 计数 |

---

## 3. 架构设计

### 3.1 Workspace 多 Crate 结构

```
src-tauri/
├── Cargo.toml                  # Workspace root
├── crates/
│   ├── contextkit-core/        # 纯 Rust 库，所有业务逻辑
│   │   ├── src/
│   │   │   ├── lib.rs          # 公开 API
│   │   │   ├── models.rs       # 共享数据结构
│   │   │   ├── config.rs       # 全局配置管理
│   │   │   ├── error.rs        # 统一错误类型
│   │   │   ├── index.rs        # TOML 索引读写
│   │   │   ├── scanner.rs      # 扫描逻辑（发现配置）
│   │   │   ├── source/         # Source 管理
│   │   │   │   ├── mod.rs
│   │   │   │   ├── git.rs      # Git clone/pull/fetch
│   │   │   │   └── local.rs    # 本地路径验证
│   │   │   ├── agent/          # Agent 工具配置管理
│   │   │   │   ├── mod.rs
│   │   │   │   ├── cursor.rs
│   │   │   │   ├── claude_code.rs
│   │   │   │   ├── codex.rs
│   │   │   │   ├── kimi.rs
│   │   │   │   ├── codebuddy.rs
│   │   │   │   └── registry.rs # Agent 工具注册表
│   │   │   └── token.rs        # Token 计算
│   │   └── Cargo.toml
│   ├── contextkit-gui/         # Tauri 应用
│   │   ├── src/
│   │   │   ├── main.rs         # GUI binary
│   │   │   └── commands.rs     # Tauri Commands（thin wrapper）
│   │   └── Cargo.toml
│   ├── contextkit-cli/         # CLI 应用（预留）
│   │   ├── src/
│   │   │   └── main.rs
│   │   └── Cargo.toml
│   └── contextkit-tui/         # TUI 应用（预留）
│       ├── src/
│       │   └── main.rs
│       └── Cargo.toml
```

### 3.2 职责边界

| 模块 | 职责 |
|------|------|
| `contextkit-core` | 所有业务逻辑：Source 管理、Git 操作、目录扫描、索引读写、Agent 工具配置映射、Token 计算 |
| `contextkit-gui` | Tauri 应用壳，Commands 转发到 Core，启动 WebView |
| `contextkit-cli` | 命令行参数解析，调用 Core API，输出格式化（预留） |
| `contextkit-tui` | ratatui 交互界面，调用 Core API（预留） |

### 3.3 数据流

```
前端 (React) 
    ↓ invoke Tauri Command
contextkit-gui/commands.rs
    ↓ 调用
contextkit-core/lib.rs (公开 API)
    ↓ 调用
contextkit-core/{source,scanner,index,agent,token}/
    ↓ 读写
文件系统 (~/.config/contextkit/)
```

---

## 4. 数据模型

### 4.1 核心类型

```rust
// models.rs

/// Source 类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SourceType {
    Git { url: String, branch: String },
    Local { path: PathBuf },
}

/// Source（配置来源）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub id: String,              // 短 hash，如 "a1b2c3d4"
    pub name: String,
    pub source_type: SourceType,
    pub local_path: PathBuf,     // 内部缓存路径（git）或原始路径（local）
    pub mode: SyncMode,          // reference | copy
    pub last_scan_at: Option<DateTime<Utc>>,
    pub config_count: usize,
}

/// 同步模式
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SyncMode {
    Reference,  // 符号链接/引用原文件
    Copy,       // 复制文件内容
}

/// 配置项类型
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ConfigKind {
    Skill,
    Rule,
    Agent,
    Mcp,
}

/// 配置项摘要（列表展示用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSummary {
    pub id: String,              // "{source_id}:{relative_path_hash}"
    pub name: String,
    pub kind: ConfigKind,
    pub source_id: String,
    pub source_name: String,
    pub relative_path: PathBuf,
    pub token_count: usize,
}

/// 配置项详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigDetail {
    pub id: String,
    pub name: String,
    pub kind: ConfigKind,
    pub source_id: String,
    pub source_name: String,
    pub relative_path: PathBuf,
    pub absolute_path: PathBuf,
    pub token_count: usize,
    pub content: String,         // 原始文件内容（预览用）
    pub assigned_agents: Vec<String>, // 已分配给哪些 Agent 工具
}

/// Agent 工具定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTool {
    pub id: String,              // "cursor", "claude_code", "codex", "kimi", "codebuddy"
    pub name: String,
    pub config_paths: Vec<AgentConfigPath>, // 支持的用户级/项目级路径
    pub supports_custom_path: bool,         // 是否支持用户自定义配置目录
}

/// Agent 工具的配置路径映射
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfigPath {
    pub kind: ConfigKind,        // 该路径下存放什么类型的配置
    pub scope: PathScope,        // User / Project
    pub path_template: String,   // 路径模板，如 "~/.cursor/rules/"
    pub mechanism: AssignmentMechanism,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PathScope {
    User,      // 用户级，全局生效
    Project,   // 项目级，需指定项目路径
}

/// 分配机制
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AssignmentMechanism {
    Symlink,       // 符号链接（Skill/Rule/Agent）
    Copy,          // 文件复制（fallback）
    JsonInject,    // JSON 注入（MCP）
}

/// 全局设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub config_dir: PathBuf,              // 默认 ~/.config/contextkit/
    pub default_sync_mode: SyncMode,      // 默认引用模式
    pub agent_tools: Vec<AgentTool>,      // 启用的 Agent 工具列表
}

/// Dashboard 统计数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub source_count: usize,
    pub total_configs: usize,
    pub configs_by_kind: HashMap<ConfigKind, usize>,
    pub configs_by_agent: HashMap<String, usize>,  // Agent ID -> 已分配配置数
    pub total_tokens: usize,
    pub tokens_by_agent: HashMap<String, usize>,
    pub tokens_by_kind: HashMap<ConfigKind, usize>,
}
```

### 4.2 TOML 索引 Schema

索引文件位置：`~/.config/contextkit/index.toml`

```toml
version = 1

[settings]
config_dir = "~/.config/contextkit"
default_sync_mode = "reference"

[[sources]]
id = "a1b2c3d4"
name = "my-ai-skills"
type = "git"
url = "https://github.com/user/skills.git"
branch = "main"
local_path = "~/.config/contextkit/repos/a1b2c3d4"
mode = "reference"
last_scan_at = "2026-05-15T10:00:00Z"
config_count = 5

[[sources.configs]]
id = "skill-001"
kind = "skill"
name = "coding-helper"
relative_path = "skills/coding-helper/SKILL.md"
token_count = 128

[[sources.configs]]
id = "rule-001"
kind = "rule"
name = "typescript-style"
relative_path = "rules/typescript-style.md"
token_count = 256

# 分配记录：哪些配置分配给了哪些 Agent 工具
[[assignments]]
config_id = "skill-001"
agent_id = "cursor"
scope = "user"
# project_path = "..."  # scope 为 project 时必填
assigned_at = "2026-05-15T11:00:00Z"
```

---

## 5. 扫描与发现机制

### 5.1 扫描策略

- **递归扫描**整个 Source 目录树
- **约定路径匹配**为主，识别四类配置：

| 类型 | 识别规则 |
|------|----------|
| **Skill** | 包含 `SKILL.md` 文件的父目录 |
| **Rule** | `rules/` 目录下的任意文件 |
| **Agent** | `agents/` 目录下的任意文件 |
| **MCP** | 名为 `mcp.json` 或 `.mcp.json` 的文件 |

- 遇到子模块（`.gitmodules`）跳过或按配置处理

### 5.2 Source 类型

| 类型 | 行为 |
|------|------|
| **Git** | `git clone` 到内部缓存目录 `~/.config/contextkit/repos/{id}/`，支持手动刷新（`git pull`） |
| **Local** | 直接使用给定路径，不做文件操作 |

### 5.3 更新机制

- **懒扫描**：打开 GUI 或调用 `list_configs` 时检查 `last_scan_at`，超时则重新扫描
- **手动刷新**：用户点击刷新按钮，触发全量重新扫描 + git pull（Git 源）
- **启动时不自动 pull**：避免网络阻塞和意外变更

### 5.4 Token 计算

- 使用 `tiktoken-rs` 精确计算
- 扫描时预计算并缓存到索引（`token_count` 字段）
- Dashboard 汇总展示各 Agent 工具、各类型的 Token 占用

---

## 6. 启用/分配机制（核心功能）

### 6.1 机制总览

用户在 GUI 中勾选"将此配置分配给 Cursor"，ContextKit 执行：

| 配置类型 | 机制 | 说明 |
|----------|------|------|
| **Skill / Rule / Agent** | `Symlink` 为主，`Copy` 为 fallback | 在 Agent 工具的配置目录创建符号链接指向 Source 文件；Windows 权限不足时 fallback 为复制 |
| **MCP** | `JsonInject` | 解析 Agent 工具的 MCP 配置文件，将 MCP 配置注入到 `mcpServers` 字段 |

### 6.2 分配范围

- **用户级（User）**：配置在用户级目录生效，全局可用
- **项目级（Project）**：配置仅在指定项目路径下生效

### 6.3 冲突处理

- Skill/Rule/Agent：目标目录存在同名文件时，**告警并由用户选择**（跳过/覆盖/重命名）
- MCP：JSON 注入时若存在同名 server，**提示并允许覆盖**

### 6.4 取消启用

- 删除 Agent 工具目录中的符号链接或复制的文件
- MCP 时从 JSON 中移除对应的 server 配置
- 索引中的 `assignments` 记录同步移除

### 6.5 支持的 Agent 工具（第一版）

| Agent 工具 | 用户级路径 | 项目级路径 | 支持类型 | 机制 |
|------------|-----------|-----------|----------|------|
| **Claude Code** | `~/.claude/` | `.claude/` | Skill/Rule/Agent | Symlink |
| **Codex** | `~/.codex/` | `.codex/` | Skill/Rule/Agent | Symlink |
| **Cursor** | `~/.cursor/rules/` | `.cursorrules` | Rule | Symlink |
| **Kimi** | `~/.kimi/skills/` | - | Skill | Symlink |
| **CodeBuddy** | 用户自定义 | 用户自定义 | Skill/Rule/Agent | Symlink |

**MCP 支持**：

| Agent 工具 | MCP 配置文件路径 | 机制 |
|------------|-----------------|------|
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)<br>`%APPDATA%\Claude\claude_desktop_config.json` (Windows) | JsonInject |
| **Cursor** | `~/.cursor/mcp.json` | JsonInject |
| **其他支持 MCP 的客户端** | 用户自定义路径 | JsonInject |

> **注**：所有 Agent 工具均支持用户自定义配置目录。

---

## 7. 前端设计

### 7.1 页面路由

```tsx
/                      → Dashboard（总览统计）
/sources               → Source 列表/管理
/sources/:id           → Source 详情（该源下的配置）
/skills                → Skill 列表
/skills/:id            → Skill 详情（侧边抽屉）
/rules                 → Rule 列表
/rules/:id             → Rule 详情（侧边抽屉）
/agents                → Agent Prompt 列表
/agents/:id            → Agent Prompt 详情（侧边抽屉）
/mcp                   → MCP 列表
/mcp/:id               → MCP 详情（侧边抽屉）
/settings              → 全局设置
```

### 7.2 Dashboard 内容

- 各类型配置数量卡片（Skill / Rule / Agent / MCP）
- 各 Agent 工具已启用的配置数量及 Token 占用
- Source 数量及最后扫描时间
- 快捷操作：添加 Source、全局搜索

### 7.3 列表页字段

- 名称
- 所属 Source
- 类型标签（Skill / Rule / Agent / MCP）
- 相对文件路径
- Token 数量
- 操作按钮（查看详情、分配给 Agent）

### 7.4 详情视图

- **侧边抽屉**（Slide-over Panel）
- 桌面端：右侧滑出，左侧列表保留，可快速切换
- 移动端：全屏详情
- 内容：元数据 + 原始文件内容预览（只读）+ 已分配的 Agent 工具列表

### 7.5 全局搜索

- 顶部 NavBar 放置全局搜索框
- 搜索范围：已索引的所有配置（名称、路径、内容）
- 搜索结果按类型分组展示

### 7.6 状态管理

- **TanStack Query** 管理服务端状态（调用 Tauri Commands）
- `useQuery` 获取列表数据
- `useMutation` 处理添加 Source、分配配置等操作
- `invalidateQueries` 触发重新获取

---

## 8. Tauri Commands API

```rust
// === Source 管理 ===
#[tauri::command]
async fn add_source(url_or_path: String, name: Option<String>) -> Result<Source, Error>;

#[tauri::command]
async fn remove_source(id: String) -> Result<(), Error>;

#[tauri::command]
async fn list_sources() -> Result<Vec<Source>, Error>;

#[tauri::command]
async fn sync_source(id: String) -> Result<ScanResult, Error>;

// === 配置查询 ===
#[tauri::command]
fn list_configs(kind: Option<ConfigKind>, source_id: Option<String>) -> Result<Vec<ConfigSummary>, Error>;

#[tauri::command]
fn get_config(id: String) -> Result<ConfigDetail, Error>;

// === 分配管理 ===
#[tauri::command]
fn assign_config(config_id: String, agent_id: String, scope: PathScope, project_path: Option<String>) -> Result<(), Error>;

#[tauri::command]
fn unassign_config(config_id: String, agent_id: String) -> Result<(), Error>;

#[tauri::command]
fn list_assignments(config_id: Option<String>, agent_id: Option<String>) -> Result<Vec<Assignment>, Error>;

// === 全局 ===
#[tauri::command]
fn get_stats() -> Result<Stats, Error>;

#[tauri::command]
fn get_settings() -> Result<Settings, Error>;

#[tauri::command]
fn update_settings(settings: Settings) -> Result<(), Error>;
```

---

## 9. CLI / TUI 规划（预留）

### 9.1 CLI（`ck` 命令）

```bash
# Source 管理
ck source add <path-or-url> [--name <name>] [--mode reference|copy]
ck source list
ck source remove <id>
ck source sync <id>

# 配置查询
ck list [skill|rule|agent|mcp] [--source <id>] [--format table|json]
ck show <id>
ck cat <id>

# 分配管理
ck assign <config-id> <agent-id> [--project <path>]
ck unassign <config-id> <agent-id>

# 全局
ck sync
ck init
ck info
```

- 支持 `--output json` 结构化输出（自动化脚本）
- 默认友好人类可读输出

### 9.2 TUI（`ck-tui` 命令）

- **ratatui** 混合式界面
- 左侧导航面板，右侧详情面板
- 支持键盘导航（Vim 风格 hjkl）

### 9.3 状态一致性

- CLI / TUI / GUI 三端共享同一套 `contextkit-core`
- 索引文件（TOML）作为单一数据源
- 任意一端修改后，其他端通过文件读取感知变更

---

## 10. 错误处理策略

- **Rust 侧**：使用 `thiserror` 定义统一错误类型，Tauri Commands 返回 `Result<T, Error>`
- **前端侧**：Tauri 默认异常抛出机制，`try/catch` 捕获错误
- **Git 操作失败**：报错透传，GUI 显示详细错误信息
- **文件冲突**：交互式让用户决策（GUI 弹窗，CLI 提示）

---

## 11. 待决策 / 待实现事项

| 事项 | 状态 | 说明 |
|------|------|------|
| Workspace 多 Crate 改造 | 待实现 | 将现有单 Crate 模板改造为 Workspace |
| shadcn/ui + Tailwind 初始化 | 待实现 | 前端依赖安装与配置 |
| TanStack Query 集成 | 待实现 | 前端数据获取层 |
| Core 数据模型实现 | 待实现 | `models.rs` + `error.rs` |
| TOML 索引读写 | 待实现 | `index.rs` |
| 扫描器实现 | 待实现 | `scanner.rs`（约定路径匹配） |
| Git 操作封装 | 待实现 | `source/git.rs`（`git2` crate 或命令行调用） |
| Token 计算 | 待实现 | `token.rs`（`tiktoken-rs`） |
| Agent 工具注册表 | 待实现 | `agent/registry.rs` + 各工具模块 |
| Tauri Commands | 待实现 | `contextkit-gui/commands.rs` |
| 前端页面框架 | 待实现 | Dashboard / Sources / Configs / Settings |
| CLI 实现 | 预留 | `contextkit-cli` crate |
| TUI 实现 | 预留 | `contextkit-tui` crate（`ratatui`） |
| Windows 路径适配 | 已记录 | 使用 `dirs` crate 处理跨平台路径 |
| 更多 Agent 工具 | 后续扩展 | Copilot、Cline、Windsurf 等 |

---

## 12. 关键设计决策汇总

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 存储格式 | TOML | 用户不直接编辑，TOML 结构化且 Rust 生态支持好 |
| 存储引擎 | 文件系统（TOML） | MVP 阶段够用，后期可迁移 SQLite |
| 同步模式 | 默认引用（符号链接），可选复制 | 减少冗余，更新即时生效 |
| Source 类型 | Git（内部缓存）+ Local | Git 源为主，本地源辅助调试 |
| 更新机制 | 懒扫描 + 手动刷新 | 避免启动阻塞和意外网络操作 |
| 详情页 | 只读，侧边抽屉 | 纯浏览器定位，不做编辑器 |
| UI 组件 | shadcn/ui + Tailwind | 现代、一致、可定制 |
| 状态管理 | TanStack Query | 贴合 Tauri Commands 异步模型 |
| 启用机制 | Symlink（多文件）+ JsonInject（MCP） | 各配置类型最优方案 |
| 分配范围 | 用户级 + 项目级 | 覆盖不同使用场景 |
| 冲突处理 | 用户决策（告警提示） | 避免数据丢失 |
| Token 计算 | tiktoken-rs 精确计算 | Dashboard 需要准确数据 |
| ID 生成 | 短 hash（8-12 字符） | 用户不 care，内部使用 |
| 错误处理 | Tauri 默认 try/catch | 代码简洁，符合 Rust 习惯 |
| CLI/TUI 架构 | 独立 Binary，共享 Core | 启动快，职责清晰 |
