'use strict';
/* =========================================================
 *  06_loans.js : 融資の申込・調査・条件・実行・管理・回収
 * ========================================================= */

const isActiveLoan = L => L.status === 'current' || L.status === 'late' || L.status === 'default' || L.status === 'bankrupt';

/* ---------- 申込の生成 ---------- */
function genApplications() {
  if (G.flags.lendingBan > G.m) return;
  const pres = districtPresence();
  const totalPres = sum(Object.values(pres));
  const trustF = 0.6 + 0.8 * G.trust / 100;
  const lamBiz = (1.0 + 0.2 * G.staff.sales + 0.7 * totalPres) * G.eco.demand * trustF;
  const nBiz = Math.min(10, poisson(lamBiz));
  for (let i = 0; i < nBiz; i++) {
    const did = wpick(DISTRICTS.map(d => d.id), DISTRICTS.map(d => (pres[d.id] + 0.08) * G.city.d[d.id].firms * Math.pow(G.city.d[d.id].vit / 100, 1.5)));
    // 既存取引先からの追加融資の申込
    const borrowers = [...new Set(G.loans.filter(L => L.kind === 'biz' && L.status === 'current' && L.coId && G.m - L.startM > 8).map(L => L.coId))];
    let co;
    if (borrowers.length && chance(0.22)) {
      co = G.companies[pick(borrowers)];
      if (!co || G.apps.some(a => a.coId === co.id)) continue;
    } else {
      co = genCompany({ district: did, sizeMul: 1.4 });
      G.companies[co.id] = co;
    }
    G.apps.push(makeBizApp(co));
  }
  // 大企業・海外企業との取引（メガバンク以上）
  if (stageOf() >= 1 && G.net) genBigApplications(trustF);
  // 住宅ローン
  const ourVar = mortVarRate();
  const comp = Math.exp(-4 * (ourVar - G.eco.mortVar));
  let mortDemand = 0;
  for (const d of DISTRICTS) mortDemand += (pres[d.id] + 0.05) * d.mort * (1 + G.city.d[d.id].mortBoost) * (G.city.d[d.id].pop / d.pop);
  const lamM = (0.1 + 0.3 * mortDemand + 0.2 * G.sys.digital) * clamp(comp, 0.3, 2.5) * trustF * Math.exp(-0.3 * (G.eco.mortVar - 0.85));
  const nM = Math.min(8, poisson(lamM));
  for (let i = 0; i < nM; i++) {
    const did = wpick(DISTRICTS.map(d => d.id), DISTRICTS.map(d => (pres[d.id] + 0.05 + 0.1 * G.sys.digital) * d.mort * G.city.d[d.id].pop));
    G.apps.push(makeMortApp(genPerson(did)));
  }
}

function genBigApplications(trustF) {
  const areas = [], w = [];
  for (const R of NATIONS) { const r = G.net[R.id]; if (r.lv >= 1) { areas.push(R.id); w.push(R.loan * (0.5 + r.lv)); } }
  if (stageOf() >= 2) for (const R of OVERSEAS) { const r = G.net[R.id]; if (r.lv >= 1 && r.frozenUntil <= G.m) { areas.push(R.id); w.push(R.loan * 0.2 * (0.5 + r.lv)); } }
  if (!areas.length) return;
  const lam = (0.5 + 0.06 * natLevelSum() + 0.12 * ovsLevelSum()) * G.eco.demand * trustF;
  const n = Math.min(4, poisson(lam));
  const existing = [...new Set(G.loans.filter(L => L.kind === 'biz' && L.status === 'current' && L.coId && G.companies[L.coId] && G.companies[L.coId].big && G.m - L.startM > 8).map(L => L.coId))];
  for (let i = 0; i < n; i++) {
    let co;
    if (existing.length && chance(0.2)) {
      co = G.companies[pick(existing)];
      if (!co || G.apps.some(a => a.coId === co.id)) continue;
    } else {
      const a = wpick(areas, w);
      co = genCompany({ district: a, big: true, sizeMul: isOvsArea(a) ? 1.8 : 1 });
      G.companies[co.id] = co;
    }
    G.apps.push(makeBizApp(co));
  }
}

function makeBizApp(co) {
  const Lr = latestRep(co), Lt = latestTrue(co);
  const existing = G.loans.some(L => L.coId === co.id && isActiveLoan(L));
  const losing = Lt.ORD < 0 || (co.fraud && co.q < -0.8);
  const purpose = co.big
    ? wpick(Object.keys(PURPOSES), [22, 6, 30, existing ? 4 : 12, losing ? 10 : 1, 18])
    : wpick(Object.keys(PURPOSES), [30, 12, 30, existing ? 4 : 15, losing ? 18 : 2, 0]);
  const P = PURPOSES[purpose];
  let amt;
  switch (purpose) {
    case 'wc': amt = Lr.S / 12 * uni(1.0, 2.5); break;
    case 'season': amt = Lr.S / 12 * uni(0.5, 1.2); break;
    case 'capex': amt = Lr.S * uni(0.08, 0.4); break;
    case 'refi': amt = (Lr.STD + Lr.LTD) * uni(0.3, 0.7); break;
    case 'mna': amt = Lr.S * uni(0.1, 0.5); break;
    default: amt = Lr.S / 12 * uni(0.5, 1.5);
  }
  if (co.big) amt = niceAmount(clamp(Math.min(amt, Math.max(5e8, largeExposureLimit() * uni(0.35, 1.15))), 5e8, 2e12));
  else amt = niceAmount(clamp(amt, 5e6, 60e8));
  let termM = randInt(P.term[0], P.term[1]);
  termM = purpose === 'season' ? termM : Math.max(12, Math.round(termM / 12) * 12);
  const hiddenPurpose = losing && purpose !== 'deficit' && chance(0.6);
  const app = {
    id: 'A' + (++G.seq.app), kind: 'biz', m: G.m, exp: G.m + 1, coId: co.id, district: co.district,
    purpose, amountReq: amt, termReqM: termM, repayReq: P.repay, rateTypeReq: chance(0.6) ? 'var' : 'fixed',
    hasRE: !!co.ownsRE, existing, inv: {}, noise: randn() * 0.35, hiddenPurpose, status: 'pending',
    otherRate: purpose === 'refi' ? +(marketLoanRate(co.gRep, termM) + uni(0.1, 0.6)).toFixed(2) : null,
  };
  if (purpose === 'capex') app.capexItem = pick({
    mfg: ['NC旋盤・マシニングセンタの更新', '新工場棟の建設', '自動化ラインの導入'], con: ['重機の購入', '資材置場の取得'],
    whl: ['物流倉庫の新設', '配送車両の入替'], ret: ['新店舗の出店', '既存店の全面改装'], food: ['2号店の出店', '厨房設備の更新'],
    trn: ['トラック10台の入替', '物流センターの新設'], re: ['賃貸マンションの建設', '収益ビルの取得'], it: ['データセンター設備の増強', '本社移転・開発環境の整備'],
    med: ['介護施設の新設', '医療機器の更新'], htl: ['客室の全面改装', '露天風呂付き客室の新設'], agr: ['ハウス栽培施設の建設', '農業機械の購入'],
  }[co.ind]);
  if (purpose === 'mna') app.capexItem = pick(['同業他社の買収', '海外企業の買収', '事業部門の買収（カーブアウト）', '上場子会社の完全子会社化']);
  app.terms = defaultTerms(app);
  return app;
}

