'use strict';
/* =========================================================
 *  09_stage.js : 業態ステージ（地域銀行 → メガバンク → テラバンク）
 *    全国・海外の店舗網、リテール・中小企業ポートフォリオ、
 *    為替と外貨調達、地銀・現地銀行の買収、規模に応じた大型リスク、
 *    格上げ審査・維持基準・格下げ
 * ========================================================= */

/* ---------- エリア（汐見市の地区・国内の地域・海外の地域）の共通アクセサ ---------- */
const isCityArea = a => !!DIST[a];
const isNatArea = a => !!NATR[a];
const isOvsArea = a => !!OVSR[a];
const areaDef = a => DIST[a] || NATR[a] || OVSR[a];
const regionDef = a => NATR[a] || OVSR[a];
function areaName(a) { const d = areaDef(a); return d ? d.name : String(a); }
function areaMix(a) { return areaDef(a).mix; }
function areaVit(a) {
  if (DIST[a]) return G.city.d[a].vit;
  const r = G.net && G.net[a];
  return r ? r.vit : 100;
}
function areaLand(a) {
  if (DIST[a]) return G.city.d[a].land;
  const r = G.net && G.net[a];
  return r ? r.land : 100;
}
const regionLevels = a => (isOvsArea(a) ? OVS_LEVELS : NAT_LEVELS);
const LEVEL_GAP = 12; // 一つの段階が完成してから次の拡大に着手できるまでの月数
const regionScale = a => (isOvsArea(a) ? ovsScale(OVSR[a]) : natScale(NATR[a]));

/* ---------- 状態 ---------- */
function newNetState() {
  const net = {};
  for (const R of NATIONS) net[R.id] = { lv: 0, build: null, since: -1, ord: 0, time: 0, tRate: 0.3, vit: 100 + randn() * 2, land: 100, pdMul: 1, pdUntil: -1, shock: null, frozenUntil: -1 };
  for (const R of OVERSEAS) net[R.id] = { lv: 0, build: null, since: -1, dep: 0, vit: 100 + 5 * (R.growth - 2.5), land: 100, rate: R.rate0, fx: 1, lastFx: 0, basis: 0.3, basisUntil: -1, gap: 0, pdMul: 1, pdUntil: -1, shock: null, frozenUntil: -1 };
  return net;
}
function newStageInfo(stage) {
  return { since: 0, review: null, strikes: 0, warnM: -1, cooldownUntil: -1, rejectedUntil: -1, maxStage: stage, startStage: stage, lastAcqM: -999, hist: [] };
}
function defaultCredit() { return { nat: { app: 'std', adj: 0 }, ovs: { app: 'std', adj: 0 }, hedge: 0.8 }; }

const stageOf = () => G.stage || 0;
const reqCR = () => STAGES[stageOf()].reqCR;
function natLevelSum() { return G.net ? sum(NATIONS, R => G.net[R.id].lv) : 0; }
function ovsLevelSum() { return G.net ? sum(OVERSEAS, R => G.net[R.id].lv) : 0; }

/* ---------- 預金の内訳 ---------- */
function natOrd() { return G.net ? sum(NATIONS, R => G.net[R.id].ord) : 0; }
function natTime() { return G.net ? sum(NATIONS, R => G.net[R.id].time) : 0; }
function natDep() { return natOrd() + natTime(); }
function cityOrd() { return B('depOrd') - natOrd(); }
function cityTime() { return B('depTime') - natTime(); }
function cityDeposits() { return cityOrd() + cityTime(); }
function domDeposits() { return B('depOrd') + B('depTime'); }
function natMarketDep() { return sum(NATIONS, R => R.dep) * 1e12; }
/* 国内の預金シェア（%）。全国の預金市場＋汐見市 */
function natShare() { return domDeposits() / (natMarketDep() + cityStats().depMkt) * 100; }

/* ---------- 店舗網の規模 ---------- */
function regionStaff(a) { const r = G.net[a]; return Math.round(regionLevels(a)[r.lv].staff * regionScale(a)); }
function regionBranches(a) {
  const r = G.net[a];
  const n = regionLevels(a)[r.lv].br;
  return n <= 2 ? n : Math.max(1, Math.round(n * Math.pow(regionScale(a), 0.6)));
}
function netStaff() { return G.net ? sum(NATIONS.concat(OVERSEAS), R => regionStaff(R.id)) : 0; }
function netBranches() { return G.net ? sum(NATIONS.concat(OVERSEAS), R => regionBranches(R.id)) : 0; }
function regionOpex(a) {
  const r = G.net[a], LV = regionLevels(a), sc = regionScale(a);
  let x = LV[r.lv].opex * sc;
  if (r.build) x += Math.max(0, LV[r.build.to].opex - LV[r.lv].opex) * sc * 0.25; // 開設準備
  return x;
}

