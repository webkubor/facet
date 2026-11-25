import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = await mkdtemp(path.join(tmpdir(), "facet-wechat-test-"));
const input = path.join(dir, "issue.md");
const output = path.join(dir, "preview");
const cli = fileURLToPath(new URL("../src/build.ts", import.meta.url));
const cliArgs = process.env.FACET_WECHAT_TEST_DIST ? [fileURLToPath(new URL("../dist/build.js", import.meta.url))] : ["--import", "tsx", cli];
const hash = (s) => createHash("sha256").update(s).digest("hex");
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAIAAAD4YuoOAAAAJ0lEQVR4nGOsSHBnoCVgoqnpDKMWEAFG44AgGA0igmA0iAiCoR9EADFcAT+u5ejUAAAAAElFTkSuQmCC", "base64");
const md = (body) => `---\ntitle: "第二天九点，报表到了吗？"\nauthor: 示例作者\ndigest: 公众号卡片摘要\ncover: cover.png\n---\n\n${body}\n`;
function run(input, target, ...args) {
  return spawnSync(process.execPath, [...cliArgs, "--input", input, "--wechat-preview", "--output", target, ...args], { encoding: "utf8" });
}
try {
  await writeFile(path.join(dir, "cover.png"), pixel);
  await writeFile(input, md("第一段 **重点**。\n\n## 小标题\n\n> 引用\n\n- 条目\n\n![图](cover.png)\n\n![图二](cover.png)\n\n<script>alert(1)</script>"));
  const first = run(input, output);
  assert.equal(first.status, 0, first.stderr);
  const body = await readFile(path.join(output, "article.html"), "utf8");
  const preview = await readFile(path.join(output, "preview.html"), "utf8");
  const manifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
  assert.equal(preview.split("<!-- facet:article:start -->\n")[1]?.split("<!-- facet:article:end -->")[0], body);
  assert.equal(manifest.contentSha256, hash(body));
  assert.equal(manifest.validation, "local-preview-only");
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.contentMedia.length, 2);
  assert.equal(manifest.cover, manifest.contentMedia[0]);
  assert.equal(hash(await readFile(path.join(output, manifest.cover))), manifest.assets[0].sha256);
  if (process.env.FACET_WECHAT_VISUAL) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch(process.env.FACET_TEST_CHROME ? { channel: "chrome" } : {});
    try {
      for (const width of [360, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 844 } });
        await page.goto(pathToFileURL(path.join(output, "preview.html")).href);
        const layout = await page.evaluate(() => ({
          fits: document.documentElement.scrollWidth <= innerWidth,
          images: [...document.images].map(image => image.naturalWidth),
          card: !!document.querySelector("aside"),
          body: !!document.querySelector("article section")
        }));
        assert.deepEqual(layout, { fits: true, images: [32, 32, 32], card: true, body: true });
        await page.close();
      }
      console.log("公众号浏览器：360／390px 卡片和正文均可读，图片载入，无横向溢出");
    } finally {
      await browser.close();
    }
  }
  assert.match(body, /<strong>重点<\/strong>/);
  assert.match(body, /<h2 style=/);
  assert.doesNotMatch(body, /<script|<style|<aside/);
  assert.match(run(input, output).stderr, /目录已存在/);
  assert.match(run(input, path.join(dir, "conflict"), "--read").stderr, /不能与其它/);
  await writeFile(input, md("![远端图](https://example.com/p.png)"));
  assert.match(run(input, path.join(dir, "remote")).stderr, /本地相对路径/);
  await writeFile(input, md("![缺图](missing.png)"));
  assert.match(run(input, path.join(dir, "missing")).stderr, /找不到文件/);
  console.log("公众号 CLI：同稿字节、素材校验、样式隔离、缺图、外链图和防覆盖均通过");
} finally {
  await rm(dir, { recursive: true, force: true });
}
