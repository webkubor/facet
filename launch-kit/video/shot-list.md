# Shot List — 65s 竖版（v2：新增 Agent 工作流镜头）

格式：时间 | 画面 | 操作 | 口播 | 屏幕文字 | 素材来源

| 时间 | 画面 | 操作 | 口播 | 屏幕文字 | 素材来源 |
|---|---|---|---|---|---|
| 00:00–00:04 | 丑 PDF vs 成品长图左右对比 | 静态对比卡，0.5s 切入 | 你的 Markdown 教程导出 PDF，是不是总是丑得没法发？ | 「打印网页」vs「知识手册」 | 需捕获：任意 md 用浏览器打印的 PDF 截图；成品用 output/example-warm-handbook.share.png（已有） |
| 00:04–00:12 | 终端 + Finder | 敲 `pnpm build:example`，Finder 空格预览 share.png 并滚动 | 一条命令，同时生成 A4 PDF 和小红书长图，直接能发 | pnpm build:example | 需捕获：录屏（终端字号调大，隐藏无关标签/通知） |
| 00:12–00:24 | page-plan.json ↔ PDF 翻页 | 编辑器高亮 pages[].role 字段，切到 PDF 逐页翻：封面→目录→学习地图→正文→回顾 | 它先规划每一页放哪些知识点，短章节自动合并 | content flow：先内容，后视觉 | 已有：output/example-page-plan.json、example-warm-handbook.pdf；需捕获：翻页录屏 |
| 00:24–00:36 | 模板封面轮播 | 12 张图 0.8s/张 快切，末尾 3 张放慢 | 八套教程模板和四套简历模板随便换，同一份 Markdown 气质完全不同 | 12 templates | 已有：docs/designs/*.png（12 张） |
| 00:36–00:46 | 主题覆写对比 | 敲 `--theme themes/morandi-sage.json`，暖橙/灰绿两张长图并排滑入 | 把喜欢的颜色写成 JSON，注入任何模板 | --theme morandi-sage.json | 已有：example-warm-handbook.share.png、example-dossier-sage.share.png；需捕获：命令录屏 |
| 00:46–00:54 | 【新增】Agent 工作流 | Claude Code 窗口输入「把这篇 Markdown 做成研究档案风 PDF」→ Agent 自动跑 build → 产物出现在 output/ | 它对 Agent 也友好——让 Claude Code 或 Codex 直接替你跑完整个流程 | agent-ready | 需捕获：Claude Code 录屏（本次会话即是可复现实例） |
| 00:54–01:05 | GitHub README 滚动 | 浏览器滚动 README 模板预览表格，定格仓库头部 | 开源 MIT，仓库名 facet，链接评论区 | github.com/webkubor/facet | 需捕获：浏览器录屏（干净 profile，无书签栏） |

## 录制注意

- 竖版 9:16：终端/浏览器窗口调窄，或横录后按竖版重构图。
- 隐藏：系统通知、Dock 无关图标、浏览器书签、真实邮箱/用户名（终端 PS1 若含用户名先改掉）。
- 终端主题选高对比（浅底深字在手机上更清晰）。
