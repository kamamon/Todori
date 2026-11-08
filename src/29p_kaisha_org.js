'use strict';
/* =========================================================
 *  29p_kaisha_org.js : 社内の組織（ユニット・部・支店・海外支店）と、部長の方針・レビュー・四半期の定例会
 *   ・組織の木：社長の下に、ユニット（事業本部）と部をいくつでも、何段でも置ける。部だけでもよい
 *   ・部の役割：「事業」（受け持つ事業を回す事業部）か、営業・人事・安全管理・品質保証などの機能
 *   ・所在地が本社と違う部は支店（海外なら海外支店）。人件費と事務所の家賃は所在地で変わる
 *   ・部長（ユニット長・支店長）は毎年4月に方針を立てる。社長はレビューで評価と指摘をする
 *   ・四半期ごと（6・9・12・3月の末）に定例会：予算と方針の進み具合を確かめ、部長を評価する
 *   ・効果：機能の部の人数・部長の力とやる気・方針で、需要・離職・労災・ロス・不祥事などの倍率が変わる
 *   ・費用：機能の部の人件費（研究開発は研究開発費）、支店の事務所の家賃、役職手当、方針の取り組みの費用（本社費）
 *   ・受け持ちは入れ子：ユニットや事業部の下につくる部は、上の組織が選んだ事業と会社の中から選ぶ（上の組織の受け持ちは、
 *     自分が直接持つ分と下の部に渡した分を合わせたもの）。部ごと・事業ごと・会社ごとに、別の組織へ移せる
 *   ・子会社の管轄：ユニットと事業部の下に、グループの会社（子会社・孫会社・関連会社）を置ける。売上は部の実績に入る
 *   ・運営を任せる：受け持つ事業の値決め・人の手配を部長が毎月決める。管轄の子会社の経営も任せられる。
 *     出来は部長の腕前とやる気しだいで、任せる先が多すぎると目が届かなくなる
 *   （画面は 29q_kaisha_org_ui.js）
 * ========================================================= */

const KS_DEPT_KIND = { bu: { n: 'ユニット', head: 'ユニット長', allow: 10e4 }, dept: { n: '部', head: '部長', allow: 5e4 } };
/* 部の役割。ratio：受け持つ人数に対して要る人数（1人あたり）。eff：効き目の最大（人数が足り、部長が並のとき） */
const KS_DEPT_FN = {
  biz: { n: '事業', d: '受け持つ事業を回す事業部。人は事業の人員なので、部としての人件費は役職手当だけ', ratio: 0 },
  sales: { n: '営業', d: '受け持つ事業（なければ会社の全事業）のお客を増やす。海外支店なら輸出の需要を開く', ratio: 1 / 30, eff: { demand: 0.05 } },
  pr: { n: '広報・マーケティング', d: '会社の評判を高め、お客と採用の応募を増やす', ratio: 1 / 150, eff: { demand: 0.02, hire: -0.06 } },
  plan: { n: '経営企画', d: '予算と方針の管理を支える。すべての部の方針の効き目が上がる', ratio: 1 / 200, boost: 0.12 },
  acct: { n: '経理・財務', d: '数字を正しく早くまとめ、銀行との関係を保つ。不正を防ぐ', ratio: 1 / 70, eff: { viol: -0.1 }, bank: true },
  admin: { n: '総務', d: '職場の環境と災害への備え、社内の手続きを担う', ratio: 1 / 90, eff: { bcp: -0.15, viol: -0.05 } },
  hr: { n: '人事', d: '採用・育成・評価を担い、離職と採用の費用を減らす', ratio: 1 / 90, eff: { quit: -0.15, hire: -0.15 } },
  safety: { n: '安全管理', d: '現場の危険を見つけて減らす。労災が減る', ratio: 1 / 70, eff: { acc: -0.3 } },
  quality: { n: '品質保証', d: '検査と品質の仕組みをつくる。不良・ロス・食中毒が減る', ratio: 1 / 60, eff: { shrink: -0.12, food: -0.35 } },
  legal: { n: '法務・コンプライアンス', d: '契約と法令を確かめる。不祥事と法令違反が減る', ratio: 1 / 200, eff: { viol: -0.3 } },
  it: { n: '情報システム', d: '社内のシステムと情報の守りを担う。情報の漏えいとサイバー攻撃が減る', ratio: 1 / 120, eff: { leak: -0.35 } },
  rnd: { n: '研究開発', d: '新しい製品・サービスをつくる。需要が伸びる（人件費は研究開発費になる）', ratio: 1 / 40, eff: { demand: 0.035 }, acct: 'rnd' },
  tech: { n: '技術・設計', d: '設備と工程を改善する。電気代・燃料費・ロスが減る', ratio: 1 / 50, eff: { energy: -0.08, fuel: -0.06, shrink: -0.05 } },
  buy: { n: '調達・購買', d: '仕入先と交渉し、まとめて買う。仕入の割戻しを受けられる', ratio: 1 / 100, rebate: 0.006 },
};
/* 方針のテーマ。eff は方針が承認され、部長が並のときの効き目。costR は受け持つ事業の売上に対する取り組みの費用 */
const KS_DEPT_THEME = {
  grow: { n: '売上を伸ばす', kpi: 'sales', eff: { demand: 0.04 }, costR: 0.004, acct: 'ads', acts: ['主なお客への提案を増やす', '販促の企画を毎月打つ', '新しい商品・サービスを1つ出す', 'しばらく取引のないお客に連絡する', '紹介でお客が増える仕組みをつくる', '値上げに見合う付加価値を説明する'] },
  newmkt: { n: '新しいお客・市場を開く', kpi: 'sales', eff: { demand: 0.035 }, costR: 0.006, acct: 'ads', ramp: 6, acts: ['新しい地域に営業をかける', 'ネットでの販売を始める', '展示会に出る', '新しい業界のお客を開拓する', '代理店と組む', '海外のお客を探す'] },
  cost: { n: '費用を下げる', kpi: 'cost', eff: { energy: -0.06, fuel: -0.05, shrink: -0.06, demand: -0.005 }, costR: 0, acts: ['仕入先を見直して相見積をとる', '電気の使い方を見直す', 'ムダな作業をなくす', '在庫を減らして廃棄を防ぐ', '外注を内製に切り替える', '会議と書類を減らす'] },
  quality: { n: '品質を上げる', kpi: 'quality', eff: { shrink: -0.08, food: -0.25, demand: 0.01 }, costR: 0.002, acct: 'fees', acts: ['検査の手順を標準にする', '不良の原因を毎週話し合う', 'お客の声を集めて直す', '衛生の点検を増やす', '品質の資格を取る', '仕入先の品質を監査する'] },
  safety: { n: '安全を第一に', kpi: 'acc', eff: { acc: -0.25, ot: -0.04 }, costR: 0.0015, acct: 'safety', acts: ['ヒヤリハットを集めて対策する', '危険予知の訓練を毎朝する', '設備の安全カバーを付ける', '残業を減らして疲れをためない', '安全の巡回を月2回する', '新人に安全教育をする'] },
  people: { n: '人を育てて定着させる', kpi: 'people', eff: { quit: -0.12, hire: -0.06 }, costR: 0.002, acct: 'recruit', acts: ['1対1の面談を毎月する', '研修の計画をつくる', '資格の取得を支える', '仕事の分担を見直す', '若手の相談役（メンター）を付ける', '評価の基準をはっきりさせる'] },
  comply: { n: '守りを固める（法令・情報）', kpi: 'viol', eff: { viol: -0.2, leak: -0.2 }, costR: 0.001, acct: 'fees', acts: ['法令の点検表をつくる', '情報の持ち出しを管理する', '契約書を確かめる手順をつくる', '内部通報の窓口を知らせる', 'ハラスメントの研修をする', 'パスワードと端末を管理する'] },
};
const KS_DEPT_FN_THEME = { biz: 'grow', sales: 'grow', pr: 'grow', plan: 'cost', acct: 'comply', admin: 'cost', hr: 'people', safety: 'safety', quality: 'quality', legal: 'comply', it: 'comply', rnd: 'newmkt', tech: 'cost', buy: 'cost' };
const KS_DEPT_STYLE = { aggr: { n: '攻め', bias: 6, self: 1, d: '高い目標を立てがち。押しが強い' }, solid: { n: '堅実', bias: 1, self: 0, d: '実現できる目標を立てる' }, careful: { n: '慎重', bias: -3, self: -1, d: '低めの目標を立てがち。失敗を嫌う' } };
const KS_DEPT_GRADES = ['S', 'A', 'B', 'C', 'D'];
const KS_DEPT_FB = {
  up: { n: '目標をもっと高く', d: '目標が低すぎるとき' },
  down: { n: '目標を現実的に', d: '目標が高すぎるとき' },
  cut: { n: '費用を削って', d: '取り組みの費用を3割減らす（効き目も少し下がる）' },
  add: { n: '安全と品質も入れて', d: '労災とロスを減らす取り組みを加える（費用が少し増える）' },
  basis: { n: '数字の根拠を示して', d: '計画の質が上がる' },
};
const KS_DEPT_MEET_FB = {
  keep: { n: 'この調子で', d: '部長のやる気が少し上がる' },
  sales: { n: '売上を立て直して', d: '次の四半期、需要に力を入れる（費用が増える）' },
  cost: { n: '費用を抑えて', d: '次の四半期、取り組みの費用を減らす' },
  safety: { n: '安全を最優先に', d: '次の四半期、労災を減らす取り組みを強める' },
  people: { n: '人を育てて', d: '次の四半期、離職を減らす取り組みを強める' },
};
const KS_DEPT_SURN = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '松本', '井上', '木村', '林', '清水', '山口', '森', '池田', '橋本', '石川', '前田', '藤田', '岡田', '後藤', '長谷川', '村上', '近藤'];
const KS_DEPT_GIVEN = ['健一', '誠', '大輔', '直樹', '恵子', '美穂', '裕子', '浩二', '亮', '彩', '智子', '修', '翔太', '由美', '拓也', '真一', '香織', '剛', '陽子', '和也', '千尋', '隆', '舞', '悠', '洋平'];

