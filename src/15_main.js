'use strict';
/* =========================================================
 *  15_main.js : 起動
 * ========================================================= */
(function boot() {
  try { const s = JSON.parse(lsGet(LS.settings) || 'null'); if (s) Object.assign(UI.settings, s); } catch (e) { /* 既定値のまま */ }
  applyTheme(lsGet(LS.theme) || 'auto');
  bindEvents();
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'importFile'; inp.hidden = true;
  inp.setAttribute('data-ch', 'importFile');
  document.body.appendChild(inp);
  render();
  window.Toudori = { get G() { return G; }, render, advance: runAdvance, check: () => integrityCheck() };
})();
