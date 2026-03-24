# 第三阶段：频道与消息路由（2-3 天）

**目标**：理解消息如何从聊天 App 到达 AI Agent。

---

## 3.1 频道注册表

| 文件                                   | 关注点                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/channels/registry.ts`             | 核心频道注册：Telegram、WhatsApp、Discord 等的元数据定义                                               |
| `src/channels/plugins/types.ts`        | **重要**。频道插件接口定义：`ChannelMessagingAdapter`、`ChannelAuthAdapter`、`ChannelStatusAdapter` 等 |
| `src/channels/plugins/types.plugin.ts` | `ChannelPlugin` 类型 — 一个频道插件需要实现什么                                                        |

---

## 3.2 消息路由

| 文件                            | 关注点                                            |
| ------------------------------- | ------------------------------------------------- |
| `src/routing/session-key.ts`    | Session Key 派生：channel + account → session key |
| `src/routing/account-id.ts`     | Account ID 归一化                                 |
| `src/routing/account-lookup.ts` | 账户查找逻辑                                      |
| `src/routing/resolve-route.ts`  | 路由解析：消息应该发给哪个 Agent                  |
| `src/routing/bindings.ts`       | Agent 绑定配置                                    |

**关键概念**：消息路由的核心是 Session Key = `channel:accountId`。每条消息通过 session key 找到对应的 Agent 和会话。

---

## 3.3 选一个频道深入（推荐 Telegram）

| 文件                                 | 关注点                                   |
| ------------------------------------ | ---------------------------------------- |
| `extensions/telegram/src/index.ts`   | 插件入口，看它如何注册为 ChannelPlugin   |
| `extensions/telegram/src/channel.ts` | Telegram 频道实现，各 Adapter 的具体逻辑 |

选 Telegram 是因为它是最简单的频道之一（Bot API），代码相对清晰。

---

## 详细解读

### 频道插件接口

每个频道插件需要实现一组 Adapter 接口，这是典型的策略模式：

```typescript
interface ChannelPlugin {
  // 消息收发
  messaging: ChannelMessagingAdapter;
  // 认证
  auth: ChannelAuthAdapter;
  // 状态查询
  status: ChannelStatusAdapter;
  // 生命周期
  lifecycle: ChannelLifecycleAdapter;
}
```

不同的聊天平台（Telegram、Discord、WhatsApp）各自实现这些接口，Gateway 通过统一接口与它们交互。

### 消息路由详解

消息路由是连接"频道"和"Agent"的桥梁。核心流程：

```
用户在 Telegram 发消息
  → Telegram 插件收到消息
  → 提取 accountId (Telegram user ID)
  → 构建 session key: "telegram:123456"
  → resolve-route: 查找该 session key 绑定的 Agent
  → 如果有绑定 → 路由到对应 Agent
  → 如果没有绑定 → 使用默认 Agent
```

### Session Key 归一化

`session-key.ts` 负责将不同频道的用户标识归一化为统一格式：

```
telegram:123456        → Telegram 用户
discord:789012345678   → Discord 用户
whatsapp:8613800138000 → WhatsApp 用户
web:session-uuid       → Web UI 用户
```

这个归一化确保了同一个用户在同一个频道上的消息总是路由到同一个会话。

### Account ID 归一化

`account-id.ts` 处理不同频道的用户 ID 格式差异：

- Telegram 使用数字 ID
- Discord 使用 snowflake ID
- WhatsApp 使用电话号码
- Web 使用 UUID

### 路由解析

`resolve-route.ts` 的核心逻辑：

1. 根据 session key 查找显式绑定（用户手动配置的 Agent 绑定）
2. 如果没有显式绑定，使用默认 Agent
3. 支持通配符绑定（比如某个频道的所有用户都路由到同一个 Agent）

### Telegram 频道实现

推荐从 Telegram 入手，因为它的实现最直观：

**`extensions/telegram/src/index.ts`** — 插件入口：

- 注册为 ChannelPlugin
- 声明频道元数据（名称、图标、配置 schema）

**`extensions/telegram/src/channel.ts`** — 核心实现：

- `messaging` adapter：通过 Telegram Bot API 收发消息
- `auth` adapter：验证 Bot Token
- `status` adapter：检查 Bot 连接状态
- `lifecycle` adapter：启动/停止轮询

Telegram 使用长轮询（long polling）获取新消息，这比 webhook 更简单，适合本地开发。

---

## 练习建议

1. 在 `session-key.ts` 中加日志，发一条 Telegram 消息，观察 session key 的生成过程
2. 阅读 `resolve-route.ts`，理解路由优先级：显式绑定 > 频道默认 > 全局默认
3. 对比 Telegram 和 Discord 的频道实现，理解接口抽象的价值
4. 尝试在配置中添加一个 Agent 绑定，观察路由行为的变化
