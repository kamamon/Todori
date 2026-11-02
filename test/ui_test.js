// Playwright でクリックテストとスクリーンショット
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
const months = +(process.argv[2] || 3);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(url);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/00_start.png`, fullPage: true });
  await page.fill('#stCeo', '山田 一郎');
  await page.click('[data-act="stDiff"][data-v="normal"]');
  await page.click('[data-act="startGame"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/01_intro.png` });
  await page.click('.modal .mf .btn.primary');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${shots}/02_dash.png`, fullPage: true });
  const tabs = ['loans', 'portfolio', 'city', 'rates', 'market', 'facility', 'system', 'hr', 'finance', 'audit', 'news'];
  for (const t of tabs) {
    await page.click(`.tab[data-tab="${t}"]`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/10_${t}.png`, fullPage: true });
  }
  // 融資審査：調査→承認
  await page.click('.tab[data-tab="loans"]');
  for (const k of ['bureau', 'tax', 'ar']) {
    const b = await page.$(`[data-act="invest"][data-k="${k}"]:not([disabled])`);
    if (b) { await b.click(); await page.waitForTimeout(100); }
  }
  for (const v of ['pl', 'bs', 'cf', 'ratio']) { await page.click(`[data-act="appView"][data-v="${v}"]`); await page.waitForTimeout(60); }
  await page.screenshot({ path: `${shots}/20_ringi.png`, fullPage: true });
  const amt = await page.$('input[data-in="term"][data-k="amount"]');
  if (amt) { await amt.fill('3000'); await page.waitForTimeout(100); }
  await page.click('[data-act="decide"][data-v="1"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/21_stamped.png` });
  // 財務タブ
  await page.click('.tab[data-tab="finance"]');
  for (const v of ['pl', 'monthly', 'capital', 'npl', 'history', 'journal']) { await page.click(`[data-act="finTab"][data-v="${v}"]`); await page.waitForTimeout(80); }
  await page.screenshot({ path: `${shots}/30_journal.png`, fullPage: true });
  // 与信管理：融資先の詳細
  await page.click('.tab[data-tab="portfolio"]');
  const row = await page.$('tr.click[data-act="loanOpen"]');
  if (row) { await row.click(); await page.waitForTimeout(200); await page.screenshot({ path: `${shots}/31_loan_modal.png` }); await page.keyboard.press('Escape'); }
  // 月を進める
  const seen = new Set();
  // 一括審査を試す
  await page.click('.tab[data-tab="loans"]');
  const bo = await page.$('[data-act="bulkOpen"]');
  if (bo) { await bo.click(); await page.waitForTimeout(150); await page.click('[data-act="bulkSet"][data-v="all"]'); await page.waitForTimeout(100); await page.screenshot({ path: `${shots}/22_bulk.png` }); const run = await page.$('[data-act="bulkRun"]:not([disabled])'); if (run) await run.click(); else await page.click('.modal .mf [data-act="closeModal"]'); await page.waitForTimeout(150); }
  for (let i = 0; i < months; i++) {
    await page.click('[data-act="advance"]');
    await page.waitForTimeout(120);
    for (let k = 0; k < 8; k++) {
      const go = await page.$('[data-act="advanceNow"]');
      if (go) { await go.click(); await page.waitForTimeout(120); continue; }
      const title = await page.$eval('.modal .mh h2', e => e.textContent).catch(() => null);
      if (title && !seen.has(title.replace(/\d+/g, '#'))) { seen.add(title.replace(/\d+/g, '#')); await page.screenshot({ path: `${shots}/60_modal_${seen.size}.png` }); }
      const div = await page.$('[data-act="divGo"]');
      if (div) { await div.click(); await page.waitForTimeout(100); continue; }
      const close = await page.$('.modal .mf [data-act="closeModal"]');
      if (close) { await close.click(); await page.waitForTimeout(100); continue; }
      break;
    }
    if (i === 0) await page.screenshot({ path: `${shots}/40_after1.png`, fullPage: true });
  }
  await page.screenshot({ path: `${shots}/41_dash_later.png`, fullPage: true });
  await page.click('.tab[data-tab="city"]'); await page.waitForTimeout(100);
  await page.screenshot({ path: `${shots}/42_city_later.png`, fullPage: true });
  // モバイル
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('.tab[data-tab="dash"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/50_m_dash.png`, fullPage: true });
  await page.click('.tab[data-tab="loans"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/51_m_loans.png`, fullPage: true });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log('mobile scrollWidth', sw);
  console.log('month now', await page.evaluate(() => window.Toudori.G.m), 'errors', errors.length);
  errors.slice(0, 20).forEach(e => console.log(e));
  await browser.close();
})();
