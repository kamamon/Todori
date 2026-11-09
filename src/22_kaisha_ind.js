'use strict';
/* =========================================================
 *  22_kaisha_ind.js : 会社経営モードの事業（業種）ごとの営業
 *   会社は事業 u（G.units）をいくつか持つ。事業の型（エンジン）が事業 u を動かす。
 *   init(u, cond)   開始時（4期前）の事業をつくる → 開始仕訳の材料を返す
 *   fresh(u)        途中から始める新規事業の初期状態 / plan(u) その設備投資の計画
 *   month(u, ctx)   1か月分の営業を仕訳にする → { mgAdj, kpi, extraLabor, afterPayroll }
 *   auto(u)         過去の期を自動で経営するときの判断 / need(u) 職種ごとの必要な人数
 *   stockCount(u)   決算の棚卸 → [{ acct, pacct, n, book, phys }] / afterCount(u)
 *   arTerms(u)      資金繰り表の入金の時期 [[何か月後, 売上に占める割合]]
 *   calib(u)        開始時に、業種の数字から利益率が業界の水準になるよう基準の単価を合わせる
 *  shop・rest・mfg・build・trade・pro はこのファイル、subs・cap・trans は 22b_kaisha_ind2.js
 * ========================================================= */

const KS_ENGINE = {};
const ksNoise = sd => Math.exp(randn() * sd);
const ksEcoF = beta => 1 + beta * (G.eco.idx - 1);
const ksPrice = () => G.eco.priceIdx;
/* 人員を目安に合わせる（自動経営用） */
function ksAutoStaff(u, roleId, need) {
  const cur = u.staff[roleId] || 0;
  const n = Math.max(0, Math.round(need));
  if (cur < n) u.staff[roleId] = cur + Math.min(n - cur, Math.max(2, Math.ceil(n * 0.15)));
  else if (cur > n + 1) u.staff[roleId] = cur - Math.max(1, Math.floor((cur - n) * 0.3));
}
function ksHire(u, roleId, n) { u.staff[roleId] = Math.max(0, (u.staff[roleId] || 0) + n); }
/* 評判（客足・取引先の信頼）が平常に戻ろうとする力。
   過去の期は、承継時の会社の状態（好調・普通・不振）に向かって数年かけて変わっていく */
function ksRepPull(rep) { return G.hist ? 0.025 * (rep - (G.repT ?? 1)) : 0.004 * (rep - 1); }
/* 事業 u の固定資産 */
function ksUA(u, acct) { const id = u.id; return G.assets.filter(a => a.soldM === undefined && a.u === id && (!acct || a.acct === acct)); }
function ksEqOf(a) { return KS_EQ[a.eq] || {}; }
function ksUKpi(u) { return u.kpi || {}; }
/* 棚卸の減耗（帳簿にあって実物がない分）は、帳簿の在庫の4分の1までにとどめる */
function ksShrinkAdd(hid, amt, book) { return Math.max(0, Math.min((hid || 0) + amt, Math.max(0, book) * 0.25)); }
function ksDaysOf(P) { return P.days >= 30 ? 30.4 : P.days; }
/* 資本金の目安（年商の6%、1,000万円〜5億円） */
function ksCapitalFor(annual) { return clamp(Math.round(annual * 0.06 / 1e7) * 1e7, 1e7, 5e8); }
/* ---------- 大きな会社：店・設備の記録をまとめる ----------
   店や設備が何千・何万とある会社でも、記録（セーブデータ・毎月の計算）が増えすぎないように、
   店は「まとまり」（k 店。都道府県ごとなど）、設備は「何台分か」（q 台）を1つの記録にする。
   k・q のない記録は1店・1台。数えるときは必ず ksStoresN・ksEqN を使う */
const KS_STORE_ROWS = 60;   // 開始時、これより多い店は都道府県ごとにまとめる
const KS_EQ_ROWS = 40;      // 開始時、同じ設備がこれより多いときは KS_EQ_ROWS の記録に分けてまとめる
function ksStoreK(s) { return (s && s.k) || 1; }
function ksStoresN(list) { return sum(list || [], ksStoreK); }
function ksEqQ(a) { return (a && a.q) || 1; }
function ksEqN(list) { return sum(list || [], ksEqQ); }
/* 二項分布の乱数（n が大きいときは正規分布で近似）：n 人のうち確率 p で起きる人数 */
function ksBinom(n, p) {
  n = Math.max(0, Math.round(n || 0));
  if (!n || p <= 0) return 0;
  if (n <= 60) { let k = 0; for (let i = 0; i < n; i++) if (chance(p)) k++; return k; }
  const m = n * p;
  return clamp(Math.round(m + Math.sqrt(m * (1 - p)) * randn()), 0, n);
}
/* 設備を数える言葉：船は隻、航空機は機、鉄道の車両は両（路面電車は編成、ケーブルカー・ロープウェイは基）、建物は棟、ほかは台 */
function ksEqWord(k) {
  const q = KS_EQ[k] || null;
  if (/^ship_/.test(k) || (q && q.e === 'trans' && q.cap > 1000)) return '隻';
  if (/^(ac_|heli|bizjet)/.test(k)) return '機';
  if (k === 'train_lrt') return '編成';
  if (k === 'train_cable') return '基';
  if (/^(train_|loco)/.test(k)) return '両';
  return q && q.a === 'bldg' ? '棟' : '台';
}
/* 事業のふだんの所在地（開始の前は、始め方で選んだ本社の都道府県） */
function ksUnitHomePref(u) {
  if (G.loc && typeof ksUnitPref === 'function') return ksUnitPref(u);
  return (u && u.prefInit) || G.pref0 || (typeof KS_HOME_PREF !== 'undefined' ? KS_HOME_PREF : 13);
}
/* 開始時の店の並び：KS_STORE_ROWS 店までは1店ずつ（本店・駅前店…）。それより多いときは、
   都道府県ごとのまとまり（人口に比例して配る。事業の所在地は2倍）。所在地のまとまりが先、あとは大きい順 */
