'use strict';
/* =========================================================
 *  07_bank.js : 預金・金利・市場運用・金庫・店舗・システム・人員・
 *               固定資産・手数料と経費・自己資本比率・格付・株価
 * ========================================================= */

/* ---------- 店舗網と地区での存在感 ---------- */
const openBranches = () => G.branches.filter(b => b.openM <= G.m);
function branchMaturity(b) {
  if (b.type === 'hq') return 1;
  if (b.openM > G.m) return 0;
  return clamp(0.35 + 0.65 * (G.m - b.openM) / 18, 0.35, 1);
}
function districtPresence() {
  const p = {};
  for (const D of DISTRICTS) p[D.id] = 0;
  for (const b of G.branches) {
    if (b.openM > G.m) continue;
    p[b.d] += BRANCH_TYPES[b.type].presence * branchMaturity(b);
  }
  for (const D of DISTRICTS) p[D.id] += Math.min(0.3, 0.03 * (G.atms[D.id] || 0));
  return p;
}
function totalATMs() {
  let n = 0;
  for (const b of openBranches()) n += BRANCH_TYPES[b.type].atms;
  for (const k in G.atms) n += G.atms[k];
  return n;
}
/* 汐見市の店舗が管理する口座数 */
function cityAccounts() { return Math.round(cityDeposits() / 2.5e6) + G.loans.filter(L => isActiveLoan(L) && (L.kind === 'biz' || L.kind === 'mort' || L.kind === 'proj')).length * 2; }
/* 全店の口座数（勘定系システムの負荷・手数料の基礎） */
function accountsCount() {
  let n = cityAccounts() + Math.round(natDep() / 2.5e6 + B('depFx') / 1e7);
  for (const L of G.loans) if (L.kind === 'seg' && isActiveLoan(L)) n += Math.round(L.bal / (L.seg === 'retail' ? 2e7 : 1e8));
  return n;
}
function staffTotal() { return G.staff.sales + G.staff.credit + G.staff.ops + G.staff.comp; }

/* ---------- 事務・システムの余力 ---------- */
function opsRequired() {
  let r = 0;
  for (const b of openBranches()) r += BRANCH_TYPES[b.type].ops;
  return r + cityAccounts() / (2500 * (1 + 0.15 * G.sys.digital));
}
function serviceQuality() { return clamp(G.staff.ops / Math.max(1, opsRequired()), 0.3, 1.3); }
function compRequired() { return 2 + staffTotal() * 0.06 + openBranches().length * 0.3 + netStaff() * 0.004; }
function compRatio() { return G.staff.comp / compRequired(); }
function coreCapacity() { return SYSTEMS.core.levels[G.sys.core].cap; }
function coreLoad() { return (accountsCount() + G.loans.filter(isActiveLoan).length * 5) / coreCapacity(); }
function auditSlots() { return Math.max(1, Math.floor(G.staff.comp / 3)); }

/* ---------- 預金 ---------- */
function depositTargets() {
  const pres = districtPresence();
  const r = G.rates, e = G.eco;
  const rfOrd = clamp(Math.exp(2.5 * (r.ord - e.mktOrd)), 0.75, 1.6);
  const rfTime = clamp(Math.exp(4.0 * (r.time - e.mktTime)), 0.6, 2.5);
  const trustF = clamp(Math.pow(G.trust / 65, 0.8), 0.4, 1.3);
  const adF = 1 + 0.12 * Math.log(1 + G.adBudget / 500e4);
  const svcF = clamp(0.85 + 0.2 * serviceQuality(), 0.8, 1.06);
  const digF = 1 + 0.06 * G.sys.digital;
  const digReach = [0, 0.04, 0.1, 0.22][G.sys.digital];
  let ord = 0, time = 0;
  const byD = {};
  for (const D of DISTRICTS) {
    const s = G.city.d[D.id];
    const pr = pres[D.id];
    const reach = (pr > 0 ? (1 - Math.exp(-1.3 * pr)) / (1 - Math.exp(-1.3)) : 0) + digReach;
    const common = 0.03 / D.compet * reach * trustF * adF * svcF * digF * G.depCalib;
    const o = s.depMkt * (1 - D.timeShare) * common * rfOrd;
    const t = s.depMkt * D.timeShare * common * rfTime;
    byD[D.id] = { ord: o, time: t, share: (o + t) / s.depMkt };
    ord += o; time += t;
  }
  let nat = 0;
  if (G.sys.digital >= 3) {
    nat = 3e12 * 0.004 * rfTime * rfTime * trustF;
    time += nat;
    ord += 3e12 * 0.0012 * rfOrd * trustF;
  }
  let settle = 0;
  for (const L of G.loans) if ((L.kind === 'biz' || L.kind === 'proj') && (L.status === 'current' || L.status === 'late')) settle += L.bal * 0.12;
  ord += settle + (G.flags.designated || 0) + (G.flags.bigDep || 0);
  return { ord, time, byD, nat, settle };
}

