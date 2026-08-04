/**
 * 简历内容 flow
 * 职责：把 Markdown 简历按业务线规划成稳定的 PDF 页面。
 */
import type { DocumentMeta, HtmlSection, PageChrome, TocItem } from "./types.js";
import { countMatches, escapeHtml, slugify, stripHtml } from "./html-utils.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";

interface ResumePlan {
  introHtml: string;
  sections: HtmlSection[];
  groups: HtmlSection[][];
}

/** 渲染简历页面。 */
export function renderResumeDocument(html: string, toc: TocItem[], meta: DocumentMeta, pageChrome: PageChrome): string {
  const plan = planResumeDocument(html, toc);
  const firstGroup = plan.groups[0] ?? [];
  const restGroups = plan.groups.slice(1);

  return [
    renderResumeFirstPage(meta, plan.introHtml, plan.sections, firstGroup, pageChrome),
    ...restGroups.map((group, index) => renderResumeBodyPage(group, index + 2, pageChrome))
  ].join("\n");
}

/** 输出简历 page-plan.json。 */
export async function writeResumePagePlan(inputPath: string, html: string, toc: TocItem[]): Promise<void> {
  const plan = planResumeDocument(html, toc);
  const inputName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(projectRoot, "output", `${inputName}-page-plan.json`);
  const payload = {
    flow: "resume hero -> selected focus -> experience groups -> evidence-backed capabilities",
    contract: {
      templateIndependent: true,
      goal: "先按职业叙事选择业务线和项目群，再套用任意简历视觉模板。",
      maxGroupWeight: 1800,
      firstGroupWeight: 850,
      firstPageRole: "定位、摘要、精选业务线和第一组经历"
    },
    pages: plan.groups.map((group, index) => ({
      page: index + 1,
      role: index === 0 ? "resume-cover-and-primary-experience" : "resume-experience",
      title: group.map((section) => section.title).join(" / "),
      weight: group.reduce((sum, section) => sum + section.weight, 0),
      sections: group.map((section) => ({
        id: section.id,
        title: section.title,
        weight: section.weight
      }))
    }))
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Page plan written: ${path.relative(projectRoot, outputPath)}`);
}

function planResumeDocument(html: string, toc: TocItem[]): ResumePlan {
  const sections = parseResumeSections(addHeadingIds(html, toc));

  return {
    introHtml: stripFirstHeading(getIntroHtml(html)),
    sections,
    groups: groupResumeSections(sections)
  };
}

function renderResumeFirstPage(
  meta: DocumentMeta,
  introHtml: string,
  sections: HtmlSection[],
  firstGroup: HtmlSection[],
  pageChrome: PageChrome
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
    `<div class="resume-sections resume-primary-sections">${primarySections}</div>`,
    renderPageFooter(pageChrome),
    `</section>`
  ].join("\n");
}

function renderResumeBodyPage(sections: HtmlSection[], pageNumber: number, pageChrome: PageChrome): string {
  return [
    `<section class="resume-page resume-body-page">`,
    renderPageHeader(pageChrome),
    `<div class="resume-page-title">`,
    `<p class="resume-label">Experience ${String(pageNumber).padStart(2, "0")}</p>`,
    `<h2>${escapeHtml(sections.map((section) => section.title).join(" / "))}</h2>`,
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

function groupResumeSections(sections: HtmlSection[]): HtmlSection[][] {
  const pages: HtmlSection[][] = [];
  let current: HtmlSection[] = [];
  let currentWeight = 0;
  let maxWeight = 850;

  for (const section of sections) {
    const wouldOverflow = current.length > 0 && currentWeight + section.weight > maxWeight;
    if (wouldOverflow) {
      pages.push(current);
      current = [];
      currentWeight = 0;
      maxWeight = 1800;
    }

    current.push(section);
    currentWeight += section.weight;
  }

  if (current.length > 0) {
    pages.push(current);
  }

  return pages;
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
  if (/支付|收银台|钱包|跨境/.test(section.title)) {
    return "支付业务复杂度与交付主线。";
  }

  if (/AI|ModelGo|Studio/.test(section.title)) {
    return "AI 平台产品化与工具链。";
  }

  if (/基础设施|CLI|SDK|Token|工程/.test(section.title)) {
    return "可复用工程资产沉淀。";
  }

  if (/官网|文档|国际化|站点/.test(section.title)) {
    return "多市场内容和开发者体验。";
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
