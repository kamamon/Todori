'use strict';
/* =========================================================
 *  27_kaisha_law.js : 会社経営モードの法令対応（エンジン・画面に依存しない）
 *   36協定・健康診断・安全衛生の体制・最低賃金・労働保険・機械や足場の安全・消防設備の点検・防火管理・
 *   避難訓練・HACCP・アルコールチェック・建設業許可・情報セキュリティ。
 *   労働災害・火災・食中毒・情報漏えい、役所の立入検査と是正、送検・公表、労災かくしの発覚。
 * ========================================================= */

/* 事業の型ごとの労災の起きやすさ（1人・1か月あたり）と、休業4日以上のうち死亡になる割合・火災の起きやすさ（建物ごと） */
const KS_ACC_BASE = { shop: 0.0028, rest: 0.0036, mfg: 0.0036, build: 0.0058, trade: 0.0034, pro: 0.0008, subs: 0.0009, cap: 0.0024, trans: 0.0044 };
const KS_ACC_DEATH = { shop: 0.004, rest: 0.004, mfg: 0.025, build: 0.045, trade: 0.03, pro: 0.003, subs: 0.003, cap: 0.01, trans: 0.05 };
const KS_FIRE_BASE = { shop: 0.0012, rest: 0.003, mfg: 0.0016, build: 0.0005, trade: 0.0011, pro: 0.0004, subs: 0.0006, cap: 0.0012, trans: 0.0008 };
/* 安全衛生への取り組み：費用（1人・月）と事故の起きやすさ */
const KS_SAFETY = [
  { n: '最低限', cost: 0, mul: 1.45, desc: '法律で決まったこと以外はしない。' },
  { n: '標準', cost: 2500, mul: 1.0, desc: '保護具の支給、危険予知の朝礼、月1回の職場の巡回。' },
  { n: '手厚い', cost: 7000, mul: 0.65, desc: '外部の専門家による点検、設備の改善、毎月の安全教育。' },
];
/* パート・アルバイトの職種（事業の型ごと）と、1か月の労働時間の目安。実際の時間は事業ごとに就任時に決める（u.partH） */
const KS_PART_HOURS = { shop: { part: 88 }, rest: { part: 70 } };
const KS_MINWAGE_START = 1080; // 2026年10月改定の汐見県の最低賃金（時給・架空）

/* ---------- 事業ごとの法令 ---------- */
/* 事業 u に関わる法令のキー（カタログの laws と、事業の型から決まるもの） */
function ksUnitLaws(u) {
  const S = ksS(u);
  const ks = new Set(S.laws || []);
  if (S.eng === 'mfg') ks.add('machine');
  if (S.eng === 'trade' && S.p.trucks) ks.add('machine'); // フォークリフト
  return ks;
}
function ksUnitsWithLaw(k) { return ksActiveUnits().filter(u => ksUnitLaws(u).has(k)); }
function ksLawKeys() { const ks = new Set(); for (const u of ksActiveUnits()) for (const k of ksUnitLaws(u)) ks.add(k); return ks; }
/* 会社の建物（店・工場・倉庫・事務所・施設）。spec＝特定防火対象物（店舗・飲食店・ホテル・病院など） */
function ksUnitBldgName(S) {
  if (S.eng === 'mfg') return S.bm === 'agr' ? '作業場・倉庫' : '工場';
  if (S.eng === 'build') return '事務所・資材置場';
  if (S.eng === 'trade') return S.p.wh === 'なし' ? '事務所' : '倉庫';
  if (S.eng === 'pro') return '事務所';
  if (S.eng === 'subs') return 'オフィス・設備';
  if (S.eng === 'cap') return '施設';
  if (S.eng === 'trans') return { rail: '駅・車両基地', air: '格納庫・事務所', sea: '事務所・倉庫' }[S.p.mode] || '営業所・車庫';
  return '事業所';
}
function ksBuildings() {
  const out = [];
  for (const u of ksActiveUnits()) {
    const S = ksS(u), E = KS_ENGINE[S.eng], un = ksUName(u);
    if (S.eng === 'shop') for (const s of E.storesOpen(u)) out.push({ n: `${un}・${s.n}`, spec: true, key: s, u: u.id });
    else if (S.eng === 'rest') for (const s of E.shopsOpen(u)) out.push({ n: `${un}・${s.n}`, spec: true, key: s, u: u.id });
    else out.push({ n: `${un}の${ksUnitBldgName(S)}`, spec: ['htl', 'med'].includes(S.bm), u: u.id });
  }
  return out;
}
function ksUnitBuildings(u) { return ksBuildings().filter(b => b.u === u.id); }
/* 防火管理者が必要か（収容人員：特定防火対象物は30人以上、それ以外は50人以上） */
function ksNeedsFireMgr() { return ksBuildings().some(b => b.spec) || ksHeadcount() >= 50; }

