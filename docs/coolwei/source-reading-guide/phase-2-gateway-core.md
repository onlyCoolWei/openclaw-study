# 第二阶段：Gateway 核心（2-3 天）

**目标**：理解 Gateway 作为中央控制面的架构。这是整个系统的心脏。

---

## 2.1 Gateway 服务器

| 文件                                   | 关注点                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/gateway/server.ts`                | Gateway 公共导出                                                                       |
| `src/gateway/server.impl.ts`           | **核心文件**。Gateway 初始化全流程：加载配置 → 启动插件 → 注册频道 → 启动 HTTP/WS 服务 |
| `src/gateway/server-methods.ts`        | RPC 方法注册（WebSocket 消息处理）                                                     |
| `src/gateway/server-methods-list.ts`   | 所有 Gateway 方法和事件的枚举                                                          |
| `src/gateway/server-runtime-state.ts`  | Gateway 运行时状态管理                                                                 |
| `src/gateway/server-runtime-config.ts` | 运行时配置解析                                                                         |

**阅读技巧**：`server.impl.ts` 很长（看 import 就知道），但它是理解整个系统如何组装的关键。重点看 `startGateway` 函数的执行顺序。

---

## 2.2 频道管理

| 文件                                    | 关注点                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `src/gateway/server-channels.ts`        | `createChannelManager` — 频道生命周期管理              |
| `src/gateway/server-chat.ts`            | `createAgentEventHandler` — 消息如何从频道路由到 Agent |
| `src/gateway/config-reload.ts`          | 配置热重载机制                                         |
| `src/gateway/channel-health-monitor.ts` | 频道健康检查                                           |

---

## 详细解读

### Gateway 是什么？

Gateway 是 OpenClaw 的中央控制面，它：

- 监听来自各个聊天频道（Telegram、Discord、WhatsApp 等）的消息
- 将消息路由到对应的 AI Agent
- 管理 Agent 的执行和回复
- 提供 WebSocket API 供 Web UI 连接
- 管理插件的生命周期

可以把 Gateway 理解为一个"消息中枢"，所有消息都经过它。

### server.impl.ts — 系统组装

`startGateway` 是整个系统的组装函数，执行顺序大致如下：

```
startGateway()
  → 加载配置 (loadConfig)
  → 初始化插件系统 (pluginRegistry)
  → 加载并启动所有插件
  → 创建频道管理器 (createChannelManager)
  → 注册所有频道 (Telegram, Discord, ...)
  → 启动 HTTP 服务器
  → 启动 WebSocket 服务器
  → 注册 RPC 方法
  → 启动频道健康监控
  → 启动配置热重载监听
```

这个文件虽然很长，但它的价值在于展示了所有模块是如何被"粘合"在一起的。

### server-methods.ts — RPC 层

Gateway 通过 WebSocket 暴露 RPC 接口。Web UI 和 CLI 都通过这些 RPC 方法与 Gateway 通信。

常见的 RPC 方法包括：

- 发送消息
- 获取会话列表
- 获取频道状态
- 修改配置
- 管理 Agent

### server-channels.ts — 频道生命周期

`createChannelManager` 管理所有频道的生命周期：

```
频道注册 → 频道启动 → 消息监听 → 健康检查 → 频道停止/重启
```

每个频道插件实现了统一的接口（`ChannelPlugin`），频道管理器不关心具体是 Telegram 还是 Discord，只通过接口交互。

### server-chat.ts — 消息路由

`createAgentEventHandler` 是消息从频道到 Agent 的桥梁：

```
频道收到消息
  → createAgentEventHandler 处理
  → 解析 session key (channel:accountId)
  → 查找路由绑定 (resolve-route)
  → 找到目标 Agent
  → 调用 Agent Runner 执行
  → 将回复发回频道
```

### config-reload.ts — 热重载

Gateway 支持配置热重载，修改配置文件后无需重启：

- 监听配置文件变更
- 重新加载配置
- 对比差异，只重启受影响的频道/插件

### channel-health-monitor.ts — 健康检查

定期检查各频道的连接状态，发现异常时尝试重连。这是保证系统稳定性的关键机制。

---

## 练习建议

1. 启动 Gateway（`pnpm dev gateway run`），观察控制台输出，对照 `server.impl.ts` 理解启动顺序
2. 用 `openclaw channels status --probe` 查看频道状态，对照 `channel-health-monitor.ts` 理解健康检查
3. 修改配置文件，观察 Gateway 的热重载行为
4. 在 `server-chat.ts` 的 `createAgentEventHandler` 中加日志，发一条消息观察路由过程
