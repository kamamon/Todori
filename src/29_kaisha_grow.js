'use strict';
/* =========================================================
 *  29_kaisha_grow.js : 会社の成長（エンジン。画面は 29b_kaisha_grow_ui.js）
 *   投資（認証・DX・研究開発・ブランド・人材・省エネ）、海外展開（輸出・営業所・現地の拠点）と為替、
 *   M&A（事業の譲受とのれん）、資本政策（増資）と株式上場（IPO・株価・配当・上場維持基準）、
 *   会社の歩み（マイルストーン）
 * ========================================================= */

const ksSq = u => Math.sqrt((u && u.sc) || 1);
/* ---------- 投資（アップグレード） ----------
 * scope: unit（事業ごと）か co（会社全体）。eng: 対象の事業の型。cost: 初めの費用。acct: 資産の科目なら設備投資、費用の科目なら一度に費用
 * mon: 毎月の費用。dur: 効果が出るまでの月数。eff: 効果の倍率（demand 需要・shrink 棚卸減耗・energy 電力・fuel 燃料・quit 離職・acc 労災・leak 漏えい・food 食中毒） */
const KS_UPG_CATS = { cert: '認証・規格', dx: 'DX・システム', rnd: '研究開発・ブランド', hr: '人材・働き方', eco: '省エネ・環境' };
const KS_B2C = ['shop', 'rest', 'subs', 'cap', 'trans'];
const KS_UPG = [
  { id: 'iso9001', cat: 'cert', n: 'ISO 9001（品質マネジメント）', scope: 'unit', eng: ['mfg', 'build', 'trade', 'pro', 'subs', 'cap', 'trans'], cost: u => 250e4 * ksSq(u), acct: 'fees', mon: u => 8e4 * ksSq(u), monAcct: 'fees', dur: 9, eff: { demand: 1.03 },
    desc: '品質の管理の仕組みを整え、審査機関の認証を受ける。取引先の調達の条件になっていることが多く、会社向けの注文が増える。毎年の維持審査の費用がかかる。' },
  { id: 'iso14001', cat: 'cert', n: 'ISO 14001（環境マネジメント）', scope: 'unit', eng: ['mfg', 'build', 'trade', 'cap', 'trans'], cost: u => 250e4 * ksSq(u), acct: 'fees', mon: u => 8e4 * ksSq(u), monAcct: 'fees', dur: 9, eff: { demand: 1.015, energy: 0.95 },
    desc: '環境への負荷を減らす仕組み。電気や燃料のむだが減り、環境に厳しい取引先の評価が上がる。' },
  { id: 'isms', cat: 'cert', n: 'ISMS（ISO/IEC 27001）・プライバシーマーク', scope: 'unit', eng: ['pro', 'subs', 'trade', 'cap', 'shop'], cost: u => 400e4 * ksSq(u), acct: 'fees', mon: u => 10e4 * ksSq(u), monAcct: 'fees', dur: 9, eff: { demand: u => (['pro', 'subs'].includes(ksS(u).eng) ? 1.03 : 1.005), leak: 0.4 },
    desc: '情報の守り方を決めて認証を受ける。情報漏えいが起きにくくなり、個人情報を預ける仕事を受けやすくなる。' },
  { id: 'iatf', cat: 'cert', n: 'IATF 16949（自動車の品質）', scope: 'unit', eng: ['mfg'], cond: u => /自動車|車載|カー|二輪/.test(ksS(u).key), req: 'iso9001', cost: u => 800e4 * ksSq(u), acct: 'fees', mon: u => 15e4 * ksSq(u), monAcct: 'fees', dur: 12, eff: { demand: 1.06 },
    desc: '自動車メーカー・部品メーカーとの取引に必要な品質の規格。ISO 9001を取ってから挑戦する。' },
  { id: 'as9100', cat: 'cert', n: 'JIS Q 9100（航空・宇宙・防衛の品質）', scope: 'unit', eng: ['mfg'], cond: u => /航空|宇宙|防衛|ロケット|衛星/.test(ksS(u).key), req: 'iso9001', cost: u => 1000e4 * ksSq(u), acct: 'fees', mon: u => 15e4 * ksSq(u), monAcct: 'fees', dur: 12, eff: { demand: 1.07 },
    desc: '航空機・宇宙機器の部品をつくる会社に求められる品質の規格。単価の高い仕事が取れる。' },
  { id: 'fssc', cat: 'cert', n: 'FSSC 22000・HACCPの認証（食品安全）', scope: 'unit', cond: u => ksUnitLaws(u).has('haccp'), cost: u => (['shop', 'rest'].includes(ksS(u).eng) ? 150e4 : 500e4) * ksSq(u), acct: 'fees', mon: u => 8e4 * ksSq(u), monAcct: 'fees', dur: 9, eff: { demand: u => (['mfg', 'trade'].includes(ksS(u).eng) ? 1.03 : 1.01), food: 0.4 },
    desc: '食品の安全の仕組みを外部の機関に認めてもらう。食中毒の危険が下がり、大手の小売・外食への納品の条件を満たせる。' },
  { id: 'erp', cat: 'dx', n: '基幹システム（ERP）の導入', scope: 'co', cost: () => 2500e4 * Math.sqrt(Math.max(1, ksActiveUnits().length)) * Math.max(1, Math.pow(ksAnnualSales() / 20e8, 0.3)), acct: 'sw', life: 5, mon: () => 20e4 * Math.sqrt(Math.max(1, ksActiveUnits().length)), monAcct: 'fees', dur: 6, eff: { shrink: 0.8, demand: 1.01 },
    desc: '受発注・在庫・会計・給与をひとつのシステムでつなぐ。在庫の記録のずれや事務のミスが減り、月次決算も早くなる。費用はソフトウェア（無形固定資産）として5年で償却する。' },
  { id: 'ec', cat: 'dx', n: 'ECサイト・予約アプリ', scope: 'unit', eng: ['shop', 'rest', 'trade', 'subs', 'cap', 'trans'], cost: u => 800e4 * ksSq(u), acct: 'sw', life: 5, mon: u => 25e4 * ksSq(u), monAcct: 'ads', dur: 4, eff: { demand: 1.04 },
    desc: 'ネットでの注文・予約の入口をつくる。新しいお客さんが増える。運営と集客の費用が毎月かかる。' },
  { id: 'wms', cat: 'dx', n: '在庫管理・自動発注システム', scope: 'unit', eng: ['shop', 'rest', 'trade', 'mfg'], cost: u => 1200e4 * ksSq(u), acct: 'sw', life: 5, mon: u => 10e4 * ksSq(u), monAcct: 'fees', dur: 4, eff: { shrink: 0.65 },
    desc: 'バーコード・RFIDで在庫を管理し、売れた分だけ自動で発注する。帳簿と実際の在庫のずれ（棚卸減耗）が減る。' },
  { id: 'ai', cat: 'dx', n: '生成AI・データ活用', scope: 'unit', cost: u => 600e4 * ksSq(u), acct: 'sw', life: 5, mon: u => 20e4 * ksSq(u), monAcct: 'fees', dur: 3, eff: { demand: u => (['pro', 'subs'].includes(ksS(u).eng) ? 1.05 : 1.02) },
    desc: '問い合わせ対応・需要の予測・提案書づくりなどにAIとデータを使う。お客さんへの対応が良くなり、仕事が増える。' },
  { id: 'iot', cat: 'dx', n: 'IoTで設備を見える化（予知保全）', scope: 'unit', eng: ['mfg', 'cap', 'trans', 'subs'], cost: u => 1500e4 * ksSq(u), acct: 'sw', life: 5, mon: u => 10e4 * ksSq(u), monAcct: 'fees', dur: 4, eff: { energy: 0.94, fuel: 0.96, demand: 1.01 },
    desc: '設備にセンサーを付け、稼働と電力をリアルタイムで見る。故障の前に手を打てて、電気・燃料のむだも減る。' },
  { id: 'rndc', cat: 'rnd', n: '研究開発センター', scope: 'unit', eng: ['mfg', 'pro', 'subs'], cost: u => 1.2e8 * ksSq(u), acct: 'bldg', life: 15, mon: u => 500e4 * ksSq(u), monAcct: 'rnd', dur: 18, eff: { demand: 1.07 },
    desc: '新しい製品・技術・サービスを研究する拠点。研究開発費（販管費）が毎月かかり、効果が出るまで1年半かかるが、付加価値の高い仕事が取れるようになる。' },
  { id: 'design', cat: 'rnd', n: '商品の企画・デザインの強化', scope: 'unit', eng: ['mfg', 'shop', 'rest', 'subs'], cost: u => 1000e4 * ksSq(u), acct: 'fees', mon: u => 50e4 * ksSq(u), monAcct: 'rnd', dur: 6, eff: { demand: 1.03 },
    desc: 'デザイナー・企画の専門家と組んで、選ばれる商品・メニュー・サービスをつくる。' },
  { id: 'brand', cat: 'rnd', n: 'ブランドの刷新（CI・広告）', scope: 'co', cost: () => 2000e4 * Math.max(1, Math.pow(ksAnnualSales() / 20e8, 0.4)), acct: 'ads', dur: 3, eff: { demand: u => (KS_B2C.includes(ksS(u).eng) ? 1.025 : 1.01) },
    desc: '社名のロゴ・店の看板・ホームページを新しくし、広告を打つ。一度に広告宣伝費になる。お客さんに知られ、選ばれやすくなる。' },
  { id: 'hrsys', cat: 'hr', n: '人事制度・教育体系の整備', scope: 'co', cond: () => ksHeadcount() >= 20, cost: () => 600e4, acct: 'fees', mon: () => 0.8e4 * ksHeadcount(), monAcct: 'recruit', dur: 6, eff: { quit: 0.7, acc: 0.9 },
    desc: '評価・給与・研修の仕組みをつくる（従業員20人以上）。社員が育ち、辞めにくくなる。研修費が毎月かかる。' },
  { id: 'kenko', cat: 'hr', n: '健康経営（健康経営優良法人）', scope: 'co', cost: () => 300e4, acct: 'fees', mon: () => 0.3e4 * ksHeadcount(), monAcct: 'fukuri', dur: 6, eff: { acc: 0.88, quit: 0.9, demand: 1.005 },
    desc: '健康診断の後の保健指導・運動・禁煙などに会社として取り組み、認定を受ける。けがや病気が減り、採用にも効く。' },
  { id: 'telework', cat: 'hr', n: 'テレワーク・働き方改革', scope: 'unit', eng: ['pro', 'subs'], cost: u => 500e4 * ksSq(u), acct: 'equip', life: 4, dur: 2, eff: { quit: 0.8 },
    desc: 'ノートパソコン・セキュリティ・オンライン会議の環境を整える。働きやすくなり、エンジニアが辞めにくくなる。' },
  { id: 'solar', cat: 'eco', n: '太陽光発電（自家消費）', scope: 'unit', eng: ['mfg', 'cap', 'shop', 'trade', 'subs'], cost: u => 3000e4 * ksSq(u), acct: 'mach', life: 15, dur: 3, eff: { energy: 0.88 },
    desc: '工場・倉庫・店の屋根に太陽光パネルを付け、つくった電気を自分で使う。電気代が下がる（機械装置として15年で償却）。' },
  { id: 'ev', cat: 'eco', n: '低燃費車・EVへの入れ替え', scope: 'unit', eng: ['trans', 'trade', 'build'], cond: u => ksS(u).eng !== 'trans' || ['truck', 'bus', 'taxi'].includes(ksS(u).p.mode), cost: u => 2000e4 * ksSq(u), acct: 'veh', life: 5, dur: 2, eff: { fuel: 0.85 },
    desc: 'トラック・バス・社用車を低燃費車や電気自動車に入れ替える。燃料費が下がる。' },
];
const KS_UPG_BY = Object.fromEntries(KS_UPG.map(x => [x.id, x]));
function ksUpgKey(U, u) { return U.scope === 'unit' ? `${U.id}@${u.id}` : U.id; }
function ksUpgState(U, u) { return G.grow && G.grow.up[ksUpgKey(U, u)]; }
/* その事業（会社）で選べるか：{ ok, why } */
function ksUpgAvail(U, u) {
  if (ksUpgState(U, u)) return { ok: false, why: '実施済み' };
  if (U.scope === 'unit') {
    if (!u) return { ok: false, why: '' };
    if (U.eng && !U.eng.includes(ksS(u).eng)) return { ok: false, why: 'この事業には合わない' };
    if (U.cond && !U.cond(u)) return { ok: false, why: 'この事業には合わない' };
    if (U.req && !(G.grow.up[`${U.req}@${u.id}`] && G.grow.up[`${U.req}@${u.id}`].eff <= G.m)) return { ok: false, why: `先に${KS_UPG_BY[U.req].n}が必要` };
  } else if (U.cond && !U.cond()) return { ok: false, why: '条件を満たしていない' };
  return { ok: true, why: '' };
}
/* 効果の倍率（事業 u のある項目） */
function ksUpgEffV(U, key, u) { const v = U.eff[key]; return typeof v === 'function' ? v(u) : v; }
function ksUpgradeF(u, key) {
  const g = G.grow;
  if (!g || !u) return 1;
  let f = 1;
  for (const x of Object.values(g.up)) {
    if (x.eff > G.m) continue;
    const U = KS_UPG_BY[x.id];
    if (!U || U.eff[key] === undefined) continue;
    if (x.u && x.u !== u.id) continue;
    if (!x.u && U.eng && !U.eng.includes(ksS(u).eng)) continue;
    f *= ksUpgEffV(U, key, u);
  }
  if (key === 'demand') f *= ksIntlDemandF(u) * ksIpoDemandF();
  return f;
}
/* 投資を記録する（設備投資の画面から、または費用の投資を実行したとき） */
function ksUpgRegister(id, uid) {
  const U = KS_UPG_BY[id];
  const u = uid ? ksUnit(uid) : null;
  const key = U.scope === 'unit' ? `${id}@${uid}` : id;
  G.grow.up[key] = { id, u: U.scope === 'unit' ? uid : null, m: G.m, eff: G.m + (U.dur || 0) };
  return `${U.n}${u ? `（${ksUName(u)}）` : ''}は${U.dur ? `${ymLabel(G.m + U.dur)}から効果が出ます` : 'すぐに効果が出ます'}`;
}
/* 費用の投資（資産にならないもの）を実行する */
function ksUpgDoExpense(id, uid) {
  const U = KS_UPG_BY[id];
  const u = uid ? ksUnit(uid) : null;
  const cost = Math.round(U.cost(u));
  ksPost('upg', [[U.acct, cost, 0], ['cash', 0, cost]], { cf: 'exp', u: uid || 'HQ', desc: `${U.n}${u ? `（${ksUName(u)}）` : ''}` });
  const msg = ksUpgRegister(id, uid);
  ksNews(`${U.n}${u ? `（${ksUName(u)}）` : ''}を始めました（${fmtYen(cost)}）。${msg}`, 'good');
  return cost;
}
/* 設備投資の画面の効果のキー */
if (typeof KS_CAPEX_FX !== 'undefined') KS_CAPEX_FX.upg = a => ksUpgRegister(a.id, a.u);

