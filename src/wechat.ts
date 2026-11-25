import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
import { escapeHtml } from "./html-utils.js";

const format = "facet.wechat/v1";
const figure = "display:block;max-width:100%;height:auto;margin:14px auto;";
const styles: Record<string, string> = {
  h1: "font-size:24px;line-height:1.4;margin:24px 0 12px;",
  h2: "font-size:21px;line-height:1.45;margin:26px 0 10px;",
  h3: "font-size:18px;line-height:1.5;margin:20px 0 8px;",
  h4: "font-size:17px;line-height:1.5;margin:18px 0 8px;",
  h5: "font-size:16px;line-height:1.5;margin:16px 0 8px;",
  h6: "font-size:16px;line-height:1.5;margin:16px 0 8px;",
  p: "margin:0 0 15px;",
  ul: "margin:0 0 15px;padding-left:22px;",
  ol: "margin:0 0 15px;padding-left:22px;",
  li: "margin:0 0 6px;",
  blockquote: "margin:18px 0;padding:8px 12px;border-left:3px solid #786047;background:#f7f4ee;",
  hr: "border:0;border-top:1px solid #dfd8cb;margin:24px 0;",
  a: "color:#385b83;overflow-wrap:anywhere;",
  code: "background:#f3f1ed;font-size:.9em;overflow-wrap:anywhere;"
};

const digest = (content: string | Buffer) => createHash("sha256").update(content).digest("hex");

function inputFields(source: string) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match?.[2]?.trim()) throw new Error("公众号稿件需要 front matter 和正文");
  const entries = new Map<string, string>();
  for (const line of (match[1] ?? "").split("\n")) {
    const m = /^([a-zA-Z]+):[ \t]*(.*?)\s*$/.exec(line);
    if (!m?.[1] || m[2] === undefined || !["title", "author", "digest", "cover"].includes(m[1])) continue;
    if (entries.has(m[1])) throw new Error(`公众号稿件字段重复：${m[1]}`);
    entries.set(m[1], m[2].replace(/^(["'])(.*)\1$/, "$2"));
  }
  const title = entries.get("title");
  const summary = entries.get("digest");
  const cover = entries.get("cover");
  if (!title || !summary || !cover) throw new Error("公众号稿件需要 title、digest 和 cover");
  if (Buffer.byteLength(title, "utf8") > 64) throw new Error("公众号标题超过 64 字节");
  return { title, author: entries.get("author") ?? "", summary, cover, body: match[2] };
}

function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  throw new Error("公众号图片需为 PNG、JPEG、GIF 或 WebP");
}

export async function buildWechatPreview(inputPath: string, outputDir: string): Promise<void> {
  const source = await readFile(inputPath, "utf8");
  const fields = inputFields(source);
  const base = await realpath(path.dirname(inputPath));
  const assets = new Map<string, { file: string; sha256: string; bytes: Buffer }>();
  async function asset(src: string): Promise<string> {
    if (!src || path.isAbsolute(src) || /^[a-z][a-z0-9+.-]*:/i.test(src) || /[?#\\]/.test(src)) {
      throw new Error("公众号图片必须使用稿件目录内的本地相对路径");
    }
    const file = await realpath(path.resolve(base, decodeURIComponent(src)));
    const relative = path.relative(base, file);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("公众号图片不能离开稿件目录");
    }
    const bytes = await readFile(file);
    const sha256 = digest(bytes);
    const name = `media/${sha256}.${imageType(bytes)}`;
    assets.set(name, { file: name, sha256, bytes });
    return name;
  }

  const cover = await asset(fields.cover);
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const tokens = md.parse(fields.body, {});
  if (tokens.some(token => token.type === "table_open")) throw new Error("公众号首版不支持表格，请改用列表");
  const imageTokens = tokens.flatMap(token => token.children ?? []).filter(token => token.type === "image");
  const contentMedia: string[] = [];
  for (const token of imageTokens) {
    const src = await asset(String(token.attrGet("src") ?? ""));
    token.attrSet("src", src);
    token.attrSet("style", figure);
    contentMedia.push(src);
  }
  for (const token of tokens.flatMap(token => [token, ...(token.children ?? [])])) {
    if (token.type === "link_open") {
      const href = String(token.attrGet("href") ?? "");
      if (!/^https?:\/\//i.test(href)) throw new Error("公众号正文链接需要完整的 HTTP(S) 地址");
    }
    const style = styles[token.tag];
    if (style && token.nesting === 1) token.attrSet("style", style);
  }
  md.renderer.rules.code_inline = (items, index) => `<code style="${styles.code}">${escapeHtml(items[index]?.content ?? "")}</code>`;
  const codeBlock = (text: string) =>
    `<pre style="margin:14px 0;padding:12px;background:#f3f1ed;white-space:pre-wrap;overflow-wrap:anywhere;"><code>${escapeHtml(text)}</code></pre>\n`;
  md.renderer.rules.fence = (items, index) => codeBlock(items[index]?.content ?? "");
  md.renderer.rules.code_block = (items, index) => codeBlock(items[index]?.content ?? "");
  const body = `<section style="font-size:16px;line-height:1.85;color:#25231f;overflow-wrap:anywhere;">\n${md.renderer.render(tokens, md.options, {})}</section>\n`;
  const manifest = {
    format, title: fields.title, author: fields.author, digest: fields.summary,
    cover, content: "article.html", contentSha256: digest(body), contentMedia,
    assets: [...assets.values()].map(({ file, sha256 }) => ({ file, sha256 })),
    validation: "local-preview-only"
  };
  const preview = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fields.title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f0ea;color:#25231f;font:16px/1.65 system-ui,sans-serif}
main{max-width:520px;margin:auto;padding:16px}aside,article{background:#fff;padding:16px;margin:0 0 18px;border-radius:10px;overflow-wrap:anywhere}
aside img{display:block;width:100%;aspect-ratio:900/383;object-fit:cover;margin:8px 0}
header p,aside p{margin:4px 0;color:#685b4d;font-size:14px}h1{font-size:25px;line-height:1.35;margin:0 0 8px}article header{margin-bottom:22px}
</style></head><body><main>
<aside aria-label="订阅消息卡片"><p>订阅消息卡片 · 本地模拟</p><img src="${cover}" alt="封面">
<strong>${escapeHtml(fields.title)}</strong><p>${escapeHtml(fields.summary)}</p></aside>
<article><header><p>正文 · 尚未在微信内验收</p><h1>${escapeHtml(fields.title)}</h1><p>${escapeHtml(fields.author)}</p></header>
<!-- facet:article:start -->
${body}<!-- facet:article:end -->
</article></main></body></html>\n`;

  await mkdir(path.dirname(outputDir), { recursive: true });
  try {
    await mkdir(outputDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("公众号导出目录已存在，请指定新目录，保留已核版本");
    throw error;
  }
  await mkdir(path.join(outputDir, "media"));
  await Promise.all([...assets.values()].map(({ file, bytes }) => writeFile(path.join(outputDir, file), bytes, { flag: "wx" })));
  await writeFile(path.join(outputDir, "article.html"), body, { flag: "wx" });
  await writeFile(path.join(outputDir, "preview.html"), preview, { flag: "wx" });
  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
}