/* ---------- 法令のやること ---------- */
/* freq: year（毎年）・half（半年ごと）・once（一度）・five（5年ごと）・span（t.span か月ごと）・fy（年度ごと：dueMo までに） */
const KS_LAW_TASKS = [
  { id: 'r36', item: 'r36', freq: 'fy', dueMo: 4, n: '36協定の締結・届出', acct: 'fees', cost: () => 5e4 * Math.max(1, Math.sqrt(ksActiveUnits().length)), why: '残業・休日出勤をさせるには、毎年、労働者の代表と協定を結んで労基署に届け出る（事業場ごと）。' },
  { id: 'hoken', item: 'hoken', freq: 'fy', dueMo: 7, fromMo: 6, n: '労働保険の年度更新（6月1日〜7月10日）', acct: 'fees', cost: () => 3e4 * Math.max(1, Math.sqrt(ksActiveUnits().length)), why: '労災保険・雇用保険の保険料を申告・納付する（保険料は法定福利費として毎月計上済み。ここでは社会保険労務士への報酬）。' },
  { id: 'kenshin', item: 'kenshin', freq: 'year', n: '定期健康診断', acct: 'fukuri', cost: () => ksHeadcount() * 1.2e4 * ksPrice(), why: '年1回、全員に健康診断を受けさせる（福利厚生費）。' },
  { id: 'taisei', item: 'taisei', freq: 'once', n: () => (ksHeadcount() >= 50 ? '衛生管理者・産業医の選任と衛生委員会' : '安全衛生推進者の選任'), acct: 'recruit', cost: () => (ksHeadcount() >= 50 ? 15e4 : 3e4), applies: () => ksHeadcount() >= 10, why: '10〜49人は安全衛生推進者、50人以上は衛生管理者・産業医（毎月の報酬）と衛生委員会が必要。' },
  { id: 'machine', item: 'machine', freq: 'year', n: () => (ksUnitsWithLaw('machine').some(u => ksS(u).eng === 'mfg') ? '機械の安全装置の点検と特定自主検査' : 'フォークリフトの特定自主検査'), acct: 'repairs', cost: () => sum(ksUnitsWithLaw('machine'), u => (ksS(u).eng === 'mfg' ? Math.max(1, KS_ENGINE.mfg.machines(u).length) * 6e4 : 2 * 5e4)), applies: () => ksUnitsWithLaw('machine').length > 0, why: '危険な部分に覆いや安全装置を付け、プレス機械やフォークリフトなどは年1回の特定自主検査を受ける。' },
  { id: 'fall', item: 'fall', freq: 'half', n: '足場・墜落防止の点検と特別教育', acct: 'safety', cost: () => sum(ksUnitsWithLaw('fall'), u => Math.max(2, ksS(u).eng === 'build' ? u.staff.site || 0 : ksUnitHead(u) * 0.2) * 5e4), applies: () => ksUnitsWithLaw('fall').length > 0, why: '高さ2m以上の作業の墜落防止。足場の点検、手すり、フルハーネスの特別教育。' },
  { id: 'chem', item: 'chem', freq: 'once', n: '化学物質のリスクアセスメント', acct: 'fees', cost: () => 15e4 * Math.max(1, ksUnitsWithLaw('chem').length), applies: () => ksUnitsWithLaw('chem').length > 0, why: '溶剤・切削油・洗浄剤・農薬などの危険性を調べ、換気や保護具の対策を決める。' },
  { id: 'bouka', item: 'bouka', freq: 'once', n: '防火管理者の選任・消防計画の届出', acct: 'recruit', cost: () => ksBuildings().length * 2e4, applies: ksNeedsFireMgr, why: '店舗・飲食店・ホテル・病院などは収容人員30人以上、工場・事務所は50人以上で必要。防火管理講習を受けた人を選ぶ。' },
  { id: 'tenken', item: 'tenken', freq: 'half', n: '消防用設備等の点検（結果は消防署へ報告）', acct: 'fees', cost: () => ksBuildings().length * 5e4 * ksPrice(), why: '消火器・自動火災報知設備・誘導灯などを半年ごとに点検する（建物ごと）。' },
  { id: 'kunren', item: 'kunren', freq: () => (ksBuildings().some(b => b.spec) ? 'half' : 'year'), n: '消火・避難訓練', acct: 'misc', cost: () => ksBuildings().length * 1e4, why: '店舗・飲食店・ホテルなど（特定防火対象物）は年2回以上、それ以外も消防計画に従って行う。' },
  { id: 'haccp', item: 'haccp', freq: 'year', n: 'HACCPの衛生管理計画の見直しと衛生教育', acct: 'fees', cost: () => sum(ksUnitsWithLaw('haccp'), u => Math.max(1, ksUnitBuildings(u).length)) * 5e4, applies: () => ksUnitsWithLaw('haccp').length > 0, why: '食中毒を防ぐ衛生管理の計画と記録。食品衛生責任者を置く。' },
  { id: 'alcohol', item: 'alcohol', freq: 'year', n: '安全運転管理者とアルコールチェック（検知器の更新）', acct: 'supplies', cost: () => 8e4 * ksUnitsWithLaw('alcohol').length, applies: () => ksUnitsWithLaw('alcohol').length > 0, why: '社用車5台以上（事業用の車は運行管理者の点呼）。運転の前後に検知器で確認し、記録を1年保存する。' },
  { id: 'kyoka', item: 'kyoka', freq: 'five', n: '建設業許可の更新', acct: 'dues', cost: () => 10e4, applies: () => ksUnitsWithLaw('kyoka').length > 0, why: '500万円以上の工事を請け負うのに必要。5年ごとに更新する。' },
  { id: 'privacy', item: 'privacy', freq: 'year', n: '情報セキュリティの点検と社員教育', acct: 'fees', cost: () => 40e4 * Math.sqrt(Math.max(1, ksUnitsWithLaw('privacy').length)), applies: () => ksUnitsWithLaw('privacy').length > 0, why: 'お客さまの個人データを預かる。漏えいすると報告・通知の義務がある。' },
  { id: 'kiken', item: 'kiken', freq: 'year', n: '危険物の保安監督者の選任と施設の定期点検', acct: 'fees', cost: () => 20e4 * ksUnitsWithLaw('kiken').length, applies: () => ksUnitsWithLaw('kiken').length > 0, why: 'ガソリン・灯油・溶剤などを指定数量以上扱う施設は、危険物取扱者から保安監督者を選び、年1回以上の定期点検をする（消防法）。' },
];
/* 業種ごとの許認可（カタログの lic）：更新のあるものは更新、ないものは毎年の事業報告・届出 */
function ksLicTasks() {
  return ksActiveUnits().filter(u => ksS(u).lic).map(u => {
    const lic = ksS(u).lic, every = +lic.every || 0;
    return { id: 'lic:' + u.id, item: 'lic', u: u.id, freq: every ? 'span' : 'year', span: every * 12, n: every ? `${lic.n}の更新（${ksUName(u)}）` : `${lic.n}に伴う事業報告・届出（${ksUName(u)}）`, acct: every ? 'dues' : 'fees', cost: () => (every ? 9e4 : 3e4), why: `${lic.law || '業法'}による許認可。${every ? `${every}年ごとに更新する。切れると営業できない。` : '毎年、事業の報告や変更の届出をする。'}` };
  });
}
function ksLawTaskList() { return KS_LAW_TASKS.concat(ksLicTasks()); }
function ksTaskName(t) { return typeof t.n === 'function' ? t.n() : t.n; }
function ksTaskFreq(t) { return typeof t.freq === 'function' ? t.freq() : t.freq; }
function ksTaskApplies(t) { return !t.applies || t.applies(); }

/* やることの状態：ok（済）・soon（期限が近い）・due（期限内に要対応）・over（期限切れ＝違反） */
function ksTaskStatus(t) {
  const L = G.law;
  const last = L.done[t.id];
  const f = ksTaskFreq(t);
  const mo = calMonth(G.m), fy = fyOf(G.m);
  if (f === 'fy') {
    const cov = L.doneFy[t.id] ?? -99;
    if (t.id === 'r36' && (mo === 2 || mo === 3)) {
      if (cov >= fy + 1) return { st: 'ok', next: `${ksFyLabel(fy + 1)}の分も届出済み` };
      if (cov >= fy) return { st: 'due', next: `${ksFyLabel(fy + 1)}の分を3月末までに` };
    }
    if (cov >= fy) return { st: 'ok', next: t.id === 'r36' ? `${ksFyLabel(fy + 1)}の分は2〜3月に` : '今年度は済み' };
    const dueM = fy * 12 + ((t.dueMo + 8) % 12);
    if (t.fromMo && G.m < fy * 12 + ((t.fromMo + 8) % 12)) return { st: 'ok', next: `${t.fromMo}月から` };
    if (G.m <= dueM) return { st: 'due', next: `${ymLabel(dueM)}末まで` };
    return { st: 'over', next: `${ymLabel(dueM)}末が期限` };
  }
  if (f === 'once') return last === undefined ? { st: 'over', next: 'まだしていない' } : { st: 'ok', next: `${ymLabel(last)}に実施` };
  const span = f === 'half' ? 6 : f === 'five' ? 60 : f === 'span' ? t.span || 60 : 12;
  if (last === undefined) return { st: 'over', next: '記録がない' };
  const age = G.m - last;
  if (age >= span + 1) return { st: 'over', next: `${ymLabel(last + span)}が期限` };
  if (age >= span - 1) return { st: 'due', next: `${ymLabel(last + span)}までに` };
  if (age >= span - 2) return { st: 'soon', next: `${ymLabel(last + span)}までに` };
  return { st: 'ok', next: `次は${ymLabel(last + span)}` };
}
function ksLawTasks() { return ksLawTaskList().filter(ksTaskApplies).map(t => Object.assign({ t, name: ksTaskName(t), cost: Math.round(t.cost()) }, ksTaskStatus(t))); }
/* 実施する（費用を払い、記録する） */
function ksLawDo(id, o = {}) {
  const t = ksLawTaskList().find(x => x.id === id);
  if (!t || !ksTaskApplies(t)) return 0;
  const cost = Math.round(t.cost());
  ksPost('law_' + t.item, [[t.acct, cost, 0], ['cash', 0, cost]], { cf: 'exp', u: t.u || 'HQ' });
  G.law.done[id] = G.m;
  if (ksTaskFreq(t) === 'fy') {
    const target = id === 'r36' && (calMonth(G.m) === 2 || calMonth(G.m) === 3) && (G.law.doneFy.r36 ?? -99) >= fyOf(G.m) ? fyOf(G.m) + 1 : fyOf(G.m);
    G.law.doneFy[id] = Math.max(G.law.doneFy[id] ?? -99, target);
  }
  if (id === 'r36') G.law.special = o.special !== undefined ? !!o.special : G.law.special;
  if (t.item !== 'lic' || !ksLawTasks().some(x => x.t.item === 'lic' && x.st === 'over')) ksLawFixFindings(t.item);
  return cost;
}

