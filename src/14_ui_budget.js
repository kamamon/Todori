'use strict';
/* =========================================================
 *  14_ui_budget.js : 銀行の「予算と実績」画面（決算・財務のタブ）
 * ========================================================= */

function budgetPreview(bud) {
  return `<table class="t compact"><tbody>${BUDGET_LINES.map(([k, name, tk, cls]) => `<tr class="${cls === 'grand' ? 'total' : ''}"><td>${term(name, tk)}</td><td class="n">${fmtYen(bud.lines[k])}</td></tr>`).join('')}
    <tr><td>当期純利益（税引後の目安）</td><td class="n">${fmtYen(bud.lines.ordinary * 0.7)}</td></tr></tbody></table>`;
}

function budgetForm(bud) {
  const t = bud.t, b = bud.base;
  const field = (k, label, help, step) => `<label class="field"><span>${label}</span><span class="row"><input type="number" step="${step}" value="${t[k]}" data-in="budT" data-k="${k}" style="width:90px"><span class="unit">%</span></span><span class="small muted">${help}</span></label>`;
  return panel(`第${bud.fy + 1}期の予算案を決める`, `<div class="grid g2" style="gap:16px"><div class="stack" style="gap:10px">
      <p class="small" style="margin:0">${b.from === 'last' ? '前期の実績' : '開業時の見込み'}をもとに予算案を作りました。目標を変えると、右の予算が計算し直されます。4月末までに決めない場合は、この案のまま決まります。</p>
      ${field('gL', '貸出金の伸び（年間）', `前期末 ${fmtYen(b.loans)} → 期末目標 <b id="budLoansEnd">${fmtYen(bud.loansEnd)}</b>。伸ばすと資金利益が増えます。`, 0.5)}
      ${field('gD', '預金の伸び（年間）', `前期末 ${fmtYen(b.dep)} → 期末目標 <b id="budDepEnd">${fmtYen(bud.depEnd)}</b>。`, 0.5)}
      ${field('gOpex', '経費の増減', `前期 ${fmtYen(b.opex)}。店舗やシステムを増やす年は大きくなります。`, 0.5)}
      ${field('creditRate', '与信関係費用（貸出金に対する割合）', '貸倒れに備える費用の見積もり。景気が悪い年は多めに。', 0.05)}
      <div>${btn('この予算で決定する', 'budApprove', {}, 'primary')}</div></div>
    <div><div class="small muted" style="margin-bottom:4px">予算（年間）</div><div id="budPreview">${budgetPreview(bud)}</div>
    <p class="note">${term('予算', 'budget')}は「目標」であると同時に、経営の約束です。高すぎる目標は無理な融資を生み、低すぎる目標は株主に評価されません。前期の予算を達成できたかは株主総会の評価にも影響します。</p></div></div>`, { cls: 'budget-form' });
}

