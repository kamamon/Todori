'use strict';
/* =========================================================
 *  31_gyosei_ui.js : 行政モード（労働基準監督署・消防署）の画面
 *   骨組み・署長室・管内と監督計画・案件・措置の判断・実績と評価・学ぶ・ニュース、
 *   月次報告・措置の判断・労災請求の判断・災害調査・年度の評価・任期満了のモーダル、開始画面
 * ========================================================= */

const LSG = { auto: 'toudori.g1.auto', slot: i => `toudori.g1.slot${i}`, meta: i => `toudori.g1.meta${i}` };
const GY_SCREENS = {};
Object.assign(UI, { gEntType: 'all', gEntSort: 'risk', gLearn: 0, gRes: null, gSai: null, gCampType: {} });
function gyTabs() { return [['g_dash', '署長室'], ['g_ents', G.agency === 'fire' ? '建物と立入検査' : '事業場と監督'], ['g_cases', '案件'], ['g_dec', '措置の判断'], ['g_stats', '実績と評価'], ['g_learn', '学ぶ'], ['g_news', 'ニュース']]; }
function gyTarget() { return Math.round(G.ents.length * 0.4); }
function gyFocusTarget() { return Math.max(1, Math.ceil(G.ents.filter(e => e.t === G.focus).length * 0.5)); }
function gyUrgent() { return G.cases.filter(c => c.status === 'new' && (c.type === 'death' || (c.type === 'fire' && (c.data.big || c.data.deaths)))); }
function gyEntBtn(e) { return e ? `<button type="button" class="term gyent" data-act="gEntOpen" data-id="${e.id}" data-tip="${esc(GY_TYPES[e.t].n)}">${esc(e.n)}</button>` : ''; }
function gyDots(e) { const l = gyRiskLevel(e); return `<span class="riskdots" role="img" aria-label="リスク ${l}／5">${'●'.repeat(l)}<span class="muted">${'○'.repeat(5 - l)}</span></span>`; }
function gyOpenSt(e) { return Object.keys(e.st).filter(k => e.st[k].open); }
function gyFixRate(f) { return f.fixed + f.notFixed ? f.fixed / (f.fixed + f.notFixed) : NaN; }
function gyCaseTag(c) {
  const cls = c.type === 'death' || (c.type === 'fire' && (c.data.big || c.data.deaths)) ? 'bad' : c.type === 'complaint' || c.type === 'hidden' ? 'warn' : '';
  const n = c.type === 'fire' ? (c.data.big ? '火災' : 'ぼや') : GY_CASE[c.type].n.replace(/（.*?）/, '');
  return tag(n, cls);
}
function gyCaseDesc(c) {
  switch (c.type) {
    case 'death': case 'report': return `労働者が${esc(c.data.text)}`;
    case 'complaint': return `${esc(c.data.who)}から：${esc(LAW_ITEMS[c.data.item].n)}`;
    case 'claim': return `${esc(c.data.text)}（${c.data.cat}として請求）`;
    case 'claimX': return c.data.kind === 'karo' ? `${esc(c.data.disease)}を発症した労働者（遺族）からの請求` : `${esc(c.data.disease)}を発病した労働者からの請求`;
    case 'hidden': return esc(c.data.from);
    case 'fire': return `${c.data.big ? '火災' : 'ぼや'}${c.data.deaths ? `（死者${c.data.deaths}人）` : ''}。出火の原因を調べ、消防法令の違反がないか確かめる`;
    case 'tip': return esc(c.data.from);
    default: return '';
  }
}
function gyNewsLi(n) { return `<li class="${n.k === 'bad' ? 'bad' : n.k === 'good' ? 'good' : ''}"><span class="when">${ymShort(n.m)}</span><span class="what">${esc(n.t)}</span></li>`; }
function gyInboxHtml(items) {
  if (!items.length) return '<div class="empty">急ぎの用事はありません。計画を確かめて、月末を締めましょう。</div>';
  return `<ul class="inbox">${items.map(x => `<li><span class="ico ${x.cls || ''}" aria-hidden="true">${x.ico}</span><div><div class="t1">${x.t1}</div><div class="t2">${x.t2}</div></div><div class="row">${x.act || ''}</div></li>`).join('')}</ul>`;
}

/* ---------- 骨組み ---------- */
function renderG() {
  const app = $('#app');
  const tabs = gyTabs();
  if (!tabs.some(t => t[0] === UI.tab)) UI.tab = 'g_dash';
  const tabsEl = $('.tabs');
  const sl = tabsEl ? tabsEl.scrollLeft : 0;
  app.innerHTML = `${gyMast()}${gyStrip()}<div class="body"><nav class="tabs" aria-label="画面の切り替え">${tabs.map(([id, label]) => `<button type="button" class="tab" data-act="tab" data-tab="${id}"${UI.tab === id ? ' aria-current="page"' : ''}><span>${label}</span>${gyTabBadge(id)}</button>`).join('')}</nav><main id="main">${gyScreen()}</main></div>`;
  const t2 = $('.tabs');
  if (t2) t2.scrollLeft = sl;
}
function gyScreen() {
  try { return (GY_SCREENS[UI.tab] || GY_SCREENS.g_dash)(); } catch (err) {
    console.error(err);
    return `<div class="callout bad">画面の表示中にエラーが発生しました：${esc(err.message)}</div>`;
  }
}
function gyMast() {
  const A = gyA();
  const { y, mo } = ymOf(G.m);
  const left = G.termYears ? G.termYears - (fyOf(G.m) - fyOf(G.startedM)) : 0;
  return `<header class="mast gmast">
    <div class="mast-brand">${ksSeal(A.icon)}<div style="min-width:0"><div class="bank-name"><span class="bn">${esc(A.n)}</span></div><div class="bank-sub">署長 ${esc(G.chief)}<span class="hide-m">　${esc(A.parent)}</span></div></div></div>
    <div class="mast-date"><div class="wareki">${warekiLabel(G.m)}</div><div class="sub">${y}年${mo}月　${fyYearLabel(fyOf(G.m))}${!G.termYears ? '' : left > 0 ? `・任期あと${left}年` : '・任期満了後'}</div></div>
    <div class="mast-actions"><button type="button" class="mbtn" data-act="menu">メニュー</button><button type="button" class="mbtn" data-act="help">遊び方</button>
    <button type="button" class="btn-advance" data-act="advance">${mo === 3 ? '3月末を締めて年度の評価へ' : '月末を締めて翌月へ'}</button></div>
  </header>`;
}
function gyStrip() {
  const A = gyA();
  const f = gyFy();
  const prevF = G.fys[fyOf(G.m) - 1];
  const cap = gyCap();
  const fr = gyFixRate(f);
  const newMust = G.cases.filter(c => c.status === 'new' && !GY_CASE[c.type].optional).length;
  const cells = [
    ['今月の人日', `${fmtNum(G.used, 1)}<span class="unit"> /${cap}</span>`, G.used > cap ? `<span class="neg">残業 ${fmtNum(G.used - cap, 1)}人日</span>` : `<span class="muted">残り ${fmtNum(cap - G.used, 1)}人日</span>`],
    ['措置の判断待ち', `${G.dec.length}<span class="unit">件</span>`, `<span class="muted">2か月以上 ${G.dec.filter(d => G.m - d.m >= 2).length}件</span>`],
    ['未着手の案件', `${newMust}<span class="unit">件</span>`, gyUrgent().length ? `<span class="neg">${G.agency === 'labor' ? '死亡災害' : '火災'} ${gyUrgent().length}件</span>` : `<span class="muted">${G.agency === 'labor' ? '死傷病報告を除く' : '火災・通報'}</span>`],
    G.agency === 'labor' ? ['今年度の労働災害', `${f.acc4}<span class="unit">件</span>`, `<span class="muted">休業4日以上・着任前 年${G.base.acc4}件</span>`] : ['今年度の火災', `${f.fires}<span class="unit">件</span>`, `<span class="muted">着任前 年${G.base.fires}件</span>`],
    G.agency === 'labor' ? ['死亡災害', `<span class="${f.death ? 'neg' : ''}">${f.death}</span><span class="unit">人</span>`, '<span class="muted">今年度</span>'] : ['火災の死者', `<span class="${f.fireDeath ? 'neg' : ''}">${f.fireDeath}</span><span class="unit">人</span>`, '<span class="muted">今年度</span>'],
    [`計画した${A.insp}`, `${f.inspPlan}<span class="unit"> /${gyTarget()}</span>`, `<span class="muted">重点 ${f.inspFocus}/${gyFocusTarget()}件</span>`],
    ['是正率', isFinite(fr) ? fmtPct(fr * 100, 0) : '―', `<span class="muted">直した ${f.fixed}・直さない ${f.notFixed}</span>`],
    ['前年度の評価', prevF && prevF.eval ? `${prevF.eval.rank}<span class="unit"> ${prevF.eval.total}点</span>` : '―', `<span class="muted">${A.parent}</span>`],
  ];
  return `<div class="strip" role="group" aria-label="主要な数字">${cells.map(([k, v, d]) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('')}</div>`;
}
function gyTabBadge(id) {
  switch (id) {
    case 'g_dec': { const n = G.dec.length; return n ? `<span class="badge${G.dec.some(d => G.m - d.m >= 2) ? ' alert' : ''}">${n}</span>` : ''; }
    case 'g_cases': { const n = G.cases.filter(c => c.status === 'new' && !GY_CASE[c.type].optional).length; return n ? `<span class="badge${gyUrgent().length ? ' alert' : ''}">${n}</span>` : ''; }
    case 'g_ents': return G.plan.insp.length ? `<span class="badge">${G.plan.insp.length}</span>` : '';
    default: return '';
  }
}

