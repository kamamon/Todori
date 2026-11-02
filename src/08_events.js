'use strict';
/* =========================================================
 *  08_events.js : 突発イベント・行員の不正・支店報告・
 *                 金融庁検査・監査法人監査・信用度
 * ========================================================= */

/* ---------- 行員の不正（着服・架空経費） ---------- */
function branchSize(b) { return { hq: 1.4, full: 1.0, small: 0.55 }[b.type]; }

function processInternalFraudMonthly() {
  const auditLv = G.sys.audit;
  const cr = compRatio();
  for (const b of openBranches()) {
    if (G.ifraud.some(f => f.bid === b.id && !f.detected)) continue;
    const p = 0.0016 * branchSize(b) * (G.salaryLv < 1 ? 1.5 : 1) * [1, 0.7, 0.45][auditLv] * clamp(1.5 - cr, 0.5, 1.5);
    if (chance(p)) {
      const type = chance(0.55) ? 'embezzle' : 'expense';
      G.ifraud.push({ id: 'X' + (++G.seq.if), bid: b.id, type, startM: G.m, monthly: type === 'embezzle' ? uni(50e4, 250e4) : uni(30e4, 120e4), cum: 0, detected: false, who: personName() });
    }
  }
  for (const f of G.ifraud) {
    if (f.detected) continue;
    const b = G.branches.find(x => x.id === f.bid);
    if (!b) { f.detected = true; f.lost = true; continue; }
    const amt = Math.round(f.monthly * Math.pow(1.06, G.m - f.startM));
    f.cum += amt;
    if (f.type === 'embezzle') post('普通預金の払出（窓口）', [['depOrd', amt, 0], ['cash', 0, Math.min(amt, B('cash'))], ['boj', 0, Math.max(0, amt - B('cash'))]]);
    else payExpense(amt, 'premises', '支店経費（雑費）');
    const age = G.m - f.startM;
    // 内部監査による発見
    if (chance(0.02 + 0.05 * auditLv + 0.03 * Math.min(1, cr))) { detectInternalFraud(f, 'internal'); continue; }
    // 外部からの発覚（顧客の訴え・報道）
    if (age > 12 && chance(0.03 * (age - 12) / 6)) detectInternalFraud(f, 'external');
  }
}

function detectInternalFraud(f, how) {
  f.detected = true; f.detM = G.m; f.how = how;
  const b = G.branches.find(x => x.id === f.bid);
  const name = b ? b.name : '支店';
  const big = how === 'external';
  if (f.type === 'embezzle') post('行員の着服に伴う顧客への補償', [['extraLoss', f.cum, 0], ['depOrd', 0, f.cum]]);
  const recov = Math.round(f.cum * uni(0.1, 0.35));
  G.pendingRecoveries.push({ m: G.m + 6, amt: recov, desc: '不正行員からの損害賠償の回収' });
  const what = f.type === 'embezzle' ? '顧客預金の着服' : '架空経費の計上';
  const hit = big ? clamp(6 + f.cum / 1e8 * 3, 6, 25) : clamp(2 + f.cum / 1e8, 2, 8);
  G.trust = clamp(G.trust - hit, 0, 100);
  G.scandalHeat += big ? 10 : 4;
  G.stats.scandals++;
  const via = how === 'special' ? '臨時監査で' : how === 'internal' ? '内部監査で' : how === 'fsa' ? '金融庁検査で' : how === 'auditor' ? '監査法人の監査で' : '顧客からの訴えで';
  addNews('bank', `${name}の行員による${what}が${via}発覚。被害額${fmtYen(f.cum)}（${G.m - f.startM}か月間）`, 'bad');
  if (big && f.cum > 1e8) { G.fsa.special = true; }
}

function specialAudit(bid) {
  if (G.capUsed.audit >= auditSlots()) return { ok: false, msg: `今月の臨時監査の枠（${auditSlots()}件）を使い切りました。管理・監査の人員を増やしてください` };
  const b = G.branches.find(x => x.id === bid);
  if (!b) return { ok: false, msg: '店舗が見つかりません' };
  G.capUsed.audit++;
  payExpense(300e4, 'premises', '臨時監査費用');
  b.lastAudit = G.m;
  const f = G.ifraud.find(x => x.bid === bid && !x.detected);
  if (f && chance(0.9)) { detectInternalFraud(f, 'special'); G.stats.auditHits++; return { ok: true, found: true, f }; }
  return { ok: true, found: false };
}

