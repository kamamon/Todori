// 創業記モードの画面を Playwright で一通り操作し、エラーがないか確かめる
//   node test/ui_fd.js [denki|jidosha] [四半期の数] [--shots] [--mobile] [--custom=年]
//   出来事は最初の選択肢を選び、救済は受ける。ときどき各画面を開き、ボタン（ライン・工場・開発・値段）も押す
//   --custom=1965 なら、開始画面のカスタムスタートで年・年商・事業・販路・仕組みを入れて始め、途中編集のすべての項目を書き換える
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const shots = path.join(__dirname, 'shots');
const scen = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'denki';
const quarters = +(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 60);
const doShots = process.argv.includes('--shots');
const mobile = process.argv.includes('--mobile');
const cuArg = process.argv.find(a => a.startsWith('--custom'));
const cuY = cuArg ? +(cuArg.split('=')[1] || 1965) : 0;
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
  const tag = (mobile ? 'm' : 'd') + scen[0] + (cuY ? 'c' : '');
  const shot = async (name, full = true) => { if (doShots) await page.screenshot({ path: `${shots}/f${tag}_${name}.png`, fullPage: full }); };
  const screenErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#main .callout.bad'); return e && /エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const modalErr = async where => { const t = await page.evaluate(() => { const e = document.querySelector('#modal-root .mb'); return e && /表示エラー/.test(e.textContent) ? e.textContent : ''; }); if (t) errors.push(`${where}: ${t}`); };
  const overflow = async where => { const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (w > 2) errors.push(`${where}: 横にはみ出し ${w}px`); };
  const click = async (sel, wait = 80) => { const b = await page.$(sel); if (!b) return false; await b.click(); await page.waitForTimeout(wait); return true; };
  const stats = { events: 0, rescue: 0, years: 0, launch: 0 };
  // モーダル：出来事は最初に選べる選択肢、救済は受ける、それ以外は閉じる
  const handleModals = async where => {
    for (let i = 0; i < 25; i++) {
      if (!(await page.$('#modal-root .modal'))) return;
      await modalErr(where);
      const name = await page.evaluate(() => document.querySelector('#modal-root .modal').getAttribute('aria-label') || '');
      if (await click('#modal-root [data-act="fChoose"]:not([disabled])')) { stats.events++; if (stats.events <= 2) await shot(`event${stats.events}`, false); continue; }
      if (await click('#modal-root [data-act="fRescue"][data-v="1"]')) { stats.rescue++; continue; }
      if (await click('#modal-root [data-act="fSucc"]')) continue;
      if (/決算/.test(name)) { stats.years++; if (stats.years === 3) await shot('year', false); }
      if (/発売/.test(name)) stats.launch++;
      if (!(await click('#modal-root .mf [data-act="closeModal"]', 60))) { await page.keyboard.press('Escape'); await page.waitForTimeout(40); }
    }
  };
  // 開始画面：創業のモード → 道を選ぶ → 創業する
  await click('[data-act="stMode"][data-v="sogyo"]', 120);
  await shot('start');
  if (!(await click(`[data-act="fStScen"][data-v="${scen}"]`, 120))) errors.push('道の選択ボタンがない');
  // カスタムスタート：欄を開き、年・年商・事業・販路・仕組み・技術を入れる（入れるたびに描き直されるので、そのつど探す）
  const fill = async (sel, v) => { const el = await page.$(sel); if (!el) { errors.push(`カスタムスタートの欄がない ${sel}`); return; } await el.fill(String(v)); await el.dispatchEvent('change'); await page.waitForTimeout(80); };
  if (cuY) {
    if (!(await click('details.custom > summary', 120))) errors.push('カスタムスタートの欄がない');
    await fill('[data-ch="fCu"][data-k="y"]', cuY);
    await fill('[data-ch="fCu"][data-k="sales"]', cuY < 1950 ? 800 : 20000);
    await fill('[data-ch="fCu"][data-k="founded"]', cuY - 20);
    const cats = await page.$$eval('[data-ch="fCuCatOn"]', els => els.map(e => ({ c: e.dataset.c, on: e.checked })));
    if (cats.length < 2) errors.push('選べる事業が少ない');
    const off = cats.find(x => !x.on);
    if (off) await click(`[data-ch="fCuCatOn"][data-c="${off.c}"]`, 150);
    await fill(`[data-ch="fCuCat"][data-c="${cats[0].c}"][data-k="w"]`, 50);
    await fill(`[data-ch="fCuCat"][data-c="${cats[0].c}"][data-k="pr"]`, 105);
    const sel = await page.$('[data-ch="fCuReg"][data-r="na"][data-k="st"]:not([disabled])');
    if (sel) { await sel.selectOption(String(cuY < 1950 ? 1 : 3)); await page.waitForTimeout(80); }
    await fill('[data-ch="fCuReg"][data-r="jp"][data-k="brand"]', 70);
    await fill('[data-ch="fCu"][data-k="ovs"]', 30);
    await click('details.custom details > summary', 80);
    const f0 = await page.$eval('[data-ch="fCuTech"]', e => e.dataset.f).catch(() => null);
    if (f0) await fill(`[data-ch="fCuTech"][data-f="${f0}"]`, 3);
    await click('[data-ch="fCuProg"]', 150);
    await screenErr('カスタムスタート');
    if (mobile) await overflow('カスタムスタート');
    await shot('custom');
    const label = await page.$eval('[data-act="fStart"]', b => b.textContent).catch(() => '');
    if (!/この設定で始める/.test(label)) errors.push(`開始のボタンが「この設定で始める」になっていない（${label}）`);
  }
  if (!(await click('[data-act="fStart"]', 300))) errors.push('「創業する」ボタンがない');
  if (cuY) {
    const st = await page.evaluate(() => { const G = window.Toudori.G; return { y0: G.y0, custom: !!G.custom, prods: G.prods.length, facs: G.facs.length, founded: G.founded }; });
    if (st.y0 !== cuY || !st.custom) errors.push(`カスタムスタートの年が反映されていない ${JSON.stringify(st)}`);
    if (st.founded !== cuY - 20) errors.push(`創業の年が反映されていない ${st.founded}`);
  }
  await shot('intro', false);
  await handleModals('開始');
  await screenErr('開始');
  const tabs = ['f_dash', 'f_prod', 'f_tech', 'f_fac', 'f_people', 'f_world', 'f_money', 'f_hist'];
  const setTab = t => page.evaluate(tab => { window.Toudori.ui().tab = tab; window.Toudori.render(); }, t);
  const visitAll = async round => {
    for (const t of tabs) {
      await setTab(t);
      await page.waitForTimeout(60);
      await screenErr(`${round} ${t}`);
      if (mobile) await overflow(`${round} ${t}`);
      if (round === 'r1' || round === 'last') await shot(`${round}_${t}`);
      // 社史は3つの見方をすべて開く
      if (t === 'f_hist') for (const v of ['chron', 'chart', 'table']) { if (await click(`[data-act="fHist"][data-v="${v}"]`, 60)) await screenErr(`${round} 社史 ${v}`); }
      // 製品と市場：分野と地域を切り替える
      if (t === 'f_prod') { await click('[data-act="fCat"]:not([aria-pressed="true"])', 60); await click('[data-act="fRegSel"]:not([aria-pressed="true"])', 60); await screenErr(`${round} 製品と市場の切り替え`); }
    }
    await setTab('f_dash');
  };
  // ボタンをいくつか押す（モーダルを開いて閉じる・値段・ラインの追加）
  const pokeButtons = async round => {
    await setTab('f_fac');
    if (await click('[data-act="fLineOpen"]', 100)) { await modalErr(`${round} ライン`); await shot(`${round}_line`, false); await click('#modal-root [data-act="fLineGo"]:not([disabled])', 100); await handleModals(`${round} ライン`); }
    if (await click('[data-act="fFacOpen"]', 100)) { await modalErr(`${round} 工場`); await click('#modal-root .mf [data-act="closeModal"]', 60); }
    await setTab('f_tech');
    if (await click('[data-act="fDevOpen"]', 100)) { await modalErr(`${round} 開発`); await click('#modal-root .mf [data-act="closeModal"]', 60); }
    await setTab('f_prod');
    await click('[data-act="fPr"][data-d="5"]', 60);
    await click('[data-act="fPr"][data-d="-5"]', 60);
    await setTab('f_dash');
    await handleModals(`${round} ボタン`);
    await screenErr(`${round} ボタン`);
  };
  await visitAll('r1');
  await pokeButtons('r1');
  // 途中編集：すべての項目を開き、値を変えて書き換える
  if (cuY) {
    const before = await page.evaluate(() => window.Toudori.G.flags.edited || 0);
    if (!(await click('[data-act="fEditOpen"]', 150))) errors.push('「会社を編集する」ボタンがない');
    const apply = async (tab, act) => {
      await click(`#modal-root [data-act="fEdTab"][data-v="${tab}"]`, 100);
      await modalErr(`編集 ${tab}`);
      if (mobile) await overflow(`編集 ${tab}`);
      await act();
      if (!(await click('#modal-root [data-act="fEdApply"]', 150))) errors.push(`編集 ${tab}：書き換えるボタンがない`);
      await modalErr(`編集 ${tab} のあと`);
      const msg = await page.$eval('#modal-root .callout', e => e.textContent).catch(() => '');
      if (!/書き換えました/.test(msg)) errors.push(`編集 ${tab}：書き換わらない（${msg}）`);
      if (tab === 'fac') await shot('edit_fac', false);
    };
    const setIn = async (sel, v) => { const el = await page.$('#modal-root ' + sel); if (!el) { errors.push(`編集の欄がない ${sel}`); return; } await el.fill(String(v)); };
    await apply('money', async () => { await setIn('[data-ed="cash"]', 12345); await setIn('[data-ed="debt"]', 100); });
    await apply('tech', async () => { await setIn('[data-ed="tech"]', 1); });
    await apply('prod', async () => { await setIn('[data-ed="pgap"]', 0); await setIn('[data-ed="ppr"]', 95); });
    await apply('fac', async () => { await setIn('[data-ed="lcap"]', 5000); await setIn('[data-ed="lauto"]', 40); await setIn('[data-ed="skill"]', 1.4); });
    await apply('reg', async () => { await setIn('[data-ed="rbr"]', 80); });
    await apply('org', async () => { await setIn('[data-ed="eng"]', 777); await setIn('[data-ed="kz"]', 30); });
    // 製品・ライン・工場を足す
    await click('#modal-root [data-act="fEdTab"][data-v="prod"]', 100);
    if (await page.$('#modal-root [data-ed="newc"]')) { await setIn('[data-ed="newcap"]', 1000); await click('#modal-root [data-act="fEdAddProd"]', 150); const m = await page.$eval('#modal-root .callout', e => e.textContent).catch(() => ''); if (!/出しました/.test(m)) errors.push(`製品を出せない（${m}）`); }
    await click('#modal-root [data-act="fEdTab"][data-v="fac"]', 100);
    if (await page.$('#modal-root [data-ed="lc"]')) { await setIn('[data-ed="lcn"]', 300); await click('#modal-root [data-act="fEdAddLine"]', 150); }
    await click('#modal-root [data-act="fEdAddFac"]', 150);
    const m2 = await page.$eval('#modal-root .callout', e => e.textContent).catch(() => '');
    if (!/建てました/.test(m2)) errors.push(`工場を建てられない（${m2}）`);
    await modalErr('編集の追加');
    await click('#modal-root .mf [data-act="closeModal"]', 80);
    const after = await page.evaluate(() => ({ n: window.Toudori.G.flags.edited || 0, eng: window.Toudori.G.staff.eng, check: window.Toudori.check() || [] }));
    if (after.n < before + 6) errors.push(`編集の回数が少ない ${after.n}`);
    if (after.eng !== 777) errors.push(`技術者の数が書き換わらない ${after.eng}`);
    if (after.check.length) errors.push('編集のあとの帳簿：' + after.check.join(' / '));
    // メニューからも開ける
    await click('[data-act="menu"]', 120);
    if (!(await click('#modal-root [data-act="fEditOpen"]', 150))) errors.push('メニューに「会社を編集する」がない');
    await handleModals('メニュー');
  }
  let q = 0;
  for (; q < quarters; q++) {
    const over = await page.evaluate(() => !!(window.Toudori.G && window.Toudori.G.over));
    if (over) break;
    if (!(await click('[data-act="advance"]:not([disabled])', 40))) { await handleModals(`q${q}`); if (!(await click('[data-act="advance"]:not([disabled])', 40))) { errors.push(`q${q}: 進めるボタンが押せない`); break; } }
    await handleModals(`q${q}`);
    await screenErr(`q${q}`);
    if (q % 24 === 23) { await visitAll(`q${q}`); await pokeButtons(`q${q}`); }
  }
  // 「1年進める」も試す
  if (!mobile && !(await page.evaluate(() => !!window.Toudori.G.over))) { await click('[data-act="fYearRun"]', 200); await handleModals('1年進める'); }
  await visitAll('last');
  const st = await page.evaluate(() => { const G = window.Toudori.G; return { y: G.hy.length ? G.hy[G.hy.length - 1].y : 0, over: G.over ? G.over.type : '', facs: G.facs.length, prods: G.prods.filter(p => p.active).length, check: window.Toudori.check() || [] }; });
  if (st.check.length) errors.push('帳簿：' + st.check.join(' / '));
  console.log(`${scen}${mobile ? '（スマホ）' : ''}：${q}四半期 → ${st.y}年の決算まで ${st.over || '続行'} 工場${st.facs} 製品${st.prods} 出来事${stats.events} 決算${stats.years} 発売${stats.launch} 救済${stats.rescue}`);
  await browser.close();
  if (errors.length) { console.log('NG:\n' + [...new Set(errors)].slice(0, 30).join('\n')); process.exit(1); }
  console.log('OK');
})();
