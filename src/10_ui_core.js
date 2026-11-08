'use strict';
/* =========================================================
 *  10_ui_core.js : 画面の骨組み・イベント・モーダル・保存
 * ========================================================= */

const $ = (s, r = document) => r.querySelector(s);
const UI = {
  tab: 'dash', appId: null, appView: 'pl', appShowTrue: false, appFilter: 'all',
  pfFilter: 'all', pfPage: 0, finTab: 'bs', jMonth: null, cityD: null, newsCat: 'all',
  modal: null, queue: [], settings: { monthly: true, confirmAdvance: true, learn: true },
  stampAnim: null,
};
const ACTIONS = {}, CHANGES = {}, INPUTS = {}, SCREENS = {}, MODALS = {};

const TABS = [
  ['dash', '頭取室'], ['strategy', '経営戦略'], ['loans', '融資審査'], ['portfolio', '与信管理'], ['city', CITY_NAME],
  ['rates', '金利・預金'], ['market', '市場運用'], ['facility', '店舗・金庫'], ['system', 'システム'],
  ['hr', '人事・営業'], ['finance', '決算・財務'], ['audit', '監査・検査'], ['news', '経済・ニュース'],
];

const SEAL_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/><rect x="15" y="15" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/* ---------- 小物 ---------- */
function attr(o) { return Object.entries(o).map(([k, v]) => v === undefined || v === null || v === false ? '' : v === true ? ` ${k}` : ` ${k}="${esc(v)}"`).join(''); }
function btn(label, act, data = {}, cls = '', extra = {}) {
  const d = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" class="btn ${cls}" data-act="${act}"${d}${attr(extra)}>${label}</button>`;
}
function tag(text, cls = '') { return `<span class="tag ${cls}">${esc(text)}</span>`; }
function gradeBadge(g) { return g ? `<span class="grade g${g}" title="行内格付 ${g}">${g}</span>` : '<span class="muted">―</span>'; }
function clsTag(c) { return tag(CLS[c].short, c === 0 ? 'ok' : c <= 2 ? 'warn' : 'bad'); }
function deltaTxt(x, f = v => fmtYen(v, { noUnit: true })) {
  if (!x) return '<span class="muted">±0</span>';
  return `<span class="${x < 0 ? 'neg' : 'pos'}">${x > 0 ? '+' : MINUS}${f(Math.abs(x))}</span>`;
}
function meter(v, max, cls = '') {
  const p = clamp(max > 0 ? v / max * 100 : 0, 0, 100);
  const c = cls || (p > 95 ? 'bad' : p > 85 ? 'warn' : '');
  return `<div class="meter ${c}" role="meter" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.toFixed(1)}%"></i></div>`;
}
function panel(title, body, opt = {}) {
  return `<section class="panel ${opt.cls || ''}"${opt.id ? ` id="${opt.id}"` : ''}><div class="ph"><h2>${title}</h2>${opt.aside ? `<span class="aside">${opt.aside}</span>` : ''}</div><div class="pb ${opt.flush ? 'flush' : ''}">${body}</div></section>`;
}
function kv(rows) { return `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`; }

