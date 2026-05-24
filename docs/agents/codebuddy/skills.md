## Skills

Skills 是模块化的、自包含的能力包，通过提供专门的知识、工作流和工具来扩展 AI Agent 的能力。它们就像是针对特定领域或任务的“入职指南”，将通用的 AI Agent 转变为具备专业程序性知识的专家。

## Skills 能提供什么

1. **专业工作流** ：针对特定领域的自动多步骤程序。
2. **工具集成** ：处理特定文件格式或 API 的指令。
3. **领域专业知识** ：公司特定的知识、架构和业务逻辑。
4. **打包资源** ：用于复杂和重复任务的脚本、参考资料和资产。

## Skill 的结构

每个 Skill 由一个必需的 `SKILL.md` 文件和可选的打包资源组成。Skill 应建立在工作区的 `.codebuddy/skills/` 目录下。

```
skill-name/
├── SKILL.md (必需)
│   ├── YAML frontmatter 元数据 (必需)
│   │   ├── name: (必需)
│   │   └── description: (必需)
│   └── Markdown 指令 (必需)
└── Bundled Resources (可选)
    ├── scripts/          - 可执行代码 (Python/Bash 等)
    ├── references/       - 旨在根据需要加载到上下文中的文档
    └── assets/           - 用在输出中的文件 (模板、图标、字体等)
```

### SKILL.md (必需)

这是 Skill 的核心定义文件。

**元数据 (YAML Frontmatter):**`name` 和 `description` 决定了 AI 何时会使用这个 Skill。描述需具体说明 Skill 的功能和使用场景。

示例：

```markdown
---
name: pdf-editor
description: This skill should be used when users ask to modify, rotate, or extract text from PDF files.
allowed-tools: # 可选，指定允许使用的工具
disable: false # 可选，是否禁用
---

# PDF Editor

To rotate a PDF...
```

### 打包资源 (可选)

#### 1\. Scripts (scripts/)

用于需要确定性可靠性或被重复重写的任务的可执行代码。

- **用途** ：当代码被重复重写或需要高可靠性时。
- **示例** ： `scripts/rotate_pdf.py` 用于 PDF 旋转。

#### 2\. References (references/)

旨在根据需要加载到上下文中以辅助 AI 思考的文档和参考资料。

- **用途** ：数据库架构、API 文档、领域知识、公司政策等。
- **优势** ：保持 `SKILL.md` 精简，仅在 AI 确定需要时才加载。

#### 3\. Assets (assets/)

不打算加载到上下文中，而是用于 AI 生成的输出中的文件。

- **用途** ：品牌资产、PPT 模板、HTML/React 样板代码等。

## 渐进式披露设计原则

Skills 使用三级加载系统来高效管理上下文：

1. **元数据 (Metadata)** ：始终在上下文中 (~100 词)。
2. **Skill 主体 (SKILL.md body)** ：当 Skill 被触发时加载 (<5k 词)。
3. **打包资源 (Bundled resources)** ：按需由 AI 加载 (无限制)。

## 创建 Skill 的流程

1. **理解需求** ：明确 Skill 的使用场景和触发条件。
2. **规划资源** ：分析是否需要脚本、参考文档或资产模板。
3. **创建目录** ：在 `.codebuddy/skills/` 下创建新的 Skill 目录。
4. **编写 SKILL.md** ：
	- 填写 YAML 元数据。
		- 编写 Markdown 指令。使用指令性语言（如 "To accomplish X, do Y"）。
		- 引用打包的资源。

## 最佳实践

- **具体明确的描述** ：在 `description` 中清楚地说明 Skill 何时应该被使用。
- **指令性语言** ：在 `SKILL.md` 中使用动词开头的指令，而不是第二人称。
- **按需加载** ：将长篇文档放入 `references/` ，避免 `SKILL.md` 过于臃肿。
- **避免重复** ：信息应存在于 `SKILL.md` 或引用文件中，不要两处都有。

## Skill 管理

CodeBuddy 在设置页面中提供了可视化的界面来帮助你管理 Skills。

在设置管理页面中，你可以：

- **集中管理** ：查看和管理当前项目（Project Skills）和用户级别（User Skills）的所有 Skills。
- **导入 Skill** ：点击右上角的“导入 Skill”按钮，可以导入你从网络上获取的 Skills。