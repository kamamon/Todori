// カタログの業種を1つずつ会社にして、過去4期の自動経営と、その後2年のボット経営を回す
//   node test/sweep_catalog.js [間引き=1] [開始=0] [--eng=mfg] [--name=文字] [--years=2] [--seed=11] [--cond=normal] [--max=80] [--json=結果.json]
// 落ちる・倒産する・利益率が極端・1人あたり売上が極端な業種を一覧にする
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const step = +(process.argv[2] || 1);
const from = +(process.argv[3] || 0);
const arg = k => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const eng = arg('eng'), nameQ = arg('name');
const years = +(arg('years') || 2);
const jsonOut = arg('json');
const seed = +(arg('seed') || 11);
let list = E.KS_TYPE_LIST.filter(S => (!eng || S.eng === eng) && (!nameQ || S.name.includes(nameQ)));
list = list.filter((_, i) => i >= from && (i - from) % step === 0);
const rows = [];
const t0 = Date.now();
for (const S of list) {
  const r = { n: S.name, eng: S.eng };
  try {
    E.ksNewGame({ units: [{ type: S.name, sc: 1 }], coName: 'テスト', ceo: 'テスト', seed, cond: arg('cond') || 'normal' });
    let G = api.G;
    r.retry = 0;
    const h = E.ksLastFY();
    r.hSales = h.pl.sales; r.hOpm = h.pl.opi / Math.max(1, h.pl.sales); r.hGrade = G.grade;
    r.k = G.units[0].calK;
    r.hMin = Math.min(...E.ksFYList().map(fy => G.fys[fy].pl.sales));
    const end = G.m + years * 12;
    let integ = [];
    while (G.m < end && !G.over) {
      for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
      E.ksAutoFinance();
      E.ksAdvance();
      G = api.G;
      G.pendingModals = [];
      if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
      if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
      if (G.closing) E.ksAutoClose();
      const e = E.ksCheck();
      if (e.length && !integ.length) integ = e;
    }
    const L = E.ksLastFY();
    const s = E.ksToBankFS(L);
    r.sales = L.pl.sales; r.opm = L.pl.opi / Math.max(1, L.pl.sales); r.ordm = L.pl.ord / Math.max(1, L.pl.sales);
    r.eqr = s.EQ / Math.max(1, s.TA); r.grade = G.grade; r.over = G.over ? G.over.kind : '';
    r.head = E.ksHeadcount(); r.sph = L.pl.sales / Math.max(1, r.head);
    r.integ = integ.slice(0, 2).join(' / ');
  } catch (e) { r.err = e.message + ' @ ' + (e.stack || '').split('\n')[1]; }
  rows.push(r);
}
const pct = v => (v * 100).toFixed(1) + '%';
const Y = v => E.fmtYen(v);
// 1人あたり売上の上限の目安（事業の型ごと）。卸売は大きく、人の力で稼ぐ型は小さい
const SPH_MAX = { trade: 6e8, mfg: 2.5e8, build: 2.5e8, shop: 1.5e8, rest: 5e7, pro: 6e7, subs: 1.2e8, cap: 1.5e8, trans: 1.2e8 };
const bad = rows.filter(r => r.err || r.over || r.integ || r.opm < -0.05 || r.opm > 0.25 || r.sph > (SPH_MAX[r.eng] || 3e8) || r.sph < 3e6 || r.eqr < 0 || r.hMin <= 0);
console.log(`${rows.length}業種 ${((Date.now() - t0) / 1000).toFixed(0)}秒`);
for (const r of bad.slice(0, +(arg('max') || 80))) console.log(r.err ? `✗ ${r.n}: ${r.err}` : `${r.over ? '倒産 ' : ''}${r.n} [${r.eng}] 売上${Y(r.sales)} 営業利益率${pct(r.opm)}（過去${pct(r.hOpm)}） 経常${pct(r.ordm)} 自己資本${pct(r.eqr)} 格付${r.grade} 人${r.head} 1人${Y(r.sph)}${r.integ ? ' 整合性:' + r.integ : ''}`);
const ok = rows.filter(r => !r.err);
const by = {};
for (const r of ok) { const b = by[r.eng] || (by[r.eng] = []); b.push(r); }
for (const [k, rs] of Object.entries(by)) {
  const med = (f) => { const v = rs.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log(`${k}: ${rs.length}業種 営業利益率の中央値 ${pct(med(r => r.opm))} 倒産 ${rs.filter(r => r.over).length} 赤字 ${rs.filter(r => r.opm < 0).length} 売上の中央値 ${Y(med(r => r.sales))} 1人あたり売上の中央値 ${Y(med(r => r.sph))}`);
}
if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify(rows));
console.log(`エラー ${rows.filter(r => r.err).length}・倒産 ${rows.filter(r => r.over).length}・整合性 ${rows.filter(r => r.integ).length}・問題 ${bad.length}`);
