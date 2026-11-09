'use strict';
/* =========================================================
 *  22b_kaisha_ind2.js : 事業の共通の道具と、新しい事業の型
 *   subs  会員・利用者から稼ぐ（SaaS・AI・通信・放送・新聞・塾・ジム）
 *   cap   施設を使ってもらう（ホテル・データセンター・倉庫・病院・介護・発電・賃貸・レンタル）
 *   trans 人や物を運ぶ（鉄道・航空・海運・トラック・バス・タクシー）
 * ========================================================= */

/* ---------- 事業（G.units）の道具 ---------- */
function ksUnits() { return G.units || []; }
function ksActiveUnits() { return ksUnits().filter(u => !u.closedM); }
function ksUnit(id) { return ksUnits().find(u => u.id === id); }
function ksMainUnit() { return ksActiveUnits()[0] || ksUnits()[0]; }
function ksUName(u) { return u.n || ksS(u).name; }
function ksHasEng(eng) { return ksActiveUnits().some(u => ksS(u).eng === eng); }
function ksUnitsOf(eng) { return ksActiveUnits().filter(u => ksS(u).eng === eng); }
/* 成長の要素（20e・29）からの倍率。まだ無いときは1 */
function ksUpF(u) { return (typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'demand') : 1) * (typeof ksLawDemandF === 'function' ? ksLawDemandF(u) : 1) * (typeof ksTrendF === 'function' ? ksTrendF(u) : 1); }
function ksShrinkF(u) { return typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'shrink') : 1; }
function ksEnF(u) { return typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'energy') : 1; }
function ksFuelF(u) { return typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'fuel') : 1; }
/* 途中から始めた事業は、取引先・利用者が定着するまで1年半ほどかけて伸びる */
function ksStartRamp(u) { const r = u.op && u.op.ramp; return r === undefined ? 1 : clamp(0.3 + 0.7 * (G.m - r) / 18, 0.3, 1); }
function ksHireCostOf(r) { return r.id === 'eng' || r.wage >= 45e4 ? 150e4 : r.wage < 15e4 ? 3e4 : 35e4; }
/* 事業の人件費の月の見込み（キャリブレーション用） */
function ksUnitFixedEst(u) { return sum(ksS(u).roles, r => (u.staff[r.id] || 0) * r.wage * G.eco.wageIdx * (1 + r.bonus / 12) * (1 + r.wf)); }
function ksUnitDep(u) { return sum(ksUA(u), a => (a.life && a.acct !== 'land' ? a.cost / a.life / 12 : 0)); }
/* 会社に影響を残さずに試す（M&Aの見積・新規事業の単価の目安） */
function ksSandbox(fn) {
  const snap = { ar: G.ar.map(x => Object.assign({}, x)), ap: G.ap.map(x => Object.assign({}, x)), nA: G.assets.length, seq: G.seq, useq: G.useq, rs: G.rs, curU: G.curU };
  try { return fn(); } finally { G.ar = snap.ar; G.ap = snap.ap; G.assets.length = snap.nA; G.seq = snap.seq; G.useq = snap.useq; G.rs = snap.rs; G.curU = snap.curU; }
}
/* ---------- キャリブレーション（試算で合わせる） ----------
 *  業種の数字から決めた単価（各エンジンの calib）だけでは、細かな費用の見落としや、客足・人員の動きで利益率がずれる。
 *  そこで、会社の写しの中で事業を1年ほど動かして営業利益率を測り、基準の単価（卸売と建設は取引の規模）の倍率 k を、
 *  利益率が業界の水準になるように合わせる。写しで動かすので、本物の会社には何も残らない。
 *  利益率は k について「a − b/k」の形（単価を上げても、規模を増やしても、固定費の重さが薄まる）なので、2点から当てはめて解く。 */