function processDeposits() {
  const tg = depositTargets();
  const e = G.eco, r = G.rates;
  const load = coreLoad();
  const ord = cityOrd();
  const mo = calMonth(G.m);
  const seas = ({ 6: 0.012, 7: -0.006, 12: 0.015, 1: -0.008, 3: -0.004, 4: 0.004 })[mo] || 0;
  let dOrd = (tg.ord - ord) * 0.05 + ord * (randn() * 0.004 + seas);
  if (load > 1 && dOrd > 0) dOrd *= 0.2;
  if (G.trust < 30) dOrd -= ord * (30 - G.trust) / 30 * 0.12;
  if (G.runShock) dOrd -= ord * G.runShock;
  dOrd = Math.round(Math.max(-ord * 0.6, dOrd));
  // 定期預金（1年もの）の満期と継続
  const idx = ((G.m % 12) + 12) % 12;
  const coh = G.dep.coh[idx];
  const matured = coh.bal;
  let retention = clamp(0.88 + 0.5 * (r.time - e.mktTime) + (G.trust - 60) / 200, 0.4, 0.97);
  if (G.runShock) retention *= 1 - G.runShock * 1.5;
  const renew = Math.round(matured * clamp(retention, 0.2, 0.97));
  const toOrd = Math.round((matured - renew) * 0.4);
  const outT = matured - renew - toOrd;
  const DT = cityTime();
  let newT = (tg.time - DT) * 0.07 + DT * randn() * 0.002;
  if (load > 1 && newT > 0) newT *= 0.2;
  let early = 0;
  if (newT < 0) { early = Math.round(Math.min(-newT * 0.3, DT * 0.02)); newT = 0; }
  if (G.trust < 30) early += Math.round(DT * (30 - G.trust) / 30 * 0.05);
  if (G.runShock) early += Math.round(DT * G.runShock * 0.4);
  newT = Math.round(newT);
  coh.bal = renew + newT;
  coh.rate = r.time;
  if (early > 0) {
    const others = G.dep.coh.filter((c, i) => i !== idx);
    const tot = sum(others, c => c.bal);
    early = Math.min(early, tot);
    let left = early;
    others.forEach((c, i) => {
      const x = i === others.length - 1 ? left : Math.min(left, Math.round(early * c.bal / Math.max(1, tot)));
      c.bal -= x; left -= x;
    });
  }
  if (outT + toOrd + early > 0) post('定期預金の満期払戻・中途解約', [['depTime', outT + toOrd + early, 0], ['boj', 0, outT + early], ['depOrd', 0, toOrd]]);
  if (newT > 0) post('定期預金の預入れ', [['boj', newT, 0], ['depTime', 0, newT]]);
  if (dOrd > 0) post('普通預金の純増（入金超）', [['boj', dOrd, 0], ['depOrd', 0, dOrd]]);
  else if (dOrd < 0) post('普通預金の純減（払出超）', [['depOrd', -dOrd, 0], ['boj', 0, -dOrd]]);
  G.runShock = 0;
  if (G.flags.bigDep) G.flags.bigDep *= 0.97;
}

function payDepositInterest() {
  let oi = Math.round(cityOrd() * G.rates.ord / 1200);
  let ti = 0;
  for (const c of G.dep.coh) { const i = Math.round(c.bal * c.rate / 1200); c.bal += i; ti += i; }
  if (G.net) for (const R of NATIONS) {
    const r = G.net[R.id];
    const io = Math.round(r.ord * G.rates.ord / 1200), it = Math.round(r.time * r.tRate / 1200);
    r.ord += io; r.time += it; oi += io; ti += it;
  }
  if (oi > 0) post('普通預金利息の元加', [['intDep', oi, 0], ['depOrd', 0, oi]]);
  if (ti > 0) post('定期預金利息の元加', [['intDep', ti, 0], ['depTime', 0, ti]]);
}

/* ---------- 準備預金・流動性 ---------- */
function requiredReserve() { return Math.round(B('depOrd') * 0.01 + B('depTime') * 0.006); }
const RATING_SPREAD = [0, 0, 0.01, 0.01, 0.02, 0.03, 0.04, 0.05, 0.07, 0.12, 0.2, 0.4, 0.8];
function callMarketOpen() {
  if (G.trust < 22) return false;
  if (G.eco.regime === 'crisis' && G.ratingIdx >= 9) return false;
  return true;
}
function callLimit() { return deposits() * (G.ratingIdx <= 7 ? 0.2 : 0.1); }
function liquidityRatio() { return (B('cash') + B('boj') + B('callLoan') + B('securities')) / Math.max(1, deposits()) * 100; }
function lcr() {
  const hqla = B('cash') + B('boj') + B('securities') * 0.98;
  const out = B('depOrd') * 0.06 + B('depTime') * 0.04 + B('depFx') * 0.1 + B('callMoney') + B('bojBorrow');
  return hqla / Math.max(1, out) * 100;
}

/* 支払に先立ち日銀当座の残高を確保する（不足分はコール市場→日銀借入で調達） */
function ensureFunds(amount) {
  let short = Math.round(amount - B('boj'));
  if (short <= 0) return true;
  if (B('callLoan') > 0) { const x = Math.min(short, B('callLoan')); post('コールローンの回収', [['boj', x, 0], ['callLoan', 0, x]]); short -= x; }
  if (short > 0 && callMarketOpen()) {
    const x = Math.min(short, Math.max(0, callLimit() - B('callMoney')));
    if (x > 0) { post('コールマネーの調達', [['boj', x, 0], ['callMoney', 0, x]]); short -= x; }
  }
  if (short > 0) {
    const cap = B('loans') * 0.3 - B('bojBorrow');
    const x = Math.min(short, Math.max(0, cap));
    if (x > 0) { post('日銀補完貸付の利用（貸出債権担保）', [['boj', x, 0], ['bojBorrow', 0, x]]); short -= x; }
  }
  return short <= 0;
}
function canFund(amount) {
  const avail = B('boj') + B('callLoan') + (callMarketOpen() ? Math.max(0, callLimit() - B('callMoney')) : 0);
  return avail >= amount;
}

