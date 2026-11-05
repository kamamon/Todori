'use strict';
/* =========================================================
 *  21_kaisha_core.js : 会社経営モードの共通エンジン
 *  複式簿記の元帳・給与・売掛金と買掛金・固定資産・借入と銀行の審査・
 *  月次の処理・決算整理・決算書の作成・予算・資金繰り
 *  （業種ごとの営業は 22_kaisha_ind.js）
 * ========================================================= */

const KS_LOSS_RATE = 0.01; // 貸倒実績率（初期値）

/* ---------- 元帳 ---------- */
function ksPost(code, lines, o = {}) {
  const rl = [];
  let d = 0, c = 0;
  for (const [k, dd, cc] of lines) {
    if (!(k in KS_ACCT)) throw new Error('勘定科目がありません: ' + k);
    const a = Math.round(dd || 0), b = Math.round(cc || 0);
    if (!a && !b) continue;
    if (a < 0 || b < 0) throw new Error(`負の仕訳金額: ${code} ${k} ${a} ${b}`);
    rl.push([k, a, b]);
    d += a; c += b;
  }
  if (!rl.length) return;
  if (d !== c) {
    const diff = d - c;
    if (Math.abs(diff) > 3) throw new Error(`貸借不一致の仕訳: ${code} 借方${d} 貸方${c}`);
    const side = diff > 0 ? 2 : 1;
    let best = rl[0];
    for (const l of rl) if (l[side] > best[side]) best = l;
    best[side] += Math.abs(diff);
  }
  const fl = o.closing ? G.flowC : G.flow;
  for (const [k, a, b] of rl) {
    const delta = ksDebitNature(k) ? a - b : b - a;
    G.bal[k] += delta;
    const t = KS_ACCT[k].t;
    if (t === 'R' || t === 'X') fl[k] = (fl[k] || 0) + delta;
    if (k === 'cash' && !o.closing) { const cat = o.cf || 'other'; G.cfm[cat] = (G.cfm[cat] || 0) + (a - b); }
  }
  const key = code + (o.key ? ':' + o.key : '');
  const j = G.jcur[key] || (G.jcur[key] = { code, d: o.desc || '', n: 0, l: {}, c: !!o.closing });
  j.n++;
  for (const [k, a, b] of rl) { const e = j.l[k] || (j.l[k] = [0, 0]); e[0] += a; e[1] += b; }
}
const ksB = k => G.bal[k] || 0;
function ksAcctName(k, where) {
  const I = KS_INDS[G.ind];
  const a = KS_ACCT[k];
  const lab = I.labels[k];
  if (where === 'bs' && a.bs && !lab) return a.bs;
  if (k === 'goods' && where === 'bs') return '商品';
  return lab || a.n;
}
function ksAssets() { return KS_KEYS.filter(k => KS_ACCT[k].t === 'A').reduce((s, k) => s + ksB(k), 0) - ksB('allow') - ksB('accDep'); }
function ksLiab() { return KS_KEYS.filter(k => KS_ACCT[k].t === 'L').reduce((s, k) => s + ksB(k), 0); }
function ksProfitOpen() { let r = 0; for (const k of KS_PL) r += KS_ACCT[k].t === 'R' ? ksB(k) : -ksB(k); return r; }
function ksEquity() { return ksB('capital') + ksB('re') + ksProfitOpen(); }
function ksDebt() { return ksB('std') + ksB('ltd'); }
function ksBalanceDiff() { return Math.round(ksAssets() - ksLiab() - ksEquity()); }

/* ---------- 売掛金・買掛金 ---------- */
function ksAddAR(amt, due, fee = 0, cust = null) {
  if (amt <= 0) return;
  const e = G.ar.find(x => x.due === due && x.fee === fee && x.cust === cust);
  if (e) e.amt += amt; else G.ar.push({ due, amt, fee, cust });
}
function ksAddAP(amt, due) {
  if (amt <= 0) return;
  const e = G.ap.find(x => x.due === due);
  if (e) e.amt += amt; else G.ap.push({ due, amt });
}
/* 掛け売上（due=何か月後に入金か） */
function ksSaleCredit(amt, lag, o = {}) {
  amt = Math.round(amt);
  if (amt <= 0) return;
  ksPost(o.card ? 'saleCard' : 'saleCredit', [['ar', amt, 0], ['sales', 0, amt]]);
  ksAddAR(amt, G.m + lag, o.fee || 0, o.cust ?? null);
}
function ksSaleCash(amt) {
  amt = Math.round(amt);
  if (amt > 0) ksPost('saleCash', [['cash', amt, 0], ['sales', 0, amt]], { cf: 'cashSales' });
}
function ksBuyCredit(acct, amt, lag = 1, code = 'purch') {
  amt = Math.round(amt);
  if (amt <= 0) return;
  ksPost(code, [[acct, amt, 0], ['ap', 0, amt]]);
  ksAddAP(amt, G.m + lag);
}
function ksPayCash(acct, amt, code = 'expense', cf = 'exp') {
  amt = Math.round(amt);
  if (amt > 0) ksPost(code, [[acct, amt, 0], ['cash', 0, amt]], { cf });
}
function ksCollect() {
  const due = G.ar.filter(x => x.due <= G.m);
  if (!due.length) return 0;
  G.ar = G.ar.filter(x => x.due > G.m);
  let gross = 0, fee = 0, cardGross = 0;
  for (const x of due) { gross += x.amt; if (x.fee) { cardGross += x.amt; fee += x.amt * x.fee; } }
  fee = Math.round(fee);
  const plain = gross - cardGross;
  if (plain > 0) ksPost('collect', [['cash', plain, 0], ['ar', 0, plain]], { cf: 'collect' });
  if (cardGross > 0) ksPost('collectCard', [['cash', cardGross - fee, 0], ['fees', fee, 0], ['ar', 0, cardGross]], { cf: 'collect' });
  return gross;
}
/* 取引先の倒産：その先の売掛金を貸倒れにする */
function ksWriteOffAR(cust, ratio = 1) {
  let amt = 0;
  for (const x of G.ar) if (x.cust === cust) { const a = Math.round(x.amt * ratio); amt += a; x.amt -= a; }
  G.ar = G.ar.filter(x => x.amt > 0);
  if (amt <= 0) return 0;
  const useAllow = Math.min(amt, ksB('allow'));
  ksPost('badDebt', [['allow', useAllow, 0], ['badDebt', amt - useAllow, 0], ['ar', 0, amt]]);
  return amt;
}
function ksApDueNow() { return sum(G.ap.filter(x => x.due <= G.m), x => x.amt); }

/* ---------- 給与 ---------- */
function ksRoleWage(r) { return r.wage * G.eco.wageIdx * (r.cost === 'labor' && G.ind === 'it' ? G.op.salaryLv : 1) * (G.wageLv || 1); }
function ksHeadcount() { return KS_INDS[G.ind].roles.reduce((s, r) => s + (G.staff[r.id] || 0), 0); }
/* 月の人件費の見込み（賞与・社会保険を含む平均） */
function ksPayrollEstimate() {
  const I = KS_INDS[G.ind];
  const out = { labor: 0, salary: 0, exec: G.execPay };
  for (const r of I.roles) {
    const w = (G.staff[r.id] || 0) * ksRoleWage(r);
    out[r.cost] += w * (1 + r.bonus / 12) * (1 + r.wf);
  }
  out.exec *= 1.15;
  out.total = out.labor + out.salary + out.exec;
  return out;
}
/* 給与の内訳（毎月の給与・賞与1回分・社会保険料の会社負担） */
function ksPayParts(costOnly) {
  const o = { base: 0, bonus: 0, wf: 0, wfRate: 0.15 };
  let wsum = 0, wfsum = 0;
  for (const r of KS_INDS[G.ind].roles) {
    if (costOnly && r.cost !== costOnly) continue;
    const w = (G.staff[r.id] || 0) * ksRoleWage(r);
    o.base += w; o.bonus += w * r.bonus / 2 * (G.bonusLv ?? 1); o.wf += w * r.wf;
    wsum += w; wfsum += w * r.wf;
  }
  o.wfRate = wsum ? wfsum / wsum : 0.15;
  return o;
}
function ksPayroll(extraLabor = 0) {
  const I = KS_INDS[G.ind];
  const mo = calMonth(G.m);
  const bonusM = mo === 6 || mo === 12;
  const w = { labor: 0, salary: 0 }, b = { labor: 0, salary: 0 }, wf = { labor: 0, salary: 0 };
  for (const r of I.roles) {
    const n = G.staff[r.id] || 0;
    const wage = n * ksRoleWage(r);
    const bon = bonusM ? wage * r.bonus / 2 * (G.bonusLv ?? 1) : 0;
    w[r.cost] += wage; b[r.cost] += bon;
    wf[r.cost] += (wage + bon) * r.wf;
  }
  w.labor += extraLabor;
  wf.labor += extraLabor * 0.15;
  ksPost('payroll', [['labor', w.labor, 0], ['salary', w.salary, 0], ['cash', 0, w.labor + w.salary]], { cf: 'payroll' });
  if (b.labor + b.salary > 0) ksPost('bonus', [['labor', b.labor, 0], ['salary', b.salary, 0], ['cash', 0, b.labor + b.salary]], { cf: 'payroll' });
  ksPost('execPay', [['execPay', G.execPay, 0], ['cash', 0, G.execPay]], { cf: 'payroll' });
  // 前月分の社会保険料（会社負担）を納付し、今月分を翌月に回す
  const p = G.wfPrev || { labor: 0, salary: 0 };
  ksPost('welfare', [['labor', p.labor, 0], ['welfare', p.salary, 0], ['cash', 0, p.labor + p.salary]], { cf: 'payroll' });
  G.wfPrev = { labor: Math.round(wf.labor), salary: Math.round(wf.salary + G.execPay * 0.15) };
  return { labor: w.labor + b.labor, salary: w.salary + b.salary };
}