/* ---------- リテール・中小企業ポートフォリオ（G.loans の kind:'seg'） ---------- */
function segMix(a, lv) {
  if (isOvsArea(a)) return lv >= 3 ? { retail: 0.3, sme: 0.7 } : { retail: 0, sme: 1 };
  return { retail: SEG.retail.mix, sme: SEG.sme.mix };
}
const segName = (a, seg) => (isOvsArea(a) ? SEG[seg].ovsName : SEG[seg].name);
function segLoans(a) { return G.loans.filter(L => L.kind === 'seg' && isActiveLoan(L) && (!a || L.area === a)); }
function areaLoanBal(a) { return sum(segLoans(a), L => L.bal); }
function findSegLoan(a, seg) { return G.loans.find(L => L.kind === 'seg' && L.area === a && L.seg === seg && L.status === 'current'); }
function ensureSegLoan(a, seg) {
  let L = findSegLoan(a, seg);
  if (!L) {
    L = {
      id: 'L' + (++G.seq.loan), kind: 'seg', seg, area: a, district: a, name: `${areaName(a)}・${segName(a, seg)}`, ind: 'seg',
      principal: 0, bal: 0, rate: 0, rate0: 0, termM: 0, startM: G.m, endM: G.m + 9999, repay: 'pool', status: 'current', dpd: 0, arrears: 0,
      cls: 0, provision: 0, paidInt: 0, restructured: false, ioUntil: -1, stressUntil: -1, grade: seg === 'retail' ? 3 : 5, fraudKnown: false,
      vr: 1, pd: SEG[seg].pd, npl: 0, lossYTD: 0,
    };
    G.loans.push(L);
  }
  return L;
}
function segRate(L) {
  const S = SEG[L.seg], ovs = isOvsArea(L.area);
  const pol = G.credit[ovs ? 'ovs' : 'nat'];
  const base = ovs ? G.net[L.area].rate + S.ovsSpread : G.rates.prime + S.spread;
  return Math.max(0.2, base + pol.adj);
}
const segLGD = L => SEG[L.seg].lgd + (isOvsArea(L.area) ? 0.1 : 0);
function segPD(L) {
  const S = SEG[L.seg], a = L.area, r = G.net[a];
  let pd = S.pd * Math.pow(G.eco.defMult / 0.9, 0.7) * (L.vr || 1) * Math.exp(-(r.vit - 100) / 50);
  if (isOvsArea(a)) pd *= COUNTRY_PD[OVSR[a].risk];
  if (r.pdUntil >= G.m) pd *= r.pdMul;
  return clamp(pd, 0.05, 35);
}
function segTarget(L) {
  const a = L.area, r = G.net[a], ovs = isOvsArea(a), R = regionDef(a);
  const lvd = regionLevels(a)[r.lv];
  if (!lvd || !lvd.loan || r.frozenUntil > G.m) return 0;
  const pol = G.credit[ovs ? 'ovs' : 'nat'];
  const mix = segMix(a, r.lv)[L.seg];
  const dem = ovs ? clamp(r.vit / 100, 0.6, 1.4) : clamp(G.eco.demand * r.vit / 100, 0.45, 1.5);
  const trustF = clamp(Math.pow(G.trust / 65, 0.5), 0.6, 1.2);
  return R.loan * 1e12 * lvd.loan * mix * APPETITE[pol.app].vol * Math.exp(-1.5 * pol.adj) * dem * trustF / (ovs ? 1 : Math.sqrt(R.compet));
}
/* 月次：利息・延滞と償却・約定返済・新規実行 */
function processSegPool(L) {
  const S = SEG[L.seg];
  const ovs = isOvsArea(L.area);
  L.rate = segRate(L);
  L.pd = segPD(L);
  const bal0 = L.bal;
  if (L.bal > 0) {
    const interest = Math.round(L.bal * L.rate / 1200);
    receive(interest, 'intLoans', ovs ? '貸出金利息の受入（海外拠点）' : '貸出金利息の受入（全国の店舗網）');
    L.paidInt += interest;
    const pdM = 1 - Math.pow(1 - Math.min(0.9, L.pd / 100), 1 / 12);
    const def = Math.min(L.bal, Math.round(L.bal * pdM * Math.exp(randn() * 0.15)));
    if (def > 0) {
      const rec = Math.round(def * (1 - segLGD(L)));
      if (rec > 0) { post('延滞債権の回収（担保処分・保証履行）', [['boj', rec, 0], ['loans', 0, rec]]); L.bal -= rec; }
      writeOffAmount(L, def - rec, ovs ? '貸出金の償却（海外拠点）' : '貸出金の償却（全国の店舗網）');
      L.lossYTD = (L.lossYTD || 0) + (def - rec);
    }
    const rep = Math.min(L.bal, Math.round(L.bal * S.repay));
    if (rep > 0) { post('貸出金の回収（約定返済）', [['boj', rep, 0], ['loans', 0, rep]]); L.bal -= rep; }
  }
  const target = segTarget(L);
  let nw = Math.round(Math.max(0, bal0 + (target - bal0) * 0.06 - L.bal));
  if (G.flags.lendingBan > G.m) nw = 0;
  if (coreLoad() > 1) nw = Math.round(nw * 0.3); // システムの処理能力不足で新規の受付を絞る
  if (nw > 0 && !ensureFunds(nw)) nw = Math.max(0, Math.min(nw, B('boj') - requiredReserve()));
  if (nw > 0) {
    const pol = G.credit[ovs ? 'ovs' : 'nat'];
    const f = APPETITE[pol.app].risk * Math.exp(0.5 * pol.adj);
    L.vr = ((L.vr || 1) * L.bal + f * nw) / (L.bal + nw);
    post(ovs ? '融資の実行（海外拠点）' : '融資の実行（全国の店舗網）', [['loans', nw, 0], ['boj', 0, nw]]);
    L.bal += nw; L.principal += nw;
  }
  // 不良債権の残高（延滞・条件変更先）。バルクセールの後は1年かけて積み上がる
  const refill = L.nplSoldM !== undefined ? clamp((G.m - L.nplSoldM) / 12, 0, 1) : 1;
  L.npl = Math.round(L.bal * Math.min(0.4, L.pd / 100 * 1.2) * refill);
}
/* 不良債権のバルクセール（全国 nat／海外 ovs の店舗網が抱える延滞債権をまとめて売る） */
function nplBulkQuote(scope) {
  let face = 0, price = 0;
  for (const L of segLoans()) {
    if ((scope === 'ovs') !== isOvsArea(L.area) || !(L.npl > 0)) continue;
    face += L.npl;
    price += L.npl * Math.max(0.05, 1 - segLGD(L) * 1.25);
  }
  return { face: Math.round(face), price: Math.round(price) };
}
function nplBulkSale(scope) {
  const q = nplBulkQuote(scope);
  if (q.face < 1e8) return { ok: false, msg: '売却できる不良債権がほとんどありません' };
  for (const L of segLoans()) {
    if ((scope === 'ovs') !== isOvsArea(L.area) || !(L.npl > 0)) continue;
    const x = Math.min(L.bal, L.npl);
    const p = Math.round(x * Math.max(0.05, 1 - segLGD(L) * 1.25));
    post('不良債権のバルクセール（入金）', [['boj', p, 0], ['loans', 0, p]]);
    L.bal -= p;
    writeOffAmount(L, x - p, '不良債権のバルクセールによる売却損');
    L.npl = 0; L.nplSoldM = G.m;
  }
  trueUpProvisions();
  G.stats.nplSold++;
  addNews('bank', `${scope === 'ovs' ? '海外拠点' : '全国の店舗網'}の不良債権${fmtYen(q.face)}を投資ファンドに一括売却（売却額${fmtYen(q.price)}）`, 'neutral');
  return { ok: true, q };
}

/* ---------- 国内の地域：預金 ---------- */
function natDepTarget(R) {
  const r = G.net[R.id], lvd = NAT_LEVELS[r.lv];
  if (!lvd.dep) return { ord: 0, time: 0 };
  const rt = G.rates, e = G.eco;
  const rfOrd = clamp(Math.exp(2.5 * (rt.ord - e.mktOrd)), 0.75, 1.6);
  const rfTime = clamp(Math.exp(4.0 * (rt.time - e.mktTime)), 0.6, 2.5);
  const trustF = clamp(Math.pow(G.trust / 65, 0.8), 0.4, 1.3);
  const base = R.dep * 1e12 * lvd.dep * trustF * (1 + 0.05 * G.sys.digital) * clamp(r.vit / 100, 0.85, 1.15) / Math.sqrt(R.compet);
  return { ord: base * (1 - R.time) * rfOrd, time: base * R.time * rfTime };
}
function natDepositStep(R) {
  const r = G.net[R.id];
  if (!r.lv && r.ord + r.time <= 0) return;
  const t = natDepTarget(R);
  let dO = (t.ord - r.ord) * 0.06 + r.ord * randn() * 0.004;
  let dT = (t.time - r.time) * 0.05 + r.time * randn() * 0.002;
  if (coreLoad() > 1) { if (dO > 0) dO *= 0.3; if (dT > 0) dT *= 0.3; }
  if (G.trust < 30) { dO -= r.ord * (30 - G.trust) / 30 * 0.1; dT -= r.time * (30 - G.trust) / 30 * 0.04; }
  if (G.runShock) { dO -= r.ord * G.runShock * 0.7; dT -= r.time * G.runShock * 0.3; }
  dO = Math.round(Math.max(-r.ord, dO)); dT = Math.round(Math.max(-r.time, dT));
  const inO = Math.max(0, dO), inT = Math.max(0, dT), outO = Math.max(0, -dO), outT = Math.max(0, -dT);
  if (inO + inT > 0) post('預金の純増（全国の店舗網）', [['boj', inO + inT, 0], ['depOrd', 0, inO], ['depTime', 0, inT]]);
  if (outO + outT > 0) { ensureFunds(outO + outT); post('預金の純減（全国の店舗網）', [['depOrd', outO, 0], ['depTime', outT, 0], ['boj', 0, outO + outT]]); }
  r.ord += dO; r.time += dT;
  r.tRate += (G.rates.time - r.tRate) / 12;
}

