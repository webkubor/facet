/**
 * 知识教程 PDF 构建器
 * 职责：读取 Markdown 教程，套用 HTML/CSS 模板，并通过 Playwright 生成 PDF。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import { chromium } from "playwright";

/** 教程元信息。 */
interface DocumentMeta {
  title: string;
  subtitle: string;
  date: string;
  author: string;
  pageHeader: string;
  pageFooter: string;
  shareHeader: string;
  shareFooter: string;
}

/** 命令行参数。 */
interface BuildOptions {
  input: string;
  output: string;
  template: TemplateName;
  themePath: string | undefined;
  all: boolean;
  share: boolean;
}

/** 用户偏好主题配置。 */
interface ThemePreference {
  name?: string;
  colors?: Partial<Record<ThemeColorKey, string>>;
  cssVariables?: Record<string, string>;
}

/** 可直接通过 colors 快速覆写的语义色。 */
type ThemeColorKey = "paper" | "ink" | "muted" | "faint" | "soft" | "accent" | "accent2" | "danger";

/** 内页页眉页脚配置。 */
interface PageChrome {
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
  footerRight: string;
}

/** 目录项。 */
interface TocItem {
  level: number;
  id: string;
  text: string;
}

/** Markdown 渲染后的章节片段。 */
interface HtmlSection {
  id: string;
  title: string;
  html: string;
  weight: number;
}

/** 模板无关的正文分页计划。 */
interface PlannedPage {
  role: "overview" | "lesson";
  title: string;
  sections: HtmlSection[];
  weight: number;
}

/** 构建器输出的内容 flow。 */
interface ArticlePlan {
  introHtml: string;
  pages: PlannedPage[];
}

type TemplateName =
  | "warm-handbook"
  | "wechat-magazine"
  | "creator-notebook"
  | "course-workbook"
  | "editorial-poster"
  | "research-dossier"
  | "gallery-catalog"
  | "strategy-brief";

