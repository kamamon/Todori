'use strict';
/* =========================================================
 *  42_fd_core.js : 創業記モード（創業から世界企業へ）のエンジン（画面に依存しない）
 *   小さな工場の創業者として、明治・大正・昭和・平成・令和の実際の歴史の中で、
 *   技術を磨き、製品を作り、工場を建て、国内から世界へ売り広げて、会社を世界企業に育てる。
 *   1手番は四半期（3か月）。お金はその時代の円で数え、「今の価値」に直して見せる。
 *   ・技術の水準は「何年の世界の先端に追いついているか」（技術年）で表す。世界の先端は毎年1年ずつ進む
 *   ・市場は製品の分野×地域。需要は時代の数字から、取り分は品質（技術年）・価格・ブランド・販路で決まる
 *   ・工場の生産性は、生産技術・自動化・カイゼン・累積生産（学習曲線）で上がる
 *   ・大恐慌・戦争・インフレ・石油危機・円高・貿易摩擦などの出来事を、実際の年に起こす
 *   このファイル：状態・時間・物価・お金（簡易な帳簿）・人・組織の基本
 *   （市場と生産と開発は 42b_fd_sim.js、出来事は 42c_fd_events.js）
 * ========================================================= */

const FD_SAVE_VERSION = 1;
function isF() { return !!(G && G.mode === 'sogyo'); }
const FD_QN = ['1〜3月', '4〜6月', '7〜9月', '10〜12月'];
const FD_ROLES = {
  wk: { n: '工員', d: '工場で製品を作る人' },
  eng: { n: '技術者', d: '研究と製品の開発をする人' },
  sal: { n: '営業・サービス', d: '売り込み・販売店の支援・修理をする人' },
  adm: { n: '事務・管理', d: '経理・人事・総務・企画をする人' },
};

/* ---------- 時間 ---------- */
function fdY(q = G.q) { return G.y0 + Math.floor(q / 4); }
function fdQo(q = G.q) { return ((q % 4) + 4) % 4; }
/* 四半期のまん中の時点の年（数字の補間に使う） */
function fdYf(q = G.q) { return G.y0 + q / 4 + 0.125; }
function fdQOf(y, qo = 0) { return (y - G.y0) * 4 + qo; }
function fdQLabel(q = G.q) { return `${fdY(q)}年${FD_QN[fdQo(q)]}`; }
/* 元号（月の初めで判断。明治は1912年7月まで、大正は1926年12月まで、昭和は1988年12月まで、平成は2019年4月まで） */
function fdEraOf(y, mo = 1) {
  if (y < 1912 || (y === 1912 && mo < 8)) return { n: '明治', y: y - 1867 };
  if (y < 1926 || (y === 1926 && mo < 12)) return { n: '大正', y: y - 1911 };
  if (y < 1989) return { n: '昭和', y: y - 1925 };
  if (y < 2019 || (y === 2019 && mo < 5)) return { n: '平成', y: y - 1988 };
  return { n: '令和', y: y - 2018 };
}
function fdWareki(y, mo = 1) { const e = fdEraOf(y, mo); return `${e.n}${e.y === 1 ? '元' : e.y}年`; }
function fdQWareki(q = G.q) { return fdWareki(fdY(q), fdQo(q) * 3 + 3); }