/* ---------- 海外の地域：金利・為替・預金・外貨調達 ---------- */
function ovsDepTarget(R) {
  const r = G.net[R.id], lvd = OVS_LEVELS[r.lv];
  if (!lvd.dep) return 0;
  return R.dep * 1e12 * lvd.dep * clamp(Math.pow(G.trust / 65, 0.6), 0.5, 1.2) * clamp(r.vit / 100, 0.7, 1.3);
}
function fxRevalue(a, dfx) {
  const r = G.net[a];
  const loans0 = areaLoanBal(a), dep0 = r.dep;
  let dL = 0;
  for (const L of segLoans(a)) { const d = Math.round(L.bal * dfx); L.bal += d; dL += d; }
  const dD = Math.round(dep0 * dfx);
  r.dep += dD;
  const hs = -Math.round(Math.max(0, loans0 - dep0) * G.credit.hedge * dfx); // 為替スワップ（ヘッジ）の損益
  const pl = dL - dD + hs;
  const lines = [];
  if (dL > 0) lines.push(['loans', dL, 0]); else if (dL < 0) lines.push(['loans', 0, -dL]);
  if (dD > 0) lines.push(['depFx', 0, dD]); else if (dD < 0) lines.push(['depFx', -dD, 0]);
  if (hs > 0) lines.push(['boj', hs, 0]); else if (hs < 0) { ensureFunds(-hs); lines.push(['boj', 0, -hs]); }
  if (pl > 0) lines.push(['fxGain', 0, pl]); else if (pl < 0) lines.push(['fxLoss', -pl, 0]);
  post('外貨建資産・負債の円換算（為替の変動）', lines);
  r.fxPL = (r.fxPL || 0) + pl;
}
function ovsStep(R) {
  const a = R.id, r = G.net[a], e = G.eco;
  r.rate = clamp(r.rate + (R.rate0 + 0.5 * (e.policy - 0.5) - r.rate) * 0.04 + randn() * 0.05, 0, 40);
  const vt = 100 + 5 * (R.growth - 2.5) + 6 * (e.gdp - 1);
  r.vit = clamp(r.vit + (vt - r.vit) * 0.05 + randn() * 0.8, 40, 170);
  r.land = clamp(r.land * (1 + (R.growth * 0.6 + (r.vit - 100) / 10) / 1200 + randn() * 0.003), 30, 400);
  const dfx = clamp(R.fxVol * randn() - 0.04 * Math.log(r.fx) + (e.regime === 'crisis' ? -0.012 : 0), -0.25, 0.25);
  r.fx *= 1 + dfx;
  r.lastFx = dfx;
  if (r.basisUntil < G.m) r.basis += (0.3 - r.basis) * 0.3;
  if (areaLoanBal(a) <= 0 && r.dep <= 0 && !r.lv) return;
  if (areaLoanBal(a) > 0 || r.dep > 0) fxRevalue(a, dfx);
  // 現地での預金
  let dD = (ovsDepTarget(R) - r.dep) * 0.05 + r.dep * randn() * 0.006;
  if (G.trust < 30) dD -= r.dep * 0.05;
  dD = Math.round(Math.max(-r.dep, dD));
  if (dD > 0) post('海外店預金の純増', [['boj', dD, 0], ['depFx', 0, dD]]);
  else if (dD < 0) { ensureFunds(-dD); post('海外店預金の純減', [['depFx', -dD, 0], ['boj', 0, -dD]]); }
  r.dep += dD;
  const di = Math.round(r.dep * r.rate * 0.6 / 1200);
  if (di > 0) { post('海外店預金利息の元加', [['intDep', di, 0], ['depFx', 0, di]]); r.dep += di; }
  // 貸出が現地の預金を上回る分は、円資金を為替スワップで外貨に換えて調達する
  r.gap = Math.max(0, areaLoanBal(a) - r.dep);
  const fc = Math.round(r.gap * G.credit.hedge * Math.max(0, r.rate - e.policy + r.basis) / 1200);
  payOut(fc, 'fundingCost', '外貨調達費用（為替スワップ）');
}
/* 支払前に資金を確保して費用を計上する */
function payOut(amount, acct, desc) {
  amount = Math.round(amount);
  if (amount <= 0) return;
  ensureFunds(amount);
  payExpense(amount, acct, desc);
}

/* ---------- 月末：ネットワーク全体の処理 ---------- */
function networkMonthEnd() {
  if (!G.net) return;
  const e = G.eco;
  for (const R of NATIONS) {
    const r = G.net[R.id];
    const tgt = 100 + 5 * (e.gdp - 1) + (R.dep >= 150 ? 3 : R.dep < 60 ? -3 : 0);
    r.vit = clamp(r.vit + (tgt - r.vit) * 0.05 + randn() * 0.6, 50, 160);
    r.land = clamp(r.land * (1 + REGIMES[e.regime].land * (R.dep >= 100 ? 1 : 0.6) / 1200 + randn() * 0.002), 30, 300);
    natDepositStep(R);
  }
  for (const R of OVERSEAS) ovsStep(R);
  for (const L of G.loans) if (L.kind === 'seg' && isActiveLoan(L)) processSegPool(L);
  networkCosts();
  amortizeGoodwill();
}
function networkCosts() {
  let natOp = 0, ovsOp = 0;
  for (const R of NATIONS) natOp += regionOpex(R.id);
  for (const R of OVERSEAS) ovsOp += regionOpex(R.id);
  payOut(natOp * 0.55, 'personnel', '全国の店舗網の人件費');
  payOut(natOp * 0.45, 'premises', '全国の店舗網の物件費');
  payOut(ovsOp * 0.55, 'personnel', '海外拠点の人件費');
  payOut(ovsOp * 0.45, 'premises', '海外拠点の物件費');
  const f = networkFees();
  const natFee = f.nat / 12, ovsFee = f.ovs / 12;
  receive(Math.round(natFee), 'fees', '役務取引等収益（全国の店舗網：融資関連・保険・資産運用）');
  receive(Math.round(ovsFee), 'fees', '役務取引等収益（海外拠点：貿易金融・送金）');
}
/* 店舗網が生む手数料（年額）：融資関連・保険と投信の販売・資産運用・決済、海外は貿易金融・送金 */
function networkFees() {
  let nat = natDep() * 0.0015, ovs = 0;
  for (const L of segLoans()) {
    if (isOvsArea(L.area)) ovs += L.bal * 0.004; else nat += L.bal * 0.003;
  }
  for (const R of OVERSEAS) ovs += G.net[R.id].dep * 0.002;
  return { nat, ovs };
}
function amortizeGoodwill() {
  let t = 0;
  for (const g of G.goodwill) {
    const d = Math.min(g.book, Math.round(g.cost / g.life));
    g.book -= d; t += d;
  }
  if (t > 0) post('のれん償却', [['otherExp', t, 0], ['goodwill', 0, t]]);
  G.goodwill = G.goodwill.filter(g => g.book > 0);
}

