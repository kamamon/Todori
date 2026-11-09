'use strict';
/* =========================================================
 *  43_fd_ui.js : 創業記モードの画面（その1）
 *   骨組み（見出し・主要な数字・タブ）、社長室、製品と市場、技術と開発
 *   （工場・人と組織・世界・お金・社史・モーダル・開始画面は 43b_fd_ui2.js）
 * ========================================================= */

const LSF = { auto: 'toudori.f1.auto', slot: i => `toudori.f1.slot${i}`, meta: i => `toudori.f1.meta${i}` };
const FD_SCREENS = {};
Object.assign(UI, { fCat: null, fReg: 'jp', fHist: 'chron', fMoney: 'pl', fYear: null });
function fdTabs() { return [['f_dash', '社長室'], ['f_prod', '製品と市場'], ['f_tech', '技術と開発'], ['f_fac', '工場'], ['f_people', '人と組織'], ['f_world', '世界'], ['f_money', 'お金'], ['f_hist', '社史']]; }
/* 時代の色（社長室の時代の帯と見出しの色。明治・大正はセピア、戦前の昭和は国防色、戦後は灰青、高度成長は青緑、平成は紺、令和は今の色） */
function fdEraKey(y = fdY()) { return y < 1926 ? 'meiji' : y < 1945 ? 'senzen' : y < 1955 ? 'sengo' : y < 1974 ? 'kodo' : y < 1990 ? 'antei' : y < 2012 ? 'heisei' : 'reiwa'; }
/* その時代の空気（年ごとの短い説明） */
function fdEraText(y = fdY()) { let t = ''; for (const [yy, s] of FD_ERA_TEXT) if (y >= yy) t = s; return t; }
function fdNum(v, d = 0) { return `<span class="num">${fmtNum(v, d)}</span>`; }
function fdYenH(v) { return `<span class="num${v < 0 ? ' neg' : ''}">${fmtYen(v)}</span>`; }
/* 名目の円と今の価値（ツールチップ） */
function fdYenT(v, y = fdYf()) { return `<span class="num${v < 0 ? ' neg' : ''}" data-tip="${esc(`今の価値で約${fmtYen(fdReal(v, y))}`)}">${fmtYen(v)}</span>`; }
function fdGapTxt(gap) {
  if (gap === Infinity) return '<span class="muted">未着手</span>';
  if (gap <= -0.5) return `<span class="pos">${fmtNum(-gap, 0)}年先</span>`;
  if (gap < 1) return '<span class="pos">先端</span>';
  return `<span class="${gap > 15 ? 'neg' : ''}">${fmtNum(gap, 0)}年遅れ</span>`;
}