function makeMortApp(p) {
  const rateTypeReq = chance(0.72) ? 'var' : 'fix10';
  const app = {
    id: 'A' + (++G.seq.app), kind: 'mort', m: G.m, exp: G.m + 1, person: p, district: p.district,
    purpose: 'mort', amountReq: p.amount, termReqM: p.termY * 12, repayReq: 'annuity', rateTypeReq,
    hasRE: true, inv: {}, noise: randn() * 0.35, status: 'pending',
  };
  app.terms = defaultTerms(app);
  return app;
}

/* ---------- 金利 ---------- */
function mortVarRate() { return Math.max(0.1, G.rates.prime - G.rates.mortDisc); }
function mortFixRate() { return Math.max(0.1, G.eco.y[10] + G.rates.mortFixSpread); }

function appSysGrade(app) {
  if (app.kind === 'biz') return bankGrade(G.companies[app.coId]);
  const p = app.person, t = app.terms;
  return mortGrade(p, t.amount, appRate(app, t), t.termM / 12);
}
function suggestedRate(app, termM) {
  if (app.kind === 'mort') return app.terms.rateType === 'var' ? mortVarRate() : mortFixRate();
  return +marketLoanRate(appSysGrade(app), termM).toFixed(2);
}
function defaultTerms(app) {
  if (app.kind === 'mort') {
    return { amount: app.amountReq, rateType: app.rateTypeReq, rateAdj: 0, termM: app.termReqM, repay: 'annuity', guarantee: 'company' };
  }
  const fixed = suggestedRate(app, app.termReqM);
  return {
    amount: app.amountReq, rateType: app.rateTypeReq, rate: fixed,
    spread: +(fixed - G.rates.prime).toFixed(2), termM: app.termReqM, repay: app.repayReq,
    collateral: app.hasRE, guarantee: 'none',
  };
}
/* 条件から実効金利（%）を求める */
function appRate(app, t) {
  if (app.kind === 'mort') return Math.max(0.1, (t.rateType === 'var' ? mortVarRate() : mortFixRate()) + (t.rateAdj || 0));
  return Math.max(0.1, t.rateType === 'var' ? G.rates.prime + t.spread : t.rate);
}

/* ---------- 成約確率 ---------- */
function acceptProb(app, t, mode = 'true') {
  const rate = appRate(app, t);
  let x;
  if (app.kind === 'biz') {
    const co = G.companies[app.coId];
    const mkt = marketLoanRate(co.gRep, t.termM);
    const gd = mode === 'true' ? co.gTrue : bankGrade(co);
    let desp = clamp((gd - 4) / 6, 0, 1);
    if (mode === 'true' && co.fraud) desp = Math.min(1, desp + 0.3);
    const sens = 3.6 * (1 - 0.7 * desp);
    x = 1.5 - sens * (rate - mkt);
    x -= 2.2 * Math.max(0, 1 - t.amount / app.amountReq);
    x -= 0.6 * Math.max(0, (app.termReqM - t.termM) / app.termReqM);
    if (t.collateral && app.hasRE) x -= 0.35;
    if (t.guarantee === 'cgc') x -= 0.45;
    if (t.guarantee === 'personal') x -= co.big ? 2.5 : 0.3;
    if (app.existing) x += 0.5;
    if (app.purpose === 'refi' && app.otherRate) x += 3 * (app.otherRate - rate) * 0.5;
  } else {
    const mkt = t.rateType === 'var' ? G.eco.mortVar : G.eco.mortFix;
    x = 1.6 - 5.5 * (rate - mkt);
    x -= 2.5 * Math.max(0, 1 - t.amount / app.amountReq);
    x -= 0.6 * Math.max(0, (app.termReqM - t.termM) / app.termReqM);
    if (t.guarantee === 'company') x -= 0.2;
  }
  x += (G.trust - 60) / 40 * 0.4;
  if (mode === 'true') x += app.noise;
  return sigmoid(x);
}

/* ---------- 大口信用供与規制 ---------- */
function exposureOf(key) {
  let t = 0;
  for (const L of G.loans) if (isActiveLoan(L) && (L.coId === key || L.projId === key)) t += L.bal;
  return t;
}
function largeExposureLimit() { return Math.max(0, coreCapital() * 0.25); }

/* ---------- 調査 ---------- */
const INV_BIZ = {
  bureau: { name: '信用調査会社レポート', days: 0.5, cost: 5e4, desc: '評点、支払状況、他社借入の情報を取り寄せる' },
  interview: { name: '代表者面談', days: 1, cost: 0, desc: '経営者の資質と資金使途の妥当性を確かめる' },
  site: { name: '実地調査（工場・店舗・在庫）', days: 2, cost: 10e4, desc: '稼働状況を確認し、在庫の実地棚卸に立ち会う' },
  tax: { name: '税務申告書・内訳書の照合', days: 1, cost: 0, desc: '法人税申告書、別表、勘定科目内訳書と決算書を突き合わせる' },
  ar: { name: '売掛先への残高確認', days: 2, cost: 3e4, desc: '主要な売掛先に売掛金残高を直接照会する（先方の同意が必要）' },
  bank: { name: '預金口座の入出金分析', days: 1, cost: 0, desc: 'メイン口座の入出金明細から資金の流れを追う' },
  appraisal: { name: '担保不動産の鑑定評価', days: 0, cost: 40e4, desc: '不動産鑑定士に担保物件の評価を依頼する', cond: co => co.ownsRE },
};
const INV_MORT = {
  credit: { name: '個人信用情報の照会', days: 0.2, cost: 1e3, desc: '他社借入と延滞履歴を確認する' },
  employ: { name: '在籍確認', days: 0.2, cost: 0, desc: '勤務先に在籍の事実を電話で確認する' },
  taxcert: { name: '課税証明書との照合', days: 0.3, cost: 0, desc: '源泉徴収票と市区町村の課税証明書を突き合わせる' },
  property: { name: '物件調査', days: 0.5, cost: 5e4, desc: '物件の現地確認と担保評価' },
};
const DETECT = {
  bureau: { hiddenDebt: 0.55, fakeSales: 0.05, inventory: 0.03, expenseCap: 0.03, depreciation: 0.02 },
  interview: { hiddenDebt: 0.12, fakeSales: 0.1, inventory: 0.1, expenseCap: 0.12, depreciation: 0.1 },
  site: { inventory: 0.75, depreciation: 0.3, fakeSales: 0.15, expenseCap: 0.08, hiddenDebt: 0.05 },
  tax: { depreciation: 0.85, expenseCap: 0.7, fakeSales: 0.5, inventory: 0.3, hiddenDebt: 0.25 },
  ar: { fakeSales: 0.85, inventory: 0.05, expenseCap: 0.05, depreciation: 0, hiddenDebt: 0.05 },
  bank: { hiddenDebt: 0.7, fakeSales: 0.35, expenseCap: 0.3, inventory: 0.1, depreciation: 0 },
};
const FOUND_TEXT = {
  fakeSales: {
    ar: X => `主要売掛先に残高確認を実施したところ、複数社から「該当する取引はない」との回答。売掛金のうち約${X}が架空と推定される。`,
    tax: X => `法人税申告書の売上高が決算書より約${X}少ない。金融機関向けに別の決算書を作成している疑い（二重決算）。`,
    bank: X => `売上代金の入金が計上売上を大きく下回る。売掛金約${X}が回収実態のない架空債権とみられる。`,
    site: X => `工場の稼働状況が売上規模に見合わない。追及すると架空の売上計上（約${X}）を認めた。`,
    other: X => `取引実態のない売上が計上されている（約${X}）。`,
  },
  inventory: {
    site: X => `実地棚卸に立ち会ったところ、帳簿在庫と現物に約${X}の差。架空在庫の計上が強く疑われる。`,
    tax: X => `勘定科目内訳書の棚卸資産明細と決算書の在庫額が一致しない（差額約${X}）。`,
    other: X => `在庫が約${X}水増しされ、売上原価が過小に計上されている。`,
  },
  expenseCap: {
    tax: X => `仮払金・前払費用の内訳に実体のない項目が多数。費用を資産に付け替えている（約${X}）。`,
    bank: X => `仮払金とされる支出の大半が給与・外注費の支払いと一致。費用の資産計上（約${X}）が判明。`,
    other: X => `本来は費用である支出約${X}が資産に計上されている。`,
  },
  depreciation: {
    tax: X => `別表十六で償却限度額に対し累計約${X}の償却不足を確認。利益を嵩上げするため減価償却を計上していない。`,
    site: X => `主要設備は老朽化が進んでいるのに簿価が高すぎる。減価償却の未計上（累計約${X}）を確認。`,
    other: X => `減価償却費の計上不足が累計約${X}ある。`,
  },
  hiddenDebt: {
    bureau: X => `ノンバンク・リース会社からの借入情報あり。決算書に記載のない借入金が約${X}ある。`,
    bank: X => `毎月、決算書にない借入先（ノンバンク・個人名義）へ定額の返済を確認。簿外債務は約${X}とみられる。`,
    tax: X => `勘定科目内訳書にない借入先への支払利息を確認。簿外債務（約${X}）の存在が濃厚。`,
    other: X => `決算書に記載のない借入金が約${X}ある。`,
  },
};
const HINT_TEXT = {
  bureau: '業界内で資金繰りに関する噂がある。',
  interview: '決算数値に関する質問への回答が曖昧で、資料の提出も遅れがち。',
  site: '在庫や設備の管理状況がやや雑然としており、帳簿との照合に時間がかかった。',
  tax: '申告書類の提出を何度も催促する必要があった。',
  ar: '売掛先への確認について、先方が難色を示している。',
  bank: '入出金の一部に説明のつかない動きがある。',
};