/* ---------- 翌月：工事の完了・買収先の問題の発覚・大型リスク ---------- */
function networkNextMonth() {
  if (!G.net) return;
  for (const R of NATIONS.concat(OVERSEAS)) {
    const a = R.id, r = G.net[a];
    if (r.build && G.m >= r.build.doneM) {
      const LV = regionLevels(a);
      r.lv = r.build.to; r.build = null; r.lvM = G.m;
      if (r.since < 0) r.since = G.m;
      const mix = segMix(a, r.lv);
      if (LV[r.lv].loan > 0) for (const seg of ['retail', 'sme']) if (mix[seg] > 0) ensureSegLoan(a, seg);
      addNews('bank', `${R.name}の「${LV[r.lv].name}」が完成（店舗${fmtNum(regionBranches(a))}・行員${fmtNum(regionStaff(a))}人）`, 'good');
    }
    if (r.shock && G.m >= r.shock.m) {
      r.pdMul = r.shock.mul; r.pdUntil = G.m + 24;
      addNews('loan', `買収した${r.shock.name}の貸出に、統合前の査定では把握できなかった不良債権が見つかった。${R.name}の貸倒れが当面増える見込み`, 'bad');
      r.shock = null;
    }
  }
  if (stageOf() >= 1) stageEventsStep();
}

/* ---------- 店舗網の拡大・撤退 ---------- */
function buildCheck(a) {
  const ovs = isOvsArea(a), r = G.net[a], LV = regionLevels(a);
  const nx = LV[r.lv + 1];
  const st = stageOf();
  if (!ovs && st < 1) return { ok: false, msg: '全国展開はメガバンクに格上げされてから行えます' };
  if (ovs && st < 2) return { ok: false, msg: '海外展開はテラバンクに格上げされてから行えます' };
  if (!nx) return { ok: false, msg: 'これ以上は拡大できません' };
  if (r.build) return { ok: false, msg: '拡大の準備中です' };
  if (nx.acqOnly) return { ok: false, msg: 'この段階へは現地銀行の買収でのみ進めます', acq: true };
  if (r.lv >= 1 && G.m - (r.lvM ?? -999) < LEVEL_GAP) return { ok: false, msg: `店舗網が地域に根付くまで、次の段階へは${ymLabel(r.lvM + LEVEL_GAP)}から進めます`, wait: r.lvM + LEVEL_GAP };
  if (G.flags.order > G.m) return { ok: false, msg: '業務改善命令の期間中は拡大できません' };
  if (r.frozenUntil > G.m) return { ok: false, msg: `${regionDef(a).name}では当局から業務の制限を受けています（${ymLabel(r.frozenUntil)}まで）` };
  const cost = Math.round(nx.capex * regionScale(a));
  if (B('boj') + B('callLoan') - cost < requiredReserve()) return { ok: false, msg: `資金が不足しています（必要額 ${fmtYen(cost)}）`, cost, nx };
  return { ok: true, cost, nx };
}
function buildRegion(a) {
  const c = buildCheck(a);
  if (!c.ok) return c;
  const r = G.net[a], R = regionDef(a);
  ensureFunds(c.cost);
  const as = addAsset(`${R.name}：${c.nx.name}の店舗・設備`, 'tangible', c.cost, 180);
  as.area = a;
  r.build = { to: c.nx.lv, doneM: G.m + c.nx.months, cost: c.cost };
  addNews('bank', `${R.name}で「${c.nx.name}」への拡大に着手（投資額${fmtYen(c.cost)}、${ymLabel(G.m + c.nx.months)}完成予定）`, 'neutral');
  return { ok: true };
}
/* 必要な資金を用意する（コール・日銀借入で足りなければ国債を売る） */
function raiseCash(amount) {
  if (ensureFunds(amount)) return true;
  const bonds = G.bonds.slice().sort((x, y) => x.matM - y.matM);
  for (const bd of bonds) { if (B('boj') >= amount) break; sellBond(bd.id, true); }
  return ensureFunds(amount);
}
/* 地域からの撤退。forced=格下げに伴う売却（条件が悪い） */
function exitRegion(a, forced) {
  const r = G.net[a], R = regionDef(a), ovs = isOvsArea(a);
  if (!r.lv && !r.build) return { ok: false, msg: '進出していません' };
  const px = forced ? (ovs ? 0.95 : 0.97) : (ovs ? 0.97 : 0.985);
  const pl0 = curProfit();
  for (const L of segLoans(a)) {
    const price = Math.round(L.bal * px);
    post(ovs ? '海外の貸出債権の売却（拠点の撤退）' : '貸出債権の売却（店舗網の事業譲渡）', [['boj', price, 0], ['loans', 0, price]]);
    L.bal -= price;
    if (L.bal > 0) writeOffAmount(L, L.bal, '貸出債権の売却損（撤退）');
    if (L.provision > 0) { const x = Math.min(L.provision, B('allowance')); post('貸倒引当金の戻入（撤退）', [['allowance', x, 0], ['provRev', 0, x]]); }
    L.status = 'sold'; L.closedM = G.m; L.bal = 0; L.provision = 0;
  }
  if (ovs) {
    const d = Math.round(r.dep);
    if (d > 0) { raiseCash(d); post('海外店預金の譲渡（拠点の撤退）', [['depFx', d, 0], ['boj', 0, d]]); }
    r.dep = 0; r.gap = 0;
  } else {
    const o = Math.round(r.ord), t = Math.round(r.time);
    if (o + t > 0) { raiseCash(o + t); post('預金の譲渡（店舗網の事業譲渡）', [['depOrd', o, 0], ['depTime', t, 0], ['boj', 0, o + t]]); }
    r.ord = 0; r.time = 0;
  }
  for (const as of G.assets.filter(x => x.area === a)) {
    const rec = Math.round(as.book * (forced ? 0.5 : 0.6));
    post('店舗・設備の売却（撤退）', [['boj', rec, 0], ['extraLoss', as.book - rec, 0], ['tangible', 0, as.book]]);
    G.assets = G.assets.filter(x => x !== as);
  }
  for (const g of G.goodwill.filter(x => x.area === a)) {
    if (g.book > 0) post('のれんの減損（撤退）', [['extraLoss', g.book, 0], ['goodwill', 0, g.book]]);
    G.goodwill = G.goodwill.filter(x => x !== g);
  }
  r.lv = 0; r.build = null; r.since = -1; r.shock = null; r.lvM = -999;
  const loss = pl0 - curProfit();
  addNews('bank', `${R.name}${ovs ? 'の拠点' : 'の店舗網'}を${forced ? '格下げに伴い売却' : '他行に譲渡'}し、撤退した（損失${fmtYen(Math.max(0, loss))}）`, forced ? 'bad' : 'neutral');
  return { ok: true, loss };
}

