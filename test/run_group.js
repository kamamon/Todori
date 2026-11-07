// 企業グループのテスト：子会社の設立・合弁・分社化・買収・持株会社・売却を、ボットで数年動かして
// 各社の帳簿の整合性と、連結決算（貸借の一致・利益剰余金のつながり）を確かめる
//   node test/run_group.js [シード=5] [年数=3]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const seed = +(process.argv[2] || 5), years = +(process.argv[3] || 3);
const fails = [];
const Y = v => (v / 1e8).toFixed(2) + '億';
function botMonth() {
  let G = api.G;
  for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
  E.ksAutoFinance();
  E.ksGroupAdvance();
  G = api.G;
  G.pendingModals = [];
  if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
  if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
  if (G.closing) { const fy = G.closing.fy; E.ksAutoClose(); checkCons(fy); }
  const e = E.ksCheck().concat(E.ksGroupCheck());
  if (e.length) { fails.push(`${E.ymLabel(G.m)}: ${e.slice(0, 3).join(' / ')}`); }
}
function checkCons(fy) {
  const G = api.G;
  const c = G.group && G.group.cons[fy];
  if (!c) return;
  const b = c.bs;
  const eq = b.capital + b.capSur + b.re + b.nci + b.fctr;
  const diff = Math.round(b.TA - b.TL - eq);
  const domFctr = G.group.subs.filter(s => !s.gone && (!s.cc || s.cc === 'jp')).length && Math.abs(b.fctr) > 1000 && !G.group.subs.some(s => s.cc && s.cc !== 'jp');
  console.log(`  連結 ${E.ksFyLabel(fy)}: 売上 ${Y(c.pl.sales)} 営業利益 ${Y(c.pl.opi)} 親会社株主に帰属する純利益 ${Y(c.pl.niParent)} 非支配 ${Y(c.pl.niNci)} 総資産 ${Y(b.TA)} 純資産 ${Y(b.TA - b.TL)}（非支配 ${Y(b.nci)}・換算 ${Y(b.fctr)}） 剰余金のつながり ${c.check === null ? '初年' : c.check} 修正 ${c.elim.length}件`);
  if (Math.abs(diff) > 10) fails.push(`${E.ksFyLabel(fy)} 連結の貸借が合わない ${diff}`);
  if (c.check !== null && Math.abs(c.check) > 1e5) fails.push(`${E.ksFyLabel(fy)} 連結の利益剰余金のつながりがずれる ${c.check}`);
  if (domFctr) fails.push(`${E.ksFyLabel(fy)} 国内子会社なのに換算差 ${b.fctr}`);
}
function run(months) { for (let i = 0; i < months && !api.G.over; i++) botMonth(); }

