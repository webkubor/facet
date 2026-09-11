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

/**
 * 把 output/ 里已经生成好的"独立 HTML 案例页"自动复制到 dist-share/。
 * 这些页面不走 facet 的 markdown 构建流程，但属于站点内容的一部分。
 * 同时通过 facet 的 --from-html + --talk 自动生成对应的演讲版（*.talk.html）。
 * 增加新案例时：把 .html 放进 output/，再在 PAGES 数组里加一行即可。
 */
async function copyStandalonePages() {
  const PAGES = [
    {
      src: "output/financial-ai-call-cost-case.html",
      dest: "financial-ai-call-cost-case.html",
      title: "金融行业 AI 外呼落地成本评估"
    }
    // { src: 'output/xxx.html', dest: 'xxx.html', title: 'xxx' },  // ← 未来加新案例在这里登记
  ];
  const { existsSync } = await import("node:fs");
  for (const page of PAGES) {
    const srcPath = join(projectRoot, page.src);
    const destPath = join(distDir, page.dest);
    if (!existsSync(srcPath)) {
      console.log(`  ⚠️  ${page.src} 不存在，跳过`);
      continue;
    }
    await copyFile(srcPath, destPath);
    console.log(`  📄 ${page.dest}  ${page.title}`);

    // 自动生成对应的 talk 演讲版（除非用户显式关闭）
    const talkSrc = srcPath.replace(/\.html$/, ".talk.html");
    const talkDest = page.dest.replace(/\.html$/, ".talk.html");
    if (existsSync(talkSrc)) {
      await run(
        "npx",
        ["tsx", "src/build.ts", "--from-html", page.src, "--talk", "--output", `dist-share/${talkDest}`],
        { cwd: projectRoot }
      );
      console.log(`  🎤 ${talkDest}  ← 自动生成演讲版`);
    } else {
      console.log(`  ⚠️  ${talkSrc} 不存在，跳过演讲版生成（先跑一次 npx facet --from-html ${page.src} --talk）`);
    }
  }
}

/**
 * 加密交付：把 output/ 里的商业敏感文档（产品方案 / 客户 FAQ 等）构建到
 * 受保护路径下，走 /proposal/ 和 /faq/ 前缀——middleware 会拦截并要密码。
 *
 * 每个条目产出 3 个文件：
 *   dist-share/<slug>/index.html     阅读版（受保护）
 *   dist-share/<slug>/talk.html      演讲版（受保护）
 *   dist-share/<slug>/share.pdf      PDF（受保护）
 *
 * 配置受保护前缀见 wrangler.toml 的 PROTECTED_PATHS。
 */
async function buildProtectedDocs() {
  const PROTECTED = [
    {
      src: "output/loan-ai-proposal-v1.md",
      slug: "proposal",
      title: "AI 智能外呼系统 · 产品方案"
    },
    {
      src: "output/ai-call-faq.md",
      slug: "faq",
      title: "AI 智能外呼 · 客户常见问题"
    }
    // { src: 'output/xxx.md', slug: 'xxx', title: 'xxx' },  // ← 未来加受保护文档在这里登记
  ];

  const { existsSync } = await import("node:fs");
  const { mkdir } = await import("node:fs/promises");
  for (const doc of PROTECTED) {
    const srcPath = join(projectRoot, doc.src);
    if (!existsSync(srcPath)) {
      console.log(`  ⚠️  ${doc.src} 不存在，跳过`);
      continue;
    }
    const outDir = join(distDir, doc.slug);
    await mkdir(outDir, { recursive: true });

    // 阅读版
    await run(
      "npx",
      ["tsx", "src/build.ts", "--read", "--input", doc.src, "--theme", theme, "--output", `dist-share/${doc.slug}/index.html`],
      { cwd: projectRoot }
    );
    // 演讲版
    await run(
      "npx",
      ["tsx", "src/build.ts", "--talk", "--input", doc.src, "--theme", theme, "--output", `dist-share/${doc.slug}/talk.html`],
      { cwd: projectRoot }
    );
    // PDF（可选，失败不阻断）
    try {
      await run(
        "npx",
        ["tsx", "src/build.ts", "--input", doc.src, "--theme", theme, "--output", `dist-share/${doc.slug}/share.pdf`],
        { cwd: projectRoot }
      );
    } catch (err) {
      console.log(`  ⚠️  ${doc.slug} PDF 生成失败：${String(err.message).slice(0, 60)}`);
    }

    console.log(`  🔒 ${doc.slug}/  ${doc.title}  ← 加密交付（阅读版 + 演讲版 + PDF）`);
  }
}

