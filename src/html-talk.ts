/**
 * 从独立 HTML（已经是 warm-handbook / editor 等成品页）生成对应的 talk 演讲页。
 *
 * 复用 templates/talk/template.html + talk.css（与 markdown talk 同源），
 * 但章节来源从 markdown 切 `##` 改成扫描 `<section class="content-page" id="chN">`。
 *
 * 适用场景：
 * - 案例研究、PDF 重制页、不能用 markdown 表达的成品页
 * - 让任何手工编写的 A4 HTML 自动产出"一屏一章节"的演讲版
 *
 * 与 src/talk.ts 的关系：两者输出**视觉同源**，但 talk.ts 基于 markdown 解析、
 * html-talk.ts 基于 HTML 切片。共用同一个 template 和 css 即可。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";
import { escapeHtml } from "./html-utils.js";

interface TalkSlide {
  id: string;
  kind: "cover" | "chapter";
  title: string;
  subtitle?: string;
  html: string;
  layout?: "explain" | "thesis" | "data" | "evidence";
  continued?: boolean;
  partIndex?: number;
  partCount?: number;
}

interface CoverInfo {
  kicker: string;
  title: string;
  subtitle: string;
}

interface SectionInfo {
  id: string;
  title: string;
  subtitle: string;
  body: string;
}

/** talk 正文区可用高度（与 talk.ts 对齐，保证视觉一致）。 */
const SLIDE_BODY_HEIGHT = 470;
const MIN_SLIDE_HEIGHT = 150;
const CHARS_PER_LINE = 40;
const LINE_HEIGHT = 34;

/** 从 HTML 顶层抽取 cover-page 区块的元数据。 */
function extractCover(html: string): CoverInfo | null {
  const m = html.match(/<section class="cover-page"[^>]*>([\s\S]*?)<\/section>\s*<section/);
  if (m && m[1]) return parseCoverInner(m[1]);
  const m2 = html.match(/<section class="cover-page"[^>]*>([\s\S]*?)<\/section>/);
  if (m2 && m2[1]) return parseCoverInner(m2[1]);
  return null;
}

function parseCoverInner(inner: string): CoverInfo {
  const kickerMatch = inner.match(/<span class="cover-kicker">([\s\S]*?)<\/span>/);
  const titleMatch = inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  // 抓 cover-subtitle 到下一个</p> 之间的内容
  const subtitleMatch = inner.match(/<p class="cover-subtitle">([\s\S]*?)<\/p>/);

  const kicker = kickerMatch && kickerMatch[1]
    ? kickerMatch[1].replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").trim()
    : "";
  const title = titleMatch && titleMatch[1]
    ? titleMatch[1].replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").trim()
    : "";
  const subtitle = subtitleMatch && subtitleMatch[1]
    ? subtitleMatch[1].replace(/<[^>]+>/g, "").trim()
    : "";
  return { kicker, title, subtitle };
}

/** 抽取所有正文 section（封面和目录之外的内容页）。 */
function extractSections(html: string): SectionInfo[] {
  const sections: SectionInfo[] = [];
  // 匹配每个 <section class="content-page" id="chN"> ... </section>
  const re = /<section class="content-page"[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1] ?? "";
    const inner = m[2] ?? "";
    // 提取 h2 标题 + 副标题
    const h2Match = inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    let title = id;
    let subtitle = "";
    if (h2Match && h2Match[1]) {
      const h2inner = h2Match[1];
      const smallMatch = h2inner.match(/<small>([\s\S]*?)<\/small>/);
      subtitle = (smallMatch && smallMatch[1]) ? smallMatch[1].trim() : "";
      title = h2inner.replace(/<small>[\s\S]*?<\/small>/g, "").replace(/<[^>]+>/g, "").trim() || id;
    }
    // 清理 body：去掉 page-header、section-label、h2、page-footer 这些"导航元素"
    const body = inner
      .replace(/<div class="page-header">[\s\S]*?<\/div>/g, "")
      .replace(/<span class="section-label">[\s\S]*?<\/span>/g, "")
      .replace(/<h2[^>]*>[\s\S]*?<\/h2>/g, "")
      .replace(/<div class="page-footer">[\s\S]*?<\/div>/g, "");
    sections.push({ id, title, subtitle, body });
  }
  return sections;
}

