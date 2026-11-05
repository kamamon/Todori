'use strict';
/* =========================================================
 *  29b_kaisha_grow_ui.js : 会社経営モードの「成長」の画面
 *   会社の歩み・投資（認証・DX・研究開発・人材・省エネ）・海外展開と為替・M&A・資本政策と株式上場
 * ========================================================= */

Object.assign(UI, { kGrowU: null, kGrowSec: 'up', kMa: null, kIpoPlan: null });
function ksGrowUnit() {
  let u = UI.kGrowU && ksUnit(UI.kGrowU);
  if (!u || u.closedM) { u = ksCurUnit(); UI.kGrowU = u ? u.id : null; }
  return u;
}
const KS_ASSET_ACCTS = ['sw', 'bldg', 'mach', 'equip', 'veh'];
function ksEffText(U, u) {
  const names = { demand: '需要', shrink: '棚卸減耗', energy: '電気代', fuel: '燃料費', quit: '離職', acc: '労災', leak: '情報漏えい', food: '食中毒' };
  return Object.keys(U.eff).map(k => {
    const v = u || U.scope === 'co' ? ksUpgEffV(U, k, u || ksMainUnit()) : 1;
    const d = (v - 1) * 100;
    return `${names[k]} ${d >= 0 ? '+' : '−'}${fmtNum(Math.abs(d), Math.abs(d) < 1 ? 1 : 0)}%`;
  }).join('・');
}
function ksUnitSelect(act, cur, filter) {
  const us = ksActiveUnits().filter(filter || (() => true));
  if (us.length <= 1) return '';
  return `<label class="inline small">対象の事業 <select data-ch="${act}">${us.map(u => `<option value="${u.id}"${u === cur ? ' selected' : ''}>${esc(ksUName(u))}</option>`).join('')}</select></label>`;
}
CHANGES.kGrowU = el => { UI.kGrowU = el.value; render(); };

/* ---------- 会社の歩み ---------- */
function ksMilestoneHtml() {
  const g = G.grow;
  const items = KS_MILESTONES.map(([id, n]) => {
    const m = g.ms[id];
    const done = m !== undefined;
    return `<li class="ms${done ? ' on' : ''}"><span class="ms-dot" aria-hidden="true">${done ? '●' : '○'}</span><span><b>${esc(n)}</b><span class="small muted">${done ? (m < 0 ? '就任の前から' : ymLabel(m)) : 'まだ'}</span></span></li>`;
  }).join('');
  const n = Object.values(g.ms).filter(m => m >= (G.startedM ?? 0)).length;
  return `<p class="small" style="margin:0 0 8px">在任中に達成：<b>${n}件</b>（任期の終わりの経営評価「成長と挑戦」に入ります）</p><ul class="mslist">${items}</ul>`;
}

