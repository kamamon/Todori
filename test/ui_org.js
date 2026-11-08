// 「組織」の画面のテスト：よく使う形、ユニットをつくって事業を入れる、支店（大阪の営業部）と海外支店、
// 部の設定を変える・なくす、方針のレビュー（指摘と評価）、まとめて承認、四半期の定例会（評価と指摘）まで操作して、
// エラーと横のはみ出しがないかを確かめる
//   node test/ui_org.js [--shots] [--mobile]
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
  const shot = async (name, full = false) => { if (doShots) await page.screenshot({ path: `${shots}/org${tag}_${name}.png`, fullPage: full }); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const screenErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#app'); return e && /表示エラー/.test(e.textContent) ? e.textContent.slice(0, 200) : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const hscroll = async where => {
    const w = await page.evaluate(() => { const m = document.querySelector('#modal-root .modal'); return Math.max(document.documentElement.scrollWidth - window.innerWidth, m ? m.scrollWidth - m.clientWidth : 0); });
    if (w > 2) errors.push(`${where}: 横にはみ出し ${w}px`);
  };
  const click = async (sel, where) => { const b = await page.$(sel); if (!b) { errors.push(`${where || sel}: 見つからない`); return false; } if (await b.isDisabled()) { errors.push(`${where || sel}: 押せない`); return false; } await b.click(); await wait(110); return true; };
  const org = () => page.evaluate(() => { const G = window.Toudori.G; const O = G.org || { nodes: [], meets: [] }; return { nodes: O.nodes.map(n => ({ id: n.id, kind: n.kind, fn: n.fn, name: n.name, parent: n.parent, units: n.units.slice(), pref: n.pref, cc: n.cc, st: n.pol && n.pol.status })), meets: O.meets.map(x => ({ q: x.q, done: x.done, auto: x.auto })) }; });
  let meetSeen = 0;
  const closeModals = async () => {
    for (let i = 0; i < 20; i++) {
      if (!(await page.$('#modal-root .modal'))) return;
      await modalErr('modal');
      if (await page.$('[data-act="kDeptMeetGo"]')) {
        meetSeen++;
        await hscroll('meet');
        if (meetSeen === 1) {
          await shot('meet');
          // 1回目：1行目を厳しく評価して指摘を選ぶ
          const r = await page.$('#modal-root [data-act="kDeptMeetRate"][data-v="C"]'); if (r) { await r.click(); await wait(80); }
          const f = await page.$('#modal-root [data-ch="kDeptMeetFb"]'); if (f) { await f.selectOption('cost'); await wait(80); }
        }
        await page.click('[data-act="kDeptMeetGo"]'); await wait(120); continue;
      }
      const ch = await page.$('.modal [data-act="kEvtCh"]'); if (ch) { await ch.click(); await wait(80); continue; }
      const ra = await page.$('.modal [data-act="kRosaiAll"]'); if (ra) { await ra.click(); await wait(80); continue; }
      if (await page.$('.modal .wiz')) {
        const sk = await page.$('[data-act="kCloseSkip"]'); if (sk) { await sk.click(); await wait(200); continue; }
      }
      const b = await page.$('.modal .mf [data-act="closeModal"]');
      if (b) await b.click(); else await page.keyboard.press('Escape');
      await wait(80);
    }
  };

  // 開始：食品スーパー＋ラーメン＋金属部品
  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
  for (const q of ['ラーメン', '金属部品の切削']) { await page.fill('#kstQ', q); await wait(80); await click('#tbb-st [data-act="kStAdd"]', 'add ' + q); }
  await page.fill('#kstSeed', '5');
  await click('[data-act="kStart"]', 'start'); await wait(300);
  await closeModals();
  await page.click('.tab[data-tab="k_org"]'); await wait(150);
  await screenErr('org empty'); await hscroll('org empty'); await shot('empty', true);

  // よく使う形：事業ごとの事業部・管理の部・安全と品質
  for (const v of ['biz', 'admin', 'safe']) await click(`[data-act="kDeptTpl"][data-v="${v}"]`, 'tpl ' + v);
  let o = await org();
  if (o.nodes.length !== 3 + 3 + 2) errors.push(`よく使う形で部が${o.nodes.length}（8のはず）`);
  // ユニットをつくって、食品スーパーとラーメンを入れる
  await click('[data-act="kDeptAdd"][data-kind="bu"]', 'add bu');
  await modalErr('bu edit');
  await page.fill('#orgName', '小売・外食ユニット');
  for (let i = 0; i < 2; i++) { const cbs = await page.$$('#modal-root [data-ch="kDeptUnit"]'); if (cbs[i]) { await cbs[i].click(); await wait(120); } } // 押すたびに描き直す
  await hscroll('bu edit'); await shot('edit');
  await click('[data-act="kDeptSave"]', 'save bu');
  o = await org();
  const bu = o.nodes.find(n => n.kind === 'bu');
  if (!bu || bu.name !== '小売・外食ユニット') errors.push('ユニットの名前が入らない');
  else {
    const under = o.nodes.filter(n => n.parent === bu.id && n.fn === 'biz').length;
    if (under !== 2) errors.push(`ユニットに入れた事業の事業部がユニットの下に移らない：${under}`);
  }
  // 支店（大阪の営業部）と海外支店（ベトナムの営業部）
  for (const loc of ['p:27', 'c:vn']) {
    await click('[data-act="kDeptAdd"][data-kind="dept"]', 'add dept');
    await page.selectOption('[data-ch="kDeptFn"]', 'sales'); await wait(100);
    await page.selectOption('[data-ch="kDeptLoc"]', loc); await wait(100);
    await click('[data-act="kDeptSave"]', 'save ' + loc);
  }
  o = await org();
  if (!o.nodes.some(n => n.fn === 'sales' && +n.pref === 27 && /支店/.test(n.name))) errors.push('大阪の支店ができない');
  if (!o.nodes.some(n => n.fn === 'sales' && n.cc === 'vn')) errors.push('海外支店ができない');
  // 部の設定を変える（人数）・なくす
  const editB = await page.$('[data-act="kDeptEdit"]');
  if (editB) {
    await editB.click(); await wait(120);
    const sf = await page.$('#modal-root [data-ch="kDeptStaff"]');
    if (sf) { await sf.fill('4'); await sf.dispatchEvent('change'); await wait(80); }
    await click('[data-act="kDeptSave"]', 'save edit');
  } else errors.push('部の設定のボタンがない');
  const n0 = (await org()).nodes.length;
  const delB = await page.$$('[data-act="kDeptDel"]');
  if (delB.length) { await delB[delB.length - 1].click(); await wait(120); await click('#modal-root .mf .btn.danger, #modal-root .mf .btn.primary', 'del confirm'); }
  if ((await org()).nodes.length !== n0 - 1) errors.push('部をなくせない');
  await screenErr('org built'); await hscroll('org built'); await shot('built', true);

  // 方針のレビュー：指摘して「よい」で承認、残りはまとめて承認
  if (await click('[data-act="kDeptPol"]', 'policy')) {
    await modalErr('policy');
    const fb = await page.$('#modal-root [data-ch="kDeptPolFb"][value="basis"]'); if (fb) { await fb.click(); await wait(80); }
    await click('#modal-root [data-act="kDeptPolRate"][data-v="good"]', 'rate good');
    await hscroll('policy'); await shot('policy');
    await click('[data-act="kDeptPolGo"]', 'policy go');
  }
  await click('[data-act="kDeptApproveAll"]', 'approve all');
  o = await org();
  if (o.nodes.some(n => n.st !== 'ok')) errors.push('まとめて承認しても承認されない方針がある');

  // 6月の末まで進める（3月と6月の定例会、3月の決算）
  for (let i = 0; i < 6; i++) {
    await closeModals();
    await page.click('.btn-advance'); await wait(150);
    const cf = await page.$('[data-act="kAdvanceNow"]'); if (cf) { await cf.click(); await wait(200); }
    await modalErr('advance ' + i);
  }
  await closeModals();
  o = await org();
  if (meetSeen < 2) errors.push(`定例会のダイアログが${meetSeen}回（2回のはず）`);
  if (o.meets.length < 2 || o.meets.some(x => !x.done)) errors.push(`定例会が済んでいない：${JSON.stringify(o.meets)}`);
  await page.click('.tab[data-tab="k_org"]'); await wait(150);
  await screenErr('org after'); await hscroll('org after'); await shot('after', true);
  // 定例会の記録を開く
  const mo = await page.$('[data-act="kDeptMeetOpen"]');
  if (mo) { await mo.click(); await wait(120); await modalErr('meet record'); await hscroll('meet record'); await closeModals(); }
  const chk = await page.evaluate(() => window.Toudori.check());
  if (chk.length) errors.push('帳簿：' + chk.slice(0, 3).join(' / '));

  console.log(JSON.stringify({ mobile, nodes: o.nodes.length, meets: o.meets, errors }, null, 1));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
