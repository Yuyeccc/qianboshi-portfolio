// 快速页面验证：headless Edge 打开页面，检查卡死/错误/关键元素
const { chromium } = require('playwright-core');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function checkPage(url, waitMs = 6000) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const started = Date.now();
  await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(e => errors.push('GOTO: ' + e.message));
  await page.waitForTimeout(waitMs);

  const result = await page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    text: document.querySelector('main')?.innerText?.substring(0, 800) ?? 'NO MAIN',
    canvases: document.querySelectorAll('canvas').length,
    bodyTextLen: document.body.innerText.length,
  })).catch(e => ({ evalError: e.message }));

  console.log(`\n=== ${url} (${Date.now() - started}ms) ===`);
  console.log('errors:', errors.length ? errors.slice(0, 5) : '无');
  if (result.text) {
    console.log('text:', result.text.replace(/\n+/g, ' | ').substring(0, 500));
  }
  console.log('canvases:', result.canvases, '| bodyLen:', result.bodyTextLen);
  await browser.close();
  return { errors, result };
}

(async () => {
  await checkPage('http://localhost:5173/zh/decisions', 8000);
})();
