<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/mark-v3-dark.svg"><img src="https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/mark-v3.svg" width="96" height="96" alt="Facet icon" /></picture>
</p>

<h1 align="center">Facet</h1>

<p align="center">
  Generate beautiful, stable, shareable PDFs and long images from Markdown knowledge tutorials and project-style resumes.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e.svg" /></a>
  <a href="CHANGELOG.md"><img alt="Changelog" src="https://img.shields.io/badge/changelog-keep%20a%20changelog-2f6f4e.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.4.1-111827.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg?logo=typescript&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-PDF-2eAD33.svg?logo=playwright&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11-f69220.svg?logo=pnpm&logoColor=white" />
  <img alt="Output" src="https://img.shields.io/badge/output-PDF%20%2B%20long%20image-f59e0b.svg" />
  <a href="https://github.com/webkubor/facet/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/webkubor/facet/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://share.webkubor.online/"><img alt="Live Demo" src="https://img.shields.io/badge/demo-share.webkubor.online-0f766e.svg?logo=cloudflarepages&logoColor=white" /></a>
</p>

<p align="center">
  <img alt="Codex" src="https://img.shields.io/badge/Codex-ready-111827.svg?logo=openai&logoColor=white" />
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-ready-d97706.svg" />
  <img alt="Cursor" src="https://img.shields.io/badge/Cursor-ready-000000.svg" />
  <img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini%20CLI-ready-4285f4.svg?logo=googlegemini&logoColor=white" />
  <img alt="OpenCode" src="https://img.shields.io/badge/OpenCode-ready-0f766e.svg" />
</p>

Facet targets Xiaohongshu (Little Red Book), WeChat Official Accounts, community courses, knowledge-payment materials, and project-style technical resumes. It doesn't just print a webpage to PDF — it first does template-agnostic `content flow` planning, then applies a visual theme, so every page's knowledge density, header/footer, full-bleed background, and share-image effect stay under control.

## Live Demo

