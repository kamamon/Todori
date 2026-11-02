'use strict';
/* =========================================================
 *  14_ui_stage.js : 経営戦略（業態ステージ・全国と海外の店舗網・融資方針）、
 *                   場面の画像、格上げ・格下げの演出
 * ========================================================= */

/* ---------- 場面の画像（img/ にある画像を build.js が ART_FILES に登録する） ---------- */
function artSrc(k) {
  if (typeof ART_FILES === 'undefined') return '';
  return ART_FILES[k] || '';
}
function scene(k, opt = {}) {
  const src = artSrc(k);
  if (!src) return opt.fallback ? `<div class="scene ph ${opt.cls || ''}" aria-hidden="true"></div>` : '';
  return `<figure class="scene ${opt.cls || ''}"><img src="${src}" alt="${esc(opt.alt || '')}" loading="lazy" decoding="async">${opt.caption ? `<figcaption>${opt.caption}</figcaption>` : ''}</figure>`;
}
const STAGE_ART = ['stage0', 'stage1', 'stage2'];
const STAGE_DESC = [
  `${CITY_NAME}を地盤とする地域銀行。融資の目利きと街の成長で力をつけ、全国展開（メガバンクへの格上げ）を目指す。`,
  '日本全国に店舗網を広げるメガバンク。地方銀行の買収や大企業との取引で兆円単位のお金を動かす。国際統一基準の8%が最低ライン。',
  '世界に拠点を持つテラバンク。為替・カントリーリスク・外貨調達・海外当局の制裁と隣り合わせ。資本の基準はさらに厳しい。',
];

