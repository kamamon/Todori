// 社内の組織（ユニット・部・支店・海外支店）のテスト。
// 組織をつくり（ユニットの下に部、支店、海外支店、よく使う形）、効き目（需要・労災）と重ねがけの上限、
// 方針のレビュー、毎月の費用の仕訳、四半期の定例会、事業の撤退、子会社の組織（自動で承認・評価）を確かめ、
// ボットで15か月動かして帳簿が合うかを毎月見る
//   node test/run_org.js [シード=4]
const { loadKaisha } = require('./load_kaisha');
const E = loadKaisha();
const api = E.__api;
const seed = +(process.argv[2] || 4);
const fails = [];
const say = (...a) => console.log(...a);
const T = w => E.KS_TYPE_LIST.find(x => x.name.includes(w)).name;
const ok = (c, msg) => { if (!c) fails.push(msg); };

E.ksNewGame({ units: [{ type: '食品スーパー', sc: 2 }, { type: T('ラーメン'), sc: 1 }, { type: T('金属部品の切削'), sc: 1 }], coName: 'テスト株式会社', ceo: 'テスト', seed, startGroup: [{ id: 's1', name: '子会社テスト', owner: 'root', own: 1, cc: 'jp', pref: 13, units: [{ type: T('ソフトウェア受託'), sc: 1 }], cond: 'normal' }] });
let G = api.G;
const us = E.ksActiveUnits();

// 1) 組織をつくる
const f0 = { dem0: E.ksDeptF(us[0], 'demand'), acc0: E.ksDeptF(us[2], 'acc') };
ok(f0.dem0 === 1 && f0.acc0 === 1, '組織がないのに倍率が1でない');
const bu = E.ksDeptAdd({ kind: 'bu', name: '小売ユニット', units: [us[0].id] });
const d1 = E.ksDeptAdd({ kind: 'dept', fn: 'biz', parent: bu.id, units: [us[1].id] });
const sf = E.ksDeptAdd({ kind: 'dept', fn: 'safety', units: [us[2].id] });
const hqPref = E.ksDeptHq().pref;
const brPref = hqPref === 13 ? 27 : 13;
const br = E.ksDeptAdd({ kind: 'dept', fn: 'sales', pref: brPref, units: [] });
const ov = E.ksDeptAdd({ kind: 'dept', fn: 'sales', cc: 'th' });
const made = E.ksDeptTemplate('admin');
ok(E.ksDeptKindName(bu) === 'ユニット', 'ユニットの種類の名前');
ok(E.ksDeptKindName(d1) === '部', '本社の部の種類の名前');
ok(E.ksDeptKindName(br) === '支店' && /支店$/.test(br.name), `所在地が違う部が支店にならない：${br.name}`);
ok(E.ksDeptKindName(ov) === '海外支店', '海外の部が海外支店にならない');
ok(made.length === 3, `よく使う形（管理の部）で3つできない：${made.length}`);
ok(E.ksDeptTemplate('admin').length === 0, 'よく使う形を2回押すと重複する');
ok(sf.staff >= 1 && E.ksDeptCostEst(sf).total > 0, '安全管理部の人数か費用がない');
ok(E.ksDeptCostEst(br).rent > 0 && E.ksDeptCostEst(d1).rent === 0, '支店の家賃が出ない（本社の部に家賃が出る）');
// ユニットに事業を入れると、その事業を受け持つ事業部がユニットの下に移る
const d2 = E.ksDeptAdd({ kind: 'dept', fn: 'biz', units: [us[2].id] });
const bu2 = E.ksDeptAdd({ kind: 'bu', name: 'ものづくりユニット', units: [us[2].id] });
ok(E.ksDeptNode(d2.id).parent === bu2.id, '事業部がユニットの下に移らない');
// 1つの事業は1つの事業部だけ
E.ksDeptSetUnits(d1.id, [us[1].id, us[0].id]);
ok(!E.ksDeptNode(bu.id).units.includes(us[0].id) || !E.ksDeptNode(d1.id).units.includes(us[0].id), '1つの事業が2つの事業部に入っている');
E.ksDeptSetUnits(d1.id, [us[1].id]);
E.ksDeptSetUnits(bu.id, [us[0].id]);
// 自分の下の部の下には付けられない
E.ksDeptEdit(bu.id, { parent: d1.id });
ok(E.ksDeptNode(bu.id).parent === null, '自分の下の部に付けられてしまう');
say('組織', E.ksDeptNodes().map(n => `${n.name}[${E.ksDeptKindName(n)}・${E.KS_DEPT_FN[n.fn].n}・${n.staff}人${n.parent ? '←' + E.ksDeptNode(n.parent).name : ''}]`).join(' '));

// 2) 効き目：方針を承認すると効き、重ねがけは上限まで
E.ksDeptApproveAll();
const accF = E.ksDeptF(us[2], 'acc');
ok(accF < 0.95, `安全管理部と安全の方針で労災が減らない：${accF.toFixed(3)}`);
const demBefore = E.ksDeptF(us[0], 'demand');
const extra = [];
for (let i = 0; i < 6; i++) extra.push(E.ksDeptAdd({ kind: 'dept', fn: 'sales', units: [] }));
E.ksDeptApproveAll();
const demStack = E.ksDeptF(us[0], 'demand');
ok(demStack <= 1.6 && demStack < demBefore * 1.25, `営業部を重ねると需要が増えすぎる：${demBefore.toFixed(3)} → ${demStack.toFixed(3)}`);
for (const x of extra) E.ksDeptRemove(x.id);
say('倍率', '労災', accF.toFixed(3), '需要（営業部を7つ）', demStack.toFixed(3));

