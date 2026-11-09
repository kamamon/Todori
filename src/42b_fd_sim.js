'use strict';
/* =========================================================
 *  42b_fd_sim.js : 創業記モードの経営の計算（画面に依存しない）
 *   市場（需要・相場・ライバル・取り分）、生産（工場・ライン・人手・原価）、
 *   技術（研究・ライセンス）、開発（新しい製品）、地域（販路・ブランド・関税）、
 *   四半期の締め（損益・帳簿・年の決算）、自動の運営（番頭に任せる）
 * ========================================================= */

/* ---------- 技術 ---------- */
/* 世界の先端（技術年）。まだ生まれていない分野は null */
function fdFrontier(f, y = fdYf()) { const F = fdField(f); return y < F.born ? null : y; }
/* 研究の難しさ：先端から5年遅れのまま1年分を1年で進めるのに要る技術者の数。
   1910年（それより後に生まれた技術は生まれた年）の d0 人から、時代が下るほど技術は大きく複雑になる */
function fdDiffK(f, y = fdYf()) { const F = fdField(f); return Math.exp((y - Math.max(1910, F.born)) / (F.tau || 24)); }
function fdDiff(f, y = fdYf()) { return fdField(f).d0 * fdDiffK(f, y); }
/* 先端との差（年）。生まれていない・手を付けていない分野は Infinity */
function fdGap(f, y = fdYf()) { const T = G.tech[f]; const F = fdFrontier(f, y); if (F === null || !T || T.t === null) return Infinity; return F - T.t; }
/* 分野の技術を重みで合わせた「品質の技術年」 */
function fdCatTech(c, y = fdYf()) {
  const C = fdCat(c);
  let s = 0, w = 0;
  for (const [f, wt] of Object.entries(C.w)) {
    const F = fdFrontier(f, y);
    if (F === null) continue; // まだ世界に生まれていない技術は数えない
    const T = G.tech[f];
    // 手を付けていない分野は、生まれた年の少し前の水準のまま（世の中の品を買って使う程度）
    const t = T && T.t !== null ? T.t : Math.max(fdField(f).born - 4, F - 40);
    s += t * wt; w += wt;
  }
  return w ? s / w : y - 40;
}
/* その分野の製品を作れる年か：世界に出ている（ahead 年前から見せる）か、自社の技術がその製品の世に出た年の水準に届いている */
function fdCatOpen(c, y = fdYf(), ahead = 0) { const C = fdCat(c); return y >= C.from - ahead || fdCatTech(c, y) >= C.from - ahead; }
/* その分野に手を出せるか（開発を始められる技術があるか） */
function fdCatReady(c, y = fdYf()) {
  const C = fdCat(c);
  // 世界にまだない製品：その分野の技術が、世に出た年の水準に届いていれば、世界に先がけて作れる
  if (y < C.from && !(fdCatTech(c, y) >= C.from)) return { ok: false, why: `${Math.ceil(C.from)}年ごろまでは、世界にもまだない製品です（この分野の技術が${Math.ceil(C.from)}年の水準に届けば、世界に先がけて作れます）` };
  for (const [f, need] of Object.entries(C.req || {})) {
    const T = G.tech[f];
    if (!T || T.t === null) return { ok: false, why: `${fdField(f).n}の研究を始めていません` };
    if (T.t < need) return { ok: false, why: `${fdField(f).n}が${Math.floor(need)}年の水準に届いていません（いま${Math.floor(T.t)}年）` };
  }
  return { ok: true };
}
/* 日本の産業の地力：世界の先端より何年遅れているか（部品・材料・工作機械・人の層）。
   これより先へ一社だけで進むのは難しい（研究の効きが1年先へ行くごとに4割ずつ落ちる）。世の中から学べるのもこの水準まで */
const FD_JP_BASE = [[1900, 22], [1910, 17], [1920, 13], [1930, 10], [1937, 8], [1941, 8], [1945, 12], [1950, 10], [1955, 7], [1960, 5], [1965, 3.5], [1970, 2], [1975, 1], [1980, 0]];
function fdJpBase(y = fdYf(), f) { const b = f && fdField(f).base; return fdSer(b || FD_JP_BASE, y); }
/* 研究の進み（四半期）。engR：研究に回せる技術者の数 */
function fdResearch(engR) {
  const y = fdYf();
  const fr = fdOrgFriction();
  const cto = 1 + 0.08 * (fdAbil('cto', 'tech') - 3) + (G.prog.lab ? 0.15 : 0) + (G.prog.lab2 ? 0.1 : 0);
  const skill = 0.8 + 0.2 * Math.min(2, G.skill.eng);
  const totW = sum(Object.values(G.tech), T => (T.t === null && !T.start ? 0 : T.a || 0)) || 1;
  const iso = fdModsOf('isolate', null, null).length > 0;
  for (const [f, T] of Object.entries(G.tech)) {
    const F = fdFrontier(f, y);
    if (F === null) continue;
    if (T.t === null) {
      // 新しい分野：研究を振り向ければ、生まれた年より少し前の水準から始まる
      if ((T.a || 0) > 0) { T.t = Math.min(F, fdField(f).born) - 4; fdChron(`${fdField(f).n}の研究を始める`); } else continue;
    }
    const gap = F - T.t;
    const share = (T.a || 0) / totW;
    const e = Math.max(0, engR * share) * skill * cto * (1 - fr) / fdDiff(f, y) * (iso ? 0.35 : 1);
    const k = clamp(0.4 + 0.11 * gap, 0.12, 3.2);
    const base = fdJpBase(y, f);
    const over = Math.max(0, base - gap);
    let d = 0.25 * Math.pow(e, 0.6) * k * Math.pow(0.6, over);
    // 使っている分野は、遅れているほど世の中から学べる（輸入の機械を分解する・人を雇う・雑誌を読む）。日本の地力の水準まで。戦争で海外と切れている間は学べない
    if (fdFieldUsed(f) && !iso) d += 0.22 * clamp((gap - Math.max(4, base + 1)) / 12, 0, 1);
    // 先端より先へ進む上限はない（先へ行くほど研究の効きは鈍る。編集で先に置いた技術も、そのまま持ち越す）
    T.t += d;
    T.lastD = d * 4;
    if (gap > 0 && F - T.t <= 0 && !T.top) { T.top = G.q; fdChron(`${fdField(f).n}で世界の先端に並ぶ`, true); fdNews(`${fdField(f).n}の技術が世界の先端に並びました`, 'good'); }
  }
}
function fdFieldUsed(f) { return G.prods.some(p => p.active && ((fdCat(p.cat).w[f] || 0) > 0 || fdProdField(p.cat) === f || (fdCat(p.cat).mf || 'mat') === f)); }
/* 数か、[[年,値],…]か、どちらでも */
function fdV(v, y) { return Array.isArray(v) ? fdSer(v, y) : v; }

/* ---------- 市場 ---------- */
/* 相場（その分野の標準的な製品の値段）：今の価値の円 → その時代の円 */
function fdRefReal(c, y = fdYf()) { return fdSer(fdCat(c).price, y, true); }
/* 相場（その時代の円）。材料が急に高くなると（企業物価が消費者物価より上がると）、製品の値段もその7割ほど上がる */
const FD_WPI_PASS = 0.7;
function fdRef(c, y = fdYf()) { return fdRefReal(c, y) * fdCpi(y) * Math.pow(fdWpiShock(y), FD_WPI_PASS); }
/* 世界の年間需要（台）と、地域の割合 */
/* 世界にまだない製品でも、自社が世に出していれば、自社だけの小さな市場がある（世に出た年の需要から、1年早いごとに4%ずつ小さく） */
function fdWorldDem(c, y = fdYf()) {
  const C = fdCat(c);
  if (y >= C.from) return fdSer(C.dem, y, true);
  return G && G.prods && fdActiveProds(c).length ? fdSer(C.dem, C.from, true) * Math.exp(-(C.from - y) / 25) : 0;
}
/* 世界にまだない製品の年か（自社だけが作れる。ライバルも、その他の会社もいない） */
function fdEarly(c, y = fdYf()) { return y < fdCat(c).from; }
function fdRegShare(c, r, y = fdYf()) {
  const C = fdCat(c);
  const tbl = Array.isArray(C.reg) ? C.reg : FD_REGMIX[C.reg || 'ind'];
  const pts = tbl.map(([yy, o]) => [yy, o[r] || 0]);
  return Math.max(0, fdSer(pts, y));
}
/* 景気の波：その年の成長率が、まわりの年の平均より高い・低い分だけ需要が増減（設備は大きく、消費財は小さく揺れる） */
function fdCycle(c, r, y = fdYf()) {
  const C = fdCat(c);
  const yy = Math.floor(y);
  // 敗戦の前後の日本は、成長率の上下では表せない（出来事の補正で表す）
  if (r === 'jp' && y >= 1944 && y < 1951) return 1;
  const g = fdGrowth(yy, r);
  let avg = 0;
  for (let k = -4; k <= 4; k++) avg += fdGrowth(yy + k, r);
  avg /= 9;
  const amp = C.kind === 'cap' || C.kind === 'big' ? 3.2 : C.kind === 'dur' ? 2.2 : 1.6;
  return clamp(1 + amp * (g - avg) / 100, 0.35, 1.6);
}
/* その四半期の需要（台） */
function fdDemandQ(c, r, q = G.q) {
  const y = fdYf(q);
  return fdWorldDem(c, y) * fdRegShare(c, r, y) / 4 * fdCycle(c, r, y) * fdModMul('dem', c, r);
}
/* 関税と運賃（輸出したときの上乗せの割合） */
function fdTariff(c, r, y = fdYf()) {
  const R = FD_REG[r];
  const C = fdCat(c);
  const t = (R.tariffK && R.tariffK[C.tclass || C.kind]) || R.tariff;
  // 出来事による上乗せ（輸入課徴金・報復の関税など。%の足し算）
  const add = G && G.mods ? sum(fdModsOf('tariff', c, r), m => m.v) : 0;
  return Math.max(0, (t ? fdSer(t, y) : 0) + add) / 100;
}
function fdFreightBase(c, y = fdYf()) { const C = fdCat(c); return fdSer([[1910, 0.1], [1960, 0.06], [2000, 0.035], [2025, 0.03]], y) * (C.bulk || 1) * fdModMul('freight', c, '*'); }
/* 自社の輸出の運賃（相場に対する割合）。日本の中で売る分はかからない */
function fdFreight(c, r, y = fdYf()) { return r === 'jp' ? 0 : fdFreightBase(c, y); }
/* 為替の効き方：円の実力（fdRer）の半分を値段に転嫁し、残りは輸出する会社の円の手取りで吸収する
   （円高では海外で割高になり、手取りも減る。円安では海外で割安になり、手取りも増える） */
