'use strict';
/* =========================================================
 *  09_sim.js : 新規ゲーム・月次処理・決算・株主総会・終了判定
 * ========================================================= */

const SAVE_VERSION = 1;

function newGame(opts = {}) {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0;
  G = {
    version: SAVE_VERSION, seed, rs: seed, m: 0,
    bankName: opts.bankName || DEFAULT_BANK, ceoName: opts.ceoName || '新頭取', difficulty: opts.difficulty || 'normal',
    seq: { co: 0, p: 0, app: 0, loan: 0, inbox: 0, asset: 0, bond: 0, branch: 10, if: 0 },
    ledger: newLedger(), news: [], inbox: [], apps: [], companies: {}, loans: [], bonds: [], assets: [],
    rates: { ord: 0.2, time: 0.4, prime: 1.875, primeLink: true, primeMargin: 1.375, ordLink: true, ordSpread: 0, timeLink: true, timeSpread: 0, mortDisc: 1.05, mortFixSpread: 0.65 },
    dep: { coh: [] },
    staff: { sales: 7, credit: 4, ops: 21, comp: 3 }, salaryLv: 1.0, adBudget: 150e4,
    branches: [], atms: { chuo: 2, ekimae: 1, newtown: 1 },
    vault: { lv: 1, buffer: 1.3, sec: 0, upgrade: null },
    sys: { core: 1, credit: 1, digital: 1, cyber: 0, aml: 0, audit: 0 }, itProjects: [],
    treasury: { autoCall: false, bojBuffer: 1.3 },
    trust: 62, scandalHeat: 0, runShock: 0, pendingInsurance: 0, pendingRecoveries: [],
    flags: { order: -1, lendingBan: -1, publicFunds: false, publicOffer: false, designated: 0, bigDep: 0 },
    stats: {
      investigations: 0, fraudFound: 0, fraudLent: 0, fraudAvoided: 0, fraudDodged: 0, fraudLossAmt: 0,
      loansMade: 0, lentTotal: 0, rejected: 0, declined: 0, prepaid: 0, defaults: 0, defaultAmt: 0, writeoffAmt: 0,
      nplSold: 0, cashShortages: 0, robberies: 0, sysFailures: 0, scandals: 0, auditHits: 0, projectsFunded: 0,
    },
    capUsed: { credit: 0, audit: 0 },
    hist: [], annual: [], fsa: { nextM: 0, history: [], special: false }, ifraud: [], branchReports: {},
    stock: { shares: 3000e4, price: 0, lastIdx: 100 }, shareholders: { sat: 60, warn: 0, hist: [] },
    rejectedLog: [], pendingModals: [], taxLossCF: 0, pendingDividend: null, over: null, termEnded: false,
    initGP: 5.3e8, initOpex: 4.6e8, initNI: 0.3e8, depCalib: 1, ratingIdx: undefined, tutorial: 0,
  };
  G.eco = newEconomy();
  G.city = newCity();
  G.fsa.nextM = randInt(13, 18);
  G.branches = [
    { id: 'b1', d: 'chuo', type: 'hq', openM: -999, name: '本店' },
    { id: 'b2', d: 'ekimae', type: 'full', openM: -120, name: '駅前支店' },
    { id: 'b3', d: 'newtown', type: 'full', openM: -96, name: '北部ニュータウン支店' },
    { id: 'b4', d: 'denen', type: 'small', openM: -200, name: '田園出張所' },
  ];
  setupOpeningBalance();
  // 預金の目標水準を初期残高に合わせて較正
  applyRateLinks();
  G.depCalib = 1;
  const tg = depositTargets();
  G.depCalib = (deposits() - tg.settle) / Math.max(1, tg.ord + tg.time - tg.settle);
  updateRating();
  G.stock.price = netAssets() / G.stock.shares * 0.42;
  G.stock.lastIdx = G.eco.stock;
  addNews('bank', `${G.bankName}が開業。${OLD_UNION}の事業を承継し、${G.ceoName}氏が初代頭取に就任`, 'good');
  addNews('reg', `金融庁は承継した貸出資産の自己査定に注目している。前経営陣の査定は甘かったとの指摘もある`, 'neutral');
  genApplications();
  G.hist.push({ m: -1, bs: bsSnapshot(), pl: {}, kpi: kpiSnapshot() });
  return G;
}

