/**
 * 演讲 HTML 渲染（show 导向）
 * 职责：把同一份 Markdown 渲染成「一屏一章节」的演讲页。
 *
 * 与 PDF/长图（share 导向）互补：现场讲解打开 talk.html，分发用 PDF/长图。
 * 复用同一套 front matter、markdown 渲染与 --theme 覆写，不另起一套内容。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";
import { escapeHtml, slugify } from "./html-utils.js";
import { renderMarkdown } from "./markdown.js";
import type { DocumentMeta, TocItem } from "./types.js";

interface TalkSlide {
  id: string;
  kind: "cover" | "intro" | "chapter" | "closing";
  title: string;
  html: string;
}

/** 生成完整演讲页 HTML。 */
export async function buildTalkHTML(input: {
  meta: DocumentMeta;
  toc: TocItem[];
  bodySource: string;
  themeOverride: string;
}): Promise<string> {
  const [template, css] = await Promise.all([
    readFile(path.join(projectRoot, "templates/talk/template.html"), "utf8"),
    readFile(path.join(projectRoot, "templates/talk/talk.css"), "utf8")
  ]);

  const slides = planTalkSlides(input.bodySource);
  const slidesHtml = renderTalkSlides(slides, input.meta, input.toc);

  return template
    .replaceAll("{{title}}", escapeHtml(input.meta.title))
    .replace("{{styles}}", `${css}\n${input.themeOverride}`)
    .replace("{{slides}}", slidesHtml);
}

/** 按 ## 把 Markdown 切成多个 chapter 块；cover 之前的 H1 段属于开场屏。 */
function splitChapters(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  // 代码块内的 `## xxx` 不是章节标题——正文里贴 AGENTS.md / md 模板时，
  // 里面的二级标题会被当成分页点，凭空多出「这是什么」「常用命令」这种碎片页。
  // ⚠️ 这条修过一次又被覆盖回去过（2026-08-28），改本函数时别再把 inFence 丢了。
  let inFence = false;

  for (const line of source.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
    }
    if (!inFence && /^##\s+/.test(line) && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.some((l) => l.trim() !== "")) {
    blocks.push(current.join("\n"));
  }
  return blocks;
}

function planTalkSlides(bodySource: string): TalkSlide[] {
  const slides: TalkSlide[] = [{ id: "cover", kind: "cover", title: "", html: "" }];

  for (const block of splitChapters(bodySource)) {
    const chapter = block.match(/^##\s+(.+)$/m);
    if (chapter) {
      const title = (chapter[1] ?? "").trim();
      // 去掉首行 `## 标题`，避免和布局里的 h2 重复
      const bodyLines = block.split(/\r?\n/).slice(1);
      slides.push({
        id: slugify(title),
        kind: "chapter",
        title,
        html: renderMarkdown(bodyLines.join("\n"))
      });
      continue;
    }

    // 封面之后的 H1 + 导言：渲染成开场屏
    const heading = block.match(/^#\s+(.+)$/m);
    slides.push({
      id: "intro",
      kind: "intro",
      title: heading ? (heading[1] ?? "").trim() : "开场",
      html: renderMarkdown(block)
    });
  }

  return slides;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function renderTalkSlides(slides: TalkSlide[], meta: DocumentMeta, toc: TocItem[]): string {
  const chapterToc = toc.filter((item) => item.level === 2);
  const chapterCount = slides.filter((s) => s.kind === "chapter").length;
  let chapterCursor = 0;

  return slides.map((slide, index) => {
    if (slide.kind === "cover") {
      return renderCoverSlide(slide, meta, chapterToc, slides);
    }

    if (slide.kind === "chapter") {
      chapterCursor += 1;
      const num = pad(chapterCursor);
      const kicker = `第 ${num} 章`;
      const railTag = chapterCursor === chapterCount ? "ENDING" : "CHAPTER";
      return [
        `<section class="slide" data-index="${index}" aria-label="${escapeHtml(slide.title)}">`,
        `<div class="slide-inner">`,
        `<aside class="slide-rail">`,
        `<span class="num">${num}</span>`,
        `<span class="of">/ ${pad(chapterCount)}</span>`,
        `<span class="rail-tag">${escapeHtml(railTag)}</span>`,
        `</aside>`,
        `<div class="slide-body">`,
        `<p class="slide-kicker">${escapeHtml(kicker)}</p>`,
        `<h2>${escapeHtml(slide.title)}</h2>`,
        slide.html,
        `</div>`,
        `</div>`,
        `</section>`
      ].join("\n");
    }

    // intro / 开场：左侧 00 号，右侧放导言
    const kicker = "PROLOGUE";
    return [
      `<section class="slide" data-index="${index}" aria-label="${escapeHtml(slide.title)}">`,
      `<div class="slide-inner">`,
      `<aside class="slide-rail">`,
      `<span class="num">00</span>`,
      `<span class="of">/ ${pad(chapterCount)}</span>`,
      `<span class="rail-tag">${escapeHtml(kicker)}</span>`,
      `</aside>`,
      `<div class="slide-body">`,
      `<p class="slide-kicker">${escapeHtml(meta.shareHeader)}</p>`,
      slide.html,
      `</div>`,
      `</div>`,
      `</section>`
    ].join("\n");
  }).join("\n");
}

function renderCoverSlide(slide: TalkSlide, meta: DocumentMeta, chapterToc: TocItem[], slides: TalkSlide[]): string {
  // 章节在 slides 数组里的真实下标（cover 和开场屏之后的第 n 个 chapter）
  const chapterIndexes = slides
    .map((s, i) => (s.kind === "chapter" ? i : -1))
    .filter((i) => i >= 0);

  const nav = chapterToc.map((item, i) => [
    `<a href="#${item.id}" data-slide="${chapterIndexes[i] ?? i + 1}">`,
    `<span class="n">${pad(i + 1)}</span>`,
    `<span class="label">${escapeHtml(item.text)}</span>`,
    `<span class="arrow">→</span>`,
    `</a>`
  ].join("")).join("\n");

  return [
    `<section class="slide cover active" data-index="0" aria-label="封面">`,
    `<div class="cover-inner">`,
    `<div class="cover-left">`,
    `<span class="cover-eyebrow">A FACET PRESENTATION</span>`,
    `<span class="cover-brand">${escapeHtml(meta.shareHeader)}</span>`,
    `<h1>${escapeHtml(meta.title)}</h1>`,
    `<p class="cover-sub">${escapeHtml(meta.subtitle)}</p>`,
    `<p class="cover-meta"><span>${escapeHtml(meta.author)}</span><span>${escapeHtml(meta.date)}</span><span>${chapterIndexes.length} 个章节</span></p>`,
    `<p class="cover-hint">← → 翻页 · 数字键跳转 · F 全屏</p>`,
    `</div>`,
    `<aside class="cover-right">`,
    `<div class="cover-right-head"><h3>章节目录</h3><span>Index</span></div>`,
    `<nav class="cover-nav">${nav}</nav>`,
    `</aside>`,
    `</div>`,
    `</section>`
  ].join("\n");
}