'use strict';
/* =========================================================
 *  27_kaisha_law.js : 会社経営モードの法令対応（エンジン・画面に依存しない）
 *   36協定・健康診断・安全衛生の体制・最低賃金・労働保険・機械や足場の安全・消防設備の点検・防火管理・
 *   避難訓練・HACCP・アルコールチェック・建設業許可・情報セキュリティ。
 *   労働災害・火災・食中毒・情報漏えい、役所の立入検査と是正、送検・公表、労災かくしの発覚。
 * ========================================================= */

/* 業種ごとの労災の起きやすさ（1人・1か月あたり）と、休業4日以上のうち死亡になる割合 */
const KS_ACC_BASE = { ret: 0.0028, food: 0.0036, mfg: 0.0036, con: 0.0058, whl: 0.0034, it: 0.0008 };
const KS_ACC_DEATH = { ret: 0.004, food: 0.004, mfg: 0.025, con: 0.045, whl: 0.03, it: 0.003 };
const KS_FIRE_BASE = { ret: 0.0012, food: 0.003, mfg: 0.0016, con: 0.0005, whl: 0.0011, it: 0.0004 };
/* 安全衛生への取り組み：費用（1人・月）と事故の起きやすさ */
const KS_SAFETY = [
  { n: '最低限', cost: 0, mul: 1.45, desc: '法律で決まったこと以外はしない。' },
  { n: '標準', cost: 2500, mul: 1.0, desc: '保護具の支給、危険予知の朝礼、月1回の職場の巡回。' },
  { n: '手厚い', cost: 7000, mul: 0.65, desc: '外部の専門家による点検、設備の改善、毎月の安全教育。' },
];
/* パート・アルバイトの1か月の労働時間（時給の計算に使う） */
const KS_PART_HOURS = { ret: { part: 88 }, food: { part: 70 } };
const KS_MINWAGE_START = 1080; // 2026年10月改定の汐見県の最低賃金（時給・架空）

/* 会社の建物（店・工場・倉庫・事務所） */
function ksBuildings() {
  if (G.ind === 'ret') return KS_ENGINE.ret.storesOpen().map(s => ({ n: s.n, spec: true, key: s }));
  if (G.ind === 'food') return KS_ENGINE.food.shopsOpen().map(s => ({ n: s.n, spec: true, key: s }));
  return [{ n: { mfg: '本社工場', con: '本社事務所・資材置場', whl: '本社倉庫', it: '本社オフィス' }[G.ind], spec: false }];
}
/* 防火管理者が必要か（収容人員：特定防火対象物は30人以上、それ以外は50人以上） */
function ksNeedsFireMgr() { return G.ind === 'ret' || G.ind === 'food' || ksHeadcount() >= 50; }

