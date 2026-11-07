'use strict';
/* =========================================================
 *  29h_kaisha_hr_ui.js : 「方針と人事」の画面
 *   経営方針・重点実施事項・目標（KPI）・福利厚生と手当・従業員満足度と賃金・障害者雇用・年間の予定と法改正
 * ========================================================= */

KS_TABS.splice(KS_TABS.findIndex(t => t[0] === 'k_ops') + 1, 0, ['k_hr', '方針と人事']);
Object.assign(UI, { kHrSec: 'policy', kPri: null, kGoals: null, kWfCat: '手当' });

KS_SCREENS.k_hr = () => {
  if (!G.hr) return '<div class="empty">方針と人事の情報がありません</div>';
  const sec = UI.kHrSec || 'policy';
  const subs = [['policy', '方針と目標'], ['wf', '福利厚生と手当'], ['people', '満足度と賃金'], ['cal', '年間の予定']];
  const body = sec === 'policy' ? ksHrPolicyHtml() : sec === 'wf' ? ksHrWfHtml() : sec === 'people' ? ksHrPeopleHtml() : ksHrCalHtml();
  return `<h1 class="h1">方針と人事</h1><p class="lead">会社の方針と、その年に力を入れること、目指す数字を決めます。福利厚生と手当は、社員の満足と採用・定着に効き、費用は決算書の人件費や福利厚生費に表れます。</p>
    <div class="subtabs" role="tablist">${subs.map(([k, l]) => `<button type="button" data-act="kHrSec" data-v="${k}" aria-pressed="${sec === k}">${l}</button>`).join('')}</div>${body}`;
};
ACTIONS.kHrSec = d => { UI.kHrSec = d.v; render(); };
const KS_EFF_N = { demand: '需要', quit: '離職', acc: '労災', shrink: 'ロス', food: '食中毒', leak: '漏えい', energy: '電気代', fuel: '燃料費', hire: '採用の費用', bcp: '災害の被害', viol: '不祥事', ot: '残業', ipo: '株価' };
function ksEffStr(eff) {
  if (!eff) return '';
  return Object.entries(eff).map(([k, v]) => { const d = (v - 1) * 100; return `${KS_EFF_N[k] || k} ${d >= 0 ? '+' : '−'}${fmtNum(Math.abs(d), Math.abs(d) < 1 ? 1 : 0)}%`; }).join('・');
}
function ksPolCostStr(P) {
  const out = [];
  if (P.costR) out.push(`売上の${fmtNum(P.costR * 100, 2)}%（${KS_ACCT[P.acct || 'fees'].n}）`);
  if (P.costH) out.push(`1人月${fmtNum(P.costH, 0)}円（${KS_ACCT[P.acct || 'fees'].n}）`);
  return out.join('・');
}

