# Demo GIF Plan（<25 秒，单一成功路径）

目标：README 首屏一张 GIF 证明核心承诺——一条命令，PDF + 长图同时出。

| 秒 | 画面 |
|---|---|
| 0–3 | 终端：`pnpm build:example` 回车 |
| 3–7 | 构建日志滚动：Page plan written → PDF written → Share image written |
| 7–14 | Finder/预览：打开 example-warm-handbook.pdf，快速翻 3 页（封面→学习地图→正文） |
| 14–22 | 预览 share.png，从顶部匀速滚到底部 |
| 22–25 | 定格：output/ 目录三件产物 + 仓库名 |

## 制作参数

- 录制宽度 ≤1200px，导出 GIF ≤10MB（GitHub README 限制内），或用 mp4 + `<video>` 不受此限。
- 工具建议：macOS 自带录屏 + gifski，或 vhs（终端部分可脚本化）。
- 终端隐藏用户名 hostname；Finder 侧栏收起。
