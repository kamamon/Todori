'use strict';
/* =========================================================
 *  09_budget.js : 銀行の予算（経営計画）と予実管理
 *  年度の初め（4月）に前期の実績から予算案を作り、頭取が目標を決める。
 *  毎月の実績（月次の損益）と比べて差異を示す。
 * ========================================================= */

const BUDGET_LINES = [
  ['nii', '資金利益', 'nii'], ['fee', '役務取引等利益', 'feeIncome'], ['gross', '業務粗利益', 'bankGross', 'sum'],
  ['opex', '経費', 'ohr', 'cost'], ['core', 'コア業務純益', 'coreProfit', 'sum'], ['credit', '与信関係費用', 'creditCost', 'cost'],
  ['ordinary', '経常利益', 'ord', 'grand'],
];
/* 経費の月ごとの重み（4月〜3月。6月と12月は賞与） */
const OPEX_SEASON = [1, 1, 2.1, 1, 1, 1, 1, 1, 2.1, 1, 1, 1];
const OPEX_SEASON_SUM = OPEX_SEASON.reduce((a, b) => a + b, 0);

/* 予算の土台：前期の実績（なければ開業時の見込み） */
function budgetBase(fy) {
  const last = G.annual.find(a => a.fy === fy - 1);
  if (last) {
    const p = last.pl;
    return { nii: p.nii, fee: p.feeNet, opex: p.opex, credit: Math.max(0, p.credit), loans: last.loans, dep: last.dep, from: 'last' };
  }
  const gross = G.initGP || 5.3e8;
  const opex = G.initOpex || 4.6e8;
  const credit = Math.max(0, gross - opex - (G.initNI || 0) / 0.7);
  return { nii: gross * 0.86, fee: gross * 0.14, opex, credit, loans: B('loans'), dep: deposits(), from: 'est' };
}
function defaultBudgetTargets(fy) {
  const b = budgetBase(fy);
  return { gL: 3, gD: 2, gOpex: 1, creditRate: +clamp(b.credit / Math.max(1, b.loans) * 100, 0.05, 1.5).toFixed(2) };
}
function makeBudget(fy, t) {
  const b = budgetBase(fy);
  const gL = t.gL / 100, gD = t.gD / 100;
  const nii = b.nii * (1 + gL * 0.6);
  const fee = b.fee * (1 + gD * 0.5 + 0.01);
  const opex = b.opex * (1 + t.gOpex / 100);
  const loansAvg = b.loans * (1 + gL / 2);
  const credit = loansAvg * t.creditRate / 100;
  const gross = nii + fee;
  const core = gross - opex;
  const lines = { nii, fee, gross, opex, core, credit, ordinary: core - credit };
  for (const k in lines) lines[k] = Math.round(lines[k]);
  return { fy, t: Object.assign({}, t), base: b, lines, loansEnd: Math.round(b.loans * (1 + gL)), depEnd: Math.round(b.dep * (1 + gD)), status: 'draft' };
}
/* 年度が変わったら予算案を作る */
function ensureBudget() {
  const fy = fyOf(G.m);
  if (G.budget && G.budget.fy === fy) return;
  if (G.budget) G.budgetLast = G.budget;
  G.budget = makeBudget(fy, defaultBudgetTargets(fy));
}
function setBudgetTargets(t) {
  if (!G.budget || G.budget.status !== 'draft') return false;
  const fy = G.budget.fy;
  const clean = {
    gL: clamp(+t.gL || 0, -20, 40), gD: clamp(+t.gD || 0, -20, 40),
    gOpex: clamp(+t.gOpex || 0, -20, 30), creditRate: clamp(+t.creditRate || 0, 0, 5),
  };
  G.budget = makeBudget(fy, clean);
  return true;
}
function approveBudget(auto) {
  if (!G.budget || G.budget.status !== 'draft') return;
  G.budget.status = auto ? 'auto' : 'ok';
  G.budget.approvedM = G.m;
}
/* 月ごとの予算（i = 年度の何か月目か 0〜11） */
function budgetMonth(bud, k, i) {
  const v = bud.lines[k];
  if (k === 'opex') return v * OPEX_SEASON[i] / OPEX_SEASON_SUM;
  if (k === 'gross') return budgetMonth(bud, 'nii', i) + budgetMonth(bud, 'fee', i);
  if (k === 'core') return budgetMonth(bud, 'gross', i) - budgetMonth(bud, 'opex', i);
  if (k === 'ordinary') return budgetMonth(bud, 'core', i) - budgetMonth(bud, 'credit', i);
  return v / 12;
}
/* 予実の集計（締めた月まで） */
function budgetVsActual(bud) {
  const fy = bud.fy;
  const months = G.hist.filter(h => h.m >= fy * 12 && h.m <= fy * 12 + 11);
  const n = months.length;
  const act = plSummary(sumPL(fy * 12, fy * 12 + 11));
  const actual = { nii: act.nii, fee: act.feeNet, gross: act.gross, opex: act.opex, core: act.core, credit: act.credit, ordinary: act.ordinary };
  const rows = BUDGET_LINES.map(([k, name, tk, cls]) => {
    let cum = 0;
    for (let i = 0; i < n; i++) cum += budgetMonth(bud, k, i);
    const a = actual[k];
    const cost = k === 'opex' || k === 'credit';
    const diff = a - cum;
    const fav = cost ? diff <= 0 : diff >= 0;
    let rest = 0;
    for (let i = n; i < 12; i++) rest += budgetMonth(bud, k, i);
    return { k, name, tk, cls, year: bud.lines[k], cum, a, diff, fav, rate: cum ? a / cum * 100 : NaN, outlook: a + rest, cost };
  });
  return { n, rows };
}
/* 予実の差についての短いコメント */
function budgetComments(bud, va) {
  const out = [];
  if (!va.n) return out;
  const r = Object.fromEntries(va.rows.map(x => [x.k, x]));
  const pct = x => Math.abs(x.diff) / Math.max(1, Math.abs(x.cum)) * 100;
  const loansNow = B('loans');
  const loanPlan = bud.base.loans + (bud.loansEnd - bud.base.loans) * va.n / 12;
  if (pct(r.nii) > 3) {
    out.push(`資金利益は予算比${fmtPct(r.nii.rate, 1)}。${r.nii.fav ? '予算を上回っています。' : '予算を下回っています。'}${loansNow < loanPlan * 0.98 ? `貸出金の残高（${fmtYen(loansNow)}）が計画（${fmtYen(loanPlan)}）に届いていないのが一因です。` : loansNow > loanPlan * 1.02 ? `貸出金の残高が計画を上回って伸びています。` : '貸出金利や預金金利の水準の変化が影響しています。'}`);
  }
  if (pct(r.opex) > 3) out.push(`経費は予算比${fmtPct(r.opex.rate, 1)}。${r.opex.fav ? '予算の範囲に収まっています。' : '予算を超えています。採用・店舗・システムの費用を見直しましょう。'}`);
  if (Math.abs(r.credit.diff) > Math.max(1e7, Math.abs(r.credit.cum) * 0.2)) out.push(`与信関係費用は${r.credit.fav ? '予算より少なく済んでいます' : `予算を${fmtYen(r.credit.diff)}上回っています。融資先の業況悪化や債務者区分の見直しで引当金が増えました`}。`);
  if (r.ordinary.outlook < bud.lines.ordinary * 0.9) out.push(`このままだと年間の経常利益は予算の${fmtPct(r.ordinary.outlook / Math.max(1, bud.lines.ordinary) * 100, 0)}にとどまる見通しです。`);
  else if (r.ordinary.outlook > bud.lines.ordinary * 1.1) out.push(`年間の経常利益は予算を上回る見通しです（${fmtYen(r.ordinary.outlook)}）。`);
  return out;
}
/* 前期の予算の達成率（株主総会で使う） */
function lastBudgetAchievement() {
  const b = G.budgetLast;
  if (!b) return null;
  const rep = G.annual.find(a => a.fy === b.fy);
  if (!rep || !b.lines.ordinary) return null;
  return { fy: b.fy, plan: b.lines.ordinary, actual: rep.pl.ordinary, rate: b.lines.ordinary > 0 ? rep.pl.ordinary / b.lines.ordinary * 100 : NaN };
}
