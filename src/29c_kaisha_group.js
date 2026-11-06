'use strict';
/* =========================================================
 *  29c_kaisha_group.js : 企業グループ（子会社・合弁・持株会社）と連結決算
 *   ・子会社は、親会社と同じ形の「会社の状態」（G と同じ形）を持ち、月ごとに G を差し替えて動かす
 *   ・つくり方：設立（新しい事業）／分社化（会社分割で事業を移す）／株式の取得（買収）／持株会社体制への移行
 *   ・親子の取引：出資・増資、貸付と利息、経営指導料、配当（親会社の受取配当金は益金不算入）
 *   ・連結決算：合算 → 投資と資本の相殺消去（のれん・非支配株主持分）→ 内部取引・債権債務の消去
 *     → 海外子会社の換算（為替換算調整勘定）。連結精算表で1行ずつ確かめられる
 *   （画面は 29g_kaisha_group_ui.js）
 * ========================================================= */

/* ---------- 会社の形 ---------- */
const KS_FORMS = {
  kk: { n: '株式会社', pre: '株式会社', agm: true, kokoku: true, ipo: true,
    desc: '株主が出資し、取締役が経営する会社。株主総会で決算を承認し、決算公告をする。役員の任期（取締役2年、非公開会社は定款で10年まで）ごとに変更登記が要る。上場できるのは株式会社だけ。' },
  gk: { n: '合同会社', pre: '合同会社', agm: false, kokoku: false, ipo: false,
    desc: '出資した社員が自分で経営する会社（持分会社）。株主総会も決算公告も役員の任期もなく、設立と運営が安い。上場はできないので、上場するには株式会社への組織変更（債権者保護手続に1か月）が要る。' },
  yk: { n: '特例有限会社', pre: '有限会社', agm: true, kokoku: false, ipo: false,
    desc: '2006年の会社法の施行の前からある有限会社（今は新しくつくれない）。株主総会はあるが、決算公告の義務も役員の任期もない。取締役会を置けず上場もできないので、商号を株式会社に変えて移行する。' },
};
function ksForm(st = G) { return (st && st.form) || 'kk'; }
function ksFormName(st = G) { return KS_FORMS[ksForm(st)].n; }

/* ---------- いま見ている会社と、グループの親会社 ---------- */
let KS_ROOT = null; // 子会社の画面に入っているあいだの、親会社の状態
function ksRoot() { return KS_ROOT || G; }
function ksIsSubView() { return !!KS_ROOT; }
/* G を差し替えて関数を実行する（子会社の月次・仕訳など） */
function ksWith(st, fn) { const sv = G; G = st; try { return fn(); } finally { G = sv; } }
function ksSubs(root = ksRoot()) { return root && root.group ? root.group.subs.filter(s => !s.gone) : []; }
function ksSubAll(root = ksRoot()) { return root && root.group ? root.group.subs : []; }
function ksSubById(id, root = ksRoot()) { return ksSubAll(root).find(s => s.id === id) || null; }
function ksGroupOn(root = ksRoot()) { return ksSubs(root).length > 0; }
/* 純粋持株会社（自分の事業がなく、子会社の株式を持って経営を指導する） */
function ksIsPureHD(st = G) { return !!(st && st.group && st.group.hd && !(st.units || []).some(u => !u.closedM)); }
function ksGroupInit() {
  if (G.group) return;
  G.group = { subs: [], seq: 0, cons: {}, ic: {}, divFY: {}, fx: {}, hd: false, hq: null, policy: { support: true, sweep: false }, log: [] };
}
/* 子会社の画面に入る（id なしで親会社に戻る） */
function ksViewEntity(id) {
  const root = ksRoot();
  if (!id || id === 'root') { G = root; KS_ROOT = null; return true; }
  const s = ksSubById(id, root);
  if (!s || s.gone) return false;
  KS_ROOT = root;
  G = s.st;
  return true;
}

/* ---------- 為替（海外子会社の換算） ---------- */
/* 子会社の帳簿は「設立のときのレートで円に直した現地通貨」で記帳する（k = 今のレート ÷ 設立のときのレート） */
function ksCurOf(cc) { return (typeof KS_COUNTRIES !== 'undefined' && KS_COUNTRIES[cc] && KS_COUNTRIES[cc].cur) || 'usd'; }
function ksFxNow(cur, eco = G.eco) { return cur === 'eur' ? eco.eur || 160 : eco.fx || 148; }
function ksSubK(s, m) {
  if (!s.cc || s.cc === 'jp') return 1;
  const root = ksRoot();
  const fxm = (root.group.fx || {})[m];
  const now = fxm ? (ksCurOf(s.cc) === 'eur' ? fxm.eur : fxm.usd) : ksFxNow(ksCurOf(s.cc), root.eco);
  return now / (s.fx0 || now);
}

/* ---------- 新しい会社（設立）の状態をつくる ---------- */
/* o: { coName, ceo, cash, capital, seed, cc, pref, form, execPay, wageLv, subId } */
function ksFreshCompany(o) {
  const root = o.root ? null : ksRoot();
  const m = o.m ?? root.m;
  const { y } = ymOf(m);
  const st = {
    mode: 'kaisha', version: KS_SAVE_VERSION, rs: o.seed | 0, seed: o.seed | 0, ind: null, cond: 'good',
    coName: o.coName, ceo: o.ceo || `${pick(['佐藤', '鈴木', '高橋', '田中', '渡辺', '伊藤', '山本', '中村'])} ${pick(['誠', '健一', '直樹', '恵子', '美咲', '大輔', '浩二', '裕子'])}`,
    m, seq: 0, hist: false, units: [], useq: 0, curU: null,
    bal: Object.fromEntries(KS_KEYS.map(k => [k, 0])), flow: {}, flowC: {}, flowU: {}, flowCU: {}, cfm: {}, jcur: {}, journal: [], months: [],
    fys: {}, ar: [], ap: [], assets: [], loans: [], op: {},
    eco: JSON.parse(JSON.stringify(o.eco || root.eco)),
    grade: 6, gradeHist: [], banks: { mirai: { rel: 50 }, shinkin: { rel: 45 }, koko: { rel: 40 } }, repT: KS_COND.normal.rep,
    budget: null, closing: null, lossCF: 0, wfPrev: { labor: 0, salary: 0 }, wfPrevU: {}, reversal: null, execPay: o.execPay || 60e4,
    news: [], pendingModals: [], over: null, termYears: 0, quiz: { asked: 0, correct: 0 },
    flags: {}, depShort: 0, lossRate: KS_LOSS_RATE, firstPeriod: 1 - fyOf(m), founded: y, supTrust: 3, wageLv: o.wageLv || (root && root.wageLv) || 1, bonusLv: (root && root.bonusLv) || 1,
    isSub: !o.root, subId: o.subId, parentName: root ? root.coName : '', country: o.cc || 'jp', form: o.form || 'kk', startedM: m, monthStartCash: 0,
  };
  if (o.root) { st.termYears = o.term ?? KS_TERM_YEARS; st.cond = o.cond || 'normal'; }
  ksWith(st, () => {
    const cash = Math.round(o.cash || 0), cap = Math.round(Math.min(o.capital ?? cash, cash));
    if (cash > 0) ksPost('estab', [['cash', cash, 0], ['capital', 0, cap], ['capSurplus', 0, cash - cap]], { u: 'HQ', cf: 'equity', desc: '設立（出資の払込み）' });
    G.monthStartCash = ksB('cash');
    G.openingFS = ksOpeningFS();
    ksSetODLimit();
    if (typeof ksLawInit === 'function') ksLawInit();
    if (typeof ksGrowInit === 'function') ksGrowInit();
    if (typeof ksExtInit === 'function' && !o.root) ksExtInit({ sub: true, pref: o.pref, cc: o.cc });
    ksBudgetDraft();
    ksBudgetApprove(true);
  });
  return st;
}
/* 子会社の名前の案 */
function ksCityBase() { return typeof CITY_NAME !== 'undefined' ? CITY_NAME.replace(/市$/, '') : '汐見'; }
function ksSubNameFor(type, cc) {
  const S = KS_TYPES[type];
  const c = S ? KS_CO_CORE[S.eng] : null;
  const base = c ? pick(c.filter(x => x !== 'ホールディングス')) : '産業';
  if (cc && cc !== 'jp' && typeof KS_COUNTRIES !== 'undefined' && KS_COUNTRIES[cc]) return `${ksCityBase()}${base}${KS_COUNTRIES[cc].n}`;
  return `${ksCityBase()}${base}株式会社`;
}
/* 新しい事業を子会社の中で始める（G は子会社）。立ち上げの設備を買い、事業を加える */
function ksSubStartUnit(type, sc) {
  const S = KS_TYPES[type];
  const E = KS_ENGINE[S.eng];
  const u = { id: 'U' + (G.useq + 1), type, n: null, sc: +sc || 1, op: {}, staff: {}, invB: {}, kpi: {}, startM: G.m };
  E.fresh(u);
  ksCalibFresh(u);
  const pl = E.plan(u);
  G.useq = Math.max(G.useq, +u.id.slice(1));
  G.units.push(u);
  if (pl.fx === 'shopStore' && pl.arg && pl.arg.s) u.op.stores.push(Object.assign({}, pl.arg.s));
  if (pl.fx === 'restShop' && pl.arg && pl.arg.s) u.op.shops.push(Object.assign({}, pl.arg.s));
  if (typeof ksLawAddUnit === 'function') ksLawAddUnit(u);
  pl.items.forEach((x, i) => ksBuyAsset(Object.assign({}, x, { u: u.id }, i === 0 && pl.deposit ? { deposit: pl.deposit } : {})));
  if (!pl.items.length && pl.deposit) { ksPost('deposit', [['deposit', pl.deposit, 0], ['cash', 0, pl.deposit]], { cf: 'capex', u: u.id }); u.dep = (u.dep || 0) + pl.deposit; }
  return { u, cost: sum(pl.items, x => x.cost) + (pl.deposit || 0) };
}
/* 新しい事業の立ち上げに要るお金の見込み（親会社の側で下書きをつくって計る） */
function ksSubStartPlan(type, sc) {
  const S = KS_TYPES[type];
  if (!S) return null;
  const snap = { rs: G.rs, seq: G.seq, nA: G.assets.length };
  const u = { id: 'Ux', type, n: null, sc: +sc || 1, op: {}, staff: {}, invB: {}, kpi: {}, startM: G.m };
  try {
    KS_ENGINE[S.eng].fresh(u);
    ksCalibFresh(u);
    const pl = KS_ENGINE[S.eng].plan(u);
    const capex = sum(pl.items, x => x.cost) + (pl.deposit || 0);
    // 立ち上げから軌道に乗るまでの運転資金（人件費と固定費の6か月分の目安）
    const head = S.roles.reduce((s, r) => s + Math.max(1, Math.round(((u.staff || {})[r.id] || 0))), 0);
    const work = Math.max(capex * 0.35, head * 40e4 * 6, 2e7);
    return { capex: Math.round(capex), work: Math.round(work), need: niceAmount(capex + work), title: pl.title, items: pl.items.length };
  } catch (e) { console.error(e); return null; }
  finally { G.rs = snap.rs; G.seq = snap.seq; G.assets.length = snap.nA; }
}

