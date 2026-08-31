/**
 * 生成 share 站：facet 把每份带 slug 的 content/*.md 投影成两个刻面，
 * 加一张索引页，产物落在 dist-share/，可直接 wrangler pages deploy。
 *
 *   dist-share/
 *     index.html                  往期索引
 *     <slug>/index.html           阅读版（read）
 *     <slug>/talk.html            演讲版（talk）
 *     llms.txt                    给 LLM 的内容清单
 *     robots.txt                  放行 AI 爬虫
 *
 * 发布口径：front matter 里**有 slug 才发布**。简历、草稿、私有内容
 * 不写 slug 就天然被排除，不用另维护一份清单——清单就是内容本身。
 *
 * 用法：node scripts/build-site.mjs [--theme themes/bloom-sage.json]
 */
import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const contentDir = join(projectRoot, "content");
const distDir = join(projectRoot, "dist-share");
const avatarSource = join(projectRoot, "docs", "brand", "webkubor-avatar.jpg");
const avatarOutput = join(distDir, "assets", "webkubor-avatar.jpg");

const args = process.argv.slice(2);
const themeArg = args.indexOf("--theme");
const theme = themeArg >= 0 ? args[themeArg + 1] : "themes/bloom-sage.json";

const SITE = {
  name: "webkubor 的技术交流",
  domain: "share.webkubor.online",
  intro: "每期一份实践记录：我做了什么、翻了什么车、还有哪些没想清楚。"
};