/* ---------- 固定資産 ---------- */
function ksNewAsset(o) {
  const a = Object.assign({ id: 'F' + (++G.seq), booked: 0, part: 'S', acqM: G.m }, o);
  a.life = a.life || KS_LIFE[a.acct] || 0;
  G.assets.push(a);
  return a;
}
/* 期中の償却額（定額法・月割）。fyEndM までの使用月数で計算 */
function ksDepFor(a, fy) {
  if (a.acct === 'land' || !a.life) return 0;
  const start = fy * 12, end = fy * 12 + 11;
  if (a.soldM !== undefined && a.soldM < start) return 0;
  const from = Math.max(start, a.acqM);
  const to = a.soldM !== undefined ? Math.min(end, a.soldM) : end;
  const months = Math.max(0, to - from + 1);
  const annual = a.cost / a.life;
  return Math.max(0, Math.min(Math.round(annual * months / 12), a.cost - 1 - a.booked));
}
function ksBookValue(a) { return a.cost - a.booked; }
function ksActiveAssets() { return G.assets.filter(a => a.soldM === undefined); }
/* 月次の減価償却費の見込み（管理会計用。帳簿には決算で計上） */
function ksDepEstimate() {
  let C = 0, S = 0;
  for (const a of ksActiveAssets()) {
    if (a.acct === 'land' || !a.life) continue;
    if (a.booked >= a.cost - 1) continue;
    const v = a.cost / a.life / 12;
    if (a.part === 'C') C += v; else S += v;
  }
  return { C, S };
}
function ksBuyAsset(o, pay = 'cash') {
  const a = ksNewAsset(Object.assign({}, o, { acqM: G.m }));
  ksPost('buyAsset', [[a.acct, a.cost, 0], [pay === 'accrued' ? 'accrued' : 'cash', 0, a.cost]], { cf: 'capex', desc: `固定資産の購入（${a.n}）` });
  if (o.deposit) ksPost('deposit', [['deposit', o.deposit, 0], ['cash', 0, o.deposit]], { cf: 'capex' });
  return a;
}
function ksSellAsset(a, price) {
  const fy = fyOf(G.m);
  if (a.life && a.acct !== 'land') {
    const months = Math.max(0, G.m - Math.max(fy * 12, a.acqM));
    const dep = Math.max(0, Math.min(Math.round(a.cost / a.life * months / 12), a.cost - 1 - a.booked));
    if (dep > 0) { ksPost('cDep', [[a.part === 'C' ? 'depC' : 'depS', dep, 0], [a.acct === 'sw' ? 'sw' : 'accDep', 0, dep]], { desc: `売却する資産の期中の減価償却（${a.n}）` }); a.booked += dep; }
  }
  const bv = a.cost - a.booked;
  const gain = price - bv;
  const lines = [['cash', price, 0]];
  if (a.acct !== 'sw' && a.acct !== 'land') lines.push(['accDep', a.booked, 0]);
  lines.push([a.acct, 0, a.acct === 'sw' ? bv : a.cost]);
  if (gain > 0) lines.push(['gainSale', 0, gain]); else if (gain < 0) lines.push(['lossSale', -gain, 0]);
  ksPost('sellAsset', lines, { cf: 'capex', desc: `固定資産の売却（${a.n}）` });
  a.soldM = G.m;
  return gain;
}

/* ---------- 経済 ---------- */
function ksEcoStep() {
  const e = G.eco;
  e.mIn++;
  const r = rand();
  if (e.regime === 'normal' && e.mIn > 10) { if (r < 0.022) { e.regime = 'boom'; e.mIn = 0; } else if (r < 0.047) { e.regime = 'recession'; e.mIn = 0; } }
  else if (e.regime === 'boom' && e.mIn > 12 && r < 0.05) { e.regime = 'normal'; e.mIn = 0; }
  else if (e.regime === 'recession' && e.mIn > 9 && r < 0.06) { e.regime = 'normal'; e.mIn = 0; }
  const tgt = { boom: 1.06, normal: 1.0, recession: 0.9 }[e.regime];
  e.idx = clamp(e.idx + (tgt - e.idx) * 0.15 + randn() * 0.004, 0.8, 1.15);
  e.matIdx = clamp(e.matIdx * (1 + 0.0012 + randn() * 0.006), 0.8, 1.8);
  e.wageIdx *= 1 + 0.0012;
  e.priceIdx = (e.priceIdx || 1) * (1 + 0.0011 + randn() * 0.001);
  if (e.mIn % 6 === 5) {
    if (e.regime === 'boom' && e.prime < 3.2) e.prime = +(e.prime + 0.125).toFixed(3);
    if (e.regime === 'recession' && e.prime > 1.375) e.prime = +(e.prime - 0.125).toFixed(3);
  }
}
const ksEcoName = r => ({ boom: '好況', normal: '普通', recession: '不況' }[r]);

/* ---------- 借入 ---------- */
function ksLoanRate(bank, g, termM, o = {}) {
  const B = KS_BANKS[bank];
  const base = G.eco.prime - 1.875;
  let r = B.fixed ? 1.05 + 0.17 * g + base * 0.8 : 0.85 + GRADE_SPREAD[g] + B.spread + base;
  if (termM > 60) r += 0.2;
  if (o.coll) r -= 0.15;
  if (o.cgc) r -= 0.45;
  return +clamp(r, 0.5, 9).toFixed(2);
}
function ksLoanMonthlyPrin(L) { return L.repay === 'equal' ? Math.round(L.amt / L.termM) : 0; }
function ksAddLoan(o) {
  const L = Object.assign({ id: 'L' + (++G.seq), startM: G.m }, o);
  L.bal = L.amt;
  L.matM = L.startM + L.termM;
  L.prin = ksLoanMonthlyPrin(L);
  G.loans.push(L);
  return L;
}
function ksLoanAcct(L) { return L.termM > 12 ? 'ltd' : 'std'; }
function ksLoansMonthly() {
  let int = 0;
  for (const L of G.loans) if (L.bal > 0) int += L.bal * L.rate / 1200;
  int = Math.round(int);
  if (int > 0) ksPost('interest', [['interest', int, 0], ['cash', 0, int]], { cf: 'interest' });
  for (const L of G.loans) {
    if (L.bal <= 0 || L.kind === 'od') continue;
    if (L.repay === 'equal' && L.graceUntil !== undefined && G.m >= L.graceUntil) { L.prin = Math.round(L.bal / Math.max(1, L.matM - G.m)); delete L.graceUntil; }
    if (L.repay === 'equal' && G.m > L.startM && !(L.graceUntil > G.m)) {
      const p = Math.min(L.bal, L.prin || L.bal);
      if (p > 0) { ksPost('repay', [[ksLoanAcct(L), p, 0], ['cash', 0, p]], { cf: 'repay' }); L.bal -= p; }
    } else if (L.repay === 'bullet' && G.m >= L.matM) {
      const g = G.grade || 6;
      if (L.roll && !ksFraudActive() && g <= (KS_BANKS[L.bank].minGrade + 1)) {
        ksPost('rollover', [['std', L.bal, 0], ['cash', 0, L.bal]], { cf: 'repay' });
        ksPost('rollover', [['cash', L.bal, 0], ['std', 0, L.bal]], { cf: 'borrow' });
        L.startM = G.m; L.matM = G.m + L.termM; L.rate = ksLoanRate(L.bank, g, L.termM, { cgc: L.cgc });
        ksNews(`${KS_BANKS[L.bank].short}の短期借入金${fmtYen(L.bal)}を折り返しました（金利${fmtNum(L.rate, 2)}%）`, 'bank');
      } else {
        ksPost('repay', [['std', L.bal, 0], ['cash', 0, L.bal]], { cf: 'repay' });
        if (L.roll) ksNews(`${KS_BANKS[L.bank].short}に短期借入金の折り返しを断られ、${fmtYen(L.bal)}を一括返済しました`, 'bad');
        L.bal = 0;
      }
    }
  }
  G.loans = G.loans.filter(L => L.bal > 0 || (L.kind === 'od'));
}
function ksOD() { return G.loans.find(L => L.kind === 'od'); }
/* 当座貸越の枠を格付から決める（メインバンク） */
function ksSetODLimit() {
  const g = G.grade || 6;
  const ms = ksAnnualSales() / 12;
  const lim = ksFraudActive() ? 0 : g <= 3 ? ms * 1.2 : g <= 5 ? ms * 0.8 : g <= 6 ? ms * 0.4 : 0;
  let L = ksOD();
  const limit = Math.round(lim / 1e6) * 1e6;
  if (!L) {
    if (limit <= 0) return;
    L = ksAddLoan({ bank: 'mirai', kind: 'od', purpose: 'working', amt: 0, termM: 12, repay: 'od', rate: ksLoanRate('mirai', g, 12) });
    L.bal = 0;
  }
  L.limit = limit;
  L.rate = ksLoanRate('mirai', g, 12);
}
function ksAnnualSales() {
  const last = ksLastFY();
  return last ? last.pl.sales : ksRunRateSales() * 12;
}
function ksRunRateSales() {
  const ms = G.months.slice(-3);
  return ms.length ? sum(ms, x => x.mg.sales) / ms.length : 0;
}
/* 月の固定的な支出の目安（人件費＋家賃＋経費） */
function ksMonthlyFixedOut() {
  const ms = G.months.slice(-3);
  if (!ms.length) return ksPayrollEstimate().total * 1.4;
  return sum(ms, x => -(x.cf.payroll || 0) - (x.cf.exp || 0) - (x.cf.interest || 0)) / ms.length;
}

