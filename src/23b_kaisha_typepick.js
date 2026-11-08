'use strict';
/* =========================================================
 *  23b_kaisha_typepick.js : 業種を選ぶ一覧（共通の部品）と、業種の「くわしく」
 *   産業（大分類）→ 分類（中分類）→ 業種 とたどる一覧と、言葉で探す欄。
 *   開始画面・新しい事業を始める・子会社の設立・就任の時点のグループで同じものを使う。
 *   くわしく：何をする商売か、売上の立ち方・成功のカギ・主なリスク、ふつうの規模の設備と人、
 *   お金の入り方、季節の波、許認可と法令、同じ分類の業種。
 * ========================================================= */

/* 事業の型ごとの補足（業種のカタログに書いていないときに使う） */
const KS_ENG_TIPS = {
  shop: { how: '店に来たお客さまに商品やサービスを売り、その場で現金やカードで受け取る。売上は客数×客単価。', kf: '立地と品ぞろえ、在庫の回転、客数に合わせた人手のシフト。', risk: '近くの競合店、売れ残りと廃棄、家賃と人件費の上昇。' },
  rest: { how: '料理と飲み物を出して、その場で受け取る。売上は席数×回転×客単価。', kf: '食材の原価率と人件費（FL比率）、常連のお客さま、立地。', risk: '食材の値上がり、人手不足、食中毒、近くの新しい店。' },
  mfg: { how: '設備で製品をつくり、取引先に納めて、1〜2か月後に代金を受け取る（掛け売り）。', kf: '設備の稼働率、材料の歩留まり、品質と納期、取引先の数。', risk: '主な取引先の発注の減少、材料とエネルギーの値上がり、設備の故障と事故。' },
  build: { how: '見積をして工事を受注し、契約・中間・完成に分けて代金を受け取る。完成までの立替が大きい。', kf: '見積の精度と工程の管理、現場監督の人数、下請けの確保。', risk: '資材の値上がり、工期の遅れ、事故、発注者の支払いの遅れ。' },
  trade: { how: '仕入れた商品を取引先に掛けで売る。粗利は薄く、売上の額は大きい。', kf: '仕入の条件、取引先の数と与信の管理、在庫の回転、物流。', risk: '取引先の倒産（貸倒れ）、在庫の値下がり、為替。' },
  pro: { how: '人の時間（人月・時間）を売る。売上は人数×単価×稼働率。', kf: '単価の高い仕事を取る営業、稼働率、採用と離職の少なさ。', risk: '人が辞めること、案件の途切れ、単価の値下がり。' },
  subs: { how: '会員・利用者から毎月の料金を受け取り、広告や手数料も得る。', kf: '利用者を獲得する費用、解約率、サービスの質。', risk: '競合のサービス、解約の増加、システムの障害と情報の漏えい。' },
  cap: { how: '施設や設備の能力を使ってもらい、使った分の料金を受け取る。売上は能力×稼働率×単価。', kf: '稼働率を高く保つこと、単価、設備投資に見合う需要。', risk: '需要の落ち込み（固定費が重い）、設備の故障、大きな設備投資の借入。' },
  trans: { how: '人や物を運んで運賃を受け取る。売上は車両の数×輸送力×利用率×運賃。', kf: '利用率（積載率・搭乗率）、燃料の費用、乗務員の確保、整備。', risk: '燃料の値上がり、事故、乗務員の不足、景気による需要の変動。' },
};
/* 分類が多い産業は、間に「業界」の段を入れる。並びは日本標準産業分類の中分類の順。
   分類の名前の（　）の前（中分類の名前）で先に振り分け、決まらなければ（　）の中も見る。上から順に当てはまったもの */
