/**
 * 阅读页渲染（read 导向）
 * 职责：把同一份 Markdown 渲染成连续排版的网页长文。
 *
 * 与 talk（一屏一章节）、share（PDF/长图）是同一份内容的三个刻面：
 * talk 给现场讲，read 给人在浏览器里读，share 给分发。
 * 三者共用同一套 front matter、markdown 渲染与 --theme 覆写。
 *
 * read 不分页——分页是纸和幻灯片的约束，网页没有这个约束，
 * 硬套过来只会让读者多点很多下。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";
import { escapeHtml } from "./html-utils.js";
import { renderMarkdown } from "./markdown.js";
import type { DocumentMeta, TocItem } from "./types.js";

/** 生成完整阅读页 HTML。 */
export async function buildReadHTML(input: {
  meta: DocumentMeta;
  toc: TocItem[];
  bodySource: string;
  themeOverride: string;
  /** 同一期的演讲版链接，有则在页头给一个入口。 */
  talkHref?: string;
}): Promise<string> {
  const [template, css] = await Promise.all([
    readFile(path.join(projectRoot, "templates/read/template.html"), "utf8"),
    readFile(path.join(projectRoot, "templates/read/read.css"), "utf8")
  ]);

  const meta = input.meta;
  const chapters = input.toc.filter((item) => item.level === 2);

  const toc = chapters.length
    ? [
        `<nav class="read-toc" aria-label="目录">`,
        `<p class="read-toc-title">这篇讲了什么</p>`,
        `<ol>`,
        ...chapters.map((item) => `<li><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`),
        `</ol>`,
        `</nav>`
      ].join("\n")
    : "";

  const header = [
    meta.series ? `<p class="read-series">${escapeHtml(meta.series)}</p>` : "",
    `<h1 class="read-title">${escapeHtml(meta.title)}</h1>`,
    meta.subtitle ? `<p class="read-sub">${escapeHtml(meta.subtitle)}</p>` : "",
    `<p class="read-meta"><span>${escapeHtml(meta.author)}</span><span class="dot">·</span><span>${escapeHtml(meta.date)}</span>${
      input.talkHref ? `<a class="read-talk-link" href="${escapeHtml(input.talkHref)}">演讲版 →</a>` : ""
    }</p>`
  ].filter(Boolean).join("\n");

  const footer = [
    `<footer class="read-footer">`,
    `<p class="read-footer-title">${escapeHtml(meta.closingTitle)}</p>`,
    meta.closingNote ? `<p class="read-footer-note">${escapeHtml(meta.closingNote)}</p>` : "",
    `<p class="read-footer-by">${escapeHtml(meta.author)}<span class="dot">·</span>${escapeHtml(meta.date)}</p>`,
    meta.site ? `<p class="read-footer-site">往期都在 <strong>${escapeHtml(meta.site)}</strong></p>` : "",
    `</footer>`
  ].filter(Boolean).join("\n");

  return template
    .replaceAll("{{title}}", escapeHtml(meta.title))
    .replaceAll("{{description}}", escapeHtml(meta.subtitle || meta.title))
    .replace("{{styles}}", `${css}\n${input.themeOverride}`)
    .replace("{{header}}", header)
    .replace("{{toc}}", toc)
    .replace("{{body}}", renderMarkdown(stripLeadingH1(input.bodySource)))
    .replace("{{footer}}", footer);
}

/**
 * 正文首个 H1 与页头标题重复，去掉它——front matter 的 title 才是真源，
 * 两处都渲染会在页面顶部出现一模一样的大标题两次。
 */
function stripLeadingH1(source: string): string {
  return source.replace(/^\s*#\s+.+$/m, "").trimStart();
}
