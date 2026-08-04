#!/usr/bin/env node
/**
 * 简历视觉自动化校验
 * 用法：node scripts/verify-resume.mjs output/xxx.html [output/yyy.html ...]
 * 校验项（详见 docs/design-spec.md「打印约束」）：
 *  1. print 媒体模拟下逐页 offsetHeight ≤ 297mm（含边框，防空白尾页）
 *  2. PDF 实际页数（解析页树）== DOM 页数
 *  3. 正文页大标题不超过 2 行
 *  4. 非末页留白 ≤ 15%，末页 ≤ 25%
 *  5. 联系方式徽章非空、未残留 ${VAR} 占位符
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi，向上取整
const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("用法：node scripts/verify-resume.mjs output/xxx.html ...");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.emulateMedia({ media: "print" });
let failed = false;

function report(ok, label, detail) {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}${detail ? `：${detail}` : ""}`);
  if (!ok) {
    failed = true;
  }
}

for (const htmlPath of files) {
  const absolute = path.resolve(htmlPath);
  const pdfPath = absolute.replace(/\.html$/, ".pdf");
  console.log(`\n== ${path.basename(htmlPath)} ==`);
  await page.goto(`file://${absolute}`);

  const audit = await page.evaluate((a4) => {
    const pages = Array.from(document.querySelectorAll(".resume-page"));
    return {
      domPages: pages.length,
      pages: pages.map((el, index) => {
        const children = Array.from(el.children).filter((c) => !c.classList.contains("resume-page-footer"));
        const contentBottom = Math.max(...children.map((c) => c.getBoundingClientRect().bottom - el.getBoundingClientRect().top), 0);
        const title = el.querySelector(".resume-page-title h2");
        const cards = Array.from(el.querySelectorAll(".resume-section-card")).map((c) => c.getBoundingClientRect());
        let maxGap = 0;
        for (let i = 1; i < cards.length; i += 1) {
          maxGap = Math.max(maxGap, Math.round(cards[i].top - cards[i - 1].bottom));
        }
        return {
          page: index + 1,
          offsetHeight: el.offsetHeight,
          fillRatio: Math.round((contentBottom / a4) * 100),
          maxGap,
          titleLines: title ? Math.round(title.clientHeight / (parseFloat(getComputedStyle(title).lineHeight) || 30)) : 0
        };
      }),
      contact: document.querySelector(".resume-contact-row")?.textContent.trim() ?? ""
    };
  }, A4_HEIGHT_PX);

  for (const p of audit.pages) {
    const isLast = p.page === audit.pages.length;
    report(p.offsetHeight <= A4_HEIGHT_PX, `第 ${p.page} 页高度 ${p.offsetHeight}px ≤ ${A4_HEIGHT_PX}px`);
    report(p.titleLines <= 2, `第 ${p.page} 页大标题 ${p.titleLines} 行 ≤ 2 行`);
    const maxBlank = isLast ? 25 : 15;
    report(100 - p.fillRatio <= maxBlank, `第 ${p.page} 页留白 ${100 - p.fillRatio}% ≤ ${maxBlank}%`);
    report(p.maxGap <= 120, `第 ${p.page} 页卡片间最大空洞 ${p.maxGap}px ≤ 120px`);
  }

  const pdfBuf = readFileSync(pdfPath).toString("latin1");
  const pdfPages = [...pdfBuf.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]))[0] ?? -1;
  report(pdfPages === audit.domPages, `PDF 页数 ${pdfPages} == DOM 页数 ${audit.domPages}`);
  report(audit.contact.length > 0 && !audit.contact.includes("${"), "联系方式已注入且无占位符残留", audit.contact.slice(0, 40));
}

await browser.close();
console.log(failed ? "\n❌ 校验未通过" : "\n✅ 全部通过");
process.exit(failed ? 1 : 0);
