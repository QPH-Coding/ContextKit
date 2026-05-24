## Hook 功能使用文档

## 📑 目录

## 概述

Hook 功能允许您在 AI Agent 执行的关键节点插入自定义脚本，实现对 Agent 行为的精细控制。Hook 机制完全兼容 **Claude Code Hooks 规范** ，提供了一种强大且灵活的扩展方式。

## 功能特性

- ✅ **多事件支持**: 支持 7 种关键事件（SessionStart、SessionEnd、PreToolUse、PostToolUse、UserPromptSubmit、Stop、PreCompact）
- ✅ **工具拦截**: 在工具执行前后进行验证、修改或阻止
- ✅ **上下文注入**: 在会话不同阶段动态注入额外上下文
- ✅ **并行执行**: 多个 Hook 自动并行执行，提升性能
- ✅ **自动去重**: 相同命令自动去重，避免重复执行
- ✅ **灵活配置**: 支持正则匹配、超时控制、项目级/用户级配置
- ✅ **会话跟踪**: 智能识别会话变化，避免重复触发 SessionStart
- ✅ **安全可靠**: 完善的错误处理和超时机制

---

## 支持的 Hook 事件

### 1\. SessionStart - 会话启动

**触发时机**: 会话开始时（每个新会话只触发一次）

**触发逻辑**:

- 系统通过对比 `conversationId` 判断是否为新会话
- 同一会话中多次请求不会重复触发
- 切换到新会话或清空会话后会重新触发

**用途**:

- 初始化项目环境
- 注入项目特定上下文
- 设置会话级别的配置
- 加载项目规范和文档

**Matcher 匹配字段**: `source`

- `startup` - 首次启动（目前仅支持此值）

**输入数据** (stdin JSON):

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/project/path",
  "hook_event_name": "SessionStart",
  "source": "startup"
}
```

**输出数据** (stdout JSON):

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "项目使用 TypeScript + React，请优先使用函数式组件"
  }
}
```

**示例配置**:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/session_start.py",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

---

### 2\. SessionEnd - 会话结束

**触发时机**: 会话终止时

**用途**:

- 清理临时资源
- 保存会话状态
- 生成会话报告

**Matcher 匹配字段**: `reason`

- `other` - 会话结束（目前仅支持此值，包括切换会话、删除会话、清空会话等场景）

**输入数据**:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/project/path",
  "hook_event_name": "SessionEnd",
  "reason": "other"
}
```

**输出数据**:

```json
{
  "continue": true,
  "systemMessage": "会话已清理，临时文件已删除"
}
```

---

### 3\. PreToolUse - 工具执行前

**触发时机**: 任何工具执行前

**用途**:

- 验证工具参数
- 修改工具输入
- 阻止危险操作
- 权限检查
- 记录审计日志

**Matcher 匹配字段**: `tool_name`

- 示例: `Bash`, `Write`, `Read`
- 支持正则: `Write|Edit`
- 匹配所有: `*` 或空字符串

**输入数据**:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/project/path",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm install",
    "requires_approval": false
  }
}
```

**输出数据 - 允许执行**:

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow"
  }
}
```

**输出数据 - 修改参数**:

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "已添加 --legacy-peer-deps 参数",
    "modifiedInput": {
      "command": "npm install --legacy-peer-deps",
      "requires_approval": false
    }
  }
}
```

**输出数据 - 阻止执行**:

```json
{
  "continue": false,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "检测到危险命令: rm -rf /"
  }
}
```

**输出数据 - 请求用户确认**:

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "检测到 git push --force，是否继续？"
  }
}
```

---

### 4\. PostToolUse - 工具执行后

**触发时机**: 工具执行完成后

**用途**:

- 记录工具执行日志
- 后处理工具输出
- 触发后续操作
- 发送通知

**Matcher 匹配字段**: `tool_name`

**输入数据**:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/project/path",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  },
  "tool_response": {
    "exitCode": 0,
    "stdout": "All tests passed",
    "stderr": ""
  }
}
```

