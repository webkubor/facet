# Claims Ledger — Knowledge PDF Kit

构建环境：macOS，pnpm 11.1.2，2026-07-31 本地实测。

| # | Claim | Evidence | Confidence | Public-safe |
|---|---|---|---|---|
| 1 | Markdown → PDF + 长图，一条命令本地生成 | 实测 `pnpm build:example` 产出 `example-warm-handbook.pdf`（2.1MB）+ `.share.png`（936KB）+ `page-plan.json` | high | yes |
| 2 | 先规划 content flow 再套视觉模板 | `src/build.ts` 先解析文档类型，再分发到教程 `content-flow` 或简历 `resume-flow`；`output/example-page-plan.json` 与 `output/resume-example-page-plan.json` 记录每页角色和内容密度 | high | yes |
| 3 | 短章节自动合并，不会一节独占一页 | page-plan.json 第 6 页：常见误区(536)+行动清单(164)+结论(161) 三节合并；contract minLessonWeight 760 / max 1500 | high | yes |
| 4 | 内置 8 套教程模板 + 4 套简历模板 | `templates/` 下 8 个教程 print.css，以及 resume-payment-lead、resume-global-checkout、resume-ai-platform、resume-infra-builder 4 个简历 print.css | high | yes |
| 5 | `--theme` 动态覆写颜色，不破坏 flow | 实测 `--theme themes/morandi-sage.json` 套 research-dossier，长图配色从暖橙变灰绿，页面结构一致（两张截图对比） | high | yes |
| 6 | 长图适配小红书/公众号分发 | 实测 share.png 为 1240px 宽竖版长图，含顶部标题/底部尾注；README 明确此定位 | high | yes |
| 7 | 输出 page-plan.json 可检查每页知识密度 | 实测文件含每页 role、sections、weight | high | yes |
| 8 | 支持 front matter 配置页眉/页脚/长图标题 | README「内容配置」+ content/example.md 实例 | high | yes |
| 9 | Agent-ready（Claude Code/Codex/Cursor 等） | README 表格声明；本次即由 Claude Code 全程操作验证（clone→install→build→查看产物） | medium（"完整支持"是自我声明，但本次实操算一次真实 Agent 使用证据） | yes（表述为"为 Agent 工作流设计"） |
| 10 | 技术栈 markdown-it + highlight.js + Playwright + TypeScript strict | package.json + tsconfig.json | high | yes |
| 11 | MIT 协议 | LICENSE 文件 | high | yes |
| 12 | 30 秒上手 | pnpm install 实测 1 秒（缓存命中）+ build 数秒；冷启动需下载 Playwright 浏览器，30 秒是理想值 | medium | yes（表述为"几条命令即出结果"，避免绝对时间承诺） |

## 未验证假设（不进公开文案）

- npm 是否已发布 `knowledge-pdf-kit` 包 — 未验证，安装口径统一 git clone。
- `pnpm build:all` 和 `pnpm build:resume:all` 已在 2026-08-04 跑通；README 文案可写 8 套教程模板 + 4 套简历模板。
- Windows/Linux 兼容性未测。

## 刻意排除的说法

- 任何 star 数、用户数、性能对比（vs pandoc/typora/md-to-pdf）— 无数据。
- 「最漂亮」「效率提升 X 倍」类不可证superlative。
- 30 秒绝对时间承诺（冷启动含浏览器下载，不止 30 秒）。
