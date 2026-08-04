/**
 * 构建器共享类型
 * 职责：集中定义 Markdown、分页、模板和主题配置的数据结构。
 */

/** 教程元信息。 */
export interface DocumentMeta {
  title: string;
  subtitle: string;
  date: string;
  author: string;
  pageHeader: string;
  pageFooter: string;
  shareHeader: string;
  shareFooter: string;
}

/** 命令行参数。 */
export interface BuildOptions {
  input: string;
  output: string;
  template: TemplateName;
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
  | "strategy-brief";

/** 内置模板清单。 */
export const templateNames: TemplateName[] = [
  "warm-handbook",
  "wechat-magazine",
  "creator-notebook",
  "course-workbook",
  "editorial-poster",
  "research-dossier",
  "gallery-catalog",
  "strategy-brief"
];
