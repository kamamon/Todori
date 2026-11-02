'use strict';
/* =========================================================
 *  05_company.js : 企業・個人の生成、決算書（実態／提出）、
 *                  粉飾モデル、財務分析、スコアリング
 *  決算書は千円単位で丸め、貸借が必ず一致するよう生成する。
 * ========================================================= */

const K = x => Math.round(x / 1000) * 1000;

const FRAUD_TYPES = {
  fakeSales:    { name: '架空売上の計上', short: '架空売上' },
  inventory:    { name: '在庫の水増し', short: '在庫水増し' },
  expenseCap:   { name: '費用の資産計上（仮払金等）', short: '費用の資産計上' },
  depreciation: { name: '減価償却費の計上不足', short: '償却不足' },
  hiddenDebt:   { name: '簿外債務（借入金の隠蔽）', short: '簿外債務' },
};

function pickFraudType(indId) {
  const b2b = ['whl', 'it', 'con', 'mfg', 'trn'].includes(indId);
  const invH = ['mfg', 'whl', 'ret', 'agr', 're'].includes(indId);
  const ppeH = ['mfg', 'trn', 'htl', 'med', 're', 'agr'].includes(indId);
  return wpick(['fakeSales', 'inventory', 'expenseCap', 'depreciation', 'hiddenDebt'],
    [b2b ? 3 : 0.4, invH ? 3 : 0.3, 1.5, ppeH ? 2.5 : 0.5, 1.8]);
}
function fraudSeverity(type) {
  switch (type) {
    case 'fakeSales': return uni(0.025, 0.06);
    case 'inventory': return uni(0.02, 0.045);
    case 'expenseCap': return uni(0.012, 0.035);
    case 'depreciation': return uni(0.5, 0.95);
    default: return uni(0.02, 0.05);
  }
}

/* 小計・合計の再計算 */
function finalize(s) {
  s.GP = s.S - s.COGS;
  s.OPI = s.GP - s.SGA - s.DEP;
  s.ORD = s.OPI + s.NONOP - s.INT;
  s.PRETAX = s.ORD + s.EXTRA;
  s.NI = s.PRETAX - s.TAX;
  s.CA = s.CASH + s.AR + s.INV + s.OCA;
  s.FA = s.PPE + s.INVEST;
  s.TA = s.CA + s.FA;
  s.CL = s.AP + s.STD + s.OCL;
  s.TL = s.CL + s.LTD;
  s.EQ = s.CAP + s.RE;
  return s;
}

function capitalFor(S) {
  if (S < 3e8) return pick([3e6, 10e6, 10e6]);
  if (S < 10e8) return pick([10e6, 20e6, 30e6]);
  if (S < 50e8) return pick([30e6, 50e6]);
  return pick([50e6, 100e6]);
}

/* 期首（表示しない基準年度）の貸借対照表 */
function genOpening(co) {
  const ind = IND[co.ind];
  const S = co.S0;
  const s = { S: K(S), COGS: K(S * (1 - ind.gm)), SGA: K(S * (ind.gm - ind.opm)), DEP: 0, NONOP: 0, INT: 0, EXTRA: 0, TAX: 0, DIV: 0, CAPEX: 0 };
  s.AR = K(S * co.arBase / 365);
  s.INV = K(s.COGS * co.invBase / 365);
  s.OCA = K(S * co.ocaR);
  s.PPE = K(S * ind.ppe * Math.exp(randn() * 0.25));
  s.LAND = co.ownsRE ? K(s.PPE * uni(0.3, 0.6)) : 0;
  s.INVEST = K(S * uni(0.01, 0.05));
  s.AP = K(s.COGS * co.apBase / 365);
  s.OCL = K(S * 0.025);
  const cashT = S / 12 * clamp(1.2 + 0.5 * co.q, 0.3, 3);
  const nonCash = s.AR + s.INV + s.OCA + s.PPE + s.INVEST;
  const TA = nonCash + cashT;
  const eqR = clamp(0.22 + 0.13 * co.q + randn() * 0.06, -0.25, 0.65);
  const EQ = TA * eqR;
  const debt = Math.max(0, TA - EQ - s.AP - s.OCL);
  s.LTD = K(debt * 0.65);
  s.STD = K(debt * 0.35);
  s.CAP = capitalFor(S);
  s.RE = K(EQ - s.CAP);
  s.CASH = s.AP + s.OCL + s.STD + s.LTD + s.CAP + s.RE - nonCash;
  const minCash = K(cashT * 0.3);
  if (s.CASH < minCash) { const add = minCash - s.CASH; s.STD += add; s.CASH += add; }
  return finalize(s);
}

