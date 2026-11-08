'use strict';
/* =========================================================
 *  29n_kaisha_startgroup_ui.js : 始め方の画面の「グループの会社」（就任の時点の子会社・孫会社・関連会社）
 *   ・組織の木：親会社の下に子会社、その下に孫会社…（いくつでも、何段でも）
 *   ・会社ごとの設定：社名・株式を持つ会社・持分・国と所在地・事業（いくつでも）と規模・会社の状態・資本金・現預金・借入金
 *   ・持株会社で始めるときは、事業ごとの子会社（事業会社）の下にも会社を置ける
 *   （つくる処理は 29m_kaisha_startgroup.js）
 * ========================================================= */

function ksSgList(k) { if (!Array.isArray(k.grp)) k.grp = []; return k.grp; }
function ksSgIsHD(k) { const c = k.cu; return !!(c && c.on && c.form === 'hd'); }
function ksSgUKeys(k) { return ksSgIsHD(k) ? new Set(k.units.map(x => 'u:' + x.type)) : new Set(); }
function ksSgFix(k) { return ksSgNormalize(ksSgList(k), ksSgUKeys(k)); }
/* 親会社の名前（就任するときと同じ直し方） */
function ksSgRootName(k) {
  let co = ((k.coEdited ? k.coName : '') || '').trim() || ksDefaultCoName(k.units[0].type);
  if (!/株式会社|有限会社|合同会社/.test(co)) co = '株式会社' + co;
  const c = k.cu || {};
  if (c.on && c.form === 'hd') return co.includes('ホールディングス') ? co : `${co.replace(/株式会社/g, '').trim()}ホールディングス株式会社`;
  if (c.on && c.form === 'gk') return co.replace(/株式会社/, '合同会社');
  if (c.on && c.form === 'yk') return co.replace(/株式会社/, '有限会社');
  return co;
}
function ksSgRootPref(k) { const c = k.cu || {}; return c.on && KS_PREFS[+c.pref] ? +c.pref : KS_HOME_PREF; }
/* 会社の呼び名（名前を入れていなければ、事業から） */
function ksSgName(e) { return e.name && e.name.trim() ? ksSgFixName(e.name, e.cc) : ''; }
function ksSgShort(e) {
  const n = ksSgName(e);
  if (n) return n;
  const u = (e.units || [])[0];
  return u ? `${u.type.replace(/（.*?）/g, '')}の会社` : '事業のない会社';
}
/* 持株会社で始めるときの、事業ごとの子会社（事業会社）の呼び名 */
function ksSgUName(type) { return `${type.replace(/（.*?）/g, '')}の事業会社`; }
const KS_SG_SCN = { 0.5: '小', 1: '中', 2: '大', 4: '特大' };
function ksSgOwnTag(e) {
  const p = Math.round(e.own * 100);
  return e.own >= 0.9999 ? tag('100%子会社', 'ok') : e.own > 0.5 ? tag(`合弁 ${p}%`) : tag(`関連会社 ${p}%`, 'warn');
}
function ksSgHist(e) { return (e.cc || 'jp') === 'jp' && (e.units || []).length > 0; }
function ksSgDesc(e, k) {
  const us = (e.units || []).map(x => `${x.type}（${KS_SG_SCN[x.sc] || `${fmtNum(ksScToCap(x.type, x.sc), 0)}${ksCapInfo(x.type).u}`}${x.g ? `・${x.g > 0 ? '+' : '−'}${Math.round(Math.abs(x.g) * 100)}%/年` : ''}）`);
  const place = (e.cc || 'jp') !== 'jp' ? KS_COUNTRIES[e.cc].n : (KS_PREFS[+e.pref] || KS_PREFS[ksSgRootPref(k)]).n;
  const kind = ksSgHist(e) ? `過去4期の決算書つき・${KS_COND[e.cond] ? KS_COND[e.cond].n : '普通'}` : '就任の時に設立';
  return [us.length ? us.join('・') : '事業なし（株式を持つ会社）', place, kind].join('／');
}
/* 何段目の会社か（親会社の直下 0） */
function ksSgDepthOf(e, k) { return ksSgDepth(e, new Map(ksSgList(k).map(x => [x.id, x]))); }
function ksSgAddLabel(d) { return d === 0 ? '＋孫会社' : d === 1 ? '＋ひ孫会社' : '＋下の会社'; }

