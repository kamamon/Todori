'use strict';
/* =========================================================
 *  29l_kaisha_group2_ui.js : グループの再編の画面
 *   社名の変更・持分の買い増し（株式交換）・合併・傘下に移す・孫会社の設立・関連会社の決算書
 * ========================================================= */

/* ---------- 社名（商号）の変更 ---------- */
function ksRenameHtml(id) {
  const root = ksRoot();
  const s = id && id !== 'root' ? ksSubById(id, root) : null;
  const st = s ? s.st : root;
  const word = KS_FORMS[ksForm(st)].pre;
  const c = ksRenameCost(st);
  const v = UI.kRen && UI.kRen.id === (id || 'root') ? UI.kRen.name : st.coName;
  return `<p class="small" style="margin:0 0 6px">商号は定款に書かれているので、株主総会の特別決議で定款を変え、2週間以内に変更の登記をします。商号には会社の種類（「${esc(word)}」）を入れます。前に付けても（前株）後に付けても（後株）かまいません。</p>
    <div class="row" style="gap:6px;flex-wrap:wrap"><input type="text" value="${esc(v)}" maxlength="40" data-in="kRenName" data-id="${esc(id || 'root')}" aria-label="新しい社名" style="flex:1 1 220px;min-width:0">${btn('社名を変える', 'kRenGo', { id: id || 'root' }, 'sm primary')}</div>
    <p class="small muted" style="margin:6px 0 0">費用 ${fmtYen(c.reg + c.fee + c.signs)}（登録免許税 ${fmtYen(c.reg)}・司法書士 ${fmtYen(c.fee)}・看板・名刺・印鑑・ウェブ・取引先への案内 ${fmtYen(c.signs)}）。${st.coNameOld ? `前の社名：${esc(st.coNameOld)}` : ''}</p>`;
}
INPUTS.kRenName = el => { UI.kRen = { id: el.dataset.id, name: el.value }; };
ACTIONS.kRenGo = d => {
  if (ksClosingBlock()) return;
  const name = UI.kRen && UI.kRen.id === d.id ? UI.kRen.name : '';
  const r = ksGroupRename(d.id, name);
  toast(r.ok ? '社名を変えました' : r.why, r.ok ? '' : 'bad');
  if (r.ok) UI.kRen = null;
  if (UI.modal) drawModal();
  render(); autosave();
};