const KS_SEC_DIVS = {
  E: [
    ['食料品・飼料', /食料品|食品|菓子|調味料|畜産|水産|野菜|果実|惣菜|めん|麺|豆腐|納豆|大豆|ペットフード|飼料|糖類|精穀|製粉|パン|乳製品|卵|農産加工|穀物|米飯|冷凍食品|レトルト|油脂|健康食品|栄養|食肉|製菓/],
    ['飲料・たばこ', /酒|飲料|茶|コーヒー|製氷|たばこ/],
    ['繊維・衣服', /繊維|衣服|縫製|染色|捺染|和装|紡績|織物|ニット|寝具|かばん|服飾/],
    ['木材・家具', /木材|木製品|家具|^装備品|内装品|建具/],
    ['紙・印刷', /パルプ|紙|印刷|製本/],
    ['化学・医薬', /化学|医薬|バイオ|再生医療|細胞|樹脂|電池の材料|素材|CO2|クリーン燃料|化粧品|塗料|洗剤|肥料|火薬/],
    ['石油・プラスチック・ゴム', /石油|石炭|プラスチック|ゴム/],
    ['皮革・窯業・土石', /なめし革|革製品|毛皮|窯業|土石|ガラス|セメント|陶磁器|れんが|耐火物/],
    ['鉄鋼・非鉄金属', /鉄鋼|非鉄|製鉄|鋳造|鋳物|鍛造|圧延|製錬|精錬/],
    ['金属製品', /金属製品|めっき|ばね|ボルト|板金|溶接/],
    ['機械', /はん用機械|生産用機械|業務用機械|ロボット|工作機械|ポンプ|ベアリング|軸受|産業機械|農業機械|建設機械|医療機器/],
    ['半導体・電子部品', /半導体|電子部品|電子回路|デバイス|ウェーハ|液晶|プリント配線|ディスプレイ/],
    ['電気・情報通信機械', /電気機械|情報通信機械|蓄電池|燃料電池|充電器|電動化|量子|家電|通信機器|コンピュータ|照明|電線/],
    ['輸送用機械', /輸送用機械|自動車|ドローン|空飛ぶ|自動運転|船舶|造船|鉄道車両|航空機|二輪/],
    ['防衛・宇宙・原子力', /防衛|宇宙|原子|核融合|ロケット|衛星/],
    ['その他の製造業', /./],
  ],
};
/* 分類（グループ）の業界 */
function ksTbDivOf(g) {
  const L = KS_SEC_DIVS[g.sec];
  if (!L) return '';
  if (g.div !== undefined) return g.div;
  const last = L[L.length - 1][0];
  const base = g.grp.replace(/（.*$/, '');
  const hit = t => (L.slice(0, -1).find(([, re]) => re.test(t)) || [])[0];
  g.div = /^その他の製造業/.test(base) ? last : hit(base) || hit(g.grp) || last;
  return g.div;
}
const KS_MONTHS_FY = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];

/* ---------- 使う場所ごとの決まり ----------
 * on：選んでいるか  main：行を押したときの操作 [act, data]  acts：行の右のボタン  foot：くわしくの下のボタン  doIt：くわしくから選んだとき */
