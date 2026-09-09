#!/usr/bin/env node
/**
 * 把 JPEG/PNG 转成真正的多尺寸 ICO 文件。
 * 不依赖 sharp/canvas，纯 Node Buffer 实现。
 *
 * 为什么需要这个：
 * - 直接把头像复制成 favicon.ico 是"假 ICO"（文件是 JPEG），
 *   Chrome/Safari 严格校验会忽略。
 * - 多尺寸（16+32+48）打包进同一个 ICO 是 Windows 资源管理器、
 *   旧浏览器和高 DPI 屏幕的兼容保证。
 *
 * 用法：node scripts/make-favicon.mjs <输入图片> <输出 ICO>
 */
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");

const [, , inputPathArg, outputPathArg] = process.argv;
if (!inputPathArg || !outputPathArg) {
  console.error("用法: node scripts/make-favicon.mjs <input.jpg> <output.ico>");
  process.exit(1);
}

const inputPath = inputPathArg.startsWith("/") ? inputPathArg : join(projectRoot, inputPathArg);
const outputPath = outputPathArg.startsWith("/") ? outputPathArg : join(projectRoot, outputPathArg);

// macOS 自带 sips：把头像转成多个尺寸的 PNG
const SIZES = [16, 32, 48];
const tmpDir = tmpdir();

async function resizeTo(size) {
  const out = join(tmpDir, `favicon-${size}.png`);
  await run("sips", ["-z", String(size), String(size), inputPath, "--out", out]);
  return out;
}

const pngPaths = await Promise.all(SIZES.map(resizeTo));
const pngBuffers = await Promise.all(pngPaths.map((p) => readFile(p)));

// 构造 ICO 文件
// ICO header: 6 bytes
//   - Reserved: 2 bytes (0)
//   - Type: 2 bytes (1 = ICO)
//   - Count: 2 bytes (N)
// ICONDIRENTRY: 16 bytes per image
//   - Width: 1 byte (0 means 256)
//   - Height: 1 byte
//   - ColorCount: 1 byte (0 for >= 256 colors)
//   - Reserved: 1 byte
//   - Planes: 2 bytes
//   - BitCount: 2 bytes
//   - SizeInBytes: 4 bytes
//   - Offset: 4 bytes

const count = pngBuffers.length;
const headerSize = 6 + 16 * count;
const offsets = [];
let offset = headerSize;
for (const buf of pngBuffers) {
  offsets.push(offset);
  offset += buf.length;
}

const ico = Buffer.alloc(headerSize);
let p = 0;
// ICONDIR
ico.writeUInt16LE(0, p); p += 2; // reserved
ico.writeUInt16LE(1, p); p += 2; // type 1 = icon
ico.writeUInt16LE(count, p); p += 2; // image count

// ICONDIRENTRY
for (let i = 0; i < count; i++) {
  const size = SIZES[i];
  const buf = pngBuffers[i];
  ico.writeUInt8(size === 256 ? 0 : size, p); p += 1; // width
  ico.writeUInt8(size === 256 ? 0 : size, p); p += 1; // height
  ico.writeUInt8(0, p); p += 1; // color count
  ico.writeUInt8(0, p); p += 1; // reserved
  ico.writeUInt16LE(1, p); p += 2; // planes
  ico.writeUInt16LE(32, p); p += 2; // bit count
  ico.writeUInt32LE(buf.length, p); p += 4; // size in bytes
  ico.writeUInt32LE(offsets[i], p); p += 4; // offset
}

const final = Buffer.concat([ico, ...pngBuffers]);
await writeFile(outputPath, final);

console.log(`✅ ICO written: ${outputPath}`);
console.log(`   ${count} sizes: ${SIZES.map((s) => `${s}x${s}`).join(", ")}`);
console.log(`   total bytes: ${final.length}`);