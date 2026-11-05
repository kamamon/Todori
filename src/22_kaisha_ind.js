'use strict';
/* =========================================================
 *  22_kaisha_ind.js : 会社経営モードの業種ごとの営業
 *  init(cond)    開始時（4期前）の会社をつくる
 *  month(ctx)    1か月分の営業を仕訳にする。{ mgAdj（月次の売上原価の調整）, kpi, extraLabor, afterPayroll }
 *  auto()        過去の期を自動で経営するときの判断
 *  stockCount()  決算の棚卸（帳簿在庫と実地在庫）
 * ========================================================= */

const KS_ENGINE = {};
const ksNoise = sd => Math.exp(randn() * sd);
const ksEcoF = beta => 1 + beta * (G.eco.idx - 1);
const ksPrice = () => G.eco.priceIdx;
/* 人員を目安に合わせる（自動経営用） */
function ksAutoStaff(roleId, need) {
  const cur = G.staff[roleId] || 0;
  const n = Math.max(0, Math.round(need));
  if (cur < n) G.staff[roleId] = cur + Math.min(n - cur, 2);
  else if (cur > n + 1) G.staff[roleId] = cur - 1;
}
function ksHire(roleId, n) { G.staff[roleId] = Math.max(0, (G.staff[roleId] || 0) + n); }
/* 評判（客足・取引先の信頼）が平常に戻ろうとする力。
   過去の期は、承継時の会社の状態（好調・普通・不振）に向かって数年かけて変わっていく */
function ksRepPull(rep) { return G.hist ? 0.025 * (rep - (G.repT ?? 1)) : 0.004 * (rep - 1); }

/* =========================================================
 *  小売業：食品スーパー
 * ========================================================= */
KS_ENGINE.ret = {
  arLag: 1, creditShare: 0.38,
  init(cond) {
    const op = G.op = { stores: [{ n: '本店', openM: -300, renovM: -130, fridgeM: -84 }], markup: 0.255, invDays: 12, ads: 40e4, rentPer: 110e4, rep: 1, book: 0, hid: 0, base: 1250 };
    G.staff = { regular: 6, part: 20 };
    G.rentMonthly = op.rentPer;
    const salesM = 1250 * 30.4 * 1050 * G.eco.priceIdx;
    const cogsM = salesM * 0.745;
    op.book = Math.round(cogsM * 12 / 30.4);
    ksOpenAsset({ n: '本店の内装・設備', acct: 'bldg', cost: 8000e4, acqM: -130, life: 15 });
    ksOpenAsset({ n: '冷蔵・冷凍ケース', acct: 'equip', cost: 2400e4, acqM: -84, life: 6 });
    ksOpenAsset({ n: 'レジ・POSシステム', acct: 'equip', cost: 900e4, acqM: -60, life: 6 });
    ksOpenAsset({ n: '配送用トラック', acct: 'veh', cost: 450e4, acqM: KS_HIST_START - 30, life: 5 });
    return ksOpening({
      cash: 2400e4 * cond.cash, ar: [{ amt: salesM * 0.38, due: KS_HIST_START, fee: 0.026 }], ap: [{ amt: cogsM * 1.0, due: KS_HIST_START }],
      inv: { goods: op.book }, deposit: 3000e4,
      loans: [{ bank: 'mirai', w: 1, termM: 120, startM: KS_HIST_START - 24, rate: 1.9 }, { bank: 'shinkin', w: 1, termM: 84, startM: KS_HIST_START - 6, rate: 2.2 }],
      capital: 3000e4, eq: cond.eq,
    });
  },
  storesOpen() { return G.op.stores.filter(s => s.openM <= G.m); },
  /* パートの必要人数は客数に合わせて変わる（シフトで調整する） */
  traffic() { const k = (G.months[G.months.length - 1] || {}).kpi || {}; const n = this.storesOpen().length; return k.cust ? clamp(k.cust / (G.op.base * Math.max(1, n)), 0.75, 1.3) : 1; },
  need() { const n = this.storesOpen().length; return { regular: 6 * n, part: Math.round(20 * n * this.traffic()) }; },
  staffCap() { const nd = this.need(); return (G.staff.regular + G.staff.part * 0.45) / Math.max(1, nd.regular + nd.part * 0.45); },
  month(ctx) {
    const op = G.op, e = G.eco;
    const open = this.storesOpen();
    const n = open.length;
    const cap = this.staffCap();
    const staffF = 0.8 + 0.2 * Math.min(1, cap) ** 2;
    const adsF = 1 + 0.07 * (1 - Math.exp(-op.ads / 60e4)) - 0.035;
    const priceF = Math.exp(-(op.markup - 0.255) * 4);
    const stockF = op.invDays < 9 ? 1 - 0.025 * (9 - op.invDays) : 1;
    let base = 0, fridgeAge = 0;
    for (const s of open) {
      const age = G.m - s.openM;
      const ramp = clamp(0.6 + 0.4 * age / 12, 0.6, 1);
      const ra = (G.m - s.renovM) / 12;
      const renovF = ra > 10 ? Math.max(0.85, 1 - 0.012 * (ra - 10)) : 1 + 0.03 * Math.max(0, 1 - ra / 2);
      base += op.base * ramp * renovF * (s.comp || 1);
      fridgeAge += (G.m - s.fridgeM) / 12 / n;
    }
    const cust = base * ctx.season * ksEcoF(0.35) * priceF * adsF * staffF * stockF * op.rep * ksNoise(0.025);
    const spend = 1050 * ksPrice() * (1 + 0.6 * (op.markup - 0.255)) * ksNoise(0.01);
    const sales = cust * 30.4 * spend;
    const cogsSold = sales * (1 - op.markup);
    const fridgeF = fridgeAge > 8 ? 1.3 : 1;
    const wasteRate = 0.008 * (op.invDays / 12) ** 1.3 * fridgeF * (cap < 0.9 ? 1.2 : 1);
    const waste = sales * wasteRate;
    op.hid += sales * 0.0025 * (cap < 0.9 ? 1.4 : 1);
    const target = cogsSold * op.invDays / 30.4;
    const purchases = Math.max(0, cogsSold + waste + target - op.book);
    op.book += purchases - cogsSold - waste;
    const card = sales * 0.38;
    ksSaleCash(sales - card);
    ksSaleCredit(card, 1, { card: true, fee: 0.026 });
    ksBuyCredit('purch', purchases, 1, 'purch');
    const nRent = op.stores.filter(s => s.openM <= G.m + 1).length;
    G.rentMonthly = op.rentPer * nRent;
    ksPayCash('rent', G.rentMonthly, 'rent');
    ksPayCash('util', 62e4 * n * fridgeF * (0.95 + 0.1 * ctx.season) * ksPrice(), 'expense');
    ksPayCash('ads', op.ads * n, 'ads');
    ksPayCash('supplies', sales * 0.008, 'expense');
    ksPayCash('repairs', 12e4 * n * (fridgeAge > 8 ? 1.6 : 1), 'repairs');
    ksPayCash('fees', 12e4, 'fees');
    ksPayCash('misc', 8e4 * n, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 30e4 * n, 'dues');
    op.rep = clamp(op.rep + 0.01 * ((staffF - 1) * 2 + (stockF - 1) * 2 + (0.255 - op.markup) * 2) - ksRepPull(op.rep), 0.75, 1.25);
    if (!G.hist && open.length && chance(0.012)) {
      const s = pick(open);
      s.comp = (s.comp || 1) * 0.93;
      ksNews(`${s.n}の近くに大手ドラッグストアが開店。客数が7%ほど減りそうです`, 'bad');
    }
    return { mgAdj: cogsSold + waste - purchases, kpi: { cust, spend, sales, gpr: op.markup - wasteRate, invDays: op.invDays, waste, wasteRate, cap, n } };
  },
  auto() {
    const nd = this.need();
    ksAutoStaff('regular', nd.regular);
    ksAutoStaff('part', nd.part);
  },
  stockCount() {
    const op = G.op;
    return { items: [{ acct: 'goods', n: '商品', begin: ksB('goods'), book: Math.round(op.book), phys: Math.round(op.book - op.hid) }] };
  },
  afterCount() { G.op.book -= G.op.hid; G.op.hid = 0; },
};