/* ---------- 資金ショートの手当て ---------- */
function ksPayAP() {
  const due = G.ap.filter(x => x.due <= G.m);
  const amt = Math.round(sum(due, x => x.amt));
  if (amt <= 0) return;
  const od = ksOD();
  const room = od ? Math.max(0, od.limit - od.bal) : 0;
  let defer = 0;
  if (!G.hist && ksB('cash') + room < amt && (G.supTrust ?? 3) > 0) {
    // 一部の支払いを翌月に延ばしてもらう（仕入先の信用を失う）
    defer = Math.min(Math.round(amt * 0.5), amt - Math.max(0, Math.round(ksB('cash') + room)));
    G.supTrust = (G.supTrust ?? 3) - 1;
    ksNews(`資金が足りず、仕入先に買掛金${fmtYen(defer)}の支払いを1か月待ってもらいました。仕入先の信用が下がります（残り${G.supTrust}回）`, 'bad');
  }
  G.ap = G.ap.filter(x => x.due > G.m);
  if (defer > 0) ksAddAP(defer, G.m + 1);
  const pay = amt - defer;
  if (pay > 0) ksPost('payAP', [['ap', pay, 0], ['cash', 0, pay]], { cf: 'purchPay' });
}
function ksCashCover() {
  const od = ksOD();
  const cash = ksB('cash');
  const buffer = 0;
  if (od && cash < buffer && od.limit > od.bal) {
    const draw = Math.round(Math.min(od.limit - od.bal, buffer - cash + 1e6));
    ksPost('odDraw', [['cash', draw, 0], ['std', 0, draw]], { cf: 'borrow' });
    od.bal += draw;
  } else if (od && od.bal > 0) {
    const spare = ksB('cash') - ksMonthlyFixedOut() * 1.5;
    if (spare > 0) { const r = Math.round(Math.min(od.bal, spare)); if (r > 0) { ksPost('odRepay', [['std', r, 0], ['cash', 0, r]], { cf: 'repay' }); od.bal -= r; } }
  }
  if (ksB('cash') >= 0) return true;
  // メインバンクの緊急融資（保証協会のセーフティネット保証）
  const g = G.grade || 6;
  if (G.hist || (!ksFraudActive() && g <= 8 && (G.flags.emergencyUsed === undefined || G.m - G.flags.emergencyUsed > 24))) {
    const amt = niceAmount(-ksB('cash') + ksMonthlyFixedOut() * 1.5);
    const fee = Math.round(amt * KS_CGC_FEE[Math.min(9, g)] / 100);
    ksAddLoan({ bank: 'mirai', kind: 'shosho', purpose: 'working', amt, termM: 60, repay: 'equal', rate: ksLoanRate('mirai', g, 60, { cgc: true }) + 0.4, cgc: true, emergency: true });
    ksPost('borrow', [['cash', amt, 0], ['ltd', 0, amt]], { cf: 'borrow', desc: '借入金の借入（緊急の運転資金）' });
    ksPost('guarFee', [['guarFee', fee, 0], ['cash', 0, fee]], { cf: 'interest' });
    G.flags.emergencyUsed = G.m;
    ksNews(`資金が足りなくなり、${KS_BANKS.mirai.short}から緊急の運転資金${fmtYen(amt)}を借りました（保証協会付き）。次はありません`, 'bad');
    return ksB('cash') >= 0;
  }
  return false;
}

/* ---------- ニュース ---------- */
function ksNews(t, k = 'info') {
  if (G.hist) return;
  G.news.unshift({ m: G.m, t, k });
  if (G.news.length > 160) G.news.length = 160;
}

/* ---------- 月次の処理 ---------- */
function ksMonthIndex(m) { return (calMonth(m) + 8) % 12; } // 4月=0 … 3月=11
function ksAdvance() {
  if (G.over || G.closing) return null;
  const m = G.m;
  const I = KS_INDS[G.ind];
  const before = { cash: G.monthStartCash ?? ksB('cash'), debt: ksDebt() };
  // 期首：前期末の未払費用・前払費用を元に戻す（再振替仕訳）
  if (calMonth(m) === 4 && G.reversal) {
    const rv = G.reversal;
    ksPost('reverse', [['accruedExp', rv.labor + rv.welfare, 0], ['labor', 0, rv.labor], ['welfare', 0, rv.welfare]]);
    if (rv.rent) ksPost('reverse', [['rent', rv.rent, 0], ['prepaid', 0, rv.rent]], { key: 'rent' });
    G.reversal = null;
  }
  const ctx = { si: ksMonthIndex(m), mo: calMonth(m) };
  ctx.season = I.season[ctx.si];
  const res = KS_ENGINE[G.ind].month(ctx) || {};
  ksPayroll(res.extraLabor || 0);
  if (res.afterPayroll) res.afterPayroll();
  ksCollect();
  ksLoansMonthly();
  if (calMonth(m) === 5 && ksB('taxPay') > 0) { const t = ksB('taxPay'); ksPost('taxPay', [['taxPay', t, 0], ['cash', 0, t]], { cf: 'tax' }); }
  ksEventsMonth(ctx);
  if (calMonth(m) === 4) ksBudgetApprove(true); // 4月末までに決めなければ予算案のまま決まる
  ksPayAP();
  if (!ksCashCover()) {
    G.over = { kind: 'bankrupt', m };
    ksNews('資金繰りがつかず、仕入先への支払いができなくなりました。事業を続けられません', 'bad');
  }
  // 月次の締め
  const dep = ksDepEstimate();
  const mg = ksMgmtPL(G.flow, res, dep);
  const bal = {};
  for (const k of KS_BSK) bal[k] = G.bal[k];
  G.months.push({ m, flow: G.flow, flowC: G.flowC, cf: G.cfm, bal, mg, kpi: res.kpi || {}, cash: ksB('cash') });
  if (G.months.length > 84) G.months.shift();
  G.journal.push({ m, e: Object.values(G.jcur) });
  if (G.journal.length > (G.hist ? 2 : 26)) G.journal.shift();
  G.monthRep = { m, before, res, mg };
  // 3月は決算。決算整理が終わるまで翌月に進まない
  if (calMonth(m) === 3 && !G.over) { ksStartClosing(); return G.monthRep; }
  ksNextMonth();
  return G.monthRep;
}
function ksNextMonth() {
  G.m++;
  // 新しい月の記録を始める（月の途中の借入や設備投資もこの月に記録される）
  G.flow = {}; G.flowC = {}; G.cfm = {}; G.jcur = {};
  G.monthStartCash = ksB('cash');
  ksEcoStep();
  if (KS_ENGINE[G.ind].next) KS_ENGINE[G.ind].next();
  if (calMonth(G.m) === 4) { ksBudgetDraft(); G.supTrust = Math.min(3, (G.supTrust ?? 3) + 1); }
  if (G.termYears && G.m >= KS_START_M + G.termYears * 12 && !G.termEnded) { G.termEnded = true; G.pendingModals.push({ type: 'kTerm' }); }
}
/* 管理会計の月次損益（決算整理前。減価償却費は月割の見込み） */
function ksMgmtPL(fl, res, dep) {
  const g = k => fl[k] || 0;
  const grp = gg => sum(KS_PL.filter(k => KS_ACCT[k].g === gg), k => g(k));
  const sales = g('sales');
  const cogs = grp('cogs') + (res.mgAdj || 0) + dep.C;
  const people = g('execPay') + g('salary') + g('welfare');
  const rent = g('rent');
  const sgaOther = grp('sga') - people - rent - g('depS');
  const sga = people + rent + sgaOther + dep.S;
  const noi = grp('noi'), noe = grp('noe');
  const opi = sales - cogs - sga;
  return { sales, cogs, gp: sales - cogs, people, rent, dep: dep.C + dep.S, depS: dep.S, sgaOther, sga, opi, noi, noe, ord: opi + noi - noe, ext: grp('exg') - grp('exl') };
}

/* ---------- 共通のイベント ---------- */
function ksEventsMonth(ctx) {
  if (G.hist) return;
  if (chance(0.006)) {
    const amt = niceAmount(ksAnnualSales() * uni(0.002, 0.006));
    ksPost('subsidy', [['cash', amt, 0], ['miscInc', 0, amt]], { cf: 'other' });
    ksNews(`市の省エネ設備の補助金${fmtYen(amt)}が入金されました（雑収入）`, 'good');
  }
  if (chance(0.0035)) {
    const amt = niceAmount(ksAnnualSales() * uni(0.004, 0.012));
    ksPost('disaster', [['disaster', amt, 0], ['cash', 0, amt]], { cf: 'other' });
    ksNews(`台風で建物の一部が壊れ、修理と片付けに${fmtYen(amt)}かかりました（特別損失）`, 'bad');
  }
}

/* ---------- 決算整理 ---------- */
function ksStartClosing() {
  const fy = fyOf(G.m);
  const E = KS_ENGINE[G.ind];
  const steps = [];
  if (KS_INDS[G.ind].inv === 'sanbun' || KS_INDS[G.ind].inv === 'mfg') steps.push('stock');
  if (G.ind === 'con') steps.push('con');
  steps.push('dep', 'allow', 'accrual', 'tax', 'done');
  G.closing = { fy, steps, i: 0, ans: {}, data: {}, posted: {} };
  const c = G.closing;
  // 在庫
  if (steps.includes('stock')) c.data.stock = E.stockCount();
  // 減価償却
  const rows = [];
  for (const a of G.assets) {
    if (a.acct === 'land' || a.soldM !== undefined) continue; // 売った資産は、売ったときに期中の償却を計上済み
    const d = ksDepFor(a, fy);
    if (d <= 0 && (a.soldM !== undefined || a.booked >= a.cost - 1)) continue;
    rows.push({ id: a.id, n: a.n, acct: a.acct, cost: a.cost, life: a.life, acqM: a.acqM, booked: a.booked, dep: d, part: a.part, months: Math.max(0, fy * 12 + 11 - Math.max(fy * 12, a.acqM) + 1) });
  }
  c.data.dep = rows;
  // 貸倒引当金
  const ar = ksB('ar');
  c.data.allow = { ar, rate: G.lossRate || KS_LOSS_RATE, cur: ksB('allow') };
  c.data.allow.req = Math.round(ar * c.data.allow.rate / 1000) * 1000;
  // 経過勘定
  c.data.accrual = { labor: G.wfPrev.labor, welfare: G.wfPrev.salary, rent: Math.round(G.rentMonthly || 0) };
}
/* 手順ごとの仕訳。opt: { fraudInv, skipDep }
 * dry=true のときは記帳せず、記帳する予定の仕訳 [{ code, lines }] を返す（決算整理の画面の下書き用） */
