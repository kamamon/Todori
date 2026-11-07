'use strict';
/* =========================================================
 *  29m_kaisha_startgroup.js : 就任の時点のグループ（始め方の画面で決める子会社・孫会社・関連会社）
 *   ・国内で事業のある会社：先代のころからの会社として、過去4期分の決算書と帳簿つきでつくる
 *   ・事業のない国内の会社（中間持株会社）と海外の会社：就任の時に設立したばかりの会社
 *   ・持ち主（親会社・子会社）は、その会社の株式を、就任の時点の純資産の持分の額で持つ
 *     （株主から株式の現物出資を受けた形：関係会社株式／資本準備金）。のれんは出ない
 *   ・下の会社から順に（孫会社 → 子会社 → 親会社）記帳するので、子会社の純資産には孫会社の株式が入る
 *   ・会社の数・深さ・事業の数に上限はない
 *   （画面は 29n_kaisha_startgroup_ui.js）
 * ========================================================= */

/* 1社の設定（金額は円。0・空は「そのまま」または自動）
 *   { id, name, owner: 'root'｜'u:業種'（持株会社で始めるときの事業会社）｜ほかの会社の id,
 *     own, cc, pref（0なら親会社と同じ）, units: [{ type, sc }], cond, capital, cash, debt（null なら そのまま） } */
const KS_SG_OWNS = [1, 0.8, 0.6, 0.51, 0.49, 0.4, 0.3, 0.2];
const KS_SG_SCALES = [0.5, 1, 2, 4];
/* 下に会社を持てるか（国内の連結子会社だけ。ゲームの中の設立と同じ決まり） */
function ksSgCanOwn(e) { return !!e && (e.cc || 'jp') === 'jp' && +e.own > 0.5; }
/* 事業が要るか（国内の連結子会社は、事業がなくても中間持株会社として持てる） */
function ksSgNeedsUnit(e) { return !ksSgCanOwn(e); }
function ksSgUnits(e) {
  const seen = new Set();
  return ((e && e.units) || []).filter(x => x && KS_TYPES[x.type] && !seen.has(x.type) && seen.add(x.type)).map(x => ({ type: x.type, sc: KS_SG_SCALES.includes(+x.sc) ? +x.sc : 1 }));
}
function ksSgIsU(id) { return typeof id === 'string' && id.startsWith('u:'); }
/* 持ち主を直す：持てない会社（関連会社・海外）・なくなった会社・自分の下の会社が持ち主なら、上にたどる（なければ親会社） */
function ksSgNormalize(list, uKeys = new Set()) {
  const byId = new Map(list.map(e => [e.id, e]));
  const reaches = (from, target) => {
    for (let p = from, n = 0; p && p !== 'root' && !ksSgIsU(p) && n <= list.length; n++) {
      if (p === target) return true;
      const q = byId.get(p);
      p = q ? q.owner : null;
    }
    return false;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (const e of list) {
      let oid = e.owner || 'root';
      const seen = new Set([e.id]);
      while (oid !== 'root') {
        if (ksSgIsU(oid)) { if (!uKeys.has(oid)) oid = 'root'; break; }
        const o = byId.get(oid);
        if (!o || seen.has(oid)) { oid = 'root'; break; }
        if (ksSgCanOwn(o) && !reaches(o.owner, e.id)) break;
        seen.add(oid);
        oid = o.owner || 'root';
      }
      e.owner = oid;
    }
  }
  return list;
}
/* 親会社から数えた深さ（親会社の直下 0・その下 1…。持株会社の事業会社の下は 1 から） */
function ksSgDepth(e, byId) {
  let d = 0;
  for (let p = e.owner, n = 0; p && p !== 'root' && n <= byId.size + 1; n++) {
    d++;
    if (ksSgIsU(p)) break;
    const q = byId.get(p);
    if (!q) break;
    p = q.owner;
  }
  return d;
}
/* 木の順（親の次にその下の会社）に並べる：[{ e, depth }] */
function ksSgTree(list, tops = ['root']) {
  const out = [];
  const kids = new Map();
  for (const e of list) { const k = e.owner || 'root'; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(e); }
  const walk = (pid, d) => { for (const e of kids.get(pid) || []) { if (out.some(x => x.e === e)) continue; out.push({ e, depth: d }); walk(e.id, d + 1); } };
  for (const t of tops) walk(t, ksSgIsU(t) ? 1 : 0);
  for (const e of list) if (!out.some(x => x.e === e)) out.push({ e, depth: 0 }); // 念のため（持ち主の見つからない会社）
  return out;
}
/* 社名：国内の会社は会社の種類（株式会社など）を入れる */
function ksSgFixName(name, cc) {
  let n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!n) return '';
  if ((cc || 'jp') === 'jp' && !/株式会社|合同会社|有限会社/.test(n)) n += '株式会社';
  return n;
}
function ksSgAutoName(e, used) {
  const us = ksSgUnits(e);
  const S = us.length ? KS_TYPES[us[0].type] : null;
  let core = S ? (KS_CO_CORE[S.eng] || []).filter(x => x !== 'ホールディングス') : ['ホールディングス', 'グループ', '興産', '開発'];
  if (!core.length) core = ['産業'];
  const C = (e.cc || 'jp') !== 'jp' && typeof KS_COUNTRIES !== 'undefined' ? KS_COUNTRIES[e.cc] : null;
  const mk = b => (C ? `${ksCityBase()}${b}${C.n}` : `${ksCityBase()}${b}株式会社`);
  for (const b of [pick(core), ...core]) if (!used.has(mk(b))) return mk(b);
  for (const x of ['第二', '東日本', '西日本', '北', '南', '中央', 'ネクスト', '新']) for (const b of core) if (!used.has(mk(x + b))) return mk(x + b);
  for (let i = 2; i < 1e5; i++) if (!used.has(mk(core[0] + i))) return mk(core[0] + i);
  return mk(core[0]);
}
function ksSgCeo() { return `${pick(['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'])} ${pick(['健', '誠', '茂', '洋子', '直美', '修', '恵', '隆', '和也', '真理'])}`; }
/* 設定をそろえる（画面から来た値・セーブの値のどちらでも） */
function ksSgClean(e) {
  const cc = e.cc && e.cc !== 'jp' && typeof KS_COUNTRIES !== 'undefined' && KS_COUNTRIES[e.cc] ? e.cc : 'jp';
  const num = v => (Number.isFinite(+v) && +v > 0 ? Math.round(+v) : 0);
  const debt = e.debt === null || e.debt === undefined || e.debt === '' || !Number.isFinite(+e.debt) ? null : Math.max(0, Math.round(+e.debt));
  return { id: String(e.id), name: e.name || '', owner: e.owner || 'root', own: clamp(+e.own || 1, 0.2, 1), cc, pref: typeof KS_PREFS !== 'undefined' && KS_PREFS[+e.pref] ? +e.pref : 0, units: ksSgUnits(e), cond: KS_COND[e.cond] ? e.cond : 'normal', capital: num(e.capital), cash: num(e.cash), debt };
}
/* 持ち主の会社の受け入れた株式の分だけ、その会社の記録（取得の額）を増やし、さらに上の持ち主の帳簿にも記帳する（すでにある記録が持ち主のとき） */
function ksSgBump(id, delta, root) {
  for (let s = ksSubById(id, root), n = 0; s && delta > 0 && n < 1000; n++) {
    ksRecInv(s);
    s.eq0 += delta;
    const d = Math.round(s.own * delta);
    s.inv += d;
    const ost = ksOwnerSt(s, root);
    if (!ost || d <= 0) break;
    ksWith(ost, () => ksPost('startSub', [['subShares', d, 0], ['capSurplus', 0, d]], { u: 'HQ', desc: `就任の時点のグループ：${s.name}が受け入れた株式の分の、${s.name}の株式の増加（現物出資）` }));
    delta = d;
    s = s.parent ? ksSubById(s.parent, root) : null;
  }
}

