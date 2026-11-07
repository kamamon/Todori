'use strict';
/* =========================================================
 *  29i_kaisha_map_ui.js : 「拠点と地図」の画面
 *   日本の地図（都道府県のタイル）：地価・最低賃金・賃金・災害の起きやすさ・人口。本社と事業所の移転、土地の購入
 *   世界の地図：進出先の国の税金・賃金・法令、海外の拠点と子会社
 *   土地と建物：建てる・売る、固定資産税　　災害と保険：地震保険・火災保険・BCP、災害の記録
 *   出来事（選択のある出来事）と災害のお知らせ
 * ========================================================= */

KS_TABS.splice(KS_TABS.findIndex(t => t[0] === 'k_hr') + 1, 0, ['k_map', '拠点と地図']);
Object.assign(UI, { kMapSec: 'jp', kMapPref: null, kMapMetric: 'land', kMapCC: null, kMapWMetric: 'wage', kLand: null, kMapMvU: null, kBld: null });

const KS_CC_SHORT = { us: '米国', ca: 'カナダ', mx: 'メキシコ', br: 'ブラジル', gb: '英国', de: 'ドイツ', fr: 'フランス', cn: '中国', hk: '香港', tw: '台湾', kr: '韓国', sg: 'シンガポール', th: 'タイ', vn: 'ベトナム', id: 'インドネシア', ph: 'フィリピン', my: 'マレーシア', in: 'インド', ae: 'UAE', au: '豪州', jp: '日本' };
const KS_RISK_LV = ['―', '低', '中', '高'];
const kvV = rows => kv(rows).replace('class="kv"', 'class="kv v"');
const KS_MAP_METRICS = {
  land: { n: '商業地の地価', v: p => ksLandPrice(p, 'com'), f: v => `${fmtNum(v / 1e4, v < 1e5 ? 1 : 0)}万円/㎡` },
  mw: { n: '最低賃金', v: p => Math.round(KS_PREFS[p].mw * ((G.loc && G.loc.mwIdx) || 1)), f: v => `${fmtNum(v, 0)}円` },
  wage: { n: '賃金の水準', v: p => KS_PREFS[p].wage, f: v => `${fmtNum(v / 10, 1)}万円` },
  risk: { n: '災害の起きやすさ', v: p => { const r = KS_PREFS[p].risk; return r.eq * 1.5 + r.ty + r.fl + r.sn * 0.5; }, f: v => `${fmtNum(v, 1)}点`, warm: true },
  pop: { n: '人口', v: p => KS_PREFS[p].pop, f: v => `${fmtNum(v, 0)}万人` },
};

KS_SCREENS.k_map = () => {
  if (!G.loc) return '<div class="empty">拠点の情報がありません</div>';
  const sec = UI.kMapSec || 'jp';
  const subs = [['jp', '国内の拠点'], ['world', '海外'], ['land', '土地と建物'], ['risk', '災害と保険']];
  const body = sec === 'jp' ? ksMapJpHtml() : sec === 'world' ? ksMapWorldHtml() : sec === 'land' ? ksMapLandHtml() : ksMapRiskHtml();
  return `<h1 class="h1">拠点と地図</h1><p class="lead">どこに本社と事業所を置くかで、賃金・家賃・最低賃金・お客さまの数・災害の危険が変わります。土地を買って自社の建物を建てると、家賃はかからなくなりますが、固定資産税と減価償却費がかかり、お金が固定されます。</p>
    <div class="subtabs" role="tablist">${subs.map(([k, l]) => `<button type="button" data-act="kMapSec" data-v="${k}" aria-pressed="${sec === k}">${l}</button>`).join('')}</div>${body}`;
};
ACTIONS.kMapSec = d => { UI.kMapSec = d.v; render(); };

