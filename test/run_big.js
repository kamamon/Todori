// 規模に上限のない会社のテスト：店が何千・何万とある会社（ウォルマートのような）や、設備・人・取引先がとても多い会社を作り、
// 記録がまとまっているか（店は都道府県ごと、設備は q 台分）、数・能力・費用が1つずつの記録と同じに数えられるか、
// 火災・競合・まとめて出店・トラックの売買・保存と読み込み・年商の上限で縮めて始めるか、整合性が保たれるかを確かめる
//   node test/run_big.js
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const errs = [];
const ok = (c, m) => { if (!c) errs.push(m); };
const T = (eng, w) => (E.KS_TYPE_LIST.find(S => S.eng === eng && S.name.includes(w)) || E.KS_TYPE_LIST.find(S => S.eng === eng)).name;
const game = (type, n, o = {}) => { E.ksNewGame(Object.assign({ units: [{ type, sc: E.ksCapToSc(type, n) }], coName: 'テスト', ceo: 'テスト', seed: o.seed || 7, cond: 'normal' }, o)); return api.G; };
const months = (n, f) => {
  let G = api.G;
  const end = G.m + n;
  while (G.m < end && !G.over) {
    for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
    E.ksAutoFinance();
    if (f) f(G);
    E.ksAdvance();
    G = api.G;
    G.pendingModals = [];
    if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
    if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
    if (G.closing) E.ksAutoClose();
  }
  return api.G;
};
const check = where => { const c = E.ksCheck(); if (c.length) errs.push(`${where}：整合性 ${c.slice(0, 3).join(' / ')}`); };
const t0 = Date.now();

// 1) 上限がない：開始の画面の数は、そのまま規模になる
const SUPER = T('shop', '食品スーパー');
ok(E.ksCapInfo(SUPER).maxSc >= 1e6, '規模の上限が残っている');
ok(Math.abs(E.ksScToCap(SUPER, E.ksCapToSc(SUPER, 12345)) - 12345) <= 1, '12,345店が数のとおりにならない');
ok(E.ksStartList({ units: [{ type: SUPER, sc: 50000 }] })[0].sc === 50000, '開始のリストで規模が切られる');

