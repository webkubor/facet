# Hacker News

## Title (Show HN, factual)

Show HN: Knowledge PDF Kit – Markdown to PDF that plans page layout before styling

## URL

https://github.com/webkubor/knowledge-pdf-kit

## First comment (builder context)

I make tutorial PDFs for Chinese social platforms (Xiaohongshu/WeChat), and every md-to-pdf tool I tried is essentially "print a webpage": short sections each occupy a full page, full-bleed backgrounds break after page one, and you still need a separate tall image for social sharing.

So this tool splits the problem in two:

1. A template-independent "content flow" pass that plans pages first — cover, TOC, learning map, lesson pages, review — and merges short sections by a density budget. It emits a page-plan.json so you can inspect what landed on each page.

2. A visual pass: 8 CSS templates rendered via Playwright, plus a --theme flag that overrides CSS variables (brand colors etc.) without touching the flow.

Output is an A4 PDF plus a vertical long image for social. TypeScript, markdown-it, MIT.

Happy to answer questions about the pagination heuristics — the density-based section merging was the fiddly part.
