// 就任の時点のグループ（始め方の画面で決める子会社・孫会社・関連会社）のテスト。
// 株式会社で始める場合と、持株会社で始める場合（事業会社の下に孫会社）をつくり、ボットで2年ほど動かして、
// 各社の帳簿・持ち主ごとの関係会社株式・連結の貸借と利益剰余金のつながりを毎月・毎期確かめる
//   node test/run_startgroup.js [シード=5]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const seed = +(process.argv[2] || 5);
const fails = [];
const Y = v => (v / 1e8).toFixed(2) + '億';
const say = (...a) => console.log(...a);
const T = w => E.KS_TYPE_LIST.find(x => x.name.includes(w)).name;
function checkCons(fy) {
  const G = api.G;
  const c = G.group && G.group.cons[fy];
  if (!c) { fails.push(`${E.ksFyLabel(fy)} 連結決算がない`); return; }
  const b = c.bs;
  const diff = Math.round(b.TA - b.TL - (b.capital + b.capSur + b.re + b.nci + b.fctr));
  say(`  連結 ${E.ksFyLabel(fy)}: 売上 ${Y(c.pl.sales)} 経常 ${Y(c.pl.ord)} 純利益（親） ${Y(c.pl.niParent)} 非支配 ${Y(c.pl.niNci)} | 総資産 ${Y(b.TA)} 非支配持分 ${Y(b.nci)} 換算 ${Y(b.fctr)} 関連会社 ${(c.affs || []).length} | つながり ${c.check === null ? '初年' : c.check}`);
  if (Math.abs(diff) > 10) fails.push(`${E.ksFyLabel(fy)} 連結の貸借が合わない ${diff}`);
  if (c.check !== null && Math.abs(c.check) > 1e5) fails.push(`${E.ksFyLabel(fy)} 連結の利益剰余金のつながりがずれる ${c.check}`);
}
function chk(label) { const e = E.ksCheck().concat(E.ksGroupCheck()); if (e.length) fails.push(`${label}: ${e.slice(0, 3).join(' / ')}`); }
function month() {
  let G = api.G;
  for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
  E.ksAutoFinance();
  E.ksGroupAdvance();
  G = api.G;
  for (const p of G.pendingModals || []) if (p.type === 'kEvt' && p.choose) E.ksEvtChoose(p.id, 0);
  G.pendingModals = [];
  if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
  if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
  if (G.closing) { const fy = G.closing.fy; E.ksAutoClose(); checkCons(fy); }
  chk(E.ymLabel(api.G.m));
}
function run(n) { for (let i = 0; i < n && !api.G.over; i++) month(); }
function show() {
  const G = api.G;
  const line = s => `${'　'.repeat(E.ksRecDepth(s))}${s.name}[${s.id}${s.parent ? '←' + s.parent : ''} ${Math.round(s.own * 100)}%${s.aff ? ' 持分法' : ''}${s.cc !== 'jp' ? ' ' + s.cc : ''}${s.fresh ? ' 新設' : ' 4期'}] 事業${E.ksWith(s.st, E.ksActiveUnits).length} 純資産 ${Y(E.ksWith(s.st, E.ksEquity))} 株式の額 ${Y(E.ksRecInv(s))} 過去の決算 ${Object.keys(s.st.fys).length}期`;
  for (const s of E.ksSubs()) say(' ', line(s));
  say('  親会社', G.coName, '関係会社株式', Y(G.bal.subShares || 0), '資本剰余金', Y(G.bal.capSurplus || 0), '純資産', Y(E.ksEquity()));
}