function manageLiquidity() {
  const req = requiredReserve();
  let excess = B('boj') - Math.round(req * 1.05);
  if (excess > 0 && B('bojBorrow') > 0) { const x = Math.min(excess, B('bojBorrow')); post('日銀借入の返済', [['bojBorrow', x, 0], ['boj', 0, x]]); excess -= x; }
  if (excess > 0 && B('callMoney') > 0) { const x = Math.min(excess, B('callMoney')); post('コールマネーの返済', [['callMoney', x, 0], ['boj', 0, x]]); excess -= x; }
  if (excess > 0 && G.treasury.autoCall) {
    const keep = Math.round(req * (G.treasury.bojBuffer || 1.3)) - req;
    const x = Math.max(0, excess - keep);
    if (x > 1e8) post('余資のコール運用（自動）', [['callLoan', x, 0], ['boj', 0, x]]);
  }
  let short = req - B('boj');
  if (short > 0 && B('callLoan') > 0) { const x = Math.min(short, B('callLoan')); post('コールローンの回収', [['boj', x, 0], ['callLoan', 0, x]]); short -= x; }
  if (short > 0 && callMarketOpen()) {
    const x = Math.min(short, Math.max(0, callLimit() - B('callMoney')));
    if (x > 0) { post('コールマネーの調達', [['boj', x, 0], ['callMoney', 0, x]]); short -= x; }
  }
  if (short > 0) {
    const bonds = G.bonds.slice().sort((a, b) => a.matM - b.matM);
    for (const bd of bonds) {
      if (short <= 0) break;
      const res = sellBond(bd.id, true);
      if (res.ok) short -= res.proceeds;
    }
    if (G.bonds.length < bonds.length) addNews('bank', '資金繰りのため保有国債を売却した', 'bad');
  }
  if (short > 0) {
    const cap = B('loans') * 0.3 - B('bojBorrow');
    if (cap >= short) {
      post('日銀補完貸付の利用（貸出債権担保）', [['boj', short, 0], ['bojBorrow', 0, short]]);
      G.trust = clamp(G.trust - 4, 0, 100);
      addNews('bank', `資金繰りが逼迫し、日銀の補完貸付で${fmtYen(short)}を調達`, 'bad');
    } else {
      gameOver('liquidity');
    }
  }
}

/* ---------- 市場運用（国債・コール） ---------- */
function bondPrice(c, yPct, n) {
  if (n <= 0) return 100;
  const y = yPct / 100;
  if (Math.abs(y) < 1e-7) return 100 + c * n;
  const df = Math.pow(1 + y, -n);
  return c * (1 - df) / y + 100 * df;
}
function bondMarket(bd) {
  const n = Math.max(0, (bd.matM - G.m) / 12);
  const y = yieldAt(n);
  const px = bondPrice(bd.coupon, y, n);
  return { n, y, px, value: Math.round(bd.face * px / 100) };
}
function securitiesMarketValue() { return sum(G.bonds, bd => bondMarket(bd).value); }
function unrealizedGain() { return securitiesMarketValue() - B('securities'); }
function bondSeries(tenor) { G.seq.bond++; return { 2: 470, 5: 175, 10: 380, 20: 196 }[tenor] + Math.floor(G.m / (tenor === 2 ? 1 : 1)) + (G.seq.bond % 3); }

function buyBond(tenor, face) {
  face = Math.round(face);
  if (face < 1e8) return { ok: false, msg: '購入額は1億円以上で指定してください' };
  if (B('boj') - face < requiredReserve()) return { ok: false, msg: `日銀当座預金が不足します（所要準備額 ${fmtYen(requiredReserve())} を維持する必要があります）` };
  const coupon = Math.max(0.005, Math.round(G.eco.y[tenor] * 1000) / 1000);
  const bd = { id: 'B' + (++G.seq.bond), tenor, face, coupon, buyM: G.m, matM: G.m + tenor * 12, book: face, name: `利付国債（${tenor}年）第${bondSeries(tenor)}回` };
  G.bonds.push(bd);
  post('国債の購入', [['securities', face, 0], ['boj', 0, face]]);
  return { ok: true, bd };
}
function sellBond(id, auto) {
  const bd = G.bonds.find(b => b.id === id);
  if (!bd) return { ok: false, msg: '銘柄が見つかりません' };
  const mk = bondMarket(bd);
  const proceeds = mk.value;
  const gain = proceeds - bd.book;
  const lines = [['boj', proceeds, 0], ['securities', 0, bd.book]];
  if (gain > 0) lines.push(['bondGain', 0, gain]); else if (gain < 0) lines.push(['bondLoss', -gain, 0]);
  post(auto ? '国債の売却（資金繰り）' : '国債の売却', lines);
  G.bonds = G.bonds.filter(b => b !== bd);
  return { ok: true, proceeds, gain };
}
function setCallLoan(target) {
  target = Math.max(0, Math.round(target));
  const cur = B('callLoan');
  if (target > cur) {
    const x = target - cur;
    if (B('boj') - x < requiredReserve()) return { ok: false, msg: '日銀当座預金が所要準備額を下回るため放出できません' };
    post('コールローンの放出', [['callLoan', x, 0], ['boj', 0, x]]);
  } else if (target < cur) {
    const x = cur - target;
    post('コールローンの回収', [['boj', x, 0], ['callLoan', 0, x]]);
  }
  return { ok: true };
}

function processTreasuryMonthly() {
  // 国債利息・償還
  let cpn = 0;
  for (const bd of G.bonds) cpn += Math.round(bd.face * bd.coupon / 1200);
  receive(cpn, 'intSec', '国債利息の受入');
  for (const bd of G.bonds.slice()) {
    if (G.m + 1 >= bd.matM) {
      post('国債の償還', [['boj', bd.face, 0], ['securities', 0, bd.book]]);
      G.bonds = G.bonds.filter(b => b !== bd);
    }
  }
  const e = G.eco;
  receive(Math.round(B('callLoan') * e.call / 1200), 'intCall', 'コールローン利息の受入');
  const cmRate = e.call + RATING_SPREAD[G.ratingIdx] + 0.02;
  payExpense(Math.round(B('callMoney') * cmRate / 1200), 'intCallM', 'コールマネー利息の支払');
  payExpense(Math.round(B('bojBorrow') * (e.policy + 0.25) / 1200), 'intBorrow', '日銀借入利息の支払');
  const exr = Math.max(0, B('boj') - requiredReserve());
  receive(Math.round(exr * e.policy / 1200), 'intBoj', '日銀当座預金の付利');
}