/* ---------- 経営戦略の画面 ---------- */
UI.netSel = null;
UI.netView = 'nat';
SCREENS.strategy = () => {
  const st = stageOf();
  const si = G.stageInfo;
  const S = STAGES[st];
  const cr = capitalRatio();
  const steps = STAGES.map((x, i) => `<li class="${i < st ? 'done' : i === st ? 'now' : ''}"><span class="n">${i + 1}</span><span>${x.name}</span></li>`).join('');
  const kpis = [
    ['総資産', fmtYen(totalAssets())],
    ['自己資本比率', `<b class="${cr < S.reqCR ? 'neg' : ''}">${fmtPct(cr)}</b><span class="small muted">　基準 ${fmtPct(S.reqCR, 1)}</span>`],
    ['格付', `${RATINGS[G.ratingIdx]}${st ? `<span class="small muted">　基準 ${RATINGS[S.minRating]}以上</span>` : ''}`],
    ['国内の預金シェア', fmtPct(natShare())],
    ['行員・店舗', `${fmtNum(staffTotal() + netStaff())}人・${fmtNum(openBranches().length + netBranches())}店`],
  ];
  const head = `<div class="stagecard">${scene(STAGE_ART[st], { cls: 'stage-art', alt: S.name, fallback: true })}
    <div class="stage-body"><ol class="stage-steps">${steps}</ol>
    <h2 class="stage-name">${S.name}<span class="small muted">　${esc(S.area)}・${S.basis}</span></h2>
    <p class="small" style="margin:0 0 8px">${STAGE_DESC[st]}</p>${kv(kpis)}</div></div>`;
  // 格上げ
  let up = '';
  if (st < 2) {
    const c = canApplyUpgrade();
    const req = c.req || stageRequirements(st + 1);
    const rows = req.map(x => `<tr><td>${x.name}</td><td>${esc(x.need)}</td><td class="n">${esc(x.cur)}</td><td>${x.ok ? tag('達成', 'ok') : tag('未達', 'bad')}</td></tr>`).join('');
    const status = si.review ? `<p class="callout">金融庁で審査中です。${ymLabel(si.review.doneM)}に結論が出ます。審査の終わりにも条件を満たしている必要があります。</p>`
      : c.ok ? `<p class="callout ok">すべての条件を満たしています。申請すると${st === 0 ? '3' : '6'}か月の審査に入ります（審査対応費用 ${fmtYen(REVIEW_COST[st + 1])}）。</p>`
        : `<p class="small muted">${esc(c.msg)}</p>`;
    const note = st === 0 ? `<p class="note">認可されると、全国の地方銀行2行と経営統合してメガバンク・グループになり、日本各地に店舗網を広げられるようになります。</p>`
      : `<p class="note">認可されると海外に拠点を出せます。全国の店舗網を育てて国内の預金シェアを伸ばすのが近道です（全国の上限は5%）。</p>`;
    up = panel(`${STAGES[st + 1].name}への格上げ`, `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>条件</th><th>基準</th><th class="n">現在</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${status}${note}<div class="row" style="margin-top:8px">${btn('格上げを申請する', 'upgradeAsk', {}, 'primary', { disabled: !c.ok })}</div>`);
  } else up = panel('最上位の業態', '<p class="small" style="margin:0">テラバンクは最上位の業態です。海外の拠点を育てながら、厳しい維持基準を守り続けてください。</p>');
  // 維持基準
  let keep = '';
  if (st >= 1) {
    const chk = maintChecks(st);
    keep = panel(`${S.name}の維持基準（四半期ごとに判定）`, `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>基準</th><th>必要な水準</th><th class="n">現在</th><th></th></tr></thead><tbody>${chk.map(x => `<tr><td>${x.name}</td><td>${esc(x.need)}</td><td class="n">${esc(x.cur)}</td><td>${x.ok ? tag('クリア', 'ok') : tag('未達', 'bad')}</td></tr>`).join('')}</tbody></table></div>
      ${si.strikes ? `<p class="callout bad">格下げ警告を受けています。次の四半期末（${ymLabel(nextQuarterEnd())}）にも未達なら${STAGES[st - 1].name}へ格下げされ、${st === 2 ? '海外の拠点' : '全国の店舗網'}をすべて売却することになります。</p>`
        : '<p class="small muted" style="margin:6px 0 0">2四半期続けて未達だと格下げです。自己資本比率が基準の6割を下回ると即座に格下げされます。規模が大きいほど、格下げで手放す事業も大きくなります。</p>'}`);
  }
  const hist = si.hist.length ? panel('業態の履歴', `<ul class="newslist">${si.hist.slice().reverse().map(h => `<li class="${h.kind === 'up' ? 'good' : 'bad'}"><span class="when">${ymShort(h.m)}</span><span class="what">${STAGES[h.from].name}から${STAGES[h.to].name}へ${h.kind === 'up' ? '格上げ' : '格下げ'}${h.reason ? `（${esc(h.reason)}）` : ''}</span></li>`).join('')}</ul>`, { flush: true }) : '';
  const views = [['nat', '全国の店舗網'], ['ovs', '海外の拠点'], ['credit', '融資方針・権限']];
  const sub = `<div class="subtabs">${views.map(([k, l]) => `<button type="button" data-act="netView" data-v="${k}" aria-pressed="${UI.netView === k}">${l}</button>`).join('')}</div>`;
  const body = UI.netView === 'credit' ? creditPolicyPanel() : networkPanel(UI.netView);
  return `<h1 class="h1">経営戦略</h1>
  <p class="lead">業態の格上げを目指し、全国・海外の店舗網を広げます。大きくなるほど動かすお金は増えますが、維持基準は厳しくなり、失敗したときの格下げの痛手も大きくなります。</p>
  <div class="stack">${head}<div class="grid g2">${up}${keep || hist}</div>${keep ? hist : ''}${sub}${body}</div>`;
};
function nextQuarterEnd() { let m = G.m; while (![6, 9, 12, 3].includes(calMonth(m))) m++; return m; }