/* ---------- 描画 ---------- */
/* 描き直しても、横に滑らせた位置（主要な数字・タブ・表・地図）とダイアログの位置を保つ */
const KEEP_SCROLL = ['.strip', '.tabs', '.subtabs', '.jmap-wrap', '.tbl-wrap', '.unitbar'];
function keepScrollSave() {
  const v = {};
  for (const sel of KEEP_SCROLL) document.querySelectorAll('#app ' + sel).forEach((el, i) => { if (el.scrollLeft || el.scrollTop) v[sel + '#' + i] = [el.scrollLeft, el.scrollTop]; });
  return { tab: UI.tab, v };
}
function keepScrollRestore(k) {
  for (const sel of KEEP_SCROLL) {
    if (k.tab !== UI.tab && sel !== '.strip' && sel !== '.tabs') continue;
    document.querySelectorAll('#app ' + sel).forEach((el, i) => { const v = k.v[sel + '#' + i]; if (v) { el.scrollLeft = v[0]; el.scrollTop = v[1]; } });
  }
}
/* 横に滑らせる帯の中で、選んでいるもの（いまのタブ・小見出し）が隠れていたら見える所まで動かす */
function revealPicked(bar, picked) {
  if (!bar || !picked || bar.scrollWidth <= bar.clientWidth + 1) return;
  const r = picked.getBoundingClientRect(), rb = bar.getBoundingClientRect();
  if (r.left < rb.left) bar.scrollLeft -= rb.left - r.left + 24;
  else if (r.right > rb.right) bar.scrollLeft += r.right - rb.right + 24;
}
/* 最後の列にボタンや入力欄がある表は、スマホでは1行ずつのカードに組み替える（CSS の .t.stk）。
 * そのために、各セルに列の見出しを data-l として付けておく */
