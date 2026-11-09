// 規模に上限のない会社の画面のテスト：カスタムスタートで店を10,000店にして就任し、現場の店の表（都道府県ごとのまとまり）、
// まとめて出店・まとまりの改装、人員の大きな単位のボタン、火災で休業した店の復旧、数か月の経営でエラーと横のはみ出しがないか。
// 機械20,000台の工場で、設備の表（まとめた台数）と、設備を買う画面の台数の選択も確かめる
//   node test/ui_big.js [--shots] [--mobile]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
const doShots = process.argv.includes('--shots');
const mobile = process.argv.includes('--mobile');
if (!fs.existsSync(shots)) fs.mkdirSync(shots);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.dismiss());
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto(url);
  await page.waitForTimeout(200);
  const tag = mobile ? 'm' : 'd';
  const wait = ms => page.waitForTimeout(ms);
  const shot = async (name, full = true) => { if (doShots) await page.screenshot({ path: `${shots}/big${tag}_${name}.png`, fullPage: full }); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const hscroll = async where => { const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (w > 2) errors.push(`${where}: 横にはみ出し ${w}px`); };
  const click = async (sel, where) => { const b = await page.$(sel); if (!b) { errors.push(`${where || sel}: 見つからない`); return false; } if (await b.isDisabled()) { errors.push(`${where || sel}: 押せない`); return false; } await b.click(); await wait(100); return true; };
  const toastBad = async where => { const t = await page.evaluate(() => [...document.querySelectorAll('.toast.bad')].map(x => x.textContent).join(' / ')); if (t) errors.push(`${where} のお知らせ：${t}`); };
  const closeModals = async () => {
    for (let i = 0; i < 16; i++) {
      if (!(await page.$('#modal-root .modal'))) return;
      const ch = await page.$('.modal [data-act="kEvtCh"]'); if (ch) { await ch.click(); await wait(80); continue; }
      for (const s of ['kRosaiPick', 'kRosaiNext', 'kRosaiDone']) { const b = await page.$(`.modal [data-act="${s}"]:not([disabled])`); if (b) { await b.click(); await wait(60); } }
      if (!(await page.$('#modal-root .modal'))) return;
      const b = await page.$('.modal .mf [data-act="closeModal"]');
      if (b) await b.click(); else await page.keyboard.press('Escape');
      await wait(80);
    }
  };
  const advance = async (n, label) => {
    for (let i = 0; i < n; i++) {
      await closeModals();
      await page.click('.btn-advance'); await wait(150);
      const cf = await page.$('[data-act="kAdvanceNow"]'); if (cf) { await cf.click(); await wait(150); }
      await modalErr(`${label} ${i}`);
      let guard = 0;
      while (guard++ < 14) {
        if (!(await page.$('.modal .wiz'))) break;
        const q = await page.$('.qz-b:not([disabled])'); if (q) { await q.click(); await wait(50); }
        const fin = await page.$('[data-act="kCloseFinish"]'); if (fin) { await fin.click(); await wait(150); break; }
        const nx = await page.$('[data-act="kCloseNext"]:not([disabled])'); if (!nx) { errors.push(`${label}: 決算整理の次へが押せない`); break; }
        await nx.click(); await wait(80);
      }
      await closeModals();
    }
  };
  const startWith = async (q, n, seed) => {
    await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
    if (q) { await page.fill('#kstQ', q); await wait(100); await click('#tbb-st [data-act="kStPick"]', `業種 ${q}`); await wait(80); }
    // カスタムスタートを開いて、数を入れる（上限なし）
    await page.evaluate(() => { const d = document.querySelector('details.custom'); if (d) d.open = true; });
    const inp = await page.$('[data-ch="kCuCap"][data-i="0"]');
    if (!inp) { errors.push('カスタムスタートの数の欄がない'); return null; }
    const max = await inp.getAttribute('max');
    if (max) errors.push(`数の欄に上限がある（max=${max}）`);
    await inp.fill(String(n)); await inp.press('Tab'); await wait(100);
    const v = await inp.inputValue();
    if (+v !== n) errors.push(`入れた数 ${n} が ${v} に変わった`);
    const note = await page.$eval('.cu-capnote', e => e.textContent);
    await shot(`start_${n}`);
    await page.fill('#kstSeed', String(seed));
    await click('[data-act="kStart"]', 'start');
    for (let i = 0; i < 150 && !(await page.evaluate(() => !!window.Toudori.G)); i++) await wait(100);
    await wait(250);
    await modalErr('intro');
    await closeModals();
    return note;
  };

  // 1) 食品スーパー 10,000店
  const note = await startWith(null, 10000, 3);
  if (!/上限なし/.test(note || '') || !/都道府県ごと/.test(note || '')) errors.push(`数の説明に「上限なし」「都道府県ごと」がない（${note}）`);
  let st = await page.evaluate(() => { const u = window.Toudori.G.units[0]; return { n: u.op.stores.reduce((s, x) => s + (x.k || 1), 0), rec: u.op.stores.length, eng: u.type }; });
  console.log('就任', JSON.stringify(st));
  if (st.n !== 10000) errors.push(`店の数が10,000でない（${st.n}）`);
  if (st.rec > 60) errors.push(`店の記録が多い（${st.rec}）`);
  await page.click('.tab[data-tab="k_ops"]'); await wait(150);
  let main = await page.evaluate(() => document.querySelector('#main').textContent);
  if (!/店舗（10,000店）/.test(main)) errors.push('現場に「店舗（10,000店）」がない');
  if (!/都道府県ごと/.test(main)) errors.push('現場に、まとまりで扱う説明がない');
  const tags = await page.$$eval('#main .t td .tag', els => els.map(e => e.textContent).filter(t => /店$/.test(t)));
  if (tags.length < 20) errors.push(`店のまとまりの店の数の表示が少ない（${tags.length}）`);
  const bulk = await page.$$eval('[data-act="kShopStore"]', els => els.map(e => e.textContent));
  console.log('出店のボタン', bulk.join(' / '));
  if (!bulk.some(t => /1,000店まとめて/.test(t))) errors.push('1,000店まとめて出すボタンがない');
  const hire = await page.$$eval('[data-act="kHire"]', els => els.map(e => e.textContent));
  if (!hire.some(t => /^\+10,000$|^\+1,000$/.test(t))) errors.push(`人員の大きな単位のボタンがない（${[...new Set(hire)].join(' ')}）`);
  await hscroll('ops'); await shot('ops');
  { const mt = await page.evaluate(() => { const m = document.querySelector('#modal-root .modal'); return m ? m.textContent.slice(0, 200) : ''; }); if (mt) console.log('開いている画面', mt); }
  await closeModals();
  // まとまりの改装：まとまりの店の分の費用
  await click('[data-act="kShopRenov"]', 'renov');
  await modalErr('renov');
  const rv = await page.evaluate(() => document.querySelector('#modal-root .modal').textContent);
  if (!/まとめて改装/.test(rv)) errors.push('まとまりの改装の説明がない');
  await shot('renov', false);
  await closeModals();
  // 100店をまとめて出す（お金で）
  await click('[data-act="kShopStore"][data-k="100"]', 'bulk 100');
  await modalErr('bulk');
  const bt = await page.evaluate(() => document.querySelector('#modal-root .modal').textContent);
  if (!/100店出す/.test(bt)) errors.push('100店の出店の画面の題がない');
  const go = await page.$('[data-act="kCxGo"]:not([disabled])');
  if (go) { await go.click(); await wait(150); await toastBad('100店の出店'); }
  else { await page.evaluate(() => { const G = window.Toudori.G; G.bal.cash += 1e13; }); await closeModals(); await click('[data-act="kShopStore"][data-k="100"]', 'bulk 100 again'); await click('[data-act="kCxGo"]', 'go'); }
  await closeModals();
  st = await page.evaluate(() => { const u = window.Toudori.G.units[0]; return u.op.stores.reduce((s, x) => s + (x.k || 1), 0); });
  if (st !== 10100) errors.push(`100店を出したあとの店の数が10,100でない（${st}）`);
  // 火災で休業した店（まとまりから分けた1店）の復旧
  const fid = await page.evaluate(() => {
    const G = window.Toudori.G, u = G.units[0];
    const g = u.op.stores.find(s => (s.k || 0) > 10);
    g.k -= 1;
    const one = { n: '東京駅前店', openM: 9999, renovM: g.renovM, eqM: g.eqM, pref: g.pref };
    u.op.stores.push(one);
    if (!G.law.fires) G.law.fires = [];
    G.law.fires.unshift({ id: 9001, m: G.m, b: `${u.n || 'スーパー'}・東京駅前店`, u: u.id, store: one.n, cause: '電気配線', large: true, loss: 3e7, ins: 2.7e7, death: false });
    window.Toudori.render();
    return 9001;
  });
  await page.evaluate(id => window.Toudori.show('kFire', { id }), fid); await wait(150);
  await modalErr('fire');
  await click('[data-act="kFireRebuild"]', 'rebuild');
  await modalErr('rebuild');
  const go2 = await page.$('[data-act="kCxGo"]:not([disabled])');
  if (go2) { await go2.click(); await wait(150); } else errors.push('復旧工事を実行できない');
  await closeModals();
  const re = await page.evaluate(() => { const G = window.Toudori.G; const s = G.units[0].op.stores.find(x => x.n === '東京駅前店'); return s ? s.openM - G.m : null; });
  if (re !== 2) errors.push(`復旧した店の再開が2か月後でない（${re}）`);
  // 3か月の経営（決算を含む）
  await advance(4, 'month');
  const chk = await page.evaluate(() => window.Toudori.check());
  if (chk.length) errors.push('帳簿のチェック：' + chk.slice(0, 3).join(' / '));
  for (const t of ['k_dash', 'k_ops', 'k_fs', 'k_books']) { await page.click(`.tab[data-tab="${t}"]`); await wait(120); await hscroll(t); }
  await shot('after');

  // 2) 機械 20,000台の町工場（切削）
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(url); await wait(200);
  await startWith('金属部品の切削', 20000, 5);
  st = await page.evaluate(() => { const G = window.Toudori.G, u = G.units[0]; const ms = G.assets.filter(a => a.u === u.id && a.soldM === undefined && a.acct === 'mach'); return { rec: ms.length, n: ms.reduce((s, a) => s + (a.q || 1), 0) }; });
  console.log('工場', JSON.stringify(st));
  if (st.n < 19000 || st.rec > 120) errors.push(`機械の台数・記録がおかしい（${JSON.stringify(st)}）`);
  await page.click('.tab[data-tab="k_ops"]'); await wait(150);
  const eqTags = await page.$$eval('#main .t td .tag', els => els.map(e => e.textContent).filter(t => /台$/.test(t)));
  if (!eqTags.length) errors.push('設備の表にまとめた台数の表示がない');
  await hscroll('mfg ops'); await shot('mfg');
  await click('[data-act="kEqBuyOpen"]', 'eq buy');
  await modalErr('eq buy');
  const cnts = await page.$$eval('[data-act="kEqN"]', els => els.map(e => e.textContent));
  if (!cnts.includes('1,000')) errors.push(`設備を買う台数に1,000がない（${cnts.join(' ')}）`);
  await click('[data-act="kEqN"][data-v="1000"]', 'n 1000');
  const sum1 = await page.evaluate(() => document.querySelector('#modal-root .modal').textContent);
  if (!/合計/.test(sum1)) errors.push('設備を買う画面の合計がない');
  await shot('eqbuy', false);
  await closeModals();
  await advance(2, 'mfg month');
  const chk2 = await page.evaluate(() => window.Toudori.check());
  if (chk2.length) errors.push('工場の帳簿のチェック：' + chk2.slice(0, 3).join(' / '));
  console.log(errors.length ? `NG ${errors.length}件\n` + errors.slice(0, 20).join('\n') : 'OK');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