/* ---------- 買収（国内：地方銀行、海外：現地の有力銀行） ---------- */
const NAT_BANK_PRE = { 'n-shutoken': '武蔵野', 'n-kansai': '浪速', 'n-chubu': '尾張', 'n-kitakanto': '上毛', 'n-hokuriku': '越州', 'n-tohoku': 'みちのく', 'n-hokkaido': '蝦夷', 'n-chushikoku': '瀬戸内', 'n-kyushu': '筑紫' };
const OVS_BANK_NAME = { 'o-na': 'ハドソン・ナショナル銀行', 'o-eu': 'ラインラント商業銀行', 'o-cn': '東亜聯合銀行', 'o-sea': 'マラッカ・ユナイテッド銀行', 'o-in': 'デカン・フィナンシャル', 'o-me': 'ガルフ・コマーシャル銀行', 'o-latam': 'バンコ・ソル・アメリカーノ', 'o-oc': 'サザンクロス銀行' };
function acqQuote(a) {
  const r = G.net[a], R = regionDef(a), ovs = isOvsArea(a), LV = regionLevels(a);
  const to = ovs ? 4 : 3;
  if (r.lv >= to) return null;
  if (!r.quote || G.m - r.quote.m >= 6) {
    r.quote = { m: G.m, prem: +(uni(1.15, 1.5) * Math.sqrt(clamp(G.eco.stock / 100, 0.6, 1.6))).toFixed(2) };
  }
  const d = Math.round(R.dep * 1e12 * (LV[to].dep - LV[r.lv].dep));
  const l = Math.round(R.loan * 1e12 * (LV[to].loan - LV[r.lv].loan));
  const na = Math.round(d * (ovs ? 0.08 : 0.05));
  const price = Math.round(na * r.quote.prem);
  const name = ovs ? OVS_BANK_NAME[a] : `${NAT_BANK_PRE[a]}銀行`;
  const rw = isOvsArea(a) ? (0.3 * SEG.retail.rw + 0.7 * SEG.sme.rw) * (1 + 0.15 * (OVSR[a].risk - 1)) : SEG.retail.mix * SEG.retail.rw + SEG.sme.mix * SEG.sme.rw;
  return { to, d, l, na, price, goodwill: price - na, prem: r.quote.prem, name, addRWA: l * rw + (l * 0.012 + d * 0.002) * 1.875 };
}
function proFormaCR(addCore, addRWA) {
  const rw = rwaBreakdown();
  return (coreCapitalParts(rw).core + addCore) / (rw.total + addRWA) * 100;
}
function marketCap() { return G.stock.price * G.stock.shares; }
function acqCheck(a, method) {
  const r = G.net[a], ovs = isOvsArea(a), st = stageOf();
  if (!ovs && st < 1) return { ok: false, msg: '地方銀行の買収はメガバンクに格上げされてから行えます' };
  if (ovs && st < 2) return { ok: false, msg: '海外の銀行の買収はテラバンクに格上げされてから行えます' };
  if (!ovs && r.lv > 2) return { ok: false, msg: 'すでに地域全域に店舗網があります' };
  if (ovs && (r.lv < 1 || r.lv > 3)) return { ok: false, msg: r.lv < 1 ? 'まず駐在員事務所を開いて現地を調べる必要があります' : 'すでに現地の有力銀行を傘下に持っています' };
  if (r.build) return { ok: false, msg: '拡大の準備中は買収できません' };
  if (G.flags.order > G.m) return { ok: false, msg: '業務改善命令の期間中は買収できません' };
  if (r.frozenUntil > G.m) return { ok: false, msg: '当局から業務の制限を受けています' };
  if (G.m - G.stageInfo.lastAcqM < 12) return { ok: false, msg: `買収は1年に1件までです（次は${ymLabel(G.stageInfo.lastAcqM + 12)}から）` };
  const q = acqQuote(a);
  if (method === 'stock' && q.price > marketCap()) return { ok: false, msg: `株式交換で発行できる株式は時価総額（${fmtYen(marketCap())}）までです`, q };
  const net = q.d + q.na - q.l - (method === 'cash' ? q.price : 0); // 買収で手元に入る資金（マイナスなら持ち出し）
  if (net < 0 && !canFund(-net)) return { ok: false, msg: `買収に必要な資金（${fmtYen(-net)}）が足りません`, q };
  const cr = proFormaCR((method === 'stock' ? q.price : 0) - q.goodwill, q.addRWA);
  if (cr < reqCR() + 1) return { ok: false, msg: `買収後の自己資本比率が${fmtPct(cr)}となり、当局の認可が下りません（${fmtPct(reqCR() + 1)}以上が必要）`, q, cr };
  return { ok: true, q, cr };
}
function acquireRegion(a, method) {
  const c = acqCheck(a, method);
  if (!c.ok) return c;
  const q = c.q, r = G.net[a], R = regionDef(a), ovs = isOvsArea(a);
  const mix = segMix(a, q.to);
  let lsum = 0;
  const parts = [];
  for (const seg of ['retail', 'sme']) {
    const x = Math.round(q.l * mix[seg]);
    if (x > 0) { parts.push([seg, x]); lsum += x; }
  }
  const cashIn = q.d + q.na - lsum; // 買収先の手元資金（預け金・有価証券）
  const depLines = [];
  let dOrd = 0, dTime = 0;
  if (ovs) depLines.push(['depFx', 0, q.d]);
  else { dTime = Math.round(q.d * R.time); dOrd = q.d - dTime; depLines.push(['depOrd', 0, dOrd], ['depTime', 0, dTime]); }
  if (method === 'stock') {
    const half = Math.round(q.price / 2);
    if (cashIn < 0) ensureFunds(-cashIn);
    post(`${q.name}の買収（株式交換）`, [['loans', lsum, 0], cashIn >= 0 ? ['boj', cashIn, 0] : ['boj', 0, -cashIn], ['goodwill', q.goodwill, 0], ...depLines, ['capital', 0, half], ['capSurplus', 0, q.price - half]]);
    const sh = Math.round(q.price / (G.stock.price * 0.97));
    G.shareholders.dilution = (G.shareholders.dilution || 0) + q.price / marketCap() * 0.4;
    G.stock.shares += sh;
  } else {
    const net = cashIn - q.price;
    if (net < 0) ensureFunds(-net);
    post(`${q.name}の買収（現金）`, [['loans', lsum, 0], net >= 0 ? ['boj', net, 0] : ['boj', 0, -net], ['goodwill', q.goodwill, 0], ...depLines]);
  }
  for (const [seg, x] of parts) {
    const L = ensureSegLoan(a, seg);
    L.vr = ((L.vr || 1) * L.bal + 1.1 * x) / (L.bal + x);
    L.bal += x; L.principal += x;
  }
  if (ovs) r.dep += q.d; else { r.ord += dOrd; r.time += dTime; r.tRate = G.rates.time; }
  G.goodwill.push({ id: 'W' + (++G.seq.asset), area: a, name: q.name, cost: q.goodwill, book: q.goodwill, m0: G.m, life: 240 });
  r.lv = q.to; r.build = null; r.quote = null; r.lvM = G.m;
  if (r.since < 0) r.since = G.m;
  if (chance(ovs ? 0.45 : 0.35)) r.shock = { m: G.m + randInt(3, 9), mul: +uni(1.8, 2.6).toFixed(2), name: q.name };
  payOut(q.na * 0.04, 'extraLoss', '経営統合費用（システム統合・店舗の再編）');
  G.stageInfo.lastAcqM = G.m;
  G.trust = clamp(G.trust + 1, 0, 100);
  addNews('bank', `${q.name}を${method === 'stock' ? '株式交換で' : ''}買収（買収額${fmtYen(q.price)}、のれん${fmtYen(q.goodwill)}）。${R.name}の預金${fmtYen(q.d)}・貸出${fmtYen(lsum)}を引き継いだ`, 'good');
  return { ok: true, q };
}

