## 这个 PR 解决了什么

<!-- 一两句话说清场景：渲染哪类内容时碰到的痛点，或者模板 / flow 改动要解锁的能力。 -->

## 改动范围

<!-- 勾选触到的区域，方便 review。 -->

- [ ] 模板（`templates/*/print.css`）
- [ ] content flow / resume flow（`src/content-flow.ts` / `src/resume-flow.ts`）
- [ ] content 形态：talk / read
- [ ] 职业族门禁（`templates/resume-families.json`）
- [ ] 文档（README / CHANGELOG / docs/）
- [ ] CI（`.github/workflows/`）
- [ ] CLI / npm 打包
- [ ] 其它：__________

## 渲染产物（必填）

视觉改动**必须**附渲染图，否则 review 看不出来：

- [ ] PDF 渲染图：`<模板名>_<章节名>.pdf`
- [ ] 长图（如有影响）：`<模板名>_<章节名>.share.png`
- [ ] 演讲页（动 talk 时）：`<章节名>.talk.html` 或在线链接

本地复现：

```bash
pnpm install
pnpm build:example           # 或具体模板
node scripts/verify-resume.mjs output/<file>.html
```

## 视觉门禁

如果改了 `src/content-flow.ts` / `src/resume-flow.ts` / `templates/`：

- [ ] 已跑 `node scripts/verify-resume.mjs` 通过
- [ ] 已跑 `node scripts/check-talk-pagination.mjs` 通过
- [ ] 已跑 `node scripts/check-slide-overflow.mjs` 通过（动 talk 时）

如果改了 `templates/resume-families.json`：

- [ ] 已确认 `src/resume-families.ts` / `scripts/verify-resume.mjs` 同步更新（同一份真源）
- [ ] 已说明阈值变化的依据

## 备忘

- 视觉硬约束见 [README § PDF UI 硬约束](../../README.md#pdf-ui-硬约束)
- 设计规格见 [`docs/design-spec.md`](../../docs/design-spec.md)
- 简历 flow 见 [`docs/resume-workflow.md`](../../docs/resume-workflow.md)
