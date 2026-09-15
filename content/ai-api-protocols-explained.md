---
title: "端点、协议、API——调 AI 模型时那三个总被搞混的词"
talkTitle: "为什么你的 AI 请求会 404"
subtitle: "一个比喻讲清 OpenAI 和 Anthropic 的 API 到底差在哪，以及「兼容」是怎么回事"
date: "2026-09-15"
author: "webkubor"
pageHeader: "AI API · 端点与协议"
pageFooter: "写给第一次接 AI 接口的人"
shareHeader: "端点、协议、API 到底差在哪"
shareFooter: "地址写错是 404，信封格式写错是 400——两种错，两个方向查。"
slug: "ai-api-protocols-explained"
series: "技术交流 · 第 7 期"
site: "share.webkubor.online"
closingTitle: "先问是形状不对，还是地址不对"
closingNote: "404 查地址，400 查形状。这两句能省掉一半的排查时间。"
---

# 端点、协议、API——调 AI 模型时那三个总被搞混的词

你想让程序用上 AI，翻文档时会撞见一堆词：**端点**、**协议**、**Chat Completions API**、**Responses API**、**Messages API**、还有满世界的「**兼容**」。

它们听起来像同一层的东西，其实不是。搞混的代价很具体：**你会对着一个 404 找不到北**，或者收到 400 却以为是模型不支持。

这篇用寄快递做比喻，把三个词一次分清。

---

## 一分钟版本

<div style="break-inside: avoid;">
<svg viewBox="0 0 700 250" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:system-ui,-apple-system,sans-serif;">
  <rect x="20" y="20" width="200" height="200" rx="10" fill="#e8f0ea" stroke="#5a7a63" stroke-width="2"/>
  <text x="120" y="52" text-anchor="middle" font-size="17" font-weight="700" fill="#2f4a37">端点 Endpoint</text>
  <text x="120" y="80" text-anchor="middle" font-size="13" fill="#5a7a63">= 收件地址</text>
  <text x="120" y="118" text-anchor="middle" font-size="12" fill="#3f4740">送到哪个 URL</text>
  <text x="120" y="142" text-anchor="middle" font-size="11.5" fill="#6b7280">/v1/chat/completions</text>
  <text x="120" y="162" text-anchor="middle" font-size="11.5" fill="#6b7280">/v1/messages</text>
  <rect x="35" y="180" width="170" height="26" rx="5" fill="#fff" stroke="#c0392b" stroke-width="1.5"/>
  <text x="120" y="198" text-anchor="middle" font-size="12.5" font-weight="700" fill="#c0392b">写错 → 404</text>
  <rect x="250" y="20" width="200" height="200" rx="10" fill="#f0ece4" stroke="#8a7a5a" stroke-width="2"/>
  <text x="350" y="52" text-anchor="middle" font-size="17" font-weight="700" fill="#4a3f2f">协议 Protocol</text>
  <text x="350" y="80" text-anchor="middle" font-size="13" fill="#8a7a5a">= 信封格式</text>
  <text x="350" y="118" text-anchor="middle" font-size="12" fill="#3f4740">内容怎么排版</text>
  <text x="350" y="142" text-anchor="middle" font-size="11.5" fill="#6b7280">字段叫什么名</text>
  <text x="350" y="162" text-anchor="middle" font-size="11.5" fill="#6b7280">嵌套成什么结构</text>
  <rect x="265" y="180" width="170" height="26" rx="5" fill="#fff" stroke="#c0392b" stroke-width="1.5"/>
  <text x="350" y="198" text-anchor="middle" font-size="12.5" font-weight="700" fill="#c0392b">写错 → 400</text>
  <rect x="480" y="20" width="200" height="200" rx="10" fill="#e6eef2" stroke="#5a7080" stroke-width="2"/>
  <text x="580" y="52" text-anchor="middle" font-size="17" font-weight="700" fill="#2f4050">API</text>
  <text x="580" y="80" text-anchor="middle" font-size="13" fill="#5a7080">= 快递服务本身</text>
  <text x="580" y="118" text-anchor="middle" font-size="12" fill="#3f4740">地址 + 格式的合称</text>
  <text x="580" y="142" text-anchor="middle" font-size="11.5" fill="#6b7280">「Messages API」</text>
  <text x="580" y="162" text-anchor="middle" font-size="11.5" fill="#6b7280">就是这么个整体</text>
  <rect x="495" y="180" width="170" height="26" rx="5" fill="#fff" stroke="#5a7080" stroke-width="1.5"/>
  <text x="580" y="198" text-anchor="middle" font-size="12.5" font-weight="700" fill="#5a7080">日常混着叫</text>
