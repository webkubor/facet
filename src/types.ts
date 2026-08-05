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
  | "resume-infra-builder";

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
  "resume-infra-builder"
];

/** 全部内置模板清单。 */
export const templateNames: TemplateName[] = [...tutorialTemplateNames, ...resumeTemplateNames];

/** 判断模板是否为简历模板。 */
export function isResumeTemplate(templateName: TemplateName): boolean {
  return resumeTemplateNames.includes(templateName);
}
