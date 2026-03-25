import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "../infra/dotenv.js";
import { normalizeEnv } from "../infra/env.js";
import { formatUncaughtError } from "../infra/errors.js";
import { isMainModule } from "../infra/is-main.js";
import { ensureOpenClawCliOnPath } from "../infra/path-env.js";
import { assertSupportedRuntime } from "../infra/runtime-guard.js";
import { installUnhandledRejectionHandler } from "../infra/unhandled-rejections.js";
import { enableConsoleCapture } from "../logging.js";
import {
  getCommandPathWithRootOptions,
  getPrimaryCommand,
  hasHelpOrVersion,
  isRootHelpInvocation,
} from "./argv.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";
import { tryRouteCli } from "./route.js";
import { normalizeWindowsArgv } from "./windows-argv.js";

/**
 * 关闭所有内存搜索管理器（LanceDB 等）。
 * CLI 进程退出前的清理操作，采用尽力而为策略——失败不阻塞退出。
 */
async function closeCliMemoryManagers(): Promise<void> {
  try {
    const { closeAllMemorySearchManagers } = await import("../memory/search-manager.js");
    await closeAllMemorySearchManagers();
  } catch {
    // 尽力清理，失败不影响进程退出
  }
}

/**
 * 将 `--update` 标志重写为 `update` 子命令。
 * 允许用户使用 `openclaw --update` 作为 `openclaw update` 的快捷方式。
 */
export function rewriteUpdateFlagArgv(argv: string[]): string[] {
  const index = argv.indexOf("--update");
  if (index === -1) {
    return argv;
  }

  const next = [...argv];
  next.splice(index, 1, "update");
  return next;
}

/**
 * 判断是否需要注册主子命令。
 * 当用户仅请求 --help 或 --version 时，无需加载完整命令树。
 */
export function shouldRegisterPrimarySubcommand(argv: string[]): boolean {
  return !hasHelpOrVersion(argv);
}

/**
 * 判断是否可以跳过插件命令注册。
 * 优化策略：如果主命令已经是内置命令，就不需要扫描和注册插件命令了；
 * 如果没有主命令且用户只是请求帮助/版本信息，也可以跳过。
 */
export function shouldSkipPluginCommandRegistration(params: {
  argv: string[];
  primary: string | null;
  hasBuiltinPrimary: boolean;
}): boolean {
  if (params.hasBuiltinPrimary) {
    return true;
  }
  if (!params.primary) {
    return hasHelpOrVersion(params.argv);
  }
  return false;
}

/**
 * 判断是否需要确保 openclaw CLI 在 PATH 中可用。
 * 某些只读/轻量命令（status、health、config get 等）不需要修改 PATH，
 * 跳过可以加快启动速度。--help / --version 同理。
 */
export function shouldEnsureCliPath(argv: string[]): boolean {
  if (hasHelpOrVersion(argv)) {
    return false;
  }
  const [primary, secondary] = getCommandPathWithRootOptions(argv, 2);
  if (!primary) {
    return true;
  }
  // 只读查询类命令不需要确保 PATH
  if (primary === "status" || primary === "health" || primary === "sessions") {
    return false;
  }
  if (primary === "config" && (secondary === "get" || secondary === "unset")) {
    return false;
  }
  if (primary === "models" && (secondary === "list" || secondary === "status")) {
    return false;
  }
  return true;
}

/**
 * 判断是否走根帮助快速路径（`openclaw --help` / `openclaw -h`）。
 * 快速路径直接输出帮助信息，无需构建完整的 Commander 命令树。
 */
export function shouldUseRootHelpFastPath(argv: string[]): boolean {
  return isRootHelpInvocation(argv);
}

/**
 * CLI 主执行函数。整个 CLI 的核心调度入口，负责：
 * 1. 规范化参数和环境
 * 2. 尝试快速路径（--help）和路由短路（tryRouteCli）
 * 3. 构建 Commander 命令树并解析执行
 * 4. 退出前清理资源
 */