/* ---------- 日本の地図 ---------- */
function ksQuantClass(vals) {
  const s = vals.slice().sort((a, b) => a - b);
  const q = [0.2, 0.4, 0.6, 0.8].map(t => s[Math.min(s.length - 1, Math.floor(t * s.length))]);
  return { cls: v => q.filter(x => v >= x).length, q, min: s[0], max: s[s.length - 1] };
}
function ksSitesIn(p) {
  const Lc = G.loc;
  return {
    hq: Lc.hq === +p,
    units: ksActiveUnits().filter(u => ksUnitPref(u) === +p),
    lands: Lc.lands.filter(L => L.pref === +p),
    subs: G.group ? G.group.subs.filter(s => !s.gone && (s.cc || 'jp') === 'jp' && s.st.loc && s.st.loc.hq === +p) : [],
    dis: (Lc.dis || []).filter(x => x.pref === +p && G.m - x.m < 12),
  };
}
function ksMapJpHtml() {
  const Lc = G.loc;
  const foreign = G.country && G.country !== 'jp';
  if (!UI.kMapPref || !KS_PREFS[UI.kMapPref]) UI.kMapPref = Lc.hq;
  const M = KS_MAP_METRICS[UI.kMapMetric] || KS_MAP_METRICS.land;
  const prefs = Object.keys(KS_PREFS).map(Number);
  const vals = Object.fromEntries(prefs.map(p => [p, M.v(p)]));
  const Q = ksQuantClass(Object.values(vals));
  const tiles = prefs.map(p => {
    const P = KS_PREFS[p], s = ksSitesIn(p), sel = UI.kMapPref === p;
    const mk = `${s.hq ? '<i class="m-hq" title="本社">本</i>' : ''}${s.units.length ? `<i class="m-u" title="事業所">${s.units.length}</i>` : ''}${s.lands.length ? '<i class="m-l" title="自社の土地">土</i>' : ''}${s.subs.length ? '<i class="m-s" title="子会社">子</i>' : ''}${s.dis.length ? '<i class="m-d" title="最近の災害">!</i>' : ''}`;
    const lab = `${P.n}：${M.n} ${M.f(vals[p])}${s.hq ? '・本社' : ''}${s.units.length ? `・事業所${s.units.length}` : ''}${s.lands.length ? '・自社の土地' : ''}${s.subs.length ? '・子会社' : ''}`;
    return `<button type="button" class="jt c${Q.cls(vals[p])}${sel ? ' sel' : ''}${s.hq ? ' hq' : ''}" style="grid-column:${P.x + 1};grid-row:${P.y + 1}" data-act="kMapPref" data-v="${p}" aria-pressed="${sel}" aria-label="${esc(lab)}" title="${esc(lab)}"><span class="jn${P.s.length >= 3 ? ' n3' : ''}">${esc(P.s)}</span>${mk ? `<span class="jm">${mk}</span>` : ''}</button>`;
  }).join('');
  const metricSeg = Object.entries(KS_MAP_METRICS).map(([k, x]) => `<button type="button" data-act="kMapMetric" data-v="${k}" aria-pressed="${UI.kMapMetric === k}">${x.n}</button>`).join('');
  const bounds = [Q.min, ...Q.q];
  const legend = `<div class="mapleg${M.warm ? ' warm' : ''}" aria-label="凡例">${bounds.map((b, i) => `<span><i class="sw c${i}"></i>${M.f(b)}〜</span>`).join('')}</div>
    <div class="mapleg marks"><span><i class="m-hq">本</i>本社</span><span><i class="m-u">2</i>事業所の数</span><span><i class="m-l">土</i>自社の土地</span><span><i class="m-s">子</i>子会社</span><span><i class="m-d">!</i>1年以内の災害</span></div>`;
  return `${foreign ? `<div class="callout warn">この会社は海外（${esc(KS_COUNTRIES[G.country].n)}）の子会社です。日本の地図は参考です。</div>` : ''}
    <div class="grid g-side map-grid"><div>${panel('日本の地図', `<div class="seg wrap sm" role="radiogroup" aria-label="色で示す数字">${metricSeg}</div>
      <div class="jmap-wrap"><div class="jmap${M.warm ? ' warm' : ''}" role="group" aria-label="都道府県の地図">${tiles}</div></div>${legend}
      <p class="note">地価は令和8年の都道府県地価調査の基準地の平均（用途別）、最低賃金は令和8年度の地域別最低賃金（その後の改定を含む）、賃金は賃金構造基本統計調査の平均。ゲームの目安です。</p>`)}</div>
      <div class="stack">${ksMapPrefPanel(UI.kMapPref)}</div></div>`;
}
ACTIONS.kMapPref = d => { UI.kMapPref = +d.v; UI.kLand = null; render(); };
ACTIONS.kMapMetric = d => { UI.kMapMetric = d.v; render(); };

