/**
 * Playwright 输出
 * 职责：把 HTML 渲染为 A4 PDF 和可分享长图。
 */
import { chromium } from "playwright";

/** 渲染 A4 PDF。 */
export async function renderPdf(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
  } finally {
    await browser.close();
  }
}

/** 渲染长图分享图。 */
export async function renderShareImage(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html.replace("<body ", "<body data-output=\"share\" "), { waitUntil: "networkidle" });
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: "png"
    });
  } finally {
    await browser.close();
  }
}
