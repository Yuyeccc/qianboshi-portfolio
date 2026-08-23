// 架构页验证：headless Edge 打开页面，检查卡死/错误/关键元素
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
      title: document.title,
      hasSystemArch: text.includes('System Architecture') || text.includes('系统架构'),
      hasPipeline: (text.match(/采集层|下载层|转写层|理解层|知识层|决策层|交付复盘/g) || []).length,
      hasLifecycle: text.includes('生命周期'),
      hasMcp: (text.match(/pipeline_status|queue_list|rag_stats/g) || []).length,
      hasStatus: text.includes('Scheduler') || text.includes('Last Checked'),
      hasChannels: (text.match(/钱博士直播|深研一点|趋势天哥/g) || []).length,
      hasBottom: text.includes('Architecture is useful') || text.includes('Structured opinions'),
      layerNodes: (main?.querySelectorAll('[class*="layer"], [class*="node"], [class*="Layer"], [class*="Node"]') || []).length,
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
  await checkPage('http://localhost:5173/zh/architecture', 9000);
})();