// ---- 1) 株式会社で始める：子会社・合弁・関連会社・孫会社・海外・中間持株会社とその下の会社（ひ孫会社まで）・事業は5つ ----
const grp1 = [
  { id: 'a', name: '汐見フーズ', owner: 'root', own: 1, units: [{ type: T('食品スーパー'), sc: 1 }, { type: T('弁当'), sc: 0.5 }], cash: 3e8 },
  { id: 'b', name: '', owner: 'root', own: 0.6, units: [{ type: T('ラーメン'), sc: 1 }], cond: 'good' },
  { id: 'c', name: '', owner: 'root', own: 0.4, units: [{ type: T('洋食'), sc: 1 }], cond: 'bad' },
  { id: 'd', name: '汐見ロジ', owner: 'a', own: 1, units: [{ type: T('倉庫'), sc: 0.5 }], debt: 2e8 },
  { id: 'e', name: '', owner: 'root', own: 1, cc: 'th', units: [{ type: T('ソフトウェア'), sc: 0.5 }] },
  { id: 'f', name: '汐見グループ', owner: 'root', own: 1, units: [], cash: 1e8 },
  { id: 'g', name: '', owner: 'f', own: 0.8, units: [{ type: T('介護'), sc: 1 }], pref: 13 },
  { id: 'h', name: '', owner: 'g', own: 1, units: [{ type: T('印刷'), sc: 0.5 }], capital: 3e7 },
  { id: 'i', name: '', owner: 'c', own: 1, units: [{ type: T('婦人服'), sc: 0.5 }] }, // 関連会社の下には置けない → 親会社の直下になる
  { id: 'j', name: '', owner: 'e', own: 0.3, units: [] },                               // 事業のない関連会社 → つくらない
];
let t0 = Date.now();
E.ksNewGame({ units: [{ type: '食品スーパー', sc: 1 }, { type: T('ソフトウェア'), sc: 1 }, { type: T('ホテル'), sc: 1 }, { type: T('物流'), sc: 0.5 }, { type: T('洋食'), sc: 0.5 }], coName: '株式会社テスト', ceo: 'テスト', seed, custom: { cash: 5e8 }, startGroup: grp1 });
say(`株式会社で開始 ${Date.now() - t0}ms`, api.G.coName, '事業', E.ksActiveUnits().length, '会社', E.ksSubs().length);
show();
if (E.ksActiveUnits().length !== 5) fails.push('親会社の事業が5つでない');
if (E.ksSubs().length !== 9) fails.push(`会社の数が9でない（${E.ksSubs().length}）`);
const byName = n => E.ksSubs().find(s => s.name.includes(n));
const A = byName('汐見フーズ'), D = byName('汐見ロジ'), F = byName('汐見グループ');
if (!A || A.name !== '汐見フーズ株式会社') fails.push('社名に株式会社がつかない');
if (!D || D.parent !== A.id) fails.push('孫会社の持ち主が違う');
const Gs = E.ksSubs().find(s => s.parent === F.id);
if (!Gs || Math.abs(Gs.own - 0.8) > 1e-9) fails.push('中間持株会社の下の会社がない');
const H = Gs && E.ksSubs().find(s => s.parent === Gs.id);
if (!H || E.ksRecDepth(H) !== 2) fails.push('ひ孫会社がない');
const I = E.ksSubs().find(s => s.st.units.some(u => u.type === T('婦人服')));
if (!I || I.parent) fails.push('関連会社の下に置いた会社が親会社の直下に移っていない');
const Ef = E.ksSubs().find(s => s.cc === 'th');
if (!Ef || !Ef.fresh || Object.keys(Ef.st.fys).length) fails.push('海外の会社が新設になっていない');
if (Object.keys(A.st.fys).length < 4) fails.push('国内の会社に過去4期の決算書がない');
if (Math.abs(E.ksWith(A.st, () => E.ksB('cash')) - 3e8) > 2e5) fails.push(`子会社の現預金が設定どおりでない ${E.ksWith(A.st, () => E.ksB('cash'))}`);
if (Math.abs(E.ksWith(D.st, E.ksDebt) - 2e8) > 2e5) fails.push(`孫会社の借入金が設定どおりでない ${E.ksWith(D.st, E.ksDebt)}`);
if (Math.abs(E.ksWith(H.st, () => E.ksB('capital')) - 3e7) > 1) fails.push('ひ孫会社の資本金が設定どおりでない');
if (new Set(E.ksSubs().map(s => s.name)).size !== E.ksSubs().length) fails.push('同じ社名の会社がある');
chk('開始の直後');
run(27);
say('2年後', E.ymLabel(api.G.m), api.G.over ? '倒産' : '', '会社', E.ksSubs().length);
show();
if (Object.keys(api.G.group.cons).length < 2) fails.push('連結決算が2期分ない');

// ---- 2) 持株会社で始める：事業会社の下に孫会社、直下に子会社と関連会社 ----
api.G = null;
const grp2 = [
  { id: 'x', name: '', owner: 'u:' + T('ラーメン'), own: 1, units: [{ type: T('弁当'), sc: 0.5 }] },
  { id: 'y', name: '', owner: 'x', own: 0.51, units: [{ type: T('洋食'), sc: 0.5 }] },
  { id: 'z', name: '', owner: 'root', own: 1, units: [{ type: T('倉庫'), sc: 0.5 }] },
  { id: 'w', name: '', owner: 'root', own: 0.2, units: [{ type: T('印刷'), sc: 0.5 }] },
  { id: 'v', name: '', owner: 'u:' + T('ホテル'), own: 1, units: [{ type: T('介護'), sc: 0.5 }] }, // 事業にない業種 → 親会社の直下
];
t0 = Date.now();
E.ksNewGameCustom({ units: [{ type: '食品スーパー', sc: 1 }, { type: T('ラーメン'), sc: 1 }], coName: '株式会社テスト', ceo: 'テスト', seed: seed + 1, custom: { form: 'hd', cash: 2e8 }, startGroup: grp2 });
say(`持株会社で開始 ${Date.now() - t0}ms`, api.G.coName, '会社', E.ksSubs().length);
show();
if (E.ksSubs().length !== 7) fails.push(`持株会社のグループの会社の数が7でない（${E.ksSubs().length}）`);
const unitR = E.ksSubs().find(s => s.kind === 'hd' && s.st.units.some(u => u.type === T('ラーメン')));
const X = E.ksSubs().find(s => s.parent === unitR.id);
if (!X) fails.push('事業会社の下に孫会社がない');
if (X && !E.ksSubs().some(s => s.parent === X.id)) fails.push('孫会社の下の会社がない');
const V = E.ksSubs().find(s => s.st.units.some(u => u.type === T('介護')));
if (!V || V.parent) fails.push('事業にない業種の持ち主が親会社に直っていない');
const direct = E.ksSubs().filter(s => !s.parent && !s.aff && s.own >= 0.9999);
if (direct.some(s => s.fee !== direct[0].fee)) fails.push('直下の100%子会社の経営指導料の料率がそろっていない');
chk('持株会社の開始の直後');
run(27);
say('2年後', E.ymLabel(api.G.m), api.G.over ? '倒産' : '', '会社', E.ksSubs().length);
show();
if (Object.keys(api.G.group.cons).length < 2) fails.push('持株会社：連結決算が2期分ない');
console.log(fails.length ? `NG ${fails.length}件\n` + fails.slice(0, 20).join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
