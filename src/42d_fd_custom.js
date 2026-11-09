'use strict';
/* =========================================================
 *  42d_fd_custom.js : 創業記モードのカスタムスタートと途中編集（画面に依存しない）
 *   カスタムスタート：始める年・終わりの年・創業の年・年商・現金と借入・技術の遅れ（分野ごとにも）・
 *     事業（売上の割合・品質の遅れ・値段）・販路とブランド・海外での生産の割合・技術者・仕組み・上場・物語の出来事を決めて始める。
 *     始める年より前の時代の出来事は、市場への効き目（関税・統制・需要・進出の制限など）のうち、まだ続いているものだけを引き継ぐ。
 *   途中編集：お金・技術・製品・工場とライン・販路とブランド・人と仕組みを、ゲームの途中で書き換える。
 *     帳簿の貸借は、増えた・減った分を純資産（資本金）で受けて合わせる。編集した会社の評価は「参考」になる
 * ========================================================= */

const FD_CU_YMIN = 1910, FD_CU_YMAX = 2045, FD_CU_ENDMAX = 2050;
const FD_SALES_STAFF = [[1910, 4e7], [1960, 6e7], [2000, 1.5e8], [2025, 2e8]];

/* ---------- 時代の目安（開始画面でも使うので、G に頼らない） ---------- */
/* 史実の会社のその年の売上（今の価値の円） */
function fdCuBench(scen, y) { const B = FD_SCEN[scen].bench; return B ? fdSer(B.pts, y + 0.5, true) : 1e10; }
/* その地域で、その時代にどこまで商売できるか（0〜4。出来事による制限は数えない） */
function fdCuAccess(r, y) { if (r === 'jp') return 4; const R = FD_REG[r]; return Math.floor((R.access ? fdSer(R.access, y) : 4) + 1e-9); }
/* 分野の、日本の産業の地力の遅れ（年） */
function fdCuBase(scen, f, y) { const F = FD_SCEN[scen].fields[f]; return fdSer(F.base || FD_JP_BASE, y); }
/* その年にある製品の分野（シナリオの中心の分野から順に） */
function fdCuCats(scen, y) {
  const S = FD_SCEN[scen];
  const fo = S.focus || [];
  const idx = c => (fo.indexOf(c) < 0 ? 99 : fo.indexOf(c));
  return Object.keys(S.cats).filter(c => S.cats[c].from <= y).sort((a, b) => idx(a) - idx(b));
}
/* 分野の技術の遅れの初期値：日本の地力より2年ほど後ろ（1980年からは1年） */
function fdCuTechDefault(scen, f, y) { return Math.max(1, Math.round(fdCuBase(scen, f, y) + (y < 1980 ? 2 : 1))); }
/* 製品の分野の技術の遅れ：使う技術の遅れを重みで平均 */
function fdCuCatGap(scen, c, tech) {
  const C = FD_SCEN[scen].cats[c];
  let s = 0, w = 0;
  for (const [f, wt] of Object.entries(C.w)) { const g = tech[f]; if (g === null || g === undefined) continue; s += g * wt; w += wt; }
  return w ? Math.round(s / w) : 10;
}
/* 入力の数を読む。全角の数字、いろいろなマイナス（－ − ー ‐ – —、会計の ▲ △）、区切りの点、末尾の「年」「%」も受け付ける */
const fdCuNum = v => {
  if (v === '' || v === null || v === undefined) return null;
  const t = String(v).trim()
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[,，、\s]/g, '')
    .replace(/^[▲△]/, '-')
    .replace(/[－−ー‐‑‒–—―]/g, '-')
    .replace(/[年%％]$/, '');
  if (t === '' || t === '-' || t === '+') return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};

