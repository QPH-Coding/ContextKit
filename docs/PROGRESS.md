# ContextKit 开发进度

> 本文件跟踪 ContextKit 的开发任务与进度。
> 更新规则：任务开始时标记 ⏳，完成后标记 ✅，阻塞时标记 🚫。

---

## Phase 0: 项目骨架

> 目标：搭建可运行的多 Crate Workspace + 前端工程

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 0.1 | 改造 Tauri 模板为 Workspace 多 Crate | P0 | ✅ | `src-tauri/Cargo.toml` 改为 workspace，创建 `crates/` 目录，迁移现有代码到 `contextkit-gui` |
| 0.2 | 创建 `contextkit-core` crate | P0 | ✅ | `crates/contextkit-core/`，定义 `lib.rs`，配置依赖（`serde`, `toml`, `thiserror`, `chrono` 等） |
| 0.3 | 创建 `contextkit-cli` crate（占位） | P1 | ✅ | 最小可编译的 `main.rs` |
| 0.4 | 创建 `contextkit-tui` crate（占位） | P1 | ✅ | 最小可编译的 `main.rs` |
| 0.5 | 验证 Workspace 编译通过 | P0 | ✅ | `cargo build --workspace` 成功 |
| 0.6 | 前端初始化 Tailwind CSS | P0 | ✅ | 安装并配置 `tailwindcss` v4 + `@tailwindcss/vite`，更新 `index.css` |
| 0.7 | 前端初始化 shadcn/ui | P0 | ✅ | 配置 `components.json`、CSS 变量、`cn()` 工具函数、路径别名 |
| 0.8 | 前端安装 TanStack Query | P0 | ✅ | `@tanstack/react-query` 已安装，`QueryClientProvider` 已配置 |
| 0.9 | 前端配置 Tauri invoke 封装 | P0 | ✅ | 创建 `src/lib/api.ts`，按模块封装 Source/Config/Assignment/Global API |
| 0.10 | 验证前端 dev 正常 | P0 | ✅ | `bun run build` + `cargo build --workspace` 双端编译通过 |

---

## Phase 1: Core 基础层

> 目标：Core 的数据结构、错误体系、配置管理、TOML 索引读写

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 1.1 | 定义核心数据模型 | P0 | ⬜ | `models.rs`: `Source`, `ConfigKind`, `ConfigSummary`, `ConfigDetail`, `AgentTool`, `Settings`, `Stats` 等 |
| 1.2 | 定义统一错误类型 | P0 | ⬜ | `error.rs`: `ContextKitError`（IO、Git、Parse、NotFound、Conflict 等变体），集成 `thiserror` |
| 1.3 | 实现全局配置管理 | P0 | ⬜ | `config.rs`: 确定配置目录（`~/.config/contextkit/`），读写 `settings.toml` |
| 1.4 | 实现 TOML 索引读写 | P0 | ⬜ | `index.rs`: `Index` 结构体，读写 `index.toml`，支持版本迁移 |
| 1.5 | Core 单元测试（模型+索引） | P0 | ⬜ | 为 `models`, `error`, `config`, `index` 写单元测试 |
| 1.6 | 暴露 Core 公开 API | P0 | ⬜ | `lib.rs` 整理公开模块和函数，设计 facade 层 |

---

## Phase 2: 核心能力

> 目标：扫描器、Git 操作、Token 计算

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 2.1 | 实现 Source 管理模块骨架 | P0 | ✅ | `source/mod.rs`: `SourceManager` 结构体，CRUD 接口 |
| 2.2 | 实现本地 Source 验证 | P0 | ✅ | 集成在 `source/mod.rs` 中 |
| 2.3 | 实现 Git Source 克隆 | P0 | ✅ | `source/git.rs`: `git clone` |
| 2.4 | 实现 Git Source 更新 | P0 | ✅ | `source/git.rs`: `git pull` + `has_updates` |
| 2.5 | 实现目录扫描器 | P0 | ✅ | `scanner.rs`: 递归扫描，按约定路径识别 |
| 2.6 | 扫描器识别 Skill | P0 | ✅ | 识别 `SKILL.md` 的父目录 |
| 2.7 | 扫描器识别 Rule | P0 | ✅ | 识别 `rules/` 目录下的文件 |
| 2.8 | 扫描器识别 Agent | P0 | ✅ | 识别 `agents/` 目录下的文件 |
| 2.9 | 扫描器识别 MCP | P0 | ✅ | 识别 `mcp.json` / `.mcp.json` |
| 2.10 | 扫描结果写入索引 | P0 | ✅ | `sync_source` 更新 source 元数据并保存索引 |
| 2.11 | 集成 tiktoken-rs | P0 | ✅ | `token.rs`: cl100k_base tokenizer |
| 2.12 | 扫描时预计算 Token | P0 | ✅ | `count_tokens` + `count_tokens_in_file` |
| 2.13 | 实现懒扫描逻辑 | P1 | ⬜ | 待实现（根据 `last_scan_at` 判断） |
| 2.14 | 扫描器单元测试 | P0 | ✅ | 56 个测试全部通过 |