function ksCalibDep(u) {
  return sum(ksUA(u), a => (a.life && a.acct !== 'land' && !a.cip && G.m - a.acqM < a.life * 12 && a.booked < a.cost - 1 ? a.cost / a.life / 12 : 0));
}
function ksCalibRun(u, k, months, warm, hqFixed = 0) {
  const saved = G;
  const lite = Object.assign({}, saved, { journal: [], months: [], fys: {}, news: [], pendingModals: [], units: [], law: null, grow: null });
  G = JSON.parse(JSON.stringify(lite));
  try {
    const cu = JSON.parse(JSON.stringify(u));
    G.units = [cu];
    G.hist = true; G.calibRun = true; G.repT = 1; G.over = null; G.closing = null;
    const S = ksS(cu), E = KS_ENGINE[S.eng];
    if (k !== 1) E.scale(cu, k);
    // 工事：始める前から抱えている工事も同じ倍率にする（工期が長いと、測る期間に古い大きさの工事の完成が入り、倍率を見誤る）
    if (k !== 1 && S.eng === 'build') for (const p of cu.op.projects || []) if (!p.fin) {
      for (const f of ['contract', 'cost', 'costToDate', 'recv']) p[f] = (p[f] || 0) * k;
      for (const f of Object.keys(p.parts || {})) p.parts[f] *= k;
    }
    let sales = 0, cost = 0;
    for (let i = 0; i < months; i++) {
      G.flow = {}; G.flowC = {}; G.flowU = {}; G.flowCU = {}; G.cfm = {}; G.jcur = {};
      G.curU = cu.id;
      E.auto(cu);
      const si = ksMonthIndex(G.m);
      const h0 = (cu.op.hid || 0) + (cu.op.matHid || 0);
      const r = E.month(cu, { si, mo: calMonth(G.m), season: S.season[si] }) || {};
      const shrink = Math.max(0, (cu.op.hid || 0) + (cu.op.matHid || 0) - h0);
      cu.kpi = r.kpi || {};
      if (r.afterPayroll) r.afterPayroll();
      G.curU = null;
      ksCollect();
      if (i >= warm) {
        const f = G.flowU[cu.id] || {};
        const lab = sum(S.roles, ro => (cu.staff[ro.id] || 0) * ksRoleWage(ro, cu) * (1 + ro.bonus / 12 * (G.bonusLv ?? 1)) * (1 + ro.wf)) + (r.extraLabor || 0) * 1.15;
        sales += f.sales || 0;
        cost += sum(KS_COGS_ACCTS, a => f[a] || 0) + sum(KS_SGA_ACCTS, a => f[a] || 0) + (r.mgAdj || 0) + lab + ksCalibDep(cu) + shrink + hqFixed;
      }
      G.m++;
      if (E.next) { G.curU = cu.id; E.next(cu); G.curU = null; }
    }
    const assets = sum(ksUA(cu), a => (a.acct === 'goodwill' ? 0 : a.cost));
    return { sales, cost, assets, annual: sales * 12 / Math.max(1, months - warm), m: sales > 0 ? (sales - cost) / sales : -9 };
  } finally { G = saved; }
}
/* 営業利益率を target に合わせる倍率 k（試算できないときは 1）。hqFixed は事業に割り振る本社の月の費用（役員報酬など） */
function ksCalibEmp(u, target, hqFixed = 0) {
  const S = ksS(u), E = KS_ENGINE[S.eng];
  if (!E.scale) return 1;
  const vol = !!E.volLever;
  // 工事は売上の波が大きく、原子力は定期検査で止まる月があるので、長めに測る
  const long = S.eng === 'build' || ksP(u).nuke;
  const months = long ? 33 : 15, warm = long ? 9 : 3;
  // 設備の重い事業（ビル・船・発電所など）は、借入の利息と返済の分だけ利益率を高めに合わせる（資産÷売上が0.8を超える分×1.5%）
  const tg = r => target + 0.015 * Math.max(0, r.assets / Math.max(1, r.annual) - 0.8);
  // 目標との差 d(k) = 利益率 − 目標 を合わせる
  const m = k => { const r = ksCalibRun(u, k, months, warm, hqFixed); return r.m <= -8 ? -9 : r.m - tg(r) + target; };
  const tol = 0.0025;
  let k0 = 1, m0 = m(1);
  if (m0 <= -8) return 1; // 売上が立たない
  if (Math.abs(m0 - target) < tol) return 1;
  // 1歩目：単価なら費用はそのまま（a≒1）、規模なら粗利の分（a≒m+0.12）と見て解く
  const a0 = vol ? m0 + 0.12 : 1;
  let k1 = clamp(k0 * (a0 - m0) / Math.max(0.02, a0 - target), 0.1, 6);
  let m1 = m(k1);
  for (let it = 0; it < 3 && Math.abs(m1 - target) >= tol; it++) {
    const b = (m1 - m0) / (1 / k0 - 1 / k1);
    const a = m0 + b / k0;
    let k2 = b > 0 && a > target + 0.004 ? b / (a - target) : k1 * (m1 < target ? 1.25 : 0.8);
    k2 = clamp(k2, Math.max(0.05, k1 / 3), Math.min(8, k1 * 3));
    if (Math.abs(k2 - k1) < 1e-4) break;
    k0 = k1; m0 = m1; k1 = k2; m1 = m(k2);
  }
  return Math.abs(m1 - target) < Math.abs(m0 - target) ? k1 : k0;
}
/* 途中から始める事業の基準の単価を、同じ業種の標準的な規模の会社に合わせる（キャリブレーション） */
function ksCalibFresh(u) {
  const S = ksS(u);
  const got = ksSandbox(() => {
    const t = { id: 'Utmp', type: u.type, n: null, sc: Math.max(1, u.sc || 1), op: {}, staff: {}, invB: {}, kpi: {} };
    G.curU = t.id;
    KS_ENGINE[S.eng].init(t, KS_COND.normal);
    KS_ENGINE[S.eng].calib(t, KS_ENG_OPM[S.eng]);
    G.curU = null;
    const k = ksCalibEmp(t, KS_ENG_OPM[S.eng]);
    if (k !== 1) KS_ENGINE[S.eng].scale(t, k);
    return t.op;
  });
  for (const k of ['spend0', 'ref', 'rate', 'price', 'arpu', 'adRef', 'gmvRef', 'yield', 'amtK', 'sizeK', 'anc']) if (typeof got[k] === 'number' && isFinite(got[k])) u.op[k] = got[k];
}
/* 基準の単価（lv）：キャリブレーションで合わせる値。会社を作り直すとき newOp が引き継ぐ */
const KS_LV_KEYS = { shop: ['spend0'], rest: ['spend0'], mfg: ['rate', 'ref'], build: ['amtK'], trade: ['sizeK'], pro: ['price', 'ref'], subs: ['arpu', 'ref', 'adRef', 'gmvRef'], cap: ['price', 'ref', 'anc'], trans: ['yield'] };
function ksGetLv(u) { const o = {}; for (const k of KS_LV_KEYS[ksS(u).eng] || []) if (typeof u.op[k] === 'number') o[k] = u.op[k]; return o; }
/* 過去の期の自動経営：耐用年数を過ぎた機械・車両・器具は、少しずつ買い替えてきた（減価償却費の水準を保つ）。
   施設・利用者向けの設備・輸送・卸売・製造の型。開始の時点で古い機械はあまり残らないが、経営を続けるうちに古くなり、
   更新の判断が社長の仕事になる（以前からの町工場などはキャリブレーションをしないので、古い機械が残ったまま） */
