/**
 * 知识教程 PDF 构建器入口
 * 职责：编排 Markdown 解析、content flow 规划、模板渲染和 PDF/长图输出。
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "./args.js";
import { buildPdf } from "./build-one.js";
import { buildTalkHTML } from "./talk.js";
import { buildReadHTML } from "./read.js";
import { loadDotEnv } from "./env.js";
import { measureResumeLayout } from "./browser-output.js";
import { planArticlePages, writePagePlan } from "./content-flow.js";
import { buildToc, parseMarkdownDocument, renderMarkdown } from "./markdown.js";
import { createPageChrome, renderArticlePlan } from "./page-renderer.js";
import { projectRoot } from "./paths.js";
import {
  packResumeSections,
  parseResumeParts,
  renderResumeDocumentFromGroups,
  renderResumeMeasureDocument,
  writeResumePagePlan
} from "./resume-flow.js";
import { renderTemplate } from "./template-renderer.js";
import { layoutOf } from "./resume-families.js";
import { loadThemeOverride } from "./theme.js";
import type { TemplateName } from "./types.js";
import { isResumeTemplate, resumeTemplateNames, tutorialTemplateNames } from "./types.js";

async function main(): Promise<void> {
  loadDotEnv();
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(projectRoot, options.input);
  const source = await readFile(inputPath, "utf8");
  const parsed = parseMarkdownDocument(source);
  const themeOverride = await loadThemeOverride(options.themePath);
  const toc = buildToc(parsed.body);
  const pageChrome = createPageChrome(parsed.meta);
  const renderedMarkdown = renderMarkdown(parsed.body);
  const isResume = parsed.meta.documentType === "resume";
  const templateName = isResume && !options.templateProvided ? "resume-payment-lead" : options.template;

  if (isResume && !isResumeTemplate(templateName)) {
    throw new Error(`Resume documents need a resume template. Available: ${resumeTemplateNames.join(", ")}`);
  }

  if (isResume) {
    const parts = parseResumeParts(renderedMarkdown, toc);

    // 分页由真实模板的量测结果驱动：不同模板的字体/间距不同，分组按模板各算各的。
    const buildResumeFor = async (resumeTemplateName: TemplateName, outputPath: string, writePlan: boolean): Promise<void> => {
      const layout = layoutOf(resumeTemplateName);
      const measureBody = renderResumeMeasureDocument(parts, parsed.meta, pageChrome, layout);
      const measureHtml = await renderTemplate(parsed.meta, measureBody, toc, resumeTemplateName, themeOverride);
      const measure = await measureResumeLayout(measureHtml);
      const groups = packResumeSections(parts, measure);
      const bodyHtml = renderResumeDocumentFromGroups(parts, groups, parsed.meta, pageChrome, layout);

      if (writePlan) {
        await writeResumePagePlan(inputPath, groups, measure);
      }

      await buildPdf({ meta: parsed.meta, bodyHtml, toc, outputPath, templateName: resumeTemplateName, share: options.share, themeOverride });
    };

    if (options.all) {
      const inputName = path.basename(inputPath, path.extname(inputPath));
      for (const [index, resumeTemplateName] of resumeTemplateNames.entries()) {
        const outputPath = path.resolve(projectRoot, `output/${inputName}-${resumeTemplateName}.pdf`);
        await buildResumeFor(resumeTemplateName, outputPath, index === 0);
      }

      return;
    }

    const outputPath = path.resolve(projectRoot, options.outputProvided ? options.output : createDefaultOutput(inputPath, templateName));
    await buildResumeFor(templateName, outputPath, true);
    return;
  }

  const articlePlan = planArticlePages(renderedMarkdown, toc);
  const bodyHtml = renderArticlePlan(articlePlan, pageChrome);
  await writePagePlan(inputPath, articlePlan);

  // talk 形态（show 导向）：只出演讲页 HTML，复用同一份 Markdown 与主题。
  if (options.talk) {
    const inputName = path.basename(inputPath, path.extname(inputPath));
    const talkPath = path.resolve(projectRoot, options.outputProvided ? options.output : `output/${inputName}.talk.html`);
    const talkHtml = await buildTalkHTML({
      meta: parsed.meta,
      toc,
      bodySource: parsed.body,
      themeOverride
    });
    await mkdir(path.dirname(talkPath), { recursive: true });
    await writeFile(talkPath, talkHtml, "utf8");
    console.log(`Talk HTML written: ${path.relative(projectRoot, talkPath)}`);
    return;
  }

  // read 形态（阅读导向）：连续排版的网页长文，不分页、不出 PDF。
  if (options.read) {
    const inputName = path.basename(inputPath, path.extname(inputPath));
    const readPath = path.resolve(projectRoot, options.outputProvided ? options.output : `output/${inputName}.read.html`);
    const readHtml = await buildReadHTML({
      meta: parsed.meta,
      toc,
      bodySource: parsed.body,
      themeOverride,
      talkHref: "talk.html"
    });
    await mkdir(path.dirname(readPath), { recursive: true });
    await writeFile(readPath, readHtml, "utf8");
    console.log(`Read HTML written: ${path.relative(projectRoot, readPath)}`);
    return;
  }

  if (options.all) {
    const inputName = path.basename(inputPath, path.extname(inputPath));
    for (const tutorialTemplateName of tutorialTemplateNames) {
      const outputPath = path.resolve(projectRoot, `output/${inputName}-${tutorialTemplateName}.pdf`);
      await buildPdf({ meta: parsed.meta, bodyHtml, toc, outputPath, templateName: tutorialTemplateName, share: options.share, themeOverride });
    }

    return;
  }

  const outputPath = path.resolve(projectRoot, options.output);
  await buildPdf({ meta: parsed.meta, bodyHtml, toc, outputPath, templateName, share: options.share, themeOverride });
}

await main();

function createDefaultOutput(inputPath: string, templateName: string): string {
  const inputName = path.basename(inputPath, path.extname(inputPath));
  return `output/${inputName}-${templateName}.pdf`;
}