/* ---------- 海外展開と為替 ---------- */
const KS_REGIONS = {
  asia: { n: 'アジア（中国・東南アジア）', cur: 'usd' },
  na: { n: '北米', cur: 'usd' },
  eu: { n: '欧州', cur: 'eur' },
  sw: { n: 'インド・中東', cur: 'usd' },
};
const KS_FX0 = { usd: 148, eur: 160 };
function ksIntlStage3Name(u) {
  const e = ksS(u).eng;
  return { mfg: '海外工場', shop: '海外の店舗（直営・FC）', rest: '海外の店舗（直営・FC）', trade: '海外の物流拠点', pro: '海外の開発・運用拠点', subs: '海外の開発・運用拠点', cap: '海外の施設', trans: '海外の路線・拠点', build: '海外の工事拠点' }[e] || '海外の拠点';
}
/* 海外展開の費用は、事業の売上（年商。1億円未満は1億円とみなす）に比べた割合。型ごとの重さ（KS_INTL_CF）を掛ける。
   毎月の費用は、その段階を始めたときの規模（x.base）で決まる */
const KS_INTL_CF = { trade: 0.3, shop: 0.8, rest: 1, mfg: 1, build: 0.8, pro: 1.2, subs: 1.2, cap: 1, trans: 0.8 };
function ksIntlBase(u) { return Math.max(1e8, ksUnitSales12(u)) * (KS_INTL_CF[ksS(u).eng] || 1); }
const KS_INTL_ST = [null,
  { n: () => '輸出（代理店・越境EC）', share: 0.06, cost: u => Math.max(300e4, ksIntlBase(u) * 0.015), acct: 'fees', mon: (u, b) => (b || ksIntlBase(u)) * 0.005 / 12, monAcct: 'fees', wait: 0,
    desc: '海外の代理店や越境ECで売り始める。展示会・海外の規格の認証・代理店の契約の費用がかかる。代金は外国の通貨で受け取るので、為替の影響を受ける。' },
  { n: () => '海外営業所', share: 0.14, cost: u => Math.max(1500e4, ksIntlBase(u) * 0.03), acct: 'equip', life: 6, mon: (u, b) => (b || ksIntlBase(u)) * 0.025 / 12, monAcct: 'salary', wait: 12,
    desc: '現地に営業所を開き、駐在員と現地の社員で直接売る。輸出を1年以上続けてから。事務所の設備は資産、駐在員の給与は給料手当。' },
  { n: u => ksIntlStage3Name(u), share: 0.26, cost: u => Math.max(1e8, ksIntlBase(u) * 0.25), acct: 'bldg', life: 20, mon: (u, b) => (b || ksIntlBase(u)) * 0.04 / 12, monAcct: u => ({ mfg: 'mfgExp', shop: 'rent', rest: 'rent' }[ksS(u).eng] || 'svcExp'), wait: 24,
    desc: '現地に工場・店舗・拠点をつくり、現地でつくって売る。営業所を2年以上続けてから。大きな設備投資（建物として20年で償却）と、現地の運営費がかかる。' },
];
function ksFxRate(cur) { return cur === 'eur' ? G.eco.eur || KS_FX0.eur : G.eco.fx || KS_FX0.usd; }
/* 海外の売上の分の需要の倍率（円安なら円で受け取る額が増える） */
function ksIntlDemandF(u) {
  const it = G.grow && G.grow.intl[u.id];
  if (!it) return 1;
  let f = 1;
  for (const [r, x] of Object.entries(it)) {
    const st = KS_INTL_ST[x.st];
    if (!st || x.m > G.m) continue;
    const ramp = clamp((G.m - x.m) / 12, 0.3, 1);
    const cur = KS_REGIONS[r].cur;
    f += st.share * ramp * Math.pow(ksFxRate(cur) / KS_FX0[cur], 0.6);
  }
  return f;
}
function ksIntlStage(u, r) { const it = G.grow.intl[u.id]; return it && it[r] ? it[r].st : 0; }
function ksIntlNext(u, r) {
  const cur = ksIntlStage(u, r);
  if (cur >= 3) return { ok: false, why: '最後の段階まで進んだ' };
  const st = KS_INTL_ST[cur + 1];
  const x = (G.grow.intl[u.id] || {})[r];
  if (cur === 0 && ksUnitSales12(u) < 1e8) return { ok: false, why: '事業の年商1億円から', st };
  if (x && G.m - x.m < st.wait) return { ok: false, why: `${ymLabel(x.m + st.wait)}から`, st };
  return { ok: true, why: '', st };
}
/* 海外展開を進める（費用の段階はここで払う。資産の段階は設備投資の画面から KS_CAPEX_FX.intl） */
function ksIntlRegister(uid, r) {
  const it = G.grow.intl[uid] || (G.grow.intl[uid] = {});
  const st = (it[r] ? it[r].st : 0) + 1;
  const u = ksUnit(uid);
  it[r] = { st, m: G.m, base: Math.round(ksIntlBase(u)) };
  return `${ksUName(u)}：${KS_REGIONS[r].n}で${KS_INTL_ST[st].n(u)}を始めました`;
}
function ksIntlDoExpense(uid, r) {
  const u = ksUnit(uid);
  const nx = ksIntlNext(u, r);
  const cost = Math.round(nx.st.cost(u));
  ksPost('intl', [[nx.st.acct, cost, 0], ['cash', 0, cost]], { cf: 'exp', u: uid, desc: `海外展開（${KS_REGIONS[r].n}）` });
  const msg = ksIntlRegister(uid, r);
  ksNews(`${msg}（${fmtYen(cost)}）`, 'good');
  return cost;
}
if (typeof KS_CAPEX_FX !== 'undefined') KS_CAPEX_FX.intl = a => ksIntlRegister(a.u, a.r);
/* 外貨建ての売掛金の入金：売ったときの為替と入金のときの為替の差が為替差損益（為替予約の分は差が出ない） */
function ksFxMonth() {
  const g = G.grow;
  // 今月の海外の売上を、2か月後の入金として記録する
  for (const u of ksActiveUnits()) {
    const it = g.intl[u.id];
    if (!it) continue;
    const D = ksIntlDemandF(u);
    if (D <= 1) continue;
    const sales = ((G.flowU || {})[u.id] || {}).sales || 0;
    const foreign = sales * (D - 1) / D;
    if (foreign <= 0) continue;
    const tot = sum(Object.entries(it), ([r, x]) => (x.m <= G.m && KS_INTL_ST[x.st] ? KS_INTL_ST[x.st].share : 0)) || 1;
    for (const [r, x] of Object.entries(it)) {
      if (x.m > G.m || !KS_INTL_ST[x.st]) continue;
      const cur = KS_REGIONS[r].cur;
      g.fxq.push({ due: G.m + 2, amt: Math.round(foreign * KS_INTL_ST[x.st].share / tot), cur, rate: ksFxRate(cur), u: u.id, h: g.hedge });
    }
  }
  const due = g.fxq.filter(q => q.due <= G.m);
  g.fxq = g.fxq.filter(q => q.due > G.m);
  const byU = {};
  for (const q of due) byU[q.u] = (byU[q.u] || 0) + q.amt * (ksFxRate(q.cur) / q.rate - 1) * (1 - q.h);
  let tot = 0;
  for (const [uid, v0] of Object.entries(byU)) {
    const v = Math.round(v0);
    if (!v) continue;
    if (v > 0) ksPost('fxGain', [['cash', v, 0], ['fxGain', 0, v]], { cf: 'collect', u: 'HQ', key: uid });
    else ksPost('fxLoss', [['fxLoss', -v, 0], ['cash', 0, -v]], { cf: 'collect', u: 'HQ', key: uid });
    tot += v;
  }
  g.fxYTD = (calMonth(G.m) === 4 ? 0 : g.fxYTD || 0) + tot;
}