/* ---------- 最低賃金 ---------- */
/* パート・アルバイトの職種：[{ u, r, hours, n }] */
function ksPartRoles() {
  const out = [];
  for (const u of ksActiveUnits()) {
    const h = KS_PART_HOURS[ksS(u).eng];
    if (!h) continue;
    for (const r of ksS(u).roles) if (h[r.id] && (u.staff[r.id] || 0) > 0) out.push({ u, r, hours: ksPartHoursOf(u, r), n: `${ksActiveUnits().length > 1 ? ksUName(u) + 'の' : ''}${r.n.replace(/（.*?）/, '')}` });
  }
  return out;
}
/* 事業のパートの1か月の労働時間を、就任時の時給が最低賃金より1割ほど高くなるように決める */
function ksLawUnitInit(u) {
  const h = KS_PART_HOURS[ksS(u).eng];
  if (!h || u.partH) return;
  u.partH = {};
  for (const r of ksS(u).roles) if (h[r.id]) u.partH[r.id] = clamp(Math.round(r.wage * G.eco.wageIdx / ((G.law ? G.law.minWage : KS_MINWAGE_START) * uni(1.07, 1.13))), 40, 130);
}
function ksPartHourly(x) { return ksRoleWage(x.r, x.u) / x.hours; } // ksRoleWage が時給の引き上げ（partAdj）を含む
function ksMinWageGap() {
  let gap = -99;
  for (const x of ksPartRoles()) gap = Math.max(gap, G.law.minWage - ksPartHourly(x));
  return gap;
}
/* 時給を最低賃金＋10円まで引き上げる */
function ksRaisePartWage() {
  for (const x of ksPartRoles()) {
    const h = ksPartHourly(x);
    if (h < G.law.minWage + 10) G.law.partAdj *= (G.law.minWage + 10) / h;
  }
  G.law.done.minwage = G.m;
  ksLawFixFindings('minwage');
}

/* ---------- 残業時間の見込み（1人・1か月） ---------- */
function ksOtHoursU(u) {
  const S = ksS(u), E = KS_ENGINE[S.eng], k = u.kpi || {};
  switch (S.eng) {
    case 'shop': return 12 + Math.max(0, 1 - E.staffCap(u)) * 220;
    case 'rest': return 15 + Math.max(0, 1 - E.staffCap(u)) * 220;
    case 'mfg': return (u.op.ot || 0) * 160 + (k.util > 0.98 ? 8 : 0);
    case 'build': { const lr = E.load(u) / Math.max(1, E.loadCap(u)); return 25 + Math.max(0, lr - 0.85) * 160; }
    case 'trade': {
      const pot = sum(u.op.customers, c => c.size * c.ramp) * ksPrice();
      const cap = E.capacity(u);
      return 20 + (cap === Infinity ? 0 : Math.max(0, pot / Math.max(1, cap) - 0.9) * 160) + Math.max(0, E.trucks(u).length * 1.1 - (u.staff.logi || 0)) * 12;
    }
    case 'pro': return 15 + (k.demand && k.avail ? Math.max(0, Math.min(k.demand, k.avail * 1.3) / Math.max(1, k.avail) - 1) * 150 : 0) + (k.util > 0.98 ? 10 : 0);
    case 'subs': { const nd = E.need(u); return 15 + Math.max(0, 1 - (u.staff.dev || 0) / Math.max(1, nd.dev)) * 120 + Math.max(0, 1 - (u.staff.ops || 0) / Math.max(1, nd.ops)) * 120; }
    case 'cap': { const nd = E.need(u); return 14 + Math.max(0, 1 - (u.staff.staff || 0) / Math.max(1, nd.staff)) * 200; }
    case 'trans': { const nd = E.need(u); return 30 + Math.max(0, 1 - (u.staff.crew || 0) / Math.max(1, nd.crew)) * 200; }
    default: return 15;
  }
}
/* 会社の残業の見込み：いちばん長い事業（人のいる事業） */
function ksOtHours() {
  let mx = 0;
  for (const u of ksActiveUnits()) if (ksUnitHead(u) > 0) mx = Math.max(mx, ksOtHoursU(u));
  return mx;
}
/* 残業がいちばん長い事業 */
function ksOtUnit() {
  let best = null, mx = -1;
  for (const u of ksActiveUnits()) if (ksUnitHead(u) > 0) { const h = ksOtHoursU(u); if (h > mx) { mx = h; best = u; } }
  return best;
}
/* ---------- いま違反している項目 ---------- */
function ksLawViolations() {
  const L = G.law;
  const v = new Set();
  for (const x of ksLawTasks()) if (x.st === 'over' && x.t.item !== 'lic') v.add(x.t.item);
  const ot = L.otNow ?? ksOtHours();
  if (ot > 80 || (ot > 45 && !L.special)) v.add('otmax');
  if (ksPartRoles().length && ksMinWageGap() > 0) v.add('minwage');
  if (ksLawTasks().some(x => x.t.item === 'lic' && x.st === 'over')) v.add('lic');
  if (!L.policy.yukyu) v.add('yukyu');
  if (L.hinan) v.add('hinan');
  return v;
}

