/**
 * HTML 与文本工具
 * 职责：提供渲染、slug 和简单文本处理所需的通用纯函数。
 */

/** 转义 HTML 字符。 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** 生成稳定章节锚点。 */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

/** 移除 HTML 标签并压缩空白。 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 清理 Markdown 行内标记。 */
export function cleanMarkdownInline(value: string): string {
  return value
    .replace(/[`*_~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

/** 统计正则匹配数量。 */
export function countMatches(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length;
}

/** 清理 CSS 注释中的闭合标记。 */
export function escapeCssComment(value: string): string {
  return value.replaceAll("/*", "").replaceAll("*/", "").trim();
}