---

## Phase 3: Agent 工具与分配机制

> 目标：Agent 工具注册表、路径映射、分配/取消分配

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 3.1 | 定义 Agent 工具注册表 | P0 | ✅ | `agent/registry.rs`: `AgentRegistry` 结构体，管理所有 Agent 工具定义 |
| 3.2 | 实现 Agent 工具 trait | P0 | ✅ | `agent/mod.rs`: `AgentTool` trait（`target_path`, `mechanism`, `supports_scope` 等方法） |
| 3.3 | 实现 Claude Code 支持 | P0 | ✅ | 用户级 `~/.claude/` + 项目级 `.claude/`，Symlink 机制 |
| 3.4 | 实现 Codex 支持 | P0 | ✅ | 用户级 `~/.codex/` + 项目级 `.codex/` |
| 3.5 | 实现 Cursor Rule 支持 | P0 | ✅ | 用户级 `~/.cursor/rules/` + 项目级 `.cursorrules` |
| 3.6 | 实现 Cursor MCP 支持 | P0 | ✅ | `~/.cursor/mcp.json`，MCP JSON 注入 |
| 3.7 | 实现 Kimi 支持 | P0 | ✅ | 用户级 `~/.kimi/skills/`，仅 Skill |
| 3.8 | 实现 CodeBuddy 支持 | P0 | ✅ | 支持用户自定义路径，默认无固定路径 |
| 3.9 | 实现 Claude Desktop MCP 支持 | P0 | ✅ | `~/Library/Application Support/Claude/claude_desktop_config.json`，MCP JSON 注入 |
| 3.10 | 实现 Symlink 分配 | P0 | ✅ | 创建符号链接，Windows fallback 为复制 |
| 3.11 | 实现 Copy 分配（fallback） | P0 | ✅ | 文件复制 |
| 3.12 | 实现 MCP JSON 注入 | P0 | ✅ | 读取现有 JSON，合并/覆盖 `mcpServers`，写回 |
| 3.13 | 实现取消分配（删除链接/文件/JSON 项） | P0 | ✅ | 逆向操作，清理 Agent 工具目录 |
| 3.14 | 实现冲突检测 | P0 | ✅ | 分配前检查目标路径是否已存在 |
| 3.15 | 跨平台路径处理 | P0 | ✅ | 使用 `dirs` crate 处理 `~` 展开和系统路径差异（macOS/Windows/Linux） |
| 3.16 | Agent 模块单元测试 | P0 | ✅ | 用临时目录测试分配/取消分配/冲突检测，全部通过 |

---

## Phase 4: GUI 实现

> 目标：Tauri Commands + React 页面

### 4.1 Rust 侧（Tauri Commands）

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 4.1.1 | 实现 Source Commands | P0 | ✅ | `add_source`, `remove_source`, `list_sources`, `sync_source` |
| 4.1.2 | 实现 Config Commands | P0 | ✅ | `list_configs`, `get_config` |
| 4.1.3 | 实现 Assignment Commands | P0 | ✅ | `assign_config`, `unassign_config`, `list_assignments` |
| 4.1.4 | 实现 Global Commands | P0 | ✅ | `get_stats`, `get_settings` |
| 4.1.5 | 注册所有 Commands 到 Tauri | P0 | ✅ | `contextkit-gui/src/lib.rs` + `commands.rs` |

