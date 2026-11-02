'use strict';
/* =========================================================
 *  12_ui_loans.js : 頭取室・融資審査（稟議書）・与信管理
 * ========================================================= */

/* ---------- 企業の決算書表示 ---------- */
const FS_ROWS = {
  pl: [
    ['売上高', s => s.S, 'sum'], ['売上原価', s => s.COGS], ['売上総利益', s => s.GP, 'sum'],
    ['販売費及び一般管理費', s => s.SGA + s.DEP], ['うち減価償却費', s => s.DEP, 'i2'],
    ['営業利益', s => s.OPI, 'sum'], ['営業外収益', s => s.NONOP], ['営業外費用（支払利息）', s => s.INT],
    ['経常利益', s => s.ORD, 'sum'], ['特別損益', s => s.EXTRA], ['税引前当期純利益', s => s.PRETAX, 'sum'],
    ['法人税等', s => s.TAX], ['当期純利益', s => s.NI, 'grand'],
  ],
  bs: [
    ['資産の部', null, 'head'], ['現金預金', s => s.CASH, 'i1'], ['売上債権（受取手形・売掛金）', s => s.AR, 'i1'], ['棚卸資産', s => s.INV, 'i1'],
    ['その他流動資産（仮払金等）', s => s.OCA, 'i1'], ['流動資産合計', s => s.CA, 'sum'], ['有形固定資産', s => s.PPE, 'i1'], ['うち土地', s => s.LAND, 'i2'],
    ['投資その他の資産', s => s.INVEST, 'i1'], ['固定資産合計', s => s.FA, 'sum'], ['資産合計', s => s.TA, 'grand'],
    ['負債・純資産の部', null, 'head'], ['仕入債務（支払手形・買掛金）', s => s.AP, 'i1'], ['短期借入金', s => s.STD, 'i1'], ['その他流動負債', s => s.OCL, 'i1'],
    ['流動負債合計', s => s.CL, 'sum'], ['長期借入金', s => s.LTD, 'i1'], ['負債合計', s => s.TL, 'sum'], ['資本金', s => s.CAP, 'i1'],
    ['利益剰余金', s => s.RE, 'i1'], ['純資産合計', s => s.EQ, 'sum'], ['負債・純資産合計', s => s.TL + s.EQ, 'grand'],
  ],
  cf: [
    ['営業活動によるキャッシュ・フロー', null, 'head'], ['当期純利益', (s, c) => s.NI, 'i1'], ['減価償却費', (s, c) => s.DEP, 'i1'],
    ['売上債権の増減', (s, c) => c.dAR, 'i1'], ['棚卸資産の増減', (s, c) => c.dINV, 'i1'], ['仕入債務の増減', (s, c) => c.dAP, 'i1'],
    ['その他の増減', (s, c) => c.dOther, 'i1'], ['営業活動によるCF', (s, c) => c.ocf, 'sum'],
    ['投資活動によるキャッシュ・フロー', null, 'head'], ['設備投資', (s, c) => -c.capex, 'i1'], ['その他の投資', (s, c) => c.dInvest, 'i1'], ['投資活動によるCF', (s, c) => c.icf, 'sum'],
    ['財務活動によるキャッシュ・フロー', null, 'head'], ['借入金の増減', (s, c) => c.dSTD + c.dLTD, 'i1'], ['配当金の支払', (s, c) => -s.DIV, 'i1'], ['財務活動によるCF', (s, c) => c.fcf, 'sum'],
    ['現金の増減', (s, c) => c.dCash, 'grand'], ['期首現金', (s, c) => c.begin, 'i1'], ['期末現金', (s, c) => c.end, 'i1'],
  ],
};
const RATIO_ROWS = [
  ['収益性', null], ['売上高総利益率', r => r.gpm, '%', 'gpm'], ['売上高営業利益率', r => r.opm, '%', 'opm'], ['売上高経常利益率', r => r.ordm, '%', 'ordm'], ['総資産経常利益率（ROA）', r => r.roa, '%'],
  ['安全性', null], ['自己資本比率', r => r.eqR, '%', 'eqR'], ['流動比率', r => r.cr, '%', 'cr'], ['当座比率', r => r.qr, '%'], ['固定長期適合率', r => r.fixLong, '%'],
  ['返済能力', null], ['債務償還年数', r => r.dsy, '年'], ['インタレスト・カバレッジ・レシオ', r => r.icr, '倍'], ['借入金月商倍率', r => r.debtMonths, 'か月'], ['営業キャッシュ・フロー', r => r.ocf, '千円'],
  ['効率性', null], ['売上債権回転日数', r => r.arDays, '日', 'arDays'], ['棚卸資産回転日数', r => r.invDays, '日', 'invDays'], ['仕入債務回転日数', r => r.apDays, '日', 'apDays'], ['総資産回転率', r => r.turn, '回'],
  ['粉飾チェックの視点', null], ['売上高の伸び', r => r.salesG, '%'], ['売上債権の伸び', r => r.arG, '%'], ['営業CF÷当期純利益', r => r.ocfNi, '倍'],
  ['減価償却率', r => r.depRate, '%', 'depRate'], ['税負担率（法人税等÷税引前利益）', r => r.taxRate, '%', 'taxRate'], ['その他流動資産÷売上高', r => r.ocaS, '%'], ['支払利息÷有利子負債', r => r.impliedInt, '%'],
];
let FS_BIG = false; // 大企業の決算書は百万円単位で表示する
const fmtFS = v => (FS_BIG ? fmtM(v) : fmtK(v));
function fmtRatio(v, unit) {
  if (v === undefined || v === null || isNaN(v)) return '―';
  if (!isFinite(v)) return unit === '年' ? '返済不能' : '―';
  if (unit === '千円') return fmtFS(v);
  const d = unit === '回' || unit === '倍' || unit === '年' || unit === 'か月' ? 1 : unit === '日' ? 0 : 1;
  return (v < 0 ? '△' : '') + fmtNum(Math.abs(v), d) + (unit === '%' ? '%' : unit === '千円' ? '' : unit);
}

