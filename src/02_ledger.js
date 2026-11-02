'use strict';
/* =========================================================
 *  02_ledger.js : 複式簿記の総勘定元帳
 *  すべての取引は post() による仕訳で記帳し、
 *  貸借対照表・損益計算書は元帳残高から作成する。
 * ========================================================= */

function newLedger() {
  const bal = {};
  for (const k of ACCT_KEYS) bal[k] = 0;
  return { bal, mflow: {}, jcur: {}, journal: [] };
}
const isDebitNature = k => { const t = ACCT[k].type; return t === 'A' || t === 'X'; };
const isPL = k => { const t = ACCT[k].type; return t === 'R' || t === 'X'; };

/* 仕訳の記帳。lines = [[勘定, 借方, 貸方], ...]（金額は円） */
function post(desc, lines) {
  const L = G.ledger;
  let dsum = 0, csum = 0;
  const rl = [];
  for (const [k, d, c] of lines) {
    if (!(k in ACCT)) throw new Error('勘定科目がありません: ' + k);
    const dd = Math.round(d || 0), cc = Math.round(c || 0);
    if (dd === 0 && cc === 0) continue;
    if (dd < 0 || cc < 0) throw new Error('負の仕訳金額: ' + desc + ' ' + k);
    rl.push([k, dd, cc]);
    dsum += dd; csum += cc;
  }
  if (!rl.length) return;
  if (dsum !== csum) {
    const diff = dsum - csum;
    if (Math.abs(diff) > 2) throw new Error(`貸借不一致の仕訳: ${desc} 借方${dsum} 貸方${csum}`);
    // 端数調整（丸め誤差のみ）
    const side = diff > 0 ? 2 : 1;
    let best = rl[0];
    for (const l of rl) if (l[side] > best[side]) best = l;
    best[side] += Math.abs(diff);
  }
  for (const [k, d, c] of rl) {
    const delta = isDebitNature(k) ? d - c : c - d;
    L.bal[k] += delta;
    if (isPL(k)) L.mflow[k] = (L.mflow[k] || 0) + delta;
  }
  const j = L.jcur[desc] || (L.jcur[desc] = { desc, n: 0, lines: {} });
  j.n++;
  for (const [k, d, c] of rl) {
    const e = j.lines[k] || (j.lines[k] = [0, 0]);
    e[0] += d; e[1] += c;
  }
}

/* よく使う定型仕訳 */
function receive(amount, revAcct, desc) { // 収益の受入（日銀当座へ）
  if (amount <= 0) return;
  post(desc, [['boj', amount, 0], [revAcct, 0, amount]]);
}
function payExpense(amount, expAcct, desc) { // 費用の支払（日銀当座から）
  if (amount <= 0) return;
  post(desc, [[expAcct, amount, 0], ['boj', 0, amount]]);
}

const B = k => G.ledger.bal[k];
function curProfit() {
  let r = 0;
  for (const k of REV_KEYS) r += B(k);
  for (const k of EXP_KEYS) r -= B(k);
  return r;
}
function totalAssets() {
  return B('cash') + B('boj') + B('callLoan') + B('securities') + B('loans') + B('tangible') + B('intangible') + B('otherAssets') - B('allowance');
}
function totalLiab() {
  return B('depOrd') + B('depTime') + B('callMoney') + B('bojBorrow') + B('taxPayable') + B('divPayable') + B('otherLiab');
}
function netAssets() { return B('capital') + B('prefCapital') + B('capSurplus') + B('retained') + curProfit(); }
function ledgerDiff() { return totalAssets() - totalLiab() - netAssets(); }
function deposits() { return B('depOrd') + B('depTime'); }

/* 月末の元帳スナップショット（BS科目＋当月PL） */
function bsSnapshot() {
  const s = {};
  for (const k of ACCT_KEYS) if (!isPL(k)) s[k] = G.ledger.bal[k];
  s.curProfit = curProfit();
  return s;
}

/* 月次の仕訳帳を確定（直近24か月を保持） */
function closeJournalMonth(m) {
  const L = G.ledger;
  const entries = Object.values(L.jcur).map(j => ({
    desc: j.desc, n: j.n,
    lines: Object.entries(j.lines).map(([k, v]) => [k, v[0], v[1]]),
  }));
  L.journal.push({ m, entries });
  while (L.journal.length > 24) L.journal.shift();
  L.jcur = {};
  const flow = L.mflow;
  L.mflow = {};
  return flow;
}

/* 決算整理：収益・費用勘定を利益剰余金へ振り替える */
function closeBooks(desc) {
  const lines = [];
  let net = 0;
  for (const k of REV_KEYS) { const v = B(k); if (v) { lines.push([k, v > 0 ? v : 0, v < 0 ? -v : 0]); net += v; } }
  for (const k of EXP_KEYS) { const v = B(k); if (v) { lines.push([k, v < 0 ? -v : 0, v > 0 ? v : 0]); net -= v; } }
  if (net > 0) lines.push(['retained', 0, net]);
  else if (net < 0) lines.push(['retained', -net, 0]);
  // 振替仕訳は月次損益（mflow）に含めない
  const saved = Object.assign({}, G.ledger.mflow);
  if (lines.length) post(desc, lines);
  G.ledger.mflow = saved;
  return net;
}
