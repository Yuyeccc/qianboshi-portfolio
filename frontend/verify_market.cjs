// 简报行情区块验证：headless Edge 打开简报详情页，检查行情区块渲染
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function checkPage(url, waitMs = 9000) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const started = Date.now();
  await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(e => errors.push('GOTO: ' + e.message));
  await page.waitForTimeout(waitMs);

  const result = await page.evaluate(() => {
    const text = document.body.innerText ?? '';
    const checks = {
      hasMarketTitle: text.includes('全球市场') || text.includes('Global Markets'),
      hasIndices: (text.match(/道琼斯|纳斯达克|标普/g) || []).length,
      hasIndexPrices: (text.match(/53,277|26,180|7,674/g) || []).length,
      hasAiChips: (text.match(/NVDA|TSLA|AAPL|MSFT|AMD|META|GOOGL|AVGO|MRVL|SMCI/g) || []).length,
      hasCnIndices: (text.match(/上证指数|深证成指|创业板指/g) || []).length,
      hasProxies: (text.match(/华安黄金ETF|创新药ETF|半导体ETF/g) || []).length,
      hasDecisionTag: (text.match(/决策验证|看多|看空|待复盘|已复盘/g) || []).length,
      hasTimestamp: (text.match(/数据更新|2026\/8\/23/g) || []).length,
      hasBriefBody: text.includes('钱博士盘前简报') || text.includes('今日总览') || text.includes('大势判断'),
    };
    return { ...checks, bodyTextLen: text.length, textHead: text.substring(0, 300) };
  }).catch(e => ({ evalError: e.message }));

  console.log(`\n=== ${url} (${Date.now() - started}ms) ===`);
  console.log('errors:', errors.length ? errors.slice(0, 5) : '无');
  if (result && result.textHead) console.log('textHead:', result.textHead.replace(/\n+/g, ' | '));
  console.log('checks:', JSON.stringify(result));
  await browser.close();
  return { errors, result };
}

(async () => {
  // 简报详情页（最新日报）
  await checkPage('http://localhost:5173/zh/briefs/%E6%97%A5%E6%8A%A5_2026-08-22', 9000);
})();