/* ---------- 時代の数字（補間） ---------- */
/* pts：[[年, 値], …]（年の昇順）。log=true は対数で補間（物価・需要のように倍で動く数字） */
function fdSer(pts, y, log) {
  if (!pts || !pts.length) return NaN;
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][0]) {
      const [x0, v0] = pts[i - 1], [x1, v1] = pts[i];
      const t = (y - x0) / (x1 - x0);
      if (log && v0 > 0 && v1 > 0) return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * t);
      return v0 + (v1 - v0) * t;
    }
  }
  return pts[pts.length - 1][1];
}
const FD_BASE_Y = 2025.5; // 「今の価値」の基準（2025年の平均）
/* 消費者物価（2025年＝1）。名目の円 ÷ fdCpi ＝ 今の価値の円 */
function fdCpi(y) { return fdSer(FD_MACRO.cpi, y, true) / fdSer(FD_MACRO.cpi, FD_BASE_Y, true); }
/* 企業物価（材料・機械の値段。2025年＝1） */
function fdWpi(y) { return fdSer(FD_MACRO.wpi, y, true) / fdSer(FD_MACRO.wpi, FD_BASE_Y, true); }
function fdUsCpi(y) { return fdSer(FD_MACRO.uscpi, y, true) / fdSer(FD_MACRO.uscpi, FD_BASE_Y, true); }
/* 円の対ドル相場（1ドル何円） */
function fdFx(y) { return fdSer(FD_MACRO.fx, y, true); }
/* 実質の円の強さ（2025年＝1）。1より大きいと、日本から輸出する品は海外で割高、輸入品は日本で割安 */
function fdRer(y) { return (fdCpi(y) / fdUsCpi(y)) * (fdFx(FD_BASE_Y) / fdFx(y)); }
/* 製造業の工員の月給（名目の円、賞与を含む月平均）と、ひと月の労働時間 */
function fdWageM(y) { return fdSer(FD_MACRO.wage, y, true); }
function fdHoursM(y) { return fdSer(FD_MACRO.hours, y); }
/* 銀行の貸出金利（年%）・法人の税率（%）・実質経済成長率（%） */
function fdRate(y) { return fdSer(FD_MACRO.rate, y); }
function fdTaxRate(y) { return fdSer(FD_MACRO.tax, y); }
function fdGrowth(y, r = 'jp') { const k = r === 'jp' ? 'gdp' : 'wgdp'; return fdSer(FD_MACRO[k], Math.floor(y)); }
/* 今の価値（2025年の円）に直す */
function fdReal(nominal, y = fdYf()) { return nominal / fdCpi(y); }
function fdNominal(real, y = fdYf()) { return real * fdCpi(y); }
/* お金の表示：その時代の円と、今の価値の目安 */
function fdYen(x, o = {}) { return fmtYen(x, o); }
function fdYenNow(x, y = fdYf()) { const r = fdReal(x, y); return `今の約${fmtYen(r, { noUnit: false })}`; }

/* ---------- 地域 ---------- */
function fdRegOrder() { return Object.keys(FD_REG); }
/* 地域の工員の時給（名目の円）：日本の時給 × 地域の賃金の倍率 */
function fdHourly(r, y = fdYf()) { return fdWageM(y) / fdHoursM(y) * (r === 'jp' ? 1 : fdSer(FD_REG[r].wage, y, true)); }
/* その時代に、日本の会社がその地域で商売できるか（0：できない、1：輸出だけ、4：工場・開発まで） */
function fdRegAccess(r, y = fdYf()) {
  const R = FD_REG[r];
  let a = R.access ? fdSer(R.access, y) : 4;
  for (const m of fdModsOf('access', null, r)) a = Math.min(a, m.v);
  return Math.floor(a + 1e-9);
}

/* ---------- 状態の小物 ---------- */
function fdS() { return FD_SCEN[G.scen]; }
function fdCat(id) { return fdS().cats[id]; }
function fdField(id) { return fdS().fields[id]; }
function fdNews(t, k = 'info') { G.news.unshift({ q: G.q, t, k }); if (G.news.length > 300) G.news.length = 300; }
/* 社史（年表）に残す。big=true は大きな節目 */
function fdChron(t, big) { G.chron.push({ q: G.q, t, big: !!big }); }
function fdMilestone(id, t) { if (G.miles[id]) return false; G.miles[id] = G.q; fdChron(t, true); fdNews(`【節目】${t}`, 'good'); return true; }
function fdProd(id) { return G.prods.find(p => p.id === id); }
function fdFac(id) { return G.facs.find(f => f.id === id); }
function fdPerson(id) { return G.people.find(p => p.id === id); }
function fdPeopleIn(role) { return G.people.filter(p => p.role === role && !p.gone); }
function fdHead() { return sum(Object.values(G.staff), x => x); }
function fdActiveProds(cat) { return G.prods.filter(p => p.active && (!cat || p.cat === cat)); }

/* ---------- 時代の出来事などによる補正（修飾子） ----------
   { k: 'dem'|'cost'|'access'|'rate'|'wage'|'fx', cat: 分野の id・種類（'dur' など）・'*', r: 地域・'*', v: 値, from: q, to: q, why } */
