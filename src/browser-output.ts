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

/** 量测简历版式：打印媒体下取每页可用预算与每张章节卡片的实际像素高。 */
export async function measureResumeLayout(html: string): Promise<{
  page1Budget: number;
  bodyBudget: number;
  gap: number;
  cardHeights: number[];
}> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "networkidle" });

    return await page.evaluate(() => {
      const slots = Array.from(document.querySelectorAll('[data-measure="slot"]'));
      const cardsBox = document.querySelector('[data-measure="cards"]');
      const gap = cardsBox ? Number.parseFloat(getComputedStyle(cardsBox).rowGap) || 7 : 7;

      return {
        page1Budget: slots[0]?.clientHeight ?? 0,
        bodyBudget: slots[1]?.clientHeight ?? 0,
        gap,
        cardHeights: cardsBox
          ? Array.from(cardsBox.querySelectorAll(":scope > .resume-section-card")).map((card) => (card as HTMLElement).offsetHeight)
          : []
      };
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