**输出数据**:

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "测试已通过，可以继续开发"
  }
}
```

---

### 5\. UserPromptSubmit - 用户输入提交

**触发时机**: 用户提交消息时

**用途**:

- 预处理用户输入
- 添加上下文信息
- 检测特定关键词
- 输入验证

**Matcher**: 不使用（所有提交都触发）

**输入数据**:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/project/path",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "帮我实现一个登录功能"
}
```

**输出数据**:

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "提示：项目已集成 JWT 认证库，建议使用"
  }
}
```

**阻止输入**:

```json
{
  "continue": false,
  "stopReason": "输入包含敏感信息，已阻止"
}
```

---

### 6\. Stop - Agent 停止响应

**触发时机**: Agent 完成响应时

**用途**:

- 提供反馈给 Agent
- 记录执行状态
- 触发后续任务

**Matcher**: 不使用

**输入数据**:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/project/path",
  "hook_event_name": "Stop",
  "stop_hook_active": false
}
```

**输出数据 - 提供反馈** (exit code 2):

```json
{
  "continue": false,
  "stopReason": "请验证代码是否通过了单元测试"
}
```

---

### 7\. PreCompact - 上下文压缩前

**触发时机**: 上下文即将被压缩时

**用途**:

- 保存重要信息
- 提供压缩指导
- 备份完整上下文

**Matcher 匹配字段**: `trigger`

- `manual` - 用户手动触发 `/summarize`
- `auto` - 自动压缩