/* 不動産の現在価値（地区の地価で補正） */
function reNow(co, v) { const land = areaLand(co.district); return v * land / (co.reLand0 || land); }

function fraudAmountOf(co) {
  const f = co.fraud;
  if (!f) return 0;
  return f.type === 'hiddenDebt' ? f.hiddenNow : f.cum;
}

function creditCapacity() { return G.staff.credit * 10 * (G.sys.credit >= 3 ? 1.3 : 1); }
function creditCapLeft() { return creditCapacity() - G.capUsed.credit; }

/* 調査の実行。target: 申込（app）または 融資先企業（co）の期中モニタリング */
function runInvestigation(target, key, isMonitor) {
  const kind = isMonitor ? 'biz' : target.kind;
  const def = (kind === 'mort' ? INV_MORT : INV_BIZ)[key];
  const store = isMonitor ? target.mon : target.inv;
  if (!def || store[key]) return { ok: false, msg: '実施済みです' };
  if (creditCapLeft() < def.days - 1e-9) return { ok: false, msg: '今月の審査部の人員に余裕がありません（審査担当を増員してください）' };
  G.capUsed.credit += def.days;
  if (def.cost) payExpense(def.cost, 'premises', '信用調査費・鑑定料等');
  const res = kind === 'mort' ? runMortInv(target, key) : runBizInv(isMonitor ? target : G.companies[target.coId], key, isMonitor ? null : target);
  store[key] = res;
  G.stats.investigations++;
  return { ok: true, res };
}

function runBizInv(co, key, app) {
  const f = co.fraud;
  const active = f && f.years > 0 && !f.exposed;
  if (active && !f.found && chance(DETECT[key]?.[f.type] || 0)) {
    f.found = true;
    f.foundM = G.m;
    f.foundBy = key;
    G.stats.fraudFound++;
    const X = fmtYen(fraudAmountOf(co));
    const tx = (FOUND_TEXT[f.type][key] || FOUND_TEXT[f.type].other)(X);
    for (const L of G.loans) if (L.coId === co.id && isActiveLoan(L)) L.fraudKnown = true;
    return { status: 'major', text: tx, found: true };
  }
  if (active && f.found && key !== 'appraisal') {
    return { status: 'major', text: `粉飾（${FRAUD_TYPES[f.type].name}）はすでに判明している。実態の財務内容で判断すること。` };
  }
  const r = ratiosOf(latestTrue(co), co.years[co.years.length - 2].T);
  switch (key) {
    case 'bureau': {
      const sc = Math.round(clamp(co.scoreTrue * 0.55 + co.scoreRep * 0.45 + randn() * 4, 20, 90));
      const pay = co.q < -1.1 ? '一部の仕入先への支払遅延情報あり。' : '支払状況：遅延の情報なし。';
      const rep = co.mq > 0.8 ? '代表者は地元経済界での信頼が厚い。' : co.mq < -1 ? '代表者の経営手腕を疑問視する声もある。' : '業界内での評判は標準的。';
      const st = active && chance(0.35) ? 'minor' : co.q < -1.1 ? 'minor' : 'ok';
      return { status: st, text: `評点${sc}点。${pay}${rep}${st === 'minor' && active ? HINT_TEXT.bureau : ''}`, score: sc };
    }
    case 'interview': {
      const mq = co.mq + randn() * 0.3;
      let t = mq > 1 ? '事業計画が具体的で、数字にも明るい。後継者も育っている。' : mq > 0 ? '堅実な経営姿勢で、説明は筋が通っている。'
        : mq > -1 ? '売上見通しが楽観的で、計画の根拠がやや弱い。' : '経営管理が場当たり的で、資金繰り表も作成していない。';
      let st = mq < -1 ? 'minor' : 'ok';
      if (app && app.hiddenPurpose && chance(0.6)) { t += '資金使途は運転資金とされているが、実態は赤字補填とみられる。'; st = 'minor'; app.purposeRevealed = true; }
      if (active && chance(0.4)) { t += HINT_TEXT.interview; st = 'minor'; }
      return { status: st, text: t, mq: Math.round(mq * 10) / 10 };
    }
    case 'site': {
      const q = co.q + randn() * 0.3;
      let t = q > 0.7 ? '工場・店舗はフル稼働。受注残も豊富で活気がある。' : q > -0.3 ? '稼働状況は概ね良好。設備の手入れも行き届いている。'
        : q > -1.2 ? '稼働率はやや低く、一部の設備が遊休化している。' : '稼働はまばらで、従業員にも覇気がない。業況は相当厳しい。';
      let st = q < -1.2 ? 'minor' : 'ok';
      if (co.decoy && co.decoy.type === 'inv') { t += `在庫の増加は${co.decoy.reason}。実在を確認した。`; }
      if (active && chance(0.35)) { t += HINT_TEXT.site; st = 'minor'; }
      return { status: st, text: t };
    }
    case 'tax': {
      let t = '申告書と決算書の数値は一致。納税証明書でも滞納はない。';
      let st = 'ok';
      if (co.q < -1.3 && chance(0.5)) { t = '申告書と決算書は一致するが、消費税の分納（滞納）がある。'; st = 'minor'; }
      if (active && chance(0.3)) { t += HINT_TEXT.tax; st = 'minor'; }
      return { status: st, text: t };
    }
    case 'ar': {
      const refuseP = active ? (f.type === 'fakeSales' ? 0.45 : 0.2) : 0.05;
      if (chance(refuseP)) return { status: 'minor', text: '先方が売掛先への確認に同意しなかった。「取引先に迷惑がかかる」との説明。' };
      if (co.decoy && co.decoy.type === 'ar') return { status: 'ok', text: `主要売掛先の残高はすべて一致。売掛金の増加は${co.decoy.reason}。` };
      return { status: 'ok', text: '主要売掛先5社に残高確認を実施。すべて一致した。' };
    }
    case 'bank': {
      let t = r.salesG > 0 ? '入出金は売上規模と整合的。不審な資金移動はない。' : '入出金は売上規模と整合的。売上減少に伴い残高は減少傾向。';
      let st = 'ok';
      if (active && chance(0.35)) { t += HINT_TEXT.bank; st = 'minor'; }
      return { status: st, text: t };
    }
    case 'appraisal': {
      if (!co.ownsRE) return { status: 'ok', text: '担保に供せる不動産がない。' };
      const v = reNow(co, co.reTrue) * uni(0.97, 1.03);
      co.reAppraised = v;
      const lien = co.reLien ? '他行の先順位抵当権（極度額 約' + fmtYen(v * 0.4) + '）が設定済み。' : '先順位の担保権はない。';
      return { status: 'ok', text: `鑑定評価額 ${fmtYen(v)}（簡易評価 ${fmtYen(co.reEst)}）。${lien}`, value: v };
    }
  }
  return { status: 'ok', text: '' };
}

