# X

## 主推（单条）

Most md-to-pdf tools just print a webpage. knowledge-pdf-kit plans the layout first: a template-independent content flow (cover → TOC → learning map → lessons → review), then applies one of 8 visual themes.

One command → A4 PDF + a vertical share image.

MIT, TypeScript + Playwright.
https://github.com/webkubor/knowledge-pdf-kit

（配图：warm-handbook 与 morandi-sage 两张长图对比）

## 可选短 thread

1/ The problem: export Markdown to PDF and short sections each hog a full page, backgrounds break across pages, and you still need a separate long image for social.

2/ The fix: plan content before styling. It emits a page-plan.json — every page's role, sections, and density budget (min 760 / max 1500). Short sections get merged automatically.

3/ Then pick a theme: 8 built-in templates, and a --theme flag that injects your palette as CSS variables without touching the flow.

4/ MIT licensed. pnpm install && pnpm build:all → PDF + share image + page plan. https://github.com/webkubor/knowledge-pdf-kit