/* ---------- 骨組み ---------- */
function renderF() {
  const app = $('#app');
  const tabs = fdTabs();
  if (!tabs.some(t => t[0] === UI.tab)) UI.tab = 'f_dash';
  const tabsEl = $('.tabs');
  const sl = tabsEl ? tabsEl.scrollLeft : 0;
  app.innerHTML = `${fdMast()}${fdStrip()}<div class="body fdbody era-${fdEraKey()}"><nav class="tabs" aria-label="画面の切り替え">${tabs.map(([id, label]) => `<button type="button" class="tab" data-act="tab" data-tab="${id}"${UI.tab === id ? ' aria-current="page"' : ''}><span>${label}</span>${fdTabBadge(id)}</button>`).join('')}</nav><main id="main">${fdScreen()}</main></div>`;
  const t2 = $('.tabs');
  if (t2) t2.scrollLeft = sl;
}
function fdScreen() {
  try { return (FD_SCREENS[UI.tab] || FD_SCREENS.f_dash)(); } catch (err) {
    console.error(err);
    return `<div class="callout bad">画面の表示中にエラーが発生しました：${esc(err.message)}</div>`;
  }
}
function fdMast() {
  const S = fdS();
  const ceo = fdCeo();
  const y = fdY();
  return `<header class="mast fmast era-${fdEraKey()}">
    <div class="mast-brand">${ksSeal(S.seal || '創')}<div style="min-width:0"><div class="bank-name"><span class="bn">${esc(G.co)}</span></div><div class="bank-sub">社長 ${esc(ceo ? ceo.n : G.founder)}<span class="hide-m">　${esc(S.short)}</span></div></div></div>
    <div class="mast-date"><div class="wareki">${fdQWareki()} ${FD_QN[fdQo()]}</div><div class="sub">${y}年・創業${y - G.y0 + 1}年目${G.over ? '・終了' : ''}</div></div>
    <div class="mast-actions"><button type="button" class="mbtn" data-act="menu">メニュー</button><button type="button" class="mbtn" data-act="help">遊び方</button>
    <button type="button" class="mbtn hide-m" data-act="fYearRun"${G.over ? ' disabled' : ''}>1年進める</button>
    <button type="button" class="btn-advance" data-act="advance"${G.over ? ' disabled' : ''}>${fdQo() === 3 ? '12月で締めて決算へ' : '四半期を締めて次へ'}</button></div>
  </header>`;
}
function fdStrip() {
  const y = fdYf();
  const last = G.hy[G.hy.length - 1];
  const rank = fdWorldRank();
  const lead = fdLeadCat();
  const cells = [
    ['現金', fdYenT(G.bs.cash), `<span class="muted">借入 ${fmtYen(G.bs.debt)}</span>`],
    ['年の売上', last ? fdYenT(last.sales, last.y + 0.5) : '―', last ? `<span class="muted">${last.y}年・今の約${fmtYen(last.sales / last.cpi)}</span>` : '<span class="muted">初めの決算はまだ</span>'],
    ['営業利益', last ? `<span class="${last.opi < 0 ? 'neg' : ''}">${fmtYen(last.opi)}</span>` : '―', last && last.sales ? `<span class="muted">売上の${fmtPct(last.opi / last.sales * 100, 1)}</span>` : ''],
    ['社員', `${fmtNum(fdHead(), 0)}<span class="unit">人</span>`, `<span class="muted">技術者 ${fmtNum(G.staff.eng, 0)}人</span>`],
    ['主力の品質', lead ? fdGapTxt(y - fdProdQ(lead)) : '―', lead ? `<span class="muted">${esc(fdCat(lead.cat).n)}</span>` : '<span class="muted">製品がまだない</span>'],
    ['国内の取り分', lead && G.mk[lead.cat] && G.mk[lead.cat].jp ? fmtPct(G.mk[lead.cat].jp.share * 100, 1) : '―', lead ? `<span class="muted">${esc(fdCat(lead.cat).n)}</span>` : ''],
    ['世界の大企業で', rank <= 500 ? `${fmtNum(rank, 0)}<span class="unit">位相当</span>` : '<span class="muted">500位より下</span>', `<span class="muted">${last ? `${last.y}年の売上で` : ''}</span>`],
  ];
  return `<div class="strip" role="group" aria-label="主要な数字">${cells.map(([k, v, d]) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('')}</div>`;
}
function fdTabBadge(id) {
  switch (id) {
    case 'f_dash': return G.pendingModals && G.pendingModals.length ? '<span class="badge alert">!</span>' : '';
    case 'f_tech': { const n = fdLicOffers().length; return n ? `<span class="badge">${n}</span>` : ''; }
    case 'f_fac': return fdShortCats().length ? '<span class="badge alert">!</span>' : '';
    case 'f_people': return fdOrgFriction() > 0.02 ? '<span class="badge alert">!</span>' : '';
    default: return '';
  }
}
function fdProdQ(p) { return p.qy; }
/* 能力が足りない分野（売りたい台数に対して、作れる台数が9割より少ない） */
function fdShortCats() {
  const out = [];
  for (const c of new Set(fdActiveProds().map(p => p.cat))) {
    const want = sum(fdActiveProds(c), p => p.want || 0);
    const cap = fdCapQ(c);
    if (want > 0 && cap < want * 0.9) out.push({ c, want, cap });
  }
  return out;
}

