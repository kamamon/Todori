'use strict';
/* =========================================================
 *  43c_fd_custom_ui.js : 創業記モードのカスタムスタート（開始画面）と途中編集（ゲーム中のモーダル）
 *   空欄の項目は、始める年と会社の大きさに合わせた初期値（史実の会社がその年に手がけていた事業など）で埋める
 * ========================================================= */

/* マイナスを入れる欄（技術や品質の遅れ）は、文字の欄にする。数の欄のキーボード（スマホの数字キー）にはマイナスがないことがあるため。
   全角の数字や「－」「ー」なども読める（fdCuNum） */
const FD_SIGNED = 'type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"';
/* ---------- 開始画面：カスタムスタート ---------- */
function fdCuState() {
  const f = fdStartDefaults();
  if (!f.cu) f.cu = { on: false, y: '', endY: '', founded: '', sales: '', cash: '', debt: '', gap: '', eng: '', ovs: '', kz: '', qcLv: '', story: true, listed: null, cats: {}, regs: {}, techF: {}, prog: {} };
  return f.cu;
}
/* 事業の選び方を初めて変えるとき、いま選ばれている事業（初期値）を書き写す（ほかの事業が外れないように） */
function fdCuFillCats() {
  const f = fdStartDefaults(), cu = fdCuState();
  const R = fdCuResolve(f.scen, cu);
  const on = new Set(R.cats.map(k => k.c));
  for (const c of fdCuCats(f.scen, R.y)) { const o = cu.cats[c] = cu.cats[c] || {}; if (o.on === undefined) o.on = on.has(c); }
}
function fdCuMarkOn() {
  const cu = fdCuState();
  cu.on = true;
  const cb = document.querySelector('[data-ch="fCuOn"]'); if (cb) cb.checked = true;
  const b = document.querySelector('.cu-body'); if (b) b.classList.remove('off');
}
function fdCustomHtml() {
  const f = fdStartDefaults(), cu = fdCuState();
  const S = FD_SCEN[f.scen];
  const R = fdCuResolve(f.scen, cu);
  const y = R.y;
  const num = (k, label, ph, attrs = '', signed = false) => `<label class="field"><span>${label}</span><input ${signed ? `${FD_SIGNED} class="cu-signed"` : 'type="number" inputmode="decimal"'} data-ch="fCu" data-k="${k}" value="${esc(cu[k] ?? '')}" placeholder="${esc(ph)}" ${attrs} style="width:100%"></label>`;
  const bench = fdCuBench(f.scen, y);
  const on = new Set(R.cats.map(k => k.c));
  const catRows = fdCuCats(f.scen, y).map(c => {
    const C = S.cats[c], o = cu.cats[c] || {}, k = R.cats.find(x => x.c === c);
    const lab = t => `aria-label="${esc(C.n)}の${t}"`;
    return `<tr class="${on.has(c) ? '' : 'cu-off'}"><td><label class="inline"><input type="checkbox" data-ch="fCuCatOn" data-c="${c}" ${on.has(c) ? 'checked' : ''}> ${esc(C.n)}</label></td>
      <td><input type="number" class="cu-xs" inputmode="decimal" data-ch="fCuCat" data-c="${c}" data-k="w" value="${esc(o.w ?? '')}" placeholder="自動" min="0" step="1" ${lab('売上の割合')}></td>
      <td><input ${FD_SIGNED} class="cu-xs cu-signed" data-ch="fCuCat" data-c="${c}" data-k="gap" value="${esc(o.gap ?? '')}" placeholder="${k ? k.gap : fdCuCatGap(f.scen, c, R.tech)}" ${lab('品質の遅れ（先を行くならマイナス）')}></td>
      <td><input type="number" class="cu-xs" inputmode="decimal" data-ch="fCuCat" data-c="${c}" data-k="pr" value="${esc(o.pr ?? '')}" placeholder="100" min="50" max="200" step="1" ${lab('値段')}></td></tr>`;
  }).join('');
  const regRows = fdRegOrder().map(r => {
    const acc = fdCuAccess(r, y), o = R.regs[r];
    const max = r === 'jp' ? 4 : Math.min(4, acc);
    const stages = r === 'jp' ? FD_STAGES_JP : FD_STAGES;
    const opts = stages.map((s, i) => (i > max || (r === 'jp' && i === 0) ? '' : `<option value="${i}"${i === o.st ? ' selected' : ''}>${esc(s.n)}</option>`)).join('');
    return `<tr><td>${esc(FD_REG[r].n)}${max <= 0 ? '<div class="small muted">この時代は商売できない</div>' : ''}</td>
      <td><select data-ch="fCuReg" data-r="${r}" data-k="st" aria-label="${esc(FD_REG[r].n)}の販路"${max <= 0 ? ' disabled' : ''}>${opts || '<option value="0">未進出</option>'}</select></td>
      <td><input type="number" class="cu-xs" inputmode="decimal" data-ch="fCuReg" data-r="${r}" data-k="brand" value="${esc((cu.regs[r] || {}).brand ?? '')}" placeholder="${o.brand || '自動'}" min="0" max="100" step="1" aria-label="${esc(FD_REG[r].n)}のブランド"></td></tr>`;
  }).join('');
  const techRows = Object.entries(S.fields).map(([fid, F]) => (F.born > y
    ? `<tr><td>${esc(F.n)}</td><td class="small muted">${Math.ceil(F.born)}年ごろに生まれる技術</td></tr>`
    : `<tr><td>${esc(F.n)}</td><td><input ${FD_SIGNED} class="cu-xs cu-signed" data-ch="fCuTech" data-f="${fid}" value="${esc(cu.techF[fid] ?? '')}" placeholder="${R.tech[fid]}" aria-label="${esc(F.n)}の遅れ（先を行くならマイナス）"> 年遅れ</td></tr>`)).join('');
  const progs = Object.entries(FD_PROGS).filter(([, P]) => y >= P.from).map(([k, P]) => `<label class="inline small"><input type="checkbox" data-ch="fCuProg" data-k="${k}" ${R.prog[k] ? 'checked' : ''}> ${esc(P.n)}</label>`).join('');
  return `<details class="custom field"${cu.on ? ' open' : ''}><summary>カスタムスタート（始める年・会社の大きさ・技術・事業・販路を決める）</summary>
    <label class="inline" style="margin:6px 0"><input type="checkbox" data-ch="fCuOn" ${cu.on ? 'checked' : ''}> この設定で始める</label>
    <div class="cu-body${cu.on ? '' : ' off'}">
    <div class="grid g3 cu-nums">${num('y', '始める年（西暦）', S.start.y0, `min="${FD_CU_YMIN}" max="${FD_CU_YMAX}" step="1"`)}${num('endY', '終わりの年', R.endY, `min="${FD_CU_YMIN + 3}" max="${FD_CU_ENDMAX}" step="1"`)}${num('founded', '創業の年', y, `min="1850" max="${y}" step="1"`)}</div>
    <p class="small muted" style="margin:0">${fdWareki(y)}（${y}年）の1月から。${esc(fdEraText(y))}</p>
    <div class="grid g3 cu-nums">${num('sales', '年商（億円）', Math.round(bench / 1e8), 'min="1" step="1"')}${num('cash', '現金（億円）', '自動', 'min="0" step="1"')}${num('debt', '借入金（億円）', '自動', 'min="0" step="1"')}</div>
    <span class="small muted">金額は今の価値（2025年の円）。空欄の年商は、${esc(S.bench.n)}の${y}年の売上（約${fmtYen(bench)}）。市場の取り分から見込める年商が目安に届くまでブランドを上げ（国内85・海外65まで）、それでも届かない分は小さく始めます。現金は見込みの年商の12%、借入金は2〜3割が初期値です。</span>
    <div class="grid g3 cu-nums">${num('gap', '技術の遅れ（年）', `約${Math.max(1, Math.round(fdSer(FD_JP_BASE, y) + (y < 1980 ? 2 : 1)))}年`, '', true)}${num('eng', '技術者の数', '自動', 'min="0" step="1"')}${num('ovs', '海外で作る割合（%）', R.ovs ? Math.round(R.ovs * 100) : '0', 'min="0" max="80" step="5"')}</div>
    <span class="small muted">技術の遅れは世界の先端より何年遅れているか（空欄は日本の産業の地力に合わせる）。先を行くならマイナス（何年先でも。品質の遅れも同じ）。技術者は空欄なら売上の4%を研究に使える数。海外で作る割合は、販路が「現地生産」以上の地域に工場を建てて分けます。</span>
    <div class="field"><span>事業（割合は売上の配分の重み。空欄は市場の大きさに合わせる。品質の遅れは年、値段は相場の%）</span>
      <div class="tbl-wrap"><table class="t compact fcu-tbl"><thead><tr><th>分野</th><th>割合</th><th>品質の遅れ</th><th>値段</th></tr></thead><tbody>${catRows}</tbody></table></div></div>
    <div class="field"><span>販路とブランド（0〜100）</span>
      <div class="tbl-wrap"><table class="t compact fcu-tbl"><thead><tr><th>地域</th><th>販路</th><th>ブランド</th></tr></thead><tbody>${regRows}</tbody></table></div></div>
    <details class="field"><summary class="small">分野ごとの技術の遅れ</summary><div class="tbl-wrap"><table class="t compact fcu-tbl"><tbody>${techRows}</tbody></table></div></details>
    <div class="field"><span>仕組み</span><div class="cu-checks">${progs || '<span class="small muted">この年に始められる仕組みはまだありません</span>'}</div>
      ${R.prog.kaizen || R.prog.qc ? `<div class="grid g2 cu-nums">${R.prog.kaizen ? num('kz', 'カイゼンの身につき具合（%）', 50, 'min="0" max="100" step="5"') : ''}${R.prog.qc ? num('qcLv', '品質管理の身につき具合（%）', 50, 'min="0" max="100" step="5"') : ''}</div>` : ''}</div>
    <div class="cu-checks"><label class="inline small"><input type="checkbox" data-ch="fCuFlag" data-k="listed" ${R.listed ? 'checked' : ''}${y < 1950 ? ' disabled' : ''}> 株式を上場している${y < 1950 ? '（1950年から）' : ''}</label>
      <label class="inline small"><input type="checkbox" data-ch="fCuFlag" data-k="story" ${R.story ? 'checked' : ''}> この道の物語の出来事（独立・合併・特許・大きな工場など）も起こす</label></div>
    <p class="small muted" style="margin:0">始める年より前の時代の出来事は、関税・統制・需要・進出の制限など、まだ続いている市場への効き目だけを引き継ぎます。工場とラインは見込める売上に合わせて建てておき、工員・営業・事務は大きさに合わせてそろえます。ゲームの途中でも、メニューの「会社を編集する」で書き換えられます。カスタムスタートの評価は参考です。</p></div>
  </details>`;
}
/* 描き直しは、イベントが終わってから（欄から離れたときの change の途中で描き直すと、ブラウザがエラーにする） */
function fdCuRerender() { setTimeout(() => { if (!G) { fdStartStore(); render(); } }, 0); }
Object.assign(CHANGES, {
  fCuOn: el => { fdCuState().on = el.checked; fdCuRerender(); },
  fCu: el => {
    const cu = fdCuState();
    cu[el.dataset.k] = el.value;
    if (el.dataset.k === 'y') { cu.cats = {}; }
    fdCuMarkOn();
    // 年と年商は、選べる事業・初期値・説明が変わるので描き直す
    if (/^(y|sales)$/.test(el.dataset.k)) fdCuRerender();
  },
  fCuCatOn: el => { fdCuFillCats(); const cu = fdCuState(); cu.cats[el.dataset.c].on = el.checked; fdCuMarkOn(); fdCuRerender(); },
  fCuCat: el => { fdCuFillCats(); const cu = fdCuState(); cu.cats[el.dataset.c][el.dataset.k] = el.value; fdCuMarkOn(); },
  fCuReg: el => { const cu = fdCuState(); (cu.regs[el.dataset.r] = cu.regs[el.dataset.r] || {})[el.dataset.k] = el.value; fdCuMarkOn(); },
  fCuTech: el => { fdCuState().techF[el.dataset.f] = el.value; fdCuMarkOn(); },
  fCuProg: el => { fdCuState().prog[el.dataset.k] = el.checked; fdCuMarkOn(); fdCuRerender(); },
  fCuFlag: el => { fdCuState()[el.dataset.k] = el.checked; fdCuMarkOn(); },
});
Object.assign(ACTIONS, {
  fStScen: d => { fdStartStore(); UI.start.f.scen = d.v; const cu = UI.start.f.cu; if (cu) { cu.cats = {}; cu.techF = {}; } render(); },
  fStart: () => {
    fdStartStore();
    const f = UI.start.f;
    const S = FD_SCEN[f.scen];
    const seedN = parseInt(String(f.seed).replace(/[^0-9]/g, ''), 10);
    const o = { scen: f.scen, diff: f.diff, coName: (f.co || '').trim() || S.start.coName, founder: (f.founder || '').trim() || S.start.founder };
    if (Number.isFinite(seedN)) o.seed = seedN;
    if (f.cu && f.cu.on) o.cu = fdCuResolve(f.scen, f.cu);
    fdNewGame(o);
    UI.tab = 'f_dash'; UI.fCat = null; UI.fReg = 'jp'; UI.fHist = 'chron';
    render();
    window.scrollTo({ top: 0 });
    autosave();
    showModal('fdIntro');
  },
});

