// ボットで数十年分を回し、帳簿の整合性と経営指標の推移を確認する
const { loadEngine } = require('./load');
const E = loadEngine();
const api = E.__api;
const years = +(process.argv[2] || 10);
const seed = +(process.argv[3] || 12345);
const policy = process.argv[4] || 'bot';
const verbose = process.argv.includes('-v');

E.newGame({ seed, bankName: 'テスト銀行', ceoName: 'テスト', difficulty: 'normal' });
let G = api.G;
const fmt = x => E.fmtYen(x);

function botMonth() {
  G = api.G;
  // 申込の審査
  for (const app of G.apps.filter(a => a.status === 'pending')) {
    if (policy === 'passive') { E.decideApp(app, false); continue; }
    const keys = app.kind === 'biz' ? (app.amountReq > 1e8 ? ['bureau', 'tax', 'bank'] : ['tax']) : ['credit', 'taxcert'];
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
      if (g >= 6 && t.amount <= 2.8e8) t.guarantee = 'cgc';
      const lim = E.largeExposureLimit() - E.exposureOf(app.coId);
      if (t.amount > lim) t.amount = Math.max(0, Math.floor(lim / 1e6) * 1e6);
      if (t.amount < 5e6) { E.decideApp(app, false); continue; }
    }
    E.decideApp(app, true, t);
  }
  // 受信箱
  for (const it of G.inbox.slice()) {
    if (it.type === 'review') {
      const loans = G.loans.filter(L => L.coId === it.coId && E.isActiveLoan(L));
      for (const L of loans) L.cls = Math.max(L.cls, E.sysClass(L));
      G.inbox = G.inbox.filter(x => x !== it);
    } else if (it.type === 'resched') E.resolveResched(it, true);
    else if (it.type === 'refi') E.resolveRefi(it, true);
    else if (it.type === 'fsaNotice') G.inbox = G.inbox.filter(x => x !== it);
  }
  // 自己査定（システム判定に合わせる）
  for (const L of G.loans) if (E.isActiveLoan(L)) L.cls = Math.max(L.cls, E.sysClass(L));
  // プロジェクト
  for (const P of E.PROJECTS) {
    const st = G.city.projects[P.id];
    if (st && st.status === 'offered' && !st.ourAmt) {
      const amt = Math.min(st.maxOurs, E.largeExposureLimit() * 0.9, st.debt * 0.4);
      if (amt > 5e8 && E.capitalRatio() > 9) st.ourAmt = Math.round(amt / 1e8) * 1e8;
    }
  }
  if (policy === 'bot') {
    // 設備投資
    if (E.cashTarget() >= E.vaultCapacity() * 0.98 && !G.vault.upgrade) E.startVaultUpgrade();
    if (E.coreLoad() > 0.8 && !G.itProjects.some(p => p.sys === 'core')) E.startSystemUpgrade('core', 'phased');
    if (G.m === 6) E.startSystemUpgrade('credit');
    if (G.m === 14) E.startSystemUpgrade('aml');
    if (G.m % 18 === 9 && E.capitalRatio() > 10) {
      const pres = E.districtPresence();
      const cand = E.DISTRICTS.filter(d => G.branches.filter(b => b.d === d.id).length === 0);
      if (cand.length) E.openBranch(cand[0].id, 'full');
    }
    if (E.serviceQuality() < 0.95) E.hireStaff('ops', 2);
    if (E.compRatio() < 0.9) E.hireStaff('comp', 1);
    if (E.creditCapLeft() < 1 && G.apps.filter(a => a.status === 'pending').length > 2 && G.staff.credit < 12) E.hireStaff('credit', 1);
    // 余資で国債
    const ex = E.B('boj') - E.requiredReserve();
    if (ex > E.deposits() * 0.12) E.buyBond(5, Math.floor(ex * 0.4 / 1e8) * 1e8);
  }
}

const t0 = Date.now();
let errsTotal = 0;
for (let i = 0; i < years * 12; i++) {
  botMonth();
  const rep = E.advanceMonth();
  G = api.G;
  for (const mm of G.pendingModals) {
    if (mm.type === 'yearEnd') E.decideDividend(0.3);
    if (mm.type === 'publicFunds') E.acceptPublicFunds();
  }
  G.pendingModals = [];
  const errs = E.integrityCheck();
  if (errs.length) { errsTotal++; console.log('M' + G.m, 'INTEGRITY', errs.join(' | ')); if (errsTotal > 5) break; }
  if (G.over) { console.log('GAME OVER', G.over, E.ymLabel(G.m)); break; }
  if (verbose && rep && rep.pl) console.log(E.ymLabel(rep.m), 'net', fmt(rep.pl.net), 'dep', fmt(E.deposits()), 'loans', fmt(E.B('loans')), 'CR', E.capitalRatio().toFixed(2), 'trust', G.trust.toFixed(1));
}
console.log(`--- seed ${seed} policy ${policy} (${Date.now() - t0}ms) ---`);
for (const a of G.annual) {
  console.log(`FY${a.fy + 1} TA ${fmt(a.ta)} DEP ${fmt(a.dep)} LOAN ${fmt(a.loans)} | 粗利 ${fmt(a.pl.gross)} 経費 ${fmt(a.pl.opex)} 与信費用 ${fmt(a.pl.credit)} 経常 ${fmt(a.pl.ordinary)} 純益 ${fmt(a.pl.net)} | CR ${a.cr.toFixed(2)}% NPL ${a.npl.toFixed(2)}% ROA ${a.roa.toFixed(2)}% OHR ${a.ohr.toFixed(0)}% 格付${E.RATINGS[a.rating]} 信用${a.trust.toFixed(0)} 株価${a.price.toFixed(0)} 人口${Math.round(a.pop)} 活力${a.vit.toFixed(1)} 監査:${a.audit.opinion}`);
}
const s = G.stats;
console.log('stats', JSON.stringify(s));
console.log('policy rate', G.eco.policy, 'y10', G.eco.y[10].toFixed(2), 'regime', G.eco.regime, 'fsa', G.fsa.history.map(h => h.grade + '@' + h.m).join(','));
console.log('loans active', G.loans.filter(E.isActiveLoan).length, 'companies', Object.keys(G.companies).length, 'save size KB', Math.round(E.serialize().length / 1024));
console.log('branches', G.branches.map(b => b.name).join(','), 'vault', G.vault.lv, 'core', G.sys.core, 'staff', JSON.stringify(G.staff));
const projs = Object.entries(G.city.projects).map(([k, v]) => k + ':' + v.status).join(' ');
console.log('projects', projs);