// 2) 5,000店の食品スーパー：都道府県ごとのまとまり
let G = game(SUPER, 5000, { pref: 13 });
let u = G.units[0];
const sE = E.KS_ENGINE.shop;
ok(E.ksStoresN(u.op.stores) === 5000, `店の数が5,000にならない（${E.ksStoresN(u.op.stores)}）`);
ok(u.op.stores.length <= 60, `店の記録が多すぎる（${u.op.stores.length}）`);
ok(u.op.stores[0].pref === 13 && /東京都/.test(u.op.stores[0].n), `本社の都道府県のまとまりが先頭でない（${u.op.stores[0].n}）`);
const tokyo = u.op.stores[0], tottori = u.op.stores.find(s => /鳥取/.test(s.n));
ok(tokyo.k > 5 * (tottori ? E.ksStoreK(tottori) : 1), '人口の多い都道府県に店が多くない');
ok(new Set(u.op.stores.map(s => s.n)).size === u.op.stores.length, '店の名前が重なる');
ok(u.op.stores.every(s => s.renovM <= E.KS_HIST_START - 6 && s.eqM <= E.KS_HIST_START - 6), '改装・設備の時期が開始より後');
ok(G.assets.length < 250, `資産の記録が多すぎる（${G.assets.length}）`);
const P = E.ksP(u);
ok(Math.abs(u.staff.regular - P.staff[0] * 5000) < 1, '社員の数が5,000店分でない');
const fit = E.sum(G.assets.filter(a => a.what === 'fit'), a => a.cost);
ok(Math.abs(fit / (P.fit * 5000) - 1) < 0.01, `内装の取得価額が5,000店分でない（${(fit / (P.fit * 5000)).toFixed(3)}）`);
ok(E.sum(E.ksBuildings(), b => b.k || 1) === 5000 && E.ksBldgN(E.ksBuildings()) === 5000, '消防の建物の数が5,000にならない');
let h = E.ksLastFY();
const per = h.pl.sales / 5000;
console.log(`食品スーパー 5,000店：店の記録 ${u.op.stores.length}・資産 ${G.assets.length}件・売上 ${(h.pl.sales / 1e8).toFixed(0)}億（1店 ${(per / 1e8).toFixed(1)}億）・営業利益率 ${(h.pl.opi / h.pl.sales * 100).toFixed(1)}%・人 ${E.fmtNum(E.ksHeadcount(), 0)}`);
check('5,000店');
// 1店あたりの売上は、中の規模（1店）の会社とほぼ同じ
const G1 = game(SUPER, 1);
const per1 = E.ksLastFY().pl.sales;
ok(per / per1 > 0.6 && per / per1 < 1.6, `1店あたりの売上が中の規模と大きく違う（${(per / per1).toFixed(2)}倍）`);
void G1;
G = game(SUPER, 5000, { pref: 13 }); u = G.units[0];
// 3) まとめて出店（100店）・改装
const plan = sE.plan(u, 100);
ok(plan.arg.s.k === 100 && /〜/.test(plan.arg.s.n), `100店の出店の記録がおかしい（${plan.arg.s.n}）`);
ok(Math.abs(E.sum(plan.items, x => x.cost) / E.sum(sE.plan(u, 1).items, x => x.cost) - 100) < 0.5, '100店の出店の費用が1店の100倍でない');
ok(plan.deposit === P.dep * 100, '100店の保証金が100店分でない');
for (const it of plan.items) E.ksBuyAsset(it);
u.op.stores.push(Object.assign({}, plan.arg.s)); // KS_CAPEX_FX.shopStore と同じ（画面のファイル）
ok(E.ksStoresN(u.op.stores) === 5100, '100店を出したあとの店の数が5,100でない');
months(4);
ok(E.ksStoresN(sE.storesOpen(u)) === 5100, '出した100店が開店しない');
const st = u.op.stores[1];
st.renovM = api.G.m; // KS_CAPEX_FX.shopRenov と同じ
// 4) 競合店：まとまりの1店だけの分（7%÷k）
G = api.G;
const before = st.comp || 1;
const kc = E.ksStoreK(st);
st.comp = before * (1 - 0.07 / kc);
ok(st.comp > 0.99 || kc < 10, '競合の影響がまとまり全体に効きすぎる');
// 5) 大きな火災：まとまりから1店を分けて休業、その店の分の資産だけがなくなる
G = api.G; u = G.units[0];
if (!G.law) E.ksLawInit();
const g0 = u.op.stores.find(s => E.ksStoreK(s) > 20 && s.openM <= G.m);
const k0 = E.ksStoreK(g0), n0 = E.ksStoresN(u.op.stores), rec0 = u.op.stores.length;
const cost0 = E.sum(E.ksUA(u).filter(a => a.n.startsWith(g0.n + 'の')), a => a.cost);
const tot0 = E.sum(E.ksActiveAssets(), a => a.cost);
const b = E.ksBuildings().find(x => x.key === g0);
E.ksLawNewFire(b, true, new Set());
const one = u.op.stores[u.op.stores.length - 1];
ok(u.op.stores.length === rec0 + 1 && E.ksStoreK(one) === 1 && one.openM === 9999, '火災の店が1店の記録に分かれて休業しない');
ok(E.ksStoreK(g0) === k0 - 1 && E.ksStoresN(u.op.stores) === n0, `火災のあとの店の数が合わない（${E.ksStoreK(g0)}/${k0 - 1}・${E.ksStoresN(u.op.stores)}/${n0}）`);
const cost1 = E.sum(E.ksUA(u).filter(a => a.n.startsWith(g0.n + 'の')), a => a.cost);
ok(Math.abs(cost1 / cost0 - (k0 - 1) / k0) < 0.002, `まとまりの資産が1店分だけ減っていない（${(cost1 / cost0).toFixed(4)}）`);
const lost = tot0 - E.sum(E.ksActiveAssets(), a => a.cost);
ok(lost >= 0 && lost <= cost0 / k0 * 1.01, `焼けた資産が1店分より多い（${lost} / ${Math.round(cost0 / k0)}）`);
ok(u.op.stores.filter(s => s.openM === 9999).length === 1, '休業の店が1つでない');
const f = api.G.law.fires[0];
ok(f.store === one.n && f.b.includes(one.n), '火災の記録が分けた店の名前でない');
check('火災のあと');
one.openM = api.G.m + 2; one.renovM = api.G.m + 2; one.eqM = api.G.m + 2; // KS_CAPEX_FX.reopen と同じ
months(3);
ok(E.ksStoresN(sE.storesOpen(u)) === E.ksStoresN(u.op.stores), '復旧した店が再開しない');
// 6) 2年動かす・保存して読み込む
months(24);
G = api.G;
ok(!G.over, `5,000店の会社が2年で終わった（${G.over}）`);
check('5,000店・2年');
const js = JSON.stringify(G);
ok(js.length < 900e3, `保存データが大きすぎる（${(js.length / 1024).toFixed(0)}KB）`);
api.G = JSON.parse(js);
months(3);
check('読み込んだあと');
console.log(`2年あと：店 ${E.fmtNum(E.ksStoresN(api.G.units[0].op.stores), 0)}（記録 ${api.G.units[0].op.stores.length}）・資産 ${api.G.assets.filter(a => a.soldM === undefined).length}件・保存 ${(js.length / 1024).toFixed(0)}KB`);

