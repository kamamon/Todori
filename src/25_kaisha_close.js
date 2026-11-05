'use strict';
/* =========================================================
 *  25_kaisha_close.js : 決算整理（3月末）
 *   手順ごとに「なぜやるのか」の解説 → 数字 → 問題 → 記帳する仕訳 を順に見せ、
 *   最後に決算書を確定する。在庫の水増し・減価償却の見送りという「誘惑」も選べる（粉飾の学び）。
 * ========================================================= */

const KS_STEP_INFO = {
  stock: { t: '実地棚卸と売上原価', s: '棚卸' },
  con: { t: '工事の確認', s: '工事' },
  dep: { t: '減価償却', s: '償却' },
  allow: { t: '貸倒引当金', s: '引当金' },
  accrual: { t: '未払費用と前払費用', s: '経過勘定' },
  tax: { t: '法人税等', s: '税金' },
  done: { t: '決算書の完成', s: '完成' },
};
const ksYenX = v => `${fmtNum(Math.round(v))}円`;
/* 選択肢の並びを決算期と手順で固定する（描き直しても並びが変わらない） */
function ksShuffle(arr, seed) {
  const a = arr.map((x, i) => ({ x, i, h: Math.sin((seed + 1) * 9301 + (i + 1) * 49297) * 233280 % 1 }));
  a.sort((p, q) => p.h - q.h);
  return a;
}
function ksFlowSumFY(k, fy) { return sum(G.months.filter(x => fyOf(x.m) === fy), x => (x.flow[k] || 0)); }
/* 金額の選択肢をつくる（重複を避ける） */
function ksAmtChoices(correct, wrongs) {
  const out = [correct];
  for (const w of wrongs) { const r = Math.round(w); if (isFinite(r) && r > 0 && out.every(o => Math.abs(o - r) > Math.max(1000, Math.abs(correct) * 0.002))) out.push(r); }
  let k = 1;
  while (out.length < 4) { const r = Math.round(correct * (1 + 0.17 * k * (k % 2 ? 1 : -1))); if (out.every(o => Math.abs(o - r) > 1000)) out.push(r); k++; }
  return out.slice(0, 4);
}