/* ---------- 地域の地図（タイル） ---------- */
function tileMap(defs, scope) {
  const cw = 92, ch = 64, gap = 6;
  const cols = Math.max(...defs.map(R => R.tile[0])) + 1, rows = Math.max(...defs.map(R => R.tile[1])) + 1;
  const W = cols * (cw + gap) + gap, H = rows * (ch + gap) + gap;
  const sel = UI.netSel && defs.some(R => R.id === UI.netSel) ? UI.netSel : null;
  const home = scope === 'ovs' ? `<g><rect x="${gap + 6 * (cw + gap)}" y="${gap + 1 * (ch + gap)}" width="${cw}" height="${ch}" rx="6" class="tile home"/><text x="${gap + 6 * (cw + gap) + cw / 2}" y="${gap + 1 * (ch + gap) + ch / 2 + 5}" text-anchor="middle" class="tile-t">日本</text></g>` : '';
  const tiles = defs.map(R => {
    const r = G.net[R.id];
    const x = gap + R.tile[0] * (cw + gap), y = gap + R.tile[1] * (ch + gap);
    const lv = r.lv;
    const cls = `tile lv${lv}${r.build ? ' building' : ''}${sel === R.id ? ' sel' : ''}${r.frozenUntil > G.m ? ' frozen' : ''}`;
    const dots = Array.from({ length: 5 }, (_, i) => `<circle cx="${x + cw / 2 - 20 + i * 10}" cy="${y + ch - 13}" r="3" class="${i < lv ? 'on' : r.build && i === lv ? 'bd' : 'off'}"/>`).join('');
    return `<g data-act="netSel" data-a="${R.id}" role="button" tabindex="0" aria-label="${R.name} Lv${lv}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6" class="${cls}"/>
      <text x="${x + cw / 2}" y="${y + 24}" text-anchor="middle" class="tile-t ${lv >= 3 ? 'inv' : ''}">${R.name}</text>${dots}</g>`;
  }).join('');
  return `<svg class="tilemap" viewBox="0 0 ${W} ${H}" role="img" aria-label="${scope === 'ovs' ? '海外の拠点' : '全国の店舗網'}の地図">${home}${tiles}</svg>`;
}

function networkPanel(scope) {
  const st = stageOf();
  const ovs = scope === 'ovs';
  const defs = ovs ? OVERSEAS : NATIONS;
  const locked = ovs ? st < 2 : st < 1;
  if (!UI.netSel || !defs.some(R => R.id === UI.netSel)) UI.netSel = (defs.find(R => G.net[R.id].lv > 0) || defs[0]).id;
  const rows = defs.map(R => {
    const r = G.net[R.id];
    const LV = regionLevels(R.id);
    const dep = ovs ? r.dep : r.ord + r.time;
    const loans = areaLoanBal(R.id);
    const state = r.build ? tag(`拡大中→Lv${r.build.to}（${ymShort(r.build.doneM)}）`, 'warn') : r.frozenUntil > G.m ? tag('業務制限', 'bad') : r.pdUntil >= G.m && r.pdMul > 1 ? tag('貸倒れ増加', 'bad') : '';
    return `<tr class="click${UI.netSel === R.id ? ' sel' : ''}" data-act="netSel" data-a="${R.id}"><td>${R.name}<div class="small muted">${esc(ovs ? R.city : R.sub)}</div></td><td>Lv${r.lv} ${esc(LV[r.lv].name)}</td>
      <td class="n">${dep ? fmtYen(dep) : '―'}</td><td class="n">${loans ? fmtYen(loans) : '―'}</td><td class="n">${r.lv || r.build ? fmtYen(regionOpex(R.id)) : '―'}</td><td>${state}</td></tr>`;
  }).join('');
  const totDep = ovs ? B('depFx') : natDep();
  const totLoans = sum(defs, R => areaLoanBal(R.id));
  const lockMsg = locked ? `<p class="callout">${ovs ? '海外への展開はテラバンクに格上げされてから行えます。' : '全国への展開はメガバンクに格上げされてから行えます。'}地図と市場の規模は今のうちに確かめておけます。</p>` : '';
  const summary = kv([[ovs ? '海外店預金' : '全国の店舗網の預金', fmtYen(totDep)], [ovs ? '海外の貸出' : '全国の店舗網の貸出', fmtYen(totLoans)],
    ['店舗・行員', `${fmtNum(sum(defs, R => regionBranches(R.id)))}店・${fmtNum(sum(defs, R => regionStaff(R.id)))}人`], ['月間の経費', fmtYen(sum(defs, R => regionOpex(R.id)))],
    ovs ? ['外貨の調達ギャップ', fmtYen(sum(OVERSEAS, R => G.net[R.id].gap || 0))] : ['国内の預金シェア', `${fmtPct(natShare())}（上限5%）`]]);
  return `${lockMsg}<div class="grid g-side"><div class="stack">${panel(ovs ? '海外の拠点' : '全国の店舗網', `${tileMap(defs, scope)}<p class="note">マスをクリックすると地域の詳細が出ます。点の数が店舗網の段階（最大5）。</p>`)}
    ${panel('地域の一覧', `<div class="tbl-wrap"><table class="t"><thead><tr><th>地域</th><th>段階</th><th class="n">預金</th><th class="n">貸出</th><th class="n">月間経費</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`, { flush: true })}</div>
    <div class="stack">${panel('合計', summary)}${regionDetail(UI.netSel, locked)}</div></div>`;
}

