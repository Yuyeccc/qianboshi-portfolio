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
    const main = document.querySelector('main');
    const text = main?.innerText ?? '';
    // 统计卡片/资产卡/复盘元素数量
    const cards = main?.querySelectorAll('article').length ?? 0;
    const headings = Array.from(main?.querySelectorAll('h2') ?? []).map(h => h.innerText);
    return {
      bodyLen: text.length,
      articleCount: cards,
      h2s: headings,
      tail: text.slice(-600),
      apiState: window.__apiOk ?? 'n/a',
    };
  });
  console.log('errors:', errors);
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
})();