/* ---------- 子会社を設立する ---------- */
/* o: { type, sc, own (0.5〜1), cash（親会社の出資額）, capital, name, cc, pref } */
function ksGroupFound(o) {
  ksGroupInit();
  const root = G;
  const g = root.group;
  const own = clamp(+o.own || 1, 0.51, 1);
  const invest = Math.round(o.cash);
  if (invest <= 0 || ksB('cash') < invest) return { ok: false, why: '出資するお金が足りません' };
  const total = Math.round(invest / own); // 合弁なら、相手の会社も持分に応じて出資する
  const id = 'S' + (++g.seq);
  const cc = o.cc || 'jp';
  const fx0 = cc === 'jp' ? 1 : ksFxNow(ksCurOf(cc), root.eco);
  // 海外子会社の帳簿は、設立のときのレートで円に直した現地通貨で記帳する（同じ額なので換算の差は出ない）
  const st = ksFreshCompany({ coName: o.name || ksSubNameFor(o.type, cc), cash: total, capital: Math.min(o.capital || total, total), seed: (root.rs ^ (g.seq * 40503)) | 0, cc, pref: o.pref, subId: id, execPay: clamp(Math.round(o.cash / 400 / 1e4) * 1e4, 40e4, 150e4) });
  let unit = null;
  if (o.type) ksWith(st, () => { unit = ksSubStartUnit(o.type, o.sc).u; });
  ksPost('subFound', [['subShares', invest, 0], ['cash', 0, invest]], { u: 'HQ', cf: 'capex', desc: `子会社の設立（${st.coName}）への出資` });
  const s = { id, st, own, kind: own < 1 ? 'jv' : 'new', since: root.m, eq0: total, adds: 0, reTr: 0, gw: 0, gwCum: 0, cc, fx0, fee: own < 1 ? 0 : 0.01, payout: 0.3, auto: true, name: st.coName, partner: own < 1 ? (o.partner || `${pick(CO_PREFIX)}${pick(['商事', '物産', '産業'])}`) : null };
  g.subs.push(s);
  ksNews(`${st.coName}を設立しました（出資 ${fmtYen(invest)}${own < 1 ? `・持分${Math.round(own * 100)}%、残りは${s.partner}が出資する合弁会社` : '・100%子会社'}）${unit ? `。${ksS(unit).name}を始めます` : ''}`, 'good');
  return { ok: true, s };
}

/* ---------- 分社化（新設分割）：事業を子会社に移す ---------- */
/* 移す中身の見込み（帳簿価額） */
function ksGroupSplitPreview(uid) {
  const u = ksUnit(uid);
  if (!u || u.closedM) return null;
  const E = KS_ENGINE[ksS(u).eng];
  const A = G.assets.filter(a => a.u === uid && a.soldM === undefined);
  const bv = sum(A, a => a.cost - a.booked);
  const inv = sum(E.stockCount(u) || [], it => it.book);
  const proj = ksS(u).eng === 'build' ? u.op.projects.filter(p => !p.fin) : [];
  const cwip = sum(proj, p => p.costToDate), adv = sum(proj, p => p.recv);
  const ar = sum(G.ar.filter(x => x.u === uid), x => x.amt);
  const dep = u.dep || 0;
  const net = bv + inv + cwip - adv + ar + dep;
  const fixedM = sum(ksS(u).roles, r => (u.staff[r.id] || 0) * ksRoleWage(r, u)) * 1.2 + 50e4;
  const cashS = niceAmount(Math.max(fixedM * 3, 1e7, -net + 1e7));
  return { u, nA: A.length, bv: Math.round(bv), inv: Math.round(inv), cwip: Math.round(cwip), adv: Math.round(adv), ar: Math.round(ar), dep, net: Math.round(net), head: ksUnitHead(u), cashS };
}
/* 事業の掛けの仕入の割合（最近2か月）：買掛金を分けるときに使う */
function ksUnitPurchShare(uid) {
  const ms = G.months.slice(-2);
  const f = (x, id) => { const o = ((x.flowU || {})[id]) || {}; return (o.purch || 0) + (o.matPurch || 0); };
  const all = sum(ms, x => sum(Object.keys(x.flowU || {}), id => f(x, id)));
  return all > 0 ? clamp(sum(ms, x => f(x, uid)) / all, 0, 1) : 0;
}
/* o: { name, cash（一緒に移す現預金）, capital, apShare（移す買掛金の割合）, loanFrac（移す借入金の割合） } */
function ksGroupSplit(uid, o = {}) {
  ksGroupInit();
  const root = G, g = root.group;
  const u = ksUnit(uid);
  if (!u || u.closedM) return { ok: false, why: '事業がありません' };
  if (root.closing) return { ok: false, why: '決算整理の途中です' };
  const cash = Math.round(o.cash || 0);
  if (ksB('cash') < cash) return { ok: false, why: '移す現預金が足りません' };
  const S = ksS(u), E = KS_ENGINE[S.eng];
  const fy = fyOf(G.m);
  G.curU = uid;
  // 1) 移す資産の今期の償却（先月までの分）を親会社で計上する
  const A = G.assets.filter(a => a.u === uid && a.soldM === undefined);
  for (const a of A) {
    if (a.cip || !a.life || a.acct === 'land') continue;
    const months = Math.max(0, G.m - Math.max(fy * 12, a.acqM, a.depFrom ?? fy * 12));
    const d = Math.max(0, Math.min(Math.round(a.cost / a.life * months / 12), a.cost - 1 - a.booked));
    if (d > 0) { ksPost('cDep', [[a.acct === 'goodwill' ? 'gwAmort' : a.part === 'C' ? 'depC' : 'depS', d, 0], [KS_DIRECT[a.acct] ? a.acct : 'accDep', 0, d]], { desc: `分割で移す資産の期中の減価償却（${a.n}）`, u: uid, key: a.id }); a.booked += d; }
  }
  // 2) 親会社の仕訳：移す資産・在庫・工事・売掛金・保証金・現預金 → 関係会社株式
  const lines = [];
  const add = (k, d, c) => { if (d || c) lines.push([k, Math.round(d || 0), Math.round(c || 0)]); };
  const subLines = [];
  const addS = (k, d, c) => { if (d || c) subLines.push([k, Math.round(d || 0), Math.round(c || 0)]); };
  let net = 0;
  const moved = [];
  for (const a of A) {
    const bv = a.cost - a.booked;
    if (a.cip) { add('cip', 0, a.cost); addS('cip', a.cost, 0); net += a.cost; }
    else if (KS_DIRECT[a.acct]) { add(a.acct, 0, bv); addS(a.acct, bv, 0); net += bv; }
    else { add(a.acct, 0, a.cost); addS(a.acct, a.cost, 0); if (a.acct !== 'land' && a.booked) { add('accDep', a.booked, 0); addS('accDep', 0, a.booked); } net += a.acct === 'land' ? a.cost : bv; }
    moved.push(a);
  }
  // 在庫（三分法：期首の在庫を仕入に戻し、今の帳簿の在庫を他勘定に振り替えて移す）
  const invItems = E.stockCount(u) || [];
  const invB = {};
  for (const it of invItems) {
    const begin = Math.round((u.invB || {})[it.acct] || 0);
    if (begin) ksPost('splitInv', [[it.pacct, begin, 0], [it.acct, 0, begin]], { u: uid, key: it.acct, desc: '分割で移す事業の期首の在庫を仕入に振り替え' });
    const book = Math.max(0, Math.round(it.book));
    if (book) { add(it.pacct, 0, book); addS(it.acct, book, 0); net += book; }
    invB[it.acct] = book;
  }
  // 施工中の工事
  if (S.eng === 'build') {
    const proj = u.op.projects.filter(p => !p.fin);
    const cw = Math.round(sum(proj, p => p.costToDate)), ad = Math.round(sum(proj, p => p.recv));
    add('cwip', 0, cw); addS('cwip', cw, 0); add('advRecv', ad, 0); addS('advRecv', 0, ad); net += cw - ad;
  }
  // 売掛金（お客さまごとの明細ごと移す）
  const arMove = G.ar.filter(x => x.u === uid);
  const arAmt = Math.round(sum(arMove, x => x.amt));
  add('ar', 0, arAmt); addS('ar', arAmt, 0); net += arAmt;
  // 保証金
  const dep = Math.round(u.dep || 0);
  add('deposit', 0, dep); addS('deposit', dep, 0); net += dep;
  // 現預金
  add('cash', 0, cash); addS('cash', cash, 0); net += cash;
  // 買掛金：この事業の仕入の割合で、支払期日ごとに分けて移す
  const apShare = o.apShare ?? ksUnitPurchShare(uid);
  const apMove = [];
  if (apShare > 0) for (const x of G.ap) { const amt = Math.round(x.amt * apShare); if (amt > 0) apMove.push({ x, amt }); }
  const apAmt = sum(apMove, y => y.amt);
  add('ap', apAmt, 0); addS('ap', 0, apAmt); net -= apAmt;
  // 借入金：loanFrac の割合を、同じ条件のまま移す（当座貸越は親会社に残す）
  const loanMove = [];
  if (o.loanFrac > 0) for (const L of G.loans) {
    if (L.kind === 'od' || L.bal <= 0) continue;
    const part = Math.min(L.bal, Math.round(L.bal * o.loanFrac / 1e4) * 1e4);
    if (part <= 0) continue;
    loanMove.push({ L, part });
    add(ksLoanAcct(L), part, 0); addS(ksLoanAcct(L), 0, part); net -= part;
  }
  if (net < 1e6) { G.curU = null; return { ok: false, why: `移す純資産がマイナスです（${fmtYen(net)}）。一緒に移す現預金を増やしてください` }; }
  for (const y of apMove) y.x.amt -= y.amt;
  G.ap = G.ap.filter(x => x.amt > 0);
  add('subShares', net, 0);
  ksPost('split', lines, { u: uid, cf: 'capex', desc: `会社分割（新設分割）で${ksUName(u)}を子会社に移す` });
  G.curU = null;
  // 3) 子会社をつくる
  const id = 'S' + (++g.seq);
  const name = o.name || ksSubNameFor(u.type, 'jp');
  const capital = Math.min(Math.round(o.capital || Math.min(net, 1e8)), net);
  const st = ksFreshCompany({ coName: name, cash: 0, capital: 0, seed: (root.rs ^ (g.seq * 40503)) | 0, cc: 'jp', pref: typeof ksUnitPref === 'function' ? ksUnitPref(u) : null, subId: id, execPay: clamp(Math.round(root.execPay * 0.6 / 1e4) * 1e4, 40e4, 200e4) });
  // 子会社の帳簿：引き継ぐ資産・負債と、資本金・資本準備金
  ksWith(st, () => {
    for (const a of moved) {
      const b = Object.assign({}, a, { id: 'F' + (++G.seq) });
      delete b.soldM; delete b.moved;
      if (!b.cip) b.depFrom = G.m; // 今期の償却は、引き継いだ月から
      G.assets.push(b);
    }
    G.ar = arMove.map(x => Object.assign({}, x));
    G.ap = apMove.map(y => ({ amt: y.amt, due: y.x.due }));
    for (const { L, part } of loanMove) {
      const f = part / L.bal;
      const L2 = Object.assign({}, L, { id: 'L' + (++G.seq), bal: part, amt: Math.round(L.amt * f), prin: Math.round((L.prin || 0) * f) });
      G.loans.push(L2);
    }
    subLines.push(['capital', 0, capital], ['capSurplus', 0, net - capital]);
    ksPost('splitIn', subLines, { u: 'HQ', cf: 'equity', desc: `会社分割で${ksUName(u)}の事業を引き継ぐ` });
    G.monthStartCash = ksB('cash');
    G.openingFS = ksOpeningFS();
  });
  // 4) 事業そのもの（人員・取引先・工事・設備の計画）を移す。親会社には記録用の控えを残す
  const stub = { id: u.id, type: u.type, n: u.n, sc: u.sc, closedM: G.m, splitTo: id, op: { doneFY: JSON.parse(JSON.stringify(u.op.doneFY || {})), devFY: JSON.parse(JSON.stringify(u.op.devFY || {})) }, staff: {}, invB: {}, kpi: {}, startM: u.startM };
  root.units[root.units.indexOf(u)] = stub;
  u.invB = invB;
  st.units.push(u);
  st.useq = Math.max(st.useq, +u.id.slice(1) || 0);
  st.wfPrevU = { [u.id]: (root.wfPrevU || {})[u.id] || { labor: 0, salary: 0 }, HQ: { labor: 0, salary: Math.round(st.execPay * 0.15) } };
  st.wfPrev = { labor: st.wfPrevU[u.id].labor, salary: st.wfPrevU[u.id].salary + st.wfPrevU.HQ.salary };
  if (root.wfPrevU) delete root.wfPrevU[u.id];
  for (const a of moved) { a.soldM = G.m; a.moved = id; }
  root.ar = root.ar.filter(x => x.u !== uid);
  for (const { L, part } of loanMove) { const f = part / L.bal; L.amt = Math.round(L.amt * (1 - f)); L.prin = Math.round((L.prin || 0) * (1 - f)); L.bal -= part; }
  root.loans = root.loans.filter(L => L.bal > 0 || L.kind === 'od');
  u.dep = dep;
  // 法令・成長の記録も移す
  ksWith(st, () => { if (typeof ksLawAddUnit === 'function') ksLawAddUnit(u); });
  if (root.law && st.law) for (const k of Object.keys(root.law.done)) if (k.endsWith(':' + uid)) { st.law.done[k] = root.law.done[k]; delete root.law.done[k]; }
  if (root.grow && st.grow) {
    for (const [k, x] of Object.entries(root.grow.up)) if (x.u === uid) { st.grow.up[k] = x; delete root.grow.up[k]; }
    if (root.grow.intl[uid]) { st.grow.intl[uid] = root.grow.intl[uid]; delete root.grow.intl[uid]; }
    st.grow.fxq = root.grow.fxq.filter(q => q.u === uid);
    root.grow.fxq = root.grow.fxq.filter(q => q.u !== uid);
  }
  if (root.loc && st.loc && root.loc.units && root.loc.units[uid]) { st.loc.units[uid] = root.loc.units[uid]; st.loc.hq = root.loc.units[uid]; st.loc.home = root.loc.home || root.loc.hq; delete root.loc.units[uid]; }
  const s = { id, st, own: 1, kind: 'split', since: root.m, eq0: net, adds: 0, reTr: 0, gw: 0, gwCum: 0, cc: 'jp', fx0: 1, fee: 0.01, payout: 0.3, auto: true, name };
  g.subs.push(s);
  if (typeof UI !== 'undefined' && UI && UI.kUnit === uid) UI.kUnit = null;
  ksNews(`会社分割（新設分割）で${ksUName(u)}の事業を${name}に移しました（移した純資産 ${fmtYen(net)}・従業員${ksWith(st, () => ksUnitHead(u))}人）`, 'good');
  return { ok: true, s, net };
}

