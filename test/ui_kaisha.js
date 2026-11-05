// 会社経営モードの画面を Playwright で一通り操作し、エラーと帳簿の整合性を確かめる
//   node test/ui_kaisha.js [業種,業種,...] [--shots] [--mobile]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
const inds = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'ret,food,mfg,con,whl,it').split(',');
const doShots = process.argv.includes('--shots');
const mobile = process.argv.includes('--mobile');
if (!fs.existsSync(shots)) fs.mkdirSync(shots);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.dismiss());
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(url);
  await page.waitForTimeout(250);
  const tag = mobile ? 'm' : 'd';
  const shot = async (name, full = true) => { if (doShots) await page.screenshot({ path: `${shots}/k${tag}_${name}.png`, fullPage: full }); };
  const closeModals = async () => {
    for (let i = 0; i < 8; i++) {
      const name = await page.evaluate(() => (document.querySelector('#modal-root .modal') ? 1 : 0));
      if (!name) return;
      const b = await page.$('.modal .mf [data-act="closeModal"]');
      if (b) await b.click(); else await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
    }
  };
  const screenErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#main .callout.bad'); return e && /エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };

  let first = true;
  for (const ind of inds) {
    // 開始画面へ
    const inGame = await page.evaluate(() => !!window.Toudori.G);
    if (inGame) {
      await page.click('[data-act="menu"]');
      await page.click('[data-act="newGameConfirm"]');
      await page.click('[data-act="newGameGo"]');
      await page.waitForTimeout(100);
    }
    await page.click('[data-act="stMode"][data-v="kaisha"]');
    await page.waitForTimeout(80);
    await page.click(`[data-act="kStInd"][data-v="${ind}"]`);
    await page.waitForTimeout(60);
    if (first) await shot('00_start');
    await page.fill('#kstCeo', '山田 一郎');
    await page.fill('#kstSeed', '7');
    await page.click('[data-act="kStart"]');
    await page.waitForTimeout(250);
    await modalErr('intro');
    if (first) await shot('01_intro', false);
    await closeModals();
    // すべてのタブ
    for (const t of ['k_dash', 'k_ops', 'k_bank', 'k_fs', 'k_books', 'k_budget', 'k_learn', 'k_news']) {
      await page.click(`.tab[data-tab="${t}"]`);
      await page.waitForTimeout(70);
      await screenErr(`${ind} ${t}`);
      if (first || t === 'k_ops') await shot(`${ind}_${t}`);
    }
    // 決算書の各表
    await page.click('.tab[data-tab="k_fs"]');
    for (const v of ['pl', 'bs', 'cost', 'month', 'cf', 'ratio', 'tax']) {
      const b = await page.$(`[data-act="kFsView"][data-v="${v}"]`);
      if (!b) continue;
      await b.click(); await page.waitForTimeout(60);
      await screenErr(`${ind} fs ${v}`);
      if (first || v === 'cost') await shot(`${ind}_fs_${v}`);
    }
    // 帳簿の各画面
    await page.click('.tab[data-tab="k_books"]');
    for (const v of ['journal', 'ledger', 'tb', 'fixed', 'arap']) {
      await page.click(`[data-act="kBooks"][data-v="${v}"]`); await page.waitForTimeout(60);
      await screenErr(`${ind} books ${v}`);
      if (first) await shot(`books_${v}`);
    }
    // 銀行：ガイドと各表
    await page.click('.tab[data-tab="k_bank"]');
    for (const v of ['bs', 'cf', 'ratio', 'pl']) { await page.click(`[data-act="kCoView"][data-v="${v}"]`); await page.waitForTimeout(50); }
    const g = await page.$('[data-act="guideGo"]');
    if (g) { await g.click(); await page.waitForTimeout(80); }
    await screenErr(`${ind} bank`);
    if (first) await shot('bank');
    // 融資の申込
    await page.click('[data-act="kLoanNew"]');
    await page.waitForTimeout(80);
    await page.click('[data-act="kLoanEval"]');
    await page.waitForTimeout(80);
    await modalErr(`${ind} loan`);
    if (first) await shot('loan', false);
    const go = await page.$('[data-act="kLoanGo"]');
    if (go) { await go.click(); await page.waitForTimeout(100); } else await closeModals();
    // 現場の操作（つまみ・人員・設備）
    await page.click('.tab[data-tab="k_ops"]');
    const range = await page.$('input[type="range"][data-ch="kOp"]');
    if (range) { await range.evaluate(el => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(60); }
    const hire = await page.$('[data-act="kHire"][data-n="1"]');
    if (hire) { await hire.click(); await page.waitForTimeout(60); }
    const capex = await page.$('[data-act="kRetFridge"], [data-act="kFoodKitchen"], [data-act="kMfgMach"], [data-act="kWhlTruck"], [data-act="kItDev"], [data-act="kBidM"]');
    if (capex) {
      await capex.click(); await page.waitForTimeout(100);
      await modalErr(`${ind} capex`);
      if (await page.$('#modal-root .modal')) {
        await shot(`${ind}_capex`, false);
        const ev = await page.$('[data-act="kCxEval"]');
        if (ev) { await ev.click(); await page.waitForTimeout(80); }
        const gx = await page.$('[data-act="kCxGo"]:not([disabled]), [data-act="kDevGo"]');
        if (gx) { await gx.click(); await page.waitForTimeout(100); }
        await closeModals();
      }
    }
    await screenErr(`${ind} ops after`);
    // 3か月進めて決算
    for (let i = 0; i < 3; i++) {
      await page.click('.btn-advance');
      await page.waitForTimeout(120);
      const cf = await page.$('[data-act="kAdvanceNow"]');
      if (cf) { await cf.click(); await page.waitForTimeout(120); }
      await modalErr(`${ind} month ${i}`);
      if (first && i === 0) await shot('month', false);
      // 月次報告を閉じる（決算整理は閉じない）
      for (let k = 0; k < 3; k++) {
        const isClose = await page.evaluate(() => !!document.querySelector('.modal .wiz'));
        if (isClose) break;
        const b = await page.$('.modal .mf [data-act="closeModal"]');
        if (!b) break;
        await b.click(); await page.waitForTimeout(80);
      }
    }
    // 決算整理
    let guard = 0;
    while (guard++ < 12) {
      const wiz = await page.$('.modal .wiz');
      if (!wiz) break;
      await modalErr(`${ind} closing`);
      const q = await page.$('.qz-b:not([disabled])');
      if (q) { await q.click(); await page.waitForTimeout(60); }
      if (first || guard <= 2) await shot(`${ind}_close_${guard}`, false);
      // 誘惑は開くだけ
      const t = await page.$('.tempt summary');
      if (t && first) { await t.click(); await page.waitForTimeout(40); await shot(`${ind}_tempt_${guard}`, false); }
      const fin = await page.$('[data-act="kCloseFinish"]');
      if (fin) { await fin.click(); await page.waitForTimeout(150); break; }
      const nx = await page.$('[data-act="kCloseNext"]:not([disabled])');
      if (!nx) { errors.push(`${ind}: 決算整理の次へが押せない`); break; }
      await nx.click(); await page.waitForTimeout(80);
    }
    await modalErr(`${ind} result`);
    await shot(`${ind}_result`, false);
    const res = await page.evaluate(() => { const G = window.Toudori.G; return { m: G.m, closing: !!G.closing, fys: Object.keys(G.fys).length, check: window.Toudori.check(), quiz: G.quiz, grade: G.grade }; });
    if (res.closing) errors.push(`${ind}: 決算整理が終わっていない`);
    if (res.check.length) errors.push(`${ind}: 整合性 ${JSON.stringify(res.check)}`);
    await closeModals();
    // 4月：予算
    await page.click('.tab[data-tab="k_budget"]');
    await page.waitForTimeout(60);
    const inp = await page.$('input[data-in="kBudT"][data-k="gS"]');
    if (inp) { await inp.fill('5'); await page.waitForTimeout(40); }
    const ap = await page.$('[data-act="kBudApprove"]');
    if (ap) { await ap.click(); await page.waitForTimeout(60); }
    await screenErr(`${ind} budget`);
    if (first) await shot('budget');
    // さらに2か月
    for (let i = 0; i < 2; i++) {
      await page.click('.btn-advance');
      await page.waitForTimeout(100);
      const cf = await page.$('[data-act="kAdvanceNow"]');
      if (cf) { await cf.click(); await page.waitForTimeout(100); }
      await closeModals();
    }
    await page.click('.tab[data-tab="k_fs"]');
    await page.click('[data-act="kFsView"][data-v="month"]');
    await page.waitForTimeout(60);
    await screenErr(`${ind} fs month after`);
    if (first) await shot('fs_month_after');
    await page.click('.tab[data-tab="k_dash"]');
    await page.waitForTimeout(60);
    if (first) await shot('dash_after');
    const r2 = await page.evaluate(() => { const G = window.Toudori.G; return { m: G.m, check: window.Toudori.check(), over: G.over }; });
    console.log(ind, JSON.stringify(res), '→', JSON.stringify(r2));
    first = false;
  }
  // 保存と読み込み
  await page.click('[data-act="menu"]');
  await page.click('[data-act="saveSlot"][data-slot="1"]');
  await page.waitForTimeout(300);
  await shot('menu', false);
  await page.click('[data-act="loadSlot"][data-slot="1"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ mode: window.Toudori.G.mode, co: window.Toudori.G.coName }));
  console.log('reload', JSON.stringify(after));
  // 遊び方
  await page.click('[data-act="help"]');
  await page.waitForTimeout(80);
  await modalErr('help');
  await shot('help', false);
  await closeModals();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'エラーなし');
  await browser.close();
})();
