// 業種の探しやすさの検査：
//  1) どの業種も、名前で探すといちばん上に出るか（3つに1つを試す）
//  2) カタカナの名前を、ひらがなで探しても見つかるか
//  3) どの業種にも、説明（d）と補足（売上の立ち方・成功のカギ・主なリスク）があるか
//  4) どの分類（中分類）にも説明があるか
//   node test/check_search.js
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const errs = [];
const L = E.KS_TYPE_LIST;
const t0 = Date.now();
const kata2hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
for (let i = 0; i < L.length; i += 3) {
  const S = L[i];
  const r = E.ksTypeFind(S.name, { limit: 3 });
  if (!r.list.length || r.list[0].name !== S.name) errs.push(`名前で探しても先頭に出ない：${S.name}（先頭は ${r.list[0] ? r.list[0].name : 'なし'}）`);
  if (/[ァ-ヶ]{2,}/.test(S.name)) {
    const w = kata2hira(S.name.match(/[ァ-ヶー]{2,}/)[0]);
    if (!E.ksTypeFind(w, { limit: 2000 }).list.includes(S)) errs.push(`ひらがな「${w}」で見つからない：${S.name}`);
  }
}
for (const S of L) {
  if (!S.d) errs.push(`説明（d）がない：${S.name}`);
  for (const k of ['how', 'kf', 'risk']) if (!S[k]) errs.push(`補足（${k}）がない：${S.name}（${S.grp}）`);
}
const ix = E.ksGrpIndex();
for (const g of Object.values(ix.byKey)) if (!g.d) errs.push(`分類の説明がない：${g.grp}`);
console.log(`業種 ${L.length}・分類 ${Object.keys(ix.byKey).length}・${Date.now() - t0}ミリ秒`);
if (errs.length) { console.log(`問題 ${errs.length}件:\n  ` + errs.slice(0, 40).join('\n  ') + (errs.length > 40 ? '\n  …' : '')); process.exitCode = 1; }
else console.log('OK');
