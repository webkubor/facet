# 发布流程 SOP · 一篇文章 = 1 个命令

> facet 工具的使用方式：**操作步骤最少 = 好产品**。

## TL;DR

```bash
# 发一篇文章（普通文章）—— 构建部署 + 推飞书，两条命令
pnpm deploy:site
pnpm notify:publish --slug your-slug-name

# 或者一条命令搞定（deploy:protected 实际是「构建 + 部署 + 推送」三合一，
# 名字是历史遗留，普通文章一样能用）
pnpm deploy:protected --slug your-slug-name

# 发一个加密文档（带密码）
pnpm deploy:protected --slug proposal
```

> ⚠️ **`notify:publish` 只推飞书，不构建也不部署。**
> 早先这份 SOP 写的是「notify:publish = 构建 + 部署 + 推送」，与实际不符，
> 结果出现过「文章推了卡片但线上还是旧版」。2026-09-15 已按 `package.json` 实际定义修正。

---

## 流程：3 步

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | 写 markdown 到 `content/xxx.md` | 用 front matter 声明 slug/title/date/series |
| 2 | `pnpm deploy:site` | 构建 + 部署到 Cloudflare Pages |
| 3 | `pnpm notify:publish --slug xxx` | 推送飞书卡片（**不含构建部署**） |
| 4 | 飞书群里点卡片查看 | 自动跳到分享站 |

> 想一步到位就 `pnpm deploy:protected --slug xxx`（构建 + 部署 + 推送）。
> 加密文档必须用这条，因为它还要读密码环境变量。

---

## 命令速查（以 `package.json` 为准）

| 命令 | 实际做的事 |
|------|-----------|
| `pnpm build:site` | 只构建到 `dist-share/`，不部署不推送 |
| `pnpm deploy:site` | 构建 + 部署 |
| `pnpm notify:publish --slug x` | **只推送**飞书/企微 |
| `pnpm notify:dry --slug x` | 只预览推送内容，不发 |
| `pnpm deploy:protected --slug x` | 构建 + 部署 + 推送（三合一） |

**这三件事（构建 / 部署 / 推送）是分开的，别把它们当成一件事。**
最容易踩的坑：跑了 `notify:publish` 看到「✅ 飞书：已送达」就以为上线了，
其实线上还是旧版。**顺序永远是：先 `deploy:site`，再 `notify:publish`**——
反过来会让卡片里的链接指向尚未部署的内容。

---

## 详细 SOP

### 第 1 步：写文章

#### 1.1 普通文章

文件路径：`content/<slug-name>.md`

```markdown
---
title: "你的标题"
talkTitle: "演讲版用的短标题"
subtitle: "副标题（一句话说明）"
date: "2026-09-12"
author: "webkubor"
pageHeader: "Header 上显示的小字"
pageFooter: "Footer 上显示的小字"
shareHeader: "分享到飞书/小红书的标题"
shareFooter: "分享时的副文本"
slug: "your-slug-name"            # ← 必须有！没有就不会发布
series: "技术交流 · 第 N 期"
site: "share.webkubor.online"
closingTitle: "收尾标题（演讲版最后一屏）"
closingNote: "收尾说明"
---

# 文章正文（用 H1 起，然后 ## H2，### H3）

## 第一个二级标题

正文段落...

### 子标题

更多内容...
```

**关键字段**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `slug` | ✅ | 没有 slug = 不会发布。URL 路径 |
| `title` | ✅ | 文章标题 |
| `date` | ✅ | YYYY-MM-DD |
| `talkTitle` | 建议 | 演讲版用的短标题 |
| `closingNote` | 建议 | 演讲版收尾 |

#### 1.2 加密文档（商业敏感）

文件路径：`output/<slug>.md`（不在 content/）

然后**登记到 2 个地方**：

```js
// scripts/build-site.mjs 的 buildProtectedDocs()
const PROTECTED = [
  { src: "output/loan-ai-proposal-v1.md", slug: "proposal", title: "..." },
  { src: "output/my-secret-doc.md", slug: "mysecret", title: "..." },  // ← 加这里
];
```

```toml
# wrangler.toml
[vars]
PROTECTED_PATHS = "/proposal,/faq,/mysecret"  # ← 加这里
```

**加密流程额外步骤**：
1. 写完 markdown 后**先设密码**
   ```bash
   echo "your-password" | npx wrangler pages secret put DEFAULT_PASSWORD --project-name=facet-share
   ```
2. 跑加密文档专用命令
   ```bash
   pnpm deploy:protected --slug mysecret
   ```

---

### 第 2 步：发布

#### 普通文章

```bash
# 预览（不发送）
pnpm notify:dry --slug your-slug

# 构建 + 部署
pnpm deploy:site

# 推送飞书（不含构建部署）
pnpm notify:publish --slug your-slug

# 最新一篇（自动找日期最大的）
pnpm notify:publish --latest
```

#### 加密文档

```bash
# 构建 + 部署 + 推送，一步到位
pnpm deploy:protected --slug proposal
```

#### 命令参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `--slug` | 文章/文档标识 | 必填 |
| `--latest` | 自动找最新 | - |
| `--to` | 推送平台（feishu/wecom）| `feishu,wecom` |
| `--password` | 覆盖默认密码 | `DEFAULT_PASSWORD` 环境变量 |
| `--dry-run` | 预览不发送 | - |

---

### 第 3 步：飞书群里看

- 普通文章 → 🟢 **青绿色卡片**（带链接 + 演讲版 + PDF）
- 加密文档 → 🔵 **蓝色卡片**（带密码 + 访问日志入口）

点卡片里的「阅读」或「打开阅读」直接看。

---

## 完整流程示例

