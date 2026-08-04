/**
 * Markdown 解析
 * 职责：解析 front matter、渲染 Markdown HTML，并提取目录结构。
 */
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import type { DocumentMeta, DocumentType, TocItem } from "./types.js";
import { interpolateEnv } from "./env.js";
import { cleanMarkdownInline, escapeHtml, slugify } from "./html-utils.js";

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

/** 解析 Markdown 文档和 front matter。 */
export function parseMarkdownDocument(source: string): { meta: DocumentMeta; body: string } {
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
      documentType: toDocumentType(entries.documentType),
      pageHeader: entries.pageHeader ?? "Knowledge PDF Kit",
      pageFooter: entries.pageFooter ?? entries.title ?? "知识类教程",
      shareHeader: entries.shareHeader ?? entries.title ?? "知识类教程",
      shareFooter: entries.shareFooter ?? "适合收藏，适合转发，也适合复习。",
      role: entries.role ?? "前端开发工程师",
      location: entries.location ?? "杭州",
      contact: entries.contact ?? "email@example.com",
      links: entries.links ?? "GitHub / Portfolio"
    },
    body
  };
}

/** 渲染 Markdown 正文 HTML。 */
export function renderMarkdown(source: string): string {
  return markdown.render(source);
}

/** 提取二级和三级标题目录。 */
export function buildToc(source: string): TocItem[] {
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

function parseFrontMatter(raw: string): Partial<Record<keyof DocumentMeta, string>> {
  const entries: Partial<Record<keyof DocumentMeta, string>> = {};
  const metaKeys = new Set<keyof DocumentMeta>([
    "title",
    "subtitle",
    "date",
    "author",
    "documentType",
    "pageHeader",
    "pageFooter",
    "shareHeader",
    "shareFooter",
    "role",
    "location",
    "contact",
    "links"
  ]);

  for (const line of raw.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = interpolateEnv(line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, ""));

    if (metaKeys.has(key as keyof DocumentMeta)) {
      entries[key as keyof DocumentMeta] = value;
    }
  }

  return entries;
}

function toDocumentType(value: string | undefined): DocumentType {
  if (value === "resume") {
    return "resume";
  }

  return "tutorial";
}