function fdModsOf(k, cat, r) {
  const C = cat ? fdCat(cat) : null;
  return (G.mods || []).filter(m => m.k === k && G.q >= m.from && G.q <= m.to
    && (!m.cat || m.cat === '*' || !cat || m.cat === cat || (C && (m.cat === C.kind || (C.tags || []).includes(m.cat))))
    && (!m.r || m.r === '*' || !r || m.r === r || (m.r === 'abroad' && r !== 'jp')));
}
function fdModMul(k, cat, r) { let v = 1; for (const m of fdModsOf(k, cat, r)) v *= m.v; return v; }
function fdAddMod(m) { G.mods.push(Object.assign({ from: G.q, to: G.q + 3 }, m)); }

/* ---------- 簡易な帳簿 ----------
   資産：cash 現金預金 / ar 売掛金 / inv 製品（在庫） / ppe 有形固定資産（帳簿価額） / inv2 投資（子会社・特許など）
   負債：ap 買掛金 / debt 借入金 / taxp 未払法人税等
   純資産：cap 資本金（払込資本） / re 利益剰余金
   損益（その年の累計）：sales 売上高 / cogs 売上原価 / sga 販売費・一般管理費 / rd 研究開発費 / nonop 営業外損益（受取利息−支払利息） / extra 特別損益 / tax 法人税等 */
const FD_BS = ['cash', 'ar', 'inv', 'ppe', 'inv2', 'ap', 'debt', 'taxp', 'cap', 're'];
const FD_PL = ['sales', 'cogs', 'sga', 'rd', 'nonop', 'extra', 'tax'];
function fdNewBooks() { const b = {}; for (const k of FD_BS) b[k] = 0; return b; }
function fdNewPL() { const p = {}; for (const k of FD_PL) p[k] = 0; p.int = 0; p.royalty = 0; p.dep = 0; p.wages = 0; p.mkt = 0; return p; }
/* 損益の計算（その年・その四半期） */
function fdOpi(p) { return p.sales - p.cogs - p.sga - p.rd; }
function fdPretax(p) { return fdOpi(p) + p.nonop + p.extra; }
function fdNet(p) { return fdPretax(p) - p.tax; }
/* 帳簿の動き（貸借は fdCheck で確かめる）
   fdPay：費用（売上原価・販管費・研究開発費）を現金で払う。fdGain：営業外・特別の損益（プラスが利益、マイナスが損失）を現金で */
function fdBookPL(k, amt) { G.yr.pl[k] += amt; G.qr.pl[k] += amt; }
function fdPay(k, amt, acct = 'cash') { if (!amt) return; fdBookPL(k, amt); G.bs[acct] -= amt; }
function fdGain(k, amt) { if (!amt) return; fdBookPL(k, amt); G.bs.cash += amt; }
function fdBalanceDiff() {
  const b = G.bs;
  const assets = b.cash + b.ar + b.inv + b.ppe + b.inv2;
  const liab = b.ap + b.debt + b.taxp;
  const eq = b.cap + b.re + fdNet(G.yr.pl);
  return assets - liab - eq;
}
function fdEquity() { return G.bs.cap + G.bs.re + fdNet(G.yr.pl); }
function fdAssets() { const b = G.bs; return b.cash + b.ar + b.inv + b.ppe + b.inv2; }

/* ---------- 資産（減価償却） ---------- */
function fdNewAsset(o) {
  const a = Object.assign({ id: 'A' + (++G.seq), q: G.q, booked: 0, life: 20 }, o);
  G.assets.push(a);
  G.bs.ppe += a.cost;
  return a;
}
/* 四半期の減価償却（定額法） */
function fdDepreciate() {
  let d = 0;
  for (const a of G.assets) {
    if (a.gone || a.q > G.q) continue;
    const per = a.cost / (a.life * 4);
    const x = Math.min(per, a.cost - a.booked);
    if (x <= 0) continue;
    a.booked += x; d += x;
  }
  G.bs.ppe -= d;
  return d;
}
/* 資産を手放す・失う（帳簿価額を特別損失または売却損益に） */
function fdLoseAsset(a, price = 0) {
  if (a.gone) return 0;
  const bv = a.cost - a.booked;
  a.gone = G.q;
  G.bs.ppe -= bv;
  G.bs.cash += price;
  const gl = price - bv;
  G.yr.pl.extra += gl; G.qr.pl.extra += gl;
  return bv;
}
function fdAssetBV(a) { return a.gone ? 0 : a.cost - a.booked; }

