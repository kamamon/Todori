// 組織の管轄と「運営を任せる」、成長の投資をまとめて実施するテスト。
//  ・子会社をユニット・事業部の管轄に置く（1か所だけ）・外す・部をなくすと社長の直轄に戻る
//  ・子会社の経営の担い手（社長が直接・子会社の社長・管轄の組織）と、任せた部長の出来の効き目（腕のよい部長と悪い部長で比べる）
//  ・事業の運営を任せる：部長が毎月、値決めと人の手配を決め直す。任せすぎると出来が落ちる
//  ・管轄の会社の売上が、部の予算と定例会の実績に入る
//  ・投資をまとめて実施（この会社のすべての事業・費用の投資と設備の投資）、グループ全体（会社ごとに自分の資金で）
//  ボットで15か月動かして、帳簿が合うかを毎月見る
//   node test/run_org2.js [シード=6]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const seed = +(process.argv[2] || 6);
const fails = [];
const say = (...a) => console.log(...a);
const ok = (c, msg) => { if (!c) fails.push(msg); };
const T = w => E.KS_TYPE_LIST.find(x => x.name.includes(w)).name;

E.ksNewGame({ units: [{ type: '食品スーパー', sc: 1 }, { type: T('ラーメン'), sc: 1 }, { type: T('金属部品の切削'), sc: 1 }], coName: 'テスト株式会社', ceo: 'テスト', seed,
  startGroup: [
    { id: 's1', name: 'テストソフト', owner: 'root', own: 1, cc: 'jp', pref: 13, units: [{ type: T('ソフトウェア受託'), sc: 1 }], cond: 'normal', cash: 3e8 },
    { id: 's2', name: 'テスト物流', owner: 'root', own: 0.8, cc: 'jp', pref: 13, units: [{ type: T('一般貨物'), sc: 1 }], cond: 'normal' },
    { id: 's3', name: 'テスト関連', owner: 'root', own: 0.3, cc: 'jp', pref: 13, units: [{ type: T('ホテル'), sc: 1 }], cond: 'normal' },
  ] });
let G = api.G;
const us = E.ksActiveUnits();
const subs = E.ksSubs(G);
const s1 = subs.find(x => x.name.startsWith('テストソフト')), s2 = subs.find(x => x.name.startsWith('テスト物流')), s3 = subs.find(x => x.aff);
ok(s1 && s2 && s3, `グループの会社ができていない：${subs.map(x => x.name).join('・')}`);

// 1) 管轄
const bu = E.ksDeptAdd({ kind: 'bu', name: '外食・小売ユニット', units: [us[0].id, us[1].id], subs: [s1.id] });
const mf = E.ksDeptAdd({ kind: 'dept', fn: 'biz', units: [us[2].id] });
const hr = E.ksDeptAdd({ kind: 'dept', fn: 'hr' });
ok(E.ksDeptSubsOf(bu).length === 1 && E.ksDeptSubNode(s1.id, G) === bu, 'ユニットの管轄に子会社が入らない');
E.ksDeptSetSubs(mf.id, [s1.id, s2.id, s3.id]);
ok(E.ksDeptSubsOf(bu).length === 0 && E.ksDeptSubsOf(mf).length === 3, '1つの会社が2か所の管轄に入っている（移らない）');
E.ksDeptSetSubs(hr.id, [s2.id]);
ok(!(hr.subs || []).length, '機能の部（人事部）の管轄に会社が入ってしまう');
E.ksDeptSetSubs(bu.id, [s1.id]);
ok(E.ksDeptSubNode(s1.id, G) === bu && E.ksDeptSubNode(s2.id, G) === mf, '管轄の移し替えがおかしい');

