/**
 * 加密文档发布自检 + 清单输出
 *
 * 为什么要有这个脚本（2026-09-16 的真实事故）：
 *   新加一篇加密文档「山鬼映画 · museav.top 入门手册」时，只做了「写 md + 在 build/notify 里登记」，
 *   漏了把 slug 加进 `wrangler.toml` 的 `PROTECTED_PATHS`。结果那篇**付费手册免密码公开**在分享站上
 *   （实测 200，而 proposal/faq 都是 401）。这个坑靠人记是记不住的，所以做成命令。
 *
 * 它做三件事：
 *   ① 配置一致性：build-site 里登记的每个受保护 slug，必须在 `PROTECTED_PATHS` 里 —— 就是漏掉的那一步；
 *   ② 线上验证：逐个请求线上地址，必须是 401（要密码）；出现 200 直接失败；
 *   ③ 输出清单：把 slug / 标题 / 完整链接 打出来，**发布后请把这张表里的链接报给开发者**，
 *      并同步到 `docs/encrypted-delivery.md` 的清单（加密文档不进站点公开列表，不记就等于丢）。
 *
 * 用法：node scripts/verify-protected.mjs（或 pnpm verify:protected）
 * 退出码：0 = 全部受保护且配置一致；1 = 有漏配或线上未受保护（会打印修复步骤）
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");

/** 读 .env（不覆盖已有环境变量），只为拿 SITE_DOMAIN */
async function loadEnv() {
  const envPath = join(projectRoot, ".env");
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

/**
 * 从 build-site.mjs 里抠出受保护文档清单。
 * 用正则而不是 import：那个脚本的顶层就会真的构建，import 等于跑一次全量构建。
 * 前提是登记格式稳定（{ src, slug, title }）——它就在「新增加密文档在这里登记」那段注释旁边。
 */
function parseProtectedDocs(source) {
  const block = source.match(/const PROTECTED = \[([\s\S]*?)\n\s*\];/);
  if (!block) throw new Error("在 scripts/build-site.mjs 里找不到 PROTECTED 数组（格式变了？请同步本脚本）");
  const docs = [];
  const re = /\{\s*src:\s*"([^"]+)"\s*,\s*slug:\s*"([^"]+)"\s*,\s*title:\s*"([^"]+)"/g;
  for (const m of block[1].matchAll(re)) docs.push({ src: m[1], slug: m[2], title: m[3] });
  return docs;
}

/** 从 wrangler.toml 里读 PROTECTED_PATHS */
function parseProtectedPaths(source) {
  const m = source.match(/PROTECTED_PATHS\s*=\s*"([^"]*)"/);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  await loadEnv();
  const domain = process.env.SITE_DOMAIN || "share.webkubor.online";

  const buildSrc = await readFile(join(projectRoot, "scripts/build-site.mjs"), "utf8");
  const wranglerSrc = await readFile(join(projectRoot, "wrangler.toml"), "utf8");

  const docs = parseProtectedDocs(buildSrc);
  const paths = parseProtectedPaths(wranglerSrc);

  console.log(`\n🔒 加密文档自检（${domain}）\n${"─".repeat(64)}`);

  // ① 配置一致性 —— 漏这一步就是「文档公开」
  const missing = docs.filter((d) => !paths.includes(`/${d.slug}`));
  if (missing.length) {
    console.error("\n❌ 配置不一致：下面这些文档在 build 里登记了，但没进 wrangler.toml 的 PROTECTED_PATHS：");
    for (const d of missing) console.error(`   · ${d.slug}（${d.title}）`);
    console.error("\n   不修的话它们会**免密码公开**。修法：");
    console.error(`   把 /${missing.map((d) => d.slug).join(",/")} 追加进 wrangler.toml 的 PROTECTED_PATHS，然后重新部署。`);
    console.error("（已存在的路径若已失效，也从 PROTECTED_PATHS 里删掉，避免死登记）\n");
  }

  // ② 线上验证：必须 401
  console.log("\n检查线上是否真的要密码（期望全部 401）：");
  const rows = [];
  let insecure = 0;
  for (const d of docs) {
    const url = `https://${domain}/${d.slug}/`;
    let code = "ERR";
    try {
      const r = await fetch(url, { redirect: "manual" });
      code = String(r.status);
    } catch (e) {
      code = `ERR(${e.message.slice(0, 24)})`;
    }
    const ok = code === "401";
    if (!ok) insecure++;
    rows.push({ slug: d.slug, title: d.title, url, code, ok, src: d.src });
    console.log(`  ${ok ? "✅" : "❌"} ${String(code).padEnd(4)} ${d.slug}`);
  }

  // ③ 清单（给人用：复制这些链接）
  console.log(`\n${"─".repeat(64)}\n📋 加密文档清单（发布后请把链接报给开发者，并同步进 docs/encrypted-delivery.md）\n`);
  for (const r of rows) console.log(`  ${r.title}\n    ${r.url}\n    源码（仅本机，未入 git）：${r.src}`);

  const failed = missing.length > 0 || insecure > 0;
  if (failed) {
    console.error(`\n❌ 自检未通过：${missing.length} 项漏配、${insecure} 项线上未受保护。`);
    console.error("   出现 200 说明文档公开可读 —— 先补 PROTECTED_PATHS 再重新部署，别急着把链接发出去。\n");
  } else {
    console.log(`\n✅ 全部 ${rows.length} 篇均已受保护（401），配置一致。\n`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("自检脚本出错：", err.message);
  process.exit(1);
});