/* ---------- 方針と目標 ---------- */
function ksHrPolicyHtml() {
  const H = G.hr, fy = fyOf(G.m);
  const creeds = KS_CREEDS.map(C => `<button type="button" class="pcard${H.creed === C.id ? ' on' : ''}" data-act="kCreed" data-v="${C.id}" aria-pressed="${H.creed === C.id}"><b>${esc(C.n)}</b><span class="small">${esc(C.d)}</span><span class="small muted">${[ksEffStr(C.eff), C.es ? `満足度 ${C.es > 0 ? '+' : '−'}${Math.abs(C.es)}` : '', C.bank ? '銀行の評価 ＋' : '', ksPolCostStr(C)].filter(Boolean).join('・') || '費用なし'}</span></button>`).join('');
  const sel = UI.kPri && UI.kPri.fy === fy && UI.kPri.g === G ? UI.kPri.list : (H.pri.fy === fy ? H.pri.list.slice() : []);
  UI.kPri = { fy, list: sel, g: G };
  const pris = KS_PRIS.map(P => {
    const on = sel.includes(P.id), active = H.pri.fy === fy && H.pri.list.includes(P.id);
    return `<label class="pcheck${on ? ' on' : ''}"><input type="checkbox" data-ch="kPriChk" value="${P.id}" ${on ? 'checked' : ''} ${!on && sel.length >= 3 ? 'disabled' : ''}><span><span class="pt"><b>${esc(P.n)}</b>${active ? '<span class="tag ok">実施中</span>' : ''}</span><span class="small">${esc(P.d)}</span><span class="small muted">${[ksEffStr(P.eff), P.es ? `満足度 ${P.es > 0 ? '+' : '−'}${Math.abs(P.es)}` : '', P.rebate ? `仕入の${P.rebate * 100}%の割戻し` : '', P.bank ? '銀行の評価 ＋' : '', ksPolCostStr(P)].filter(Boolean).join('・')}</span></span></label>`;
  }).join('');
  const changed = JSON.stringify(sel.slice().sort()) !== JSON.stringify((H.pri.fy === fy ? H.pri.list : []).slice().sort());
  // 目標
  const gl = UI.kGoals && UI.kGoals.fy === fy && UI.kGoals.g === G ? UI.kGoals.list : H.goals.list.map(x => Object.assign({}, x));
  UI.kGoals = { fy, list: gl, g: G };
  const fmtG = (k, v) => { const D = KS_GOALS[k]; return D.u === 'yen' ? fmtYen(v) : D.u === '%' ? fmtPct(v, 1) : D.u === 'g' ? `${fmtNum(v, 0)}` : `${fmtNum(v, D.u === 'h' || D.u === 'pt' ? 0 : 0)}${D.u === '件' ? '件' : D.u === 'h' ? '時間' : '点'}`; };
  const cur = k => { const ytd = ksYTD(); const s = ksLastBankFS(); switch (k) { case 'sales': return `今期の累計 ${fmtYen(ytd.sales)}`; case 'ord': return `今期の累計 ${fmtYen(ytd.ord)}`; case 'ordm': return ytd.sales ? `今期 ${fmtPct(ytd.ord / ytd.sales * 100, 1)}` : ''; case 'eqr': return s && s.TA ? `直近 ${fmtPct(s.EQ / s.TA * 100, 1)}` : ''; case 'grade': return `今 ${G.grade}`; case 'acc': return `今期 ${G.law ? G.law.acc.filter(a => fyOf(a.m) === fy && (a.days >= 4 || a.sev === 'death')).length : 0}件`; case 'ot': return `今 ${fmtNum(G.law ? G.law.otNow ?? 0 : 0, 0)}時間`; case 'es': return `今 ${fmtNum(H.es, 0)}点`; case 'viol': return `今期 ${G.law ? sum(G.law.insp.filter(x => fyOf(x.m) === fy), x => x.finds.length) : 0}件`; case 'cash': return `今 ${fmtYen(ksB('cash'))}`; default: return ''; } };
  const goalRows = gl.map((x, i) => { const D = KS_GOALS[x.k]; const unitDiv = D.u === 'yen' ? 1e4 : 1; return `<tr><td><b>${esc(D.n)}</b><div class="small muted">${D.up ? '以上' : '以下'}をめざす・${esc(cur(x.k))}</div></td><td class="n"><input type="number" step="${D.u === 'yen' ? 100 : D.u === '%' ? 0.5 : 1}" value="${D.u === 'yen' ? Math.round(x.v / unitDiv) : x.v}" data-ch="kGoalV" data-i="${i}" style="width:110px" aria-label="${esc(D.n)}の目標">${D.u === 'yen' ? '<span class="small">万円</span>' : ''}</td><td>${btn('外す', 'kGoalDel', { i }, 'sm ghost')}</td></tr>`; }).join('');
  const addOpts = Object.entries(KS_GOALS).filter(([k]) => !gl.some(x => x.k === k)).map(([k, D]) => `<option value="${k}">${esc(D.n)}</option>`).join('');
  const hist = H.goalsHist.slice(0, 4).map(h => `<tr><td>${ksFyLabel(h.fy)}</td><td>${h.res.map(r => `${esc(KS_GOALS[r.k].n)} ${r.ok ? tag('達成', 'ok') : tag('未達', 'bad')}<span class="small muted">（目標 ${fmtG(r.k, r.v)}・実績 ${fmtG(r.k, r.a)}）</span>`).join('<br>')}</td><td class="small">${(h.pri || []).map(id => esc((KS_PRI_BY[id] || {}).n || '')).join('・')}</td></tr>`).join('');
  return `${panel('経営方針（経営理念）', `<p class="small" style="margin:0 0 6px">会社がいちばん大切にすること。日々の判断の基準になり、社員の働き方とお客さまの評価に表れます。いつでも変えられますが、効果は少しずつ表れます。</p><div class="pcards">${creeds}</div>`)}
    <div class="grid g2" style="margin-top:10px">
    ${panel(`${ksFyLabel(fy)}の重点実施事項（3つまで）`, `<div class="pchecks">${pris}</div><div class="row" style="margin-top:6px">${btn(changed ? '重点実施事項を決める' : '決めてあります', 'kPriSet', {}, changed ? 'primary' : '', { disabled: !changed })}<span class="small muted">${sel.length}/3</span></div><p class="note">年度ごとに決めます（4月に新しい年度の分を決めます）。賃上げは決めたときに給与を3%引き上げ、元に戻りません。</p>`)}
    ${panel(`${ksFyLabel(fy)}の目標`, `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>項目</th><th class="n">目標</th><th></th></tr></thead><tbody>${goalRows || '<tr><td colspan="3" class="muted">目標がありません</td></tr>'}</tbody></table></div>
      ${gl.length < 5 && addOpts ? `<div class="row" style="margin-top:6px"><select data-ch="kGoalAdd" aria-label="目標を加える"><option value="">目標を加える…</option>${addOpts}</select></div>` : ''}
      <div class="row" style="margin-top:6px">${btn('目標を決める', 'kGoalSet', {}, 'primary')}</div><p class="note">3月末の決算で振り返ります。半分以上を達成すると、社員の満足度が上がり、銀行の評価（取引の関係）もよくなります。</p>
      ${hist ? `<h3 class="fsh">これまでの振り返り</h3><div class="tbl-wrap"><table class="t compact"><tbody>${hist}</tbody></table></div>` : ''}`)}</div>`;
}
ACTIONS.kCreed = d => { if (ksHrSetCreed(d.v)) { toast(`経営方針を「${KS_CREED_BY[d.v].n}」にしました`); render(); autosave(); } };
CHANGES.kPriChk = el => { const L = UI.kPri.list; if (el.checked) { if (!L.includes(el.value) && L.length < 3) L.push(el.value); } else UI.kPri.list = L.filter(x => x !== el.value); render(); };
ACTIONS.kPriSet = () => { ksHrSetPris(UI.kPri.list); toast('重点実施事項を決めました'); ksNews(`${ksFyLabel(fyOf(G.m))}の重点実施事項：${UI.kPri.list.map(id => KS_PRI_BY[id].n).join('・')}`, 'info'); render(); autosave(); };
CHANGES.kGoalV = el => { const x = UI.kGoals.list[+el.dataset.i]; if (!x) return; const v = parseFloat(el.value); if (!isFinite(v)) return; x.v = KS_GOALS[x.k].u === 'yen' ? Math.round(v) * 1e4 : v; };
CHANGES.kGoalAdd = el => {
  const k = el.value;
  if (!k) return;
  const def = { sales: () => ksAnnualSales() * 1.03, ord: () => Math.max(1e6, (ksLastFY() || { pl: { ord: 1e7 } }).pl.ord * 1.05), ordm: () => 5, eqr: () => 30, grade: () => Math.max(1, (G.grade || 6) - 1), acc: () => 0, ot: () => 20, es: () => Math.min(90, Math.round(G.hr.es + 5)), viol: () => 0, cash: () => ksB('cash') * 1.1 }[k];
  let v = def ? def() : 0;
  if (KS_GOALS[k].u === 'yen') v = Math.round(v / 1e6) * 1e6;
  UI.kGoals.list.push({ k, v: Math.round(v * 10) / 10 });
  render();
};
ACTIONS.kGoalDel = d => { UI.kGoals.list.splice(+d.i, 1); render(); };
ACTIONS.kGoalSet = () => { ksHrSetGoals(UI.kGoals.list); toast('目標を決めました'); render(); autosave(); };