function ksDeptInit() {
  if (!G.org) G.org = { seq: 0, nodes: [], meets: [], qa: {} };
  return G.org;
}
function ksDeptNodes() { return (G && G.org && G.org.nodes) || []; }
function ksDeptNode(id) { return ksDeptNodes().find(n => n.id === id) || null; }
function ksDeptKids(id) { return ksDeptNodes().filter(n => (n.parent || null) === (id || null)); }
function ksDeptHq() { return { pref: G.loc ? G.loc.hq : KS_HOME_PREF, cc: 'jp' }; }
/* 支店か（所在地が本社と違う部）・海外支店か */
function ksDeptIsBranch(n) { return n.kind === 'dept' && ((n.cc || 'jp') !== 'jp' || (+n.pref && +n.pref !== ksDeptHq().pref)); }
function ksDeptKindName(n) { return n.kind === 'bu' ? 'ユニット' : (n.cc || 'jp') !== 'jp' ? '海外支店' : ksDeptIsBranch(n) ? '支店' : '部'; }
function ksDeptHeadTitle(n) { return n.kind === 'bu' ? 'ユニット長' : ksDeptIsBranch(n) ? '支店長' : '部長'; }
function ksDeptPlace(n) {
  if ((n.cc || 'jp') !== 'jp' && typeof KS_COUNTRIES !== 'undefined' && KS_COUNTRIES[n.cc]) return KS_COUNTRIES[n.cc].n;
  const p = +n.pref || ksDeptHq().pref;
  return KS_PREFS[p] ? KS_PREFS[p].n : '';
}
function ksDeptNewHead() {
  return { name: `${pick(KS_DEPT_SURN)} ${pick(KS_DEPT_GIVEN)}`, skill: randInt(2, 5), style: pick(['aggr', 'solid', 'solid', 'careful']), mot: randInt(55, 72), since: G.m };
}
/* 受け持つ事業：部に割り当てた事業。なければ、上のユニット・部の事業。どこにもなければ会社の全事業 */
function ksDeptOwnUnits(n) { const live = new Set(ksActiveUnits().map(u => u.id)); return (n.units || []).filter(id => live.has(id)); }
function ksDeptSubtreeUnits(n) {
  const out = new Set(ksDeptOwnUnits(n));
  const walk = id => { for (const k of ksDeptKids(id)) { for (const x of ksDeptOwnUnits(k)) out.add(x); walk(k.id); } };
  walk(n.id);
  return [...out];
}
function ksDeptScope(n) {
  for (let p = n, i = 0; p && i < 200; i++) {
    const us = ksDeptSubtreeUnits(p);
    if (us.length) return { units: us, all: false };
    p = p.parent ? ksDeptNode(p.parent) : null;
  }
  return { units: ksActiveUnits().map(u => u.id), all: true };
}
function ksDeptScopeHead(sc) { return sum(sc.units.map(id => ksUnit(id)).filter(Boolean), ksUnitHead); }
/* ---------- 受け持ちの入れ子（ユニット・事業部が選んだ事業と会社を、下の部に分ける） ---------- */
/* 事業と会社を受け持つ組織：ユニットと事業部 */
function ksDeptIsHolder(n) { return !!n && (n.kind === 'bu' || n.fn === 'biz'); }
/* いちばん近い上の、受け持つ組織（ユニット・事業部）。途中に機能の部があっても飛ばす */
function ksDeptHolderParent(n) {
  for (let p = n && n.parent ? ksDeptNode(n.parent) : null, i = 0; p && i < 200; i++) { if (ksDeptIsHolder(p)) return p; p = p.parent ? ksDeptNode(p.parent) : null; }
  return null;
}
/* 自分と、自分の下の部（全部の段）の id */
function ksDeptBelowIds(id) {
  const below = new Set([id]);
  let grew = true;
  while (grew) { grew = false; for (const o of ksDeptNodes()) if (!below.has(o.id) && below.has(o.parent)) { below.add(o.id); grew = true; } }
  return below;
}
/* 選んだ事業（自分が直接持つ事業と、下の部に渡した事業） */
function ksDeptSel(n) { return n ? ksDeptSubtreeUnits(n) : []; }
/* 選んだ会社（自分が直接持つ会社と、下の部に渡した会社） */
function ksDeptSelSubs(n) {
  if (!n) return [];
  const below = ksDeptBelowIds(n.id);
  const out = [];
  for (const o of ksDeptNodes()) if (below.has(o.id)) for (const x of o.subs || []) if (!out.includes(x)) out.push(x);
  const live = new Set(G.group ? ksSubs(G).map(x => x.id) : []);
  return out.filter(x => live.has(x));
}
/* 選べる事業：上に受け持つ組織があれば、その組織が選んだ事業だけ（いまの自分の事業は残せる）。なければ会社の全事業 */
function ksDeptAllowedUnits(n, cur) {
  const P = ksDeptHolderParent(n);
  if (!P) return ksActiveUnits().map(u => u.id);
  return [...new Set([...ksDeptSel(P), ...(cur || [])])];
}
function ksDeptAllowedSubs(n, cur) {
  if (!G.group || G.isSub) return [];
  const P = ksDeptHolderParent(n);
  if (!P) return ksSubs(G).map(x => x.id);
  return [...new Set([...ksDeptSelSubs(P), ...(cur || [])])];
}
/* 事業を直接持っている組織（ユニット・事業部。1つの事業は1か所だけ） */
function ksDeptHolderOf(uid) { return ksDeptNodes().find(n => ksDeptIsHolder(n) && (n.units || []).includes(uid)) || null; }
/* 機能の部の受け持ち（範囲）を、上の受け持つ組織が選んだ事業の中に収める */
function ksDeptNormalize() {
  for (const n of ksDeptNodes()) {
    if (ksDeptIsHolder(n) || !(n.units || []).length) continue;
    const P = ksDeptHolderParent(n);
    if (!P) continue;
    const ok = new Set(ksDeptSel(P));
    n.units = n.units.filter(x => ok.has(x));
  }
}
/* 受け持ちを決める（入れ子）：list が、この組織が選ぶ事業になる。
   ・上に受け持つ組織があれば、その組織が選んだ事業の中からだけ選べる
   ・外した事業：下の部からも外れ、上の受け持つ組織の直接の受け持ちに戻る（上がなければ、どこにも入らない）
   ・加えた事業：いま持っている組織から移る。ユニットなら、その事業を持つ事業部ごと、ユニットの下に移す
   ・機能の部（営業・人事など）は、効き目の範囲を決めるだけ（ほかの部から事業を取らない） */
