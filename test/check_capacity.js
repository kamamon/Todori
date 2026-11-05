// 製造（mfg）の業種で、設備の能力が月の注文（base）に足りているかを確かめる
//   node test/check_capacity.js [下限=1.1]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const lo = +(process.argv[2] || 1.1);
let bad = 0, n = 0;
for (const S of E.KS_TYPE_LIST) {
  if (S.eng !== 'mfg') continue;
  const P = S.p;
  let cap = 0;
  for (const e of S.eq) {
    const q = E.KS_EQ[e.k];
    if (!q) continue;
    cap += (q.k === 'line' ? (P.lineCap || 0) * (q.cm || 1) : q.cap || 0) * e.n;
  }
  n++;
  const r = cap / Math.max(1, P.base);
  if (r < lo || r > 4) { bad++; console.log(`${S.name}: 能力${Math.round(cap)} / 注文${P.base} = ${r.toFixed(2)}`); }
}
console.log(`${n}業種のうち ${bad}業種が範囲外（${lo}〜4）`);