function ksMapPrefPanel(p) {
  const P = KS_PREFS[p], Lc = G.loc, s = ksSitesIn(p);
  const mw = Math.round(P.mw * (Lc.mwIdx || 1));
  const cmp = ksPrefCompare(p);
  const home = KS_PREFS[Lc.home || Lc.hq];
  const x = n => `×${fmtNum(n, 2)}`;
  const riskTxt = [['eq', '地震'], ['ty', '台風'], ['fl', '水害'], ['sn', '大雪']].map(([k, n]) => `${n} <b class="${P.risk[k] >= 3 ? 'neg' : ''}">${KS_RISK_LV[P.risk[k]]}</b>`).join('・');
  const mine = [
    s.hq ? `<li><b>本社</b></li>` : '',
    ...s.units.map(u => `<li>${esc(ksUName(u))}<span class="small muted">（${esc(ksS(u).name)}・${ksUnitHead(u)}人）</span></li>`),
    ...s.lands.map(L => `<li>自社の土地：${KS_LAND_USE[L.use]} ${fmtNum(L.area, 0)}㎡${L.bldg ? `（${KS_BLDG_KIND[L.bldg.kind].n}${L.bldg.openM > G.m ? '・建設中' : ''}）` : ''}</li>`),
    ...s.subs.map(x => `<li>子会社：${esc(x.name)}</li>`),
  ].filter(Boolean).join('');
  const info = kvV([
    ['地方', `${KS_PREF_REG[P.reg]}・人口 ${fmtNum(P.pop, 1)}万人${P.city ? '・政令市のある大都市圏' : ''}`],
    ['地価（1㎡・今の見込み）', `商業地 ${fmtYen(ksLandPrice(p, 'com'))}・工業地 ${fmtYen(ksLandPrice(p, 'ind'))}・住宅地 ${fmtYen(ksLandPrice(p, 'res'))}<div class="small muted">住宅地の前年比 ${P.trend > 0 ? '+' : ''}${fmtNum(P.trend, 1)}%（令和8年の地価調査）</div>`],
    ['最低賃金', `時給 ${fmtNum(mw, 0)}円`],
    ['賃金の水準', `月 ${fmtNum(P.wage / 10, 1)}万円（一般の労働者の所定内給与）`],
    ['災害の起きやすさ', `${riskTxt}<div class="small muted">${esc(KS_PREF_RISKNOTE[P.reg])}</div>`],
    [`事業を置いたときの目安（${esc(home.n)}と比べて）`, `人件費 ${x(cmp.wage)}・家賃 ${x(cmp.rent)}・お店と飲食のお客さま ${x(cmp.demand)}`],
  ]);
  // 本社の移転
  let hqAct = '';
  if (!s.hq) {
    const q = ksMoveHQQuote(p);
    hqAct = q.ok ? `<div class="row between"><span class="small">本社をここに移す：費用 <b>${fmtYen(q.total)}</b>（移転 ${fmtYen(q.move)}・登記 ${fmtYen(q.reg + q.fee)}）</span>${btn('本社を移す', 'kMapHQ', { p }, 'sm')}</div>` : '';
  }
  // 事業所の移転
  const others = ksActiveUnits().filter(u => ksUnitPref(u) !== p);
  let mv = '';
  if (others.length) {
    const cur = others.find(u => u.id === UI.kMapMvU) || others[0];
    UI.kMapMvU = cur.id;
    const q = ksMoveUnitQuote(cur, p);
    mv = `<div class="field" style="margin-top:8px"><span>事業所をここに移す</span><div class="row" style="gap:6px;flex-wrap:wrap"><select data-ch="kMapMvU" aria-label="移す事業">${others.map(u => `<option value="${u.id}"${u.id === cur.id ? ' selected' : ''}>${esc(ksUName(u))}（${esc(ksPrefName(ksUnitPref(u)))}）</option>`).join('')}</select>${q.ok ? btn('移す', 'kMapMove', { p }, 'sm') : ''}</div>
      ${q.ok ? `<span class="small">必要なお金 <b>${fmtYen(q.total)}</b>（設備の移設 ${fmtYen(q.move)}・人の異動と採用 ${fmtYen(q.people)}・原状回復と内装 ${fmtYen(q.restore)}：事務所移転費用・特別損失${q.nB ? `。自社の建物は前の場所で${fmtYen(q.bSale)}で売り（売却損 ${fmtYen(q.bLoss)}）、移した先に${fmtYen(q.bNew)}で建てる` : ''}）<br>移した後：人件費 ${x(q.wage)}・家賃 ${x(q.rent)}${q.demand !== 1 ? `・お客さま ${x(q.demand)}` : ''}・最低賃金 ${fmtNum(q.mw, 0)}円。移した月は営業が落ち、しばらく満足度が下がります</span>` : `<span class="small muted">${esc(q.why)}</span>`}</div>`;
  }
  // 土地を買う
  const LD = UI.kLand && UI.kLand.p === p ? UI.kLand : (UI.kLand = { p, use: 'com', area: 1000 });
  const lq = ksLandQuote(p, LD.use, LD.area);
  const uses = Object.entries(KS_LAND_USE).map(([k, n]) => `<button type="button" data-act="kLandUse" data-v="${k}" aria-pressed="${LD.use === k}">${n}</button>`).join('');
  const land = `<div class="seg sm" role="radiogroup" aria-label="土地の用途">${uses}</div>
    <p class="small muted" style="margin:4px 0">${esc(KS_ZONE[LD.use].n)}：${KS_ZONE[LD.use].ok.map(k => KS_BLDG_KIND[k].n).join('・')}を建てられる。${esc(KS_ZONE[LD.use].ng)}</p>
    <label class="field"><span>面積（㎡）</span><input type="number" min="100" max="100000" step="100" value="${LD.area}" data-ch="kLandArea" style="width:130px"><span class="small muted">目安：本社ビル 500〜1,500㎡・店舗 1,000〜3,000㎡・倉庫 3,000〜1万㎡・工場 5,000〜3万㎡</span></label>
    ${kv([['土地の代金', fmtYen(lq.price)], ['仲介手数料（取得価額に含める）', fmtYen(lq.broker)], [term('登録免許税', 'touroku') + '・不動産取得税（租税公課）', fmtYen(lq.taxes)], ['合計', `<b>${fmtYen(lq.total)}</b>`], ['固定資産税・都市計画税（毎年）', fmtYen(lq.yearTax)]])}
    <div class="row" style="margin-top:6px">${btn('この土地を買う', 'kLandBuy', {}, 'primary', { disabled: ksB('cash') < lq.total })}${ksB('cash') < lq.total ? '<span class="small neg">現預金が足りません（借入は資金と銀行の画面で）</span>' : ''}</div>`;
  const starts = `<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${btn('ここで新しい事業を始める', 'kMapNewUnit', { p }, 'sm')}${!G.isSub ? btn('ここに子会社をつくる', 'kMapFound', { cc: 'jp', p }, 'sm') : ''}</div>`;
  return `${panel(`${esc(P.n)}`, `${info}${mine ? `<h3 class="fsh">この都道府県にある自社の拠点</h3><ul class="plain">${mine}</ul>` : ''}${hqAct || mv ? `<h3 class="fsh">移転</h3>${hqAct}${mv}` : ''}${starts}`, { aside: s.hq ? tag('本社', 'brass') : '' })}
    ${panel('土地を買う', land)}`;
}
CHANGES.kMapMvU = el => { UI.kMapMvU = el.value; render(); };
ACTIONS.kLandUse = d => { UI.kLand.use = d.v; render(); };
CHANGES.kLandArea = el => { const v = Math.round(+el.value); if (v >= 50 && v <= 200000) { UI.kLand.area = v; render(); } };
ACTIONS.kLandBuy = () => {
  const L = UI.kLand, q = ksLandQuote(L.p, L.use, L.area);
  confirmBox('土地を買う', `${esc(ksPrefName(L.p))}の${KS_LAND_USE[L.use]} ${fmtNum(L.area, 0)}㎡を買います。<br>代金と仲介手数料 ${fmtYen(q.cost)}（土地・減価償却しない）、登録免許税と不動産取得税 ${fmtYen(q.taxes)}（租税公課）。<br>毎年 ${fmtYen(q.yearTax)} の固定資産税・都市計画税がかかります。`, '買う', 'kLandBuyGo');
};
ACTIONS.kLandBuyGo = () => { const L = UI.kLand; const r = ksBuyLand(L.p, L.use, L.area); closeModal(true); toast(r.ok ? '土地を買いました' : r.why, r.ok ? 'ok' : 'bad'); render(); autosave(); };
ACTIONS.kMapHQ = d => {
  const q = ksMoveHQQuote(+d.p);
  if (!q.ok) return toast(q.why, 'bad');
  confirmBox('本社を移す', `本社を${esc(ksPrefName(G.loc.hq))}から${esc(ksPrefName(+d.p))}に移します。費用 ${fmtYen(q.total)}（本社の${q.staff}人の異動と事務所の移転 ${fmtYen(q.move)}・本店移転の登記 ${fmtYen(q.reg)}・司法書士 ${fmtYen(q.fee)}）。<br>本社の最低賃金と災害の危険が変わります。事業所は今の場所のままです。`, '移す', 'kMapHQGo', { p: d.p });
};
ACTIONS.kMapHQGo = d => { const r = ksMoveHQ(+d.p); closeModal(true); toast(r.ok ? '本社を移しました' : r.why, r.ok ? 'ok' : 'bad'); render(); autosave(); };
ACTIONS.kMapMove = d => {
  const u = ksUnit(UI.kMapMvU);
  const q = ksMoveUnitQuote(u, +d.p);
  if (!q.ok) return toast(q.why, 'bad');
  confirmBox('事業所を移す', `${esc(ksUName(u))}を${esc(ksPrefName(ksUnitPref(u)))}から${esc(ksPrefName(+d.p))}に移します。移転の費用 ${fmtYen(q.exp)}（事務所移転費用・特別損失）${q.nB ? `、建物の売却 ${fmtYen(q.bSale)}（売却損 ${fmtYen(q.bLoss)}）と新しい建物 ${fmtYen(q.bNew)}（固定資産）` : ''}。<br>移した月は営業が落ちます。人件費 ×${fmtNum(q.wage, 2)}・家賃 ×${fmtNum(q.rent, 2)}${q.demand !== 1 ? `・お客さま ×${fmtNum(q.demand, 2)}` : ''}。`, '移す', 'kMapMoveGo', { p: d.p });
};
ACTIONS.kMapMoveGo = d => { const r = ksMoveUnit(UI.kMapMvU, +d.p); closeModal(true); toast(r.ok ? '事業所を移しました' : r.why, r.ok ? 'ok' : 'bad'); render(); autosave(); };
ACTIONS.kMapNewUnit = d => { ACTIONS.kNewUnit(); UI.kNU.pref = +d.p; drawModal(); };
ACTIONS.kMapFound = d => {
  UI.kGF = Object.assign(UI.kGF || { q: '', type: null, sc: 1, own: 1, cc: 'jp', pref: G.loc ? G.loc.hq : KS_HOME_PREF, amt: null, name: '' }, { cc: d.cc });
  if (d.p) UI.kGF.pref = +d.p;
  UI.tab = 'k_group'; UI.kGrpSec = 'make';
  render(); window.scrollTo({ top: 0 });
};

