/**
 * 知识教程 PDF 构建器入口
 * 职责：编排 Markdown 解析、content flow 规划、模板渲染和 PDF/长图输出。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "./args.js";
import { buildPdf } from "./build-one.js";
import { planArticlePages, writePagePlan } from "./content-flow.js";
import { buildToc, parseMarkdownDocument, renderMarkdown } from "./markdown.js";
import { createPageChrome, renderArticlePlan } from "./page-renderer.js";
import { projectRoot } from "./paths.js";
import { renderResumeDocument, writeResumePagePlan } from "./resume-flow.js";
import { loadThemeOverride } from "./theme.js";
import { isResumeTemplate, resumeTemplateNames, tutorialTemplateNames } from "./types.js";

async function main(): Promise<void> {
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
    const bodyHtml = renderResumeDocument(renderedMarkdown, toc, parsed.meta, pageChrome);
    await writeResumePagePlan(inputPath, renderedMarkdown, toc);

    if (options.all) {
      const inputName = path.basename(inputPath, path.extname(inputPath));
      for (const resumeTemplateName of resumeTemplateNames) {
        const outputPath = path.resolve(projectRoot, `output/${inputName}-${resumeTemplateName}.pdf`);
        await buildPdf({ meta: parsed.meta, bodyHtml, toc, outputPath, templateName: resumeTemplateName, share: options.share, themeOverride });
      }

      return;
    }

    const outputPath = path.resolve(projectRoot, options.outputProvided ? options.output : createDefaultOutput(inputPath, templateName));
    await buildPdf({ meta: parsed.meta, bodyHtml, toc, outputPath, templateName, share: options.share, themeOverride });
    return;
  }

  const articlePlan = planArticlePages(renderedMarkdown, toc);
  const bodyHtml = renderArticlePlan(articlePlan, pageChrome);
  await writePagePlan(inputPath, articlePlan);

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
