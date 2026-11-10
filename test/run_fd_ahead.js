// 創業記：技術が世界の先端よりはるか先を行くとき、出来上がる製品もその技術に合っているか
//   node test/run_fd_ahead.js
//   ・カスタムスタート（技術を何十年も先に）で始めた製品の品質・名前・仕様
//   ・開発した新製品の品質が、技術の水準のまま（先端＋3年などで頭打ちにならない）
//   ・世界にまだない製品（1930年のコンピューターなど）を、技術が届けば作って売れる（ライバルのいない市場）
//   ・途中編集で技術を上げたとき、売っている製品も作り直せる
//   ・とてつもなく先の技術（100万年先）でも数があふれない。番頭に任せて数年進めても帳簿が合う
const { loadFd } = require('./load_fd');
const E = loadFd();
const api = E.__api;
let bad = 0;
const fmt = x => (isFinite(x) ? Math.round(x).toLocaleString('ja-JP') : String(x));
const ok = (c, m) => { if (!c) { bad++; console.log('  NG', m); } };
const finite = (G, tag) => {
  const errs = E.fdCheck();
  for (const p of G.prods) if (!isFinite(p.qy) || !isFinite(p.want || 0) || !isFinite(p.pr) || !isFinite(p.stock)) errs.push(`製品の数がおかしい ${p.name}`);
  for (const k of ['cash', 'inv', 'ppe', 'cap']) if (!isFinite(G.bs[k])) errs.push(`帳簿 ${k}`);
  ok(!errs.length, `${tag}: ${errs.slice(0, 3).join(' / ')}`);
};
function resolve(m) {
  if (m.type === 'fdEvent') { const Ev = E.fdEventById(m.id); if (Ev && Ev.ch) { let i = 0; if (Ev.ch[i].can && !Ev.ch[i].can()) i = Ev.ch.findIndex(c => !c.can || c.can()); if (i >= 0) E.fdChoose(m.id, i); } }
  else if (m.type === 'fdSucc') E.fdPickSucc(0);
  else if (m.type === 'fdRescue') E.fdRescueAccept();
}
function stepQ(n, bot) {
  for (let i = 0; i < n && !api.G.over; i++) {
    if (bot) E.fdAuto({ lvl: 1 });
    E.fdAdvanceQ();
    for (let k = 0; k < 2; k++) { const ms = api.G.pendingModals.slice(); api.G.pendingModals = []; for (const m of ms) resolve(m); }
    finite(api.G, `${E.fdQLabel()}`);
  }
}
function start(scen, y, gap) {
  const R = E.fdCuResolve(scen, { y, gap, story: false });
  E.fdNewGame({ scen, seed: 3, cu: R });
  return api.G;
}

// 1) カスタムスタート：1930年、すべての技術が50年先
{
  const G = start('denki', 1930, -50);
  const y = E.fdYf();
  console.log(`■ 電機 1930年・技術50年先：初めの製品`);
  for (const p of E.fdActiveProds()) {
    console.log(`  ${E.fdCat(p.cat).n}：${p.name}（${Math.floor(p.qy)}年の水準）${p.spec}`);
    ok(p.qy > y + 30, `${p.cat} の品質が技術に合っていない（${p.qy}）`);
    ok(p.auto, `${p.cat} の名前が自動の印を持たない`);
  }
  const motor = E.fdActiveProds('motor')[0];
  if (motor) ok(!/三相誘導電動機/.test(motor.name), `1980年の技術のモーターが戦前の型の名前（${motor.name}）`);
  finite(G, '1930 開始');
  // 新しい型を開発：先端＋3年で頭打ちにならない
  const c = motor ? 'motor' : E.fdActiveProds()[0].cat;
  const old = E.fdActiveProds(c)[0];
  const r = E.fdStartDev(c, { rep: old.id });
  ok(r.ok, `開発を始められない ${r.why}`);
  for (let i = 0; i < 12 && E.fdActiveProds(c)[0] === old; i++) stepQ(1, false);
  const np = E.fdActiveProds(c)[0];
  ok(np !== old, '新しい型が発売されない');
  const y2 = E.fdYf();
  console.log(`  新製品：${np.name}（品質 ${Math.floor(np.qy)}年の水準・技術 ${Math.floor(E.fdCatTech(c, y2))}年）${np.spec}`);
  ok(np.qy > y2 + 30, `新製品の品質が頭打ち（${np.qy.toFixed(1)}、いま${y2}）`);
  ok(Math.abs(np.qy - E.fdLaunchQy(c, y2)) < 1.5, `新製品の品質が技術の水準と違う（${np.qy.toFixed(1)} と ${E.fdLaunchQy(c, y2).toFixed(1)}）`);

  // 2) 世界にまだない製品：1930年代にコンピューター（電子回路の技術を2025年の水準に）。
  //    生まれたころの市場は米欧にしかない（史実のとおり）ので、米欧に販路を作って売る
  E.fdEditTech({ elec: y2 - 2025, mech: y2 - 2025 }, { prods: true });
  const rd = E.fdCatReady('comp');
  ok(rd.ok, `コンピューターに手を出せない：${rd.why}`);
  ok(E.fdCatOpen('comp'), 'コンピューターの分野が開かない');
  const add = E.fdEditAddProd('comp', 50);
  ok(add.ok, `コンピューターを出せない：${add.why}`);
  E.fdEditRegs({ na: { st: 2, brand: 40 }, eu: { st: 2, brand: 40 } });
  stepQ(4, false);
  const cp = E.fdActiveProds('comp')[0];
  ok(!!cp, 'コンピューターの製品がない');
  if (cp) {
    const M = E.fdMarket('comp', 'na');
    const world = E.fdWorldDem('comp');
    console.log(`  ${E.fdYf().toFixed(2)}年 コンピューター：${cp.name}・${cp.spec}・この四半期に${(cp.sold || 0).toFixed(2)}台（${(cp.rev / 1e8).toFixed(1)}億円）・世界の需要 ${world.toFixed(1)}台/年・米国の相手 ${M.items.map(it => `${it.n} ${(it.share * 100).toFixed(0)}%`).join('、')}`);
    ok(E.fdEarly('comp'), '1930年代はまだ世界にない製品のはず');
    ok(M.items.every(it => it.me || it.fringe), 'ライバルが出てきた');
    ok(cp.sold > 0, 'コンピューターが売れていない');
    ok(world > 0 && world < E.fdSer(E.fdCat('comp').dem, 1951, true), `世に出る前の市場の大きさがおかしい（${world}）`);
    ok(/サーバー|量子/.test(cp.name), `2025年の技術のコンピューターの名前が古い（${cp.name}）`);
  }
  // 3) 途中編集で技術を100年先に。売っている製品も作り直す
  const before = E.fdActiveProds().map(p => `${p.name}`);
  const gaps = {}; for (const f of Object.keys(api.G.tech)) if (E.fdFrontier(f) !== null) gaps[f] = -100;
  E.fdEditTech(gaps, { prods: true });
  const yy = E.fdYf();
  for (const p of E.fdActiveProds()) {
    ok(Math.abs(p.qy - E.fdLaunchQy(p.cat, yy)) < 0.1, `作り直した製品の品質が技術に合わない ${p.cat}`);
  }
  console.log(`  技術を100年先に：${before.join('、')} → ${E.fdActiveProds().map(p => p.name).join('、')}`);
  finite(api.G, '編集のあと');
  stepQ(8, true);
}

