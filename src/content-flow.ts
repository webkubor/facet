/**
 * 内容分页规划
 * 职责：把 Markdown HTML 转换为模板无关的阅读 flow 和 page-plan.json。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";
import type { ArticlePlan, HtmlSection, PlannedPage, TocItem } from "./types.js";
import { countMatches, slugify, stripHtml } from "./html-utils.js";

/** 规划文章页面。 */
export function planArticlePages(html: string, toc: TocItem[]): ArticlePlan {
  const htmlWithIds = addHeadingIds(html, toc);
  const firstH2Index = htmlWithIds.search(/<h2 id="/);

  if (firstH2Index === -1) {
    const section = {
      id: "overview",
      title: "正文",
      html: htmlWithIds,
      weight: estimateSectionWeight(htmlWithIds)
    };

    return {
      introHtml: "",
      pages: [{ role: "lesson", title: section.title, sections: [section], weight: section.weight }]
    };
  }

  const intro = htmlWithIds.slice(0, firstH2Index).trim();
  const rest = htmlWithIds.slice(firstH2Index);
  const sections: HtmlSection[] = rest
    .split(/(?=<h2 id=")/)
    .map((section) => section.trim())
    .filter(Boolean)
    .map(parseHtmlSection);

  return {
    introHtml: intro,
    pages: [
      createOverviewPage(intro, sections),
      ...groupSectionsIntoPages(sections).map(createLessonPage)
    ]
  };
}

/** 输出 page-plan.json。 */
export async function writePagePlan(inputPath: string, plan: ArticlePlan): Promise<void> {
  const inputName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(projectRoot, "output", `${inputName}-page-plan.json`);
  const payload = {
    flow: "cover -> toc -> overview -> lesson pages -> final review",
    contract: {
      templateIndependent: true,
      goal: "先规划内容阶段和每页知识点，再套用任意视觉模板。",
      minLessonWeight: 760,
      maxLessonWeight: 1500
    },
    pages: [
      { page: 1, role: "cover", title: "封面" },
      { page: 2, role: "toc", title: "目录" },
      ...plan.pages.map((page, index) => ({
        page: index + 3,
        role: page.role,
        title: page.title,
        weight: page.weight,
        sections: page.sections.map((section) => ({
          id: section.id,
          title: section.title,
          weight: section.weight
        }))
      })),
      { page: plan.pages.length + 3, role: "review", title: "重点回顾 & 行动清单" }
    ]
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Page plan written: ${path.relative(projectRoot, outputPath)}`);
}

function parseHtmlSection(html: string): HtmlSection {
  const headingMatch = html.match(/^<h2 id="([^"]+)">([\s\S]*?)<\/h2>/);
  const id = headingMatch?.[1] ?? slugify(stripHtml(html).slice(0, 24));
  const title = stripHtml(headingMatch?.[2] ?? "知识点");

  return {
    id,
    title,
    html,
    weight: estimateSectionWeight(html)
  };
}

function createOverviewPage(introHtml: string, sections: HtmlSection[]): PlannedPage {
  const overviewWeight = Math.min(1200, estimateSectionWeight(introHtml) + sections.length * 120 + 520);

  return {
    role: "overview",
    title: "学习地图",
    sections,
    weight: overviewWeight
  };
}

function createLessonPage(sections: HtmlSection[]): PlannedPage {
  const title = sections.map((section) => section.title).join(" / ");
  const weight = sections.reduce((sum, section) => sum + section.weight, 0);

  return {
    role: "lesson",
    title,
    sections,
    weight
  };
}

function groupSectionsIntoPages(sections: HtmlSection[]): HtmlSection[][] {
  const pages: HtmlSection[][] = [];
  let current: HtmlSection[] = [];
  let currentWeight = 0;
  const minPageWeight = 760;
  const maxPageWeight = 1500;

  for (const section of sections) {
    const sectionStartsHeavy = section.weight >= 980;
    const wouldOverflow = current.length > 0 && currentWeight + section.weight > maxPageWeight;

    if (wouldOverflow && currentWeight < minPageWeight && current.length < 3) {
      current.push(section);
      currentWeight += section.weight;
      continue;
    }

    if (sectionStartsHeavy || wouldOverflow) {
      if (current.length > 0) {
        pages.push(current);
        current = [];
        currentWeight = 0;
      }

      if (sectionStartsHeavy) {
        pages.push([section]);
        continue;
      }
    }

    current.push(section);
    currentWeight += section.weight;
  }

  if (current.length > 0) {
    pages.push(current);
  }

  return pages;
}

function estimateSectionWeight(html: string): number {
  const plainTextLength = html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
  const tableWeight = countMatches(html, /<tr\b/g) * 92;
  const codeWeight = countMatches(html, /<pre\b/g) * 260;
  const quoteWeight = countMatches(html, /<blockquote\b/g) * 160;
  const headingWeight = countMatches(html, /<h[23]\b/g) * 90;

  return plainTextLength + tableWeight + codeWeight + quoteWeight + headingWeight;
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