function runMortInv(app, key) {
  const p = app.person, f = p.fraud;
  const det = { credit: { hiddenDebt: 0.95, income: 0.05, investment: 0.1 }, employ: { income: 0.35, investment: 0.05 }, taxcert: { income: 0.9, investment: 0.1 }, property: { investment: 0.6 } };
  if (f && !f.found && chance(det[key][f.type] || 0)) {
    f.found = true;
    G.stats.fraudFound++;
    const tx = {
      income: `申告年収${fmtYen(p.repIncome)}に対し、課税証明書上の所得は${fmtYen(p.income)}。源泉徴収票が改ざんされている。`,
      hiddenDebt: `申告外のカードローン・自動車ローンがあり、年間返済額は約${fmtYen(p.hiddenDebt)}。`,
      investment: '物件に賃貸募集の広告が出ている。自己居住用と偽った投資用物件の購入とみられる。',
    }[f.type];
    return { status: 'major', text: tx, found: true };
  }
  if (f && f.found) return { status: 'major', text: '申込内容の虚偽はすでに判明している。' };
  switch (key) {
    case 'credit': return p.otherDebt ? { status: 'ok', text: `自動車ローン等の返済が年${fmtYen(p.otherDebt)}（申告どおり）。延滞履歴なし。` } : { status: 'ok', text: '他社借入・延滞履歴ともになし。' };
    case 'employ': return { status: 'ok', text: `${p.employer}に在籍していることを確認（勤続${p.yearsEmp}年）。` };
    case 'taxcert': return { status: 'ok', text: '課税証明書の所得は源泉徴収票と一致。' };
    case 'property': {
      p.valueEst = p.valueTrue * uni(0.97, 1.03);
      return { status: p.amount > p.valueTrue ? 'minor' : 'ok', text: `担保評価額 ${fmtYen(p.valueEst)}（物件価格 ${fmtYen(p.price)}）。${p.amount > p.valueTrue ? '融資額が担保評価を上回る（オーバーローン）。' : '担保余力は十分。'}` };
    }
  }
}

/* ---------- 審査結果：承認・謝絶 ---------- */
function validateTerms(app, t) {
  if (!(t.amount > 0)) return '融資額を入力してください';
  if (t.amount > app.amountReq * 1.0001) return '申込額を超える融資はできません';
  if (t.termM < 3 || t.termM > 420) return '期間が不正です';
  if (app.kind === 'biz') {
    const co = G.companies[app.coId];
    if (exposureOf(co.id) + t.amount > largeExposureLimit()) return `大口信用供与規制：同一先への与信は自己資本の25%（${fmtYen(largeExposureLimit())}）までです`;
    if (t.guarantee === 'cgc' && (co.big || t.amount > 2.8e8 || latestRep(co).S > 300e8)) return '信用保証協会の保証は中小企業向け2億8,000万円までです';
    if (t.rateType === 'fixed' && !(t.rate > 0)) return '金利を入力してください';
  }
  if (G.flags.lendingBan > G.m) return '早期是正措置により新規融資が制限されています';
  if (!canFund(t.amount)) return '貸出に回せる資金が足りません（コール市場での調達枠も不足）';
  return null;
}

function decideApp(app, approve, t) {
  if (app.status !== 'pending') return { ok: false, msg: '処理済みの案件です' };
  if (!approve) {
    app.status = 'rejected'; app.decidedM = G.m;
    G.stats.rejected++;
    if (app.kind === 'biz') {
      const co = G.companies[app.coId];
      if (co.fraud && co.fraud.years > 0) G.stats.fraudAvoided++;
      // 謝絶の記録（粉飾企業は後日破綻のニュースが流れることがある）
      G.rejectedLog.push({ coId: co.id, m: G.m, fraud: !!(co.fraud && co.fraud.years > 0), gTrue: co.gTrue, name: co.name });
      if (G.rejectedLog.length > 80) G.rejectedLog.shift();
    }
    return { ok: true, accepted: false, rejected: true };
  }
  const err = validateTerms(app, t);
  if (err) return { ok: false, msg: err };
  app.terms = Object.assign({}, t);
  const p = acceptProb(app, t, 'true');
  app.decidedM = G.m;
  if (!chance(p)) {
    app.status = 'declined';
    G.stats.declined++;
    const why = app.kind === 'biz' ? '他行の条件を選びました' : '他行の住宅ローンに決めました';
    return { ok: true, accepted: false, msg: `先方は${why}（成約見込み${Math.round(acceptProb(app, t, 'est') * 100)}%）` };
  }
  app.status = 'approved';
  const L = bookLoan(app, t);
  return { ok: true, accepted: true, loan: L };
}

