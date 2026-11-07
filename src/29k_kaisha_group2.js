'use strict';
/* =========================================================
 *  29k_kaisha_group2.js : グループの再編（エンジン）
 *   ・商号の変更（親会社・子会社・孫会社）
 *   ・持分の買い増し（合弁・買収した会社の残りの株を買う。株式交換で完全子会社にする）
 *     関連会社（持分法）の株を買い増して50%を超えると、連結子会社になる（段階取得）
 *   ・傘下に移す（中間持株会社をつくる：子会社の株式を別の100%子会社に現物出資する）
 *   ・合併（子会社を持ち主に吸収する・兄弟の子会社どうしを合併する。効力発生日は期首の4月1日）
 * ========================================================= */

/* ---------- 商号の変更 ---------- */
function ksRenameCost(st) {
  const head = ksWith(st, ksHeadcount);
  const sites = ksWith(st, () => ksActiveUnits().length);
  // 登録免許税3万円・司法書士の報酬・看板・名刺・印鑑・ウェブ・取引先への通知
  return { reg: 3e4, fee: 3e4, signs: Math.round((20e4 + head * 5000 + sites * 15e4) / 1e4) * 1e4 };
}
function ksGroupRename(id, name) {
  const root = ksRoot();
  name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const s = id && id !== 'root' ? ksSubById(id, root) : null;
  if (id && id !== 'root' && (!s || s.gone)) return { ok: false, why: '会社がありません' };
  const st = s ? s.st : root;
  const word = KS_FORMS[ksForm(st)].pre;
  if (name.replace(word, '').trim().length < 1) return { ok: false, why: '社名を入れてください' };
  if (!name.includes(word)) return { ok: false, why: `商号には会社の種類（「${word}」）を入れます（会社法6条）` };
  if (name === st.coName) return { ok: false, why: '今と同じ社名です' };
  if ([root, ...ksSubs(root).map(x => x.st)].some(x => x !== st && x.coName === name)) return { ok: false, why: 'グループの中に同じ社名の会社があります' };
  const c = ksRenameCost(st);
  const total = c.reg + c.fee + c.signs;
  if (ksWith(st, () => ksB('cash')) < total) return { ok: false, why: '現預金が足りません' };
  const old = st.coName;
  ksWith(st, () => ksPost('rename', [['dues', c.reg, 0], ['fees', c.fee, 0], ['ads', c.signs, 0], ['cash', 0, total]], { u: 'HQ', cf: 'exp', desc: `商号の変更（${old}→${name}）：変更の登記・看板・名刺など` }));
  st.coNameOld = old;
  st.coName = name;
  if (s) s.name = name;
  for (const x of ksSubs(root)) if (ksRecOwnerId(x) === (s ? s.id : 'root')) x.st.parentName = name;
  ksWith(root, () => ksNews(`商号を変更しました：${old} → ${name}（株主総会の特別決議で定款を変え、2週間以内に変更の登記。費用 ${fmtYen(total)}）`, 'info'));
  return { ok: true, total };
}