/* ---------- 持株会社体制に移行する ---------- */
function ksGroupMakeHD(o = {}) {
  ksGroupInit();
  const us = ksActiveUnits().slice();
  if (!us.length) return { ok: false, why: '移す事業がありません' };
  const out = [];
  // 借入金は、事業の資産の大きさに応じて子会社に引き継ぐ（持株会社には当座貸越だけ残す）
  const w = us.map(u => Math.max(1, (ksGroupSplitPreview(u.id) || { bv: 0, inv: 0, ar: 0 }).bv + (ksGroupSplitPreview(u.id) || {}).inv + (ksGroupSplitPreview(u.id) || {}).ar));
  let wLeft = sum(w, x => x);
  const keep = Math.max(3e7, ksMonthlyFixedOut() * 0.2);
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    const pv = ksGroupSplitPreview(u.id);
    const left = us.length - i;
    const cash = Math.max(0, Math.min(Math.max(0, ksB('cash') - keep) / left * (left === 1 ? 1 : 1), pv ? Math.max(pv.cashS, ksB('cash') * w[i] / wLeft) : 0));
    const r = ksGroupSplit(u.id, { name: o.names && o.names[u.id], cash: Math.round(cash / 1e4) * 1e4, loanFrac: w[i] / wLeft });
    wLeft -= w[i];
    if (!r.ok) return r;
    out.push(r.s);
  }
  const g = G.group;
  g.hd = true;
  g.hdM = G.m;
  // 持株会社の本社（経営企画・経理・人事・法務）
  const groupHead = sum(out, s => ksWith(s.st, ksHeadcount));
  g.hq = { staff: clamp(Math.round(groupHead * 0.01), 2, 300), wage: 45e4 };
  // 経営指導料は、本社の費用をまかなえる料率に（1〜5%）
  const groupSales = sum(out, s => ksWith(s.st, ksAnnualSales));
  const hqCost = (g.hq.staff * g.hq.wage * 1.15 + G.execPay * 1.15) * 12 * 1.15;
  const rate = clamp(+(hqCost / Math.max(1, groupSales)).toFixed(3), 0.01, 0.05);
  for (const s of out) s.fee = rate;
  if (o.rename) {
    const base = G.coName.replace(/株式会社|合同会社|有限会社/g, '').trim();
    G.coNameOld = G.coName;
    G.coName = `${base}ホールディングス株式会社`;
  }
  ksNews(`持株会社体制に移行しました。${out.length}つの事業を子会社に移し、${G.coName}は子会社の株式を持ってグループを経営する会社（純粋持株会社）になりました`, 'good');
  return { ok: true, subs: out };
}

