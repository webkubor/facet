/**
 * CLI 帮助 / 版本 / 错误出口
 * 职责：让 `facet --help`、`facet --version`、无参数调用、用户输入错误都给出一段可读输出，
 * 而不是 Node 的未捕获异常栈。
 *
 * 为什么单独成文件：build.ts 顶层 `await main()`，一被 import 就开跑，测不到；
 * 这里只放纯函数，入口只负责调用。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";
import { resumeTemplateNames, tutorialTemplateNames } from "./types.js";

/** 包版本（读包内 package.json，不硬编码，避免发版后漂移）。 */
export function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function helpText(): string {
  return `facet ${readVersion()} — 一份 Markdown，排成 PDF / 长图 / 讲稿页 / 简历

用法
  facet --input <file.md> [--template <name>] [--output <file.pdf>] [选项]

常用
  facet --input post.md                                   默认模板 warm-handbook，输出到 output/
  facet --input post.md --template wechat-magazine --output post.pdf
  facet --input post.md --all                             一次出全部教程模板
  facet --input talk.md --talk --output talk.html         讲稿页（一屏一页）
  facet --input post.md --split                           按字数自动插分页标记

选项
  --input <path>        Markdown 源文件（相对当前目录）
  --output <path>       输出路径（相对当前目录）；PDF 旁会同时生成 .html 与 .share.png
  --template <name>     排版模板，见下方清单
  --theme <path>        自定义主题 JSON
  --all                 用全部教程模板各出一份
  --talk                讲稿页模式        --read     阅读页模式
  --no-share            不生成分享长图
  --split               自动分页；配 --split-target <n>（默认 250）/ --split-max <n>（默认 380）
  --from-html <path>    从已有 HTML 生成讲稿页
  -h, --help            显示本帮助       -v, --version  显示版本

模板
  教程：${tutorialTemplateNames.join(", ")}
  简历：${resumeTemplateNames.join(", ")}

首次使用
  PDF / 长图靠 Playwright 的 Chromium 渲染，第一次需要下载浏览器：
    npx playwright install chromium

  npm 上不带 scope 的 \`facet\` 是另一个无关的包；临时运行请写全名：
    npx @webkubor/facet --input post.md
`;
}

/**
 * 是否该直接打印帮助：没传 --input，且当前目录下也没有默认示例 content/example.md。
 * 仓库内 `pnpm build`（无参数）依赖这个默认示例，所以只在示例不存在时拦截。
 */
export function shouldShowUsage(argv: string[], cwd: string): boolean {
  if (argv.includes("--input") || argv.includes("--from-html")) return false;
  return !existsSync(path.join(cwd, "content/example.md"));
}

/** 顶层错误出口：默认一行可读信息，FACET_DEBUG=1 时保留完整栈。 */
export function formatFatal(error: unknown): string {
  if (process.env.FACET_DEBUG) {
    return error instanceof Error ? (error.stack ?? error.message) : String(error);
  }
  const err = error as NodeJS.ErrnoException;
  if (err?.code === "ENOENT" && err.path) {
    return `facet: 找不到文件 ${err.path}\n（facet --help 查看用法；FACET_DEBUG=1 显示完整栈）`;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/Executable doesn't exist|playwright install/i.test(message)) {
    return "facet: 缺少 Playwright 浏览器，先运行一次：npx playwright install chromium";
  }
  return `facet: ${message.split("\n")[0]}\n（FACET_DEBUG=1 显示完整栈）`;
}