### 4.2 前端侧（React 页面）

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 4.2.1 | 搭建页面路由 | P0 | ✅ | `react-router-dom`，定义 `/`, `/sources`, `/configs`, `/settings` |
| 4.2.2 | 搭建布局框架 | P0 | ✅ | Sidebar 导航 + 主内容区 |
| 4.2.3 | 实现 Dashboard 页面 | P0 | ✅ | 统计卡片、Source 列表、空状态引导 |
| 4.2.4 | 实现 Source 列表页面 | P0 | ✅ | 展示所有 Source，支持添加/删除/刷新 |
| 4.2.5 | 实现 Source 添加对话框 | P0 | ✅ | 内联表单：输入 Git URL 或本地路径 |
| 4.2.6 | 实现 Config 列表页面（通用） | P0 | ✅ | 列表 + 按类型过滤（Skill/Rule/Agent/MCP） |
| 4.2.7 | 实现 Config 详情抽屉 | P0 | ⬜ | Slide-over Panel（后续迭代） |
| 4.2.8 | 实现分配操作 UI | P0 | ⬜ | 详情抽屉中勾选 Agent 工具（后续迭代） |
| 4.2.9 | 实现冲突提示对话框 | P0 | ⬜ | 分配时冲突检测（后续迭代） |
| 4.2.10 | 实现全局搜索 | P1 | ⬜ | NavBar 搜索框（后续迭代） |
| 4.2.11 | 实现 Settings 页面 | P1 | ✅ | 配置目录、默认同步模式展示 |
| 4.2.12 | 加载状态与错误处理 | P0 | ✅ | TanStack Query `isLoading`, `isError` |
| 4.2.13 | 空状态与引导 | P1 | ✅ | 无 Source 时的引导页面 |

---

## Phase 5: CLI / TUI（预留）

> 目标：基于 Core API 实现命令行和终端界面

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 5.1 | CLI 参数解析框架 | P2 | ⬜ | `clap` crate，定义命令树（`source`, `list`, `show`, `assign` 等） |
| 5.2 | CLI Source 命令 | P2 | ⬜ | `ck source add/list/remove/sync` |
| 5.3 | CLI Config 命令 | P2 | ⬜ | `ck list/show/cat` |
| 5.4 | CLI Assignment 命令 | P2 | ⬜ | `ck assign/unassign` |
| 5.5 | CLI 输出格式化 | P2 | ⬜ | table（默认）、json（`--output json`） |
| 5.6 | TUI 框架搭建 | P2 | ⬜ | `ratatui` 初始化，主循环 |
| 5.7 | TUI 导航与布局 | P2 | ⬜ | 左侧列表 + 右侧详情，键盘事件处理 |
| 5.8 | TUI Source 管理界面 | P2 | ⬜ | 添加/删除/刷新 Source |
| 5.9 | TUI Config 浏览界面 | P2 | ⬜ | 列表 + 详情面板 |
| 5.10 | TUI 分配操作 | P2 | ⬜ | 交互式勾选 Agent 工具 |

---

## Phase 6: 测试与发布准备

| # | 任务 | 优先级 | 状态 | 说明 |
|---|------|--------|------|------|
| 6.1 | Core 集成测试 | P0 | ⬜ | 端到端测试：添加 Source → 扫描 → 分配 → 取消分配 |
| 6.2 | 前端 E2E 测试 | P1 | ⬜ | 关键用户流程的自动化测试 |
| 6.3 | 跨平台构建验证 | P0 | ⬜ | Windows、macOS、Linux 编译通过 |
| 6.4 | 性能测试（大规模索引） | P1 | ⬜ | 1000+ 配置项的扫描和查询性能 |
| 6.5 | 文档完善 | P1 | ⬜ | README、用户手册、API 文档 |
| 6.6 | 打包与发布 | P1 | ⬜ | Tauri bundle，GitHub Actions 自动构建 |

---

## 当前聚焦

> Phase 4 核心功能已完成（TDD 实现）。前后端已连通。

**下一步行动**：
1. 实现 Config 详情抽屉 + 分配操作 UI
2. 实现全局搜索
3. 完善空状态、错误提示、首次使用引导
4. Phase 5/6：CLI/TUI、跨平台构建、打包发布
