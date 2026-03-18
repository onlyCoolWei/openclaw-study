# OpenClaw 源码阅读路线图

> 面向前端开发者的系统性源码学习指南。建议按阶段顺序阅读，每个阶段都建立在前一阶段的理解之上。

## 阅读前准备

```bash
# 克隆并安装依赖
git clone https://github.com/openclaw/openclaw.git
pnpm install

# 确认能跑通构建和测试
pnpm build
pnpm test
```

工具推荐：VS Code + TypeScript 插件，善用 "Go to Definition" 和 "Find All References" 跟踪调用链。

---

## 第一阶段：入口与骨架（1-2 天）

**目标**：理解程序从启动到执行命令的完整链路。

### 1.1 程序入口

| 文件                               | 关注点                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/entry.ts`                     | 整个 CLI 的启动入口。看它如何处理 respawn 策略、profile 环境、compile cache，最终调用 `runCli` |
| `src/cli/run-main.ts`              | `runCli` 的实现，CLI 主循环                                                                    |
| `src/cli/program/build-program.ts` | 基于 Commander.js 构建命令树，理解子命令注册机制                                               |
| `src/cli/deps.ts`                  | `createDefaultDeps()` — 全局依赖注入模式，贯穿整个项目                                         |

**阅读技巧**：从 `entry.ts` 的 `if (isMainModule(...))` 分支开始，跟踪到 `runCli`，看命令是如何被路由到具体 handler 的。

### 1.2 配置系统

| 文件                             | 关注点                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| `src/config/config.ts`           | 配置模块的公共导出汇总（barrel file）                       |
| `src/config/io.ts`               | 配置的读写核心：`loadConfig`、`writeConfigFile`、运行时快照 |
| `src/config/types.ts`            | 主配置类型定义，了解 OpenClaw 有哪些可配置项                |
| `src/config/types.openclaw.ts`   | 顶层 `OpenClawConfig` 类型                                  |
| `src/config/schema.ts`           | Zod schema 校验，理解配置如何被验证                         |
| `src/config/env-substitution.ts` | 环境变量替换机制 `${ENV_VAR}`                               |
| `src/config/paths.ts`            | 配置文件路径解析（`~/.openclaw/` 等）                       |

**关键概念**：配置采用 YAML + Zod 校验 + 环境变量替换 + legacy 迁移的组合模式。理解 `loadConfig` → `validateConfigObject` 的流程。

---

## 第二阶段：Gateway 核心（2-3 天）

**目标**：理解 Gateway 作为中央控制面的架构。这是整个系统的心脏。

### 2.1 Gateway 服务器

| 文件                                   | 关注点                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/gateway/server.ts`                | Gateway 公共导出                                                                       |
| `src/gateway/server.impl.ts`           | **核心文件**。Gateway 初始化全流程：加载配置 → 启动插件 → 注册频道 → 启动 HTTP/WS 服务 |
| `src/gateway/server-methods.ts`        | RPC 方法注册（WebSocket 消息处理）                                                     |
| `src/gateway/server-methods-list.ts`   | 所有 Gateway 方法和事件的枚举                                                          |
| `src/gateway/server-runtime-state.ts`  | Gateway 运行时状态管理                                                                 |
| `src/gateway/server-runtime-config.ts` | 运行时配置解析                                                                         |

**阅读技巧**：`server.impl.ts` 很长（看 import 就知道），但它是理解整个系统如何组装的关键。重点看 `startGateway` 函数的执行顺序。

### 2.2 频道管理

| 文件                                    | 关注点                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `src/gateway/server-channels.ts`        | `createChannelManager` — 频道生命周期管理              |
| `src/gateway/server-chat.ts`            | `createAgentEventHandler` — 消息如何从频道路由到 Agent |
| `src/gateway/config-reload.ts`          | 配置热重载机制                                         |
| `src/gateway/channel-health-monitor.ts` | 频道健康检查                                           |

---

## 第三阶段：频道与消息路由（2-3 天）

**目标**：理解消息如何从聊天 App 到达 AI Agent。

### 3.1 频道注册表