function setupOpeningBalance() {
  const cf = DIFFICULTY[G.difficulty].capital;
  // 承継した事業性融資
  const homeD = ['chuo', 'chuo', 'ekimae', 'ekimae', 'newtown', 'denen', 'kowan', 'kogyo'];
  let bizTotal = 0, lateN = 0, fraudN = 0, weakN = 0;
  const loans = [];
  for (let i = 0; i < 400 && bizTotal < 150e8; i++) {
    const co = genCompany({ district: pick(homeD), qBias: 0.15, fraudMul: 1.2, sizeMul: 2.0 });
    const r = latestRep(co);
    if (r.STD + r.LTD < 5e7) { G.seq.co--; continue; }
    // 承継先の大半は健全。問題先は粉飾2先・業況悪化2先までに限定
    const isFraud = co.fraud && co.fraud.years > 0;
    const weak = co.gTrue >= 8;
    if (isFraud ? fraudN >= 2 : weak ? weakN >= 2 : false) { G.seq.co--; continue; }
    if (isFraud) fraudN++; else if (weak) weakN++;
    G.companies[co.id] = co;
    const capAmt = (isFraud || weak) ? 3.5e8 : 6e8;
    let amt = (r.STD + r.LTD) * uni(0.4, 0.75);
    if (amt > capAmt) amt = capAmt * uni(0.5, 1.0);
    amt = niceAmount(Math.max(3e7, amt));
    const termM = randInt(3, 9) * 12;
    const age = randInt(6, Math.min(60, termM - 6));
    const rateType = chance(0.55) ? 'var' : 'fixed';
    const mrate = marketLoanRate(co.gRep, termM);
    const L = {
      id: 'L' + (++G.seq.loan), kind: 'biz', coId: co.id, name: co.name, ind: co.ind, district: co.district, purpose: pick(['wc', 'capex', 'refi']),
      principal: Math.round(amt * termM / (termM - age)), bal: amt, rateType, rate: +(mrate + uni(-0.2, 0.3)).toFixed(2), termM,
      startM: -age, endM: termM - age, repay: 'equal', status: 'current', dpd: 0, arrears: 0, cls: 0, provision: 0, paidInt: 0,
      restructured: false, ioUntil: -1, stressUntil: -1, grade: co.gRep, fraudKnown: false, inherited: true,
      cgc: chance(0.3) && amt <= 2.8e8 ? 0.8 : 0, personal: chance(0.6),
    };
    L.rate0 = L.rate;
    if (rateType === 'var') { L.spread = +(L.rate - 1.875).toFixed(2); }
    if (co.ownsRE && chance(0.75)) L.collateral = { bank0: reNow(co, co.reEst) * (co.reLien ? 0.6 : 1), true0: reNow(co, co.reTrue) * (co.reLien ? 0.6 : 1), land0: G.city.d[co.district].land };
    if (weak && co.gTrue >= 9 && lateN < 1 && chance(0.7)) { L.status = 'late'; L.dpd = 1; lateN++; }
    co.everBorrowed = true;
    bizTotal += amt;
    loans.push(L);
  }
  const poolBal = roundTo(Math.max(80e8, 270e8 - bizTotal), 1e6);
  G.initBiz = bizTotal;
  const pool = {
    id: 'POOL', kind: 'pool', name: `住宅ローン債権（${OLD_UNION}より承継）`, ind: 'mort', district: 'newtown',
    principal: poolBal, bal: poolBal, rateType: 'var', rate: 0.725, termM: 270, remainM: 270, startM: -60, endM: 270,
    repay: 'annuity', status: 'current', dpd: 0, arrears: 0, cls: 0, provision: 0, paidInt: 0, restructured: false, ioUntil: -1, stressUntil: -1, grade: 3,
  };
  G.loans = loans.concat([pool]);
  for (const L of G.loans) if (L.kind === 'biz') L.cls = L.status === 'late' ? 1 : 0; // 前経営陣の甘い査定
  // 国債
  const bonds = [
    { tenor: 2, face: 20e8, coupon: 0.8, buyM: -6 },
    { tenor: 5, face: 25e8, coupon: 0.3, buyM: -36 },
    { tenor: 10, face: 20e8, coupon: 0.1, buyM: -60 },
    { tenor: 10, face: 15e8, coupon: 0.95, buyM: -18 },
    { tenor: 20, face: 10e8, coupon: 0.8, buyM: -48 },
  ];
  for (const b of bonds) {
    G.bonds.push({ id: 'B' + (++G.seq.bond), tenor: b.tenor, face: b.face, coupon: b.coupon, buyM: b.buyM, matM: b.buyM + b.tenor * 12, book: b.face, name: `利付国債（${b.tenor}年）第${{ 2: 455, 5: 160, 10: 362, 20: 180 }[b.tenor] + G.seq.bond}回` });
  }
  // 固定資産
  const fa = [
    ['本店土地', 'tangible', 6e8, 0], ['本店建物', 'tangible', 5e8, 300], ['支店・出張所の店舗設備', 'tangible', 1.2e8, 120],
    ['ATM（承継分）', 'tangible', 0.6e8, 72], ['勘定系システム（承継）', 'intangible', 1e8, 48],
  ];
  for (const [name, kind, cost, life] of fa) G.assets.push({ id: 'F' + (++G.seq.asset), name, kind, cost, life, m0: 0, book: cost });
  // 定期預金（1年もの）の満期構成
  const timeTotal = 175e8;
  const ws = Array.from({ length: 12 }, () => uni(0.7, 1.3));
  const wsum = sum(ws);
  let allocated = 0;
  for (let i = 0; i < 12; i++) {
    const bal = i === 11 ? timeTotal - allocated : roundTo(timeTotal * ws[i] / wsum, 1e6);
    allocated += bal;
    G.dep.coh.push({ bal, rate: +(0.25 + 0.15 * ((i + 12 - 0) % 12) / 11).toFixed(3) });
  }
  const ordDep = 230e8;
  const cash = 11e8;
  const sec = sum(G.bonds, b => b.face);
  const loanSum = sum(G.loans, L => L.bal);
  const tang = sum(G.assets.filter(a => a.kind === 'tangible'), a => a.book);
  const intang = sum(G.assets.filter(a => a.kind === 'intangible'), a => a.book);
  const capital = roundTo(30e8 * cf, 1e8), surplus = 5e8, retained = 3e8;
  const boj = ordDep + timeTotal + capital + surplus + retained - cash - sec - loanSum - tang - intang;
  if (boj < 10e8) throw new Error('初期の日銀預け金が不足: ' + boj);
  post('開業時の資産・負債の承継', [
    ['cash', cash, 0], ['boj', boj, 0], ['securities', sec, 0], ['loans', loanSum, 0], ['tangible', tang, 0], ['intangible', intang, 0],
    ['depOrd', 0, ordDep], ['depTime', 0, timeTotal], ['capital', 0, capital], ['capSurplus', 0, surplus], ['retained', 0, retained],
  ]);
  // 承継債権の引当（前経営陣の区分のまま）
  let prov = 0;
  for (const L of G.loans) { L.provision = provisionFor(L, L.cls); prov += L.provision; }
  post('承継債権に対する貸倒引当金の計上', [['retained', prov, 0], ['allowance', 0, prov]]);
  G.ledger.mflow = {};
  closeJournalMonth(-1);
}

