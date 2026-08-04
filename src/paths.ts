/**
 * 项目路径定位
 * 职责：提供构建器在任意工作目录下稳定访问项目根目录的能力。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);

/** 仓库根目录。 */
export const projectRoot = path.resolve(path.dirname(currentFile), "..");