/* ---------- 金庫・現金 ---------- */
function vaultCapacity() { return VAULT_LEVELS[G.vault.lv].cap + sum(openBranches(), b => BRANCH_TYPES[b.type].vaultCap); }
function cashRequired() { return cityOrd() * 0.02 + sum(openBranches(), b => BRANCH_TYPES[b.type].cashBase) + totalATMs() * ATM_CASH; }
const CASH_SEASON = { 12: 1.3, 3: 1.12, 4: 1.08, 5: 1.08, 6: 1.12, 8: 1.06 };
function cashTarget(mNext = G.m + 1) { return Math.min(vaultCapacity(), cashRequired() * (CASH_SEASON[calMonth(mNext)] || 1) * G.vault.buffer); }

function processVault() {
  const req = cashRequired();
  const mo = calMonth(G.m);
  const seas = CASH_SEASON[mo] || 1;
  const W = req * seas * Math.exp(randn() * 0.1);
  const cash = B('cash');
  if (cash < W) {
    const sev = (W - cash) / W;
    G.trust = clamp(G.trust - (1.5 + 6 * sev), 0, 100);
    payExpense(300e4, 'premises', '緊急現金輸送費');
    G.stats.cashShortages++;
    addNews('bank', `現金需要が金庫の在高を上回り、一部ATMが一時停止（不足額 約${fmtYen(W - cash)}）`, 'bad');
  }
  if (G.pendingInsurance) { receive(G.pendingInsurance, 'extraGain', '盗難保険金の受取'); G.pendingInsurance = 0; }
  const pRob = 0.0015 * SECURITY_LEVELS[G.vault.sec].risk * (1 + 0.15 * openBranches().length);
  if (chance(pRob)) {
    const loss = Math.round(Math.min(B('cash') * 0.02, uni(500e4, 6000e4)));
    post('現金の盗難被害', [['extraLoss', loss, 0], ['cash', 0, loss]]);
    G.pendingInsurance = Math.round(loss * 0.5);
    G.trust = clamp(G.trust - 2, 0, 100);
    G.stats.robberies++;
    addNews('bank', `${pick(openBranches()).name}で現金輸送中の盗難事件。被害額${fmtYen(loss)}（保険で半額補填予定）`, 'bad');
  }
  const delta = Math.round(cashTarget() - B('cash'));
  if (delta > 0) {
    const x = Math.min(delta, Math.max(0, B('boj')));
    if (x > 0) post('日銀当座からの現金引出し（現送）', [['cash', x, 0], ['boj', 0, x]]);
  } else if (delta < 0) post('余剰現金の日銀当座への預入れ', [['boj', -delta, 0], ['cash', 0, -delta]]);
}

function startVaultUpgrade() {
  const nx = VAULT_LEVELS[G.vault.lv + 1];
  if (!nx) return { ok: false, msg: 'これ以上拡張できません' };
  if (G.vault.upgrade) return { ok: false, msg: '工事中です' };
  if (B('boj') - nx.cost < requiredReserve()) return { ok: false, msg: '資金が不足しています' };
  addAsset(`金庫設備（${nx.name}）`, 'tangible', nx.cost, 240);
  G.vault.upgrade = { to: nx.lv, doneM: G.m + nx.months };
  if (nx.months === 0) vaultUpgradeStep();
  return { ok: true };
}
function vaultUpgradeStep() {
  const u = G.vault.upgrade;
  if (u && G.m >= u.doneM) {
    G.vault.lv = u.to; G.vault.upgrade = null;
    addNews('bank', `本店の金庫を「${VAULT_LEVELS[u.to].name}」に拡張（収容能力${fmtYen(VAULT_LEVELS[u.to].cap)}）`, 'good');
  }
}
function upgradeSecurity() {
  const nx = SECURITY_LEVELS[G.vault.sec + 1];
  if (!nx) return { ok: false, msg: 'これ以上強化できません' };
  if (B('boj') - nx.cost < requiredReserve()) return { ok: false, msg: '資金が不足しています' };
  if (nx.cost) addAsset(`警備設備（${nx.name}）`, 'tangible', nx.cost, 120);
  G.vault.sec = nx.lv;
  return { ok: true };
}

/* ---------- 固定資産 ---------- */
function addAsset(name, kind, cost, lifeM) {
  cost = Math.round(cost);
  const a = { id: 'F' + (++G.seq.asset), name, kind, cost, life: lifeM, m0: G.m, book: cost };
  G.assets.push(a);
  post(kind === 'tangible' ? '有形固定資産の取得' : 'ソフトウェアの取得', [[kind, cost, 0], ['boj', 0, cost]]);
  return a;
}
function depreciateAssets() {
  let t = 0, it = 0;
  for (const a of G.assets) {
    if (!a.life || a.book <= 0) continue;
    const d = Math.min(a.book, Math.round(a.cost / a.life));
    a.book -= d;
    if (a.kind === 'tangible') t += d; else it += d;
  }
  if (t > 0) post('減価償却（有形固定資産）', [['depreciation', t, 0], ['tangible', 0, t]]);
  if (it > 0) post('減価償却（ソフトウェア）', [['depreciation', it, 0], ['intangible', 0, it]]);
  G.assets = G.assets.filter(a => a.book > 0 || !a.life);
}
function disposeAsset(a, desc) {
  if (a.book > 0) post(desc || '固定資産の除却', [['extraLoss', a.book, 0], [a.kind, 0, a.book]]);
  G.assets = G.assets.filter(x => x !== a);
}

