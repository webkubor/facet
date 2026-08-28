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

/** 按 `##` 章节切分 Markdown 源（`###` 小节留在章内；H1 与导言作为开场块）。 */
function splitChapters(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  // 代码块内的 `## xxx` 不是章节标题——正文里贴 AGENTS.md / md 模板时，
  // 里面的二级标题会被当成分页点，凭空多出「这是什么」「常用命令」这种碎片页。
  let inFence = false;

  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
    }
    if (!inFence && /^##\s+/.test(line) && current.some((l) => l.trim() !== "")) {
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
      slides.push({
        id: slugify(title),
        kind: "chapter",
        title,
        html: renderMarkdown(block)
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

  // 片尾：署名 + 系列 + 归档站点。固定最后一页，不从正文取。
  slides.push({ id: "closing", kind: "closing", title: "片尾", html: "" });

  return slides;
}

function renderTalkSlides(slides: TalkSlide[], meta: DocumentMeta, toc: TocItem[]): string {
  const chapterToc = toc.filter((item) => item.level === 2);

  return slides.map((slide, index) => {
    if (slide.kind === "cover") {
      return renderCoverSlide(slide, meta, chapterToc, slides);
    }

    if (slide.kind === "closing") {
      return renderClosingSlide(meta);
    }

    const kicker = slide.kind === "intro" ? "开场" : `0${index}`;
    return [
      `<section class="slide" data-index="${index}" aria-label="${escapeHtml(slide.title)}">`,
      `<div class="slide-inner">`,
      `<p class="slide-kicker">${escapeHtml(kicker)}</p>`,
      slide.kind === "chapter" ? `<h2>${escapeHtml(slide.title)}</h2>` : "",
      `<div class="slide-body">${slide.html}</div>`,
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
    `<span class="n">${String(i + 1).padStart(2, "0")}</span>`,
    `<span>${escapeHtml(item.text)}</span>`,
    `</a>`
  ].join("")).join("\n");

  return [
    `<section class="slide cover active" data-index="0" aria-label="封面">`,
    `<div class="slide-inner cover-inner">`,
    `<span class="cover-brand">${escapeHtml(meta.shareHeader)}</span>`,
    `<h1>${escapeHtml(meta.title)}</h1>`,
    `<p class="cover-sub">${escapeHtml(meta.subtitle)}</p>`,
    `<p class="cover-meta">${escapeHtml(meta.author)} · ${escapeHtml(meta.date)} · ${chapterIndexes.length} 个章节</p>`,
    `<nav class="cover-nav">${nav}</nav>`,
    `<p class="cover-hint">← → 翻页 · 数字键跳转 · F 全屏</p>`,
    `</div>`,
    `</section>`
  ].join("\n");
}

/**
 * 片尾：署名 + 系列 + 归档站点。
 * 主标题默认「聊到这里」而不是「感谢聆听」——后者是收束语，会把讲者重新放回讲台，
 * 与全篇的交流姿态冲突；片尾要做的是把话头交出去，不是把场子收回来。
 */
function renderClosingSlide(meta: DocumentMeta): string {
  const rows = [
    meta.series ? `<p class="closing-series">${escapeHtml(meta.series)}</p>` : "",
    `<h2 class="closing-title">${escapeHtml(meta.closingTitle)}</h2>`,
    meta.closingNote ? `<p class="closing-note">${escapeHtml(meta.closingNote)}</p>` : "",
    `<p class="closing-by"><span>${escapeHtml(meta.author)}</span><span class="dot">·</span><span>${escapeHtml(meta.date)}</span></p>`,
    meta.site ? `<p class="closing-site">讲稿与往期都在 <strong>${escapeHtml(meta.site)}</strong></p>` : ""
  ].filter(Boolean);

  return [
    `<section class="slide closing" data-index="closing" aria-label="片尾">`,
    `<div class="slide-inner closing-inner">`,
    ...rows,
    `</div>`,
    `</section>`
  ].join("\n");
}