/* 画面で入れた値（空欄は時代と大きさに合わせた初期値）を、始めるのに使う形にそろえる */
function fdCuResolve(scen, cu = {}) {
  const S = FD_SCEN[scen], st = S.start;
  const y = clamp(Math.round(fdCuNum(cu.y) ?? st.y0), FD_CU_YMIN, FD_CU_YMAX);
  const endY = clamp(Math.round(fdCuNum(cu.endY) ?? Math.max(2025, y + 10)), Math.min(FD_CU_ENDMAX, y + 3), FD_CU_ENDMAX);
  const founded = clamp(Math.round(fdCuNum(cu.founded) ?? y), 1850, y);
  const sales = Math.max(1e8, (fdCuNum(cu.sales) ?? fdCuBench(scen, y) / 1e8) * 1e8);
  // 現金と借入：空欄なら、市場から見込める年商に合わせて組み立てるときに決める（null）
  const cash = fdCuNum(cu.cash) === null ? null : Math.max(0, fdCuNum(cu.cash) * 1e8);
  const debt = fdCuNum(cu.debt) === null ? null : Math.max(0, fdCuNum(cu.debt) * 1e8);
  const gapAll = fdCuNum(cu.gap);
  const tech = {};
  for (const [f, F] of Object.entries(S.fields)) {
    if (F.born > y) { tech[f] = null; continue; }
    const g = fdCuNum((cu.techF || {})[f]) ?? gapAll ?? fdCuTechDefault(scen, f, y);
    tech[f] = clamp(g, -2, 80);
  }
  // 事業：選ばれていなければ、会社の大きさに合わせて中心の分野から順に
  const avail = fdCuCats(scen, y);
  const nDef = clamp(Math.round(Math.log10(Math.max(1, sales / 1e9)) * 2), 1, avail.length);
  const anySet = avail.some(c => cu.cats && cu.cats[c] && cu.cats[c].on !== undefined);
  // 初期値：史実の会社がその年に手がけていた事業（シナリオに書いてあれば）。なければ大きさに合わせて中心の分野から順に
  let hist = null;
  for (const [yy, L] of S.cuCats || []) if (y >= yy) hist = L;
  const deflt = hist ? hist.filter(c => avail.includes(c)) : avail.filter(c => S.cats[c].from <= y - 5).slice(0, nDef);
  if (!deflt.length && avail.length) deflt.push(avail[0]);
  const cats = [];
  for (const c of avail) {
    const o = (cu.cats || {})[c] || {};
    const on = anySet ? !!o.on : deflt.includes(c);
    if (!on) continue;
    cats.push({ c, w: Math.max(0.1, fdCuNum(o.w) ?? 1), wSet: fdCuNum(o.w) !== null, gap: clamp(fdCuNum(o.gap) ?? fdCuCatGap(scen, c, tech), -2, 80), pr: clamp(Math.round(fdCuNum(o.pr) ?? 100), 50, 200) });
  }
  if (!cats.length && avail.length) cats.push({ c: avail[0], w: 1, gap: fdCuCatGap(scen, avail[0], tech), pr: 100 });
  const wsum = sum(cats, k => k.w);
  for (const k of cats) k.w /= wsum;
  // 販路とブランド
  const regs = {};
  for (const r of fdRegOrder()) {
    const o = (cu.regs || {})[r] || {};
    const acc = fdCuAccess(r, y);
    const stD = r === 'jp' ? (y < 1915 ? 1 : y < 1950 ? 2 : sales > 5e11 ? 4 : 3)
      : acc <= 0 ? 0 : y < 1950 ? ((r === 'as' || r === 'cn') && sales > 1e11 ? 1 : 0)
      : y < 1975 ? (sales > 3e11 ? (r === 'na' || r === 'as' ? 2 : 1) : sales > 5e10 ? 1 : 0)
      : sales > 1e12 ? 3 : sales > 2e11 ? 2 : 1;
    const stv = clamp(Math.round(fdCuNum(o.st) ?? stD), 0, r === 'jp' ? 4 : Math.min(4, acc));
    const bD = r === 'jp' ? clamp(Math.round(15 + 9 * Math.log10(Math.max(1, sales / 1e9))), 10, 85) : stv ? clamp(stv * 8 + 5 + Math.round(4 * Math.log10(Math.max(1, sales / 1e11))), 5, 60) : 0;
    regs[r] = { st: r === 'jp' ? Math.max(1, stv) : stv, brand: clamp(Math.round(fdCuNum(o.brand) ?? bD), 0, 100), brandSet: fdCuNum(o.brand) !== null };
  }
  const abroad = fdRegOrder().filter(r => r !== 'jp' && regs[r].st >= 3);
  const ovs = abroad.length ? clamp((fdCuNum(cu.ovs) ?? (y < 1990 ? 15 : 30)) / 100, 0, 0.8) : 0;
  const eng = fdCuNum(cu.eng);
  // 仕組み（その年にあるものだけ）
  const progD = { school: y >= 1915 && sales > 1e11, lab: y >= 1935 && sales > 3e11, kaizen: scen === 'jidosha' && y >= 1960, qc: y >= 1960 && sales > 1e11 };
  const prog = {};
  for (const k of Object.keys(FD_PROGS)) { if (y < FD_PROGS[k].from) continue; const v = cu.prog && cu.prog[k] !== undefined ? !!cu.prog[k] : progD[k]; if (v) prog[k] = true; }
  const kz = prog.kaizen ? clamp((fdCuNum(cu.kz) ?? 50) / 100, 0, 1) : 0;
  const qcLv = prog.qc ? clamp((fdCuNum(cu.qcLv) ?? 50) / 100, 0, 1) : 0;
  const listed = y >= 1950 && (cu.listed === undefined || cu.listed === null ? sales > 1e11 : !!cu.listed);
  return { y, endY, founded, sales, cash, debt, tech, cats, regs, ovs, eng: eng === null ? null : Math.max(0, Math.round(eng)), prog, kz, qcLv, listed, story: cu.story !== false };
}

