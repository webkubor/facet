/**
 * 分页回归检查：代码块里的 `## xxx` 不得被当成章节分页点。
 *
 * 这个 bug 修过一次（2026-08-28，11 页 → 8 页），随后 src/talk.ts 被另一处
 * 编辑覆盖、inFence 丢失，bug 原地复活。纯靠注释守不住，加一条能跑的检查。
 *
 * 用法：node scripts/check-talk-pagination.mjs
 * 退出码非 0 即回归。
 */
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

// 正文两个章节，其中一个贴了带 `##` 的 markdown 模板——模板里的标题不该分页
const FIXTURE = `---
title: "分页回归夹具"
subtitle: "代码块里的 ## 不该分页"
author: "test"
date: "2026-01-01"
---

# 分页回归夹具

开场段落。

## 真章节一

正文里贴一份 markdown 模板：

\`\`\`markdown
# AGENTS.md

## 这是什么
一句话说明。

## 常用命令
- npm run build

## 约定
- 别乱改
\`\`\`

模板到此结束。

## 真章节二

结束段落。
`;

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "facet-pagination-"));
  const input = join(dir, "fixture.md");
  const output = join(dir, "fixture.talk.html");
  await writeFile(input, FIXTURE, "utf8");

  try {
    await run("npx", ["tsx", "src/build.ts", "--input", input, "--talk", "--output", output], { cwd: projectRoot });
    const html = await readFile(output, "utf8");
    const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);

    // 封面章节导航同样不能混进代码块里的标题（buildToc 也要挖掉围栏）
    const navText = (html.match(/<nav class="cover-nav">[\s\S]*?<\/nav>/) ?? [""])[0];
    const navLeaked = ["这是什么", "常用命令", "约定"].filter((t) => navText.includes(t));
    if (navLeaked.length) {
      console.error(`❌ 目录回归：封面章节导航混进了代码块里的标题 → ${navLeaked.join("、")}`);
      console.error(`   修法：src/markdown.ts 的 buildToc 要先 stripFencedBlocks 再扫标题。`);
      process.exit(1);
    }

    const leaked = ["这是什么", "常用命令", "约定"].filter((t) => labels.includes(t));
    const expected = ["真章节一", "真章节二"].filter((t) => labels.includes(t));

    if (leaked.length) {
      console.error(`❌ 分页回归：代码块里的标题变成了独立页 → ${leaked.join("、")}`);
      console.error(`   实际页序：${labels.join(" | ")}`);
      console.error(`   修法：src/talk.ts 的 splitChapters 要跟踪 \`\`\` 围栏状态（inFence），围栏内的 ## 不分页。`);
      process.exit(1);
    }
    if (expected.length !== 2) {
      console.error(`❌ 真章节没被正确切分，实际页序：${labels.join(" | ")}`);
      process.exit(1);
    }

    console.log(`✅ 分页正确：${labels.join(" | ")}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
