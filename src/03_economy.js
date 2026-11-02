'use strict';
/* =========================================================
 *  03_economy.js : マクロ経済・金利・業界動向・ニュース
 * ========================================================= */

function newEconomy() {
  return {
    regime: 'expansion', age: 8,
    gdp: 1.1, cpi: 2.3, unemp: 2.5,
    policy: 0.50, y: { 2: 0.95, 5: 1.22, 10: 1.62, 20: 2.42 }, termShock: 0,
    call: 0.48, land: 100, stock: 100, defMult: 0.9, demand: 1.05,
    ind: Object.fromEntries(INDUSTRIES.map(i => [i.id, { cond: 0, shock: 0 }])),
    mktOrd: 0.175, mktTime: 0.315, mktPrime: 1.875, compBoost: 0, compBoostUntil: -1,
    mortVar: 0.85, mortFix: 2.27,
  };
}

function addNews(cat, text, tone = 'neutral', extra) {
  G.news.unshift(Object.assign({ m: G.m, cat, text, tone }, extra || {}));
  if (G.news.length > 400) G.news.length = 400;
}

const indCond = id => clamp(G.eco.ind[id].cond + G.eco.ind[id].shock, -1.2, 1.2);

/* 期間（年）に応じた国債利回り（補間） */
function yieldAt(n) {
  const e = G.eco;
  const pts = [[0, e.call], [2, e.y[2]], [5, e.y[5]], [10, e.y[10]], [20, e.y[20]], [40, e.y[20] + 0.3]];
  return interp(Math.max(0, n), pts);
}

/* 市場の貸出金利（格付・期間別、% ） */
function marketLoanRate(grade, termM) {
  const e = G.eco;
  const base = e.policy + 0.35 + GRADE_SPREAD[clamp(Math.round(grade), 1, 10)];
  const termPrem = clamp((termM / 12 - 3) * 0.04, -0.05, 0.4) + Math.max(0, yieldAt(termM / 24) - e.policy) * 0.3;
  return Math.max(0.3, base + termPrem);
}

/* 開始時の景気と金利（カスタムスタート） */
const RATE_START = { low: 0.1, std: 0.5, high: 1.5 };
function initEconomy(econ, rateKey) {
  const e = G.eco;
  const regime = econ === 'precrisis' ? 'boom' : (REGIMES[econ] ? econ : 'expansion');
  const R = REGIMES[regime];
  e.regime = regime; e.age = 6;
  e.gdp = R.gdp; e.cpi = R.cpi; e.unemp = R.unemp; e.defMult = R.def; e.demand = R.demand;
  if (econ === 'precrisis') { e.land = 135; e.stock = 140; }
  else if (econ === 'recession') { e.land = 92; e.stock = 80; }
  e.policy = RATE_START[rateKey] ?? 0.5;
  const ex = 0.45 * (e.cpi - 2.0) + 0.25 * (e.gdp - 1.0);
  e.y = { 2: e.policy + 0.12 + 0.3 * ex, 5: e.policy + 0.42 + 0.45 * ex, 10: e.policy + 1.05 + 0.45 * ex, 20: e.policy + 1.85 + 0.35 * ex };
  for (const k of [2, 5, 10, 20]) e.y[k] = Math.max(k <= 5 ? -0.1 : 0.05, +e.y[k].toFixed(3));
  e.call = Math.max(0, e.policy - 0.02);
  e.mktOrd = Math.max(0.001, 0.35 * e.policy);
  e.mktTime = Math.max(0.002, 0.55 * e.policy + 0.04);
  e.mktPrime = e.policy + 1.375;
  e.mortVar = Math.max(0.3, e.policy + 0.35);
  e.mortFix = e.y[10] + 0.65;
}