function ksDeptSetSel(id, list) {
  const n = ksDeptNode(id);
  if (!n) return;
  const live = new Set(ksActiveUnits().map(u => u.id));
  const cur = ksDeptSel(n);
  let want = [...new Set(list || [])].filter(x => live.has(x));
  const allowed = new Set(ksDeptAllowedUnits(n, cur));
  want = want.filter(x => allowed.has(x));
  if (!ksDeptIsHolder(n)) { n.units = want; ksDeptTouch(); return; }
  const P = ksDeptHolderParent(n);
  const below = ksDeptBelowIds(n.id);
  // 外した事業
  for (const x of cur) {
    if (want.includes(x)) continue;
    for (const o of ksDeptNodes()) if (below.has(o.id)) o.units = (o.units || []).filter(y => y !== x);
    if (P && !(P.units || []).includes(x)) P.units = [...(P.units || []), x];
  }
  // 加えた事業
  const ups = new Set();
  for (let p = n.parent ? ksDeptNode(n.parent) : null, i = 0; p && i < 200; i++) { ups.add(p.id); p = p.parent ? ksDeptNode(p.parent) : null; }
  for (const x of want) {
    if (cur.includes(x)) continue;
    const h = ksDeptHolderOf(x);
    if (n.kind === 'bu' && h && h.kind === 'dept' && !ups.has(h.id) && !below.has(h.id)) {
      // その事業を持つ事業部ごと、このユニットの下に移す（事業部のほかの事業も一緒に）
      h.parent = n.id;
      for (const k of ksDeptBelowIds(h.id)) below.add(k);
      continue;
    }
    if (h) h.units = h.units.filter(y => y !== x);
    n.units = [...(n.units || []), x];
  }
  ksDeptNormalize();
  ksDeptTouch();
}
/* 管轄の会社を決める（入れ子。事業と同じ決まり） */
function ksDeptSetSubSel(id, list) {
  const n = ksDeptNode(id);
  if (!n) return;
  if (!ksDeptCanHold(n)) { n.subs = []; ksDeptTouch(); return; }
  const cur = ksDeptSelSubs(n);
  const allowed = new Set(ksDeptAllowedSubs(n, cur));
  const want = [...new Set(list || [])].filter(x => allowed.has(x));
  const P = ksDeptHolderParent(n);
  const below = ksDeptBelowIds(n.id);
  for (const x of cur) {
    if (want.includes(x)) continue;
    for (const o of ksDeptNodes()) if (below.has(o.id)) o.subs = (o.subs || []).filter(y => y !== x);
    if (P && ksDeptCanHold(P) && !(P.subs || []).includes(x)) P.subs = [...(P.subs || []), x];
  }
  for (const x of want) {
    if (cur.includes(x)) continue;
    for (const o of ksDeptNodes()) if (o.subs) o.subs = o.subs.filter(y => y !== x);
    n.subs = [...(n.subs || []), x];
  }
  ksDeptTouch();
}
/* ---------- 移す ---------- */
/* 部（ユニット）ごと、別の組織の下へ移す。受け持つ事業と管轄の会社も一緒に移る（元の組織の受け持ちから外れ、移した先の受け持ちに加わる） */
function ksDeptMove(id, parentId) {
  const n = ksDeptNode(id);
  if (!n) return false;
  const below = ksDeptBelowIds(n.id);
  const to = parentId ? ksDeptNode(parentId) : null;
  if (parentId && (!to || below.has(parentId))) return false;
  n.parent = to ? to.id : null;
  ksDeptNormalize();
  ksDeptTouch();
  return true;
}
/* 事業を1つ、別の組織（ユニット・事業部）へ移す。toId がなければ、どこにも入れない（社長の直下） */
function ksDeptMoveUnit(uid, toId) {
  const to = toId ? ksDeptNode(toId) : null;
  if (toId && !ksDeptIsHolder(to)) return false;
  if (!ksUnit(uid)) return false;
  for (const o of ksDeptNodes()) if (ksDeptIsHolder(o)) o.units = (o.units || []).filter(y => y !== uid);
  if (to) to.units = [...(to.units || []), uid];
  ksDeptNormalize();
  ksDeptTouch();
  return true;
}
/* 部長の力：腕前（1〜5）とやる気（0〜100） */
function ksDeptHeadF(n) { const h = n.head || { skill: 3, mot: 60 }; return (0.8 + 0.06 * h.skill) * (0.85 + 0.3 * h.mot / 100); }
/* 機能の部の強さ：要る人数に対する人数の割合（逓減）× 部長の力 */
function ksDeptNeed(n) { const F = KS_DEPT_FN[n.fn]; if (!F || !F.ratio) return 0; return Math.max(1, Math.round(ksDeptScopeHead(ksDeptScope(n)) * F.ratio)); }
function ksDeptStrength(n) {
  const F = KS_DEPT_FN[n.fn];
  if (!F || !F.ratio) return 0;
  const c = (n.staff || 0) / ksDeptNeed(n);
  const base = c <= 1 ? Math.pow(c, 0.8) : 1 + Math.min(0.5, (c - 1) * 0.25);
  return base * ksDeptHeadF(n);
}
/* 経営企画の部があると、すべての方針の効き目が上がる */
function ksDeptPlanBoost() { return sum(ksDeptNodes().filter(n => n.fn === 'plan'), n => KS_DEPT_FN.plan.boost * Math.min(1.2, ksDeptStrength(n))); }
/* 方針の効き目の倍率 */
function ksDeptPolF(n) {
  const P = n.pol;
  if (!P || P.fy !== fyOf(G.m)) return 0;
  let f = (P.status === 'ok' ? 1 : 0.4) * ksDeptHeadF(n) * (P.q || 1) * (1 + ksDeptPlanBoost());
  if (P.target < P.ideal - 4) f *= 0.85; // 低すぎる目標は、取り組みがゆるむ
  if (P.cut) f *= 0.92;
  const T = KS_DEPT_THEME[P.theme];
  if (T && T.ramp) f *= clamp((G.m - (P.m ?? G.m) + 1) / T.ramp, 0.2, 1);
  return f;
}
/* 効き目の倍率（ksHrF に掛ける）。u がなければ会社全体の倍率。
   同じ役割の部・同じテーマの方針がいくつあっても、効き目は合わせて1.3倍分まで（重ねがけで際限なく効かないように）。
   部の範囲と強さは、月と組織の形が同じあいだ覚えておく（計算を軽くする） */