function markStackTables(root) {
  if (!root) return;
  root.querySelectorAll('.tbl-wrap > table.t:not(.jtable)').forEach(t => {
    const body = t.tBodies[0];
    if (!body) return;
    const rows = [...body.rows];
    const act = c => c && c.querySelector('button, select, input');
    if (!rows.some(r => r.cells.length > 2 && act(r.cells[r.cells.length - 1]))) return;
    if (rows.some(r => [...r.cells].some(c => c.rowSpan > 1))) return;
    const labels = [];
    const head = t.tHead && t.tHead.rows[0];
    if (head) for (const th of head.cells) for (let k = 0; k < (th.colSpan || 1); k++) labels.push(th.textContent.trim());
    for (const r of rows) { let i = 0; for (const c of r.cells) { if (labels[i] && !c.hasAttribute('data-l')) c.setAttribute('data-l', labels[i]); i += c.colSpan || 1; } }
    t.classList.add('stk');
    t.parentElement.classList.add('stk-wrap');
  });
}
function render() {
  const k = keepScrollSave();
  renderApp();
  markStackTables($('#app'));
  keepScrollRestore(k);
  revealPicked($('#app .tabs'), $('#app .tabs [aria-current="page"]'));
  document.querySelectorAll('#app .subtabs').forEach(b => revealPicked(b, b.querySelector('[aria-pressed="true"]')));
}
/* 画面を切り替えたあとの位置。スマホでタブの帯より下まで読み進めていたときは、帯のすぐ下（新しい画面の先頭）へ */
function scrollToMain() {
  const body = $('#app .body'), tabs = $('#app .tabs');
  if (!body || !tabs || window.innerWidth > 760) { window.scrollTo({ top: 0 }); return; }
  const y = body.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(tabs).top) || 0);
  window.scrollTo({ top: window.scrollY > y ? y : 0 });
}
function renderApp() {
  const app = $('#app');
  document.body.classList.toggle('ingame', !!G);
  if (!G) { app.innerHTML = renderStart(); return; }
  if (G.mode === 'kaisha') { renderK(); return; }
  if (G.mode === 'gyosei') { renderG(); return; }
  const tabsEl = $('.tabs');
  const tabScroll = tabsEl ? tabsEl.scrollLeft : 0;
  app.innerHTML = `${renderMast()}${renderStrip()}<div class="body"><nav class="tabs" aria-label="画面の切り替え">${renderTabs()}</nav><main id="main">${renderScreen()}</main></div>`;
  const t2 = $('.tabs');
  if (t2) t2.scrollLeft = tabScroll;
  afterRender();
}
function renderScreen() {
  try {
    return (SCREENS[UI.tab] || SCREENS.dash)();
  } catch (err) {
    console.error(err);
    return `<div class="callout bad">画面の表示中にエラーが発生しました：${esc(err.message)}</div>`;
  }
}
function afterRender() {
  if (UI.stampAnim) {
    const el = document.querySelector('.bigseal');
    if (el) el.classList.add('anim');
    UI.stampAnim = null;
  }
}
function renderMast() {
  const { y, mo } = ymOf(G.m);
  const fy = fyOf(G.m);
  const yearsLeft = (G.termYears || 0) - fy;
  const over = !!G.over;
  const st = G.stage || 0;
  return `<header class="mast">
    <div class="mast-brand">${SEAL_SVG}<div style="min-width:0"><div class="bank-name"><span class="bn">${esc(G.bankName)}</span>${st ? `<span class="stage-badge s${st} hide-m">${STAGES[st].name}</span>` : ''}</div><div class="bank-sub">頭取 ${esc(G.ceoName)}${st ? `<span class="stage-badge s${st} show-m">${STAGES[st].name}</span>` : ''}<span class="hide-m">　${st ? STAGES[st].area + 'で営業' : bankClass().name}</span></div></div></div>
    <div class="mast-date"><div class="wareki">${warekiLabel(G.m)}</div><div class="sub">${y}年${mo}月　${fyLabel(fy)}${!G.termYears ? '' : yearsLeft > 0 ? `・任期あと${yearsLeft}年` : '・任期満了後'}</div></div>
    <div class="mast-actions"><button type="button" class="mbtn" data-act="menu">メニュー</button><button type="button" class="mbtn" data-act="help">遊び方</button>
    <button type="button" class="btn-advance" data-act="advance"${over ? ' disabled' : ''}>月末を締めて翌月へ</button></div>
  </header>`;
}
function renderStrip() {
  const prev = G.hist[G.hist.length - 1]?.kpi;
  const fy = fyOf(G.m);
  const ytd = plSummary(curFYPL()).net;
  const rs = rwaBreakdown();
  const cr = coreCapitalParts(rs).core / rs.total * 100;
  const cells = [
    ['総資産', fmtYen(totalAssets()), prev ? deltaTxt(totalAssets() - prev.ta) : ''],
    ['預金', fmtYen(deposits()), prev ? deltaTxt(deposits() - prev.dep) : ''],
    ['貸出金', fmtYen(B('loans')), prev ? deltaTxt(B('loans') - prev.loans) : ''],
    ['自己資本比率', `<span class="${cr < reqCR() ? 'neg' : ''}">${fmtPct(cr)}</span>`, `<span class="muted">${STAGES[G.stage || 0].basis.replace('＋G-SIBバッファー', '')}${fmtNum(reqCR(), 1)}%</span>`],
    ['当期純利益（累計）', `<span class="${ytd < 0 ? 'neg' : ''}">${fmtYen(ytd)}</span>`, `<span class="muted">${fyLabel(fy)}</span>`],
    ['信用度', `${fmtNum(G.trust, 0)}<span class="unit"> /100</span>`, prev ? deltaTxt(G.trust - prev.trust, v => fmtNum(v, 1)) : ''],
    ['格付', RATINGS[G.ratingIdx], `<span class="muted">株価 ${fmtNum(G.stock.price, 0)}円</span>`],
    ['不良債権比率', fmtPct(nplRatio()), `<span class="muted">金融再生法基準</span>`],
  ];
  return `<div class="strip" role="group" aria-label="主要指標">${cells.map(([k, v, d]) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('')}</div>`;
}
function tabBadge(id) {
  switch (id) {
    case 'loans': { const n = G.apps.filter(a => a.status === 'pending').length; return n ? `<span class="badge">${n}</span>` : ''; }
    case 'portfolio': {
      const n = G.inbox.filter(x => x.type === 'review' || x.type === 'resched' || x.type === 'refi').length;
      const urgent = G.inbox.some(x => x.type === 'resched' || x.type === 'refi');
      return n ? `<span class="badge${urgent ? ' alert' : ''}">${n}</span>` : '';
    }
    case 'city': return PROJECTS.some(P => G.city.projects[P.id]?.status === 'offered') ? '<span class="badge">1</span>' : '';
    case 'audit': return G.inbox.some(x => x.type === 'fsaNotice') ? '<span class="badge alert">!</span>' : '';
    case 'strategy': {
      const si = G.stageInfo;
      if (si && si.strikes) return '<span class="badge alert">!</span>';
      if (si && !si.review && (G.stage || 0) < 2 && canApplyUpgrade().ok) return '<span class="badge">↑</span>';
      return '';
    }
    default: return '';
  }
}
function renderTabs() {
  return TABS.map(([id, label]) => `<button type="button" class="tab" data-act="tab" data-tab="${id}"${UI.tab === id ? ' aria-current="page"' : ''}><span>${label}</span>${tabBadge(id)}</button>`).join('');
}