/* ---------- 株式を買って子会社にする（買収） ---------- */
const KS_DD_FEE = 0.01;
function ksGroupFindTargets() {
  ksGroupInit();
  const g = G.group;
  const us = ksActiveUnits();
  const secs = [...new Set(us.map(u => ksS(u).sec))];
  const annual = Math.max(5e8, ksAnnualSales() || sum(ksSubs(), s => ksWith(s.st, ksAnnualSales)));
  const list = [];
  for (let i = 0; i < 4; i++) {
    const near = chance(0.6) && secs.length ? KS_TYPE_LIST.filter(S => secs.includes(S.sec)) : KS_TYPE_LIST;
    const S = pick(near.length ? near : KS_TYPE_LIST);
    const target = annual * uni(0.1, 0.6);
    g.seq++;
    list.push({ id: 'T' + g.seq, type: S.name, target, seed: (G.rs ^ (g.seq * 2654435761)) | 0, co: `株式会社${pick(CO_PREFIX)}${pick(KS_CO_CORE[S.eng] || ['産業'])}`, cond: wpick(['good', 'normal', 'bad'], [0.3, 0.5, 0.2]), m: G.m });
  }
  g.targets = list;
  ksPost('maFee', [['fees', KS_MA_FEE, 0], ['cash', 0, KS_MA_FEE]], { cf: 'exp', u: 'HQ', desc: 'M&Aの仲介会社への着手金（株式の取得）' });
  return list;
}
/* デューデリジェンス：会社の状態（過去の決算書つき）をつくり、今の月まで動かす */
function ksGroupDD(t) {
  if (t.st) return t;
  const root = G;
  let st = null;
  const sv = G;
  const ceo = `${pick(['佐藤', '鈴木', '高橋', '田中', '小林', '加藤'])} ${pick(['一郎', '修', '和子', '隆', '博', '真理子'])}`;
  try {
    // 規模を目標の年商に合わせる（1回目で測って、規模を直す）
    let sc = 1;
    for (let k = 0; k < 2; k++) {
      G = null;
      ksNewGame({ units: [{ type: t.type, sc }], coName: t.co, ceo, seed: t.seed, cond: t.cond, term: 0, asSub: true });
      st = G;
      const L = ksLastFY();
      const s = L ? L.pl.sales : 1;
      if (k === 0 && s > 0) sc = clamp(sc * t.target / s, 0.3, 8);
    }
    G = st;
    st.isSub = true;
    st.termYears = 0;
    st.news = [];
    // 今の月まで、先方の経営陣が経営してきたとして動かす
    while (G.m < root.m && !G.over) ksSubBotMonth(root.eco);
  } finally { G = sv; }
  t.st = st;
  const s = ksWith(st, () => ksToBankFS(ksLastFY()));
  const eq = ksWith(st, ksEquity);
  const opi = s ? Math.max(0, s.OPI) : 0;
  t.q = { eq: Math.round(eq), sales: s ? s.S : 0, opi: s ? s.OPI : 0, ni: s ? s.NI : 0, debt: ksWith(st, ksDebt), cash: ksWith(st, () => ksB('cash')), grade: st.grade, head: ksWith(st, ksHeadcount), price100: niceAmount(Math.max(eq * 1.05, eq + opi * 3.5, 1e7)) };
  const fee = Math.max(300e4, Math.round(t.q.price100 * KS_DD_FEE / 1e4) * 1e4);
  ksPost('ddFee', [['fees', fee, 0], ['cash', 0, fee]], { cf: 'exp', u: 'HQ', desc: `デューデリジェンス（${t.co}）の費用` });
  t.ddFee = fee;
  return t;
}
/* 株式を買う。own：取得する持分（0.51〜1） */
function ksGroupBuy(t, own) {
  ksGroupInit();
  const root = G, g = root.group;
  if (!t.st) return { ok: false, why: '先にデューデリジェンスが必要です' };
  own = clamp(+own || 1, 0.51, 1);
  const price = niceAmount(t.q.price100 * own * (own >= 0.67 ? 1 : 0.97));
  if (ksB('cash') < price) return { ok: false, why: '買収の資金が足りません' };
  const id = 'S' + (++g.seq);
  const st = t.st;
  st.isSub = true; st.subId = id; st.parentName = root.coName;
  // 取得の時点の純資産（今月すでに記帳した損益は、取得後の損益として連結に入るので除く）
  const eq = Math.round(ksWith(st, () => ksEquity() - sum(Object.entries(G.flow || {}), ([k, v]) => (KS_ACCT[k].t === 'R' ? v : KS_ACCT[k].t === 'X' ? -v : 0))));
  ksPost('subBuy', [['subShares', price, 0], ['cash', 0, price]], { u: 'HQ', cf: 'capex', desc: `株式の取得（${t.co}を子会社に）` });
  const gw = Math.max(0, price - own * eq), negGw = Math.max(0, own * eq - price);
  const s = { id, st, own, kind: 'acq', since: root.m, eq0: eq, adds: 0, reTr: 0, gw: Math.round(gw), negGw: Math.round(negGw), gwCum: 0, cc: 'jp', fx0: 1, fee: 0.005, payout: 0.3, auto: true, name: st.coName, price, partner: own < 1 ? '旧株主（創業家）' : null };
  g.subs.push(s);
  g.targets = (g.targets || []).filter(x => x !== t);
  ksNews(`${t.co}の株式の${Math.round(own * 100)}%を${fmtYen(price)}で取得し、子会社にしました（純資産 ${fmtYen(eq)}・のれん ${fmtYen(gw)}${negGw ? `・負ののれん ${fmtYen(negGw)}` : ''}）`, 'good');
  return { ok: true, s, price, gw };
}

/* ---------- 子会社の株式を売る ---------- */
function ksSubValue(s) {
  const L = ksWith(s.st, ksLastFY);
  const bfs = L ? ksWith(s.st, () => ksToBankFS(L)) : null;
  const eq = ksWith(s.st, ksEquity);
  const opi = bfs ? Math.max(0, bfs.OPI) : 0;
  return Math.round(Math.max(eq * 0.9, eq + opi * 3) * ksSubK(s, ksRoot().m));
}
function ksGroupSell(id) {
  const root = G, g = root.group;
  const s = ksSubById(id, root);
  if (!s || s.gone) return { ok: false, why: '子会社がありません' };
  if (root.closing) return { ok: false, why: '決算整理の途中です' };
  const price = niceAmount(ksSubValue(s) * s.own);
  const carry = Math.round(s.own * (s.eq0 + s.adds) + s.gw);
  const icl = Math.round(sum((g.loans || []).filter(L => L.sub === id), L => L.bal));
  // 親会社からの貸付金は、売るときに返してもらう
  if (icl > 0) ksGroupRepay(s, icl, true);
  const lines = [['cash', price, 0], ['subShares', 0, carry]];
  if (price > carry) lines.push(['subGain', 0, price - carry]); else if (price < carry) lines.push(['subLoss', carry - price, 0]);
  ksPost('subSell', lines, { u: 'HQ', cf: 'capex', desc: `子会社の株式の売却（${s.name}）` });
  ksGroupDeconsolidate(s, 'sold', price);
  ksNews(`${s.name}の株式を${fmtYen(price)}で売却しました（帳簿価額 ${fmtYen(carry)}・売却${price >= carry ? '益' : '損'} ${fmtYen(Math.abs(price - carry))}）`, price >= carry ? 'good' : 'bad');
  return { ok: true, price, carry };
}
/* 連結から外す（売却・破産）。連結の利益剰余金との差を、売却損益の連結修正として記録する */
function ksGroupDeconsolidate(s, why, price) {
  const root = ksRoot();
  const fy = fyOf(root.m);
  const pl = ksGroupSubPL(s, fy, root.m);
  const ni = ksPLNi(pl);
  s.reTr += ni - ksIcDivTot(s, fy);
  const amort = ksGwAmortFY(s, fy, root.m);
  s.gwCum += amort;
  s.out = { why, m: root.m, fy, price, pl, adj: Math.round(-s.own * s.reTr + s.gwCum), amort, reTr: s.reTr };
  s.gone = true;
  s.goneM = root.m;
}

/* ---------- 親子の取引（増資・貸付・返済） ---------- */
function ksGroupInject(id, amt) {
  const root = G, s = ksSubById(id, root);
  if (!s || s.gone) return { ok: false, why: '子会社がありません' };
  amt = Math.round(amt);
  if (ksB('cash') < amt) return { ok: false, why: '現預金が足りません' };
  const total = Math.round(amt / s.own);
  const k = ksSubK(s, root.m);
  ksPost('subAdd', [['subShares', amt, 0], ['cash', 0, amt]], { u: 'HQ', cf: 'capex', desc: `子会社（${s.name}）の増資の引受け` });
  ksWith(s.st, () => {
    const loc = Math.round(total / k);
    const cap = Math.round(loc / 2);
    ksPost('capIn', [['cash', loc, 0], ['capital', 0, cap], ['capSurplus', 0, loc - cap]], { u: 'HQ', cf: 'equity', desc: `増資（親会社${s.own < 1 ? 'と合弁の相手' : ''}が引き受け）` });
  });
  s.adds += total;
  ksNews(`${s.name}に${fmtYen(amt)}を増資しました${s.own < 1 ? `（合弁の相手も持分に応じて${fmtYen(total - amt)}を出資）` : ''}`, 'good');
  return { ok: true };
}
function ksGroupLend(id, amt, auto) {
  const root = G, g = root.group, s = ksSubById(id, root);
  if (!s || s.gone) return { ok: false, why: '子会社がありません' };
  if (s.cc && s.cc !== 'jp') return { ok: false, why: '海外子会社には、貸付ではなく増資で資金を出します（このゲームでは）' };
  amt = Math.round(amt);
  if (ksB('cash') < amt) return { ok: false, why: '現預金が足りません' };
  const rate = +(Math.max(0.5, (root.eco.prime || 1.875) + 0.5)).toFixed(2);
  ksPost('icLend', [['icLoan', amt, 0], ['cash', 0, amt]], { u: 'HQ', cf: 'fin', desc: `子会社（${s.name}）への貸付` });
  ksWith(s.st, () => ksPost('icBorrow', [['cash', amt, 0], ['icDebt', 0, amt]], { u: 'HQ', cf: 'borrow', desc: '親会社からの借入' }));
  g.loans = g.loans || [];
  g.loans.push({ sub: id, bal: amt, rate, m: root.m, auto: !!auto });
  if (!auto) ksNews(`${s.name}に${fmtYen(amt)}を貸し付けました（年${rate}%）`, 'info');
  return { ok: true, rate };
}
function ksGroupRepay(s, amt, quiet) {
  const root = ksRoot(), g = root.group;
  let left = Math.round(amt);
  const sub = s.st;
  const cashS = ksWith(sub, () => ksB('cash'));
  left = Math.min(left, cashS);
  let paid = 0;
  for (const L of (g.loans || []).filter(x => x.sub === s.id && x.bal > 0)) {
    const p = Math.min(L.bal, left - paid);
    if (p <= 0) break;
    L.bal -= p; paid += p;
  }
  if (paid <= 0) return 0;
  ksWith(sub, () => ksPost('icRepay', [['icDebt', paid, 0], ['cash', 0, paid]], { u: 'HQ', cf: 'repay', desc: '親会社への返済' }));
  ksWith(root, () => ksPost('icRecv', [['cash', paid, 0], ['icLoan', 0, paid]], { u: 'HQ', cf: 'fin', desc: `子会社（${s.name}）からの貸付金の回収` }));
  g.loans = g.loans.filter(L => L.bal > 0);
  if (!quiet) ksNews(`${s.name}から貸付金${fmtYen(paid)}を返してもらいました`, 'info');
  return paid;
}
function ksIcLoanBal(id, root = ksRoot()) { return Math.round(sum(((root.group || {}).loans || []).filter(L => L.sub === id), L => L.bal)); }