/* ---------- KPI ---------- */
function kpiSnapshot() {
  const rw = rwaBreakdown();
  const cs = cityStats();
  return {
    ta: Math.round(totalAssets()), dep: Math.round(deposits()), loans: Math.round(B('loans')), na: Math.round(netAssets()),
    cr: +(coreCapitalParts(rw).core / Math.max(1, rw.total) * 100).toFixed(2), npl: +nplRatio().toFixed(2), trust: +G.trust.toFixed(1),
    rating: G.ratingIdx, price: Math.round(G.stock.price || 0), pop: Math.round(cs.pop), vit: +cs.vit.toFixed(1),
    share: +(cs.share * 100).toFixed(2), policy: G.eco.policy, y10: +G.eco.y[10].toFixed(3), prime: G.rates.prime,
    ord: G.rates.ord, time: G.rates.time, unreal: Math.round(unrealizedGain()),
    gdp: +G.eco.gdp.toFixed(2), cpi: +G.eco.cpi.toFixed(2), unemp: +G.eco.unemp.toFixed(2), landN: +G.eco.land.toFixed(1), stockN: +G.eco.stock.toFixed(1),
  };
}

/* 月次の損益集計（mflowから） */
function plSummary(pl) {
  const g = k => pl[k] || 0;
  const fundInc = g('intLoans') + g('intSec') + g('intCall') + g('intBoj');
  const fundExp = g('intDep') + g('intCallM') + g('intBorrow');
  const feeNet = g('fees') - g('feeExp');
  const othNet = g('bondGain') - g('bondLoss');
  const opex = g('personnel') + g('premises') + g('taxes') + g('depreciation') + g('depInsurance');
  const credit = g('provExp') + g('writeoff') - g('provRev') - g('recoveries');
  const ordRev = sum(REV_KEYS.filter(k => ACCT[k].grp !== 'extra'), k => g(k));
  const ordExp = sum(EXP_KEYS.filter(k => ACCT[k].grp !== 'extra' && ACCT[k].grp !== 'tax'), k => g(k));
  const ordinary = ordRev - ordExp;
  const extra = g('extraGain') - g('extraLoss');
  const pretax = ordinary + extra;
  const net = pretax - g('incomeTax');
  const gross = fundInc - fundExp + feeNet + othNet;
  return { fundInc, fundExp, nii: fundInc - fundExp, feeNet, othNet, gross, opex, core: gross - othNet - opex, credit, ordinary, extra, pretax, tax: g('incomeTax'), net, ordRev, ordExp };
}
function sumPL(fromM, toM) {
  const acc = {};
  for (const h of G.hist) if (h.m >= fromM && h.m <= toM) for (const k in h.pl) acc[k] = (acc[k] || 0) + h.pl[k];
  return acc;
}

