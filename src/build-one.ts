/**
 * 单模板构建流程
 * 职责：把已规划好的正文 HTML 渲染为 HTML、PDF 和长图文件。
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
  // 长图沿用 CLI 的公开约定 output/x.pdf → output/x.share.png（README / CHANGELOG /
  // launch-kit 素材清单都按这个名字引用）。站点侧想要的是 share.png，由
  // scripts/build-site.mjs 构建后重命名，不改这里的约定。
  const sharePath = input.outputPath.replace(/\.pdf$/i, ".share.png");
  const html = await renderTemplate(input.meta, input.bodyHtml, input.toc, input.templateName, input.themeOverride);

  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await writeFile(htmlPath, html, "utf8");
  await renderPdf(html, input.outputPath);

  if (input.share) {
    await renderShareImage(html, sharePath);
  }

  // 路径相对 cwd 打印，与 build.ts / content-flow.ts 同口径。原先相对 projectRoot（包目录），
  // npm 安装后打出 `../../../out/b.pdf` 这种指向 node_modules 外的相对路径，用户看不懂落在哪。
  const cwd = process.cwd();
  console.log(`Template: ${input.templateName}`);
  console.log(`HTML written: ${path.relative(cwd, htmlPath)}`);
  console.log(`PDF written: ${path.relative(cwd, input.outputPath)}`);
  if (input.share) {
    console.log(`Share image written: ${path.relative(cwd, sharePath)}`);
  }
}