/* =========================================================
 *  飲食業：洋食レストラン
 * ========================================================= */
KS_ENGINE.food = {
  arLag: 1, creditShare: 0.45,
  init(cond) {
    const op = G.op = {
      shops: [{ n: '本店', openM: -260, renovM: -100, kitM: -80 }, { n: '駅前店', openM: -70, renovM: -70, kitM: -70 }],
      price: 1.0, foodQ: 0.31, ads: 10e4, rentPer: 85e4, base: 132, rep: 1, book: 0, hid: 0,
    };
    G.staff = { cook: 6, part: 16 };
    G.rentMonthly = op.rentPer * 2;
    const salesM = 132 * 2 * 26 * 1900 * G.eco.priceIdx;
    op.book = Math.round(salesM * 0.31 * 5 / 30);
    ksOpenAsset({ n: '本店の内装', acct: 'bldg', cost: 2200e4, acqM: -100, life: 15 });
    ksOpenAsset({ n: '本店の厨房機器', acct: 'equip', cost: 800e4, acqM: -80, life: 6 });
    ksOpenAsset({ n: '駅前店の内装', acct: 'bldg', cost: 2500e4, acqM: -70, life: 15 });
    ksOpenAsset({ n: '駅前店の厨房機器', acct: 'equip', cost: 900e4, acqM: -70, life: 6 });
    return ksOpening({
      cash: 1000e4 * cond.cash, ar: [{ amt: salesM * 0.45, due: KS_HIST_START, fee: 0.032 }], ap: [{ amt: salesM * 0.32, due: KS_HIST_START }],
      inv: { mat: op.book }, deposit: 1200e4,
      loans: [{ bank: 'shinkin', w: 1, termM: 84, startM: KS_HIST_START - 10, rate: 2.2 }, { bank: 'koko', w: 1, termM: 84, startM: KS_HIST_START - 4, rate: 1.6 }],
      capital: 1000e4, eq: cond.eq,
    });
  },
  shopsOpen() { return G.op.shops.filter(s => s.openM <= G.m); },
  traffic() { const k = (G.months[G.months.length - 1] || {}).kpi || {}; return k.cust ? clamp(k.cust / G.op.base, 0.75, 1.3) : 1; },
  need() { const n = this.shopsOpen().length; return { cook: 3 * n, part: Math.round(8 * n * this.traffic()) }; },
  staffCap() { const nd = this.need(); return (G.staff.cook + G.staff.part * 0.35) / Math.max(1, nd.cook + nd.part * 0.35); },
  month(ctx) {
    const op = G.op;
    const open = this.shopsOpen();
    const n = open.length;
    const cap = this.staffCap();
    const staffF = 0.75 + 0.25 * Math.min(1, cap) ** 2;
    const adsF = 1 + 0.06 * (1 - Math.exp(-op.ads / 15e4)) - 0.03;
    let base = 0, kitAge = 0;
    for (const s of open) {
      const ramp = clamp(0.65 + 0.35 * (G.m - s.openM) / 9, 0.65, 1);
      const ra = (G.m - s.renovM) / 12;
      const renovF = ra > 9 ? Math.max(0.85, 1 - 0.015 * (ra - 9)) : 1 + 0.04 * Math.max(0, 1 - ra / 2);
      base += op.base * ramp * renovF * (s.comp || 1);
      kitAge += (G.m - s.kitM) / 12 / n;
    }
    op.rep = clamp(op.rep + 0.015 * ((op.foodQ - 0.31) * 8 + (staffF - 1) * 2) - ksRepPull(op.rep), 0.7, 1.3);
    const cust = base * ctx.season * ksEcoF(0.6) * Math.pow(op.price, -1.4) * op.rep * adsF * staffF * ksNoise(0.03);
    const spend = 1900 * ksPrice() * op.price;
    const sales = cust * 26 * spend;
    const foodCost = sales * op.foodQ;
    const waste = sales * 0.012 * (cap < 0.9 ? 1.3 : 1);
    op.hid += sales * 0.003;
    const target = foodCost * 5 / 30;
    const purchases = Math.max(0, foodCost + waste + target - op.book);
    op.book += purchases - foodCost - waste;
    const card = sales * 0.45;
    ksSaleCash(sales - card);
    ksSaleCredit(card, 1, { card: true, fee: 0.032 });
    ksBuyCredit('purch', purchases, 1, 'purch');
    G.rentMonthly = op.rentPer * op.shops.filter(s => s.openM <= G.m + 1).length;
    ksPayCash('rent', G.rentMonthly, 'rent');
    ksPayCash('util', sales * 0.045, 'expense');
    ksPayCash('supplies', sales * 0.028, 'expense');
    ksPayCash('ads', op.ads * n, 'ads');
    ksPayCash('repairs', 4e4 * n * (kitAge > 7 ? 2.2 : 1), 'repairs');
    ksPayCash('fees', 10e4, 'fees');
    ksPayCash('misc', 6e4, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 8e4 * n, 'dues');
    if (!G.hist && kitAge > 8 && chance(0.04)) {
      const amt = niceAmount(uni(60e4, 180e4));
      ksPayCash('repairs', amt, 'repairs');
      ksNews(`厨房の冷蔵庫が故障し、修理に${fmtYen(amt)}かかりました。厨房機器が古くなっています`, 'bad');
    }
    return { mgAdj: foodCost + waste - purchases, kpi: { cust: cust / Math.max(1, n), spend, sales, foodRate: op.foodQ + waste / Math.max(1, sales), cap, n, rentRate: G.rentMonthly / Math.max(1, sales) } };
  },
  auto() { const nd = this.need(); ksAutoStaff('cook', nd.cook); ksAutoStaff('part', nd.part); },
  stockCount() {
    const op = G.op;
    return { items: [{ acct: 'mat', n: '原材料（食材）', begin: ksB('mat'), book: Math.round(op.book), phys: Math.round(op.book - op.hid) }] };
  },
  afterCount() { G.op.book -= G.op.hid; G.op.hid = 0; },
};

