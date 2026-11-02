const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto(url);
  await page.fill('#stCeo', '佐藤 花子');
  await page.fill('#stBank', 'しおさい');
  await page.click('[data-act="stDiff"][data-v="hard"]');
  await page.click('[data-act="startGame"]');
  await page.waitForTimeout(200);
  await page.click('.modal .mf .btn.primary');
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { window.Toudori.advance(); });
    await page.waitForTimeout(150);
    for (let k = 0; k < 6; k++) {
      const div = await page.$('[data-act="divGo"]'); if (div) { await div.click(); await page.waitForTimeout(80); continue; }
      const c = await page.$('.modal .mf [data-act="closeModal"]'); if (c) { await c.click(); await page.waitForTimeout(80); continue; }
      break;
    }
  }
  const m1 = await page.evaluate(() => window.Toudori.G.m);
  const bank = await page.evaluate(() => window.Toudori.G.bankName);
  await page.waitForTimeout(500); // autosave (async)
  const hasSave = await page.evaluate(() => { try { const s = localStorage.getItem('toudori.v1.auto'); return s ? s[0] + ':' + s.length : null; } catch (e) { return 'ERR ' + e.message; } });
  await page.reload();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shots}/70_start_continue.png` });
  await page.click('[data-act="loadAuto"]');
  await page.waitForTimeout(400);
  const m2 = await page.evaluate(() => window.Toudori.G && window.Toudori.G.m);
  console.log('bank', bank, 'saved month', m1, 'loaded month', m2, 'save', hasSave);
  // メニュー（スロット保存）
  await page.click('[data-act="menu"]');
  await page.click('[data-act="saveSlot"][data-slot="1"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}/71_menu.png` });
  await page.click('[data-act="theme"][data-v="dark"]');
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.click('.tab[data-tab="loans"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/72_dark_loans.png` });
  await page.click('.tab[data-tab="city"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/73_dark_city.png` });
  await page.click('.tab[data-tab="dash"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shots}/74_dark_dash.png`, fullPage: true });
  await page.click('[data-act="help"]');
  await page.click('[data-act="helpSec"][data-sec="3"]');
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${shots}/75_help.png` });
  await page.keyboard.press('Escape');
  // モバイル：一覧→詳細
  await page.click('[data-act="menu"]'); await page.click('[data-act="theme"][data-v="light"]'); await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('.tab[data-tab="loans"]');
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${shots}/76_m_list.png` });
  const card = await page.$('.appcard');
  if (card) { await card.click(); await page.waitForTimeout(150); }
  await page.screenshot({ path: `${shots}/77_m_detail.png`, fullPage: false });
  await page.click('.tab[data-tab="finance"]');
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${shots}/78_m_finance.png`, fullPage: false });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log('mobile scrollWidth', sw, 'errors', errors.length);
  errors.slice(0, 10).forEach(e => console.log(e));
  await browser.close();
})();