/* ---------- 店舗の出店・閉鎖 ---------- */
function branchName(did, type) {
  const base = { chuo: '中央', ekimae: '駅前', kowan: '港湾', kogyo: '臨海工業団地', newtown: '北部ニュータウン', gakuen: '学園都市', onsen: '温泉郷', denen: '田園' }[did];
  const n = G.branches.filter(b => b.d === did).length;
  const pre = n >= 1 ? ['', '第二', '第三', '第四'][n] || '' : '';
  return `${base}${pre}${type === 'small' ? '出張所' : '支店'}`;
}
function openBranch(did, type) {
  const T = BRANCH_TYPES[type];
  if (G.flags.order > G.m) return { ok: false, msg: '業務改善命令の期間中は新規出店できません' };
  if (G.branches.filter(b => b.d === did).length >= 3) return { ok: false, msg: '1地区に置ける店舗は3つまでです' };
  const hire = T.ops + T.sales;
  const cost = T.capex + hire * HIRE_COST;
  if (B('boj') - cost < requiredReserve()) return { ok: false, msg: '資金が不足しています' };
  const b = { id: 'b' + (++G.seq.branch), d: did, type, openM: G.m + T.months, name: branchName(did, type) };
  b.assetId = addAsset(`${b.name}の店舗設備`, 'tangible', T.capex, 180).id;
  G.branches.push(b);
  G.staff.ops += T.ops; G.staff.sales += T.sales;
  payExpense(hire * HIRE_COST, 'premises', '採用費・研修費');
  addNews('bank', `${DIST[did].name}に「${b.name}」の開設を決定（${ymLabel(b.openM)}開業予定）`, 'good');
  return { ok: true, b };
}
function closeBranch(id) {
  const b = G.branches.find(x => x.id === id);
  if (!b || b.type === 'hq') return { ok: false, msg: '本店は閉鎖できません' };
  const a = G.assets.find(x => x.id === b.assetId);
  if (a) disposeAsset(a, '店舗閉鎖に伴う固定資産除却損');
  G.branches = G.branches.filter(x => x !== b);
  const T = BRANCH_TYPES[b.type];
  const red = Math.min(G.staff.ops - 1, T.ops);
  G.staff.ops -= red;
  post('店舗閉鎖に伴う退職金等', [['extraLoss', Math.round(red * BASE_SALARY * 0.4), 0], ['boj', 0, Math.round(red * BASE_SALARY * 0.4)]]);
  G.city.d[b.d].failPen += 2;
  G.trust = clamp(G.trust - 1, 0, 100);
  addNews('bank', `「${b.name}」を閉鎖した。地元からは惜しむ声も`, 'neutral');
  return { ok: true };
}
function addATM(did) {
  if ((G.atms[did] || 0) >= 10) return { ok: false, msg: '1地区のATMは10台までです' };
  if (B('boj') - ATM_CAPEX < requiredReserve()) return { ok: false, msg: '資金が不足しています' };
  addAsset(`ATM（${DIST[did].name}）`, 'tangible', ATM_CAPEX, 72);
  G.atms[did] = (G.atms[did] || 0) + 1;
  return { ok: true };
}
function removeATM(did) {
  if (!G.atms[did]) return { ok: false, msg: '撤去できるATMがありません' };
  G.atms[did]--;
  return { ok: true };
}

/* ---------- システム ---------- */
function startSystemUpgrade(sys, method) {
  const S = SYSTEMS[sys];
  const nx = S.levels[G.sys[sys] + 1];
  if (!nx) return { ok: false, msg: '最新の段階です' };
  if (G.itProjects.some(p => p.sys === sys)) return { ok: false, msg: 'すでにプロジェクトが進行中です' };
  const phased = sys === 'core' && method === 'phased';
  const cost = Math.round(nx.cost * (phased ? 1.35 : 1));
  if (B('boj') - cost < requiredReserve()) return { ok: false, msg: '資金が不足しています' };
  const months = Math.round(nx.months * (phased ? 1.5 : 1));
  addAsset(`${S.name}（${nx.name}）`, 'intangible', cost, 60);
  G.itProjects.push({ sys, to: G.sys[sys] + 1, startM: G.m, doneM: G.m + months, method: sys === 'core' ? method : 'std', cost });
  addNews('bank', `${S.name}を「${nx.name}」へ刷新するプロジェクトを開始（投資額${fmtYen(cost)}）`, 'neutral');
  return { ok: true };
}
function itProjectsStep() {
  for (const p of G.itProjects.slice()) {
    if (G.m < p.doneM) continue;
    G.itProjects = G.itProjects.filter(x => x !== p);
    G.sys[p.sys] = p.to;
    const S = SYSTEMS[p.sys];
    if (p.sys === 'core') {
      const risk = p.method === 'phased' ? 0.04 : 0.18;
      if (chance(risk)) {
        systemFailure(true);
        addNews('bank', `新勘定系システムへの移行で大規模障害。ATM・振込が終日停止`, 'bad');
      } else addNews('bank', `新しい勘定系システム「${S.levels[p.to].name}」が無事に稼働`, 'good');
    } else addNews('bank', `${S.name}「${S.levels[p.to].name}」が稼働`, 'good');
  }
}
function systemFailure(big) {
  const acc = accountsCount();
  const cost = Math.round((big ? uni(1.5e8, 4e8) : uni(0.2e8, 1e8)) * Math.sqrt(acc / 20000));
  post('システム障害に伴う補償・対応費用', [['extraLoss', cost, 0], ['boj', 0, cost]]);
  G.trust = clamp(G.trust - (big ? uni(8, 14) : uni(3, 7)), 0, 100);
  G.stats.sysFailures++;
  G.scandalHeat += big ? 8 : 3;
  if (big) G.fsa.special = true;
}

