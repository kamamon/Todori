'use strict';
/* =========================================================
 *  16_learn.js : 学習サポート
 *   - 用語のリンク（term）と解説カード、用語集
 *   - 決算書の読み方ガイド（審査の手順。どこを見るかを順に示し、表の行を光らせる）
 *   銀行の稟議書と、会社経営モードの決算書の両方で使う。
 * ========================================================= */

/* ---------- 用語のリンク ---------- */
function term(label, key, cls = '') {
  const t = TERMS[key];
  if (!t) return label;
  return `<button type="button" class="term${cls ? ' ' + cls : ''}" data-act="term" data-k="${key}" data-tip="${esc(t.s)}">${label}</button>`;
}
/* 表の見出しなど、文字列から用語を引く（完全一致） */
const TERM_BY_NAME = (() => {
  const m = {};
  for (const k of Object.keys(TERMS)) m[TERMS[k].n] = k;
  return m;
})();
function termAuto(label, key) { return term(esc(label), key || TERM_BY_NAME[label]); }

MODALS.term = a => {
  const t = TERMS[a.k];
  if (!t) return modalFrame('用語', '<p>見つかりません</p>', btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
  const cat = (TERM_CATS.find(c => c[0] === t.c) || [0, ''])[1];
  const see = (t.see || []).filter(k => TERMS[k]);
  const body = `<div class="termcard">
    <p class="lead">${t.s}</p>
    ${t.b ? `<p>${t.b}</p>` : ''}
    ${t.f ? `<div class="formula">${esc(t.f)}</div>` : ''}
    ${t.p ? `<div class="lookhere"><b>決算書のここを見る</b><p>${t.p}</p></div>` : ''}
    ${t.g ? `<p class="small"><b>目安：</b>${t.g}</p>` : ''}
    ${see.length ? `<div class="see"><span class="small muted">関連する用語</span><div class="chips">${see.map(k => `<button type="button" class="chip" data-act="term" data-k="${k}">${esc(TERMS[k].n)}</button>`).join('')}</div></div>` : ''}
  </div>`;
  return modalFrame(esc(t.n), body, btn('用語集', 'glossary') + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow', sub: esc(cat) });
};

function glossList(cat, q) {
  const qq = (q || '').trim();
  const keys = TERM_KEYS.filter(k => {
    const t = TERMS[k];
    if (cat !== 'all' && t.c !== cat) return false;
    return !qq || (t.n + t.s + (t.b || '') + (t.p || '')).includes(qq);
  });
  if (qq) keys.sort((a, b) => (TERMS[b].n.includes(qq) ? 1 : 0) - (TERMS[a].n.includes(qq) ? 1 : 0));
  if (!keys.length) return '<div class="empty">見つかりませんでした</div>';
  return `<ul class="glist">${keys.map(k => `<li><button type="button" class="gitem" data-act="term" data-k="${k}"><b>${esc(TERMS[k].n)}</b><span>${TERMS[k].s}</span></button></li>`).join('')}</ul>`;
}
MODALS.glossary = () => {
  const cat = UI.glossCat || 'all';
  const tabs = [['all', 'すべて'], ...TERM_CATS];
  const body = `<div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" data-act="glossCat" data-v="${k}" aria-pressed="${cat === k}">${l}</button>`).join('')}</div>
    <input type="search" class="gsearch" data-in="glossQ" value="${esc(UI.glossQ || '')}" placeholder="用語を探す（例：減価償却、債務償還年数）" aria-label="用語を探す">
    <div id="glossList">${glossList(cat, UI.glossQ)}</div>`;
  return modalFrame('用語集', body, btn('閉じる', 'closeModal', {}, 'primary'), { size: 'wide', sub: `決算書・経営指標・簿記・予算・銀行の用語 ${TERM_KEYS.length}語` });
};

/* 用語カードは、開いていた画面（モーダル）に戻れるようにする */
function pushModalBack(name) {
  if (UI.modal && UI.modal.name !== name && !(name === 'term' && UI.modal.name === 'term')) {
    UI.mstack = UI.mstack || [];
    UI.mstack.push(UI.modal);
    if (UI.mstack.length > 6) UI.mstack.shift();
  }
}
Object.assign(ACTIONS, {
  term: d => { hideTip(); pushModalBack('term'); showModal('term', { k: d.k }); },
  glossary: () => { hideTip(); pushModalBack('glossary'); showModal('glossary'); },
  glossCat: d => { UI.glossCat = d.v; showModal('glossary'); },
});
INPUTS.glossQ = el => { UI.glossQ = el.value; const box = $('#glossList'); if (box) box.innerHTML = glossList(UI.glossCat || 'all', el.value); };

/* ---------- 決算書の読み方ガイド ---------- */
const EVAL = { good: ['良好', 'ok'], mid: ['普通', ''], warn: ['注意', 'warn'], bad: ['危険', 'bad'], none: ['―', ''] };

/* ys: 決算（古い順。先頭は前期比較用に1期多く含めてよい） */
function fsGuideSteps(ys, ind) {
  const n = ys.length;
  if (!n) return [];
  const L = ys[n - 1], P = n > 1 ? ys[n - 2] : null;
  const disp = ys.slice(-3);
  const r = ratiosOf(L, P);
  const rp = P ? ratiosOf(P, n > 2 ? ys[n - 3] : null) : null;
  const avg = industryAvg(ind);
  const yen = v => fmtYen(v);
  const steps = [];

  /* ① 規模と成長 */
  const g = disp.length >= 2 ? (disp[disp.length - 1].S / Math.max(1, disp[0].S) - 1) * 100 : NaN;
  steps.push({
    t: '売上は伸びているか', sub: '規模と成長', view: 'pl', rows: ['sales'], terms: ['sales', 'salesG'],
    vals: `売上高 ${disp.map(s => yen(s.S)).join(' → ')}`,
    ev: !isFinite(g) ? 'none' : g > 5 ? 'good' : g >= -5 ? 'mid' : 'warn',
    msg: !isFinite(g) ? '比べる前期がありません。' : `${disp.length}期で${fmtPct(g, 1, { sign: true })}。${g < -5 ? '売上が縮むと家賃や人件費などの固定費をまかなえなくなります。客数・単価・取引先のどこが減ったのかを確かめます。' : g > 20 ? '急成長の会社は、売掛金や在庫が膨らんで現金が足りなくなりやすい（黒字倒産）。運転資金の伸びも一緒に見ます。' : '大きな変化はありません。次は利益が出ているかを見ます。'}`,
  });

  /* ② 稼ぐ力 */
  const prof = disp.filter(s => s.ORD > 0).length;
  steps.push({
    t: '本業で稼げているか', sub: '収益性', view: 'pl', rows: ['gp', 'opi', 'ord'], terms: ['opi', 'ord', 'ordm'],
    vals: `経常利益 ${disp.map(s => yen(s.ORD)).join(' → ')}（経常利益率 ${fmtPct(r.ordm, 1)}・業界平均 ${fmtPct(avg.ordm, 1)}）`,
    ev: L.ORD <= 0 ? (prof === 0 ? 'bad' : 'warn') : r.ordm >= avg.ordm ? 'good' : 'mid',
    msg: L.ORD <= 0 ? `直近期は経常赤字（${disp.length}期中${prof}期が黒字）。${L.OPI <= 0 ? '営業利益から赤字なので、商売のやり方そのもの（粗利・経費）に問題があります。' : '営業利益は黒字なので、借入の利息が重いのが原因です。'}`
      : `経常利益は${prof}期とも黒字${prof < disp.length ? 'ではありません' : ''}。${r.ordm >= avg.ordm ? '利益率は業界平均以上です。' : '利益率は業界平均を下回ります。粗利率と販管費のどちらに原因があるか見ます。'}`,
  });

  /* ③ 安全性 */
  steps.push({
    t: '財務は安全か', sub: '安全性', view: 'bs', rows: ['eq', 'ta'], terms: ['eqR', 'insolvent', 'eq'],
    vals: `純資産 ${yen(L.EQ)}・自己資本比率 ${fmtPct(r.eqR, 1)}`,
    ev: L.EQ < 0 ? 'bad' : r.eqR < 10 ? 'warn' : r.eqR < 30 ? 'mid' : 'good',
    msg: L.EQ < 0 ? '純資産がマイナスの債務超過です。資産を全部売っても借入を返しきれません。銀行は新しい融資に非常に慎重になります。'
      : r.eqR < 10 ? '自己資本比率が10%未満で、借入に頼った財務です。少しの赤字で債務超過になりかねません。'
        : r.eqR < 30 ? '自己資本比率は中小企業として普通の水準です。' : '自己資本比率が高く、返さなくてよいお金が厚い安全な財務です。',
  });

  /* ④ 返済能力 */
  const debt = L.STD + L.LTD;
  steps.push({
    t: '借入金を返せるか', sub: '返済能力', view: 'ratio', rows: ['dsy', 'icr', 'debtMonths'], terms: ['dsy', 'icr', 'debt'],
    vals: `借入金 ${yen(debt)}・債務償還年数 ${fmtRatio(r.dsy, '年')}・ICR ${fmtRatio(r.icr, '倍')}`,
    ev: debt <= 0 || r.dsy === 0 ? 'good' : !isFinite(r.dsy) ? 'bad' : r.dsy <= 10 ? 'good' : r.dsy <= 20 ? 'warn' : 'bad',
    msg: debt <= 0 ? '借入金はありません（実質無借金）。'
      : r.dsy === 0 ? '借入金より現預金が多く、実質的に無借金です。'
        : !isFinite(r.dsy) ? '返済に使えるお金（経常利益＋減価償却費）がマイナスで、今の稼ぎでは返済できません。'
          : `今の稼ぎ（経常利益×0.7＋減価償却費）で、実質の借入を約${fmtNum(r.dsy, 1)}年で返せる計算です。${r.dsy <= 10 ? '10年以内なので正常の目安に収まっています。' : '10年を超えると返済能力に不安があるとみなされます。'}`,
  });

  /* ⑤ お金の流れ */
  const cf = P ? cfOf(L, P) : null;
  steps.push({
    t: '利益が現金を伴っているか', sub: 'キャッシュ・フロー', view: 'cf', rows: ['ocf', 'cfNi', 'cfAr', 'cfInv'], terms: ['cfo', 'ocfNi', 'kuroji'],
    vals: cf ? `当期純利益 ${yen(L.NI)}・営業CF ${yen(cf.ocf)}` : '前期がないため計算できません',
    ev: !cf ? 'none' : cf.ocf < 0 && L.NI > 0 ? 'bad' : cf.ocf < 0 ? 'warn' : L.NI > 0 && cf.ocf < L.NI * 0.3 ? 'warn' : 'good',
    msg: !cf ? '' : cf.ocf < 0 && L.NI > 0 ? '黒字なのに営業CFがマイナスです。売掛金や在庫が利益以上に増えています。回収の遅れ、売れ残り、または架空売上・在庫の水増しを疑います。'
      : cf.ocf < 0 ? '本業で現金が出ていっています。赤字か、運転資金の増加が原因です。'
        : L.NI > 0 && cf.ocf < L.NI * 0.3 ? '営業CFが利益に比べて小さく、利益の一部が売掛金や在庫に変わっています。' : '本業でしっかり現金を生み出しています。',
  });

  /* ⑥ 回転日数（運転資金と粉飾の兆候） */
  const dAr = rp ? r.arDays - rp.arDays : 0, dInv = rp ? r.invDays - rp.invDays : 0;
  const arBad = rp && dAr > Math.max(12, rp.arDays * 0.3) && r.arDays > avg.arDays;
  const invBad = rp && dInv > Math.max(10, rp.invDays * 0.3) && r.invDays > avg.invDays;
  steps.push({
    t: '売掛金と在庫は膨らんでいないか', sub: '運転資金・粉飾の兆候', view: 'ratio', rows: ['arDays', 'invDays', 'apDays', 'depRate'], terms: ['arDays', 'invDays', 'wc', 'fraud'],
    vals: `売上債権回転日数 ${fmtRatio(r.arDays, '日')}${rp ? `（前期 ${fmtRatio(rp.arDays, '日')}）` : ''}・棚卸資産回転日数 ${fmtRatio(r.invDays, '日')}${rp ? `（前期 ${fmtRatio(rp.invDays, '日')}）` : ''}`,
    ev: !rp ? 'none' : arBad || invBad ? 'warn' : 'mid',
    msg: !rp ? '' : arBad || invBad ? `${arBad ? '売上債権' : ''}${arBad && invBad ? 'と' : ''}${invBad ? '棚卸資産' : ''}の回転日数が前期から大きく延び、業界平均（売上債権${fmtNum(avg.arDays, 0)}日・在庫${fmtNum(avg.invDays, 0)}日）も上回っています。回収できない売掛金や売れ残りがないか、数字を作っていないかを調べます。`
      : `回転日数に大きな変化はありません（業界平均 売上債権${fmtNum(avg.arDays, 0)}日・在庫${fmtNum(avg.invDays, 0)}日）。急に延びていたら要注意です。`,
  });
  return steps;
}

function fsGuidePanel(steps, ctx) {
  if (!steps.length) return '';
  UI.guideCache = UI.guideCache || {};
  UI.guideCache[ctx] = steps;
  const sel = UI.guideSel && UI.guideSel.ctx === ctx ? UI.guideSel.i : -1;
  const warn = steps.filter(s => s.ev === 'warn' || s.ev === 'bad').length;
  const items = steps.map((s, i) => {
    const [lab, cls] = EVAL[s.ev] || EVAL.none;
    return `<li class="gstep${sel === i ? ' on' : ''}">
      <div class="gst-head"><span class="gnum" aria-hidden="true">${i + 1}</span><div><b>${s.t}</b><span class="small muted">　${s.sub}</span></div>${s.ev !== 'none' ? tag(lab, cls) : ''}</div>
      <div class="gst-vals num small">${s.vals}</div>
      ${s.msg ? `<p class="small">${s.msg}</p>` : ''}
      <div class="row gst-foot">${btn('決算書で見る', 'guideGo', { ctx, i, view: s.view }, 'sm')}<span class="small muted">${s.terms.map(k => term(esc(TERMS[k] ? TERMS[k].n.replace(/（.*?）/, '') : k), k)).join('・')}</span></div>
    </li>`;
  }).join('');
  return `<div class="guide"><div class="guide-head"><b>決算書の読み方ガイド</b><span class="small muted">銀行の審査と同じ順番で見ていきます。${warn ? `気になる点が<b>${warn}つ</b>あります。` : '大きな問題は見当たりません。'}</span></div><ol class="gsteps">${items}</ol>
    <p class="note">ガイドは決算書の基本的な読み方を示すもので、粉飾をすべて見抜けるわけではありません。判断するのはあなたです。点線の下線がある言葉を押すと解説が出ます。${btn('用語集', 'glossary', {}, 'sm linkish')}</p></div>`;
}

/* ガイドの手順を選ぶと、表を切り替えて該当の行を光らせる */
function guideRows(ctx, view) {
  const g = UI.guideSel;
  if (!g || g.ctx !== ctx || g.view !== view) return [];
  return g.rows || [];
}
ACTIONS.guideGo = d => {
  const ctx = d.ctx, i = +d.i;
  const steps = UI.guideCache && UI.guideCache[ctx];
  const s = steps && steps[i];
  if (!s) return;
  UI.guideSel = { ctx, i, view: s.view, rows: s.rows };
  if (ctx === 'app') UI.appView = s.view;
  if (ctx === 'loan' && UI.modal && UI.modal.name === 'loan') UI.modal.args.view = s.view;
  if (ctx === 'co') UI.coFsView = s.view;
  if (UI.modal && ctx === 'loan') drawModal(); else render();
  const el = document.querySelector('tr.focus') || document.querySelector('.fs');
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
};

/* ---------- 遊び方：決算書の読み方 ---------- */
HELP.splice(3, 0, ['決算書の読み方', `<p>決算書は3つの表でできています。${term('損益計算書', 'pl')}は「1年間でいくら儲かったか」、${term('貸借対照表', 'bs')}は「決算日に何を持ち、どうやってお金を集めたか」、${term('キャッシュ・フロー計算書', 'cf')}は「現金が実際にどう動いたか」を表します。3つはつながっていて、当期純利益は貸借対照表の利益剰余金を増やし、現金の増減はキャッシュ・フロー計算書で説明されます。</p>
  <p>銀行の審査では、だいたい次の順番で見ます。稟議書の「決算書の読み方ガイド」は、この順番で数字を拾い出し、表の該当する行を光らせます。</p>
  <ol>
    <li><b>売上は伸びているか</b>：${term('売上高', 'sales')}の3期の推移。</li>
    <li><b>本業で稼げているか</b>：${term('営業利益', 'opi')}と${term('経常利益', 'ord')}が黒字か。${term('売上高経常利益率', 'ordm')}を業界平均と比べる。</li>
    <li><b>財務は安全か</b>：${term('純資産', 'eq')}がプラスか（${term('債務超過', 'insolvent')}でないか）、${term('自己資本比率', 'eqR')}。</li>
    <li><b>借入金を返せるか</b>：${term('債務償還年数', 'dsy')}（10年以内が目安）と${term('インタレスト・カバレッジ・レシオ', 'icr')}。</li>
    <li><b>利益が現金を伴っているか</b>：${term('営業キャッシュ・フロー', 'cfo')}がプラスか。黒字なのにマイナスなら要注意。</li>
    <li><b>売掛金と在庫は膨らんでいないか</b>：${term('売上債権回転日数', 'arDays')}と${term('棚卸資産回転日数', 'invDays')}の急な変化。${term('粉飾', 'fraud')}の兆候が表れやすいところです。</li>
  </ol>
  <p>表の中の点線の下線がある言葉は、押すと意味・計算式・見るポイントが出ます。${btn('用語集を開く', 'glossary', {}, 'sm')}</p>
  <p class="note">会社を経営する側の気持ちで決算書を作ってみたいときは、タイトル画面で「会社を経営する」を選んでください。</p>`]);