/* ---------- 持分の買い増し（追加取得・段階取得・株式交換） ---------- */
/* 見込み：toOwn までの株を買う値段と、連結の処理 */
function ksBuyMoreQuote(id, toOwn) {
  const root = ksRoot();
  const s = ksSubById(id, root);
  if (!s || s.gone) return { ok: false, why: '会社がありません' };
  if (s.own >= 0.9999) return { ok: false, why: 'すでに100%の株を持っています' };
  toOwn = clamp(+toOwn, s.own + 0.005, 1);
  const d = toOwn - s.own;
  const fair = Math.max(1, ksSubValue(s));
  const control = s.aff && toOwn > 0.5;
  const price = niceAmount(fair * d * (control ? 1.15 : 1.05)); // 支配権がつくときは上乗せ（コントロール・プレミアム）
  const owner = ksOwnerSt(s, root);
  return { ok: !!owner, why: owner ? '' : '株式を持つ会社がありません', s, toOwn, d, fair, price, control, owner, exchangeOK: owner === root && ksForm(root) === 'kk' && toOwn >= 0.9999 };
}
/* o.exchange：株式交換（親会社の新しい株式を渡す。現金は要らない。親会社が株式会社のときだけ） */
function ksGroupBuyMore(id, toOwn, o = {}) {
  const root = ksRoot(), g = root.group;
  ksGroupMigrate(root);
  if (root.closing) return { ok: false, why: '決算整理の途中です' };
  const q = ksBuyMoreQuote(id, toOwn);
  if (!q.ok) return q;
  const { s, owner, price } = q;
  const exch = !!o.exchange && q.exchangeOK;
  if (!exch && ksWith(owner, () => ksB('cash')) < price) return { ok: false, why: '現預金が足りません' };
  const t = root.m, fy = fyOf(t);
  const N = ksRecNow(s);
  const ownerId = ksRecOwnerId(s);
  const effOwner = ownerId === 'root' ? 1 : ksEffOwn(ksSubById(ownerId, root), root);
  const before = s.own;
  ksRecInv(s);
  ksWith(owner, () => ksPost(exch ? 'subExch' : 'subMore', [['subShares', price, 0], exch ? ['capSurplus', 0, price] : ['cash', 0, price]], { u: 'HQ', cf: exch ? 'equity' : 'capex', desc: exch ? `株式交換（${s.name}を完全子会社に。新しい株式を交付して資本準備金に）` : `${s.name}の株式の追加取得（持分${Math.round(before * 100)}%→${Math.round(q.toOwn * 100)}%）` }));
  let msg = '';
  if (s.aff && q.control) {
    // 段階取得：前から持っていた株を、支配を得た日の時価で測りなおし、差を損益にする。のれんは時価の合計と純資産の差
    const emvH = before * N.NAh + N.gwLeft;
    const fairPrev = Math.round(q.fair * before);
    const gain = Math.round(fairPrev - emvH);
    ksRecReopen(s, 'control');
    const gwNew = fairPrev + price - q.toOwn * N.NAtr;
    Object.assign(s, { aff: false, kind: 'acq', own: q.toOwn, since: t, eq0: N.NAtr, adds: 0, reTr: 0, gw: Math.max(0, Math.round(gwNew)), negGw: 0, negDone: true, gwCum: 0, gwFrom: t, gwLife: 10, fee: 0.005, inv: s.inv + price });
    if (q.toOwn >= 0.9999) s.partner = null;
    if (gain) g.cadj.push({ fy, m: t, owner: ownerId, id: s.id, t: '段階取得に係る差損益', why: `${s.name}を子会社にしたので、前から持っていた${Math.round(before * 100)}%の株を時価（${fmtYen(fairPrev)}）で測りなおし、持分法の額との差を損益にする（連結だけ）`, pl: gain >= 0 ? { exg: gain } : { exl: -gain } });
    if (gwNew < 0) g.cadj.push({ fy, m: t, owner: ownerId, id: s.id, t: '負ののれん発生益', why: `${s.name}の純資産の持分より安く支配を得た差`, pl: { exg: Math.round(-gwNew) } });
    msg = `持分法の関連会社から連結子会社になりました（段階取得の${gain >= 0 ? '差益' : '差損'} ${fmtYen(Math.abs(gain))}・のれん ${fmtYen(s.gw)}）`;
  } else if (s.aff) {
    // 持分法のまま：買い増した分の投資差額を加える
    const emvH = before * N.NAh + N.gwLeft;
    ksRecReopen(s, 'restake');
    const gwNew = emvH + price - q.toOwn * N.NAh;
    Object.assign(s, { own: q.toOwn, since: t, eq0: N.NAh, adds: 0, reTr: 0, gw: Math.max(0, Math.round(gwNew)), gwCum: 0, gwFrom: t, gwLife: 10, inv: s.inv + price });
    if (gwNew < 0) g.cadj.push({ fy, m: t, owner: ownerId, id: s.id, t: '持分法による投資利益（負ののれん相当額）', why: `${s.name}の純資産の持分より安く買い増した差`, pl: { noi: Math.round(-gwNew) } });
    msg = '持分法の関連会社のまま、持分が増えました';
  } else {
    // 連結子会社の追加取得：のれんは増やさず、非支配株主持分の減少との差を資本剰余金にする
    const capAdj = Math.round((q.d * ksRecEh(s, root) - price) * effOwner);
    const r = ksRecReopen(s, 'restake');
    Object.assign(s, { own: q.toOwn, since: t, eq0: N.NAh, adds: 0, reTr: 0, gw: r.gwRem, gwCum: 0, gwFrom: t, gwLife: Math.max(1, r.gwMonths) / 12, inv: s.inv + price });
    if (!r.gwMonths) s.gw = 0;
    if (q.toOwn >= 0.9999) { s.partner = null; if (s.kind === 'jv') s.kind = 'new'; }
    g.capAdj.push({ m: t, amt: capAdj, id: s.id });
    msg = `非支配株主持分の減少との差 ${fmtYen(Math.abs(capAdj))} は、連結では資本剰余金の${capAdj >= 0 ? '増加' : '減少'}`;
  }
  ksWith(root, () => ksNews(`${s.name}の株式を${exch ? '株式交換で' : `${fmtYen(price)}で`}買い増し、持分が${Math.round(before * 100)}%から${Math.round(q.toOwn * 100)}%になりました。${msg}`, 'good'));
  return { ok: true, price, exch };
}

