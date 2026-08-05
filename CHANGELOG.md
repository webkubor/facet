# 更新日志

本文件记录 Knowledge PDF Kit 的版本变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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

[0.2.0]: https://github.com/webkubor/knowledge-pdf-kit/releases/tag/v0.2.0
[0.1.0]: https://github.com/webkubor/knowledge-pdf-kit/releases/tag/v0.1.0