/* ---------- 融資の実行 ---------- */
function bookLoan(app, t) {
  const rate = appRate(app, t);
  const L = {
    id: 'L' + (++G.seq.loan), kind: app.kind, appId: app.id, district: app.district,
    principal: t.amount, bal: t.amount, rateType: t.rateType, rate, rate0: rate, termM: t.termM, startM: G.m, endM: G.m + t.termM,
    repay: t.repay, status: 'current', dpd: 0, arrears: 0, cls: 0, provision: 0, paidInt: 0,
    restructured: false, ioUntil: -1, stressUntil: -1, fraudKnown: false,
  };
  if (app.kind === 'biz') {
    const co = G.companies[app.coId];
    L.coId = co.id; L.name = co.name; L.ind = co.ind; L.purpose = app.purpose;
    L.spread = t.spread;
    L.grade = bankGrade(co);
    L.cgc = t.guarantee === 'cgc' ? 0.8 : 0;
    L.personal = t.guarantee === 'personal';
    if (t.collateral && co.ownsRE) {
      const land = areaLand(co.district);
      const bankVal = co.reAppraised || reNow(co, co.reEst);
      L.collateral = { bank0: bankVal * (co.reLien ? 0.6 : 1), true0: reNow(co, co.reTrue) * (co.reLien ? 0.6 : 1), land0: land };
    }
    L.fraudKnown = !!(co.fraud && co.fraud.found);
    co.pendingLoan += t.amount;
    if (app.purpose === 'capex') co.pendingCapex += t.amount / 0.85;
    if (co.fraud && co.fraud.years > 0) G.stats.fraudLent++;
    co.everBorrowed = true;
  } else {
    const p = app.person;
    L.person = p; L.name = p.name + ' 様（住宅ローン）'; L.ind = 'mort';
    L.disc = G.rates.mortDisc - (t.rateAdj || 0);
    if (t.rateType === 'fix10') { L.fixRate = rate; L.fixUntil = G.m + 120; }
    L.mortGuar = t.guarantee === 'company';
    L.grade = mortGrade(p, t.amount, rate, t.termM / 12);
    L.collateral = { bank0: p.valueEst, true0: p.valueTrue, land0: G.city.d[p.district].land };
    L.fraudKnown = !!(p.fraud && p.fraud.found);
    G.city.d[p.district].mortCur = (G.city.d[p.district].mortCur || 0) + t.amount;
    if (p.fraud) G.stats.fraudLent++;
  }
  ensureFunds(t.amount);
  post('融資の実行', [['loans', t.amount, 0], ['boj', 0, t.amount]]);
  receive(app.kind === 'biz' ? 55000 : 33000, 'fees', '融資事務手数料');
  L.cls = sysClass(L);
  G.loans.push(L);
  G.stats.loansMade++;
  G.stats.lentTotal += t.amount;
  return L;
}

function bookProjectLoan(P, st, amount) {
  const rate = projectRate(P);
  const L = {
    id: 'L' + (++G.seq.loan), kind: 'proj', projId: P.id, name: P.spc, ind: 'proj', district: P.d,
    principal: amount, bal: amount, rateType: 'fixed', rate, termM: P.months + 180, startM: G.m, endM: G.m + P.months + 180,
    repay: 'equal', status: 'current', dpd: 0, arrears: 0, cls: 0, provision: 0, paidInt: 0,
    restructured: false, ioUntil: G.m + P.months, stressUntil: -1, grade: st.grade, fraudKnown: false,
    collateral: { bank0: P.cost * 0.5, true0: P.cost * 0.45, land0: G.city.d[P.d].land },
  };
  ensureFunds(amount);
  post('融資の実行（プロジェクトファイナンス）', [['loans', amount, 0], ['boj', 0, amount]]);
  G.loans.push(L);
  G.stats.loansMade++;
  G.stats.lentTotal += amount;
  return L;
}

/* ---------- 期中の金利・返済 ---------- */
function currentRate(L) {
  if (L.kind === 'biz') return L.rateType === 'var' ? Math.max(0.1, G.rates.prime + L.spread) : L.rate;
  if (L.kind === 'mort') {
    if (L.fixUntil && G.m < L.fixUntil) return L.fixRate;
    return Math.max(0.1, G.rates.prime - L.disc);
  }
  if (L.kind === 'pool') return Math.max(0.1, G.rates.prime - 1.15);
  return L.rate;
}

function scheduledPrincipal(L) {
  if (L.ioUntil >= G.m) return 0;
  const remain = Math.max(1, L.endM - G.m + 1);
  if (L.repay === 'bullet') return G.m >= L.endM ? L.bal : 0;
  if (L.repay === 'annuity') {
    const pay = annuityPayment(L.bal, L.rate, remain);
    return Math.min(L.bal, Math.max(0, Math.round(pay - L.bal * L.rate / 1200)));
  }
  return Math.min(L.bal, Math.round(L.bal / remain));
}

/* 真のデフォルト確率（年率%） */
function loanPD(L) {
  const e = G.eco;
  let pd;
  if (L.kind === 'biz') {
    const co = G.companies[L.coId];
    pd = GRADE_PD[co.gTrue] * Math.exp(-0.6 * (co.q - co.qStmt)) * (e.defMult / 0.9)
      * Math.exp(-0.7 * indCond(co.ind)) * Math.exp(-(areaVit(co.district) - 100) / 60);
    if (isOvsArea(co.district)) pd *= COUNTRY_PD[OVSR[co.district].risk];
    if (!isCityArea(co.district) && G.net[co.district].pdUntil >= G.m) pd *= Math.sqrt(G.net[co.district].pdMul);
    if (L.purpose === 'mna') pd *= 1.3;
    if (co.fraud && !co.fraud.exposed && co.fraud.years > 0) pd *= 1.3;
    if (L.personal) pd *= 0.9;
    if (L.rateType === 'var') pd *= 1 + Math.max(0, L.rate - (L.rate0 || L.rate)) * 0.15;
  } else if (L.kind === 'mort') {
    const remainY = Math.max(1, (L.endM - G.m) / 12);
    pd = mortPD(L.person, L.bal, L.rate, remainY, true);
  } else if (L.kind === 'proj') {
    pd = GRADE_PD[L.grade] * (e.defMult / 0.9) * Math.exp(-(G.city.d[L.district].vit - 100) / 50) * (L.ioUntil >= G.m ? 1.2 : 1);
  } else pd = 0.2;
  if (L.ioUntil >= G.m && L.kind !== 'proj') pd *= 0.55;
  if (L.stressUntil >= G.m) pd *= 1.6;
  return clamp(pd, 0.01, 60);
}

function processLoans() {
  const e = G.eco;
  for (const L of G.loans) {
    if (!isActiveLoan(L)) continue;
    if (L.kind === 'pool') { processPool(L); continue; }
    if (L.kind === 'seg') continue; // 全国・海外のポートフォリオは networkMonthEnd で処理
    if (L.startM === G.m) continue; // 実行月は返済なし
    L.rate = currentRate(L);
    if (L.status === 'bankrupt') { processWorkout(L); continue; }
    const pdM = 1 - Math.pow(1 - Math.min(0.95, loanPD(L) / 100), 1 / 12);
    // 粉飾企業の突然の破綻
    if (L.kind === 'biz') {
      const co = G.companies[L.coId];
      if (co.fraud && !co.fraud.exposed && co.fraud.years > 0 && chance(0.005 * (1 + 0.15 * co.fraud.years) * e.defMult)) {
        exposeFraud(co);
        continue;
      }
    }
    if (L.status === 'current') {
      if (chance(pdM)) { L.status = 'late'; L.dpd = 1; L.lateSince = G.m; continue; }
      collectPayment(L);
    } else if (L.status === 'late') {
      L.arrears += Math.round(L.bal * L.rate / 1200);
      const gT = L.kind === 'biz' ? G.companies[L.coId].gTrue : 5;
      if (chance(gT <= 7 ? 0.3 : 0.12)) {
        receive(L.arrears, 'intLoans', '延滞利息の回収');
        L.arrears = 0; L.status = 'current'; L.dpd = 0;
      } else {
        L.dpd++;
        if (L.dpd >= 3) {
          L.status = 'default';
          addNews('loan', `融資先「${L.name}」の返済が3か月以上延滞（残高${fmtYen(L.bal)}）`, 'bad', { loanId: L.id });
        }
      }
    } else if (L.status === 'default') {
      L.dpd++;
      if (chance(0.04)) {
        L.status = 'current'; L.dpd = 0; L.arrears = 0; L.restructured = true; L.ioUntil = G.m + 12; L.endM += 12;
        addNews('loan', `延滞先「${L.name}」と返済条件の変更で合意。返済が再開された`, 'neutral', { loanId: L.id });
      } else if (chance(0.12) || L.dpd > 12) {
        goBankrupt(L, '法的整理（破産手続開始）');
      }
    }
  }
  // 期日一括返済の到来・期限前返済
  for (const L of G.loans) {
    if (L.status !== 'current' || L.kind === 'pool' || L.kind === 'seg' || L.startM === G.m) continue;
    if (L.bal <= 0) { L.status = 'closed'; L.closedM = G.m; continue; }
    prepaymentCheck(L);
  }
}