/* ---------- 福利厚生と手当 ---------- */
function ksHrWfHtml() {
  const H = G.hr;
  const cat = UI.kWfCat || '手当';
  const cats = KS_WF_CATS.map(c => `<button type="button" data-act="kWfCat" data-v="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join('');
  const rows = KS_WF.filter(W => W.cat === cat).map(W => {
    const lv = ksWfLv(W.id), base = (H.wfBase || {})[W.id] || 0;
    const avail = ksWfAvail(W);
    const ctl = W.base ? '<span class="tag ok">基本の制度（給与・経費に含まれている）</span>'
      : !avail ? '<span class="small muted">この会社では対象外</span>'
      : `<div class="seg wrap" role="radiogroup">${W.lvs.map((l, i) => `<button type="button" data-act="kWfSet" data-id="${W.id}" data-v="${i}" aria-pressed="${lv === i}">${esc(l)}${i === base && i ? '（就任の時）' : ''}</button>`).join('')}</div>`;
    const cost = W.base || !avail ? '' : `<div class="small">会社の費用 月${fmtYen(ksWfCostMonth(W, lv))}${lv !== base ? `<span class="muted">（就任の時より ${ksWfCostMonth(W, lv) >= ksWfCostMonth(W, base) ? '+' : '−'}${fmtYen(Math.abs(ksWfCostMonth(W, lv) - ksWfCostMonth(W, base)))}）</span>` : ''}・${esc(KS_ACCT[ksWfAcct(W, Math.max(1, lv))].n)}${ksWfAcct(W, Math.max(1, lv)) === 'salary' ? '（課税される手当。社会保険料の会社負担も増える）' : ''}</div>`;
    const eff = !W.base && W.es ? `<div class="small muted">満足度 ＋${W.es[Math.max(1, lv)] || W.es[1]}${W.eff ? `・${Object.entries(W.eff).map(([k, a]) => `${KS_EFF_N[k]} ${Math.round((a[Math.max(1, lv)] - 1) * 100)}%`).join('・')}` : ''}</div>` : '';
    return `<tr><td><b>${esc(W.n)}</b><div class="small">${esc(W.d)}</div>${cost}${eff}</td><td>${ctl}<details class="small" style="margin-top:4px"><summary>税金の扱い（従業員の所得税）</summary><p style="margin:4px 0 0">${esc(W.tax)}</p></details></td></tr>`;
  }).join('');
  const extra = ksWfExtraMonth();
  const tot = sum(KS_WF.filter(W => !W.base), W => ksWfCostMonth(W));
  const head = Math.max(1, ksHeadcount());
  return `<div class="grid g-side"><div>${panel('福利厚生と手当', `<div class="subtabs sm" role="tablist">${cats}</div><div class="tbl-wrap"><table class="t"><tbody>${rows}</tbody></table></div>`)}</div>
    <div class="stack">${panel('費用と効果', kv([['制度の費用（会社全体）', `月${fmtYen(tot)}（1人あたり${fmtYen(tot / head)}）`], ['就任の時より増えた分', `<b>${extra >= 0 ? '+' : '−'}${fmtYen(Math.abs(extra))}</b>／月`], ['従業員満足度', `${fmtNum(H.es, 0)}点`], ['参考：大企業の法定外福利費', '1人あたり月2.5万円ほど（経団連の調査・2018年度）。中小企業では数千円〜1万円']]) + '<p class="note">課税される手当（住宅手当・家族手当など）は給料手当・労務費として記帳し、社会保険料（会社の負担は約15%）も増えます。非課税の制度（食事補助・社宅・企業型DCなど）は福利厚生費。社員の手取りが同じでも、非課税の制度のほうが社員の得は大きくなります。就任の時の制度の費用は、もとの経費に含まれています。</p>')}
    ${panel('制度を選ぶときの見方', `<ul class="small" style="margin:0;padding-left:1.2em"><li>若手の採用と定着：借上社宅・住宅手当・食事補助</li><li>子育て・介護の世代：企業主導型保育所・育児休業の上乗せ・介護の支援</li><li>長く勤めてもらう：企業型DC・中退共・永年勤続の表彰</li><li>技能を高める：資格手当・資格取得の支援・研修</li><li>出張の多い仕事（卸売・建設・専門サービス）：出張手当と旅費規程</li></ul>`)}</div></div>`;
}
ACTIONS.kWfCat = d => { UI.kWfCat = d.v; render(); };
ACTIONS.kWfSet = d => { if (ksHrSetWf(d.id, +d.v)) { toast(`${KS_WF_BY[d.id].n}を「${KS_WF_BY[d.id].lvs[+d.v]}」にしました`); render(); autosave(); } };

/* ---------- 満足度と賃金 ---------- */
function ksHrPeopleHtml() {
  const H = G.hr, fy = fyOf(G.m);
  const parts = ksHrEsParts();
  const t = ksHrEsTarget();
  const bar = v => `<div class="esbar" role="img" aria-label="従業員満足度 ${fmtNum(v, 0)}点"><span style="width:${clamp(v, 0, 100)}%"></span></div>`;
  const pRows = parts.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="n ${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${fmtNum(v, 1)}</td></tr>`).join('');
  const f = k => { const v = ksHrF(null, k); const d = (v - 1) * 100; return `${d >= 0 ? '+' : '−'}${fmtNum(Math.abs(d), 0)}%`; };
  const raised = H.raiseFy === fy;
  const raise = [[1, '1%'], [2, '2%'], [3, '3%'], [5, '5%']].map(([v, l]) => btn(l, 'kRaise', { v }, 'sm', { disabled: raised })).join('');
  const bonus = [[0.7, '少なめ（0.7倍）'], [1, '標準'], [1.3, '多め（1.3倍）']].map(([v, l]) => `<button type="button" data-act="kBonusLv" data-v="${v}" aria-pressed="${Math.abs((G.bonusLv ?? 1) - v) < 0.01}">${l}</button>`).join('');
  const need = ksHrDisNeed();
  const dis = need > 0 || H.dis > 0 ? panel(term('障害者雇用', 'shogaiKoyo'), `${kv([['法定雇用率', `${(ksHrDisRate() * 100).toFixed(1)}%（常用の労働者37.5人以上）`], ['雇う必要のある人数', `${need}人`], ['いま雇っている人数', `<b class="${H.dis < need ? 'neg' : ''}">${H.dis}人</b>`], ksHeadcount() > 100 ? ['納付金・調整金', H.dis < need ? `足りない ${need - H.dis}人 × 月5万円 ＝ 年${fmtYen((need - H.dis) * 60e4)}（5月に納付）` : H.dis > need ? `超えた ${H.dis - need}人 × 月2.9万円の調整金` : 'なし'] : ['納付金', '100人以下の会社は対象外']])}
    <div class="row" style="margin-top:6px">${btn('障害のある人を1人採用する（約50万円）', 'kDisHire', {}, H.dis < need ? 'sm primary' : 'sm')}</div><p class="note">仕事の切り出しとジョブコーチなどの支援（1人月1万円）で、職場に定着してもらいます。雇用率が低いままだと、ハローワークの指導 → 雇入れ計画の作成命令 → 企業名の公表と進みます。</p>`) : '';
  return `<div class="grid g2">${panel('従業員満足度', `<div class="esnum"><b>${fmtNum(H.es, 0)}</b><span>点（100点満点）</span></div>${bar(H.es)}<p class="small muted" style="margin:4px 0 8px">いまの制度と職場で、満足度は${fmtNum(t, 0)}点に向かって少しずつ動きます。${H.esHist.length > 1 ? `直近：${H.esHist.slice(-6).map(v => fmtNum(v, 0)).join('→')}` : ''}</p>
    <div class="tbl-wrap"><table class="t compact"><tbody><tr><td>基準</td><td class="n">50</td></tr>${pRows}</tbody></table></div>
    <p class="note">効果：離職 ${f('quit')}・労災 ${f('acc')}・採用の費用 ${f('hire')}・ロスとミス ${f('shrink')}（基準の50点と比べて）。お店・施設・会員の事業では、お客さまの満足（需要）にも表れます。</p>`)}
    ${panel('賃金と賞与', `${kv([['給与の水準', `就任の時の${fmtNum((G.wageLv || 1) * 100, 1)}%`], ['毎月の人件費', fmtYen(ksPayrollEstimate().total)], ['今年度の賃上げ', raised ? `済み（${H.raisePct}%）` : 'まだ']])}
      <div class="field" style="margin-top:6px"><span>賃上げ（ベースアップ。年1回）</span><div class="row" style="gap:4px">${raise}</div><span class="small muted">全員の給与が上がり、毎月の人件費（労務費・給料手当・法定福利費）が増えます。満足度が上がり、採用もしやすくなります。物価と最低賃金が上がる年は、賃上げがないと満足度が下がりやすくなります。</span></div>
      <div class="field"><span>賞与（夏・冬）の水準</span><div class="seg" role="radiogroup">${bonus}</div><span class="small muted">次の賞与（6月・12月）から。賞与の月は人件費の支払いが大きくなります。</span></div>`)}</div>
    ${dis ? `<div class="grid g2" style="margin-top:10px">${dis}</div>` : ''}`;
}
ACTIONS.kRaise = d => {
  const H = G.hr;
  if (H.raiseFy === fyOf(G.m)) return;
  const r = +d.v;
  confirmBox(`給与を${r}%引き上げる`, `全員の給与を${r}%引き上げます。毎月の人件費が約${fmtYen(ksPayrollEstimate().total * r / 100)}増えます（元に戻すと満足度が大きく下がります）。`, '引き上げる', 'kRaiseGo', { v: r });
};
ACTIONS.kRaiseGo = d => { const r = +d.v; G.wageLv = +((G.wageLv || 1) * (1 + r / 100)).toFixed(4); G.hr.raiseFy = fyOf(G.m); G.hr.raisePct = r; ksNews(`給与を${r}%引き上げました（ベースアップ）`, 'good'); closeModal(true); render(); autosave(); };
ACTIONS.kBonusLv = d => { G.bonusLv = +d.v; render(); autosave(); };
ACTIONS.kDisHire = () => { const c = ksHrHireDis(1); toast(`障害のある人を採用しました（${fmtYen(c)}）`); render(); autosave(); };