/* ---------- 借入 ---------- */
/* 借りられる上限：資産の担保と利益の力、取引の長い銀行ほど多い。戦争の終わりや金融恐慌のあとは厳しい */
function fdCreditLimit() {
  const y = fdYf();
  const lastOp = G.hy.length ? G.hy[G.hy.length - 1].opi : 0;
  const base = Math.max(0, G.bs.ppe * 0.55 + G.bs.inv * 0.35 + G.bs.ar * 0.6 + Math.max(0, lastOp) * 2.2 + Math.max(0, fdEquity()) * 0.3);
  const rel = 1 + Math.min(0.5, (G.bank.years || 0) * 0.04);
  return base * rel * fdModMul('credit', null, null) * (G.bank.trust ?? 1) * (y < 1950 ? 0.8 : 1);
}
function fdDebt() { return sum(G.loans, l => l.bal); }
/* 金利：時代の貸出金利 ＋ 会社の信用の上乗せ */
function fdLoanRate() {
  const eqr = fdEquity() / Math.max(1, fdAssets());
  const spread = eqr > 0.4 ? -0.3 : eqr > 0.25 ? 0 : eqr > 0.1 ? 0.8 : 2;
  return Math.max(0.3, fdRate(fdYf()) * fdModMul('rate', null, null) + spread + (G.bank.spread || 0));
}
function fdBorrow(amt, termY = 5, why = '運転資金', graceY = 0) {
  amt = Math.round(amt);
  if (amt <= 0) return null;
  const l = { id: 'L' + (++G.seq), amt, bal: amt, rate: fdLoanRate(), q: G.q, termQ: Math.max(1, Math.round(termY * 4)), why };
  // 据え置き：大きな工場の借入は、建って稼ぎ始めるまで元本を返さない
  if (graceY > 0) l.grace = G.q + Math.round(graceY * 4);
  G.loans.push(l);
  G.bs.cash += amt; G.bs.debt += amt;
  return l;
}
function fdRepay(l, amt) {
  amt = Math.min(amt, l.bal, Math.max(0, G.bs.cash));
  if (amt <= 0) return 0;
  l.bal -= amt; G.bs.cash -= amt; G.bs.debt -= amt;
  if (l.bal < 1) { G.bs.debt -= l.bal; G.bs.cash -= l.bal; l.bal = 0; }
  return amt;
}
/* 四半期の利息と約定の返済（長期は均等に返す。短期（1年）は期日に借り換える） */
function fdLoansQuarter() {
  let int = 0;
  for (const l of G.loans) {
    if (l.bal <= 0) continue;
    int += l.bal * l.rate / 100 / 4;
    const left = l.q + l.termQ - G.q;
    if (left <= 0) continue;
    if (l.grace && G.q < l.grace) continue;
    if (l.termQ > 4) fdRepay(l, l.amt / Math.max(1, l.termQ - (l.grace ? l.grace - l.q : 0)));
  }
  G.loans = G.loans.filter(l => l.bal > 0.5);
  // 預金の利息（現金の一部を預けている）
  const dep = Math.max(0, G.bs.cash) * Math.max(0, fdRate(fdYf()) - 3) / 100 / 4 * 0.5;
  G.yr.pl.nonop += dep - int; G.qr.pl.nonop += dep - int;
  G.yr.pl.int += int; G.qr.pl.int += int;
  G.bs.cash += dep - int;
  return int;
}

