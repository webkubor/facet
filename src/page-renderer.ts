/**
 * 内容页 HTML 渲染
 * 职责：把 content flow 页面计划渲染为模板可复用的正文 HTML 片段。
 */
import type { ArticlePlan, DocumentMeta, HtmlSection, PageChrome, PlannedPage } from "./types.js";
import { escapeHtml } from "./html-utils.js";

/** 创建正文页页眉页脚配置。 */
export function createPageChrome(meta: DocumentMeta): PageChrome {
  return {
    headerLeft: meta.pageHeader,
    headerRight: meta.date,
    footerLeft: meta.pageFooter,
    footerRight: meta.author
  };
}

/** 渲染文章正文页面。 */
export function renderArticlePlan(plan: ArticlePlan, pageChrome: PageChrome): string {
  return plan.pages.map((page) => {
    if (page.role === "overview") {
      return renderOverviewPage(page, plan.introHtml, pageChrome);
    }

    const body = page.sections.map((section) => section.html).join("\n");
    return renderFramedLessonPage("flow-lesson-page", body, pageChrome);
  }).join("\n");
}

function renderOverviewPage(page: PlannedPage, introHtml: string, pageChrome: PageChrome): string {
  const intro = introHtml || "<h1>学习地图</h1><p>先建立整体理解，再进入具体章节。</p>";
  const knowledgeCards = page.sections.map((section, index) => [
    `<a class="flow-card" href="#${section.id}">`,
    `<span>${String(index + 1).padStart(2, "0")}</span>`,
    `<strong>${escapeHtml(section.title)}</strong>`,
    `<em>${describeSection(section, index)}</em>`,
    `</a>`
  ].join("")).join("\n");

  return [
    `<section class="lesson-page overview-page">`,
    renderPageHeader(pageChrome),
    `<div class="lesson-content">`,
    `<div class="overview-intro">${intro}</div>`,
    `<div class="flow-band">`,
    `<p class="section-label">Learning Flow</p>`,
    `<h2>这一册怎么读</h2>`,
    `<div class="flow-steps">`,
    `<section><span>01</span><strong>先抓直觉</strong><p>用一个简单理解降低门槛。</p></section>`,
    `<section><span>02</span><strong>再拆方法</strong><p>把知识点变成可套用结构。</p></section>`,
    `<section><span>03</span><strong>马上练习</strong><p>用真实场景检查是否学会。</p></section>`,
    `</div>`,
    `</div>`,
    `<div class="knowledge-map">`,
    `<p class="section-label">Knowledge Points</p>`,
    `<h2>本册知识点</h2>`,
    `<div class="flow-grid">${knowledgeCards}</div>`,
    `</div>`,
    `</div>`,
    renderPageFooter(pageChrome),
    `</section>`
  ].join("\n");
}

function renderFramedLessonPage(className: string, body: string, pageChrome: PageChrome): string {
  return [
    `<section class="lesson-page ${className}">`,
    renderPageHeader(pageChrome),
    `<div class="lesson-content">${body}</div>`,
    renderPageFooter(pageChrome),
    `</section>`
  ].join("\n");
}

function renderPageHeader(pageChrome: PageChrome): string {
  return [
    `<header class="page-header lesson-page-header">`,
    `<span>${escapeHtml(pageChrome.headerLeft)}</span>`,
    `<span>${escapeHtml(pageChrome.headerRight)}</span>`,
    `</header>`
  ].join("");
}

function renderPageFooter(pageChrome: PageChrome): string {
  return [
    `<footer class="page-footer">`,
    `<span>${escapeHtml(pageChrome.footerLeft)}</span>`,
    `<span>${escapeHtml(pageChrome.footerRight)}</span>`,
    `</footer>`
  ].join("");
}

function describeSection(section: HtmlSection, index: number): string {
  const hasTable = section.html.includes("<table");
  const hasCode = section.html.includes("<pre");
  const hasList = section.html.includes("<ul") || section.html.includes("<ol");

  if (hasCode) {
    return "可直接复用。";
  }

  if (hasTable) {
    return "对照看差异。";
  }

  if (hasList) {
    return "整理成清单。";
  }

  if (index === 0) {
    return "建立整体理解。";
  }

  return "补齐关键认知。";
}