function ksPostStep(step, opt = {}, dry = false) {
  const c = G.closing;
  if (!c || (!dry && c.posted[step])) return [];
  if (!dry) c.posted[step] = true;
  const out = [];
  const C = { closing: true };
  const P = (code, lines, o) => {
    const ls = lines.map(([k, d, cr]) => [k, Math.round(d || 0), Math.round(cr || 0)]).filter(l => l[1] || l[2]);
    if (!ls.length) return;
    out.push({ code, lines: ls });
    if (!dry) ksPost(code, ls, o || C);
  };
  const I = KS_INDS[G.ind];
  if (step === 'stock') {
    const d = c.data.stock;
    if (I.inv === 'sanbun') {
      const acct = I.invAcct;
      const it = d.items[0];
      const reported = opt.fraudInv ? Math.round(it.phys * (1 + opt.fraudInv)) : it.phys;
      P('cStockBegin', [['purch', it.begin, 0], [acct, 0, it.begin]]);
      if (opt.fraudInv) {
        P('cStockEnd', [[acct, reported, 0], ['purch', 0, reported]]);
        if (!dry) G.flags.fraudInv = { fy: c.fy, amt: reported - it.phys };
      } else {
        P('cStockEnd', [[acct, it.book, 0], ['purch', 0, it.book]]);
        P('cShrink', [['shrink', it.book - it.phys, 0], [acct, 0, it.book - it.phys]]);
      }
      if (!dry) d.reported = reported;
    } else {
      const [mat, wip, prod] = d.items;
      const fr = opt.fraudInv || 0;
      const matR = fr ? Math.round(mat.phys * (1 + fr)) : mat.phys;
      const wipR = fr ? Math.round(wip.phys * (1 + fr)) : wip.phys;
      const prodR = fr ? Math.round(prod.phys * (1 + fr)) : prod.phys;
      P('cMat', [['matPurch', mat.begin, 0], ['mat', 0, mat.begin]]);
      if (fr) P('cMat', [['mat', matR, 0], ['matPurch', 0, matR]], Object.assign({ key: 'end' }, C));
      else {
        P('cMat', [['mat', mat.book, 0], ['matPurch', 0, mat.book]], Object.assign({ key: 'end' }, C));
        P('cShrink', [['shrink', mat.book - mat.phys, 0], ['mat', 0, mat.book - mat.phys]]);
      }
      P('cWip', [['invChg', wip.begin + prod.begin, 0], ['wip', 0, wip.begin], ['prod', 0, prod.begin]]);
      P('cWip', [['wip', wipR, 0], ['prod', prodR, 0], ['invChg', 0, wipR + prodR]], Object.assign({ key: 'end' }, C));
      if (fr && !dry) G.flags.fraudInv = { fy: c.fy, amt: (matR - mat.phys) + (wipR - wip.phys) + (prodR - prod.phys) };
    }
    if (!dry) KS_ENGINE[G.ind].afterCount();
  } else if (step === 'dep') {
    let C1 = 0, S1 = 0, swAmt = 0, acc = 0;
    const normal = sum(c.data.dep, r => r.dep);
    const skip = opt.skipDep ? clamp(opt.skipDep, 0, 1) : 0;
    for (const r of c.data.dep) {
      const d = Math.round(r.dep * (1 - skip));
      if (d <= 0) continue;
      if (!dry) G.assets.find(x => x.id === r.id).booked += d;
      if (r.part === 'C') C1 += d; else S1 += d;
      if (r.acct === 'sw') swAmt += d; else acc += d;
    }
    P('cDep', [['depC', C1, 0], ['depS', S1, 0], ['accDep', 0, acc], ['sw', 0, swAmt]]);
    if (!dry) {
      if (skip) G.flags.depSkipped = c.fy;
      c.data.depBooked = C1 + S1;
      c.data.depNormal = normal;
    }
  } else if (step === 'allow') {
    const a = c.data.allow;
    const diff = a.req - ksB('allow');
    if (diff > 0) P('cAllow', [['allowExp', diff, 0], ['allow', 0, diff]]);
    else if (diff < 0) P('cAllow', [['allow', -diff, 0], ['allowRev', 0, -diff]]);
  } else if (step === 'accrual') {
    const a = c.data.accrual;
    P('cAccrual', [['labor', a.labor, 0], ['welfare', a.welfare, 0], ['accruedExp', 0, a.labor + a.welfare]]);
    if (a.rent > 0) P('cPrepaid', [['prepaid', a.rent, 0], ['rent', 0, a.rent]]);
    if (!dry) G.reversal = { labor: a.labor, welfare: a.welfare, rent: a.rent };
  } else if (step === 'tax') {
    const t = ksTaxCalc();
    if (!dry) c.data.tax = t;
    P('cTax', [['taxExp', t.tax, 0], ['taxPay', 0, t.tax]]);
    if (!dry) G.lossCF = t.lossAfter;
  }
  return out;
}
/* 法人税等の計算（中小法人。実効税率：所得800万円以下25%、超える部分34%、均等割7万円） */
function ksTaxCalc() {
  let pretax = 0;
  for (const k of KS_PL) { if (k === 'taxExp') continue; pretax += KS_ACCT[k].t === 'R' ? ksB(k) : -ksB(k); }
  const loss = G.lossCF || 0;
  let taxable = pretax - loss;
  let lossAfter = 0;
  if (taxable <= 0) { lossAfter = -taxable; taxable = 0; }
  const income = Math.round(Math.min(taxable, 8e6) * 0.25 + Math.max(0, taxable - 8e6) * 0.34);
  const tax = Math.round((income + 7e4) / 100) * 100;
  return { pretax, loss, taxable, income, kintou: 7e4, tax, lossAfter };
}
/* 決算の完了：決算書を作り、損益を繰越利益剰余金に振り替え、新しい期へ */
function ksFinishClosing() {
  const c = G.closing;
  for (const s of c.steps) if (s !== 'done' && s !== 'con') ksPostStep(s);
  const fy = c.fy;
  const st = ksBuildFY(fy);
  G.fys[fy] = st;
  // 決算振替
  const lines = [];
  let net = 0;
  for (const k of KS_PL) {
    const v = ksB(k);
    if (!v) continue;
    if (KS_ACCT[k].t === 'R') { lines.push([k, v > 0 ? v : 0, v < 0 ? -v : 0]); net += v; } else { lines.push([k, v < 0 ? -v : 0, v > 0 ? v : 0]); net -= v; }
  }
  if (net > 0) lines.push(['re', 0, net]); else if (net < 0) lines.push(['re', -net, 0]);
  const saveFlowC = Object.assign({}, G.flowC);
  ksPost('cClose', lines, { closing: true });
  G.flowC = saveFlowC;
  // 3月の記録に決算整理を加える
  const last = G.months[G.months.length - 1];
  if (last && last.m === G.m) { last.flowC = G.flowC; for (const k of KS_BSK) last.bal[k] = G.bal[k]; last.cash = ksB('cash'); }
  const jl = G.journal[G.journal.length - 1];
  if (jl && jl.m === G.m) jl.e = Object.values(G.jcur);
  // 銀行の格付
  const prevG = G.grade;
  ksFraudCheck(fy);
  const gr = ksGrade();
  G.grade = gr.g;
  st.grade = gr.g; st.score = gr.score;
  G.gradeHist.push({ fy, g: gr.g });
  ksSetODLimit();
  // 貸倒実績率の更新
  const bd = sum(G.months.filter(x => fyOf(x.m) === fy), x => x.flow.badDebt || 0);
  const arAvg = Math.max(1, ksB('ar'));
  G.lossRate = clamp(lerp(G.lossRate || KS_LOSS_RATE, bd / arAvg, 0.35), 0.005, 0.05);
  c.result = { fy, gradeBefore: prevG, gradeAfter: gr.g };
  G.lastClosing = { fy, quiz: c.quiz || null, gradeBefore: prevG, gradeAfter: gr.g, steps: c.steps.length };
  G.closing = null;
  if (!G.hist) ksNews(`${ksFyLabel(fy)}の決算が確定しました。当期純利益 ${fmtYen(st.pl.ni)}、銀行の格付は${prevG ? (gr.g < prevG ? `${prevG}から${gr.g}に上がりました` : gr.g > prevG ? `${prevG}から${gr.g}に下がりました` : `${gr.g}のまま`) : gr.g}`, gr.g <= (prevG || gr.g) ? 'good' : 'bad');
  ksNextMonth();
}
/* 全部の手順を正しく処理する（過去の期・自動処理） */
function ksAutoClose() {
  if (!G.closing) return;
  ksFinishClosing();
}