</svg>
</div>

| 词 | 快递比喻 | 具体是什么 | 出错长什么样 |
|---|---|---|---|
| **端点** | 收件地址 | 一个 URL 路径 | **404** 找不到 |
| **协议** | 信封和表格的格式 | 请求体的 JSON 结构 | **400** 字段不对 |
| **API** | 整个快递服务 | 上面两者的合称 | —— |

**一句话**：地址写错送不到（404），地址对但表格填错人家看不懂（400）。

---

## 为什么会混

因为大多数时候，**一个协议就固定挂在一个地址上**，两者像是绑死的。你按文档复制一段代码，地址和格式一起抄过来，从来不用分开想。

直到你遇到这几种情况，它们才会分家：

- 换个服务商，地址变了但格式没变（「**OpenAI 兼容**」）
- 同一家给了两个地址，两种格式都支持（**双栈**）
- 同一家出了新一代格式，老地址还留着（**代际**）

下面挨个说。

---

## OpenAI 有两代协议，Anthropic 只有一个

这是最容易被想当然的地方。很多人以为两家结构对称，其实不是。

### OpenAI：老的没退休，新的已上路

| 协议 | 端点 | 状态 |
|---|---|---|
| **Chat Completions** | `/v1/chat/completions` | 老牌，行业事实标准 |
| **Responses** | `/v1/responses` | 新一代 |

Chat Completions 出现得早、被抄得最多，**整个生态都按它的形状长**——这点很重要，后面讲「兼容」时会回来。

### Anthropic：全部走一个端点

Anthropic 只有 **Messages API**，端点就一个：

```
POST /v1/messages
```

工具调用、结构化输出、扩展思考、提示缓存——**全是这一个端点的参数**，不是另外的 API。

所以「Anthropic 的 Responses API 和 Chat API 有什么区别」这个问题本身不成立：**它没有这种分代**。想换能力，改参数就行，不用换地址。

<div style="break-inside: avoid;">
<svg viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:system-ui,-apple-system,sans-serif;">
  <text x="30" y="30" font-size="15" font-weight="700" fill="#4a3f2f">OpenAI · 两代并行</text>
  <rect x="30" y="45" width="280" height="42" rx="7" fill="#f0ece4" stroke="#8a7a5a" stroke-width="1.5"/>
  <text x="46" y="63" font-size="12.5" font-weight="600" fill="#4a3f2f">Chat Completions</text>
  <text x="46" y="80" font-size="11" fill="#6b7280">/v1/chat/completions　老牌 · 生态标准</text>
  <rect x="30" y="95" width="280" height="42" rx="7" fill="#f0ece4" stroke="#8a7a5a" stroke-width="1.5"/>
  <text x="46" y="113" font-size="12.5" font-weight="600" fill="#4a3f2f">Responses</text>
  <text x="46" y="130" font-size="11" fill="#6b7280">/v1/responses　新一代</text>
  <line x1="355" y1="35" x2="355" y2="205" stroke="#d6cfc2" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="390" y="30" font-size="15" font-weight="700" fill="#2f4a37">Anthropic · 只有一个</text>
  <rect x="390" y="45" width="280" height="92" rx="7" fill="#e8f0ea" stroke="#5a7a63" stroke-width="1.5"/>
  <text x="406" y="63" font-size="12.5" font-weight="600" fill="#2f4a37">Messages</text>
  <text x="406" y="80" font-size="11" fill="#6b7280">POST /v1/messages</text>
  <text x="406" y="102" font-size="11" fill="#5a7a63">工具调用 · 结构化输出 · 思考 · 缓存</text>
  <text x="406" y="120" font-size="11" fill="#5a7a63">全是这个端点的<tspan font-weight="700">参数</tspan>，不是另外的 API</text>
  <rect x="30" y="160" width="640" height="45" rx="7" fill="#fff" stroke="#c9a227" stroke-width="1.5"/>
  <text x="46" y="180" font-size="12.5" font-weight="700" fill="#8a6d1f">常见误解</text>
  <text x="46" y="197" font-size="11.5" fill="#3f4740">以为两家结构对称、Anthropic 也有「新旧两代」——它没有，换能力改参数就行，不用换地址。</text>
