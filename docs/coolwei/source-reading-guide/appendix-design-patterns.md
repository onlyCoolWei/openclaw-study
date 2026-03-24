# 附录：核心设计模式速查

---

## 依赖注入

```typescript
// 全局使用 createDefaultDeps() 模式
const deps = createDefaultDeps();
// deps 包含 config、logger、pluginRegistry 等
```

---

## 插件 Hook 生命周期

```
before-agent-start → model-override → [Agent 执行] → after-tool-call → message-hook
```

---

## 消息流转路径

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

---

## Session Key 归一化

```
channel:accountId → session key → agent binding → session store
例: telegram:123456 → default agent → ~/.openclaw/agents/default/sessions/
```

---

## 配置加载链

```
YAML 文件 → JSON5 解析 → 环境变量替换 → Zod 校验 → Legacy 迁移 → Runtime Snapshot
```