/* ---------- 決算書 ---------- */
function ksFyLabel(fy) { return `第${G.firstPeriod + fy}期`; }
function ksFyYear(fy) { const { y } = ymOf(fy * 12 + 11); return `${y}年3月期`; }
function ksLastFY() { const ks = Object.keys(G.fys).map(Number).sort((a, b) => a - b); return ks.length ? G.fys[ks[ks.length - 1]] : null; }
function ksFYList() { return Object.keys(G.fys).map(Number).sort((a, b) => a - b); }
function ksBuildFY(fy) {
  const g = k => ksB(k);
  const I = KS_INDS[G.ind];
  const grp = gg => KS_PL.filter(k => KS_ACCT[k].g === gg && g(k));
  const ops = G.months.filter(x => fyOf(x.m) === fy);
  const opsSum = k => sum(ops, x => x.flow[k] || 0);
  const pl = { sales: g('sales') };
  const cogsItems = [];
  const c = G.closing;
  if (I.inv === 'sanbun') {
    const it = c.data.stock.items[0];
    const purch = opsSum('purch');
    const end = G.flags.fraudInv && G.flags.fraudInv.fy === fy ? c.data.stock.reported : it.book;
    pl.cogsDetail = { kind: 'sanbun', begin: it.begin, purch, end };
    pl.cogs = g('purch');
  } else if (I.inv === 'mfg') {
    const [mat, wip, prod] = c.data.stock.items;
    const fr = G.flags.fraudInv && G.flags.fraudInv.fy === fy;
    const matPurch = opsSum('matPurch');
    const matEnd = ksB('mat'), wipEnd = ksB('wip'), prodEnd = ksB('prod');
    const rep = {
      matBegin: mat.begin, matPurch, matEnd: fr ? matEnd : mat.book, mat: g('matPurch'),
      labor: g('labor'), subcon: g('subcon'), mfgExp: g('mfgExp'), depC: g('depC'),
      wipBegin: wip.begin, wipEnd,
    };
    rep.oh = rep.subcon + rep.mfgExp + rep.depC;
    rep.total = rep.mat + rep.labor + rep.oh;
    rep.mfgCost = rep.total + rep.wipBegin - rep.wipEnd;
    pl.mfgReport = rep;
    pl.cogsDetail = { kind: 'mfg', begin: prod.begin, mfgCost: rep.mfgCost, end: prodEnd };
    pl.cogs = sum(grp('cogs'), k => g(k));
  } else if (I.inv === 'con') {
    const done = G.op.doneFY && G.op.doneFY[fy] || { mat: 0, sub: 0, exp: 0 };
    pl.cogsDetail = { kind: 'con', conCost: g('conCost'), labor: g('labor'), exp: g('mfgExp'), parts: done };
    pl.cogs = sum(grp('cogs'), k => g(k));
  } else {
    pl.cogsDetail = { kind: 'svc', labor: g('labor'), subcon: g('subcon'), exp: g('mfgExp'), devTransfer: (G.op.devFY && G.op.devFY[fy]) || 0 };
    pl.cogs = sum(grp('cogs'), k => g(k));
  }
  for (const k of grp('cogs')) cogsItems.push([k, g(k)]);
  pl.gp = pl.sales - pl.cogs;
  pl.sgaItems = grp('sga').map(k => [k, g(k)]);
  pl.sga = sum(pl.sgaItems, x => x[1]);
  pl.opi = pl.gp - pl.sga;
  pl.noiItems = grp('noi').map(k => [k, g(k)]);
  pl.noeItems = grp('noe').map(k => [k, g(k)]);
  pl.noi = sum(pl.noiItems, x => x[1]); pl.noe = sum(pl.noeItems, x => x[1]);
  pl.ord = pl.opi + pl.noi - pl.noe;
  pl.exgItems = grp('exg').map(k => [k, g(k)]);
  pl.exlItems = grp('exl').map(k => [k, g(k)]);
  pl.exg = sum(pl.exgItems, x => x[1]); pl.exl = sum(pl.exlItems, x => x[1]);
  pl.pretax = pl.ord + pl.exg - pl.exl;
  pl.tax = g('taxExp');
  pl.ni = pl.pretax - pl.tax;
  pl.dep = g('depC') + g('depS');
  pl.cogsItems = cogsItems;
  const bs = {};
  for (const k of KS_BSK) bs[k] = g(k);
  bs.re = g('re') + pl.ni; // 振替後の繰越利益剰余金
  const tax = c.data.tax || ksTaxCalc();
  // 月次決算との差（決算整理の影響）
  const mgOrd = sum(ops, x => x.mg.ord);
  return { fy, pl, bs, tax, mgOrd, mgSales: sum(ops, x => x.mg.sales), quiz: c.quiz || null, fraudInv: !!(G.flags.fraudInv && G.flags.fraudInv.fy === fy), depSkip: G.flags.depSkipped === fy };
}
/* 銀行の財務分析の形式に直す（05_company.js の ratiosOf / scoreFin で使う） */
function ksToBankFS(st, adjust = true) {
  if (!st) return null;
  const p = st.pl, b = st.bs;
  const ppe = b.bldg + b.mach + b.veh + b.equip - b.accDep + b.land + b.sw + b.swip;
  const depC = ((p.cogsItems || []).find(x => x[0] === 'depC') || [0, 0])[1];
  const s = {
    S: p.sales, COGS: p.cogs - depC, GP: p.gp + depC, SGA: p.sga - (p.sgaItems.find(x => x[0] === 'depS') || [0, 0])[1], DEP: p.dep,
    OPI: p.opi, NONOP: p.noi, INT: p.noe, ORD: p.ord, EXTRA: p.exg - p.exl, PRETAX: p.pretax, TAX: p.tax, NI: p.ni, DIV: 0,
    CASH: b.cash, AR: b.ar - b.allow, INV: b.goods + b.mat + b.wip + b.prod + b.cwip, OCA: b.prepaid,
    PPE: ppe, LAND: b.land, INVEST: b.deposit,
    AP: b.ap, STD: b.std, OCL: b.accrued + b.accruedExp + b.taxPay + b.advRecv, LTD: b.ltd, CAP: b.capital, RE: b.re,
  };
  s.CA = s.CASH + s.AR + s.INV + s.OCA; s.FA = s.PPE + s.INVEST; s.TA = s.CA + s.FA;
  s.CL = s.AP + s.STD + s.OCL; s.TL = s.CL + s.LTD; s.EQ = s.CAP + s.RE;
  if (adjust && st.bankAdj) {
    const a = st.bankAdj;
    s.DEP += a.dep; s.OPI -= a.dep; s.ORD -= a.dep; s.PRETAX -= a.dep; s.NI -= a.dep;
    s.PPE -= a.cum; s.FA -= a.cum; s.TA -= a.cum; s.RE -= a.cum; s.EQ -= a.cum;
    s.INV -= a.inv; s.CA -= a.inv; s.TA -= a.inv; s.RE -= a.inv; s.EQ -= a.inv; s.ORD -= a.inv; s.OPI -= a.inv; s.PRETAX -= a.inv; s.NI -= a.inv;
  }
  return s;
}
/* 銀行の目に映る決算書の並び（古い順。最大4期） */
function ksBankYears(n = 4) {
  const fys = ksFYList().slice(-n);
  const out = fys.map(fy => ksToBankFS(G.fys[fy]));
  if (fys.length && fys[0] === ksFYList()[0] && G.openingFS) out.unshift(G.openingFS);
  return out.slice(-n);
}
/* 正常に償却した場合の累計額 */
function ksNormalBooked(a, endM) {
  if (a.acct === 'land' || !a.life || a.acqM > endM) return 0;
  const months = Math.min(a.soldM !== undefined ? a.soldM : endM, endM) - a.acqM + 1;
  return Math.min(a.cost - 1, Math.round(a.cost / a.life * Math.max(0, months) / 12));
}
function ksDepShortNow(endM) { return sum(ksActiveAssets(), a => Math.max(0, ksNormalBooked(a, endM) - a.booked)); }
function ksFraudActive() { return G.flags.fraudFoundM !== undefined && G.m - G.flags.fraudFoundM < 36; }
/* 粉飾・償却不足の発見（決算のたびに） */
function ksFraudCheck(fy) {
  const st = G.fys[fy];
  const endM = fy * 12 + 11;
  const short = ksDepShortNow(endM);
  const prev = G.depShort || 0;
  G.depShort = short;
  st.bankAdj = null;
  if (short > 1e4) {
    st.bankAdj = { dep: short - prev, cum: short, inv: 0 };
    st.bankNote = '減価償却費が正常な額より少なく計上されています。銀行は正常な償却額に直して評価しています（実質の利益で判断）。';
  }
  const f = G.flags.fraudInv;
  if (f && f.fy === fy && !ksFraudActive()) {
    const ys = ksBankYears(3);
    const cur = ys[ys.length - 1], prv = ys[ys.length - 2];
    let p = 0.22;
    if (cur && prv) {
      const r1 = ratiosOf(cur, prv), r0 = ratiosOf(prv, null);
      if (r1.invDays > r0.invDays * 1.15) p += 0.25;
      if (r1.gpm - r0.gpm > 1) p += 0.2;
      if (cur.NI > 0 && r1.ocfNi < 0.4) p += 0.15;
    }
    st.fraudP = p;
    if (G.forceFraudFind !== undefined ? G.forceFraudFind : chance(p)) {
      G.flags.fraudFoundM = G.m;
      st.bankAdj = Object.assign(st.bankAdj || { dep: 0, cum: 0 }, { inv: f.amt });
      st.bankNote = '銀行の実地棚卸の立会いで、在庫の水増し（粉飾）が見つかりました。銀行は修正した数字で評価しています。';
      ksNews('銀行の担当者が棚卸に立ち会い、在庫の水増しが見つかりました。銀行は新しい融資を止め、格付を最低に下げました', 'bad');
    }
  }
}
function ksGrade() {
  const ys = ksBankYears(4);
  if (!ys.length) return { g: 6, score: 50 };
  const score = scoreFin(ys);
  let g = gradeOfScore(score);
  if (ksReschedActive(24)) g = Math.max(g, 8);
  if (ksFraudActive()) g = 10;
  return { g, score };
}

/* ---------- 返済条件の変更（リスケ） ---------- */
function ksReschedActive(months = 12) { return G.flags.reschedM !== undefined && G.m - G.flags.reschedM < months; }
/* 申し出に応じてもらえるか。業績が良い会社や、2年以内に一度変更した会社は断られる */
function ksReschedCheck() {
  const loans = G.loans.filter(L => L.repay === 'equal' && L.bal > 0);
  const prin = sum(loans, L => L.prin);
  if (!loans.length) return { ok: false, why: '毎月元金を返している借入金（証書貸付）がありません。', loans, prin };
  if (ksFraudActive()) return { ok: false, why: '粉飾が判明しているため、銀行は返済条件の変更に応じません。', loans, prin };
  if (G.flags.reschedM !== undefined && G.m - G.flags.reschedM < 24) return { ok: false, why: '2年以内に一度、返済条件を変更しています。', loans, prin };
  const fc = ksForecast(3);
  const tight = fc.some(x => x.bal < ksMonthlyFixedOut() * 0.5);
  if ((G.grade || 6) <= 5 && !tight) return { ok: false, why: '業績と資金繰りに問題がないため、返済条件を変える理由がないと判断されました。', loans, prin };
  return { ok: true, loans, prin };
}
function ksReschedule() {
  const ck = ksReschedCheck();
  if (!ck.ok) return ck;
  for (const L of ck.loans) { L.graceUntil = G.m + 12; L.matM += 12; L.resched = true; }
  G.flags.reschedM = G.m;
  const od = ksOD();
  if (od) od.limit = od.bal; // 当座貸越の新しい利用も止まる
  const g0 = G.grade;
  G.grade = Math.max(G.grade || 6, 8);
  ksNews(`取引銀行に返済条件の変更（リスケ）を認めてもらいました。1年間、毎月の元金${fmtYen(ck.prin)}の返済が止まります。銀行の格付は${g0}から${G.grade}（要管理先）になりました`, 'bank');
  return ck;
}