</svg>
</div>

---

## 「OpenAI 兼容」是怎么回事

你会在很多服务商的文档里看到「**本接口 OpenAI 兼容**」。意思是：

> 我的地址是我自己的，但**信封格式完全照抄 OpenAI**。你把原来代码里的 URL 和密钥换成我的，别的一个字都不用改。

这就是**协议和端点分家**的典型场景：

```
协议：OpenAI Chat Completions（照抄）
端点：https://我自己的域名/v1/chat/completions（自己的）
```

为什么大家都抄 OpenAI 那套？因为它先到、用的人多，抄它就能直接接住全世界现成的代码和 SDK。**这是生态惯性，不是技术上更优。**

### 真实例子：同一把钥匙，两个地址，两种格式

MiniMax 这家上游同时提供两种：

| 走哪个 | 端点 | 协议 |
|---|---|---|
| Anthropic 风格 | `/v1/messages` | Anthropic Messages |
| OpenAI 风格 | `/v1/chat/completions` | OpenAI Chat Completions |

**同一个账号、同一把密钥**，你按哪套写都行。这就证明了协议和端点是两件事——不然没法同一家支持两套。

---

## 实战：一个字段决定走哪条路

在我们的中台里，每个上游都要声明自己说哪种「方言」：

```yaml
- name: museav
  api_mode: chat_completions      # 说 OpenAI 方言
  base_url: https://manager.museav.top/api

- name: minimax-anthropic
  api_mode: anthropic_messages    # 说 Anthropic 方言
  base_url: https://api.minimaxi.com/anthropic
```

`api_mode` 一共三种取值，正好对应前面讲的三种协议：

| `api_mode` | 协议 | 端点 |
|---|---|---|
| `chat_completions` | OpenAI Chat Completions | `/v1/chat/completions` |
| `anthropic_messages` | Anthropic Messages | `/v1/messages` |
| `codex_responses` | OpenAI Responses | `/v1/responses` |

**声明错了会怎样**：地址能通，但请求体的形状对不上，服务端看不懂你在说什么——返回 400，报某个字段非法。

---

## 最坑的一类错：地址拼出多余的版本号

这是实战里真踩过两次的坑，两次都是 404，两次都花了不少时间。

代码里通常这么拼地址：

```
最终地址 = 服务商给的 base_url + 固定路径
```

固定路径写死成 `/v1/chat/completions`。问题出在**有些服务商给的 base_url 自己就带版本号**：

| 服务商给的 base_url | 拼出来 | 结果 |
|---|---|---|
| `https://api.deepseek.com` | `.../v1/chat/completions` | ✅ 正常 |
| `https://xxx.com/v1` | `.../v1/` **`v1`** `/chat/completions` | ❌ 404 |
| `https://open.bigmodel.cn/api/paas/v4` | `.../v4/` **`v1`** `/chat/completions` | ❌ 404 |