/** 估算一段 HTML 渲染后的视觉高度（px）。复用 talk.ts 的口径。 */
function estimateHtmlHeight(html: string): number {
  let h = 0;
  const rows = (html.match(/<tr\b/g) ?? []).length;
  h += rows * 60;
  for (const pre of html.match(/<pre[\s\S]*?<\/pre>/g) ?? []) {
    h += (pre.split("\n").length + 1) * 28 + 56;
  }
  h += (html.match(/<h3\b/g) ?? []).length * 58;
  h += (html.match(/<h4\b/g) ?? []).length * 46;
  // callout 块按 80px 一行估
  h += (html.match(/<div class="callout/g) ?? []).length * 90;
  const rest = html
    .replace(/<table[\s\S]*?<\/table>/g, "")
    .replace(/<pre[\s\S]*?<\/pre>/g, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/g, "")
    .replace(/<h[34][\s\S]*?<\/h[34]>/g, "")
    .replace(/<div class="callout[\s\S]*?<\/div>\s*<\/div>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "");
  if (rest.length) {
    h += Math.ceil(rest.length / CHARS_PER_LINE) * LINE_HEIGHT + 16;
  }
  h += (html.match(/<li\b/g) ?? []).length * 12;
  return h;
}

/** 按 h3 把章节 body 切成多个块。 */
function splitHtmlBlocks(body: string): string[] {
  // 用 lookahead 在 <h3 前切分；过滤空块
  return body.split(/(?=<h3\b)/).filter((s) => s.trim().length > 0);
}

/** 按高度把块装入若干屏。复用 talk.ts 的 packIntoScreens 思想。 */
function packScreens(blocks: string[]): string[] {
  const screens: string[] = [];
  let current = "";
  let weight = 0;
  let hasFocal = false;

  for (const block of blocks) {
    const w = estimateHtmlHeight(block);
    const isFocal = /<(?:table|pre|blockquote)\b/.test(block);
    if (current && (hasFocal || isFocal || weight + w > SLIDE_BODY_HEIGHT)) {
      screens.push(current);
      current = "";
      weight = 0;
      hasFocal = false;
    }
    current += block;
    weight += w;
    hasFocal = isFocal;
  }
  if (current) screens.push(current);

  // 末屏太空就并回上一屏（除非上一屏已有焦点块）
  if (screens.length >= 2) {
    const last = screens[screens.length - 1]!;
    const prev = screens[screens.length - 2]!;
    const lastW = estimateHtmlHeight(last);
    const prevW = estimateHtmlHeight(prev);
    const prevHasFocal = /<(?:table|pre|blockquote)\b/.test(prev);
    const lastHasFocal = /<(?:table|pre|blockquote)\b/.test(last);
    if (!prevHasFocal && !lastHasFocal && lastW < MIN_SLIDE_HEIGHT && prevW + lastW <= SLIDE_BODY_HEIGHT * 1.2) {
      screens[screens.length - 2] = prev + last;
      screens.pop();
    }
  }

  return screens.length ? screens : [""];
}

/** 自动选择 talk slide 的版式（与 talk.ts 一致）。 */
function layoutFor(html: string): NonNullable<TalkSlide["layout"]> {
  if (/<table\b/.test(html)) return "data";
  if (/<(?:pre|blockquote)\b/.test(html)) return "evidence";
  const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  const paragraphs = (html.match(/<p\b/g) ?? []).length;
  if (text.length <= 100 && paragraphs <= 1 && !/<(?:ul|ol|h3)\b/.test(html)) return "thesis";
  return "explain";
}

function renderCoverSlide(cover: CoverInfo): string {
  return `<section class="slide slide-cover" id="cover">
    <span class="slide-kicker">${escapeHtml(cover.kicker)}</span>
    <h1 class="slide-title">${escapeHtml(cover.title)}</h1>
    ${cover.subtitle ? `<p class="slide-subtitle">${escapeHtml(cover.subtitle)}</p>` : ""}
  </section>`;
}

function renderChapterSlide(slide: TalkSlide): string {
  const layoutClass = slide.layout ? ` layout-${slide.layout}` : "";
  const continuedClass = slide.continued ? " continued" : "";
  const titleHtml = slide.continued ? "" : `<h2 class="slide-title">${escapeHtml(slide.title)}</h2>`;
  const partLabel =
    slide.partIndex && slide.partCount && slide.partCount > 1
      ? ` <span class="slide-part">${slide.partIndex} / ${slide.partCount}</span>`
      : "";
  return `<section class="slide slide-chapter${layoutClass}${continuedClass}" id="${escapeHtml(slide.id)}">
    <header class="slide-head">
      <span class="slide-kicker">${escapeHtml(slide.title)}</span>${partLabel}
    </header>
    ${titleHtml}
    <div class="slide-body">${slide.html}</div>
  </section>`;
}

/**
 * 从独立 HTML 生成对应的 talk 演讲页 HTML。
 * 输入：html 文件路径 + 可选主题覆写
 * 输出：完整 talk.html（包含样式、模板、所有 slide）
 */
export async function buildHtmlTalkHTML(input: {
  htmlPath: string;
  themeOverride: string;
}): Promise<string> {
  const html = await readFile(input.htmlPath, "utf8");
  const cover = extractCover(html);
  const sections = extractSections(html);

  const slides: TalkSlide[] = [];
  if (cover) {
    slides.push({ id: "cover", kind: "cover", title: cover.title, html: "" });
  }

  for (const section of sections) {
    const blocks = splitHtmlBlocks(section.body);
    const screens = packScreens(blocks);
    const baseId = section.id || "ch";
    screens.forEach((screenHtml, i) => {
      slides.push({
        id: i === 0 ? baseId : `${baseId}-${i + 1}`,
        kind: "chapter",
        title: section.title,
        subtitle: section.subtitle,
        html: screenHtml,
        layout: layoutFor(screenHtml),
        continued: i > 0,
        partIndex: i + 1,
        partCount: screens.length,
      });
    });
  }

  const slidesHtml = slides
    .map((s) => {
      if (s.kind === "cover") {
        return renderCoverSlide(cover!);
      }
      return renderChapterSlide(s);
    })
    .join("\n");

  const [template, css] = await Promise.all([
    readFile(path.join(projectRoot, "templates/talk/template.html"), "utf8"),
    readFile(path.join(projectRoot, "templates/talk/talk.css"), "utf8"),
  ]);

  const fullTitle = cover ? `${cover.kicker} · ${cover.title}` : "演讲版";

  return template
    .replaceAll("{{title}}", escapeHtml(fullTitle))
    .replace("{{styles}}", `${css}\n${input.themeOverride}`)
    .replace("{{slides}}", slidesHtml);
}