**输入数据**:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.txt",
  "cwd": "/project/path",
  "hook_event_name": "PreCompact",
  "trigger": "auto",
  "custom_instructions": "保留所有 API 设计相关的讨论"
}
```

**输出数据** (exit code 0):

```json
{
  "continue": true,
  "hookSpecificOutput": {
    "hookEventName": "PreCompact",
    "additionalContext": "重要：保留数据库表结构设计"
  }
}
```

> **说明**: Exit code 0 时，stdout 的内容会被添加为额外的压缩指导

---

## Hook 脚本规范

### 输入格式

Hook 脚本通过 **stdin** 接收 JSON 格式的输入数据。

**通用字段**:

```json
{
  "session_id": "会话 ID",
  "transcript_path": "对话记录文件路径",
  "cwd": "当前工作目录",
  "hook_event_name": "事件名称"
}
```

**事件特定字段**:

- `SessionStart`: `source`
- `SessionEnd`: `reason`
- `PreToolUse/PostToolUse`: `tool_name`, `tool_input`, `tool_response`
- `UserPromptSubmit`: `prompt`
- `PreCompact`: `trigger`, `custom_instructions`
- `Stop`: `stop_hook_active`

### 输出格式

Hook 脚本通过 **stdout** 返回 JSON 格式的输出。

**基本结构**:

```json
{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "可选的系统消息",
  "stopReason": "阻止原因（当 continue=false 时）",
  "hookSpecificOutput": {
    "hookEventName": "事件名称",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "决策原因",
    "modifiedInput": {},
    "additionalContext": "额外上下文"
  }
}
```

**字段说明**:

- `continue`: 是否允许操作继续（ `false` 表示阻止）
- `suppressOutput`: 是否隐藏 stdout 输出
- `systemMessage`: 显示给用户的系统消息
- `stopReason`: 阻止原因
- `hookSpecificOutput`: 事件特定的输出数据

### 退出码规范

| 退出码 | 含义 | 行为 |
| --- | --- | --- |
| **0** | 成功执行 | 允许操作继续，stdout 可能被处理 |
| **1** | 非阻塞错误 | 显示 stderr 作为警告，允许继续 |
| **2** | 阻塞错误 | 阻止操作，stderr 传递给 Agent/模型 |
| **其他** | 非阻塞错误 | 同退出码 1 |

**特殊规则**:

- **PreToolUse**: 退出码 2 会阻止工具执行
- **Stop**: 退出码 2 表示提供反馈，stderr 会注入到下一条消息
- **PreCompact**: 退出码 0 时，stdout 会作为额外的压缩指导

### 环境变量

Hook 脚本执行时可访问以下环境变量：

- `CLAUDE_PROJECT_DIR`: 项目根目录（兼容 Claude Code）
- `CODEBUDDY_PROJECT_DIR`: 项目根目录（CodeBuddy 特定）

---

## 配置说明

### 配置文件位置

**优先级** （高到低）：

1. **项目级**: `<workspace>/.codebuddy/settings.json`
2. **用户级**: `~/.codebuddy/settings.json`

项目级配置会 **覆盖** 用户级配置。

### 配置文件结构

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/script.py",
            "timeout": 10
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/backup_script.sh",
            "timeout": 20
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/init.py",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### 配置字段说明

#### matcher (匹配器)

正则表达式，用于匹配特定条件。

**语法**:

- 空字符串 `""` 或 `"*"`: 匹配所有
- 单个值: `"Bash"`
- 多个值: `"Write|Edit"`
- 正则表达式: `"Read.*|Grep.*"`

**不同事件的匹配目标**:

- `PreToolUse/PostToolUse`: 匹配 `tool_name` （如 `Bash`, `Write`, `Read`, `Edit` 等）
- `SessionStart`: 匹配 `source`
- `SessionEnd`: 匹配 `reason`
- `PreCompact`: 匹配 `trigger`
- `UserPromptSubmit/Stop`: 不使用 matcher

#### command (命令路径)

Hook 脚本的路径。

**要求**:

- ✅ 推荐使用绝对路径
- ✅ 支持环境变量: `"$CODEBUDDY_PROJECT_DIR/.codebuddy/hooks/script.py"`
- ✅ 可包含解释器: `"python3 /path/to/script.py"`
- ⚠️ 需要确保脚本有执行权限

#### timeout (超时时间)

Hook 执行的超时时间，单位： **秒** 。

- 默认值: `60` 秒
- 推荐设置: 根据脚本复杂度调整
	- 简单验证: 5-10 秒
		- 文件操作: 15-30 秒
		- 网络请求: 30-60 秒

---

## 完整示例

### 示例 1: 命令安全验证

**场景**: 阻止危险的 `rm -rf` 命令

**Hook 脚本** (`validate_command.py`):

```python
#!/usr/bin/env python3
import json
import sys

DANGEROUS_COMMANDS = ['rm -rf /', 'dd if=/dev/zero', 'mkfs']