/* ---------- 銀行への融資の申込 ---------- */
/* app: { bank, purpose: 'working'|'capex', amt, termM, cgc, coll, item } */
function ksEvalLoan(app) {
  const B = KS_BANKS[app.bank];
  const gr = ksGrade();
  const g = gr.g;
  const ys = ksBankYears(4);
  const s = ys[ys.length - 1];
  const p = ys[ys.length - 2];
  const r = s ? ratiosOf(s, p) : null;
  const out = { ok: false, g, score: gr.score, reasons: [], points: [], amt: app.amt, termM: app.termM };
  const debt = ksDebt(), cash = ksB('cash');
  // 返済の原資。決算がまだない（過去の期の最初の年）ときは今期の月次の実績から見積もる
  let cf = s ? s.ORD * 0.7 + s.DEP : 0;
  if (!s) { const y0 = ksYTD(); const dp = ksDepEstimate(); cf = y0.n ? (y0.ord / y0.n * 12) * 0.7 + (dp.C + dp.S) * 12 : 0; }
  const dsyAfter = cf > 0 ? Math.max(0, debt + app.amt - cash) / cf : Infinity;
  out.dsyAfter = dsyAfter;
  const ytd = ksYTD();
  out.points.push(['行内格付', `${g}（財務スコア ${fmtNum(gr.score, 0)}点）`, g <= 4 ? 'ok' : g <= 6 ? '' : 'bad']);
  if (r) {
    out.points.push(['自己資本比率', fmtPct(r.eqR, 1), r.eqR >= 20 ? 'ok' : r.eqR >= 0 ? '' : 'bad']);
    out.points.push(['直近期の経常利益', fmtYen(s.ORD), s.ORD > 0 ? 'ok' : 'bad']);
    out.points.push(['借入後の債務償還年数', isFinite(dsyAfter) ? `${fmtNum(dsyAfter, 1)}年` : '返済原資がマイナス', dsyAfter <= 10 ? 'ok' : dsyAfter <= 15 ? '' : 'bad']);
  }
  out.points.push(['今期の業績（月次）', `経常利益 ${fmtYen(ytd.ord)}（${ytd.n}か月）`, ytd.ord >= 0 ? 'ok' : 'bad']);
  const reject = msg => { out.reasons.push(msg); return out; };
  if (ksFraudActive()) return reject('決算書の粉飾が判明したため、新しい融資には応じられません。');
  if (ksReschedActive(12)) return reject('返済条件を変更している間（1年間）は、新しい融資には応じられません。まず経営改善計画どおりに利益を出してください。');
  if (B.longOnly && app.termM < 36) return reject(`${B.n}は3年以上の長期の資金だけを扱っています。`);
  if (app.bank === 'koko' && app.cgc) app.cgc = false;
  const limitG = app.cgc ? 8 : B.minGrade;
  if (g > limitG) {
    out.reasons.push(`格付が${g}で、${app.cgc ? '保証協会付きでも' : 'この金融機関の'}基準（${limitG}以内）に届きません。`);
    if (r) {
      if (s.EQ < 0) out.reasons.push('債務超過です。まず赤字を止め、純資産を回復させる必要があります。');
      if (s.ORD <= 0) out.reasons.push('直近期が経常赤字です。黒字に戻す計画を示す必要があります。');
      if (isFinite(r.dsy) && r.dsy > 15) out.reasons.push(`債務償還年数が${fmtNum(r.dsy, 1)}年と長く、借入が稼ぐ力に比べて多すぎます。`);
    }
    if (!app.cgc && g <= 8 && app.bank !== 'koko') out.reasons.push('信用保証協会の保証を付ければ、審査が通る可能性があります。');
    return out;
  }
  const maxDsy = app.cgc ? 25 : app.purpose === 'capex' ? 15 : 12;
  if (dsyAfter > maxDsy) {
    // 返せる範囲まで減額する
    const cap = cf > 0 ? cf * maxDsy - Math.max(0, debt - cash) : 0;
    const amt = Math.floor(cap / 1e6) * 1e6;
    if (amt < Math.max(5e6, app.amt * 0.3)) {
      out.reasons.push(isFinite(dsyAfter) ? `借入後の債務償還年数が${fmtNum(dsyAfter, 1)}年になり、返済できる見込みが立ちません（基準${maxDsy}年）。` : '返済の原資（経常利益×0.7＋減価償却費）がマイナスで、返済の見込みが立ちません。');
      if (!app.cgc && app.bank !== 'koko') out.reasons.push('信用保証協会の保証を付ければ基準が緩くなります。');
      return out;
    }
    out.amt = amt;
    out.reasons.push(`稼ぐ力から見て返せる範囲として、${fmtYen(amt)}に減額します。`);
  }
  if (app.purpose === 'working') {
    const maxW = Math.max(1e7, ksAnnualSales() / 12 * 2.5);
    if (out.amt > maxW) { out.amt = Math.floor(maxW / 1e6) * 1e6; out.reasons.push(`運転資金としては月商の2.5か月分（${fmtYen(out.amt)}）までとします。`); }
  } else if (app.item && out.amt > app.item.cost) out.amt = app.item.cost;
  if (app.cgc) {
    const cur = sum(G.loans.filter(L => L.cgc), L => L.bal);
    if (cur + out.amt > KS_CGC_LIMIT) return reject(`保証協会の保証の上限（${fmtYen(KS_CGC_LIMIT)}）を超えます。`);
  }
  out.ok = true;
  out.rate = ksLoanRate(app.bank, g, app.termM, { coll: app.coll && ksB('land') > 0, cgc: app.cgc });
  out.fee = app.cgc ? Math.round(out.amt * KS_CGC_FEE[g] / 100 * app.termM / 12 * (app.termM > 12 ? 0.55 : 1) / 1000) * 1000 : 0;
  if (!out.reasons.length) out.reasons.push(g <= 4 ? '財務内容が良好なため、希望どおりの条件でお貸しします。' : '条件付きでお引き受けします。今期も黒字を続けてください。');
  return out;
}
function ksBorrow(app, res) {
  const termM = app.termM;
  const L = ksAddLoan({ bank: app.bank, kind: termM > 12 ? 'shosho' : 'tegata', purpose: app.purpose, amt: res.amt, termM, repay: termM > 12 ? 'equal' : 'bullet', rate: res.rate, cgc: !!app.cgc, roll: termM <= 12 });
  ksPost('borrow', [['cash', res.amt, 0], [ksLoanAcct(L), 0, res.amt]], { cf: 'borrow', desc: `借入金の借入（${KS_BANKS[app.bank].short}・${termM > 12 ? '証書貸付' : '手形貸付'}）` });
  if (res.fee > 0) ksPost('guarFee', [['guarFee', res.fee, 0], ['cash', 0, res.fee]], { cf: 'interest' });
  G.banks[app.bank].rel = Math.min(100, (G.banks[app.bank].rel || 50) + 3);
  return L;
}
function ksRepayEarly(L, amt) {
  amt = Math.round(Math.min(amt, L.bal, Math.max(0, ksB('cash'))));
  if (amt <= 0) return 0;
  ksPost('repay', [[L.kind === 'od' ? 'std' : ksLoanAcct(L), amt, 0], ['cash', 0, amt]], { cf: 'repay', desc: '借入金の繰上返済' });
  L.bal -= amt;
  if (L.repay === 'equal') L.prin = Math.round(L.bal / Math.max(1, L.matM - G.m));
  if (L.kind !== 'od') G.loans = G.loans.filter(x => x.bal > 0 || x.kind === 'od');
  return amt;
}

/* ---------- 今期の累計（管理会計） ---------- */
function ksYTD() {
  const fy = fyOf(G.m);
  const ms = G.months.filter(x => fyOf(x.m) === fy);
  const o = { n: ms.length, sales: 0, gp: 0, opi: 0, ord: 0 };
  for (const x of ms) { o.sales += x.mg.sales; o.gp += x.mg.gp; o.opi += x.mg.opi; o.ord += x.mg.ord; }
  return o;
}

