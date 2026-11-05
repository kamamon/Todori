'use strict';
/* =========================================================
 *  頭取 ― 地方銀行経営シミュレーション
 *  00_util.js : 乱数・数値・書式ユーティリティ
 * ========================================================= */

let G = null; // ゲーム状態（セーブ対象）

/* ---------- 乱数（シード付き mulberry32。状態は G.rs に保存） ---------- */
function rand() {
  if (!G) return Math.random();
  let a = G.rs | 0;
  a = (a + 0x6D2B79F5) | 0;
  G.rs = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randn() {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const uni = (a, b) => a + (b - a) * rand();
const randInt = (a, b) => Math.floor(uni(a, b + 1));
const chance = p => rand() < p;
const pick = arr => arr[Math.floor(rand() * arr.length)];
function wpick(items, weights) {
  let s = 0;
  for (const w of weights) s += Math.max(0, w);
  if (s <= 0) return items[0];
  let r = rand() * s;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
function poisson(l) {
  if (l <= 0) return 0;
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * randn()));
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}
/* 固定シードの補助乱数（地図の建物配置など、ゲーム進行に影響しない用途） */
function seeded(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 数値 ---------- */
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sigmoid = x => 1 / (1 + Math.exp(-x));
function sum(arr, f) { let s = 0, i = 0; for (const x of arr) s += f ? f(x, i++) : x; return s; }
const roundTo = (x, unit) => Math.round(x / unit) * unit;
/* 区分線形補間： pts = [[x0,y0],[x1,y1],...]（x昇順） */
function interp(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}
/* 申込金額などの自然な丸め */
function niceAmount(x) {
  if (x >= 2e9) return roundTo(x, 1e8);
  if (x >= 2e8) return roundTo(x, 1e7);
  if (x >= 2e7) return roundTo(x, 1e6);
  return Math.max(1e6, roundTo(x, 1e5));
}

/* ---------- 書式 ---------- */
const MINUS = '−';
function fmtNum(x, d = 0) {
  if (!isFinite(x)) return '―';
  return Number(x).toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d });
}
/* 金額をわかりやすく（12.3億円 / 4,560万円） */
function fmtYen(x, opt = {}) {
  if (!isFinite(x)) return '―';
  const neg = x < 0;
  const a = Math.abs(x);
  let s;
  if (a >= 1e12) s = fmtNum(a / 1e12, a >= 1e13 ? 1 : 2) + '兆';
  else if (a >= 1e8) {
    const o = a / 1e8;
    s = fmtNum(o, o >= 100 ? 0 : o >= 10 ? 1 : 2) + '億';
  } else if (a >= 1e4) s = fmtNum(Math.round(a / 1e4)) + '万';
  else s = fmtNum(Math.round(a));
  return (neg ? (opt.tri ? '△' : MINUS) : (opt.sign && x > 0 ? '+' : '')) + s + (opt.noUnit ? '' : '円');
}
/* 百万円単位（財務諸表用、マイナスは△） */
function fmtM(x) {
  const v = Math.round(x / 1e6);
  if (v === 0 && x !== 0 && Math.abs(x) >= 1) return x < 0 ? '△0' : '0';
  return v < 0 ? '△' + fmtNum(-v) : fmtNum(v);
}
/* 千円単位（企業の決算書用） */
function fmtK(x) {
  const v = Math.round(x / 1e3);
  return v < 0 ? '△' + fmtNum(-v) : fmtNum(v);
}
function fmtPct(x, d = 2, opt = {}) {
  if (!isFinite(x)) return '―';
  if (Math.abs(x) < 0.5 * Math.pow(10, -d)) return (opt.sign ? '±' : '') + (0).toFixed(d) + '%';
  const s = Math.abs(x).toFixed(d) + '%';
  if (x < 0) return (opt.tri ? '△' : MINUS) + s;
  return (opt.sign && x > 0 ? '+' : '') + s;
}
function fmtRate(x) { return x.toFixed(3) + '%'; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- 暦（2026年4月 = m:0。会計年度は4月始まり） ---------- */
const START_YEAR = 2026, START_MONTH = 4;
function ymOf(m) {
  const t = START_MONTH - 1 + m;
  return { y: START_YEAR + Math.floor(t / 12), mo: ((t % 12) + 12) % 12 + 1 };
}
const calMonth = m => ymOf(m).mo;
function ymLabel(m) { const { y, mo } = ymOf(m); return `${y}年${mo}月`; }
function ymShort(m) { const { y, mo } = ymOf(m); return `${String(y).slice(2)}/${mo}`; }
function warekiYear(y) { return y >= 2019 ? `令和${y - 2018 === 1 ? '元' : y - 2018}年` : `平成${y - 1988}年`; }
function warekiLabel(m) { const { y, mo } = ymOf(m); return `${warekiYear(y)}${mo}月`; }
const fyOf = m => Math.floor(m / 12);
function fyLabel(fy) { return `第${fy + 1}期`; }
function fyYearLabel(fy) { return `${START_YEAR + fy}年度`; }
/* 企業の決算期ラベル（例：2026年3月期） */
function fiscalLabelFor(endM) { const { y, mo } = ymOf(endM); return `${y}年${mo}月期`; }
/* 日付印用（令和の年.月.日） */
function stampDate(m) { const { y, mo } = ymOf(m); return `${y - 2018}.${String(mo).padStart(2, '0')}`; }