const FD_FX_PASS = 0.5;
/* 円の実力の、長い目で見た水準（前後12年の平均）からのずれ。物価の伸びの差（生産性の差）による長い流れは除き、
   金解禁・円安の1930年代・プラザ合意後の円高・2010年代の円高と2020年代の円安などの波だけを効かせる */
const FD_RERR = {};
function fdRerRel(y = fdYf()) {
  const k0 = Math.round(y * 4) / 4;
  if (FD_RERR[k0] !== undefined) return FD_RERR[k0];
  let a = 0, n = 0;
  // 2030年より先は見込み（横ばい）なので、2030年の値で数える（2040年代でも平均が取れるように）
  for (let k = -12; k <= 12; k += 1) { const yy = Math.min(2030, k0 + k); a += Math.log(fdRer(yy)); n++; }
  return (FD_RERR[k0] = clamp(fdRer(k0) / Math.exp(a / n), 0.4, 2.5));
}
function fdFxPass(y = fdYf()) { return Math.pow(fdRerRel(y), FD_FX_PASS); }
function fdFxTake(y = fdYf()) { return Math.pow(fdRerRel(y), FD_FX_PASS - 1); }
/* 家元びいき：国内の買い手が国産を選びやすい度合い（国産化の奨励・輸入の制限） */
/* 地元の会社がひいきされる度合い。c を渡すと分野の「国産を選ぶ度合い」（発電所・鉄道・情報システムなどは強い）を掛ける */
function fdHomeBias(r, y = fdYf(), c) { const R = FD_REG[r]; return (R.home ? fdSer(R.home, y) : 0.2) * (c ? fdCat(c).natl ?? 1 : 1); }

const FD_BETA = { q: 1.0, p: 2.6, b: 0.9, d: 1.0 };
/* 自社の製品の、その地域での魅力（効用）の材料 */
function fdMyOffer(p, r, y = fdYf()) {
  const C = fdCat(p.cat);
  const F = y;
  const reg = G.reg[r];
  const local = fdLocalShare(p.cat, r);
  const exportK = r === 'jp' ? 1 : (1 + fdTariff(p.cat, r, y) + fdFreight(p.cat, r, y)) * fdFxPass(y);
  const priceK = (fdPr(p, r) / 100) * (local + (1 - local) * exportK);
  const fit = reg.st >= 4 ? 1.5 : 0;
  const Q = p.qy - p.def * 15 + fit + (G.reg[r].qbonus || 0);
  const home = r === 'jp' ? fdHomeBias('jp', y, p.cat) : local > 0.5 ? fdHomeBias(r, y, p.cat) * 0.5 : 0;
  const pen = r === 'jp' ? 0 : sum(fdModsOf('jpPen', p.cat, r), m => m.v) * (1 - 0.6 * local);
  return { Q, priceK, B: reg.brand, D: reg.dist * (C.kind === 'big' ? 0.7 + 0.3 * reg.dist : 1), home, F, extra: -pen - fdFarPen(C, r === 'jp' ? 1 : local) };
}
/* 人が現地で働く仕事（情報システムなど）は、遠くからでは売りにくい（現地の拠点で作る割合が低いほど不利） */
function fdFarPen(C, local) {
  return C.kind === 'svc' ? 1.2 * (1 - local) : 0;
}
/* 値段（相場の何%か）。統制の時代は、国内では公定の値段より高く売れない */
function fdPr(p, r = 'jp') {
  if (r !== 'jp') { const f = fdModsOf('pfloor', p.cat, r)[0]; return f ? Math.max(p.pr, f.v) : p.pr; }
  const m = fdModsOf('pcap', p.cat, 'jp')[0];
  return m ? Math.min(p.pr, m.v) : p.pr;
}
function fdUtil(o) {
  return FD_BETA.q * (o.Q - o.F) / 10 - FD_BETA.p * Math.log(Math.max(0.05, o.priceK)) + FD_BETA.b * (o.B - 50) / 50 + FD_BETA.d * Math.log(Math.max(0.01, o.D)) + (o.home || 0) + (o.extra || 0);
}
/* ライバル（データの型と、ゲームごとのばらつき・動き） */
function fdRivalState(c, rv) {
  const key = c + ':' + rv.id;
  return G.rv[key] || (G.rv[key] = { dq: Math.round(randn() * 15) / 10, dp: Math.round(randn() * 4) / 100, alive: true });
}
function fdRivalOffer(c, rv, r, y = fdYf()) {
  const st = fdRivalState(c, rv);
  if (!st.alive || y < rv.from || y > (rv.to || 9999)) return null;
  const reach = typeof rv.reach === 'function' ? rv.reach(r, y) : rv.reach[r];
  const rch = Array.isArray(reach) ? fdSer(reach, y) : reach || 0;
  if (rch <= 0.001) return null;
  const lag = fdV(rv.lag, y) - st.dq;
  // 輸入なら関税・運賃・為替。現地で作っている分（loc）はかからない
  let priceK = fdV(rv.pf, y) * (1 + st.dp);
  if (rv.o !== r) {
    const lc = rv.loc && rv.loc[r] !== undefined ? (Array.isArray(rv.loc[r]) ? fdSer(rv.loc[r], y) : rv.loc[r]) : 0;
    const fxK = r === 'jp' ? 1 / fdFxPass(y) : rv.o === 'jp' ? fdFxPass(y) : 1;
    priceK *= lc + (1 - lc) * (1 + fdTariff(c, r, y) + fdFreightBase(c, y)) * fxK;
  }
  const home = rv.o === r ? fdHomeBias(r, y, c) : 0;
  const B = Array.isArray(rv.br) ? fdSer(rv.br, y) : rv.br;
  const pen = rv.o === 'jp' && r !== 'jp' ? sum(fdModsOf('jpPen', c, r), m => m.v) : 0;
  const lcl = rv.o === r ? 1 : rv.loc && rv.loc[r] !== undefined ? (Array.isArray(rv.loc[r]) ? fdSer(rv.loc[r], y) : rv.loc[r]) : 0;
  return { Q: y - lag, priceK, B, D: rch * fdRegAccessRival(rv, c, r, y), home, F: y, n: rv.n, id: rv.id, o: rv.o, extra: -pen - fdFarPen(fdCat(c), lcl) };
}
/* 戦争・法律などで、外国の会社がその地域で売れない・売りにくいとき */
function fdRegAccessRival(rv, c, r, y) {
  let v = 1;
  for (const m of fdModsOf('rival', c, r)) if (!m.o || m.o === rv.o || (m.o === 'foreign' && rv.o !== r)) v = Math.min(v, m.v);
  void y;
  return v;
}
/* 地域の工場で作る割合（関税・為替の影響を受けない分） */
function fdLocalShare(c, r) {
  if (r === 'jp') return 1;
  const cap = sum(G.facs.filter(f => f.r === r && f.ready <= G.q), f => sum(f.lines.filter(l => l.cat === c), l => l.cap / 4));
  if (!cap) return 0;
  // ならした需要と比べる（その四半期の需要と比べると、現地の割合と売れ行きが交互に振れる）
  const m = G.mk[c] && G.mk[c][r];
  const want = Math.max(1, (m ? m.wantS ?? m.want : 0) || cap);
  return clamp(cap / want, 0, 1);
}
/* 市場の計算：需要・相場・各社の魅力と取り分。me は自社の製品ごとの「売りたい台数」 */
function fdMarket(c, r, q = G.q) {
  const y = fdYf(q);
  const C = fdCat(c);
  const D = fdDemandQ(c, r, q);
  const items = [];
  const acc = fdRegAccess(r, y);
  const reg = G.reg[r];
  if (acc >= 1 && reg.st >= 1) for (const p of fdActiveProds(c)) {
    if (p.ban && p.ban.includes(r)) continue;
    const o = fdMyOffer(p, r, y);
    items.push(Object.assign(o, { me: true, p, n: p.name }));
  }
  const early = fdEarly(c, y); // 世界にまだない製品なら、ライバルはいない（買わずにこれまでの品で済ませる人だけ）
  if (!early) for (const rv of C.rivals || []) { const o = fdRivalOffer(c, rv, r, y); if (o) items.push(o); }
  // その他（小さな会社・輸入品の寄せ集め）
  const fl = C.fringe || {};
  const fo = { n: 'その他の会社', Q: y - fdV(fl.lag || [[1910, 14], [1960, 8], [2025, 5]], y), priceK: fdV(fl.pf || 0.85, y), B: 25, D: 0.6, home: fdHomeBias(r, y, c) * 0.6, F: y, fringe: true, extra: Math.log(Math.max(0.05, fdV(fl.w || 3, y) * (FD_REG[r].fringe || 1))) };
  if (early) fo.n = 'これまでの品で済ませる人';
  items.push(fo);
  let tot = 0;
  // いちばん大きい魅力を引いてから指数をとる（はるか先の品質でも、数があふれない）
  for (const it of items) it.U = fdUtil(it);
  const uMax = Math.max(...items.map(it => (Number.isFinite(it.U) ? it.U : -Infinity)));
  for (const it of items) { it.e = Number.isFinite(it.U) ? Math.exp(it.U - uMax) : 0; tot += it.e; }
  for (const it of items) { it.share = it.e / tot; it.units = D * it.share; }
  return { c, r, D, ref: fdRef(c, y), items };
}

