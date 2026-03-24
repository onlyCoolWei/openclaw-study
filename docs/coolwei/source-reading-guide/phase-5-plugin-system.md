# 第五阶段：插件系统（1-2 天）

**目标**：理解插件的发现、加载和生命周期。

---

## 核心文件

| 文件                                | 关注点                                          |
| ----------------------------------- | ----------------------------------------------- |
| `src/plugins/registry.ts`           | 插件注册表                                      |
| `src/plugins/runtime/index.ts`      | 插件运行时                                      |
| `src/plugins/types.ts`              | 插件类型定义：Hook 名称、Provider 插件、服务等  |
| `src/plugin-sdk/index.ts`           | **Plugin SDK 导出**。第三方插件能用到的所有 API |
| `src/plugins/hook-runner-global.ts` | 全局 Hook 运行器                                |

---

## 看一个扩展插件的实现

| 文件                                  | 关注点                           |
| ------------------------------------- | -------------------------------- |
| `extensions/discord/src/index.ts`     | Discord 扩展入口                 |
| `extensions/memory-core/src/index.ts` | Memory 扩展 — 非频道类插件的例子 |

**关键概念**：插件通过 `openclaw/plugin-sdk` 获取 API，通过 hooks 生命周期（`before-agent-start`、`model-override`、`after-tool-call` 等）参与系统运行。

---

## 详细解读

### 插件架构概览

OpenClaw 的插件系统是一个典型的"发现 → 加载 → 注册 → 生命周期"模式：

```
插件发现 (扫描 extensions/ 目录)
  → 加载插件模块 (动态 import)
  → 调用插件的 register() 函数
  → 插件注册 hooks、providers、services
  → Gateway 在合适的时机触发 hooks
```

### registry.ts — 插件注册表

插件注册表是所有已加载插件的中央存储。它维护：

- 已注册的插件列表
- 每个插件提供的 hooks
- 每个插件提供的 providers（频道、模型等）
- 每个插件提供的 services

### types.ts — 插件类型

定义了插件系统的核心类型：

```typescript
// 插件可以注册的 Hook 类型
type HookName =
  | 'before-agent-start'    // Agent 开始执行前
  | 'model-override'        // 覆盖模型选择
  | 'after-tool-call'       // 工具调用完成后
  | 'message-hook'          // 消息处理钩子
  | ...

// 插件可以提供的 Provider 类型
type ProviderType =
  | 'channel'               // 频道插件 (Telegram, Discord...)
  | 'model'                 // 模型 Provider
  | 'memory'                // 记忆存储
  | ...
```

### plugin-sdk/index.ts — SDK 导出

这是第三方插件开发者使用的 API 入口。它导出了：

- Hook 注册函数
- Provider 注册函数
- 配置读取工具
- 日志工具
- 消息发送工具

### hook-runner-global.ts — Hook 运行器

当系统触发一个 hook 时，hook 运行器负责：

1. 查找所有注册了该 hook 的插件
2. 按优先级排序
3. 依次调用每个插件的 hook handler
4. 收集和合并结果

### Hook 生命周期

```
before-agent-start
  → model-override
  → [Agent 执行循环]
      → before-tool-call
      → [工具执行]
      → after-tool-call
  → message-hook
  → after-agent-complete
```

### 扩展插件示例

**Discord 扩展** (`extensions/discord/src/index.ts`)：

- 频道类插件的典型实现
- 注册为 `channel` provider
- 实现 `ChannelPlugin` 接口

**Memory Core 扩展** (`extensions/memory-core/src/index.ts`)：

- 非频道类插件的例子
- 注册为 `memory` provider
- 通过 hooks 参与 Agent 执行流程

---

## 练习建议

1. 阅读 `plugin-sdk/index.ts` 的导出列表，了解插件能做什么
2. 对比 Discord 和 Memory Core 两个扩展，理解不同类型插件的差异
3. 在 `hook-runner-global.ts` 中加日志，观察 hook 的触发顺序
4. 尝试写一个最简单的插件：只注册一个 `before-agent-start` hook，打印一条日志
5. 阅读 `extensions/` 下其他插件的 `package.json`，理解插件的依赖管理方式
