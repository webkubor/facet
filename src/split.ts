/**
 * split 子命令：分析 markdown，自动插入 `<!-- break -->` 标记。
 *
 * 设计动机：talk 演讲版的分屏节奏由 facet 算法+作者手动标记共同决定。
 * 但"在哪里分屏"是节奏问题，不是技术问题——作者/上游 AI 比算法更懂。
 * 规则式启发式做 MVP，能给 80% 文章一个"差不多"的分屏；未来可接 LLM 优化。
 *
 * 算法：
 * 1. 按 ## 切章节
 * 2. 章节内按空行切段落，识别代码块 / 表格等"焦点"段
 * 3. 贪心装入"屏预算"：每屏目标 250 字，上限 380 字
 *    - 累计超过上限 → 在新段前插 break
 *    - 累计已达目标且新段不是引子 → 也在新段前插 break
 *    - 焦点段（代码/表格）→ 强制独占屏（在段前插 break）
 *
 * 默认参数：target=250 max=380（屏内字符数），可通过 CLI 覆盖。
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TARGET = 250;
const DEFAULT_MAX = 380;

interface Paragraph {
  startLine: number; // 含（0-based，行号指向 markdown 源文件）
  endLine: number; // 不含
  chars: number;
  isFocal: boolean; // 包含代码块 / 表格，需要独占屏
}

interface Chapter {
  start: number;
  end: number;
}

/** 按 ## 切章节。 */
function splitChapters(lines: string[]): Chapter[] {
  const chapters: Chapter[] = [];
  let i = 0;
  while (i < lines.length) {
    if (/^##\s+/.test(lines[i])) {
      const start = i;
      i++;
      while (i < lines.length && !/^##\s+/.test(lines[i])) i++;
      chapters.push({ start, end: i });
    } else {
      i++;
    }
  }
  return chapters;
}

/** 章节内切段落，识别代码块围栏。baseLine 是章节起始行号（0-based）。 */
function splitParagraphs(chapterLines: string[], baseLine: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let pStart = 0;
  let pChars = 0;
  let inFence = false;
  let fenceWasOpened = false;

  for (let i = 0; i < chapterLines.length; i++) {
    const line = chapterLines[i];

    if (/^\s*(```|~~~)/.test(line)) {
      if (inFence) {
        // 代码块结束
        if (fenceWasOpened) {
          paragraphs.push({
            startLine: baseLine + pStart,
            endLine: baseLine + i + 1,
            chars: pChars,
            isFocal: true,
          });
        }
        pStart = i + 1;
        pChars = 0;
        inFence = false;
        fenceWasOpened = false;
      } else {
        // 代码块开始：先 flush 当前段
        if (pChars > 0) {
          paragraphs.push({
            startLine: baseLine + pStart,
            endLine: baseLine + i,
            chars: pChars,
            isFocal: false,
          });
        }
        pStart = i;
        pChars = line.length;
        inFence = true;
        fenceWasOpened = true;
      }
      continue;
    }

    if (inFence) {
      pChars += line.length + 1;
      continue;
    }

    if (line.trim() === "") {
      if (pChars > 0) {
        paragraphs.push({
          startLine: baseLine + pStart,
          endLine: baseLine + i,
          chars: pChars,
          isFocal: false,
        });
        pStart = i + 1;
        pChars = 0;
      }
      continue;
    }

    pChars += line.length + 1;
  }

  if (pChars > 0) {
    paragraphs.push({
      startLine: baseLine + pStart,
      endLine: baseLine + chapterLines.length,
      chars: pChars,
      isFocal: false,
    });
  }

  return paragraphs;
}

/**
 * 主分析函数：返回应插入 `<!-- break -->` 的行号列表。
 * 行的行号指向"在这一行前插 break"。
 */
export function analyzeSplitBreaks(
  markdown: string,
  target = DEFAULT_TARGET,
  max = DEFAULT_MAX
): number[] {
  const lines = markdown.split("\n");
  const chapters = splitChapters(lines);
  const breakLines: number[] = [];

  for (const chapter of chapters) {
    // 跳过 ## 标题行本身
    const chapterLines = lines.slice(chapter.start + 1, chapter.end);
    const paragraphs = splitParagraphs(chapterLines, chapter.start + 1);

    let curChars = 0;
    for (const para of paragraphs) {
      if (para.isFocal) {
        // 焦点段独占屏：在段前插 break
        if (curChars > 0) breakLines.push(para.startLine);
        curChars = para.chars;
        continue;
      }
      if (curChars > 0 && curChars + para.chars > max) {
        // 当前段会让屏爆
        breakLines.push(para.startLine);
        curChars = para.chars;
      } else if (curChars >= target && para.chars > 80) {
        // 已达目标字数且新段不是引子
        breakLines.push(para.startLine);
        curChars = para.chars;
      } else {
        curChars += para.chars;
      }
    }
  }

  return breakLines;
}

/** 在指定行号前插入 `<!-- break -->`。从后往前插避免行号偏移。 */
export function applyBreaks(markdown: string, breakLines: number[]): string {
  const lines = markdown.split("\n");
  for (const line of [...breakLines].sort((a, b) => b - a)) {
    lines.splice(line, 0, "<!-- break -->");
  }
  return lines.join("\n");
}

export interface SplitResult {
  markdown: string;
  breakCount: number;
  breakLines: number[];
}

/** split 主入口。 */
export function runSplit(input: {
  markdown: string;
  target?: number;
  max?: number;
}): SplitResult {
  const target = input.target ?? DEFAULT_TARGET;
  const max = input.max ?? DEFAULT_MAX;
  const breakLines = analyzeSplitBreaks(input.markdown, target, max);
  const markdown = applyBreaks(input.markdown, breakLines);
  return { markdown, breakCount: breakLines.length, breakLines };
}

/** 文件级别入口：读 markdown 写新文件。 */
export async function splitFile(input: {
  inputPath: string;
  outputPath: string;
  target?: number;
  max?: number;
}): Promise<SplitResult> {
  const source = await readFile(input.inputPath, "utf8");
  const result = runSplit({ markdown: source, target: input.target, max: input.max });
  await writeFile(input.outputPath, result.markdown, "utf8");
  return result;
}