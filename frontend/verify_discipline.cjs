// 实盘纪律页验证：headless Edge 打开页面，检查卡死/错误/关键元素/脱敏
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function checkPage(url, waitMs = 8000) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const started = Date.now();
  await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(e => errors.push('GOTO: ' + e.message));
  await page.waitForTimeout(waitMs);

  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = main?.innerText ?? 'NO MAIN';
    const checks = {
      hasTitle: text.includes('Trading Discipline') || text.includes('实盘纪律'),
      hasPrinciples: (text.match(/观点必须有来源|预测必须有时间窗口|到期后必须记录结果/g) || []).length,
      hasKpi: (text.match(/总决策|待到期|已复盘|命中|未命中/g) || []).length,
      hasFramework: (text.match(/情绪定方向|纪律定仓位|止损定退出|到期必复盘/g) || []).length,
      hasLogs: (text.match(/黄金|创新药|科技股|白酒|铝/g) || []).length,
      hasReview: (text.match(/wrong|未命中|复盘/g) || []).length,
      hasTimeline: (text.match(/2026-08-06|2026-08-11/g) || []).length,
      // 脱敏检查：出现任一敏感词即失败
      leak: (text.match(/000217|159992|成本|持仓[0-9]|100元|500元|200元|买入价|卖出价/g) || []),
    };
    return { ...checks, bodyTextLen: document.body.innerText.length, textHead: text.substring(0, 400) };
  }).catch(e => ({ evalError: e.message }));

  console.log(`\n=== ${url} (${Date.now() - started}ms) ===`);
  console.log('errors:', errors.length ? errors.slice(0, 5) : '无');
  if (result && result.textHead) console.log('textHead:', result.textHead.replace(/\n+/g, ' | '));
  console.log('checks:', JSON.stringify(result, null, 1).replace(/"textHead[^}]*/g, '"textHead":...}'));
  await browser.close();
  return { errors, result };
}

(async () => {
  await checkPage('http://localhost:5173/zh/discipline', 9000);
})();
