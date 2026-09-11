#!/usr/bin/env node
/**
 * 加密文档发布通知
 *
 * 部署完加密文档后，把「链接 + 密码 + 访问日志入口」推送到飞书 / 企业微信，
 * 通知同事或客户"文档已上线"。用 im-notify-kit 发送（业务码校验 + 重试 + 超时）。
 *
 * 用法：
 *   node scripts/notify-publish.mjs --slug proposal --to feishu,wecom
 *   node scripts/notify-publish.mjs --slug faq --password custom123 --to feishu
 *   node scripts/notify-publish.mjs --dry-run          # 只打印不发送
 *
 * 环境变量（.env 或 shell）：
 *   FEISHU_WEBHOOK   飞书群机器人 webhook URL
 *   WECOM_WEBHOOK    企业微信群机器人 webhook URL
 *   SITE_DOMAIN      站点域名（默认 share.webkubor.online）
 *   ADMIN_TOKEN      访问日志页的 token（用于生成日志链接）
 *   DEFAULT_PASSWORD 受保护文档的访问密码
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");

// ============ 加载 .env ============
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

// ============ 解析参数 ============
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

// ============ 受保护文档清单（与 build-site.mjs 的 PROTECTED 保持一致）============
const PROTECTED_DOCS = {
  proposal: { title: "AI 智能外呼系统 · 产品方案", desc: "客户视角的算账版方案" },
  faq: { title: "AI 智能外呼 · 客户常见问题", desc: "10 个客户最关心的问题" },
  case: { title: "客户案例", desc: "实施记录与数据" },
};

// ============ 构建消息内容 ============
function buildMessage({ slug, doc, domain, password, adminToken }) {
  const url = `https://${domain}/${slug}/`;
  const talkUrl = `https://${domain}/${slug}/talk`;
  const pdfUrl = `https://${domain}/${slug}/share.pdf`;
  const logUrl = adminToken ? `https://${domain}/admin/access-log?token=${adminToken}` : "";

  const markdown = [
    `**文档**：${doc.title}`,
    `**说明**：${doc.desc || "加密交付文档"}`,
    `**链接**：${url}`,
    `**密码**：\`${password}\``,
    "",
    `**其他格式**：`,
    `- 演讲版：${talkUrl}`,
    `- PDF：${pdfUrl}`,
    logUrl ? `\n**访问日志**：${logUrl}` : "",
    "",
    "> 🔒 此文档需要密码访问。密码请与链接**分开发送**。",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: `🔒 加密文档已上线 · ${doc.title}`,
    markdown,
    template: "blue",
    buttons: [
      { text: "打开文档", url, type: "primary" },
      { text: "演讲版", url: talkUrl },
    ],
  };
}

// ============ 打印（dry-run）============
function printMessage(msg) {
  console.log("\n" + "=".repeat(60));
  console.log(`标题：${msg.title}`);
  console.log("=".repeat(60));
  console.log(msg.markdown);
  console.log("\n按钮：");
  for (const b of msg.buttons || []) {
    console.log(`  [${b.text}] → ${b.url}`);
  }
  console.log("=".repeat(60) + "\n");
}

// ============ 主流程 ============
async function main() {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const slug = args.slug || "proposal";
  const doc = PROTECTED_DOCS[slug];
  if (!doc) {
    console.error(`❌ 未知的文档 slug: ${slug}`);
    console.error(`   可用：${Object.keys(PROTECTED_DOCS).join(", ")}`);
    process.exit(1);
  }

  const domain = process.env.SITE_DOMAIN || "share.webkubor.online";
  const password = args.password || process.env.DEFAULT_PASSWORD || "";
  const adminToken = args["admin-token"] || process.env.ADMIN_TOKEN || "";
  const to = String(args.to || "feishu,wecom")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dryRun = Boolean(args["dry-run"]);

  if (!password) {
    console.error("❌ 缺少访问密码。用 --password xxx 或设置 DEFAULT_PASSWORD 环境变量。");
    process.exit(1);
  }

  const msg = buildMessage({ slug, doc, domain, password, adminToken });

  if (dryRun) {
    console.log("🔍 DRY RUN —— 不会实际发送\n");
    printMessage(msg);
    return;
  }

  // ============ 组装 targets ============
  const targets = [];
  for (const platform of to) {
    if (platform === "feishu") {
      const url = process.env.FEISHU_WEBHOOK;
      if (!url) {
        console.warn("⚠️  FEISHU_WEBHOOK 未配置，跳过飞书");
        continue;
      }
      targets.push({ platform: "feishu", url, name: "飞书" });
    } else if (platform === "wecom") {
      const url = process.env.WECOM_WEBHOOK;
      if (!url) {
        console.warn("⚠️  WECOM_WEBHOOK 未配置，跳过企微");
        continue;
      }
      targets.push({ platform: "wecom", url, name: "企业微信" });
    } else {
      console.warn(`⚠️  未知平台：${platform}（支持 feishu / wecom）`);
    }
  }

  if (targets.length === 0) {
    console.error("❌ 没有可用的推送目标。请在 .env 配置 FEISHU_WEBHOOK 或 WECOM_WEBHOOK。");
    console.error("   配置位置：项目根目录 .env");
    process.exit(1);
  }

  // ============ 发送 ============
  const { notify } = await import("im-notify-kit");

  console.log(`📤 推送到 ${targets.map((t) => t.name).join(" / ")} ...\n`);

  const results = await notify(targets, msg, {
    retries: 2,
    timeoutMs: 10000,
  });

  // ============ 战报 ============
  let allOk = true;
  for (const r of results) {
    const name = r.target?.name || r.target?.platform || "unknown";
    if (r.ok) {
      console.log(`  ✅ ${name}：已送达（${r.attempts} 次尝试）`);
    } else if (r.deduped) {
      console.log(`  ⏭️  ${name}：刚推过，跳过（去重）`);
    } else {
      allOk = false;
      console.log(`  ❌ ${name}：失败 — ${r.error || "未知错误"}`);
      console.log(`     HTTP ${r.httpStatus} | code ${r.code ?? "-"}`);
      if (r.response) console.log(`     响应：${String(r.response).slice(0, 200)}`);
    }
  }

  console.log("");
  if (allOk) {
    console.log("🎉 推送完成");
    console.log(`\n文档链接：https://${domain}/${slug}/`);
    console.log(`访问密码：${password}`);
    console.log("\n💡 提示：密码请与链接分开发送给客户。");
  } else {
    console.log("⚠️  部分推送失败，请检查 webhook 配置和群机器人状态。");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("未捕获错误：", err);
  process.exit(1);
});