/* ---------- M&A（事業の譲受） ---------- */
/* 候補の事業をさがす（仲介会社への着手金がかかる） */
const KS_MA_FEE = 300e4;
function ksMaFind() {
  const g = G.grow;
  const us = ksActiveUnits();
  const secs = [...new Set(us.map(u => ksS(u).sec))];
  const annual = Math.max(3e8, ksAnnualSales());
  const pool = KS_TYPE_LIST.filter(S => !us.some(u => u.type === S.name));
  const list = [];
  for (let i = 0; i < 4 && pool.length; i++) {
    const near = chance(0.6) ? pool.filter(S => secs.includes(S.sec)) : pool;
    const S = pick(near.length ? near : pool);
    const target = annual * uni(0.08, 0.45);
    list.push({ id: 'M' + (++g.maSeq), type: S.name, target, seed: (G.rs ^ (g.maSeq * 2654435761)) | 0, co: `${pick(CO_PREFIX)}${S.icon === '工' ? pick(['製作所', '工業', '産業']) : S.icon === '店' ? pick(['商店', 'ストア']) : pick(['商事', '株式会社', 'サービス'])}`, m: G.m });
  }
  g.ma = { list, m: G.m };
  ksPost('maFee', [['fees', KS_MA_FEE, 0], ['cash', 0, KS_MA_FEE]], { cf: 'exp', u: 'HQ', desc: 'M&Aの仲介会社への着手金' });
  return list;
}
/* 時間に関わる値（開業の月など）をずらす */
function ksShiftM(o, D) {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number' && /^(openM|renovM|eqM|kitM|startM|since|doneM)$/.test(k) && v < 9000) o[k] = v + D;
    else if (v && typeof v === 'object') ksShiftM(v, D);
  }
}
/* 候補の事業をつくってみる（sandbox=true なら元に戻す）→ { u, net, price, annual, opi, lines, assets } */
function ksMaBuild(c, sandbox) {
  const snap = { ar: G.ar.map(x => Object.assign({}, x)), ap: G.ap.map(x => Object.assign({}, x)), nA: G.assets.length, seq: G.seq, useq: G.useq, rs: G.rs };
  G.rs = c.seed;
  const S = KS_TYPES[c.type];
  // 規模：年商がだいたい target になるように
  const probe = (sc) => {
    const u = { id: 'U' + (G.useq + 1), type: c.type, n: null, sc, op: {}, staff: {}, invB: {}, kpi: {}, startM: G.m };
    G.curU = u.id;
    const r = KS_ENGINE[S.eng].init(u, KS_COND.normal);
    G.curU = null;
    return { u, r };
  };
  let sc = 1;
  if (!c.sc) {
    const p1 = probe(1);
    sc = clamp(c.target / Math.max(1, p1.r.annual || 1), 0.3, 6);
    G.ar = snap.ar.map(x => Object.assign({}, x)); G.ap = snap.ap.map(x => Object.assign({}, x)); G.assets.length = snap.nA; G.seq = snap.seq;
    c.sc = +sc.toFixed(2);
  }
  G.rs = c.seed;
  const { u, r } = probe(c.sc);
  G.useq++;
  const D = G.m - KS_HIST_START;
  const newA = G.assets.slice(snap.nA);
  for (const a of newA) {
    a.acqM += D;
    a.booked = a.acct === 'land' || !a.life ? 0 : Math.min(a.cost - 1, Math.round(a.cost / a.life * Math.max(0, G.m - a.acqM) / 12));
    if (KS_DIRECT[a.acct]) a.booked = Math.min(a.booked, a.cost - 1);
  }
  ksShiftM(u.op, D);
  {
    KS_ENGINE[S.eng].calib(u, KS_ENG_OPM[S.eng]);
    const k = ksCalibEmp(u, KS_ENG_OPM[S.eng]);
    if (k !== 1) KS_ENGINE[S.eng].scale(u, k);
  }
  // 売掛金・買掛金は引き継がない（事業譲受）
  G.ar = snap.ar; G.ap = snap.ap;
  const lines = [];
  let net = 0, accDep = 0;
  const byAcct = {};
  for (const a of newA) byAcct[a.acct] = (byAcct[a.acct] || 0) + (KS_DIRECT[a.acct] ? a.cost - a.booked : a.cost);
  for (const a of newA) if (!KS_DIRECT[a.acct] && a.acct !== 'land') accDep += a.booked;
  for (const [k, v] of Object.entries(byAcct)) { lines.push([k, v, 0]); net += v; }
  if (accDep) { lines.push(['accDep', 0, accDep]); net -= accDep; }
  for (const [k, v] of Object.entries(r.inv || {})) if (v) { lines.push([k, Math.round(v), 0]); net += Math.round(v); }
  for (const [k, v] of Object.entries(r.extra || {})) if (v) { lines.push([k, 0, Math.round(v)]); net -= Math.round(v); }
  if (r.deposit) { lines.push(['deposit', Math.round(r.deposit), 0]); net += Math.round(r.deposit); }
  const annual = r.annual || 0;
  const opi = annual * KS_ENG_OPM[S.eng];
  const prem = Math.max(opi * 3.5, annual * 0.02);
  const price = Math.max(niceAmount(Math.max(net * 1.02, net + prem)), niceAmount(Math.max(1e7, prem)));
  const res = { u, r, net, price, annual, opi, lines, newA, head: ksUnitHead(u), sc: c.sc };
  if (sandbox) { G.assets.length = snap.nA; G.seq = snap.seq; G.useq = snap.useq; G.rs = snap.rs; }
  else G.rs = snap.rs;
  return res;
}
function ksMaQuote(c) { if (!c.q) { const b = ksMaBuild(c, true); c.q = { net: b.net, price: b.price, annual: b.annual, opi: b.opi, head: b.head, sc: b.sc, nA: b.newA.length }; } return c.q; }
/* 買う（お金の用意は画面の側で） */
function ksMaBuy(c) {
  const b = ksMaBuild(c, false);
  const u = b.u;
  u.n = `${KS_TYPES[c.type].name}（旧${c.co}）`;
  u.startM = G.m;
  u.acq = { m: G.m, price: b.price, co: c.co };
  G.units.push(u);
  const gw = b.price - b.net;
  const lines = b.lines.slice();
  if (gw > 0) {
    ksNewAsset({ n: `のれん（${c.co}）`, acct: 'goodwill', cost: gw, life: 10, part: 'S', u: u.id, acqM: G.m });
    lines.push(['goodwill', gw, 0]);
  }
  lines.push(['cash', 0, b.price]);
  ksPost('maBuy', lines, { cf: 'capex', u: u.id, desc: `事業の譲受（${c.co}）` });
  // 引き継いだ設備の取得の月は、今の月にする（減価償却の計算は、引き継いだ帳簿価額を取得価額として続ける）
  if (typeof ksLawAddUnit === 'function') ksLawAddUnit(u);
  G.wfPrevU = G.wfPrevU || {};
  G.grow.ma.list = G.grow.ma.list.filter(x => x !== c);
  G.grow.maDone = (G.grow.maDone || 0) + 1;
  ksNews(`${c.co}から${KS_TYPES[c.type].name}の事業を${fmtYen(b.price)}で譲り受けました（引き継いだ資産 ${fmtYen(b.net)}・のれん ${fmtYen(Math.max(0, gw))}・従業員${b.head}人）`, 'good');
  return { u, gw, price: b.price, net: b.net };
}