/* ---------- 傘下に移す（中間持株会社） ---------- */
/* 移せる先：親会社、または実質100%の国内の連結子会社（自分と自分の下の会社は除く） */
function ksReparentTargets(id, root = ksRoot()) {
  const s = ksSubById(id, root);
  if (!s || s.gone) return [];
  const below = new Set([s.id, ...ksDescendants(s.id, root).map(x => x.id)]);
  const out = [];
  if (ksRecOwnerId(s) !== 'root') out.push({ id: 'root', n: root.coName });
  for (const x of ksCSubs(root)) if (!below.has(x.id) && x.id !== ksRecOwnerId(s) && (!x.cc || x.cc === 'jp') && ksEffOwn(x, root) >= 0.9999) out.push({ id: x.id, n: x.name });
  return out;
}
function ksGroupReparent(id, toId) {
  const root = ksRoot();
  ksGroupMigrate(root);
  if (root.closing) return { ok: false, why: '決算整理の途中です' };
  const s = ksSubById(id, root);
  if (!s || s.gone) return { ok: false, why: '会社がありません' };
  if (!ksReparentTargets(id, root).some(x => x.id === toId)) return { ok: false, why: 'その会社の下には移せません（移す先は実質100%の国内の子会社です）' };
  const fromId = ksRecOwnerId(s);
  if (fromId !== 'root' && ksEffOwn(ksSubById(fromId, root), root) < 0.9999) return { ok: false, why: '今の持ち主の会社にほかの株主がいるので、移せません' };
  const from = ksOwnerSt(s, root);
  const to = toId === 'root' ? root : ksSubById(toId, root).st;
  const inv = ksRecInv(s);
  if (fromId === 'root' && toId !== 'root' && ksRecOwnerId(ksSubById(toId, root)) === 'root') {
    // 親会社が、子会社の株式を移す先の子会社（親会社が直接持つ会社）に現物出資する（移す先の資本が増える）
    const t = ksSubById(toId, root);
    ksWith(root, () => ksPost('reorg', [['subShares', inv, 0], ['subShares', 0, inv]], { u: 'HQ', cf: 'other', desc: `${s.name}の株式を${t.name}に現物出資（${t.name}の株式に変わる）` }));
    ksWith(to, () => ksPost('reorgIn', [['subShares', inv, 0], ['capSurplus', 0, inv]], { u: 'HQ', cf: 'equity', desc: `親会社から${s.name}の株式の現物出資を受ける` }));
    t.adds += inv;
    t.inv = ksRecInv(t) + inv;
  } else {
    // 今の持ち主から、帳簿の価額で買い取る（孫会社の下へ移すときは、親会社からも買い取る）
    if (ksWith(to, () => ksB('cash')) < inv) return { ok: false, why: `${to.coName}の現預金が足りません（${fmtYen(inv)}が要ります）` };
    ksWith(to, () => ksPost('reorg', [['subShares', inv, 0], ['cash', 0, inv]], { u: 'HQ', cf: 'capex', desc: `${s.name}の株式をグループの会社から帳簿の価額で買い取る` }));
    ksWith(from, () => ksPost('reorg', [['cash', inv, 0], ['subShares', 0, inv]], { u: 'HQ', cf: 'capex', desc: `${s.name}の株式をグループの会社に帳簿の価額で譲る` }));
  }
  if (toId === 'root') delete s.parent; else s.parent = toId;
  s.st.parentName = to.coName;
  ksWith(root, () => ksNews(`${s.name}を${to.coName}の傘下に移しました（グループの中の再編なので、連結の損益は変わりません）`, 'info'));
  return { ok: true };
}

