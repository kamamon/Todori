'use strict';
/* =========================================================
 *  20d_ks_types.js : 業種カタログの解決
 *   20b・20c のカタログ（グループ＋項目）を、業種名 → 仕様（spec）の表 KS_TYPES にする。
 *   仕様 = 事業の型の既定値 ＋ グループの設定 ＋ 項目の上書き。職種・季節・ラベルもここで決める。
 * ========================================================= */

/* 事業の型ごとのパラメータの既定値 */
const KS_ENG_DEF = {
  shop: { stores: 2, cust: 300, spend: 2000, gm: 0.3, inv: 30, card: 0.5, ins: 0, rent: 50e4, fit: 2000e4, eqc: 500e4, dep: 300e4, staff: [3, 6], wage: [27e4, 10e4], days: 30, util: 20e4, waste: 0.003, svc: false, eqn: ['店の設備', 'レジ・POSシステム'], rn: ['正社員（店長・売場）', 'パート・アルバイト'] },
  rest: { shops: 2, cust: 130, spend: 1900, fq: 0.31, rent: 85e4, fit: 2500e4, eqc: 900e4, dep: 600e4, staff: [3, 8], wage: [27e4, 8.5e4], days: 26, card: 0.45, eqn: ['厨房機器'], rn: ['正社員（店長・調理）', 'アルバイト（ホール・調理補助）'] },
  mfg: { mode: 'job', unit: '時間', price: 6000, mat: 3200, base: 2150, lineCap: 0, lineCost: 2e8, lineLab: 8, energy: 300, terms: 2, matDays: 20, fgDays: 10, office: 4, wage: 30e4, bldg: 1.2e8, land: 6000e4, rn: ['製造スタッフ', '営業・事務'] },
  build: { proj: ['house:36', 'reform:50', 'shop:11', 'public:3'], inq: 5, margin: 0.22, site: 4, office: 3, wage: [36e4, 28e4], rent: 25e4, rn: ['現場監督', '営業・設計・事務'] },
  trade: { gm: 0.125, inv: 18, custN: 31, custSize: 290e4, kinds: ['スーパー', '飲食店', '給食センター', 'ホテル', '弁当店', 'コンビニ加盟店', '病院'], terms2: 0.4, trucks: 6, fx: 0, risk: 'std', staff: [4, 7, 2], wage: [32e4, 26e4, 25e4], rent: 80e4, wh: '常温', rn: ['営業', '倉庫・配送', '事務'] },
  pro: { rate: 80e4, wage: 38e4, n: 20, sales: 3, exp: 2e4, sub: true, product: false, rent: 100e4, terms: 1, eqn: ['パソコン'], rn: ['エンジニア', '営業・管理'] },
  subs: { users: 20000, arpu: 1500, ad: 0, gmv: 0, take: 0, churn: 0.02, cac: 5000, cpu: 300, fixed: 1000e4, capPer: 5000, dev: 10, devWage: 45e4, ops: 5, trend: 0.03, b2b: false, rn: ['開発・制作', '運用・営業'] },
  cap: { unit: '室', units: 100, per: 'day', price: 12000, occ: 0.75, var: null, anc: 0, spu: 0.3, wage: 27e4, ar: 0.5, terms: 1, kwh: 0, elastic: 1.2, rn: ['スタッフ', '営業・管理'] },
  trans: { mode: 'truck', lf: 0.7, util: 0.85, ops: 0.5, fees: 0, infra: 0, infraAssets: 0, ar: 0.9, terms: 1, crewWage: 32e4, opsWage: 28e4, market: 0.05, rn: ['乗務員', '運行管理・整備'] },
};
/* 事業の型ごとの、業界平均の利益率の目安（開始時のキャリブレーション用。銀行の業界平均より少し低め） */
const KS_ENG_OPM = { shop: 0.025, rest: 0.035, mfg: 0.045, build: 0.04, trade: 0.02, pro: 0.07, subs: 0.08, cap: 0.08, trans: 0.04 };

