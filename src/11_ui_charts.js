'use strict';
/* =========================================================
 *  11_ui_charts.js : SVGチャートと汐見市の地図
 *  線は2px、罫線は1pxの細線、ラベルは本文色。値はツールチップと表で確認できる。
 * ========================================================= */

function niceScale(lo, hi, n = 4) {
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
  const mid = (lo + hi) / 2, minSpan = Math.abs(mid) * 0.04;
  if (hi - lo < minSpan) { lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  if (lo === hi) { const d = Math.abs(lo) * 0.1 || 1; lo -= d; hi += d; }
  const raw = (hi - lo) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  return { lo: Math.floor(lo / step + 1e-9) * step, hi: Math.ceil(hi / step - 1e-9) * step, step };
}
function axisYen(v) {
  const a = Math.abs(v), s = v < 0 ? MINUS : '';
  if (a >= 1e12) return s + fmtNum(a / 1e12, a % 1e12 ? 1 : 0) + '兆';
  if (a >= 1e8) return s + fmtNum(a / 1e8, a >= 1e10 || a % 1e8 === 0 ? 0 : 1) + '億';
  if (a >= 1e4) return s + fmtNum(a / 1e4, 0) + '万';
  return s + fmtNum(a, 0);
}
const axisPct = d => v => fmtNum(v, d) + '%';

/* 折れ線（複数系列）。series: [{name, color:'s1', values:[]}] */
const chartW = () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 380 : 640);
function lineChart(o) {
  const W = o.width || chartW(), H = Math.round((o.height || 210) * (chartW() < 640 ? 0.85 : 1));
  const L = 52, R = o.endLabels === false ? 12 : (W < 500 ? 80 : 96), T = 12, Bt = 24;
  const n = o.labels.length;
  if (!n) return '<div class="empty">データがまだありません</div>';
  let lo = Infinity, hi = -Infinity;
  for (const s of o.series) for (const v of s.values) if (v !== null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (o.minZero) lo = Math.min(0, lo);
  if (o.yMin !== undefined) lo = Math.min(lo, o.yMin);
  const sc = niceScale(lo, hi, o.ticks || 4);
  const yf = o.yFmt || axisYen;
  const x = i => L + (W - L - R) * (n <= 1 ? 0.5 : i / (n - 1));
  const y = v => T + (H - T - Bt) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  let g = '';
  for (let v = sc.lo; v <= sc.hi + sc.step / 2; v += sc.step) {
    g += `<line class="gl" x1="${L}" x2="${W - R + 4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${yf(v)}</text>`;
  }
  if (sc.lo < 0 && sc.hi > 0) g += `<line class="ax" x1="${L}" x2="${W - R + 4}" y1="${y(0)}" y2="${y(0)}"/>`;
  const every = Math.max(1, Math.ceil(n / (W < 500 ? 4 : 7)));
  for (let i = 0; i < n; i += every) g += `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(o.labels[i])}</text>`;
  let paths = '', ends = [];
  for (const s of o.series) {
    let d = '', started = false;
    s.values.forEach((v, i) => {
      if (v === null || !isFinite(v)) { started = false; return; }
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      started = true;
    });
    paths += `<path d="${d}" fill="none" stroke="var(--${s.color})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="5 4"' : ''}/>`;
    const li = s.values.length - 1;
    const lv = s.values[li];
    if (lv !== null && isFinite(lv)) {
      paths += `<circle cx="${x(li).toFixed(1)}" cy="${y(lv).toFixed(1)}" r="4" fill="var(--${s.color})" stroke="var(--sheet)" stroke-width="2"/>`;
      ends.push({ y: y(lv), s, v: lv });
    }
  }
  let labels = '';
  if (o.endLabels !== false) {
    ends.sort((a, b) => a.y - b.y);
    const ok = ends.every((e, i) => i === 0 || e.y - ends[i - 1].y >= 26);
    if (ok) for (const e of ends) labels += `<text class="glab" x="${W - R + 10}" y="${(e.y - 2).toFixed(1)}">${esc(e.s.name)}</text><text x="${W - R + 10}" y="${(e.y + 11).toFixed(1)}" style="fill:var(--ink-2)">${(o.tipFmt || fmtYen)(e.v)}</text>`;
  }
  let hits = '';
  const tf = o.tipFmt || fmtYen;
  const slot = (W - L - R) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const tip = o.labels[i] + '\n' + o.series.map(s => `${s.name}　${s.values[i] === null || !isFinite(s.values[i]) ? '―' : tf(s.values[i])}`).join('\n');
    const x0 = n <= 1 ? L : x(i) - slot / 2;
    hits += `<g class="hitg"><line class="xh" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${T}" y2="${H - Bt}"/><rect class="hit" x="${Math.max(L, x0).toFixed(1)}" y="${T}" width="${(n <= 1 ? W - L - R : slot).toFixed(1)}" height="${H - T - Bt}" data-tip="${esc(tip)}"/></g>`;
  }
  const legend = o.series.length > 1 ? `<div class="legend" style="margin-bottom:6px">${o.series.map(s => `<span><i class="ln" style="background:var(--${s.color})"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${legend}<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || o.series.map(s => s.name).join('・') + 'の推移')}">${g}${paths}${labels}${hits}</svg>`;
}

