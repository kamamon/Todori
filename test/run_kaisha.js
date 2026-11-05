// 会社経営モードをボットで回し、帳簿の整合性と決算書の妥当性を確かめる
//   node test/run_kaisha.js <業種> <年数> <シード> [-v]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const ind = process.argv[2] || 'ret';
const years = +(process.argv[3] || 5);
const seed = +(process.argv[4] || 1);
const verbose = process.argv.includes('-v');
const cond = (process.argv.find(a => a.startsWith('--cond=')) || '--cond=normal').slice(7);
const Y = x => E.fmtYen(x);
const t0 = Date.now();
E.ksNewGame({ ind, coName: 'テスト株式会社', ceo: 'テスト', seed, cond });
let G = api.G;
let errs = E.ksCheck();
if (errs.length) console.log('INIT', errs);
const line = st => {
  const p = st.pl, b = st.bs;
  const s = E.ksToBankFS(st);
  const ta = s.TA;
  return `${E.ksFyLabel(st.fy)} 売上${Y(p.sales).padStart(8)} 粗利率${E.fmtPct(p.gp / p.sales * 100, 1)} 営業利益${Y(p.opi).padStart(8)}(${E.fmtPct(p.opi / p.sales * 100, 1)}) 経常${Y(p.ord).padStart(8)} 純利益${Y(p.ni).padStart(8)} 現預金${Y(b.cash).padStart(8)} 借入${Y(b.std + b.ltd).padStart(8)} 自己資本比率${E.fmtPct(s.EQ / ta * 100, 1)} 格付${st.grade}`;
};
for (const fy of E.ksFYList()) console.log('[過去]', line(G.fys[fy]));
let integ = 0;
const end = G.m + years * 12;
while (G.m < end && !G.over) {
  E.KS_ENGINE[G.ind].auto();
  E.ksAdvance();
  G = api.G;
  const e = E.ksCheck();
  if (e.length) { integ++; if (integ < 4) console.log('INTEGRITY', G.m, e); }
  if (G.closing) {
    E.ksAutoClose();
    const fy = E.ksFYList().slice(-1)[0];
    console.log(line(G.fys[fy]));
    if (verbose) { const k = G.months.slice(-1)[0].kpi; console.log('   kpi', JSON.stringify(k, (kk, v) => typeof v === 'number' ? +v.toFixed(3) : v)); }
  }
}
if (G.over) console.log('GAME OVER', G.over.kind, E.ymLabel(G.over.m));
console.log(`終了 ${E.ymLabel(G.m)} 整合性エラー${integ}件 ${((Date.now() - t0) / 1000).toFixed(1)}秒 save ${(JSON.stringify(G).length / 1024).toFixed(0)}KB`);
