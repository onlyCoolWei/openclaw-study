#!/usr/bin/env node
/**
 * OpenClaw CLI 入口文件。
 *
 * 负责引导进程环境（编译缓存、环境变量规范化、警告过滤、颜色标志、
 * 认证存储守卫），然后根据情况执行以下分支之一：
 *   1. 如果需要，以 `--disable-warning=ExperimentalWarning` 重新派生子进程；
 *   2. 快速路径处理 `--version` / `--help`，无需加载完整命令树；
 *   3. 委托给 `runCli` 执行常规命令。
 *
 * 通过主模块守卫防止打包器将本文件作为共享依赖导入时重复执行。
 */
// ── 标准库 ──
import { spawn } from "node:child_process";
import { enableCompileCache } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";
// ── CLI 参数解析与策略 ──
import { isRootHelpInvocation, isRootVersionInvocation } from "./cli/argv.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./cli/profile.js";
import { shouldSkipRespawnForArgv } from "./cli/respawn-policy.js";
import { normalizeWindowsArgv } from "./cli/windows-argv.js";
// ── 基础设施工具 ──
import { isTruthyEnvValue, normalizeEnv } from "./infra/env.js";
import { isMainModule } from "./infra/is-main.js";
import { ensureOpenClawExecMarkerOnProcess } from "./infra/openclaw-exec-env.js";
import { installProcessWarningFilter } from "./infra/warning-filter.js";
// ── 子进程桥接（用于 respawn 场景下的信号转发） ──
import { attachChildProcessBridge } from "./process/child-process-bridge.js";

// 入口包装器映射：用于 isMainModule 判断当前文件是否为真正的主入口
const ENTRY_WRAPPER_PAIRS = [
  { wrapperBasename: "openclaw.mjs", entryBasename: "entry.js" },
  { wrapperBasename: "openclaw.js", entryBasename: "entry.js" },
] as const;

/**
 * 判断是否需要强制将认证存储设为只读模式。
 * 当用户执行 `openclaw secrets audit` 时，不应写入认证存储，
 * 以避免审计操作产生副作用。
 */
function shouldForceReadOnlyAuthStore(argv: string[]): boolean {
  // 过滤掉选项标志，只保留位置参数
  const tokens = argv.slice(2).filter((token) => token.length > 0 && !token.startsWith("-"));
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] === "secrets" && tokens[index + 1] === "audit") {
      return true;
    }
  }
  return false;
}