// 2) 経営の担い手
ok(E.ksSubOp(s1, G) === 'ceo', `はじめは子会社の社長に任せているはず：${E.ksSubOp(s1, G)}`);
E.ksSubSetJur(s1.id, bu.id, 'org');
ok(E.ksSubOp(s1, G) === 'org' && s1.auto, '管轄の組織に任せられない');
E.ksSubSetJur(s2.id, mf.id, 'self');
ok(E.ksSubOp(s2, G) === 'self' && !s2.auto, '自分で経営するにできない');
E.ksDeptEdit(mf.id, { runS: true });
ok(E.ksSubOp(s2, G) === 'org' && s2.auto, '事業部の設定で、管轄の子会社をまとめて任せられない');
ok(E.ksSubOp(s3, G) === 'ceo', '関連会社が「任せる」になる');
ok(/任せている/.test(E.ksSubOpName(s1, G)), '担い手の名前');

// 3) 任せた部長の出来の効き目（子会社の中で比べる）
const headF = (skill, mot) => { bu.head.skill = skill; bu.head.mot = mot; E.ksDeptTouch(); E.ksViewEntity(s1.id); const r = { acc: E.ksDeptParentF('acc'), dem: E.ksDeptParentF('demand'), viol: E.ksDeptParentF('viol') }; E.ksViewEntity(null); return r; };
const good = headF(5, 90), bad = headF(1, 20);
ok(good.acc < 1 && bad.acc > 1, `部長の出来で労災が変わらない：よい ${good.acc.toFixed(3)}・悪い ${bad.acc.toFixed(3)}`);
ok(good.dem > bad.dem, `部長の出来で需要が変わらない：${good.dem.toFixed(3)}・${bad.dem.toFixed(3)}`);
bu.head.skill = 3; bu.head.mot = 60; E.ksDeptTouch();
G = api.G;
ok(G === api.G && !G.isSub, '子会社の画面から戻れない');
say('任せた部長の出来', 'よい', JSON.stringify(good), '悪い', JSON.stringify(bad));

// 4) 事業の運営を任せる（金属部品の事業部）
E.ksDeptEdit(mf.id, { runU: true });
ok(E.ksDeptRunnerOf(us[2].id) === mf && !E.ksDeptRunnerOf(us[0].id), '運営を任せた事業の見分けがおかしい');
const u2 = E.ksUnit(us[2].id);
const keyOf = u => (u.op.mode === 'job' ? 'rate' : 'price');
const k2 = keyOf(u2);
u2.op[k2] = Math.round(u2.op[k2] * 0.5); // 社長が勝手に半値にした
const before = u2.op[k2];
// 任せすぎ：受け持ちの上限を超えると出来が落ちる
const rel0 = E.ksDeptRunRel(mf);
mf.head.skill = 1; E.ksDeptTouch();
const cap1 = E.ksDeptRunCap(mf);
ok(cap1 === 5, `腕前1の上限は5のはず：${cap1}`);
mf.head.skill = 3; E.ksDeptTouch();
say('運営を任せた出来', rel0.toFixed(3), '受け持ち', E.ksDeptRunLoad(mf), '上限', E.ksDeptRunCap(mf));

