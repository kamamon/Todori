// 業種カタログ（src/20c_cat_*.js）を検査する
//   node test/check_catalog.js [ファイル名の一部]   例：node test/check_catalog.js mfg_a
// 検査：構文・キー（設備・工事・季節・大分類・型・業界平均・法令）・業種名の重複・項目数・パラメータの範囲
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = path.join(__dirname, '..', 'src');
const only = process.argv[2] || '';
const files = fs.readdirSync(src).filter(f => /^20c_cat_.*\.js$/.test(f) && f.includes(only)).sort();
const allFiles = fs.readdirSync(src).filter(f => /^20c_cat_.*\.js$/.test(f)).sort();
const base = fs.readFileSync(path.join(src, '20a_ks_equip.js'), 'utf8').replace(/^(const|let) /gm, 'var ');
const ENG = ['shop', 'rest', 'mfg', 'build', 'trade', 'pro', 'subs', 'cap', 'trans'];
const BM = ['mfg', 'con', 'whl', 'ret', 'food', 'trn', 're', 'it', 'med', 'htl', 'agr'];
const LAWS = ['machine', 'fall', 'chem', 'haccp', 'alcohol', 'kyoka', 'privacy', 'kiken', 'rad', 'export'];
const P_KEYS = {
  shop: ['stores', 'cust', 'spend', 'gm', 'inv', 'card', 'ins', 'rent', 'fit', 'eqc', 'dep', 'staff', 'wage', 'days', 'util', 'waste', 'svc', 'eqn', 'rn'],
  rest: ['shops', 'cust', 'spend', 'fq', 'rent', 'fit', 'eqc', 'dep', 'staff', 'wage', 'days', 'card', 'eqn', 'rn'],
  mfg: ['mode', 'unit', 'price', 'mat', 'base', 'lineCap', 'lineCost', 'lineLab', 'energy', 'terms', 'matDays', 'fgDays', 'office', 'wage', 'bldg', 'land', 'rn'],
  build: ['proj', 'inq', 'margin', 'site', 'office', 'wage', 'rent', 'rn'],
  trade: ['gm', 'inv', 'custN', 'custSize', 'kinds', 'terms2', 'trucks', 'fx', 'risk', 'staff', 'wage', 'rent', 'wh', 'rn'],
  pro: ['rate', 'wage', 'n', 'sales', 'exp', 'sub', 'product', 'rent', 'terms', 'eqn', 'rn'],
  subs: ['users', 'arpu', 'ad', 'gmv', 'take', 'churn', 'cac', 'cpu', 'fixed', 'capPer', 'dev', 'devWage', 'ops', 'trend', 'b2b', 'rn'],
  cap: ['unit', 'units', 'per', 'price', 'occ', 'var', 'anc', 'spu', 'wage', 'ar', 'terms', 'kwh', 'elastic', 'rn', 'fuel', 'levy', 'om', 'capPay', 'nuke'],
  trans: ['mode', 'lf', 'util', 'ops', 'fees', 'infra', 'infraAssets', 'ar', 'terms', 'crewWage', 'opsWage', 'market', 'rn'],
};
// どの事業の型にも書ける：accF（労災の起きやすさの倍率）、accSet（労災の文の組。'plant' は発電所・タンク基地など）
const P_COMMON = ['accF', 'accSet'];
// how（売上の立ち方）・kf（成功のカギ）・risk（主なリスク）・kw（探すときの言葉）は、選ぶ画面の「くわしく」の補足
const ITEM_KEYS = ['d', 'prod', 'cust', 'p', 'eq', 'aux', 'laws', 'lic', 'season', 'icon', 'scale', 'bm', 'how', 'kf', 'risk', 'kw'];
const GROUP_KEYS = ['sec', 'grp', 'eng', 'bm', 'icon', 'season', 'd', 'prod', 'cust', 'p', 'eq', 'aux', 'laws', 'lic', 'items', 'scale', 'how', 'kf', 'risk', 'kw'];