/* ---------- 格上げの条件・審査 ---------- */
function stageRequirements(to) {
  const cr = capitalRatio(), npl = nplRatio(), ta = totalAssets();
  const o = [];
  const add = (name, need, cur, ok) => o.push({ name, need, cur, ok: !!ok });
  if (to === 1) {
    add('総資産', '800億円以上', fmtYen(ta), ta >= 800e8);
    const sh = cityStats().share * 100;
    add(`${CITY_NAME}での預金シェア`, '2.5%以上', fmtPct(sh), sh >= 2.5);
    add('自己資本比率', '10%以上', fmtPct(cr), cr >= 10);
    add('格付', 'A−以上', RATINGS[G.ratingIdx], G.ratingIdx <= 5);
    add('不良債権比率', '3%以下', fmtPct(npl), npl <= 3);
    add('勘定系システム', 'Lv2以上', 'Lv' + G.sys.core, G.sys.core >= 2);
    add('マネロン・不正取引検知', 'Lv2以上', 'Lv' + G.sys.aml, G.sys.aml >= 2);
    add('行政処分', '業務改善命令の期間外', G.flags.order > G.m ? '命令の期間中' : 'なし', G.flags.order <= G.m);
  } else if (to === 2) {
    const ns = natShare();
    add('国内の預金シェア', '2%以上（全国の店舗網の上限は5%）', fmtPct(ns), ns >= 2);
    add('自己資本比率', '12%以上', fmtPct(cr), cr >= 12);
    add('格付', 'A以上', RATINGS[G.ratingIdx], G.ratingIdx <= 4);
    add('不良債権比率', '2.5%以下', fmtPct(npl), npl <= 2.5);
    add('勘定系システム', 'Lv5以上', 'Lv' + G.sys.core, G.sys.core >= 5);
    add('マネロン・不正取引検知', 'Lv3', 'Lv' + G.sys.aml, G.sys.aml >= 3);
    add('サイバーセキュリティ', 'Lv3', 'Lv' + G.sys.cyber, G.sys.cyber >= 3);
    const recentD = G.fsa.history.some(h => h.grade === 'D' && G.m - h.m < 36);
    add('行政処分', '直近3年に業務改善命令なし', recentD || G.flags.order > G.m ? 'あり' : 'なし', !recentD && G.flags.order <= G.m);
  }
  return o;
}
function canApplyUpgrade() {
  const st = stageOf(), si = G.stageInfo;
  if (st >= 2) return { ok: false, msg: 'すでに最上位の業態です' };
  const req = stageRequirements(st + 1);
  if (si.review) return { ok: false, msg: `審査中です（${ymLabel(si.review.doneM)}に結論）`, req };
  if (si.cooldownUntil > G.m) return { ok: false, msg: `格下げから3年間は再申請できません（${ymLabel(si.cooldownUntil)}から申請可）`, req };
  if (si.rejectedUntil > G.m) return { ok: false, msg: `前回の否認から半年間は再申請できません（${ymLabel(si.rejectedUntil)}から申請可）`, req };
  const ng = req.filter(x => !x.ok);
  if (ng.length) return { ok: false, msg: `条件を満たしていません：${ng.map(x => x.name).join('、')}`, req };
  return { ok: true, req };
}
const REVIEW_COST = [0, 2e8, 30e8];
function applyUpgrade() {
  const c = canApplyUpgrade();
  if (!c.ok) return c;
  const to = stageOf() + 1;
  const months = to === 1 ? 3 : 6;
  G.stageInfo.review = { to, startM: G.m, doneM: G.m + months };
  payOut(REVIEW_COST[to], 'otherExp', '格上げ審査への対応費用（態勢整備・外部専門家）');
  addNews('reg', `${STAGES[to].name}への格上げ（${to === 1 ? '全国展開' : '海外展開'}の認可）を金融庁に申請。${months}か月間の審査に入る`, 'neutral');
  return { ok: true, months };
}
function stageReviewStep() {
  const si = G.stageInfo, rv = si && si.review;
  if (!rv || G.m < rv.doneM) return;
  si.review = null;
  const ng = stageRequirements(rv.to).filter(x => !x.ok);
  if (!ng.length) { promote(rv.to); return; }
  si.rejectedUntil = G.m + 6;
  addNews('reg', `${STAGES[rv.to].name}への格上げ申請は否認された。審査期間中に条件を満たさなくなった（${ng.map(x => x.name).join('、')}）`, 'bad');
  G.pendingModals.push({ type: 'stage', kind: 'rejected', to: rv.to, ng: ng.map(x => `${x.name}（${x.cur}／基準 ${x.need}）`) });
}
/* メガバンクの誕生：全国の地方銀行2行と経営統合（株式交換・対等の条件） */
function promotionMerger() {
  const big = pick(['n-kansai', 'n-chubu', 'n-kyushu']);
  const small = pick(['n-chushikoku', 'n-hokuriku', 'n-tohoku', 'n-hokkaido', 'n-kitakanto']);
  const names = [];
  let D = 0, Ls = 0, NA = 0;
  for (const a of [big, small]) {
    const q = acqQuote(a);
    if (!q) continue;
    const R = NATR[a], r = G.net[a];
    const tang = Math.round((NAT_LEVELS[1].capex + NAT_LEVELS[2].capex + NAT_LEVELS[3].capex) * natScale(R) * 0.5);
    const mix = segMix(a, 3);
    const parts = [];
    let lsum = 0;
    for (const seg of ['retail', 'sme']) { const x = Math.round(q.l * mix[seg]); parts.push([seg, x]); lsum += x; }
    const dTime = Math.round(q.d * R.time), dOrd = q.d - dTime;
    const cashIn = q.d + q.na - lsum - tang;
    const half = Math.round(q.na / 2);
    const bps = netAssets() / G.stock.shares;
    if (cashIn < 0) ensureFunds(-cashIn);
    post('経営統合（株式交換）による資産・負債の承継', [['loans', lsum, 0], ['tangible', tang, 0], cashIn >= 0 ? ['boj', cashIn, 0] : ['boj', 0, -cashIn],
      ['depOrd', 0, dOrd], ['depTime', 0, dTime], ['capital', 0, half], ['capSurplus', 0, q.na - half]]);
    G.assets.push({ id: 'F' + (++G.seq.asset), name: `${q.name}の店舗・設備（経営統合）`, kind: 'tangible', cost: tang * 2, life: 180, m0: G.m - 90, book: tang, area: a });
    for (const [seg, x] of parts) { const L = ensureSegLoan(a, seg); L.bal += x; L.principal += x; L.pd = segPD(L); L.rate = L.rate0 = segRate(L); }
    r.ord += dOrd; r.time += dTime; r.tRate = G.rates.time;
    r.lv = 3; r.lvM = G.m; r.since = G.m; r.build = null; r.quote = null;
    G.stock.shares += Math.round(q.na / bps);
    names.push(`${q.name}（${R.name}）`);
    D += q.d; Ls += lsum; NA += q.na;
  }
  // 統合後の勘定系は、統合相手の大規模なシステムに一本化する
  if (G.sys.core < 4) {
    const v = 30e8;
    post('経営統合（株式交換）による資産・負債の承継', [['intangible', v, 0], ['boj', 0, v]]);
    G.assets.push({ id: 'F' + (++G.seq.asset), name: `勘定系システム（${SYSTEMS.core.levels[4].name}・統合相手から承継）`, kind: 'intangible', cost: 45e8, life: 60, m0: G.m - 20, book: v });
    G.sys.core = 4;
    G.itProjects = G.itProjects.filter(p => p.sys !== 'core');
  }
  return { names, D, L: Ls, NA };
}

