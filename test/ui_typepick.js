// 業種を選ぶ一覧（産業 → 分類 → 業種、言葉で探す）と「くわしく」のテスト。
// 開始画面・新しい事業を始める・子会社の設立・就任の時点のグループの会社の4か所で、たどる・探す・くわしく・選ぶ・戻るを確かめる。
// エラーと横のはみ出しがないか、ひらがなで探してもカタカナの業種が見つかるかも見る
//   node test/ui_typepick.js [--shots] [--mobile]
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
  const shot = async (name, full = false) => { if (doShots) await page.screenshot({ path: `${shots}/tp${tag}_${name}.png`, fullPage: full }); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const hscroll = async where => {
    const w = await page.evaluate(() => {
      const m = document.querySelector('#modal-root .modal');
      return Math.max(document.documentElement.scrollWidth - window.innerWidth, m ? m.scrollWidth - m.clientWidth : 0);
    });
    if (w > 2) errors.push(`${where}: 横にはみ出し ${w}px`);
  };
  const click = async (sel, where) => { const b = await page.$(sel); if (!b) { errors.push(`${where || sel}: 見つからない`); return false; } if (await b.isDisabled()) { errors.push(`${where || sel}: 押せない`); return false; } await b.click(); await wait(100); return true; };
  const modalName = () => page.evaluate(() => (window.Toudori.ui().modal || {}).name || null);
  const closeModals = async () => {
    for (let i = 0; i < 16; i++) {
      if (!(await page.$('#modal-root .modal'))) return;
      const ch = await page.$('.modal [data-act="kEvtCh"]'); if (ch) { await ch.click(); await wait(80); continue; }
      const b = await page.$('.modal .mf [data-act="closeModal"]');
      if (b) await b.click(); else await page.keyboard.press('Escape');
      await wait(80);
    }
  };
  const units = () => page.evaluate(() => window.Toudori.ui().start.k.units.map(x => x.type));

  // ===== 1) 開始画面：産業 → 分類 → 業種 → くわしく → この業種にする =====
  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(100);
  const nSec = await page.$$eval('#tbb-st .tb-sec', l => l.length);
  if (nSec < 15) errors.push(`産業のタイルが少ない：${nSec}`);
  await shot('st_secs', true);
  await click('#tbb-st .tb-sec[data-v="E"]', 'sector E');
  // 製造業は分類が多いので、間に業界の段がある
  const nDiv = await page.$$eval('#tbb-st [data-act="kTbDiv"]', l => l.length);
  if (nDiv < 10) errors.push(`製造業の業界が少ない：${nDiv}`);
  const divs = await page.$$eval('#tbb-st [data-act="kTbDiv"]', l => l.map(b => b.dataset.v));
  await click('#tbb-st [data-act="kTbDiv"]', 'first division');
  const nGrp = await page.$$eval('#tbb-st [data-act="kTbGrp"][data-v]:not([data-v=""])', l => l.length);
  if (nGrp < 2) errors.push(`業界の中の分類が少ない：${nGrp}`);
  await click('#tbb-st [data-act="kTbGrp"]:not([data-v=""])', 'first group');
  // 分類から一つ上（業界）に戻る → また分類へ
  await click('#tbb-st .tb-crumb [data-act="kTbGrp"][data-v=""]', 'crumb back to division');
  if (!(await page.$('#tbb-st [data-act="kTbGrp"]:not([data-v=""])'))) errors.push('くずから業界の分類の一覧に戻れない');
  await click('#tbb-st [data-act="kTbGrp"]:not([data-v=""])', 'first group again');
  const nT = await page.$$eval('#tbb-st .tbt', l => l.length);
  if (!nT) errors.push('分類の中の業種が出ない');
  await hscroll('st group');
  await shot('st_group', true);
  const first = await page.$eval('#tbb-st .tbt-main', b => b.dataset.v);
  await click('#tbb-st .tbt-main', 'open info');
  if ((await modalName()) !== 'kTypeInfo') errors.push('くわしくが開かない');
  await modalErr('info st');
  const txt = await page.$eval('#modal-root .mb', e => e.textContent);
  for (const w of ['売上の立ち方', '成功のカギ', '主なリスク', 'お金の入り方', '季節']) if (!txt.includes(w)) errors.push(`くわしくに「${w}」がない`);
  await hscroll('info st');
  await shot('st_info');
  // 同じ分類の業種へ移って、戻らずに閉じる
  const sib = await page.$('#modal-root .chips .chip');
  if (sib) { await sib.click(); await wait(100); if ((await modalName()) !== 'kTypeInfo') errors.push('同じ分類の業種のくわしくが開かない'); }
  await click('#modal-root [data-act="kTiDo"][data-how="pick"]', 'pick from info');
  if (await modalName()) errors.push('この業種にしたあとダイアログが閉じない');
  const u1 = await units();
  if (u1.length !== 1) errors.push(`この業種にする：事業の数 ${u1.length}`);
  // 2) ひらがなで探す（カタカナの業種名が見つかる）・全角英字
  await page.fill('#kstQ', 'らーめん'); await wait(100);
  const hits = await page.$$eval('#tbb-st .tbt-main', l => l.map(b => b.dataset.v));
  if (!hits.some(n => /ラーメン/.test(n))) errors.push(`「らーめん」でラーメンの業種が出ない：${hits.slice(0, 3).join('、')}`);
  await click('#tbb-st [data-act="kStAdd"]', 'add from search');
  if ((await units()).length !== 2) errors.push('検索から加えられない');
  await page.fill('#kstQ', 'ＡＩ'); await wait(100);
  if (!(await page.$('#tbb-st .tbt'))) errors.push('「ＡＩ」（全角）で見つからない');
  await page.fill('#kstQ', 'zzzzqqq'); await wait(100);
  if (!(await page.$('#tbb-st .empty'))) errors.push('見つからないときの案内がない');
  await click('#tbb-st [data-act="kTbClear"]', 'clear');
  if (!(await page.$('#tbb-st .tb-sec'))) errors.push('「産業から選ぶ」で産業のタイルに戻らない');
  // 事業の型でしぼる
  await page.selectOption('.tb[data-ctx="st"] [data-ch="kTbEng"]', 'trans'); await wait(100);
  const nSecT = await page.$$eval('#tbb-st .tb-sec', l => l.length);
  if (nSecT >= nSec) errors.push('事業の型でしぼっても産業が減らない');
  await page.selectOption('.tb[data-ctx="st"] [data-ch="kTbEng"]', ''); await wait(100);
  // 選んだ事業の名前からくわしく
  await click('.sunit .tname', 'unit name info');
  if ((await modalName()) !== 'kTypeInfo') errors.push('選んだ事業の名前からくわしくが開かない');
  await closeModals();

  // ===== 3) 就任の時点のグループの会社：探して加える → くわしく → 外す → 元のダイアログに戻る =====
  await click('[data-act="kSgAdd"][data-owner="root"]', 'sg add');
  await modalErr('sg');
  await page.fill('#sgQ', 'ホテル'); await wait(100);
  const sgv = await page.$eval('#tbb-sg .tbt-main', b => b.dataset.v).catch(() => null);
  if (!sgv) errors.push('グループの会社のダイアログで探せない');
  else {
    await click('#tbb-sg .tbt-main', 'sg toggle');
    let su = await page.evaluate(() => window.Toudori.ui().sg.e.units.map(x => x.type));
    if (!su.includes(sgv)) errors.push('グループの会社に事業を加えられない');
    await click(`#tbb-sg [data-act="kTbInfo"][data-v="${sgv}"]`, 'sg info');
    if ((await modalName()) !== 'kTypeInfo') errors.push('グループの会社のダイアログからくわしくが開かない');
    await hscroll('sg info');
    await click('#modal-root [data-act="kTiDo"]', 'sg remove from info');
    if ((await modalName()) !== 'kSg') errors.push(`くわしくから外したあと、元のダイアログに戻らない：${await modalName()}`);
    su = await page.evaluate(() => window.Toudori.ui().sg.e.units.map(x => x.type));
    if (su.includes(sgv)) errors.push('くわしくから外せない');
    if ((await page.inputValue('#sgQ')) !== 'ホテル') errors.push('戻ったときに探す言葉が消えた');
    // くわしくを開いて「戻る」
    await click(`#tbb-sg [data-act="kTbInfo"][data-v="${sgv}"]`, 'sg info 2');
    await click('#modal-root .mf [data-act="closeModal"]', 'back');
    if ((await modalName()) !== 'kSg') errors.push('「戻る」で元のダイアログに戻らない');
  }
  await shot('sg');
  await closeModals();

  // ===== 4) 就任して、新しい事業を始める =====
  await click('[data-act="kStart"]', 'start');
  await wait(300);
  await closeModals();
  await page.click('.tab[data-tab="k_ops"]'); await wait(100);
  await click('[data-act="kNewUnit"]', 'new unit');
  await modalErr('new unit');
  if (!(await page.$('#tbb-nu .tb-sec'))) errors.push('新しい事業：産業のタイルが出ない');
  await click('#tbb-nu .tb-sec[data-v="G"]', 'nu sector G');
  await click('#tbb-nu .tb-grp', 'nu group');
  await click('#tbb-nu .tbt-main', 'nu pick');
  const sel = await page.evaluate(() => (window.Toudori.ui().kNU || {}).sel);
  if (!sel) errors.push('新しい事業：選べない');
  if (!(await page.$('#modal-root .nuright .ti-3'))) errors.push('新しい事業：右に売上の立ち方などが出ない');
  await hscroll('nu');
  await shot('nu');
  await page.fill('.tb[data-ctx="nu"] .tb-q', 'データセンター'); await wait(100);
  const dc = await page.$eval('#tbb-nu .tbt-main', b => b.dataset.v).catch(() => null);
  if (!dc) errors.push('新しい事業：データセンターが見つからない');
  else {
    // 一覧で選ばずに、右の「もっとくわしく」からではなく、一覧の業種を選んでからくわしく → この業種を選ぶ
    await click(`#tbb-nu .tbt-main[data-v="${dc}"]`, 'nu pick dc');
    await click('#modal-root .nuright [data-act="kTbInfo"]', 'nu more');
    if ((await modalName()) !== 'kTypeInfo') errors.push('新しい事業：もっとくわしくが開かない');
    const sib2 = await page.$('#modal-root .chips .chip');
    let target = dc;
    if (sib2) { target = await sib2.evaluate(b => b.dataset.v); await sib2.click(); await wait(100); }
    await click('#modal-root [data-act="kTiDo"]', 'nu choose');
    if ((await modalName()) !== 'kNewUnit') errors.push(`新しい事業：選んだあと元のダイアログに戻らない：${await modalName()}`);
    const sel2 = await page.evaluate(() => (window.Toudori.ui().kNU || {}).sel);
    if (sel2 !== target) errors.push(`新しい事業：くわしくから選んだ業種にならない：${sel2} ≠ ${target}`);
  }
  await click('#modal-root [data-act="kNUGo"]', 'nu go');
  await modalErr('nu capex');
  await closeModals();

  // ===== 5) 子会社の設立：産業からたどって選ぶ・くわしく =====
  await page.click('.tab[data-tab="k_group"]'); await wait(100);
  await click('[data-act="kGrpSec"][data-v="make"]', 'make');
  await click('#tbb-gf .tb-sec[data-v="M"]', 'gf sector');
  await click('#tbb-gf .tb-grp', 'gf group');
  await click('#tbb-gf .tbt-main', 'gf pick');
  const gfT = await page.evaluate(() => (window.Toudori.ui().kGF || {}).type);
  if (!gfT) errors.push('子会社の設立：業種を選べない');
  if (!(await page.$('#tbb-gf .tbt.on'))) errors.push('子会社の設立：選んだ業種の印がない（描き直しで一覧が消えた）');
  await click('#tbb-gf [data-act="kTbInfo"]', 'gf info');
  if ((await modalName()) !== 'kTypeInfo') errors.push('子会社の設立：くわしくが開かない');
  await hscroll('gf info');
  await closeModals();
  await hscroll('gf');
  await shot('gf', true);

  console.log(JSON.stringify({ mobile, sectors: nSec, divisionsE: nDiv, groupsInDiv: nGrp, errors }, null, 1));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