/* 1年分の実態決算を生成。P=前期（実態） */
function genYear(co, P, ctx) {
  const ind = IND[co.ind];
  const q = ctx.q;
  const T = {};
  const g = ind.trend + 0.012 * ind.beta * (ctx.gdp - 1) + 0.025 * q + 0.05 * ctx.cond
    + 0.03 * (ctx.vit - 100) / 30 + randn() * 0.065 + (ctx.gBoost || 0);
  T.S = K(Math.max(P.S * 0.45, P.S * (1 + g)));
  const gm = clamp(ind.gm + 0.012 * q + 0.012 * ctx.cond + randn() * 0.007, 0.03, 0.92);
  const opm = ind.opm + 0.017 * q + 0.016 * ctx.cond + 0.1 * (g - ind.trend) + randn() * 0.009;
  T.COGS = K(T.S * (1 - gm));
  T.DEP = K(Math.max(0, P.PPE - P.LAND) * ind.dep);
  T.SGA = K(Math.max(T.S * 0.02, T.S * (gm - opm) - T.DEP));
  T.NONOP = K(T.S * 0.003 + Math.max(0, P.CASH) * 0.001);
  const rf = (0.9 + 0.45 * Math.max(0, -q) + 0.8 * ctx.policy) / 100;
  T.INT = K((P.STD + P.LTD) * rf);
  T.EXTRA = chance(0.12) ? K(T.S * uni(0.004, 0.025) * (chance(0.7) ? -1 : 1)) : 0;
  let hidden = null;
  const f = co.fraud;
  if (f && f.type === 'hiddenDebt' && ctx.fraudActive) {
    hidden = { hInt: K(f.H * 0.07), loss: K(T.S * f.sev * (1 + 0.3 * (ctx.fy - 1))) };
    T.INT += hidden.hInt;
    T.EXTRA -= hidden.loss;
  }
  const pre = T.S - T.COGS - T.SGA - T.DEP + T.NONOP - T.INT + T.EXTRA;
  T.TAX = pre > 0 ? K(pre * 0.3) : 70000;
  const ni = pre - T.TAX;
  T.DIV = ni > 0 ? K(ni * uni(0, 0.12)) : 0;
  T.AR = K(T.S * co.arBase * Math.exp(randn() * 0.06) / 365);
  T.INV = K(T.COGS * co.invBase * Math.exp(randn() * 0.07) / 365);
  T.OCA = K(T.S * co.ocaR * Math.exp(randn() * 0.12));
  T.AP = K(T.COGS * co.apBase * Math.exp(randn() * 0.06) / 365);
  T.OCL = K(T.S * 0.022 + T.TAX * 0.5);
  const big = chance(ctx.bigCapexP ?? 0.12) ? T.S * uni(0.05, 0.25) : 0;
  T.CAPEX = K(T.DEP * uni(0.6, 1.25) + Math.max(0, T.S - P.S) * ind.ppe * 0.5 + big + (ctx.plannedCapex || 0));
  T.PPE = P.PPE + T.CAPEX - T.DEP;
  T.LAND = P.LAND;
  T.INVEST = K(P.INVEST * (1 + randn() * 0.03));
  T.CAP = P.CAP;
  T.RE = P.RE + ni - T.DIV;
  T.LTD = K(P.LTD * (1 - 1 / 7) + big * 0.7 + (ctx.newLTD || 0));
  const cashT = T.S / 12 * clamp(1.2 + 0.5 * q, 0.3, 3);
  const preCash = T.AP + T.OCL + T.LTD + T.CAP + T.RE + P.STD - (T.AR + T.INV + T.OCA + T.PPE + T.INVEST);
  T.STD = K(Math.max(0, P.STD + cashT - preCash));
  T.CASH = preCash + (T.STD - P.STD);
  finalize(T);
  return { T, hidden };
}