function budgetScreen() {
  const bud = G.budget;
  if (!bud) return '<div class="empty">予算はまだありません</div>';
  const va = budgetVsActual(bud);
  const st = bud.status === 'draft' ? tag('予算案', 'warn') : bud.status === 'auto' ? tag('決定（案のまま）') : tag('決定済み', 'ok');
  const ach = lastBudgetAchievement();
  let html = `<div class="row between" style="margin-bottom:10px"><h3 style="margin:0;font-size:15px">第${bud.fy + 1}期（${fyYearLabel(bud.fy)}）の予算 ${st}</h3>${ach ? `<span class="small">前期の予算達成率（経常利益）<b class="num ${ach.rate < 100 ? 'neg' : 'pos'}">${fmtPct(ach.rate, 1)}</b></span>` : ''}</div>`;
  if (bud.status === 'draft') html += budgetForm(bud);
  // 予実表
  const pctCell = r => {
    if (!va.n || !isFinite(r.rate) || r.cum <= 0 || r.a < 0) return '―';
    return fmtPct(r.rate, 1);
  };
  /* 差異は「利益への影響」の向きで表示する（収益が多い・費用が少ない＝＋） */
  const diffCell = r => {
    if (!va.n) return '<td>―</td>';
    if (Math.abs(r.diff) < 5e5) return '<td class="muted">0</td>';
    return `<td class="${r.fav ? 'pos' : 'neg'}">${r.fav ? '+' : '△'}${fmtM(Math.abs(r.diff))}</td>`;
  };
  const rows = va.rows.map(r => `<tr class="${r.cls === 'grand' ? 'grand' : r.cls === 'sum' ? 'sum' : ''}"><td>${term(r.name, r.tk)}</td><td>${fmtM(r.year)}</td><td>${va.n ? fmtM(r.cum) : '―'}</td><td class="${r.a < 0 && !r.cost ? 'neg' : ''}">${va.n ? fmtM(r.a) : '―'}</td>
    ${diffCell(r)}<td>${pctCell(r)}</td><td>${fmtM(r.outlook)}</td></tr>`).join('');
  const loanPlan = bud.base.loans + (bud.loansEnd - bud.base.loans) * va.n / 12;
  const depPlan = bud.base.dep + (bud.depEnd - bud.base.dep) * va.n / 12;
  const bal = (name, tk, end, plan, now) => `<tr><td>${term(name, tk)}</td><td>${fmtM(end)}</td><td>${fmtM(plan)}</td><td>${fmtM(now)}</td><td class="${now >= plan ? 'pos' : 'neg'}">${now >= plan ? '+' : '△'}${fmtM(Math.abs(now - plan))}</td><td>${fmtPct(now / Math.max(1, plan) * 100, 1)}</td><td>―</td></tr>`;
  html += `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（単位：百万円）</th><th>年間予算</th><th>予算（${va.n ? `4月〜${ymOf(fyOf(G.m) * 12 + va.n - 1).mo}月` : '未経過'}）</th><th>実績</th><th>差異</th><th>予算比</th><th>年間見通し</th></tr></thead><tbody>
    ${rows}<tr class="head"><td colspan="7">残高（期末の目標と、今月末の計画・実績）</td></tr>
    ${bal('貸出金残高', 'bankLoans', bud.loansEnd, loanPlan, B('loans'))}${bal('預金残高', 'bankDep', bud.depEnd, depPlan, deposits())}</tbody></table></div>
    <p class="note">差異の「＋」は利益を増やす方向（収益が予算より多い、費用が予算より少ない）の場合に緑で、「△」は利益を減らす方向の場合に赤で表示します。年間見通し＝実績＋残りの月の予算。</p>`;
  const cm = budgetComments(bud, va);
  if (cm.length) html += `<div class="callout" style="margin-top:10px"><b>予実のポイント</b><ul style="margin:6px 0 0;padding-left:1.2em">${cm.map(c => `<li>${c}</li>`).join('')}</ul></div>`;
  // 経常利益の累計グラフ
  if (va.n) {
    const labels = [], plan = [], act = [];
    let cp = 0, ca = 0;
    for (let i = 0; i < 12; i++) {
      const m = bud.fy * 12 + i;
      labels.push(`${ymOf(m).mo}月`);
      cp += budgetMonth(bud, 'ordinary', i);
      plan.push(cp);
      const h = G.hist.find(x => x.m === m);
      if (h) { ca += plSummary(h.pl).ordinary; act.push(ca); } else act.push(null);
    }
    html += `<div class="grid g2" style="margin-top:12px">${panel('経常利益の累計（予算と実績）', lineChart({ labels, height: 190, series: [{ name: '予算', color: 's2', values: plan, dash: true }, { name: '実績', color: 's1', values: act }] }))}
      ${panel('予算の立て方', `<ol class="small" style="margin:0;padding-left:1.3em;display:grid;gap:4px"><li>前期の実績から出発する（${term('業務粗利益', 'bankGross')}・${term('経費', 'ohr')}・${term('与信関係費用', 'creditCost')}）。</li><li>貸出金と預金をどれだけ伸ばすかを決める。${term('利ざや', 'spread')}が変わらなければ、貸出金の伸びがそのまま資金利益の伸びになります。</li><li>店舗・人員・システムの計画から経費を見積もる。6月と12月は賞与で経費が増えます。</li><li>景気を見て、貸倒れに備える費用を見積もる。</li><li>毎月の実績と比べ、差の原因を調べる（${term('予実管理', 'yojitsu')}）。</li></ol>`)}</div>`;
  }
  html += `<p class="note" style="margin-top:10px">${term('予実管理', 'yojitsu')}は、予算と実績の差を毎月確かめ、原因を調べて手を打つことです。銀行では貸出の残高と利ざや、経費、与信関係費用の4つが利益を大きく左右します。</p>`;
  return html;
}

Object.assign(ACTIONS, {
  budApprove: () => { approveBudget(false); toast('今期の予算を決定しました'); render(); },
});
INPUTS.budT = el => {
  const bud = G.budget;
  if (!bud || bud.status !== 'draft') return;
  const t = Object.assign({}, bud.t, { [el.dataset.k]: parseFloat(el.value) });
  if (!isFinite(t[el.dataset.k])) return;
  setBudgetTargets(t);
  const p = $('#budPreview');
  if (p) p.innerHTML = budgetPreview(G.budget);
  const le = $('#budLoansEnd'), de = $('#budDepEnd');
  if (le) le.textContent = fmtYen(G.budget.loansEnd);
  if (de) de.textContent = fmtYen(G.budget.depEnd);
  scheduleSave();
};
