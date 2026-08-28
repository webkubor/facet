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
  /** 同一章节被拆成多屏时，第 2 屏起为 true：不重复渲染大标题。 */
  continued?: boolean;
  /** 本屏是该章节的第几屏 / 共几屏，用于页眉标注。 */
  partIndex?: number;
  partCount?: number;
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

/**
 * 一屏正文区的可用高度（px，按 1280×800 基准估）。
 *
 * 为什么不用 content-flow 的 weight：那套口径是 PDF 的（12px 表格、14px 正文），
 * 拿到 talk 上会严重低估——talk 正文 20px、表格 16px 带 padding，同样的
 * 「92 权重一行表格」实际要占 60px。用错口径的结果是章节看着没超限，
 * 渲染出来标题被切、底部内容跑到屏外（2026-08-28 实测过两次）。
 *
 * 800 高减去 slide 上下 padding(7vh×2≈112) 与标题区(kicker+h2+分隔线≈180)，
 * 正文区实际可用 ≈ 500，留一点安全余量。
 */
const SLIDE_BODY_HEIGHT = 470;

/** 太空的屏会尝试并回上一屏——一屏只放一句话比溢出还难看。 */
const MIN_SLIDE_HEIGHT = 150;

/** 每行能排的中文字数（正文 20px、版心约 1000px）。 */
const CHARS_PER_LINE = 40;
const LINE_HEIGHT = 34;

/**
 * 估算一块内容渲染后占多高（px）。宁可高估——高估只是多分一屏，
 * 低估是当众露出被切掉一半的标题。
 */
function estimateBlockHeight(html: string): number {
  let h = 0;

  // 表格：表头 + 每行约 60px（16px 字 + 9px 上下 padding + 边框）
  const rows = (html.match(/<tr\b/g) ?? []).length;
  h += rows * 60;

  // 代码块：每行 28px（17px 字 × 1.65）+ 上下 padding 与边距
  for (const pre of html.match(/<pre[\s\S]*?<\/pre>/g) ?? []) {
    h += (pre.split("\n").length + 1) * 28 + 56;
  }

  // 引用：按其文字量折行 + 内外边距
  for (const q of html.match(/<blockquote[\s\S]*?<\/blockquote>/g) ?? []) {
    const chars = q.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
    h += Math.max(1, Math.ceil(chars / CHARS_PER_LINE)) * LINE_HEIGHT + 60;
  }

  // 小标题
  h += (html.match(/<h3\b/g) ?? []).length * 58;
  h += (html.match(/<h4\b/g) ?? []).length * 46;

  // 其余正文（段落/列表）：去掉上面已计入的结构后按字数折行
  const rest = html
    .replace(/<table[\s\S]*?<\/table>/g, "")
    .replace(/<pre[\s\S]*?<\/pre>/g, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/g, "")
    .replace(/<h[34][\s\S]*?<\/h[34]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "");
  if (rest.length) {
    h += Math.ceil(rest.length / CHARS_PER_LINE) * LINE_HEIGHT + 16;
  }

  // 列表项各自还有 margin
  h += (html.match(/<li\b/g) ?? []).length * 12;

  return h;
}

/**
 * 把一个章节的 markdown 源按顶层块切开（段落 / 表格 / 代码块 / 列表 / 引用 / 小标题），
 * 代码块整体不可分——从中间切开会产生两个都不合法的片段。
 */
function splitTopLevelBlocks(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    if (current.some((l) => l.trim() !== "")) blocks.push(current.join("\n"));
    current = [];
  };

  for (const line of source.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      // 围栏开始前先结束上一块；围栏结束后连同这一行一起收尾
      if (!inFence) flush();
      inFence = !inFence;
      current.push(line);
      if (!inFence) flush();
      continue;
    }
    if (inFence) {
      current.push(line);
      continue;
    }
    // 空行是块的天然边界；小标题另起一块
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^###\s+/.test(line)) {
      flush();
    }
    current.push(line);
  }
  flush();
  return blocks;
}

/**
 * 按权重把块装进若干屏，单块超限就自己独占一屏（表格/长代码块属于这类）。
 * 收尾时把过空的末屏并回上一屏——宁可上一屏稍满，也别留一屏只有一句话。
 */