/* 就任の時点のグループをつくる（G は親会社。就任の処理の最後に呼ぶ）
 *   umap：持株会社で始めるときの、事業ごとの子会社（'u:業種' → 記録の id） */
function ksStartGroupBuild(raw, umap = {}) {
  const root = G;
  if (!root || root.isSub || !Array.isArray(raw) || !raw.length) return null;
  ksGroupInit();
  const g = root.group;
  ksGroupMigrate(root);
  const uKeys = new Set(Object.keys(umap));
  let list = ksSgNormalize(raw.filter(e => e && e.id !== undefined && e.id !== null).map(ksSgClean), uKeys);
  // 事業のない海外の会社・関連会社はつくらない（下に会社を持てないので、ほかの会社には影響しない）
  list = list.filter(e => e.units.length || !ksSgNeedsUnit(e));
  if (!list.length) return null;
  const byId = new Map(list.map(e => [e.id, e]));
  const order = ksSgTree(list, ['root', ...uKeys]).map(x => x.e);
  for (const e of order) e.depth = ksSgDepth(e, byId);
  // 社名（入れた名前を先に。グループの中で同じ名前にならないように）
  const used = new Set([root.coName, ...g.subs.map(s => s.name)]);
  for (const e of order) { const n = ksSgFixName(e.name, e.cc); e.name = n && !used.has(n) ? n : ''; if (e.name) used.add(e.name); }
  for (const e of order) if (!e.name) { e.name = ksSgAutoName(e, used); used.add(e.name); }
  const pref0 = root.loc ? root.loc.hq : KS_HOME_PREF;
  const seed0 = root.seed | 0;
  // 1) 会社をつくる（上の会社から）
  const made = new Map();
  order.forEach((e, i) => {
    const id = 'S' + (++g.seq);
    const seed = (seed0 + 104729 * (i + 1) + 13) | 0;
    const ceo = ksSgCeo();
    const hist = e.cc === 'jp' && e.units.length > 0;
    let st;
    if (hist) {
      // 先代のころからの会社（過去4期分の決算書と帳簿）
      G = null;
      try { ksNewGame({ units: e.units, coName: e.name, ceo, seed, cond: e.cond, term: 0, asSub: true, pref: e.pref || pref0 }); st = G; } finally { G = root; }
      st.isSub = true; st.subId = id; st.termYears = 0; st.news = []; st.pendingModals = [];
      st.eco = JSON.parse(JSON.stringify(root.eco));
      if (e.capital || e.cash || e.debt !== null) ksWith(st, () => ksCustomApply({ custom: { capital: e.capital, cash: e.cash, debt: e.debt } }));
    } else {
      // 就任の時に設立したばかりの会社（海外の会社・事業のない中間持株会社）。現預金は、立ち上げの設備を買った後の額
      const plans = e.units.map(x => ksSubStartPlan(x.type, x.sc)).filter(Boolean);
      const capex = sum(plans, p => p.capex);
      const left = e.cash > 0 ? e.cash : plans.length ? sum(plans, p => p.work) : 5e7;
      const total = Math.round((capex + left) / 1e4) * 1e4;
      const capital = Math.min(total, e.capital > 0 ? e.capital : clamp(Math.round(total / 2 / 1e7) * 1e7, 1e7, 1e8));
      st = ksFreshCompany({ coName: e.name, ceo, cash: total, capital, seed, cc: e.cc, pref: e.pref || pref0, subId: id, execPay: clamp(Math.round(total / 400 / 1e4) * 1e4, 40e4, 150e4) });
      ksWith(st, () => {
        for (const x of e.units) ksSubStartUnit(x.type, x.sc);
        if (e.debt > 0) ksCustomApply({ custom: { debt: e.debt } });
        ksSetODLimit();
        ksBudgetDraft(); ksBudgetApprove(true);
      });
    }
    ksGroupTrim(st);
    made.set(e.id, { e, st, id, hist });
  });
  // 2) 下の会社から順に、持ち主の帳簿に株式を記帳し、記録をつくる
  const ownerIdOf = e => (e.owner === 'root' ? 'root' : ksSgIsU(e.owner) ? umap[e.owner] : made.get(e.owner).id);
  const stOf = oid => {
    if (oid === 'root') return root;
    for (const x of made.values()) if (x.id === oid) return x.st;
    const s = ksSubById(oid, root);
    return s ? s.st : root;
  };
  const recs = new Map();
  for (const e of order.slice().sort((a, b) => b.depth - a.depth)) {
    const x = made.get(e.id), st = x.st;
    let eq = Math.round(ksWith(st, () => ksEquity() - ksMonthPLNow()));
    if (eq <= 0) {
      const add = Math.round((1e7 - eq) / 1e5) * 1e5;
      ksWith(st, () => ksPost('custCash', [['cash', add, 0], ['capSurplus', 0, add]], { u: 'HQ', cf: 'equity', desc: '債務超過を解消するための株主の出資（資本準備金）' }));
      eq += add;
    }
    const aff = e.own <= 0.5;
    const inv = Math.round(e.own * eq);
    const oid = ownerIdOf(e);
    const ownerSt = stOf(oid);
    ksWith(ownerSt, () => ksPost('startSub', [['subShares', inv, 0], ['capSurplus', 0, inv]], { u: 'HQ', desc: `就任の時点のグループ：${st.coName}の株式（持分${Math.round(e.own * 100)}%・純資産 ${fmtYen(eq)}の持分の額）を、株主からの現物出資として受け入れた` }));
    // 持株会社の事業会社（すでにある記録）が持ち主なら、その会社の記録と、上の持ち主の帳簿も増やす
    if (ksSgIsU(e.owner) && oid) ksSgBump(oid, inv, root);
    const cc = e.cc;
    const fx0 = cc === 'jp' ? 1 : ksFxNow(ksCurOf(cc), root.eco);
    const partner = e.own < 1 ? `${pick(CO_PREFIX)}${pick(['商事', '物産', '産業', 'ホールディングス'])}` : null;
    const rec = { id: x.id, st, own: e.own, kind: 'start', since: root.m, eq0: eq, adds: 0, reTr: 0, gw: 0, gwCum: 0, cc, fx0, fee: aff || e.own < 1 ? 0 : 0.01, payout: 0.3, auto: true, name: st.coName, partner, inv, aff, fresh: !x.hist };
    if (oid !== 'root') rec.parent = oid;
    st.parentName = ownerSt.coName;
    recs.set(e.id, rec);
  }
  for (const e of order) g.subs.push(recs.get(e.id));
  ksGroupMigrate(root);
  ksSetODLimit();
  ksBudgetDraft(); ksBudgetApprove(true);
  const all = order.map(e => recs.get(e.id));
  const nC = all.filter(s => !s.aff).length, nA = all.length - nC, deep = all.filter(s => s.parent).length;
  const txt = `${nC ? `子会社${nC}社` : ''}${nC && nA ? '・' : ''}${nA ? `関連会社${nA}社` : ''}${deep ? `（うち、子会社の下の会社${deep}社）` : ''}`;
  root.customNote = [root.customNote, `グループ：${txt}`].filter(Boolean).join('・');
  ksNews(`就任の時点のグループ：${txt}。各社の株式は、就任の時点の純資産の持分の額で記帳しました`, 'info');
  return all;
}