function companyFS(co, view, showTrue, n = 3) {
  FS_BIG = !!co.big;
  const years = co.years.slice(-(n + 1));
  const disp = years.slice(1);
  const found = co.fraud && co.fraud.found;
  const pick = y => (showTrue ? y.T : repOf(y));
  const heads = disp.map(y => `<th>${fiscalLabelFor(y.endM)}</th>`).join('');
  const diffHead = found ? `<th>差異（実態−提出）</th>` : '';
  if (view === 'ratio') {
    const avg = industryAvg(co.ind);
    const rs = disp.map((y, i) => ratiosOf(pick(y), pick(years[i])));
    const body = RATIO_ROWS.map(([name, f, unit, avgKey]) => {
      if (!f) return `<tr class="head"><td colspan="${disp.length + 2}">${name}</td></tr>`;
      const cells = rs.map(r => `<td>${fmtRatio(f(r), unit)}</td>`).join('');
      return `<tr class="i1"><td>${name}</td>${cells}<td class="muted">${avgKey && avg[avgKey] !== undefined ? fmtRatio(avg[avgKey], unit) : '―'}</td></tr>`;
    }).join('');
    return `<div class="tbl-wrap"><table class="fs"><thead><tr><th>指標${showTrue ? '（実態）' : ''}</th>${heads}<th>業界平均</th></tr></thead><tbody>${body}</tbody></table></div><p class="note">業界平均は中小企業の目安。金額は${FS_BIG ? '百万円' : '千円'}単位。</p>`;
  }
  const rows = FS_ROWS[view];
  const body = rows.map(([name, f, cls]) => {
    if (!f) return `<tr class="head"><td colspan="${disp.length + 1 + (found ? 1 : 0)}">${name}</td></tr>`;
    const vals = disp.map((y, i) => {
      const s = pick(y);
      const c = view === 'cf' ? cfOf(s, pick(years[i])) : null;
      return f(s, c);
    });
    const cells = vals.map(v => `<td class="${v < 0 ? 'neg' : ''}">${fmtFS(v)}</td>`).join('');
    let diff = '';
    if (found) {
      const last = disp[disp.length - 1], prevY = years[years.length - 2];
      const tv = f(last.T, view === 'cf' ? cfOf(last.T, prevY.T) : null);
      const rv = f(repOf(last), view === 'cf' ? cfOf(repOf(last), repOf(prevY)) : null);
      const d = tv - rv;
      const th = FS_BIG ? 1e6 : 1000;
      diff = `<td class="${Math.abs(d) >= th ? 'diff' : 'muted'}">${Math.abs(d) >= th ? fmtFS(d) : '―'}</td>`;
    }
    return `<tr class="${cls || ''}"><td>${name}</td>${cells}${diff}</tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="fs"><thead><tr><th>（単位：${FS_BIG ? '百万円' : '千円'}）${showTrue ? '<span class="true">実態</span>' : ''}</th>${heads}${diffHead}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ---------- 頭取室 ---------- */
function inboxItems() {
  const items = [];
  const pend = G.apps.filter(a => a.status === 'pending');
  if (pend.length) {
    const exp = pend.filter(a => a.exp <= G.m).length;
    items.push({ ico: '融', t1: `融資の申込 ${pend.length}件`, t2: exp ? `うち${exp}件は今月末が回答期限` : '回答期限は来月末', act: btn('審査する', 'go', { tab: 'loans' }, 'sm primary') });
  }
  const offers = PROJECTS.filter(P => G.city.projects[P.id]?.status === 'offered');
  for (const P of offers) {
    const st = G.city.projects[P.id];
    items.push({ ico: '案', t1: `開発案件：${P.name}`, t2: `シンジケートローン${fmtYen(st.debt)}。参加表明は${ymLabel(st.deadline)}末まで（現在の表明額 ${fmtYen(st.ourAmt || 0)}）`, act: btn('検討する', 'go', { tab: 'city', dist: P.d }, 'sm') });
  }
  for (const it of G.inbox) {
    if (it.type === 'resched') {
      const L = G.loans.find(x => x.id === it.loanId);
      if (!L) continue;
      items.push({ ico: '猶', cls: 'warn', t1: `返済猶予の申し出：${L.name}`, t2: `元金返済の1年間据置を希望（残高${fmtYen(L.bal)}）。応じると要管理先に区分`, act: btn('応じる', 'resched', { id: it.id, v: 1 }, 'sm') + btn('断る', 'resched', { id: it.id, v: 0 }, 'sm danger') });
    } else if (it.type === 'refi') {
      const L = G.loans.find(x => x.id === it.loanId);
      if (!L) continue;
      items.push({ ico: '期', cls: 'warn', t1: `期日到来：${L.name}`, t2: `${fmtYen(L.bal)}の一括返済が困難との申し出。1年延長（折り返し）するか、返済を求めるか`, act: btn('1年延長', 'refi', { id: it.id, v: 1 }, 'sm') + btn('返済を求める', 'refi', { id: it.id, v: 0 }, 'sm danger') });
    } else if (it.type === 'fsaNotice') {
      items.push({ ico: '検', cls: 'bad', t1: '金融庁検査の予告（来月）', t2: '自己査定の区分、決算書の検証、管理態勢を点検しておきましょう', act: btn('与信管理へ', 'go', { tab: 'portfolio' }, 'sm') });
    }
  }
  const gap = G.loans.filter(L => isActiveLoan(L) && sysClass(L) > L.cls).length;
  if (gap) items.push({ ico: '査', cls: 'warn', t1: `自己査定：システム判定より甘い区分の先が${gap}件`, t2: '承継した貸出には前経営陣の甘い査定が残っています。検査で指摘される前に見直しましょう', act: btn('見直す', 'pfGap', {}, 'sm') });
  const rev = G.inbox.filter(x => x.type === 'review').length;
  if (rev) items.push({ ico: '決', t1: `決算書の検証待ち ${rev}先`, t2: '融資先から新しい決算書が届いています。内容を確認し債務者区分を見直します', act: btn('確認する', 'go', { tab: 'portfolio' }, 'sm') });
  // 警告
  const cap = vaultCapacity(), tgt = cashRequired() * G.vault.buffer;
  if (tgt > cap * 0.95) items.push({ ico: '庫', cls: 'warn', t1: '金庫の容量が不足しています', t2: `必要な現金在高 ${fmtYen(tgt)} に対し収容能力 ${fmtYen(cap)}。年末などの需要期に現金不足でATMが止まる恐れ`, act: btn('金庫へ', 'go', { tab: 'facility' }, 'sm') });
  const load = coreLoad();
  if (load > 0.85) items.push({ ico: '系', cls: load > 1 ? 'bad' : 'warn', t1: `勘定系システムの使用率 ${fmtPct(load * 100, 0)}`, t2: load > 1 ? '処理能力を超えています。新規口座の受付が止まり、障害が頻発します' : '処理能力の上限が近づいています。システム更改を検討してください', act: btn('システムへ', 'go', { tab: 'system' }, 'sm') });
  const svc = serviceQuality();
  if (svc < 0.9) items.push({ ico: '人', cls: 'warn', t1: '窓口・事務の人員が不足しています', t2: `必要人員 ${fmtNum(opsRequired(), 0)}人に対し${G.staff.ops}人。待ち時間と事務ミスが増え、信用度が下がります`, act: btn('人事へ', 'go', { tab: 'hr' }, 'sm') });
  const cr = capitalRatio();
  if (cr < 8) items.push({ ico: '資', cls: cr < 4 ? 'bad' : 'warn', t1: `自己資本比率が${fmtPct(cr)}に低下`, t2: cr < 4 ? '国内基準の4%を下回っています。早期是正措置の対象です' : '格付と信用度に影響します。リスクアセットの抑制か増資を', act: btn('資本政策', 'go', { tab: 'finance', fin: 'capital' }, 'sm') });
  if (!G.rates.timeLink && G.rates.time < G.eco.mktTime - 0.1) items.push({ ico: '利', cls: 'warn', t1: '定期預金金利が市場を下回っています', t2: `当行 ${fmtRate(G.rates.time)} ／ 市場平均 ${fmtRate(G.eco.mktTime)}。満期時に預金が流出します`, act: btn('金利へ', 'go', { tab: 'rates' }, 'sm') });
  if (G.flags.publicOffer && !G.flags.publicFunds) items.push({ ico: '公', cls: 'bad', t1: '公的資金の注入を申請できます', t2: '自己資本比率が4%を下回りました', act: btn('検討する', 'publicFundsShow', {}, 'sm') });
  return items;
}

/* 頭取室の「業態」欄：次の格上げまでの進み具合 */
function dashStagePanel(cls, nextCls) {
  const st = stageOf();
  const si = G.stageInfo;
  let body = `<p style="margin:0 0 6px"><b>${STAGES[st].name}</b>・${cls.name}（総資産 ${fmtYen(totalAssets())}）</p>`;
  if (si.strikes) body += `<p class="callout bad small" style="margin:0 0 6px">格下げ警告を受けています。次の四半期末までに維持基準を回復させてください。</p>`;
  if (si.review) body += `<p class="small" style="margin:0 0 6px">${STAGES[si.review.to].name}への格上げを審査中（${ymLabel(si.review.doneM)}に結論）</p>`;
  else if (st < 2) {
    const req = stageRequirements(st + 1);
    const ok = req.filter(x => x.ok).length;
    body += `<div class="small" style="margin:0 0 4px">${STAGES[st + 1].name}への条件 ${ok}/${req.length}</div>${meter(ok, req.length, 'ok')}`;
  } else if (nextCls) body += `${meter(totalAssets() - cls.min, nextCls.min - cls.min, 'ok')}<p class="note">次は「${nextCls.name}」（総資産${fmtYen(nextCls.min)}）</p>`;
  return `<section class="panel"><div class="ph"><h2>業態</h2><button type="button" class="btn ghost sm" data-act="tab" data-tab="strategy">経営戦略へ</button></div><div class="pb">${body}</div></section>`;
}
SCREENS.dash = () => {
  const items = inboxItems();
  const hs = G.hist.slice(-37).filter(h => h.m >= 0);
  const labels = hs.map(h => ymShort(h.m));
  const trend = hs.length >= 2 ? lineChart({
    labels, height: 220,
    series: [
      { name: '総資産', color: 's1', values: hs.map(h => h.kpi.ta) },
      { name: '預金', color: 's2', values: hs.map(h => h.kpi.dep) },
      { name: '貸出金', color: 's3', values: hs.map(h => h.kpi.loans) },
    ],
  }) : '<div class="empty">月末を締めると推移が表示されます</div>';
  const pls = G.hist.slice(-24).filter(h => h.m >= 0);
  const bars = pls.length ? barChart({ labels: pls.map(h => ymShort(h.m)), values: pls.map(h => plSummary(h.pl).ordinary), name: '経常利益', height: 200 }) : '<div class="empty">月末を締めると月次の損益が表示されます</div>';
  const cs = cityStats();
  const e = G.eco;
  const cls = bankClass();
  const nextCls = BANK_CLASSES.find(k => k.min > totalAssets());
  const ecoRows = [
    ['景気局面', REGIMES[e.regime].name], ['政策金利', fmtRate(e.policy)], ['10年国債利回り', fmtRate(e.y[10])],
    ['当行の短期プライムレート', fmtRate(G.rates.prime)], ['消費者物価（前年比）', fmtPct(e.cpi, 1)], ['完全失業率', fmtPct(e.unemp, 1)],
  ];
  const news = G.news.slice(0, 7);
  return `<h1 class="h1">頭取室</h1>
  <p class="lead">${ymLabel(G.m)}の決裁と、銀行・街の状況です。決裁が済んだら右上の「月末を締めて翌月へ」で1か月進みます。</p>
  <div class="grid g-side">
    <div class="stack">
      <section class="panel"><div class="ph"><h2>決裁箱</h2><span class="aside">${items.length ? items.length + '件' : ''}</span></div>
        ${items.length ? `<ul class="inbox">${items.map(it => `<li><span class="ico ${it.cls || ''}">${it.ico}</span><div><div class="t1">${esc(it.t1)}</div><div class="t2">${esc(it.t2)}</div></div><div class="row">${it.act || ''}</div></li>`).join('')}</ul>` : '<div class="empty">決裁待ちの案件はありません</div>'}
      </section>
      ${panel('資産・預金・貸出金の推移', trend, { aside: '直近3年' })}
      ${panel('月次の経常利益', bars, { aside: '赤は損失（赤字）' })}
    </div>
    <div class="stack">
      <section class="panel"><div class="ph"><h2>${CITY_NAME}の様子</h2><button type="button" class="btn ghost sm" data-act="tab" data-tab="city">詳しく見る</button></div>
        <div class="pb">${cityMap({ compact: true })}
        <hr class="sep">${kv([['人口', `${fmtNum(cs.pop)}人`], ['事業所数', `${fmtNum(cs.firms)}`], ['地域活力', `${fmtNum(cs.vit, 1)}（基準100）`], ['市内預金シェア', fmtPct(cs.share * 100)]])}</div></section>
      ${panel('経済指標', `<table class="t compact"><tbody>${ecoRows.map(([k, v]) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`).join('')}</tbody></table>`, { flush: true })}
      <section class="panel"><div class="ph"><h2>ニュース</h2><button type="button" class="btn ghost sm" data-act="tab" data-tab="news">すべて</button></div>
        <ul class="newslist">${news.map(n => `<li class="${n.tone}"><span class="when">${ymShort(n.m)}</span><span class="what">${esc(n.text)}</span></li>`).join('')}</ul></section>
      ${dashStagePanel(cls, nextCls)}
    </div>
  </div>`;
};

Object.assign(ACTIONS, {
  resched: d => { const it = G.inbox.find(x => x.id === d.id); if (it) { resolveResched(it, d.v === '1'); toast(d.v === '1' ? '返済猶予に応じました（要管理先に区分）' : '返済猶予の申し出を断りました'); } render(); },
  refi: d => { const it = G.inbox.find(x => x.id === d.id); if (it) { resolveRefi(it, d.v === '1'); toast(d.v === '1' ? '期日を1年延長しました' : '一括返済を求めました'); } render(); },
});

/* ---------- 融資審査 ---------- */
const STAFF_NAMES = ['佐伯', '森本', '片山', '杉本', '今村', '藤川', '岸', '水野', '堀', '関', '奥田', '川口'];
function staffName(seed, k) { const r = seeded(seed * 31 + k * 977); return STAFF_NAMES[Math.floor(r() * STAFF_NAMES.length)]; }
function appTitle(a) { return a.kind === 'biz' ? G.companies[a.coId].name : `${a.person.name} 様（住宅ローン）`; }
function invDots(a) {
  const defs = a.kind === 'biz' ? INV_BIZ : INV_MORT;
  return `<span class="dots" aria-label="調査の実施状況">${Object.keys(defs).map(k => `<i class="${a.inv[k] ? (a.inv[k].status === 'ok' ? 'ok' : a.inv[k].status) : ''}"></i>`).join('')}</span>`;
}
function appCard(a) {
  const sub = a.kind === 'biz' ? `${IND[G.companies[a.coId].ind].name}・${areaName(a.district)}${G.companies[a.coId].big ? '・大企業' : ''}` : `${OCC[a.person.occ].name}・${DIST[a.district].name}`;
  const g = G.sys.credit >= 1 ? gradeBadge(appSysGrade(a)) : '';
  const due = a.exp <= G.m ? tag('今月末まで', 'warn') : tag('来月末まで');
  return `<button type="button" class="appcard" data-act="pickApp" data-id="${a.id}" aria-current="${UI.appId === a.id}">
    <div class="nm">${esc(appTitle(a))}</div><div class="meta">${esc(sub)}　${a.kind === 'biz' ? esc(PURPOSES[a.purpose].name) : esc(a.person.ptype)}</div>
    <div class="bottom"><span class="amt">${fmtYen(a.amountReq)}</span><span class="row">${invDots(a)}${g}</span></div>
    <div class="bottom" style="margin-top:4px">${due}${a.existing ? tag('既存取引先', 'brass') : ''}</div></button>`;
}

SCREENS.loans = () => {
  const isBigApp = a => a.kind === 'biz' && !!(G.companies[a.coId] && G.companies[a.coId].big);
  const pend = G.apps.filter(a => a.status === 'pending' && (UI.appFilter === 'all' || (UI.appFilter === 'big' ? isBigApp(a) : a.kind === UI.appFilter && !(UI.appFilter === 'biz' && isBigApp(a) && stageOf() >= 1))))
    .sort((a, b) => (isBigApp(b) - isBigApp(a)) || (a.exp - b.exp));
  const done = G.apps.filter(a => a.status !== 'pending' && a.decidedM === G.m);
  if (!UI.appId || !G.apps.some(a => a.id === UI.appId)) UI.appId = pend[0]?.id || done[0]?.id || null;
  const app = G.apps.find(a => a.id === UI.appId);
  const capL = creditCapLeft(), capT = creditCapacity();
  const list = `<div class="stack">
    <div class="seg" role="group" aria-label="種類で絞り込む">${[['all', 'すべて']].concat(stageOf() >= 1 ? [['big', '大企業']] : [], [['biz', stageOf() >= 1 ? '地元企業' : '事業性'], ['mort', '住宅ローン']]).map(([k, l]) => `<button type="button" data-act="appFilter" data-v="${k}" aria-pressed="${UI.appFilter === k}">${l}</button>`).join('')}</div>
    <div class="panel"><div class="pb"><div class="row between small"><span>審査部の余力</span><b class="num">${fmtNum(capL, 1)} / ${fmtNum(capT, 0)}人日</b></div>${meter(capT - capL, capT)}<p class="note" style="margin:6px 0 0">調査には審査担当の人日を使います。毎月1日に回復します。</p></div></div>
    ${pend.length > 1 && G.sys.credit >= 1 ? btn('審査基準で一括処理', 'bulkOpen', {}, 'sm') : ''}
    <div class="applist">${pend.length ? pend.map(appCard).join('') : '<div class="empty">審査待ちの申込はありません</div>'}</div>
    ${done.length ? `<details><summary class="small muted" style="cursor:pointer">今月処理した案件（${done.length}件）</summary><div class="applist" style="margin-top:8px">${done.map(a => `<button type="button" class="appcard" data-act="pickApp" data-id="${a.id}" aria-current="${UI.appId === a.id}"><div class="nm">${esc(appTitle(a))}</div><div class="bottom"><span class="amt">${fmtYen(a.amountReq)}</span>${tag({ approved: '実行', rejected: '謝絶', declined: '先方辞退', expired: '期限切れ' }[a.status], a.status === 'approved' ? 'ok' : a.status === 'rejected' ? 'bad' : '')}</div></button>`).join('')}</div></details>` : ''}
  </div>`;
  return `<h1 class="h1">融資審査</h1>
  <p class="lead">決算書を読み、必要な調査を指示して、条件を決めて決裁します。粉飾を見抜けないまま融資すると、いずれ大きな損失になります。</p>
  <div class="grid g-list${UI.appOpen && app ? ' detail-open' : ''}">${list}<div>${app ? `<button type="button" class="btn sm mobile-only" data-act="appBack" style="margin-bottom:8px">申込の一覧に戻る</button>${ringi(app)}` : '<div class="panel"><div class="empty">左の一覧から案件を選んでください</div></div>'}</div></div>`;
};

function ringiStampBox(app) {
  if (app.status === 'approved' || app.status === 'declined') return bigSeal('承認');
  if (app.status === 'rejected') return bigSeal('謝絶', true);
  return '';
}
function bigSeal(word, square) {
  const nm = esc(G.bankName.replace(/銀行$/, '').slice(0, 5));
  if (square) return `<svg class="bigseal" viewBox="-30 -30 60 60" aria-label="${word}"><rect x="-22" y="-22" width="44" height="44" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><text x="0" y="-2" text-anchor="middle" font-size="17" fill="currentColor" font-family="var(--f-doc)" font-weight="700">${word[0]}</text><text x="0" y="16" text-anchor="middle" font-size="17" fill="currentColor" font-family="var(--f-doc)" font-weight="700">${word[1]}</text></svg>`;
  return `<svg class="bigseal" viewBox="-30 -30 60 60" aria-label="${word}"><circle r="26" fill="none" stroke="currentColor" stroke-width="2.6"/><line x1="-25" x2="25" y1="-7" y2="-7" stroke="currentColor" stroke-width="1.6"/><line x1="-25" x2="25" y1="9" y2="9" stroke="currentColor" stroke-width="1.6"/><text x="0" y="-12" text-anchor="middle" font-size="8.5" fill="currentColor" font-family="var(--f-doc)" font-weight="700">${nm}</text><text x="0" y="5" text-anchor="middle" font-size="10" fill="currentColor" font-family="var(--f-num)" font-weight="700">${stampDate(G.m)}</text><text x="0" y="21" text-anchor="middle" font-size="9" fill="currentColor" font-family="var(--f-doc)" font-weight="700">${word}</text></svg>`;
}

function ringi(app) {
  const seed = +app.id.slice(1);
  const isBiz = app.kind === 'biz';
  const co = isBiz ? G.companies[app.coId] : null;
  const branch = G.branches.find(b => b.d === app.district && b.openM <= G.m);
  const decided = app.status !== 'pending';
  const head = `<div class="ringi-head"><div>
      <p class="ringi-title">融資稟議書</p>
      <div class="ringi-no">稟議第${G.m + 1}-${seed}号　起案 ${warekiLabel(app.m)}　${branch ? esc(branch.name) : '本店営業部'}</div>
      <div class="ringi-name">${esc(appTitle(app))}</div>
      <div class="row" style="margin-top:6px">${isBiz ? tag(IND[co.ind].name) + tag(areaName(co.district)) + (co.big ? tag(isOvsArea(co.district) ? '海外企業' : '大企業', 'brass') : '') + (app.existing ? tag('既存取引先', 'brass') : tag('新規')) : tag(OCC[app.person.occ].name) + tag(DIST[app.district].name)}${decided ? tag({ approved: '融資実行済み', rejected: '謝絶', declined: '先方辞退', expired: '期限切れ' }[app.status], app.status === 'approved' ? 'ok' : 'bad') : ''}</div>
    </div>
    <div class="stamps" aria-label="決裁欄">
      <div><div class="lab">担当</div><div class="box"><span class="seal-sm">${staffName(seed, 1)}</span></div></div>
      <div><div class="lab">審査役</div><div class="box">${Object.keys(app.inv).length ? `<span class="seal-sm">${staffName(seed, 2)}</span>` : ''}</div></div>
      <div><div class="lab">審査部長</div><div class="box">${Object.keys(app.inv).length >= 2 || app.amountReq < 5e7 ? `<span class="seal-sm">${staffName(seed, 3)}</span>` : ''}</div></div>
      <div><div class="lab">頭取</div><div class="box">${ringiStampBox(app)}</div></div>
    </div></div>`;
  return `<article class="ringi">${head}${isBiz ? ringiBiz(app, co) : ringiMort(app)}</article>`;
}

function ringiBiz(app, co) {
  const L = latestRep(co);
  const found = co.fraud && co.fraud.found;
  const P = PURPOSES[app.purpose];
  const outline = kv([
    ['代表者', esc(co.rep)], ['設立', `${co.founded}年（業歴${ymOf(G.m).y - co.founded}年）`], ['従業員', `${co.emp}人`], ['決算期', `${co.fyEnd}月`],
    ['申込金額', `<b class="num">${fmtYen(app.amountReq)}</b>`], ['資金使途', esc(P.name) + (app.capexItem ? `（${esc(app.capexItem)}）` : '') + (app.purposeRevealed ? ' ' + tag('実態は赤字補填', 'bad') : '')],
    ['希望条件', `${app.termReqM}か月・${app.repayReq === 'bullet' ? '期日一括返済' : '元金均等返済'}・${app.rateTypeReq === 'var' ? '変動金利' : '固定金利'}`],
    app.otherRate ? ['他行の現行金利', fmtRate(app.otherRate)] : null,
    ['担保提供', co.ownsRE ? `本社・工場の不動産（簡易評価 ${fmtYen(reNow(co, co.reEst))}${co.reAppraised ? `、鑑定 ${fmtYen(co.reAppraised)}` : ''}）${co.reLien ? '・他行の先順位あり' : ''}` : 'なし'],
    ['売上高（直近期）', `${fmtYen(L.S)}`], ['当行与信（既存）', exposureOf(co.id) ? fmtYen(exposureOf(co.id)) : 'なし'],
  ]);
  const views = [['pl', '損益計算書'], ['bs', '貸借対照表'], ['cf', 'キャッシュ・フロー'], ['ratio', '財務分析']];
  const fs = `<div class="row between" style="margin-bottom:6px"><div class="subtabs" role="tablist" style="margin:0;border:0">${views.map(([k, l]) => `<button type="button" data-act="appView" data-v="${k}" aria-pressed="${UI.appView === k}">${l}</button>`).join('')}</div>
    ${found ? `<label class="inline small"><input type="checkbox" data-ch="appTrue" ${UI.appShowTrue ? 'checked' : ''}> 実態の数値で表示</label>` : ''}</div>
    ${companyFS(co, UI.appView, found && UI.appShowTrue)}`;
  return `<section><h3>申込の概要</h3>${outline}</section>
  <section><h3>決算書（直近3期）</h3>${found ? `<div class="callout bad" style="margin-bottom:10px"><b>粉飾が判明：</b>${esc(FRAUD_TYPES[co.fraud.type].name)}。提出された決算書は実態と異なります。「実態の数値で表示」で修正後の決算を確認できます。</div>` : ''}${fs}</section>
  <section><h3>調査</h3>${invPanel(app, INV_BIZ, co)}</section>
  <section><h3>行内格付と採算</h3>${gradePanel(app, co)}</section>
  <section><h3>融資条件</h3>${app.status === 'pending' ? termsBiz(app) : decidedTerms(app)}</section>
  ${decideBar(app)}`;
}

function invPanel(app, defs, co) {
  const left = creditCapLeft();
  const cards = Object.entries(defs).map(([k, d]) => {
    if (d.cond && co && !d.cond(co)) return '';
    const r = app.inv[k];
    if (r) {
      const st = { ok: ['問題なし', 'ok'], minor: ['要確認', 'warn'], major: ['重大な問題', 'bad'] }[r.status];
      return `<div class="inv done st-${r.status}"><div class="row between"><span class="nm">${d.name}</span>${tag(st[0], st[1])}</div><div class="res">${esc(r.text)}</div></div>`;
    }
    const can = app.status === 'pending' && left >= d.days - 1e-9;
    return `<div class="inv"><div class="nm">${d.name}</div><div class="ds">${d.desc}</div><div class="row between"><span class="cost">${d.days ? fmtNum(d.days, 1) + '人日' : '外部委託'}${d.cost ? '・' + fmtYen(d.cost) : ''}</span>${app.status === 'pending' ? btn('調査する', 'invest', { id: app.id, k }, 'sm', { disabled: !can, 'data-tip': can ? '' : '審査部の人員に余裕がありません' }) : ''}</div></div>`;
  }).join('');
  return `<div class="inv-grid">${cards}</div>`;
}

function gradePanel(app, co) {
  const lv = G.sys.credit;
  const g = appSysGrade(app);
  let html = '';
  if (lv >= 1) {
    const sc = co ? bankScore(co) : null;
    html += `<div class="row" style="gap:16px;margin-bottom:8px"><div>${gradeBadge(g)} <span class="small">行内格付${co ? `（財務スコア ${fmtNum(sc, 0)}点）` : ''}</span></div><div class="small">想定デフォルト率 <b class="num">${fmtPct(GRADE_PD[g], 2)}</b>/年</div>${co && co.fraud && co.fraud.found ? `<div class="small">実態格付 ${gradeBadge(co.gTrue)}</div>` : ''}</div>`;
  } else html += '<p class="note">審査システムを導入すると、財務スコアと格付が自動で算出されます。</p>';
  if (co && lv >= 2) {
    const fl = fraudFlags(co);
    html += `<div class="flagbox" style="margin-bottom:8px"><b class="small">粉飾検知モジュール</b>${fl.length ? `<ul>${fl.map(f => `<li>${esc(f.t)}</li>`).join('')}</ul>` : '<div class="small muted">目立った異常値はありません</div>'}</div>`;
  }
  if (co && lv >= 3) {
    const ai = aiEstimate(co);
    html += `<div class="row small" style="margin-bottom:8px;gap:16px"><span>AI推定格付 ${gradeBadge(ai.grade)}</span><span>粉飾の可能性 <b class="num ${ai.fp > 0.4 ? 'neg' : ''}">${fmtPct(ai.fp * 100, 0)}</b></span></div>`;
  }
  html += `<div id="ringi-eval">${evalBlock(app)}</div>`;
  return html;
}

/* 採算と成約見込み（入力に合わせて更新） */
function fundCost() {
  const d = deposits();
  return d > 0 ? (B('depOrd') * G.rates.ord + sum(G.dep.coh, c => c.bal * c.rate)) / d : G.rates.ord;
}
function evalBlock(app) {
  const t = app.terms;
  const rate = appRate(app, t);
  const g = appSysGrade(app);
  let lgd;
  if (app.kind === 'biz') {
    const co = G.companies[app.coId];
    const col = t.collateral && co.ownsRE ? (co.reAppraised || reNow(co, co.reEst)) * (co.reLien ? 0.6 : 1) * 0.7 : 0;
    const cov = (t.guarantee === 'cgc' ? 0.8 : 0) * t.amount;
    lgd = clamp(1 - (col + cov) / Math.max(1, t.amount), 0.05, 1) * (t.guarantee === 'personal' ? 0.95 : 1);
  } else {
    const p = app.person;
    lgd = t.guarantee === 'company' ? 0.08 : clamp(1 - p.valueEst * 0.75 / Math.max(1, t.amount), 0.1, 1);
  }
  const pd = GRADE_PD[g] / 100;
  const fc = fundCost() / 100;
  const amt = t.amount;
  const inc = amt * rate / 100, fund = amt * fc, cost = amt * 0.0035, el = amt * pd * lgd;
  const prof = inc - fund - cost - el;
  const p = acceptProb(app, t, 'est');
  const pcls = p >= 0.6 ? 'ok' : p >= 0.35 ? 'warn' : 'bad';
  const mkt = app.kind === 'biz' ? marketLoanRate(G.companies[app.coId].gRep, t.termM) : (t.rateType === 'var' ? G.eco.mortVar : G.eco.mortFix);
  return `<div class="grid g2" style="gap:12px">
    <table class="t compact"><tbody>
      <tr><td>適用金利</td><td class="n"><b>${fmtRate(rate)}</b></td></tr>
      <tr><td>市場の目安金利</td><td class="n">${fmtRate(mkt)}</td></tr>
      <tr><td>年間の利息収入</td><td class="n">${fmtYen(inc)}</td></tr>
      <tr><td>資金調達コスト（${fmtRate(fc * 100)}）</td><td class="n">${MINUS}${fmtYen(fund)}</td></tr>
      <tr><td>経費（0.35%）</td><td class="n">${MINUS}${fmtYen(cost)}</td></tr>
      <tr><td>期待損失（PD ${fmtPct(pd * 100, 2)} × LGD ${fmtPct(lgd * 100, 0)}）</td><td class="n">${MINUS}${fmtYen(el)}</td></tr>
      <tr class="total"><td>想定採算（年）</td><td class="n ${prof < 0 ? 'neg' : ''}">${fmtYen(prof)}</td></tr>
    </tbody></table>
    <div><div class="small" style="margin-bottom:4px">成約見込み</div><div class="accept"><b class="num">${Math.round(p * 100)}%</b>${meter(p * 100, 100, pcls)}<span class="small muted">${pcls === 'ok' ? '受けてもらえそう' : pcls === 'warn' ? '五分五分' : '他行に流れそう'}</span></div>
    <p class="note">金利を上げるほど採算は良くなりますが、優良先ほど他行に流れます。業況の悪い先ほど高い金利でも受け入れる（逆選択）点に注意。</p>
    ${app.kind === 'mort' ? mortDTIBlock(app) : ''}</div></div>`;
}

function termsBiz(app) {
  const t = app.terms, co = G.companies[app.coId];
  const rateField = t.rateType === 'var'
    ? `<label class="field"><span>スプレッド（短プラ${fmtRate(G.rates.prime)}に加算）</span><span class="row"><input type="number" step="0.05" min="-1.5" max="10" value="${t.spread}" data-in="term" data-k="spread" style="width:100px"><span class="unit">%</span></span></label>`
    : `<label class="field"><span>固定金利</span><span class="row"><input type="number" step="0.05" min="0.1" max="15" value="${t.rate}" data-in="term" data-k="rate" style="width:100px"><span class="unit">%</span></span></label>`;
  return `<div class="terms">
    <label class="field"><span>融資額（申込 ${fmtYen(app.amountReq)}）</span><span class="row"><input type="number" step="100" min="100" max="${Math.round(app.amountReq / 1e4)}" value="${Math.round(t.amount / 1e4)}" data-in="term" data-k="amount" style="width:120px"><span class="unit">万円</span></span></label>
    <div class="field"><span>金利の種類</span><div class="seg">${[['var', '変動'], ['fixed', '固定']].map(([k, l]) => `<button type="button" data-act="termSet" data-k="rateType" data-v="${k}" aria-pressed="${t.rateType === k}">${l}</button>`).join('')}</div></div>
    ${rateField}
    <label class="field"><span>期間</span><span class="row"><input type="number" step="${t.repay === 'bullet' ? 1 : 12}" min="3" max="240" value="${t.termM}" data-in="term" data-k="termM" style="width:90px"><span class="unit">か月</span></span></label>
    <div class="field"><span>返済方法</span><div class="seg">${[['equal', '元金均等'], ['bullet', '期日一括']].map(([k, l]) => `<button type="button" data-act="termSet" data-k="repay" data-v="${k}" aria-pressed="${t.repay === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><span>担保</span>${co.ownsRE ? `<label class="inline"><input type="checkbox" data-ch="termChk" data-k="collateral" ${t.collateral ? 'checked' : ''}> 不動産に抵当権を設定</label>` : '<span class="muted small">提供できる不動産なし</span>'}</div>
    <label class="field"><span>保証</span><select data-ch="termSel" data-k="guarantee">${(G.companies[app.coId].big ? [['none', 'なし'], ['personal', '代表者の個人保証（大企業は応じない）']] : [['none', 'なし'], ['personal', '代表者の個人保証'], ['cgc', '信用保証協会（80%保証）']]).map(([k, l]) => `<option value="${k}"${t.guarantee === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
  </div>
  <p class="note">同一先への与信上限（大口信用供与規制）：${fmtYen(largeExposureLimit())}。信用保証協会の保証付き融資はリスクウェイトが10%に下がり、代位弁済で損失を抑えられますが、保証料の負担で先方は嫌がります。</p>`;
}

function decidedTerms(app) {
  const t = app.terms;
  if (app.status === 'expired') return '<p class="muted">回答期限を過ぎたため、申込は取り下げられました。</p>';
  if (app.status === 'rejected') return '<p class="muted">謝絶しました。</p>';
  const L = G.loans.find(x => x.appId === app.id);
  return `${kv([['融資額', fmtYen(t.amount)], ['適用金利', fmtRate(appRate(app, t))], ['期間', `${t.termM}か月`]])}${app.status === 'declined' ? '<p class="callout bad" style="margin-top:8px">先方は他行の条件を選びました。</p>' : ''}${L ? `<p style="margin-top:8px">${btn('融資先として見る', 'loanOpen', { id: L.id }, 'sm')}</p>` : ''}`;
}

function decideBar(app) {
  if (app.status !== 'pending') {
    const nxt = G.apps.find(a => a.status === 'pending' && a.id !== app.id);
    return `<div class="decide">${nxt ? btn('次の案件へ', 'pickApp', { id: nxt.id }, 'primary') : '<span class="muted small">審査待ちの案件はありません</span>'}</div>`;
  }
  return `<div class="decide"><span class="small muted" style="margin-right:auto">${app.exp <= G.m ? '回答期限：今月末' : '回答期限：来月末'}</span>${btn('謝絶する', 'decide', { id: app.id, v: 0 }, 'danger')}${btn('承認する', 'decide', { id: app.id, v: 1 }, 'primary')}</div>`;
}

/* 住宅ローン */
function mortDTIBlock(app) {
  const p = app.person, t = app.terms;
  const rate = appRate(app, t);
  const dti = mortDTI(p, t.amount, rate, t.termM / 12, false);
  const dtiS = mortDTI(p, t.amount, 3.5, t.termM / 12, false);
  const ltv = t.amount / p.valueEst;
  return `<table class="t compact" style="margin-top:8px"><tbody>
    <tr><td>返済負担率（適用金利）</td><td class="n ${dti > 0.35 ? 'neg' : ''}">${fmtPct(dti * 100, 1)}</td></tr>
    <tr><td>返済負担率（審査金利3.5%）</td><td class="n ${dtiS > 0.35 ? 'neg' : ''}">${fmtPct(dtiS * 100, 1)}</td></tr>
    <tr><td>担保掛目（融資額÷評価額）</td><td class="n ${ltv > 1 ? 'neg' : ''}">${fmtPct(ltv * 100, 0)}</td></tr>
    <tr><td>完済時の年齢</td><td class="n ${p.age + t.termM / 12 > 80 ? 'neg' : ''}">${Math.round(p.age + t.termM / 12)}歳</td></tr></tbody></table>
    <p class="note">一般的な目安：審査金利での返済負担率35%以内、完済時80歳未満。</p>`;
}
function ringiMort(app) {
  const p = app.person;
  const t = app.terms;
  const outline = kv([
    ['申込者', `${esc(p.name)}（${p.age}歳・${p.fam}）`], ['職業・勤務先', `${OCC[p.occ].name}／${esc(p.employer)}（勤続${p.yearsEmp}年）`],
    ['年収（申告）', `<b class="num">${fmtYen(p.repIncome)}</b>${p.fraud && p.fraud.found && p.fraud.type === 'income' ? `　実際 ${fmtYen(p.income)}` : ''}`],
    ['他の借入（申告）', p.otherDebt ? `年間返済 ${fmtYen(p.otherDebt)}` : 'なし'],
    ['物件', `${esc(p.ptype)}（${DIST[p.district].name}）価格 ${fmtYen(p.price)}`], ['頭金', p.downR ? fmtPct(p.downR * 100, 0) : 'なし（諸費用も借入）'],
    ['申込金額', `<b class="num">${fmtYen(app.amountReq)}</b>`], ['希望', `${app.termReqM / 12}年・${app.rateTypeReq === 'var' ? '変動金利' : '10年固定'}`],
  ]);
  const terms = app.status === 'pending' ? `<div class="terms">
    <label class="field"><span>融資額</span><span class="row"><input type="number" step="10" min="100" max="${Math.round(app.amountReq / 1e4)}" value="${Math.round(t.amount / 1e4)}" data-in="term" data-k="amount" style="width:110px"><span class="unit">万円</span></span></label>
    <div class="field"><span>金利タイプ</span><div class="seg">${[['var', '変動'], ['fix10', '10年固定']].map(([k, l]) => `<button type="button" data-act="termSet" data-k="rateType" data-v="${k}" aria-pressed="${t.rateType === k}">${l}</button>`).join('')}</div></div>
    <label class="field"><span>店頭金利からの上乗せ（＋）・引下げ（−）</span><span class="row"><input type="number" step="0.05" min="-1" max="3" value="${t.rateAdj || 0}" data-in="term" data-k="rateAdj" style="width:90px"><span class="unit">%</span></span></label>
    <label class="field"><span>期間</span><span class="row"><input type="number" step="1" min="5" max="35" value="${t.termM / 12}" data-in="term" data-k="termY" style="width:80px"><span class="unit">年</span></span></label>
    <div class="field"><span>保証会社</span><label class="inline"><input type="checkbox" data-ch="termChk" data-k="mortGuar" ${t.guarantee === 'company' ? 'checked' : ''}> 保証会社の保証を付ける</label></div>
  </div><p class="note">店頭金利：変動 ${fmtRate(mortVarRate())}（短プラ−${fmtNum(G.rates.mortDisc, 2)}%）、10年固定 ${fmtRate(mortFixRate())}。保証会社が付くと延滞時に代位弁済を受けられます（申込内容に虚偽があれば免責）。</p>` : decidedTerms(app);
  return `<section><h3>申込の概要</h3>${outline}</section>
  <section><h3>調査</h3>${invPanel(app, INV_MORT)}</section>
  <section><h3>審査</h3>${gradePanel(app, null)}</section>
  <section><h3>融資条件</h3>${terms}</section>${decideBar(app)}`;
}

function refreshEval() {
  const app = G.apps.find(a => a.id === UI.appId);
  const box = $('#ringi-eval');
  if (app && box) box.innerHTML = evalBlock(app);
}

Object.assign(ACTIONS, {
  pickApp: d => { UI.appId = d.id; UI.appShowTrue = false; UI.appOpen = true; render(); if (window.innerWidth < 960) window.scrollTo({ top: 0 }); },
  appBack: () => { UI.appOpen = false; render(); },
  pfGap: () => { UI.tab = 'portfolio'; UI.pfFilter = 'gap'; UI.pfPage = 0; render(); window.scrollTo({ top: 0 }); },
  appFilter: d => { UI.appFilter = d.v; UI.appId = null; render(); },
  appView: d => { UI.appView = d.v; render(); },
  invest: d => {
    const app = G.apps.find(a => a.id === d.id);
    const r = runInvestigation(app, d.k);
    if (!r.ok) toast(r.msg, 'bad');
    else if (r.res.found) toast('重大な問題が見つかりました', 'bad');
    if (r.ok && r.res.found && app.kind === 'biz') UI.appShowTrue = true;
    render();
  },
  termSet: d => {
    const app = G.apps.find(a => a.id === UI.appId);
    if (!app) return;
    app.terms[d.k] = d.v;
    if (d.k === 'rateType' && app.kind === 'biz') {
      const r = suggestedRate(app, app.terms.termM);
      if (d.v === 'fixed') app.terms.rate = r; else app.terms.spread = +(r - G.rates.prime).toFixed(2);
    }
    render();
  },
  decide: d => {
    const app = G.apps.find(a => a.id === d.id);
    if (!app) return;
    const res = decideApp(app, d.v === '1', Object.assign({}, app.terms));
    if (!res.ok) { toast(res.msg, 'bad'); return; }
    UI.stampAnim = true;
    if (res.rejected) toast('謝絶しました');
    else if (res.accepted) toast(`融資を実行しました：${fmtYen(app.terms.amount)}`);
    else toast(res.msg, 'bad');
    render();
  },
});
Object.assign(INPUTS, {
  term: el => {
    const app = G.apps.find(a => a.id === UI.appId);
    if (!app) return;
    const v = parseFloat(el.value);
    if (!isFinite(v)) return;
    const k = el.dataset.k;
    if (k === 'amount') app.terms.amount = clamp(Math.round(v) * 1e4, 1e6, app.amountReq);
    else if (k === 'termY') app.terms.termM = clamp(Math.round(v), 5, 35) * 12;
    else if (k === 'termM') app.terms.termM = clamp(Math.round(v), 3, 240);
    else app.terms[k] = v;
    refreshEval();
  },
});
Object.assign(CHANGES, {
  appTrue: el => { UI.appShowTrue = el.checked; render(); },
  termChk: el => {
    const app = G.apps.find(a => a.id === UI.appId);
    if (!app) return;
    if (el.dataset.k === 'mortGuar') app.terms.guarantee = el.checked ? 'company' : 'none';
    else app.terms[el.dataset.k] = el.checked;
    refreshEval();
  },
  termSel: el => { const app = G.apps.find(a => a.id === UI.appId); if (app) { app.terms[el.dataset.k] = el.value; refreshEval(); } },
});

/* ---------- 与信管理 ---------- */
function loanKindLabel(L) {
  if (L.kind === 'seg') return isOvsArea(L.area) ? '海外拠点の小口融資' : '全国の店舗網の小口融資';
  if (L.kind === 'biz' && G.companies[L.coId] && G.companies[L.coId].big) return isOvsArea(L.district) ? '海外企業' : '大企業';
  return { biz: '事業性', mort: '住宅ローン', proj: 'プロジェクト', pool: '住宅ローン（承継）' }[L.kind];
}
function loanStatusTag(L) {
  const m = { current: ['正常返済', ''], late: [`延滞${L.dpd}か月`, 'warn'], default: [`延滞${L.dpd}か月`, 'bad'], bankrupt: ['破綻・回収中', 'bad'] }[L.status] || ['完了', ''];
  return tag(m[0], m[1]) + (L.restructured ? tag('条件変更', 'warn') : '') + (L.fraudKnown ? tag('粉飾判明', 'bad') : '');
}
function pfLoans() {
  const act = G.loans.filter(isActiveLoan);
  switch (UI.pfFilter) {
    case 'biz': return act.filter(L => L.kind === 'biz' || L.kind === 'proj');
    case 'mort': return act.filter(L => L.kind === 'mort' || L.kind === 'pool');
    case 'watch': return act.filter(L => L.cls >= 1 || L.status !== 'current' || sysClass(L) > L.cls);
    case 'gap': return act.filter(L => sysClass(L) > L.cls);
    case 'net': return act.filter(L => L.kind === 'seg' || (L.kind === 'biz' && G.companies[L.coId] && G.companies[L.coId].big));
    default: return act;
  }
}
SCREENS.portfolio = () => {
  const act = G.loans.filter(isActiveLoan);
  const tot = sum(act, L => L.bal);
  const npl = nplBreakdown();
  const byCls = [0, 1, 2, 3, 4, 5].map(c => sum(act.filter(L => L.cls === c), L => L.bal));
  const yieldAvg = tot ? sum(act, L => L.bal * L.rate) / tot : 0;
  const colors = ['s1', 's2', 's3', 'shu', 'shu', 'ink'];
  const summary = `<div class="grid g3" style="margin-bottom:12px">
    <div>${kv([['貸出金残高', `<b>${fmtYen(tot)}</b>`], ['融資先数', `${act.length}件`], ['平均利回り', fmtRate(yieldAvg)]])}</div>
    <div>${kv([['貸倒引当金', fmtYen(B('allowance'))], ['不良債権比率', `<b class="${npl.ratio > 5 ? 'neg' : ''}">${fmtPct(npl.ratio)}</b>`], ['区分ずれ（判定より甘い）', `${act.filter(L => sysClass(L) > L.cls).length}件`]])}</div>
    <div>${kv([['預貸率', fmtPct(B('loans') / Math.max(1, deposits()) * 100, 1)], ['事業性融資', fmtYen(sum(act.filter(L => L.kind === 'biz' || L.kind === 'proj'), L => L.bal))], ['住宅ローン', fmtYen(sum(act.filter(L => L.kind === 'mort' || L.kind === 'pool'), L => L.bal))],
      act.some(L => L.kind === 'seg') ? ['全国・海外の小口融資', fmtYen(sum(act.filter(L => L.kind === 'seg'), L => L.bal))] : null])}</div></div>
    <div class="small" style="margin-bottom:4px">債務者区分ごとの残高</div>${segBar(CLS.map((c, i) => ({ name: c.name, v: byCls[i], color: colors[i] })))}`;
  const reviews = G.inbox.filter(x => x.type === 'review');
  const queue = reviews.length ? `<div class="row" style="padding:8px 10px;justify-content:space-between"><span class="small muted">変化のあった先と大口先だけが回ってきます。それ以外は担当者が確認済みです。</span>${btn('すべて判定どおり確定', 'reviewAll', {}, 'sm')}</div><table class="t"><thead><tr><th>融資先</th><th>理由</th><th>受領</th><th class="n">残高</th><th>格付</th><th>現区分</th><th>システム判定</th><th></th></tr></thead><tbody>${reviews.map(it => {
    const co = G.companies[it.coId];
    const loans = G.loans.filter(L => L.coId === it.coId && isActiveLoan(L));
    if (!co || !loans.length) return '';
    const L0 = loans[0];
    return `<tr><td>${esc(co.name)}</td><td>${tag(it.why || '定期', it.why && it.why !== '大口先' ? 'warn' : '')}</td><td>${ymShort(it.m)}</td><td class="n">${fmtYen(sum(loans, L => L.bal))}</td><td>${gradeBadge(bankGrade(co))}</td><td>${clsTag(L0.cls)}</td><td>${clsTag(sysClass(L0))}</td><td class="n">${btn('決算書を見る', 'loanOpen', { id: L0.id }, 'sm')} ${btn('判定どおり確定', 'reviewOk', { id: it.id }, 'sm')}</td></tr>`;
  }).join('')}</tbody></table>` : '<div class="empty">検証待ちの決算書はありません</div>';
  const list = pfLoans().sort((a, b) => b.bal - a.bal);
  const per = 25, pages = Math.max(1, Math.ceil(list.length / per));
  UI.pfPage = clamp(UI.pfPage, 0, pages - 1);
  const rows = list.slice(UI.pfPage * per, UI.pfPage * per + per).map(L => {
    const sc = sysClass(L);
    return `<tr class="click" data-act="loanOpen" data-id="${L.id}"><td><div>${esc(L.name)}</div><div class="small muted">${loanKindLabel(L)}${L.ind && IND[L.ind] ? '・' + IND[L.ind].name : ''}</div></td>
      <td class="n">${fmtYen(L.bal)}</td><td class="n">${fmtRate(L.rate)}</td><td class="nowrap">${L.kind === 'pool' || L.kind === 'seg' ? '―' : ymShort(L.endM)}</td><td>${loanStatusTag(L)}</td>
      <td>${clsTag(L.cls)}</td><td>${sc > L.cls ? tag(CLS[sc].short + 'へ', 'bad') : '<span class="muted small">一致</span>'}</td><td class="n">${fmtYen(L.provision || 0)}</td></tr>`;
  }).join('');
  const table = `<div class="row between" style="margin-bottom:8px"><div class="seg">${[['all', 'すべて'], ['biz', '事業性'], ['mort', '住宅ローン'], ['watch', '要注意以下・延滞'], ['gap', '区分ずれ']].concat(stageOf() >= 1 ? [['net', '全国・海外']] : []).map(([k, l]) => `<button type="button" data-act="pfFilter" data-v="${k}" aria-pressed="${UI.pfFilter === k}">${l}</button>`).join('')}</div>
    <div class="row">${act.some(L => sysClass(L) > L.cls) ? btn('区分ずれを一括修正', 'clsFixAll', {}, 'sm') : ''}</div></div>
    <div class="tbl-wrap"><table class="t"><thead><tr><th>融資先</th><th class="n">残高</th><th class="n">金利</th><th>期日</th><th>状態</th><th>債務者区分</th><th>システム判定</th><th class="n">引当金</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="empty">該当なし</td></tr>'}</tbody></table></div>
    ${pages > 1 ? `<div class="row" style="justify-content:center;margin-top:8px">${btn('前へ', 'pfPage', { v: UI.pfPage - 1 }, 'sm', { disabled: UI.pfPage === 0 })}<span class="small">${UI.pfPage + 1} / ${pages}</span>${btn('次へ', 'pfPage', { v: UI.pfPage + 1 }, 'sm', { disabled: UI.pfPage >= pages - 1 })}</div>` : ''}`;
  const byInd = {};
  for (const L of act) { const k = L.kind === 'biz' ? IND[L.ind].name : L.kind === 'proj' ? 'プロジェクト' : L.kind === 'seg' ? (L.seg === 'retail' ? '個人向けローン（全国・海外）' : '中小企業・現地法人（全国・海外）') : '住宅ローン'; byInd[k] = (byInd[k] || 0) + L.bal; }
  const indRows = Object.entries(byInd).sort((a, b) => b[1] - a[1]);
  const maxV = indRows.length ? indRows[0][1] : 1;
  const conc = indRows.map(([k, v]) => `<tr><td>${k}</td><td style="width:50%">${meter(v, maxV, 'ok')}</td><td class="n">${fmtYen(v)}</td><td class="n">${fmtPct(v / tot * 100, 1)}</td></tr>`).join('');
  return `<h1 class="h1">与信管理・自己査定</h1>
  <p class="lead">融資先の決算書を毎年検証し、債務者区分を決めて貸倒引当金を積みます。区分を甘くすれば利益は出ますが、金融庁検査や監査で指摘されると一度に追加引当を迫られます。</p>
  <div class="stack">
    ${panel('貸出ポートフォリオ', summary)}
    ${panel(`決算書の検証待ち（${reviews.length}先）`, queue, { flush: true })}
    ${panel('融資先一覧', table)}
    ${panel('業種別の構成', `<table class="t compact"><tbody>${conc}</tbody></table>`, { flush: true })}
  </div>`;
};
Object.assign(ACTIONS, {
  pfFilter: d => { UI.pfFilter = d.v; UI.pfPage = 0; render(); },
  pfPage: d => { UI.pfPage = +d.v; render(); },
  reviewOk: d => {
    const it = G.inbox.find(x => x.id === d.id);
    if (!it) return;
    for (const L of G.loans) if (L.coId === it.coId && isActiveLoan(L)) L.cls = Math.max(L.cls, sysClass(L));
    G.inbox = G.inbox.filter(x => x !== it);
    trueUpProvisionsSilent();
    render();
  },
  reviewAll: () => {
    const its = G.inbox.filter(x => x.type === 'review');
    for (const it of its) for (const L of G.loans) if (L.coId === it.coId && isActiveLoan(L)) L.cls = Math.max(L.cls, sysClass(L));
    G.inbox = G.inbox.filter(x => x.type !== 'review');
    trueUpProvisionsSilent();
    toast(`${its.length}先の決算書を検証済みにしました`);
    render();
  },
  clsFixAll: () => {
    let n = 0;
    for (const L of G.loans) if (isActiveLoan(L) && sysClass(L) > L.cls) { L.cls = sysClass(L); n++; }
    trueUpProvisionsSilent();
    toast(`${n}件の債務者区分をシステム判定に合わせました`);
    render();
  },
  loanOpen: d => showModal('loan', { id: d.id, view: 'pl', showTrue: false }),
  loanView: d => { UI.modal.args.view = d.v; drawModal(); },
  monInvest: d => {
    const L = G.loans.find(x => x.id === UI.modal.args.id);
    const co = G.companies[L.coId];
    const r = runInvestigation(co, d.k, true);
    if (!r.ok) toast(r.msg, 'bad');
    else if (r.res.found) { toast('粉飾が判明しました', 'bad'); UI.modal.args.showTrue = true; }
    drawModal();
  },
  reviewDone: d => {
    const it = G.inbox.find(x => x.type === 'review' && x.coId === d.co);
    if (it) G.inbox = G.inbox.filter(x => x !== it);
    toast('決算書の検証を完了しました');
    drawModal();
  },
  callLoanAsk: d => confirmBox('回収に着手する', '期限の利益を喪失させ、担保の処分と保証の履行で回収を始めます。融資先は事実上の破綻となり、地域経済にも影響します。よろしいですか？', '回収に着手する', 'callLoanGo', { id: d.id }, true),
  callLoanGo: d => { const L = G.loans.find(x => x.id === d.id); const r = callLoan(L); toast(r.ok ? '回収手続きに入りました' : r.msg, r.ok ? '' : 'bad'); trueUpProvisionsSilent(); closeModal(true); },
  sellAsk: d => { const L = G.loans.find(x => x.id === d.id); confirmBox('サービサーへ売却', `この債権（残高${fmtYen(L.bal)}）を${fmtYen(servicerPrice(L))}で債権回収会社に売却します。差額は売却損として処理します。`, '売却する', 'sellGo', { id: d.id }, true); },
  sellGo: d => { const L = G.loans.find(x => x.id === d.id); const r = sellToServicer(L); toast(r.ok ? `売却しました（売却損 ${fmtYen(r.loss)}）` : r.msg, r.ok ? '' : 'bad'); trueUpProvisionsSilent(); closeModal(true); },
});
Object.assign(CHANGES, {
  loanCls: el => {
    const L = G.loans.find(x => x.id === el.dataset.id);
    if (!L) return;
    const v = +el.value;
    if (L.status === 'bankrupt' && v < 5) { toast('法的整理に入った先は破綻先です', 'bad'); drawModal(); return; }
    L.cls = v;
    trueUpProvisionsSilent();
    if (UI.modal) drawModal(); else render();
  },
  loanTrue: el => { UI.modal.args.showTrue = el.checked; drawModal(); },
});
/* 区分変更をすぐ引当に反映（仕訳を計上） */
function trueUpProvisionsSilent() { trueUpProvisions('債務者区分の見直しに伴う引当金の調整'); }

MODALS.loan = a => {
  const L = G.loans.find(x => x.id === a.id);
  if (!L) return modalFrame('融資先', '<p>見つかりません</p>', btn('閉じる', 'closeModal', { force: 1 }));
  const active = isActiveLoan(L);
  const sc = active ? sysClass(L) : null;
  const colNow = collateralBank(L);
  const rows = [
    ['種類', loanKindLabel(L)], ['状態', loanStatusTag(L)], ['当初融資額', fmtYen(L.principal)], ['残高', `<b>${fmtYen(L.bal)}</b>`],
    ['金利', `${fmtRate(L.rate)}（${L.kind === 'pool' || L.kind === 'seg' ? '変動' : L.rateType === 'var' ? '変動' : L.rateType === 'fix10' ? '10年固定' : '固定'}）`],
    ['実行', L.kind === 'seg' ? '毎月少しずつ実行' : L.startM < 0 ? `${OLD_UNION}から承継` : ymLabel(L.startM)], ['期日', L.kind === 'pool' || L.kind === 'seg' ? '―' : ymLabel(L.endM)],
    ['担保', L.collateral ? `不動産（現在の評価 ${fmtYen(colNow)}）` : 'なし'],
    ['保証', L.cgc ? '信用保証協会（80%）' : L.mortGuar ? '保証会社' + (L.guarVoid ? '（免責）' : '') : L.personal ? '代表者保証' : 'なし'],
    ['受取利息（累計）', fmtYen(L.paidInt || 0)], ['貸倒引当金', fmtYen(L.provision || 0)],
  ];
  let body = `<div class="grid g2"><div>${kv(rows)}</div><div>`;
  if (active && L.kind !== 'pool' && L.kind !== 'seg') {
    body += `<div class="field" style="margin-bottom:10px"><span>債務者区分（自己査定）</span><select data-ch="loanCls" data-id="${L.id}">${CLS.map((c, i) => `<option value="${i}"${L.cls === i ? ' selected' : ''}>${c.name}（引当 ${fmtYen(provisionFor(L, i))}）</option>`).join('')}</select></div>
      <p class="small">システム判定：${clsTag(sc)} ${sc > L.cls ? '<span class="neg small">現在の区分は甘い可能性があります</span>' : ''}</p>`;
    const acts = [];
    if (L.status !== 'bankrupt') acts.push(btn('回収に着手（期限の利益喪失）', 'callLoanAsk', { id: L.id }, 'sm danger'));
    if (L.cls >= 3 || L.status === 'bankrupt' || L.status === 'default') acts.push(btn(`サービサーへ売却（${fmtYen(servicerPrice(L))}）`, 'sellAsk', { id: L.id }, 'sm danger'));
    body += `<div class="row" style="margin-top:8px">${acts.join('')}</div>`;
  }
  body += '</div></div>';
  if (L.kind === 'biz') {
    const co = G.companies[L.coId];
    const found = co.fraud && co.fraud.found;
    const views = [['pl', '損益計算書'], ['bs', '貸借対照表'], ['cf', 'キャッシュ・フロー'], ['ratio', '財務分析']];
    const n = Math.min(5, co.years.length - 1);
    const rev = G.inbox.find(x => x.type === 'review' && x.coId === co.id);
    body += `<hr class="sep"><div class="row between"><h3 style="margin:0;font-size:15px">${esc(co.name)}　${tag(IND[co.ind].name)} 格付 ${gradeBadge(bankGrade(co))}${found ? ` 実態 ${gradeBadge(co.gTrue)}` : ''}</h3>${rev ? btn('決算書の検証を完了', 'reviewDone', { co: co.id }, 'sm primary') : ''}</div>
      ${found ? `<div class="callout bad" style="margin:8px 0">粉飾が判明しています（${esc(FRAUD_TYPES[co.fraud.type].name)}）。</div>` : ''}
      ${G.sys.credit >= 2 && fraudFlags(co).length ? `<div class="flagbox" style="margin:8px 0"><b class="small">粉飾検知モジュール</b><ul>${fraudFlags(co).map(f => `<li>${esc(f.t)}</li>`).join('')}</ul></div>` : ''}
      <div class="row between" style="margin:8px 0"><div class="subtabs" style="margin:0;border:0">${views.map(([k, l]) => `<button type="button" data-act="loanView" data-v="${k}" aria-pressed="${a.view === k}">${l}</button>`).join('')}</div>${found ? `<label class="inline small"><input type="checkbox" data-ch="loanTrue" ${a.showTrue ? 'checked' : ''}> 実態の数値で表示</label>` : ''}</div>
      ${companyFS(co, a.view, found && a.showTrue, n)}
      <h3 style="font-size:15px;margin:14px 0 8px">期中モニタリング（調査）</h3>
      <p class="note">審査部の余力 ${fmtNum(creditCapLeft(), 1)}人日。新しい決算書が届くと調査結果はリセットされます。</p>
      ${monitorPanel(co)}`;
  } else if (L.kind === 'mort') {
    const p = L.person;
    body += `<hr class="sep">${kv([['債務者', `${esc(p.name)}（${p.age}歳）`], ['職業', `${OCC[p.occ].name}／${esc(p.employer)}`], ['年収（申告）', fmtYen(p.repIncome)], ['物件', `${esc(p.ptype)}・${DIST[p.district].name}`], ['返済負担率（現在）', fmtPct(mortDTI(p, L.bal, L.rate, Math.max(1, (L.endM - G.m) / 12), false) * 100, 1)]])}`;
  } else if (L.kind === 'seg') {
    body += `<hr class="sep">${kv([['地域', esc(areaName(L.area))], ['種類', esc(segName(L.area, L.seg))], ['年間の延滞・倒産率', fmtPct(L.pd, 2)], ['損失率（担保・保証で回収できない割合）', fmtPct(segLGD(L) * 100, 0)], ['不良債権', fmtYen(L.npl || 0)], ['今年度の償却', fmtYen(L.lossYTD || 0)]])}
      <p class="note">多数の小口融資をまとめた勘定です。量と質は経営戦略の「融資方針」で調整します。</p>`;
  } else if (L.kind === 'proj') {
    const P = PROJ[L.projId];
    const st = G.city.projects[L.projId];
    body += `<hr class="sep">${kv([['プロジェクト', esc(P.name)], ['地区', DIST[P.d].name], ['状況', st.status === 'done' ? '完成・運営中' : st.status === 'building' ? `建設中（${ymLabel(st.doneM)}完成予定）` : '中断'], ['総事業費', fmtYen(P.cost)]])}`;
  }
  return modalFrame(esc(L.name), body, btn('閉じる', 'closeModal'), { size: 'wide', sub: L.id });
};

function monitorPanel(co) {
  const cards = Object.entries(INV_BIZ).filter(([k]) => k !== 'appraisal').map(([k, d]) => {
    const r = co.mon[k];
    if (r) {
      const st = { ok: ['問題なし', 'ok'], minor: ['要確認', 'warn'], major: ['重大な問題', 'bad'] }[r.status];
      return `<div class="inv done st-${r.status}"><div class="row between"><span class="nm">${d.name}</span>${tag(st[0], st[1])}</div><div class="res">${esc(r.text)}</div></div>`;
    }
    const can = creditCapLeft() >= d.days - 1e-9;
    return `<div class="inv"><div class="nm">${d.name}</div><div class="row between"><span class="cost">${fmtNum(d.days, 1)}人日${d.cost ? '・' + fmtYen(d.cost) : ''}</span>${btn('調査する', 'monInvest', { k }, 'sm', { disabled: !can })}</div></div>`;
  }).join('');
  return `<div class="inv-grid">${cards}</div>`;
}

/* ---------- 審査基準による一括処理（判定は 06_loans.js の judgeByCriteria） ---------- */
UI.bulk = { kind: 'mort', ok: 4, ng: 8, deficit: true };
const bulkJudge = a => judgeByCriteria(a, UI.bulk);
MODALS.bulk = () => {
  const b = UI.bulk;
  const pend = G.apps.filter(a => a.status === 'pending' && (b.kind === 'all' || a.kind === b.kind));
  const cnt = { ok: 0, ng: 0, hold: 0 };
  for (const a of pend) cnt[bulkJudge(a)]++;
  const opt = (sel, from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map(g => `<option value="${g}"${g === sel ? ' selected' : ''}>格付${g}</option>`).join('');
  const body = `<p class="small" style="margin-top:0">審査基準（決裁権限の委譲）を決めて、審査待ちの申込をまとめて処理します。承認する案件は標準条件（市場の目安金利、不動産があれば担保を徴求、格付6以下は信用保証協会付き）で回答します。</p>
    <div class="field" style="margin-bottom:10px"><span>対象</span><div class="seg">${[['mort', '住宅ローン'], ['biz', '事業性'], ['all', 'すべて']].map(([k, l]) => `<button type="button" data-act="bulkSet" data-k="kind" data-v="${k}" aria-pressed="${b.kind === k}">${l}</button>`).join('')}</div></div>
    <div class="row" style="gap:16px;align-items:end"><label class="field"><span>承認する：行内格付が</span><select data-ch="bulkSel" data-k="ok">${opt(b.ok, 1, 9)}</select></label><span class="small" style="padding-bottom:6px">以内</span>
    <label class="field"><span>謝絶する：行内格付が</span><select data-ch="bulkSel" data-k="ng">${opt(b.ng, 2, 10)}</select></label><span class="small" style="padding-bottom:6px">以下</span></div>
    <label class="inline small" style="margin-top:10px"><input type="checkbox" data-ch="bulkChk" data-k="deficit" ${b.deficit ? 'checked' : ''}> 赤字補填が目的の申込は謝絶する（粉飾が判明した申込は常に謝絶）</label>
    <table class="t compact" style="margin-top:12px;max-width:360px"><tbody><tr><td>承認して回答</td><td class="n">${cnt.ok}件</td></tr><tr><td>謝絶</td><td class="n">${cnt.ng}件</td></tr><tr><td>保留（個別に審査）</td><td class="n">${cnt.hold}件</td></tr></tbody></table>
    <p class="callout" style="margin-top:12px">調査をせずに処理すると、粉飾は見抜けません。行内格付は提出された決算書から算出しています。</p>`;
  return modalFrame('審査基準で一括処理', body, btn('戻る', 'closeModal') + btn('実行する', 'bulkRun', {}, 'primary', { disabled: !(cnt.ok + cnt.ng) }), { size: 'narrow' });
};
Object.assign(ACTIONS, {
  bulkOpen: () => showModal('bulk'),
  bulkSet: d => { UI.bulk[d.k] = d.v; drawModal(); },
  bulkRun: () => {
    const b = UI.bulk;
    const pend = G.apps.filter(a => a.status === 'pending' && (b.kind === 'all' || a.kind === b.kind));
    let acc = 0, dec = 0, rej = 0, skip = 0, amt = 0;
    for (const a of pend) {
      const j = bulkJudge(a);
      if (j === 'ng') { decideApp(a, false); rej++; }
      else if (j === 'ok') {
        const t = standardTerms(a);
        if (t.amount < 1e6 || validateTerms(a, t)) { skip++; continue; }
        const r = decideApp(a, true, t);
        if (r.ok && r.accepted) { acc++; amt += t.amount; } else if (r.ok) dec++; else skip++;
      }
    }
    toast(`成約${acc}件（${fmtYen(amt)}）・先方辞退${dec}件・謝絶${rej}件${skip ? `・処理できず${skip}件` : ''}`);
    UI.appId = null;
    closeModal(true);
  },
});
Object.assign(CHANGES, {
  bulkSel: el => { UI.bulk[el.dataset.k] = +el.value; drawModal(); },
  bulkChk: el => { UI.bulk[el.dataset.k] = el.checked; drawModal(); },
});
