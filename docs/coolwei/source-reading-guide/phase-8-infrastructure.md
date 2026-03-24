# 第八阶段：基础设施工具（按需阅读）

这些是支撑性模块，遇到时再深入。

---

## 模块速查

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

## 详细解读

这些模块是整个系统的"水电煤"，不需要一次性全部阅读，遇到时再深入即可。

### 环境变量 — env.ts / dotenv.ts

处理环境变量的加载和解析。支持 `.env` 文件和系统环境变量。`dotenv.ts` 实现了 `.env` 文件的解析逻辑。

### 文件操作 — json-file.ts / file-lock.ts

- `json-file.ts`：原子化的 JSON 文件读写，确保并发安全
- `file-lock.ts`：文件锁实现，防止多进程同时写入同一文件

这在 Gateway 和 CLI 可能同时访问配置文件时尤为重要。

### 网络 — fetch.ts / ws.ts

- `fetch.ts`：封装的 HTTP 客户端，支持重试、超时、代理
- `ws.ts`：WebSocket 客户端封装，用于 UI 与 Gateway 通信

### 端口管理 — ports.ts

Gateway 需要监听 HTTP/WebSocket 端口。`ports.ts` 负责：

- 检测端口是否被占用
- 自动分配可用端口
- 端口冲突处理

### 进程管理 — restart.ts / process-respawn.ts

- `restart.ts`：Gateway 重启逻辑
- `process-respawn.ts`：进程 respawn 策略（比如配置变更后重启）

### 设备配对 — device-pairing.ts

移动设备（iOS/Android）与 Gateway 的配对流程。通过二维码或手动输入配对码建立连接。

### 发现服务 — bonjour.ts / tailscale.ts

- `bonjour.ts`：mDNS 服务发现，用于局域网内自动发现 Gateway
- `tailscale.ts`：Tailscale VPN 集成，支持远程访问 Gateway

### 安全 — exec-approvals.ts / exec-safety.ts

- `exec-approvals.ts`：命令执行审批机制（AI Agent 执行 shell 命令前需要用户确认）
- `exec-safety.ts`：命令安全检查（阻止危险命令）

### 更新 — update-check.ts

自动检查 OpenClaw 新版本，提示用户更新。

---

## 练习建议

1. 遇到某个基础设施模块时，先看它的 `*.test.ts` 文件理解行为
2. `exec-safety.ts` 是安全相关的关键模块，值得仔细阅读
3. `json-file.ts` 的原子化写入实现是一个常见的工程模式，可以学习借鉴
