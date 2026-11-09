'use strict';
/* =========================================================
 *  42c_fd_life.js : 創業記モードの始まりと出来事（画面に依存しない）
 *   新しいゲーム、時代の出来事（実際の年に起きる）と、選ぶ出来事、偶然の出来事、
 *   人（幹部の入社・引退・後継者）、節目、終わり、保存、整合性の確認、自動の運営（番頭に任せる）
 * ========================================================= */

/* ---------- 新しいゲーム ---------- */
function fdNewGame(o) {
  const seed = (o.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0;
  const S = FD_SCEN[o.scen];
  const st = S.start;
  G = {
    mode: 'sogyo', version: FD_SAVE_VERSION, rs: seed, seed, scen: o.scen, diff: o.diff || 'normal',
    co: o.coName || st.coName, founder: o.founder || st.founder, y0: st.y0, q: 0, endY: o.endY || 2025,
    bs: fdNewBooks(), yr: { y: st.y0, pl: fdNewPL() }, qr: { pl: fdNewPL() }, assets: [], loans: [], bank: { n: st.bank || '第一銀行', years: 0, trust: 1 },
    owners: { founder: st.own ? st.own.founder : 1, parent: st.own ? st.own.parent : 0, outside: 0 }, listed: false, shares: 0,
    prods: [], devs: [], gen: {}, cum: {}, tech: {}, lics: [], facs: [], reg: {}, staff: { wk: 0, eng: 0, sal: 0, adm: 0 }, skill: { eng: 1 },
    people: [], ceo: null, org: { st: 0, fixed: {} }, prog: {}, kaizen: 0, qc: 0, policy: { wage: 0, mkt: 1, div: 0.25, autoStaff: true, autoRd: true, noLayoff: true },
    mk: {}, rv: {}, mods: [], ev: { done: {}, last: {} }, news: [], chron: [], miles: {}, hq: [], hy: [], flags: {}, pendingModals: [], seq: 0, over: null, crisis: 0,
    orders: [], gw: [], union: null, zaitech: null, blocked: 0, taxFreeUntil: 0,
  };
  if (G.diff === 'easy') G.policy.mkt = 1.5;
  // 技術
  for (const [f, F] of Object.entries(S.fields)) G.tech[f] = { t: st.tech[f] ?? null, a: st.techA ? st.techA[f] || 0 : 0 };
  // 地域
  for (const r of fdRegOrder()) G.reg[r] = { st: 0, brand: r === 'jp' ? st.brand || 12 : 4, dist: 0, since: null };
  G.reg.jp.st = st.jpSt ?? 1; G.reg.jp.dist = FD_STAGES_JP[G.reg.jp.st].dist * 0.6; G.reg.jp.since = -8;
  // ライバルのばらつき（ゲームごと）
  for (const [c, C] of Object.entries(S.cats)) for (const rv of C.rivals || []) G.rv[c + ':' + rv.id] = { dq: Math.round(randn() * 12) / 10, dp: Math.round(randn() * 3) / 100, alive: true };
  // お金（今の価値で決めてある元手を、その年の円に）
  const y = fdYf(0);
  const cash = fdNominal(st.cash * (G.diff === 'easy' ? 1.5 : G.diff === 'hard' ? 0.7 : 1), y);
  G.bs.cash = cash; G.bs.cap = cash;
  // 人
  const ceo = fdNewPerson('ceo', { n: G.founder, born: st.y0 - (st.age || 36), abil: st.ceoAbil || { tech: 5, lead: 4, prod: 3, sales: 2, fin: 2 }, trait: st.trait || 'pioneer', founder: true });
  G.ceo = ceo.id;
  for (const p of st.people || []) fdNewPerson(p.role, Object.assign({ born: st.y0 - (p.age || 35) }, p));
  Object.assign(G.staff, { eng: st.staff.eng, sal: st.staff.sal, adm: st.staff.adm });
  // 工場
  for (const fo of st.facs || []) {
    const r = fdBuildFac('jp', fo.loc, { n: fo.n, free: true, now: true, quiet: true }).f;
    r.skill = fo.skill || 1;
    for (const l of fo.lines) { fdAddLine(r.id, l.cat, l.cap, { free: true, now: true }); }
    // 元からある建物と機械は資産として持っている（元手から出したことにする）
    const v = fdNominal(fo.value || 3e7, y);
    fdNewAsset({ n: `${r.n}の建物と機械`, cost: v, life: 25, f: r.id, kind: 'bld' });
    G.bs.cap += v;
    r.wk = fo.wk || st.staff.wk || 10;
  }
  G.staff.wk = sum(G.facs, f => f.wk || 0);
  // 初めの製品・開発
  for (const po of st.prods || []) {
    const p = { id: 'P' + (++G.seq), cat: po.cat, name: po.n, gen: 1, qy: po.qy, q0: -4, pr: po.pr || 100, stock: 0, stockCost: 0, cum: 0, sold: 0, want: 0, made: 0, def: 0.06, active: true, plan: { mode: 'auto', qty: 0 }, ban: [] };
    p.spec = fdCat(po.cat).spec ? fdCat(po.cat).spec(po.qy, y) : '';
    G.gen[po.cat] = 1; G.miles['cat_' + po.cat] = -4;
    G.prods.push(p);
  }
  for (const d of st.devs || []) { const r = fdStartDev(d.cat, { n: d.n }); if (r.ok) r.d.prog = r.d.need * (d.prog || 0); }
  if (st.prog) Object.assign(G.prog, st.prog);
  G.news = [];
  fdChron(`${fdWareki(st.y0)}（${st.y0}年）、${st.place}で${G.founder}が${st.what}`, true);
  fdNews(`${G.founder}、${st.place}で${st.what}。「${G.co}」の歩みが始まる`, 'info');
  if (S.init) S.init();
  fdAutoRd();
  return G;
}

/* ---------- 時代の出来事 ---------- */
/* 実際の年・四半期に起きる出来事（世界と日本の歴史 FD_EVENTS と、シナリオの物語） */
function fdEventList() { return FD_EVENTS.concat(fdS().events || []); }
function fdFireEvents() {
  for (const E of fdEventList()) {
    if (G.ev.done[E.id]) continue;
    if (E.y !== undefined && (fdY() !== E.y || fdQo() !== (E.q || 0))) continue;
    if (E.y === undefined && !(E.when && E.when())) continue;
    if (E.need && !E.need()) { if (E.y !== undefined) G.ev.done[E.id] = G.q; continue; }
    G.ev.done[E.id] = G.q;
    if (E.fx) E.fx();
    if (E.t) { fdNews(`【${E.tag || '出来事'}】${E.t}`, E.k || 'info'); if (E.chron !== false) fdChron(E.t, !!E.big); }
    if (E.ch || E.show) G.pendingModals.push({ type: 'fdEvent', id: E.id });
  }
}
function fdEventById(id) { return fdEventList().concat(FD_RANDOM).find(E => E.id === id); }
/* 選ぶ出来事の選択（i 番目）。結果の文を返す */
function fdChoose(id, i) {
  const E = fdEventById(id);
  if (!E || !E.ch) return '';
  const C = E.ch[i];
  if (!C) return '';
  if (C.can && !C.can()) return C.cant || 'いまはこれを選べません';
  G.ev.last[id] = i;
  const r = C.fx ? C.fx() : '';
  if (C.chron) fdChron(C.chron, !!C.big);
  return r || C.res || '';
}
/* 偶然の出来事（四半期に1つまで） */
function fdRandomEvents() {
  if (G.q < 2) return;
  const cand = FD_RANDOM.filter(E => (!E.from || fdY() >= E.from) && (!E.to || fdY() <= E.to) && (!E.cool || !G.ev.done[E.id] || G.q - G.ev.done[E.id] >= E.cool) && (!E.need || E.need()));
  for (const E of cand) {
    if (!chance(typeof E.p === 'function' ? E.p() : E.p)) continue;
    G.ev.done[E.id] = G.q;
    const t = typeof E.t === 'function' ? E.t() : E.t;
    if (E.fx) E.fx();
    if (t) fdNews(t, E.k || 'info');
    if (E.ch || E.show) G.pendingModals.push({ type: 'fdEvent', id: E.id, t });
    break;
  }
}

/* ---------- 人 ---------- */
function fdPeopleQuarter() {
  if (fdQo() !== 0) return;
  const y = fdY();
  for (const p of G.people) {
    if (p.gone) continue;
    const age = fdAge(p, y);
    // 亡くなる確率（年）：60歳から上がる
    const pd = age < 55 ? 0.003 : age < 65 ? 0.012 : age < 75 ? 0.035 : age < 85 ? 0.09 : 0.2;
    if (chance(pd * (y < 1950 ? 1.4 : 1))) { fdPersonGone(p, 'death'); continue; }
    if (p.role !== 'ceo' && age >= (p.retire || 63) && chance(0.6)) { fdPersonGone(p, 'retire'); continue; }
    if (p.role === 'ceo' && age >= 72 && !G.flags.succAsked && chance(0.35)) { G.flags.succAsked = G.q; G.pendingModals.push({ type: 'fdSucc', why: 'age' }); }
  }
  // 空いた役職には、そのうち人が来る（候補が現れる）
  for (const role of ['cto', 'coo', 'cso', 'cfo']) if (!fdPeopleIn(role).length && chance(0.5)) {
    const p = fdNewPerson(role);
    fdNews(`${p.n}が${FD_ROLE_N[role]}に就きました（${fdAge(p)}歳）`, 'info');
  }
}
function fdPersonGone(p, why) {
  p.gone = G.q; p.why = why;
  const t = why === 'death' ? `${FD_ROLE_N[p.role] || ''}の${p.n}が亡くなりました（${fdAge(p)}歳）` : `${FD_ROLE_N[p.role] || ''}の${p.n}が引退しました（${fdAge(p)}歳）`;
  fdNews(t, why === 'death' ? 'bad' : 'info');
  if (p.founder || p.role === 'ceo') { fdChron(t, true); if (p.id === G.ceo) G.pendingModals.push({ type: 'fdSucc', why }); }
}
/* 後継者の候補（幹部・創業家・外から招く人） */
function fdSuccCands() {
  const out = [];
  for (const p of G.people) if (!p.gone && p.role !== 'ceo') out.push({ p, kind: 'inside' });
  if (!G.flags.heirUsed && fdS().heir) out.push({ heir: true, kind: 'family' });
  out.push({ outside: true, kind: 'outside' });
  return out;
}
/* 後継者を選ぶ（i：fdSuccCands の番号） */
function fdPickSucc(i) {
  const c = fdSuccCands()[i];
  if (!c) return false;
  let p;
  if (c.p) p = c.p;
  else if (c.heir) { const H = fdS().heir; p = fdNewPerson('ceo', { n: H.n, born: Math.max(H.born, fdY() - 62), abil: H.abil, trait: H.trait, heir: true }); G.flags.heirUsed = 1; }
  else p = fdNewPerson('ceo', { abil: { fin: 4, lead: 4, tech: 2, prod: 2, sales: 3 } });
  fdSetCeo(p, c.p ? '社内から' : c.heir ? '創業家から' : '外から招く');
  return true;
}
/* 経営危機：銀行団の救済を受ける・断る */
function fdRescueAccept() {
  G.flags.rescued = G.q;
  const amt = Math.max(0, -G.bs.cash) + fdNominal(fdSer([[1910, 2e8], [2000, 3e10]], fdYf(), true)) + fdLastQ('sales') * 0.3;
  fdBorrow(amt, 10, '銀行団の救済融資');
  // 条件：人を減らし、配当をやめ、銀行から役員を迎える
  for (const f of G.facs) f.wk = Math.floor((f.wk || 0) * 0.8);
  G.staff.wk = sum(G.facs, f => f.wk || 0);
  G.staff.sal = Math.floor(G.staff.sal * 0.85); G.staff.adm = Math.floor(G.staff.adm * 0.8);
  G.policy.div = 0;
  G.bank.spread = 1;
  for (const p of fdPeopleIn('cfo')) { p.gone = G.q; p.why = 'retire'; }
  fdNewPerson('cfo', { abil: { fin: 5, lead: 3 }, bank: true });
  if (G.union) G.union.mood = Math.max(0, G.union.mood - 0.2);
  fdChron('経営危機。銀行団の救済融資を受け、人員を整理する', true);
  G.crisis = 0;
}
function fdRescueDecline() { G.over = { type: 'bankrupt', q: G.q }; fdChron('救済を断り、会社は倒産した', true); G.pendingModals.push({ type: 'fdEnd' }); }
function fdSetCeo(p, how) {
  const old = fdCeo();
  if (old && !old.gone) { old.gone = G.q; old.why = 'retire'; }
  p.role = 'ceo';
  G.ceo = p.id;
  G.flags.succAsked = 0;
  fdChron(`${p.n}が社長に就任（${how}）`, true);
  fdNews(`${p.n}が社長に就任しました（${how}）`, 'good');
}

/* ---------- 節目 ---------- */
const FD_MILES = [
  { id: 'head100', t: '社員が100人を超える', ok: () => fdHead() >= 100 },
  { id: 'head1000', t: '社員が1,000人を超える', ok: () => fdHead() >= 1000 },
  { id: 'head10000', t: '社員が1万人を超える', ok: () => fdHead() >= 10000 },
  { id: 'head100000', t: '社員が10万人を超える', ok: () => fdHead() >= 100000 },
  { id: 's100oku', t: '年の売上が今の価値で100億円を超える', ok: () => fdRealYearSales() >= 100e8 },
  { id: 's1000oku', t: '年の売上が今の価値で1,000億円を超える', ok: () => fdRealYearSales() >= 1000e8 },
  { id: 's1cho', t: '年の売上が今の価値で1兆円を超える', ok: () => fdRealYearSales() >= 1e12 },
  { id: 's10cho', t: '年の売上が今の価値で10兆円を超える', ok: () => fdRealYearSales() >= 10e12 },
  { id: 'ovs30', t: '海外の売上が3割を超える', ok: () => fdOverseasRatio() >= 0.3 },
  { id: 'ovs50', t: '海外の売上が半分を超える', ok: () => fdOverseasRatio() >= 0.5 },
  { id: 'abroadFac', t: '海外に初めての工場', ok: () => G.facs.some(f => f.r !== 'jp' && f.ready <= G.q) },
  { id: 'jpTop', t: '国内の市場で首位に立つ', ok: () => fdTopIn('jp') },
  { id: 'worldTop', t: '世界の市場で首位に立つ', ok: () => fdWorldTop() },
  { id: 'global500', t: '世界の大企業500社に並ぶ規模になる', ok: () => fdWorldRank() <= 500 },
  { id: 'global100', t: '世界の大企業100社に並ぶ規模になる', ok: () => fdWorldRank() <= 100 },
  { id: 'global10', t: '世界の大企業10社に並ぶ規模になる', ok: () => fdWorldRank() <= 10 },
];
function fdRealYearSales() { const h = G.hy[G.hy.length - 1]; return h ? h.sales / h.cpi : 0; }
function fdOverseasRatio() { const h = G.hy[G.hy.length - 1]; if (!h || !h.sales) return 0; return 1 - (h.reg.jp || 0) / Math.max(1, sum(Object.values(h.reg), x => x)); }
/* その地域のどれかの分野で、取り分が首位か */
function fdTopIn(r) { return Object.keys(fdS().cats).some(c => { const m = G.mk[c] && G.mk[c][r]; return m && m.top && m.top[0] && m.top[0].me && m.D > 0 && m.share > 0.15; }); }
function fdWorldTop() {
  return Object.keys(fdS().cats).some(c => {
    const mk = G.mk[c]; if (!mk) return false;
    const mine = sum(fdRegOrder(), r => (mk[r] ? mk[r].share * mk[r].D : 0));
    const D = sum(fdRegOrder(), r => (mk[r] ? mk[r].D : 0));
    if (!D || mine / D < 0.1) return false;
    // ライバルごとの世界の台数と比べる
    const by = {};
    for (const r of fdRegOrder()) if (mk[r]) for (const t of mk[r].top || []) if (!t.me && t.n !== 'その他の会社') by[t.n] = (by[t.n] || 0) + t.s * mk[r].D;
    return Object.values(by).every(v => v < mine);
  });
}
/* 世界の大企業の中での順位の目安（売上を今の価値のドルにして、その年の世界の大企業の売上と比べる） */
function fdWorldRank(y = fdY() - 1) {
  const h = G.hy[G.hy.length - 1];
  if (!h) return Infinity;
  const usd = h.sales / fdFx(h.y + 0.5) / fdUsCpi(h.y + 0.5); // 2025年のドル
  const B = FD_WORLD_RANK;
  const pts = [1, 10, 100, 500].map(k => [k, fdSer(B.map(b => [b[0], b[{ 1: 1, 10: 2, 100: 3, 500: 4 }[k]]]), y, true)]);
  if (usd >= pts[0][1]) return 1;
  for (let i = 1; i < pts.length; i++) {
    const [k0, v0] = pts[i - 1], [k1, v1] = pts[i];
    if (usd >= v1) return Math.round(Math.exp(Math.log(k0) + (Math.log(k1) - Math.log(k0)) * (Math.log(v0) - Math.log(usd)) / (Math.log(v0) - Math.log(v1))));
  }
  const [, v5] = pts[3];
  return Math.round(500 * Math.pow(v5 / Math.max(1, usd), 1.2));
}
function fdMilestonesCheck() {
  for (const M of FD_MILES) if (!G.miles[M.id] && M.ok()) fdMilestone(M.id, M.t);
}

/* ---------- 終わり ---------- */
function fdCheckEnd() {
  if (G.over) return;
  if (fdY() > G.endY) { G.over = { type: 'end', q: G.q }; G.pendingModals.push({ type: 'fdEnd' }); }
}
/* 評価：会社の大きさ（世界の順位）・世界での取り分・技術・海外・生き残り */
function fdScore() {
  const rank = fdWorldRank();
  const real = fdRealYearSales();
  const shares = G.hy.length ? G.hy[G.hy.length - 1].share : {};
  const bestShare = Math.max(0, ...Object.values(shares || {}));
  const techTop = Object.entries(G.tech).filter(([f, T]) => T.t !== null && fdFrontier(f) !== null && fdGap(f) <= 1).length;
  const parts = [
    ['会社の大きさ', clamp(Math.round(40 - 8 * Math.log10(Math.max(1, rank))), 0, 40), rank === Infinity ? '―' : `世界の大企業の${rank <= 500 ? `${fmtNum(rank, 0)}位` : '500位より下'}に相当（年の売上 今の約${fmtYen(real)}）`],
    ['世界での取り分', clamp(Math.round(bestShare * 100), 0, 20), `いちばん強い分野の世界シェア ${fmtPct(bestShare * 100, 1)}`],
    ['技術', clamp(techTop * 4, 0, 20), `世界の先端に並ぶ技術 ${techTop}分野`],
    ['海外への広がり', clamp(Math.round(fdOverseasRatio() * 25), 0, 12), `海外の売上 ${fmtPct(fdOverseasRatio() * 100, 0)}`],
    ['危機を越える力', G.flags.rescued ? 3 : 8, G.flags.rescued ? '銀行に救われたことがある' : '一度も救済を受けずに乗り越えた'],
  ];
  if (G.over && G.over.type === 'bankrupt') { parts[0][1] = Math.min(parts[0][1], 10); parts[4] = ['危機を越える力', 0, '資金が尽きて倒産した']; }
  const total = sum(parts, p => p[1]);
  const rankL = total >= 85 ? 'S' : total >= 70 ? 'A' : total >= 50 ? 'B' : total >= 30 ? 'C' : 'D';
  const title = { S: '世界を代表する企業を一代で築いた創業者', A: '世界に名を知られる企業を育てた名経営者', B: '日本を代表する企業に育てた経営者', C: '堅実な中堅企業を残した経営者', D: '志半ばの創業者' }[rankL];
  return { parts, total, rank: rankL, title };
}

/* ---------- 保存 ---------- */
function fdSaveMeta() { return JSON.stringify({ co: G.co, ceo: (fdCeo() || {}).n || G.founder, q: G.q, y: fdY(), scen: G.scen, at: Date.now(), over: !!G.over }); }
function fdDeserialize(s) {
  if (s.version !== FD_SAVE_VERSION || !s.prods || !FD_SCEN[s.scen]) throw new Error('セーブデータの形式が違います');
  G = s;
  G.pendingModals = G.pendingModals || [];
  G.flags = G.flags || {};
  G.mods = G.mods || [];
  G.orders = G.orders || [];
  G.gw = G.gw || [];
  return G;
}

/* ---------- 労働組合（戦後） ----------
   賃金の水準と、人の扱い方で気分が動く。険しくなると争議が起きる（偶然の出来事 strikeR） */
function fdUnionQuarter() {
  const U = G.union;
  if (!U) return;
  const tgt = clamp(0.5 + (G.policy.wage || 0) / 40 + (G.prog.qc ? 0.05 : 0) - (G.policy.noLayoff === false ? 0.08 : 0), 0.1, 0.95);
  U.mood = clamp(U.mood + (tgt - U.mood) * 0.08, 0, 1);
}

/* ---------- 財テク（バブルの時代） ----------
   余ったお金で株と土地を持つ。値上がりは営業外の利益、値下がりは損失（時価で帳簿に載せる） */
function fdZaitechQuarter() {
  const Z = G.zaitech;
  if (!Z || Z.val <= 0) return;
  const g = fdSer([[1986.9, 0.065], [1989.9, 0.065], [1990.0, -0.13], [1990.9, -0.1], [1992.6, -0.07], [1993.5, -0.02], [1995, -0.01], [1998, -0.015], [2003, 0], [2050, 0]], fdYf());
  const d = Z.val * g;
  Z.val += d;
  G.bs.inv2 += d;
  G.yr.pl.nonop += d; G.qr.pl.nonop += d;
}
function fdZaitechSell() {
  const Z = G.zaitech;
  if (!Z || Z.val <= 0) return 0;
  const v = Z.val;
  G.bs.inv2 -= v; G.bs.cash += v;
  fdChron(`財テクを手じまう（元手 ${fmtYen(Z.amt)} → ${fmtYen(v)}）`, true);
  G.zaitech = null;
  return v;
}
/* 整合性の確認（開発・テスト用） */
function fdCheck() {
  const out = [];
  const d = fdBalanceDiff();
  if (!isFinite(d) || Math.abs(d) > Math.max(5, fdAssets() * 1e-9)) out.push(`貸借が合わない ${d}`);
  for (const k of FD_BS) if (!isFinite(G.bs[k])) out.push(`${k} が数でない`);
  for (const k of FD_PL) if (!isFinite(G.yr.pl[k])) out.push(`損益 ${k} が数でない`);
  for (const p of G.prods) if (!(p.stock >= -1e-6) || !isFinite(p.stockCost)) out.push(`在庫がおかしい ${p.name}`);
  for (const f of G.facs) if (!(f.wk >= 0)) out.push(`工員の数がおかしい ${f.n}`);
  for (const [f, T] of Object.entries(G.tech)) if (T.t !== null && !isFinite(T.t)) out.push(`技術 ${f} がおかしい`);
  const ppe = sum(G.assets, a => fdAssetBV(a));
  if (Math.abs(ppe - G.bs.ppe) > Math.max(5, G.bs.ppe * 1e-9)) out.push(`固定資産の台帳と帳簿が合わない ${ppe} / ${G.bs.ppe}`);
  const debt = fdDebt();
  if (Math.abs(debt - G.bs.debt) > Math.max(5, debt * 1e-9)) out.push(`借入の台帳と帳簿が合わない ${debt} / ${G.bs.debt}`);
  return out;
}

/* ---------- 研究の配分（自動） ----------
   売っている・これから売る分野に使う技術を、先端との差が大きいほど厚く */
function fdAutoRd() {
  const y = fdYf();
  const w = {};
  const cats = new Set(fdActiveProds().map(p => p.cat).concat(G.devs.map(d => d.cat)));
  for (const c of fdS().focus || []) if (y >= fdCat(c).from - 6) cats.add(c);
  for (const c of cats) {
    const C = fdCat(c);
    const sales = sum(fdActiveProds(c), p => p.rev || 0) + 1;
    for (const [f, wt] of Object.entries(C.w)) w[f] = (w[f] || 0) + wt * Math.log10(10 + sales / 1e6);
  }
  // 作る技術（生産技術・材料）は、作っている限りいつも要る
  const tot = sum(Object.values(w), x => x) || 1;
  const prodF = new Set(fdActiveProds().map(p => fdProdField(p.cat)).concat(fdActiveProds().map(p => fdCat(p.cat).mf || 'mat')));
  for (const f of prodF) if (fdS().fields[f]) w[f] = Math.max(w[f] || 0, tot * (f === 'mach' || f === 'sw' ? 0.22 : 0.12));
  // 次に来る分野（生まれたばかり）にも少し
  for (const [f, F] of Object.entries(fdS().fields)) if (y >= F.born && y < F.born + 12 && (F.scout || 0) > 0) w[f] = (w[f] || 0) + F.scout;
  for (const [f, T] of Object.entries(G.tech)) {
    const gap = fdGap(f, y);
    T.a = w[f] ? Math.round(w[f] * (gap === Infinity ? 1 : clamp(0.6 + gap / 15, 0.6, 2)) * 10) / 10 : 0;
  }
}

/* ---------- 番頭に任せる（自動の運営：テストと「任せる」の設定で使う） ----------
   o.lvl：0 は日々の運営だけ（生産・人・研究の配分）、1 は投資も（ライン・新製品・地域・借入） */
function fdAuto(o = {}) {
  const y = fdYf();
  if (G.policy.autoRd) fdAutoRd();
  if (!o.lvl) return;
  // 研究の技術者：売上に対して一定の割合（先端から遅れているほど厚く）
  const sales = fdLastYear('sales') || fdLastQ('sales') * 4;
  const avgGap = fdAvgQGap();
  // 赤字の年は、人を必要な数まで減らし（戦前は賃金も下げ）、研究も絞る
  const losing = G.hy.length >= 1 && fdLastYear('opi') < 0;
  G.policy.noLayoff = !losing;
  if (y < 1946) G.policy.wage = losing ? -10 : 0;
  const rdK = (losing ? 0.025 : o.rd ?? 0.045) * (avgGap < -12 ? 1.4 : avgGap < -6 ? 1.2 : 1);
  const rdTgt = sales * rdK / Math.max(1, fdPayQ('eng') * 4 * 1.35);
  const engNeed = Math.max(fdDevEngNeed() + 2, Math.round(rdTgt));
  if (G.staff.eng < engNeed && G.bs.cash > fdPayQ('eng') * 8) fdHireEng(Math.min(engNeed - G.staff.eng, Math.max(1, Math.ceil(G.staff.eng * 0.25))));
  else if (losing && G.staff.eng > engNeed * 1.3) fdHireEng(-Math.ceil((G.staff.eng - engNeed) * (fdLastQ('sales') * 0.4 < G.staff.eng * fdPayQ('eng') ? 0.4 : 0.15)));
  // 新しい製品：今の製品が先端より遅れ、技術が3年以上進んでいれば作り直す。新しい分野は、技術が届いたら入る
  for (const c of Object.keys(fdS().cats)) {
    if (G.devs.some(d => d.cat === c)) continue;
    const ps = fdActiveProds(c);
    const ready = fdCatReady(c);
    if (!ready.ok) continue;
    const t = fdCatTech(c, y);
    if (ps.length) {
      const p = ps[0];
      if (t - p.qy >= (o.devGap ?? 2) && G.q - p.q0 >= 6) fdStartDev(c, { rep: p.id });
    } else if ((o.enter || fdS().focus || []).includes(c) && t > y - (o.enterGap ?? 18) && !G.flags['exit_' + c] && fdAutoEntryOk(c)) fdStartDev(c);
  }
  // ライン：売りたい台数に能力が足りなければ足す。新しい分野は、最初のラインを置く
  for (const c of Object.keys(fdS().cats)) {
    const ps = fdActiveProds(c);
    if (!ps.length) continue;
    const want = sum(ps, p => p.want || 0) + fdOrderNeedQ(c);
    const cap = fdCapQ(c) + sum(G.facs, f => sum(f.lines.filter(l => l.cat === c && ((l.ready ?? 0) > G.q || f.ready > G.q)), l => l.cap / 4));
    if (cap <= 0) {
      const f = fdBestFacFor(c);
      const add = Math.max(fdCat(c).kind === 'big' ? 1 : 10, want * 4 * 1.1);
      if (f && want > 0) { const cost = fdCapexPer(c, f.r, y) * add; if (G.bs.cash > cost * 1.1 || fdCreditLimit() - fdDebt() > cost) { if (G.bs.cash < cost * 1.1) fdBorrow(cost * 1.15 - G.bs.cash, 8, `${fdCat(c).n}の設備`); fdAddLine(f.id, c, Math.round(add)); } }
      continue;
    }
    const margin = sum(ps, p => (p.rev || 0) - (p.sold || 0) * (p.ucost || 0)) / Math.max(1, sum(ps, p => p.rev || 0));
    const lev = fdDebt() / Math.max(1, sales);
    if (want > cap * 0.95 && lev < 0.6 && margin > (lev > 0.3 ? 0.2 : 0.14)) {
      const f = fdBestFacFor(c);
      if (f) {
        // 足りない分を、払える分だけ（手元のお金の7割と、借りられる枠の半分まで）
        const per = fdCapexPer(c, f.r, y);
        const room = lev < 0.35 ? Math.max(0, Math.min(fdCreditLimit() - fdDebt(), sales * 0.35 - fdDebt())) * 0.5 : 0;
        const add = Math.min(Math.max(want * 1.2 - cap, cap * 0.2) * 4, (Math.max(0, G.bs.cash - fdPayQ('wk') * fdHead()) * 0.7 + room) / per);
        if (add >= Math.max(fdCat(c).kind === 'big' ? 1 : 10, cap * 4 * 0.08)) {
          const cost = per * add;
          if (G.bs.cash < cost * 1.2) fdBorrow(cost * 1.2 - G.bs.cash, 8, `${fdCat(c).n}の設備`);
          fdAddLine(f.id, c, Math.round(add));
        }
      } else if (!G.facs.some(f2 => f2.ready > G.q)) { const cost = fdFacCost('jp', y); if (G.bs.cash > cost * 1.5) fdBuildFac('jp', fdS().start.place2 || '新工場', {}); }
    }
  }
  // 被害を受けた工場を直す
  for (const f of G.facs) if ((f.dmgF || 1) > 1.15 && G.bs.cash > fdRepairCost(f) * 2) fdRepairFac(f);
  // 自動化：人件費が材料費より大きい分野
  if (fdQo() === 1) for (const f of G.facs) for (const l of f.lines) {
    const uc = fdUnitCost(l.cat, f, y);
    if (uc && (uc.lab > uc.mat * 0.3 || l.auto < fdAutoTyp(y)) && l.auto < fdAutoMax(y) - 0.05 && G.bs.cash > fdCapexPer(l.cat, f.r, y) * l.cap * 0.6) fdAutomate(f.id, l.cat);
  }
  // 地域：輸出から順に
  if (fdQo() === 2) for (const r of fdRegOrder()) {
    const R = G.reg[r];
    if (r === 'jp') { if (R.st < 4 && G.bs.cash > fdRegStepCost(r, R.st + 1) * 1.5 && sales > fdRegStepCost(r, R.st + 1) * (R.st + 1) * 0.8) fdRegStep(r); continue; }
    if (R.st === 0 && fdRegAccess(r) >= 1 && fdOverseasOk(r) && G.bs.cash > fdRegStepCost(r, 1) * 4) fdRegStep(r);
    else if (R.st === 1 && fdRegAccess(r) >= 2 && fdLastYearReg(r) > fdRegStepCost(r, 2) * 1.2 && G.bs.cash > fdRegStepCost(r, 2) * 2) fdRegStep(r);
    else if (R.st === 2 && fdRegAccess(r) >= 3 && fdLastYearReg(r) > fdFacCost(r) * 1.5 && G.bs.cash > fdFacCost(r) * 2.5 && !G.facs.some(f => f.r === r)) {
      const c = fdTopCatIn(r);
      if (c) { const b = fdBuildFac(r, FD_REG[r].city || FD_REG[r].n, {}); if (b.ok) fdAddLine(b.f.id, c, Math.max(100, (G.mk[c][r].want || 0) * 4 * 0.6)); }
    } else if (R.st === 3 && fdRegAccess(r) >= 4 && fdLastYearReg(r) > fdRegStepCost(r, 4) * 3 && G.bs.cash > fdRegStepCost(r, 4) * 2) fdRegStep(r);
  }
  // 現金が少なければ借り、多すぎれば返す
  const pay = fdLastQ('sales') * 0.15 + fdPayQ('wk') * fdHead();
  if (G.bs.cash < pay) { const room = fdCreditLimit() - fdDebt(); if (room > 0) fdBorrow(Math.min(room, pay * 1.5 - G.bs.cash), 5, '運転資金'); }
  else if (G.bs.cash > pay * 2.5) for (const l of G.loans.slice().sort((a, b) => b.rate - a.rate)) fdRepay(l, Math.min(l.bal, G.bs.cash - pay * 2));
  G.loans = G.loans.filter(l => l.bal > 0.5);
  // 借金が重ければ、増資・上場で資本を集める
  if (fdQo() === 0 && fdDebt() > sales * 0.35 && fdCanRaise().ok) fdRaise();
  if (fdCanIpo() && fdDebt() > sales * 0.2) fdIpo();
  // 現地生産を広げる・赤字が続けば事業を売る
  if (fdQo() === 3) fdAutoLocalize(y);
  if (fdQo() === 0) fdAutoRestructure();
  // 管理の改革（組織の危機）
  const st = fdOrgStage();
  const nx = FD_ORG[st + 1];
  if (nx && fdHead() > nx.min * 1.05) fdOrgReform();
  // 仕組み
  if (!G.prog.school && fdHead() > 60) fdProgStart('school');
  if (!G.prog.kaizen && y >= 1950 && fdHead() > 500) fdProgStart('kaizen');
  if (!G.prog.qc && y >= 1951 && fdHead() > 300) fdProgStart('qc');
  if (!G.prog.lab && y >= 1934 && fdHead() > 1500) fdProgStart('lab');
}
/* 番頭：輸出の多い地域では、その地域の工場にその分野のラインを足す（円高・関税・運賃に強くなる）。1年に3つまで */
function fdAutoLocalize(y) {
  let n = 0;
  for (const r of fdRegOrder()) {
    if (r === 'jp' || fdRegAccess(r, y) < 3) continue;
    const f = G.facs.filter(x => x.r === r && x.ready <= G.q).sort((a, b) => sum(b.lines, l => l.cap) - sum(a.lines, l => l.cap))[0];
    if (!f) continue;
    for (const c of Object.keys(G.mk)) {
      if (n >= 3) return;
      const m = G.mk[c][r];
      if (!m || !m.want || !fdActiveProds(c).length) continue;
      const capR = sum(G.facs.filter(x => x.r === r), x => sum(x.lines.filter(l => l.cat === c), l => l.cap / 4));
      if (m.want * 4 * fdRef(c, y) < fdLastYear('sales') * 0.01 || capR >= m.want * 0.7) continue;
      const add = Math.round(Math.max(fdCat(c).kind === 'big' ? 1 : 10, m.want * 4 * 0.8 - capR * 4));
      const cost = fdCapexPer(c, r, y) * add;
      if (G.bs.cash > cost * 1.5) { fdAddLine(f.id, c, add); n++; }
    }
  }
}
/* 番頭：赤字が2年続いたら、粗利がいちばん薄い事業を売る（事業は2つより減らさない） */
function fdAutoRestructure() {
  const h = G.hy.slice(-2);
  if (h.length < 2 || h.some(x => x.opi > 0)) return;
  const ps = fdActiveProds();
  if (ps.length <= 2) return;
  let worst = null, wm = 0.12;
  for (const p of ps) { const m = ((p.rev || 0) - (p.sold || 0) * (p.ucost || 0)) / Math.max(1, p.rev || 0); if ((p.rev || 0) > 0 && m < wm) { wm = m; worst = p; } }
  if (worst) fdSellBiz(worst.cat);
}
function fdOverseasOk(r) { return fdActiveProds().some(p => p.qy > fdYf() - 8); }
/* 番頭が新しい分野に入ってよいか：利益が出ていて、ほかに新しい分野の開発がなく、市場が会社の大きさに見合う */
function fdAutoEntryOk(c) {
  if (G.devs.some(d => !fdActiveProds(d.cat).length)) return false;
  const sales = fdLastYear('sales');
  if (G.hy.length >= 2 && fdLastYear('opi') <= 0) return false;
  if (fdDevEngNeed() + fdDevNeed(c) / fdDevQuarters(c) > G.staff.eng * 0.8) return false;
  const y = fdYf();
  const mkt = sum(fdRegOrder().filter(r => r === 'jp' || G.reg[r].st >= 1), r => fdDemandQ(c, r)) * 4 * fdRef(c, y);
  const line = fdCapexPer(c, 'jp', y) * Math.max(fdCat(c).kind === 'big' ? 1 : 10, mkt / fdRef(c, y) * 0.03);
  return mkt > sales * 0.15 && G.bs.cash + Math.max(0, fdCreditLimit() - fdDebt()) * 0.5 > line;
}
function fdLastYearReg(r) { const h = G.hy[G.hy.length - 1]; return h && h.reg ? h.reg[r] || 0 : 0; }
function fdTopCatIn(r) { let best = null, bv = 0; for (const c of Object.keys(G.mk)) { const m = G.mk[c][r]; if (m && m.want > bv) { bv = m.want; best = c; } } return best; }
/* 分野のラインを足すなら、どの工場か（その分野のラインがある日本の工場、なければ日本のいちばん大きな工場） */
function fdBestFacFor(c) {
  const ready = G.facs.filter(f => f.r === 'jp');
  return ready.find(f => f.lines.some(l => l.cat === c)) || ready.sort((a, b) => sum(b.lines, l => l.cap) - sum(a.lines, l => l.cap))[0] || null;
}

/* 増資：戦前は親会社・財閥・地元の資本家、戦後は株主に新しい株を割り当てる。上場していれば市場で */
function fdCanRaise() {
  if (G.flags.raiseQ && G.q - G.flags.raiseQ < 8) return { ok: false, why: '前の増資から2年たっていません' };
  if (fdEquity() <= 0) return { ok: false, why: '純資産がマイナスのうちは、出資してくれる人がいません' };
  return { ok: true };
}
function fdRaiseAmount() {
  const eq = Math.max(0, fdEquity());
  const last = G.hy[G.hy.length - 1];
  const val = Math.max(eq, last ? Math.max(0, last.net) * (G.listed ? 18 : 8) : eq);
  return Math.round(val * 0.25);
}
function fdRaise() {
  const c = fdCanRaise();
  if (!c.ok) return c;
  const amt = fdRaiseAmount();
  const val = amt / 0.25;
  const k = amt / (val + amt);
  G.bs.cash += amt; G.bs.cap += amt;
  G.owners.founder *= (1 - k); G.owners.parent *= (1 - k); G.owners.outside = 1 - G.owners.founder - G.owners.parent;
  G.flags.raiseQ = G.q;
  fdChron(`${fmtYen(amt)}の増資`);
  return { ok: true, amt };
}
/* 上場：戦後の証券取引所の再開のあと、売上が今の価値で300億円ほどあれば */
function fdCanIpo() { return !G.listed && fdYf() >= 1949.4 && fdRealYearSales() > 300e8; }
function fdIpo() {
  if (G.listed) return { ok: false };
  const last = G.hy[G.hy.length - 1];
  const val = Math.max(fdEquity() * 1.5, last ? Math.max(0, last.net) * 20 : 0);
  const amt = Math.round(val * 0.2);
  const k = amt / (val + amt);
  G.bs.cash += amt; G.bs.cap += amt;
  G.owners.founder *= (1 - k); G.owners.parent *= (1 - k); G.owners.outside = 1 - G.owners.founder - G.owners.parent;
  G.listed = G.q;
  fdMilestone('ipo', `株式を上場（${fmtYen(amt)}を集める）`);
  return { ok: true, amt };
}

/* ---------- 仕組み（養成所・カイゼン・品質管理・中央研究所） ---------- */
const FD_PROGS = {
  school: { n: '技能者の養成所', from: 1900, d: '工員を育てる学校を作る。腕が上がり、作るのにかかる時間が減る。', cost: () => fdNominal(2e8), run: '社員の給料の1.5%ほど' },
  lab: { n: '中央研究所', from: 1925, d: '基礎から研究する研究所を作る。研究と開発が速くなり、技術者の腕も上がる。', cost: () => fdNominal(15e8) * Math.max(1, Math.log10(Math.max(10, G.staff.eng)) - 1), run: '技術者の給料の12%ほど' },
  kaizen: { n: 'カイゼンとジャスト・イン・タイム', from: 1938, d: '必要な物を必要なときに必要なだけ作り、現場の工夫で無駄を毎日減らす。作る時間と在庫が減っていく。', cost: () => fdNominal(3e8), run: 'なし（現場の工夫）' },
  qc: { n: '品質管理（QC）', from: 1949, d: '統計で工程を管理し、職場ごとの小集団（QCサークル）で品質を作り込む。不良と苦情が減っていく。', cost: () => fdNominal(2e8), run: 'なし' },
};
function fdProgStart(k) {
  const P = FD_PROGS[k];
  if (G.prog[k] || fdYf() < P.from) return { ok: false };
  const cost = P.cost();
  if (G.bs.cash < cost) return { ok: false, why: 'お金が足りません' };
  G.bs.cash -= cost;
  fdNewAsset({ n: P.n, cost, life: 20, kind: 'prog' });
  G.prog[k] = G.q;
  fdChron(`${P.n}を始める`, k === 'lab' || k === 'kaizen');
  return { ok: true, cost };
}
/* 組織の改革（次の段階へ） */
function fdOrgReform() {
  const st = fdOrgStage();
  const O = FD_ORG[st];
  if (!FD_ORG[st + 1]) return { ok: false };
  const cost = fdPayQ('adm') * Math.max(4, fdHead() * 0.02);
  if (G.bs.cash < cost) return { ok: false, why: 'お金が足りません' };
  fdPay('sga', cost);
  G.org.st = st + 1;
  G.org.fixed[O.fix] = G.q;
  fdChron(`組織の改革：${O.fixN.replace(/（.*?）/, '')}`, true);
  fdNews(`${O.crisis}を乗り越えるため、組織を改めました：${O.fixN}`, 'good');
  return { ok: true, cost };
}