// 1) 2つの事業の会社
E.ksNewGame({ units: [{ type: '食品スーパー', sc: 1 }, { type: '金属部品の切削加工（町工場）', sc: 1 }], coName: '株式会社テスト', ceo: 'テスト', seed });
let G = api.G;
console.log('開始', E.ksCompanyDesc(), '現預金', Y(E.ksB('cash')));
run(2);
// 2) 子会社の設立（100%）と合弁（60%）
G = api.G;
const plan = E.ksSubStartPlan('ソフトウェア受託開発', 1);
console.log('設立の計画', plan && Y(plan.need));
let r = E.ksGroupFound({ type: 'ソフトウェア受託開発', sc: 1, own: 1, cash: Math.max(plan.need, 1e8) });
console.log('設立', r.ok, r.why || r.s.name);
r = E.ksGroupFound({ type: KS('倉庫'), sc: 0.5, own: 0.6, cash: 2e8 });
console.log('合弁', r.ok, r.why || r.s.name);
function KS(w) { const S = E.KS_TYPE_LIST.find(x => x.name.includes(w)); return S.name; }
// 海外子会社（ベトナム）
if (E.KS_COUNTRIES && E.KS_COUNTRIES.vn) { r = E.ksGroupFound({ type: KS('婦人服'), sc: 0.5, own: 1, cash: 1.5e8, cc: 'vn' }); console.log('海外子会社', r.ok, r.why || r.s.name); }
run(1);
// 3) 分社化
G = api.G;
const u2 = E.ksActiveUnits()[1];
const pv = E.ksGroupSplitPreview(u2.id);
console.log('分社化の見込み', pv.nA, '資産', Y(pv.bv), '在庫', Y(pv.inv), '売掛金', Y(pv.ar), '純資産', Y(pv.net), '現金', Y(pv.cashS));
r = E.ksGroupSplit(u2.id, { cash: pv.cashS });
console.log('分社化', r.ok, r.why || r.s.name, Y(r.net || 0));
let e0 = E.ksCheck().concat(E.ksGroupCheck());
if (e0.length) fails.push('分社化の直後: ' + e0.join(' / '));
run(1);
// 4) 買収（80%）
G = api.G;
const ts = E.ksGroupFindTargets();
const t = ts[0];
E.ksGroupDD(t);
console.log('買収の候補', t.co, t.type, '純資産', Y(t.q.eq), '売上', Y(t.q.sales), '価格（100%）', Y(t.q.price100));
if (E.ksB('cash') < t.q.price100) { const app = { bank: 'mirai', purpose: 'working', amt: E.niceAmount(t.q.price100), termM: 84, cgc: false }; const rr = E.ksEvalLoan(app); if (rr.ok) E.ksBorrow(app, rr); }
r = E.ksGroupBuy(t, 0.8);
console.log('買収', r.ok, r.why || `${r.s.name} 価格 ${Y(r.price)} のれん ${Y(r.gw)}`);
e0 = E.ksCheck().concat(E.ksGroupCheck());
if (e0.length) fails.push('買収の直後: ' + e0.join(' / '));
// 5) 貸付と増資
G = api.G;
const s1 = E.ksSubs()[0];
console.log('貸付', JSON.stringify(E.ksGroupLend(s1.id, 3e7)), '増資', JSON.stringify(E.ksGroupInject(s1.id, 2e7)));
run(years * 12);
G = api.G;
console.log('親会社', G.coName, E.ymLabel(G.m), '現預金', Y(E.ksB('cash')), '関係会社株式', Y(E.ksB('subShares')), '格付', G.grade, G.over ? '倒産' : '');
for (const s of E.ksSubAll()) console.log('  子会社', s.name, s.kind, Math.round(s.own * 100) + '%', s.gone ? `（${s.out.why}）` : '', '売上(年)', Y(E.ksWith(s.st, E.ksAnnualSales)), '現預金', Y(E.ksWith(s.st, () => E.ksB('cash'))), '格付', s.st.grade, s.st.over ? '倒産' : '');
// 6) 売却
const sv = E.ksSubs().find(s => s.kind === 'jv') || E.ksSubs()[0];
if (sv && !G.closing) { r = E.ksGroupSell(sv.id); console.log('売却', sv.name, r.ok, r.why || `${Y(r.price)} 帳簿 ${Y(r.carry)}`); run(14); }
// 7) 持株会社体制
E.ksNewGame({ units: [{ type: '食品スーパー', sc: 1 }, { type: '洋食レストラン', sc: 1 }], coName: '株式会社テストHD', ceo: 'テスト', seed: seed + 1 });
run(3);
r = E.ksGroupMakeHD({ rename: true });
G = api.G;
console.log('持株会社', r.ok, r.why || G.coName, '子会社', E.ksSubs().map(s => s.name).join('・'));
e0 = E.ksCheck().concat(E.ksGroupCheck());
if (e0.length) fails.push('持株会社の直後: ' + e0.join(' / '));
run(years * 12);
G = api.G;
console.log('HD', E.ymLabel(G.m), '売上（営業収益）', Y(E.ksLastFY().pl.sales), '純利益', Y(E.ksLastFY().pl.ni), '現預金', Y(E.ksB('cash')), G.over ? '倒産' : '');
console.log(fails.length ? `NG ${fails.length}件\n` + fails.slice(0, 12).join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
