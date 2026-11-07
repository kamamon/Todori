// 拡張の画面のテスト：カスタムスタート（持株会社・合同会社）、方針と人事、拠点と地図、グループ、出来事
//   node test/ui_ext.js [--shots] [--mobile]
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
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 4).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.dismiss());
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(url);
  await page.waitForTimeout(250);
  const tag = mobile ? 'm' : 'd';
  const shot = async (name, full = true) => { if (doShots) await page.screenshot({ path: `${shots}/x${tag}_${name}.png`, fullPage: full }); };
  const wait = ms => page.waitForTimeout(ms);
  const screenErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#main .callout.bad'); return e && /エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const hscroll = async where => { const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (w > 2) errors.push(`${where}: 横にはみ出し ${w}px`); };
  const click = async (sel, where) => { const b = await page.$(sel); if (!b) { errors.push(`${where || sel}: 見つからない`); return false; } await b.click(); await wait(90); return true; };
  const closeModals = async () => {
    for (let i = 0; i < 16; i++) {
      if (!(await page.$('#modal-root .modal'))) return;
      const ch = await page.$('.modal [data-act="kEvtCh"]');
      if (ch) { await ch.click(); await wait(80); continue; }
      for (const s of ['kRosaiPick', 'kRosaiNext', 'kRosaiDone']) { const b = await page.$(`.modal [data-act="${s}"]:not([disabled])`); if (b) { await b.click(); await wait(60); } }
      if (!(await page.$('#modal-root .modal'))) return;
      const b = await page.$('.modal .mf [data-act="closeModal"]');
      if (b) await b.click(); else await page.keyboard.press('Escape');
      await wait(80);
    }
  };
  const tabs = async (label, list) => { for (const t of list) { await page.click(`.tab[data-tab="${t}"]`); await wait(80); await screenErr(`${label} ${t}`); await hscroll(`${label} ${t}`); } };
  const advance = async (n, label) => {
    for (let i = 0; i < n; i++) {
      await closeModals();
      await page.click('.btn-advance'); await wait(120);
      const cf = await page.$('[data-act="kAdvanceNow"]'); if (cf) { await cf.click(); await wait(120); }
      await modalErr(`${label} month ${i}`);
      // 決算整理
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

  // ===== 1) カスタムスタート：持株会社 =====
  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
  await page.fill('#kstQ', '食品スーパー'); await wait(60);
  await click('[data-act="kStPick"][data-v="食品スーパー"]', 'start pick');
  await page.fill('#kstQ', '洋食'); await wait(60);
  const add = await page.$('[data-act="kStAdd"]'); if (add) { await add.click(); await wait(60); }
  await page.evaluate(() => { const d = document.querySelector('details.custom'); if (d) d.open = true; });
  await click('[data-ch="kCuOn"]', 'custom on');
  await click('[data-act="kCuForm"][data-v="hd"]', 'form hd');
  await page.selectOption('[data-ch="kCuPref"]', '40'); await wait(80);
  await page.fill('[data-ch="kCu"][data-k="cash"]', '30000'); await page.dispatchEvent('[data-ch="kCu"][data-k="cash"]', 'change'); await wait(40);
  await hscroll('start custom');
  await shot('start_custom');
  await page.fill('#kstCeo', '山田 一郎'); await page.fill('#kstSeed', '5');
  await click('[data-act="kStart"]', 'start');
  await wait(250); await modalErr('hd intro'); await closeModals();
  let st = await page.evaluate(() => { const G = window.Toudori.G; return { co: G.coName, subs: G.group ? G.group.subs.length : 0, units: G.units.filter(u => !u.closedM).length, hq: G.loc && G.loc.hq, cash: G.bal.cash }; });
  console.log('持株会社', JSON.stringify(st));
  if (st.subs < 2) errors.push('持株会社：子会社が2社にならない');
  if (st.hq !== 40) errors.push('持株会社：本社が福岡にならない');
  await tabs('hd', ['k_dash', 'k_ops', 'k_hr', 'k_map', 'k_grow', 'k_group', 'k_law', 'k_bank', 'k_fs', 'k_books', 'k_budget']);
  await page.click('.tab[data-tab="k_ops"]'); await wait(60); await shot('hd_ops');
  await page.click('.tab[data-tab="k_group"]'); await wait(60); await shot('hd_group');
  // 子会社の画面へ
  const subId = await page.evaluate(() => window.Toudori.G.group.subs[0].id);
  await page.selectOption('[data-ch="kView"]', subId); await wait(150);
  await tabs('hd sub', ['k_dash', 'k_ops', 'k_hr', 'k_map', 'k_fs']);
  await shot('hd_sub_map');
  await page.selectOption('[data-ch="kView"]', 'root'); await wait(150);
  for (let k = 0; k < 6 && (await page.evaluate(() => window.Toudori.G.m)) < 13; k++) await advance(1, 'hd');
  await page.click('.tab[data-tab="k_group"]'); await wait(60);
  await click('[data-act="kGrpSec"][data-v="cons"]', 'cons'); await screenErr('hd cons'); await shot('hd_cons');
  st = await page.evaluate(() => ({ check: window.Toudori.check(), m: window.Toudori.G.m, cons: Object.keys(window.Toudori.G.group.cons).length }));
  console.log('持株会社 3か月後', JSON.stringify(st));
  if (st.check.length) errors.push('持株会社：整合性 ' + JSON.stringify(st.check));

  // ===== 2) カスタムスタート：合同会社・大阪・本社の土地 =====
  await page.click('[data-act="menu"]'); await page.click('[data-act="newGameConfirm"]'); await page.click('[data-act="newGameGo"]'); await wait(120);
  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
  await page.fill('#kstQ', '金属部品の切削'); await wait(60);
  const mp = await page.$('[data-act="kStPick"]'); if (mp) { await mp.click(); await wait(60); }
  await page.fill('#kstQ', '食品スーパー'); await wait(60);
  const add2 = await page.$('[data-act="kStAdd"][data-v="食品スーパー"]'); if (add2) { await add2.click(); await wait(60); }
  await page.evaluate(() => { const d = document.querySelector('details.custom'); if (d) d.open = true; });
  await click('[data-act="kCuForm"][data-v="gk"]', 'form gk');
  await page.selectOption('[data-ch="kCuPref"]', '27'); await wait(80);
  await page.evaluate(() => { const d = document.querySelector('details.custom'); if (d) d.open = true; });
  const land = await page.$('[data-ch="kCuLand"]'); if (land) { await land.click(); await wait(80); }
  await page.evaluate(() => { const d = document.querySelector('details.custom'); if (d) d.open = true; });
  await page.fill('[data-ch="kCu"][data-k="capital"]', '5000'); await page.dispatchEvent('[data-ch="kCu"][data-k="capital"]', 'change');
  await page.fill('[data-ch="kCu"][data-k="cash"]', '80000'); await page.dispatchEvent('[data-ch="kCu"][data-k="cash"]', 'change');
  await page.fill('#kstSeed', '9');
  await click('[data-act="kStart"]', 'start gk'); await wait(250); await closeModals();
  st = await page.evaluate(() => { const G = window.Toudori.G; return { co: G.coName, form: G.form, hq: G.loc.hq, lands: G.loc.lands.length, cap: G.bal.capital, cash: G.bal.cash, note: G.customNote }; });
  console.log('合同会社', JSON.stringify(st));
  if (st.form !== 'gk' || !/合同会社/.test(st.co)) errors.push('合同会社にならない');
  if (st.lands < 1) errors.push('本社の土地がない');

  // 方針と人事
  await page.click('.tab[data-tab="k_hr"]'); await wait(80);
  await click('[data-act="kCreed"][data-v="people"]', 'creed');
  for (const v of ['raise', 'dx', 'cost']) { const c = await page.$(`[data-ch="kPriChk"][value="${v}"]`); if (c) { await c.click(); await wait(60); } }
  await click('[data-act="kPriSet"]', 'pri set');
  await page.selectOption('[data-ch="kGoalAdd"]', 'es'); await wait(80);
  await click('[data-act="kGoalSet"]', 'goal set');
  await shot('hr_policy');
  await click('[data-act="kHrSec"][data-v="wf"]', 'wf');
  for (const cat of ['手当', '住宅', '食事', '資産形成・退職']) {
    await click(`[data-act="kWfCat"][data-v="${cat}"]`, 'wf cat ' + cat);
    const lv = await page.$$('[data-act="kWfSet"]');
    if (lv.length) { await lv[lv.length - 1].click(); await wait(70); }
  }
  await click('[data-act="kWfCat"][data-v="手当"]', 'wf cat');
  await shot('hr_wf');
  await click('[data-act="kHrSec"][data-v="people"]', 'people');
  const rb = await page.$('[data-act="kRaise"][data-v="2"]'); if (rb) { await rb.click(); await wait(80); await click('[data-act="kRaiseGo"]', 'raise go'); }
  await click('[data-act="kBonusLv"][data-v="1.3"]', 'bonus');
  await shot('hr_people');
  await click('[data-act="kHrSec"][data-v="cal"]', 'cal'); await shot('hr_cal');
  await screenErr('hr'); await hscroll('hr');
  const hr = await page.evaluate(() => { const H = window.Toudori.G.hr; return { creed: H.creed, pri: H.pri.list, goals: H.goals.list.length, wf: H.wf, raise: H.raiseFy }; });
  console.log('方針と人事', JSON.stringify(hr));
  if (hr.creed !== 'people' || hr.pri.length !== 3) errors.push('方針・重点が決まらない');

  // 拠点と地図
  await page.click('.tab[data-tab="k_map"]'); await wait(80);
  for (const m of ['mw', 'wage', 'risk', 'pop', 'land']) await click(`[data-act="kMapMetric"][data-v="${m}"]`, 'metric ' + m);
  await click('[data-act="kMapPref"][data-v="8"]', 'pref 8');
  await click('[data-act="kLandUse"][data-v="ind"]', 'land use');
  await page.fill('[data-ch="kLandArea"]', '3000'); await page.dispatchEvent('[data-ch="kLandArea"]', 'change'); await wait(80);
  await shot('map_jp');
  await click('[data-act="kLandBuy"]', 'land buy'); await click('[data-act="kLandBuyGo"]', 'land buy go');
  await click('[data-act="kMapPref"][data-v="13"]', 'pref 13');
  const mv = await page.$('[data-act="kMapMove"]'); if (mv) { await mv.click(); await wait(80); await click('[data-act="kMapMoveGo"]', 'move go'); }
  await click('[data-act="kMapPref"][data-v="23"]', 'pref 23');
  await click('[data-act="kMapHQ"]', 'hq'); await click('[data-act="kMapHQGo"]', 'hq go');
  await click('[data-act="kMapNewUnit"]', 'map new unit'); await modalErr('map new unit');
  await page.fill('[data-in="kNUq"]', 'ラーメン'); await wait(80);
  const tp = await page.$('[data-act="kNUPick"]'); if (tp) { await tp.click(); await wait(120); }
  await shot('map_newunit', false);
  await closeModals();
  await click('[data-act="kMapSec"][data-v="world"]', 'world');
  for (const cc of ['us', 'vn', 'de', 'jp', 'th']) await click(`[data-act="kMapCC"][data-v="${cc}"]`, 'cc ' + cc);
  await click('[data-act="kMapWMetric"][data-v="cit"]', 'wmetric');
  const ic = await page.$('[data-act="kMapIntlCC"]'); if (ic) { await ic.click(); await wait(80); }
  await shot('map_world');
  await click('[data-act="kMapSec"][data-v="land"]', 'land tab');
  const bo = await page.$('[data-act="kBldOpen"]'); if (bo) { await bo.click(); await wait(80); const k = await page.$('[data-act="kBldKind"][data-v="factory"]'); if (k) { await k.click(); await wait(60); } await shot('map_land_build'); await click('[data-act="kBldGo"]', 'build go'); }
  await shot('map_land');
  await click('[data-act="kMapSec"][data-v="risk"]', 'risk');
  await click('[data-act="kEqIns"]', 'eq ins');
  await shot('map_risk');
  await screenErr('map'); await hscroll('map');
  const mpst = await page.evaluate(() => { const L = window.Toudori.G.loc; return { hq: L.hq, lands: L.lands.map(x => [x.pref, x.use, x.area, x.bldg && x.bldg.kind]), units: L.units, eq: L.eqIns, intl: L.intlCC, check: window.Toudori.check() }; });
  console.log('拠点', JSON.stringify(mpst));
  if (mpst.hq !== 23) errors.push('本社が愛知に移らない');
  if (mpst.check.length) errors.push('拠点のあと整合性 ' + JSON.stringify(mpst.check));
  // 世界の地図から子会社をつくる画面へ
  await click('[data-act="kMapSec"][data-v="world"]', 'world2');
  await click('[data-act="kMapCC"][data-v="vn"]', 'vn');
  await click('[data-act="kMapFound"]', 'found');
  await screenErr('found from map');
  const gf = await page.evaluate(() => window.Toudori.ui().kGF && window.Toudori.ui().kGF.cc);
  if (gf !== 'vn') errors.push('地図から子会社の設立に国が渡らない');
  // 法令の画面（法改正の年表）
  await page.click('.tab[data-tab="k_law"]'); await wait(80); await screenErr('law'); await shot('law');
  // 出来事のモーダル（選択）
  await page.evaluate(() => window.Toudori.show('kEvt', { id: 'union', body: 'テストの出来事', choose: true }));
  await wait(80); await modalErr('evt'); await shot('evt', false);
  await page.keyboard.press('Escape'); await wait(60);
  if (!(await page.$('#modal-root .modal'))) errors.push('選択の出来事が閉じられてしまう');
  await click('.modal [data-act="kEvtCh"]', 'evt choose');
  await shot('evt_done', false);
  await closeModals();
  await page.evaluate(() => window.Toudori.show('kDisaster', { pref: 22, k: 'eq', loss: 12000000, ins: 0 }));
  await wait(80); await modalErr('disaster'); await shot('disaster', false); await closeModals();
  // 1年すすめる
  await advance(13, 'gk');
  await tabs('gk after', ['k_dash', 'k_hr', 'k_map', 'k_group', 'k_fs']);
  await page.click('.tab[data-tab="k_hr"]'); await wait(60); await click('[data-act="kHrSec"][data-v="policy"]', 'policy2'); await shot('hr_after');
  const fin = await page.evaluate(() => { const G = window.Toudori.G; return { m: G.m, check: window.Toudori.check(), es: G.hr.es, hist: G.hr.goalsHist.length, over: G.over }; });
  console.log('1年後', JSON.stringify(fin));
  if (fin.check.length) errors.push('1年後の整合性 ' + JSON.stringify(fin.check));
  // 保存と読み込み
  await page.click('[data-act="menu"]'); await page.click('[data-act="saveSlot"][data-slot="2"]'); await wait(300);
  await page.click('[data-act="loadSlot"][data-slot="2"]'); await wait(400);
  await tabs('reload', ['k_hr', 'k_map', 'k_group']);
  const rl = await page.evaluate(() => { const G = window.Toudori.G; return { co: G.coName, hq: G.loc.hq, hr: !!G.hr, check: window.Toudori.check() }; });
  console.log('読み込み', JSON.stringify(rl));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'エラーなし');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
