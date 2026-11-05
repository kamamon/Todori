// 会社経営モードのランダム操作テスト：ボタンを無作為に押し続け、エラーと帳簿の整合性を確かめる
//   node test/fuzz_kaisha.js [業種] [クリック数] [シード]
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const ind = process.argv[2] || 'ret';
const N = +(process.argv[3] || 600);
let seed = +(process.argv[4] || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const SKIP = /^(menu|newGameConfirm|newGameGo|importSave|exportSave|loadAuto|loadSlot|saveSlot|theme|stMode|kStart|kStInd|kStCond|kStTerm|help|helpSec|glossary|glossCat|term)$/;
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.dismiss());
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(url);
  await page.click('[data-act="stMode"][data-v="kaisha"]');
  await page.click(`[data-act="kStInd"][data-v="${ind}"]`);
  await page.click(`[data-act="kStCond"][data-v="${['good', 'normal', 'bad'][seed % 3]}"]`);
  await page.fill('#kstSeed', String(seed));
  await page.click('[data-act="kStart"]');
  await page.waitForTimeout(150);
  let clicks = 0, advances = 0;
  for (let i = 0; i < N; i++) {
    // ボタンの選択とクリックはページの中でまとめて行う（速くするため）
    const r = await page.evaluate(([skip, r1, r2, r3, r4, r5]) => {
      const re = new RegExp(skip);
      const vis = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const root = document.querySelector('#modal-root .modal') ? document.querySelector('#modal-root') : document;
      const cands = [...root.querySelectorAll('[data-act]:not([disabled])')].filter(el => !re.test(el.dataset.act) && vis(el));
      if (!cands.length) return { act: null };
      let el = cands[Math.floor(r1 * cands.length)];
      if (r2 < 0.08) el = cands.find(c => c.dataset.act === 'advance' || c.dataset.act === 'kAdvanceNow') || el;
      if (r3 < 0.1) { const inp = root.querySelector('input[type="number"]'); if (inp && vis(inp)) { inp.value = String(Math.floor(r4 * 5000)); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.dispatchEvent(new Event('input', { bubbles: true })); } }
      if (r3 > 0.94) { const rg = document.querySelector('#main input[type="range"]'); if (rg) { rg.value = rg.min * 1 + (rg.max - rg.min) * r5; rg.dispatchEvent(new Event('change', { bubbles: true })); } }
      const act = el.dataset.act;
      el.click();
      return { act };
    }, [SKIP.source, rnd(), rnd(), rnd(), rnd(), rnd()]);
    if (!r.act) { await page.keyboard.press('Escape'); continue; }
    clicks++;
    if (r.act === 'advance' || r.act === 'kAdvanceNow') advances++;
    if (i % 25 === 0) {
      const st = await page.evaluate(() => { const G = window.Toudori.G; return G ? { m: G.m, check: window.Toudori.check(), over: G.over && G.over.kind, closing: !!G.closing } : null; });
      if (st && st.check.length) errors.push(`整合性 ${st.m}: ${JSON.stringify(st.check)}`);
      const scr = await page.evaluate(() => { const e = document.querySelector('#main .callout.bad, #modal-root .mb'); return e && /表示エラー|画面の表示中にエラー/.test(e.textContent) ? e.textContent.slice(0, 200) : ''; });
      if (scr) errors.push('画面: ' + scr);
      if (!st || st.over) break;
    }
  }
  const fin = await page.evaluate(() => { const G = window.Toudori.G; return { m: G.m, over: G.over && G.over.kind, check: window.Toudori.check(), fys: Object.keys(G.fys).length, quiz: G.quiz }; });
  console.log(`fuzz ${ind} clicks ${clicks} advances ${advances}`, JSON.stringify(fin));
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n') : 'エラーなし');
  await browser.close();
})();