def main():
    input_data = json.loads(sys.stdin.read())

    if input_data.get('tool_name') != 'Bash':
        print(json.dumps({"continue": True}))
        return 0

    command = input_data.get('tool_input', {}).get('command', '')

    for dangerous in DANGEROUS_COMMANDS:
        if dangerous in command:
            output = {
                "continue": False,
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"检测到危险命令: {dangerous}"
                }
            }
            print(json.dumps(output, ensure_ascii=False))
            return 0

    print(json.dumps({"continue": True}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**配置**:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/validate_command.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

---

### 示例 2: 智能修改命令参数

**场景**: 自动为 `npm install` 添加 `--legacy-peer-deps` 参数

**Hook 脚本** (`modify_npm.py`):

```python
#!/usr/bin/env python3
import json
import sys
import re

def main():
    input_data = json.loads(sys.stdin.read())

    if input_data.get('tool_name') != 'Bash':
        print(json.dumps({"continue": True}))
        return 0

    tool_input = input_data.get('tool_input', {})
    command = tool_input.get('command', '')

    # 检查是否是 npm install
    if re.match(r'^npm\s+(i|install)\b', command.strip()):
        # 如果没有 --legacy-peer-deps，添加它
        if '--legacy-peer-deps' not in command:
            modified_command = command.strip() + ' --legacy-peer-deps'

            output = {
                "continue": True,
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow",
                    "permissionDecisionReason": "已自动添加 --legacy-peer-deps 参数",
                    "modifiedInput": {
                        "command": modified_command,
                        "requires_approval": tool_input.get('requires_approval', False)
                    }
                }
            }
            print(json.dumps(output, ensure_ascii=False))
            return 0

    print(json.dumps({"continue": True}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

### 示例 3: 文件修改前自动备份

**场景**: 在修改文件前自动创建备份

**Hook 脚本** (`backup_files.py`):

```python
#!/usr/bin/env python3
import json
import sys
import os
import shutil
from datetime import datetime

def main():
    input_data = json.loads(sys.stdin.read())
    tool_name = input_data.get('tool_name', '')

    # 只处理文件写入工具
    if tool_name not in ['Write', 'Edit']:
        print(json.dumps({"continue": True}))
        return 0

    tool_input = input_data.get('tool_input', {})
    file_path = tool_input.get('filePath')

    if not file_path or not os.path.exists(file_path):
        print(json.dumps({"continue": True}))
        return 0

    # 创建备份目录
    project_dir = os.environ.get('CODEBUDDY_PROJECT_DIR', '')
    backup_dir = os.path.join(project_dir, '.codebuddy', 'backups')
    os.makedirs(backup_dir, exist_ok=True)

    # 生成备份文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f"{os.path.basename(file_path)}.{timestamp}.bak"
    backup_path = os.path.join(backup_dir, backup_name)

    # 创建备份
    shutil.copy2(file_path, backup_path)

    output = {
        "continue": True,
        "systemMessage": f"已备份至: {backup_path}"
    }
    print(json.dumps(output, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**配置**:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/backup_files.py",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

---

### 示例 4: 会话启动时注入项目上下文

**场景**: 在会话开始时自动注入项目配置信息

**Hook 脚本** (`session_start.py`):

```python
#!/usr/bin/env python3
import json
import sys
import os

def main():
    input_data = json.loads(sys.stdin.read())
    project_dir = os.environ.get('CODEBUDDY_PROJECT_DIR', '')

    # 读取项目配置
    config_file = os.path.join(project_dir, '.codebuddy', 'project.json')
    project_info = ""

    if os.path.exists(config_file):
        with open(config_file, 'r') as f:
            config = json.load(f)
            project_info = f"""
项目名称: {config.get('name', 'Unknown')}
技术栈: {', '.join(config.get('tech_stack', []))}
编码规范: {config.get('coding_standard', 'Standard')}
"""

    output = {
        "continue": True,
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": f"""
会话已启动!
项目目录: {project_dir}
启动源: {input_data.get('source', 'unknown')}
{project_info}
"""
        }
    }

    print(json.dumps(output, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

### 示例 5: 上下文压缩前保存重要信息

**场景**: 在自动压缩前保存完整对话历史

**Hook 脚本** (`save_context.py`):

```python
#!/usr/bin/env python3
import json
import sys
import os
import shutil
from datetime import datetime

def main():
    input_data = json.loads(sys.stdin.read())

    # 只处理自动压缩
    if input_data.get('trigger') != 'auto':
        print(json.dumps({"continue": True}))
        return 0

    project_dir = os.environ.get('CODEBUDDY_PROJECT_DIR', '')
    transcript_path = input_data.get('transcript_path', '')

    if not transcript_path or not os.path.exists(transcript_path):
        print(json.dumps({"continue": True}))
        return 0

    # 创建保存目录
    save_dir = os.path.join(project_dir, '.codebuddy', 'context_history')
    os.makedirs(save_dir, exist_ok=True)

    # 保存对话历史
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    save_path = os.path.join(save_dir, f'transcript_{timestamp}.txt')
    shutil.copy2(transcript_path, save_path)

    output = {
        "continue": True,
        "systemMessage": f"上下文已保存至: {save_path}"
    }
    print(json.dumps(output, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**配置**:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/save_context.py",
            "timeout": 20
          }
        ]
      }
    ]
  }
}
```

---

## 实战指南

### 快速开始 - 5 分钟配置第一个 Hook

**第一步：创建配置文件**

```bash
mkdir -p ~/.codebuddy
cat > ~/.codebuddy/settings.json << 'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/env python3 -c \"import json,sys; print(json.dumps({'continue': True, 'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': 'Hook 配置成功！'}}))\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
EOF
```

**第二步：重启 Agent**

启动新会话，如果看到 "Hook 配置成功！" 说明配置生效。

**第三步：创建你的第一个真实 Hook**

```bash
# 创建 Hook 脚本目录
mkdir -p ~/.codebuddy/hooks