/* ---------- 始め方の画面の欄 ---------- */
function ksSgHtml(k) {
  ksSgFix(k);
  const list = ksSgList(k);
  const hd = ksSgIsHD(k);
  const seen = new Set();
  const kidsOf = pid => list.filter(e => (e.owner || 'root') === pid && !seen.has(e.id));
  const node = (e, d) => {
    seen.add(e.id);
    const can = ksSgCanOwn(e);
    const kids = kidsOf(e.id);
    const nm = ksSgName(e);
    const acts = `${btn('設定', 'kSgEdit', { id: e.id }, 'sm')}${can ? btn(ksSgAddLabel(d), 'kSgAdd', { owner: e.id }, 'sm') : ''}${btn('外す', 'kSgDel', { id: e.id }, 'sm ghost')}`;
    return `<li class="sgnode"><div class="sgco${e.own <= 0.5 ? ' aff' : ''}">
      <div class="sgco-t">${nm ? `<b>${esc(nm)}</b>` : `<b class="muted">${esc(ksSgShort(e))}</b><span class="small muted">名前は自動</span>`}${ksSgOwnTag(e)}${(e.cc || 'jp') !== 'jp' ? tag(KS_COUNTRIES[e.cc].n) : ''}</div>
      <div class="sgco-d small muted">${esc(ksSgDesc(e, k))}</div>
      <div class="sgco-a">${acts}</div></div>
      ${kids.length ? `<ul class="sgkids">${kids.map(x => node(x, d + 1)).join('')}</ul>` : ''}</li>`;
  };
  const uRows = hd ? k.units.map(x => {
    const kids = kidsOf('u:' + x.type);
    return `<li class="sgnode"><div class="sgco unit">
      <div class="sgco-t"><b class="muted">${esc(ksSgUName(x.type))}</b><span class="small muted">名前は自動</span>${tag('100%子会社', 'ok')}</div>
      <div class="sgco-d small muted">${esc(`${x.type}（${KS_SG_SCN[x.sc] || '中'}）`)}／事業ごとに分けた子会社（過去4期の決算書つき）</div>
      <div class="sgco-a">${btn('＋孫会社', 'kSgAdd', { owner: 'u:' + x.type }, 'sm')}</div></div>
      ${kids.length ? `<ul class="sgkids">${kids.map(e => node(e, 1)).join('')}</ul>` : ''}</li>`;
  }).join('') : '';
  const top = kidsOf('root');
  const direct = top.map(e => node(e, 0)).join('');
  const nC = list.filter(e => e.own > 0.5).length, nA = list.length - nC;
  const count = list.length ? `（${[nC ? `子会社など${nC}社` : '', nA ? `関連会社${nA}社` : ''].filter(Boolean).join('・')}）` : '';
  const rootDesc = hd ? '持株会社（事業は事業会社に分けて持つ）' : ksCompanyDesc(k.units.map(x => ({ type: x.type, n: null, sc: 1 })));
  return `<div class="field sgfield"><span>グループの会社${count}</span>
    <ul class="sgtree"><li class="sgnode"><div class="sgco root">
      <div class="sgco-t"><b>${esc(ksSgRootName(k))}</b>${tag('あなたが社長になる会社')}</div>
      <div class="sgco-d small muted">${esc(rootDesc)}</div>
      <div class="sgco-a">${btn('＋子会社を加える', 'kSgAdd', { owner: 'root' }, 'sm primary')}</div></div>
      ${uRows || direct ? `<ul class="sgkids">${uRows}${direct}</ul>` : ''}</li></ul>
    <span class="small muted">子会社・孫会社・関連会社を、いくつでも、何段でも加えられます。国内で事業のある会社は、先代のころからの会社として過去4期分の決算書つきで始まります。海外の会社と、事業のない会社（株式を持つだけの中間持株会社）は、就任の時に設立したばかりの会社です。${list.length ? '' : '加えなければ、1社で始めます。'}</span></div>`;
}

