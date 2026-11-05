'use strict';
/* =========================================================
 *  24_kaisha_ops.js : 会社経営モードの「現場」
 *   事業ごとの経営の判断（値段・人員・広告・在庫・設備・見積・取引先・利用者・施設・車両）、
 *   設備投資の計画（銀行への相談つき）、設備のカタログからの購入、新しい事業の立ち上げと撤退
 * ========================================================= */

const KS_OPS = {};
Object.assign(UI, { kUnit: null, kNU: null, kEqBuy: null });
function ksCurUnit() {
  let u = UI.kUnit && ksUnit(UI.kUnit);
  if (!u || u.closedM) { u = ksMainUnit(); UI.kUnit = u ? u.id : null; }
  return u;
}
function ksKpiU(u) { const x = G.months[G.months.length - 1]; return (x && x.kpiU && x.kpiU[u.id]) || u.kpi || {}; }
function ksUFlowLast(u) { const x = G.months[G.months.length - 1]; return (x && x.flowU && x.flowU[u.id]) || {}; }
const KS_FMT = {
  pct: v => fmtPct(v * 100, 1),
  lv: v => fmtPct(v * 100, 0),
  yen: v => fmtYen(v),
  days: v => `${fmtNum(v, 0)}日`,
  yenh: v => `${fmtNum(v, 0)}円`,
  int: v => fmtNum(v, 0),
};
/* 金額のつまみの刻み */
function ksNiceStep(range) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, range / 40)))); const r = range / 40 / p; return (r < 2 ? 1 : r < 5 ? 2 : 5) * p; }
/* つまみ（範囲の入力） */
function ksCtl(p, u) {
  const v = u.op[p.k];
  return `<label class="ctl"><span class="ctl-l">${p.tk ? term(esc(p.label), p.tk) : esc(p.label)}</span>
    <span class="ctl-in"><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" data-ch="kOp" data-in="kOpLive" data-u="${u.id}" data-k="${p.k}" data-f="${p.f}" aria-label="${esc(p.label)}"><output class="num">${KS_FMT[p.f](v)}</output></span>
    <span class="small muted">${p.help}</span></label>`;
}
function ksParamsPanel(u, title, params, extra = '') { return panel(title, `<div class="ctls">${params.map(p => ksCtl(p, u)).join('')}</div>${extra}`); }
CHANGES.kOp = el => {
  const u = ksUnit(el.dataset.u);
  if (!u) return;
  const p = KS_OPS[ksS(u).eng].params(u).find(x => x.k === el.dataset.k);
  if (!p) return;
  const v = clamp(parseFloat(el.value), p.min, p.max);
  if (!isFinite(v)) return;
  u.op[p.k] = p.step >= 1 ? Math.round(v) : +v.toFixed(4);
  if (p.after) p.after(u);
  render();
};
INPUTS.kOpLive = el => { const o = el.parentElement.querySelector('output'); if (o) o.textContent = KS_FMT[el.dataset.f](parseFloat(el.value)); };
Object.assign(ACTIONS, {
  kOpToggle: d => { const u = ksUnit(d.u); if (u) { u.op[d.k] = !u.op[d.k]; render(); } },
  kOpSet: d => { const u = ksUnit(d.u); if (u) { u.op[d.k] = isFinite(+d.v) && d.v !== '' && typeof d.v !== 'boolean' && /^-?[0-9.]+$/.test(d.v) ? +d.v : d.v; render(); } },
  kUnitSel: d => { UI.kUnit = d.u; render(); window.scrollTo({ top: 0 }); },
});

/* ---------- 人員 ---------- */
function ksStaffPanel(u, need = {}, opt = {}) {
  const S = ksS(u);
  const rows = S.roles.map(r => {
    const n = u.staff[r.id] || 0;
    const nd = need[r.id];
    const short = nd !== undefined && n < Math.round(nd) - 0.01;
    const big = (nd || n) >= 30;
    return `<tr><td><b>${esc(r.n)}</b><div class="small muted">${esc(r.desc)}</div></td>
      <td class="n"><b class="${short ? 'neg' : ''}">${fmtNum(n, 0)}人</b>${nd !== undefined ? `<div class="small muted">目安 ${fmtNum(nd, 0)}人</div>` : ''}</td>
      <td class="n">${fmtYen(ksRoleWage(r, u))}<div class="small muted">${r.cost === 'labor' ? '労務費（原価）' : '給料手当（販管費）'}</div></td>
      <td class="n nowrap">${big ? btn('−10', 'kHire', { u: u.id, r: r.id, n: -10 }, 'sm', { disabled: n < 10 }) : ''}${btn('−1', 'kHire', { u: u.id, r: r.id, n: -1 }, 'sm', { disabled: n < 1 })}${btn('+1', 'kHire', { u: u.id, r: r.id, n: 1 }, 'sm')}${big ? btn('+10', 'kHire', { u: u.id, r: r.id, n: 10 }, 'sm') : ''}${nd !== undefined && Math.round(nd) !== n ? btn('目安に', 'kHireTo', { u: u.id, r: r.id, n: Math.round(nd) }, 'sm ghost') : ''}</td></tr>`;
  }).join('');
  const pe = ksPayrollEstimate(u);
  return panel('人員', `<div class="tbl-wrap"><table class="t"><thead><tr><th>職種</th><th class="n">人数</th><th class="n">月給（1人）</th><th class="n">採用・退職</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">この事業の人件費の目安は月${fmtYen(pe.labor + pe.salary)}（賞与・社会保険料を含む平均）。採用には求人・紹介の費用（${S.roles.map(r => `${r.n.replace(/（.*?）/, '')} ${fmtYen(ksHireCostOf(r))}`).join('・')}）がかかり、人を減らすと退職金として給与1か月分がかかります。${opt.note || ''}</p>`);
}
function ksHireDo(u, r, n) {
  const cur = u.staff[r.id] || 0;
  G.curU = u.id;
  if (n > 0) {
    const cost = ksHireCostOf(r) * n;
    ksPayCash('recruit', cost, 'recruit');
    ksHire(u, r.id, n);
    if (r.id === 'eng' && u.op.hires) for (let i = 0; i < n; i++) u.op.hires.push(G.m);
    G.curU = null;
    return `${r.n.replace(/（.*?）/, '')}を${n}人採用しました（採用費 ${fmtYen(cost)}）`;
  }
  const k = Math.min(cur, -n);
  if (k <= 0) { G.curU = null; return ''; }
  const sev = Math.round(ksRoleWage(r, u) * k);
  ksPayCash(r.cost === 'labor' ? 'labor' : 'salary', sev, 'retire', 'payroll');
  ksHire(u, r.id, -k);
  G.curU = null;
  return `${r.n.replace(/（.*?）/, '')}が${k}人退職しました（退職金 ${fmtYen(sev)}）`;
}
Object.assign(ACTIONS, {
  kHire: d => { const u = ksUnit(d.u); const r = u && ksS(u).roles.find(x => x.id === d.r); if (!r || !+d.n) return; const t = ksHireDo(u, r, +d.n); if (t) toast(t); render(); },
  kHireTo: d => { const u = ksUnit(d.u); const r = u && ksS(u).roles.find(x => x.id === d.r); if (!r) return; const t = ksHireDo(u, r, +d.n - (u.staff[r.id] || 0)); if (t) toast(t); render(); },
});

