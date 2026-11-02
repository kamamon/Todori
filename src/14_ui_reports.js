'use strict';
/* =========================================================
 *  14_ui_reports.js : 決算・財務、監査・検査、経済・ニュース、
 *                     各種モーダル、開始画面（辞令）
 * ========================================================= */

/* ---------- 銀行の財務諸表 ---------- */
function bankBSRows(s) {
  const g = k => s[k] || 0;
  const cp = s.curProfit || 0;
  const assets = g('cash') + g('boj') + g('callLoan') + g('securities') + g('loans') + g('tangible') + g('intangible') + g('goodwill') + g('otherAssets') - g('allowance');
  const liab = g('depOrd') + g('depTime') + g('depFx') + g('callMoney') + g('bojBorrow') + g('taxPayable') + g('divPayable') + g('otherLiab');
  const eq = g('capital') + g('prefCapital') + g('capSurplus') + g('retained') + cp;
  return [
    ['資産の部', null, 'head'], ['現金預け金', g('cash') + g('boj'), 'i1'], ['うち現金', g('cash'), 'i2'], ['うち日銀預け金', g('boj'), 'i2'],
    ['コールローン', g('callLoan'), 'i1'], ['有価証券（国債）', g('securities'), 'i1'], ['貸出金', g('loans'), 'i1'], ['有形固定資産', g('tangible'), 'i1'],
    ['無形固定資産', g('intangible'), 'i1'], ['のれん', g('goodwill'), 'i1'], ['その他資産', g('otherAssets'), 'i1'], ['貸倒引当金', -g('allowance'), 'i1'], ['資産の部合計', assets, 'grand'],
    ['負債の部', null, 'head'], ['預金', g('depOrd') + g('depTime') + g('depFx'), 'i1'], ['うち普通預金', g('depOrd'), 'i2'], ['うち定期預金', g('depTime'), 'i2'], ['うち海外店預金', g('depFx'), 'i2'],
    ['コールマネー', g('callMoney'), 'i1'], ['借用金', g('bojBorrow'), 'i1'], ['未払法人税等', g('taxPayable'), 'i1'], ['未払配当金', g('divPayable'), 'i1'],
    ['その他負債', g('otherLiab'), 'i1'], ['負債の部合計', liab, 'sum'],
    ['純資産の部', null, 'head'], ['資本金', g('capital') + g('prefCapital'), 'i1'], ['うち優先株式（公的資金）', g('prefCapital'), 'i2'], ['資本剰余金', g('capSurplus'), 'i1'],
    ['利益剰余金', g('retained') + cp, 'i1'], ['うち当期純利益（未処分）', cp, 'i2'], ['純資産の部合計', eq, 'sum'], ['負債及び純資産の部合計', liab + eq, 'grand'],
  ];
}
function bankPLRows(pl) {
  const g = k => pl[k] || 0;
  const s = plSummary(pl);
  return [
    ['経常収益', s.ordRev, 'sum'], ['資金運用収益', g('intLoans') + g('intSec') + g('intCall') + g('intBoj'), 'i1'], ['貸出金利息', g('intLoans'), 'i2'], ['有価証券利息配当金', g('intSec'), 'i2'],
    ['コールローン利息', g('intCall'), 'i2'], ['預け金利息', g('intBoj'), 'i2'], ['役務取引等収益', g('fees'), 'i1'], ['その他業務収益', g('bondGain') + g('fxGain'), 'i1'], ['国債等債券売却益', g('bondGain'), 'i2'], ['外国為替売買益', g('fxGain'), 'i2'],
    ['その他経常収益', g('recoveries') + g('provRev') + g('otherInc'), 'i1'], ['償却債権取立益・貸倒引当金戻入益', g('recoveries') + g('provRev'), 'i2'],
    ['経常費用', s.ordExp, 'sum'], ['資金調達費用', g('intDep') + g('intCallM') + g('intBorrow') + g('fundingCost'), 'i1'], ['預金利息', g('intDep'), 'i2'], ['コールマネー利息・借用金利息', g('intCallM') + g('intBorrow'), 'i2'], ['外貨調達費用（為替スワップ）', g('fundingCost'), 'i2'],
    ['役務取引等費用', g('feeExp'), 'i1'], ['その他業務費用', g('bondLoss') + g('fxLoss'), 'i1'], ['国債等債券売却損', g('bondLoss'), 'i2'], ['外国為替売買損', g('fxLoss'), 'i2'], ['営業経費', s.opex, 'i1'], ['人件費', g('personnel'), 'i2'], ['物件費', g('premises'), 'i2'],
    ['税金', g('taxes'), 'i2'], ['減価償却費', g('depreciation'), 'i2'], ['預金保険料', g('depInsurance'), 'i2'],
    ['その他経常費用', g('provExp') + g('writeoff') + g('otherExp'), 'i1'], ['貸倒引当金繰入額', g('provExp'), 'i2'], ['貸出金償却', g('writeoff'), 'i2'], ['その他', g('otherExp'), 'i2'],
    ['経常利益', s.ordinary, 'sum'], ['特別利益', g('extraGain'), 'i1'], ['特別損失', g('extraLoss'), 'i1'], ['税引前当期純利益', s.pretax, 'sum'], ['法人税、住民税及び事業税', s.tax, 'i1'], ['当期純利益', s.net, 'grand'],
  ];
}
function fsTable(cols, rowsList) {
  const head = `<thead><tr><th>（単位：百万円）</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
  const body = rowsList[0].map((r, i) => {
    if (r[1] === null) return `<tr class="head"><td colspan="${cols.length + 1}">${r[0]}</td></tr>`;
    return `<tr class="${r[2] || ''}"><td>${r[0]}</td>${rowsList.map(rows => { const v = rows[i][1]; return `<td class="${v < 0 ? 'neg' : ''}">${fmtM(v)}</td>`; }).join('')}</tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="fs">${head}<tbody>${body}</tbody></table></div>`;
}
function curFYPL() { const fy = fyOf(G.m); return Object.assign({}, sumPL(fy * 12, G.m - 1), addFlows({}, G.ledger.mflow)); }
function addFlows(a, b) { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; }

SCREENS.finance = () => {
  const tabs = [['bs', '貸借対照表'], ['pl', '損益計算書'], ['monthly', '月次収支'], ['capital', '自己資本比率'], ['npl', '開示債権'], ['history', '決算の推移'], ['journal', '仕訳帳・試算表']];
  const last = G.annual[G.annual.length - 1];
  const fy = fyOf(G.m);
  let body = '';
  switch (UI.finTab) {
    case 'bs': {
      const cur = bsSnapshot();
      const prev = last ? last.bs : G.hist[0].bs;
      const diff = Math.round(ledgerDiff());
      body = `${fsTable([`当月（${ymLabel(G.m)}）`, last ? `前期末（${fyLabel(last.fy)}）` : '開業時'], [bankBSRows(cur), bankBSRows(prev)])}
        <p class="small" style="margin-top:8px">${Math.abs(diff) <= 1 ? tag('貸借一致', 'ok') : tag(`貸借不一致 ${diff}円`, 'bad')}　すべての取引は複式簿記の仕訳で記帳しています。</p>
        <p class="note">参考：保有国債の時価 ${fmtYen(securitiesMarketValue())}（含み損益 ${fmtYen(unrealizedGain(), { sign: true })}）。国債は償却原価（取得価額）で計上しています。</p>`;
      break;
    }
    case 'pl': {
      const curPL = curFYPL();
      const s = plSummary(curPL);
      const cols = [`当期累計（${fyLabel(fy)}・${G.m - fy * 12 + 1}か月）`];
      const lists = [bankPLRows(curPL)];
      if (last) { cols.push(`前期（${fyLabel(last.fy)}）`); lists.push(bankPLRows(last.plRaw)); }
      body = `${fsTable(cols, lists)}
        <h3 style="font-size:14px;margin:16px 0 6px">銀行の利益指標</h3>
        <table class="t compact" style="max-width:520px"><tbody>
        <tr><td>業務粗利益（資金利益＋役務利益＋その他業務利益）</td><td class="n">${fmtYen(s.gross)}</td></tr>
        <tr><td>経費（営業経費）</td><td class="n">${fmtYen(s.opex)}</td></tr>
        <tr><td>コア業務純益（国債等債券損益を除く）</td><td class="n ${s.core < 0 ? 'neg' : ''}">${fmtYen(s.core)}</td></tr>
        <tr><td>与信関係費用（引当金繰入＋償却−戻入・取立益）</td><td class="n">${fmtYen(s.credit)}</td></tr>
        <tr><td>経費率（OHR）</td><td class="n">${s.gross > 0 ? fmtPct(s.opex / s.gross * 100, 1) : '―'}</td></tr></tbody></table>`;
      break;
    }
    case 'monthly': {
      const hs = G.hist.filter(h => h.m >= 0).slice(-12);
      if (!hs.length) { body = '<div class="empty">月末を締めると月次の収支が表示されます</div>'; break; }
      const ss = hs.map(h => plSummary(h.pl));
      const rowDefs = [['資金利益', s => s.nii], ['役務取引等利益', s => s.feeNet], ['その他業務利益（債券損益）', s => s.othNet], ['業務粗利益', s => s.gross, 'sum'], ['経費', s => -s.opex], ['コア業務純益', s => s.core, 'sum'], ['与信関係費用', s => -s.credit], ['経常利益', s => s.ordinary, 'sum'], ['特別損益', s => s.extra], ['法人税等', s => -s.tax], ['当期純利益', s => s.net, 'grand']];
      body = `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（単位：百万円）</th>${hs.map(h => `<th>${ymShort(h.m)}</th>`).join('')}</tr></thead><tbody>${rowDefs.map(([n, f, c]) => `<tr class="${c || ''}"><td>${n}</td>${ss.map(s => { const v = f(s); return `<td class="${v < 0 ? 'neg' : ''}">${fmtM(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="grid g2" style="margin-top:12px">${panel('業務粗利益と経費', lineChart({ labels: hs.map(h => ymShort(h.m)), height: 180, series: [{ name: '業務粗利益', color: 's1', values: ss.map(s => s.gross) }, { name: '経費', color: 's3', values: ss.map(s => s.opex) }] }))}${panel('当期純利益', barChart({ labels: hs.map(h => ymShort(h.m)), values: ss.map(s => s.net), name: '当期純利益', height: 180 }))}</div>
        <p class="note">6月と12月は賞与の支給で人件費が増えます。3月は決算で税金を計上し、監査の結果によっては引当金を積み増します。</p>`;
      break;
    }
    case 'capital': {
      const r = rwaBreakdown(), p = coreCapitalParts(r);
      const cr = p.core / r.total * 100;
      const cap = G.stock.price * G.stock.shares;
      body = `<div class="grid g2"><div><table class="t compact"><tbody>
        <tr class="sec"><td colspan="2">コア資本</td></tr>
        <tr><td>資本金・剰余金・当期利益</td><td class="n">${fmtYen(p.eq)}</td></tr>
        <tr><td>一般貸倒引当金（算入上限あり）</td><td class="n">${fmtYen(p.ga)}</td></tr>
        <tr><td>無形固定資産（ソフトウェア）の控除</td><td class="n neg">${MINUS}${fmtYen(p.intangible)}</td></tr>
        ${p.goodwill ? `<tr><td>のれんの控除</td><td class="n neg">${MINUS}${fmtYen(p.goodwill)}</td></tr>` : ''}
        <tr class="total"><td>コア資本の額</td><td class="n">${fmtYen(p.core)}</td></tr>
        <tr class="sec"><td colspan="2">リスク・アセット</td></tr>
        <tr><td>事業性融資（1億円以下は75%、保証協会付きは10%）</td><td class="n">${fmtYen(r.biz)}</td></tr>
        <tr><td>住宅ローン（35%）</td><td class="n">${fmtYen(r.mort)}</td></tr>
        <tr><td>プロジェクトファイナンス（100%）</td><td class="n">${fmtYen(r.proj)}</td></tr>
        ${r.seg ? `<tr><td>全国の店舗網の小口融資（個人35%・中小企業75%）</td><td class="n">${fmtYen(r.seg)}</td></tr>` : ''}
        ${r.ovs ? `<tr><td>海外の小口融資（カントリーリスクで加算）</td><td class="n">${fmtYen(r.ovs)}</td></tr>` : ''}
        <tr><td>延滞・破綻債権（引当後150%）</td><td class="n">${fmtYen(r.def)}</td></tr>
        <tr><td>コールローン（20%）・固定資産等（100%）</td><td class="n">${fmtYen(r.call + r.fixed)}</td></tr>
        <tr><td>オペレーショナル・リスク相当額</td><td class="n">${fmtYen(r.op)}</td></tr>
        ${r.fx ? `<tr><td>為替リスク相当額（ヘッジしていない外貨）</td><td class="n">${fmtYen(r.fx)}</td></tr>` : ''}
        <tr class="total"><td>リスク・アセット合計</td><td class="n">${fmtYen(r.total)}</td></tr>
        <tr class="grand"><td>自己資本比率</td><td class="n ${cr < reqCR() ? 'neg' : ''}">${fmtPct(cr)}</td></tr></tbody></table>
        <p class="note">現金・日銀預け金・国債のリスクウェイトは0%。${STAGES[stageOf()].name}は${STAGES[stageOf()].basis}で${fmtPct(reqCR(), 1)}以上が必要です。</p></div>
        <div class="stack"><div class="panel"><div class="pb"><b>早期是正措置の区分</b><table class="t compact" style="margin-top:6px"><tbody>
          <tr class="${cr >= reqCR() ? 'sel' : ''}"><td>${fmtPct(reqCR(), 1)}以上</td><td>対象外</td></tr><tr class="${cr < reqCR() && cr >= reqCR() / 2 ? 'sel' : ''}"><td>${fmtPct(reqCR() / 2, 2)}以上${fmtPct(reqCR(), 1)}未満</td><td>第1区分：経営改善計画の提出</td></tr>
          <tr class="${cr < reqCR() / 2 && cr >= 0 ? 'sel' : ''}"><td>0%以上${fmtPct(reqCR() / 2, 2)}未満</td><td>第2区分：新規融資の抑制など</td></tr><tr class="${cr < 0 ? 'sel' : ''}"><td>0%未満</td><td>第3区分：業務停止命令</td></tr></tbody></table></div></div>
        <div class="panel"><div class="pb"><b>増資（第三者割当）</b><p class="small muted" style="margin:4px 0 8px">株価 ${fmtNum(G.stock.price, 0)}円・時価総額 ${fmtYen(cap)}。発行価格は株価の92%。既存株主の持分は薄まります。</p>
          <div class="row"><input type="number" id="raiseAmt" min="1" step="1" value="${Math.max(1, Math.round(cap * 0.1 / 1e8))}" style="width:90px"><span class="unit">億円</span>${btn('増資する', 'raiseAsk', {}, 'primary')}</div></div></div>
        ${G.flags.publicFunds ? `<div class="panel"><div class="pb"><b>公的資金</b><p class="small">優先株式 ${fmtYen(B('prefCapital'))}。返済後も自己資本比率${fmtPct(Math.max(8, reqCR() + 2), 1)}以上を保てる場合に返済できます。</p>${btn('公的資金を返済する', 'repayPF', {}, 'sm')}</div></div>` : ''}
        ${G.flags.publicOffer && !G.flags.publicFunds ? `<div class="panel"><div class="pb"><b>公的資金の申請</b><p class="small">自己資本比率が${fmtPct(reqCR(), 1)}を下回ったため、公的資金の注入を申請できます。</p>${btn('申請を検討する', 'publicFundsShow', {}, 'sm danger')}</div></div>` : ''}</div></div>`;
      break;
    }
    case 'npl': {
      const n = nplBreakdown();
      let prot = 0;
      for (const L of G.loans) if (isActiveLoan(L) && L.cls >= 2) prot += Math.min(L.bal, collateralBank(L) * 0.7 + L.bal * (L.cgc || 0) + (L.provision || 0));
      const hs = G.hist.filter(h => h.m >= 0).slice(-36);
      body = `<div class="grid g2"><div><table class="t"><thead><tr><th>金融再生法開示債権</th><th class="n">残高</th><th class="n">構成比</th></tr></thead><tbody>
        <tr><td>破産更生債権及びこれらに準ずる債権（実質破綻先・破綻先）</td><td class="n">${fmtYen(n.bk)}</td><td class="n">${fmtPct(n.bk / Math.max(1, n.total) * 100)}</td></tr>
        <tr><td>危険債権（破綻懸念先）</td><td class="n">${fmtYen(n.doubt)}</td><td class="n">${fmtPct(n.doubt / Math.max(1, n.total) * 100)}</td></tr>
        <tr><td>要管理債権（要管理先）</td><td class="n">${fmtYen(n.sub)}</td><td class="n">${fmtPct(n.sub / Math.max(1, n.total) * 100)}</td></tr>
        <tr class="total"><td>小計（不良債権）</td><td class="n">${fmtYen(n.npl)}</td><td class="n">${fmtPct(n.ratio)}</td></tr>
        <tr><td>正常債権</td><td class="n">${fmtYen(n.normal)}</td><td class="n">${fmtPct(n.normal / Math.max(1, n.total) * 100)}</td></tr>
        <tr class="grand"><td>合計</td><td class="n">${fmtYen(n.total)}</td><td class="n">100.00%</td></tr></tbody></table>
        <p class="small" style="margin-top:8px">保全率（担保・保証・引当で手当て済みの割合）：<b>${n.npl > 0 ? fmtPct(Math.min(1, prot / n.npl) * 100, 1) : '―'}</b></p>
        <p class="note">開示は当行が付けた債務者区分に基づきます。区分を甘くすると見かけの不良債権比率は下がりますが、検査で修正されます。</p></div>
        ${panel('不良債権比率の推移', hs.length >= 2 ? lineChart({ labels: hs.map(h => ymShort(h.m)), height: 190, yFmt: axisPct(1), tipFmt: v => fmtPct(v), series: [{ name: '不良債権比率', color: 's3', values: hs.map(h => h.kpi.npl) }], endLabels: false }) : '<div class="empty">―</div>')}</div>`;
      break;
    }
    case 'history': {
      const rows = G.annual.slice().reverse().map(a => `<tr class="click" data-act="annualOpen" data-fy="${a.fy}"><td>${fyLabel(a.fy)}<div class="small muted">${fyYearLabel(a.fy)}</div></td><td class="n">${fmtYen(a.ta)}</td><td class="n">${fmtYen(a.dep)}</td><td class="n">${fmtYen(a.loans)}</td><td class="n ${a.pl.net < 0 ? 'neg' : ''}">${fmtYen(a.pl.net)}</td><td class="n">${fmtPct(a.roa)}</td><td class="n">${fmtPct(a.ohr, 1)}</td><td class="n">${fmtPct(a.cr)}</td><td class="n">${fmtPct(a.npl)}</td><td>${RATINGS[a.rating]}</td><td class="n">${a.dividend !== undefined ? fmtYen(a.dividend) : '―'}</td><td class="small">${esc(a.audit.opinion)}</td></tr>`).join('');
      body = rows ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>決算期</th><th class="n">総資産</th><th class="n">預金</th><th class="n">貸出金</th><th class="n">当期純利益</th><th class="n">ROA</th><th class="n">OHR</th><th class="n">自己資本比率</th><th class="n">不良債権比率</th><th>格付</th><th class="n">配当</th><th>監査意見</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">行をクリックすると決算書の詳細を表示します。</p>` : '<div class="empty">最初の決算は3月末です</div>';
      break;
    }
    case 'journal': {
      const cur = { m: 'cur', entries: Object.values(G.ledger.jcur).map(j => ({ desc: j.desc, n: j.n, lines: Object.entries(j.lines).map(([k, v]) => [k, v[0], v[1]]) })) };
      const js = [cur].concat(G.ledger.journal.slice().reverse());
      if (UI.jMonth === null || !js.some(j => String(j.m) === String(UI.jMonth))) UI.jMonth = cur.entries.length ? 'cur' : String(js[1] ? js[1].m : 'cur');
      const j = js.find(x => String(x.m) === String(UI.jMonth));
      const sel = `<label class="field" style="max-width:280px"><span>表示する月</span><select data-ch="jMonth">${js.map(x => `<option value="${x.m}"${String(x.m) === String(UI.jMonth) ? ' selected' : ''}>${x.m === 'cur' ? `当月（${ymLabel(G.m)}・締め前）` : x.m < 0 ? '開業時' : ymLabel(x.m)}</option>`).join('')}</select></label>`;
      const jt = j && j.entries.length ? `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>摘要</th><th class="n">件数</th><th>借方</th><th class="n">金額</th><th>貸方</th><th class="n">金額</th></tr></thead><tbody>${j.entries.map(en => {
        const dr = en.lines.filter(l => l[1] > 0), cr = en.lines.filter(l => l[2] > 0);
        const n = Math.max(dr.length, cr.length);
        let h = '';
        for (let i = 0; i < n; i++) h += `<tr>${i === 0 ? `<td rowspan="${n}">${esc(en.desc)}</td><td class="n" rowspan="${n}">${en.n}</td>` : ''}<td>${dr[i] ? ACCT[dr[i][0]].name : ''}</td><td class="n">${dr[i] ? fmtNum(dr[i][1]) : ''}</td><td>${cr[i] ? ACCT[cr[i][0]].name : ''}</td><td class="n">${cr[i] ? fmtNum(cr[i][2]) : ''}</td></tr>`;
        return h;
      }).join('')}</tbody></table></div>` : '<div class="empty">仕訳はまだありません</div>';
      let dT = 0, cT = 0;
      const tb = ACCT_KEYS.map(k => {
        const v = B(k);
        if (!v) return '';
        const debitSide = isDebitNature(k) ? v >= 0 : v < 0;
        const amt = Math.abs(v);
        if (debitSide) dT += amt; else cT += amt;
        return `<tr><td class="num">${ACCT[k].code}</td><td>${ACCT[k].name}</td><td class="n">${debitSide ? fmtNum(amt) : ''}</td><td class="n">${debitSide ? '' : fmtNum(amt)}</td></tr>`;
      }).join('');
      body = `<div class="grid g2"><div>${sel}<div style="margin-top:10px">${jt}</div><p class="note">同じ種類の取引は月ごとに集計して表示しています（件数欄）。</p></div>
        <div><h3 style="font-size:14px;margin:0 0 6px">合計残高試算表（現在）</h3><table class="t compact"><thead><tr><th>コード</th><th>勘定科目</th><th class="n">借方残高</th><th class="n">貸方残高</th></tr></thead><tbody>${tb}<tr class="grand"><td></td><td>合計</td><td class="n">${fmtNum(dT)}</td><td class="n">${fmtNum(cT)}</td></tr></tbody></table>
        <p class="small" style="margin-top:6px">${Math.abs(dT - cT) <= 1 ? tag('借方合計と貸方合計が一致', 'ok') : tag('不一致', 'bad')}</p></div></div>`;
      break;
    }
  }
  return `<h1 class="h1">決算・財務</h1>
  <p class="lead">${G.bankName}の財務諸表です。決算は毎年3月末。監査法人の監査を経て、税金を計上し、配当を決めます。</p>
  <div class="subtabs">${tabs.map(([k, l]) => `<button type="button" data-act="finTab" data-v="${k}" aria-pressed="${UI.finTab === k}">${l}</button>`).join('')}</div>
  <div class="panel"><div class="pb">${body}</div></div>`;
};
Object.assign(ACTIONS, {
  finTab: d => { UI.finTab = d.v; render(); },
  annualOpen: d => showModal('annual', { fy: +d.fy }),
  raiseAsk: () => {
    const amt = Math.round(parseFloat($('#raiseAmt').value) || 0) * 1e8;
    confirmBox('増資', `${fmtYen(amt)}の第三者割当増資を行います。発行費用は3%。株主満足度が下がる可能性があります。`, '増資する', 'raiseGo', { amt });
  },
  raiseGo: d => { const r = raiseCapital(+d.amt); toast(r.ok ? `${fmtYen(+d.amt)}を調達しました` : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
  repayPF: () => { const r = repayPublicFunds(); toast(r.ok ? '公的資金を返済しました' : r.msg, r.ok ? '' : 'bad'); render(); },
  publicFundsShow: () => showModal('publicFunds', {}),
});
Object.assign(CHANGES, { jMonth: el => { UI.jMonth = el.value; render(); } });

/* ---------- 監査・検査 ---------- */
SCREENS.audit = () => {
  const lv = G.sys.audit;
  const used = G.capUsed.audit, slots = auditSlots();
  const rows = openBranches().map(b => {
    const arr = G.branchReports[b.id] || [];
    const last = arr[arr.length - 1];
    if (!last) return `<tr><td>${esc(b.name)}</td><td colspan="7" class="muted">報告はまだありません</td></tr>`;
    const an = lv >= 1 ? branchAnomalies(b.id) : [];
    const risk = lv >= 2 ? fraudRiskScore(b.id) : null;
    const sp = k => sparkline(arr.map(x => x[k]), { w: 70, h: 20 });
    return `<tr><td><b>${esc(b.name)}</b><div class="small muted">${b.lastAudit !== undefined ? `前回の臨時監査 ${ymShort(b.lastAudit)}` : '臨時監査の実績なし'}</div></td>
      <td class="n">${fmtYen(last.exp)}<div>${sp('exp')}</div></td><td class="n">${fmtYen(last.suspense)}<div>${sp('suspense')}</div></td>
      <td class="n">${last.cashDiff}件<div>${sp('cashDiff')}</div></td><td class="n">${last.complaints}件<div>${sp('complaints')}</div></td><td class="n">${last.errors}件</td>
      <td>${an.length ? an.map(a => tag(a + 'に異常値', 'warn')).join(' ') : lv >= 1 ? '<span class="small muted">異常なし</span>' : '<span class="small muted">―</span>'}${risk !== null ? `<div class="small">不正リスク <b class="${risk >= 50 ? 'neg' : ''}">${risk}</b></div>` : ''}</td>
      <td class="n">${btn('臨時監査', 'audit', { id: b.id }, 'sm', { disabled: used >= slots })}</td></tr>`;
  }).join('');
  const cases = G.ifraud.filter(f => f.detected && !f.lost).slice().reverse().map(f => `<tr><td>${ymShort(f.detM)}</td><td>${esc(G.branches.find(b => b.id === f.bid)?.name || '（閉鎖店）')}</td><td>${f.type === 'embezzle' ? '顧客預金の着服' : '架空経費の計上'}</td><td class="n">${G.m - f.startM >= 0 ? (f.detM - f.startM) + 'か月' : ''}</td><td class="n">${fmtYen(f.cum)}</td><td>${{ special: '臨時監査', internal: '内部監査', external: '顧客の訴え・報道', fsa: '金融庁検査', auditor: '監査法人' }[f.how]}</td></tr>`).join('');
  const fsaRows = G.fsa.history.slice().reverse().map(h => `<tr><td>${ymLabel(h.m)}</td><td>${tag(h.text, h.grade <= 'B' ? 'ok' : 'bad')}</td><td class="small">${h.findings.length ? h.findings.map(f => esc(f.text)).join('<br>') : '指摘なし'}</td></tr>`).join('');
  const posture = `<table class="t compact"><tbody>
    <tr><td>管理・監査の人員</td><td class="n">${G.staff.comp}人（必要 ${fmtNum(compRequired(), 1)}人）</td><td>${compRatio() >= 1 ? tag('充足', 'ok') : tag('不足', 'bad')}</td></tr>
    <tr><td>内部監査支援システム</td><td class="n">Lv${lv}</td><td>${lv ? tag(SYSTEMS.audit.levels[lv].name, 'ok') : tag('紙ベース')}</td></tr>
    <tr><td>マネロン対策</td><td class="n">Lv${G.sys.aml}（求められる水準 Lv${amlRequired()}）</td><td>${G.sys.aml >= amlRequired() ? tag('充足', 'ok') : tag('不足', 'bad')}</td></tr>
    <tr><td>自己査定の区分ずれ（システム判定より甘い先）</td><td class="n">${G.loans.filter(L => isActiveLoan(L) && sysClass(L) > L.cls).length}件</td><td></td></tr>
    <tr><td>未検証の決算書</td><td class="n">${G.inbox.filter(x => x.type === 'review').length}先</td><td></td></tr>
    <tr><td>前回の金融庁検査</td><td class="n">${G.fsa.history.length ? ymLabel(G.fsa.history[G.fsa.history.length - 1].m) : 'まだ受けていない'}</td><td></td></tr></tbody></table>
    <p class="note">金融庁検査は概ね2〜3年ごと。予告は1か月前に届きます。重大な不祥事やシステム障害があると前倒しされます。</p>`;
  const audits = G.annual.slice().reverse().map(a => `<tr><td>${fyLabel(a.fy)}</td><td>${tag(a.audit.opinion, a.audit.opinion.includes('強調') ? 'warn' : 'ok')}</td><td class="small">${a.audit.notes.length ? a.audit.notes.map(esc).join('<br>') : '修正事項なし'}</td></tr>`).join('');
  return `<h1 class="h1">監査・検査</h1>
  <p class="lead">支店から毎月上がる報告に、行員の不正の兆候が紛れていることがあります。苦情や現金過不足の増加、仮払金や経費の不自然な膨張に注意し、怪しい店には臨時監査を入れましょう。</p>
  <div class="stack">${panel('支店の月次報告', `<div class="tbl-wrap"><table class="t"><thead><tr><th>店舗</th><th class="n">経費</th><th class="n">仮払金残高</th><th class="n">現金過不足</th><th class="n">顧客の苦情</th><th class="n">事務ミス</th><th>監査システムの所見</th><th class="n">臨時監査（今月 ${slots - used}/${slots}）</th></tr></thead><tbody>${rows}</tbody></table></div>`, { flush: true, aside: '直近の月と過去12か月の推移' })}
  <div class="grid g2">${panel('内部管理態勢', posture)}${panel('発覚した不正', cases ? `<table class="t compact"><thead><tr><th>発覚</th><th>店舗</th><th>内容</th><th class="n">期間</th><th class="n">被害額</th><th>発覚の経緯</th></tr></thead><tbody>${cases}</tbody></table>` : '<div class="empty">これまでに発覚した不正はありません</div>', { flush: !!cases })}</div>
  <div class="grid g2">${panel('金融庁検査の履歴', fsaRows ? `<table class="t compact"><thead><tr><th>実施</th><th>結果</th><th>指摘事項</th></tr></thead><tbody>${fsaRows}</tbody></table>` : '<div class="empty">まだ検査を受けていません</div>', { flush: !!fsaRows })}
  ${panel('監査法人の監査', audits ? `<table class="t compact"><thead><tr><th>決算期</th><th>監査意見</th><th>指摘</th></tr></thead><tbody>${audits}</tbody></table>` : '<div class="empty">最初の決算は3月末です</div>', { flush: !!audits })}</div></div>`;
};
Object.assign(ACTIONS, {
  audit: d => {
    const r = specialAudit(d.id);
    if (!r.ok) toast(r.msg, 'bad');
    else if (r.found) toast(`不正を発見しました：被害額${fmtYen(r.f.cum)}`, 'bad');
    else toast('臨時監査の結果、異常はありませんでした');
    render();
  },
});

/* ---------- 経済・ニュース ---------- */
const NEWS_CATS = [['all', 'すべて'], ['eco', '経済'], ['ind', '業界'], ['city', CITY_NAME], ['bank', '当行'], ['loan', '融資先'], ['reg', '規制・検査']];
SCREENS.news = () => {
  const list = G.news.filter(n => UI.newsCat === 'all' || n.cat === UI.newsCat).slice(0, 150);
  const hs = G.hist.filter(h => h.m >= 0 && h.kpi.gdp !== undefined).slice(-60);
  const lab = hs.map(h => ymShort(h.m));
  const small = (title, series, fmt) => panel(title, hs.length >= 2 ? lineChart({ labels: lab, height: 150, series, yFmt: fmt, tipFmt: fmt, endLabels: false }) : '<div class="empty">―</div>');
  const charts = `<div class="grid g3">
    ${small('実質GDP成長率', [{ name: 'GDP成長率', color: 's1', values: hs.map(h => h.kpi.gdp) }], v => fmtNum(v, 1) + '%')}
    ${small('消費者物価指数（前年比）', [{ name: '消費者物価', color: 's3', values: hs.map(h => h.kpi.cpi) }], v => fmtNum(v, 1) + '%')}
    ${small('完全失業率', [{ name: '失業率', color: 's2', values: hs.map(h => h.kpi.unemp) }], v => fmtNum(v, 1) + '%')}
    ${small('政策金利と10年国債', [{ name: '政策金利', color: 's1', values: hs.map(h => h.kpi.policy) }, { name: '10年国債', color: 's2', values: hs.map(h => h.kpi.y10) }], v => fmtNum(v, 2) + '%')}
    ${small('全国の地価指数', [{ name: '地価指数', color: 's3', values: hs.map(h => h.kpi.landN) }], v => fmtNum(v, 0))}
    ${small('株価指数', [{ name: '株価指数', color: 's2', values: hs.map(h => h.kpi.stockN) }], v => fmtNum(v, 0))}</div>`;
  const indRows = INDUSTRIES.map(i => {
    const v = indCond(i.id);
    const w = Math.abs(v) / 1.2 * 50;
    const bar = `<div style="position:relative;height:10px;background:var(--sheet-3);border-radius:2px"><span style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--ink-3)"></span><span style="position:absolute;top:0;bottom:0;${v >= 0 ? `left:50%;width:${w}%;background:var(--s1)` : `right:50%;width:${w}%;background:var(--shu)`};border-radius:2px"></span></div>`;
    return `<tr><td>${i.name}</td><td style="width:45%">${bar}</td><td class="n">${v >= 0.15 ? '好調' : v <= -0.15 ? '不調' : '平常'}</td></tr>`;
  }).join('');
  return `<h1 class="h1">経済・ニュース</h1>
  <p class="lead">景気局面は「${REGIMES[G.eco.regime].name}」。景気が悪化すると融資先の倒産が増え、地価が下がって担保価値も目減りします。</p>
  <div class="stack">${charts}
  <div class="grid g-side">${panel('ニュース', `<div class="subtabs" style="padding:0 6px">${NEWS_CATS.map(([k, l]) => `<button type="button" data-act="newsCat" data-v="${k}" aria-pressed="${UI.newsCat === k}">${l}</button>`).join('')}</div><ul class="newslist">${list.map(n => `<li class="${n.tone}"><span class="when">${ymShort(n.m)}</span><span class="what">${esc(n.text)}</span></li>`).join('') || '<li><span></span><span class="muted">該当するニュースはありません</span></li>'}</ul>`, { flush: true })}
  ${panel('業界の景況', `<table class="t compact"><tbody>${indRows}</tbody></table>`, { flush: true })}</div></div>`;
};
Object.assign(ACTIONS, { newsCat: d => { UI.newsCat = d.v; render(); } });

/* ---------- モーダル ---------- */
MODALS.monthly = a => {
  const r = a.rep;
  const pl = r.pl;
  const notable = r.news.filter(n => n.cat !== 'ind' || n.tone === 'bad').slice(0, 9);
  const body = `<div class="grid g2"><table class="t compact"><tbody>
    ${pl ? `<tr><td>資金利益</td><td class="n">${fmtYen(pl.nii)}</td></tr><tr><td>役務取引等利益</td><td class="n">${fmtYen(pl.feeNet)}</td></tr><tr><td>経費</td><td class="n">${MINUS}${fmtYen(pl.opex)}</td></tr>
    <tr><td>与信関係費用</td><td class="n ${pl.credit > 0 ? 'neg' : ''}">${pl.credit > 0 ? MINUS : '+'}${fmtYen(Math.abs(pl.credit))}</td></tr><tr class="total"><td>当月の純利益</td><td class="n ${pl.net < 0 ? 'neg' : ''}">${fmtYen(pl.net)}</td></tr>` : ''}</tbody></table>
    <table class="t compact"><tbody><tr><td>預金</td><td class="n">${deltaTxt(r.dDep)}</td></tr><tr><td>貸出金</td><td class="n">${deltaTxt(r.dLoans)}</td></tr><tr><td>総資産</td><td class="n">${deltaTxt(r.dTA)}</td></tr><tr><td>信用度</td><td class="n">${deltaTxt(r.dTrust, v => fmtNum(v, 1))}</td></tr><tr><td>新しい融資の申込</td><td class="n">${r.newApps}件</td></tr></tbody></table></div>
    <h3 style="font-size:14px;margin:14px 0 6px">今月の出来事</h3>${notable.length ? `<ul class="newslist" style="border:1px solid var(--rule);border-radius:var(--r-m)">${notable.map(n => `<li class="${n.tone}"><span class="when">${n.cat === 'eco' ? '経済' : n.cat === 'city' ? '街' : n.cat === 'loan' ? '融資先' : n.cat === 'reg' ? '規制' : n.cat === 'ind' ? '業界' : '当行'}</span><span class="what">${esc(n.text)}</span></li>`).join('')}</ul>` : '<p class="muted">大きな出来事はありませんでした。</p>'}
    <label class="inline small" style="margin-top:12px"><input type="checkbox" data-ch="setting" data-key="monthly" ${UI.settings.monthly ? 'checked' : ''}> 毎月この報告を表示する</label>`;
  return modalFrame(`${ymLabel(r.m)}の月次報告`, body, btn('閉じる', 'closeModal', {}, 'primary'), { sub: `${warekiLabel(r.m)}末の締め` });
};

MODALS.yearEnd = a => {
  const rep = G.annual.find(x => x.fy === a.fy);
  const d = G.pendingDividend;
  const pl = rep.pl;
  let divHtml;
  if (d && d.fy === a.fy) {
    if (!d.allowed) divHtml = `<p class="callout bad">${G.flags.publicFunds ? '公的資金の注入中のため' : pl.net <= 0 ? '当期純損失のため' : `自己資本比率が${fmtPct(reqCR() + 2, 1)}未満のため`}、今期は無配とします。</p>`;
    else {
      const opts = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
      const cur = UI.divSel ?? 0.3;
      divHtml = `<p class="small" style="margin:0 0 6px">当期純利益 ${fmtYen(pl.net)} のうち、配当に回す割合（配当性向）を決めてください。株主は配当を喜びますが、内部留保は自己資本を厚くします。</p>
        <div class="seg" role="radiogroup">${opts.map(o => `<button type="button" data-act="divSel" data-v="${o}" aria-pressed="${Math.abs(cur - o) < 1e-6}">${o ? fmtNum(o * 100, 0) + '%' : '無配'}</button>`).join('')}</div>
        <p class="small" style="margin:6px 0 0">配当総額 <b>${fmtYen(Math.round(pl.net * cur))}</b>（1株あたり ${fmtNum(pl.net * cur / G.stock.shares, 2)}円・6月の株主総会後に支払）</p>`;
    }
  } else divHtml = `<p class="small">配当：${fmtYen(rep.dividend || 0)}（決定済み）</p>`;
  const body = `<div class="grid g2"><table class="t compact"><tbody>
    <tr><td>業務粗利益</td><td class="n">${fmtYen(pl.gross)}</td></tr><tr><td>経費</td><td class="n">${MINUS}${fmtYen(pl.opex)}</td></tr><tr><td>コア業務純益</td><td class="n ${pl.core < 0 ? 'neg' : ''}">${fmtYen(pl.core)}</td></tr>
    <tr><td>与信関係費用</td><td class="n">${MINUS}${fmtYen(pl.credit)}</td></tr><tr><td>経常利益</td><td class="n ${pl.ordinary < 0 ? 'neg' : ''}">${fmtYen(pl.ordinary)}</td></tr><tr><td>法人税等</td><td class="n">${MINUS}${fmtYen(pl.tax)}</td></tr>
    <tr class="grand"><td>当期純利益</td><td class="n ${pl.net < 0 ? 'neg' : ''}">${fmtYen(pl.net)}</td></tr></tbody></table>
    <table class="t compact"><tbody><tr><td>総資産</td><td class="n">${fmtYen(rep.ta)}</td></tr><tr><td>自己資本比率</td><td class="n">${fmtPct(rep.cr)}</td></tr><tr><td>不良債権比率</td><td class="n">${fmtPct(rep.npl)}</td></tr>
    <tr><td>ROA／ROE</td><td class="n">${fmtPct(rep.roa)}／${fmtPct(rep.roe, 1)}</td></tr><tr><td>経費率（OHR）</td><td class="n">${fmtPct(rep.ohr, 1)}</td></tr><tr><td>格付</td><td class="n">${RATINGS[G.ratingIdx]}</td></tr></tbody></table></div>
    <h3 style="font-size:14px;margin:14px 0 6px">監査法人の意見</h3><p style="margin:0">${tag(rep.audit.opinion, 'ok')}</p>${rep.audit.notes.length ? `<ul class="small">${rep.audit.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="small muted">修正を求められた事項はありません。</p>'}
    <h3 style="font-size:14px;margin:14px 0 6px">剰余金の配当</h3>${divHtml}`;
  const locked = d && d.fy === a.fy;
  return modalFrame(`${fyLabel(a.fy)}決算（${fyYearLabel(a.fy)}）`, body, (locked ? btn('この内容で決算を確定する', 'divGo', {}, 'primary') : btn('閉じる', 'closeModal', {}, 'primary')) + btn('決算書を見る', 'annualFromYE', { fy: a.fy }), { noClose: locked, sub: `${ymLabel(G.m - 1)}末` });
};
MODALS.yearEnd.locked = a => !!(G.pendingDividend && G.pendingDividend.fy === a.fy);
Object.assign(ACTIONS, {
  divSel: d => { UI.divSel = +d.v; drawModal(); },
  divGo: () => { const r = decideDividend(UI.divSel ?? 0.3); UI.divSel = null; toast(r.amt ? `配当${fmtYen(r.amt)}を決議しました` : '今期は無配としました'); autosave(); closeModal(true); },
  annualFromYE: d => { UI.queue.unshift({ name: UI.modal.name, args: UI.modal.args }); showModal('annual', { fy: +d.fy, back: true }); },
});

MODALS.annual = a => {
  const rep = G.annual.find(x => x.fy === a.fy);
  if (!rep) return modalFrame('決算', '<p>データがありません</p>', btn('閉じる', 'closeModal'));
  const body = `<div class="grid g2"><div><h3 style="font-size:14px;margin:0 0 6px">貸借対照表（期末）</h3>${fsTable([fyLabel(rep.fy)], [bankBSRows(rep.bs)])}</div><div><h3 style="font-size:14px;margin:0 0 6px">損益計算書</h3>${fsTable([fyLabel(rep.fy)], [bankPLRows(rep.plRaw)])}</div></div>`;
  return modalFrame(`${fyLabel(rep.fy)}の決算書`, body, btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide', sub: fyYearLabel(rep.fy) });
};

MODALS.fsa = a => {
  const h = G.fsa.history[a.idx];
  const body = `<p style="font-size:18px;margin:0 0 10px;font-family:var(--f-doc)">検査結果：<b class="${h.grade <= 'B' ? '' : 'neg'}">${h.text}</b></p>
    ${h.findings.length ? `<table class="t"><thead><tr><th>指摘事項</th><th>重要度</th></tr></thead><tbody>${h.findings.map(f => `<tr><td>${esc(f.text)}</td><td>${tag(['', '軽微', '重要', '重大'][f.sev], f.sev >= 3 ? 'bad' : f.sev === 2 ? 'warn' : '')}</td></tr>`).join('')}</tbody></table>` : '<p>指摘事項はありませんでした。日頃の管理態勢が評価されました。</p>'}
    ${h.addProv > 0 ? `<p class="callout bad" style="margin-top:10px">債務者区分の修正により、貸倒引当金を${fmtYen(h.addProv)}積み増しました。</p>` : ''}
    ${h.grade === 'D' ? '<p class="callout bad" style="margin-top:10px">業務改善命令を受けました。1年間は新規出店ができず、信用度が大きく低下します。</p>' : ''}`;
  return modalFrame('金融庁検査の結果', scene('fsa', { cls: 'modal-art', alt: '' }) + body, btn('閉じる', 'closeModal', {}, 'primary'));
};
MODALS.agm = a => {
  const body = `<p style="margin:0 0 8px">頭取の再任議案の賛成率：<b style="font-size:20px" class="${a.approval < 60 ? 'neg' : ''}">${fmtNum(a.approval, 1)}%</b></p>${meter(a.approval, 100, a.approval < 60 ? 'bad' : a.approval < 75 ? 'warn' : '')}
    <p class="small" style="margin-top:10px">株主満足度 ${fmtNum(a.sat, 0)}／100。ROE、配当、株価の動き、不祥事が評価されます。</p>
    ${a.warn ? '<p class="callout bad">株主の不満は限界に近づいています。来年も業績が振るわなければ、再任議案は否決されるでしょう。</p>' : a.sat < 30 ? '<p class="callout bad">経営陣への厳しい質問が相次ぎました。</p>' : '<p class="callout ok">総会は円満に終了しました。</p>'}`;
  return modalFrame('定時株主総会', scene('agm', { cls: 'modal-art', alt: '' }) + body, btn('閉じる', 'closeModal', {}, 'primary'));
};
MODALS.publicFunds = () => {
  const r = rwaBreakdown();
  const need = Math.max(30e8, Math.round(r.total * (reqCR() + 5) / 100 - coreCapitalParts(r).core));
  const body = `<p>自己資本比率が${STAGES[stageOf()].basis}の${fmtPct(reqCR(), 1)}を下回りました。このままでは業務停止命令を受けるおそれがあります。</p>
    <p>預金保険機構を通じて、優先株式の形で公的資金<b>${fmtYen(need)}</b>の注入を申請できます。</p>
    <ul class="small"><li>経営健全化計画の提出が義務付けられ、信用度が下がります</li><li>完済まで配当はできず、給与水準は90%以下に抑えられます</li><li>経営評価で減点されます</li></ul>`;
  return modalFrame('公的資金の注入', body, btn('申請しない', 'closeModal') + btn('申請する', 'pfAccept', {}, 'danger'), { size: 'narrow' });
};
Object.assign(ACTIONS, { pfAccept: () => { const r = acceptPublicFunds(); toast(`公的資金${fmtYen(r.need)}の注入を受けました`, 'bad'); autosave(); closeModal(true); } });

function evalHtml() {
  const ev = finalEvaluation();
  return `<div class="row" style="gap:18px;align-items:center;margin-bottom:10px"><div style="font-family:var(--f-doc);font-size:56px;font-weight:700;line-height:1;color:var(--brass)">${ev.rank}</div><div><div style="font-size:18px;font-weight:700">${ev.title}</div><div class="small muted">経営評価 ${ev.total}点／100点</div></div></div>
    <table class="t compact"><tbody>${ev.parts.map(p => `<tr><td>${p.name}</td><td style="width:35%">${meter(p.pts, p.max, 'ok')}</td><td class="n">${p.pts}/${p.max}</td><td class="small muted">${esc(p.note)}</td></tr>`).join('')}</tbody></table>`;
}
MODALS.gameover = () => {
  const o = OVER_TEXT[G.over.kind];
  const body = `${scene('crisis', { cls: 'modal-art', alt: '' })}<p style="font-size:17px;margin:0 0 6px;font-family:var(--f-doc)"><b class="neg">${o.title}</b>（${ymLabel(G.over.m)}）</p><p>${o.text}</p><hr class="sep"><h3 style="font-size:14px;margin:0 0 8px">在任中の経営評価</h3>${evalHtml()}`;
  return modalFrame('経営の終わり', body, btn('セーブから再開', 'menu') + btn('新しいゲーム', 'newGameGo', {}, 'primary'), { noClose: false });
};
MODALS.term = () => modalFrame('任期満了', `${scene(STAGE_ART[G.stage || 0], { cls: 'modal-art', alt: '' })}<p>就任から${G.termYears}年。${esc(G.bankName)}頭取としての任期を全うしました。</p>${evalHtml()}<p class="note" style="margin-top:10px">このまま続投して経営を続けることもできます。</p>`, btn('続投する', 'closeModal', {}, 'primary'), { size: 'wide' });

MODALS.menu = () => {
  const slot = i => {
    let meta = null;
    try { meta = JSON.parse(lsGet(LS.meta(i)) || 'null'); } catch (e) { meta = null; }
    return `<tr><td>${i === 'a' ? '自動保存' : 'スロット' + i}</td><td class="small">${meta ? `${esc(meta.bank)}・${ymLabel(meta.m)}・総資産${fmtYen(meta.ta)}` : '<span class="muted">空き</span>'}</td><td class="n">${i === 'a' ? '' : btn('保存', 'saveSlot', { slot: i }, 'sm', { disabled: !G })} ${btn('読込', i === 'a' ? 'loadAuto' : 'loadSlot', { slot: i }, 'sm', { disabled: !meta })}</td></tr>`;
  };
  const theme = lsGet(LS.theme) || 'auto';
  const body = `<h3 style="font-size:14px;margin:0 0 6px">セーブとロード</h3><table class="t compact"><tbody>${slot('a')}${slot(1)}${slot(2)}${slot(3)}</tbody></table>
    <p class="note">データはこのブラウザ内に保存されます。別の端末で続けるときはファイルに書き出してください。</p>
    <div class="row">${btn('ファイルに書き出す', 'exportSave', {}, '', { disabled: !G })}${btn('ファイルから読み込む', 'importSave')}</div>
    <hr class="sep"><h3 style="font-size:14px;margin:0 0 6px">表示</h3>
    <div class="seg">${[['auto', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']].map(([k, l]) => `<button type="button" data-act="theme" data-v="${k}" aria-pressed="${theme === k}">${l}</button>`).join('')}</div>
    <div style="margin-top:10px;display:grid;gap:6px"><label class="inline small"><input type="checkbox" data-ch="setting" data-key="monthly" ${UI.settings.monthly ? 'checked' : ''}> 毎月、月次報告を表示する</label>
    <label class="inline small"><input type="checkbox" data-ch="setting" data-key="confirmAdvance" ${UI.settings.confirmAdvance ? 'checked' : ''}> 未処理の案件があるとき月末の締めを確認する</label></div>
    <hr class="sep">${G ? btn('新しいゲームを始める', 'newGameConfirm', {}, 'danger') : ''}`;
  return modalFrame('メニュー', body, btn('閉じる', 'closeModal', {}, 'primary'));
};

const HELP = [
  ['ゲームの目的', `<p>あなたは、経営破綻した${OLD_UNION}の事業を引き継いで生まれた<b>${DEFAULT_BANK}</b>（名前は変更可）の初代頭取です。任期は10年（カスタムスタートでは20年・30年・無期限も選べます）。地域の企業と家計にお金を回して${CITY_NAME}を育てながら、健全で利益の出る銀行に成長させてください。</p>
    <p>力をつければ<b>メガバンク</b>に格上げして全国へ、さらに<b>テラバンク</b>として世界へ打って出られます（「メガバンク・テラバンク」の項を参照）。</p>
    <p>次のどれかで経営は終わります：<b>債務超過</b>、<b>自己資本比率がマイナス</b>（業務停止命令）、<b>資金繰りの破綻</b>、<b>株主総会での解任</b>。任期の終わりには経営評価（S〜D）が出ます。</p>`],
  ['1か月の流れ', `<ol><li><b>融資審査</b>：新しい申込に調査を指示し、条件を決めて承認か謝絶。回答期限は翌月末。</li><li><b>与信管理</b>：届いた決算書を検証し、債務者区分（自己査定）を見直す。返済猶予の申し出に回答。</li><li><b>経営判断</b>：金利、国債運用、店舗・金庫・システム・人員への投資、開発案件への参加。</li><li><b>月末を締めて翌月へ</b>：利息の受払い、預金の増減、返済と延滞、経費、引当金、資金繰りが自動で処理され、月次報告が出ます。</li></ol>
    <p>3月末は決算。監査法人の監査、税金の計上、配当の決定があります。6月は株主総会です。</p>`],
  ['融資審査のコツ', `<p>稟議書には直近3期の損益計算書・貸借対照表・キャッシュ・フロー計算書と財務分析が載っています。</p>
    <ul><li><b>自己資本比率</b>（純資産÷総資産）が低い、<b>債務超過</b>（純資産がマイナス）は要注意。</li><li><b>債務償還年数</b>＝（有利子負債−現預金）÷（経常利益×0.7＋減価償却費）。10年を超えると返済力が乏しい。</li><li><b>資金使途</b>を確かめる。「運転資金」の名目で赤字の穴埋めに使われることがある（代表者面談で判明することも）。</li><li>金利は格付に見合うだけ取る。ただし高くしすぎると優良先は他行に流れ、<b>業況の悪い先ほど高い金利でも借りに来る</b>（逆選択）。</li><li>担保（不動産）や信用保証協会の保証は、破綻時の損失を抑える。</li></ul>`],
  ['粉飾を見抜く', `<p>申込企業の一部は決算書を粉飾しています。粉飾は利益を膨らませますが、<b>現金は嘘をつけない</b>ため、どこかに歪みが出ます。</p>
    <table class="t compact"><tbody>
    <tr><td><b>架空売上</b></td><td>売掛金が売上以上に急増／売上債権回転日数の上昇／利益は黒字なのに営業CFが赤字／税負担率が低い</td><td>売掛先への残高確認、税務申告書の照合</td></tr>
    <tr><td><b>在庫の水増し</b></td><td>棚卸資産回転日数の上昇／粗利率の不自然な改善</td><td>実地調査（棚卸の立会い）</td></tr>
    <tr><td><b>費用の資産計上</b></td><td>仮払金・前払費用など「その他流動資産」の膨張</td><td>勘定科目内訳書の確認、入出金分析</td></tr>
    <tr><td><b>減価償却不足</b></td><td>減価償却率（償却費÷償却資産）の低下</td><td>税務申告書（別表十六）の照合</td></tr>
    <tr><td><b>簿外債務</b></td><td>決算書に表れにくい。支払利息÷借入金が高すぎることも</td><td>信用調査会社、入出金明細の分析</td></tr></tbody></table>
    <p>調査には審査担当の人日を使います。全件を徹底調査はできないので、金額の大きい案件、数字に違和感のある案件に絞りましょう。正直な会社でも、取引条件の変更などで数字が動くことがあります。</p>`],
  ['自己査定と引当', `<p>融資先は毎年決算書を提出します。内容を検証し、<b>債務者区分</b>を決めます。</p>
    <table class="t compact"><tbody><tr><td>正常先</td><td>業況良好</td><td>残高の0.3%</td></tr><tr><td>要注意先</td><td>業況不振、延滞あり、格付8以下</td><td>3%</td></tr><tr><td>要管理先</td><td>返済条件を緩和した先</td><td>15%</td></tr>
    <tr><td>破綻懸念先</td><td>3か月以上延滞、実質債務超過</td><td>担保・保証で保全されない部分の70%</td></tr><tr><td>実質破綻先・破綻先</td><td>法的整理など</td><td>保全されない部分の100%</td></tr></tbody></table>
    <p>区分を甘くすれば引当金が少なく利益は出ますが、<b>金融庁検査</b>や<b>監査法人</b>に見つかると、まとめて追加引当と処分を受けます。承継した貸出の中には、前経営陣が甘く査定した先が紛れています。</p>`],
  ['金利と預金', `<p>預金金利・短期プライムレートは初期設定で市場に連動しています。連動を外して自分で決めることもできます。</p>
    <ul><li>普通預金は金利に鈍感、定期預金は敏感。満期ごとに継続か流出かが決まります。</li><li>短プラを上げると変動金利の貸出すべての利息が増えますが、優良先は他行に借り換え、融資先の返済負担も増えます。</li><li>日銀の利上げ局面では、変動金利の貸出が多い銀行ほど利鞘が改善します。長期の固定金利資産（国債など）は値下がりします。</li></ul>`],
  ['金庫・店舗・システム', `<ul><li><b>金庫</b>：預金が増えると必要な現金も増えます。容量が足りないと年末などにATMが現金切れを起こし信用を失います。</li>
    <li><b>店舗</b>：地区での存在感が増し、預金と融資案件が集まります。開業から約1年半で浸透します。</li>
    <li><b>勘定系システム</b>：口座数が処理能力を超えると障害が頻発し、新規口座も開けません。更改は一括移行（安いが危険）か段階移行（高いが安全）。</li>
    <li><b>審査システム</b>：Lv2の粉飾検知で異常値を自動で指摘、Lv3のAI審査で実態に近い格付を推定します。</li>
    <li><b>デジタル・セキュリティ・マネロン対策</b>：デジタル化で預金を集められますが、守りを固めないと事故と行政処分を招きます。</li></ul>`],
  ['汐見市と開発案件', `<p>${CITY_NAME}は8つの地区からなります。地区の<b>地域活力</b>は、地元企業への融資の伸び、住宅ローン、開発プロジェクト、業界の景況で決まり、人口・事業所数・地価・預金市場を動かします。</p>
    <p>貸し渋れば街はしぼみ、融資先の破綻は失業を生みます。時折持ち込まれる<b>開発プロジェクト</b>はシンジケートローンで資金を集め、必要額に届けば着工、完成すると地区が大きく伸びます。借入の4割以上を出せば主幹事として手数料も得られます。</p>`],
  ['監査と検査', `<ul><li><b>支店の不正</b>：行員による着服や架空経費が起きることがあります。苦情や現金過不足の増加、仮払金・経費の膨張が兆候です。臨時監査で早期に見つければ被害は小さく済みます。</li>
    <li><b>金融庁検査</b>：2〜3年ごと（予告は1か月前）。自己査定の甘さ、管理態勢、マネロン対策、システムの余力を点検されます。重大な問題があれば業務改善命令。</li>
    <li><b>監査法人</b>：毎年の決算で債務者区分と引当金を確認します。</li></ul>`],
  ['決算と株主', `<p>3月末に決算を締め、法人税等を計上し、配当を決めます。6月の株主総会で頭取の再任が諮られ、ROE・配当・株価・不祥事が評価されます。2年続けて株主の支持を失うと解任されます。</p>
    <p>自己資本が足りなければ増資ができます（株主の持分は薄まる）。自己資本比率が4%を下回ると早期是正措置の対象となり、公的資金の注入を申請することもできます。</p>`],
];
MODALS.help = a => {
  const i = a.sec || 0;
  const nav = `<div class="subtabs">${HELP.map(([t], k) => `<button type="button" data-act="helpSec" data-sec="${k}" aria-pressed="${k === i}">${t}</button>`).join('')}</div>`;
  return modalFrame('遊び方', `${nav}<div style="max-width:90ch">${HELP[i][1]}</div>`, (i > 0 ? btn('前へ', 'helpSec', { sec: i - 1 }) : '') + (i < HELP.length - 1 ? btn('次へ', 'helpSec', { sec: i + 1 }, 'primary') : btn('閉じる', 'closeModal', {}, 'primary')), { size: 'wide' });
};
MODALS.intro = () => (G.stage || 0) >= 1 ? modalFrame(`${esc(G.bankName)}へようこそ`, `${scene(STAGE_ART[G.stage], { cls: 'modal-art', alt: '' })}<p>${ymLabel(0)}、${esc(G.ceoName)}頭取の任期が始まりました。${STAGES[G.stage].name}として、まず次のことを確かめましょう。</p>
  <ol><li><b>経営戦略</b>で、全国${G.stage >= 2 ? 'と海外' : ''}の店舗網と維持基準（自己資本比率${fmtPct(reqCR(), 1)}など）を確かめる。</li>
  <li><b>融資審査</b>で、大企業からの大口の申込を審査する。大企業でも粉飾はあります。</li>
  <li>汐見市の小口の申込は、経営戦略の「融資方針・権限」で支店長に任せられます（最初から委譲済み）。</li>
  <li>決裁が済んだら右上の<b>「月末を締めて翌月へ」</b>。</li></ol>
  <p class="note">遊び方はいつでも右上の「遊び方」から読めます。進行はこのブラウザに自動保存されます。</p>`, btn('遊び方を読む', 'helpSec', { sec: 0 }) + btn('始める', 'closeModal', {}, 'primary')) : modalFrame(`${esc(G.bankName)}へようこそ`, `${scene('stage0', { cls: 'modal-art', alt: '' })}<p>${ymLabel(0)}、${esc(G.ceoName)}頭取の任期が始まりました。手始めに次のことをしてみましょう。</p>
  <ol><li><b>融資審査</b>で届いている申込を開き、決算書を読む。気になる点があれば調査を指示し、承認か謝絶を決める。</li>
  <li><b>与信管理</b>で承継した融資先を確認する。「システム判定」より区分が甘い先がないか。気になる先は期中モニタリングの調査で実態を確かめる。</li>
  <li><b>${CITY_NAME}</b>の地図で、どの地区に店舗を出すと良さそうか眺める。</li>
  <li>決裁が済んだら右上の<b>「月末を締めて翌月へ」</b>。</li></ol>
  <p class="note">遊び方はいつでも右上の「遊び方」から読めます。進行はこのブラウザに自動保存されます。</p>`, btn('遊び方を読む', 'helpSec', { sec: 0 }) + btn('始める', 'closeModal', {}, 'primary'));

/* ---------- 開始画面（辞令・カスタムスタート） ---------- */
UI.start = { ceo: '', bank: DEFAULT_BANK, diff: 'normal', preset: 'standard', custom: Object.assign({}, CUSTOM_PRESETS.standard), open: false, seed: '' };
const CUSTOM_FIELDS = [
  ['stage', '開始する業態'], ['capMul', '資本'], ['depMul', '預金の規模'], ['quality', '承継する貸出の質'], ['branches', `${CITY_NAME}の店舗`],
  ['sys', 'システム'], ['econ', '景気'], ['rate', '金利の水準'], ['fraud', '粉飾企業の多さ'], ['term', '任期'],
];
function startStoreInputs() {
  const s = UI.start;
  s.ceo = $('#stCeo')?.value ?? s.ceo;
  s.bank = $('#stBank')?.value ?? s.bank;
  s.seed = $('#stSeed')?.value ?? s.seed;
}
function renderStart() {
  let meta = null;
  try { meta = JSON.parse(lsGet(LS.meta('a')) || 'null'); } catch (e) { meta = null; }
  const s = UI.start, cu = s.custom;
  const st = cu.stage | 0;
  const term = cu.term ? `${['', '', '', '', '', '', '', '', '', '', '十', '', '', '', '', '', '', '', '', '', '二十', '', '', '', '', '', '', '', '', '', '三十'][cu.term] || cu.term}年とする` : '定めない';
  const mission = st === 0 ? `経営破綻した${OLD_UNION}の事業を承継し、${CITY_NAME}の地域経済を支える銀行として健全に成長させること。`
    : st === 1 ? `${CITY_NAME}を発祥とするメガバンク・グループを率い、全国に広がる店舗網と大企業との取引を通じて、日本経済を支えること。`
      : `世界に拠点を持つテラバンクを率い、国内外の預金と貸出、為替と各国の危機を乗りこなし、グループを健全に成長させること。`;
  const presets = Object.entries(CUSTOM_PRESETS).map(([k, P]) => `<button type="button" class="preset${s.preset === k ? ' on' : ''}" data-act="stPreset" data-v="${k}" aria-pressed="${s.preset === k}"><b>${P.name}</b><span>${esc(P.desc)}</span></button>`).join('')
    + `<button type="button" class="preset${s.preset === 'custom' ? ' on' : ''}" data-act="stOpen" aria-pressed="${s.preset === 'custom'}"><b>カスタム</b><span>開始の条件を一つずつ決める。</span></button>`;
  const fields = CUSTOM_FIELDS.map(([k, label]) => `<label class="field"><span>${label}</span><select data-ch="stCustom" data-k="${k}">${CUSTOM_OPTS[k].map(([v, l]) => `<option value="${v}"${String(cu[k]) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`).join('');
  return `${scene('hero', { cls: 'hero', alt: '夜明けの港町と、時計塔のある銀行の本店' })}<div class="appoint${artSrc('hero') ? ' with-hero' : ''}">
    <h1>辞令</h1><div class="gametitle">頭取 ― 銀行経営シミュレーション</div>
    <div class="body-text"><label><input type="text" id="stCeo" value="${esc(s.ceo)}" placeholder="氏名" maxlength="12" aria-label="あなたの氏名"></label>　殿<br>
    貴殿を <label><input type="text" id="stBank" value="${esc(s.bank)}" maxlength="14" aria-label="銀行の名前" style="width:10em"></label> の代表取締役頭取に任命する。<br>
    ${mission}<br>
    任期は${warekiYear(START_YEAR)}${START_MONTH}月から${term}。</div>
    <div class="issuer">${warekiYear(START_YEAR)}${START_MONTH}月1日<br>取締役会</div>
    <div class="opts"><div class="field"><span>難易度</span><div class="seg" role="radiogroup">${Object.entries(DIFFICULTY).map(([k, d]) => `<button type="button" data-act="stDiff" data-v="${k}" aria-pressed="${s.diff === k}">${d.name}</button>`).join('')}</div>
    <span class="small muted">${{ easy: '金融危機が起きにくく、資本に余裕がある。', normal: '標準的な難しさ。', hard: '景気の波が荒く、金融庁も厳しい。資本が薄い。' }[s.diff]}</span></div>
    <div class="field"><span>始め方</span><div class="presets">${presets}</div></div>
    ${s.open || s.preset === 'custom' ? `<div class="custom-grid">${fields}<label class="field"><span>シード（同じ数字なら同じ展開）</span><input type="text" id="stSeed" value="${esc(s.seed)}" placeholder="空欄でランダム" inputmode="numeric" style="width:10em"></label></div>` : `<button type="button" class="linkish small" data-act="stOpen">条件を細かく決める</button>`}</div>
    <div class="start">${btn('就任する', 'startGame', {}, 'primary')}${meta && !meta.over ? btn(`続きから（${esc(meta.bank)}・${ymLabel(meta.m)}）`, 'loadAuto') : ''}${btn('ファイルから読み込む', 'importSave')}${btn('遊び方', 'help')}</div>
  </div>`;
}
Object.assign(ACTIONS, {
  stDiff: d => { startStoreInputs(); UI.start.diff = d.v; render(); },
  stPreset: d => { startStoreInputs(); UI.start.preset = d.v; UI.start.custom = Object.assign({}, CUSTOM_PRESETS[d.v]); render(); },
  stOpen: () => { startStoreInputs(); UI.start.open = true; UI.start.preset = 'custom'; render(); },
  startGame: () => {
    startStoreInputs();
    const s = UI.start;
    const ceo = (s.ceo || '').trim() || '汐見 太郎';
    let bank = (s.bank || '').trim() || DEFAULT_BANK;
    if (!/銀行$|グループ$|フィナンシャル/.test(bank)) bank += '銀行';
    const seedN = parseInt(String(s.seed).replace(/[^0-9]/g, ''), 10);
    const opts = { ceoName: ceo, bankName: bank, difficulty: s.diff };
    if (Number.isFinite(seedN)) opts.seed = seedN;
    if (s.preset !== 'standard' || s.open) opts.custom = Object.assign({}, s.custom);
    newGame(opts);
    UI.tab = 'dash'; UI.appId = null; UI.netSel = null; UI.netView = G.stage >= 2 ? 'ovs' : 'nat';
    render();
    autosave();
    showModal('intro');
  },
});
Object.assign(CHANGES, {
  stCustom: el => {
    startStoreInputs();
    const k = el.dataset.k;
    const opt = CUSTOM_OPTS[k].find(([v]) => String(v) === el.value);
    UI.start.custom[k] = opt ? opt[0] : el.value;
    UI.start.preset = 'custom';
    render();
  },
});