/* ---------- 生産 ---------- */
/* 世界の先端の工場で1台に要る工数（時間）と、材料費の割合（相場に対して） */
function fdHrsFront(c, y = fdYf()) { return fdSer(fdCat(c).hrs, y, true); }
function fdMatShare(c, y = fdYf()) { return fdSer(fdCat(c).mat || [[1900, 0.45]], y); }
/* 材料の値動き：企業物価と消費者物価の比の、まわりの年からのずれ（大戦・朝鮮戦争・石油危機で材料が急に高くなる） */
const FD_WPIS = {};
function fdWpiShock(y = fdYf()) {
  const k0 = Math.round(y * 4) / 4;
  if (FD_WPIS[k0] !== undefined) return FD_WPIS[k0];
  const r = k => Math.log(fdWpi(k) / fdCpi(k));
  let a = 0;
  for (let k = -5; k <= 5; k++) a += r(k0 + k);
  return (FD_WPIS[k0] = clamp(Math.exp(r(k0) - a / 11), 0.75, 1.5));
}
/* ラインの能力1台/年あたりの設備投資（その時代の円）：相場 × 設備の重さ（売上1円を作るのに要る設備の円） */
function fdCapexPer(c, r = 'jp', y = fdYf()) { return fdRef(c, y) * fdSer(fdCat(c).capex, y) * Math.pow(fdWpiShock(y), 1 - FD_WPI_PASS) * (r === 'jp' ? 1 : FD_REG[r].build || 1); }
/* 作るのに効く技術（ふつうは生産技術。ITのサービスならソフトウェア） */
function fdProdField(c) { return fdCat(c).pf || 'mach'; }
/* 自動化の度合いの、その時代のふつう（世界の先端の工場の工数は、このくらい自動化した工場の値） */
function fdAutoTyp(y = fdYf()) { return fdAutoMax(y) * 0.7; }
/* 工場の工数の倍率（世界の先端の、ふつうの工場＝1）。生産技術の差・自動化（時代のふつうと比べて）・カイゼン・腕・工場長。
   良くする工夫は重ねるほど効きが鈍る（1より小さい分は0.6乗）。立ち上げたばかりのライン（慣れ）・組織の摩擦・被害は、そのまま重くなる */
function fdHrsMul(f, line, y = fdYf()) {
  const gap = fdGap(fdProdField(line.cat), y);
  // 先を行く分の省力は60年分まで（はるか先の技術でも、工数が0にはならない）
  const techF = gap === Infinity ? 2.5 : gap > 0 ? Math.pow(1.035, gap) : Math.pow(0.98, Math.min(60, -gap));
  const ak = 0.6 * (fdCat(line.cat).autoK ?? 1);
  const autoF = (1 - ak * (line.auto || 0)) / (1 - ak * fdAutoTyp(y));
  const kzF = 1 - 0.15 * (G.kaizen || 0);
  const skillF = 1 / (0.9 + 0.1 * Math.min(2, f.skill || 1));
  const cooF = 1 - 0.03 * (fdAbil('coo', 'prod') - 3);
  const good = techF * autoF * kzF * skillF * cooF;
  const cumC = G.cum[line.cat] || 0;
  const learnF = clamp(Math.pow(Math.max(1, cumC) / Math.max(1, line.cap * 3), -0.12), 1, 1.6);
  return (good < 1 ? Math.pow(good, 0.6) : good) * learnF * (1 + fdOrgFriction()) * (f.dmgF || 1);
}
/* 不良率（作った品のうち作り直す・捨てる割合） */
function fdDefect(c, y = fdYf()) {
  const g0 = fdGap(fdProdField(c), y);
  const gap = Math.max(0, g0 === Infinity ? 30 : g0);
  return clamp((0.015 + 0.0035 * gap) * (1 - 0.75 * (G.qc || 0)) * (1 + fdOrgFriction()), 0.004, 0.25);
}
/* 職種の賃金の倍率（工場の工員＝1。システムの技術者などは高い） */
function fdWkMul(c) { return fdCat(c).wkMul || 1; }
/* 1台の変動費（材料＋直接の人件費＋工場の間接費）。f：作る工場 */
const FD_OVH = [[1910, 0.05], [1950, 0.06], [1980, 0.07]];
function fdUnitCost(c, f, y = fdYf()) {
  const line = f.lines.find(l => l.cat === c);
  if (!line) return null;
  // 材料の歩留まり：材料の技術（布なら紡織の技術）の遅れの分だけ無駄が出る
  const mgap = fdGap(fdCat(c).mf || 'mat', y);
  const matEff = (1 + 0.008 * clamp(mgap === Infinity ? 30 : mgap, 0, 40)) * (1 - 0.04 * (G.kaizen || 0));
  const mat = fdRef(c, y) * fdMatShare(c, y) * Math.pow(fdWpiShock(y), 1 - FD_WPI_PASS) * matEff * fdModMul('cost', c, f.r);
  const hrs = fdHrsFront(c, y) * fdHrsMul(f, line, y);
  const lab = hrs * fdPayQ('wk', f.r, y) * fdWkMul(c) / (fdHoursM(y) * 3 * 0.92);
  const d = fdDefect(c, y);
  // 工場の間接費（間接の人・電気・消耗品・構内の物流・検査）。相場に比例し、カイゼンで減る
  const ovh = fdRef(c, y) * fdSer(FD_OVH, y) * (fdCat(c).ovhK ?? 1) * (1 - 0.15 * (G.kaizen || 0)) * (f.dmgF || 1);
  return { mat, lab, ovh, hrs, d, v: (mat + lab) * (1 + d) + ovh };
}
/* 工場のラインの能力の倍率（被害・部品の不足・争議など） */
function fdCapK(f, c) { return (f.dmgF ? 1 / f.dmgF : 1) * fdModMul('cap', c, f.r) * (f.strike === G.q ? 0.35 : 1); }
/* 分野ごとのラインの能力（台/四半期、出来上がった分） */
function fdCapQ(c, r) { return sum(G.facs.filter(f => f.ready <= G.q && (!r || f.r === r)), f => sum(f.lines.filter(l => l.cat === c && (l.ready ?? 0) <= G.q), l => l.cap / 4 * fdCapK(f, c))); }
/* 自動の生産計画：前の四半期に売りたかった台数 ＋ 在庫の目安 − 今の在庫（＋受けている注文の分） */
function fdPlanQty(p) {
  if (p.plan && p.plan.mode === 'manual') return Math.max(0, p.plan.qty || 0);
  const want = p.want || p.sold || 0;
  const stockT = want * (0.55 - 0.3 * (G.kaizen || 0));
  const ord = fdOrderNeedQ(p.cat) / Math.max(1, fdActiveProds(p.cat).length);
  return Math.max(0, want * 1.04 + stockT + ord - p.stock);
}

/* ---------- 大口の注文（官公庁・軍・電力会社・特需など） ----------
   { id, cat, n：台数, left：残り, pr：相場の何%で売るか, r：地域, q0, q1：納期の四半期, t：名前 }
   役務の注文（修理・据付など）は { svc:true, revR：四半期の売上（今の価値）, cost：原価の割合, q0, q1, t } */
function fdOrders(cat) { return (G.orders || []).filter(o => !o.done && G.q >= o.q0 && G.q <= o.q1 && (cat === undefined || o.cat === cat)); }
function fdOrderNeedQ(c) { return sum(fdOrders(c).filter(o => !o.svc), o => Math.min(o.left, o.n / Math.max(1, o.q1 - o.q0 + 1) * 1.3)); }
function fdAddOrder(o) {
  G.orders = G.orders || [];
  const x = Object.assign({ id: 'O' + (++G.seq), r: 'jp', pr: 100, q0: G.q, q1: G.q + 4 }, o);
  if (!x.svc) x.left = x.n;
  G.orders.push(x);
  return x;
}
/* 注文の納品（販売の前に、在庫から先に回す） */
function fdDeliverOrders(res) {
  const y = fdYf();
  for (const o of fdOrders()) {
    if (o.svc) continue;
    const ps = fdActiveProds(o.cat).filter(p => p.stock > 0.01);
    const perQ = o.n / Math.max(1, o.q1 - o.q0 + 1);
    let need = Math.min(o.left, perQ * 1.5 + (G.q === o.q1 ? o.left : 0));
    for (const p of ps) {
      if (need <= 0) break;
      const n = Math.min(need, p.stock);
      const uc = p.stockCost / p.stock;
      const rev = n * fdRef(o.cat, y) * o.pr / 100;
      p.stock -= n; p.stockCost = Math.max(0, p.stockCost - n * uc);
      p.ordN = (p.ordN || 0) + n; p.ordRev = (p.ordRev || 0) + rev;
      res.sales += rev; res.cogs += n * uc; res.units += n;
      res.byReg[o.r] = (res.byReg[o.r] || 0) + rev;
      res.byCat[o.cat] = (res.byCat[o.cat] || 0) + rev;
      o.left -= n; need -= n;
    }
    if (o.left <= 0.5) { o.done = G.q; fdNews(`「${o.t}」の注文を納め終えました`, 'good'); }
    else if (G.q >= o.q1) {
      o.done = G.q; o.failed = true;
      G.reg[o.r].brand = Math.max(1, G.reg[o.r].brand - 4);
      fdNews(`「${o.t}」の注文を納期までに納められませんでした（${fmtNum(o.left, 0)}${fdCat(o.cat).unit}が残った）。信用が落ちました`, 'bad');
    }
  }
}
/* 役務の注文の売上と原価 */
function fdServiceOrders() {
  let rev = 0, cost = 0;
  for (const o of fdOrders()) {
    if (!o.svc) continue;
    const v = fdNominal(o.revR);
    rev += v; cost += v * (o.cost ?? 0.7);
    if (G.q >= o.q1) o.done = G.q;
  }
  return { rev, cost };
}

