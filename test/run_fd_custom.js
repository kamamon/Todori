// 創業記：カスタムスタートと途中編集をボットで試す（帳簿の整合性・数の異常・始めた直後の売上が目安に近いか）
//   node test/run_fd_custom.js [denki|jidosha|all] [年数] [始める年,…]
//   始める年ごとに、初期値（空欄）のカスタムスタートと、値を入れたカスタムスタートで始め、番頭（ボット）に任せて進める。
//   途中で、お金・技術・製品・工場・販路・人と仕組みを編集し、そのたびに帳簿を確かめる
const { loadFd } = require('./load_fd');
const E = loadFd();
const api = E.__api;
const which = process.argv[2] || 'all';
const years = +(process.argv[3] || 12);
const starts = (process.argv[4] || '1910,1925,1937,1946,1955,1970,1985,1995,2008,2020,2040').split(',').map(Number);
const scens = which === 'all' ? ['denki', 'jidosha'] : [which];
let bad = 0;
const fmt = x => (x / 1e8 >= 10000 ? `${(x / 1e12).toFixed(2)}兆` : `${(x / 1e8).toFixed(0)}億`);
function resolve(m) {
  if (m.type === 'fdEvent') { const Ev = E.fdEventById(m.id); if (Ev && Ev.ch) { let i = 0; if (Ev.ch[i].can && !Ev.ch[i].can()) i = Ev.ch.findIndex(c => !c.can || c.can()); if (i >= 0) E.fdChoose(m.id, i); } }
  else if (m.type === 'fdSucc') E.fdPickSucc(0);
  else if (m.type === 'fdRescue') E.fdRescueAccept();
}
function check(tag) {
  const G = api.G;
  const errs = E.fdCheck();
  for (const p of G.prods) if (!isFinite(p.qy) || !isFinite(p.want || 0) || !isFinite(p.pr)) errs.push(`製品の数がおかしい ${p.name}`);
  for (const [r, R] of Object.entries(G.reg)) if (!isFinite(R.brand) || !isFinite(R.dist)) errs.push(`地域の数がおかしい ${r}`);
  if (errs.length) { bad++; console.log(`  NG ${tag} ${E.fdQLabel()}: ${errs.slice(0, 4).join(' / ')}`); return false; }
  return true;
}
function run(scen, cu, label) {
  const R = E.fdCuResolve(scen, cu);
  E.fdNewGame({ scen, seed: 7 + R.y, cu: R });
  let G = api.G;
  if (!check(`${label} 開始`)) return;
  const head0 = E.fdHead(), eq0 = E.fdEquity() / E.fdCpi(E.fdYf()), cash0 = G.bs.cash / E.fdCpi(E.fdYf());
  const mods = G.mods.length;
  const endQ = Math.min((R.endY - R.y + 1) * 4, years * 4);
  let edited = false;
  for (let i = 0; i < endQ && !G.over; i++) {
    E.fdAuto({ lvl: 1 });
    E.fdAdvanceQ();
    G = api.G;
    for (let k = 0; k < 2; k++) { const ms = G.pendingModals.slice(); G.pendingModals = []; for (const m of ms) resolve(m); }
    if (!check(label)) return;
    // 3年目の初めに、すべての編集を試す
    if (i === 8 && !G.over) {
      edited = true;
      const y = E.fdYf();
      const f = Object.keys(G.tech).find(k => G.tech[k].t !== null);
      E.fdEditMoney({ cash: G.bs.cash / E.fdCpi(y) * 1.5 + 1e9, debt: E.fdDebt() / E.fdCpi(y) * 0.5 });
      if (!check(`${label} 編集:お金`)) return;
      if (f) E.fdEditTech({ [f]: 1 });
      const p = E.fdActiveProds()[0];
      if (p) E.fdEditProds({ [p.id]: { gap: 0, pr: 110 } });
      if (!check(`${label} 編集:技術と製品`)) return;
      const fac = G.facs[0];
      if (fac && fac.lines[0]) E.fdEditFacs({ [fac.id]: { skill: 1.3, repair: true, lines: { [fac.lines[0].cat]: { cap: fac.lines[0].cap * 1.5, auto: 0.5 } } } });
      if (!check(`${label} 編集:工場`)) return;
      const nc = E.fdCuCats(scen, Math.floor(y)).find(c => !E.fdActiveProds(c).length);
      if (nc) { const r = E.fdEditAddProd(nc, E.fdCat(nc).kind === 'big' ? 2 : 1000); if (!r.ok) console.log('  （製品を出せない）', r.why); }
      if (!check(`${label} 編集:製品を出す`)) return;
      const rr = E.fdRegOrder().find(r => r !== 'jp' && E.fdRegAccess(r, y) >= 3);
      if (rr) { const r = E.fdEditAddFac(rr, 'テスト'); if (r.ok && nc) E.fdEditAddLine(r.f.id, nc, E.fdCat(nc).kind === 'big' ? 1 : 500); }
      if (!check(`${label} 編集:工場を建てる`)) return;
      E.fdEditRegs({ jp: { st: 4, brand: 70 }, na: { st: 2, brand: 40 } });
      E.fdEditOrg({ eng: G.staff.eng + 50, prog: { qc: true }, kz: 0.3, qc: 0.4 });
      if (!check(`${label} 編集:販路と人`)) return;
    }
  }
  const h = G.hy[0], hl = G.hy[G.hy.length - 1];
  const r0 = h ? h.sales / h.cpi : 0;
  const okScale = h ? r0 / R.sales : 0;
  const warn = h && (okScale < 0.3 || okScale > 2.5) ? ' ← 1年目の売上が目安から離れている' : '';
  console.log(`${label.padEnd(18)} 年商の目安 ${fmt(R.sales).padStart(7)} → 1年目 ${fmt(r0).padStart(7)}（${okScale.toFixed(2)}倍）営業利益率 ${h ? (h.opi / Math.max(1, h.sales) * 100).toFixed(1) : '-'}% ／ ${hl ? hl.y : '-'}年 ${fmt(hl ? hl.sales / hl.cpi : 0).padStart(7)} 社員${E.fdHead()}（初め${head0}） 純資産 初め${fmt(eq0)} 現金${fmt(cash0)} 引き継いだ補正${mods} ${G.over ? G.over.type : '続行'}${edited ? '・編集あり' : ''}${warn}`);
}
for (const scen of scens) {
  for (const y of starts) {
    run(scen, { y }, `${scen} ${y} 初期値`);
    run(scen, { y, sales: y < 1950 ? 300 : y < 1990 ? 30000 : 150000, cash: y < 1950 ? 50 : 3000, debt: 0, gap: y < 1950 ? 5 : 0, ovs: 40, listed: true, story: false,
      regs: { jp: { st: 4, brand: 80 }, na: { st: 3, brand: 50 }, as: { st: 3, brand: 45 } }, prog: { school: true, lab: true, kaizen: true, qc: true } }, `${scen} ${y} 大きく`);
  }
}
console.log(bad ? `NG ${bad}件` : 'OK');
process.exit(bad ? 1 : 0);