/* ---------- 月次処理 ---------- */
function advanceMonth() {
  if (G.over) return null;
  const m = G.m;
  const before = { dep: deposits(), loans: B('loans'), ta: totalAssets(), trust: G.trust, newsLen: G.news.length };
  G.pendingModals = [];
  // ===== 当月末の処理 =====
  processLoans();
  processDeposits();
  payDepositInterest();
  processTreasuryMonthly();
  processFeesAndExpenses();
  depreciateAssets();
  processVault();
  processInternalFraudMonthly();
  trueUpProvisions();
  manageLiquidity();
  if (G.over) return finishAdvance(m, before);
  makeBranchReports();
  let fyClosed = false;
  if (calMonth(m) === 3) { yearEndClosing(); fyClosed = true; }
  const flow = closeJournalMonth(m);
  G.hist.push({ m, bs: bsSnapshot(), pl: flow, kpi: kpiSnapshot() });
  if ([6, 9, 12, 3].includes(calMonth(m))) { updateRating(); G.hist[G.hist.length - 1].kpi.rating = G.ratingIdx; }
  pruneState();
  // ===== 翌月 =====
  G.m = m + 1;
  G.capUsed = { credit: 0, audit: 0 };
  ecoStep();
  applyRateLinks();
  for (const D of DISTRICTS) { const s = G.city.d[D.id]; s.mortNew.push(s.mortCur || 0); s.mortCur = 0; }
  cityStep();
  expireApps();
  expireInbox();
  borrowerMonthly();
  itProjectsStep();
  vaultUpgradeStep();
  for (const b of G.branches) if (b.openM === G.m) addNews('bank', `「${b.name}」が開業した`, 'good');
  staffStep();
  eventsStep();
  fsaStep();
  if (calMonth(G.m) === 5) payTaxes();
  if (calMonth(G.m) === 6) shareholdersMeeting();
  updateTrust();
  updateStock();
  checkCapital();
  if (!G.over) manageLiquidity();
  if (!G.over) genApplications();
  return finishAdvance(m, before, fyClosed);
}