/* ---------- 事業の売却・買収・資産 ---------- */
/* 事業を売る：その分野の製品・在庫・ラインを、相手に渡して代金を受け取る */
function fdBizValue(c) {
  const ps = G.prods.filter(p => p.cat === c && p.active);
  const rev = sum(ps, p => (p.rev || 0) + (p.ordRev || 0)) * 4;
  const margin = sum(ps, p => (p.rev || 0) - (p.sold || 0) * (p.ucost || 0)) / Math.max(1, sum(ps, p => p.rev || 0));
  const bv = sum(G.assets.filter(a => !a.gone && a.cat === c && (a.kind === 'line' || a.kind === 'auto')), fdAssetBV) + sum(ps, p => p.stockCost);
  return Math.max(bv * 0.6, rev * clamp(0.25 + margin * 4, 0.2, 2.2));
}
function fdSellBiz(c, price = fdBizValue(c), why = '売却') {
  const C = fdCat(c);
  const ps = G.prods.filter(p => p.cat === c && p.active);
  const invV = sum(ps, p => p.stockCost);
  for (const p of ps) { p.active = false; p.end = G.q; p.stock = 0; p.stockCost = 0; p.want = 0; p.sold = 0; p.rev = 0; }
  G.bs.inv -= invV;
  for (const a of G.assets.filter(x => !x.gone && x.cat === c && (x.kind === 'line' || x.kind === 'auto'))) fdLoseAsset(a, 0);
  // 工員はラインと一緒に移る
  for (const f of G.facs) {
    const all = sum(f.lines, l => l.cap * fdHrsFront(l.cat));
    const mine = sum(f.lines.filter(l => l.cat === c), l => l.cap * fdHrsFront(l.cat));
    if (all > 0 && mine > 0) f.wk = Math.round((f.wk || 0) * (1 - mine / all));
    f.lines = f.lines.filter(l => l.cat !== c);
  }
  G.staff.wk = sum(G.facs, f => f.wk || 0);
  G.devs = G.devs.filter(d => d.cat !== c);
  for (const o of fdOrders(c)) o.done = G.q;
  G.bs.cash += price;
  G.yr.pl.extra += price - invV; G.qr.pl.extra += price - invV;
  G.flags['exit_' + c] = G.q;
  fdChron(`${C.n}の事業を${why}（${fmtYen(price)}）`, true);
  fdNews(`${C.n}の事業を${why}しました。代金 ${fmtYen(price)}`, 'info');
  return { ok: true, price };
}
/* 買収：工場・ライン・販路・ブランド・技術をまとめて手に入れる。のれんは20年で償却 */
function fdAcquire(o) {
  const y = fdYf();
  const price = o.price;
  if (G.bs.cash < price) {
    const room = fdCreditLimit() * 1.3 - fdDebt();
    if (room < price - G.bs.cash) return { ok: false, why: 'お金が足りず、銀行も貸してくれません' };
    fdBorrow(price - G.bs.cash + fdNominal(1e9), 10, `${o.n}の買収資金`);
  }
  G.bs.cash -= price;
  let tangible = 0;
  if (o.fac) {
    const f = fdBuildFac(o.fac.r, o.fac.loc, { n: o.fac.n, free: true, now: true, quiet: true }).f;
    f.skill = 1.2;
    const v = Math.min(price * 0.45, fdCapexPer(o.cat, o.fac.r, y) * o.cap * 0.8 + fdFacCost(o.fac.r, y));
    fdAddLine(f.id, o.cat, o.cap, { free: true, now: true });
    const ln = f.lines.find(l => l.cat === o.cat); if (ln) ln.auto = Math.max(ln.auto, fdAutoMax(y) * 0.7);
    fdNewAsset({ n: `${o.n}の工場と設備`, cost: v, life: 20, f: f.id, kind: 'line', cat: o.cat });
    tangible = v;
    f.wk = Math.ceil(fdFacWkFull(f, y) * 0.9);
  }
  const gw = price - tangible;
  if (gw > 0) { G.bs.inv2 += gw; G.gw = G.gw || []; G.gw.push({ n: o.n, amt: gw, left: gw, q: G.q, life: 20 }); }
  for (const [r, d] of Object.entries(o.dist || {})) { const R = G.reg[r]; if (R.st < 2 && fdRegAccess(r, y) >= 2) R.st = 2; R.dist = Math.min(0.95, R.dist + d); }
  for (const [r, b] of Object.entries(o.brand || {})) G.reg[r].brand = clamp(G.reg[r].brand + b, 1, 95);
  for (const [f, d] of Object.entries(o.tech || {})) { const T = G.tech[f]; if (T) T.t = T.t === null ? y - 3 : Math.max(T.t, Math.min(y + 1, T.t + d)); }
  for (const id of o.kill || []) { const st = G.rv[o.cat + ':' + id]; if (st) st.alive = false; }
  if (!fdActiveProds(o.cat).length) {
    const p = { id: 'P' + (++G.seq), cat: o.cat, name: o.prod || `${fdCat(o.cat).n}（${o.n}）`, gen: (G.gen[o.cat] || 0) + 1, qy: o.qy ?? fdCatTech(o.cat, y), q0: G.q, pr: 100, stock: 0, stockCost: 0, cum: 0, sold: 0, want: 0, made: 0, def: 0.03, active: true, plan: { mode: 'auto', qty: 0 }, ban: [] };
    p.spec = fdCat(o.cat).spec ? fdCat(o.cat).spec(p.qy, y) : '';
    G.gen[o.cat] = p.gen; G.miles['cat_' + o.cat] = G.miles['cat_' + o.cat] ?? G.q;
    G.prods.push(p);
  }
  fdChron(`${o.n}を買収（${fmtYen(price)}）`, true);
  return { ok: true };
}
/* のれんの償却（四半期） */
function fdAmortizeGw() {
  let x = 0;
  for (const g of G.gw || []) { if (g.left <= 0) continue; const d = Math.min(g.left, g.amt / (g.life * 4)); g.left -= d; x += d; }
  if (x > 0) { G.bs.inv2 -= x; G.yr.pl.sga += x; G.qr.pl.sga += x; }
  return x;
}
/* 工場の被害（frac：失った能力の割合）。帳簿価額の同じ割合を特別損失に */
function fdDamageFac(f, frac, why) {
  frac = clamp(frac, 0, 0.95);
  f.dmgF = (f.dmgF || 1) / (1 - frac);
  let loss = 0;
  for (const a of G.assets.filter(x => !x.gone && x.f === f.id)) { const x = fdAssetBV(a) * frac; a.booked += x; loss += x; }
  G.bs.ppe -= loss; G.yr.pl.extra -= loss; G.qr.pl.extra -= loss;
  if (why) fdNews(`${f.n}が${why}で被害を受けました（能力の約${fmtPct(frac * 100, 0)}を失う。損失 ${fmtYen(loss)}）`, 'bad');
  return loss;
}
/* 工場の被害を直す費用と、直す（被害は放っておいても少しずつ片付くが、直せばすぐ元に戻る） */
function fdRepairCost(f) { return sum(G.assets.filter(a => a.f === f.id && !a.gone), a => a.cost) * 0.25 * (1 - 1 / (f.dmgF || 1)); }
function fdRepairFac(f) {
  const cost = fdRepairCost(f);
  if (cost <= 0) return { ok: false };
  if (G.bs.cash < cost) return { ok: false, why: 'お金が足りません' };
  G.bs.cash -= cost;
  fdNewAsset({ n: `${f.n}の復旧`, cost, life: 20, f: f.id, kind: 'bld' });
  f.dmgF = 1;
  return { ok: true, cost };
}
/* 工場を失う（海外の資産の接収など） */
function fdLoseFac(f, why) {
  let loss = 0;
  for (const a of G.assets.filter(x => !x.gone && x.f === f.id)) loss += fdLoseAsset(a, 0);
  G.facs = G.facs.filter(x => x !== f);
  G.staff.wk = sum(G.facs, x => x.wk || 0);
  fdChron(`${f.n}を失う（${why}）`, true);
  return loss;
}
/* 資産の再評価（インフレで帳簿の値が実態より小さくなったとき）。増えた分は純資産へ */
function fdRevalue(k, before) {
  let add = 0;
  for (const a of G.assets) {
    if (a.gone || a.q > before) continue;
    const bv = fdAssetBV(a);
    const x = bv * (k(a.q) - 1);
    if (x <= 0) continue;
    a.cost += x; add += x;
  }
  G.bs.ppe += add; G.bs.re += add;
  return add;
}
/* ライバルを市場から消す（倒産・買収・撤退） */
function fdKillRival(c, id) { const st = G.rv[c + ':' + id]; if (st && st.alive) { st.alive = false; return true; } return false; }
/* 四半期の生産。工場のラインを製品に割り振り、人手が足りなければ減らす */
function fdProduce() {
  const y = fdYf();
  const out = { units: 0, cost: 0, mat: 0, lab: 0, ovh: 0, idle: 0 };
  for (const f of G.facs) { f.used = 0; f.needWk = 0; f.out = 0; f.labC = 0; f.wkH = 0; }
  const cats = [...new Set(fdActiveProds().map(p => p.cat))];
  for (const c of cats) {
    const ps = fdActiveProds(c);
    let plan = sum(ps, fdPlanQty);
    const fs = G.facs.filter(f => f.ready <= G.q && f.lines.some(l => l.cat === c && (l.ready ?? 0) <= G.q));
    if (!fs.length || plan <= 0) { for (const p of ps) p.made = 0; continue; }
    // 安く作れる工場から順に割り振る
    const opts = fs.map(f => ({ f, line: f.lines.find(l => l.cat === c), uc: fdUnitCost(c, f, y) })).sort((a, b) => a.uc.v - b.uc.v);
    let left = plan;
    const made = [];
    for (const o of opts) {
      if (left <= 0) break;
      // 被害・部品や人の不足・争議の分だけ、作れる量が減る
      const capQ = o.line.cap / 4 * fdCapK(o.f, c);
      const n = Math.min(left, capQ);
      made.push({ o, n });
      left -= n;
    }
    const total = sum(made, m => m.n);
    // 人手（工員）の制約：その工場の工員の時間で作れるだけ
    let realTot = 0, cost = 0;
    for (const m of made) {
      const hoursAvail = (m.o.f.wk || 0) * fdHoursM(y) * 3 * 0.92 - m.o.f.used;
      const need = m.n * m.o.uc.hrs * (1 + m.o.uc.d);
      const k = need > 0 ? clamp(hoursAvail / need, 0, 1) : 1;
      const n = m.n * k;
      m.o.f.used += n * m.o.uc.hrs * (1 + m.o.uc.d);
      m.o.f.wkH += n * m.o.uc.hrs * (1 + m.o.uc.d) * fdWkMul(c);
      m.o.f.needWk += m.n * m.o.uc.hrs * (1 + m.o.uc.d) / (fdHoursM(y) * 3 * 0.92);
      m.o.f.out += n;
      m.o.f.labC = (m.o.f.labC || 0) + n * m.o.uc.lab * (1 + m.o.uc.d);
      realTot += n;
      cost += n * m.o.uc.v;
      out.mat += n * m.o.uc.mat * (1 + m.o.uc.d);
      out.lab += n * m.o.uc.lab * (1 + m.o.uc.d);
      out.ovh += n * m.o.uc.ovh;
      for (const p of ps) p.ucost = m.o.uc.v; // 表示用（いちばん安い工場の値で上書きされる）
    }
    // 製品に配る
    const avgC = realTot ? cost / realTot : 0;
    for (const p of ps) {
      const want = fdPlanQty(p);
      const n = plan ? realTot * want / plan : 0;
      p.made = n;
      p.stockCost += n * avgC;
      p.stock += n;
      p.cum += n;
      if (opts[0]) p.ucost = opts[0].uc.v;
    }
    G.cum[c] = (G.cum[c] || 0) + realTot;
    out.units += realTot; out.cost += cost;
    void total;
  }
  // 工場の工員：作らない時間の給料は、操業度の差（原価に入れる）
  for (const f of G.facs) {
    // 工員の給料の倍率は、作っている品の職種で（綿布の工場は安く、情報システムの開発センターは高い）
    const capH = sum(f.lines, l => l.cap * fdHrsFront(l.cat, y));
    const wkM = f.used > 0 ? f.wkH / f.used : capH > 0 ? sum(f.lines, l => l.cap * fdHrsFront(l.cat, y) * fdWkMul(l.cat)) / capH : 1;
    f.wkMulNow = wkM;
    const pay = (f.wk || 0) * fdPayQ('wk', f.r, y) * wkM;
    const hoursAll = (f.wk || 0) * fdHoursM(y) * 3 * 0.92;
    out.idle += Math.max(0, pay - (f.labC || 0));
    f.util = hoursAll > 0 ? clamp(f.used / hoursAll, 0, 1) : 0;
  }
  return out;
}

