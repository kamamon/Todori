'use strict';
/* =========================================================
 *  24_kaisha_ops.js : 会社経営モードの「現場」
 *   業種ごとの経営の判断（値段・人員・広告・在庫・設備投資・見積・取引先・自社サービス）と、
 *   設備投資の計画（銀行への相談つき）
 * ========================================================= */

const KS_OPS = {};
function ksKpiLast() { const x = G.months[G.months.length - 1]; return x ? x.kpi || {} : {}; }
const KS_FMT = {
  pct: v => fmtPct(v * 100, 1),
  lv: v => fmtPct(v * 100, 0),
  yen: v => fmtYen(v),
  days: v => `${fmtNum(v, 0)}日`,
  yenh: v => `${fmtNum(v, 0)}円`,
};
/* つまみ（範囲の入力） */
function ksCtl(p) {
  const v = G.op[p.k];
  return `<label class="ctl"><span class="ctl-l">${p.tk ? term(esc(p.label), p.tk) : esc(p.label)}</span>
    <span class="ctl-in"><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" data-ch="kOp" data-in="kOpLive" data-k="${p.k}" data-f="${p.f}" aria-label="${esc(p.label)}"><output class="num">${KS_FMT[p.f](v)}</output></span>
    <span class="small muted">${p.help}</span></label>`;
}
function ksParamsPanel(title, params, extra = '') {
  return panel(title, `<div class="ctls">${params.map(ksCtl).join('')}</div>${extra}`);
}
CHANGES.kOp = el => {
  const ops = KS_OPS[G.ind];
  const p = (ops.params || []).find(x => x.k === el.dataset.k);
  if (!p) return;
  const v = clamp(parseFloat(el.value), p.min, p.max);
  if (!isFinite(v)) return;
  G.op[p.k] = p.step >= 1 ? Math.round(v) : +v.toFixed(4);
  render();
};
INPUTS.kOpLive = el => { const o = el.parentElement.querySelector('output'); if (o) o.textContent = KS_FMT[el.dataset.f](parseFloat(el.value)); };
Object.assign(ACTIONS, {
  kOpToggle: d => { G.op[d.k] = !G.op[d.k]; render(); },
  kOpSet: d => { G.op[d.k] = d.v; render(); },
});

/* ---------- 人員 ---------- */
function ksHireCost(r) { return r.id === 'eng' ? 150e4 : r.wage < 15e4 ? 3e4 : 35e4; }
function ksStaffPanel(need = {}, opt = {}) {
  const I = ksI();
  const rows = I.roles.map(r => {
    const n = G.staff[r.id] || 0;
    const nd = need[r.id];
    const short = nd !== undefined && n < Math.round(nd) - 0.01;
    const big = r.wage < 15e4;
    return `<tr><td><b>${esc(r.n)}</b><div class="small muted">${esc(r.desc)}</div></td>
      <td class="n"><b class="${short ? 'neg' : ''}">${n}人</b>${nd !== undefined ? `<div class="small muted">目安 ${fmtNum(nd, 0)}人</div>` : ''}</td>
      <td class="n">${fmtYen(ksRoleWage(r))}<div class="small muted">${r.cost === 'labor' ? '労務費（原価）' : '給料手当（販管費）'}</div></td>
      <td class="n nowrap">${big ? btn('−5', 'kHire', { r: r.id, n: -5 }, 'sm', { disabled: n < 5 }) : ''}${btn('−1', 'kHire', { r: r.id, n: -1 }, 'sm', { disabled: n < 1 })}${btn('+1', 'kHire', { r: r.id, n: 1 }, 'sm')}${big ? btn('+5', 'kHire', { r: r.id, n: 5 }, 'sm') : ''}</td></tr>`;
  }).join('');
  const pe = ksPayrollEstimate();
  return panel('人員', `<div class="tbl-wrap"><table class="t"><thead><tr><th>職種</th><th class="n">人数</th><th class="n">月給（1人）</th><th class="n">採用・退職</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">人件費の目安は月${fmtYen(pe.total)}（賞与・社会保険料・役員報酬を含む平均）。採用には求人・紹介の費用（${I.roles.map(r => `${r.n.replace(/（.*?）/, '')} ${fmtYen(ksHireCost(r))}`).join('・')}）がかかり、人を減らすと退職金として給与1か月分がかかります。${opt.note || ''}</p>`);
}
ACTIONS.kHire = d => {
  const r = ksI().roles.find(x => x.id === d.r);
  const n = +d.n;
  if (!r || !n) return;
  const cur = G.staff[r.id] || 0;
  if (n > 0) {
    const cost = ksHireCost(r) * n;
    ksPayCash('recruit', cost, 'recruit');
    ksHire(r.id, n);
    if (r.id === 'eng') for (let i = 0; i < n; i++) G.op.hires.push(G.m);
    toast(`${r.n.replace(/（.*?）/, '')}を${n}人採用しました（採用費 ${fmtYen(cost)}）`);
  } else {
    const k = Math.min(cur, -n);
    if (k <= 0) return;
    const sev = Math.round(ksRoleWage(r) * k);
    ksPayCash(r.cost === 'labor' ? 'labor' : 'salary', sev, 'retire');
    ksHire(r.id, -k);
    toast(`${r.n.replace(/（.*?）/, '')}が${k}人退職しました（退職金 ${fmtYen(sev)}）`);
  }
  render();
};