/* ---------- 毎月：親子の取引（親会社の月次の前に記帳する） ---------- */
function ksIcRec(fy, id) {
  const ic = ksRoot().group.ic;
  const o = ic[fy] || (ic[fy] = {});
  return o[id] || (o[id] = { feeS: 0, feeN: 0, feeX: 0, int: 0, div: 0, divTot: 0 });
}
function ksIcDivTot(s, fy) { const o = ((ksRoot().group.ic || {})[fy] || {})[s.id]; return o ? o.divTot : 0; }
function ksGroupPre() {
  const root = G, g = root.group;
  const m = root.m, fy = fyOf(m), mo = calMonth(m);
  g.fx[m] = { usd: root.eco.fx || 148, eur: root.eco.eur || 160 };
  for (const s of ksSubs(root)) {
    const st = s.st;
    if (st.over) continue;
    const k = ksSubK(s, m);
    const rec = ksIcRec(fy, s.id);
    // 経営指導料：先月の売上に料率を掛けて、毎月受け取る
    const last = st.months[st.months.length - 1];
    const base = last && last.flow ? last.flow.sales || 0 : 0;
    const feeL = Math.round(base * (s.fee || 0));
    if (feeL > 0 && ksWith(st, () => ksB('cash')) > feeL) {
      const fee = Math.round(feeL * k);
      const acct = ksIsPureHD(root) ? 'sales' : 'feeInc';
      ksWith(st, () => ksPost('icFee', [['feeExp', feeL, 0], ['cash', 0, feeL]], { u: 'HQ', cf: 'exp', desc: '親会社への経営指導料' }));
      ksPost('icFee', [['cash', fee, 0], [acct, 0, fee]], { u: 'HQ', cf: 'collect', key: s.id, desc: `子会社（${s.name}）からの経営指導料` });
      if (acct === 'sales') rec.feeS += fee; else rec.feeN += fee;
      rec.feeX += fee;
    }
    // 貸付金の利息
    for (const L of (g.loans || []).filter(x => x.sub === s.id && x.bal > 0)) {
      const it = Math.round(L.bal * L.rate / 1200);
      if (it <= 0) continue;
      ksWith(st, () => ksPost('icInt', [['interest', it, 0], ['cash', 0, it]], { u: 'HQ', cf: 'interest', desc: '親会社への利息' }));
      ksPost('icInt', [['cash', it, 0], ['intInc', 0, it]], { u: 'HQ', cf: 'collect', key: s.id, desc: `子会社（${s.name}）からの利息` });
      rec.int += it;
    }
    // 配当：6月（子会社の株主総会）に、前期の利益に配当性向を掛けて払う
    if (mo === 6 && s.payout > 0) {
      const L = st.fys[fy - 1];
      const ni = L ? L.pl.ni : 0;
      const reNow = ksWith(st, () => ksB('re'));
      const keep = ksWith(st, () => ksMonthlyFixedOut()) * 2;
      const cashS = ksWith(st, () => ksB('cash'));
      const D = Math.round(Math.min(ni * s.payout, reNow, Math.max(0, cashS - keep)) / 1e4) * 1e4;
      if (D > 0 && ni > 0) {
        const res = ksWith(st, () => Math.round(Math.max(0, Math.min(D * 0.1, ksB('capital') / 4 - ksB('capSurplus') - ksB('legalRes')))));
        ksWith(st, () => ksPost('icDiv', [['re', D + res, 0], ['cash', 0, D], ['legalRes', 0, res]], { u: 'HQ', cf: 'equity', desc: '剰余金の配当（株主総会の決議）' }));
        const recv = Math.round(D * s.own * k);
        const acct = ksIsPureHD(root) ? 'sales' : 'divInc';
        ksPost('icDiv', [['cash', recv, 0], [acct, 0, recv]], { u: 'HQ', cf: 'collect', key: s.id, desc: `子会社（${s.name}）からの配当` });
        rec.div += recv;
        rec.divTot += Math.round(D * k);
        rec.divS = (rec.divS || 0) + (acct === 'sales' ? recv : 0);
        // 税金：受取配当等の益金不算入の区分
        const d = g.divFY[fy] || (g.divFY[fy] = { full: 0, rel: 0, other: 0, small: 0, foreign: 0 });
        if (s.cc && s.cc !== 'jp') d.foreign += recv; else if (s.own >= 0.9999) d.full += recv; else if (s.own > 1 / 3) d.rel += recv; else if (s.own > 0.05) d.other += recv; else d.small += recv;
      }
    }
    // 資金の支え：子会社の資金が来月までに足りなくなりそうなら、親会社が貸す
    if (g.policy.support && (!s.cc || s.cc === 'jp')) {
      const fc = ksWith(st, () => ksForecast(2));
      const low = Math.min(...fc.map(x => x.bal));
      const need = ksWith(st, () => ksMonthlyFixedOut());
      if (low < need * 0.3) {
        const amt = niceAmount(need * 1.5 - low);
        if (ksB('cash') - amt > ksMonthlyFixedOut() * 1.5) ksGroupLend(s.id, amt, true);
      }
    } else if (g.policy.support && s.cc && s.cc !== 'jp') {
      const fc = ksWith(st, () => ksForecast(2));
      const low = Math.min(...fc.map(x => x.bal));
      const need = ksWith(st, () => ksMonthlyFixedOut());
      if (low < need * 0.3) {
        const amt = niceAmount((need * 2 - low) * k * s.own);
        if (ksB('cash') - amt > ksMonthlyFixedOut() * 1.5) ksGroupInject(s.id, amt);
      }
    }
    // 余ったお金で、親会社からの借入を返す
    const lb = ksIcLoanBal(s.id, root);
    if (lb > 0) {
      const cashS = ksWith(st, () => ksB('cash'));
      const need = ksWith(st, () => ksMonthlyFixedOut());
      if (cashS > need * 4) ksGroupRepay(s, Math.min(lb, cashS - need * 3), true);
    }
  }
  // 持株会社の本社の人件費
  if (g.hd && g.hq && g.hq.staff > 0) {
    const pay = Math.round(g.hq.staff * g.hq.wage * (root.eco.wageIdx || 1));
    ksPost('hdPay', [['salary', pay, 0], ['welfare', Math.round(pay * 0.15), 0], ['cash', 0, pay + Math.round(pay * 0.15)]], { u: 'HQ', cf: 'payroll', desc: '持株会社の本社（経営企画・経理・人事・法務）の給与と社会保険料' });
  }
}

/* ---------- 子会社の月次（ボットの経営または社長の経営） ---------- */
function ksSubBotMonth(eco) {
  if (eco) G.eco = JSON.parse(JSON.stringify(eco));
  for (const u of ksActiveUnits()) { G.curU = u.id; KS_ENGINE[ksS(u).eng].auto(u); G.curU = null; }
  ksAutoFinance();
  ksAdvance();
  ksSubAutoAdmin();
  if (G.closing) ksAutoClose();
}
/* 子会社の経理・総務：労災の手続・法令のやることを、標準どおりに処理する */
function ksSubAutoAdmin() {
  if (G.law) {
    for (const a of G.law.acc) if (a.status === 'new') ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
    for (const x of ksLawTasks()) if (x.st === 'over' || x.st === 'due') ksLawDo(x.t.id, { special: true });
    for (const ins of G.law.insp) if (ins.status === 'open') { for (const f of ins.finds) if (!f.fixed && typeof ksLawFindingFix === 'function') ksLawFindingFix(f.item); ksLawReport(ins.id); }
  }
  G.pendingModals = [];
  if (G.budget && G.budget.status === 'draft') ksBudgetApprove(true);
}
function ksGroupTrim(st) {
  if (st.months.length > 30) st.months.splice(0, st.months.length - 30);
  if (st.journal.length > 4) st.journal.splice(0, st.journal.length - 4);
  if (st.news.length > 40) st.news.length = 40;
}
function ksGroupSubMonth(s, eco) {
  const st = s.st;
  if (st.over) return;
  ksWith(st, () => {
    G.eco = JSON.parse(JSON.stringify(eco));
    if (s.auto) {
      for (const u of ksActiveUnits()) { G.curU = u.id; KS_ENGINE[ksS(u).eng].auto(u); G.curU = null; }
      ksAutoFinance();
    }
    ksAdvance();
    if (s.auto) ksSubAutoAdmin();
    if (G.closing) ksAutoClose();
    ksGroupTrim(G);
  });
  if (st.over) ksGroupSubFailed(s);
}
/* 子会社の資金が尽きた：破産手続（親会社は株式と貸付金を損失にする） */
function ksGroupSubFailed(s) {
  const root = ksRoot();
  const carry = Math.round(s.own * (s.eq0 + s.adds) + s.gw);
  const icl = ksIcLoanBal(s.id, root);
  ksWith(root, () => {
    const lines = [['subLoss', carry, 0], ['subShares', 0, carry]];
    if (icl > 0) lines.push(['badDebt', icl, 0], ['icLoan', 0, icl]);
    ksPost('subFail', lines, { u: 'HQ', desc: `子会社（${s.name}）の破産：株式と貸付金の損失` });
  });
  root.group.loans = (root.group.loans || []).filter(L => L.sub !== s.id);
  ksGroupDeconsolidate(s, 'failed', 0);
  ksWith(root, () => ksNews(`子会社の${s.name}が資金繰りに行き詰まり、破産しました。株式（${fmtYen(carry)}）${icl ? `と貸付金（${fmtYen(icl)}）` : ''}を損失にしました`, 'bad'));
}