/* ---------- 初期状態（就任時。先代のやり方を引き継ぐ） ---------- */
function ksLawInit() {
  const cond = G.cond || 'normal';
  const L = G.law = {
    done: {}, doneFy: {}, special: true, partAdj: 1, minWage: KS_MINWAGE_START,
    policy: { safety: cond === 'good' ? 2 : cond === 'bad' ? 0 : 1, fireIns: cond !== 'bad', liabIns: cond === 'good', yukyu: cond !== 'bad' },
    acc: [], insp: [], fires: [], seq: 0, absent: [], fixMul: 1, otHist: [], hinan: false, flagM: undefined, soken: 0,
  };
  // 実施済みにしておく項目（状態が悪いほど、放置された項目が多い）
  for (const u of ksActiveUnits()) ksLawUnitInit(u);
  const neglect = { good: 0, normal: 2, bad: 4 }[cond];
  const tasks = ksLawTaskList().filter(ksTaskApplies);
  const skip = new Set();
  // 許可（建設業許可・業種の許認可）は、切れていると開始直後から営業できないので、放置の対象にしない（期限が近いだけにする）
  const pool = tasks.filter(t => t.id !== 'hoken' && t.id !== 'kyoka' && t.item !== 'lic').map(t => t.id);
  for (let i = 0; i < neglect && pool.length; i++) skip.add(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  for (const t of tasks) {
    if (skip.has(t.id)) continue;
    const f = ksTaskFreq(t);
    if (f === 'fy') L.doneFy[t.id] = fyOf(G.m);
    else if (f === 'once') L.done[t.id] = G.m - randInt(12, 80);
    else L.done[t.id] = G.m - randInt(1, (f === 'half' ? 5 : f === 'five' ? 50 : f === 'span' ? Math.max(2, t.span - 4) : 10));
  }
  if (skip.has('r36')) L.doneFy.r36 = undefined;
  if (ksLawKeys().has('kyoka')) L.done.kyoka = cond === 'good' ? G.m - randInt(20, 50) : G.m - randInt(51, 57);
}
/* 途中から加わった事業：その事業に必要な許認可や点検は、始めるときに済ませる（費用は立ち上げの費用に含める） */
function ksLawAddUnit(u) {
  if (!G.law) return;
  ksLawUnitInit(u);
  for (const t of ksLawTaskList()) {
    if (t.u && t.u !== u.id) continue;
    if (!ksTaskApplies(t)) continue;
    if (G.law.done[t.id] !== undefined || G.law.doneFy[t.id] !== undefined) continue;
    if (t.u === u.id || ['machine', 'fall', 'chem', 'haccp', 'alcohol', 'kyoka', 'privacy', 'kiken', 'bouka', 'taisei'].includes(t.id)) G.law.done[t.id] = G.m;
  }
}

/* ---------- 毎月の処理（ksAdvance から呼ばれる） ---------- */
function ksLawMonth(ctx) {
  const L = G.law;
  if (!L || G.hist) return;
  const emp = ksHeadcount();
  // 毎月の費用：安全衛生（事業ごと）・保険・産業医
  const sp = KS_SAFETY[L.policy.safety];
  if (sp.cost) for (const u of ksActiveUnits()) { const n = ksUnitHead(u); if (n > 0) ksPost('law_safety', [['safety', Math.round(n * sp.cost), 0], ['cash', 0, Math.round(n * sp.cost)]], { cf: 'exp', u: u.id, key: u.id }); }
  const assetsVal = sum(ksActiveAssets().filter(a => ['bldg', 'mach', 'equip', 'veh'].includes(a.acct)), a => a.cost) + ksB('goods') + ksB('mat') + ksB('prod');
  if (L.policy.fireIns) ksPayCash('insur', assetsVal * 0.0011 / 12, 'law_ins');
  if (L.policy.liabIns) ksPayCash('insur', emp * 1200, 'law_ins');
  if (emp >= 50 && L.done.taisei !== undefined) ksPayCash('fees', 5e4, 'law_doctor');
  // 労災で休んでいる人の穴埋め（応援・派遣の費用と、休んでいる人の給与の差額）
  L.absent = L.absent.filter(a => a.until > G.m);
  for (const a of L.absent) ksPost('law_cover', [['misc', Math.round(a.wage * 0.35), 0], ['cash', 0, Math.round(a.wage * 0.35)]], { cf: 'exp', u: a.u || 'HQ', key: a.u || 'HQ' });
  L.fixMul = 1 + (L.fixMul - 1) * 0.96;
  // 最低賃金の改定（10月）
  if (ctx.mo === 10) {
    L.minWage = Math.round(L.minWage * (1 + uni(0.035, 0.05)));
    if (ksPartRoles().length) {
      const gap = ksMinWageGap();
      ksNews(`汐見県の最低賃金が時給${L.minWage}円に改定されました。${gap > 0 ? `パート・アルバイトの時給（いちばん低い人で約${fmtNum(L.minWage - gap, 0)}円）が下回っています。引き上げが必要です` : 'パート・アルバイトの時給は上回っています'}`, gap > 0 ? 'bad' : 'info');
    }
  }
  // 残業時間
  L.otNow = ksOtHours();
  L.otU = Object.fromEntries(ksActiveUnits().filter(u => ksUnitHead(u) > 0).map(u => [u.id, Math.round(ksOtHoursU(u))]));
  L.otHist.push(L.otNow);
  if (L.otHist.length > 6) L.otHist.shift();
  // 避難通路の物品（忙しく、安全への取り組みが弱いほど置かれがち）
  const busy = ksActiveUnits().some(u => ['shop', 'trade', 'mfg', 'cap'].includes(ksS(u).eng));
  if (!L.hinan && chance((busy ? 0.05 : 0.02) * [1.6, 1, 0.45][L.policy.safety])) L.hinan = true;
  else if (L.hinan && chance(0.08 + 0.06 * L.policy.safety)) L.hinan = false;
  const viol = ksLawViolations();
  ksLawAccidents(viol, emp);
  ksLawFires(viol);
  ksLawOtherEvents(viol);
  ksLawInspections(viol);
  ksLawDeadlines(viol);
  // 健康保険で治療した労災は、健康保険組合からの照会で労災保険に切り替えることになる
  for (const a of L.acc) {
    if (!a.kenpo || a.kenpoDone || !chance(0.15)) continue;
    a.kenpoDone = true;
    ksPayCash('fees', 3e4, 'law_kenpo');
    ksNews(`健康保険組合から、${ymLabel(a.m)}のけがは仕事中のものではないかと照会がありました。労災保険に切り替える手続きをしました（業務上のけがに健康保険は使えません）`, 'bad');
    if (a.conceal && !a.found) { a.found = true; ksLawSoken('労災かくし（健康保険で治療させ、労働者死傷病報告を出さなかった）', 50e4); }
  }
  // 労災かくしの発覚
  for (const a of L.acc) {
    if (!a.conceal || a.found) continue;
    if (chance(0.025)) {
      a.found = true;
      ksLawSoken('労災かくし（労働者死傷病報告を出さなかった）', 50e4);
    }
  }
}

/* 送検・公表などの処分 */
function ksLawSoken(why, fine, kind = 'soken') {
  const L = G.law;
  if (fine) ksPost('law_fine', [['fines', fine, 0], ['cash', 0, fine]], { cf: 'other' });
  L.flagM = G.m;
  if (kind === 'soken') L.soken++;
  for (const u of ksActiveUnits()) if (u.op && u.op.rep !== undefined) u.op.rep = clamp(u.op.rep - (kind === 'koukai' ? 0.04 : 0.03), 0.7, 1.3);
  const label = kind === 'soken' ? `${esc(G.coName)}を労働基準法などの違反の疑いで書類送検` : kind === 'koukai' ? `消防法違反の建物として${esc(G.coName)}を公表` : `${esc(G.coName)}に命令`;
  ksNews(`【報道】${label}：${why}${fine ? `。罰金${fmtYen(fine)}を納付（罰金は税金の計算で費用にならない）` : ''}。銀行の評価にも響きます`, 'bad');
  G.pendingModals.push({ type: 'kLawNews', kind, why, fine });
}

/* ---------- 労働災害 ---------- */
const KS_ACC_TEXT = {
  shop: [['品出し中に脚立から落ち、手首を骨折', 'fall'], ['濡れた床で滑って転び、腰を打った', 'slip'], ['段ボールをカッターで開けていて指を切った', 'cut'], ['重い商品のケースを持ち上げて腰を痛めた', 'back'], ['バックヤードで台車に足をひかれた', 'hit']],
  rest: [['揚げ物の油がはねて腕をやけど', 'burn'], ['包丁で指を深く切った', 'cut'], ['厨房の濡れた床で滑って転倒', 'slip'], ['スライサーで指先を負傷', 'machine'], ['重い寸胴鍋を運んでいて腰を痛めた', 'back']],
  mfg: [['%Mの可動部に手を挟まれた', 'machine'], ['%Mの点検中に袖を巻き込まれ、腕を負傷', 'machine'], ['削りくず・破片が目に入った', 'cut'], ['フォークリフトに足をひかれた', 'machine'], ['重い製品を運んでいて腰を痛めた', 'back']],
  agr: [['トラクターが横転し、足を挟まれた', 'machine'], ['草刈機の刃で足を切った', 'cut'], ['はしごから落ちて腕を骨折', 'fall'], ['夏の作業中に熱中症になった', 'heat'], ['重いコンテナを運んでいて腰を痛めた', 'back']],
  build: [['足場から転落', 'fall'], ['脚立から落ちて足を骨折', 'fall'], ['上から落ちてきた資材で頭を負傷', 'hit'], ['夏の現場で熱中症になった', 'heat'], ['%Mと接触して足を負傷', 'machine']],
  trade: [['フォークリフトの荷崩れで足を負傷', 'machine'], ['配送中に交通事故を起こした', 'traffic'], ['トラックの荷台から転落', 'fall'], ['重いケースを運んでいて腰を痛めた', 'back'], ['倉庫の通路で転倒', 'slip']],
  pro: [['オフィスの階段で転倒', 'slip'], ['通勤途中に自転車で転倒（通勤災害）', 'commute'], ['長時間労働が続き、うつ病と診断された', 'mental'], ['腱鞘炎がひどくなり、休業した', 'back']],
  subs: [['設備の保守中に脚立から落ちた', 'fall'], ['通勤途中に自転車で転倒（通勤災害）', 'commute'], ['障害対応の徹夜が続き、うつ病と診断された', 'mental'], ['重い機材を運んでいて腰を痛めた', 'back']],
  cap: [['清掃中に浴室・床で滑って転倒', 'slip'], ['重いリネン・荷物を運んでいて腰を痛めた', 'back'], ['利用者の介助・誘導中に腰を痛めた', 'back'], ['設備の点検中に脚立から落ちた', 'fall'], ['フォークリフト・台車と接触して足を負傷', 'machine']],
  truck: [['荷台から転落して腰を打った', 'fall'], ['荷物の積み下ろしで腰を痛めた', 'back'], ['運転中に追突事故を起こした', 'traffic'], ['フォークリフトで荷役中に足を負傷', 'machine']],
  bus: [['運転中に交差点で事故を起こした', 'traffic'], ['車内の点検中に転倒', 'slip'], ['乗客の乗り降りの補助で腰を痛めた', 'back'], ['夏の整備作業で熱中症になった', 'heat']],
  rail: [['線路の保守作業中に転倒', 'slip'], ['車両の整備中に手を挟まれた', 'machine'], ['ホームで乗客の対応中に転落', 'fall'], ['夏の線路作業で熱中症になった', 'heat']],
  air: [['空港のランプで車両と接触', 'machine'], ['手荷物の積み込みで腰を痛めた', 'back'], ['整備中に脚立から落ちた', 'fall'], ['夏のランプで熱中症になった', 'heat']],
  sea: [['甲板で滑って転倒', 'slip'], ['係留作業中にロープに手を挟まれた', 'machine'], ['荷役中に荷が落ちてきて負傷', 'hit'], ['機関室の高温で熱中症になった', 'heat']],
};
function ksAccTexts(u) {
  const S = ksS(u);
  const list = S.eng === 'trans' ? KS_ACC_TEXT[S.p.mode === 'taxi' ? 'bus' : S.p.mode] || KS_ACC_TEXT.truck : S.eng === 'mfg' && S.bm === 'agr' ? KS_ACC_TEXT.agr : KS_ACC_TEXT[S.eng] || KS_ACC_TEXT.pro;
  // 機械の名前：その事業の設備から
  const eqs = ksUA(u).filter(a => { const q = ksEqOf(a); return q.e === S.eng && (q.k === 'job' || q.k === 'line' || S.eng === 'build'); });
  const mn = eqs.length ? ((KS_EQ[pick(eqs).eq] || {}).n || '機械').replace(/（.*?）/, '') : S.eng === 'build' ? '重機' : '機械';
  return list.map(([t, k]) => [t.replace('%M', mn), k]);
}
function ksLawAccidents(viol, emp) {
  const L = G.law;
  let mul = KS_SAFETY[L.policy.safety].mul * L.fixMul;
  for (const v of viol) mul *= (LAW_ITEMS[v] && LAW_ITEMS[v].acc) || 1;
  const ot = L.otNow;
  mul *= ot > 80 ? 1.4 : ot > 60 ? 1.2 : ot > 45 ? 1.08 : 1;
  // 過労（脳・心臓疾患や精神障害）：長い残業が2か月以上続くと起きやすい
  const longOt = L.otHist.slice(-2).length === 2 && L.otHist.slice(-2).every(h => h >= 80);
  if (longOt && chance(0.03)) {
    const u = ksOtUnit() || ksMainUnit();
    const desk = ['pro', 'subs'].includes(ksS(u).eng);
    ksLawNewAccident({ u, text: desk ? '長時間労働が続いた社員が、うつ病と診断された' : '長時間の残業が続いていた社員が、仕事中に倒れた（脳出血）', kind: 'karo', sev: chance(0.12) ? 'death' : 'long' });
    return;
  }
  const us = ksActiveUnits();
  const ps = us.map(u => KS_ACC_BASE[ksS(u).eng] * ksUnitHead(u) * mul * (ksS(u).bm === 'agr' ? 1.3 : 1) * (typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'acc') : 1));
  const p = sum(ps, x => x);
  if (!p || !chance(Math.min(0.6, p))) return;
  const u = wpick(us, ps);
  const S = ksS(u);
  const list = ksAccTexts(u);
  let [text, kind] = list[randInt(0, list.length - 1)];
  if (kind === 'heat' && ![6, 7, 8, 9].includes(calMonth(G.m))) [text, kind] = list[0];
  const r = rand();
  let sev = r < 0.56 ? 'none' : r < 0.76 ? 'short' : 'long';
  if (sev === 'long' && chance(KS_ACC_DEATH[S.eng] * (viol.has('fall') || viol.has('machine') ? 2 : 1))) sev = 'death';
  if (kind === 'traffic' && viol.has('alcohol') && chance(0.3)) text += '（運転前のアルコールチェックをしていなかった）';
  ksLawNewAccident({ u, text, kind, sev });
}
function ksLawNewAccident(o) {
  const L = G.law;
  const u = o.u || ksMainUnit();
  const R = ksS(u).roles;
  const roles = R.filter(r => (u.staff[r.id] || 0) > 0);
  const pool = roles.length ? roles : R;
  const role = pool.slice().sort((a, b) => (u.staff[b.id] || 0) - (u.staff[a.id] || 0))[o.kind === 'mental' || o.kind === 'karo' ? 0 : randInt(0, Math.min(1, pool.length - 1))] || pool[0];
  const days = o.sev === 'none' ? 0 : o.sev === 'short' ? randInt(1, 3) : o.sev === 'death' ? 0 : o.kind === 'mental' || o.kind === 'karo' ? randInt(90, 240) : randInt(7, 90);
  const a = { id: ++L.seq, m: G.m, u: u.id, un: ksUName(u), text: o.text, kind: o.kind, sev: o.sev, days, role: role.id, roleN: role.n, wage: ksRoleWage(role, u), status: 'new', choice: {} };
  L.acc.unshift(a);
  if (L.acc.length > 40) L.acc.length = 40;
  const sevTxt = { none: '休業なし', short: `休業${days}日`, long: `休業約${Math.round(days / 30 * 10) / 10}か月`, death: '死亡' }[o.sev];
  ksNews(`【労災】${ksActiveUnits().length > 1 ? ksUName(u) + '：' : ''}${role.n.replace(/（.*?）/, '')}が${o.text}（${sevTxt}）`, o.sev === 'none' ? 'info' : 'bad');
  G.pendingModals.push({ type: 'kRosai', id: a.id });
  return a;
}/* 労災の対応を決める（kRosai の画面から呼ぶ）。choice: { first, pay, report, comp, prevent } */
function ksLawResolveAccident(id, ch) {
  const L = G.law;
  const a = L.acc.find(x => x.id === id);
  if (!a || a.status === 'done') return;
  a.choice = ch;
  a.status = 'done';
  const daily = a.wage / 30;
  const u = ksUnit(a.u) || ksMainUnit();
  G.curU = u ? u.id : null;
  // 見舞金
  const gift = { none: 0, short: 3e4, long: 10e4, death: 100e4 }[a.sev];
  if (gift) ksPayCash('fukuri', gift, 'law_gift');
  // 待期期間3日の休業補償（会社が平均賃金の60%）
  if ((a.sev === 'short' || a.sev === 'long') && ch.comp === 'pay') ksPayCash('fukuri', daily * Math.min(3, a.days) * 0.6, 'law_kyugyo');
  // 治療費の扱い
  if (ch.pay === 'company') ksPayCash('fukuri', { none: 3e4, short: 8e4, long: 40e4, death: 80e4 }[a.sev], 'law_medical');
  G.curU = null;
  if (ch.pay === 'kenpo') a.kenpo = true;
  // 報告
  const mustReport = a.sev !== 'none';
  a.conceal = mustReport && ch.report === 'hide';
  if (a.conceal && ch.pay === 'kenpo') a.found = false;
  // 休業の穴埋め
  if (a.sev === 'long') L.absent.push({ until: G.m + Math.ceil(a.days / 30), wage: a.wage, u: a.u });
  if (a.sev === 'death') {
    if (u) u.staff[a.role] = Math.max(0, (u.staff[a.role] || 0) - 1);
    // 安全配慮義務違反があれば損害賠償（使用者賠償責任保険で補う）
    const viol = ksLawViolations();
    const fault = viol.has('fall') || viol.has('machine') || viol.has('otmax') || L.policy.safety === 0;
    if (fault) {
      const amt = niceAmount(uni(3000e4, 6000e4));
      ksPost('law_comp', [['compens', amt, 0], ['cash', 0, amt]], { cf: 'other' });
      if (L.policy.liabIns) { const cov = Math.round(amt * 0.9); ksPost('law_insrecv', [['cash', cov, 0], ['insRecv', 0, cov]], { cf: 'other' }); ksNews(`遺族に損害賠償${fmtYen(amt)}を払いました。使用者賠償責任保険から${fmtYen(cov)}が支払われました`, 'bad'); }
      else ksNews(`安全配慮義務違反として、遺族に損害賠償${fmtYen(amt)}を払いました（特別損失）`, 'bad');
      ksLawSoken('死亡災害で、法律で決められた安全対策をとっていなかった', 50e4);
    }
  } else if (a.kind === 'karo' || a.kind === 'mental') {
    if (L.policy.safety === 0 || (L.otHist.length && Math.max(...L.otHist) > 80)) {
      const amt = niceAmount(uni(800e4, 2000e4));
      ksPost('law_comp', [['compens', amt, 0], ['cash', 0, amt]], { cf: 'other' });
      if (L.policy.liabIns) { const cov = Math.round(amt * 0.9); ksPost('law_insrecv', [['cash', cov, 0], ['insRecv', 0, cov]], { cf: 'other' }); }
      ksNews(`長時間労働による労災として認定され、本人と和解金${fmtYen(amt)}で合意しました${L.policy.liabIns ? '（保険で9割を補填）' : ''}`, 'bad');
    }
  }
  // 再発防止
  if (ch.prevent === 'equip') { ksPayCash('safety', niceAmount(uni(30e4, 120e4) * (a.sev === 'death' ? 3 : 1)), 'law_prevent'); L.fixMul = Math.min(L.fixMul, 0.6); }
  else if (ch.prevent === 'edu') { ksPayCash('safety', 5e4, 'law_prevent'); L.fixMul = Math.min(L.fixMul, 0.85); }
  // 重い労災は労基署が調べに来る
  if (a.sev === 'long' || a.sev === 'death') L.inspNext = Object.assign(L.inspNext || {}, { labor: a.conceal ? 0.15 : a.sev === 'death' ? 0.95 : 0.35 });
}

