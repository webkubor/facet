# 设计核心规范（Design Spec）

> 两套排版体系的单一事实源。改字号/间距前先改这里，再同步到 CSS；CSS 与本文不一致视为回归。

## 体系差异总览

| 维度 | 简历体系（resume-base） | 知识库体系（base） |
| --- | --- | --- |
| 场景 | A4 打印 + 招聘方快速扫读 | 屏读长图 + 收藏转发 |
| 密度策略 | 高密度：单页信息量优先 | 低密度：阅读舒适度优先 |
| 正文 | 12px / 1.55 | 14px / 1.75 |
| 主标题 | 35px / 1.16 | 封面 50px / 1.14 |
| 副标题 | 14px / 1.55 | 18px / 1.68 |
| 页边距 | 16 / 16 / 15 / 16 mm | 18 / 17 / 20 / 17 mm |

## 简历体系字阶（resume-base/common.css）

| 元素 | 字号 | 行高 | 字重 |
| --- | --- | --- | --- |
| 姓名 h1 | 35px | 1.16 | 850 |
| 副标题 | 14px | 1.55 | 400 |
| 摘要正文 | 12px | 1.8 | 400 |
| 页面大标题 h2 | 24px | 1.25 | — |
| 卡片标题 h3 | 15px（infra 14px） | 1.35 | — |
| 卡片内小标题 | 12px | — | accent 色 |
| 正文/列表 | 12px | 1.55 | 400 |
| 联系方式徽章 | 11px | — | 680 |
| 页眉页脚 | 10px | 1.3 | — |
| 聚焦卡描述 | 9px | 1.45 | — |
| 座右铭 | 11.5px 斜体 | — | muted 色 |
| 表格 | 10px | — | — |

间距：卡片 padding 11×13px，卡片间 gap 7px，页底 padding 15mm（含 2mm 打印安全余量）。首屏模块节奏固定为
hero → 联系方式（上边框分隔，margin-top 4mm / padding-top 3.5mm）→ 摘要 5mm → 聚焦卡 5mm → 主项目 6mm，
这串数字是首页装箱预算的一部分，改动必须重跑 `verify:resume` 确认留白仍 ≤15%。

## 简历体系组件（resume-base/common.css）

| 组件 | class | 结构约定 |
| --- | --- | --- |
| 首屏身份区 | `.resume-hero` > `.resume-identity` | 默认单栏；提供 `avatar` 时挂 `.resume-hero-with-portrait` 切两栏 |
| 头像 | `.resume-portrait` > `img` | 26×26mm 圆形，1px faint 描边 + 5px accent 环，`object-fit: cover` |
| 联系方式徽章 | `.resume-contact-row` > `span` | 独立于 hero 的一行，上边框分隔，胶囊形 |
| 摘要 | `.resume-summary` | 左侧 4px accent 竖条 |
| 聚焦卡 | `.resume-snapshot-grid` > `section` | 固定 4 张，编号圆点 + 标题 + 摘要 |
| 内容卡 | `.resume-section-card` | 卡内 h3 为业务线名，`.resume-section-body h3` 为小节名 |
| 座右铭 | `.resume-motto` | 末页右下收尾 |

头像是**可选组件**：`avatar` 只写仓库内相对路径，构建时由 `src/avatar.ts` 内联成 data URI，
读不到或类型不支持就跳过并降级为单栏 hero，不让缺图卡住构建。

## 模板变体职责（resume-*/print.css）

各模板只允许改**色板、纸面质感和 hero 排布**，不得改字阶、不得改 content flow 的页面角色：

| 模板 | 色调与纸面 | hero 版式 |
| --- | --- | --- |
| `resume-payment-lead` | 橄榄绿 / 陶土，暖纸 + 左侧色带 | 左身份 · 右圆形头像 |
| `resume-global-checkout` | 驼棕 / 灰绿，方格纸 | 左圆形头像 · 右身份（镜像） |
| `resume-ai-platform` | 青灰 / 沙色，斜切几何 + 深色顶边 | 深色 hero 条，左头像反白 · 右身份 |
| `resume-infra-builder` | 石墨 / 麦色，竖网格 + 等宽字体 | 左身份 · 右方形圆角头像 |

## 空间利用规则

- **分页由量测驱动，不是权重猜测**：构建时先把全部章节卡片放进真实模板、在 794px 打印宽度下渲染一遍，量出每张卡片的实际像素高和每页真实可用预算（首页预算 = A4 − hero/摘要/聚焦卡/座右铭；正文页预算 = A4 − 页眉/页题/页脚），再贪心装箱。没有 maxGroupWeight 这类需要手调的魔法数字。
- 座右铭（frontmatter `motto`）固定渲染在**最后一页**收尾，既是人格签名也是空间填充件。
- 装箱后每页的少量富余由装箱器计算并**按上限（56px）摊进卡片间距**（内联 row-gap 下发），呼吸感来自数字而非 CSS 布局赌运气。
- 末页允许最多 25% 留白，其余页面留白超过 15% 视为内容规划不足（补内容，而不是调参数）；卡片之间垂直空洞超过 120px 视为版式失败。
- 颜色与字体由校验门禁保障：字号对照字阶表逐项核验，关键文本 WCAG 对比度（正文 ≥4.5 / 辅助 ≥4.0 / 标题 ≥3.0），视觉重点（strong 高亮 ≥6 处、聚焦卡 =4）必须存在。

## 打印约束（血泪教训）

1. **页高判定必须用 offsetHeight**（含边框）；clientHeight 会漏掉 border-top 类装饰导致假阴性。
2. **必须在 print 媒体模拟下测量**：screen 与 print 的字体度量有 1-2px 差异，卡在 297mm 临界线上就会多出空白尾页。
3. PDF 页数以解析页树 `/Type /Pages /Count` 为准，`mdls` 有 Spotlight 缓存不可信。
4. 页面高度上限 = 297mm；内容含边框超过即溢出到下一物理页。

以上全部由 `scripts/verify-resume.mjs` 自动校验，人工只做最终美感确认。
