/**
 * 简历内容 flow
 * 职责：把 Markdown 简历按业务线规划成稳定的 PDF 页面。
 */
import type { DocumentMeta, HtmlSection, PageChrome, TocItem } from "./types.js";
import { countMatches, escapeHtml, slugify, stripHtml } from "./html-utils.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";

export interface ResumeParts {
  introHtml: string;
  sections: HtmlSection[];
}

export interface ResumeMeasure {
  page1Budget: number;
  bodyBudget: number;
  gap: number;
  cardHeights: number[];
}

/** 打印度量与屏幕度量存在 1-2px 漂移，装箱时预留安全余量。 */
const PACK_SAFETY_PX = 8;
const MEASURE_DUMMY_TITLE = "量测占位标题量测占位标题量测占位标题量测占位标题量测占位标题量测占位标题量测占位标题";

/** 解析简历导语与章节。 */
export function parseResumeParts(html: string, toc: TocItem[]): ResumeParts {
  return {
    introHtml: stripFirstHeading(getIntroHtml(html)),
    sections: parseResumeSections(addHeadingIds(html, toc))
  };
}

/** 生成量测文档：首页留空槽位测预算，正文页测预算与每张卡片实际像素高。 */
export function renderResumeMeasureDocument(parts: ResumeParts, meta: DocumentMeta, pageChrome: PageChrome): string {
  const cards = parts.sections.map((section) => renderResumeSection(section)).join("\n");

  return [
    `<style>[data-measure="slot"] { flex: 1 1 auto; }</style>`,
    renderResumeFirstPage(meta, parts.introHtml, parts.sections, [], pageChrome, true),
    renderMeasureBodyPage(`<div class="resume-sections" data-measure="slot"></div>`),
    renderMeasureBodyPage(`<div class="resume-sections" data-measure="cards">${cards}</div>`)
  ].join("\n");
}

