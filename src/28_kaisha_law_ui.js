'use strict';
/* =========================================================
 *  28_kaisha_law_ui.js : 会社経営モードの「法令と安全」の画面と、
 *   労災の対応・立入検査・火災・送検の知らせのモーダル
 * ========================================================= */

KS_TABS.splice(2, 0, ['k_law', '法令と安全']);
const KS_ST_TAG = { ok: ['済', 'ok'], soon: ['近い', ''], due: ['要対応', 'warn'], over: ['期限切れ', 'bad'] };
function ksLawOpenInsp() { return G.law ? G.law.insp.filter(x => x.status === 'open') : []; }
function ksLawBadgeN() {
  if (!G.law) return 0;
  return ksLawTasks().filter(x => x.st === 'over').length + ksLawOpenInsp().length + (ksPartRoles().length && ksMinWageGap() > 0 ? 1 : 0);
}
const ksTabBadge0 = ksTabBadge;
ksTabBadge = id => {
  if (id !== 'k_law') return ksTabBadge0(id);
  const n = ksLawBadgeN();
  return n ? `<span class="badge${ksLawOpenInsp().length ? ' alert' : ''}">${n}</span>` : '';
};
/* 社長室の「今月やること」に法令の項目を加える */
const ksInbox0 = ksInbox;
ksInbox = () => {
  const out = ksInbox0();
  if (!G.law || G.over) return out;
  for (const ins of ksLawOpenInsp()) {
    const left = ins.finds.filter(f => !f.fixed).length;
    out.push({ ico: LAW_AG[ins.ag].icon, cls: 'bad', t1: `${LAW_AG[ins.ag].n}の指摘への対応（残り${left}件・期限${ymLabel(ins.due)}末）`, t2: left ? '期限までに直して是正報告書を出さないと、送検・公表などの処分に進みます' : 'すべて直しました。是正報告書を出しましょう', act: btn('対応する', 'kInspOpen', { id: ins.id }, 'sm primary') });
  }
  const over = ksLawTasks().filter(x => x.st === 'over');
  const due = ksLawTasks().filter(x => x.st === 'due');
  if (over.length) out.push({ ico: '法', cls: 'warn', t1: `法令で決められたことが${over.length}件、期限切れになっています`, t2: over.map(x => x.name).join('・'), act: btn('法令と安全へ', 'kGo', { tab: 'k_law' }, 'sm') });
  if (due.length) out.push({ ico: '法', t1: `今月までの法令の手続き：${due.map(x => x.name).join('・')}`, t2: '期限を過ぎると違反になります', act: btn('法令と安全へ', 'kGo', { tab: 'k_law' }, 'sm') });
  if (ksPartRoles().length && ksMinWageGap() > 0) out.push({ ico: '賃', cls: 'bad', t1: `パート・アルバイトの時給が最低賃金（${G.law.minWage}円）を下回っています`, t2: '差額を払う義務があり、労働基準監督署に申告されることもあります', act: btn('時給を引き上げる', 'kLawRaise', {}, 'sm primary') });
  const ot = G.law.otNow;
  if (ot > 80 || (ot > 45 && !G.law.special)) out.push({ ico: '時', cls: 'warn', t1: `残業が1人あたり月${fmtNum(ot, 0)}時間になっています`, t2: ot > 80 ? '過労死ライン（月80〜100時間）に近い水準です。人を増やすか仕事の量を調整しましょう' : '月45時間を超えるには36協定の特別条項が必要です', act: btn('法令と安全へ', 'kGo', { tab: 'k_law' }, 'sm') });
  return out;
};

