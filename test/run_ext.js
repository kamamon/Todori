// 拡張のテスト：カスタムスタート・方針と人事（福利厚生）・拠点と地図（土地・建物・移転）・海外展開の国・
// 持株会社で始める・海外子会社。ボットで動かして、帳簿の整合性と連結決算を確かめる
//   node test/run_ext.js [シード=3]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const seed = +(process.argv[2] || 3);
const fails = [];
const Y = v => (v / 1e8).toFixed(2) + '億';
const evts = {};
function botMonth() {
  let G = api.G;
  for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
  E.ksAutoFinance();
  if (G.group) E.ksGroupAdvance(); else E.ksAdvance();
  G = api.G;
  for (const p of G.pendingModals || []) { if (p.type === 'kEvt') { evts[p.id] = (evts[p.id] || 0) + 1; if (p.choose) E.ksEvtChoose(p.id, 0); } if (p.type === 'kDisaster') evts.disaster = (evts.disaster || 0) + 1; }
  G.pendingModals = [];
  if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
  if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
  if (G.closing) { const fy = G.closing.fy; E.ksAutoClose(); checkCons(fy); }
  const e = E.ksCheck().concat(G.group ? E.ksGroupCheck() : []);
  if (e.length) fails.push(`${E.ymLabel(G.m)}: ${e.slice(0, 3).join(' / ')}`);
}
function checkCons(fy) {
  const G = api.G;
  const c = G.group && G.group.cons[fy];
  if (!c) return;
  const b = c.bs;
  const diff = Math.round(b.TA - b.TL - (b.capital + b.capSur + b.re + b.nci + b.fctr));
  console.log(`  連結 ${E.ksFyLabel(fy)}: 売上 ${Y(c.pl.sales)} 営業利益 ${Y(c.pl.opi)} 純利益（親） ${Y(c.pl.niParent)} 総資産 ${Y(b.TA)} 換算 ${Y(b.fctr)} つながり ${c.check === null ? '初年' : c.check}`);
  if (Math.abs(diff) > 10) fails.push(`${E.ksFyLabel(fy)} 連結の貸借が合わない ${diff}`);
  if (c.check !== null && Math.abs(c.check) > 1e5) fails.push(`${E.ksFyLabel(fy)} 連結の利益剰余金のつながりがずれる ${c.check}`);
}
function run(n) { for (let i = 0; i < n && !api.G.over; i++) botMonth(); }
function chk(label) { const e = E.ksCheck().concat(api.G.group ? E.ksGroupCheck() : []); if (e.length) fails.push(`${label}: ${e.slice(0, 3).join(' / ')}`); }
function KS(w) { const S = E.KS_TYPE_LIST.find(x => x.name.includes(w)); return S.name; }

// 1) カスタムスタート：合同会社・東京・資本金3億・現預金8億・借入2億・本社の土地と建物・好景気・1ドル155円・創業1990年
E.ksNewGame({ units: [{ type: '食品スーパー', sc: 1 }, { type: '金属部品の切削加工（町工場）', sc: 1 }], coName: '合同会社テスト', ceo: 'テスト', seed, form: 'gk', pref: 13,
  custom: { form: 'gk', pref: 13, capital: 3e8, cash: 8e8, debt: 2e8, hqLand: true, eco: 'boom', fx: 155, founded: 1990 } });