/**
 * 复制头像与 favicon 到 dist-share/。
 * 优先复用预先生成的 docs/brand/favicon.ico，避免在 Linux CI runner 上依赖 sips。
 */
async function copyFavicon() {
  const { existsSync } = await import("node:fs");
  const avatarSrc = join(projectRoot, "docs", "brand", "webkubor-avatar.jpg");
  const icoSrc = join(projectRoot, "docs", "brand", "favicon.ico");
  const destIco = join(distDir, "favicon.ico");

  if (existsSync(icoSrc)) {
    await copyFile(icoSrc, destIco);
    console.log("  🖼️  favicon.ico  ← docs/brand/favicon.ico");
  } else if (existsSync(avatarSrc)) {
    try {
      await run("node", ["scripts/make-favicon.mjs", avatarSrc, destIco], { cwd: projectRoot });
      console.log("  🖼️  favicon.ico  ← 动态生成");
    } catch {
      await copyFile(avatarSrc, destIco);
      console.log("  🖼️  favicon.ico  ← 回退复制头像");
    }
  }

  // 同时也把头像复制到根目录作为 apple-touch-icon 和 favicon.png
  if (existsSync(avatarSrc)) {
    await copyFile(avatarSrc, join(distDir, "apple-touch-icon.png"));
    await copyFile(avatarSrc, join(distDir, "favicon.png"));
  }
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

    for (const [flag, out] of [
      ["--read", `dist-share/${post.slug}/index.html`],
      ["--talk", `dist-share/${post.slug}/talk.html`],
    ]) {
      await run("npx", ["tsx", "src/build.ts", "--input", input, flag, "--theme", theme, "--output", out], { cwd: projectRoot });
    }

    // PDF：走 facet 默认产物（warm-handbook 模板，A4 多页）
    // 同时产出 share.png（小红书/公众号长图素材），存在同一目录方便下载
    try {
      await run(
        "npx",
        ["tsx", "src/build.ts", "--input", input, "--theme", theme, "--output", `dist-share/${post.slug}/share.pdf`],
        { cwd: projectRoot }
      );
      await run(
        "npx",
        ["tsx", "src/build.ts", "--input", input, "--theme", theme, "--output", `dist-share/${post.slug}/share.png`],
        { cwd: projectRoot }
      );
      console.log(`  📄 ${post.slug}/share.pdf  +  share.png  ← PDF + 长图素材`);
    } catch (err) {
      console.log(`  ⚠️  ${post.slug} PDF/长图生成失败（Playwright 可能未装）：${err.message?.slice(0, 80)}`);
    }

    console.log(`  ✅ ${post.slug}  ${post.title ?? ""}`);
  }

  await writeFile(join(distDir, "index.html"), renderIndex(posts), "utf8");
  await writeFile(join(distDir, "llms.txt"), renderLlmsTxt(posts), "utf8");
  // 放行 AI 爬虫：这站讲的就是这件事，自己先做到
  await writeFile(join(distDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: https://${SITE.domain}/sitemap.xml\n`, "utf8");
  await writeFile(join(distDir, "sitemap.xml"), renderSitemap(posts), "utf8");

  // 自动复制"案例研究"等独立 HTML 页面：这些是已生成的成品，不走 facet 构建，
  // 但属于站点内容的一部分。每次 build 后自动覆盖同步，避免下次部署丢失。
  await copyStandalonePages();
  await buildProtectedDocs();
  await copyFavicon();

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
          <a href="/${escapeHtml(p.slug)}/share.pdf">📄 PDF</a>
          <a href="/${escapeHtml(p.slug)}/share.png">📷 长图</a>
        </p>
      </li>`).join("\n");

  // 案例研究：独立 HTML 页面 + 自动生成的 talk 演讲版
  const cases = [
    {
      href: "/financial-ai-call-cost-case.html",
      talkHref: "/financial-ai-call-cost-case.talk.html",
      series: "案例研究 · 003",
      title: "金融行业 AI 外呼落地成本评估",
      subtitle: "需求文档评估 · 技术选型 · 真实定价拆解 · 4 周落地路径"
    }
    // 未来加新案例在这里登记
  ];
  const caseItems = cases.map((c) => `
      <li class="entry entry-case">
        <a class="entry-main" href="${escapeHtml(c.href)}">
          <span class="entry-series entry-series-case">${escapeHtml(c.series)}</span>
          <h2>${escapeHtml(c.title)}</h2>
          ${c.subtitle ? `<p class="entry-sub">${escapeHtml(c.subtitle)}</p>` : ""}
        </a>
        <p class="entry-meta">
          <span class="case-tag">独立分析报告</span>
          <a href="${escapeHtml(c.href)}">阅读版</a>
          <a href="${escapeHtml(c.talkHref)}">🎤 演讲版</a>
        </p>
      </li>`).join("\n");

  const casesBlock = caseItems ? `
    <h3 class="cases-section-title">案例研究</h3>
    <p class="cases-section-hint">基于真实项目复盘的成本 / 选型 / 合规评估，可作为给客户的技术提案参考。</p>
    <ul class="cases-list">${caseItems}
    </ul>` : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(SITE.name)}</title>
<meta name="description" content="${escapeHtml(SITE.intro)}" />
<!-- 浏览器图标：优先高清头像原图，兼容 ICO 与 Apple 设备 -->
<link rel="icon" type="image/jpeg" href="https://${SITE.domain}/assets/webkubor-avatar.jpg" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="https://${SITE.domain}/assets/webkubor-avatar.jpg" />

<!-- 社交媒体链接分享卡片小图标（微信、飞书、Twitter、Telegram、Slack 等） -->
<meta property="og:title" content="${escapeHtml(SITE.name)}" />
<meta property="og:description" content="${escapeHtml(SITE.intro)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://${SITE.domain}/" />
<meta property="og:image" content="https://${SITE.domain}/assets/webkubor-avatar.jpg" />
<meta property="og:image:width" content="240" />
<meta property="og:image:height" content="240" />
<meta property="og:image:type" content="image/jpeg" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(SITE.name)}" />
<meta name="twitter:description" content="${escapeHtml(SITE.intro)}" />
<meta name="twitter:image" content="https://${SITE.domain}/assets/webkubor-avatar.jpg" />
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

/* ========== 案例研究区域 ========== */
.cases-section-title{margin:64px 0 4px;font-family:var(--display-font);font-size:18px;letter-spacing:.08em;color:var(--accent)}
.cases-section-hint{margin:0 0 22px;color:var(--muted);font-size:14px}
.cases-list{list-style:none;padding:0;margin:0}
.entry-case .entry-series-case{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.4);color:var(--accent-2)}
.case-tag{display:inline-block;padding:2px 10px;border:1px solid var(--faint);border-radius:999px;color:var(--muted);font-size:12px}
@media(max-width:600px){.shell{padding:52px 18px 72px}h1{font-size:30px}}
</style>
</head>
<body>
<div style="display:none;"><img src="https://${SITE.domain}/assets/webkubor-avatar.jpg" alt="${escapeHtml(SITE.name)}" /></div>
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
  ${casesBlock}
  <footer>${escapeHtml(SITE.domain)} · 由 <a href="https://github.com/webkubor/facet" style="color:var(--accent)">facet</a> 生成 · <a href="https://webkubor.online" style="color:var(--accent)">← webkubor.online 个人主页</a></footer>
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