/* ---------- グループの月次（親会社 → 子会社の順） ---------- */
function ksGroupAdvance() {
  const root = G;
  if (!root.group || !ksSubs(root).length) {
    if (root.group && Object.keys(root.group.ic || {}).length) root.group.fx[root.m] = { usd: root.eco.fx || 148, eur: root.eco.eur || 160 };
    return ksAdvance();
  }
  if (root.over || root.closing) return null;
  const eco = JSON.parse(JSON.stringify(root.eco));
  ksGroupPre();
  const rep = ksAdvance();
  for (const s of ksSubs(root)) ksGroupSubMonth(s, eco);
  G = root;
  return rep;
}

/* ---------- 連結決算 ---------- */
/* 会社の期の損益（科目ごと）。fromM 以降・toM までの月（決算整理を含む） */
function ksEntPLAcct(st, fy, fromM = -1e9, toM = 1e9, kf = null) {
  const out = {};
  for (const x of st.months) {
    if (fyOf(x.m) !== fy || x.m < fromM || x.m > toM) continue;
    const k = kf ? kf(x.m) : 1;
    for (const src of [x.flow, x.flowC]) for (const [a, v] of Object.entries(src || {})) {
      if (!KS_ACCT[a] || (KS_ACCT[a].t !== 'R' && KS_ACCT[a].t !== 'X')) continue;
      out[a] = (out[a] || 0) + v * k;
    }
  }
  return out;
}
const KS_CONS_PL = [
  ['sales', '売上高', a => a === 'sales'], ['cogs', '売上原価', a => KS_ACCT[a].g === 'cogs'], ['sga', '販売費及び一般管理費', a => KS_ACCT[a].g === 'sga'],
  ['noi', '営業外収益', a => KS_ACCT[a].g === 'noi'], ['noe', '営業外費用', a => KS_ACCT[a].g === 'noe'],
  ['exg', '特別利益', a => KS_ACCT[a].g === 'exg'], ['exl', '特別損失', a => KS_ACCT[a].g === 'exl'], ['tax', '法人税等', a => KS_ACCT[a].g === 'tax'],
];
function ksPLLines(acct) {
  const o = {};
  for (const [k, , f] of KS_CONS_PL) o[k] = Math.round(sum(Object.entries(acct).filter(([a]) => f(a)), ([, v]) => v));
  return o;
}
function ksPLNi(o) { return o.sales - o.cogs - o.sga + o.noi - o.noe + o.exg - o.exl - o.tax; }
/* 子会社の期の損益（連結に入る分。換算後） */
function ksGroupSubPL(s, fy, toM = 1e9) {
  const from = s.since; // 子会社になる前の損益は入れない（買収・株式移転で取得のときの純資産に含まれている）
  return ksPLLines(ksEntPLAcct(s.st, fy, from, toM, s.cc && s.cc !== 'jp' ? m => ksSubK(s, m) : null));
}
/* のれんの償却（10年・月割）。fy の分 */
function ksGwAmortFY(s, fy, toM = fy * 12 + 11) {
  if (!s.gw) return 0;
  const life = (s.gwLife || 10) * 12;
  const from = Math.max(fy * 12, s.since), to = Math.min(toM, fy * 12 + 11, s.since + life - 1);
  const months = Math.max(0, to - from + 1);
  return Math.round(Math.min(s.gw * months / life, s.gw - s.gwCum));
}
const KS_CONS_BS = [
  ['cash', '現金預金', b => b.cash], ['ar', '売上債権（貸倒引当金控除後）', b => b.ar - b.allow], ['inv', '棚卸資産', b => b.goods + b.mat + b.wip + b.prod + b.cwip],
  ['oca', 'その他の流動資産', b => b.prepaid], ['ppe', '有形固定資産', b => b.bldg + b.mach + b.veh + b.equip - b.accDep + b.land + b.cip],
  ['ia', '無形固定資産（のれんを除く）', b => b.sw + b.swip], ['gw', 'のれん', b => b.goodwill], ['subShares', '関係会社株式', b => b.subShares || 0],
  ['icLoan', '関係会社長期貸付金', b => b.icLoan || 0], ['io', '投資その他の資産', b => b.deposit],
  ['ap', '仕入債務', b => b.ap], ['debt', '借入金', b => b.std + b.ltd], ['icDebt', '関係会社長期借入金', b => b.icDebt || 0], ['ocl', 'その他の負債', b => b.accrued + b.accruedExp + b.taxPay + b.advRecv],
  ['capital', '資本金', b => b.capital], ['capSur', '資本剰余金', b => b.capSurplus || 0], ['re', '利益剰余金', b => b.re + (b.legalRes || 0)],
];
const KS_CONS_ASSET = ['cash', 'ar', 'inv', 'oca', 'ppe', 'ia', 'gw', 'subShares', 'icLoan', 'io'];
const KS_CONS_LIAB = ['ap', 'debt', 'icDebt', 'ocl'];
function ksBSLines(b, k = 1) { const o = {}; for (const [key, , f] of KS_CONS_BS) o[key] = Math.round(f(b) * k); return o; }
/* 親会社の決算が終わったときに、連結決算書をつくる */
function ksGroupConsolidate(fy) {
  const root = G, g = root.group;
  const endM = fy * 12 + 11;
  const subs = g.subs.filter(s => s.since <= endM && (!s.gone || (s.out && s.out.fy === fy)));
  if (!subs.length) return null;
  const P = root.fys[fy];
  if (!P) return null;
  const ents = [];
  // 親会社
  const pPL = ksPLLines(ksEntPLAcct(root, fy));
  const pBS = ksBSLines(P.bs);
  ents.push({ id: 'root', n: root.coName, own: 1, pl: pPL, bs: pBS, parent: true });
  const elim = []; // 連結修正仕訳 { t, why, pl:{line:±}, bs:{line:±}, nci, fctr }
  let nciBS = 0, fctrBS = 0, nciPL = 0, gwBS = 0;
  for (const s of subs) {
    const st = s.st;
    const sold = s.gone && s.out && s.out.fy === fy;
    const kEnd = ksSubK(s, endM);
    const pl = sold ? s.out.pl : ksGroupSubPL(s, fy);
    const ni = ksPLNi(pl);
    const SB = !sold && st.fys[fy] ? st.fys[fy].bs : null;
    const bs = SB ? ksBSLines(SB, kEnd) : null;
    ents.push({ id: s.id, n: s.name, own: s.own, pl, bs, sold, cc: s.cc, kEnd });
    const rec = ((g.ic[fy] || {})[s.id]) || { feeS: 0, feeN: 0, feeX: 0, int: 0, div: 0, divTot: 0, divS: 0 };
    // 1) 内部取引の消去（経営指導料・利息・配当）
    if (rec.feeX) elim.push({ t: '経営指導料の相殺消去', why: `${s.name}が払った経営指導料と、親会社が受け取った分は、グループの外との取引ではないので消す`, pl: { sales: -rec.feeS, noi: -rec.feeN, sga: -rec.feeX } });
    if (rec.int) elim.push({ t: '貸付金の利息の相殺消去', why: `親会社の受取利息と${s.name}の支払利息を消す`, pl: { noi: -rec.int, noe: -rec.int } });
    if (rec.div) elim.push({ t: '配当金の相殺消去', why: `${s.name}からの配当は、グループの中でお金が動いただけ。親会社の受取配当金を消し、利益剰余金に戻す${s.own < 1 ? '（非支配株主に払った分は、非支配株主持分を減らす）' : ''}`, pl: { sales: -(rec.divS || 0), noi: -(rec.div - (rec.divS || 0)) } });
    // 2) のれんの償却・売却時の修正
    let amort = 0;
    if (sold) amort = s.out.amort;
    else { amort = ksGwAmortFY(s, fy); }
    if (amort) elim.push({ t: 'のれんの償却', why: `${s.name}を買ったときの、のれん（支払った額と純資産の差）を10年で償却する（連結だけの費用）`, pl: { sga: amort } });
    if (s.kind === 'acq' && s.negGw && fyOf(s.since) === fy) elim.push({ t: '負ののれん発生益', why: `${s.name}の純資産より安く買えた差は、買った期の特別利益`, pl: { exg: s.negGw } });
    // 3) 子会社の利益の非支配株主への配分
    const nciNi = Math.round(ni * (1 - s.own));
    if (s.own < 1) { nciPL += nciNi; elim.push({ t: '非支配株主に帰属する当期純利益', why: `${s.name}の利益のうち、親会社以外の株主（${s.partner || '少数株主'}）の持分${Math.round((1 - s.own) * 100)}%の分`, nciPL: nciNi }); }
    if (sold) {
      elim.push({ t: s.out.why === 'sold' ? '子会社株式の売却損益の連結修正' : '子会社の破産の連結修正', why: '個別の決算の売却損益は、取得の額との差。連結では、これまでに連結で取り込んだ利益（とのれんの償却）をのぞいた差になる', pl: s.out.adj >= 0 ? { exg: s.out.adj } : { exl: -s.out.adj } });
      continue;
    }
    // 4) 投資と資本の相殺消去・非支配株主持分・為替換算調整勘定（期末の貸借対照表）
    const NA = bs ? sum(KS_CONS_ASSET, k2 => bs[k2]) - sum(KS_CONS_LIAB, k2 => bs[k2]) : 0;
    // 今期の利益剰余金の増減（換算後）を、取得後の利益の記録に加える
    const reTrEnd = s.reTr + ni - rec.divTot - (s.kind === 'acq' && fyOf(s.since) === fy ? 0 : 0);
    const fctr = Math.round(NA - (s.eq0 + s.adds) - reTrEnd);
    const nci = Math.round(NA * (1 - s.own));
    const gwLeft = Math.round(s.gw - s.gwCum - amort);
    nciBS += nci; fctrBS += Math.round(fctr * s.own); gwBS += gwLeft;
    elim.push({ t: '投資と資本の相殺消去', why: `親会社の${s.name}の株式（${fmtYen(Math.round(s.own * (s.eq0 + s.adds) + s.gw))}）と、${s.name}の${s.kind === 'acq' ? '取得のときの' : ''}資本を消す${s.gw ? '。差はのれん' : ''}${s.own < 1 ? '。親会社以外の株主の持分は非支配株主持分' : ''}`, bs: { subShares: -Math.round(s.own * (s.eq0 + s.adds) + s.gw), gw: gwLeft }, eq: true });
    s._next = { reTr: reTrEnd, gwCum: s.gwCum + amort };
  }
  // 債権債務の相殺消去
  const icl = Math.round(pBS.icLoan || 0);
  if (icl) elim.push({ t: '貸付金と借入金の相殺消去', why: '親会社の関係会社貸付金と、子会社の関係会社借入金は、グループの中の貸し借りなので消す', bs: { icLoan: -icl, icDebt: -icl } });
  // 合計と連結
  const PLK = KS_CONS_PL.map(x => x[0]);
  const sumPL = {}, consPL = {};
  for (const k of PLK) { sumPL[k] = sum(ents, e => e.pl[k] || 0); consPL[k] = sumPL[k] + sum(elim, e => (e.pl && e.pl[k]) || 0); }
  const BSK = KS_CONS_BS.map(x => x[0]);
  const live = ents.filter(e => e.bs);
  const sumBS = {}, consBS = {};
  for (const k of BSK) { sumBS[k] = sum(live, e => e.bs[k] || 0); consBS[k] = sumBS[k] + sum(elim, e => (e.bs && e.bs[k]) || 0); }
  // 資本は親会社の分だけ。利益剰余金は差額（貸借の一致で確かめる）
  consBS.capital = pBS.capital; consBS.capSur = pBS.capSur;
  consBS.nci = nciBS; consBS.fctr = fctrBS;
  const TA = sum(KS_CONS_ASSET, k => consBS[k]), TL = sum(KS_CONS_LIAB, k => consBS[k]);
  consBS.re = Math.round(TA - TL - consBS.capital - consBS.capSur - nciBS - fctrBS);
  consBS.TA = TA; consBS.TL = TL; consBS.EQ = TA - TL;
  const ni = ksPLNi(consPL);
  consPL.ni = ni; consPL.niNci = nciPL; consPL.niParent = ni - nciPL;
  consPL.gp = consPL.sales - consPL.cogs; consPL.opi = consPL.gp - consPL.sga; consPL.ord = consPL.opi + consPL.noi - consPL.noe; consPL.pretax = consPL.ord + consPL.exg - consPL.exl;
  // 確かめ：利益剰余金 ＝ 前期の連結の利益剰余金 ＋ 親会社株主に帰属する当期純利益 − 親会社の配当
  const prev = g.cons[fy - 1];
  const divPaid = Math.round(sum(root.months.filter(x => fyOf(x.m) === fy), x => (x.cf && x.cf.equity) || 0));
  const reExpected = prev ? Math.round(prev.bs.re + consPL.niParent + Math.min(0, divPaid)) : null;
  const cons = { fy, ents: ents.map(e => ({ id: e.id, n: e.n, own: e.own, pl: e.pl, bs: e.bs, sold: e.sold, cc: e.cc, parent: e.parent })), elim, sumPL, sumBS, pl: consPL, bs: consBS, check: reExpected === null ? null : consBS.re - reExpected };
  g.cons[fy] = cons;
  // 次の期へ：取得後の利益の記録とのれんの償却累計を進める
  for (const s of subs) if (s._next) { s.reTr = s._next.reTr; s.gwCum = s._next.gwCum; delete s._next; }
  return cons;
}