/* ---------- 手順ごとの問題（一度つくった問題は決算整理が終わるまで変えない） ---------- */
function ksQuizFor(step) {
  const c = G.closing;
  c.qz = c.qz || {};
  if (!(step in c.qz)) c.qz[step] = ksMakeQuiz(step);
  return c.qz[step];
}
function ksMakeQuiz(step) {
  const c = G.closing;
  const I = ksI();
  const fy = c.fy;
  if (step === 'stock') {
    if (I.inv === 'sanbun') {
      const it = c.data.stock.items[0];
      const purch = ksFlowSumFY('purch', fy);
      const ans = it.begin + purch - it.book;
      const ch = ksAmtChoices(ans, [purch, it.begin + purch, purch + it.book - it.begin]);
      return { q: `今期の売上原価はいくらでしょう？（期首の在庫 ${ksYenX(it.begin)}・今期の仕入高 ${ksYenX(purch)}・期末の帳簿の在庫 ${ksYenX(it.book)}）`, choices: ch.map(ksYenX), correct: 0,
        explain: `売上原価 ＝ 期首棚卸高 ${ksYenX(it.begin)} ＋ 当期仕入高 ${ksYenX(purch)} − 期末棚卸高 ${ksYenX(it.book)} ＝ <b>${ksYenX(ans)}</b>。前期から残っていた在庫は今期に売れたものとして費用に加え、売れ残った在庫は来期に売るものとして今期の費用から除きます。` };
    }
    const [mat] = c.data.stock.items;
    const purch = ksFlowSumFY('matPurch', fy);
    const ans = mat.begin + purch - mat.book;
    const ch = ksAmtChoices(ans, [purch, mat.begin + purch, purch + mat.book - mat.begin]);
    return { q: `今期の材料費（使った材料の額）はいくらでしょう？（期首の材料 ${ksYenX(mat.begin)}・今期の材料仕入高 ${ksYenX(purch)}・期末の帳簿の材料 ${ksYenX(mat.book)}）`, choices: ch.map(ksYenX), correct: 0,
      explain: `材料費 ＝ 期首材料棚卸高 ＋ 当期材料仕入高 − 期末材料棚卸高 ＝ <b>${ksYenX(ans)}</b>。使った分だけが今期の製造原価になり、残った材料は資産として来期に繰り越します。` };
  }
  if (step === 'con') {
    return { q: 'まだ完成していない工事に、これまでにかかった材料費・外注費・現場の経費は、決算書のどこに載るでしょう？', choices: ['完成工事原価（損益計算書の費用）', '未成工事支出金（貸借対照表の資産）', '未成工事受入金（貸借対照表の負債）', '前払費用（貸借対照表の資産）'], correct: 1,
      explain: '完成していない工事の費用は、まだ売上が立っていないので費用にしません。<b>未成工事支出金</b>（流動資産）にためておき、完成して引き渡した期に完成工事原価に振り替えます。完成前に受け取った代金は未成工事受入金（負債）です。' };
  }
  if (step === 'dep') {
    const rows = c.data.dep.filter(r => r.life && r.dep > 0 && r.dep === Math.round(r.cost / r.life * r.months / 12));
    const r = rows.sort((a, b) => b.dep - a.dep)[0] || c.data.dep.filter(x => x.dep > 0).sort((a, b) => b.dep - a.dep)[0];
    if (!r) return { q: '減価償却費は、どんな考え方で計上する費用でしょう？', choices: ['買った年にまとめて費用にする', '使う期間（耐用年数）に分けて少しずつ費用にする', '売ったときに費用にする', '費用にはしない'], correct: 1, explain: '長く使う資産は、使う期間に分けて少しずつ費用にします。' };
    c.data.depQ = r.id;
    const ans = r.dep;
    const ch = ksAmtChoices(ans, [r.cost / r.life / 12 * (r.months === 12 ? 1 : 12), r.cost * 2 / r.life * (r.months / 12), (r.cost - r.booked) / r.life, r.cost / r.life * 1.5]);
    return { q: `「${r.n}」（取得価額 ${ksYenX(r.cost)}・耐用年数 ${r.life}年・今期に使った月数 ${r.months}か月）の今期の減価償却費はいくらでしょう？（定額法）`, choices: ch.map(ksYenX), correct: 0,
      explain: `定額法：取得価額 ${ksYenX(r.cost)} ÷ 耐用年数 ${r.life}年 × ${r.months}/12 ＝ <b>${ksYenX(ans)}</b>。毎年同じ額を費用にします。期の途中で買った資産は、使った月数で月割りにします。` };
  }
  if (step === 'allow') {
    const a = c.data.allow;
    const cur = a.cur;
    const diff = a.req - cur;
    const ratePct = fmtNum(a.rate * 100, 2);
    if (diff >= 0) {
      const ch = ksAmtChoices(diff, [a.req, a.req + cur, cur]);
      return { q: `期末の売掛金は ${ksYenX(a.ar)}、過去の貸倒れの実績から ${ratePct}% が回収できなくなると見込みます（必要な引当金 ${ksYenX(a.req)}）。すでに貸倒引当金が ${ksYenX(cur)} あります。今期に繰り入れる額は？（差額補充法）`, choices: ch.map(ksYenX), correct: 0,
        explain: `必要な額 ${ksYenX(a.req)} − 今ある引当金 ${ksYenX(cur)} ＝ <b>${ksYenX(diff)}</b> を貸倒引当金繰入額（費用）にします。差額だけを補うので「差額補充法」といいます。` };
    }
    return { q: `必要な貸倒引当金は ${ksYenX(a.req)} ですが、すでに ${ksYenX(cur)} あります（売掛金が減ったため）。どう処理するでしょう？`, choices: [`${ksYenX(-diff)} を戻し入れて収益にする（貸倒引当金戻入額）`, `${ksYenX(a.req)} を繰り入れる`, '何もしない', `${ksYenX(cur)} を全部取り崩す`], correct: 0,
      explain: `引当金が多すぎる分 <b>${ksYenX(-diff)}</b> は、貸倒引当金戻入額（収益）として戻します。` };
  }
  if (step === 'accrual') {
    const a = c.data.accrual;
    if (a.rent > 0) {
      return { q: `3月末に、4月分の家賃 ${ksYenX(a.rent)} を払いました（払ったときに地代家賃（費用）として記帳しています）。決算ではどうするでしょう？`, choices: ['今期に払ったので、そのまま今期の費用にする', '前払費用（資産）に振り替えて、来期の費用にする', '未払費用（負債）を計上する', '売上高から差し引く'], correct: 1,
        explain: `4月分の家賃は来期のサービスの代金なので、今期の費用から除いて<b>前払費用</b>（資産）にします。あわせて、3月分の社会保険料 ${ksYenX(a.labor + a.welfare)} は4月に払いますが3月の費用なので<b>未払費用</b>（負債）を計上します。費用は「払った時」ではなく「発生した期」に計上する（発生主義）のが決算のルールです。` };
    }
    return { q: `3月分の社会保険料（会社負担）${ksYenX(a.labor + a.welfare)} は、4月末に払います。決算ではどうするでしょう？`, choices: ['払うのは来期なので、今期は何もしない', '未払費用（負債）を計上して、今期の費用にする', '前払費用（資産）を計上する', '来期の売上から差し引く'], correct: 1,
      explain: '3月分の保険料は3月に発生した費用です。払うのは4月でも今期の費用として、まだ払っていない分を<b>未払費用</b>（負債）にします（発生主義）。4月の初めに元に戻す仕訳（再振替仕訳）をするので、払ったときに二重に費用にはなりません。' };
  }
  if (step === 'tax') {
    const t = ksTaxCalc();
    if (t.taxable > 0) {
      const ch = ksAmtChoices(t.tax, [Math.max(0, t.pretax) * 0.25 + 7e4, Math.max(0, t.pretax) * 0.3, t.income, 7e4]);
      return { q: `税引前当期純利益は ${ksYenX(t.pretax)}${t.loss ? `、過去の赤字（繰越欠損金）が ${ksYenX(t.loss)}` : ''}です。所得のうち800万円までは25%、超える部分は34%、さらに住民税の均等割7万円がかかります。法人税等はいくら？`, choices: ch.map(ksYenX), correct: 0,
        explain: `所得 ${ksYenX(t.taxable)}${t.loss ? `（利益から繰越欠損金を差し引いた額）` : ''} × 税率 ＝ ${ksYenX(t.income)}、均等割 7万円を加えて <b>${ksYenX(t.tax)}</b>。納めるのは5月なので、それまでは未払法人税等（負債）です。` };
    }
    return { q: `今期の税引前当期純利益は ${ksYenX(t.pretax)}${t.pretax > 0 ? `ですが、過去の赤字（繰越欠損金）${ksYenX(t.loss)}で相殺されます` : '（赤字）です'}。法人税等はいくらでしょう？`, choices: ['0円（もうけがないので税金はかからない）', '7万円（住民税の均等割だけはかかる）', `△${ksYenX(Math.abs(t.pretax) * 0.25)}（税金が戻ってくる）`, ksYenX(Math.abs(t.pretax) * 0.25)], correct: 1,
      explain: `所得がなければ法人税はかかりませんが、住民税の<b>均等割（7万円）</b>は赤字でもかかります。今期の赤字 ${ksYenX(t.lossAfter)} は繰越欠損金として、来期以降の利益と相殺できます。` };
  }
  return null;
}

