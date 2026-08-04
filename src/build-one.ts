/**
 * 单模板构建流程
 * 职责：把已规划好的正文 HTML 渲染为 HTML、PDF 和长图文件。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";
import type { DocumentMeta, TemplateName, TocItem } from "./types.js";
import { renderPdf, renderShareImage } from "./browser-output.js";
import { renderTemplate } from "./template-renderer.js";

/** 构建单个模板输出。 */
export async function buildPdf(input: {
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