function finishAdvance(m, before, fyClosed) {
  const h = G.hist[G.hist.length - 1];
  const rep = {
    m, fyClosed: !!fyClosed,
    pl: h && h.m === m ? plSummary(h.pl) : null,
    dDep: deposits() - before.dep, dLoans: B('loans') - before.loans, dTA: totalAssets() - before.ta, dTrust: G.trust - before.trust,
    news: G.news.slice(0, Math.max(0, G.news.length - before.newsLen)).filter(n => n.m >= m),
    newApps: G.apps.filter(a => a.m === G.m && a.status === 'pending').length,
  };
  G.lastReport = rep;
  return rep;
}

function expireApps() {
  for (const a of G.apps) {
    if (a.status === 'pending' && a.exp < G.m) { a.status = 'expired'; a.decidedM = G.m - 1; }
  }
  // 古い案件と、取引のない企業データを整理
  G.apps = G.apps.filter(a => a.status === 'pending' || G.m - (a.decidedM ?? a.m) <= 2);
}

function pruneState() {
  // 完済・償却から3年以上たった融資を整理
  G.loans = G.loans.filter(L => isActiveLoan(L) || G.m - (L.closedM ?? G.m) <= 36);
  const keep = new Set();
  for (const L of G.loans) if (L.coId) keep.add(L.coId);
  for (const a of G.apps) if (a.coId) keep.add(a.coId);
  for (const r of G.rejectedLog) keep.add(r.coId);
  for (const id of Object.keys(G.companies)) if (!keep.has(id)) delete G.companies[id];
  if (G.annual.length > 30) G.annual.shift();
  if (G.hist.length > 400) G.hist.shift();
}

function payTaxes() {
  const t = B('taxPayable');
  if (t > 0) { ensureFunds(t); post('法人税等の納付', [['taxPayable', t, 0], ['boj', 0, t]]); }
}

/* 市場連動の金利設定 */
function applyRateLinks() {
  const r = G.rates, e = G.eco;
  const r3 = x => Math.round(x * 1000) / 1000;
  if (r.primeLink) r.prime = r3(e.policy + r.primeMargin);
  if (r.ordLink) r.ord = r3(Math.max(0.001, e.mktOrd + r.ordSpread));
  if (r.timeLink) r.time = r3(Math.max(0.002, e.mktTime + r.timeSpread));
}

/* ---------- 決算 ---------- */
function yearEndClosing() {
  const fy = fyOf(G.m);
  const audit = externalAudit();
  const pretax = curProfit();
  let tax = 0;
  if (pretax > 0) {
    const taxable = pretax - G.taxLossCF;
    if (taxable > 0) { tax = Math.round(taxable * TAX_RATE); G.taxLossCF = 0; }
    else G.taxLossCF -= pretax;
  } else G.taxLossCF += -pretax;
  tax += 300e4; // 住民税均等割など
  post('法人税、住民税及び事業税の計上', [['incomeTax', tax, 0], ['taxPayable', 0, tax]]);
  const rep = buildAnnualReport(fy, audit);
  G.annual.push(rep);
  closeBooks('決算振替（損益勘定を利益剰余金へ）');
  const ni = rep.pl.net;
  const allowed = !G.flags.publicFunds && capitalRatio() >= 6 && ni > 0;
  G.pendingDividend = { fy, ni, allowed, max: allowed ? Math.round(ni * 0.6) : 0 };
  G.pendingModals.push({ type: 'yearEnd', fy });
  if (fy === TERM_YEARS - 1 && !G.termEnded) { G.termEnded = true; G.pendingModals.push({ type: 'term' }); }
}

