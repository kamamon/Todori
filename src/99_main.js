'use strict';
/* =========================================================
 *  99_main.js : 起動（すべてのファイルの後に読み込む）
 * ========================================================= */
/* iPhone：開いたときにステータスバーと重なっている高さを一度だけ測り、
   ページの流れの中の余白（--band0）に使う。スクロールで変わる値（--band）は固定表示の要素だけが使う。 */
function measureSafeTop() {
  try {
    const p = document.createElement('div');
    p.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:var(--band);visibility:hidden;pointer-events:none';
    document.body.appendChild(p);
    const h = p.getBoundingClientRect().height || 0;
    p.remove();
    document.documentElement.style.setProperty('--band0', `${Math.round(h)}px`);
  } catch (e) { /* 測れなければ 0 のまま */ }
}
(function boot() {
  measureSafeTop();
  window.addEventListener('orientationchange', () => setTimeout(() => { if (window.scrollY < 4) measureSafeTop(); }, 400));
  try { const s = JSON.parse(lsGet(LS.settings) || 'null'); if (s) Object.assign(UI.settings, s); } catch (e) { /* 既定値のまま */ }
  applyTheme(lsGet(LS.theme) || 'auto');
  bindEvents();
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'importFile'; inp.hidden = true;
  inp.setAttribute('data-ch', 'importFile');
  document.body.appendChild(inp);
  render();
  window.Toudori = { get G() { return G; }, render, advance: () => (isK() ? ksRunAdvance() : runAdvance()), check: () => (isK() ? ksCheck() : integrityCheck()), show: (name, args) => showModal(name, args || {}) };
})();
