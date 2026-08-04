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
import { loadThemeOverride } from "./theme.js";
import { templateNames } from "./types.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(projectRoot, options.input);
  const source = await readFile(inputPath, "utf8");
  const parsed = parseMarkdownDocument(source);
  const themeOverride = await loadThemeOverride(options.themePath);
  const toc = buildToc(parsed.body);
  const articlePlan = planArticlePages(renderMarkdown(parsed.body), toc);
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

await main();