/* ---------- 法令のやること ---------- */
/* freq: year（毎年）・half（半年ごと）・once（一度）・five（5年ごと）・fy（年度ごと：dueMo までに） */
const KS_LAW_TASKS = [
  { id: 'r36', item: 'r36', freq: 'fy', dueMo: 4, n: '36協定の締結・届出', acct: 'fees', cost: () => 5e4, why: '残業・休日出勤をさせるには、毎年、労働者の代表と協定を結んで労基署に届け出る。' },
  { id: 'hoken', item: 'hoken', freq: 'fy', dueMo: 7, fromMo: 6, n: '労働保険の年度更新（6月1日〜7月10日）', acct: 'fees', cost: () => 3e4, why: '労災保険・雇用保険の保険料を申告・納付する（保険料は法定福利費として毎月計上済み。ここでは社会保険労務士への報酬）。' },
  { id: 'kenshin', item: 'kenshin', freq: 'year', n: '定期健康診断', acct: 'fukuri', cost: () => ksHeadcount() * 1.2e4 * ksPrice(), why: '年1回、全員に健康診断を受けさせる（福利厚生費）。' },
  { id: 'taisei', item: 'taisei', freq: 'once', n: () => (ksHeadcount() >= 50 ? '衛生管理者・産業医の選任と衛生委員会' : '安全衛生推進者の選任'), acct: 'recruit', cost: () => (ksHeadcount() >= 50 ? 15e4 : 3e4), applies: () => ksHeadcount() >= 10, why: '10〜49人は安全衛生推進者、50人以上は衛生管理者・産業医（毎月の報酬）と衛生委員会が必要。' },
  { id: 'machine', item: 'machine', freq: 'year', n: () => (G.ind === 'mfg' ? '機械の安全装置の点検と特定自主検査' : 'フォークリフトの特定自主検査'), acct: 'repairs', cost: () => (G.ind === 'mfg' ? KS_ENGINE.mfg.machines().length * 6e4 : 2 * 5e4), applies: () => G.ind === 'mfg' || G.ind === 'whl', why: '危険な部分に覆いや安全装置を付け、年1回の特定自主検査を受ける。' },
  { id: 'fall', item: 'fall', freq: 'half', n: '足場・墜落防止の点検と特別教育', acct: 'safety', cost: () => Math.max(2, G.staff.site || 0) * 5e4, applies: () => G.ind === 'con', why: '高さ2m以上の作業の墜落防止。足場の点検、手すり、フルハーネスの特別教育。' },
  { id: 'chem', item: 'chem', freq: 'once', n: '化学物質のリスクアセスメント', acct: 'fees', cost: () => 15e4, applies: () => G.ind === 'mfg', why: '切削油・洗浄剤などの危険性を調べ、換気や保護具の対策を決める。' },
  { id: 'bouka', item: 'bouka', freq: 'once', n: '防火管理者の選任・消防計画の届出', acct: 'recruit', cost: () => ksBuildings().length * 2e4, applies: ksNeedsFireMgr, why: '店舗・飲食店は収容人員30人以上、工場・事務所は50人以上で必要。防火管理講習を受けた人を選ぶ。' },
  { id: 'tenken', item: 'tenken', freq: 'half', n: '消防用設備等の点検（結果は消防署へ報告）', acct: 'fees', cost: () => ksBuildings().length * 5e4 * ksPrice(), why: '消火器・自動火災報知設備・誘導灯などを半年ごとに点検する。' },
  { id: 'kunren', item: 'kunren', freq: () => (G.ind === 'ret' || G.ind === 'food' ? 'half' : 'year'), n: '消火・避難訓練', acct: 'misc', cost: () => ksBuildings().length * 1e4, why: '店舗・飲食店（特定防火対象物）は年2回以上、それ以外も消防計画に従って行う。' },
  { id: 'haccp', item: 'haccp', freq: 'year', n: 'HACCPの衛生管理計画の見直しと衛生教育', acct: 'fees', cost: () => ksBuildings().length * 5e4, applies: () => G.ind === 'food' || G.ind === 'ret', why: '食中毒を防ぐ衛生管理の計画と記録。食品衛生責任者を置く。' },
  { id: 'alcohol', item: 'alcohol', freq: 'year', n: '安全運転管理者とアルコールチェック（検知器の更新）', acct: 'supplies', cost: () => 8e4, applies: () => G.ind === 'whl', why: '社用車5台以上。運転の前後に検知器で確認し、記録を1年保存する。' },
  { id: 'kyoka', item: 'kyoka', freq: 'five', n: '建設業許可の更新', acct: 'dues', cost: () => 10e4, applies: () => G.ind === 'con', why: '500万円以上の工事を請け負うのに必要。5年ごとに更新する。' },
  { id: 'privacy', item: 'privacy', freq: 'year', n: '情報セキュリティの点検と社員教育', acct: 'fees', cost: () => 40e4, applies: () => G.ind === 'it', why: 'お客さまの個人データを預かる。漏えいすると報告・通知の義務がある。' },
];
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
  const span = f === 'half' ? 6 : f === 'five' ? 60 : 12;
  if (last === undefined) return { st: 'over', next: '記録がない' };
  const age = G.m - last;
  if (age >= span + 1) return { st: 'over', next: `${ymLabel(last + span)}が期限` };
  if (age >= span - 1) return { st: 'due', next: `${ymLabel(last + span)}までに` };
  if (age >= span - 2) return { st: 'soon', next: `${ymLabel(last + span)}までに` };
  return { st: 'ok', next: `次は${ymLabel(last + span)}` };
}
function ksLawTasks() { return KS_LAW_TASKS.filter(ksTaskApplies).map(t => Object.assign({ t, name: ksTaskName(t), cost: Math.round(t.cost()) }, ksTaskStatus(t))); }