let G = api.G;
console.log('カスタム', G.coName, E.ksFormName ? E.ksFormName(G) : G.form, '本社', E.ksPrefName(G.loc.hq), '資本金', Y(E.ksB('capital')), '現預金', Y(E.ksB('cash')), '借入', Y(E.ksDebt()), '土地', G.loc.lands.length, '創業', G.founded, '第', G.firstPeriod, '期', '1ドル', G.eco.fx, G.customNote || '');
if (G.form !== 'gk') fails.push('会社の形が合同会社にならない');
if (G.loc.hq !== 13) fails.push('本社が東京にならない');
if (Math.abs(E.ksB('capital') - 3e8) > 1) fails.push('資本金が3億にならない ' + E.ksB('capital'));
if (!G.loc.lands.length || !G.loc.lands[0].bldg) fails.push('本社の土地と建物がない');
chk('カスタムの直後');
// 2) 方針と人事
E.ksHrSetCreed('people');
E.ksHrSetPris(['raise', 'dx', 'cost']);
E.ksHrSetGoals([{ k: 'sales', v: E.ksAnnualSales() }, { k: 'acc', v: 0 }, { k: 'es', v: 60 }]);
for (const [id, lv] of [['trip', 2], ['house', 2], ['meal', 2], ['dc', 2], ['shataku', 1], ['remote', 2], ['eap', 1]]) E.ksHrSetWf(id, lv);
const es0 = G.hr.es, wf0 = E.ksWfExtraMonth();
// 3) 拠点：茨城の工業地を買って工場を建てる、店を大阪へ移す、本社を大阪へ
const mfg = E.ksActiveUnits().find(u => E.ksS(u).eng === 'mfg');
const shop = E.ksActiveUnits().find(u => E.ksS(u).eng === 'shop');
let r = E.ksBuyLand(8, 'ind', 3000);
console.log('土地', r.ok, r.ok ? `${Y(r.q.total)}（固定資産税 年${(r.q.yearTax / 1e4).toFixed(0)}万円）` : r.why);
if (r.ok) { const b = E.ksBuildOnLand(r.land.id, 'factory', mfg.id); console.log('工場', b.ok, b.ok ? Y(b.q.cost) : b.why); }
const mq = E.ksMoveUnitQuote(shop, 27);
console.log('店の移転の見込み', mq.ok, mq.ok ? `${Y(mq.total)} 人件費×${mq.wage.toFixed(2)} 家賃×${mq.rent.toFixed(2)} 需要×${mq.demand.toFixed(2)}` : mq.why);
r = E.ksMoveUnit(shop.id, 27); console.log('店の移転', r.ok, r.why || '');
r = E.ksMoveHQ(27); console.log('本社の移転', r.ok, r.why || '');
chk('拠点の直後');
// 4) 海外展開の国：アジアはタイ
G.loc.intlCC = { asia: 'th' };
G.grow.intl[mfg.id] = {};
E.ksIntlRegister(mfg.id, 'asia');
const x = G.grow.intl[mfg.id].asia;
if (x.cc !== 'th') fails.push('海外展開の国がタイにならない');
E.ksIntlRegister(mfg.id, 'asia');
console.log('海外展開', G.grow.intl[mfg.id].asia.st, G.grow.intl[mfg.id].asia.cc, E.ksForeignCountries().join(','), '法令の点検', E.ksLawTasks().filter(t => t.t.id === 'f_th').length);
if (!E.ksLawTasks().some(t => t.t.id === 'f_th')) fails.push('タイの法令の点検がない');
if (G.grow.intl[mfg.id].asia.cc !== 'th') fails.push('段階を進めると国が消える');
run(15);
G = api.G;
console.log('1年後', E.ymLabel(G.m), '満足度', es0.toFixed(1), '→', G.hr.es.toFixed(1), '福利厚生の増分 月', (wf0 / 1e4).toFixed(0), '万円', '目標の振り返り', G.hr.goalsHist.length, '災害', G.loc.dis.length, '出来事', JSON.stringify(evts), '現預金', Y(E.ksB('cash')), G.over ? '倒産' : '');
const jt = {};
for (const j of G.journal) jt[j.code] = (jt[j.code] || 0) + 1;
for (const c of ['propTax', 'landBuy', 'moveUnit', 'moveHQ', 'hrPol', 'wf_meal', 'rebate']) if (!jt[c] && !(G.months || []).length) fails.push('仕訳がない ' + c);
if (!G.hr.goalsHist.length) fails.push('目標の振り返りがない');
// 5) 海外子会社（ベトナム）
E.ksPost('custCash', [['cash', 3e8, 0], ['capSurplus', 0, 3e8]], { u: 'HQ', cf: 'equity', desc: 'テストの増資' });
r = E.ksGroupFound({ type: KS('婦人服'), sc: 0.5, own: 1, cash: 1.5e8, cc: 'vn' });
console.log('海外子会社', r.ok, r.why || r.s.name);
if (!r.ok) fails.push('海外子会社をつくれない ' + r.why);
run(26);
G = api.G;
for (const s of E.ksSubAll()) console.log('  子会社', s.name, s.cc, '売上(年)', Y(E.ksWith(s.st, E.ksAnnualSales)), '現預金', Y(E.ksWith(s.st, () => E.ksB('cash'))), s.st.over ? '倒産' : '');
// 6) 持株会社で始める
E.ksNewGameCustom({ units: [{ type: '食品スーパー', sc: 1 }, { type: '洋食レストラン', sc: 1 }], coName: '株式会社テスト', ceo: 'テスト', seed: seed + 1, pref: 40, custom: { form: 'hd', pref: 40, cash: 2e8, capital: 1e8 } });
G = api.G;
console.log('持株会社で開始', G.coName, '子会社', E.ksSubs().map(s => s.name).join('・'), '本社', E.ksPrefName(G.loc.hq), '現預金', Y(E.ksB('cash')));
if (E.ksActiveUnits().length) fails.push('持株会社に事業がある');
if (E.ksSubs().length !== 2) fails.push('子会社が2社にならない');
chk('持株会社の直後');
run(27);
G = api.G;
console.log('HD', E.ymLabel(G.m), '営業収益', Y(E.ksLastFY().pl.sales), '純利益', Y(E.ksLastFY().pl.ni), '現預金', Y(E.ksB('cash')), G.over ? '倒産' : '');
console.log(fails.length ? `NG ${fails.length}件\n` + fails.slice(0, 15).join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
