// 業態ステージ（地域銀行→メガバンク→テラバンク）をボットで回して検証する
//   node test/run_stage.js <年数> <シード> <開始ステージ0-2> [-v]
const { loadEngine } = require('./load');
const E = loadEngine();
const api = E.__api;
const years = +(process.argv[2] || 10);
const seed = +(process.argv[3] || 1);
const startStage = +(process.argv[4] || 0);
const verbose = process.argv.includes('-v');
const passive = process.argv.includes('--passive');

E.newGame({ seed, bankName: 'テスト銀行', ceoName: 'テスト', difficulty: 'normal', custom: startStage ? { stage: startStage, term: 0 } : { term: 0 } });
let G = api.G;
const Y = x => E.fmtYen(x);

function decideApps() {
  for (const app of G.apps.filter(a => a.status === 'pending')) {
    const big = app.kind === 'biz' && G.companies[app.coId].big;
    const keys = app.kind === 'biz' ? (big || app.amountReq > 1e8 ? ['bureau', 'tax', 'bank'] : ['tax']) : ['credit', 'taxcert'];
    for (const k of keys) if (E.creditCapLeft() >= 1) E.runInvestigation(app, k);
    let found = false;
    if (app.kind === 'biz') { const co = G.companies[app.coId]; found = co.fraud && co.fraud.found; }
    else found = app.person.fraud && app.person.fraud.found;
    const g = E.appSysGrade(app);
    if (found || g >= 8 || (app.kind === 'biz' && app.purpose === 'deficit')) { E.decideApp(app, false); continue; }
    const t = Object.assign({}, app.terms);
    if (app.kind === 'biz') {
      t.rate = +(E.marketLoanRate(g, t.termM)).toFixed(2);
      t.spread = +(t.rate - G.rates.prime).toFixed(2);
      if (!big && g >= 6 && t.amount <= 2.8e8) t.guarantee = 'cgc';
      const lim = E.largeExposureLimit() - E.exposureOf(app.coId);
      if (t.amount > lim) t.amount = Math.max(0, Math.floor(lim / 1e6) * 1e6);
      if (t.amount < 5e6) { E.decideApp(app, false); continue; }
    }
    E.decideApp(app, true, t);
  }
  for (const it of G.inbox.slice()) {
    if (it.type === 'review') {
      for (const L of G.loans.filter(L => L.coId === it.coId && E.isActiveLoan(L))) L.cls = Math.max(L.cls, E.sysClass(L));
      G.inbox = G.inbox.filter(x => x !== it);
    } else if (it.type === 'resched') E.resolveResched(it, true);
    else if (it.type === 'refi') E.resolveRefi(it, true);
    else G.inbox = G.inbox.filter(x => x !== it);
  }
  for (const L of G.loans) if (E.isActiveLoan(L)) L.cls = Math.max(L.cls, E.sysClass(L));
}