/* 実施する（費用を払い、記録する） */
function ksLawDo(id, o = {}) {
  const t = KS_LAW_TASKS.find(x => x.id === id);
  if (!t || !ksTaskApplies(t)) return 0;
  const cost = Math.round(t.cost());
  ksPayCash(t.acct, cost, 'law_' + id);
  G.law.done[id] = G.m;
  if (ksTaskFreq(t) === 'fy') {
    const target = id === 'r36' && (calMonth(G.m) === 2 || calMonth(G.m) === 3) && (G.law.doneFy.r36 ?? -99) >= fyOf(G.m) ? fyOf(G.m) + 1 : fyOf(G.m);
    G.law.doneFy[id] = Math.max(G.law.doneFy[id] ?? -99, target);
  }
  if (id === 'r36') G.law.special = o.special !== undefined ? !!o.special : G.law.special;
  ksLawFixFindings(t.item);
  return cost;
}

/* ---------- 最低賃金 ---------- */
function ksPartRoles() { const h = KS_PART_HOURS[G.ind]; return h ? KS_INDS[G.ind].roles.filter(r => h[r.id]) : []; }
function ksPartHourly(r) { return ksRoleWage(r) / KS_PART_HOURS[G.ind][r.id]; } // ksRoleWage が時給の引き上げ（partAdj）を含む
function ksMinWageGap() {
  let gap = 0;
  for (const r of ksPartRoles()) gap = Math.max(gap, G.law.minWage - ksPartHourly(r));
  return gap;
}
/* 時給を最低賃金＋10円まで引き上げる */
function ksRaisePartWage() {
  for (const r of ksPartRoles()) {
    const h = ksPartHourly(r);
    if (h < G.law.minWage + 10) G.law.partAdj *= (G.law.minWage + 10) / h;
  }
  G.law.done.minwage = G.m;
  ksLawFixFindings('minwage');
}

/* ---------- 残業時間の見込み（1人・1か月） ---------- */
function ksOtHours() {
  const k = (G.months[G.months.length - 1] || {}).kpi || {};
  switch (G.ind) {
    case 'ret': return 12 + Math.max(0, 1 - KS_ENGINE.ret.staffCap()) * 220;
    case 'food': return 15 + Math.max(0, 1 - KS_ENGINE.food.staffCap()) * 220;
    case 'mfg': return G.op.ot * 160 + (k.util > 0.98 ? 8 : 0);
    case 'con': { const E = KS_ENGINE.con; const lr = E.load() / Math.max(1, E.loadCap()); return 25 + Math.max(0, lr - 0.85) * 160; }
    case 'whl': { const pot = sum(G.op.customers, c => c.size * c.ramp) * ksPrice(); return 20 + Math.max(0, pot / Math.max(1, KS_ENGINE.whl.capacity()) - 0.9) * 160 + Math.max(0, KS_ENGINE.whl.trucks().length * 1.1 - G.staff.logi) * 12; }
    case 'it': return 15 + (k.demand && k.avail ? Math.max(0, Math.min(k.demand, k.avail * 1.3) / Math.max(1, k.avail) - 1) * 150 : 0) + (k.util > 0.98 ? 10 : 0);
    default: return 15;
  }
}

