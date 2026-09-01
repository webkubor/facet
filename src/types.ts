/**
 * 构建器共享类型
 * 职责：集中定义 Markdown、分页、模板和主题配置的数据结构。
 */

/** 文档类型。 */
export type DocumentType = "tutorial" | "resume";

/** 教程 / 简历元信息。 */
export interface DocumentMeta {
  title: string;
  subtitle: string;
  date: string;
  author: string;
  documentType: DocumentType;
  pageHeader: string;
  pageFooter: string;
  shareHeader: string;
  shareFooter: string;
  role: string;
  location: string;
  contact: string;
  links: string;
  motto: string;
  /** 简历首屏头像：front matter 写仓库内相对路径，构建时内联成 data URI。 */
  avatar: string;
  /** talk 片尾：系列标识，如「AI 可读性 · 第 1 期」。空则不渲染该行。 */
  series: string;
  /** talk 片尾：讲稿归档站点，如 share.webkubor.online。空则不渲染。 */
  site: string;
  /** talk 片尾主标题。默认「聊到这里」——不用「感谢聆听」那类收束语，
   *  那会把讲者放回讲台上，与交流姿态冲突。 */
  closingTitle: string;
  /** talk 片尾副文案：一句话邀请继续交流。 */
  closingNote: string;
  /** talk 封面短标题；空时沿用文档 title。 */
  talkTitle: string;
  /** 发布 slug：有值才会被 build-site 收进 share 站，同时作为 URL 路径。
   *  没有 slug = 不发布（简历、草稿、私有内容靠这个天然排除，不用另维护一份清单）。 */
  slug: string;
  /** 优化本稿的模型名称，如 "mimo-v2.5-pro"。片尾署名用。空则不渲染。 */
  model: string;
}

/** 命令行参数。 */
export interface BuildOptions {
  input: string;
  output: string;
  outputProvided: boolean;
  template: TemplateName;
  templateProvided: boolean;
  themePath: string | undefined;
  all: boolean;
  share: boolean;
  /** 只生成演讲页（show 导向），不生成 PDF/长图。 */
  talk: boolean;
  /** 只生成阅读页（read 导向）：连续排版的网页长文，不分页、不出 PDF。 */
  read: boolean;
}

/** 用户偏好主题配置。 */
export interface ThemePreference {
  name?: string;
  colors?: Partial<Record<ThemeColorKey, string>>;
  cssVariables?: Record<string, string>;
}

/** 可直接通过 colors 快速覆写的语义色。 */
export type ThemeColorKey = "paper" | "ink" | "muted" | "faint" | "soft" | "accent" | "accent2" | "danger";

/** 内页页眉页脚配置。 */
export interface PageChrome {
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
  footerRight: string;
}

/** 目录项。 */
export interface TocItem {
  level: number;
  id: string;
  text: string;
}

/** Markdown 渲染后的章节片段。 */
export interface HtmlSection {
  id: string;
  title: string;
  html: string;
  weight: number;
  /** 打印宽度下量测出的实际像素高（简历流装箱分页用）。 */
  heightPx?: number;
}

/** 模板无关的正文分页计划。 */
export interface PlannedPage {
  role: "overview" | "lesson";
  title: string;
  sections: HtmlSection[];
  weight: number;
}

/** 构建器输出的内容 flow。 */
export interface ArticlePlan {
  introHtml: string;
  pages: PlannedPage[];
}

export type TemplateName =
  | "warm-handbook"
  | "wechat-magazine"
  | "creator-notebook"
  | "course-workbook"
  | "editorial-poster"
  | "research-dossier"
  | "gallery-catalog"
  | "strategy-brief"
  | "resume-payment-lead"
  | "resume-global-checkout"
  | "resume-ai-platform"
  | "resume-infra-builder"
  | "resume-growth-ops"
  | "resume-design-folio";

/** 知识教程模板清单。 */
export const tutorialTemplateNames: TemplateName[] = [
  "warm-handbook",
  "wechat-magazine",
  "creator-notebook",
  "course-workbook",
  "editorial-poster",
  "research-dossier",
  "gallery-catalog",
  "strategy-brief"
];

/** 简历模板清单。 */
export const resumeTemplateNames: TemplateName[] = [
  "resume-payment-lead",
  "resume-global-checkout",
  "resume-ai-platform",
  "resume-infra-builder",
  "resume-growth-ops",
  "resume-design-folio"
];

/** 全部内置模板清单。 */
export const templateNames: TemplateName[] = [...tutorialTemplateNames, ...resumeTemplateNames];

/** 判断模板是否为简历模板。 */
export function isResumeTemplate(templateName: TemplateName): boolean {
  return resumeTemplateNames.includes(templateName);
}
