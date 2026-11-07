// 始め方の画面の「グループの会社」のテスト：事業をいくつも加える、子会社・孫会社・ひ孫会社・関連会社（海外）・
// 事業のない中間持株会社を加える・設定を変える・外す（下の会社は上に移る）、持株会社で始めるときの事業会社の下の孫会社。
// 就任して、組織図・各社の帳簿・連結が合っているか、エラーと横のはみ出しがないかを確かめる
//   node test/ui_startgroup.js [--shots] [--mobile]
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
  const shot = async (name, full = true) => { if (doShots) await page.screenshot({ path: `${shots}/sg${tag}_${name}.png`, fullPage: full }); };
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
      await page.click('.btn-advance'); await wait(120);
      const cf = await page.$('[data-act="kAdvanceNow"]'); if (cf) { await cf.click(); await wait(120); }
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
  const grp = () => page.evaluate(() => (window.Toudori.ui().start.k.grp || []).map(e => ({ id: e.id, name: e.name, owner: e.owner, own: e.own, cc: e.cc, units: e.units.map(x => x.type) })));
  // 会社の設定のダイアログで、業種を探して加える
  const addUnit = async q => {
    await page.fill('#sgQ', q); await wait(80);
    const b = await page.$('#sgList .typeopt:not(.on)');
    if (!b) { errors.push(`業種「${q}」が見つからない`); return; }
    await b.click(); await wait(80);
  };
  const addCo = async ({ owner = 'root', name = '', own = '1', cc = null, units = [], cash = null, cond = null }) => {
    if (!(await click(`[data-act="kSgAdd"][data-owner="${owner}"]`, `add under ${owner}`))) return;
    await modalErr('add');
    if (name) await page.fill('#sgName', name);
    if (cc) { await page.selectOption('[data-ch="kSgCc"]', cc); await wait(80); }
    await click(`[data-act="kSgOwn"][data-v="${own}"]`, 'own ' + own);
    for (const q of units) await addUnit(q);
    if (cond) await click(`[data-act="kSgCond"][data-v="${cond}"]`, 'cond');
    if (cash) await page.fill('[data-ch="kSgNum"][data-k="cash"]', String(cash));
    await shot('modal_' + (name || units[0] || 'x'), false);
    await click('[data-act="kSgSave"]', 'save ' + name);
    await toastBad('加える ' + name);
  };

  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
  // 1) 事業をいくつも（上限なし）：食品スーパー＋5つ
  for (const q of ['弁当', 'ソフトウェア', 'ホテル', '介護', '印刷']) {
    await page.fill('#kstQ', q); await wait(80);
    const b = await page.$('#kstList [data-act="kStAdd"]');
    if (!b) { errors.push(`事業「${q}」を加えられない`); continue; }
    await b.click(); await wait(80);
  }
  const nUnits = await page.evaluate(() => window.Toudori.ui().start.k.units.length);
  console.log('親会社の事業', nUnits);
  if (nUnits !== 6) errors.push(`親会社の事業が6つにならない（${nUnits}）`);
  // 2) グループの会社
  await addCo({ name: '汐見フーズ', units: ['ラーメン', '洋食'], cash: 30000 });
  let g = await grp();
  const A = g.find(e => e.name === '汐見フーズ');
  if (!A || A.units.length !== 2) errors.push('子会社に事業が2つ入っていない');
  await addCo({ owner: A.id, own: '0.6', units: ['倉庫'], cond: 'good' });
  g = await grp();
  const B = g.find(e => e.owner === A.id);
  if (!B) errors.push('孫会社ができない');
  else await addCo({ owner: B.id, name: '汐見ロジ', units: ['物流'] });
  await addCo({ own: '0.4', cc: 'th', units: ['ソフトウェア'] });
  await addCo({ name: '汐見グループ' });
  g = await grp();
  const H = g.find(e => e.name === '汐見グループ');
  await addCo({ owner: H.id, own: '0.8', units: ['婦人服'] });
  g = await grp();
  console.log('グループ', JSON.stringify(g.map(e => [e.id, e.name || e.units[0], e.owner, e.own, e.cc])));
  // 関連会社・海外の会社の下には加えられない（ボタンがない）
  const affId = g.find(e => e.cc === 'th').id;
  if (await page.$(`[data-act="kSgAdd"][data-owner="${affId}"]`)) errors.push('関連会社の下に加えるボタンがある');
  // 設定：持ち主の選択肢に、自分と自分の下の会社が出ない
  await click(`[data-act="kSgEdit"][data-id="${A.id}"]`, 'edit A'); await modalErr('edit');
  const opts = await page.$$eval('[data-ch="kSgOwner"] option', os => os.map(o => o.value));
  if (opts.includes(A.id) || (B && opts.includes(B.id))) errors.push(`持ち主の選択肢に自分か下の会社がある ${opts.join(',')}`);
  await page.fill('#sgName', '汐見フードサービス'); await click('[data-act="kSgSave"]', 'save edit');
  g = await grp();
  if (!g.some(e => e.name === '汐見フードサービス')) errors.push('社名の変更が残らない');
  // 同じ社名は加えられない
  await click('[data-act="kSgAdd"][data-owner="root"]', 'dup'); await page.fill('#sgName', '汐見フードサービス株式会社'); await addUnit('介護');
  await click('[data-act="kSgSave"]', 'save dup'); await wait(80);
  const dupMsg = await page.evaluate(() => [...document.querySelectorAll('.toast.bad')].map(x => x.textContent).join(''));
  if (!/同じ社名/.test(dupMsg)) errors.push('同じ社名を止められない');
  await closeModals();
  // 中間持株会社を外すと、下の会社は親会社の直下に移る
  const kidOfH = g.find(e => e.owner === H.id);
  await click(`[data-act="kSgDel"][data-id="${H.id}"]`, 'del H');
  g = await grp();
  if (g.some(e => e.id === H.id) || (g.find(e => e.id === kidOfH.id) || {}).owner !== 'root') errors.push('外した会社の下の会社が上に移らない');
  await hscroll('start'); await shot('start');
  const fld = await page.$('.sgfield'); if (fld && doShots) { await fld.scrollIntoViewIfNeeded(); await fld.screenshot({ path: `${shots}/sg${tag}_tree.png` }); }
  // 3) 就任する
  await page.fill('#kstSeed', '9');
  await click('[data-act="kStart"]', 'start');
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.Toudori.G)); i++) await wait(100);
  await wait(200);
  await modalErr('intro');
  const intro = await page.evaluate(() => (document.querySelector('#modal-root .mb') || {}).textContent || '');
  if (!/グループの会社/.test(intro)) errors.push('就任のあいさつにグループの会社がない');
  await closeModals();
  const st = await page.evaluate(() => {
    const G = window.Toudori.G;
    return { units: G.units.length, subs: G.group.subs.map(s => ({ n: s.name, p: s.parent || null, own: s.own, aff: s.aff, cc: s.cc, kind: s.kind, fys: Object.keys(s.st.fys).length, u: s.st.units.length })) };
  });
  console.log('就任', st.units, '事業', JSON.stringify(st.subs));
  if (st.units !== 6) errors.push('就任した会社の事業が6つでない');
  if (st.subs.length !== 5) errors.push(`グループの会社が5社でない（${st.subs.length}）`);
  if (!st.subs.some(s => s.n === '汐見ロジ株式会社' && s.p)) errors.push('ひ孫会社がない');
  if (!st.subs.some(s => s.cc === 'th' && s.aff)) errors.push('海外の関連会社がない');
  const chk = await page.evaluate(() => window.Toudori.check());
  if (chk.length) errors.push('帳簿のチェック：' + chk.slice(0, 3).join(' / '));
  await page.click('.tab[data-tab="k_group"]'); await wait(100);
  await click('[data-act="kOrgMode"][data-v="full"]', 'org full');
  await hscroll('org'); await shot('org');
  const org = await page.evaluate(() => document.querySelector('#main').textContent);
  if (!/就任の時からの/.test(org)) errors.push('組織図に「就任の時からの子会社」がない');
  // 4) 3か月（決算と連結）
  await advance(4, 'month');
  const cons = await page.evaluate(() => { const g = window.Toudori.G.group; return Object.keys(g.cons).length; });
  if (!cons) errors.push('連結決算ができていない');
  await page.click('.tab[data-tab="k_group"]'); await wait(80);
  const secs = await page.evaluate(() => [...document.querySelectorAll('[data-act="kGrpSec"]')].map(b => b.dataset.v));
  for (const s of secs) { await page.click(`[data-act="kGrpSec"][data-v="${s}"]`); await wait(100); await hscroll('group ' + s); }

  // 5) 持株会社で始める：事業会社の下に孫会社
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(url); await wait(200);
  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
  await page.fill('#kstQ', 'ラーメン'); await wait(80); await click('#kstList [data-act="kStAdd"]', 'add unit');
  await page.evaluate(() => { const k = window.Toudori.ui().start.k; k.cu = { on: true, form: 'hd', pref: 13, capital: '', cash: '', debt: '', hqLand: false, eco: 'normal', fx: 148, founded: '' }; window.Toudori.render(); });
  await wait(100);
  const uBtn = await page.$('[data-act="kSgAdd"][data-owner^="u:"]');
  if (!uBtn) errors.push('持株会社のときに事業会社の下に加えるボタンがない');
  else {
    const owner = await uBtn.getAttribute('data-owner');
    await addCo({ owner, units: ['弁当'] });
  }
  await addCo({ own: '0.2', units: ['印刷'] });
  await shot('hd_start');
  await click('[data-act="kStart"]', 'start hd');
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.Toudori.G)); i++) await wait(100);
  await wait(200); await closeModals();
  const hd = await page.evaluate(() => { const G = window.Toudori.G; return G.group.subs.map(s => ({ n: s.name, p: s.parent || null, kind: s.kind, aff: s.aff })); });
  console.log('持株会社', JSON.stringify(hd));
  if (hd.length !== 4) errors.push(`持株会社のグループが4社でない（${hd.length}）`);
  if (!hd.some(s => s.kind === 'start' && s.p)) errors.push('事業会社の下の孫会社がない');
  const chk2 = await page.evaluate(() => window.Toudori.check());
  if (chk2.length) errors.push('持株会社の帳簿のチェック：' + chk2.slice(0, 3).join(' / '));
  await advance(1, 'hd month');
  await page.click('.tab[data-tab="k_group"]'); await wait(80); await hscroll('hd org'); await shot('hd_org');
  console.log(errors.length ? `NG ${errors.length}件\n` + errors.slice(0, 20).join('\n') : 'OK');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
