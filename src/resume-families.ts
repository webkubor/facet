/**
 * 简历职业族
 * 职责：读取 templates/resume-families.json（族的单一真源），把模板名解析成族与首页骨架。
 * 门禁阈值同源，由 scripts/verify-resume.mjs 读取同一个文件。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./paths.js";
import type { TemplateName } from "./types.js";

/** 首页骨架：决定 DOM 结构本身，不只是配色。 */
export type ResumeLayout = "stacked" | "metrics-band" | "sidebar";

interface FamiliesFile {
  families: Record<string, { label: string; layout: ResumeLayout }>;
  templates: Record<string, string>;
}

const familiesFile = JSON.parse(
  readFileSync(path.resolve(projectRoot, "templates/resume-families.json"), "utf8")
) as FamiliesFile;

/** 模板归属的职业族 id（未登记的模板按技术族处理）。 */
export function familyOf(templateName: TemplateName): string {
  return familiesFile.templates[templateName] ?? "tech";
}

/** 模板对应的首页骨架。 */
export function layoutOf(templateName: TemplateName): ResumeLayout {
  return familiesFile.families[familyOf(templateName)]?.layout ?? "stacked";
}