const REGIME_NEWS = {
  boom: '内閣府、景気判断を「拡大」に上方修正。企業の設備投資が活発に',
  expansion: '景気は緩やかに回復。月例経済報告で「持ち直し」との判断',
  slowdown: '景気に減速感。月例経済報告で判断を下方修正',
  recession: '景気後退局面入りか。鉱工業生産が3か月連続で低下',
  crisis: '金融市場が混乱。海外大手金融機関の破綻を受け、株価が急落',
};

function ecoStep() {
  const e = G.eco, cfg = G.cfg || DIFFICULTY[G.difficulty];
  // 景気局面の遷移
  const tr = REGIME_TRANS[e.regime];
  const items = tr.map(t => t[0]);
  const bubble = (cfg.bubbleUntil ?? -1) > G.m;
  const w = tr.map(t => {
    if (t[0] === 'crisis' && e.regime !== 'crisis') return G.m < (bubble ? 6 : 18) ? 0 : t[1] * cfg.crisis * (bubble ? 5 : 1);
    return t[1];
  });
  const next = wpick(items, w);
  if (next !== e.regime) {
    e.regime = next; e.age = 0;
    addNews('eco', REGIME_NEWS[next], next === 'boom' || next === 'expansion' ? 'good' : 'bad');
  } else e.age++;
  const R = REGIMES[e.regime];
  e.gdp += (R.gdp - e.gdp) * 0.18 + randn() * 0.12;
  e.cpi += (R.cpi - e.cpi) * 0.10 + randn() * 0.07;
  e.unemp = clamp(e.unemp + (R.unemp - e.unemp) * 0.10 + randn() * 0.03, 1.8, 7);
  e.defMult += (R.def - e.defMult) * 0.2;
  e.demand += (R.demand - e.demand) * 0.2;
  e.land *= 1 + (R.land / 100) / 12 + randn() * 0.003;
  e.stock *= Math.exp((R.stock / 100) / 12 + randn() * 0.045);
  // 日銀金融政策決定会合（年8回）
  if ([1, 3, 4, 6, 7, 9, 10, 12].includes(calMonth(G.m))) bojMeeting();
  // イールドカーブ
  e.termShock = e.termShock * 0.9 + randn() * 0.05;
  const ex = 0.45 * (e.cpi - 2.0) + 0.25 * (e.gdp - 1.0);
  const tgt = {
    2: e.policy + 0.12 + 0.3 * ex + 0.3 * e.termShock,
    5: e.policy + 0.42 + 0.45 * ex + 0.7 * e.termShock,
    10: e.policy + 1.05 + 0.45 * ex + e.termShock,
    20: e.policy + 1.85 + 0.35 * ex + 1.15 * e.termShock,
  };
  for (const k of [2, 5, 10, 20]) e.y[k] = Math.max(k <= 5 ? -0.1 : 0.05, e.y[k] + (tgt[k] - e.y[k]) * 0.45);
  e.call = Math.max(0, e.policy - 0.02 + (e.regime === 'crisis' ? 0.25 + rand() * 0.3 : randn() * 0.01));
  // 業界の景況
  for (const ind of INDUSTRIES) {
    const s = e.ind[ind.id];
    const target = clamp(ind.beta * (e.gdp - 1.0) / 4, -0.8, 0.6);
    s.shock *= 0.93;
    s.cond = clamp(s.cond + (target - s.cond) * 0.08 + randn() * 0.03, -1, 1);
  }
  if (chance(0.32)) industryNews();
  // 競合の金利動向
  if (e.compBoostUntil < G.m) e.compBoost *= 0.75;
  if (chance(0.015) && G.m > 3) {
    e.compBoost = 0.08 + rand() * 0.1; e.compBoostUntil = G.m + 6;
    addNews('eco', `ネット銀行各行が定期預金の金利上乗せキャンペーンを開始（+${e.compBoost.toFixed(2)}%）`, 'neutral');
  }
  e.mktOrd = Math.max(0.001, 0.35 * e.policy + e.compBoost * 0.2);
  e.mktTime = Math.max(0.002, 0.55 * e.policy + 0.04 + e.compBoost);
  e.mktPrime = e.policy + 1.375;
  e.mortVar = Math.max(0.3, e.policy + 0.35);
  e.mortFix = e.y[10] + 0.65;
}