/* ---------- 設備投資の計画（銀行への相談つき） ---------- */
/* o: { title, desc, items:[{n, acct, cost, life, part, cap, premium}], deposit, fx: 効果のキー, arg } */
function ksCapexOpen(o) {
  const total = sum(o.items, x => x.cost) + (o.deposit || 0);
  UI.kCapex = Object.assign({ fin: ksB('cash') >= total * 1.3 ? 'cash' : 'loan', bank: 'mirai', termM: 84, amt: Math.ceil(total / 1e6) * 1e6, cgc: false, res: null }, o, { total });
  showModal('kCapex');
}
const KS_CAPEX_FX = {
  retStore: () => { const names = ['駅前店', '北部店', '港南店', '学園店', '東店', '西店']; const n = names[(G.op.stores.length - 1) % names.length]; G.op.stores.push({ n, openM: G.m + 3, renovM: G.m + 3, fridgeM: G.m + 3 }); return `${n}は${ymLabel(G.m + 3)}に開店します（家賃は開店の前の月から）`; },
  retRenov: i => { G.op.stores[i].renovM = G.m; return `${G.op.stores[i].n}を改装しました`; },
  retFridge: i => { G.op.stores[i].fridgeM = G.m; return `${G.op.stores[i].n}の冷蔵・冷凍ケースを入れ替えました`; },
  foodShop: () => { const names = ['港店', '学園店', '中央店', '北部店']; const n = names[(G.op.shops.length - 2) % names.length]; G.op.shops.push({ n, openM: G.m + 3, renovM: G.m + 3, kitM: G.m + 3 }); return `${n}は${ymLabel(G.m + 3)}に開店します`; },
  foodRenov: i => { G.op.shops[i].renovM = G.m; return `${G.op.shops[i].n}を改装しました`; },
  foodKitchen: i => { G.op.shops[i].kitM = G.m; return `${G.op.shops[i].n}の厨房機器を入れ替えました`; },
  mfgMach: () => '新しい機械が稼働を始めました',
  whlTruck: () => '配送トラックを増やしました',
};
MODALS.kCapex = () => {
  const c = UI.kCapex;
  if (!c) return modalFrame('設備投資', '', btn('閉じる', 'closeModal'));
  const B = KS_BANKS[c.bank];
  const items = `<table class="t compact"><thead><tr><th>買うもの</th><th>勘定科目</th><th class="n">耐用年数</th><th class="n">金額</th></tr></thead><tbody>
    ${c.items.map(x => `<tr><td>${esc(x.n)}</td><td>${KS_ASSET_NAMES[x.acct]}</td><td class="n">${x.life ? x.life + '年' : '―'}</td><td class="n">${fmtYen(x.cost)}</td></tr>`).join('')}
    ${c.deposit ? `<tr><td>店舗の保証金（敷金）</td><td>差入保証金</td><td class="n">償却しない</td><td class="n">${fmtYen(c.deposit)}</td></tr>` : ''}
    <tr class="total"><td>合計</td><td></td><td></td><td class="n">${fmtYen(c.total)}</td></tr></tbody></table>`;
  const depY = sum(c.items, x => (x.life ? x.cost / x.life : 0));
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
    <p class="small">買った設備は費用ではなく<b>資産</b>（${term('固定資産', 'fa')}）になり、毎年${term('減価償却費', 'dep')}として約${fmtYen(depY)}ずつ費用になります。お金は今出ていくのに、費用は何年にも分かれる。このずれが「利益とお金は違う」理由のひとつです。</p>
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
    }
    if (ksB('cash') < c.total) { toast('現預金が足りません', 'bad'); drawModal(); return; }
    c.items.forEach((x, i) => ksBuyAsset(Object.assign({}, x, i === 0 && c.deposit ? { deposit: c.deposit } : {})));
    if (!c.items.length && c.deposit) ksPost('deposit', [['deposit', c.deposit, 0], ['cash', 0, c.deposit]], { cf: 'capex' });
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
function ksSalePrice(a) { return Math.round(Math.max(a.cost * 0.05, (a.cost - a.booked) * 0.8) / 1e4) * 1e4; }
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
ACTIONS.kSellGo = d => {
  const a = G.assets.find(x => x.id === d.id);
  if (!a || a.soldM !== undefined) return;
  const price = ksSalePrice(a);
  const gain = ksSellAsset(a, price);
  ksNews(`${a.n}を${fmtYen(price)}で売却しました（売却${gain >= 0 ? '益' : '損'} ${fmtYen(Math.abs(gain))}）`, 'info');
  toast(`${a.n}を売却しました`);
  closeModal(true);
  render();
};

/* ---------- 現場の画面（共通の骨組み） ---------- */
function ksKpiPanel(rows) { return panel('先月の現場の数字', rows.length ? kv(rows) : '<div class="empty">まだ締めた月はありません</div>'); }
KS_SCREENS.k_ops = () => {
  const ops = KS_OPS[G.ind];
  const I = ksI();
  return `<div class="kops"><h1 class="h1">現場</h1><p class="lead">${esc(I.label)}の経営判断をします。決めたことは今月から効き、月末に数字になって表れます。</p>${ops.screen()}</div>`;
};

/* =========================================================
 *  小売業
 * ========================================================= */
