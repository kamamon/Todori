'use strict';
/* =========================================================
 *  04_city.js : 汐見市の成長（人口・事業所・地域活力・地価）
 *  銀行の融資と都市開発プロジェクトが街を育て、
 *  育った街が預金と融資需要を生む。
 * ========================================================= */

function newCity() {
  const c = { d: {}, projects: {}, boost: 0, hist: [] };
  for (const D of DISTRICTS) {
    c.d[D.id] = {
      pop: D.pop, firms: D.firms, income: D.income, vit: 100, land: 100,
      projBoost: 0, disaster: 0, failPen: 0, mortBoost: 0,
      lendHist: [], mortNew: [], depMkt: 0, closures: 0, startups: 0,
    };
  }
  for (const D of DISTRICTS) updateDepMkt(D, c.d[D.id]);
  return c;
}

function updateDepMkt(D, st) {
  const s = st || G.city.d[D.id];
  s.depMkt = s.pop * 500e4 * s.income * D.sav + s.firms * 3500e4 * Math.sqrt(Math.max(0.3, s.vit / 100));
}

/* 地区内の当行の事業性融資残高 */
function districtBizLending(did) {
  let t = 0;
  for (const L of G.loans) if (L.district === did && (L.kind === 'biz' || L.kind === 'proj') && isActiveLoan(L)) t += L.bal;
  return t;
}

function cityStep() {
  const c = G.city, e = G.eco;
  for (const D of DISTRICTS) {
    const s = c.d[D.id];
    const biz = districtBizLending(D.id);
    s.lendHist.push(biz);
    while (s.lendHist.length > 13) s.lendHist.shift();
    const d12 = biz - s.lendHist[0];
    const impulse = d12 / (s.firms * 0.05e8);
    while (s.mortNew.length > 12) s.mortNew.shift();
    const housing = sum(s.mortNew) / (s.pop * 5e4);
    let ic = 0, iw = 0;
    for (const [k, w] of Object.entries(D.mix)) { ic += indCond(k) * w; iw += w; }
    ic /= iw;
    s.disaster *= 0.93;
    s.failPen *= 0.95;
    s.impulse = impulse;
    const target = 100 + 30 * Math.tanh(impulse * 2.5) + 12 * Math.tanh(housing * 2) + s.projBoost + 14 * ic
      + 3.5 * (e.gdp - 1) + s.disaster + c.boost - s.failPen;
    s.vit = clamp(s.vit + (target - s.vit) * 0.05 + randn() * 0.25, 40, 200);
    const vg = (s.vit - 100) / 100;
    const popA = D.trend + 2.0 * vg + 0.3 * (e.gdp - 1) + s.mortBoost;
    s.mortBoost *= 0.97;
    const prevFirms = s.firms;
    s.pop *= 1 + popA / 100 / 12;
    const firmA = -1.0 + 3.5 * vg + 0.4 * (e.gdp - 1) + Math.tanh(impulse * 3);
    s.firms *= 1 + firmA / 100 / 12;
    s.startups = Math.max(0, s.firms - prevFirms);
    s.income *= 1 + (0.6 + 0.4 * e.gdp + 1.5 * vg) / 100 / 12;
    const landA = REGIMES[e.regime].land * 0.8 + 12 * vg;
    s.land = Math.max(20, s.land * (1 + landA / 100 / 12 + randn() * 0.002));
    updateDepMkt(D);
  }
  c.boost *= 0.995;
  projectsStep();
  const st = cityStats();
  c.hist.push({ m: G.m, pop: Math.round(st.pop), firms: Math.round(st.firms), vit: +st.vit.toFixed(1), share: +(st.share * 100).toFixed(2) });
  if (c.hist.length > 240) c.hist.shift();
}

function cityStats() {
  const c = G.city;
  let pop = 0, firms = 0, vitW = 0, dep = 0, land = 0;
  for (const D of DISTRICTS) {
    const s = c.d[D.id];
    pop += s.pop; firms += s.firms; vitW += s.vit * s.pop; dep += s.depMkt; land += s.land * s.pop;
  }
  return { pop, firms, vit: vitW / pop, depMkt: dep, land: land / pop, share: cityDeposits() / dep };
}

/* 地区の開発段階（地図の描画用、1〜10） */
function devLevel(did) {
  const D = DIST[did], s = G.city.d[did];
  const base = Math.log2((s.pop / D.pop) * 0.5 + (s.firms / D.firms) * 0.5) * 6 + 4;
  const done = PROJECTS.filter(P => P.d === did && G.city.projects[P.id]?.status === 'done').length;
  return clamp(base + (s.vit - 100) / 12 + done * 1.2, 1, 10);
}