/* =========================================================
 *  製造業：金属部品の加工工場
 * ========================================================= */
KS_ENGINE.mfg = {
  arLag: 2, creditShare: 1,
  init(cond) {
    const op = G.op = { rate: 6000, matPerH: 3200, base: 2150, rep: 1, ot: 0.1, matDays: 20, matBook: 0, matHid: 0, wip: 0, prod: 0, outsource: false, big: null };
    G.staff = { worker: 16, office: 4 };
    G.rentMonthly = 0;
    const ages = [-150, -132, -120, -108, -96, -84, -66, -60, -54, -50];
    ages.forEach((a, i) => ksOpenAsset({ n: `NC旋盤 ${i + 1}号機`, acct: 'mach', cost: 1500e4, acqM: a, life: 10, part: 'C', cap: 220 }));
    ksOpenAsset({ n: '工場の建物', acct: 'bldg', cost: 1.2e8, acqM: -240, life: 31, part: 'C' });
    ksOpenAsset({ n: '工場の土地', acct: 'land', cost: 6000e4, acqM: -300 });
    ksOpenAsset({ n: '事務所のパソコン・什器', acct: 'equip', cost: 300e4, acqM: KS_HIST_START - 20, life: 6 });
    ksOpenAsset({ n: '納品用トラック', acct: 'veh', cost: 380e4, acqM: KS_HIST_START - 24, life: 5 });
    const salesM = 2150 * 6000 + 2150 * 3200 * 1.1;
    const matUsed = 2150 * 3200;
    op.matBook = Math.round(matUsed * 20 / 30);
    const pc = matUsed + 16 * 30e4 * 1.15 + 2150 * 600;
    op.wip = Math.round(pc * 0.3); op.prod = Math.round(pc * 0.08);
    return ksOpening({
      cash: 2500e4 * cond.cash, ar: [{ amt: salesM, due: KS_HIST_START }, { amt: salesM, due: KS_HIST_START + 1 }], ap: [{ amt: matUsed, due: KS_HIST_START }],
      inv: { mat: op.matBook, wip: op.wip, prod: op.prod },
      loans: [{ bank: 'mirai', w: 1, termM: 120, startM: KS_HIST_START - 12, rate: 1.7 }, { bank: 'koko', w: 1, termM: 120, startM: KS_HIST_START - 6, rate: 1.4 }, { bank: 'mirai', w: 1, termM: 12, startM: KS_HIST_START - 2, rate: 1.6, repay: 'bullet', kind: 'tegata', purpose: 'working', roll: true }],
      capital: 2000e4, eq: cond.eq,
    });
  },
  machines() { return ksActiveAssets().filter(a => a.acct === 'mach'); },
  capMach() { return sum(this.machines(), a => (a.cap || 200) * (G.m - a.acqM > 144 ? 0.9 : 1)); },
  capacity() { return Math.min(this.capMach(), G.staff.worker * 150 * (1 + G.op.ot)); },
  demand(ctx) {
    const op = G.op;
    const premium = this.machines().some(a => a.premium) ? 1.06 : 1;
    return op.base * ctx.season * ksEcoF(1.3) * Math.exp(-(op.rate / (6000 * ksPrice()) - 1) * 2.5) * op.rep * premium + (op.big ? op.big.h : 0);
  },
  month(ctx) {
    const op = G.op, e = G.eco;
    const capM = this.capMach();
    const workerH = G.staff.worker * 150;
    const capacity = Math.min(capM, workerH * (1 + op.ot));
    const demand = this.demand(ctx) * ksNoise(0.05);
    const hours = Math.min(demand, capacity);
    const extra = op.outsource ? Math.min(Math.max(0, demand - hours), capacity * 0.2) : 0;
    const otH = Math.max(0, hours - workerH);
    const otPay = otH * (30e4 * e.wageIdx / 150) * 1.25;
    const short = demand > 0 ? (demand - hours - extra) / demand : 0;
    op.rep = clamp(op.rep + 0.012 * (short > 0.05 ? -short * 3 : 0.02) - ksRepPull(op.rep), 0.7, 1.25);
    const rate = op.rate * (op.big ? 1 : 1);
    const matUsed = (hours + extra) * op.matPerH * e.matIdx;
    const sales = (hours + extra) * rate + matUsed * 1.1;
    const target = matUsed * op.matDays / 30;
    const purchases = Math.max(0, matUsed + target - op.matBook);
    op.matBook += purchases - matUsed;
    op.matHid += matUsed * 0.004;
    ksSaleCredit(sales, 2);
    ksBuyCredit('matPurch', purchases, 1, 'matPurch');
    const nM = this.machines().length;
    const oldM = this.machines().filter(a => G.m - a.acqM > 120).length;
    const elec = (nM * 4e4 + hours * 300) * ksPrice();
    const tools = hours * 300 * ksPrice();
    const rep = (nM * 2e4 + oldM * 3e4) * ksPrice();
    ksPayCash('mfgExp', elec + tools + rep, 'mfgExp');
    if (extra > 0) ksBuyCredit('subcon', extra * rate * 0.85, 1, 'subcon');
    ksPayCash('freight', sales * 0.012, 'freight');
    ksPayCash('fees', 15e4, 'fees');
    ksPayCash('misc', 10e4, 'expense');
    ksPayCash('ads', 5e4, 'ads');
    ksPayCash('util', 6e4, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 25e4, 'dues');
    if (!G.hist && oldM && chance(0.03 * oldM)) {
      const amt = niceAmount(uni(80e4, 300e4));
      ksPayCash('mfgExp', amt, 'mfgExp');
      ksNews(`古い機械が故障し、修理に${fmtYen(amt)}かかりました（製造経費）`, 'bad');
    }
    // 仕掛品と製品（その月に作ったものの一部が月末に残る）
    const wipB = op.wip, prodB = op.prod;
    const laborEst = G.staff.worker * 30e4 * e.wageIdx * 1.15 + otPay;
    const pc = matUsed + laborEst + elec + tools + rep;
    op.wip = Math.round(pc * 0.3 * (hours > 0 ? 1 : 0));
    op.prod = Math.round(pc * 0.08 * (hours > 0 ? 1 : 0));
    if (op.big) { op.big.left--; if (op.big.left <= 0) { ksNews(`${op.big.n}の大口注文が終わりました`, 'info'); op.big = null; } }
    return { extraLabor: otPay, mgAdj: (matUsed - purchases) + (wipB + prodB - op.wip - op.prod), kpi: { demand, capacity, capM, workerH, hours, util: hours / Math.max(1, capacity), short, rate, sales, extra } };
  },
  auto() {
    const op = G.op;
    op.rate = Math.round(6000 * ksPrice() / 10) * 10;
    const d = op.base * ksEcoF(1.3) * op.rep;
    ksAutoStaff('worker', Math.min(this.capMach(), d * 1.02) / 150 / (1 + op.ot) + 0.5);
    ksAutoStaff('office', 4);
  },
  stockCount() {
    const op = G.op;
    return { items: [
      { acct: 'mat', n: '原材料', begin: ksB('mat'), book: Math.round(op.matBook), phys: Math.round(op.matBook - op.matHid) },
      { acct: 'wip', n: '仕掛品', begin: ksB('wip'), book: op.wip, phys: op.wip },
      { acct: 'prod', n: '製品', begin: ksB('prod'), book: op.prod, phys: op.prod },
    ] };
  },
  afterCount() { G.op.matBook -= G.op.matHid; G.op.matHid = 0; },
};