/* 粉飾後の「提出決算書」を作る（粉飾なしなら null） */
function makeReported(co, T, ctx, hidden) {
  const f = co.fraud;
  if (!f || !ctx.fraudActive) return null;
  const R = Object.assign({}, T);
  const grow = 1 + 0.6 * (ctx.fy - 1);
  switch (f.type) {
    case 'fakeSales': { const F = K(T.S * f.sev * grow); f.cum += F; R.S = T.S + F; R.AR = T.AR + f.cum; break; }
    case 'inventory': { const F = K(Math.min(T.COGS * 0.5, T.S * f.sev * grow)); f.cum += F; R.COGS = T.COGS - F; R.INV = T.INV + f.cum; break; }
    case 'expenseCap': { const F = K(Math.min(T.SGA * 0.6, T.S * f.sev * grow)); f.cum += F; R.SGA = T.SGA - F; R.OCA = T.OCA + f.cum; break; }
    case 'depreciation': { const F = K(T.DEP * clamp(f.sev, 0, 1)); f.cum += F; R.DEP = T.DEP - F; R.PPE = T.PPE + f.cum; break; }
    case 'hiddenDebt': {
      f.H += hidden.loss + hidden.hInt;
      R.INT = T.INT - hidden.hInt;
      R.EXTRA = T.EXTRA + hidden.loss;
      let h = f.H;
      const s1 = Math.min(h, T.STD); R.STD = T.STD - s1; h -= s1;
      const s2 = Math.min(h, T.LTD); R.LTD = T.LTD - s2; h -= s2;
      f.hiddenNow = f.H - h;
      break;
    }
  }
  R.RE = T.RE + (f.type === 'hiddenDebt' ? f.hiddenNow : f.cum);
  return finalize(R);
}

function newCompanyName(indId) {
  const pre = pick(CO_PREFIX), core = pick(CO_CORE[indId]);
  const r = rand();
  if (core === '組') return `株式会社${pre}組`;
  if (core === '旅館' && r < 0.5) return `有限会社${pre}旅館`;
  if (r < 0.48) return `株式会社${pre}${core}`;
  if (r < 0.93) return `${pre}${core}株式会社`;
  return `有限会社${pre}${core}`;
}
const personName = () => pick(FAMILY_NAMES) + ' ' + pick(GIVEN_NAMES);

/* 最新の決算期末（現在月より2か月以上前） */
function lastFiscalEnd(fyEnd, m) {
  let e = m - 2;
  while (calMonth(e) !== fyEnd) e--;
  return e;
}