<div style="break-inside: avoid;">
<svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:system-ui,-apple-system,sans-serif;">
  <text x="30" y="28" font-size="14" font-weight="700" fill="#2f4a37">✅ base 不带版本号</text>
  <rect x="30" y="38" width="200" height="30" rx="5" fill="#e8f0ea" stroke="#5a7a63"/>
  <text x="40" y="58" font-size="11" fill="#3f4740">api.deepseek.com</text>
  <text x="240" y="58" font-size="15" fill="#5a7a63">+</text>
  <rect x="262" y="38" width="175" height="30" rx="5" fill="#e8f0ea" stroke="#5a7a63"/>
  <text x="272" y="58" font-size="11" fill="#3f4740">/v1/chat/completions</text>
  <text x="450" y="58" font-size="15" fill="#5a7a63">=</text>
  <rect x="470" y="38" width="200" height="30" rx="5" fill="#fff" stroke="#5a7a63" stroke-width="1.5"/>
  <text x="480" y="58" font-size="11" fill="#2f4a37">…/v1/chat/completions ✓</text>
  <text x="30" y="105" font-size="14" font-weight="700" fill="#c0392b">❌ base 自带版本号</text>
  <rect x="30" y="115" width="200" height="30" rx="5" fill="#fbeae8" stroke="#c0392b"/>
  <text x="40" y="135" font-size="11" fill="#3f4740">…/api/paas/<tspan font-weight="700" fill="#c0392b">v4</tspan></text>
  <text x="240" y="135" font-size="15" fill="#c0392b">+</text>
  <rect x="262" y="115" width="175" height="30" rx="5" fill="#fbeae8" stroke="#c0392b"/>
  <text x="272" y="135" font-size="11" fill="#3f4740">/<tspan font-weight="700" fill="#c0392b">v1</tspan>/chat/completions</text>
  <text x="450" y="135" font-size="15" fill="#c0392b">=</text>
  <rect x="470" y="115" width="200" height="30" rx="5" fill="#fff" stroke="#c0392b" stroke-width="1.5"/>
  <text x="480" y="135" font-size="11" fill="#c0392b">…/v4/v1/chat/… ✗ 404</text>
  <rect x="30" y="160" width="640" height="30" rx="5" fill="#f5f2ea" stroke="#c9a227"/>
  <text x="44" y="180" font-size="11.5" fill="#3f4740">修法：base 末尾已经带 /vN 时，把路径里的 /v1 剥掉再拼。别只防 /v1——版本号不止一种写法。</text>
</svg>
</div>

**为什么难查**：钥匙是对的、模型名是对的、协议也是对的，配置表看上去一切正常，**就是一打就断**。而且没有任何自动检查能拦住它——拼接是在代码里发生的，配置表看不见结果。

第一次踩是某家 base 带 `/v1`，修的时候只防了 `/v1` 结尾；第二次是智谱的 base 结尾是 `/v4`，**同一个坑的变体又来一次**。

---

## 三层嵌套关系

把前面的东西串起来，从上到下是这样：

```
协议（JSON 长什么形状）
  messages 怎么组织、tools 怎么声明、流式事件什么结构
      ↓ 挂载在
端点（URL 路径）
  /v1/chat/completions  ·  /v1/messages  ·  /v1/responses
      ↓ 拼接靠
base_url + path
  这一步拼错 = 404，且配置全对也救不了
```

---

## 排查口诀

| 症状 | 先查哪一层 | 典型原因 |
|---|---|---|
| **404** 找不到 | 端点 | 地址拼错、多了或少了版本号 |
| **400** 参数非法 | 协议 | 协议选错了，字段名对不上 |
| **401 / 403** | 都不是 | 钥匙问题：没带、过期、或越权 |
| 通了但回的东西是空的 | 都不是 | 请求成功了，问题在返回格式或模型能力 |

**先分清是形状不对还是地址不对**，方向就定了。这两个方向的排查路径完全不同，猜错一次就是半天。

---

## 小结

1. **端点是地址，协议是信封格式，API 是两者的合称**——404 查地址，400 查格式。
2. **OpenAI 有两代协议**（Chat Completions、Responses），**Anthropic 只有一个**（Messages），能力都做成参数。
3. **「OpenAI 兼容」= 借用 OpenAI 的信封格式、挂在自己的地址上**，是生态惯性的结果。
4. **同一家可以同时支持两种协议**——这就是协议和端点能分家的证明。
5. **拼地址时小心 base 自带的版本号**，多一个 `/v1` 就是 404，而且所有配置看上去都正常。
