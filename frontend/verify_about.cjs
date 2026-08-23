// 关于页验证：headless Edge 打开 dev server 页面，检查关键元素/反爬/无报错
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function checkPage(url, waitMs = 5000) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(e => errors.push('GOTO: ' + e.message));
  await page.waitForTimeout(waitMs);

  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = main?.innerText ?? 'NO MAIN';
    return {
      hasTitle: text.includes('关于本项目') || text.includes('About This Project'),
      hasOverview: text.includes('项目概述'),
      hasScope: (text.match(/AI 应用设计|工程开发|数据与评估/g) || []).length,
      hasStack: (text.match(/Data Acquisition|Speech & LLM|Storage & Retrieval|MCP|ECharts/g) || []).length,
      hasTradeoffs: (text.match(/为什么/g) || []).length,
      hasLimits: text.includes('项目边界') && text.includes('后续方向'),
      hasContact: text.includes('GitHub · Yuyeccc'),
      // 反爬检查：页面任何地方（含 HTML 源码）不得出现邮箱和电话
      leakEmail: document.documentElement.outerHTML.includes('1944800751@qq.com'),
      leakPhone: document.documentElement.outerHTML.includes('18835637302'),
      groupPending: text.includes('筹备中') || text.includes('Coming soon'),
      githubHref: [...document.querySelectorAll('a[href*="github.com"]')].length,
      archLink: !!document.querySelector('a[href*="architecture"]'),
    };
  });

  await browser.close();
  return { result, errors };
}

(async () => {
  for (const lang of ['zh', 'en']) {
    const url = `http://localhost:5173/#/${lang}/about`;
    const { result, errors } = await checkPage(url);
    console.log(`\n=== ${lang.toUpperCase()} ===`);
    console.log(JSON.stringify(result, null, 1));
    console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
  }
})();