const KS_TYPES = {};
const KS_TYPE_LIST = [];
function ksSeasonArr(key) {
  const s = KS_SEASONS[key] || KS_SEASONS.flat;
  const avg = s.reduce((a, b) => a + b, 0) / 12;
  return s.map(v => v / avg);
}
function ksParseEq(s) {
  const [k, n, name] = String(s).split(':');
  return { k, n: Math.max(0, +n || 1), name: name || null };
}
/* 職種（給与の計算・人員の画面で使う） */
function ksRolesFor(eng, P) {
  const rn = P.rn || [];
  const R = (id, n, wage, cost, o = {}) => Object.assign({ id, n, wage, wf: 0.15, bonus: 2, cost, desc: '' }, o);
  switch (eng) {
    case 'shop': return [R('regular', rn[0] || '正社員', P.wage[0], 'salary', { desc: `売場や店を回す中心。1店あたり${P.staff[0]}人が目安。` }), R('part', rn[1] || 'パート・アルバイト', P.wage[1], 'salary', { wf: 0.06, bonus: 0, desc: `1店あたり${P.staff[1]}人が目安（客数に合わせてシフトで増減）。` })];
    case 'rest': return [R('cook', rn[0] || '正社員', P.wage[0], 'salary', { desc: `1店あたり${P.staff[0]}人が目安。料理の質を支える。` }), R('part', rn[1] || 'アルバイト', P.wage[1], 'salary', { wf: 0.05, bonus: 0, desc: `1店あたり${P.staff[1]}人が目安（客数に合わせて増減）。足りないと回転が落ちる。` })];
    case 'mfg': return [R('worker', rn[0] || '製造スタッフ', P.wage, 'labor', { desc: P.mode === 'line' ? '生産ラインを動かす。給与は労務費（製造原価）。' : '1人あたり月150時間の加工ができる。給与は労務費（製造原価）。' }), R('office', rn[1] || '営業・事務', 29e4, 'salary', { desc: '受注と経理。営業を増やすと注文が少しずつ増える。給与は給料手当（販管費）。' })];
    case 'build': return [R('site', rn[0] || '現場監督', P.wage[0], 'labor', { desc: '1人で同時に3件ほどの工事を見られる。給与は労務費（工事原価）。' }), R('office', rn[1] || '営業・設計・事務', P.wage[1], 'salary', { desc: '見積・設計・経理。給与は給料手当（販管費）。' })];
    case 'trade': return [R('sales', rn[0] || '営業', P.wage[0], 'salary', { desc: '新しい取引先を開拓する。' }), R('logi', rn[1] || '倉庫・配送', P.wage[1], 'salary', { bonus: 1.5, desc: 'トラック1台につき1.1人が目安。足りないと配送が回らない。' }), R('office', rn[2] || '事務', P.wage[2], 'salary', { desc: '受発注と経理。' })];
    case 'pro': return [R('eng', rn[0] || 'エンジニア', P.wage, 'labor', { desc: '1人で月1人月の仕事ができる。給与は労務費（売上原価）。' }), R('sales', rn[1] || '営業・管理', 33e4, 'salary', { desc: '案件を取ってくる。給与は給料手当（販管費）。' })];
    case 'subs': return [R('dev', rn[0] || '開発・制作', P.devWage, 'labor', { desc: 'サービス・コンテンツを作り、良くする。給与は労務費（売上原価）。' }), R('ops', rn[1] || '運用・営業', 30e4, 'salary', { desc: '利用者の獲得と問い合わせ・運用。' })];
    case 'cap': return [R('staff', rn[0] || 'スタッフ', P.wage, 'labor', { desc: `施設を動かす人。能力1${P.unit}あたり${P.spu}人が目安。給与は労務費（売上原価）。` }), R('office', rn[1] || '営業・管理', 30e4, 'salary', { desc: P.per === 'mwh' ? '電気の販売の契約・経理・総務。' : '営業・予約・経理。' })];
    case 'trans': return [R('crew', rn[0] || '乗務員', P.crewWage, 'labor', { desc: '車両・機体・船を動かす。足りないと運休が出る。給与は労務費（運送原価）。' }), R('ops', rn[1] || '運行管理・整備', P.opsWage, 'labor', { desc: '運行の管理・整備・地上の仕事。' }), R('office', '営業・管理', 30e4, 'salary', { desc: '営業と経理。' })];
    default: return [];
  }
}
function ksResolveCatalog() {
  for (const g of KS_CAT) {
    for (const it of g.items) {
      const name = typeof it === 'string' ? it : it[0];
      const ov = typeof it === 'string' ? {} : (it[1] || {});
      if (KS_TYPES[name]) continue;
      const p = Object.assign({}, KS_ENG_DEF[g.eng], g.p || {}, ov.p || {});
      for (const k of ['staff', 'wage']) if (Array.isArray(KS_ENG_DEF[g.eng][k]) && Array.isArray(p[k])) p[k] = KS_ENG_DEF[g.eng][k].map((v, i) => (p[k][i] ?? v));
      if (g.eng === 'cap' && p.var === null) p.var = p.price * (p.per === 'day' ? 30.4 : 1) * 0.15;
      const S = {
        name, eng: g.eng, sec: g.sec, grp: g.grp, bm: ov.bm || g.bm, icon: ov.icon || g.icon || (KS_SECTORS[g.sec] || {}).icon || '業',
        d: ov.d || g.d || '', prod: ov.prod || g.prod || [], cust: ov.cust || g.cust || [],
        p, eq: (ov.eq || g.eq || []).map(ksParseEq), aux: (ov.aux || g.aux || []).map(ksParseEq),
        laws: ov.laws || g.laws || [], lic: ov.lic || g.lic || null, seasonKey: ov.season || g.season || 'flat', scale: ov.scale || g.scale || 1,
        calib: g.calib !== false && ov.calib !== false, legacy: ov.legacy || g.legacy || null,
        // 業種の補足（選ぶ画面の「くわしく」）：売上の立ち方・成功のカギ・主なリスク・探すときの言葉
        how: ov.how || g.how || '', kf: ov.kf || g.kf || '', risk: ov.risk || g.risk || '', kw: ov.kw || g.kw || [], gd: g.d || '',
      };
      S.season = ksSeasonArr(S.seasonKey);
      S.roles = ksRolesFor(g.eng, p);
      S.key = (name + ' ' + g.grp + ' ' + (S.prod || []).join(' ') + ' ' + (S.cust || []).join(' ') + ' ' + KS_SECTORS[g.sec].n + ' ' + (S.kw || []).join(' ')).toLowerCase();
      KS_TYPES[name] = S;
      KS_TYPE_LIST.push(S);
    }
  }
}
/* 事業 u の仕様 */
function ksS(u) {
  const S = KS_TYPES[u.type];
  if (!S) throw new Error('業種がカタログにありません: ' + u.type);
  return S;
}
function ksP(u) { return ksS(u).p; }
function ksEngOf(u) { return KS_ENGINE[ksS(u).eng]; }
/* 探す言葉をそろえる：全角の英数字を半角に、大文字を小文字に、カタカナをひらがなに（「リニア」「りにあ」「ＥＶ」「ev」が同じになる） */
function ksNorm(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
/* 探すときの索引（初めて探すときに作る） */
function ksTypeIdx(S) {
  if (S._ix) return S._ix;
  return (S._ix = {
    name: ksNorm(S.name), kw: ksNorm((S.kw || []).join(' ')), grp: ksNorm(S.grp), pc: ksNorm((S.prod || []).join(' ') + ' ' + (S.cust || []).join(' ')),
    sec: ksNorm((KS_SECTORS[S.sec] || {}).n), d: ksNorm(S.d + ' ' + (S.how || '') + ' ' + (S.gd || '')),
  });
}
/* 業種を探す：言葉がすべて、名前・探す言葉・中分類・商品とお客さま・大分類・説明のどこかに入っている業種を、
   名前に入っているものから順に並べる。o: { sec, eng, limit, skip（除く業種名の Set） } → { total, list } */
function ksTypeFind(q, o = {}) {
  const words = ksNorm(q).split(/[\s、,，・/／]+/).filter(Boolean);
  const hit = [];
  for (const S of KS_TYPE_LIST) {
    if (o.sec && S.sec !== o.sec) continue;
    if (o.eng && S.eng !== o.eng) continue;
    if (o.skip && o.skip.has(S.name)) continue;
    if (!words.length) { hit.push([0, hit.length, S]); continue; }
    const I = ksTypeIdx(S);
    let sc = 0;
    for (const w of words) {
      const s = I.name === w ? 100 : I.name.startsWith(w) ? 70 : I.name.includes(w) ? 50 : I.kw.includes(w) ? 35 : I.grp.includes(w) ? 25 : I.pc.includes(w) ? 18 : I.sec.includes(w) ? 10 : I.d.includes(w) ? 6 : 0;
      if (!s) { sc = -1; break; }
      sc += s;
    }
    if (sc > 0) hit.push([sc - I.name.length * 0.05, hit.length, S]);
  }
  if (words.length) hit.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const lim = o.limit || 80;
  return { total: hit.length, list: hit.slice(0, lim).map(x => x[2]) };
}
/* 業種を探す（前からある呼び方。言葉があれば当てはまる順、なければカタログの順） */
function ksSearchTypes(q, sec, eng, limit = 80) { return ksTypeFind(q, { sec, eng, limit }).list; }
function ksCountTypes(sec, eng) { return KS_TYPE_LIST.filter(S => (!sec || S.sec === sec) && (!eng || S.eng === eng)).length; }
/* 中分類の索引：大分類ごとに、中分類（グループ）を並べる。{ bySec: { E: [{ sec, grp, icon, d, types: [S…], eng: { mfg: 数 } }] }, byKey: { 'E|…': 同じもの } } */
let KS_GRP_IX = null;
function ksGrpIndex() {
  if (KS_GRP_IX && KS_GRP_IX.n === KS_TYPE_LIST.length) return KS_GRP_IX;
  const ix = { n: KS_TYPE_LIST.length, bySec: {}, byKey: {} };
  for (const S of KS_TYPE_LIST) {
    const key = S.sec + '|' + S.grp;
    let g = ix.byKey[key];
    if (!g) { g = ix.byKey[key] = { sec: S.sec, grp: S.grp, icon: S.icon, d: S.gd || '', how: S.how, types: [], eng: {} }; (ix.bySec[S.sec] = ix.bySec[S.sec] || []).push(g); }
    if (!g.d && S.gd) g.d = S.gd;
    g.types.push(S);
    g.eng[S.eng] = (g.eng[S.eng] || 0) + 1;
  }
  return (KS_GRP_IX = ix);
}
ksResolveCatalog();