/* ---------- 署長室 ---------- */
function gyUsedParts() {
  const A = gyA();
  const insp = G.plan.insp.length * A.inspCost;
  const cases = sum(G.cases.filter(c => c.status === 'assigned' && c.am === G.m), gyCaseCost);
  const camp = G.plan.camp ? gyCampOf(G.plan.camp.id).cost : 0;
  return [[`${A.insp}の計画（${G.plan.insp.length}件）`, insp], ['案件の調査', cases], ['啓発', camp], ['措置の判断・文書', Math.max(0, Math.round((G.used - insp - cases - camp) * 10) / 10)]];
}
function gyCapHtml() {
  const cap = gyCap();
  const p = clamp(G.used / cap * 100, 0, 100);
  return `<div class="capbar${G.used > cap ? ' over' : ''}" role="meter" aria-valuenow="${Math.round(G.used)}" aria-valuemin="0" aria-valuemax="${cap}" aria-label="今月の人日"><span style="width:${p.toFixed(1)}%"></span></div>
    ${kv(gyUsedParts().map(([k, v]) => [k, `${fmtNum(v, 1)}人日`]).concat([['合計', `<b>${fmtNum(G.used, 1)}</b> / ${cap}人日（${G.staff}人×${gyA().days}日）`]]))}`;
}
GY_SCREENS.g_dash = () => {
  const A = gyA();
  const f = gyFy();
  const items = [];
  for (const c of gyUrgent()) { const e = gyEnt(c.ent); items.push({ ico: c.type === 'fire' ? '火' : '災', cls: 'bad', t1: `${c.type === 'death' ? '死亡災害' : '火災'}：${esc(e.n)}`, t2: `${gyCaseDesc(c)}。${GY_CASE[c.type].act}に着手してください（${gyCaseCost(c)}人日）`, act: btn('着手する', 'gAssign', { id: c.id }, 'sm primary', { disabled: !gyCanUse(gyCaseCost(c)) }) }); }
  if (G.dec.length) { const old = G.dec.filter(d => G.m - d.m >= 2).length; items.push({ ico: '判', cls: old ? 'warn' : '', t1: `措置の判断待ちが${G.dec.length}件${old ? `（うち2か月以上 ${old}件）` : ''}`, t2: '見つかった違反への措置や、労災請求の支給・不支給を決めます', act: btn('判断する', 'gGo', { tab: 'g_dec' }, 'sm primary') }); }
  const nc = G.cases.filter(c => c.status === 'new' && !GY_CASE[c.type].optional && !gyUrgent().includes(c));
  if (nc.length) {
    const cnt = {};
    for (const c of nc) cnt[c.type] = (cnt[c.type] || 0) + 1;
    items.push({ ico: '案', cls: nc.some(c => G.m - c.m >= 2) ? 'warn' : '', t1: `未着手の案件が${nc.length}件`, t2: Object.entries(cnt).map(([k, n]) => `${GY_CASE[k].n.replace(/（.*?）/, '')} ${n}件`).join('・'), act: btn('案件へ', 'gGo', { tab: 'g_cases' }, 'sm') });
  }
  const nr = G.cases.filter(c => c.status === 'new' && c.type === 'report').length;
  if (nr) items.push({ ico: '報', t1: `休業4日以上の労働災害の報告が${nr}件`, t2: '災害調査をすると、原因になった違反を見つけて再発を防げます（調べなければ3か月後に書面だけで処理）', act: btn('案件へ', 'gGo', { tab: 'g_cases' }, 'sm') });
  if (!G.plan.insp.length) items.push({ ico: A.icon, t1: `今月の${A.insp}の計画がまだありません`, t2: `${A.insp}は1件${A.inspCost}人日。リスクの高い${A.unit}や、今年度の重点の${GY_TYPES[G.focus].n}を選びましょう`, act: btn('計画を立てる', 'gGo', { tab: 'g_ents' }, 'sm') });
  if (calMonth(G.m) === 3) items.push({ ico: '評', cls: 'warn', t1: '今月で年度が終わります', t2: `月末に${A.parent}から今年度の評価が出ます`, act: btn('実績を見る', 'gGo', { tab: 'g_stats' }, 'sm') });
  const fr = gyFixRate(f);
  const kpis = [
    G.agency === 'labor' ? ['休業4日以上の労働災害', `${f.acc4}件`, `着任前の水準 年${G.base.acc4}件`] : ['火災', `${f.fires}件`, `着任前の水準 年${G.base.fires}件`],
    G.agency === 'labor' ? ['死亡災害', `${f.death}人`, '目標は0人'] : ['火災による死者', `${f.fireDeath}人`, '目標は0人'],
    [`計画した${A.insp}`, `${f.inspPlan}件`, `年度の目標 ${gyTarget()}件`],
    ['違反の是正率', isFinite(fr) ? fmtPct(fr * 100, 0) : '―', `直した ${f.fixed}件・直さない ${f.notFixed}件`],
    [G.agency === 'labor' ? '送検' : '告発', `${f.soken}件`, `${G.agency === 'labor' ? '使用停止等命令' : '命令'} ${f.meirei}件`],
    ['判断の正答率', G.quiz.asked ? fmtPct(G.quiz.correct / G.quiz.asked * 100, 0) : '―', `${G.quiz.correct}/${G.quiz.asked}（標準の措置・労災の認定）`],
  ];
  const news = G.news.slice(0, 6).map(gyNewsLi).join('');
  return `<h1 class="h1">署長室</h1><p class="lead">${esc(A.n)}の使命は「${esc(A.goal)}」こと。${A.staffN}${G.staff}人の人日を、${A.insp}・案件の調査・措置の判断・啓発に配分します。</p>
    <div class="grid g-side"><div class="stack">
      ${panel('今月やること', gyInboxHtml(items), { flush: true })}
      ${panel(`${fyYearLabel(fyOf(G.m))}の実績`, `<div class="kpi-row">${kpis.map(([k, v, d]) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('')}</div>`)}
      ${panel('ニュース', news ? `<ul class="newslist">${news}</ul>` : '<div class="empty">まだありません</div>', { flush: true, aside: btn('すべて見る', 'gGo', { tab: 'g_news' }, 'sm') })}
    </div><div class="stack">
      ${panel('今月の人日', gyCapHtml() + `<p class="note">人日の上限は${gyMaxUse()}人日（残業込み）。いつも定員を超えると職員の残業が増え、年度の評価が下がります（監督署自身も時間外労働の上限を守る立場です）。</p>`)}
      ${panel(`今年度の重点（${esc(A.parent)}）`, `<p style="margin:0 0 6px"><b>${esc(GY_FOCUS[G.focus])}</b></p><p class="small" style="margin:0">${esc(GY_TYPES[G.focus].n)}への計画的な${A.insp}を${gyFocusTarget()}件以上（実施 ${f.inspFocus}件）。集団指導や講習会で業種全体に働きかけるのも効果的です。</p>`)}
      ${panel('1か月の流れ', `<ol class="small" style="margin:0;padding-left:1.3em;line-height:1.8"><li>「案件」で、死亡災害・申告・労災請求などに着手する</li><li>「${gyTabs()[1][1]}」で、リスクの高いところを選んで${A.insp}を計画する</li><li>「措置の判断」で、見つかった違反への措置を決める</li><li>月末を締めると、${A.insp}と調査の結果が出る</li></ol>`)}
    </div></div>`;
};

/* ---------- 管内と監督計画 ---------- */
GY_SCREENS.g_ents = () => {
  const A = gyA();
  const types = gyTypesOf(G.agency).filter(k => G.ents.some(e => e.t === k));
  const filt = UI.gEntType;
  const list = G.ents.filter(e => filt === 'all' || (filt === 'plan' ? G.plan.insp.includes(e.id) : filt === 'focus' ? e.t === G.focus : e.t === filt));
  const sorters = { risk: (a, b) => gyRiskScore(b) - gyRiskScore(a), last: (a, b) => a.lastInsp - b.lastInsp, name: (a, b) => a.n.localeCompare(b.n, 'ja') };
  list.sort(sorters[UI.gEntSort] || sorters.risk);
  const fseg = [['all', 'すべて'], ['focus', `重点（${GY_TYPES[G.focus].n}）`], ['plan', `今月の計画（${G.plan.insp.length}）`], ...types.map(k => [k, GY_TYPES[k].n])];
  const rows = list.map(e => {
    const planned = G.plan.insp.includes(e.id);
    const flags = gyRecordFlags(e);
    const open = gyOpenSt(e);
    const since = G.m - e.lastInsp;
    return `<tr${planned ? ' class="sel"' : ''}><td>${gyEntBtn(e)}${e.t === G.focus ? ` ${tag('重点')}` : ''}${e.pub ? ` ${tag('公表中', 'bad')}` : ''}<div class="small muted">${esc(GY_TYPES[e.t].n)}${G.agency === 'fire' && GY_TYPES[e.t].use ? `・${esc(GY_TYPES[e.t].use)}` : ''}</div></td>
      <td class="n">${G.agency === 'labor' ? `${e.emp}人` : `${e.cap}人`}</td>
      <td class="n">${since}か月前${e.insp ? `<div class="small muted">着任後 ${e.insp}回</div>` : ''}</td>
      <td>${flags.map(k => tag(GY_RECORD[k], 'warn')).join(' ')}${open.length ? ` ${tag(`措置中 ${open.length}件`)}` : ''}${!flags.length && !open.length ? '<span class="muted small">―</span>' : ''}</td>
      <td class="n">${G.agency === 'labor' ? e.acc : e.fires}</td>
      <td>${gyDots(e)}</td>
      <td class="n">${btn(planned ? '外す' : '計画に入れる', 'gPlan', { id: e.id }, `sm${planned ? '' : ' primary'}`, { disabled: !planned && !gyCanUse(A.inspCost) })}</td></tr>`;
  }).join('');
  const plan = G.plan.insp.map(id => gyEnt(id)).filter(Boolean);
  const camps = GY_CAMPS[G.agency].map(c => {
    const on = G.plan.camp && G.plan.camp.id === c.id;
    const ty = on && G.plan.camp.type ? G.plan.camp.type : (UI.gCampType[c.id] || G.focus);
    const sel = c.typed ? `<select data-ch="gCampType" data-id="${c.id}" aria-label="${esc(c.n)}の対象">${types.map(k => `<option value="${k}"${k === ty ? ' selected' : ''}>${esc(GY_TYPES[k].n)}</option>`).join('')}</select>` : '';
    return `<div class="campopt${on ? ' on' : ''}"><div><b>${esc(c.n)}</b><span class="small muted">（${c.cost}人日）</span><div class="small muted">${esc(c.d)}</div></div><div class="row">${sel}${btn(on ? 'やめる' : '行う', 'gCamp', { id: c.id }, `sm${on ? '' : ' primary'}`, { disabled: !on && !gyCanUse(c.cost - (G.plan.camp ? gyCampOf(G.plan.camp.id).cost : 0)) })}</div></div>`;
  }).join('');
  return `<h1 class="h1">${gyTabs()[1][1]}</h1><p class="lead">管内の${A.unit}は${G.ents.length}か所。どこに法令違反があるかは、${A.insp}をするまで分かりません。業種・規模、最後の${A.insp}からの期間、災害の記録、届出の記録から、リスクの高いところを選びます。</p>
    <div class="grid g-side"><div class="stack">
      <div class="row" style="gap:8px;flex-wrap:wrap"><div class="seg wrap" role="radiogroup" aria-label="絞り込み">${fseg.map(([k, l]) => `<button type="button" data-act="gEntType" data-v="${k}" aria-pressed="${filt === k}">${esc(l)}</button>`).join('')}</div>
      <div class="seg" role="radiogroup" aria-label="並べ方">${[['risk', 'リスクの高い順'], ['last', `${A.insp}が古い順`], ['name', '名前順']].map(([k, l]) => `<button type="button" data-act="gEntSort" data-v="${k}" aria-pressed="${UI.gEntSort === k}">${l}</button>`).join('')}</div></div>
      ${panel(`${A.unit}の一覧（${list.length}か所）`, `<div class="tbl-wrap"><table class="t gy-ent"><thead><tr><th>名前</th><th class="n">${G.agency === 'labor' ? '労働者' : '収容人員'}</th><th class="n">最後の${A.insp}</th><th>届出の記録・措置</th><th class="n" data-tip="着任前の2年を含む">${G.agency === 'labor' ? '労災' : '火災'}の記録</th><th>リスク</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="muted">該当する${A.unit}はありません</td></tr>`}</tbody></table></div>`, { flush: true })}
    </div><div class="stack">
      ${panel(`今月の${A.insp}の計画`, `${plan.length ? `<ul class="small" style="margin:0 0 8px;padding-left:1.2em">${plan.map(e => `<li>${esc(e.n)}<span class="muted">（${esc(GY_TYPES[e.t].n)}）</span></li>`).join('')}</ul>` : `<p class="small muted" style="margin:0 0 8px">まだありません。一覧の「計画に入れる」で選びます（1件${A.inspCost}人日）。</p>`}${gyCapHtml()}`)}
      ${panel(G.agency === 'labor' ? '集団指導・パトロール（啓発）' : '講習会・訓練・広報（啓発）', `<div class="stack" style="gap:8px">${camps}</div><p class="note">啓発は1か月に1つ。${A.insp}ほど確実ではありませんが、多くの${A.unit}に一度に働きかけられます。</p>`)}
      ${panel('リスクの見方', `<ul class="small" style="margin:0;padding-left:1.2em;line-height:1.7"><li><b>業種と規模</b>：${G.agency === 'labor' ? '建設・製造・運送は重い災害が多い。人が多いほど災害の数も増える' : '飲食店・雑居ビル・ホテル・介護施設は火災や逃げ遅れの危険が大きい'}</li><li><b>最後の${A.insp}からの期間</b>：長いほど、点検や届出を怠っている可能性が高い</li><li><b>届出の記録</b>：${G.agency === 'labor' ? '36協定の届出や労働保険の申告がないことは、署の記録で分かる' : '点検結果の報告や防火管理者の届出がないことは、署の記録で分かる'}</li><li><b>${G.agency === 'labor' ? '労災' : '火災'}の記録</b>：起きたところは、原因が残っていることが多い</li></ul>`)}
    </div></div>`;
};

/* ---------- 案件 ---------- */
GY_SCREENS.g_cases = () => {
  const A = gyA();
  const pri = ['death', 'fire', 'hidden', 'complaint', 'claimX', 'claim', 'tip', 'report'];
  const nw = G.cases.filter(c => c.status === 'new').sort((a, b) => pri.indexOf(a.type) - pri.indexOf(b.type) || a.m - b.m);
  const asg = G.cases.filter(c => c.status === 'assigned');
  const dec = G.cases.filter(c => c.status === 'decide');
  const done = G.cases.filter(c => c.status === 'done' || c.status === 'filed').slice(0, 25);
  const rowNew = c => { const e = gyEnt(c.ent); const cost = gyCaseCost(c); return `<tr><td>${ymShort(c.m)}${G.m - c.m >= 2 && !GY_CASE[c.type].optional ? `<div>${tag(`${G.m - c.m}か月`, 'warn')}</div>` : ''}</td><td>${gyCaseTag(c)}</td><td>${gyEntBtn(e)}</td><td class="small">${gyCaseDesc(c)}${GY_CASE[c.type].optional ? '<div class="muted">調べなければ3か月後に書面だけで処理</div>' : ''}</td><td class="n">${cost}人日</td><td class="n">${btn(GY_CASE[c.type].act, 'gAssign', { id: c.id }, 'sm primary', { disabled: !gyCanUse(cost) })}</td></tr>`; };
  const rowAsg = c => { const e = gyEnt(c.ent); return `<tr><td>${gyCaseTag(c)}</td><td>${gyEntBtn(e)}</td><td class="small">${gyCaseDesc(c)}</td><td class="n">${gyCaseCost(c)}人日</td><td class="n">${c.am === G.m ? btn('取り消す', 'gUnassign', { id: c.id }, 'sm') : ''}</td></tr>`; };
  const rowDone = c => { const e = gyEnt(c.ent); return `<tr><td>${ymShort(c.doneM ?? c.m)}</td><td>${gyCaseTag(c)}</td><td>${gyEntBtn(e)}</td><td class="small">${esc(c.result || '')}${c.decision ? `<b>（${esc(c.decision)}）</b>` : ''}</td></tr>`; };
  return `<h1 class="h1">案件</h1><p class="lead">${G.agency === 'labor' ? '労働災害の報告、労働者からの申告、労災保険の請求などが毎月届きます。着手すると今月の人日を使い、月末に調査の結果が出ます。死亡災害・申告・労災請求は、放っておくと評価が下がります。' : '火災や違反の通報が届きます。着手すると今月の人日を使い、月末に調査の結果が出ます。'}</p>
    <div class="stack">
      ${panel(`未着手（${nw.length}件）`, nw.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>受付</th><th>種類</th><th>${A.unit}</th><th>内容</th><th class="n">人日</th><th></th></tr></thead><tbody>${nw.map(rowNew).join('')}</tbody></table></div>` : '<div class="empty">未着手の案件はありません</div>', { flush: true })}
      ${asg.length ? panel(`今月着手した案件（${asg.length}件・月末に結果）`, `<div class="tbl-wrap"><table class="t"><tbody>${asg.map(rowAsg).join('')}</tbody></table></div>`, { flush: true }) : ''}
      ${dec.length ? panel(`支給・不支給の判断待ち（${dec.length}件）`, `<p class="small" style="margin:0 0 8px">調査が終わった労災請求です。「措置の判断」で決めます。</p>${btn('判断する', 'gGo', { tab: 'g_dec' }, 'sm primary')}`) : ''}
      ${panel('処理した案件', done.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>月</th><th>種類</th><th>${A.unit}</th><th>結果</th></tr></thead><tbody>${done.map(rowDone).join('')}</tbody></table></div>` : '<div class="empty">まだありません</div>', { flush: true })}
      ${panel('案件の種類', `<div class="tbl-wrap"><table class="t compact"><tbody>${Object.entries(GY_CASE).filter(([k]) => G.agency === 'labor' ? !['fire', 'tip'].includes(k) : ['fire', 'tip'].includes(k)).map(([k, C]) => `<tr><td><b>${esc(C.n)}</b></td><td class="small">${esc({ death: '監督官が現場に入って原因を調べ（災害時監督）、違反があれば送検を検討する', report: '労働者死傷病報告を受けて災害調査をし、原因になった危険をなくさせる', complaint: '労働基準法違反の申告を受けて申告監督をする。申告者が不利益に扱われないよう注意する（労働基準法104条）', claim: '労災保険の請求が業務上（通勤）の災害かを調べ、支給・不支給を決める', claimX: '脳・心臓疾患や精神障害の請求。労働時間や出来事を調べ、認定基準に照らして決める', hidden: '健康保険の照会などから、労働者死傷病報告の出ていない災害を調べる', fire: '消防法31条の火災原因調査。出火原因と消防用設備・避難の状況を調べ、違反を確かめる', tip: '住民や利用者からの通報を受けて、立入検査をする' }[k])}</td><td class="n">${k === 'fire' ? '3〜6' : C.cost}人日</td></tr>`).join('')}</tbody></table></div>`)}
    </div>`;
};

/* ---------- 措置の判断 ---------- */
GY_SCREENS.g_dec = () => {
  const A = gyA();
  const rows = G.dec.map(d => {
    const e = gyEnt(d.ent);
    const age = G.m - d.m;
    if (d.type === 'claim') { const c = gyCase(d.case); return `<tr><td>${ymShort(d.m)}</td><td>${gyEntBtn(e)}</td><td>${tag('労災請求')} <span class="small">${gyCaseDesc(c)}</span></td><td class="small">支給か不支給か</td><td class="n">${btn('判断する', 'gDecOpen', { id: d.id }, 'sm primary')}</td></tr>`; }
    const it = LAW_ITEMS[d.item];
    const kind = d.type === 'follow' ? `${A.follow}：前回 ${esc(gyMeasOf(d.prev) ? gyMeasOf(d.prev).n : '')}のあとも直さない` : `${esc(d.kind)}で発見${d.repeat ? '（再違反）' : ''}`;
    return `<tr><td>${ymShort(d.m)}${age >= 2 ? `<div>${tag(`${age}か月`, 'warn')}</div>` : ''}</td><td>${gyEntBtn(e)}</td><td><b>${esc(it.s)}</b><div class="small muted">${esc(it.law)}</div></td><td class="small">${kind}</td><td class="n">${btn('判断する', 'gDecOpen', { id: d.id }, 'sm primary')}</td></tr>`;
  }).join('');
  const ladder = GY_MEAS[G.agency].map(M => `<li><b>${esc(M.n)}</b><span class="muted">（${M.cost}人日）</span><div class="small">${esc(M.d)}</div></li>`).join('');
  return `<h1 class="h1">措置の判断</h1><p class="lead">${A.insp}で見つかった違反に、どの措置をとるかを決めます。軽すぎると直らず、重すぎると人日を使いすぎ、行政の公平さを欠きます。違反の重さ・危険の大きさ・これまでの経過に見合った措置が「標準」です。</p>
    <div class="grid g-side"><div class="stack">
      ${panel(`判断待ち（${G.dec.length}件）`, rows ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>発見</th><th>${A.unit}</th><th>違反・請求</th><th>経過</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">判断待ちはありません</div>', { flush: true })}
    </div><div class="stack">
      ${panel('措置の段階（軽い順）', `<ol class="ladder">${ladder}</ol><p class="note">${G.agency === 'labor' ? `${term('是正勧告', 'kankoku')}・${term('指導票', 'shido')}は行政指導、${term('使用停止等命令', 'stopOrder')}は行政処分、${term('送検', 'soken')}は刑事手続きです。` : `違反処理は、指導 → 警告 → 命令 → 告発と段階的に進めます（${term('違反処理', 'fireOrder')}）。自動火災報知設備などがない重大な違反は${term('公表', 'fireAlarm')}されます。`}</p>`)}
    </div></div>`;
};

/* ---------- 実績と評価 ---------- */
GY_SCREENS.g_stats = () => {
  const A = gyA();
  const fys = Object.values(G.fys).sort((a, b) => a.fy - b.fy);
  const lab = G.agency === 'labor';
  const rows = fys.map(f => { const fr = gyFixRate(f); return `<tr><td>${fyYearLabel(f.fy)}</td><td class="n">${lab ? f.acc4 : f.fires}</td><td class="n">${lab ? f.death : f.fireDeath}</td><td class="n">${f.inspPlan}<span class="muted small">／${f.insp}</span></td><td class="n">${f.found}</td><td class="n">${isFinite(fr) ? fmtPct(fr * 100, 0) : '―'}</td><td class="n">${f.soken}</td><td class="n">${lab ? `${f.hiddenFound}` : f.koukai}</td><td class="n">${f.decided ? `${f.std}/${f.decided}` : '―'}</td><td class="n">${f.eval ? `<b>${f.eval.rank}</b> ${f.eval.total}` : '<span class="muted">年度中</span>'}</td></tr>`; }).join('');
  const last = fys.filter(f => f.eval).pop();
  return `<h1 class="h1">実績と評価</h1><p class="lead">毎年3月末に、${esc(A.parent)}が1年の実績を100点満点で評価します（S・A・B・C・D）。${lab ? '労働災害' : '火災'}と死者を減らすこと、計画的な${A.insp}、違反を直させること、措置と判断の適正さ、案件をためないことが評価されます。</p>
    <div class="stack">
      ${panel('年度ごとの実績', `<div class="tbl-wrap"><table class="t"><thead><tr><th>年度</th><th class="n">${lab ? '労働災害' : '火災'}</th><th class="n">${lab ? '死亡' : '死者'}</th><th class="n">計画／全${A.insp}</th><th class="n">違反の発見</th><th class="n">是正率</th><th class="n">${lab ? '送検' : '告発'}</th><th class="n">${lab ? '労災かくし発見' : '公表'}</th><th class="n">標準の措置</th><th class="n">評価</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="note">着任前の水準：${lab ? `休業4日以上の労働災害 年${G.base.acc4}件・死亡 年${fmtNum(G.base.death, 1)}人` : `火災 年${G.base.fires}件・死者 年${fmtNum(G.base.death, 1)}人`}。${lab ? '労働災害の件数は、報告された分だけです（労災かくしの分は数に入りません）。' : ''}</p>`, { flush: false })}
      ${last ? panel(`${fyYearLabel(last.fy)}の評価の内訳`, gyEvalTable(last.eval)) : ''}
    </div>`;
};
function gyEvalTable(ev) {
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>項目</th><th>内容</th><th class="n">点</th></tr></thead><tbody>${ev.parts.map(p => `<tr><td>${esc(p.n)}</td><td class="small">${esc(p.note)}</td><td class="n"><b>${p.pts}</b><span class="muted"> /${p.max}</span></td></tr>`).join('')}<tr><td colspan="2"><b>合計</b></td><td class="n"><b>${ev.total}</b><span class="muted"> /100</span></td></tr></tbody></table></div>`;
}

/* ---------- 学ぶ ---------- */
function gyLearnSecs() {
  const lab = G.agency === 'labor';
  const items = gyA().items.map(k => { const it = LAW_ITEMS[k]; const std = GY_MEAS[G.agency].find(x => x.id === it.meas); return `<details class="lawitem"><summary><b>${esc(it.s)}</b><span class="small muted">　${esc(it.law)}・標準の措置：${std ? esc(std.n) : ''}</span></summary><p class="small">${esc(it.n)}。${esc(it.rule)}</p><p class="small"><b>会社がすべきこと：</b>${esc(it.how)}</p><p class="small muted"><b>罰則など：</b>${esc(it.pen)}　${term('用語の解説', it.tk)}</p></details>`; }).join('');
  const flow = lab ? `<h3 class="fsh">監督の種類</h3><ul class="small"><li><b>定期監督</b>：年間の計画に基づき、予告なしに事業場に立ち入る。</li><li><b>申告監督</b>：労働者からの申告（相談）を受けて行う。申告したことを理由に会社が労働者を不利益に扱うことは禁止されている（労働基準法104条）。</li><li><b>災害時監督・災害調査</b>：重大な労働災害が起きたときに、原因を調べて再発防止を指導する。</li><li><b>再監督</b>：是正勧告のあと、直したかを確かめる。</li></ul>
      <h3 class="fsh">${term('労働基準監督官', 'kantokukan')}の権限</h3><p class="small">事業場に立ち入り（臨検）、帳簿や書類を調べ、使用者や労働者に質問できます（労働基準法101条・労働安全衛生法91条）。法律違反の罪については、警察官と同じように捜査する<b>特別司法警察員</b>です（労働基準法102条）。</p>
      <h3 class="fsh">違反が見つかったら</h3><ol class="small"><li><b>指導票</b>：法違反ではない改善事項などを示す。</li><li><b>${term('是正勧告', 'kankoku')}</b>：違反した条項と是正期日を書いた是正勧告書を渡す。会社は直して是正報告書を出す。</li><li><b>${term('使用停止等命令', 'stopOrder')}</b>：危険な機械・足場などをすぐ止めさせる行政処分（労働安全衛生法98条）。</li><li><b>${term('送検', 'soken')}</b>：重大・悪質な違反、勧告に従わないとき、労災かくし、死亡災害の原因となった違反などは、捜査して検察庁に送る。厚生労働省は送検した事案を公表している。</li></ol>`
    : `<h3 class="fsh">${term('立入検査', 'tachiiri')}</h3><p class="small">消防長・消防署長は、火災予防のために、消防職員を事業所・店舗・共同住宅など関係のある場所に立ち入らせ、消防対象物の位置・構造・設備・管理の状況を検査させ、関係者に質問させることができます（消防法4条）。</p>
      <h3 class="fsh">違反が見つかったら（${term('違反処理', 'fireOrder')}）</h3><ol class="small"><li><b>口頭指導・違反指摘</b>：立入検査結果通知書で違反を知らせ、改修の計画と結果を報告させる。</li><li><b>警告</b>：期限を示して直すよう求める（命令の前の段階）。</li><li><b>命令</b>：措置命令・使用停止命令など。命令を出したら、建物に標識を付けて公示する（消防法5条・5条の2・8条4項・17条の4など）。</li><li><b>告発</b>：命令に従わないなど悪質な違反は、捜査機関に告発する。</li></ol>
      <h3 class="fsh">${term('違反対象物の公表制度', 'fireAlarm')}</h3><p class="small">屋内消火栓・スプリンクラー・自動火災報知設備が必要なのに設置していない建物は、消防本部のウェブサイトなどで公表されます。利用者が、安全な建物かを自分で確かめられるようにする仕組みです。</p>`;
  const nintei = lab ? `<h3 class="fsh">労災保険の給付が決まるまで</h3><ol class="small"><li>労働者（遺族）が請求書を出す。会社は事業主の証明に協力する（会社が「労災ではない」と決めることはできない）。</li><li>労働基準監督署長が、業務上（または通勤による）災害かを調べて、支給・不支給を決める。</li><li>決定に不服があれば、労働者災害補償保険審査官に${term('審査請求', 'shinsa')}、さらに労働保険審査会に再審査請求、裁判ができる。</li></ol>
      <h3 class="fsh">${term('業務災害', 'gyomuJo')}かどうか</h3><p class="small"><b>業務遂行性</b>（会社の指揮命令の下にいたか）と<b>業務起因性</b>（仕事に伴う危険が現実になったか）の2つで判断します。休憩中や出張中、私的な行為との境目がよく問われます。</p>
      <h3 class="fsh">${term('通勤災害', 'tsukin')}かどうか</h3><p class="small">住居と仕事の場所との間を、合理的な経路と方法で移動している間の災害です。経路をそれたり（逸脱）、中断したりすると、その後は通勤になりません。ただし、日用品の購入など日常生活上必要な行為のための最小限のものなら、元の経路に戻った後は再び通勤になります。</p>
      <h3 class="fsh">${term('脳・心臓疾患（過労死）', 'karoshi')}</h3><p class="small">発症前1か月に約100時間、または2〜6か月の平均で月約80時間を超える時間外労働があれば、業務との関連が強いと評価されます。これに近い時間でも、不規則な勤務・出張・心理的な負荷などが重なれば、総合して業務上と認められることがあります。</p>
      <h3 class="fsh">${term('精神障害', 'mental')}</h3><p class="small">発病前おおむね6か月の出来事の心理的な負荷が「強」なら業務上です。強の例：ひどいパワーハラスメント、発病直前の1か月に約160時間を超える時間外労働、2か月続けて月約120時間以上の時間外労働、仕事で重いけがをして長く入院した、など。「中」や「弱」の出来事だけなら業務外です。</p>`
    : `<h3 class="fsh">${term('火災原因調査', 'fireCause')}</h3><p class="small">消防長・消防署長は、火災の原因と、火災・消火による損害を調査します（消防法31条〜）。関係者への質問、焼けた場所の調査、資料の提出命令ができ、放火などの疑いがあれば警察と協力します。原因が分かれば、同じような火災を防ぐ予防行政に生かします。</p>
      <h3 class="fsh">防火の基本の仕組み</h3><ul class="small"><li><b>${term('防火管理者と消防計画', 'fireMgr')}</b>（消防法8条）：一定の人数が出入りする建物では、防火管理者を選んで消防計画を作る。</li><li><b>${term('消防用設備等の点検・報告', 'fireCheck')}</b>（17条の3の3）：半年ごとに点検し、消防署に報告する。</li><li><b>${term('避難訓練', 'evacDrill')}</b>：特定防火対象物は年2回以上。</li><li><b>${term('避難経路の確保', 'evacRoute')}</b>：階段・廊下・防火戸の前に物を置かない。</li><li><b>${term('危険物', 'hazmat')}</b>（10条）：指定数量以上は許可を受けた施設で。</li></ul>`;
  const saigai = lab ? `<div class="grid g2"><div><h3 class="fsh">会社がすること</h3><ol class="small"><li>けが人を救護し、必要なら119番。現場はそのままにして記録する。</li><li>治療は労災保険で（健康保険は使えない）。</li><li>休業したら労働者死傷病報告を出す（休業4日以上・死亡は遅滞なく、1〜3日は四半期ごと）。出さないのは${term('労災かくし', 'rosaiHide')}。</li><li>休業の最初の3日間は、会社が平均賃金の60%以上を補償する（${term('待期期間', 'waiting')}）。</li><li>原因を調べ、設備・作業手順・教育で再発を防ぐ。</li></ol></div>
      <div><h3 class="fsh">監督署がすること</h3><ol class="small"><li>死亡災害など重大な災害は、監督官がすぐに現場へ行き、災害調査・災害時監督をする。</li><li>設備（物）・作業のしかた（人）・教育や手順（管理）の面から原因を調べ、法令違反を確かめる。</li><li>危険な状態が残っていれば使用停止等命令。原因になった違反は送検を検討する。</li><li>労災保険の請求について、業務上かを調べて支給・不支給を決める。</li><li>同じ業種の事業場にパトロールや集団指導で注意を広げる。</li></ol></div></div>`
    : `<div class="grid g2"><div><h3 class="fsh">建物の関係者がすること</h3><ol class="small"><li>火災を見つけたら、119番・初期消火・避難誘導。</li><li>消防計画に従って、自衛消防の役割を果たす。</li><li>火災のあとは、消防の原因調査に協力する。</li><li>焼けた設備を直し、消防用設備の点検と訓練を見直す。</li></ol></div>
      <div><h3 class="fsh">消防署がすること</h3><ol class="small"><li>消火・救助のあと、火災原因調査（消防法31条）で出火原因と被害を調べる。</li><li>自動火災報知設備が働いたか、避難通路に物がなかったか、訓練をしていたかを確かめる。</li><li>違反があれば違反処理をし、悪質なら告発する。</li><li>同じ用途の建物に、立入検査・講習会・広報で予防を広げる。</li></ol></div></div>`;
  return [['仕事の流れ', flow], ['法令と標準の措置', `<p class="small">管内の${gyA().unit}に関わる主な法令と、見つかったときの標準の措置です。</p>${items}`], [lab ? '労災保険の認定' : '火災原因調査と予防', nintei], [lab ? '労災が起きたとき' : '火災が起きたとき', saigai]];
}
GY_SCREENS.g_learn = () => {
  const secs = gyLearnSecs();
  const i = clamp(UI.gLearn || 0, 0, secs.length - 1);
  return `<h1 class="h1">学ぶ</h1><p class="lead">${G.agency === 'labor' ? '労働基準監督署の仕事と、労働基準法・労働安全衛生法・労災保険のしくみ' : '消防署の予防の仕事と、消防法のしくみ'}をまとめています。用語の下線を押すと解説が出ます。</p>
    <div class="subtabs" role="tablist">${secs.map(([t], k) => `<button type="button" data-act="gLearn" data-v="${k}" aria-pressed="${k === i}">${t}</button>`).join('')}</div>
    ${panel(secs[i][0], `<div style="max-width:92ch">${secs[i][1]}</div>`)}
    <div class="row" style="margin-top:12px">${btn('用語集を開く', 'glossary')}</div>`;
};
GY_SCREENS.g_news = () => {
  const list = G.news.map(gyNewsLi).join('');
  return `<h1 class="h1">ニュース</h1><p class="lead">管内の災害・火災、措置、${esc(gyA().parent)}からの知らせです。</p>${panel('管内の出来事', list ? `<ul class="newslist">${list}</ul>` : '<div class="empty">まだありません</div>', { flush: true })}`;
};

/* ---------- アクション ---------- */
Object.assign(ACTIONS, {
  gGo: d => { UI.tab = d.tab; if (UI.modal) closeModal(true); render(); scrollToMain(); },
  gAssign: d => {
    const c = gyCase(d.id);
    if (!gyAssign(d.id)) { toast(`人日が足りません（今月の上限 ${gyMaxUse()}人日）`, 'bad'); return; }
    toast(`${GY_CASE[c.type].act}に着手しました（${gyCaseCost(c)}人日）`);
    if (UI.modal && UI.modal.name === 'gSaigai') closeModal(true);
    render();
  },
  gUnassign: d => { gyUnassign(d.id); render(); },
  gPlan: d => { if (!gyPlanToggle(d.id)) toast(`人日が足りません（今月の上限 ${gyMaxUse()}人日）`, 'bad'); render(); if (UI.modal && UI.modal.name === 'gEnt') drawModal(); },
  gCamp: d => {
    const on = G.plan.camp && G.plan.camp.id === d.id;
    if (on) gySetCamp(null);
    else if (!gySetCamp(d.id, UI.gCampType[d.id] || G.focus)) toast('人日が足りません', 'bad');
    render();
  },
  gEntType: d => { UI.gEntType = d.v; render(); },
  gEntSort: d => { UI.gEntSort = d.v; render(); },
  gEntOpen: d => { hideTip(); showModal('gEnt', { id: d.id }); },
  gDecOpen: d => { const x = G.dec.find(y => y.id === d.id); if (!x) return; UI.gRes = null; showModal(x.type === 'claim' ? 'gClaim' : 'gDec', { id: x.id }); },
  gDecide: d => {
    const dd = G.dec.find(x => x.id === d.id);
    if (!dd) return;
    const snap = Object.assign({ talk: gyCultTalk(gyEnt(dd.ent)) }, dd);
    const r = gyDecide(d.id, d.m);
    if (!r) return;
    if (r.err === 'cap') { toast(`人日が足りません（今月の上限 ${gyMaxUse()}人日）。来月に判断できます`, 'bad'); return; }
    if (r.err === 'danger') { toast('使用停止等命令は、危険な機械・作業にしか使えません', 'bad'); return; }
    UI.gRes = Object.assign({ id: d.id, d: snap }, r);
    drawModal(); render();
  },
  gClaimGo: d => {
    const dd = G.dec.find(x => x.id === d.id);
    if (!dd) return;
    const r = gyDecideClaim(d.id, d.pay === '1');
    if (!r) return;
    UI.gRes = Object.assign({ id: d.id, claim: true, pay: d.pay === '1' }, r);
    drawModal(); render();
  },
  gNextDec: () => {
    UI.gRes = null;
    const n = G.dec[0];
    if (n) showModal(n.type === 'claim' ? 'gClaim' : 'gDec', { id: n.id }); else { closeModal(true); render(); }
  },
  gSaiPick: d => { const S = UI.gSai; if (!S || S.ans[d.q]) return; S.ans[d.q] = d.v; G.quiz.asked++; if (d.ok === '1') G.quiz.correct++; drawModal(); },
  gLearn: d => { UI.gLearn = +d.v; render(); },
  gAdvanceNow: () => gyRunAdvance(),
});
Object.assign(CHANGES, {
  gCampType: el => {
    UI.gCampType[el.dataset.id] = el.value;
    if (G.plan.camp && G.plan.camp.id === el.dataset.id) G.plan.camp.type = el.value;
  },
});

/* ---------- 月の進行 ---------- */
function gyRequestAdvance() {
  const urgent = gyUrgent().length;
  const old = G.cases.filter(c => c.status === 'new' && !GY_CASE[c.type].optional && G.m - c.m >= 1).length;
  if (UI.settings.confirmAdvance && (urgent || (!G.plan.insp.length && gyLeft() >= gyA().inspCost))) {
    const parts = [];
    if (urgent) parts.push(`着手していない${G.agency === 'labor' ? '死亡災害' : '火災'}が<b>${urgent}件</b>あります`);
    if (old) parts.push(`先月以前からの未着手の案件が<b>${old}件</b>あります`);
    if (!G.plan.insp.length) parts.push(`今月の${gyA().insp}の計画がありません（残り${fmtNum(gyLeft(), 1)}人日）`);
    confirmBox('このまま月末を締めますか？', parts.join('<br>'), '締めて翌月へ', 'gAdvanceNow');
    return;
  }
  gyRunAdvance();
}
function gyRunAdvance() {
  UI.modal = null;
  const rep = gyAdvance();
  UI.queue = [];
  if (rep && UI.settings.monthly) UI.queue.push({ name: 'gMonthly', args: { rep } });
  for (const s of (G.pendingModals || [])) UI.queue.push({ name: s.type, args: s });
  G.pendingModals = [];
  render();
  autosave();
  if (UI.queue.length) { const n = UI.queue.shift(); showModal(n.name, n.args); } else drawModal();
}

/* ---------- モーダル ---------- */
MODALS.gIntro = () => {
  const A = gyA();
  const body = `<p style="margin-top:0">${esc(G.chief)}署長、着任おめでとうございます。${esc(A.n)}は、${esc(A.parent)}のもとで${G.ents.length}か所の${A.unit}を受け持ちます。${A.staffN}は${G.staff}人、1人が1か月に${A.days}日、${A.insp}や調査に出られます（合計${gyCap()}人日）。</p>
    <ol class="small" style="line-height:1.8"><li><b>案件</b>：${G.agency === 'labor' ? '労働災害の報告、労働者からの申告、労災保険の請求' : '火災、住民からの通報'}が毎月届きます。着手すると人日を使います。</li>
    <li><b>${A.insp}の計画</b>：どこに違反があるかは行くまで分かりません。業種・規模・前回からの期間・届出の記録からリスクを見て選びます。</li>
    <li><b>措置の判断</b>：見つかった違反に、${G.agency === 'labor' ? '指導票・是正勧告・使用停止等命令・送検' : '口頭指導・違反指摘・警告・命令・告発'}のどれをとるかを決めます。重さに見合った措置が大事です。</li>
    <li><b>評価</b>：毎年3月末に、${G.agency === 'labor' ? '労働災害' : '火災'}と死者の数、${A.insp}、是正率、措置の適正さで評価されます。</li></ol>
    <div class="callout">今年度の重点：<b>${esc(GY_FOCUS[G.focus])}</b></div>
    <p class="note">制度はゲーム向けに単純化しています。実際の手続きは所管の役所の案内を確かめてください。</p>`;
  return modalFrame(`${esc(A.n)}長に着任`, body, btn('遊び方を読む', 'helpSec', { sec: 0 }) + btn('始める', 'closeModal', {}, 'primary'));
};
MODALS.gMonthly = a => {
  const r = a.rep;
  const A = gyA();
  const insp = r.insp.map(x => { const e = gyEnt(x.e); return `<li>${esc(e ? e.n : '')}：${x.items.length ? `<b class="neg">違反 ${x.items.length}件</b>（${x.items.map(k => esc(LAW_ITEMS[k].s)).join('・')}）` : '<span class="muted">違反なし</span>'}</li>`; }).join('');
  const cases = r.cases.map(id => gyCase(id)).filter(Boolean).map(c => `<li>${gyCaseTag(c)} ${esc(gyEnt(c.ent).n)}：${esc(c.result || '')}</li>`).join('');
  const nc = r.newCases.map(id => gyCase(id)).filter(Boolean);
  const newHtml = nc.map(c => `<li>${gyCaseTag(c)} ${esc(gyEnt(c.ent).n)}：${gyCaseDesc(c)}</li>`).join('');
  const body = `${kv([['使った人日', `${fmtNum(r.used, 1)} / ${r.cap}人日${r.used > r.cap ? `（<span class="neg">残業 ${fmtNum(r.used - r.cap, 1)}人日</span>）` : ''}`], ['期日の来た措置', `直した ${r.fixed}件・直さなかった ${r.follow}件${r.follow ? '（判断待ちに追加）' : ''}`], ['措置の判断待ち', `${G.dec.length}件`]])}
    <h3 class="fsh sp">${A.insp}の結果</h3>${insp ? `<ul class="small">${insp}</ul>` : `<p class="small muted">今月は計画した${A.insp}がありませんでした。</p>`}
    ${cases ? `<h3 class="fsh sp">案件の調査の結果</h3><ul class="small">${cases}</ul>` : ''}
    <h3 class="fsh sp">新しく届いた案件（${nc.length}件）</h3>${newHtml ? `<ul class="small">${newHtml}</ul>` : '<p class="small muted">ありませんでした。</p>'}
    ${r.camp ? `<p class="small">啓発：${esc(gyCampOf(r.camp.id).n)}${r.camp.type ? `（${esc(GY_TYPES[r.camp.type].n)}）` : ''}を行いました。</p>` : ''}`;
  return modalFrame(`${ymLabel(r.m)}の報告`, body, (G.dec.length ? btn('判断へ', 'gGo', { tab: 'g_dec' }) : '') + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide' });
};
MODALS.gEnt = a => {
  const e = gyEnt(a.id);
  if (!e) return modalFrame('記録', '<p>見つかりません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  const A = gyA();
  const t = GY_TYPES[e.t];
  const planned = G.plan.insp.includes(e.id);
  const st = Object.keys(e.st).filter(k => e.st[k].open).map(k => `<li>${esc(LAW_ITEMS[k].s)}：${esc((gyMeasOf(e.st[k].meas) || { n: '' }).n)}（期日 ${ymLabel(e.st[k].due)}）</li>`).join('');
  const hist = e.hist.slice(0, 12).map(h => `<li><span class="muted">${ymShort(h.m)}</span> ${esc(h.t)}</li>`).join('');
  const flags = gyRecordFlags(e);
  const items = gyItemsOf(e).map(k => esc(LAW_ITEMS[k].s)).join('・');
  const body = `${kv([['種類', `${esc(t.n)}${t.use ? `（${esc(t.use)}）` : ''}`], [G.agency === 'labor' ? '労働者' : '収容人員', `${G.agency === 'labor' ? e.emp : e.cap}人`], [`最後の${A.insp}`, `${G.m - e.lastInsp}か月前`], [G.agency === 'labor' ? '労働災害の記録' : '火災の記録', `${G.agency === 'labor' ? e.acc : e.fires}件<span class="small muted">（着任前の2年を含む）</span>`], ['届出の記録', flags.length ? flags.map(k => esc(GY_RECORD[k])).join('・') : '問題なし'], ['リスクの目安', gyDots(e)]])}
    ${e.pub ? '<div class="callout bad" style="margin-top:8px">重大な違反のある建物として公表中</div>' : ''}
    <h3 class="fsh sp">措置中の違反</h3>${st ? `<ul class="small">${st}</ul>` : '<p class="small muted">ありません</p>'}
    <h3 class="fsh sp">これまでの経過</h3>${hist ? `<ul class="small">${hist}</ul>` : `<p class="small muted">着任してからの記録はありません</p>`}
    <p class="note">関係する法令：${items}</p>`;
  return modalFrame(esc(e.n), body, btn(planned ? `${A.insp}の計画から外す` : `${A.insp}の計画に入れる（${A.inspCost}人日）`, 'gPlan', { id: e.id }, planned ? '' : 'primary', { disabled: !planned && !gyCanUse(A.inspCost) }) + btn('閉じる', 'closeModal'), { size: 'narrow', sub: esc(t.n) });
};
function gyCultTalk(e) {
  if (e.cult >= 0.7) return '代表者は指摘をすぐに受け止め、改善を約束した。';
  if (e.cult >= 0.45) return '担当者は「改善します」と言うが、具体的な計画はまだない。';
  return '代表者は「どこもやっていることだ」と話し、改善に消極的だった。';
}
MODALS.gDec = a => {
  const A = gyA();
  const R = UI.gRes && UI.gRes.id === a.id ? UI.gRes : null;
  const d = R ? R.d : G.dec.find(x => x.id === a.id);
  if (!d) return modalFrame('措置の判断', '<p>この案件はすでに判断しました。</p>', btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
  const e = gyEnt(d.ent);
  const it = LAW_ITEMS[d.item];
  const head = `<div class="lawdoc"><div class="ld-title">${d.type === 'follow' ? `${A.follow}の結果` : '違反の確認'}</div>
    <div class="ld-meta"><span>${ymLabel(d.m)}　${esc(d.kind)}</span><span>${esc(e.n)}（${esc(GY_TYPES[e.t].n)}${G.agency === 'labor' ? `・労働者${e.emp}人` : `・収容${e.cap}人`}）</span></div>
    ${kv([['違反の内容', `<b>${esc(it.n)}</b>`], ['根拠の法令', esc(it.law)], ['法律の決まり', `<span class="small">${esc(it.rule)}</span>`], ['罰則など', `<span class="small">${esc(it.pen)}</span>`],
      d.type === 'follow' ? ['これまでの経過', `前回、${esc((gyMeasOf(d.prev) || { n: '' }).n)}をした。期日までに直さなかった。${d.goodFaith ? `<br><b>会社からの改善計画：</b>${esc(GY_PLAN_TXT[d.item] || '')}` : '<br>改善の計画は出ていない。'}`] : null,
      d.repeat ? ['経過', '前にも同じ違反で措置を受け、直したことがある（再違反）'] : null,
      d.kind === '災害時監督' || d.kind === '災害調査' ? ['災害との関係', it.danger ? '<b class="neg">この違反が、起きた労働災害の原因になった</b>' : 'この違反は災害の直接の原因ではない'] : null,
      ['相手の様子', esc(d.talk || gyCultTalk(e))]])}</div>`;
  if (R) {
    const vt = { ok: ['ok', '標準的な措置です'], light: ['bad', '軽すぎる措置です'], heavy: ['bad', '重すぎる措置です'] }[R.verdict];
    const stdM = gyMeasOf(R.std.id);
    const st = e.st[d.item];
    const res = `<div class="callout ${vt[0]}" style="margin-top:12px"><b>${vt[1]}</b>（選んだ措置：${esc(R.M.n)}${R.verdict !== 'ok' ? `／標準：${esc(stdM.n)}` : ''}）<br><span class="small">${esc(R.std.why)}</span>${R.verdict === 'light' ? '<br><span class="small">軽い措置では、期日までに直さない会社が増えます。</span>' : R.verdict === 'heavy' ? '<br><span class="small">重すぎる措置は人日を使い、行政の公平さを欠きます（評価が下がります）。</span>' : ''}</div>
      <p class="small">${R.M.id === 'soken' || R.M.id === 'kokuhatsu' ? `${R.M.id === 'soken' ? '書類送検' : '告発'}しました。違反は是正され、${e.n}の法令を守る意識は大きく高まります。` : st && st.open ? `是正期日：${ymLabel(st.due)}末。期日に直したかを確かめ、直していなければ次の措置を判断します。` : ''}</p>`;
    return modalFrame('措置の判断', head + res, (G.dec.length ? btn(`次の判断へ（残り${G.dec.length}件）`, 'gNextDec', {}, 'primary') : '') + btn('閉じる', 'closeModal', {}, G.dec.length ? '' : 'primary'), { size: 'wide', sub: esc(e.n) });
  }
  const opts = GY_MEAS[G.agency].map(M => ({ M, dis: M.danger && !it.danger ? '危険な機械・作業でないので使えない' : !gyCanUse(M.cost) ? '人日が足りない' : '' }));
  if (d.type === 'follow') opts.unshift({ M: GY_EXTEND, dis: !gyCanUse(GY_EXTEND.cost) ? '人日が足りない' : '' });
  const choose = `<h3 class="fsh">措置を選ぶ</h3><div class="measlist">${opts.map(({ M, dis }) => `<button type="button" class="qz-b measbtn" data-act="gDecide" data-id="${d.id}" data-m="${M.id}"${dis ? ' disabled' : ''}><b>${esc(M.n)}</b><span class="small muted">（${M.cost}人日）</span><span class="small">${esc(M.d)}${dis ? `<br><b>${dis}</b>` : ''}</span></button>`).join('')}</div>`;
  return modalFrame('措置の判断', head + choose, btn('あとで判断する', 'closeModal'), { size: 'wide', sub: esc(e.n) });
};
MODALS.gClaim = a => {
  const R = UI.gRes && UI.gRes.id === a.id ? UI.gRes : null;
  const d = G.dec.find(x => x.id === a.id);
  const c = R ? R.c : d && gyCase(d.case);
  if (!c) return modalFrame('労災請求の判断', '<p>この請求はすでに判断しました。</p>', btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
  const e = gyEnt(c.ent);
  const D = c.data;
  let facts, rule, exTrue, exFalse;
  if (c.type === 'claim') {
    facts = kv([['請求', D.cat === '通勤災害' ? '療養給付・休業給付（通勤災害）' : '療養補償給付・休業補償給付（業務災害）'], ['事業場', `${esc(e.n)}（${esc(GY_TYPES[e.t].n)}）`], ['災害の状況', `<b>${esc(D.text)}</b>`]]);
    rule = D.cat === '通勤災害' ? `${term('通勤災害', 'tsukin')}：住居と仕事の場所の間を、合理的な経路と方法で移動している間の災害。経路をそれる（逸脱）・中断すると、その後は通勤にならない。ただし日用品の購入など日常生活上必要な最小限の行為なら、元の経路に戻った後は通勤になる。`
      : `${term('業務災害', 'gyomuJo')}：会社の指揮命令の下にいたか（業務遂行性）と、仕事に伴う危険が現実になったか（業務起因性）で判断する。休憩中・出張中・私的な行為との境目に注意。`;
    exTrue = exFalse = D.ex;
  } else if (D.kind === 'karo') {
    facts = kv([['請求', '脳・心臓疾患の労災請求'], ['事業場', `${esc(e.n)}（${esc(GY_TYPES[e.t].n)}）`], ['発症した病気', esc(D.disease)], ['発症前1か月の時間外労働', `<b>${D.m1}時間</b>`], ['発症前2〜6か月の平均（最も長い期間）', `<b>月${D.avg}時間</b>`], D.extra ? ['労働時間以外の負荷', esc(D.extra)] : null]);
    rule = `${term('過労死の認定基準', 'karoshi')}：発症前1か月に約100時間、または2〜6か月の平均で月約80時間を超える時間外労働があれば、業務との関連が強い。これに近い時間でも、不規則な勤務や出張などの負荷が重なれば、総合して業務上と判断できる。`;
    const reason = D.m1 > 100 ? `発症前1か月の時間外労働が${D.m1}時間で、約100時間を超えています` : D.avg > 80 ? `2〜6か月の平均が月${D.avg}時間で、約80時間を超えています` : D.extra ? `時間外労働は基準に近く（1か月${D.m1}時間・平均${D.avg}時間）、さらに不規則な勤務と出張の負荷が重なっています` : `時間外労働（1か月${D.m1}時間・平均${D.avg}時間）は基準を大きく下回り、ほかに強い負荷もありません`;
    exTrue = `${reason}。業務上と認められます。`;
    exFalse = `${reason}。業務外（不支給）と判断されます。`;
  } else {
    facts = `${kv([['請求', '精神障害の労災請求'], ['事業場', `${esc(e.n)}（${esc(GY_TYPES[e.t].n)}）`], ['発病した病気', esc(D.disease)]])}<h3 class="fsh">発病前6か月の出来事</h3><ul class="small">${D.events.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    rule = `${term('精神障害の認定基準', 'mental')}：発病前おおむね6か月の出来事の心理的な負荷が「強」なら業務上。強の例：ひどいパワーハラスメント、発病直前の1か月に約160時間を超える時間外労働、2か月続けて月約120時間以上の時間外労働、仕事で重いけがをして長く入院した。「中」「弱」の出来事だけなら業務外。`;
    exTrue = '心理的な負荷が「強」の出来事があるので、業務上と認められます。';
    exFalse = '出来事はどれも「中」か「弱」にとどまるので、業務外（不支給）と判断されます。';
  }
  const head = `<div class="lawdoc"><div class="ld-title">労災保険の請求</div><div class="ld-meta"><span>受付 ${ymLabel(c.m)}</span><span>${esc(c.result || '')}</span></div>${facts}</div>
    <div class="learnbox" style="margin-top:10px"><p class="small" style="margin:0">${rule}</p></div>`;
  if (R) {
    const vt = R.ok ? ['ok', '正しい判断です'] : ['bad', R.pay ? '誤りです（業務外でした）' : '誤りです（業務上でした）'];
    return modalFrame('労災請求の判断', `${head}<div class="callout ${vt[0]}" style="margin-top:12px"><b>${vt[1]}</b>（決定：${R.pay ? '支給' : '不支給'}）<br><span class="small">${R.truth ? exTrue : exFalse}</span>${!R.ok && !R.pay ? '<br><span class="small">労働者は審査請求をするでしょう。決定が取り消されると評価が下がります。</span>' : ''}</div>`,
      (G.dec.length ? btn(`次の判断へ（残り${G.dec.length}件）`, 'gNextDec', {}, 'primary') : '') + btn('閉じる', 'closeModal', {}, G.dec.length ? '' : 'primary'), { size: 'wide', sub: esc(e.n) });
  }
  const yes = c.type === 'claim' && D.cat === '通勤災害' ? '通勤災害と認める（支給）' : '業務上と認める（支給）';
  const no = c.type === 'claim' && D.cat === '通勤災害' ? '通勤災害と認めない（不支給）' : '業務外とする（不支給）';
  return modalFrame('労災請求の判断', head, btn('あとで判断する', 'closeModal') + btn(no, 'gClaimGo', { id: d.id, pay: 0 }) + btn(yes, 'gClaimGo', { id: d.id, pay: 1 }, 'primary'), { size: 'wide', sub: esc(e.n) });
};
const GY_SAI_Q = {
  labor: [
    { q: '死亡災害の一報が入った。監督署として、まずすべきことは？', ans: 'go', ch: [['go', '監督官がすぐに現場へ行き、災害の状況・機械や設備・作業の手順を確かめる（災害調査）。警察とも連携する'], ['wait', '会社から労働者死傷病報告が出るのを待ち、書類で判断する'], ['police', '事故の責任を調べるのは警察なので、監督署は関わらない']],
      ex: '重大な災害では、監督官が直ちに現場に入って原因を調べます。法令違反があれば特別司法警察員として捜査し、送検します。警察も業務上過失致死の疑いで捜査するので、連携して進めます。' },
    { q: '原因を調べるときの考え方として、適切なのは？', ans: 'm4', ch: [['m4', '設備（物）・作業のしかた（人）・教育や手順（管理）の面から原因を洗い出し、法令で決められた措置が取られていたかを確かめる'], ['self', '亡くなった本人の不注意だったかどうかを中心に確かめる'], ['paper', '会社の説明を聞き、書類がそろっていれば調査を終える']],
      ex: '災害は、危険な状態（物）と不安全な行動（人）が重なって起き、その背景に管理の問題があります。本人の不注意で片付けず、手すり・安全装置・作業手順・教育などの措置が取られていたかを調べ、同じ業種にも再発防止を広げます。' },
  ],
  fire: [
    { q: '死者が出た火災。火が消えたあと、消防署がすべきことは？', ans: 'go', ch: [['go', '火災原因調査（消防法31条）で出火原因と延焼・避難の状況を調べ、消防用設備や防火管理に違反がなかったかを確かめる'], ['police', '消火が終われば消防署の仕事は終わりなので、あとは警察に任せる'], ['talk', '建物の持ち主から話を聞くだけで、現場は見ない']],
      ex: '消防長・消防署長は、火災の原因と損害を調査します。原因が分かれば、同じような建物の予防に生かせます。消防用設備の不備や避難の妨げがあれば違反として処理し、悪質なら告発します。' },
    { q: '人が亡くなった原因として、特に確かめるべきことは？', ans: 'ev', ch: [['ev', '自動火災報知設備が鳴ったか、階段や通路に物がなかったか、避難訓練をしていたか'], ['look', '建物の外観がきれいに保たれていたか'], ['ins', '建物の持ち主が火災保険に入っていたか']],
      ex: '多くの死者が出た雑居ビル火災などでは、火災報知設備の不備、階段に置かれた物、訓練不足による避難の遅れが重なっていました。' },
  ],
};
MODALS.gSaigai = a => {
  const c = gyCase(a.id);
  if (!c) return modalFrame('災害', '<p>記録がありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  const e = gyEnt(c.ent);
  if (!UI.gSai || UI.gSai.id !== c.id) UI.gSai = { id: c.id, ans: {} };
  const S = UI.gSai;
  const qs = GY_SAI_Q[G.agency];
  const quiz = qs.map((Q, qi) => {
    const ans = S.ans[qi];
    return `<div class="qz"><div class="qz-q"><span class="qz-tag">判断</span>${esc(Q.q)}</div><div class="qz-ch">${Q.ch.map(([v, t]) => `<button type="button" class="qz-b${ans ? (v === Q.ans ? ' ok' : v === ans ? ' ng' : '') : ''}" data-act="gSaiPick" data-q="${qi}" data-v="${v}" data-ok="${v === Q.ans ? 1 : 0}"${ans ? ' disabled' : ''}>${esc(t)}</button>`).join('')}</div>${ans ? `<div class="qz-a ${ans === Q.ans ? 'ok' : 'ng'}"><b>${ans === Q.ans ? 'そのとおりです' : '適切ではありません'}</b>　${esc(Q.ex)}</div>` : ''}</div>`;
  }).join('');
  const head = G.agency === 'labor' ? `<div class="callout bad"><b>${ymLabel(c.m)}　${esc(e.n)}（${esc(GY_TYPES[e.t].n)}）で、労働者が${esc(c.data.text)}</b></div>`
    : `<div class="callout bad"><b>${ymLabel(c.m)}　${esc(e.n)}（${esc(GY_TYPES[e.t].use)}）で火災。${c.data.deaths}人が亡くなった</b><br><span class="small">出火の原因：${esc(c.data.cause)}（調査中）</span></div>`;
  const cost = gyCaseCost(c);
  const done = Object.keys(S.ans).length >= qs.length;
  const foot = c.status === 'new' ? btn('あとで着手する', 'closeModal') + btn(`${GY_CASE[c.type].act}に着手する（${cost}人日）`, 'gAssign', { id: c.id }, done ? 'primary' : '', { disabled: !gyCanUse(cost) }) : btn('閉じる', 'closeModal', {}, 'primary');
  return modalFrame(G.agency === 'labor' ? '死亡災害が起きました' : '死者の出た火災が起きました', head + quiz, foot, { sub: '答えると解説が出ます' });
};
MODALS.gEval = a => {
  const f = G.fys[a.fy];
  if (!f || !f.eval) return modalFrame('年度の評価', '<p>評価がありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  const ev = f.eval;
  const A = gyA();
  const comment = { S: '管内の安全が目に見えて高まりました。模範的な署の運営です。', A: '計画的で公平な行政が実を結んでいます。', B: 'おおむね順調ですが、伸ばせる点があります。', C: '取り組みが追いついていない分野があります。', D: '管内の状況が悪化しています。進め方を見直しましょう。' }[ev.rank];
  const body = `<div class="row" style="align-items:center;gap:16px"><span class="gradebig g${{ S: 1, A: 3, B: 5, C: 7, D: 9 }[ev.rank]}">${ev.rank}</span><div><b style="font-size:18px">${ev.total}点</b><span class="muted"> /100</span><div class="small">${comment}</div></div></div>
    ${gyEvalTable(ev)}
    <p class="small">管内の違反の数（年度末の推計）：着任時 1か所あたり ${fmtNum(G.base.viol, 2)}件 → いま ${fmtNum(ev.viol, 2)}件。${G.agency === 'labor' && ev.hidden ? `この年度に起きた労災かくしは推計${ev.hidden}件、そのうち見つけたのは${ev.hiddenFound}件。` : ''}</p>
    <p class="note">来年度の重点は4月に${esc(A.parent)}から示されます。</p>`;
  return modalFrame(`${fyYearLabel(a.fy)}の評価（${esc(A.parent)}）`, body, btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide' });
};
MODALS.gTerm = () => {
  const A = gyA();
  const evs = Object.values(G.fys).filter(f => f.eval).sort((a, b) => a.fy - b.fy);
  const avg = evs.length ? Math.round(sum(evs, f => f.eval.total) / evs.length) : 0;
  const rank = avg >= 85 ? 'S' : avg >= 70 ? 'A' : avg >= 55 ? 'B' : avg >= 40 ? 'C' : 'D';
  const lab = G.agency === 'labor';
  const body = `<p style="margin-top:0">${esc(G.chief)}署長の任期${G.termYears}年が満了しました。</p>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>年度</th><th class="n">${lab ? '労働災害' : '火災'}</th><th class="n">${lab ? '死亡' : '死者'}</th><th class="n">是正率</th><th class="n">評価</th></tr></thead><tbody>${evs.map(f => { const fr = gyFixRate(f); return `<tr><td>${fyYearLabel(f.fy)}</td><td class="n">${lab ? f.acc4 : f.fires}</td><td class="n">${lab ? f.death : f.fireDeath}</td><td class="n">${isFinite(fr) ? fmtPct(fr * 100, 0) : '―'}</td><td class="n"><b>${f.eval.rank}</b> ${f.eval.total}</td></tr>`; }).join('')}</tbody></table></div>
    <p>任期を通じた評価：<b>${rank}</b>（平均${avg}点）。管内の違反は、1か所あたり ${fmtNum(G.base.viol, 2)}件 → ${fmtNum(gyViolTotal() / G.ents.length, 2)}件になりました。判断の正答率は ${G.quiz.asked ? fmtPct(G.quiz.correct / G.quiz.asked * 100, 0) : '―'}。</p>
    <p class="note">このまま${esc(A.n)}長を続けることもできます。</p>`;
  return modalFrame('任期満了', body, btn('続ける', 'closeModal', {}, 'primary'), { size: 'wide' });
};

/* ---------- 遊び方 ---------- */
function gyHelpSecs() {
  const ag = G ? G.agency : (UI.start.g || {}).agency || 'labor';
  const A = GY_AGENCY[ag];
  const lab = ag === 'labor';
  return [
    ['ゲームの目的', `<p>あなたは${esc(A.n)}の署長です。管内の${A.unit}に法令を守らせ、${lab ? '労働災害と過重労働を減らし、働く人の命と健康を守ります' : '火災を防ぎ、火災が起きても人の命が失われないようにします'}。毎年3月末に${esc(A.parent)}の評価（S〜D）が出ます。任期は開始画面で選べます。</p>
      <p>このモードでは、会社経営モードで「守る側」だった法令を、<b>守らせる側</b>から見ます。どこに違反があるかは行ってみるまで分からず、職員の時間（人日）は限られています。</p>`],
    ['1か月の流れ', `<ol><li><b>案件</b>：${lab ? '死亡災害・労働災害の報告・申告・労災保険の請求・労災かくしの疑い' : '火災・違反の通報'}に着手する。</li><li><b>${A.insp}の計画</b>：「${lab ? '事業場と監督' : '建物と立入検査'}」で、リスクの高いところを選ぶ（1件${A.inspCost}人日）。啓発（${lab ? '集団指導・安全パトロール' : '講習会・訓練・広報'}）も選べる。</li><li><b>措置の判断</b>：見つかった違反にとる措置を決める。${lab ? '労災請求の支給・不支給もここで決める。' : ''}</li><li><b>月末を締める</b>：${A.insp}・調査の結果が出て、新しい案件が届く。</li></ol>
      <p>人日は${A.staffN}${A.staff}人×${A.days}日。上限の1.5倍まで使えますが、超えた分は職員の残業になり、評価が下がります。</p>`],
    [`${A.insp}と措置`, `<p>${A.insp}で見つかる違反は、${lab ? '36協定・残業の上限・残業代・最低賃金・健康診断・安全衛生の体制・年休・労働条件の明示・機械の安全・墜落の防止・化学物質・労働保険' : '防火管理者・消防設備の点検・避難訓練・避難通路・自動火災報知設備・消火器と誘導灯・危険物・防炎物品'}など。</p>
      <p>措置は軽い順に ${GY_MEAS[ag].map(M => `<b>${M.n}</b>`).join(' → ')}。違反の重さ・危険・これまでの経過に見合った「標準」の措置を選ぶと、評価の「適正さ」が上がります。軽すぎると直らず、重すぎると人日を使いすぎます。期日までに直さなければ、${A.follow}のあとで次の段階を判断します。工事などで時間がかかる正当な理由があれば、期日の延長が適切なこともあります。</p>`],
    [lab ? '労災が起きたとき' : '火災が起きたとき', lab ? `<p>死亡災害は、すぐに災害時監督に着手します。原因になった違反（墜落防止・機械の安全など）は送検を検討します。休業4日以上の災害は災害調査をすると、危険な設備を使用停止等命令で止めさせられます。</p><p>労災保険の請求は、業務遂行性・業務起因性、通勤の逸脱・中断、過労死や精神障害の認定基準に照らして支給・不支給を決めます。誤って不支給にすると、審査請求で取り消されます。</p><p>労働災害を報告しない「労災かくし」は、健康保険の照会などから疑いが届きます。見つけたら原則として送検します。</p>`
      : `<p>火災が起きたら火災原因調査に着手し、出火原因と消防法令の違反を調べます。人が亡くなった火災では、火災報知設備・避難通路・訓練の状況が特に問われます。</p><p>自動火災報知設備などがない重大な違反は、措置をとると公表されます（違反対象物の公表制度）。</p>`],
    ['評価のしくみ', `<p>100点満点：${lab ? '労働災害の件数（25）・死亡災害（15）' : '火災の件数（25）・火災の死者（15）'}・計画した${A.insp}（10）・重点の取り組み（5）・違反の是正率（15）・措置と判断の適正さ（15）・案件の処理と職員の働き方（10）・啓発（5）。</p><p>評価がSだと、翌年度から職員が1人増えます（2人まで）。</p>`],
  ];
}
MODALS.gHelp = a => {
  const secs = gyHelpSecs();
  const i = clamp(a.sec || 0, 0, secs.length - 1);
  const nav = `<div class="subtabs">${secs.map(([t], k) => `<button type="button" data-act="helpSec" data-sec="${k}" aria-pressed="${k === i}">${t}</button>`).join('')}</div>`;
  return modalFrame('遊び方（法令を守らせる）', `${nav}<div style="max-width:90ch">${secs[i][1]}</div>`, (i > 0 ? btn('前へ', 'helpSec', { sec: i - 1 }) : '') + (i < secs.length - 1 ? btn('次へ', 'helpSec', { sec: i + 1 }, 'primary') : btn('閉じる', 'closeModal', {}, 'primary')), { size: 'wide' });
};

/* ---------- 開始画面（役所で取り締まる） ---------- */
function gyStartDefaults() { return UI.start.g || (UI.start.g = { agency: 'labor', diff: 'normal', term: 5, chief: '', seed: '' }); }
function gyStartStore() {
  const g = gyStartDefaults();
  const c = $('#gstChief'), s = $('#gstSeed');
  if (c) g.chief = c.value;
  if (s) g.seed = s.value;
}
const GY_AG_DESC = {
  labor: '労働基準監督官を率いて、工場・建設現場・店舗・介護施設などを監督する。労働災害の調査、申告への対応、労災保険の認定、是正勧告から送検まで。',
  fire: '予防課の職員を率いて、店舗・ホテル・雑居ビル・病院などに立入検査をする。消防用設備の点検、防火管理、避難経路。火災原因調査と、警告・命令・公表・告発まで。',
};
function renderStartG() {
  const g = gyStartDefaults();
  let meta = null;
  try { meta = JSON.parse(lsGet(LSG.meta('a')) || 'null'); } catch (e) { meta = null; }
  const cont = meta && !meta.over ? btn(`続きから（${esc(meta.co)}・${ymLabel(meta.m)}）`, 'loadAuto') : '';
  const A = GY_AGENCY[g.agency];
  const ags = Object.keys(GY_AGENCY).map(k => `<button type="button" class="preset indcard${g.agency === k ? ' on' : ''}" data-act="gStAg" data-v="${k}" aria-pressed="${g.agency === k}"><b><span class="indico" aria-hidden="true">${GY_AGENCY[k].icon}</span>${k === 'labor' ? '労働基準監督署' : '消防署（予防課）'}</b><span>${esc(GY_AG_DESC[k])}</span></button>`).join('');
  const diffs = [['high', '高い'], ['normal', 'ふつう'], ['low', '低い']].map(([k, l]) => `<button type="button" data-act="gStDiff" data-v="${k}" aria-pressed="${g.diff === k}">${l}</button>`).join('');
  const terms = [[3, '3年'], [5, '5年'], [0, '定めない']].map(([v, l]) => `<button type="button" data-act="gStTerm" data-v="${v}" aria-pressed="${g.term === v}">${l}</button>`).join('');
  const setup = `<section class="setup" aria-labelledby="setupTitle">
    <div class="setup-head"><h2 id="setupTitle">始め方</h2>${cont}</div>
    ${startModeSwitch()}
    <div class="field"><span>役所</span><div class="presets indgrid">${ags}</div></div>
    <div class="grid g2" style="gap:12px"><div class="field"><span>管内の法令を守る意識</span><div class="seg" role="radiogroup">${diffs}</div><span class="small muted">${{ high: '違反が少なく、指導にもよく従う。', normal: '標準的な難しさ。', low: '違反が多く、指導してもなかなか直らない。' }[g.diff]}</span></div>
    <div class="field"><span>任期</span><div class="seg" role="radiogroup">${terms}</div></div></div>
    <label class="field"><span>シード（同じ数字なら同じ展開）</span><input type="text" id="gstSeed" value="${esc(g.seed)}" placeholder="空欄でランダム" inputmode="numeric"></label>
    <p class="small muted" style="margin:0">会社経営モードで「守る側」だった労働・消防の法令を、取り締まる側から学べます。ほかのモードとは別に保存されます。</p>
  </section>`;
  const termTxt = g.term ? `${g.term === 3 ? '三' : '五'}年とする` : '定めない';
  const letter = `<div class="appoint">
    <h1>辞令</h1><div class="gametitle">署長 ― 労働基準監督署・消防署のシミュレーション</div>
    <div class="body-text"><label><input type="text" id="gstChief" value="${esc(g.chief)}" placeholder="氏名" maxlength="12" aria-label="あなたの氏名"></label>　殿<br>
    ${esc(A.n)}長に任命する。<br>
    ${esc(A.goal)}こと。管内の${A.unit}に法令を守らせ、${g.agency === 'labor' ? '労働災害' : '火災'}を減らすこと。<br>
    任期は${warekiYear(START_YEAR)}${START_MONTH}月から${termTxt}。</div>
    <div class="issuer">${warekiYear(START_YEAR)}${START_MONTH}月1日<br>${esc(A.parent)}</div>
    <div class="start">${btn('着任する', 'gStart', {}, 'primary')}${btn('ファイルから読み込む', 'importSave')}${btn('遊び方', 'help')}</div>
  </div>`;
  return `${scene('hero', { cls: 'hero', alt: `港町の${CITY_NAME}の風景` })}<div class="startwrap${artSrc('hero') ? ' with-hero' : ''}">${setup}${letter}</div>`;
}
Object.assign(ACTIONS, {
  gStAg: d => { gyStartStore(); UI.start.g.agency = d.v; render(); },
  gStDiff: d => { gyStartStore(); UI.start.g.diff = d.v; render(); },
  gStTerm: d => { gyStartStore(); UI.start.g.term = +d.v; render(); },
  gStart: () => {
    gyStartStore();
    const g = UI.start.g;
    const chief = (g.chief || '').trim() || `${KS_CITY} 太郎`;
    const seedN = parseInt(String(g.seed).replace(/[^0-9]/g, ''), 10);
    const o = { agency: g.agency, chief, diff: g.diff, term: g.term };
    if (Number.isFinite(seedN)) o.seed = seedN;
    gyNewGame(o);
    UI.tab = 'g_dash'; UI.gEntType = 'all'; UI.gEntSort = 'risk'; UI.gRes = null; UI.gSai = null;
    render();
    window.scrollTo({ top: 0 });
    autosave();
    showModal('gIntro');
  },
});