/* ---------- 再編・社名（会社ごと） ---------- */
ACTIONS.kSubOps = d => { UI.kOps = { id: d.id, to: null, merge: null, parent: null }; UI.kRen = null; showModal('kSubOps'); };
MODALS.kSubOps = () => {
  const root = ksRoot();
  const O = UI.kOps;
  const s = O && ksSubById(O.id, root);
  if (!s || s.gone) return modalFrame('再編', '<p>会社がありません。</p>', btn('閉じる', 'closeModal'));
  const sec = [];
  sec.push(`<h3 class="fsh">社名を変える</h3>${ksRenameHtml(s.id)}`);
  // 持分の買い増し
  if (s.own < 0.9999) {
    const opts = [...new Set([0.51, 0.67, 0.8, 1].filter(v => v > s.own + 0.001).concat(s.aff ? [Math.min(0.5, Math.round((s.own + 0.1) * 100) / 100)] : []))].filter(v => v > s.own).sort((a, b) => a - b);
    const to = O.to && opts.includes(O.to) ? O.to : opts[opts.length - 1];
    O.to = to;
    const q = ksBuyMoreQuote(s.id, to);
    const seg = opts.map(v => `<button type="button" data-act="kOpsTo" data-v="${v}" aria-pressed="${v === to}">${Math.round(v * 100)}%</button>`).join('');
    const what = q.control ? '持分法の関連会社から<b>連結子会社</b>になります（段階取得：前から持っていた株を時価で測りなおし、差を損益に）。' : s.aff ? '持分法の関連会社のままです。' : '連結では、のれんは増やさず、非支配株主持分の減少との差を資本剰余金にします。';
    sec.push(`<h3 class="fsh">持分を買い増す</h3><p class="small" style="margin:0 0 6px">いまの持分 ${Math.round(s.own * 100)}%。${esc(s.partner || 'ほかの株主')}から株を買います。${what}</p>
      <div class="seg" role="radiogroup">${seg}</div>
      ${q.ok ? `<p class="small" style="margin:6px 0">価格 <b>${fmtYen(q.price)}</b>（会社の価値 ${fmtYen(q.fair)} × ${Math.round(q.d * 100)}%${q.control ? '・支配権のプレミアム15%' : '・プレミアム5%'}）</p>` : `<p class="small neg">${esc(q.why)}</p>`}
      <div class="row" style="gap:6px;flex-wrap:wrap">${btn('現金で買う', 'kMoreGo', { id: s.id, ex: 0 }, 'sm primary')}${q.exchangeOK ? btn('株式交換で100%にする（現金は要らない）', 'kMoreGo', { id: s.id, ex: 1 }, 'sm') : ''}</div>
      ${q.exchangeOK ? `<p class="note">株式交換：${esc(root.coName)}が新しく株式を発行して相手に渡し、${esc(s.name)}を完全子会社にします。親会社の資本準備金が増え、現金は出ていきません（既存の株主の持分は薄まる）。</p>` : ''}`);
  }
  // 合併
  if (!s.aff) {
    const ownerId = ksRecOwnerId(s);
    const cands = [[ownerId, `${ownerId === 'root' ? root.coName : ksSubById(ownerId, root).name}（この会社の株主）に吸収される`], ...ksCSubs(root).filter(x => x !== s && ksRecOwnerId(x) === ownerId).map(x => [x.id, `兄弟の${x.name}に吸収される`])];
    const into = O.merge && cands.some(c => c[0] === O.merge) ? O.merge : cands[0][0];
    O.merge = into;
    const chk = ksMergerCheck(s.id, into, root);
    const sched = (root.group.mergers || []).find(x => x.from === s.id);
    sec.push(`<h3 class="fsh">合併する</h3>${sched ? `<p class="small">${ymLabel(sched.m)}1日に合併する予定です。${btn('取りやめる', 'kMergeCancel', { id: sched.id }, 'sm ghost')}</p>` : `<label class="field"><span>吸収する会社（存続会社）</span><select data-ch="kOpsMerge">${cands.map(([v, l]) => `<option value="${v}"${v === into ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${chk.ok ? `<p class="small" style="margin:6px 0">効力発生日は${ymLabel(ksMergerEffM(root))}1日（期首）。${esc(s.name)}の事業・従業員・資産と負債・契約をまとめて引き継ぎ、${esc(s.name)}は解散します。${chk.mode === 'up' ? '株主の会社が吸収するので、持っていた株式は消え、純資産との差は「抱合せ株式消滅差損益」（個別の特別損益。連結では消す）になります。' : '兄弟の会社どうしなので、純資産（資本金・利益剰余金など）をそのまま引き継ぎ、損益は出ません。'}重複する本社の費用が減ります。費用 約${fmtYen(KS_MERGER_COST.reg + KS_MERGER_COST.koukoku + KS_MERGER_COST.pro)}（登記・官報公告・専門家）。</p>` : `<p class="small neg">${esc(chk.why)}</p>`}
      ${btn('合併の契約を結ぶ', 'kMergeGo', { id: s.id }, 'sm', { disabled: !chk.ok })}`}`);
  }
  // 傘下に移す
  const tgs = ksReparentTargets(s.id, root);
  if (tgs.length) {
    const to = O.parent && tgs.some(t => t.id === O.parent) ? O.parent : tgs[0].id;
    O.parent = to;
    sec.push(`<h3 class="fsh">ほかの会社の傘下に移す（中間持株会社）</h3><p class="small" style="margin:0 0 6px">いまは${esc(ksOwnerNameOf(s, root))}が持っています。グループの中で株の持ち主を変えます（帳簿の価額のまま。親会社から子会社へ移すときは現物出資、それ以外は帳簿の価額で買い取り）。連結の損益は変わりません。</p>
      <div class="row" style="gap:6px;flex-wrap:wrap"><select data-ch="kOpsParent" aria-label="移す先">${tgs.map(t => `<option value="${t.id}"${t.id === to ? ' selected' : ''}>${esc(t.n)}${t.id === 'root' ? '（親会社）' : ''}</option>`).join('')}</select>${btn('移す', 'kReparentGo', { id: s.id }, 'sm')}</div>`);
  }
  // 孫会社をつくる
  if (!s.aff && (!s.cc || s.cc === 'jp')) sec.push(`<h3 class="fsh">この会社の下に会社をつくる（孫会社）</h3><p class="small" style="margin:0 0 6px">${esc(s.name)}が出資して、新しい会社をつくります。孫会社の経営指導料と配当は${esc(s.name)}が受け取ります。</p>${btn('孫会社をつくる', 'kFoundUnder', { id: s.id }, 'sm')}`);
  return modalFrame(`${esc(s.name)}の再編と社名`, sec.join(''), btn('閉じる', 'closeModal'), { size: 'narrow' });
};
ACTIONS.kOpsTo = d => { UI.kOps.to = +d.v; drawModal(); };
CHANGES.kOpsMerge = el => { UI.kOps.merge = el.value; drawModal(); };
CHANGES.kOpsParent = el => { UI.kOps.parent = el.value; };
ACTIONS.kMoreGo = d => {
  if (ksClosingBlock()) return;
  const r = ksGroupBuyMore(d.id, UI.kOps.to, { exchange: +d.ex === 1 });
  toast(r.ok ? (r.exch ? '株式交換で完全子会社にしました' : `${fmtYen(r.price)}で株を買い増しました`) : r.why, r.ok ? '' : 'bad');
  UI.kOps.to = null;
  drawModal(); render(); autosave();
};
ACTIONS.kMergeGo = d => {
  if (ksClosingBlock()) return;
  const r = ksGroupScheduleMerger(d.id, UI.kOps.merge);
  toast(r.ok ? `合併の契約を結びました（${ymLabel(r.x.m)}1日に効力）` : r.why, r.ok ? '' : 'bad');
  drawModal(); render(); autosave();
};
ACTIONS.kMergeCancel = d => { ksGroupCancelMerger(d.id); toast('合併を取りやめました'); if (UI.modal) drawModal(); render(); autosave(); };
ACTIONS.kReparentGo = d => {
  if (ksClosingBlock()) return;
  const r = ksGroupReparent(d.id, UI.kOps.parent);
  toast(r.ok ? '傘下に移しました' : r.why, r.ok ? '' : 'bad');
  UI.kOps.parent = null;
  drawModal(); render(); autosave();
};
ACTIONS.kFoundUnder = d => {
  UI.kGF = Object.assign(UI.kGF || { q: '', type: null, sc: 1, own: 1, cc: 'jp', pref: G.loc ? G.loc.hq : 22, amt: null, name: '' }, { owner: d.id, amt: null });
  UI.kGrpSec = 'make';
  closeModal(true); render(); scrollToMain();
};

/* ---------- 関連会社の決算書（経営はほかの株主が主導するので、中には入れない） ---------- */
ACTIONS.kAffView = d => showModal('kAffView', { id: d.id });
MODALS.kAffView = a => {
  const s = ksSubById(a.id);
  if (!s || s.gone) return modalFrame('関連会社', '', btn('閉じる', 'closeModal'));
  const ys = ksWith(s.st, () => ksFYList().slice(-3).map(fy => ({ fy, s: ksToBankFS(G.fys[fy]), lab: ksFyLabel(fy) })));
  const rows = [['S', '売上高'], ['OPI', '営業利益'], ['ORD', '経常利益'], ['NI', '当期純利益'], ['TA', '総資産'], ['EQ', '純資産'], ['CASH', '現預金']];
  const tbl = ys.length ? `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（千円）</th>${ys.map(y => `<th class="n">${y.lab}</th>`).join('')}</tr></thead><tbody>${rows.map(([k, n]) => `<tr><td>${n}</td>${ys.map(y => `<td class="n">${fmtK(y.s[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">まだ決算がありません</div>';
  const ytd = ksWith(s.st, ksYTD);
  return modalFrame(`${esc(s.name)}（関連会社・持分${Math.round(s.own * 100)}%）`, `${tbl}${kv([['今期の売上（月次）', fmtYen(ytd.sales)], ['今期の経常利益', ksNum(ytd.ord)], ['経営の主導', esc(s.partner || 'ほかの株主')]])}<p class="note">関連会社は合算せず、純利益のうち持分の分を「持分法による投資損益」として連結に取り込みます。過半数まで株を買い増すと、子会社として全部を連結し、自分で経営できます（「再編・社名」から）。</p>`, btn('閉じる', 'closeModal'));
};

/* ---------- 連結決算の画面：関連会社と資本剰余金 ---------- */
const ksGrpConsHtmlG0 = ksGrpConsHtml;
ksGrpConsHtml = function () {
  const html = ksGrpConsHtmlG0();
  const g = G.group;
  const fys = Object.keys(g.cons).map(Number).sort((a, b) => a - b);
  if (!fys.length) return html;
  const fy = UI.kGrpFy !== null && g.cons[UI.kGrpFy] ? UI.kGrpFy : fys[fys.length - 1];
  const c = g.cons[fy];
  const extra = [];
  if (c.affs && c.affs.length) extra.push(panel('持分法を適用した関連会社', `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>会社</th><th class="n">持分</th><th class="n">取得の額</th><th class="n">持分法の額</th><th class="n">今期の投資損益</th></tr></thead><tbody>${c.affs.map(x => `<tr><td>${esc(x.n)}</td><td class="n">${Math.round(x.own * 100)}%</td><td class="n">${fmtYen(x.inv)}</td><td class="n">${fmtYen(x.emv)}</td><td class="n ${x.inc < 0 ? 'neg' : ''}">${ksNum(x.inc)}</td></tr>`).join('')}</tbody></table></div><p class="note">連結貸借対照表の関係会社株式は、持分法の額（取得の額＋取得の後の利益の持分−配当−投資差額の償却）です。</p>`));
  if (c.bs.capAdj) extra.push(panel('持分の追加取得による資本剰余金', `<p class="small" style="margin:0">子会社の株を買い増したときの、払った額と非支配株主持分の減少の差の累計：<b>${ksNum(c.bs.capAdj)}</b>（連結の資本剰余金に含む）。支配が続いている子会社の株の売り買いは、資本の取引として扱い、損益にしません。</p>`));
  return extra.length ? html.replace('<div class="grid g2">', `<div class="grid g2" style="margin-bottom:10px">${extra.join('')}</div><div class="grid g2">`) : html;
};

/* ---------- 用語 ---------- */
Object.assign(TERMS, {
  mochibunho: { n: '持分法', c: 'book', s: '関連会社（20〜50%）の利益のうち、持分の分だけを連結に取り込む方法。', b: '関連会社の決算書は合算せず、投資の額（関係会社株式）を、取得の後の利益の持分だけ増やし、受け取った配当だけ減らします。損益計算書には「持分法による投資損益」として営業外の損益に1行で入ります。「一行連結」とも呼ばれます。', see: ['renketsu'] },
  gappei: { n: '合併', c: 'book', s: '2つ以上の会社が1つになること。', b: '吸収合併では存続会社が消滅会社の権利と義務をまとめて引き継ぎ、新設合併では新しい会社がすべてを引き継ぎます。株主総会の特別決議・債権者保護手続・登記が要ります。親会社が100%子会社を吸収するとき、子会社の純資産と、持っていた子会社株式の帳簿価額の差は「抱合せ株式消滅差損益」（特別損益）になります。', see: ['renketsu'] },
  tsuikaShutoku: { n: '持分の追加取得', c: 'book', s: '支配している子会社の株を、さらに買い増すこと。', b: '連結では、支配が続いている子会社の株の売り買いは資本の取引として扱います。払った額と、減った非支配株主持分の差は、のれんでも損益でもなく資本剰余金にします（2013年の会計基準の改正から）。関連会社の株を買い増して支配を得たとき（段階取得）は、前から持っていた株を時価で測りなおし、差を損益にします。', see: ['nci', 'mochibunho'] },
});