/* ---------- 資本政策と株式上場 ---------- */
const KS_MARKETS = {
  tpm: { n: 'TOKYO PRO Market', s: 'TPM', float: 0, desc: 'プロの投資家（特定投資家）向けの市場。数値の基準はなく、J-Adviser（指定アドバイザー）の審査で上場する。一般の投資家は買えないので、資金調達よりも信用と知名度のため。' },
  growth: { n: 'グロース市場', s: 'グロース', float: 0.25, desc: '高い成長が見込める会社の市場。利益の基準はない。株主150人以上・流通株式時価総額5億円以上・流通株式比率25%以上。上場5年後から時価総額100億円以上を保つ必要がある（2030年3月から）。' },
  standard: { n: 'スタンダード市場', s: 'スタンダード', float: 0.25, desc: '安定した収益の基盤がある会社の市場。株主400人以上・流通株式時価総額10億円以上・流通株式比率25%以上・純資産が正・最近1年の利益1億円以上。' },
  prime: { n: 'プライム市場', s: 'プライム', float: 0.35, desc: '大きな時価総額と優れた収益力の会社の市場。株主800人以上・時価総額250億円以上・流通株式時価総額100億円以上・流通株式比率35%以上・純資産50億円以上・最近2年の利益の合計25億円以上。' },
};
const KS_PER = { shop: 14, rest: 18, mfg: 12, build: 9, trade: 10, pro: 18, subs: 28, cap: 15, trans: 11 };
const KS_PSR = { shop: 0.3, rest: 0.5, mfg: 0.4, build: 0.25, trade: 0.15, pro: 1.2, subs: 2.5, cap: 0.8, trans: 0.4 };
function ksIpo() { return G.grow.ipo; }
function ksListed() { return G.grow && G.grow.ipo.st === 'listed'; }
/* 会社の価値（理論株価）。上場していなければ、取引されない分だけ割り引く */
function ksValuation() {
  const ipo = ksIpo();
  const fys = ksFYList();
  const L = fys.length ? G.fys[fys[fys.length - 1]] : null;
  const P = fys.length > 1 ? G.fys[fys[fys.length - 2]] : null;
  const us = ksActiveUnits();
  const w = us.map(u => Math.max(1, ksUnitSales12(u)));
  const W = sum(w, x => x) || 1;
  const per0 = sum(us, (u, i) => KS_PER[ksS(u).eng] * w[i]) / W;
  const psr = sum(us, (u, i) => KS_PSR[ksS(u).eng] * w[i]) / W;
  const sales = L ? L.pl.sales : ksAnnualSales();
  const ni = L ? L.pl.ni : 0;
  const eq = L ? ksToBankFS(L).EQ : ksEquity();
  const growth = L && P && P.pl.sales > 0 ? L.pl.sales / P.pl.sales - 1 : 0;
  const per = per0 * (1 + clamp(growth, -0.25, 0.6) * 1.5);
  let v = ni > 0 ? ni * per : sales * psr * (1 + clamp(growth, 0, 0.6));
  v = Math.max(v, eq * 0.6, 1e7);
  v *= G.eco.stk || 1;
  if (ipo.st !== 'listed') v *= 0.7;
  return { v, per, psr, growth, ni, eq, sales, basis: ni > 0 ? 'per' : 'psr' };
}
/* 1株の値段と時価総額 */
function ksSharePrice() { const ipo = ksIpo(); return ipo.st === 'listed' ? ipo.price : ksValuation().v / ipo.shares; }
function ksMcap() { return ksSharePrice() * ksIpo().shares; }
/* 上場の準備を始める（監査法人・主幹事証券と契約し、管理の体制を整える） */
function ksIpoPrep() {
  const ipo = ksIpo();
  ipo.st = 'prep'; ipo.prepM = G.m; ipo.prepFY = fyOf(G.m);
  ksNews('株式上場の準備を始めました。監査法人の監査を受け、内部管理の体制を整えます（上場の申請は、監査を受けた決算が2期そろってから）', 'good');
}
/* 監査を受けた決算の数（準備を始めた期から） */
function ksIpoAuditedFY() { const ipo = ksIpo(); return ipo.prepFY === null || ipo.prepFY === undefined ? 0 : ksFYList().filter(f => f >= ipo.prepFY).length; }
/* 市場ごとの基準の確認：[{ k, n, ok, v }] */
function ksIpoChecks(mk, plan) {
  const ipo = ksIpo();
  const fys = ksFYList();
  const L = fys.length ? G.fys[fys[fys.length - 1]] : null;
  const P = fys.length > 1 ? G.fys[fys[fys.length - 2]] : null;
  const val = ksValuation();
  const mcap = val.v / 0.7 * 0.85; // 公開価格（上場後の価値の少し下）での時価総額
  const fl = plan ? plan.float : KS_MARKETS[mk].float;
  const eq = L ? ksToBankFS(L).EQ : 0;
  const out = [];
  const aud = ksIpoAuditedFY();
  const fraud = Object.values(G.fys).some(s => s.fraudInv) || ksFraudActive();
  out.push({ n: '監査法人の監査を受けた決算（2期）', ok: aud >= 2, v: `${aud}期` });
  out.push({ n: '内部管理の体制（準備から2年）', ok: ipo.prepM !== null && G.m - ipo.prepM >= 24, v: ipo.prepM !== null ? `${Math.max(0, G.m - ipo.prepM)}か月` : '準備前' });
  out.push({ n: '粉飾・重い法令違反がない', ok: !fraud && !(G.law && G.law.flagM !== undefined && G.m - G.law.flagM < 24), v: fraud ? '粉飾あり' : G.law && G.law.flagM !== undefined && G.m - G.law.flagM < 24 ? '送検・公表あり' : 'なし' });
  if (mk === 'tpm') return out;
  out.push({ n: `流通株式比率 ${fmtPct(KS_MARKETS[mk].float * 100, 0)}以上`, ok: fl >= KS_MARKETS[mk].float - 1e-9, v: fmtPct(fl * 100, 0) });
  const fm = mcap * fl;
  if (mk === 'growth') {
    out.push({ n: '流通株式時価総額 5億円以上', ok: fm >= 5e8, v: fmtYen(fm) });
    out.push({ n: '高い成長（売上の伸び15%以上、または利用者・会員の事業）', ok: val.growth >= 0.15 || ksActiveUnits().some(u => ksS(u).eng === 'subs'), v: fmtPct(val.growth * 100, 1) });
  }
  if (mk === 'standard') {
    out.push({ n: '流通株式時価総額 10億円以上', ok: fm >= 10e8, v: fmtYen(fm) });
    out.push({ n: '純資産が正', ok: eq > 0, v: fmtYen(eq) });
    out.push({ n: '最近1年の利益（経常利益）1億円以上', ok: L && L.pl.ord >= 1e8, v: L ? fmtYen(L.pl.ord) : '―' });
  }
  if (mk === 'prime') {
    out.push({ n: '時価総額 250億円以上', ok: mcap >= 250e8, v: fmtYen(mcap) });
    out.push({ n: '流通株式時価総額 100億円以上', ok: fm >= 100e8, v: fmtYen(fm) });
    out.push({ n: '純資産 50億円以上', ok: eq >= 50e8, v: fmtYen(eq) });
    const two = (L ? L.pl.ord : 0) + (P ? P.pl.ord : 0);
    out.push({ n: '最近2年の利益の合計25億円以上（または売上100億円以上かつ時価総額1,000億円以上）', ok: two >= 25e8 || ((L ? L.pl.sales : 0) >= 100e8 && mcap >= 1000e8), v: fmtYen(two) });
  }
  return out;
}
/* 上場を申請する。plan: { newR 公募（今の株数に対する割合）, sellR 売出（社長の持ち株のうち売る割合） } */
function ksIpoPlan(mk, newR, sellR) {
  const ipo = ksIpo();
  const pre = ipo.shares;
  const nNew = Math.round(pre * newR);
  const post = pre + nNew;
  const sold = Math.round(pre * ipo.own * sellR);
  const flt = (nNew + sold + pre * (ipo.vc || 0) * 0.5) / post;
  const val = ksValuation();
  const price = val.v / 0.7 * 0.85 / pre; // 公開価格：上場後の価値の15%引き
  return { mk, newR, sellR, nNew, post, sold, float: flt, price, raise: nNew * price, fee: nNew * price * 0.06, ownerCash: sold * price };
}
function ksIpoApply(mk, plan) {
  const ipo = ksIpo();
  ipo.st = 'review'; ipo.applyM = G.m; ipo.plan = Object.assign({}, plan, { mk });
  ksNews(`${KS_MARKETS[mk].n}への上場を申請しました。取引所と主幹事証券の審査は約3か月です`, 'info');
}
/* 審査の結果（申請から3か月後） */
function ksIpoReview() {
  const ipo = ksIpo();
  if (ipo.st !== 'review' || G.m - ipo.applyM < 3) return;
  const mk = ipo.plan.mk;
  const chk = ksIpoChecks(mk, ipo.plan);
  const lawOpen = G.law && G.law.insp.some(x => x.status === 'open');
  const ok = chk.every(c => c.ok) && !lawOpen && (G.grade || 10) <= 6 && !G.over;
  if (!ok) {
    ipo.st = 'prep'; ipo.fails = (ipo.fails || 0) + 1;
    const why = chk.filter(c => !c.ok).map(c => c.n).concat(lawOpen ? ['役所の指摘が直っていない'] : []).concat((G.grade || 10) > 6 ? ['銀行の格付が低い'] : []);
    ksNews(`上場の審査に通りませんでした（${why.join('・') || '審査の過程で課題を指摘された'}）。準備を続けて、次の機会に申請し直します`, 'bad');
    G.pendingModals.push({ type: 'kIpoResult', ok: false, why });
    return;
  }
  // 上場：株式分割で1株の値段を2,000円ほどにしてから、公募と売出をする
  const plan = ksIpoPlan(mk, ipo.plan.newR, ipo.plan.sellR);
  const split = Math.max(1, Math.round(plan.price / 2000));
  ipo.shares *= split;
  const nNew = plan.nNew * split, sold = plan.sold * split;
  const price = Math.round(plan.price / split);
  const raise = nNew * price;
  const fee = Math.round(raise * 0.06);
  if (raise > 0) {
    const cap = Math.round(raise / 2);
    ksPost('ipo', [['cash', raise, 0], ['capital', 0, cap], ['capSurplus', 0, raise - cap]], { cf: 'equity', u: 'HQ', desc: '公募増資（上場時）' });
    ksPost('ipoFee', [['stockCost', fee, 0], ['cash', 0, fee]], { cf: 'other', u: 'HQ', desc: '株式交付費（証券会社の引受手数料など）' });
  }
  const pre = ipo.shares;
  ipo.shares = pre + nNew;
  ipo.own = (pre * ipo.own - sold) / ipo.shares;
  ipo.vc = (pre * (ipo.vc || 0)) / ipo.shares;
  ipo.floatR = plan.float;
  ipo.st = 'listed'; ipo.market = mk; ipo.listM = G.m; ipo.price = price; ipo.offer = price; ipo.split = split;
  ipo.ownerCash = (ipo.ownerCash || 0) + sold * price;
  ipo.hist = [{ m: G.m, p: price }];
  ksNews(`【上場】${G.coName}が${KS_MARKETS[mk].n}に上場しました。公開価格${fmtNum(price, 0)}円、公募増資で${fmtYen(raise)}を調達（時価総額 ${fmtYen(price * ipo.shares)}）`, 'good');
  G.pendingModals.push({ type: 'kIpoResult', ok: true, mk, raise, price });
}
/* 上場後の公募増資（時価の3%引き） */
function ksIpoPO(amt) {
  const ipo = ksIpo();
  const price = Math.round(ipo.price * 0.97);
  const n = Math.max(1, Math.floor(amt / price));
  const raise = n * price;
  const cap = Math.round(raise / 2);
  ksPost('po', [['cash', raise, 0], ['capital', 0, cap], ['capSurplus', 0, raise - cap]], { cf: 'equity', u: 'HQ', desc: '公募増資' });
  const fee = Math.round(raise * 0.04);
  ksPost('ipoFee', [['stockCost', fee, 0], ['cash', 0, fee]], { cf: 'other', u: 'HQ', desc: '株式交付費' });
  ipo.own = ipo.own * ipo.shares / (ipo.shares + n);
  ipo.vc = (ipo.vc || 0) * ipo.shares / (ipo.shares + n);
  ipo.floatR = (ipo.floatR * ipo.shares + n) / (ipo.shares + n);
  ipo.shares += n;
  ipo.price = Math.round(ipo.price * 0.96); // 1株の価値が薄まる（希薄化）
  ksNews(`公募増資で${fmtYen(raise)}を調達しました（新しい株 ${fmtNum(n, 0)}株・1株${fmtNum(price, 0)}円）`, 'good');
  return raise;
}
/* 上場前の第三者割当増資（ベンチャーキャピタルなど） */
function ksVcRaise(amt) {
  const ipo = ksIpo();
  const pp = ksValuation().v * 0.9 / ipo.shares;
  const n = Math.max(1, Math.round(amt / pp));
  const raise = Math.round(n * pp);
  const cap = Math.round(raise / 2);
  ksPost('vc', [['cash', raise, 0], ['capital', 0, cap], ['capSurplus', 0, raise - cap]], { cf: 'equity', u: 'HQ', desc: '第三者割当増資' });
  ipo.own = ipo.own * ipo.shares / (ipo.shares + n);
  ipo.vc = ((ipo.vc || 0) * ipo.shares + n) / (ipo.shares + n);
  ipo.shares += n;
  ipo.vcM = ipo.vcM ?? G.m;
  ksNews(`ベンチャーキャピタルから第三者割当増資で${fmtYen(raise)}を調達しました（社長の持ち株比率 ${fmtPct(ipo.own * 100, 1)}）`, 'good');
  return raise;
}
/* 上場の準備・上場の費用（毎月） */
function ksIpoCostMonth() {
  const ipo = ksIpo();
  const S = ksAnnualSales();
  let y = 0;
  if (ipo.st === 'prep' || ipo.st === 'review') y = 1500e4 + S * 0.0003 + 800e4 + 3 * 600e4; // 監査・証券会社とコンサル・管理部門の増員
  else if (ipo.st === 'listed') y = 2500e4 + S * 0.0004 + clamp(ksMcap() * 0.00002, 120e4, 456e4) + 1500e4 + 3 * 700e4; // 監査・年間上場料・IRと株主総会と株式事務・管理部門
  if (y > 0) ksPost('listFee', [['listFee', Math.round(y / 12), 0], ['cash', 0, Math.round(y / 12)]], { cf: 'exp', u: 'HQ' });
}
/* 株価（毎月）：会社の価値に近づきながら、市場の気分で動く */
function ksIpoPriceMonth() {
  const ipo = ksIpo();
  if (ipo.st !== 'listed') return;
  const target = ksValuation().v / ipo.shares;
  ipo.price = Math.max(1, Math.round(ipo.price * Math.exp(0.22 * Math.log(Math.max(1, target) / Math.max(1, ipo.price)) + randn() * 0.06)));
  ipo.hist.push({ m: G.m, p: ipo.price });
  if (ipo.hist.length > 120) ipo.hist.shift();
}
/* 配当（6月の株主総会で決め、前期の利益から払う。資本準備金と利益準備金の合計が資本金の4分の1になるまで、配当の10分の1を利益準備金に積む） */
function ksDividendMonth() {
  const g = G.grow;
  if (calMonth(G.m) !== 6 || !g.payout) return;
  const L = ksLastFY();
  if (!L || L.pl.ni <= 0) { ksNews('前期は赤字のため、配当を見送りました（無配）', 'info'); return; }
  const div = Math.round(Math.min(L.pl.ni * g.payout, Math.max(0, ksB('re') * 0.8)) / 1e4) * 1e4;
  if (div <= 0) return;
  const res = Math.round(Math.min(div / 10, Math.max(0, ksB('capital') / 4 - ksB('capSurplus') - ksB('legalRes'))));
  ksPost('dividend', [['re', div + res, 0], ['cash', 0, div], ['legalRes', 0, res]], { cf: 'equity', u: 'HQ', desc: '剰余金の配当（株主総会の決議）' });
  g.divPaid = (g.divPaid || 0) + div;
  g.divHist = (g.divHist || []).concat([{ fy: L.fy, div, ps: div / g.ipo.shares }]).slice(-12);
  ksNews(`株主総会で配当${fmtYen(div)}（1株${fmtNum(div / g.ipo.shares, 1)}円・配当性向${fmtPct(div / L.pl.ni * 100, 0)}）を決め、支払いました${res ? `。利益準備金に${fmtYen(res)}を積みました` : ''}`, 'info');
}
/* 上場維持基準（決算のあとに確かめる） */
function ksIpoMaintCheck() {
  const ipo = ksIpo();
  if (ipo.st !== 'listed') return;
  const mk = ipo.market;
  const mcap = ksMcap();
  const fm = mcap * ipo.floatR;
  const L = ksLastFY();
  const eq = L ? ksToBankFS(L).EQ : 0;
  const yrs = (G.m - ipo.listM) / 12;
  const fails = [];
  if (eq <= 0) fails.push('純資産が正');
  if (mk === 'growth') {
    if (G.m >= 47 && yrs >= 5 && mcap < 100e8) fails.push('時価総額100億円以上（上場5年後から）');
    else if (G.m < 47 && yrs >= 10 && mcap < 40e8) fails.push('時価総額40億円以上（上場10年後から）');
  }
  if (mk === 'standard' && fm < 10e8) fails.push('流通株式時価総額10億円以上');
  if (mk === 'prime' && fm < 100e8) fails.push('流通株式時価総額100億円以上');
  if (!fails.length) { if (ipo.warn) ksNews('上場維持基準に適合し、改善期間が終わりました', 'good'); ipo.warn = null; return; }
  if (!ipo.warn) {
    ipo.warn = { m: G.m, fails };
    ksNews(`上場維持基準を満たしていません（${fails.join('・')}）。1年の改善期間に入り、適合に向けた計画を開示しました`, 'bad');
    return;
  }
  ipo.st = 'delisted'; ipo.delistM = G.m;
  ksNews(`上場維持基準を満たせず、上場廃止になりました（${fails.join('・')}）`, 'bad');
}
/* 上場会社の信用と知名度（需要の倍率） */
function ksIpoDemandF() { return G.grow && G.grow.ipo.st === 'listed' ? (G.grow.ipo.market === 'tpm' ? 1.005 : 1.02) : 1; }