/* ---------- 税金：受取配当等の益金不算入・資本金の大きい会社・海外の税率 ---------- */
/* 均等割（資本金等の額と従業員数の区分。標準税率の道府県民税＋市町村民税） */
function ksKintou(st = G) {
  const cap = (st.bal.capital || 0) + (st.bal.capSurplus || 0);
  const big = ksWith(st, ksHeadcount) > 50;
  if (cap <= 1e7) return big ? 14e4 : 7e4;
  if (cap <= 1e8) return big ? 20e4 : 18e4;
  if (cap <= 10e8) return big ? 53e4 : 29e4;
  if (cap <= 50e8) return big ? 229e4 : 95e4;
  return big ? 380e4 : 121e4;
}
const ksTaxCalcG0 = ksTaxCalc;
ksTaxCalc = function () {
  const t = ksTaxCalcG0();
  const fy = G.closing ? G.closing.fy : fyOf(G.m);
  const d = G.group && G.group.divFY && G.group.divFY[fy];
  // 受取配当等の益金不算入：完全子法人（100%）・関連法人（1/3超）は全額、その他（5%超）は50%、5%以下は20%、海外子会社（25%以上）は95%
  const excl = d ? Math.round(d.full + d.rel + d.other * 0.5 + d.small * 0.2 + d.foreign * 0.95) : 0;
  const cc = G.country || 'jp';
  const foreign = cc !== 'jp' && typeof KS_COUNTRIES !== 'undefined' && KS_COUNTRIES[cc];
  const large = (G.bal.capital || 0) > 1e8;
  const kintou = foreign ? 0 : ksKintou(G);
  const loss = G.lossCF || 0;
  let taxable = t.pretax + (t.fines || 0) - excl - loss;
  let lossAfter = 0;
  if (taxable <= 0) { lossAfter = -taxable; taxable = 0; }
  const rate = foreign ? KS_COUNTRIES[cc].cit / 100 : large ? 0.306 : null;
  const income = rate !== null ? Math.round(taxable * rate) : Math.round(Math.min(taxable, 8e6) * 0.25 + Math.max(0, taxable - 8e6) * 0.34);
  const tax = Math.round((income + kintou) / 100) * 100;
  return Object.assign(t, { excl, divD: d || null, taxable, income, kintou, tax, lossAfter, rate, large, foreign: foreign ? foreign.n : null });
};

/* ---------- 決算のあとの処理（親会社だけ） ---------- */
function ksGroupAfterClose(fy) {
  if (G.isSub || !G.group) return;
  if (!G.group.subs.length) return;
  try { ksGroupConsolidate(fy); } catch (e) { console.error(e); }
  for (const s of G.group.subs) if (s.gone && s.out && s.out.fy <= fy) s.out.done = true;
}
/* グループの整合性（テスト用）：各社の帳簿と、連結の貸借 */
function ksGroupCheck(root = ksRoot()) {
  const e = [];
  for (const s of ksSubs(root)) for (const x of ksWith(s.st, ksCheck)) e.push(`${s.name}：${x}`);
  const g = root.group;
  if (g) {
    const icl = Math.round(sum(g.loans || [], L => L.bal));
    if (Math.abs(icl - (root.bal.icLoan || 0)) > 10) e.push(`関係会社貸付金の明細 ${icl} ≠ 元帳 ${root.bal.icLoan}`);
    const icd = Math.round(sum(ksSubs(root), s => s.st.bal.icDebt || 0));
    if (Math.abs(icd - icl) > 10) e.push(`子会社の関係会社借入金の合計 ${icd} ≠ 親会社の貸付金 ${icl}`);
    const carry = Math.round(sum(ksSubs(root), s => s.own * (s.eq0 + s.adds) + s.gw));
    if (Math.abs(carry - (root.bal.subShares || 0)) > 1000) e.push(`関係会社株式 ${root.bal.subShares} ≠ 取得の額の合計 ${carry}`);
  }
  return e;
}

/* ---------- 追加の仕組みの入口（方針と人事・拠点と地図・法令・グループ・カスタムスタート） ---------- */
function ksExtInit(o = {}) {
  if (o.asSub) G.isSub = true;
  if (typeof ksHrInit === 'function') ksHrInit(o);
  if (typeof ksMapInit === 'function') ksMapInit(o);
  if (typeof ksLaw2Init === 'function') ksLaw2Init(o);
  if (!G.isSub && !o.sub) {
    ksGroupInit();
    if (o.form && KS_FORMS[o.form]) G.form = o.form;
    if (typeof ksCustomApply === 'function') ksCustomApply(o);
  }
}
function ksExtMonth(ctx, res) {
  if (G.hist) return;
  if (typeof ksHrMonth === 'function' && G.hr) ksHrMonth(ctx, res);
  if (typeof ksMapMonth === 'function' && G.loc) ksMapMonth(ctx, res);
  if (typeof ksLaw2Month === 'function' && G.law) ksLaw2Month(ctx, res);
  if (typeof ksEvt2Month === 'function') ksEvt2Month(ctx, res);
}
function ksExtAfterClose(fy) {
  if (G.hist) return;
  if (typeof ksHrAfterClose === 'function' && G.hr) ksHrAfterClose(fy);
  ksGroupAfterClose(fy);
}