function collectPayment(L) {
  const interest = Math.round(L.bal * L.rate / 1200);
  if (L.repay === 'bullet' && G.m >= L.endM) {
    // 期日到来：返済できるか
    const ok = L.kind !== 'biz' || G.companies[L.coId].gTrue <= 7;
    receive(interest, 'intLoans', '貸出金利息の受入');
    L.paidInt += interest;
    if (ok) {
      post('貸出金の回収（期日一括返済）', [['boj', L.bal, 0], ['loans', 0, L.bal]]);
      L.bal = 0; L.status = 'closed'; L.closedM = G.m;
    } else {
      L.endM = G.m + 1;
      if (!G.inbox.some(x => x.type === 'refi' && x.loanId === L.id)) {
        G.inbox.push({ id: 'I' + (++G.seq.inbox), type: 'refi', loanId: L.id, m: G.m, exp: G.m + 1 });
      }
    }
    return;
  }
  const principal = scheduledPrincipal(L);
  receive(interest, 'intLoans', '貸出金利息の受入');
  L.paidInt += interest;
  if (principal > 0) {
    post('貸出金の回収（約定返済）', [['boj', principal, 0], ['loans', 0, principal]]);
    L.bal -= principal;
  }
  if (L.bal <= 0) { L.bal = 0; L.status = 'closed'; L.closedM = G.m; }
}

/* 金利が高すぎると優良先は他行へ借り換える（肩代わり） */
function prepaymentCheck(L) {
  if (L.kind === 'proj') return;
  let p = 0;
  if (L.kind === 'biz') {
    const co = G.companies[L.coId];
    if (co.gTrue <= 5) {
      const gap = L.rate - marketLoanRate(co.gRep, Math.max(12, L.endM - G.m));
      if (gap > 0.3) p = 0.02 * (gap - 0.3) / 0.5;
    }
    p += 0.002;
  } else {
    const mkt = L.fixUntil && G.m < L.fixUntil ? G.eco.mortFix : G.eco.mortVar;
    p = 0.0025 + Math.max(0, L.rate - mkt - 0.3) * 0.02;
  }
  if (chance(p)) {
    post('貸出金の回収（期限前返済）', [['boj', L.bal, 0], ['loans', 0, L.bal]]);
    if (L.kind === 'biz' && p > 0.01) addNews('loan', `取引先「${L.name}」が他行の低い金利で借り換え、${fmtYen(L.bal)}を繰上返済`, 'neutral', { loanId: L.id });
    L.bal = 0; L.status = 'closed'; L.closedM = G.m; L.prepaid = true;
    G.stats.prepaid++;
  }
}

/* ---------- 承継した住宅ローン債権（プール） ---------- */
function processPool(L) {
  L.rate = currentRate(L);
  const interest = Math.round(L.bal * L.rate / 1200);
  receive(interest, 'intLoans', '貸出金利息の受入');
  L.paidInt += interest;
  L.remainM = Math.max(1, L.remainM - 1);
  const pay = annuityPayment(L.bal, L.rate, L.remainM);
  let principal = Math.round(Math.max(0, pay - interest) + L.bal * 0.0025);
  const pdA = 0.18 * Math.exp((G.eco.unemp - 2.6) * 0.35);
  const def = Math.round(L.bal * (1 - Math.pow(1 - pdA / 100, 1 / 12)));
  principal = Math.min(principal, L.bal - def);
  if (principal > 0) { post('貸出金の回収（約定返済）', [['boj', principal, 0], ['loans', 0, principal]]); L.bal -= principal; }
  if (def > 0) {
    const rec = Math.round(def * 0.75);
    post('住宅ローンの担保処分による回収', [['boj', rec, 0], ['loans', 0, rec]]);
    L.bal -= rec;
    writeOffAmount(L, def - rec, '住宅ローン債権の償却');
  }
  if (L.bal <= 0) { L.bal = 0; L.status = 'closed'; L.closedM = G.m; }
}

/* ---------- 破綻・回収 ---------- */
function goBankrupt(L, how) {
  L.status = 'bankrupt';
  L.bkM = G.m;
  L.cls = 5;
  L.workout = { cgcM: G.m + 3, colM: G.m + randInt(6, 12), cgcDone: false };
  G.stats.defaults++;
  G.stats.defaultAmt += L.bal;
  if (L.kind === 'biz') {
    const co = G.companies[L.coId];
    if (isCityArea(co.district)) G.city.d[co.district].failPen += Math.min(6, 1 + co.emp / 60);
    addNews('loan', `融資先「${L.name}」が${how}。従業員${co.emp}人。当行の債権残高${fmtYen(L.bal)}`, 'bad', { loanId: L.id });
  } else if (L.kind === 'proj') {
    projectLoanFailed(L);
  } else {
    addNews('loan', `住宅ローン債務者（${L.name}）が返済不能に。担保物件の競売手続きへ`, 'bad', { loanId: L.id });
  }
}

/* 粉飾の発覚による突然の破綻 */
function exposeFraud(co) {
  co.fraud.exposed = true;
  co.fraud.exposedM = G.m;
  const loans = G.loans.filter(L => L.coId === co.id && isActiveLoan(L) && L.status !== 'bankrupt');
  const tot = sum(loans, L => L.bal);
  addNews('loan', `「${co.name}」で${FRAUD_TYPES[co.fraud.type].name}による粉飾決算が発覚。民事再生法の適用を申請${tot > 0 ? `。当行の債権${fmtYen(tot)}` : ''}`, 'bad', { coId: co.id, fraud: true });
  for (const L of loans) {
    goBankrupt(L, '粉飾発覚により民事再生法の適用を申請');
    G.stats.fraudLossAmt += L.bal;
  }
  if (!loans.length && isCityArea(co.district)) G.city.d[co.district].failPen += 2;
}

function collateralBank(L) {
  if (!L.collateral) return 0;
  return L.collateral.bank0 * areaLand(L.district) / L.collateral.land0;
}
function collateralTrue(L) {
  if (!L.collateral) return 0;
  return L.collateral.true0 * areaLand(L.district) / L.collateral.land0;
}

