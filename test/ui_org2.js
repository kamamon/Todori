// 組織図の折りたたみ・子会社の管轄と「運営を任せる」・成長の投資をまとめて実施する画面のテスト。
// 始め方の画面で子会社を1社つくって就任し、組織の画面で部をまとめてつくる（6つ以上は1行ずつ）→ 表示の切り替え・開く・たたむ →
// ユニットをつくって子会社を管轄に入れ、事業と子会社の運営を任せる → 管轄と経営のダイアログ（組織図・グループの画面）→
// 現場の画面の「任せています」→ 成長の画面で、すべての事業・グループ全体にまとめて投資 → 3か月進める。
// エラーと横のはみ出しがないかを見る
//   node test/ui_org2.js [--shots] [--mobile]
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
  const shot = async (name, full = false) => { if (doShots) await page.screenshot({ path: `${shots}/org2${tag}_${name}.png`, fullPage: full }); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const screenErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#app'); return e && /表示エラー/.test(e.textContent) ? e.textContent.slice(0, 200) : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const hscroll = async where => {
    const w = await page.evaluate(() => { const m = document.querySelector('#modal-root .modal'); return Math.max(document.documentElement.scrollWidth - window.innerWidth, m ? m.scrollWidth - m.clientWidth : 0); });
    if (w > 2) errors.push(`${where}: 横にはみ出し ${w}px`);
  };
  const click = async (sel, where) => { const b = await page.$(sel); if (!b) { errors.push(`${where || sel}: 見つからない`); return false; } if (await b.isDisabled()) { errors.push(`${where || sel}: 押せない`); return false; } await b.click(); await wait(110); return true; };
  const modalName = () => page.evaluate(() => (window.Toudori.ui().modal || {}).name || null);
  const st = () => page.evaluate(() => {
    const G = window.Toudori.G;
    const O = G.org || { nodes: [] };
    const subs = (G.group ? G.group.subs : []).filter(s => !s.gone).map(s => ({ id: s.id, name: s.name, auto: s.auto, orgRun: !!s.orgRun, node: (O.nodes.find(n => (n.subs || []).includes(s.id)) || {}).id || null }));
    return { nodes: O.nodes.map(n => ({ id: n.id, kind: n.kind, fn: n.fn, name: n.name, runU: !!n.runU, subs: (n.subs || []).slice() })), subs, up: Object.keys((G.grow || {}).up || {}).length, mode: (O.view || {}).mode || null };
  });
  const closeModals = async () => {
    for (let i = 0; i < 20; i++) {
      if (!(await page.$('#modal-root .modal'))) return;
      await modalErr('modal');
      if (await page.$('[data-act="kDeptMeetGo"]')) { await page.click('[data-act="kDeptMeetGo"]'); await wait(120); continue; }
      const ch = await page.$('.modal [data-act="kEvtCh"]'); if (ch) { await ch.click(); await wait(80); continue; }
      const ra = await page.$('.modal [data-act="kRosaiAll"]'); if (ra) { await ra.click(); await wait(80); continue; }
      if (await page.$('.modal .wiz')) { const sk = await page.$('[data-act="kCloseSkip"]'); if (sk) { await sk.click(); await wait(200); continue; } }
      const b = await page.$('.modal .mf [data-act="closeModal"]');
      if (b) await b.click(); else await page.keyboard.press('Escape');
      await wait(80);
    }
  };

  // ===== 始め方：3事業＋子会社1社 =====
  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
  for (const q of ['ラーメン', '金属部品の切削']) { await page.fill('#kstQ', q); await wait(80); await click('#tbb-st [data-act="kStAdd"]', 'add ' + q); }
  await click('[data-act="kSgAdd"][data-owner="root"]', 'sg add');
  await page.fill('#sgQ', 'ソフトウェア受託'); await wait(100);
  await click('#tbb-sg .tbt-main', 'sg unit');
  await click('#modal-root [data-act="kSgSave"]', 'sg save');
  await page.fill('#kstSeed', '7');
  await click('[data-act="kStart"]', 'start'); await wait(300);
  await closeModals();
  let s = await st();
  if (s.subs.length !== 1) errors.push(`子会社が1社でない：${s.subs.length}`);
  const sub = s.subs[0];

  // ===== 組織：まとめてつくる（8つ）→ はじめは1行ずつ =====
  await page.click('.tab[data-tab="k_org"]'); await wait(150);
  for (const v of ['biz', 'admin', 'safe']) await click(`[data-act="kDeptTpl"][data-v="${v}"]`, 'tpl ' + v);
  const shut = await page.$$eval('.orgtree2 .orgc.shut', l => l.length);
  if (shut < 6) errors.push(`部が多いのに1行ずつになっていない：たたんだ部 ${shut}`);
  if (!(await page.$('[data-act="kDeptMode"][data-v="line"][aria-pressed="true"]'))) errors.push('表示のしかたが「1行ずつ」になっていない');
  await hscroll('org line'); await shot('line', true);
  // 1つ開く・たたむ
  const first = await page.$eval('.orgtree2 [data-act="kDeptCard"]', b => b.dataset.id);
  await click(`[data-act="kDeptCard"][data-id="${first}"]`, 'open card');
  if (!(await page.$(`#oc-${first}`))) errors.push('部の中身が開かない');
  await click(`[data-act="kDeptCard"][data-id="${first}"]`, 'close card');
  if (await page.$(`#oc-${first}`)) errors.push('部の中身がたためない');
  await click('[data-act="kDeptMode"][data-v="full"]', 'mode full');
  if (await page.$('.orgtree2 .orgc.shut')) errors.push('「くわしく」にしてもたたんだ部が残る');
  await click('[data-act="kDeptMode"][data-v="top"]', 'mode top');

  // ===== ユニット：食品スーパーとラーメンを入れ、子会社を管轄に入れて、運営を任せる =====
  await click('[data-act="kDeptAdd"][data-kind="bu"]', 'add bu');
  await page.fill('#orgName', '小売・外食ユニット');
  for (let i = 0; i < 2; i++) { const cbs = await page.$$('#modal-root [data-ch="kDeptUnit"]'); if (cbs[i]) { await cbs[i].click(); await wait(120); } }
  await click(`#modal-root [data-ch="kDeptSub"][value="${sub.id}"]`, 'sub checkbox');
  await click('#modal-root [data-ch="kDeptRunS"]', 'runS');
  await click('#modal-root [data-ch="kDeptRunU"]', 'runU');
  await hscroll('bu edit'); await shot('edit');
  await click('[data-act="kDeptSave"]', 'save bu');
  s = await st();
  const bu = s.nodes.find(n => n.kind === 'bu');
  if (!bu || !bu.runU || !bu.subs.includes(sub.id)) errors.push(`ユニットの管轄・運営の設定が入らない：${JSON.stringify(bu)}`);
  const sub1 = s.subs[0];
  if (!sub1.orgRun || !sub1.auto) errors.push('子会社の経営を任せられない');
  // 上の段だけの表示でも、新しくつくったユニットは開いて見える／管轄の会社が並ぶ
  if (!(await page.$(`#oc-${bu.id}`))) errors.push('つくったユニットが開いて見えない');
  if (!(await page.$('.orgtree2 .orgc.co'))) errors.push('管轄の子会社が組織図に出ない');
  await screenErr('org bu'); await hscroll('org bu'); await shot('bu', true);
  // 枝をたたむ・開く
  await click(`[data-act="kDeptKids"][data-id="${bu.id}"]`, 'fold');
  if (await page.$(`#ok2-${bu.id}`)) errors.push('枝がたためない');
  await click(`[data-act="kDeptKids"][data-id="${bu.id}"]`, 'unfold');
  if (!(await page.$(`#ok2-${bu.id}`))) errors.push('枝が開かない');
  // ユニットの下に事業部をつくる：ユニットが選んだ事業（2つ）と会社（1社）だけが出る
  await click(`[data-act="kDeptAdd"][data-parent="${bu.id}"]`, 'add under bu');
  await modalErr('add under bu');
  const nU = await page.$$eval('#modal-root [data-ch="kDeptUnit"]', l => l.length);
  if (nU !== 2) errors.push(`ユニットの下につくる部で選べる事業が${nU}（ユニットが選んだ2つのはず）`);
  const nS = await page.$$eval('#modal-root [data-ch="kDeptSub"]', l => l.length);
  if (nS !== 1) errors.push(`ユニットの下につくる部で選べる会社が${nS}（ユニットの管轄の1社のはず）`);
  await page.fill('#orgName', '外食事業部');
  await click('#modal-root [data-ch="kDeptUnit"]', 'child unit');
  await click('[data-act="kDeptSave"]', 'save child');
  s = await st();
  const child = s.nodes.find(n => n.name === '外食事業部');
  if (!child) errors.push('ユニットの下に事業部ができない');
  // 移す：事業部ごと社長の直下へ → 事業はユニットの受け持ちから外れる
  if (child) {
    const cu = child.subs.length + (await page.evaluate(id => window.Toudori.G.org.nodes.find(n => n.id === id).units.length, child.id));
    if (!cu) errors.push('つくった事業部が事業を持っていない');
    await click(`[data-act="kDeptMove"][data-id="${child.id}"]`, 'move child');
    await modalErr('move'); await hscroll('move'); await shot('move');
    await page.selectOption('#modal-root [data-ch="kDeptMvDest"][data-k="node"]', ''); await wait(80);
    await click('#modal-root [data-act="kDeptMvGo"][data-k="node"]', 'move go');
    const r = await page.evaluate(([cid, bid]) => {
      const O = window.Toudori.G.org;
      const c = O.nodes.find(n => n.id === cid), b = O.nodes.find(n => n.id === bid);
      const below = new Set([bid]); let grew = true; while (grew) { grew = false; for (const o of O.nodes) if (!below.has(o.id) && below.has(o.parent)) { below.add(o.id); grew = true; } }
      const selB = new Set(); for (const o of O.nodes) if (below.has(o.id)) for (const x of o.units) selB.add(x);
      return { parent: c.parent, inBu: c.units.some(x => selB.has(x)) };
    }, [child.id, bu.id]);
    if (r.parent !== null || r.inBu) errors.push(`事業部を社長の直下へ移せない：${JSON.stringify(r)}`);
    // 事業を1つ、ユニットへ移す（移す先を選んで「移す」）
    await click(`[data-act="kDeptMove"][data-id="${child.id}"]`, 'move child 2');
    const k = await page.$eval('#modal-root [data-ch="kDeptMvDest"][data-k^="u:"]', e => e.dataset.k).catch(() => null);
    if (!k) errors.push('事業を1つずつ移す欄がない');
    else {
      await page.selectOption(`#modal-root [data-ch="kDeptMvDest"][data-k="${k}"]`, bu.id); await wait(80);
      await click(`#modal-root [data-act="kDeptMvGo"][data-k="${k}"]`, 'move unit go');
      const h = await page.evaluate(uid => (window.Toudori.G.org.nodes.find(n => (n.kind === 'bu' || n.fn === 'biz') && n.units.includes(uid)) || {}).id, k.slice(2));
      if (h !== bu.id) errors.push(`事業をユニットへ移せない：${h}`);
    }
    await closeModals();
  }
  // 組織図から「管轄と経営」→ 自分で経営する
  await click('.orgc.co [data-act="kSubJur"]', 'jur from org');
  await modalErr('jur'); await hscroll('jur'); await shot('jur');
  await click('#modal-root [data-act="kSubJurOp"][data-v="self"]', 'op self');
  await click('#modal-root [data-act="kSubJurGo"]', 'jur go');
  s = await st();
  if (s.subs[0].auto) errors.push('「あなたが直接経営する」にならない');

  // ===== グループの画面：管轄の印・管轄と経営のダイアログ（任せる → 管轄から外す） =====
  await page.click('.tab[data-tab="k_group"]'); await wait(150);
  await screenErr('group');
  const gt = await page.$eval('#app', e => e.textContent);
  if (!/管轄：小売・外食ユニット/.test(gt)) errors.push('グループの画面に管轄の印がない');
  if (!(await page.$('[data-act="kSubJur"]'))) { const h = await page.$('.ob-head'); if (h) { await h.click(); await wait(120); } }
  await click('[data-act="kSubJur"]', 'jur from group');
  await click('#modal-root [data-act="kSubJurOp"][data-v="org"]', 'op org');
  await click('#modal-root [data-act="kSubJurGo"]', 'jur go 2');
  s = await st();
  if (!s.subs[0].auto || !s.subs[0].orgRun) errors.push('グループの画面から、管轄の組織に任せられない');
  // 子会社の画面の帯
  await click(`[data-act="kView"][data-v="${sub.id}"]`, 'enter sub');
  const banner = await page.$eval('.subbanner', e => e.textContent).catch(() => '');
  if (!/小売・外食ユニット/.test(banner)) errors.push(`子会社の画面の帯に、任せている組織が出ない：${banner.slice(0, 80)}`);
  await page.click('.subbanner [data-act="kView"][data-v="root"]'); await wait(150);

  // ===== 現場：運営を任せている事業の知らせ =====
  await page.click('.tab[data-tab="k_ops"]'); await wait(150);
  const units = await page.$$eval('[data-ch="kUnit"] option, [data-act="kUnit"]', l => l.length).catch(() => 0);
  const note = await page.$('.runnote');
  if (!note) {
    // 先頭の事業が任せていない事業のときは、事業を切り替えて探す
    const ids = await page.evaluate(() => window.Toudori.G.units.filter(u => !u.closedM).map(u => u.id));
    let found = false;
    for (const id of ids) { await page.evaluate(id => { window.Toudori.ui().kUnit = id; }, id); await page.evaluate(() => window.Toudori.render && window.Toudori.render()); await wait(80); if (await page.$('.runnote')) { found = true; break; } }
    if (!found && units >= 0) errors.push('運営を任せた事業に「任せています」の知らせがない');
  }
  await hscroll('ops'); await shot('ops');

  // ===== 成長：すべての事業にまとめて投資 → グループ全体 =====
  await page.click('.tab[data-tab="k_grow"]'); await wait(150);
  await page.selectOption('[data-ch="kUpgT"]', '*all'); await wait(150);
  await screenErr('grow all');
  const up0 = (await st()).up;
  // 2つ以上の事業に合う投資を選ぶ
  const allBtns = await page.$$('[data-act="kUpgAll"]');
  let allBtn = null;
  for (const b of allBtns) { const t = await b.textContent(); const m = t.match(/（(\d+)事業）/); if (m && +m[1] >= 2) { allBtn = b; break; } }
  if (!allBtn) errors.push('「まとめて実施」のボタンがない');
  else {
    await allBtn.click(); await wait(150);
    await modalErr('upg all'); await hscroll('upg all'); await shot('upgall');
    const nm = await modalName();
    if (nm === 'kCapex') { const cash = await page.$('#modal-root [data-act="kCxFin"][data-v="cash"]'); if (cash) { await cash.click(); await wait(100); } await click('#modal-root [data-act="kCxGo"]', 'capex go'); }
    else await click('#modal-root .mf .btn.primary', 'upg all go');
    const up1 = (await st()).up;
    if (up1 - up0 < 2) errors.push(`まとめて実施しても記録が増えない：${up0} → ${up1}`);
  }
  await page.selectOption('[data-ch="kUpgT"]', '*grp'); await wait(150);
  await screenErr('grow grp');
  const gb = await page.$$('[data-act="kUpgAll"]');
  if (!gb.length) errors.push('グループ全体の「まとめて実施」のボタンがない');
  else {
    await gb[gb.length - 1].click(); await wait(150);
    if ((await modalName()) !== 'kUpgGrp') errors.push(`グループ全体のダイアログが開かない：${await modalName()}`);
    await modalErr('upg grp'); await hscroll('upg grp'); await shot('upggrp');
    const go = await page.$('#modal-root [data-act="kUpgGrpGo"]');
    if (go && !(await go.isDisabled())) { await go.click(); await wait(150); }
    else await closeModals();
  }
  await hscroll('grow'); await shot('grow', true);

  // ===== 3か月進める =====
  for (let i = 0; i < 3; i++) {
    await closeModals();
    await page.click('.btn-advance'); await wait(150);
    const cf = await page.$('[data-act="kAdvanceNow"]'); if (cf) { await cf.click(); await wait(200); }
    await modalErr('advance ' + i);
  }
  await closeModals();
  await page.click('.tab[data-tab="k_org"]'); await wait(150);
  await screenErr('org after'); await hscroll('org after');
  const chk = await page.evaluate(() => window.Toudori.check());
  if (chk.length) errors.push('帳簿：' + chk.slice(0, 3).join(' / '));

  console.log(JSON.stringify({ mobile, state: await st(), errors }, null, 1));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