function buildAnnualReport(fy, audit) {
  const fromM = fy * 12, toM = fy * 12 + 11;
  const acc = sumPL(fromM, toM - 1);
  for (const k in G.ledger.mflow) acc[k] = (acc[k] || 0) + G.ledger.mflow[k];
  const pl = plSummary(acc);
  const rw = rwaBreakdown();
  const parts = coreCapitalParts(rw);
  const npl = nplBreakdown();
  const prev = G.annual[G.annual.length - 1];
  const bs = bsSnapshot();
  return {
    fy, m: G.m, bs, plRaw: acc, pl,
    ta: totalAssets(), dep: deposits(), loans: B('loans'), na: netAssets(),
    cr: parts.core / rw.total * 100, core: parts.core, rwa: rw.total, npl: npl.ratio, nplAmt: npl.npl,
    roa: pl.net / Math.max(1, (totalAssets() + (prev ? prev.ta : totalAssets())) / 2) * 100,
    roe: pl.net / Math.max(1, (netAssets() + (prev ? prev.na : netAssets())) / 2) * 100,
    ohr: pl.gross > 0 ? pl.opex / pl.gross * 100 : 0,
    audit, rating: G.ratingIdx, trust: G.trust, price: G.stock.price, pop: cityStats().pop, vit: cityStats().vit,
    unreal: unrealizedGain(), branches: openBranches().length, staff: staffTotal(),
  };
}

/* 配当の決定（決算モーダルから） */
function decideDividend(ratio) {
  const d = G.pendingDividend;
  if (!d) return { ok: false };
  const amt = d.allowed ? Math.round(Math.max(0, d.ni) * clamp(ratio, 0, 0.6)) : 0;
  if (amt > 0) post('剰余金の配当の決議', [['retained', amt, 0], ['divPayable', 0, amt]]);
  const rep = G.annual.find(a => a.fy === d.fy);
  if (rep) { rep.dividend = amt; rep.payout = d.ni > 0 ? amt / d.ni : 0; }
  G.lastPayout = d.ni > 0 ? amt / d.ni : 0;
  G.pendingDividend = null;
  return { ok: true, amt };
}

/* ---------- 株主総会（6月） ---------- */
function shareholdersMeeting() {
  const div = B('divPayable');
  if (div > 0) { ensureFunds(div); post('配当金の支払', [['divPayable', div, 0], ['boj', 0, div]]); }
  const last = G.annual[G.annual.length - 1];
  if (!last) return;
  const h12 = G.hist[G.hist.length - 13];
  const ret = h12 && h12.kpi.price ? (G.stock.price / h12.kpi.price - 1) * 100 : 0;
  let sat = 55 + 2.5 * clamp(last.roe, -8, 10) + 30 * Math.min(0.5, G.lastPayout || 0) + 0.2 * clamp(ret, -50, 50)
    - 6 * Math.min(3, G.scandalHeat / 6) + (G.ratingIdx <= 5 ? 5 : 0) - (G.shareholders.dilution || 0) * 25;
  if (last.pl.net < 0) sat -= 6;
  sat = clamp(sat, G.annual.length <= 1 ? 30 : 0, 100);
  G.shareholders.dilution = 0;
  G.shareholders.sat = sat;
  const approval = clamp(42 + sat * 0.6 + randn() * 2, 20, 99);
  G.shareholders.hist.push({ m: G.m, sat, approval });
  if (approval < 50) {
    if (G.shareholders.warn >= 1 && G.annual.length >= 2) { gameOver('dismissed', approval); return; }
    G.shareholders.warn = 1;
    const ap = 50 + rand() * 2;
    G.shareholders.hist[G.shareholders.hist.length - 1].approval = ap;
    addNews('bank', `株主総会で頭取の再任議案は大株主の支持で辛うじて可決（賛成率${fmtNum(ap, 1)}%）。来年も業績が振るわなければ解任は避けられない`, 'bad');
    G.pendingModals.push({ type: 'agm', approval: ap, sat, warn: true });
    return;
  }
  if (sat < 30) {
    G.shareholders.warn++;
    addNews('bank', `株主総会で経営陣への批判が相次ぐ。頭取の再任議案の賛成率は${fmtNum(approval, 1)}%`, 'bad');
  } else {
    G.shareholders.warn = 0;
    addNews('bank', `定時株主総会を開催。頭取の再任議案は賛成率${fmtNum(approval, 1)}%で可決`, 'good');
  }
  G.pendingModals.push({ type: 'agm', approval, sat });
}