/* =========================================================
 *  建設業：工務店
 * ========================================================= */
const KS_PROJ = {
  house: { n: '注文住宅', min: 2000e4, max: 3200e4, dur: 5, pay: [['c', 0.1], [0, 0.3], [2, 0.3], ['done', 0.3, 1]], mat: 0.45, sub: 0.5, exp: 0.05, load: 1, w: 0.36 },
  reform: { n: 'リフォーム', min: 250e4, max: 900e4, dur: 2, pay: [[0, 0.5], ['done', 0.5, 1]], mat: 0.42, sub: 0.5, exp: 0.08, load: 0.5, w: 0.5 },
  shop: { n: '店舗・事務所の改装', min: 800e4, max: 2400e4, dur: 3, pay: [[0, 0.3], ['done', 0.7, 2]], mat: 0.4, sub: 0.55, exp: 0.05, load: 1, w: 0.11 },
  public: { n: '公共工事（市の施設の改修）', min: 4000e4, max: 7500e4, dur: 7, pay: [[0, 0.4], ['done', 0.6, 1]], mat: 0.42, sub: 0.53, exp: 0.05, load: 2, w: 0.03 },
};
const KS_CLIENTS = ['様邸', '様邸', '様邸'];
KS_ENGINE.con = {
  arLag: 1, creditShare: 0.35,
  init(cond) {
    const op = G.op = { margin: 0.22, ads: 30e4, rep: 1, projects: [], bids: [], doneFY: {}, pseq: 0, mkt: 0.215 };
    G.staff = { site: 4, office: 3 };
    G.rentMonthly = 25e4;
    ksOpenAsset({ n: '現場用トラック 1号', acct: 'veh', cost: 320e4, acqM: KS_HIST_START - 40, life: 5 });
    ksOpenAsset({ n: '現場用トラック 2号', acct: 'veh', cost: 320e4, acqM: KS_HIST_START - 20, life: 5 });
    ksOpenAsset({ n: '軽バン', acct: 'veh', cost: 180e4, acqM: KS_HIST_START - 10, life: 5 });
    ksOpenAsset({ n: '設計用パソコン・CAD', acct: 'equip', cost: 260e4, acqM: KS_HIST_START - 25, life: 6 });
    // 施工中の工事
    let cwip = 0, adv = 0;
    for (const [type, done] of [['house', 2], ['house', 4], ['reform', 1], ['house', 1]]) {
      const p = this.newProject(type, op.margin, KS_HIST_START - done);
      for (let i = 0; i < done; i++) { p.costToDate += p.cost / p.dur; p.parts.mat += p.cost / p.dur * p.T.mat; p.parts.sub += p.cost / p.dur * p.T.sub; p.parts.exp += p.cost / p.dur * p.T.exp; }
      for (const [k, sh] of p.T.pay) if (k === 'c' || (typeof k === 'number' && k < done)) p.recv += p.contract * sh;
      p.costToDate = Math.round(p.costToDate); p.recv = Math.round(p.recv);
      cwip += p.costToDate; adv += p.recv;
      op.projects.push(p);
    }
    return ksOpening({
      cash: 2000e4 * cond.cash, ar: [{ amt: 900e4, due: KS_HIST_START }], ap: [{ amt: 1200e4, due: KS_HIST_START }],
      inv: { cwip }, deposit: 200e4, extra: { advRecv: adv },
      loans: [{ bank: 'shinkin', w: 1, termM: 84, startM: KS_HIST_START - 6, rate: 2.1 }, { bank: 'mirai', w: 1, termM: 12, startM: KS_HIST_START - 4, rate: 1.8, repay: 'bullet', kind: 'tegata', purpose: 'working', roll: true }],
      capital: 1000e4, eq: cond.eq,
    });
  },
  newProject(type, margin, startM) {
    const T = KS_PROJ[type];
    const contract = niceAmount(uni(T.min, T.max) * ksPrice());
    const est = contract / (1 + margin);
    const p = { id: 'P' + (++G.op.pseq), type, T: { pay: T.pay, mat: T.mat, sub: T.sub, exp: T.exp }, n: T.n, client: ksClientName(type), contract, est, cost: Math.round(est * (1 + randn() * 0.03)), dur: T.dur, startM, costToDate: 0, recv: 0, parts: { mat: 0, sub: 0, exp: 0 }, over: 0 };
    return p;
  },
  load() { return sum(G.op.projects.filter(p => !p.fin), p => KS_PROJ[p.type].load); },
  loadCap() { return (G.staff.site || 0) * 3; },
  winP(margin, b) { const rep = G.op.rep; const mu = G.op.mkt + 0.05 * (rep - 1) + (b ? b.mu : 0); return 1 / (1 + Math.exp((margin - mu) / 0.025)); },
  inquiries(ctx) {
    const op = G.op;
    const lam = 5 * ctx.season * ksEcoF(0.8) * (1 + 0.1 * (1 - Math.exp(-op.ads / 40e4)) - 0.05) * op.rep;
    const n = poisson(lam);
    const bids = [];
    for (let i = 0; i < n; i++) {
      const type = wpick(Object.keys(KS_PROJ), Object.values(KS_PROJ).map(t => t.w));
      const T = KS_PROJ[type];
      const est = niceAmount(uni(T.min, T.max) / 1.22 * ksPrice());
      bids.push({ id: 'B' + (++op.pseq), type, n: T.n, client: ksClientName(type), est, dur: T.dur, margin: op.margin, on: true, mu: randn() * 0.025 });
    }
    return bids;
  },
  month(ctx) {
    const op = G.op;
    if (!op.bids.length && G.hist) op.bids = this.inquiries(ctx);
    const loadR = this.load() / Math.max(1, this.loadCap());
    // 施工中の工事
    let doneSales = 0, doneCost = 0, completed = 0;
    for (const p of op.projects) {
      if (p.fin || p.startM > G.m) continue;
      const k = G.m - p.startM;
      if (!p.over && k === Math.floor(p.dur / 2) && chance(0.1 * (loadR > 1 ? 2 : 1))) {
        p.over = uni(0.06, 0.2);
        ksNews(`${p.client}の${p.n}で追加の手直しが発生。原価が${fmtPct(p.over * 100, 0)}ほど膨らみそうです`, 'bad');
      }
      const c = p.cost / p.dur * (1 + p.over);
      const mat = c * p.T.mat, sub = c * p.T.sub, ex = c * p.T.exp;
      ksBuyCredit('cwip', mat + sub, 1, 'cwipMat');
      ksPayCash('cwip', ex, 'cwipExp', 'purchPay');
      p.costToDate += Math.round(mat + sub) + Math.round(ex);
      p.parts.mat += mat; p.parts.sub += sub; p.parts.exp += ex;
      for (const [kk, sh] of p.T.pay) if (kk === k) { const a = Math.round(p.contract * sh); ksPost('advRecv', [['cash', a, 0], ['advRecv', 0, a]], { cf: 'collect' }); p.recv += a; }
      if (k >= p.dur - 1) {
        // 完成・引渡し（工事完成基準）
        const rest = p.contract - p.recv;
        const lagDone = (p.T.pay.find(x => x[0] === 'done') || [0, 0, 1])[2] || 1;
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
    // 見積の結果
    let won = 0;
    for (const b of op.bids) {
      if (!b.on) continue;
      if (rand() < this.winP(b.margin, b)) {
        const p = { id: 'P' + (++op.pseq), type: b.type, T: { pay: KS_PROJ[b.type].pay, mat: KS_PROJ[b.type].mat, sub: KS_PROJ[b.type].sub, exp: KS_PROJ[b.type].exp }, n: b.n, client: b.client,
          contract: niceAmount(b.est * (1 + b.margin)), est: b.est, cost: Math.round(b.est * (1 + randn() * 0.035) * (loadR > 1 ? 1.03 : 1)), dur: b.dur, startM: G.m + 1, costToDate: 0, recv: 0, parts: { mat: 0, sub: 0, exp: 0 }, over: 0 };
        const dep = p.T.pay.find(x => x[0] === 'c');
        if (dep) { const a = Math.round(p.contract * dep[1]); ksPost('advRecv', [['cash', a, 0], ['advRecv', 0, a]], { cf: 'collect', desc: '契約金の受取' }); p.recv += a; }
        op.projects.push(p);
        won++;
        if (!G.hist) ksNews(`${p.client}の${p.n}を受注しました（請負金額 ${fmtYen(p.contract)}・見積利益率 ${fmtPct(b.margin * 100, 0)}）`, 'good');
      }
    }
    op.bids = [];
    op.rep = clamp(op.rep + 0.01 * (loadR > 1.05 ? -(loadR - 1) * 2 : 0.02) - ksRepPull(op.rep), 0.75, 1.2);
    G.rentMonthly = 25e4;
    ksPayCash('rent', 25e4, 'rent');
    ksPayCash('util', 8e4, 'expense');
    ksPayCash('ads', op.ads, 'ads');
    ksPayCash('fees', 12e4, 'fees');
    ksPayCash('misc', 10e4, 'expense');
    ksPayCash('supplies', 5e4, 'expense');
    ksPayCash('freight', 15e4 * ksPrice(), 'freight');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 10e4, 'dues');
    const backlog = sum(op.projects.filter(p => !p.fin), p => p.contract);
    return { mgAdj: 0, kpi: { backlog, active: op.projects.filter(p => !p.fin).length, completed, doneSales, doneCost, won, loadR, sales: doneSales } };
  },
  next() {
    // 翌月の見積依頼
    const ctx = { season: KS_INDS.con.season[ksMonthIndex(G.m)] };
    G.op.bids = this.inquiries(ctx);
  },
  auto() {
    ksAutoStaff('site', Math.max(2, this.load() / 2.6));
    ksAutoStaff('office', 3);
    for (const b of G.op.bids) { b.margin = G.op.margin; b.on = this.load() + KS_PROJ[b.type].load <= this.loadCap() * 1.05; }
  },
};
function ksClientName(type) {
  if (type === 'public') return '汐見市';
  if (type === 'shop') return pick(CO_PREFIX) + pick(['商店', '歯科医院', '不動産', '設計事務所', 'カフェ']);
  return pick(FAMILY_NAMES) + '様邸';
}

/* =========================================================
 *  卸売業：食品卸
 * ========================================================= */
const KS_CUST_KIND = ['スーパー', '飲食店', '給食センター', 'ホテル', '弁当店', 'コンビニ加盟店', '病院'];
KS_ENGINE.whl = {
  arLag: 1, creditShare: 1,
  arTerms() {
    const cs = G.op.customers;
    const tot = sum(cs, c => c.size * c.ramp) || 1;
    const s1 = sum(cs.filter(c => c.terms === 1), c => c.size * c.ramp) / tot;
    return [[1, s1], [2, 1 - s1]];
  },
  init(cond) {
    const op = G.op = { customers: [], margin: 0.125, policy: 'std', invDays: 18, book: 0, hid: 0, rep: 1, cseq: 0 };
    G.staff = { sales: 4, logi: 7, office: 2 };
    G.rentMonthly = 80e4;
    for (let i = 0; i < 31; i++) op.customers.push(this.newCustomer('std', KS_HIST_START - randInt(6, 180)));
    // 取引先の規模の合計をそろえる（月9,000万円。会社の大きさが運で大きく変わらないように）
    const tot = sum(op.customers, c => c.size);
    for (const c of op.customers) c.size = Math.round(c.size * 9000e4 / tot / 1e4) * 1e4;
    for (let i = 0; i < 6; i++) ksOpenAsset({ n: `配送トラック ${i + 1}号`, acct: 'veh', cost: 480e4, acqM: KS_HIST_START - randInt(2, 58), life: 5, cap: 1650e4 });
    ksOpenAsset({ n: '冷蔵倉庫の設備', acct: 'bldg', cost: 3000e4, acqM: -110, life: 15 });
    ksOpenAsset({ n: 'フォークリフト・棚', acct: 'equip', cost: 600e4, acqM: -40, life: 6 });
    const salesM = sum(op.customers, c => c.size) * G.eco.priceIdx;
    op.book = Math.round(salesM * 0.86 * 18 / 30.4);
    const ar = [];
    for (const c of op.customers) { const a = c.size * G.eco.priceIdx; ar.push({ amt: a, due: KS_HIST_START + c.terms - 1, cust: c.id }); if (c.terms === 2) ar.push({ amt: a, due: KS_HIST_START, cust: c.id }); }
    return ksOpening({
      cash: 2500e4 * cond.cash, ar, ap: [{ amt: salesM * 0.86, due: KS_HIST_START }],
      inv: { goods: op.book }, deposit: 800e4,
      loans: [{ bank: 'mirai', w: 1, termM: 12, startM: KS_HIST_START - 3, rate: 1.7, repay: 'bullet', kind: 'tegata', purpose: 'working', roll: true }, { bank: 'mirai', w: 1, termM: 84, startM: KS_HIST_START - 30, rate: 1.8 }],
      capital: 3000e4, eq: cond.eq,
    });
  },
  newCustomer(policy, since) {
    const op = G.op;
    const pdR = { strict: [0.15, 0.7], std: [0.3, 1.6], loose: [1.2, 5] }[policy];
    const kind = pick(KS_CUST_KIND);
    return { id: 'C' + (++op.cseq), n: `${pick(CO_PREFIX)}${kind === '飲食店' ? pick(['亭', '食堂', '屋']) : kind}`, kind, size: Math.round(Math.exp(Math.log(225e4) + randn() * 0.7) / 1e4) * 1e4, terms: chance(policy === 'loose' ? 0.6 : 0.4) ? 2 : 1, pd: uni(pdR[0], pdR[1]), since: since ?? G.m, ramp: since === undefined ? 0.5 : 1 };
  },
  trucks() { return ksActiveAssets().filter(a => a.acct === 'veh'); },
  capacity() { return sum(this.trucks(), a => a.cap || 1650e4) * ksPrice() * Math.min(1, G.staff.logi / Math.max(1, this.trucks().length * 1.1)); },
  month(ctx) {
    const op = G.op, e = G.eco;
    const priceF = Math.exp(-(op.margin - 0.125) * 10);
    const pot = sum(op.customers, c => c.size * c.ramp) * ctx.season * ksEcoF(0.8) * priceF * ksPrice();
    const capF = Math.min(1, this.capacity() / Math.max(1, pot));
    let sales = 0;
    for (const c of op.customers) {
      const a = Math.round(c.size * c.ramp * ctx.season * ksEcoF(0.8) * priceF * ksPrice() * capF * ksNoise(0.08));
      if (a <= 0) continue;
      ksSaleCredit(a, c.terms, { cust: c.id });
      sales += a;
      c.ramp = Math.min(1, c.ramp + 0.1);
    }
    const cogs = sales * (1 - op.margin);
    const waste = sales * 0.002;
    op.hid += sales * 0.001;
    const target = cogs * op.invDays / 30.4;
    const purchases = Math.max(0, cogs + waste + target - op.book);
    op.book += purchases - cogs - waste;
    ksBuyCredit('purch', purchases, 1, 'purch');
    // 取引先の倒産・離脱・新規
    const rec = e.regime === 'recession' ? 1.8 : 1;
    let bad = 0;
    for (const c of op.customers.slice()) {
      if (chance(c.pd / 100 / 12 * rec)) {
        const amt = ksWriteOffAR(c.id, 1);
        bad += amt;
        op.customers = op.customers.filter(x => x !== c);
        if (!G.hist) ksNews(`取引先の${c.n}が倒産しました。売掛金${fmtYen(amt)}が回収できません（貸倒れ）`, 'bad');
      } else if (chance(0.008 + Math.max(0, op.margin - 0.125) * 0.4 + (capF < 0.97 ? 0.01 : 0))) {
        op.customers = op.customers.filter(x => x !== c);
        if (!G.hist) ksNews(`${c.n}が他の卸に取引を移しました`, 'bad');
      }
    }
    const pf = { strict: 0.7, std: 1, loose: 1.5 }[op.policy];
    const nNew = poisson(0.3 * (G.staff.sales / 4) * pf * (op.margin < 0.115 ? 1.3 : 1) * op.rep);
    for (let i = 0; i < nNew; i++) { const c = this.newCustomer(op.policy); op.customers.push(c); if (!G.hist) ksNews(`新しい取引先：${c.n}（月${fmtYen(c.size)}ほど・${c.terms === 2 ? '翌々月' : '翌月'}末払い）`, 'good'); }
    ksPayCash('rent', 80e4, 'rent');
    G.rentMonthly = 80e4;
    ksPayCash('freight', sales * 0.01, 'freight');
    ksPayCash('util', 30e4 * ksPrice(), 'expense');
    ksPayCash('supplies', sales * 0.002, 'expense');
    ksPayCash('repairs', this.trucks().length * 3e4, 'repairs');
    ksPayCash('fees', 12e4, 'fees');
    ksPayCash('misc', 10e4, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 15e4, 'dues');
    op.rep = clamp(op.rep + 0.01 * (capF < 0.97 ? -1 : 0.02) - ksRepPull(op.rep), 0.8, 1.2);
    return { mgAdj: cogs + waste - purchases, kpi: { sales, customers: op.customers.length, capF, nNew, bad, gpr: op.margin - 0.002, cap: this.capacity() } };
  },
  auto() {
    const pot = sum(G.op.customers, c => c.size * c.ramp) * ksPrice();
    const cap = this.capacity();
    if (cap < pot * 1.02 && G.m % 3 === 0) {
      const t = ksNewAsset({ n: `配送トラック ${this.trucks().length + 1}号`, acct: 'veh', cost: Math.round(480e4 * ksPrice()), life: 5, cap: 1650e4 });
      ksPost('buyAsset', [['veh', t.cost, 0], ['cash', 0, t.cost]], { cf: 'capex' });
    } else if (cap > pot * 1.45 && this.trucks().length > 3 && G.m % 6 === 0) {
      // 余っているトラックを売る（いちばん古いもの）
      const old = this.trucks().slice().sort((a, b) => a.acqM - b.acqM)[0];
      ksSellAsset(old, Math.round(ksBookValue(old) * 0.9 + 20e4));
    }
    ksAutoStaff('logi', this.trucks().length * 1.15);
    // 取引先が減ってトラックが余るときは営業を増やして新規開拓
    ksAutoStaff('sales', pot < cap * 0.8 ? 6 : 4);
  },
  stockCount() {
    const op = G.op;
    return { items: [{ acct: 'goods', n: '商品', begin: ksB('goods'), book: Math.round(op.book), phys: Math.round(op.book - op.hid) }] };
  },
  afterCount() { G.op.book -= G.op.hid; G.op.hid = 0; },
};

/* =========================================================
 *  情報通信業：ソフトウェア受託開発
 * ========================================================= */
KS_ENGINE.it = {
  arLag: 1, creditShare: 1,
  init(cond) {
    G.op = { price: 80e4, salaryLv: 1, outsource: true, training: 20e4, skill: 1, base: 19.2, rep: 1, hires: [], dev: null, svc: null };
    G.staff = { eng: 20, sales: 3 };
    G.rentMonthly = 100e4;
    ksOpenAsset({ n: '開発用パソコン一式', acct: 'equip', cost: 700e4, acqM: KS_HIST_START - 20, life: 4 });
    ksOpenAsset({ n: 'オフィスの内装', acct: 'bldg', cost: 1200e4, acqM: KS_HIST_START - 30, life: 15 });
    const salesM = 19 * 80e4 * G.eco.priceIdx;
    return ksOpening({
      cash: 2200e4 * cond.cash, ar: [{ amt: salesM, due: KS_HIST_START }], ap: [{ amt: 2 * 68e4, due: KS_HIST_START }], deposit: 1000e4,
      loans: [{ bank: 'mirai', w: 1, termM: 60, startM: KS_HIST_START - 6, rate: 1.9, purpose: 'working' }],
      capital: 2000e4, eq: cond.eq,
    });
  },
  avail() {
    const op = G.op;
    const devN = op.dev ? op.dev.n : 0;
    let p = 0;
    const newbies = op.hires.filter(h => G.m - h < 3);
    const veteran = Math.max(0, G.staff.eng - devN - newbies.length);
    p = veteran;
    for (const h of newbies) p += [0.4, 0.7, 0.9][G.m - h] || 1;
    return p;
  },
  demand(ctx) {
    const op = G.op;
    return op.base * ctx.season * ksEcoF(0.6) * Math.exp(-(op.price / (80e4 * ksPrice()) - 1) * 2.2) * op.rep * Math.sqrt(Math.max(0.3, G.staff.sales / 3));
  },
  month(ctx) {
    const op = G.op, e = G.eco;
    const avail = this.avail();
    const demand = this.demand(ctx) * ksNoise(0.06);
    const own = Math.min(demand, avail);
    const util = avail > 0 ? own / avail : 0;
    const sub = op.outsource ? Math.min(Math.max(0, demand - own), avail * 0.3) : 0;
    const skillF = 1 + (op.skill - 1) * 0.5;
    const sales = (own * skillF + sub) * op.price;
    ksSaleCredit(sales, 1);
    if (sub > 0) ksBuyCredit('subcon', sub * 68e4 * ksPrice(), 1, 'subcon');
    ksPayCash('mfgExp', G.staff.eng * 2e4 * ksPrice(), 'mfgExp');
    // 自社サービス
    let svcSales = 0;
    if (op.svc) {
      const s = op.svc;
      s.users = Math.max(0, s.users + poisson(s.growth * op.rep) - poisson(s.users * 0.02));
      svcSales = s.users * s.price;
      if (svcSales > 0) ksSaleCredit(svcSales, 1, { card: true, fee: 0.036 });
      ksPayCash('mfgExp', 15e4 + s.users * 300, 'mfgExp');
    }
    ksPayCash('rent', 100e4, 'rent');
    G.rentMonthly = 100e4;
    ksPayCash('util', 10e4, 'expense');
    ksPayCash('ads', 10e4, 'ads');
    ksPayCash('fees', 15e4, 'fees');
    ksPayCash('misc', 10e4, 'expense');
    ksPayCash('recruit', op.training, 'expense');
    if ([6, 9, 12, 2].includes(ctx.mo)) ksPayCash('dues', 5e4, 'dues');
    op.skill = clamp(op.skill + (op.training / 20e4 - 1) * 0.004 + 0.0005 - (util > 0.98 ? 0.001 : 0), 0.85, 1.3);
    // 応えきれなかった依頼（自社でも外注でもこなせなかった分）が多いと評判が下がる
    const unserved = Math.max(0, demand - own - sub);
    op.rep = clamp(op.rep + 0.008 * (unserved > demand * 0.1 ? -0.5 : 0.02) + (op.skill - 1) * 0.01 - ksRepPull(op.rep), 0.75, 1.25);
    // 離職
    const quitP = 0.008 * (1 + 3 * Math.max(0, 1 - op.salaryLv)) * (util > 0.98 ? 1.3 : 1) * (op.salaryLv > 1.08 ? 0.7 : 1);
    const quits = G.hist ? 0 : [...Array(Math.max(0, G.staff.eng))].filter(() => chance(quitP)).length;
    const afterPayroll = () => {
      if (op.dev) {
        const d = op.dev;
        const amt = Math.round(d.n * 38e4 * e.wageIdx * op.salaryLv * 1.15);
        ksPost('swDev', [['swip', amt, 0], ['labor', 0, amt]], { desc: `自社サービスの開発費の振替（${d.name}）` });
        op.devFY = op.devFY || {};
        op.devFY[fyOf(G.m)] = (op.devFY[fyOf(G.m)] || 0) + amt;
        d.spent += amt;
        d.left--;
        if (d.left <= 0) {
          ksPost('swRelease', [['sw', d.spent, 0], ['swip', 0, d.spent]], { desc: `ソフトウェアの完成（${d.name}）` });
          ksNewAsset({ n: d.name, acct: 'sw', cost: d.spent, life: 5, acqM: G.m + 1 });
          op.svc = { name: d.name, users: 0, price: d.price, growth: d.growth, launchM: G.m + 1 };
          op.dev = null;
          ksNews(`自社サービス「${d.name}」が完成しました。開発費${fmtYen(d.spent)}をソフトウェア（無形固定資産）に計上し、来月から5年で償却します`, 'good');
        }
      }
      if (quits) {
        G.staff.eng = Math.max(0, G.staff.eng - quits);
        ksNews(`エンジニア${quits}人が退職しました${op.salaryLv < 1 ? '（給与が相場より低いのが一因です）' : ''}`, 'bad');
      }
    };
    return { afterPayroll, mgAdj: 0, kpi: { demand, avail, own, util, sub, sales: sales + svcSales, price: op.price, svcSales } };
  },
  auto() {
    G.op.price = Math.round(80e4 * ksPrice() / 1e4) * 1e4;
    const d = this.demand({ season: 1 }) * 0.98;
    if (this.avail() < d - 1 && G.m % 2 === 0) { G.staff.eng++; G.op.hires.push(G.m); ksPayCash('recruit', 150e4, 'expense'); }
    else if (this.avail() > d * 1.08 + 0.5 && G.m % 3 === 0 && G.staff.eng > 3) G.staff.eng--; // 仕事が足りなければ退職者を補充しない
    G.op.hires = G.op.hires.filter(h => G.m - h < 6);
  },
};