/* ---------- 画面 ---------- */
KS_SCREENS.k_law = () => {
  const L = G.law;
  if (!L) return '<div class="empty">法令の情報がありません</div>';
  const tasks = ksLawTasks();
  const viol = ksLawViolations();
  const rows = tasks.map(x => {
    const it = LAW_ITEMS[x.t.item];
    const [tl, tc] = KS_ST_TAG[x.st];
    const can = x.st !== 'ok' || x.t.id === 'r36';
    return `<tr><td><b>${esc(x.name)}</b><div class="small muted">${esc(x.t.why)}</div></td><td>${LAW_AG[it.ag].s}<div class="small muted">${esc(it.law)}</div></td><td>${tag(tl, tc)}<div class="small muted">${esc(x.next)}</div></td><td class="n">${fmtYen(x.cost)}</td>
      <td class="n">${can ? btn(x.t.id === 'r36' ? '協定を届け出る' : x.st === 'ok' ? '実施' : '実施する', x.t.id === 'r36' ? 'kLawR36' : 'kLawDo', { id: x.t.id }, `sm${x.st === 'over' ? ' primary' : ''}`, { disabled: x.t.id === 'hoken' && x.st === 'ok' }) : ''}</td></tr>`;
  }).join('');
  const sp = L.policy;
  const emp = ksHeadcount();
  const pol = `<div class="field"><span>${term('安全衛生', 'safetyOrg')}への取り組み</span><div class="seg" role="radiogroup">${KS_SAFETY.map((x, i) => `<button type="button" data-act="kLawPolicy" data-k="safety" data-v="${i}" aria-pressed="${sp.safety === i}">${x.n}</button>`).join('')}</div>
      <span class="small muted">${KS_SAFETY[sp.safety].desc} 費用 月${fmtYen(emp * KS_SAFETY[sp.safety].cost)}（1人${fmtNum(KS_SAFETY[sp.safety].cost, 0)}円）。労災の起きやすさ ${fmtPct(KS_SAFETY[sp.safety].mul * 100, 0)}。</span></div>
    <label class="inline small"><input type="checkbox" data-act="kLawPolicy" data-k="fireIns" ${sp.fireIns ? 'checked' : ''}> 火災保険に入る（建物・設備・在庫。保険料は年0.11%程度）</label>
    <label class="inline small"><input type="checkbox" data-act="kLawPolicy" data-k="liabIns" ${sp.liabIns ? 'checked' : ''}> ${term('使用者賠償責任保険', 'liabIns')}に入る（労災の損害賠償に備える。1人月1,200円）</label>
    <label class="inline small"><input type="checkbox" data-act="kLawPolicy" data-k="yukyu" ${sp.yukyu ? 'checked' : ''}> ${term('年次有給休暇', 'annualLeave')}の計画的付与（全員が年5日以上休めるよう、休む日を決める）</label>`;
  const ot = L.otNow ?? ksOtHours();
  const otCls = ot > 80 ? 'neg' : ot > 45 ? 'warnc' : '';
  const otu = ksOtUnit();
  const otWhy = { shop: '売場の人員', rest: '厨房・ホールの人員', mfg: '残業の設定・設備の稼働', build: '現場の人1人あたりの工事', trade: '配送の能力と人員', pro: '稼働率', subs: '開発・運用の人員', cap: '施設のスタッフの人数', trans: '乗務員の人数' };
  const otRows = ksActiveUnits().length > 1 && L.otU ? ksActiveUnits().filter(u => L.otU[u.id] !== undefined).map(u => [`　${esc(ksUName(u))}`, `${fmtNum(L.otU[u.id], 0)}時間`]) : [];
  const otPanel = `${kv([[ksActiveUnits().length > 1 ? '残業（いちばん長い事業・1人・月）' : '残業（1人・月の見込み）', `<b class="${otCls}">${fmtNum(ot, 0)}時間</b>`], ...otRows, ['36協定', (L.doneFy.r36 ?? -99) >= fyOf(G.m) ? `届出済み（${L.special ? '特別条項あり：月100時間未満・年720時間まで' : '特別条項なし：月45時間まで'}）` : '<span class="neg">今年度の届出がない</span>'], ['直近6か月', L.otHist.length ? L.otHist.map(h => `${Math.round(h)}`).join('・') + '時間' : '―']])}
    <p class="note">${term('時間外労働の上限', 'otLimit')}は原則月45時間。特別条項があっても月100時間未満、2〜6か月平均80時間以内。人手不足（${otu ? `${ksActiveUnits().length > 1 ? esc(ksUName(otu)) + 'は' : ''}${otWhy[ksS(otu).eng] || '人員'}` : '人員'}）で残業が増えます。長い残業が続くと、過労による労災（脳・心臓疾患や精神障害）が起きやすくなります。</p>`;
  const mw = ksPartRoles().length ? panel('最低賃金', `${kv([['汐見県の最低賃金', `時給${L.minWage}円（毎年10月に改定）`], ...ksPartRoles().map(x => [`${esc(x.n)}の時給`, `<b class="${ksPartHourly(x) < L.minWage ? 'neg' : ''}">${fmtNum(ksPartHourly(x), 0)}円</b>（月${x.hours}時間）`])])}
      <div class="row" style="margin-top:8px">${btn('時給を最低賃金＋10円まで引き上げる', 'kLawRaise', {}, ksMinWageGap() > 0 ? 'primary sm' : 'sm', { disabled: ksMinWageGap() <= -10 })}</div><p class="note">${term('最低賃金', 'minWage')}を下回ると、差額の支払い義務と罰金（50万円以下）。改定のたびに人件費が上がるので、値上げや効率化で吸収できるかが課題です。</p>`) : '';
  const insp = L.insp.slice(0, 10).map(x => `<tr><td>${ymLabel(x.m)}</td><td>${LAW_AG[x.ag].n}<div class="small muted">${esc(x.kind)}${x.why ? `（申告：${esc(x.why)}）` : ''}</div></td><td>${x.finds.length ? x.finds.map(f => `${esc((LAW_ITEMS[f.item] || { s: '安全衛生の取り組み' }).s)}${f.fixed ? '<span class="small muted">（是正済み）</span>' : ''}`).join('・') : '<span class="muted">指摘なし</span>'}</td>
    <td>${x.status === 'open' ? `${tag(`期限 ${ymLabel(x.due)}`, 'warn')} ${btn('対応する', 'kInspOpen', { id: x.id }, 'sm')}` : x.status === 'soken' ? tag('送検・命令', 'bad') : tag('完了', 'ok')}</td></tr>`).join('');
  const sevN = { none: '休業なし', short: '休業1〜3日', long: '休業4日以上', death: '死亡' };
  const accs = L.acc.slice(0, 10).map(a => `<tr><td>${ymLabel(a.m)}</td><td>${esc(a.text)}</td><td>${tag(sevN[a.sev], a.sev === 'death' ? 'bad' : a.sev === 'long' ? 'warn' : '')}</td><td>${a.status === 'new' ? btn('対応する', 'kRosaiOpen', { id: a.id }, 'sm primary') : a.sev === 'none' ? '<span class="small muted">報告不要</span>' : a.conceal ? (a.found ? tag('労災かくし発覚', 'bad') : tag('未報告', 'bad')) : '<span class="small">報告済み</span>'}</td></tr>`).join('');
  const fires = L.fires.slice(0, 5).map(f => `<tr><td>${ymLabel(f.m)}</td><td>${esc(f.b)}：${esc(f.cause)}</td><td>${f.large ? tag('火災', 'bad') : tag('ぼや')}</td><td class="n">${fmtYen(f.loss)}${f.ins ? `<div class="small muted">保険 ${fmtYen(f.ins)}</div>` : ''}</td></tr>`).join('');
  const learn = [...new Set(tasks.map(x => x.t.item).concat(['otmax', 'report', 'hinan']))].filter(k => LAW_ITEMS[k]).map(k => { const it = LAW_ITEMS[k]; return `<details class="lawitem"><summary><b>${esc(it.s)}</b><span class="small muted">　${esc(it.law)}</span>${viol.has(k) ? ' <span class="tag bad">違反</span>' : ''}</summary><p class="small">${esc(it.rule)}</p><p class="small"><b>守り方：</b>${esc(it.how)}</p><p class="small muted"><b>罰則など：</b>${esc(it.pen)}　${term('解説', it.tk)}</p></details>`; }).join('');
  return `<h1 class="h1">法令と安全</h1><p class="lead">会社は、労働基準法・労働安全衛生法・消防法などのルールを守る義務があります。守らないと労働災害や火災が起きやすくなり、役所の立入検査で指摘され、直さなければ送検・公表され、銀行の評価も下がります。</p>
    <div class="grid g-side"><div class="stack">
      ${panel(`法令で決められたこと（${tasks.filter(x => x.st === 'over').length ? `<span class="neg">期限切れ ${tasks.filter(x => x.st === 'over').length}件</span>` : '期限切れなし'}）`, `<div class="tbl-wrap"><table class="t"><thead><tr><th>やること</th><th>所管・法律</th><th>状態</th><th class="n">費用</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">費用は、健康診断なら福利厚生費、点検なら支払手数料や修繕費、講習なら採用教育費として仕訳されます（「帳簿」で確かめられます）。</p>`)}
      ${panel('役所の立入検査と指摘', insp ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>月</th><th>役所</th><th>指摘</th><th>状態</th></tr></thead><tbody>${insp}</tbody></table></div>` : '<div class="empty">まだ立入検査はありません。労働基準監督署・消防署などは、予告なしに来ることがあります。</div>')}
      ${panel('労働災害の記録', accs ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>月</th><th>何が起きたか</th><th>程度</th><th>報告</th></tr></thead><tbody>${accs}</tbody></table></div>` : '<div class="empty">労働災害は起きていません</div>')}
      ${fires ? panel('火災の記録', `<div class="tbl-wrap"><table class="t"><thead><tr><th>月</th><th>場所・原因</th><th>程度</th><th class="n">損害</th></tr></thead><tbody>${fires}</tbody></table></div>`) : ''}
    </div><div class="stack">
      ${panel('安全と保険の方針', `<div class="stack" style="gap:8px">${pol}</div>`)}
      ${panel('労働時間', otPanel)}
      ${mw}
      ${panel('この会社に関わる法令', learn)}
    </div></div>`;
};

/* ---------- アクション ---------- */
Object.assign(ACTIONS, {
  kLawDo: d => {
    const t = ksLawTaskList().find(x => x.id === d.id);
    const cost = ksLawDo(d.id);
    toast(`${ksTaskName(t)}を実施しました（${fmtYen(cost)}）`);
    render();
  },
  kLawR36: () => showModal('kR36'),
  kLawPolicy: d => {
    const P = G.law.policy;
    if (d.k === 'safety') P.safety = +d.v; else P[d.k] = !P[d.k];
    render();
  },
  kLawRaise: () => {
    const before = ksPayrollEstimate().total;
    ksRaisePartWage();
    toast(`パート・アルバイトの時給を引き上げました（人件費 月約${fmtYen(ksPayrollEstimate().total - before)}増）`);
    render();
  },
  kInspOpen: d => showModal('kInsp', { id: +d.id }),
  kRosaiOpen: d => showModal('kRosai', { id: +d.id }),
  kLawFix: d => {
    ksLawFindingFix(d.item);
    const ins = G.law.insp.find(x => x.id === +d.id);
    if (ins) for (const f of ins.finds) if (f.item === d.item) f.fixed = true;
    drawModal(); render();
  },
  kLawReport: d => {
    const ok = ksLawReport(+d.id);
    toast(ok ? '是正報告書を提出しました' : 'まだ直していない指摘があります', ok ? '' : 'bad');
    if (ok) closeModal(true); else drawModal();
    render();
  },
});

/* ---------- 36協定の届出 ---------- */
MODALS.kR36 = () => {
  const ot = G.law.otNow ?? ksOtHours();
  const body = `<p style="margin:0 0 8px">${term('36協定', 'kyotei36')}は、労働者の過半数代表（または過半数で組織する労働組合）と結び、労働基準監督署に届け出ます。届け出た日から効力があり、さかのぼれません。</p>
    ${kv([['残業の見込み', `1人・月 ${fmtNum(ot, 0)}時間`], ['対象の年度', (calMonth(G.m) === 2 || calMonth(G.m) === 3) && (G.law.doneFy.r36 ?? -99) >= fyOf(G.m) ? ksFyLabel(fyOf(G.m) + 1) : ksFyLabel(fyOf(G.m))], ['費用', '社会保険労務士への報酬 5万円']])}
    <div class="callout" style="margin-top:10px"><b>特別条項を付けるか</b><br><span class="small">月45時間を超える残業が見込まれるなら、特別条項（臨時的な特別の事情、上限は年720時間・月100時間未満・2〜6か月平均80時間以内、月45時間を超えるのは年6か月まで）を付けます。付けても、長時間労働そのものが認められるわけではありません。</span></div>`;
  return modalFrame('36協定を結んで届け出る', body, btn('やめる', 'closeModal') + btn('特別条項なしで届け出る', 'kR36Go', { s: 0 }) + btn('特別条項を付けて届け出る', 'kR36Go', { s: 1 }, 'primary'), { size: 'narrow' });
};
ACTIONS.kR36Go = d => { ksLawDo('r36', { special: !!+d.s }); toast('36協定を労働基準監督署に届け出ました'); closeModal(true); render(); };

/* ---------- 労災の対応 ---------- */
function ksRosaiSteps(a) {
  const steps = ['first'];
  if (a.sev !== 'death') steps.push('pay');
  steps.push('report');
  if (a.sev === 'short' || a.sev === 'long') steps.push('comp');
  steps.push('prevent', 'end');
  return steps;
}
function ksRosaiQ(a, step) {
  const mental = a.kind === 'mental' || a.kind === 'karo';
  switch (step) {
    case 'first': return { q: mental ? '社員が倒れた・体調をくずした。会社がまずすべきことは？' : '事故が起きた。まずすべきことは？',
      ch: [['ok', mental ? '救急車を呼ぶなど本人の安全を最優先にし、家族に連絡する。勤務の記録（タイムカードなど）はそのまま保存する' : '救護して、必要なら救急車（119番）を呼ぶ。現場はそのままにして写真を撮り、上司に報告する'], ['go', mental ? '本人の自己管理の問題なので、回復を待つ' : '本人に自分で病院へ行ってもらい、ほかの人は作業を続ける'], ['clean', mental ? '勤務の記録を、残業が少なく見えるように整える' : '事故の跡をすぐに片付けて、いつもどおり営業する']], ans: 'ok',
      ex: mental ? '本人の安全が最優先。勤務の記録を書き換えると、証拠の隠滅として重い問題になります。' : 'けが人の救護が最優先。現場を保存すると、原因を調べて再発を防げます。重い事故では労働基準監督署が調査に来ます。' };
    case 'pay': return { q: mental ? '本人から「労災を請求したい」と言われた。会社は？' : '治療費はどうする？',
      ch: mental ? [['rosai', '請求書の事業主の証明に協力し、労働時間の記録を正直に出す（労災かどうかは労働基準監督署長が判断する）'], ['kenpo', '仕事が原因とは思えないので、健康保険で治療するよう勧める'], ['company', '会社が治療費を払うので、労災の請求はしないよう頼む']]
        : [['rosai', '労災保険を使う。病院に「仕事中のけが」と伝え、療養補償給付の請求書を出す（本人の負担はなし）'], ['kenpo', '本人の健康保険証で受診してもらう'], ['company', '会社が治療費を払い、労災保険も届出も使わない']], ans: 'rosai',
      ex: '仕事中（通勤中）のけがや病気の治療は労災保険で受けます。健康保険は使えません。労災かどうかを最終的に決めるのは労働基準監督署長で、会社が「労災ではない」と決めることはできません。' };
    case 'report': {
      if (a.sev === 'none') return { q: '休業しなかった（その日のうちに仕事に戻れた）場合、労働者死傷病報告は？', ch: [['none', '休業していないので報告は不要（治療は労災保険で受ける）'], ['report', '遅滞なく報告する'], ['quarter', '四半期ごとにまとめて報告する']], ans: 'none', ex: '労働者死傷病報告は、休業1日以上または死亡のときに出します。休業がなければ不要ですが、治療費は労災保険で受けます。' };
      if (a.sev === 'short') return { q: `休業${a.days}日の労災。労働者死傷病報告は？`, ch: [['report', '休業1〜3日なので、四半期ごとにまとめて報告する'], ['hide', '短い休みなので報告しない'], ['late', '本人の同意がないと報告できないので、出さない']], ans: 'report', ex: '休業1〜3日は、1〜3月・4〜6月・7〜9月・10〜12月ごとにまとめて、翌月末までに報告します。報告しないのは労災かくしです。' };
      return { q: `${a.sev === 'death' ? '死亡災害' : '休業4日以上の労災'}。労働基準監督署への報告は？`, ch: [['report', '労働者死傷病報告を遅滞なく（おおむね1〜2週間以内に）提出する'], ['hide', '取引先や保険料のことを考えて、報告しない'], ['late', '本人が復帰してから、まとめて報告する']], ans: 'report', ex: '休業4日以上や死亡は「遅滞なく」報告します。報告しない・うその報告は労災かくし（50万円以下の罰金）。健康保険の照会や本人・家族の相談から発覚し、送検されて報道されることもあります。' };
    }
    case 'comp': return { q: '休業の最初の3日間（待期期間）の補償は？', ch: [['pay', '会社が平均賃金の60%以上を払う。4日目からは労災保険の休業補償給付が出る'], ['none', '最初から労災保険が全部払うので、会社は払わなくてよい'], ['cut', '休んだ分の給料を差し引くだけでよい']], ans: 'pay', ex: '労災保険の休業補償給付は4日目から（給付基礎日額の60%＋特別支給金20%）。最初の3日間は、労働基準法76条により会社が平均賃金の60%以上を払います。' };
    case 'prevent': return { q: '再発を防ぐには？', ch: [['equip', `設備を改善し（${{ fall: '手すり・足場', machine: '安全カバー・非常停止', slip: '滑り止めマット', burn: 'フライヤーのガード', cut: '安全なカッター・手袋', back: '台車・リフト', heat: 'スポットクーラー・休憩所', traffic: 'ドライブレコーダー・運行管理', mental: '業務量の見直し・相談窓口', karo: '人員の増強・勤務時間の管理', commute: '通勤経路の確認', hit: '落下物の防止網' }[a.kind] || '安全設備'}）、全員に安全教育をする`], ['edu', '朝礼で注意を呼びかける'], ['none', '本人の不注意なので、特に何もしない']], ans: 'equip', ex: '同じ原因の事故は繰り返します。設備（物）と教育（人）と手順（管理）の3つで対策するのが基本です。費用は安全衛生費になります。' };
    default: return null;
  }
}
MODALS.kRosai = args => {
  const a = G.law.acc.find(x => x.id === args.id);
  if (!a) return modalFrame('労働災害', '<p>記録がありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  if (!UI.kRosai || UI.kRosai.id !== a.id) UI.kRosai = { id: a.id, i: 0, ch: {}, ok: {} };
  const R = UI.kRosai;
  const steps = ksRosaiSteps(a);
  const step = steps[R.i];
  const sevTxt = { none: '休業なし（治療のみ）', short: `休業${a.days}日`, long: `休業 約${Math.max(1, Math.round(a.days / 30))}か月`, death: '死亡' }[a.sev];
  const roleN = a.roleN || '従業員';
  let body = `<div class="callout ${a.sev === 'death' || a.sev === 'long' ? 'bad' : ''}"><b>${ymLabel(a.m)}　${ksActiveUnits().length > 1 && a.un ? `${esc(a.un)}の` : ''}${esc(roleN.replace(/（.*?）/, ''))}が${esc(a.text)}</b><br><span class="small">程度：${sevTxt}</span></div>`;
  body += `<ol class="wiz" style="margin-top:12px">${steps.map((s, k) => `<li class="${k < R.i ? 'done' : k === R.i ? 'now' : ''}"><button type="button" disabled><span class="n">${k + 1}</span>${{ first: '初動', pay: '治療と保険', report: '報告', comp: '休業補償', prevent: '再発防止', end: 'まとめ' }[s]}</button></li>`).join('')}</ol>`;
  if (step === 'end') {
    const ch = R.ch;
    const lines = [];
    lines.push(ch.pay === 'kenpo' ? '健康保険で治療したため、あとで労災保険への切り替えが必要になります。' : ch.pay === 'company' ? '会社が治療費を負担しました（労災保険を使えば本人も会社も負担はありません）。' : a.sev === 'death' ? '遺族には労災保険から遺族補償給付と葬祭料が出ます。' : '治療は労災保険（療養補償給付）で受けます。');
    if (a.sev !== 'none') lines.push(ch.report === 'hide' || ch.report === 'late' ? '<b class="neg">労働者死傷病報告を出しませんでした。労災かくしは、発覚すると送検されます。</b>' : '労働者死傷病報告を出しました。');
    if (a.sev === 'short' || a.sev === 'long') lines.push(ch.comp === 'pay' ? `待期期間3日の休業補償 約${fmtYen(a.wage / 30 * Math.min(3, a.days) * 0.6)}を払います（福利厚生費）。` : '<b class="neg">待期期間の休業補償を払わないのは労働基準法76条違反です。</b>');
    if (a.sev === 'long') lines.push(`休んでいる間（約${Math.ceil(a.days / 30)}か月）は応援の人で穴を埋めます（給与は労災保険から出るので、差額の費用だけかかります）。`);
    if (a.sev === 'death') lines.push('亡くなった方の分、人員が1人減ります。安全対策に不備があれば、会社は安全配慮義務違反として損害賠償を負い、送検されることがあります。');
    lines.push(ch.prevent === 'equip' ? '設備の改善と教育で、しばらく事故が起きにくくなります。' : ch.prevent === 'edu' ? '注意喚起だけでは、効果は限られます。' : '<b class="neg">対策をしないと、同じ事故が起きやすいままです。</b>');
    const nq = Object.keys(R.ok).length, nc = Object.values(R.ok).filter(Boolean).length;
    body += `<h3 class="fsh">対応のまとめ</h3><ul class="small" style="padding-left:1.2em;margin:0 0 8px">${lines.map(l => `<li>${l}</li>`).join('')}</ul><p class="small">正しい対応 <b>${nc}/${nq}</b></p>`;
    return modalFrame('労働災害への対応', body, btn('この対応で進める', 'kRosaiDone', {}, 'primary'), { noClose: true, sub: `${ymLabel(a.m)}の労災` });
  }
  const qz = ksRosaiQ(a, step);
  const ans = R.ch[step];
  body += `<div class="qz"><div class="qz-q"><span class="qz-tag">判断</span>${qz.q}</div><div class="qz-ch">${qz.ch.map(([v, t]) => `<button type="button" class="qz-b${ans ? (v === qz.ans ? ' ok' : v === ans ? ' ng' : '') : ''}" data-act="kRosaiPick" data-v="${v}"${ans ? ' disabled' : ''}>${t}</button>`).join('')}</div>
    ${ans ? `<div class="qz-a ${ans === qz.ans ? 'ok' : 'ng'}"><b>${ans === qz.ans ? '適切な対応です' : 'この対応には問題があります'}</b>　${qz.ex}</div>` : ''}</div>`;
  return modalFrame('労働災害への対応', body, btn('次へ', 'kRosaiNext', {}, 'primary', { disabled: !ans }), { noClose: true, sub: `${ymLabel(a.m)}の労災` });
};
MODALS.kRosai.locked = () => true;
Object.assign(ACTIONS, {
  kRosaiPick: d => {
    const R = UI.kRosai;
    const a = G.law.acc.find(x => x.id === R.id);
    const step = ksRosaiSteps(a)[R.i];
    if (R.ch[step]) return;
    R.ch[step] = d.v;
    const ok = d.v === ksRosaiQ(a, step).ans;
    R.ok[step] = ok;
    G.quiz.asked++; if (ok) G.quiz.correct++;
    drawModal();
  },
  kRosaiNext: () => { UI.kRosai.i++; drawModal(); const mb = document.querySelector('.modal .mb'); if (mb) mb.scrollTop = 0; },
  kRosaiDone: () => {
    const R = UI.kRosai;
    const ch = Object.assign({ pay: 'rosai', comp: 'pay', report: 'report' }, R.ch);
    if (ch.report === 'late') ch.report = 'hide';
    ksLawResolveAccident(R.id, ch);
    UI.kRosai = null;
    closeModal(true);
    render();
    autosave();
  },
});

/* ---------- 立入検査 ---------- */
MODALS.kInsp = args => {
  const ins = G.law.insp.find(x => x.id === args.id);
  if (!ins) return modalFrame('立入検査', '<p>記録がありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  const ag = LAW_AG[ins.ag];
  const lawDoc = ins.ag === 'labor';
  const viols = ins.finds.filter(f => f.kind !== 'shido' && f.kind !== 'koto');
  const softs = ins.finds.filter(f => f.kind === 'shido' || f.kind === 'koto');
  const docTitle = lawDoc ? (viols.length ? '是正勧告書' : '指導票') : ins.ag === 'fire' ? '立入検査結果通知書' : '指導書';
  const costOf = item => { if (item === 'otmax' || item === 'yukyu' || item === 'hinan' || item === 'unpaid') return 0; if (item === 'minwage') return Math.max(0, ksMinWageGap()) * sum(ksPartRoles(), x => (x.u.staff[x.r.id] || 0) * x.hours) * 12; if (item === 'safetyMin') return ksHeadcount() * KS_SAFETY[1].cost * 12; if (item === 'lic') return sum(ksLawTasks().filter(x => x.t.item === 'lic' && x.st !== 'ok'), x => x.cost); const t = ksLawTaskList().find(x => x.item === item); return t ? Math.round(t.cost()) : 0; };
  const fixLabel = { otmax: '36協定に特別条項を付け、残業を減らす計画を出す', minwage: '時給を引き上げる', yukyu: '年休の計画的付与を始める', hinan: '避難通路の物をすぐに片付ける', safetyMin: '安全衛生の取り組みを「標準」にする', unpaid: '未払いの残業代を払う', report: '（送検されました）' };
  const row = f => {
    const it = LAW_ITEMS[f.item] || { s: '安全衛生の取り組みが最低限', law: '労働安全衛生法3条（事業者の責務）', rule: '事業者は、快適な職場環境の実現と労働条件の改善を通じて、労働者の安全と健康を確保するようにしなければならない。' };
    const kindT = { kankoku: '是正勧告', shido: '指導', meirei: '使用停止命令', soken: '送検', koto: '口頭指導', shiteki: '違反指摘', keikoku: '警告' }[f.kind] || '指摘';
    const c = costOf(f.item);
    return `<tr><td>${esc(it.law)}</td><td><b>${esc(it.s)}</b><div class="small muted">${esc(it.rule || '')}</div></td><td>${tag(kindT, f.kind === 'shido' || f.kind === 'koto' ? '' : 'bad')}</td>
      <td class="n">${f.fixed ? tag('是正済み', 'ok') : ins.status === 'open' ? btn(fixLabel[f.item] || `直す（${fmtYen(c)}）`, 'kLawFix', { id: ins.id, item: f.item }, 'sm primary') : ''}${!f.fixed && c && fixLabel[f.item] ? `<div class="small muted">費用 約${fmtYen(c)}${f.item === 'minwage' || f.item === 'safetyMin' ? '／年' : ''}</div>` : ''}</td></tr>`;
  };
  const body = `<div class="lawdoc"><div class="ld-title">${docTitle}</div>
    <div class="ld-meta"><span>${ymLabel(ins.m)}</span><span>${esc(G.coName)}　代表取締役 ${esc(G.ceo)} 殿</span><span>汐見${ag.n.replace('（公安委員会）', '')}${lawDoc ? '　労働基準監督官' : ''}</span></div>
    <p class="small">${lawDoc ? `貴事業場（${ins.kind}${ins.why ? `：労働者からの申告（${esc(ins.why)}）による` : ''}）における下記の${viols.length ? '労働基準法・労働安全衛生法違反' : '事項'}については、${ymLabel(ins.due)}末までに是正のうえ、遅滞なく報告してください。` : `立入検査の結果、下記の事項を指摘します。${ymLabel(ins.due)}末までに改修し、結果を報告してください。`}</p>
    ${ins.finds.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>根拠の法令</th><th>指摘の内容</th><th>区分</th><th class="n">対応</th></tr></thead><tbody>${viols.map(row).join('')}${softs.map(row).join('')}</tbody></table></div>` : '<p>指摘事項はありません。今後も法令を守ってください。</p>'}</div>
    <p class="note">${lawDoc ? `${term('是正勧告', 'kankoku')}は行政指導ですが、期限までに直さないと再監督を経て${term('送検', 'soken')}されることがあります。${term('指導票', 'shido')}は法違反ではない改善事項です。` : `直さないと、警告 → 措置命令（建物に標識が付き公示される）→ 告発と進みます（${term('違反処理', 'fireOrder')}）。`}直した費用は、内容に応じた費用の勘定（支払手数料・福利厚生費など）で仕訳されます。</p>`;
  const allFixed = ins.finds.every(f => f.fixed);
  const foot = ins.status === 'open' ? btn('あとで対応する', 'closeModal') + btn('是正報告書を提出する', 'kLawReport', { id: ins.id }, 'primary', { disabled: !allFixed }) : btn('閉じる', 'closeModal', {}, 'primary');
  return modalFrame(`${ag.n}の${esc(ins.kind)}`, body, foot, { size: 'wide', sub: ins.status === 'open' ? `是正期日 ${ymLabel(ins.due)}末` : '' });
};

/* ---------- 火災 ---------- */
/* 火災で休業している店（u と店の名前） */
function ksFireClosed() {
  const out = [];
  for (const u of ksActiveUnits()) { const L = u.op.stores || u.op.shops; if (L) for (const s of L) if (s.openM === 9999) out.push({ u, s }); }
  return out;
}
function ksRebuildItems(u, s) {
  const P = ksP(u), p = ksPrice();
  const eqn = (P.eqn && P.eqn[0]) || (ksS(u).eng === 'rest' ? '厨房機器' : '店の設備');
  return [{ n: `${s.n}の復旧工事（内装）`, acct: 'bldg', cost: Math.round(P.fit * 0.6 * p), life: 15, part: 'S', u: u.id }, { n: `${s.n}の${eqn}（復旧）`, acct: 'equip', cost: Math.round(P.eqc * p), life: 6, part: 'S', u: u.id }].filter(x => x.cost > 0);
}
KS_CAPEX_FX.reopen = a => {
  const u = ksUnit(a.u);
  const s = (u.op.stores || u.op.shops).find(x => x.n === a.s);
  if (!s) return '';
  s.openM = G.m + 2; s.renovM = G.m + 2;
  if (s.eqM !== undefined) s.eqM = G.m + 2;
  if (s.kitM !== undefined) s.kitM = G.m + 2;
  return `${s.n}は${ymLabel(G.m + 2)}に営業を再開します`;
};
MODALS.kFire = args => {
  const f = G.law.fires.find(x => x.id === args.id);
  if (!f) return modalFrame('火災', '<p>記録がありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  const u = f.u && ksUnit(f.u);
  const s = u && f.store ? (u.op.stores || u.op.shops || []).find(x => x.n === f.store) : null;
  const closed = !!(s && s.openM > G.m + 2);
  const items = closed ? ksRebuildItems(u, s) : [];
  const cost = sum(items, x => x.cost);
  const body = `<div class="callout bad"><b>${ymLabel(f.m)}　${esc(f.b)}で${f.large ? '火災' : 'ぼや'}</b><br><span class="small">原因：${esc(f.cause)}</span></div>
    ${f.large ? `${kv([['損害（焼けた建物・設備の帳簿価額、在庫、片付け）', fmtYen(f.loss)], ['火災保険から', f.ins ? fmtYen(f.ins) : '<span class="neg">保険に入っていなかった</span>']])}
      <p class="small">焼けた資産の帳簿価額や在庫は「災害による損失」（${term('特別損失', 'extra')}）、受け取った保険金は「受取保険金」（特別利益）になります。臨時の損益なので、本業の力を表す営業利益・経常利益には入りません。</p>
      ${closed ? `<p class="callout">店は営業できません。復旧工事をすると、2か月後に営業を再開できます。休んでいる間も給料や家賃はかかります。</p>` : ''}` : `<p class="small">修理費 ${fmtYen(f.loss)}（修繕費）。けが人はいませんでした。</p>`}
    <p class="note">${term('消防用設備等の点検', 'fireCheck')}や${term('避難訓練', 'evacDrill')}をしていないと、火災が起きやすく、大きくなりやすく、逃げ遅れも起きます。火災のあとは消防署が原因を調べ、立入検査に来ます。</p>`;
  const foot = closed ? btn('あとで決める', 'closeModal') + btn(`復旧工事をする（約${fmtYen(cost)}）`, 'kFireRebuild', { u: u.id, s: s.n }, 'primary') : btn('閉じる', 'closeModal', {}, 'primary');
  return modalFrame(f.large ? '火災が起きました' : 'ぼやが出ました', body, foot);
};
ACTIONS.kFireRebuild = d => {
  const u = ksUnit(d.u);
  const s = u && (u.op.stores || u.op.shops || []).find(x => x.n === d.s);
  if (!s) return;
  ksCapexOpen({ title: `${s.n}の復旧工事`, desc: '焼けた内装・設備を直し、営業を再開します。工事の費用は資産（建物・器具備品）になり、これから償却します。', items: ksRebuildItems(u, s), fx: 'reopen', arg: { u: u.id, s: s.n } });
};
/* 火災で閉まっている店（復旧の前）は、社長室に復旧工事のボタンを出す */
const ksInbox1 = ksInbox;
ksInbox = () => {
  const out = ksInbox1();
  if (!G.law) return out;
  for (const { u, s } of ksFireClosed()) out.push({ ico: '火', cls: 'bad', t1: `${ksActiveUnits().length > 1 ? ksUName(u) + '・' : ''}${s.n}は火災で営業できません`, t2: '復旧工事をしないと、売上がないまま給料や家賃がかかります', act: btn('復旧工事', 'kFireRebuild', { u: u.id, s: s.n }, 'sm primary') });
  return out;
};

/* ---------- 送検・公表の知らせ ---------- */
MODALS.kLawNews = a => {
  const title = a.kind === 'koukai' ? '違反対象物として公表されました' : a.kind === 'meirei' ? '行政処分を受けました' : '書類送検されました';
  const body = `<div class="callout bad"><b>${esc(a.why)}</b></div>
    <ul class="small" style="padding-left:1.2em">${a.fine ? `<li>罰金 ${fmtYen(a.fine)} を納めます。${term('罰金及び科料', 'soken')}は営業外費用ですが、税金の計算では費用にならない（損金不算入）ので、その分の税金も増えます。</li>` : ''}
      <li>新聞やインターネットで報道され、お客さまや取引先の信頼が下がります（客足・取引が減ります）。</li>
      <li>銀行は1年間、格付を1段階下げて審査します。</li>
      ${a.kind === 'soken' ? `<li>${term('送検', 'soken')}された事件は、検察が起訴するかを決めます。厚生労働省は送検した事案を公表しています。</li>` : ''}</ul>
    <p class="note">法令違反の多くは、指摘された段階で直していれば処分まで進みません。「法令と安全」で、期限切れの項目と役所からの指摘を確かめましょう。</p>`;
  return modalFrame(title, body, btn('法令と安全へ', 'kGo', { tab: 'k_law' }) + btn('閉じる', 'closeModal', {}, 'primary'), { size: 'narrow' });
};

/* ---------- 遊び方に「法令と安全」を加える ---------- */
HELP_K.splice(6, 0, ['法令と安全', `<p>会社には、労働者を守る法律（労働基準法・労働安全衛生法・最低賃金法）、火事を防ぐ法律（消防法）、業種ごとの法律（食品衛生法・建設業法・道路交通法・個人情報保護法）を守る義務があります。「法令と安全」の画面に、この会社がやるべきことと期限が並びます。</p>
  <ul><li><b>事業ごとの法令</b>：業種によって、機械の安全・墜落の防止・化学物質・食品衛生・危険物・個人情報・許認可（運送・旅館・介護・酒類など）の決まりが加わります。事業を増やすと、守ることも増えます。</li><li><b>労働災害</b>：起きたら、救護 → 労災保険での治療 → 労働者死傷病報告 → 休業補償 → 再発防止、の順に判断します。報告しないのは「労災かくし」です。</li>
  <li><b>立入検査</b>：労働基準監督署・消防署・保健所などが予告なしに来ます。違反が見つかると是正勧告・指摘を受け、期限までに直して報告します。直さないと送検・公表・命令に進み、罰金（税金の計算では費用にならない）と報道、銀行の格付の引き下げが待っています。</li>
  <li><b>火災</b>：消防設備の点検や訓練を怠ると起きやすく、大きくなりやすくなります。焼けた資産は「災害による損失」、保険金は「受取保険金」として特別損益になります。</li>
  <li><b>労働時間と賃金</b>：残業は36協定の範囲で。人手不足だと残業が増え、過労による労災が起きやすくなります。最低賃金は毎年10月に上がります。</li></ul>`]);