/* ---------- 設備投資の計画（銀行への相談つき） ---------- */
/* o: { title, desc, items:[{n, acct, cost, life, part, cap, eq, u, openM}], deposit, fx: 効果のキー, arg, pre: 先に実行するキー, preArg } */
function ksCapexOpen(o) {
  const total = sum(o.items, x => x.cost) + (o.deposit || 0);
  UI.kCapex = Object.assign({ fin: ksB('cash') >= total * 1.3 ? 'cash' : 'loan', bank: 'mirai', termM: 84, amt: Math.ceil(total / 1e6) * 1e6, cgc: false, res: null }, o, { total });
  showModal('kCapex');
}
const KS_CAPEX_PRE = {};
const KS_CAPEX_FX = {
  eqBuy: a => { const u = ksUnit(a.u); return a.open ? `${ymLabel(a.open)}に完成・納入の予定です（それまでは建設仮勘定）` : `${u ? ksUName(u) : ''}で使い始めました`; },
  shopStore: a => { const u = ksUnit(a.u); u.op.stores.push(Object.assign({}, a.s)); return `${a.s.n}は${ymLabel(a.s.openM)}に開店します（家賃は開店の前の月から）`; },
  shopRenov: a => { const u = ksUnit(a.u); const s = u.op.stores.find(x => x.n === a.s); if (s) s.renovM = G.m; return `${a.s}を改装しました`; },
  shopEq: a => { const u = ksUnit(a.u); const s = u.op.stores.find(x => x.n === a.s); if (s) s.eqM = G.m; return `${a.s}の設備を入れ替えました`; },
  restShop: a => { const u = ksUnit(a.u); u.op.shops.push(Object.assign({}, a.s)); return `${a.s.n}は${ymLabel(a.s.openM)}に開店します`; },
  restRenov: a => { const u = ksUnit(a.u); const s = u.op.shops.find(x => x.n === a.s); if (s) s.renovM = G.m; return `${a.s}を改装しました`; },
  restKitchen: a => { const u = ksUnit(a.u); const s = u.op.shops.find(x => x.n === a.s); if (s) s.kitM = G.m; return `${a.s}の厨房機器を入れ替えました`; },
  unitStart: a => `${ksUName(ksUnit(a.u))}を始めました。人員を採用して、事業を育てましょう`,
  truck: () => '配送トラックを増やしました',
};
MODALS.kCapex = () => {
  const c = UI.kCapex;
  if (!c) return modalFrame('設備投資', '', btn('閉じる', 'closeModal'));
  const B = KS_BANKS[c.bank];
  const items = `<div class="tbl-wrap" style="max-height:300px;overflow:auto"><table class="t compact"><thead><tr><th>買うもの</th><th>勘定科目</th><th class="n">耐用年数</th><th class="n">金額</th></tr></thead><tbody>
    ${c.items.map(x => `<tr><td>${esc(x.n)}${x.openM > G.m ? `<div class="small muted">${ymLabel(x.openM)}に完成・納入（それまでは建設仮勘定）</div>` : ''}</td><td>${KS_ASSET_NAMES[x.acct] || ''}</td><td class="n">${x.life ? x.life + '年' : '―'}</td><td class="n">${fmtYen(x.cost)}</td></tr>`).join('')}
    ${c.deposit ? `<tr><td>店舗の保証金（敷金）</td><td>差入保証金</td><td class="n">償却しない</td><td class="n">${fmtYen(c.deposit)}</td></tr>` : ''}
    <tr class="total"><td>合計</td><td></td><td></td><td class="n">${fmtYen(c.total)}</td></tr></tbody></table></div>`;
  const depY = sum(c.items, x => (x.life && x.acct !== 'land' ? x.cost / x.life : 0));
  const seg = (act, list, cur) => `<div class="seg wrap" role="radiogroup">${list.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  let fin = `<div class="field"><span>お金の出し方</span>${seg('kCxFin', [['cash', '手元の資金で払う'], ['loan', '銀行から借りて払う']], c.fin)}</div>`;
  if (c.fin === 'loan') {
    fin += `<div class="field"><span>金融機関</span>${seg('kCxBank', Object.entries(KS_BANKS).map(([k, b]) => [k, b.short]), c.bank)}</div>
      <div class="grid g2" style="gap:10px"><label class="field"><span>借りる金額（万円）</span><input type="number" min="100" step="100" value="${Math.round(c.amt / 1e4)}" data-ch="kCxAmt" style="width:140px"></label>
      <div class="field"><span>期間</span>${seg('kCxTerm', [[60, '5年'], [84, '7年'], [120, '10年']], c.termM)}</div></div>
      ${c.bank !== 'koko' ? `<label class="inline small"><input type="checkbox" data-ch="kCxCgc" ${c.cgc ? 'checked' : ''}> 信用保証協会の保証を付ける</label>` : ''}`;
    if (c.res) {
      fin += c.res.ok ? `<div class="callout ok"><b>${B.short}：設備資金${fmtYen(c.res.amt)}をお貸しできます</b>（年${fmtNum(c.res.rate, 2)}%${c.res.fee ? `・保証料 ${fmtYen(c.res.fee)}` : ''}）。${c.res.reasons.map(esc).join(' ')}</div>`
        : `<div class="callout bad"><b>${B.short}：今回はお貸しできません</b><ul style="margin:6px 0 0;padding-left:1.2em">${c.res.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
    }
  }
  const cashAfter = ksB('cash') - c.total + (c.fin === 'loan' && c.res && c.res.ok ? c.res.amt : 0);
  const body = `<p style="margin:0 0 8px">${c.desc}</p>${items}
    <p class="small">買った設備は費用ではなく<b>資産</b>（${term('固定資産', 'fa')}）になり、使い始めてから毎年${term('減価償却費', 'dep')}として約${fmtYen(depY)}ずつ費用になります。お金は今出ていくのに、費用は何年にも分かれる。このずれが「利益とお金は違う」理由のひとつです。${c.items.some(x => x.openM > G.m) ? `完成・納入までの支払は${term('建設仮勘定', 'cip')}（資産）にためておき、使い始めたら本来の科目に振り替えます。` : ''}</p>
    ${fin}<p class="small">支払後の現預金の見込み：<b class="${cashAfter < 0 ? 'neg' : ''}">${fmtYen(cashAfter)}</b>（今 ${fmtYen(ksB('cash'))}）</p>`;
  let foot = btn('やめる', 'closeModal');
  if (c.fin === 'loan' && !(c.res && c.res.ok)) foot += btn('銀行に相談する', 'kCxEval', {}, 'primary');
  else foot += btn('投資を実行する', 'kCxGo', {}, 'primary', { disabled: cashAfter < 0 });
  return modalFrame(esc(c.title), body, foot);
};
Object.assign(ACTIONS, {
  kCxFin: d => { UI.kCapex.fin = d.v; UI.kCapex.res = null; drawModal(); },
  kCxBank: d => { UI.kCapex.bank = d.v; if (d.v === 'koko') UI.kCapex.cgc = false; UI.kCapex.res = null; drawModal(); },
  kCxTerm: d => { UI.kCapex.termM = +d.v; UI.kCapex.res = null; drawModal(); },
  kCxEval: () => { const c = UI.kCapex; c.res = ksEvalLoan({ bank: c.bank, purpose: 'capex', amt: c.amt, termM: c.termM, cgc: c.cgc, item: { cost: c.total } }); drawModal(); },
  kCxGo: () => {
    const c = UI.kCapex;
    if (c.fin === 'loan') {
      if (!c.res || !c.res.ok) return;
      const app = { bank: c.bank, purpose: 'capex', amt: c.amt, termM: c.termM, cgc: c.cgc, item: { cost: c.total } };
      ksBorrow(app, c.res);
      ksNews(`${KS_BANKS[c.bank].short}から設備資金${fmtYen(c.res.amt)}を借りました（${c.termM / 12}年・年${fmtNum(c.res.rate, 2)}%）`, 'bank');
      c.fin = 'cash'; c.res = null;
    }
    if (ksB('cash') < c.total) { toast('現預金が足りません', 'bad'); drawModal(); return; }
    if (c.pre && KS_CAPEX_PRE[c.pre]) KS_CAPEX_PRE[c.pre](c.preArg);
    c.items.forEach((x, i) => ksBuyAsset(Object.assign({}, x, i === 0 && c.deposit ? { deposit: c.deposit } : {})));
    if (!c.items.length && c.deposit) ksPost('deposit', [['deposit', c.deposit, 0], ['cash', 0, c.deposit]], { cf: 'capex', u: (c.arg && c.arg.u) || 'HQ' });
    const msg = KS_CAPEX_FX[c.fx] ? KS_CAPEX_FX[c.fx](c.arg) : '';
    ksNews(`${c.title}：${fmtYen(c.total)}。${msg}`, 'good');
    toast(`${c.title}を実行しました`);
    UI.kCapex = null;
    closeModal(true);
    render();
    autosave();
  },
});
Object.assign(CHANGES, {
  kCxAmt: el => { const v = parseFloat(el.value); if (isFinite(v) && v > 0) { UI.kCapex.amt = Math.round(v) * 1e4; UI.kCapex.res = null; drawModal(); } },
  kCxCgc: el => { UI.kCapex.cgc = el.checked; UI.kCapex.res = null; drawModal(); },
});
/* 固定資産の売却 */
ACTIONS.kSellAsset = d => {
  const a = G.assets.find(x => x.id === d.id);
  if (!a) return;
  const fy = fyOf(G.m);
  const months = Math.max(0, G.m - Math.max(fy * 12, a.acqM));
  const depNow = a.life ? Math.max(0, Math.min(Math.round(a.cost / a.life * months / 12), a.cost - 1 - a.booked)) : 0;
  const bv = a.cost - a.booked - depNow;
  const price = ksSalePrice(a);
  confirmBox(`${esc(a.n)}を売る`, `取得価額 ${fmtYen(a.cost)}、売る時点の帳簿価額 ${fmtYen(bv)}（今期の分の減価償却 ${fmtYen(depNow)} を計上した後）。中古の買取価格は <b>${fmtYen(price)}</b> です。<br>売ると帳簿価額との差 <b>${fmtYen(price - bv)}</b> が${price >= bv ? '固定資産売却益（特別利益）' : '固定資産売却損（特別損失）'}になります。`, '売却する', 'kSellGo', { id: a.id });
};
/* 決算整理の途中（3月末の締め）は、資産の売却・撤退・買収をしない（整理の数字が変わるため） */
function ksClosingBlock() { if (!G.closing) return false; toast('決算整理が終わってからにしましょう（3月末の締めの途中です）', 'bad'); return true; }
ACTIONS.kSellGo = d => {
  if (ksClosingBlock()) return;
  const a = G.assets.find(x => x.id === d.id);
  if (!a || a.soldM !== undefined) return;
  const price = ksSalePrice(a);
  const gain = ksSellAsset(a, price);
  ksNews(`${a.n}を${fmtYen(price)}で売却しました（売却${gain >= 0 ? '益' : '損'} ${fmtYen(Math.abs(gain))}）`, 'info');
  toast(`${a.n}を売却しました`);
  closeModal(true);
  render();
};