/* ---------- 販売 ---------- */
function fdSell() {
  const y = fdYf();
  const res = { sales: 0, cogs: 0, units: 0, exportSales: 0, freight: 0, tariff: 0, comm: 0, byReg: {}, byCat: {} };
  for (const r of fdRegOrder()) res.byReg[r] = 0;
  for (const p of G.prods) { p.ordN = 0; p.ordRev = 0; }
  // 大口の注文を先に納める
  fdDeliverOrders(res);
  const cats = Object.keys(fdS().cats);
  for (const c of cats) {
    if (!G.mk[c]) G.mk[c] = {};
    const wantBy = new Map();
    const mkt = {};
    for (const r of fdRegOrder()) {
      const M = fdMarket(c, r);
      mkt[r] = M;
      const mine = M.items.filter(it => it.me);
      for (const it of mine) wantBy.set(it.p, (wantBy.get(it.p) || 0) + it.units);
      const wantNow = sum(mine, it => it.units);
      const prevS = G.mk[c][r] && G.mk[c][r].wantS;
      G.mk[c][r] = { D: M.D, ref: M.ref, share: sum(mine, it => it.share), want: wantNow, wantS: prevS ? prevS * 0.75 + wantNow * 0.25 : wantNow, top: M.items.slice().sort((a, b) => b.share - a.share).slice(0, 6).map(it => ({ n: it.n, s: it.share, me: !!it.me, o: it.o, Q: it.Q, pk: it.priceK })) };
    }
    for (const p of fdActiveProds(c)) {
      const want = wantBy.get(p) || 0;
      p.want = want;
      const sold = Math.min(want, p.stock);
      const k = want > 0 ? sold / want : 0;
      const ucost = p.stock > 0 ? p.stockCost / p.stock : 0;
      let rev = 0;
      for (const r of fdRegOrder()) {
        const M = mkt[r];
        const it = M.items.find(x => x.me && x.p === p);
        if (!it) continue;
        let n = it.units * k;
        // 輸出の数の枠（自主規制など）
        const quota = fdQuotaLeft(c, r);
        const local = fdLocalShare(c, r);
        if (quota !== null) { const ex = n * (1 - local); if (ex > quota) n = n * local + quota; fdQuotaUse(c, r, Math.min(ex, quota)); }
        // 輸出した分は為替で円の手取りが変わる（現地で作った分は変わらない）
        const priceN = M.ref * fdPr(p, r) / 100 * (r === 'jp' ? 1 : local + (1 - local) * fdFxTake(y));
        const v = n * priceN;
        rev += v;
        res.byReg[r] += v;
        if (r !== 'jp') {
          res.exportSales += v * (1 - local);
          res.freight += v * (1 - local) * fdFreight(c, r, y);
          // 関税は売値に乗るが、ここでは自社が負担する分（相場に合わせるため）だけを費用にする
          res.tariff += v * (1 - local) * fdTariff(c, r, y) * 0.3;
          if (G.reg[r].st === 1) res.comm += v * 0.05;
        } else if (G.reg.jp.st === 1) res.comm += v * 0.04;
        p.byReg = p.byReg || {};
        p.byReg[r] = n;
        G.mk[c][r].mine = (G.mk[c][r].mine || 0) + n;
      }
      const soldN = sum(Object.values(p.byReg || {}), x => x);
      const cogs = soldN * ucost;
      p.stock = Math.max(0, p.stock - soldN);
      p.stockCost = Math.max(0, p.stockCost - cogs);
      p.sold = soldN;
      p.rev = rev;
      res.sales += rev; res.cogs += cogs; res.units += soldN;
      res.byCat[c] = (res.byCat[c] || 0) + rev;
    }
  }
  return res;
}
/* 輸出の数の枠（年に何台まで。出来事が自社の割り当てを決める）。この四半期の残り */
function fdQuotaLeft(c, r) {
  const m = fdModsOf('quota', c, r)[0];
  if (!m) return null;
  const key = `${c}:${r}:${G.q}`;
  G.quotaUsed = G.quotaUsed || {};
  return Math.max(0, m.v / 4 - (G.quotaUsed[key] || 0));
}
function fdQuotaUse(c, r, n) { const key = `${c}:${r}:${G.q}`; G.quotaUsed = G.quotaUsed || {}; G.quotaUsed[key] = (G.quotaUsed[key] || 0) + n; for (const k of Object.keys(G.quotaUsed)) if (+k.split(':')[2] < G.q - 1) delete G.quotaUsed[k]; }

/* ---------- 開発 ---------- */
/* 新しい製品を開発するのに要る技術者×四半期（時代とともに増える） */
function fdDevNeed(c, y = fdYf()) {
  const C = fdCat(c);
  const main = Object.entries(C.w).sort((a, b) => b[1] - a[1])[0][0];
  return C.dev.eq * fdDiffK(main, y);
}
function fdDevQuarters(c) { return fdCat(c).dev.q; }
function fdStartDev(c, o = {}) {
  const C = fdCat(c);
  const ready = fdCatReady(c);
  if (!ready.ok) return { ok: false, why: ready.why };
  const need = fdDevNeed(c);
  // 名前を自分で付けなかったら、発売のときの技術に合わせた型の名前にする（auto）
  const auto = !o.n || o.n === fdModelName(c);
  const d = { id: 'D' + (++G.seq), cat: c, n: o.n || fdModelName(c), auto, prog: 0, need, eng: Math.ceil(need / Math.max(1, fdDevQuarters(c))), q0: G.q, pt: o.pt || null, rep: o.rep || null };
  G.devs.push(d);
  fdNews(`${C.n}の新しい製品「${d.n}」の開発を始めました`);
  return { ok: true, d };
}
function fdDevEngNeed() { return sum(G.devs, d => d.eng); }
/* 開発の進み。技術者は開発に先に回し、残りが研究に回る */
function fdDevelop() {
  const avail = G.staff.eng;
  const need = fdDevEngNeed();
  const k = need > 0 ? Math.min(1, avail / need) : 1;
  const sk = (0.8 + 0.2 * Math.min(2, G.skill.eng)) * (1 + 0.06 * (fdAbil('cto', 'tech') - 3)) * (1 - fdOrgFriction()) * (G.flags.shusa ? 1.2 : 1) * (G.flags.jishu ? 1.05 : 1);
  const done = [];
  for (const d of G.devs) {
    d.prog += d.eng * k * sk;
    if (d.prog >= d.need) done.push(d);
  }
  for (const d of done) { G.devs = G.devs.filter(x => x !== d); fdLaunch(d); }
  return Math.max(0, avail - need * k);
}
/* 製品の名前（分野と、品質の技術の年 ty の型から。先を行く技術なら、先の時代の型になる）。n は何代目か */
function fdModelName(c, y = fdYf(), ty = fdCatTech(c, y), n = (G.gen[c] || 0) + 1) {
  const C = fdCat(c);
  return C.model ? C.model(ty, n, y) : `${C.n} ${n}号`;
}
/* 製品の品質の年を変え、仕様（と自動で付けた名前）をその技術に合わせる */
function fdSetProdQy(p, qy, y = fdYf()) {
  const C = fdCat(p.cat);
  p.qy = qy;
  if (C.spec) p.spec = C.spec(qy, y);
  if (p.auto) p.name = fdModelName(p.cat, y, qy, p.gen);
}
/* 新しい製品の品質：その分野の技術の水準そのまま（先を行く技術なら、何年先でもその品になる）。研究所があれば少し上 */
function fdLaunchQy(c, y = fdYf()) { return fdCatTech(c, y) + (G.prog.lab ? 0.5 : 0); }
function fdLaunch(d) {
  const C = fdCat(d.cat);
  const y = fdYf();
  const qy = fdLaunchQy(d.cat, y);
  const name = d.auto ? fdModelName(d.cat, y, qy) : d.n;
  G.gen[d.cat] = (G.gen[d.cat] || 0) + 1;
  const old = d.rep ? fdProd(d.rep) : null;
  const p = { id: 'P' + (++G.seq), cat: d.cat, name, auto: !!d.auto, gen: G.gen[d.cat], qy, q0: G.q, pr: old ? old.pr : 100, stock: old ? old.stock : 0, stockCost: old ? old.stockCost : 0, cum: 0, sold: old ? old.sold : 0, want: old ? old.want : 0, made: 0, plan: old && old.plan ? Object.assign({}, old.plan) : { mode: 'auto', qty: 0 }, def: fdDefect(d.cat), active: true, pt: d.pt, ban: fdLicBans(d.cat) };
  p.spec = C.spec ? C.spec(qy, y) : '';
  if (old) { old.active = false; old.end = G.q; old.stock = 0; old.stockCost = 0; }
  G.prods.push(p);
  // ラインの段取り替え（型・治具）。新しい分野ならラインはまだない
  const first = !G.miles['cat_' + d.cat];
  if (first) { G.miles['cat_' + d.cat] = G.q; fdChron(y < C.from ? `世界に先がけて${C.n}を世に出す。「${p.name}」を発売` : `${C.n}に進出。「${p.name}」を発売`, true); }
  else fdChron(`「${p.name}」を発売（${C.n}）`);
  fdNews(`${C.n}の新製品「${p.name}」を発売しました。品質は${fdTechWord(qy - y)}${p.spec ? `（${p.spec}）` : ''}`, 'good');
  G.pendingModals.push({ type: 'fdLaunch', id: p.id });
  return p;
}
/* 技術年の差をことばに */
function fdTechWord(d) {
  if (d >= 0.5) return `世界の先端を${fmtNum(d, 0)}年先取り`;
  if (d > -1) return '世界の先端と同じ水準';
  return `世界の先端より${fmtNum(-d, 0)}年遅れ`;
}