// 7) 飲食店チェーン 20,000店
G = game(T('rest', 'ハンバーガー'), 20000);
u = G.units[0];
ok(E.ksStoresN(u.op.shops) === 20000 && u.op.shops.length <= 60, '飲食店の店の数・記録がおかしい');
ok(u.op.shops.every(s => s.openM >= -300 && s.renovM <= E.KS_HIST_START - 6 && s.kitM <= E.KS_HIST_START - 6), '飲食店の開店・改装の時期がおかしい');
months(12);
check('飲食店 20,000店');

// 8) 設備のまとめ（q 台）：機械 41台以上は40の記録、能力・人手・台数は1台ずつと同じ
const JOB = T('mfg', '切削');
const S = E.KS_TYPES[JOB];
const base = E.sum(S.eq, e => e.n);
for (const n of [40, 400, 40000]) {
  G = game(JOB, n);
  u = G.units[0];
  const ms = E.KS_ENGINE.mfg.machines(u);
  ok(E.ksEqN(ms) === n, `機械の台数が${n}にならない（${E.ksEqN(ms)}）`);
  ok(ms.length <= Math.min(n, 40 * S.eq.length), `機械の記録が多すぎる（${ms.length}）`);
  const capOne = E.sum(S.eq, e => (E.KS_EQ[e.k].cap || 0) * e.n) / base;
  ok(Math.abs(E.sum(ms, a => a.cap) / (capOne * n) - 1) < 0.02, `機械の能力が台数分でない（${n}台）`);
  months(6);
  check(`機械 ${n}台`);
}
ok(base > 0, '機械の業種がない');
// まとめた記録の一部を取り出す（売る・焼ける）：取得価額・償却累計額・台数・能力の合計は変わらない
G = api.G;
const a0 = E.KS_ENGINE.mfg.machines(G.units[0]).find(a => a.q > 3);
const sumOf = () => { const L = E.KS_ENGINE.mfg.machines(G.units[0]); return [E.sum(L, a => a.cost), E.sum(L, a => a.booked), E.ksEqN(L), E.sum(L, a => a.cap)]; };
const s0 = sumOf();
const q0 = a0.q;
const part = E.ksAssetTake(a0, 2);
const s1 = sumOf();
ok(part !== a0 && part.q === 2 && E.ksEqQ(a0) === q0 - 2, '一部を取り出したあとの台数がおかしい');
ok(s0.every((v, i) => Math.abs(v - s1[i]) < 1e-6 * Math.max(1, v)), `一部を取り出すと合計が変わる ${s0} → ${s1}`);
ok(/〜\d+号$|\d+号$/.test(part.n) && part.n !== a0.n, `取り出した記録の名前がおかしい（${part.n} / ${a0.n}）`);
G.curU = G.units[0].id;
E.ksSellAsset(part, E.ksSalePrice(part));
G.curU = null;
check('一部を売ったあと');

// 9) 卸売：取引先は400社まで（1社が大きくなる）、トラックはまとめる
G = game(T('trade', '食品'), 30000);
u = G.units[0];
const tE = E.KS_ENGINE.trade;
ok(u.op.customers.length <= 600, `取引先の記録が多すぎる（${u.op.customers.length}）`); // 開始は400社。過去4期の出入りで少し増減する
const tr = tE.trucks(u);
ok(tr.length <= 40, `トラックの記録が多すぎる（${tr.length}）`);
ok(Math.abs(E.sum(tr, a => a.cap) - E.ksEqN(tr) * u.op.truckCap) < E.ksEqN(tr) * 1e4 + 1, 'トラックの能力が台数分でない');
const custK = u.op.custK || 1;
ok(custK > 1, '取引先をまとめたのに、新しい取引先の大きさが変わらない');
months(12);
check('卸売 大');
const nT0 = E.ksEqN(tE.trucks(api.G.units[0]));
G = api.G; u = G.units[0];
for (let i = 0; i < 12; i++) { G.m++; G.curU = u.id; tE.auto(u); G.curU = null; }
G.m -= 12;
ok(Math.abs(E.ksEqN(tE.trucks(u)) - nT0) <= Math.max(2, nT0 * 0.25), 'トラックの売買が一度に多すぎる');
check('トラックの売買');