/* ---------- 都市開発プロジェクト ---------- */
function projectsStep() {
  const c = G.city;
  for (const P of PROJECTS) {
    const st = c.projects[P.id];
    if (!st) continue;
    if (st.status === 'offered' && G.m > st.deadline) resolveProjectOffer(P, st);
    else if (st.status === 'building' && G.m >= st.doneM) completeProject(P, st);
  }
  const offered = PROJECTS.some(P => c.projects[P.id]?.status === 'offered');
  if (!offered && G.m >= 3 && chance(0.075 * G.eco.demand)) {
    const eligible = PROJECTS.filter(P => {
      const st = c.projects[P.id];
      if (st && ['offered', 'building', 'done'].includes(st.status)) return false;
      if (st && (st.status === 'cancelled' || st.status === 'failed') && G.m - st.offerM < 24) return false;
      if (P.req && c.projects[P.req]?.status !== 'done') return false;
      return true;
    });
    if (eligible.length) offerProject(pick(eligible));
  }
}

function offerProject(P) {
  const debt = P.cost * 0.7;
  const others = clamp(uni(0.4, 0.75) * G.eco.demand, 0.25, 0.85);
  const st = {
    status: 'offered', offerM: G.m, deadline: G.m + 2, debt, others,
    maxOurs: debt * 0.6, ourAmt: 0, grade: P.risk + 1,
  };
  G.city.projects[P.id] = st;
  addNews('city', `【案件】${DIST[P.d].name}で「${P.name}」の計画。総事業費${fmtYen(P.cost)}、シンジケートローン${fmtYen(debt)}の参加行を募集`, 'good', { proj: P.id });
}

/* プロジェクトの適用金利 */
function projectRate(P) {
  const st = G.city.projects[P.id];
  return +(marketLoanRate(st.grade, 180) + 0.15).toFixed(3);
}

function resolveProjectOffer(P, st) {
  const ours = st.ourAmt || 0;
  const leadBonus = ours >= st.debt * 0.4 ? 0.15 : 0;
  const total = ours + Math.min(1, st.others + leadBonus) * st.debt;
  if (total + 1 >= st.debt) {
    st.status = 'building'; st.startM = G.m; st.doneM = G.m + P.months;
    st.lead = ours >= st.debt * 0.4;
    if (ours > 0) {
      const L = bookProjectLoan(P, st, ours);
      st.loanId = L.id;
      if (st.lead) {
        const fee = Math.round(st.debt * 0.008);
        receive(fee, 'fees', 'シンジケートローン組成手数料（アレンジャーフィー）');
        G.trust = clamp(G.trust + 2, 0, 100);
      }
    }
    G.city.d[P.d].projBoost += 2;
    addNews('city', `「${P.name}」の資金調達が完了し着工。${ours > 0 ? (st.lead ? '当行が主幹事として' : '当行も') + fmtYen(ours) + 'を融資' : '当行は不参加'}`, 'good', { proj: P.id });
    G.stats.projectsFunded += ours > 0 ? 1 : 0;
  } else {
    st.status = 'cancelled';
    G.city.d[P.d].failPen += 4;
    addNews('city', `「${P.name}」は資金調達が難航し、計画は白紙に（必要額${fmtYen(st.debt)}に対し${fmtYen(total)}）`, 'bad', { proj: P.id });
  }
}

function completeProject(P, st) {
  st.status = 'done';
  const s = G.city.d[P.d];
  const fx = P.fx;
  s.firms += fx.firms || 0;
  s.pop += fx.pop || 0;
  s.projBoost += fx.vit || 0;
  s.land *= 1 + (fx.land || 0);
  s.mortBoost += fx.mort || 0;
  if (fx.city) G.city.boost += fx.city;
  if (fx.ind) for (const [k, v] of Object.entries(fx.ind)) G.eco.ind[k].shock = clamp(G.eco.ind[k].shock + v, -0.8, 0.8);
  updateDepMkt(DIST[P.d]);
  addNews('city', `「${P.name}」が完成。${DIST[P.d].name}に新たな人の流れが生まれている`, 'good', { proj: P.id });
}

/* プロジェクト融資の破綻（建設中なら計画頓挫） */
function projectLoanFailed(L) {
  const st = Object.values(G.city.projects).find(x => x.loanId === L.id);
  if (!st) return;
  const P = PROJECTS.find(p => G.city.projects[p.id] === st);
  if (st.status === 'building') {
    st.status = 'failed'; st.offerM = G.m;
    G.city.d[P.d].failPen += 10;
    addNews('city', `「${P.name}」の事業会社が経営破綻。工事は中断し、計画は頓挫した`, 'bad', { proj: P.id });
  }
}

/* 地区への災害 */
function districtDisaster(did, sev) {
  const s = G.city.d[did];
  s.disaster -= 12 * sev;
  s.land *= 1 - 0.06 * sev;
  for (const co of Object.values(G.companies)) if (co.district === did) co.q -= uni(0.2, 0.8) * sev;
}