/* ---------- 予算 ---------- */
function ksBudgetDraft() {
  const fy = fyOf(G.m);
  if (G.budget && G.budget.fy === fy) return;
  if (G.budget) G.budgetLast = G.budget;
  const b = ksBudgetBase();
  const t = { gS: 2, gm: b.sales > 0 ? +(b.gp / b.sales * 100).toFixed(1) : 25, gPeople: 2, gOther: 0 };
  G.budget = ksMakeBudget(fy, t);
}
function ksBudgetBase() {
  const ms = G.months.slice(-12);
  const s = k => sum(ms, x => x.mg[k]);
  const f = 12 / Math.max(1, ms.length);
  return { sales: s('sales') * f, gp: s('gp') * f, people: s('people') * f, rent: s('rent') * f, other: s('sgaOther') * f, noi: s('noi') * f, noe: s('noe') * f, n: ms.length };
}
function ksMakeBudget(fy, t) {
  const b = ksBudgetBase();
  const dep = ksDepEstimate();
  const sales = b.sales * (1 + t.gS / 100);
  const gp = sales * t.gm / 100;
  const cogs = sales - gp;
  const people = b.people * (1 + t.gPeople / 100);
  const rent = (G.rentMonthly || 0) * 12;
  const other = Math.max(0, b.other * (1 + t.gOther / 100));
  const depS = dep.S * 12;
  const interest = sum(G.loans, L => L.bal * L.rate / 100) * 0.95 + b.noe * 0.05;
  const opi = gp - people - rent - other - depS;
  const nonop = b.noi - interest;
  const L = { sales, cogs, gp, people, rent, dep: depS, other, opi, nonop, ord: opi + nonop };
  for (const k in L) L[k] = Math.round(L[k]);
  const pp = ksPayParts('salary');
  return { fy, t: Object.assign({}, t), base: b, lines: L, status: 'draft', pw: { base: pp.base, bonus: pp.bonus, wfRate: pp.wfRate, exec: G.execPay } };
}
function ksBudgetSet(t) {
  if (!G.budget || G.budget.status !== 'draft') return;
  const c = { gS: clamp(+t.gS || 0, -30, 60), gm: clamp(+t.gm || 0, 3, 90), gPeople: clamp(+t.gPeople || 0, -30, 40), gOther: clamp(+t.gOther || 0, -40, 60) };
  G.budget = ksMakeBudget(G.budget.fy, c);
}
function ksBudgetApprove(auto) { if (G.budget && G.budget.status === 'draft') { G.budget.status = auto ? 'auto' : 'ok'; } }
const KS_BUD_LINES = [['sales', '売上高', 'sales', 'sum'], ['cogs', '売上原価', 'cogs', 'cost'], ['gp', '売上総利益', 'gp', 'sum'], ['people', '人件費（役員・販売・事務）', 'salary', 'cost'], ['rent', '地代家賃', 'rent', 'cost'], ['dep', '減価償却費（販管費）', 'dep', 'cost'], ['other', 'その他の販管費', 'sga', 'cost'], ['opi', '営業利益', 'opi', 'sum'], ['nonop', '営業外損益（利息など）', 'interest', ''], ['ord', '経常利益', 'ord', 'grand']];
function ksBudgetMonth(bud, k, i) {
  const I = KS_INDS[G.ind];
  const ss = I.season.reduce((a, b) => a + b, 0);
  const sh = I.season[i] / ss;
  const L = bud.lines;
  const pw = bud.pw || { base: 1, bonus: 0.15, wfRate: 0.15, exec: 0.3 };
  const pmon = j => pw.base * (1 + pw.wfRate) + pw.exec * 1.15 + (j === 2 || j === 8 ? pw.bonus : 0) + (j === 3 || j === 9 ? pw.bonus * pw.wfRate : 0);
  let ptot = 0;
  for (let j = 0; j < 12; j++) ptot += pmon(j);
  switch (k) {
    case 'sales': return L.sales * sh;
    case 'cogs': return L.cogs * sh;
    case 'gp': return L.gp * sh;
    case 'people': return L.people * pmon(i) / ptot;
    case 'rent': return L.rent / 12;
    case 'dep': return L.dep / 12;
    case 'other': return L.other / 12;
    case 'opi': return ksBudgetMonth(bud, 'gp', i) - ksBudgetMonth(bud, 'people', i) - ksBudgetMonth(bud, 'rent', i) - ksBudgetMonth(bud, 'dep', i) - ksBudgetMonth(bud, 'other', i);
    case 'nonop': return L.nonop / 12;
    case 'ord': return ksBudgetMonth(bud, 'opi', i) + ksBudgetMonth(bud, 'nonop', i);
    default: return 0;
  }
}
function ksBudgetVA(bud) {
  const ms = G.months.filter(x => fyOf(x.m) === bud.fy);
  const n = ms.length;
  const act = { sales: 0, cogs: 0, gp: 0, people: 0, rent: 0, dep: 0, other: 0, opi: 0, nonop: 0, ord: 0 };
  for (const x of ms) {
    const g = x.mg;
    act.sales += g.sales; act.cogs += g.cogs; act.gp += g.gp; act.people += g.people; act.rent += g.rent; act.dep += g.depS; act.other += g.sgaOther; act.opi += g.opi; act.nonop += g.noi - g.noe; act.ord += g.ord;
  }
  return {
    n, rows: KS_BUD_LINES.map(([k, name, tk, cls]) => {
      let cum = 0, rest = 0;
      for (let i = 0; i < 12; i++) { const v = ksBudgetMonth(bud, k, i); if (i < n) cum += v; else rest += v; }
      const cost = cls === 'cost';
      const diff = act[k] - cum;
      return { k, name, tk, cls, year: bud.lines[k], cum, a: act[k], diff, fav: cost ? diff <= 0 : diff >= 0, outlook: act[k] + rest, cost };
    }),
  };
}

/* ---------- 資金繰り表 ---------- */
const KS_CF_ROWS = [
  ['in', '収入', null], ['cashSales', '現金売上', 1], ['collect', '売掛金の回収', 1], ['other', 'その他の収入・支出', 1],
  ['out', '支出', null], ['purchPay', '仕入・外注の支払', -1], ['payroll', '人件費', -1], ['exp', '経費', -1], ['interest', '利息・保証料', -1], ['tax', '税金', -1], ['capex', '設備投資', -1],
  ['fin', '財務', null], ['borrow', '借入', 1], ['repay', '返済', -1],
];
function ksForecast(nAhead = 3) {
  const I = KS_INDS[G.ind];
  const recent = G.months.slice(-3);
  const avg = k => recent.length ? sum(recent, x => x.cf[k] || 0) / recent.length : 0;
  const salesRR = recent.length ? sum(recent, x => x.mg.sales) / recent.length : 0;
  // 掛け売りの入金の時期：[何か月後, 売上に占める割合]
  const E0 = KS_ENGINE[G.ind];
  const terms = E0.arTerms ? E0.arTerms() : [[E0.arLag || 1, E0.creditShare ?? 1]];
  const est = KS_ENGINE[G.ind].forecastHint ? KS_ENGINE[G.ind].forecastHint() : null;
  const out = [];
  let bal = ksB('cash');
  const od = ksOD();
  const pw = ksPayParts();
  for (let k = 0; k < nAhead; k++) {
    const m = G.m + k;
    const si = ksMonthIndex(m), mo = calMonth(m);
    const seasonF = I.season[si] / (sum(recent.map(x => I.season[ksMonthIndex(x.m)])) / Math.max(1, recent.length) || 1);
    const salesM = salesRR * seasonF;
    const r = {};
    r.cashSales = est && est.cashSales !== undefined ? est.cashSales * seasonF : avg('cashSales') * seasonF;
    const knownAR = sum(G.ar.filter(x => (k === 0 ? x.due <= m : x.due === m)), x => x.amt * (1 - x.fee));
    r.collect = knownAR + salesM * sum(terms.filter(([lag]) => k >= lag), ([, sh]) => sh);
    // 仕入：今月の支払は買掛金の期日どおり。来月以降は、これからの仕入（最近の平均）を払う
    r.purchPay = -(sum(G.ap.filter(x => (k === 0 ? x.due <= m : x.due === m)), x => x.amt) + (k >= 1 ? -avg('purchPay') * seasonF : 0));
    const bonus = mo === 6 || mo === 12, afterBonus = mo === 7 || mo === 1;
    const welfare = k === 0 ? G.wfPrev.labor + G.wfPrev.salary : pw.wf + G.execPay * 0.15 + (afterBonus ? pw.bonus * pw.wfRate : 0);
    r.payroll = -(pw.base + G.execPay + welfare + (bonus ? pw.bonus : 0));
    r.exp = avg('exp');
    let int = 0, rep = 0;
    for (const L of G.loans) {
      if (L.bal <= 0) continue;
      int += L.bal * L.rate / 1200;
      if (L.repay === 'equal' && !(L.graceUntil > m)) rep += Math.min(L.bal, L.prin);
      else if (L.repay === 'bullet' && L.matM === m && !L.roll) rep += L.bal;
    }
    r.interest = -int;
    r.repay = -rep;
    r.tax = mo === 5 ? -ksB('taxPay') : 0;
    r.capex = 0; r.borrow = 0; r.other = 0;
    const net = sum(Object.values(r));
    bal += net;
    out.push({ m, r, net, bal, short: bal < 0 && !(od && od.limit - od.bal > -bal) });
  }
  return out;
}

/* ---------- 開始時の残高 ---------- */
function ksOpenAsset(o) {
  const a = ksNewAsset(Object.assign({}, o));
  const months = Math.max(0, KS_HIST_START - a.acqM);
  a.booked = a.acct === 'land' || !a.life ? 0 : Math.min(a.cost - 1, Math.round(a.cost / a.life * months / 12));
  return a;
}
/* o: { cash, ar:[{amt,due,fee,cust}], ap:[{amt,due}], inv:{acct:v}, deposit, loans:[{bank,w,termM,startM,rate,...}], capital, extra:{acct:v}, eq }
 * 借入金の額は、開始時の自己資本比率が eq になるように決める（w は配分の重み） */