function processWorkout(L) {
  const w = L.workout;
  if (!w.cgcDone && G.m >= w.cgcM) {
    w.cgcDone = true;
    let pay = 0;
    if (L.cgc) pay = Math.round(L.bal * L.cgc);
    if (L.kind === 'mort' && L.mortGuar) {
      const voided = L.person.fraud && (L.person.fraud.found || chance(0.7));
      if (voided) { L.guarVoid = true; addNews('loan', `${L.name}：申込内容に虚偽があり、保証会社が代位弁済を拒否（保証免責）`, 'bad'); }
      else pay = L.bal;
    }
    if (pay > 0) {
      post(L.kind === 'mort' ? '保証会社による代位弁済' : '信用保証協会による代位弁済', [['boj', pay, 0], ['loans', 0, pay]]);
      L.bal -= pay; L.recovered = (L.recovered || 0) + pay;
    }
  }
  if (L.bal <= 0) { finishWorkout(L); return; }
  if (G.m >= w.colM) {
    let rec = 0;
    if (L.collateral) rec = Math.min(L.bal, Math.round(collateralTrue(L) * uni(0.6, 0.85)));
    if (rec > 0) {
      post('担保不動産の処分による回収', [['boj', rec, 0], ['loans', 0, rec]]);
      L.bal -= rec; L.recovered = (L.recovered || 0) + rec;
    }
    if (L.personal && L.bal > 0) {
      const g = Math.round(L.bal * uni(0.0, 0.06));
      if (g > 0) { post('保証人からの回収', [['boj', g, 0], ['loans', 0, g]]); L.bal -= g; L.recovered += g; }
    }
    if (L.bal > 0) {
      G.stats.writeoffAmt += L.bal;
      writeOffAmount(L, L.bal, '貸出金の償却（最終処理）');
    }
    finishWorkout(L);
  }
}
function finishWorkout(L) {
  L.status = 'writtenoff'; L.closedM = G.m; L.bal = 0; L.provision = 0;
}

/* 償却：個別の引当金を取り崩し、不足分は貸出金償却 */
function writeOffAmount(L, amt, desc) {
  amt = Math.round(Math.min(amt, L.bal));
  if (amt <= 0) return;
  const use = Math.min(L.provision || 0, amt, B('allowance'));
  post(desc, [['allowance', use, 0], ['writeoff', amt - use, 0], ['loans', 0, amt]]);
  L.provision = (L.provision || 0) - use;
  L.bal -= amt;
}

/* サービサー（債権回収会社）への売却 */
function servicerPrice(L) {
  const col = collateralTrue(L) * 0.55;
  const cov = L.bal * (L.cgc || 0) * 0.9;
  return Math.round(Math.min(L.bal, (col + cov) * 0.8 + L.bal * 0.03));
}
function sellToServicer(L) {
  if (!isActiveLoan(L) || L.kind === 'pool') return { ok: false, msg: '売却できません' };
  if (L.status === 'current' && L.cls < 3) return { ok: false, msg: '正常債権は売却対象外です（破綻懸念先以下が対象）' };
  const price = servicerPrice(L);
  const loss = L.bal - price;
  post('不良債権のサービサーへの売却（入金）', [['boj', price, 0], ['loans', 0, price]]);
  L.bal -= price;
  if (loss > 0) writeOffAmount(L, loss, '不良債権売却損');
  L.status = 'sold'; L.closedM = G.m; L.bal = 0; L.provision = 0; L.soldPrice = price;
  G.stats.nplSold++;
  return { ok: true, price, loss };
}

/* 期限の利益の喪失（粉飾判明先などへの回収着手） */
function callLoan(L) {
  if (!isActiveLoan(L) || L.status === 'bankrupt') return { ok: false, msg: 'すでに回収手続き中です' };
  goBankrupt(L, '期限の利益を喪失し、当行が回収に着手');
  L.workout.colM = G.m + 3;
  if (L.kind === 'biz') {
    const co = G.companies[L.coId];
    for (const o of G.loans) if (o !== L && o.coId === co.id && isActiveLoan(o) && o.status !== 'bankrupt') { goBankrupt(o, '期限の利益を喪失'); o.workout.colM = G.m + 3; }
  }
  return { ok: true };
}

/* ---------- 債務者区分（自己査定） ---------- */
/* システムの判定（銀行が観測できる情報のみ） */
function sysClass(L) {
  if (L.status === 'bankrupt') return 5;
  if (L.kind === 'pool' || L.kind === 'seg') return 0;
  if (L.status === 'default') return L.dpd >= 6 ? 4 : 3;
  let c = 0;
  if (L.kind === 'biz') {
    const co = G.companies[L.coId];
    const g = bankGrade(co);
    const s = co.fraud && co.fraud.found ? latestTrue(co) : latestRep(co);
    if (g >= 8 || s.EQ < 0) c = 1;
    if (g >= 10 && s.EQ < 0) c = 3;
    if (co.fraud && co.fraud.found) c = Math.max(c, s.EQ < 0 ? 3 : 1);
  } else if (L.kind === 'proj') {
    c = L.grade >= 8 ? 1 : 0;
  } else if (L.kind === 'mort' && L.person.fraud && L.person.fraud.found) c = 1;
  if (L.status === 'late') c = Math.max(c, 1);
  if (L.restructured && L.status === 'current') c = Math.max(c, 2);
  return c;
}
/* 金融庁の見立て（実態ベース） */
function fsaClass(L, knowsFraud) {
  if (L.status === 'bankrupt') return 5;
  if (L.kind === 'pool' || L.kind === 'seg') return 0;
  if (L.status === 'default') return L.dpd >= 6 ? 4 : 3;
  let c = 0;
  if (L.kind === 'biz') {
    const co = G.companies[L.coId];
    const useTrue = knowsFraud || !co.fraud;
    const g = useTrue ? co.gTrue : co.gRep;
    const s = useTrue ? latestTrue(co) : latestRep(co);
    if (g >= 8 || s.EQ < 0) c = 1;
    if (g >= 10 || (s.EQ < -s.TA * 0.1 && s.ORD < 0)) c = 3;
  } else if (L.kind === 'proj') {
    c = L.grade >= 8 ? 1 : 0;
  } else if (L.kind === 'mort' && L.person.fraud && knowsFraud) c = 1;
  if (L.status === 'late') c = Math.max(c, 1);
  if (L.restructured && L.status === 'current') c = Math.max(c, 2);
  return c;
}

/* 必要な引当額 */
function provisionFor(L, cls) {
  if (!isActiveLoan(L) || L.bal <= 0) return 0;
  if (L.kind === 'pool') return Math.round(L.bal * 0.0025);
  if (L.kind === 'seg') return Math.round(L.bal * (L.pd ?? SEG[L.seg].pd) / 100 * segLGD(L) * 1.2);
  const bal = L.bal;
  const cover = L.kind === 'mort' ? (L.mortGuar && !L.guarVoid ? 0.9 : 0) : (L.cgc || 0);
  if (cls <= 2) return Math.round(bal * (1 - cover) * CLS[cls].rate);
  const col = collateralBank(L) * 0.7;
  const prot = Math.min(bal, col + bal * cover);
  return Math.round((bal - prot) * CLS[cls].rate);
}

