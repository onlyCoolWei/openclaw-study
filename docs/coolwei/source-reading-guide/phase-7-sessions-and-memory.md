# 第七阶段：会话与记忆（1 天）

---

## 核心文件

| 文件                                | 关注点                   |
| ----------------------------------- | ------------------------ |
| `src/sessions/session-id.ts`        | Session ID 生成与解析    |
| `src/sessions/model-overrides.ts`   | 每会话模型覆盖           |
| `src/sessions/send-policy.ts`       | 消息发送策略             |
| `src/sessions/transcript-events.ts` | 会话转录事件             |
| `src/agents/compaction.ts`          | 上下文压缩（长对话摘要） |

---

## 详细解读

### Session ID 生成与解析

`session-id.ts` 负责生成和解析 Session ID。每个会话都有一个唯一的 ID，格式通常包含：

- Agent ID
- 时间戳
- 随机后缀

Session ID 用于：

- 定位会话存储目录
- 关联会话的所有消息和事件
- 在 UI 中标识和切换会话

### 每会话模型覆盖

`model-overrides.ts` 允许在会话级别覆盖模型配置：

```yaml
# 全局配置使用 Claude
model: claude-sonnet-4-20250514

# 但某个特定会话可以覆盖为 GPT-4
# 通过 UI 或 API 设置
```

这在调试或对比不同模型效果时很有用。

### 消息发送策略

`send-policy.ts` 控制消息如何被发送到频道：

- 是否需要等待 AI 完成所有工具调用后再发送
- 是否支持流式发送（边生成边发送）
- 不同频道的发送限制（比如 Telegram 的消息长度限制）

### 会话转录事件

`transcript-events.ts` 定义了会话中所有可能的事件类型：

```typescript
type TranscriptEvent =
  | { type: 'user-message'; content: string }
  | { type: 'assistant-message'; content: string }
  | { type: 'tool-call'; name: string; input: any }
  | { type: 'tool-result'; output: any }
  | { type: 'system'; content: string }
  | ...
```

这些事件被持久化到会话文件中（JSONL 格式），构成完整的对话历史。

### 上下文压缩

`compaction.ts` 解决了长对话的上下文窗口限制问题：

```
对话历史超过模型上下文窗口
  → 触发压缩
  → 将早期对话摘要为简短总结
  → 保留最近的完整对话
  → 摘要 + 最近对话 = 新的上下文
```

压缩策略：

- 保留最近 N 轮完整对话
- 将更早的对话用 AI 生成摘要
- 摘要作为 system message 注入上下文

这是保证长对话质量的关键机制。

---

## 练习建议

1. 查看 `~/.openclaw/agents/default/sessions/` 目录，打开一个 `.jsonl` 文件理解会话存储格式
2. 在 `compaction.ts` 中加日志，发送足够多的消息触发上下文压缩，观察压缩过程
3. 通过 UI 修改某个会话的模型覆盖，观察 `model-overrides.ts` 的行为
4. 阅读 `send-policy.ts`，理解不同频道的发送策略差异