function genCompany(opts) {
  const did = opts.district;
  const D = DIST[did];
  const indId = opts.ind || wpick(Object.keys(D.mix), Object.values(D.mix));
  const ind = IND[indId];
  let q = clamp(randn() * 0.9 + (opts.qBias || 0), -3, 3);
  const df = DIFFICULTY[G.difficulty];
  const fp = df.fraud * (q < -0.7 ? 2.2 : q < 0 ? 1.2 : 0.35) * (opts.fraudMul ?? 1);
  let fraud = null;
  if (chance(fp)) {
    const type = pickFraudType(indId);
    fraud = { type, sev: fraudSeverity(type), start: chance(0.6) ? 2 : 3, cum: 0, H: 0, hiddenNow: 0, years: 0, found: false, exposed: false };
    q -= 0.35;
  }
  const drift = fraud ? -0.12 : randn() * 0.06;
  const co = {
    id: 'c' + (++G.seq.co), name: newCompanyName(indId), rep: personName(), ind: indId, district: did,
    founded: ymOf(G.m).y - randInt(3, 62), fyEnd: wpick([3, 6, 9, 12, 5, 8, 11, 2], [40, 8, 10, 14, 6, 6, 6, 6]),
    q, qStmt: q, mq: clamp(0.5 * q + randn() * 0.85, -2.5, 2.5), drift,
    arBase: ind.ar * Math.exp(randn() * 0.15), invBase: ind.inv * Math.exp(randn() * 0.18), apBase: ind.ap * Math.exp(randn() * 0.15),
    ocaR: uni(0.008, 0.025), ownsRE: chance(ind.re), fraud, years: [], decoy: null, mon: {}, pendingLoan: 0, pendingCapex: 0,
  };
  co.S0 = clamp(ind.size * Math.exp(randn() * 0.75) * (opts.sizeMul || 1), 0.4e8, 300e8);
  // 正直な企業にも紛らわしい変化を混ぜる（調査すれば説明がつく）
  if (!fraud && chance(0.14)) {
    co.decoy = chance(0.6)
      ? { type: 'ar', year: randInt(2, 3), mult: uni(1.25, 1.45), reason: pick(['大口取引先の支払条件が手形から60日サイトに変更されたため', '年度末に大型案件の検収が集中したため', '新規の大口取引先が月末締め翌々月払いのため']) }
      : { type: 'inv', year: randInt(2, 3), mult: uni(1.25, 1.5), reason: pick(['新製品の投入に向けて戦略的に在庫を積み増したため', '原材料の値上げ前に先行して仕入れたため', '大口受注の納品待ちの完成品在庫のため']) };
  }
  const lastEnd = lastFiscalEnd(co.fyEnd, G.m);
  const T0 = genOpening(co);
  co.years.push({ endM: lastEnd - 36, T: T0 });
  let qh = q - drift * 3 + randn() * 0.15;
  let Tp = T0;
  for (let i = 1; i <= 3; i++) {
    qh += drift + randn() * 0.1;
    const fraudActive = !!fraud && i >= fraud.start;
    if (fraudActive) fraud.years++;
    if (co.decoy && i === co.decoy.year) {
      if (co.decoy.type === 'ar') co.arBase *= co.decoy.mult; else co.invBase *= co.decoy.mult;
    }
    const ctx = {
      q: qh, gdp: G.eco.gdp + randn() * 0.8, cond: indCond(indId) * 0.5 + randn() * 0.2, vit: G.city.d[did].vit,
      policy: G.eco.policy, fraudActive, fy: fraud ? fraud.years : 0,
    };
    const { T, hidden } = genYear(co, Tp, ctx);
    const R = makeReported(co, T, ctx, hidden);
    co.years.push(R ? { endM: lastEnd - 36 + 12 * i, T, R } : { endM: lastEnd - 36 + 12 * i, T });
    Tp = T;
  }
  co.q = qh; co.qStmt = qh;
  const last = co.years[co.years.length - 1];
  co.emp = Math.max(3, Math.round(last.T.S / ind.spe * uni(0.8, 1.2)));
  if (co.ownsRE) {
    co.reTrue = (last.T.LAND * uni(1.0, 1.6) + (last.T.PPE - last.T.LAND) * 0.3) * (G.city.d[did].land / 100);
    co.reLand0 = G.city.d[did].land;
    co.reEst = co.reTrue * uni(0.78, 1.3);
    co.reLien = chance(0.3); // 他行の先順位抵当
  }
  refreshGrades(co);
  return co;
}