/* ---------- ゲーム中：途中編集 ---------- */
const FD_ED_TABS = [['money', 'お金'], ['tech', '技術'], ['prod', '製品'], ['fac', '工場'], ['reg', '販路とブランド'], ['org', '人と仕組み']];
const fdEdNum = (v, d = 1) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : '');
MODALS.fdEdit = (a = {}) => {
  const tab = UI.fEdTab || 'money';
  const y = fdYf();
  const real = x => x / fdCpi(y);
  const inp = (attrs, v, extra = '') => `<input type="number" class="cu-sm" inputmode="decimal" ${attrs} value="${esc(String(v))}" ${extra}>`;
  const inpS = (attrs, v, extra = '') => `<input ${FD_SIGNED} class="cu-sm cu-signed" ${attrs} value="${esc(String(v))}" ${extra}>`;
  const seg = `<div class="seg wrap" role="group" aria-label="編集する項目">${FD_ED_TABS.map(([k, l]) => `<button type="button" data-act="fEdTab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'money') {
    body = `<div class="grid g2 cu-nums"><label class="field"><span>現金（今の価値・億円）</span>${inp('data-ed="cash" min="0" step="1"', fdEdNum(real(G.bs.cash) / 1e8, 1), 'style="width:100%"')}</label>
      <label class="field"><span>借入金（今の価値・億円）</span>${inp('data-ed="debt" min="0" step="1"', fdEdNum(real(fdDebt()) / 1e8, 1), 'style="width:100%"')}</label></div>
      <p class="small muted">いま：現金 ${fmtYen(G.bs.cash)}・借入金 ${fmtYen(fdDebt())}・純資産 ${fmtYen(fdEquity())}（その時代の円）。借入を増やすと純資産が減り、減らすと増えます。</p>`;
  } else if (tab === 'tech') {
    const rows = Object.entries(fdS().fields).filter(([f]) => fdFrontier(f, y) !== null).map(([f, F]) => {
      const g = fdGap(f, y);
      return `<tr><td>${esc(F.n)}</td><td class="small muted">${g === Infinity ? '手を付けていない' : fdGapTxt(g)}</td><td>${inpS(`data-ed="tech" data-f="${f}" aria-label="${esc(F.n)}の遅れ（先を行くならマイナス）"`, g === Infinity ? '' : fdEdNum(g, 1), g === Infinity ? 'placeholder="―"' : '')} 年遅れ</td></tr>`;
    }).join('');
    body = `<div class="tbl-wrap"><table class="t compact fcu-tbl"><thead><tr><th>技術</th><th>いま</th><th>世界の先端より</th></tr></thead><tbody>${rows}</tbody></table></div><p class="small muted">マイナスは先端より先を行く（何年先でも。先へ行くほど研究では進みにくい）。技術がその製品の世に出た年の水準に届けば、世界にまだない製品も作れます。</p>
      <label class="inline small"><input type="checkbox" data-ed="remake" checked> 売っている製品も、この技術の水準で作り直す（品質・仕様と、自動で付いた名前）</label>`;
  } else if (tab === 'prod') {
    const ps = fdActiveProds();
    const rows = ps.map(p => `<tr><td><b>${esc(p.name)}</b><div class="small muted">${esc(fdCat(p.cat).n)}</div></td><td>${inpS(`data-ed="pgap" data-p="${p.id}" aria-label="${esc(p.name)}の品質の遅れ（先を行くならマイナス）"`, fdEdNum(y - p.qy, 1))} 年遅れ</td><td>${inp(`data-ed="ppr" data-p="${p.id}" min="50" max="200" step="1" aria-label="${esc(p.name)}の値段"`, p.pr)} %</td></tr>`).join('');
    const newCats = Object.keys(fdS().cats).filter(c => fdCatOpen(c, y) && !fdActiveProds(c).length);
    body = `${rows ? `<div class="tbl-wrap"><table class="t compact fcu-tbl"><thead><tr><th>製品</th><th>品質</th><th>値段（相場の%）</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">売っている製品がありません</div>'}
      ${newCats.length ? `<h3 class="cu-h">新しい分野の製品をすぐに出す</h3><div class="row"><select data-ed="newc" aria-label="分野">${newCats.map(c => `<option value="${c}">${esc(fdCat(c).n)}</option>`).join('')}</select>
        <label class="inline small">本社工場にラインを ${inp('data-ed="newcap" min="0" step="1" aria-label="年に作れる数"', '', 'placeholder="年に作れる数" style="width:8.5em"')}</label>${btn('出す', 'fEdAddProd', {}, 'sm')}</div>
        <p class="small muted">品質の遅れは、先を行くならマイナス（何年先でも）。新しい製品の品質は、いまのその分野の技術の水準。ラインの数を空欄にすると、製品だけを出します（作る場所は工場の項目で足せます）。</p>` : ''}`;
  } else if (tab === 'fac') {
    const facs = G.facs.map(f => {
      const lines = f.lines.map(l => `<tr><td>${esc(fdCat(l.cat).n)}</td><td>${inp(`data-ed="lcap" data-f="${f.id}" data-c="${l.cat}" min="0" step="1" aria-label="${esc(f.n)}の${esc(fdCat(l.cat).n)}の能力"`, fdEdNum(l.cap, fdCat(l.cat).kind === 'big' ? 1 : 0))} ${esc(fdCat(l.cat).unit)}/年</td><td>${inp(`data-ed="lauto" data-f="${f.id}" data-c="${l.cat}" min="0" max="${Math.round(fdAutoMax(y) * 100)}" step="5" aria-label="${esc(f.n)}の${esc(fdCat(l.cat).n)}の自動化"`, Math.round((l.auto || 0) * 100))} %</td></tr>`).join('');
      const cats = Object.keys(fdS().cats).filter(c => fdCatOpen(c, y) && !f.lines.some(l => l.cat === c));
      return `<div class="cu-fac"><div class="row" style="justify-content:space-between"><b>${esc(f.n)}<span class="small muted">（${esc(FD_REG[f.r].n)}・工員${fmtNum(f.wk || 0, 0)}人）</span></b>
        <span class="row small"><label class="inline">腕 ${inp(`data-ed="skill" data-f="${f.id}" min="0.5" max="2" step="0.1" aria-label="${esc(f.n)}の腕"`, fdEdNum(f.skill || 1, 2))}</label>${(f.dmgF || 1) > 1.01 ? `<label class="inline"><input type="checkbox" data-ed="repair" data-f="${f.id}"> 被害を直す</label>` : ''}</span></div>
        ${lines ? `<div class="tbl-wrap"><table class="t compact fcu-tbl"><thead><tr><th>ライン</th><th>能力</th><th>自動化（上限${Math.round(fdAutoMax(y) * 100)}%）</th></tr></thead><tbody>${lines}</tbody></table></div>` : '<p class="small muted">ラインがありません</p>'}
        ${cats.length ? `<div class="row small"><select data-ed="lc" data-f="${f.id}" aria-label="${esc(f.n)}に足すラインの分野">${cats.map(c => `<option value="${c}">${esc(fdCat(c).n)}</option>`).join('')}</select>${inp(`data-ed="lcn" data-f="${f.id}" min="0" step="1" aria-label="${esc(f.n)}に足すラインの能力"`, '', 'placeholder="年に作れる数"')}${btn('ラインを足す', 'fEdAddLine', { f: f.id }, 'sm')}</div>` : ''}</div>`;
    }).join('');
    const regs = fdRegOrder().filter(r => r === 'jp' || fdRegAccess(r, y) >= 3);
    body = `${facs}<h3 class="cu-h">工場をすぐに建てる</h3><div class="row"><select data-ed="facr" aria-label="地域">${regs.map(r => `<option value="${r}">${esc(FD_REG[r].n)}</option>`).join('')}</select><input type="text" data-ed="facloc" placeholder="場所（空欄はその地域の代表的な場所）" aria-label="場所" style="min-width:12em">${btn('建てる', 'fEdAddFac', {}, 'sm')}</div>
      <p class="small muted">能力を増やした分の機械と、建てた工場は、資産として持たせます。</p>`;
  } else if (tab === 'reg') {
    const rows = fdRegOrder().map(r => {
      const R = G.reg[r], acc = fdRegAccess(r, y);
      const max = r === 'jp' ? 4 : Math.min(4, acc);
      const stages = r === 'jp' ? FD_STAGES_JP : FD_STAGES;
      const opts = stages.map((s, i) => (i > max || (r === 'jp' && i === 0) ? '' : `<option value="${i}"${i === R.st ? ' selected' : ''}>${esc(s.n)}</option>`)).join('');
      return `<tr><td>${esc(FD_REG[r].n)}${max <= 0 ? '<div class="small muted">いまは商売できない</div>' : ''}</td><td><select data-ed="rst" data-r="${r}" aria-label="${esc(FD_REG[r].n)}の販路"${max <= 0 ? ' disabled' : ''}>${opts || `<option value="${R.st}">${esc(stages[R.st].n)}</option>`}</select></td><td>${inp(`data-ed="rbr" data-r="${r}" min="0" max="100" step="1" aria-label="${esc(FD_REG[r].n)}のブランド"`, Math.round(R.brand))}</td></tr>`;
    }).join('');
    body = `<div class="tbl-wrap"><table class="t compact fcu-tbl"><thead><tr><th>地域</th><th>販路</th><th>ブランド（0〜100）</th></tr></thead><tbody>${rows}</tbody></table></div><p class="small muted">販路の段階を変えると、売り込める広さがすぐにその段階になります（現地生産の段階でも、工場は「工場」の項目で建てます）。</p>`;
  } else {
    const progs = Object.entries(FD_PROGS).filter(([, P]) => y >= P.from).map(([k, P]) => `<label class="inline small"><input type="checkbox" data-ed="prog" data-k="${k}" ${G.prog[k] !== undefined ? 'checked' : ''}> ${esc(P.n)}</label>`).join('');
    body = `<div class="grid g3 cu-nums"><label class="field"><span>技術者の数</span>${inp('data-ed="eng" min="0" step="1"', G.staff.eng, 'style="width:100%"')}</label>
      <label class="field"><span>カイゼンの身につき具合（%）</span>${inp('data-ed="kz" min="0" max="100" step="5"', Math.round((G.kaizen || 0) * 100), 'style="width:100%"')}</label>
      <label class="field"><span>品質管理の身につき具合（%）</span>${inp('data-ed="qc" min="0" max="100" step="5"', Math.round((G.qc || 0) * 100), 'style="width:100%"')}</label></div>
      <div class="field"><span>仕組み</span><div class="cu-checks">${progs || '<span class="small muted">いま始められる仕組みはありません</span>'}</div></div>
      <p class="small muted">工員・営業・事務の数は、作る量と売上に合わせて四半期ごとに自動でそろいます。</p>`;
  }
  const msg = a.msg ? `<div class="callout ${a.bad ? 'warn' : 'ok'}" role="status">${esc(a.msg)}</div>` : '';
  const apply = tab === 'prod' && !fdActiveProds().length ? '' : btn('この内容で書き換える', 'fEdApply', { v: tab }, 'primary');
  return modalFrame('会社を編集する', `${seg}${msg}<div class="cu-body" style="margin-top:10px">${body}</div>
    <p class="small muted" style="margin:10px 0 0">金額は今の価値（2025年の円）。編集で増えた・減ったお金・借入・設備は、純資産（資本金）で受けて帳簿を合わせます。編集すると、この会社の評価は参考になります${G.flags.edited ? `（これまでに${G.flags.edited}回）` : ''}。</p>`,
  apply + btn('閉じる', 'closeModal'), { size: 'wide' });
};
/* モーダルの中の入力を読む */
function fdEdVal(sel) { const el = document.querySelector('#modal-root ' + sel); return el ? fdCuNum(el.value) : null; }
function fdEdAll(sel) { return Array.from(document.querySelectorAll('#modal-root ' + sel)); }
function fdEdDone(msg, bad) { UI.modal.args = { msg, bad: !!bad }; drawModal(); render(); }
Object.assign(ACTIONS, {
  fEditOpen: () => { UI.fEdTab = UI.fEdTab || 'money'; showModal('fdEdit', {}); },
  fEdTab: d => { UI.fEdTab = d.v; UI.modal.args = {}; drawModal(); },
  fEdApply: d => {
    let n = 0;
    if (d.v === 'money') n = fdEditMoney({ cash: fdEdVal('[data-ed="cash"]') === null ? null : fdEdVal('[data-ed="cash"]') * 1e8, debt: fdEdVal('[data-ed="debt"]') === null ? null : fdEdVal('[data-ed="debt"]') * 1e8 }) ? 1 : 0;
    else if (d.v === 'tech') { const g = {}; for (const el of fdEdAll('[data-ed="tech"]')) { const v = fdCuNum(el.value); if (v !== null) g[el.dataset.f] = v; } const rm = document.querySelector('#modal-root [data-ed="remake"]'); n = fdEditTech(g, { prods: !!(rm && rm.checked) }); }
    else if (d.v === 'prod') { const m = {}; for (const el of fdEdAll('[data-ed="pgap"],[data-ed="ppr"]')) { const o = m[el.dataset.p] = m[el.dataset.p] || {}; o[el.dataset.ed === 'pgap' ? 'gap' : 'pr'] = fdCuNum(el.value); } n = fdEditProds(m); }
    else if (d.v === 'fac') {
      const m = {};
      const of = id => (m[id] = m[id] || { lines: {} });
      for (const el of fdEdAll('[data-ed="skill"]')) of(el.dataset.f).skill = fdCuNum(el.value);
      for (const el of fdEdAll('[data-ed="repair"]')) of(el.dataset.f).repair = el.checked;
      for (const el of fdEdAll('[data-ed="lcap"],[data-ed="lauto"]')) { const o = of(el.dataset.f).lines[el.dataset.c] = of(el.dataset.f).lines[el.dataset.c] || {}; const v = fdCuNum(el.value); if (el.dataset.ed === 'lcap') o.cap = v; else o.auto = v === null ? null : v / 100; }
      n = fdEditFacs(m);
    } else if (d.v === 'reg') { const m = {}; for (const el of fdEdAll('[data-ed="rst"],[data-ed="rbr"]')) { const o = m[el.dataset.r] = m[el.dataset.r] || {}; o[el.dataset.ed === 'rst' ? 'st' : 'brand'] = fdCuNum(el.value); } n = fdEditRegs(m); }
    else {
      const prog = {};
      for (const el of fdEdAll('[data-ed="prog"]')) prog[el.dataset.k] = el.checked;
      const kz = fdEdVal('[data-ed="kz"]'), qc = fdEdVal('[data-ed="qc"]');
      n = fdEditOrg({ eng: fdEdVal('[data-ed="eng"]'), prog, kz: kz === null ? null : kz / 100, qc: qc === null ? null : qc / 100 });
    }
    fdEdDone(n ? '書き換えました。' : '変わったところはありません。');
  },
  fEdAddProd: () => {
    const c = (document.querySelector('#modal-root [data-ed="newc"]') || {}).value;
    const r = fdEditAddProd(c, fdEdVal('[data-ed="newcap"]') || 0);
    fdEdDone(r.ok ? `「${r.p.name}」を出しました。` : r.why, !r.ok);
  },
  fEdAddLine: d => {
    const c = (document.querySelector(`#modal-root [data-ed="lc"][data-f="${d.f}"]`) || {}).value;
    const n = fdEdVal(`[data-ed="lcn"][data-f="${d.f}"]`);
    const r = fdEditAddLine(d.f, c, n || 0);
    fdEdDone(r.ok ? 'ラインを足しました。売る製品がない分野は、製品の項目で出してください。' : r.why, !r.ok);
  },
  fEdAddFac: () => {
    const r = (document.querySelector('#modal-root [data-ed="facr"]') || {}).value;
    const locIn = ((document.querySelector('#modal-root [data-ed="facloc"]') || {}).value || '').trim();
    const res = fdEditAddFac(r, locIn || FD_REG[r].locs[0]);
    fdEdDone(res.ok ? `${res.f.n}を建てました。ラインはこの項目で足せます。` : res.why, !res.ok);
  },
});
