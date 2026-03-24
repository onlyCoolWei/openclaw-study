# 第六阶段：Web UI（2-3 天）

**目标**：作为前端开发者，这部分你会最熟悉。

---

## 6.1 UI 架构

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

---

## 6.2 核心视图

| 文件                             | 关注点     |
| -------------------------------- | ---------- |
| `ui/src/ui/views/chat.ts`        | 聊天界面   |
| `ui/src/ui/views/overview.ts`    | 总览仪表盘 |
| `ui/src/ui/views/channels.ts`    | 频道管理页 |
| `ui/src/ui/views/config-form.ts` | 配置表单   |
| `ui/src/ui/views/agents.ts`      | Agent 管理 |
| `ui/src/ui/views/sessions.ts`    | 会话管理   |

---

## 6.3 控制器层（数据逻辑）

| 文件                                | 关注点           |
| ----------------------------------- | ---------------- |
| `ui/src/ui/controllers/chat.ts`     | 聊天数据控制器   |
| `ui/src/ui/controllers/channels.ts` | 频道数据控制器   |
| `ui/src/ui/controllers/config.ts`   | 配置数据控制器   |
| `ui/src/ui/controllers/agents.ts`   | Agent 数据控制器 |
| `ui/src/ui/controllers/sessions.ts` | 会话数据控制器   |

**架构模式**：UI 采用 View + Controller 分离。View 负责渲染，Controller 负责与 Gateway WebSocket 通信和状态管理。

---

## 详细解读

### 技术栈选型

OpenClaw Web UI 使用了一套轻量但现代的前端技术栈：

- **Lit** — Google 的 Web Components 库，比 React 更轻量
- **Signals** — 响应式状态管理（类似 Vue 的 ref/reactive）
- **Vite** — 构建工具
- **TypeScript** — 类型安全

### Lit 快速入门（对比 React）

```typescript
// React 组件
function ChatView({ messages }) {
  return <div>{messages.map(m => <Message key={m.id} data={m} />)}</div>
}

// Lit 组件（等价）
@customElement('chat-view')
class ChatView extends LitElement {
  @property() messages = [];
  render() {
    return html`<div>${this.messages.map(m => html`<message-item .data=${m}></message-item>`)}</div>`;
  }
}
```

核心差异：

- Lit 组件是真正的 HTML 自定义元素（`<chat-view>`）
- 使用 `html` tagged template 代替 JSX
- 属性通过 `@property()` 装饰器声明
- Shadow DOM 提供样式隔离

### 应用架构

```
main.ts (入口)
  → app.ts (主应用组件)
    → app-lifecycle.ts (连接 Gateway WebSocket)
    → app-render.ts (根据路由渲染视图)
    → navigation.ts (路由管理)
    → gateway.ts (WebSocket 通信层)
```

### gateway.ts — 通信层

这是 UI 与后端 Gateway 通信的核心：

```typescript
// 通过 WebSocket 发送 RPC 请求
gateway.call("sendMessage", { sessionId, content: "Hello" });

// 监听 Gateway 推送的事件
gateway.on("agent-stream", (event) => {
  // 处理 AI 的流式回复
});
```

### View + Controller 模式

每个页面由 View 和 Controller 两部分组成：

- **View** (`views/chat.ts`) — 纯渲染逻辑，接收数据并渲染 UI
- **Controller** (`controllers/chat.ts`) — 数据逻辑，负责：
  - 通过 Gateway WebSocket 获取数据
  - 管理本地状态（Signals）
  - 处理用户交互事件
  - 将数据传递给 View

这种分离使得 UI 组件可以独立测试，Controller 也可以被复用。

### 聊天界面 (chat.ts)

聊天界面是最复杂的视图，它需要处理：

- 消息列表渲染（支持 Markdown、代码高亮）
- AI 流式回复的实时更新
- 工具调用的可视化展示
- 消息输入和发送
- 会话切换

### 主题系统 (theme.ts)

支持亮色/暗色主题切换，通过 CSS 自定义属性实现：

```css
:host {
  --bg-primary: var(--theme-bg-primary);
  --text-primary: var(--theme-text-primary);
}
```

---

## 练习建议

1. 启动 UI 开发服务器，打开浏览器 DevTools 查看 Web Components 结构
2. 在 `gateway.ts` 中加日志，观察 WebSocket 消息的收发
3. 修改 `views/chat.ts` 的样式，体验 Lit 的 Shadow DOM 样式隔离
4. 阅读 `controllers/chat.ts`，理解聊天数据的获取和状态管理
5. 对比 View 和 Controller 的职责划分，思考这种模式与 React hooks 的异同