// 主模块守卫：仅当本文件是主入口时才执行下方逻辑。
// 打包器可能将 entry.js 作为共享依赖导入（实际入口是 dist/index.js），
// 如果没有这个守卫，runCli 会被重复调用，导致网关端口/锁冲突而崩溃。
if (
  !isMainModule({
    currentFile: fileURLToPath(import.meta.url),
    wrapperEntryPairs: [...ENTRY_WRAPPER_PAIRS],
  })
) {
  // 作为依赖被导入 —— 跳过所有入口副作用
} else {
  // ── 环境初始化阶段 ──
  const { installGaxiosFetchCompat } = await import("./infra/gaxios-fetch-compat.js");

  installGaxiosFetchCompat(); // 修补 gaxios 使其使用原生 fetch
  process.title = "openclaw"; // 设置进程标题，方便 ps/top 中识别
  ensureOpenClawExecMarkerOnProcess(); // 在 process 上打标记，防止嵌套调用
  installProcessWarningFilter(); // 过滤不需要的 Node.js 进程警告
  normalizeEnv(); // 规范化环境变量（大小写、别名等）
  if (!isTruthyEnvValue(process.env.NODE_DISABLE_COMPILE_CACHE)) {
    try {
      enableCompileCache(); // 启用 Node.js 编译缓存以加速启动
    } catch {
      // 尽力而为，不阻塞启动
    }
  }

  // 对 `secrets audit` 命令强制只读认证存储
  if (shouldForceReadOnlyAuthStore(process.argv)) {
    process.env.OPENCLAW_AUTH_STORE_READONLY = "1";
  }

  // 处理 --no-color 标志：同时设置两个环境变量确保所有库都尊重无色输出
  if (process.argv.includes("--no-color")) {
    process.env.NO_COLOR = "1";
    process.env.FORCE_COLOR = "0";
  }

  // ── 实验性警告抑制（respawn 机制） ──
  const EXPERIMENTAL_WARNING_FLAG = "--disable-warning=ExperimentalWarning";

  /** 检查当前进程是否已经抑制了 ExperimentalWarning */
  function hasExperimentalWarningSuppressed(): boolean {
    const nodeOptions = process.env.NODE_OPTIONS ?? "";
    // 检查 NODE_OPTIONS 环境变量
    if (nodeOptions.includes(EXPERIMENTAL_WARNING_FLAG) || nodeOptions.includes("--no-warnings")) {
      return true;
    }
    // 检查 Node.js 执行参数
    for (const arg of process.execArgv) {
      if (arg === EXPERIMENTAL_WARNING_FLAG || arg === "--no-warnings") {
        return true;
      }
    }
    return false;
  }

  /**
   * 确保 ExperimentalWarning 被抑制。如果当前进程尚未抑制，
   * 则派生一个带有该标志的子进程来替代执行，父进程不再继续。
   * 返回 true 表示已 respawn（父进程应停止后续逻辑）。
   */
  function ensureExperimentalWarningSuppressed(): boolean {
    // 以下情况不需要 respawn
    if (shouldSkipRespawnForArgv(process.argv)) {
      return false;
    }
    if (isTruthyEnvValue(process.env.OPENCLAW_NO_RESPAWN)) {
      return false;
    }
    if (isTruthyEnvValue(process.env.OPENCLAW_NODE_OPTIONS_READY)) {
      return false;
    }
    if (hasExperimentalWarningSuppressed()) {
      return false;
    }

    // 设置 respawn 守卫，防止无限递归派生
    process.env.OPENCLAW_NODE_OPTIONS_READY = "1";
    // 通过 Node CLI 参数传递标志（NODE_OPTIONS 不允许 --disable-warning）
    const child = spawn(
      process.execPath,
      [EXPERIMENTAL_WARNING_FLAG, ...process.execArgv, ...process.argv.slice(1)],
      {
        stdio: "inherit",
        env: process.env,
      },
    );

    // 桥接信号转发，确保 Ctrl+C 等信号能正确传递给子进程
    attachChildProcessBridge(child);

    child.once("exit", (code, signal) => {
      if (signal) {
        process.exitCode = 1;
        return;
      }
      process.exit(code ?? 1);
    });

    child.once("error", (error) => {
      console.error(
        "[openclaw] Failed to respawn CLI:",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exit(1);
    });

    // 父进程不应继续执行 CLI 逻辑
    return true;
  }

  /**
   * 快速路径：处理 `openclaw --version` / `openclaw -V`。
   * 无需加载完整命令树，直接输出版本号后退出。
   */
  function tryHandleRootVersionFastPath(argv: string[]): boolean {
    if (!isRootVersionInvocation(argv)) {
      return false;
    }
    Promise.all([import("./version.js"), import("./infra/git-commit.js")])
      .then(([{ VERSION }, { resolveCommitHash }]) => {
        const commit = resolveCommitHash({ moduleUrl: import.meta.url });
        // 如果能解析到 git commit hash，一并输出
        console.log(commit ? `OpenClaw ${VERSION} (${commit})` : `OpenClaw ${VERSION}`);
        process.exit(0);
      })
      .catch((error) => {
        console.error(
          "[openclaw] Failed to resolve version:",
          error instanceof Error ? (error.stack ?? error.message) : error,
        );
        process.exitCode = 1;
      });
    return true;
  }

  // ── 主执行流程 ──

  // 规范化 Windows 下的 argv（处理路径分隔符等差异）
  process.argv = normalizeWindowsArgv(process.argv);

  // 如果没有 respawn（即当前进程就是最终执行者），继续正常启动
  if (!ensureExperimentalWarningSuppressed()) {
    // 解析 CLI profile 参数（如 --profile=xxx）
    const parsed = parseCliProfileArgs(process.argv);
    if (!parsed.ok) {
      // 简单报错即可，Commander 后续会处理更丰富的帮助/错误信息
      console.error(`[openclaw] ${parsed.error}`);
      process.exit(2);
    }

    if (parsed.profile) {
      // 应用 profile 对应的环境变量
      applyCliProfileEnv({ profile: parsed.profile });
      // 更新 argv 以保持 Commander 和其他 argv 检查的一致性
      process.argv = parsed.argv;
    }

    // 尝试快速路径：--version，否则进入完整命令路由
    if (!tryHandleRootVersionFastPath(process.argv)) {
      runMainOrRootHelp(process.argv);
    }
  }
}

/**
 * 快速路径：处理 `openclaw --help` / `openclaw -h`。
 * 支持依赖注入以便测试，默认懒加载 root-help 模块。
 */
export function tryHandleRootHelpFastPath(
  argv: string[],
  deps: {
    outputRootHelp?: () => void;
    onError?: (error: unknown) => void;
  } = {},
): boolean {
  if (!isRootHelpInvocation(argv)) {
    return false;
  }
  const handleError =
    deps.onError ??
    ((error: unknown) => {
      console.error(
        "[openclaw] Failed to display help:",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    });
  if (deps.outputRootHelp) {
    try {
      deps.outputRootHelp();
    } catch (error) {
      handleError(error);
    }
    return true;
  }
  import("./cli/program/root-help.js")
    .then(({ outputRootHelp }) => {
      outputRootHelp();
    })
    .catch(handleError);
  return true;
}

/**
 * 主命令路由：先尝试 --help 快速路径，否则懒加载完整 CLI 命令树并执行。
 */
function runMainOrRootHelp(argv: string[]): void {
  if (tryHandleRootHelpFastPath(argv)) {
    return;
  }
  import("./cli/run-main.js")
    .then(({ runCli }) => runCli(argv))
    .catch((error) => {
      console.error(
        "[openclaw] Failed to start CLI:",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    });
}