KS_OPS.ret = {
  params: [
    { k: 'markup', label: '値入率（粗利の目標）', tk: 'gpm', min: 0.2, max: 0.32, step: 0.005, f: 'pct', help: '上げると1品あたりの粗利が増えるが、値段が上がって客足が減る（1ポイントで約4%）。' },
    { k: 'invDays', label: '在庫の日数', tk: 'invDays', min: 6, max: 20, step: 1, f: 'days', help: '少ないと品切れで客が減り（9日未満）、多いと売れ残り・廃棄が増える。' },
    { k: 'ads', label: '広告宣伝費（1店・月）', tk: 'ads', min: 0, max: 100e4, step: 5e4, f: 'yen', help: 'チラシ・アプリのクーポン。客数を最大で7%ほど増やす。' },
  ],
  kpiRows(k) {
    if (!k.sales) return [];
    return [['1日の客数（全店）', `${fmtNum(k.cust, 0)}人`], ['客単価', `${fmtNum(k.spend, 0)}円`], ['売上総利益率（廃棄後）', fmtPct(k.gpr * 100, 1)], ['廃棄・ロス率', fmtPct(k.wasteRate * 100, 2)], ['人員の充足', fmtPct(Math.min(1.5, k.cap) * 100, 0)]];
  },
  alerts() {
    const out = [];
    const E = KS_ENGINE.ret;
    const cap = E.staffCap();
    if (cap < 0.95) out.push({ ico: '人', cls: 'warn', t1: '売場の人手が足りません', t2: `必要な人員の${fmtPct(cap * 100, 0)}しかいません。品出しやレジが回らず、客数が減り、廃棄も増えます`, act: btn('人員へ', 'kGo', { tab: 'k_ops' }, 'sm') });
    for (const s of E.storesOpen()) {
      if ((G.m - s.fridgeM) / 12 > 8) out.push({ ico: '冷', cls: 'warn', t1: `${s.n}の冷蔵ケースが${Math.floor((G.m - s.fridgeM) / 12)}年使われています`, t2: '古いケースは電気代と修理代がかさみ、廃棄も増えます。入れ替えを検討しましょう', act: btn('現場へ', 'kGo', { tab: 'k_ops' }, 'sm') });
      if ((G.m - s.renovM) / 12 > 10) out.push({ ico: '改', t1: `${s.n}は改装から${Math.floor((G.m - s.renovM) / 12)}年`, t2: '店が古くなると客足が少しずつ落ちます', act: '' });
    }
    return out;
  },
  screen() {
    const E = KS_ENGINE.ret;
    const op = G.op;
    const k = ksKpiLast();
    const p = ksPrice();
    const stores = op.stores.map((s, i) => {
      const open = s.openM <= G.m;
      const ra = (G.m - s.renovM) / 12, fa = (G.m - s.fridgeM) / 12;
      return `<tr><td><b>${esc(s.n)}</b>${open ? '' : ` ${tag(`${ymLabel(s.openM)}開店`, 'warn')}`}${s.comp && s.comp < 1 ? `<div class="small muted">近くに競合店（客数 ${fmtPct(s.comp * 100, 0)}）</div>` : ''}</td>
        <td class="n">${open ? `${Math.floor(Math.max(0, ra))}年` : '―'}</td><td class="n ${fa > 8 ? 'neg' : ''}">${open ? `${Math.floor(Math.max(0, fa))}年` : '―'}</td>
        <td class="n nowrap">${open ? btn('改装', 'kRetRenov', { i }, 'sm') + btn('冷蔵ケース更新', 'kRetFridge', { i }, 'sm') : ''}</td></tr>`;
    }).join('');
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel('売り方', this.params, `<p class="note">${term('値入率', 'gpm')}は、売値のうち粗利になる割合の目標です。実際の${term('売上総利益率', 'gpm')}は、廃棄や万引きのロスの分だけ低くなります。</p>`)}
      ${panel('店舗', `<div class="tbl-wrap"><table class="t"><thead><tr><th>店</th><th class="n">改装から</th><th class="n">冷蔵ケース</th><th class="n"></th></tr></thead><tbody>${stores}</tbody></table></div>
        <div class="row" style="margin-top:10px">${btn('新しい店を出す', 'kRetStore', {}, 'primary')}<span class="small muted">内装・冷蔵ケース・レジと保証金で約${fmtYen((8000e4 + 2400e4 + 900e4) * p + 3000e4)}。開店まで3か月。</span></div>`)}
      ${ksStaffPanel(E.need())}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(k))}
      ${panel('小売業のポイント', `<ul class="small" style="margin:0;padding-left:1.2em"><li>売上 ＝ 客数 × 客単価。</li><li>粗利から人件費・家賃・水道光熱費を払うと、利益は売上の1〜2%。粗利率が1ポイント違うと利益は大きく変わります。</li><li>お客さんの支払いは現金がほとんど。仕入代金は翌月払いなので、お金は回りやすい商売です。</li><li>決算の実地棚卸で、帳簿より在庫が少ない分（万引き・廃棄の漏れ）は${term('棚卸減耗損', 'shrink')}になります。</li></ul>`)}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kRetStore: () => { const p = ksPrice(); ksCapexOpen({ title: '新しい店を出す', desc: '新しい食品スーパーを出店します。開店から1年ほどで客足が定着します。必要な人員（正社員6人・パート20人）の採用も忘れずに。', items: [{ n: '新店の内装・設備', acct: 'bldg', cost: Math.round(8000e4 * p), life: 15 }, { n: '新店の冷蔵・冷凍ケース', acct: 'equip', cost: Math.round(2400e4 * p), life: 6 }, { n: '新店のレジ・POS', acct: 'equip', cost: Math.round(900e4 * p), life: 6 }], deposit: 3000e4, fx: 'retStore' }); },
  kRetRenov: d => { const s = G.op.stores[+d.i]; ksCapexOpen({ title: `${s.n}の改装`, desc: '売場を新しくすると、客足が戻ります（古い店ほど効果が大きい）。', items: [{ n: `${s.n}の改装工事`, acct: 'bldg', cost: Math.round(3000e4 * ksPrice()), life: 15 }], fx: 'retRenov', arg: +d.i }); },
  kRetFridge: d => { const s = G.op.stores[+d.i]; ksCapexOpen({ title: `${s.n}の冷蔵ケース更新`, desc: '省エネの新しい冷蔵・冷凍ケースにすると、電気代・修理代・廃棄が減ります。', items: [{ n: `${s.n}の冷蔵・冷凍ケース`, acct: 'equip', cost: Math.round(2400e4 * ksPrice()), life: 6 }], fx: 'retFridge', arg: +d.i }); },
});

/* =========================================================
 *  飲食業
 * ========================================================= */
