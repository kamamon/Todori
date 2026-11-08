'use strict';
/* =========================================================
 *  29g_kaisha_group_ui.js : 「グループ」の画面
 *   グループの構成（親会社と子会社）・連結決算（連結精算表）・グループをつくる（設立・分社化・買収・持株会社）
 *   ・会社の形・しくみの解説。見出しの会社の切り替え（子会社の画面に入る）
 * ========================================================= */

KS_TABS.splice(KS_TABS.findIndex(t => t[0] === 'k_grow') + 1, 0, ['k_group', 'グループ']);
Object.assign(UI, { kGrpSec: 'org', kGrpFy: null, kGF: null, kSplit: null, kHdRename: true });

/* ---------- 見出し：会社の切り替え ---------- */
function ksGroupMastHtml() {
  const root = ksRoot();
  if (!root || !root.group || !ksSubAll(root).length) return '';
  const tree = [];
  const walk = (pid, d) => { for (const s of ksCSubs(root).filter(x => ksRecOwnerId(x) === pid)) { tree.push([s.id, `${'　'.repeat(d)}${s.name}（${d ? '孫会社' : '子会社'} ${Math.round(s.own * 100)}%）`]); walk(s.id, d + 1); } };
  walk('root', 0);
  const opts = [['root', `${root.coName}（親会社）`], ...tree];
  const cur = ksIsSubView() ? G.subId : 'root';
  return `<label class="entsw"><span class="sr">表示する会社</span><select data-ch="kView" aria-label="表示する会社">${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
function ksSubBanner() {
  if (!ksIsSubView()) return '';
  const s = ksSubById(G.subId);
  if (!s) return '';
  return `<div class="subbanner" role="note"><b>${s.parent ? '孫会社' : '子会社'}の画面</b>：${esc(s.name)}（${esc(ksOwnerNameOf(s))}の${s.own >= 0.9999 ? '100%子会社' : `持分${Math.round(s.own * 100)}%`}${s.cc && s.cc !== 'jp' ? `・${esc(KS_COUNTRIES[s.cc].n)}の現地法人。帳簿は設立のときのレートで円に直した額` : ''}）。${s.auto ? '経営は子会社の社長に任せています（自動）' : 'あなたが直接経営しています'}。月末の締めは、グループ全体で進みます。
    ${btn(s.auto ? '自分で経営する' : '子会社の社長に任せる', 'kSubAuto', { id: s.id }, 'sm')}${btn('親会社に戻る', 'kView', { v: 'root' }, 'sm primary')}</div>`;
}
CHANGES.kView = el => ksSwitchView(el.value);
ACTIONS.kView = d => ksSwitchView(d.v);
function ksSwitchView(id) {
  if (G && G.closing && !ksIsSubView() && id !== 'root') { toast('決算整理が終わってから子会社の画面に入りましょう', 'bad'); render(); return; }
  if (!ksViewEntity(id === 'root' ? null : id)) return;
  UI.tab = id === 'root' ? 'k_group' : 'k_dash';
  UI.kFy = null; UI.kJm = null; UI.kUnit = null; UI.kGrowU = null;
  render();
  window.scrollTo({ top: 0 });
  const st = G;
  if (st.pendingModals && st.pendingModals.length) { UI.queue = st.pendingModals.map(s => ({ name: s.type, args: s })); st.pendingModals = []; const n = UI.queue.shift(); showModal(n.name, n.args); }
}
ACTIONS.kSubAuto = d => { const s = ksSubById(d.id); if (!s) return; s.auto = !s.auto; toast(s.auto ? '経営を子会社の社長に任せました' : 'この子会社は、あなたが直接経営します'); render(); autosave(); };

/* ---------- グループの画面 ---------- */
KS_SCREENS.k_group = () => {
  if (ksIsSubView()) return `<h1 class="h1">グループ</h1><div class="callout">グループの管理は親会社の画面で行います。${btn('親会社に戻る', 'kView', { v: 'root' }, 'sm primary')}</div>`;
  ksGroupInit();
  const sec = UI.kGrpSec || 'org';
  const subs = [['org', 'グループの構成'], ['cons', '連結決算'], ['make', 'グループをつくる'], ['form', '会社の形'], ['learn', 'しくみ']];
  const body = sec === 'org' ? ksGrpOrgHtml() : sec === 'cons' ? ksGrpConsHtml() : sec === 'make' ? ksGrpMakeHtml() : sec === 'form' ? ksGrpFormHtml() : ksGrpLearnHtml();
  return `<h1 class="h1">グループ</h1><p class="lead">子会社を設立する・事業を分社化する・他社の株式を買う・持株会社にする。グループ全体の成績は、親会社と子会社の決算書を合算して内部の取引を消した<b>${term('連結決算書', 'renketsu')}</b>で見ます。</p>
    <div class="subtabs" role="tablist">${subs.map(([k, l]) => `<button type="button" data-act="kGrpSec" data-v="${k}" aria-pressed="${sec === k}">${l}</button>`).join('')}</div>${body}`;
};
ACTIONS.kGrpSec = d => { UI.kGrpSec = d.v; render(); };
function ksKindName(s) { return s.aff ? '関連会社（持分法）' : s.kind === 'start' ? (s.own < 1 ? '就任の時からの合弁会社' : '就任の時からの子会社') : ({ new: '設立した子会社', jv: '合弁会社', split: '分社化した子会社', acq: '買収した子会社', hd: '事業子会社' }[s.kind] || '子会社'); }
/* ---------- 組織図の折りたたみ（会社が増えても見やすいように） ----------
 * 会社ごとに「くわしい数字とボタン」を開く／たたむ。子会社の下の会社（孫会社）の枝を開く／たたむ。
 * 表示のしかた：くわしく（すべて開く）・1行ずつ（会社を1行に）・子会社だけ（孫会社の枝もたたむ）。
 * 会社ごとに開いた／たたんだ状態は、表示のしかたを選び直すまで残す（ゲームのデータに保存） */
const KS_ORG_AUTO_LINE = 5;   // 会社がこの数以上なら、はじめは1行ずつ
function ksOrgView(root = G) {
  const g = root.group;
  if (!g.view || typeof g.view !== 'object') g.view = {};
  if (!g.view.c) g.view.c = {};
  if (!g.view.k) g.view.k = {};
  return g.view;
}
function ksOrgMode(root = G) {
  const v = ksOrgView(root);
  return v.mode || (ksSubs(root).length >= KS_ORG_AUTO_LINE ? 'line' : 'full');
}
function ksOrgCardOpen(s, root = G) {
  const v = ksOrgView(root);
  return s.id in v.c ? !!v.c[s.id] : ksOrgMode(root) === 'full';
}
function ksOrgKidsOpen(s, root = G) {
  const v = ksOrgView(root);
  return s.id in v.k ? !!v.k[s.id] : ksOrgMode(root) !== 'top';
}
ACTIONS.kOrgCard = d => { const s = ksSubById(d.id); if (!s) return; ksOrgView().c[s.id] = ksOrgCardOpen(s) ? 0 : 1; render(); autosave(); };
ACTIONS.kOrgKids = d => { const s = ksSubById(d.id); if (!s) return; ksOrgView().k[s.id] = ksOrgKidsOpen(s) ? 0 : 1; render(); autosave(); };
/* 新しくグループに入った会社は、たたむ表示のときでも開いて見せる（上の会社の枝も開く）。
 * 前に同じように開いて見せた会社は、表示のしかたに戻す */
function ksOrgShow(s, root = G) {
  if (!s || !root.group) return;
  const v = ksOrgView(root);
  if (v.last && v.last !== s.id && v.c[v.last] === 1) delete v.c[v.last];
  v.last = null;
  if (!ksOrgCardOpen(s, root)) { v.c[s.id] = 1; v.last = s.id; }
  for (let p = s.parent, i = 0; p && p !== 'root' && i < 200; i++) { const o = ksSubById(p, root); if (o && !ksOrgKidsOpen(o, root)) v.k[p] = 1; p = o && o.parent; }
}
ACTIONS.kOrgMode = d => { const v = ksOrgView(); v.mode = d.v; v.c = {}; v.k = {}; v.last = null; render(); autosave(); };

function ksSubCard(s) {
  const st = s.st;
  const ytd = ksWith(st, ksYTD);
  const L = ksWith(st, ksLastFY);
  const cash = ksWith(st, () => ksB('cash'));
  const head = ksWith(st, ksHeadcount);
  const flag = s.cc && s.cc !== 'jp' ? `<span class="tag">${esc(KS_COUNTRIES[s.cc].n)}</span>` : '';
  const sched = (ksRoot().group.mergers || []).find(x => x.from === s.id);
  const open = ksOrgCardOpen(s);
  const tags = `<span class="tag">${Math.round(s.own * 100)}%</span>${flag}${s.aff ? '<span class="tag">持分法</span>' : ''}${sched ? `<span class="tag warn">${ymLabel(sched.m)}に合併</span>` : ''}${st.over ? '<span class="tag bad">破産</span>' : ''}`;
  const sum = `<span class="ob-sum"><span>売上 ${fmtYen(ytd.sales)}</span><span>経常 <span class="${ytd.ord < 0 ? 'neg' : ''}">${fmtYen(ytd.ord)}</span></span><span>現預金 ${fmtYen(cash)}</span></span>`;
  const headBtn = `<button type="button" class="ob-head" data-act="kOrgCard" data-id="${esc(s.id)}" aria-expanded="${open}" aria-controls="ob-${esc(s.id)}" title="${open ? 'たたむ' : 'くわしく見る'}">
      <span class="ob-t"><b>${esc(s.name)}</b>${tags}</span>${open ? '' : sum}<span class="ob-chev" aria-hidden="true"></span></button>`;
  const body = open ? `<div class="ob-body" id="ob-${esc(s.id)}">
    <div class="small muted">${esc(ksKindName(s))}・持分${Math.round(s.own * 100)}%${s.partner ? `（${s.aff ? '経営の主導' : 'ほかの株主'}：${esc(s.partner)}）` : ''}</div>
    <div class="small">${esc(ksWith(st, ksCompanyDesc) || '事業なし')}</div>
    <dl class="kv sm"><dt>今期の売上（月次）</dt><dd>${fmtYen(ytd.sales)}</dd><dt>今期の経常利益</dt><dd class="${ytd.ord < 0 ? 'neg' : ''}">${fmtYen(ytd.ord)}</dd><dt>現預金</dt><dd>${fmtYen(cash)}</dd><dt>従業員</dt><dd>${head}人</dd>${L ? `<dt>前期の純利益</dt><dd class="${L.pl.ni < 0 ? 'neg' : ''}">${fmtYen(L.pl.ni)}</dd>` : ''}</dl>
    <div class="row" style="gap:4px;flex-wrap:wrap">${s.aff ? btn('決算書を見る', 'kAffView', { id: s.id }, 'sm') : btn('この会社に入る', 'kView', { v: s.id }, 'sm primary')}${btn('資金と取引', 'kSubFin', { id: s.id }, 'sm')}${btn('再編・社名', 'kSubOps', { id: s.id }, 'sm')}</div></div>` : '';
  return `<div class="orgbox sub${open ? '' : ' shut'}${s.aff ? ' aff' : ''}${st.over ? ' bad' : ''}">${headBtn}${body}</div>`;
}
/* 会社とその下の会社（木の形）。下の会社がある会社には、枝を開く／たたむ帯をつける */
function ksOrgNode(s, root) {
  const kids = ksSubsOf(s.id, root);
  if (!kids.length) return `<div class="orgnode">${ksSubCard(s)}</div>`;
  const open = ksOrgKidsOpen(s, root);
  const all = ksDescendants(s.id, root);
  const nC = kids.filter(x => !x.aff).length, nA = kids.length - nC;
  const dep = ksRecDepth(s, root);
  const word = dep === 0 ? '孫会社' : dep === 1 ? 'ひ孫会社' : '下の会社';
  const what = [nC ? `${word} ${nC}社` : '', nA ? `関連会社 ${nA}社` : ''].filter(Boolean).join('・') + (all.length > kids.length ? `（その下にも${all.length - kids.length}社）` : '');
  const tot = open ? '' : `<span class="ob-sum"><span>今期の売上 計 ${fmtYen(all.filter(x => !x.aff).reduce((a, x) => a + ksWith(x.st, ksYTD).sales, 0))}</span></span>`;
  const bar = `<button type="button" class="orgfold" data-act="kOrgKids" data-id="${esc(s.id)}" aria-expanded="${open}" aria-controls="ok-${esc(s.id)}"><span class="ob-chev" aria-hidden="true"></span><span>${what}${open ? '' : 'を表示'}</span>${tot}</button>`;
  return `<div class="orgnode">${ksSubCard(s)}${bar}${open ? `<div class="orgkids" id="ok-${esc(s.id)}">${kids.map(x => ksOrgNode(x, root)).join('')}</div>` : ''}</div>`;
}
function ksGrpOrgHtml() {
  const root = G, g = root.group;
  ksGroupMigrate(root);
  const subs = ksSubs(root);
  const top1 = ksSubsOf('root', root);
  const L = ksLastFY();
  const cons = g.cons[ksFyOfLast()];
  const top = `<div class="orgbox parent"><div class="ob-t"><b>${esc(root.coName)}</b><span class="tag">${ksIsPureHD(root) ? '純粋持株会社' : g.hd ? '事業持株会社' : '親会社'}</span><span class="tag">${esc(ksFormName(root))}</span></div>
    <div class="small">${esc(ksCompanyDesc() || '子会社の株式を持ち、グループを経営する')}</div>
    <dl class="kv sm"><dt>関係会社株式</dt><dd>${fmtYen(ksB('subShares'))}</dd><dt>子会社への貸付金</dt><dd>${fmtYen(ksB('icLoan'))}</dd><dt>現預金</dt><dd>${fmtYen(ksB('cash'))}</dd>${L ? `<dt>前期の純利益（個別）</dt><dd class="${L.pl.ni < 0 ? 'neg' : ''}">${fmtYen(L.pl.ni)}</dd>` : ''}</dl>
    <div class="row" style="gap:4px"><span class="small muted">子会社 ${ksCSubs(root).filter(x => !x.parent).length}社・孫会社 ${ksCSubs(root).filter(x => x.parent).length}社・関連会社 ${subs.filter(x => x.aff).length}社</span></div></div>`;
  const mode = ksOrgMode(root);
  const tools = subs.length >= 2 ? `<div class="orgtools"><span class="small muted">表示</span><div class="seg sm" role="radiogroup" aria-label="子会社の表示のしかた">${[['full', 'くわしく'], ['line', '1行ずつ'], ['top', '子会社だけ']].map(([k, l]) => `<button type="button" data-act="kOrgMode" data-v="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>
    <span class="small muted orgtools-hint">会社の名前を押すと、くわしい数字とボタンを開いたり、たたんだりできます。</span></div>` : '';
  const chart = subs.length ? `${tools}<div class="orgchart">${top}<div class="orgline" aria-hidden="true"></div><div class="orgsubs${mode === 'full' ? '' : ' dense'}">${top1.map(x => ksOrgNode(x, root)).join('')}</div></div>`
    : `<div class="orgchart">${top}</div><div class="empty">まだ子会社はありません。「グループをつくる」から、子会社の設立・分社化・買収・持株会社への移行ができます。</div>`;
  const gone = ksSubAll(root).filter(s => s.gone && s.out && ['sold', 'failed', 'merged', 'with'].includes(s.out.why));
  const goneTxt = s => { const o = s.out; return o.why === 'sold' ? `${ymLabel(o.m)}に${fmtYen(o.price)}で売却` : o.why === 'merged' ? `${ymLabel(o.m)}に${esc(o.into === 'root' ? root.coName : (ksSubById(o.into, root) || {}).name || '')}に吸収合併` : o.why === 'with' ? `${ymLabel(o.m)}に持ち主の会社と一緒にグループから外れた` : `${ymLabel(o.m)}に破産`; };
  const goneList = `<ul class="small" style="margin:0;padding-left:1.2em">${gone.map(s => `<li>${esc(s.name)}：${goneTxt(s)}</li>`).join('')}</ul>`;
  const goneHtml = gone.length ? panel('グループから外れた会社', gone.length > 3 ? `<details><summary class="small">${gone.length}社を表示</summary>${goneList}</details>` : goneList) : '';
  const mg = (g.mergers || []).map(x => { const c = ksSubById(x.from, root); const into = x.into === 'root' ? root.coName : (ksSubById(x.into, root) || {}).name; return c ? `<li>${esc(into)}が${esc(c.name)}を吸収合併（効力発生日 ${ymLabel(x.m)}1日）${btn('取りやめる', 'kMergeCancel', { id: x.id }, 'sm ghost')}</li>` : ''; }).join('');
  const mgHtml = mg ? panel('予定している合併', `<ul class="small" style="margin:0;padding-left:1.2em">${mg}</ul><p class="note">合併は、期首（4月1日）に効力が生じます。それまでに株主総会の承認と、債権者保護手続（官報の公告と1か月の異議の期間）を行います。</p>`) : '';
  const kpi = cons ? panel(`連結の成績（${ksFyLabel(cons.fy)}）`, kv([['連結売上高', fmtYen(cons.pl.sales)], ['連結営業利益', ksNum(cons.pl.opi)], ['親会社株主に帰属する当期純利益', ksNum(cons.pl.niParent)], ['非支配株主に帰属する当期純利益', ksNum(cons.pl.niNci)], ['連結純資産（うち非支配株主持分）', `${fmtYen(cons.bs.EQ)}（${fmtYen(cons.bs.nci)}）`], ['連結の自己資本比率', cons.bs.TA ? fmtPct((cons.bs.EQ - cons.bs.nci) / cons.bs.TA * 100, 1) : '―']]) + `<div class="row" style="margin-top:6px">${btn('連結決算書を見る', 'kGrpSec', { v: 'cons' }, 'sm')}</div>`) : '';
  const pol = subs.length ? panel('グループの方針', `<label class="inline"><input type="checkbox" data-ch="kGrpSupport" ${g.policy.support ? 'checked' : ''}> 子会社の資金が足りなくなりそうなら、親会社が貸し付けて支える（海外の子会社は直接の親会社が増資）</label>
    <p class="note">親会社の貸付金は「関係会社長期貸付金」、子会社の側は「関係会社長期借入金」。連結決算では、グループの中の貸し借りとして消します。関連会社は、経営を主導するほかの株主が資金を手当てします。${g.hd ? `<br>持株会社の本社：${g.hq.staff}人（経営企画・経理・人事・法務）。費用は子会社からの経営指導料でまかないます。` : ''}</p>`) : '';
  return `${chart}<div class="grid g2" style="margin-top:10px">${kpi}${pol}</div>${mgHtml}${goneHtml}`;
}
CHANGES.kGrpSupport = el => { G.group.policy.support = el.checked; render(); };

/* ---------- 子会社との資金と取引 ---------- */
ACTIONS.kSubFin = d => { UI.kSF = { id: d.id, amt: 3e7, fee: null, payout: null }; showModal('kSubFin'); };
MODALS.kSubFin = () => {
  const F = UI.kSF;
  const s = ksSubById(F.id);
  if (!s) return modalFrame('子会社', '', btn('閉じる', 'closeModal'));
  const icl = ksIcLoanBal(s.id);
  const foreign = s.cc && s.cc !== 'jp';
  const feeOpts = [0, 0.005, 0.01, 0.015, 0.02, 0.03, 0.05].map(v => `<option value="${v}"${Math.abs(s.fee - v) < 1e-6 ? ' selected' : ''}>${(v * 100).toFixed(1)}%</option>`).join('');
  const poOpts = [0, 0.2, 0.3, 0.5, 0.8, 1].map(v => `<option value="${v}"${Math.abs(s.payout - v) < 1e-6 ? ' selected' : ''}>${Math.round(v * 100)}%</option>`).join('');
  const on = ksOwnerNameOf(s);
  const body = `<p style="margin:0 0 8px"><b>${esc(s.name)}</b>（${esc(ksKindName(s))}・${esc(on)}の持分${Math.round(s.own * 100)}%）</p>
    ${kv([['この会社の現預金', fmtYen(ksWith(s.st, () => ksB('cash')))], s.aff ? null : ['親会社からの借入金', fmtYen(icl)], [`${on}の持つ株式（取得の額）`, fmtYen(ksRecInv(s))], ['この会社の純資産', fmtYen(Math.round(ksWith(s.st, ksEquity)))], s.gw ? [s.aff ? '投資差額（のれん相当額）' : 'のれん（連結）', `${fmtYen(s.gw)}（10年で償却。済み ${fmtYen(s.gwCum)}）`] : null].filter(Boolean))}
    <div class="grid g2" style="gap:10px;margin-top:8px">
      ${s.aff ? '' : `<label class="field"><span>経営指導料（子会社の売上に対する料率・毎月）</span><select data-ch="kSFFee">${feeOpts}</select><span class="small muted">親会社は${ksIsPureHD() ? '営業収益' : '営業外収益（経営指導料収入）'}、子会社は販管費（支払経営指導料）。${foreign ? '海外子会社への料率が高すぎると、移転価格税制で課税されることがある' : '高すぎると子会社の利益を不当に移していると見られることがある'}。</span></label>`}
      <label class="field"><span>配当性向（前期の純利益に対する配当の割合・毎年6月）</span><select data-ch="kSFPay">${poOpts}</select><span class="small muted">親会社の受取配当金は、税金の計算で益金に入れない（${s.own >= 0.9999 ? '完全子法人なので全額' : s.own > 1 / 3 ? '関連法人なので全額' : '一部'}${foreign ? '。海外子会社は95%' : ''}）。</span></label>
    </div>
    <div class="field" style="margin-top:8px"><span>金額（万円）</span><input type="number" min="100" step="100" value="${Math.round(F.amt / 1e4)}" data-ch="kSFAmt" style="width:160px"></div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${btn('増資する（出資を増やす）', 'kSFInject', {}, 'sm')}${foreign || s.aff ? '' : btn('貸し付ける', 'kSFLend', {}, 'sm')}${icl > 0 ? btn('貸付金を返してもらう', 'kSFRepay', {}, 'sm') : ''}${btn('株式を売る', 'kSFSell', {}, 'sm danger')}</div>
    <p class="note">増資：親会社は関係会社株式が増え、子会社は資本金・資本準備金が増える（連結では消し合う）。${s.own < 1 ? '合弁会社なので、相手の会社も持分に応じて出資します。' : ''}貸付：利息は毎月、市場の金利（短期プライムレート＋0.5%）で受け取ります。</p>`;
  return modalFrame(s.aff ? '関連会社との資金と取引' : '子会社との資金と取引', body, btn('閉じる', 'closeModal'), { size: 'narrow' });
};
CHANGES.kSFFee = el => { const s = ksSubById(UI.kSF.id); s.fee = +el.value; drawModal(); };
CHANGES.kSFPay = el => { const s = ksSubById(UI.kSF.id); s.payout = +el.value; drawModal(); };
CHANGES.kSFAmt = el => { const v = parseFloat(el.value); if (isFinite(v) && v > 0) UI.kSF.amt = Math.round(v) * 1e4; };
ACTIONS.kSFInject = () => { if (ksClosingBlock()) return; const r = ksGroupInject(UI.kSF.id, UI.kSF.amt); toast(r.ok ? '増資しました' : r.why, r.ok ? '' : 'bad'); drawModal(); render(); autosave(); };
ACTIONS.kSFLend = () => { if (ksClosingBlock()) return; const r = ksGroupLend(UI.kSF.id, UI.kSF.amt); toast(r.ok ? `貸し付けました（年${r.rate}%）` : r.why, r.ok ? '' : 'bad'); drawModal(); render(); autosave(); };
ACTIONS.kSFRepay = () => { if (ksClosingBlock()) return; const s = ksSubById(UI.kSF.id); const p = ksGroupRepay(s, UI.kSF.amt); toast(p ? `${fmtYen(p)}を返してもらいました` : '子会社の現預金が足りません', p ? '' : 'bad'); drawModal(); render(); autosave(); };
ACTIONS.kSFSell = () => {
  const s = ksSubById(UI.kSF.id);
  const price = niceAmount(ksSubValue(s) * s.own);
  const carry = ksRecInv(s);
  const kids = ksDescendants(s.id);
  confirmBox(`${esc(s.name)}の株式を売る`, `買い手の提示額は <b>${fmtYen(price)}</b>、${esc(ksOwnerNameOf(s))}の帳簿の額（取得の額）は ${fmtYen(carry)} です。${kids.length ? `<br>${kids.map(x => esc(x.name)).join('・')}も、一緒にグループから外れます。` : ''}差 <b>${fmtYen(price - carry)}</b> が関係会社株式売却${price >= carry ? '益（特別利益）' : '損（特別損失）'}になります。連結決算では、子会社の取得の後の利益をすでに取り込んでいるので、売却損益は別の額に修正されます。${ksIcLoanBal(s.id) ? '<br>子会社への貸付金は、売るときに返してもらいます。' : ''}`, '売却する', 'kSFSellGo', { id: s.id }, true);
};
ACTIONS.kSFSellGo = d => { if (ksClosingBlock()) return; const r = ksGroupSell(d.id); toast(r.ok ? '株式を売却しました' : r.why, r.ok ? '' : 'bad'); UI.kSF = null; closeModal(true); render(); autosave(); };

/* ---------- 連結決算 ---------- */
function ksConsRowsBS() {
  return [
    ['cash', '現金預金'], ['ar', '売上債権'], ['inv', '棚卸資産'], ['oca', 'その他の流動資産'], ['ppe', '有形固定資産'], ['ia', '無形固定資産'], ['gw', 'のれん'], ['subShares', '関係会社株式'], ['icLoan', '関係会社長期貸付金'], ['io', '投資その他の資産'],
    ['TA', '資産合計', 'sum'], ['ap', '仕入債務'], ['debt', '借入金'], ['icDebt', '関係会社長期借入金'], ['ocl', 'その他の負債'], ['TL', '負債合計', 'sum'],
    ['capital', '資本金'], ['capSur', '資本剰余金'], ['re', '利益剰余金'], ['fctr', '為替換算調整勘定'], ['nci', '非支配株主持分'], ['EQ', '純資産合計', 'sum'],
  ];
}
function ksConsBSVal(b, k) {
  if (!b) return null;
  if (k === 'TA') return sum(KS_CONS_ASSET, x => b[x] || 0);
  if (k === 'TL') return sum(KS_CONS_LIAB, x => b[x] || 0);
  if (k === 'EQ') return (b.capital || 0) + (b.capSur || 0) + (b.re || 0) + (b.fctr || 0) + (b.nci || 0);
  return b[k] || 0;
}
function ksConsPLRows() { return [['sales', '売上高'], ['cogs', '売上原価'], ['gp', '売上総利益', 'sum'], ['sga', '販売費及び一般管理費（のれん償却を含む）'], ['opi', '営業利益', 'sum'], ['noi', '営業外収益'], ['noe', '営業外費用'], ['ord', '経常利益', 'sum'], ['exg', '特別利益'], ['exl', '特別損失'], ['tax', '法人税等'], ['ni', '当期純利益', 'sum'], ['niNci', '非支配株主に帰属する当期純利益'], ['niParent', '親会社株主に帰属する当期純利益', 'grand']]; }
function ksConsPLVal(p, k, cons) {
  if (!p) return 0;
  const gp = (p.sales || 0) - (p.cogs || 0), opi = gp - (p.sga || 0), ord = opi + (p.noi || 0) - (p.noe || 0), ni = ord + (p.exg || 0) - (p.exl || 0) - (p.tax || 0);
  if (k === 'gp') return gp; if (k === 'opi') return opi; if (k === 'ord') return ord; if (k === 'ni') return ni;
  if (k === 'niNci') return cons ? p.niNci || 0 : 0;
  if (k === 'niParent') return cons ? ni - (p.niNci || 0) : ni;
  return p[k] || 0;
}
function ksGrpConsHtml() {
  const g = G.group;
  const fys = Object.keys(g.cons).map(Number).sort((a, b) => a - b);
  if (!fys.length) return `<div class="empty">連結決算書は、子会社のある期の3月末の決算でつくります。${ksSubs().length ? `最初の連結決算は${ksFyLabel(fyOf(G.m))}の3月末です。` : 'まず子会社をつくりましょう。'}</div>${ksGrpConsSteps()}`;
  const fy = UI.kGrpFy !== null && g.cons[UI.kGrpFy] ? UI.kGrpFy : fys[fys.length - 1];
  const c = g.cons[fy];
  const fySel = fys.length > 1 ? `<div class="seg" role="radiogroup">${fys.map(f => `<button type="button" data-act="kGrpFy" data-v="${f}" aria-pressed="${f === fy}">${ksFyLabel(f)}</button>`).join('')}</div>` : '';
  const ents = c.ents;
  const k = v => fmtK(v);
  // 連結精算表
  const plRows = ksConsPLRows().map(([key, n, cls]) => {
    const cells = ents.map(e => ksConsPLVal(e.pl, key === 'niNci' || key === 'niParent' ? 'ni' : key, false));
    const sumV = ksConsPLVal(c.sumPL, key === 'niNci' || key === 'niParent' ? 'ni' : key, false);
    const cons = ksConsPLVal(c.pl, key, true);
    const showE = !(key === 'niNci');
    return `<tr class="${cls || ''}"><td>${esc(n)}</td>${cells.map(v => `<td class="n">${showE ? k(key === 'niParent' ? v : v) : ''}</td>`).join('')}<td class="n">${showE ? k(sumV) : ''}</td><td class="n adj">${k(cons - (key === 'niNci' ? 0 : sumV))}</td><td class="n"><b>${k(cons)}</b></td></tr>`;
  }).join('');
  const bsRows = ksConsRowsBS().map(([key, n, cls]) => {
    const cells = ents.map(e => (e.bs ? ksConsBSVal(e.bs, key) : null));
    const sumV = ksConsBSVal(c.sumBS, key);
    const cons = ksConsBSVal(c.bs, key);
    return `<tr class="${cls || ''}"><td>${esc(n)}</td>${cells.map(v => `<td class="n">${v === null ? '―' : k(v)}</td>`).join('')}<td class="n">${k(sumV)}</td><td class="n adj">${k(cons - sumV)}</td><td class="n"><b>${k(cons)}</b></td></tr>`;
  }).join('');
  const head = `<tr><th>（千円）</th>${ents.map(e => `<th class="n">${esc(e.parent ? '親会社' : e.n.replace(/株式会社/, ''))}${e.own < 1 ? `<div class="small muted">${Math.round(e.own * 100)}%</div>` : ''}${e.sold ? '<div class="small muted">売却・破産</div>' : ''}</th>`).join('')}<th class="n">単純合計</th><th class="n">修正・消去</th><th class="n">連結</th></tr>`;
  const ws = `<div class="tbl-wrap"><table class="fs ws"><thead>${head}</thead><tbody><tr class="sec"><td colspan="${ents.length + 4}">損益計算書</td></tr>${plRows}<tr class="sec"><td colspan="${ents.length + 4}">貸借対照表（期末）</td></tr>${bsRows}</tbody></table></div>`;
  const elim = c.elim.map(e => `<li><b>${esc(e.t)}</b><div class="small">${esc(e.why)}</div>${e.pl ? `<div class="small muted">${Object.entries(e.pl).filter(([, v]) => v).map(([kk, v]) => `${({ sales: '売上高', sga: '販管費', noi: '営業外収益', noe: '営業外費用', exg: '特別利益', exl: '特別損失' })[kk] || kk} ${v > 0 ? '＋' : '△'}${fmtYen(Math.abs(v))}`).join('・')}</div>` : ''}${e.nciPL ? `<div class="small muted">${fmtYen(e.nciPL)}</div>` : ''}</li>`).join('');
  const b = c.bs;
  const sum2 = kv([['連結売上高', fmtYen(c.pl.sales)], ['連結営業利益', ksNum(c.pl.opi)], ['連結経常利益', ksNum(c.pl.ord)], ['親会社株主に帰属する当期純利益', ksNum(c.pl.niParent)], ['総資産', fmtYen(b.TA)], ['純資産（うち非支配株主持分）', `${fmtYen(b.EQ)}（${fmtYen(b.nci)}）`], ['自己資本比率（非支配株主持分を除く）', b.TA ? fmtPct((b.EQ - b.nci) / b.TA * 100, 1) : '―']]);
  return `<div class="row between" style="margin-bottom:8px"><h2 class="h2" style="margin:0">${ksFyLabel(fy)}の連結決算</h2>${fySel}</div>
    <div class="grid g2">${panel('連結の要約', sum2)}${panel('連結修正仕訳（このゲームで行った修正）', `<ol class="elim">${elim || '<li>修正なし</li>'}</ol>`)}</div>
    ${panel(term('連結精算表', 'renketsu'), `${ws}<p class="note">各社の決算書を足し合わせた「単純合計」から、グループの中の取引と、親会社の投資と子会社の資本を消して「連結」にします。修正・消去の列が、その差です。海外子会社は、損益を月ごとのレート、貸借対照表を期末のレートで円に直し、差を${term('為替換算調整勘定', 'fctr')}にします。</p>`, { flush: false })}
    ${ksGrpConsSteps()}`;
}
ACTIONS.kGrpFy = d => { UI.kGrpFy = +d.v; render(); };
function ksGrpConsSteps() {
  return panel('連結決算の手順', `<ol class="small" style="margin:0;padding-left:1.2em">
    <li><b>合算</b>：親会社と子会社（議決権の過半数を持つ会社）の決算書を、科目ごとに足す。海外子会社は円に換算する。</li>
    <li><b>投資と資本の相殺消去</b>：親会社の「関係会社株式」と、子会社の取得のときの資本（資本金・利益剰余金）を消す。払った額が子会社の純資産より多い分は${term('のれん', 'goodwill')}（連結では10年以内で償却）。親会社以外の株主の持分は${term('非支配株主持分', 'nci')}。</li>
    <li><b>取得の後の利益の配分</b>：子会社の利益のうち、非支配株主の分は「非支配株主に帰属する当期純利益」として親会社の株主の利益から分ける。</li>
    <li><b>内部取引の消去</b>：経営指導料・貸付金の利息・配当など、グループの中のお金の動きを消す（グループの外から見れば取引ではない）。</li>
    <li><b>債権債務の相殺消去</b>：親会社の貸付金と子会社の借入金のように、グループの中の貸し借りを消す。</li></ol>`);
}

/* ---------- グループをつくる ---------- */
function ksGrpMakeHtml() {
  const us = ksActiveUnits();
  const cash = ksB('cash');
  // 子会社の設立
  const F = UI.kGF || (UI.kGF = { q: '', type: null, sc: 1, own: 1, cc: 'jp', pref: G.loc ? G.loc.hq : 22, amt: null, name: '', owner: 'root' });
  const owners = [['root', `${G.coName}（親会社）`], ...ksCSubs().filter(x => !x.cc || x.cc === 'jp').map(x => [x.id, `${x.name}（孫会社として）`])];
  if (!owners.some(o => o[0] === (F.owner || 'root'))) F.owner = 'root';
  const ownerSt = F.owner && F.owner !== 'root' ? ksSubById(F.owner).st : G;
  const ocash = ksWith(ownerSt, () => ksB('cash'));
  const plan = F.type ? ksSubStartPlan(F.type, F.sc) : null;
  const need = plan ? plan.need : 0;
  const amt = F.amt || (plan ? Math.round(need * F.own / 1e6) * 1e6 : 0);
  const ccOpts = [['jp', '日本'], ...Object.entries(KS_COUNTRIES).map(([k, x]) => [k, x.n])].map(([v, l]) => `<option value="${v}"${F.cc === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const prefOpts = Object.values(KS_PREFS).map(p => `<option value="${p.c}"${+F.pref === p.c ? ' selected' : ''}>${esc(p.n)}</option>`).join('');
  const C = F.cc !== 'jp' ? KS_COUNTRIES[F.cc] : null;
  const found = panel('子会社・関連会社を設立する（新しい事業）', `<p class="small" style="margin:0 0 6px">新しい会社をつくって出資し（${term('関係会社株式', 'subShares')}）、その会社で事業を始めます。合弁にすると、相手の会社も持分に応じて出資します。持分が50%以下なら、経営は相手が主導する${term('関連会社', 'mochibunho')}（持分法）になります。子会社が出資すると<b>孫会社</b>になります。海外に設立すると現地法人になり、その国の税率と法律が適用されます。</p>
    <label class="field"><span>出資する会社</span><select data-ch="kGFowner">${owners.map(([v, l]) => `<option value="${v}"${(F.owner || 'root') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    <div class="field"><span>業種（産業 → 分類 → 業種とたどるか、言葉で探す）</span>${ksTbHtml('gf', { id: 'kGFq', ph: '業種を探す（例：ソフトウェア、物流、介護、リニア）' })}</div>
    ${F.type ? `<div class="callout" style="margin-top:6px"><b>${esc(F.type)}</b>${plan ? `<br><span class="small">立ち上げの設備 ${fmtYen(plan.capex)}・軌道に乗るまでの運転資金の目安 ${fmtYen(plan.work)}・合計の目安 <b>${fmtYen(need)}</b></span>` : ''}</div>` : ''}
    <div class="grid g2" style="gap:8px;margin-top:6px">
      <div class="field"><span>規模</span><div class="seg" role="radiogroup">${[[0.5, '小さく'], [1, 'ふつう'], [2, '大きく']].map(([v, l]) => `<button type="button" data-act="kGFsc" data-v="${v}" aria-pressed="${F.sc === v}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>持分（議決権）</span><div class="seg wrap" role="radiogroup">${[[1, '100%'], [0.8, '80%'], [0.6, '60%'], [0.51, '51%'], [0.49, '49%'], [0.4, '40%'], [0.3, '30%'], [0.2, '20%']].map(([v, l]) => `<button type="button" data-act="kGFown" data-v="${v}" aria-pressed="${F.own === v}">${l}</button>`).join('')}</div><span class="small muted">${F.own > 0.5 ? '50%超：連結子会社（全部を連結）' : '50%以下：関連会社（持分法で、利益の持分だけを取り込む）'}</span></div>
      <label class="field"><span>設立する国</span><select data-ch="kGFcc">${ccOpts}</select></label>
      ${F.cc === 'jp' ? `<label class="field"><span>所在地</span><select data-ch="kGFpref">${prefOpts}</select></label>` : `<div class="field"><span>${esc(C.n)}</span><span class="small">法人税 約${C.cit}%・${esc(C.vat)}・配当の源泉税 ${C.wht}%・ワーカーの月給 約${fmtNum(C.wk, 0)}ドル</span></div>`}
      <label class="field"><span>出資額（万円）</span><input type="number" min="100" step="100" value="${Math.round(amt / 1e4)}" data-ch="kGFamt" style="width:150px"></label>
      <label class="field"><span>会社の名前（空欄で自動）</span><input type="text" value="${esc(F.name)}" data-ch="kGFname" maxlength="24"></label>
    </div>
    <div class="row" style="margin-top:6px">${btn('設立する', 'kGFGo', {}, 'primary', { disabled: !F.type || amt <= 0 || amt > ocash })}<span class="small muted">${esc(ownerSt.coName)}の現預金 ${fmtYen(ocash)}${F.own < 1 ? `・相手の出資 ${fmtYen(Math.round(amt / F.own - amt))}` : ''}</span></div>`);
  // 分社化
  const S = UI.kSplit || (UI.kSplit = { u: us[0] ? us[0].id : null, cash: null });
  const pv = S.u ? ksGroupSplitPreview(S.u) : null;
  const scash = S.cash ?? (pv ? pv.cashS : 0);
  const apS = S.u ? ksUnitPurchShare(S.u) : 0;
  const split = us.length ? panel('事業を分社化する（会社分割）', `<p class="small" style="margin:0 0 6px">${term('会社分割', 'bunkatsu')}（新設分割）で、事業を新しい子会社に移します。設備・在庫・売掛金・従業員・取引先を移し、親会社は移した純資産の額で子会社の株式を受け取ります（グループの中の再編なので帳簿の額のまま）。買掛金は仕入の割合で一緒に移します。</p>
    <label class="field"><span>移す事業</span><select data-ch="kSplitU">${us.map(u => `<option value="${u.id}"${u.id === S.u ? ' selected' : ''}>${esc(ksUName(u))}</option>`).join('')}</select></label>
    ${pv ? kv([['設備（帳簿価額）', `${pv.nA}件・${fmtYen(pv.bv)}`], ['在庫', fmtYen(pv.inv)], pv.cwip || pv.adv ? ['施工中の工事', `未成工事支出金 ${fmtYen(pv.cwip)}・未成工事受入金 ${fmtYen(pv.adv)}`] : null, ['売掛金', fmtYen(pv.ar)], ['買掛金（仕入の割合）', `${fmtPct(apS * 100, 0)}を移す`], ['保証金', fmtYen(pv.dep)], ['従業員', `${pv.head}人`]].filter(Boolean)) : ''}
    <label class="field"><span>一緒に移す現預金（万円）</span><input type="number" min="0" step="100" value="${Math.round(scash / 1e4)}" data-ch="kSplitCash" style="width:150px"></label>
    <div class="row">${btn('分社化する', 'kSplitGo', {}, 'primary', { disabled: !pv || scash > cash })}</div>
    <p class="note">本来は、債権者保護手続（官報の公告と1か月の異議の期間）と登記が要ります。このゲームでは手続の費用だけかけて、すぐに移します。</p>`) : '';
  // 買収
  const g = G.group;
  const tg = g.targets || [];
  const ma = panel('株式を買って子会社にする（買収・資本参加）', `<p class="small" style="margin:0 0 6px">他社の株式の過半数を買うと、その会社は子会社になります（事業の譲受と違い、会社ごと手に入れる）。20〜49%なら資本参加で、関連会社（持分法）になります。払った額と、取得した持分の純資産の差は、連結決算で${term('のれん', 'goodwill')}になります。まずデューデリジェンス（買収の前の調査）で、過去の決算書を確かめましょう。</p>
    ${btn(`買収の候補を探す（仲介会社への着手金 ${fmtYen(KS_MA_FEE)}）`, 'kGTFind', {}, 'sm')}
    ${tg.length ? `<div class="tbl-wrap" style="margin-top:6px"><table class="t compact"><thead><tr><th>会社</th><th>業種</th><th class="n">調査</th></tr></thead><tbody>${tg.map(t => ksGTRow(t)).join('')}</tbody></table></div>` : ''}`);
  // 持株会社
  const hd = G.group.hd ? panel('持株会社', `<p class="small" style="margin:0">${esc(G.coName)}は${ksIsPureHD() ? '純粋持株会社' : '事業持株会社'}です（${ymLabel(G.group.hdM)}から）。</p>`)
    : us.length ? panel('持株会社体制に移行する', `<p class="small" style="margin:0 0 6px">すべての事業を、それぞれ子会社に分社化し、この会社は子会社の株式を持ってグループを経営する<b>${term('純粋持株会社', 'holdings')}</b>になります。借入金は事業の資産の大きさに応じて子会社に引き継ぎ、持株会社は経営指導料と配当で本社の費用をまかないます。</p>
    <ul class="small" style="margin:0 0 6px;padding-left:1.2em">${us.map(u => `<li>${esc(ksUName(u))} → 新しい子会社</li>`).join('')}</ul>
    <label class="inline small"><input type="checkbox" data-ch="kHdRename" ${UI.kHdRename ? 'checked' : ''}> 社名を「○○ホールディングス株式会社」に変える</label>
    <div class="row" style="margin-top:6px">${btn('持株会社体制に移行する', 'kHdGo', {}, 'primary')}</div>
    <p class="note">実際には、株式移転（新しい持株会社をつくる）や会社分割（事業を子会社に移す）を、株主総会の特別決議（3分の2以上）と債権者保護手続を経て行います。</p>`) : '';
  return `<div class="grid g2">${found}${split}</div><div class="grid g2" style="margin-top:10px">${ma}${hd}</div>`;
}
ACTIONS.kGFpick = d => { UI.kGF.type = d.v; UI.kGF.amt = null; render(); };
ACTIONS.kGFsc = d => { UI.kGF.sc = +d.v; UI.kGF.amt = null; render(); };
ACTIONS.kGFown = d => { UI.kGF.own = +d.v; UI.kGF.amt = null; render(); };
CHANGES.kGFcc = el => { UI.kGF.cc = el.value; render(); };
CHANGES.kGFpref = el => { UI.kGF.pref = +el.value; };
CHANGES.kGFamt = el => { const v = parseFloat(el.value); if (isFinite(v) && v > 0) { UI.kGF.amt = Math.round(v) * 1e4; render(); } };
CHANGES.kGFname = el => { UI.kGF.name = el.value; };
CHANGES.kGFowner = el => { UI.kGF.owner = el.value; UI.kGF.amt = null; render(); };
ACTIONS.kGFGo = () => {
  if (ksClosingBlock()) return;
  const F = UI.kGF;
  const plan = ksSubStartPlan(F.type, F.sc);
  const amt = F.amt || Math.round(plan.need * F.own / 1e6) * 1e6;
  const name = (F.name || '').trim();
  const r = ksGroupFound({ type: F.type, sc: F.sc, own: F.own, cash: amt, cc: F.cc, pref: F.pref, owner: F.owner || 'root', name: name ? (/株式会社|合同会社|有限会社/.test(name) || F.cc !== 'jp' ? name : name + '株式会社') : '' });
  if (!r.ok) { toast(r.why, 'bad'); return; }
  toast(`${r.s.name}を設立しました`);
  ksOrgShow(r.s);
  UI.kGF = null; UI.kGrpSec = 'org';
  render(); autosave();
};
CHANGES.kSplitU = el => { UI.kSplit = { u: el.value, cash: null }; render(); };
CHANGES.kSplitCash = el => { const v = parseFloat(el.value); if (isFinite(v) && v >= 0) { UI.kSplit.cash = Math.round(v) * 1e4; render(); } };
ACTIONS.kSplitGo = () => {
  const S = UI.kSplit;
  const pv = ksGroupSplitPreview(S.u);
  if (!pv) return;
  confirmBox(`${esc(ksUName(pv.u))}を分社化する`, `${esc(ksUName(pv.u))}の事業（設備・在庫・売掛金・従業員${pv.head}人）を新しい子会社に移します。一緒に移す現預金 ${fmtYen(S.cash ?? pv.cashS)}。<br>手続の費用（登記・司法書士・官報の公告）約50万円がかかります。`, '分社化する', 'kSplitGo2', {});
};
ACTIONS.kSplitGo2 = () => {
  if (ksClosingBlock()) return;
  const S = UI.kSplit;
  const pv = ksGroupSplitPreview(S.u);
  ksPost('splitFee', [['fees', 50e4, 0], ['cash', 0, 50e4]], { u: 'HQ', cf: 'exp', desc: '会社分割の手続の費用（登記・司法書士・官報の公告）' });
  const r = ksGroupSplit(S.u, { cash: S.cash ?? pv.cashS });
  if (!r.ok) { toast(r.why, 'bad'); closeModal(true); return; }
  toast(`${r.s.name}に分社化しました`);
  ksOrgShow(r.s);
  UI.kSplit = null; UI.kGrpSec = 'org';
  closeModal(true); render(); autosave();
};
CHANGES.kHdRename = el => { UI.kHdRename = el.checked; };
ACTIONS.kHdGo = () => confirmBox('持株会社体制に移行する', `${ksActiveUnits().length}つの事業を子会社に分社化し、${esc(G.coName)}は純粋持株会社になります。元に戻すことはできません。<br>手続の費用（株主総会・登記・官報の公告・専門家の報酬）約${fmtYen(300e4)}がかかります。`, '移行する', 'kHdGo2', {}, true);
ACTIONS.kHdGo2 = () => {
  if (ksClosingBlock()) return;
  ksPost('hdFee', [['fees', 300e4, 0], ['cash', 0, 300e4]], { u: 'HQ', cf: 'exp', desc: '持株会社体制への移行の費用（株主総会・登記・公告・専門家の報酬）' });
  const r = ksGroupMakeHD({ rename: UI.kHdRename });
  toast(r.ok ? '持株会社体制に移行しました' : r.why, r.ok ? '' : 'bad');
  UI.kGrpSec = 'org'; closeModal(true); render(); autosave();
};
function ksGTRow(t) {
  if (!t.st) return `<tr><td>${esc(t.co)}</td><td class="small">${esc(t.type)}</td><td class="n">${btn('デューデリジェンス', 'kGTDD', { id: t.id }, 'sm')}</td></tr>`;
  const q = t.q;
  return `<tr><td><b>${esc(t.co)}</b><div class="small">売上 ${fmtYen(q.sales)}・営業利益 ${fmtYen(q.opi)}・純資産 ${fmtYen(q.eq)}・借入金 ${fmtYen(q.debt)}・格付 ${q.grade}・従業員${q.head}人</div></td><td class="small">${esc(t.type)}</td>
    <td class="n">${btn('決算書を見る', 'kGTView', { id: t.id }, 'sm')}<div class="small" style="margin-top:4px">${[[1, '100%'], [0.67, '67%'], [0.51, '51%'], [0.34, '34%'], [0.2, '20%']].map(([o, l]) => btn(`${l} ${fmtYen(ksGTPrice(q, o))}`, 'kGTBuy', { id: t.id, o }, 'sm')).join('')}</div></td></tr>`;
}
function ksGTPrice(q, o) { return niceAmount(q.price100 * o * (o >= 0.67 ? 1 : o > 0.5 ? 0.97 : 0.9)); }
ACTIONS.kGTFind = () => { if (ksClosingBlock()) return; ksGroupFindTargets(); toast('買収の候補が見つかりました'); render(); autosave(); };
ACTIONS.kGTDD = d => { if (ksClosingBlock()) return; const t = (G.group.targets || []).find(x => x.id === d.id); if (!t) return; ksGroupDD(t); toast(`デューデリジェンスの費用 ${fmtYen(t.ddFee)}`); render(); autosave(); };
ACTIONS.kGTView = d => showModal('kGTView', { id: d.id });
MODALS.kGTView = a => {
  const t = (G.group.targets || []).find(x => x.id === a.id);
  if (!t || !t.st) return modalFrame('決算書', '', btn('閉じる', 'closeModal'));
  const ys = ksWith(t.st, () => ksFYList().slice(-3).map(fy => ({ fy, s: ksToBankFS(G.fys[fy]), lab: ksFyLabel(fy) })));
  const rows = [['S', '売上高'], ['OPI', '営業利益'], ['ORD', '経常利益'], ['NI', '当期純利益'], ['TA', '総資産'], ['STD', '短期借入金'], ['LTD', '長期借入金'], ['EQ', '純資産'], ['CASH', '現預金']];
  const tbl = `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（千円）</th>${ys.map(y => `<th class="n">${y.lab}</th>`).join('')}</tr></thead><tbody>${rows.map(([k, n]) => `<tr><td>${n}</td>${ys.map(y => `<td class="n">${fmtK(y.s[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const r = ys.length ? ratiosOf(ys[ys.length - 1].s, ys.length > 1 ? ys[ys.length - 2].s : null) : null;
  return modalFrame(`${esc(t.co)}の決算書（デューデリジェンス）`, `${tbl}${r ? kv([['自己資本比率', fmtPct(r.eqR, 1)], ['経常利益率', fmtPct(r.ordm, 1)], ['債務償還年数', isFinite(r.dsy) ? `${fmtNum(r.dsy, 1)}年` : '―']]) : ''}<p class="note">買う前に、売上の伸び・利益率・借入金・自己資本比率を確かめます。純資産より高く買った分は、連結決算でのれんになり、10年で償却して利益を押し下げます。</p>`, btn('閉じる', 'closeModal'));
};
ACTIONS.kGTBuy = d => {
  const t = (G.group.targets || []).find(x => x.id === d.id);
  if (!t || !t.st) return;
  const own = +d.o;
  const price = ksGTPrice(t.q, own);
  const gw = Math.max(0, price - own * t.q.eq);
  confirmBox(`${esc(t.co)}の株式の${Math.round(own * 100)}%を買う`, `価格 <b>${fmtYen(price)}</b>（取得する持分の純資産 ${fmtYen(Math.round(own * t.q.eq))}・${own > 0.5 ? 'のれん' : '投資差額'} 約${fmtYen(gw)}）。${own <= 0.5 ? '<br>持分が50%以下なので子会社にはならず、持分法の関連会社になります（経営は今の株主が主導）。' : ''}${ksB('cash') < price ? `<br><b class="neg">現預金（${fmtYen(ksB('cash'))}）が足りません。資金と銀行の画面で、買収の資金を借りてから買いましょう。</b>` : ''}${own < 1 && own > 0.5 ? `<br>残りの${Math.round((1 - own) * 100)}%は今の株主が持ち続け、連結決算の非支配株主持分になります。` : ''}`, '買う', 'kGTBuyGo', { id: t.id, o: own });
};
ACTIONS.kGTBuyGo = d => {
  if (ksClosingBlock()) return;
  const t = (G.group.targets || []).find(x => x.id === d.id);
  const r = ksGroupBuy(t, +d.o);
  toast(r.ok ? `${r.s.name}を${r.s.aff ? '関連会社' : '子会社'}にしました` : r.why, r.ok ? '' : 'bad');
  if (r.ok) { UI.kGrpSec = 'org'; ksOrgShow(r.s); }
  closeModal(true); render(); autosave();
};

/* ---------- 会社の形 ---------- */
function ksGrpFormHtml() {
  const f = ksForm(G);
  const rows = Object.entries(KS_FORMS).map(([k, F]) => `<tr${k === f ? ' class="on"' : ''}><td><b>${esc(F.n)}</b>${k === f ? ' <span class="tag ok">いまの形</span>' : ''}</td><td class="small">${esc(F.desc)}</td></tr>`).join('');
  const big = (G.bal.capital || 0) >= 5e8 || ksLiab() >= 200e8;
  const conv = f === 'gk' ? `<div class="row" style="margin-top:6px">${btn('株式会社に組織変更する（約40万円・債権者保護手続1か月）', 'kFormConv', { to: 'kk' }, 'sm primary')}</div>`
    : f === 'yk' ? `<div class="row" style="margin-top:6px">${btn('商号を株式会社に変えて移行する（約20万円）', 'kFormConv', { to: 'kk' }, 'sm primary')}</div>` : '';
  const gov = kv([['資本金', fmtYen(G.bal.capital || 0)], ['負債の合計', fmtYen(Math.round(ksLiab()))], ['大会社（資本金5億円以上または負債200億円以上）', big ? '<b>大会社</b>：会計監査人の監査・内部統制の基本方針の決議が要る' : 'いいえ'], ['法人税の税率', (G.bal.capital || 0) > 1e8 ? '資本金1億円超：税率は約30.6%（外形標準課税を含む目安。中小法人の軽減税率は使えない）' : '中小法人：所得800万円までは約25%、超える部分は約34%（目安）'], ['住民税の均等割', fmtYen(ksKintou(G))]]);
  return `<div class="grid g2">${panel('会社の形（会社法）', `<div class="tbl-wrap"><table class="t compact"><tbody>${rows}</tbody></table></div>${conv}`)}${panel('いまの会社の区分', gov + '<p class="note">資本金を増やすと信用は上がりますが、1億円を超えると中小法人の税の優遇がなくなり、5億円以上は大会社として会計監査人が必要になります。</p>')}</div>
    <div class="grid g2" style="margin-top:10px">${panel('社名（商号）を変える', ksRenameHtml('root'))}</div>`;
}
ACTIONS.kFormConv = d => {
  if (ksClosingBlock()) return;
  const f = ksForm(G);
  const cost = f === 'gk' ? 40e4 : 20e4;
  ksPost('formConv', [['fees', cost, 0], ['cash', 0, cost]], { u: 'HQ', cf: 'exp', desc: f === 'gk' ? '組織変更（合同会社→株式会社）の登記・公告の費用' : '特例有限会社から株式会社への移行（商号変更）の費用' });
  G.form = d.to;
  G.coName = G.coName.replace(/合同会社|有限会社/, '株式会社');
  ksNews(`${f === 'gk' ? '組織変更' : '商号の変更'}で株式会社になりました（${G.coName}）。株主総会・決算公告・役員の任期が必要になり、上場をめざせます`, 'good');
  render(); autosave();
};

/* ---------- しくみ ---------- */
function ksGrpLearnHtml() {
  return `<div class="grid g2">${panel('子会社・関連会社', `<ul class="small" style="margin:0;padding-left:1.2em">
    <li><b>子会社</b>：議決権の過半数を持つなど、経営を支配している会社。連結決算に全部を取り込む（全部連結）。</li>
    <li><b>関連会社</b>：20%以上を持ち、重要な影響を与える会社。合算はせず${term('持分法', 'mochibunho')}で、利益のうち持分の分だけを「持分法による投資損益」として取り込む。</li>
    <li><b>孫会社</b>：子会社の子会社。親会社から見た持分は掛け算（80%×60%＝48%）でも、子会社を通じて支配しているので連結する。</li>
    <li><b>合弁会社</b>：他の会社と一緒に出資してつくる会社。過半数を持てば子会社で、相手の持分は非支配株主持分。</li></ul>`)}
    ${panel('持株会社（ホールディングス）', `<p class="small" style="margin:0">子会社の株式を持ち、グループの経営（戦略・人事・資金・監査）に専念する会社。自分で事業をしない会社を純粋持株会社、事業もする会社を事業持株会社という。事業ごとに会社を分けると、責任と成績がはっきりし、買収や売却もしやすくなる。持株会社の収入は、子会社からの<b>経営指導料</b>と<b>配当</b>。</p>`)}
    ${panel('お金と税金', `<ul class="small" style="margin:0;padding-left:1.2em">
    <li><b>${term('受取配当等の益金不算入', 'ekikinFusannyu')}</b>：子会社からの配当は、子会社で法人税を払った後の利益なので、親会社の税金の計算では益金に入れない（100%子会社・1/3超は全額、5%超〜1/3以下は50%、5%以下は20%、海外子会社（25%以上）は95%）。</li>
    <li><b>グループ法人税制</b>：100%のグループの中で資産を売った損益は、グループの外に売るまで繰り延べる。グループの中の寄附は、払った側は損金にならず、受けた側も益金に入れない。</li>
    <li><b>グループ通算制度</b>：100%のグループで申請すると、子会社の赤字を親会社の黒字と通算できる（このゲームでは扱わない）。</li>
    <li><b>${term('移転価格税制', 'transferPricing')}</b>：海外の関係会社との取引は、他人どうしと同じ価格（独立企業間価格）にする。</li></ul>`)}
    ${panel('会社の再編の手続', `<ul class="small" style="margin:0;padding-left:1.2em">
    <li><b>会社分割</b>：事業を他の会社（新しくつくる会社＝新設分割、ある会社＝吸収分割）に移す。</li>
    <li><b>株式移転</b>：新しく持株会社をつくり、今の会社がその100%子会社になる。</li>
    <li><b>株式交換</b>：他社の株主に自社の株式を渡して、その会社を100%子会社にする。</li>
    <li><b>${term('合併', 'gappei')}</b>：2つの会社が1つになる。吸収合併では、存続する会社が消える会社の資産・負債・従業員・契約をまとめて引き継ぐ。</li>
    <li><b>${term('持分の追加取得', 'tsuikaShutoku')}</b>：子会社の残りの株を買う。連結では、のれんは増やさず、非支配株主持分との差を資本剰余金にする。</li>
    <li>どれも原則として株主総会の特別決議（3分の2以上）、反対する株主の買取請求、債権者保護手続（官報の公告と1か月以上の異議の期間）が要る。</li></ul>`)}</div>`;
}

/* ---------- 用語 ---------- */
Object.assign(TERMS, {
  renketsu: { n: '連結決算', c: 'book', s: '親会社と子会社を1つの会社とみなして作る決算書。', b: '各社の決算書を合算し、グループの中の取引（売買・貸し借り・配当・経営指導料）と、親会社の投資と子会社の資本を消して作ります。上場会社は連結財務諸表を開示します。子会社に赤字を押し付けても、連結では隠せません。', see: ['nci', 'goodwill', 'fctr'] },
  nci: { n: '非支配株主持分', c: 'bs', s: '子会社の純資産のうち、親会社以外の株主の分。', b: '連結貸借対照表の純資産の部に表示します。連結損益計算書では、子会社の利益のうちこの株主の分を「非支配株主に帰属する当期純利益」として分けます。', see: ['renketsu'] },
  fctr: { n: '為替換算調整勘定', c: 'bs', s: '海外子会社の決算書を円に直したときに出る差。', b: '海外子会社の貸借対照表は期末のレート、損益計算書は期中のレート、資本金は出資したときのレートで円に直すため、合計が合わなくなります。その差を純資産の部（その他の包括利益累計額）に表示します。子会社を売ると、損益に振り替えます。', see: ['renketsu'] },
  subShares: { n: '関係会社株式', c: 'bs', s: '子会社・関連会社の株式（個別の貸借対照表）。', b: '親会社の個別の決算書では、取得の額（出資した額・買った額）で計上し、毎期の利益は取り込みません（配当を受け取ったときだけ収益）。実質の価値が大きく下がったら評価損を計上します。連結では消去されます。', see: ['renketsu'] },
  icLoan: { n: '関係会社貸付金・借入金', c: 'bs', s: 'グループの会社どうしの貸し借り。', b: '親会社は資産（関係会社長期貸付金）、子会社は負債（関係会社長期借入金）。利息は親会社の受取利息・子会社の支払利息。連結ではどちらも消去します。', see: ['renketsu'] },
  divInc: { n: '受取配当金', c: 'pl', s: '持っている株式から受け取った配当。営業外収益。', b: '持株会社では主な収入なので営業収益に表示することもあります。子会社からの配当は、税金の計算で益金に入れない（受取配当等の益金不算入）。', see: ['ekikinFusannyu'] },
  mgmtFee: { n: '経営指導料', c: 'pl', s: '親会社が子会社から受け取る、経営の指導・管理の対価。', b: '持株会社の主な収入の1つ。料率に根拠がないと、税務調査で寄附金（国内）や移転価格（海外）として問題になります。連結では消去します。', see: ['renketsu', 'transferPricing'] },
  ekikinFusannyu: { n: '受取配当等の益金不算入', c: 'book', s: '子会社などからの配当を、税金の計算で益金に入れない制度。', b: '配当は、子会社ですでに法人税を払った後の利益から出るので、親会社でもう一度課税しないようにする仕組みです。完全子法人株式（100%）と関連法人株式（1/3超）は全額（関連法人は負債の利子を控除）、その他の株式（5%超〜1/3以下）は50%、非支配目的の株式（5%以下）は20%を益金に入れません。海外子会社（25%以上・6か月以上）からの配当は95%。', see: ['divInc'] },
  holdings: { n: '持株会社', c: 'book', s: '子会社の株式を持ち、グループを経営する会社。', b: '1997年の独占禁止法の改正で解禁されました。事業をしない純粋持株会社と、事業もする事業持株会社があります。', see: ['renketsu'] },
  bunkatsu: { n: '会社分割', c: 'book', s: '会社の事業の全部または一部を、別の会社に移すこと。', b: '新しくつくる会社に移す新設分割と、既にある会社に移す吸収分割があります。グループの中の分割は、移す資産・負債を帳簿の額のまま引き継ぎます。', see: ['holdings'] },
  transferPricing: { n: '移転価格税制', c: 'book', s: '海外の関係会社との取引を、他人どうしの価格で課税する制度。', b: '海外子会社に安く売ったり、高い経営指導料を払わせたりして利益を国外に移すのを防ぎます。価格が独立企業間価格とずれていると、日本で所得を更正されます。', see: ['mgmtFee'] },
  travel: { n: '旅費交通費', c: 'pl', s: '出張の交通費・宿泊費・日当、通勤手当など。', b: '旅費規程に基づく出張の日当や宿泊料は、社員の所得税がかかりません（通常必要な額）。規程がないと給与として課税されます。', see: [] },
});