function regionDetail(a, locked) {
  const R = regionDef(a), r = G.net[a], ovs = isOvsArea(a);
  const LV = regionLevels(a), sc = regionScale(a);
  const cur = LV[r.lv], nx = LV[r.lv + 1];
  const dep = ovs ? r.dep : r.ord + r.time;
  const segs = segLoans(a);
  const rows = [
    ['市場の規模', `預金 ${fmtNum(R.dep)}兆円・貸出 ${fmtNum(R.loan)}兆円`],
    ovs ? ['現地の金利・為替', `政策金利 ${fmtPct(r.rate, 2)}・通貨 ${r.fx >= 1 ? '+' : MINUS}${fmtNum(Math.abs(r.fx - 1) * 100, 1)}%（進出の基準比）`] : ['競争の激しさ', R.compet >= 1.2 ? '激しい' : R.compet >= 1 ? '普通' : 'ゆるやか'],
    ovs ? ['カントリーリスク・規制', `${'★'.repeat(R.risk)}${'☆'.repeat(5 - R.risk)}・規制${R.reg >= 2.5 ? '厳しい' : R.reg >= 2 ? '普通' : 'ゆるやか'}${R.geo ? '・地政学リスク' : ''}`] : null,
    ['現在の段階', `Lv${r.lv} ${esc(cur.name)}（店舗${fmtNum(regionBranches(a))}・行員${fmtNum(regionStaff(a))}人）`],
    ['預金', dep ? fmtYen(dep) : '―'],
    ...segs.map(L => [esc(segName(a, L.seg)), `${fmtYen(L.bal)}（金利${fmtRate(L.rate)}・延滞率${fmtPct(L.pd, 2)}）`]),
    ['月間の経費', fmtYen(regionOpex(a))],
    ovs && r.gap ? ['外貨の調達ギャップ', `${fmtYen(r.gap)}（ヘッジ ${fmtNum(G.credit.hedge * 100, 0)}%）`] : null,
  ];
  let act = '';
  if (!locked) {
    const b = buildCheck(a);
    const acq = acqQuote(a);
    const parts = [];
    if (nx && !nx.acqOnly) parts.push(`<div class="nextlv"><b>次の段階：Lv${nx.lv} ${esc(nx.name)}</b><div class="small muted">投資 ${fmtYen(nx.capex * sc)}・完成まで${nx.months}か月・月間経費 ${fmtYen(nx.opex * sc)}・預金シェアの目安 ${fmtPct(nx.dep * 100, 2)}</div>
      <div class="row" style="margin-top:6px">${btn('拡大する', 'regionBuildAsk', { a }, 'primary sm', { disabled: !b.ok })}${b.ok ? '' : `<span class="small muted">${esc(b.msg)}</span>`}</div></div>`);
    if (acq && (ovs ? r.lv >= 1 : true)) {
      const c = acqCheck(a, 'stock');
      parts.push(`<div class="nextlv"><b>${ovs ? '現地の有力銀行' : '地方銀行'}を買収：${esc(acq.name)}</b><div class="small muted">Lv${acq.to}へ一気に拡大。預金 ${fmtYen(acq.d)}・貸出 ${fmtYen(acq.l)}・買収額 ${fmtYen(acq.price)}（のれん ${fmtYen(acq.goodwill)}）</div>
        <div class="row" style="margin-top:6px">${btn('買収を検討する', 'acqOpen', { a }, 'sm')}${c.ok || c.q ? '' : `<span class="small muted">${esc(c.msg)}</span>`}</div></div>`);
    }
    if (r.lv || r.build) parts.push(`<div class="row" style="margin-top:8px">${btn('この地域から撤退する', 'regionExitAsk', { a }, 'sm danger')}</div>`);
    act = parts.join('');
  }
  return panel(`${R.name}`, `${kv(rows.filter(Boolean))}${act}`, { aside: ovs ? esc(R.city) : esc(R.sub) });
}

