// 认知内核页验证：headless Edge 打开页面，检查卡死/错误/关键元素
// 用法：node verify_cognitive.cjs [baseUrl]
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.argv[2] || 'http://localhost:5173';

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
    const main = document.querySelector('main');
    const text = main?.innerText ?? 'NO MAIN';
    const checks = {
      title: document.title,
      hasHero: text.includes('认知内核') || text.includes('Cognitive Core'),
      hasBlueprint: /19\s*\/\s*19/.test(text),
      hasTranscript: text.includes('1,364,250') || text.includes('136万'),
      hasClaims: text.includes('7,736') || text.includes('7736'),
      hasAnchored: text.includes('7,660') || text.includes('7660'),
      hasSourceLayers: /一手|primary|二手|secondary|推断|inferred/.test(text),
      hasConflicts: text.includes('465') && text.includes('119'),
      hasClaimLevels: /事实|fact|解读|interpretation|预测|forecast/.test(text),
      hasBacktest: text.includes('62.6%') || text.includes('62.6') || text.includes('backtest') || text.includes('回测'),
      hasCrowding: text.includes('463') || text.includes('零打满'),
      hasFifo: text.includes('128.91'),
      hasPermutation: text.includes('0.022') || text.includes('0.023'),
      hasOutputGate: text.includes('22/22'),
      hasHonesty: /诚实|降级|不粉饰/.test(text),
      hasComplianceNote: /不提供买卖建议|研究|research/.test(text),
      moduleCount: (text.match(/证据链|维度增补|预测约束|认知闭环|Evidence Chain|Reasoning|Forecast|Closed Loop/g) || []).length,
      cardCount: (main?.querySelectorAll('[class*="MetricCard"], [class*="metric"], [class*="card"], [class*="Card"]') || []).length,
    };
    return { ...checks, bodyTextLen: document.body.innerText.length, textHead: text.substring(0, 300) };
  }).catch(e => ({ evalError: e.message }));

  console.log(`\n=== ${url} (${Date.now() - started}ms) ===`);
  console.log('errors:', errors.length ? errors.slice(0, 5) : '无');
  if (result && result.textHead) console.log('textHead:', result.textHead.replace(/\n+/g, ' | '));
  if (result) { const { textHead, ...rest } = result; console.log('checks:', JSON.stringify(rest, null, 1)); }
  await browser.close();
  return { errors, result };
}

(async () => {
  const results = [];
  results.push(await checkPage(`${BASE}/#/zh/cognitive`));
  results.push(await checkPage(`${BASE}/#/en/cognitive`, 8000));
  const allOk = results.every(r => r.errors.length === 0 && r.result && !r.result.evalError);
  console.log('\n=== 总结 ===');
  console.log(allOk ? '✅ 全部通过' : '⚠️ 有失败项，见上');
  process.exit(allOk ? 0 : 1);
})();