/* ---------- カスタムスタートで会社を組み立てる（fdNewGame から呼ぶ。G の骨組みとライバルはできている） ---------- */
function fdCustomBuild(R) {
  const S = fdS(), st = S.start;
  const y = fdYf(0);
  G.custom = { y: R.y, sales: R.sales, founded: R.founded };
  G.founded = R.founded;
  G.bank.years = Math.min(15, R.y - R.founded);
  // 技術（世界の先端から何年遅れているか）
  for (const f of Object.keys(S.fields)) G.tech[f] = { t: R.tech[f] === null || R.tech[f] === undefined ? null : y - R.tech[f], a: 0 };
  // 仕組み（カイゼン・品質管理の身につき具合も）
  for (const k of Object.keys(R.prog)) G.prog[k] = -8;
  G.kaizen = R.kz; G.qc = R.qcLv;
  // 販路とブランド
  for (const r of fdRegOrder()) { const o = R.regs[r], Rg = G.reg[r]; Rg.st = o.st; Rg.dist = (r === 'jp' ? FD_STAGES_JP : FD_STAGES)[o.st].dist; Rg.brand = o.brand; Rg.since = o.st > 0 ? -8 : null; }
  // 工場：日本の本社工場と、現地生産の地域ごとに1つ
  const f0 = (st.facs || [])[0];
  const main = fdBuildFac('jp', f0 ? f0.loc : FD_REG.jp.locs[0], { n: f0 ? f0.n : undefined, free: true, now: true, quiet: true }).f;
  const abroad = fdRegOrder().filter(r => r !== 'jp' && R.regs[r].st >= 3 && fdRegAccess(r, y) >= 3);
  const facOf = { jp: main };
  for (const r of abroad) facOf[r] = fdBuildFac(r, FD_REG[r].locs[0], { free: true, now: true, quiet: true }).f;
  // 事業：製品を先に作り、市場の取り分から見込める売上を出す。見込みが目安の年商に届くまで、ブランドを上げる（入れた値は動かさない）
  const prods = R.cats.map(k => fdCuProd(k.c, y - k.gap, k.pr, 0, null, y));
  const units = {};
  const est = () => R.cats.map(k => sum(fdRegOrder(), r => { const M = fdMarket(k.c, r); const it = M.items.find(x => x.me); units[k.c + ':' + r] = { M, u: it ? it.units : 0, s: it ? it.share : 0 }; return it ? it.units * 4 * fdRefReal(k.c, y) * k.pr / 100 : 0; }));
  let V = est();
  const bMax = r => (r === 'jp' ? 85 : 65);
  for (let it = 0; it < 16; it++) {
    const tot = sum(V, v => v);
    const adj = fdRegOrder().filter(r => !R.regs[r].brandSet && G.reg[r].st > 0 && G.reg[r].brand < bMax(r));
    if (tot >= R.sales * 0.97 || !adj.length) break;
    for (const r of adj) G.reg[r].brand = Math.min(bMax(r), G.reg[r].brand + (tot < R.sales * 0.5 ? 8 : 3));
    V = est();
  }
  // 割合を決めていない事業は、見込める売上に比例させる（決めた事業の割合はそのまま）
  const setW = sum(R.cats.filter(k => k.wSet), k => k.w);
  const freeV = sum(R.cats.map((k, i) => (k.wSet ? 0 : V[i])), v => v);
  if (freeV > 0) R.cats.forEach((k, i) => { if (!k.wSet) k.w = (1 - Math.min(0.95, setW)) * V[i] / freeV; });
  // 目安の年商を事業の割合で配る。見込める売上の1.15倍を超える分は、余裕のある事業へ回す（どこにも入らない分だけ、年商は目安より小さくなる）
  let alloc = R.cats.map(k => R.sales * k.w);
  for (let pass = 0; pass < 4; pass++) {
    const lim = V.map(v => v * 1.15);
    let extra = 0;
    alloc = alloc.map((a, i) => { if (a > lim[i]) { extra += a - lim[i]; return lim[i]; } return a; });
    const room = alloc.map((a, i) => Math.max(0, lim[i] - a));
    const rs = sum(room, x => x);
    if (extra <= 1 || rs <= 1) break;
    alloc = alloc.map((a, i) => a + Math.min(room[i], extra * room[i] / rs));
  }
  G.custom.plan = sum(alloc, a => a);
  // 市場の記録を、見込みで初めておく（現地で作る割合の計算が、初めの四半期から落ち着くように）
  for (const k of R.cats) {
    G.mk[k.c] = G.mk[k.c] || {};
    for (const r of fdRegOrder()) { const x = units[k.c + ':' + r]; if (x) G.mk[k.c][r] = { D: x.M.D, ref: x.M.ref, share: x.s, want: x.u, wantS: x.u, top: [] }; }
  }
  // 事業ごとのライン（見込む売上 ÷ 値段 ÷ 稼働85%）
  R.cats.forEach((k, ki) => {
    const C = fdCat(k.c);
    const units = alloc[ki] / (fdRefReal(k.c, y) * k.pr / 100) / 0.85;
    const capT = C.kind === 'big' ? Math.max(0.5, Math.round(units * 10) / 10) : Math.max(10, Math.round(units));
    const wts = abroad.map(r => fdRegShare(k.c, r, y));
    const wsum = sum(wts, x => x);
    let left = capT;
    if (R.ovs > 0 && wsum > 0) abroad.forEach((r, i) => { const cp = C.kind === 'big' ? Math.round(capT * R.ovs * wts[i] / wsum * 10) / 10 : Math.round(capT * R.ovs * wts[i] / wsum); if (cp > 0 && cp < left) { fdCuLine(facOf[r], k.c, cp, y); left -= cp; } });
    fdCuLine(main, k.c, left, y);
    G.cum[k.c] = capT * 3;
  });
  // 現地の工場を入れて、市場の記録が落ち着くまで回す（初めの四半期の売れ行きが跳ねないように）。売れる見込みと在庫はそのあとで
  for (let it = 0; it < 4; it++) for (const k of R.cats) for (const r of fdRegOrder()) {
    const M = fdMarket(k.c, r); const me = M.items.find(x => x.me); const u = me ? me.units : 0;
    G.mk[k.c][r] = { D: M.D, ref: M.ref, share: me ? me.share : 0, want: u, wantS: u, top: [] };
  }
  R.cats.forEach((k, ki) => fdCuStock(prods[ki], sum(G.facs, f => sum(f.lines.filter(l => l.cat === k.c), l => l.cap)), main, y));
  // 建物（工場ごと。ラインの大きさに合わせる）
  for (const f of G.facs) {
    const lineV = sum(G.assets.filter(a => a.f === f.id && a.kind === 'line'), a => a.cost);
    fdNewAsset({ n: `${f.n}の建物・土地`, cost: fdFacCost(f.r, y) * 0.6 + lineV * 0.25, life: 40, f: f.id, kind: 'bld', q: -1 });
  }
  // 人：工員はラインの85%を動かせるだけ、技術者は売上の4%を研究開発に使える数、営業と事務は大きさに合わせて
  for (const f of G.facs) { f.wk = Math.ceil(fdFacWkFull(f, y) * 0.85); f.skill = 1 + clamp((R.y - R.founded) / 60, 0, 0.4); }
  G.staff.wk = sum(G.facs, f => f.wk || 0);
  const salesN = fdNominal(G.custom.plan, y);
  G.staff.eng = R.eng ?? Math.max(3, Math.round(salesN * 0.04 / (fdPayQ('eng') * 4 * 1.35)));
  const ns = fdNeedStaff({ sales: salesN / 4 });
  G.staff.sal = ns.sal;
  G.staff.adm = fdNeedStaff({ sales: salesN / 4 }).adm;
  // 組織：これまでの段階の改革は済んでいる
  const head = fdHead();
  let ost = 0;
  while (FD_ORG[ost + 1] && head > FD_ORG[ost + 1].min) { G.org.fixed[FD_ORG[ost].fix] = -4; ost++; }
  G.org.st = ost;
  // 社長と幹部
  const ceo = fdNewPerson('ceo', { n: G.founder, born: R.y - 45, abil: st.ceoAbil || { tech: 4, lead: 4, prod: 3, sales: 3, fin: 3 }, trait: st.trait || 'pioneer', founder: R.founded === R.y });
  G.ceo = ceo.id;
  for (const role of R.sales > 3e10 ? ['cto', 'coo', 'cso', 'cfo'] : R.sales > 5e9 ? ['cto', 'coo'] : ['cto']) fdNewPerson(role);
  // 上場・労働組合
  if (R.listed) { G.listed = -4; G.owners = { founder: 0.08, parent: 0, outside: 0.92 }; }
  if (R.y + 0.125 >= 1946.25) G.union = { mood: 0.5, since: -4 };
  // お金：現金と借入、残りを純資産（資本金と、これまでの利益の積み上げ）に
  const plan = G.custom.plan;
  G.bs.cash = fdNominal(R.cash ?? Math.max(plan * 0.12, 2e8), y);
  const debt = R.debt ?? plan * (R.y < 1950 ? 0.15 : R.y < 1990 ? 0.3 : 0.2);
  if (debt > 0) { const l = fdBorrow(fdNominal(debt, y), 10, 'これまでの借入'); G.bs.cash -= l.amt; }
  const eq = G.bs.cash + G.bs.ar + G.bs.inv + G.bs.ppe + G.bs.inv2 - G.bs.ap - G.bs.debt - G.bs.taxp;
  G.bs.cap = eq > 0 ? Math.round(eq * 0.4) : fdNominal(1e8, y);
  G.bs.re = eq - G.bs.cap;
  // 始める年より前の出来事
  fdCuPastEvents(R);
  G.news = [];
  fdChron(`${fdWareki(R.y)}（${R.y}年）、${G.founder}が${G.co}の社長として経営を始める（${R.founded < R.y ? `${R.founded}年創業。` : ''}年商は今の価値で約${fmtYen(G.custom.plan)}）`, true);
  fdNews(`${G.founder}、${G.co}の社長として経営を始める。年商の見込みは今の価値で約${fmtYen(G.custom.plan)}`, 'info');
  if (G.custom.plan < R.sales * 0.8) fdNews(`市場の取り分から見込める年商は、目安（今の価値で約${fmtYen(R.sales)}）に届きません。品質・ブランド・販路を強めると伸びます`, 'warn');
  fdAutoRd();
  return G;
}
/* ライン（能力 cap 台/年）。自動化は時代のふつう。機械は少し使い込んだ帳簿の値で持っている */
function fdCuLine(f, c, cap, y) {
  if (!(cap > 0)) return;
  const r = fdAddLine(f.id, c, cap, { free: true, now: true });
  r.line.auto = Math.round(fdAutoTyp(y) * 100) / 100;
  fdNewAsset({ n: `${f.n}の${fdCat(c).n}のライン`, cost: fdCapexPer(c, f.r, y) * cap * 0.55, life: fdCat(c).lineLife || 15, f: f.id, kind: 'line', cat: c, q: -1 });
}
/* 売っている製品（品質の年 qy・値段 pr）。capT>0 なら、初めの四半期から作れるよう、売れる見込みと半期分の在庫を持たせる */
function fdCuProd(c, qy, pr, capT, f, y) {
  const C = fdCat(c);
  G.gen[c] = 0;
  const p = { id: 'P' + (++G.seq), cat: c, name: fdModelName(c), gen: 1, qy, q0: -4, pr, stock: 0, stockCost: 0, cum: 0, sold: 0, want: 0, made: 0, def: fdDefect(c), active: true, plan: { mode: 'auto', qty: 0 }, ban: [] };
  p.spec = C.spec ? C.spec(qy, y) : '';
  G.gen[c] = 1; G.miles['cat_' + c] = -4;
  G.prods.push(p);
  if (capT > 0 && f) fdCuStock(p, capT, f, y);
  return p;
}
function fdCuStock(p, capT, f, y) {
  const C = fdCat(p.cat);
  const mk = G.mk[p.cat];
  const dem = mk ? sum(Object.values(mk), m => m.want || 0) : 0;
  p.want = p.sold = dem > 0 ? Math.min(dem, capT / 4 * 0.95) : capT / 4 * 0.85;
  const n = C.kind === 'big' ? Math.floor(p.want * 0.5 * 10) / 10 : Math.round(p.want * 0.5);
  if (n > 0 && f) { const uc = fdUnitCost(p.cat, f, y).v; p.stock += n; p.stockCost += n * uc; G.bs.inv += n * uc; }
}
/* 始める年より前の出来事：起きたことにする。歴史の出来事の、市場への効き目（関税・統制・需要・進出の制限など）のうち、
   始める時点でまだ続いているものだけを引き継ぐ（会社への直接の効き目は引き継がない）。物語の出来事を起こさないときは、先の分も起きたことにする */
