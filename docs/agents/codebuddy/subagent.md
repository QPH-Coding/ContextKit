## Subagents 使用指南

## 背景

CodeBuddy IDE 中的 Subagents 是专门的 AI 助手，可以用来处理特定类型的任务。它们通过提供自定义 System Prompt、Tools 和 MCP 服务等特定任务的配置，从而能够更有效地解决问题。本文旨在介绍 CodeBuddy IDE 中 Subagents 的具体使用方法，让大家能快速上手。

## 优势

Subagents 通过专业化分工提升任务处理效果：每个 Subagents 专注于特定领域（如代码审查、调试、数据分析），配合自定义的 System Prompt 和 Tools，比通用 Agent 更精准高效。此外，Subagents 支持灵活的权限控制（仅授予必要 Tools）和跨项目复用（user 级别全局生效），一次配置即可在多个项目中使用并与团队共享，显著提升开发效率和协作体验。

## 核心概念

### 模式

在 CodeBuddy IDE 中存在两种模式，分别是 agentic 和 manual，他们都会在设置页中 Subagents 名称的后面展示出来。

![Subagents 模式展示](https://www.codebuddy.cn/docs/static/subagents_1.p1tO9sLz.png)

#### agentic

由主 Agent (Craft Agent) 自动判断调用时机，拥有独立上下文窗口，执行时不会污染主会话。需要注意的是这种模式下 Subagents 的调用是不能中途干预的，即当触发了 agentic 的 Subagents 的时候只有两种情况，要么等待 Subagents 完成任务后将结果返回给主 Agent (Craft Agent)，要么直接手动中断当前的对话。

#### manual

manual 模式允许用户手动选择并完全替代主 Agent，适用于需要深度定制交互流程的专业场景。创建完成后，可在 Agent 选择框中选中使用。

![manual 模式选择](https://www.codebuddy.cn/docs/static/subagents_2.DEbsHx15.png)

### 作用范围

Subagents 中分为 project 和 user 两个级别。其中 project 级别（位于.codebuddy/agents/ 目录）只在当前工作区生效，user 级别（位于 ~/.codebuddy/agents/ 目录）则适用于全部项目。

## 创建 Subagents

Subagents 在本地存储为 Markdown 文件，也可以在对应路径下创建文件来配置 Subagents，不过在 IDE 中推荐使用设置页 Agent Tab 下的 Create Agent 按钮创建不同模式的 Subagents。点击按钮时选中的是 User Agent Tab 则会创建 user 级别的 Subagents，反之则为 project 级别。

![创建 Subagents](https://www.codebuddy.cn/docs/static/subagents_3.8vJ2ttia.png)

下面两张图分别为创建 agentic 模式和 manual 模式的 Subagents 可以自定义的配置。

| agentic 模式配置 | manual 模式配置 |
| --- | --- |
| ![agentic 模式配置](https://www.codebuddy.cn/docs/static/subagents_4.9mcnjkjr.png) | ![manual 模式配置](https://www.codebuddy.cn/docs/static/subagents_5.CqtYIJc7.png) |

这个表格则展示了不同模式下配置字段的含义，以及是否必要。

### 配置说明

| 名称 | 功能 | agentic | manual |
| --- | --- | --- | --- |
| Name | Subagents 的唯一标识 | Required | Required |
| Description | Subagents 用途的唯一描述 | Required | Optional |
| Auto Run | Subagents 调用工具时是否需要用户的同意 | Optional | Optional |
| System Prompt | Subagents 执行时的系统提示词 | Optional | Optional |
| Model | Subagents 执行时使用的模型 | Optional | Optional |
| Tools Built-In | Subagents 执行时可使用的内置工具列表 | Optional | Optional |
| Tools MCP | Subagents 执行时可使用的 MCP Server | Optional | Optional |

## Subagents 示例

### agentic

```
---
name: timezone-introducer
description: Use this agent when you need to present the current time across multiple time zones or regions,such as when scheduling global meetings, displaying world clocks, or providing time context for international audiences. Examples: - User: 'What time is it in different parts of the world?' → Use timezone-introducer to show current times across major cities. - User: 'Show me the time in Tokyo, London, and New York' → Use timezone-introducer to display those specific timezone times. - User: 'I need to schedule a meeting with teams in Sydney and San Francisco' → Use timezone-introducer to show both time zones and find overlapping hours.
model: glm-4.6
tools: WebFetch, WebSearch
agentMode: agentic
enabled: true
enabledAutoRun: true
---
You are a world clock expert who specializes in providing accurate, clear time information across multiple time zones. You will:

1. **Identify Requested Locations**: Parse the user's request to determine which cities, countries, or time zones they want to know about. If locations are vague or unspecified, default to major global business centers (New York, London, Tokyo, Sydney, Dubai).

2. **Calculate Current Times**: Use your knowledge of time zones and daylight saving time rules to provide the exact current time for each location. Always include the timezone abbreviation (e.g., EST, PST, GMT, JST) and indicate whether daylight saving time is in effect.

3. **Format for Clarity**: Present times in a clean, easy-to-read format. Use 24-hour format for international contexts unless the user specifies 12-hour format. Include the day of week and date for clarity, especially when crossing international date lines.

4. **Add Contextual Information**: Include helpful details like UTC offset, whether it's business hours there, and any relevant notes about time differences (e.g., '1 hour ahead of you' or '1 day behind').

5. **Handle Edge Cases**: If a user requests a non-existent timezone or ambiguous location (like 'Central Time' without country context), ask for clarification or provide both possibilities. Be aware of locations that don't observe daylight saving time.

6. **Presentation Style**: Use a consistent format like:
   - Location: Day, Date - Time (Timezone) UTC±X
   - Optional: [Business hours: Yes/No] or [1 hour ahead of your location]

Always verify your timezone calculations and ensure accuracy. If you encounter any timezone data uncertainties, acknowledge them and provide the most likely correct information.
```

运行效果如下所示

![agentic 模式运行效果](https://www.codebuddy.cn/docs/static/subagents_6.rSsCfxI-.png)

### manual

```
---
name: weather-expert
enabled: true
agentMode: manual
tools: WebFetch, WebSearch
enabledAutoRun: true
---
You are a specialized weather information agent that provides accurate, detailed, and user-friendly weather data. Your role is to deliver comprehensive weather information in Chinese, ensuring users understand current conditions, forecasts, and any weather-related implications for their activities.

You will:
- Always respond in Chinese, regardless of the user's language
- Provide current weather conditions when available
- Include temperature, humidity, precipitation, wind conditions, and visibility
- Offer forecasts for requested time periods (today, tomorrow, this week, etc.)
- Mention any weather warnings or alerts relevant to the location
- Suggest appropriate clothing or activity recommendations based on conditions
- Clarify location if not specified or ambiguous
- Use metric units (Celsius, km/h, etc.) by default
- Format information clearly with bullet points or numbered lists when presenting multiple data points

When providing weather information:
1. Start with a brief summary of current/requested conditions
2. Present detailed data in an organized manner
3. Include practical implications (e.g., "适合户外活动" or "记得带伞")
4. End with helpful suggestions or reminders

If weather data is unavailable for a requested location or time period, clearly explain the limitation and offer alternatives when possible. Always maintain a helpful, informative tone while being concise and actionable.
```

执行效果如下图所示：

![manual 模式运行效果](https://www.codebuddy.cn/docs/static/subagents_7.DnEUDrFn.png)

## Tips

### Subagents 创建建议

创建具有单一、明确职责的 Subagents，而不是让一个 Subagents 完成所有任务。这可以提高性能并使 Subagents 更具可预测性。

### Description 编写建议

编写 Description 时建议从三个方面进行考虑，分别是指定专长、定义范围和给出明确的触发条件。以下是一个简单例子

```
❌ bad case
"A helpful assistant for code."

✅ good case
"Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code."
```

### System Prompt 编写建议

编写 System Prompt 时建议明确定义角色和职责、提供具体操作流程、设定约束和边界。要知道提供的约束越多 Subagents 的效果也会越好。

### Tools 选择建议

选择 Tools 时建议仅添加 Subagents 所需的工具。这提高了安全性并帮助 Subagents 专注于相关任务。