| 文件                                   | 关注点                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/channels/registry.ts`             | 核心频道注册：Telegram、WhatsApp、Discord 等的元数据定义                                               |
| `src/channels/plugins/types.ts`        | **重要**。频道插件接口定义：`ChannelMessagingAdapter`、`ChannelAuthAdapter`、`ChannelStatusAdapter` 等 |
| `src/channels/plugins/types.plugin.ts` | `ChannelPlugin` 类型 — 一个频道插件需要实现什么                                                        |

### 3.2 消息路由

| 文件                            | 关注点                                            |
| ------------------------------- | ------------------------------------------------- |
| `src/routing/session-key.ts`    | Session Key 派生：channel + account → session key |
| `src/routing/account-id.ts`     | Account ID 归一化                                 |
| `src/routing/account-lookup.ts` | 账户查找逻辑                                      |
| `src/routing/resolve-route.ts`  | 路由解析：消息应该发给哪个 Agent                  |
| `src/routing/bindings.ts`       | Agent 绑定配置                                    |

**关键概念**：消息路由的核心是 Session Key = `channel:accountId`。每条消息通过 session key 找到对应的 Agent 和会话。

### 3.3 选一个频道深入（推荐 Telegram）

| 文件                                 | 关注点                                   |
| ------------------------------------ | ---------------------------------------- |
| `extensions/telegram/src/index.ts`   | 插件入口，看它如何注册为 ChannelPlugin   |
| `extensions/telegram/src/channel.ts` | Telegram 频道实现，各 Adapter 的具体逻辑 |

选 Telegram 是因为它是最简单的频道之一（Bot API），代码相对清晰。

---

## 第四阶段：Agent 与 AI 调用（3-4 天）

**目标**：理解 AI Agent 的执行流程，这是系统最复杂的部分。

### 4.1 Agent 运行器

| 文件                                   | 关注点                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| `src/agents/pi-embedded-runner.ts`     | Agent 运行器的公共导出                                   |
| `src/agents/pi-embedded-runner/run.ts` | `runEmbeddedPiAgent` — Agent 执行的核心入口              |
| `src/agents/pi-embedded-subscribe.ts`  | 流式订阅：处理 AI 返回的 stream 事件（文本、工具调用等） |
| `src/agents/pi-embedded-helpers.ts`    | Agent 辅助函数                                           |

### 4.2 工具系统

| 文件                           | 关注点                                                          |
| ------------------------------ | --------------------------------------------------------------- |
| `src/agents/pi-tools.ts`       | **核心**。所有内置工具的注册：bash、browser、canvas、文件读写等 |
| `src/agents/bash-tools.ts`     | Bash 工具实现（Agent 执行 shell 命令）                          |
| `src/agents/openclaw-tools.ts` | OpenClaw 专属工具（session 管理、subagent 等）                  |
| `src/agents/tools/common.ts`   | 工具类型定义                                                    |

### 4.3 模型配置与选择

| 文件                            | 关注点                       |
| ------------------------------- | ---------------------------- |
| `src/agents/models-config.ts`   | 模型配置加载与 Provider 发现 |
| `src/agents/model-selection.ts` | 模型选择逻辑                 |
| `src/agents/model-auth.ts`      | Auth Profile 轮换与 failover |
| `src/agents/model-fallback.ts`  | 模型自动降级                 |
| `src/agents/model-catalog.ts`   | 模型目录                     |

### 4.4 System Prompt

| 文件                                 | 关注点                       |
| ------------------------------------ | ---------------------------- |
| `src/agents/system-prompt.ts`        | System Prompt 构建逻辑       |
| `src/agents/system-prompt-params.ts` | Prompt 参数化                |
| `src/agents/identity.ts`             | 助手身份（名称、头像、人设） |

---

## 第五阶段：插件系统（1-2 天）

**目标**：理解插件的发现、加载和生命周期。

| 文件                                | 关注点                                          |
| ----------------------------------- | ----------------------------------------------- |
| `src/plugins/registry.ts`           | 插件注册表                                      |
| `src/plugins/runtime/index.ts`      | 插件运行时                                      |
| `src/plugins/types.ts`              | 插件类型定义：Hook 名称、Provider 插件、服务等  |
| `src/plugin-sdk/index.ts`           | **Plugin SDK 导出**。第三方插件能用到的所有 API |
| `src/plugins/hook-runner-global.ts` | 全局 Hook 运行器                                |

### 看一个扩展插件的实现

| 文件                                  | 关注点                           |
| ------------------------------------- | -------------------------------- |
| `extensions/discord/src/index.ts`     | Discord 扩展入口                 |
| `extensions/memory-core/src/index.ts` | Memory 扩展 — 非频道类插件的例子 |

**关键概念**：插件通过 `openclaw/plugin-sdk` 获取 API，通过 hooks 生命周期（`before-agent-start`、`model-override`、`after-tool-call` 等）参与系统运行。

---

## 第六阶段：Web UI（2-3 天）

**目标**：作为前端开发者，这部分你会最熟悉。

### 6.1 UI 架构

| 文件                         | 关注点                                 |
| ---------------------------- | -------------------------------------- |
| `ui/src/main.ts`             | UI 入口                                |
| `ui/src/ui/app.ts`           | 主应用组件                             |
| `ui/src/ui/app-lifecycle.ts` | 应用生命周期（连接 Gateway WebSocket） |
| `ui/src/ui/app-render.ts`    | 渲染逻辑                               |
| `ui/src/ui/gateway.ts`       | Gateway 通信层                         |
| `ui/src/ui/navigation.ts`    | 路由/导航                              |
| `ui/src/ui/theme.ts`         | 主题系统                               |
| `ui/src/ui/storage.ts`       | 本地存储                               |
| `ui/vite.config.ts`          | Vite 构建配置                          |

**技术栈**：Lit (Web Components) + Signals 状态管理。如果你熟悉 React，Lit 的概念类似但更轻量 — 组件就是自定义 HTML 元素。

### 6.2 核心视图

| 文件                             | 关注点     |
| -------------------------------- | ---------- |
| `ui/src/ui/views/chat.ts`        | 聊天界面   |
| `ui/src/ui/views/overview.ts`    | 总览仪表盘 |
| `ui/src/ui/views/channels.ts`    | 频道管理页 |
| `ui/src/ui/views/config-form.ts` | 配置表单   |
| `ui/src/ui/views/agents.ts`      | Agent 管理 |
| `ui/src/ui/views/sessions.ts`    | 会话管理   |

### 6.3 控制器层（数据逻辑）

| 文件                                | 关注点           |
| ----------------------------------- | ---------------- |
| `ui/src/ui/controllers/chat.ts`     | 聊天数据控制器   |
| `ui/src/ui/controllers/channels.ts` | 频道数据控制器   |
| `ui/src/ui/controllers/config.ts`   | 配置数据控制器   |
| `ui/src/ui/controllers/agents.ts`   | Agent 数据控制器 |
| `ui/src/ui/controllers/sessions.ts` | 会话数据控制器   |

**架构模式**：UI 采用 View + Controller 分离。View 负责渲染，Controller 负责与 Gateway WebSocket 通信和状态管理。

---

## 第七阶段：会话与记忆（1 天）

| 文件                                | 关注点                   |
| ----------------------------------- | ------------------------ |
| `src/sessions/session-id.ts`        | Session ID 生成与解析    |
| `src/sessions/model-overrides.ts`   | 每会话模型覆盖           |
| `src/sessions/send-policy.ts`       | 消息发送策略             |
| `src/sessions/transcript-events.ts` | 会话转录事件             |
| `src/agents/compaction.ts`          | 上下文压缩（长对话摘要） |

---

## 第八阶段：基础设施工具（按需阅读）

这些是支撑性模块，遇到时再深入。

| 模块     | 关键文件                                                  | 说明                   |
| -------- | --------------------------------------------------------- | ---------------------- |
| 环境变量 | `src/infra/env.ts`, `src/infra/dotenv.ts`                 | 环境变量处理           |
| 文件操作 | `src/infra/json-file.ts`, `src/infra/file-lock.ts`        | 原子化 JSON 读写       |
| 网络     | `src/infra/fetch.ts`, `src/infra/ws.ts`                   | HTTP 客户端、WebSocket |
| 端口管理 | `src/infra/ports.ts`                                      | 端口分配与检测         |
| 进程管理 | `src/infra/restart.ts`, `src/infra/process-respawn.ts`    | 进程重启策略           |
| 设备配对 | `src/infra/device-pairing.ts`                             | 移动设备配对           |
| 发现服务 | `src/infra/bonjour.ts`, `src/infra/tailscale.ts`          | mDNS / Tailscale       |
| 安全     | `src/infra/exec-approvals.ts`, `src/infra/exec-safety.ts` | 命令执行审批           |
| 更新     | `src/infra/update-check.ts`                               | 自动更新检查           |

---

## 附录：核心设计模式速查

### 依赖注入

```typescript
// 全局使用 createDefaultDeps() 模式
const deps = createDefaultDeps();
// deps 包含 config、logger、pluginRegistry 等
```

### 插件 Hook 生命周期

```
before-agent-start → model-override → [Agent 执行] → after-tool-call → message-hook
```

### 消息流转路径

```
用户消息 (WhatsApp/Telegram/...)
  → Channel Plugin (poll/webhook)
    → Gateway (server-chat.ts)
      → Route Resolution (routing/)
        → Agent Runner (pi-embedded-runner)
          → AI Provider (models-config)
            → Tool Execution (pi-tools)
              → Response Stream
                → Channel Plugin (send reply)
                  → 用户收到回复
```

### Session Key 归一化

```
channel:accountId → session key → agent binding → session store
例: telegram:123456 → default agent → ~/.openclaw/agents/default/sessions/
```

### 配置加载链

```
YAML 文件 → JSON5 解析 → 环境变量替换 → Zod 校验 → Legacy 迁移 → Runtime Snapshot
```

---

## 学习建议

1. **先跑起来**：`pnpm dev` 启动开发模式，配一个 Telegram Bot 体验完整流程，建立感性认识
2. **跟踪一条消息**：从 Telegram 收到消息开始，一路跟踪到 AI 回复发出，这条链路串起了大部分核心模块
3. **善用测试**：每个模块都有 `*.test.ts`，测试文件是理解模块行为的最佳文档
4. **UI 先行**：作为前端开发者，可以从 `ui/` 开始，通过 Controller 层反向理解后端 Gateway API
5. **写一个小插件**：参考 `extensions/` 下的简单插件，动手写一个，是理解插件系统最快的方式
6. **不要贪多**：这个项目很大（`src/agents/` 就有 300+ 文件），按阶段推进，每个阶段确保理解了再往下走