/* ---------- 設備（事業の固定資産）と、カタログからの購入 ---------- */
function ksEqEffText(q, u) {
  const P = ksP(u);
  const out = [];
  if (q.e === 'mfg' && q.k === 'job') out.push(`能力 月${fmtNum(q.cap, 0)}時間`, q.lab !== undefined && q.lab !== 1 ? `人手 ${fmtPct(q.lab * 100, 0)}` : '');
  if (q.e === 'mfg' && q.k === 'line') out.push(`能力 月${fmtNum((P.lineCap || 0) * (q.cm || 1), 0)}${esc(P.unit || '')}`);
  if (q.q) out.push(`品質↑（注文＋${fmtPct(q.q * 100, 0)}）`);
  if (q.auto) out.push(`省人化 ${fmtPct(q.auto * 100, 0)}`);
  if (q.avail) out.push(`稼働＋${fmtPct(q.avail * 100, 0)}`);
  if (q.energy) out.push(`光熱費 ${q.energy < 0 ? '' : '＋'}${fmtPct(q.energy * 100, 0)}`);
  if (q.shrink) out.push(`材料のロス −${fmtPct(q.shrink * 100, 0)}`);
  if (q.sub) out.push(`外注 −${fmtPct(q.sub * 100, 1)}`);
  if (q.load) out.push(`同時に受けられる工事 ＋${fmtNum(q.load, 1)}件`);
  if (q.e === 'trans') out.push(`輸送力 ${fmtNum(q.cap, q.cap < 10 ? 2 : 0)}${esc(q.cu || '')}`, `乗務員 ${q.crew}人`, `燃料 月${fmtYen(q.fuel)}`, `整備 月${fmtYen(q.mt)}`);
  if (q.e === 'cap' && q.cap) out.push(`能力 ${fmtNum(q.cap, 0)}${esc(q.cu || '')}`);
  if (q.e === 'subs' && P.capPer) out.push(`利用者 ${fmtNum(P.capPer, 0)}人分`);
  if (q.pr && q.pr > 1) out.push(`評価↑（需要＋${fmtPct((q.pr - 1) * 100, 0)}）`);
  return out.filter(Boolean).join('・');
}
/* この事業で買える設備のキー */
function ksEqOptions(u) {
  const S = ksS(u);
  const keys = Object.keys(KS_EQ);
  if (S.eng === 'mfg') {
    const line = S.p.mode === 'line';
    const own = new Set(S.eq.map(e => e.k).concat(S.aux.map(e => e.k)));
    return keys.filter(k => { const q = KS_EQ[k]; if (q.e !== 'mfg') return false; if (q.k === 'aux') return true; if (line) return q.k === 'line' && (own.has(k) || k === 'line'); return q.k === 'job'; })
      .sort((a, b) => (own.has(b) - own.has(a)) || ((KS_EQ[a].k === 'aux') - (KS_EQ[b].k === 'aux')) || (KS_EQ[a].c || 0) - (KS_EQ[b].c || 0));
  }
  if (S.eng === 'build') return keys.filter(k => KS_EQ[k].e === 'build');
  if (S.eng === 'trans' || S.eng === 'cap') {
    const cu = S.eq.length ? (KS_EQ[S.eq[0].k] || {}).cu : null;
    const own = new Set(S.eq.map(e => e.k));
    return keys.filter(k => KS_EQ[k].e === S.eng && (own.has(k) || (cu && KS_EQ[k].cu === cu))).sort((a, b) => (own.has(b) - own.has(a)) || (KS_EQ[a].c || 0) - (KS_EQ[b].c || 0));
  }
  if (S.eng === 'subs') return S.eq.map(e => e.k).filter(k => KS_EQ[k]);
  return [];
}
function ksEqLead(q, cost) { return q.a === 'bldg' && cost >= 1e8 ? 9 : cost >= 30e8 ? 12 : cost >= 5e8 ? 6 : 0; }
function ksEqTable(u, list, opt = {}) {
  if (!list.length) return '<div class="empty">設備はありません</div>';
  const rows = list.slice().sort((a, b) => a.acqM - b.acqM).map(a => {
    const q = ksEqOf(a);
    const age = Math.max(0, (G.m - a.acqM) / 12);
    const old = a.life && age > a.life * 1.2;
    return `<tr><td>${esc(a.n)}${a.cip ? ` ${tag(`${ymLabel(a.acqM)}完成`, 'warn')}` : ''}${q.pr > 1 ? ' <span class="tag ok">高性能</span>' : ''}<div class="small muted">${KS_ASSET_NAMES[a.acct] || ''}${q.n && q.n !== a.n.replace(/ \d+号$/, '') ? `・${esc(q.n)}` : ''}</div></td>
      <td class="n ${old ? 'neg' : ''}">${a.cip ? '―' : `${Math.floor(age)}年`}</td><td class="n small">${opt.cap ? opt.cap(a) : ''}</td><td class="n">${fmtYen(a.cost - a.booked)}</td>
      <td class="n">${!a.cip && opt.sell !== false && a.acct !== 'land' && a.acct !== 'goodwill' ? btn('売る', 'kSellAsset', { id: a.id }, 'sm') : ''}</td></tr>`;
  }).join('');
  return `<div class="tbl-wrap" style="max-height:360px;overflow:auto"><table class="t"><thead><tr><th>設備</th><th class="n">使った年数</th><th class="n">能力など</th><th class="n">帳簿価額</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
ACTIONS.kEqBuyOpen = d => { UI.kEqBuy = { u: d.u, k: null, n: 1 }; showModal('kEqBuy'); };
MODALS.kEqBuy = () => {
  const e = UI.kEqBuy;
  const u = ksUnit(e.u);
  const opts = ksEqOptions(u);
  if (!e.k || !opts.includes(e.k)) e.k = opts[0];
  const p = ksPrice();
  const list = opts.map(k => {
    const q = KS_EQ[k];
    const cost = q.c ?? (q.k === 'line' ? (ksP(u).lineCost || 2e8) * (q.cm || 1) : 1e7);
    return `<button type="button" class="eqopt${e.k === k ? ' on' : ''}" data-act="kEqPick" data-v="${k}" aria-pressed="${e.k === k}"><b>${esc(q.n)}</b><span class="small">${fmtYen(cost * p)}・${q.l}年</span><span class="small muted">${ksEqEffText(q, u)}</span></button>`;
  }).join('');
  const q = KS_EQ[e.k];
  const items = q ? ksEqItems(u, [{ k: e.k, n: e.n }], { priceF: p, numbered: e.n > 1 || ksUA(u).some(a => a.eq === e.k), start: ksUA(u).filter(a => a.eq === e.k).length, part: ksS(u).eng === 'build' ? 'S' : 'C' }) : [];
  const tot = sum(items, x => x.cost);
  const lead = q ? ksEqLead(q, items.length ? items[0].cost : 0) : 0;
  const body = `<p class="small" style="margin:0 0 8px">${esc(ksUName(u))}の設備のカタログです。能力の大きい機械・高性能の機械ほど高価です。買うと${term('固定資産', 'fa')}になり、耐用年数で${term('減価償却', 'dep')}します。</p>
    <div class="eqlist">${list || '<div class="empty">この事業で買える設備はありません</div>'}</div>
    ${q ? `<div class="row" style="margin-top:10px;gap:10px;align-items:center"><span class="small">台数</span>${[1, 2, 3, 5, 10].map(n => btn(`${n}`, 'kEqN', { v: n }, `sm${e.n === n ? ' primary' : ''}`)).join('')}<span class="small">合計 <b>${fmtYen(tot)}</b>${lead ? `・納入まで${lead}か月` : ''}</span></div>` : ''}`;
  return modalFrame('設備を買う', body, btn('やめる', 'closeModal') + (q ? btn('この設備の投資を検討する', 'kEqBuyGo', {}, 'primary') : ''), { size: 'wide', sub: esc(ksUName(u)) });
};
Object.assign(ACTIONS, {
  kEqPick: d => { UI.kEqBuy.k = d.v; drawModal(); },
  kEqN: d => { UI.kEqBuy.n = +d.v; drawModal(); },
  kEqBuyGo: () => {
    const e = UI.kEqBuy;
    const u = ksUnit(e.u);
    const q = KS_EQ[e.k];
    const items = ksEqItems(u, [{ k: e.k, n: e.n }], { priceF: ksPrice(), numbered: e.n > 1 || ksUA(u).some(a => a.eq === e.k), start: ksUA(u).filter(a => a.eq === e.k).length, part: ksS(u).eng === 'build' ? 'S' : 'C' });
    const lead = ksEqLead(q, items[0].cost);
    if (lead) for (const x of items) x.openM = G.m + lead;
    UI.kEqBuy = null;
    closeModal(true);
    ksCapexOpen({ title: `${q.n}を${e.n > 1 ? `${e.n}台` : ''}買う`, desc: `${esc(ksUName(u))}の設備を増やします。${ksEqEffText(q, u)}。`, items, fx: 'eqBuy', arg: { u: u.id, open: lead ? G.m + lead : 0 } });
  },
});

/* ---------- 現場の画面（共通の骨組み） ---------- */
function ksKpiPanel(rows) { return panel('先月の現場の数字', rows.length ? kv(rows) : '<div class="empty">まだ締めた月はありません</div>'); }
function ksPointsPanel(u, items) { return panel(`${esc(KS_ENG_INFO[ksS(u).eng].n)}のポイント`, `<ul class="small" style="margin:0;padding-left:1.2em">${items.map(x => `<li>${x}</li>`).join('')}</ul>`); }
function ksUnitBar() {
  const us = ksActiveUnits();
  const cur = ksCurUnit();
  const chips = us.map(u => { const S = ksS(u); const k = ksKpiU(u); return `<button type="button" class="unitchip${u === cur ? ' on' : ''}" data-act="kUnitSel" data-u="${u.id}" aria-pressed="${u === cur}"><span class="indico" aria-hidden="true">${esc(S.icon)}</span><span><b>${esc(ksUName(u))}</b><span class="small muted">${esc(KS_ENG_INFO[S.eng].n)}${k.sales ? `・月${fmtYen(k.sales)}` : ''}</span></span></button>`; }).join('');
  return `<div class="unitbar" role="tablist" aria-label="事業">${chips}<button type="button" class="unitchip add" data-act="kNewUnit"><span class="indico" aria-hidden="true">＋</span><span><b>新しい事業を始める</b><span class="small muted">${fmtNum(KS_TYPE_LIST.length, 0)}業種から選ぶ</span></span></button></div>`;
}
function ksUnitHeadHtml(u) {
  const S = ksS(u);
  const segs = [KS_SECTORS[S.sec].n, S.grp, KS_ENG_INFO[S.eng].n].filter(Boolean);
  const start = u.startM > (G.startedM ?? 9999) - 1 ? `${ymLabel(u.startM)}から` : '';
  return `<div class="unithead"><div><h2 class="h2" style="margin:0">${esc(ksUName(u))}</h2><div class="small muted">${segs.map(esc).join(' ／ ')}${start ? `・${start}` : ''}${u.acq ? `・${esc(u.acq.co)}から譲受` : ''}</div>${S.d ? `<p class="small" style="margin:4px 0 0">${esc(S.d)}</p>` : ''}</div>
    <div class="row">${ksActiveUnits().length > 1 ? btn('この事業から撤退する', 'kCloseUnit', { u: u.id }, 'sm ghost') : ''}</div></div>`;
}
KS_SCREENS.k_ops = () => {
  const u = ksCurUnit();
  if (!u) return '<div class="empty">事業がありません</div>';
  const ops = KS_OPS[ksS(u).eng];
  return `<div class="kops"><h1 class="h1">現場</h1><p class="lead">事業ごとに経営の判断をします。決めたことは今月から効き、月末に数字になって表れます。${ksActiveUnits().length > 1 ? '事業ごとの損益は「決算書」のセグメント情報で比べられます。' : ''}</p>
    ${ksUnitBar()}${ksUnitHeadHtml(u)}${ops.screen(u)}</div>`;
};

/* =========================================================
 *  shop：店舗で売る
 * ========================================================= */
KS_OPS.shop = {
  params(u) {
    const P = ksP(u), op = u.op;
    const a0 = KS_ENGINE.shop.ads0(u);
    const ps = [];
    if (!P.svc) ps.push({ k: 'markup', label: '値入率（粗利の目標）', tk: 'gpm', min: +(op.gm0 - 0.06).toFixed(3), max: +(op.gm0 + 0.07).toFixed(3), step: 0.005, f: 'pct', help: '上げると1品あたりの粗利が増えるが、値段が上がって客足が減る。' });
    else ps.push({ k: 'markup', label: '料金の水準（材料費を除いた取り分）', tk: 'gpm', min: +(op.gm0 - 0.06).toFixed(3), max: +(op.gm0 + 0.07).toFixed(3), step: 0.005, f: 'pct', help: '上げると1回あたりの利益が増えるが、お客さんが減る。' });
    if (!P.svc) ps.push({ k: 'invDays', label: '在庫の日数', tk: 'invDays', min: Math.max(2, Math.round(P.inv * 0.4)), max: Math.round(P.inv * 1.8), step: 1, f: 'days', help: `少ないと品切れで客が減り（${Math.round(P.inv * 0.75)}日未満）、多いと売れ残り・廃棄が増える。` });
    ps.push({ k: 'ads', label: '広告宣伝費（1店・月）', tk: 'ads', min: 0, max: a0 * 5, step: ksNiceStep(a0 * 5), f: 'yen', help: 'チラシ・アプリ・SNS。客数を最大で7%ほど増やす。' });
    return ps;
  },
  kpiRows(u, k) {
    if (!k.sales) return [];
    return [['1店1日の客数', `${fmtNum(k.cust / Math.max(1, k.n), 0)}人`], ['客単価', `${fmtNum(k.spend, 0)}円`], [ksP(u).svc ? '材料を除いた取り分' : '売上総利益率（廃棄後）', fmtPct(k.gpr * 100, 1)], ksP(u).svc ? null : ['廃棄・ロス率', fmtPct(k.wasteRate * 100, 2)], ['人員の充足', fmtPct(Math.min(1.5, k.cap) * 100, 0)]].filter(Boolean);
  },
  alerts(u) {
    const out = [];
    const E = KS_ENGINE.shop;
    const cap = E.staffCap(u);
    if (E.storesOpen(u).length && cap < 0.95) out.push({ ico: '人', cls: 'warn', t1: `${ksUName(u)}：売場の人手が足りません`, t2: `必要な人員の${fmtPct(cap * 100, 0)}しかいません。お客さんを逃し、ロスも増えます`, act: btn('人員へ', 'kGoUnit', { u: u.id }, 'sm') });
    for (const s of E.storesOpen(u)) if ((G.m - s.eqM) / 12 > 8) { out.push({ ico: '設', cls: 'warn', t1: `${ksUName(u)}・${s.n}の設備が${Math.floor((G.m - s.eqM) / 12)}年使われています`, t2: '古い設備は電気代と修理代がかさみ、廃棄も増えます', act: btn('現場へ', 'kGoUnit', { u: u.id }, 'sm') }); break; }
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.shop, P = ksP(u), op = u.op;
    const k = ksKpiU(u);
    const pr = ksPrice();
    const eqn = (P.eqn && P.eqn[0]) || '店の設備';
    const stores = op.stores.map(s => {
      const open = s.openM <= G.m;
      const closed = s.openM === 9999;
      const ra = (G.m - s.renovM) / 12, fa = (G.m - s.eqM) / 12;
      return `<tr><td><b>${esc(s.n)}</b>${closed ? ` ${tag('火災で休業', 'bad')}` : open ? '' : ` ${tag(`${ymLabel(s.openM)}開店`, 'warn')}`}${s.comp && s.comp < 1 ? `<div class="small muted">近くに競合店（客数 ${fmtPct(s.comp * 100, 0)}）</div>` : ''}</td>
        <td class="n">${open ? `${Math.floor(Math.max(0, ra))}年` : '―'}</td><td class="n ${fa > 8 ? 'neg' : ''}">${open ? `${Math.floor(Math.max(0, fa))}年` : '―'}</td>
        <td class="n nowrap">${open && !closed ? btn('改装', 'kShopRenov', { u: u.id, s: s.n }, 'sm') + btn('設備の更新', 'kShopEq', { u: u.id, s: s.n }, 'sm') : ''}</td></tr>`;
    }).join('');
    const plan = E.plan(u);
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, '売り方', this.params(u), `<p class="note">${term('値入率', 'gpm')}は、売値のうち粗利になる割合の目標です。実際の${term('売上総利益率', 'gpm')}は、廃棄や万引きのロスの分だけ低くなります。</p>`)}
      ${panel(`店舗（${E.storesOpen(u).length}店）`, `<div class="tbl-wrap"><table class="t"><thead><tr><th>店</th><th class="n">改装から</th><th class="n">${esc(eqn)}</th><th class="n"></th></tr></thead><tbody>${stores}</tbody></table></div>
        <div class="row" style="margin-top:10px">${btn('新しい店を出す', 'kShopStore', { u: u.id }, 'primary')}<span class="small muted">内装・設備と保証金で約${fmtYen(sum(plan.items, x => x.cost) + (plan.deposit || 0))}。家賃は月${fmtYen(op.rentPer * pr)}。</span></div>`)}
      ${ksStaffPanel(u, E.need(u))}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, ['売上 ＝ 客数 × 客単価。', '粗利から人件費・家賃・水道光熱費を払った残りが利益。粗利率が1ポイント違うと利益は大きく変わります。', 'お客さんの支払いは現金とカードがほとんど。仕入代金は翌月払いなので、お金は回りやすい商売です。', `決算の${term('実地棚卸', 'stocktake')}で、帳簿より在庫が少ない分は${term('棚卸減耗損', 'shrink')}になります。`])}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kShopStore: d => { const u = ksUnit(d.u); ksCapexOpen(KS_ENGINE.shop.plan(u)); },
  kShopRenov: d => { const u = ksUnit(d.u); const P = ksP(u); ksCapexOpen({ title: `${d.s}の改装`, desc: '売場を新しくすると、客足が戻ります（古い店ほど効果が大きい）。', items: [{ n: `${d.s}の改装工事`, acct: 'bldg', cost: Math.round(P.fit * 0.4 * ksPrice()), life: 15, part: 'S', u: u.id }], fx: 'shopRenov', arg: { u: u.id, s: d.s } }); },
  kShopEq: d => { const u = ksUnit(d.u); const P = ksP(u); ksCapexOpen({ title: `${d.s}の設備の更新`, desc: '新しい設備にすると、電気代・修理代・廃棄が減ります。', items: [{ n: `${d.s}の${(P.eqn && P.eqn[0]) || '店の設備'}`, acct: 'equip', cost: Math.round(P.eqc * ksPrice()), life: 6, part: 'S', u: u.id }], fx: 'shopEq', arg: { u: u.id, s: d.s } }); },
  kGoUnit: d => { UI.tab = 'k_ops'; UI.kUnit = d.u; UI.modal = null; drawModal(); render(); window.scrollTo({ top: 0 }); },
});

/* =========================================================
 *  rest：飲食店
 * ========================================================= */
KS_OPS.rest = {
  params(u) {
    const op = u.op;
    return [
      { k: 'price', label: 'メニューの価格の水準', tk: '', min: 0.85, max: 1.3, step: 0.01, f: 'lv', help: '100%が今の価格。上げると客単価は上がるが、客数が減る（10%の値上げで約13%）。' },
      { k: 'foodQ', label: '食材の原価率（料理の質）', tk: 'costRatio', min: +(op.fq0 - 0.07).toFixed(3), max: +(op.fq0 + 0.08).toFixed(3), step: 0.005, f: 'pct', help: '下げると利益は増えるが、料理の評判が少しずつ落ちて客が減る。' },
      { k: 'ads', label: '広告宣伝費（1店・月）', tk: 'ads', min: 0, max: Math.max(10e4, op.ads * 4), step: ksNiceStep(Math.max(10e4, op.ads * 4)), f: 'yen', help: 'グルメサイトやSNSの広告。' },
    ];
  },
  kpiRows(u, k) {
    if (!k.sales) return [];
    const f = ksUFlowLast(u);
    const fl = ((f.purch || 0) + (f.salary || 0) + (f.welfare || 0) + (f.labor || 0)) / Math.max(1, f.sales || k.sales);
    return [['1店1日の客数', `${fmtNum(k.cust, 0)}人`], ['客単価', `${fmtNum(k.spend, 0)}円`], ['食材原価率（廃棄込み）', fmtPct(k.foodRate * 100, 1)], ['FL比率（食材費＋人件費）', fmtPct(fl * 100, 1)], ['家賃比率', fmtPct(k.rentRate * 100, 1)], ['人員の充足', fmtPct(Math.min(1.5, k.cap) * 100, 0)]];
  },
  alerts(u) {
    const out = [];
    const E = KS_ENGINE.rest;
    const cap = E.staffCap(u);
    if (E.shopsOpen(u).length && cap < 0.95) out.push({ ico: '人', cls: 'warn', t1: `${ksUName(u)}：店の人手が足りません`, t2: `必要な人員の${fmtPct(cap * 100, 0)}。料理の提供が遅れて客が減ります`, act: btn('人員へ', 'kGoUnit', { u: u.id }, 'sm') });
    for (const s of E.shopsOpen(u)) if ((G.m - s.kitM) / 12 > 7) { out.push({ ico: '厨', cls: 'warn', t1: `${ksUName(u)}・${s.n}の厨房機器が古くなっています（${Math.floor((G.m - s.kitM) / 12)}年）`, t2: '故障が増え、修理代がかさみます', act: btn('現場へ', 'kGoUnit', { u: u.id }, 'sm') }); break; }
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.rest, op = u.op;
    const k = ksKpiU(u);
    const shops = op.shops.map(s => {
      const open = s.openM <= G.m;
      const closed = s.openM === 9999;
      return `<tr><td><b>${esc(s.n)}</b>${closed ? ` ${tag('火災で休業', 'bad')}` : open ? '' : ` ${tag(`${ymLabel(s.openM)}開店`, 'warn')}`}${s.comp && s.comp < 1 ? `<div class="small muted">近くに競合店</div>` : ''}</td><td class="n">${open ? `${Math.floor(Math.max(0, (G.m - s.renovM) / 12))}年` : '―'}</td><td class="n ${(G.m - s.kitM) / 12 > 7 ? 'neg' : ''}">${open ? `${Math.floor(Math.max(0, (G.m - s.kitM) / 12))}年` : '―'}</td>
        <td class="n nowrap">${open && !closed ? btn('改装', 'kRestRenov', { u: u.id, s: s.n }, 'sm') + btn('厨房機器の更新', 'kRestKitchen', { u: u.id, s: s.n }, 'sm') : ''}</td></tr>`;
    }).join('');
    const plan = E.plan(u);
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, 'メニューと料理', this.params(u), `<p class="note">飲食店の基本の指標は${term('FL比率', 'flRatio')}（食材費＋人件費÷売上）。60%以下が目安です。家賃は売上の10%以内が目安。</p>`)}
      ${panel(`店舗（${E.shopsOpen(u).length}店）`, `<div class="tbl-wrap"><table class="t"><thead><tr><th>店</th><th class="n">改装から</th><th class="n">厨房機器</th><th class="n"></th></tr></thead><tbody>${shops}</tbody></table></div>
        <div class="row" style="margin-top:10px">${btn('新しい店を出す', 'kRestShop', { u: u.id }, 'primary')}<span class="small muted">内装・厨房機器・保証金で約${fmtYen(sum(plan.items, x => x.cost) + (plan.deposit || 0))}。家賃は月${fmtYen(op.rentPer)}。</span></div>`)}
      ${ksStaffPanel(u, E.need(u))}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, ['現金・カードで毎日お金が入る「日銭商売」。在庫は数日分。', `家賃と人件費という固定費が重く、売上が1割落ちると利益が消えます（${term('損益分岐点', 'bep')}）。`, `食材の${term('原価率', 'costRatio')}は30%前後。決算では冷蔵庫の食材を数えて原価を確定します。`])}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kRestShop: d => { const u = ksUnit(d.u); ksCapexOpen(KS_ENGINE.rest.plan(u)); },
  kRestRenov: d => { const u = ksUnit(d.u); const P = ksP(u); ksCapexOpen({ title: `${d.s}の改装`, desc: '内装を新しくすると、客足が戻ります。', items: [{ n: `${d.s}の改装工事`, acct: 'bldg', cost: Math.round(P.fit * 0.6 * ksPrice()), life: 15, part: 'S', u: u.id }], fx: 'restRenov', arg: { u: u.id, s: d.s } }); },
  kRestKitchen: d => { const u = ksUnit(d.u); const P = ksP(u); ksCapexOpen({ title: `${d.s}の厨房機器の更新`, desc: '冷蔵庫・コンロ・食洗機を入れ替えると、故障と修理代が減ります。', items: [{ n: `${d.s}の${(P.eqn && P.eqn[0]) || '厨房機器'}`, acct: 'equip', cost: Math.round(P.eqc * ksPrice()), life: 6, part: 'S', u: u.id }], fx: 'restKitchen', arg: { u: u.id, s: d.s } }); },
});

/* =========================================================
 *  mfg：ものづくり
 * ========================================================= */
KS_OPS.mfg = {
  params(u) {
    const op = u.op, P = ksP(u);
    const job = op.mode === 'job';
    const r0 = op.ref * ksPrice();
    return [
      { k: 'rate', label: job ? '加工賃（1時間あたり）' : `製品の単価（1${P.unit || '個'}あたり）`, tk: '', min: job ? Math.round(r0 * 0.75 / 10) * 10 : +(r0 * 0.75).toFixed(2), max: job ? Math.round(r0 * 1.35 / 10) * 10 : +(r0 * 1.35).toFixed(2), step: job ? 10 : Math.max(0.01, +(r0 / 200).toPrecision(1)), f: 'yenh', help: job ? '取引先に請求する加工の単価。上げると利益は増えるが、注文が他社に流れる。材料代は別に請求します。' : '取引先への卸値。上げると利益は増えるが、注文が減る。' },
      { k: 'ot', label: '残業（通常の時間に対する割合）', tk: 'otLimit', min: 0, max: 0.3, step: 0.05, f: 'lv', help: '人手が足りないときに増やす。残業代は1.25倍で、労務費（原価）になります。月45時間（約28%）を超えると36協定の特別条項が要ります。' },
      { k: 'matDays', label: '材料の在庫日数', tk: 'invDays', min: 3, max: 60, step: 1, f: 'days', help: '多いと材料の値上がりに強いが、お金が在庫に寝る。' },
    ];
  },
  kpiRows(u, k) {
    if (k.demand === undefined) return [];
    const unit = k.unit || '時間';
    return [['注文', `${fmtNum(k.demand, 0)}${unit}`], ['生産能力', `${fmtNum(k.capacity, 0)}${unit}（設備 ${fmtNum(k.capM, 0)}・人 ${fmtNum(k.workerH * (1 + u.op.ot), 0)}）`], ['稼働率', fmtPct(k.util * 100, 0)], ['断った注文', k.short > 0.005 ? `<span class="neg">${fmtPct(k.short * 100, 0)}</span>` : 'なし'], ['外注した量', `${fmtNum(k.extra || 0, 0)}${unit}`], ['単価', `${fmtNum(k.rate, k.rate < 100 ? 2 : 0)}円${k.slide ? `（材料スライド ${k.slide > 0 ? '+' : ''}${fmtNum(k.slide, Math.abs(k.slide) < 100 ? 2 : 0)}円）` : ''}`]];
  },
  alerts(u) {
    const out = [];
    const k = ksKpiU(u);
    if (k.short > 0.05) out.push({ ico: '注', cls: 'warn', t1: `${ksUName(u)}：注文の${fmtPct(k.short * 100, 0)}を断りました`, t2: k.capM < k.workerH * (1 + u.op.ot) ? '設備が足りません。設備を増やすか、外注を使いましょう。断り続けると取引先の信頼が下がります' : '人手が足りません。人を増やすか、残業を増やしましょう', act: btn('現場へ', 'kGoUnit', { u: u.id }, 'sm') });
    else if (k.util !== undefined && k.util < 0.65) out.push({ ico: '稼', t1: `${ksUName(u)}：稼働率が${fmtPct(k.util * 100, 0)}に下がっています`, t2: '設備と人が遊んでいても、減価償却費と給料はかかります（固定費）。単価を見直すか、人員を調整しましょう', act: '' });
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.mfg, op = u.op, P = ksP(u);
    const k = ksKpiU(u);
    const ms = E.machines(u).concat(E.auxs(u));
    const capTxt = a => { const q = ksEqOf(a); return q.k === 'job' ? `${fmtNum(a.cap || q.cap || 0, 0)}時間` : q.k === 'line' ? `${fmtNum(a.cap || 0, 0)}${esc(P.unit || '')}` : esc(ksEqEffText(q, u)); };
    const others = ksUA(u).filter(a => !ms.includes(a));
    const nd = E.need(u);
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, '受注と生産', this.params(u), `<div class="row" style="margin-top:8px"><label class="inline small"><input type="checkbox" data-act="kOpToggle" data-u="${u.id}" data-k="outsource" ${op.outsource ? 'checked' : ''}> 能力を超えた注文は外注に出す（単価の85〜90%を払うので利益は薄いが、注文を断らずに済む）</label></div>`)}
      ${panel('設備（機械・ライン・補助設備）', `${ksEqTable(u, ms, { cap: capTxt })}
        <div class="row" style="margin-top:10px">${btn('設備を買う（カタログ）', 'kEqBuyOpen', { u: u.id }, 'primary')}<span class="small muted">${op.mode === 'job' ? '旋盤・マシニングセンタ・レーザー加工機・プレス・溶接ロボット・測定機など' : '生産ライン・自動化設備・検査装置など'}</span></div>
        <p class="note">機械は${term('機械装置', 'machine')}（固定資産）として計上し、耐用年数で${term('減価償却', 'dep')}します。工場の機械の償却費は製造原価に入ります。補助の設備（ロボット・測定機・IoT）は、能力ではなく品質・省人化・稼働率を上げます。</p>`)}
      ${others.length ? panel('建物・車両など', ksEqTable(u, others, {})) : ''}
      ${ksStaffPanel(u, nd, { note: op.mode === 'job' ? '作業者1人で月150時間ほど働けます（機械ごとに要る人手が違います）。' : '' })}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, [`代金の入金は${P.terms}か月後。材料代と給料が先に出ていくので${term('運転資金', 'wc')}が必要です。`, `工場の人の給料は${term('労務費', 'labor')}、電力料や工具は製造経費。材料費と合わせて${term('製造原価報告書', 'mfgCost')}を作ります。`, `${term('稼働率', 'utilization')}が下がると、製品1個あたりの固定費が重くなります。設備は能力と稼働のバランスで買います。`])}
    </div></div>`;
  },
};

