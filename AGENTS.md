# AGENTS.md — facet 协作约定（给 AI agent）

> 人看的说明在 `README.md`，发布流程在 `docs/SOP-publish.md`。这里只写**踩过坑的硬规矩**。

## 发布：加密文档必须主动报链接（2026-09-16 立的规矩）

加密文档**不进站点公开列表**，别人既不知道它存在、也猜不到 URL。所以：

1. **发布/构建后必须主动给出链接**，不能只说「发布了」：
   - 普通文章：给阅读版 + 演讲版 + PDF 三个链接；
   - **加密文档：给「标题 + 完整 URL + 源码路径」，并说明密码来自 `DEFAULT_PASSWORD`**（CF secret / `.env`）。
     密码与链接**分开发**给客户（见 `docs/encrypted-delivery.md`）。
2. **新增加密文档必须 4 步全做**，缺一步的后果写在括号里：
   ① 写 md 到 `output/<name>.md`；② `scripts/build-site.mjs` 的 `PROTECTED` 登记；③
   **`wrangler.toml` 的 `PROTECTED_PATHS` 加上 `/<slug>`（漏这步 = 付费内容免密码公开，真发生过）**；
   ④ `scripts/notify-publish.mjs` 的 `PROTECTED_DOCS` 登记。
3. **跑 `pnpm verify:protected` 必须全绿**（配置一致 + 线上 401），它在 `deploy:protected` 里已串进流程。
4. 发布后把链接同步进 `docs/encrypted-delivery.md` 的清单 —— 那是唯一的链接台账。

## 构建 / 部署 / 推送是三件事，别混

`pnpm build:site`（只构建）→ `pnpm deploy:site`（构建 + 部署）→ `pnpm notify:publish --slug x`（只推送）。
只跑了 `notify:publish` 看到「飞书已送达」不等于上线 —— 线上可能还是旧版。

## 别碰 / 小心

- `output/*.md` 是加密文档的**唯一副本且不在 git**（`output/` 被 .gitignore 忽略）；
  不要清理 `output/`，也不要以为能从 git 恢复。构建产物 `dist-share/` 同样不入库。
- 工作区可能有别人未提交的改动：**只 `git add` 你自己的文件**，不要顺手 `git add -A`。
- 受保护路径只能用**真登记过**的 slug：死登记（如已删除的 `/case`）会让人以为有这篇文档。
