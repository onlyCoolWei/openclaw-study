# 第四阶段：Agent 与 AI 调用（3-4 天）

**目标**：理解 AI Agent 的执行流程，这是系统最复杂的部分。

---

## 4.1 Agent 运行器

| 文件                                   | 关注点                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| `src/agents/pi-embedded-runner.ts`     | Agent 运行器的公共导出                                   |
| `src/agents/pi-embedded-runner/run.ts` | `runEmbeddedPiAgent` — Agent 执行的核心入口              |
| `src/agents/pi-embedded-subscribe.ts`  | 流式订阅：处理 AI 返回的 stream 事件（文本、工具调用等） |
| `src/agents/pi-embedded-helpers.ts`    | Agent 辅助函数                                           |

---

## 4.2 工具系统

| 文件                           | 关注点                                                          |
| ------------------------------ | --------------------------------------------------------------- |
| `src/agents/pi-tools.ts`       | **核心**。所有内置工具的注册：bash、browser、canvas、文件读写等 |
| `src/agents/bash-tools.ts`     | Bash 工具实现（Agent 执行 shell 命令）                          |
| `src/agents/openclaw-tools.ts` | OpenClaw 专属工具（session 管理、subagent 等）                  |
| `src/agents/tools/common.ts`   | 工具类型定义                                                    |

---

## 4.3 模型配置与选择

| 文件                            | 关注点                       |
| ------------------------------- | ---------------------------- |
| `src/agents/models-config.ts`   | 模型配置加载与 Provider 发现 |
| `src/agents/model-selection.ts` | 模型选择逻辑                 |
| `src/agents/model-auth.ts`      | Auth Profile 轮换与 failover |
| `src/agents/model-fallback.ts`  | 模型自动降级                 |
| `src/agents/model-catalog.ts`   | 模型目录                     |

---

## 4.4 System Prompt

| 文件                                 | 关注点                       |
| ------------------------------------ | ---------------------------- |
| `src/agents/system-prompt.ts`        | System Prompt 构建逻辑       |
| `src/agents/system-prompt-params.ts` | Prompt 参数化                |
| `src/agents/identity.ts`             | 助手身份（名称、头像、人设） |

---

## 详细解读

### Agent 执行流程

Agent 的执行是一个循环过程（agentic loop）：

```
收到用户消息
  → 构建 System Prompt
  → 选择模型 (model-selection)
  → 发送请求到 AI Provider
  → 流式接收响应
  → 如果响应包含工具调用：
      → 执行工具 (pi-tools)
      → 将工具结果追加到上下文
      → 回到"发送请求"步骤（循环）
  → 如果响应是纯文本：
      → 返回给用户
```

这个循环就是 `runEmbeddedPiAgent` 的核心逻辑。

### pi-embedded-runner/run.ts — Agent 核心

这是 Agent 执行的入口函数，关键步骤：

1. **构建上下文**：收集历史消息、system prompt、工具定义
2. **模型选择**：根据配置和可用性选择 AI 模型
3. **流式调用**：向 AI Provider 发起流式请求
4. **事件处理**：处理返回的 stream 事件（文本块、工具调用、完成信号）
5. **工具执行**：如果 AI 请求调用工具，执行工具并将结果反馈
6. **循环**：重复步骤 2-5 直到 AI 返回最终文本回复

### pi-embedded-subscribe.ts — 流式订阅

处理 AI 返回的 Server-Sent Events (SSE) 流：

```typescript
// 事件类型
type StreamEvent =
  | { type: 'text'; content: string }        // 文本块
  | { type: 'tool_use'; name: string; ... }  // 工具调用请求
  | { type: 'stop'; reason: string }         // 停止信号
  | { type: 'error'; ... }                   // 错误
```

### 工具系统

`pi-tools.ts` 注册了所有内置工具，AI Agent 可以调用这些工具来完成任务：

- **bash** — 执行 shell 命令
- **browser** — 浏览网页
- **file_read / file_write** — 读写文件
- **canvas** — 画布操作
- **subagent** — 启动子 Agent

每个工具定义包含：

- `name` — 工具名称
- `description` — 工具描述（给 AI 看的）
- `inputSchema` — 输入参数的 JSON Schema
- `handler` — 实际执行函数

### 模型选择与降级

模型选择是一个多层决策过程：

```
用户配置的模型
  → 检查 Auth Profile 是否可用
  → 如果不可用 → 尝试 failover 到备选 Profile
  → 如果所有 Profile 都不可用 → 模型降级 (fallback)
  → 最终选定模型 + Auth Profile
```

关键文件：

- `model-selection.ts` — 选择逻辑
- `model-auth.ts` — Auth Profile 管理（支持多个 API Key 轮换）
- `model-fallback.ts` — 降级策略（比如 Claude → GPT-4 → GPT-3.5）
- `model-catalog.ts` — 所有支持的模型列表

### System Prompt 构建

System Prompt 不是一个静态字符串，而是动态构建的：

```
基础身份 (identity.ts)
  + Agent 配置的自定义 prompt
  + 工具描述
  + 频道特定指令
  + 会话上下文
  = 最终 System Prompt
```

`system-prompt-params.ts` 支持参数化，比如 `{{agent_name}}`、`{{channel}}` 等占位符会被替换为实际值。

---

## 练习建议

1. 在 `pi-embedded-runner/run.ts` 中加日志，发一条消息观察 Agent 的完整执行循环
2. 阅读 `pi-tools.ts`，理解一个工具是如何被定义和注册的
3. 尝试在配置中切换模型，观察 `model-selection.ts` 的选择过程
4. 阅读 `system-prompt.ts`，理解 System Prompt 是如何被动态组装的
5. 跟踪一次工具调用的完整流程：AI 请求调用 bash → bash-tools.ts 执行 → 结果返回给 AI