/* ---------- 支店の月次報告 ---------- */
function makeBranchReports() {
  const tg = depositTargets();
  const pres = districtPresence();
  const svc = serviceQuality();
  const tot = sum(Object.values(tg.byD), x => x.ord + x.time) || 1;
  const dep = cityDeposits() - tg.nat;
  for (const b of openBranches()) {
    const T = BRANCH_TYPES[b.type];
    const sz = branchSize(b);
    const w = T.presence * branchMaturity(b) / Math.max(0.01, pres[b.d]);
    const d = tg.byD[b.d];
    const depB = dep * (d.ord + d.time) / tot * w;
    const loans = sum(G.loans.filter(L => L.district === b.d && isActiveLoan(L) && L.kind !== 'pool'), L => L.bal) * w;
    const staffCost = (T.ops + T.sales + 2) * BASE_SALARY * G.salaryLv / 12;
    const fr = G.ifraud.find(f => f.bid === b.id && !f.detected);
    const age = fr ? G.m - fr.startM : 0;
    const rep = {
      m: G.m,
      dep: depB, loans,
      exp: (b.type === 'hq' ? 0 : DIST[b.d].rent * T.rentMul) + staffCost + 80e4 * sz + randn() * 15e4 * sz + (fr && fr.type === 'expense' ? fr.monthly * Math.pow(1.06, age) : 0),
      suspense: Math.max(0, uni(50e4, 300e4) * sz + (fr && fr.type === 'expense' ? fr.cum * 0.4 : 0)),
      cashDiff: poisson(0.25 * sz) + (fr && fr.type === 'embezzle' ? poisson(0.5 + 0.04 * age) : 0),
      complaints: poisson(0.9 * sz * (svc < 0.9 ? 1.5 : 1)) + (fr && fr.type === 'embezzle' ? poisson(0.12 * age) : 0),
      errors: poisson(0.5 * sz / Math.max(0.5, svc)),
    };
    const arr = G.branchReports[b.id] || (G.branchReports[b.id] = []);
    arr.push(rep);
    while (arr.length > 12) arr.shift();
  }
}

/* 異常値の検知（監査支援システム） */
function branchAnomalies(bid) {
  const arr = G.branchReports[bid] || [];
  if (arr.length < 4) return [];
  const last = arr[arr.length - 1], prev = arr.slice(0, -1);
  const out = [];
  const z = (k) => {
    const v = prev.map(x => x[k]);
    const mu = sum(v) / v.length;
    const sd = Math.sqrt(sum(v, x => (x - mu) * (x - mu)) / v.length) || (Math.abs(mu) * 0.1 + 1);
    return (last[k] - mu) / sd;
  };
  if (z('exp') > 2) out.push('経費');
  if (z('suspense') > 2) out.push('仮払金');
  if (z('cashDiff') > 2 && last.cashDiff >= 2) out.push('現金過不足');
  if (z('complaints') > 2 && last.complaints >= 3) out.push('苦情');
  return out;
}
function fraudRiskScore(bid) {
  const arr = G.branchReports[bid] || [];
  if (arr.length < 4) return 0;
  const recent = arr.slice(-3), early = arr.slice(0, Math.max(1, arr.length - 3));
  const avg = (xs, k) => sum(xs, x => x[k]) / xs.length;
  let s = 10;
  s += clamp((avg(recent, 'complaints') - avg(early, 'complaints')) * 12, 0, 30);
  s += clamp((avg(recent, 'cashDiff') - avg(early, 'cashDiff')) * 15, 0, 25);
  s += clamp((avg(recent, 'suspense') / Math.max(1, avg(early, 'suspense')) - 1) * 30, 0, 25);
  s += clamp((avg(recent, 'exp') / Math.max(1, avg(early, 'exp')) - 1) * 80, 0, 20);
  return clamp(Math.round(s + randn() * 4), 0, 100);
}