const templateNames: TemplateName[] = [
  "warm-handbook",
  "wechat-magazine",
  "creator-notebook",
  "course-workbook",
  "editorial-poster",
  "research-dossier",
  "gallery-catalog",
  "strategy-brief"
];

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code: string, language: string): string {
    if (language && hljs.getLanguage(language)) {
      const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
      return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>`;
    }

    return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
  }
});

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(projectRoot, options.input);
  const source = await readFile(inputPath, "utf8");
  const parsed = parseMarkdownDocument(source);
  const themeOverride = await loadThemeOverride(options.themePath);
  const toc = buildToc(parsed.body);
  const articlePlan = planArticlePages(markdown.render(parsed.body), toc);
  const pageChrome = createPageChrome(parsed.meta);
  const bodyHtml = renderArticlePlan(articlePlan, pageChrome);
  await writePagePlan(inputPath, articlePlan);

  if (options.all) {
    for (const templateName of templateNames) {
      const outputPath = path.resolve(projectRoot, `output/example-${templateName}.pdf`);
      await buildPdf({ meta: parsed.meta, bodyHtml, toc, outputPath, templateName, share: options.share, themeOverride });
    }

    return;
  }

  const outputPath = path.resolve(projectRoot, options.output);
  await buildPdf({ meta: parsed.meta, bodyHtml, toc, outputPath, templateName: options.template, share: options.share, themeOverride });
}

function parseArgs(args: string[]): BuildOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];

    if (!key || key === "--" || !key.startsWith("--")) {
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      flags.add(key);
      continue;
    }

    values.set(key.slice(2), value);
    index += 1;
  }

  const template = toTemplateName(values.get("template") ?? "warm-handbook");

  return {
    input: values.get("input") ?? "content/example.md",
    output: values.get("output") ?? `output/example-${template}.pdf`,
    template,
    themePath: values.get("theme"),
    all: flags.has("--all"),
    share: !flags.has("--no-share")
  };
}

async function buildPdf(input: {
  meta: DocumentMeta;
  bodyHtml: string;
  toc: TocItem[];
  outputPath: string;
  templateName: TemplateName;
  share: boolean;
  themeOverride: string;
}): Promise<void> {
  const htmlPath = input.outputPath.replace(/\.pdf$/i, ".html");
  const sharePath = input.outputPath.replace(/\.pdf$/i, ".share.png");
  const html = await renderTemplate(input.meta, input.bodyHtml, input.toc, input.templateName, input.themeOverride);

  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await writeFile(htmlPath, html, "utf8");
  await renderPdf(html, input.outputPath);

  if (input.share) {
    await renderShareImage(html, sharePath);
  }

  console.log(`Template: ${input.templateName}`);
  console.log(`HTML written: ${path.relative(projectRoot, htmlPath)}`);
  console.log(`PDF written: ${path.relative(projectRoot, input.outputPath)}`);
  if (input.share) {
    console.log(`Share image written: ${path.relative(projectRoot, sharePath)}`);
  }
}

function toTemplateName(value: string): TemplateName {
  if (templateNames.includes(value as TemplateName)) {
    return value as TemplateName;
  }

  throw new Error(`Unknown template "${value}". Available: ${templateNames.join(", ")}`);
}

function parseMarkdownDocument(source: string): { meta: DocumentMeta; body: string } {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const rawMeta = match?.[1] ?? "";
  const body = match?.[2] ?? source;
  const entries = parseFrontMatter(rawMeta);

  return {
    meta: {
      title: entries.title ?? "知识类教程",
      subtitle: entries.subtitle ?? "HTML/CSS 到 PDF",
      date: entries.date ?? new Date().toISOString().slice(0, 10),
      author: entries.author ?? "Knowledge PDF Kit",
      pageHeader: entries.pageHeader ?? "Knowledge PDF Kit",
      pageFooter: entries.pageFooter ?? entries.title ?? "知识类教程",
      shareHeader: entries.shareHeader ?? entries.title ?? "知识类教程",
      shareFooter: entries.shareFooter ?? "适合收藏，适合转发，也适合复习。"
    },
    body
  };
}

function parseFrontMatter(raw: string): Partial<DocumentMeta> {
  const entries: Partial<DocumentMeta> = {};
  const metaKeys = new Set<keyof DocumentMeta>([
    "title",
    "subtitle",
    "date",
    "author",
    "pageHeader",
    "pageFooter",
    "shareHeader",
    "shareFooter"
  ]);

  for (const line of raw.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (metaKeys.has(key as keyof DocumentMeta)) {
      entries[key as keyof DocumentMeta] = value;
    }
  }

  return entries;
}

function createPageChrome(meta: DocumentMeta): PageChrome {
  return {
    headerLeft: meta.pageHeader,
    headerRight: meta.date,
    footerLeft: meta.pageFooter,
    footerRight: meta.author
  };
}

function buildToc(source: string): TocItem[] {
  const items: TocItem[] = [];
  const headingPattern = /^(#{2,3})\s+(.+)$/gm;
  const usedIds = new Map<string, number>();
  let match: RegExpExecArray | null = headingPattern.exec(source);

  while (match) {
    const marker = match[1] ?? "";
    const text = cleanMarkdownInline(match[2] ?? "");
    const baseId = slugify(text);
    const count = usedIds.get(baseId) ?? 0;
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    usedIds.set(baseId, count + 1);
    items.push({ level: marker.length, id, text });
    match = headingPattern.exec(source);
  }

  return items;
}

function planArticlePages(html: string, toc: TocItem[]): ArticlePlan {
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

function renderArticlePlan(plan: ArticlePlan, pageChrome: PageChrome): string {
  return plan.pages.map((page) => {
    if (page.role === "overview") {
      return renderOverviewPage(page, plan.introHtml, pageChrome);
    }

    const body = page.sections.map((section) => section.html).join("\n");
    return renderFramedLessonPage("flow-lesson-page", body, pageChrome);
  }).join("\n");
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

async function writePagePlan(inputPath: string, plan: ArticlePlan): Promise<void> {
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

function estimateSectionWeight(html: string): number {
  const plainTextLength = html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length;
  const tableWeight = countMatches(html, /<tr\b/g) * 92;
  const codeWeight = countMatches(html, /<pre\b/g) * 260;
  const quoteWeight = countMatches(html, /<blockquote\b/g) * 160;
  const headingWeight = countMatches(html, /<h[23]\b/g) * 90;

  return plainTextLength + tableWeight + codeWeight + quoteWeight + headingWeight;
}

function countMatches(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length;
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

async function renderTemplate(
  meta: DocumentMeta,
  body: string,
  toc: TocItem[],
  templateName: TemplateName,
  themeOverride: string
): Promise<string> {
  const templatePath = path.join(projectRoot, "templates/base/template.html");
  const commonStylesPath = path.join(projectRoot, "templates/base/common.css");
  const themeStylesPath = path.join(projectRoot, `templates/${templateName}/print.css`);
  const [template, commonStyles, themeStyles] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(commonStylesPath, "utf8"),
    readFile(themeStylesPath, "utf8")
  ]);

  return template
    .replaceAll("{{title}}", escapeHtml(meta.title))
    .replaceAll("{{subtitle}}", escapeHtml(meta.subtitle))
    .replaceAll("{{date}}", escapeHtml(meta.date))
    .replaceAll("{{author}}", escapeHtml(meta.author))
    .replaceAll("{{shareHeader}}", escapeHtml(meta.shareHeader))
    .replaceAll("{{shareFooter}}", escapeHtml(meta.shareFooter))
    .replaceAll("{{template}}", templateName)
    .replace("{{styles}}", `${commonStyles}\n${themeStyles}\n${themeOverride}`)
    .replace("{{toc}}", renderToc(toc))
    .replace("{{body}}", body);
}

async function loadThemeOverride(themePath?: string): Promise<string> {
  if (!themePath) {
    return "";
  }

  const resolvedPath = path.resolve(projectRoot, themePath);
  const raw = await readFile(resolvedPath, "utf8");
  const preference = parseThemePreference(raw, resolvedPath);
  const variables = createThemeVariables(preference);

  if (variables.length === 0) {
    return "";
  }

  return [`/* User theme preference: ${escapeCssComment(preference.name ?? path.basename(themePath))} */`, ":root {", ...variables, "}"].join("\n");
}

function parseThemePreference(raw: string, sourcePath: string): ThemePreference {
  try {
    return JSON.parse(raw) as ThemePreference;
  } catch (error) {
    throw new Error(`Failed to parse theme preference "${sourcePath}": ${(error as Error).message}`);
  }
}

function createThemeVariables(preference: ThemePreference): string[] {
  const colorVariables = Object.entries(preference.colors ?? {}).map(([key, value]) =>
    createThemeVariable(toThemeColorVariable(key), value)
  );
  const customVariables = Object.entries(preference.cssVariables ?? {}).map(([key, value]) =>
    createThemeVariable(key, value)
  );

  return [...colorVariables, ...customVariables];
}

function toThemeColorVariable(key: string): string {
  const variables: Record<ThemeColorKey, string> = {
    paper: "--paper",
    ink: "--ink",
    muted: "--muted",
    faint: "--faint",
    soft: "--soft",
    accent: "--accent",
    accent2: "--accent-2",
    danger: "--danger"
  };
  const variable = variables[key as ThemeColorKey];

  if (!variable) {
    throw new Error(`Unknown theme color "${key}". Available: ${Object.keys(variables).join(", ")}`);
  }

  return variable;
}

function createThemeVariable(name: string, value: string): string {
  if (!/^--[a-z0-9-]+$/i.test(name)) {
    throw new Error(`Invalid CSS variable name "${name}". Use names like "--accent".`);
  }

  if (/[;{}<>]/.test(value)) {
    throw new Error(`Invalid CSS variable value for "${name}".`);
  }

  return `  ${name}: ${value.trim()};`;
}

function renderToc(items: TocItem[]): string {
  if (items.length === 0) {
    return `<p class="toc-empty">暂无目录</p>`;
  }

  let chapterNumber = 0;
  const rows = items.map((item) => {
    const className = `toc-level-${item.level}`;
    const label = item.level === 2 ? String((chapterNumber += 1)).padStart(2, "0") : "sub";

    return [
      `<li class="${className}">`,
      `<a href="#${item.id}">`,
      `<span class="toc-number">${label}</span>`,
      `<span class="toc-title">${escapeHtml(item.text)}</span>`,
      `</a>`,
      `</li>`
    ].join("");
  });

  return `<ol class="toc-list">${rows.join("\n")}</ol>`;
}

async function renderPdf(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
  } finally {
    await browser.close();
  }
}

async function renderShareImage(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html.replace("<body ", "<body data-output=\"share\" "), { waitUntil: "networkidle" });
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: "png"
    });
  } finally {
    await browser.close();
  }
}

function cleanMarkdownInline(value: string): string {
  return value
    .replace(/[`*_~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeCssComment(value: string): string {
  return value.replaceAll("/*", "").replaceAll("*/", "").trim();
}

await main();