/* ---------- 融資方針・権限 ---------- */
function creditPolicyPanel() {
  const st = stageOf();
  const polRow = (scope, label) => {
    const p = G.credit[scope];
    const ls = segLoans().filter(L => (scope === 'ovs') === isOvsArea(L.area));
    const bal = sum(ls, L => L.bal);
    const el = sum(ls, L => L.bal * L.pd / 100 * segLGD(L));
    const npl = sum(ls, L => L.npl || 0);
    const adjOpts = [-0.3, -0.15, 0, 0.15, 0.3, 0.6].map(v => `<option value="${v}"${Math.abs(p.adj - v) < 1e-9 ? ' selected' : ''}>${v > 0 ? '+' : v < 0 ? MINUS : '±'}${fmtNum(Math.abs(v), 2)}%</option>`).join('');
    const q = nplBulkQuote(scope);
    return `<div class="policy"><h3>${label}</h3>
      <div class="field"><span>新規融資の姿勢</span><div class="seg">${Object.entries(APPETITE).map(([k, A]) => `<button type="button" data-act="creditSet" data-scope="${scope}" data-v="${k}" aria-pressed="${p.app === k}">${A.name}</button>`).join('')}</div></div>
      <label class="field" style="margin-top:8px"><span>金利の上乗せ（店頭の標準金利に対して）</span><select data-ch="creditAdj" data-scope="${scope}">${adjOpts}</select></label>
      <p class="small muted" style="margin:6px 0 0">積極にすると量は増えますが、審査が甘くなり延滞が増えます。金利を上げると量は減り、借り手の質も下がります（逆選択）。変更は新しく貸す分から効いてきます。</p>
      ${kv([['残高', fmtYen(bal)], ['年間の予想損失', fmtYen(el)], ['不良債権', `${fmtYen(npl)}（${fmtPct(bal ? npl / bal * 100 : 0)}）`]])}
      ${q.face >= 1e8 ? `<div class="row" style="margin-top:6px">${btn(`不良債権を一括売却（${fmtYen(q.face)} → ${fmtYen(q.price)}）`, 'nplSaleAsk', { scope }, 'sm danger')}</div>` : ''}</div>`;
  };
  const d = G.policy.delegate;
  const gopt = (sel, from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map(g => `<option value="${g}"${g === sel ? ' selected' : ''}>格付${g}</option>`).join('');
  const amtOpt = [1e8, 3e8, 10e8, 30e8].map(v => `<option value="${v}"${d.max === v ? ' selected' : ''}>${fmtYen(v)}以下</option>`).join('');
  const deleg = panel('決裁権限の委譲（支店長決裁）', `<p class="small" style="margin:0 0 8px">回答期限を迎えた${CITY_NAME}の小口の申込を、月末に審査基準で自動的に処理します（調査はしないため粉飾は見抜けません）。大企業・海外企業の案件は常に頭取決裁です。</p>
    <label class="inline"><input type="checkbox" data-ch="delegOn" ${d.on ? 'checked' : ''}> 委譲する</label>
    <div class="row" style="gap:12px;margin-top:8px;flex-wrap:wrap"><label class="field"><span>承認：格付</span><select data-ch="delegSel" data-k="ok">${gopt(d.ok, 1, 9)}</select></label>
    <label class="field"><span>謝絶：格付</span><select data-ch="delegSel" data-k="ng">${gopt(d.ng, 2, 10)}</select></label>
    <label class="field"><span>対象の金額</span><select data-ch="delegMax">${amtOpt}</select></label></div>
    ${G.lastDelegate ? `<p class="small muted" style="margin:8px 0 0">前回：承認${G.lastDelegate.acc}件（${fmtYen(G.lastDelegate.amt)}）・謝絶${G.lastDelegate.ng}件</p>` : ''}`);
  const hedge = [0, 0.5, 0.8, 1].map(v => `<button type="button" data-act="hedgeSet" data-v="${v}" aria-pressed="${Math.abs(G.credit.hedge - v) < 1e-9}">${fmtNum(v * 100, 0)}%</button>`).join('');
  const fx = st >= 2 ? panel('為替ヘッジ（外貨調達）', `<p class="small" style="margin:0 0 8px">海外の貸出が現地の預金を上回る分は、円を為替スワップで外貨に換えて賄います。ヘッジすると現地との金利差ぶんの調達コストがかかり、ヘッジしない分は為替の変動がそのまま損益に出ます（自己資本比率の計算でも為替リスクとして加算）。</p>
    <div class="field"><span>ヘッジ比率</span><div class="seg">${hedge}</div></div>`) : '';
  return `<div class="grid g2">${panel('リテール・中小企業向け融資の方針', `${polRow('nat', '全国の店舗網')}${st >= 2 ? '<hr class="sep">' + polRow('ovs', '海外の拠点') : ''}`)}<div class="stack">${deleg}${fx}</div></div>`;
}

Object.assign(ACTIONS, {
  netView: d => { UI.netView = d.v; render(); },
  netSel: d => { UI.netSel = d.a; render(); },
  upgradeAsk: () => {
    const to = stageOf() + 1;
    confirmBox(`${STAGES[to].name}への格上げを申請`, `金融庁に${to === 1 ? '全国展開' : '海外展開'}の認可を申請します。審査は${to === 1 ? 3 : 6}か月で、審査の終わりにも条件を満たしている必要があります。対応費用として${fmtYen(REVIEW_COST[to])}がかかります。`, '申請する', 'upgradeGo');
  },
  upgradeGo: () => { const r = applyUpgrade(); toast(r.ok ? `格上げを申請しました（${r.months}か月の審査）` : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
  regionBuildAsk: d => {
    const c = buildCheck(d.a);
    if (!c.ok) { toast(c.msg, 'bad'); return; }
    const R = regionDef(d.a), sc = regionScale(d.a);
    confirmBox(`${R.name}：${c.nx.name}へ拡大`, `投資額 ${fmtYen(c.cost)}（15年で償却）。完成まで${c.nx.months}か月、完成後の月間経費は ${fmtYen(c.nx.opex * sc)}。完成すると預金と貸出が少しずつ集まり始めます。`, '拡大する', 'regionBuildGo', { a: d.a });
  },
  regionBuildGo: d => { const r = buildRegion(d.a); toast(r.ok ? '拡大に着手しました' : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
  regionExitAsk: d => {
    const R = regionDef(d.a), ovs = isOvsArea(d.a);
    confirmBox(`${R.name}から撤退`, `貸出債権を${ovs ? '5' : '1.5'}%引きで売却し、預金は他行に引き継ぎます。店舗・設備は簿価の6割で売却し、のれんは全額償却します。撤退後も地域の大企業との取引は続きます。`, '撤退する', 'regionExitGo', { a: d.a }, true);
  },
  regionExitGo: d => { const r = exitRegion(d.a, false); toast(r.ok ? `撤退しました（損失 ${fmtYen(Math.max(0, r.loss))}）` : r.msg, r.ok ? '' : 'bad'); trueUpProvisionsSilent(); closeModal(true); },
  acqOpen: d => showModal('acq', { a: d.a, method: 'stock' }),
  acqMethod: d => { UI.modal.args.method = d.v; drawModal(); },
  acqGo: d => { const r = acquireRegion(d.a, d.m); toast(r.ok ? `${r.q.name}を買収しました` : r.msg, r.ok ? '' : 'bad'); if (r.ok) closeModal(true); else drawModal(); },
  creditSet: d => { G.credit[d.scope].app = d.v; render(); },
  hedgeSet: d => { G.credit.hedge = +d.v; render(); },
  nplSaleAsk: d => {
    const q = nplBulkQuote(d.scope);
    confirmBox('不良債権の一括売却', `延滞・条件変更先の債権 ${fmtYen(q.face)} を投資ファンドに ${fmtYen(q.price)} で売却します。差額は売却損になりますが、不良債権比率はすぐに下がります（1年ほどかけて再び積み上がります）。`, '売却する', 'nplSaleGo', { scope: d.scope }, true);
  },
  nplSaleGo: d => { const r = nplBulkSale(d.scope); toast(r.ok ? '不良債権を売却しました' : r.msg, r.ok ? '' : 'bad'); closeModal(true); },
});
Object.assign(CHANGES, {
  creditAdj: el => { G.credit[el.dataset.scope].adj = +el.value; render(); },
  delegOn: el => { G.policy.delegate.on = el.checked; render(); },
  delegSel: el => { G.policy.delegate[el.dataset.k] = +el.value; render(); },
  delegMax: el => { G.policy.delegate.max = +el.value; render(); },
});

/* ---------- 買収 ---------- */
MODALS.acq = a => {
  const R = regionDef(a.a), ovs = isOvsArea(a.a);
  const q = acqQuote(a.a);
  if (!q) return modalFrame('買収', '<p>買収できる銀行はありません。</p>', btn('閉じる', 'closeModal'));
  const m = a.method;
  const c = acqCheck(a.a, m);
  const cap = marketCap();
  const body = `<p style="margin:0 0 10px">${R.name}の${ovs ? '有力銀行' : '地方銀行'}「<b>${esc(q.name)}</b>」が買収に応じる意向です。買収すると${R.name}の店舗網は一気に<b>Lv${q.to}</b>になります。</p>
    <div class="grid g2"><div>${kv([['引き継ぐ預金', fmtYen(q.d)], ['引き継ぐ貸出', fmtYen(q.l)], ['相手の純資産', fmtYen(q.na)], ['買収額（純資産の' + fmtNum(q.prem, 2) + '倍）', `<b>${fmtYen(q.price)}</b>`], ['のれん（20年で償却・資本から控除）', fmtYen(q.goodwill)], ['経営統合の費用', fmtYen(q.na * 0.04)]])}</div>
    <div><div class="field"><span>支払方法</span><div class="seg"><button type="button" data-act="acqMethod" data-v="stock" aria-pressed="${m === 'stock'}">株式交換</button><button type="button" data-act="acqMethod" data-v="cash" aria-pressed="${m === 'cash'}">現金</button></div></div>
    <p class="small" style="margin:8px 0">${m === 'stock' ? `新しい株式を発行して支払います。資本が増えるので自己資本比率は保ちやすい一方、既存株主の持分が薄まります（時価総額 ${fmtYen(cap)}）。` : '手元の資金で支払います。株主の持分は薄まりませんが、のれんと引き継ぐ貸出の分だけ自己資本比率が下がります。'}</p>
    ${kv([['買収後の自己資本比率（見込み）', c.cr !== undefined ? `<b class="${c.cr < reqCR() + 1 ? 'neg' : ''}">${fmtPct(c.cr)}</b>` : '―']])}</div></div>
    <p class="callout${c.ok ? '' : ' bad'}" style="margin-top:10px">${c.ok ? '買収のあとで、統合前の査定では見えなかった不良債権が見つかることがあります（貸倒れが当面増えます）。買収は1年に1件までです。' : esc(c.msg)}</p>`;
  return modalFrame(`${esc(q.name)}の買収`, body, btn('見送る', 'closeModal') + btn('買収する', 'acqGo', { a: a.a, m }, 'primary', { disabled: !c.ok }), { sub: R.name });
};

/* ---------- 格上げ・格下げの演出 ---------- */
MODALS.stage = a => {
  if (a.kind === 'up') {
    const S = STAGES[a.to];
    const mg = a.merger;
    const body = `${scene(STAGE_ART[a.to], { cls: 'modal-art', alt: S.name })}
      <p style="font-family:var(--f-doc);font-size:19px;margin:0 0 8px"><b>${esc(G.bankName)}は${S.name}になりました</b></p>
      ${mg ? `<p>${mg.names.map(esc).join('と')}との経営統合が完了し、メガバンク・グループが誕生しました。引き継いだ預金は${fmtYen(mg.D)}、貸出は${fmtYen(mg.L)}です。</p>` : ''}
      <ul class="small">${a.to === 1 ? '<li><b>経営戦略</b>の画面から、日本各地に店舗網を広げられます（地方銀行の買収も可能）。</li><li>全国の大企業から、大口の融資の申込が届くようになります。</li><li>自己資本比率の最低基準は国際統一基準の<b>8%</b>に上がります。格付BBB以上・不良債権比率6%以下なども守る必要があります。</li><li>汐見市の小口の申込は、<b>決裁権限の委譲</b>で支店長に任せられます。</li>'
        : '<li><b>経営戦略</b>の画面から、海外に拠点を出せます（駐在員事務所→支店→現地法人→現地銀行の買収→地域統括本部）。</li><li>為替の変動、各国の危機、外貨調達、海外当局の制裁といった新しいリスクを抱えます。</li><li>自己資本比率の最低基準は<b>10.5%</b>、格付A−以上、不良債権比率4%以下、マネロン対策Lv3が求められます。</li>'}</ul>`;
    return modalFrame(`${S.name}への格上げ`, body, btn('経営戦略を開く', 'go', { tab: 'strategy' }) + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide' });
  }
  if (a.kind === 'warn') {
    const body = `<p style="margin:0 0 8px">${STAGES[stageOf()].name}の維持基準を満たしていません。<b>次の四半期末も未達なら格下げ</b>です。</p><ul>${a.ng.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="small">増資で資本を厚くする、不良債権を売却する、リスクの高い地域から撤退する、融資方針を慎重にする、などで立て直してください。</p>`;
    return modalFrame('格下げ警告', body, btn('経営戦略を開く', 'go', { tab: 'strategy' }) + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
  }
  if (a.kind === 'down') {
    const body = `${scene('crisis', { cls: 'modal-art', alt: '' })}<p style="font-family:var(--f-doc);font-size:18px;margin:0 0 8px"><b class="neg">${STAGES[a.from].name}から${STAGES[a.to].name}へ格下げ</b></p>
      <p>${esc(a.reason)}。</p><p>${a.from === 2 ? '海外の拠点' : '全国の店舗網'}（${a.n}地域）を売却し、損失${fmtYen(a.loss)}を計上しました。信用度と株価は大きく下がり、格付も引き下げられます。再び格上げを申請できるのは3年後です。</p>`;
    return modalFrame('格下げ', body, btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide' });
  }
  const body = `<p style="margin:0 0 8px">${STAGES[a.to].name}への格上げは認められませんでした。審査期間中に次の条件を満たさなくなりました。</p><ul>${a.ng.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="small">半年後から再び申請できます。</p>`;
  return modalFrame('格上げの否認', body, btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
};

HELP.push(['メガバンク・テラバンク', `<p>銀行の業態は<b>地域銀行 → メガバンク → テラバンク</b>と格上げできます。<b>経営戦略</b>の画面で条件を確かめ、金融庁に申請します。</p>
  <table class="t compact"><tbody>
  <tr><td><b>メガバンク</b></td><td>総資産800億円・${CITY_NAME}の預金シェア2.5%・自己資本比率10%・格付A−・不良債権比率3%以下・勘定系Lv2・マネロン対策Lv2</td><td>全国の地方銀行2行と経営統合し、9つの地域に店舗網を広げられる。大企業の大口案件が届く</td></tr>
  <tr><td><b>テラバンク</b></td><td>国内の預金シェア2%・自己資本比率12%・格付A・不良債権比率2.5%以下・勘定系Lv5・マネロン対策とサイバー対策Lv3・3年間行政処分なし</td><td>北米・欧州・アジアなど8つの地域に拠点を出せる。為替・カントリーリスク・外貨調達を抱える</td></tr></tbody></table>
  <ul><li><b>店舗網</b>：地域ごとに段階（Lv1〜5）があり、拡大には投資と時間がかかります。完成すると預金と、個人・中小企業向けの小口融資が少しずつ積み上がります。1つの段階が完成してから1年は次へ進めません。</li>
  <li><b>買収</b>：地方銀行（海外では現地の有力銀行）を買えば一気に大きくなれます。株式交換なら資本も増えますが、のれんは資本から差し引かれ、隠れた不良債権が出てくることもあります。</li>
  <li><b>融資方針</b>：小口融資の量と質は、新規融資の姿勢と金利の上乗せで決まります。海外では為替ヘッジの比率も決めます。</li>
  <li><b>維持基準と格下げ</b>：上の業態ほど基準が厳しく（自己資本比率 メガバンク8%・テラバンク10.5%など）、2四半期続けて未達だと格下げです。格下げされると上位の業態で築いた店舗網をすべて安値で売ることになり、規模が大きいほど損失も大きくなります。</li>
  <li><b>大型のリスク</b>：全国規模のシステム障害、不正販売、金融危機での市場損失、各国の通貨危機、地政学リスク、海外当局の制裁金、外貨調達の逼迫、不正なトレーダー。どれも規模に比例して大きくなります。</li></ul>`]);