function ksStoreGroups(u, n) {
  if (n <= KS_STORE_ROWS) return [...Array(n)].map((_, i) => ({ n: KS_STORE_NAMES[i] || `${i + 1}号店` }));
  if (typeof KS_PREFS === 'undefined') {
    const m = KS_STORE_ROWS;
    return [...Array(m)].map((_, i) => { const k = Math.round(n * (i + 1) / m) - Math.round(n * i / m); return Object.assign({ n: `第${i + 1}地区の店` }, k > 1 ? { k } : {}); });
  }
  const home = ksUnitHomePref(u);
  const ps = Object.values(KS_PREFS);
  const w = ps.map(p => p.pop * (p.c === home ? 2 : 1));
  const tot = sum(w, x => x);
  const raw = w.map(x => n * x / tot);
  const k = raw.map(Math.floor);
  const left = n - sum(k, x => x);
  raw.map((x, i) => [x - k[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => { k[i]++; });
  return ps.map((p, i) => Object.assign({ n: `${p.n}の店`, pref: p.c }, k[i] > 1 ? { k: k[i] } : {})).filter((x, i) => k[i] > 0)
    .sort((a, b) => (b.pref === home) - (a.pref === home) || ksStoreK(b) - ksStoreK(a));
}
/* 新しく出す店の名前と記録（k 店をまとめて出すこともできる）。店の多い会社は「○号店」の通し番号 */
function ksStoreNew(u, list, k = 1, mk = {}) {
  const N = ksStoresN(list);
  const big = N >= KS_STORE_ROWS || list.some(x => x.k > 1 || x.pref);
  const base = k > 1 ? `${fmtNum(N + 1, 0)}〜${fmtNum(N + k, 0)}号店` : big ? `${fmtNum(N + 1, 0)}号店` : ksStoreName(list);
  const used = new Set(list.map(x => x.n));
  let nm = base;
  for (let j = 2; used.has(nm); j++) nm = `${base}（${j}）`;
  const s = Object.assign({ n: nm }, mk);
  if (k > 1) s.k = k;
  if (big || k > 1) s.pref = ksUnitHomePref(u); // 都道府県があると、火災で1店を分けるときの名前に使う
  return s;
}
/* まとまりの中の1店を、別の記録に分ける（火災で1店だけ休業するときなど）。その店の分の資産（1/k）も分ける */
function ksStoreName1(list, s) {
  const used = new Set(list.map(x => x.n));
  const P = s.pref && typeof KS_PREFS !== 'undefined' ? KS_PREFS[s.pref] : null;
  const head = P ? P.s : s.n.replace(/の店$/, '');
  for (const x of KS_STORE_NAMES.slice(1)) if (!used.has(head + x)) return head + x;
  for (let i = 1; ; i++) if (!used.has(`${head}${i}号店`)) return `${head}${i}号店`;
}
function ksStoreSplit(u, s) {
  const list = u.op.stores || u.op.shops;
  const k = ksStoreK(s);
  if (k <= 1 || !list) return s;
  const one = Object.assign({}, s, { n: ksStoreName1(list, s) });
  delete one.k;
  if (k - 1 > 1) s.k = k - 1; else delete s.k;
  list.push(one);
  for (const a of ksUA(u).filter(x => x.n.startsWith(s.n + 'の') && !x.cip)) ksAssetSplit(a, 1 / k, one.n + a.n.slice(s.n.length));
  return one;
}
/* 資産の一部（frac）を、別の記録に分ける。取得価額・償却累計額の合計は変わらない */
function ksAssetSplit(a, frac, n) {
  const cost = Math.round(a.cost * frac), booked = Math.round(a.booked * frac);
  const b = Object.assign({}, a, { id: 'F' + (++G.seq), n: n || a.n, cost, booked });
  delete b.q;
  if (a.q > 1) { const qb = clamp(Math.round(a.q * frac), 1, a.q - 1); if (qb > 1) b.q = qb; if (a.q - qb > 1) a.q -= qb; else delete a.q; }
  if (a.cap) { b.cap = a.cap * frac; a.cap -= b.cap; }
  a.cost -= cost; a.booked -= booked;
  G.assets.push(b);
  return b;
}
/* まとめた設備のうち m 台を取り出す（売る・焼けるとき）。全部なら、その記録のまま */
function ksAssetTake(a, m) {
  const q = ksEqQ(a);
  if (m >= q) return a;
  const nm = a.n.replace(/ (\d+)〜\d+号$/, (x, f) => (m > 1 ? ` ${f}〜${+f + m - 1}号` : ` ${f}号`));
  const b = ksAssetSplit(a, m / q, nm);
  if (m > 1) b.q = m; else delete b.q;
  const rest = q - m;
  if (rest > 1) a.q = rest; else delete a.q;
  a.n = a.n.replace(/ (\d+)〜(\d+)号$/, (x, f, t) => (rest > 1 ? ` ${+f + m}〜${t}号` : ` ${t}号`));
  return b;
}
/* 設備のリストから資産をつくる。opening=true は開始時（取得の時期を過去にばらす）、false は今月の購入の計画（items を返す）
   台数が多いときは、何台かずつを1つの記録にまとめる（q 台分。能力 cap と取得価額は q 台分）。
   開始時（spread）は取得の時期をばらすため KS_EQ_ROWS の記録まで、買うときは1つの記録（o.rows で変えられる） */
function ksEqItems(u, list, o = {}) {
  const P = ksP(u);
  const items = [];
  for (const e of list) {
    const q = KS_EQ[e.k];
    if (!q) continue;
    const cnt = Math.max(e.n > 0 ? 1 : 0, Math.round(e.n * (o.mult ?? 1)));
    const lim = o.rows ?? KS_EQ_ROWS;
    const rows = cnt <= lim ? cnt : o.spread ? Math.min(cnt, KS_EQ_ROWS) : Math.max(1, Math.min(cnt, o.rows ?? 1));
    const cost = q.c ?? (q.k === 'line' ? (P.lineCost || 2e8) * (q.cm || 1) : 1e7);
    const cap = q.k === 'line' ? (P.lineCap || 0) * (q.cm || 1) : q.cap;
    let done = o.start || 0;
    for (let i = 0; i < rows; i++) {
      const qn = Math.round(cnt * (i + 1) / rows) - Math.round(cnt * i / rows);
      const nm = (e.name || q.n) + (qn > 1 ? ` ${done + 1}〜${done + qn}号` : cnt > 1 || o.numbered ? ` ${done + 1}号` : '');
      const it = { n: nm, acct: q.a, cost: Math.round(cost * qn * (o.priceF ?? 1)), life: q.l, part: o.part ?? 'C', cap: cap == null ? cap : cap * qn, eq: e.k, u: u.id, i, cnt: rows };
      if (qn > 1) it.q = qn;
      items.push(it);
      done += qn;
    }
  }
  return items;
}
function ksOpenEq(u, list, o = {}) {
  const from = o.oldest ?? -150, to = o.newest ?? KS_HIST_START - 6;
  for (const it of ksEqItems(u, list, Object.assign({ spread: true }, o))) {
    // inLife：耐用年数の短い設備は、耐用年数の中に取得の時期をばらす（すでに償却の終わったものばかりにしない）
    const f0 = o.inLife && it.life ? Math.min(to, Math.max(from, KS_HIST_START - Math.round(it.life * 12 * 0.9))) : from;
    // 1台だけの大きな設備（焼却炉・船など）は、開始の時点で耐用年数がまだ残るよう新しめにする
    const acqM = it.cnt > 1 ? Math.round(f0 + (to - f0) * it.i / (it.cnt - 1)) : o.inLife ? to : Math.round((f0 + to) / 2);
    ksOpenAsset(Object.assign({}, it, { acqM }));
  }
}
const KS_LOANS_STD = [{ bank: 'mirai', w: 1, termM: 120, startM: KS_HIST_START - 24, rate: 1.9 }, { bank: 'shinkin', w: 1, termM: 84, startM: KS_HIST_START - 6, rate: 2.2 }];

/* =========================================================
 *  shop：店舗で売る（小売・生活サービス）
 * ========================================================= */
const KS_STORE_NAMES = ['本店', '駅前店', '北部店', '港南店', '学園店', '東店', '西店', '中央店', '南店', 'ニュータウン店', '港店', '丘の上店', '空港店', '工業団地店', '浜通り店', '桜台店', '旭町店', '新町店'];
function ksStoreName(list) { const used = new Set(list.map(s => s.n)); return KS_STORE_NAMES.find(x => !used.has(x)) || `${list.length + 1}号店`; }
KS_ENGINE.shop = {
  ads0(u) { const P = ksP(u); return Math.max(1e4, Math.round(P.cust * ksDaysOf(P) * P.spend * 0.01 / 1e4) * 1e4); },
  newOp(u) { const P = ksP(u); return { stores: [], markup: P.gm, invDays: P.inv, ads: this.ads0(u), rentPer: P.rent, rep: 1, book: 0, hid: 0, base: P.cust, spend0: P.spend, gm0: P.gm }; },
  // 店（まとまりなら k 店分）の内装と設備
  storeItems(u, s, priceF = 1) {
    const P = ksP(u), k = ksStoreK(s);
    const names = P.eqn && P.eqn.length ? P.eqn : ['店の設備'];
    const items = [{ n: `${s.n}の内装・設備`, acct: 'bldg', cost: Math.round(P.fit * priceF * k), life: 15, part: 'S', u: u.id, store: s.n, what: 'fit' }];
    names.forEach((nm, i) => { const sh = names.length === 1 ? 1 : i === 0 ? 0.7 : 0.3 / (names.length - 1); items.push({ n: `${s.n}の${nm}`, acct: 'equip', cost: Math.round(P.eqc * sh * priceF * k), life: 6, part: 'S', u: u.id, store: s.n, what: 'eq' }); });
    return items.filter(x => x.cost > 0);
  },
  init(u, cond) {
    const P = ksP(u), sc = u.sc || 1;
    const n = Math.max(1, Math.round(P.stores * sc));
    const op = u.op = this.newOp(u);
    // 開店・改装・設備の更新の時期は、店（まとまり）ごとにずらす。11店（まとまり）より多いときは、改装と設備の時期が
    // 開始（過去4期の初め）より後にならないよう、くり返しにする
    const gs = ksStoreGroups(u, n), m = gs.length, cyc = m > 10;
    gs.forEach((s, i) => { const o = Math.min(-300 + i * Math.floor(240 / m), KS_HIST_START - 6); op.stores.push(Object.assign(s, { openM: o, renovM: Math.max(o, -130 + (cyc ? (i * 9) % 80 : i * 9)), eqM: Math.max(o, -84 + (cyc ? (i * 7) % 30 : i * 7)) })); });
    u.staff = { regular: P.staff[0] * n, part: P.staff[1] * n };
    for (const s of op.stores) for (const it of this.storeItems(u, s)) ksOpenAsset(Object.assign(it, { acqM: it.what === 'fit' ? s.renovM : s.eqM }));
    const salesM = n * P.cust * ksDaysOf(P) * op.spend0 * G.eco.priceIdx;
    const cogsM = P.svc ? 0 : salesM * (1 - P.gm);
    op.book = Math.round(cogsM * P.inv / 30.4);
    u.invB = P.svc ? {} : { goods: op.book };
    if (P.card) ksAddAR(salesM * P.card, KS_HIST_START, 0.026);
    if (P.ins) { ksAddAR(salesM * P.ins, KS_HIST_START); ksAddAR(salesM * P.ins, KS_HIST_START + 1); }
    if (cogsM) ksAddAP(cogsM, KS_HIST_START);
    return { cash: salesM * 0.6 * cond.cash, inv: P.svc ? {} : { goods: op.book }, deposit: P.dep * n, loans: KS_LOANS_STD, capital: ksCapitalFor(salesM * 12), annual: salesM * 12 };
  },
  fresh(u) { u.op = this.newOp(u); u.staff = { regular: 0, part: 0 }; u.invB = {}; },
  // k 店をまとめて出すこともできる（店の多い会社向け）
  plan(u, k = 1) {
    const P = ksP(u), p = ksPrice();
    k = Math.max(1, Math.round(k || 1));
    const s = ksStoreNew(u, u.op.stores, k, { openM: G.m + 3, renovM: G.m + 3, eqM: G.m + 3 });
    return { title: k > 1 ? `新しい店を${fmtNum(k, 0)}店出す（${s.n}）` : `${s.n}を出す`, desc: `新しい店を${k > 1 ? `${fmtNum(k, 0)}店` : ''}出します。開店まで3か月、客足が定着するまで1年ほど。必要な人員（${ksS(u).roles[0].n} ${fmtNum(P.staff[0] * k, 0)}人・${ksS(u).roles[1].n} ${fmtNum(P.staff[1] * k, 0)}人）の採用も忘れずに。`, items: this.storeItems(u, s, p), deposit: P.dep * k, fx: 'shopStore', arg: { u: u.id, s } };
  },
  storesOpen(u) { return u.op.stores.filter(s => s.openM <= G.m && !s.closed); },
  /* パートの必要人数は客数に合わせて変わる（シフトで調整する） */
  traffic(u) { const k = ksUKpi(u); const n = ksStoresN(this.storesOpen(u)); return k.cust ? clamp(k.cust / (u.op.base * Math.max(1, n)), 0.75, 1.3) : 1; },
  need(u) { const P = ksP(u); const n = ksStoresN(this.storesOpen(u)); return { regular: P.staff[0] * n, part: Math.round(P.staff[1] * n * this.traffic(u)) }; },
  staffCap(u) { const nd = this.need(u); return ((u.staff.regular || 0) + (u.staff.part || 0) * 0.45) / Math.max(1, nd.regular + nd.part * 0.45); },
  month(u, ctx) {
    const op = u.op, P = ksP(u);
    const open = this.storesOpen(u);
    const n = ksStoresN(open);
    ksPayRent(u, op.rentPer * ksStoresN(op.stores.filter(s => s.openM <= G.m + 1 && !s.closed)));
    if (!n) return { mgAdj: 0, kpi: { n: 0, sales: 0 } };
    const cap = this.staffCap(u);
    const staffF = 0.8 + 0.2 * Math.min(1, cap) ** 2;
    const ads0 = this.ads0(u);
    const adsF = 1 + 0.07 * (1 - Math.exp(-op.ads / (ads0 * 1.5))) - 0.035;
    const priceF = Math.exp(-3 * (op.markup - op.gm0) / Math.max(0.1, 1 - op.gm0));
    const stockF = !P.svc && op.invDays < P.inv * 0.75 ? 1 - 0.025 * (P.inv * 0.75 - op.invDays) * (12 / Math.max(1, P.inv)) : 1;
    let base = 0, eqAge = 0;
    for (const s of open) {
      const age = G.m - s.openM;
      const ramp = clamp(0.6 + 0.4 * age / 12, 0.6, 1);
      const ra = (G.m - s.renovM) / 12;
      const renovF = ra > 10 ? Math.max(0.85, 1 - 0.012 * (ra - 10)) : 1 + 0.03 * Math.max(0, 1 - ra / 2);
      const k = ksStoreK(s);
      base += op.base * ramp * renovF * (s.comp || 1) * k;
      eqAge += (G.m - s.eqM) / 12 * k / n;
    }
    const cust = base * ctx.season * ksEcoF(0.35) * priceF * adsF * staffF * stockF * op.rep * ksUpF(u) * ksNoise(0.025);
    const spend = op.spend0 * ksPrice() * (1 + 0.6 * (op.markup - op.gm0)) * ksNoise(0.01);
    const sales = cust * ksDaysOf(P) * spend;
    const eqF = eqAge > 8 ? 1.3 : 1;
    let mgAdj = 0, waste = 0, wasteRate = 0;
    if (P.svc) {
      ksPayCash('supplies', sales * (1 - op.markup), 'expense');
    } else {
      const cogsSold = sales * (1 - op.markup);
      wasteRate = P.waste * (op.invDays / Math.max(1, P.inv)) ** 1.3 * eqF * (cap < 0.9 ? 1.2 : 1);
      waste = sales * wasteRate;
      op.hid = ksShrinkAdd(op.hid, sales * 0.0025 * (cap < 0.9 ? 1.4 : 1) * ksShrinkF(u), op.book);
      const target = cogsSold * op.invDays / 30.4;
      const purchases = Math.max(0, cogsSold + waste + target - op.book);
      op.book += purchases - cogsSold - waste;
      ksBuyCredit('purch', purchases, 1, 'purch');
      mgAdj = cogsSold + waste - purchases;
    }
    const card = sales * P.card, ins = sales * P.ins;
    ksSaleCash(sales - card - ins);
    ksSaleCredit(card, 1, { card: true, fee: 0.026 });
    if (ins) ksSaleCredit(ins, 2);
    ksPayCash('util', P.util * n * eqF * (0.95 + 0.1 * ctx.season) * ksPrice() * ksEnF(u), 'expense');
    ksPayCash('ads', op.ads * n, 'ads');
    if (!P.svc) ksPayCash('supplies', sales * 0.008, 'expense');
    ksPayCash('repairs', P.eqc * 0.0036 * n * (eqAge > 8 ? 1.6 : 1), 'repairs');
    ksPayCash('fees', 12e4 * Math.sqrt(n), 'fees');
    ksPayCash('misc', 8e4 * n * Math.min(2, P.fit / 8000e4 + 0.5), 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', (P.fit + P.eqc) * 0.0026 * n, 'dues');
    op.rep = clamp(op.rep + 0.01 * ((staffF - 1) * 2 + (stockF - 1) * 2 + (op.gm0 - op.markup) * 2) - ksRepPull(op.rep), 0.75, 1.25);
    if (!G.hist && open.length && chance(0.012)) {
      // まとまり（k 店）の1店の近くなら、まとまり全体の客数は 7%÷k だけ減る
      const s = wpick(open, open.map(ksStoreK)), k = ksStoreK(s);
      s.comp = (s.comp || 1) * (1 - 0.07 / k);
      ksNews(k > 1 ? `${ksUName(u)}：${s.n}（${fmtNum(k, 0)}店）のうち1店の近くに競合店が開店。その店の客数が7%ほど減りそうです` : `${ksUName(u)}：${s.n}の近くに競合店が開店。客数が7%ほど減りそうです`, 'bad');
    }
    return { mgAdj, kpi: { cust, spend, sales, gpr: P.svc ? 1 : op.markup - wasteRate, invDays: op.invDays, waste, wasteRate, cap, n } };
  },
  auto(u) { const nd = this.need(u); ksAutoStaff(u, 'regular', nd.regular); ksAutoStaff(u, 'part', nd.part); },
  stockCount(u) { if (ksP(u).svc) return []; const op = u.op; return [{ acct: 'goods', pacct: 'purch', n: '商品', book: Math.round(op.book), phys: Math.max(0, Math.round(op.book - op.hid)) }]; },
  afterCount(u) { u.op.book = Math.max(0, u.op.book - u.op.hid); u.op.hid = 0; },
  arTerms(u) { const P = ksP(u); return [[1, P.card], [2, P.ins]].filter(x => x[1] > 0); },
  scale(u, k) { u.op.spend0 = Math.round(u.op.spend0 * k); },
  /* キャリブレーション：客単価の基準を、営業利益率が業界の水準になるように合わせる */
  calib(u, target) {
    const P = ksP(u), op = u.op;
    const n = Math.max(1, ksStoresN(op.stores));
    const sales = n * op.base * ksDaysOf(P) * op.spend0 * G.eco.priceIdx;
    const fixed = ksUnitFixedEst(u) + n * (op.rentPer + P.util * ksPrice() + op.ads + P.eqc * 0.0036 + 8e4) + 12e4 * Math.sqrt(n);
    const varR = P.svc ? (1 - P.gm) : (1 - P.gm) + P.waste + 0.008;
    const need = fixed / Math.max(0.05, 1 - varR - target);
    op.spend0 = Math.round(op.spend0 * clamp(need / sales, 0.6, 1.8));
  },
};

/* =========================================================
 *  rest：飲食店
 * ========================================================= */
KS_ENGINE.rest = {
  newOp(u) { const P = ksP(u); return { shops: [], price: 1.0, foodQ: P.fq, fq0: P.fq, ads: Math.max(1e4, Math.round(P.cust * P.days * P.spend * 0.003 / 1e4) * 1e4), rentPer: P.rent, base: P.cust, spend0: P.spend, rep: 1, book: 0, hid: 0 }; },
  // 店（まとまりなら k 店分）の内装と厨房機器
  shopItems(u, s, priceF = 1) {
    const P = ksP(u), k = ksStoreK(s);
    return [{ n: `${s.n}の内装`, acct: 'bldg', cost: Math.round(P.fit * priceF * k), life: 15, part: 'S', u: u.id, what: 'fit' }, { n: `${s.n}の${(P.eqn && P.eqn[0]) || '厨房機器'}`, acct: 'equip', cost: Math.round(P.eqc * priceF * k), life: 6, part: 'S', u: u.id, what: 'eq' }].filter(x => x.cost > 0);
  },
  init(u, cond) {
    const P = ksP(u), sc = u.sc || 1;
    const n = Math.max(1, Math.round(P.shops * sc));
    const op = u.op = this.newOp(u);
    // 1号店は古く、あとの店ほど新しい。11店（まとまり）より多いときは、25年より前にはさかのぼらず、開店から11年を超える店の内装・厨房機器は過去10年ほどの中で入れ替えている
    const gs = ksStoreGroups(u, n), m = gs.length;
    gs.forEach((s, i) => {
      const o = i === 0 ? -260 : Math.max(m > 10 ? -300 : -Infinity, Math.min(-70 - (m - 1 - i) * 30, KS_HIST_START - 6));
      const old = m > 10 && i > 0 && o < -130;
      const renovM = i === 0 ? -100 : old ? Math.max(o, KS_HIST_START - 6 - (i * 37) % 110) : o, kitM = i === 0 ? -80 : old ? Math.max(o, KS_HIST_START - 6 - (i * 23) % 80) : o;
      op.shops.push(Object.assign(s, { openM: o, renovM, kitM }));
    });
    u.staff = { cook: P.staff[0] * n, part: Math.round(P.staff[1] * n) };
    for (const s of op.shops) for (const it of this.shopItems(u, s)) ksOpenAsset(Object.assign(it, { acqM: it.what === 'fit' ? s.renovM : s.kitM }));
    const salesM = P.cust * n * P.days * op.spend0 * G.eco.priceIdx;
    op.book = Math.round(salesM * P.fq * 5 / 30);
    u.invB = { mat: op.book };
    ksAddAR(salesM * P.card, KS_HIST_START, 0.032);
    ksAddAP(salesM * P.fq * 1.03, KS_HIST_START);
    return { cash: salesM * 0.77 * cond.cash, inv: { mat: op.book }, deposit: P.dep * n, loans: [{ bank: 'shinkin', w: 1, termM: 84, startM: KS_HIST_START - 10, rate: 2.2 }, { bank: 'koko', w: 1, termM: 84, startM: KS_HIST_START - 4, rate: 1.6 }], capital: ksCapitalFor(salesM * 12), annual: salesM * 12 };
  },
  fresh(u) { u.op = this.newOp(u); u.staff = { cook: 0, part: 0 }; u.invB = {}; },
  plan(u, k = 1) {
    const P = ksP(u);
    k = Math.max(1, Math.round(k || 1));
    const s = ksStoreNew(u, u.op.shops, k, { openM: G.m + 3, renovM: G.m + 3, kitM: G.m + 3 });
    return { title: k > 1 ? `新しい店を${fmtNum(k, 0)}店出す（${s.n}）` : `${s.n}を出す`, desc: `新しい店を${k > 1 ? `${fmtNum(k, 0)}店` : ''}出します。開店まで3か月、客足が定着するまで9か月ほど。必要な人員（${ksS(u).roles[0].n} ${fmtNum(P.staff[0] * k, 0)}人・${ksS(u).roles[1].n} ${fmtNum(P.staff[1] * k, 0)}人）の採用も忘れずに。`, items: this.shopItems(u, s, ksPrice()), deposit: P.dep * k, fx: 'restShop', arg: { u: u.id, s } };
  },
  shopsOpen(u) { return u.op.shops.filter(s => s.openM <= G.m && !s.closed); },
  traffic(u) { const k = ksUKpi(u); return k.cust ? clamp(k.cust / u.op.base, 0.75, 1.3) : 1; },
  need(u) { const P = ksP(u); const n = ksStoresN(this.shopsOpen(u)); return { cook: P.staff[0] * n, part: Math.round(P.staff[1] * n * this.traffic(u)) }; },
  staffCap(u) { const nd = this.need(u); return ((u.staff.cook || 0) + (u.staff.part || 0) * 0.35) / Math.max(1, nd.cook + nd.part * 0.35); },
  month(u, ctx) {
    const op = u.op, P = ksP(u);
    const open = this.shopsOpen(u);
    const n = ksStoresN(open);
    const nRent = ksStoresN(op.shops.filter(s => s.openM <= G.m + 1 && !s.closed));
    ksPayRent(u, op.rentPer * nRent);
    if (!n) return { mgAdj: 0, kpi: { n: 0, sales: 0 } };
    const cap = this.staffCap(u);
    const staffF = 0.75 + 0.25 * Math.min(1, cap) ** 2;
    const ads0 = Math.max(1e4, Math.round(P.cust * P.days * P.spend * 0.003 / 1e4) * 1e4);
    const adsF = 1 + 0.06 * (1 - Math.exp(-op.ads / (ads0 * 1.5))) - 0.03;
    let base = 0, kitAge = 0;
    for (const s of open) {
      const ramp = clamp(0.65 + 0.35 * (G.m - s.openM) / 9, 0.65, 1);
      const ra = (G.m - s.renovM) / 12;
      const renovF = ra > 9 ? Math.max(0.85, 1 - 0.015 * (ra - 9)) : 1 + 0.04 * Math.max(0, 1 - ra / 2);
      const k = ksStoreK(s);
      base += op.base * ramp * renovF * (s.comp || 1) * k;
      kitAge += (G.m - s.kitM) / 12 * k / n;
    }
    op.rep = clamp(op.rep + 0.015 * ((op.foodQ - op.fq0) * 8 + (staffF - 1) * 2) - ksRepPull(op.rep), 0.7, 1.3);
    const cust = base * ctx.season * ksEcoF(0.6) * Math.pow(op.price, -1.4) * op.rep * adsF * staffF * ksUpF(u) * ksNoise(0.03);
    const spend = op.spend0 * ksPrice() * op.price;
    const sales = cust * P.days * spend;
    const foodCost = sales * op.foodQ;
    const waste = sales * 0.012 * (cap < 0.9 ? 1.3 : 1);
    op.hid = ksShrinkAdd(op.hid, sales * 0.003 * ksShrinkF(u), op.book);
    const target = foodCost * 5 / 30;
    const purchases = Math.max(0, foodCost + waste + target - op.book);
    op.book += purchases - foodCost - waste;
    const card = sales * P.card;
    ksSaleCash(sales - card);
    ksSaleCredit(card, 1, { card: true, fee: 0.032 });
    ksBuyCredit('purch', purchases, 1, 'purch');
    ksPayCash('util', sales * 0.045 * ksEnF(u), 'expense');
    ksPayCash('supplies', sales * 0.028, 'expense');
    ksPayCash('ads', op.ads * n, 'ads');
    ksPayCash('repairs', P.eqc * 0.0047 * n * (kitAge > 7 ? 2.2 : 1), 'repairs');
    ksPayCash('fees', 10e4 * Math.sqrt(n / 2), 'fees');
    ksPayCash('misc', 3e4 * n, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 8e4 * n, 'dues');
    if (!G.hist && kitAge > 8 && chance(0.04)) {
      const amt = niceAmount(uni(60e4, 180e4));
      ksPayCash('repairs', amt, 'repairs');
      ksNews(`${ksUName(u)}：厨房の冷蔵庫が故障し、修理に${fmtYen(amt)}かかりました。厨房機器が古くなっています`, 'bad');
    }
    return { mgAdj: foodCost + waste - purchases, kpi: { cust: cust / Math.max(1, n), spend, sales, foodRate: op.foodQ + waste / Math.max(1, sales), cap, n, rentRate: op.rentPer * n / Math.max(1, sales) } };
  },
  auto(u) { const nd = this.need(u); ksAutoStaff(u, 'cook', nd.cook); ksAutoStaff(u, 'part', nd.part); },
  stockCount(u) { const op = u.op; return [{ acct: 'mat', pacct: 'purch', n: '原材料（食材）', book: Math.round(op.book), phys: Math.max(0, Math.round(op.book - op.hid)) }]; },
  afterCount(u) { u.op.book = Math.max(0, u.op.book - u.op.hid); u.op.hid = 0; },
  arTerms(u) { return [[1, ksP(u).card]]; },
  scale(u, k) { u.op.spend0 = Math.round(u.op.spend0 * k); },
  calib(u, target) {
    const P = ksP(u), op = u.op;
    const n = Math.max(1, ksStoresN(op.shops));
    const sales = n * op.base * P.days * op.spend0 * G.eco.priceIdx;
    const fixed = ksUnitFixedEst(u) + n * (op.rentPer + op.ads + P.eqc * 0.0047 + 3e4) + 10e4;
    const need = fixed / Math.max(0.05, 1 - P.fq - 0.012 - 0.045 - 0.028 - target);
    op.spend0 = Math.round(op.spend0 * clamp(need / sales, 0.6, 1.8));
  },
};

/* =========================================================
 *  mfg：ものづくり（受注加工 job・量産 line・農林水産）
 * ========================================================= */
KS_ENGINE.mfg = {
  newOp(u) {
    const P = ksP(u);
    const line = P.mode === 'line';
    const sMax = Math.max(...ksS(u).season);
    return { mode: line ? 'line' : 'job', rate: P.price, ref: P.price, mat: P.mat, base: P.base * (u.sc || 1), base0: P.base * (u.sc || 1), rep: 1, ot: 0.1, matDays: P.matDays, fgDays: P.fgDays, matBook: 0, matHid: 0, wip: 0, prod: 0, outsource: false, big: null, harvest: line && sMax > 1.6, office0: Math.max(1, Math.round(P.office * Math.sqrt(u.sc || 1))) };
  },
  init(u, cond) {
    const P = ksP(u), S = ksS(u), sc = u.sc || 1;
    const op = u.op = this.newOp(u);
    // キャリブレーションする業種は、設備の取得の時期を耐用年数の中にばらす（以前からの町工場は古い機械が残る）
    ksOpenEq(u, S.eq, { mult: sc, numbered: S.eq.length === 1 && op.mode === 'job', inLife: !!S.calib });
    ksOpenEq(u, S.aux, { mult: Math.sqrt(sc), oldest: -100, newest: KS_HIST_START - 4, inLife: !!S.calib });
    if (P.bldg) ksOpenAsset({ n: '工場の建物', acct: 'bldg', cost: Math.round(P.bldg * sc ** 0.7), acqM: -240, life: 31, part: 'C', u: u.id });
    if (P.land) ksOpenAsset({ n: '工場の土地', acct: 'land', cost: Math.round(P.land * sc ** 0.7), acqM: -300, u: u.id });
    ksOpenAsset({ n: '事務所のパソコン・什器', acct: 'equip', cost: Math.round(300e4 * Math.sqrt(sc)), acqM: KS_HIST_START - 20, life: 6, u: u.id });
    ksOpenAsset({ n: '納品用トラック', acct: 'veh', cost: 380e4, acqM: KS_HIST_START - 24, life: 5, u: u.id });
    u.staff = { worker: Math.max(1, Math.round(this.workersNeeded(u, op.base))), office: op.office0 };
    const salesM = this.salesFor(u, op.base);
    const matUsed = op.base * op.mat;
    op.matBook = Math.round(matUsed * op.matDays / 30);
    const pc = matUsed + u.staff.worker * P.wage * 1.15 + op.base * (op.mode === 'job' ? 600 : P.energy);
    op.wip = Math.round(pc * (op.mode === 'job' ? 0.3 : 0.1));
    op.prod = Math.round(pc * (op.mode === 'job' ? 0.08 : op.fgDays / 30));
    u.invB = { mat: op.matBook, wip: op.wip, prod: op.prod };
    for (let k = 0; k < P.terms; k++) ksAddAR(salesM, KS_HIST_START + k);
    ksAddAP(matUsed, KS_HIST_START);
    return {
      cash: salesM * 1.22 * cond.cash, inv: { mat: op.matBook, wip: op.wip, prod: op.prod },
      loans: [{ bank: 'mirai', w: 1, termM: 120, startM: KS_HIST_START - 12, rate: 1.7 }, { bank: 'koko', w: 1, termM: 120, startM: KS_HIST_START - 6, rate: 1.4 }, { bank: 'mirai', w: 1, termM: 12, startM: KS_HIST_START - 2, rate: 1.6, repay: 'bullet', kind: 'tegata', purpose: 'working', roll: true }],
      capital: ksCapitalFor(salesM * 12 * 0.8), annual: salesM * 12,
    };
  },
  fresh(u) { u.op = this.newOp(u); u.op.ramp = G.m; u.staff = { worker: 0, office: 0 }; u.invB = {}; },
  plan(u) {
    const S = ksS(u);
    const items = ksEqItems(u, S.eq, { mult: Math.max(0.3, (u.sc || 1) * 0.4), priceF: ksPrice() }).concat(ksEqItems(u, S.aux.slice(0, 2), { mult: 0.5, priceF: ksPrice() }));
    return { title: `${S.name}の工場を立ち上げる`, desc: `設備を入れて生産を始めます。最初は小さな規模で、取引先が増えるにつれて注文が増えます。作業者の採用も忘れずに。`, items, fx: 'unitStart', arg: { u: u.id } };
  },
  machines(u) { return ksUA(u).filter(a => { const q = ksEqOf(a); return q.e === 'mfg' && (q.k === 'job' || q.k === 'line'); }); },
  auxs(u) { return ksUA(u).filter(a => ksEqOf(a).k === 'aux'); },
  // 補助の設備の効き目の合計（まとめた記録は q 台分）。上限 capV、電力の削減（マイナス）は30%まで
  auxSum(u, key, capV = 1) { return clamp(sum(this.auxs(u), a => (ksEqOf(a)[key] || 0) * ksEqQ(a)), -0.3, capV); },
  premium(u) { return this.machines(u).concat(this.auxs(u)).reduce((m, a) => Math.max(m, ksEqOf(a).pr || 1), 1) * (1 + this.auxSum(u, 'q', 0.08)); },
  capMach(u) { return sum(this.machines(u), a => (a.cap || 200 * ksEqQ(a)) * (G.m - a.acqM > (a.life || 10) * 14.4 ? 0.9 : 1)) * (1 + this.auxSum(u, 'avail', 0.12)); },
  labPerUnit(u) {
    const ms = this.machines(u);
    const P = ksP(u);
    const tot = sum(ms, a => a.cap || 0) || 1;
    const lab = u.op.mode === 'line' ? sum(ms, a => (P.lineLab || 8) * ksEqQ(a)) / tot * 150 : sum(ms, a => (a.cap || 0) * (ksEqOf(a).lab ?? 1)) / tot;
    return lab * (1 - this.auxSum(u, 'auto', 0.4));
  },
  workersNeeded(u, units) { return units * this.labPerUnit(u) / 150 / (1 + u.op.ot); },
  capacity(u) {
    const workerH = (u.staff.worker || 0) * 150 * (1 + u.op.ot);
    return Math.min(this.capMach(u), workerH / Math.max(1e-6, this.labPerUnit(u)));
  },
  salesFor(u, units) { const op = u.op; return op.mode === 'job' ? units * op.rate + units * op.mat * 1.1 : units * (op.rate + this.slide(u)); },
  /* 量産品の材料スライド：材料の相場（matIdx）の動きの7割を、製品の値段に上乗せ（値下げ）する（銅建値・鋼材価格の連動など） */
  slide(u) { const op = u.op; return op.mode === 'line' ? op.mat * ((G.eco.matIdx || 1) - 1) * 0.7 : 0; },
  demand(u, ctx) {
    const op = u.op;
    const priceF = Math.exp(-(op.rate / (op.ref * ksPrice()) - 1) * (op.mode === 'job' ? 2.5 : 2));
    const seasonF = op.harvest ? 1 : ctx.season;
    return op.base * seasonF * ksEcoF(op.mode === 'job' ? 1.3 : 0.9) * priceF * op.rep * this.premium(u) * ksUpF(u) * ksStartRamp(u) + (op.big ? op.big.h : 0);
  },
  need(u) { const k = ksUKpi(u); return { worker: this.workersNeeded(u, Math.min(this.capMach(u), (k.demand || u.op.base) * 1.02)), office: u.op.office0 }; },
  month(u, ctx) {
    const op = u.op, e = G.eco, P = ksP(u);
    const capM = this.capMach(u) * (op.harvest ? ctx.season : 1);
    const lab = this.labPerUnit(u);
    const workerH = (u.staff.worker || 0) * 150;
    const capacity = Math.min(capM, workerH * (1 + op.ot) / Math.max(1e-6, lab));
    const demand = this.demand(u, ctx) * (op.harvest ? ctx.season : 1) * ksNoise(0.05);
    const units = Math.min(demand, capacity);
    const extra = op.outsource ? Math.min(Math.max(0, demand - units), capacity * 0.2) : 0;
    const otH = Math.max(0, units * lab - workerH);
    const otPay = otH * (P.wage * e.wageIdx / 150) * 1.25;
    const short = demand > 0 ? (demand - units - extra) / demand : 0;
    op.rep = clamp(op.rep + 0.012 * (short > 0.05 ? -short * 3 : 0.02) - ksRepPull(op.rep), 0.7, 1.25);
    const matUsed = (units + (op.mode === 'job' ? extra : 0)) * op.mat * e.matIdx;
    const sales = this.salesFor(u, units + extra) * (op.mode === 'job' ? 1 : 1);
    const target = matUsed * op.matDays / 30;
    const purchases = Math.max(0, matUsed + target - op.matBook);
    op.matBook += purchases - matUsed;
    op.matHid = ksShrinkAdd(op.matHid, matUsed * 0.004 * ksShrinkF(u) * (1 - this.auxSum(u, 'shrink', 0.7) * 0.5), op.matBook);
    ksSaleCredit(sales, P.terms);
    ksBuyCredit('matPurch', purchases, 1, 'matPurch');
    const ms = this.machines(u);
    const nM = ksEqN(ms);
    const oldM = ksEqN(ms.filter(a => G.m - a.acqM > (a.life || 10) * 12));
    const enF = (1 + this.auxSum(u, 'energy', 0)) * ksEnF(u);
    let elec, tools;
    if (op.mode === 'job') { elec = (nM * 4e4 + units * P.energy) * ksPrice() * enF; tools = units * 300 * ksPrice(); }
    else { elec = (nM * 20e4 + units * P.energy) * ksPrice() * enF; tools = units * op.mat * 0.01; }
    const rep = (sum(ms, a => a.cost) * 0.0013 + oldM * 3e4) * ksPrice();
    ksPayCash('mfgExp', elec + tools + rep, 'mfgExp');
    if (extra > 0) ksBuyCredit('subcon', (op.mode === 'job' ? extra * op.rate * 0.85 : extra * op.rate * 0.9), 1, 'subcon');
    ksPayCash('freight', sales * 0.012, 'freight');
    ksPayCash('fees', 15e4 * Math.sqrt(u.sc || 1), 'fees');
    ksPayCash('misc', 10e4 * Math.sqrt(u.sc || 1), 'expense');
    ksPayCash('ads', 5e4, 'ads');
    ksPayCash('util', 6e4, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 25e4 * Math.sqrt(u.sc || 1), 'dues');
    if (!G.hist && oldM && chance(0.03 * Math.min(4, oldM))) {
      const amt = niceAmount(uni(80e4, 300e4) * Math.sqrt(u.sc || 1));
      ksPayCash('mfgExp', amt, 'mfgExp');
      ksNews(`${ksUName(u)}：古い設備が故障し、修理に${fmtYen(amt)}かかりました（製造経費）`, 'bad');
    }
    // 仕掛品と製品（その月に作ったものの一部が月末に残る）
    const wipB = op.wip, prodB = op.prod;
    const laborEst = (u.staff.worker || 0) * P.wage * e.wageIdx * 1.15 + otPay;
    const pc = matUsed + laborEst + elec + tools + rep;
    op.wip = Math.round(pc * (op.mode === 'job' ? 0.3 : 0.1) * (units > 0 ? 1 : 0));
    op.prod = Math.round(pc * (op.mode === 'job' ? 0.08 : op.fgDays / 30) * (units > 0 ? 1 : 0));
    if (op.big) { op.big.left--; if (op.big.left <= 0) { ksNews(`${ksUName(u)}：${op.big.n}の大口注文が終わりました`, 'info'); op.big = null; } }
    // 営業の人数と評判で、取引先（注文の基準）が少しずつ増減する
    const officeF = (u.staff.office || 0) / Math.max(1, op.office0);
    op.base = clamp(op.base * (1 + 0.004 * (officeF - 1) + 0.004 * (op.rep - 1)), op.base0 * 0.6, op.base0 * 4);
    return { extraLabor: otPay, mgAdj: (matUsed - purchases) + (wipB + prodB - op.wip - op.prod), kpi: { demand, capacity, capM, workerH: workerH / Math.max(1e-6, lab), hours: units, util: units / Math.max(1, capacity), short, rate: op.rate, slide: this.slide(u), sales, extra, unit: op.mode === 'job' ? '時間' : P.unit } };
  },
  auto(u) {
    const op = u.op;
    // 加工賃は10円単位、製品の単価は単価の大きさに合わせた刻み（画面の刻みと同じ）
    const r = op.ref * ksPrice(), st = op.mode === 'job' ? 10 : Math.max(0.01, +(op.ref / 200).toPrecision(1));
    op.rate = Math.round(r / st) * st;
    const d = op.base * ksEcoF(1.3) * op.rep;
    ksAutoStaff(u, 'worker', this.workersNeeded(u, Math.min(this.capMach(u), d * 1.02)) + 0.5);
    ksAutoStaff(u, 'office', op.office0);
  },
  stockCount(u) {
    const op = u.op;
    return [
      { acct: 'mat', pacct: 'matPurch', n: '原材料', book: Math.round(op.matBook), phys: Math.max(0, Math.round(op.matBook - op.matHid)) },
      { acct: 'wip', pacct: 'invChg', n: '仕掛品', book: op.wip, phys: op.wip },
      { acct: 'prod', pacct: 'invChg', n: '製品', book: op.prod, phys: op.prod },
    ];
  },
  afterCount(u) { u.op.matBook = Math.max(0, u.op.matBook - u.op.matHid); u.op.matHid = 0; },
  arTerms(u) { const t = ksP(u).terms; return [[t, 1]]; },
  scale(u, k) { const op = u.op; op.ref = op.ref * k; op.rate = op.rate * k; },
  calib(u, target) {
    const P = ksP(u), op = u.op;
    const units = Math.min(op.base, this.capMach(u) * 0.95);
    const labor = this.workersNeeded(u, units) * P.wage * 1.3;
    const ms = this.machines(u);
    const dep = sum(ksUA(u), a => (a.life ? a.cost / a.life / 12 : 0));
    const elec = op.mode === 'job' ? ksEqN(ms) * 4e4 + units * (P.energy + 300) : ksEqN(ms) * 20e4 + units * (P.energy + op.mat * 0.01);
    const other = sum(ms, a => a.cost) * 0.0013 + 40e4 + ksUnitFixedEst(u) - (u.staff.worker || 0) * P.wage * G.eco.wageIdx * (1 + 2 / 12) * 1.15;
    const matCost = units * op.mat;
    const fixed = labor + dep + elec + other;
    if (op.mode === 'job') {
      // 売上 = 時間×加工賃 + 材料×1.1。加工賃を合わせる
      const need = (fixed + matCost + units * op.mat * 0.012 * 1.1) / Math.max(0.05, 1 - target - 0.012) - units * op.mat * 1.1;
      op.ref = op.rate = Math.round(clamp(need / Math.max(1, units), op.ref * 0.5, op.ref * 2) / 10) * 10;
    } else {
      const need = (fixed + matCost) / Math.max(0.05, 1 - target - 0.012);
      op.ref = op.rate = Math.round(clamp(need / Math.max(1, units), op.ref * 0.5, op.ref * 2) * 100) / 100;
    }
  },
};

/* =========================================================
 *  build：工事を請け負う
 * ========================================================= */
function ksProjW(u) { return (ksP(u).proj || []).map(s => { const [k, w] = String(s).split(':'); return [k, +w || 1]; }).filter(([k]) => KS_PROJ_LIB[k]); }
/* 大きな工事ばかりの業種は、年に数件しか完成せず売上が大きく波打つ。中小〜中堅の会社としては、
   分割発注の工区や機器の一部など、小さめの単位で請けることが多い。見積依頼が月 KS_BUILD_MIN_INQ 件より少ない業種は、
   工事の規模（psz）を小さく、件数を多くする（工期は少し短く、手間は規模の0.7乗）。
   大きな会社で見積依頼が月 KS_BUILD_MAX_INQ 件より多くなるときは、件数をそこまでにして、1件の規模（psz）を大きくする
   （手間も規模に比例。記録と画面の件数が増えすぎないように） */
const KS_BUILD_MIN_INQ = 1.6, KS_BUILD_MAX_INQ = 24;
function ksProjSpec(u, type) {
  const T = KS_PROJ_LIB[type] || {};
  const psz = (u.op && u.op.psz) || 1, amt = psz * ((u.op && u.op.amtK) || 1);
  return { T, psz, min: T.min * amt, max: T.max * amt, dur: psz < 1 ? Math.max(2, Math.round(T.dur * (0.5 + 0.5 * psz))) : T.dur, load: (T.load || 1) * (psz < 1 ? psz ** 0.7 : psz), n: psz < 0.6 ? `${T.n}（一部）` : psz >= 2.5 ? `${T.n}（大型）` : T.n };
}
KS_ENGINE.build = {
  newOp(u) { const P = ksP(u); const ex = P.inq * (u.sc || 1); const psz = ex > KS_BUILD_MAX_INQ ? ex / KS_BUILD_MAX_INQ : ex >= KS_BUILD_MIN_INQ ? 1 : Math.max(0.1, ex / KS_BUILD_MIN_INQ); return { margin: P.margin, ads: Math.round(30e4 * Math.sqrt(u.sc || 1) / 1e4) * 1e4, rep: 1, projects: [], bids: [], doneFY: {}, pseq: 0, mkt: P.margin - 0.005, inq: ex / psz, psz, amtK: 1 }; },
  equip(u) { return ksUA(u).filter(a => ksEqOf(a).e === 'build'); },
  subCut(u) { return Math.min(0.12, sum(this.equip(u), a => (ksEqOf(a).sub || 0) * ksEqQ(a))); },
  premium(u) { return this.equip(u).reduce((m, a) => Math.max(m, ksEqOf(a).pr || 1), 1); },
  init(u, cond) {
    const P = ksP(u), S = ksS(u), sc = u.sc || 1;
    const op = u.op = this.newOp(u);
    u.staff = { site: Math.max(1, Math.round(P.site * sc)), office: Math.max(1, Math.round(P.office * Math.sqrt(sc))) };
    if (S.eq.length) ksOpenEq(u, S.eq, { mult: Math.sqrt(sc), oldest: KS_HIST_START - 60, newest: KS_HIST_START - 6, part: 'S' });
    else {
      ksOpenAsset({ n: '現場用トラック 1号', acct: 'veh', cost: 320e4, acqM: KS_HIST_START - 40, life: 5, u: u.id });
      ksOpenAsset({ n: '現場用トラック 2号', acct: 'veh', cost: 320e4, acqM: KS_HIST_START - 20, life: 5, u: u.id });
      ksOpenAsset({ n: '軽バン', acct: 'veh', cost: 180e4, acqM: KS_HIST_START - 10, life: 5, u: u.id });
    }
    ksOpenAsset({ n: '設計用パソコン・CAD', acct: 'equip', cost: Math.round(260e4 * Math.sqrt(sc)), acqM: KS_HIST_START - 25, life: 6, u: u.id });
    // 施工中の工事
    const W = ksProjW(u);
    const avgDur = sum(W, ([k, w]) => ksProjSpec(u, k).dur * w) / Math.max(1, sum(W, x => x[1]));
    const nP = Math.max(1, Math.round(op.inq * 0.45 * avgDur * (S.calib ? 0.9 : 0.55)));
    let cwip = 0, adv = 0, sales = 0;
    for (let i = 0; i < nP; i++) {
      const type = wpick(W.map(x => x[0]), W.map(x => x[1]));
      const T = KS_PROJ_LIB[type];
      const dur = ksProjSpec(u, type).dur;
      const done = Math.max(1, Math.min(dur - 1, randInt(1, dur)));
      const p = this.newProject(u, type, op.margin, KS_HIST_START - done);
      for (let k = 0; k < done; k++) { p.costToDate += p.cost / p.dur; p.parts.mat += p.cost / p.dur * T.mat; p.parts.sub += p.cost / p.dur * T.sub; p.parts.exp += p.cost / p.dur * T.exp; }
      for (const [k, sh] of KS_PAYS[T.pay]) if (k === 'c' || (typeof k === 'number' && k < done)) p.recv += p.contract * sh;
      p.costToDate = Math.round(p.costToDate); p.recv = Math.round(p.recv);
      cwip += p.costToDate; adv += p.recv; sales += p.contract / p.dur;
      op.projects.push(p);
    }
    u.invB = { cwip };
    const salesM = Math.max(sales, op.inq * 0.45 * sum(W, ([k, w]) => (ksProjSpec(u, k).min + ksProjSpec(u, k).max) / 2 * w) / Math.max(1, sum(W, x => x[1])));
    ksAddAR(salesM * 0.6, KS_HIST_START);
    ksAddAP(salesM * 0.8, KS_HIST_START);
    return {
      cash: salesM * 1.3 * cond.cash, inv: { cwip }, deposit: 200e4 * Math.sqrt(sc), extra: { advRecv: adv },
      loans: [{ bank: 'shinkin', w: 1, termM: 84, startM: KS_HIST_START - 6, rate: 2.1 }, { bank: 'mirai', w: 1, termM: 12, startM: KS_HIST_START - 4, rate: 1.8, repay: 'bullet', kind: 'tegata', purpose: 'working', roll: true }],
      capital: ksCapitalFor(salesM * 12 * 0.5), annual: salesM * 12,
    };
  },
  fresh(u) { u.op = this.newOp(u); u.op.ramp = G.m; u.staff = { site: 0, office: 0 }; u.invB = {}; },
  plan(u) {
    const S = ksS(u);
    const items = S.eq.length ? ksEqItems(u, S.eq.slice(0, 3), { mult: 0.5, priceF: ksPrice(), part: 'S' }) : [{ n: '現場用トラック', acct: 'veh', cost: Math.round(320e4 * ksPrice()), life: 5, part: 'S', u: u.id }];
    items.push({ n: '設計用パソコン・CAD', acct: 'equip', cost: Math.round(260e4 * ksPrice()), life: 6, part: 'S', u: u.id });
    return { title: `${S.name}を始める`, desc: '機材をそろえて工事の請負を始めます。最初は見積の依頼が少なく、実績が増えるにつれて増えます。現場の職種の採用も忘れずに。', items, fx: 'unitStart', arg: { u: u.id } };
  },
  newProject(u, type, margin, startM, b) {
    const sp = ksProjSpec(u, type);
    const T = sp.T;
    const est = b ? b.est : niceAmount(uni(sp.min, sp.max) * ksPrice()) / (1 + margin);
    const contract = niceAmount(est * (1 + margin));
    const eq = this.equip(u);
    const loadR = this.load(u) / Math.max(1, (u.staff.site || 0) * 3 + sum(eq, a => (ksEqOf(a).load || 0) * ksEqQ(a)));
    const subCut = Math.min(0.12, sum(eq, a => (ksEqOf(a).sub || 0) * ksEqQ(a)));
    return { id: 'P' + (++u.op.pseq), type, n: b ? b.n : sp.n, client: b ? b.client : ksClientName(T.cl), contract, est, cost: Math.round(est * (1 + randn() * (b ? 0.035 : 0.03)) * (b && loadR > 1 ? 1.03 : 1) * (1 - subCut * T.sub)), dur: b ? b.dur : sp.dur, load: sp.load, startM, costToDate: 0, recv: 0, parts: { mat: 0, sub: 0, exp: 0 }, over: 0 };
  },
  load(u) { return sum(u.op.projects.filter(p => !p.fin), p => p.load ?? (KS_PROJ_LIB[p.type] || { load: 1 }).load); },
  loadCap(u) { return (u.staff.site || 0) * 3 + sum(this.equip(u), a => (ksEqOf(a).load || 0) * ksEqQ(a)); },
  winP(u, margin, b, prem) { const op = u.op; const mu = op.mkt + 0.05 * (op.rep - 1) + (b ? b.mu : 0) + 0.02 * ((prem ?? this.premium(u)) - 1) * 10; return 1 / (1 + Math.exp((margin - mu) / 0.025)); },
  inquiries(u, ctx) {
    const op = u.op;
    const lam = op.inq * ctx.season * ksEcoF(0.8) * (1 + 0.1 * (1 - Math.exp(-op.ads / (40e4 * Math.sqrt(u.sc || 1)))) - 0.05) * op.rep * ksUpF(u) * ksStartRamp(u);
    const n = poisson(lam);
    const W = ksProjW(u);
    const bids = [];
    for (let i = 0; i < n; i++) {
      const type = wpick(W.map(x => x[0]), W.map(x => x[1]));
      const sp = ksProjSpec(u, type), T = sp.T;
      if (G.law && G.law.kyokaLost && sp.min > 500e4) continue;
      const est = niceAmount(uni(sp.min, sp.max) / 1.22 * ksPrice());
      bids.push({ id: 'B' + (++op.pseq), type, n: sp.n, client: ksClientName(T.cl), est, dur: sp.dur, load: sp.load, margin: op.margin, on: true, mu: randn() * 0.025 });
    }
    return bids;
  },
  need(u) { return { site: Math.max(2, this.load(u) / 2.6), office: Math.max(1, Math.round(ksP(u).office * Math.sqrt(u.sc || 1))) }; },
  month(u, ctx) {
    const op = u.op;
    if (!op.bids.length && G.hist) op.bids = this.inquiries(u, ctx);
    const loadR = this.load(u) / Math.max(1, this.loadCap(u));
    let doneSales = 0, doneCost = 0, completed = 0;
    for (const p of op.projects) {
      if (p.fin || p.startM > G.m) continue;
      const T = KS_PROJ_LIB[p.type];
      const k = G.m - p.startM;
      if (!p.over && k === Math.floor(p.dur / 2) && chance(0.1 * (loadR > 1 ? 2 : 1))) {
        p.over = uni(0.06, 0.2);
        ksNews(`${p.client}の${p.n}で追加の手直しが発生。原価が${fmtPct(p.over * 100, 0)}ほど膨らみそうです`, 'bad');
      }
      const c = p.cost / p.dur * (1 + p.over);
      const mat = c * T.mat, sub = c * T.sub, ex = c * T.exp;
      ksBuyCredit('cwip', mat + sub, 1, 'cwipMat');
      ksPayCash('cwip', ex, 'cwipExp', 'purchPay');
      p.costToDate += Math.round(mat + sub) + Math.round(ex);
      p.parts.mat += mat; p.parts.sub += sub; p.parts.exp += ex;
      for (const [kk, sh] of KS_PAYS[T.pay]) if (kk === k) { const a = Math.round(p.contract * sh); ksPost('advRecv', [['cash', a, 0], ['advRecv', 0, a]], { cf: 'collect' }); p.recv += a; }
      if (k >= p.dur - 1) {
        const rest = p.contract - p.recv;
        const lagDone = (KS_PAYS[T.pay].find(x => x[0] === 'done') || [0, 0, 1])[2] || 1;
        ksPost('conDone', [['advRecv', p.recv, 0], ['ar', rest, 0], ['sales', 0, p.contract]], { desc: `工事の完成・引渡し（${p.client}・${p.n}）`, key: p.id });
        ksAddAR(rest, G.m + lagDone, 0, p.id);
        ksPost('conDone', [['conCost', p.costToDate, 0], ['cwip', 0, p.costToDate]], { key: p.id + 'c' });
        p.fin = true; p.doneM = G.m;
        const fy = fyOf(G.m);
        const d = op.doneFY[fy] || (op.doneFY[fy] = { mat: 0, sub: 0, exp: 0, n: 0, sales: 0, cost: 0 });
        d.mat += p.parts.mat; d.sub += p.parts.sub; d.exp += p.parts.exp; d.n++; d.sales += p.contract; d.cost += p.costToDate;
        doneSales += p.contract; doneCost += p.costToDate; completed++;
        if (!G.hist) ksNews(`${p.client}の${p.n}が完成し、引き渡しました（完成工事高 ${fmtYen(p.contract)}・工事利益 ${fmtYen(p.contract - p.costToDate)}）`, p.contract > p.costToDate ? 'good' : 'bad');
        if (!G.hist && chance(0.015)) { const amt = Math.round(rest * 0.5); ksWriteOffAR(p.id, 0.5); ksNews(`${p.client}の支払いが滞り、残金のうち${fmtYen(amt)}が回収できなくなりました`, 'bad'); }
      }
    }
    op.projects = op.projects.filter(p => !p.fin || G.m - p.doneM < 3);
    let won = 0;
    const prem = this.premium(u);
    for (const b of op.bids) {
      if (!b.on) continue;
      if (rand() < this.winP(u, b.margin, b, prem)) {
        const p = this.newProject(u, b.type, b.margin, G.m + 1, b);
        const T = KS_PROJ_LIB[b.type];
        const dep = KS_PAYS[T.pay].find(x => x[0] === 'c');
        if (dep) { const a = Math.round(p.contract * dep[1]); ksPost('advRecv', [['cash', a, 0], ['advRecv', 0, a]], { cf: 'collect', desc: '契約金の受取' }); p.recv += a; }
        op.projects.push(p);
        won++;
        if (!G.hist) ksNews(`${p.client}の${p.n}を受注しました（請負金額 ${fmtYen(p.contract)}・見積利益率 ${fmtPct(b.margin * 100, 0)}）`, 'good');
      }
    }
    op.bids = [];
    op.rep = clamp(op.rep + 0.01 * (loadR > 1.05 ? -(loadR - 1) * 2 : 0.02) - ksRepPull(op.rep), 0.75, 1.2);
    const P = ksP(u), sc = Math.sqrt(u.sc || 1);
    ksPayRent(u, P.rent * Math.sqrt(u.sc || 1));
    ksPayCash('util', 8e4 * sc, 'expense');
    ksPayCash('ads', op.ads, 'ads');
    ksPayCash('fees', 12e4 * sc, 'fees');
    ksPayCash('misc', 10e4 * sc, 'expense');
    ksPayCash('supplies', 5e4 * sc, 'expense');
    ksPayCash('freight', 15e4 * ksPrice() * sc, 'freight');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 10e4 * sc, 'dues');
    const backlog = sum(op.projects.filter(p => !p.fin), p => p.contract);
    return { mgAdj: 0, kpi: { backlog, active: op.projects.filter(p => !p.fin).length, completed, doneSales, doneCost, won, loadR, sales: doneSales } };
  },
  next(u) { const ctx = { season: ksS(u).season[ksMonthIndex(G.m)] }; u.op.bids = this.inquiries(u, ctx); },
  auto(u) {
    ksAutoStaff(u, 'site', Math.max(2, this.load(u) / 2.6));
    ksAutoStaff(u, 'office', this.need(u).office);
    const L = this.load(u), C = this.loadCap(u) * 1.05;
    for (const b of u.op.bids) { b.margin = u.op.margin; b.on = L + (b.load ?? (KS_PROJ_LIB[b.type] || { load: 1 }).load) <= C; }
  },
  stockCount() { return []; },
  afterCount() {},
  arTerms() { return [[1, 0.35]]; },
  // 合わせるのは工事1件の金額（amtK）。件数（見積依頼）は変えないので、売上の波は大きくならない
  volLever: true,
  scale(u, k) { u.op.amtK = (u.op.amtK || 1) * k; },
  calib(u, target) {
    const op = u.op, P = ksP(u);
    const W = ksProjW(u);
    const avg = sum(W, ([k, w]) => (ksProjSpec(u, k).min + ksProjSpec(u, k).max) / 2 * w) / Math.max(1, sum(W, x => x[1]));
    const fixed = ksUnitFixedEst(u) + P.rent * Math.sqrt(u.sc || 1) + (8e4 + 12e4 + 10e4 + 5e4 + 15e4) * Math.sqrt(u.sc || 1) + op.ads;
    // 月の完成工事高 × 粗利率（見積の利益率から）で固定費をまかなえるだけの見積依頼
    const gpr = op.margin / (1 + op.margin);
    const needSales = fixed / Math.max(0.02, gpr - target);
    op.amtK = clamp(needSales / Math.max(1, avg * 0.45 * op.inq), 0.3, 3) * (op.amtK || 1);
  },
};
function ksClientName(cl) {
  if (cl === 'pub') return pick(['汐見市', '汐見県', '国土交通省 汐見事務所', '汐見市水道局']);
  if (cl === 'def') return pick(['防衛装備庁', '海上自衛隊 汐見地方総監部', '陸上自衛隊 補給統制本部', '航空自衛隊 補給本部']);
  if (cl === 'defprime') return pick(['汐見重工業 防衛・宇宙事業部', '中央重機 特機事業部', '汐見電機 防衛システム事業部', '港南造船 艦艇事業部']);
  if (cl === 'space') return pick(['宇宙航空研究開発機構（JAXA）', '汐見大学 宇宙工学研究室', '汐見スペース（衛星ベンチャー）', '内閣府 宇宙開発戦略推進事務局', '汐見重工業 宇宙事業部']);
  if (cl === 'power') return pick(['汐見電力 原子力事業本部', '中央電力 原子力部門', '日本原子力研究開発機構（JAEA）']);
  if (cl === 'corp' || cl === 'shop') return pick(CO_PREFIX) + pick(['商店', '歯科医院', '不動産', '設計事務所', '物産', '工業', 'ホテル', '運輸', '病院', '食品']);
  return pick(FAMILY_NAMES) + '様邸';
}

/* =========================================================
 *  trade：仕入れて卸す（卸売・商社）
 * ========================================================= */
const KS_CUST_MAX = 400; // 取引先の記録の数の上限（大きな会社は1社あたりの取引を大きくする）
KS_ENGINE.trade = {
  arTerms(u) {
    const cs = u.op.customers;
    const tot = sum(cs, c => c.size * c.ramp) || 1;
    const s1 = sum(cs.filter(c => c.terms === 1), c => c.size * c.ramp) / tot;
    return [[1, s1], [2, 1 - s1]];
  },
  newOp(u) { const P = ksP(u); return { customers: [], margin: P.gm, gm0: P.gm, policy: 'std', invDays: P.inv, book: 0, hid: 0, rep: 1, cseq: 0, truckCap: 0, hedge: 0, fxLock: G.eco.fx || 150, sales0: 3 }; },
  init(u, cond) {
    const P = ksP(u), sc = u.sc || 1;
    const op = u.op = this.newOp(u);
    // 取引先の数は規模の平方根で増える（大きな会社ほど1社あたりの取引も大きい）。KS_CUST_MAX 社より多くはせず、1社の取引を大きくする
    const nC0 = Math.max(3, Math.round(P.custN * Math.sqrt(sc))), nC = Math.min(nC0, KS_CUST_MAX);
    op.custN0 = nC;
    for (let i = 0; i < nC; i++) op.customers.push(this.newCustomer(u, 'std', KS_HIST_START - randInt(6, 180)));
    const tot = sum(op.customers, c => c.size);
    const target = P.custN * P.custSize * sc * (op.sizeK || 1);
    for (const c of op.customers) c.size = Math.round(c.size * target / tot / 1e4) * 1e4;
    // 新しく見つかる取引先も、いまの取引先と同じくらいの大きさ（1社あたりの取引は規模÷取引先の数。キャリブレーションの sizeK とは別）
    const ck = P.custN * sc / nC;
    if (Math.abs(ck - 1) > 1e-9) op.custK = ck;
    // トラックは台数が多いと何台かずつ1つの記録にまとめる（能力 cap は q 台分）
    const nT = Math.round(P.trucks * Math.sqrt(sc));
    op.truckCap = nT ? Math.round(target * 1.07 / nT / 1e4) * 1e4 : 0;
    const rows = Math.min(nT, KS_EQ_ROWS);
    for (let i = 0, done = 0; i < rows; i++) {
      const q = Math.round(nT * (i + 1) / rows) - Math.round(nT * i / rows);
      const a = { n: q > 1 ? `配送トラック ${done + 1}〜${done + q}号` : `配送トラック ${done + 1}号`, acct: 'veh', cost: (P.wh === '冷凍' || P.wh === '冷蔵' ? 650e4 : 480e4) * q, acqM: KS_HIST_START - randInt(2, 58), life: 5, u: u.id, cap: op.truckCap * q };
      if (q > 1) a.q = q;
      ksOpenAsset(a);
      done += q;
    }
    const whC = { 常温: 3000e4, 冷蔵: 4500e4, 冷凍: 6000e4, 危険物: 5000e4, なし: 0 }[P.wh] ?? 3000e4;
    if (whC) ksOpenAsset({ n: `${P.wh === '常温' ? '' : P.wh}倉庫の設備`, acct: 'bldg', cost: Math.round(whC * Math.sqrt(sc)), acqM: -110, life: 15, u: u.id });
    ksOpenAsset({ n: nT ? 'フォークリフト・棚' : '事務所の什器・システム', acct: 'equip', cost: Math.round(600e4 * Math.sqrt(sc)), acqM: -40, life: 6, u: u.id });
    u.staff = { sales: Math.max(1, Math.round(P.staff[0] * Math.sqrt(sc))), logi: nT ? Math.round(nT * 1.15) : Math.round(P.staff[1] * Math.sqrt(sc) * (P.wh === 'なし' ? 0.3 : 1)), office: Math.max(1, Math.round(P.staff[2] * Math.sqrt(sc))) };
    op.sales0 = u.staff.sales;
    const salesM = sum(op.customers, c => c.size) * G.eco.priceIdx;
    op.book = Math.round(salesM * (1 - P.gm) * P.inv / 30.4);
    u.invB = { goods: op.book };
    for (const c of op.customers) { const a = c.size * G.eco.priceIdx; ksAddAR(a, KS_HIST_START + c.terms - 1, 0, c.id); if (c.terms >= 2) ksAddAR(a, KS_HIST_START, 0, c.id); }
    ksAddAP(salesM * (1 - P.gm), KS_HIST_START);
    return {
      cash: salesM * 0.28 * cond.cash, inv: { goods: op.book }, deposit: Math.round(800e4 * Math.sqrt(sc)),
      loans: [{ bank: 'mirai', w: 1, termM: 12, startM: KS_HIST_START - 3, rate: 1.7, repay: 'bullet', kind: 'tegata', purpose: 'working', roll: true }, { bank: 'mirai', w: 1, termM: 84, startM: KS_HIST_START - 30, rate: 1.8 }],
      capital: ksCapitalFor(salesM * 12 * 0.5), annual: salesM * 12,
    };
  },
  fresh(u) { u.op = this.newOp(u); u.op.ramp = G.m; const n0 = Math.max(3, Math.round(ksP(u).custN * Math.sqrt(u.sc || 1))); u.op.custN0 = Math.min(KS_CUST_MAX, n0); const ck = ksP(u).custN * (u.sc || 1) / u.op.custN0; if (Math.abs(ck - 1) > 1e-9) u.op.custK = ck; u.staff = { sales: 0, logi: 0, office: 0 }; u.invB = {}; u.op.truckCap = ksP(u).trucks ? Math.round(ksP(u).custSize * 5 / 1e4) * 1e4 : 0; },
  plan(u) {
    const P = ksP(u);
    const items = [{ n: '事務所の什器・システム', acct: 'equip', cost: Math.round(500e4 * ksPrice()), life: 6, part: 'S', u: u.id }];
    if (P.trucks) items.push({ n: '配送トラック 1号', acct: 'veh', cost: Math.round(480e4 * ksPrice()), life: 5, part: 'S', u: u.id, cap: u.op.truckCap });
    return { title: `${ksS(u).name}を始める`, desc: '取引先を開拓して卸売を始めます。最初は取引先が少なく、営業が開拓するにつれて増えます。運転資金（売掛金と在庫）が先に要ることに注意。', items, fx: 'unitStart', arg: { u: u.id } };
  },
  newCustomer(u, policy, since) {
    const op = u.op, P = ksP(u);
    const risk = { low: 0.6, std: 1, high: 1.8 }[P.risk] || 1;
    const pdR = { strict: [0.15, 0.7], std: [0.3, 1.6], loose: [1.2, 5] }[policy];
    const kind = pick(P.kinds && P.kinds.length ? P.kinds : ['取引先']);
    return { id: 'C' + (++op.cseq) + u.id, n: `${pick(CO_PREFIX)}${kind === '飲食店' ? pick(['亭', '食堂', '屋']) : kind}`, kind, size: Math.round(Math.exp(Math.log(P.custSize * (op.sizeK || 1) * (op.custK || 1) * 0.78) + randn() * 0.7) / 1e4) * 1e4, terms: chance(policy === 'loose' ? Math.min(0.9, P.terms2 + 0.2) : P.terms2) ? 2 : 1, pd: uni(pdR[0], pdR[1]) * risk, since: since ?? G.m, ramp: since === undefined ? 0.5 : 1 };
  },
  trucks(u) { return ksUA(u, 'veh'); },
  capacity(u) {
    if (!ksP(u).trucks) return Infinity;
    return sum(this.trucks(u), a => a.cap || (u.op.truckCap || 1650e4) * ksEqQ(a)) * ksPrice() * Math.min(1, (u.staff.logi || 0) / Math.max(1, ksEqN(this.trucks(u)) * 1.1));
  },
  need(u) { const P = ksP(u); return P.trucks ? { logi: ksEqN(this.trucks(u)) * 1.15 } : {}; },
  month(u, ctx) {
    const op = u.op, e = G.eco, P = ksP(u);
    // 円安・円高で輸入品の原価が動くと、業界全体が値段に転嫁する（passT）。それより高い利幅は客離れを招く
    const passT = this.passT(u);
    const priceF = Math.exp(-(op.margin - op.gm0 - passT) * 10 * (0.125 / Math.max(0.03, op.gm0)) ** 0.5);
    const pot = sum(op.customers, c => c.size * c.ramp) * ctx.season * ksEcoF(0.8) * priceF * ksPrice();
    const capF = Math.min(1, this.capacity(u) / Math.max(1, pot));
    let sales = 0;
    for (const c of op.customers) {
      const a = Math.round(c.size * c.ramp * ctx.season * ksEcoF(0.8) * priceF * ksPrice() * capF * ksUpF(u) * ksNoise(0.08));
      if (a <= 0) continue;
      ksSaleCredit(a, c.terms, { cust: c.id });
      sales += a;
      c.ramp = Math.min(1, c.ramp + 0.1);
    }
    // 輸入品は為替の影響を受ける（為替予約の分は予約したレート）
    const fxNow = e.fx || 150;
    const fxEff = op.hedge * op.fxLock + (1 - op.hedge) * fxNow;
    const fxF = 1 + P.fx * (fxEff / 150 - 1);
    const cogs = sales * (1 - op.margin) * fxF;
    const waste = sales * 0.002;
    op.hid = ksShrinkAdd(op.hid, sales * 0.001 * ksShrinkF(u), op.book);
    const target = cogs * op.invDays / 30.4;
    const purchases = Math.max(0, cogs + waste + target - op.book);
    op.book += purchases - cogs - waste;
    ksBuyCredit('purch', purchases, 1, 'purch');
    const rec = e.regime === 'recession' ? 1.8 : 1;
    let bad = 0;
    for (const c of op.customers.slice()) {
      if (chance(c.pd / 100 / 12 * rec)) {
        const amt = ksWriteOffAR(c.id, 1);
        bad += amt;
        op.customers = op.customers.filter(x => x !== c);
        if (!G.hist) ksNews(`取引先の${c.n}が倒産しました。売掛金${fmtYen(amt)}が回収できません（貸倒れ）`, 'bad');
      } else if (chance(0.008 + Math.max(0, op.margin - op.gm0 - passT) * 0.4 * (0.125 / Math.max(0.03, op.gm0)) + (capF < 0.97 ? 0.01 : 0))) {
        op.customers = op.customers.filter(x => x !== c);
        if (!G.hist) ksNews(`${c.n}が他社に取引を移しました`, 'bad');
      }
    }
    const pf = { strict: 0.7, std: 1, loose: 1.5 }[op.policy];
    // 新しい取引先：ふだんの規模（custN0）の取引先が、離れる分と同じくらい見つかる（月に1%弱）
    const n0 = op.custN0 || Math.min(KS_CUST_MAX, Math.max(3, Math.round(P.custN * Math.sqrt(u.sc || 1))));
    const nNew = poisson(0.0095 * n0 * (0.5 + 0.5 * Math.sqrt(op.customers.length / n0)) * ((u.staff.sales || 0) / Math.max(1, op.sales0)) * pf * (op.margin < op.gm0 - 0.01 ? 1.3 : 1) * op.rep * ksUpF(u) * (op.ramp !== undefined && G.m - op.ramp < 12 ? 2 : 1));
    for (let i = 0; i < nNew; i++) { const c = this.newCustomer(u, op.policy); op.customers.push(c); if (!G.hist) ksNews(`新しい取引先：${c.n}（月${fmtYen(c.size)}ほど・${c.terms === 2 ? '翌々月' : '翌月'}末払い）`, 'good'); }
    const sc = Math.sqrt(u.sc || 1);
    ksPayRent(u, P.rent * sc);
    ksPayCash('freight', sales * (P.trucks ? 0.01 : 0.004) * (P.trucks ? 0.5 + 0.5 * (G.eco.oil || 1) * ksFuelF(u) : 1), 'freight');
    ksPayCash('util', 30e4 * ksPrice() * sc * (P.wh === '冷凍' ? 1.8 : P.wh === '冷蔵' ? 1.4 : P.wh === 'なし' ? 0.3 : 1) * ksEnF(u), 'expense');
    ksPayCash('supplies', sales * 0.002, 'expense');
    ksPayCash('repairs', ksEqN(this.trucks(u)) * 3e4, 'repairs');
    ksPayCash('fees', 12e4 * sc + sales * 0.0005, 'fees');
    ksPayCash('misc', 10e4 * sc, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 15e4 * sc, 'dues');
    op.rep = clamp(op.rep + 0.01 * (capF < 0.97 ? -1 : 0.02) - ksRepPull(op.rep), 0.8, 1.2);
    return { mgAdj: cogs + waste - purchases, kpi: { sales, customers: op.customers.length, capF, nNew, bad, gpr: op.margin - 0.002 - (fxF - 1) * (1 - op.margin), cap: this.capacity(u), fxF } };
  },
  /* 為替の変化を業界が値段に転嫁する分（粗利率の上乗せ）。輸入の割合が大きいほど大きい */
  passT(u) { const P = ksP(u); return P.fx ? P.fx * ((G.eco.fx || 150) / 150 - 1) * (1 - u.op.gm0) * 0.8 : 0; },
  auto(u) {
    const P = ksP(u), op = u.op;
    if (P.fx) op.margin = Math.round((op.gm0 + this.passT(u)) * 1000) / 1000;
    const pot = sum(op.customers, c => c.size * c.ramp) * ksPrice();
    if (P.trucks) {
      const cap = this.capacity(u);
      const nT = ksEqN(this.trucks(u));
      // 増やす・減らすのは、トラックの5%ずつ（少ないときは1台）
      const step = Math.max(1, Math.round(nT * 0.05));
      if (cap < pot * 1.02 && G.m % 3 === 0) {
        const t = ksNewAsset(Object.assign({ n: step > 1 ? `配送トラック ${nT + 1}〜${nT + step}号` : `配送トラック ${nT + 1}号`, acct: 'veh', cost: Math.round(480e4 * ksPrice()) * step, life: 5, cap: op.truckCap * step, u: u.id }, step > 1 ? { q: step } : {}));
        ksPost('buyAsset', [['veh', t.cost, 0], ['cash', 0, t.cost]], { cf: 'capex' });
      } else if (cap > pot * 1.45 && nT > 3 && G.m % 6 === 0) {
        const old = ksAssetTake(this.trucks(u).slice().sort((a, b) => a.acqM - b.acqM)[0], step);
        ksSellAsset(old, Math.round(ksBookValue(old) * 0.9 + 20e4 * ksEqQ(old)));
      }
      ksAutoStaff(u, 'logi', ksEqN(this.trucks(u)) * 1.15);
      ksAutoStaff(u, 'sales', pot < cap * 0.8 ? op.sales0 * 1.5 : op.sales0);
    } else ksAutoStaff(u, 'sales', op.sales0);
  },
  stockCount(u) { const op = u.op; return [{ acct: 'goods', pacct: 'purch', n: '商品', book: Math.round(op.book), phys: Math.max(0, Math.round(op.book - op.hid)) }]; },
  afterCount(u) { u.op.book = Math.max(0, u.op.book - u.op.hid); u.op.hid = 0; },
  volLever: true,
  scale(u, k) {
    const op = u.op;
    for (const c of op.customers) c.size = Math.round(c.size * k / 1e4) * 1e4;
    op.sizeK = (op.sizeK || 1) * k;
    if (op.truckCap) { op.truckCap = Math.round(op.truckCap * k / 1e4) * 1e4; for (const a of this.trucks(u)) a.cap = op.truckCap * ksEqQ(a); }
  },
  calib(u, target) {
    const P = ksP(u), op = u.op;
    const sales = sum(op.customers, c => c.size) * G.eco.priceIdx;
    const fixed = ksUnitFixedEst(u) + P.rent * Math.sqrt(u.sc || 1) + (30e4 + 12e4 + 10e4) * Math.sqrt(u.sc || 1) + ksEqN(this.trucks(u)) * 3e4;
    const varR = (1 - op.margin) + 0.002 + 0.002 + (P.trucks ? 0.01 : 0.004) + 0.0005;
    const op0 = sales * (1 - varR) - fixed;
    // 利益が業界の水準になるよう、取引先の規模をそろえる（粗利率は業種の値のまま）
    const need = fixed / Math.max(0.01, 1 - varR - target);
    const k = clamp(need / Math.max(1, sales), 0.5, 2.5);
    for (const c of op.customers) c.size = Math.round(c.size * k / 1e4) * 1e4;
    op.sizeK = (op.sizeK || 1) * k;
    if (op.truckCap) { op.truckCap = Math.round(op.truckCap * k / 1e4) * 1e4; for (const a of this.trucks(u)) a.cap = op.truckCap * ksEqQ(a); }
    void op0;
  },
};

/* =========================================================
 *  pro：人の力で稼ぐ（専門サービス・受託開発）
 * ========================================================= */
/* 採用した人の記録（慣れるまでの3か月は力が出ない）：1人ずつの「採用した月」か、大勢なら { m: 月, n: 人数 } */
function ksHireM(h) { return typeof h === 'number' ? h : h.m; }
function ksHireN(h) { return typeof h === 'number' ? 1 : h.n || 0; }
function ksHiresAdd(op, m, n) { n = Math.round(n || 0); if (n <= 0 || !op.hires) return; if (n <= 3) for (let i = 0; i < n; i++) op.hires.push(m); else op.hires.push({ m, n }); }
KS_ENGINE.pro = {
  newOp(u) { const P = ksP(u); return { price: P.rate, ref: P.rate, salaryLv: 1, outsource: !!P.sub, training: Math.round(20e4 * Math.sqrt(u.sc || 1) / 1e4) * 1e4, skill: 1, base: P.n * (u.sc || 1) * 0.96, rep: 1, hires: [], dev: null, svc: null, sales0: Math.max(1, Math.round(P.sales * Math.sqrt(u.sc || 1))) }; },
  init(u, cond) {
    const P = ksP(u), sc = u.sc || 1;
    const op = u.op = this.newOp(u);
    u.staff = { eng: Math.max(1, Math.round(P.n * sc)), sales: op.sales0 };
    const eqn = (P.eqn && P.eqn[0]) || 'パソコン';
    ksOpenAsset({ n: `${eqn}一式`, acct: 'equip', cost: Math.round(35e4 * u.staff.eng), acqM: KS_HIST_START - 20, life: 4, u: u.id });
    ksOpenAsset({ n: 'オフィスの内装', acct: 'bldg', cost: Math.round(1200e4 * Math.sqrt(sc)), acqM: KS_HIST_START - 30, life: 15, u: u.id });
    const salesM = op.base * op.ref * G.eco.priceIdx;
    for (let k = 0; k < P.terms; k++) ksAddAR(salesM, KS_HIST_START + k);
    ksAddAP(Math.max(0, op.base * 0.1) * op.ref * 0.85, KS_HIST_START);
    return { cash: salesM * 1.45 * cond.cash, inv: {}, deposit: Math.round(1000e4 * Math.sqrt(sc)), loans: [{ bank: 'mirai', w: 1, termM: 60, startM: KS_HIST_START - 6, rate: 1.9, purpose: 'working' }], capital: ksCapitalFor(salesM * 12 * 0.8), annual: salesM * 12 };
  },
  fresh(u) { u.op = this.newOp(u); u.op.ramp = G.m; u.staff = { eng: 0, sales: 0 }; u.invB = {}; },
  plan(u) {
    const P = ksP(u);
    return { title: `${ksS(u).name}を始める`, desc: `事務所と機材を用意して始めます。${ksS(u).roles[0].n}を採用し、営業が案件を取ってくるにつれて仕事が増えます。`, items: [{ n: '事務所の内装', acct: 'bldg', cost: Math.round(600e4 * ksPrice()), life: 15, part: 'S', u: u.id }, { n: `${(P.eqn && P.eqn[0]) || 'パソコン'}一式`, acct: 'equip', cost: Math.round(35e4 * 5), life: 4, part: 'S', u: u.id }], fx: 'unitStart', arg: { u: u.id } };
  },
  avail(u) {
    const op = u.op;
    const devN = op.dev ? op.dev.n : 0;
    const newbies = op.hires.filter(h => G.m - ksHireM(h) < 3);
    let p = Math.max(0, (u.staff.eng || 0) - devN - sum(newbies, ksHireN));
    for (const h of newbies) p += ([0.4, 0.7, 0.9][G.m - ksHireM(h)] || 1) * ksHireN(h);
    return p;
  },
  demand(u, ctx) {
    const op = u.op;
    return op.base * ctx.season * ksEcoF(0.6) * Math.exp(-(op.price / (op.ref * ksPrice()) - 1) * 2.2) * op.rep * Math.sqrt(Math.max(0.3, (u.staff.sales || 0) / op.sales0)) * ksUpF(u) * ksStartRamp(u);
  },
  need(u) { return { sales: u.op.sales0 }; },
  month(u, ctx) {
    const op = u.op, e = G.eco, P = ksP(u);
    const avail = this.avail(u);
    const demand = this.demand(u, ctx) * ksNoise(0.06);
    const own = Math.min(demand, avail);
    const util = avail > 0 ? own / avail : 0;
    const sub = op.outsource ? Math.min(Math.max(0, demand - own), avail * 0.3 + 1) : 0;
    const skillF = 1 + (op.skill - 1) * 0.5;
    const sales = (own * skillF + sub) * op.price;
    ksSaleCredit(sales, P.terms);
    if (sub > 0) ksBuyCredit('subcon', sub * op.ref * 0.85 * ksPrice(), 1, 'subcon');
    ksPayCash('svcExp', (u.staff.eng || 0) * P.exp * ksPrice(), 'svcExp');
    let svcSales = 0;
    if (op.svc) {
      const s = op.svc;
      s.users = Math.max(0, s.users + poisson(s.growth * op.rep) - poisson(s.users * 0.02));
      svcSales = s.users * s.price;
      if (svcSales > 0) ksSaleCredit(svcSales, 1, { card: true, fee: 0.036 });
      ksPayCash('svcExp', 15e4 + s.users * 300, 'svcExp');
    }
    const sc = Math.sqrt(u.sc || 1);
    ksPayRent(u, P.rent * sc);
    ksPayCash('util', 10e4 * sc, 'expense');
    ksPayCash('ads', 10e4 * sc, 'ads');
    ksPayCash('fees', 15e4 * sc, 'fees');
    ksPayCash('misc', 10e4 * sc, 'expense');
    ksPayCash('recruit', op.training, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 5e4 * sc, 'dues');
    op.skill = clamp(op.skill + (op.training / (20e4 * sc) - 1) * 0.004 + 0.0005 - (util > 0.98 ? 0.001 : 0), 0.85, 1.3);
    const unserved = Math.max(0, demand - own - sub);
    op.rep = clamp(op.rep + 0.008 * (unserved > demand * 0.1 ? -0.5 : 0.02) + (op.skill - 1) * 0.01 - ksRepPull(op.rep), 0.75, 1.25);
    const quitP = 0.008 * (1 + 3 * Math.max(0, 1 - op.salaryLv)) * (util > 0.98 ? 1.3 : 1) * (op.salaryLv > 1.08 ? 0.7 : 1) * (typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'quit') : 1);
    const quits = G.hist ? 0 : ksBinom(u.staff.eng || 0, quitP);
    const afterPayroll = () => {
      if (op.dev) {
        const d = op.dev;
        const amt = Math.round(d.n * P.wage * e.wageIdx * op.salaryLv * 1.15);
        ksPost('swDev', [['swip', amt, 0], ['labor', 0, amt]], { desc: `自社サービスの開発費の振替（${d.name}）` });
        op.devFY = op.devFY || {};
        op.devFY[fyOf(G.m)] = (op.devFY[fyOf(G.m)] || 0) + amt;
        d.spent += amt;
        d.left--;
        if (d.left <= 0) {
          ksPost('swRelease', [['sw', d.spent, 0], ['swip', 0, d.spent]], { desc: `ソフトウェアの完成（${d.name}）` });
          ksNewAsset({ n: d.name, acct: 'sw', cost: d.spent, life: 5, acqM: G.m + 1, u: u.id });
          op.svc = { name: d.name, users: 0, price: d.price, growth: d.growth, launchM: G.m + 1 };
          op.dev = null;
          ksNews(`自社サービス「${d.name}」が完成しました。開発費${fmtYen(d.spent)}をソフトウェア（無形固定資産）に計上し、来月から5年で償却します`, 'good');
        }
      }
      if (quits) {
        u.staff.eng = Math.max(0, (u.staff.eng || 0) - quits);
        ksNews(`${ksUName(u)}：${ksS(u).roles[0].n}${fmtNum(quits, 0)}人が退職しました${op.salaryLv < 1 ? '（給与が相場より低いのが一因です）' : ''}`, 'bad');
      }
    };
    return { afterPayroll, mgAdj: 0, kpi: { demand, avail, own, util, sub, sales: sales + svcSales, price: op.price, svcSales } };
  },
  auto(u) {
    const op = u.op;
    op.price = Math.round(op.ref * ksPrice() / 1e3) * 1e3;
    const d = this.demand(u, { season: 1 }) * 0.98;
    const step = Math.max(1, Math.round((u.staff.eng || 0) * 0.05));
    if (this.avail(u) < d - 1 && G.m % 2 === 0) { ksHire(u, 'eng', step); ksHiresAdd(op, G.m, step); ksPayCash('recruit', ksHireCostOf(ksS(u).roles[0]) * step, 'expense'); }
    else if (this.avail(u) > d * 1.08 + 0.5 && G.m % 3 === 0 && (u.staff.eng || 0) > 3) ksHire(u, 'eng', -step);
    op.hires = op.hires.filter(h => G.m - ksHireM(h) < 6);
    ksAutoStaff(u, 'sales', op.sales0);
  },
  stockCount() { return []; },
  afterCount() {},
  arTerms(u) { return [[ksP(u).terms, 1]]; },
  scale(u, k) { const op = u.op; op.ref = Math.round(op.ref * k / 1e3) * 1e3; op.price = Math.round(op.price * k / 1e3) * 1e3; },
  calib(u, target) {
    const P = ksP(u), op = u.op;
    const n = u.staff.eng || 1;
    const labor = n * P.wage * 1.32 + (u.staff.sales || 0) * 33e4 * 1.32;
    const sc = Math.sqrt(u.sc || 1);
    const fixed = n * P.exp + (P.rent + 10e4 + 10e4 + 15e4 + 10e4) * sc + op.training + ksUnitFixedEst(u) + sum(ksUA(u), a => (a.life ? a.cost / a.life / 12 : 0));
    void labor;
    const need = fixed / Math.max(0.05, 1 - target);
    op.ref = op.price = Math.round(clamp(need / Math.max(1, op.base), op.ref * 0.6, op.ref * 1.8) / 1e3) * 1e3;
  },
};
