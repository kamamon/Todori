// 行政モードをボットで遊び、評価と負荷の釣り合いを確かめる
//   node test/run_gyosei.js [labor|fire] [年数] [シード数] [方針,...]
const { loadGyosei } = require('./load_gyosei');
const ag = process.argv[2] || 'labor';
const years = +(process.argv[3] || 5);
const N = +(process.argv[4] || 6);
const pols = (process.argv[5] || 'good,lazy,harsh,noinsp').split(',');
for (const pol of pols) {
  const S = { ranks: {}, tot: 0, acc: 0, death: 0, fires: 0, fdeath: 0, insp: 0, found: 0, fixed: 0, notFixed: 0, soken: 0, ot: 0, backlog: 0, used: 0, cap: 0, viol0: 0, viol1: 0, quiz: 0, quizN: 0, errs: 0, hidden: 0, hiddenFound: 0, cases: 0, claims: 0, compl: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const E = loadGyosei(); const api = E.__api;
    E.gyNewGame({ agency: ag, chief: 'T', seed, diff: 'normal', term: years });
    let G = api.G;
    S.viol0 += E.gyViolTotal() / G.ents.length;
    const end = years * 12;
    while (G.m < end) {
      // 1) 判断待ち
      for (const d of G.dec.slice()) {
        if (d.type === 'claim') { const c = E.gyCase(d.case); E.gyDecideClaim(d.id, pol === 'lazy' ? false : !!c.data.truth); continue; }
        const std = E.gyStd(d).id;
        let mid = std;
        if (pol === 'lazy') mid = d.type === 'follow' ? 'extend' : E.GY_MEAS[ag][0].id;
        if (pol === 'harsh') { const ms = E.GY_MEAS[ag].filter(m => !m.danger || E.LAW_ITEMS[d.item].danger); mid = ms[Math.min(ms.length - 1, E.gyRank(std) + 1)].id; if (std === 'extend') mid = E.gyStd(Object.assign({}, d, { goodFaith: false })).id; }
        const r = E.gyDecide(d.id, mid);
        if (r && r.err) break;
      }
      // 2) 案件
      const order = ['death', 'fire', 'hidden', 'complaint', 'claimX', 'claim', 'tip', 'report'];
      const cs = G.cases.filter(c => c.status === 'new').sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
      for (const c of cs) {
        if (pol === 'lazy' && c.type !== 'death' && c.type !== 'fire' && c.type !== 'claim') continue;
        if (c.type === 'report' && E.gyLeft() < E.gyA().inspCost * 3) continue;
        if (E.gyLeft() >= E.gyCaseCost(c) || ['death', 'fire', 'complaint', 'claim', 'claimX', 'hidden'].includes(c.type)) E.gyAssign(c.id);
      }
      // 3) 啓発（3か月に1回）
      if (pol !== 'lazy' && G.m % 3 === 1) E.gySetCamp(E.GY_CAMPS[ag][G.m % 2 ? 0 : 1].id, G.focus);
      // 4) 監督の計画（リスクの高い順に、残りの人日で）
      if (pol !== 'lazy' && pol !== 'noinsp') {
        const ents = G.ents.filter(e => G.m - e.lastInsp >= 6).sort((a, b) => E.gyRiskScore(b) - E.gyRiskScore(a));
        for (const e of ents) { if (E.gyLeft() < E.gyA().inspCost) break; E.gyPlanToggle(e.id); }
      }
      S.used += G.used; S.cap += E.gyCap();
      E.gyAdvance(); G = api.G;
      G.pendingModals = [];
      S.errs += E.gyCheck().length;
    }
    for (const f of Object.values(G.fys)) {
      if (!f.eval) continue;
      S.ranks[f.eval.rank] = (S.ranks[f.eval.rank] || 0) + 1; S.tot += f.eval.total;
      S.acc += f.acc4; S.death += f.death; S.fires += f.fires; S.fdeath += f.fireDeath; S.insp += f.insp; S.inspPlan = (S.inspPlan || 0) + f.inspPlan; S.found += f.found; S.fixed += f.fixed; S.notFixed += f.notFixed; S.soken += f.soken; S.ot += f.staffOt / 12; S.backlog += f.backlog / 12; S.hidden += f.hidden; S.hiddenFound += f.hiddenFound; S.claims += f.claims; S.compl += f.complaints;
    }
    S.viol1 += E.gyViolTotal() / G.ents.length; S.base = (S.base || 0) + (ag === 'labor' ? G.base.acc4 : G.base.fires);
    S.quiz += G.quiz.correct; S.quizN += G.quiz.asked;
    S.cases += G.cases.length;
  }
  const Y = N * years;
  const p = x => (x / Y).toFixed(1);
  console.log(`${ag} ${pol.padEnd(6)} 評価 ${JSON.stringify(S.ranks)} 平均${(S.tot / Y).toFixed(0)}点 | 年平均 労災${p(S.acc)} 死亡${p(S.death)} 火災${p(S.fires)} 火災死${p(S.fdeath)} 監督${p(S.insp)}(計画${p(S.inspPlan)}) 発見${p(S.found)} 是正${p(S.fixed)} 未是正${p(S.notFixed)} 送検等${p(S.soken)} かくし${p(S.hidden)}/${p(S.hiddenFound)} 請求${p(S.claims)} 申告${p(S.compl)} | 人日 ${(S.used / S.cap * 100).toFixed(0)}% 残業${p(S.ot)}h 未処理${p(S.backlog)} | 違反/所 ${(S.viol0 / N).toFixed(2)}→${(S.viol1 / N).toFixed(2)} | 基準${(S.base / N).toFixed(1)} | 正答 ${S.quiz}/${S.quizN} 整合${S.errs}`);
}
