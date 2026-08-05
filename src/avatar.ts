/**
 * 头像内联
 * 职责：把 front matter 里的头像路径读成 data URI，让导出的 HTML/PDF 不依赖外部文件。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

/**
 * 把头像路径解析为 data URI。
 * 已经是 data:/http(s): 的原样返回；读不到或格式不支持时返回空串（首屏自动降级为无头像版式）。
 */
export function inlineAvatar(value: string): string {
  const source = value.trim();

  if (!source || source.startsWith("data:") || source.startsWith("http://") || source.startsWith("https://")) {
    return source;
  }

  const mime = MIME_BY_EXT[path.extname(source).toLowerCase()];
  if (!mime) {
    console.warn(`Avatar skipped (unsupported type): ${source}`);
    return "";
  }

  try {
    const buffer = readFileSync(path.resolve(projectRoot, source));
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    console.warn(`Avatar skipped (not found): ${source}`);
    return "";
  }
}