[share.webkubor.online](https://share.webkubor.online/) is rendered by facet for real — each piece of content has both a **read** view (continuous long-form) and a **talk** view (one section per screen); colors are theme-driven.

> **Content and site are not in this repo** (split on 2026-09-16): this repo is a **pure tool** (CLI + templates + themes). Articles, encrypted delivery, and site build/deploy all live in the **private repo** at `~/dev/ip/blog` under `share/`, which consumes this repo via a git dependency (`facet@github:webkubor/facet`) and deploys from there with `pnpm pages:deploy`. The split is deliberate: the content can include encrypted customer documents (which should never enter a public repo), while the tool itself is MIT-licensed open source.

## Tags

`markdown-to-pdf` `html-to-pdf` `knowledge-pdf` `tutorial-pdf` `resume-pdf` `cv-template` `wechat` `xiaohongshu` `long-image` `morandi` `editorial-design` `playwright` `typescript` `agent-ready`

## One-liner (no clone needed)

Run straight from the npm registry (next step — once `npm publish` lands; the CLI entry and `files` whitelist are already in place, publish-only):

```bash
npx facet --input mypost.md --template wechat-magazine --output mypost.pdf
npx facet --input mypost.md --all                       # generate all 8 tutorial templates at once
npx facet --input resume.md --template resume-payment-lead --output resume.pdf
```

The first run downloads ~150 MB of browser binaries, then caches. Without `--output`, the PDF/HTML/long-image/page-plan all land in **the current directory** (`./` and `./output/`), never polluting the package directory.

> Until npm publish is done, use the developer path below; the CLI entry and asset files are already wired up — publish is just `pnpm publish`.

## 30-second start (developer path)

Use this when iterating templates or adding new ones inside the repo:

```bash
pnpm install
pnpm setup:browsers
pnpm build:all
```

Outputs:

```text
output/example-warm-handbook.pdf
output/example-warm-handbook.share.png
output/example-page-plan.json
```

Single template only:

```bash
pnpm build -- --input content/example.md --template wechat-magazine --output output/tutorial.pdf
```

Disable long-image:

```bash
pnpm build -- --input content/example.md --template warm-handbook --no-share
```

Apply a user color preference:

```bash
pnpm build -- --input content/example.md --template research-dossier --theme themes/morandi-sage.json
```

Generate a project-style resume:

```bash
pnpm build:resume
pnpm build:resume:all
```

Generate the talk deck (presentation-oriented, for live explanation):

```bash
pnpm build:talk
# opens output/ai-readable-kit.talk.html — ← → to flip, number keys to jump, F for fullscreen
```

## Two output orientations: show vs share

The same Markdown produces two orientations, each with its own concern:

| Orientation | Output | Form | Use |
| --- | --- | --- | --- |
| **show** | `*.talk.html` | Talk deck (`--talk`) | One section per screen, large type, keyboard navigation, fullscreen — for live explanation |
| **share** | `*.pdf` + `*.share.png` | A4 PDF + long image | Archiving, printing, Xiaohongshu / WeChat distribution |

While presenting, open `talk.html` (aesthetic shares a source with PDF; `--theme` overrides the same color set). After the talk, ship the PDF and long image — write the content once.

## Core capabilities

- Markdown → HTML/CSS → Playwright PDF, fully local.
- Plan content flow first, then render the visual template — avoids short content getting its own full page.
- Auto-generates the share long-image `*.share.png` for Xiaohongshu / WeChat distribution.
- Custom headers and footers on PDF interior pages, plus outer title and endnote on long images.
- Inject user color preferences before render to dynamically override template CSS variables.
- `--talk` talk deck: the same Markdown output as "one section per screen" talk HTML, keyboard navigation, fullscreen-capable (show-oriented); PDF/long image stay distribution-oriented (share-oriented).
- Optional `talkTitle` on talk cover: a 2-line-or-shorter title replaces the full article title; the long title stays in PDF / read versions.
- Outputs `page-plan.json` for inspecting which knowledge points each page carries.
- 8 built-in knowledge tutorial templates and 6 resume templates; resumes vary density by role family: tech = high density, ops = medium, visual = low.
- Resume validation thresholds switch by role family — never uses tech-role density to judge design-role whitespace.

## Supported agents

Facet's bar for agents is low: edit Markdown, run shell, look at the rendered image. The repo's content flow, page plan, and template directory exist precisely so agents can reuse it stably.

| Agent | Status | Recommended use |
| --- | --- | --- |
| <img src="https://img.shields.io/badge/Codex-ready-111827.svg?logo=openai&logoColor=white" alt="Codex" /> | Full support | Generate tutorial content, adjust templates, render and verify PDFs |
| <img src="https://img.shields.io/badge/Claude%20Code-ready-d97706.svg" alt="Claude Code" /> | Full support | Write long-form tutorials, maintain README, batch-adjust styles |
| <img src="https://img.shields.io/badge/Cursor-ready-000000.svg" alt="Cursor" /> | Full support | Local Markdown and CSS editing, fast preview rendering |
| <img src="https://img.shields.io/badge/Gemini%20CLI-ready-4285f4.svg?logo=googlegemini&logoColor=white" alt="Gemini CLI" /> | Full support | Long-context content planning, batch tutorial curation |
| <img src="https://img.shields.io/badge/OpenCode-ready-0f766e.svg" alt="OpenCode" /> | Full support | CLI workflow for PDF and share long-image generation |

## Tutorial template previews

These are cover previews of the 8 tutorial templates, to help you quickly gauge visual direction. Covers only show the aesthetic — every tutorial template actually reuses the same `content flow`: cover, table of contents, learning map, body, recap page, and long-image share all share the same content organization logic.

| Warm Handbook | WeChat Magazine |
| --- | --- |
| ![Warm Handbook](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/warm-handbook.webp) | ![WeChat Magazine](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/wechat-magazine.webp) |

| Creator Notebook | Course Workbook |
| --- | --- |
| ![Creator Notebook](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/creator-notebook.webp) | ![Course Workbook](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/course-workbook.webp) |

| Editorial Poster | Research Dossier |
| --- | --- |
| ![Editorial Poster](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/editorial-poster.webp) | ![Research Dossier](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/research-dossier.webp) |

| Gallery Catalog | Strategy Brief |
| --- | --- |
| ![Gallery Catalog](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/gallery-catalog.webp) | ![Strategy Brief](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/strategy-brief.webp) |

## Resume template previews

The six resume templates reuse one resume flow, but **swap the skeleton and density by role family** — not just color:

- **Tech** (`stacked`): single-column high density, identity → 4-column focus cards → content cards. Single-page information density first.
- **Ops** (`metrics-band`): full-width KPI band sits at the top, numbers scaled up large — data before narrative.
- **Visual** (`sidebar`): left 64 mm narrow column enlarges the avatar and vertical profile, right wide column holds content; cards are borderless with generous whitespace.

Whitespace, type scale, strong-text minimums, avatar size thresholds also shift per family. Source of truth in [`templates/resume-families.json`](templates/resume-families.json).

The example content uses this repo maintainer **Lunove**'s agent resume — same flow works for humans and agents, no real personal data.

| Payment Lead | Global Checkout |
| --- | --- |
| ![Payment Lead](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/resume-payment-lead.webp) | ![Global Checkout](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/resume-global-checkout.webp) |

| AI Platform | Infra Builder |
| --- | --- |
| ![AI Platform](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/resume-ai-platform.webp) | ![Infra Builder](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/resume-infra-builder.webp) |

| Growth Ops | Design Folio |
| --- | --- |
| ![Growth Ops](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/resume-growth-ops.webp) | ![Design Folio](https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/resume-design-folio.webp) |

## Available templates

- `warm-handbook` — warm handbook style, for beginner tutorials, AI literacy, light but clearly structured content
- `wechat-magazine` — WeChat Official Account knowledge-base style, for series articles, methodology breakdowns, branded knowledge content
- `creator-notebook` — Xiaohongshu saved-notes style, for prompts, AI learning, content creation workflows
- `course-workbook` — light course workbook style, for paid communities, system courses, action checklists, exercise-driven content
- `editorial-poster` — print editorial poster style, for open-source project intros, knowledge-product promo, visually-driven tutorials
- `research-dossier` — Morandi cool-grey-blue research-dossier style, for research reports, whitepapers, industry analysis, methodology material
- `gallery-catalog` — Morandi gallery-catalog style, for design cases, portfolio descriptions, brand content, aesthetic knowledge materials
- `strategy-brief` — Morandi business strategy-brief style, for consulting reports, business reviews, growth strategy, team-consensus documents
- `resume-payment-lead` — cross-border payment lead style, for payment middleware, merchant back-office, multi-role systems, long-running business lines
- `resume-global-checkout` — multi-country checkout site-group style, for internationalization, local payments, H5 site groups, channel delivery
- `resume-ai-platform` — AI platform lead style, for model platforms, developer experience, AI productization, complex consoles
- `resume-infra-builder` — front-end infrastructure builder style, for CLI, SDK, design tokens, engineering, platform tooling
- `resume-growth-ops` — operations / growth style (medium density), metric cards first, for growth, ads, community, content ops, data-driven roles
- `resume-design-folio` — visual / UI style (low density), borderless large-whitespace layout, for designers, brand visual, portfolio-oriented resumes

## Content Flow

Tutorial PDFs don't directly typeset Markdown as a continuous webpage; they plan reading phases first:

1. Cover: makes the topic and payoff explicit.
2. Table of contents: shows the knowledge structure.
3. Learning map: puts the intro, reading path, and chapter knowledge points on the same page.
4. Body pages: cut knowledge points by `##` headings, then merge into pages by density.
5. Recap page: closes with key takeaways and an action checklist.

Build also outputs:

```text
output/<input-name>-page-plan.json
```

This plan is for inspecting each page's role, knowledge points, and estimated density. Visual templates can only change style, not skip this flow.

## Resume Flow

Resume PDFs don't hard-line a timeline or expand every module evenly; they choose focus by reader first:

1. Professional positioning: name, role, location, contact, core summary.
2. Featured highlights: surface the 3–4 most important business lines first.
3. Main project pages: prioritize business lines that best prove 0-to-1.
4. Experience-grouped pages: merge related projects by density, avoid short projects getting a whole page.
5. Skills closure: stack, infra, early experience on the final page to close the loop.

Resume input needs front matter declarations:

```md
---
documentType: "resume"
title: "Candidate Name"
subtitle: "Senior Frontend Engineer / Cross-border Payments & AI Platform Lead"
role: "Frontend Lead"
location: "Hangzhou"
avatar: "docs/brand/avatar.png"
contact: "email@example.com / +86 *** **** ****"
links: "github.com/example / portfolio.example.com"
motto: "A short closing motto."
---
```

`avatar` is a repo-relative path; at build time it's inlined as a data URI, so exported HTML/PDF doesn't depend on external files. If unreadable, it gracefully degrades to a single-column first screen with no avatar — never blocks the build. The four resume templates use different avatar layouts (right circle / left circle mirror / dark band reversed / square with rounded corners) — see [docs/design-spec.md](docs/design-spec.md).

Build outputs the matching `page-plan.json`, useful for inspecting which experience points each page carries and whether page density is unbalanced.

## User preference themes

Templates provide base visual styles; `--theme` dynamically overrides CSS variables before PDF generation. So you can first collect the user's favorite colors, brand palette, or aesthetic direction, then inject those preferences into any template without breaking content flow.

Example:

```json
{
  "name": "Morandi Sage",
  "colors": {
    "paper": "#f4f1ea",
    "ink": "#28312b",
    "muted": "#6f756d",
    "faint": "#d9d3c7",
    "soft": "#e9e2d7",
    "accent": "#6f7d62",
    "accent2": "#b58a72",
    "danger": "#9a5d50"
  },
  "cssVariables": {
    "--radius": "8px"
  }
}
```

`colors` are common semantic colors, auto-generatable from user preferences; `cssVariables` are for advanced overrides, like radius, page padding, or any variable the template already defines.

## Content config

Markdown front matter is supported at the top:

```md
---
title: "AI Knowledge Tutorial: From Understanding to Using"
subtitle: "A save-worthy learning handbook for Xiaohongshu and WeChat readers"
date: "2026-07-31"
author: "Codex"
pageHeader: "AI Knowledge PDF"
pageFooter: "From Understanding to Using"
shareHeader: "AI Knowledge Tutorial: From Understanding to Using"
shareFooter: "Worth saving, worth sharing, worth reviewing."
---
```

Config notes:

- `title` / `subtitle`: cover, long-image title, and default meta.
- `pageHeader`: top-left text on PDF body pages.
- `pageFooter`: bottom-left text on PDF body pages.
- `shareHeader`: long-image top title.
- `shareFooter`: long-image bottom hint.
- `documentType`: default `tutorial`; set to `resume` for resumes.
- `role` / `location` / `contact` / `links`: resume-template first-screen info.
- `avatar`: resume first-screen avatar, repo-relative path, inlined at build time.
- `motto`: motto, rendered in the bottom-right of the final page.

Body uses standard Markdown. Recommend `##` for sections, `###` for sub-sections.

### Environment-variable injection (keep private info out of the repo)

All front matter values support `${VAR}` and `${VAR:-default}` syntax; the build reads the project root's `.env` automatically (gitignored):

```md
contact: "${RESUME_CONTACT:-hello@example.com / +86 138-0000-0000}"
links: "${RESUME_LINKS:-github.com/example}"
```

```bash
cp .env.example .env   # fill in real contact info, stays local
```

Real phone numbers, emails, and other private info go into `.env`; the Markdown in the repo keeps only placeholder defaults. The whole private resume can also be named `content/*.local.md` (also gitignored).

## Output artifacts

```text
output/tutorial.pdf        # A4 PDF
output/tutorial.html       # intermediate HTML for inspection
output/tutorial.share.png  # auto-generated long-image share
output/ai-readable-kit.talk.html  # talk deck (--talk, for live explanation)
output/example-page-plan.json
output/resume-example.pdf
output/resume-example-page-plan.json
```

## PDF UI hard constraints

- `@page` must keep `margin: 0`, otherwise non-first-page backgrounds can't full-bleed.
- Every real page container must use the unified page-padding variables: `--page-pad-top/right/bottom/left`.
- Body content can't use one long `article` naturally spanning pages — must be grouped into `.lesson-page` containers.
- `.lesson-page` can't naively cut one per `##` heading; short sections must merge.
- Short intros can't stand alone as a body page — must join the "learning map" or merge with knowledge points.
- Resume templates must use `.resume-page` containers; first page and body pages use different density thresholds.
- New templates can only change visual tokens and component behavior, not skip content-flow page roles.
- Acceptance: at minimum render and inspect the cover, table of contents, learning map, one body continuation page, and the final page.

## Project structure

```text
content/                 # Markdown tutorials
docs/designs/            # README template preview images
src/build.ts             # builder entry
templates/base/          # generic page structure and PDF rules
templates/resume-base/   # resume page structure and PDF rules
templates/*/print.css    # visual themes
output/                  # build artifacts
```

## Version

Currently `0.4.1`. Change history in [CHANGELOG.md](CHANGELOG.md); versions follow semver, each version corresponds to one git tag.

## Development commands

```bash
pnpm check
pnpm build:example
pnpm build:all
pnpm build:resume
pnpm build:resume:all
```

## Maintainer

<table>
  <tr>
    <td width="130" align="center">
      <img src="https://cdn.jsdelivr.net/gh/webkubor/free-imgbed@main/facet/lunove.webp" width="104" alt="Lunove" />
    </td>
    <td>
      <b>Lunove</b> — Agent Maintainer<br/>
      <sub>Open-source maintenance: README, issues, releases, template assets</sub>
      <p>This repo's template previews, documentation structure, and release cadence are maintained by her. Template changes follow the hard rule "visuals can change, content flow cannot be skipped"; after any change, render and visually inspect cover, table of contents, body continuation page, and final page.</p>
    </td>
  </tr>
</table>

CortexOS agent team: **Nanzhu** (architecture & technical exploration), **Lunove** (open-source maintenance), **Gu Qiyue** (content & copywriting), **Vex** (operations on-call).

Issues and PRs welcome — please first describe the scenario you're solving, then attach the rendered PDF or long image.