/* ---------- 火災 ---------- */
function ksLawFires(viol) {
  let mul = 1;
  for (const v of viol) mul *= (LAW_ITEMS[v] && LAW_ITEMS[v].fire) || 1;
  for (const b of ksBuildings()) {
    const u = ksUnit(b.u);
    if (!chance(KS_FIRE_BASE[ksS(u).eng] * mul * (ksUnitLaws(u).has('kiken') ? 1.5 : 1))) continue;
    const large = chance(0.18 * (viol.has('tenken') ? 1.6 : 1) * (viol.has('kunren') ? 1.3 : 1));
    ksLawNewFire(b, large, viol);
    break;
  }
}
const KS_FIRE_CAUSE = {
  shop: ['売場の照明の電気配線', 'バックヤードの電気配線', '放火（ごみ置き場）'], rest: ['厨房のダクトにたまった油', 'ガスコンロの消し忘れ', '電気配線'],
  mfg: ['火花が可燃物に引火', '電気設備のショート', '乾燥炉・加熱設備の過熱'], build: ['資材置場のたばこの不始末', '電気ストーブ'], trade: ['フォークリフトの充電器', '倉庫の電気配線'],
  pro: ['サーバー室の電源タップ', 'モバイルバッテリーの発火'], subs: ['電源設備の過熱', '電源タップのほこり（トラッキング）'], cap: ['たばこの不始末', '電気設備の過熱', 'ボイラー室の過熱'], trans: ['車庫の車両の電気系統', '燃料の取り扱いの不注意'],
};
function ksLawNewFire(b, large, viol) {
  const L = G.law;
  const u = ksUnit(b.u);
  const S = ksS(u);
  const cause = pick(S.bm === 'agr' ? ['乾燥機の過熱', '野焼きの火の粉'] : KS_FIRE_CAUSE[S.eng] || ['電気配線']);
  const f = { id: ++L.seq, m: G.m, b: b.n, u: u.id, store: b.key ? b.key.n : null, cause, large, loss: 0, ins: 0, death: false };
  G.curU = u.id;
  if (!large) {
    f.loss = niceAmount(uni(30e4, 150e4));
    ksPayCash('repairs', f.loss, 'law_fire');
    ksNews(`【火災】${b.n}で${cause}からぼやが出ました。けが人なし（修理 ${fmtYen(f.loss)}）`, 'bad');
  } else {
    // 建物・設備・在庫が焼ける（その事業の資産。店の火災はその店の分）
    let loss = 0;
    const nB = Math.max(1, ksUnitBuildings(u).length);
    const targets = ksUA(u).filter(a => ['bldg', 'equip', 'mach'].includes(a.acct) && !a.cip);
    const share = uni(0.25, 0.5) / (b.key ? 1 : nB);
    for (const a of targets) {
      const inStore = b.key && a.n.startsWith(b.key.n + 'の');
      if (b.key ? inStore && chance(0.7) : chance(share * 1.4)) loss += ksLoseAsset(a);
    }
    // 焼けた在庫：三分法では期中の在庫は仕入高（材料仕入高）に入っているので、そこから災害による損失に振り替える
    const sk = { shop: ['purch', 'book', 'hid'], trade: ['purch', 'book', 'hid'], rest: ['purch', 'book', 'hid'], mfg: ['matPurch', 'matBook', 'matHid'] }[S.eng];
    if (sk && u.op[sk[1]] > 0) {
      const frac = Math.min(0.9, (b.key ? 1 / nB : share) * 1.5);
      const inv = Math.round(u.op[sk[1]] * frac);
      ksPost('law_fire', [['disaster', inv, 0], [sk[0], 0, inv]], { desc: '火災で焼けた在庫（仕入高から振り替え）' });
      u.op[sk[1]] -= inv;
      if (u.op[sk[2]]) u.op[sk[2]] *= 1 - frac; // 帳簿に出ていない目減りも、焼けた分だけ消える
      loss += inv;
    }
    const clean = niceAmount(uni(100e4, 400e4) * Math.sqrt(u.sc || 1));
    ksPost('law_fire', [['disaster', clean, 0], ['cash', 0, clean]], { cf: 'other', desc: '火災の片付け・仮復旧' });
    loss += clean;
    f.loss = loss;
    if (L.policy.fireIns) {
      f.ins = Math.round(loss * 0.9);
      ksPost('law_insrecv', [['cash', f.ins, 0], ['insRecv', 0, f.ins]], { cf: 'other' });
    }
    // 店は休業（復旧工事が終わるまで）
    if (b.key) b.key.openM = 9999;
    const dmul = [...viol].reduce((s2, v) => s2 * ((LAW_ITEMS[v] && LAW_ITEMS[v].death) || 1), 1);
    f.death = chance(Math.min(0.5, 0.04 * dmul));
    ksNews(`【火災】${b.n}で${cause}から火が出て、建物の一部と在庫が焼けました（損害 ${fmtYen(loss)}${L.policy.fireIns ? `・火災保険から${fmtYen(f.ins)}` : '・火災保険に入っていなかった'}）${f.death ? '。逃げ遅れた従業員1人が亡くなりました' : ''}`, 'bad');
    if (f.death) {
      const viol2 = ['hinan', 'kunren', 'tenken', 'bouka'].filter(v => viol.has(v));
      if (viol2.length) ksLawSoken(`火災で死者。${viol2.map(v => LAW_ITEMS[v].s).join('・')}に違反していた（業務上過失致死の疑い）`, 100e4, 'soken');
    }
    L.inspNext = Object.assign(L.inspNext || {}, { fire: 0.9 });
  }
  G.curU = null;
  L.fires.unshift(f);
  if (L.fires.length > 20) L.fires.length = 20;
  G.pendingModals.push({ type: 'kFire', id: f.id });
}/* 資産をなくす（火災など）：期中の償却を計上し、残りの帳簿価額を災害による損失にする */
function ksLoseAsset(a) {
  const fy = fyOf(G.m);
  if (a.life) {
    const months = Math.max(0, G.m - Math.max(fy * 12, a.acqM));
    const dep = Math.max(0, Math.min(Math.round(a.cost / a.life * months / 12), a.cost - 1 - a.booked));
    if (dep > 0) { ksPost('cDep', [[a.part === 'C' ? 'depC' : 'depS', dep, 0], [a.acct === 'sw' ? 'sw' : 'accDep', 0, dep]], { desc: `焼けた資産の期中の減価償却（${a.n}）`, u: a.u }); a.booked += dep; }
  }
  const bv = a.cost - a.booked;
  ksPost('law_fire', [['accDep', a.booked, 0], ['disaster', bv, 0], [a.acct, 0, a.cost]], { desc: `火災で焼けた資産（${a.n}）`, u: a.u });
  a.soldM = G.m;
  a.lost = true;
  return bv;
}