function ksOpening(o) {
  for (const x of o.ar || []) ksAddAR(Math.round(x.amt), x.due ?? G.m, x.fee || 0, x.cust ?? null);
  for (const x of o.ap || []) ksAddAP(Math.round(x.amt), x.due ?? G.m);
  const items = [['cash', Math.round(o.cash)], ['ar', Math.round(sum(G.ar, x => x.amt))]];
  for (const [k, v] of Object.entries(o.inv || {})) items.push([k, Math.round(v)]);
  const byAcct = {};
  let accDep = 0;
  for (const a of G.assets) {
    byAcct[a.acct] = (byAcct[a.acct] || 0) + (a.acct === 'sw' ? a.cost - a.booked : a.cost);
    if (a.acct !== 'sw' && a.acct !== 'land') accDep += a.booked;
  }
  for (const [k, v] of Object.entries(byAcct)) items.push([k, v]);
  items.push(['accDep', accDep], ['deposit', o.deposit || 0]);
  for (const [k, v] of Object.entries(o.extra || {})) items.push([k, Math.round(v)]);
  // 総資産と、借入金以外の負債
  let A = 0, NL = 0;
  for (const [k, v] of items) { const t = KS_ACCT[k].t; if (t === 'A') A += v; else if (t === 'C') A -= v; else if (t === 'L') NL += v; }
  const apSum = Math.round(sum(G.ap, x => x.amt));
  NL += apSum;
  const debtTotal = Math.max(0, A - NL - A * (o.eq ?? 0.3));
  const wsum = sum(o.loans || [], l => l.w || 1);
  let std = 0, ltd = 0;
  for (const l of o.loans || []) {
    const bal = debtTotal * (l.w || 1) / wsum;
    const repay = l.repay || (l.termM > 12 ? 'equal' : 'bullet');
    const elapsed = Math.max(0, G.m - l.startM);
    const amt = repay === 'equal' ? bal / Math.max(0.1, 1 - elapsed / l.termM) : bal;
    const L = ksAddLoan(Object.assign({ kind: l.termM > 12 ? 'shosho' : 'tegata', repay, purpose: 'capex' }, l, { amt: Math.round(amt / 1e5) * 1e5 }));
    if (L.repay === 'equal') L.bal = Math.max(0, L.amt - L.prin * elapsed);
    if (L.bal <= 0) { G.loans = G.loans.filter(x => x !== L); continue; }
    if (L.termM > 12) ltd += L.bal; else std += L.bal;
  }
  items.push(['ap', apSum], ['std', std], ['ltd', ltd]);
  return { items, capital: o.capital };
}
/* 資金が細ったら運転資金を借りる（過去の期の自動経営・ボット用） */
function ksAutoFinance() {
  if (G.months.length < 3) return null; // 実績が少ないうちは見通しが立たない
  const fc = ksForecast(3);
  const low = Math.min(...fc.map(x => x.bal));
  const need = ksMonthlyFixedOut() * 0.8;
  if (low >= need) return null;
  const amt = Math.max(1e7, niceAmount(need - low + ksMonthlyFixedOut() * 2));
  for (const [bank, cgc] of [['mirai', false], ['shinkin', false], ['mirai', true], ['shinkin', true]]) {
    const app = { bank, purpose: 'working', amt, termM: 60, cgc };
    const r = ksEvalLoan(app);
    if (r.ok) { ksBorrow(app, r); return r; }
  }
  if (G.hist) {
    // 過去の期：長年の取引のある信用金庫が、高い金利で支えてきた
    const app = { bank: 'shinkin', purpose: 'working', amt, termM: 60, cgc: true };
    const g = Math.min(10, G.grade || 6);
    const r = { ok: true, amt, rate: ksLoanRate('shinkin', g, 60) + 0.8, fee: Math.round(amt * KS_CGC_FEE[Math.min(9, g)] / 100 * 5 * 0.55 / 1000) * 1000 };
    ksBorrow(app, r);
    return r;
  }
  return null;
}

/* ---------- 新しいゲーム ---------- */
function ksNewGame(o) {
  const seed = (o.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0;
  const I = KS_INDS[o.ind];
  G = {
    mode: 'kaisha', version: KS_SAVE_VERSION, rs: seed, seed, ind: o.ind, cond: o.cond || 'normal',
    coName: o.coName, ceo: o.ceo || '汐見 太郎', m: KS_HIST_START, seq: 0, hist: true,
    bal: Object.fromEntries(KS_KEYS.map(k => [k, 0])), flow: {}, flowC: {}, cfm: {}, jcur: {}, journal: [], months: [],
    fys: {}, ar: [], ap: [], assets: [], loans: [], staff: {}, op: {},
    eco: { regime: 'normal', idx: 1, prime: 1.875, matIdx: 1, wageIdx: 0.94, priceIdx: 0.95, mIn: 6 },
    grade: null, gradeHist: [], banks: { mirai: { rel: 60 }, shinkin: { rel: 50 }, koko: { rel: 40 } }, repT: (KS_COND[o.cond || 'normal'] || KS_COND.normal).rep,
    budget: null, closing: null, lossCF: 0, wfPrev: { labor: 0, salary: 0 }, reversal: null, execPay: I.exec,
    news: [], pendingModals: [], over: null, termYears: o.term ?? KS_TERM_YEARS, quiz: { asked: 0, correct: 0 },
    flags: {}, depShort: 0, lossRate: KS_LOSS_RATE, firstPeriod: 0, founded: 0, supTrust: 3, wageLv: 1, bonusLv: 1,
  };
  G.firstPeriod = randInt(22, 48);               // 2026年度（fy=0）が第何期か
  G.founded = START_YEAR - G.firstPeriod + 1;     // 創業の年
  const cond = KS_COND[G.cond];
  const open = KS_ENGINE[o.ind].init(cond);
  // 開始仕訳（4期前の期首の貸借対照表）
  const lines = [];
  let assets = 0, credits = 0;
  for (const [k, v] of open.items) {
    if (!v) continue;
    const t = KS_ACCT[k].t;
    if (t === 'A') { lines.push([k, v, 0]); assets += v; } else if (t === 'C') { lines.push([k, 0, v]); assets -= v; } else { lines.push([k, 0, v]); credits += v; }
  }
  const re = assets - credits - open.capital;
  G.openRE = re;
  lines.push(['capital', 0, open.capital]);
  if (re >= 0) lines.push(['re', 0, re]); else lines.push(['re', -re, 0]);
  ksPost('open', lines);
  G.wfPrev = ksWelfareGuess();
  // 前期末（開始時点）の貸借対照表を銀行形式で残す（キャッシュ・フローの比較用）
  G.openingFS = ksOpeningFS();
  G.grade = 6;
  ksSetODLimit();
  // 過去4期を自動で経営する
  while (G.m < KS_START_M && !G.over) {
    KS_ENGINE[G.ind].auto();
    ksAutoFinance();
    ksAdvance();
    if (G.closing) ksAutoClose();
    if (G.m === KS_HIST_START + 3) ksSetODLimit();
  }
  // 過去の期で資金が尽きた場合や、会社の状態（好調・普通・不振）と合わない場合は、別の展開で作り直す
  if ((G.over || !ksCondOk(G.cond)) && (o.retry || 0) < 8) return ksNewGame(Object.assign({}, o, { seed: (seed + 7919) | 0, retry: (o.retry || 0) + 1 }));
  G.hist = false;
  delete G.flags.emergencyUsed; // 緊急の運転資金は、新しい社長のもとで一度だけ使える
  G.news = [];
  G.pendingModals = [];
  G.quiz = { asked: 0, correct: 0 };
  ksBudgetDraft();
  ksBudgetApprove(true);
  G.startedM = G.m;
  ksNews(`${G.ceo}氏が${G.coName}の代表取締役社長に就任。${KS_INDS[G.ind].label}を営む${G.founded}年創業の会社`, 'info');
  return G;
}
/* 就任時の会社が、選んだ状態に合っているか */
function ksCondOk(cond) {
  const ys = ksBankYears(2);
  const s = ys[ys.length - 1];
  if (!s || !s.TA) return true;
  const eq = s.EQ / s.TA * 100, g = G.grade || 6, om = s.ORD / Math.max(1, s.S) * 100;
  if (cond === 'good') return g <= 4 && eq >= 30 && om > 0;
  if (cond === 'bad') return g >= 5 && g <= 8 && eq >= 0 && eq <= 30;
  return g <= 6 && eq >= 15 && om > -1;
}
function ksWelfareGuess() {
  const I = KS_INDS[G.ind];
  const o = { labor: 0, salary: 0 };
  for (const r of I.roles) o[r.cost] += (G.staff[r.id] || 0) * ksRoleWage(r) * r.wf;
  o.salary += G.execPay * 0.15;
  o.labor = Math.round(o.labor); o.salary = Math.round(o.salary);
  return o;
}
function ksOpeningFS() {
  const b = {};
  for (const k of KS_BSK) b[k] = ksB(k);
  const st = { pl: { sales: 0, cogs: 0, gp: 0, sga: 0, sgaItems: [], dep: 0, opi: 0, noi: 0, noe: 0, ord: 0, exg: 0, exl: 0, pretax: 0, tax: 0, ni: 0 }, bs: b };
  const s = ksToBankFS(st, false);
  return s;
}
/* 整合性のチェック（開発用） */
function ksCheck() {
  const e = [];
  const d = ksBalanceDiff();
  if (Math.abs(d) > 2) e.push('貸借不一致 ' + d);
  for (const k of ['cash', 'ar', 'goods', 'mat', 'wip', 'prod', 'cwip', 'ap', 'std', 'ltd']) if (ksB(k) < -1 && k !== 'cash') e.push(`${k} がマイナス ${ksB(k)}`);
  const arL = Math.round(sum(G.ar, x => x.amt));
  if (Math.abs(arL - ksB('ar')) > 10) e.push(`売掛金の明細 ${arL} ≠ 元帳 ${ksB('ar')}`);
  const apL = Math.round(sum(G.ap, x => x.amt));
  if (Math.abs(apL - ksB('ap')) > 10) e.push(`買掛金の明細 ${apL} ≠ 元帳 ${ksB('ap')}`);
  const loanL = Math.round(sum(G.loans, L => L.bal));
  if (Math.abs(loanL - ksDebt()) > 10) e.push(`借入金の明細 ${loanL} ≠ 元帳 ${ksDebt()}`);
  for (const k of ['bldg', 'mach', 'veh', 'equip']) {
    const v = sum(ksActiveAssets().filter(a => a.acct === k), a => a.cost);
    if (Math.abs(v - ksB(k)) > 10) e.push(`${k} の台帳 ${v} ≠ 元帳 ${ksB(k)}`);
  }
  const acc = sum(ksActiveAssets().filter(a => a.acct !== 'sw' && a.acct !== 'land'), a => a.booked);
  if (Math.abs(acc - ksB('accDep')) > 10) e.push(`償却累計額の台帳 ${acc} ≠ 元帳 ${ksB('accDep')}`);
  const swv = sum(ksActiveAssets().filter(a => a.acct === 'sw'), a => a.cost - a.booked);
  if (Math.abs(swv - ksB('sw')) > 10) e.push(`ソフトウェアの台帳 ${swv} ≠ 元帳 ${ksB('sw')}`);
  return e;
}