/* ---------- 会社の歩み（マイルストーン） ---------- */
const KS_MILESTONES = [
  ['s10', '年商10億円', () => ksLastFY() && ksLastFY().pl.sales >= 10e8],
  ['s50', '年商50億円', () => ksLastFY() && ksLastFY().pl.sales >= 50e8],
  ['s100', '年商100億円', () => ksLastFY() && ksLastFY().pl.sales >= 100e8],
  ['s1000', '年商1,000億円', () => ksLastFY() && ksLastFY().pl.sales >= 1000e8],
  ['o1', '経常利益1億円', () => ksLastFY() && ksLastFY().pl.ord >= 1e8],
  ['o10', '経常利益10億円', () => ksLastFY() && ksLastFY().pl.ord >= 10e8],
  ['e50', '従業員50人', () => ksHeadcount() >= 50],
  ['e100', '従業員100人', () => ksHeadcount() >= 100],
  ['e300', '従業員300人', () => ksHeadcount() >= 300],
  ['e1000', '従業員1,000人', () => ksHeadcount() >= 1000],
  ['u2', '2つ目の事業', () => ksUnits().length >= 2 && ksUnits().some(u => u.startM >= (G.startedM ?? 9999))],
  ['u3', '3つの事業を持つ会社', () => ksActiveUnits().length >= 3],
  ['cert', '初めての認証の取得', () => Object.values(G.grow.up).some(x => KS_UPG_BY[x.id] && KS_UPG_BY[x.id].cat === 'cert' && x.eff <= G.m)],
  ['dx', 'DXに取り組む', () => Object.values(G.grow.up).some(x => KS_UPG_BY[x.id] && KS_UPG_BY[x.id].cat === 'dx' && x.eff <= G.m)],
  ['intl', '海外に進出', () => Object.values(G.grow.intl).some(it => Object.keys(it).length)],
  ['intl3', '海外に拠点をつくる', () => Object.values(G.grow.intl).some(it => Object.values(it).some(x => x.st >= 3))],
  ['ma', '初めてのM&A', () => (G.grow.maDone || 0) > 0],
  ['ipo', '株式上場', () => G.grow.ipo.st === 'listed' || G.grow.ipo.listM !== undefined],
  ['prime', 'プライム市場の会社', () => G.grow.ipo.st === 'listed' && G.grow.ipo.market === 'prime'],
  ['g1', '銀行の格付1', () => G.grade === 1],
  ['nodebt', '無借金経営', () => ksDebt() <= 0 && ksB('cash') > 0],
  ['eq50', '自己資本比率50%', () => { const s = ksLastBankFS2(); return s && s.TA > 0 && s.EQ / s.TA >= 0.5; }],
];
function ksLastBankFS2() { const L = ksLastFY(); return L ? ksToBankFS(L) : null; }
function ksMilestoneMonth() {
  const g = G.grow;
  for (const [id, n, f] of KS_MILESTONES) {
    if (g.ms[id] !== undefined) continue;
    let ok = false;
    try { ok = !!f(); } catch (e) { ok = false; }
    if (ok) { g.ms[id] = G.m; ksNews(`【会社の歩み】${n}を達成しました`, 'good'); }
  }
}