/* 決算書アクセサ */
const repOf = y => y.R || y.T;
function latestRep(co) { return repOf(co.years[co.years.length - 1]); }
function latestTrue(co) { return co.years[co.years.length - 1].T; }

/* 翌年度の決算を生成（融資先の期中管理用） */
function advanceCompanyYear(co) {
  const last = co.years[co.years.length - 1];
  const f = co.fraud;
  const fraudActive = !!f && !f.exposed;
  if (fraudActive) f.years++;
  const ctx = {
    q: co.q, gdp: G.eco.gdp, cond: indCond(co.ind), vit: G.city.d[co.district].vit, policy: G.eco.policy,
    fraudActive, fy: f ? f.years : 0, newLTD: co.pendingLoan * 0.9, plannedCapex: co.pendingCapex,
  };
  co.pendingLoan = 0; co.pendingCapex = 0;
  const { T, hidden } = genYear(co, last.T, ctx);
  const R = makeReported(co, T, ctx, hidden);
  co.years.push(R ? { endM: last.endM + 12, T, R } : { endM: last.endM + 12, T });
  while (co.years.length > 7) co.years.shift();
  co.qStmt = co.q;
  co.mon = {};
  refreshGrades(co);
}

/* ---------- 財務分析 ---------- */
function cfOf(s, p) {
  if (!p) return null;
  const ocf = s.NI + s.DEP - (s.AR - p.AR) - (s.INV - p.INV) - (s.OCA - p.OCA) + (s.AP - p.AP) + (s.OCL - p.OCL);
  const capex = s.PPE - p.PPE + s.DEP;
  const icf = -capex - (s.INVEST - p.INVEST);
  const fcf = (s.STD - p.STD) + (s.LTD - p.LTD) - s.DIV;
  return { ocf, icf, fcf, capex, dSTD: s.STD - p.STD, dLTD: s.LTD - p.LTD, dCash: s.CASH - p.CASH, begin: p.CASH, end: s.CASH,
    dAR: -(s.AR - p.AR), dINV: -(s.INV - p.INV), dAP: s.AP - p.AP, dOther: -(s.OCA - p.OCA) + (s.OCL - p.OCL), dInvest: -(s.INVEST - p.INVEST) };
}

function ratiosOf(s, p) {
  const debt = s.STD + s.LTD;
  const cf = cfOf(s, p);
  const cfSimple = s.ORD * 0.7 + s.DEP;
  const netDebt = debt - s.CASH;
  const r = {
    eqR: s.EQ / s.TA * 100,
    cr: s.CA / Math.max(1, s.CL) * 100,
    qr: (s.CASH + s.AR) / Math.max(1, s.CL) * 100,
    fixLong: s.FA / Math.max(1, s.EQ + s.LTD) * 100,
    debtMonths: debt / (s.S / 12),
    gpm: s.GP / s.S * 100,
    opm: s.OPI / s.S * 100,
    ordm: s.ORD / s.S * 100,
    roa: s.ORD / s.TA * 100,
    arDays: s.AR / s.S * 365,
    invDays: s.INV / Math.max(1, s.COGS) * 365,
    apDays: s.AP / Math.max(1, s.COGS) * 365,
    turn: s.S / s.TA,
    dsy: netDebt <= 0 ? 0 : (cfSimple > 0 ? netDebt / cfSimple : Infinity),
    icr: s.INT > 0 ? (s.OPI + s.NONOP * 0.5) / s.INT : Infinity,
    taxRate: s.PRETAX > 0 ? s.TAX / s.PRETAX * 100 : NaN,
    ocaS: s.OCA / s.S * 100,
  };
  if (p) {
    r.salesG = (s.S / p.S - 1) * 100;
    r.arG = (s.AR / Math.max(1, p.AR) - 1) * 100;
    r.depRate = s.DEP / Math.max(1, p.PPE - p.LAND) * 100;
    r.impliedInt = s.INT / Math.max(1, (debt + p.STD + p.LTD) / 2) * 100;
    r.ocf = cf.ocf;
    r.ocfNi = s.NI > 0 ? cf.ocf / s.NI : NaN;
  }
  return r;
}

