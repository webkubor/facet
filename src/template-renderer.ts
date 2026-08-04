/**
 * 模板 HTML 渲染
 * 职责：拼装基础 HTML、公共 CSS、模板 CSS 和用户主题覆写。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";
import type { DocumentMeta, TemplateName, TocItem } from "./types.js";
import { escapeHtml } from "./html-utils.js";

/** 渲染完整 HTML 文档。 */
export async function renderTemplate(
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
