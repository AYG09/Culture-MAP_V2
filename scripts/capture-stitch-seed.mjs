import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
  });

  await page.goto('http://127.0.0.1:5173/?skipGate=true', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.innerText.includes('워크스페이스'), { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes('Culture-MAP AI'), { timeout: 20000 });
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: 'stitch-seeds/workspace-seed-overview.png',
    fullPage: true,
  });

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) => {
      const text = (button.textContent || '').trim();
      return text.includes('AI 접기') || text.includes('AI 펼치기');
    });
    target?.click();
  });
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: 'stitch-seeds/workspace-seed-canvas-focus.png',
    fullPage: true,
  });

  await browser.close();
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});