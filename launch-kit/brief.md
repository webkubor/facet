# Launch Brief — Facet

## 项目一句话

把 Markdown 知识教程一条命令变成排版可控的 A4 PDF + 小红书/公众号长图。

## 目标受众

- 做知识内容的创作者：小红书、公众号、B 站教程作者
- 知识付费/社群课主理人，需要「可收藏、可转发」的课程资料
- 用 AI Agent（Claude Code / Codex / Cursor）批量产内容的人

## 核心承诺（primary promise）

**内容先于视觉**：不是把网页打印成 PDF，而是先规划 content flow（封面→目录→学习地图→正文→回顾），输出 page-plan.json 让每页知识密度可检查，再套 8 套教程模板 + 4 套简历模板任选，颜色偏好还能动态覆写。

## 选定角度

**outcome-first（结果先行）**：一条命令，Markdown 进，「能直接发」的 PDF + 长图出。
备选角度：
- pain-first：Markdown 打印成 PDF 总是丑——短章节独占整页、背景断裂、长图还得截图拼接。
- builder-first：为什么排版工具都在「打印网页」，而没人先规划每页放什么。

## 语气

工具向、克制、以实测截图说话。不用「颠覆」「一键改变」类词。

## CTA

GitHub 仓库：https://github.com/webkubor/facet — `pnpm install && pnpm build:all` 30 秒出结果。

## 平台

小红书（主推）、微信视频号、B 站、X、Hacker News。

## 已知约束

- 项目 v0.1.0，无 star/用户数据可引用 — 公开文案不得提 traction。
- 无 npm 发布记录（package.json private:false 但未验证已发布）— 安装口径统一用 clone + pnpm。
- 视频素材：静态截图已实测产出；屏幕录制尚未捕获（见 manifest）。
