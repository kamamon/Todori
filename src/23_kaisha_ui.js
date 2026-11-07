'use strict';
/* =========================================================
 *  23_kaisha_ui.js : 会社経営モード（借りる側）の画面
 *   骨組み（見出し・指標・タブ）、社長室、資金と銀行、決算書、帳簿、予算と実績、学ぶ、ニュース、
 *   月次報告・融資の申込・繰上返済・就任・倒産・任期満了のモーダル、保存と読み込み、開始画面
 *   （現場の画面は 24_kaisha_ops.js、決算整理は 25_kaisha_close.js）
 * ========================================================= */

const KS_TABS = [
  ['k_dash', '社長室'], ['k_ops', '現場'], ['k_grow', '成長'], ['k_bank', '資金と銀行'], ['k_fs', '決算書'],
  ['k_books', '帳簿'], ['k_budget', '予算と実績'], ['k_learn', '学ぶ'], ['k_news', 'ニュース'],
];
const KS_SCREENS = {};
Object.assign(UI, { kFy: null, kFsView: 'pl', coFsView: 'pl', kBooks: 'journal', kJm: null, kAcct: 'cash', kLoan: null, kCapex: null });
const LSK = { auto: 'toudori.k1.auto', slot: i => `toudori.k1.slot${i}`, meta: i => `toudori.k1.meta${i}` };
const KS_CITY = CITY_NAME.replace(/市$/, '');
function isK() { return !!(G && G.mode === 'kaisha'); }
/* いちばん大きい事業 */
function ksBigUnit() { const us = ksActiveUnits(); let b = us[0], mx = -1; for (const u of us) { const v = ksUnitSales12(u); if (v > mx) { mx = v; b = u; } } return b; }
/* 会社の顔：アイコン・業種の大分類・事業の説明・銀行が比べる業界の平均 */
function ksCo() {
  const u = ksBigUnit();
  const S = u ? ksS(u) : null;
  const us = ksActiveUnits();
  return { icon: S ? S.icon : '社', name: us.length > 1 ? `${us.length}つの事業` : S ? KS_SECTORS[S.sec].n : '', label: ksCompanyDesc(us), avg: ksAvgInd() };
}
/* 銀行が比べる業界の平均（事業が複数なら、売上の大きさで重みづけした平均） */
function ksAvgInd() {
  const us = ksActiveUnits();
  const bms = [...new Set(us.map(u => ksS(u).bm))].filter(b => IND[b]);
  if (bms.length <= 1) return bms[0] || 'mfg';
  const w = us.map(u => Math.max(1, ksUnitSales12(u)));
  const W = sum(w, x => x) || 1;
  const o = { id: 'ksco', name: `複合（${bms.map(b => IND[b].name).join('・')}）` };
  for (const k of ['gm', 'opm', 'ar', 'inv', 'ap', 'ppe', 'dep', 'beta', 'trend', 'spe', 're', 'size']) o[k] = sum(us, (u, i) => (IND[ksS(u).bm] || IND.mfg)[k] * w[i]) / W;
  IND.ksco = o;
  return 'ksco';
}
function ksSeal(ch) {
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3.5" y="3.5" width="33" height="33" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="8" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/><text x="20" y="25.5" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" style="font-family:var(--f-doc)">${esc(ch)}</text></svg>`;
}
const ksNum = v => `<span class="num${v < 0 ? ' neg' : ''}">${fmtYen(v)}</span>`;
function ksLastBankFS() { const ys = ksBankYears(2); return ys.length ? ys[ys.length - 1] : null; }
function ksEqRatioNow() { const s = ksLastBankFS(); return s && s.TA ? s.EQ / s.TA * 100 : NaN; }
function ksGradeText(g) {
  if (!g) return '';
  if (g <= 2) return '最上位の評価。金利は低く、担保がなくても大きく借りられます。';
  if (g <= 4) return '健全な会社という評価。希望どおりの条件で借りやすい状態です。';
  if (g <= 6) return '普通の評価。借りられますが、金利は少し高めです。';
  if (g === 7) return '業績に不安があるという評価（要注意先）。新しい借入は慎重に審査されます。';
  if (g === 8) return '要注意先。信用保証協会の保証を付ければ借りられる可能性があります。';
  return '破綻の懸念があるという評価。新しい融資はほぼ受けられません。';
}
function ksGradeBadge(g) { return g ? `<span class="grade g${g}" title="銀行の格付 ${g}">${g}</span>` : '<span class="muted">―</span>'; }
function ksBonusEstimate() { return sum(ksActiveUnits(), u => ksS(u).roles.reduce((s, r) => s + (u.staff[r.id] || 0) * ksRoleWage(r, u) * r.bonus / 2 * (G.bonusLv ?? 1), 0)); }
function ksFyOfLast() { const l = ksFYList(); return l.length ? l[l.length - 1] : null; }
function ksSalesName() { return ksLabels().sales || '売上高'; }

/* ---------- 描画（render から呼ばれる） ---------- */
function renderK() {
  const app = $('#app');
  if (!KS_TABS.some(t => t[0] === UI.tab)) UI.tab = 'k_dash';
  const tabsEl = $('.tabs');
  const sl = tabsEl ? tabsEl.scrollLeft : 0;
  app.innerHTML = `${ksMast()}${typeof ksSubBanner === 'function' ? ksSubBanner() : ''}${ksStrip()}<div class="body"><nav class="tabs" aria-label="画面の切り替え">${ksTabsHtml()}</nav><main id="main">${ksScreen()}</main></div>`;
  const t2 = $('.tabs');
  if (t2) t2.scrollLeft = sl;
}
function ksScreen() {
  try { return (KS_SCREENS[UI.tab] || KS_SCREENS.k_dash)(); } catch (err) {
    console.error(err);
    return `<div class="callout bad">画面の表示中にエラーが発生しました：${esc(err.message)}</div>`;
  }
}
function ksMast() {
  const I = ksCo();
  const { y, mo } = ymOf(G.m);
  const fy = fyOf(G.m);
  const label = G.closing ? '決算整理を続ける' : mo === 3 ? '3月末を締めて決算へ' : '月末を締めて翌月へ';
  return `<header class="mast kmast">
    <div class="mast-brand">${ksSeal(I.icon)}<div style="min-width:0"><div class="bank-name"><span class="bn">${esc(G.coName)}</span></div><div class="bank-sub">${G.isSub ? '子会社の社長' : '代表取締役社長'} ${esc(G.ceo)}<span class="hide-m">　${esc(I.label || (G.group && G.group.hd ? `持株会社（子会社${ksSubs().length}社）` : ''))}${G.grow && G.grow.ipo.st === 'listed' ? `・${KS_MARKETS[G.grow.ipo.market].s}上場` : ''}</span></div></div></div>
    <div class="mast-date"><div class="wareki">${warekiLabel(G.m)}</div><div class="sub">${y}年${mo}月　${ksFyLabel(fy)}（${ksFyYear(fy)}）</div></div>
    <div class="mast-actions">${typeof ksGroupMastHtml === 'function' ? ksGroupMastHtml() : ''}<button type="button" class="mbtn" data-act="menu">メニュー</button><button type="button" class="mbtn" data-act="help">遊び方</button>
    <button type="button" class="btn-advance" data-act="advance"${G.over ? ' disabled' : ''}>${label}</button></div>
  </header>`;
}
function ksStrip() {
  const last = G.months[G.months.length - 1];
  const prev = G.months[G.months.length - 2];
  const ytd = ksYTD();
  const eq = ksEqRatioNow();
  const od = ksOD();
  const fc = ksForecast(3);
  const low = Math.min(...fc.map(x => x.bal));
  const short = fc.some(x => x.short);
  const cashD = prev ? ksB('cash') - prev.cash : 0;
  const cells = [
    ['現預金', fmtYen(ksB('cash')), prev ? `<span class="muted">先月末比 </span>${deltaTxt(cashD)}` : ''],
    ['借入金', fmtYen(ksDebt()), od && od.limit ? `<span class="muted">当座貸越の空き ${fmtYen(Math.max(0, od.limit - od.bal))}</span>` : '<span class="muted">当座貸越なし</span>'],
    [`今期の${ksSalesName()}`, fmtYen(ytd.sales), `<span class="muted">${ksFyLabel(fyOf(G.m))}・${ytd.n}か月（月次）</span>`],
    ['今期の経常利益', `<span class="${ytd.ord < 0 ? 'neg' : ''}">${fmtYen(ytd.ord)}</span>`, `<span class="muted">月次の累計</span>`],
    ['自己資本比率', isFinite(eq) ? `<span class="${eq < 10 ? 'neg' : ''}">${fmtPct(eq, 1)}</span>` : '―', `<span class="muted">直近の決算</span>`],
    ['銀行の格付', `${G.grade || '―'}<span class="unit"> /10</span>`, `<span class="muted">${G.grade <= 3 ? '優良' : G.grade <= 6 ? '正常' : G.grade <= 8 ? '要注意' : '破綻懸念'}</span>`],
    !ksActiveUnits().length && G.group && G.group.hq ? ['本社の社員', `${G.group.hq.staff}<span class="unit">人</span>`, `<span class="muted">持株会社・人件費 月${fmtYen(G.group.hq.staff * G.group.hq.wage)}</span>`] : ['従業員', `${ksHeadcount()}<span class="unit">人</span>`, `<span class="muted">人件費 月${fmtYen(ksPayrollEstimate().total)}</span>`],
    ['資金繰り', short ? '<span class="neg">不足の見込み</span>' : low < ksMonthlyFixedOut() * 0.5 ? '<span class="warnc">注意</span>' : '安全', `<span class="muted">3か月の最低 ${fmtYen(low)}</span>`],
  ];
  void last;
  return `<div class="strip" role="group" aria-label="主要な数字">${cells.map(([k, v, d]) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('')}</div>`;
}
function ksTabBadge(id) {
  switch (id) {
    case 'k_dash': { const it = ksInbox(); const n = it.filter(x => x.cls === 'bad' || x.cls === 'warn').length; return n ? `<span class="badge${it.some(x => x.cls === 'bad') ? ' alert' : ''}">${n}</span>` : ''; }
    case 'k_budget': return G.budget && G.budget.status === 'draft' ? '<span class="badge">1</span>' : '';
    case 'k_bank': return ksForecast(3).some(x => x.short) ? '<span class="badge alert">!</span>' : '';
    case 'k_ops': { const n = sum(ksUnitsOf('build'), u => u.op.bids.length); return n ? `<span class="badge">${n}</span>` : ''; }
    default: return '';
  }
}
function ksTabsHtml() {
  return KS_TABS.map(([id, label]) => `<button type="button" class="tab" data-act="tab" data-tab="${id}"${UI.tab === id ? ' aria-current="page"' : ''}><span>${label}</span>${ksTabBadge(id)}</button>`).join('');
}

/* ---------- 社長室 ---------- */
function ksInbox() {
  const out = [];
  if (G.over) return out;
  if (G.closing) out.push({ ico: '決', cls: 'warn', t1: `${ksFyLabel(G.closing.fy)}の決算整理の途中です`, t2: '決算整理を終えると決算書が完成し、4月に進めます', act: btn('決算整理へ', 'kCloseOpen', {}, 'sm primary') });
  if (G.budget && G.budget.status === 'draft') out.push({ ico: '予', t1: `${ksFyLabel(G.budget.fy)}の予算を決める`, t2: '売上の伸び・粗利率・経費の目標を決めます。4月末までに決めなければ案のまま決まります', act: btn('予算へ', 'kGo', { tab: 'k_budget' }, 'sm') });
  const fc = ksForecast(3);
  const sh = fc.find(x => x.short);
  if (sh) {
    out.push({ ico: '資', cls: 'bad', t1: `${ymLabel(sh.m)}末に資金が足りなくなる見込み`, t2: `月末の現預金が${fmtYen(sh.bal)}になる計算です。運転資金を借りるか、支払・在庫・人員を見直しましょう`, act: btn('資金繰り表へ', 'kGo', { tab: 'k_bank' }, 'sm primary') });
    if ((G.grade || 6) >= 7 && ksReschedCheck().ok) out.push({ ico: '猶', cls: 'warn', t1: '新しく借りられないときは、返済条件の変更（リスケ）を相談できます', t2: '1年間、借入金の元金の返済を止めてもらう方法です。資金は楽になりますが、格付は要管理先（8）になり、その間は新しい融資を受けられません', act: btn('相談する', 'kResched', {}, 'sm') });
  }
  else {
    const low = Math.min(...fc.map(x => x.bal));
    if (low < ksMonthlyFixedOut() * 0.5) out.push({ ico: '資', cls: 'warn', t1: '手元の資金が薄くなっています', t2: `3か月以内に現預金が${fmtYen(low)}まで減る見込みです（毎月の決まった支払は約${fmtYen(ksMonthlyFixedOut())}）`, act: btn('資金繰り表へ', 'kGo', { tab: 'k_bank' }, 'sm') });
  }
  for (const L of G.loans) {
    if (L.repay !== 'bullet' || L.bal <= 0 || L.matM < G.m || L.matM - G.m > 1) continue;
    out.push({ ico: '期', cls: 'warn', t1: `${KS_BANKS[L.bank].short}の短期借入金 ${fmtYen(L.bal)} が${ymLabel(L.matM)}末に期日`, t2: L.roll ? '格付が基準内なら折り返し（同じ額を借り直し）できます。格付が下がっていると一括返済を求められます' : '一括で返済します。資金を確保しておきましょう', act: btn('借入金を見る', 'kGo', { tab: 'k_bank' }, 'sm') });
  }
  const mo = calMonth(G.m);
  if (mo === 5 && ksB('taxPay') > 0) out.push({ ico: '税', t1: `今月末に法人税等 ${fmtYen(ksB('taxPay'))} を納めます`, t2: '前期の決算で計上した未払法人税等（負債）を払います。費用は前期に計上済みなので、今期の利益は減りません', act: '' });
  if (mo === 6 || mo === 12) out.push({ ico: '賞', t1: '今月は賞与（ボーナス）を支払います', t2: `賞与の目安 ${fmtYen(ksBonusEstimate())}。人件費の支払が増え、現預金が減ります`, act: '' });
  if (ksFraudActive()) out.push({ ico: '粉', cls: 'bad', t1: '粉飾が発覚し、銀行の新しい融資が止まっています', t2: `${ymLabel(G.flags.fraudFoundM + 36)}まで格付は最低のままです。正しい決算を続けて信頼を取り戻しましょう`, act: '' });
  if ((G.supTrust ?? 3) < 3) out.push({ ico: '仕', cls: 'warn', t1: `仕入先に支払を待ってもらえるのは、あと${G.supTrust}回`, t2: '資金が足りず支払を延ばすたびに仕入先の信用が下がります。毎年4月に1回分戻ります', act: '' });
  if (typeof ksOpsAlerts === 'function') out.push(...ksOpsAlerts());
  return out;
}
function ksInboxHtml(items) {
  if (!items.length) return '<div class="empty">急ぎの用事はありません。現場の数字を見て、月末を締めましょう。</div>';
  return `<ul class="inbox">${items.map(x => `<li><span class="ico ${x.cls || ''}" aria-hidden="true">${x.ico}</span><div><div class="t1">${x.t1}</div><div class="t2">${x.t2}</div></div><div class="row">${x.act || ''}</div></li>`).join('')}</ul>`;
}
/* 月次損益の表（予算との比較つき） */
const KS_MG_ROWS = [
  ['sales', null, 'sales', 'sum', 'sales'], ['cogs', '売上原価', 'cogs', '', 'cogs'], ['gp', '売上総利益', 'gp', 'sum', 'gp'],
  ['people', '人件費（役員・販売・事務）', 'salary', '', 'people'], ['rent', '地代家賃', 'rent', '', 'rent'], ['depS', '減価償却費（月割の見込み）', 'dep', '', 'dep'],
  ['sgaOther', 'その他の販管費', 'sga', '', 'other'], ['opi', '営業利益', 'opi', 'sum', 'opi'], ['nonop', '営業外損益（利息など）', 'interest', '', 'nonop'], ['ord', '経常利益', 'ord', 'grand', 'ord'],
];
function ksMgVal(mg, k) { return k === 'nonop' ? mg.noi - mg.noe : mg[k]; }
function ksMgTable(mg, m) {
  const bud = G.budget && G.budget.fy === fyOf(m) ? G.budget : G.budgetLast && G.budgetLast.fy === fyOf(m) ? G.budgetLast : null;
  const i = ksMonthIndex(m);
  const rows = KS_MG_ROWS.map(([k, name, tk, cls, bk]) => {
    const v = ksMgVal(mg, k);
    const b = bud ? ksBudgetMonth(bud, bk, i) : null;
    const cost = ['cogs', 'people', 'rent', 'depS', 'sgaOther'].includes(k);
    const d = b === null ? null : v - b;
    const fav = d === null ? true : cost ? d <= 0 : d >= 0;
    return `<tr class="${cls}"><td>${term(esc(name || ksSalesName()), tk)}</td><td class="${v < 0 && !cost ? 'neg' : ''}">${fmtK(v)}</td>${bud ? `<td class="muted">${fmtK(b)}</td><td class="${Math.abs(d) < 5e4 ? 'muted' : fav ? 'pos' : 'neg'}">${Math.abs(d) < 5e4 ? '0' : (fav ? '+' : '△') + fmtK(Math.abs(d))}</td>` : ''}</tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（千円）</th><th>実績</th>${bud ? '<th>予算</th><th>差異</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
KS_SCREENS.k_dash = () => {
  const I = ksCo();
  const last = G.months[G.months.length - 1];
  const inbox = ksInbox();
  const ms = G.months.slice(-12);
  const labels = ms.map(x => `${ymOf(x.m).mo}月`);
  const charts = ms.length >= 2 ? `<div class="grid g2">${panel(`${ksSalesName()}（月次）`, lineChart({ labels, height: 170, series: [{ name: ksSalesName(), color: 's2', values: ms.map(x => x.mg.sales) }] }))}${panel('経常利益（月次）', barChart({ labels, values: ms.map(x => x.mg.ord), name: '経常利益', height: 170 }))}</div>` : '';
  const lastFS = ksLastFY();
  const g = G.grade;
  const prof = kv([
    ['事業', `${esc(I.label)}${ksActiveUnits().length > 1 ? `（${ksActiveUnits().length}事業）` : `（${esc(I.name)}）`}`],
    ['創業', `${G.founded}年（${ksFyLabel(fyOf(G.m))}）`],
    ['資本金', fmtYen(ksB('capital'))],
    ['従業員', !ksActiveUnits().length ? (G.group && G.group.hq ? `本社 ${fmtNum(G.group.hq.staff, 0)}人（持株会社）` : '0人') : `${fmtNum(ksHeadcount(), 0)}人（${ksActiveUnits().length > 1 ? ksActiveUnits().map(u => `${esc(ksUName(u))} ${fmtNum(ksUnitHead(u), 0)}人`).join('・') : ksS(ksMainUnit()).roles.map(r => `${r.n.replace(/（.*?）/, '')} ${fmtNum(ksMainUnit().staff[r.id] || 0, 0)}人`).join('・')}）`],
    ['取引銀行', [...new Set(G.loans.filter(L => L.bal > 0 || L.kind === 'od').map(L => KS_BANKS[L.bank].short))].join('・') || 'なし'],
    lastFS ? ['直近の決算', `${ksFyLabel(lastFS.fy)}　${ksSalesName()} ${fmtYen(lastFS.pl.sales)}・当期純利益 ${ksNum(lastFS.pl.ni)}`] : null,
  ]);
  const news = G.news.slice(0, 7);
  const newsHtml = news.length ? `<ul class="newslist">${news.map(n => `<li class="${n.k === 'bad' ? 'bad' : n.k === 'good' ? 'good' : ''}"><span class="when">${ymOf(n.m).mo}月</span><span class="what">${esc(n.t)}</span></li>`).join('')}</ul>` : '<div class="empty">まだ出来事はありません</div>';
  const lastHtml = last ? `${ksMgTable(last.mg, last.m)}<p class="note">月次決算は毎月の損益の速報です。減価償却費は月割の見込み、在庫は帳簿の数字で計算しています。正式な数字は3月末の決算整理で確定します。</p>` : '<div class="empty">まだ締めた月はありません</div>';
  return `<div class="row between" style="align-items:flex-end;margin-bottom:12px"><div><h1 class="h1">社長室</h1><p class="lead" style="margin:0">${esc(G.coName)}は${G.founded}年創業、${esc(I.label)}の会社。${G.closing ? '決算整理の途中です。' : calMonth(G.m) === 3 ? '今月末で今期が終わり、決算になります。' : `今期の決算（3月末）まであと${(15 - calMonth(G.m)) % 12 + 1}か月です。`}</p></div>${btn('この業種のお金の流れ', 'kGo', { tab: 'k_learn' }, 'ghost sm')}</div>
  <div class="grid g-side"><div class="stack">
    ${panel('今月やること', ksInboxHtml(inbox), { flush: true, aside: `${ymLabel(G.m)}` })}
    ${panel(last ? `${ymLabel(last.m)}の月次決算` : '月次決算', lastHtml, { aside: last ? btn('月次推移', 'kGoFs', { v: 'month' }, 'ghost sm') : '' })}
    ${charts}
  </div><div class="stack">
    ${panel('銀行の格付', `<div class="row" style="gap:14px;align-items:center"><div class="gradebig">${g || '―'}</div><div class="small">${ksGradeText(g)}${G.gradeHist.length > 1 ? `<br><span class="muted">格付の推移：${G.gradeHist.slice(-5).map(x => x.g).join(' → ')}</span>` : ''}</div></div><div class="row" style="margin-top:10px">${btn('銀行から見た決算書', 'kGo', { tab: 'k_bank', sec: 'view' }, 'sm')}${btn('融資を申し込む', 'kLoanNew', {}, 'sm')}</div>`)}
    ${panel('会社の概要', prof)}
    ${panel('最近の出来事', newsHtml, { flush: true, aside: btn('すべて', 'tab', { tab: 'k_news' }, 'ghost sm') })}
  </div></div>`;
};

/* ---------- 資金と銀行 ---------- */
function ksCfTable() {
  const act = G.months.slice(-4);
  const fc = ksForecast(3);
  const heads = act.map(x => `<th>${ymOf(x.m).mo}月<span class="small muted">実績</span></th>`).join('') + fc.map(x => `<th class="fc">${ymOf(x.m).mo}月<span class="small muted">予定</span></th>`).join('');
  const cols = act.map(x => {
    const net = sum(Object.values(x.cf));
    return { r: x.cf, begin: x.cash - net, end: x.cash, net, fc: false };
  });
  let begin = ksB('cash');
  for (const f of fc) { cols.push({ r: f.r, begin, end: f.bal, net: f.net, fc: true, short: f.short }); begin = f.bal; }
  const cell = (c, v) => `<td class="${c.fc ? 'fc' : ''}${v < 0 ? ' neg' : ''}">${v ? fmtK(v) : '―'}</td>`;
  let body = `<tr class="sum"><td>月初の現預金</td>${cols.map(c => `<td class="${c.fc ? 'fc' : ''}">${fmtK(c.begin)}</td>`).join('')}</tr>`;
  for (const [k, name, sign] of KS_CF_ROWS) {
    if (sign === null) { body += `<tr class="head"><td colspan="${cols.length + 1}">${name}</td></tr>`; continue; }
    body += `<tr class="i1"><td>${name}</td>${cols.map(c => cell(c, c.r[k] || 0)).join('')}</tr>`;
  }
  body += `<tr class="sum"><td>収支</td>${cols.map(c => cell(c, c.net)).join('')}</tr>`;
  body += `<tr class="grand"><td>月末の現預金</td>${cols.map(c => `<td class="${c.fc ? 'fc' : ''}${c.end < 0 ? ' neg' : ''}">${fmtK(c.end)}${c.short ? ' ⚠' : ''}</td>`).join('')}</tr>`;
  return `<div class="tbl-wrap"><table class="fs cfplan"><thead><tr><th>（千円）</th>${heads}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function ksLoanKind(L) { return L.kind === 'od' ? '当座貸越' : L.kind === 'tegata' ? '手形貸付' : '証書貸付'; }
function ksLoansTable() {
  const ls = G.loans.filter(L => L.bal > 0 || L.kind === 'od');
  if (!ls.length) return '<div class="empty">借入金はありません（無借金）</div>';
  const rows = ls.map(L => {
    const kind = ksLoanKind(L);
    const repay = L.kind === 'od' ? `枠 ${fmtYen(L.limit || 0)}` : L.repay === 'equal' ? (L.graceUntil > G.m ? `${ymLabel(L.graceUntil)}まで利息のみ` : `毎月 ${fmtYen(L.prin)}`) : `期日に一括${L.roll ? '（折り返し）' : ''}`;
    const until = L.kind === 'od' ? '1年ごとに更新' : ymLabel(L.matM);
    return `<tr><td>${KS_BANKS[L.bank].short}${L.cgc ? ' <span class="tag">保証協会</span>' : ''}${L.emergency ? ' <span class="tag warn">緊急</span>' : ''}</td><td>${term(kind, L.kind === 'od' ? 'overdraft' : L.kind === 'tegata' ? 'tegata' : 'shosho')}<div class="small muted">${L.purpose === 'capex' ? '設備資金' : '運転資金'}・${L.termM > 12 ? '長期' : '短期'}</div></td>
      <td class="n">${fmtYen(L.bal)}</td><td class="n">${fmtNum(L.rate, 2)}%</td><td class="n">${repay}</td><td class="n">${until}</td><td class="n">${L.kind !== 'od' && L.bal > 0 ? btn('繰上返済', 'kRepay', { id: L.id }, 'sm') : ''}</td></tr>`;
  }).join('');
  const intY = sum(G.loans, L => L.bal * L.rate / 100);
  const grace = G.loans.some(L => L.graceUntil > G.m);
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>銀行</th><th>種類</th><th class="n">残高</th><th class="n">金利（年）</th><th class="n">返済</th><th class="n">期日</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">利息は年に約${fmtYen(intY)}（月${fmtYen(intY / 12)}）。${term('短期借入金', 'std')}（1年以内に返す）と${term('長期借入金', 'ltd')}は、貸借対照表で別々に表示されます。元金の返済は費用ではないので、利益は減りませんが現預金は減ります。</p>
    <div class="row" style="margin-top:8px">${grace ? `<span class="tag warn">返済条件を変更中（${ymLabel(Math.max(...G.loans.filter(L => L.graceUntil > G.m).map(L => L.graceUntil)))}まで元金の返済なし）</span>` : btn('返済条件の変更（リスケ）を相談する', 'kResched', {}, 'sm')}</div>`;
}
function ksBankView() {
  const ys = ksBankYears(4);
  if (ys.length < 2) return '<div class="empty">決算が1期分しかないため、比較できません</div>';
  const fys = ksFYList().slice(-(ys.length - 1));
  const heads = fys.map(fy => ksFyLabel(fy));
  const steps = fsGuideSteps(ys, ksAvgInd());
  const view = UI.coFsView || 'pl';
  FS_BIG = false;
  const last = G.fys[fys[fys.length - 1]];
  const note = last && last.bankNote ? `<p class="callout bad">${esc(last.bankNote)}</p>` : '';
  const sub = [['pl', '損益計算書'], ['bs', '貸借対照表'], ['cf', 'キャッシュ・フロー'], ['ratio', '財務分析']];
  return `${note}${UI.settings.learn !== false ? fsGuidePanel(steps, 'co') : ''}
    <div class="subtabs" role="tablist">${sub.map(([k, l]) => `<button type="button" data-act="kCoView" data-v="${k}" aria-pressed="${view === k}">${l}</button>`).join('')}</div>
    ${fsTableOf(ys, view, { ctx: 'co', heads, ind: ksAvgInd() })}
    <p class="note">銀行は決算書を自分の形式に組み替えて分析します（減価償却費は販管費から抜き出し、貸倒引当金は売掛金から差し引く）。格付は、直近3期の自己資本比率・利益率・債務償還年数・利息の支払能力・流動比率・売上の伸び・黒字の期数から点数をつけて決まります。</p>`;
}
KS_SCREENS.k_bank = () => {
  const g = G.grade;
  const od = ksOD();
  const sc = ksGrade();
  const fc = ksForecast(3);
  const sh = fc.find(x => x.short);
  const top = `<div class="grid g3">
    ${panel('銀行の格付', `<div class="row" style="gap:14px;align-items:center"><div class="gradebig">${g || '―'}</div><div class="small">${ksGradeText(g)}<br><span class="muted">財務の点数 ${fmtNum(sc.score, 0)}点／100</span></div></div>`)}
    ${panel('手元の資金', `${kv([['現預金', fmtYen(ksB('cash'))], ['当座貸越', od && od.limit ? `枠 ${fmtYen(od.limit)}・使用 ${fmtYen(od.bal)}` : 'なし（格付6以内で枠が付きます）'], ['毎月の決まった支払', `約${fmtYen(ksMonthlyFixedOut())}`], ['手元資金は月の支払の', `${fmtNum(ksB('cash') / Math.max(1, ksMonthlyFixedOut()), 1)}か月分`]])}`)}
    ${panel('お金を借りる', `<p class="small" style="margin:0 0 8px">運転資金（仕入や給与の支払のつなぎ）や設備資金を、銀行・信用金庫・日本政策金融公庫に申し込めます。審査は直近の決算書で行われます。</p><div class="row">${btn('融資を申し込む', 'kLoanNew', {}, 'primary')}${btn('借入の基本', 'term', { k: 'bankLoans' }, 'ghost sm')}</div>`)}
  </div>`;
  const cf = panel('資金繰り表', `${sh ? `<p class="callout bad" style="margin:0 0 10px">このままだと${ymLabel(sh.m)}末に現預金が${fmtYen(sh.bal)}になります。資金が尽きると仕入先や従業員に払えず、会社は続けられません（黒字でも起こります）。</p>` : ''}${ksCfTable()}
    <p class="note">${term('資金繰り表', 'cashPlan')}は、お金の出入りを月ごとにまとめた表です。損益計算書の「売上」は売った時点で計上しますが、掛け売りの代金が入るのは翌月以降。逆に仕入代金・給料・借入の返済は待ってくれません。予定の3か月は、最近の実績と売掛金・買掛金の期日から見積もっています。</p>`, { aside: '過去4か月の実績と3か月の予定' });
  const loans = panel('借入金', ksLoansTable(), { flush: false });
  const banks = panel('取引のある金融機関', `<table class="t compact"><tbody>${Object.entries(KS_BANKS).map(([k, B]) => {
    const bal = sum(G.loans.filter(L => L.bank === k), L => L.bal);
    return `<tr><td><b>${B.n}</b><div class="small muted">${esc(B.desc)}</div></td><td class="n">${bal ? fmtYen(bal) : '<span class="muted">取引なし</span>'}</td></tr>`;
  }).join('')}<tr><td><b>信用保証協会</b><div class="small muted">銀行の融資を保証してくれる公的な機関。保証料（年0.45〜1.9%）がかかるが、格付8まで借りられ、金利も下がる。保証の上限は${fmtYen(KS_CGC_LIMIT)}。</div></td><td class="n">${fmtYen(sum(G.loans.filter(L => L.cgc), L => L.bal))}</td></tr></tbody></table>`, { flush: true });
  return `<h1 class="h1">資金と銀行</h1><p class="lead">会社はお金が尽きた時に終わります。利益（決算書）とお金（資金繰り）は別物です。銀行はあなたの決算書を読み、格付をつけ、貸すかどうかを決めます。</p>
    ${top}<div class="stack" style="margin-top:16px">${cf}${loans}
    ${panel('銀行から見たあなたの会社', ksBankView(), { id: 'bankview' })}${banks}</div>`;
};

/* ---------- 決算書 ---------- */
function ksPLRows(cur, prev) {
  const rows = [];
  const val = (st, f) => (st ? f(st.pl) : null);
  const R = (label, f, cls = 'i1', tk = '', ded = false) => rows.push({ label, c: val(cur, f), p: val(prev, f), cls, tk, ded });
  const H = (label, cls) => rows.push({ label, head: true, cls });
  const union = key => { const s = new Set(); for (const st of [prev, cur]) if (st) for (const [k] of st.pl[key]) s.add(k); return KS_KEYS.filter(k => s.has(k)); };
  const item = (key, k) => pl => { const e = pl[key].find(x => x[0] === k); return e ? e[1] : 0; };
  const K = (pl, kd) => (pl.cogsK && pl.cogsK[kd]) || null;
  const has = kd => [prev, cur].some(st => st && K(st.pl, kd) && (K(st.pl, kd).total || (kd !== 'svc' && K(st.pl, kd).units.length)));
  const kinds = ['goods', 'food', 'mfg', 'con', 'svc'].filter(has);
  const onlyCon = kinds.length === 1 && kinds[0] === 'con';
  const multi = kinds.length > 1;
  const v = (kd, f) => pl => { const o = K(pl, kd); return o ? Math.round(f(o)) : 0; };
  R(`Ⅰ ${ksSalesName()}`, p => p.sales, 'sum', onlyCon ? 'conRev' : 'sales');
  H(`Ⅱ ${onlyCon ? '完成工事原価' : '売上原価'}`);
  for (const kd of kinds) {
    if (multi) H(`（${KS_COGS_KINDS[kd]}）`, 'subhead');
    if (kd === 'goods' || kd === 'food') {
      const nm = kd === 'food' ? '材料（食材）' : '商品';
      R(`期首${nm}棚卸高`, v(kd, o => o.begin), 'i1', 'begInv');
      R(kd === 'food' ? '当期食材仕入高' : '当期商品仕入高', v(kd, o => o.purch), 'i1', 'purch');
      R('合計', v(kd, o => o.begin + o.purch), 'i2');
      R(`期末${nm}棚卸高`, v(kd, o => -o.end), 'i1', 'endInv', true);
    } else if (kd === 'mfg') {
      R('期首製品棚卸高', v(kd, o => o.begin), 'i1', 'begInv');
      R('当期製品製造原価', v(kd, o => o.mfgCost), 'i1', 'mfgCost');
      R('合計', v(kd, o => o.begin + o.mfgCost), 'i2');
      R('期末製品棚卸高', v(kd, o => -o.end), 'i1', 'endInv', true);
    } else if (kd === 'con') {
      const parts = o => { const mat = Math.round(o.parts.mat || 0), sub = Math.round(o.parts.sub || 0); return { mat, sub, exp: o.conCost - mat - sub + (o.exp || 0), labor: o.labor }; };
      R('材料費', v(kd, o => parts(o).mat), 'i1', 'matCost');
      R('労務費（現場の人の給与）', v(kd, o => parts(o).labor), 'i1', 'labor');
      R('外注費', v(kd, o => parts(o).sub), 'i1', 'subcon');
      R('経費', v(kd, o => parts(o).exp), 'i1', 'mfgOH');
    } else {
      R('労務費（現場の人の給与など）', v(kd, o => (o.labor || 0) + (o.devTransfer || 0)), 'i1', 'labor');
      if ([prev, cur].some(st => st && K(st.pl, kd) && K(st.pl, kd).devTransfer)) R('ソフトウェア仮勘定への振替', v(kd, o => -(o.devTransfer || 0)), 'i1', 'intangible', true);
      if ([prev, cur].some(st => st && K(st.pl, kd) && K(st.pl, kd).subcon)) R('外注費', v(kd, o => o.subcon || 0), 'i1', 'subcon');
      if ([prev, cur].some(st => st && K(st.pl, kd) && K(st.pl, kd).fuel)) R('燃料費', v(kd, o => o.fuel || 0), 'i1', 'fuelCost');
      R(ksLabels().svcExp || '経費（運営・保守・サーバー・使用料など）', v(kd, o => (o.exp || 0) + (o.other || 0)), 'i1', 'svcCost');
      if ([prev, cur].some(st => st && K(st.pl, kd) && K(st.pl, kd).depC)) R('減価償却費', v(kd, o => o.depC || 0), 'i1', 'dep');
    }
    if (multi) R(`${KS_COGS_KINDS[kd]} 計`, v(kd, o => o.total), 'i2');
  }
  R(onlyCon ? '完成工事原価' : '売上原価', p => p.cogs, 'sum', onlyCon ? 'conCost' : 'cogs');
  R(onlyCon ? '完成工事総利益' : '売上総利益', p => p.gp, 'sum', 'gp');
  H('Ⅲ 販売費及び一般管理費');
  for (const k of union('sgaItems')) R(ksAcctName(k), item('sgaItems', k), 'i1', KS_ACCT[k].tk);
  R('販売費及び一般管理費 合計', p => p.sga, 'sum', 'sga');
  R('営業利益', p => p.opi, 'sum', 'opi');
  const nk = union('noiItems');
  if (nk.length) { H('Ⅳ 営業外収益'); for (const k of nk) R(ksAcctName(k), item('noiItems', k), 'i1', KS_ACCT[k].tk); }
  const ek = union('noeItems');
  if (ek.length) { H('Ⅴ 営業外費用'); for (const k of ek) R(ksAcctName(k), item('noeItems', k), 'i1', KS_ACCT[k].tk); }
  R('経常利益', p => p.ord, 'sum', 'ord');
  const gk = union('exgItems'), lk = union('exlItems');
  if (gk.length) { H('Ⅵ 特別利益'); for (const k of gk) R(ksAcctName(k), item('exgItems', k), 'i1', 'extra'); }
  if (lk.length) { H('Ⅶ 特別損失'); for (const k of lk) R(ksAcctName(k), item('exlItems', k), 'i1', 'extra'); }
  R('税引前当期純利益', p => p.pretax, 'sum', 'pretax');
  R('法人税、住民税及び事業税', p => p.tax, 'i1', 'tax');
  R('当期純利益', p => p.ni, 'grand', 'ni');
  return rows;
}
function ksBSRows(cur, prev) {
  const rows = { a: [], l: [] };
  const v = (st, f) => (st ? f(st.bs) : null);
  const add = (side, label, f, cls = 'i1', tk = '', always = false) => {
    const c = v(cur, f), p = v(prev, f);
    if (!always && !c && !p) return;
    rows[side].push({ label, c, p, cls, tk, ded: label === '貸倒引当金' || label === '減価償却累計額' });
  };
  const H = (side, label) => rows[side].push({ label, head: true });
  const nm = k => ksAcctName(k, 'bs');
  const tk = k => KS_ACCT[k].tk;
  const grp = (b, g) => KS_BSK.filter(k => KS_ACCT[k].g === g).reduce((s, k) => s + (KS_ACCT[k].t === 'C' ? -b[k] : b[k]), 0);
  H('a', 'Ⅰ 流動資産');
  for (const k of KS_BSK.filter(k => KS_ACCT[k].g === 'ca')) add('a', nm(k), b => (KS_ACCT[k].t === 'C' ? -b[k] : b[k]), 'i1', tk(k));
  add('a', '流動資産合計', b => grp(b, 'ca'), 'sum', 'ca', true);
  H('a', 'Ⅱ 固定資産');
  for (const k of KS_BSK.filter(k => KS_ACCT[k].g === 'fa')) add('a', nm(k), b => (KS_ACCT[k].t === 'C' ? -b[k] : b[k]), 'i1', tk(k));
  add('a', '有形固定資産合計', b => grp(b, 'fa'), 'sum', 'ppe', true);
  for (const k of KS_BSK.filter(k => KS_ACCT[k].g === 'ia')) add('a', nm(k), b => b[k], 'i1', tk(k));
  add('a', '無形固定資産合計', b => grp(b, 'ia'), 'sum', 'intangible');
  for (const k of KS_BSK.filter(k => KS_ACCT[k].g === 'io')) add('a', nm(k), b => b[k], 'i1', tk(k));
  add('a', '投資その他の資産合計', b => grp(b, 'io'), 'sum', 'invest');
  add('a', '固定資産合計', b => grp(b, 'fa') + grp(b, 'ia') + grp(b, 'io'), 'sum', 'fa', true);
  add('a', '資産合計', b => grp(b, 'ca') + grp(b, 'fa') + grp(b, 'ia') + grp(b, 'io'), 'grand', 'ta', true);
  H('l', 'Ⅰ 流動負債');
  for (const k of KS_BSK.filter(k => KS_ACCT[k].g === 'cl')) add('l', nm(k), b => b[k], 'i1', tk(k));
  add('l', '流動負債合計', b => grp(b, 'cl'), 'sum', 'cl', true);
  H('l', 'Ⅱ 固定負債');
  for (const k of KS_BSK.filter(k => KS_ACCT[k].g === 'ncl')) add('l', nm(k), b => b[k], 'i1', tk(k));
  add('l', '固定負債合計', b => grp(b, 'ncl'), 'sum', 'ncl', true);
  add('l', '負債合計', b => grp(b, 'cl') + grp(b, 'ncl'), 'sum', 'debt', true);
  H('l', '純資産の部');
  add('l', '資本金', b => b.capital, 'i1', 'capital', true);
  add('l', '資本剰余金（資本準備金）', b => b.capSurplus || 0, 'i1', 'capSurplus');
  add('l', '利益準備金', b => b.legalRes || 0, 'i1', 'legalRes');
  add('l', '繰越利益剰余金', b => b.re, 'i1', 're', true);
  add('l', '純資産合計', b => b.capital + (b.capSurplus || 0) + (b.legalRes || 0) + b.re, 'sum', 'eq', true);
  add('l', '負債・純資産合計', b => grp(b, 'cl') + grp(b, 'ncl') + b.capital + (b.capSurplus || 0) + (b.legalRes || 0) + b.re, 'grand', '', true);
  return rows;
}
function ksStmtTable(rows, heads, unitNote = '千円') {
  const body = rows.map(r => {
    if (r.head) return `<tr class="head${r.cls ? ' ' + r.cls : ''}"><td colspan="${heads.length + 1}">${esc(r.label)}</td></tr>`;
    const vals = heads.length === 2 ? [r.p, r.c] : [r.c];
    return `<tr class="${r.cls || ''}"><td>${r.tk ? term(esc(r.label), r.tk) : esc(r.label)}</td>${vals.map(v => `<td class="${v < 0 && !r.ded ? 'neg' : ''}">${v === null || v === undefined ? '―' : fmtK(v)}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（単位：${unitNote}）</th>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function ksCostReport(cur, prev, kind) {
  const rows = [];
  const val = (st, f) => (st ? f(st.pl) : null);
  const R = (label, f, cls = 'i1', tk = '', ded = false) => rows.push({ label, c: val(cur, f), p: val(prev, f), cls, tk, ded });
  const H = label => rows.push({ label, head: true });
  if (kind === 'mfg') {
    const z = { matBegin: 0, matPurch: 0, matEnd: 0, mat: 0, labor: 0, subcon: 0, mfgExp: 0, depC: 0, oh: 0, total: 0, wipBegin: 0, wipEnd: 0, mfgCost: 0 };
    const m = p => p.mfgReport || (p.cogsK && p.cogsK.mfg && p.cogsK.mfg.rep) || z;
    H('Ⅰ 材料費');
    R('期首材料棚卸高', p => m(p).matBegin, 'i1', 'begInv');
    R('当期材料仕入高', p => m(p).matPurch, 'i1', 'purch');
    R('合計', p => m(p).matBegin + m(p).matPurch, 'i2');
    R('期末材料棚卸高', p => -m(p).matEnd, 'i1', 'endInv', true);
    R('当期材料費', p => m(p).mat, 'sum', 'matCost');
    H('Ⅱ 労務費');
    R('労務費（工場の給与・賞与・社会保険料）', p => m(p).labor, 'sum', 'labor');
    H('Ⅲ 経費');
    R('外注加工費', p => m(p).subcon, 'i1', 'subcon');
    R('製造経費（電力料・消耗工具・修理など）', p => m(p).mfgExp, 'i1', 'mfgOH');
    R('減価償却費（工場の機械・建物）', p => m(p).depC, 'i1', 'dep');
    R('経費合計', p => m(p).oh, 'sum', 'mfgOH');
    R('当期総製造費用', p => m(p).total, 'sum', 'mfgCost');
    R('期首仕掛品棚卸高', p => m(p).wipBegin, 'i1', 'wip');
    R('合計', p => m(p).total + m(p).wipBegin, 'i2');
    R('期末仕掛品棚卸高', p => -m(p).wipEnd, 'i1', 'wip', true);
    R('当期製品製造原価', p => m(p).mfgCost, 'grand', 'mfgCost');
    return rows;
  }
  const C = p => (p.cogsK && p.cogsK.con) || { parts: {}, conCost: 0, labor: 0, exp: 0, total: 0 };
  const parts = p => { const d = C(p); const mat = Math.round(d.parts.mat || 0), sub = Math.round(d.parts.sub || 0); return { mat, sub, exp: d.conCost - mat - sub + (d.exp || 0), labor: d.labor }; };
  R('Ⅰ 材料費', p => parts(p).mat, 'i1', 'matCost');
  R('Ⅱ 労務費', p => parts(p).labor, 'i1', 'labor');
  R('Ⅲ 外注費', p => parts(p).sub, 'i1', 'subcon');
  R('Ⅳ 経費', p => parts(p).exp, 'i1', 'mfgOH');
  R('完成工事原価', p => C(p).total, 'grand', 'conCost');
  return rows;
}
/* セグメント情報（事業ごとの損益） */
function ksSegTable(st, prev) {
  const seg = st.pl.seg || [];
  if (!seg.length) return '<div class="empty">この期のセグメント情報はありません</div>';
  const pseg = prev ? prev.pl.seg || [] : [];
  const rows = seg.map(s => {
    const p = pseg.find(x => x.id === s.id);
    const g = p && p.sales > 0 ? s.sales / p.sales - 1 : null;
    return `<tr><td><b>${esc(s.n)}</b>${s.closed ? ' <span class="tag">撤退</span>' : ''}<div class="small muted">${esc(KS_ENG_INFO[s.eng].n)}</div></td><td class="n">${fmtK(s.sales)}${g !== null ? `<div class="small ${g < 0 ? 'neg' : 'muted'}">${g >= 0 ? '+' : '△'}${fmtPct(Math.abs(g) * 100, 1)}</div>` : ''}</td><td class="n">${fmtK(s.gp)}<div class="small muted">${s.sales ? fmtPct(s.gp / s.sales * 100, 1) : '―'}</div></td><td class="n ${s.opi < 0 ? 'neg' : ''}">${fmtK(s.opi)}<div class="small muted">${s.sales ? fmtPct(s.opi / s.sales * 100, 1) : '―'}</div></td><td class="n">${fmtK(s.dep)}</td><td class="n">${fmtK(s.assets)}</td></tr>`;
  }).join('');
  const hq = st.pl.segHQ || { sales: 0, cogs: 0, sga: 0, opi: 0 };
  const tot = { sales: sum(seg, x => x.sales) + hq.sales, opi: sum(seg, x => x.opi) + hq.opi };
  return `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（千円）</th><th>売上高</th><th>売上総利益</th><th>営業利益</th><th>減価償却費</th><th>資産（固定資産）</th></tr></thead><tbody>${rows}
    <tr class="i1"><td>全社（本社の費用：役員報酬・管理部門など）</td><td class="n">${fmtK(hq.sales)}</td><td></td><td class="n neg">${fmtK(hq.opi)}</td><td></td><td></td></tr>
    <tr class="grand"><td>合計（損益計算書と一致）</td><td class="n">${fmtK(tot.sales)}</td><td class="n">${fmtK(st.pl.gp)}</td><td class="n">${fmtK(tot.opi)}</td><td class="n">${fmtK(st.pl.dep)}</td><td></td></tr></tbody></table></div>
    <p class="note">${term('セグメント情報', 'segment')}は、事業ごとの売上と利益です。複数の事業を持つ会社は、どの事業が稼ぎ、どの事業が足を引っ張っているかを示します。本社の費用（役員報酬など）は、どの事業にも配らず「全社」に置いています。</p>`;
}
function ksMonthTable(fy) {
  const ms = G.months.filter(x => fyOf(x.m) === fy);
  if (!ms.length) return '<div class="empty">この期の月次の記録はありません</div>';
  const heads = ms.map(x => `<th>${ymOf(x.m).mo}月</th>`).join('');
  const rows = KS_MG_ROWS.map(([k, name, tk, cls]) => {
    const vals = ms.map(x => ksMgVal(x.mg, k));
    return `<tr class="${cls}"><td>${term(esc(name || ksSalesName()), tk)}</td>${vals.map(v => `<td class="${v < 0 ? 'neg' : ''}">${fmtK(v)}</td>`).join('')}<td><b>${fmtK(sum(vals))}</b></td></tr>`;
  }).join('');
  const st = G.fys[fy];
  const mgOrd = sum(ms, x => x.mg.ord);
  const diff = st ? `<div class="callout" style="margin-top:10px"><b>月次と決算の差</b>：月次の経常利益の合計は ${fmtYen(mgOrd)}、決算の経常利益は ${fmtYen(st.pl.ord)}（差 ${fmtYen(st.pl.ord - mgOrd)}）。差は${term('決算整理', 'closing')}で確定した数字（実地棚卸の減耗、減価償却費の確定、貸倒引当金、未払費用・前払費用）の分です。</div>` : '';
  return `<div class="tbl-wrap"><table class="fs monthly"><thead><tr><th>（千円）</th>${heads}<th>合計</th></tr></thead><tbody>${rows}</tbody></table></div>${diff}
    <p class="note">${term('月次決算', 'monthlyClose')}（管理会計）の数字です。売上原価は在庫の帳簿の動きから、減価償却費は1年分を12で割った見込みで計算しています。</p>`;
}
KS_SCREENS.k_fs = () => {
  const list = ksFYList();
  if (!list.length) return '<div class="empty">決算書はまだありません</div>';
  const view = UI.kFsView || 'pl';
  const curFy = fyOf(G.m);
  const open = !G.fys[curFy] && G.months.some(x => fyOf(x.m) === curFy);
  const selList = view === 'month' && open ? [...list, curFy] : list;
  if (UI.kFy === null || !selList.includes(UI.kFy)) UI.kFy = list[list.length - 1];
  const fy = UI.kFy;
  const cur = G.fys[fy] || null, prev = G.fys[fy - 1] || null;
  const hasK = kd => [cur, prev].some(st => st && st.pl.cogsK && st.pl.cogsK[kd]);
  const views = [['pl', '損益計算書'], ['bs', '貸借対照表']];
  if (hasK('mfg')) views.push(['cost', '製造原価報告書']);
  if (hasK('con')) views.push(['ccost', '完成工事原価報告書']);
  if ([cur, prev].some(st => st && (st.pl.seg || []).length > 1) || ksActiveUnits().length > 1) views.push(['seg', 'セグメント情報']);
  views.push(['month', '月次推移'], ['cf', 'キャッシュ・フロー'], ['ratio', '財務分析'], ['tax', '税金の計算']);
  if ((view === 'cost' && !hasK('mfg')) || (view === 'ccost' && !hasK('con'))) UI.kFsView = 'pl';
  const heads = prev ? [ksFyLabel(fy - 1), ksFyLabel(fy)] : [ksFyLabel(fy)];
  const fySel = `<div class="seg wrap" role="radiogroup" aria-label="決算期">${selList.map(f => `<button type="button" data-act="kFy" data-v="${f}" aria-pressed="${f === fy}">${ksFyLabel(f)}${G.fys[f] ? '' : '（途中）'}</button>`).join('')}</div>`;
  let body = '';
  if (view === 'pl') {
    body = ksStmtTable(ksPLRows(cur, prev), heads) + `<p class="note">${ksFyYear(fy)}（${ymLabel(fy * 12)}〜${ymLabel(fy * 12 + 11)}）。△はマイナス。${hasK('con') ? '工事の事業は工事完成基準なので、この期に完成・引き渡した工事だけが売上（完成工事高）になります。' : ''}${(cur.pl.cogsKinds || []).length > 1 ? '売上原価は、商品・製品・工事・サービスの区分ごとに計算して合計しています。' : ''}</p>`;
  } else if (view === 'bs') {
    const r = ksBSRows(cur, prev);
    body = `<div class="grid g2 bsgrid"><div><h3 class="fsh">資産の部</h3>${ksStmtTable(r.a, heads)}</div><div><h3 class="fsh">負債の部・純資産の部</h3>${ksStmtTable(r.l, heads)}</div></div><p class="note">${ymLabel(fy * 12 + 11)}末（決算日）の残高。左右の合計は必ず一致します（${term('貸借対照表', 'bs')}）。</p>`;
  } else if (view === 'cost') {
    body = ksStmtTable(ksCostReport(cur, prev, 'mfg'), heads) + `<p class="note">${term('製造原価報告書', 'mfgCost')}は、工場で製品を作るのにかかった費用（材料費・労務費・経費）を集計し、作りかけ（仕掛品）の増減を調整して「当期製品製造原価」を出す表です。これが損益計算書の売上原価の計算に入ります。${(cur.pl.cogsKinds || []).length > 1 ? 'ものづくりの事業の分だけを集計しています。' : ''}</p>`;
  } else if (view === 'ccost') {
    body = ksStmtTable(ksCostReport(cur, prev, 'con'), heads) + `<p class="note">完成工事原価報告書は、この期に完成した工事にかかった費用の内訳です。完成していない工事の費用は${term('未成工事支出金', 'wip')}として貸借対照表に残っています（この期の完成工事 ${((cur.pl.cogsK && cur.pl.cogsK.con && cur.pl.cogsK.con.parts.n) || 0)}件）。</p>`;
  } else if (view === 'seg') {
    body = cur ? ksSegTable(cur, prev) : '<div class="empty">この期は決算がまだありません</div>';
  } else if (view === 'month') {
    body = ksMonthTable(fy);
  } else if (view === 'tax') {
    const t = cur.tax || {};
    body = `<table class="t" style="max-width:560px"><tbody>
      <tr><td>税引前当期純利益</td><td class="n">${fmtYen(t.pretax || cur.pl.pretax)}</td></tr>
      ${t.fines ? `<tr><td>${term('罰金及び科料', 'soken')}の加算（税金の計算では費用にならない＝損金不算入）</td><td class="n">+${fmtYen(t.fines)}</td></tr>` : ''}
      <tr><td>繰越欠損金の控除（過去の赤字）</td><td class="n">${t.loss ? MINUS + fmtYen(Math.min(t.loss, Math.max(0, t.pretax))) : '―'}</td></tr>
      <tr class="total"><td>課税所得（このゲームの簡単な計算）</td><td class="n">${fmtYen(t.taxable || 0)}</td></tr>
      <tr><td>所得にかかる税（800万円までは25%、超える部分は34%）</td><td class="n">${fmtYen(t.income || 0)}</td></tr>
      <tr><td>住民税の均等割（赤字でもかかる）</td><td class="n">${fmtYen(t.kintou || 70000)}</td></tr>
      <tr class="grand"><td>${term('法人税、住民税及び事業税', 'tax')}</td><td class="n">${fmtYen(cur.pl.tax)}</td></tr>
      <tr><td>翌期に繰り越す欠損金</td><td class="n">${fmtYen(t.lossAfter || 0)}</td></tr></tbody></table>
      <p class="note">本当の税金の計算では、会計の利益に「税務調整」（交際費の一部や罰金は費用にならない、など）を加えて所得を出します。このゲームでは税引前当期純利益をそのまま所得としています。計上した税金は${term('未払法人税等', 'taxPay')}として負債になり、決算から2か月以内（5月末）に納めます。</p>`;
  } else {
    const ys = ksBankYears(4);
    const fysB = ksFYList().slice(-(ys.length - 1));
    FS_BIG = false;
    body = ys.length >= 2 ? fsTableOf(ys, view, { heads: fysB.map(f => ksFyLabel(f)), ind: ksAvgInd() }) + (view === 'cf' ? `<p class="note">${term('キャッシュ・フロー計算書', 'cf')}（${term('間接法', 'indirect')}）。中小企業は作らなくてよい書類ですが、銀行は貸借対照表の増減からこの形に組み替えて、利益が現金を伴っているかを確かめます。</p>` : '') : '<div class="empty">比較できる決算がありません</div>';
  }
  const hist = fy < fyOf(G.startedM) ? '<p class="small muted" style="margin:0 0 8px">この期は、あなたが社長になる前の決算です（先代の経営）。</p>' : '';
  const qz = cur && cur.quiz && cur.quiz.asked ? `<span class="tag ok">決算整理クイズ ${cur.quiz.correct}/${cur.quiz.asked}問正解</span>` : '';
  const flags = cur ? (cur.fraudInv ? tag('在庫の水増しあり', 'bad') : '') + (cur.depSkip ? tag('減価償却を見送り', 'warn') : '') : '';
  return `<div class="row between" style="align-items:flex-end;margin-bottom:10px"><div><h1 class="h1">決算書</h1><p class="lead" style="margin:0">毎年3月末に決算整理をして作る、会社の成績表です。${esc(G.coName)}の${list.length}期分があります。</p></div>${fySel}</div>
    ${hist}<div class="row" style="margin-bottom:6px;gap:6px">${qz}${flags}</div>
    <div class="subtabs" role="tablist">${views.map(([k, l]) => `<button type="button" data-act="kFsView" data-v="${k}" aria-pressed="${view === k}">${l}</button>`).join('')}</div>
    ${body}
    <div class="callout" style="margin-top:14px"><b>3つの表のつながり</b>：損益計算書の当期純利益は、貸借対照表の繰越利益剰余金を増やします。キャッシュ・フローは、貸借対照表の現預金がなぜ増えたか・減ったかを説明します。${btn('決算書の読み方', 'helpSec', { sec: 2 }, 'sm linkish')}</div>`;
};

/* ---------- 帳簿 ---------- */
function ksEntryLines(e) {
  const dr = [], cr = [];
  if (e.lines) { for (const [k, d, c] of e.lines) { if (d) dr.push([k, d]); if (c) cr.push([k, c]); } } else {
    for (const [k, [d, c]] of Object.entries(e.l)) { if (d) dr.push([k, d]); if (c) cr.push([k, c]); }
  }
  return { dr, cr };
}
function ksJournalTable(entries, opt = {}) {
  if (!entries.length) return '<div class="empty">仕訳はありません</div>';
  let td = 0, tc = 0;
  const body = entries.map(e => {
    const { dr, cr } = ksEntryLines(e);
    const n = Math.max(dr.length, cr.length, 1);
    const note = KS_JNOTE[e.code] || ['', ''];
    const title = e.d || note[0] || e.code;
    let h = '';
    for (let i = 0; i < n; i++) {
      const d = dr[i], c = cr[i];
      if (d) td += d[1];
      if (c) tc += c[1];
      h += `<tr class="${i === n - 1 ? 'jend' : ''}">${i === 0 ? `<td rowspan="${n}" class="jdesc"><b>${esc(title)}</b>${e.n > 1 ? `<span class="small muted">（${e.n}回分の合計）</span>` : ''}${e.c ? ' <span class="tag warn">決算整理</span>' : ''}${opt.notes !== false && note[1] ? `<div class="small muted">${esc(note[1])}</div>` : ''}</td>` : ''}
        <td>${d ? ksAcctLink(d[0]) : ''}</td><td class="n">${d ? fmtNum(d[1]) : ''}</td><td>${c ? ksAcctLink(c[0]) : ''}</td><td class="n">${c ? fmtNum(c[1]) : ''}</td></tr>`;
    }
    return h;
  }).join('');
  return `<div class="tbl-wrap"><table class="t jtable"><thead><tr><th>摘要</th><th>借方</th><th class="n">金額（円）</th><th>貸方</th><th class="n">金額（円）</th></tr></thead><tbody>${body}
    ${opt.total !== false ? `<tr class="total"><td>合計</td><td></td><td class="n">${fmtNum(td)}</td><td></td><td class="n">${fmtNum(tc)}</td></tr>` : ''}</tbody></table></div>`;
}
function ksAcctLink(k) {
  const a = KS_ACCT[k];
  const name = ksAcctName(k);
  return a.tk ? term(esc(name), a.tk) : esc(name);
}
function ksTrialBalance() {
  const rows = [];
  let td = 0, tc = 0;
  for (const k of KS_KEYS) {
    const v = ksB(k);
    if (!v) continue;
    const debitSide = ksDebitNature(k) ? v >= 0 : v < 0;
    const amt = Math.abs(v);
    if (debitSide) td += amt; else tc += amt;
    rows.push(`<tr><td class="n">${debitSide ? fmtNum(amt) : ''}</td><td>${ksAcctLink(k)} <span class="small muted">${{ A: '資産', C: '資産の控除', L: '負債', E: '純資産', R: '収益', X: '費用' }[KS_ACCT[k].t]}</span></td><td class="n">${debitSide ? '' : fmtNum(amt)}</td></tr>`);
  }
  return `<div class="tbl-wrap"><table class="t tb"><thead><tr><th class="n">借方残高</th><th>勘定科目</th><th class="n">貸方残高</th></tr></thead><tbody>${rows.join('')}
    <tr class="grand"><td class="n">${fmtNum(td)}</td><td>合計 ${Math.abs(td - tc) < 3 ? tag('貸借一致', 'ok') : tag('不一致', 'bad')}</td><td class="n">${fmtNum(tc)}</td></tr></tbody></table></div>`;
}
function ksLedger(k) {
  const isPL = KS_PL.includes(k);
  const rows = [];
  for (const j of G.journal) {
    let d = 0, c = 0;
    for (const e of j.e) { const l = e.l[k]; if (l) { d += l[0]; c += l[1]; } }
    const rec = G.months.find(x => x.m === j.m);
    let bal;
    if (!isPL) bal = rec ? rec.bal[k] : null;
    else {
      const fy = fyOf(j.m);
      bal = sum(G.months.filter(x => fyOf(x.m) === fy && x.m <= j.m), x => (x.flow[k] || 0) + (x.flowC[k] || 0));
      if (calMonth(j.m) === 3 && rec && G.fys[fy]) bal = 0; // 決算振替で締め切り
    }
    rows.push(`<tr><td>${ymLabel(j.m)}</td><td class="n">${d ? fmtNum(d) : ''}</td><td class="n">${c ? fmtNum(c) : ''}</td><td class="n">${bal === null || bal === undefined ? '―' : fmtNum(bal)}</td></tr>`);
  }
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>月</th><th class="n">借方（増えた額${ksDebitNature(k) ? '' : 'の逆'}）</th><th class="n">貸方</th><th class="n">月末の残高</th></tr></thead><tbody>${rows.reverse().join('')}</tbody></table></div>
    <p class="note">${ksAcctLink(k)}は${{ A: '資産', C: '資産から差し引く科目', L: '負債', E: '純資産', R: '収益', X: '費用' }[KS_ACCT[k].t]}の勘定です。${ksDebitNature(k) ? '借方に記入すると増え、貸方に記入すると減ります。' : '貸方に記入すると増え、借方に記入すると減ります。'}${isPL ? '収益・費用の勘定は、決算で当期純利益を繰越利益剰余金に振り替えて、残高をゼロに戻します（決算振替）。' : ''}</p>`;
}
KS_SCREENS.k_books = () => {
  const v = UI.kBooks || 'journal';
  const sub = [['journal', '仕訳帳'], ['ledger', '総勘定元帳'], ['tb', '試算表'], ['fixed', '固定資産台帳'], ['arap', '売掛金・買掛金']];
  let body = '';
  if (v === 'journal') {
    const js = G.journal;
    if (!js.length) body = '<div class="empty">仕訳はまだありません</div>';
    else {
      if (UI.kJm === null || !js.some(j => j.m === UI.kJm)) UI.kJm = js[js.length - 1].m;
      const j = js.find(x => x.m === UI.kJm);
      const cur = G.closing && j.m === G.m ? Object.values(G.jcur) : j.e;
      const opts = js.slice(-14).map(x => `<option value="${x.m}"${x.m === UI.kJm ? ' selected' : ''}>${ymLabel(x.m)}</option>`).join('');
      body = `<div class="row" style="margin-bottom:8px"><label class="inline small">月 <select data-ch="kJm">${opts}</select></label><span class="small muted">同じ種類の取引は1か月分をまとめて表示しています。</span></div>
        ${ksJournalTable(cur)}
        <p class="note">${term('仕訳', 'journal')}は、取引を「借方（左）」と「貸方（右）」に分けて記録したものです。左右の金額は必ず一致します。資産・費用が増えたら借方、負債・純資産・収益が増えたら貸方に書きます（${term('借方・貸方', 'debitCredit')}）。</p>`;
    }
  } else if (v === 'ledger') {
    const used = KS_KEYS.filter(k => ksB(k) || G.journal.some(j => j.e.some(e => e.l[k])));
    if (!used.includes(UI.kAcct)) UI.kAcct = 'cash';
    body = `<div class="row" style="margin-bottom:8px"><label class="inline small">勘定科目 <select data-ch="kAcct">${used.map(k => `<option value="${k}"${k === UI.kAcct ? ' selected' : ''}>${esc(ksAcctName(k))}</option>`).join('')}</select></label></div>${ksLedger(UI.kAcct)}
      <p class="note">${term('総勘定元帳', 'ledger')}は、仕訳を勘定科目ごとに書き写した帳簿です。この画面では月ごとの合計を表示しています。</p>`;
  } else if (v === 'tb') {
    body = `${G.closing ? '<p class="callout">決算整理の途中です。決算整理の仕訳を記帳するたびに、この試算表の数字が変わります。</p>' : ''}${ksTrialBalance()}
      <p class="note">${term('試算表', 'tb')}は、すべての勘定科目の残高を一覧にした表です。借方の合計と貸方の合計が一致すれば、仕訳の記帳に貸借の誤りがないことを確かめられます。期中は収益と費用の残高がたまっていき、3月末の決算振替で当期純利益が繰越利益剰余金に移ります。</p>`;
  } else if (v === 'fixed') {
    const fy = fyOf(G.m);
    const as = ksActiveAssets().slice().sort((a, b) => a.acqM - b.acqM);
    body = `<div class="tbl-wrap"><table class="t"><thead><tr><th>資産</th><th>科目</th><th>取得</th><th class="n">取得価額</th><th class="n">耐用年数</th><th class="n">減価償却累計額</th><th class="n">帳簿価額</th><th class="n">今期の償却（見込み）</th></tr></thead><tbody>
      ${as.map(a => `<tr><td>${esc(a.n)}${a.part === 'C' ? ' <span class="tag">製造</span>' : ''}</td><td>${KS_ASSET_NAMES[a.acct] || ''}</td><td>${a.acqM < -60 ? `${ymOf(a.acqM).y}年` : ymLabel(a.acqM)}</td><td class="n">${fmtYen(a.cost)}</td><td class="n">${a.life ? a.life + '年' : '償却しない'}</td><td class="n">${fmtYen(a.booked)}</td><td class="n">${fmtYen(a.cost - a.booked)}</td><td class="n">${a.life ? fmtYen(ksDepFor(a, fy)) : '―'}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">${term('固定資産台帳', 'fixedRegister')}。${term('定額法', 'straightLine')}で、毎年「取得価額÷耐用年数」を${term('減価償却費', 'dep')}にします（期の途中で買った資産は月割）。土地は使っても価値が減らないので償却しません。工場の機械の償却費は製造原価に入ります。</p>`;
  } else {
    const ar = G.ar.slice().sort((a, b) => a.due - b.due);
    const ap = G.ap.slice().sort((a, b) => a.due - b.due);
    const byDue = list => { const m = {}; for (const x of list) m[x.due] = (m[x.due] || 0) + x.amt; return Object.entries(m).map(([d, v]) => [+d, v]).sort((a, b) => a[0] - b[0]); };
    body = `<div class="grid g2"><div>${panel(`${ksAcctName('ar', 'bs')}（${fmtYen(ksB('ar'))}）`, `<table class="t compact"><thead><tr><th>入金予定</th><th class="n">金額</th></tr></thead><tbody>${byDue(ar).map(([d, v]) => `<tr><td>${ymLabel(d)}末</td><td class="n">${fmtYen(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">なし</td></tr>'}</tbody></table>`)}</div>
      <div>${panel(`${ksAcctName('ap', 'bs')}（${fmtYen(ksB('ap'))}）`, `<table class="t compact"><thead><tr><th>支払予定</th><th class="n">金額</th></tr></thead><tbody>${byDue(ap).map(([d, v]) => `<tr><td>${ymLabel(d)}末</td><td class="n">${fmtYen(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">なし</td></tr>'}</tbody></table>`)}</div></div>
      <p class="note">売掛金は「売ったけれどまだもらっていないお金」、買掛金は「買ったけれどまだ払っていないお金」です。売掛金の入金が遅く、買掛金の支払が早いほど、多くの運転資金が必要になります（${term('所要運転資金', 'wc')}）。</p>`;
  }
  return `<h1 class="h1">帳簿</h1><p class="lead">取引はすべて仕訳になり、元帳に集まり、試算表で確かめられ、決算整理を経て決算書になります。このゲームでは毎月の取引が自動で記帳されます。</p>
    <div class="flowline" aria-label="帳簿から決算書まで">${['取引', '仕訳帳', '総勘定元帳', '試算表', '決算整理', '決算書'].map((s, i) => `<span class="fl${['', 'journal', 'ledger', 'tb', '', ''][i] === v ? ' on' : ''}">${s}</span>`).join('<span class="arr" aria-hidden="true">→</span>')}</div>
    <div class="subtabs" role="tablist">${sub.map(([k, l]) => `<button type="button" data-act="kBooks" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div>${body}`;
};

/* ---------- 予算と実績 ---------- */
function ksBudPreview(bud) {
  return `<table class="t compact"><tbody>${KS_BUD_LINES.map(([k, name, tk, cls]) => `<tr class="${cls === 'grand' ? 'grand' : cls === 'sum' ? 'total' : ''}"><td>${term(k === 'sales' ? ksSalesName() : name, tk)}</td><td class="n">${fmtYen(bud.lines[k])}</td></tr>`).join('')}</tbody></table>`;
}
KS_SCREENS.k_budget = () => {
  const bud = G.budget;
  if (!bud) return '<div class="empty">予算はまだありません</div>';
  const st = bud.status === 'draft' ? tag('予算案', 'warn') : bud.status === 'auto' ? tag('決定（案のまま）') : tag('決定済み', 'ok');
  let form = '';
  if (bud.status === 'draft') {
    const t = bud.t, b = bud.base;
    const f = (k, label, help, step) => `<label class="field"><span>${label}</span><span class="row"><input type="number" step="${step}" value="${t[k]}" data-in="kBudT" data-k="${k}" style="width:90px"><span class="unit">%</span></span><span class="small muted">${help}</span></label>`;
    form = panel(`${ksFyLabel(bud.fy)}の予算案を決める`, `<div class="grid g2" style="gap:16px"><div class="stack" style="gap:10px">
      <p class="small" style="margin:0">直近12か月の実績（${ksSalesName()} ${fmtYen(b.sales)}・粗利 ${fmtYen(b.gp)}）をもとに予算案を作りました。目標を変えると右の予算が計算し直されます。</p>
      ${f('gS', `${ksSalesName()}の伸び（前年比）`, '客数・単価・取引先・受注をどれだけ増やすか。', 0.5)}
      ${f('gm', '売上総利益率（粗利率）', `直近は${fmtPct(b.sales ? b.gp / b.sales * 100 : 0, 1)}。値上げ・仕入の見直しで上がります。`, 0.1)}
      ${f('gPeople', '人件費（販売・事務・役員）の伸び', '採用や昇給の計画。工場・現場の人件費は売上原価に入ります。', 0.5)}
      ${f('gOther', 'その他の経費の伸び', '広告・水道光熱費・修繕など。', 0.5)}
      <div>${btn('この予算で決定する', 'kBudApprove', {}, 'primary')}</div></div>
      <div><div class="small muted" style="margin-bottom:4px">予算（年間）</div><div id="kBudPreview">${ksBudPreview(bud)}</div>
      <p class="note">${term('予算', 'budget')}は、1年の目標を数字にしたものです。銀行も「今期の計画」を聞いてきます。無理な目標は現場を疲れさせ、低すぎる目標は会社を成長させません。</p></div></div>`);
  }
  const va = ksBudgetVA(bud);
  const rows = va.rows.map(r => {
    const diff = !va.n ? '<td>―</td>' : Math.abs(r.diff) < 5e4 ? '<td class="muted">0</td>' : `<td class="${r.fav ? 'pos' : 'neg'}">${r.fav ? '+' : '△'}${fmtK(Math.abs(r.diff))}</td>`;
    const rate = !va.n || !r.cum || r.cum <= 0 || r.a < 0 ? '―' : fmtPct(r.a / r.cum * 100, 1);
    return `<tr class="${r.cls === 'grand' ? 'grand' : r.cls === 'sum' ? 'sum' : ''}"><td>${term(r.k === 'sales' ? ksSalesName() : r.name, r.tk)}</td><td>${fmtK(r.year)}</td><td>${va.n ? fmtK(r.cum) : '―'}</td><td class="${r.a < 0 && !r.cost ? 'neg' : ''}">${va.n ? fmtK(r.a) : '―'}</td>${diff}<td>${rate}</td><td>${fmtK(r.outlook)}</td></tr>`;
  }).join('');
  const ord = va.rows.find(r => r.k === 'ord'), sales = va.rows.find(r => r.k === 'sales'), gp = va.rows.find(r => r.k === 'gp');
  const cm = [];
  if (va.n) {
    if (Math.abs(sales.diff) > Math.abs(sales.cum) * 0.03) cm.push(`${ksSalesName()}は予算比${fmtPct(sales.a / Math.max(1, sales.cum) * 100, 1)}。${sales.fav ? '予算を上回っています。' : '予算に届いていません。客数・単価・受注のどこが足りないかを現場の数字で確かめましょう。'}`);
    const gmA = sales.a ? gp.a / sales.a * 100 : 0;
    if (Math.abs(gmA - bud.t.gm) > 1) cm.push(`粗利率は実績${fmtPct(gmA, 1)}（予算${fmtPct(bud.t.gm, 1)}）。${gmA < bud.t.gm ? '値引き・廃棄・原価の上昇で粗利が削られています。' : '予算より高い粗利率を確保できています。'}`);
    if (ord.outlook < bud.lines.ord - Math.abs(bud.lines.ord) * 0.1) cm.push(`このままだと年間の経常利益は${fmtYen(ord.outlook)}（予算${fmtYen(bud.lines.ord)}）の見通しです。`);
    else if (ord.outlook > bud.lines.ord + Math.abs(bud.lines.ord) * 0.1) cm.push(`年間の経常利益は予算を上回る見通しです（${fmtYen(ord.outlook)}）。`);
  }
  let chart = '';
  if (va.n) {
    const labels = [], plan = [], act = [];
    let cp = 0, ca = 0;
    for (let i = 0; i < 12; i++) {
      const m = bud.fy * 12 + i;
      labels.push(`${ymOf(m).mo}月`);
      cp += ksBudgetMonth(bud, 'ord', i); plan.push(cp);
      const x = G.months.find(y => y.m === m);
      if (x) { ca += x.mg.ord; act.push(ca); } else act.push(null);
    }
    chart = panel('経常利益の累計（予算と実績）', lineChart({ labels, height: 190, series: [{ name: '予算', color: 's2', values: plan, dash: true }, { name: '実績', color: 's1', values: act }] }));
  }
  const ach = G.budgetLast ? (() => {
    const st = G.fys[G.budgetLast.fy];
    if (!st) return '';
    const plan = G.budgetLast.lines.ord, act = st.pl.ord;
    const v = plan > 0 && act >= 0 ? `<b class="num ${act < plan ? 'neg' : 'pos'}">${fmtPct(act / plan * 100, 1)}</b>` : `<b class="num ${act < plan ? 'neg' : 'pos'}">${act < plan ? '未達' : '達成'}</b>`;
    return `<span class="small">前期の経常利益：予算 ${fmtYen(plan)} → 決算 ${fmtYen(act)}（${v}）</span>`;
  })() : '';
  return `<div class="row between" style="margin-bottom:10px"><h1 class="h1" style="margin:0">予算と実績</h1>${ach}</div>
    <p class="lead">${ksFyLabel(bud.fy)}（${ksFyYear(bud.fy)}）の予算 ${st}。毎月の実績（月次決算）と比べ、ずれの原因を探して手を打つのが${term('予実管理', 'yojitsu')}です。</p>
    ${form}<div class="tbl-wrap" style="margin-top:12px"><table class="fs"><thead><tr><th>（千円）</th><th>年間予算</th><th>予算（${va.n ? `${va.n}か月` : '未経過'}）</th><th>実績</th><th>差異</th><th>予算比</th><th>年間見通し</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">差異の「＋」は利益を増やす方向（売上が多い・費用が少ない）、「△」は利益を減らす方向。年間見通し＝実績＋残りの月の予算。予算・実績とも月次の数字（管理会計）です。</p>
    ${cm.length ? `<div class="callout" style="margin-top:10px"><b>予実のポイント</b><ul style="margin:6px 0 0;padding-left:1.2em">${cm.map(c => `<li>${c}</li>`).join('')}</ul></div>` : ''}
    <div style="margin-top:12px">${chart}</div>`;
};

/* ---------- 学ぶ ---------- */
KS_SCREENS.k_learn = () => {
  const I = ksCo();
  const q = G.quiz || { asked: 0, correct: 0 };
  const cycle = ['日々の取引', '仕訳（借方・貸方）', '総勘定元帳', '月次決算', '決算整理（3月末）', '決算書', '銀行の審査・格付'];
  const engs = [...new Set(ksActiveUnits().map(u => ksS(u).eng))];
  const learn = engs.map(e => { const L = KS_ENG_LEARN[e]; const us = ksActiveUnits().filter(u => ksS(u).eng === e).map(u => esc(ksUName(u))).join('・'); return `<h2 class="h2" style="margin:16px 0 8px">${esc(KS_ENG_INFO[e].n)}<span class="small muted">（${us}）</span></h2><div class="grid g3">${panel('お金の流れ', L.flow)}${panel('決算書の特徴', L.fs)}${panel('決算のポイント', L.closing)}</div>`; }).join('');
  return `<h1 class="h1">学ぶ</h1><p class="lead">${esc(I.label)}を経営しながら、決算書がどう作られ、銀行がどこを見るかを学びます。</p>
  ${learn}
  <div class="grid g2" style="margin-top:16px">
    ${panel('簿記の5つの要素', `<table class="t compact"><tbody>
      <tr><td class="nowrap"><b>資産</b></td><td>会社が持っている財産（現金・売掛金・在庫・建物など）</td><td class="nowrap">増えたら借方</td></tr>
      <tr><td class="nowrap"><b>負債</b></td><td>返さなければならないもの（買掛金・借入金など）</td><td class="nowrap">増えたら貸方</td></tr>
      <tr><td class="nowrap"><b>純資産</b></td><td>資産−負債。株主が出したお金（資本金）と利益の蓄え</td><td class="nowrap">増えたら貸方</td></tr>
      <tr><td class="nowrap"><b>収益</b></td><td>純資産を増やす原因（売上高・受取利息など）</td><td class="nowrap">発生したら貸方</td></tr>
      <tr><td class="nowrap"><b>費用</b></td><td>純資産を減らす原因（仕入・給料・家賃・減価償却費など）</td><td class="nowrap">発生したら借方</td></tr></tbody></table>
      <p class="small" style="margin:8px 0 0">例：商品を10万円で売り、代金は翌月もらう →（借方）売掛金 10万円 ／（貸方）売上高 10万円。${btn('仕訳帳を見る', 'kGo', { tab: 'k_books' }, 'sm linkish')}</p>`)}
    ${panel('帳簿から決算書、そして銀行へ', `<div class="flowline big">${cycle.map(s => `<span class="fl">${s}</span>`).join('<span class="arr" aria-hidden="true">→</span>')}</div>
      <p class="small" style="margin:8px 0 0">毎月の取引は自動で仕訳され、月末に月次決算（速報）がまとまります。3月末には実地棚卸・減価償却・引当金・未払と前払・税金の決算整理を行い、正式な決算書が完成します。銀行はその決算書で格付を決め、金利や貸せる金額が変わります。</p>`)}
  </div>
  <div class="grid g2" style="margin-top:16px">
    ${panel('決算整理クイズの成績', q.asked ? `<p style="margin:0 0 6px">これまで <b>${q.asked}問中${q.correct}問</b> 正解（正答率 ${fmtPct(q.correct / q.asked * 100, 0)}）</p>${meter(q.correct, q.asked, 'ok')}` : '<p class="small" style="margin:0">最初の決算（3月末）で問題が出ます。</p>')}
    ${panel('用語集', `<p class="small" style="margin:0 0 8px">決算書・経営指標・簿記・予算・銀行・上場の用語を、意味・計算式・決算書のどこを見るかとあわせて解説しています。画面の中の点線の下線がある言葉も押せます。</p>${btn('用語集を開く', 'glossary', {}, 'primary')}`)}
  </div>`;
};

/* ---------- ニュース ---------- */
KS_SCREENS.k_news = () => {
  const ns = G.news;
  return `<h1 class="h1">ニュース</h1><p class="lead">会社と取引先、景気の出来事です。</p>
    ${panel(`景気：${ksEcoName(G.eco.regime)}`, kv([['景気の指数', fmtNum(G.eco.idx * 100, 1)], ['短期プライムレート', fmtNum(G.eco.prime, 3) + '%'], ['物価（2026年4月＝100）', fmtNum(G.eco.priceIdx / 0.95 * 95, 1)], ['材料の値段', fmtNum(G.eco.matIdx * 100, 1)]]))}
    <div style="margin-top:16px">${panel('出来事', ns.length ? `<ul class="newslist">${ns.map(n => `<li class="${n.k === 'bad' ? 'bad' : n.k === 'good' ? 'good' : ''}"><span class="when">${ymShort(n.m)}</span><span class="what">${esc(n.t)}</span></li>`).join('')}</ul>` : '<div class="empty">まだありません</div>', { flush: true })}</div>`;
};

/* ---------- アクション ---------- */
Object.assign(ACTIONS, {
  kGo: d => { UI.tab = d.tab; UI.modal = null; UI.queue = []; drawModal(); render(); if (d.sec === 'view') { const el = $('#bankview'); if (el) el.scrollIntoView({ block: 'start' }); } else scrollToMain(); },
  kGoFs: d => { UI.tab = 'k_fs'; UI.kFsView = d.v; UI.kFy = d.v === 'month' && G.months.some(x => fyOf(x.m) === fyOf(G.m)) ? fyOf(G.m) : ksFyOfLast(); UI.modal = null; drawModal(); render(); scrollToMain(); },
  kFy: d => { UI.kFy = +d.v; render(); },
  kFsView: d => { UI.kFsView = d.v; render(); },
  kCoView: d => { UI.coFsView = d.v; UI.guideSel = null; render(); },
  kBooks: d => { UI.kBooks = d.v; render(); },
  kBudApprove: () => { ksBudgetApprove(false); toast('今期の予算を決定しました'); render(); },
});
Object.assign(CHANGES, {
  kJm: el => { UI.kJm = +el.value; render(); },
  kAcct: el => { UI.kAcct = el.value; render(); },
});
INPUTS.kBudT = el => {
  const bud = G.budget;
  if (!bud || bud.status !== 'draft') return;
  const v = parseFloat(el.value);
  if (!isFinite(v)) return;
  ksBudgetSet(Object.assign({}, bud.t, { [el.dataset.k]: v }));
  const p = $('#kBudPreview');
  if (p) p.innerHTML = ksBudPreview(G.budget);
  scheduleSave();
};

/* ---------- 月の進行 ---------- */
function ksRequestAdvance() {
  if (!G || G.over) return;
  if (G.closing) { showModal('kClose'); return; }
  const fc = ksForecast(1)[0];
  if (UI.settings.confirmAdvance && fc && fc.short) {
    confirmBox('資金が足りなくなる見込みです', `今月末の現預金が<b>${fmtYen(fc.bal)}</b>になる見込みです。足りない分は銀行の緊急融資を頼むことになり、それも受けられなければ会社は続けられません。運転資金を借りるか、支払を見直してから締めることをおすすめします。<br>このまま月末を締めますか？`, '締めて翌月へ', 'kAdvanceNow', {}, true);
    return;
  }
  ksRunAdvance();
}
function ksRunAdvance() {
  UI.modal = null;
  // 子会社の画面にいても、月末の締めはグループ全体（親会社→子会社）で進める
  const view = typeof ksIsSubView === 'function' && ksIsSubView() ? G.subId : null;
  if (view) ksViewEntity(null);
  let rep = typeof ksGroupAdvance === 'function' ? ksGroupAdvance() : ksAdvance();
  if (view && !G.closing && !G.over && ksSubById(view) && !ksSubById(view).gone) { ksViewEntity(view); rep = G.monthRep || rep; }
  UI.queue = [];
  if (rep && UI.settings.monthly) UI.queue.push({ name: 'kMonth', args: { m: rep.m } });
  if (G.closing) { G.closing.view = G.closing.i; UI.queue.push({ name: 'kClose', args: {} }); }
  for (const s of (G.pendingModals || [])) UI.queue.push({ name: s.type, args: s });
  G.pendingModals = [];
  if (G.over) UI.queue.push({ name: 'kOver', args: {} });
  render();
  autosave();
  if (UI.queue.length) { const n = UI.queue.shift(); showModal(n.name, n.args); } else drawModal();
}
Object.assign(ACTIONS, {
  kAdvanceNow: () => ksRunAdvance(),
  kCloseOpen: () => { if (G.closing) showModal('kClose'); },
});

/* ---------- 月次報告 ---------- */
function ksMonthTip(x) {
  const mo = calMonth(x.m);
  const conOnly = ksActiveUnits().length === 1 && ksHasEng('build');
  const tips = [];
  if (mo === 4) tips.push('4月は新しい期の始まり。前期末に計上した未払費用・前払費用を元に戻す「再振替仕訳」をしました（仕訳帳で確かめられます）。');
  if (mo === 5) tips.push('5月は前期の法人税等を納める月です。費用は前期の決算で計上済みなので、今期の利益は減りませんが、現預金は減ります。');
  if (mo === 6 || mo === 12) tips.push('賞与の月は人件費の支払が大きくなります。利益より先にお金が出ていくので、資金繰り表で確かめておきましょう。');
  if (mo === 2) tips.push('来月は決算です。3月末に在庫を数え（実地棚卸）、減価償却費や引当金を計上して決算書を作ります。');
  if ((x.cf.collect || 0) + (x.cf.cashSales || 0) < x.mg.sales * 0.8 && !conOnly) tips.push('今月は売上より入金が少ない月でした。売掛金が増えると、利益が出ていても現預金は増えません。');
  if (x.mg.ord < 0 && x.cash > (G.months[G.months.length - 2] || x).cash) tips.push('今月は赤字でしたが現預金は増えました。売掛金の回収や借入など、損益と関係ないお金の動きがあったためです。');
  if (x.mg.ord > 0 && x.cash < (G.months[G.months.length - 2] || x).cash) tips.push('今月は黒字でしたが現預金は減りました。借入の返済、設備の購入、在庫の積み増しなどは利益を減らさずにお金だけを減らします。');
  if (!tips.length) tips.push(conOnly ? '工事完成基準では、工事が完成した月にまとめて売上が立ちます。月次の損益は波打つので、受注残と未成工事支出金もあわせて見ましょう。' : '月次決算は、毎月の成績を早くつかむための速報です。予算と比べて、ずれが大きい項目の原因を探しましょう。');
  return tips[0];
}
MODALS.kMonth = a => {
  const x = G.months.find(r => r.m === a.m) || G.months[G.months.length - 1];
  if (!x) return modalFrame('月次報告', '<p>記録がありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  const net = sum(Object.values(x.cf));
  const begin = x.cash - net;
  const inflow = sum(Object.entries(x.cf).filter(([, v]) => v > 0), ([, v]) => v);
  const outflow = sum(Object.entries(x.cf).filter(([, v]) => v < 0), ([, v]) => v);
  const kpiH = ksActiveUnits().map(u => { const k = (x.kpiU || {})[u.id]; if (!k) return ''; const rows = KS_OPS[ksS(u).eng].kpiRows(u, k); return rows.length ? `${ksActiveUnits().length > 1 ? `<div class="small" style="margin:8px 0 2px"><b>${esc(ksUName(u))}</b></div>` : ''}${kv(rows)}` : ''; }).join('');
  const news = G.news.filter(n => n.m === x.m).slice(0, 8);
  const body = `<div class="grid g2"><div><h3 class="fsh">月次の損益（速報）</h3>${ksMgTable(x.mg, x.m)}</div>
    <div><h3 class="fsh">お金の動き</h3><table class="t compact"><tbody>
      <tr><td>月初の現預金</td><td class="n">${fmtYen(begin)}</td></tr><tr><td>入ってきたお金</td><td class="n pos">+${fmtYen(inflow, { noUnit: false })}</td></tr>
      <tr><td>出ていったお金</td><td class="n neg">${fmtYen(outflow)}</td></tr><tr class="total"><td>月末の現預金</td><td class="n ${x.cash < 0 ? 'neg' : ''}">${fmtYen(x.cash)}</td></tr>
      <tr><td>借入金の残高</td><td class="n">${fmtYen(x.bal.std + x.bal.ltd)}</td></tr><tr><td>${ksAcctName('ar', 'bs')}</td><td class="n">${fmtYen(x.bal.ar)}</td></tr></tbody></table>
      ${kpiH ? `<h3 class="fsh" style="margin-top:12px">現場の数字</h3>${kpiH}` : ''}</div></div>
    <p class="callout" style="margin-top:12px"><b>今月のポイント</b>　${ksMonthTip(x)}</p>
    <h3 class="fsh" style="margin-top:12px">今月の出来事</h3>${news.length ? `<ul class="newslist" style="border:1px solid var(--rule);border-radius:var(--r-m)">${news.map(n => `<li class="${n.k === 'bad' ? 'bad' : n.k === 'good' ? 'good' : ''}"><span class="when">${n.k === 'bank' ? '銀行' : '会社'}</span><span class="what">${esc(n.t)}</span></li>`).join('')}</ul>` : '<p class="muted small">大きな出来事はありませんでした。</p>'}
    <label class="inline small" style="margin-top:12px"><input type="checkbox" data-ch="setting" data-key="monthly" ${UI.settings.monthly ? 'checked' : ''}> 毎月この報告を表示する</label>`;
  return modalFrame(`${ymLabel(x.m)}の月次決算`, body, btn('仕訳帳を見る', 'kJournalFrom', { m: x.m }) + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide', sub: `${warekiLabel(x.m)}末の締め` });
};
ACTIONS.kJournalFrom = d => { UI.tab = 'k_books'; UI.kBooks = 'journal'; UI.kJm = +d.m; UI.modal = null; UI.queue = UI.queue.filter(q => q.name === 'kClose' || q.name === 'kTerm' || q.name === 'kOver'); drawModal(); render(); scrollToMain(); if (UI.queue.length) { const n = UI.queue.shift(); showModal(n.name, n.args); } };

/* ---------- 融資の申込 ---------- */
const KS_TERMS_M = [[6, '6か月（手形貸付）'], [12, '1年（手形貸付）'], [36, '3年'], [60, '5年'], [84, '7年'], [120, '10年']];
function ksLoanDraft(o = {}) {
  return Object.assign({ bank: 'mirai', purpose: 'working', amt: Math.max(1e7, niceAmount(ksMonthlyFixedOut() * 2)), termM: 60, cgc: false, coll: false, res: null }, o);
}
ACTIONS.kLoanNew = d => { UI.kLoan = ksLoanDraft(d && d.purpose ? { purpose: d.purpose, amt: +d.amt || undefined } : {}); if (!UI.kLoan.amt) UI.kLoan.amt = 1e7; showModal('kLoan'); };
function ksLoanApp() { const L = UI.kLoan; return { bank: L.bank, purpose: L.purpose, amt: L.amt, termM: L.termM, cgc: L.cgc, coll: L.coll, item: L.item }; }
MODALS.kLoan = () => {
  const L = UI.kLoan || (UI.kLoan = ksLoanDraft());
  const B = KS_BANKS[L.bank];
  const seg = (act, list, cur) => `<div class="seg wrap" role="radiogroup">${list.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const terms = KS_TERMS_M.filter(([t]) => !(B.longOnly && t < 36));
  const res = L.res;
  let resHtml = '';
  if (res) {
    const pts = `<table class="t compact"><tbody>${res.points.map(([k, v, c]) => `<tr><td>${k}</td><td class="n ${c === 'bad' ? 'neg' : c === 'ok' ? 'pos' : ''}">${v}</td></tr>`).join('')}</tbody></table>`;
    if (res.ok) {
      const firstInt = res.amt * res.rate / 1200;
      const prin = L.termM > 12 ? res.amt / L.termM : 0;
      resHtml = `<div class="callout ok"><b>${B.short}の回答：お貸しできます</b><ul style="margin:6px 0 0;padding-left:1.2em">${res.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
        <div class="grid g2" style="margin-top:10px">${kv([['金額', fmtYen(res.amt)], ['金利', `年${fmtNum(res.rate, 2)}%`], ['返済', L.termM > 12 ? `毎月 ${fmtYen(prin)}（元金均等）＋利息` : `${ymLabel(G.m + L.termM)}に一括（折り返しの相談可）`], ['最初の月の利息', fmtYen(firstInt)], res.fee ? ['信用保証料', `${fmtYen(res.fee)}（借りるときに一括で支払い）`] : null, ['借入後の債務償還年数', isFinite(res.dsyAfter) ? `${fmtNum(res.dsyAfter, 1)}年` : '―']])}${pts}</div>`;
    } else {
      resHtml = `<div class="callout bad"><b>${B.short}の回答：今回はお貸しできません</b><ul style="margin:6px 0 0;padding-left:1.2em">${res.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div><div style="margin-top:10px">${pts}</div>`;
    }
  }
  const landOk = ksB('land') > 0;
  const body = `<div class="stack" style="gap:12px">
    <div class="field"><span>金融機関</span>${seg('kLoanBank', Object.entries(KS_BANKS).map(([k, b]) => [k, b.short]), L.bank)}<span class="small muted">${esc(B.desc)}</span></div>
    <div class="field"><span>資金の使いみち</span>${seg('kLoanPurpose', [['working', '運転資金'], ['capex', '設備資金']], L.purpose)}<span class="small muted">${L.purpose === 'working' ? '仕入代金・給与・賞与・納税の支払など、売上が入るまでのつなぎのお金。月商の2.5か月分までが目安。' : '店舗・機械・車両などを買うお金。長い期間で返します。'}</span></div>
    <label class="field"><span>借りたい金額（万円）</span><input type="number" min="100" step="100" value="${Math.round(L.amt / 1e4)}" data-ch="kLoanAmt" style="width:140px"></label>
    <div class="field"><span>期間</span>${seg('kLoanTerm', terms, L.termM)}<span class="small muted">${L.termM <= 12 ? '1年以内は手形貸付（短期借入金）。期日に一括で返すか、折り返し（借り直し）ます。' : '1年を超えると証書貸付（長期借入金）。毎月同じ額の元金を返します。'}</span></div>
    <div class="row" style="gap:16px">${L.bank !== 'koko' ? `<label class="inline small"><input type="checkbox" data-ch="kLoanCgc" ${L.cgc ? 'checked' : ''}> 信用保証協会の保証を付ける（保証料がかかるが審査が通りやすい）</label>` : ''}
      ${landOk ? `<label class="inline small"><input type="checkbox" data-ch="kLoanColl" ${L.coll ? 'checked' : ''}> 土地を担保に入れる（金利が少し下がる）</label>` : ''}</div>
    ${resHtml}</div>`;
  const foot = res && res.ok ? btn('条件を変える', 'kLoanReset') + btn('この条件で借りる', 'kLoanGo', {}, 'primary') : btn('やめる', 'closeModal') + btn('銀行に申し込む', 'kLoanEval', {}, 'primary');
  return modalFrame('融資を申し込む', body, foot, { sub: `現預金 ${fmtYen(ksB('cash'))}・借入金 ${fmtYen(ksDebt())}・格付 ${G.grade || '―'}` });
};
Object.assign(ACTIONS, {
  kLoanBank: d => { UI.kLoan.bank = d.v; if (KS_BANKS[d.v].longOnly && UI.kLoan.termM < 36) UI.kLoan.termM = 60; if (d.v === 'koko') UI.kLoan.cgc = false; UI.kLoan.res = null; drawModal(); },
  kLoanPurpose: d => { UI.kLoan.purpose = d.v; UI.kLoan.res = null; drawModal(); },
  kLoanTerm: d => { UI.kLoan.termM = +d.v; UI.kLoan.res = null; drawModal(); },
  kLoanReset: () => { UI.kLoan.res = null; drawModal(); },
  kLoanEval: () => { const app = ksLoanApp(); UI.kLoan.res = ksEvalLoan(app); drawModal(); },
  kLoanGo: () => {
    const app = ksLoanApp();
    const res = UI.kLoan.res;
    if (!res || !res.ok) return;
    ksBorrow(app, res);
    ksNews(`${KS_BANKS[app.bank].short}から${fmtYen(res.amt)}を借りました（${app.purpose === 'capex' ? '設備資金' : '運転資金'}・${app.termM > 12 ? `${app.termM / 12}年` : `${app.termM}か月`}・年${fmtNum(res.rate, 2)}%）`, 'bank');
    toast(`${fmtYen(res.amt)}を借りました。現預金と借入金が同じだけ増えます`);
    const after = UI.kLoan.after;
    UI.kLoan = null;
    closeModal(true);
    if (after) after();
    render();
    autosave();
  },
});
Object.assign(CHANGES, {
  kLoanAmt: el => { const v = parseFloat(el.value); if (isFinite(v) && v > 0) { UI.kLoan.amt = Math.round(v) * 1e4; UI.kLoan.res = null; drawModal(); } },
  kLoanCgc: el => { UI.kLoan.cgc = el.checked; UI.kLoan.res = null; drawModal(); },
  kLoanColl: el => { UI.kLoan.coll = el.checked; UI.kLoan.res = null; drawModal(); },
});

/* ---------- 返済条件の変更（リスケ） ---------- */
ACTIONS.kResched = () => showModal('kResched');
MODALS.kResched = () => {
  const ck = ksReschedCheck();
  const body = `<p style="margin:0 0 8px">${term('リスケジュール', 'resched')}（リスケ）は、返済が苦しい会社が、取引しているすべての銀行に「しばらく元金の返済を止めてほしい」と頼むことです。このゲームでは、毎月元金を返している借入金（証書貸付）の返済を<b>1年間止め</b>、利息だけを払います。返済の期限は1年延びます。</p>
    ${kv([['止まる元金の返済', `毎月 ${fmtYen(ck.prin || 0)}（1年で約${fmtYen((ck.prin || 0) * 12)}）`], ['対象の借入金', ck.loans.length ? ck.loans.map(L => `${KS_BANKS[L.bank].short} ${fmtYen(L.bal)}`).join('・') : 'なし']])}
    <div class="callout bad" style="margin-top:10px"><b>代わりに失うもの</b><ul style="margin:6px 0 0;padding-left:1.2em"><li>銀行の格付は要管理先（8）になり、2年間は8より良くなりません。</li><li>返済を止めている1年間は、新しい融資を受けられません。当座貸越も使えなくなります。</li><li>銀行は「経営改善計画」を求めます。1年のうちに利益の出る体質に変えなければ、次はありません。</li></ul></div>
    ${ck.ok ? '' : `<p class="callout" style="margin-top:10px">今は申し込めません：${esc(ck.why)}</p>`}`;
  return modalFrame('返済条件の変更（リスケ）', body, btn('やめる', 'closeModal') + (ck.ok ? btn('銀行に申し込む', 'kReschedGo', {}, 'danger') : ''), { size: 'narrow' });
};
ACTIONS.kReschedGo = () => { const r = ksReschedule(); if (r.ok) toast('返済条件の変更が認められました。1年間、元金の返済が止まります'); closeModal(true); render(); autosave(); };

/* ---------- 繰上返済 ---------- */
ACTIONS.kRepay = d => { UI.kRepayId = d.id; UI.kRepayAmt = null; showModal('kRepay'); };
MODALS.kRepay = () => {
  const L = G.loans.find(x => x.id === UI.kRepayId);
  if (!L) return modalFrame('繰上返済', '<p>借入金が見つかりません</p>', btn('閉じる', 'closeModal'));
  const amt = UI.kRepayAmt ?? Math.min(L.bal, Math.max(0, Math.floor(ksB('cash') * 0.3 / 1e5) * 1e5));
  const body = `<p style="margin:0 0 8px">${KS_BANKS[L.bank].short}・${ksLoanKind(L)}・残高 <b>${fmtYen(L.bal)}</b>（年${fmtNum(L.rate, 2)}%）</p>
    <label class="field"><span>返済する金額（万円）</span><input type="number" min="0" step="10" value="${Math.round(amt / 1e4)}" data-ch="kRepayAmt" style="width:140px"></label>
    <p class="small">利息が年${fmtYen(amt * L.rate / 100)}減ります。ただし現預金が${fmtYen(amt)}減り、一度返したお金は簡単には借り直せません。手元の資金（現預金 ${fmtYen(ksB('cash'))}）を残しておくことも大切です。</p>`;
  return modalFrame('繰上返済', body, btn('やめる', 'closeModal') + btn('返済する', 'kRepayGo', {}, 'primary'), { size: 'narrow' });
};
CHANGES.kRepayAmt = el => { const v = parseFloat(el.value); if (isFinite(v) && v >= 0) UI.kRepayAmt = Math.round(v) * 1e4; };
ACTIONS.kRepayGo = () => {
  const L = G.loans.find(x => x.id === UI.kRepayId);
  if (!L) return;
  const inp = document.querySelector('[data-ch="kRepayAmt"]');
  if (inp) { const v = parseFloat(inp.value); if (isFinite(v)) UI.kRepayAmt = Math.round(v) * 1e4; }
  const amt = ksRepayEarly(L, UI.kRepayAmt ?? 0);
  if (amt > 0) { toast(`${fmtYen(amt)}を繰上返済しました`); ksNews(`${KS_BANKS[L.bank].short}の借入金を${fmtYen(amt)}繰上返済しました`, 'bank'); }
  closeModal(true);
  render();
};

/* ---------- 就任・倒産・任期満了 ---------- */
MODALS.kIntro = () => {
  const I = ksCo();
  const st = ksLastFY();
  const body = `<p style="margin:0 0 10px">${ymLabel(G.m)}、${esc(G.ceo)}さんが${esc(G.coName)}の社長に就任しました。${G.founded}年創業、${esc(I.label)}を営む会社です。</p>
    ${st ? `<p class="small" style="margin:0 0 10px">前期（${ksFyLabel(st.fy)}）の${ksSalesName()}は${fmtYen(st.pl.sales)}、経常利益は${fmtYen(st.pl.ord)}、銀行の格付は${G.grade}。会社の状態は「${KS_COND[G.cond].n}」です。</p>` : ''}
    <ol><li><b>決算書</b>で、先代が作った過去${ksFYList().length}期分の決算書を読む（損益計算書・貸借対照表）。</li>
    <li><b>資金と銀行</b>で、資金繰り表と借入金を確かめる。お金が尽きたら会社は終わりです。</li>
    <li><b>現場</b>で、事業ごとに値段・人員・設備を決める。新しい事業を始めることもできます。</li>
    <li><b>成長</b>で、認証・DX・研究開発・海外展開・M&A・株式上場に挑戦する。</li>
    <li>右上の<b>「月末を締めて翌月へ」</b>で1か月が進み、取引が自動で仕訳されて月次決算がまとまります。</li>
    <li>3か月後の<b>3月末は決算</b>。在庫を数え、減価償却費・引当金・税金を計上して、あなたの手で決算書を完成させます。</li></ol>
    <p class="note">遊び方はいつでも右上の「遊び方」から読めます。進行はこのブラウザに自動で保存されます。</p>`;
  return modalFrame(`${esc(G.coName)}へようこそ`, body, btn('遊び方を読む', 'helpSec', { sec: 0 }) + btn('始める', 'closeModal', {}, 'primary'));
};
function ksEvaluation() {
  const fys = ksFYList();
  const startFy = fyOf(G.startedM) - 1;
  const base = G.fys[startFy] || G.fys[fys[0]];
  const last = G.fys[fys[fys.length - 1]];
  const bs = st => ksToBankFS(st);
  const b0 = bs(base), b1 = bs(last);
  const parts = [];
  const eqG = b0.EQ > 0 ? b1.EQ / b0.EQ : b1.EQ > 0 ? 2 : 0;
  parts.push({ name: '純資産の成長', pts: Math.round(clamp(interp(eqG, [[0.5, 0], [1, 8], [1.5, 14], [2.2, 20]]), 0, 20)), max: 20, note: `${fmtYen(b0.EQ)} → ${fmtYen(b1.EQ)}` });
  const played = fys.filter(f => f > startFy).map(f => G.fys[f]);
  const ordm = played.length ? sum(played, s => s.pl.ord / Math.max(1, s.pl.sales)) / played.length * 100 : 0;
  const avg = industryAvg(ksAvgInd()).ordm;
  parts.push({ name: '稼ぐ力', pts: Math.round(clamp(interp(ordm / Math.max(0.5, avg), [[-0.5, 0], [0, 4], [0.5, 10], [1, 15], [1.6, 20]]), 0, 20)), max: 20, note: `経常利益率の平均 ${fmtPct(ordm, 1)}（業界平均 ${fmtPct(avg, 1)}）` });
  const eqR = b1.EQ / b1.TA * 100;
  parts.push({ name: '財務の安全性', pts: Math.round(clamp(interp(eqR, [[0, 0], [10, 5], [30, 11], [50, 15]]), 0, 15)), max: 15, note: `自己資本比率 ${fmtPct(eqR, 1)}` });
  const ms = G.grow ? Object.values(G.grow.ms).filter(m => m >= (G.startedM ?? 0)).length : 0;
  parts.push({ name: '成長と挑戦', pts: Math.round(clamp(ms * 1.5, 0, 15)), max: 15, note: `在任中に達成した会社の歩み ${ms}件${G.grow && G.grow.ipo.st === 'listed' ? '・上場' : ''}` });
  parts.push({ name: '銀行の信頼', pts: Math.round(clamp((10 - (G.grade || 10)) / 9 * 15, 0, 15)), max: 15, note: `格付 ${G.grade}${G.flags.fraudFoundM !== undefined ? '・粉飾の発覚あり' : ''}` });
  const q = G.quiz || { asked: 0, correct: 0 };
  const fraud = Object.values(G.fys).some(s => s.fraudInv) || G.flags.fraudFoundM !== undefined;
  parts.push({ name: '正しい決算', pts: fraud ? 0 : Math.round(q.asked ? q.correct / q.asked * 15 : 8), max: 15, note: fraud ? '在庫の水増し（粉飾）をした' : q.asked ? `決算整理クイズ ${q.correct}/${q.asked}問正解` : '―' });
  const total = sum(parts, p => p.pts);
  const rank = total >= 85 ? 'S' : total >= 70 ? 'A' : total >= 55 ? 'B' : total >= 40 ? 'C' : 'D';
  const title = { S: '地域を代表する名経営者', A: '銀行も一目置く堅実な社長', B: '会社をしっかり守った社長', C: 'まだ伸びしろのある社長', D: '苦しい経営だった社長' }[rank];
  return { parts, total, rank, title };
}
function ksEvalHtml() {
  const ev = ksEvaluation();
  return `<div class="row" style="gap:18px;align-items:center;margin-bottom:10px"><div style="font-family:var(--f-doc);font-size:56px;font-weight:700;line-height:1;color:var(--brass)">${ev.rank}</div><div><div style="font-size:18px;font-weight:700">${ev.title}</div><div class="small muted">経営評価 ${ev.total}点／100点</div></div></div>
    <table class="t compact"><tbody>${ev.parts.map(p => `<tr><td>${p.name}</td><td style="width:35%">${meter(p.pts, p.max, 'ok')}</td><td class="n">${p.pts}/${p.max}</td><td class="small muted">${esc(p.note)}</td></tr>`).join('')}</tbody></table>`;
}
MODALS.kOver = () => {
  const body = `<p style="font-size:17px;margin:0 0 6px;font-family:var(--f-doc)"><b class="neg">資金繰りが破綻しました</b>（${ymLabel(G.over.m)}）</p>
    <p>仕入先や従業員への支払に必要なお金を用意できず、事業を続けられなくなりました。損益計算書が黒字でも、お金が尽きれば会社は終わります（黒字倒産）。資金繰り表で数か月先のお金を確かめ、早めに銀行に相談することが大切です。</p>
    <hr class="sep"><h3 style="font-size:14px;margin:0 0 8px">在任中の経営評価</h3>${ksFYList().length ? ksEvalHtml() : ''}`;
  return modalFrame('経営の終わり', body, btn('セーブから再開', 'menu') + btn('新しいゲーム', 'newGameGo', {}, 'primary'));
};
MODALS.kTerm = () => modalFrame('任期満了', `<p>就任から${G.termYears}年。${esc(G.coName)}の社長としての任期を全うしました。</p>${ksEvalHtml()}<p class="note" style="margin-top:10px">このまま続投して経営を続けることもできます。</p>`, btn('続投する', 'closeModal', {}, 'primary'), { size: 'wide' });

/* ---------- 遊び方（会社経営モード） ---------- */
const HELP_K = [
  ['ゲームの目的', `<p>あなたは${KS_CITY}にある会社の新しい社長です。業種は、農業・製造（町工場からレーザー加工・半導体・造船まで）・建設・電力・通信・データセンター・鉄道・航空・海運・倉庫・商社・小売・飲食・新聞・メディア・AI開発・医療・介護・教育など<b>${fmtNum(KS_TYPE_LIST.length, 0)}種類</b>から選べ、いくつかの事業を組み合わせた会社にもできます。先代から会社を引き継ぎ、商売をしながら<b>帳簿をつけ、決算書を作り、銀行からお金を借りて</b>会社を成長させてください。</p>
    <p>就任の時点で、過去4期分の決算書と帳簿ができあがっています。最初の決算は3か月後の3月末です。任期の終わりに、純資産の成長・稼ぐ力・財務の安全性・銀行の信頼・正しい決算から経営評価（S〜D）が出ます。<b>お金が尽きると</b>（資金繰りの破綻）、その時点で経営は終わります。</p>`],
  ['1か月の流れ', `<ol><li><b>現場</b>：事業ごとに、値段・人員・広告・設備投資・見積などを決める（事業の型ごとに違います）。新しい事業を始めたり、撤退したりもできます。</li><li><b>成長</b>：認証・DX・研究開発・人材への投資、海外展開、M&A、株式上場。</li><li><b>資金と銀行</b>：資金繰り表で3か月先のお金を確かめ、足りなければ融資を申し込む。</li><li><b>月末を締めて翌月へ</b>：売上・仕入・給与・経費・入金・支払・返済が自動で仕訳され、月次決算（速報）が出ます。</li></ol>
    <p>4月は予算を決める月、5月は法人税等の納付、6月と12月は賞与、3月は決算です。</p>`],
  ['決算書の読み方', `<p>決算書は3つの表でできています。${term('損益計算書', 'pl')}は1年間の成績（売上からいろいろな費用を引いて、いくら利益が残ったか）、${term('貸借対照表', 'bs')}は決算日の財産と借金の一覧、${term('キャッシュ・フロー計算書', 'cf')}はお金の動きです。</p>
    <p>損益計算書は利益を5段階で表します。売上総利益（粗利）→ 営業利益（本業のもうけ）→ 経常利益（利息なども含めた普段のもうけ）→ 税引前当期純利益（臨時の損益も含む）→ 当期純利益（税金を引いた最終のもうけ）。</p>
    <p>「資金と銀行」の<b>銀行から見たあなたの会社</b>には、銀行の審査と同じ順番で決算書を読むガイドがあります。${btn('用語集を開く', 'glossary', {}, 'sm')}</p>`],
  ['帳簿と仕訳', `<p>会社のお金やモノが動くたびに、取引を<b>仕訳</b>します。仕訳は左側（借方）と右側（貸方）に同じ金額を書く記録です。資産と費用は借方で増え、負債・純資産・収益は貸方で増えます。</p>
    <p>例：商品を掛けで仕入れた →（借方）仕入高 ／（貸方）買掛金。代金を払った →（借方）買掛金 ／（貸方）現金預金。</p>
    <p>仕訳は勘定科目ごとに<b>総勘定元帳</b>に集まり、全科目の残高を並べた<b>試算表</b>で貸借が一致しているか確かめます。「帳簿」の画面で、毎月の仕訳と解説を見られます。</p>`],
  ['決算整理', `<p>3月末に、月次の数字を正式な数字に直す<b>決算整理</b>を行います。業種によって手順が少し違います。</p>
    <ol><li><b>実地棚卸</b>：在庫を全部数え、売上原価を確定する（三分法）。帳簿より少ない分は棚卸減耗損。</li>
    <li><b>工事の確認</b>（建設業）：完成していない工事の費用は未成工事支出金、受け取ったお金は未成工事受入金。</li>
    <li><b>減価償却</b>：固定資産台帳から今期の減価償却費を計算する。</li>
    <li><b>貸倒引当金</b>：売掛金のうち回収できなくなりそうな分を見積もる。</li>
    <li><b>未払費用・前払費用</b>：今期の費用なのに払っていないもの、来期の費用なのに払ったものを調整する。</li>
    <li><b>法人税等</b>：利益にかかる税金を計上する。</li></ol>
    <p>各手順で問題が出ます。正解すると仕訳の意味が身につきます。<b>在庫を多く数えれば利益は増えますが、それは粉飾です。</b>銀行に見つかると格付が最低になり、3年間新しい融資を受けられません。</p>`],
  ['資金繰りと銀行', `<ul><li><b>運転資金</b>：仕入・給与の支払と、売上の入金の時間差を埋めるお金。売上が伸びるほど必要になる。</li>
    <li><b>手形貸付（短期）</b>：1年以内に一括で返す。格付が基準内なら期日に<b>折り返し</b>（借り直し）できる。</li>
    <li><b>証書貸付（長期）</b>：毎月元金を返す。設備資金や長めの運転資金に。</li>
    <li><b>当座貸越</b>：メインバンクの枠の範囲で、足りない時に自動で借りられる。格付6以内で枠が付く。</li>
    <li><b>信用保証協会</b>：保証料はかかるが、格付8まで借りられる。</li>
    <li><b>日本政策金融公庫</b>：3年以上の長期資金を固定金利で貸してくれる。</li></ul>
    <p>銀行は決算書から<b>格付</b>（1〜10）をつけます。自己資本比率、経常利益率、債務償還年数（借入金を何年で返せるか）、利息の支払能力、流動比率、売上の伸び、黒字の期数で決まります。資金が足りなくなったときは、一度だけ緊急の運転資金を借りられます。</p>`],
  ['予算と予実管理', `<p>4月に今期の<b>予算</b>を決めます。直近12か月の実績から予算案ができるので、売上の伸び・粗利率・人件費・経費の目標を調整して決定します。</p>
    <p>毎月の月次決算と予算を比べ、ずれ（差異）の原因を探して手を打つのが<b>予実管理</b>です。「予算と実績」の画面で、年間の見通しも確かめられます。</p>`],
  ['事業の型', `<p>${fmtNum(KS_TYPE_LIST.length, 0)}の業種は、稼ぎ方で9つの型に分かれます。同じ型の業種は、画面と決算書のしくみが同じで、数字（単価・原価率・設備・季節）が違います。</p><table class="t compact"><tbody>${Object.entries(KS_ENG_INFO).map(([k, x]) => `<tr><td><b>${esc(x.n)}</b><div class="small muted">${fmtNum(ksCountTypes(null, k), 0)}業種</div></td><td class="small">${esc(x.desc)}</td></tr>`).join('')}</tbody></table>`],
  ['成長と上場', `<p>会社が大きくなったら、<b>成長</b>の画面で次の挑戦ができます。</p><ul><li><b>投資</b>：ISOなどの認証、基幹システム・EC・AI、研究開発センター、ブランド、人事制度、太陽光発電など。効果（需要・ロス・電気代・労災・離職）と費用（資産になるもの・費用になるもの）を見て選びます。</li><li><b>海外展開</b>：輸出 → 海外営業所 → 現地の拠点と段階を踏みます。外貨で受け取る代金は、為替で円の額が変わります（為替差損益）。</li><li><b>M&A</b>：他社の事業を買い、引き継いだ資産と払った代金の差を「のれん」として10年で償却します。</li><li><b>株式上場</b>：監査法人の監査を受けた決算を2期そろえ、取引所の基準（株主数・流通株式時価総額・利益など）を満たすと、TOKYO PRO Market・グロース・スタンダード・プライムに上場できます。公募増資で資金を集められ、株価・配当・上場維持基準とも向き合います。</li></ul>`],
];
MODALS.kHelp = a => {
  const i = a.sec || 0;
  const nav = `<div class="subtabs">${HELP_K.map(([t], k) => `<button type="button" data-act="helpSec" data-sec="${k}" aria-pressed="${k === i}">${t}</button>`).join('')}</div>`;
  return modalFrame('遊び方（会社を経営する）', `${nav}<div style="max-width:90ch">${HELP_K[i][1]}</div>`, (i > 0 ? btn('前へ', 'helpSec', { sec: i - 1 }) : '') + (i < HELP_K.length - 1 ? btn('次へ', 'helpSec', { sec: i + 1 }, 'primary') : btn('閉じる', 'closeModal', {}, 'primary')), { size: 'wide' });
};

/* ---------- 保存と読み込み ---------- */
function ksSaveMeta() { const R = typeof ksRoot === 'function' ? ksRoot() : G; return JSON.stringify({ co: R.coName, ceo: R.ceo, m: R.m, desc: ksWith(R, ksCompanyDesc) || '持株会社', at: Date.now(), over: !!R.over }); }
function ksDeserialize(s) {
  if (s.version !== KS_SAVE_VERSION || !s.bal) throw new Error(s.version && s.version < KS_SAVE_VERSION ? '古い版のセーブデータです（業種が増えた新しい版では読み込めません）。新しいゲームを始めてください' : 'セーブデータの形式が違います');
  for (const u of s.units || []) if (!KS_TYPES[u.type]) throw new Error(`セーブデータの業種「${u.type}」が見つかりません`);
  G = s;
  if (typeof KS_ROOT !== 'undefined') KS_ROOT = null;
  G.pendingModals = G.pendingModals || [];
  for (const k of KS_KEYS) if (G.bal[k] === undefined) G.bal[k] = 0;
  for (const sb of (G.group ? G.group.subs : [])) for (const k of KS_KEYS) if (sb.st.bal[k] === undefined) sb.st.bal[k] = 0;
  if (!G.quiz) G.quiz = { asked: 0, correct: 0 };
  if (!G.flags) G.flags = {};
  if (!G.law && typeof ksLawInit === 'function') ksLawInit();
  if (!G.grow && typeof ksGrowInit === 'function') ksGrowInit();
  if (typeof ksExtInit === 'function' && (!G.hr || !G.loc || !G.group)) ksExtInit({ load: true });
  return G;
}
/* 今のモード（ゲーム中ならそのモード、開始画面なら選んでいるモード）の保存先 */
function lsKeys() {
  const m = G ? (isG() ? 'gyosei' : isK() ? 'kaisha' : 'bank') : (UI.start && UI.start.mode) || 'bank';
  return m === 'gyosei' ? LSG : m === 'kaisha' ? LSK : LS;
}

/* ---------- 開始画面（会社を経営する） ---------- */
function startModeSwitch() {
  const m = UI.start.mode || 'bank';
  return `<div class="modesw" role="radiogroup" aria-label="遊ぶモード">
    <button type="button" class="modebtn${m === 'bank' ? ' on' : ''}" data-act="stMode" data-v="bank" aria-pressed="${m === 'bank'}"><b>銀行を経営する</b><span>頭取として融資を審査し、銀行の決算をまとめる</span></button>
    <button type="button" class="modebtn${m === 'kaisha' ? ' on' : ''}" data-act="stMode" data-v="kaisha" aria-pressed="${m === 'kaisha'}"><b>会社を経営する</b><span>社長として商売をし、決算書を作り、銀行から借りる</span></button>
    <button type="button" class="modebtn${m === 'gyosei' ? ' on' : ''}" data-act="stMode" data-v="gyosei" aria-pressed="${m === 'gyosei'}"><b>法令を守らせる</b><span>監督署・消防署の署長として立入検査をし、労災や火災に対応する</span></button>
  </div>`;
}
function ksStartDefaults() { return UI.start.k || (UI.start.k = { units: [{ type: KS_LEGACY_TYPE.ret, sc: 1 }], cond: 'normal', term: 10, coName: '', ceo: '', seed: '', coEdited: false, q: '', sec: '', eng: '' }); }
/* 会社の名前の初めの案（いちばん目の事業の型から） */
function ksDefaultCoName(type) {
  const lid = KS_LEGACY_ID[type];
  if (lid) return `株式会社${KS_CITY}${KS_INDS[lid].core[0]}`;
  const S = KS_TYPES[type];
  const c = S ? KS_CO_CORE[S.eng] : null;
  return `株式会社${KS_CITY}${c ? c[0] : '産業'}`;
}
/* おすすめの業種（カタログにあるものだけ） */
function ksStartPicks() {
  const out = Object.values(KS_LEGACY_TYPE).filter(n => KS_TYPES[n]);
  // 言葉と事業の型の組み合わせで、代表的な業種を選ぶ
  for (const [w, e] of [['データセンター', 'cap'], ['総合商社', 'trade'], ['鉄道', 'trans'], ['航空', 'trans'], ['海運', 'trans'], ['倉庫', 'cap'], ['新聞', 'subs'], ['AI', 'pro'], ['携帯電話', 'subs'], ['ホテル', 'cap'], ['レーザー', 'mfg'], ['病院', 'cap'], ['発電', 'cap'], ['半導体', 'mfg'], ['原子力発電', 'cap'], ['防衛装備品', 'build'], ['小型衛星', 'build'], ['ナフサ', 'mfg']]) {
    const S = KS_TYPE_LIST.find(x => x.eng === e && x.name.includes(w) && !out.includes(x.name)) || KS_TYPE_LIST.find(x => x.eng === e && x.key.includes(w.toLowerCase()) && !out.includes(x.name));
    if (S) out.push(S.name);
  }
  return out.slice(0, 24);
}
function ksStartStore() {
  const k = ksStartDefaults();
  const co = $('#kstCo'), ceo = $('#kstCeo'), seed = $('#kstSeed');
  if (ceo) k.ceo = ceo.value;
  if (seed) k.seed = seed.value;
  if (co) { if (co.value.trim() && co.value.trim() !== ksDefaultCoName(k.units[0].type)) { k.coName = co.value; k.coEdited = true; } else if (!co.value.trim()) { k.coName = ''; k.coEdited = false; } }
}
function ksStartTypeRow(S, k) {
  const sel = k.units.some(x => x.type === S.name);
  return `<li class="stype${sel ? ' on' : ''}"><span class="indico" aria-hidden="true">${esc(S.icon)}</span><span class="stype-t"><b>${esc(S.name)}</b><span class="small muted">${esc(S.grp)}・${esc(KS_ENG_INFO[S.eng].n)}</span></span>
    <span class="stype-a">${btn(sel ? '選択中' : 'これにする', 'kStPick', { v: S.name }, `sm${sel ? '' : ' primary'}`, { disabled: sel })}${!sel && k.units.length < 3 ? btn('＋加える', 'kStAdd', { v: S.name }, 'sm') : ''}</span></li>`;
}
function ksStartTypesHtml(k) {
  const list = ksSearchTypes(k.q, k.sec, k.eng, 40);
  return list.length ? `<ul class="stypes">${list.map(S => ksStartTypeRow(S, k)).join('')}</ul>` : '<div class="empty">見つかりません。言葉を変えて探してください</div>';
}
function renderStartK() {
  const k = ksStartDefaults();
  k.units = k.units.filter(x => KS_TYPES[x.type]);
  if (!k.units.length) k.units = [{ type: KS_LEGACY_TYPE.ret, sc: 1 }];
  let meta = null;
  try { meta = JSON.parse(lsGet(LSK.meta('a')) || 'null'); } catch (e) { meta = null; }
  const cont = meta && !meta.over && meta.desc ? btn(`続きから（${esc(meta.co)}・${ymLabel(meta.m)}）`, 'loadAuto') : '';
  const chosen = k.units.map((x, i) => { const S = KS_TYPES[x.type]; return `<li class="sunit"><span class="indico" aria-hidden="true">${esc(S.icon)}</span><span class="stype-t"><b>${esc(S.name)}</b><span class="small muted">${esc(S.d || KS_ENG_INFO[S.eng].desc)}</span></span>
    <span class="stype-a"><span class="seg sm" role="radiogroup" aria-label="規模">${[[0.5, '小'], [1, '中'], [2, '大'], [4, '特大']].map(([v, l]) => `<button type="button" data-act="kStSc" data-i="${i}" data-v="${v}" aria-pressed="${x.sc === v}">${l}</button>`).join('')}</span>${k.units.length > 1 ? btn('外す', 'kStDel', { i }, 'sm ghost') : ''}</span></li>`; }).join('');
  const picks = ksStartPicks().map(n => `<button type="button" class="chip${k.units.some(x => x.type === n) ? ' on' : ''}" data-act="kStPick" data-v="${esc(n)}">${esc(KS_TYPES[n].icon)} ${esc(n)}</button>`).join('');
  const secs = Object.entries(KS_SECTORS).map(([c, x]) => `<option value="${c}"${k.sec === c ? ' selected' : ''}>${esc(x.n)}（${ksCountTypes(c, null)}）</option>`).join('');
  const engs = Object.entries(KS_ENG_INFO).map(([c, x]) => `<option value="${c}"${k.eng === c ? ' selected' : ''}>${esc(x.n)}</option>`).join('');
  const conds = Object.entries(KS_COND).map(([c, C]) => `<button type="button" data-act="kStCond" data-v="${c}" aria-pressed="${k.cond === c}">${C.n}</button>`).join('');
  const terms = [[10, '10年'], [20, '20年'], [0, '定めない']].map(([v, l]) => `<button type="button" data-act="kStTerm" data-v="${v}" aria-pressed="${k.term === v}">${l}</button>`).join('');
  const setup = `<section class="setup" aria-labelledby="setupTitle">
    <div class="setup-head"><h2 id="setupTitle">始め方</h2>${cont}</div>
    ${startModeSwitch()}
    <div class="field"><span>事業（${fmtNum(KS_TYPE_LIST.length, 0)}の業種から。3つまで組み合わせられます）</span><ul class="sunits">${chosen}</ul></div>
    <div class="field"><span>おすすめ</span><div class="chips">${picks}</div></div>
    <div class="field"><span>業種を探す</span><div class="row" style="gap:6px;flex-wrap:wrap"><input type="search" id="kstQ" value="${esc(k.q)}" data-in="kStQ" placeholder="例：レーザー、データセンター、航空、海運、新聞、介護" style="flex:1;min-width:12em" aria-label="業種を探す">
      <select data-ch="kStSec" aria-label="産業"><option value="">すべての産業</option>${secs}</select><select data-ch="kStEng" aria-label="事業の型"><option value="">すべての型</option>${engs}</select></div>
      <div id="kstList" class="stypes-wrap">${ksStartTypesHtml(k)}</div></div>
    <div class="field"><span>引き継ぐ会社の状態</span><div class="seg" role="radiogroup">${conds}</div><span class="small muted">${esc(KS_COND[k.cond].desc)}</span></div>
    ${typeof ksCustomHtml === 'function' ? ksCustomHtml(k) : ''}
    <div class="grid g2" style="gap:12px"><div class="field"><span>任期</span><div class="seg" role="radiogroup">${terms}</div></div>
    <label class="field"><span>シード（同じ数字なら同じ展開）</span><input type="text" id="kstSeed" value="${esc(k.seed)}" placeholder="空欄でランダム" inputmode="numeric"></label></div>
    <p class="small muted" style="margin:0">就任の時点で、先代が経営した過去4期分の決算書と帳簿があります。最初の決算は3か月後の3月末。銀行の頭取モードとは別に保存されます。</p>
  </section>`;
  const termTxt = k.term ? `${k.term === 10 ? '十' : '二十'}年とする` : '定めない';
  const desc = ksCompanyDesc(k.units.map(x => ({ type: x.type, n: null })).map(u => Object.assign(u, { sc: 1 })));
  const letter = `<div class="appoint">
    <h1>辞令</h1><div class="gametitle">社長 ― 会社経営と決算書のシミュレーション</div>
    <div class="body-text"><label><input type="text" id="kstCeo" value="${esc(k.ceo)}" placeholder="氏名" maxlength="12" aria-label="あなたの氏名"></label>　殿<br>
    貴殿を <label><input type="text" id="kstCo" value="${esc(k.coEdited ? k.coName : ksDefaultCoName(k.units[0].type))}" maxlength="18" aria-label="会社の名前" style="width:12em"></label> の代表取締役社長に選任する。<br>
    ${esc(desc)}を営む当社の経営を先代から引き継ぎ、日々の数字と毎年の決算書を自らの手で作り、取引銀行の信頼を得て、会社を健全に成長させること。<br>
    任期は${warekiYear(2027)}1月から${termTxt}。</div>
    <div class="issuer">${warekiYear(2027)}1月1日<br>株主総会・取締役会</div>
    <div class="start">${btn('就任する', 'kStart', {}, 'primary')}${btn('ファイルから読み込む', 'importSave')}${btn('遊び方', 'help')}</div>
  </div>`;
  return `${scene('hero', { cls: 'hero', alt: `港町の${CITY_NAME}の風景` })}<div class="startwrap${artSrc('hero') ? ' with-hero' : ''}">${setup}${letter}</div>`;
}
Object.assign(ACTIONS, {
  stMode: d => { if (UI.start.mode === 'gyosei') gyStartStore(); else if (UI.start.mode === 'kaisha') ksStartStore(); else if (typeof startStoreInputs === 'function') startStoreInputs(); UI.start.mode = d.v; render(); },
  kStPick: d => { ksStartStore(); const k = UI.start.k; k.units = [{ type: d.v, sc: 1 }]; if (!k.coEdited) k.coName = ''; render(); },
  kStAdd: d => { ksStartStore(); const k = UI.start.k; if (k.units.length < 3 && !k.units.some(x => x.type === d.v)) k.units.push({ type: d.v, sc: 1 }); render(); },
  kStDel: d => { ksStartStore(); const k = UI.start.k; if (k.units.length > 1) k.units.splice(+d.i, 1); render(); },
  kStSc: d => { ksStartStore(); const k = UI.start.k; if (k.units[+d.i]) k.units[+d.i].sc = +d.v; render(); },
  kStCond: d => { ksStartStore(); UI.start.k.cond = d.v; render(); },
  kStTerm: d => { ksStartStore(); UI.start.k.term = +d.v; render(); },
  kStart: () => {
    ksStartStore();
    const k = UI.start.k;
    const ceo = (k.ceo || '').trim() || `${KS_CITY} 太郎`;
    let co = (k.coEdited ? k.coName : '').trim() || ksDefaultCoName(k.units[0].type);
    if (!/株式会社|有限会社|合同会社/.test(co)) co = '株式会社' + co;
    const seedN = parseInt(String(k.seed).replace(/[^0-9]/g, ''), 10);
    const o = { units: k.units.map(x => ({ type: x.type, sc: x.sc })), coName: co, ceo, cond: k.cond, term: k.term };
    if (Number.isFinite(seedN)) o.seed = seedN;
    if (typeof ksCustomOptions === 'function') Object.assign(o, ksCustomOptions(k));
    if (typeof KS_ROOT !== 'undefined') KS_ROOT = null;
    if (o.form === 'gk') co = co.replace(/株式会社/, '合同会社'); else if (o.form === 'yk') co = co.replace(/株式会社/, '有限会社');
    o.coName = co;
    if (typeof ksNewGameCustom === 'function') ksNewGameCustom(o); else ksNewGame(o);
    UI.tab = 'k_dash'; UI.kFy = null; UI.kJm = null; UI.guideSel = null; UI.kUnit = null;
    render();
    window.scrollTo({ top: 0 });
    autosave();
    showModal('kIntro');
  },
});
Object.assign(CHANGES, {
  kStSec: el => { ksStartStore(); UI.start.k.sec = el.value; const b = $('#kstList'); if (b) b.innerHTML = ksStartTypesHtml(UI.start.k); },
  kStEng: el => { ksStartStore(); UI.start.k.eng = el.value; const b = $('#kstList'); if (b) b.innerHTML = ksStartTypesHtml(UI.start.k); },
});
INPUTS.kStQ = el => { UI.start.k.q = el.value; const b = $('#kstList'); if (b) b.innerHTML = ksStartTypesHtml(UI.start.k); };