/* 新しい事業の場所（新しい事業の画面） */
function ksNUPrefHtml(S) {
  if (!G.loc || (G.country && G.country !== 'jp')) return '';
  const N = UI.kNU;
  const p = N.pref && KS_PREFS[N.pref] ? +N.pref : G.loc.hq;
  N.pref = p;
  const groups = Object.entries(KS_PREF_REG).map(([r, n]) => `<optgroup label="${esc(n)}">${Object.values(KS_PREFS).filter(P => P.reg === r).map(P => `<option value="${P.c}"${P.c === p ? ' selected' : ''}>${esc(P.n)}${P.c === G.loc.hq ? '（本社）' : ''}</option>`).join('')}</optgroup>`).join('');
  const c = ksPrefCompare(p);
  const consumer = ['shop', 'rest'].includes(S.eng);
  return `<label class="field" style="margin-top:8px"><span>場所（都道府県）</span><select data-ch="kNUPref">${groups}</select>
    <span class="small muted">人件費 ×${fmtNum(c.wage, 2)}・家賃 ×${fmtNum(c.rent, 2)}${consumer ? `・お客さま ×${fmtNum(c.demand, 2)}` : ''}（${esc(KS_PREFS[G.loc.home || G.loc.hq].n)}と比べて）・最低賃金 ${fmtNum(Math.round(KS_PREFS[p].mw * (G.loc.mwIdx || 1)), 0)}円</span></label>`;
}
CHANGES.kNUPref = el => { UI.kNU.pref = +el.value; if (UI.kNU.draft) UI.kNU.draft.prefInit = UI.kNU.pref; drawModal(); };