function packIntoScreens(blocks: string[]): string[] {
  const screens: { src: string[]; weight: number }[] = [];
  let current: string[] = [];
  let weight = 0;

  for (const block of blocks) {
    const w = estimateBlockHeight(renderMarkdown(block));
    if (current.length > 0 && weight + w > SLIDE_BODY_HEIGHT) {
      screens.push({ src: current, weight });
      current = [];
      weight = 0;
    }
    current.push(block);
    weight += w;
  }
  if (current.length) screens.push({ src: current, weight });

  // 末屏太空且并回去不至于爆掉（留 25% 余量）就合并
  if (screens.length >= 2) {
    const last = screens[screens.length - 1]!;
    const prev = screens[screens.length - 2]!;
    if (last.weight < MIN_SLIDE_HEIGHT && prev.weight + last.weight <= SLIDE_BODY_HEIGHT * 1.2) {
      prev.src.push(...last.src);
      prev.weight += last.weight;
      screens.pop();
    }
  }

  const out = screens.map((s) => s.src.join("\n\n"));
  return out.length ? out : [""];
}

function planTalkSlides(bodySource: string): TalkSlide[] {
  const slides: TalkSlide[] = [{ id: "cover", kind: "cover", title: "", html: "" }];

  for (const block of splitChapters(bodySource)) {
    const chapter = block.match(/^##\s+(.+)$/m);
    if (chapter) {
      const title = (chapter[1] ?? "").trim();
      // 去掉首行 `## 标题`，避免和布局里的 h2 重复
      const bodyLines = block.split(/\r?\n/).slice(1);
      const screens = packIntoScreens(splitTopLevelBlocks(bodyLines.join("\n")));
      const base = slugify(title);

      screens.forEach((screen, i) => {
        slides.push({
          id: i === 0 ? base : `${base}-${i + 1}`,
          kind: "chapter",
          title,
          html: renderMarkdown(screen),
          // 续屏不重复渲染大标题，只在页眉标出「章节名 · 续」
          continued: i > 0,
          partIndex: i + 1,
          partCount: screens.length
        });
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
  // ⚠️ 这行被整块替换覆盖丢过一次（2026-08-28 加拆屏时），
  //    check-talk-pagination 已加断言守住，别再删。
  slides.push({ id: "closing", kind: "closing", title: "片尾", html: "" });

  return slides;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function renderTalkSlides(slides: TalkSlide[], meta: DocumentMeta, toc: TocItem[]): string {
  const chapterToc = toc.filter((item) => item.level === 2);
  // 章号按「章节」计数，不按「屏」——一章拆成三屏仍是同一章，
  // 否则页脚会出现「第 07 章 / 共 05 章」这种自相矛盾的数字。
  const chapterCount = slides.filter((s) => s.kind === "chapter" && !s.continued).length;
  let chapterCursor = 0;

  return slides.map((slide, index) => {
    if (slide.kind === "cover") {
      return renderCoverSlide(slide, meta, chapterToc, slides);
    }

    if (slide.kind === "closing") {
      return renderClosingSlide(meta);
    }

    if (slide.kind === "chapter") {
      if (!slide.continued) chapterCursor += 1;
      const num = pad(chapterCursor);
      const kicker = slide.partCount && slide.partCount > 1
        ? `第 ${num} 章 · ${slide.partIndex}/${slide.partCount}`
        : `第 ${num} 章`;
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
        slide.continued
          ? `<h2 class="continued">${escapeHtml(slide.title)}<span class="cont-mark">续</span></h2>`
          : `<h2>${escapeHtml(slide.title)}</h2>`,
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
  // 章节在 slides 数组里的真实下标：只取每章的**首屏**。
  // 一章内容多会被拆成多屏（continued），若把续屏也算进来，封面会报出
  // 「17 个章节」这种数字，导航点第 3 条也会跳到第 1 章的第 3 屏而不是第 3 章。
  const chapterIndexes = slides
    .map((s, i) => (s.kind === "chapter" && !s.continued ? i : -1))
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