function fdCuPastEvents(R) {
  const real = G;
  for (const E of fdEventList()) {
    const hist = FD_EVENTS.includes(E);
    if (E.y === undefined) { if (!hist && !R.story) real.ev.done[E.id] = -1; continue; }
    const qE = fdQOf(E.y, E.q || 0);
    if (qE >= 0) { if (!hist && !R.story) real.ev.done[E.id] = -1; continue; }
    real.ev.done[E.id] = qE;
    if (!hist || !E.fx) continue;
    const scratch = JSON.parse(JSON.stringify(real));
    const n0 = scratch.mods.length;
    G = scratch;
    try { E.fx(); } catch (e) { /* 会社の状態に頼る出来事は、市場への効き目だけ拾えればよい */ }
    const add = G.mods.slice(n0).filter(m => m.to >= 0);
    G = real;
    for (const m of add) G.mods.push(m);
  }
  G = real;
}

/* ---------- 途中編集 ----------
   金額は今の価値の円で受け取る。増えた・減った資産と負債の差は、純資産（資本金）で受ける */
function fdEdited(what) {
  G.flags.edited = (G.flags.edited || 0) + 1;
  fdChron(`会社の状態を編集した（${what}）`, false);
  fdNews(`会社の状態を編集しました（${what}）。この会社の評価は参考になります`, 'warn');
}
function fdEditMoney(o) {
  const y = fdYf();
  const msg = [];
  if (o.cash !== null && o.cash !== undefined && isFinite(o.cash)) {
    const d = fdNominal(Math.max(0, o.cash), y) - G.bs.cash;
    if (Math.abs(d) >= 1) { G.bs.cash += d; G.bs.cap += d; msg.push('現金'); }
  }
  if (o.debt !== null && o.debt !== undefined && isFinite(o.debt)) {
    const d = fdNominal(Math.max(0, o.debt), y) - fdDebt();
    if (d >= 1) { const l = fdBorrow(d, 10, '編集による借入'); G.bs.cash -= l.amt; G.bs.cap -= l.amt; msg.push('借入'); }
    else if (d <= -1) {
      let x = -d;
      for (const l of G.loans) { if (x <= 0) break; const r = Math.min(l.bal, x); l.bal -= r; x -= r; }
      const cut = -d - x;
      G.bs.debt -= cut; G.bs.cap += cut;
      G.loans = G.loans.filter(l => l.bal > 0.5);
      G.bs.debt = fdDebt();
      msg.push('借入');
    }
  }
  if (msg.length) fdEdited(msg.join('・'));
  return msg.length > 0;
}
/* 技術：分野 → 世界の先端より何年遅れているか（マイナスは先を行く。最大2年） */
function fdEditTech(gaps) {
  const y = fdYf();
  let n = 0;
  for (const [f, g] of Object.entries(gaps)) {
    if (!G.tech[f] || g === null || g === undefined || !isFinite(g) || fdFrontier(f, y) === null) continue;
    const t = fdFrontier(f, y) - clamp(g, -2, 80);
    if (G.tech[f].t === null || Math.abs(G.tech[f].t - t) > 0.05) { G.tech[f].t = t; n++; }
  }
  if (n) { fdAutoRd(); fdEdited(`技術 ${n}分野`); }
  return n;
}
/* 製品：id → { gap（品質の遅れ）, pr（値段 %） } */
function fdEditProds(map) {
  const y = fdYf();
  let n = 0;
  for (const [id, o] of Object.entries(map)) {
    const p = G.prods.find(x => x.id === id);
    if (!p) continue;
    if (o.gap !== null && o.gap !== undefined && isFinite(o.gap)) { const qy = y - clamp(o.gap, -2, 80); if (Math.abs(qy - p.qy) > 0.05) { p.qy = qy; const C = fdCat(p.cat); p.spec = C.spec ? C.spec(qy, y) : p.spec; n++; } }
    if (o.pr !== null && o.pr !== undefined && isFinite(o.pr)) { const pr = clamp(Math.round(o.pr), 50, 200); if (pr !== p.pr) { p.pr = pr; n++; } }
  }
  if (n) fdEdited('製品');
  return n;
}
/* 新しい分野の製品をすぐに出す（その分野の技術の水準で。cap>0 なら本社工場にラインも足す） */
function fdEditAddProd(c, cap) {
  const C = fdCat(c);
  const y = fdYf();
  if (!C || y < C.from) return { ok: false, why: 'その年にはまだない製品です' };
  if (fdActiveProds(c).length) return { ok: false, why: 'その分野の製品はもう売っています' };
  const f = G.facs.find(x => x.r === 'jp') || G.facs[0];
  const lineCap = sum(G.facs, x => sum(x.lines.filter(l => l.cat === c), l => l.cap));
  if (cap > 0 && f) fdEditAddLine(f.id, c, cap, true);
  // 初めの四半期から作れるよう、ラインに見合う売れる見込みと在庫を持たせる（在庫の分は純資産で受ける）
  const inv0 = G.bs.inv;
  const p = fdCuProd(c, fdCatTech(c, y), 100, lineCap + (cap > 0 ? cap : 0), f, y);
  G.bs.cap += G.bs.inv - inv0;
  p.q0 = G.q;
  G.gen[c] = Math.max(1, G.gen[c] || 1);
  fdEdited(`${C.n}の製品「${p.name}」を出す`);
  return { ok: true, p };
}
/* 工場：fid → { skill, repair, lines: { cat: { cap, auto } } }。能力を増やした分は、機械を資産として持たせる */
function fdEditFacs(map) {
  const y = fdYf();
  let n = 0;
  for (const [fid, o] of Object.entries(map)) {
    const f = G.facs.find(x => x.id === fid);
    if (!f) continue;
    if (o.skill !== null && o.skill !== undefined && isFinite(o.skill)) { const s = clamp(o.skill, 0.5, 2); if (Math.abs(s - (f.skill || 1)) > 0.005) { f.skill = s; n++; } }
    if (o.repair && (f.dmgF || 1) > 1) { f.dmgF = 1; n++; }
    for (const [c, lo] of Object.entries(o.lines || {})) {
      const line = f.lines.find(l => l.cat === c);
      if (!line) continue;
      if (lo.cap !== null && lo.cap !== undefined && isFinite(lo.cap)) {
        const cap = Math.max(0, fdCat(c).kind === 'big' ? Math.round(lo.cap * 10) / 10 : Math.round(lo.cap));
        const d = cap - line.cap;
        if (d > 0) { const cost = fdCapexPer(c, f.r, y) * d; fdNewAsset({ n: `${f.n}の${fdCat(c).n}のライン`, cost, life: fdCat(c).lineLife || 15, f: f.id, kind: 'line', cat: c }); G.bs.cap += cost; }
        if (Math.abs(d) > 1e-9) { line.cap = cap; n++; }
      }
      if (lo.auto !== null && lo.auto !== undefined && isFinite(lo.auto)) { const a = clamp(lo.auto, 0, fdAutoMax(y)); if (Math.abs(a - line.auto) > 0.004) { line.auto = Math.round(a * 100) / 100; n++; } }
    }
    f.lines = f.lines.filter(l => l.cap > 0);
  }
  if (n) fdEdited('工場');
  return n;
}
/* ラインを足す（すぐに動く）。quiet：記録は呼び出し側で */
function fdEditAddLine(fid, c, cap, quiet) {
  const f = G.facs.find(x => x.id === fid);
  const y = fdYf();
  if (!f || !fdCat(c) || !(cap > 0)) return { ok: false, why: '工場・分野・能力を確かめてください' };
  const r = fdAddLine(f.id, c, cap, { free: true, now: true });
  r.line.ready = Math.min(r.line.ready, G.q);
  if (f.ready > G.q) f.ready = G.q;
  const cost = fdCapexPer(c, f.r, y) * cap;
  fdNewAsset({ n: `${f.n}の${fdCat(c).n}のライン`, cost, life: fdCat(c).lineLife || 15, f: f.id, kind: 'line', cat: c });
  G.bs.cap += cost;
  G.cum[c] = Math.max(G.cum[c] || 0, cap * 3);
  if (!quiet) fdEdited(`${f.n}に${fdCat(c).n}のライン`);
  return { ok: true };
}
/* 工場をすぐに建てる（その地域で工場を建てられる時代だけ） */
function fdEditAddFac(r, loc) {
  const y = fdYf();
  if (r !== 'jp' && fdRegAccess(r, y) < 3) return { ok: false, why: 'この時代、この地域には工場を建てられません' };
  const res = fdBuildFac(r, loc, { free: true, now: true, quiet: true });
  if (!res.ok) return res;
  const cost = fdFacCost(r, y);
  fdNewAsset({ n: `${res.f.n}の建物・土地`, cost, life: 40, f: res.f.id, kind: 'bld' });
  G.bs.cap += cost;
  fdEdited(`${FD_REG[r].n}に${res.f.n}`);
  return res;
}
/* 販路とブランド：地域 → { st（段階）, brand（0〜100） } */
function fdEditRegs(map) {
  const y = fdYf();
  let n = 0;
  for (const [r, o] of Object.entries(map)) {
    const R = G.reg[r];
    if (!R) continue;
    if (o.st !== null && o.st !== undefined && isFinite(o.st)) {
      const stv = clamp(Math.round(o.st), r === 'jp' ? 1 : 0, r === 'jp' ? 4 : Math.min(4, fdRegAccess(r, y)));
      if (stv !== R.st) { R.st = stv; R.dist = (r === 'jp' ? FD_STAGES_JP : FD_STAGES)[stv].dist; if (stv > 0 && R.since === null) R.since = G.q; n++; }
    }
    if (o.brand !== null && o.brand !== undefined && isFinite(o.brand)) { const b = clamp(o.brand, 0, 100); if (Math.abs(b - R.brand) > 0.4) { R.brand = b; n++; } }
  }
  if (n) fdEdited('販路とブランド');
  return n;
}
/* 人と仕組み：{ eng, prog: { k: bool }, kz（0〜1）, qc（0〜1） } */
function fdEditOrg(o) {
  const y = fdYf();
  let n = 0;
  if (o.eng !== null && o.eng !== undefined && isFinite(o.eng)) { const e = Math.max(0, Math.round(o.eng)); if (e !== G.staff.eng) { G.staff.eng = e; n++; } }
  for (const [k, on] of Object.entries(o.prog || {})) {
    if (!FD_PROGS[k] || y < FD_PROGS[k].from) continue;
    if (on && !G.prog[k]) { G.prog[k] = G.q; n++; } else if (!on && G.prog[k] !== undefined) { delete G.prog[k]; n++; }
  }
  if (o.kz !== null && o.kz !== undefined && isFinite(o.kz)) { const v = clamp(o.kz, 0, 1); if (Math.abs(v - (G.kaizen || 0)) > 0.004) { G.kaizen = v; n++; } }
  if (o.qc !== null && o.qc !== undefined && isFinite(o.qc)) { const v = clamp(o.qc, 0, 1); if (Math.abs(v - (G.qc || 0)) > 0.004) { G.qc = v; n++; } }
  if (n) fdEdited('人と仕組み');
  return n;
}
/* 会社が生まれた年（カスタムスタートでは、始めた年より前のこともある） */
function fdFounded() { return G.founded ?? G.y0; }