/* ---------- ライセンス（技術の導入） ---------- */
function fdLicBans(c) {
  const C = fdCat(c);
  const bans = new Set();
  for (const L of G.lics) if (L.until > G.q && (C.w[L.f] || 0) >= 0.2) for (const r of L.ban || []) bans.add(r);
  return [...bans];
}
/* 技術を導入できる相手（シナリオのデータ）。先端より6年以上遅れている分野 */
function fdLicOffers() {
  const y = fdYf();
  const out = [];
  for (const L of fdS().lic || []) {
    if (y < L.from || y > L.to) continue;
    if (G.lics.some(x => x.src === L.id && x.until > G.q)) continue;
    const gap = fdGap(L.f, y);
    if (gap === Infinity || gap < 6) continue;
    if (fdRegAccess(L.o, y) < 1) continue;
    const salesY = Math.max(fdLastYear('sales'), fdNominal(L.fee0 || 3e8, y) * 0.3);
    const fee = Math.max(fdNominal(L.fee0 || 3e8, y), salesY * 0.02);
    out.push({ L, gap, fee, roy: L.roy || 3, lag: L.lag || 4, years: L.years || 10 });
  }
  return out;
}
function fdTakeLicense(id) {
  const o = fdLicOffers().find(x => x.L.id === id);
  if (!o) return { ok: false, why: 'その技術の導入は、いまはできません' };
  if (G.bs.cash < o.fee) return { ok: false, why: 'お金が足りません' };
  const y = fdYf();
  const T = G.tech[o.L.f];
  const target = y - o.lag;
  const absorb = T.t === null ? 0.5 : clamp(1 - (y - T.t - 20) / 30, 0.45, 1);
  const before = T.t === null ? target - 10 : T.t;
  T.t = Math.max(before, before + (target - before) * absorb);
  const lic = { id: 'C' + (++G.seq), src: o.L.id, f: o.L.f, n: o.L.n, q: G.q, until: G.q + o.years * 4, roy: o.roy, ban: o.L.ban || [], fee: o.fee };
  G.lics.push(lic);
  fdPay('rd', o.fee);
  G.flags.licN = (G.flags.licN || 0) + 1;
  for (const p of G.prods) if (p.active) p.ban = fdLicBans(p.cat);
  fdChron(`${o.L.n}から${fdField(o.L.f).n}の技術を導入`);
  fdNews(`${o.L.n}と技術提携。${fdField(o.L.f).n}の水準が${Math.floor(before)}年から${Math.floor(T.t)}年に上がりました（売上の${o.roy}%を${o.years}年払う）`, 'good');
  return { ok: true, lic };
}
/* 導入した技術の使用料（関係する分野の売上 × 料率） */
function fdRoyalties(byCat) {
  let r = 0;
  for (const L of G.lics) {
    if (L.until <= G.q) continue;
    for (const [c, v] of Object.entries(byCat)) if ((fdCat(c).w[L.f] || 0) >= 0.2) r += v * L.roy / 100 * Math.min(1, fdCat(c).w[L.f] * 2);
  }
  return r;
}

/* ---------- 工場 ---------- */
/* 新しい工場の建物・土地（今の価値の円）。地域の建設費の倍率 */
function fdFacCost(r, y = fdYf()) { return fdSer([[1910, 1.5e8], [1950, 8e8], [1980, 30e8], [2025, 60e8]], y, true) * fdCpi(y) * (r === 'jp' ? 1 : FD_REG[r].build || 1); }
function fdBuildFac(r, loc, o = {}) {
  const y = fdYf();
  if (fdRegAccess(r, y) < 3 && r !== 'jp') return { ok: false, why: 'この地域では、いまは工場を建てられません' };
  const cost = o.cost ?? fdFacCost(r, y);
  if (!o.free && G.bs.cash < cost) return { ok: false, why: 'お金が足りません' };
  const f = { id: 'F' + (++G.seq), n: o.n || `${loc}工場`, r, loc, q0: G.q, ready: G.q + (o.now ? 0 : y < 1950 ? 3 : 4), wk: 0, skill: 1, lines: [], dmgF: 1 };
  G.facs.push(f);
  if (!o.free) { G.bs.cash -= cost; fdNewAsset({ n: `${f.n}の建物・土地`, cost, life: 40, f: f.id, kind: 'bld' }); }
  if (r !== 'jp' && G.reg[r].st < 3) { G.reg[r].st = 3; fdChron(`${FD_REG[r].n}で現地生産を始める（${f.n}）`, true); }
  if (!o.quiet) fdNews(`${f.n}（${FD_REG[r].n}・${loc}）の建設を始めました`);
  return { ok: true, f };
}
/* ラインを足す・広げる（能力は台/年） */
function fdAddLine(fid, c, cap, o = {}) {
  const f = fdFac(fid);
  const y = fdYf();
  const cost = o.cost ?? fdCapexPer(c, f.r, y) * cap;
  if (!o.free && G.bs.cash < cost) return { ok: false, why: 'お金が足りません' };
  let line = f.lines.find(l => l.cat === c);
  if (!line) { line = { cat: c, cap: 0, auto: Math.round(fdAutoTyp(y) * 0.8 * 100) / 100, ready: Math.max(f.ready, G.q + (o.now ? 0 : 2)) }; f.lines.push(line); }
  else line.ready = Math.min(line.ready ?? 0, G.q + 1);
  line.cap += cap;
  if (!o.free) { G.bs.cash -= cost; fdNewAsset({ n: `${f.n}の${fdCat(c).n}のライン`, cost, life: fdCat(c).lineLife || 15, f: f.id, kind: 'line', cat: c }); }
  return { ok: true, line, cost };
}
/* 自動化（ラインの自動化の度合いを上げる）。時代の上限がある */
function fdAutoMax(y = fdYf()) { return fdSer([[1910, 0.12], [1930, 0.2], [1955, 0.3], [1975, 0.5], [1990, 0.65], [2010, 0.8], [2025, 0.88]], y); }
function fdAutomate(fid, c) {
  const f = fdFac(fid);
  const line = f.lines.find(l => l.cat === c);
  if (!line) return { ok: false };
  const y = fdYf();
  if (line.auto >= fdAutoMax(y) - 0.005) return { ok: false, why: 'この時代の技術では、これ以上の自動化はできません' };
  const cost = fdCapexPer(c, f.r, y) * line.cap * 0.3;
  if (G.bs.cash < cost) return { ok: false, why: 'お金が足りません' };
  G.bs.cash -= cost;
  fdNewAsset({ n: `${f.n}の${fdCat(c).n}の自動化`, cost, life: 10, f: f.id, kind: 'auto', cat: c });
  line.auto = Math.min(fdAutoMax(y), line.auto + 0.1);
  return { ok: true, cost };
}

/* ---------- 地域（販路とブランド） ---------- */
const FD_STAGES = [
  { n: '未進出', dist: 0 },
  { n: '輸出（商社を通す）', dist: 0.12 },
  { n: '販売会社', dist: 0.4 },
  { n: '現地生産', dist: 0.6 },
  { n: '現地で開発', dist: 0.75 },
];
const FD_STAGES_JP = [{ n: 'なし', dist: 0 }, { n: '代理店を通す', dist: 0.22 }, { n: '自前の営業所と特約店', dist: 0.5 }, { n: '全国の販売網', dist: 0.72 }, { n: '全国の販売網と直営の拠点', dist: 0.85 }];
function fdStageN(r, st) { return (r === 'jp' ? FD_STAGES_JP : FD_STAGES)[st].n; }
/* 進出の費用（今の価値の円 → その時代の円） */
function fdRegStepCost(r, st, y = fdYf()) {
  const base = r === 'jp' ? [0, 2e7, 4e8, 30e8, 80e8] : [0, 5e7, 15e8, 0, 60e8];
  return base[st] * fdCpi(y) * (r === 'jp' ? 1 : FD_REG[r].build || 1);
}
function fdRegStep(r) {
  const R = G.reg[r];
  const nx = R.st + 1;
  const y = fdYf();
  if (nx > 4) return { ok: false };
  if (r !== 'jp' && nx === 3) return { ok: false, why: '現地生産は、その地域に工場を建てると始まります' };
  if (r !== 'jp' && fdRegAccess(r, y) < Math.min(nx, 2) + (nx >= 3 ? 1 : 0)) return { ok: false, why: 'いまはこの地域に進めません' };
  if (r !== 'jp' && nx === 4 && R.st < 3) return { ok: false, why: '先に現地で工場を動かしましょう' };
  const cost = fdRegStepCost(r, nx, y);
  if (G.bs.cash < cost) return { ok: false, why: 'お金が足りません' };
  G.bs.cash -= cost;
  fdNewAsset({ n: `${FD_REG[r].n}の${fdStageN(r, nx)}`, cost, life: 20, kind: 'reg', r });
  R.st = nx; R.since = G.q;
  fdChron(`${FD_REG[r].n}：${fdStageN(r, nx)}`, r !== 'jp');
  if (r !== 'jp' && nx === 1) fdMilestone('export', '初めての輸出');
  return { ok: true, cost };
}
/* 販路とブランドの動き（四半期） */
function fdRegUpdate(res) {
  const y = fdYf();
  for (const r of fdRegOrder()) {
    const R = G.reg[r];
    const S = r === 'jp' ? FD_STAGES_JP : FD_STAGES;
    const tgt = S[R.st].dist * (fdRegAccess(r, y) >= 1 ? 1 : 0);
    const sp = 0.05 + 0.015 * (fdAbil('cso', 'sales') - 3) + (G.policy.mkt || 0) * 0.004;
    R.dist += (tgt - R.dist) * clamp(sp, 0.02, 0.12);
    // ブランド：その地域での売上の大きさ・品質・宣伝・年数
    const share = sum(Object.keys(fdS().cats), c => (G.mk[c] && G.mk[c][r] ? G.mk[c][r].share * (G.mk[c][r].D * G.mk[c][r].ref) : 0)) / Math.max(1, sum(Object.keys(fdS().cats), c => (G.mk[c] && G.mk[c][r] ? G.mk[c][r].D * G.mk[c][r].ref : 0)));
    const qd = fdAvgQGap();
    const yrs = R.st ? (G.q - (R.since ?? G.q)) / 4 : 0;
    const tgtB = R.st ? clamp(15 + 70 * share + 1.0 * clamp(qd, -8, 3) + Math.min(20, yrs * 0.6) + (G.policy.mkt || 0) * 1.2 + (r === 'jp' ? 10 : 0) - 120 * (G.recallQ && G.q - G.recallQ < 8 ? 0.1 : 0), 3, 95) : R.brand;
    R.brand += (tgtB - R.brand) * (0.025 + (R.st >= 4 ? 0.01 : 0));
    R.brand = clamp(R.brand, 1, 99);
    void res;
  }
}
/* いちばん売れている製品 */
function fdLeadCat() { let b = null; for (const p of fdActiveProds()) if (!b || (p.rev || 0) > (b.rev || 0)) b = p; return b; }
/* 自社の製品の、先端との差の平均（売上の重み） */
function fdAvgQGap() {
  const ps = fdActiveProds();
  const y = fdYf();
  const w = sum(ps, p => (p.rev || 1));
  return w ? sum(ps, p => (p.qy - y) * (p.rev || 1)) / w : -10;
}