/* ---------- 人員 ---------- */
function hireStaff(role, n) {
  if (n > 0) {
    G.staff[role] += n;
    payExpense(n * HIRE_COST, 'premises', '採用費・研修費');
  } else if (n < 0) {
    const k = Math.min(-n, G.staff[role] - 1);
    if (k <= 0) return { ok: false, msg: 'これ以上減らせません' };
    G.staff[role] -= k;
    payExpense(Math.round(k * BASE_SALARY * G.salaryLv * 0.4), 'personnel', '早期退職の割増退職金');
  }
  return { ok: true };
}
function staffStep() {
  const s = G.salaryLv;
  const p = 0.0045 * (s < 1 ? 1 + (1 - s) * 9 : Math.max(0.35, 1 - (s - 1) * 2.2)) * (G.flags.publicFunds ? 1.3 : 1);
  const n = poisson(staffTotal() * p);
  if (n > 0) {
    let left = n;
    const roles = Object.keys(G.staff);
    while (left > 0) {
      const r = wpick(roles, roles.map(k => G.staff[k]));
      if (G.staff[r] > 1) G.staff[r]--;
      left--;
    }
    if (n >= 3) addNews('bank', `行員${n}人が退職。${s < 1 ? '給与水準の低さへの不満が背景に' : '他行への転職が相次ぐ'}`, 'bad');
  }
}

/* ---------- 手数料・経費 ---------- */
function monthlyCosts() {
  const mo = calMonth(G.m);
  let rent = 0;
  for (const b of openBranches()) if (b.type !== 'hq') rent += DIST[b.d].rent * BRANCH_TYPES[b.type].rentMul;
  let sys = 0;
  for (const k of SYS_KEYS) sys += SYSTEMS[k].levels[G.sys[k]].maint || 0;
  const guard = VAULT_LEVELS[G.vault.lv].maint + SECURITY_LEVELS[G.vault.sec].maint + openBranches().length * 15e4 + totalATMs() * ATM_MAINT;
  const misc = staffTotal() * 2e4 + accountsCount() * 15;
  const pay = staffTotal() * BASE_SALARY * G.salaryLv / 16 * (mo === 6 || mo === 12 ? 3 : 1);
  return { rent, sys, guard, ad: G.adBudget, misc, pay };
}
function processFeesAndExpenses() {
  const acc = accountsCount();
  const bizN = G.loans.filter(L => L.kind === 'biz' && isActiveLoan(L)).length;
  receive(Math.round(acc * 120 + bizN * 8000 + acc * 6 * G.sys.digital + totalATMs() * 3e4), 'fees', '為替・預金・ATM手数料');
  const inv = G.staff.sales * 70e4 * clamp(G.trust / 65, 0.3, 1.4) * clamp(G.eco.stock / 100, 0.5, 1.6);
  receive(Math.round(inv), 'fees', '投資信託・保険の販売手数料');
  payExpense(Math.round(acc * 10), 'feeExp', '支払為替手数料・提携ATM利用料');
  const c = monthlyCosts();
  const mo = calMonth(G.m);
  payExpense(Math.round(c.pay), 'personnel', mo === 6 || mo === 12 ? '給与・賞与の支払' : '給与の支払');
  payExpense(Math.round(c.rent), 'premises', '店舗賃借料');
  payExpense(Math.round(c.sys), 'premises', 'システム運用・保守費');
  payExpense(Math.round(c.guard), 'premises', '警備・現金輸送・ATM保守費');
  payExpense(Math.round(c.ad), 'premises', '広告宣伝費');
  payExpense(Math.round(c.misc), 'premises', '事務費・通信費等');
  payExpense(Math.round(domDeposits() * DEP_INSURANCE_RATE / 12), 'depInsurance', '預金保険料');
  payExpense(Math.round(totalAssets() * 0.00012 / 12 + B('tangible') * 0.0014 / 12), 'taxes', '租税公課（外形標準課税・固定資産税等）');
}

/* ---------- 自己資本比率（国内基準・簡易版） ---------- */
function ttm(keys, n = 12) {
  const hs = G.hist.slice(-n);
  let s = 0;
  for (const h of hs) for (const k of keys) s += h.pl[k] || 0;
  return hs.length ? s * 12 / hs.length : 0;
}
function grossProfitTTM() {
  const inc = ttm(['intLoans', 'intSec', 'intCall', 'intBoj', 'fees', 'bondGain', 'fxGain']);
  const exp = ttm(['intDep', 'intCallM', 'intBorrow', 'fundingCost', 'feeExp', 'bondLoss', 'fxLoss']);
  return G.hist.length >= 3 ? inc - exp : G.initGP;
}
function generalAllowance() { return sum(G.loans.filter(L => isActiveLoan(L) && L.cls <= 2), L => L.provision || 0); }
function rwaBreakdown() {
  let biz = 0, mort = 0, proj = 0, def = 0, seg = 0, ovs = 0;
  for (const L of G.loans) {
    if (!isActiveLoan(L) || L.bal <= 0) continue;
    if (L.kind === 'seg') {
      const w = L.bal * SEG[L.seg].rw;
      if (isOvsArea(L.area)) ovs += w * (1 + 0.15 * (OVSR[L.area].risk - 1)); else seg += w;
      continue;
    }
    if (L.status === 'default' || L.status === 'bankrupt') { def += Math.max(0, L.bal - (L.provision || 0)) * 1.5; continue; }
    if (L.kind === 'mort' || L.kind === 'pool') { mort += L.bal * 0.35; continue; }
    if (L.kind === 'proj') { proj += L.bal; continue; }
    const cg = L.bal * (L.cgc || 0);
    biz += cg * 0.1 + (L.bal - cg) * (L.principal <= 1e8 ? 0.75 : 1.0);
  }
  const call = B('callLoan') * 0.2;
  const fixed = B('tangible') + B('otherAssets');
  const credit = biz + mort + proj + def + seg + ovs + call + fixed;
  const op = Math.max(0, grossProfitTTM()) * 0.15 * 12.5;
  // 為替リスク（ヘッジしていない外貨ポジション）
  let fx = 0;
  if (G.net && G.credit) for (const R of OVERSEAS) fx += (G.net[R.id].gap || 0) * (1 - G.credit.hedge);
  return { biz, mort, proj, def, seg, ovs, call, fixed, credit, op, fx, total: credit + op + fx };
}
function coreCapitalParts(rwa) {
  const r = rwa || rwaBreakdown();
  const ga = Math.min(generalAllowance(), r.credit * 0.0125);
  const eq = B('capital') + B('prefCapital') + B('capSurplus') + B('retained') + curProfit();
  return { eq, ga, intangible: B('intangible'), goodwill: B('goodwill'), core: eq + ga - B('intangible') - B('goodwill') };
}
function coreCapital() { return coreCapitalParts().core; }
function capitalRatio() {
  const r = rwaBreakdown();
  return r.total > 0 ? coreCapitalParts(r).core / r.total * 100 : 99;
}

