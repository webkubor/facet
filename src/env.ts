/**
 * 环境变量支持
 * 职责：加载项目根目录 .env 文件，并对 front matter 值做 ${VAR} 插值，
 * 让真实联系方式等隐私信息不必写进仓库内的 Markdown。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

/** 读取项目根目录 .env（不存在则跳过），不覆盖已有的 process.env。 */
export function loadDotEnv(): void {
  let raw: string;

  try {
    raw = readFileSync(path.resolve(projectRoot, ".env"), "utf8");
  } catch {
    return;
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** 替换 ${VAR} 和 ${VAR:-默认值}；未定义且无默认值时保留原文。 */
export function interpolateEnv(value: string): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (raw, name: string, fallback?: string) => {
    return process.env[name] ?? fallback ?? raw;
  });
}