# 创建测试脚本
cat > ~/.codebuddy/hooks/my_first_hook.py << 'EOF'
#!/usr/bin/env python3
import json
import sys

def main():
    input_data = json.loads(sys.stdin.read())

    output = {
        "continue": True,
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": f"欢迎使用 Agent-Craft！当前项目: {input_data.get('cwd', 'unknown')}"
        }
    }

    print(json.dumps(output, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
EOF

# 添加执行权限
chmod +x ~/.codebuddy/hooks/my_first_hook.py
```

**第四步：更新配置文件**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOUR_USERNAME/.codebuddy/hooks/my_first_hook.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 调试技巧进阶

**技巧1: 使用日志文件调试**

```python
import sys

def debug_log(message):
    """写入调试日志而不影响 stdout"""
    with open('/tmp/hook_debug.log', 'a') as f:
        f.write(f"{message}\n")

# 在 Hook 脚本中使用
debug_log(f"Received input: {json.dumps(input_data)}")
```

**技巧2: 验证 JSON 输出格式**

```bash
# 测试脚本输出的 JSON 是否有效
echo '{"hook_event_name":"SessionStart"}' | python3 your_hook.py | jq .
```

**技巧3: 监控 Hook 执行**

```bash
# 实时查看 Hook 日志
tail -f ~/.codebuddy/logs/agent-craft.log | grep -i hook
```

**技巧4: 使用环境变量传递信息**

```python
import os

# 在 Hook 中获取项目目录
project_dir = os.environ.get('CODEBUDDY_PROJECT_DIR', '')
claude_dir = os.environ.get('CLAUDE_PROJECT_DIR', '')  # 兼容 Claude Code
```

### 常见 Hook 模式

**模式1: 白名单验证**

```python
ALLOWED_COMMANDS = [
    'npm install',
    'npm test',
    'git status',
    'git diff'
]

def is_allowed(command):
    return any(command.startswith(allowed) for allowed in ALLOWED_COMMANDS)
```

**模式2: 参数增强**

```python
def enhance_command(command):
    """自动添加常用参数"""
    enhancements = {
        'npm install': ' --legacy-peer-deps',
        'git push': ' --dry-run',  # 安全模式
    }

    for prefix, suffix in enhancements.items():
        if command.startswith(prefix) and suffix not in command:
            return command + suffix

    return command
```

**模式3: 条件路由**

```python
def should_block(input_data):
    """根据多个条件判断是否阻止"""
    tool_name = input_data.get('tool_name')
    tool_input = input_data.get('tool_input', {})

    # 规则1: 阻止删除重要文件
    if tool_name == 'Write':
        file_path = tool_input.get('file_path', '')
        if any(important in file_path for important in ['.git', 'package.json']):
            return True, "不能删除重要文件"

    # 规则2: 阻止危险命令
    if tool_name == 'Bash':
        command = tool_input.get('command', '')
        if 'rm -rf /' in command or 'dd if=' in command:
            return True, "检测到危险命令"

    return False, None
```

### 项目模板推荐

**Node.js 项目 Hook 配置**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.codebuddy/hooks/nodejs-init.js",
            "timeout": 15
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codebuddy/hooks/npm-safety-check.py",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**Python 项目 Hook 配置**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codebuddy/hooks/python-env-check.py",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codebuddy/hooks/python-lint.py",
            "timeout": 20
          }
        ]
      }
    ]
  }
}
```

---

## 最佳实践

### 1\. 脚本开发

- ✅ **错误处理**: 脚本配置异常处理，减少阻塞主流程
- ✅ **快速执行**: Hook 应快速完成，减少耗时操作
- ✅ **幂等性**: Hook 可能被多次调用，多次执行结果一致
- ✅ **日志记录**: 使用 `sys.stderr` 输出调试信息，不要污染 stdout

### 2\. 安全性

- ⚠️ **输入验证**: 始终验证输入数据的合法性
- ⚠️ **白名单优于黑名单**: 使用白名单机制进行权限控制
- ⚠️ **避免代码注入**: 不要直接执行用户输入
- ⚠️ **最小权限**: Hook 脚本应以最小必要权限运行

### 3\. 性能优化

- ⏱ **设置合理超时**: 根据脚本复杂度设置 timeout
- ⏱ **并行设计**: 避免 Hook 之间的依赖，充分利用并行执行
- ⏱ **缓存结果**: 对于重复计算，考虑缓存结果

### 4\. 调试技巧

**手动测试 Hook 脚本**:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"npm install"}}' | \
  python3 /path/to/your_hook.py
