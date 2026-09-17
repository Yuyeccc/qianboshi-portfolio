// 线下展示全站巡检：headless Edge 逐页打开，检查 JS 错误 + 正文可见
// 用法：node verify_demo_all.cjs [baseUrl]
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:5173';

const ROUTES = [
  ['#/zh', '首页'],
  ['#/zh/briefs', '简报库'],
  ['#/zh/assets', '数据资产'],
  ['#/zh/decisions', '决策台'],
  ['#/zh/architecture', '技术架构'],
  ['#/zh/cognitive', '认知内核'],
  ['#/zh/discipline', '实盘纪律'],
  ['#/zh/vault', '研究档案'],
  ['#/zh/agent', '研究Agent'],
  ['#/zh/about', '关于'],
  ['#/en', 'Home(EN)'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  let bad = 0;
  for (const [route, name] of ROUTES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR:' + e.message.slice(0, 120)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE:' + m.text().slice(0, 120)); });
    try {
      await page.goto(BASE + '/' + route, { timeout: 25000, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(6000);
      const info = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        const t = (main.innerText || '').replace(/\s+/g, ' ').trim();
        return { len: t.length, head: t.slice(0, 70) };
      });
      const realErrs = errs.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
      const ok = info.len > 120 && realErrs.length === 0;
      if (!ok) bad++;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(10)} ${route.padEnd(18)} 正文${info.len}字 | ${info.head}${realErrs.length ? ' | ' + realErrs.slice(0, 2).join(' ;; ') : ''}`);
    } catch (e) {
      bad++;
      console.log(`FAIL ${name.padEnd(10)} ${route.padEnd(18)} ${e.message.slice(0, 120)}`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(bad === 0 ? '\n全站 11 条路由全部正常 ✅' : `\n有 ${bad} 条路由异常 ❌`);
  process.exit(bad === 0 ? 0 : 1);
})();
