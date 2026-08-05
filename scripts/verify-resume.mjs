#!/usr/bin/env node
/**
 * 简历视觉自动化校验
 * 用法：node scripts/verify-resume.mjs output/xxx.html [output/yyy.html ...]
 * 校验项（详见 docs/design-spec.md「打印约束」）：
 *  1. print 媒体模拟下逐页 offsetHeight ≤ 297mm（含边框，防空白尾页）
 *  2. PDF 实际页数（解析页树）== DOM 页数
 *  3. 正文页大标题不超过 2 行
 *  4. 非末页留白 ≤ 15%，末页 ≤ 25%；卡片间垂直空洞 ≤ 120px
 *  5. 联系方式徽章非空、未残留 ${VAR} 占位符
 *  6. 字号与 docs/design-spec.md 字阶一致（姓名 35 / 副标题 14 / 正文 12 / 徽章 11 / 页眉 10）
 *  7. 关键文本 WCAG 对比度：正文 ≥ 4.5，muted 辅助文本 ≥ 4.0，标题 ≥ 3.0
 *  8. 视觉重点存在：正文 strong 高亮 ≥ 6 处，聚焦卡 = 4 张
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
      contact: document.querySelector(".resume-contact-row")?.textContent.trim() ?? "",
      fonts: {
        h1: parseFloat(getComputedStyle(document.querySelector(".resume-hero h1")).fontSize),
        subtitle: parseFloat(getComputedStyle(document.querySelector(".resume-subtitle")).fontSize),
        body: parseFloat(getComputedStyle(document.querySelector(".resume-section-body li")).fontSize),
        chip: parseFloat(getComputedStyle(document.querySelector(".resume-contact-row span")).fontSize),
        header: parseFloat(getComputedStyle(document.querySelector(".resume-page-header span")).fontSize)
      },
      contrast: (() => {
        const parse = (value) => {
          const m = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
          return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
        };
        const blend = (fg, bg) => ({
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1
        });
        const effectiveBg = (el) => {
          const layers = [];
          for (let node = el; node; node = node.parentElement) {
            const c = parse(getComputedStyle(node).backgroundColor);
            if (c && c.a > 0) layers.push(c);
            if (c && c.a >= 1) break;
          }
          return layers.reverse().reduce((acc, layer) => blend(layer, acc), { r: 255, g: 255, b: 255, a: 1 });
        };
        const luminance = (c) => {
          const f = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        };
        const ratio = (el) => {
          if (!el) return 0;
          const fg = parse(getComputedStyle(el).color);
          const bg = effectiveBg(el);
          const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
          return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
        };
        return {
          body: ratio(document.querySelector(".resume-section-body li")),
          muted: ratio(document.querySelector(".resume-page-header span")),
          heading: ratio(document.querySelector(".resume-section-card > h3")),
          innerHeading: ratio(document.querySelector(".resume-section-body h3")),
          motto: ratio(document.querySelector(".resume-motto"))
        };
      })(),
      emphasis: {
        strongCount: document.querySelectorAll(".resume-section-body strong").length,
        snapshotCount: document.querySelectorAll(".resume-snapshot-grid section").length
      },
      portrait: (() => {
        const figure = document.querySelector(".resume-portrait");
        if (!figure) return null;
        const img = figure.querySelector("img");
        const box = figure.getBoundingClientRect();
        return {
          inlined: Boolean(img?.getAttribute("src")?.startsWith("data:")),
          loaded: Boolean(img?.complete && img.naturalWidth > 0),
          size: Math.round(box.width),
          heroSplit: Boolean(document.querySelector(".resume-hero-with-portrait"))
        };
      })()
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

  const SPEC_FONTS = { h1: 35, subtitle: 14, body: 12, chip: 11, header: 10 };
  for (const [key, expected] of Object.entries(SPEC_FONTS)) {
    report(Math.abs(audit.fonts[key] - expected) <= 1, `字号 ${key} ${audit.fonts[key]}px ≈ 规范 ${expected}px`);
  }

  report(audit.contrast.body >= 4.5, `正文对比度 ${audit.contrast.body} ≥ 4.5`);
  report(audit.contrast.muted >= 4.0, `辅助文本对比度 ${audit.contrast.muted} ≥ 4.0`);
  report(audit.contrast.heading >= 3.0, `卡片标题对比度 ${audit.contrast.heading} ≥ 3.0`);
  if (audit.contrast.innerHeading > 0) {
    report(audit.contrast.innerHeading >= 3.0, `小节标题对比度 ${audit.contrast.innerHeading} ≥ 3.0`);
  }
  report(audit.contrast.motto >= 4.0, `座右铭对比度 ${audit.contrast.motto} ≥ 4.0`);
  report(audit.emphasis.strongCount >= 6, `视觉重点 strong ${audit.emphasis.strongCount} 处 ≥ 6`);
  report(audit.emphasis.snapshotCount === 4, `聚焦卡 ${audit.emphasis.snapshotCount} 张 == 4`);

  if (audit.portrait) {
    // 规范见 docs/design-spec.md「简历体系组件」：22-26mm 圆形/方形头像，必须内联且已解码。
    report(audit.portrait.inlined, "头像已内联为 data URI（导出后不依赖外部文件）");
    report(audit.portrait.loaded, "头像已成功解码");
    report(
      audit.portrait.size >= 80 && audit.portrait.size <= 100,
      `头像尺寸 ${audit.portrait.size}px 落在规范 22-26mm（80-100px）`
    );
    report(audit.portrait.heroSplit, "首屏已切换为带头像的两栏 hero");
  }

  const pdfBuf = readFileSync(pdfPath).toString("latin1");
  const pdfPages = [...pdfBuf.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]))[0] ?? -1;
  report(pdfPages === audit.domPages, `PDF 页数 ${pdfPages} == DOM 页数 ${audit.domPages}`);
  report(audit.contact.length > 0 && !audit.contact.includes("${"), "联系方式已注入且无占位符残留", audit.contact.slice(0, 40));
}

await browser.close();
console.log(failed ? "\n❌ 校验未通过" : "\n✅ 全部通过");
process.exit(failed ? 1 : 0);