/* 棒グラフ（正負対応）。値がマイナスの棒は朱色（赤字） */
function barChart(o) {
  const W = o.width || chartW(), H = Math.round((o.height || 190) * (chartW() < 640 ? 0.85 : 1));
  const L = 52, R = 12, T = 12, Bt = 24;
  const n = o.values.length;
  if (!n) return '<div class="empty">データがまだありません</div>';
  const vals = o.values.map(v => (isFinite(v) ? v : 0));
  const sc = niceScale(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  const yf = o.yFmt || axisYen;
  const slot = (W - L - R) / n;
  const bw = Math.min(24, slot * 0.62);
  const y = v => T + (H - T - Bt) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  let g = '';
  for (let v = sc.lo; v <= sc.hi + sc.step / 2; v += sc.step) g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${yf(v)}</text>`;
  const y0 = y(0);
  g += `<line class="ax" x1="${L}" x2="${W - R}" y1="${y0}" y2="${y0}"/>`;
  const every = Math.max(1, Math.ceil(n / (W < 500 ? 5 : 8)));
  let bars = '';
  vals.forEach((v, i) => {
    const cx = L + slot * (i + 0.5);
    if (i % every === 0) g += `<text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(o.labels[i])}</text>`;
    const yv = y(v);
    const hgt = Math.abs(yv - y0);
    const r = Math.min(4, hgt, bw / 2);
    const x0 = cx - bw / 2, x1 = cx + bw / 2;
    let d;
    if (hgt < 0.5) d = '';
    else if (v >= 0) d = `M${x0},${y0}V${yv + r}Q${x0},${yv} ${x0 + r},${yv}H${x1 - r}Q${x1},${yv} ${x1},${yv + r}V${y0}Z`;
    else d = `M${x0},${y0}V${yv - r}Q${x0},${yv} ${x0 + r},${yv}H${x1 - r}Q${x1},${yv} ${x1},${yv - r}V${y0}Z`;
    if (d) bars += `<path d="${d}" fill="var(--${v < 0 ? (o.negColor || 'shu') : (o.color || 's1')})"/>`;
    bars += `<rect class="hit" x="${(cx - slot / 2).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${H - T - Bt}" data-tip="${esc(o.labels[i] + '\n' + (o.name || '') + '　' + (o.tipFmt || fmtYen)(v))}"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || o.name || '棒グラフ')}">${g}${bars}</svg>`;
}

function sparkline(values, o = {}) {
  const W = o.w || 96, H = o.h || 22;
  const v = values.filter(x => isFinite(x));
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v);
  const span = hi - lo || 1;
  const pts = v.map((x, i) => `${(2 + (W - 4) * i / (v.length - 1)).toFixed(1)},${(H - 3 - (H - 6) * (x - lo) / span).toFixed(1)}`);
  const [lx, ly] = pts[pts.length - 1].split(',');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" style="vertical-align:middle"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--${o.color || 'ink-3'})" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${lx}" cy="${ly}" r="2.5" fill="var(--${o.color || 'ink-3'})"/></svg>`;
}

/* 区分構成の横帯（セグメントバー） */
function segBar(parts, o = {}) {
  const tot = sum(parts, p => Math.max(0, p.v)) || 1;
  const segs = parts.filter(p => p.v > 0).map(p => `<span style="flex:${p.v / tot};background:var(--${p.color});height:${o.h || 10}px;min-width:2px;border-radius:2px" data-tip="${esc(p.name + '　' + fmtYen(p.v) + '（' + fmtPct(p.v / tot * 100, 1) + '）')}"></span>`).join('');
  const legend = `<div class="legend" style="margin-top:6px">${parts.map(p => `<span><i class="sw" style="background:var(--${p.color})"></i>${esc(p.name)}</span>`).join('')}</div>`;
  return `<div style="display:flex;gap:2px">${segs}</div>${legend}`;
}