function bojMeeting() {
  const e = G.eco;
  let target = 1.0 + 1.3 * (e.cpi - 2.0) + 0.5 * (e.gdp - 1.0);
  if (e.regime === 'crisis') target = Math.min(target, 0);
  target = clamp(target, 0, 4);
  const d = target - e.policy;
  if (d > 0.3 && chance(0.5)) {
    e.policy = Math.round((e.policy + 0.25) * 100) / 100;
    addNews('eco', `日銀、政策金利を0.25%引き上げ ${e.policy.toFixed(2)}%に。物価目標の実現に自信`, 'neutral', { rate: 1 });
  } else if (d < -0.35 && e.policy > 0 && chance(0.6)) {
    const cut = e.regime === 'crisis' ? Math.min(0.5, e.policy) : Math.min(0.25, e.policy);
    e.policy = Math.round((e.policy - cut) * 100) / 100;
    addNews('eco', `日銀、政策金利を${cut.toFixed(2)}%引き下げ ${e.policy.toFixed(2)}%に。景気下支えを優先`, 'neutral', { rate: -1 });
  }
}

const IND_NEWS = {
  mfg: [['円安の進行で輸出関連の製造業に追い風', 0.25], ['原材料価格の高騰で製造業の採算が悪化', -0.25], ['半導体需要の拡大で部品メーカーの受注が好調', 0.3], ['海外景気の減速で工作機械の受注が減少', -0.3]],
  con: [['公共工事の前倒し発注で建設業の受注が増加', 0.25], ['資材高と人手不足で中小建設業の利益が圧迫される', -0.3], ['残業規制の影響で工期の遅れが常態化', -0.15]],
  whl: [['取引の回復で卸売業の売上が持ち直す', 0.2], ['取引先の直販化で中堅卸の売上が減少', -0.2]],
  ret: [['物価高で消費者の節約志向が強まる', -0.25], ['賃上げを背景に個人消費が持ち直し', 0.25], ['大手ECの当日配送拡大で地域の小売店が苦戦', -0.2]],
  food: [['インバウンド客の増加で飲食店の客数が回復', 0.3], ['食材と光熱費の高騰で飲食店の倒産が増加', -0.35], ['人手不足で営業時間を短縮する飲食店が相次ぐ', -0.2]],
  trn: [['運賃の値上げが浸透し運送業の収益が改善', 0.2], ['燃料価格の高騰で運送会社の採算が悪化', -0.3]],
  re: [['不動産取引が活発化、地価の先高観が強まる', 0.25], ['金利上昇で投資用不動産の取引が細る', -0.3], ['オフィスの空室率が上昇', -0.2]],
  it: [['DX投資の拡大でソフトウェア開発の受注が好調', 0.3], ['生成AIの普及で受託開発の単価が下落', -0.2]],
  med: [['介護報酬がプラス改定に', 0.2], ['介護人材の不足で事業所の閉鎖が相次ぐ', -0.25]],
  htl: [['インバウンド需要が過去最高を更新、宿泊業が好調', 0.35], ['大型台風の影響で観光客が激減', -0.35], ['旅行支援策の終了で宿泊需要が反動減', -0.2]],
  agr: [['天候不順で野菜の出荷量が減少', -0.25], ['農産物の輸出が過去最高に。6次産業化も追い風', 0.25], ['飼料価格の高騰で畜産農家の経営が圧迫される', -0.3]],
};
function industryNews() {
  const ind = pick(INDUSTRIES);
  const [text, shock] = pick(IND_NEWS[ind.id]);
  G.eco.ind[ind.id].shock = clamp(G.eco.ind[ind.id].shock + shock, -0.8, 0.8);
  addNews('ind', `【${ind.name}】${text}`, shock > 0 ? 'good' : 'bad', { ind: ind.id });
}
