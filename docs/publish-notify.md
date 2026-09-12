# 发布通知 · 新文章 / 加密文档推送到飞书 / 企微

> 发完文章或加密文档，把「链接（+ 密码）」推到飞书群，点开就能读。

## 它推什么

**自动识别两类内容**：

| 类型 | 判断依据 | 推送内容 | 卡片颜色 |
|------|----------|----------|----------|
| **加密文档** | slug 在 `PROTECTED_DOCS` 里 | 链接 + **密码** + 访问日志入口 | 🔵 蓝色 |
| **普通文章** | slug 在 `content/*.md` 里 | 链接 + 演讲版 + PDF（**不带密码**）| 🟢 青绿 |

**推送到哪**：`.env` 里 `FEISHU_WEBHOOK` / `WECOM_WEBHOOK` 对应的群。

## 用法

```bash
# 加密文档（带密码）
pnpm notify:publish --slug proposal

# 普通文章（不带密码）
pnpm notify:publish --slug scorecard

# 最新一篇（自动找 content/ 里日期最新的）
pnpm notify:publish --latest

# 预览不发送
pnpm notify:dry --slug proposal
```

## 为什么需要

发完新内容后要通知自己（或同事）：文章链接、加密文档的密码、访问日志入口。

手工复制粘贴容易出错（链接错、密码漏、忘发日志入口）。这个脚本一次推到飞书 + 企微。

## 依赖

用 [`im-notify-kit`](https://github.com/webkubor/im-notify-kit) 发送——它解决了飞书/企微的一个坑：

> **HTTP 200 不代表消息送达。** 机器人被移出群、被停用、触发群安全设置、关键词不匹配——两家在这些情况下**照样返回 HTTP 200**，失败信息藏在 `body.code` / `body.errcode` 里。

`im-notify-kit` 把这类判断收在一处，并返回诚实的 `ok / code / error`。

## 配置

### 1. 拿 webhook 地址

**飞书群机器人**：
```
群设置 → 群机器人 → 添加机器人 → 自定义机器人 → 复制 webhook 地址
（形如 https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx）
```

**企业微信群机器人**：
```
群设置 → 群机器人 → 添加 → 复制 webhook 地址
（形如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx）
```

### 2. 写进 .env

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/你的地址
WECOM_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key

SITE_DOMAIN=share.webkubor.online
DEFAULT_PASSWORD=你的访问密码
ADMIN_TOKEN=你的admin-token
```

## 用法

### 预览（不发送）

```bash
pnpm notify:dry
```

输出推送内容，但不实际发送——**先看文案对不对**。

### 推送到飞书 + 企微

```bash
pnpm notify:publish --slug proposal
```

### 只推飞书

```bash
pnpm notify:publish --slug proposal --to feishu
```

### 指定密码

```bash
pnpm notify:publish --slug faq --password mySecret123
```

### 一键：构建 + 部署 + 推送

```bash
pnpm deploy:protected --slug proposal
```

## 推送长什么样

**飞书**（交互卡片，蓝色主题）：

```
🔒 加密文档已上线 · AI 智能外呼系统 · 产品方案
─────────────────────────────────────
文档：AI 智能外呼系统 · 产品方案
说明：客户视角的算账版方案
链接：https://share.webkubor.online/proposal/
密码：nEu8yT8ifMbG

其他格式：
- 演讲版：https://share.webkubor.online/proposal/talk
- PDF：https://share.webkubor.online/proposal/share.pdf

访问日志：https://share.webkubor.online/admin/access-log?token=xxx

> 🔒 此文档需要密码访问。密码请与链接分开发送。

[打开文档]  [演讲版]
```

**企业微信**：自动渲染成 `template_card`（主标题 + 键值区 + 跳转按钮）。

## 输出示例

```
📤 推送到 飞书 / 企业微信 ...

  ✅ 飞书：已送达（1 次尝试）
  ✅ 企业微信：已送达（1 次尝试）

🎉 推送完成

文档链接：https://share.webkubor.online/proposal/
访问密码：nEu8yT8ifMbG

💡 提示：密码请与链接分开发送给客户。
```

失败时：

```
  ❌ 企业微信：失败 — 机器人已被移出群聊
     HTTP 200 | code 93000
     响应：{"errcode":93000,"errmsg":"invalid webhook url"}
```

**HTTP 200 但 code 非 0** —— 这正是 `im-notify-kit` 要解决的问题：只判断 `res.ok` 的代码会当成推送成功。

## 加新文档

编辑 `scripts/notify-publish.mjs` 的 `PROTECTED_DOCS`：

```js
const PROTECTED_DOCS = {
  proposal: { title: "AI 智能外呼系统 · 产品方案", desc: "客户视角的算账版方案" },
  faq: { title: "AI 智能外呼 · 客户常见问题", desc: "10 个客户最关心的问题" },
  case: { title: "客户案例", desc: "实施记录与数据" },  // ← 新增
};
```

同时要在 `scripts/build-site.mjs` 的 `PROTECTED` 数组和 `wrangler.toml` 的 `PROTECTED_PATHS` 里登记。

## 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `--slug` | 文档标识（proposal / faq / case）| `proposal` |
| `--to` | 推送平台（逗号分隔）| `feishu,wecom` |
| `--password` | 访问密码 | `DEFAULT_PASSWORD` 环境变量 |
| `--admin-token` | 日志页 token | `ADMIN_TOKEN` 环境变量 |
| `--dry-run` | 只打印不发送 | - |

## 完整发布流程

```bash
# 1. 写 markdown 到 output/
# 2. 登记到 build-site.mjs 的 PROTECTED 数组
# 3. 登记到 wrangler.toml 的 PROTECTED_PATHS
# 4. 登记到 notify-publish.mjs 的 PROTECTED_DOCS

# 5. 构建 + 部署
pnpm build:site
npx wrangler pages deploy dist-share --project-name=facet-share --branch=main

# 6. 先预览推送内容
pnpm notify:dry --slug proposal

# 7. 确认后推送
pnpm notify:publish --slug proposal
```

或者一条命令：

```bash
pnpm deploy:protected --slug proposal
```

## 故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| `FEISHU_WEBHOOK 未配置` | .env 没填 | 检查 `.env` 文件 |
| `机器人已被移出群聊` | 机器人被踢 | 重新添加机器人 |
| `HTTP 200 code 非 0` | 群安全设置 / 关键词不匹配 | 检查群机器人配置 |
| 推送成功但群里没消息 | 群机器人被静音 | 检查群设置 |
| 密码是空的 | 没传 `--password` 且环境变量没设 | 加 `--password xxx` |

## 安全

| 项 | 说明 |
|----|------|
| **webhook URL 是机密** | 泄露 = 任何人能往群里发消息。`.env` 已 gitignore |
| **密码推送策略** | 脚本默认把密码和链接**一起推**（方便内部同事）。**给客户要分开发** |
| **访问日志 token** | 推送里会带 admin token —— 只推到**内部群**，不要推给客户群 |

**建议**：给客户的推送，用 `--to` 只推内部群，然后手工把链接+密码分开发给客户。
