'use strict';
/* =========================================================
 *  29q_kaisha_org_ui.js : 「組織」の画面
 *   組織図（ユニット・部・支店・海外支店）、部の設定、部長の方針のレビュー、四半期の定例会
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
function ksDeptCard(n, depth) {
  const F = KS_DEPT_FN[n.fn];
  const kids = ksDeptKids(n.id);
  const sc = ksDeptScope(n);
  const own = ksDeptOwnUnits(n);
  const c = ksDeptCostEst(n);
  const need = F.ratio ? ksDeptNeed(n) : 0;
  const st = KS_DEPT_STYLE[n.head.style] || KS_DEPT_STYLE.solid;
  const where = own.length ? ksDeptUnitNames(own) : n.fn === 'biz' && n.kind === 'dept' && !kids.length ? '（事業を選んでいません。「設定」で受け持つ事業を選べます）' : sc.all ? '会社の全事業' : `${ksDeptUnitNames(sc.units)}（${n.kind === 'bu' ? '下の部の事業' : '上の組織から'}）`;
  const branch = ksDeptIsBranch(n);
  const pend = n.pol && n.pol.status !== 'ok';
  return `<li class="orgn"><div class="orgc${n.kind === 'bu' ? ' bu' : ''}${branch ? ' br' : ''}${pend ? ' pend' : ''}">
    <div class="orgc-t"><span class="indico" aria-hidden="true">${KS_DEPT_FN_ICON[n.fn] || '部'}</span><b>${esc(n.name)}</b>${tag(ksDeptKindName(n), n.kind === 'bu' ? 'ok' : branch ? 'warn' : '')}${n.kind === 'dept' ? tag(F.n) : ''}${branch ? `<span class="small muted">${esc(ksDeptPlace(n))}</span>` : ''}</div>
    <div class="orgc-h small">${esc(ksDeptHeadTitle(n))} <b>${esc(n.head.name)}</b>（${esc(st.n)}・${'★'.repeat(n.head.skill)}${'☆'.repeat(5 - n.head.skill)}）<span class="orgc-mot">やる気 ${ksDeptMotBar(n.head.mot)}</span></div>
    <div class="orgc-d small">受け持ち：${esc(where)}${F.ratio ? `・人数 <b>${n.staff}人</b>（目安 ${need}人）` : ''}・費用 月${fmtYen(c.total)}</div>
    <div class="orgc-p small">方針：${ksDeptPolTag(n)}</div>
    <div class="orgc-a">${btn(pend ? '方針をレビュー' : '方針を見る', 'kDeptPol', { id: n.id }, pend ? 'sm primary' : 'sm')}${btn('設定', 'kDeptEdit', { id: n.id }, 'sm')}${btn('＋下に部', 'kDeptAdd', { parent: n.id, kind: 'dept' }, 'sm')}${btn('外す', 'kDeptDel', { id: n.id }, 'sm ghost')}</div></div>
    ${kids.length ? `<ul class="orgkids2">${kids.map(k => ksDeptCard(k, depth + 1)).join('')}</ul>` : ''}</li>`;
}
KS_SCREENS.k_org = () => {
  const O = G.org;
  const nodes = ksDeptNodes();
  const tops = ksDeptKids(null);
  const tree = `<ul class="orgtree2"><li class="orgn"><div class="orgc ceo"><div class="orgc-t"><span class="indico" aria-hidden="true">長</span><b>代表取締役社長 ${esc(G.ceo)}</b></div><div class="orgc-a">${btn('＋ユニット', 'kDeptAdd', { kind: 'bu' }, 'sm')}${btn('＋部・支店', 'kDeptAdd', { kind: 'dept' }, 'sm primary')}</div></div>
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
    ${panel('費用と効き目', kv([['部の数', `${nodes.length}（ユニット ${nodes.filter(n => n.kind === 'bu').length}・支店 ${nodes.filter(n => ksDeptIsBranch(n)).length}）`], ['部の人数（事業の人員とは別）', `${fmtNum(ksDeptStaffTotal(), 0)}人`], ['組織の費用', `月${fmtYen(tot)}（人件費・家賃・役職手当・方針の取り組み）`], ['会社全体への効き目', eff]]) + '<p class="note">機能の部（営業・人事・安全管理など）は、受け持つ人数に対して目安の人数がいると効き目が十分に出ます。同じ役割の部をいくつつくっても、効き目は合わせて1.3倍分までです。部の費用は本社費（給料手当・法定福利費・地代家賃・広告宣伝費など。研究開発部は研究開発費）として記帳します。</p>')}
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
  const units = ksActiveUnits().map(u => {
    const other = ksDeptNodes().find(o => o.id !== D.id && o.fn === 'biz' && (o.units || []).includes(u.id));
    return `<label class="inline small"><input type="checkbox" data-ch="kDeptUnit" value="${esc(u.id)}" ${n.units.includes(u.id) ? 'checked' : ''}> ${esc(ksUName(u))}${other && n.fn === 'biz' ? `<span class="muted">（いまは${esc(other.name)}）</span>` : ''}</label>`;
  }).join('');
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
    <div class="field"><span>受け持つ事業${n.kind === 'bu' ? '（その事業の事業部があれば、事業部ごとユニットの下に移る）' : n.fn === 'biz' ? '（1つの事業は、事業部・ユニットの1つにだけ入る）' : '（選ばなければ、上の組織か会社の全事業）'}</span><div class="orgunits">${units || '<span class="small muted">事業がありません</span>'}</div></div>
    ${n.kind === 'dept' && F.ratio ? `<label class="field"><span>部の人数</span><span class="cu-capin"><input type="number" inputmode="numeric" min="0" max="999" step="1" data-ch="kDeptStaff" value="${n.staff}"><span class="small">人</span></span><span class="small muted">受け持つ人数から見た目安は ${need}人。目安に足りないと効き目が弱く、多すぎても効き目はあまり増えません（事業の人員とは別に雇います）</span></label>` : ''}
    ${n.kind === 'dept' ? `<label class="field"><span>所在地</span>${ksDeptLocSelect(n)}<span class="small muted">${branch ? `支店として、${esc(ksDeptPlace(n))}に事務所を借ります（家賃と人件費は所在地の水準）。${(n.cc || 'jp') !== 'jp' ? '海外支店の営業は、ものづくり・卸売・専門サービス・会員サービスの輸出の需要に効きます。' : ''}` : '本社の中に置きます。'}</span></label>` : ''}
  </div>`;
  const foot = btn('やめる', 'closeModal') + btn(isNew ? 'つくる' : 'この設定にする', 'kDeptSave', {}, 'primary');
  return modalFrame(isNew ? (n.kind === 'bu' ? 'ユニットをつくる' : '部・支店をつくる') : `${esc(D.name0)}の設定`, body, foot, { size: 'wide' });
};
function ksDeptScopeOf(n) {
  // 編集中の部の受け持ち（上の組織の事業か、会社の全事業）
  for (let p = n.parent ? ksDeptNode(n.parent) : null, i = 0; p && i < 200; i++) { const us = ksDeptSubtreeUnits(p); if (us.length) return { units: us }; p = p.parent ? ksDeptNode(p.parent) : null; }
  return { units: ksActiveUnits().map(u => u.id) };
}
function ksDeptEdStore() { const D = UI.orgEd; if (!D) return; const nm = $('#orgName'); if (nm) D.n.name = nm.value; const sf = document.querySelector('#modal-root [data-ch="kDeptStaff"]'); if (sf) D.n.staff = Math.max(0, Math.round(+sf.value || 0)); }
Object.assign(ACTIONS, {
  kDeptAdd: d => {
    const kind = d.kind === 'bu' ? 'bu' : 'dept';
    UI.orgEd = { id: null, name0: '', n: { kind, name: '', parent: d.parent || null, fn: kind === 'bu' ? 'biz' : 'biz', units: [], staff: 0, pref: 0, cc: 'jp' } };
    showModal('kDeptEdit');
  },
  kDeptEdit: d => {
    const n = ksDeptNode(d.id);
    if (!n) return;
    UI.orgEd = { id: n.id, name0: n.name, n: { kind: n.kind, name: n.name, parent: n.parent || null, fn: n.fn, units: (n.units || []).slice(), staff: n.staff || 0, pref: n.pref || 0, cc: n.cc || 'jp' } };
    showModal('kDeptEdit');
  },
  kDeptEdKind: d => { ksDeptEdStore(); UI.orgEd.n.kind = d.v === 'bu' ? 'bu' : 'dept'; if (UI.orgEd.n.kind === 'bu') { UI.orgEd.n.fn = 'biz'; UI.orgEd.n.pref = 0; UI.orgEd.n.cc = 'jp'; } drawModal(); },
  kDeptSave: () => {
    ksDeptEdStore();
    const D = UI.orgEd, n = D.n;
    const F = KS_DEPT_FN[n.fn];
    if (D.id) {
      ksDeptEdit(D.id, { name: n.name, parent: n.parent || null, fn: n.fn, units: n.units, staff: n.staff, pref: n.pref, cc: n.cc });
      toast(`${ksDeptNode(D.id).name}の設定を変えました`);
    } else {
      const staffAuto = F.ratio && !(n.staff > 0) ? undefined : n.staff;
      const x = ksDeptAdd({ kind: n.kind, name: n.name, parent: n.parent, fn: n.fn, units: n.units, staff: staffAuto, pref: n.pref, cc: n.cc });
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
  kDeptTpl: d => { const made = ksDeptTemplate(d.v); toast(made.length ? `${made.map(x => x.name).join('・')}をつくりました。方針をレビューしてください` : 'すでにあります'); render(); autosave(); },
  kDeptApproveAll: () => { const k = ksDeptApproveAll(); toast(k ? `${k}件の方針を、部長の案のまま承認しました` : 'レビュー待ちの方針はありません'); render(); autosave(); },
  kDeptMeetOpen: d => showModal('kDeptMeet', { id: +d.id }),
  kDeptPol: d => { UI.orgPol = { id: d.id, rate: 'ok', fb: [], theme: '' }; showModal('kDeptPolicy'); },
});
Object.assign(CHANGES, {
  kDeptName: el => { if (UI.orgEd) UI.orgEd.n.name = el.value; },
  kDeptParent: el => { ksDeptEdStore(); UI.orgEd.n.parent = el.value || null; drawModal(); },
  kDeptFn: el => { ksDeptEdStore(); UI.orgEd.n.fn = el.value; if (!KS_DEPT_FN[el.value].ratio) UI.orgEd.n.staff = 0; drawModal(); },
  kDeptUnit: el => { ksDeptEdStore(); const u = UI.orgEd.n.units; const i = u.indexOf(el.value); if (el.checked && i < 0) u.push(el.value); if (!el.checked && i >= 0) u.splice(i, 1); drawModal(); },
  kDeptStaff: el => { if (UI.orgEd) UI.orgEd.n.staff = Math.max(0, Math.round(+el.value || 0)); },
  kDeptLoc: el => { ksDeptEdStore(); const [t, v] = el.value.split(':'); if (t === 'c') { UI.orgEd.n.cc = v; UI.orgEd.n.pref = 0; } else { UI.orgEd.n.cc = 'jp'; UI.orgEd.n.pref = +v || 0; } drawModal(); },
  kDeptAuto: el => { ksDeptInit().auto = el.checked; if (el.checked) { ksDeptApproveAll(); for (const mt of ksDeptOpenMeets()) ksDeptMeetResolve(mt.id, null); } render(); autosave(); },
});

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
    const bud = r.budS ? `${ksSalesName()}：実績 ${fmtYen(r.sales)}／四半期の予算 ${fmtYen(r.budS)}（${pct(r.sales, r.budS)}）` : `部の費用：実績 ${fmtYen(r.cost)}／四半期の予算 ${fmtYen(r.budC)}（${pct(r.cost, r.budC)}）`;
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
