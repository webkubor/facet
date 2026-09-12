#!/usr/bin/env node
/**
 * 发布通知 —— 把「新发的文章 / 加密文档」推送到飞书 / 企业微信
 *
 * 两种内容自动识别：
 *   加密文档（在 PROTECTED_DOCS 里）→ 推链接 + 密码 + 访问日志入口
 *   普通文章（在 content/*.md 里）  → 推链接 + 演讲版 + PDF（不带密码）
 *
 * 用法：
 *   node scripts/notify-publish.mjs --slug proposal        # 加密文档
 *   node scripts/notify-publish.mjs --slug scorecard       # 普通文章
 *   node scripts/notify-publish.mjs --latest               # 推最新一篇
 *   node scripts/notify-publish.mjs --dry-run              # 预览不发送
 *
 * 环境变量（.env）：
 *   FEISHU_WEBHOOK / WECOM_WEBHOOK   群机器人 webhook
 *   SITE_DOMAIN                      站点域名
 *   DEFAULT_PASSWORD                 加密文档密码（加密文档才需要）
 *   ADMIN_TOKEN                      访问日志 token（加密文档才需要）
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const contentDir = join(projectRoot, "content");

// ============ .env ============
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

// ============ 参数 ============
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[name] = true;
    else { args[name] = next; i++; }
  }
  return args;
}

// ============ 加密文档清单 ============
const PROTECTED_DOCS = {
  proposal: { title: "AI 智能外呼系统 · 产品方案", desc: "客户视角的算账版方案" },
  faq: { title: "AI 智能外呼 · 客户常见问题", desc: "10 个客户最关心的问题" },
  case: { title: "客户案例", desc: "实施记录与数据" },
};

// ============ 读普通文章的 front matter ============
async function loadArticles() {
  if (!existsSync(contentDir)) return [];
  const files = (await readdir(contentDir)).filter((f) => f.endsWith(".md"));
  const articles = [];
  for (const file of files) {
    const raw = await readFile(join(contentDir, file), "utf8");
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) continue;
    const meta = {};
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
    if (!meta.slug) continue;   // 没有 slug = 不发布
    articles.push({
      slug: meta.slug,
      title: meta.title || meta.slug,
      subtitle: meta.subtitle || "",
      date: meta.date || "",
      series: meta.series || "",
    });
  }
  return articles.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// ============ 构建消息 ============
function buildEncryptedMessage({ slug, doc, domain, password, adminToken }) {
  const url = `https://${domain}/${slug}/`;
  const talkUrl = `https://${domain}/${slug}/talk`;
  const pdfUrl = `https://${domain}/${slug}/share.pdf`;
  const logUrl = adminToken ? `https://${domain}/admin/access-log?token=${adminToken}` : "";

  return {
    title: `🔒 加密文档 · ${doc.title}`,
    markdown: [
      `**类型**：加密交付（需密码）`,
      `**链接**：${url}`,
      `**密码**：\`${password}\``,
      "",
      `**其他格式**`,
      `- 演讲版：${talkUrl}`,
      `- PDF：${pdfUrl}`,
      logUrl ? `\n**访问日志**：${logUrl}` : "",
    ].filter(Boolean).join("\n"),
    template: "blue",
    buttons: [
      { text: "打开阅读", url, type: "primary" },
      { text: "演讲版", url: talkUrl },
    ],
  };
}

function buildArticleMessage({ article, domain }) {
  const url = `https://${domain}/${article.slug}/`;
  const talkUrl = `https://${domain}/${article.slug}/talk`;
  const pdfUrl = `https://${domain}/${article.slug}/share.pdf`;

  return {
    title: `📄 新文章 · ${article.title}`,
    markdown: [
      article.series ? `**系列**：${article.series}` : "",
      article.subtitle ? `**摘要**：${article.subtitle}` : "",
      `**链接**：${url}`,
      "",
      `**其他格式**`,
      `- 演讲版：${talkUrl}`,
      `- PDF：${pdfUrl}`,
    ].filter(Boolean).join("\n"),
    template: "turquoise",
    buttons: [
      { text: "阅读", url, type: "primary" },
      { text: "演讲版", url: talkUrl },
    ],
  };
}

// ============ 打印 ============
function printMessage(msg) {
  console.log("\n" + "=".repeat(62));
  console.log(`标题：${msg.title}`);
  console.log("=".repeat(62));
  console.log(msg.markdown);
  console.log("\n按钮：");
  for (const b of msg.buttons || []) console.log(`  [${b.text}] → ${b.url}`);
  console.log("=".repeat(62) + "\n");
}

// ============ 主流程 ============
async function main() {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const domain = process.env.SITE_DOMAIN || "share.webkubor.online";
  const password = args.password || process.env.DEFAULT_PASSWORD || "";
  const adminToken = args["admin-token"] || process.env.ADMIN_TOKEN || "";
  const to = String(args.to || "feishu,wecom").split(",").map((s) => s.trim()).filter(Boolean);
  const dryRun = Boolean(args["dry-run"]);

  // 决定推什么：--latest 找最新文章；--slug 找加密文档或文章
  let slug = args.slug;
  let msg;
  let kind;

  if (args.latest) {
    const articles = await loadArticles();
    if (articles.length === 0) {
      console.error("❌ content/ 里没有带 slug 的文章");
      process.exit(1);
    }
    const article = articles[0];
    msg = buildArticleMessage({ article, domain });
    kind = "article";
    slug = article.slug;
  } else if (slug && PROTECTED_DOCS[slug]) {
    if (!password) {
      console.error("❌ 加密文档缺少密码。用 --password xxx 或设置 DEFAULT_PASSWORD。");
      process.exit(1);
    }
    msg = buildEncryptedMessage({ slug, doc: PROTECTED_DOCS[slug], domain, password, adminToken });
    kind = "encrypted";
  } else if (slug) {
    const articles = await loadArticles();
    const article = articles.find((a) => a.slug === slug);
    if (!article) {
      console.error(`❌ 找不到 slug「${slug}」`);
      console.error(`   加密文档：${Object.keys(PROTECTED_DOCS).join(", ")}`);
      console.error(`   文章：${articles.map((a) => a.slug).join(", ") || "（无）"}`);
      process.exit(1);
    }
    msg = buildArticleMessage({ article, domain });
    kind = "article";
  } else {
    console.error("用法：--slug <slug> 或 --latest");
    console.error("  加密文档：--slug proposal");
    console.error("  普通文章：--slug scorecard");
    console.error("  最新一篇：--latest");
    process.exit(1);
  }

  if (dryRun) {
    console.log(`🔍 DRY RUN（${kind === "encrypted" ? "加密文档" : "普通文章"}）—— 不会实际发送\n`);
    printMessage(msg);
    return;
  }

  // ============ targets ============
  const targets = [];
  for (const platform of to) {
    if (platform === "feishu") {
      if (!process.env.FEISHU_WEBHOOK) { console.warn("⚠️  FEISHU_WEBHOOK 未配置，跳过飞书"); continue; }
      targets.push({ platform: "feishu", url: process.env.FEISHU_WEBHOOK, name: "飞书" });
    } else if (platform === "wecom") {
      if (!process.env.WECOM_WEBHOOK) { console.warn("⚠️  WECOM_WEBHOOK 未配置，跳过企微"); continue; }
      targets.push({ platform: "wecom", url: process.env.WECOM_WEBHOOK, name: "企业微信" });
    } else {
      console.warn(`⚠️  未知平台：${platform}（支持 feishu / wecom）`);
    }
  }

  if (targets.length === 0) {
    console.error("❌ 没有可用的推送目标。请在 .env 配置 FEISHU_WEBHOOK 或 WECOM_WEBHOOK。");
    process.exit(1);
  }

  // ============ 发送 ============
  const { notify } = await import("im-notify-kit");
  console.log(`📤 推送到 ${targets.map((t) => t.name).join(" / ")} ...\n`);

  const results = await notify(targets, msg, { retries: 2, timeoutMs: 10000 });

  let allOk = true;
  for (const r of results) {
    const name = r.target?.name || r.target?.platform || "unknown";
    if (r.ok) console.log(`  ✅ ${name}：已送达（${r.attempts} 次尝试）`);
    else if (r.deduped) console.log(`  ⏭️  ${name}：刚推过，跳过（去重）`);
    else {
      allOk = false;
      console.log(`  ❌ ${name}：失败 — ${r.error || "未知错误"}`);
      console.log(`     HTTP ${r.httpStatus} | code ${r.code ?? "-"}`);
      if (r.response) console.log(`     响应：${String(r.response).slice(0, 200)}`);
    }
  }

  console.log("");
  if (allOk) {
    console.log("🎉 推送完成");
    console.log(`\n内容：https://${domain}/${slug}/`);
    if (kind === "encrypted") console.log(`密码：${password}`);
  } else {
    console.log("⚠️  部分推送失败，请检查 webhook 配置和群机器人状态。");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("未捕获错误：", err);
  process.exit(1);
});