/* ---------- 年間の予定 ---------- */
function ksHrCalHtml() {
  const cal = ksCalendar(G.m, 12);
  const items = cal.map(x => `<li><b>${ymLabel(x.m)}</b><ul>${x.items.map(i => `<li class="${i.kind}">${i.kind === 'over' ? tag('期限切れ', 'bad') + ' ' : i.kind === 'due' ? tag('期限', 'warn') + ' ' : i.kind === 'law' ? tag('法改正', 'brass') + ' ' : ''}${esc(i.t.replace(/^【法改正】|^期限：/, ''))}</li>`).join('')}</ul></li>`).join('');
  return `<div class="grid g-side"><div>${panel('これからの12か月', `<ol class="cal">${items}</ol>`)}</div><div class="stack">${ksLawTLHtml(true)}</div></div>`;
}
/* 法改正の年表（法令の画面にも出す） */
function ksLawTLHtml(full) {
  const past = KS_LAW_TL.filter(x => x.m <= G.m && x.m > G.m - 18 && !x.cal);
  const next = KS_LAW_TL.filter(x => x.m > G.m && !x.cal).slice(0, full ? 8 : 4);
  const li = x => `<li><b>${ymLabel(x.m)}</b>　${esc(x.t)}<div class="small muted">${esc(x.d)}</div></li>`;
  const fx = typeof ksForeignCountries === 'function' ? KS_LAW_TL_FOREIGN.filter(x => ksForeignCountries().includes(x.cc)) : [];
  return panel('法改正（最近とこれから）', `${past.length ? `<h3 class="fsh">最近の改正</h3><ul class="tl">${past.slice().reverse().map(li).join('')}</ul>` : ''}${next.length ? `<h3 class="fsh">これからの改正</h3><ul class="tl">${next.map(li).join('')}</ul>` : ''}${fx.length ? `<h3 class="fsh">進出先の国</h3><ul class="tl">${fx.map(li).join('')}</ul>` : ''}<p class="note">日付は2026年11月時点で公表されている法令・予定による。これからの改正は、政令や国会の審議で変わることがあります。</p>`);
}