/* 業界平均（参考値） */
function industryAvg(indId) {
  const i = IND[indId];
  return {
    eqR: 28, cr: 150, gpm: i.gm * 100, opm: i.opm * 100, ordm: i.opm * 100 * 0.95,
    arDays: i.ar, invDays: i.inv, apDays: i.ap, depRate: i.dep * 100, taxRate: 30,
  };
}

/* 財務スコア（0〜100）。years = 古い順の決算（最大4、先頭は前期比較用） */
function scoreFin(years) {
  const L = years[years.length - 1];
  const shown = years.slice(-3);
  const r = ratiosOf(L, years.length > 1 ? years[years.length - 2] : null);
  let s = 0;
  s += interp(r.eqR / 100, [[-0.2, 0], [0, 5], [0.1, 11], [0.2, 16], [0.3, 20], [0.45, 25]]);
  s += interp(r.ordm / 100, [[-0.05, 0], [0, 6], [0.02, 11], [0.05, 16], [0.1, 20]]);
  if (r.dsy === 0) s += 20;
  else if (isFinite(r.dsy)) s += interp(r.dsy, [[0, 20], [3, 17], [7, 12], [10, 8], [15, 5], [25, 1], [40, 0]]);
  s += isFinite(r.icr) ? interp(r.icr, [[0, 0], [1, 2], [3, 5], [10, 8], [20, 10]]) : 10;
  s += interp(r.cr / 100, [[0.6, 0], [0.8, 2], [1.0, 4], [1.2, 6], [1.5, 8], [2, 10]]);
  const g = shown.length >= 2 ? shown[shown.length - 1].S / shown[0].S - 1 : 0;
  s += interp(g, [[-0.15, 0], [0, 2.5], [0.15, 5]]);
  const py = shown.filter(y => y.ORD > 0).length;
  s += [0, 3, 6, 10][py] ?? 10;
  return clamp(s, 0, 100);
}
function gradeOfScore(sc) {
  for (let i = 0; i < GRADE_THRESH.length; i++) if (sc >= GRADE_THRESH[i]) return i + 1;
  return 10;
}

/* 格付の更新（実態・提出の両方） */
function refreshGrades(co) {
  const yr = co.years.slice(-4);
  co.scoreRep = scoreFin(yr.map(repOf));
  co.scoreTrue = scoreFin(yr.map(y => y.T));
  co.gRep = gradeOfScore(co.scoreRep);
  co.gTrue = gradeOfScore(co.scoreTrue);
}
/* 銀行から見える格付（粉飾を見抜いていれば実態ベース） */
function bankGrade(co) { return co.fraud && co.fraud.found ? co.gTrue : co.gRep; }
function bankScore(co) { return co.fraud && co.fraud.found ? co.scoreTrue : co.scoreRep; }

