# 加密交付 · 使用文档

> Facet 加密交付：给敏感文档加**访问密码** + **IP 访问审计**。

## 什么场景用

| 场景 | 例子 |
|------|------|
| 给客户的商业方案 | 报价单、产品方案、成本拆解 |
| 内部敏感文档 | 客户情报、竞品分析 |
| 未公开资料 | 草稿、预发布内容 |
| 需要留痕的交付 | 谁看了、什么时候看的、用什么设备 |

## 快速开始

### 1. 写内容

把 markdown 放进 `output/`，例如 `output/my-doc.md`。

### 2. 登记到 build-site.mjs

编辑 `scripts/build-site.mjs`，在 `buildProtectedDocs()` 的 `PROTECTED` 数组加一行：

```js
const PROTECTED = [
  { src: "output/loan-ai-proposal-v1.md", slug: "proposal", title: "AI 智能外呼系统 · 产品方案" },
  { src: "output/ai-call-faq.md", slug: "faq", title: "AI 智能外呼 · 客户常见问题" },
  { src: "output/my-doc.md", slug: "mydoc", title: "我的文档" },  // ← 新增
];
```

### 3. 配置受保护路径

编辑 `wrangler.toml`：

```toml
[vars]
PROTECTED_PATHS = "/proposal,/faq,/mydoc"   # ← 加上 /mydoc
```

### 4. 构建 + 部署

```bash
node scripts/build-site.mjs
npx wrangler pages deploy dist-share --project-name=facet-share --branch=main
```

### 5. 访问

```
https://share.webkubor.online/mydoc/        → 阅读版（要密码）
https://share.webkubor.online/mydoc/talk    → 演讲版（要密码）
https://share.webkubor.online/mydoc/share.pdf → PDF（要密码）
```

## 配置项

### Secrets（必须用 secret 设置，不要写进 wrangler.toml）

| Secret | 用途 | 设置命令 |
|--------|------|----------|
| `DEFAULT_PASSWORD` | 受保护页面的访问密码 | `npx wrangler pages secret put DEFAULT_PASSWORD --project-name=facet-share` |
| `ADMIN_TOKEN` | 访问日志页的管理员 token | `npx wrangler pages secret put ADMIN_TOKEN --project-name=facet-share` |
| `SESSION_SECRET` | （可选）cookie 签名密钥，不设则用 DEFAULT_PASSWORD | 同上 |

### Vars（写在 wrangler.toml）

| Var | 说明 | 示例 |
|-----|------|------|
| `PROTECTED_PATHS` | 逗号分隔的受保护前缀 | `/proposal,/faq,/case` |

### KV 绑定

| Binding | 用途 |
|---------|------|
| `ACCESS_KV` | 存访问日志 |

```toml
[[kv_namespaces]]
binding = "ACCESS_KV"
id = "5c6a371238af4176936ca4778e45738a"
```

## 访问日志

访问地址：

```
https://share.webkubor.online/admin/access-log?token=<ADMIN_TOKEN>
```

**能看到什么**：

| 列 | 内容 |
|----|------|
| IP | 访问者 IP |
| 地区 | 国家代码（CF-IPCountry） |
| 设备 | macOS / Windows / iOS / Android |
| 浏览 | 页面浏览次数 |
| 登录 | 密码验证成功次数 |
| 错误 | 密码错误次数 |
| 首次 / 最近 | 时间 |
| 访问路径 | 看了哪些页面 |

**统计卡片**：独立 IP、页面浏览、登录成功、密码错误

**导出 CSV**：`?token=xxx&format=csv`

**日志保留**：90 天（KV expirationTtl）

## 诊断

```
https://share.webkubor.online/admin/diagnose?token=<ADMIN_TOKEN>
```

返回环境绑定状态：

```json
{
  "PROTECTED_PATHS": "/proposal,/faq,/case",
  "ACCESS_KV 绑定": "✅ 已绑定",
  "DEFAULT_PASSWORD": "✅ 已设置",
  "ADMIN_TOKEN": "✅ 已设置"
}
```

**任何一项 ❌ 都会导致密码保护失败**，按提示修复。

## 每路径独立密码（高级）

默认所有受保护路径共用 `DEFAULT_PASSWORD`。要给某个路径设独立密码，写 KV：

```bash
# key: pwd:/proposal   value: 该路径的密码
npx wrangler kv key put --binding=ACCESS_KV "pwd:/proposal" "独立密码" --remote
```

## 安全说明

| 项 | 实现 |
|----|------|
| **密码存储** | Cloudflare secret（加密存储，不在代码里） |
| **Session** | HMAC-SHA256 签名 cookie，7 天有效 |
| **防暴力破解** | 记录失败尝试（可人工封 IP） |
| **搜索引擎** | `X-Robots-Tag: noindex, nofollow` |
| **浏览器缓存** | `Cache-Control: private, no-cache, no-store` |
| **Cookie 安全** | `HttpOnly; Secure; SameSite=Lax` |

### 局限（要知道）

| 局限 | 说明 | 缓解 |
|------|------|------|
| **密码在服务端明文比对** | 不是 bcrypt 哈希 | 用强密码（12 位+随机） |
| **无速率限制** | 可以无限试密码 | 看日志发现异常 IP 后手动封 |
| **Session 不可撤销** | cookie 到期前一直有效（除非改密） | 改 DEFAULT_PASSWORD 会让所有旧 cookie 失效 |
| **PDF/图片无法阻止下载** | 有密码的人可以下载 | 这是"看得见"的交付，不是 DRM |

## 示例：给客户发方案

```bash
# 1. 构建
node scripts/build-site.mjs

# 2. 部署
npx wrangler pages deploy dist-share --project-name=facet-share --branch=main

# 3. 发链接 + 密码给客户
#    链接：https://share.webkubor.online/proposal/
#    密码：nEu8yT8ifMbG（微信单独发，不要跟链接一起发）

# 4. 第二天看谁访问了
#    https://share.webkubor.online/admin/access-log?token=<ADMIN_TOKEN>
```

**最佳实践**：

- 密码和链接**分开发**（微信 / 短信 / 电话）
- 密码**每 3 个月换一次**
- 不同客户用**不同路径**（`/proposal-clientA`、`/proposal-clientB`），各自独立密码
- 重要文档**先看访问日志**，再决定是否跟进催单

## 文件结构

```
facet/
├── functions/                    # Cloudflare Pages Functions
│   ├── _middleware.js            # 密码保护 + 访问记录
│   └── admin/
│       └── access-log.js         # 访问日志查看页
├── wrangler.toml                 # PROTECTED_PATHS + KV 绑定
└── scripts/build-site.mjs        # buildProtectedDocs() 构建受保护文档
```

## 故障排查

| 症状 | 原因 | 解决 |
|------|------|------|
| 受保护页面**不要求密码** | `PROTECTED_PATHS` 没配或路径不匹配 | 检查 wrangler.toml + `/admin/diagnose` |
| 输密码后 **500** | `DEFAULT_PASSWORD` secret 没设置 | `/admin/diagnose` 看状态，重新 `secret put` |
| 输密码后**无限循环** | cookie 签名失败 | 检查 `SESSION_SECRET` 或 `DEFAULT_PASSWORD` |
| **访问日志空** | KV 没绑定或写入失败 | `/admin/diagnose` 看 `ACCESS_KV` 状态 |
| 部署报 **Binding name already in use** | vars 和 secret 重名 | 从 wrangler.toml 的 vars 里删掉重名的 |