/* ---------- 人 ---------- */
/* 職種ごとの賃金の倍率（工員＝1。昔の技術者・事務員は学歴の差で高かった） */
function fdRoleMul(role, y = fdYf()) {
  if (role === 'wk') return 1;
  if (role === 'eng') return fdSer([[1910, 3.4], [1930, 2.6], [1950, 1.7], [1970, 1.35], [2000, 1.35], [2025, 1.5]], y);
  if (role === 'sal') return fdSer([[1910, 1.6], [1950, 1.25], [1980, 1.15], [2025, 1.15]], y);
  return fdSer([[1910, 2], [1950, 1.3], [1980, 1.2], [2025, 1.25]], y);
}
/* 法定福利・福利厚生などの上乗せ（戦後は社会保険で大きくなる） */
function fdBenefit(y = fdYf()) { return fdSer([[1910, 0.06], [1940, 0.12], [1950, 0.22], [1975, 0.3], [2025, 0.35]], y); }
/* 1人1四半期の人件費（名目の円）。地域が日本以外なら、その地域の賃金の倍率 */
function fdPayQ(role, r = 'jp', y = fdYf()) {
  const base = fdWageM(y) * 3 * fdRoleMul(role, y) * (1 + fdBenefit(y)) * (1 + (G.policy.wage || 0) / 100);
  return base * (r === 'jp' ? 1 : fdSer(FD_REG[r].wage, y, true));
}
/* 人の名前（時代に合わせた名前のリストから） */
function fdName(y = fdYf(), sex = 'm') {
  const sur = pick(FD_SURNAMES);
  const L = sex === 'f' ? (y < 1950 ? FD_GIVEN.fOld : FD_GIVEN.fNew) : (y < 1950 ? FD_GIVEN.mOld : y < 1990 ? FD_GIVEN.mMid : FD_GIVEN.mNew);
  return `${sur} ${pick(L)}`;
}
/* 幹部（名前のある人）。abil：技術・生産・営業・財務・統率（1〜5） */
function fdNewPerson(role, o = {}) {
  const y = fdY();
  const ab = { tech: 2, prod: 2, sales: 2, fin: 2, lead: 2 };
  const main = { cto: 'tech', coo: 'prod', cso: 'sales', cfo: 'fin', ceo: 'lead' }[role] || 'lead';
  ab[main] = randInt(3, 5);
  for (const k of Object.keys(ab)) if (k !== main) ab[k] = clamp(ab[k] + randInt(-1, 1), 1, 4);
  const p = Object.assign({ id: 'H' + (++G.seq), n: fdName(y), role, born: y - randInt(32, 45), abil: ab, joined: G.q, trait: pick(FD_TRAITS).id }, o);
  if (o.abil) p.abil = Object.assign(ab, o.abil);
  G.people.push(p);
  return p;
}
function fdAge(p, y = fdY()) { return y - p.born; }
const FD_ROLE_N = { ceo: '社長', cto: '技師長（技術の責任者）', coo: '工場長（生産の責任者）', cso: '営業部長（販売の責任者）', cfo: '経理部長（お金の責任者）' };
/* 役員の力（いなければ 2）。p.role === role の人の abil[k] */
function fdAbil(role, k) { const p = fdPeopleIn(role)[0]; return p ? p.abil[k] : 2; }
function fdCeo() { return fdPerson(G.ceo); }

/* ---------- 組織の成長の段階（グレイナーのモデル） ----------
   人が増えると、それまでのやり方が通じなくなる「危機」が来る。組織の改革で乗り越えると、次の段階へ進む */
const FD_ORG = [
  { n: '創業者が率いる', min: 0, crisis: '統率の危機', fix: 'kanri', fixN: '管理の仕組みを作る（部長・課長の職制と規程）', d: '創業者がすべてを見て決める。小さいうちは速いが、人が100人を超えると、創業者ひとりでは目が届かなくなる。' },
  { n: '職能別の組織', min: 100, crisis: '自律の危機', fix: 'jigyobu', fixN: '事業部制にする（製品ごとに事業部が利益に責任を持つ）', d: '生産・営業・技術などの部ごとに、本社の指示で動く。製品が増えて1,000人を超えると、現場が決められず遅くなる。' },
  { n: '事業部制', min: 1000, crisis: '統制の危機', fix: 'honsha', fixN: '本社の計画と管理を強める（予算・投資の審査と、事業の選択）', d: '事業部ごとに任せて速く動く。1万人を超えると、事業部どうしの重なりや勝手な投資が増える。' },
  { n: '本社が調整する組織', min: 10000, crisis: '形式主義の危機', fix: 'matrix', fixN: '事業と地域をかけ合わせた組織と、部門を越えたチームにする', d: '本社の計画と管理で全体をそろえる。5万人を超えると、書類と会議が増え、動きが鈍る。' },
  { n: '協働の組織', min: 50000, crisis: null, fix: 'group', fixN: 'グループ経営（持株会社と、事業ごとの会社）', d: '事業と地域のチームが協力して動く。世界中の拠点をまとめる力が問われる。' },
];
function fdOrgStage() { return G.org.st || 0; }
/* 組織の摩擦：次の段階の人数を超えたのに改革していないと、生産性と開発の速さが落ちる */
function fdOrgFriction() {
  const st = fdOrgStage();
  const next = FD_ORG[st + 1];
  if (!next) return 0;
  const head = fdHead();
  if (head <= next.min) return 0;
  return clamp(Math.log(head / next.min) * 0.09, 0, 0.25);
}