/* =========================================================
 *  build：工事を請け負う
 * ========================================================= */
KS_OPS.build = {
  params(u) {
    return [
      { k: 'margin', label: '見積の利益率（標準）', tk: 'gpm', min: 0.06, max: 0.4, step: 0.01, f: 'pct', help: '見積の原価に上乗せする利益の割合。新しい見積依頼の初期値になります。', after: x => { for (const b of x.op.bids) b.margin = +x.op.margin.toFixed(2); } },
      { k: 'ads', label: '広告宣伝費（月）', tk: 'ads', min: 0, max: Math.max(100e4, u.op.ads * 4), step: ksNiceStep(Math.max(100e4, u.op.ads * 4)), f: 'yen', help: '見学会・チラシ・Web・営業。見積依頼が増える。' },
    ];
  },
  kpiRows(u, k) {
    if (k.backlog === undefined) return [];
    return [['受注残（未完成の工事の請負金額）', fmtYen(k.backlog)], ['施工中の工事', `${k.active}件`], ['今月の完成', `${k.completed}件（${fmtYen(k.doneSales)}）`], ['今月の受注', `${k.won}件`], ['現場の負荷', fmtPct(k.loadR * 100, 0)]];
  },
  alerts(u) {
    const out = [];
    const E = KS_ENGINE.build;
    if (u.op.bids.length) out.push({ ico: '見', t1: `${ksUName(u)}：見積の依頼が${u.op.bids.length}件届いています`, t2: '利益率を決めて見積を出します（今月末に結果が出ます）。出さない依頼は「見送る」に', act: btn('見積へ', 'kGoUnit', { u: u.id }, 'sm primary') });
    const lr = E.load(u) / Math.max(1, E.loadCap(u));
    if (lr > 1.05) out.push({ ico: '監', cls: 'warn', t1: `${ksUName(u)}：現場の人が足りません`, t2: `現場の負荷が${fmtPct(lr * 100, 0)}。手直しが増え、原価が膨らみ、評判も下がります`, act: btn('人員へ', 'kGoUnit', { u: u.id }, 'sm') });
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.build, op = u.op;
    const k = ksKpiU(u);
    const bids = op.bids.map(b => {
      const winP = E.winP(u, b.margin, null);
      return `<tr class="${b.on ? '' : 'muted'}"><td><b>${esc(b.client)}</b><div class="small muted">${esc(b.n)}・工期${b.dur}か月</div></td><td class="n">${fmtYen(b.est)}</td>
        <td class="n"><span class="nowrap">${btn('−', 'kBidM', { u: u.id, id: b.id, d: -0.02 }, 'sm')}<b class="num" style="display:inline-block;min-width:3.6em;text-align:center">${fmtPct(b.margin * 100, 0)}</b>${btn('＋', 'kBidM', { u: u.id, id: b.id, d: 0.02 }, 'sm')}</span></td>
        <td class="n">${fmtYen(niceAmount(b.est * (1 + b.margin)))}</td><td class="n">${b.on ? `約${fmtPct(Math.round(winP * 10) * 10, 0)}` : '―'}</td><td class="n">${btn(b.on ? '見送る' : '見積を出す', 'kBidOn', { u: u.id, id: b.id }, 'sm')}</td></tr>`;
    }).join('');
    const projs = op.projects.filter(p => !p.fin).sort((a, b) => a.startM - b.startM).map(p => {
      const kk = G.m - p.startM;
      const started = kk >= 0;
      const prog = started ? Math.min(1, kk / p.dur) : 0;
      return `<tr><td><b>${esc(p.client)}</b><div class="small muted">${esc(p.n)}${p.over ? ' <span class="tag bad">手直し発生</span>' : ''}</div></td><td class="n">${fmtYen(p.contract)}</td><td>${started ? meter(prog * 100, 100, 'ok') : '<span class="small muted">着工前</span>'}<div class="small muted">${started ? `${kk}/${p.dur}か月` : `${ymLabel(p.startM)}着工`}</div></td>
        <td class="n">${fmtYen(p.costToDate)}<div class="small muted">予定 ${fmtYen(p.cost)}</div></td><td class="n">${fmtYen(p.recv)}</td><td class="n">${ymLabel(p.startM + p.dur - 1)}</td></tr>`;
    }).join('');
    const eq = E.equip(u);
    return `<div class="grid g-side"><div class="stack">
      ${panel(`今月の見積依頼（${op.bids.length}件）`, op.bids.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>お客さま</th><th class="n">見積の原価</th><th class="n">利益率</th><th class="n">請負金額</th><th class="n">受注の見込み</th><th></th></tr></thead><tbody>${bids}</tbody></table></div>
        <p class="note">利益率を上げると1件の利益は増えますが、他社に負けやすくなります。現場の人1人で同時に3件ほど（大きな工事は数件分）を見られます。見積の原価どおりに工事が終わるとは限りません。</p>` : '<div class="empty">今月の見積依頼はありません。来月を待ちましょう。</div>')}
      ${panel('施工中の工事', projs ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>工事</th><th class="n">請負金額</th><th>進み具合</th><th class="n">かかった原価</th><th class="n">受け取った代金</th><th class="n">完成予定</th></tr></thead><tbody>${projs}</tbody></table></div>
        <p class="note">完成するまで、かかった原価は${term('未成工事支出金', 'wip')}（資産）、受け取った代金は${term('未成工事受入金', 'advRecv')}（負債）にためておき、引き渡した月にまとめて${term('完成工事高', 'conRev')}と${term('完成工事原価', 'conCost')}にします（${term('工事完成基準', 'completion')}）。</p>` : '<div class="empty">施工中の工事はありません</div>')}
      ${ksParamsPanel(u, '営業', this.params(u))}
      ${panel('建設機械・車両', `${ksEqTable(u, ksUA(u).filter(a => ['mach', 'veh', 'equip'].includes(a.acct)), { cap: a => esc(ksEqEffText(ksEqOf(a), u)) })}<div class="row" style="margin-top:10px">${btn('建設機械を買う（カタログ）', 'kEqBuyOpen', { u: u.id }, 'primary')}<span class="small muted">自社の重機があると外注が減り、同時に受けられる工事が増えます${eq.length ? '' : '（今は持っていません）'}。</span></div>`)}
      ${ksStaffPanel(u, E.need(u))}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, [`工事代金は契約・着工・中間・完成に分けて入り、材料費・外注費は毎月出ていきます。工事が重なると${term('運転資金', 'wc')}（つなぎ資金）が必要です。`, `工事完成基準では、完成した月にまとめて売上が立つので、月次の損益は大きく波打ちます。${term('受注残', 'backlog')}も見ましょう。`, '赤字の工事を未成工事支出金のまま先送りしていないか、銀行はよく見ています。'])}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kBidM: d => { const u = ksUnit(d.u); const b = u && u.op.bids.find(x => x.id === d.id); if (b) { b.margin = +clamp(b.margin + +d.d, 0.04, 0.45).toFixed(2); render(); } },
  kBidOn: d => { const u = ksUnit(d.u); const b = u && u.op.bids.find(x => x.id === d.id); if (b) { b.on = !b.on; render(); } },
});

/* =========================================================
 *  trade：仕入れて卸す（商社・卸）
 * ========================================================= */
function ksCustRating(pd) { return pd < 0.6 ? ['A', 'ok'] : pd < 1.2 ? ['B', ''] : pd < 2.5 ? ['C', 'warn'] : ['D', 'bad']; }
KS_OPS.trade = {
  params(u) {
    const op = u.op, P = ksP(u);
    const pt = KS_ENGINE.trade.passT(u);
    const ps = [
      { k: 'margin', label: '売値に乗せる粗利率', tk: 'gpm', min: +Math.max(0.01, op.gm0 + Math.min(0, pt) - 0.04).toFixed(3), max: +(op.gm0 + Math.max(0, pt) + 0.05).toFixed(3), step: 0.0025, f: 'pct', help: `上げると1件あたりの粗利は増えるが、取引量が減り、他社に移る取引先も出る。${P.fx ? `為替の変化を業界が値段に転嫁している分（いまは${pt >= 0 ? '+' : ''}${fmtNum(pt * 100, 1)}ポイント）までは、上げても取引先は離れにくい。` : ''}` },
      { k: 'invDays', label: '在庫の日数', tk: 'invDays', min: Math.max(2, Math.round(P.inv * 0.4)), max: Math.round(P.inv * 1.8), step: 1, f: 'days', help: '多いと欠品はしないが、お金が在庫に寝る。' },
    ];
    if (P.fx) ps.push({ k: 'hedge', label: '為替予約の割合', tk: 'fxHedge', min: 0, max: 1, step: 0.1, f: 'lv', help: '輸入の代金の一部を、今のレートで予約しておく。円安になっても仕入値が上がらないが、円高になっても下がらない。', after: x => { x.op.fxLock = G.eco.fx || 148; } });
    return ps;
  },
  kpiRows(u, k) {
    if (k.sales === undefined) return [];
    const P = ksP(u);
    return [['取引先', `${k.customers}社`], ['配送能力の使用率', isFinite(k.cap) ? fmtPct(k.sales / Math.max(1, k.cap) * 100, 0) : '―（配送なし）'], ['粗利率（為替・廃棄の後）', fmtPct(k.gpr * 100, 1)], ['新しい取引先', `${k.nNew}社`], ['貸倒れ', k.bad ? `<span class="neg">${fmtYen(k.bad)}</span>` : 'なし'], P.fx ? ['為替（1ドル）', `${fmtNum(G.eco.fx || 148, 1)}円（仕入値への影響 ${fmtPct((k.fxF - 1) * 100, 1)}）`] : null].filter(Boolean);
  },
  alerts(u) {
    const out = [];
    const E = KS_ENGINE.trade;
    const pot = sum(u.op.customers, c => c.size * c.ramp) * ksPrice();
    if (E.capacity(u) < pot * 0.98) out.push({ ico: '配', cls: 'warn', t1: `${ksUName(u)}：配送が追いつきません`, t2: 'トラックか倉庫・配送の人員が足りず、注文の一部に応えられていません', act: btn('現場へ', 'kGoUnit', { u: u.id }, 'sm') });
    const risky = u.op.customers.filter(c => c.pd >= 2.5).length;
    if (risky) out.push({ ico: '与', t1: `${ksUName(u)}：信用の低い取引先（D）が${risky}社あります`, t2: '倒産すると売掛金が回収できません（貸倒れ）', act: '' });
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.trade, op = u.op, P = ksP(u);
    const k = ksKpiU(u);
    const trucks = E.trucks(u);
    const pot = sum(op.customers, c => c.size * c.ramp) * ksPrice();
    const cs = op.customers.slice().sort((a, b) => b.size - a.size);
    const custRows = cs.map(c => { const [r, cls] = ksCustRating(c.pd); return `<tr><td><b>${esc(c.n)}</b><div class="small muted">${esc(c.kind)}・取引${fmtNum(Math.max(0, (G.m - c.since) / 12), 0)}年</div></td><td class="n">${fmtYen(c.size * ksPrice())}</td><td class="n">${c.terms === 2 ? '翌々月末' : '翌月末'}</td><td class="n">${tag(r, cls)}</td><td class="n">${btn('取引をやめる', 'kCustDrop', { u: u.id, id: c.id }, 'sm')}</td></tr>`; }).join('');
    const pol = [['strict', '厳しく'], ['std', '普通'], ['loose', '甘く']];
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, '売り方', this.params(u), `<div class="field" style="margin-top:10px"><span>${term('与信', 'pd')}の方針（新しい取引先の選び方）</span><div class="seg" role="radiogroup">${pol.map(([v, l]) => `<button type="button" data-act="kOpSet" data-u="${u.id}" data-k="policy" data-v="${v}" aria-pressed="${op.policy === v}">${l}</button>`).join('')}</div>
        <span class="small muted">甘くすると取引先は増えるが、支払の遅い先や倒産しそうな先も増える。厳しくすると増えにくいが、貸倒れは減る。</span></div>${P.fx ? `<p class="note">輸入の割合が大きい商売です（為替の影響 ${fmtPct(P.fx * 100, 0)}）。円安になると仕入値が上がり、粗利が削られます。業界も値上げで転嫁するので、粗利率を${fmtPct((op.gm0 + KS_ENGINE.trade.passT(u)) * 100, 1)}くらいにすれば取引先は離れにくい（値上げの交渉が遅れると、その分の粗利を失います）。予約したレート：1ドル${fmtNum(op.fxLock || 148, 1)}円。</p>` : ''}`)}
      ${panel(`取引先（${op.customers.length}社）`, `<div class="tbl-wrap" style="max-height:420px;overflow:auto"><table class="t"><thead><tr><th>取引先</th><th class="n">月の取引額</th><th class="n">支払</th><th class="n">信用</th><th></th></tr></thead><tbody>${custRows}</tbody></table></div>
        <p class="note">信用はA（安全）〜D（倒産の心配）。取引をやめても、残っている売掛金は期日に回収します。</p>`)}
      ${P.trucks ? panel('配送', `${kv([['トラック', `${trucks.length}台（月に約${fmtYen(trucks.length * (op.truckCap || 1650e4) * ksPrice())}分を配送できる）`], ['配送の需要', `月に約${fmtYen(pot)}`], ['倉庫・配送の人員', `${u.staff.logi || 0}人（トラック1台に1.1人が目安）`]])}
        <div class="row" style="margin-top:10px">${btn('トラックを買う', 'kTradeTruck', { u: u.id }, 'primary')}${trucks.length > 1 ? btn('いちばん古いトラックを売る', 'kSellAsset', { id: trucks.slice().sort((a, b) => a.acqM - b.acqM)[0].id }, '') : ''}</div>`) : ''}
      ${ksStaffPanel(u, Object.assign({}, E.need(u)))}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, [`売上は大きいが粗利は${fmtPct(op.gm0 * 100, 0)}ほど。経費を粗利の内に抑えないと利益が出ません。`, `売ってから入金まで1〜2か月、仕入の支払は1か月後。売上が伸びるほど${term('運転資金', 'wc')}が必要になります。`, `決算では売掛金に${term('貸倒引当金', 'allowance')}を積みます。貸倒れが多いと引当の率も上がります。`])}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kCustDrop: d => { const u = ksUnit(d.u); const c = u.op.customers.find(x => x.id === d.id); if (!c) return; confirmBox('取引をやめる', `${esc(c.n)}との取引をやめます（月に約${fmtYen(c.size * ksPrice())}の取引）。残っている売掛金は期日に回収します。`, '取引をやめる', 'kCustDropGo', { u: u.id, id: c.id }, true); },
  kCustDropGo: d => { const u = ksUnit(d.u); const c = u.op.customers.find(x => x.id === d.id); if (c) { u.op.customers = u.op.customers.filter(x => x !== c); ksNews(`${c.n}との取引をやめました`, 'info'); } closeModal(true); render(); },
  kTradeTruck: d => { const u = ksUnit(d.u); const n = KS_ENGINE.trade.trucks(u).length + 1; const P = ksP(u); ksCapexOpen({ title: '配送トラックを買う', desc: `月に約${fmtYen((u.op.truckCap || 1650e4) * ksPrice())}分の商品を配送できます。倉庫・配送の人員も1人ほど増やしましょう。`, items: [{ n: `配送トラック ${n}号`, acct: 'veh', cost: Math.round((P.wh === '冷凍' || P.wh === '冷蔵' ? 650e4 : 480e4) * ksPrice()), life: 5, cap: u.op.truckCap, part: 'S', u: u.id }], fx: 'truck', arg: { u: u.id } }); },
});

/* =========================================================
 *  pro：人の力で稼ぐ
 * ========================================================= */
KS_OPS.pro = {
  params(u) {
    const op = u.op;
    const r0 = op.ref * ksPrice();
    return [
      { k: 'price', label: '単価（1人月あたり）', tk: '', min: Math.round(r0 * 0.75 / 1e4) * 1e4, max: Math.round(r0 * 1.4 / 1e4) * 1e4, step: Math.max(1e3, ksNiceStep(r0 * 0.65)), f: 'yen', help: '1人が1か月働いた分の請求額。上げると利益は増えるが、依頼が減る。' },
      { k: 'salaryLv', label: '給与水準', tk: 'laborShare', min: 0.9, max: 1.2, step: 0.01, f: 'lv', help: '100%が相場。下げると労務費は減るが、退職者が増える。上げると辞めにくくなる。' },
      { k: 'training', label: '研修費（月）', tk: '', min: 0, max: Math.max(60e4, op.training * 3), step: ksNiceStep(Math.max(60e4, op.training * 3)), f: 'yen', help: '技術力が上がり、同じ人数でも多くの仕事をこなせて評判も上がる。' },
    ];
  },
  kpiRows(u, k) {
    if (k.demand === undefined) return [];
    return [['仕事の依頼', `${fmtNum(k.demand, 1)}人月`], ['稼働できる人数', `${fmtNum(k.avail, 1)}人`], ['稼働率', fmtPct(k.util * 100, 0)], ['外注した仕事', `${fmtNum(k.sub, 1)}人月`], ['単価', fmtYen(k.price)], ['自社サービスの売上', k.svcSales ? fmtYen(k.svcSales) : '―'], ['一人当たり売上（月）', fmtYen(k.sales / Math.max(1, ksUnitHead(u)))]];
  },
  alerts(u) {
    const out = [];
    const k = ksKpiU(u);
    if (k.util !== undefined && k.util < 0.82) out.push({ ico: '稼', t1: `${ksUName(u)}：稼働率が${fmtPct(k.util * 100, 0)}です`, t2: '仕事のない人の給料も労務費（原価）になります。単価を下げて仕事を取るか、人員を調整しましょう', act: btn('現場へ', 'kGoUnit', { u: u.id }, 'sm') });
    else if (k.demand > k.avail * 1.15 && !u.op.outsource) out.push({ ico: '人', cls: 'warn', t1: `${ksUName(u)}：人手が足りず、依頼を断っています`, t2: '採用するか、外注を使いましょう。断り続けると評判が下がります', act: '' });
    if (u.op.salaryLv < 0.98) out.push({ ico: '給', cls: 'warn', t1: `${ksUName(u)}：給与が相場より低く、辞める人が増えています`, t2: '採用には費用がかかり、慣れるまで3か月かかります', act: '' });
    return out;
  },
  screen(u) {
    const op = u.op, P = ksP(u);
    const k = ksKpiU(u);
    let dev = '';
    if (P.product) {
      if (op.dev) dev = `<p style="margin:0 0 6px">「${esc(op.dev.name)}」を開発中：${op.dev.n}人・残り${op.dev.left}か月。これまでの開発費 <b>${fmtYen(op.dev.spent)}</b> は${term('ソフトウェア仮勘定', 'intangible')}（資産）に振り替えています。</p>${meter(op.dev.spent, op.dev.spent + op.dev.left * op.dev.n * P.wage * G.eco.wageIdx * op.salaryLv * 1.15, 'ok')}`;
      else if (op.svc) dev = `${kv([['サービス', esc(op.svc.name)], ['利用者', `${fmtNum(op.svc.users, 0)}社`], ['月額', `${fmtYen(op.svc.price)}／社`], ['月の売上', fmtYen(op.svc.users * op.svc.price)]])}<p class="note">完成したソフトウェアは5年で${term('減価償却', 'dep')}します（直接法）。</p>`;
      else dev = `<p class="small" style="margin:0 0 8px">仕事が少ないときは、人を自社サービスの開発に回せます。開発中の人件費は費用ではなく<b>資産</b>（ソフトウェア仮勘定）になり、完成後に5年で償却します。</p>${btn('自社サービスを開発する', 'kItDev', { u: u.id }, 'primary')}`;
    }
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, '受託の仕事', this.params(u), P.sub ? `<div class="row" style="margin-top:8px"><label class="inline small"><input type="checkbox" data-act="kOpToggle" data-u="${u.id}" data-k="outsource" ${op.outsource ? 'checked' : ''}> 人手が足りない分は外注に出す（単価の85%ほどを払う）</label></div>` : '')}
      ${dev ? panel('自社サービス', dev) : ''}
      ${ksStaffPanel(u, u.op.sales0 ? { sales: u.op.sales0 } : {}, { note: '新しく採用した人は、慣れるまでの3か月は力を出しきれません。' })}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, ['売上 ＝ 人月 × 単価。費用のほとんどは人件費で、労務費として売上原価に入ります。', `仕事がなくても給料はかかるので、${term('稼働率', 'utilization')}が利益を左右します。`, `在庫はなく、資産は売掛金と現預金が中心。${term('労働分配率', 'laborShare')}や${term('一人当たり売上', 'perHead')}も見られます。`])}
    </div></div>`;
  },
};
/* 完成後に毎月増える利用者（社）の見込み。値段が高いほど増えにくい */
function ksDevGrowth(d) { return d.n * d.months / 13.5 * (d.price <= 1e4 ? 1.6 : d.price <= 3e4 ? 1 : 0.45); }
ACTIONS.kItDev = d => { UI.kDev = { u: d.u, n: 3, months: 9, price: 3e4 }; showModal('kDev'); };
MODALS.kDev = () => {
  const d = UI.kDev;
  const u = ksUnit(d.u);
  const P = ksP(u);
  const cost = d.n * d.months * P.wage * G.eco.wageIdx * u.op.salaryLv * 1.15;
  const seg = (act, list, cur) => `<div class="seg wrap" role="radiogroup">${list.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const users = fmtNum(ksDevGrowth(d), 1);
  const body = `<p style="margin:0 0 10px">自社で使ってもらうクラウドのサービスを作ります。開発にあたる人は受託の仕事ができなくなります。</p>
    <div class="field"><span>開発にあたる人数</span>${seg('kDevN', [[2, '2人'], [3, '3人'], [4, '4人'], [6, '6人']], d.n)}</div>
    <div class="field" style="margin-top:8px"><span>開発の期間</span>${seg('kDevM', [[6, '6か月'], [9, '9か月'], [12, '12か月']], d.months)}</div>
    <div class="field" style="margin-top:8px"><span>月額の利用料（1社）</span>${seg('kDevP', [[1e4, '1万円'], [3e4, '3万円'], [5e4, '5万円']], d.price)}</div>
    <p class="small" style="margin-top:10px">開発費の見込み <b>${fmtYen(cost)}</b>。開発中は毎月、人件費を労務費から${term('ソフトウェア仮勘定', 'intangible')}に振り替えます（費用が減り、資産が増える）。完成すると${term('ソフトウェア', 'intangible')}になり、翌月から5年で償却します。完成後は毎月${users}社ほど利用者が増える見込み（値段が高いほど増えにくい）。</p>`;
  return modalFrame('自社サービスを開発する', body, btn('やめる', 'closeModal') + btn('開発を始める', 'kDevGo', {}, 'primary'), { size: 'narrow' });
};
Object.assign(ACTIONS, {
  kDevN: d => { UI.kDev.n = +d.v; drawModal(); },
  kDevM: d => { UI.kDev.months = +d.v; drawModal(); },
  kDevP: d => { UI.kDev.price = +d.v; drawModal(); },
  kDevGo: () => {
    const d = UI.kDev;
    const u = ksUnit(d.u);
    if (u.op.dev || (u.staff.eng || 0) < d.n + 2) { toast('人が足りません', 'bad'); return; }
    const names = ['シオミ勤怠', '港の在庫ナビ', 'まちの予約帳', 'クラウド請求書', 'しおみ見積', '現場日報クラウド'];
    const name = names[(u.op.pseqDev = (u.op.pseqDev || 0) + 1) % names.length];
    u.op.dev = { name, n: d.n, left: d.months, spent: 0, price: d.price, growth: ksDevGrowth(d) };
    ksNews(`${ksUName(u)}：自社サービス「${name}」の開発を始めました（${d.n}人・${d.months}か月）`, 'info');
    UI.kDev = null;
    closeModal(true);
    render();
  },
});

/* =========================================================
 *  subs：会員・利用者から稼ぐ
 * ========================================================= */
KS_OPS.subs = {
  params(u) {
    const op = u.op, P = ksP(u);
    const ps = [];
    if (op.ref > 0) ps.push({ k: 'arpu', label: '月額の料金（1人あたり）', tk: 'arpu', min: Math.max(1, Math.round(op.ref * ksPrice() * 0.6)), max: Math.round(op.ref * ksPrice() * 1.6), step: Math.max(1, ksNiceStep(op.ref * ksPrice())), f: 'yenh', help: '上げると1人あたりの売上は増えるが、新しい利用者が減り、解約が増える。' });
    const m0 = Math.max(10e4, op.users0 * P.churn * P.cac * 1.1);
    ps.push({ k: 'mkt', label: '利用者を増やす広告・販促（月）', tk: 'cac', min: 0, max: Math.round(m0 * 4 / 1e4) * 1e4, step: ksNiceStep(m0 * 4), f: 'yen', help: `新しい利用者1人を得るのに約${fmtYen(P.cac * ksPrice())}（獲得の費用）。増やすと利用者は増えるが、広告宣伝費がかさむ。` });
    ps.push({ k: 'content', label: '番組・記事・機能の開発の費用（月）', tk: '', min: Math.round(op.fixed0 * 0.4 / 1e4) * 1e4, max: Math.round(op.fixed0 * 2 / 1e4) * 1e4, step: ksNiceStep(op.fixed0 * 1.6), f: 'yen', help: '中身を良くすると、利用者が満足して解約が減り、口コミで増える。' });
    return ps;
  },
  kpiRows(u, k) {
    if (k.users === undefined) return [];
    const P = ksP(u);
    const ltv = k.churnR > 0 ? (k.sales / Math.max(1, k.users)) / k.churnR : 0;
    return [['利用者', `${fmtNum(k.users, 0)}人（＋${fmtNum(k.gain, 0)}・−${fmtNum(k.lost, 0)}）`], ['解約率（月）', fmtPct(k.churnR * 100, 2)], ['1人あたりの月の売上', `${fmtNum(k.sales / Math.max(1, k.users), 0)}円`], ['獲得の費用（1人）', k.cac ? `${fmtNum(k.cac, 0)}円` : '―'], ['生涯の売上（LTV）の目安', `${fmtNum(ltv, 0)}円`], ['設備の使用率', isFinite(k.cap) ? fmtPct(k.util * 100, 0) : '―'], ['品質の評価', fmtPct(k.quality * 100, 0)], P.ad ? ['広告の売上', fmtYen(k.adRev)] : null, P.take ? ['手数料の売上', fmtYen(k.feeRev)] : null].filter(Boolean);
  },
  alerts(u) {
    const out = [];
    const k = ksKpiU(u);
    if (isFinite(k.cap) && k.util > 0.95) out.push({ ico: '設', cls: 'warn', t1: `${ksUName(u)}：設備の能力がいっぱいです`, t2: '利用者を受け入れられず、解約も増えます。設備を増やしましょう', act: btn('現場へ', 'kGoUnit', { u: u.id }, 'sm') });
    if (k.churnR > ksP(u).churn * 1.5) out.push({ ico: '解', cls: 'warn', t1: `${ksUName(u)}：解約が増えています（月${fmtPct(k.churnR * 100, 1)}）`, t2: '料金が高い・中身が弱い・対応の人手が足りない、のどれかです', act: '' });
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.subs, op = u.op, S = ksS(u);
    const k = ksKpiU(u);
    const capEq = S.eq.length ? S.eq[0].k : null;
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, '料金と利用者の獲得', this.params(u), `<p class="note">会員の商売は、${term('解約率', 'churn')}と${term('獲得の費用', 'cac')}のバランスで決まります。1人の利用者から生涯に得る売上（${term('LTV', 'ltv')}）が獲得の費用を大きく上回れば、広告を増やすほどもうかります。</p>`)}
      ${S.eq.length ? panel('設備', `${ksEqTable(u, ksUA(u).filter(a => ksEqOf(a).e === 'subs'), { cap: a => (a.eq === capEq ? `${fmtNum(ksP(u).capPer, 0)}人分` : '') })}
        <p class="small">今の能力：利用者 ${fmtNum(E.capacity(u), 0)}人まで（利用者 ${fmtNum(op.users, 0)}人）</p>
        <div class="row" style="margin-top:6px">${btn('設備を増やす', 'kEqBuyOpen', { u: u.id }, 'primary')}</div>`) : ''}
      ${ksStaffPanel(u, E.need(u))}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, ['売上 ＝ 利用者 × 月額（＋広告・手数料）。毎月少しずつ解約されるので、増やし続けないと減っていきます。', '設備（サーバー・基地局・輪転機など）は大きな固定資産。利用者が増えるほど1人あたりの費用が下がります（規模の経済）。', '利用者の獲得に広告を使うと、最初は赤字でも、利用者が積み上がると利益が出る「ストック型」の商売です。'])}
    </div></div>`;
  },
};