function load(fileList) {
  const ctx = { console, Math, JSON, Object, Array, Number, String, Set, Map };
  vm.createContext(ctx);
  vm.runInContext(base + '\n;globalThis.__eq = { KS_EQ, KS_PROJ_LIB, KS_SEASONS, KS_SECTORS, KS_CAT };', ctx, { filename: '20a_ks_equip.js' });
  const per = {};
  for (const f of fileList) {
    const before = ctx.__eq.KS_CAT.length;
    const code = fs.readFileSync(path.join(src, f), 'utf8').replace(/^(const|let) /gm, 'var ');
    try { vm.runInContext(code, ctx, { filename: f }); } catch (e) { console.log(`✗ ${f}: 構文・実行エラー ${e.message}`); process.exitCode = 1; continue; }
    per[f] = ctx.__eq.KS_CAT.slice(before);
  }
  return { E: ctx.__eq, per };
}
const { E, per } = load(allFiles);
const errs = [];
const warn = [];
const names = new Map();
let total = 0;
const bySec = {}, byEng = {};
function eqCheck(where, list, eng, kindNeeded) {
  if (!list) return;
  if (!Array.isArray(list)) { errs.push(`${where}: eq/aux は配列で`); return; }
  for (const s of list) {
    const [k, n] = String(s).split(':');
    const q = E.KS_EQ[k];
    if (!q) { errs.push(`${where}: 設備のキー「${k}」がない`); continue; }
    if (!(+n > 0)) errs.push(`${where}: 設備「${s}」の台数`);
    if (eng && q.e !== eng) errs.push(`${where}: 設備「${k}」は ${q.e} 用（この業種は ${eng}）`);
    if (kindNeeded && q.k && !kindNeeded.includes(q.k)) errs.push(`${where}: 設備「${k}」の種類 ${q.k} は ${kindNeeded.join('/')} の欄に書けない`);
  }
}
for (const f of allFiles) {
  const groups = per[f] || [];
  let n = 0;
  for (const g of groups) {
    const gw = `${f}「${g.grp}」`;
    for (const k of Object.keys(g)) if (!GROUP_KEYS.includes(k)) errs.push(`${gw}: 不明なキー ${k}`);
    if (!E.KS_SECTORS[g.sec]) errs.push(`${gw}: sec「${g.sec}」がない`);
    if (!ENG.includes(g.eng)) errs.push(`${gw}: eng「${g.eng}」がない`);
    if (!BM.includes(g.bm)) errs.push(`${gw}: bm「${g.bm}」がない`);
    if (g.season && !E.KS_SEASONS[g.season]) errs.push(`${gw}: season「${g.season}」がない`);
    if (!Array.isArray(g.items) || !g.items.length) { errs.push(`${gw}: items がない`); continue; }
    for (const it of g.items) {
      const nm = typeof it === 'string' ? it : it[0];
      const ov = typeof it === 'string' ? {} : (it[1] || {});
      const w = `${f}「${nm}」`;
      if (!nm || typeof nm !== 'string') { errs.push(`${gw}: 名前のない項目`); continue; }
      if (names.has(nm)) errs.push(`${w}: 業種名が重複（${names.get(nm)}）`); else names.set(nm, f);
      for (const k of Object.keys(ov)) if (!ITEM_KEYS.includes(k)) errs.push(`${w}: 上書きできないキー ${k}`);
      const p = Object.assign({}, g.p || {}, ov.p || {});
      for (const k of Object.keys(p)) if (!(P_KEYS[g.eng] || []).includes(k) && !P_COMMON.includes(k)) errs.push(`${w}: ${g.eng} に p.${k} はない`);
      if (p.accSet && !['plant'].includes(p.accSet)) errs.push(`${w}: p.accSet「${p.accSet}」がない`);
      if (p.accF !== undefined && !(p.accF > 0 && p.accF <= 3)) errs.push(`${w}: p.accF は 0〜3`);
      const eq = ov.eq || g.eq;
      const aux = ov.aux || g.aux;
      const season = ov.season || g.season;
      if (season && !E.KS_SEASONS[season]) errs.push(`${w}: season「${season}」がない`);
      const laws = ov.laws || g.laws || [];
      for (const l of laws) if (!LAWS.includes(l)) errs.push(`${w}: laws「${l}」がない`);
      if (ov.bm && !BM.includes(ov.bm)) errs.push(`${w}: bm「${ov.bm}」がない`);
      if (g.eng === 'mfg') {
        const mode = p.mode || 'job';
        eqCheck(w, eq, 'mfg', mode === 'job' ? ['job'] : ['line']);
        eqCheck(w, aux, 'mfg', ['aux']);
        if (mode === 'line') {
          for (const k of ['unit', 'price', 'mat', 'base', 'lineCap', 'lineCost']) if (p[k] === undefined) errs.push(`${w}: line には p.${k} が要る`);
          const nl = (eq || []).reduce((s, x) => s + (+String(x).split(':')[1] || 0), 0);
          if (p.lineCap && p.base && nl && (p.lineCap * nl < p.base * 1.0 || p.lineCap * nl > p.base * 2.5)) warn.push(`${w}: 能力 ${p.lineCap * nl} と注文 ${p.base} の釣り合い`);
          if (p.mat && p.price && p.mat >= p.price) errs.push(`${w}: 材料費が価格以上`);
        } else {
          const cap = (eq || []).reduce((s, x) => { const [k, c] = String(x).split(':'); return s + ((E.KS_EQ[k] || {}).cap || 0) * (+c || 0); }, 0);
          const base = p.base || 2150;
          if (eq && (cap < base * 0.95 || cap > base * 2.2)) warn.push(`${w}: 機械の能力 ${cap}時間 と注文 ${base}時間 の釣り合い`);
        }
      } else if (g.eng === 'build') {
        eqCheck(w, eq, 'build');
        for (const s of p.proj || []) { const k = String(s).split(':')[0]; if (!E.KS_PROJ_LIB[k]) errs.push(`${w}: 工事の型「${k}」がない`); }
      } else if (g.eng === 'trans') {
        eqCheck(w, eq, 'trans');
        if (!eq || !eq.length) errs.push(`${w}: trans には車両（eq）が要る`);
      } else if (g.eng === 'cap') {
        eqCheck(w, eq, 'cap');
        if (!eq || !eq.length) errs.push(`${w}: cap には施設（eq）が要る`);
      } else if (g.eng === 'subs') {
        eqCheck(w, eq, 'subs');
      } else if (eq) {
        warn.push(`${w}: ${g.eng} の eq は使われない（eqn に名前を書く）`);
      }
      n++;
      total++;
      bySec[g.sec] = (bySec[g.sec] || 0) + 1;
      byEng[g.eng] = (byEng[g.eng] || 0) + 1;
    }
  }
  if (!only || f.includes(only)) console.log(`${f}: ${groups.length}グループ・${n}業種`);
}
const show = arr => arr.filter(x => !only || x.includes(only));
const se = show(errs), sw = show(warn);
if (sw.length) console.log(`注意 ${sw.length}件:\n  ` + sw.slice(0, 40).join('\n  ') + (sw.length > 40 ? '\n  …' : ''));
if (se.length) { console.log(`エラー ${se.length}件:\n  ` + se.slice(0, 80).join('\n  ') + (se.length > 80 ? '\n  …' : '')); process.exitCode = 1; }
console.log(`合計 ${total}業種`, JSON.stringify(bySec), JSON.stringify(byEng));
if (!se.length) console.log('OK');
