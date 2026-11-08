'use strict';
/* =========================================================
 *  29q_kaisha_org_ui.js : 「組織」の画面
 *   組織図（ユニット・部・支店・海外支店。折りたためる。管轄の子会社も並ぶ）、部の設定（管轄の子会社・運営を任せる）、
 *   部長の方針のレビュー、四半期の定例会
 *   （仕組みは 29p_kaisha_org.js）
 * ========================================================= */

KS_TABS.splice(KS_TABS.findIndex(t => t[0] === 'k_hr') + 1, 0, ['k_org', '組織']);
const KS_DEPT_FN_ICON = { biz: '事', sales: '営', pr: '広', plan: '企', acct: '経', admin: '総', hr: '人', safety: '安', quality: '品', legal: '法', it: '情', rnd: '研', tech: '技', buy: '調' };

/* 「組織」のタブのしるし：レビュー待ちの方針と、まだの定例会 */
function ksDeptOpenMeets() { return G.org ? G.org.meets.filter(x => !x.done) : []; }
const ksTabBadgeDept0 = ksTabBadge;
ksTabBadge = id => {
  if (id !== 'k_org') return ksTabBadgeDept0(id);
  const n = (G.org ? ksDeptPending().length : 0) + ksDeptOpenMeets().length;
  return n ? `<span class="badge">${n}</span>` : '';
};
/* 社長室の「今月やること」 */
const ksInboxDept0 = ksInbox;
ksInbox = () => {
  const out = ksInboxDept0();
  if (!G.org || G.over) return out;
  for (const mt of ksDeptOpenMeets()) out.push({ ico: '会', cls: 'warn', t1: `${ksFyLabel(mt.fy)} 第${mt.q}四半期の定例会`, t2: '予算と方針の進み具合を確かめ、部長を評価します', act: btn('定例会を開く', 'kDeptMeetOpen', { id: mt.id }, 'sm primary') });
  const pend = ksDeptPending();
  if (pend.length) out.push({ ico: '方', t1: `部長の方針がレビュー待ちです（${pend.length}件）`, t2: pend.slice(0, 4).map(n => n.name).join('・') + (pend.length > 4 ? ' など' : '') + '。レビューするまで、効き目は半分です', act: btn('組織へ', 'kGo', { tab: 'k_org' }, 'sm') + btn('まとめて承認', 'kDeptApproveAll', {}, 'sm') });
  return out;
};

/* ---------- 画面 ---------- */
function ksDeptUnitNames(ids) { return ids.map(id => ksUnit(id)).filter(Boolean).map(u => ksUName(u)).join('・'); }
function ksDeptMotBar(m) { const v = Math.round(m); return `<span class="motbar" role="img" aria-label="やる気 ${v}"><span style="width:${v}%" class="${v < 35 ? 'low' : v >= 70 ? 'hi' : ''}"></span></span><span class="small">${v}</span>`; }
function ksDeptPolTag(n) {
  const P = n.pol;
  if (!P) return '';
  const T = KS_DEPT_THEME[P.theme];
  const tgt = T.kpi === 'sales' ? `売上 ${P.target >= 0 ? '+' : ''}${P.target}%` : T.kpi === 'cost' ? `費用 −${Math.max(0, P.target)}%` : T.kpi === 'acc' ? '労災ゼロ' : `改善 ${P.target}%`;
  return `${tag(P.status === 'ok' ? '承認済み' : 'レビュー待ち', P.status === 'ok' ? 'ok' : 'warn')} <b>${esc(T.n)}</b><span class="small muted">（${esc(tgt)}・${P.fy > fyOf(G.m) ? '来期' : ksFyLabel(P.fy)}）</span>`;
}
/* ---------- 組織図の折りたたみ（部が増えても見やすいように） ----------
 * 部ごとに「くわしい中身とボタン」を開く／たたむ。下の部と管轄の子会社の枝を開く／たたむ。
 * 表示のしかた：くわしく（すべて開く）・1行ずつ（部を1行に）・上の段だけ（下の枝をたたむ）。開いた／たたんだ状態はセーブデータに残す */