/** 按真实像素预算贪心装箱分页。 */
export function packResumeSections(parts: ResumeParts, measure: ResumeMeasure): HtmlSection[][] {
  const groups: HtmlSection[][] = [];
  let current: HtmlSection[] = [];
  let used = 0;
  let budget = Math.max(measure.page1Budget - PACK_SAFETY_PX, 0);

  parts.sections.forEach((section, index) => {
    section.heightPx = measure.cardHeights[index] ?? 0;
    const need = current.length > 0 ? section.heightPx + measure.gap : section.heightPx;

    if (current.length > 0 && used + need > budget) {
      groups.push(current);
      current = [];
      used = 0;
      budget = Math.max(measure.bodyBudget - PACK_SAFETY_PX, 0);
    }

    current.push(section);
    used += current.length > 1 ? section.heightPx + measure.gap : section.heightPx;
  });

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

/** 按量测得到的分组渲染简历页面。 */
export function renderResumeDocumentFromGroups(parts: ResumeParts, groups: HtmlSection[][], meta: DocumentMeta, pageChrome: PageChrome): string {
  const firstGroup = groups[0] ?? [];
  const restGroups = groups.slice(1);

  return [
    renderResumeFirstPage(meta, parts.introHtml, parts.sections, firstGroup, pageChrome),
    ...restGroups.map((group, index) => renderResumeBodyPage(group, index + 2, pageChrome))
  ].join("\n");
}

/** 输出简历 page-plan.json。 */
export async function writeResumePagePlan(inputPath: string, groups: HtmlSection[][], measure: ResumeMeasure): Promise<void> {
  const inputName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(projectRoot, "output", `${inputName}-page-plan.json`);
  const payload = {
    flow: "resume hero -> selected focus -> experience groups -> evidence-backed capabilities",
    contract: {
      templateIndependent: false,
      goal: "先在真实模板与打印宽度下量测每个章节的像素高，再按每页真实预算装箱分页。",
      page1BudgetPx: measure.page1Budget,
      bodyBudgetPx: measure.bodyBudget,
      packSafetyPx: PACK_SAFETY_PX,
      firstPageRole: "定位、摘要、精选业务线和第一组经历"
    },
    pages: groups.map((group, index) => ({
      page: index + 1,
      role: index === 0 ? "resume-cover-and-primary-experience" : "resume-experience",
      title: group.map((section) => section.title).join(" / "),
      heightPx: group.reduce((sum, section) => sum + (section.heightPx ?? 0), 0),
      sections: group.map((section) => ({
        id: section.id,
        title: section.title,
        heightPx: section.heightPx ?? 0
      }))
    }))
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Page plan written: ${path.relative(projectRoot, outputPath)}`);
}

function renderMeasureBodyPage(sectionsHtml: string): string {
  return [
    `<section class="resume-page resume-body-page">`,
    `<header class="resume-page-header"><span>measure</span><span>measure</span></header>`,
    `<div class="resume-page-title">`,
    `<p class="resume-label">Experience 00</p>`,
    `<h2>${MEASURE_DUMMY_TITLE}</h2>`,
    `</div>`,
    sectionsHtml,
    `<footer class="resume-page-footer"><span>measure</span><span>measure</span></footer>`,
    `</section>`
  ].join("\n");
}

function renderResumeFirstPage(
  meta: DocumentMeta,
  introHtml: string,
  sections: HtmlSection[],
  firstGroup: HtmlSection[],
  pageChrome: PageChrome,
  measureMode = false
): string {
  const snapshotCards = sections.slice(0, 4).map((section, index) => [
    `<section>`,
    `<span>${String(index + 1).padStart(2, "0")}</span>`,
    `<strong>${escapeHtml(section.title)}</strong>`,
    `<p>${describeResumeSection(section)}</p>`,
    `</section>`
  ].join("")).join("\n");
  const primarySections = firstGroup.map((section) => renderResumeSection(section)).join("\n");

  return [
    `<section class="resume-page resume-first-page">`,
    renderPageHeader(pageChrome),
    `<div class="resume-hero">`,
    `<p class="resume-kicker">${escapeHtml(meta.role)}</p>`,
    `<h1>${escapeHtml(meta.title)}</h1>`,
    `<p class="resume-subtitle">${escapeHtml(meta.subtitle)}</p>`,
    `<div class="resume-contact-row">`,
    `<span>${escapeHtml(meta.location)}</span>`,
    `<span>${escapeHtml(meta.contact)}</span>`,
    `<span>${escapeHtml(meta.links)}</span>`,
    `</div>`,
    `</div>`,
    `<div class="resume-summary">${introHtml}</div>`,
    `<div class="resume-snapshot">`,
    `<p class="resume-label">Selected Focus</p>`,
    `<div class="resume-snapshot-grid">${snapshotCards}</div>`,
    `</div>`,
    `<div class="resume-sections resume-primary-sections"${measureMode ? ` data-measure="slot"` : ""}>${primarySections}</div>`,
    meta.motto ? `<p class="resume-motto">「${escapeHtml(meta.motto)}」</p>` : "",
    renderPageFooter(pageChrome),
    `</section>`
  ].join("\n");
}

function renderResumeBodyPage(sections: HtmlSection[], pageNumber: number, pageChrome: PageChrome): string {
  const titles = sections.map((section) => section.title);
  const pageTitle = titles.length > 2 ? `${titles.slice(0, 2).join(" / ")} 等` : titles.join(" / ");

  return [
    `<section class="resume-page resume-body-page">`,
    renderPageHeader(pageChrome),
    `<div class="resume-page-title">`,
    `<p class="resume-label">Experience ${String(pageNumber).padStart(2, "0")}</p>`,
    `<h2>${escapeHtml(pageTitle)}</h2>`,
    `</div>`,
    `<div class="resume-sections">${sections.map((section) => renderResumeSection(section)).join("\n")}</div>`,
    renderPageFooter(pageChrome),
    `</section>`
  ].join("\n");
}

function renderResumeSection(section: HtmlSection): string {
  return [
    `<section class="resume-section-card" id="${section.id}">`,
    `<h3>${escapeHtml(section.title)}</h3>`,
    `<div class="resume-section-body">${removeLeadingH2(section.html)}</div>`,
    `</section>`
  ].join("\n");
}

function parseResumeSections(html: string): HtmlSection[] {
  const firstH2Index = html.search(/<h2 id="/);
  if (firstH2Index === -1) {
    return [{
      id: "resume",
      title: "核心经历",
      html,
      weight: estimateResumeWeight(html)
    }];
  }

  return html
    .slice(firstH2Index)
    .split(/(?=<h2 id=")/)
    .map((section) => section.trim())
    .filter(Boolean)
    .map((section) => {
      const headingMatch = section.match(/^<h2 id="([^"]+)">([\s\S]*?)<\/h2>/);
      return {
        id: headingMatch?.[1] ?? slugify(stripHtml(section).slice(0, 24)),
        title: stripHtml(headingMatch?.[2] ?? "项目经历"),
        html: section,
        weight: estimateResumeWeight(section)
      };
    });
}

function getIntroHtml(html: string): string {
  const firstH2Index = html.search(/<h2>/);
  if (firstH2Index === -1) {
    return html;
  }

  return html.slice(0, firstH2Index).trim();
}

function stripFirstHeading(html: string): string {
  const stripped = html.replace(/^<h1>[\s\S]*?<\/h1>\s*/, "").trim();
  return stripped || "<p>用项目结果组织经历，用业务线呈现技术判断。</p>";
}

function removeLeadingH2(html: string): string {
  return html.replace(/^<h2 id="[^"]+">[\s\S]*?<\/h2>\s*/, "");
}

function estimateResumeWeight(html: string): number {
  const plainTextLength = html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
  const listWeight = countMatches(html, /<li\b/g) * 34;
  const tableWeight = countMatches(html, /<tr\b/g) * 82;
  const headingWeight = countMatches(html, /<h[23]\b/g) * 72;

  return plainTextLength + listWeight + tableWeight + headingWeight;
}

function describeResumeSection(section: HtmlSection): string {
  const firstItem = section.html.match(/<li\b[^>]*>([\s\S]*?)<\/li>/);
  const text = stripHtml(firstItem?.[1] ?? "").replace(/\s+/g, " ").trim();

  if (text) {
    return text.length > 42 ? `${text.slice(0, 42)}…` : text;
  }

  return "代表项目和可验证结果。";
}

function addHeadingIds(html: string, toc: TocItem[]): string {
  let index = 0;

  return html.replace(/<h([23])>(.*?)<\/h\1>/g, (fullMatch: string, level: string, textHtml: string) => {
    const item = toc[index];
    index += 1;

    if (!item || String(item.level) !== level) {
      return fullMatch;
    }

    return `<h${level} id="${item.id}">${textHtml}</h${level}>`;
  });
}

function renderPageHeader(pageChrome: PageChrome): string {
  return [
    `<header class="resume-page-header">`,
    `<span>${escapeHtml(pageChrome.headerLeft)}</span>`,
    `<span>${escapeHtml(pageChrome.headerRight)}</span>`,
    `</header>`
  ].join("");
}

function renderPageFooter(pageChrome: PageChrome): string {
  return [
    `<footer class="resume-page-footer">`,
    `<span>${escapeHtml(pageChrome.footerLeft)}</span>`,
    `<span>${escapeHtml(pageChrome.footerRight)}</span>`,
    `</footer>`
  ].join("");
}