function trueUpProvisions(desc) {
  let total = 0;
  for (const L of G.loans) {
    if (!isActiveLoan(L)) { L.provision = 0; continue; }
    if (L.status === 'bankrupt') L.cls = 5;
    L.provision = provisionFor(L, L.cls);
    total += L.provision;
  }
  const d = total - B('allowance');
  if (d > 0) post(desc || '貸倒引当金の繰入', [['provExp', d, 0], ['allowance', 0, d]]);
  else if (d < 0) post(desc || '貸倒引当金の戻入', [['allowance', -d, 0], ['provRev', 0, -d]]);
  return d;
}

/* ---------- 融資先の月次イベント（リスケ要請・決算書受領） ---------- */
function borrowerMonthly() {
  const done = new Set();
  for (const L of G.loans) {
    if (L.kind !== 'biz' || !isActiveLoan(L)) continue;
    const co = G.companies[L.coId];
    if (!co || done.has(co.id)) continue;
    done.add(co.id);
    // 業況の推移
    co.q = clamp(co.q + co.drift / 12 + randn() * 0.045 + 0.02 * indCond(co.ind) / 3, -3.5, 3);
    // 決算書の受領（決算月の2か月後）
    if (calMonth(G.m) === ((co.fyEnd + 1) % 12) + 1 && co.years[co.years.length - 1].endM < G.m - 6) {
      const g0 = bankGrade(co);
      advanceCompanyYear(co);
      // 変化のあった先・大口先だけを頭取の検証に回す（他は担当者が確認済み）
      const loansOf = G.loans.filter(x => x.coId === co.id && isActiveLoan(x));
      const worse = loansOf.some(x => sysClass(x) > x.cls);
      const big = sum(loansOf, x => x.bal) >= largeExposureLimit() * 0.4;
      const flags = G.sys.credit >= 2 && fraudFlags(co).length > 0;
      if ((bankGrade(co) - g0 >= 2 || worse || big || flags) && !G.inbox.some(x => x.type === 'review' && x.coId === co.id)) {
        G.inbox.push({ id: 'I' + (++G.seq.inbox), type: 'review', coId: co.id, m: G.m, why: worse ? '区分の見直しが必要' : bankGrade(co) - g0 >= 2 ? `格付が${g0}→${bankGrade(co)}に低下` : flags ? '粉飾の兆候あり' : '大口先' });
      }
    }
    // 返済猶予の申し出
    if (L.status === 'current' && !L.restructured && co.gTrue >= 8 && chance(0.03)
      && !G.inbox.some(x => x.type === 'resched' && x.coId === co.id)) {
      G.inbox.push({ id: 'I' + (++G.seq.inbox), type: 'resched', coId: co.id, loanId: L.id, m: G.m, exp: G.m });
    }
  }
}

/* ---------- 審査基準による一括処理・決裁権限の委譲 ---------- */
/* 標準条件：市場の目安金利、不動産があれば担保、格付6以下の中小企業は信用保証協会付き */
function standardTerms(app) {
  const t = defaultTerms(app);
  if (app.kind === 'biz') {
    const g = appSysGrade(app);
    const co = G.companies[app.coId];
    t.collateral = !!co.ownsRE;
    if (!co.big && g >= 6 && t.amount <= 2.8e8 && latestRep(co).S <= 300e8) t.guarantee = 'cgc';
    const lim = largeExposureLimit() - exposureOf(co.id);
    if (t.amount > lim) t.amount = Math.max(0, Math.floor(lim / 1e6) * 1e6);
  }
  return t;
}
/* c = { ok: 承認する格付の上限, ng: 謝絶する格付の下限, deficit: 赤字補填は謝絶 } → 'ok' | 'ng' | 'hold' */
function judgeByCriteria(a, c) {
  if (a.kind === 'biz') {
    const co = G.companies[a.coId];
    if (co.fraud && co.fraud.found) return 'ng';
    if (c.deficit && (a.purpose === 'deficit' || a.purposeRevealed)) return 'ng';
  } else if (a.person.fraud && a.person.fraud.found) return 'ng';
  const g = appSysGrade(a);
  if (g <= c.ok) return 'ok';
  if (g >= c.ng) return 'ng';
  return 'hold';
}
function decideByCriteria(a, c) {
  const j = judgeByCriteria(a, c);
  if (j === 'ng') { decideApp(a, false); return { j: 'ng' }; }
  if (j !== 'ok') return { j: 'hold' };
  const t = standardTerms(a);
  if (t.amount < 1e6 || validateTerms(a, t)) return { j: 'skip' };
  const r = decideApp(a, true, t);
  return { j: r.ok && r.accepted ? 'acc' : r.ok ? 'dec' : 'skip', amt: t.amount };
}
/* 支店長への決裁権限の委譲：期限を迎える汐見市の小口案件を、審査基準で自動的に処理する */
function autoDelegate() {
  const d = G.policy && G.policy.delegate;
  if (!d || !d.on) return null;
  const res = { acc: 0, ng: 0, amt: 0 };
  for (const a of G.apps.filter(x => x.status === 'pending' && x.exp <= G.m)) {
    if (a.kind === 'biz' && G.companies[a.coId] && G.companies[a.coId].big) continue;
    if (a.amountReq > d.max) continue;
    const r = decideByCriteria(a, d);
    if (r.j === 'acc') { res.acc++; res.amt += r.amt; } else if (r.j === 'ng') res.ng++;
  }
  G.lastDelegate = res;
  return res;
}

/* 受信箱の期限切れ処理 */
function expireInbox() {
  for (const it of G.inbox.slice()) {
    if (it.exp === undefined || it.exp >= G.m) continue;
    if (it.type === 'resched') resolveResched(it, false, true);
    else if (it.type === 'refi') resolveRefi(it, true, true);
    else G.inbox = G.inbox.filter(x => x !== it);
  }
  // 完済などで取引がなくなった先の検証依頼は取り下げる
  G.inbox = G.inbox.filter(x => x.type !== 'review' || G.loans.some(L => L.coId === x.coId && isActiveLoan(L)));
}

function resolveResched(it, accept, auto) {
  const L = G.loans.find(x => x.id === it.loanId);
  G.inbox = G.inbox.filter(x => x !== it);
  if (!L || !isActiveLoan(L)) return;
  if (accept) {
    L.restructured = true; L.ioUntil = G.m + 12; L.endM += 12;
    L.cls = Math.max(L.cls, 2);
    addNews('bank', `「${L.name}」の返済猶予（元金据置1年）に応じた`, 'neutral', { loanId: L.id });
  } else {
    L.stressUntil = G.m + 6;
    if (!auto) addNews('bank', `「${L.name}」の返済猶予の申し出を断った`, 'neutral', { loanId: L.id });
    else addNews('bank', `「${L.name}」の返済猶予の申し出に回答せず、期限切れとなった`, 'bad', { loanId: L.id });
  }
}
function resolveRefi(it, roll, auto) {
  const L = G.loans.find(x => x.id === it.loanId);
  G.inbox = G.inbox.filter(x => x !== it);
  if (!L || !isActiveLoan(L)) return;
  if (roll) {
    L.endM = G.m + 12;
    L.restructured = true;
    L.cls = Math.max(L.cls, 2);
    if (auto) addNews('bank', `「${L.name}」の期日到来分を1年間延長（折り返し）した`, 'neutral', { loanId: L.id });
  } else {
    L.status = 'late'; L.dpd = 1;
    addNews('bank', `「${L.name}」に期日での一括返済を求めたが、資金がなく延滞に`, 'bad', { loanId: L.id });
  }
}