// 10) 建設：見積の依頼は月24件までで、1件が大きくなる
G = game(T('build', 'ゼネコン'), 50000);
u = G.units[0];
ok(u.op.psz > 1 && u.op.inq <= 24.0001, `大きな建設会社の見積の依頼が多すぎる（${u.op.inq}）`);
ok(u.op.projects.filter(p => !p.fin).length < 400, '施工中の工事の記録が多すぎる');
months(12);
check('建設 大');

// 11) 人の多い会社（受託開発 100,000人）：退職は二項分布、採用の記録はまとめる
G = game(T('pro', 'ソフトウェア'), 100000);
u = G.units[0];
const pE = E.KS_ENGINE.pro;
const eng0 = u.staff.eng;
E.ksHiresAdd(u.op, G.m, 5000);
ok(u.op.hires.length <= 3 + 1 && E.sum(u.op.hires, E.ksHireN) >= 5000, '採用の記録がまとまっていない');
ok(Math.abs(pE.avail(u) - (eng0 - 5000 + 5000 * 0.4)) < 2, `採用した人の力の数え方が違う（${pE.avail(u)}）`);
let q = 0; for (let i = 0; i < 20; i++) q += E.ksBinom(100000, 0.01);
ok(Math.abs(q / 20 - 1000) < 60, `二項分布の平均がおかしい（${q / 20}）`);
months(12);
check('受託開発 100,000人');
ok(JSON.stringify(api.G).length < 900e3, '人の多い会社の保存データが大きい');

// 12) 会員（設備の能力）と、輸送（乗務員・燃料はまとめた台数分）
G = game(T('subs', '携帯電話'), 3e8);
u = G.units[0];
const subE = E.KS_ENGINE.subs;
const capEq = E.KS_TYPES[u.type].eq[0].k;
ok(subE.capacity(u) === E.ksEqN(E.ksUA(u).filter(a => a.eq === capEq)) * E.ksP(u).capPer, '会員の設備の能力がまとめた台数分でない');
months(12);
check('会員 3億人');
G = game(T('trans', 'タクシー'), 200000);
u = G.units[0];
const fl = E.KS_ENGINE.trans.fleet(u);
ok(fl.length <= 40 * E.KS_TYPES[u.type].eq.length && E.ksEqN(fl) >= 190000, `車両のまとめがおかしい（記録 ${fl.length}・台数 ${E.ksEqN(fl)}）`);
const crew1 = E.sum(fl, a => (E.ksEqOf(a).crew || 0) * E.ksEqQ(a));
ok(crew1 > E.ksEqN(fl) * 0.5, '乗務員の必要数がまとめた台数分でない');
months(12);
check('タクシー 20万台');

// 13) 年商の上限：大きすぎる規模は縮めて始める
const NUKE = T('cap', '原子力発電事業');
const scWant = E.ksCapToSc(NUKE, 1e8);
G = game(NUKE, 1e8);
h = E.ksLastFY();
ok(G.units[0].sc < scWant * 0.5, `大きすぎる規模が縮まらない（${scWant} → ${G.units[0].sc}）`);
ok(h.pl.sales < E.KS_ANNUAL_MAX * 4, `年商が上限を大きく超える（${(h.pl.sales / 1e12).toFixed(0)}兆）`);
ok(G.news.some(n => /縮めて始めました/.test(n.t || n.text || n.msg || JSON.stringify(n))), '縮めて始めた知らせがない');
months(6);
check('上限で縮めた会社');

// 14) 小さな会社（中の規模）は今までどおり：店1店ずつ、設備1台ずつ
G = game(SUPER, 18);
ok(G.units[0].op.stores.length === 18 && G.units[0].op.stores.every(s => !s.k && !s.pref) && G.units[0].op.stores[0].n === '本店', '18店の会社の店が1店ずつにならない');
G = game(JOB, 12);
ok(E.KS_ENGINE.mfg.machines(G.units[0]).every(a => !a.q), '12台の工場の機械がまとめられている');

console.log(`${((Date.now() - t0) / 1000).toFixed(1)}秒`);
if (errs.length) { console.log(`問題 ${errs.length}件:\n  ` + errs.join('\n  ')); process.exitCode = 1; } else console.log('OK');