const KS_DEPT_CACHE = new WeakMap();
function ksDeptCalc() {
  const O = G.org;
  const key = `${G.m}|${O.ver || 0}|${ksActiveUnits().length}|${ksHeadcount()}`;
  const hit = KS_DEPT_CACHE.get(O);
  if (hit && hit.key === key) return hit;
  const head = Math.max(1, ksHeadcount());
  const items = O.nodes.map(n => {
    const sc = ksDeptScope(n);
    return { n, set: new Set(sc.units), share: sc.all ? 1 : ksDeptScopeHead(sc) / head, s: ksDeptStrength(n), pf: ksDeptPolF(n) };
  });
  // 運営を任せた事業：任せた部の部長の出来
  const run = new Map();
  if (O.nodes.some(n => n.runU)) for (const u of ksActiveUnits()) { const r = ksDeptRunnerOf(u.id); if (r) run.set(u.id, ksDeptRunRel(r)); }
  const c = { key, items, run };
  KS_DEPT_CACHE.set(O, c);
  return c;
}
function ksDeptTouch() { if (G && G.org) G.org.ver = (G.org.ver || 0) + 1; }
function ksDeptF(u, key) {
  const O = G && G.org;
  if (!O || !O.nodes.length) return 1;
  const { items, run } = ksDeptCalc();
  const fnS = {}, thS = {};
  let f = 1;
  if (u && run.has(u.id) && KS_DEPT_RUN_EFF[key] !== undefined) f *= 1 + KS_DEPT_RUN_EFF[key] * run.get(u.id);
  for (const it of items) {
    const n = it.n;
    const w = u ? (it.set.has(u.id) ? 1 : 0) : it.share;
    if (!w) continue;
    const F = KS_DEPT_FN[n.fn];
    if (F && F.eff && F.eff[key] !== undefined && it.s) {
      let k = 1;
      if (key === 'demand' && n.fn === 'sales' && (n.cc || 'jp') !== 'jp' && u && !['mfg', 'trade', 'pro', 'subs'].includes(ksS(u).eng)) k = 0.3; // 海外支店の営業は、輸出できる事業に効く
      fnS[n.fn] = (fnS[n.fn] || 0) + it.s * w * k;
    }
    const P = n.pol, T = P && KS_DEPT_THEME[P.theme];
    if (T && it.pf && T.eff[key] !== undefined) thS[P.theme] = (thS[P.theme] || 0) + it.pf * w;
    if (P && it.pf && P.add) { if (key === 'acc') f *= 1 - 0.08 * Math.min(1, it.pf) * w; if (key === 'shrink') f *= 1 - 0.04 * Math.min(1, it.pf) * w; }
    // 定例会の指摘（次の四半期）
    const B = P && P.fb2 && P.fb2.until >= G.m ? P.fb2.k : null;
    if (B === 'sales' && key === 'demand') f *= 1 + 0.015 * w;
    if (B === 'cost' && (key === 'energy' || key === 'shrink')) f *= 1 - 0.03 * w;
    if (B === 'safety' && key === 'acc') f *= 1 - 0.1 * w;
    if (B === 'people' && key === 'quit') f *= 1 - 0.06 * w;
    // 高すぎる目標を押し付けると、残業と労災が増える
    if (P && P.fy === fyOf(G.m) && P.status === 'ok' && P.target > P.ideal + 6) { if (key === 'ot') f *= 1 + 0.08 * w; if (key === 'acc') f *= 1 + 0.05 * w; }
  }
  for (const [fn, s] of Object.entries(fnS)) f *= 1 + KS_DEPT_FN[fn].eff[key] * Math.min(1.3, s);
  for (const [th, s] of Object.entries(thS)) f *= 1 + KS_DEPT_THEME[th].eff[key] * Math.min(1.3, s);
  return clamp(f, 0.4, 1.6);
}

/* ---------- 部の費用（1か月） ---------- */
function ksDeptWageF(n) {
  const cc = n.cc || 'jp';
  if (cc !== 'jp' && typeof KS_COUNTRIES !== 'undefined' && KS_COUNTRIES[cc]) {
    const C = KS_COUNTRIES[cc];
    return clamp((C.wk || 1500) * (G.eco.fx || 148) / 30e4, 0.15, 2.5);
  }
  const P = KS_PREFS[+n.pref || ksDeptHq().pref], H = KS_PREFS[ksDeptHq().pref];
  return P && H ? clamp(P.mw / H.mw, 0.8, 1.3) : 1;
}
function ksDeptRentF(n) {
  const cc = n.cc || 'jp';
  if (cc !== 'jp') return 0.8;
  const P = KS_PREFS[+n.pref || ksDeptHq().pref];
  return P && P.land ? clamp(Math.sqrt(P.land.com / 30e4), 0.5, 3) : 1;
}
function ksDeptCost(n) {
  const out = { staff: 0, rent: 0, allow: 0, pol: 0 };
  const w = (typeof ksHrAvgWage === 'function' ? ksHrAvgWage() : 30e4) * 1.1;
  if (KS_DEPT_FN[n.fn] && KS_DEPT_FN[n.fn].ratio) out.staff = Math.round((n.staff || 0) * w * ksDeptWageF(n) * (1 + 2 / 12) * 1.15);
  if (ksDeptIsBranch(n)) out.rent = Math.round((20e4 + (n.staff || 0) * 3e4) * ksDeptRentF(n));
  out.allow = Math.round(KS_DEPT_KIND[n.kind].allow * 1.15);
  const P = n.pol, T = P && KS_DEPT_THEME[P.theme];
  if (T && T.costR && P.fy === fyOf(G.m)) {
    const s = sum(ksDeptScope(n).units, id => (((G.flowU || {})[id] || {}).sales || 0));
    out.pol = Math.round(s * (T.costR + (P.add ? 0.001 : 0)) * (P.cut ? 0.7 : 1) * (P.fb2 && P.fb2.until >= G.m ? (P.fb2.k === 'cost' ? 0.6 : P.fb2.k === 'sales' ? 1.2 : 1) : 1) * (P.status === 'ok' ? 1 : 0.5));
  }
  out.total = out.staff + out.rent + out.allow + out.pol;
  return out;
}
/* 先月の費用の見込み（画面用。方針の費用は月の売上が分からないので、前の期の平均で見積もる） */
function ksDeptCostEst(n) {
  const c = ksDeptCost(n);
  const P = n.pol, T = P && KS_DEPT_THEME[P.theme];
  if (T && T.costR) {
    const s = sum(ksDeptScope(n).units, id => ksDeptUnitSalesM(id));
    c.pol = Math.round(s * (T.costR + (P.add ? 0.001 : 0)) * (P.cut ? 0.7 : 1) * (P.status === 'ok' ? 1 : 0.5));
    c.total = c.staff + c.rent + c.allow + c.pol;
  }
  return c;
}
/* 事業の売上（直近の月の平均） */
function ksDeptUnitSalesM(id) {
  const ms = G.months.slice(-3);
  return ms.length ? sum(ms, x => (((x.flowU || {})[id] || {}).sales || 0)) / ms.length : 0;
}
function ksDeptUnitSalesFY(id, fy) { return sum(G.months.filter(x => fyOf(x.m) === fy), x => (((x.flowU || {})[id] || {}).sales || 0)); }