/* ---------- 初期化と毎月の処理 ---------- */
function ksGrowInit() {
  if (G.grow) return;
  const shares = Math.max(200, Math.round(ksB('capital') / 5e4));
  G.grow = { up: {}, intl: {}, fxq: [], hedge: 0, fxYTD: 0, ma: { list: [], m: null }, maSeq: 0, maDone: 0, payout: 0, divPaid: 0,
    ipo: { st: 'none', shares, own: uni(0.7, 0.92), vc: 0, prepM: null, prepFY: null, market: null, listM: undefined, price: null, hist: [], fails: 0 }, ms: {} };
  // 就任時にすでに達成している歩みは、昔の出来事として記録する（ニュースにしない）
  for (const [id, , f] of KS_MILESTONES) { let ok = false; try { ok = !!f(); } catch (e) { ok = false; } if (ok) G.grow.ms[id] = -1; }
}
function ksGrowMonth(ctx) {
  const g = G.grow;
  if (!g || G.hist) return;
  // 投資の毎月の費用
  for (const x of Object.values(g.up)) {
    const U = KS_UPG_BY[x.id];
    if (!U || !U.mon) continue;
    const u = x.u ? ksUnit(x.u) : null;
    if (x.u && (!u || u.closedM)) continue;
    const amt = Math.round(U.mon(u));
    if (amt > 0) ksPost('upgMon', [[U.monAcct, amt, 0], ['cash', 0, amt]], { cf: 'exp', u: x.u || 'HQ', key: x.id + (x.u || '') });
  }
  // 海外展開の毎月の費用
  for (const [uid, it] of Object.entries(g.intl)) {
    const u = ksUnit(uid);
    if (!u || u.closedM) continue;
    for (const x of Object.values(it)) {
      const st = KS_INTL_ST[x.st];
      let amt = Math.round(st.mon(u, x.base));
      // 現地の拠点の運営費は外貨（円安なら円での負担が増える）
      if (x.st === 3) amt = Math.round(amt * Math.pow(ksFxRate('usd') / KS_FX0.usd, 0.5));
      const acct = typeof st.monAcct === 'function' ? st.monAcct(u) : st.monAcct;
      if (amt > 0) ksPost('intlMon', [[acct, amt, 0], ['cash', 0, amt]], { cf: acct === 'salary' ? 'payroll' : 'exp', u: uid, key: uid + x.st });
    }
  }
  ksFxMonth();
  ksIpoCostMonth();
  ksIpoReview();
  ksIpoPriceMonth();
  ksDividendMonth();
  ksMilestoneMonth();
  void ctx;
}
/* 決算のあと（ksFinishClosing の後） */
function ksGrowAfterClose() { if (G.grow && !G.hist) ksIpoMaintCheck(); }