/* ---------- モーダル ---------- */
function showModal(name, args = {}) { hideTip(); UI.modal = { name, args }; UI.mDrawn = null; drawModal(); }
function closeModal(force) {
  if (!UI.modal) return;
  const m = MODALS[UI.modal.name];
  if (!force && m && m.locked && m.locked(UI.modal.args)) return;
  // 用語カード・用語集・業種のくわしく（ダイアログの上から開いたとき）は、開く前に見ていたモーダルへ戻る
  if ((UI.modal.name === 'term' || UI.modal.name === 'glossary' || (UI.modal.name === 'kTypeInfo' && UI.modal.args && UI.modal.args.back)) && UI.mstack && UI.mstack.length) {
    const prev = UI.mstack.pop();
    showModal(prev.name, prev.args);
    return;
  }
  UI.modal = null;
  if (UI.queue.length) { const n = UI.queue.shift(); showModal(n.name, n.args); return; }
  drawModal();
  render();
}
function drawModal() {
  const root = $('#modal-root');
  if (!UI.modal) { root.innerHTML = ''; document.body.style.overflow = ''; UI.mstack = []; UI.mDrawn = null; return; }
  const fn = MODALS[UI.modal.name];
  let html;
  try { html = fn(UI.modal.args); } catch (err) { console.error(err); html = `<div class="modal narrow"><div class="mb">表示エラー：${esc(err.message)}</div><div class="mf">${btn('閉じる', 'closeModal', { force: 1 })}</div></div>`; }
  // 同じダイアログを描き直すときは、読んでいた位置を保つ（ボタンを押すたびに先頭へ戻らないように）
  const old = root.querySelector('.modal');
  const keepY = old && UI.mDrawn === UI.modal.name ? old.scrollTop : 0;
  const keepX = old && UI.mDrawn === UI.modal.name ? [...old.querySelectorAll('.tbl-wrap')].map(w => w.scrollLeft) : [];
  const keepL = old && UI.mDrawn === UI.modal.name ? [...old.querySelectorAll('.tb-list, .typelist')].map(w => w.scrollTop) : []; // 業種の一覧の位置
  root.innerHTML = `<div class="scrim" data-act="scrim">${html}</div>`;
  UI.mDrawn = UI.modal.name;
  markStackTables(root);
  const nm = root.querySelector('.modal');
  if (nm && keepY) nm.scrollTop = keepY;
  if (nm && keepX.length) nm.querySelectorAll('.tbl-wrap').forEach((w, i) => { if (keepX[i]) w.scrollLeft = keepX[i]; });
  if (nm && keepL.length) nm.querySelectorAll('.tb-list, .typelist').forEach((w, i) => { if (keepL[i]) w.scrollTop = keepL[i]; });
  document.body.style.overflow = 'hidden';
  const f = root.querySelector('[data-autofocus]') || root.querySelector('.mf .btn.primary') || root.querySelector('.modal button');
  if (f) f.focus({ preventScroll: true });
  if (UI.stampAnim) afterRender();
}
/* 次の段階へ進んだダイアログは先頭から読む */
function modalTop() { const m = document.querySelector('#modal-root .modal'); if (m) m.scrollTop = 0; }
function modalFrame(title, body, foot, opt = {}) {
  return `<div class="modal ${opt.size || ''}" role="dialog" aria-modal="true" aria-label="${esc(opt.label || title.replace(/<[^>]+>/g, ''))}">
    <div class="mh"><div><h2>${title}</h2>${opt.sub ? `<div class="sub">${opt.sub}</div>` : ''}</div>${opt.noClose ? '' : '<button type="button" class="xbtn" data-act="closeModal" aria-label="閉じる">×</button>'}</div>
    <div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ''}</div>`;
}
function confirmBox(title, text, okLabel, okAct, data = {}, danger) {
  UI.confirm = { title, text, okLabel, okAct, data, danger };
  showModal('confirm');
}
MODALS.confirm = () => {
  const c = UI.confirm;
  return modalFrame(c.title, `<p style="margin:0">${c.text}</p>`, btn('戻る', 'closeModal') + btn(c.okLabel, c.okAct, c.data, c.danger ? 'danger' : 'primary'), { size: 'narrow' });
};