/* ---------- いま違反している項目 ---------- */
function ksLawViolations() {
  const L = G.law;
  const v = new Set();
  for (const x of ksLawTasks()) if (x.st === 'over') v.add(x.t.item);
  const ot = L.otNow ?? ksOtHours();
  if (ot > 80 || (ot > 45 && !L.special)) v.add('otmax');
  if (ksPartRoles().length && ksMinWageGap() > 0) v.add('minwage');
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
  const neglect = { good: 0, normal: 2, bad: 4 }[cond];
  const tasks = KS_LAW_TASKS.filter(ksTaskApplies);
  const skip = new Set();
  const pool = tasks.filter(t => t.id !== 'hoken').map(t => t.id);
  for (let i = 0; i < neglect && pool.length; i++) skip.add(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  for (const t of tasks) {
    if (skip.has(t.id)) continue;
    const f = ksTaskFreq(t);
    if (f === 'fy') L.doneFy[t.id] = fyOf(G.m);
    else if (f === 'once') L.done[t.id] = G.m - randInt(12, 80);
    else L.done[t.id] = G.m - randInt(1, (f === 'half' ? 5 : f === 'five' ? 50 : 10));
  }
  if (skip.has('r36')) L.doneFy.r36 = undefined;
  if (G.ind === 'con' && !skip.has('kyoka')) L.done.kyoka = G.m - randInt(20, 50);
}

/* ---------- 毎月の処理（ksAdvance から呼ばれる） ---------- */
function ksLawMonth(ctx) {
  const L = G.law;
  if (!L || G.hist) return;
  const emp = ksHeadcount();
  // 毎月の費用：安全衛生・保険・産業医
  const sp = KS_SAFETY[L.policy.safety];
  if (sp.cost) ksPayCash('safety', emp * sp.cost, 'law_safety');
  const assetsVal = sum(ksActiveAssets().filter(a => ['bldg', 'mach', 'equip', 'veh'].includes(a.acct)), a => a.cost) + ksB('goods') + ksB('mat') + ksB('prod');
  if (L.policy.fireIns) ksPayCash('insur', assetsVal * 0.0011 / 12, 'law_ins');
  if (L.policy.liabIns) ksPayCash('insur', emp * 1200, 'law_ins');
  if (emp >= 50 && L.done.taisei !== undefined) ksPayCash('fees', 5e4, 'law_doctor');
  // 労災で休んでいる人の穴埋め（応援・派遣の費用と、休んでいる人の給与の差額）
  L.absent = L.absent.filter(a => a.until > G.m);
  for (const a of L.absent) ksPayCash('misc', a.wage * 0.35, 'law_cover');
  L.fixMul = 1 + (L.fixMul - 1) * 0.96;
  // 最低賃金の改定（10月）
  if (ctx.mo === 10) {
    L.minWage = Math.round(L.minWage * (1 + uni(0.035, 0.05)));
    if (ksPartRoles().length) {
      const gap = ksMinWageGap();
      ksNews(`汐見県の最低賃金が時給${L.minWage}円に改定されました。${gap > 0 ? `パート・アルバイトの時給（約${fmtNum(L.minWage - gap, 0)}円）が下回っています。引き上げが必要です` : 'パート・アルバイトの時給は上回っています'}`, gap > 0 ? 'bad' : 'info');
    }
  }
  // 残業時間
  L.otNow = ksOtHours();
  L.otHist.push(L.otNow);
  if (L.otHist.length > 6) L.otHist.shift();
  // 避難通路の物品（忙しく、安全への取り組みが弱いほど置かれがち）
  const busy = G.ind === 'ret' || G.ind === 'whl' || G.ind === 'mfg';
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
  const rep = G.op.rep !== undefined ? G.op.rep : null;
  if (rep !== null) G.op.rep = clamp(rep - (kind === 'koukai' ? 0.04 : 0.03), 0.7, 1.3);
  const label = kind === 'soken' ? `${esc(G.coName)}を労働基準法などの違反の疑いで書類送検` : kind === 'koukai' ? `消防法違反の建物として${esc(G.coName)}を公表` : `${esc(G.coName)}に命令`;
  ksNews(`【報道】${label}：${why}${fine ? `。罰金${fmtYen(fine)}を納付（罰金は税金の計算で費用にならない）` : ''}。銀行の評価にも響きます`, 'bad');
  G.pendingModals.push({ type: 'kLawNews', kind, why, fine });
}

/* ---------- 労働災害 ---------- */
const KS_ACC_TEXT = {
  ret: [['品出し中に脚立から落ち、手首を骨折', 'fall'], ['濡れた床で滑って転び、腰を打った', 'slip'], ['段ボールをカッターで開けていて指を切った', 'cut'], ['重い飲料のケースを持ち上げて腰を痛めた', 'back'], ['冷凍庫の中で転倒し、膝を痛めた', 'slip']],
  food: [['揚げ物の油がはねて腕をやけど', 'burn'], ['包丁で指を深く切った', 'cut'], ['厨房の濡れた床で滑って転倒', 'slip'], ['スライサーで指先を負傷', 'machine'], ['重い寸胴鍋を運んでいて腰を痛めた', 'back']],
  mfg: [['旋盤の回転部に袖を巻き込まれ、腕を負傷', 'machine'], ['プレス機械に手を挟まれた', 'machine'], ['削りくずが目に入った', 'cut'], ['フォークリフトに足をひかれた', 'machine'], ['重い部品を運んでいて腰を痛めた', 'back']],
  con: [['足場から転落', 'fall'], ['脚立から落ちて足を骨折', 'fall'], ['上から落ちてきた資材で頭を負傷', 'hit'], ['夏の現場で熱中症になった', 'heat'], ['電動のこぎりで手を切った', 'cut']],
  whl: [['フォークリフトの荷崩れで足を負傷', 'machine'], ['配送中に交通事故を起こした', 'traffic'], ['トラックの荷台から転落', 'fall'], ['重いケースを運んでいて腰を痛めた', 'back'], ['冷凍倉庫で転倒', 'slip']],
  it: [['オフィスの階段で転倒', 'slip'], ['通勤途中に自転車で転倒（通勤災害）', 'commute'], ['長時間労働が続き、うつ病と診断された', 'mental'], ['腱鞘炎がひどくなり、休業した', 'back']],
};
function ksLawAccidents(viol, emp) {
  const L = G.law;
  let mul = KS_SAFETY[L.policy.safety].mul * L.fixMul;
  for (const v of viol) mul *= (LAW_ITEMS[v] && LAW_ITEMS[v].acc) || 1;
  const ot = L.otNow;
  mul *= ot > 80 ? 1.4 : ot > 60 ? 1.2 : ot > 45 ? 1.08 : 1;
  const p = KS_ACC_BASE[G.ind] * emp * mul;
  // 過労（脳・心臓疾患や精神障害）：長い残業が2か月以上続くと起きやすい
  const longOt = L.otHist.slice(-2).length === 2 && L.otHist.slice(-2).every(h => h >= 80);
  if (longOt && chance(0.03)) { ksLawNewAccident({ text: G.ind === 'it' ? '長時間労働が続いたエンジニアが、うつ病と診断された' : '長時間の残業が続いていた社員が、仕事中に倒れた（脳出血）', kind: 'karo', sev: chance(0.12) ? 'death' : 'long' }); return; }
  if (!chance(Math.min(0.6, p))) return;
  const list = KS_ACC_TEXT[G.ind];
  let [text, kind] = list[randInt(0, list.length - 1)];
  if (kind === 'heat' && ![6, 7, 8, 9].includes(calMonth(G.m))) [text, kind] = list[0];
  const r = rand();
  let sev = r < 0.56 ? 'none' : r < 0.76 ? 'short' : 'long';
  if (sev === 'long' && chance(KS_ACC_DEATH[G.ind] * (viol.has('fall') || viol.has('machine') ? 2 : 1))) sev = 'death';
  if (kind === 'traffic' && viol.has('alcohol') && chance(0.3)) text += '（運転前のアルコールチェックをしていなかった）';
  ksLawNewAccident({ text, kind, sev });
}
function ksLawNewAccident(o) {
  const L = G.law;
  const roles = KS_INDS[G.ind].roles.filter(r => (G.staff[r.id] || 0) > 0);
  const role = roles.slice().sort((a, b) => (G.staff[b.id] || 0) - (G.staff[a.id] || 0))[o.kind === 'mental' || o.kind === 'karo' ? 0 : randInt(0, Math.min(1, roles.length - 1))] || roles[0];
  const days = o.sev === 'none' ? 0 : o.sev === 'short' ? randInt(1, 3) : o.sev === 'death' ? 0 : o.kind === 'mental' || o.kind === 'karo' ? randInt(90, 240) : randInt(7, 90);
  const a = { id: ++L.seq, m: G.m, text: o.text, kind: o.kind, sev: o.sev, days, role: role.id, wage: ksRoleWage(role), status: 'new', choice: {} };
  L.acc.unshift(a);
  if (L.acc.length > 40) L.acc.length = 40;
  const sevTxt = { none: '休業なし', short: `休業${days}日`, long: `休業約${Math.round(days / 30 * 10) / 10}か月`, death: '死亡' }[o.sev];
  ksNews(`【労災】${role.n.replace(/（.*?）/, '')}が${o.text}（${sevTxt}）`, o.sev === 'none' ? 'info' : 'bad');
  G.pendingModals.push({ type: 'kRosai', id: a.id });
  return a;
}
/* 労災の対応を決める（kRosai の画面から呼ぶ）。choice: { first, pay, report, comp, prevent } */
function ksLawResolveAccident(id, ch) {
  const L = G.law;
  const a = L.acc.find(x => x.id === id);
  if (!a || a.status === 'done') return;
  a.choice = ch;
  a.status = 'done';
  const daily = a.wage / 30;
  // 見舞金
  const gift = { none: 0, short: 3e4, long: 10e4, death: 100e4 }[a.sev];
  if (gift) ksPayCash('fukuri', gift, 'law_gift');
  // 待期期間3日の休業補償（会社が平均賃金の60%）
  if ((a.sev === 'short' || a.sev === 'long') && ch.comp === 'pay') ksPayCash('fukuri', daily * Math.min(3, a.days) * 0.6, 'law_kyugyo');
  // 治療費の扱い
  if (ch.pay === 'company') ksPayCash('fukuri', { none: 3e4, short: 8e4, long: 40e4, death: 80e4 }[a.sev], 'law_medical');
  if (ch.pay === 'kenpo') a.kenpo = true;
  // 報告
  const mustReport = a.sev !== 'none';
  a.conceal = mustReport && ch.report === 'hide';
  if (a.conceal && ch.pay === 'kenpo') a.found = false;
  // 休業の穴埋め
  if (a.sev === 'long') L.absent.push({ until: G.m + Math.ceil(a.days / 30), wage: a.wage });
  if (a.sev === 'death') {
    G.staff[a.role] = Math.max(0, (G.staff[a.role] || 0) - 1);
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
  const L = G.law;
  let mul = 1;
  for (const v of viol) mul *= (LAW_ITEMS[v] && LAW_ITEMS[v].fire) || 1;
  for (const b of ksBuildings()) {
    if (!chance(KS_FIRE_BASE[G.ind] * mul)) continue;
    const large = chance(0.18 * (viol.has('tenken') ? 1.6 : 1) * (viol.has('kunren') ? 1.3 : 1));
    ksLawNewFire(b, large, viol);
    break;
  }
}
function ksLawNewFire(b, large, viol) {
  const L = G.law;
  const cause = pick({ ret: ['惣菜の調理場のフライヤー', 'バックヤードの電気配線', '放火（ごみ置き場）'], food: ['厨房のダクトにたまった油', 'ガスコンロの消し忘れ', '電気配線'], mfg: ['研削の火花が切りくずに引火', '電気設備のショート', '乾燥炉の過熱'], con: ['資材置場のたばこの不始末', '電気ストーブ'], whl: ['フォークリフトの充電器', '倉庫の電気配線'], it: ['サーバー室の電源タップ', 'モバイルバッテリーの発火'] }[G.ind]);
  const f = { id: ++L.seq, m: G.m, b: b.n, cause, large, loss: 0, ins: 0, death: false };
  if (!large) {
    f.loss = niceAmount(uni(30e4, 150e4));
    ksPayCash('repairs', f.loss, 'law_fire');
    ksNews(`【火災】${b.n}で${cause}からぼやが出ました。けが人なし（修理 ${fmtYen(f.loss)}）`, 'bad');
  } else {
    // 建物・設備・在庫が焼ける
    let loss = 0;
    const targets = ksActiveAssets().filter(a => ['bldg', 'equip', 'mach'].includes(a.acct));
    const share = uni(0.25, 0.5) / Math.max(1, ksBuildings().length);
    for (const a of targets) if (chance(share * 1.4)) loss += ksLoseAsset(a);
    // 焼けた在庫：三分法では期中の在庫は仕入高（材料仕入高）に入っているので、そこから災害による損失に振り替える
    const sk = { ret: ['purch', 'book'], whl: ['purch', 'book'], food: ['purch', 'book'], mfg: ['matPurch', 'matBook'] }[G.ind];
    if (sk && G.op[sk[1]] > 0) {
      const frac = Math.min(0.9, share * 1.5);
      const inv = Math.round(G.op[sk[1]] * frac);
      ksPost('law_fire', [['disaster', inv, 0], [sk[0], 0, inv]], { desc: '火災で焼けた在庫（仕入高から振り替え）' });
      G.op[sk[1]] -= inv;
      const hk = sk[1] === 'book' ? 'hid' : 'matHid';
      if (G.op[hk]) G.op[hk] *= 1 - frac; // 帳簿に出ていない目減りも、焼けた分だけ消える
      loss += inv;
    }
    const clean = niceAmount(uni(100e4, 400e4));
    ksPost('law_fire', [['disaster', clean, 0], ['cash', 0, clean]], { cf: 'other', desc: '火災の片付け・仮復旧' });
    loss += clean;
    f.loss = loss;
    if (L.policy.fireIns) {
      f.ins = Math.round(loss * 0.9);
      ksPost('law_insrecv', [['cash', f.ins, 0], ['insRecv', 0, f.ins]], { cf: 'other' });
    }
    // 店は休業（復旧工事が終わるまで）
    if (b.key) b.key.openM = 9999;
    const dmul = [...viol].reduce((s, v) => s * ((LAW_ITEMS[v] && LAW_ITEMS[v].death) || 1), 1);
    f.death = chance(Math.min(0.5, 0.04 * dmul));
    ksNews(`【火災】${b.n}で${cause}から火が出て、建物の一部と在庫が焼けました（損害 ${fmtYen(loss)}${L.policy.fireIns ? `・火災保険から${fmtYen(f.ins)}` : '・火災保険に入っていなかった'}）${f.death ? '。逃げ遅れた従業員1人が亡くなりました' : ''}`, 'bad');
    if (f.death) {
      const viol2 = ['hinan', 'kunren', 'tenken', 'bouka'].filter(v => viol.has(v));
      if (viol2.length) ksLawSoken(`火災で死者。${viol2.map(v => LAW_ITEMS[v].s).join('・')}に違反していた（業務上過失致死の疑い）`, 100e4, 'soken');
    }
    L.inspNext = Object.assign(L.inspNext || {}, { fire: 0.9 });
  }
  L.fires.unshift(f);
  if (L.fires.length > 20) L.fires.length = 20;
  G.pendingModals.push({ type: 'kFire', id: f.id });
}
/* 資産をなくす（火災など）：期中の償却を計上し、残りの帳簿価額を災害による損失にする */
function ksLoseAsset(a) {
  const fy = fyOf(G.m);
  if (a.life) {
    const months = Math.max(0, G.m - Math.max(fy * 12, a.acqM));
    const dep = Math.max(0, Math.min(Math.round(a.cost / a.life * months / 12), a.cost - 1 - a.booked));
    if (dep > 0) { ksPost('cDep', [[a.part === 'C' ? 'depC' : 'depS', dep, 0], [a.acct === 'sw' ? 'sw' : 'accDep', 0, dep]], { desc: `焼けた資産の期中の減価償却（${a.n}）` }); a.booked += dep; }
  }
  const bv = a.cost - a.booked;
  ksPost('law_fire', [['accDep', a.booked, 0], ['disaster', bv, 0], [a.acct, 0, a.cost]], { desc: `火災で焼けた資産（${a.n}）` });
  a.soldM = G.m;
  a.lost = true;
  return bv;
}

/* ---------- その他の出来事（食中毒・情報漏えい・建設業許可の失効・申告） ---------- */
function ksLawOtherEvents(viol) {
  const L = G.law;
  if ((G.ind === 'food' || G.ind === 'ret') && chance((G.ind === 'food' ? 0.004 : 0.0015) * (viol.has('haccp') ? 4 : 1) * ([6, 7, 8, 9].includes(calMonth(G.m)) ? 1.8 : 1))) {
    const b = ksBuildings()[0];
    const cost = niceAmount(uni(80e4, 250e4));
    ksPayCash('misc', cost, 'law_food');
    if (G.op.rep !== undefined) G.op.rep = clamp(G.op.rep - 0.04, 0.7, 1.3);
    ksNews(`【食中毒】${b ? b.n : '店'}で食事をしたお客さま${randInt(4, 18)}人が腹痛を訴え、保健所が3日間の営業停止を命じました（消毒・見舞いなど ${fmtYen(cost)}）${viol.has('haccp') ? '。衛生管理の計画と記録がなかったことも指摘されました' : ''}`, 'bad');
    L.inspNext = Object.assign(L.inspNext || {}, { health: 1 });
  }
  if (G.ind === 'it' && chance(0.004 * (viol.has('privacy') ? 4 : 1))) {
    const cost = niceAmount(uni(300e4, 900e4));
    ksPayCash('misc', cost, 'law_leak');
    G.op.rep = clamp(G.op.rep - 0.05, 0.7, 1.3);
    ksNews(`【情報漏えい】不正アクセスで、取引先から預かった顧客データ約${randInt(2, 30) * 1000}件が漏えいしたおそれ。個人情報保護委員会に報告し、本人に通知しました（調査・お詫びなど ${fmtYen(cost)}）`, 'bad');
    L.inspNext = Object.assign(L.inspNext || {}, { ppc: viol.has('privacy') ? 0.8 : 0.3 });
  }
  if (G.ind === 'con' && viol.has('kyoka') && !L.kyokaLost) { L.kyokaLost = true; ksNews('建設業の許可の期限が切れました。更新するまで、500万円以上の工事を請け負えません', 'bad'); }
  if (G.ind === 'con' && !viol.has('kyoka')) L.kyokaLost = false;
  // 労働者からの申告（相談）：残業代・最低賃金・長時間労働・年休
  for (const v of ['unpaid', 'minwage', 'otmax', 'yukyu', 'r36']) {
    if (!viol.has(v) || !LAW_ITEMS[v].compl) continue;
    if (chance(LAW_ITEMS[v].compl * Math.max(1, ksHeadcount() / 20))) { L.inspNext = Object.assign(L.inspNext || {}, { labor: 0.85 }); L.complaint = v; break; }
  }
}
/* 建設業の許可が切れている間は、500万円以上の見積依頼に応えられない */
if (typeof KS_ENGINE !== 'undefined' && KS_ENGINE.con) {
  const ksConNext0 = KS_ENGINE.con.next;
  KS_ENGINE.con.next = function () { ksConNext0.call(this); if (G.law && G.law.kyokaLost && G.op.bids) G.op.bids = G.op.bids.filter(b => b.est * (1 + b.margin) < 500e4); };
}

/* ---------- 立入検査 ---------- */
const KS_INSP_P = { labor: 0.011, fire: 0.012, health: 0.012, police: 0.006, ppc: 0 };
function ksLawInspections(viol) {
  const L = G.law;
  const nx = L.inspNext || {};
  L.inspNext = {};
  for (const ag of ['labor', 'fire', 'health', 'police', 'ppc']) {
    if (ag === 'health' && G.ind !== 'food' && G.ind !== 'ret') continue;
    if (ag === 'police' && G.ind !== 'whl') continue;
    if (ag === 'ppc' && G.ind !== 'it') continue;
    if (L.insp.some(x => x.ag === ag && x.status === 'open')) continue;
    let p = KS_INSP_P[ag];
    if (ag === 'fire' && (G.ind === 'ret' || G.ind === 'food')) p = 0.028;
    p = Math.max(p, nx[ag] || 0);
    if (!chance(p)) continue;
    const kind = ag === 'labor' ? (L.complaint ? '申告監督' : nx.labor >= 0.3 ? '災害時監督' : '定期監督') : ag === 'fire' ? '立入検査' : ag === 'health' ? '立入検査' : ag === 'police' ? '立入検査' : '報告徴収';
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
  const t = KS_LAW_TASKS.find(x => x.item === item);
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
