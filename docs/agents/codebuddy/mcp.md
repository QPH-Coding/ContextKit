## MCP

## 介绍

MCP (Model ContextProtocol，模型上下文协议) ，旨在解决大模型语言（LLM）与外部数据源及工具之间无缝集成的需求。它通过标准化 AI 系统与数据源的交互方式，帮助模型获取更丰富的上下文信息，从而生成更准确、更相关的响应。其主要的功能如下：

- 上下文共享：应用程序可以通过 MCP 向模型提供所需的上下文信息（如文件内容、数据库记录等），增强模型的理解能力。
- 工具暴露：MCP 允许应用程序将功能（如文件读写、API 调用）暴露给模型，模型可以调用这些工具完成复杂任务。
- 可组合的工作流：开发者可以利用 MCP 集成多个服务和组件，构建灵活、可扩展的 AI 工作流。
- 安全性：通过本地服务器运行，MCP 避免将敏感数据上传至第三方平台，确保数据隐私。

CodeBuddy IDE 支持您进行MCP Server 配置，扩展您的应用程序的功能。

## 配置

1. 在侧栏对话面板右上方，点击 **CodeBuddy Settings** 按钮。
2. 切换到 MCP 标签页。目前支持自定义配置 MCP Server，同时支持在 MCPMarket 中一键安装 MCP Server。

![alt text](https://www.codebuddy.cn/docs/static/mcp1.DCte2S2B.png)

### 一键安装 MCP Server

- 在 MCP Market 中提供了大量的 MCP Server，您可以一键进行安装。
- 根据您的实际需求，选择 MCP Server 进行一键安装。安装成功后，MCP Server 显示绿色状态，如果安装失败将显示红色状态。

### 自定义配置 MCP Server

1. 在 MCP 标签页下，点击右侧的 **Add MCP** 按钮。
2. 在 json 配置文件中，添加 MCP Server 配置内容，例如：
	```json
	{
	  "mcpServers": {
	    "python-tools": {
	      "type": "stdio",
	      "command": "python",
	      "args": ["-m", "my_mcp_server"],
	      "env": {
	        "PYTHONPATH": "/path/to/tools"
	      },
	      "description": "Python toolset"
	    }
	  }
	}
	```

## 使用

MCP Server 安装成功后，您可以在 MCP Server 右侧点击 Tryto Run 按钮去进行验证使用；也可以直接在 Craft Agent 下输入任务需求，Agent 将根据您的任务需求进行分析，然后调用 MCP Server工具来完成您的任务。