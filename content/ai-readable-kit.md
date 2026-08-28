---
title: "我给自己的项目做了次 AI 可读性体检，第一刀砍在自己身上"
subtitle: "AGENTS.md · llms.txt · robots.txt —— 一次翻车实录，和我还没想明白的几个问题"
date: "2026-08-28"
author: "webkubor"
pageHeader: "AI Readability"
pageFooter: "一次翻车实录"
shareHeader: "我给自己的项目做了次 AI 可读性体检"
shareFooter: "AGENTS.md · llms.txt · robots.txt —— 翻车实录与开放问题"
series: "技术交流 · 第 1 期"
site: "share.webkubor.online"
closingTitle: "聊到这里"
closingNote: "以上都是我自己项目上的实践，样本量就一个。哪里说错了、你们那边是怎么做的，随时来找我。"
---

# 我给自己的项目做了次 AI 可读性体检，第一刀砍在自己身上

我在做一个叫 Scorecard 的小工具，给开源项目按九个维度打分。今年加第九维「AI 可读性」的时候，顺手拿自己的项目跑了一遍——结果是我自己的官网被屏蔽了 AI 爬虫，而我完全不知道。

这次想聊的就是这个过程：我看到了什么、踩了哪些坑、以及有几个问题我到现在也没想清楚，想听听大家怎么看。

## 我为什么会去关心这件事

star 数只告诉你结果，不告诉你原因。我关注到的变化是，AI 爬虫和编码助手正在成为新的流量入口——ChatGPT、Perplexity、Claude 引用一个项目，用户才点进来。这几年 robots.txt 那边的动静挺明显：

| 时间 | 事件 | 影响 |
| --- | --- | --- |
| 2023.08 | OpenAI 公开 GPTBot，站长开始屏蔽 | 内容进不了 AI 搜索答案 |
| 2024 | ClaudeBot / PerplexityBot / Google-Extended 陆续上线 | 屏蔽名单越来越长 |
| 2025 | GitHub 原生支持 AGENTS.md，llmstxt.org 发布 | 仓库级「AI 可读性」有了标准动作 |
| 2025+ | Cloudflare 托管 robots.txt 默认屏蔽 AI 爬虫 | 很多站是默认被屏蔽的 |

> 这是我的判断，不一定对：LLM 引用正在变成一个新的流量入口。也可能它没那么重要，这点我想听听大家的看法。

### 于是我加了第九维

原来的八维是从「陌生人 10 秒内会不会 star」这个视角出发的。第九维 **AI 可读性** 我给自己定的约束是：全部判据客观可查——文件在不在、状态码是多少，判不了的不算项目的错，按可核实部分归一化。

## AGENTS.md：我理解的「仓库对 AI 说的第一句话」

2025 年起 GitHub 原生支持 `AGENTS.md`。Copilot / Codex / Claude Code 进仓库第一件事就是读它。

我给这几项定的分值是这样的——**说明一下，这九个维度和权重都是我自己拍的**，拿出来主要是想听听大家觉得该怎么排：

| 判据 | 我给的分值 | 说明 |
| --- | --- | --- |
| 仓库根目录有 AGENTS.md | +3 | AI 助手的行为准则 |
| 仓库根目录有 llms.txt | +2 | LLM 内容清单 |
| .github/copilot-instructions.md | +1.5 | Copilot 定制指令 |
| 官网 robots.txt 放行 AI 爬虫 | +2 | GPTBot / ClaudeBot 等 |
| 官网根目录有 llms.txt | +1.5 | LLM 内容清单 |

### 我自己是这么写的

- 这是什么（一句话 + 关键文件地图）
- 常用命令（构建 / 测试 / 起服务）
- 约定（改哪里、怎么改、禁止事项）

```markdown
# AGENTS.md — AI 助手工作守则

## 这是什么
Scorecard —— 开源项目九维度质检工具。
- server/audit.js：质检引擎（权威）
- src/components/Scorecard.vue：前端面板

## 常用命令
- bun run build    # 构建前端到 dist/
- bun run server   # 起后端（:54445）

## 约定
- 改维度必须同步 audit.js + check-dimensions + SKILL.md 三处
- 每条结论必须有证据，判不了写 manual + unverifiable
```