/* ---------- カスタムスタート ---------- */
/* o.custom = { form, pref, capital, cash, debt, hqLand, eco, fx, founded } */
function ksCustomApply(o) {
  const c = o.custom;
  if (!c || o.load) return;
  const lines = [];
  // 景気・為替
  if (c.eco && ['boom', 'normal', 'recession'].includes(c.eco)) { G.eco.regime = c.eco; G.eco.idx = c.eco === 'boom' ? 1.04 : c.eco === 'recession' ? 0.95 : 1; }
  if (c.fx > 50 && c.fx < 400) G.eco.fx = +c.fx;
  if (c.founded > 1800 && c.founded <= START_YEAR) { G.founded = Math.round(c.founded); G.firstPeriod = Math.max(1, START_YEAR - G.founded + 1); }
  // 資本金：増やすなら増資（現預金が入る）、減らすなら資本準備金に振り替える（減資）
  if (c.capital > 0) {
    const C0 = ksB('capital'), C = Math.round(c.capital);
    if (C > C0) ksPost('custCap', [['cash', C - C0, 0], ['capital', 0, C - C0]], { u: 'HQ', cf: 'equity', desc: '就任にあたっての増資' });
    else if (C < C0) ksPost('custCap', [['capital', C0 - C, 0], ['capSurplus', 0, C0 - C]], { u: 'HQ', desc: '減資（資本金を資本準備金に振り替え）' });
    lines.push(`資本金 ${fmtYen(C)}`);
  }
  // 本社の土地と建物（会社の大きさに見合う広さ。地価の高い所では狭く）
  if (c.hqLand && G.loc) {
    const p = G.loc.hq;
    const perM2 = ksLandPrice(p, 'com') * 1.08 + ksBldgQuote({ area: 1, pref: p }, 'hq').cost;
    const budget = Math.max(1.5e8, ksAnnualSales() * 0.2);
    let area = clamp(Math.round(Math.sqrt(Math.max(1, ksHeadcount())) * 120 / 10) * 10, 200, 5000);
    area = Math.max(100, Math.min(area, Math.round(budget / Math.max(1, perM2) / 10) * 10));
    const q = ksLandQuote(p, 'com', area);
    const bq = ksBldgQuote({ area, pref: p }, 'hq');
    const need = q.total + bq.cost + bq.taxes;
    if (ksB('cash') < need + 1e7) {
      const amt = Math.round((need + 1e7 - ksB('cash')) / 1e6) * 1e6;
      ksAddLoan({ bank: 'mirai', kind: 'shosho', purpose: 'capex', amt, termM: 180, repay: 'equal', rate: ksLoanRate('mirai', G.grade || 6, 120, { coll: true }) });
      ksPost('custDebt', [['cash', amt, 0], ['ltd', 0, amt]], { u: 'HQ', cf: 'borrow', desc: '本社の土地・建物の資金の借入（土地を担保に）' });
    }
    const r = ksBuyLand(p, 'com', area);
    if (r.ok) {
      const a = ksBuyAsset({ n: `本社ビル（${ksPrefName(p)}）`, acct: 'bldg', cost: bq.cost, life: 50, part: 'S', u: 'HQ' });
      ksPost('bldgTax', [['dues', bq.taxes, 0], ['cash', 0, bq.taxes]], { u: 'HQ', cf: 'exp', desc: '建物の登録免許税と不動産取得税' });
      r.land.bldg = { kind: 'hq', asset: a.id, uid: null, openM: G.m, floor: bq.floor, cost: bq.cost };
      lines.push(`本社の土地と建物（${ksPrefName(p)}・${fmtNum(area, 0)}㎡）`);
    }
  }
  // 借入金：増やすなら長期の借入、減らすなら繰上返済（返すお金が足りなければ、先に株主が出資する）
  if (c.debt >= 0 && c.debt !== null && c.debt !== undefined) {
    const D0 = ksDebt(), D = Math.round(c.debt);
    if (D > D0 + 1e5) {
      const amt = Math.round((D - D0) / 1e5) * 1e5;
      ksAddLoan({ bank: 'mirai', kind: 'shosho', purpose: 'working', amt, termM: 120, repay: 'equal', rate: ksLoanRate('mirai', G.grade || 6, 120) });
      ksPost('custDebt', [['cash', amt, 0], ['ltd', 0, amt]], { u: 'HQ', cf: 'borrow', desc: '長期の借入（就任の時点）' });
    } else if (D < D0 - 1e5) {
      let left = D0 - D;
      const keep = Math.max(1e6, c.cash > 0 ? Math.round(c.cash) : 1e7);
      const inj = Math.round((left + keep - ksB('cash')) / 1e5) * 1e5;
      if (inj > 0) ksPost('custCash', [['cash', inj, 0], ['capSurplus', 0, inj]], { u: 'HQ', cf: 'equity', desc: '借入金の返済のための株主の出資（資本準備金）' });
      for (const L of G.loans.filter(x => x.kind !== 'od' && x.bal > 0)) {
        const p = Math.min(L.bal, left, Math.max(0, ksB('cash') - 1e6));
        if (p <= 0) break;
        ksPost('custRepay', [[ksLoanAcct(L), p, 0], ['cash', 0, p]], { u: 'HQ', cf: 'repay', desc: '借入金の繰上返済（就任の時点）' });
        L.bal -= p; if (L.repay === 'equal') L.prin = Math.round(L.bal / Math.max(1, L.matM - G.m));
        left -= p;
      }
      G.loans = G.loans.filter(L => L.bal > 0 || L.kind === 'od');
    }
    lines.push(`借入金 ${fmtYen(ksDebt())}`);
  }
  // 現預金：多ければ株主に配当、少なければ株主が出資（資本準備金）
  if (c.cash > 0) {
    const X = Math.round(c.cash), X0 = ksB('cash');
    if (X > X0 + 1e5) ksPost('custCash', [['cash', X - X0, 0], ['capSurplus', 0, X - X0]], { u: 'HQ', cf: 'equity', desc: '株主からの追加の出資（資本準備金）' });
    else if (X < X0 - 1e5) {
      const d = Math.min(X0 - X, Math.max(0, ksB('re')));
      if (d > 0) ksPost('custCash', [['re', d, 0], ['cash', 0, d]], { u: 'HQ', cf: 'equity', desc: '株主への配当（就任の前の利益の分配）' });
    }
    lines.push(`現預金 ${fmtYen(ksB('cash'))}`);
  }
  G.monthStartCash = ksB('cash');
  ksSetODLimit();
  ksBudgetDraft(); ksBudgetApprove(true);
  if (lines.length) G.customNote = lines.join('・');
}
/* 持株会社のグループで始める：事業ごとに子会社（過去の決算書つき）をつくり、持株会社がその株式を持つ（株式移転） */
function ksNewGameCustom(o) {
  const c = o.custom || {};
  if (c.form !== 'hd') return ksNewGame(o);
  const list = ksStartList(o);
  const seed = (o.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0;
  const subs = [];
  list.forEach((x, i) => {
    G = null;
    const S = KS_TYPES[x.type];
    const base = (o.coName || '').replace(/株式会社|ホールディングス|合同会社|有限会社/g, '').trim() || '汐見';
    ksNewGame({ units: [x], coName: `${base}${pick(KS_CO_CORE[S.eng] || ['産業'])}株式会社`, ceo: `${pick(['佐藤', '鈴木', '高橋', '田中', '伊藤'])} ${pick(['健', '誠', '茂', '洋子', '直美'])}`, seed: (seed + i * 7919) | 0, cond: o.cond, term: 0, asSub: true, pref: o.pref });
    subs.push(G);
  });
  const total = Math.round(sum(subs, st => ksWith(st, ksEquity)));
  const cash = Math.round(c.cash > 0 ? c.cash : 5e7);
  const cap = Math.round(Math.min(c.capital > 0 ? c.capital : 1e8, total + cash));
  const root = ksFreshCompany({ root: true, coName: o.coName.includes('ホールディングス') ? o.coName : `${(o.coName || '汐見').replace(/株式会社/g, '').trim()}ホールディングス株式会社`, ceo: o.ceo, seed, m: KS_START_M, eco: subs[0].eco, cash: 0, capital: 0, term: o.term, cond: o.cond });
  G = root;
  root.hist = false;
  root.firstPeriod = 1 - fyOf(G.m);
  ksPost('hdOpen', [['subShares', total, 0], ['cash', cash, 0], ['capital', 0, cap], ['capSurplus', 0, total + cash - cap]], { u: 'HQ', cf: 'equity', desc: '株式移転で持株会社を設立（子会社の株式と株主の出資）' });
  G.monthStartCash = ksB('cash');
  G.openingFS = ksOpeningFS();
  if (typeof ksLawInit === 'function') ksLawInit();
  if (typeof ksGrowInit === 'function') ksGrowInit();
  ksExtInit(Object.assign({}, o, { custom: null }));
  const g = G.group;
  g.hd = true; g.hdM = G.m;
  subs.forEach((st, i) => {
    const id = 'S' + (++g.seq);
    st.isSub = true; st.subId = id; st.parentName = G.coName; st.termYears = 0; st.news = [];
    const eq = Math.round(ksWith(st, () => ksEquity() - sum(Object.entries(G.flow || {}), ([k, v]) => (KS_ACCT[k].t === 'R' ? v : KS_ACCT[k].t === 'X' ? -v : 0))));
    g.subs.push({ id, st, own: 1, kind: 'hd', since: G.m, eq0: eq, adds: 0, reTr: 0, gw: 0, gwCum: 0, cc: 'jp', fx0: 1, fee: 0.02, payout: 0.3, auto: true, name: st.coName });
    void i;
  });
  // 関係会社株式は、子会社の純資産（帳簿の額）の合計（株式移転）。今月の損益の分の差は資本準備金で調整
  const carry = Math.round(sum(g.subs, s => s.eq0));
  if (carry !== total) ksPost('hdAdj', carry > total ? [['subShares', carry - total, 0], ['capSurplus', 0, carry - total]] : [['capSurplus', total - carry, 0], ['subShares', 0, total - carry]], { u: 'HQ', desc: '子会社の株式の額の調整（株式移転）' });
  const groupHead = sum(g.subs, s => ksWith(s.st, ksHeadcount));
  g.hq = { staff: clamp(Math.round(groupHead * 0.01), 2, 300), wage: 45e4 };
  const groupSales = sum(g.subs, s => ksWith(s.st, ksAnnualSales));
  const rate = clamp(+((g.hq.staff * g.hq.wage * 1.15 + G.execPay * 1.15) * 12 * 1.15 / Math.max(1, groupSales)).toFixed(3), 0.01, 0.05);
  for (const s of g.subs) s.fee = rate;
  G.execPay = ksExecPayFor(groupSales);
  ksBudgetDraft(); ksBudgetApprove(true);
  G.startedM = G.m;
  G.customNote = `持株会社（子会社${g.subs.length}社）で始めました`;
  ksNews(`${G.ceo}氏が${G.coName}の代表取締役社長に就任。${g.subs.map(s => s.name).join('・')}を子会社に持つ持株会社`, 'info');
  return G;
}