/* ---------- 部をつくる・変える・なくす ---------- */
function ksDeptAdd(o) {
  const O = ksDeptInit();
  const kind = o.kind === 'bu' ? 'bu' : 'dept';
  const fn = kind === 'bu' ? 'biz' : (KS_DEPT_FN[o.fn] ? o.fn : 'biz');
  const n = { id: 'o' + (++O.seq), kind, name: String(o.name || '').trim().slice(0, 30), parent: o.parent && ksDeptNode(o.parent) ? o.parent : null, fn, units: [], subs: [], runU: !!o.runU, staff: 0, pref: +o.pref || 0, cc: o.cc || 'jp', head: ksDeptNewHead(), pol: null, since: G.m, qs: {} };
  if (!n.name) n.name = ksDeptAutoName(n, o.units || []);
  O.nodes.push(n);
  ksDeptSetSel(n.id, o.units || []);
  if (o.subs) ksDeptSetSubSel(n.id, o.subs);
  if (o.runS) ksDeptRunSubs(n, true);
  n.staff = KS_DEPT_FN[fn].ratio ? Math.max(0, Math.round(o.staff ?? ksDeptNeed(n))) : 0;
  ksDeptDraft(n, fyOf(G.m));
  ksDeptTouch();
  return n;
}
function ksDeptAutoName(n, units) {
  const loc = ksDeptIsBranch(n) ? ksDeptPlace(n).replace(/[都道府県]$/, '') : '';
  if (n.kind === 'bu') { const u = ksUnit(units[0]); return `${u ? ksS(u).grp.replace(/（.*?）/g, '').replace(/業$/, '') : '事業'}ユニット`; }
  if (loc) return `${loc}支店`;
  if (n.fn === 'biz') { const u = ksUnit(units[0]); return u ? `${ksUName(u).replace(/（.*?）/g, '').slice(0, 12)}事業部` : '事業部'; }
  return `${KS_DEPT_FN[n.fn].n.split('・')[0]}部`;
}
/* 事業の割り当て：1つの事業は、事業部（事業の役割の部・ユニット）の1つにだけ入る */
function ksDeptSetUnits(id, list) {
  const n = ksDeptNode(id);
  if (!n) return;
  const live = new Set(ksActiveUnits().map(u => u.id));
  let want = [...new Set(list)].filter(x => live.has(x));
  // ユニットに入れる事業を、すでに事業部が受け持っていれば、その事業部をユニットの下に移す（事業は事業部のまま）
  if (n.kind === 'bu') {
    const below = new Set([n.id]);
    for (let p = n.parent ? ksDeptNode(n.parent) : null, i = 0; p && i < 200; i++) { below.add(p.id); p = p.parent ? ksDeptNode(p.parent) : null; }
    for (const o of ksDeptNodes()) {
      if (o === n || o.kind !== 'dept' || o.fn !== 'biz' || below.has(o.id)) continue;
      const hit = (o.units || []).filter(x => want.includes(x));
      if (hit.length) { o.parent = n.id; want = want.filter(x => !hit.includes(x)); }
    }
  }
  if (n.fn === 'biz') for (const o of ksDeptNodes()) if (o !== n && o.fn === 'biz') o.units = (o.units || []).filter(x => !want.includes(x));
  n.units = want;
  ksDeptTouch();
}
function ksDeptEdit(id, p) {
  const n = ksDeptNode(id);
  if (!n) return null;
  if (p.name !== undefined) n.name = String(p.name || '').trim().slice(0, 30) || n.name;
  if (p.parent !== undefined && (p.parent || null) !== (n.parent || null)) {
    // 自分と自分の下の部には付けられない（そのときは社長の直下）
    if (!ksDeptMove(n.id, p.parent || null)) ksDeptMove(n.id, null);
  }
  if (p.fn !== undefined && n.kind === 'dept' && KS_DEPT_FN[p.fn] && p.fn !== n.fn) { n.fn = p.fn; ksDeptDraft(n, fyOf(G.m)); }
  if (p.units !== undefined) ksDeptSetSel(n.id, p.units);
  if (p.staff !== undefined && KS_DEPT_FN[n.fn].ratio) n.staff = clamp(Math.round(+p.staff || 0), 0, 999);
  if (p.pref !== undefined) n.pref = +p.pref || 0;
  if (p.cc !== undefined) n.cc = p.cc || 'jp';
  if (!KS_DEPT_FN[n.fn].ratio) n.staff = 0;
  if (p.runU !== undefined) n.runU = !!p.runU && ksDeptCanRun(n);
  if (p.subs !== undefined) ksDeptSetSubSel(n.id, p.subs);
  else if (!ksDeptCanHold(n)) n.subs = [];
  if (p.runS !== undefined) ksDeptRunSubs(n, p.runS);
  ksDeptTouch();
  return n;
}
function ksDeptRemove(id) {
  const O = G.org;
  const n = ksDeptNode(id);
  if (!n) return false;
  for (const k of ksDeptKids(id)) k.parent = n.parent || null;
  // 直接持っていた事業と会社は、上の受け持つ組織に戻る（上がなければ、事業はどこにも入らず、会社は社長の直轄）
  const P = ksDeptIsHolder(n) ? ksDeptHolderParent(n) : null;
  if (P) {
    for (const x of n.units || []) if (!(P.units || []).includes(x)) P.units = [...(P.units || []), x];
    if (ksDeptCanHold(P)) for (const x of n.subs || []) if (!(P.subs || []).includes(x)) P.subs = [...(P.subs || []), x];
  }
  n.subs = []; // 任せていた子会社は、管轄の組織がなくなれば子会社の社長が経営する
  O.nodes = O.nodes.filter(x => x !== n);
  ksDeptTouch();
  return true;
}
/* よく使う形をまとめてつくる */
function ksDeptTemplate(kind) {
  ksDeptInit();
  const made = [];
  if (kind === 'biz') {
    // 事業部のない事業ごとに事業部をつくる。ユニットが直接持つ事業は、そのユニットの下に（ユニットが選んだ事業から）
    for (const u of ksActiveUnits()) {
      const h = ksDeptHolderOf(u.id);
      if (h && h.kind === 'dept') continue;
      made.push(ksDeptAdd({ kind: 'dept', fn: 'biz', parent: h ? h.id : null, units: [u.id] }));
    }
  } else if (kind === 'admin') {
    for (const fn of ['admin', 'acct', 'hr']) if (!ksDeptNodes().some(n => n.fn === fn)) made.push(ksDeptAdd({ kind: 'dept', fn }));
  } else if (kind === 'safe') {
    for (const fn of ['safety', 'quality']) if (!ksDeptNodes().some(n => n.fn === fn)) made.push(ksDeptAdd({ kind: 'dept', fn }));
  }
  return made;
}

/* ---------- 方針（部長の案）と社長のレビュー ---------- */
/* 現実的な目標（%）：売上なら、これまでの伸びと景気から。改善の目標（費用・労災など）なら、部長の力から */
function ksDeptIdeal(n, kpi) {
  if (kpi === 'sales') {
    const us = ksDeptScope(n).units.map(id => ksUnit(id)).filter(Boolean);
    const tr = us.length ? sum(us, u => (u.tr ? u.tr.g * 100 * 0.5 : 0)) / us.length : 0;
    const eco = G.eco ? (G.eco.idx - 1) * 60 : 0;
    return clamp(Math.round(2 + tr + eco), -6, 15);
  }
  return clamp(Math.round(6 + (n.head ? n.head.skill : 3) * 1.5), 5, 15);
}
function ksDeptThemeFor(n) {
  const base = KS_DEPT_FN_THEME[n.fn] || 'grow';
  if (n.fn !== 'biz') return base;
  // 事業部：利益が薄ければ費用、労災が続けば安全、人が辞めれば人材。部長の型でも変わる
  const us = ksDeptScope(n).units;
  const accN = G.law ? G.law.acc.filter(a => us.includes(a.u) && G.m - a.m < 12).length : 0;
  if (accN >= 2) return 'safety';
  const st = n.head ? n.head.style : 'solid';
  if (st === 'careful') return chance(0.5) ? 'cost' : 'quality';
  if (st === 'aggr') return chance(0.6) ? 'grow' : 'newmkt';
  return pick(['grow', 'cost', 'quality', 'people']);
}
function ksDeptDraft(n, fy, theme) {
  const H = n.head, S = KS_DEPT_STYLE[H.style] || KS_DEPT_STYLE.solid;
  theme = theme && KS_DEPT_THEME[theme] ? theme : ksDeptThemeFor(n);
  const T = KS_DEPT_THEME[theme];
  const ideal = ksDeptIdeal(n, T.kpi);
  const target = Math.round(ideal + S.bias * (T.kpi === 'sales' ? 1 : 1.5) + (rand() - 0.5) * 4);
  const acts = [];
  const pool = T.acts.slice();
  while (acts.length < 3 && pool.length) acts.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  n.pol = { fy, theme, target, ideal, acts, status: 'draft', q: +(0.92 + H.skill * 0.03).toFixed(2), m: G.m, rev: 0, log: [] };
  ksDeptSetBudget(n);
  ksDeptTouch();
  return n.pol;
}
/* 部の予算（年）：売上の予算は、受け持つ事業の前の期の売上に目標の伸びを掛ける。費用の予算は、部の費用の見込みの12か月分 */
function ksDeptSetBudget(n) {
  const P = n.pol;
  if (!P) return;
  const sc = ksDeptScope(n);
  const last = (sum(sc.units, id => ksDeptUnitSalesFY(id, P.fy - 1)) || sum(sc.units, id => ksDeptUnitSalesM(id)) * 12) + ksDeptSubsSalesFY(n, P.fy - 1);
  P.budS = KS_DEPT_THEME[P.theme].kpi === 'sales' || n.fn === 'biz' || n.fn === 'sales' ? Math.round(last * (1 + (KS_DEPT_THEME[P.theme].kpi === 'sales' ? P.target : 2) / 100)) : 0;
  P.budS0 = Math.round(last);
  P.budC = Math.round(ksDeptCostEst(n).total * 12 * (KS_DEPT_THEME[P.theme].kpi === 'cost' ? 1 - P.target / 200 : 1));
}
/* 社長のレビュー：rate＝'good'（よい）・'ok'（このままで）・'redo'（作り直し）、fb＝指摘の一覧 */
function ksDeptReview(id, o = {}) {
  const n = ksDeptNode(id);
  const P = n && n.pol;
  if (!P || P.status === 'ok') return null;
  const H = n.head;
  const gap = P.target - P.ideal;
  const res = { mot: 0, msgs: [] };
  const add = (m, t) => { res.mot += m; if (t) res.msgs.push(t); };
  for (const k of o.fb || []) {
    if (k === 'up') { if (gap < -2) add(3, '目標が低すぎるという指摘に、部長も納得した'); else add(-5, 'すでに高い目標をさらに上げられ、部長は無理を感じている'); P.target += 4; }
    else if (k === 'down') { if (gap > 3) add(3, '現実的な目標に直し、部長は安心した'); else add(-2, 'もともと控えめな目標をさらに下げ、取り組みがゆるむおそれがある'); P.target -= 4; }
    else if (k === 'cut') { P.cut = true; add(-1, '取り組みの費用を3割減らした（効き目も少し下がる）'); }
    else if (k === 'add') { P.add = true; add(1, '安全と品質の取り組みも加えた'); }
    else if (k === 'basis') { P.q = +Math.min(1.25, P.q + 0.05).toFixed(2); add(0, '数字の根拠を示し、計画の質が上がった'); }
  }
  const gap2 = P.target - P.ideal;
  if (o.rate === 'good') { if (gap2 >= -2 && gap2 <= 3) { add(4, 'よい方針だと評価され、部長は意欲を高めた'); P.q = +Math.min(1.25, P.q + 0.05).toFixed(2); } else { add(1, 'ほめたが、目標の高さには課題が残る'); P.q = +Math.max(0.75, P.q - 0.03).toFixed(2); } }
  else if (o.rate === 'ok') add(1, '');
  P.rev = (P.rev || 0) + 1;
  P.log.push({ m: G.m, rate: o.rate || 'ok', fb: (o.fb || []).slice() });
  if (o.rate === 'redo') {
    add(-3, '作り直しを求められ、部長は方針を練り直した');
    const keep = { fy: P.fy, log: P.log, rev: P.rev, add: P.add, cut: P.cut };
    const th = o.theme && KS_DEPT_THEME[o.theme] ? o.theme : P.theme;
    ksDeptDraft(n, P.fy, th);
    Object.assign(n.pol, keep);
    n.pol.target = Math.round(n.pol.ideal + (n.pol.target - n.pol.ideal) * 0.5);
    n.pol.q = +Math.min(1.25, n.pol.q + 0.08).toFixed(2);
  } else {
    if (o.theme && KS_DEPT_THEME[o.theme] && o.theme !== P.theme) { P.theme = o.theme; P.acts = KS_DEPT_THEME[o.theme].acts.slice(0, 3); P.ideal = ksDeptIdeal(n, KS_DEPT_THEME[o.theme].kpi); add(-1, 'テーマを社長の指示で変えた'); }
    P.status = 'ok';
    P.okM = G.m;
    ksDeptSetBudget(n);
  }
  H.mot = clamp(Math.round(H.mot + res.mot), 0, 100);
  res.status = n.pol.status;
  ksDeptTouch();
  return res;
}
/* まだレビューしていない方針を、そのまま承認する */
function ksDeptApproveAll() { let k = 0; for (const n of ksDeptNodes()) if (n.pol && n.pol.status !== 'ok') { ksDeptReview(n.id, { rate: 'ok' }); k++; } return k; }
/* レビュー待ちの方針 */
function ksDeptPending() { return ksDeptNodes().filter(n => n.pol && n.pol.status !== 'ok'); }

