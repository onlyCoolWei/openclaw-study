import { Command } from "commander";
import { registerProgramCommands } from "./command-registry.js";
import { createProgramContext } from "./context.js";
import { configureProgramHelp } from "./help.js";
import { registerPreActionHooks } from "./preaction.js";
import { setProgramContext } from "./program-context.js";

/**
 * 构建 CLI 程序实例的工厂函数。
 * 将一个空的 Commander 实例装配成"半成品" CLI 程序：
 * 包含全局配置、帮助格式、前置钩子和基础命令，
 * 但具体的业务子命令（agent、gateway、config 等）
 * 由 runCli 根据用户输入按需懒加载注册，以加快启动速度。
 */
export function buildProgram() {
  // 创建 Commander 根命令实例（即 `openclaw` 顶层命令）
  const program = new Command();
  // 创建共享上下文（版本号、配置、依赖注入等），供所有子命令访问
  const ctx = createProgramContext();
  const argv = process.argv;

  // 将上下文挂到 program 实例上，后续可通过 getProgramContext(program) 取回
  setProgramContext(program, ctx);
  // 定制帮助输出格式（banner、命令分组、示例等）
  configureProgramHelp(program, ctx);
  // 注册 preAction 钩子，在任何子命令执行前运行通用逻辑（版本检查、环境校验等）
  registerPreActionHooks(program, ctx.programVersion);

  // 注册全局选项（--dev、--no-color 等）和基础子命令
  registerProgramCommands(program, ctx, argv);

  return program;
}
