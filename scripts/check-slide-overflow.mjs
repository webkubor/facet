/**
 * 演讲页视觉验收：逐屏量真实渲染高度，报告「被切」和「过空」。
 *
 * 为什么要有它：talk 的排版问题靠肉眼翻是发现不了的——19 屏要一张张看，
 * 而且投影分辨率跟本机不同、`--talk-scale` 还会等比缩放，肉眼在自己屏幕上
 * 看着好好的，投出去可能就切了。2026-08-28 就是这么翻的车：一屏塞了
 * 表格+引用+两段正文，标题被切掉一半，讲的时候才发现内容在屏幕外。
 *
 * 测的是 slide-body 的 getBoundingClientRect 越没越界，不是估算——
 * 估算模型（见 src/talk.ts 的 estimateBlockHeight）负责分屏，这里负责验收，
 * 两者必须独立，否则就是自己给自己打分。
 *
 * 用法：
 *   node scripts/check-slide-overflow.mjs <file-or-url> [--size 1280x800] [--min-fill 0.25]
 *   node scripts/check-slide-overflow.mjs dist-share/ai-readable-kit/talk.html
 *   node scripts/check-slide-overflow.mjs https://share.webkubor.online/ai-readable-kit/talk
 *
 * 退出码非 0 = 有屏被切（过空只警告不失败）。
 */
import { chromium } from "playwright";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("用法：node scripts/check-slide-overflow.mjs <file-or-url> [--size 1280x800] [--min-fill 0.25]");
  process.exit(2);
}

const sizeArg = valueOf("--size") ?? "1280x800";
const [w, h] = sizeArg.split("x").map(Number);
const minFill = Number(valueOf("--min-fill") ?? 0.25);

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const url = /^https?:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(url, { waitUntil: "networkidle" });

const report = await page.evaluate(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const saved = slides.map((s) => ({ className: s.className, animation: s.style.animation }));
  const vh = window.innerHeight;
  const rows = [];

  slides.forEach((s, i) => {
    // 逐个临时激活：talk 靠 .active 控制显示，不激活量不到真实高度
    slides.forEach((x) => x.classList.remove("active"));
    // 量测的是稳态版心，不把刚翻页的入场位移当成真实裁切。
    s.style.animation = "none";
    s.classList.add("active");

    const body = s.querySelector(".slide-body") || s.querySelector(".cover-inner") || s;
    const rect = body.getBoundingClientRect();
    const kicker = (s.querySelector(".slide-kicker") || {}).textContent || "封面";
    rows.push({
      index: i + 1,
      label: kicker.trim().replace(/\s+/g, " ").slice(0, 20),
      title: (s.getAttribute("aria-label") || "").slice(0, 24),
      height: Math.round(body.scrollHeight),
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      cutTop: rect.top < -1,
      cutBottom: rect.bottom > vh + 1
    });
  });

  slides.forEach((x, i) => {
    x.className = saved[i].className;
    x.style.animation = saved[i].animation;
  });
  return { vh, rows };
});

await browser.close();

const { vh, rows } = report;
const cut = rows.filter((r) => r.cutTop || r.cutBottom);
const sparse = rows.filter((r) => !r.cutTop && !r.cutBottom && r.height / vh < minFill);

console.log(`视口 ${w}×${h}，共 ${rows.length} 屏\n`);

for (const r of rows) {
  const pct = Math.round((r.height / vh) * 100);
  const flag = r.cutTop || r.cutBottom ? "❌ 被切" : pct < minFill * 100 ? "· 偏空" : "✅";
  console.log(`  ${String(r.index).padStart(2)} ${flag}  ${String(pct).padStart(3)}%  ${r.label.padEnd(18)} ${r.title}`);
}

if (cut.length) {
  console.error(`\n❌ ${cut.length} 屏内容被切：${cut.map((r) => `#${r.index}`).join(" ")}`);
  console.error("   讲的时候这些内容在屏幕外，翻页也够不着。");
  console.error("   修法：调小 src/talk.ts 的 SLIDE_BODY_HEIGHT，或把该章节的长段落拆开。");
  process.exit(1);
}

if (sparse.length) {
  console.warn(`\n⚠ ${sparse.length} 屏偏空（<${Math.round(minFill * 100)}%）：${sparse.map((r) => `#${r.index}`).join(" ")}`);
  console.warn("   不影响可读，但翻页会显得碎。可调大 SLIDE_BODY_HEIGHT 或 MIN_SLIDE_HEIGHT。");
}

console.log(`\n✅ 无内容被切`);
