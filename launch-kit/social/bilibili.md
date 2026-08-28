# B 站

## 标题（可搜索）

开源 Markdown 转 PDF 工具，但它先规划排版再渲染｜facet

## 简介

Markdown 直接「打印」成 PDF 的老问题：短章节独占整页、背景断裂、长图要手动拼。

facet 换了个思路：先做模板无关的 content flow（封面→目录→学习地图→正文→回顾），输出 page-plan.json 让每页知识密度可检查，再套视觉模板渲染。

本期演示：
00:00 问题：打印式 PDF 有多丑
00:12 一条命令出 PDF + 长图
00:24 content flow 和 page-plan.json
00:38 8 套教程模板 + 4 套简历模板 + 莫兰迪主题色覆写
00:48 上手方式

技术栈：TypeScript + markdown-it + Playwright，MIT 开源。
仓库：https://github.com/webkubor/facet

适合：小红书/公众号知识内容创作者、知识付费资料制作、用 Claude Code / Codex 等 Agent 批量产内容的工作流。

## 标签

开源, Markdown, PDF, 效率工具, TypeScript, Playwright, 知识管理, 内容创作
