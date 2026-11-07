// グループの再編のテスト：持分の買い増し（追加取得・株式交換）・関連会社（持分法）と段階取得・孫会社・傘下に移す・
// 合併（親会社への吸収・孫会社の吸収・兄弟の合併）・社名の変更・子会社ごとの売却・海外の関連会社。
// ボットで動かして、各社の帳簿・持ち主ごとの関係会社株式・連結の貸借と利益剰余金のつながりを毎期確かめる
//   node test/run_group2.js [シード=4]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const seed = +(process.argv[2] || 4);
const fails = [];
const Y = v => (v / 1e8).toFixed(2) + '億';
const say = (...a) => console.log(...a);
function checkCons(fy) {
  const G = api.G;
  const c = G.group && G.group.cons[fy];
  if (!c) return;
  const b = c.bs;
  const diff = Math.round(b.TA - b.TL - (b.capital + b.capSur + b.re + b.nci + b.fctr));
  say(`  連結 ${E.ksFyLabel(fy)}: 売上 ${Y(c.pl.sales)} 経常 ${Y(c.pl.ord)} 純利益（親） ${Y(c.pl.niParent)} 非支配 ${Y(c.pl.niNci)} | 総資産 ${Y(b.TA)} 非支配持分 ${Y(b.nci)} 換算 ${Y(b.fctr)} 資本剰余金の修正 ${Y(b.capAdj || 0)} 関連会社 ${(c.affs || []).length} | つながり ${c.check === null ? '初年' : c.check}`);
  if (Math.abs(diff) > 10) fails.push(`${E.ksFyLabel(fy)} 連結の貸借が合わない ${diff}`);
  if (c.check !== null && Math.abs(c.check) > 1e5) fails.push(`${E.ksFyLabel(fy)} 連結の利益剰余金のつながりがずれる ${c.check}`);
}
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
function chk(label) { const e = E.ksCheck().concat(E.ksGroupCheck()); if (e.length) fails.push(`${label}: ${e.slice(0, 3).join(' / ')}`); }
function run(n) { for (let i = 0; i < n && !api.G.over; i++) month(); }
function ok(r, what) { if (!r || !r.ok) { fails.push(`${what}: ${r ? r.why : 'なし'}`); console.log('NG', what, r && r.why); return false; } return true; }
const T = w => E.KS_TYPE_LIST.find(x => x.name.includes(w)).name;
const sub = id => E.ksSubById(id);