/* ---------- 世界の地図 ---------- */
function ksMapWorldHtml() {
  const sites = ksForeignSites();
  const all = Object.assign({ jp: { n: '日本', x: 11, y: 1 } }, KS_COUNTRIES);
  const met = UI.kMapWMetric || 'wage';
  const v = cc => cc === 'jp' ? (met === 'wage' ? KS_JP_WAGE_USD : 30.6) : met === 'wage' ? (KS_COUNTRIES[cc].wk + KS_COUNTRIES[cc].st) / 2 : KS_COUNTRIES[cc].cit;
  const Q = ksQuantClass(Object.keys(all).map(v));
  if (!UI.kMapCC || !all[UI.kMapCC]) UI.kMapCC = sites.length ? sites[0].cc : 'us';
  const tiles = Object.entries(all).map(([cc, C]) => {
    const here = sites.filter(x => x.cc === cc);
    const nSub = here.filter(x => x.kind === 'sub').length, st = Math.max(0, ...here.filter(x => x.kind === 'intl').map(x => x.st));
    const sel = UI.kMapCC === cc;
    const mk = `${cc === 'jp' ? '<i class="m-hq">本</i>' : ''}${st ? `<i class="m-u" title="海外展開">${['', '輸', '営', '拠'][st]}</i>` : ''}${nSub ? '<i class="m-s" title="子会社">子</i>' : ''}`;
    const lab = `${C.n}${cc === 'jp' ? '' : `：${met === 'wage' ? `月給の目安 ${fmtNum(v(cc), 0)}ドル` : `法人税 約${v(cc)}%`}`}${nSub ? `・子会社${nSub}社` : ''}${st ? `・${['', '輸出', '営業所', '現地の拠点'][st]}` : ''}`;
    return `<button type="button" class="jt wt c${Q.cls(v(cc))}${sel ? ' sel' : ''}${cc === 'jp' ? ' hq' : ''}" style="grid-column:${C.x + 1};grid-row:${C.y + 1}" data-act="kMapCC" data-v="${cc}" aria-pressed="${sel}" aria-label="${esc(lab)}" title="${esc(lab)}"><span class="jn${(KS_CC_SHORT[cc] || C.n).length > 4 ? ' long' : ''}">${esc(KS_CC_SHORT[cc] || C.n)}</span>${mk ? `<span class="jm">${mk}</span>` : ''}</button>`;
  }).join('');
  const seg = [['wage', '賃金の水準'], ['cit', '法人税率']].map(([k, l]) => `<button type="button" data-act="kMapWMetric" data-v="${k}" aria-pressed="${met === k}">${l}</button>`).join('');
  const list = sites.length ? `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>国</th><th>拠点</th><th>から</th></tr></thead><tbody>${sites.map(x => `<tr><td>${esc(KS_COUNTRIES[x.cc] ? KS_COUNTRIES[x.cc].n : x.cc)}</td><td>${x.kind === 'sub' ? tag('子会社', 'brass') + ' ' : ''}${esc(x.n)}</td><td class="small">${ymLabel(x.since)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">海外の拠点はまだありません。成長の画面の「海外展開」か、グループの画面の「子会社をつくる」から始めます</div>';
  return `<div class="grid g-side map-grid"><div>${panel('世界の地図', `<div class="seg sm" role="radiogroup" aria-label="色で示す数字">${seg}</div>
      <div class="jmap-wrap"><div class="wmap" role="group" aria-label="国の地図">${tiles}</div></div>
      <div class="mapleg">${[Q.min, ...Q.q].map((b, i) => `<span><i class="sw c${i}"></i>${met === 'wage' ? `${fmtNum(b, 0)}ドル` : `${fmtNum(b, 1)}%`}〜</span>`).join('')}</div>
      <div class="mapleg marks"><span><i class="m-u">輸</i>輸出</span><span><i class="m-u">営</i>営業所</span><span><i class="m-u">拠</i>現地の拠点</span><span><i class="m-s">子</i>子会社</span></div>
      <p class="note">国の位置は実際の地図ではなく、地域ごとに並べたものです。賃金は製造業のワーカーと事務スタッフの月給の平均（米ドル）、法人税率は実効税率の目安（2026年）。</p>`)}
    ${panel('海外の拠点', list)}</div>
    <div class="stack">${ksMapCountryPanel(UI.kMapCC)}</div></div>`;
}
ACTIONS.kMapCC = d => { UI.kMapCC = d.v; render(); };
ACTIONS.kMapWMetric = d => { UI.kMapWMetric = d.v; render(); };
function ksMapCountryPanel(cc) {
  if (cc === 'jp') {
    return panel('日本', `${kv([['法人税等の実効税率', '約30.6%（資本金1億円以下の中小法人は、所得800万円までの法人税率が15%）'], ['消費税', '10%（食料品などは8%）'], ['最低賃金', `全国の加重平均 ${fmtNum(Math.round(1177 * ((G.loc && G.loc.mwIdx) || 1)), 0)}円（都道府県ごとに違う）`], ['本社', esc(ksPrefName(G.loc.hq))]])}<div class="row" style="margin-top:6px">${btn('国内の拠点を見る', 'kMapSec', { v: 'jp' }, 'sm')}</div>`);
  }
  const C = KS_COUNTRIES[cc];
  const r = KS_REGION_OF[C.reg];
  const sites = ksForeignSites().filter(x => x.cc === cc);
  const fx = C.cur === 'eur' ? `1ユーロ ${fmtNum(G.eco.eur || 160, 1)}円` : `1ドル ${fmtNum(G.eco.fx || 148, 1)}円`;
  const laws = `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>法令</th><th>中身</th><th>違反したとき</th></tr></thead><tbody>${C.laws.map(l => `<tr><td><b>${esc(l[0])}</b></td><td class="small">${esc(l[1])}</td><td class="small">${esc(l[2])}</td></tr>`).join('')}</tbody></table></div>`;
  const tl = KS_LAW_TL_FOREIGN.filter(x => x.cc === cc).map(x => `<li><b>${ymLabel(x.m)}</b>　${esc(x.t)}<div class="small muted">${esc(x.d)}</div></li>`).join('');
  // 海外展開の国
  let intl = '';
  if (G.grow && r && KS_REGIONS[r]) {
    const cur = ksIntlCC(r);
    const used = ksActiveUnits().filter(u => ksIntlStage(u, r) >= 1).map(u => (G.grow.intl[u.id][r].cc || KS_REG_COUNTRY_DEFAULT[r]));
    intl = `<div class="row between" style="margin-top:6px"><span class="small">海外展開（${esc(KS_REGIONS[r].n)}）の進出先：<b>${esc(KS_COUNTRIES[cur].n)}</b>${used.length ? `<br><span class="muted">すでに始めた事業は、始めたときの国のまま（${[...new Set(used)].map(c => esc(KS_COUNTRIES[c].n)).join('・')}）</span>` : ''}</span>${cur === cc ? tag('進出先', 'ok') : btn('この国にする', 'kMapIntlCC', { r, cc }, 'sm')}</div>`;
  }
  return `${panel(esc(C.n), `${kvV([
    ['法人税の実効税率（目安）', `約${C.cit}%`],
    ['付加価値税など', esc(C.vat)],
    ['日本の親会社への配当の源泉税', `${C.wht}%（租税条約。親会社では外国子会社の配当の95%が益金不算入）`],
    ['月給の目安', `ワーカー 約${fmtNum(C.wk, 0)}ドル・事務スタッフ 約${fmtNum(C.st, 0)}ドル（日本は約${fmtNum(KS_JP_WAGE_USD, 0)}ドル）`],
    ['事務所の賃料', `1㎡あたり月 約${C.rent}ドル`],
    ['最低賃金', esc(C.mw)],
    ['為替', fx],
    ['主なリスク', esc(C.risk)],
  ])}${intl}
    <div class="row" style="gap:6px;margin-top:8px">${!G.isSub ? btn('この国に子会社をつくる', 'kMapFound', { cc }, 'sm primary') : ''}</div>
    ${sites.length ? `<h3 class="fsh">この国の自社の拠点</h3><ul class="plain">${sites.map(x => `<li>${x.kind === 'sub' ? tag('子会社', 'brass') + ' ' : ''}${esc(x.n)}</li>`).join('')}</ul>` : ''}`)}
    ${panel(`${esc(C.n)}で守る法令`, `${laws}${tl ? `<h3 class="fsh">これからの改正</h3><ul class="tl">${tl}</ul>` : ''}<p class="note">拠点や子会社があると、毎年の法令の点検と研修（法令の画面の「やること」）が加わります。違反が見つかると、売上に比例する大きな制裁金になることがあります。数字はゲームの目安です。</p>`)}`;
}
ACTIONS.kMapIntlCC = d => { G.loc.intlCC = G.loc.intlCC || {}; G.loc.intlCC[d.r] = d.cc; toast(`${KS_REGIONS[d.r].n}の進出先を${KS_COUNTRIES[d.cc].n}にしました`); render(); autosave(); };

/* ---------- 土地と建物 ---------- */
function ksMapLandHtml() {
  const Lc = G.loc;
  const rows = Lc.lands.map(L => {
    const a = G.assets.find(x => x.id === L.asset);
    const val = ksLandValue(L);
    const gain = val - L.cost;
    const b = L.bldg;
    const bTxt = b ? `${KS_BLDG_KIND[b.kind].n}（延床${fmtNum(b.floor, 0)}㎡・${b.openM > G.m ? `${ymLabel(b.openM)}に完成` : '使用中'}${b.uid && ksUnit(b.uid) ? `・${esc(ksUName(ksUnit(b.uid)))}` : ''}）` : '<span class="muted">更地</span>';
    return `<tr><td><b>${esc(ksPrefName(L.pref))}</b><div class="small muted">${KS_LAND_USE[L.use]}・${fmtNum(L.area, 0)}㎡・${ymLabel(L.m)}に取得</div></td><td class="n">${fmtYen(a ? a.cost : L.cost)}</td><td class="n">${fmtYen(val)}<div class="small ${gain < 0 ? 'neg' : 'pos'}">${gain >= 0 ? '+' : '−'}${fmtYen(Math.abs(gain))}</div></td><td>${bTxt}</td><td class="n">${b ? '' : btn('建物を建てる', 'kBldOpen', { id: L.id }, 'sm')}${btn('売る', 'kLandSell', { id: L.id }, 'sm ghost')}</td></tr>`;
  }).join('');
  let tax = 0;
  for (const L of Lc.lands) { tax += ksLandQuote(L.pref, L.use, L.area).yearTax; if (L.bldg && L.bldg.openM <= G.m) tax += ksBldgQuote(L, L.bldg.kind).yearTax; }
  const tot = sum(Lc.lands, L => L.cost), val = sum(Lc.lands, ksLandValue);
  const sum1 = Lc.lands.length ? kv([['土地の取得価額の合計（貸借対照表）', fmtYen(tot)], ['時価（今の地価）', fmtYen(val)], ['含み損益', `<span class="${val - tot < 0 ? 'neg' : 'pos'}">${val - tot >= 0 ? '+' : '−'}${fmtYen(Math.abs(val - tot))}</span>`], ['固定資産税・都市計画税（年）', fmtYen(tax)]]) : '';
  return `<div class="grid g-side"><div>${panel('自社の土地と建物', rows ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>所在地</th><th class="n">取得価額</th><th class="n">時価</th><th>建物</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">自社の土地はまだありません。${btn('国内の地図で土地を探す', 'kMapSec', { v: 'jp' }, 'sm')}</div>`)}
    ${UI.kBld ? ksBldPanel() : ''}</div>
    <div class="stack">${sum1 ? panel('まとめ', sum1) : ''}${panel('土地と建物の会計と税金', `<ul class="small" style="margin:0;padding-left:1.2em"><li>土地は減価償却しません。建物は耐用年数で減価償却します（鉄筋コンクリートの事務所は50年）。</li><li>買うときの${term('登録免許税', 'touroku')}（土地の売買は1.5%。2029年3月まで）と${term('不動産取得税', 'fudousanShutoku')}（3%）は、租税公課にできます。</li><li>毎年1月1日の所有者に${term('固定資産税', 'koteiShisanZei')}（1.4%）と都市計画税（0.3%まで）がかかります。</li><li>土地の上に建てられるものは${term('用途地域', 'youtoChiiki')}で決まります。</li><li>地価は毎年7月の地価調査で動きます。売ると、帳簿の価額との差が固定資産売却益（損）になります。</li></ul>`)}</div></div>`;
}
ACTIONS.kBldOpen = d => { UI.kBld = { id: d.id, kind: null, uid: '' }; render(); };
function ksBldPanel() {
  const B = UI.kBld, L = G.loc.lands.find(x => x.id === B.id);
  if (!L) { UI.kBld = null; return ''; }
  const ok = KS_ZONE[L.use].ok;
  if (!B.kind || !ok.includes(B.kind)) B.kind = ok[0];
  const kinds = ok.map(k => `<button type="button" data-act="kBldKind" data-v="${k}" aria-pressed="${B.kind === k}">${KS_BLDG_KIND[k].n}</button>`).join('');
  const q = ksBldgQuote(L, B.kind);
  const units = ksActiveUnits().filter(u => !G.loc.lands.some(x => x.bldg && x.bldg.uid === u.id));
  const uOpts = `<option value="">使う事業を決めない（本社・賃貸）</option>${units.map(u => `<option value="${u.id}"${B.uid === u.id ? ' selected' : ''}>${esc(ksUName(u))}（今は${esc(ksPrefName(ksUnitPref(u)))}）</option>`).join('')}`;
  return panel(`建物を建てる（${esc(ksPrefName(L.pref))}・${KS_LAND_USE[L.use]}${fmtNum(L.area, 0)}㎡）`, `<div class="seg wrap sm" role="radiogroup">${kinds}</div>
    <p class="small" style="margin:6px 0">${esc(KS_BLDG_KIND[B.kind].desc)}</p>
    <label class="field"><span>使う事業</span><select data-ch="kBldU">${uOpts}</select><span class="small muted">事業を選ぶと、完成の後はその事業の家賃がほぼなくなります（所在地もこの土地に移ります）</span></label>
    ${kv([['延床面積', `${fmtNum(q.floor, 0)}㎡（容積の目安 ${Math.round(KS_BLDG_KIND[B.kind].far * 100)}%）`], ['建設の費用（建物）', `<b>${fmtYen(q.cost)}</b>（完成までは建設仮勘定）`], ['登録免許税・不動産取得税', fmtYen(q.taxes)], ['耐用年数', `${q.life}年（定額法）`], ['完成', `${ymLabel(G.m + q.lead)}（${q.lead}か月）`], ['固定資産税（年）', fmtYen(q.yearTax)]])}
    <div class="row" style="margin-top:6px">${btn('建てる', 'kBldGo', {}, 'primary', { disabled: ksB('cash') < q.cost + q.taxes })}${btn('やめる', 'kBldClose', {}, 'ghost')}${ksB('cash') < q.cost + q.taxes ? '<span class="small neg">現預金が足りません</span>' : ''}</div>`);
}
ACTIONS.kBldKind = d => { UI.kBld.kind = d.v; render(); };
CHANGES.kBldU = el => { UI.kBld.uid = el.value; };
ACTIONS.kBldClose = () => { UI.kBld = null; render(); };
ACTIONS.kBldGo = () => {
  const B = UI.kBld;
  const r = ksBuildOnLand(B.id, B.kind, B.uid || null);
  toast(r.ok ? '建設を始めました' : r.why, r.ok ? 'ok' : 'bad');
  if (r.ok) UI.kBld = null;
  render(); autosave();
};
ACTIONS.kLandSell = d => {
  const L = G.loc.lands.find(x => x.id === d.id);
  if (!L) return;
  const price = Math.round(ksLandValue(L) * 0.97 / 1e4) * 1e4;
  confirmBox('土地を売る', `${esc(ksPrefName(L.pref))}の土地${L.bldg ? 'と建物' : ''}を売ります。土地の売値の見込み ${fmtYen(price)}（取得価額 ${fmtYen(L.cost)}）。帳簿の価額との差は固定資産売却益（損）です。${L.bldg && L.bldg.uid ? '<br>この建物で営業している事業は、家賃を払って借りることになります。' : ''}`, '売る', 'kLandSellGo', { id: d.id }, true);
};
ACTIONS.kLandSellGo = d => { const r = ksSellLand(d.id); closeModal(true); toast(r.ok ? `売りました（売却損益 ${fmtYen(r.gain)}）` : '売れませんでした', r.ok ? 'ok' : 'bad'); render(); autosave(); };

/* ---------- 災害と保険 ---------- */
function ksMapRiskHtml() {
  const Lc = G.loc;
  const prefs = [...new Set([Lc.hq, ...ksActiveUnits().map(ksUnitPref), ...Lc.lands.map(L => L.pref)])];
  const rows = prefs.map(p => {
    const P = KS_PREFS[p], s = ksSitesIn(p);
    const what = [s.hq ? '本社' : '', ...s.units.map(ksUName), s.lands.length ? `土地${s.lands.length}` : ''].filter(Boolean).join('・');
    const c = k => `<td class="n ${P.risk[k] >= 3 ? 'neg' : ''}">${KS_RISK_LV[P.risk[k]]}</td>`;
    return `<tr><td><b>${esc(P.n)}</b><div class="small muted">${esc(what)}</div></td>${c('eq')}${c('ty')}${c('fl')}${c('sn')}</tr>`;
  }).join('');
  const val = sum(ksActiveAssets().filter(a => ['bldg', 'mach', 'equip'].includes(a.acct)), a => a.cost - a.booked);
  const prem = Math.round(val * 0.0012 / 100) * 100;
  const fire = G.law ? !!G.law.policy.fireIns : false;
  const bcp = typeof ksHrF === 'function' ? ksHrF(null, 'bcp') : 1;
  const dis = (Lc.dis || []).map(x => `<tr><td class="small">${ymLabel(x.m)}</td><td>${esc(ksPrefName(x.pref))}の${esc(KS_DIS[x.k].n)}</td><td class="n neg">${fmtYen(x.loss)}</td><td class="n">${x.ins ? fmtYen(x.ins) : '―'}</td></tr>`).join('');
  const stops = (Lc.stops || []).filter(x => x.until > G.m && ksUnit(x.u)).map(x => `<li>${esc(ksUName(ksUnit(x.u)))}：${ymLabel(x.until - 1)}まで営業が${Math.round((1 - x.f) * 100)}%落ちる</li>`).join('');
  return `<div class="grid g-side"><div>${panel('拠点の災害の起きやすさ', `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>所在地</th><th class="n">地震</th><th class="n">台風</th><th class="n">水害</th><th class="n">大雪</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">地震は地震調査研究推進本部の長期評価（南海トラフ地震の30年以内の確率は60〜90%程度以上、首都直下は70%程度）などからの目安。災害の被害は、建物・設備の帳簿の価額と在庫の大きさで決まります。</p>`)}
    ${panel('災害の記録', dis ? `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>年月</th><th>災害</th><th class="n">被害（特別損失）</th><th class="n">保険金</th></tr></thead><tbody>${dis}</tbody></table></div>` : '<div class="empty">まだ災害はありません</div>')}
    ${stops ? panel('営業への影響', `<ul class="plain">${stops}</ul>`) : ''}</div>
    <div class="stack">${panel('保険', `<label class="inline"><input type="checkbox" data-act="kLawPolicy" data-k="fireIns" ${fire ? 'checked' : ''}> 火災保険（台風・水害・大雪を含む。保険料は年0.11%ほど）</label>
      <label class="inline"><input type="checkbox" data-act="kEqIns" ${Lc.eqIns ? 'checked' : ''}> ${term('地震保険（地震危険補償特約）', 'jishinHoken')}：年 ${fmtYen(prem)} ほど</label>
      <p class="note">火災保険だけでは、地震・噴火・津波の損害は補償されません。地震の保険金は被害の半分ほど（このゲームの目安）。保険料は損害保険料（販管費）、保険金は受取保険金（特別利益）です。</p>`)}
      ${panel(term('BCP（事業継続計画）', 'bcp'), `<p class="small" style="margin:0 0 6px">災害のときに、何を優先して、どれだけの期間で事業を戻すかを決めた計画。被害と営業の止まる期間を小さくします。</p>${kv([['いまの備え', bcp < 1 ? `被害 ×${fmtNum(bcp, 2)}` : 'ふつう'], ['備えを強める', '方針と人事の画面で、重点実施事項「BCPと防災」か、経営方針「ガバナンス・リスク管理」']])}<div class="row" style="margin-top:6px">${btn('方針と人事へ', 'kGoHr', {}, 'sm')}</div>`)}</div></div>`;
}
ACTIONS.kEqIns = () => { G.loc.eqIns = !G.loc.eqIns; toast(G.loc.eqIns ? '地震保険に入りました' : '地震保険をやめました'); render(); autosave(); };
ACTIONS.kGoHr = () => { UI.tab = 'k_hr'; UI.kHrSec = 'policy'; render(); window.scrollTo({ top: 0 }); };

/* ---------- 出来事と災害のお知らせ ---------- */
MODALS.kEvt = a => {
  const E = KS_EVT2[a.id];
  if (!E) return modalFrame('出来事', '<p>この出来事は終わりました。</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  if (a.choose && !a.done) {
    const chs = E.ch.map((c, i) => `<button type="button" class="choice" data-act="kEvtCh" data-i="${i}">${esc(c[0])}</button>`).join('');
    return modalFrame(esc(E.t), `<p>${esc(a.body)}</p><div class="choices">${chs}</div>`, '', { noClose: true, sub: `${ymLabel(G.m)}・どう対応するかを選んでください` });
  }
  return modalFrame(esc(E.t), `<p>${esc(a.body)}</p>${a.msg ? `<div class="callout">${esc(a.msg)}</div>` : ''}`, btn('閉じる', 'closeModal', {}, 'primary'), { sub: ymLabel(G.m) });
};
MODALS.kEvt.locked = a => !!(a && a.choose && !a.done);
ACTIONS.kEvtCh = d => {
  const a = UI.modal && UI.modal.args;
  if (!a || a.done) return;
  a.msg = ksEvtChoose(a.id, +d.i);
  a.done = true;
  render(); drawModal(); autosave();
};
MODALS.kDisaster = a => {
  const D = KS_DIS[a.k];
  const P = KS_PREFS[a.pref];
  const body = `<p><b>${esc(P.n)}</b>で${esc(D.n)}が起きました。建物・設備の復旧に <b>${fmtYen(a.loss)}</b> かかり、災害による損失（特別損失）になります。</p>
    <p>${a.ins ? `保険金 <b>${fmtYen(a.ins)}</b> が2か月ほどで入ります（受取保険金：特別利益）。` : D.ins === 'eq' ? '火災保険では地震の損害は補償されません。地震保険（地震危険補償特約）に入っていませんでした。' : '保険に入っていなかったので、補償はありません。'}</p>
    <p class="small muted">${esc(KS_PREF_RISKNOTE[P.reg])}。拠点を分ける、BCPをつくる、保険に入る、といった備えで被害を小さくできます。</p>`;
  return modalFrame(`【災害】${esc(P.n)}の${esc(D.n)}`, body, btn('拠点と地図を見る', 'kDisGo', {}, '') + btn('閉じる', 'closeModal', {}, 'primary'), { sub: ymLabel(G.m) });
};
ACTIONS.kDisGo = () => { UI.tab = 'k_map'; UI.kMapSec = 'risk'; closeModal(true); render(); window.scrollTo({ top: 0 }); };

/* ---------- 用語 ---------- */
Object.assign(TERMS, {
  touroku: { n: '登録免許税', c: 'law', s: '登記をするときに国に納める税金。', b: '土地の売買による所有権の移転の登記は、固定資産税評価額の2%（2029年3月31日までは1.5%）。建物の新築（保存登記）は0.4%。本店の移転の登記は3万円（管轄の外なら旧・新の両方で）。' },
  fudousanShutoku: { n: '不動産取得税', c: 'law', s: '土地や建物を取得したときに、都道府県に一度だけ納める税金。', b: '固定資産税評価額の4%（土地と住宅は3%。宅地は評価額を1/2にする特例が2027年3月まで）。' },
  koteiShisanZei: { n: '固定資産税', c: 'law', s: '1月1日に持つ土地・建物・償却資産にかかる市町村の税金。', b: '標準の税率は1.4%。市街化区域の土地・建物には都市計画税（0.3%まで）もかかります。年4回に分けて納め、租税公課として費用にします。' },
  youtoChiiki: { n: '用途地域', c: 'law', s: '都市計画法で、土地に建てられる建物の種類を決めた13の地域。', b: '住居系（第一種低層住居専用地域など8種）・商業系（近隣商業・商業）・工業系（準工業・工業・工業専用）に分かれ、工場は住居系の地域には原則として建てられません。' },
  jishinHoken: { n: '地震保険（地震危険補償特約）', c: 'law', s: '地震・噴火・津波による建物・設備の損害を補う保険。', b: '火災保険では地震による火災も補償されないため、会社は火災保険に特約として付けます。保険料は地域と建物の構造で違います。' },
  bcp: { n: 'BCP（事業継続計画）', c: 'law', s: '災害や事故のときに、大事な事業を続け、早く元に戻すための計画。', b: '優先する事業、目標の復旧時間、代わりの拠点、連絡の体制、在庫と資金の備えを決めます。中小企業は「事業継続力強化計画」の認定を受けると、税制の優遇や補助金の加点があります。' },
});
