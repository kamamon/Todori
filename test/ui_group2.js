// グループの再編の画面のテスト：関連会社・孫会社の設立、再編・社名のダイアログ（社名・買い増し・合併・傘下に移す）、
// 親会社の社名、関連会社の決算書、連結決算（持分法）。エラーと横のはみ出しがないかを確かめる
//   node test/ui_group2.js [--shots] [--mobile]
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
  const shot = async (name, full = true) => { if (doShots) await page.screenshot({ path: `${shots}/g${tag}_${name}.png`, fullPage: full }); };
  const screenErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#main .callout.bad'); return e && /エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const hscroll = async where => { const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (w > 2) errors.push(`${where}: 横にはみ出し ${w}px`); };
  const click = async (sel, where) => { const b = await page.$(sel); if (!b) { errors.push(`${where || sel}: 見つからない`); return false; } if (await b.isDisabled()) { errors.push(`${where || sel}: 押せない`); return false; } await b.click(); await wait(100); return true; };
  const toastBad = async where => { const t = await page.evaluate(() => [...document.querySelectorAll('.toast.bad')].map(x => x.textContent).join(' / ')); if (t) console.log(`  （${where} のお知らせ：${t}）`); };
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
  const found = async (q, own, owner, man) => {
    await page.click('.tab[data-tab="k_group"]'); await wait(80);
    await click('[data-act="kGrpSec"][data-v="make"]', 'make');
    if (owner) { await page.selectOption('[data-ch="kGFowner"]', owner); await wait(100); }
    await page.fill('#kGFq', q); await wait(100);
    const p = await page.$('[data-act="kGFpick"]'); if (!p) { errors.push(`業種 ${q} が見つからない`); return; }
    await p.click(); await wait(100);
    await click(`[data-act="kGFown"][data-v="${own}"]`, 'own ' + own);
    if (man) { await page.fill('[data-ch="kGFamt"]', String(man)); await page.dispatchEvent('[data-ch="kGFamt"]', 'change'); await wait(100); }
    await click('[data-act="kGFGo"]', 'found ' + q);
    await toastBad('設立 ' + q);
  };

  // 開始：現預金を多めに
  await page.click('[data-act="stMode"][data-v="kaisha"]'); await wait(80);
  await page.evaluate(() => { const ui = window.Toudori.ui(); ui.start.k.cu = { on: true, form: 'kk', pref: 22, capital: '', cash: '300000', debt: '', hqLand: false, eco: 'normal', fx: 148, founded: '' }; });
  await page.fill('#kstSeed', '6');
  await click('[data-act="kStart"]', 'start'); await wait(250); await closeModals();
  // 子会社100%・合弁60%・関連会社40%・孫会社（子会社の下）
  await found('ソフトウェア', '1', null, 40000);
  await found('婦人服', '0.6');
  await found('洋食', '0.4');
  const ids = await page.evaluate(() => window.Toudori.G.group.subs.map(s => ({ id: s.id, n: s.name, own: s.own, aff: s.aff, parent: s.parent || null })));
  console.log('設立', JSON.stringify(ids));
  const B = ids.find(x => x.own === 1);
  if (B) await found('ラーメン', '1', B.id, 6000);
  // 5社目：会社が増えると、はじめは1行ずつの表示（新しい会社は開いて見せる）
  await found('弁当', '1', null, 30000);
  await page.click('.tab[data-tab="k_group"]'); await wait(60);
  await click('[data-act="kGrpSec"][data-v="org"]', 'org');
  await screenErr('org'); await hscroll('org'); await shot('org_line');
  const fold = async () => page.evaluate(() => ({
    mode: (document.querySelector('[data-act="kOrgMode"][aria-pressed="true"]') || {}).dataset?.v,
    cards: document.querySelectorAll('.orgbox.sub').length, shut: document.querySelectorAll('.orgbox.sub.shut').length,
    bodies: document.querySelectorAll('.ob-body').length, kids: document.querySelectorAll('.orgkids').length,
    bars: [...document.querySelectorAll('.orgfold')].map(b => b.getAttribute('aria-expanded') + ':' + b.textContent.trim()),
  }));
  let f = await fold();
  console.log('折りたたみ（5社）', JSON.stringify(f));
  if (f.mode !== 'line') errors.push(`5社で1行ずつになっていない（${f.mode}）`);
  if (f.bodies !== 1) errors.push(`新しい会社だけ開いているはずが ${f.bodies}社開いている`);
  // 子会社だけ：孫会社の枝がたたまれる → 枝を開く
  await click('[data-act="kOrgMode"][data-v="top"]', 'mode top');
  f = await fold();
  if (f.kids !== 0 || !f.bars.some(x => x.startsWith('false:孫会社'))) errors.push(`子会社だけの表示で孫会社がたたまれない ${JSON.stringify(f)}`);
  await shot('org_top');
  await click('.orgfold[aria-expanded="false"]', 'open branch');
  f = await fold();
  if (f.kids !== 1) errors.push('孫会社の枝が開かない');
  // 会社の行を押して開く／たたむ
  const head = await page.$('.orgbox.sub.shut .ob-head');
  if (head) { await head.click(); await wait(100); f = await fold(); if (f.bodies !== 1) errors.push(`会社の行を押しても開かない（${f.bodies}）`); await page.click('.orgbox.sub:not(.shut) .ob-head'); await wait(100); f = await fold(); if (f.bodies !== 0) errors.push('会社の行を押してもたたまれない'); }
  await hscroll('org fold');
  // くわしく：すべて開く
  await click('[data-act="kOrgMode"][data-v="full"]', 'mode full');
  f = await fold();
  if (f.shut !== 0 || f.bodies !== f.cards) errors.push(`くわしくで全部開かない ${JSON.stringify(f)}`);
  await screenErr('org'); await hscroll('org'); await shot('org');
  const st1 = await page.evaluate(() => window.Toudori.G.group.subs.map(s => `${s.name}${s.parent ? '←' + s.parent : ''}${s.aff ? '（持分法）' : ''}`));
  console.log('構成', st1.join(' / '));
  if (!st1.some(x => x.includes('←'))) errors.push('孫会社ができていない');
  // 関連会社の決算書
  await click('[data-act="kAffView"]', 'aff view'); await modalErr('aff view'); await shot('affview', false); await closeModals();
  // 再編・社名：合弁の会社
  const jv = (await page.evaluate(() => window.Toudori.G.group.subs.find(s => s.own > 0.5 && s.own < 1))) || {};
  await click(`[data-act="kSubOps"][data-id="${jv.id}"]`, 'ops jv'); await modalErr('ops'); await shot('ops', false);
  // 社名
  await page.fill('.modal [data-in="kRenName"]', '汐見アパレル株式会社');
  await page.dispatchEvent('.modal [data-in="kRenName"]', 'input');
  await click('.modal [data-act="kRenGo"]', 'rename sub'); await toastBad('社名');
  // 買い増し（100%・現金）
  await click('.modal [data-act="kOpsTo"][data-v="1"]', 'to 100');
  await click('.modal [data-act="kMoreGo"][data-ex="0"]', 'buy more'); await toastBad('買い増し');
  await modalErr('ops after'); await shot('ops_after', false);
  // 合併の契約（親会社に吸収）
  const mg = await page.$('.modal [data-act="kMergeGo"]:not([disabled])');
  if (mg) { await mg.click(); await wait(100); } else errors.push('合併のボタンが押せない');
  await closeModals();
  // 孫会社を親会社の直下へ（傘下に移す）
  const gc = (await page.evaluate(() => window.Toudori.G.group.subs.find(s => s.parent && !s.gone))) || {};
  if (gc.id) {
    await click(`[data-act="kSubOps"][data-id="${gc.id}"]`, 'ops gc');
    const sel = await page.$('.modal [data-ch="kOpsParent"]');
    if (sel) { await page.selectOption('.modal [data-ch="kOpsParent"]', 'root'); await wait(60); await click('.modal [data-act="kReparentGo"]', 'reparent'); await toastBad('傘下'); }
    await closeModals();
  }
  // 関連会社を買い増して子会社に（段階取得）
  const af = (await page.evaluate(() => window.Toudori.G.group.subs.find(s => s.aff && !s.gone))) || {};
  if (af.id) {
    await click(`[data-act="kSubOps"][data-id="${af.id}"]`, 'ops aff');
    await click('.modal [data-act="kOpsTo"][data-v="0.67"]', 'to 67');
    await click('.modal [data-act="kMoreGo"][data-ex="0"]', 'step'); await toastBad('段階取得');
    await closeModals();
  }
  // 親会社の社名（会社の形）
  await click('[data-act="kGrpSec"][data-v="form"]', 'form');
  await page.fill('[data-in="kRenName"]', '株式会社汐見ホールディングス');
  await page.dispatchEvent('[data-in="kRenName"]', 'input');
  await click('[data-act="kRenGo"]', 'rename root'); await toastBad('親会社の社名');
  await screenErr('form'); await shot('form');
  const st2 = await page.evaluate(() => { const G = window.Toudori.G; return { co: G.coName, subs: G.group.subs.filter(s => !s.gone).map(s => `${s.name} ${Math.round(s.own * 100)}%${s.aff ? '持分法' : ''}${s.parent ? '←' + s.parent : ''}`), mergers: G.group.mergers.length, check: window.Toudori.check() }; });
  console.log('再編の後', JSON.stringify(st2));
  if (!/汐見ホールディングス/.test(st2.co)) errors.push('親会社の社名が変わらない');
  if (!st2.mergers) errors.push('合併の予定がない');
  // 決算を2回越える（合併の実行と連結決算）
  await advance(16, 'run');
  for (const t of ['k_dash', 'k_ops', 'k_group']) { await page.click(`.tab[data-tab="${t}"]`); await wait(80); await screenErr('after ' + t); await hscroll('after ' + t); }
  await click('[data-act="kGrpSec"][data-v="org"]', 'org2'); await shot('org_after');
  await click('[data-act="kGrpSec"][data-v="cons"]', 'cons'); await screenErr('cons'); await hscroll('cons'); await shot('cons');
  const fin = await page.evaluate(() => { const G = window.Toudori.G; const fys = Object.keys(G.group.cons); const c = G.group.cons[fys[fys.length - 1]]; return { m: G.m, fys: fys.length, check: c && c.check, affs: c && (c.affs || []).length, gone: G.group.subs.filter(s => s.gone && s.out).map(s => s.out.why), units: G.units.filter(u => !u.closedM).length }; });
  console.log('最後', JSON.stringify(fin));
  if (!fin.gone.includes('merged')) errors.push('合併が行われていない');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'エラーなし');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