/* ---------- 社長室 ---------- */
function fdInboxHtml(items) {
  if (!items.length) return '<div class="empty">急ぎの用事はありません。四半期を締めて、次へ進みましょう。</div>';
  return `<ul class="inbox">${items.map(x => `<li><span class="ico ${x.cls || ''}" aria-hidden="true">${x.ico}</span><div><div class="t1">${x.t1}</div><div class="t2">${x.t2}</div></div><div class="row">${x.act || ''}</div></li>`).join('')}</ul>`;
}
function fdNewsLi(n) { return `<li class="${n.k === 'bad' ? 'bad' : n.k === 'good' ? 'good' : ''}"><span class="when">${fdY(n.q)}.${fdQo(n.q) + 1}Q</span><span class="what">${esc(n.t)}</span></li>`; }
/* 番頭の進言：いま気をつけること */
function fdAdvice() {
  const out = [];
  const y = fdYf();
  const lead = fdLeadCat();
  if (!fdActiveProds().length && !G.devs.length) out.push({ ico: '開', cls: 'warn', t1: '売る製品がありません', t2: '「製品と市場」で、作れる分野の新しい製品の開発を始めましょう', act: btn('製品と市場へ', 'fGo', { tab: 'f_prod' }, 'sm primary') });
  for (const d of G.devs) out.push({ ico: '開', t1: `開発中：${esc(d.n)}（${esc(fdCat(d.cat).n)}）`, t2: `進み ${fmtPct(d.prog / d.need * 100, 0)}・あと約${Math.max(1, Math.ceil((d.need - d.prog) / Math.max(0.1, d.eng)))}四半期（技術者${fmtNum(d.eng, 0)}人）` });
  for (const s of fdShortCats()) out.push({ ico: '工', cls: 'warn', t1: `${esc(fdCat(s.c).n)}の生産の能力が足りません`, t2: `売れる台数の${fmtPct(s.cap / s.want * 100, 0)}しか作れていません。ラインを広げると売上が伸びます`, act: btn('工場へ', 'fGo', { tab: 'f_fac' }, 'sm') });
  if (lead && y - lead.qy > 8 && !G.devs.some(d => d.cat === lead.cat)) out.push({ ico: '品', cls: 'warn', t1: `主力の「${esc(lead.name)}」が古くなっています`, t2: `世界の先端より${fmtNum(y - lead.qy, 0)}年遅れ。技術が進んでいれば、新しい型を開発しましょう（いまの技術で${fmtNum(fdCatTech(lead.cat) - lead.qy, 0)}年分よくなる）`, act: btn('開発する', 'fDevOpen', { c: lead.cat }, 'sm') });
  const offers = fdLicOffers();
  if (offers.length) out.push({ ico: '技', t1: `技術導入の申し出が${offers.length}件`, t2: `${offers.slice(0, 2).map(o => `${esc(o.L.n)}（${esc(fdField(o.L.f).n)}）`).join('・')}。導入すると一気に追いつけるが、使用料と輸出の制限がつく`, act: btn('技術へ', 'fGo', { tab: 'f_tech' }, 'sm') });
  if (fdOrgFriction() > 0.02) { const O = FD_ORG[fdOrgStage()]; out.push({ ico: '組', cls: 'bad', t1: `${O.crisis}：組織がうまく回っていません`, t2: `社員が${fmtNum(FD_ORG[fdOrgStage() + 1].min, 0)}人を超え、仕事が遅く、無駄が増えています（生産性と開発が${fmtPct(fdOrgFriction() * 100, 0)}落ちている）`, act: btn('組織を改める', 'fGo', { tab: 'f_people' }, 'sm primary') }); }
  const cashQ = fdLastQ('sales') * 0.12 + fdHead() * fdPayQ('wk') * 0.6;
  if (G.bs.cash < cashQ) out.push({ ico: '金', cls: 'bad', t1: '手元のお金が少なくなっています', t2: `足りなくなると銀行から自動で短期に借ります。借りられる残りは約${fmtYen(Math.max(0, fdCreditLimit() - fdDebt()))}`, act: btn('お金へ', 'fGo', { tab: 'f_money' }, 'sm') });
  const nextReg = fdRegOrder().find(r => r !== 'jp' && G.reg[r].st === 0 && fdRegAccess(r) >= 1);
  if (nextReg && fdActiveProds().some(p => p.qy > y - 15) && !G.miles.export) out.push({ ico: '世', t1: `${esc(FD_REG[nextReg].n)}に売り込めます`, t2: '商社を通した輸出なら、少ない費用で始められます', act: btn('世界へ', 'fGo', { tab: 'f_world' }, 'sm') });
  return out;
}
FD_SCREENS.f_dash = () => {
  const y = fdY();
  const S = fdS();
  const era = fdEraText(y);
  const items = fdAdvice();
  const hy = G.hy.slice(-20);
  const labels = hy.map(h => String(h.y));
  const chart = hy.length >= 2 ? lineChart({ labels, series: [{ name: '売上（今の価値）', color: 's1', values: hy.map(h => h.sales / h.cpi) }, { name: '営業利益（今の価値）', color: 's3', values: hy.map(h => h.opi / h.cpi) }], minZero: true }) : '<div class="empty">決算が2回終わると、売上の推移が出ます</div>';
  const news = G.news.slice(0, 8).map(fdNewsLi).join('') || '<li><span class="what muted">まだ知らせはありません</span></li>';
  const lastCh = G.chron.slice(-5).reverse().map(c => `<li><span class="when">${fdY(c.q)}</span><span class="what">${c.big ? '<b>' : ''}${esc(c.t)}${c.big ? '</b>' : ''}</span></li>`).join('');
  const prods = fdActiveProds().slice(0, 6).map(p => `<tr><td><b>${esc(p.name)}</b><div class="small muted">${esc(fdCat(p.cat).n)}</div></td><td class="n">${fdGapTxt(fdYf() - p.qy)}</td><td class="n">${fmtNum(p.sold || 0, 0)}${esc(fdCat(p.cat).unit)}</td><td class="n">${fmtYen((p.rev || 0) * 4)}</td></tr>`).join('');
  return `<div class="era-band era-${fdEraKey()}"><div class="era-y">${fdWareki(y)}<span>${y}年</span></div><div class="era-t">${esc(era)}</div></div>
    <h1 class="h1">社長室</h1><p class="lead">${esc(S.lead)}</p>
    <div class="grid g-side"><div class="stack">
      ${panel('いま考えること', fdInboxHtml(items), { flush: true })}
      ${panel('製品（この四半期）', prods ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>製品</th><th class="n">品質</th><th class="n">売れた数</th><th class="n">年に直した売上</th></tr></thead><tbody>${prods}</tbody></table></div>` : '<div class="empty">まだ売っている製品がありません</div>', { flush: true, aside: btn('製品と市場へ', 'fGo', { tab: 'f_prod' }, 'sm ghost') })}
      ${panel('売上と利益の歩み', chart)}
    </div><div class="stack">
      ${panel('知らせ', `<ul class="newslist">${news}</ul>`, { flush: true })}
      ${panel('社史から', `<ul class="newslist">${lastCh}</ul>`, { flush: true, aside: btn('社史へ', 'fGo', { tab: 'f_hist' }, 'sm ghost') })}
    </div></div>`;
};

/* ---------- 製品と市場 ---------- */
function fdCatsShown() {
  const y = fdYf();
  const cs = Object.keys(fdS().cats).filter(c => fdActiveProds(c).length || G.devs.some(d => d.cat === c) || G.miles['cat_' + c] || y >= fdCat(c).from - 3);
  return cs;
}
function fdPriceTip(p) { const ref = fdRef(p.cat); return `相場 ${fmtYen(ref)} の${fmtNum(p.pr, 0)}%＝${fmtYen(ref * p.pr / 100)}`; }
FD_SCREENS.f_prod = () => {
  const y = fdYf();
  const cats = fdCatsShown();
  if (!UI.fCat || !cats.includes(UI.fCat)) UI.fCat = (fdLeadCat() || {}).cat || cats[0];
  const c = UI.fCat;
  const C = fdCat(c);
  const sub = `<div class="subtabs" role="tablist">${cats.map(k => `<button type="button" data-act="fCat" data-c="${k}" aria-pressed="${k === c}">${esc(fdCat(k).n)}${fdActiveProds(k).length ? '' : ' <span class="muted">（未）</span>'}</button>`).join('')}</div>`;
  const ready = fdCatReady(c);
  const ps = fdActiveProds(c);
  const rows = ps.map(p => {
    const ref = fdRef(c);
    const margin = p.rev ? (p.rev - (p.sold || 0) * (p.ucost || 0)) / p.rev : NaN;
    return `<tr><td><b>${esc(p.name)}</b>${p.ban && p.ban.length ? ` ${tag(`${p.ban.map(r => FD_REG[r].n).join('・')}へ輸出できない`, 'warn')}` : ''}<div class="small muted">${esc(p.spec || '')}・${fdY(p.q0)}年発売</div></td>
      <td class="n">${fdGapTxt(y - p.qy)}<div class="small muted">不良 ${fmtPct(p.def * 100, 1)}</div></td>
      <td class="n" data-tip="${esc(fdPriceTip(p))}">${fmtNum(p.pr, 0)}%<div class="small muted">${fmtYen(ref * p.pr / 100)}</div></td>
      <td class="n">${p.ucost ? fmtYen(p.ucost) : '―'}<div class="small muted ${margin < 0 ? 'neg' : ''}">${isFinite(margin) ? `粗利 ${fmtPct(margin * 100, 0)}` : ''}</div></td>
      <td class="n">${fmtNum(p.made || 0, 0)}<div class="small muted">${p.plan.mode === 'manual' ? `計画 ${fmtNum(p.plan.qty, 0)}` : '自動'}</div></td>
      <td class="n">${fmtNum(p.sold || 0, 0)}<div class="small muted">在庫 ${fmtNum(p.stock, 0)}</div></td>
      <td class="n nowrap">${btn('値下げ', 'fPr', { id: p.id, d: -5 }, 'sm', { disabled: p.pr <= 50 })}${btn('値上げ', 'fPr', { id: p.id, d: 5 }, 'sm', { disabled: p.pr >= 200 })}${btn(p.plan.mode === 'manual' ? '自動にする' : '数を決める', 'fPlan', { id: p.id }, 'sm')}</td></tr>`;
  }).join('');
  const dev = G.devs.filter(d => d.cat === c);
  const devHtml = dev.map(d => `<div class="callout ok">開発中：<b>${esc(d.n)}</b>　${meter(d.prog, d.need, 'ok')}<span class="small">進み ${fmtPct(d.prog / d.need * 100, 0)}・技術者${fmtNum(d.eng, 0)}人</span></div>`).join('');
  const devBtn = ready.ok ? btn(ps.length ? '新しい型を開発する' : 'この分野に進出する（開発を始める）', 'fDevOpen', { c }, ps.length ? '' : 'primary', { disabled: dev.length > 0 }) : `<span class="small muted">${esc(ready.why)}</span>`;
  // 市場（地域ごと）
  const regRows = fdRegOrder().map(r => {
    const m = G.mk[c] && G.mk[c][r];
    const D = fdDemandQ(c, r) * 4;
    if (D < 0.5 && !(m && m.mine)) return '';
    const st = G.reg[r].st;
    return `<tr><td>${esc(FD_REG[r].n)}</td><td class="n">${fmtNum(D, 0)}${esc(C.unit)}</td><td class="n">${m && st ? fmtPct(m.share * 100, 1) : '<span class="muted">―</span>'}</td><td class="n">${r === 'jp' ? '―' : fmtPct((fdTariff(c, r) + fdFreight(c, r)) * 100, 0)}</td><td>${esc(st ? fdStageN(r, st) : '未進出')}</td></tr>`;
  }).join('');
  // ライバル（いちばん大きい地域）
  const rr = UI.fReg && G.mk[c] && G.mk[c][UI.fReg] ? UI.fReg : 'jp';
  const M = fdMarket(c, rr);
  const rv = M.items.slice().sort((a, b) => b.share - a.share).slice(0, 8).map(it => `<tr${it.me ? ' class="me"' : ''}><td>${it.me ? '<b>' : ''}${esc(it.n)}${it.me ? '</b>' : ''}${it.o ? ` <span class="small muted">${esc(FD_REG[it.o] ? FD_REG[it.o].n : '')}</span>` : ''}</td><td class="n">${fdGapTxt(y - it.Q)}</td><td class="n">${fmtNum(it.priceK * 100, 0)}%</td><td class="n">${fmtPct(it.share * 100, 1)}</td></tr>`).join('');
  const regSel = `<div class="seg" role="radiogroup" aria-label="地域">${fdRegOrder().filter(r => fdDemandQ(c, r) > 0).map(r => `<button type="button" data-act="fRegSel" data-r="${r}" aria-pressed="${rr === r}">${esc(FD_REG[r].s || FD_REG[r].n)}</button>`).join('')}</div>`;
  const world = fdWorldDem(c, y);
  return `<h1 class="h1">製品と市場</h1><p class="lead">分野ごとに、製品の品質（世界の先端と比べた技術の年）・値段（相場の何%か）・作る数を決めます。取り分は、品質・値段・ブランド・販路で決まります。</p>
    ${sub}
    <div class="grid g-side"><div class="stack">
      ${panel(`${esc(C.n)}の製品`, `${ps.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>製品</th><th class="n">品質</th><th class="n">値段</th><th class="n">原価</th><th class="n">作った数</th><th class="n">売れた数</th><th class="n"></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${esc(C.d || '')}</div>`}
        <div class="stack" style="margin-top:10px">${devHtml}<div class="row">${devBtn}<span class="small muted">いまの技術で作ると、品質は${fdGapTxt(y - fdCatTech(c))}</span></div></div>`)}
      ${panel(`${esc(C.n)}の市場（年）`, `<p class="small muted" style="margin:0 0 8px">世界の需要 約${fmtNum(world, 0)}${esc(C.unit)}・相場 ${fmtYen(fdRef(c))}（今の約${fmtYen(fdRefReal(c))}）</p><div class="tbl-wrap"><table class="t"><thead><tr><th>地域</th><th class="n">需要</th><th class="n">自社の取り分</th><th class="n">関税と運賃</th><th>進出</th></tr></thead><tbody>${regRows}</tbody></table></div>`)}
    </div><div class="stack">
      ${panel('競う相手', `<div style="margin-bottom:8px">${regSel}</div><div class="tbl-wrap"><table class="t fdrv"><thead><tr><th>会社</th><th class="n">品質</th><th class="n">値段</th><th class="n">取り分</th></tr></thead><tbody>${rv}</tbody></table></div><p class="small muted" style="margin:8px 0 0">値段は相場を100%とした、その地域で買うときの値段（関税・運賃・為替を含む）。</p>`)}
      ${panel('この分野について', `<p class="small" style="margin:0">${esc(C.d || '')}</p>${C.tip ? `<p class="small muted" style="margin:8px 0 0">${esc(C.tip)}</p>` : ''}`)}
    </div></div>`;
};