const KS_DEPT_AUTO_LINE = 6; // 部がこの数以上なら、はじめは1行ずつ
function ksDeptView() {
  const O = G.org;
  if (!O) return { c: {}, k: {} };
  if (!O.view || typeof O.view !== 'object') O.view = {};
  if (!O.view.c) O.view.c = {};
  if (!O.view.k) O.view.k = {};
  return O.view;
}
function ksDeptViewMode() { return ksDeptView().mode || (ksDeptNodes().length >= KS_DEPT_AUTO_LINE ? 'line' : 'full'); }
function ksDeptCardOpen(n) { const v = ksDeptView(); return n.id in v.c ? !!v.c[n.id] : ksDeptViewMode() === 'full'; }
function ksDeptKidsOpen(n) { const v = ksDeptView(); return n.id in v.k ? !!v.k[n.id] : ksDeptViewMode() !== 'top'; }
/* 新しくつくった部・設定を変えた部は、たたむ表示のときでも開いて見せる（上の枝も開く） */
function ksDeptShow(n) {
  if (!n || !G.org) return;
  const v = ksDeptView();
  if (v.last && v.last !== n.id && v.c[v.last] === 1) delete v.c[v.last];
  v.last = null;
  if (!ksDeptCardOpen(n)) { v.c[n.id] = 1; v.last = n.id; }
  if ((ksDeptKids(n.id).length || (n.subs || []).length) && !ksDeptKidsOpen(n)) v.k[n.id] = 1; // 下に置いた部と会社も見せる
  for (let p = n.parent ? ksDeptNode(n.parent) : null, i = 0; p && i < 200; i++) { if (!ksDeptKidsOpen(p)) v.k[p.id] = 1; p = p.parent ? ksDeptNode(p.parent) : null; }
}
/* 管轄の会社の1行（今期の売上と経常利益・経営の担い手） */
function ksDeptSubItem(x, n) {
  const st = x.st;
  const ytd = ksWith(st, ksYTD);
  const op = ksSubOp(x);
  const word = x.aff ? '関連会社' : x.parent ? '孫会社' : '子会社';
  const opTag = x.aff ? tag('持分法') : op === 'org' ? tag('運営を任せている', 'ok') : op === 'self' ? tag('社長が直接', 'warn') : tag('子会社の社長');
  return `<li class="orgn"><div class="orgc co${x.aff ? ' aff' : ''}${st.over ? ' bad' : ''}">
    <div class="orgc-t"><span class="indico" aria-hidden="true">社</span><b>${esc(x.name)}</b>${tag(word)}<span class="tag">${Math.round(x.own * 100)}%</span>${opTag}</div>
    <div class="orgc-d small">${esc(ksWith(st, ksCompanyDesc) || '事業なし')}・今期の売上 ${fmtYen(ytd.sales)}・経常 <span class="${ytd.ord < 0 ? 'neg' : ''}">${fmtYen(ytd.ord)}</span></div>
    <div class="orgc-a">${x.aff ? btn('決算書を見る', 'kAffView', { id: x.id }, 'sm') : btn('この会社に入る', 'kView', { v: x.id }, 'sm')}${btn('管轄と経営', 'kSubJur', { id: x.id }, 'sm')}${btn('管轄から外す', 'kDeptSubDrop', { id: n.id, s: x.id }, 'sm ghost')}</div></div></li>`;
}
function ksDeptCard(n, depth) {
  const F = KS_DEPT_FN[n.fn];
  const kids = ksDeptKids(n.id);
  const subs = ksDeptSubsOf(n);
  const sc = ksDeptScope(n);
  const own = ksDeptOwnUnits(n);
  const c = ksDeptCostEst(n);
  const need = F.ratio ? ksDeptNeed(n) : 0;
  const st = KS_DEPT_STYLE[n.head.style] || KS_DEPT_STYLE.solid;
  const selU = ksDeptIsHolder(n) ? ksDeptSel(n) : [];
  const passed = selU.filter(x => !own.includes(x));
  const where = ksDeptIsHolder(n)
    ? (selU.length ? `${ksDeptUnitNames(selU)}${passed.length ? `（うち 下の部へ ${ksDeptUnitNames(passed)}）` : ''}` : subs.length ? '（自社の事業なし）' : '（事業を選んでいません。「設定」で受け持つ事業を選べます）')
    : own.length ? ksDeptUnitNames(own) : sc.all ? '会社の全事業' : `${ksDeptUnitNames(sc.units)}（上の組織から）`;
  const branch = ksDeptIsBranch(n);
  const pend = n.pol && n.pol.status !== 'ok';
  const open = ksDeptCardOpen(n);
  const runSubs = subs.filter(x => ksSubOp(x) === 'org').length;
  const runUnits = n.runU ? ksActiveUnits().filter(u => ksDeptRunnerOf(u.id) === n).length : 0;
  const load = runSubs + runUnits, cap = ksDeptRunCap(n);
  const runTxt = runUnits || runSubs ? `${[runUnits ? `事業 ${runUnits}` : '', runSubs ? `子会社 ${runSubs}社` : ''].filter(Boolean).join('・')}の運営を任せている${load > cap ? `（目が届くのは${cap}まで。任せすぎで出来が落ちている）` : ''}` : '';
  const tags = `${tag(ksDeptKindName(n), n.kind === 'bu' ? 'ok' : branch ? 'warn' : '')}${n.kind === 'dept' ? tag(F.n) : ''}${branch ? `<span class="small muted">${esc(ksDeptPlace(n))}</span>` : ''}${runTxt ? tag('任せている', load > cap ? 'warn' : 'ok') : ''}${pend ? tag('レビュー待ち', 'warn') : ''}`;
  const nSelS = ksDeptIsHolder(n) ? ksDeptSelSubs(n).length : 0;
  const summary = `<span class="orgc-sum small">${esc(ksDeptHeadTitle(n))} ${esc(n.head.name)}・${ksDeptIsHolder(n) ? `事業 ${selU.length}` : own.length ? `事業 ${own.length}` : sc.all ? '全事業' : `事業 ${sc.units.length}`}${nSelS ? `・会社 ${nSelS}社` : ''}・月${fmtYen(c.total)}</span>`;
  const head = `<button type="button" class="orgc-head" data-act="kDeptCard" data-id="${esc(n.id)}" aria-expanded="${open}" aria-controls="oc-${esc(n.id)}" title="${open ? 'たたむ' : 'くわしく見る'}">
      <span class="orgc-t"><span class="indico" aria-hidden="true">${KS_DEPT_FN_ICON[n.fn] || '部'}</span><b>${esc(n.name)}</b>${tags}</span>${open ? '' : summary}<span class="ob-chev" aria-hidden="true"></span></button>`;
  const body = open ? `<div class="orgc-body" id="oc-${esc(n.id)}">
    <div class="orgc-h small">${esc(ksDeptHeadTitle(n))} <b>${esc(n.head.name)}</b>（${esc(st.n)}・${'★'.repeat(n.head.skill)}${'☆'.repeat(5 - n.head.skill)}）<span class="orgc-mot">やる気 ${ksDeptMotBar(n.head.mot)}</span></div>
    <div class="orgc-d small">受け持ち：${esc(where)}${F.ratio ? `・人数 <b>${n.staff}人</b>（目安 ${need}人）` : ''}・費用 月${fmtYen(c.total)}</div>
    ${subs.length ? `<div class="orgc-d small">管轄の会社：${subs.length}社（${esc(subs.slice(0, 4).map(x => x.name).join('・'))}${subs.length > 4 ? 'など' : ''}）</div>` : ''}
    ${runTxt ? `<div class="orgc-d small">運営：${esc(runTxt)}</div>` : ''}
    <div class="orgc-p small">方針：${ksDeptPolTag(n)}</div>
    <div class="orgc-a">${btn(pend ? '方針をレビュー' : '方針を見る', 'kDeptPol', { id: n.id }, pend ? 'sm primary' : 'sm')}${btn('設定', 'kDeptEdit', { id: n.id }, 'sm')}${btn('＋下に部', 'kDeptAdd', { parent: n.id, kind: 'dept' }, 'sm')}${btn('移す', 'kDeptMove', { id: n.id }, 'sm')}${btn('外す', 'kDeptDel', { id: n.id }, 'sm ghost')}</div></div>` : '';
  const card = `<div class="orgc${n.kind === 'bu' ? ' bu' : ''}${branch ? ' br' : ''}${pend ? ' pend' : ''}${open ? '' : ' shut'}">${head}${body}</div>`;
  if (!kids.length && !subs.length) return `<li class="orgn">${card}</li>`;
  // 下の部と管轄の会社の枝
  const kOpen = ksDeptKidsOpen(n);
  const below = [];
  const walk = id => { for (const k of ksDeptKids(id)) { below.push(k); walk(k.id); } };
  walk(n.id);
  const what = [kids.length ? `下の部 ${kids.length}` : '', subs.length ? `管轄の会社 ${subs.length}社` : ''].filter(Boolean).join('・') + (below.length > kids.length ? `（その下にも${below.length - kids.length}）` : '');
  const bar = `<button type="button" class="orgfold" data-act="kDeptKids" data-id="${esc(n.id)}" aria-expanded="${kOpen}" aria-controls="ok2-${esc(n.id)}"><span class="ob-chev" aria-hidden="true"></span><span>${what}${kOpen ? '' : 'を表示'}</span></button>`;
  return `<li class="orgn">${card}${bar}${kOpen ? `<ul class="orgkids2" id="ok2-${esc(n.id)}">${kids.map(k => ksDeptCard(k, depth + 1)).join('')}${subs.map(x => ksDeptSubItem(x, n)).join('')}</ul>` : ''}</li>`;
}
KS_SCREENS.k_org = () => {
  const O = G.org;
  const nodes = ksDeptNodes();
  const tops = ksDeptKids(null);
  // 社長の直轄の会社（ユニット・事業部の管轄に入れていない会社）
  const direct = !G.isSub && G.group ? ksSubs(G).filter(x => !ksDeptSubNode(x.id, G)) : [];
  const mode = ksDeptViewMode();
  const tools = nodes.length >= 2 ? `<div class="orgtools"><span class="small muted">表示</span><div class="seg sm" role="radiogroup" aria-label="組織図の表示のしかた">${[['full', 'くわしく'], ['line', '1行ずつ'], ['top', '上の段だけ']].map(([k, l]) => `<button type="button" data-act="kDeptMode" data-v="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>
    <span class="small muted orgtools-hint">部の名前を押すと、くわしい中身とボタンを開いたり、たたんだりできます。</span></div>` : '';
  const directTxt = direct.length ? `<div class="orgc-d small orgdirect">社長の直轄の会社：${esc(direct.slice(0, 5).map(x => x.name).join('・'))}${direct.length > 5 ? `など${direct.length}社` : ''}（ユニットや事業部の「設定」で管轄に入れられます）</div>` : '';
  const tree = `${tools}<ul class="orgtree2${mode === 'full' ? '' : ' dense'}"><li class="orgn"><div class="orgc ceo"><div class="orgc-t"><span class="indico" aria-hidden="true">長</span><b>代表取締役社長 ${esc(G.ceo)}</b></div>${directTxt}<div class="orgc-a">${btn('＋ユニット', 'kDeptAdd', { kind: 'bu' }, 'sm')}${btn('＋部・支店', 'kDeptAdd', { kind: 'dept' }, 'sm primary')}</div></div>
    ${tops.length ? `<ul class="orgkids2">${tops.map(n => ksDeptCard(n, 0)).join('')}</ul>` : ''}</li></ul>`;
  const empty = nodes.length ? '' : `<div class="callout small" style="margin-top:10px">まだ部がありません。ユニット（事業本部）や部をつくると、部長が方針を立て、四半期ごとに定例会で進み具合を確かめます。まずは下の「よく使う形」から始められます。</div>`;
  const tpl = `<div class="row" style="gap:6px;flex-wrap:wrap">${btn('事業ごとに事業部をつくる', 'kDeptTpl', { v: 'biz' }, 'sm')}${btn('管理部門（総務・経理・人事）', 'kDeptTpl', { v: 'admin' }, 'sm')}${btn('安全管理部と品質保証部', 'kDeptTpl', { v: 'safe' }, 'sm')}</div>`;
  const costs = nodes.map(n => ksDeptCostEst(n));
  const tot = sum(costs, c => c.total);
  const effKeys = ['demand', 'quit', 'hire', 'acc', 'shrink', 'viol', 'leak', 'energy', 'bcp', 'ot'];
  const eff = nodes.length ? effKeys.map(k => { const v = ksDeptF(null, k); return Math.abs(v - 1) >= 0.005 ? `${KS_EFF_N[k]} ${v >= 1 ? '+' : '−'}${fmtNum(Math.abs(v - 1) * 100, 0)}%` : null; }).filter(Boolean).join('・') || 'まだ効き目はありません' : '―';
  const nextQ = (() => { for (let m = G.m; m < G.m + 4; m++) if ([6, 9, 12, 3].includes(calMonth(m))) return m; return G.m; })();
  const meets = O ? O.meets.slice(0, 6).map(mt => `<li>${ymLabel(mt.m)} 第${mt.q}四半期 ${mt.done ? `<span class="small muted">${mt.auto ? '自動で評価' : '評価済み'}</span> ${btn('結果', 'kDeptMeetOpen', { id: mt.id }, 'sm ghost')}` : btn('定例会を開く', 'kDeptMeetOpen', { id: mt.id }, 'sm primary')}</li>`).join('') : '';
  const pend = O ? ksDeptPending() : [];
  const side = `<div class="stack">
    ${panel('費用と効き目', kv([['部の数', `${nodes.length}（ユニット ${nodes.filter(n => n.kind === 'bu').length}・支店 ${nodes.filter(n => ksDeptIsBranch(n)).length}）`], ['部の人数（事業の人員とは別）', `${fmtNum(ksDeptStaffTotal(), 0)}人`], ['組織の費用', `月${fmtYen(tot)}（人件費・家賃・役職手当・方針の取り組み）`], ['会社全体への効き目', eff],
      ...(nodes.length ? [['運営を任せている', `事業 ${ksActiveUnits().filter(u => ksDeptRunnerOf(u.id)).length}・子会社 ${!G.isSub && G.group ? ksSubs(G).filter(x => ksSubOp(x, G) === 'org').length : 0}社`]] : []),
      ...(!G.isSub && G.group && ksSubs(G).length ? [['管轄に入れた会社', `${ksSubs(G).filter(x => ksDeptSubNode(x.id, G)).length}社／グループ ${ksSubs(G).length}社`]] : [])]) + '<p class="note">機能の部（営業・人事・安全管理など）は、受け持つ人数に対して目安の人数がいると効き目が十分に出ます。同じ役割の部をいくつつくっても、効き目は合わせて1.3倍分までです。部の費用は本社費（給料手当・法定福利費・地代家賃・広告宣伝費など。研究開発部は研究開発費）として記帳します。ユニットと事業部には、グループの会社を管轄に置き、事業や子会社の運営を任せられます。任せた運営の出来は部長の腕前とやる気しだいで、任せる先が多すぎると目が届かなくなります。</p>')}
    ${panel('方針のレビュー', pend.length ? `<p class="small" style="margin:0 0 6px">レビュー待ち <b>${pend.length}件</b>。レビューするまで、方針の効き目は半分です。</p><ul class="small orgpend">${pend.map(n => `<li>${esc(n.name)}　${btn('レビュー', 'kDeptPol', { id: n.id }, 'sm')}</li>`).join('')}</ul><div class="row" style="margin-top:6px">${btn('まとめて承認する', 'kDeptApproveAll', {}, 'sm')}</div>` : '<p class="small muted" style="margin:0">レビュー待ちの方針はありません。部長は毎年3月の末に、次の期の方針の案を出します。</p>')}
    ${panel('四半期の定例会', `<p class="small" style="margin:0 0 6px">6・9・12・3月の末に、予算と方針の進み具合を確かめ、部長を評価します。次は <b>${ymLabel(nextQ)}末</b>。</p>${meets ? `<ul class="small orgmeets">${meets}</ul>` : ''}<label class="inline small" style="margin-top:6px"><input type="checkbox" data-ch="kDeptAuto" ${O && O.auto ? 'checked' : ''}> 定例会とレビューを自動で済ませる（実績どおりの公平な評価・部長の案をそのまま承認）</label>`)}
    ${panel('よく使う形', tpl)}
  </div>`;
  return `<h1 class="h1">組織</h1><p class="lead">会社の中に、ユニット（事業本部）・部・支店をつくります。事業部は受け持つ事業を回し、営業・人事・安全管理・品質保証などの部は人数に応じて会社に効きます。本社と違う場所の部は支店（海外なら海外支店）。部長は毎年方針を立て、社長がレビューで評価と指摘をし、四半期ごとの定例会で予算と方針の進み具合を確かめます。</p>
    <div class="grid g-side"><div>${panel('組織図', tree + empty)}</div>${side}</div>`;
};

/* ---------- 部をつくる・変える ---------- */
function ksDeptLocSelect(n) {
  const hq = ksDeptHq().pref;
  const cur = (n.cc || 'jp') !== 'jp' ? 'c:' + n.cc : 'p:' + (+n.pref || 0);
  const prefs = Object.entries(KS_PREF_REG).map(([r, rn]) => `<optgroup label="${esc(rn)}">${Object.values(KS_PREFS).filter(P => P.reg === r && P.c !== hq).map(P => `<option value="p:${P.c}"${cur === 'p:' + P.c ? ' selected' : ''}>${esc(P.n)}（支店）</option>`).join('')}</optgroup>`).join('');
  const ccs = typeof KS_COUNTRIES !== 'undefined' ? `<optgroup label="海外（海外支店）">${Object.entries(KS_COUNTRIES).map(([c, x]) => `<option value="c:${c}"${cur === 'c:' + c ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</optgroup>` : '';
  return `<select data-ch="kDeptLoc" aria-label="所在地"><option value="p:0"${cur === 'p:0' ? ' selected' : ''}>本社と同じ（${esc(KS_PREFS[hq].n)}）</option>${prefs}${ccs}</select>`;
}
MODALS.kDeptEdit = () => {
  const D = UI.orgEd;
  if (!D) return modalFrame('部の設定', '<p>設定がありません</p>', btn('閉じる', 'closeModal'));
  const n = D.n;
  const isNew = !D.id;
  const F = KS_DEPT_FN[n.fn] || KS_DEPT_FN.biz;
  // 上の組織に選べるもの（自分と自分の下は除く）
  const below = new Set();
  if (D.id) { below.add(D.id); let grew = true; while (grew) { grew = false; for (const o of ksDeptNodes()) if (!below.has(o.id) && below.has(o.parent)) { below.add(o.id); grew = true; } } }
  const parents = [['', `社長の直下`], ...ksDeptNodes().filter(o => !below.has(o.id)).map(o => [o.id, `${o.name}（${ksDeptKindName(o)}）`])];
  const fns = Object.entries(KS_DEPT_FN).map(([k, x]) => `<option value="${k}"${n.fn === k ? ' selected' : ''}>${esc(x.n)}</option>`).join('');
  // 受け持つ事業：上に受け持つ組織（ユニット・事業部）があれば、その組織が選んだ事業の中から
  const tmpP = { id: D.id || '_new', parent: n.parent || null };
  const holdP = ksDeptHolderParent(tmpP);
  const belowU = D.id ? ksDeptBelowIds(D.id) : new Set();
  const allowedU = new Set(ksDeptAllowedUnits(tmpP, D.sel0 || []));
  const holder = ksDeptIsHolder(n);
  const units = ksActiveUnits().filter(u => allowedU.has(u.id)).map(u => {
    const h = ksDeptHolderOf(u.id);
    const note = !holder || !h || h.id === D.id ? '' : belowU.has(h.id) ? `（下の${h.name}）` : holdP && h.id === holdP.id ? '' : `（いまは${h.name}）`;
    return `<label class="inline small"><input type="checkbox" data-ch="kDeptUnit" value="${esc(u.id)}" ${n.units.includes(u.id) ? 'checked' : ''}> ${esc(ksUName(u))}${note ? `<span class="muted">${esc(note)}</span>` : ''}</label>`;
  }).join('');
  const unitsEmpty = holdP ? `<span class="small muted">${esc(holdP.name)}が選んだ事業がありません。${esc(holdP.name)}の「設定」で受け持つ事業を選ぶと、ここで選べます。</span>` : '<span class="small muted">事業がありません</span>';
  const unitsLabel = holdP ? `受け持つ事業（${holdP.name}が選んだ事業の中から${holder ? '。選ぶと、この部の受け持ちに移る' : '。選ばなければ、上の組織の事業すべて'}）`
    : `受け持つ事業${n.kind === 'bu' ? '（その事業の事業部があれば、事業部ごとユニットの下に移る。下の部は、ここで選んだ事業の中から選ぶ）' : n.fn === 'biz' ? '（1つの事業は、事業部・ユニットの1つにだけ入る）' : '（選ばなければ、上の組織か会社の全事業）'}`;
  const tmp = Object.assign({}, n, { id: D.id || '_new' });
  const need = F.ratio ? Math.max(1, Math.round(ksDeptScopeHead(n.units.length ? { units: n.units } : ksDeptScopeOf(tmp)) * F.ratio)) : 0;
  const branch = (n.cc || 'jp') !== 'jp' || (+n.pref && +n.pref !== ksDeptHq().pref);
  const body = `<div class="sg-form">
    ${isNew ? `<div class="field"><span>種類</span><div class="seg" role="radiogroup">${[['bu', 'ユニット（事業本部）'], ['dept', '部・支店']].map(([k, l]) => `<button type="button" data-act="kDeptEdKind" data-v="${k}" aria-pressed="${n.kind === k}">${l}</button>`).join('')}</div><span class="small muted">${n.kind === 'bu' ? 'いくつかの事業や部をまとめる単位。下に部や支店を置ける' : '事業を受け持つ事業部か、営業・人事などの機能の部。所在地を本社と違う場所にすると支店になる'}</span></div>` : ''}
    <div class="grid g2 sg-grid">
      <label class="field"><span>名前</span><input type="text" id="orgName" data-ch="kDeptName" value="${esc(n.name)}" maxlength="30" placeholder="空欄なら自動（例：原子力設計部）"></label>
      <label class="field"><span>上の組織</span><select data-ch="kDeptParent">${parents.map(([v, l]) => `<option value="${esc(v)}"${(n.parent || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    </div>
    ${n.kind === 'dept' ? `<label class="field"><span>役割</span><select data-ch="kDeptFn">${fns}</select><span class="small muted">${esc(F.d)}</span></label>` : ''}
    <div class="field"><span>${esc(unitsLabel)}</span><div class="orgunits">${units || unitsEmpty}</div></div>
    ${n.kind === 'dept' && F.ratio ? `<label class="field"><span>部の人数</span><span class="cu-capin"><input type="number" inputmode="numeric" min="0" max="999" step="1" data-ch="kDeptStaff" value="${n.staff}"><span class="small">人</span></span><span class="small muted">受け持つ人数から見た目安は ${need}人。目安に足りないと効き目が弱く、多すぎても効き目はあまり増えません（事業の人員とは別に雇います）</span></label>` : ''}
    ${n.kind === 'dept' ? `<label class="field"><span>所在地</span>${ksDeptLocSelect(n)}<span class="small muted">${branch ? `支店として、${esc(ksDeptPlace(n))}に事務所を借ります（家賃と人件費は所在地の水準）。${(n.cc || 'jp') !== 'jp' ? '海外支店の営業は、ものづくり・卸売・専門サービス・会員サービスの輸出の需要に効きます。' : ''}` : '本社の中に置きます。'}</span></label>` : ''}
    ${ksDeptEdRunHtml(D)}
  </div>`;
  const foot = btn('やめる', 'closeModal') + btn(isNew ? 'つくる' : 'この設定にする', 'kDeptSave', {}, 'primary');
  return modalFrame(isNew ? (n.kind === 'bu' ? 'ユニットをつくる' : '部・支店をつくる') : `${esc(D.name0)}の設定`, body, foot, { size: 'wide' });
};
/* 設定のダイアログ：管轄の会社と、運営を任せる（ユニットと事業部だけ） */
function ksDeptEdRunHtml(D) {
  const n = D.n;
  const hold = (n.kind === 'bu' || n.fn === 'biz') && !G.isSub;
  if (!(n.kind === 'bu' || n.fn === 'biz')) return '';
  const head = n.kind === 'bu' ? 'ユニット長' : (n.cc || 'jp') !== 'jp' || (+n.pref && +n.pref !== ksDeptHq().pref) ? '支店長' : '部長';
  const real = D.id ? ksDeptNode(D.id) : null;
  const cap = real ? ksDeptRunCap(real) : 9;
  let subsHtml = '';
  const tmpP = { id: D.id || '_new', parent: n.parent || null };
  const holdP = ksDeptHolderParent(tmpP);
  const allowedS = new Set(ksDeptAllowedSubs(tmpP, D.selS0 || []));
  const below = D.id ? ksDeptBelowIds(D.id) : new Set();
  if (hold && G.group && ksSubs(G).length && (allowedS.size || holdP)) {
    const rows = ksSubs(G).filter(x => allowedS.has(x.id)).map(x => {
      const other0 = ksDeptSubNode(x.id, G);
      const other = other0 && !(holdP && other0.id === holdP.id) ? (below.has(other0.id) && other0.id !== D.id ? Object.assign({}, other0, { name: `下の${other0.name}` }) : other0) : null;
      const word = x.aff ? '関連会社' : x.parent ? `孫会社（${ksOwnerNameOf(x, G)}の下）` : '子会社';
      return `<label class="inline small"><input type="checkbox" data-ch="kDeptSub" value="${esc(x.id)}" ${n.subs.includes(x.id) ? 'checked' : ''}> ${esc(x.name)}<span class="muted">（${esc(word)}・${Math.round(x.own * 100)}%${other && other.id !== D.id ? `・${/^下の/.test(other.name) ? '' : 'いまは'}${esc(other.name)}` : ''}）</span></label>`;
    }).join('');
    subsHtml = `<div class="field"><span>${holdP ? `管轄の会社（${esc(holdP.name)}の管轄の会社の中から。選ぶと、この組織の管轄に移る）` : '管轄の会社（グループの会社をこの組織の下に置く。1つの会社は1か所だけ。売上は部の実績に入る。下の部は、ここで選んだ会社の中から選ぶ）'}</span><div class="orgunits">${rows || `<span class="small muted">${esc(holdP ? holdP.name : '')}の管轄に会社がありません。</span>`}</div></div>`;
  }
  const canRunS = hold && n.subs.some(id => { const x = ksSubById(id, G); return x && !x.aff; });
  return `${subsHtml}<div class="field"><span>運営を任せる</span>
    <label class="inline small"><input type="checkbox" data-ch="kDeptRunU" ${n.runU ? 'checked' : ''}> 受け持つ事業の運営を任せる（値決めと人の手配を${head}が毎月決める）</label>
    ${canRunS ? `<label class="inline small"><input type="checkbox" data-ch="kDeptRunS" ${n.runS ? 'checked' : ''}> 管轄の子会社の経営を任せる（子会社の社長ではなく、この組織が経営を見る）</label>` : ''}
    <span class="small muted">出来は${head}の腕前とやる気しだいです（並より上なら需要が伸び、ロス・労災・離職・不祥事が減り、下なら逆）。任せる先（事業と子会社）が${cap}を超えると目が届かなくなります。任せた事業の値決めや人の数をあなたが変えても、翌月には${head}が決め直します。</span></div>`;
}
function ksDeptScopeOf(n) {
  // 編集中の部の受け持ち（上の組織の事業か、会社の全事業）
  for (let p = n.parent ? ksDeptNode(n.parent) : null, i = 0; p && i < 200; i++) { const us = ksDeptSubtreeUnits(p); if (us.length) return { units: us }; p = p.parent ? ksDeptNode(p.parent) : null; }
  return { units: ksActiveUnits().map(u => u.id) };
}
function ksDeptEdStore() { const D = UI.orgEd; if (!D) return; const nm = $('#orgName'); if (nm) D.n.name = nm.value; const sf = document.querySelector('#modal-root [data-ch="kDeptStaff"]'); if (sf) D.n.staff = Math.max(0, Math.round(+sf.value || 0)); }
Object.assign(ACTIONS, {
  kDeptAdd: d => {
    const kind = d.kind === 'bu' ? 'bu' : 'dept';
    UI.orgEd = { id: null, name0: '', n: { kind, name: '', parent: d.parent || null, fn: kind === 'bu' ? 'biz' : 'biz', units: [], subs: [], runU: false, runS: false, staff: 0, pref: 0, cc: 'jp' } };
    showModal('kDeptEdit');
  },
  kDeptEdit: d => {
    const n = ksDeptNode(d.id);
    if (!n) return;
    const ss = ksDeptSubsOf(n).filter(x => !x.aff);
    const sel0 = ksDeptIsHolder(n) ? ksDeptSel(n) : ksDeptOwnUnits(n), selS0 = ksDeptSelSubs(n);
    UI.orgEd = { id: n.id, name0: n.name, sel0, selS0, n: { kind: n.kind, name: n.name, parent: n.parent || null, fn: n.fn, units: sel0.slice(), subs: selS0.slice(), runU: !!n.runU, runS: ss.length > 0 && ss.every(x => ksSubOp(x) === 'org'), runS0: ss.length > 0 && ss.every(x => ksSubOp(x) === 'org'), staff: n.staff || 0, pref: n.pref || 0, cc: n.cc || 'jp' } };
    showModal('kDeptEdit');
  },
  kDeptEdKind: d => { ksDeptEdStore(); UI.orgEd.n.kind = d.v === 'bu' ? 'bu' : 'dept'; if (UI.orgEd.n.kind === 'bu') { UI.orgEd.n.fn = 'biz'; UI.orgEd.n.pref = 0; UI.orgEd.n.cc = 'jp'; } drawModal(); },
  kDeptSave: () => {
    ksDeptEdStore();
    const D = UI.orgEd, n = D.n;
    const F = KS_DEPT_FN[n.fn];
    const hold = (n.kind === 'bu' || n.fn === 'biz') && !G.isSub;
    if (D.id) {
      const p = { name: n.name, parent: n.parent || null, fn: n.fn, units: n.units, staff: n.staff, pref: n.pref, cc: n.cc, runU: n.runU };
      if (hold) { p.subs = n.subs; if (n.runS !== n.runS0) p.runS = n.runS; }
      ksDeptEdit(D.id, p);
      const x = ksDeptNode(D.id);
      ksDeptShow(x);
      toast(`${x.name}の設定を変えました`);
    } else {
      const staffAuto = F.ratio && !(n.staff > 0) ? undefined : n.staff;
      const x = ksDeptAdd({ kind: n.kind, name: n.name, parent: n.parent, fn: n.fn, units: n.units, staff: staffAuto, pref: n.pref, cc: n.cc, runU: n.runU, subs: hold ? n.subs : [], runS: hold && n.runS });
      ksDeptShow(x);
      toast(`${x.name}（${ksDeptKindName(x)}）をつくりました。${ksDeptHeadTitle(x)}は${x.head.name}。方針の案が出たので、レビューしてください`);
    }
    UI.orgEd = null;
    closeModal();
    autosave();
  },
  kDeptDel: d => {
    const n = ksDeptNode(d.id);
    if (!n) return;
    confirmBox(`${esc(n.name)}をなくす`, `${esc(n.name)}（${ksDeptKindName(n)}）をなくします。下の部は、上の組織に移ります。部の人（${n.staff || 0}人）は事業の人員には移りません（雇用は続け、費用はなくなる扱い）。`, 'なくす', 'kDeptDelGo', { id: n.id }, true);
  },
  kDeptDelGo: d => { const n = ksDeptNode(d.id); if (n && ksDeptRemove(d.id)) toast(`${n.name}をなくしました`); closeModal(true); render(); autosave(); },
  kDeptMode: d => { const v = ksDeptView(); v.mode = d.v; v.c = {}; v.k = {}; v.last = null; render(); autosave(); },
  kDeptCard: d => { const n = ksDeptNode(d.id); if (!n) return; ksDeptView().c[n.id] = ksDeptCardOpen(n) ? 0 : 1; render(); autosave(); },
  kDeptKids: d => { const n = ksDeptNode(d.id); if (!n) return; ksDeptView().k[n.id] = ksDeptKidsOpen(n) ? 0 : 1; render(); autosave(); },
  kDeptSubDrop: d => { const n = ksDeptNode(d.id), x = ksSubById(d.s); if (!n || !x) return; ksSubSetJur(x.id, null, ksSubOp(x) === 'org' ? 'ceo' : null); toast(`${x.name}を${n.name}の管轄から外し、社長の直轄に戻しました${x.auto && !x.aff ? '（経営は子会社の社長に任せます）' : ''}`); render(); autosave(); },
  kDeptTpl: d => { const made = ksDeptTemplate(d.v); toast(made.length ? `${made.map(x => x.name).join('・')}をつくりました。方針をレビューしてください` : 'すでにあります'); render(); autosave(); },
  kDeptApproveAll: () => { const k = ksDeptApproveAll(); toast(k ? `${k}件の方針を、部長の案のまま承認しました` : 'レビュー待ちの方針はありません'); render(); autosave(); },
  kDeptMeetOpen: d => showModal('kDeptMeet', { id: +d.id }),
  kDeptPol: d => { UI.orgPol = { id: d.id, rate: 'ok', fb: [], theme: '' }; showModal('kDeptPolicy'); },
});
Object.assign(CHANGES, {
  kDeptName: el => { if (UI.orgEd) UI.orgEd.n.name = el.value; },
  kDeptParent: el => {
    ksDeptEdStore();
    const D = UI.orgEd;
    D.n.parent = el.value || null;
    // 新しくつくる部は、上の組織が選んだ事業と会社の中からだけ（いまある部は、移すと事業と会社も一緒に移る）
    if (!D.id) {
      const tmp = { id: '_new', parent: D.n.parent };
      const au = new Set(ksDeptAllowedUnits(tmp, [])), as = new Set(ksDeptAllowedSubs(tmp, []));
      D.n.units = D.n.units.filter(x => au.has(x));
      D.n.subs = D.n.subs.filter(x => as.has(x));
    }
    drawModal();
  },
  kDeptFn: el => { ksDeptEdStore(); UI.orgEd.n.fn = el.value; if (!KS_DEPT_FN[el.value].ratio) UI.orgEd.n.staff = 0; drawModal(); },
  kDeptUnit: el => { ksDeptEdStore(); const u = UI.orgEd.n.units; const i = u.indexOf(el.value); if (el.checked && i < 0) u.push(el.value); if (!el.checked && i >= 0) u.splice(i, 1); drawModal(); },
  kDeptStaff: el => { if (UI.orgEd) UI.orgEd.n.staff = Math.max(0, Math.round(+el.value || 0)); },
  kDeptLoc: el => { ksDeptEdStore(); const [t, v] = el.value.split(':'); if (t === 'c') { UI.orgEd.n.cc = v; UI.orgEd.n.pref = 0; } else { UI.orgEd.n.cc = 'jp'; UI.orgEd.n.pref = +v || 0; } drawModal(); },
  kDeptSub: el => { ksDeptEdStore(); const L = UI.orgEd.n.subs; const i = L.indexOf(el.value); if (el.checked && i < 0) L.push(el.value); if (!el.checked && i >= 0) L.splice(i, 1); drawModal(); },
  kDeptRunU: el => { if (UI.orgEd) UI.orgEd.n.runU = el.checked; },
  kDeptRunS: el => { if (UI.orgEd) UI.orgEd.n.runS = el.checked; },
  kDeptAuto: el => { ksDeptInit().auto = el.checked; if (el.checked) { ksDeptApproveAll(); for (const mt of ksDeptOpenMeets()) ksDeptMeetResolve(mt.id, null); } render(); autosave(); },
});

/* ---------- 移す：部（ユニット）ごと・事業を1つずつ・管轄の会社を1社ずつ ---------- */
function ksDeptMvOpts(cur, list, top) {
  return `<option value="">${esc(top)}</option>` + list.map(o => {
    let d = 0;
    for (let p = o.parent ? ksDeptNode(o.parent) : null, i = 0; p && i < 50; i++) { d++; p = p.parent ? ksDeptNode(p.parent) : null; }
    return `<option value="${esc(o.id)}"${cur === o.id ? ' selected' : ''}>${'　'.repeat(d)}${esc(o.name)}（${esc(ksDeptKindName(o))}）</option>`;
  }).join('');
}
MODALS.kDeptMove = () => {
  const M = UI.orgMv;
  const n = M && ksDeptNode(M.id);
  if (!n) return modalFrame('移す', '<p>部がありません</p>', btn('閉じる', 'closeModal'));
  const below = ksDeptBelowIds(n.id);
  const dests = ksDeptNodes().filter(o => !below.has(o.id));
  const holders = ksDeptNodes().filter(o => ksDeptIsHolder(o));
  const own = ksDeptIsHolder(n) ? ksDeptOwnUnits(n) : [];
  const subs = ksDeptSubsOf(n);
  const selU = ksDeptIsHolder(n) ? ksDeptSel(n) : [];
  const selS = ksDeptIsHolder(n) ? ksDeptSelSubs(n) : [];
  const take = [selU.length ? `事業 ${selU.length}（${ksDeptUnitNames(selU)}）` : '', selS.length ? `管轄の会社 ${selS.length}社` : '', below.size > 1 ? `下の部 ${below.size - 1}` : ''].filter(Boolean).join('・');
  const sec1 = `<div class="field"><span>${esc(n.name)}ごと移す（上の組織を変える）</span>
    <div class="row" style="gap:6px;flex-wrap:wrap"><select data-ch="kDeptMvDest" data-k="node" aria-label="移す先">${ksDeptMvOpts(M.dest.node ?? (n.parent || ''), dests, '社長の直下')}</select>${btn('ここへ移す', 'kDeptMvGo', { k: 'node' }, 'sm primary')}</div>
    <span class="small muted">${take ? `${esc(take)}も一緒に移ります。元の組織の受け持ちから外れ、移した先の受け持ちに加わります。` : '下に置いた部はありません。'}</span></div>`;
  const rowU = own.map(id => { const u = ksUnit(id); const k = 'u:' + id; return u ? `<li class="mvrow"><span>${esc(ksUName(u))}</span><select data-ch="kDeptMvDest" data-k="${esc(k)}" aria-label="${esc(ksUName(u))}の移す先">${ksDeptMvOpts(M.dest[k] ?? n.id, holders, 'どこにも入れない（社長の直下）')}</select>${btn('移す', 'kDeptMvGo', { k }, 'sm')}</li>` : ''; }).join('');
  const rowS = subs.map(x => { const k = 's:' + x.id; return `<li class="mvrow"><span>${esc(x.name)}</span><select data-ch="kDeptMvDest" data-k="${esc(k)}" aria-label="${esc(x.name)}の移す先">${ksDeptMvOpts(M.dest[k] ?? n.id, holders.filter(o => ksDeptCanHold(o)), '社長の直轄（本社）')}</select>${btn('移す', 'kDeptMvGo', { k }, 'sm')}</li>`; }).join('');
  const body = `<div class="sg-form">${sec1}
    ${rowU ? `<div class="field"><span>事業を1つずつ移す（${esc(n.name)}が直接受け持つ事業）</span><ul class="mvlist">${rowU}</ul><span class="small muted">移した先の組織と、その上の組織の受け持ちになります。</span></div>` : ''}
    ${rowS ? `<div class="field"><span>管轄の会社を1社ずつ移す</span><ul class="mvlist">${rowS}</ul><span class="small muted">経営を任せていた会社は、移した先の組織に任せます。</span></div>` : ''}</div>`;
  return modalFrame(`${esc(n.name)}を移す`, body, btn('閉じる', 'closeModal'), { size: 'wide' });
};
Object.assign(ACTIONS, {
  kDeptMove: d => { UI.orgMv = { id: d.id, dest: {} }; showModal('kDeptMove'); },
  kDeptMvGo: d => {
    const M = UI.orgMv;
    const n = M && ksDeptNode(M.id);
    if (!n) return;
    const k = d.k;
    if (k === 'node') {
      const to = M.dest.node ?? (n.parent || '');
      if ((to || null) === (n.parent || null)) { toast('いまと同じ場所です'); return; }
      if (!ksDeptMove(n.id, to || null)) { toast('そこへは移せません（自分の下の部には移せない）', 'bad'); return; }
      ksDeptShow(n);
      toast(`${n.name}を${to ? ksDeptNode(to).name + 'の下' : '社長の直下'}へ移しました`);
      closeModal(true); render(); autosave(); return;
    }
    const [t, id] = [k.slice(0, 1), k.slice(2)];
    const to = M.dest[k] ?? n.id;
    if (to === n.id) { toast('いまと同じ場所です'); return; }
    if (t === 'u') {
      const u = ksUnit(id);
      if (!u || !ksDeptMoveUnit(id, to || null)) { toast('移せませんでした', 'bad'); return; }
      if (to) ksDeptShow(ksDeptNode(to));
      toast(`${ksUName(u)}を${to ? ksDeptNode(to).name : 'どこにも入れない形（社長の直下）'}へ移しました`);
    } else {
      const x = ksSubById(id);
      if (!x) return;
      ksSubSetJur(x.id, to || null, ksSubOp(x) === 'org' && to ? 'org' : ksSubOp(x) === 'org' ? 'ceo' : null);
      if (to) ksDeptShow(ksDeptNode(to));
      toast(`${x.name}を${to ? ksDeptNode(to).name + 'の管轄' : '社長の直轄'}へ移しました`);
    }
    if (!ksDeptNode(M.id) || (!ksDeptOwnUnits(n).length && !ksDeptSubsOf(n).length)) { closeModal(true); render(); autosave(); return; }
    drawModal(); render(); autosave();
  },
});
CHANGES.kDeptMvDest = el => { if (UI.orgMv) UI.orgMv.dest[el.dataset.k] = el.value; };

/* ---------- 会社の管轄と経営の担い手（グループの画面・組織図・子会社の画面から） ---------- */
MODALS.kSubJur = a => {
  const root = ksRoot();
  const x = ksSubById(a.id, root);
  if (!x || x.gone) return modalFrame('管轄と経営', '<p>会社がありません</p>', btn('閉じる', 'closeModal'));
  if (!UI.subJur || UI.subJur.id !== x.id) UI.subJur = { id: x.id, node: (ksDeptSubNode(x.id, root) || {}).id || '', op: ksSubOp(x, root) };
  const J = UI.subJur;
  const nodes = ksWith(root, () => ksDeptNodes().filter(n => ksDeptCanHold(n)));
  const word = x.aff ? '関連会社' : x.parent ? '孫会社' : '子会社';
  const sel = `<select data-ch="kSubJurNode" aria-label="管轄"><option value="">社長の直轄（本社）</option>${nodes.map(n => `<option value="${esc(n.id)}"${J.node === n.id ? ' selected' : ''}>${esc(n.name)}（${esc(ksWith(root, () => ksDeptKindName(n)))}・${esc(ksWith(root, () => ksDeptHeadTitle(n)))} ${esc(n.head.name)}）</option>`).join('')}</select>`;
  const jn = J.node ? nodes.find(n => n.id === J.node) : null;
  const ops = [['self', 'あなたが直接経営する', '子会社の画面に入って、事業の値決め・人・投資を自分で決める'], ['ceo', '子会社の社長に任せる', '子会社の社長が、標準のやり方で経営する（自動）'], ['org', jn ? `${jn.name}に任せる` : '管轄の組織に任せる', jn ? `${ksWith(root, () => ksDeptHeadTitle(jn))}の${jn.head.name}が経営を見る（自動）。出来は腕前とやる気しだい。承認した方針も6割の強さで効く` : '管轄（ユニット・事業部）を選ぶと選べる']];
  const opSeg = x.aff ? '<p class="small muted" style="margin:0">関連会社は相手の会社が経営します（持分法）。管轄に置くと、売上は部の実績に入りませんが、目が届く分、不祥事が少し減ります。</p>'
    : `<div class="seg wrap" role="radiogroup" aria-label="経営の担い手">${ops.map(([k, l]) => `<button type="button" data-act="kSubJurOp" data-v="${k}" aria-pressed="${J.op === k}"${k === 'org' && !jn ? ' disabled' : ''}>${esc(l)}</button>`).join('')}</div><span class="small muted">${esc((ops.find(o => o[0] === J.op) || ops[1])[2])}</span>`;
  const none = nodes.length ? '' : `<div class="callout small">まだユニットも事業部もありません。「組織」の画面でユニット（事業本部）か事業部をつくると、その管轄に会社を置き、経営を任せられます。 ${btn('組織へ', 'kGo', { tab: 'k_org' }, 'sm')}</div>`;
  const body = `<p class="small" style="margin:0 0 8px"><b>${esc(x.name)}</b>（${word}・持分${Math.round(x.own * 100)}%・${esc(ksWith(x.st, ksCompanyDesc) || '事業なし')}）</p>${none}
    <div class="sg-form"><label class="field"><span>管轄（親会社の中で、この会社を見るユニット・事業部）</span>${sel}<span class="small muted">管轄に置くと、会社の売上が部の実績（予算と定例会）に入ります。</span></label>
    <div class="field"><span>経営の担い手</span>${opSeg}</div></div>`;
  return modalFrame('管轄と経営', body, btn('やめる', 'closeModal') + btn('この設定にする', 'kSubJurGo', {}, 'primary'), { size: 'wide' });
};
Object.assign(ACTIONS, {
  kSubJur: d => { UI.subJur = null; showModal('kSubJur', { id: d.id }); },
  kSubJurOp: d => { UI.subJur.op = d.v; drawModal(); },
  kSubJurGo: () => {
    const J = UI.subJur, root = ksRoot();
    const x = J && ksSubById(J.id, root);
    if (!x) return;
    const op = J.op === 'org' && !J.node ? 'ceo' : J.op;
    ksWith(root, () => { ksDeptInit(); ksSubSetJur(x.id, J.node || null, op); });
    const n = J.node ? ksWith(root, () => ksDeptNode(J.node)) : null;
    toast(`${x.name}：管轄を${n ? n.name : '社長の直轄'}にしました。経営は${ksSubOpName(x, root)}`);
    UI.subJur = null;
    closeModal(true); render(); autosave();
  },
});
CHANGES.kSubJurNode = el => { UI.subJur.node = el.value; if (!el.value && UI.subJur.op === 'org') UI.subJur.op = 'ceo'; drawModal(); };

/* ---------- 方針のレビュー ---------- */
MODALS.kDeptPolicy = () => {
  const R = UI.orgPol;
  const n = R && ksDeptNode(R.id);
  if (!n || !n.pol) return modalFrame('方針', '<p>方針がありません</p>', btn('閉じる', 'closeModal'));
  const P = n.pol, T = KS_DEPT_THEME[P.theme], H = n.head, st = KS_DEPT_STYLE[H.style] || KS_DEPT_STYLE.solid;
  const done = P.status === 'ok';
  const tgt = T.kpi === 'sales' ? `受け持つ事業の売上を ${P.target >= 0 ? '+' : ''}${P.target}%（前の期より）` : T.kpi === 'cost' ? `費用を ${Math.max(0, P.target)}% 減らす` : T.kpi === 'acc' ? `労災ゼロ（危険を${P.target}%減らす）` : `${T.n}：${P.target}% 改善する`;
  const c = ksDeptCostEst(n);
  const head = `<div class="orgpol-h"><span class="indico" aria-hidden="true">${KS_DEPT_FN_ICON[n.fn] || '部'}</span><div><b>${esc(n.name)}</b>（${esc(ksDeptKindName(n))}）<div class="small">${esc(ksDeptHeadTitle(n))} ${esc(H.name)}　${esc(st.n)}（${esc(st.d)}）・腕前 ${'★'.repeat(H.skill)}${'☆'.repeat(5 - H.skill)}・やる気 ${Math.round(H.mot)}</div></div></div>`;
  const plan = `<div class="orgpol-b"><div class="small muted">${P.fy > fyOf(G.m) ? '来期' : ksFyLabel(P.fy)}の方針（${esc(ksDeptHeadTitle(n))}の${done ? '方針' : '案'}）</div>
    <h3 class="fsh" style="margin:4px 0">${esc(T.n)}</h3>
    ${kv([['目標', esc(tgt)], ['取り組み', `<ul class="small" style="margin:0;padding-left:1.2em">${P.acts.map(a => `<li>${esc(a)}</li>`).join('')}${P.add ? '<li>安全と品質の取り組み（社長の指摘で追加）</li>' : ''}</ul>`], ['予算', `${P.budS ? `売上 ${fmtYen(P.budS)}／年・` : ''}部の費用 ${fmtYen(P.budC)}／年（月 約${fmtYen(c.total)}）`], ['計画の質', `${Math.round((P.q || 1) * 100)}点`]])}</div>`;
  if (done) {
    const log = (P.log || []).map(l => `<li>${ymLabel(l.m)}：${{ good: 'よい', ok: 'このままで', redo: '作り直し' }[l.rate] || l.rate}${l.fb.length ? `（指摘：${l.fb.map(k => KS_DEPT_FB[k].n).join('・')}）` : ''}</li>`).join('');
    return modalFrame('部長の方針', head + plan + (log ? `<h4 class="fsh" style="margin-top:10px">レビューの記録</h4><ul class="small">${log}</ul>` : ''), btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide' });
  }
  const rates = [['good', 'よい（ほめる）'], ['ok', 'このままで承認'], ['redo', '作り直しを求める']].map(([k, l]) => `<button type="button" data-act="kDeptPolRate" data-v="${k}" aria-pressed="${R.rate === k}">${l}</button>`).join('');
  const fbs = Object.entries(KS_DEPT_FB).map(([k, x]) => `<label class="fbopt"><input type="checkbox" data-ch="kDeptPolFb" value="${k}" ${R.fb.includes(k) ? 'checked' : ''}><span><b>${esc(x.n)}</b><span class="small muted">${esc(x.d)}</span></span></label>`).join('');
  const themes = `<select data-ch="kDeptPolTheme" aria-label="テーマ"><option value="">部長の案のまま（${esc(T.n)}）</option>${Object.entries(KS_DEPT_THEME).filter(([k]) => k !== P.theme).map(([k, x]) => `<option value="${k}"${R.theme === k ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select>`;
  const hint = `<p class="note">目標は、高すぎると残業と労災が増え、部長のやる気が下がります。低すぎると取り組みがゆるみます。${st.n === '攻め' ? 'この部長は高い目標を立てがちです。' : st.n === '慎重' ? 'この部長は低めの目標を立てがちです。' : ''}的を射た指摘は部長の納得を生み、的外れな指摘はやる気を下げます。</p>`;
  const form = `<div class="sg-form" style="margin-top:10px"><div class="field"><span>評価</span><div class="seg wrap" role="radiogroup">${rates}</div></div>
    <div class="field"><span>指摘（いくつでも）</span><div class="orgfbs">${fbs}</div></div>
    <label class="field"><span>テーマを変える（社長の指示）</span>${themes}</label>${hint}</div>`;
  return modalFrame('部長の方針をレビューする', head + plan + form, btn('あとで', 'closeModal') + btn(R.rate === 'redo' ? '作り直しを求める' : 'レビューを返して承認する', 'kDeptPolGo', {}, 'primary'), { size: 'wide' });
};
Object.assign(ACTIONS, {
  kDeptPolRate: d => { UI.orgPol.rate = d.v; drawModal(); },
  kDeptPolGo: () => {
    const R = UI.orgPol;
    const n = ksDeptNode(R.id);
    if (!n) return;
    const res = ksDeptReview(R.id, { rate: R.rate, fb: R.fb, theme: R.theme || undefined });
    if (!res) return;
    const msg = res.msgs.filter(Boolean).join('。') || '方針を承認しました';
    toast(`${n.name}：${msg}${res.status === 'ok' ? '' : '。新しい案が出たので、もう一度レビューしてください'}（やる気 ${res.mot >= 0 ? '+' : ''}${res.mot}）`, res.mot < 0 ? 'bad' : '');
    if (res.status === 'ok') { UI.orgPol = null; closeModal(); } else { UI.orgPol = { id: R.id, rate: 'ok', fb: [], theme: '' }; drawModal(); }
    render();
    autosave();
  },
});
Object.assign(CHANGES, {
  kDeptPolFb: el => { const f = UI.orgPol.fb; const i = f.indexOf(el.value); if (el.checked && i < 0) f.push(el.value); if (!el.checked && i >= 0) f.splice(i, 1); },
  kDeptPolTheme: el => { UI.orgPol.theme = el.value; },
});

/* ---------- 四半期の定例会 ---------- */
MODALS.kDeptMeet = args => {
  const O = G.org;
  const mt = O && O.meets.find(x => x.id === args.id);
  if (!mt) return modalFrame('定例会', '<p>記録がありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  if (!UI.orgMeet || UI.orgMeet.id !== mt.id) UI.orgMeet = { id: mt.id, ch: Object.fromEntries(mt.rows.map(r => [r.id, { rate: KS_DEPT_GRADES[r.self], fb: 'keep' }])) };
  const C = UI.orgMeet.ch;
  const pct = (a, b) => (b ? `${Math.round(a / b * 100)}%` : '―');
  const comp = mt.comp ? `<div class="callout small"><b>会社の予算と実績（${ksFyLabel(mt.fy)}・第${mt.q}四半期まで）</b><br>${ksSalesName()}：実績 ${fmtYen(mt.comp.actS)}／年の予算 ${fmtYen(mt.comp.budS)}（${pct(mt.comp.actS, mt.comp.budS)}・経過 ${Math.round(mt.comp.share * 100)}%）　経常利益：実績 ${fmtYen(mt.comp.actO)}／年の予算 ${fmtYen(mt.comp.budO)}</div>` : '';
  const rows = mt.rows.map(r => {
    const c = C[r.id] || { rate: KS_DEPT_GRADES[r.self], fb: 'keep' };
    const bud = (r.budS ? `${ksSalesName()}：実績 ${fmtYen(r.sales)}／四半期の予算 ${fmtYen(r.budS)}（${pct(r.sales, r.budS)}）` : `部の費用：実績 ${fmtYen(r.cost)}／四半期の予算 ${fmtYen(r.budC)}（${pct(r.cost, r.budC)}）`) + (r.subS ? `<span class="muted">（うち管轄の会社 ${fmtYen(r.subS)}・直近3か月）</span>` : '') + (r.run ? ' <span class="tag ok">運営を任せている</span>' : '');
    const rateSeg = mt.done ? `<b>${esc(r.rate || '―')}</b>${r.dm !== undefined ? `<span class="small muted">（やる気 ${r.dm >= 0 ? '+' : ''}${r.dm}）</span>` : ''}` : `<div class="seg sm" role="radiogroup" aria-label="${esc(r.name)}の評価">${KS_DEPT_GRADES.map(g => `<button type="button" data-act="kDeptMeetRate" data-id="${esc(r.id)}" data-v="${g}" aria-pressed="${c.rate === g}">${g}</button>`).join('')}</div>`;
    const fbSel = mt.done ? `<span class="small">${esc((KS_DEPT_MEET_FB[r.fb] || KS_DEPT_MEET_FB.keep).n)}</span>` : `<select data-ch="kDeptMeetFb" data-id="${esc(r.id)}" aria-label="${esc(r.name)}への指摘">${Object.entries(KS_DEPT_MEET_FB).map(([k, x]) => `<option value="${k}"${c.fb === k ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select>`;
    return `<li class="meetr"><div class="meetr-t"><b>${esc(r.name)}</b>${tag(r.kind)}<span class="small muted">${esc(r.head)}（${esc((KS_DEPT_STYLE[r.style] || KS_DEPT_STYLE.solid).n)}）</span></div>
      <div class="small">${bud}</div><div class="small">方針：${r.theme ? esc(KS_DEPT_THEME[r.theme].n) : '―'}　${esc(r.kt)}</div>
      <div class="small meetr-say">「${esc(r.say)}」　自己評価 <b>${KS_DEPT_GRADES[r.self]}</b></div>
      <div class="meetr-c">${rateSeg}${fbSel}</div></li>`;
  }).join('');
  const body = `${comp}<p class="small" style="margin:8px 0">実績に見合った評価は部長の納得とやる気につながります。実績より厳しすぎる評価はやる気を大きく下げ、甘すぎる評価は取り組みをゆるめます。指摘は次の四半期の取り組みに効きます。</p><ul class="meetrows">${rows}</ul>`;
  const foot = mt.done ? btn('閉じる', 'closeModal', {}, 'primary') : btn('あとで', 'closeModal') + btn('自己評価のとおりにする', 'kDeptMeetSelf', {}, '') + btn('この評価で終える', 'kDeptMeetGo', {}, 'primary');
  return modalFrame(`${ksFyLabel(mt.fy)} 第${mt.q}四半期の定例会`, body, foot, { size: 'wide', sub: `${ymLabel(mt.m)}末・部とユニット ${mt.rows.length}` });
};
Object.assign(ACTIONS, {
  kDeptMeetRate: d => { const C = UI.orgMeet.ch; C[d.id] = Object.assign({}, C[d.id], { rate: d.v }); drawModal(); },
  kDeptMeetSelf: () => {
    const mt = G.org.meets.find(x => x.id === UI.orgMeet.id);
    for (const r of mt.rows) UI.orgMeet.ch[r.id] = Object.assign({}, UI.orgMeet.ch[r.id], { rate: KS_DEPT_GRADES[r.self] });
    drawModal();
  },
  kDeptMeetGo: () => {
    const M = UI.orgMeet;
    const res = ksDeptMeetResolve(M.id, M.ch) || [];
    const up = res.filter(r => r.dm > 0).length, down = res.filter(r => r.dm < 0).length;
    toast(`定例会を終えました。部長のやる気：上がった ${up}人・下がった ${down}人`, down > up ? 'bad' : '');
    UI.orgMeet = null;
    closeModal(true);
    render();
    autosave();
  },
});
CHANGES.kDeptMeetFb = el => { const C = UI.orgMeet.ch; C[el.dataset.id] = Object.assign({}, C[el.dataset.id], { fb: el.value }); };