function manage() {
  const st = G.stage;
  const cr = E.capitalRatio(), req = E.reqCR();
  // システム
  if (st >= 1) {
    if (E.coreLoad() > 0.75 && !G.itProjects.some(p => p.sys === 'core')) E.startSystemUpgrade('core', 'phased');
    for (const [k, lv] of [['aml', 3], ['cyber', 3], ['credit', 2], ['audit', 2], ['digital', 2]]) {
      if (G.sys[k] < lv && !G.itProjects.some(p => p.sys === k)) E.startSystemUpgrade(k);
    }
  } else {
    // 地域銀行の間は test/run_sim.js と同じ運営
    if (E.cashTarget() >= E.vaultCapacity() * 0.98 && !G.vault.upgrade) E.startVaultUpgrade();
    if ((E.coreLoad() > 0.8 || (G.sys.core < 2 && E.totalAssets() > 700e8)) && !G.itProjects.some(p => p.sys === 'core')) E.startSystemUpgrade('core', 'phased');
    if (G.m === 6) E.startSystemUpgrade('credit');
    if (G.m === 14) E.startSystemUpgrade('aml');
    if (G.sys.aml < 2 && E.totalAssets() > 700e8 && !G.itProjects.some(p => p.sys === 'aml')) E.startSystemUpgrade('aml');
    if (G.m % 18 === 9 && cr > 10) {
      const cand = E.DISTRICTS.filter(d => G.branches.filter(b => b.d === d.id).length === 0);
      if (cand.length) E.openBranch(cand[0].id, 'full');
    }
    if (E.serviceQuality() < 0.95) E.hireStaff('ops', 2);
    for (const P of E.PROJECTS) {
      const pst = G.city.projects[P.id];
      if (pst && pst.status === 'offered' && !pst.ourAmt) {
        const amt = Math.min(pst.maxOurs, E.largeExposureLimit() * 0.9, pst.debt * 0.4);
        if (amt > 5e8 && cr > 9) pst.ourAmt = Math.round(amt / 1e8) * 1e8;
      }
    }
  }
  if (E.compRatio() < 0.95) E.hireStaff('comp', Math.max(1, Math.ceil(E.compRequired() - G.staff.comp)));
  if (E.creditCapLeft() < 3 && G.staff.credit < 30) E.hireStaff('credit', 1);
  // 格上げの申請
  const up = E.canApplyUpgrade();
  if (up.ok) { const r = E.applyUpgrade(); if (verbose) console.log(`  ${E.ymLabel(G.m)} 格上げ申請`, r.ok); }
  // 資本
  if (cr < req + 2.5 && st >= 1) E.raiseCapital(Math.min(E.marketCap() * 0.3, Math.max(1e8, (req + 4) / 100 * E.rwaBreakdown().total - E.coreCapital())));
  // 店舗網
  if (!passive && st >= 1 && cr > req + 3) {
    const regs = (st >= 2 ? E.OVERSEAS : []).concat(E.NATIONS);
    for (const R of regs) {
      const r = G.net[R.id];
      if (r.build) continue;
      const c = E.buildCheck(R.id);
      if (c.ok && E.proFormaCR(-0, c.cost * 0) > req + 3) { E.buildRegion(R.id); if (verbose) console.log(`  ${E.ymLabel(G.m)} ${R.name} → Lv${r.lv + 1} ${Y(c.cost)}`); break; }
    }
    if (G.m - G.stageInfo.lastAcqM >= 12) {
      for (const R of regs) {
        const a = E.acqCheck(R.id, 'stock');
        if (a.ok && a.cr > req + 3) { const res = E.acquireRegion(R.id, 'stock'); if (verbose) console.log(`  ${E.ymLabel(G.m)} 買収 ${a.q.name} ${Y(a.q.price)} CR→${a.cr.toFixed(1)}`, res.ok); break; }
      }
    }
  }
  // 余資で国債
  const ex = E.B('boj') - E.requiredReserve();
  if (ex > E.deposits() * 0.15) E.buyBond(5, Math.floor(ex * 0.3 / 1e8) * 1e8);
  G.credit.nat.app = cr < req + 1.5 ? 'careful' : 'std';
  G.credit.ovs.app = cr < req + 1.5 ? 'careful' : 'std';
}

const t0 = Date.now();
let errs = 0;
console.log(`開始 ${E.STAGES[G.stage].name} 総資産${Y(E.totalAssets())} CR${E.capitalRatio().toFixed(2)}% 格付${E.RATINGS[G.ratingIdx]}`);
for (let i = 0; i < years * 12; i++) {
  G = api.G;
  decideApps();
  manage();
  while (G.pendingDividend) E.decideDividend(0.3);
  E.advanceMonth();
  G = api.G;
  while (G.pendingDividend) E.decideDividend(0.3);
  const e = E.integrityCheck();
  if (e.length) { errs++; if (errs < 5) console.log('INTEGRITY', G.m, e); }
  for (const md of G.pendingModals) if (md.type === 'stage' && verbose) console.log(`  ${E.ymLabel(G.m)} [stage] ${md.kind} ${md.to ?? ''} ${md.reason || ''} ${(md.ng || []).join(' / ')}`);
  if (G.over) { console.log('GAME OVER', G.over.kind, E.ymLabel(G.m)); break; }
  if (E.calMonth(G.m) === 4) {
    const a = G.annual[G.annual.length - 1];
    console.log(`${E.fyYearLabel(a.fy)} ${E.STAGES[G.stage].name.padEnd(5, '　')} 総資産${Y(a.ta).padStart(9)} 預金${Y(a.dep).padStart(9)} 貸出${Y(a.loans).padStart(9)} 純利益${Y(a.pl.net).padStart(9)} ROE${a.roe.toFixed(1)}% OHR${a.ohr.toFixed(0)}% CR${a.cr.toFixed(2)}% NPL${a.npl.toFixed(2)}% ${E.RATINGS[G.ratingIdx]} 国内Lv${E.natLevelSum()} 海外Lv${E.ovsLevelSum()} シェア${E.natShare().toFixed(2)}% 信用${G.trust.toFixed(0)} ${G.eco.regime}`);
    if (verbose) {
      const pl = a.pl;
      console.log(`   粗利${Y(pl.gross)} 資金利益${Y(pl.nii)} 役務${Y(pl.feeNet)} その他${Y(pl.othNet)} 経費${Y(pl.opex)} 与信${Y(pl.credit)} 特別${Y(pl.extra)} 税${Y(pl.tax)}`);
    }
  }
}
console.log(`終了 ${E.ymLabel(G.m)} ${E.STAGES[G.stage].name} 総資産${Y(E.totalAssets())} CR${E.capitalRatio().toFixed(2)}% 整合性エラー${errs}件 ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