```

**调试输出**:

```python
# 在 Hook 脚本中输出调试信息
import sys

sys.stderr.write(f"[DEBUG] Processing command: {command}\n")
sys.stderr.flush()
```

### 5\. 配置管理

- 📁 **项目特定 Hook**: 放在 `<workspace>/.codebuddy/` 下，随项目版本控制
- 📁 **个人 Hook**: 放在 `~/.codebuddy/` 下，跨项目复用

---

## 性能优化建议

### 1\. 减少 Hook 执行时间

- ✅ **使用快速语言**: Shell 脚本通常比 Python 启动更快
- ✅ **避免重复工作**: 缓存计算结果
- ✅ **异步处理**: 非关键操作使用后台任务
- ✅ **提前退出**: 尽早判断是否需要处理

**示例**:

```python
# 不好的做法：每次都加载大文件
def main():
    with open('huge_config.json', 'r') as f:
        config = json.load(f)  # 每次都读取
    # ... 处理逻辑

# 好的做法：缓存配置
CONFIG_CACHE = None

def get_config():
    global CONFIG_CACHE
    if CONFIG_CACHE is None:
        with open('huge_config.json', 'r') as f:
            CONFIG_CACHE = json.load(f)
    return CONFIG_CACHE
```

### 2\. 优化 Matcher 配置

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/fast_check.sh",
            "timeout": 3
          }
        ]
      },
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/general_check.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 3\. 并行执行的注意事项

- 多个 Hook 会并行执行，不要依赖执行顺序
- 避免 Hook 之间的文件写入冲突
- 使用文件锁或原子操作处理共享资源
```python
import fcntl

def safe_append_log(message):
    """线程安全的日志写入"""
    with open('/tmp/hook.log', 'a') as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        f.write(message + '\n')
        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
```

---

## 安全最佳实践

### 1\. 输入验证

**永远不要信任输入数据**:

```python
def validate_input(input_data):
    """验证输入数据的完整性"""
    required_fields = ['hook_event_name', 'session_id']

    for field in required_fields:
        if field not in input_data:
            raise ValueError(f"Missing required field: {field}")

    # 验证字段类型
    if not isinstance(input_data.get('tool_input'), dict):
        raise ValueError("tool_input must be a dictionary")

    return True