/* ---------- 銀行の評価とのつながり ---------- */
/* スタンダード・プライムの上場会社は、開示と監査があるので格付を1段階良くみる */
const ksGrade1 = ksGrade;
ksGrade = function () {
  const r = ksGrade1();
  if (G.grow && G.grow.ipo.st === 'listed' && ['standard', 'prime'].includes(G.grow.ipo.market) && r.g > 1 && r.g < 9) r.g -= 1;
  return r;
};

/* 仕訳帳の解説 */
Object.assign(KS_JNOTE, {
  upg: ['成長のための投資（費用）', '認証の取得・広告・制度づくりなど、資産にならない投資は、払ったときの費用（支払手数料・広告宣伝費など）です。'],
  upgMon: ['投資の毎月の費用', '認証の維持審査・システムの保守・研究開発費・研修費など。'],
  intl: ['海外展開の費用', '展示会・海外の認証・代理店の契約などは支払手数料。'],
  intlMon: ['海外の拠点の運営費', '駐在員の給与・現地の事務所や工場の運営費。外貨で払う分は、為替で円の額が変わります。'],
  fxGain: ['為替差益', '外貨で売った代金が、売ったときより円安のときに入金されると、円で受け取る額が増えます。その差は為替差益（営業外収益）です。'],
  fxLoss: ['為替差損', '外貨で売った代金が、売ったときより円高のときに入金されると、円で受け取る額が減ります。その差は為替差損（営業外費用）です。'],
  maFee: ['M&Aの仲介手数料', '候補の会社を探す仲介会社への着手金。支払手数料です。'],
  maBuy: ['事業の譲受（M&A）', '引き継いだ資産（設備・在庫）を時価で受け入れ、払った代金との差額を「のれん」（無形固定資産）にします。のれんは10年で償却します（のれん償却額・販管費）。'],
  listFee: ['上場の準備・上場の費用', '監査法人の監査報酬、証券会社・コンサルタント、年間上場料、株主総会・IR、管理部門の人件費など。'],
  ipo: ['公募増資（株式上場）', '新しい株を発行して投資家からお金を集めました。払い込まれたお金の半分以上を資本金、残りを資本準備金にします（会社法445条）。借入金と違い返す必要はありません。'],
  po: ['公募増資', '上場会社が新しい株を発行してお金を集めました。資本金と資本準備金が増えます。'],
  vc: ['第三者割当増資', 'ベンチャーキャピタルなど特定の相手に新しい株を発行しました。資本金と資本準備金が増え、社長の持ち株比率は下がります。'],
  ipoFee: ['株式交付費', '株を発行するための証券会社への手数料など。このゲームでは営業外費用にしています。'],
  dividend: ['剰余金の配当', '株主総会の決議で、繰越利益剰余金から株主に配当を払いました。配当は費用ではなく、利益の分配なので損益計算書には出ません。'],
});
