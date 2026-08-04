# 小红书

## 标题（≤20 字）

Markdown 一键变小红书长图+PDF，开源的

## 正文

做知识内容的都懂这个痛：
教程用 Markdown 写得好好的，一导出 PDF 就没法看——
短章节孤零零占一整页，背景断在半截，想发小红书还得自己截图拼长图。

最近开源了一个小工具：knowledge-pdf-kit。

一条命令，同时出两样东西：
📄 A4 PDF（可收藏、可打印）
🖼 竖版长图（直接发小红书/公众号）

它和「网页打印成 PDF」的思路完全不同：
先规划内容 flow——封面、目录、学习地图、正文、回顾页，
每页放哪些知识点都算好密度，短小节自动合并。

排版规划好之后，8 套教程模板 + 4 套简历模板随便换：
温暖手册风、公众号杂志风、莫兰迪研究档案风……
同一份 Markdown，换个模板就是完全不同的气质。

喜欢的颜色还能写成 JSON 注入进去，结构一点不乱。

MIT 开源，仓库地址放评论区了 👇
（配图 1-9：成品长图 2 张 + 8 套教程模板 + 4 套简历模板封面选 6-7 张）

## 标签

#开源工具 #Markdown #知识管理 #内容创作 #PDF #效率工具

## 配图清单

1. output/example-warm-handbook.share.png（暖橙版长图）
2. output/example-dossier-sage.share.png（莫兰迪版长图，对比图）
3–9. docs/designs/ 中选 7 张模板封面

## 评论区首条

仓库：https://github.com/webkubor/knowledge-pdf-kit ，pnpm install 之后 pnpm build:all 就能看到全部教程和简历模板效果～