/* ---------- 合併（吸収合併）。効力発生日は期首（4月1日） ---------- */
/* 合併できるか：from を into に吸収させる。into は from の持ち主（'root' か子会社）か、同じ持ち主の兄弟の子会社 */
function ksMergerCheck(fromId, intoId, root = ksRoot()) {
  const c = ksSubById(fromId, root);
  if (!c || c.gone) return { ok: false, why: '会社がありません' };
  if (c.aff) return { ok: false, why: '関連会社は合併できません（先に株を買い増して子会社にします）' };
  if (c.own < 0.9999) return { ok: false, why: 'ほかの株主がいる会社は合併できません（先に残りの株を買って100%にします）' };
  if (c.cc && c.cc !== 'jp') return { ok: false, why: '海外の会社とは合併できません（国をまたぐ合併は日本の会社法ではできない）' };
  const ownerId = ksRecOwnerId(c);
  if (intoId === ownerId) return { ok: true, mode: 'up', c, O: ksOwnerSt(c, root) };
  const a = ksSubById(intoId, root);
  if (!a || a.gone || a.aff) return { ok: false, why: '合併する相手がありません' };
  if (ksRecOwnerId(a) !== ownerId) return { ok: false, why: '兄弟の子会社（同じ会社が持つ子会社）どうしだけが合併できます' };
  if (a.own < 0.9999) return { ok: false, why: '存続する会社にほかの株主がいるので、合併できません' };
  if (a.cc && a.cc !== 'jp') return { ok: false, why: '海外の会社とは合併できません' };
  return { ok: true, mode: 'sister', c, a, O: a.st };
}
function ksMergerEffM(root = ksRoot()) { let m = (fyOf(root.m) + 1) * 12; if (m - root.m < 2) m += 12; return m; }
const KS_MERGER_COST = { reg: 6e4, koukoku: 15e4, pro: 100e4 }; // 登記（存続・解散）・官報公告（債権者保護手続）・司法書士と会計の専門家
function ksGroupScheduleMerger(fromId, intoId) {
  const root = ksRoot(), g = root.group;
  ksGroupMigrate(root);
  const r = ksMergerCheck(fromId, intoId, root);
  if (!r.ok) return r;
  if (g.mergers.some(x => x.from === fromId || x.into === fromId || x.from === intoId)) return { ok: false, why: 'この会社の合併はもう予定されています' };
  const m = ksMergerEffM(root);
  const x = { id: 'M' + (++g.seq), from: fromId, into: intoId, mode: r.mode, m, at: root.m };
  g.mergers.push(x);
  const intoName = intoId === 'root' ? root.coName : ksSubById(intoId, root).name;
  ksWith(root, () => ksNews(`${r.c.name}を${intoName}に吸収合併する契約を結びました。株主総会の承認と債権者保護手続（官報に公告して1か月）を経て、${ymLabel(m)}1日に効力が生じます`, 'info'));
  return { ok: true, x };
}
function ksGroupCancelMerger(id) {
  const g = ksRoot().group;
  g.mergers = (g.mergers || []).filter(x => x.id !== id);
  return { ok: true };
}
/* 帳簿と事業を c から O へ移す。mode 'up'：O は c の株主（株式は消え、差は抱合せ株式消滅差損益）／'sister'：純資産の内訳を引き継ぐ */
function ksMergeBooks(c, O, mode, gw) {
  const C = c.st;
  const umap = {}, amap = {};
  const units = C.units.filter(u => !u.closedM);
  for (const u of units) umap[u.id] = 'U' + (++O.useq);
  const EQ = ['capital', 'capSurplus', 'legalRes', 're'];
  const lines = [];
  for (const k of KS_KEYS) {
    if (EQ.includes(k)) continue;
    const v = Math.round(C.bal[k] || 0);
    if (v) lines.push(ksDebitNature(k) === (v > 0) ? [k, Math.abs(v), 0] : [k, 0, Math.abs(v)]);
  }
  let gain = 0;
  if (mode === 'up') {
    if (gw.amt > 0) lines.push(['goodwill', gw.amt, 0]);
    lines.push(['subShares', 0, ksRecInv(c)]);
    const dr = sum(lines, l => l[1]), cr = sum(lines, l => l[2]);
    gain = dr - cr;
    if (gain > 0) lines.push(['mergeGain', 0, gain]); else if (gain < 0) lines.push(['mergeLoss', -gain, 0]);
  } else {
    for (const k of EQ) { const v = Math.round(C.bal[k] || 0); const kk = k === 'capital' ? 'capSurplus' : k; if (v) lines.push(v > 0 ? [kk, 0, v] : [kk, -v, 0]); }
  }
  ksWith(O, () => {
    ksPost('merge', lines, { u: 'HQ', cf: 'other', desc: `${C.coName}を吸収合併（資産・負債と事業を引き継ぐ）` });
    // 固定資産の台帳（今期の償却は合併の日から）
    for (const a of C.assets.filter(a => a.soldM === undefined)) {
      const b = Object.assign({}, a, { id: 'F' + (++G.seq), u: a.u && a.u !== 'HQ' ? (umap[a.u] || 'HQ') : a.u });
      if (!b.cip) b.depFrom = G.m;
      amap[a.id] = b.id;
      G.assets.push(b);
    }
    if (mode === 'up' && gw.amt > 0) ksNewAsset({ n: `のれん（${C.coName}との合併）`, acct: 'goodwill', cost: gw.amt, life: Math.max(1, gw.months) / 12, part: 'S', u: 'HQ', depFrom: G.m });
    for (const x of C.ar) G.ar.push(Object.assign({}, x, { u: umap[x.u] || x.u }));
    for (const x of C.ap) G.ap.push(Object.assign({}, x));
    for (const L of C.loans) {
      if (L.kind === 'od') {
        if (L.bal <= 0) continue;
        const mine = G.loans.find(y => y.kind === 'od' && y.bank === L.bank);
        if (mine) { mine.bal += L.bal; mine.limit = (mine.limit || 0) + (L.limit || 0); continue; }
      }
      G.loans.push(Object.assign({}, L, { id: 'L' + (++G.seq) }));
    }
    // 期首の再振替（未払費用・前払費用）
    if (C.reversal && C.reversal.u) {
      G.reversal = G.reversal || { u: {} };
      G.reversal.u = G.reversal.u || {};
      for (const [uid, rv] of Object.entries(C.reversal.u)) {
        const nid = umap[uid] || 'HQ';
        const t = G.reversal.u[nid] || (G.reversal.u[nid] = { labor: 0, welfare: 0, rent: 0 });
        t.labor += rv.labor || 0; t.welfare += rv.welfare || 0; t.rent += rv.rent || 0;
      }
    }
    // 事業（人員・取引先・設備の計画）と、法令・成長・拠点の記録
    for (const u of units) {
      const old = u.id, nid = umap[old];
      u.id = nid;
      if (G.loc && C.loc) { G.loc.units[nid] = C.loc.units[old] || C.loc.hq; G.loc.uhome = G.loc.uhome || {}; G.loc.uhome[nid] = (C.loc.uhome && C.loc.uhome[old]) || C.loc.home || C.loc.hq; }
      G.units.push(u);
      if (C.wfPrevU && C.wfPrevU[old]) { G.wfPrevU = G.wfPrevU || {}; G.wfPrevU[nid] = C.wfPrevU[old]; if (G.wfPrev) { G.wfPrev.labor += C.wfPrevU[old].labor || 0; G.wfPrev.salary += C.wfPrevU[old].salary || 0; } }
      if (C.law && G.law) for (const k of Object.keys(C.law.done)) if (k.endsWith(':' + old)) G.law.done[k.slice(0, -old.length) + nid] = C.law.done[k];
      if (C.grow && G.grow) {
        for (const [k, x] of Object.entries(C.grow.up || {})) if (x.u === old) G.grow.up[k.includes(old) ? k.split(old).join(nid) : `${k}_${nid}`] = Object.assign({}, x, { u: nid });
        if (C.grow.intl && C.grow.intl[old]) G.grow.intl[nid] = C.grow.intl[old];
        for (const q of C.grow.fxq || []) if (q.u === old) G.grow.fxq.push(Object.assign({}, q, { u: nid }));
      }
      if (typeof ksLawAddUnit === 'function') ksLawAddUnit(u);
    }
    // 自社の土地と建物
    if (G.loc && C.loc) for (const L of C.loc.lands || []) {
      const L2 = Object.assign({}, L, { id: 'D' + (++G.loc.seq), asset: amap[L.asset] || L.asset });
      if (L.bldg) L2.bldg = Object.assign({}, L.bldg, { asset: amap[L.bldg.asset] || L.bldg.asset, uid: L.bldg.uid ? umap[L.bldg.uid] || null : null });
      G.loc.lands.push(L2);
    }
    // 人と制度：満足度は人数の重みで合わせる。障害者雇用の人数も引き継ぐ
    if (G.hr && C.hr) {
      const hO = Math.max(1, ksHeadcount() - ksWith(C, ksHeadcount)), hC = ksWith(C, ksHeadcount);
      G.hr.es = Math.round((G.hr.es * hO + C.hr.es * hC) / Math.max(1, hO + hC) * 10) / 10;
      G.hr.dis = (G.hr.dis || 0) + (C.hr.dis || 0);
    }
  });
  return { gain, umap };
}
function ksGroupDoMergers() {
  const root = G, g = root.group;
  const due = (g.mergers || []).filter(x => x.m <= root.m);
  if (!due.length) return;
  g.mergers = g.mergers.filter(x => x.m > root.m);
  const fy = fyOf(root.m);
  for (const x of due) {
    const r = ksMergerCheck(x.from, x.into, root);
    const c = ksSubById(x.from, root);
    if (!r.ok || r.mode !== x.mode || (c && c.st.over)) { ksNews(`${c ? c.name : '会社'}の合併は、条件が変わったので取りやめました（${r.why || '会社の状態が変わった'}）`, 'bad'); continue; }
    const O = r.O;
    if (O.over) continue;
    const intoName = x.into === 'root' ? root.coName : ksSubById(x.into, root).name;
    // 合併の費用（存続する会社が払う）
    const cost = KS_MERGER_COST.reg + KS_MERGER_COST.koukoku + KS_MERGER_COST.pro;
    ksWith(O, () => ksPost('mergeFee', [['dues', KS_MERGER_COST.reg, 0], ['fees', KS_MERGER_COST.koukoku + KS_MERGER_COST.pro, 0], ['cash', 0, cost]], { u: 'HQ', cf: 'exp', desc: `${c.name}との合併の費用（登記・官報公告・専門家）` }));
    const life = Math.max(1, Math.round((c.gw ? (c.gwLife || 10) : 0) * 12));
    const gw = { amt: Math.max(0, Math.round((c.gw || 0) - (c.gwCum || 0))), months: Math.max(0, (c.gwFrom ?? c.since) + life - root.m) };
    if (!gw.months) gw.amt = 0;
    const lossCF = c.st.lossCF || 0;
    const qualified = ['new', 'split', 'hd'].includes(c.kind) || root.m - c.since >= 60;
    const res = ksMergeBooks(c, O, x.mode, gw);
    // 繰越欠損金：100%グループの適格合併で、支配から5年以上（または設立から）なら引き継げる
    if (lossCF > 0 && qualified) O.lossCF = (O.lossCF || 0) + lossCF;
    // 親会社からの貸付金：親会社が吸収したら消え、子会社が吸収したらその会社の借入になる
    for (const L of (g.loans || []).filter(y => y.sub === c.id)) {
      if (x.into === 'root' && x.mode === 'up') { const b = Math.round(L.bal); if (b > 0) ksWith(root, () => ksPost('mergeIc', [['icDebt', b, 0], ['icLoan', 0, b]], { u: 'HQ', cf: 'other', desc: `合併した${c.name}への貸付金と借入金が同じ会社の中になり消える（混同）` })); L.bal = 0; }
      else L.sub = x.into;
    }
    g.loans = (g.loans || []).filter(y => y.bal > 0);
    // 下の会社（孫会社）は、存続する会社の子会社になる
    for (const y of ksSubs(root)) if (y.parent === c.id) { if (x.mode === 'up' && x.into === 'root') delete y.parent; else y.parent = x.into; y.st.parentName = O.coName; }
    if (x.mode === 'up') {
      if (res.gain) g.cadj.push({ fy, m: root.m, owner: x.into, id: c.id, t: '抱合せ株式消滅差損益の消去', why: `${c.name}を吸収したときの${res.gain >= 0 ? '差益' : '差損'}は、${c.name}の取得の後の利益をすでに連結に取り込んでいるので消す`, pl: res.gain >= 0 ? { exg: -res.gain } : { exl: res.gain } });
    } else {
      // 兄弟の合併：存続する会社の記録に、消える会社の資本と取得の後の利益・のれんを足す
      const a = r.a;
      const lifeA = Math.max(1, Math.round((a.gw ? (a.gwLife || 10) : 0) * 12));
      const remA = Math.max(0, Math.round((a.gw || 0) - (a.gwCum || 0))), monA = Math.max(0, (a.gwFrom ?? a.since) + lifeA - root.m);
      const gwT = (monA ? remA : 0) + gw.amt;
      const mon = gwT ? Math.round(((monA ? remA : 0) * monA + gw.amt * gw.months) / gwT) : 0;
      Object.assign(a, { eq0: a.eq0 + c.eq0 + c.adds + c.reTr, inv: ksRecInv(a) + ksRecInv(c), gw: gwT, gwCum: 0, gwFrom: root.m, gwLife: Math.max(1, mon) / 12 });
      if (!gwT) a.gw = 0;
    }
    ksRecClose(c, 'merged', { into: x.into });
    c.st = null;
    ksNews(`${intoName}が${c.name}を吸収合併しました（効力発生日 ${ymLabel(root.m)}1日）。${c.name}の事業・従業員・資産と負債は${intoName}に引き継がれ、${c.name}は解散しました${x.mode === 'up' && res.gain ? `。抱合せ株式消滅${res.gain >= 0 ? '差益' : '差損'} ${fmtYen(Math.abs(res.gain))}（個別の決算の特別損益。連結では消す）` : ''}`, 'good');
  }
}
/* 期首（4月）になったら、予定の合併を行う（親会社の決算が終わり、連結決算をつくった後） */
const ksNextMonthG0 = ksNextMonth;
ksNextMonth = function () {
  ksNextMonthG0();
  if (G && !G.isSub && !G.hist && G.group && (G.group.mergers || []).some(x => x.m <= G.m)) ksGroupDoMergers();
};