// 5) 15か月：ボットで経営（任せた事業は ksGroupAdvance の中で部長が決める）
let meets = 0, subRow = 0;
for (let i = 0; i < 15; i++) {
  G = api.G;
  for (const u of E.ksActiveUnits()) { if (E.ksDeptRunnerOf(u.id)) continue; G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
  E.ksAutoFinance();
  E.ksGroupAdvance();
  G = api.G;
  if (i === 0) ok(u2.op[k2] !== before && u2.op[k2] > before * 1.3, `運営を任せた事業の値決めが決め直されない：${before} → ${u2.op[k2]}`);
  for (const p of G.pendingModals || []) {
    if (p.type === 'kDeptMeet') {
      meets++;
      const m = G.org.meets.find(x => x.id === p.id);
      const r = m.rows.find(x => x.id === bu.id);
      if (r && r.subS > 0) subRow++;
      E.ksDeptMeetResolve(p.id, null);
    }
    if (p.type === 'kEvt' && p.choose) E.ksEvtChoose(p.id, 0);
  }
  G.pendingModals = [];
  E.ksDeptApproveAll();
  if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
  if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
  if (G.closing) E.ksAutoClose();
  // 6か月目：投資をまとめて実施（費用の投資・設備の投資）
  if (i === 5) {
    const ids = E.ksActiveUnits().map(u => u.id);
    const cash0 = E.ksB('cash');
    const r1 = E.ksUpgApplyMany('design', ids);
    ok(r1.n === 3 && r1.tot > 0 && Math.abs(cash0 - E.ksB('cash') - r1.tot) < 2, `費用の投資をまとめて実施できない：${JSON.stringify(r1)}`);
    ok(ids.every(id => E.ksUpgState(E.KS_UPG_BY.design, E.ksUnit(id))), '3事業すべてに記録されていない');
    const r1b = E.ksUpgApplyMany('design', ids);
    ok(r1b.n === 0, '実施済みの事業にまた実施できてしまう');
    const ppe0 = E.ksB('sw');
    const r2 = E.ksUpgApplyMany('wms', ids);
    ok(r2.n === 3 && E.ksB('sw') - ppe0 >= r2.tot - 2, `設備（ソフトウェア）の投資をまとめて実施できない：${JSON.stringify(r2)}`);
    // グループ全体（親会社と子会社。関連会社は入らない）
    const plan = E.ksUpgGroupPlan('ai');
    ok(plan.length >= 2 && plan.some(p => p.id === s1.id) && !plan.some(p => p.id === s3.id), `グループ全体の計画がおかしい：${plan.map(p => p.name).join('・')}`);
    const subCash0 = E.ksWith(s1.st, () => E.ksB('cash'));
    const r3 = E.ksUpgGroupApply('ai');
    // 資金の足りない会社は見送る（ここでは親会社がまとめて投資した直後なので、見送られることがある）
    ok(r3.n >= 1 && r3.done.some(p => p.id === s1.id) && r3.done.length + r3.skip.length === plan.length && r3.skip.every(p => !p.ok), `グループ全体に実施できない：${JSON.stringify({ n: r3.n, done: r3.done.map(p => p.name), skip: r3.skip.map(p => p.name) })}`);
    ok(E.ksWith(s1.st, () => E.ksB('cash')) < subCash0, '子会社が自分の資金で払っていない');
    ok(E.ksWith(s1.st, () => E.ksActiveUnits().every(u => E.ksUpgState(E.KS_UPG_BY.ai, u))), '子会社の事業に記録されていない');
    say('まとめて実施', '費用', r1.tot, '設備', r2.tot, 'グループ', r3.tot, `${r3.done.length}社`, r3.skip.length ? `見送り ${r3.skip.map(p => p.name).join('・')}` : '');
  }
  const e = E.ksCheck().concat(E.ksGroupCheck());
  if (e.length) fails.push(`${E.ymLabel(G.m)} ${e.slice(0, 3).join(' / ')}`);
}
ok(meets >= 4, `定例会が少ない：${meets}`);
ok(subRow >= 1, '管轄の会社の売上が、定例会の実績に入っていない');
ok(E.ksDeptNode(bu.id).pol.budS > E.ksWith(G, () => 0), 'ユニットの売上の予算がない');

// 6) 受け持ちの入れ子：ユニットの下の事業部は、ユニットが選んだ事業と会社の中から選ぶ
{
  G = api.G;
  const u = E.ksActiveUnits().map(x => x.id); // 食品スーパー・金属部品（ラーメンは撤退していない。3つ）
  const selBu0 = E.ksDeptSel(bu);
  ok(selBu0.length >= 1, 'ユニットの選んだ事業がない');
  const inBu = selBu0[0];
  const outBu = u.find(x => !selBu0.includes(x));
  const child = E.ksDeptAdd({ kind: 'dept', fn: 'biz', parent: bu.id, units: [inBu, outBu].filter(Boolean), subs: [s1.id, s2.id] });
  ok(child.units.includes(inBu), 'ユニットが選んだ事業を、下の事業部で選べない');
  ok(!outBu || !child.units.includes(outBu), 'ユニットが選んでいない事業を、下の事業部で選べてしまう');
  ok(E.ksDeptSel(bu).includes(inBu) && !(bu.units || []).includes(inBu), 'ユニットの選んだ事業から外れた／ユニットが直接持ったまま');
  ok(child.subs.includes(s1.id) && !child.subs.includes(s2.id), `ユニットの管轄の会社の中からだけ選べるはず：${child.subs.join(',')}`);
  ok(E.ksDeptSelSubs(bu).includes(s1.id), 'ユニットの管轄（下の部も合わせて）から会社が消えた');
  // 事業部の下の部も同じ：事業部が選んだ事業の中から
  const grand = E.ksDeptAdd({ kind: 'dept', fn: 'biz', parent: child.id, units: [inBu, outBu].filter(Boolean) });
  ok(grand.units.includes(inBu) && (!outBu || !grand.units.includes(outBu)), '事業部の下の部が、事業部の選んだ事業の外から選べてしまう');
  ok(E.ksDeptHolderOf(inBu) === grand && E.ksDeptSel(child).includes(inBu) && E.ksDeptSel(bu).includes(inBu), '入れ子の受け持ちがおかしい');
  // 上の組織で外すと、下の部からも外れる
  E.ksDeptEdit(child.id, { units: [] });
  ok(!grand.units.includes(inBu) && !E.ksDeptSel(child).includes(inBu) && (bu.units || []).includes(inBu), '事業部で外した事業が、下の部に残る／ユニットに戻らない');
  // 事業を1つ、別の組織へ移す（ユニットから金属部品の事業部へ）
  ok(E.ksDeptMoveUnit(inBu, mf.id) && E.ksDeptHolderOf(inBu) === mf && !E.ksDeptSel(bu).includes(inBu), '事業をユニットから別の事業部へ移せない');
  // 部ごと移す：事業部をユニットから外へ（社長の直下へ）→ 事業と会社も一緒に移る
  E.ksDeptMoveUnit(inBu, child.id);
  ok(E.ksDeptSel(bu).includes(inBu), 'ユニットの下の事業部に事業を戻せない');
  ok(E.ksDeptMove(child.id, null), '事業部を社長の直下へ移せない');
  ok(!E.ksDeptSel(bu).includes(inBu) && E.ksDeptSel(child).includes(inBu) && !E.ksDeptSelSubs(bu).includes(s1.id), '部ごと移したのに、事業や会社が元のユニットに残る');
  ok(!E.ksDeptMove(bu.id, bu.id) && !E.ksDeptMove(child.id, grand.id), '自分や自分の下の部へ移せてしまう');
  // ユニットへ移す → ユニットの受け持ちに加わる
  ok(E.ksDeptMove(child.id, bu.id) && E.ksDeptSel(bu).includes(inBu) && E.ksDeptSelSubs(bu).includes(s1.id), '事業部をユニットへ移しても、ユニットの受け持ちに加わらない');
  // 下の部をなくすと、直接持っていた事業と会社は上の組織に戻る
  E.ksDeptRemove(grand.id); E.ksDeptRemove(child.id);
  ok((bu.units || []).includes(inBu) && (bu.subs || []).includes(s1.id), '下の部をなくしても、事業と会社がユニットに戻らない');
  const e = E.ksCheck();
  ok(!e.length, '入れ子の操作のあと帳簿が合わない');
  say('入れ子', 'ユニットの選択', E.ksDeptSel(bu).length, '会社', E.ksDeptSelSubs(bu).length);
}

// 7) 部をなくすと、管轄の会社は社長の直轄に戻る（任せていた子会社は、子会社の社長が経営）
E.ksDeptRemove(bu.id);
ok(!E.ksDeptSubNode(s1.id, G) && E.ksSubOp(s1, G) === 'ceo', 'ユニットをなくしても管轄が残る／任せたまま');
// 保存して読み込み（JSON）しても動く
const copy = JSON.parse(JSON.stringify(G));
api.G = copy;
ok(E.ksSubOp(E.ksSubById(s2.id, copy), copy) === 'org', '読み込んだあとに担い手が変わる');
ok(E.ksCheck().length === 0, '読み込んだあとの帳簿が合わない');

say(fails.length ? `失敗 ${fails.length}件\n` + fails.slice(0, 20).join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