/* ---------- 投資 ---------- */
function ksUpgRows(cat, u) {
  return KS_UPG.filter(U => U.cat === cat).map(U => {
    const unit = U.scope === 'unit' ? u : null;
    if (U.scope === 'unit' && !u) return '';
    const st = ksUpgState(U, unit);
    const av = ksUpgAvail(U, unit);
    if (!st && !av.ok && av.why === 'この事業には合わない') return '';
    const cost = Math.round(U.cost(unit));
    const mon = U.mon ? Math.round(U.mon(unit)) : 0;
    const asset = KS_ASSET_ACCTS.includes(U.acct);
    const status = st ? (st.eff > G.m ? tag(`${ymLabel(st.eff)}から効果`, 'warn') : tag('効果あり', 'ok')) : av.ok ? '' : `<span class="small muted">${esc(av.why)}</span>`;
    return `<tr><td><b>${esc(U.n)}</b>${U.scope === 'co' ? ' <span class="tag">会社全体</span>' : ''}<div class="small muted">${esc(U.desc)}</div><div class="small">効果：${ksEffText(U, unit)}${U.dur ? `（${U.dur}か月後から）` : ''}</div></td>
      <td class="n">${fmtYen(cost)}<div class="small muted">${asset ? `${KS_ASSET_NAMES[U.acct]}・${U.life}年で償却` : `${KS_ACCT[U.acct].n}（費用）`}</div>${mon ? `<div class="small muted">毎月 ${fmtYen(mon)}</div>` : ''}</td>
      <td class="n">${st ? status : av.ok ? btn('実施する', 'kUpgDo', { id: U.id, u: unit ? unit.id : '' }, 'sm primary') : status}</td></tr>`;
  }).join('');
}
function ksUpgHtml() {
  const u = ksGrowUnit();
  const cats = Object.entries(KS_UPG_CATS).map(([c, n]) => { const rows = ksUpgRows(c, u); return rows ? `<h3 class="fsh">${esc(n)}</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>投資</th><th class="n">費用</th><th class="n"></th></tr></thead><tbody>${rows}</tbody></table></div>` : ''; }).join('');
  return `<div class="row between" style="margin-bottom:6px"><p class="small" style="margin:0">設備やシステムのように長く使うものは資産になり、何年かで償却します。認証・広告・制度づくりは、払ったときの費用です。効果は事業の数字（需要・ロス・電気代・労災など）に表れます。</p>${ksUnitSelect('kGrowU', u)}</div>${cats}`;
}
ACTIONS.kUpgDo = d => {
  const U = KS_UPG_BY[d.id];
  const u = d.u ? ksUnit(d.u) : null;
  const cost = Math.round(U.cost(u));
  if (KS_ASSET_ACCTS.includes(U.acct)) {
    ksCapexOpen({ title: `${U.n}${u ? `（${ksUName(u)}）` : ''}`, desc: `${U.desc}<br>効果：${ksEffText(U, u)}${U.mon ? `。毎月の費用 ${fmtYen(U.mon(u))}` : ''}。`, items: [{ n: U.n, acct: U.acct, cost, life: U.life, part: U.acct === 'mach' && u && ksS(u).eng === 'mfg' ? 'C' : 'S', u: u ? u.id : 'HQ' }], fx: 'upg', arg: { id: U.id, u: u ? u.id : null } });
  } else {
    confirmBox(esc(U.n), `${esc(U.desc)}<br>費用 <b>${fmtYen(cost)}</b>（${KS_ACCT[U.acct].n}として今期の費用になります）${U.mon ? `、毎月 ${fmtYen(U.mon(u))}` : ''}。<br>効果：${ksEffText(U, u)}${U.dur ? `（${ymLabel(G.m + U.dur)}から）` : ''}。`, '実施する', 'kUpgGo', { id: U.id, u: u ? u.id : '' });
  }
};
ACTIONS.kUpgGo = d => {
  if (ksB('cash') < KS_UPG_BY[d.id].cost(d.u ? ksUnit(d.u) : null)) { toast('現預金が足りません', 'bad'); return; }
  ksUpgDoExpense(d.id, d.u || null);
  toast(`${KS_UPG_BY[d.id].n}を始めました`);
  closeModal(true); render(); autosave();
};