/* ---------- その他の出来事（食中毒・情報漏えい・危険物・建設業許可の失効・許認可・申告） ---------- */
function ksLawOtherEvents(viol) {
  const L = G.law;
  const summer = [6, 7, 8, 9].includes(calMonth(G.m));
  for (const u of ksUnitsWithLaw('haccp')) {
    const eng = ksS(u).eng;
    if (!chance((eng === 'rest' ? 0.004 : eng === 'shop' ? 0.0015 : 0.001) * (viol.has('haccp') ? 4 : 1) * (summer ? 1.8 : 1) * (typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'food') : 1))) continue;
    const b = ksUnitBuildings(u)[0];
    const cost = niceAmount(uni(80e4, 250e4) * Math.sqrt(u.sc || 1));
    G.curU = u.id; ksPayCash('misc', cost, 'law_food'); G.curU = null;
    if (u.op.rep !== undefined) u.op.rep = clamp(u.op.rep - 0.04, 0.7, 1.3);
    ksNews(`【食中毒】${b ? b.n : ksUName(u)}の食品で、お客さま${randInt(4, 18)}人が腹痛を訴え、保健所が3日間の営業停止を命じました（消毒・見舞いなど ${fmtYen(cost)}）${viol.has('haccp') ? '。衛生管理の計画と記録がなかったことも指摘されました' : ''}`, 'bad');
    L.inspNext = Object.assign(L.inspNext || {}, { health: 1 });
    break;
  }
  for (const u of ksUnitsWithLaw('privacy')) {
    if (!chance(0.004 * (viol.has('privacy') ? 4 : 1) * (typeof ksUpgradeF === 'function' ? ksUpgradeF(u, 'leak') : 1))) continue;
    const cost = niceAmount(uni(300e4, 900e4) * Math.sqrt(u.sc || 1));
    G.curU = u.id; ksPayCash('misc', cost, 'law_leak'); G.curU = null;
    if (u.op.rep !== undefined) u.op.rep = clamp(u.op.rep - 0.05, 0.7, 1.3);
    ksNews(`【情報漏えい】${ksUName(u)}で不正アクセスがあり、お客さまのデータ約${randInt(2, 30) * 1000}件が漏えいしたおそれ。個人情報保護委員会に報告し、本人に通知しました（調査・お詫びなど ${fmtYen(cost)}）`, 'bad');
    L.inspNext = Object.assign(L.inspNext || {}, { ppc: viol.has('privacy') ? 0.8 : 0.3 });
    break;
  }
  for (const u of ksUnitsWithLaw('kiken')) {
    if (!chance(0.0015 * (viol.has('kiken') ? 4 : 1))) continue;
    const cost = niceAmount(uni(50e4, 300e4) * Math.sqrt(u.sc || 1));
    G.curU = u.id; ksPayCash('misc', cost, 'law_kiken'); G.curU = null;
    ksNews(`【危険物】${ksUName(u)}で燃料・溶剤が漏れ出し、消防署が出動しました（回収・清掃 ${fmtYen(cost)}）${viol.has('kiken') ? '。保安監督者の選任と定期点検をしていなかったことも指摘されました' : ''}`, 'bad');
    L.inspNext = Object.assign(L.inspNext || {}, { fire: 0.8 });
    break;
  }
  const hasKyoka = ksLawKeys().has('kyoka');
  if (hasKyoka && viol.has('kyoka') && !L.kyokaLost) { L.kyokaLost = true; ksNews('建設業の許可の期限が切れました。更新するまで、500万円以上の工事を請け負えません', 'bad'); }
  if (!hasKyoka || !viol.has('kyoka')) L.kyokaLost = false;
  // 許認可の更新が切れた事業は、取引先が離れ、仕事が減る
  const lost = {};
  for (const x of ksLawTasks()) if (x.t.item === 'lic' && x.st === 'over' && x.t.freq === 'span') lost[x.t.u] = true;
  for (const id of Object.keys(lost)) if (!(L.licLost || {})[id]) ksNews(`${ksUName(ksUnit(id))}の許可の期限が切れました。更新するまで、新しい仕事を受けられず、取引先も離れていきます`, 'bad');
  L.licLost = lost;
  // 労働者からの申告（相談）：残業代・最低賃金・長時間労働・年休
  for (const v of ['unpaid', 'minwage', 'otmax', 'yukyu', 'r36']) {
    if (!viol.has(v) || !LAW_ITEMS[v].compl) continue;
    if (chance(LAW_ITEMS[v].compl * Math.max(1, ksHeadcount() / 20))) { L.inspNext = Object.assign(L.inspNext || {}, { labor: 0.85 }); L.complaint = v; break; }
  }
}
/* 許認可が切れている事業の需要（成長の倍率 ksUpF に掛ける） */
function ksLawDemandF(u) { return G.law && G.law.licLost && G.law.licLost[u.id] ? 0.8 : 1; }

