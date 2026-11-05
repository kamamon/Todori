// 行政モード（労働基準監督署・消防署）の画面を Playwright で一通り操作し、エラーがないか確かめる
//   node test/ui_gyosei.js [labor,fire] [月数] [--shots] [--mobile]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
const ags = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'labor,fire').split(',');
const months = +(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 14);
const doShots = process.argv.includes('--shots');
const mobile = process.argv.includes('--mobile');
if (!fs.existsSync(shots)) fs.mkdirSync(shots);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
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
  const shot = async (name, full = true) => { if (doShots) await page.screenshot({ path: `${shots}/g${tag}_${name}.png`, fullPage: full }); };
  const screenErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#main .callout.bad'); return e && /エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const modalName = () => page.evaluate(() => (window.Toudori && document.querySelector('#modal-root .modal') ? (document.querySelector('#modal-root .modal').getAttribute('aria-label') || '?') : ''));
  const stats = { saigai: 0, decide: 0, claims: 0, evals: 0 };
  // モーダルを処理する（災害の設問に答える・評価を閉じる）
  const handleModals = async where => {
    for (let i = 0; i < 20; i++) {
      if (!(await page.$('#modal-root .modal'))) return;
      await modalErr(where);
      if (await page.$('[data-act="gSaiPick"][data-ok="1"]:not([disabled])')) {
        stats.saigai++; await shot(`${where}_saigai`, false);
        for (let k = 0; k < 4; k++) { const b = await page.$('[data-act="gSaiPick"][data-ok="1"]:not([disabled])'); if (!b) break; await b.click(); await page.waitForTimeout(50); }
        await shot(`${where}_saigai2`, false);
        const as = await page.$('.modal .mf [data-act="gAssign"]:not([disabled])'); if (as) { await as.click(); await page.waitForTimeout(80); continue; }
      }
      const b = await page.$('.modal .mf [data-act="closeModal"]');
      if (b) { await b.click(); await page.waitForTimeout(60); } else await page.keyboard.press('Escape');
      await page.waitForTimeout(40);
    }
  };
  let first = true;
  for (const ag of ags) {
    if (await page.evaluate(() => !!window.Toudori.G)) {
      await page.click('[data-act="menu"]');
      await page.click('[data-act="newGameConfirm"]');
      await page.click('[data-act="newGameGo"]');
      await page.waitForTimeout(100);
    }
    await page.click('[data-act="stMode"][data-v="gyosei"]');
    await page.waitForTimeout(80);
    await page.click(`[data-act="gStAg"][data-v="${ag}"]`);
    await page.waitForTimeout(60);
    await shot(`${ag}_00_start`);
    await page.fill('#gstChief', '佐藤 花子');
    await page.fill('#gstSeed', '11');
    await page.click('[data-act="gStart"]');
    await page.waitForTimeout(200);
    await modalErr('intro');
    await shot(`${ag}_01_intro`, false);
    // 遊び方
    await page.click('.modal [data-act="helpSec"]');
    await page.waitForTimeout(60);
    await modalErr('help');
    await handleModals('intro');
    for (const t of ['g_dash', 'g_ents', 'g_cases', 'g_dec', 'g_stats', 'g_learn', 'g_news']) {
      await page.click(`.tab[data-tab="${t}"]`);
      await page.waitForTimeout(60);
      await screenErr(`${ag} ${t}`);
      if (first || t === 'g_ents') await shot(`${ag}_${t}`);
    }
    for (let k = 0; k < 4; k++) { await page.click('.tab[data-tab="g_learn"]'); const b = await page.$(`[data-act="gLearn"][data-v="${k}"]`); if (b) { await b.click(); await page.waitForTimeout(40); await screenErr(`${ag} learn ${k}`); if (first) await shot(`${ag}_learn_${k}`); } }
    // 事業場の詳細
    await page.click('.tab[data-tab="g_ents"]');
    await page.click('[data-act="gEntSort"][data-v="last"]');
    await page.click('[data-act="gEntType"][data-v="focus"]');
    await page.waitForTimeout(40);
    await page.click('[data-act="gEntType"][data-v="all"]');
    await page.click('[data-act="gEntSort"][data-v="risk"]');
    const eb = await page.$('[data-act="gEntOpen"]');
    if (eb) { await eb.click(); await page.waitForTimeout(80); await modalErr('ent'); await shot(`${ag}_ent`, false); await handleModals('ent'); }
    for (let mth = 0; mth < months; mth++) {
      // 案件に着手
      await page.click('.tab[data-tab="g_cases"]');
      for (let i = 0; i < 12; i++) { const b = await page.$('#main [data-act="gAssign"]:not([disabled])'); if (!b) break; await b.click(); await page.waitForTimeout(30); }
      // 判断
      await page.click('.tab[data-tab="g_dec"]');
      const open = await page.$('#main [data-act="gDecOpen"]');
      if (open) {
        await open.click(); await page.waitForTimeout(60);
        for (let i = 0; i < 25; i++) {
          await modalErr(`${ag} dec`);
          const isClaim = await page.$('.modal [data-act="gClaimGo"]');
          if (isClaim) { const yes = await page.$(`.modal [data-act="gClaimGo"][data-pay="${i % 2}"]`); await yes.click(); stats.claims++; }
          else {
            const ms = await page.$$('.modal [data-act="gDecide"]:not([disabled])');
            if (!ms.length) break;
            await ms[Math.min(ms.length - 1, i % 3)].click(); stats.decide++;
          }
          await page.waitForTimeout(50);
          if (first && i === 0) await shot(`${ag}_dec_result`, false);
          const nx = await page.$('.modal [data-act="gNextDec"]');
          if (!nx) break;
          await nx.click(); await page.waitForTimeout(50);
        }
        await handleModals('dec');
      }
      // 計画（リスクの高い順に2件）と啓発
      await page.click('.tab[data-tab="g_ents"]');
      for (let i = 0; i < 2; i++) { const b = await page.$('#main [data-act="gPlan"].primary:not([disabled])'); if (!b) break; await b.click(); await page.waitForTimeout(30); }
      if (mth % 3 === 0) { const c = await page.$('#main [data-act="gCamp"].primary:not([disabled])'); if (c) { await c.click(); await page.waitForTimeout(30); } }
      if (first && mth === 0) await shot(`${ag}_plan`);
      await page.click('.tab[data-tab="g_dash"]');
      await page.waitForTimeout(40);
      await screenErr(`${ag} dash m${mth}`);
      if (mth === 2) await shot(`${ag}_dash_m2`);
      // 月末
      await page.click('.btn-advance');
      await page.waitForTimeout(80);
      const cf = await page.$('[data-act="gAdvanceNow"]');
      if (cf) { await cf.click(); await page.waitForTimeout(100); }
      await modalErr(`${ag} month ${mth}`);
      if (mth === 0 || mth === 11) await shot(`${ag}_month_${mth}`, false);
      const isEval = await page.evaluate(() => !!document.querySelector('.modal .gradebig'));
      if (isEval) { stats.evals++; await shot(`${ag}_eval`, false); }
      await handleModals(`${ag}_m${mth}`);
      // 評価が後ろに並んでいた場合
      const chk = await page.evaluate(() => window.Toudori.check());
      if (chk.length) errors.push(`${ag} m${mth}: 整合性 ${JSON.stringify(chk)}`);
    }
    await page.click('.tab[data-tab="g_stats"]');
    await page.waitForTimeout(60);
    await screenErr(`${ag} stats`);
    await shot(`${ag}_stats_end`);
    const res = await page.evaluate(() => { const G = window.Toudori.G; return { m: G.m, fys: Object.values(G.fys).map(f => f.eval ? f.eval.rank + f.eval.total : '-'), quiz: G.quiz, dec: G.dec.length }; });
    console.log(ag, JSON.stringify(res), JSON.stringify(stats));
    first = false;
  }
  // 保存と読み込み
  await page.click('[data-act="menu"]');
  await page.click('[data-act="saveSlot"][data-slot="1"]');
  await page.waitForTimeout(300);
  await shot('menu', false);
  await page.click('[data-act="loadSlot"][data-slot="1"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ mode: window.Toudori.G.mode, ag: window.Toudori.G.agency, m: window.Toudori.G.m, tab: document.querySelector('.tab[aria-current="page"]').dataset.tab }));
  console.log('reload', JSON.stringify(after));
  // 開始画面に戻って、続きからが出るか
  await page.click('[data-act="menu"]');
  await page.click('[data-act="newGameConfirm"]');
  await page.click('[data-act="newGameGo"]');
  await page.waitForTimeout(100);
  const startMode = await page.evaluate(() => ({ cont: !!document.querySelector('[data-act="loadAuto"]'), on: document.querySelector('.modebtn.on').dataset.v }));
  console.log('start', JSON.stringify(startMode));
  await page.click('[data-act="help"]');
  await page.waitForTimeout(60);
  await modalErr('help start');
  await shot('help', false);
  await browser.close();
  if (errors.length) { console.log('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log('OK');
})();
