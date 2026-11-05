// 会社モードの法令対応を、まじめな会社と、法令を守らない会社のボットで比べる
//   node test/run_law.js [業種,...] [年数] [シード数]（業種は ret などの id か、カタログの業種名）
const { loadKaisha } = require('./load_kaisha');
const inds = (process.argv[2] || 'ret,food,mfg,con,whl,it').split(',');
const years = +(process.argv[3] || 5);
const N = +(process.argv[4] || 6);
for (const ind of inds) for (const pol of ['good', 'bad']) {
  const S = { none: 0, short: 0, long: 0, death: 0, karo: 0, fire: 0, bigFire: 0, insp: 0, finds: 0, soken: 0, fines: 0, bk: 0, integ: 0, cost: 0, otMax: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const E = loadKaisha(); const api = E.__api;
    // 以前の6業種の id（ret など）か、カタログの業種名（「+」で複合）
    const units = E.KS_LEGACY_TYPE[ind] ? null : ind.split('+').map(type => ({ type, sc: 1 }));
    E.ksNewGame({ ind, units, coName: 'T', ceo: 'T', seed, cond: 'normal' });
    let G = api.G;
    const end = G.m + years * 12;
    while (G.m < end && !G.over) {
      for (const u of E.ksActiveUnits()) { G.curU = u.id; E.KS_ENGINE[E.ksS(u).eng].auto(u); G.curU = null; }
      E.ksAutoFinance();
      if (pol === 'good') {
        for (const x of E.ksLawTasks()) if (x.st === 'due' || x.st === 'over') S.cost += E.ksLawDo(x.t.id, { special: true });
        if (E.ksPartRoles().length && E.ksMinWageGap() > 0) E.ksRaisePartWage();
        G.law.policy.yukyu = true; G.law.hinan = false;
      }
      E.ksAdvance(); G = api.G;
      // 労災・検査の対応（ボット）
      for (const pm of G.pendingModals) {
        if (pm.type === 'kRosai') {
          const ch = pol === 'good' ? { first: 'ok', pay: 'rosai', report: 'report', comp: 'pay', prevent: 'equip' } : { first: 'ok', pay: 'kenpo', report: 'hide', comp: 'none', prevent: 'none' };
          E.ksLawResolveAccident(pm.id, ch);
        }
        if (pm.type === 'kInsp' && pol === 'good') { const ins = G.law.insp.find(x => x.id === pm.id); for (const f of ins.finds) if (!f.fixed) E.ksLawFindingFix(f.item); E.ksLawReport(ins.id); }
      }
      G.pendingModals = [];
      if (G.closing) E.ksAutoClose();
      const ck = E.ksCheck(); if (ck.length) { S.integ++; if (S.integ < 3) console.log('INTEG', ind, pol, seed, E.ymLabel(G.m), JSON.stringify(ck)); }
      S.otMax = Math.max(S.otMax, G.law.otNow || 0);
    }
    if (G.over) S.bk++;
    for (const a of G.law.acc) { S[a.sev]++; if (a.kind === 'karo') S.karo++; }
    S.fire += G.law.fires.length; S.bigFire += G.law.fires.filter(f => f.large).length;
    S.insp += G.law.insp.length; S.finds += G.law.insp.reduce((s, x) => s + x.finds.length, 0);
    S.soken += G.law.soken;
    S.fines += Object.values(G.fys).reduce((s, st) => s + ((st.pl.noeItems || []).find(x => x[0] === 'fines') || [0, 0])[1], 0);
  }
  console.log(`${ind} ${pol.padEnd(4)} ${N}社×${years}年 労災 不休${S.none} 短期${S.short} 長期${S.long} 死亡${S.death}（過労${S.karo}） 火災${S.fire}（大${S.bigFire}） 検査${S.insp} 指摘${S.finds} 送検等${S.soken} 罰金${Math.round(S.fines / 1e4)}万 法令費用${Math.round(S.cost / 1e4)}万 破綻${S.bk} 整合性${S.integ} 残業最大${Math.round(S.otMax)}h`);
}
