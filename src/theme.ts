/**
 * 用户偏好主题
 * 职责：读取用户 JSON 配置，并生成安全的 CSS 变量覆写。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./paths.js";
import type { ThemeColorKey, ThemePreference } from "./types.js";
import { escapeCssComment } from "./html-utils.js";

/** 加载用户主题覆写 CSS。 */
export async function loadThemeOverride(themePath?: string): Promise<string> {
  if (!themePath) {
    return "";
  }

  const resolvedPath = path.resolve(projectRoot, themePath);
  const raw = await readFile(resolvedPath, "utf8");
  const preference = parseThemePreference(raw, resolvedPath);
  const variables = createThemeVariables(preference);

  if (variables.length === 0) {
    return "";
  }

  return [`/* User theme preference: ${escapeCssComment(preference.name ?? path.basename(themePath))} */`, ":root {", ...variables, "}"].join("\n");
}

function parseThemePreference(raw: string, sourcePath: string): ThemePreference {
  try {
    return JSON.parse(raw) as ThemePreference;
  } catch (error) {
    throw new Error(`Failed to parse theme preference "${sourcePath}": ${(error as Error).message}`);
  }
}

function createThemeVariables(preference: ThemePreference): string[] {
  const colorVariables = Object.entries(preference.colors ?? {}).map(([key, value]) =>
    createThemeVariable(toThemeColorVariable(key), value)
  );
  const customVariables = Object.entries(preference.cssVariables ?? {}).map(([key, value]) =>
    createThemeVariable(key, value)
  );

  return [...colorVariables, ...customVariables];
}

function toThemeColorVariable(key: string): string {
  const variables: Record<ThemeColorKey, string> = {
    paper: "--paper",
    ink: "--ink",
    muted: "--muted",
    faint: "--faint",
    soft: "--soft",
    accent: "--accent",
    accent2: "--accent-2",
    danger: "--danger"
  };
  const variable = variables[key as ThemeColorKey];

  if (!variable) {
    throw new Error(`Unknown theme color "${key}". Available: ${Object.keys(variables).join(", ")}`);
  }

  return variable;
}

function createThemeVariable(name: string, value: string): string {
  if (!/^--[a-z0-9-]+$/i.test(name)) {
    throw new Error(`Invalid CSS variable name "${name}". Use names like "--accent".`);
  }

  if (/[;{}<>]/.test(value)) {
    throw new Error(`Invalid CSS variable value for "${name}".`);
  }

  return `  ${name}: ${value.trim()};`;
}