/* ---------- 自己資本・存続判定 ---------- */
function checkCapital() {
  const cr = capitalRatio();
  const na = netAssets();
  if (na < 0) { gameOver('insolvent'); return; }
  const q = [6, 9, 12, 3].includes(calMonth(G.m));
  if (cr < 4 && !G.flags.publicFunds && !G.flags.publicOffer && G.stats.publicFundsAmt === undefined) {
    G.flags.publicOffer = true;
    G.pendingModals.push({ type: 'publicFunds' });
  }
  if (!q) return;
  if (cr < 0) { gameOver('suspended'); return; }
  if (cr < 2 && G.flags.pca !== 2) {
    G.flags.pca = 2; G.flags.lendingBan = G.m + 3;
    addNews('reg', `自己資本比率が${fmtPct(cr)}に低下。早期是正措置（第2区分）により新規融資の抑制を命じられた`, 'bad');
  } else if (cr < 4 && !G.flags.pca) {
    G.flags.pca = 1;
    addNews('reg', `自己資本比率が${fmtPct(cr)}と国内基準の4%を下回り、早期是正措置（第1区分）として経営改善計画の提出を求められた`, 'bad');
  } else if (cr >= 4) G.flags.pca = 0;
}

const OVER_TEXT = {
  liquidity: { title: '資金繰り破綻', text: '預金の払い戻しに応じる資金を調達できず、経営破綻に追い込まれました。' },
  insolvent: { title: '債務超過', text: '純資産がマイナスとなり、銀行として存続できなくなりました。' },
  suspended: { title: '業務停止命令', text: '自己資本比率がマイナスとなり、金融庁から業務停止命令を受けました。' },
  dismissed: { title: '頭取解任', text: '株主総会で再任議案が否決され、頭取の職を解かれました。' },
};
function gameOver(kind, extra) {
  if (G.over) return;
  G.over = { kind, m: G.m, extra };
  addNews('bank', `【${OVER_TEXT[kind].title}】${OVER_TEXT[kind].text}`, 'bad');
  G.pendingModals.push({ type: 'gameover' });
}

