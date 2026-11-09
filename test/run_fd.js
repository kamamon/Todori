// 創業記モードのエンジンのテスト：番頭（自動の運営）に任せて1910年から2025年まで進め、
// 帳簿の整合性・数字の健全さ・会社の育ち方（史実の日立・トヨタと比べて）を確かめる
//   node test/run_fd.js [scen] [seed] [endY] [pick]
const { loadFd } = require('./load_fd');
const E = loadFd();
const api = E.__api;
const errs = [];
const ok = (c, m) => { if (!c) errs.push(m); };
const args = process.argv.slice(2);
const scens = args[0] && args[0] !== 'all' ? [args[0]] : ['denki', 'jidosha'];
const seed = +(args[1] || 11);
const endY = +(args[2] || 2025);
const pickMode = args[3] || 'first';
const fmt = x => (x >= 1e12 ? (x / 1e12).toFixed(2) + '兆' : x >= 1e8 ? (x / 1e8).toFixed(0) + '億' : (x / 1e4).toFixed(0) + '万');
function resolve(m, G) {
  if (m.type === 'fdEvent') {
    const Ev = E.fdEventById(m.id);
    if (Ev && Ev.ch) {
      let i = 0;
      if (pickMode === 'random') i = Math.floor(Math.random() * Ev.ch.length);
      else if (pickMode === 'last') i = Ev.ch.length - 1;
      if (Ev.ch[i].can && !Ev.ch[i].can()) i = Ev.ch.findIndex(c => !c.can || c.can());
      if (i >= 0) E.fdChoose(m.id, i);
    }
  } else if (m.type === 'fdSucc') E.fdPickSucc(0);
  else if (m.type === 'fdRescue') E.fdRescueAccept();
}
for (const scen of scens) {
  const t0 = Date.now();
  E.fdNewGame({ scen, seed, diff: 'normal' });
  let G = api.G;
  const S = E.FD_SCEN[scen];
  console.log(`\n=== ${S.title}（seed ${seed}） ===`);
  let lastY = 0;
  let checks = 0;
  while (!G.over && E.fdY() <= endY) {
    E.fdAuto({ lvl: 1 });
    E.fdAdvanceQ();
    G = api.G;
    const ms = G.pendingModals.slice(); G.pendingModals = [];
    for (const m of ms) resolve(m, G);
    // 解決で新しく出たもの（後継者など）
    const ms2 = G.pendingModals.slice(); G.pendingModals = [];
    for (const m of ms2) resolve(m, G);
    const c = E.fdCheck();
    if (c.length && checks++ < 5) errs.push(`${scen} ${E.fdQLabel()}：${c.join(' / ')}`);
    const h = G.hy[G.hy.length - 1];
    if (h && h.y !== lastY) {
      lastY = h.y;
      for (const k of ['sales', 'opi', 'net', 'cash', 'debt', 'equity']) ok(isFinite(h[k]), `${scen} ${h.y} ${k} が数でない`);
      if (h.y % 5 === 0 || h.y === S.start.y0 || h.y >= 2024) {
        const real = h.sales / h.cpi;
        const bench = E.fdSer(S.bench.pts, h.y + 0.5, true);
        const cats = Object.entries(h.share || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${E.fdCat(k).n.slice(0, 6)}${(v * 100).toFixed(1)}%`).join(' ');
        const rank = E.fdWorldRank(h.y);
        const gaps = Object.entries(h.tech).filter(([f, t]) => t !== null && E.fdField(f).born <= h.y).map(([f, t]) => `${f}${Math.round(h.y + 0.5 - t)}`).join(' ');
        const ovs = (1 - (h.reg.jp || 0) / Math.max(1, Object.values(h.reg).reduce((a, b) => a + b, 0))) * 100;
        console.log(`${h.y} 売上 今${fmt(real).padStart(7)}（史実${fmt(bench).padStart(7)}） 営業利益率 ${(h.opi / Math.max(1, h.sales) * 100).toFixed(1).padStart(5)}% 社員 ${String(Math.round(h.head)).padStart(7)} 技術者 ${String(h.staff.eng).padStart(6)} 借入/売上 ${(h.debt / Math.max(1, h.sales)).toFixed(2)} 海外 ${ovs.toFixed(0)}% 順位 ${rank > 5000 ? '-' : rank} ｜ ${cats} ｜ 遅れ ${gaps}`);
      }
    }
  }
  const sc = E.fdScore();
  console.log(`終わり：${G.over ? G.over.type : '続行'} ${E.fdQLabel()} 評価 ${sc.rank}（${sc.total}点）${sc.title} ・ ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
  console.log(sc.parts.map(p => `${p[0]} ${p[1]}（${p[2]}）`).join(' / '));
  console.log('大きな節目：' + G.chron.filter(c => c.big).slice(-25).map(c => `${E.fdY(c.q)} ${c.t}`).join('｜'));
}
if (errs.length) { console.log('\nNG:\n' + errs.join('\n')); process.exit(1); }
console.log('\nOK');