/* ---------- 立入検査 ---------- */
const KS_INSP_P = { labor: 0.011, fire: 0.012, health: 0.012, police: 0.006, ppc: 0, pref: 0, gov: 0.006 };
function ksLawInspections(viol) {
  const L = G.law;
  const nx = L.inspNext || {};
  L.inspNext = {};
  const keys = ksLawKeys();
  const hasLic = ksActiveUnits().some(u => ksS(u).lic);
  const spec = ksBuildings().some(b => b.spec);
  for (const ag of ['labor', 'fire', 'health', 'police', 'ppc', 'gov']) {
    if (ag === 'health' && !keys.has('haccp')) continue;
    if (ag === 'police' && !keys.has('alcohol')) continue;
    if (ag === 'ppc' && !keys.has('privacy')) continue;
    if (ag === 'gov' && !hasLic) continue;
    if (L.insp.some(x => x.ag === ag && x.status === 'open')) continue;
    let p = KS_INSP_P[ag];
    if (ag === 'fire' && spec) p = 0.028;
    p = Math.max(p, nx[ag] || 0);
    if (!chance(p)) continue;
    const kind = ag === 'labor' ? (L.complaint ? '申告監督' : nx.labor >= 0.3 ? '災害時監督' : '定期監督') : ag === 'ppc' ? '報告徴収' : ag === 'gov' ? '監査' : '立入検査';
    const finds = [];
    for (const v of viol) {
      const it = LAW_ITEMS[v];
      if (!it || it.ag !== ag) continue;
      if (chance(it.det)) finds.push({ item: v, kind: it.sev >= 3 && it.danger && chance(0.4) ? 'meirei' : it.meas === 'soken' ? 'kankoku' : it.meas, fixed: false });
    }
    // 労災かくしが見つかることもある
    if (ag === 'labor') for (const a of L.acc) if (a.conceal && !a.found && chance(0.35)) { a.found = true; finds.push({ item: 'report', kind: 'soken', fixed: true }); }
    // 安全への取り組みが最低限なら指導票
    if (ag === 'labor' && L.policy.safety === 0 && chance(0.6)) finds.push({ item: 'safetyMin', kind: 'shido', fixed: false, soft: true });
    const ins = { id: ++L.seq, m: G.m, ag, kind, finds, due: G.m + 2, status: finds.some(f => !f.fixed) ? 'open' : 'closed', stage: 0, why: ag === 'labor' && L.complaint ? LAW_ITEMS[L.complaint].s : '' };
    if (ag === 'labor') L.complaint = null;
    L.insp.unshift(ins);
    if (L.insp.length > 30) L.insp.length = 30;
    const agN = LAW_AG[ag].n;
    ksNews(`【${agN}】${kind}がありました。${finds.length ? `指摘 ${finds.length}件（${finds.map(f => (LAW_ITEMS[f.item] || { s: '安全衛生の取り組み' }).s).join('・')}）` : '指摘はありませんでした'}`, finds.length ? 'bad' : 'good');
    if (finds.some(f => f.item === 'report')) ksLawSoken('労災かくし（労働者死傷病報告を出さなかった）', 50e4);
    if (finds.some(f => f.kind === 'meirei')) { ksNews(`${agN}から使用停止命令。是正が終わるまで危険な機械・作業を止めます`, 'bad'); }
    G.pendingModals.push({ type: 'kInsp', id: ins.id });
  }
}
/* 指摘された項目を直したら、指摘を「是正済み」にする */
function ksLawFixFindings(item) {
  for (const ins of G.law.insp) for (const f of ins.finds) if (f.item === item) f.fixed = true;
}
function ksLawFindingFix(item) {
  if (item === 'otmax') { G.law.special = true; return; }
  if (item === 'minwage') { ksRaisePartWage(); return; }
  if (item === 'yukyu') { G.law.policy.yukyu = true; ksLawFixFindings('yukyu'); return; }
  if (item === 'hinan') { G.law.hinan = false; ksLawFixFindings('hinan'); return; }
  if (item === 'safetyMin') { G.law.policy.safety = Math.max(1, G.law.policy.safety); ksLawFixFindings('safetyMin'); return; }
  if (item === 'unpaid') { ksLawFixFindings('unpaid'); return; }
  if (item === 'lic') { for (const x of ksLawTasks()) if (x.t.item === 'lic' && x.st !== 'ok') ksLawDo(x.t.id); ksLawFixFindings('lic'); return; }
  const t = ksLawTaskList().find(x => x.item === item);
  if (t) ksLawDo(t.id);
}
/* 是正報告書を出す（指摘をすべて直していれば終わり） */
function ksLawReport(id) {
  const ins = G.law.insp.find(x => x.id === id);
  if (!ins) return false;
  const viol = ksLawViolations();
  for (const f of ins.finds) if (!f.fixed && !viol.has(f.item) && f.item !== 'safetyMin') f.fixed = true;
  if (ins.finds.every(f => f.fixed)) { ins.status = 'closed'; ins.reportM = G.m; return true; }
  return false;
}
/* 是正期日を過ぎたら：労基署は再監督 → 送検、消防は警告 → 命令 → 公表、保健所・警察は命令 */
function ksLawDeadlines(viol) {
  for (const ins of G.law.insp) {
    if (ins.status !== 'open' || G.m < ins.due) continue;
    for (const f of ins.finds) if (!f.fixed && !viol.has(f.item) && f.item !== 'safetyMin') f.fixed = true;
    if (ins.finds.every(f => f.fixed)) { ins.status = 'closed'; continue; }
    ins.stage++;
    const left = ins.finds.filter(f => !f.fixed).map(f => (LAW_ITEMS[f.item] || { s: '安全衛生' }).s).join('・');
    if (ins.ag === 'labor') {
      if (ins.stage === 1) { ins.due = G.m + 1; ksNews(`【労働基準監督署】是正期日を過ぎたため再監督がありました。来月末までに是正しなければ送検されます（${left}）`, 'bad'); }
      else { ins.status = 'soken'; ksLawSoken(`是正勧告に従わなかった（${left}）`, 30e4); }
    } else if (ins.ag === 'fire') {
      if (ins.stage === 1) { ins.due = G.m + 1; ksNews(`【消防署】是正されていないため警告書が出されました（${left}）`, 'bad'); }
      else if (ins.stage === 2) { ins.due = G.m + 2; ins.status = 'open'; ksLawSoken(`消防法の措置命令に違反（${left}）。建物に命令の標識が付けられました`, 0, 'koukai'); }
      else { ins.status = 'soken'; ksLawSoken(`措置命令に従わなかったため告発（${left}）`, 50e4); }
    } else {
      ins.status = 'soken';
      ksLawSoken(`${LAW_AG[ins.ag].n}の指導に従わなかった（${left}）`, 30e4, 'meirei');
    }
  }
}