/* ---------- 用語 ---------- */
Object.assign(TERMS, {
  es: { n: '従業員満足度', c: 'law', s: '社員が会社と仕事にどれだけ満足しているか（このゲームでは100点満点）。', b: '給与・賞与・福利厚生・残業・職場の安全・会社の方針で動きます。高いほど離職と労災が減り、採用の費用が下がり、お客さまへの対応もよくなります。', see: [] },
  agm: { n: '定時株主総会', c: 'law', s: '毎年の決算の後に開く株主の会議。', b: '計算書類の承認・剰余金の配当・役員の選任などを決めます。3月決算の会社は6月に開くのが一般的です。', see: [] },
  kessanKokoku: { n: '決算公告', c: 'law', s: '株式会社が決算の内容を公に知らせる義務。', b: '官報・日刊新聞・電子公告のどれかで、貸借対照表（大会社は損益計算書も）を公告します。怠ると100万円以下の過料です。', see: [] },
  yakuinTouki: { n: '役員の変更登記', c: 'law', s: '役員が変わったら（再任も）2週間以内に登記する。', b: '取締役の任期は原則2年（非公開会社は定款で10年まで）。怠ると過料、12年登記がないとみなし解散になります。', see: [] },
  bigCompany: { n: '大会社', c: 'law', s: '資本金5億円以上または負債200億円以上の株式会社。', b: '会計監査人（監査法人）の監査と、取締役会での内部統制システムの決定が義務になります。', see: [] },
  nencho: { n: '年末調整', c: 'law', s: '1年間の給与の所得税を12月に精算すること。', b: '毎月の給与から天引きした所得税（源泉徴収）は概算なので、扶養や保険料の控除を反映して過不足を精算します。', see: [] },
  shokyakuShisan: { n: '償却資産の申告', c: 'law', s: '1月1日に持つ事業用の機械・備品を市町村に申告する。', b: '固定資産税（標準1.4%）は土地・建物に加え、機械や備品（償却資産）にもかかります。課税標準150万円未満は課税されません。', see: [] },
  denchou: { n: '電子帳簿保存法', c: 'law', s: '帳簿や取引の書類をデータで保存するための法律。', b: '2024年1月から、電子で受け取った請求書などは、データのまま検索できるように保存する義務があります。', see: [] },
  santei: { n: '算定基礎届', c: 'law', s: '社会保険料の基準（標準報酬月額）を毎年決めなおす届け。', b: '4〜6月の給与（通勤手当などの手当を含む）の平均で、9月からの保険料が決まります。', see: [] },
  shahoKakudai: { n: '社会保険の適用拡大', c: 'law', s: 'パート・アルバイトが社会保険に入る会社の範囲を広げる改正。', b: '週20時間以上働く人が対象です。会社の規模の基準は51人以上から、2027年10月に36人以上、2029年10月に21人以上、2032年10月に11人以上と下がり、2035年10月に撤廃されます。会社の保険料の負担（約15%）が増えます。', see: [] },
  harassment: { n: 'ハラスメントの防止', c: 'law', s: 'パワハラ・セクハラ・カスハラを防ぐ会社の義務。', b: '方針の周知・相談窓口・事後の対応が義務です。2026年10月から、お客さまからの著しい迷惑行為（カスタマーハラスメント）への対策も義務になりました。', see: [] },
  ikukyu: { n: '育児・介護休業法', c: 'law', s: '育児・介護と仕事を両立させるための法律。', b: '2025年の改正で、子の看護等休暇の拡大、柔軟な働き方の措置、介護の個別の意向確認、300人超の会社の男性育休の取得率の公表などが加わりました。', see: [] },
  joseiKatsuyaku: { n: '女性活躍推進法', c: 'law', s: '女性の活躍の行動計画と情報公表の法律。', b: '常時101人以上の会社は、行動計画の届出と、男女の賃金の差異・女性管理職の比率（2026年4月から）などの公表が義務です。', see: [] },
  shogaiKoyo: { n: '障害者雇用率', c: 'law', s: '会社が雇う障害のある人の割合の基準（民間2.7%）。', b: '2026年7月から2.7%（常用の労働者37.5人以上の会社）。100人超の会社は、足りない人数1人あたり月5万円の納付金を納め、超えて雇うと調整金を受け取ります。', see: [] },
  koureisha: { n: '高年齢者雇用安定法', c: 'law', s: '65歳までの雇用の確保（70歳までは努力義務）。', b: '定年の引き上げ・継続雇用制度・定年の廃止のどれかで、65歳まで働けるようにします。', see: [] },
  stressCheck: { n: 'ストレスチェック', c: 'law', s: '年1回、社員の心の負担を調べる制度。', b: '常時50人以上の事業場の義務（50人未満は2028年4月から）。高ストレスの人が希望すれば医師の面接指導を受けさせます。', see: [] },
  heatStroke: { n: '熱中症の対策の義務', c: 'law', s: '暑い環境で働く現場の体制・手順・周知の義務（2025年6月から）。', b: 'WBGT28度以上などで働かせるときは、熱中症の人を見つけて報告する体制と、応急の手順を決めて周知します。', see: [] },
  toriteki: { n: '取適法（中小受託取引適正化法）', c: 'law', s: '下請法を改正した、中小の取引先との取引のルール（2026年1月から）。', b: '発注の書面、60日以内の支払い、手形の禁止、価格の協議に応じる義務、一方的な価格の決定の禁止などを定めます。違反すると勧告と公表。', see: [] },
  freelance: { n: 'フリーランス法', c: 'law', s: '個人に仕事を頼むときのルール（2024年11月から）。', b: '条件の明示・60日以内の支払い・募集情報の的確な表示・ハラスメントの相談体制・中途解除の予告などを定めます。', see: [] },
  kouekiTsuho: { n: '公益通報者保護法', c: 'law', s: '内部通報をした人を守る法律。', b: '300人超の会社は内部通報の体制の整備が義務。2026年12月から、通報を理由とする解雇・懲戒に刑事罰が科されます。', see: [] },
  keihyo: { n: '景品表示法', c: 'law', s: '広告の表示と景品のルール。', b: '実際よりよく見せる表示や、広告と分からない広告（ステルスマーケティング）を禁止し、違反には措置命令と売上の3%の課徴金があります。', see: [] },
  manifest: { n: '産業廃棄物管理票（マニフェスト）', c: 'law', s: '産業廃棄物の処理を最後まで確かめる伝票。', b: '処理を委託するたびに交付し、返ってきた票で処理を確かめ、毎年6月30日までに交付の状況を報告します。', see: [] },
  shoene: { n: '省エネ法', c: 'law', s: 'エネルギーを多く使う会社の報告と計画の義務。', b: '年1,500kl（原油換算）以上使う特定事業者は、毎年7月末までに定期報告書と中長期計画書を出します。', see: [] },
  kojoRicchi: { n: '工場立地法', c: 'law', s: '大きな工場の配置（緑地など）のルール。', b: '敷地9,000㎡以上または建築面積3,000㎡以上の工場は、着工の90日前までに届け出て、緑地（敷地の20%以上）を確保します。', see: [] },
  foreignLaw: { n: '海外の法令', c: 'law', s: '進出した国の法律（贈収賄・個人データ・労働・外資規制など）。', b: '米国のFCPA、英国の贈収賄法、EUのGDPR、中国の個人情報保護法と反スパイ法、タイの外国人事業法など、国ごとに守るべき法律があります。違反すると、売上に比例する大きな制裁金が科されることがあります。', see: [] },
});