/* ---------- 海外展開 ---------- */
function ksIntlHtml() {
  const u = ksGrowUnit();
  if (!u) return '';
  const g = G.grow;
  const rows = Object.entries(KS_REGIONS).map(([r, R]) => {
    const st = ksIntlStage(u, r);
    const nx = ksIntlNext(u, r);
    const x = (g.intl[u.id] || {})[r];
    const cur = st ? `<b>${esc(KS_INTL_ST[st].n(u))}</b><div class="small muted">${ymLabel(x.m)}から・需要＋${fmtPct(KS_INTL_ST[st].share * 100, 0)}（${R.cur === 'eur' ? 'ユーロ' : 'ドル'}建て）</div>` : '<span class="muted">まだ</span>';
    let act = '';
    if (st < 3) {
      const S2 = KS_INTL_ST[st + 1];
      const cost = Math.round(S2.cost(u));
      act = `<div class="small">次：${esc(S2.n(u))}<br>${fmtYen(cost)}${S2.mon ? `・毎月 ${fmtYen(Math.round(S2.mon(u)))}` : ''}</div>${nx.ok ? btn('進める', 'kIntlDo', { u: u.id, r }, 'sm primary') : `<span class="small muted">${esc(nx.why)}</span>`}`;
    } else act = '<span class="small muted">最後の段階</span>';
    return `<tr><td><b>${esc(R.n)}</b></td><td>${cur}</td><td class="n">${act}</td></tr>`;
  }).join('');
  const hedge = [[0, 'しない'], [0.3, '3割'], [0.5, '5割'], [0.8, '8割']].map(([v, l]) => `<button type="button" data-act="kHedge" data-v="${v}" aria-pressed="${g.hedge === v}">${l}</button>`).join('');
  return `<div class="row between" style="margin-bottom:6px"><p class="small" style="margin:0">輸出 → 海外営業所 → 現地の拠点（工場・店舗）と段階を踏みます。海外の売上は外国の通貨で受け取るので、円安なら円での売上が増え、円高なら減ります。</p>${ksUnitSelect('kGrowU', u)}</div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>地域</th><th>いまの段階</th><th class="n">次の段階</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="grid g2" style="margin-top:10px">${panel('為替', kv([['1ドル', `${fmtNum(G.eco.fx || 148, 1)}円`], ['1ユーロ', `${fmtNum(G.eco.eur || 160, 1)}円`], ['今期の為替差損益（実現）', `<span class="${(g.fxYTD || 0) < 0 ? 'neg' : ''}">${fmtYen(g.fxYTD || 0)}</span>`]]))}
    ${panel(term('為替予約', 'fxHedge'), `<div class="seg" role="radiogroup">${hedge}</div><p class="small" style="margin:6px 0 0">外貨で受け取る代金のうち、予約した分は売ったときのレートで円にできます。為替差損益が小さくなる代わりに、円安の得もなくなります。</p>`)}</div>`;
}
ACTIONS.kHedge = d => { G.grow.hedge = +d.v; render(); };
ACTIONS.kIntlDo = d => {
  const u = ksUnit(d.u);
  const nx = ksIntlNext(u, d.r);
  if (!nx.ok) return;
  const st = nx.st;
  const cost = Math.round(st.cost(u));
  const nm = `${KS_REGIONS[d.r].n}：${st.n(u)}`;
  if (KS_ASSET_ACCTS.includes(st.acct)) ksCapexOpen({ title: nm, desc: `${esc(st.desc)}<br>毎月の運営費 ${fmtYen(Math.round(st.mon(u)))}。`, items: [{ n: `${ksUName(u)}の${st.n(u)}（${KS_REGIONS[d.r].n}）`, acct: st.acct, cost, life: st.life, part: 'S', u: u.id, openM: st.acct === 'bldg' ? G.m + 9 : undefined }], fx: 'intl', arg: { u: u.id, r: d.r } });
  else confirmBox(esc(nm), `${esc(st.desc)}<br>費用 <b>${fmtYen(cost)}</b>（支払手数料）、毎月 ${fmtYen(Math.round(st.mon(u)))}。`, '始める', 'kIntlGo', { u: u.id, r: d.r });
};
ACTIONS.kIntlGo = d => { ksIntlDoExpense(d.u, d.r); toast('海外展開を始めました'); closeModal(true); render(); autosave(); };