/* ---------- 突発イベント ---------- */
function eventsStep() {
  const load = coreLoad();
  // システム障害
  if (chance(0.002 + clamp(load - 0.85, 0, 0.5) * 0.15)) {
    systemFailure(false);
    addNews('bank', `勘定系システムで障害が発生し、ATMと振込が数時間停止（処理能力の使用率${fmtPct(load * 100, 0)}）`, 'bad');
  }
  // サイバー攻撃
  if (chance(0.003 * (1 + G.sys.digital) * [1, 0.5, 0.25, 0.1][G.sys.cyber])) {
    const cost = Math.round(uni(0.5e8, 3e8) * Math.sqrt(Math.max(1, accountsCount() / 20000)));
    post('不正アクセス事案の対応費用', [['extraLoss', cost, 0], ['boj', 0, cost]]);
    G.trust = clamp(G.trust - uni(6, 12), 0, 100);
    G.scandalHeat += 6; G.stats.scandals++;
    addNews('bank', `ネットバンキングへの不正アクセスで顧客情報が流出した可能性。対応費用${fmtYen(cost)}`, 'bad');
  }
  // マネロン事案
  if (chance(0.0025 * Math.min(4, Math.sqrt(accountsCount() / 20000)) * [1, 0.55, 0.3, 0.12][G.sys.aml])) {
    const cost = Math.round(uni(0.3e8, 2e8) * Math.sqrt(Math.max(1, accountsCount() / 200000)));
    post('マネー・ローンダリング事案の対応費用', [['extraLoss', cost, 0], ['boj', 0, cost]]);
    G.trust = clamp(G.trust - 5, 0, 100);
    G.scandalHeat += 5; G.stats.scandals++;
    G.fsa.special = true;
    addNews('bank', '当行の口座が特殊詐欺グループの資金洗浄に悪用されていたことが判明。金融庁が報告を求める', 'bad');
  }
  // 大口預金の獲得
  if (chance(0.02 * clamp(G.trust / 60, 0.3, 1.5))) {
    const amt = roundTo(cityDeposits() * uni(0.02, 0.06), 1e8);
    G.flags.bigDep = (G.flags.bigDep || 0) + amt;
    addNews('bank', `地元企業から決済口座の集約を受け、約${fmtYen(amt)}の預金を獲得する見込み`, 'good');
  }
  // 指定金融機関
  if (!G.flags.designated && G.trust >= 70 && openBranches().length >= 5 && G.ratingIdx <= 5 && G.stats.projectsFunded >= 2) {
    G.flags.designated = roundTo(cityStats().depMkt * 0.02, 1e8);
    G.trust = clamp(G.trust + 3, 0, 100);
    addNews('city', `汐見市が当行を指定金融機関に選定。市の公金約${fmtYen(G.flags.designated)}の取扱いを開始`, 'good');
  }
  // 好意的な報道
  if (chance(0.008)) {
    G.trust = clamp(G.trust + 2, 0, 100);
    addNews('bank', pick(['地元紙が当行の事業承継支援を特集', '当行の創業支援融資が地域経済誌で紹介される', '高齢者向けの見守りサービスが好評']), 'good');
  }
  // 自然災害
  if (chance(0.006)) {
    const D = pick(DISTRICTS);
    const sev = uni(0.5, 1.5);
    districtDisaster(D.id, sev);
    const br = openBranches().filter(b => b.d === D.id);
    if (br.length) {
      const cost = Math.round(3000e4 * sev * br.length);
      post('災害による店舗の復旧費用', [['extraLoss', cost, 0], ['boj', 0, cost]]);
    }
    addNews('city', `${pick(['記録的な豪雨', '大型台風', '震度6弱の地震'])}で${D.name}に大きな被害。地元企業の操業に影響`, 'bad', { dist: D.id });
  }
  // 近隣金融機関の破綻
  if ((G.eco.regime === 'recession' || G.eco.regime === 'crisis') && chance(0.004)) {
    const inflow = G.trust >= 55 ? roundTo(cityDeposits() * uni(0.03, 0.08), 1e8) : 0;
    if (inflow) G.flags.bigDep = (G.flags.bigDep || 0) + inflow;
    addNews('eco', `近隣の第二地方銀行が経営破綻。${inflow ? `安全を求める預金が当行に流入（約${fmtYen(inflow)}）` : '預金者の不安が広がる'}`, inflow ? 'good' : 'bad');
    if (!inflow) G.trust = clamp(G.trust - 4, 0, 100);
  }
  // 経営不安の噂（取り付け）
  if (G.trust < 40 && capitalRatio() < 6 && chance(0.04)) {
    G.runShock = uni(0.08, 0.2);
    G.trust = clamp(G.trust - 8, 0, 100);
    addNews('bank', 'SNSで当行の経営不安の噂が拡散。ATMに預金を引き出す人の行列ができた', 'bad');
  }
  // 謝絶した粉飾企業の破綻（審査の目の正しさ）
  for (const r of G.rejectedLog.slice()) {
    if (r.fraud && G.m - r.m >= 3 && chance(0.04)) {
      addNews('loan', `当行が融資を謝絶した「${r.name}」が粉飾決算の発覚で破綻。審査部の判断が正しかった`, 'good');
      G.stats.fraudDodged++;
      G.rejectedLog = G.rejectedLog.filter(x => x !== r);
    } else if (G.m - r.m > 36) G.rejectedLog = G.rejectedLog.filter(x => x !== r);
  }
  // 回収予定
  for (const r of G.pendingRecoveries.slice()) {
    if (G.m >= r.m) {
      if (r.amt > 0) receive(r.amt, 'extraGain', r.desc);
      G.pendingRecoveries = G.pendingRecoveries.filter(x => x !== r);
    }
  }
  G.scandalHeat *= 0.96;
}

