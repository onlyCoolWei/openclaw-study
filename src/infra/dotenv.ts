import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { resolveConfigDir } from "../utils.js";

/**
 * 加载 .env 环境变量文件。
 * 优先从当前工作目录加载，再从全局配置目录加载（不覆盖已有变量）。
 *
 * @param opts.quiet - 是否静默模式（默认 true，不输出警告信息）
 */
export function loadDotEnv(opts?: { quiet?: boolean }) {
  // 默认开启静默模式
  const quiet = opts?.quiet ?? true;

  // 第一步：从当前工作目录（process.cwd()）加载 .env 文件（dotenv 的默认行为）
  dotenv.config({ quiet });

  // 第二步：从全局配置目录加载 .env 作为兜底
  // 路径为 ~/.openclaw/.env（或由 OPENCLAW_STATE_DIR 环境变量指定的目录下的 .env）
  // override: false 表示不覆盖已经存在的环境变量
  const globalEnvPath = path.join(resolveConfigDir(process.env), ".env");

  // 如果全局 .env 文件不存在，直接返回
  if (!fs.existsSync(globalEnvPath)) {
    return;
  }

  dotenv.config({ quiet, path: globalEnvPath, override: false });
}