/* ---------- 会社の設定（ダイアログ） ---------- */
function ksSgBlank(owner) { return { id: null, name: '', owner: owner || 'root', own: 1, cc: 'jp', pref: 0, units: [], cond: 'normal', capital: '', cash: '', debt: '' }; }
/* いま入力欄にある値を下書きに入れる（ボタンを押す前に入れた字を失わないように） */
function ksSgStoreInputs() {
  const D = UI.sg;
  if (!D) return;
  const n = $('#sgName');
  if (n) D.e.name = n.value;
  for (const el of document.querySelectorAll('#modal-root [data-ch="kSgNum"]')) D.e[el.dataset.k] = el.value;
}
function ksSgRedraw() { drawModal(); } // 業種の一覧の位置は drawModal が保つ
/* 株式を持つ会社に選べるもの：親会社・事業会社（持株会社のとき）・国内の連結子会社（自分と自分の下の会社は除く） */
function ksSgOwnerOptions(k, D) {
  const list = ksSgList(k);
  const below = new Set();
  if (D.id) {
    below.add(D.id);
    let grew = true;
    while (grew) { grew = false; for (const e of list) if (!below.has(e.id) && below.has(e.owner)) { below.add(e.id); grew = true; } }
  }
  const opts = [['root', `${ksSgRootName(k)}（親会社）`]];
  if (ksSgIsHD(k)) for (const x of k.units) opts.push(['u:' + x.type, `${ksSgUName(x.type)}（持株会社の子会社）`]);
  const tops = ksSgIsHD(k) ? ['root', ...k.units.map(x => 'u:' + x.type)] : ['root'];
  for (const { e, depth } of ksSgTree(list, tops)) {
    if (below.has(e.id) || !ksSgCanOwn(e)) continue;
    opts.push([e.id, `${'　'.repeat(Math.min(depth, 6))}${ksSgShort(e)}`]);
  }
  return opts;
}
function ksSgPrefSelect(k, cur) {
  const p0 = ksSgRootPref(k);
  const opts = Object.entries(KS_PREF_REG).map(([r, rn]) => `<optgroup label="${esc(rn)}">${Object.values(KS_PREFS).filter(P => P.reg === r).map(P => `<option value="${P.c}"${P.c === +cur ? ' selected' : ''}>${esc(P.n)}</option>`).join('')}</optgroup>`).join('');
  return `<select data-ch="kSgPref" aria-label="所在地"><option value="0"${+cur ? '' : ' selected'}>親会社と同じ（${esc(KS_PREFS[p0].n)}）</option>${opts}</select>`;
}
MODALS.kSg = () => {
  const k = ksStartDefaults();
  const D = UI.sg;
  if (!D) return modalFrame('会社の設定', '<p>設定がありません</p>', btn('閉じる', 'closeModal'));
  const e = D.e;
  const list = ksSgList(k);
  const hist = ksSgHist(e);
  const foreign = e.cc !== 'jp';
  const C = foreign ? KS_COUNTRIES[e.cc] : null;
  const owners = ksSgOwnerOptions(k, D);
  if (!owners.some(o => o[0] === e.owner)) e.owner = 'root';
  const ownerName = (owners.find(o => o[0] === e.owner) || owners[0])[1].trim();
  const kids = D.id ? list.filter(x => x.owner === D.id) : [];
  const needUnit = ksSgNeedsUnit(e) && !e.units.length;
  const chosen = e.units.map((x, i) => { const S = KS_TYPES[x.type]; return `<li class="sunit sg-unit"><span class="indico" aria-hidden="true">${esc(S.icon)}</span><span class="stype-t"><b>${esc(S.name)}</b><span class="small muted">${esc(S.d || KS_ENG_INFO[S.eng].desc)}</span></span>
    <span class="stype-a"><span class="seg sm" role="radiogroup" aria-label="規模">${KS_SG_SCALES.map(v => `<button type="button" data-act="kSgSc" data-i="${i}" data-v="${v}" aria-pressed="${x.sc === v}">${KS_SG_SCN[v]}</button>`).join('')}</span>${btn('外す', 'kSgUDel', { i }, 'sm ghost')}</span>
    <div class="grid g2 cu-ugrid sg-udet">${ksCuCapField(x.type, x.sc, 'kSgCap', i)}${ksCuGrowField(x.g, 'kSgGrow', i, hist ? 'これまでの成長（売上の伸び）' : '就任のあとの勢い（売上の伸び）')}</div></li>`; }).join('');
  const ccOpts = [['jp', '日本'], ...Object.entries(KS_COUNTRIES).map(([c, x]) => [c, x.n])].map(([v, l]) => `<option value="${v}"${e.cc === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const own = KS_SG_OWNS.map(v => `<button type="button" data-act="kSgOwn" data-v="${v}" aria-pressed="${Math.abs(e.own - v) < 1e-9}">${Math.round(v * 100)}%</button>`).join('');
  const conds = Object.entries(KS_COND).map(([c, X]) => `<button type="button" data-act="kSgCond" data-v="${c}" aria-pressed="${e.cond === c}">${X.n}</button>`).join('');
  const num = (key, label) => `<label class="field"><span>${label}</span><input type="number" inputmode="numeric" min="0" step="100" data-ch="kSgNum" data-k="${key}" value="${esc(e[key])}" placeholder="${hist ? 'そのまま' : '自動'}"></label>`;
  const notes = [];
  if (kids.length && !ksSgCanOwn(e)) notes.push(`<div class="callout warn small">${foreign ? '海外の会社' : '関連会社'}は下に会社を持てないので、この会社の下の${kids.length}社は「${esc(ownerName)}」の直下に移ります。</div>`);
  if (needUnit) notes.push(`<div class="callout warn small">${foreign ? '海外の会社' : '関連会社'}には、事業が1つ以上要ります。下の一覧から選んでください。</div>`);
  const intro = foreign ? '海外の会社は、就任の時に設立したばかりの現地法人です（過去の決算書はありません）。'
    : hist ? '先代のころからの会社として、過去4期分の決算書と帳簿つきで始まります。'
    : '事業を選ぶと、先代のころからの会社として過去4期分の決算書つきで始まります。事業がなければ、株式を持つだけの会社（中間持株会社）として就任の時に設立します。';
  const body = `<div class="sg-form"><p class="small" style="margin:0">${intro}株式を持つ会社は、この会社の株式を、就任の時点の純資産の持分の額で持ちます。</p>
    <div class="grid g2 sg-grid">
      <label class="field"><span>社名</span><input type="text" id="sgName" data-ch="kSgName" value="${esc(e.name)}" maxlength="40" placeholder="空欄なら自動で決まります"></label>
      <label class="field"><span>株式を持つ会社</span><select data-ch="kSgOwner">${owners.map(([v, l]) => `<option value="${esc(v)}"${e.owner === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    </div>
    <div class="field"><span>持分（議決権）</span><div class="seg wrap" role="radiogroup" aria-label="持分">${own}</div><span class="small muted">${e.own > 0.5 ? `51%以上は連結子会社（全部を連結）。${e.own < 1 ? `残りの${Math.round((1 - e.own) * 100)}%はほかの会社が持つ合弁会社です。` : ''}` : '50%以下は関連会社（持分法で、利益の持分だけを取り込む）。経営は相手の会社が主導し、下に会社は持てません。'}</span></div>
    <div class="grid g2 sg-grid">
      <label class="field"><span>国</span><select data-ch="kSgCc" aria-label="国">${ccOpts}</select></label>
      ${foreign ? `<div class="field"><span>${esc(C.n)}</span><span class="small">現地法人（就任の時に設立）。法人税 約${C.cit}%・ワーカーの月給 約${fmtNum(C.wk, 0)}ドル。海外の会社は下に会社を持てません。</span></div>` : `<label class="field"><span>所在地</span>${ksSgPrefSelect(k, e.pref)}</label>`}
    </div>
    ${notes.join('')}
    <div class="field"><span>事業（いくつでも${ksSgCanOwn(e) ? '。なくてもよい' : ''}）</span>${chosen ? `<ul class="sunits">${chosen}</ul>` : `<div class="small muted">${ksSgCanOwn(e) ? '事業がなければ、ほかの会社の株式を持つだけの会社（中間持株会社）になります。' : 'まだ選んでいません。'}</div>`}</div>
    <div class="field"><span>業種を選んで加える（押すたびに加える・外す）</span>${ksTbHtml('sg', { id: 'sgQ', ph: '例：ソフトウェア、物流、介護、ホテル、リニア' })}</div>
    ${hist ? `<div class="field"><span>会社の状態</span><div class="seg" role="radiogroup" aria-label="会社の状態">${conds}</div><span class="small muted">${esc(KS_COND[e.cond].desc)}</span></div>` : ''}
    <div class="grid g3 cu-nums">${num('capital', '資本金（万円）')}${num('cash', '現預金（万円）')}${num('debt', '借入金（万円）')}</div>
    <span class="small muted" style="margin-top:-6px">${hist ? '空欄の項目は、選んだ会社の状態のまま。入れた額に合わせて、増資・減資・配当・借入・繰上返済の仕訳をします。' : '現預金は、立ち上げの設備を買った後に残る額。空欄なら、半年ほどの運転資金を株主が出資します。借入金を入れると、その額を銀行から借りて始めます。'}</span></div>`;
  const foot = btn('やめる', 'closeModal') + btn(D.id ? 'この設定にする' : 'この会社を加える', 'kSgSave', {}, 'primary', { disabled: needUnit });
  const where = e.owner === 'root' ? '親会社の直下' : `${ownerName}の下`;
  return modalFrame(D.id ? '会社の設定を変える' : '会社を加える', body, foot, { size: 'wide', sub: `就任の時点のグループ（${esc(where)}）` });
};
Object.assign(ACTIONS, {
  kSgAdd: d => { ksStartStore(); const k = ksStartDefaults(); ksSgFix(k); UI.sg = { id: null, e: ksSgBlank(d.owner), q: '' }; ksTbReset('sg'); showModal('kSg'); },
  kSgEdit: d => {
    ksStartStore();
    const e = ksSgList(ksStartDefaults()).find(x => x.id === d.id);
    if (!e) return;
    UI.sg = { id: e.id, e: Object.assign({}, e, { units: e.units.map(x => Object.assign({}, x)) }), q: '' }; ksTbReset('sg');
    showModal('kSg');
  },
  kSgDel: d => {
    ksStartStore();
    const list = ksSgList(ksStartDefaults());
    const i = list.findIndex(x => x.id === d.id);
    if (i < 0) return;
    const e = list[i];
    for (const x of list) if (x.owner === e.id) x.owner = e.owner; // 下の会社は、外した会社の持ち主の下に移す
    list.splice(i, 1);
    render();
  },
  kSgOwn: d => { ksSgStoreInputs(); UI.sg.e.own = +d.v; ksSgRedraw(); },
  kSgCond: d => { ksSgStoreInputs(); UI.sg.e.cond = d.v; ksSgRedraw(); },
  kSgSc: d => { ksSgStoreInputs(); const x = UI.sg.e.units[+d.i]; if (x) x.sc = +d.v; ksSgRedraw(); },
  kSgUDel: d => { ksSgStoreInputs(); UI.sg.e.units.splice(+d.i, 1); ksSgRedraw(); },
  kSgUAdd: d => {
    ksSgStoreInputs();
    const us = UI.sg.e.units;
    const i = us.findIndex(x => x.type === d.v);
    if (i >= 0) us.splice(i, 1); else if (KS_TYPES[d.v]) us.push({ type: d.v, sc: 1 });
    ksSgRedraw();
  },
  kSgSave: () => {
    ksSgStoreInputs();
    const k = ksStartDefaults(), D = UI.sg;
    const list = ksSgList(k);
    const e = D.e;
    if (ksSgNeedsUnit(e) && !e.units.length) { toast(`${e.cc !== 'jp' ? '海外の会社' : '関連会社'}には、事業が1つ以上要ります`, 'bad'); return; }
    const nm = ksSgName(e);
    if (nm && (nm === ksSgRootName(k) || list.some(x => x.id !== D.id && ksSgName(x) === nm))) { toast('グループの中に同じ社名の会社があります。別の名前にしてください', 'bad'); return; }
    e.name = (e.name || '').trim();
    if (D.id) { const i = list.findIndex(x => x.id === D.id); if (i >= 0) list[i] = e; else list.push(e); }
    else { k.grpSeq = (k.grpSeq || 0) + 1; e.id = 'g' + k.grpSeq; while (list.some(x => x.id === e.id)) e.id = 'g' + (++k.grpSeq); list.push(e); }
    ksSgFix(k);
    UI.sg = null;
    closeModal();
  },
});
Object.assign(CHANGES, {
  kSgName: el => { if (UI.sg) UI.sg.e.name = el.value; },
  kSgNum: el => { if (UI.sg) UI.sg.e[el.dataset.k] = el.value; },
  kSgOwner: el => { ksSgStoreInputs(); UI.sg.e.owner = el.value; ksSgRedraw(); },
  kSgCc: el => { ksSgStoreInputs(); UI.sg.e.cc = el.value; ksSgRedraw(); },
  kSgPref: el => { if (UI.sg) UI.sg.e.pref = +el.value; },
  kSgCap: el => {
    const x = UI.sg && UI.sg.e.units[+el.dataset.i];
    if (!x) return;
    x.sc = ksCapToSc(x.type, el.value);
    const n = ksScToCap(x.type, x.sc);
    if (+el.value !== n) el.value = n;
    for (const b of document.querySelectorAll(`[data-act="kSgSc"][data-i="${+el.dataset.i}"]`)) b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.v - x.sc) < 1e-9));
  },
  kSgGrow: el => { const x = UI.sg && UI.sg.e.units[+el.dataset.i]; if (x) x.g = +el.value; },
});