/* ---------- 手順ごとの画面 ---------- */
function ksStepLearn(step) {
  const I = ksI();
  switch (step) {
    case 'stock': return I.inv === 'sanbun'
      ? `<p>期中は、商品を仕入れるたびに「${ksAcctName('purch')}」（費用）に記録してきました（${term('三分法', 'sanbunpo')}）。でも、仕入れた${ksInvLabel() === '材料' ? '食材' : '商品'}が全部売れたわけではありません。決算日に倉庫と売場の在庫を全部数え（${term('実地棚卸', 'stocktake')}）、本当の${term('売上原価', 'cogs')}を計算します。</p><div class="formula">売上原価 ＝ 期首棚卸高 ＋ 当期仕入高 − 期末棚卸高</div><p>帳簿の在庫より実際に数えた在庫が少なければ、その差（万引き・廃棄の記録漏れ・数え間違い）は${term('棚卸減耗損', 'shrink')}として費用にします。</p>`
      : `<p>工場には3種類の在庫があります。<b>原材料</b>（まだ使っていない材料）、<b>仕掛品</b>（作りかけ）、<b>製品</b>（完成して納品前）。決算日に全部数えて、今期に使った分・作った分だけを原価にします。</p><div class="formula">材料費 ＝ 期首材料 ＋ 当期材料仕入高 − 期末材料</div><p>仕掛品と製品も、期首の分を原価に加え、期末の分を資産に移します（${term('製造原価報告書', 'mfgCost')}で計算）。</p>`;
    case 'con': return `<p>建設業は、工事が完成して引き渡した期にまとめて売上にします（${term('工事完成基準', 'completion')}）。決算日には、施工中の工事について「かかった費用」と「受け取った代金」が正しく記帳されているかを確かめます。</p>`;
    case 'dep': return `<p>建物・機械・車両・パソコンなど長く使う資産は、買ったときに全額を費用にせず、使う年数（${term('耐用年数', 'straightLine')}）に分けて少しずつ費用にします。これが${term('減価償却', 'dep')}です。期中は月割の見込みで管理し、決算で${term('固定資産台帳', 'fixedRegister')}から正確な額を計算して記帳します。</p><div class="formula">定額法：今期の減価償却費 ＝ 取得価額 ÷ 耐用年数 ×（今期に使った月数 ÷ 12）</div><p>建物などは${term('減価償却累計額', 'accDep')}（資産のマイナス）に積み上げる間接法、ソフトウェアは資産を直接減らす直接法で記帳します。</p>`;
    case 'allow': return `<p>売掛金の中には、取引先の倒産などで回収できなくなるものが出てきます。そこで、過去の実績から回収できなくなりそうな額を見積もって、前もって費用にしておきます（${term('貸倒引当金', 'allowance')}）。貸借対照表では売掛金から差し引いて表示します。</p>`;
    case 'accrual': return `<p>費用は、お金を払ったときではなく、その費用が<b>発生した期</b>に計上します（発生主義）。期中は払ったときに費用にしているので、決算でずれを直します（${term('経過勘定', 'accrual')}）。</p><ul class="small"><li>まだ払っていない今期の費用 → ${term('未払費用', 'accruedExp')}（負債）</li><li>もう払った来期の費用 → ${term('前払費用', 'prepaid')}（資産）</li></ul>`;
    case 'tax': return `<p>会社の利益（所得）には、法人税・住民税・事業税がかかります。決算で今期の分を計算して費用（${term('法人税、住民税及び事業税', 'tax')}）にし、納めるまでは${term('未払法人税等', 'taxPay')}（負債）にしておきます。赤字の年は税金がかからず、その赤字は翌年以降の利益と相殺できます（繰越欠損金）。</p>`;
    default: return '';
  }
}
function ksStepData(step) {
  const c = G.closing;
  const I = ksI();
  const fy = c.fy;
  if (step === 'stock') {
    if (I.inv === 'sanbun') {
      const it = c.data.stock.items[0];
      const purch = ksFlowSumFY('purch', fy);
      return `<table class="t compact"><tbody><tr><td>期首の在庫（前期末に数えた額）</td><td class="n">${ksYenX(it.begin)}</td></tr><tr><td>今期の${ksAcctName('purch')}（期中の合計）</td><td class="n">${ksYenX(purch)}</td></tr>
        <tr><td>期末の在庫：帳簿の数字</td><td class="n">${ksYenX(it.book)}</td></tr><tr class="total"><td>期末の在庫：実際に数えた数字（${term('実地棚卸', 'stocktake')}）</td><td class="n">${ksYenX(it.phys)}</td></tr>
        <tr><td>差（${term('棚卸減耗', 'shrink')}）</td><td class="n neg">${ksYenX(it.book - it.phys)}</td></tr></tbody></table>`;
    }
    const purch = ksFlowSumFY('matPurch', fy);
    return `<table class="t compact"><thead><tr><th>在庫</th><th class="n">期首</th><th class="n">期末（帳簿）</th><th class="n">期末（実地）</th></tr></thead><tbody>${c.data.stock.items.map(x => `<tr><td>${esc(x.n)}</td><td class="n">${ksYenX(x.begin)}</td><td class="n">${ksYenX(x.book)}</td><td class="n">${ksYenX(x.phys)}</td></tr>`).join('')}</tbody></table>
      <p class="small">今期の材料仕入高（期中の合計）：${ksYenX(purch)}</p>`;
  }
  if (step === 'con') {
    const act = G.op.projects.filter(p => !p.fin && p.startM <= G.m);
    const done = (G.op.doneFY && G.op.doneFY[fy]) || { n: 0, sales: 0, cost: 0 };
    return `<table class="t compact"><thead><tr><th>施工中の工事</th><th class="n">かかった費用</th><th class="n">受け取った代金</th></tr></thead><tbody>
      ${act.map(p => `<tr><td>${esc(p.client)}・${esc(p.n)}<div class="small muted">${G.m - p.startM + 1}/${p.dur}か月目</div></td><td class="n">${ksYenX(p.costToDate)}</td><td class="n">${ksYenX(p.recv)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">施工中の工事はありません</td></tr>'}
      <tr class="total"><td>合計（貸借対照表）</td><td class="n">${ksYenX(ksB('cwip'))}<div class="small muted">未成工事支出金</div></td><td class="n">${ksYenX(ksB('advRecv'))}<div class="small muted">未成工事受入金</div></td></tr></tbody></table>
      <p class="small">今期に完成・引き渡した工事：${done.n}件、完成工事高 ${fmtYen(done.sales)}・完成工事原価 ${fmtYen(done.cost)}</p>`;
  }
  if (step === 'dep') {
    const rows = c.data.dep;
    return `<div class="tbl-wrap"><table class="t compact"><thead><tr><th>資産</th><th class="n">取得価額</th><th class="n">耐用年数</th><th class="n">今期の月数</th><th class="n">期首の償却累計額</th><th class="n">今期の償却費</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.id === c.data.depQ && !c.ans.dep ? 'qrow' : ''}"><td>${esc(r.n)}${r.part === 'C' ? ' <span class="tag">製造</span>' : ''}</td><td class="n">${fmtYen(r.cost)}</td><td class="n">${r.life}年</td><td class="n">${r.months}</td><td class="n">${fmtYen(r.booked)}</td><td class="n">${r.id === c.data.depQ && !c.ans.dep ? '？' : fmtYen(r.dep)}</td></tr>`).join('')}
      <tr class="total"><td>合計</td><td></td><td></td><td></td><td></td><td class="n">${c.ans.dep ? fmtYen(sum(rows, r => r.dep)) : '？'}</td></tr></tbody></table></div>
      <p class="small muted">償却が終わった資産（帳簿価額1円）は載せていません。工場の機械・建物の償却費は製造原価、それ以外は販管費になります。</p>`;
  }
  if (step === 'allow') {
    const a = c.data.allow;
    return kv([[`期末の${ksAcctName('ar', 'bs')}`, ksYenX(a.ar)], ['貸倒実績率（過去の実績から）', fmtPct(a.rate * 100, 2)], ['必要な貸倒引当金', ksYenX(a.req)], ['決算整理の前にある貸倒引当金', ksYenX(a.cur)]]);
  }
  if (step === 'accrual') {
    const a = c.data.accrual;
    return kv([['3月分の社会保険料（会社負担・4月末に納付）', `${ksYenX(a.labor + a.welfare)}${a.labor ? `（うち工場・現場の分 ${ksYenX(a.labor)}）` : ''}`], ['3月末に払った4月分の家賃', a.rent ? ksYenX(a.rent) : 'なし（家賃のない会社）']]);
  }
  if (step === 'tax') {
    const t = c.data.tax || ksTaxCalc();
    return kv([['税引前当期純利益（ここまでの決算整理の後）', `<span class="${t.pretax < 0 ? 'neg' : ''}">${ksYenX(t.pretax)}</span>`], ['繰越欠損金（過去の赤字）', ksYenX(t.loss)]]);
  }
  return '';
}
/* 誘惑（粉飾）の選択 */
function ksTemptation(step) {
  const c = G.closing;
  const o = c.opt[step] || {};
  if (step === 'stock') {
    const I = ksI();
    const base = I.inv === 'sanbun' ? c.data.stock.items[0].phys : sum(c.data.stock.items, x => x.phys);
    const v = o.fraudInv || 0;
    const opts = [[0, '正しく数えた数字にする'], [0.1, '在庫を1割多くする'], [0.3, '在庫を3割多くする']];
    const ytd = ksYTD();
    return `<details class="tempt"${v ? ' open' : ''}><summary>経理部長が小声で相談してきました${ytd.ord < 0 ? '（今期は赤字の見込みです）' : ''}</summary>
      <p class="small">「社長、${ytd.ord < 0 ? '今期は赤字になりそうです。赤字の決算書を出すと、銀行の格付が下がって借入が難しくなります。' : '利益をもう少し多く見せたいなら……'}在庫を実際より多く数えたことにすれば、売上原価が減って、その分だけ利益が増えますが……」</p>
      <div class="seg wrap" role="radiogroup">${opts.map(([x, l]) => `<button type="button" data-act="kCloseOpt" data-k="fraudInv" data-v="${x}" aria-pressed="${v === x}">${l}</button>`).join('')}</div>
      ${v ? `<p class="callout bad small" style="margin-top:8px">これは<b>粉飾</b>です。今期の利益が約${fmtYen(base * v)}多く見えますが、来期の期首の在庫も多くなるので、その分来期の売上原価が増えて利益が減ります（粉飾は続けないと隠せません）。銀行は${term('棚卸資産回転日数', 'invDays')}の延びや粗利率の不自然な上昇で気づき、棚卸に立ち会うことがあります。見つかると格付は最低になり、3年間新しい融資を受けられません。</p>` : '<p class="small muted" style="margin-top:6px">正しい数字で決算書を作るのが原則です。</p>'}</details>`;
  }
  if (step === 'dep') {
    const v = o.skipDep || 0;
    const total = sum(c.data.dep, r => r.dep);
    const opts = [[0, '全額を償却する'], [0.5, '半分だけ償却する'], [1, '今期は償却しない']];
    return `<details class="tempt"${v ? ' open' : ''}><summary>税理士の先生からの提案</summary>
      <p class="small">「税金の計算では、減価償却をどれだけするかは会社が決められます（任意償却）。償却費 ${fmtYen(total)} を減らせば、その分だけ利益が増えて見えますよ」</p>
      <div class="seg wrap" role="radiogroup">${opts.map(([x, l]) => `<button type="button" data-act="kCloseOpt" data-k="skipDep" data-v="${x}" aria-pressed="${v === x}">${l}</button>`).join('')}</div>
      ${v ? `<p class="callout small" style="margin-top:8px">償却を減らすと今期の利益は約${fmtYen(total * v)}増えて見えますが、資産の価値は実際には減っています。銀行は「正常に償却した場合」の利益に直して評価するので、格付はほとんど良くなりません（償却不足は${term('減価償却率', 'depRate')}の低下でわかります）。</p>` : ''}</details>`;
  }
  return '';
}
function ksQuizHtml(step) {
  const c = G.closing;
  const qz = ksQuizFor(step);
  if (!qz) return '';
  const ans = c.ans[step];
  const order = ksShuffle(qz.choices, c.fy * 7 + c.steps.indexOf(step));
  return `<div class="qz"><div class="qz-q"><span class="qz-tag">問題</span>${qz.q}</div>
    <div class="qz-ch">${order.map(({ x, i }) => {
      const st = ans ? (i === qz.correct ? ' ok' : i === ans.pick ? ' ng' : '') : '';
      return `<button type="button" class="qz-b${st}" data-act="kQz" data-i="${i}"${ans ? ' disabled' : ''}>${x}</button>`;
    }).join('')}</div>
    ${ans ? `<div class="qz-a ${ans.ok ? 'ok' : 'ng'}"><b>${ans.ok ? '正解' : '不正解'}</b>　${qz.explain}</div>` : ''}</div>`;
}
MODALS.kClose = () => {
  const c = G.closing;
  if (!c) return modalFrame('決算整理', '<p>決算整理は終わっています。</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  if (c.view === undefined || c.view > c.i) c.view = c.i;
  c.opt = c.opt || {};
  c.entries = c.entries || {};
  const step = c.steps[c.view];
  const info = KS_STEP_INFO[step];
  const done = c.view < c.i;
  const bar = `<ol class="wiz">${c.steps.map((s, k) => `<li class="${k < c.i ? 'done' : k === c.i ? 'now' : ''}${k === c.view ? ' sel' : ''}"><button type="button" data-act="kCloseView" data-i="${k}"${k > c.i ? ' disabled' : ''}><span class="n">${k + 1}</span>${KS_STEP_INFO[s].s}</button></li>`).join('')}</ol>`;
  let body = bar;
  if (step === 'done') {
    const st = ksBuildFY(c.fy);
    const ms = G.months.filter(x => fyOf(x.m) === c.fy);
    const mgOrd = sum(ms, x => x.mg.ord);
    const prev = G.fys[c.fy - 1];
    const line = (n, v, p, tk, cls = '') => `<tr class="${cls}"><td>${term(n, tk)}</td><td class="n">${p === undefined ? '' : fmtK(p)}</td><td class="n ${v < 0 ? 'neg' : ''}">${fmtK(v)}</td></tr>`;
    const b = st.bs;
    const ta = ksAssets(), eq = ksEquity();
    body += `<h3 class="fsh">決算整理が終わりました</h3><p>すべての決算整理の仕訳を記帳しました。収益と費用を締め切って当期純利益を繰越利益剰余金に移すと（決算振替）、${ksFyLabel(c.fy)}の決算書が完成します。</p>
      <div class="grid g2"><div><table class="fs"><thead><tr><th>損益計算書（千円）</th><th>前期</th><th>今期</th></tr></thead><tbody>
        ${line(ksSalesName(), st.pl.sales, prev && prev.pl.sales, 'sales', 'sum')}${line('売上総利益', st.pl.gp, prev && prev.pl.gp, 'gp')}${line('営業利益', st.pl.opi, prev && prev.pl.opi, 'opi', 'sum')}${line('経常利益', st.pl.ord, prev && prev.pl.ord, 'ord', 'sum')}${line('当期純利益', st.pl.ni, prev && prev.pl.ni, 'ni', 'grand')}</tbody></table></div>
      <div><table class="fs"><thead><tr><th>貸借対照表（千円）</th><th>前期</th><th>今期</th></tr></thead><tbody>
        ${line('資産合計', ta, prev && ksToBankFS(prev, false).TA, 'ta', 'sum')}${line('借入金', b.std + b.ltd, prev && prev.bs.std + prev.bs.ltd, 'debt')}${line('純資産', eq, prev && prev.bs.capital + prev.bs.re, 'eq', 'sum')}
        <tr><td>${term('自己資本比率', 'eqR')}</td><td class="n">${prev ? fmtPct((prev.bs.capital + prev.bs.re) / Math.max(1, ksToBankFS(prev, false).TA) * 100, 1) : ''}</td><td class="n">${fmtPct(eq / Math.max(1, ta) * 100, 1)}</td></tr></tbody></table></div></div>
      <div class="callout" style="margin-top:10px"><b>月次と決算の差</b>：毎月の月次決算の経常利益を合計すると ${fmtYen(mgOrd)}、決算整理後の経常利益は ${fmtYen(st.pl.ord)}（差 ${fmtYen(st.pl.ord - mgOrd)}）。差は、実地棚卸の減耗、減価償却費の確定、引当金、未払・前払の調整の分です。</div>
      ${c.quiz && c.quiz.asked ? `<p class="small" style="margin-top:8px">決算整理の問題：<b>${c.quiz.asked}問中${c.quiz.correct}問</b>正解</p>` : ''}
      <details style="margin-top:8px"><summary class="small">決算整理後の残高試算表を見る</summary>${ksTrialBalance()}</details>`;
  } else {
    const qz = ksQuizFor(step);
    const answered = !qz || c.ans[step];
    const entries = done ? (c.entries[step] || []) : step === 'con' ? [] : ksPostStep(step, c.opt[step] || {}, true);
    body += `<h3 class="fsh">${c.view + 1}. ${info.t}${done ? ' <span class="tag ok">記帳済み</span>' : ''}</h3>
      <div class="learnbox">${ksStepLearn(step)}</div>
      <div style="margin:10px 0">${ksStepData(step)}</div>
      ${ksQuizHtml(step)}
      ${!done && answered ? ksTemptation(step) : ''}
      ${answered ? `<h4 class="fsh" style="margin-top:12px">${done ? '記帳した仕訳' : '記帳する仕訳'}</h4>${entries.length ? ksJournalTable(entries.map(e => Object.assign({ c: true }, e)), { total: false }) : '<p class="small muted">この手順で新しく記帳する仕訳はありません。工事の費用と代金は、毎月の取引で未成工事支出金・未成工事受入金に記帳済みです。</p>'}` : ''}
      ${c.view === 0 && !done ? `<details style="margin-top:10px"><summary class="small">決算整理前の残高試算表を見る</summary>${ksTrialBalance()}</details>` : ''}`;
  }
  let foot = btn('あとで続ける', 'closeModal');
  if (done) foot += btn('いまの手順へ', 'kCloseView', { i: c.i }, 'primary');
  else if (step === 'done') foot += btn('決算を確定する', 'kCloseFinish', {}, 'primary');
  else {
    const answered = !ksQuizFor(step) || c.ans[step];
    foot += btn(step === 'con' ? '確認して次へ' : '記帳して次へ', 'kCloseNext', {}, 'primary', { disabled: !answered });
  }
  return modalFrame(`${ksFyLabel(c.fy)}の決算整理`, body, foot, { size: 'wide', sub: `${ksFyYear(c.fy)}・決算日 ${ymLabel(c.fy * 12 + 11)}末　手順 ${Math.min(c.i + 1, c.steps.length)}／${c.steps.length}` });
};
Object.assign(ACTIONS, {
  kQz: d => {
    const c = G.closing;
    const step = c.steps[c.view];
    if (c.ans[step] || c.view !== c.i) return;
    const qz = ksQuizFor(step);
    const ok = +d.i === qz.correct;
    c.ans[step] = { pick: +d.i, ok };
    c.quiz = c.quiz || { asked: 0, correct: 0 };
    c.quiz.asked++; if (ok) c.quiz.correct++;
    G.quiz.asked++; if (ok) G.quiz.correct++;
    drawModal();
  },
  kCloseOpt: d => { const c = G.closing; const step = c.steps[c.view]; c.opt[step] = Object.assign({}, c.opt[step], { [d.k]: +d.v }); drawModal(); },
  kCloseView: d => { const c = G.closing; c.view = Math.min(+d.i, c.i); drawModal(); const mb = document.querySelector('.modal .mb'); if (mb) mb.scrollTop = 0; },
  kCloseNext: () => {
    const c = G.closing;
    const step = c.steps[c.i];
    if (c.view !== c.i || step === 'done') return;
    if (ksQuizFor(step) && !c.ans[step]) return;
    if (step !== 'con') c.entries[step] = ksPostStep(step, c.opt[step] || {});
    c.i++;
    c.view = c.i;
    drawModal();
    const mb = document.querySelector('.modal .mb');
    if (mb) mb.scrollTop = 0;
    render();
    scheduleSave();
  },
  kCloseFinish: () => {
    const c = G.closing;
    if (!c) return;
    ksFinishClosing();
    UI.kFy = null;
    UI.modal = null;
    UI.queue = [];
    for (const s of (G.pendingModals || [])) UI.queue.push({ name: s.type, args: s });
    G.pendingModals = [];
    render();
    autosave();
    showModal('kResult');
  },
});
MODALS.kResult = () => {
  const r = G.lastClosing;
  const st = r && G.fys[r.fy];
  if (!st) return modalFrame('決算', '<p>データがありません</p>', btn('閉じる', 'closeModal', {}, 'primary'));
  const prev = G.fys[r.fy - 1];
  const s = ksToBankFS(st, false), p = prev ? ksToBankFS(prev, false) : null;
  const row = (n, tk, v, pv, f = fmtYen) => `<tr><td>${term(n, tk)}</td><td class="n">${pv === null || pv === undefined ? '―' : f(pv)}</td><td class="n ${v < 0 ? 'neg' : ''}">${f(v)}</td></tr>`;
  const gb = r.gradeBefore, ga = r.gradeAfter;
  const gtxt = !gb ? '' : ga < gb ? `<span class="pos">${gb} → ${ga} に上がりました</span>` : ga > gb ? `<span class="neg">${gb} → ${ga} に下がりました</span>` : `${ga} のまま`;
  const body = `<div class="row" style="gap:16px;align-items:center;margin-bottom:12px"><div class="gradebig">${ga}</div><div><b>銀行の格付</b> ${gtxt}<div class="small">${ksGradeText(ga)}</div></div></div>
    ${st.bankNote ? `<p class="callout bad">${esc(st.bankNote)}</p>` : ''}
    <table class="t compact"><thead><tr><th></th><th class="n">前期</th><th class="n">今期</th></tr></thead><tbody>
      ${row(ksSalesName(), 'sales', st.pl.sales, prev && prev.pl.sales)}${row('経常利益', 'ord', st.pl.ord, prev && prev.pl.ord)}${row('当期純利益', 'ni', st.pl.ni, prev && prev.pl.ni)}
      ${row('純資産', 'eq', s.EQ, p && p.EQ)}${row('自己資本比率', 'eqR', s.EQ / s.TA * 100, p ? p.EQ / p.TA * 100 : null, v => fmtPct(v, 1))}${row('借入金', 'debt', s.STD + s.LTD, p && p.STD + p.LTD)}</tbody></table>
    ${st.quiz && st.quiz.asked ? `<p class="small" style="margin-top:10px">決算整理の問題 <b>${st.quiz.correct}/${st.quiz.asked}問</b> 正解。</p>` : ''}
    <p class="note">4月から${ksFyLabel(r.fy + 1)}が始まります。まず「予算と実績」で今期の予算を決めましょう。決算書は「決算書」の画面でいつでも読めます。銀行がどう読んだかは「資金と銀行」で確かめられます。</p>`;
  return modalFrame(`${ksFyLabel(r.fy)}の決算が確定しました`, body, btn('銀行から見た決算書', 'kGo', { tab: 'k_bank', sec: 'view' }) + btn('決算書を見る', 'kGoFs', { v: 'pl' }) + btn('閉じる', 'closeModal', {}, 'primary'), { sub: ksFyYear(r.fy) });
};