const KS_TB_CTX = {
  // 開始画面：行を押すと「くわしく」。「これにする」（この業種だけにする）か「＋加える」
  st: {
    on: S => ksStartDefaults().units.some(x => x.type === S.name),
    main: S => ['kTbInfo', { ctx: 'st', v: S.name }],
    acts: (S, on) => on ? '<span class="tag ok">選んでいる</span>' : btn('これにする', 'kStPick', { v: S.name }, 'sm primary') + btn('＋加える', 'kStAdd', { v: S.name }, 'sm'),
    foot: (S, on) => on ? btn('選んでいる', 'noop', {}, 'primary', { disabled: true }) : btn('＋事業に加える', 'kTiDo', { ctx: 'st', v: S.name, how: 'add' }) + btn('この業種にする', 'kTiDo', { ctx: 'st', v: S.name, how: 'pick' }, 'primary'),
    doIt: (v, how) => ACTIONS[how === 'add' ? 'kStAdd' : 'kStPick']({ v }),
  },
  // 新しい事業を始める：行を押すと右に中身と計画が出る
  nu: {
    skip: () => (G ? new Set(ksActiveUnits().map(u => u.type)) : null),
    on: S => !!(UI.kNU && UI.kNU.sel === S.name),
    main: S => ['kNUPick', { v: S.name }],
    acts: () => '',
    foot: S => btn('この業種を選ぶ', 'kTiDo', { ctx: 'nu', v: S.name }, 'primary'),
    doIt: v => ACTIONS.kNUPick({ v }),
  },
  // 子会社・関連会社の設立
  gf: {
    on: S => !!(UI.kGF && UI.kGF.type === S.name),
    main: S => ['kGFpick', { v: S.name }],
    acts: S => btn('くわしく', 'kTbInfo', { ctx: 'gf', v: S.name }, 'sm ghost'),
    foot: (S, on) => on ? btn('選んでいる', 'noop', {}, 'primary', { disabled: true }) : btn('この業種で設立する', 'kTiDo', { ctx: 'gf', v: S.name }, 'primary'),
    doIt: v => ACTIONS.kGFpick({ v }),
  },
  // 就任の時点のグループの会社の事業（押すたびに加える・外す）
  sg: {
    on: S => !!(UI.sg && UI.sg.e && UI.sg.e.units.some(x => x.type === S.name)),
    main: S => ['kSgUAdd', { v: S.name }],
    acts: S => btn('くわしく', 'kTbInfo', { ctx: 'sg', v: S.name }, 'sm ghost'),
    foot: (S, on) => btn(on ? 'この会社の事業から外す' : 'この会社の事業に加える', 'kTiDo', { ctx: 'sg', v: S.name }, on ? '' : 'primary'),
    doIt: v => ACTIONS.kSgUAdd({ v }),
  },
};
function ksTb(ctx) {
  UI.tb = UI.tb || {};
  return UI.tb[ctx] || (UI.tb[ctx] = { q: '', sec: '', div: '', grp: '', eng: '', lim: 60 });
}
function ksTbReset(ctx) { if (UI.tb) delete UI.tb[ctx]; }
function ksDataAttr(o) { return Object.entries(o).map(([k, v]) => ` data-${k}="${esc(v)}"`).join(''); }
/* 説明を一覧の1〜2行に収まる長さにする */
function ksTbShort(s, n = 64) { s = String(s || ''); const i = s.indexOf('。'); const a = i > 0 && i < n ? s.slice(0, i + 1) : s; return a.length > n ? a.slice(0, n - 1) + '…' : a; }
function ksTbRow(ctx, S, lv) {
  const C = KS_TB_CTX[ctx];
  const on = C.on(S);
  const [act, data] = C.main(S);
  const meta = lv === 2 ? KS_ENG_INFO[S.eng].n : `${S.grp}・${KS_ENG_INFO[S.eng].n}`;
  const acts = C.acts(S, on);
  const press = act === 'kTbInfo' ? '' : ` aria-pressed="${on}"`;
  return `<li class="tbt${on ? ' on' : ''}"><button type="button" class="tbt-main" data-act="${act}"${ksDataAttr(data)}${press}><span class="indico" aria-hidden="true">${esc(S.icon)}</span><span class="tbt-t"><b>${esc(S.name)}</b><span class="tbt-d">${esc(ksTbShort(S.d || S.gd || KS_ENG_INFO[S.eng].desc))}</span><span class="tbt-m">${esc(meta)}${act === 'kTbInfo' ? '<span class="tbt-more">くわしく</span>' : ''}</span></span></button>${acts ? `<span class="tbt-a">${acts}</span>` : ''}</li>`;
}
function ksTbKeep(T, skip) { return S => (!T.eng || S.eng === T.eng) && !(skip && skip.has(S.name)); }
function ksTbBody(ctx) {
  const T = ksTb(ctx), C = KS_TB_CTX[ctx];
  const skip = C.skip ? C.skip() : null;
  const q = (T.q || '').trim();
  if (q) {
    const r = ksTypeFind(q, { eng: T.eng, limit: T.lim, skip });
    if (!r.total) return `<div class="empty">「${esc(q)}」に当てはまる業種がありません。短い言葉や別の言い方で探すか、下の産業から選んでください。<div class="row" style="justify-content:center;margin-top:8px">${btn('産業から選ぶ', 'kTbClear', { ctx }, 'sm')}</div></div>`;
    return `<div class="tb-hd"><span>「${esc(q)}」で${fmtNum(r.total, 0)}業種${T.eng ? `（${esc(KS_ENG_INFO[T.eng].n)}）` : ''}。名前に入っているものから順に</span>${btn('産業から選ぶ', 'kTbClear', { ctx }, 'sm ghost')}</div>
      <ul class="tb-list tbts">${r.list.map(S => ksTbRow(ctx, S, 9)).join('')}</ul>${r.total > r.list.length ? `<div class="tb-more">${btn(`もっと見る（あと${fmtNum(r.total - r.list.length, 0)}業種）`, 'kTbMore', { ctx }, 'sm')}</div>` : ''}`;
  }
  const ix = ksGrpIndex();
  const keep = ksTbKeep(T, skip);
  if (!T.sec || !KS_SECTORS[T.sec]) {
    const tiles = Object.entries(KS_SECTORS).map(([c, x]) => {
      const gs = ix.bySec[c] || [];
      const n = sum(gs, g => g.types.filter(keep).length);
      if (!n) return '';
      return `<button type="button" class="tb-sec" data-act="kTbSec" data-ctx="${ctx}" data-v="${c}"><span class="indico" aria-hidden="true">${esc(x.icon)}</span><span class="tbt-t"><b>${esc(x.n)}</b><span class="tbt-m">${fmtNum(n, 0)}業種・${fmtNum(gs.filter(g => g.types.some(keep)).length, 0)}分類</span></span></button>`;
    }).join('');
    return `<div class="tb-hd"><span>産業を選ぶと、その中の分類が出ます。言葉で探すこともできます</span></div><div class="tb-list tb-secs">${tiles}</div>`;
  }
  const all = (ix.bySec[T.sec] || []).filter(g => g.types.some(keep));
  const g = T.grp ? ix.byKey[T.sec + '|' + T.grp] : null;
  const divs = KS_SEC_DIVS[T.sec] && all.length > 40 ? KS_SEC_DIVS[T.sec] : null;
  const div = divs ? (g ? ksTbDivOf(g) : T.div) : '';
  const gs = div ? all.filter(x => ksTbDivOf(x) === div) : all;
  const secN = esc(KS_SECTORS[T.sec].n);
  const sep = '<span aria-hidden="true">›</span>';
  const crumb = `<nav class="tb-crumb" aria-label="いまの分類"><button type="button" data-act="kTbSec" data-ctx="${ctx}" data-v="">すべての産業</button>${sep}${
    !div && !g ? `<b>${secN}</b>` : `<button type="button" data-act="kTbSec" data-ctx="${ctx}" data-v="${T.sec}">${secN}</button>${sep}${
      div && !g ? `<b>${esc(div)}</b>` : `${div ? `<button type="button" data-act="kTbGrp" data-ctx="${ctx}" data-v="">${esc(div)}</button>${sep}` : ''}<b>${esc(g.grp)}</b>`}`}</nav>`;
  // 業界の一覧（製造業のように分類が多い産業）
  if (divs && !div && !g) {
    const tiles = divs.map(([dn]) => {
      const dg = all.filter(x => ksTbDivOf(x) === dn);
      const n = sum(dg, x => x.types.filter(keep).length);
      if (!n) return '';
      const ex = dg.slice(0, 3).map(x => x.grp.replace(/（.*$/, '')).join('、');
      return `<li><button type="button" class="tb-grp" data-act="kTbDiv" data-ctx="${ctx}" data-v="${esc(dn)}"><span class="indico" aria-hidden="true">${esc(dg[0].icon)}</span><span class="tbt-t"><b>${esc(dn)}</b><span class="tbt-m">${esc(ksTbShort(ex, 60))}${dg.length > 3 ? 'など' : ''}・${fmtNum(dg.length, 0)}分類</span></span><span class="tb-n">${fmtNum(n, 0)}</span></button></li>`;
    }).join('');
    return `${crumb}<div class="tb-hd"><span>${secN}：${fmtNum(all.length, 0)}分類・${fmtNum(sum(all, x => x.types.filter(keep).length), 0)}業種。業界を選んでください</span></div><ul class="tb-list tb-grps">${tiles}</ul>`;
  }
  if (!g) {
    const rows = gs.map(x => {
      const n = x.types.filter(keep).length;
      const ex = x.types.filter(keep).slice(0, 3).map(S => S.name).join('、');
      return `<li><button type="button" class="tb-grp" data-act="kTbGrp" data-ctx="${ctx}" data-v="${esc(x.grp)}"><span class="indico" aria-hidden="true">${esc(x.icon)}</span><span class="tbt-t"><b>${esc(x.grp)}</b><span class="tbt-d">${esc(ksTbShort(x.d, 56))}</span><span class="tbt-m">${esc(ksTbShort(ex, 60))}${n > 3 ? 'など' : ''}</span></span><span class="tb-n">${fmtNum(n, 0)}</span></button></li>`;
    }).join('');
    return `${crumb}<div class="tb-hd"><span>${div ? esc(div) : secN}：${fmtNum(gs.length, 0)}分類・${fmtNum(sum(gs, x => x.types.filter(keep).length), 0)}業種</span></div><ul class="tb-list tb-grps">${rows}</ul>`;
  }
  const list = g.types.filter(keep);
  return `${crumb}${g.d ? `<p class="tb-gd">${esc(g.d)}</p>` : ''}<ul class="tb-list tbts">${list.map(S => ksTbRow(ctx, S, 2)).join('') || '<li class="empty">この分類で選べる業種はありません</li>'}</ul>`;
}
/* 一覧の全体（探す欄・事業の型・中身） */
function ksTbHtml(ctx, o = {}) {
  const T = ksTb(ctx);
  const engs = Object.entries(KS_ENG_INFO).map(([c, x]) => `<option value="${c}"${T.eng === c ? ' selected' : ''}>${esc(x.n)}</option>`).join('');
  return `<div class="tb" data-ctx="${ctx}">
    <div class="tb-bar"><input type="search"${o.id ? ` id="${o.id}"` : ''} class="tb-q" value="${esc(T.q)}" data-in="kTbQ" data-ctx="${ctx}" placeholder="${esc(o.ph || '業種・商品で探す（例：リニア、介護、半導体）')}" aria-label="業種を探す" autocomplete="off">
      <select data-ch="kTbEng" data-ctx="${ctx}" aria-label="事業の型でしぼる"><option value="">すべての型</option>${engs}</select></div>
    <div class="tb-body${o.tall ? ' tall' : ''}" id="tbb-${ctx}">${ksTbBody(ctx)}</div></div>`;
}
function ksTbRedraw(ctx, top) {
  const b = document.getElementById('tbb-' + ctx);
  if (!b) return;
  const l = b.querySelector('.tb-list');
  const y = l && !top ? l.scrollTop : 0;
  b.innerHTML = ksTbBody(ctx);
  const l2 = b.querySelector('.tb-list');
  if (l2) l2.scrollTop = y;
}
KEEP_SCROLL.push('.tb-list');
Object.assign(ACTIONS, {
  kTbSec: d => { const T = ksTb(d.ctx); T.sec = d.v; T.div = ''; T.grp = ''; T.q = ''; T.lim = 60; const i = document.querySelector(`.tb[data-ctx="${d.ctx}"] .tb-q`); if (i) i.value = ''; ksTbRedraw(d.ctx, true); },
  kTbGrp: d => { const T = ksTb(d.ctx); if (!d.v && T.grp) { const g = ksGrpIndex().byKey[T.sec + '|' + T.grp]; if (g) T.div = ksTbDivOf(g); } T.grp = d.v; ksTbRedraw(d.ctx, true); },
  kTbDiv: d => { const T = ksTb(d.ctx); T.div = d.v; T.grp = ''; ksTbRedraw(d.ctx, true); },
  kTbMore: d => { ksTb(d.ctx).lim += 120; ksTbRedraw(d.ctx); },
  kTbClear: d => { const T = ksTb(d.ctx); T.q = ''; T.lim = 60; T.sec = ''; T.div = ''; T.grp = ''; const i = document.querySelector(`.tb[data-ctx="${d.ctx}"] .tb-q`); if (i) i.value = ''; ksTbRedraw(d.ctx, true); },
  // くわしく：ダイアログの上から開いたら、閉じると元のダイアログに戻る
  kTbInfo: d => { if (!KS_TYPES[d.v]) return; const back = !!(UI.modal && UI.modal.name !== 'kTypeInfo') || !!(UI.modal && UI.modal.name === 'kTypeInfo' && UI.modal.args.back); if (UI.modal && UI.modal.name !== 'kTypeInfo') pushModalBack('kTypeInfo'); showModal('kTypeInfo', { v: d.v, ctx: d.ctx || '', back }); },
  kTiDo: d => {
    const a = UI.modal && UI.modal.args;
    const v = d.v || (a && a.v);
    const C = KS_TB_CTX[d.ctx];
    if (!C || !KS_TYPES[v]) return;
    closeModal(true);
    C.doIt(v, d.how);
  },
  noop: () => {},
});
CHANGES.kTbEng = el => { const T = ksTb(el.dataset.ctx); T.eng = el.value; T.lim = 60; ksTbRedraw(el.dataset.ctx, true); };
INPUTS.kTbQ = el => { const T = ksTb(el.dataset.ctx); T.q = el.value; T.lim = 60; ksTbRedraw(el.dataset.ctx, true); };