// 3) 方針のレビュー：作り直し → 承認
const pol0 = E.ksDeptNode(d1.id).pol;
ok(pol0 && pol0.status === 'ok', '承認したのに方針が承認になっていない');
E.ksDeptDraft(E.ksDeptNode(d1.id), E.fyOf(G.m), 'grow');
const r1 = E.ksDeptReview(d1.id, { rate: 'redo', fb: ['basis'] });
ok(r1 && r1.status === 'draft', '作り直しなのに承認になる');
const r2 = E.ksDeptReview(d1.id, { rate: 'good', fb: ['add'] });
ok(r2 && r2.status === 'ok' && E.ksDeptNode(d1.id).pol.add, 'よいで承認できない（指摘が残らない）');
ok(E.ksDeptReview(d1.id, { rate: 'ok' }) === null, '承認済みの方針をまたレビューできる');

// 4) 子会社にも組織（自動で承認・評価）
const sub = E.ksCSubs()[0];
ok(!!sub, '子会社がない');
if (sub) E.ksWith(sub.st, () => { E.ksDeptTemplate('biz'); E.ksDeptAdd({ kind: 'dept', fn: 'hr' }); });

// 5) 15か月動かす
let meets = 0, pend = 0;
const costSeen = new Set();
for (let i = 0; i < 15; i++) {
  G = api.G;
  for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
  E.ksAutoFinance();
  E.ksGroupAdvance();
  G = api.G;
  for (const p of G.pendingModals || []) {
    if (p.type === 'kDeptMeet') {
      meets++;
      const m = G.org.meets.find(x => x.id === p.id);
      ok(m && m.rows.length === E.ksDeptNodes().length, '定例会の行の数が部の数と違う');
      // 1回目は社長が評価（厳しめ）、2回目以降は実績どおり
      const ch = meets === 1 ? Object.fromEntries(m.rows.map(r => [r.id, { rate: 'C', fb: 'cost' }])) : null;
      const res = E.ksDeptMeetResolve(p.id, ch);
      ok(res && res.length === m.rows.length && m.done, '定例会の評価が済まない');
    }
    if (p.type === 'kEvt' && p.choose) E.ksEvtChoose(p.id, 0);
  }
  G.pendingModals = [];
  pend += E.ksDeptPending().length;
  E.ksDeptApproveAll();
  if (G.law) for (const a of G.law.acc) if (a.status === 'new') E.ksLawResolveAccident(a.id, { pay: 'rosai', report: 'report', comp: 'pay', prevent: 'edu' });
  if (G.law) for (const x of E.ksLawTasks()) if (x.st === 'over' || x.st === 'due') E.ksLawDo(x.t.id, { special: true });
  for (const j of G.journal.filter(j => j.m === G.m - 1 || j.m === G.m)) for (const e of j.e || []) if (/^org/.test(e.code || '')) costSeen.add(e.code);
  if (G.closing) E.ksAutoClose();
  // 撤退：6か月目にラーメンの事業をやめる（部の受け持ちから外れる）
  if (i === 6) { const u1 = E.ksUnit(us[1].id); if (u1 && !u1.closedM) { E.ksCloseUnit(u1); ok(!E.ksDeptNode(d1.id).units.includes(us[1].id), '撤退した事業が部の受け持ちに残る'); } }
  const e = E.ksCheck().concat(E.ksGroupCheck());
  if (e.length) fails.push(`${E.ymLabel(G.m)} ${e.slice(0, 3).join(' / ')}`);
}
G = api.G;
ok(meets >= 4, `15か月で定例会が4回より少ない：${meets}`);
ok(G.org.meets.every(m => m.done), '済んでいない定例会がある');
if (sub) {
  const so = sub.st.org;
  ok(so && so.meets.length >= 4 && so.meets.every(m => m.done && m.auto), '子会社の定例会が自動で済まない');
  ok(so && so.nodes.every(n => n.pol && n.pol.status === 'ok'), '子会社の方針が自動で承認されない');
}
// 費用の仕訳（本社費）が出ている
const flows = G.months.slice(-12).reduce((a, x) => { for (const [k, v] of Object.entries(x.flow || {})) a[k] = (a[k] || 0) + v; return a; }, {});
say('12か月', '人件費', Math.round((flows.salary || 0) / 1e4) + '万', '家賃', Math.round((flows.rent || 0) / 1e4) + '万', '定例会', meets, '承認待ちの方針（延べ）', pend, '部長', E.ksDeptNodes().map(n => `${n.head.name}(${n.head.mot})`).join(' '));
for (const c of ['orgStaff', 'orgRent', 'orgAllow', 'orgPol']) ok(costSeen.has(c), `組織の費用の仕訳（${c}）がない`);
say('組織の仕訳', [...costSeen].join(' '));
// 保存して読み込み（JSON）しても倍率が計算できる
const copy = JSON.parse(JSON.stringify(G));
api.G = copy;
const f2 = E.ksDeptF(E.ksActiveUnits()[0], 'demand');
ok(Number.isFinite(f2) && f2 > 0.4 && f2 < 1.6, `読み込んだあとの倍率がおかしい：${f2}`);
ok(E.ksCheck().length === 0, '読み込んだあとの帳簿が合わない');

say(fails.length ? `失敗 ${fails.length}件\n` + fails.slice(0, 20).join('\n') : 'OK');
process.exit(fails.length ? 1 : 0);