/* ---------- 毎月 ---------- */
function ksDeptMonth() {
  const O = G.org;
  if (!O || !O.nodes.length) return;
  const fy = fyOf(G.m);
  const mo = calMonth(G.m);
  // 期のはじめの従業員満足度（「人を育てる」方針の進み具合の基準）
  if (G.hr) { O.qa.es = O.qa.es || {}; if (O.qa.es[fy] === undefined) O.qa.es[fy] = G.hr.es; }
  // 部の費用（本社費）
  for (const n of O.nodes) {
    if (!n.pol || n.pol.fy !== fy) ksDeptDraft(n, fy);
    const c = ksDeptCost(n);
    const F = KS_DEPT_FN[n.fn];
    const nm = `${n.name}（${ksDeptKindName(n)}）`;
    if (c.staff > 0) {
      const wf = Math.round(c.staff * 0.15 / 1.15), base = c.staff - wf;
      ksPost('orgStaff', [[F.acct || 'salary', base, 0], ['welfare', wf, 0], ['cash', 0, c.staff]], { u: 'HQ', key: n.id, cf: 'payroll', desc: `${nm}の人件費（${n.staff}人）` });
    }
    if (c.rent > 0) ksPost('orgRent', [['rent', c.rent, 0], ['cash', 0, c.rent]], { u: 'HQ', key: n.id, cf: 'exp', desc: `${nm}の事務所の家賃` });
    if (c.allow > 0) ksPost('orgAllow', [['salary', c.allow, 0], ['cash', 0, c.allow]], { u: 'HQ', key: n.id, cf: 'payroll', desc: `${ksDeptHeadTitle(n)}の役職手当（${nm}）` });
    if (c.pol > 0) ksPost('orgPol', [[KS_DEPT_THEME[n.pol.theme].acct || 'misc', c.pol, 0], ['cash', 0, c.pol]], { u: 'HQ', key: n.id, cf: 'exp', desc: `${nm}の方針「${KS_DEPT_THEME[n.pol.theme].n}」の取り組みの費用` });
    // 調達・購買：仕入の割戻し
    if (F.rebate) {
      const f = G.flow || {}, s = ksDeptStrength(n);
      for (const k of ['purch', 'matPurch']) { const v = Math.round((f[k] || 0) * F.rebate * Math.min(1.2, s)); if (v > 0) ksPost('orgRebate', [['cash', v, 0], [k, 0, v]], { u: 'HQ', key: n.id + k, cf: 'collect', desc: `仕入割戻し（${nm}の交渉）` }); }
    }
    // 経理・財務：銀行との関係
    if (F.bank && G.banks) { const s = ksDeptStrength(n); for (const b of Object.values(G.banks)) b.rel = Math.min(100, (b.rel || 50) + 0.15 * Math.min(1.2, s)); }
    // 四半期の集計（売上・費用・労災）
    const q = n.qs || (n.qs = {});
    const sc = ksDeptScope(n);
    q.sales = (q.sales || 0) + sum(sc.units, id => (((G.flowU || {})[id] || {}).sales || 0));
    // 管轄の子会社の売上（子会社の締めは親会社のあと。直近に締めた月の分を足す）
    const subS = ksDeptSubsSalesLast(n);
    if (subS) { q.sales += subS; q.subS = (q.subS || 0) + subS; }
    q.cost = (q.cost || 0) + c.total;
    q.n = (q.n || 0) + 1;
    // やる気：60に少しずつ戻る。高すぎる目標を押し付けられていると下がる
    const H = n.head;
    H.mot = clamp(H.mot + (60 - H.mot) * 0.04 - (n.pol && n.pol.status === 'ok' && n.pol.target > n.pol.ideal + 6 ? 1.2 : 0), 0, 100);
    // やる気が下がりきると、部長が辞める（後任は社内から）
    if (H.mot < 18 && chance(0.25)) {
      const old = H.name;
      n.head = ksDeptNewHead();
      n.head.skill = Math.max(1, n.head.skill - 1);
      ksDeptDraft(n, fy);
      if (!G.isSub) ksNews(`${n.name}の${ksDeptHeadTitle(n)}（${old}）が会社を辞めました。後任に${n.head.name}を選び、方針を作り直します`, 'bad');
    }
  }
  // 四半期の定例会（6・9・12・3月の末）
  if ([6, 9, 12, 3].includes(mo)) ksDeptMeetMake();
  // 3月の末：次の期の方針の案（4月から）
  if (mo === 3) for (const n of O.nodes) ksDeptDraft(n, fy + 1);
  // 子会社と「自動」にした会社は、部長の案をそのまま承認する
  if (G.isSub || O.auto) for (const n of O.nodes) if (n.pol && n.pol.status !== 'ok') ksDeptReview(n.id, { rate: 'ok' });
  ksDeptTouch();
}
/* 定例会の記録をつくる */
function ksDeptQuarter(m) { const mo = calMonth(m); return mo >= 4 && mo <= 6 ? 1 : mo <= 9 && mo >= 7 ? 2 : mo >= 10 ? 3 : 4; }
function ksDeptMeetMake() {
  const O = G.org;
  const fy = fyOf(G.m), qn = ksDeptQuarter(G.m);
  const qMonths = [G.m - 2, G.m - 1, G.m];
  const rows = O.nodes.map(n => {
    const P = n.pol && n.pol.fy === fy ? n.pol : null;
    const T = P ? KS_DEPT_THEME[P.theme] : null;
    const q = n.qs || {};
    const sc = ksDeptScope(n);
    // 売上の予算（四半期）：年の予算を、受け持つ事業の季節の重みで分ける
    const us = sc.units.map(id => ksUnit(id)).filter(Boolean);
    const seasonW = us.length ? sum(qMonths, m => sum(us, u => ksS(u).season[ksMonthIndex(m)])) / Math.max(1, sum(us, u => sum(ksS(u).season, x => x))) : 0.25;
    const budS = P && P.budS ? Math.round(P.budS * seasonW) : 0;
    const budC = P && P.budC ? Math.round(P.budC / 4) : 0;
    const sR = budS ? q.sales / budS : null;
    const cR = budC ? q.cost / budC : null;
    // 方針の進み具合（KPI）
    let kp = 1, kt = '';
    const kpi = T ? T.kpi : 'sales';
    if (kpi === 'sales') { kp = sR ?? 1; kt = budS ? `売上 予算の${Math.round(kp * 100)}%` : '売上の予算なし'; }
    else if (kpi === 'cost') { kp = cR ? clamp(2 - cR, 0.6, 1.4) : 1; kt = budC ? `費用 予算の${Math.round((cR || 0) * 100)}%` : '費用の予算なし'; }
    else if (kpi === 'acc') { const a = G.law ? G.law.acc.filter(x => qMonths.includes(x.m) && sc.units.includes(x.u)).length : 0; kp = a === 0 ? 1.08 : a === 1 ? 0.92 : 0.78; kt = `労災 ${a}件（目標 0件）`; }
    else if (kpi === 'people') { const es = G.hr ? G.hr.es : 50; const es0 = (O.qa.es || {})[fy] ?? es; kp = clamp(1 + (es - es0) / 40, 0.8, 1.2); kt = `従業員満足度 ${fmtNum(es, 0)}点（期のはじめ ${fmtNum(es0, 0)}点）`; }
    else if (kpi === 'viol') { const v = G.law ? ksLawViolations().size : 0; kp = v === 0 ? 1.06 : clamp(1 - v * 0.08, 0.7, 1); kt = `法令違反 ${v}件`; }
    else { kp = clamp(0.92 + 0.12 * Math.min(1.2, ksDeptPolF(n)) + (rand() - 0.5) * 0.08, 0.8, 1.2); kt = `${T ? T.n : '取り組み'}：部長の報告で 進み ${Math.round(kp * 100)}%`; }
    const score = kpi === 'sales' ? kp : (sR ? (kp + clamp(sR, 0.7, 1.3)) / 2 : kp) * (cR && kpi !== 'cost' ? clamp(1.1 - (cR - 1) * 0.5, 0.85, 1.1) : 1);
    const ti = score >= 1.08 ? 0 : score >= 1.02 ? 1 : score >= 0.96 ? 2 : score >= 0.88 ? 3 : 4;
    const st = KS_DEPT_STYLE[n.head.style] || KS_DEPT_STYLE.solid;
    const self = clamp(ti - st.self, 0, 4);
    const say = ti <= 1 ? pick(['計画どおりに進んでいます', '手応えがあります。次も続けます', 'お客の反応がよく、予定より進みました']) : ti === 2 ? pick(['おおむね計画どおりです', '遅れはありますが、取り戻せます']) : pick(['計画より遅れています。原因を調べています', '思うように進みませんでした。手を打ちます', '人手が足りず、取り組みが進みませんでした']);
    return { id: n.id, name: n.name, kind: ksDeptKindName(n), fn: n.fn, head: n.head.name, style: n.head.style, theme: P ? P.theme : null, status: P ? P.status : 'none', sales: Math.round(q.sales || 0), subS: Math.round(q.subS || 0), nSubs: ksDeptSelSubs(n).length, run: !!(n.runU || ksDeptSubsOf(n).some(x => x.orgRun && x.auto)), budS, cost: Math.round(q.cost || 0), budC, kt, kp: +kp.toFixed(3), score: +score.toFixed(3), ti, self, say };
  });
  // 会社の予算と実績（四半期と期のはじめから）
  const b = G.budget && G.budget.fy === fy ? G.budget : null;
  const ms = G.months.filter(x => fyOf(x.m) === fy);
  const cur = { sales: (G.flow || {}).sales || 0 };
  const actS = sum(ms, x => x.mg.sales) + cur.sales;
  const comp = b ? { budS: b.lines.sales, budO: b.lines.ord, actS, actO: sum(ms, x => x.mg.ord) + ksMonthPLNow(), share: (qn * 3) / 12 } : null;
  const meet = { id: (O.meetSeq = (O.meetSeq || 0) + 1), m: G.m, fy, q: qn, rows, comp, done: false };
  O.meets.unshift(meet);
  if (O.meets.length > 12) O.meets.length = 12;
  for (const n of O.nodes) n.qs = {};
  // 子会社と、自動にした会社は、公平な評価で済ませる
  if (G.isSub || G.hist || (O.auto)) ksDeptMeetResolve(meet.id, null);
  else G.pendingModals.push({ type: 'kDeptMeet', id: meet.id });
  return meet;
}
/* 定例会の評価：choices = { 部のid: { rate: 'S'〜'D', fb: 'keep'… } }。null なら、実績どおりの公平な評価 */
function ksDeptMeetResolve(meetId, choices) {
  const O = G.org;
  const meet = O && O.meets.find(x => x.id === meetId);
  if (!meet || meet.done) return null;
  const out = [];
  for (const r of meet.rows) {
    const n = ksDeptNode(r.id);
    if (!n) continue;
    const c = (choices && choices[r.id]) || { rate: KS_DEPT_GRADES[r.ti], fb: r.ti >= 3 ? (r.theme === 'safety' ? 'safety' : 'sales') : 'keep' };
    const gi = Math.max(0, KS_DEPT_GRADES.indexOf(c.rate));
    const diff = r.ti - gi; // 正：実績より高く評価した
    let dm = diff === 0 ? 4 : diff === 1 ? 2 : diff >= 2 ? 1 : diff === -1 ? -3 : -10;
    if (gi <= 1 && diff >= 0) dm += 1;
    if (c.fb === 'keep') dm += 1;
    n.head.mot = clamp(Math.round(n.head.mot + dm), 0, 100);
    if (n.pol && diff >= 2) n.pol.q = +Math.max(0.75, (n.pol.q || 1) - 0.05).toFixed(2); // 甘すぎる評価は、取り組みをゆるめる
    if (n.pol && c.fb && c.fb !== 'keep' && KS_DEPT_MEET_FB[c.fb]) n.pol.fb2 = { k: c.fb, until: G.m + 3 };
    r.rate = KS_DEPT_GRADES[gi]; r.fb = c.fb || 'keep'; r.dm = dm;
    out.push(r);
  }
  meet.done = true;
  meet.doneM = G.m;
  meet.auto = !choices;
  ksDeptTouch();
  return out;
}