/** 只取 front matter 的几个字段，不引 md 解析器——这里只需要元信息。 */
function readFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function main() {
  const files = (await readdir(contentDir)).filter((f) => f.endsWith(".md"));
  const posts = [];

  for (const file of files) {
    const raw = await readFile(join(contentDir, file), "utf8");
    const meta = readFrontMatter(raw);
    if (!meta.slug) continue; // 没有 slug = 不发布
    posts.push({ file, ...meta });
  }

  if (!posts.length) {
    console.log("没有可发布的内容：给要发布的 content/*.md 加一个 slug 字段。");
    return;
  }

  posts.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await mkdir(join(distDir, "assets"), { recursive: true });
  await copyFile(avatarSource, avatarOutput);

  for (const post of posts) {
    const outDir = join(distDir, post.slug);
    await mkdir(outDir, { recursive: true });
    const input = `content/${post.file}`;

    for (const [flag, out] of [["--read", `dist-share/${post.slug}/index.html`], ["--talk", `dist-share/${post.slug}/talk.html`]]) {
      await run("npx", ["tsx", "src/build.ts", "--input", input, flag, "--theme", theme, "--output", out], { cwd: projectRoot });
    }
    console.log(`  ✅ ${post.slug}  ${post.title ?? ""}`);
  }

  await writeFile(join(distDir, "index.html"), renderIndex(posts), "utf8");
  await writeFile(join(distDir, "llms.txt"), renderLlmsTxt(posts), "utf8");
  // 放行 AI 爬虫：这站讲的就是这件事，自己先做到
  await writeFile(join(distDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: https://${SITE.domain}/sitemap.xml\n`, "utf8");
  await writeFile(join(distDir, "sitemap.xml"), renderSitemap(posts), "utf8");

  console.log(`\n共 ${posts.length} 期 → dist-share/`);
  console.log(`部署：CLOUDFLARE_ACCOUNT_ID=916ebb1b9f240bf4c8826021dd161692 npx wrangler pages deploy dist-share --project-name=facet-share --branch=main`);
}

function renderIndex(posts) {
  const items = posts.map((p) => `
      <li class="entry">
        <a class="entry-main" href="/${escapeHtml(p.slug)}/">
          ${p.series ? `<span class="entry-series">${escapeHtml(p.series)}</span>` : ""}
          <h2>${escapeHtml(p.title ?? p.slug)}</h2>
          ${p.subtitle ? `<p class="entry-sub">${escapeHtml(p.subtitle)}</p>` : ""}
        </a>
        <p class="entry-meta">
          <span>${escapeHtml(p.date ?? "")}</span>
          <a href="/${escapeHtml(p.slug)}/">阅读版</a>
          <a href="/${escapeHtml(p.slug)}/talk">演讲版</a>
        </p>
      </li>`).join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(SITE.name)}</title>
<meta name="description" content="${escapeHtml(SITE.intro)}" />
<style>
:root{--paper:oklch(97% 0.01 115);--ink:oklch(25% 0.02 115);--muted:oklch(45% 0.02 45);--faint:color-mix(in oklch,oklch(25% 0.02 115),transparent 85%);--soft:oklch(92% 0.01 115);--accent:oklch(54% 0.11 115);--display-font:"Source Han Serif SC","Songti SC",serif;--body-font:"Inter","PingFang SC",sans-serif;--avatar-size:48px}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body-font);line-height:1.7;-webkit-font-smoothing:antialiased}
.shell{max-width:760px;margin:0 auto;padding:88px 24px 96px}
h1{font-family:var(--display-font);font-size:38px;margin:0 0 12px}
.author{align-items:center;display:flex;gap:12px;margin:14px 0 18px}
.author-avatar{border:1px solid var(--faint);border-radius:50%;display:block;height:var(--avatar-size);object-fit:cover;object-position:50% 32%;width:var(--avatar-size)}
.author-copy{display:grid;gap:1px;line-height:1.3}
.author-name{font-size:14px;font-weight:650;letter-spacing:.02em}
.author-role{color:var(--muted);font-size:12.5px}
.intro{color:var(--muted);font-size:17px;margin:0 0 8px}
.count{color:var(--muted);font-size:14px;margin:0 0 40px;padding-bottom:28px;border-bottom:1px solid var(--faint)}
ul{list-style:none;padding:0;margin:0}
.entry{padding:26px 0;border-bottom:1px solid var(--faint)}
.entry-main{display:block;text-decoration:none;color:inherit}
.entry-main:hover h2{color:var(--accent)}
.entry-series{display:inline-block;font-size:12.5px;letter-spacing:.08em;color:var(--muted);border:1px solid var(--faint);border-radius:999px;padding:3px 11px;margin-bottom:10px}
.entry h2{font-family:var(--display-font);font-size:24px;line-height:1.4;margin:0 0 6px;transition:color .15s}
.entry-sub{color:var(--muted);font-size:15.5px;margin:0}
.entry-meta{margin:14px 0 0;font-size:14px;color:var(--muted)}
.entry-meta a{color:var(--accent);text-decoration:none;margin-left:16px}
.entry-meta a:hover{text-decoration:underline}
footer{margin-top:56px;color:var(--muted);font-size:13.5px}
@media(max-width:600px){.shell{padding:52px 18px 72px}h1{font-size:30px}}
</style>
</head>
<body>
<div class="shell">
  <h1>${escapeHtml(SITE.name)}</h1>
  <div class="author">
    <img class="author-avatar" src="/assets/webkubor-avatar.jpg" alt="webkubor 的头像" width="48" height="48" />
    <div class="author-copy"><span class="author-name">webkubor</span><span class="author-role">个人技术分享</span></div>
  </div>
  <p class="intro">${escapeHtml(SITE.intro)}</p>
  <p class="count">共 ${posts.length} 期</p>
  <ul>${items}
  </ul>
  <footer>${escapeHtml(SITE.domain)} · 由 <a href="https://github.com/webkubor/facet" style="color:var(--accent)">facet</a> 生成</footer>
</div>
</body>
</html>
`;
}

function renderLlmsTxt(posts) {
  return [
    `# ${SITE.name}`,
    "",
    `> ${SITE.intro}`,
    "",
    "每期都有两个形态：阅读版（连续长文）与演讲版（一屏一章节的幻灯片），内容同源。",
    "",
    "## 往期",
    "",
    ...posts.map((p) => `- [${p.title ?? p.slug}](https://${SITE.domain}/${p.slug}/)：${p.subtitle ?? ""}`),
    "",
    "## 关于",
    "",
    `- 作者：webkubor`,
    `- 生成工具：https://github.com/webkubor/facet`,
    ""
  ].join("\n");
}

function renderSitemap(posts) {
  const urls = [`https://${SITE.domain}/`, ...posts.flatMap((p) => [`https://${SITE.domain}/${p.slug}/`, `https://${SITE.domain}/${p.slug}/talk`])];
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls.map((u) => `  <url><loc>${u}</loc></url>`),
    `</urlset>`,
    ""
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