export async function runCli(argv: string[] = process.argv) {
  // ── 参数规范化与 profile 处理 ──
  let normalizedArgv = normalizeWindowsArgv(argv);
  const parsedProfile = parseCliProfileArgs(normalizedArgv);
  if (!parsedProfile.ok) {
    throw new Error(parsedProfile.error);
  }
  if (parsedProfile.profile) {
    // 应用 profile 对应的环境变量（如 dev/staging 等配置集）
    applyCliProfileEnv({ profile: parsedProfile.profile });
  }
  normalizedArgv = parsedProfile.argv;

  // ── 环境初始化 ──
  loadDotEnv({ quiet: true }); // 加载 .env 文件中的环境变量
  normalizeEnv(); // 规范化环境变量（大小写、别名等）
  if (shouldEnsureCliPath(normalizedArgv)) {
    ensureOpenClawCliOnPath(); // 确保 openclaw 可执行文件在 PATH 中
  }

  // 在执行任何实际工作前，检查 Node.js 运行时版本是否满足最低要求
  assertSupportedRuntime();

  try {
    // ── 快速路径：根帮助 ──
    if (shouldUseRootHelpFastPath(normalizedArgv)) {
      const { outputRootHelp } = await import("./program/root-help.js");
      outputRootHelp();
      return;
    }

    // ── 路由短路：某些命令可以绕过完整的 Commander 命令树直接处理 ──
    if (await tryRouteCli(normalizedArgv)) {
      return;
    }

    // ── 完整命令树路径 ──

    // 将 console 输出捕获为结构化日志，同时保持 stdout/stderr 的正常行为
    enableConsoleCapture();

    // 构建 Commander 程序实例（注册全局选项、钩子等）
    const { buildProgram } = await import("./program.js");
    const program = buildProgram();

    // 安装全局错误处理器，防止未捕获的异常/rejection 导致静默崩溃
    installUnhandledRejectionHandler();

    process.on("uncaughtException", (error) => {
      console.error("[openclaw] Uncaught exception:", formatUncaughtError(error));
      process.exit(1);
    });

    // 将 `--update` 重写为 `update` 子命令
    const parseArgv = rewriteUpdateFlagArgv(normalizedArgv);

    // 提取主命令名称（如 "gateway"、"agent"、"config" 等）
    const primary = getPrimaryCommand(parseArgv);
    if (primary) {
      // 按需注册主命令（内置核心命令 + subcli 扩展命令），
      // 采用懒加载策略，只注册用户实际调用的命令，加快启动速度
      const { getProgramContext } = await import("./program/program-context.js");
      const ctx = getProgramContext(program);
      if (ctx) {
        const { registerCoreCliByName } = await import("./program/command-registry.js");
        await registerCoreCliByName(program, ctx, primary, parseArgv);
      }
      const { registerSubCliByName } = await import("./program/register.subclis.js");
      await registerSubCliByName(program, primary);
    }

    // 判断主命令是否已经是内置命令
    const hasBuiltinPrimary =
      primary !== null && program.commands.some((command) => command.name() === primary);
    // 如果主命令已内置，则跳过插件命令扫描以节省启动时间
    const shouldSkipPluginRegistration = shouldSkipPluginCommandRegistration({
      argv: parseArgv,
      primary,
      hasBuiltinPrimary,
    });
    if (!shouldSkipPluginRegistration) {
      // 在解析前注册插件提供的 CLI 命令（如第三方扩展注册的子命令）
      const { registerPluginCliCommands } = await import("../plugins/cli.js");
      const { loadValidatedConfigForPluginRegistration } =
        await import("./program/register.subclis.js");
      const config = await loadValidatedConfigForPluginRegistration();
      if (config) {
        registerPluginCliCommands(program, config);
      }
    }

    // 交给 Commander 解析并执行命令
    await program.parseAsync(parseArgv);
  } finally {
    // 无论成功还是失败，都清理内存搜索管理器等资源
    await closeCliMemoryManagers();
  }
}

/**
 * 判断当前文件是否作为主模块运行（而非被其他模块导入）。
 * 用于防止 run-main.ts 被间接 import 时意外触发 CLI 逻辑。
 */
export function isCliMainModule(): boolean {
  return isMainModule({ currentFile: fileURLToPath(import.meta.url) });
}