/* ---------- 子会社の管轄と、運営を任せる ---------- */
/* 子会社を管轄に置けるのは、ユニットと事業部（グループの親会社の組織だけ） */
function ksDeptCanHold(n) { return !!n && (n.kind === 'bu' || n.fn === 'biz') && !(G && G.isSub); }
/* 運営を任せられるのは、ユニットと事業部 */
function ksDeptCanRun(n) { return !!n && (n.kind === 'bu' || n.fn === 'biz'); }
/* 管轄の会社（グループから外れた会社は除く） */
function ksDeptSubsOf(n, root = G) {
  if (!n || !n.subs || !n.subs.length || !root || !root.group) return [];
  return n.subs.map(id => ksSubById(id, root)).filter(x => x && !x.gone);
}
/* その会社を管轄するユニット・事業部（親会社の組織の中で） */
function ksDeptSubNode(subId, root = ksRoot()) {
  const O = root && root.org;
  return O ? O.nodes.find(n => (n.subs || []).includes(subId)) || null : null;
}
/* 管轄：1つの会社は、ユニット・事業部の1つにだけ入る */
function ksDeptSetSubs(id, list) {
  const n = ksDeptNode(id);
  if (!n) return;
  if (!ksDeptCanHold(n)) { n.subs = []; return; }
  const ok = new Set((G.group ? ksSubs(G) : []).map(x => x.id));
  const want = [...new Set(list || [])].filter(x => ok.has(x));
  for (const o of ksDeptNodes()) if (o !== n && o.subs) o.subs = o.subs.filter(x => !want.includes(x));
  n.subs = want;
  ksDeptTouch();
}
/* 管轄の子会社の経営を、まとめてこの組織に任せる（on）・任せるのをやめて子会社の社長に戻す（off） */
function ksDeptRunSubs(n, on) {
  for (const x of ksDeptSubsOf(n)) { if (x.aff) continue; x.orgRun = !!on; if (on) x.auto = true; }
  ksDeptTouch();
}
/* 1つの会社の管轄と経営の担い手を決める：nodeId（なし＝社長の直轄）、op＝'self'・'ceo'・'org' */
function ksSubSetJur(subId, nodeId, op) {
  const root = G;
  const x = ksSubById(subId, root);
  if (!x || x.gone) return false;
  for (const o of ksDeptNodes()) if (o.subs) o.subs = o.subs.filter(id => id !== subId);
  const n = nodeId ? ksDeptNode(nodeId) : null;
  if (n && ksDeptCanHold(n)) n.subs = [...(n.subs || []), subId];
  if (!x.aff) {
    if (op === 'self') { x.auto = false; x.orgRun = false; }
    else if (op === 'org' && n) { x.auto = true; x.orgRun = true; }
    else if (op === 'ceo' || op === 'org') { x.auto = true; x.orgRun = false; }
  }
  ksDeptTouch();
  return true;
}
/* 子会社の経営の担い手：'self'（社長が直接）・'ceo'（子会社の社長に任せる）・'org'（管轄のユニット・事業部に任せる） */
function ksSubOp(x, root = ksRoot()) {
  if (!x || x.aff) return 'ceo';
  if (!x.auto) return 'self';
  return x.orgRun && ksDeptSubNode(x.id, root) ? 'org' : 'ceo';
}
function ksSubOpName(x, root = ksRoot()) {
  const op = ksSubOp(x, root);
  if (x.aff) return '相手の会社が経営（持分法）';
  if (op === 'self') return 'あなたが直接経営';
  if (op === 'org') { const n = ksDeptSubNode(x.id, root); return `${n.name}（${ksWith(root, () => ksDeptHeadTitle(n))} ${n.head.name}）に任せている`; }
  return '子会社の社長に任せている';
}
/* 管轄の会社の売上（連結子会社だけ。関連会社は売上に入れない） */
function ksDeptSubsSalesLast(n) {
  let t = 0;
  for (const x of ksDeptSelSubs(n).map(id => ksSubById(id, G)).filter(Boolean)) {
    if (x.aff || !x.st || x.st.over) continue;
    const last = x.st.months[x.st.months.length - 1];
    if (last && last.m >= G.m - 1) t += (last.mg && last.mg.sales) || 0;
  }
  return Math.round(t);
}
function ksDeptSubsSalesFY(n, fy) {
  let t = 0;
  for (const x of ksDeptSelSubs(n).map(id => ksSubById(id, G)).filter(Boolean)) {
    if (x.aff || !x.st) continue;
    const ms = x.st.months.filter(m => fyOf(m.m) === fy);
    t += ms.length ? sum(ms, m => (m.mg && m.mg.sales) || 0) * 12 / ms.length : 0;
  }
  return Math.round(t);
}
/* 事業を受け持つ部（事業部かユニット） */
function ksDeptOwnerOf(uid) { return ksDeptHolderOf(uid); }
/* 事業の運営を任せている部：受け持つ部か、その上のユニットで「運営を任せる」にしたもの（近いほう） */
function ksDeptRunnerOf(uid) {
  for (let p = ksDeptOwnerOf(uid), i = 0; p && i < 200; i++) { if (p.runU) return p; p = p.parent ? ksDeptNode(p.parent) : null; }
  return null;
}
/* 任せている先の数（事業と子会社）。部長の目が届くのは、3＋腕前×2 まで */
function ksDeptRunLoad(n) {
  const us = n.runU ? ksActiveUnits().filter(u => ksDeptRunnerOf(u.id) === n).length : 0;
  const ss = ksDeptSubsOf(n).filter(x => !x.aff && x.auto && x.orgRun).length;
  return us + ss;
}
function ksDeptRunCap(n) { return 3 + 2 * (n.head ? n.head.skill : 3); }
/* 任せた運営の出来（並の部長で0。腕前とやる気が高いほど正、任せすぎると下がる） */
function ksDeptRunRel(n) {
  const avg = (0.8 + 0.06 * 3) * (0.85 + 0.3 * 0.6);
  return clamp(ksDeptHeadF(n) / avg - 1 - 0.04 * Math.max(0, ksDeptRunLoad(n) - ksDeptRunCap(n)), -0.45, 0.3);
}
/* 出来が効く項目（出来1あたりの倍率の動き） */
const KS_DEPT_RUN_EFF = { demand: 0.15, shrink: -0.3, acc: -0.4, quit: -0.4, viol: -0.5, leak: -0.3, energy: -0.1, ot: -0.2 };
/* 運営を任せた事業：部長が今月の値決めと人の手配を決める（事業の型ごとの標準のやり方）。任せた数を返す */
function ksDeptRunUnits() {
  if (!G || !G.org || !G.org.nodes.some(n => n.runU)) return 0;
  let k = 0;
  for (const u of ksActiveUnits()) {
    if (!ksDeptRunnerOf(u.id)) continue;
    G.curU = u.id;
    try { KS_ENGINE[ksS(u).eng].auto(u); } finally { G.curU = null; }
    k++;
  }
  return k;
}
/* 親会社のユニット・事業部が管轄する子会社の倍率（子会社の会社の中で使う）。
   管轄だけ：目が届く分、不祥事と漏えいが少し減る。運営を任せた：部長の出来と、承認した方針のテーマ（6割の強さ）が効く */
