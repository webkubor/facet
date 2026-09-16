# AGENTS.md — facet 协作约定（给 AI agent）

> 人看的说明在 `README.md`。这里只写硬规矩与踩过的坑。

## 本仓是**纯工具**（2026-09-16 起）

只放：`src/`（CLI 实现）、`templates/`、`themes/`、工具脚本（`scripts/check-*` / `make-favicon` /
`serve-talk` / `verify-resume`）、工具文档（`docs/design-spec.md`、`docs/designs/`、`docs/brand/`）、
`launch-kit/`，以及 `content/example.md`、`content/resume-example.md` 两个示例（`package.json` 的 `files` 声明了它们）。

**不要往这里加文章、客户文档或站点代码**：文章与分享站（share.webkubor.online）都在**私有仓**
`~/dev/gitlab/webkubor/blog` 的 `share/` 下，那边以 git 依赖消费本仓。
放错地方的后果很实在：本仓是公开仓，客户加密文档进来就等于泄露。

## 改完必跑

```bash
pnpm check            # tsc --noEmit + 演讲分页门禁（CI 跑的就是这条）
pnpm build:cli        # 产出 dist/（CLI 入口 dist/build.js）
pnpm build:example    # 冒烟：真渲一份 PDF（要先用 pnpm setup:browsers 装 chromium）
```

## 发布（npm）

`dist/` 不入库，安装方靠 `prepare` 现场构建 —— 所以 **`prepare` 必须能跑通**：
它一旦挂（例如 TS 升级后类型错误），所有以 git 依赖装本仓的项目都会装不上。
`package.json` 的 `files` 决定包内容；新加随包资源（模板/主题/示例）记得同步进去。

## 踩过的坑

1. **TS 7 的严格性**：升级 TypeScript 后 `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`
   会让老代码报错；本地 `dist/` 是旧的所以看不出来，**CI 与安装方的 `prepare` 会先炸**。
   改动类型相关配置后必须跑一次干净的 `pnpm check`。
2. **`import.meta.env` 在 Node 里是 undefined**：单测文件只要 import 了含它的模块，
   整组测试会静默跳过（"全绿"其实一条没跑）。纯逻辑要拆到不依赖它的文件里。
3. **主题路径是按包目录解析的**（`path.resolve(projectRoot, themePath)`）：写 `themes/xxx.json`
   落在本包内，是对的；别传相对调用方的路径。