/* ---------- 信用度 ---------- */
function updateTrust() {
  const cr = capitalRatio() - (reqCR() - 4), npl = nplRatio();
  let t = 60;
  t += cr >= 12 ? 8 : cr >= 8 ? 4 : cr >= 4 ? -6 : -25;
  t += npl < 2 ? 4 : npl < 5 ? 0 : npl < 10 ? -8 : -18;
  t += [7, 6, 5, 4, 3, 2, 1, 0, -2, -5, -8, -12, -20][G.ratingIdx];
  t += clamp((serviceQuality() - 1) * 20, -12, 3);
  t += Math.min(8, sum(Object.values(districtPresence())) * 1.0 + G.adBudget / 2000e4 + natLevelSum() / 6);
  t -= G.scandalHeat;
  if (coreLoad() > 1) t -= 6;
  if (G.flags.publicFunds) t -= 4;
  G.trust = clamp(G.trust + (t - G.trust) * 0.06, 0, 100);
}

/* ---------- 金融庁検査 ---------- */
function fsaStep() {
  const f = G.fsa;
  if (f.special && f.nextM > G.m + 3) { f.nextM = G.m + 2; f.special = false; }
  if (G.m === f.nextM - 1) {
    addNews('reg', `金融庁から来月の立入検査の予告。自己査定と管理態勢を点検しておく必要がある`, 'neutral');
    G.inbox.push({ id: 'I' + (++G.seq.inbox), type: 'fsaNotice', m: G.m, exp: G.m });
  }
  if (G.m >= f.nextM) runInspection();
}

function amlRequired() {
  const d = deposits();
  const base = d > 3000e8 ? 3 : d > 1500e8 ? 2 : d > 600e8 ? 1 : 0;
  return Math.max(base, [0, 2, 3][G.stage || 0]);
}