/* =========================================================
 *  cap：施設を使ってもらう
 * ========================================================= */
KS_OPS.cap = {
  params(u) {
    const op = u.op, P = ksP(u);
    const r0 = op.ref * ksPrice();
    const ps = [{ k: 'price', label: `料金（1${P.unit}・${P.per === 'day' ? '1日' : P.per === 'mwh' ? 'MWh' : '1か月'}あたり）`, tk: 'occupancy', min: Math.max(1, Math.round(r0 * 0.7)), max: Math.round(r0 * 1.5), step: Math.max(1, ksNiceStep(r0 * 0.8)), f: 'yenh', help: '上げると1単位あたりの売上は増えるが、稼働率が下がる。' }];
    if (P.per !== 'mwh') ps.push({ k: 'ads', label: '広告・営業の費用（月）', tk: 'ads', min: 0, max: Math.max(20e4, Math.round(op.ads * 4 / 1e4) * 1e4), step: ksNiceStep(Math.max(20e4, op.ads * 4)), f: 'yen', help: '予約サイト・営業。稼働率が少し上がる。' });
    return ps;
  },
  kpiRows(u, k) {
    if (k.units === undefined) return [];
    const P = ksP(u);
    return [['能力', `${fmtNum(k.units, 0)}${esc(P.unit)}`], [P.per === 'mwh' ? '設備の利用率' : '稼働率', fmtPct(k.occ * 100, 1)], ['料金', `${fmtNum(k.price, 0)}円`], [`1${esc(P.unit)}あたりの月の売上`, fmtYen(k.revPer)], ['人員の充足', fmtPct(Math.min(1, k.staffF || 0) * 100, 0)], ['施設の平均の年数', `${fmtNum(k.ageY || 0, 1)}年`]];
  },
  alerts(u) {
    const out = [];
    const k = ksKpiU(u);
    if (k.staffF !== undefined && k.staffF < 0.9) out.push({ ico: '人', cls: 'warn', t1: `${ksUName(u)}：人手が足りず、稼働を落としています`, t2: '人員を増やしましょう', act: btn('人員へ', 'kGoUnit', { u: u.id }, 'sm') });
    if (k.occ > 0.9 && ksP(u).per !== 'mwh') out.push({ ico: '満', t1: `${ksUName(u)}：稼働率が${fmtPct(k.occ * 100, 0)}と高い水準です`, t2: '値上げか、施設の増設を考えるときです', act: '' });
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.cap, P = ksP(u);
    const k = ksKpiU(u);
    const fac = ksUA(u);
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, '料金と営業', this.params(u), `<p class="note">施設の商売は、${term('稼働率', 'occupancy')}×単価で売上が決まります。費用の多くは減価償却費・人件費などの固定費なので、稼働率が少し変わるだけで利益が大きく動きます。</p>`)}
      ${panel(`施設（能力 ${fmtNum(E.units(u), 0)}${esc(P.unit)}）`, `${ksEqTable(u, fac, { cap: a => (a.cap ? `${fmtNum(a.cap, 0)}${esc(ksEqOf(a).cu || P.unit)}` : '') })}
        <div class="row" style="margin-top:10px">${btn('施設を増やす（カタログ）', 'kEqBuyOpen', { u: u.id }, 'primary')}<span class="small muted">大きな施設は完成まで時間がかかります（それまでは建設仮勘定）。</span></div>`)}
      ${ksStaffPanel(u, E.need(u))}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, ['売上 ＝ 能力 × 稼働率 × 単価。', '建物・設備に大きなお金を先に払い、長い年数で回収する商売です。借入の期間を設備の耐用年数に合わせるのが基本。', `決算書では${term('有形固定資産', 'fa')}と${term('減価償却費', 'dep')}が大きくなります。銀行は${term('債務償還年数', 'dsy')}を見ます。`])}
    </div></div>`;
  },
};

/* =========================================================
 *  trans：人や物を運ぶ
 * ========================================================= */
KS_OPS.trans = {
  params(u) {
    const P = ksP(u);
    return [
      { k: 'fare', label: '運賃の水準', tk: 'loadFactor', min: 0.8, max: 1.3, step: 0.01, f: 'lv', help: '100%が相場。上げると1回あたりの売上は増えるが、積載率・乗車率が下がる。' },
      { k: 'ads', label: '営業・広告の費用（月）', tk: 'ads', min: 0, max: Math.max(20e4, Math.round(u.op.ads * 4 / 1e4) * 1e4), step: ksNiceStep(Math.max(20e4, u.op.ads * 4)), f: 'yen', help: '荷主の開拓・旅客の宣伝。' },
      { k: 'hedge', label: '燃料の価格の予約（ヘッジ）の割合', tk: 'fuelCost', min: 0, max: 0.8, step: 0.1, f: 'lv', help: '燃料の一部を今の価格で予約しておく。値上がりに強くなるが、値下がりしても得をしない。', after: x => { x.op.oilLock = G.eco.oil || 1; } },
    ].filter(p => p.k !== 'ads' || P.mode !== 'rail' || true);
  },
  kpiRows(u, k) {
    if (k.n === undefined) return [];
    const S = ksS(u);
    const cu = (KS_EQ[S.eq[0].k] || {}).cu || '';
    return [['車両・機体・船', `${k.n}`], ['輸送力（稼働の後）', `${fmtNum(k.cap || 0, 0)}${esc(cu)}`], [S.p.mode === 'truck' || S.p.mode === 'sea' ? '積載率' : '乗車率・搭乗率', fmtPct((k.lf || 0) * 100, 1)], ['燃料費の割合', fmtPct((k.fuelR || 0) * 100, 1)], ['乗務員の充足', fmtPct(Math.min(1, k.crewF || 0) * 100, 0)], ['燃料の価格（指数）', fmtNum((k.oil || 1) * 100, 0)], k.sur ? ['燃料サーチャージ', `${k.sur < 0 ? '<span class="neg">' : ''}${fmtYen(k.sur)}${k.sur < 0 ? '</span>' : ''}（運賃への上乗せ・月）`] : null, S.p.market > 0.1 ? ['運賃の市況（指数）', fmtNum((k.market || 1) * 100, 0)] : null].filter(Boolean);
  },
  alerts(u) {
    const out = [];
    const k = ksKpiU(u);
    if (k.crewF !== undefined && k.crewF < 0.9) out.push({ ico: '運', cls: 'warn', t1: `${ksUName(u)}：${ksS(u).roles[0].n}が足りず、運休・減便が出ています`, t2: '採用を増やしましょう。乗務員の長時間労働は事故と法令違反のもとです', act: btn('人員へ', 'kGoUnit', { u: u.id }, 'sm') });
    if ((k.fuelR || 0) > 0.3) out.push({ ico: '燃', t1: `${ksUName(u)}：燃料費が売上の${fmtPct(k.fuelR * 100, 0)}になっています`, t2: '燃料の値上がりは運賃に転嫁するか、予約（ヘッジ）で備えます', act: '' });
    return out;
  },
  screen(u) {
    const E = KS_ENGINE.trans, op = u.op;
    const k = ksKpiU(u);
    const fl = E.fleetAll(u);
    const others = ksUA(u).filter(a => !fl.includes(a));
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel(u, '運賃と営業', this.params(u), `<p class="note">予約した燃料の価格：指数${fmtNum((op.oilLock || 1) * 100, 0)}（今は${fmtNum((G.eco.oil || 1) * 100, 0)}）。</p>`)}
      ${panel(`車両・機体・船（${fl.length}）`, `${ksEqTable(u, fl, { cap: a => { const q = ksEqOf(a); return `${fmtNum(q.cap, q.cap < 10 ? 2 : 0)}${esc(q.cu || '')}`; } })}
        <div class="row" style="margin-top:10px">${btn('車両・機体・船を買う（カタログ）', 'kEqBuyOpen', { u: u.id }, 'primary')}<span class="small muted">高価な機体・船は納入まで時間がかかります。乗務員の採用も忘れずに。</span></div>`)}
      ${others.length ? panel('施設', ksEqTable(u, others, { sell: false })) : ''}
      ${ksStaffPanel(u, E.need(u))}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(u, k))}
      ${ksPointsPanel(u, ['売上 ＝ 輸送力 × 稼働 × 積載率（乗車率）× 運賃。', '燃料費・整備費・乗務員の人件費が大きい。燃料の値段の変動が利益を大きく動かします。', `車両・航空機・船は${term('車両運搬具', 'vehicle')}として償却します。大きな買い物は長期の借入やリースで手当てします。`])}
    </div></div>`;
  },
};