// 3b) 1915年、ラジオ（1921年に世に出る）を、国内で世界に先がけて売る
{
  const G = start('denki', 1915, -25);
  const add = E.fdEditAddProd('tv', 2000);
  ok(add.ok, `ラジオ・テレビを出せない：${add.why}`);
  stepQ(6, false);
  const p = E.fdActiveProds('tv')[0];
  if (p) {
    const M = E.fdMarket('tv', 'jp');
    console.log(`■ 電機 1915年・技術25年先：${p.name}・${p.spec}・この四半期に${fmt(p.sold)}台・国内の需要 ${fmt(M.D * 4)}台/年・${M.items.map(it => `${it.n} ${(it.share * 100).toFixed(0)}%`).join('、')}`);
    ok(p.sold > 0, 'ラジオが売れていない');
    ok(/ラジオ|テレビ/.test(p.name), `名前がおかしい（${p.name}）`);
  }
  // 1921年を越えると、ふつうの市場に（ライバルが出てくる）。需要が途切れない
  const d0 = E.fdWorldDem('tv');
  stepQ(26, true);
  const d1 = E.fdWorldDem('tv');
  ok(!E.fdEarly('tv') && d1 >= d0, `世に出る年を越えたあとの需要がおかしい（${d0} → ${d1}）`);
  const M2 = E.fdMarket('tv', 'jp');
  console.log(`  ${E.fdYf().toFixed(2)}年：世界の需要 ${fmt(d1)}台/年・国内の相手 ${M2.items.slice(0, 5).map(it => `${it.n} ${(it.share * 100).toFixed(0)}%`).join('、')}`);
}

// 4) 自動車：1925年、技術80年先で始め、番頭に任せて進める
{
  const G = start('jidosha', 1925, -80);
  console.log(`■ 自動車 1925年・技術80年先`);
  for (const p of E.fdActiveProds()) console.log(`  ${E.fdCat(p.cat).n}：${p.name}・${p.spec}`);
  stepQ(20, true);
  const h = G.hy[G.hy.length - 1];
  console.log(`  ${h ? h.y : '-'}年 売上 ${h ? (h.sales / h.cpi / 1e8).toFixed(0) : '-'}億（今の価値）・${G.over ? G.over.type : '続行'}`);
  console.log(`  製品：${E.fdActiveProds().map(p => `${p.name}（${Math.floor(p.qy)}年）`).join('、')}`);
}

// 5) とてつもなく先（100万年先）
{
  const G = start('denki', 1960, -1e6);
  console.log(`■ 電機 1960年・技術100万年先`);
  for (const p of E.fdActiveProds()) console.log(`  ${E.fdCat(p.cat).n}：${p.name}・${p.spec}`);
  for (const c of Object.keys(E.FD_SCEN.denki.cats)) if (!E.fdActiveProds(c).length && E.fdCatOpen(c)) { const r = E.fdEditAddProd(c, E.fdCat(c).kind === 'big' ? 2 : 100); ok(r.ok, `${c} を出せない ${r.why}`); }
  stepQ(8, true);
  for (const p of E.fdActiveProds()) ok(!/NaN|undefined|Infinity/.test(p.name + p.spec), `名前・仕様に変な文字 ${p.name} ${p.spec}`);
  console.log(`  製品：${E.fdActiveProds().map(p => p.name).join('、')}`);
}
console.log(bad ? `NG ${bad}件` : 'OK');
process.exit(bad ? 1 : 0);
