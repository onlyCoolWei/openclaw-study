# 第一阶段：入口与骨架（1-2 天）

**目标**：理解程序从启动到执行命令的完整链路。

---

## 1.1 程序入口

| 文件                               | 关注点                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/entry.ts`                     | 整个 CLI 的启动入口。看它如何处理 respawn 策略、profile 环境、compile cache，最终调用 `runCli` |
| `src/cli/run-main.ts`              | `runCli` 的实现，CLI 主循环                                                                    |
| `src/cli/program/build-program.ts` | 基于 Commander.js 构建命令树，理解子命令注册机制                                               |
| `src/cli/deps.ts`                  | `createDefaultDeps()` — 全局依赖注入模式，贯穿整个项目                                         |

**阅读技巧**：从 `entry.ts` 的 `if (isMainModule(...))` 分支开始，跟踪到 `runCli`，看命令是如何被路由到具体 handler 的。

---

## 1.2 配置系统

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

## 详细解读

### entry.ts — 一切的起点

`src/entry.ts` 是整个 CLI 的入口文件。打开它后，重点关注以下几个方面：

1. **isMainModule 判断**：这是 ESM 模块中判断"当前文件是否被直接执行"的标准方式。只有直接运行时才会进入 CLI 启动流程，被 import 时不会触发。

2. **Respawn 策略**：OpenClaw 在某些情况下会重新启动自身进程（比如环境变量变更后）。看 `process-respawn.ts` 的引用来理解这个机制。

3. **Compile Cache**：Node.js 22+ 的 compile cache 特性，用于加速 TypeScript 编译。

4. **Profile 环境**：支持多 profile 运行，不同 profile 使用不同的配置目录。

### run-main.ts — CLI 主循环

`runCli` 函数是 CLI 的核心调度器：

```
runCli()
  → 解析命令行参数
  → 加载配置
  → 创建依赖 (createDefaultDeps)
  → 路由到具体命令 handler
```

### build-program.ts — 命令注册

基于 Commander.js 构建命令树。每个子命令（`gateway`、`agent`、`config`、`message` 等）都在这里注册。理解这个文件就理解了 CLI 的所有能力边界。

### deps.ts — 依赖注入

`createDefaultDeps()` 是整个项目的依赖注入核心。它创建一个包含以下内容的对象：

- `config` — 配置实例
- `logger` — 日志器
- `pluginRegistry` — 插件注册表
- 其他共享服务

这个模式避免了全局单例，使得测试和模块解耦更容易。

### 配置系统深入

配置加载的完整链路：

```
YAML 文件 (~/.openclaw/openclaw.yaml)
  → JSON5 解析
  → 环境变量替换 (${ENV_VAR} → 实际值)
  → Zod Schema 校验
  → Legacy 字段迁移
  → Runtime Snapshot (不可变配置快照)
```

重点理解：

- `io.ts` 中的 `loadConfig` 是配置加载的入口
- `schema.ts` 中的 Zod schema 定义了配置的完整结构和校验规则
- `env-substitution.ts` 允许在配置中使用 `${OPENAI_API_KEY}` 这样的环境变量引用
- `paths.ts` 定义了 `~/.openclaw/` 下各种文件的路径约定

---

## 练习建议

1. 在 `entry.ts` 的 `runCli` 调用处打断点，用 `pnpm dev config show` 跟踪完整的启动流程
2. 修改 `~/.openclaw/openclaw.yaml` 中的一个配置项，在 `loadConfig` 中加日志观察配置加载过程
3. 尝试理解 `createDefaultDeps()` 返回的对象中每个字段的用途