E.ksNewGame({ units: [{ type: '食品スーパー', sc: 1 }], coName: '株式会社テスト', ceo: 'テスト', seed, custom: { cash: 40e8 } });
let G = api.G;
say('開始', G.coName, '現預金', Y(E.ksB('cash')));
// 1) 合弁60% と 関連会社40%・海外の関連会社（タイ49%）・100%の子会社B・直下の100%子会社M
const jv = E.ksGroupFound({ type: T('婦人服'), sc: 1, own: 0.6, cash: 1.2e8 }); ok(jv, '合弁');
const af = E.ksGroupFound({ type: T('洋食'), sc: 1, own: 0.4, cash: 0.8e8 }); ok(af, '関連会社');
const th = E.ksGroupFound({ type: T('ソフトウェア'), sc: 0.5, own: 0.49, cash: 0.6e8, cc: 'th' }); ok(th, '海外の関連会社');
const B = E.ksGroupFound({ type: T('ソフトウェア'), sc: 1, own: 1, cash: 4e8 }); ok(B, '子会社B');
const M = E.ksGroupFound({ type: T('ラーメン'), sc: 0.5, own: 1, cash: 0.8e8 }); ok(M, '子会社M');
// 2) B の下に孫会社 C（60%）・D（100%）
const C = E.ksGroupFound({ type: T('倉庫'), sc: 0.5, own: 0.6, cash: 0.5e8, owner: B.s.id }); // 工事の会社（資金の出入りが大きい） ok(C, '孫会社C');
const D = E.ksGroupFound({ type: T('弁当'), sc: 0.5, own: 1, cash: 0.5e8 }); ok(D, '子会社D');
chk('設立の直後');
say('会社', E.ksSubs().map(s => `${s.name}[${s.id}${s.parent ? '←' + s.parent : ''} ${Math.round(s.own * 100)}%${s.aff ? ' 持分法' : ''}]`).join(' '));
run(4);
// 3) 期の途中の買い増し：合弁 60%→100%（現金）、関連会社 40%→49%（持分法のまま）
ok(E.ksGroupBuyMore(jv.s.id, 1), '合弁の買い増し');
ok(E.ksGroupBuyMore(af.s.id, 0.49), '関連会社の買い増し');
// D を B の傘下へ（現物出資）
ok(E.ksGroupReparent(D.s.id, B.s.id), 'Dを傘下へ');
// 社名の変更
ok(E.ksGroupRename('root', '株式会社テストホールディングス'), '親会社の社名');
ok(E.ksGroupRename(B.s.id, 'テスト物流株式会社'), '子会社の社名');
chk('再編の直後');
run(6);
// 4) 関連会社 49%→70%（支配を得る：段階取得）、孫会社C 60%→100%（Bが買う）
ok(E.ksGroupBuyMore(af.s.id, 0.7), '段階取得');
ok(E.ksGroupBuyMore(C.s.id, 1), '孫会社の買い増し');
say('段階取得の後', sub(af.s.id).aff ? '持分法のまま' : '連結子会社', 'のれん', Y(sub(af.s.id).gw), '孫会社C', Math.round(sub(C.s.id).own * 100) + '%');
chk('買い増しの直後');
// 親会社の直下の子会社 N を、孫会社 C（B の下・100%）の傘下へ（C が親会社から帳簿の価額で買い取る）
const N = E.ksGroupFound({ type: T('弁当'), sc: 0.5, own: 1, cash: 0.3e8 }); ok(N, '子会社N');
const nInv = N.ok ? E.ksRecInv(sub(N.s.id)) : 0;
const cashC = E.ksWith(sub(C.s.id).st, () => E.ksB('cash'));
if (cashC < nInv * 1.5) ok(E.ksGroupInject(C.s.id, Math.round(nInv * 1.5 - cashC + 1e7)), 'Cへの増資');
const rootCash0 = E.ksB('cash');
ok(E.ksGroupReparent(N.s.id, C.s.id), 'Nを孫会社Cの傘下へ');
say('Nの移動', 'Nの持ち主', sub(N.s.id).parent, '深さ', E.ksRecDepth(sub(N.s.id)), '親会社の現預金', Y(E.ksB('cash') - rootCash0), '（帳簿の価額', Y(nInv), '）');
if (sub(N.s.id).parent !== C.s.id) fails.push('Nが孫会社の傘下に移っていない');
if (Math.abs(E.ksB('cash') - rootCash0 - nInv) > 1) fails.push('親会社が帳簿の価額を受け取っていない');
chk('Nの移動の直後');
run(4);
// 5) 合併の予約：D を兄弟の C に（Bの下）、M を親会社に吸収
ok(E.ksGroupScheduleMerger(D.s.id, C.s.id), '兄弟の合併');
ok(E.ksGroupScheduleMerger(M.s.id, 'root'), '親会社への吸収');
say('合併の予定', JSON.stringify(api.G.group.mergers.map(x => [x.from, x.into, x.mode, E.ymLabel(x.m)])));
run(14);
G = api.G;
say('合併の後', E.ymLabel(G.m), '親会社の事業', E.ksActiveUnits().length, 'M', sub(M.s.id).gone ? sub(M.s.id).out.why : 'live', 'D', sub(D.s.id).gone ? sub(D.s.id).out.why : 'live', 'Cの事業', E.ksWith(sub(C.s.id).st, E.ksActiveUnits).length);
if (!sub(M.s.id).gone || !sub(D.s.id).gone) fails.push('合併が行われていない');
// 6) 合弁を株式交換で… すでに100%なので、新しく 80% の合弁をつくって株式交換
const jv2 = E.ksGroupFound({ type: T('美容'), sc: 0.5, own: 0.8, cash: 0.4e8 }); ok(jv2, '合弁2');
run(2);
ok(E.ksGroupBuyMore(jv2.s.id, 1, { exchange: true }), '株式交換');
run(3);
// 7) B を売る（孫会社Cも一緒に外れる）
const sb = E.ksGroupSell(B.s.id); ok(sb, 'Bの売却');
say('Bの売却', sb.ok ? `${Y(sb.price)}（帳簿 ${Y(sb.carry)}）` : '', 'C', sub(C.s.id).gone ? sub(C.s.id).out.why : 'live');
run(14);
G = api.G;
say('最後', E.ymLabel(G.m), '現預金', Y(E.ksB('cash')), '会社', E.ksSubs().map(s => `${s.name}${s.aff ? '（持分法）' : ''}`).join('・'), G.over ? '倒産' : '');
const fysC = Object.keys(G.group.cons).length;
if (fysC < 2) fails.push('連結決算が2期分ない');
console.log(fails.length ? `NG ${fails.length}件\n` + fails.slice(0, 20).join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