/* ---------- M&A ---------- */
function ksMaHtml() {
  const g = G.grow;
  const list = (g.ma && g.ma.list) || [];
  const rows = list.map(c => {
    const S = KS_TYPES[c.type];
    if (!S) return '';
    const q = ksMaQuote(c);
    return `<tr><td><b>${esc(c.co)}</b><div class="small muted">${esc(S.name)}・${esc(KS_ENG_INFO[S.eng].n)}</div></td><td class="n">${fmtYen(q.annual)}<div class="small muted">従業員 ${fmtNum(q.head, 0)}人</div></td><td class="n">${fmtYen(q.opi)}</td><td class="n">${fmtYen(q.net)}</td><td class="n"><b>${fmtYen(q.price)}</b><div class="small muted">のれん ${fmtYen(q.price - q.net)}</div></td><td class="n">${btn('検討する', 'kMaOpen', { id: c.id }, 'sm primary')}</td></tr>`;
  }).join('');
  return `<p class="small" style="margin:0 0 8px">ほかの会社の事業を、設備・在庫・従業員・取引先ごと買います（事業の譲受）。自分で一から始めるより早く大きくなれますが、引き継いだ資産より高く払った分は${term('のれん', 'goodwill')}になり、10年で償却します（のれん償却額・販管費）。</p>
    ${rows ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>候補</th><th class="n">年商</th><th class="n">営業利益の見込み</th><th class="n">引き継ぐ資産</th><th class="n">買収の価格</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">候補はまだありません</div>'}
    <div class="row" style="margin-top:10px">${btn(`候補を探す（仲介会社の着手金 ${fmtYen(KS_MA_FEE)}）`, 'kMaFind', {}, rows ? 'sm' : 'sm primary')}${g.maDone ? `<span class="small muted">これまでのM&A ${g.maDone}件</span>` : ''}</div>`;
}
ACTIONS.kMaFind = () => { if (ksB('cash') < KS_MA_FEE) { toast('現預金が足りません', 'bad'); return; } ksMaFind(); toast('仲介会社が候補を見つけてきました'); render(); };
ACTIONS.kMaOpen = d => { UI.kMa = { id: d.id, fin: 'cash', bank: 'mirai', termM: 84, res: null }; showModal('kMa'); };
MODALS.kMa = () => {
  const M = UI.kMa;
  const c = G.grow.ma.list.find(x => x.id === M.id);
  if (!c) return modalFrame('M&A', '<p>候補が見つかりません</p>', btn('閉じる', 'closeModal'));
  const S = KS_TYPES[c.type];
  const q = ksMaQuote(c);
  const seg = (act, list, cur) => `<div class="seg wrap" role="radiogroup">${list.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  let fin = `<div class="field"><span>お金の出し方</span>${seg('kMaFin', [['cash', '手元の資金で払う'], ['loan', '銀行から買収資金を借りる']], M.fin)}</div>`;
  if (M.fin === 'loan') {
    fin += `<div class="field"><span>金融機関</span>${seg('kMaBank', Object.entries(KS_BANKS).map(([k, b]) => [k, b.short]), M.bank)}</div><div class="field"><span>期間</span>${seg('kMaTerm', [[60, '5年'], [84, '7年'], [120, '10年']], M.termM)}</div>`;
    if (M.res) fin += M.res.ok ? `<div class="callout ok"><b>${KS_BANKS[M.bank].short}：${fmtYen(M.res.amt)}をお貸しできます</b>（年${fmtNum(M.res.rate, 2)}%）</div>` : `<div class="callout bad"><b>今回はお貸しできません</b><ul style="margin:6px 0 0;padding-left:1.2em">${M.res.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  }
  const body = `<p style="margin:0 0 8px"><b>${esc(c.co)}</b>の${esc(S.name)}の事業を買います。${esc(S.d || '')}</p>
    ${kv([['年商（見込み）', fmtYen(q.annual)], ['営業利益（見込み）', fmtYen(q.opi)], ['従業員', `${fmtNum(q.head, 0)}人`], ['引き継ぐ資産（設備・在庫など、時価）', fmtYen(q.net)], ['買収の価格', `<b>${fmtYen(q.price)}</b>`], ['のれん（価格 − 資産）', `${fmtYen(q.price - q.net)}（10年で償却：年${fmtYen((q.price - q.net) / 10)}）`]])}
    <div class="callout" style="margin-top:8px"><b>仕訳</b>　（借方）設備・在庫など ${fmtYen(q.net)} ＋ のれん ${fmtYen(q.price - q.net)} ／（貸方）現金預金 ${fmtYen(q.price)}。売掛金と買掛金は引き継ぎません。</div>
    ${fin}`;
  let foot = btn('やめる', 'closeModal');
  if (M.fin === 'loan' && !(M.res && M.res.ok)) foot += btn('銀行に相談する', 'kMaEval', {}, 'primary');
  else foot += btn('買収する', 'kMaGo', {}, 'primary', { disabled: ksB('cash') + (M.res && M.res.ok ? M.res.amt : 0) < q.price });
  return modalFrame('M&A（事業の譲受）', body, foot);
};
Object.assign(ACTIONS, {
  kMaFin: d => { UI.kMa.fin = d.v; UI.kMa.res = null; drawModal(); },
  kMaBank: d => { UI.kMa.bank = d.v; UI.kMa.res = null; drawModal(); },
  kMaTerm: d => { UI.kMa.termM = +d.v; UI.kMa.res = null; drawModal(); },
  kMaEval: () => { const M = UI.kMa; const c = G.grow.ma.list.find(x => x.id === M.id); const q = ksMaQuote(c); M.res = ksEvalLoan({ bank: M.bank, purpose: 'capex', amt: niceAmount(Math.max(1e7, q.price - Math.max(0, ksB('cash') - ksMonthlyFixedOut() * 2))), termM: M.termM, cgc: false, item: { cost: q.price } }); drawModal(); },
  kMaGo: () => {
    if (ksClosingBlock()) return;
    const M = UI.kMa;
    const c = G.grow.ma.list.find(x => x.id === M.id);
    if (!c) return;
    if (M.fin === 'loan' && M.res && M.res.ok) { ksBorrow({ bank: M.bank, purpose: 'capex', amt: M.res.amt, termM: M.termM, cgc: false }, M.res); ksNews(`${KS_BANKS[M.bank].short}から買収資金${fmtYen(M.res.amt)}を借りました`, 'bank'); }
    const q = ksMaQuote(c);
    if (ksB('cash') < q.price) { toast('現預金が足りません', 'bad'); return; }
    const r = ksMaBuy(c);
    UI.kMa = null; UI.kUnit = r.u.id;
    toast(`${c.co}の事業を買収しました`);
    closeModal(true); render(); autosave();
  },
});