## llms.txt：一份给 LLM 的内容清单

llmstxt.org 的规范是：站点根目录放一个纯文本清单，让 LLM 一眼知道「这里有什么、重点是什么」。我写成了这样：

```text
# Scorecard

> 开源项目九维度质检。粘一个 GitHub URL，几秒钟拿到雷达图、
> 整改清单和可直接喂给 AI 的 Markdown 报告。

Key points:
- 输入：GitHub 仓库地址（owner/repo）
- 输出：0-10 总分 + 九维度雷达图 + 整改清单

Useful links:
- [在线使用](https://scorecard.webkubor.online)
- [源码仓库](https://github.com/webkubor/scorecard)
```

**这里我踩了一个坑**：SPA 的 history fallback 对任何路径都返回 index.html，所以 `/llms.txt` 拿到的是一页 HTML 而不是清单。我以为放上去就完事了，实际得显式注册路由，别让 SPA 顶替。

## robots.txt：我以为不用管，结果被默认屏蔽了

主流 AI 爬虫的 UA：

| UA | 谁家的 | 用途 |
| --- | --- | --- |
| GPTBot | OpenAI | 训练与搜索 |
| ClaudeBot / Claude-Web | Anthropic | 训练与引用 |
| PerplexityBot | Perplexity | AI 搜索 |
| Google-Extended | Google | AI 训练 opt-out |
| CCBot | Common Crawl | 大规模语料 |

robots.txt 是 opt-out 协议，**不写 Disallow 就是默认放行**，所以我一直觉得这件事不用管：

```text
User-agent: *
Allow: /
```

### 翻车现场

Cloudflare 有个「托管 robots.txt」功能，会给站点注入一排 Disallow：GPTBot、ClaudeBot、Google-Extended、CCBot 全在里面。我的站开了这个功能，而我根本不知道它做了什么——**自己做的质检工具，第一刀砍在自己身上**。

我是这么发现的：

```bash
curl -s https://你的域名/robots.txt | grep -iE "gptbot|claudebot|perplexity"
```

看到 `Disallow: /` 的话，内容就进不了 AI 搜索答案。修法是站点自己提供放行的 robots.txt，然后去 Cloudflare 后台关掉「托管 robots.txt」，让 origin 的规则生效。

## 用同一套标准跑出来的参照

再强调一次，这个分数是**我自己那套拍脑袋的标准**跑出来的，只能横向参照，不代表项目质量：

| 项目 | AI 可读性 | 亮点 | 缺什么 |
| --- | --- | --- | --- |
| sst/sst | 6.5 | 有 AGENTS.md，官网有 llms.txt | 仓库没有 llms.txt |
| vitejs/vite | 5 | 有 Copilot 指令，官网有 llms.txt | 没有 AGENTS.md |
| denoland/deno | 1.5 | 有 Copilot 指令 | 其余都没有 |
| webkubor/scorecard | 6.5 → 8.5 | 补齐 AGENTS.md / llms.txt | 官网曾被 CF 默认屏蔽 |

## 我接下来打算做的三件事

1. 把 AGENTS.md 的模板再抽一层，现在每个项目都在手写
2. 给 llms.txt 加自动生成，靠人维护迟早会过期
3. 把 robots.txt 检查做成 CI 的一步，免得再被默认屏蔽一次

如果你也想给自己的项目看一眼，一条命令就够：

```bash
curl -s https://你的域名/robots.txt | grep -iE "gptbot|claudebot|perplexity"
```

## 我还没想清楚的几个问题

这几个是我真的没答案的，很想听听大家的经验：

1. **格式会不会碎掉**：AGENTS.md、CLAUDE.md、`.cursorrules`、copilot-instructions 各写一份，最后是不是在维护五份同样的东西？有没有人趟过这个，怎么收敛的？
2. **内部私有仓库值不值得做**：对外是流量收益，对内呢？如果收益是「新人和 AI 上手更快」，那它跟一份写得好的 README 的区别在哪？
3. **放行 AI 爬虫对商业项目有没有风险**：内容被训练走了，流量却不一定回来。开源项目我想清楚了，商业站我没有。