KS_OPS.food = {
  params: [
    { k: 'price', label: 'メニューの価格の水準', tk: '', min: 0.85, max: 1.3, step: 0.01, f: 'lv', help: '100%が今の価格。上げると客単価は上がるが、客数が減る（10%の値上げで約13%）。' },
    { k: 'foodQ', label: '食材の原価率（料理の質）', tk: 'costRatio', min: 0.25, max: 0.4, step: 0.005, f: 'pct', help: '下げると利益は増えるが、料理の評判が少しずつ落ちて客が減る。' },
    { k: 'ads', label: '広告宣伝費（1店・月）', tk: 'ads', min: 0, max: 40e4, step: 1e4, f: 'yen', help: 'グルメサイトやSNSの広告。' },
  ],
  kpiRows(k) {
    if (!k.sales) return [];
    const x = G.months[G.months.length - 1];
    const fl = x ? (x.mg.cogs + (x.flow.salary || 0) + (x.flow.welfare || 0)) / Math.max(1, x.mg.sales) : 0;
    return [['1店1日の客数', `${fmtNum(k.cust, 0)}人`], ['客単価', `${fmtNum(k.spend, 0)}円`], ['食材原価率（廃棄込み）', fmtPct(k.foodRate * 100, 1)], ['FL比率（食材費＋人件費）', fmtPct(fl * 100, 1)], ['家賃比率', fmtPct(k.rentRate * 100, 1)], ['人員の充足', fmtPct(Math.min(1.5, k.cap) * 100, 0)]];
  },
  alerts() {
    const out = [];
    const E = KS_ENGINE.food;
    const cap = E.staffCap();
    if (cap < 0.95) out.push({ ico: '人', cls: 'warn', t1: '店の人手が足りません', t2: `必要な人員の${fmtPct(cap * 100, 0)}。料理の提供が遅れて客が減ります`, act: btn('人員へ', 'kGo', { tab: 'k_ops' }, 'sm') });
    for (const s of E.shopsOpen()) if ((G.m - s.kitM) / 12 > 7) out.push({ ico: '厨', cls: 'warn', t1: `${s.n}の厨房機器が古くなっています（${Math.floor((G.m - s.kitM) / 12)}年）`, t2: '故障が増え、修理代がかさみます', act: btn('現場へ', 'kGo', { tab: 'k_ops' }, 'sm') });
    return out;
  },
  screen() {
    const E = KS_ENGINE.food;
    const op = G.op;
    const k = ksKpiLast();
    const shops = op.shops.map((s, i) => {
      const open = s.openM <= G.m;
      return `<tr><td><b>${esc(s.n)}</b>${open ? '' : ` ${tag(`${ymLabel(s.openM)}開店`, 'warn')}`}</td><td class="n">${open ? `${Math.floor(Math.max(0, (G.m - s.renovM) / 12))}年` : '―'}</td><td class="n ${(G.m - s.kitM) / 12 > 7 ? 'neg' : ''}">${open ? `${Math.floor(Math.max(0, (G.m - s.kitM) / 12))}年` : '―'}</td>
        <td class="n nowrap">${open ? btn('改装', 'kFoodRenov', { i }, 'sm') + btn('厨房機器の更新', 'kFoodKitchen', { i }, 'sm') : ''}</td></tr>`;
    }).join('');
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel('メニューと料理', this.params, `<p class="note">飲食店の基本の指標は${term('FL比率', 'flRatio')}（食材費＋人件費÷売上）。60%以下が目安です。家賃は売上の10%以内が目安。</p>`)}
      ${panel('店舗', `<div class="tbl-wrap"><table class="t"><thead><tr><th>店</th><th class="n">改装から</th><th class="n">厨房機器</th><th class="n"></th></tr></thead><tbody>${shops}</tbody></table></div>
        <div class="row" style="margin-top:10px">${btn('新しい店を出す', 'kFoodShop', {}, 'primary')}<span class="small muted">内装・厨房機器・保証金で約${fmtYen((2500e4 + 900e4) * ksPrice() + 600e4)}。家賃は月${fmtYen(op.rentPer)}。</span></div>`)}
      ${ksStaffPanel(E.need())}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(k))}
      ${panel('飲食業のポイント', `<ul class="small" style="margin:0;padding-left:1.2em"><li>現金・カードで毎日お金が入る「日銭商売」。在庫は数日分。</li><li>家賃と人件費という固定費が重く、売上が1割落ちると利益が消えます（${term('損益分岐点', 'bep')}）。</li><li>食材の${term('原価率', 'costRatio')}は30%前後。決算では冷蔵庫の食材を数えて原価を確定します。</li></ul>`)}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kFoodShop: () => { const p = ksPrice(); ksCapexOpen({ title: '新しい店を出す', desc: '洋食店を新しく出します。開店から9か月ほどで客足が定着します。必要な人員（正社員3人・アルバイト8人）の採用も忘れずに。', items: [{ n: '新店の内装', acct: 'bldg', cost: Math.round(2500e4 * p), life: 15 }, { n: '新店の厨房機器', acct: 'equip', cost: Math.round(900e4 * p), life: 6 }], deposit: 600e4, fx: 'foodShop' }); },
  kFoodRenov: d => { const s = G.op.shops[+d.i]; ksCapexOpen({ title: `${s.n}の改装`, desc: '内装を新しくすると、客足が戻ります。', items: [{ n: `${s.n}の改装工事`, acct: 'bldg', cost: Math.round(1500e4 * ksPrice()), life: 15 }], fx: 'foodRenov', arg: +d.i }); },
  kFoodKitchen: d => { const s = G.op.shops[+d.i]; ksCapexOpen({ title: `${s.n}の厨房機器の更新`, desc: '冷蔵庫・コンロ・食洗機を入れ替えると、故障と修理代が減ります。', items: [{ n: `${s.n}の厨房機器`, acct: 'equip', cost: Math.round(900e4 * ksPrice()), life: 6 }], fx: 'foodKitchen', arg: +d.i }); },
});

/* =========================================================
 *  製造業
 * ========================================================= */