/* 金融再生法開示債権 */
function nplBreakdown() {
  const o = { bk: 0, doubt: 0, sub: 0, normal: 0, total: 0 };
  for (const L of G.loans) {
    if (!isActiveLoan(L) || L.bal <= 0) continue;
    o.total += L.bal;
    if (L.kind === 'seg') { const n = Math.min(L.bal, L.npl || 0); o.sub += n * 0.5; o.doubt += n * 0.5; o.normal += L.bal - n; continue; }
    if (L.cls >= 4) o.bk += L.bal;
    else if (L.cls === 3) o.doubt += L.bal;
    else if (L.cls === 2) o.sub += L.bal;
    else o.normal += L.bal;
  }
  o.npl = o.bk + o.doubt + o.sub;
  o.ratio = o.total ? o.npl / o.total * 100 : 0;
  return o;
}
const nplRatio = () => nplBreakdown().ratio;

/* 金利リスク（IRRBB：+1%の金利上昇時の経済価値の減少） */
function irrbb() {
  let loss = 0;
  for (const bd of G.bonds) {
    const mk = bondMarket(bd);
    loss += bd.face * (mk.px - bondPrice(bd.coupon, mk.y + 1, mk.n)) / 100;
  }
  for (const L of G.loans) {
    if (!isActiveLoan(L) || L.status === 'bankrupt') continue;
    const fixedLeft = L.kind === 'mort' ? (L.fixUntil && G.m < L.fixUntil ? (L.fixUntil - G.m) / 12 : 0)
      : (L.rateType === 'fixed' || L.kind === 'proj') ? (L.endM - G.m) / 12 : 0;
    if (fixedLeft > 0) loss += L.bal * 0.01 * fixedLeft * 0.5;
  }
  loss -= B('depTime') * 0.01 * 0.5;
  loss -= B('depOrd') * 0.01 * 1.5 * 0.5; // コア預金の満期みなし
  return Math.max(0, loss);
}
/* 1年間の資金利益の感応度（+1%） */
function niiSensitivity() {
  let up = B('callLoan') + Math.max(0, B('boj') - requiredReserve());
  for (const L of G.loans) {
    if (!isActiveLoan(L) || L.status === 'bankrupt') continue;
    const isVar = L.kind === 'pool' || L.kind === 'seg' || (L.kind === 'mort' && !(L.fixUntil && G.m < L.fixUntil)) || (L.kind === 'biz' && L.rateType === 'var');
    if (isVar) up += L.bal;
    else if (L.endM - G.m <= 12) up += L.bal * 0.5;
  }
  for (const bd of G.bonds) if (bd.matM - G.m <= 12) up += bd.face * 0.5;
  const down = B('depOrd') * 0.4 + B('depTime') * 0.5 + B('callMoney');
  return (up - down) * 0.01;
}