const KS_DEPT_PAR_CACHE = new WeakMap();
function ksDeptParentF(key) {
  const root = (typeof KS_GROUP_RUN !== 'undefined' && KS_GROUP_RUN) || (typeof KS_ROOT !== 'undefined' && KS_ROOT) || null;
  if (!root || root === G || !root.org || !G.subId) return 1;
  const x = ksSubById(G.subId, root);
  if (!x || x.aff) return 1;
  const n = ksDeptSubNode(x.id, root);
  if (!n) return 1;
  const ck = `${root.m}|${root.org.ver || 0}|${x.auto ? 1 : 0}|${x.orgRun ? 1 : 0}`;
  let c = KS_DEPT_PAR_CACHE.get(x);
  if (!c || c.ck !== ck) {
    const mode = ksSubOp(x, root) === 'org' ? 'run' : 'watch';
    const rel = mode === 'run' ? ksWith(root, () => ksDeptRunRel(n)) : 0;
    const pf = mode === 'run' ? ksWith(root, () => ksDeptPolF(n)) : 0;
    c = { ck, mode, rel, pf, theme: n.pol && n.pol.theme };
    KS_DEPT_PAR_CACHE.set(x, c);
  }
  let f = key === 'viol' || key === 'leak' ? 0.95 : 1;
  if (c.mode === 'run') {
    if (KS_DEPT_RUN_EFF[key] !== undefined) f *= 1 + KS_DEPT_RUN_EFF[key] * c.rel;
    const T = c.theme && KS_DEPT_THEME[c.theme];
    if (T && c.pf && T.eff[key] !== undefined) f *= 1 + T.eff[key] * Math.min(1.3, c.pf) * 0.6;
  }
  return clamp(f, 0.6, 1.4);
}

/* ---------- ほかの仕組みへのつなぎ ---------- */
/* 効き目：方針と人事（ksHrF）に掛ける。ksHrF は、需要・離職・労災・ロス・不祥事などの倍率のもと */
if (typeof ksHrF === 'function') {
  const ksHrFDept0 = ksHrF;
  ksHrF = function (u, key) { return ksHrFDept0(u, key) * (G && G.org && G.org.nodes.length ? ksDeptF(u, key) : 1) * (G && G.isSub ? ksDeptParentF(key) : 1); };
}
/* 事業をやめたとき：部の受け持ちから外す（受け持ちの事業がなくなっても部は残る） */
function ksDeptDropUnit(uid) { for (const n of ksDeptNodes()) n.units = (n.units || []).filter(x => x !== uid); }
/* 部の人数（会社全体） */
function ksDeptStaffTotal() { return sum(ksDeptNodes(), n => n.staff || 0); }
