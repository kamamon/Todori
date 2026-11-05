// 成長の要素（投資・海外展開・M&A・上場・配当・新規事業・撤退）をボットで試し、帳簿の整合性を確かめる
//   node test/run_grow.js [業種] [年数] [シード]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const types = (process.argv[2] || '金属部品の切削加工（町工場）+業務用食品卸').split('+').map(t => ({ type: t, sc: 1.5 }));
const years = +(process.argv[3] || 8);
const seed = +(process.argv[4] || 3);
const Y = x => E.fmtYen(x);
E.ksNewGame({ units: types, coName: 'テスト株式会社', ceo: 'テスト', seed, cond: 'good' });
let G = api.G;
const log = (...a) => console.log(E.ymLabel(G.m), ...a);
let integ = 0;
const check = tag => { const e = E.ksCheck(); if (e.length) { integ++; if (integ < 6) console.log('INTEGRITY', tag, E.ymLabel(G.m), e); } };
check('init');
const end = G.m + years * 12;
let did = {};
function buyAsset(it) { E.ksBuyAsset(it); }
function tryBorrow(amt) {
  for (const bank of ['mirai', 'shinkin', 'koko']) {
    const app = { bank, purpose: 'capex', amt, termM: 84, cgc: false };
    const r = E.ksEvalLoan(app);
    if (r.ok) { E.ksBorrow(app, r); return r.amt; }
  }
  return 0;
}
while (G.m < end && !G.over) {
  for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
  E.ksAutoFinance();
  // 投資：費用のものと資産のもの
  const u0 = E.ksActiveUnits()[0];
  if (!did.iso && G.m > 10) { const U = E.KS_UPG_BY.iso9001; if (E.ksUpgAvail(U, u0).ok) { E.ksUpgDoExpense('iso9001', u0.id); did.iso = 1; log('ISO9001'); } }
  if (!did.erp && G.m > 12) { const U = E.KS_UPG_BY.erp; const cost = Math.round(U.cost(null)); if (E.ksB('cash') > cost * 2) { buyAsset({ n: U.n, acct: U.acct, cost, life: U.life, part: 'S', u: 'HQ' }); E.ksUpgRegister('erp', null); did.erp = 1; log('ERP', Y(cost)); } }
  if (!did.solar && G.m > 14) { const U = E.KS_UPG_BY.solar; if (E.ksUpgAvail(U, u0).ok) { const cost = Math.round(U.cost(u0)); buyAsset({ n: U.n, acct: U.acct, cost, life: U.life, part: 'C', u: u0.id }); E.ksUpgRegister('solar', u0.id); did.solar = 1; log('solar', Y(cost)); } }
  // 海外展開
  if (G.m > 12 && !did.intl1) { const nx = E.ksIntlNext(u0, 'asia'); if (nx.ok) { E.ksIntlDoExpense(u0.id, 'asia'); did.intl1 = G.m; log('export asia'); } }
  if (did.intl1 && !did.intl2) { const nx = E.ksIntlNext(u0, 'asia'); if (nx.ok) { const cost = Math.round(nx.st.cost(u0)); buyAsset({ n: '海外営業所の設備', acct: nx.st.acct, cost, life: nx.st.life, part: 'S', u: u0.id }); E.ksIntlRegister(u0.id, 'asia'); did.intl2 = 1; log('office asia'); } }
  G.grow.hedge = 0.3;
  // M&A
  if (G.m === 30) { const list = E.ksMaFind(); const c = list[0]; const q = E.ksMaQuote(c); log('M&A quote', c.type, 'sc', q.sc, 'price', Y(q.price), 'net', Y(q.net), 'annual', Y(q.annual)); if (E.ksB('cash') < q.price * 1.2) tryBorrow(E.niceAmount(q.price)); if (E.ksB('cash') > q.price) { const r = E.ksMaBuy(c); log('M&A bought', E.ksUName(r.u), 'gw', Y(r.gw)); check('ma'); } }
  // 新規事業
  if (G.m === 40) {
    const S = E.KS_TYPES['ソフトウェア受託開発'];
    const u = { id: 'U' + (++G.useq), type: S.name, n: null, sc: 0.5, op: {}, staff: {}, invB: {}, kpi: {}, startM: G.m };
    E.KS_ENGINE[S.eng].fresh(u);
    const plan = E.KS_ENGINE[S.eng].plan(u);
    G.units.push(u);
    for (const it of plan.items) E.ksBuyAsset(Object.assign({}, it, { u: u.id }));
    if (E.ksLawAddUnit) E.ksLawAddUnit(u);
    log('new unit', S.name, Y(E.sum(plan.items, x => x.cost)));
    check('newunit');
  }
  // 上場の準備と申請
  if (G.m === 20) { E.ksIpoPrep(); log('IPO prep'); }
  if (G.grow.ipo.st === 'prep' && E.ksIpoAuditedFY() >= 2 && G.m - G.grow.ipo.prepM >= 24 && !did.apply) {
    const mk = ['standard', 'growth', 'tpm'].find(mk => { const p = E.ksIpoPlan(mk, 0.2, 0.3); return E.ksIpoChecks(mk, p).every(c => c.ok); });
    if (mk) { const p = E.ksIpoPlan(mk, 0.2, 0.3); E.ksIpoApply(mk, p); did.apply = 1; log('IPO apply', mk, 'float', E.fmtPct(p.float * 100, 1), 'raise', Y(p.raise)); }
    else if (G.m % 12 === 0) log('IPO not ready', JSON.stringify(E.ksIpoChecks('standard', E.ksIpoPlan('standard', 0.2, 0.3)).filter(c => !c.ok).map(c => c.n + ':' + c.v)));
  }
  if (G.grow.ipo.st === 'listed' && !did.div) { G.grow.payout = 0.25; did.div = 1; }
  if (G.grow.ipo.st === 'listed' && !did.po && G.m - G.grow.ipo.listM > 18) { E.ksIpoPO(5e8); did.po = 1; log('PO'); check('po'); }
  E.ksAdvance();
  G = api.G;
  check('adv');
  if (G.pendingModals.length) G.pendingModals = [];
  // 法令の対応（期限の来たものは済ませる・労災は届け出る）
  if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
  if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
  if (G.closing) {
    E.ksAutoClose();
    const fy = E.ksFYList().slice(-1)[0];
    const st = G.fys[fy];
    const s = E.ksToBankFS(st);
    log(`${E.ksFyLabel(fy)} 売上${Y(st.pl.sales)} 営業利益${Y(st.pl.opi)} 経常${Y(st.pl.ord)} 純利益${Y(st.pl.ni)} 現預金${Y(st.bs.cash)} 借入${Y(st.bs.std + st.bs.ltd)} 純資産${Y(s.EQ)} 格付${st.grade} 区分 ${st.pl.cogsKinds.join(',')} 株価${G.grow.ipo.st === 'listed' ? Math.round(G.grow.ipo.price) + '円' : '―'} 時価総額${Y(E.ksMcap())}`);
    for (const sg of st.pl.seg) console.log(`   [${sg.n}] 売上${Y(sg.sales)} 営業利益${Y(sg.opi)}`);
    check('close');
  }
}
console.log('マイルストーン', JSON.stringify(G.grow.ms));
console.log('上場', G.grow.ipo.st, G.grow.ipo.market || '', '株数', G.grow.ipo.shares, '社長', E.fmtPct(G.grow.ipo.own * 100, 1));
console.log('資本金', Y(E.ksB('capital')), '資本準備金', Y(E.ksB('capSurplus')), '利益準備金', Y(E.ksB('legalRes')), 'のれん', Y(E.ksB('goodwill')), '為替差益', Y(E.ksB('fxGain')), '為替差損', Y(E.ksB('fxLoss')));
if (G.over) console.log('GAME OVER', G.over.kind, E.ymLabel(G.over.m));
console.log('整合性エラー', integ);
