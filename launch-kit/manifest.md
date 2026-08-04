# Manifest — knowledge-pdf-kit launch kit

生成时间：2026-07-31（v2 同日更新：新增 Agent 镜头、本机制作流水线、VoxCraft TTS 链路实测）。
模式：Demo kit（内容 + 真实构建证据；录屏/成片制作路径见 video/production-pipeline.md）。

| 交付物 | 状态 | 路径 |
|---|---|---|
| Launch brief | ready | launch-kit/brief.md |
| Claims ledger（12 条，全部有出处） | ready | launch-kit/claims.md |
| 60s 视频脚本 | ready | launch-kit/video/script-60s.md |
| Shot list（v2，7 镜头含 Agent 工作流） | ready | launch-kit/video/shot-list.md |
| Voiceover（~170 字 + TTS 分句稿） | ready | launch-kit/video/voiceover.md |
| 制作流水线（本机工具链盘点 + 分工） | ready | launch-kit/video/production-pipeline.md |
| captions.srt | needs render（7 句 wav 出来后按 ffprobe 时长推算，无需 whisper） | — |
| 小红书文案 + 配图清单 | ready | launch-kit/social/xiaohongshu.md |
| 视频号标题/描述 | ready | launch-kit/social/wechat-channels.md |
| B 站标题/简介/章节 | ready | launch-kit/social/bilibili.md |
| X 单条 + thread | ready | launch-kit/social/x.md |
| Show HN 标题 + 首评 | ready | launch-kit/social/hacker-news.md |
| README hero 建议 | ready | launch-kit/github/readme-hero.md |
| Demo GIF 计划 | ready（GIF 本体 needs capture） | launch-kit/github/demo-gif-plan.md |
| Product Hunt | 未做（本次未选该平台，需要可补） | — |

## 已捕获的真实证据（构建实测产物）

| 资产 | 状态 | 路径 |
|---|---|---|
| 暖橙版长图（小红书配图 1） | captured ✅ | output/example-warm-handbook.share.png |
| 莫兰迪主题版长图（对比图） | captured ✅ | output/example-dossier-sage.share.png |
| A4 PDF ×2 | captured ✅ | output/example-warm-handbook.pdf, example-dossier-sage.pdf |
| page-plan.json（短章节合并证据） | captured ✅ | output/example-page-plan.json |
| 12 张模板封面 | 仓库自带 | docs/designs/*.png |

## 待办（发布前）

1. needs capture：按 shot-list.md 录屏（终端构建、PDF 翻页、README 滚动、"丑 PDF" 对比素材）。
2. needs render：剪辑 60s 竖版视频 + 按实际语速生成 captions.srt。
3. needs capture：README demo GIF。
4. needs user input：确认小红书文案语气、是否补 Product Hunt。
5. 发布本身需用户逐平台确认（本 kit 不自动发布）。
