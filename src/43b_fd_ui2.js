'use strict';
/* =========================================================
 *  43b_fd_ui2.js : 創業記モードの画面（その2）
 *   工場、人と組織、世界、お金、社史、四半期の締め、モーダル（出来事・決算・発売・後継者・救済・終わり・遊び方）、開始画面
 * ========================================================= */

/* ---------- 工場 ---------- */
FD_SCREENS.f_fac = () => {
  const y = fdYf();
  const facs = G.facs.map(f => {
    const lines = f.lines.map(l => {
      const uc = fdUnitCost(l.cat, f, y);
      const ready = (l.ready ?? 0) <= G.q && f.ready <= G.q;
      return `<tr><td>${esc(fdCat(l.cat).n)}${ready ? '' : ` ${tag(`${fdY(Math.max(l.ready ?? 0, f.ready))}年${fdQo(Math.max(l.ready ?? 0, f.ready)) + 1}Qに完成`, 'warn')}`}</td><td class="n">${fmtNum(l.cap, 0)}${esc(fdCat(l.cat).unit)}/年</td><td class="n">${fmtPct((l.auto || 0) * 100, 0)}</td><td class="n">${uc ? `${fmtNum(uc.hrs, uc.hrs < 10 ? 1 : 0)}時間` : '―'}</td><td class="n">${uc ? fmtYen(uc.v) : '―'}</td>
        <td class="n nowrap">${btn('広げる', 'fLineOpen', { f: f.id, c: l.cat }, 'sm')}${btn('自動化', 'fAuto', { f: f.id, c: l.cat }, 'sm', { disabled: (l.auto || 0) >= fdAutoMax(y) - 0.005 })}</td></tr>`;
    }).join('');
    return panel(`${esc(f.n)}`, `<p class="small muted" style="margin:0 0 8px">${esc(FD_REG[f.r].n)}・${esc(f.loc)}・${fdY(f.q0)}年から${f.ready > G.q ? `・建設中（${fdY(f.ready)}年${fdQo(f.ready) + 1}Qに完成）` : ''}・工員 ${fmtNum(f.wk || 0, 0)}人・稼働 ${fmtPct((f.util || 0) * 100, 0)}・腕 ${fmtNum(f.skill || 1, 2)}${f.dmgF > 1.01 ? ` ・<span class="neg">被害で能力が${fmtPct((1 - 1 / f.dmgF) * 100, 0)}落ちている</span>` : ''}</p>
      ${lines ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>ライン</th><th class="n">能力</th><th class="n">自動化</th><th class="n">1台の工数</th><th class="n">1台の原価</th><th class="n"></th></tr></thead><tbody>${lines}</tbody></table></div>` : '<div class="empty">まだラインがありません</div>'}
      <div class="row" style="margin-top:8px">${btn('ラインを足す', 'fLineOpen', { f: f.id }, 'sm')}${f.dmgF > 1.01 ? btn('被害を直す', 'fRepair', { f: f.id }, 'sm primary') : ''}</div>`, { aside: '' });
  }).join('');
  const short = fdShortCats().map(s => `<li>${esc(fdCat(s.c).n)}：売れる台数の${fmtPct(s.cap / s.want * 100, 0)}しか作れない</li>`).join('');
  const progs = ['school', 'kaizen', 'qc'].map(fdProgRow).join('<hr class="sep">');
  return `<h1 class="h1">工場</h1><p class="lead">ラインの能力が、作れる数の上限です。1台を作る時間（工数）は、生産技術の水準・自動化・カイゼン・作った数の累計（慣れ）・工員の腕で減ります。工員は必要な人数に合わせて自動で採用します（減らすのは自然に辞める分だけ）。</p>
    ${short ? `<div class="callout bad" style="margin-bottom:12px"><b>能力が足りない分野</b><ul style="margin:4px 0 0;padding-left:18px">${short}</ul></div>` : ''}
    <div class="grid g-side"><div class="stack">${facs}</div><div class="stack">
      ${panel('工場を建てる', `<p class="small" style="margin:0 0 8px">建物と土地：日本で約${fmtYen(fdFacCost('jp'))}（完成まで約1年）。海外の工場は、その地域に販売会社を作ったあとに建てられます。</p>${btn('新しい工場を建てる', 'fFacOpen', {}, 'primary')}`)}
      ${panel('ものづくりの仕組み', progs)}
    </div></div>`;
};

/* ---------- 人と組織 ---------- */
FD_SCREENS.f_people = () => {
  const y = fdYf();
  const head = fdHead();
  const roles = Object.entries(FD_ROLES).map(([k, R]) => `<tr><td><b>${esc(R.n)}</b><div class="small muted">${esc(R.d)}</div></td><td class="n">${fmtNum(G.staff[k], 0)}人</td><td class="n">${fmtYen(fdPayQ(k) / 3)}</td></tr>`).join('');
  const ppl = G.people.filter(p => !p.gone).sort((a, b) => (a.role === 'ceo' ? -1 : 0) - (b.role === 'ceo' ? -1 : 0)).map(p => `<div class="person"><div class="pn"><b>${esc(p.n)}</b><span class="small muted">${esc(FD_ROLE_N[p.role] || '')}・${fdAge(p)}歳${p.founder ? '・創業者' : ''}</span></div>
    <div class="pab small">${[['tech', '技術'], ['prod', '生産'], ['sales', '営業'], ['fin', '財務'], ['lead', '統率']].map(([k, n]) => `<span>${n}<b>${'●'.repeat(p.abil[k])}<i>${'○'.repeat(5 - p.abil[k])}</i></b></span>`).join('')}</div>
    <div class="small muted">${esc((FD_TRAITS.find(t => t.id === p.trait) || {}).d || '')}</div></div>`).join('');
  const st = fdOrgStage();
  const O = FD_ORG[st], nx = FD_ORG[st + 1];
  const fr = fdOrgFriction();
  const orgHtml = `<div class="orgsteps">${FD_ORG.map((o, i) => `<div class="${i < st ? 'done' : i === st ? 'now' : ''}"><span class="n">${i + 1}</span><span>${esc(o.n)}</span></div>`).join('')}</div>
    <p class="small" style="margin:8px 0">${esc(O.d)}</p>
    ${nx ? `<div class="callout${fr > 0.02 ? ' bad' : ''}"><b>${esc(O.crisis)}</b>：社員が${fmtNum(nx.min, 0)}人を超えると起きる（いま${fmtNum(head, 0)}人）。${fr > 0 ? `いま生産性と開発が<b>${fmtPct(fr * 100, 0)}</b>落ちています。` : ''}<br>乗り越え方：${esc(O.fixN)}</div>
      <div class="row" style="margin-top:8px">${btn('組織を改める', 'fOrg', {}, fr > 0 ? 'primary' : '', { disabled: head < nx.min * 0.7 })}<span class="small muted">${head < nx.min * 0.7 ? `社員が${fmtNum(Math.ceil(nx.min * 0.7), 0)}人を超えたら行えます` : `費用 約${fmtYen(fdPayQ('adm') * Math.max(4, head * 0.02))}`}</span></div>` : '<p class="small muted">組織は最後の段階です。</p>'}`;
  const wage = `<div class="seg" role="radiogroup" aria-label="賃金の水準">${[[-10, '世間より低い'], [0, '世間並み'], [10, '高め'], [20, 'かなり高め']].map(([v, l]) => `<button type="button" data-act="fWage" data-v="${v}" aria-pressed="${(G.policy.wage || 0) === v}">${l}</button>`).join('')}</div>`;
  const union = y >= 1945 ? `<p class="small" style="margin:8px 0 0">労働組合：${G.union ? `組合員 約${fmtNum(head * 0.8, 0)}人・関係 ${G.union.mood >= 0.6 ? '良い' : G.union.mood >= 0.35 ? 'ふつう' : '<span class="neg">険しい</span>'}` : 'まだない'}</p>` : '';
  return `<h1 class="h1">人と組織</h1><p class="lead">工員と営業・事務は必要な人数に合わせて自動で増やします。技術者の数は「技術と開発」で決めます。会社が大きくなると、それまでの組織のやり方が通じなくなる「危機」が来ます。</p>
    <div class="grid g-side"><div class="stack">
      ${panel('社員', `<div class="tbl-wrap"><table class="t"><thead><tr><th>職種</th><th class="n">人数</th><th class="n">1人の月の人件費</th></tr></thead><tbody>${roles}</tbody></table></div>
        <div class="field" style="margin-top:10px"><span>賃金の水準</span>${wage}<span class="small muted">高めにすると、よい人が集まり辞めにくい（腕が上がりやすく、争議が起きにくい）が、人件費が増える。</span></div>${union}`)}
      ${panel('組織の段階', orgHtml)}
    </div><div class="stack">
      ${panel('経営陣', `<div class="people">${ppl}</div>`)}
    </div></div>`;
};

/* ---------- 世界 ---------- */
FD_SCREENS.f_world = () => {
  const y = fdYf();
  const rows = fdRegOrder().map(r => {
    const R = G.reg[r], RR = FD_REG[r];
    const acc = fdRegAccess(r, y);
    const sales = fdLastYearReg(r);
    const nx = R.st + 1;
    let act = '';
    if (acc < 1 && r !== 'jp') act = `<span class="small muted">${esc(fdAccessWhy(r))}</span>`;
    else if (nx <= 4) {
      if (r !== 'jp' && nx === 3) act = btn('工場を建てる', 'fFacOpen', { r }, 'sm', { disabled: acc < 3 });
      else act = btn(fdStageN(r, nx), 'fRegStep', { r }, 'sm', { disabled: G.bs.cash < fdRegStepCost(r, nx) || (r !== 'jp' && acc < Math.min(nx, 2)) });
    }
    return `<tr><td><b>${esc(RR.n)}</b><div class="small muted">${esc(fdStageN(r, R.st))}</div></td><td class="n">${R.st ? fmtPct(R.dist * 100, 0) : '―'}</td><td class="n">${R.st ? fmtNum(R.brand, 0) : '―'}</td><td class="n">${sales ? fmtYen(sales) : '―'}</td>
      <td class="n nowrap">${act}${nx <= 4 && !(r !== 'jp' && nx === 3) && acc >= 1 ? `<div class="small muted">${fmtYen(fdRegStepCost(r, nx))}</div>` : ''}</td></tr>`;
  }).join('');
  const fx = fdFx(y), rel = fdRerRel(y);
  return `<h1 class="h1">世界</h1><p class="lead">地域ごとに、輸出（商社を通す）→ 販売会社 → 現地生産 → 現地で開発、と進めます。販路が広がるほど多く売れ、ブランドは年月と品質で育ちます。日本から輸出すると、関税・運賃・為替の影響を受けます。</p>
    <div class="grid g-side"><div class="stack">
      ${panel('地域', `<div class="tbl-wrap"><table class="t"><thead><tr><th>地域</th><th class="n">販路</th><th class="n">ブランド</th><th class="n">去年の売上</th><th class="n">次の一手</th></tr></thead><tbody>${rows}</tbody></table></div>`, { flush: true })}
    </div><div class="stack">
      ${panel('為替', `${kv([['1ドル', `${fmtNum(fx, fx < 10 ? 2 : 0)}円`], ['円の強さ（前後の年の平均＝1）', `${fmtNum(rel, 2)}`], ['輸出品の海外での値段', `${fmtPct((fdFxPass(y) - 1) * 100, 0, { sign: true })}`], ['輸出の円での手取り', `${fmtPct((fdFxTake(y) - 1) * 100, 0, { sign: true })}`]])}<p class="small muted" style="margin:8px 0 0">${rel > 1.15 ? '円が強い：日本から輸出する品は海外で割高になり、輸入品は日本で割安になります。海外で作ると有利です。' : rel < 0.87 ? '円が弱い：日本から輸出する品は海外で割安になり、輸入品は日本で割高です。輸出に有利です。' : '円の強さはふつうです。'}</p>`)}
      ${panel('地域の事情', `<ul class="small" style="margin:0;padding-left:18px">${fdRegOrder().filter(r => r !== 'jp').map(r => `<li><b>${esc(FD_REG[r].n)}</b>：${esc(fdRegNote(r))}</li>`).join('')}</ul>`)}
    </div></div>`;
};
function fdAccessWhy(r) { const m = fdModsOf('access', null, r)[0]; return m && m.why ? m.why : FD_REG[r].closed ? fdSerTxt(FD_REG[r].closed) : 'いまは商売ができません'; }
function fdSerTxt(pts) { let t = ''; for (const [yy, s] of pts) if (fdY() >= yy) t = s; return t; }
function fdRegNote(r) { const R = FD_REG[r]; return R.notes ? fdSerTxt(R.notes) : ''; }

/* ---------- お金 ---------- */
function fdPLRows(p, prev) {
  const rows = [['売上高', p.sales, 1], ['売上原価', -p.cogs], ['売上総利益', p.sales - p.cogs, 1], ['販売費・一般管理費', -p.sga], ['研究開発費', -p.rd], ['営業利益', p.sales - p.cogs - p.sga - p.rd, 1], ['営業外の損益（利息など）', p.nonop], ['特別の損益', p.extra], ['法人税など', -p.tax], ['当期純利益', fdNet(p), 1]];
  return rows.map(([k, v, b]) => `<tr${b ? ' class="sum"' : ''}><td>${b ? '<b>' : ''}${k}${b ? '</b>' : ''}</td><td class="n">${fdYenH(v)}</td>${prev ? `<td class="n">${fdYenH(prev[k] ?? 0)}</td>` : ''}</tr>`).join('');
}
FD_SCREENS.f_money = () => {
  const y = fdYf();
  const p = G.yr.pl;
  const last = G.hy[G.hy.length - 1];
  const b = G.bs;
  const bsRows = [['現金・預金', b.cash], ['売掛金', b.ar], ['製品の在庫', b.inv], ['工場・設備（帳簿価額）', b.ppe], ['負債：買掛金', -b.ap], ['負債：借入金', -b.debt], ['負債：未払いの税金', -b.taxp], ['純資産', fdEquity()]].map(([k, v]) => `<tr><td>${k}</td><td class="n">${fdYenH(v)}</td></tr>`).join('');
  const loans = G.loans.map(l => `<tr><td>${esc(l.why)}<div class="small muted">${fdY(l.q)}年${fdQo(l.q) + 1}Q・${l.termQ / 4}年</div></td><td class="n">${fmtYen(l.bal)}</td><td class="n">${fmtNum(l.rate, 2)}%</td><td class="n">${btn('返す', 'fRepay', { id: l.id }, 'sm', { disabled: G.bs.cash < Math.min(l.bal, G.bs.cash) || G.bs.cash <= 0 })}</td></tr>`).join('');
  const room = Math.max(0, fdCreditLimit() - fdDebt());
  const amts = [0.1, 0.3, 0.6].map(k => niceAmountF(room * k)).filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const hy = G.hy.slice(-30);
  const chart = hy.length >= 2 ? barChart({ labels: hy.map(h => String(h.y)), values: hy.map(h => h.net / h.cpi), name: '純利益（今の価値）' }) : '<div class="empty">決算が2回終わると出ます</div>';
  const eq = G.listed ? `株式を上場しています（${fdY(G.listed)}年から）。` : fdCanIpo() ? '上場できます（株式を市場で売って、大きなお金を集める）。' : '上場はまだできません（戦後の証券取引所の再開と、今の価値で年300億円ほどの売上が目安）。';
  return `<h1 class="h1">お金</h1><p class="lead">お金はその時代の円で数えます（金額にふれると今の価値の目安が出ます）。手元のお金が足りなくなると、銀行から自動で短期に借ります。借りられる額は、資産と利益の大きさで決まります。</p>
    <div class="grid g-side"><div class="stack">
      ${panel(`${G.yr.y}年の損益（ここまで）`, `<div class="tbl-wrap"><table class="t fdpl"><thead><tr><th>科目</th><th class="n">${G.yr.y}年</th>${last ? `<th class="n">${last.y}年</th>` : ''}</tr></thead><tbody>${fdPLRows(p, last ? { '売上高': last.sales, '売上原価': -last.cogs, '売上総利益': last.sales - last.cogs, '販売費・一般管理費': -last.sga, '研究開発費': -last.rd, '営業利益': last.opi, '営業外の損益（利息など）': last.nonop, '特別の損益': last.extra, '法人税など': -last.tax, '当期純利益': last.net } : null)}</tbody></table></div>`, { flush: true })}
      ${panel('純利益の歩み（今の価値）', chart)}
    </div><div class="stack">
      ${panel('貸借（いま）', `<div class="tbl-wrap"><table class="t"><tbody>${bsRows}</tbody></table></div>`, { flush: true })}
      ${panel('銀行', `${kv([['取引銀行', esc(G.bank.n)], ['いまの金利', `${fmtNum(fdLoanRate(), 2)}%`], ['借りられる残り', fmtYen(room)]])}<div class="row" style="margin-top:8px">${amts.map(a => btn(`${fmtYen(a)}借りる`, 'fBorrow', { a }, 'sm')).join('') || '<span class="small muted">いまは借りられません</span>'}</div>${loans ? `<div class="tbl-wrap" style="margin-top:10px"><table class="t"><thead><tr><th>借入</th><th class="n">残り</th><th class="n">金利</th><th class="n"></th></tr></thead><tbody>${loans}</tbody></table></div>` : ''}`)}
      ${panel('株式', `<p class="small" style="margin:0 0 8px">${eq}</p>${kv([['資本金', fmtYen(G.bs.cap)], ['創業家の持ち分', fmtPct(G.owners.founder * 100, 0)], ['親会社の持ち分', fmtPct(G.owners.parent * 100, 0)], ['外の株主の持ち分', fmtPct(G.owners.outside * 100, 0)]])}<div class="row" style="margin-top:8px">${btn('増資する', 'fEquityOpen', {}, 'sm', { disabled: !fdCanRaise().ok })}${fdCanIpo() ? btn('上場する', 'fIpo', {}, 'sm primary') : ''}</div>
        <div class="field" style="margin-top:10px"><span>配当（純利益のうち）</span><div class="seg" role="radiogroup">${[[0, 'なし'], [0.15, '15%'], [0.3, '30%'], [0.5, '50%']].map(([v, l]) => `<button type="button" data-act="fDiv" data-v="${v}" aria-pressed="${(G.policy.div ?? 0.25) === v}">${l}</button>`).join('')}</div></div>`)}
    </div></div>`;
};
function niceAmountF(x) { if (x <= 0) return 0; const m = Math.pow(10, Math.floor(Math.log10(x))); return Math.floor(x / m) * m; }
/* ---------- 社史 ---------- */
FD_SCREENS.f_hist = () => {
  const view = UI.fHist || 'chron';
  const sub = `<div class="subtabs" role="tablist"><button type="button" data-act="fHist" data-v="chron" aria-pressed="${view === 'chron'}">年表</button><button type="button" data-act="fHist" data-v="chart" aria-pressed="${view === 'chart'}">数字の歩み</button><button type="button" data-act="fHist" data-v="miles" aria-pressed="${view === 'miles'}">節目</button></div>`;
  let body = '';
  if (view === 'chron') {
    const byDec = {};
    for (const c of G.chron) { const d = Math.floor(fdY(c.q) / 10) * 10; (byDec[d] = byDec[d] || []).push(c); }
    body = Object.entries(byDec).sort((a, b) => b[0] - a[0]).map(([d, cs]) => `<section class="chron"><h3>${d}年代<span class="small muted">（${fdWareki(+d)}〜）</span></h3><ol>${cs.slice().reverse().map(c => `<li class="${c.big ? 'big' : ''}"><span class="when">${fdY(c.q)}年</span><span class="what">${esc(c.t)}</span></li>`).join('')}</ol></section>`).join('');
  } else if (view === 'chart') {
    const hy = G.hy;
    if (hy.length < 2) body = '<div class="empty">決算が2回終わると出ます</div>';
    else {
      const L = hy.map(h => String(h.y));
      const B = fdS().bench;
      const bser = B ? [{ name: '史実', color: 's3', dash: true, values: hy.map(h => Math.log10(Math.max(1, fdSer(B.pts, h.y + 0.5, true)))) }] : [];
      body = panel('売上（今の価値・対数）', lineChart({ labels: L, series: [{ name: '売上', color: 's1', values: hy.map(h => Math.log10(Math.max(1, h.sales / h.cpi))) }].concat(bser), yFmt: v => axisYen(Math.pow(10, v)), tipFmt: v => fmtYen(Math.pow(10, v)) }))
        + panel('社員の数', lineChart({ labels: L, series: [{ name: '社員', color: 's2', values: hy.map(h => h.head) }], yFmt: v => fmtNum(v, 0), tipFmt: v => `${fmtNum(v, 0)}人`, minZero: true }))
        + panel('海外の売上の割合', lineChart({ labels: L, series: [{ name: '海外', color: 's3', values: hy.map(h => { const t = sum(Object.values(h.reg), x => x); return t ? (1 - (h.reg.jp || 0) / t) * 100 : 0; }) }], yFmt: axisPct(0), tipFmt: v => fmtPct(v, 1), minZero: true }));
    }
  } else {
    const all = [{ id: 'export', t: '初めての輸出' }, { id: 'ipo', t: '株式の上場' }].concat(FD_MILES);
    body = `<div class="tbl-wrap"><table class="t"><tbody>${all.map(M => `<tr><td>${esc(M.t)}</td><td class="n">${G.miles[M.id] !== undefined ? `<b>${fdY(G.miles[M.id])}年</b>` : '<span class="muted">まだ</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const since = fdFounded() < G.y0 ? `${fdFounded()}年の創業。${fdWareki(G.y0)}（${G.y0}年）から経営して、いままで。` : `${fdWareki(G.y0)}（${G.y0}年）の${G.custom ? '始まり' : '創業'}から、いままで。`;
  return `<h1 class="h1">社史</h1><p class="lead">${esc(G.co)}の歩み。${since}</p>${sub}<div class="stack">${body}</div>`;
};

/* ---------- 四半期の締め ---------- */
function fdRequestAdvance() {
  if (!G || G.over) return;
  if (G.pendingModals && G.pendingModals.length) { fdShowPending(); return; }
  fdRunAdvance();
}
function fdRunAdvance(n = 1) {
  UI.modal = null;
  let rec = null;
  for (let i = 0; i < n; i++) {
    fdAuto({ lvl: 0 });
    rec = fdAdvanceQ();
    if (G.over || (G.pendingModals && G.pendingModals.some(m => m.type !== 'fdYear' && m.type !== 'fdLaunch'))) break;
  }
  UI.queue = [];
  render();
  autosave();
  fdShowPending();
  return rec;
}
function fdShowPending() {
  const ms = (G.pendingModals || []).slice();
  G.pendingModals = [];
  for (const m of ms) UI.queue.push({ name: m.type, args: m });
  if (UI.queue.length) { const n = UI.queue.shift(); showModal(n.name, n.args); } else drawModal();
}

/* ---------- モーダル ---------- */
MODALS.fdEvent = a => {
  const E = fdEventById(a.id);
  if (!E) return modalFrame('出来事', '', btn('閉じる', 'closeModal', {}, 'primary'));
  const res = a.res;
  const body = `${E.img ? scene(E.img, { cls: 'evimg' }) : ''}<div class="evhead"><span class="evdate">${fdQWareki(a.q ?? G.q)}・${fdY(a.q ?? G.q)}年</span>${E.tag ? `<span class="tag">${esc(E.tag)}</span>` : ''}</div>
    <div class="evtext">${typeof E.d === 'function' ? E.d() : E.d || ''}</div>
    ${res ? `<div class="callout ok" style="margin-top:12px">${res}</div>` : ''}
    ${E.ch && !res ? `<div class="evch">${E.ch.map((C, i) => { const can = !C.can || C.can(); return `<button type="button" class="evopt" data-act="fChoose" data-id="${E.id}" data-i="${i}"${can ? '' : ' disabled'}><b>${esc(C.l)}</b><span>${esc(typeof C.d === 'function' ? C.d() : C.d || '')}${can ? '' : `（${esc(C.cant || 'いまは選べません')}）`}</span></button>`; }).join('')}</div>` : ''}`;
  return modalFrame(esc(typeof E.title === 'function' ? E.title() : E.title || E.t || '出来事'), body, E.ch && !res ? '' : btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow', noClose: !!(E.ch && !res) });
};
MODALS.fdLaunch = a => {
  const p = fdProd(a.id);
  if (!p) return modalFrame('新製品', '', btn('閉じる', 'closeModal', {}, 'primary'));
  const C = fdCat(p.cat);
  const y = fdYf(p.q0);
  return modalFrame(`新製品「${esc(p.name)}」を発売`, `<p>${esc(C.n)}の新しい製品ができました。</p>${kv([['品質', `${fdGapTxt(y - p.qy)}（${fdYearN(p.qy)}年の世界の水準）`], ['仕様', esc(p.spec || '―')], ['値段', `相場の${p.pr}%（${fmtYen(fdRef(p.cat) * p.pr / 100)}）`]])}
    <label class="field" style="margin-top:12px"><span>製品の名前を変える</span><input type="text" id="fdPName" value="${esc(p.name)}" maxlength="24"></label>`, btn('この名前にする', 'fRename', { id: p.id }, 'primary'), { size: 'narrow' });
};
MODALS.fdYear = a => {
  const h = G.hy.find(x => x.y === a.y);
  if (!h) return modalFrame('決算', '', btn('閉じる', 'closeModal', {}, 'primary'));
  const prev = G.hy.find(x => x.y === a.y - 1);
  const d = (v, pv) => (pv ? `<span class="small ${v >= pv ? 'pos' : 'neg'}">${v >= pv ? '+' : ''}${fmtPct((v / pv - 1) * 100, 0)}</span>` : '');
  const top = Object.entries(h.share || {}).sort((a2, b2) => b2[1] - a2[1]).slice(0, 3).map(([c, s]) => `${fdCat(c).n} ${fmtPct(s * 100, 1)}`).join('・');
  const rank = fdWorldRank(a.y);
  return modalFrame(`${a.y}年の決算（第${a.y - fdFounded() + 1}期）`, `<div class="fs-mini">${kv([
    ['売上高', `<b>${fmtYen(h.sales)}</b> ${d(h.sales / h.cpi, prev ? prev.sales / prev.cpi : 0)}<div class="small muted">今の価値で約${fmtYen(h.sales / h.cpi)}</div>`],
    ['営業利益', `<span class="${h.opi < 0 ? 'neg' : ''}">${fmtYen(h.opi)}</span>（売上の${h.sales ? fmtPct(h.opi / h.sales * 100, 1) : '―'}）`],
    ['当期純利益', `<span class="${h.net < 0 ? 'neg' : ''}">${fmtYen(h.net)}</span>${h.div ? `・配当 ${fmtYen(h.div)}` : ''}`],
    ['社員', `${fmtNum(h.head, 0)}人`],
    ['世界での取り分', top || '―'],
    ['世界の大企業で', rank <= 500 ? `${fmtNum(rank, 0)}位相当` : '500位より下'],
  ])}</div><p class="small muted" style="margin:10px 0 0">${esc(fdEraText(a.y + 1))}</p>`, btn('次の年へ', 'closeModal', {}, 'primary'), { size: 'narrow' });
};
MODALS.fdDev = a => {
  const c = a.c;
  const C = fdCat(c);
  const ready = fdCatReady(c);
  const y = fdYf();
  const need = fdDevNeed(c);
  const q = fdDevQuarters(c);
  const ps = fdActiveProds(c);
  const body = ready.ok ? `<p>${esc(C.n)}の${ps.length ? '新しい型' : '初めての製品'}を開発します。いまの技術で作ると、品質は${fdGapTxt(y - fdLaunchQy(c))}（${fdYearN(fdLaunchQy(c))}年の世界の水準）${fdEarly(c, y) ? '。世界にまだない製品で、世に出せばライバルのいない市場が生まれます' : ''}。</p>
    ${kv([['開発に要る力', `技術者${fmtNum(Math.ceil(need / q), 0)}人で約${q}四半期`], ['いまの技術者', `${fmtNum(G.staff.eng, 0)}人（開発中 ${fmtNum(fdDevEngNeed(), 0)}人）`], ['仕様の目安', esc(C.spec ? C.spec(fdLaunchQy(c), y) : '―')]])}
    ${ps.length ? `<p class="small muted">発売すると、いまの「${esc(ps[0].name)}」と入れ替わります（在庫は引き継ぎ）。</p>` : `<p class="small muted">${esc(C.d || '')}</p>`}
    <label class="field"><span>製品の名前</span><input type="text" id="fdDevName" value="${esc(fdModelName(c))}" maxlength="24"></label>
    ${!ps.length ? `<p class="small">初めての分野は、発売の前に工場にラインを足す必要があります（${fmtYen(fdCapexPer(c) * 100)}で年100${esc(C.unit)}分など）。</p>` : ''}` : `<p>${esc(ready.why)}</p>`;
  return modalFrame(`${esc(C.n)}の開発`, body, ready.ok ? btn('戻る', 'closeModal') + btn('開発を始める', 'fDevGo', { c }, 'primary') : btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
};
MODALS.fdPlan = a => {
  const p = fdProd(a.id);
  const cap = fdCapQ(p.cat);
  return modalFrame(`${esc(p.name)}の作る数`, `<p class="small">この四半期から、毎四半期に作る数を決めます（ラインの能力は約${fmtNum(cap, 0)}${esc(fdCat(p.cat).unit)}）。自動なら、売れる数に合わせて作ります。</p><label class="field"><span>四半期に作る数</span><input type="number" id="fdPlanQty" min="0" step="1" value="${Math.round(p.want || p.made || 0)}"></label>`, btn('戻る', 'closeModal') + btn('この数で作る', 'fPlanGo', { id: p.id }, 'primary'), { size: 'narrow' });
};
MODALS.fdLine = a => {
  const y = fdYf();
  const f = fdFac(a.f);
  const cats = Object.keys(fdS().cats).filter(c => fdActiveProds(c).length || G.devs.some(d => d.cat === c));
  const c = a.c || UI.fLineCat || cats[0];
  if (!c) return modalFrame('ラインを足す', '<p>先に、作る製品の開発を始めましょう。</p>', btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
  UI.fLineCat = c;
  const per = fdCapexPer(c, f.r, y);
  const want = sum(fdActiveProds(c), p => p.want || 0) * 4;
  const cur = fdCapQ(c) * 4;
  const base = Math.max(10, Math.round(Math.max(want - cur, cur * 0.25, 40)));
  const opts = [0.5, 1, 2].map(k => niceCap(base * k));
  const sel = `<div class="seg" role="radiogroup">${cats.map(k => `<button type="button" data-act="fLineCat" data-c="${k}" data-f="${f.id}" aria-pressed="${k === c}">${esc(fdCat(k).n)}</button>`).join('')}</div>`;
  return modalFrame(`${esc(f.n)}にラインを足す`, `<div class="field"><span>分野</span>${sel}</div><p class="small">いまの能力 ${fmtNum(cur, 0)}${esc(fdCat(c).unit)}/年・売りたい数 約${fmtNum(want, 0)}${esc(fdCat(c).unit)}/年。能力1${esc(fdCat(c).unit)}/年あたり ${fmtYen(per)}。完成まで約半年。</p>
    <div class="row">${opts.map(n => btn(`${fmtNum(n, 0)}${esc(fdCat(c).unit)}/年（${fmtYen(per * n)}）`, 'fLineGo', { f: f.id, c, n }, 'sm', { disabled: G.bs.cash < per * n })).join('')}</div>`, btn('閉じる', 'closeModal'), { size: 'narrow' });
};
function niceCap(x) { const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, x))) - 1)); return Math.max(1, Math.round(x / m) * m); }
MODALS.fdFac = a => {
  const y = fdYf();
  const regs = fdRegOrder().filter(r => r === 'jp' || (fdRegAccess(r, y) >= 3 && G.reg[r].st >= 2));
  const r = a.r && regs.includes(a.r) ? a.r : UI.fFacReg && regs.includes(UI.fFacReg) ? UI.fFacReg : 'jp';
  UI.fFacReg = r;
  const locs = (FD_REG[r].locs || [FD_REG[r].n]).filter(l => !G.facs.some(f => f.loc === l && f.r === r));
  const sel = `<div class="seg" role="radiogroup">${regs.map(k => `<button type="button" data-act="fFacReg" data-r="${k}" aria-pressed="${k === r}">${esc(FD_REG[k].s || FD_REG[k].n)}</button>`).join('')}</div>`;
  const cost = fdFacCost(r, y);
  return modalFrame('新しい工場を建てる', `<div class="field"><span>地域</span>${sel}</div><p class="small">建物と土地 ${fmtYen(cost)}。${r === 'jp' ? '' : `工員の賃金は日本の約${fmtNum(fdSer(FD_REG[r].wage, y, true), 2)}倍。現地で作った品には関税がかからず、為替の影響も小さくなります。`}完成まで約1年。完成したら、ラインを足して使います。</p>
    <div class="row">${locs.slice(0, 8).map(l => btn(esc(l), 'fFacGo', { r, l }, 'sm', { disabled: G.bs.cash < cost })).join('')}</div>`, btn('閉じる', 'closeModal'), { size: 'narrow' });
};
MODALS.fdSucc = a => {
  const cands = fdSuccCands();
  const ceo = fdCeo();
  const why = a.why === 'death' ? '社長が亡くなりました。' : a.why === 'age' ? `社長の${esc(ceo ? ceo.n : '')}が${ceo ? fdAge(ceo) : ''}歳になり、後を誰に託すかを決める時が来ました。` : a.why === 'purge' ? '社長が公職追放で会社を去ります。後を継ぐ人を決めなければなりません。' : a.why === 'resign' ? '社長が経営危機の責任を取って退きます。' : '社長が引退します。';
  const opts = cands.map((c, i) => {
    if (c.p) return `<button type="button" class="evopt" data-act="fSucc" data-i="${i}"><b>${esc(c.p.n)}（${esc(FD_ROLE_N[c.p.role])}・${fdAge(c.p)}歳）</b><span>技術${c.p.abil.tech}・生産${c.p.abil.prod}・営業${c.p.abil.sales}・財務${c.p.abil.fin}・統率${c.p.abil.lead}。社内をよく知る。</span></button>`;
    if (c.heir) return `<button type="button" class="evopt" data-act="fSucc" data-i="${i}"><b>${esc(fdS().heir.n)}（創業家）</b><span>${esc(fdS().heir.d)}</span></button>`;
    return `<button type="button" class="evopt" data-act="fSucc" data-i="${i}"><b>外から経営者を招く</b><span>銀行や他社で経験を積んだ人。財務と統率に強いが、社内の技術は知らない。</span></button>`;
  }).join('');
  return modalFrame('後継者を決める', `<p>${why}</p><div class="evch">${opts}</div>`, '', { size: 'narrow', noClose: true });
};
MODALS.fdRescue = () => modalFrame('経営危機', `<p>手元のお金が尽き、銀行からもこれ以上は借りられません。このままでは会社は倒産します。</p><p>取引銀行が中心になって、救済の融資を申し出てきました。条件は厳しいものです。</p>`,
  btn('条件をのんで救済を受ける', 'fRescue', { v: 1 }, 'primary') + btn('断る（倒産）', 'fRescue', { v: 0 }, 'danger'), { size: 'narrow', noClose: true });
MODALS.fdEnd = () => {
  const sc = fdScore();
  const chron = G.chron.filter(c => c.big).slice(-14).map(c => `<li><span class="when">${fdY(c.q)}年</span><span class="what">${esc(c.t)}</span></li>`).join('');
  return modalFrame(G.over && G.over.type === 'bankrupt' ? '倒産' : `${G.endY}年、${esc(G.co)}の今`, `${G.over && G.over.type === 'bankrupt' ? '<p>会社は倒産しました。</p>' : `<p class="endtitle">${esc(sc.title)}</p><div class="endrank">評価 <b>${sc.rank}</b>（${sc.total}点）</div>`}
    <div class="tbl-wrap"><table class="t"><tbody>${sc.parts.map(([k, v, d]) => `<tr><td>${esc(k)}</td><td class="n"><b>${v}</b></td><td class="small">${esc(d)}</td></tr>`).join('')}</tbody></table></div>${sc.note ? `<p class="small muted">${esc(sc.note)}</p>` : ''}
    <h3 style="margin:14px 0 6px">社史の大きな節目</h3><ul class="newslist">${chron}</ul>`,
    btn('社史を見る', 'fGo', { tab: 'f_hist' }) + (G.over && G.over.type === 'end' && G.endY < 2050 ? btn('2050年まで続ける', 'fContinue', {}, '') : '') + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
};
MODALS.fdIntro = () => {
  const S = fdS();
  if (G.custom) return modalFrame(esc(S.title), `${scene(S.img || 'fdhero', { cls: 'evimg' })}<div class="evtext"><p>${fdWareki(G.y0)}（${G.y0}年）。${esc(G.founder)}は、${fdFounded() < G.y0 ? `${fdFounded()}年に生まれた` : '新しく興した'}${esc(G.co)}の社長として経営を始める。年商の見込みは今の価値で約${fmtYen(G.custom.plan || G.custom.sales)}、社員は${fmtNum(fdHead(), 0)}人。</p><p>${esc(fdEraText(G.y0))}</p><p>ここから${G.endY}年まで、世界の会社と競いながら、技術と事業と販路を育てる。会社の状態は、メニューの「会社を編集する」でいつでも書き換えられる。</p></div>`, btn('始める', 'closeModal', {}, 'primary'), { size: 'narrow' });
  return modalFrame(esc(S.title), `${scene(S.img || 'fdhero', { cls: 'evimg' })}<div class="evtext">${S.intro}</div>`, btn('始める', 'closeModal', {}, 'primary'), { size: 'narrow' });
};

Object.assign(ACTIONS, {
  fChoose: d => {
    const res = fdChoose(d.id, +d.i);
    UI.modal.args.res = res || '決めました。';
    drawModal(); render();
  },
  fRename: d => { const p = fdProd(d.id); const el = $('#fdPName'); const v = el ? el.value.trim().slice(0, 24) : ''; if (p && v && v !== p.name) { p.name = v; p.auto = false; } closeModal(); render(); },
  fDevGo: d => { const el = $('#fdDevName'); const ps = fdActiveProds(d.c); const r = fdStartDev(d.c, { n: el && el.value.trim() ? el.value.trim().slice(0, 24) : undefined, rep: ps[0] ? ps[0].id : null }); if (!r.ok) toast(r.why, 'bad'); else toast(`「${r.d.n}」の開発を始めました`); closeModal(); render(); },
  fPlanGo: d => { const p = fdProd(d.id); const el = $('#fdPlanQty'); if (p && el) { p.plan = { mode: 'manual', qty: Math.max(0, Math.round(+el.value || 0)) }; } closeModal(); render(); },
  fLineOpen: d => showModal('fdLine', { f: d.f, c: d.c }),
  fLineCat: d => { UI.fLineCat = d.c; showModal('fdLine', { f: d.f, c: d.c }); },
  fLineGo: d => { const r = fdAddLine(d.f, d.c, +d.n); if (!r.ok) toast(r.why, 'bad'); else toast(`ラインを足しました（${fmtYen(r.cost)}）`); closeModal(); render(); },
  fAuto: d => { const r = fdAutomate(d.f, d.c); if (!r.ok) toast(r.why || 'できません', 'bad'); else toast(`自動化を進めました（${fmtYen(r.cost)}）`); render(); },
  fFacOpen: d => showModal('fdFac', { r: d.r }),
  fFacReg: d => { UI.fFacReg = d.r; showModal('fdFac', { r: d.r }); },
  fFacGo: d => { const r = fdBuildFac(d.r, d.l, {}); if (!r.ok) toast(r.why, 'bad'); closeModal(); render(); },
  fRepair: d => { const r = fdRepairFac(fdFac(d.f)); if (!r.ok) { toast(r.why || 'できません', 'bad'); return; } toast(`工場を直しました（${fmtYen(r.cost)}）`); render(); },
  fOrg: () => { const r = fdOrgReform(); if (!r.ok) toast(r.why || 'できません', 'bad'); render(); },
  fWage: d => { G.policy.wage = +d.v; render(); },
  fRegStep: d => { const r = fdRegStep(d.r); if (!r.ok) toast(r.why || 'できません', 'bad'); else toast(`${FD_REG[d.r].n}：${fdStageN(d.r, G.reg[d.r].st)}`); render(); },
  fBorrow: d => { fdBorrow(+d.a, 5, '設備と運転の資金'); toast(`${fmtYen(+d.a)}を借りました（5年）`); render(); },
  fRepay: d => { const l = G.loans.find(x => x.id === d.id); if (l) { const a = fdRepay(l, l.bal); toast(`${fmtYen(a)}を返しました`); G.loans = G.loans.filter(x => x.bal > 0.5); } render(); },
  fEquityOpen: () => { const amt = fdRaiseAmount(); confirmBox('増資する', `${G.listed ? '市場で新しい株を売り' : '株主と出資者に新しい株を引き受けてもらい'}、約${fmtYen(amt)}を集めます。創業家の持ち分は減ります。`, '増資する', 'fEquityGo'); },
  fEquityGo: () => { const r = fdRaise(); if (!r.ok) toast(r.why, 'bad'); else toast(`${fmtYen(r.amt)}を集めました`); closeModal(true); render(); },
  fIpo: () => { const r = fdIpo(); if (r.ok) toast(`上場して${fmtYen(r.amt)}を集めました`); render(); },
  fDiv: d => { G.policy.div = +d.v; render(); },
  fHist: d => { UI.fHist = d.v; render(); },
  fYearRun: () => { if (G.pendingModals && G.pendingModals.length) { fdShowPending(); return; } fdRunAdvance(4 - fdQo()); },
  fSucc: d => {
    if (!fdPickSucc(+d.i)) return;
    closeModal(true); render();
  },
  fRescue: d => {
    if (+d.v) fdRescueAccept(); else fdRescueDecline();
    closeModal(true); render(); fdShowPending();
  },
  fContinue: () => { G.endY = 2050; G.over = null; closeModal(true); render(); },
});

/* ---------- 遊び方 ---------- */
const FD_HELP = [
  ['このモードについて', '明治の終わりの小さな工場から始めて、実際の歴史の中で会社を世界企業に育てます。1手番は四半期（3か月）。「四半期を締めて次へ」で進み、12月で1年の決算になります。2025年まで続きます（そのあと2050年まで続けることもできます）。'],
  ['技術', '技術の水準は「世界の何年の先端に追いついているか」で表します。世界の先端は毎年1年ずつ進むので、研究を止めると遅れが広がります。遅れているうちは速く追いつけますが、先端に近いほど進みは遅くなります。海外の会社から技術を導入（ライセンス）すれば一気に追いつけますが、使用料を払い、相手の国へは輸出できなくなります。'],
  ['製品と市場', '製品は分野ごとに開発します。発売したときの技術の水準が、その製品の品質になります。世界の先端は進むので、何年かごとに新しい型を開発しましょう。取り分は、品質・値段（相場の何%か）・ブランド・販路で決まります。需要は時代とともに大きく変わります（戦争・恐慌・高度成長・石油危機など）。'],
  ['工場', 'ラインの能力が作れる数の上限です。1台を作る時間は、生産技術・自動化・カイゼン・作った数の累計（慣れ）・工員の腕で減ります。工員は自動で必要な数を雇います。'],
  ['世界', '地域ごとに、輸出（商社を通す）→ 販売会社 → 現地生産 → 現地で開発、と進めます。輸出は関税・運賃・為替の影響を受けます。円が強いときは海外で作るほうが有利です。'],
  ['お金', 'お金はその時代の円です（金額にふれると今の価値の目安が出ます）。物価は明治から今までに数千倍になっています。手元のお金が足りなくなると、銀行から自動で借ります。借りられなくなると経営危機です。'],
  ['組織と人', '社員が100人・1,000人・1万人・5万人を超えるたびに、それまでの組織のやり方が通じなくなる「危機」が来ます。組織を改めると乗り越えられます。社長が年を取ったら、後継者を選びます。'],
  ['評価', '最後に、会社の大きさ（世界の大企業の中の順位の目安）・世界での取り分・技術・海外への広がり・危機の乗り越え方で評価します。'],
];
MODALS.fHelp = a => {
  const i = a.sec || 0;
  return modalFrame('遊び方（創業記）', `<div class="subtabs" role="tablist">${FD_HELP.map(([t], k) => `<button type="button" data-act="helpSec" data-sec="${k}" aria-pressed="${k === i}">${esc(t)}</button>`).join('')}</div><p style="margin-top:12px">${esc(FD_HELP[i][1])}</p>`, btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
};

/* ---------- 開始画面 ---------- */
function fdStartDefaults() { return UI.start.f || (UI.start.f = { scen: 'denki', diff: 'normal', co: '', founder: '', seed: '', end: 2025 }); }
function fdStartStore() {
  const f = fdStartDefaults();
  const v = id => { const el = document.getElementById(id); return el ? el.value : null; };
  if (v('fstCo') !== null) f.co = v('fstCo');
  if (v('fstFounder') !== null) f.founder = v('fstFounder');
  if (v('fstSeed') !== null) f.seed = v('fstSeed');
}
function renderStartF() {
  const f = fdStartDefaults();
  let meta = null;
  try { meta = JSON.parse(lsGet(LSF.meta('a')) || 'null'); } catch (e) { meta = null; }
  const cont = meta && !meta.over ? btn(`続きから（${esc(meta.co)}・${meta.y}年）`, 'loadAuto') : '';
  const S = FD_SCEN[f.scen];
  const scens = Object.entries(FD_SCEN).map(([k, X]) => `<button type="button" class="preset indcard${f.scen === k ? ' on' : ''}" data-act="fStScen" data-v="${k}" aria-pressed="${f.scen === k}"><b><span class="indico" aria-hidden="true">${esc(X.seal)}</span>${esc(X.title)}</b><span>${esc(X.pick)}</span></button>`).join('');
  const diffs = [['easy', 'やさしい'], ['normal', 'ふつう'], ['hard', 'むずかしい']].map(([k, l]) => `<button type="button" data-act="fStDiff" data-v="${k}" aria-pressed="${f.diff === k}">${l}</button>`).join('');
  const setup = `<section class="setup" aria-labelledby="setupTitle">
    <div class="setup-head"><h2 id="setupTitle">始め方</h2>${cont}</div>
    ${startModeSwitch()}
    <div class="field"><span>創業の道</span><div class="presets indgrid">${scens}</div></div>
    <div class="field"><span>難しさ</span><div class="seg" role="radiogroup">${diffs}</div><span class="small muted">${{ easy: '元手が多く、宣伝の効き目が大きい。', normal: '標準的な難しさ。', hard: '元手が少なく、銀行も厳しい。' }[f.diff]}</span></div>
    <label class="field"><span>シード（同じ数字なら同じ展開）</span><input type="text" id="fstSeed" value="${esc(f.seed)}" placeholder="空欄でランダム" inputmode="numeric"></label>
    ${fdCustomHtml()}
    <p class="small muted" style="margin:0">${esc(S.pickLong || '')} ほかのモードとは別に保存されます。</p>
  </section>`;
  const st = S.start;
  // カスタムスタートでは、決めた年から（月は1月）
  const cuOn = f.cu && f.cu.on;
  const cuR = cuOn ? fdCuResolve(f.scen, f.cu) : null;
  const y0 = cuR ? cuR.y : st.y0;
  const yF = cuR ? cuR.founded : st.y0;
  const letter = `<div class="appoint fdletter">
    <h1>設立趣意書</h1><div class="gametitle">創業記 ― 小さな工場から世界企業へ</div>
    <div class="body-text">${fdWareki(yF)}、${esc(st.place)}において、<br>
    <label><input type="text" id="fstFounder" value="${esc(f.founder)}" placeholder="${esc(st.founder)}" maxlength="12" aria-label="創業者の氏名"></label> は、${esc(st.vow)}<br>
    社名を <label><input type="text" id="fstCo" value="${esc(f.co)}" placeholder="${esc(st.coName)}" maxlength="16" aria-label="会社の名前" style="width:9em"></label> とする。<br>
    ${esc(st.motto)}</div>
    <div class="issuer">${fdWareki(y0)}${cuOn ? 1 : st.mo || 1}月<br>${cuOn ? '社長' : '創業者'}</div>
    <div class="start">${btn(cuOn ? 'この設定で始める' : '創業する', 'fStart', {}, 'primary')}${btn('ファイルから読み込む', 'importSave')}${btn('遊び方', 'help')}</div>
  </div>`;
  return `${scene('fdhero', { cls: 'hero', alt: '明治の町工場で、職人がモーターの巻線を手で巻いている' })}<div class="startwrap${artSrc('fdhero') ? ' with-hero' : ''}">${setup}${letter}</div>`;
}
Object.assign(ACTIONS, {
  fStScen: d => { fdStartStore(); UI.start.f.scen = d.v; render(); },
  fStDiff: d => { fdStartStore(); UI.start.f.diff = d.v; render(); },
  fStart: () => {
    fdStartStore();
    const f = UI.start.f;
    const S = FD_SCEN[f.scen];
    const seedN = parseInt(String(f.seed).replace(/[^0-9]/g, ''), 10);
    const o = { scen: f.scen, diff: f.diff, coName: (f.co || '').trim() || S.start.coName, founder: (f.founder || '').trim() || S.start.founder };
    if (Number.isFinite(seedN)) o.seed = seedN;
    fdNewGame(o);
    UI.tab = 'f_dash'; UI.fCat = null; UI.fReg = 'jp'; UI.fHist = 'chron';
    render();
    window.scrollTo({ top: 0 });
    autosave();
    showModal('fdIntro');
  },
});