/* ---------- 人手 ---------- */
/* 必要な人数の目安（工場の工員は工場ごと、営業・事務は売上と拠点の数から） */
function fdNeedStaff(res) {
  const y = fdYf();
  const salesReal = fdReal(res ? res.sales : fdLastQ('sales'), y);
  const regs = fdRegOrder().filter(r => G.reg[r].st >= 1).length;
  const sal = Math.max(2, Math.round(salesReal / fdSer([[1910, 4e7], [1960, 6e7], [2000, 1.5e8], [2025, 2e8]], y, true) + regs * 2));
  const total = fdHead();
  const adm = Math.max(1, Math.round(total * fdSer([[1910, 0.03], [1960, 0.06], [2000, 0.08], [2025, 0.08]], y) + 1));
  return { sal, adm };
}
/* 人の出入り（自動）：工場は必要な工員に合わせ（減らすのは自然に辞める分だけ）、営業・事務も合わせる */
function fdStaffAuto() {
  const y = fdYf();
  const attr = fdSer([[1910, 0.06], [1960, 0.03], [2000, 0.02], [2025, 0.025]], y) + sum(fdModsOf('attr', null, 'jp'), m => m.v);
  for (const f of G.facs) {
    // 建設中の工場は、完成の直前に、ラインの能力の半分を動かせるだけの工員を雇っておく
    if (f.ready > G.q) { if (f.ready - G.q <= 1) f.wk = Math.max(f.wk || 0, Math.ceil(fdFacWkFull(f, y) * 0.5)); continue; }
    const need = Math.ceil((f.needWk || 0) * 1.03);
    const cur = f.wk || 0;
    if (need > cur) f.wk = cur + Math.min(need - cur, Math.max(5, Math.ceil(cur * 0.35), Math.ceil(need * 0.25)));
    else if (G.policy.noLayoff === false) f.wk = need;
    else f.wk = Math.max(need, Math.floor(cur * (1 - attr)));
  }
  G.staff.wk = sum(G.facs, f => f.wk || 0);
  if (G.policy.autoStaff !== false) {
    const n = fdNeedStaff();
    for (const k of ['sal', 'adm']) {
      const cur = G.staff[k];
      if (n[k] > cur) G.staff[k] = cur + Math.min(n[k] - cur, Math.max(2, Math.ceil(cur * 0.3)));
      else G.staff[k] = Math.max(n[k], Math.floor(cur * (1 - attr)));
    }
  }
}
/* 工場のラインを全部動かすのに要る工員の数 */
function fdFacWkFull(f, y = fdYf()) { return sum(f.lines, l => l.cap / 4 * fdHrsFront(l.cat, y) * fdHrsMul(f, l, y)) / (fdHoursM(y) * 3 * 0.92); }
/* 技術者を雇う・減らす（人数は社長が決める） */
function fdHireEng(n) {
  n = Math.round(n);
  if (n > 0) { const cost = n * fdPayQ('eng') * 0.5; fdPay('rd', cost); G.staff.eng += n; return cost; }
  const k = Math.min(-n, G.staff.eng);
  G.staff.eng -= k;
  return 0;
}