```

### 2\. 命令注入防护

**不要直接执行用户输入**:

```python
# ❌ 危险：直接执行
os.system(f"echo {user_input}")

# ✅ 安全：使用参数化
import subprocess
subprocess.run(['echo', user_input], check=True)
```

### 3\. 路径遍历防护

```python
import os

def safe_file_access(file_path, project_dir):
    """确保文件路径在项目目录内"""
    abs_path = os.path.abspath(file_path)
    abs_project = os.path.abspath(project_dir)

    if not abs_path.startswith(abs_project):
        raise ValueError("Path traversal detected")

    return abs_path
```

### 4\. 权限最小化

```python
# Hook 脚本应该以最小权限运行
# 避免使用 sudo 或 root 权限

# ✅ 检查权限
if os.geteuid() == 0:
    print("Warning: Running as root is not recommended", file=sys.stderr)
```

---

## 高级用法

### 条件执行

在 Hook 脚本中根据条件决定是否处理：

```python
def main():
    input_data = json.loads(sys.stdin.read())

    # 仅在特定条件下处理
    if not should_process(input_data):
        print(json.dumps({"continue": True}))
        return 0

    # 执行处理逻辑
    ...
```

### 多规则组合

在一个 Hook 脚本中实现多个规则：

```python
def main():
    input_data = json.loads(sys.stdin.read())

    # 应用多个规则
    for rule in RULES:
        if rule.matches(input_data):
            return rule.apply(input_data)

    # 默认行为
    print(json.dumps({"continue": True}))
    return 0
```

### 外部服务集成

Hook 可以调用外部 API 或服务：

```python
import requests

def check_with_external_service(command):
    response = requests.post('https://api.example.com/validate',
                            json={'command': command},
                            timeout=5)
    return response.json()
```

---

## 常见问题

### Q1: Hook 没有被执行？

**检查清单**:

1. ✅ 配置文件路径正确 (`settings.json` 在 `.codebuddy` 目录下)
2. ✅ `hooks` 字段配置正确，JSON 格式有效
3. ✅ `matcher` 正则表达式能匹配目标
4. ✅ Hook 脚本有执行权限 (`chmod +x script.py`)
5. ✅ 脚本路径正确（推荐使用绝对路径）
6. ✅ 脚本第一行有正确的 shebang (`#!/usr/bin/env python3`)

### Q2: Hook 执行超时？

**解决方法**:

- 增加 `timeout` 配置值
- 优化 Hook 脚本性能
- 检查是否有死循环或阻塞操作

### Q3: 如何调试 Hook 脚本？

**调试步骤**:

1. 使用 `echo` 手动传入测试数据
2. 在脚本中使用 `sys.stderr` 输出调试信息
3. 验证 JSON 格式是否正确

### Q4: 多个 Hook 的执行顺序？

**答案**:

- Hook 并行执行，不保证执行顺序
- 如需顺序执行，将逻辑合并到一个 Hook 脚本中
- 相同命令会自动去重

### Q5: Hook 修改的参数不生效？

**检查要点**:

- 确保返回了 `modifiedInput` 字段
- 确保 `permissionDecision` 为 `allow`
- 检查字段名称是否与工具参数匹配
- 验证 JSON 格式正确
- 确保 `continue` 为 `true`

### Q6: SessionStart Hook 每次请求都触发？

**原因**: SessionStart 应该只在新会话触发一次

**解决方法**:

- 系统通过 `conversationId` 跟踪会话
- 同一会话中多次请求不会重复触发
- 如果仍有问题，查看日志中的会话 ID 是否变化

---

## 附录

### A. 完整的 HookInput 接口定义

