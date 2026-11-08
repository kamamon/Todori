'use strict';
/* =========================================================
 *  29j_kaisha_custom_ui.js : カスタムスタート（始め方の画面）
 *   会社の形（株式会社・合同会社・特例有限会社・持株会社）、本社の所在地、資本金・現預金・借入金、
 *   本社の土地と建物、景気・為替、創業の年を決めて始める
 * ========================================================= */

function ksCustomDefaults(k) {
  return k.cu || (k.cu = { on: false, form: 'kk', pref: KS_HOME_PREF, capital: '', cash: '', debt: '', hqLand: false, eco: 'normal', fx: 148, founded: '' });
}
const KS_CU_FORMS = [
  ['kk', '株式会社', KS_FORMS.kk.desc],
  ['gk', '合同会社', KS_FORMS.gk.desc],
  ['yk', '特例有限会社', KS_FORMS.yk.desc],
  ['hd', '持株会社（ホールディングス）', '事業ごとに子会社をつくり、その株式を持つ持株会社として始める（株式移転）。持株会社は子会社から経営指導料と配当を受け取り、グループの連結決算書をつくる。'],
];
function ksCustomHtml(k) {
  const c = ksCustomDefaults(k);
  const forms = KS_CU_FORMS.map(([v, n]) => `<button type="button" data-act="kCuForm" data-v="${v}" aria-pressed="${c.form === v}">${n}</button>`).join('');
  const fd = (KS_CU_FORMS.find(x => x[0] === c.form) || KS_CU_FORMS[0])[2];
  const prefs = Object.entries(KS_PREF_REG).map(([r, n]) => `<optgroup label="${esc(n)}">${Object.values(KS_PREFS).filter(P => P.reg === r).map(P => `<option value="${P.c}"${P.c === +c.pref ? ' selected' : ''}>${esc(P.n)}</option>`).join('')}</optgroup>`).join('');
  const P = KS_PREFS[c.pref] || KS_PREFS[KS_HOME_PREF];
  const eco = [['boom', '好景気'], ['normal', 'ふつう'], ['recession', '不景気']].map(([v, l]) => `<button type="button" data-act="kCuEco" data-v="${v}" aria-pressed="${c.eco === v}">${l}</button>`).join('');
  const num = (key, label, ph, extra = '') => `<label class="field"><span>${label}</span><input type="number" inputmode="numeric" data-ch="kCu" data-k="${key}" value="${esc(c[key])}" placeholder="${ph}" ${extra} style="width:100%"></label>`;
  return `<details class="custom field"${c.on ? ' open' : ''}><summary>カスタムスタート（会社の形・本社の場所・資金と資産を決める）</summary>
    <label class="inline" style="margin:6px 0"><input type="checkbox" data-ch="kCuOn" ${c.on ? 'checked' : ''}> この設定で始める</label>
    <div class="cu-body${c.on ? '' : ' off'}">
    <div class="field"><span>会社の形</span><div class="seg wrap" role="radiogroup">${forms}</div><span class="small muted">${esc(fd)}</span></div>
    <label class="field"><span>本社の所在地</span><select data-ch="kCuPref">${prefs}</select><span class="small muted">最低賃金 ${fmtNum(P.mw, 0)}円・商業地 ${fmtNum(P.land.com / 1e4, 1)}万円/㎡・地震 ${KS_RISK_LV[P.risk.eq]}・台風 ${KS_RISK_LV[P.risk.ty]}・${esc(KS_PREF_REG[P.reg])}</span></label>
    <div class="grid g3 cu-nums">${num('capital', '資本金（万円）', 'そのまま', 'min="1" step="100"')}${num('cash', '現預金（万円）', 'そのまま', 'min="1" step="100"')}${num('debt', '借入金（万円）', 'そのまま', 'min="0" step="100"')}</div>
    <span class="small muted">空欄の項目は、選んだ「引き継ぐ会社の状態」のまま。資本金が1億円を超えると中小法人の税の優遇（軽減税率・交際費の定額控除など）がなくなり、5億円以上は大会社（会計監査人の監査）になります。${c.form === 'hd' ? '持株会社では、資本金と現預金は持株会社のもの。借入金の設定は使いません。' : ''}</span>
    ${c.form === 'hd' ? '' : `<label class="inline" style="margin-top:6px"><input type="checkbox" data-ch="kCuLand" ${c.hqLand ? 'checked' : ''}> 本社の土地と建物を自社で持っている（商業地を買い、本社ビルを建てた状態。足りない資金は土地を担保に借りる）</label>`}
    <div class="grid g2" style="gap:12px;margin-top:6px"><div class="field"><span>景気</span><div class="seg" role="radiogroup">${eco}</div></div>
    ${num('fx', '為替（1ドル＝円）', '148', 'min="80" max="250" step="1"')}</div>
    ${num('founded', '創業の年（西暦）', 'そのまま', `min="1868" max="${START_YEAR}" step="1"`)}
    ${ksCuUnitsHtml(k)}
    <p class="small muted" style="margin:0">就任の時点（2027年1月）の帳簿を、増資・減資・配当・借入・繰上返済の仕訳でこの額に合わせて始めます。仕訳は帳簿の画面で確かめられます。</p></div>
  </details>`;
}
/* 事業ごとの設備の数と、これまでの成長 */
function ksCuCapField(type, sc, act, i, extra = '') {
  const ci = ksCapInfo(type);
  const max = ksScToCap(type, ci.maxSc);
  return `<label class="field cu-cap"><span>${esc(ci.n)}</span><span class="cu-capin"><input type="number" inputmode="numeric" min="1" max="${max}" step="1" value="${ksScToCap(type, sc || 1)}" data-ch="${act}" data-i="${i}"${extra} aria-label="${esc(type)}の${esc(ci.n)}"><span class="small">${esc(ci.u)}</span></span><span class="small muted">中の規模で${fmtNum(ci.base, 0)}${esc(ci.u)}・最大${fmtNum(max, 0)}${esc(ci.u)}</span></label>`;
}
function ksCuGrowField(g, act, i, label = 'これまでの成長（売上の伸び）') {
  return `<label class="field cu-grow"><span>${label}</span><select data-ch="${act}" data-i="${i}">${KS_GROWTH.map(([v, l]) => `<option value="${v}"${Math.abs((+g || 0) - v) < 1e-9 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
}
function ksCuUnitsHtml(k) {
  const rows = k.units.map((x, i) => `<li class="cu-unit"><b>${esc(x.type)}</b><div class="grid g2 cu-ugrid">${ksCuCapField(x.type, x.sc, 'kCuCap', i)}${ksCuGrowField(x.g, 'kCuGrow', i)}</div></li>`).join('');
  return `<div class="field"><span>事業ごとの設備と成長</span><ul class="cu-units">${rows}</ul>
    <span class="small muted">設備の数で事業の大きさが決まります（店・機械・車両・客室などの数。上の「規模」のボタンより細かく決められます）。成長を選ぶと、過去4期の決算書の売上がその割合で伸びて（縮んで）いて、就任のあとも勢いが2年ごとに半分になりながら続きます。伸びてきた会社は利益率が高め、縮んできた会社は低めで始まります。子会社は「グループの会社」の各社の設定で決められます。</span></div>`;
}
Object.assign(ACTIONS, {
  kCuForm: d => { ksStartStore(); const c = ksCustomDefaults(UI.start.k); c.form = d.v; c.on = true; render(); },
  kCuEco: d => { ksStartStore(); const c = ksCustomDefaults(UI.start.k); c.eco = d.v; c.on = true; render(); },
});
Object.assign(CHANGES, {
  // 設備の数 → 規模の倍率（入れた数が範囲の外なら直して見せる。画面は描き直さない：押そうとしたボタンが消えないように）
  kCuCap: el => {
    const k = UI.start.k, x = k.units[+el.dataset.i];
    if (!x) return;
    x.sc = ksCapToSc(x.type, el.value);
    const n = ksScToCap(x.type, x.sc);
    if (+el.value !== n) el.value = n;
    for (const b of document.querySelectorAll(`[data-act="kStSc"][data-i="${+el.dataset.i}"]`)) b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.v - x.sc) < 1e-9));
    const c = ksCustomDefaults(k); c.on = true;
    const cb = document.querySelector('[data-ch="kCuOn"]'); if (cb) cb.checked = true;
  },
  kCuGrow: el => { const k = UI.start.k, x = k.units[+el.dataset.i]; if (!x) return; x.g = +el.value; const c = ksCustomDefaults(k); c.on = true; const cb = document.querySelector('[data-ch="kCuOn"]'); if (cb) cb.checked = true; },
  kCuOn: el => { ksStartStore(); ksCustomDefaults(UI.start.k).on = el.checked; render(); },
  kCuPref: el => { ksStartStore(); const c = ksCustomDefaults(UI.start.k); c.pref = +el.value; c.on = true; render(); },
  kCuLand: el => { ksStartStore(); const c = ksCustomDefaults(UI.start.k); c.hqLand = el.checked; c.on = true; render(); },
  kCu: el => { const c = ksCustomDefaults(UI.start.k); c[el.dataset.k] = el.value; c.on = true; const cb = document.querySelector('[data-ch="kCuOn"]'); if (cb) cb.checked = true; const b = document.querySelector('.cu-body'); if (b) b.classList.remove('off'); },
});
/* 始めるときのオプション（kStart から） */
function ksCustomOptions(k) {
  const c = ksCustomDefaults(k);
  if (!c.on) return {};
  const man = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? Math.round(n) * 1e4 : null; };
  const cap = man(c.capital), cash = man(c.cash), debt = man(c.debt);
  const fx = parseFloat(c.fx), founded = parseInt(c.founded, 10);
  const custom = {
    form: c.form, pref: +c.pref || KS_HOME_PREF,
    capital: cap && cap > 0 ? cap : 0, cash: cash && cash > 0 ? cash : 0, debt: c.form === 'hd' ? null : debt,
    hqLand: c.form !== 'hd' && !!c.hqLand, eco: c.eco, fx: Number.isFinite(fx) ? fx : 0, founded: Number.isFinite(founded) ? founded : 0,
  };
  return { custom, pref: custom.pref, form: c.form === 'hd' ? 'kk' : c.form };
}
