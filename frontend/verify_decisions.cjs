const { chromium } = require('playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5173/zh/decisions', { timeout: 20000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  const result = await page.evaluate(() => {
    const text = document.querySelector('main')?.innerText ?? '';
    return {
      hasAssetCards: text.includes('资产卡'),
      hasReviews: text.includes('复盘闭环'),
      bodyLen: text.length,
      assetSection: text.split('资产卡')[1]?.substring(0, 350) ?? '无',
      reviewSection: text.split('复盘闭环')[1]?.substring(0, 350) ?? '无',
    };
  });
  console.log('errors:', errors);
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
})();
