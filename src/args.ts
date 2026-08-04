/**
 * 命令行参数解析
 * 职责：把 CLI 参数转换为构建器选项，并校验模板名称。
 */
import type { BuildOptions, TemplateName } from "./types.js";
import { templateNames } from "./types.js";

/** 解析命令行参数。 */
export function parseArgs(args: string[]): BuildOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];

    if (!key || key === "--" || !key.startsWith("--")) {
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      flags.add(key);
      continue;
    }

    values.set(key.slice(2), value);
    index += 1;
  }

  const template = toTemplateName(values.get("template") ?? "warm-handbook");

  return {
    input: values.get("input") ?? "content/example.md",
    output: values.get("output") ?? `output/example-${template}.pdf`,
    outputProvided: values.has("output"),
    template,
    templateProvided: values.has("template"),
    themePath: values.get("theme"),
    all: flags.has("--all"),
    share: !flags.has("--no-share")
  };
}

function toTemplateName(value: string): TemplateName {
  if (templateNames.includes(value as TemplateName)) {
    return value as TemplateName;
  }

  throw new Error(`Unknown template "${value}". Available: ${templateNames.join(", ")}`);
}