/* ---------- 技術と開発 ---------- */
FD_SCREENS.f_tech = () => {
  const y = fdYf();
  const S = fdS();
  const engDev = Math.min(G.staff.eng, fdDevEngNeed());
  const engR = Math.max(0, G.staff.eng - engDev);
  const totW = sum(Object.values(G.tech), T => T.a || 0) || 1;
  const rows = Object.entries(S.fields).map(([f, F]) => {
    const T = G.tech[f];
    const fr = fdFrontier(f, y);
    if (fr === null) return `<tr class="muted"><td>${esc(F.n)}<div class="small">${Math.ceil(F.born)}年ごろに生まれる技術</div></td><td class="n">―</td><td class="n">―</td><td class="n">―</td><td class="n">―</td></tr>`;
    const gap = fdGap(f, y);
    const uses = Object.entries(S.cats).filter(([, C]) => (C.w[f] || 0) >= 0.2).map(([, C]) => C.n).slice(0, 3).join('・');
    return `<tr><td><b>${esc(F.n)}</b><div class="small muted">${esc(uses)}</div></td>
      <td class="n">${T.t === null ? '<span class="muted">未着手</span>' : `${fmtNum(Math.floor(T.t), 0)}年`}</td><td class="n">${fdGapTxt(gap)}</td>
      <td class="n">${T.t === null && !T.a ? '―' : `${fmtNum(T.lastD || 0, 1)}年/年`}</td>
      <td class="n nowrap">${btn('−', 'fRdW', { f, d: -1 }, 'sm', { disabled: !(T.a > 0), 'aria-label': `${F.n}の配分を減らす` })}<span class="num" style="display:inline-block;min-width:3.2em;text-align:center">${fmtPct((T.a || 0) / totW * 100, 0)}</span>${btn('＋', 'fRdW', { f, d: 1 }, 'sm', { 'aria-label': `${F.n}の配分を増やす` })}</td></tr>`;
  }).join('');
  const hireSteps = [1, 10, 100, 1000].filter(n => n <= Math.max(1, G.staff.eng) * 2 || n === 1).slice(-2);
  const engPanel = `${kv([['技術者', `<b>${fmtNum(G.staff.eng, 0)}人</b>（開発 ${fmtNum(engDev, 0)}・研究 ${fmtNum(engR, 0)}）`], ['1人の人件費（四半期）', `${fmtYen(fdPayQ('eng'))}（研究の材料・試作を入れると約${fmtYen(fdPayQ('eng') * 1.35)}）`], ['技術者の腕', `${fmtNum(G.skill.eng, 2)}（1が標準）`], ['技師長', (() => { const p = fdPeopleIn('cto')[0]; return p ? `${esc(p.n)}（技術 ${p.abil.tech}）` : '<span class="muted">いない</span>'; })()]])}
    <div class="row" style="margin-top:8px">${hireSteps.map(n => btn(`−${fmtNum(n, 0)}人`, 'fEng', { n: -n }, 'sm', { disabled: G.staff.eng < n })).join('')}${hireSteps.map(n => btn(`＋${fmtNum(n, 0)}人`, 'fEng', { n }, 'sm')).join('')}</div>
    <label class="row small" style="margin-top:8px"><input type="checkbox" data-ch="fAutoRd"${G.policy.autoRd ? ' checked' : ''}> 研究の配分を自動にする（売っている製品に使う技術を、遅れているほど厚く）</label>`;
  const devs = G.devs.map(d => `<tr><td><b>${esc(d.n)}</b><div class="small muted">${esc(fdCat(d.cat).n)}</div></td><td>${meter(d.prog, d.need, 'ok')}</td><td class="n">${fmtPct(d.prog / d.need * 100, 0)}</td><td class="n">${fmtNum(d.eng, 0)}人</td><td class="n nowrap">${btn('人を増やす', 'fDevEng', { id: d.id, d: 1 }, 'sm')}${btn('やめる', 'fDevStop', { id: d.id }, 'sm danger')}</td></tr>`).join('');
  const lics = fdLicOffers().map(o => `<div class="liccard"><div><b>${esc(o.L.n)}</b>（${esc(FD_REG[o.L.o].n)}）<div class="small">${esc(fdField(o.L.f).n)}：いま${fmtNum(Math.floor(G.tech[o.L.f].t ?? (y - 40)), 0)}年 → 約${fmtNum(Math.floor(y - o.lag), 0)}年の水準</div><div class="small muted">一時金 ${fmtYen(o.fee)}・売上の${o.roy}%を${o.years}年${o.L.ban && o.L.ban.length ? `・その間は${o.L.ban.map(r => FD_REG[r].n).join('・')}へ輸出できない` : ''}</div>${o.L.d ? `<div class="small muted">${esc(o.L.d)}</div>` : ''}</div>${btn('導入する', 'fLic', { id: o.L.id }, 'sm primary', { disabled: G.bs.cash < o.fee })}</div>`).join('');
  const active = G.lics.filter(L => L.until > G.q).map(L => `<li>${esc(L.n)}：${esc(fdField(L.f).n)}（${fdY(L.until)}年まで・使用料 ${L.roy}%）</li>`).join('');
  return `<h1 class="h1">技術と開発</h1><p class="lead">技術の水準は「世界の何年の先端に追いついているか」で表します。世界の先端は毎年1年ずつ進みます。遅れているうちは学べることが多く速く追いつけますが、先端に近づくほど自分で切り開く必要があり、進みは遅くなります。</p>
    <div class="grid g-side"><div class="stack">
      ${panel('技術の分野', `<div class="tbl-wrap"><table class="t"><thead><tr><th>分野</th><th class="n">自社の水準</th><th class="n">世界の先端と比べて</th><th class="n">進む速さ</th><th class="n">研究の配分</th></tr></thead><tbody>${rows}</tbody></table></div>`, { flush: true })}
      ${panel('開発中の製品', devs ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>製品</th><th>進み</th><th class="n"></th><th class="n">技術者</th><th class="n"></th></tr></thead><tbody>${devs}</tbody></table></div>` : '<div class="empty">開発中の製品はありません。「製品と市場」から始められます。</div>', { flush: !!devs })}
    </div><div class="stack">
      ${panel('技術者', engPanel)}
      ${panel('技術の導入（ライセンス）', `${lics || '<div class="empty">いまは申し出がありません（先端より6年以上遅れている分野に、海外の会社から申し出が来ます）</div>'}${active ? `<ul class="small" style="margin:10px 0 0;padding-left:18px">${active}</ul>` : ''}`)}
      ${panel('研究の仕組み', fdProgRow('lab'))}
    </div></div>`;
};
function fdProgRow(k) {
  const P = FD_PROGS[k];
  const on = G.prog[k];
  const y = fdYf();
  return `<div class="progrow"><div><b>${esc(P.n)}</b>${on ? ` ${tag(`${fdY(on)}年から`, 'ok')}` : ''}<div class="small muted">${esc(P.d)}</div>${on ? '' : `<div class="small">費用 ${fmtYen(P.cost())}・続けるのに ${esc(P.run)}</div>`}</div>${on ? '' : y < P.from ? `<span class="small muted">${P.from}年ごろから</span>` : btn('始める', 'fProg', { k }, 'sm primary', { disabled: G.bs.cash < P.cost() })}</div>`;
}

Object.assign(ACTIONS, {
  fGo: d => { UI.tab = d.tab; if (d.c) UI.fCat = d.c; UI.modal = null; drawModal(); render(); scrollToMain(); },
  fCat: d => { UI.fCat = d.c; render(); },
  fRegSel: d => { UI.fReg = d.r; render(); },
  fPr: d => { const p = fdProd(d.id); if (!p) return; p.pr = clamp(p.pr + +d.d, 50, 200); render(); },
  fPlan: d => { const p = fdProd(d.id); if (!p) return; if (p.plan.mode === 'manual') { p.plan.mode = 'auto'; render(); } else showModal('fdPlan', { id: p.id }); },
  fRdW: d => { const T = G.tech[d.f]; T.a = Math.max(0, Math.round(((T.a || 0) + +d.d * Math.max(1, sum(Object.values(G.tech), x => x.a || 0) * 0.1)) * 10) / 10); G.policy.autoRd = false; render(); },
  fEng: d => { const n = +d.n; if (n > 0 && G.bs.cash < n * fdPayQ('eng')) { toast('お金が足りません', 'bad'); return; } fdHireEng(n); toast(n > 0 ? `技術者を${fmtNum(n, 0)}人採用しました` : `技術者を${fmtNum(-n, 0)}人減らしました（他の部署へ移した）`); render(); },
  fDevOpen: d => showModal('fdDev', { c: d.c }),
  fDevEng: d => { const x = G.devs.find(v => v.id === d.id); if (!x) return; x.eng = Math.ceil(x.eng * 1.25); render(); },
  fDevStop: d => confirmBox('開発をやめる', 'これまでの開発は無駄になります。やめますか？', 'やめる', 'fDevStopGo', { id: d.id }, true),
  fDevStopGo: d => { G.devs = G.devs.filter(x => x.id !== d.id); closeModal(true); render(); },
  fLic: d => { const r = fdTakeLicense(d.id); if (!r.ok) toast(r.why, 'bad'); render(); },
  fProg: d => { const r = fdProgStart(d.k); if (!r.ok) toast(r.why || 'いまは始められません', 'bad'); else toast(`${FD_PROGS[d.k].n}を始めました`); render(); },
});
Object.assign(CHANGES, {
  fAutoRd: el => { G.policy.autoRd = el.checked; if (el.checked) fdAutoRd(); render(); },
});