/* ---------- 社長室の「今月やること」に、事業ごとの知らせを加える ---------- */
function ksOpsAlerts() {
  const out = [];
  for (const u of ksActiveUnits()) { const o = KS_OPS[ksS(u).eng]; if (o && o.alerts) try { out.push(...o.alerts(u)); } catch (e) { console.error(e); } }
  return out;
}

/* ---------- 新しい事業を始める ---------- */
ACTIONS.kNewUnit = () => { UI.kNU = { q: '', sec: '', eng: '', sel: null, sc: 1, plan: null }; showModal('kNewUnit'); };
function ksNUList() {
  const N = UI.kNU;
  const own = new Set(ksActiveUnits().map(u => u.type));
  return ksSearchTypes(N.q, N.sec, N.eng, 80).filter(S => !own.has(S.name));
}
MODALS.kNewUnit = () => {
  const N = UI.kNU;
  const list = ksNUList();
  const secs = Object.entries(KS_SECTORS).map(([k, x]) => `<option value="${k}"${N.sec === k ? ' selected' : ''}>${esc(x.n)}（${ksCountTypes(k, N.eng)}）</option>`).join('');
  const engs = Object.entries(KS_ENG_INFO).map(([k, x]) => `<option value="${k}"${N.eng === k ? ' selected' : ''}>${esc(x.n)}</option>`).join('');
  const items = list.map(S => `<button type="button" class="typeopt${N.sel === S.name ? ' on' : ''}" data-act="kNUPick" data-v="${esc(S.name)}" aria-pressed="${N.sel === S.name}"><span class="indico" aria-hidden="true">${esc(S.icon)}</span><span><b>${esc(S.name)}</b><span class="small muted">${esc(S.grp)}・${esc(KS_ENG_INFO[S.eng].n)}</span></span></button>`).join('');
  let detail = '<div class="empty">左の一覧から業種を選ぶと、事業の中身と立ち上げの計画が出ます</div>';
  if (N.sel && KS_TYPES[N.sel]) {
    const S = KS_TYPES[N.sel];
    const pl = ksNUPlan();
    detail = `<h3 style="margin:0 0 4px">${esc(S.name)}</h3><div class="small muted">${esc(KS_SECTORS[S.sec].n)} ／ ${esc(S.grp)} ／ ${esc(KS_ENG_INFO[S.eng].n)}</div>
      <p class="small">${esc(S.d || KS_ENG_INFO[S.eng].desc)}</p>
      ${kv([S.prod.length ? ['商品・サービス', esc(S.prod.slice(0, 5).join('・'))] : null, S.cust.length ? ['お客さま', esc(S.cust.slice(0, 5).join('・'))] : null, S.eq.length ? ['主な設備', esc(S.eq.slice(0, 4).map(e => (KS_EQ[e.k] || {}).n).filter(Boolean).join('・'))] : null, ['職種', esc(S.roles.map(r => r.n.replace(/（.*?）/, '')).join('・'))], S.lic ? ['許認可', esc(S.lic.n)] : null, (S.laws || []).length ? ['関わる法令', esc(S.laws.map(l => (LAW_ITEMS[l] || { s: l }).s).join('・'))] : null].filter(Boolean))}
      <div class="field" style="margin-top:8px"><span>始める規模</span><div class="seg" role="radiogroup">${[[0.5, '小さく'], [1, 'ふつう'], [2, '大きく']].map(([v, l]) => `<button type="button" data-act="kNUSc" data-v="${v}" aria-pressed="${N.sc === v}">${l}</button>`).join('')}</div></div>
      ${pl ? `<div class="callout" style="margin-top:8px"><b>${esc(pl.title)}</b><br><span class="small">${esc(pl.desc)}</span><br><span class="small">初めの投資 <b>${fmtYen(sum(pl.items, x => x.cost) + (pl.deposit || 0))}</b>（${pl.items.length}件の設備${pl.deposit ? '・保証金' : ''}）</span></div>` : ''}`;
  }
  const body = `<div class="nuwrap"><div class="nuleft"><div class="row" style="gap:6px;flex-wrap:wrap"><input type="search" value="${esc(N.q)}" data-in="kNUq" placeholder="業種・商品・お客さまで探す（例：レーザー、データセンター、海運）" style="flex:1;min-width:12em" aria-label="業種を探す">
      <select data-ch="kNUsec" aria-label="産業"><option value="">すべての産業（${fmtNum(KS_TYPE_LIST.length, 0)}業種）</option>${secs}</select><select data-ch="kNUeng" aria-label="事業の型"><option value="">すべての型</option>${engs}</select></div>
      <div class="typelist" id="kNUlist">${items || '<div class="empty">見つかりません</div>'}</div></div>
    <div class="nuright">${detail}</div></div>`;
  return modalFrame('新しい事業を始める', body, btn('やめる', 'closeModal') + (N.sel ? btn('この事業の投資を検討する', 'kNUGo', {}, 'primary') : ''), { size: 'wide', sub: '業種を選んで、立ち上げの投資をします' });
};
/* 立ち上げの計画（下書きの事業をつくって計画を出す。まだ会社には加えない） */
function ksNUDraft() {
  const N = UI.kNU;
  if (N.draft && N.draft.type === N.sel && N.draft.sc === N.sc) return N.draft;
  const S = KS_TYPES[N.sel];
  const u = { id: 'U' + (G.useq + 1), type: S.name, n: null, sc: N.sc, op: {}, staff: {}, invB: {}, kpi: {}, startM: G.m };
  KS_ENGINE[S.eng].fresh(u);
  ksCalibFresh(u);
  N.draft = u;
  return u;
}
function ksNUPlan() { try { return KS_ENGINE[KS_TYPES[UI.kNU.sel].eng].plan(ksNUDraft()); } catch (e) { console.error(e); return null; } }
KS_CAPEX_PRE.unitStart = a => {
  const u = a.draft;
  if (ksUnit(u.id)) return;
  G.useq = Math.max(G.useq, +u.id.slice(1));
  u.startM = G.m;
  G.units.push(u);
  if (typeof ksLawAddUnit === 'function') ksLawAddUnit(u);
  UI.kUnit = u.id;
};
Object.assign(ACTIONS, {
  kNUPick: d => { UI.kNU.sel = d.v; UI.kNU.draft = null; drawModal(); },
  kNUSc: d => { UI.kNU.sc = +d.v; UI.kNU.draft = null; drawModal(); },
  kNUGo: () => {
    const N = UI.kNU;
    const u = ksNUDraft();
    const pl = KS_ENGINE[ksS(u).eng].plan(u);
    for (const x of pl.items) x.u = u.id;
    UI.kNU = null;
    closeModal(true);
    ksCapexOpen(Object.assign({}, pl, { title: `${ksS(u).name}を始める`, pre: 'unitStart', preArg: { draft: u }, fx: pl.fx === 'unitStart' ? 'unitStart' : pl.fx, arg: Object.assign({}, pl.arg, { u: u.id }) }));
  },
});
Object.assign(CHANGES, {
  kNUsec: el => { UI.kNU.sec = el.value; drawModal(); },
  kNUeng: el => { UI.kNU.eng = el.value; drawModal(); },
});
INPUTS.kNUq = el => {
  UI.kNU.q = el.value;
  const box = $('#kNUlist');
  if (!box) return;
  const N = UI.kNU;
  box.innerHTML = ksNUList().map(S => `<button type="button" class="typeopt${N.sel === S.name ? ' on' : ''}" data-act="kNUPick" data-v="${esc(S.name)}" aria-pressed="${N.sel === S.name}"><span class="indico" aria-hidden="true">${esc(S.icon)}</span><span><b>${esc(S.name)}</b><span class="small muted">${esc(S.grp)}・${esc(KS_ENG_INFO[S.eng].n)}</span></span></button>`).join('') || '<div class="empty">見つかりません</div>';
};