function runInspection() {
  const f = G.fsa;
  const findings = [];
  let under = 0, addProv = 0, sev3 = false;
  const knows = {};
  for (const L of G.loans) {
    if (!isActiveLoan(L) || L.kind === 'pool' || L.kind === 'seg') continue;
    let k = false;
    if (L.kind === 'biz') {
      const co = G.companies[L.coId];
      if (co.fraud && co.fraud.years > 0) {
        if (knows[co.id] === undefined) knows[co.id] = co.fraud.found || chance(0.6 * (G.cfg || DIFFICULTY[G.difficulty]).fsa);
        k = knows[co.id];
        if (k && !co.fraud.found) { co.fraud.found = true; co.fraud.foundBy = 'fsa'; L.fraudKnown = true; }
      }
    } else if (L.kind === 'mort' && L.person.fraud) k = chance(0.5);
    const fc = fsaClass(L, k);
    if (fc > L.cls) {
      under++;
      addProv += provisionFor(L, fc) - provisionFor(L, L.cls);
      L.cls = fc;
    }
  }
  const cap = Math.max(1, coreCapital());
  if (under) {
    const s = addProv > cap * 0.1 ? 3 : addProv > cap * 0.03 ? 2 : 1;
    if (s === 3) sev3 = true;
    findings.push({ sev: s, text: `自己査定の甘さ：${under}先の債務者区分を引き下げ、${fmtYen(addProv)}の追加引当を要請` });
  }
  const unrev = G.inbox.filter(x => x.type === 'review' && G.m - x.m > 4).length;
  if (unrev) findings.push({ sev: unrev > 5 ? 2 : 1, text: `期中管理の不備：受領から5か月以上たっても検証していない決算書が${unrev}先` });
  if (G.sys.aml < amlRequired()) findings.push({ sev: 2, text: `マネロン・テロ資金供与対策の態勢が規模に見合っていない（必要水準 Lv${amlRequired()}）` });
  if (G.sys.digital >= 2 && G.sys.cyber < G.sys.digital - 1) findings.push({ sev: 1, text: 'デジタルチャネルの拡大に対し、サイバーセキュリティ対策が遅れている' });
  if (coreLoad() > 0.9) findings.push({ sev: 2, text: `勘定系システムの処理能力に余裕がない（使用率${fmtPct(coreLoad() * 100, 0)}）` });
  if (compRatio() < 0.8) findings.push({ sev: (G.stage || 0) >= 1 ? 2 : 1, text: '管理・監査部門の人員が業容に比べて不足している' });
  if ((G.stage || 0) >= 1 && G.sys.cyber < 2) findings.push({ sev: 2, text: '全国規模の決済インフラを担う銀行として、サイバーセキュリティ対策が不十分' });
  if ((G.stage || 0) >= 2 && G.sys.audit < 2) findings.push({ sev: 2, text: '海外拠点を含むグループ全体の内部監査態勢が整っていない' });
  for (const x of G.ifraud) {
    if (!x.detected && chance(0.5)) { detectInternalFraud(x, 'fsa'); findings.push({ sev: 3, text: '内部管理態勢の重大な欠陥：行員の不正を見逃していた' }); sev3 = true; }
  }
  const cr = capitalRatio();
  if (cr < reqCR() + 2) findings.push({ sev: 2, text: `自己資本比率が${fmtPct(cr)}と低く、資本の充実が必要` });
  const ir = irrbb() / cap * 100;
  if (ir > 20) findings.push({ sev: 1, text: `金利リスク量が自己資本の${fmtPct(ir, 0)}に達し、重要性テストの基準（20%）を超過` });
  const score = sum(findings, x => x.sev);
  let grade, text;
  if ((sev3 && score >= 4) || score >= 6) {
    grade = 'D'; text = '業務改善命令';
    G.flags.order = G.m + 12;
    G.trust = clamp(G.trust - 10, 0, 100);
    G.scandalHeat += 8;
    G.stock.price *= 0.88;
  } else if (score >= 3) { grade = 'C'; text = '改善指導'; G.trust = clamp(G.trust - 3, 0, 100); }
  else if (score >= 1) { grade = 'B'; text = '軽微な指摘'; }
  else { grade = 'A'; text = '指摘事項なし'; G.trust = clamp(G.trust + 2, 0, 100); }
  if (addProv > 0) trueUpProvisions('金融庁検査を受けた追加引当');
  const rec = { m: G.m, grade, text, findings, under, addProv };
  f.history.push(rec);
  f.nextM = G.m + ((G.stage || 0) >= 1 ? randInt(12, 20) : randInt(24, 36)) - (grade === 'D' ? 6 : 0);
  f.special = false;
  addNews('reg', `金融庁検査が終了。結果：${text}${findings.length ? `（指摘${findings.length}件）` : ''}`, grade <= 'B' ? 'good' : 'bad');
  if (grade === 'D') addNews('reg', `金融庁が当行に業務改善命令。1年間は新規出店が制限される`, 'bad');
  G.pendingModals.push({ type: 'fsa', idx: f.history.length - 1 });
}

/* ---------- 監査法人の期末監査 ---------- */
function externalAudit() {
  let adj = 0, n = 0;
  for (const L of G.loans) {
    if (!isActiveLoan(L) || L.kind === 'pool' || L.kind === 'seg') continue;
    let ac = sysClass(L);
    if (L.kind === 'biz') {
      const co = G.companies[L.coId];
      const s = co.fraud && co.fraud.found ? latestTrue(co) : latestRep(co);
      if (bankGrade(co) >= 9 && s.EQ < 0 && s.ORD < 0) ac = Math.max(ac, 3);
    }
    if (ac > L.cls) { adj += provisionFor(L, ac) - provisionFor(L, L.cls); L.cls = ac; n++; }
  }
  const notes = [];
  if (n) { trueUpProvisions('監査法人の指摘による追加引当'); notes.push(`${n}先の債務者区分の見直しを求められ、${fmtYen(adj)}を追加引当`); }
  for (const x of G.ifraud) if (!x.detected && chance(0.25)) { detectInternalFraud(x, 'auditor'); notes.push('監査の過程で行員の不正が見つかった'); }
  const opinion = notes.some(t => t.includes('不正')) ? '無限定適正意見（強調事項あり）' : '無限定適正意見';
  return { opinion, notes, adj };
}