function ksHistRenew() {
  for (const u of ksActiveUnits()) {
    const S = ksS(u);
    if (!S.calib || !['cap', 'subs', 'trans', 'trade', 'mfg'].includes(S.eng)) continue;
    for (const a of ksUA(u)) {
      if (!['mach', 'equip', 'veh'].includes(a.acct) || a.cip || !a.life || a.openM > G.m) continue;
      if (G.m - a.acqM < a.life * 12 || !chance(0.25)) continue;
      const o = {};
      for (const [k, v] of Object.entries(a)) if (!['id', 'booked', 'acqM', 'soldM', 'openM'].includes(k)) o[k] = v;
      o.cost = Math.round(a.cost * clamp(ksPrice() / 0.95, 0.9, 1.3) / 1e4) * 1e4;
      G.curU = u.id;
      ksSellAsset(a, ksSalePrice(a));
      const b = ksNewAsset(o);
      ksPost('buyAsset', [[b.acct, b.cost, 0], ['cash', 0, b.cost]], { cf: 'capex', desc: `設備の買い替え（${b.n}）` });
      G.curU = null;
    }
  }
}
/* 撤退の見込み */
function ksCloseUnitPreview(u) {
  const S = ksS(u), E = KS_ENGINE[S.eng];
  const as = ksUA(u).filter(a => a.acct !== 'land' || true);
  const items = E.stockCount(u) || [];
  return {
    nA: as.length, bv: sum(as, a => a.cost - a.booked), sale: sum(as, a => (a.acct === 'goodwill' || a.cip ? (a.cip ? a.cost * 0.6 : 0) : a.acct === 'land' ? a.cost : ksSalePrice(a))),
    inv: sum(items, it => it.phys), head: ksUnitHead(u), sev: sum(S.roles, r => (u.staff[r.id] || 0) * ksRoleWage(r, u)), dep: Math.min(u.dep || 0, ksB('deposit')),
    proj: S.eng === 'build' ? u.op.projects.filter(p => !p.fin).length : 0,
  };
}
/* 事業から撤退する：在庫の処分・工事の引継ぎ・設備の売却・退職金・保証金の返還 */
function ksCloseUnit(u) {
  const S = ksS(u), E = KS_ENGINE[S.eng];
  const pv = ksCloseUnitPreview(u);
  G.curU = u.id;
  // 在庫：期首の在庫を原価に振り替え、残りは半値で売る
  for (const it of E.stockCount(u) || []) {
    const begin = Math.round((u.invB || {})[it.acct] || 0);
    if (begin) ksPost('unitInv', [[it.pacct, begin, 0], [it.acct, 0, begin]], { key: it.acct, desc: '撤退する事業の期首の在庫を原価に振り替え' });
    const sale = Math.round(Math.max(0, it.phys) * 0.5);
    if (sale > 0) ksPost('unitInvSale', [['cash', sale, 0], ['sales', 0, sale]], { cf: 'cashSales', key: it.acct, desc: '撤退する事業の在庫の処分（半値で売却）' });
  }
  u.invB = {};
  for (const k of ['book', 'hid', 'matBook', 'matHid', 'wip', 'prod']) if (typeof u.op[k] === 'number') u.op[k] = 0;
  // 施工中の工事は他社に引き継ぐ（受け取った代金とかかった費用の差は特別損益）
  if (S.eng === 'build') for (const p of u.op.projects.filter(x => !x.fin)) {
    const diff = p.recv - p.costToDate;
    const lines = [['advRecv', p.recv, 0], ['cwip', 0, p.costToDate]];
    if (diff > 0) lines.push(['gainSale', 0, diff]); else if (diff < 0) lines.push(['lossSale', -diff, 0]);
    ksPost('unitProj', lines, { key: p.id, desc: `施工中の工事の引継ぎ（${p.client}）` });
    p.fin = true; p.doneM = G.m;
  }
  // 設備を売る（建設中のものは6割で引き取ってもらう。のれんは価値がなくなる）
  for (const a of ksUA(u)) {
    if (a.cip) { const price = Math.round(a.cost * 0.6); ksPost('sellAsset', [['cash', price, 0], ['lossSale', a.cost - price, 0], ['cip', 0, a.cost]], { cf: 'capex', desc: `建設中の設備の売却（${a.n}）` }); a.soldM = G.m; continue; }
    ksSellAsset(a, a.acct === 'goodwill' ? 0 : a.acct === 'land' ? a.cost : ksSalePrice(a));
  }
  // 退職金（給与1か月分）
  for (const r of S.roles) {
    const n = u.staff[r.id] || 0;
    if (!n) continue;
    const sev = Math.round(ksRoleWage(r, u) * n);
    ksPost('retire', [[r.cost === 'labor' ? 'labor' : 'salary', sev, 0], ['cash', 0, sev]], { cf: 'payroll', key: r.id });
    u.staff[r.id] = 0;
  }
  // 保証金の返還
  if (pv.dep > 0) ksPost('depositBack', [['cash', pv.dep, 0], ['deposit', 0, pv.dep]], { cf: 'capex', desc: '店舗・事務所の保証金の返還' });
  u.dep = 0;
  G.curU = null;
  u.closedM = G.m;
  if (typeof ksDeptDropUnit === 'function') ksDeptDropUnit(u.id); // 社内の組織の受け持ちから外す
  return `設備の売却 ${fmtYen(pv.sale)}・退職金 ${fmtYen(pv.sev)}${pv.inv ? `・在庫の処分 ${fmtYen(pv.inv / 2)}` : ''}`;
}

/* =========================================================
 *  subs：会員・利用者から稼ぐ
 * ========================================================= */