/* ---------- 銀行・税金とのつながり ---------- */
/* 送検・公表から1年は、銀行の格付が1段階下がる */
const ksGrade0 = ksGrade;
ksGrade = function () {
  const r = ksGrade0();
  if (G.law && G.law.flagM !== undefined && G.m - G.law.flagM < 12 && r.g < 10) r.g = Math.min(10, r.g + 1);
  return r;
};
const ksEvalLoan0 = ksEvalLoan;
ksEvalLoan = function (app) {
  const r = ksEvalLoan0(app);
  if (G.law && G.law.flagM !== undefined && G.m - G.law.flagM < 12 && r.reasons) r.reasons.push('法令違反（送検・公表）の報道があったため、格付を1段階下げて審査しました。');
  return r;
};
/* 罰金は税金の計算で費用にならない（損金不算入）ので、所得に足し戻す */
const ksTaxCalc0 = ksTaxCalc;
ksTaxCalc = function () {
  const t = ksTaxCalc0();
  const fines = ksB('fines');
  if (!fines) return t;
  const loss = G.lossCF || 0;
  let taxable = t.pretax + fines - loss;
  let lossAfter = 0;
  if (taxable <= 0) { lossAfter = -taxable; taxable = 0; }
  const income = Math.round(Math.min(taxable, 8e6) * 0.25 + Math.max(0, taxable - 8e6) * 0.34);
  const tax = Math.round((income + 7e4) / 100) * 100;
  return Object.assign(t, { fines, taxable, income, tax, lossAfter });
};

/* 仕訳帳の解説 */
Object.assign(KS_JNOTE, {
  law_r36: ['36協定の作成・届出（社会保険労務士への報酬）', '専門家への報酬は支払手数料。36協定そのものは届出の書類で、費用ではありません。'],
  law_hoken: ['労働保険の年度更新（社会保険労務士への報酬）', '労働保険料そのものは、毎月の法定福利費に含めています。'],
  law_kenshin: ['定期健康診断の費用', '全員が受ける健康診断の費用は福利厚生費（販管費）。'],
  law_taisei: ['安全衛生の担当者の講習', '講習の費用は採用教育費。'],
  law_machine: ['機械・フォークリフトの点検', '定期の点検・検査は修繕費。'],
  law_fall: ['足場の点検・墜落防止の教育', '安全衛生費。'],
  law_chem: ['化学物質のリスクアセスメント', '外部の専門家への報酬は支払手数料。'],
  law_bouka: ['防火管理講習', '講習の費用は採用教育費。'],
  law_tenken: ['消防用設備等の点検', '点検業者への支払いは支払手数料。'],
  law_kunren: ['消火・避難訓練', '訓練に使った消火器の詰め替えなどは雑費。'],
  law_haccp: ['衛生管理の計画と教育', '支払手数料。'],
  law_alcohol: ['アルコール検知器の購入', '10万円未満の備品は消耗品費（資産にしない）。'],
  law_kyoka: ['建設業許可の更新手数料', '役所に払う手数料は租税公課。'],
  law_privacy: ['情報セキュリティの点検', '外部の専門家への報酬は支払手数料。'],
  law_kiken: ['危険物の保安・点検、流出の対応', '点検の報酬は支払手数料、流出の回収・清掃は雑費。'],
  law_lic: ['許認可の更新・事業報告', '役所に払う更新の手数料は租税公課、書類を作る専門家（行政書士）への報酬は支払手数料。'],
  law_safety: ['安全衛生の費用', '保護具・安全教育・巡回など。安全衛生費（販管費）。'],
  law_ins: ['保険料（火災保険・使用者賠償責任保険）', '毎月払う保険料は費用（保険料）。'],
  law_doctor: ['産業医の報酬', '支払手数料。'],
  law_cover: ['労災で休んでいる人の穴埋め', '応援の人の費用と、休んでいる人の給与（労災保険から出るので会社は払わない）の差額。'],
  law_gift: ['お見舞金', '福利厚生費。'],
  law_kyugyo: ['休業補償（待期期間3日分）', '労災の休業の最初の3日間は、会社が平均賃金の60%以上を払う（労働基準法76条）。'],
  law_medical: ['治療費を会社が負担', '労災保険を使わずに会社が払った治療費。'],
  law_comp: ['損害賠償金', '労災で安全配慮義務違反があったときの賠償。臨時の損失として特別損失。'],
  law_insrecv: ['保険金の受取', '保険会社から受け取った保険金は受取保険金（特別利益）。'],
  law_prevent: ['再発防止の対策', '安全カバー・手すり・滑り止めなど少額の対策は安全衛生費。'],
  law_fire: ['火災による損失', '焼けた建物・設備の帳簿価額、在庫、片付けの費用は「災害による損失」（特別損失）。'],
  law_food: ['食中毒の対応', '消毒・お見舞い・廃棄などの費用。'],
  law_leak: ['情報漏えいの対応', '調査・お詫び・コールセンターなどの費用。'],
  law_fine: ['罰金の納付', '罰金及び科料は営業外費用。税金の計算では費用にならない（損金不算入）。'],
  law_kenpo: ['健康保険から労災保険への切り替え', '手続きの手数料。'],
});