```bash
# 1. 写文章
cat > content/my-thoughts.md << 'EOF'
---
title: "今天想到的一个事"
date: "2026-09-12"
slug: "my-thoughts"
series: "技术交流 · 第 N 期"
---
# 标题

正文...
EOF

# 2. 预览推送内容
pnpm notify:dry --slug my-thoughts

# 3. 构建 + 部署（必须先做，否则线上还是旧版）
pnpm deploy:site

# 4. 推送飞书
pnpm notify:publish --slug my-thoughts

# 5. 完成！飞书群已收到推送
```

> 第 3、4 步也可以合成一条：`pnpm deploy:protected --slug my-thoughts`。

---

## 自动生成产物

每篇文章（普通 / 加密）都会自动产出 5 个文件：

| 产物 | 文件名 | 用途 |
|------|--------|------|
| 阅读版 | `dist-share/<slug>/index.html` | 连续长文，dark mode 自适应 |
| 演讲版 | `dist-share/<slug>/talk.html` | 一屏一章节，键盘翻页 |
| PDF | `dist-share/<slug>/share.pdf` | 微信发文件 / 邮件附件 |
| 长图 | `dist-share/<slug>/share.png` | 小红书 / 朋友圈 |
| HTML 源 | `dist-share/<slug>/share.html` | facet 内部用的中间产物 |

---

## 推送通知长什么样

### 普通文章（青绿色）

```
📄 新文章 · 今天想到的一个事
系列：技术交流 · 第 N 期
摘要：正文...

链接：https://share.webkubor.online/my-thoughts/

其他格式
- 演讲版：.../talk
- PDF：.../share.pdf

[阅读]  [演讲版]
```

### 加密文档（蓝色）

```
🔒 加密文档 · 商业方案
类型：加密交付（需密码）
链接：https://share.webkubor.online/mysecret/
密码：xxx

其他格式
- 演讲版：.../mysecret/talk
- PDF：.../mysecret/share.pdf

访问日志：.../admin/access-log?token=xxx

[打开阅读]  [演讲版]
```

---

## 常见问题

### Q：slug 已经存在了怎么办？

会覆盖之前的。**注意**：会同时清空该 slug 的访问日志（如果用了加密）。

### Q：怎么修改已发布的文章？

```bash
# 1. 编辑 content/xxx.md
# 2. 构建 + 部署（让线上生效）
pnpm deploy:site
# 3. 需要的话再推一次飞书
pnpm notify:publish --slug xxx
```

### Q：期号（`series`）是自动生成的吗？

**不是。** `src/markdown.ts` 只把 front matter 里的 `series` 字符串原样读出来渲染，
`scripts/build-site.mjs` 也不会去分配号段。**期号完全靠手写**。

所以每次发新文都要自己做两件事：

1. 打开 `content/` 看一遍已有期号，确认新的号没被占用
2. 期号要和 `date` 的先后一致（列表按 `date` 倒序排，期号也应当递减）

> 2026-09-15 踩过：`qwen3-tts-pytorch-to-mlx`（09-14）和
> `good-product-less-interaction`（09-12）都被写成「第 6 期」，两篇同时在线上。
> 已按发布时间重排为第 7、8 期。
>
> 列表排序已补「同日期按期号倒序」的次序（`build-site.mjs`），
> 但**这只保证顺序稳定，不保证期号唯一**——唯一性仍然靠人。

### Q：怎么删除已发布的文章？

1. 删除 `content/xxx.md`
2. 跑 `pnpm deploy:site`（重建站点，该 slug 的目录会一起消失）

> 旧版本这里写的是手敲 `node scripts/build-site.mjs && npx wrangler pages deploy ...`，
> 已经改成直接用 `deploy:site`，避免参数抄错。

### Q：怎么不发飞书，只部署？

```bash
pnpm deploy:site    # 只构建 + 部署，不推飞书
```

### Q：文章发布了，但源码没提交，怎么办？

这是**流程漏洞，不是操作失误**——发布链路（`notify-publish.mjs`）里**完全没有 git 操作**，
它不会替你 commit。所以「线上有了、仓库里没有」会反复发生。

2026-09-15 就漏过一次：`content/qwen3-tts-pytorch-to-mlx.md` 09-14 已上线，
但源文件直到 09-15 才补提交。

**当前约定：发布完必须手动补一步**

```bash
git add content/xxx.md
git commit -m "docs(content): 第 N 期 —— 标题"
git push origin main
```

> 待办：把这一步并进发布链路（在 `notify-publish.mjs` 末尾加提交，
> 或加一条 `publish` 脚本串起 deploy + notify + commit）。
> 加之前，**每次发布后自查 `git status` 是否干净**。

### Q：飞书推失败了怎么办？

跑：
```bash
node scripts/notify-publish.mjs --slug xxx --to feishu --dry-run
```

看 dry-run 输出确认内容对，然后跑实际推送。

### Q：怎么知道谁看了我的加密文档？

```
https://share.webkubor.online/admin/access-log?token=<ADMIN_TOKEN>
```

显示：IP / 地区 / 设备 / 浏览次数 / 登录次数 / 密码错误次数 / 时间。

### Q：密码怎么告诉客户？

**密码和链接分开发**：
- 链接 → 微信 / 邮件正文
- 密码 → 短信 / 电话

**不要**在同一张卡片 / 同一条消息里。

---

## 环境要求

部署前确保：

```bash
# 1. .env 已配置
FEISHU_WEBHOOK=https://open.feishu.cn/.../hook/xxx
SITE_DOMAIN=share.webkubor.online
DEFAULT_PASSWORD=你的密码
ADMIN_TOKEN=你的admin token

# 2. wrangler.toml 已配
[vars]
PROTECTED_PATHS = "/proposal,/faq"
```

**这次 SOP 的精神**：操作步骤最少 = 用户体验最好 = 好产品。