KS_OPS.mfg = {
  params: [
    { k: 'rate', label: '加工賃（1時間あたり）', tk: '', min: 4500, max: 8000, step: 50, f: 'yenh', help: '取引先に請求する加工の単価。上げると利益は増えるが、注文が他社に流れる。材料代は別に請求します。' },
    { k: 'ot', label: '残業（通常の時間に対する割合）', tk: '', min: 0, max: 0.3, step: 0.05, f: 'lv', help: '人手が足りないときに増やす。残業代は1.25倍で、労務費（原価）になります。' },
    { k: 'matDays', label: '材料の在庫日数', tk: 'invDays', min: 5, max: 40, step: 1, f: 'days', help: '多いと材料の値上がりに強いが、お金が在庫に寝る。' },
  ],
  kpiRows(k) {
    if (k.demand === undefined) return [];
    return [['注文（加工時間）', `${fmtNum(k.demand, 0)}時間`], ['生産能力', `${fmtNum(k.capacity, 0)}時間（機械 ${fmtNum(k.capM, 0)}・人 ${fmtNum(k.workerH * (1 + G.op.ot), 0)}）`], ['稼働率', fmtPct(k.util * 100, 0)], ['断った注文', k.short > 0.005 ? `<span class="neg">${fmtPct(k.short * 100, 0)}</span>` : 'なし'], ['外注した時間', `${fmtNum(k.extra || 0, 0)}時間`]];
  },
  alerts() {
    const out = [];
    const k = ksKpiLast();
    if (k.short > 0.05) out.push({ ico: '注', cls: 'warn', t1: `注文の${fmtPct(k.short * 100, 0)}を断りました`, t2: k.capM < k.workerH * (1 + G.op.ot) ? '機械が足りません。機械を増やすか、外注を使いましょう。断り続けると取引先の信頼が下がります' : '人手が足りません。製造スタッフを増やすか、残業を増やしましょう', act: btn('現場へ', 'kGo', { tab: 'k_ops' }, 'sm') });
    else if (k.util !== undefined && k.util < 0.7) out.push({ ico: '稼', t1: `工場の稼働率が${fmtPct(k.util * 100, 0)}に下がっています`, t2: '機械と人が遊んでいても、減価償却費と給料はかかります（固定費）。加工賃を見直すか、人員を調整しましょう', act: '' });
    const old = KS_ENGINE.mfg.machines().filter(a => G.m - a.acqM > 144).length;
    if (old) out.push({ ico: '機', t1: `12年を超えた古い機械が${old}台あります`, t2: '能力が落ち、故障しやすくなります', act: '' });
    return out;
  },
  screen() {
    const E = KS_ENGINE.mfg;
    const op = G.op;
    const k = ksKpiLast();
    const ms = E.machines().slice().sort((a, b) => a.acqM - b.acqM);
    const rows = ms.map(a => `<tr><td>${esc(a.n)}${a.premium ? ' <span class="tag ok">高精度</span>' : ''}</td><td class="n">${Math.floor((G.m - a.acqM) / 12)}年</td><td class="n">${a.cap || 200}時間${G.m - a.acqM > 144 ? '<div class="small neg">能力 9割</div>' : ''}</td><td class="n">${fmtYen(a.cost - a.booked)}</td><td class="n">${btn('売る', 'kSellAsset', { id: a.id }, 'sm')}</td></tr>`).join('');
    const need = { worker: (k.demand || op.base) / 150 / (1 + op.ot), office: 4 };
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel('受注と生産', this.params, `<div class="row" style="margin-top:8px"><label class="inline small"><input type="checkbox" data-act="kOpToggle" data-k="outsource" ${op.outsource ? 'checked' : ''}> 能力を超えた注文は外注に出す（加工賃の85%を払うので利益は薄いが、注文を断らずに済む）</label></div>`)}
      ${panel('機械', `<div class="tbl-wrap"><table class="t"><thead><tr><th>機械</th><th class="n">使った年数</th><th class="n">能力（月）</th><th class="n">帳簿価額</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="row" style="margin-top:10px">${btn('NC旋盤を買う', 'kMfgMach', { v: 'nc' }, 'primary')}${btn('高精度の5軸加工機を買う', 'kMfgMach', { v: 'five' })}</div>
        <p class="note">機械は${term('機械装置', 'machine')}（固定資産）として計上し、10年で${term('減価償却', 'dep')}します。工場の機械の償却費は製造原価に入ります。</p>`)}
      ${ksStaffPanel(need, { note: '製造スタッフ1人で月150時間の加工ができます。' })}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(k))}
      ${panel('製造業のポイント', `<ul class="small" style="margin:0;padding-left:1.2em"><li>代金の入金は約2か月後。材料代と給料が先に出ていくので${term('運転資金', 'wc')}が必要です。</li><li>工場の人の給料は${term('労務費', 'labor')}、電力料や工具は製造経費。これに材料費を合わせて${term('製造原価報告書', 'mfgCost')}を作ります。</li><li>${term('稼働率', 'utilization')}が下がると、製品1個あたりの固定費が重くなります。</li></ul>`)}
    </div></div>`;
  },
};
ACTIONS.kMfgMach = d => {
  const p = ksPrice();
  const n = KS_ENGINE.mfg.machines().length + 1;
  if (d.v === 'five') ksCapexOpen({ title: '5軸加工機を買う', desc: '複雑な形の部品を高い精度で削れる機械。能力が大きく、高精度の仕事が取れるので注文が6%ほど増えます。', items: [{ n: `5軸マシニングセンタ ${n}号機`, acct: 'mach', cost: Math.round(3500e4 * p), life: 10, part: 'C', cap: 260, premium: true }], fx: 'mfgMach' });
  else ksCapexOpen({ title: 'NC旋盤を買う', desc: '標準的な数値制御の旋盤。月220時間の加工ができます。', items: [{ n: `NC旋盤 ${n}号機`, acct: 'mach', cost: Math.round(1500e4 * p), life: 10, part: 'C', cap: 220 }], fx: 'mfgMach' });
};

/* =========================================================
 *  建設業
 * ========================================================= */
KS_OPS.con = {
  params: [
    { k: 'margin', label: '見積の利益率（標準）', tk: 'gpm', min: 0.1, max: 0.35, step: 0.01, f: 'pct', help: '見積の原価に上乗せする利益の割合。新しい見積依頼の初期値になります。' },
    { k: 'ads', label: '広告宣伝費（月）', tk: 'ads', min: 0, max: 100e4, step: 5e4, f: 'yen', help: '見学会・チラシ・Web。見積依頼が増える。' },
  ],
  kpiRows(k) {
    if (k.backlog === undefined) return [];
    return [['受注残（未完成の工事の請負金額）', fmtYen(k.backlog)], ['施工中の工事', `${k.active}件`], ['今月の完成', `${k.completed}件（${fmtYen(k.doneSales)}）`], ['今月の受注', `${k.won}件`], ['現場の負荷', fmtPct(k.loadR * 100, 0)]];
  },
  alerts() {
    const out = [];
    const E = KS_ENGINE.con;
    if (G.op.bids.length) out.push({ ico: '見', t1: `見積の依頼が${G.op.bids.length}件届いています`, t2: '利益率を決めて見積を出します（今月末に結果が出ます）。出さない依頼は「見送る」に', act: btn('見積へ', 'kGo', { tab: 'k_ops' }, 'sm primary') });
    const lr = E.load() / Math.max(1, E.loadCap());
    if (lr > 1.05) out.push({ ico: '監', cls: 'warn', t1: '現場監督が足りません', t2: `現場の負荷が${fmtPct(lr * 100, 0)}。手直しが増え、原価が膨らみ、評判も下がります`, act: btn('人員へ', 'kGo', { tab: 'k_ops' }, 'sm') });
    return out;
  },
  screen() {
    const E = KS_ENGINE.con;
    const op = G.op;
    const k = ksKpiLast();
    const bids = op.bids.map(b => {
      const winP = E.winP(b.margin, null);
      return `<tr class="${b.on ? '' : 'muted'}"><td><b>${esc(b.client)}</b><div class="small muted">${esc(b.n)}・工期${b.dur}か月</div></td><td class="n">${fmtYen(b.est)}</td>
        <td class="n"><span class="nowrap">${btn('−', 'kBidM', { id: b.id, d: -0.02 }, 'sm')}<b class="num" style="display:inline-block;min-width:3.6em;text-align:center">${fmtPct(b.margin * 100, 0)}</b>${btn('＋', 'kBidM', { id: b.id, d: 0.02 }, 'sm')}</span></td>
        <td class="n">${fmtYen(niceAmount(b.est * (1 + b.margin)))}</td><td class="n">${b.on ? `約${fmtPct(Math.round(winP * 10) * 10, 0)}` : '―'}</td><td class="n">${btn(b.on ? '見送る' : '見積を出す', 'kBidOn', { id: b.id }, 'sm')}</td></tr>`;
    }).join('');
    const projs = op.projects.filter(p => !p.fin).sort((a, b) => a.startM - b.startM).map(p => {
      const kk = G.m - p.startM;
      const started = kk >= 0;
      const prog = started ? Math.min(1, (kk) / p.dur) : 0;
      return `<tr><td><b>${esc(p.client)}</b><div class="small muted">${esc(p.n)}${p.over ? ' <span class="tag bad">手直し発生</span>' : ''}</div></td><td class="n">${fmtYen(p.contract)}</td><td>${started ? meter(prog * 100, 100, 'ok') : '<span class="small muted">着工前</span>'}<div class="small muted">${started ? `${kk}/${p.dur}か月` : `${ymLabel(p.startM)}着工`}</div></td>
        <td class="n">${fmtYen(p.costToDate)}<div class="small muted">予定 ${fmtYen(p.cost)}</div></td><td class="n">${fmtYen(p.recv)}</td><td class="n">${ymLabel(p.startM + p.dur - 1)}</td></tr>`;
    }).join('');
    const need = { site: E.load() / 3, office: 3 };
    return `<div class="grid g-side"><div class="stack">
      ${panel(`今月の見積依頼（${op.bids.length}件）`, op.bids.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>お客さま</th><th class="n">見積の原価</th><th class="n">利益率</th><th class="n">請負金額</th><th class="n">受注の見込み</th><th></th></tr></thead><tbody>${bids}</tbody></table></div>
        <p class="note">利益率を上げると1件の利益は増えますが、他社に負けやすくなります。受注の見込みは相場から見た目安です。現場監督1人で同時に3件ほど（大きな工事は2件分）を見られます。見積の原価どおりに工事が終わるとは限りません。</p>` : '<div class="empty">今月の見積依頼はありません。来月を待ちましょう。</div>')}
      ${panel('施工中の工事', projs ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>工事</th><th class="n">請負金額</th><th>進み具合</th><th class="n">かかった原価</th><th class="n">受け取った代金</th><th class="n">完成予定</th></tr></thead><tbody>${projs}</tbody></table></div>
        <p class="note">完成するまで、かかった原価は${term('未成工事支出金', 'wip')}（資産）、受け取った代金は${term('未成工事受入金', 'advRecv')}（負債）にためておき、引き渡した月にまとめて${term('完成工事高', 'conRev')}と${term('完成工事原価', 'conCost')}にします（${term('工事完成基準', 'completion')}）。</p>` : '<div class="empty">施工中の工事はありません</div>')}
      ${ksParamsPanel('営業', this.params)}
      ${ksStaffPanel(need)}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(k))}
      ${panel('建設業のポイント', `<ul class="small" style="margin:0;padding-left:1.2em"><li>工事代金は契約・着工・中間・完成に分けて入り、材料費・外注費は毎月出ていきます。工事が重なると${term('運転資金', 'wc')}（つなぎ資金）が必要です。</li><li>工事完成基準では、完成した月にまとめて売上が立つので、月次の損益は大きく波打ちます。${term('受注残', 'backlog')}も見ましょう。</li><li>赤字の工事を未成工事支出金のまま先送りしていないか、銀行はよく見ています。</li></ul>`)}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kBidM: d => { const b = G.op.bids.find(x => x.id === d.id); if (b) { b.margin = +clamp(b.margin + +d.d, 0.04, 0.45).toFixed(2); render(); } },
  kBidOn: d => { const b = G.op.bids.find(x => x.id === d.id); if (b) { b.on = !b.on; render(); } },
});
/* 標準の利益率を変えたら、今月の見積にも反映する */
const ksConSetMargin = CHANGES.kOp;
CHANGES.kOp = el => {
  if (G.ind === 'con' && el.dataset.k === 'margin') { const v = clamp(parseFloat(el.value), 0.1, 0.35); if (isFinite(v)) for (const b of G.op.bids) b.margin = +v.toFixed(2); }
  ksConSetMargin(el);
};

