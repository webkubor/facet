// 本地预览 talk 演讲页：node scripts/serve-talk.mjs [端口] [文件名]
// 默认服务 output 目录并打开 ai-readable-kit.talk.html。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.argv[2]) || 4173;
const fileArg = process.argv[3] || "ai-readable-kit.talk.html";
const root = join(projectRoot, "output");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let filePath = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (url.pathname === "/") filePath = join(root, fileArg);
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404).end("Not Found");
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mime[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(500).end("Internal Server Error");
  }
});

server.listen(port, () => {
  const url = `http://localhost:${port}/`;
  console.log(`Talk preview: ${url}  (serving ${root})`);
  console.log("Ctrl+C 停止");
});