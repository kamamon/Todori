'use strict';
/* =========================================================
 *  13_ui_ops.js : 汐見市・金利と預金・市場運用・店舗と金庫・システム・人事
 * ========================================================= */

/* ---------- 汐見市 ---------- */
SCREENS.city = () => {
  const c = G.city;
  const did = UI.cityD || 'chuo';
  const D = DIST[did], s = c.d[did];
  const pres = districtPresence();
  const tg = depositTargets();
  const lend = districtBizLending(did);
  const mort = sum(G.loans.filter(L => L.district === did && L.kind === 'mort' && isActiveLoan(L)), L => L.bal);
  const brs = G.branches.filter(b => b.d === did);
  const hist = c.hist.slice(-36);
  const cs = cityStats();
  const indMix = Object.entries(D.mix).sort((a, b) => b[1] - a[1]).map(([k]) => IND[k].name).join('・');
  const imp = s.impulse || 0;
  const detail = `<label class="field" style="margin-bottom:10px"><span>地区を選ぶ</span><select data-ch="cityD">${DISTRICTS.map(x => `<option value="${x.id}"${x.id === did ? ' selected' : ''}>${x.name}</option>`).join('')}</select></label>
    <div class="row between"><h3 style="margin:0;font-size:17px;font-family:var(--f-doc)">${esc(D.name)}</h3>${tag(`活力 ${fmtNum(s.vit, 1)}`, s.vit >= 105 ? 'ok' : s.vit < 95 ? 'bad' : '')}</div>
    <p class="small muted" style="margin:4px 0 10px">${esc(D.desc)}</p>
    ${kv([
      ['人口', `${fmtNum(s.pop)}人（当初比 ${fmtPct((s.pop / D.pop - 1) * 100, 1, { sign: true })}）`], ['事業所数', `${fmtNum(s.firms)}（当初比 ${fmtPct((s.firms / D.firms - 1) * 100, 1, { sign: true })}）`],
      ['主な業種', indMix], ['地価指数', fmtNum(s.land, 1)], ['地区の預金市場', fmtYen(s.depMkt)],
      ['当行のシェア（推計）', fmtPct((tg.byD[did].share) * 100, 2)], ['当行の事業性融資', fmtYen(lend)], ['当行の住宅ローン', fmtYen(mort)],
      ['融資による押し上げ', imp > 0.02 ? tag('街の成長を後押し中', 'ok') : imp < -0.02 ? tag('貸し渋りで停滞', 'bad') : '<span class="muted">影響は小さい</span>'],
    ])}
    <hr class="sep"><div class="small" style="margin-bottom:6px"><b>当行の店舗</b>（存在感 ${fmtNum(pres[did], 2)}）</div>
    ${brs.length ? brs.map(b => `<div class="row between small"><span>${esc(b.name)}</span><span class="muted">${b.openM > G.m ? ymLabel(b.openM) + '開業予定' : b.type === 'hq' ? '本店' : '営業中'}</span></div>`).join('') : '<p class="small muted">店舗なし</p>'}
    <div class="row" style="margin-top:8px">${btn('支店を開設', 'openBranchAsk', { d: did, t: 'full' }, 'sm')}${btn('出張所を開設', 'openBranchAsk', { d: did, t: 'small' }, 'sm')}${btn('ATMを設置', 'atmAdd', { d: did }, 'sm')}</div>
    <p class="note">ATM ${G.atms[did] || 0}台（店舗外）。貸出を伸ばすと事業所が増え、住宅ローンは人口を呼び込みます。</p>`;
  const offer = PROJECTS.find(P => c.projects[P.id]?.status === 'offered');
  let offerHtml = '<div class="empty">現在、資金調達中の案件はありません。景気が良いほど案件は持ち込まれやすくなります。</div>';
  if (offer) {
    const st = c.projects[offer.id];
    const limit = Math.max(0, Math.min(st.maxOurs, largeExposureLimit()));
    const lead = st.debt * 0.4;
    const need = Math.max(0, st.debt * (1 - st.others));
    offerHtml = `<div class="row between"><h3 style="margin:0;font-size:16px;font-family:var(--f-doc)">${esc(offer.name)}</h3>${tag(`${ymLabel(st.deadline)}末締切`, 'warn')}</div>
      <p class="small muted" style="margin:4px 0 8px">${esc(DIST[offer.d].name)}　事業会社：${esc(offer.spc)}</p>
      ${kv([['総事業費', fmtYen(offer.cost)], ['借入（シンジケートローン）', fmtYen(st.debt)], ['適用金利（予定）', `${fmtRate(projectRate(offer))}・期間${Math.round((offer.months + 180) / 12)}年（建設中は利息のみ）`],
        ['事業リスク（格付相当）', gradeBadge(st.grade)], ['他行の参加見込み', `約${fmtPct(st.others * 100, 0)}（当行が主幹事なら＋15%）`],
        ['成立に必要な当行の参加額', `${fmtYen(need)}${need > lead ? '' : `（主幹事なら${fmtYen(Math.max(0, st.debt * (1 - st.others - 0.15)))}で成立）`}`],
        ['完成時の効果', `事業所 +${offer.fx.firms || 0}、人口 +${fmtNum(offer.fx.pop || 0)}、地域活力 +${offer.fx.vit}`]])}
      <hr class="sep"><label class="field"><span>当行の参加表明額（上限 ${fmtYen(limit)}：大口信用供与規制）</span>
      <span class="row"><input type="number" step="1" min="0" max="${Math.floor(limit / 1e8)}" value="${Math.round((st.ourAmt || 0) / 1e8)}" data-ch="projAmt" data-p="${offer.id}" style="width:110px"><span class="unit">億円</span>${st.ourAmt >= lead ? tag('主幹事', 'brass') : ''}</span></label>
      <p class="note">締切月の翌月に、他行の参加額と合わせて必要額に届けば着工します。届かなければ計画は白紙になり、地区の活力が下がります。主幹事は組成手数料（借入額の0.8%）を得られます。</p>`;
  }
  const projRows = PROJECTS.map(P => {
    const st = c.projects[P.id];
    if (!st || st.status === 'offered') return '';
    const prog = st.status === 'building' ? `${meter(G.m - st.startM, st.doneM - st.startM, 'ok')}<span class="small muted">${ymLabel(st.doneM)}完成予定</span>` : '';
    const lab = { building: ['建設中', 'warn'], done: ['完成', 'ok'], cancelled: ['白紙', ''], failed: ['頓挫', 'bad'] }[st.status];
    return `<tr><td>${esc(P.name)}<div class="small muted">${DIST[P.d].name}</div></td><td>${tag(lab[0], lab[1])}</td><td style="min-width:140px">${prog}</td><td class="n">${st.loanId ? fmtYen(G.loans.find(L => L.id === st.loanId)?.bal || 0) : '―'}</td></tr>`;
  }).join('');
  const charts = hist.length >= 2 ? `<div class="grid g2">${panel('人口の推移', lineChart({ labels: hist.map(h => ymShort(h.m)), series: [{ name: '人口', color: 's1', values: hist.map(h => h.pop) }], height: 170, yFmt: v => fmtNum(v / 1e4, 1) + '万', tipFmt: v => fmtNum(v) + '人', endLabels: false }))}${panel('地域活力（人口加重平均）', lineChart({ labels: hist.map(h => ymShort(h.m)), series: [{ name: '地域活力', color: 's3', values: hist.map(h => h.vit) }], height: 170, yFmt: v => fmtNum(v, 0), tipFmt: v => fmtNum(v, 1), endLabels: false }))}</div>` : '';
  return `<h1 class="h1">${CITY_NAME}</h1>
  <p class="lead">人口${fmtNum(cs.pop)}人、事業所${fmtNum(cs.firms)}の地方都市。地域の企業にお金が回ると事業所が増え、人が集まり、預金と融資の需要が育ちます。地区をクリックすると詳細が見られます。</p>
  <div class="grid g-side">
    <div class="stack">${panel('地図', cityMap({ sel: did }))}${charts}</div>
    <div class="stack">${panel('地区の詳細', detail)}</div>
  </div>
  <div class="grid g2" style="margin-top:16px">${panel('資金調達中の開発案件', offerHtml)}${panel('開発プロジェクトの一覧', projRows ? `<table class="t"><thead><tr><th>案件</th><th>状況</th><th>進捗</th><th class="n">当行融資残高</th></tr></thead><tbody>${projRows}</tbody></table>` : '<div class="empty">まだありません</div>', { flush: !!projRows })}</div>`;
};
Object.assign(ACTIONS, {
  cityPick: d => { UI.cityD = d.d; if (UI.tab !== 'city') UI.tab = 'city'; render(); },
  atmAdd: d => { const r = addATM(d.d); toast(r.ok ? 'ATMを設置しました（1,200万円）' : r.msg, r.ok ? '' : 'bad'); render(); },
  atmRemove: d => { const r = removeATM(d.d); toast(r.ok ? 'ATMを撤去しました' : r.msg, r.ok ? '' : 'bad'); render(); },
  openBranchAsk: d => {
    const T = BRANCH_TYPES[d.t];
    const rent = DIST[d.d].rent * T.rentMul;
    confirmBox(`${DIST[d.d].name}に${T.name}を開設`, `設備投資 ${fmtYen(T.capex)}、月額賃料 ${fmtYen(rent)}、人員 ${T.ops + T.sales}人を採用（年間人件費 約${fmtYen((T.ops + T.sales) * BASE_SALARY * G.salaryLv)}）。開業まで${T.months}か月。開業後およそ1年半かけて地域に浸透します。`, '開設する', 'openBranchGo', { d: d.d, t: d.t });
  },
  openBranchGo: d => { const r = openBranch(d.d, d.t); toast(r.ok ? `「${r.b.name}」の開設を決定しました` : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
});
Object.assign(CHANGES, {
  cityD: el => { UI.cityD = el.value; render(); },
  projAmt: el => {
    const st = G.city.projects[el.dataset.p];
    if (!st || st.status !== 'offered') return;
    const limit = Math.max(0, Math.min(st.maxOurs, largeExposureLimit()));
    const v = clamp(Math.round(parseFloat(el.value) || 0), 0, Math.floor(limit / 1e8)) * 1e8;
    st.ourAmt = v;
    toast(v ? `参加表明額を${fmtYen(v)}にしました` : '参加を見送ります');
    render();
  },
});

/* ---------- 金利・預金 ---------- */
SCREENS.rates = () => {
  const e = G.eco, r = G.rates;
  const tg = depositTargets();
  const ord = B('depOrd'), time = B('depTime');
  const mkt = `<table class="t compact"><tbody>
    <tr><td>政策金利（日銀）</td><td class="n">${fmtRate(e.policy)}</td></tr><tr><td>無担保コール翌日物</td><td class="n">${fmtRate(e.call)}</td></tr>
    ${[2, 5, 10, 20].map(k => `<tr><td>国債利回り（${k}年）</td><td class="n">${fmtRate(e.y[k])}</td></tr>`).join('')}
    <tr><td>普通預金（市場平均）</td><td class="n">${fmtRate(e.mktOrd)}</td></tr><tr><td>定期預金1年（市場平均）</td><td class="n">${fmtRate(e.mktTime)}</td></tr>
    <tr><td>短期プライムレート（他行）</td><td class="n">${fmtRate(e.mktPrime)}</td></tr><tr><td>住宅ローン変動（市場）</td><td class="n">${fmtRate(e.mortVar)}</td></tr><tr><td>住宅ローン10年固定（市場）</td><td class="n">${fmtRate(e.mortFix)}</td></tr></tbody></table>`;
  const rateRow = (label, key, linkKey, spreadKey, base, note) => `<div class="panel" style="border-style:dashed"><div class="pb">
    <div class="row between"><b>${label}</b><span class="num" style="font-size:18px;font-weight:700">${fmtRate(r[key])}</span></div>
    <label class="inline small" style="margin:6px 0"><input type="checkbox" data-ch="rateLink" data-k="${linkKey}" ${r[linkKey] ? 'checked' : ''}> ${base}に連動させる</label>
    ${r[linkKey] ? `<label class="field"><span>${base}との差（スプレッド）</span><span class="row"><input type="number" step="0.01" value="${r[spreadKey]}" data-ch="rateNum" data-k="${spreadKey}" style="width:90px"><span class="unit">%</span></span></label>`
      : `<label class="field"><span>金利を直接指定</span><span class="row"><input type="number" step="0.005" min="0.001" value="${r[key]}" data-ch="rateNum" data-k="${key}" style="width:100px"><span class="unit">%</span></span></label>`}
    <p class="note" style="margin:6px 0 0">${note}</p></div></div>`;
  const settings = `<div class="grid g2">
    ${rateRow('普通預金', 'ord', 'ordLink', 'ordSpread', '市場平均', '金利への反応は鈍いが、口座数と決済の基盤になる。')}
    ${rateRow('定期預金（1年）', 'time', 'timeLink', 'timeSpread', '市場平均', '金利に敏感。満期ごとに継続か解約かが決まる。')}
    ${rateRow('短期プライムレート', 'prime', 'primeLink', 'primeMargin', '政策金利', '変動金利の事業性融資と住宅ローンに一斉に反映される。')}
    <div class="panel" style="border-style:dashed"><div class="pb"><b>住宅ローンの店頭金利</b>
      <label class="field" style="margin-top:6px"><span>変動金利：短プラからの優遇幅</span><span class="row"><input type="number" step="0.05" min="0" max="2.5" value="${r.mortDisc}" data-ch="rateNum" data-k="mortDisc" style="width:90px"><span class="unit">%</span>→ <b class="num">${fmtRate(mortVarRate())}</b></span></label>
      <label class="field" style="margin-top:6px"><span>10年固定：10年国債への上乗せ</span><span class="row"><input type="number" step="0.05" min="0" max="3" value="${r.mortFixSpread}" data-ch="rateNum" data-k="mortFixSpread" style="width:90px"><span class="unit">%</span>→ <b class="num">${fmtRate(mortFixRate())}</b></span></label>
      <p class="note" style="margin:6px 0 0">市場より低いほど申込が増える。既存の変動金利の住宅ローンは優遇幅を契約時に固定。</p></div></div></div>`;
  const flowOrd = tg.ord - ord, flowTime = tg.time - time;
  const outlook = `<table class="t compact"><tbody>
    <tr><td>普通預金 残高 / 目標水準</td><td class="n">${fmtYen(ord)} / ${fmtYen(tg.ord)}</td><td>${flowOrd > ord * 0.02 ? tag('流入傾向', 'ok') : flowOrd < -ord * 0.02 ? tag('流出傾向', 'bad') : tag('横ばい')}</td></tr>
    <tr><td>定期預金 残高 / 目標水準</td><td class="n">${fmtYen(time)} / ${fmtYen(tg.time)}</td><td>${flowTime > time * 0.02 ? tag('流入傾向', 'ok') : flowTime < -time * 0.02 ? tag('流出傾向', 'bad') : tag('横ばい')}</td></tr>
    <tr><td>預金の平均調達コスト</td><td class="n">${fmtRate(fundCost())}</td><td></td></tr>
    <tr><td>貸出金の平均利回り</td><td class="n">${fmtRate(sum(G.loans.filter(isActiveLoan), L => L.bal * L.rate) / Math.max(1, B('loans')))}</td><td></td></tr>
    <tr><td>預貸率</td><td class="n">${fmtPct(B('loans') / Math.max(1, deposits()) * 100, 1)}</td><td></td></tr></tbody></table>`;
  const hs = G.hist.slice(-36).filter(h => h.m >= 0);
  const depChart = hs.length >= 2 ? lineChart({ labels: hs.map(h => ymShort(h.m)), height: 190, series: [{ name: '普通預金', color: 's2', values: hs.map(h => h.bs.depOrd) }, { name: '定期預金', color: 's3', values: hs.map(h => h.bs.depTime) }] }) : '<div class="empty">月末を締めると表示されます</div>';
  const rateChart = hs.length >= 2 ? lineChart({ labels: hs.map(h => ymShort(h.m)), height: 190, yFmt: axisPct(2), tipFmt: v => fmtRate(v), series: [{ name: '政策金利', color: 's1', values: hs.map(h => h.kpi.policy) }, { name: '定期預金', color: 's3', values: hs.map(h => h.kpi.time) }, { name: '短プラ', color: 's2', values: hs.map(h => h.kpi.prime) }] }) : '';
  const ladder = G.dep.coh.map((c, i) => ({ i, bal: c.bal, rate: c.rate })).sort((a, b) => ((a.i - G.m % 12 + 12) % 12) - ((b.i - G.m % 12 + 12) % 12));
  const ladderChart = barChart({ labels: ladder.map(c => `${calMonth(G.m + ((c.i - G.m % 12 + 12) % 12))}月`), values: ladder.map(c => c.bal), name: '満期を迎える定期預金', color: 's3', height: 170 });
  const nii = niiSensitivity(), ir = irrbb(), cap = Math.max(1, coreCapital());
  const alm = `<table class="t compact"><tbody>
    <tr><td>金利が1%上がった時の資金利益の変化（1年）</td><td class="n ${nii < 0 ? 'neg' : ''}">${fmtYen(nii, { sign: true })}</td></tr>
    <tr><td>金利リスク量（+1%で失う経済価値）</td><td class="n">${fmtYen(ir)}</td></tr>
    <tr><td>同・コア資本に対する比率（基準20%）</td><td class="n ${ir / cap > 0.2 ? 'neg' : ''}">${fmtPct(ir / cap * 100, 1)}</td></tr>
    <tr><td>保有国債の含み損益</td><td class="n ${unrealizedGain() < 0 ? 'neg' : ''}">${fmtYen(unrealizedGain(), { sign: true })}</td></tr></tbody></table>
    <p class="note">変動金利の貸出が多いほど、金利上昇で資金利益は増えます。長期の固定金利資産（国債・固定ローン）が多いほど、金利上昇で経済価値が減ります。</p>`;
  return `<h1 class="h1">金利・預金（ALM）</h1>
  <p class="lead">預金金利と貸出の基準金利を決めます。市場より高い預金金利は預金を集めますが利鞘を削り、低すぎれば満期の定期預金が流出します。</p>
  <div class="grid g-side"><div class="stack">${panel('当行の金利', settings)}${panel('預金の見通し', outlook, { flush: true })}<div class="grid g2">${panel('預金残高の推移', depChart)}${panel('金利の推移', rateChart || '<div class="empty">―</div>')}</div>${panel('定期預金の満期の構成（今後12か月）', ladderChart)}</div>
  <div class="stack">${panel('市場の金利', mkt, { flush: true })}${panel('金利リスク', alm)}</div></div>`;
};
Object.assign(CHANGES, {
  rateLink: el => { G.rates[el.dataset.k] = el.checked; applyRateLinks(); render(); },
  rateNum: el => {
    const v = parseFloat(el.value);
    if (!isFinite(v)) return;
    const k = el.dataset.k;
    const lim = { ord: [0.001, 5], time: [0.002, 6], prime: [0.1, 8], ordSpread: [-1, 2], timeSpread: [-1, 3], primeMargin: [0, 5], mortDisc: [0, 2.5], mortFixSpread: [0, 3] }[k] || [-5, 10];
    G.rates[k] = Math.round(clamp(v, lim[0], lim[1]) * 1000) / 1000;
    applyRateLinks();
    for (const L of G.loans) if (isActiveLoan(L)) L.rate = currentRate(L);
    render();
  },
});

/* ---------- 市場運用 ---------- */
SCREENS.market = () => {
  const req = requiredReserve();
  const boj = B('boj');
  const pos = `<table class="t compact"><tbody>
    <tr><td>現金（金庫）</td><td class="n">${fmtYen(B('cash'))}</td></tr>
    <tr><td>日銀当座預金</td><td class="n">${fmtYen(boj)}</td></tr>
    <tr><td>　所要準備額</td><td class="n">${fmtYen(req)}</td></tr>
    <tr><td>　超過準備（政策金利${fmtRate(G.eco.policy)}で付利）</td><td class="n">${fmtYen(Math.max(0, boj - req))}</td></tr>
    <tr><td>コールローン（運用）</td><td class="n">${fmtYen(B('callLoan'))}</td></tr>
    <tr><td>コールマネー（調達）</td><td class="n ${B('callMoney') > 0 ? 'neg' : ''}">${fmtYen(B('callMoney'))}</td></tr>
    <tr><td>日銀借入</td><td class="n ${B('bojBorrow') > 0 ? 'neg' : ''}">${fmtYen(B('bojBorrow'))}</td></tr>
    <tr class="total"><td>流動性比率（現預金・コール・国債÷預金）</td><td class="n">${fmtPct(liquidityRatio(), 1)}</td></tr>
    <tr><td>流動性カバレッジ比率（簡易）</td><td class="n">${fmtPct(lcr(), 0)}</td></tr></tbody></table>
    <p class="note">月末に日銀当座が所要準備額を下回ると、コールローンの回収→コール市場での調達→国債の売却→日銀借入の順で自動的に資金を手当てします。</p>`;
  const call = `<label class="field"><span>コールローンの残高を指定（翌日物で運用、金利 ${fmtRate(G.eco.call)}）</span><span class="row"><input type="number" step="1" min="0" value="${Math.round(B('callLoan') / 1e8)}" data-ch="callSet" style="width:110px"><span class="unit">億円</span></span></label>
    <label class="inline small" style="margin-top:8px"><input type="checkbox" data-ch="autoCall" ${G.treasury.autoCall ? 'checked' : ''}> 月末に余った資金を自動でコール運用する</label>`;
  const buy = `<div class="row" style="gap:12px;align-items:end">
      <label class="field"><span>年限</span><select id="bondTenor">${[2, 5, 10, 20].map(k => `<option value="${k}">${k}年（利回り ${fmtRate(G.eco.y[k])}）</option>`).join('')}</select></label>
      <label class="field"><span>額面</span><span class="row"><input type="number" id="bondAmt" step="1" min="1" value="${Math.max(10, roundTo(Math.max(0, B('boj') - req) * 0.1 / 1e8, 10))}" style="width:110px"><span class="unit">億円</span></span></label>
      ${btn('購入する', 'bondBuy', {}, 'primary')}</div>
    <p class="note">利付国債を額面（利回り＝表面利率）で購入します。金利が上がると時価が下がり含み損になります。満期まで持てば額面で償還されます。</p>`;
  const rows = G.bonds.slice().sort((a, b) => a.matM - b.matM).map(bd => {
    const mk = bondMarket(bd);
    const ug = mk.value - bd.book;
    return `<tr><td>${esc(bd.name)}</td><td class="n">${fmtYen(bd.face)}</td><td class="n">${fmtRate(bd.coupon)}</td><td class="n">${fmtNum(mk.n, 1)}年</td><td class="n">${fmtNum(mk.px, 2)}</td><td class="n">${fmtYen(mk.value)}</td><td class="n ${ug < 0 ? 'neg' : 'pos'}">${fmtYen(ug, { sign: true })}</td><td class="n">${btn('売却', 'bondSellAsk', { id: bd.id }, 'sm')}</td></tr>`;
  }).join('');
  const ug = unrealizedGain();
  const holdings = `<div class="tbl-wrap"><table class="t"><thead><tr><th>銘柄</th><th class="n">額面（簿価）</th><th class="n">表面利率</th><th class="n">残存</th><th class="n">時価単価</th><th class="n">時価</th><th class="n">含み損益</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="empty">保有なし</td></tr>'}</tbody>
    <tfoot><tr class="total"><td>合計</td><td class="n">${fmtYen(B('securities'))}</td><td></td><td></td><td></td><td class="n">${fmtYen(securitiesMarketValue())}</td><td class="n ${ug < 0 ? 'neg' : ''}">${fmtYen(ug, { sign: true })}</td><td></td></tr></tfoot></table></div>`;
  const h12 = G.hist[G.hist.length - 13];
  const tenors = [0.08, 2, 5, 10, 20];
  const curve = lineChart({ labels: ['翌日', '2年', '5年', '10年', '20年'], height: 190, yFmt: axisPct(2), tipFmt: v => fmtRate(v),
    series: [{ name: '現在', color: 's1', values: tenors.map(t => yieldAt(t)) }].concat(h12 ? [{ name: '1年前', color: 's2', dash: true, values: [h12.kpi.policy, null, null, h12.kpi.y10, null] }] : []), endLabels: false });
  return `<h1 class="h1">市場運用</h1>
  <p class="lead">貸出に回らない資金を、日銀当座・コール市場・国債で運用します。長い国債ほど利回りは高いものの、金利上昇時の値下がりが大きくなります。</p>
  <div class="grid g-side"><div class="stack">${panel('保有国債', holdings, { flush: true })}${panel('国債の購入', buy)}${panel('イールドカーブ', curve)}</div>
  <div class="stack">${panel('資金ポジション', pos)}${panel('コール市場', call)}</div></div>`;
};
Object.assign(ACTIONS, {
  bondBuy: () => {
    const tenor = +$('#bondTenor').value, amt = Math.round(parseFloat($('#bondAmt').value) || 0) * 1e8;
    const r = buyBond(tenor, amt);
    toast(r.ok ? `${r.bd.name}を${fmtYen(amt)}購入しました` : r.msg, r.ok ? '' : 'bad');
    render();
  },
  bondSellAsk: d => {
    const bd = G.bonds.find(b => b.id === d.id);
    const mk = bondMarket(bd);
    confirmBox('国債の売却', `${esc(bd.name)}（額面${fmtYen(bd.face)}）を時価${fmtYen(mk.value)}で売却します。売却${mk.value >= bd.book ? '益' : '損'}は${fmtYen(Math.abs(mk.value - bd.book))}です。`, '売却する', 'bondSellGo', { id: d.id });
  },
  bondSellGo: d => { const r = sellBond(d.id); toast(r.ok ? `売却しました（${r.gain >= 0 ? '売却益' : '売却損'} ${fmtYen(Math.abs(r.gain))}）` : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
});
Object.assign(CHANGES, {
  callSet: el => { const r = setCallLoan(Math.round(parseFloat(el.value) || 0) * 1e8); if (!r.ok) toast(r.msg, 'bad'); render(); },
  autoCall: el => { G.treasury.autoCall = el.checked; render(); },
});

/* ---------- 店舗・金庫 ---------- */
SCREENS.facility = () => {
  const v = G.vault;
  const VL = VAULT_LEVELS[v.lv], nx = VAULT_LEVELS[v.lv + 1];
  const cap = vaultCapacity(), req = cashRequired();
  const sec = SECURITY_LEVELS[v.sec], snx = SECURITY_LEVELS[v.sec + 1];
  const peak = req * 1.3 * v.buffer;
  const vault = `${scene('vault', { cls: 'panel-art', alt: '本店の金庫' })}<div class="row between"><div><div class="small muted">本店金庫</div><div style="font-size:18px;font-weight:700;font-family:var(--f-doc)">${VL.name}</div></div>${v.upgrade ? tag(`${ymLabel(v.upgrade.doneM)}に拡張完了`, 'warn') : ''}</div>
    <table class="t compact" style="margin-top:8px"><tbody>
      <tr><td>収容能力（本店＋各店）</td><td class="n">${fmtYen(cap)}</td></tr>
      <tr><td>現金在高</td><td class="n">${fmtYen(B('cash'))}</td></tr>
      <tr><td>平常月の必要現金</td><td class="n">${fmtYen(req)}</td></tr>
      <tr><td>年末の需要期に必要な現金</td><td class="n ${peak > cap ? 'neg' : ''}">${fmtYen(peak)}</td></tr></tbody></table>
    <div class="small" style="margin:8px 0 4px">収容能力の使用率</div>${meter(peak, cap)}
    <label class="field" style="margin-top:12px"><span>現金の手元保有方針（必要額の ${fmtNum(v.buffer * 100, 0)}%）</span><input type="range" min="100" max="200" step="5" value="${Math.round(v.buffer * 100)}" data-ch="vaultBuffer"></label>
    <p class="note">余裕を持たせるほどATMの現金切れは起きにくくなりますが、金庫の容量を使い、盗難時の被害も大きくなります。</p>
    ${nx ? `<hr class="sep"><div class="row between"><div><b>${nx.name}</b>へ拡張<div class="small muted">収容能力 ${fmtYen(nx.cap)}・工事${nx.months}か月・維持費 月${fmtYen(nx.maint)}</div></div>${btn(`拡張する（${fmtYen(nx.cost)}）`, 'vaultUp', {}, 'primary', { disabled: !!v.upgrade })}</div>` : '<p class="note">最大の金庫です。</p>'}`;
  const security = `<div class="row between"><div><div class="small muted">警備体制</div><b>${sec.name}</b></div><span class="small">盗難リスク ${fmtPct(sec.risk * 100, 0)}</span></div>
    ${snx ? `<div class="row between" style="margin-top:10px"><div class="small">次：${snx.name}（維持費 月${fmtYen(snx.maint)}）</div>${btn(`強化する（${fmtYen(snx.cost)}）`, 'secUp', {}, 'sm')}</div>` : ''}`;
  const brRows = G.branches.map(b => {
    const T = BRANCH_TYPES[b.type];
    return `<tr><td>${esc(b.name)}</td><td>${DIST[b.d].name}</td><td>${T.name}</td><td>${b.openM > G.m ? tag(ymLabel(b.openM) + '開業', 'warn') : b.type === 'hq' ? '―' : ymLabel(b.openM)}</td>
      <td style="min-width:110px">${b.type === 'hq' ? '' : meter(branchMaturity(b), 1, 'ok')}</td><td class="n">${b.type === 'hq' ? '自己所有' : fmtYen(DIST[b.d].rent * T.rentMul)}</td><td class="n">${b.type === 'hq' ? '' : btn('閉鎖', 'closeBranchAsk', { id: b.id }, 'sm danger')}</td></tr>`;
  }).join('');
  const openForm = `<div class="row" style="gap:12px;align-items:end">
    <label class="field"><span>地区</span><select id="obD">${DISTRICTS.map(D => `<option value="${D.id}">${D.name}（店舗${G.branches.filter(b => b.d === D.id).length}）</option>`).join('')}</select></label>
    <label class="field"><span>種類</span><select id="obT"><option value="full">支店（${fmtYen(BRANCH_TYPES.full.capex)}・${BRANCH_TYPES.full.ops + BRANCH_TYPES.full.sales}人）</option><option value="small">出張所（${fmtYen(BRANCH_TYPES.small.capex)}・${BRANCH_TYPES.small.ops + BRANCH_TYPES.small.sales}人）</option></select></label>
    ${btn('開設を検討する', 'openBranchForm', {}, 'primary')}</div>
    <p class="note">店舗は地区の預金と融資案件を呼び込みます。競合の多い中央区より、競合の少ない地区のほうがシェアを取りやすい傾向があります。${G.flags.order > G.m ? '<b class="neg">業務改善命令の期間中は出店できません。</b>' : ''}</p>`;
  const atmRows = DISTRICTS.map(D => `<tr><td>${D.name}</td><td class="n">${G.atms[D.id] || 0}台</td><td class="n">${btn('＋', 'atmAdd', { d: D.id }, 'sm')} ${btn('−', 'atmRemove', { d: D.id }, 'sm', { disabled: !G.atms[D.id] })}</td></tr>`).join('');
  return `<h1 class="h1">店舗・金庫</h1>
  <p class="lead">預金が増えるほど手元に置く現金も増えます。金庫の容量が足りないと、年末やボーナス時期にATMが現金切れを起こし信用を失います。</p>
  <div class="grid g2">${panel('金庫', vault)}<div class="stack">${panel('警備', security)}${panel('店舗外ATM', `<table class="t compact"><tbody>${atmRows}</tbody></table><p class="note" style="padding:0 10px">ATM全${totalATMs()}台（店舗内を含む）。1台1,200万円、維持費 月5万円。</p>`, { flush: true })}</div></div>
  <div class="stack" style="margin-top:16px">${panel('店舗網', `<div class="tbl-wrap"><table class="t"><thead><tr><th>店舗</th><th>地区</th><th>種類</th><th>開業</th><th>地域への浸透</th><th class="n">月額賃料</th><th></th></tr></thead><tbody>${brRows}</tbody></table></div>`, { flush: true })}${panel('新しい店舗', openForm)}</div>`;
};
Object.assign(ACTIONS, {
  vaultUp: () => { const nx = VAULT_LEVELS[G.vault.lv + 1]; confirmBox('金庫の拡張', `${nx.name}へ拡張します。費用${fmtYen(nx.cost)}（20年で償却）、工事${nx.months}か月。`, '拡張する', 'vaultUpGo'); },
  vaultUpGo: () => { const r = startVaultUpgrade(); toast(r.ok ? '金庫の拡張工事を発注しました' : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
  secUp: () => { const r = upgradeSecurity(); toast(r.ok ? '警備体制を強化しました' : r.msg, r.ok ? '' : 'bad'); render(); },
  openBranchForm: () => ACTIONS.openBranchAsk({ d: $('#obD').value, t: $('#obT').value }),
  closeBranchAsk: d => { const b = G.branches.find(x => x.id === d.id); confirmBox(`${esc(b.name)}を閉鎖`, '店舗設備は除却損として処理し、事務人員を削減します（割増退職金が発生）。地区での存在感が下がり、預金が他行へ流れます。', '閉鎖する', 'closeBranchGo', { id: d.id }, true); },
  closeBranchGo: d => { const r = closeBranch(d.id); toast(r.ok ? '店舗を閉鎖しました' : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
});
Object.assign(CHANGES, { vaultBuffer: el => { G.vault.buffer = clamp(+el.value / 100, 1, 2); render(); } });

/* ---------- システム ---------- */
SCREENS.system = () => {
  const load = coreLoad();
  const cards = SYS_KEYS.map(k => {
    const S = SYSTEMS[k], lv = G.sys[k];
    const cur = S.levels[lv], nx = S.levels[lv + 1];
    const proj = G.itProjects.find(p => p.sys === k);
    let foot;
    if (proj) foot = `<div class="small">「${S.levels[proj.to].name}」へ移行中</div>${meter(G.m - proj.startM, proj.doneM - proj.startM, 'ok')}<div class="note">${ymLabel(proj.doneM)}稼働予定${proj.method === 'phased' ? '（段階移行）' : proj.method === 'bigbang' ? '（一括移行）' : ''}</div>`;
    else if (nx) {
      foot = `<div class="small">次の段階：<b>${nx.name}</b></div><div class="note">投資 ${fmtYen(nx.cost)}（5年償却）・${nx.months}か月・運用費 月${fmtYen(nx.maint)}</div>`;
      foot += k === 'core' ? `<div class="row" style="margin-top:6px">${btn('一括移行で更改', 'sysUp', { k, m: 'bigbang' }, 'sm')}${btn('段階移行で更改', 'sysUp', { k, m: 'phased' }, 'sm primary')}</div><p class="note">一括移行は安いが約18%の確率で大規模障害。段階移行は費用1.35倍・期間1.5倍で障害リスク約4%。</p>`
        : `<div style="margin-top:6px">${btn('導入する', 'sysUp', { k }, 'sm primary')}</div>`;
    } else foot = '<div class="note">最新の段階です。</div>';
    const extra = k === 'core' ? `<div class="small" style="margin:6px 0 2px">処理能力の使用率 ${fmtPct(load * 100, 0)}（口座等 ${fmtNum(accountsCount())}／能力 ${fmtNum(coreCapacity())}）</div>${meter(load, 1)}`
      : k === 'aml' ? `<div class="small" style="margin-top:6px">金融庁が求める水準：Lv${amlRequired()}　${lv >= amlRequired() ? tag('充足', 'ok') : tag('不足', 'bad')}</div>`
      : k === 'cyber' ? `<div class="small" style="margin-top:6px">${G.sys.digital >= 2 && lv < G.sys.digital - 1 ? tag('デジタル化に対して手薄', 'bad') : tag('概ね適切', 'ok')}</div>` : '';
    return `<section class="panel"><div class="ph"><h2>${S.name}</h2><span class="aside">Lv${lv}</span></div><div class="pb"><div style="font-weight:700">${cur.name}</div><p class="small muted" style="margin:4px 0">${S.desc}</p>${extra}<hr class="sep">${foot}</div></section>`;
  }).join('');
  const maint = sum(SYS_KEYS, k => SYSTEMS[k].levels[G.sys[k]].maint || 0);
  return `<h1 class="h1">システム</h1>
  <p class="lead">銀行の業容はシステムの処理能力に縛られます。審査システムは粉飾の発見を助け、デジタル化は預金を集めますが、セキュリティとマネロン対策が追いつかないと事故と行政処分を招きます。システムの運用費は月${fmtYen(maint)}。</p>
  <div class="grid g3">${cards}</div>`;
};
Object.assign(ACTIONS, {
  sysUp: d => {
    const S = SYSTEMS[d.k], nx = S.levels[G.sys[d.k] + 1];
    const cost = nx.cost * (d.m === 'phased' ? 1.35 : 1);
    confirmBox(`${S.name}の更改`, `「${nx.name}」を導入します。投資額${fmtYen(cost)}はソフトウェアとして5年で償却し、自己資本からも控除されます。`, '発注する', 'sysUpGo', { k: d.k, m: d.m || 'std' });
  },
  sysUpGo: d => { const r = startSystemUpgrade(d.k, d.m); toast(r.ok ? 'プロジェクトを開始しました' : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
});

/* ---------- 人事・営業 ---------- */
SCREENS.hr = () => {
  const s = G.staff;
  const ind = {
    sales: `融資の申込 月${fmtNum(1.5 + 0.3 * s.sales, 1)}件程度＋投信・保険の販売`,
    credit: `調査の余力 ${fmtNum(creditCapLeft(), 1)} / ${fmtNum(creditCapacity(), 0)}人日`,
    ops: `必要人員 ${fmtNum(opsRequired(), 1)}人（充足率 ${fmtPct(serviceQuality() * 100, 0)}）`,
    comp: `必要人員 ${fmtNum(compRequired(), 1)}人（充足率 ${fmtPct(compRatio() * 100, 0)}）・臨時監査 月${auditSlots()}件`,
  };
  const rows = Object.entries(STAFF_ROLES).map(([k, r]) => `<tr><td><b>${r.name}</b><div class="small muted">${r.desc}</div></td><td class="n" style="font-size:16px;font-weight:700">${s[k]}人</td><td class="small">${ind[k]}</td>
    <td class="n nowrap">${btn('＋1', 'hire', { k, n: 1 }, 'sm')} ${btn('＋5', 'hire', { k, n: 5 }, 'sm')}${stageOf() >= 1 ? ' ' + btn('＋20', 'hire', { k, n: 20 }, 'sm') : ''} ${btn('−1', 'hire', { k, n: -1 }, 'sm danger')}</td></tr>`).join('');
  const c = monthlyCosts();
  const pay = staffTotal() * BASE_SALARY * G.salaryLv;
  return `<h1 class="h1">人事・営業</h1>
  <p class="lead">行員は銀行の能力そのものです。採用は1人60万円、早期退職には割増退職金がかかります。給与水準を下げると人件費は減りますが、離職と不正のリスクが上がります。</p>
  <div class="stack">${panel(`本部と${CITY_NAME}の人員（合計 ${staffTotal()}人）`, `<div class="tbl-wrap"><table class="t"><thead><tr><th>部門</th><th class="n">人数</th><th>状況</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${netStaff() ? `<p class="note" style="padding:0 12px 10px">このほか全国・海外の店舗網に${fmtNum(netStaff())}人（人件費は店舗網の経費に含む）。管理・監査部門の必要人員には、店舗網の規模も含まれます。</p>` : ''}`, { flush: true })}
  <div class="grid g2">${panel('給与水準', `<label class="field"><span>市場水準に対して ${fmtNum(G.salaryLv * 100, 0)}%</span><input type="range" min="85" max="130" step="5" value="${Math.round(G.salaryLv * 100)}" data-ch="salary"${G.flags.publicFunds ? ' disabled' : ''}></label>
    ${kv([['年間人件費（見込み）', fmtYen(pay)], ['1人あたり', fmtYen(BASE_SALARY * G.salaryLv)], ['今月の人件費', fmtYen(c.pay)]])}${G.flags.publicFunds ? '<p class="callout bad small" style="margin-top:8px">公的資金の注入中は給与水準を90%以下に抑える必要があります。</p>' : ''}`)}
  ${panel('広告宣伝', `<label class="field"><span>月額 ${fmtYen(G.adBudget)}</span><input type="range" min="0" max="5000" step="50" value="${Math.round(G.adBudget / 1e4)}" data-ch="adBudget"></label><p class="note">知名度が上がり預金が集まりやすくなります（効果は逓減）。</p>`)}</div></div>`;
};
Object.assign(ACTIONS, { hire: d => { const r = hireStaff(d.k, +d.n); if (!r.ok) toast(r.msg, 'bad'); render(); } });
Object.assign(CHANGES, {
  salary: el => { G.salaryLv = clamp(+el.value / 100, 0.85, G.flags.publicFunds ? 0.9 : 1.3); render(); },
  adBudget: el => { G.adBudget = Math.round(+el.value) * 1e4; render(); },
});