/* ---------- 四半期の締め ---------- */
function fdLastQ(k) { const h = G.hq[G.hq.length - 1]; return h ? h[k] || 0 : 0; }
function fdLastYear(k) { const h = G.hy[G.hy.length - 1]; return h ? h[k] || 0 : 0; }
function fdAdvanceQ() {
  if (G.over) return null;
  const y = fdYf();
  G.qr = { pl: fdNewPL() };
  G.pendingModals = G.pendingModals || [];
  // 0) 出来事（この四半期の初めに起きること）
  fdFireEvents();
  // 1) 生産
  const pr = fdProduce();
  // 2) 販売
  const sr = fdSell();
  // 役務の注文（修理・据付など）
  const sv = fdServiceOrders();
  if (sv.rev) { sr.sales += sv.rev; sr.byReg.jp += sv.rev; G.svcRev = sv.rev; } else G.svcRev = 0;
  // 3) 損益と帳簿
  fdBookPL('sales', sr.sales); G.bs.ar += sr.sales;
  if (sv.cost) { fdPay('cogs', sv.cost); G.yr.pl.wages += sv.cost * 0.6; G.qr.pl.wages += sv.cost * 0.6; }
  fdBookPL('cogs', sr.cogs); G.bs.inv -= sr.cogs;
  G.bs.inv += pr.cost;
  // 材料は買掛金、作る人の給料は現金
  G.bs.ap += pr.mat; G.bs.cash -= pr.lab + pr.ovh; // 直接の人件費（作った分）と工場の間接費
  G.yr.pl.wages += pr.lab + pr.ovh * 0.4; G.qr.pl.wages += pr.lab + pr.ovh * 0.4;
  // 作らなかった時間の給料・工場の経費（修繕・電気など）
  const facFix = sum(G.assets.filter(a => !a.gone && (a.kind === 'line' || a.kind === 'bld' || a.kind === 'auto')), a => fdAssetBV(a) * 0.6 + a.cost * 0.4) * 0.005;
  fdPay('cogs', pr.idle + facFix);
  G.yr.pl.wages += pr.idle; G.qr.pl.wages += pr.idle;
  // 不良・保証（市場に出た品の不具合）
  const warranty = sr.sales * sum(fdActiveProds(), p => p.def * (p.rev || 0)) / Math.max(1, sr.sales) * 0.25;
  fdPay('cogs', warranty);
  // 減価償却（工場は原価、それ以外は販管費）・のれんの償却
  const depAll = fdDepreciateSplit();
  fdAmortizeGw();
  // 財テク（持っている株・土地の値動き）
  fdZaitechQuarter();
  // 人件費（技術者は研究開発費、営業と事務は販管費）
  const engPay = G.staff.eng * fdPayQ('eng');
  const salPay = sum(fdRegOrder(), r => (r === 'jp' ? G.staff.sal * (1 - fdAbroadSalShare()) : G.staff.sal * fdAbroadSalShare() * fdRegSalW(r)) * fdPayQ('sal', r));
  const admPay = G.staff.adm * fdPayQ('adm');
  fdPay('rd', engPay * 1.35); // 研究の材料・試作・設備を含む
  fdPay('sga', salPay + admPay);
  G.yr.pl.wages += engPay + salPay + admPay; G.qr.pl.wages += engPay + salPay + admPay;
  // 販売の経費：運賃・関税・商社の手数料・宣伝・拠点の維持・ライセンスの使用料
  const mkt = sr.sales * (G.policy.mkt || 0) / 100;
  const regFix = sum(fdRegOrder(), r => (G.reg[r].st >= 2 ? fdRegStepCost(r, 2) * 0.012 : 0));
  const roy = fdRoyalties(sr.byCat);
  fdPay('sga', sr.freight + sr.tariff + sr.comm + mkt + regFix + roy);
  G.yr.pl.mkt += mkt; G.qr.pl.mkt += mkt;
  G.yr.pl.royalty += roy; G.qr.pl.royalty += roy;
  // 本社の経費（家賃・通信・旅費など）と、売上に比例する経費（物流・広告・修理の窓口・事務所・情報システムなど）
  fdPay('sga', fdNominal(fdSer([[1910, 1.5e6], [1960, 2e7], [2000, 1e8]], y, true), y) * (1 + Math.log10(Math.max(1, fdHead()))));
  // 売上に比例する経費は分野で違う（糸や布のような商品は軽く、情報システムや家電は重い）
  const catS = sum(Object.values(sr.byCat), v => v);
  const sgaBase = sum(Object.entries(sr.byCat), ([c, v]) => v * (fdCat(c).sgaK ?? 1)) + Math.max(0, sr.sales - catS);
  fdPay('sga', sgaBase * fdSer([[1910, 0.03], [1960, 0.05], [2000, 0.07], [2025, 0.075]], y));
  // 研修（養成所）
  if (G.prog.school) { const sc = fdHead() * fdPayQ('wk') * 0.015; fdPay('sga', sc); }
  // 中央研究所
  if (G.prog.lab) fdPay('rd', G.staff.eng * fdPayQ('eng') * 0.12);
  // 開発と研究
  const engR = fdDevelop();
  fdResearch(engR);
  // 戦時の損失の補償（軍需会社法）：営業の赤字の一部を政府が埋める
  const comp = fdModsOf('milComp', null, 'jp')[0];
  if (comp) { const op = fdOpi(G.qr.pl); if (op < 0) { const x = -op * comp.v; G.bs.cash += x; G.yr.pl.nonop += x; G.qr.pl.nonop += x; } }
  // 利息
  fdLoansQuarter();
  // 売掛金の回収・買掛金の支払い（売掛は約1か月半、買掛は約1か月残る）
  const arT = sr.sales * 0.5, apT = pr.mat * 0.35;
  G.bs.cash += G.bs.ar - arT; G.bs.ar = arT;
  G.bs.cash -= G.bs.ap - apT; G.bs.ap = apT;
  // 在庫の帳簿を製品の在庫に合わせる（計算の丸めの差は売上原価で調整）
  const invNow = sum(G.prods, p => p.stockCost);
  const invD = G.bs.inv - invNow;
  if (Math.abs(invD) > 0) { fdBookPL('cogs', invD); G.bs.inv = invNow; }
  // 4) 人・販路・ブランド・技能・カイゼン・組合（被害は少しずつ片付く）
  for (const f of G.facs) if ((f.dmgF || 1) > 1) f.dmgF = Math.max(1, 1 + (f.dmgF - 1) * 0.9);
  fdStaffAuto();
  fdUnionQuarter();
  fdRegUpdate(sr);
  fdSkillUpdate();
  fdRivalsUpdate();
  // 5) 記録
  const qrec = fdRecordQ(sr, pr);
  // 6) 年の締め（12月）
  if (fdQo() === 3) fdCloseYear();
  // 7) 出来事（ランダム）・節目・資金の確認
  fdRandomEvents();
  fdMilestonesCheck(qrec);
  fdCashCheck();
  fdPeopleQuarter();
  // 8) 次の四半期へ
  G.q++;
  fdCheckEnd();
  return qrec;
}
/* 減価償却を工場（原価）とそれ以外（販管費）に分ける */
function fdDepreciateSplit() {
  let fac = 0, oth = 0;
  for (const a of G.assets) {
    if (a.gone || a.q > G.q) continue;
    const per = a.cost / (a.life * 4);
    const x = Math.min(per, a.cost - a.booked);
    if (x <= 0) continue;
    a.booked += x;
    if (a.kind === 'line' || a.kind === 'bld' || a.kind === 'auto') fac += x; else oth += x;
  }
  G.bs.ppe -= fac + oth;
  G.yr.pl.cogs += fac; G.qr.pl.cogs += fac;
  G.yr.pl.sga += oth; G.qr.pl.sga += oth;
  G.yr.pl.dep += fac + oth; G.qr.pl.dep += fac + oth;
  return fac + oth;
}
function fdAbroadSalShare() {
  const tot = sum(fdRegOrder(), r => fdLastQReg(r));
  return tot ? clamp(1 - fdLastQReg('jp') / tot, 0, 0.9) : 0;
}
function fdLastQReg(r) { const h = G.hq[G.hq.length - 1]; return h && h.reg ? h.reg[r] || 0 : 0; }
function fdRegSalW(r) {
  const tot = sum(fdRegOrder().filter(x => x !== 'jp'), x => fdLastQReg(x));
  return tot ? fdLastQReg(r) / tot : 0;
}
/* 技能（養成所・研修で上がり、人が急に増えると下がる） */
function fdSkillUpdate() {
  const grow = G.prog.school ? 0.02 : 0.004;
  for (const f of G.facs) f.skill = clamp((f.skill || 1) + grow - (f.wkPrev && f.wk > f.wkPrev * 1.3 ? 0.04 : 0), 0.6, 2);
  for (const f of G.facs) f.wkPrev = f.wk;
  G.skill.eng = clamp(G.skill.eng + (G.prog.school ? 0.008 : 0.003) + (G.prog.lab ? 0.006 : 0), 0.6, 2);
  if (G.prog.kaizen) G.kaizen = Math.min(1, (G.kaizen || 0) + 0.012 * (1 + 0.15 * (fdAbil('coo', 'prod') - 3)));
  if (G.prog.qc) G.qc = Math.min(1, (G.qc || 0) + 0.012);
  for (const p of fdActiveProds()) p.def = p.def * 0.85 + fdDefect(p.cat) * 0.15;
}
/* ライバルの動き：ときどき新製品で品質を上げる。自社が世界で大きな取り分を持つ分野では、ライバルは値下げと品質の向上で巻き返そうとする */
function fdRivalsUpdate() {
  const press = {};
  for (const c of Object.keys(fdS().cats)) {
    const mk = G.mk[c];
    if (!mk) continue;
    const D = sum(fdRegOrder(), r => (mk[r] ? mk[r].D : 0));
    const mine = sum(fdRegOrder(), r => (mk[r] ? mk[r].share * mk[r].D : 0));
    const jpS = mk.jp ? mk.jp.share : 0;
    press[c] = D > 0 ? clamp(Math.max(mine / D - 0.06, (jpS - 0.3) * 0.6), 0, 0.5) : 0;
  }
  for (const [k, st] of Object.entries(G.rv)) {
    if (!st.alive) continue;
    const c = k.split(':')[0];
    const pr = press[c] || 0;
    if (chance(0.06 + pr * 0.4)) st.dq = clamp(st.dq + uni(-0.6, 0.9) + pr * 1.5, -3, 3);
    st.dp = clamp(st.dp * 0.95 + randn() * 0.006 - pr * 0.012, -0.22, 0.12);
  }
}
/* 四半期の記録 */
function fdRecordQ(sr, pr) {
  const p = G.qr.pl;
  const y = fdYf();
  const rec = { q: G.q, sales: p.sales, opi: fdOpi(p), net: fdNet(p), cash: G.bs.cash, debt: G.bs.debt, head: fdHead(), units: sr.units, exp: sr.exportSales, reg: sr.byReg, cpi: fdCpi(y), made: pr.units };
  G.hq.push(rec);
  if (G.hq.length > 200) G.hq.shift();
  return rec;
}
/* 年の締め：法人税・利益を利益剰余金へ・配当・年の記録 */
function fdCloseYear() {
  const y = fdY();
  const p = G.yr.pl;
  const pre = fdPretax(p);
  // 繰越欠損（直近の赤字）を差し引いて課税
  const base = Math.max(0, pre - (G.lossCF || 0));
  G.lossCF = pre < 0 ? (G.lossCF || 0) - pre : Math.max(0, (G.lossCF || 0) - pre);
  const tax = G.taxFreeUntil && G.q <= G.taxFreeUntil ? 0 : base * fdTaxRate(fdYf()) / 100;
  p.tax += tax;
  G.bs.taxp += tax;
  const net = fdNet(p);
  // 配当（上場・株主がいるとき。利益の一部）
  const div = net > 0 ? net * (G.policy.div ?? 0.25) * (G.owners.outside > 0 ? 1 : 0.4) : 0;
  const rec = { y, sales: p.sales, cogs: p.cogs, sga: p.sga, rd: p.rd, opi: fdOpi(p), nonop: p.nonop, extra: p.extra, tax: p.tax, net, div, wages: p.wages, dep: p.dep, mkt: p.mkt, royalty: p.royalty, int: p.int,
    cash: G.bs.cash, assets: fdAssets(), debt: G.bs.debt, equity: fdEquity() - div, head: fdHead(), staff: Object.assign({}, G.staff), cpi: fdCpi(fdYf()),
    reg: Object.fromEntries(fdRegOrder().map(r => [r, sum(G.hq.filter(h => fdY(h.q) === y), h => (h.reg ? h.reg[r] || 0 : 0))])),
    share: fdWorldShares(), tech: Object.fromEntries(Object.entries(G.tech).map(([f, T]) => [f, T.t])), bs: Object.assign({}, G.bs) };
  G.hy.push(rec);
  G.bs.re += net - div;
  G.bs.cash -= div;
  // 前の年の税金を払う（いまの年の分は未払いに残す）
  G.bs.cash -= G.taxPrev || 0; G.bs.taxp -= G.taxPrev || 0;
  G.taxPrev = tax;
  G.yr = { y: y + 1, pl: fdNewPL() };
  G.bank.years = (G.bank.years || 0) + 1;
  G.pendingModals.push({ type: 'fdYear', y });
}
/* 世界の需要に対する取り分（分野ごと、その年の4四半期） */
function fdWorldShares() {
  const out = {};
  for (const c of Object.keys(fdS().cats)) {
    const mk = G.mk[c];
    if (!mk) continue;
    const D = sum(fdRegOrder(), r => (mk[r] ? mk[r].D : 0));
    const mine = sum(fdRegOrder(), r => (mk[r] ? mk[r].mine || 0 : 0));
    if (D > 0 && mine > 0) out[c] = mine / D;
  }
  for (const c of Object.keys(G.mk)) for (const r of fdRegOrder()) if (G.mk[c][r]) G.mk[c][r].mine = 0;
  return out;
}
/* お金が足りなくなったら、借りられる分だけ自動で借りる。それでも足りなければ経営危機 */
function fdCashCheck() {
  if (G.bs.cash >= 0) { G.crisis = 0; return; }
  const need = -G.bs.cash * 1.15 + fdNominal(fdSer([[1910, 5e6], [2000, 1e8]], fdYf(), true));
  const room = fdCreditLimit() - fdDebt();
  if (room > need) { fdBorrow(need, 1, '資金繰り（自動）'); fdNews(`資金が足りなくなり、銀行から${fmtYen(need)}を借りました（期間1年）`, 'warn'); return; }
  // 敗戦の直後は、古い借金が凍結され、足りない運転資金は復興金融金庫が貸してくれる
  if (fdModsOf('reconFin', null, 'jp').length) { fdBorrow(need, 5, '復興金融金庫の融資', 2); fdNews(`復興金融金庫から${fmtYen(need)}を借りました`, 'warn'); return; }
  if (room > 0) fdBorrow(room, 1, '資金繰り（自動）');
  if (G.bs.cash < 0) {
    G.crisis = (G.crisis || 0) + 1;
    // 銀行団の救済は、純資産が残っていれば、前の救済から12年たてば、もう一度受けられる
    const canRescue = !G.flags.rescued || (G.q - G.flags.rescued >= 48 && fdEquity() > 0);
    if (canRescue && G.crisis >= 1) { if (!G.pendingModals.some(m => m.type === 'fdRescue')) G.pendingModals.push({ type: 'fdRescue' }); }
    else if (G.crisis >= 2) { G.over = { type: 'bankrupt', q: G.q }; fdChron('資金が尽き、会社は倒産した', true); }
  }
}