/* ---------- 格付・株価 ---------- */
function computeRatingScore() {
  const cr = capitalRatio(), npl = nplRatio();
  const st = G.stage || 0;
  const ta = totalAssets();
  // 実績が半年に満たないうちは開業時の見込みを使う
  const n = G.hist.filter(h => h.m >= 0).length;
  const w = clamp(n / 6, 0, 1);
  const ni = lerp(G.initNI || 0.3e8, ttm(REV_KEYS) - ttm(EXP_KEYS), w);
  const gp = lerp(G.initGP, grossProfitTTM(), w);
  const opex = lerp(G.initOpex || 4.6e8, ttm(['personnel', 'premises', 'taxes', 'depreciation', 'depInsurance']), w);
  const roa = ni / Math.max(1, ta) * 100;
  const ohr = gp > 0 ? opex / gp * 100 : 200;
  let s = 0;
  // 上位の業態ほど求められる自己資本の水準が高い
  s += interp(cr - [0, 2.5, 4.5][st], [[0, 0], [4, 4], [6, 9], [8, 14], [10, 18], [12, 21], [16, 25]]);
  s += interp(npl, [[0, 15], [1, 15], [2, 13], [3, 11], [5, 8], [8, 4], [12, 0]]);
  s += interp(roa, [[-0.5, 0], [0, 4], [0.1, 8], [0.2, 11], [0.35, 15], [0.5, 20]]);
  s += interp(ohr, [[50, 15], [60, 13], [70, 10], [80, 7], [90, 4], [100, 2], [120, 0]]);
  s += interp(liquidityRatio(), [[5, 0], [10, 3], [15, 6], [20, 8], [25, 10]]);
  s += interp(ta, [[0, 2], [1000e8, 4], [3000e8, 6], [1e12, 8], [5e12, 10]]);
  s += Math.max(0, 5 - G.scandalHeat / 4 * (1 + 0.5 * st));
  if (st >= 1) s += 3; // システム上重要な銀行としての政府支援の期待
  if (G.net && st >= 2) s -= Math.min(5, sum(OVERSEAS, R => G.net[R.id].lv * (OVSR[R.id].risk - 1)) / 6);
  s -= G.ratingPenalty || 0;
  return { s, cr, npl, roa, ohr };
}
function ratingIdxOf(score) {
  for (let i = 0; i < RATING_SCORE.length; i++) if (score >= RATING_SCORE[i]) return i;
  return RATINGS.length - 1;
}
function updateRating() {
  const prev = G.ratingIdx;
  if (G.ratingPenalty) G.ratingPenalty = G.ratingPenalty > 0.5 ? G.ratingPenalty * 0.85 : 0;
  // 格付機関は景気の一巡を見通して判断する（直近の評価を前回の評価と均す）
  const s = computeRatingScore().s;
  G.ratingScore = prev === undefined || G.ratingScore === undefined ? s : 0.6 * s + 0.4 * G.ratingScore;
  G.ratingIdx = ratingIdxOf(G.ratingScore);
  if (prev !== undefined && prev !== G.ratingIdx) {
    addNews('bank', `格付機関が当行の格付を${RATINGS[prev]}から${RATINGS[G.ratingIdx]}に${G.ratingIdx < prev ? '引き上げ' : '引き下げ'}`, G.ratingIdx < prev ? 'good' : 'bad');
  }
}
function roeTTM() {
  const ni = ttm(REV_KEYS) - ttm(EXP_KEYS);
  return ni / Math.max(1, netAssets()) * 100;
}
function updateStock() {
  const st = G.stock;
  const bps = netAssets() / st.shares;
  const roe = G.hist.length >= 6 ? roeTTM() : 2;
  const ratingAdj = [0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.12, 0.08, 0.04, 0, -0.04, -0.08, -0.12][G.ratingIdx];
  const h12 = G.hist[G.hist.length - 13];
  const growth = h12 ? (totalAssets() / (h12.kpi.ta || 1) - 1) * 100 : 3;
  const pbr = clamp(0.25 + 0.055 * roe + ratingAdj + 0.008 * growth - G.scandalHeat * 0.01, 0.1, 2.2);
  const target = Math.max(1, bps * pbr);
  const mkt = G.eco.stock / (G.stock.lastIdx || G.eco.stock);
  st.lastIdx = G.eco.stock;
  st.price = Math.max(1, (st.price || target) * Math.pow(mkt, 0.6) * (1 + (target / (st.price || target) - 1) * 0.15) * Math.exp(randn() * 0.03));
}

/* ---------- 資本政策 ---------- */
function raiseCapital(amount) {
  amount = roundTo(amount, 1e8);
  const cap = G.stock.price * G.stock.shares;
  if (G.ratingIdx >= 12) return { ok: false, msg: '格付がCCCのため、引受先が見つかりません' };
  if (amount < 1e8) return { ok: false, msg: '1億円以上で指定してください' };
  if (amount > cap * 0.5) return { ok: false, msg: `増資額は時価総額の半分（${fmtYen(cap * 0.5)}）までです` };
  const gap = (G.stage || 0) >= 1 ? 6 : 12;
  if (G.raisedM !== undefined && G.m - G.raisedM < gap) return { ok: false, msg: `前回の増資から${gap === 6 ? '半年' : '1年'}以上あける必要があります` };
  const price = G.stock.price * 0.92;
  const sh = Math.round(amount / price);
  const fee = Math.round(amount * 0.03);
  const half = Math.round(amount / 2);
  post('第三者割当増資の払込', [['boj', amount, 0], ['capital', 0, half], ['capSurplus', 0, amount - half]]);
  payExpense(fee, 'otherExp', '株式交付費');
  G.stock.shares += sh;
  G.stock.price *= 0.95;
  G.raisedM = G.m;
  G.shareholders.dilution = (G.shareholders.dilution || 0) + amount / cap;
  addNews('bank', `第三者割当増資で${fmtYen(amount)}を調達（発行価格${fmtNum(price, 0)}円）`, 'neutral');
  return { ok: true, sh, price };
}
function acceptPublicFunds() {
  const r = rwaBreakdown();
  const need = Math.max(30e8, Math.round(r.total * (reqCR() + 5) / 100 - coreCapitalParts(r).core));
  post('公的資金（優先株式）の注入', [['boj', need, 0], ['prefCapital', 0, need]]);
  G.flags.publicFunds = true;
  G.flags.publicOffer = false;
  G.salaryLv = Math.min(G.salaryLv, 0.9);
  G.trust = clamp(G.trust - 5, 0, 100);
  G.stats.publicFundsAmt = need;
  addNews('bank', `経営悪化を受け、公的資金${fmtYen(need)}の注入を受けた。経営健全化計画の提出を義務付け`, 'bad');
  return { ok: true, need };
}
function repayPublicFunds() {
  const amt = B('prefCapital');
  if (amt <= 0) return { ok: false, msg: '返済する公的資金はありません' };
  const r = rwaBreakdown();
  const after = (coreCapitalParts(r).core - amt) / r.total * 100;
  const floor = Math.max(8, reqCR() + 2);
  if (after < floor) return { ok: false, msg: `返済後の自己資本比率が${fmtPct(floor, 1)}を下回ります（${fmtPct(after)}）` };
  if (B('boj') - amt < requiredReserve()) return { ok: false, msg: '資金が不足しています' };
  post('公的資金の返済（優先株式の取得・消却）', [['prefCapital', amt, 0], ['boj', 0, amt]]);
  G.flags.publicFunds = false;
  G.trust = clamp(G.trust + 4, 0, 100);
  addNews('bank', `公的資金${fmtYen(amt)}を完済。経営の自主性を回復`, 'good');
  return { ok: true };
}