function promote(to) {
  const si = G.stageInfo;
  G.stage = to;
  if (to === 1) {
    const mg = promotionMerger();
    si.merger = mg;
    addNews('bank', `${G.bankName}は${mg.names.join('・')}と経営統合し、メガバンク・グループが誕生。預金${fmtYen(mg.D)}・貸出${fmtYen(mg.L)}を引き継いだ`, 'good');
  }
  si.since = G.m; si.strikes = 0; si.maxStage = Math.max(si.maxStage, to);
  si.hist.push({ m: G.m, from: to - 1, to, kind: 'up' });
  G.trust = clamp(G.trust + 6, 0, 100);
  G.stock.price *= 1.15;
  if (G.fsa.nextM > G.m + 12) G.fsa.nextM = G.m + randInt(8, 12);
  addNews('bank', to === 1
    ? `${G.bankName}がメガバンクに格上げ。全国展開の認可を受け、日本各地に店舗網を広げられるようになった`
    : `${G.bankName}がテラバンクに格上げ。グローバルなシステム上重要な銀行として、海外への展開を認められた`, 'good');
  G.pendingModals.push({ type: 'stage', kind: 'up', to, merger: to === 1 ? si.merger : null });
}

/* ---------- 維持基準と格下げ ---------- */
function maintChecks(st) {
  const S = STAGES[st];
  const cr = capitalRatio(), npl = nplRatio(), l = lcr();
  const o = [
    { name: '自己資本比率', need: `${S.reqCR}%以上`, cur: fmtPct(cr), ok: cr >= S.reqCR },
    { name: '格付', need: `${RATINGS[S.minRating]}以上`, cur: RATINGS[G.ratingIdx], ok: G.ratingIdx <= S.minRating },
    { name: '不良債権比率', need: `${S.maxNpl}%以下`, cur: fmtPct(npl), ok: npl <= S.maxNpl },
    { name: '流動性カバレッジ比率', need: '100%以上', cur: fmtPct(l, 0), ok: l >= 100 },
  ];
  if (st >= 2) o.push({ name: 'マネロン・不正取引検知', need: 'Lv3', cur: 'Lv' + G.sys.aml, ok: G.sys.aml >= 3 });
  return o;
}
function stageQuarterly() {
  const st = stageOf();
  if (st < 1 || G.over) return;
  const S = STAGES[st], si = G.stageInfo;
  const cr = capitalRatio();
  if (cr < S.reqCR * 0.6) { demote(`自己資本比率が${fmtPct(cr)}まで低下し、${S.name}の最低基準（${fmtPct(S.reqCR)}）を大きく下回った`); return; }
  const ng = maintChecks(st).filter(x => !x.ok);
  if (!ng.length) {
    if (si.strikes) addNews('reg', `${S.name}の維持基準を回復。格下げは回避された`, 'good');
    si.strikes = 0;
    return;
  }
  si.strikes++;
  if (si.strikes >= 2) { demote(`${ng.map(x => x.name).join('・')}が2四半期続けて${S.name}の維持基準を満たさなかった`); return; }
  si.warnM = G.m;
  addNews('reg', `【格下げ警告】${S.name}の維持基準を満たしていない（${ng.map(x => `${x.name} ${x.cur}`).join('、')}）。次の四半期も未達なら${STAGES[st - 1].name}へ格下げされる`, 'bad');
  G.pendingModals.push({ type: 'stage', kind: 'warn', ng: ng.map(x => `${x.name}：${x.cur}（基準 ${x.need}）`) });
}
function demote(reason) {
  const from = stageOf(), to = from - 1;
  if (from < 1) return;
  const pl0 = curProfit();
  const exits = (from === 2 ? OVERSEAS : NATIONS).filter(R => G.net[R.id].lv > 0 || G.net[R.id].build);
  for (const R of exits) exitRegion(R.id, true);
  const loss = pl0 - curProfit();
  const si = G.stageInfo;
  G.stage = to;
  si.since = G.m; si.strikes = 0; si.review = null; si.cooldownUntil = G.m + 36;
  si.hist.push({ m: G.m, from, to, kind: 'down', reason });
  G.trust = clamp(G.trust - (from === 2 ? 20 : 15), 0, 100);
  G.scandalHeat += 10;
  G.stock.price *= 0.65;
  G.ratingPenalty = (G.ratingPenalty || 0) + 10;
  updateRating();
  addNews('reg', `【格下げ】${G.bankName}は${STAGES[from].name}から${STAGES[to].name}に格下げされた。${reason}。${from === 2 ? '海外の拠点' : '全国の店舗網'}を売却し、損失${fmtYen(Math.max(0, loss))}を計上`, 'bad');
  G.pendingModals.push({ type: 'stage', kind: 'down', from, to, reason, loss: Math.max(0, loss), n: exits.length });
}