/* =========================================================
 *  卸売業
 * ========================================================= */
function ksCustRating(pd) { return pd < 0.6 ? ['A', 'ok'] : pd < 1.2 ? ['B', ''] : pd < 2.5 ? ['C', 'warn'] : ['D', 'bad']; }
KS_OPS.whl = {
  params: [
    { k: 'margin', label: '売値に乗せる粗利率', tk: 'gpm', min: 0.08, max: 0.18, step: 0.005, f: 'pct', help: '上げると1件あたりの粗利は増えるが、取引量が減り、他の卸に移る取引先も出る。' },
    { k: 'invDays', label: '在庫の日数', tk: 'invDays', min: 8, max: 30, step: 1, f: 'days', help: '多いと欠品はしないが、お金が在庫に寝る。' },
  ],
  kpiRows(k) {
    if (k.sales === undefined) return [];
    return [['取引先', `${k.customers}社`], ['配送能力の使用率', fmtPct(k.sales / Math.max(1, k.cap) * 100, 0)], ['粗利率（廃棄後）', fmtPct(k.gpr * 100, 1)], ['新しい取引先', `${k.nNew}社`], ['貸倒れ', k.bad ? `<span class="neg">${fmtYen(k.bad)}</span>` : 'なし']];
  },
  alerts() {
    const out = [];
    const E = KS_ENGINE.whl;
    const pot = sum(G.op.customers, c => c.size * c.ramp) * ksPrice();
    if (E.capacity() < pot * 0.98) out.push({ ico: '配', cls: 'warn', t1: '配送が追いつきません', t2: 'トラックか倉庫・配送の人員が足りず、注文の一部に応えられていません。取引先が離れていきます', act: btn('現場へ', 'kGo', { tab: 'k_ops' }, 'sm') });
    const risky = G.op.customers.filter(c => c.pd >= 2.5).length;
    if (risky) out.push({ ico: '与', t1: `信用の低い取引先（D）が${risky}社あります`, t2: '倒産すると売掛金が回収できません（貸倒れ）。取引の継続を検討しましょう', act: '' });
    return out;
  },
  screen() {
    const E = KS_ENGINE.whl;
    const op = G.op;
    const k = ksKpiLast();
    const trucks = E.trucks();
    const pot = sum(op.customers, c => c.size * c.ramp) * ksPrice();
    const cs = op.customers.slice().sort((a, b) => b.size - a.size);
    const custRows = cs.map(c => { const [r, cls] = ksCustRating(c.pd); return `<tr><td><b>${esc(c.n)}</b><div class="small muted">${esc(c.kind)}・取引${fmtNum(Math.max(0, (G.m - c.since) / 12), 0)}年</div></td><td class="n">${fmtYen(c.size * ksPrice())}</td><td class="n">${c.terms === 2 ? '翌々月末' : '翌月末'}</td><td class="n">${tag(r, cls)}</td><td class="n">${btn('取引をやめる', 'kCustDrop', { id: c.id }, 'sm')}</td></tr>`; }).join('');
    const pol = [['strict', '厳しく'], ['std', '普通'], ['loose', '甘く']];
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel('売り方', this.params, `<div class="field" style="margin-top:10px"><span>${term('与信', 'pd')}の方針（新しい取引先の選び方）</span><div class="seg" role="radiogroup">${pol.map(([v, l]) => `<button type="button" data-act="kOpSet" data-k="policy" data-v="${v}" aria-pressed="${op.policy === v}">${l}</button>`).join('')}</div>
        <span class="small muted">甘くすると取引先は増えるが、支払の遅い先や倒産しそうな先も増える。厳しくすると増えにくいが、貸倒れは減る。</span></div>`)}
      ${panel(`取引先（${op.customers.length}社）`, `<div class="tbl-wrap" style="max-height:420px;overflow:auto"><table class="t"><thead><tr><th>取引先</th><th class="n">月の取引額</th><th class="n">支払</th><th class="n">信用</th><th></th></tr></thead><tbody>${custRows}</tbody></table></div>
        <p class="note">信用はA（安全）〜D（倒産の心配）。取引をやめても、残っている売掛金は期日に回収します。</p>`)}
      ${panel('配送', `${kv([['トラック', `${trucks.length}台（月に約${fmtYen(trucks.length * 1650e4 * ksPrice())}分を配送できる）`], ['配送の需要', `月に約${fmtYen(pot)}`], ['倉庫・配送の人員', `${G.staff.logi}人（トラック1台に1.1人が目安）`]])}
        <div class="row" style="margin-top:10px">${btn('トラックを買う', 'kWhlTruck', {}, 'primary')}${trucks.length > 1 ? btn('いちばん古いトラックを売る', 'kSellAsset', { id: trucks.slice().sort((a, b) => a.acqM - b.acqM)[0].id }, '') : ''}</div>`)}
      ${ksStaffPanel({ logi: trucks.length * 1.1 })}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(k))}
      ${panel('卸売業のポイント', `<ul class="small" style="margin:0;padding-left:1.2em"><li>売上は大きいが粗利は1割ほど。経費を売上の1割以内に抑えないと利益が出ません。</li><li>売ってから入金まで1〜2か月、仕入の支払は1か月後。売上が伸びるほど${term('運転資金', 'wc')}が必要になります。</li><li>決算では売掛金に${term('貸倒引当金', 'allowance')}を積みます。貸倒れが多いと引当の率も上がります。</li></ul>`)}
    </div></div>`;
  },
};
Object.assign(ACTIONS, {
  kCustDrop: d => { const c = G.op.customers.find(x => x.id === d.id); if (!c) return; confirmBox('取引をやめる', `${esc(c.n)}との取引をやめます（月に約${fmtYen(c.size * ksPrice())}の取引）。残っている売掛金は期日に回収します。`, '取引をやめる', 'kCustDropGo', { id: c.id }, true); },
  kCustDropGo: d => { const c = G.op.customers.find(x => x.id === d.id); if (c) { G.op.customers = G.op.customers.filter(x => x !== c); ksNews(`${c.n}との取引をやめました`, 'info'); } closeModal(true); render(); },
  kWhlTruck: () => { const n = KS_ENGINE.whl.trucks().length + 1; ksCapexOpen({ title: '配送トラックを買う', desc: '冷蔵の配送トラック。月に約1,650万円分の商品を配送できます。倉庫・配送の人員も1人ほど増やしましょう。', items: [{ n: `配送トラック ${n}号`, acct: 'veh', cost: Math.round(480e4 * ksPrice()), life: 5, cap: 1650e4 }], fx: 'whlTruck' }); },
});

/* =========================================================
 *  情報通信業
 * ========================================================= */
KS_OPS.it = {
  params: [
    { k: 'price', label: '人月単価', tk: '', min: 60e4, max: 110e4, step: 1e4, f: 'yen', help: 'エンジニア1人が1か月働いた分の請求額。上げると利益は増えるが、仕事の依頼が減る。' },
    { k: 'salaryLv', label: 'エンジニアの給与水準', tk: 'laborShare', min: 0.9, max: 1.2, step: 0.01, f: 'lv', help: '100%が相場。下げると労務費は減るが、退職者が増える。上げると辞めにくくなる。' },
    { k: 'training', label: '研修費（月）', tk: '', min: 0, max: 60e4, step: 5e4, f: 'yen', help: '技術力が上がり、同じ人数でも多くの仕事をこなせて評判も上がる。' },
  ],
  kpiRows(k) {
    if (k.demand === undefined) return [];
    return [['仕事の依頼', `${fmtNum(k.demand, 1)}人月`], ['稼働できる人数', `${fmtNum(k.avail, 1)}人`], ['稼働率', fmtPct(k.util * 100, 0)], ['外注した仕事', `${fmtNum(k.sub, 1)}人月`], ['人月単価', fmtYen(k.price)], ['自社サービスの売上', k.svcSales ? fmtYen(k.svcSales) : '―'], ['一人当たり売上（月）', fmtYen(k.sales / Math.max(1, ksHeadcount()))]];
  },
  alerts() {
    const out = [];
    const k = ksKpiLast();
    if (k.util !== undefined && k.util < 0.85) out.push({ ico: '稼', t1: `エンジニアの稼働率が${fmtPct(k.util * 100, 0)}です`, t2: '仕事のない人の給料も労務費（原価）になります。単価を下げて仕事を取るか、自社サービスの開発に回しましょう', act: btn('現場へ', 'kGo', { tab: 'k_ops' }, 'sm') });
    else if (k.demand > k.avail * 1.15 && !G.op.outsource) out.push({ ico: '人', cls: 'warn', t1: '人手が足りず、依頼を断っています', t2: 'エンジニアを採用するか、外注を使いましょう。断り続けると評判が下がります', act: '' });
    if (G.op.salaryLv < 0.98) out.push({ ico: '給', cls: 'warn', t1: '給与が相場より低く、辞める人が増えています', t2: '採用には1人150万円かかり、慣れるまで3か月かかります', act: '' });
    return out;
  },
  screen() {
    const op = G.op;
    const k = ksKpiLast();
    let dev;
    if (op.dev) dev = `<p style="margin:0 0 6px">「${esc(op.dev.name)}」を開発中：エンジニア${op.dev.n}人・残り${op.dev.left}か月。これまでの開発費 <b>${fmtYen(op.dev.spent)}</b> は${term('ソフトウェア仮勘定', 'intangible')}（資産）に振り替えています。</p>${meter(op.dev.spent, op.dev.spent + op.dev.left * op.dev.n * 38e4 * G.eco.wageIdx * op.salaryLv * 1.15, 'ok')}`;
    else if (op.svc) dev = `${kv([['サービス', esc(op.svc.name)], ['利用者', `${fmtNum(op.svc.users, 0)}社`], ['月額', `${fmtYen(op.svc.price)}／社`], ['月の売上', fmtYen(op.svc.users * op.svc.price)]])}<p class="note">完成したソフトウェアは5年で${term('減価償却', 'dep')}します（直接法）。</p>`;
    else dev = `<p class="small" style="margin:0 0 8px">受託の仕事が少ないときは、エンジニアを自社サービスの開発に回せます。開発中の人件費は費用ではなく<b>資産</b>（ソフトウェア仮勘定）になり、完成後に5年で償却します。</p>${btn('自社サービスを開発する', 'kItDev', {}, 'primary')}`;
    return `<div class="grid g-side"><div class="stack">
      ${ksParamsPanel('受託開発', this.params, `<div class="row" style="margin-top:8px"><label class="inline small"><input type="checkbox" data-act="kOpToggle" data-k="outsource" ${op.outsource ? 'checked' : ''}> 人手が足りない分は外注に出す（1人月 ${fmtYen(68e4 * ksPrice())} を払う）</label></div>`)}
      ${panel('自社サービス', dev)}
      ${ksStaffPanel({}, { note: '新しく採用したエンジニアは、慣れるまでの3か月は力を出しきれません。' })}
    </div><div class="stack">${ksKpiPanel(this.kpiRows(k))}
      ${panel('情報通信業のポイント', `<ul class="small" style="margin:0;padding-left:1.2em"><li>売上 ＝ 人月 × 単価。費用のほとんどはエンジニアの人件費で、${term('労務費', 'labor')}として売上原価に入ります。</li><li>仕事がなくても給料はかかるので、${term('稼働率', 'utilization')}が利益を左右します。</li><li>在庫はなく、資産は売掛金と現預金が中心。${term('労働分配率', 'laborShare')}や${term('一人当たり売上', 'perHead')}も見られます。</li></ul>`)}
    </div></div>`;
  },
};
/* 完成後に毎月増える利用者（社）の見込み。値段が高いほど増えにくい */
function ksDevGrowth(d) { return d.n * d.months / 13.5 * (d.price <= 1e4 ? 1.6 : d.price <= 3e4 ? 1 : 0.45); }
ACTIONS.kItDev = () => { UI.kDev = { n: 3, months: 9, price: 3e4 }; showModal('kDev'); };
MODALS.kDev = () => {
  const d = UI.kDev;
  const cost = d.n * d.months * 38e4 * G.eco.wageIdx * G.op.salaryLv * 1.15;
  const seg = (act, list, cur) => `<div class="seg wrap" role="radiogroup">${list.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const users = fmtNum(ksDevGrowth(d), 1);
  const body = `<p style="margin:0 0 10px">自社で使ってもらうクラウドのサービスを作ります。開発にあたるエンジニアは受託の仕事ができなくなります。</p>
    <div class="field"><span>開発にあたるエンジニア</span>${seg('kDevN', [[2, '2人'], [3, '3人'], [4, '4人'], [6, '6人']], d.n)}</div>
    <div class="field" style="margin-top:8px"><span>開発の期間</span>${seg('kDevM', [[6, '6か月'], [9, '9か月'], [12, '12か月']], d.months)}</div>
    <div class="field" style="margin-top:8px"><span>月額の利用料（1社）</span>${seg('kDevP', [[1e4, '1万円'], [3e4, '3万円'], [5e4, '5万円']], d.price)}</div>
    <p class="small" style="margin-top:10px">開発費の見込み <b>${fmtYen(cost)}</b>。開発中は毎月、エンジニアの人件費を労務費から${term('ソフトウェア仮勘定', 'intangible')}に振り替えます（費用が減り、資産が増える）。完成すると${term('ソフトウェア', 'intangible')}になり、翌月から5年で償却します。完成後は毎月${users}社ほど利用者が増える見込み（値段が高いほど増えにくい）。</p>`;
  return modalFrame('自社サービスを開発する', body, btn('やめる', 'closeModal') + btn('開発を始める', 'kDevGo', {}, 'primary'), { size: 'narrow' });
};
Object.assign(ACTIONS, {
  kDevN: d => { UI.kDev.n = +d.v; drawModal(); },
  kDevM: d => { UI.kDev.months = +d.v; drawModal(); },
  kDevP: d => { UI.kDev.price = +d.v; drawModal(); },
  kDevGo: () => {
    const d = UI.kDev;
    if (G.op.dev || (G.staff.eng || 0) < d.n + 2) { toast('エンジニアが足りません', 'bad'); return; }
    const names = ['シオミ勤怠', '港の在庫ナビ', 'まちの予約帳', 'クラウド請求書'];
    const name = names[(G.op.pseqDev = (G.op.pseqDev || 0) + 1) % names.length];
    const growth = ksDevGrowth(d);
    G.op.dev = { name, n: d.n, left: d.months, spent: 0, price: d.price, growth };
    ksNews(`自社サービス「${name}」の開発を始めました（エンジニア${d.n}人・${d.months}か月）`, 'info');
    UI.kDev = null;
    closeModal(true);
    render();
  },
});