/* ---------- トースト・ツールチップ ---------- */
function toast(msg, kind = '') {
  const root = $('#toast-root');
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.textContent = msg;
  root.appendChild(d);
  while (root.children.length > 3) root.firstChild.remove();
  setTimeout(() => d.remove(), kind === 'bad' ? 5200 : 3600);
}
function showTip(text, x, y) {
  const t = $('#tip');
  t.textContent = text;
  t.style.display = 'block';
  const w = t.offsetWidth, h = t.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top + h > window.innerHeight - 8) top = y - h - 14;
  t.style.left = Math.max(8, left) + 'px';
  t.style.top = Math.max(8, top) + 'px';
}
function hideTip() { $('#tip').style.display = 'none'; }

/* ---------- 保存 ---------- */
const LS = { auto: 'toudori.v1.auto', slot: i => `toudori.v1.slot${i}`, meta: i => `toudori.v1.meta${i}`, theme: 'toudori.theme', settings: 'toudori.settings' };
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function packSave(str) {
  if (typeof CompressionStream === 'undefined') return 'J' + str;
  try {
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
    return 'Z' + bufToB64(await new Response(stream).arrayBuffer());
  } catch (e) { return 'J' + str; }
}
async function unpackSave(s) {
  if (!s) return null;
  if (s[0] === 'J') return s.slice(1);
  if (s[0] === 'Z') {
    const stream = new Blob([b64ToBytes(s.slice(1))]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  return s;
}
function saveMeta() { return isG() ? gySaveMeta() : isK() ? ksSaveMeta() : JSON.stringify({ bank: G.bankName, ceo: G.ceoName, m: G.m, ta: totalAssets(), at: Date.now(), over: !!G.over }); }
async function autosave() {
  if (!G) return;
  const L = lsKeys();
  const packed = await packSave(serialize());
  const ok = lsSet(L.auto, packed) && lsSet(L.meta('a'), saveMeta());
  // 保存できなかったら一度だけ知らせる（会社がとても多いと、ブラウザの保存領域に入りきらないことがある）
  if (!ok && UI.saved !== false) toast('自動保存できませんでした（このブラウザの保存領域がいっぱいか、保存が許可されていません）。メニューで使っていないセーブを消すか、「ファイルに書き出す」で保存してください', 'bad');
  UI.saved = ok;
}
async function saveSlot(i) {
  const L = lsKeys();
  const packed = await packSave(serialize());
  const ok = lsSet(L.slot(i), packed) && lsSet(L.meta(i), saveMeta());
  toast(ok ? `スロット${i}に保存しました` : '保存できませんでした（ブラウザの保存領域を使えません）', ok ? '' : 'bad');
  if (UI.modal && UI.modal.name === 'menu') drawModal();
}
async function loadFrom(key) {
  try {
    const raw = await unpackSave(lsGet(key));
    if (!raw) { toast('セーブデータがありません', 'bad'); return false; }
    deserialize(raw);
    afterLoad();
    toast(`${gameName()}（${ymLabel(G.m)}）を読み込みました`);
    return true;
  } catch (e) {
    console.error(e);
    toast('読み込めませんでした：' + e.message, 'bad');
    return false;
  }
}
/* 読み込んだ後の画面の準備（銀行・会社の両方） */
function afterLoad() {
  UI.appId = null; UI.modal = null; UI.queue = []; UI.guideSel = null;
  if (isG()) { UI.tab = 'g_dash'; UI.gRes = null; UI.gSai = null; UI.start.mode = 'gyosei'; } else if (isK()) { UI.tab = 'k_dash'; UI.kFy = null; UI.kJm = null; UI.start.mode = 'kaisha'; } else { UI.tab = 'dash'; UI.start.mode = 'bank'; }
  drawModal(); render(); window.scrollTo({ top: 0 });
  if (isK()) { if (G.closing) showModal('kClose'); else if (G.over) showModal('kOver'); }
  else if (G.pendingDividend) showModal('yearEnd', { fy: G.pendingDividend.fy });
}
function exportSave() {
  const blob = new Blob([serialize()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${isG() ? 'shocho' : isK() ? 'shacho' : 'toudori'}_${gameName()}_${ymOf(G.m).y}-${String(ymOf(G.m).mo).padStart(2, '0')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importSave(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      deserialize(String(r.result));
      afterLoad(); autosave();
      toast('セーブファイルを読み込みました');
    } catch (e) { toast('読み込めませんでした：' + e.message, 'bad'); }
  };
  r.readAsText(file);
}
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

/* 遊び方：会社経営モード（またはその開始画面）では会社の遊び方を開く */
function helpName() { return isG() || (!G && UI.start && UI.start.mode === 'gyosei') ? 'gHelp' : isK() || (!G && UI.start && UI.start.mode === 'kaisha') ? 'kHelp' : 'help'; }
/* 今のゲームの名前（銀行・会社・役所） */
function gameName() { return isG() ? GY_AGENCY[G.agency].n : isK() ? G.coName : G.bankName; }

/* ---------- 月の進行 ---------- */
function requestAdvance() {
  if (!G || G.over) return;
  if (G.pendingDividend) { showModal('yearEnd', { fy: G.pendingDividend.fy }); return; }
  const d = G.policy && G.policy.delegate;
  const delegated = a => d && d.on && a.amountReq <= d.max && !(a.kind === 'biz' && G.companies[a.coId] && G.companies[a.coId].big);
  const expiring = G.apps.filter(a => a.status === 'pending' && a.exp <= G.m && !delegated(a)).length;
  const urgent = G.inbox.filter(x => x.type === 'resched' || x.type === 'refi').length;
  if (UI.settings.confirmAdvance && (expiring || urgent)) {
    const parts = [];
    if (expiring) parts.push(`今月が回答期限の融資申込が<b>${expiring}件</b>（締めると先方は他行へ移ります）`);
    if (urgent) parts.push(`返済猶予・借換の申し出が<b>${urgent}件</b>（回答しないと自動で処理されます）`);
    confirmBox('未処理の案件があります', parts.join('<br>') + '<br>このまま月末を締めますか？', '締めて翌月へ', 'advanceNow');
    return;
  }
  runAdvance();
}
function runAdvance() {
  UI.modal = null;
  const rep = advanceMonth();
  const special = (G.pendingModals || []).slice();
  G.pendingModals = [];
  UI.queue = [];
  if (UI.settings.monthly && rep) UI.queue.push({ name: 'monthly', args: { rep } });
  for (const s of special) UI.queue.push({ name: s.type, args: s });
  if (UI.appId && !G.apps.some(a => a.id === UI.appId && a.status === 'pending')) UI.appId = null;
  render();
  autosave();
  if (UI.queue.length) { const n = UI.queue.shift(); showModal(n.name, n.args); } else drawModal();
}

/* ---------- 共通アクション ---------- */
Object.assign(ACTIONS, {
  tab: d => { UI.tab = d.tab; render(); scrollToMain(); },
  go: d => { UI.tab = d.tab; if (d.app) UI.appId = d.app; if (d.dist) UI.cityD = d.dist; if (d.fin) UI.finTab = d.fin; UI.modal = null; drawModal(); render(); scrollToMain(); },
  advance: () => (isG() ? gyRequestAdvance() : isK() ? ksRequestAdvance() : requestAdvance()),
  advanceNow: () => runAdvance(),
  closeModal: d => closeModal(!!(d && d.force)),
  scrim: (d, el, e) => { if (e.target === el) closeModal(); },
  menu: () => showModal('menu'),
  help: () => showModal(helpName(), { sec: 0 }),
  helpSec: d => showModal(helpName(), { sec: +d.sec }),
  saveSlot: d => saveSlot(+d.slot),
  loadSlot: d => loadFrom(lsKeys().slot(+d.slot)),
  loadAuto: () => loadFrom(lsKeys().auto),
  delSlot: d => confirmBox('セーブを消す', `スロット${+d.slot}のセーブを消します。元には戻せません。`, '消す', 'delSlotGo', { slot: +d.slot }, true),
  delSlotGo: d => { const L = lsKeys(); try { localStorage.removeItem(L.slot(+d.slot)); localStorage.removeItem(L.meta(+d.slot)); } catch (e) { /* 消せないときはそのまま */ } toast(`スロット${+d.slot}のセーブを消しました`); showModal('menu'); },
  exportSave: () => exportSave(),
  importSave: () => $('#importFile').click(),
  theme: d => { lsSet(LS.theme, d.v); applyTheme(d.v); drawModal(); },
  newGameConfirm: () => confirmBox('新しいゲームを始める', '現在のゲームは自動保存の内容が上書きされます。始める前に必要ならスロットに保存してください。', '新しく始める', 'newGameGo', {}, true),
  newGameGo: () => { if (G) UI.start.mode = isG() ? 'gyosei' : isK() ? 'kaisha' : 'bank'; G = null; UI.modal = null; UI.queue = []; drawModal(); render(); window.scrollTo({ top: 0 }); },
});
Object.assign(CHANGES, {
  importFile: el => { if (el.files && el.files[0]) importSave(el.files[0]); el.value = ''; },
  setting: el => { UI.settings[el.dataset.key] = el.checked; lsSet(LS.settings, JSON.stringify(UI.settings)); },
});

/* ---------- イベント委譲 ---------- */
let saveTimer = null;
function scheduleSave() {
  if (!G) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { autosave(); }, 1500);
}
function bindEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) { fn(el.dataset, el, e); if (!/^(tab|scrim|help|helpSec|menu|appView|pfPage|finTab|newsCat|loanView)$/.test(el.dataset.act)) scheduleSave(); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-ch]');
    if (el && CHANGES[el.dataset.ch]) { CHANGES[el.dataset.ch](el, e); scheduleSave(); }
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-in]');
    if (el && INPUTS[el.dataset.in]) INPUTS[el.dataset.in](el, e);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && UI.modal) closeModal();
  });
  document.addEventListener('pointerover', e => {
    const el = e.target.closest('[data-tip]');
    if (el) showTip(el.dataset.tip, e.clientX, e.clientY);
  });
  document.addEventListener('pointermove', e => {
    const el = e.target.closest('[data-tip]');
    if (el) showTip(el.dataset.tip, e.clientX, e.clientY); else hideTip();
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest('[data-tip]');
    if (el && el.getBoundingClientRect) { const r = el.getBoundingClientRect(); showTip(el.dataset.tip, r.left, r.bottom); }
  });
  document.addEventListener('focusout', () => hideTip());
  window.addEventListener('scroll', hideTip, { passive: true });
}