```typescript
interface HookInput {
  // 通用字段
  session_id?: string;              // 会话 ID
  transcript_path?: string;          // 对话记录路径
  cwd?: string;                      // 当前工作目录
  hook_event_name: string;          // Hook 事件名称

  // SessionStart 专用（目前仅支持 'startup'）
  source?: 'startup';

  // UserPromptSubmit 专用
  prompt?: string;                   // 用户输入内容

  // PreToolUse/PostToolUse 专用
  tool_name?: string;                // 工具名称
  tool_input?: Record<string, any>;  // 工具输入参数
  tool_response?: any;               // 工具响应（仅 PostToolUse）

  // Stop 专用
  stop_hook_active?: boolean;        // 是否已激活 Stop Hook

  // PreCompact 专用
  trigger?: 'manual' | 'auto';       // 触发方式
  custom_instructions?: string;      // 自定义压缩指令
}
```

### B. 完整的 HookOutput 接口定义

```typescript
interface HookOutput {
  // 基本控制
  continue?: boolean;                // 是否继续执行（默认 true）
  stopReason?: string;               // 停止原因
  suppressOutput?: boolean;          // 是否隐藏输出
  systemMessage?: string;            // 系统消息

  // Hook 特定输出
  hookSpecificOutput?: {
    hookEventName: string;           // Hook 事件名称

    // PreToolUse 专用
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
    modifiedInput?: Record<string, any>;

    // SessionStart/UserPromptSubmit/PostToolUse 专用
    additionalContext?: string;      // 额外上下文
  };
}
```

### C. 环境变量列表

| 环境变量 | 说明 | 示例值 |
| --- | --- | --- |
| `CODEBUDDY_PROJECT_DIR` | 项目根目录 | `/path/to/project` |
| `CLAUDE_PROJECT_DIR` | 项目根目录（Claude Code 兼容） | `/path/to/project` |

### D. 退出码详细说明

| 退出码 | 含义 | stdout | stderr | 行为 |
| --- | --- | --- | --- | --- |
| **0** | 成功 | 作为结果处理 | 忽略 | 继续执行，可能注入上下文 |
| **1** | 警告 | 忽略 | 作为警告显示 | 继续执行 |
| **2** | 阻止/反馈 | 忽略 | 传递给 Agent | PreToolUse: 阻止执行 `<br>` Stop: 提供反馈 |
| **其他** | 错误 | 忽略 | 作为警告显示 | 继续执行 |

### E. 常用工具名称列表

> ⚠️ **重要说明** ：配置文件中的 `matcher` 支持双向别名匹配（写 CLI 风格或 IDE 风格都可以匹配）。但 **Hook 脚本接收到的 `tool_name`** 取决于运行环境：
> 
> - **IDE (Craft Agent)**: 使用 IDE 风格 (如 `execute_command`, `write_to_file`)
> - **CLI**: 使用 CLI 风格 (如 `Bash`, `Write`)

**工具名称映射表**:

| CLI 风格 | IDE 风格 | 功能说明 |
| --- | --- | --- |
| `Read` | `read_file` | 读取文件 |
| `Write` | `write_to_file` | 写入文件 |
| `Edit` | `replace_in_file` | 编辑/替换文件内容 |
| `Glob` | `list_dir` | 文件模式匹配/搜索文件 |
| `Grep` | `search_content` | 内容搜索 |
| `Bash` | `execute_command` | 执行 Shell 命令 |
| `Task` | `task` | 子代理任务 |
| `WebSearch` | `web_search` | 网络搜索 |
| `WebFetch` | `web_fetch` | 获取网页内容 |

---

## 总结

Hook 功能提供了强大的扩展能力，允许您在 AI Agent 的关键节点插入自定义逻辑。通过合理使用 Hook，您可以：

- 🛡️ **增强安全性**: 验证和阻止危险操作
- 🔧 **自动化流程**: 智能修改参数、自动备份文件
- 📊 **监控审计**: 记录工具执行日志
- 🎯 **定制行为**: 注入项目特定上下文

开始使用 Hook 功能，让您的 AI Agent 更智能、更安全、更符合项目需求！

**Happy Hooking! 🎣**