/* 粉飾チェック（審査システムLv2以上で表示） */
function fraudFlags(co) {
  const ys = co.years.slice(-4).map(repOf);
  const flags = [];
  if (ys.length < 3) return flags;
  const n = ys.length;
  const cur = ratiosOf(ys[n - 1], ys[n - 2]);
  const prv = ratiosOf(ys[n - 2], ys[n - 3]);
  const avg = industryAvg(co.ind);
  if (cur.arDays > prv.arDays * 1.18 && cur.arDays > avg.arDays * 1.15) flags.push({ k: 'ar', t: `売上債権回転日数が${fmtNum(prv.arDays, 0)}日→${fmtNum(cur.arDays, 0)}日に急増` });
  if (cur.arG - cur.salesG > 20 && cur.salesG > -5) flags.push({ k: 'arg', t: `売上の伸び（${fmtPct(cur.salesG, 1)}）を大きく上回る売上債権の増加（${fmtPct(cur.arG, 1)}）` });
  if (cur.invDays > prv.invDays * 1.2 && cur.invDays > avg.invDays * 1.15) flags.push({ k: 'inv', t: `棚卸資産回転日数が${fmtNum(prv.invDays, 0)}日→${fmtNum(cur.invDays, 0)}日に悪化（在庫の滞留）` });
  if (cur.gpm - prv.gpm > 2.5) flags.push({ k: 'gpm', t: `売上総利益率が${fmtPct(prv.gpm, 1)}→${fmtPct(cur.gpm, 1)}に不自然に改善` });
  if (ys[n - 1].NI > 0 && isFinite(cur.ocfNi) && cur.ocfNi < 0.3) flags.push({ k: 'cf', t: `当期純利益は黒字だが営業CFが${cur.ocf < 0 ? 'マイナス' : '利益を大きく下回る'}（利益の質に疑問）` });
  if (isFinite(cur.depRate) && isFinite(prv.depRate) && cur.depRate < prv.depRate * 0.7) flags.push({ k: 'dep', t: `減価償却率が${fmtPct(prv.depRate, 1)}→${fmtPct(cur.depRate, 1)}に低下（償却不足の疑い）` });
  if (cur.ocaS > Math.max(prv.ocaS * 1.6, 3.5)) flags.push({ k: 'oca', t: `その他流動資産（仮払金・前払費用等）が売上比${fmtPct(cur.ocaS, 1)}に膨張` });
  if (isFinite(cur.taxRate) && ys[n - 1].PRETAX > 5e6 && cur.taxRate < 18) flags.push({ k: 'tax', t: `税負担率が${fmtPct(cur.taxRate, 1)}と異常に低い（申告所得との乖離の疑い）` });
  if (cur.impliedInt > 4.5) flags.push({ k: 'int', t: `支払利息÷有利子負債が${fmtPct(cur.impliedInt, 1)}と高すぎる（簿外借入の疑い）` });
  return flags;
}

/* AI審査の推定（審査システムLv3、結果は一度だけ算出して保存） */
function aiEstimate(co) {
  if (co.ai) return co.ai;
  const flags = fraudFlags(co).length;
  let grade, fp;
  if (co.fraud && !co.fraud.found) {
    grade = chance(0.6) ? clamp(co.gTrue + randInt(-1, 1), 1, 10) : co.gRep;
    fp = clamp(0.35 + 0.12 * flags + 0.25 * rand(), 0.2, 0.95);
  } else {
    grade = clamp(bankGrade(co) + (chance(0.25) ? randInt(-1, 1) : 0), 1, 10);
    fp = clamp(0.03 + 0.07 * flags + 0.08 * rand(), 0.01, 0.6);
  }
  co.ai = { grade, fp };
  return co.ai;
}

/* ---------- 個人（住宅ローン申込者） ---------- */
function annuityPayment(P, ratePct, months) {
  const i = ratePct / 1200;
  if (months <= 0) return P;
  if (Math.abs(i) < 1e-9) return P / months;
  return P * i / (1 - Math.pow(1 + i, -months));
}