/* ---------- 経営評価（任期満了・終了時） ---------- */
function finalEvaluation() {
  const first = G.hist[0].kpi;
  const cs = cityStats();
  const ta = totalAssets();
  const cumNI = sum(G.annual, a => a.pl.net);
  const s = G.stats;
  const parts = [];
  const add = (name, pts, max, note) => parts.push({ name, pts: Math.round(clamp(pts, 0, max)), max, note });
  add('規模の拡大', Math.log2(ta / first.ta) * 12 + 5, 25, `総資産 ${fmtYen(first.ta)} → ${fmtYen(ta)}`);
  add('収益力', cumNI / 1e8 * 0.6 + 5, 20, `累計当期純利益 ${fmtYen(cumNI)}`);
  add('健全性', (capitalRatio() - 4) * 1.5 + (5 - nplRatio()) * 1.5, 20, `自己資本比率 ${fmtPct(capitalRatio())}、不良債権比率 ${fmtPct(nplRatio())}`);
  add('審査の目', s.fraudFound * 1.2 + s.fraudDodged * 0.8 - s.fraudLent * 0.6 + 4, 15, `粉飾の発見 ${s.fraudFound}件、粉飾先への融資 ${s.fraudLent}件`);
  add('地域の発展', (cs.vit - 100) * 0.6 + (cs.pop / first.pop - 1) * 100 + s.projectsFunded * 1.5 + 4, 15, `人口 ${fmtNum(first.pop)}人 → ${fmtNum(cs.pop)}人、地域活力 ${fmtNum(cs.vit, 1)}`);
  add('ガバナンス', 5 - s.scandals * 1.2 - G.fsa.history.filter(h => h.grade === 'D').length * 2 - (G.flags.publicFunds || s.publicFundsAmt ? 3 : 0), 5, `不祥事 ${s.scandals}件`);
  const total = sum(parts, p => p.pts);
  const rank = total >= 85 ? 'S' : total >= 70 ? 'A' : total >= 55 ? 'B' : total >= 40 ? 'C' : 'D';
  const title = { S: '名頭取として語り継がれる', A: '地域に信頼される名経営者', B: '堅実な経営者', C: '可もなく不可もない頭取', D: '課題の多い経営だった' }[rank];
  return { parts, total, rank, title };
}

function bankClass(ta = totalAssets()) {
  let c = BANK_CLASSES[0];
  for (const k of BANK_CLASSES) if (ta >= k.min) c = k;
  return c;
}

/* ---------- セーブ／ロード ---------- */
function serialize() { return JSON.stringify(G); }
function deserialize(json) {
  const s = JSON.parse(json);
  if (!s || s.version !== SAVE_VERSION || !s.ledger) throw new Error('セーブデータの形式が違います');
  G = s;
  G.pendingModals = G.pendingModals || [];
  return G;
}

/* 内部整合性のチェック（開発・検証用） */
function integrityCheck() {
  const errs = [];
  const d = ledgerDiff();
  if (Math.abs(d) > 1) errs.push('貸借不一致 ' + d);
  const lsum = sum(G.loans.filter(isActiveLoan), L => L.bal);
  if (Math.abs(lsum - B('loans')) > 1) errs.push(`貸出金の補助元帳不一致 ${lsum} vs ${B('loans')}`);
  const bsum = sum(G.bonds, b => b.book);
  if (Math.abs(bsum - B('securities')) > 1) errs.push(`有価証券の補助元帳不一致 ${bsum} vs ${B('securities')}`);
  const tsum = sum(G.dep.coh, c => c.bal);
  if (Math.abs(tsum - B('depTime')) > 1) errs.push(`定期預金の補助元帳不一致 ${tsum} vs ${B('depTime')}`);
  const tg = sum(G.assets.filter(a => a.kind === 'tangible'), a => a.book);
  if (Math.abs(tg - B('tangible')) > 1) errs.push(`有形固定資産の補助元帳不一致 ${tg} vs ${B('tangible')}`);
  const ig = sum(G.assets.filter(a => a.kind === 'intangible'), a => a.book);
  if (Math.abs(ig - B('intangible')) > 1) errs.push(`無形固定資産の補助元帳不一致 ${ig} vs ${B('intangible')}`);
  const prov = sum(G.loans.filter(isActiveLoan), L => L.provision || 0);
  if (Math.abs(prov - B('allowance')) > 1) errs.push(`引当金の補助元帳不一致 ${prov} vs ${B('allowance')}`);
  for (const k of ['cash', 'boj', 'depOrd', 'depTime']) if (B(k) < -1) errs.push(`${ACCT[k].name}がマイナス ${B(k)}`);
  for (const k of ACCT_KEYS) if (!isFinite(B(k))) errs.push(`${k} が数値でない`);
  for (const L of G.loans) if (isActiveLoan(L) && (!isFinite(L.bal) || L.bal < 0)) errs.push(`融資残高異常 ${L.id} ${L.bal}`);
  return errs;
}