/* ---------- 規模が大きいほど大きくなるリスク ---------- */
function stageEventsStep() {
  const st = stageOf();
  const ta = totalAssets();
  const acc = accountsCount();
  // 全国規模のシステム障害
  if (chance(0.003 + clamp(coreLoad() - 0.9, 0, 0.6) * 0.1)) {
    const cost = Math.round(acc * uni(150, 450));
    payOut(cost, 'extraLoss', '大規模システム障害の補償・対応費用');
    G.trust = clamp(G.trust - uni(8, 14), 0, 100);
    G.scandalHeat += 8; G.stats.sysFailures++; G.fsa.special = true;
    const again = G.lastBigOutage !== undefined && G.m - G.lastBigOutage < 24;
    G.lastBigOutage = G.m;
    addNews('bank', `全国のATMとネットバンキングが終日停止する大規模システム障害が発生。補償と対応の費用は${fmtYen(cost)}${again ? '。度重なる障害に金融庁が業務改善命令を発出' : ''}`, 'bad');
    if (again) { G.flags.order = G.m + 12; G.stock.price *= 0.9; }
  }
  // 不正販売・顧客情報の流出などの不祥事
  if (chance(0.003 * (1 + 0.5 * st) * clamp(1.6 - compRatio(), 0.4, 1.6))) {
    const cost = Math.round(ta * uni(0.0002, 0.0008));
    payOut(cost, 'extraLoss', '不祥事に伴う顧客への補償・制裁金');
    G.trust = clamp(G.trust - uni(6, 10), 0, 100);
    G.scandalHeat += 8; G.stats.scandals++;
    addNews('bank', `${pick(['投資信託の不適切な販売', '顧客情報の大量流出', '高齢者への仕組債の不適切な勧誘', '営業ノルマに起因する不正契約'])}が全国の店舗で発覚。補償など${fmtYen(cost)}`, 'bad');
  }
  // 金融危機時の市場部門の損失
  if (G.eco.regime === 'crisis' && chance(0.08)) {
    const loss = Math.round(ta * uni(0.0003, 0.0015));
    payOut(loss, 'bondLoss', '市場部門の損失（保有有価証券の減損・トレーディング）');
    addNews('bank', `金融市場の混乱で市場部門が${fmtYen(loss)}の損失`, 'bad');
  }
  // 国内の地域での大災害
  for (const R of NATIONS) {
    const r = G.net[R.id];
    if (r.lv >= 1 && chance(0.0015)) {
      r.pdMul = 1.6; r.pdUntil = G.m + 12; r.vit = clamp(r.vit - 10, 50, 160);
      const dmg = Math.round(sum(G.assets.filter(x => x.area === R.id), x => x.book) * 0.03);
      if (dmg > 0) payOut(dmg, 'extraLoss', '災害による店舗の復旧費用');
      addNews('city', `${pick(['大地震', '記録的な豪雨', '大型台風'])}が${R.name}を襲う。地元企業や個人の返済に影響が出る見込み`, 'bad');
    }
  }
  if (st < 2) return;
  const ovsLoans = sum(OVERSEAS, R => areaLoanBal(R.id));
  const pres = OVERSEAS.filter(R => G.net[R.id].lv >= 1);
  // 各国の通貨危機・金融危機
  for (const R of pres) {
    const r = G.net[R.id];
    if (chance(0.0015 * R.risk * (G.eco.regime === 'crisis' ? 3 : 1))) {
      const drop = 0.08 + 0.05 * R.risk * uni(0.7, 1.3);
      r.fx *= 1 - drop;
      if (areaLoanBal(R.id) > 0 || r.dep > 0) fxRevalue(R.id, -drop);
      r.pdMul = 1.5 + 0.5 * R.risk; r.pdUntil = G.m + 12;
      r.vit = clamp(r.vit - 15, 40, 170);
      const out = Math.round(r.dep * 0.15);
      if (out > 0) { ensureFunds(out); post('海外店預金の流出（現地の危機）', [['depFx', out, 0], ['boj', 0, out]]); r.dep -= out; }
      addNews('eco', `${R.name}で通貨危機。現地通貨が約${fmtNum(drop * 100, 0)}%下落し、企業の倒産が急増している`, 'bad');
    }
    // 地政学リスク（資産凍結・規制強化）
    if (R.geo && r.lv >= 2 && chance(0.002)) {
      const ls = segLoans(R.id);
      const w = uni(0.05, 0.15);
      let tot = 0;
      for (const L of ls) { const x = Math.round(L.bal * w); writeOffAmount(L, x, '地政学リスクによる貸出債権の減損'); tot += x; }
      r.pdMul = 2.2; r.pdUntil = G.m + 18; r.frozenUntil = G.m + 12;
      addNews('eco', `${R.name}で地政学的な緊張が高まり、外資系銀行への規制が強化された。当行は${fmtYen(tot)}の減損を計上し、新規業務を1年間停止`, 'bad');
    }
  }
  // マネロン・制裁違反の制裁金（海外当局）
  if (pres.length && chance(0.003 * ovsLevelSum() / 8 * [3, 2, 1.2, 0.5][G.sys.aml])) {
    const R = wpick(pres, pres.map(x => x.reg));
    const fine = Math.round(uni(300e8, 3000e8) * clamp(ovsLoans / 5e12, 0.2, 2));
    payOut(fine, 'extraLoss', '海外当局への制裁金（マネロン・経済制裁違反）');
    G.net[R.id].frozenUntil = G.m + 24;
    G.trust = clamp(G.trust - 8, 0, 100); G.scandalHeat += 10; G.stats.scandals++;
    addNews('reg', `${R.name}の当局が、マネロン対策と経済制裁の違反で当行に${fmtYen(fine)}の制裁金を科した。現地での新規業務は2年間制限される`, 'bad');
  }
  // 外貨調達の逼迫（ドル資金市場の混乱）
  const gap = sum(OVERSEAS, R => G.net[R.id].gap || 0);
  if (gap > 0.5e12 && chance(G.eco.regime === 'crisis' ? 0.06 : 0.004)) {
    for (const R of pres) { const r = G.net[R.id]; r.basis = 1.8; r.basisUntil = G.m + 6; }
    G.trust = clamp(G.trust - 3, 0, 100);
    addNews('eco', 'ドル資金市場が逼迫し、為替スワップによる外貨調達のコストが急上昇。外貨の貸出が大きい邦銀に重荷', 'bad');
  }
  // 市場部門の不正取引（ローグトレーダー）
  if (chance(0.0012 * [1.6, 1, 0.6][G.sys.audit] * clamp(1.5 - compRatio(), 0.5, 1.5))) {
    const loss = Math.round(uni(300e8, 2000e8) * clamp(ta / 30e12, 0.3, 2));
    payOut(loss, 'extraLoss', '市場部門の不正取引による損失');
    G.trust = clamp(G.trust - 10, 0, 100); G.scandalHeat += 10; G.stats.scandals++; G.fsa.special = true;
    addNews('bank', `${pick(['ロンドン', 'ニューヨーク', 'シンガポール'])}拠点のトレーダーが損失を隠して無断取引を重ねていたことが発覚。損失は${fmtYen(loss)}`, 'bad');
  }
}

/* ---------- 開業時の店舗網（カスタムスタート） ---------- */
const MEGA_START = { 'n-shutoken': 4, 'n-kansai': 3, 'n-chubu': 3 };
const TERA_START_NAT = { 'n-shutoken': 5, 'n-kansai': 4, 'n-chubu': 4 };
const TERA_START_OVS = { 'o-na': 3, 'o-eu': 3, 'o-sea': 2, 'o-cn': 2, 'o-oc': 1 };
function setRegionMature(a, lv) {
  const r = G.net[a];
  r.lv = lv;
  if (!lv) return;
  r.since = -randInt(24, 120);
  r.lvM = -24;
  if (isNatArea(a)) { const t = natDepTarget(NATR[a]); r.ord = Math.round(t.ord); r.time = Math.round(t.time); r.tRate = G.rates.time; }
  else r.dep = Math.round(ovsDepTarget(OVSR[a]));
  const mix = segMix(a, lv);
  if (regionLevels(a)[lv].loan > 0) {
    for (const seg of ['retail', 'sme']) {
      if (!(mix[seg] > 0)) continue;
      const L = ensureSegLoan(a, seg);
      L.startM = -60;
      L.bal = Math.round(segTarget(L));
      L.principal = L.bal;
      L.pd = segPD(L);
      L.rate = L.rate0 = segRate(L);
    }
  }
  const LV = regionLevels(a);
  let capex = 0;
  for (let i = 1; i <= lv; i++) capex += (LV[i].capex || 0) * regionScale(a);
  if (capex > 0) G.assets.push({ id: 'F' + (++G.seq.asset), name: `${regionDef(a).name}の店舗・設備`, kind: 'tangible', cost: Math.round(capex), life: 180, m0: -60, book: Math.round(capex * 0.55), area: a });
}
function setupNetworkOpening(stage) {
  for (const R of NATIONS) setRegionMature(R.id, stage >= 2 ? (TERA_START_NAT[R.id] || 3) : (MEGA_START[R.id] || 2));
  if (stage >= 2) for (const R of OVERSEAS) setRegionMature(R.id, TERA_START_OVS[R.id] || 0);
}
/* 開業直後の格付に使う年間の収益見込み */
function estimateRunRate() {
  let nii = 0, el = 0, opex = 0;
  for (const L of segLoans()) {
    const ovs = isOvsArea(L.area);
    nii += L.bal * (segRate(L) - (ovs ? G.net[L.area].rate * 0.6 : G.eco.policy)) / 100;
    el += L.bal * segPD(L) / 100 * segLGD(L);
  }
  const depRate = G.rates.ord * 0.58 + G.rates.time * 0.42;
  nii += natDep() * Math.max(0, G.eco.policy - depRate) / 100;
  const nf = networkFees();
  const fees = accountsCount() * 95 * 12 + nf.nat + nf.ovs;
  for (const R of NATIONS.concat(OVERSEAS)) opex += regionOpex(R.id) * 12;
  for (const k of SYS_KEYS) opex += (SYSTEMS[k].levels[G.sys[k]].maint || 0) * 12;
  opex += sum(G.assets, x => x.life ? x.cost / x.life * 12 : 0);
  return { gp: nii + fees, opex, el };
}