function genPerson(did) {
  const occ = wpick(OCCUPATIONS, OCCUPATIONS.map(o => o.w));
  const age = randInt(26, 54);
  const s = G.city.d[did];
  const income = roundTo(uni(occ.inc[0], occ.inc[1]) * (1 + (age - 32) * 0.012) * 1e4 * s.income / DIST[did].income, 10e4);
  const ptype = pick(PROPERTY_TYPES);
  const price = clamp(roundTo(income * uni(5, 8.5) * Math.pow(s.land / 100, 0.5), 100e4), 1800e4, 12000e4);
  const downR = wpick([0, 0.05, 0.1, 0.2, 0.3], [35, 15, 25, 15, 10]);
  const overloan = downR === 0 && chance(0.4);
  const amount = roundTo(price * (1 - downR) + (overloan ? price * 0.06 : 0), 10e4);
  const maxTerm = Math.min(35, 80 - age);
  const termY = clamp(maxTerm - (chance(0.3) ? randInt(0, 10) : 0), 10, 35);
  const otherDebt = chance(0.35) ? roundTo(uni(12e4, 60e4), 1e4) : 0;
  let fraud = null;
  if (chance(DIFFICULTY[G.difficulty].fraud * 0.6)) fraud = { type: wpick(['income', 'hiddenDebt', 'investment'], [4, 4, 2]), found: false };
  const repIncome = fraud && fraud.type === 'income' ? roundTo(income * uni(1.25, 1.6), 10e4) : income;
  const hiddenDebt = fraud && fraud.type === 'hiddenDebt' ? roundTo(uni(60e4, 200e4), 1e4) : 0;
  const valueTrue = price * (ptype.startsWith('新築') || ptype === '注文住宅' ? uni(0.82, 0.95) : uni(0.85, 1.05)) * (fraud && fraud.type === 'investment' ? 0.85 : 1);
  const employer = occ.id === 'self' ? '自営（' + pick(['飲食店', '設計事務所', '美容室', '整骨院', 'IT受託開発', '運送業']) + '）'
    : occ.id === 'civil' ? pick(['汐見市役所', '県庁', '公立学校', '消防本部'])
    : occ.id === 'doctor' ? pick(['汐見市民病院', '学園都市大学病院', '開業医（内科）'])
    : newCompanyName(pick(['mfg', 'whl', 'it', 'con', 'trn', 'med']));
  return {
    id: 'p' + (++G.seq.p), name: personName(), age, occ: occ.id, employer, income, repIncome,
    yearsEmp: clamp(randInt(1, age - 22), 1, 35), fam: pick(['単身', '夫婦', '夫婦・子1人', '夫婦・子2人', '夫婦・子3人']),
    ptype, price, downR, amount, termY, otherDebt, hiddenDebt, valueTrue, valueEst: valueTrue * uni(0.85, 1.2), district: did, fraud,
  };
}
const OCC = Object.fromEntries(OCCUPATIONS.map(o => [o.id, o]));

/* 返済負担率（DTI） useTrue: 真の所得・債務を使う */
function mortDTI(p, amount, ratePct, termY, useTrue) {
  const pay = annuityPayment(amount, ratePct, termY * 12) * 12;
  const inc = useTrue ? p.income : p.repIncome;
  const other = p.otherDebt + (useTrue ? p.hiddenDebt : 0);
  return (pay + other) / inc;
}
function mortPD(p, amount, ratePct, termY, useTrue = true) {
  const dti = mortDTI(p, amount, ratePct, termY, useTrue);
  let pd = interp(dti, [[0.15, 0.08], [0.2, 0.12], [0.25, 0.2], [0.3, 0.35], [0.35, 0.6], [0.4, 1.1], [0.5, 2.0], [0.7, 4]]);
  pd *= OCC[p.occ].risk;
  const val = useTrue ? p.valueTrue : p.valueEst;
  if (amount / val > 1.0) pd *= 1.4;
  if (p.age + termY > 75) pd *= 1.25;
  if (useTrue && p.fraud && p.fraud.type === 'investment') pd *= 2.2;
  if (G) pd *= Math.exp((G.eco.unemp - 2.6) * 0.35);
  return pd;
}
/* 住宅ローンの行内スコア → 格付相当 */
function mortGrade(p, amount, ratePct, termY) {
  const pd = mortPD(p, amount, ratePct, termY, false);
  for (let g = 1; g <= 10; g++) if (pd <= GRADE_PD[g] * 1.3) return g;
  return 10;
}