/* ---------- 資本政策と上場 ---------- */
function ksIpoHtml() {
  const g = G.grow;
  const ipo = g.ipo;
  const val = ksValuation();
  const listed = ipo.st === 'listed';
  const price = ksSharePrice();
  const mcap = price * ipo.shares;
  const own = kv([['発行済株式数', `${fmtNum(ipo.shares, 0)}株`], ['社長・創業家', fmtPct(ipo.own * 100, 1)], ['ベンチャーキャピタル', fmtPct((ipo.vc || 0) * 100, 1)], ['そのほか（役員・社員・取引先・投資家）', fmtPct((1 - ipo.own - (ipo.vc || 0)) * 100, 1)], listed ? null : ['創業家の持ち株の価値（理論）', fmtYen(mcap * ipo.own)], ipo.ownerCash ? ['上場で売り出して得たお金（社長・創業家）', fmtYen(ipo.ownerCash)] : null].filter(Boolean));
  const valH = kv([[listed ? '株価' : '1株の理論価格', `${fmtNum(price, price < 100 ? 1 : 0)}円`], [listed ? '時価総額' : '会社の価値（理論）', fmtYen(mcap)], [val.basis === 'per' ? 'PER（株価÷1株あたり利益）' : 'PSR（時価総額÷売上）', val.basis === 'per' ? `${fmtNum(mcap / Math.max(1, val.ni), 1)}倍` : `${fmtNum(mcap / Math.max(1, val.sales), 2)}倍`], ['PBR（株価÷1株あたり純資産）', `${fmtNum(mcap / Math.max(1, val.eq), 2)}倍`], ['株式市場の指数', fmtNum((G.eco.stk || 1) * 100, 0)]]) + (listed ? '' : '<p class="small muted" style="margin:6px 0 0">上場していない株は自由に売れないので、理論の価値から3割ほど割り引いて評価しています。</p>');
  const chart = listed && ipo.hist.length >= 2 ? lineChart({ labels: ipo.hist.map(x => `${ymOf(x.m).mo}月`), height: 160, series: [{ name: '株価', color: 's2', values: ipo.hist.map(x => x.p) }] }) : '';
  const divs = [[0, 'なし'], [0.2, '20%'], [0.3, '30%'], [0.4, '40%']].map(([v, l]) => `<button type="button" data-act="kPayout" data-v="${v}" aria-pressed="${g.payout === v}">${l}</button>`).join('');
  let stage = '';
  if (ipo.st === 'none') {
    stage = `<p class="small" style="margin:0 0 8px">株式を上場すると、たくさんの投資家から資金を集め（公募増資）、会社の信用と知名度が上がります。そのかわり、監査法人の監査・内部管理の体制・情報の開示にお金がかかり（年数千万円）、株主への説明責任を負います。</p>
      ${btn('上場の準備を始める', 'kIpoPrep', {}, 'primary')}<span class="small muted">　準備中の費用：監査報酬・証券会社とコンサル・管理部門の増員で年 約${fmtYen(1500e4 + ksAnnualSales() * 0.0003 + 800e4 + 1800e4)}</span>`;
  } else if (ipo.st === 'prep') {
    const mks = Object.keys(KS_MARKETS);
    const checks = Object.fromEntries(mks.map(mk => [mk, ksIpoChecks(mk, ksIpoPlan(mk, mk === 'tpm' ? 0 : 0.2, mk === 'tpm' ? 0 : 0.3))]));
    const allN = [...new Set(mks.flatMap(mk => checks[mk].map(c => c.n)))];
    const rows = allN.map(n => `<tr><td class="small">${esc(n)}</td>${mks.map(mk => { const c = checks[mk].find(x => x.n === n); return `<td class="n small">${c ? `${c.ok ? '<span class="pos">○</span>' : '<span class="neg">×</span>'} ${esc(c.v)}` : '―'}</td>`; }).join('')}</tr>`).join('');
    stage = `<p class="small" style="margin:0 0 8px">準備を始めた${ymLabel(ipo.prepM)}から監査を受けています。基準をすべて満たした市場に、上場を申請できます（審査は約3か月）。${ipo.fails ? `これまでに審査に${ipo.fails}回通りませんでした。` : ''}</p>
      <div class="tbl-wrap"><table class="t"><thead><tr><th>基準</th>${mks.map(mk => `<th class="n">${esc(KS_MARKETS[mk].s)}</th>`).join('')}</tr></thead><tbody>${rows}
      <tr><td></td>${mks.map(mk => `<td class="n">${checks[mk].every(c => c.ok) ? btn('申請する', 'kIpoApplyOpen', { mk }, 'sm primary') : ''}</td>`).join('')}</tr></tbody></table></div>
      <p class="note">${Object.values(KS_MARKETS).map(m => `<b>${esc(m.s)}</b>：${esc(m.desc)}`).join('<br>')}</p>`;
  } else if (ipo.st === 'review') {
    stage = `<p class="callout">${KS_MARKETS[ipo.plan.mk].n}への上場を審査中です。結果は${ymLabel(ipo.applyM + 3)}にわかります。</p>`;
  } else if (listed) {
    stage = `${kv([['市場', KS_MARKETS[ipo.market].n], ['上場', `${ymLabel(ipo.listM)}（公開価格 ${fmtNum(ipo.offer, 0)}円）`], ['流通株式比率', fmtPct(ipo.floatR * 100, 1)], ['流通株式時価総額', fmtYen(mcap * ipo.floatR)]])}
      ${ipo.warn ? `<p class="callout bad">上場維持基準を満たしていません（${esc(ipo.warn.fails.join('・'))}）。${ymLabel(ipo.warn.m + 12)}の判定までに適合しないと上場廃止になります。</p>` : ''}
      <div class="row" style="margin-top:8px">${btn('公募増資をする', 'kPoOpen', {}, 'sm')}${ksNextMarket() ? btn(`${KS_MARKETS[ksNextMarket()].s}市場に移る`, 'kMarketUp', {}, 'sm') : ''}</div>`;
  } else if (ipo.st === 'delisted') {
    stage = `<p class="callout bad">${ymLabel(ipo.delistM)}に上場廃止になりました。株主は取引所で株を売れなくなりました。</p>`;
  }
  const vc = ipo.st !== 'listed' ? `<div style="margin-top:10px">${btn('ベンチャーキャピタルから出資を受ける（第三者割当増資）', 'kVcOpen', {}, 'sm')}<span class="small muted">　返済のいらないお金。かわりに社長の持ち株比率が下がり、上場を期待されます。</span></div>` : '';
  return `<div class="grid g2">${panel('株主と持ち株', own + vc)}${panel(listed ? '株価' : '会社の価値', chart + valH)}</div>
    <div style="margin-top:12px">${panel('株式上場', stage)}</div>
    <div style="margin-top:12px">${panel('配当', `<div class="field"><span>${term('配当性向', 'payout')}（当期純利益のうち配当に回す割合）</span><div class="seg" role="radiogroup">${divs}</div></div><p class="small" style="margin:6px 0 0">6月の株主総会で決め、前期の利益から払います。配当は費用ではなく、繰越利益剰余金から払う「利益の分配」です。資本準備金と利益準備金が資本金の4分の1になるまで、配当の10分の1を利益準備金に積みます。${g.divPaid ? `これまでの配当 ${fmtYen(g.divPaid)}。` : ''}</p>`)}</div>`;
}
function ksNextMarket() {
  const ipo = G.grow.ipo;
  if (ipo.st !== 'listed') return null;
  const order = ['tpm', 'growth', 'standard', 'prime'];
  const i = order.indexOf(ipo.market);
  for (let k = order.length - 1; k > i; k--) { const mk = order[k]; const ch = ksIpoChecks(mk, { float: ipo.floatR }).filter(c => !/監査|内部管理/.test(c.n)); if (ch.every(c => c.ok)) return mk; }
  return null;
}
Object.assign(ACTIONS, {
  kPayout: d => { G.grow.payout = +d.v; render(); },
  kIpoPrep: () => confirmBox('上場の準備を始める', `監査法人と契約して決算書の監査を受け、主幹事の証券会社を選び、社内の管理の体制を整えます。上場の申請は、監査を受けた決算が2期そろい、準備から2年たってからです。準備中の費用は年 約${fmtYen(1500e4 + ksAnnualSales() * 0.0003 + 800e4 + 1800e4)}（上場関連費用・販管費）。`, '準備を始める', 'kIpoPrepGo', {}),
  kIpoPrepGo: () => { ksIpoPrep(); closeModal(true); render(); autosave(); },
  kIpoApplyOpen: d => { UI.kIpoPlan = { mk: d.mk, newR: d.mk === 'tpm' ? 0 : 0.2, sellR: d.mk === 'tpm' ? 0 : 0.3 }; showModal('kIpoApply'); },
  kIpoNew: d => { UI.kIpoPlan.newR = +d.v; drawModal(); },
  kIpoSell: d => { UI.kIpoPlan.sellR = +d.v; drawModal(); },
  kIpoApplyGo: () => { const P = UI.kIpoPlan; const plan = ksIpoPlan(P.mk, P.newR, P.sellR); ksIpoApply(P.mk, plan); UI.kIpoPlan = null; closeModal(true); render(); autosave(); },
  kPoOpen: () => confirmBox('公募増資', `新しい株を発行して、投資家からお金を集めます（時価の3%引き）。資本金と資本準備金が増え、借入金と違って返す必要はありませんが、1株の価値が薄まる（希薄化）ので株価は少し下がります。<br>約${fmtYen(Math.round(ksMcap() * 0.1 / 1e6) * 1e6)}（時価総額の1割）を集めます。`, '増資する', 'kPoGo', {}),
  kPoGo: () => { ksIpoPO(Math.round(ksMcap() * 0.1 / 1e6) * 1e6); closeModal(true); render(); autosave(); },
  kVcOpen: () => { const v = ksValuation().v; confirmBox('第三者割当増資（ベンチャーキャピタル）', `会社の価値（理論）${fmtYen(v)}をもとに、価値の1割ほど（約${fmtYen(Math.round(v * 0.1 / 1e6) * 1e6)}）の出資を受けます。現預金と資本金・資本準備金が増え、社長の持ち株比率が下がります。ベンチャーキャピタルは数年後の上場を期待します。`, '出資を受ける', 'kVcGo', {}); },
  kVcGo: () => { ksVcRaise(Math.round(ksValuation().v * 0.1 / 1e6) * 1e6); closeModal(true); render(); autosave(); },
  kMarketUp: () => { const mk = ksNextMarket(); if (!mk) return; const ipo = G.grow.ipo; ksPost('listFee', [['listFee', 1000e4, 0], ['cash', 0, 1000e4]], { cf: 'exp', u: 'HQ', desc: '市場区分の変更の審査料など' }); ksNews(`${KS_MARKETS[ipo.market].n}から${KS_MARKETS[mk].n}に移りました`, 'good'); ipo.market = mk; ipo.warn = null; render(); },
});
MODALS.kIpoApply = () => {
  const P = UI.kIpoPlan;
  const mk = P.mk;
  const plan = ksIpoPlan(mk, P.newR, P.sellR);
  const chk = ksIpoChecks(mk, plan);
  const seg = (act, list, cur) => `<div class="seg wrap" role="radiogroup">${list.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const body = `<p style="margin:0 0 8px">${esc(KS_MARKETS[mk].n)}への上場を申請します。${esc(KS_MARKETS[mk].desc)}</p>
    ${mk !== 'tpm' ? `<div class="field"><span>公募（新しく発行する株：いまの株数に対して）</span>${seg('kIpoNew', [[0.1, '10%'], [0.2, '20%'], [0.3, '30%'], [0.5, '50%']], P.newR)}</div>
    <div class="field"><span>売出（社長・創業家が売る株：持ち株に対して）</span>${seg('kIpoSell', [[0, 'なし'], [0.15, '15%'], [0.3, '30%'], [0.45, '45%']], P.sellR)}</div>` : ''}
    ${kv([['公開価格の見込み（1株、株式分割の前）', `${fmtNum(plan.price, 0)}円`], ['公募で会社に入るお金', `${fmtYen(plan.raise)}（引受手数料 ${fmtYen(plan.fee)}）`], ['売出で社長・創業家が得るお金', fmtYen(plan.ownerCash)], ['流通株式比率', fmtPct(plan.float * 100, 1)]])}
    <table class="t compact" style="margin-top:8px"><tbody>${chk.map(c => `<tr><td class="small">${esc(c.n)}</td><td class="n small">${c.ok ? '<span class="pos">○</span>' : '<span class="neg">×</span>'} ${esc(c.v)}</td></tr>`).join('')}</tbody></table>
    <p class="note">公募で集めたお金の半分以上を資本金、残りを資本準備金にします。上場の審査では、基準の数字のほかに、内部管理の体制・法令の順守・銀行の評価も見られます。</p>`;
  return modalFrame('上場を申請する', body, btn('やめる', 'closeModal') + btn('申請する', 'kIpoApplyGo', {}, 'primary', { disabled: !chk.every(c => c.ok) }), { size: 'narrow' });
};
MODALS.kIpoResult = a => {
  if (a.ok) return modalFrame('上場しました', `<p style="margin:0 0 8px"><b>${esc(G.coName)}</b>は${esc(KS_MARKETS[a.mk].n)}に上場しました。公開価格 ${fmtNum(a.price, 0)}円、公募増資で ${fmtYen(a.raise)} を調達しました。</p><ul class="small" style="padding-left:1.2em"><li>集めたお金は資本金と資本準備金になり、返す必要はありません。</li><li>これからは毎月株価が動き、決算のたびに投資家に説明します。上場維持基準（時価総額など）を下回ると、上場廃止になることもあります。</li><li>監査・開示・株主総会などの費用が毎年かかります。</li></ul>`, btn('成長の画面へ', 'kGo', { tab: 'k_grow' }) + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
  return modalFrame('上場の審査に通りませんでした', `<p style="margin:0 0 8px">取引所と主幹事証券の審査で、次の点を指摘されました。</p><ul class="small" style="padding-left:1.2em">${(a.why || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul><p class="small">準備を続けて、基準を満たしてから申請し直しましょう。</p>`, btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
};

/* ---------- 画面 ---------- */
KS_SCREENS.k_grow = () => {
  const sec = UI.kGrowSec || 'up';
  const subs = [['up', '投資'], ['intl', '海外展開'], ['ma', 'M&A'], ['ipo', '資本政策と上場'], ['ms', '会社の歩み']];
  const body = sec === 'up' ? ksUpgHtml() : sec === 'intl' ? ksIntlHtml() : sec === 'ma' ? ksMaHtml() : sec === 'ipo' ? ksIpoHtml() : ksMilestoneHtml();
  return `<h1 class="h1">成長</h1><p class="lead">会社を大きく、強くするための挑戦です。お金をかける前に、効果と費用が決算書のどこに表れるかを確かめましょう。</p>
    <div class="subtabs" role="tablist">${subs.map(([k, l]) => `<button type="button" data-act="kGrowSec" data-v="${k}" aria-pressed="${sec === k}">${l}</button>`).join('')}</div>${body}`;
};
ACTIONS.kGrowSec = d => { UI.kGrowSec = d.v; render(); };
