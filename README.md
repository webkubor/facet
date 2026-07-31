<p align="center">
  <img src="docs/brand/icon.svg" width="96" height="96" alt="Knowledge PDF Kit icon" />
</p>

<h1 align="center">Knowledge PDF Kit</h1>

<p align="center">
  把 Markdown 知识教程生成漂亮、稳定、可分享的 PDF 和长图。
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.0-111827.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg?logo=typescript&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-PDF-2eAD33.svg?logo=playwright&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11-f69220.svg?logo=pnpm&logoColor=white" />
  <img alt="Output" src="https://img.shields.io/badge/output-PDF%20%2B%20long%20image-f59e0b.svg" />
</p>

<p align="center">
  <img alt="Codex" src="https://img.shields.io/badge/Codex-ready-111827.svg?logo=openai&logoColor=white" />
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-ready-d97706.svg" />
  <img alt="Cursor" src="https://img.shields.io/badge/Cursor-ready-000000.svg" />
  <img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini%20CLI-ready-4285f4.svg?logo=googlegemini&logoColor=white" />
  <img alt="OpenCode" src="https://img.shields.io/badge/OpenCode-ready-0f766e.svg" />
</p>

Knowledge PDF Kit 面向小红书、公众号、社群课程和知识付费资料。它不是简单把网页打印成 PDF，而是先做模板无关的 `content flow`，再套用视觉主题，保证每一页的知识密度、页眉页脚、背景铺满和分享图效果都可控。

## 标签

`markdown-to-pdf` `html-to-pdf` `knowledge-pdf` `tutorial-pdf` `wechat` `xiaohongshu` `long-image` `playwright` `typescript` `agent-ready`

## 30 秒上手

```bash
pnpm install
pnpm build:all
```

生成结果：

```text
output/example-warm-handbook.pdf
output/example-warm-handbook.share.png
output/example-page-plan.json
```

只生成单套模板：

```bash
pnpm build -- --input content/example.md --template wechat-magazine --output output/tutorial.pdf
```

关闭长图：

```bash
pnpm build -- --input content/example.md --template warm-handbook --no-share
```

## 核心能力

- Markdown -> HTML/CSS -> Playwright PDF，全链路本地生成。
- 先规划内容 flow，再渲染视觉模板，避免短内容单独占满一整页。
- 自动生成长图分享产物 `*.share.png`，适合小红书、公众号素材分发。
- 支持自定义 PDF 内页页眉页脚，以及长图外层标题和尾注。
- 输出 `page-plan.json`，可检查每页承载哪些知识点。
- 内置四套知识教程模板，风格可换，分页逻辑复用。

## 支持的 Agent

Knowledge PDF Kit 对 Agent 的要求很低：能编辑 Markdown、运行 shell 命令、查看生成图即可。仓库里的 content flow、page plan 和模板目录都是为了让 Agent 稳定复用。

| Agent | 支持状态 | 推荐用法 |
| --- | --- | --- |
| <img src="https://img.shields.io/badge/Codex-ready-111827.svg?logo=openai&logoColor=white" alt="Codex" /> | 完整支持 | 生成教程内容、调整模板、渲染并检查 PDF。 |
| <img src="https://img.shields.io/badge/Claude%20Code-ready-d97706.svg" alt="Claude Code" /> | 完整支持 | 编写长文教程、维护 README、批量调整样式。 |
| <img src="https://img.shields.io/badge/Cursor-ready-000000.svg" alt="Cursor" /> | 完整支持 | 本地编辑 Markdown 和 CSS，快速预览输出。 |
| <img src="https://img.shields.io/badge/Gemini%20CLI-ready-4285f4.svg?logo=googlegemini&logoColor=white" alt="Gemini CLI" /> | 完整支持 | 长上下文内容规划、批量教程整理。 |
| <img src="https://img.shields.io/badge/OpenCode-ready-0f766e.svg" alt="OpenCode" /> | 完整支持 | CLI 工作流生成 PDF 和分享长图。 |

## 模板预览

| Warm Handbook | WeChat Magazine |
| --- | --- |
| ![Warm Handbook](docs/designs/warm-handbook.png) | ![WeChat Magazine](docs/designs/wechat-magazine.png) |

| Creator Notebook | Course Workbook |
| --- | --- |
| ![Creator Notebook](docs/designs/creator-notebook.png) | ![Course Workbook](docs/designs/course-workbook.png) |

## 可用模板

- `warm-handbook`：温暖手册风，适合入门教程、AI 知识普及、轻松但结构清晰的内容。
- `wechat-magazine`：公众号知识库风，适合系列文章、方法论拆解、品牌化知识内容。
- `creator-notebook`：小红书收藏笔记风，适合提示词、AI 学习、内容创作流程。
- `course-workbook`：轻课程工作簿风，适合付费社群、系统课、行动清单和练习型内容。

## Content Flow

知识教程 PDF 不把 Markdown 直接排成连续网页，而是先规划阅读阶段：

1. 封面：明确主题和收益。
2. 目录：展示知识结构。
3. 学习地图：把导言、阅读路径、本册知识点放在同一页。
4. 正文页：按二级标题切出知识点，再按内容密度合并成页面。
5. 回顾页：用重点回顾和行动清单收束。

构建时会输出：

```text
output/<input-name>-page-plan.json
```

这份计划用于检查每页的角色、知识点和估算密度。视觉模板只能改变样式，不能跳过这条 flow。

## 内容配置

Markdown 顶部支持 front matter：

```md
---
title: "AI 知识教程：从看懂到用起来"
subtitle: "面向小红书与公众号读者的可收藏学习手册"
date: "2026-07-31"
author: "Codex"
pageHeader: "AI Knowledge PDF"
pageFooter: "从看懂到用起来"
shareHeader: "AI 知识教程：从看懂到用起来"
shareFooter: "适合收藏，适合转发，也适合复习。"
---
```

配置说明：

- `title` / `subtitle`：封面、长图标题和默认元信息。
- `pageHeader`：PDF 正文页页眉左侧文案。
- `pageFooter`：PDF 正文页页脚左侧文案。
- `shareHeader`：长图顶部标题。
- `shareFooter`：长图底部提示语。

正文使用普通 Markdown。建议用 `##` 划分章节，`###` 划分小节。

## 输出产物

```text
output/tutorial.pdf        # A4 PDF
output/tutorial.html       # 可检查的中间 HTML
output/tutorial.share.png  # 自动长图分享图
output/example-page-plan.json
```

## PDF UI 硬约束

- `@page` 必须保持 `margin: 0`，否则非首页背景无法铺满整张纸。
- 每个真实页面容器必须使用统一页距变量：`--page-pad-top/right/bottom/left`。
- 正文不能用一个长 `article` 自然跨页，必须分组成 `.lesson-page` 页面容器。
- `.lesson-page` 不能简单按每个二级标题一页硬切，短章节要合并。
- 短导言不能独立成正文页，必须进入“学习地图”或和知识点合并。
- 新模板只能改视觉 token 和组件表现，不能改 content flow 的页面角色。
- 验收至少渲染并检查：封面、目录、学习地图、一个正文续页、最后一页。

## 项目结构

```text
content/                 # Markdown 教程
docs/designs/            # README 模板预览图
src/build.ts             # 构建器入口
templates/base/          # 通用页面结构和 PDF 规则
templates/*/print.css    # 视觉主题
output/                  # 构建产物
```

## 开发命令

```bash
pnpm check
pnpm build:example
pnpm build:all
```
