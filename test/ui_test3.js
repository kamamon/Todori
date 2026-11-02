const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto(url);
  await page.click('[data-act="startGame"]');
  await page.click('.modal .mf .btn.primary');
  // 20か月進める（一括審査で融資も行う）
  for (let i = 0; i < 20; i++) {
    await page.click('.tab[data-tab="loans"]');
    const bo = await page.$('[data-act="bulkOpen"]');
    if (bo) { await bo.click(); await page.click('[data-act="bulkSet"][data-v="all"]'); await page.selectOption('select[data-k="ok"]', '6'); const run = await page.$('[data-act="bulkRun"]:not([disabled])'); if (run) await run.click(); else await page.keyboard.press('Escape'); }
    await page.evaluate(() => { const T = window.Toudori; if (!T.G.pendingDividend) T.advance(); });
    for (let k = 0; k < 8; k++) {
      const div = await page.$('[data-act="divGo"]'); if (div) { await div.click(); continue; }
      const c = await page.$('.modal .mf [data-act="closeModal"]'); if (c) { await c.click(); continue; }
      break;
    }
  }
  for (const t of ['audit', 'news', 'hr', 'dash', 'portfolio']) {
    await page.click(`.tab[data-tab="${t}"]`); await page.waitForTimeout(120);
    await page.screenshot({ path: `${shots}/80_${t}.png`, fullPage: true });
  }
  await page.click('.tab[data-tab="finance"]');
  for (const v of ['pl', 'capital', 'monthly', 'history']) { await page.click(`[data-act="finTab"][data-v="${v}"]`); await page.waitForTimeout(80); await page.screenshot({ path: `${shots}/81_fin_${v}.png`, fullPage: true }); }
  console.log('month', await page.evaluate(() => window.Toudori.G.m), 'integrity', JSON.stringify(await page.evaluate(() => window.Toudori.check())), 'errors', errors.length, errors.slice(0, 5));
  await browser.close();
})();