/* ---------- 事業から撤退する ---------- */
ACTIONS.kCloseUnit = d => showModal('kCloseUnit', { u: d.u });
MODALS.kCloseUnit = a => {
  const u = ksUnit(a.u);
  if (!u) return modalFrame('撤退', '', btn('閉じる', 'closeModal'));
  const pv = ksCloseUnitPreview(u);
  const body = `<p style="margin:0 0 8px">${esc(ksUName(u))}をやめます。設備を売り、従業員には退職金を払い、在庫は処分します。</p>
    ${kv([['設備の売却', `${pv.nA}件・帳簿価額 ${fmtYen(pv.bv)} → 売却額 約${fmtYen(pv.sale)}（差 ${fmtYen(pv.sale - pv.bv)} は固定資産売却損益：特別損益）`], ['在庫の処分', pv.inv ? `帳簿 ${fmtYen(pv.inv)} → 半値で売却 約${fmtYen(pv.inv / 2)}` : 'なし'], ['従業員', `${pv.head}人・退職金 約${fmtYen(pv.sev)}`], ['保証金の返還', pv.dep ? fmtYen(pv.dep) : 'なし'], pv.proj ? ['施工中の工事', `${pv.proj}件は他社に引き継ぎ（受け取った代金とかかった費用の差を精算）`] : null].filter(Boolean))}
    <p class="note">売掛金・買掛金は、期日どおりに回収・支払します。撤退した事業の今期の損益は、決算書のセグメント情報に残ります。</p>`;
  return modalFrame('事業から撤退する', body, btn('やめる', 'closeModal') + btn('撤退する', 'kCloseUnitGo', { u: u.id }, 'danger'), { size: 'narrow' });
};
ACTIONS.kCloseUnitGo = d => { if (ksClosingBlock()) return; const u = ksUnit(d.u); if (!u) return; const r = ksCloseUnit(u); toast(`${ksUName(u)}から撤退しました`); ksNews(`${ksUName(u)}から撤退しました（${r}）`, 'info'); UI.kUnit = null; closeModal(true); render(); autosave(); };