KS_ENGINE.subs = {
  newOp(u) { const P = ksP(u); return { users: 0, users0: 1, pot: 0, arpu: P.arpu, ref: P.arpu, mkt: 0, rep: 1, quality: 1, content: P.fixed, fixed0: P.fixed, adRef: P.ad, gmvRef: P.gmv }; },
  /* 市場の飽和：会社が取れる利用者の上限（pot）に近づくほど、新しい利用者は取りにくい。開始時の規模で1 */
  satF(u) { const op = u.op; const pot = op.pot || op.users0 * 3; return clamp((1 - op.users / Math.max(1, pot)) * 1.5, 0.03, 1.4); },
  capEq(u) { return ksUA(u).filter(a => ksEqOf(a).e === 'subs' && !(a.openM > G.m)); },
  capacity(u) {
    const S = ksS(u), P = ksP(u);
    if (!S.eq.length) return Infinity;
    const k0 = S.eq[0].k;
    const units = ksEqN(ksUA(u).filter(a => a.eq === k0 && !(a.openM > G.m)));
    return units * P.capPer;
  },
  init(u, cond) {
    const P = ksP(u), S = ksS(u), sc = u.sc || 1;
    const op = u.op = this.newOp(u);
    op.users = op.users0 = Math.max(10, Math.round(P.users * sc));
    op.pot = op.users0 * 3;
    if (S.eq.length) {
      const first = S.eq[0];
      const needN = Math.ceil(op.users * 1.25 / Math.max(1, P.capPer));
      const list = S.eq.map((e, i) => (i === 0 ? Object.assign({}, e, { n: Math.max(needN, Math.round(e.n * sc)) }) : Object.assign({}, e, { n: Math.max(1, Math.round(e.n * Math.sqrt(sc))) })));
      ksOpenEq(u, list, { mult: 1, oldest: KS_HIST_START - 84, newest: KS_HIST_START - 3, inLife: true });
      void first;
    }
    ksOpenAsset({ n: 'オフィスの内装・機材', acct: 'bldg', cost: Math.round(1500e4 * Math.sqrt(sc)), acqM: KS_HIST_START - 30, life: 15, u: u.id, part: 'S' });
    u.staff = { dev: Math.max(1, Math.round(P.dev * sc ** 0.6)), ops: Math.max(1, Math.round(P.ops * sc ** 0.6)) };
    op.mkt = Math.round(op.users * P.churn * P.cac * 1.1 / 1e4) * 1e4;
    const salesM = this.revenue(u, op.users, 1);
    if (P.b2b) ksAddAR(salesM, KS_HIST_START); else ksAddAR(salesM * 0.8, KS_HIST_START, 0.036);
    u.invB = {};
    return { cash: salesM * 1.1 * cond.cash, inv: {}, deposit: Math.round(1000e4 * Math.sqrt(sc)), loans: KS_LOANS_STD, capital: ksCapitalFor(salesM * 12), annual: salesM * 12 };
  },
  fresh(u) { u.op = this.newOp(u); u.op.users = 0; u.op.users0 = Math.max(100, Math.round(ksP(u).users * (u.sc || 1) * 0.3)); u.op.pot = u.op.users0 * 3; u.op.ramp = G.m; u.op.mkt = Math.round(u.op.users0 * ksP(u).cac * 0.08 / 1e4) * 1e4; u.staff = { dev: 0, ops: 0 }; u.invB = {}; },
  plan(u) {
    const S = ksS(u), P = ksP(u);
    const items = [];
    if (S.eq.length) {
      const n0 = Math.max(1, Math.ceil(u.op.users0 * 1.2 / Math.max(1, P.capPer)));
      items.push(...ksEqItems(u, [Object.assign({}, S.eq[0], { n: n0 })], { priceF: ksPrice(), numbered: true }));
      for (const e of S.eq.slice(1, 3)) items.push(...ksEqItems(u, [Object.assign({}, e, { n: 1 })], { priceF: ksPrice() }));
    }
    items.push({ n: 'オフィスの内装・機材', acct: 'bldg', cost: Math.round(800e4 * ksPrice()), life: 15, part: 'S', u: u.id });
    return { title: `${S.name}を始める`, desc: `設備をそろえ、広告で利用者を集めて始めます。利用者が増えるまでは赤字になりやすい事業です。${S.roles[0].n}と${S.roles[1].n}の採用も忘れずに。`, items, fx: 'unitStart', arg: { u: u.id } };
  },
  revenue(u, users, ecoF) {
    const op = u.op, P = ksP(u);
    return users * op.arpu + users * op.adRef * (ecoF ?? ksEcoF(1.2)) * ksPrice() + users * op.gmvRef * P.take * ksPrice();
  },
  need(u) {
    const P = ksP(u), op = u.op, sc = u.sc || 1;
    const g = Math.max(0.2, op.users / Math.max(1, op.users0));
    return { dev: Math.max(1, Math.round(P.dev * sc ** 0.6 * g ** 0.5)), ops: Math.max(1, Math.round(P.ops * sc ** 0.6 * g ** 0.85)) };
  },
  month(u, ctx) {
    const op = u.op, P = ksP(u);
    const cap = this.capacity(u);
    const nd = this.need(u);
    const devF = Math.min(1.2, (u.staff.dev || 0) / Math.max(1, nd.dev));
    const opsF = Math.min(1.2, (u.staff.ops || 0) / Math.max(1, nd.ops));
    op.quality = clamp(op.quality + 0.02 * ((op.content / Math.max(1, op.fixed0) - 1) * 0.6 + (devF - 1) * 0.8) - 0.01 * (op.quality - 1), 0.6, 1.4);
    const priceF = op.ref > 0 ? op.arpu / Math.max(1, op.ref * ksPrice()) : 1; // 月額のない（広告・手数料だけの）事業は1
    const trendM = P.trend / 12;
    const ramp = ksStartRamp(u);
    op.pot = (op.pot || op.users0 * 3) * (1 + trendM);
    const sat = this.satF(u);
    const paid = op.mkt / Math.max(100, P.cac * ksPrice() * priceF ** 0.7) * ksEcoF(0.3) * op.rep * ksUpF(u) * sat;
    const organic = op.users * Math.max(0, 0.001 + trendM * 0.35) * op.rep * op.quality * ramp * sat;
    const over = op.users > cap * 0.98;
    const churnR = clamp(P.churn * priceF ** 1.5 * (over ? 1.6 : 1) * (2 - op.quality) * (1 - P.trend * 0.5) * (opsF < 0.85 ? 1.15 : 1), 0.002, 0.4);
    const gain = Math.max(0, Math.round((paid + organic) * ksNoise(0.08)));
    const lost = Math.max(0, Math.round(op.users * churnR * ksNoise(0.05)));
    op.users = Math.max(0, Math.min(cap === Infinity ? Infinity : cap, op.users + gain - lost));
    const subRev = op.users * op.arpu;
    const adRev = op.users * op.adRef * ksEcoF(1.2) * ksPrice() * ctx.season * op.quality;
    const feeRev = op.users * op.gmvRef * P.take * ksEcoF(0.6) * ksPrice() * ctx.season;
    const sales = subRev + adRev + feeRev;
    if (P.b2b) ksSaleCredit(subRev + feeRev, 1);
    else { ksSaleCash(subRev * 0.2 + feeRev); ksSaleCredit(subRev * 0.8, 1, { card: true, fee: 0.036 }); }
    if (adRev) ksSaleCredit(adRev, 2);
    ksPayCash('svcExp', op.users * P.cpu * ksPrice() * (0.7 + 0.3 * ksEnF(u)), 'svcExp');
    // 運営費（制作・サポート・運用）は、利用者が増えるとある程度ふくらむ
    const growF = clamp((op.users / Math.max(1, op.users0)) ** 0.4, 0.6, 3);
    ksPayCash('svcExp', op.content * 0.5 * ksPrice() * growF, 'svcExp');
    ksBuyCredit('subcon', op.content * 0.5 * ksPrice() * growF, 1, 'subcon');
    ksPayCash('ads', op.mkt, 'ads');
    const capA = this.capEq(u);
    ksPayCash('repairs', sum(capA, a => a.cost) * 0.0015, 'repairs');
    const sc = Math.sqrt(u.sc || 1);
    ksPayRent(u, 80e4 * sc);
    ksPayCash('util', 8e4 * sc, 'expense');
    ksPayCash('fees', 15e4 * sc, 'fees');
    ksPayCash('misc', 8e4 * sc, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', sum(capA, a => a.cost) * 0.0035 + 5e4 * sc, 'dues');
    op.rep = clamp(op.rep + 0.01 * ((op.quality - 1) * 0.6 - (over ? 0.6 : 0) + (opsF < 0.85 ? -0.3 : 0.02)) - ksRepPull(op.rep), 0.7, 1.3);
    if (!G.hist && over && chance(0.25)) ksNews(`${ksUName(u)}：設備の能力の限界で、新しい利用者を受け入れられません（解約も増えます）。設備を増やしましょう`, 'bad');
    return { mgAdj: 0, kpi: { users: op.users, gain, lost, churnR, arpu: op.arpu, cap, util: cap === Infinity ? 0 : op.users / Math.max(1, cap), sales, subRev, adRev, feeRev, quality: op.quality, sat, pot: op.pot, cac: paid > 0 ? op.mkt / paid : 0 } };
  },
  auto(u) {
    const op = u.op, P = ksP(u);
    op.arpu = Math.round(op.ref * ksPrice());
    const nd = this.need(u);
    ksAutoStaff(u, 'dev', nd.dev); ksAutoStaff(u, 'ops', nd.ops);
    op.mkt = Math.round(op.users * P.churn * P.cac * ksPrice() / 1e4) * 1e4;
    const cap = this.capacity(u);
    const S = ksS(u);
    if (cap !== Infinity && op.users > cap * 0.9 && S.eq.length && G.m % 2 === 0) {
      // 能力の5%ずつ（少ないときは1台）。何台でも1つの記録にまとめる
      const n = Math.max(1, Math.round(cap / Math.max(1, P.capPer) * 0.05));
      const it = ksEqItems(u, [Object.assign({}, S.eq[0], { n })], { priceF: ksPrice(), rows: 1, start: ksEqN(ksUA(u).filter(a => a.eq === S.eq[0].k)) })[0];
      const a = ksNewAsset(Object.assign({}, it, { n: it.n }));
      ksPost('buyAsset', [[a.acct, a.cost, 0], ['cash', 0, a.cost]], { cf: 'capex' });
    }
  },
  stockCount() { return []; },
  afterCount() {},
  arTerms(u) { return ksP(u).b2b ? [[1, 0.9]] : [[1, 0.65], [2, 0.15]]; },
  // 月額・広告・手数料のすべての単価をそろえて動かす
  scale(u, k) { const op = u.op; if (op.ref > 0) { op.ref = Math.max(1, Math.round(op.ref * k)); op.arpu = Math.max(1, Math.round(op.arpu * k)); } op.adRef *= k; op.gmvRef *= k; },
  calib(u, target) {
    const op = u.op, P = ksP(u);
    const dep = ksUnitDep(u);
    const sc = Math.sqrt(u.sc || 1);
    const fixed = ksUnitFixedEst(u) + dep + op.content + op.mkt + sum(this.capEq(u), a => a.cost) * 0.0015 + (80e4 + 8e4 + 15e4 + 8e4) * sc;
    const varC = op.users * P.cpu;
    const nonSub = op.users * (op.adRef + op.gmvRef * P.take);
    // 月額の基準を合わせる（広告・手数料だけの事業は広告・手数料の単価を合わせる）
    const need = (fixed + varC) / Math.max(0.05, 1 - target - (P.b2b ? 0 : 0.03));
    if (op.ref > 0) { op.ref = op.arpu = Math.max(1, Math.round(clamp((need - nonSub) / Math.max(1, op.users), op.ref * 0.4, op.ref * 2.5))); }
    else if (nonSub > 0) { const k = clamp(need / nonSub, 0.4, 2.5); op.adRef *= k; op.gmvRef *= k; }
  },
};

/* =========================================================
 *  cap：施設を使ってもらう
 * ========================================================= */
KS_ENGINE.cap = {
  newOp(u) { const P = ksP(u); return { price: P.price, ref: P.price, rep: 1, ads: 0, occ0: P.occ, anc: P.anc, svc: 1 }; },
  facilities(u) { return ksUA(u).filter(a => ksEqOf(a).e === 'cap' && (a.cap || 0) > 0); },
  live(u) { return this.facilities(u).filter(a => !(a.openM > G.m)); },
  units(u) { return sum(this.live(u), a => a.cap); },
  premium(u) { return ksUA(u).reduce((m, a) => Math.max(m, ksEqOf(a).pr || 1), 1); },
  /* 耐用年数を過ぎた施設・機材の割合（取得価額の重み） */
  oldR(u) { const f = this.facilities(u); const tot = sum(f, a => a.cost); return tot ? sum(f.filter(a => a.life && G.m - a.acqM > a.life * 12), a => a.cost) / tot : 0; },
  daysF(u) { const P = ksP(u); return P.per === 'day' ? 30.4 : P.per === 'mwh' ? 730 : 1; },
  init(u, cond) {
    const P = ksP(u), S = ksS(u), sc = u.sc || 1;
    const op = u.op = this.newOp(u);
    const want = P.units * sc;
    const list = S.eq.map((e, i) => { const q = KS_EQ[e.k] || {}; if (i === 0 && (q.cap || 0) > 0) return Object.assign({}, e, { n: Math.max(1, Math.round(want / q.cap)) }); return Object.assign({}, e, { n: Math.max(1, Math.round(e.n * Math.sqrt(sc))) }); });
    ksOpenEq(u, list, { mult: 1, oldest: -180, newest: KS_HIST_START - 6, inLife: true });
    const units = this.units(u);
    u.staff = { staff: Math.max(1, Math.round(units * P.spu)), office: Math.max(1, Math.round(2 + units * P.spu * 0.08)) };
    op.ads = Math.round(this.revenueAt(u, P.occ) * 0.01 / 1e4) * 1e4;
    const salesM = this.revenueAt(u, P.occ);
    for (let k = 0; k < P.terms; k++) ksAddAR(salesM * P.ar, KS_HIST_START + k);
    u.invB = {};
    // ビル・倉庫など、売上に比べて施設の重い事業は、返済の期間の長い借入（25年・20年）で建ててきた
    const heavy = sum(ksUA(u), x => x.cost) > salesM * 12 * 3;
    return { cash: salesM * 1.2 * cond.cash, inv: {}, deposit: 0, loans: [{ bank: 'mirai', w: 1.4, termM: heavy ? 300 : 180, startM: KS_HIST_START - 30, rate: 1.6 }, { bank: 'koko', w: 1, termM: heavy ? 240 : 120, startM: KS_HIST_START - 12, rate: 1.4 }], capital: ksCapitalFor(salesM * 12), annual: salesM * 12 };
  },
  revenueAt(u, occ) { const op = u.op; const units = this.units(u); return units * occ * (op.price * this.daysF(u) + op.anc) ; },
  fresh(u) { u.op = this.newOp(u); u.op.ramp = G.m; u.staff = { staff: 0, office: 0 }; u.invB = {}; },
  plan(u) {
    const S = ksS(u), P = ksP(u);
    const q = KS_EQ[S.eq[0].k];
    const n0 = Math.max(1, Math.round(P.units * (u.sc || 1) * 0.3 / Math.max(1, q.cap)));
    const lead = q.a === 'bldg' ? 9 : 3;
    const items = ksEqItems(u, [Object.assign({}, S.eq[0], { n: n0 })], { priceF: ksPrice() }).map(x => Object.assign(x, { openM: G.m + lead }));
    for (const e of S.eq.slice(1, 3)) items.push(...ksEqItems(u, [Object.assign({}, e, { n: 1 })], { priceF: ksPrice() }).map(x => Object.assign(x, { openM: G.m + lead })));
    return { title: `${S.name}を始める`, desc: `施設をつくって始めます。完成まで${lead}か月（それまでは建設仮勘定で、減価償却はしません）。開業後、稼働が上がるまで1年ほど。スタッフの採用も忘れずに。`, items, fx: 'unitStart', arg: { u: u.id } };
  },
  need(u) { const P = ksP(u); const n = this.units(u); return { staff: n * P.spu, office: Math.max(1, Math.round(2 + n * P.spu * 0.08)) }; },
  month(u, ctx) {
    const op = u.op, P = ksP(u);
    const n = this.units(u);
    if (!n) return { mgAdj: 0, kpi: { units: 0, occ: 0, sales: 0 } };
    const nd = this.need(u);
    const staffF = Math.min(1, (u.staff.staff || 0) / Math.max(1, nd.staff));
    let occ, sales, off = 0;
    if (P.per === 'mwh') {
      // 原子力は、13か月ごとの定期検査と、規制・裁判による長い停止のあいだ発電しない
      off = P.nuke ? this.nukeOff(u) : 0;
      occ = off ? 0 : clamp(P.occ * ctx.season * ksNoise(P.nuke ? 0.02 : 0.08), 0.02, 0.97);
      // 市場で売る電気（elastic が大きい）は、燃料の値段につれて単価が動く
      const mkt = (0.75 + 0.25 * G.eco.matIdx) * (1 + (P.elastic || 0) * 0.5 * ((G.eco.oil || 1) - 1));
      // 基本料金（容量の対価）：発電しなくても、契約した相手から毎月受け取る
      sales = n * 730 * occ * op.price * mkt + (P.capPay ? n * P.capPay * ksPrice() : 0);
    } else {
      const adsF = 1 + 0.05 * (1 - Math.exp(-op.ads / Math.max(1e4, this.revenueAt(u, P.occ) * 0.015))) - 0.025;
      occ = clamp(op.occ0 * ctx.season * ksEcoF(P.per === 'day' ? 0.9 : 0.4) * (op.price / Math.max(1, op.ref * ksPrice())) ** (-P.elastic) * op.rep * adsF * this.premium(u) * ksUpF(u) * ksStartRamp(u) * ksNoise(0.03), 0.03, 0.97);
      if (staffF < 1) occ *= staffF ** 0.7;
      occ *= 1 - 0.12 * this.oldR(u); // 耐用年数を過ぎた古い施設・機材は選ばれにくい
      sales = n * occ * (op.price * this.daysF(u) + op.anc * ksPrice());
    }
    const occupied = n * occ;
    const ar = sales * P.ar;
    ksSaleCash(sales - ar);
    if (ar > 0) ksSaleCredit(ar, P.terms);
    // 変動費：稼働した単位ごと（清掃・アメニティ・食材など）。発電は1MWhあたりの燃料費など（燃料が油・ガスなら原油の値段につれて動く）
    const fuelF = P.fuel === 'oil' ? (G.eco.oil || 1) : 1;
    const varCost = P.per === 'mwh' ? n * 730 * occ * P.var * fuelF : occupied * P.var;
    ksPayCash(P.per === 'mwh' && P.fuel ? 'fuel' : 'svcExp', varCost * ksPrice(), P.per === 'mwh' && P.fuel ? 'purchPay' : 'svcExp');
    // 発電量に比例するそのほかの負担（使用済燃料の再処理などの拠出金）と、設備の大きさに比例する固定の運転・保守の委託費
    if (P.levy) ksPayCash('svcExp', n * 730 * occ * P.levy, 'svcExp');
    if (P.om) ksPayCash('subcon', n * P.om * ksPrice(), 'purchPay');
    if (P.kwh) ksPayCash('util', n * P.kwh * (P.per === 'month' ? (0.35 + 0.65 * occ) : 1) * 24 * ksPrice() * ksEnF(u), 'expense');
    const fac = this.facilities(u);
    const costAll = sum(fac, a => a.cost);
    ksPayCash('repairs', costAll * 0.001 * ksPrice() * (1 + this.oldR(u)), 'repairs');
    // 定期検査の月は、点検・部品の交換の費用がかさむ
    if (off === 1 && u.op.offWhy === 'insp') ksPayCash('repairs', costAll * 0.004 * ksPrice(), 'repairs');
    ksPayCash('insur', costAll * 0.0003, 'expense');
    ksPayCash('ads', op.ads, 'ads');
    const sc = Math.sqrt(u.sc || 1);
    ksPayCash('fees', 10e4 * sc + sales * 0.004, 'fees');
    ksPayCash('misc', 8e4 * sc, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', costAll * 0.0035, 'dues');
    const ageY = fac.length ? sum(fac, a => (G.m - a.acqM) / 12 * ksEqQ(a)) / ksEqN(fac) : 0;
    op.rep = clamp(op.rep + 0.01 * ((staffF - 1) * 1.5 - (ageY > 20 ? 0.3 : 0)) - ksRepPull(op.rep), 0.7, 1.3);
    return { mgAdj: 0, kpi: { units: n, occ, occupied, price: op.price, sales, revPer: sales / Math.max(1, n), staffF, ageY, off: off ? (op.offWhy || 'insp') : '', nextInsp: P.nuke ? op.inspAt : undefined, stopUntil: op.stopUntil } };
  },
  /* 原子力の停止：定期検査（13か月ごとに2か月）と、規制委員会の審査・裁判所の仮処分による長い停止（めったにない） */
  nukeOff(u) {
    const op = u.op;
    if (op.inspAt === undefined) op.inspAt = G.m + randInt(1, 13);
    if (op.stopUntil > G.m) { op.offWhy = 'stop'; return 1; }
    if (op.stopUntil !== undefined && op.stopUntil <= G.m) { op.stopUntil = undefined; ksNews(`${ksUName(u)}：止めていた原子炉の運転を再開しました`, 'good'); }
    if (!G.hist && chance(0.002)) {
      const why = pick([['原子力規制委員会の検査で安全上の不備を指摘され、対策が終わるまで', 'stop'], ['地元の住民が申し立てた運転差止めの仮処分を裁判所が認め、', 'stop']]);
      op.stopUntil = G.m + randInt(6, 15);
      op.offWhy = why[1];
      ksNews(`${ksUName(u)}：${why[0]}原子炉を止めます（${op.stopUntil - G.m}か月ほど）。発電しなくても、人件費・減価償却費・維持費はかかります`, 'bad');
      return 1;
    }
    while (G.m >= op.inspAt + 2) op.inspAt += 13;
    if (G.m >= op.inspAt) { op.offWhy = 'insp'; return 1; }
    op.offWhy = '';
    return 0;
  },
  auto(u) { const op = u.op; op.price = Math.round(op.ref * ksPrice()); const nd = this.need(u); ksAutoStaff(u, 'staff', nd.staff); ksAutoStaff(u, 'office', nd.office); },
  stockCount() { return []; },
  afterCount() {},
  arTerms(u) { const P = ksP(u); return [[P.terms, P.ar]]; },
  scale(u, k) { const op = u.op; op.ref = Math.max(1, Math.round(op.ref * k)); op.price = Math.max(1, Math.round(op.price * k)); op.anc = (op.anc || 0) * k; },
  calib(u, target) {
    const op = u.op, P = ksP(u);
    const n = this.units(u);
    const costAll = sum(this.facilities(u), a => a.cost);
    const sc = Math.sqrt(u.sc || 1);
    const fixed = ksUnitFixedEst(u) + ksUnitDep(u) + costAll * (0.001 + 0.0003 + 0.0035 / 3) + op.ads + (10e4 + 8e4) * sc;
    const occ = P.occ;
    const varC = P.per === 'mwh' ? n * 730 * occ * ((P.var || 0) + (P.levy || 0)) + n * (P.om || 0) : n * occ * P.var + (P.kwh ? n * P.kwh * 24 * (P.per === 'month' ? 0.35 + 0.65 * occ : 1) : 0);
    const need = (fixed + varC - (P.capPay ? n * P.capPay : 0)) / Math.max(0.05, 1 - target - 0.004);
    const unitRev = n * occ * this.daysF(u) * (P.per === 'mwh' ? 1 : 1);
    const ancRev = n * occ * op.anc;
    op.ref = op.price = Math.max(1, Math.round(clamp((need - ancRev) / Math.max(1, unitRev), op.ref * 0.4, op.ref * 2.5)));
  },
};

/* =========================================================
 *  trans：人や物を運ぶ
 * ========================================================= */
/* 燃料サーチャージで燃料の値動きを運賃に転嫁できる割合（輸送の種類ごと） */
const KS_SURCHARGE = { sea: 0.8, air: 0.8, truck: 0.5, rail: 0.15, bus: 0.15, taxi: 0.1 };
KS_ENGINE.trans = {
  newOp(u) { const P = ksP(u); return { fare: 1, yield: 0, rep: 1, ads: 0, hedge: 0, oilLock: G.eco.oil || 1, lf0: P.lf }; },
  fleetAll(u) { return ksUA(u).filter(a => ksEqOf(a).e === 'trans'); },
  fleet(u) { return this.fleetAll(u).filter(a => !(a.openM > G.m)); },
  // まとめた記録（q 台分）は、カタログの1台分の値に q を掛ける
  capOf(u) { return sum(this.fleet(u), a => (ksEqOf(a).cap || 0) * ksEqQ(a)); },
  crewNeed(u) { const P = ksP(u); return sum(this.fleet(u), a => (ksEqOf(a).crew || 0) * ksEqQ(a)) * Math.min(1, P.util * 1.1) * 1.05; },
  init(u, cond) {
    const P = ksP(u), S = ksS(u), sc = u.sc || 1;
    const op = u.op = this.newOp(u);
    const life = (KS_EQ[S.eq[0].k] || {}).l || 10;
    ksOpenEq(u, S.eq, { mult: sc, oldest: KS_HIST_START - Math.round(life * 12 * 0.8), newest: KS_HIST_START - 4 });
    const fleetV = sum(this.fleetAll(u), a => a.cost);
    if (P.infraAssets) ksOpenAsset({ n: { rail: '線路・駅・変電所', air: '格納庫・整備施設', sea: '岸壁の施設・事務所' }[P.mode] || '営業所・車庫', acct: 'bldg', cost: Math.round(P.infraAssets * sc ** 0.8), acqM: -300, life: 40, part: 'C', u: u.id });
    else ksOpenAsset({ n: { air: '格納庫・事務所', sea: '事務所', rail: '車庫・駅舎' }[P.mode] || '営業所・車庫', acct: 'bldg', cost: Math.round(Math.max(1500e4, fleetV * 0.05)), acqM: -160, life: 31, part: 'C', u: u.id });
    const nF = ksEqN(this.fleetAll(u));
    u.staff = { crew: Math.max(1, Math.round(this.crewNeed(u))), ops: Math.max(1, Math.round(nF * P.ops)), office: Math.max(1, Math.round(2 + nF * 0.08)) };
    op.yield = u.lv && u.lv.yield ? u.lv.yield : this.yieldGuess(u);
    op.ads = Math.round(this.revenueAt(u, P.lf) * 0.004 / 1e4) * 1e4;
    const salesM = this.revenueAt(u, P.lf);
    for (let k = 0; k < P.terms; k++) ksAddAR(salesM * P.ar, KS_HIST_START + k);
    u.invB = {};
    return { cash: salesM * 1.0 * cond.cash, inv: {}, deposit: 0, loans: [{ bank: 'mirai', w: 1.3, termM: 120, startM: KS_HIST_START - 20, rate: 1.7 }, { bank: 'koko', w: 1, termM: 120, startM: KS_HIST_START - 10, rate: 1.4 }, { bank: 'shinkin', w: 0.4, termM: 84, startM: KS_HIST_START - 6, rate: 2.0 }], capital: ksCapitalFor(salesM * 12), annual: salesM * 12 };
  },
  /* 輸送力1単位・1か月（満載・稼働のとき）の運賃収入の初期値（後でキャリブレーションで合わせる） */
  yieldGuess(u) {
    const fl = this.fleetAll(u);
    const capT = sum(fl, a => (ksEqOf(a).cap || 0) * ksEqQ(a)) || 1;
    const costM = sum(fl, a => ((ksEqOf(a).fuel || 0) + (ksEqOf(a).mt || 0)) * ksEqQ(a) + a.cost / (a.life || 10) / 12) + ksUnitFixedEst(u);
    return costM * 1.25 / capT / ksP(u).lf;
  },
  revenueAt(u, lf, fl) { const P = ksP(u); return this.capOf(u) * P.util * lf * u.op.yield * u.op.fare * (fl ?? 1); },
  fresh(u) { u.op = this.newOp(u); u.op.ramp = G.m; u.staff = { crew: 0, ops: 0, office: 0 }; u.invB = {}; },
  plan(u) {
    const S = ksS(u), P = ksP(u);
    const q = KS_EQ[S.eq[0].k];
    const lead = q.c >= 30e8 ? 12 : q.c >= 5e8 ? 6 : 1;
    const n0 = Math.max(1, Math.round(S.eq[0].n * (u.sc || 1) * 0.3));
    const items = ksEqItems(u, [Object.assign({}, S.eq[0], { n: n0 })], { priceF: ksPrice(), numbered: true }).map(x => Object.assign(x, { openM: G.m + lead }));
    items.push({ n: '営業所・車庫', acct: 'bldg', cost: Math.round(Math.max(1000e4, sum(items, x => x.cost) * 0.03)), life: 31, part: 'C', u: u.id });
    if (!u.op.yield) {
      // まだ車両がないので、カタログの車両で単価の目安を決める
      const capT = sum(items, x => (KS_EQ[x.eq] || {}).cap || 0) || 1;
      const costM = sum(items, x => ((KS_EQ[x.eq] || {}).fuel || 0) + ((KS_EQ[x.eq] || {}).mt || 0) + x.cost / (x.life || 10) / 12 + ((KS_EQ[x.eq] || {}).crew || 0) * P.crewWage * 1.3);
      u.op.yield = costM * 1.3 / capT / P.lf;
    }
    return { title: `${S.name}を始める`, desc: `${q.n}を${fmtNum(n0, 0)}${ksEqWord(S.eq[0].k)}そろえて始めます。納入まで${lead}か月（それまでは建設仮勘定）。${S.roles[0].n}の採用と、許可の取得も忘れずに。`, items, fx: 'unitStart', arg: { u: u.id } };
  },
  need(u) { const P = ksP(u); const nF = ksEqN(this.fleet(u)); return { crew: this.crewNeed(u), ops: nF * P.ops, office: Math.max(1, Math.round(2 + nF * 0.08)) }; },
  month(u, ctx) {
    const op = u.op, P = ksP(u), e = G.eco;
    const fl = this.fleet(u);
    if (!fl.length) return { mgAdj: 0, kpi: { n: 0, sales: 0 } };
    const nd = this.need(u);
    const crewF = Math.min(1, (u.staff.crew || 0) / Math.max(1, nd.crew));
    const opsF = Math.min(1, (u.staff.ops || 0) / Math.max(1, nd.ops));
    const nFl = ksEqN(fl);
    const ageF = sum(fl, a => (G.m - a.acqM) / 12 / (a.life || 10) * ksEqQ(a)) / nFl;
    const availF = crewF * (0.9 + 0.1 * opsF) * (ageF > 1.4 ? 0.95 : 1);
    const market = P.market > 0.1 ? (e.ship || 1) : 1;
    const adsF = 1 + 0.03 * (1 - Math.exp(-op.ads / Math.max(1e4, this.revenueAt(u, P.lf) * 0.006))) - 0.015;
    const lf = clamp(op.lf0 * ctx.season * ksEcoF(P.mode === 'rail' ? 0.3 : 0.8) * op.fare ** (-1.1) * op.rep * adsF * ksUpF(u) * ksStartRamp(u) * (P.market > 0.1 ? market ** 0.4 : 1) * ksNoise(0.03), 0.12, 0.98);
    const capU = this.capOf(u) * P.util * availF;
    const base = capU * lf * op.yield * op.fare * ksPrice() * (P.market > 0.1 ? market ** 0.6 : 1);
    // 燃料サーチャージ：燃料の値上がり（値下がり）の一部を運賃に上乗せする（貨物・航空は多く、鉄道・バス・タクシーは少ない）
    const fuel1 = sum(fl, a => (ksEqOf(a).fuel || 0) * ksEqQ(a)) * P.util * availF * (0.75 + 0.25 * lf / Math.max(0.1, op.lf0)) * ksFuelF(u);
    const sur = Math.round(fuel1 * ((e.oil || 1) - 1) * (KS_SURCHARGE[P.mode] ?? 0.4));
    const sales = Math.max(0, base + sur);
    const ar = sales * P.ar;
    ksSaleCash(sales - ar);
    if (ar > 0) ksSaleCredit(ar, P.terms);
    const oil = op.hedge * op.oilLock + (1 - op.hedge) * (e.oil || 1);
    const fuel = fuel1 * oil;
    ksPayCash('fuel', fuel, 'fuel');
    const maint = sum(fl, a => (ksEqOf(a).mt || 0) * ksEqQ(a) * (1 + Math.max(0, (G.m - a.acqM) / 12 / (a.life || 10) - 0.8))) * ksPrice();
    ksPayCash('svcExp', maint + P.fees * nFl * ksPrice() + P.infra * ksPrice(), 'svcExp');
    ksPayCash('insur', sum(fl, a => a.cost) * 0.0006, 'expense');
    ksPayCash('ads', op.ads, 'ads');
    const sc = Math.sqrt(u.sc || 1);
    ksPayCash('fees', 10e4 * sc + sales * 0.003, 'fees');
    ksPayCash('misc', 8e4 * sc, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', sum(fl, a => a.cost) * 0.0025, 'dues');
    op.rep = clamp(op.rep + 0.01 * ((crewF - 1) * 2 + (opsF - 1)) - ksRepPull(op.rep), 0.7, 1.25);
    if (!G.hist && crewF < 0.9 && chance(0.3)) ksNews(`${ksUName(u)}：${ksS(u).roles[0].n}が足りず、運休・減便が出ています`, 'bad');
    return { mgAdj: 0, kpi: { n: nFl, cap: capU, lf, sales, sur, fuel, fuelR: fuel / Math.max(1, sales), crewF, yield: op.yield * op.fare * ksPrice(), market, oil: e.oil || 1 } };
  },
  auto(u) { const nd = this.need(u); ksAutoStaff(u, 'crew', nd.crew); ksAutoStaff(u, 'ops', nd.ops); ksAutoStaff(u, 'office', nd.office); u.op.fare = 1; },
  stockCount() { return []; },
  afterCount() {},
  arTerms(u) { const P = ksP(u); return [[P.terms, P.ar]]; },
  scale(u, k) { u.op.yield *= k; },
  calib(u, target) {
    const op = u.op, P = ksP(u);
    const fl = this.fleetAll(u);
    const sc = Math.sqrt(u.sc || 1);
    const fixed = ksUnitFixedEst(u) + ksUnitDep(u) + sum(fl, a => ((ksEqOf(a).fuel || 0) * P.util + (ksEqOf(a).mt || 0) * 1.1) * ksEqQ(a)) + P.fees * ksEqN(fl) + P.infra + sum(fl, a => a.cost) * (0.0006 + 0.0025 / 3) + op.ads + (10e4 + 8e4) * sc;
    const capU = this.capOf(u) * P.util;
    const need = fixed / Math.max(0.05, 1 - target - 0.003);
    op.yield = need / Math.max(1, capU * P.lf);
  },
};

/* エンジンの newOp のあとに、合わせた基準の単価を当てる（u.lv があるときだけ） */
for (const E of Object.values(KS_ENGINE)) {
  const orig = E.newOp;
  if (typeof orig !== 'function') continue;
  E.newOp = function (u) { const op = orig.call(this, u); return u && u.lv ? Object.assign(op, u.lv) : op; };
}
