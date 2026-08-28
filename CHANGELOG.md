# 更新日志

本文件记录 Facet 的版本变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-08-28

项目改名 `knowledge-pdf-kit` → `facet`，并补上第三个刻面：talk（演讲）与 read（阅读）。

### 新增

- **read 形态**（`--read`）：连续排版的网页长文。不分页——分页是纸和幻灯片的约束，
  网页没有，硬套过来只会让读者多点很多下。正文限宽按「一行 30-40 个汉字」定。
- **talk 自动拆屏**：章节内容超出一屏时按内容量拆成「第 N 章 · 1/3」，续屏标题降级
  加「续」标签。估高口径见 `src/talk.ts` 的 `estimateBlockHeight`——**不能复用
  content-flow 的 weight**，那是 PDF 的口径（12px 表格 / 14px 正文），talk 正文 20px、
  表格 16px 带 padding，同样「92 权重一行表格」实际占 60px。
- **talk 片尾页**：系列 / 署名 / 归档站点，front matter 新增 `series`、`site`、
  `closingTitle`、`closingNote`。默认标题「聊到这里」而不是「感谢聆听」——后者是收束语，
  会把讲者重新放回讲台。
- **share 站生成器**（`scripts/build-site.mjs`）：把每份带 `slug` 的 `content/*.md`
  投影成 read + talk 两份，加索引页、llms.txt、robots.txt、sitemap，产物落 `dist-share/`。
  发布口径是 front matter 的 `slug`——有 slug 才发布，草稿与简历天然排除，
  不用另维护一份清单。
- **两条回归检查**：`check-talk-pagination.mjs`（分页 / 目录 / 片尾三条断言）与
  `check-slide-overflow.mjs`（playwright 逐屏实测是否被切）。分屏用估算、验收用实测，
  两者独立——用同一个模型既分屏又验收等于自己给自己打分。
- `themes/bloom-sage.json`：取自 typora-Bloom-theme 的莫兰迪色板（oklch 表示，
  对比度经 contrast.config 校验），改色回源仓库改，别在这里各调一份。

### 修复

- 代码块里的 `## xxx` 被当成章节分页点，正文贴 AGENTS.md 模板会凭空多出
  「这是什么 / 常用命令 / 约定」碎片页。`buildToc` 同样受影响——目录条数与实际章节
  对不上，点了还会跳错页（影响 PDF / read / talk 三个形态）。
- 拆屏后续屏被计入章节数，封面报「17 个章节」（实际 7 章），目录点第 3 条会跳到
  第 1 章的第 3 屏。改为只数 / 只跳每章首屏。
- talk 代码块硬编码 `#1f2937` 深蓝灰不走主题变量，满屏代码时把柔和色系整个压掉；
  字号 14.5px 投影后排看不清，提到 17px。

### 变更

- 项目名与包名改为 `facet`：`pdf` 是渲染目标之一、不是核心，写进项目名会让人
  每次都往 PDF 那边想。facet = 刻面，内容只有一份，变的是看它的角度。
- README / CHANGELOG / launch-kit 全部自称同步；GitHub 仓库改名，旧地址会跳转。

## [0.2.0] - 2026-08-05

简历体系从「一套高密度模板换配色」升级为「按职业族换骨架」。

### 新增

- **职业族**：简历模板按 `tech` / `growth` / `design` 分族，门禁阈值随族切换。单一真源在
  [`templates/resume-families.json`](templates/resume-families.json)，`src/resume-families.ts` 与
  `scripts/verify-resume.mjs` 共用同一份定义。
- **三种首页骨架**：`stacked`（单列高密度）、`metrics-band`（整宽 KPI 指标带在前）、
  `sidebar`（左 64mm 窄栏 + 右宽栏）。骨架由 flow 层装配，不是 CSS 换皮。
- **头像组件**：front matter 新增 `avatar`，构建时由 `src/avatar.ts` 内联成 data URI，
  导出的 HTML/PDF 不依赖外部文件；读不到自动降级为单栏首屏。
- 两套新模板：`resume-growth-ops`（运营 / 增长，指标卡）、`resume-design-folio`（视觉 / UI，去框大留白）。
- `motto` 座右铭渲染在末页右下收尾。

### 变更

- 简历模板从四套增加到六套；`docs/design-spec.md` 新增「职业族与密度策略」「简历体系组件」
  「模板变体职责」三节，并修正与之冲突的旧表述。
- 联系方式徽章从 hero 内部拆出独立成行，首屏间距节奏定为 4 / 3.5 / 5 / 5 / 6mm。
- 四套技术族模板的 hero 版式拉开差异：右圆 / 左圆镜像 / 深色条反白 / 方形圆角。
- 示例简历改为仓库维护者的 agent 履历，不含任何真实个人信息。

### 修复

- `sidebar` 正文页曾复制首页 64mm 缩进，导致每页仅装得下一张卡片、留白达 47%，
  改为 10mm 细线缩进呼应侧栏。
- `design` 族姓名在 64mm 窄栏下从 40px 收到 36px，避免「小楠 ·」这类断行。

### 安全

- 清洗 git 历史中的真实姓名、邮箱与手机号，并替换含真名的旧模板预览图。
  隐私信息一律走 `.env` 注入，仓库内只保留占位默认值。

## [0.1.0] - 2026-08-04

首个公开版本。

### 新增

- Markdown → HTML/CSS → Playwright 的本地 PDF 生成链路，附带长图分享产物 `*.share.png`。
- 模板无关的 content flow：封面、目录、学习地图、正文页、回顾页，并输出 `page-plan.json`。
- 八套知识教程模板与四套简历模板。
- 简历分页改为量测驱动：在真实模板与打印宽度下量测每张卡片像素高再贪心装箱，移除权重魔法数字。
- 视觉自动化校验 `scripts/verify-resume.mjs`：页高、PDF 页数、留白比例、字阶、WCAG 对比度。
- `--theme` 用户偏好主题注入，front matter 支持 `${VAR}` 环境变量插值。

[0.3.0]: https://github.com/webkubor/facet/releases/tag/v0.3.0
[0.2.0]: https://github.com/webkubor/facet/releases/tag/v0.2.0
[0.1.0]: https://github.com/webkubor/facet/releases/tag/v0.1.0