/* ---------- 汐見市の地図 ---------- */
const MAP_SEA = [[20, 440], [262, 428], [560, 432], [640, 405], [780, 420], [780, 470], [20, 470]];
const MAP_LOTS = {};
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function lotsFor(D, idx) {
  if (MAP_LOTS[D.id]) return MAP_LOTS[D.id];
  const r = seeded(1000 + idx * 7919);
  const xs = D.poly.map(p => p[0]), ys = D.poly.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const lots = [];
  let tries = 0;
  while (lots.length < 40 && tries < 4000) {
    tries++;
    const x = x0 + 10 + r() * (x1 - x0 - 20), y = y0 + 10 + r() * (y1 - y0 - 20);
    if (!pointInPoly(x, y, D.poly)) continue;
    if (!pointInPoly(x - 8, y - 10, D.poly) || !pointInPoly(x + 8, y + 4, D.poly)) continue;
    if (Math.hypot(x - D.label[0], y - D.label[1]) < 34) continue;
    if (lots.some(l => Math.abs(l.x - x) < 13 && Math.abs(l.y - y) < 13)) continue;
    lots.push({ x, y, k: r() });
  }
  // 地区の中心に近い区画ほど先に建つ
  lots.sort((a, b) => Math.hypot(a.x - D.label[0], a.y - D.label[1]) - Math.hypot(b.x - D.label[0], b.y - D.label[1]));
  MAP_LOTS[D.id] = lots;
  return lots;
}
const PROJ_ICON = {
  tower: '<rect x="-5" y="-22" width="10" height="22"/><rect x="-2" y="-28" width="4" height="6"/>',
  mall: '<rect x="-11" y="-10" width="22" height="10"/><rect x="-7" y="-15" width="14" height="5"/>',
  warehouse: '<path d="M-12 0V-9L0-15L12-9V0Z"/>',
  factory: '<path d="M-12 0V-10L-6-6V-10L0-6V-16H5V0Z"/>',
  houses: '<path d="M-12 0V-7L-7-12L-2-7V0Z"/><path d="M1 0V-7L6-12L11-7V0Z"/>',
  lab: '<rect x="-9" y="-12" width="18" height="12"/><circle cx="0" cy="-15" r="4"/>',
  hotel: '<rect x="-7" y="-20" width="14" height="20"/><rect x="-11" y="-6" width="22" height="6"/>',
  market: '<path d="M-11 0V-8H11V0Z"/><path d="M-13-8L0-15L13-8Z"/>',
  civic: '<rect x="-10" y="-12" width="20" height="12"/><path d="M-12-12L0-19L12-12Z"/>',
  station: '<rect x="-13" y="-8" width="26" height="8"/><rect x="-4" y="-14" width="8" height="6"/>',
  ship: '<path d="M-13-6H13L9 0H-9Z"/><rect x="-4" y="-12" width="8" height="6"/>',
  hospital: '<rect x="-9" y="-16" width="18" height="16"/><path d="M-1.5-13H1.5V-10H4.5V-7H1.5V-4H-1.5V-7H-4.5V-10H-1.5Z" fill="var(--sheet)"/>',
  farm: '<path d="M-12 0V-8L-4-13L4-8V0Z"/><rect x="5" y="-12" width="5" height="12"/>',
};
function cityMap(o = {}) {
  const c = G.city;
  let polys = '', blds = '', marks = '', labels = '';
  DISTRICTS.forEach((D, idx) => {
    const s = c.d[D.id];
    const op = clamp(0.1 + (s.vit - 70) / 75 * 0.6, 0.08, 0.72);
    const pts = D.poly.map(p => p.join(',')).join(' ');
    polys += `<polygon class="dist${o.sel === D.id ? ' sel' : ''}" points="${pts}" fill="var(--vault)" fill-opacity="${op.toFixed(2)}" data-act="cityPick" data-d="${D.id}" data-tip="${esc(`${D.name}\n人口 ${fmtNum(s.pop)}人　事業所 ${fmtNum(s.firms)}\n地域活力 ${fmtNum(s.vit, 1)}　地価 ${fmtNum(s.land, 1)}`)}"/>`;
    const lots = lotsFor(D, idx);
    const lv = devLevel(D.id);
    const nB = Math.round(clamp(lv * 3.4, 3, lots.length));
    for (let i = 0; i < nB; i++) {
      const l = lots[i];
      const tall = D.id === 'chuo' || D.id === 'ekimae' ? 1.6 : D.id === 'newtown' || D.id === 'denen' || D.id === 'onsen' ? 0.6 : 1;
      const h = (4 + l.k * 6 + lv * 0.9) * tall;
      const w = D.id === 'kogyo' || D.id === 'kowan' ? 11 : 7;
      blds += `<rect class="bld${i < 4 ? ' hi' : ''}" x="${(l.x - w / 2).toFixed(1)}" y="${(l.y - h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" rx="1"/>`;
    }
    if (!o.compact) labels += `<text class="lbl" x="${D.label[0]}" y="${D.label[1]}" text-anchor="middle">${esc(D.name)}</text><text class="lbl2" x="${D.label[0]}" y="${D.label[1] + 15}" text-anchor="middle">活力 ${fmtNum(s.vit, 0)}・${fmtNum(s.pop / 1e4, 1)}万人</text>`;
    // 店舗マーカー
    const brs = G.branches.filter(b => b.d === D.id);
    brs.forEach((b, k) => {
      const mx = D.label[0] - 26 + k * 22, my = D.label[1] - 30;
      const building = b.openM > G.m;
      marks += `<g transform="translate(${mx},${my})" data-tip="${esc(b.name + (building ? `（${ymLabel(b.openM)}開業予定）` : ''))}"><circle r="9" fill="${building ? 'var(--sheet)' : 'var(--vault)'}" stroke="var(--vault)" stroke-width="2"${building ? ' stroke-dasharray="3 2"' : ''}/><rect x="-3.5" y="-3.5" width="7" height="7" fill="none" stroke="${building ? 'var(--vault)' : 'var(--on-vault)'}" stroke-width="1.5"/></g>`;
    });
    // プロジェクト
    for (const P of PROJECTS.filter(p => p.d === D.id)) {
      const st = c.projects[P.id];
      if (!st || !['offered', 'building', 'done'].includes(st.status)) continue;
      const k = P.req ? 1 : 0;
      const px = D.label[0] + 38 + k * 26, py = D.label[1] + 2;
      const col = st.status === 'done' ? 'var(--ink)' : st.status === 'building' ? 'var(--brass)' : 'var(--brass)';
      const label = st.status === 'done' ? '完成' : st.status === 'building' ? `建設中（${ymLabel(st.doneM)}完成予定）` : '資金調達中';
      marks += `<g transform="translate(${px},${py})" fill="${col}" opacity="${st.status === 'offered' ? 0.75 : 0.95}" data-tip="${esc(P.name + '\n' + label)}"${st.status === 'offered' ? ' stroke="var(--brass)" stroke-dasharray="2 2" fill-opacity="0.35"' : ''}>${PROJ_ICON[P.icon] || PROJ_ICON.tower}</g>`;
    }
  });
  const sea = `<polygon points="${MAP_SEA.map(p => p.join(',')).join(' ')}" fill="var(--s2)" fill-opacity="0.16"/>${o.compact ? '' : '<text x="690" y="455" class="lbl2" text-anchor="middle">汐見湾</text>'}`;
  const river = '<path d="M470,20 C455,70 430,110 425,160 C420,210 405,250 412,300 C418,350 430,390 432,432" fill="none" stroke="var(--s2)" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round"/>';
  const rail = '<path d="M20,240 L230,236 L420,232 L600,228 L780,224" fill="none" stroke="var(--ink-2)" stroke-width="2.5" opacity=".55"/><path d="M20,240 L230,236 L420,232 L600,228 L780,224" fill="none" stroke="var(--sheet)" stroke-width="1.2" stroke-dasharray="6 6" opacity=".9"/><rect x="480" y="222" width="22" height="9" rx="2" fill="var(--ink-2)"/>';
  const svg = `<div class="map-wrap"><svg class="map" viewBox="0 0 800 470" role="img" aria-label="汐見市の地図。地区の濃さは地域活力を表す">${sea}${polys}${river}${rail}${blds}${marks}${labels}</svg></div>`;
  if (o.compact) return svg + '<p class="note" style="margin:4px 0 0">地区の濃さは地域活力。地図に触れると地区の様子が出ます。</p>';
  return `${svg}
  <div class="legend" style="margin-top:6px"><span>地域活力 低<span class="ramp" style="margin:0 6px">${[0.1, 0.24, 0.38, 0.52, 0.66].map(a => `<i style="background:var(--vault);opacity:${a}"></i>`).join('')}</span>高</span><span><svg width="16" height="16" viewBox="-9 -9 18 18" style="vertical-align:-3px"><circle r="7" fill="var(--vault)"/></svg> 当行の店舗</span><span><svg width="16" height="16" viewBox="-12 -16 24 18" style="vertical-align:-3px"><g fill="var(--brass)">${PROJ_ICON.tower}</g></svg> 開発プロジェクト</span></div>`;
}