/* 就任するときに渡す設定（金額は円に） */
function ksSgOptions(k) {
  ksSgFix(k);
  const man = v => { const s = String(v ?? '').trim(); const n = parseFloat(s.replace(/[^0-9.]/g, '')); return s !== '' && Number.isFinite(n) ? Math.round(n) * 1e4 : null; };
  return ksSgList(k).map(e => ({ id: e.id, name: e.name, owner: e.owner, own: e.own, cc: e.cc, pref: +e.pref || 0, units: e.units.map(x => ({ type: x.type, sc: x.sc, g: +x.g || 0 })), cond: e.cond, capital: man(e.capital) || 0, cash: man(e.cash) || 0, debt: man(e.debt) }));
}
/* 会社が多いときは、「つくっています」と出してから始める（画面が止まって見えないように） */
const ksSgStart0 = ACTIONS.kStart;
ACTIONS.kStart = d => {
  const k = ksStartDefaults();
  const n = ksSgList(k).length;
  if (n + k.units.length < 6) return ksSgStart0(d);
  if (UI.sgBusy) return;
  ksStartStore();
  UI.sgBusy = true;
  const b = document.querySelector('[data-act="kStart"]');
  if (b) { b.disabled = true; b.textContent = '準備しています…'; }
  toast(`${n ? `グループの会社（${n}社）と` : ''}過去の決算書をつくっています…`);
  const go = () => {
    try { ksSgStart0(d); } catch (err) { console.error(err); toast('始められませんでした：' + err.message, 'bad'); render(); } finally { UI.sgBusy = false; }
    for (const t of document.querySelectorAll('#toast-root .toast')) if (/つくっています/.test(t.textContent)) t.remove();
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0)); else setTimeout(go, 30);
};