/* ---------- 業種の「くわしく」 ---------- */
function ksSeasonTxt(S) {
  const s = S.season || [];
  if (!s.length) return '';
  const mx = Math.max(...s), mn = Math.min(...s);
  if (mx / mn < 1.12) return '1年を通して、ほぼ同じ';
  const hi = s.map((v, i) => [v, i]).filter(x => x[0] >= 1.07).sort((a, b) => b[0] - a[0]).slice(0, 3).map(x => KS_MONTHS_FY[x[1]]);
  const lo = s.map((v, i) => [v, i]).filter(x => x[0] <= 0.93).sort((a, b) => a[0] - b[0]).slice(0, 2).map(x => KS_MONTHS_FY[x[1]]);
  const amp = mx / mn >= 1.6 ? '季節の波がとても大きい' : mx / mn >= 1.3 ? '季節の波が大きい' : '季節の波は小さめ';
  return `${amp}${hi.length ? `。${hi.join('・')}に多く` : ''}${lo.length ? `、${lo.join('・')}に少ない` : ''}`;
}
function ksCashTxt(S) {
  const P = S.p;
  const pct = x => `${Math.round(x * 100)}%`;
  switch (S.eng) {
    case 'shop': case 'rest': return `その場で受け取る日銭の商売${P.card ? `。カード払い（約${pct(P.card)}）は翌月に入金` : ''}${P.ins ? `、保険や公費の分（約${pct(P.ins)}）は2か月後に入金` : ''}`;
    case 'mfg': return `製品を納めて、約${P.terms}か月後に入金（掛け売り）。材料は先に仕入れ、在庫も持つので、売上が伸びると運転資金が要る`;
    case 'build': return '契約・中間・完成に分けて受け取る（未成工事受入金）。材料と外注の支払いが先に出るので、つなぎの資金が要る';
    case 'trade': return `掛けで売り（1〜2か月後に入金。2か月の取引先が約${pct(P.terms2 || 0)}）、掛けで仕入れる。売上が大きく粗利は薄いので、貸倒れが痛い`;
    case 'pro': return `月末で締めて、約${P.terms}か月後に入金。給料は先に出ていく`;
    case 'subs': return P.b2b ? '法人に月額を請求し、翌月に入金' : '月額をカードや口座振替で受け取る（多くは翌月に入金）。前もって獲得の費用がかかる';
    case 'cap': case 'trans': return P.ar >= 0.95 ? `使った分を請求し、約${P.terms}か月後に入金（掛け）` : P.ar <= 0.05 ? 'その場や前払いで受け取る' : `約${pct(1 - P.ar)}はその場で、約${pct(P.ar)}は掛けで約${P.terms}か月後に入金`;
    default: return '';
  }
}
function ksEqTxt(S) {
  const rows = [];
  for (const e of [...(S.eq || []), ...(S.aux || [])]) {
    const q = KS_EQ[e.k];
    if (!q) continue;
    rows.push(`${esc(e.name || q.n)} ×${fmtNum(e.n, 0)}（1つ ${fmtYen(q.c)}）`);
  }
  return rows.slice(0, 6).join('<br>');
}
function ksProjTxt(S) {
  return (S.p.proj || []).map(s => { const [k, n] = String(s).split(':'); const p = KS_PROJ_LIB[k]; return p ? `${esc(p.n)}（${fmtYen(p.min)}〜${fmtYen(p.max)}・工期 約${p.dur}か月）年${fmtNum(+n || 0, 0)}件` : ''; }).filter(Boolean).slice(0, 5).join('<br>');
}
/* 業種の特徴のしるし（一目でわかるように） */
function ksTypeBadges(S) {
  const out = [tag(KS_ENG_INFO[S.eng].n, 'solid')];
  const eqC = sum([...(S.eq || []), ...(S.aux || [])], e => ((KS_EQ[e.k] || {}).c || 0) * e.n);
  if (eqC >= 50e8 || S.scale >= 3) out.push(tag('設備投資がとても大きい', 'warn'));
  else if (eqC >= 5e8 || ['cap', 'trans'].includes(S.eng)) out.push(tag('設備投資が大きい', 'brass'));
  if (S.lic) out.push(tag('許認可が要る', 'brass'));
  if ((S.laws || []).length >= 2) out.push(tag('守る法令が多い', 'brass'));
  const s = S.season || [];
  if (s.length && Math.max(...s) / Math.min(...s) >= 1.3) out.push(tag('季節の波が大きい', ''));
  if (['mfg', 'build', 'trade'].includes(S.eng)) out.push(tag('運転資金が要る', ''));
  if (['shop', 'rest'].includes(S.eng)) out.push(tag('日銭が入る', 'ok'));
  if (S.eng === 'subs') out.push(tag('毎月の定額収入', 'ok'));
  return out.join('');
}
/* 業種の中身。compact：新しい事業のダイアログの右側に出す短い版 */
function ksTypeInfoHtml(S, o = {}) {
  const tip = KS_ENG_TIPS[S.eng] || {};
  const ci = ksCapInfo(S.name);
  const three = [['売上の立ち方', S.how || tip.how, 'how'], ['成功のカギ', S.kf || tip.kf, 'kf'], ['主なリスク', S.risk || tip.risk, 'risk']]
    .map(([h, t, c]) => `<section class="ti-c ti-${c}"><h4>${h}</h4><p>${esc(t || '')}</p></section>`).join('');
  const rows = [
    ['ふつうの規模', `${esc(ci.n)} ${fmtNum(ci.base, 0)}${esc(ci.u)}${S.scale > 1 ? `（大きな業種：ふつうの会社の約${S.scale}倍の規模）` : ''}`],
    S.eng === 'build' ? ['受ける工事', ksProjTxt(S)] : ksEqTxt(S) ? ['主な設備', ksEqTxt(S)] : null,
    ['働く人', esc(S.roles.map(r => r.n).join('、'))],
    S.prod.length ? ['商品・サービス', esc(S.prod.slice(0, 6).join('、'))] : null,
    S.cust.length ? ['お客さま', esc(S.cust.slice(0, 6).join('、'))] : null,
    ['お金の入り方', esc(ksCashTxt(S))],
    ['季節', esc(ksSeasonTxt(S))],
    S.lic ? ['許認可', `${esc(S.lic.n)}（${esc(S.lic.law)}${S.lic.every ? `・${S.lic.every}年ごとに更新` : ''}）`] : null,
    (S.laws || []).length ? ['とくに守る法令', esc(S.laws.map(l => (LAW_ITEMS[l] || { s: l }).s).join('、'))] : null,
    ['利益率の目安', `営業利益率 約${fmtNum(KS_ENG_OPM[S.eng] * 100, 1)}%（会社の状態が「ふつう」のときの、就任の時点の水準）`],
  ];
  if (o.compact) return `<p class="ti-d">${esc(S.d || S.gd || KS_ENG_INFO[S.eng].desc)}</p><div class="ti-badges">${ksTypeBadges(S)}</div><div class="ti-3 sm">${three}</div>${kv(rows.filter(r => r && /設備|受ける工事|働く人|お客さま|お金|季節|許認可|法令/.test(r[0])))}`;
  const ix = ksGrpIndex();
  const g = ix.byKey[S.sec + '|' + S.grp];
  const sib = g ? g.types.filter(x => x.name !== S.name).slice(0, 14) : [];
  return `<div class="ti-head"><span class="indico ti-ico" aria-hidden="true">${esc(S.icon)}</span><div><div class="small muted">${esc(KS_SECTORS[S.sec].n)} › ${esc(S.grp)}</div><div class="ti-badges">${ksTypeBadges(S)}</div></div></div>
    <p class="ti-d">${esc(S.d || S.gd || KS_ENG_INFO[S.eng].desc)}</p>
    ${S.d && S.gd && S.gd !== S.d ? `<p class="small muted ti-gd">${esc(S.grp)}：${esc(S.gd)}</p>` : ''}
    <div class="ti-3">${three}</div>
    <h4 class="ti-h">ふつうの規模で始めると</h4>${kv(rows)}
    <h4 class="ti-h">事業の型：${esc(KS_ENG_INFO[S.eng].n)}</h4><p class="small" style="margin:0">${esc(KS_ENG_INFO[S.eng].desc)}</p>
    ${sib.length ? `<h4 class="ti-h">同じ分類の業種（${fmtNum(g.types.length - 1, 0)}）</h4><div class="chips">${sib.map(x => `<button type="button" class="chip" data-act="kTbInfo" data-ctx="${esc(o.ctx || '')}" data-v="${esc(x.name)}">${esc(x.icon)} ${esc(x.name)}</button>`).join('')}</div>` : ''}`;
}
MODALS.kTypeInfo = a => {
  const S = KS_TYPES[a.v];
  if (!S) return modalFrame('業種', '<div class="empty">この業種はありません</div>', btn('閉じる', 'closeModal'));
  const C = KS_TB_CTX[a.ctx];
  const on = C ? C.on(S) : false;
  const foot = btn(a.back ? '戻る' : '閉じる', 'closeModal') + (C ? C.foot(S, on) : '');
  return modalFrame(esc(S.name), ksTypeInfoHtml(S, { ctx: a.ctx }), foot, { size: 'wide', label: S.name });
};
