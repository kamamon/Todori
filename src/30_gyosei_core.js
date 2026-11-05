'use strict';
/* =========================================================
 *  30_gyosei_core.js : 行政モード（取り締まる側）のエンジン（画面に依存しない）
 *   労働基準監督署長または消防署長として、管内の事業場（防火対象物）を受け持つ。
 *   事業場には外から見えない法令違反があり、職員の人日を配分して、監督（立入検査）・
 *   災害調査・申告や労災請求の処理・違反の是正（指導 → 勧告・命令 → 送検・告発）を進める。
 *   労働災害や火災が減り、違反が是正され、措置が適正であるほど、年度の評価が上がる。
 *   ※ 制度はゲーム向けに単純化しています。
 * ========================================================= */

const GY_SAVE_VERSION = 1;
const GY_AGENCY = {
  labor: {
    n: '汐見労働基準監督署', s: '監督署', parent: '汐見労働局', parentHead: '汐見労働局長', staffN: '労働基準監督官', staff: 3, days: 12, unit: '事業場',
    insp: '監督', inspKind: '定期監督', inspCost: 6, icon: '労', follow: '再監督',
    items: ['r36', 'otmax', 'unpaid', 'minwage', 'kenshin', 'taisei', 'yukyu', 'contract', 'machine', 'fall', 'chem', 'hoken'],
    goal: '管内で働く人の安全と健康を守り、法律で決められた労働条件を確保する',
  },
  fire: {
    n: '汐見消防署', s: '消防署', parent: '汐見市消防局', parentHead: '汐見市消防長', staffN: '予防課の職員（予防査察員）', staff: 3, days: 9, unit: '防火対象物',
    insp: '立入検査', inspKind: '立入検査', inspCost: 5, icon: '消', follow: '再検査',
    items: ['bouka', 'tenken', 'kunren', 'hinan', 'jikahou', 'shokaki', 'kiken', 'boen'],
    goal: '火災を予防し、火災が起きても人の命が失われないようにする',
  },
};
/* 事業場・建物の種類（w: [労基署の管内の多さ, 消防署の管内の多さ]） */
const GY_TYPES = {
  mfgm: { n: '金属加工工場', use: '工場（12項イ）', spec: false, emp: [12, 120], acc: 0.0034, death: 0.03, fire: 0.0018, fd: 0.03, w: [3, 1], pre: '株式会社', suf: ['精工', '製作所', '工業', '金属'] },
  mfgf: { n: '食品工場', use: '工場（12項イ）', spec: false, emp: [20, 160], acc: 0.003, death: 0.012, fire: 0.0018, fd: 0.03, w: [2, 1], pre: '株式会社', suf: ['食品', 'フーズ', '製菓'] },
  con: { n: '建設会社', use: '', spec: false, emp: [6, 60], acc: 0.0058, death: 0.05, fire: 0, fd: 0, w: [3, 0], pre: '株式会社', suf: ['建設', '工務店', '建工', '組'] },
  trans: { n: '運送会社', use: '倉庫（14項）', spec: false, emp: [10, 90], acc: 0.0048, death: 0.04, fire: 0.0012, fd: 0.02, w: [2, 1], pre: '株式会社', suf: ['運輸', '物流', '運送'] },
  ret: { n: 'スーパー・小売店', use: '物品販売店舗（4項）', spec: true, emp: [10, 110], acc: 0.0028, death: 0.004, fire: 0.0024, fd: 0.04, w: [2, 2], pre: '株式会社', suf: ['ストア', '商店', 'マート'] },
  food: { n: '飲食店', use: '飲食店（3項ロ）', spec: true, emp: [5, 40], acc: 0.0036, death: 0.004, fire: 0.0055, fd: 0.05, w: [2, 3], pre: '株式会社', suf: ['亭', '食堂', 'キッチン', '屋'] },
  care: { n: '介護施設', use: '社会福祉施設（6項ロ）', spec: true, emp: [15, 90], acc: 0.0038, death: 0.004, fire: 0.0014, fd: 0.2, w: [2, 2], pre: '社会福祉法人', suf: ['ケアホーム', 'の里', '苑'] },
  hotel: { n: '旅館・ホテル', use: '旅館・ホテル（5項イ）', spec: true, emp: [10, 80], acc: 0.0028, death: 0.004, fire: 0.002, fd: 0.1, w: [1, 2], pre: '株式会社', suf: ['ホテル', '旅館', '荘'] },
  it: { n: 'IT企業', use: '', spec: false, emp: [10, 100], acc: 0.0008, death: 0.003, fire: 0, fd: 0, w: [1, 0], pre: '株式会社', suf: ['システムズ', 'ソフト', 'テック'] },
  clean: { n: 'ビルメンテナンス会社', use: '', spec: false, emp: [10, 120], acc: 0.004, death: 0.02, fire: 0, fd: 0, w: [1, 0], pre: '株式会社', suf: ['ビルサービス', '美装', 'メンテナンス'] },
  whl: { n: '卸売・倉庫', use: '倉庫（14項）', spec: false, emp: [10, 70], acc: 0.0034, death: 0.02, fire: 0.002, fd: 0.02, w: [1, 1], pre: '株式会社', suf: ['商事', '物産', '倉庫'] },
  zakkyo: { n: '雑居ビル', use: '複合用途（16項イ）', spec: true, emp: [0, 0], acc: 0, death: 0, fire: 0.005, fd: 0.25, w: [0, 3], pre: '', suf: ['ビル', '会館'] },
  apart: { n: 'マンション', use: '共同住宅（5項ロ）', spec: false, emp: [0, 0], acc: 0, death: 0, fire: 0.0045, fd: 0.06, w: [0, 2], pre: '', suf: ['マンション', 'ハイツ', 'レジデンス'] },
  hosp: { n: '病院', use: '病院（6項イ）', spec: true, emp: [30, 200], acc: 0.002, death: 0.003, fire: 0.001, fd: 0.12, w: [0, 1], pre: '医療法人', suf: ['病院', '記念病院'] },
};
const GY_PRE = ['汐見', '港', '北浜', '南町', '東丘', '西浦', '中央', '丸山', '大島', '新町', '朝日', '日の出', '松風', '竹原', '桜台', '青葉', '白浜', '灯台', '潮風', '岬', '若葉', '旭', '富士見', '浜田', '高砂', '緑町', '本町', '栄', '寿', '千鳥'];
/* 違反の起きやすさ（着任時の基準） */
const GY_VBASE = { r36: 0.3, otmax: 0.22, unpaid: 0.22, minwage: 0.08, kenshin: 0.2, taisei: 0.3, yukyu: 0.32, contract: 0.28, machine: 0.35, fall: 0.38, chem: 0.38, hoken: 0.05, bouka: 0.15, tenken: 0.38, kunren: 0.42, hinan: 0.32, jikahou: 0.08, shokaki: 0.28, kiken: 0.15, boen: 0.28 };
/* 毎年・半年ごとにやることで、怠りがちになる項目 */
const GY_PERIODIC = { kenshin: 1, tenken: 1, kunren: 1, hinan: 1, shokaki: 1, r36: 1 };
/* 届出の記録から分かること（役所は、届出が出ていないことを知っている） */
const GY_RECORD = { r36: '36協定の届出がない', hoken: '労働保険の申告がない', tenken: '点検結果の報告がない', bouka: '防火管理者の届出がない' };
/* 局・消防局が示す今年度の重点 */
const GY_FOCUS = {
  con: '建設業の墜落・転落災害の防止', mfgm: '製造業のはさまれ・巻き込まれ災害の防止', trans: '運送業の荷役災害の防止と長時間労働の是正', care: '介護施設の腰痛・転倒災害の防止', it: 'IT企業の長時間労働とメンタルヘルス対策',
  zakkyo: '雑居ビルの避難経路の確保と防火管理', food: '飲食店の厨房火災の予防', hotel: '旅館・ホテルの消防用設備の点検', ret: '大型店舗の避難通路の確保',
};
const GY_FOCUS_CAND = { labor: ['con', 'mfgm', 'trans', 'care', 'it'], fire: ['zakkyo', 'food', 'care', 'hotel', 'ret'] };
/* 措置（軽い順）。cost は職員の人日 */
const GY_MEAS = {
  labor: [
    { id: 'shido', n: '指導票', cost: 0.5, d: '法違反ではない改善事項や、軽い事項の改善を求める（行政指導）' },
    { id: 'kankoku', n: '是正勧告', cost: 1, d: '法違反を指摘し、是正期日までに直して報告するよう求める（行政指導）' },
    { id: 'meirei', n: '使用停止等命令', cost: 2, d: '危険な機械・設備や作業を止めさせる行政処分（労働安全衛生法98条）。危険な状態にだけ使える', danger: true },
    { id: 'soken', n: '送検', cost: 12, d: '特別司法警察員として捜査し、検察庁に送る。重大・悪質な違反や、勧告・命令に従わないとき' },
  ],
  fire: [
    { id: 'koto', n: '口頭指導', cost: 0.3, d: 'その場で直せる軽い事項を口頭で指導する' },
    { id: 'shiteki', n: '違反指摘', cost: 0.8, d: '立入検査結果通知書で違反を指摘し、改修の計画と結果を報告させる' },
    { id: 'keikoku', n: '警告', cost: 1.5, d: '期限を示して違反を直すよう警告する（命令の前の段階）' },
    { id: 'meirei', n: '命令', cost: 3, d: '措置命令・使用停止命令などの行政処分。建物に標識を付けて公示する' },
    { id: 'kokuhatsu', n: '告発', cost: 10, d: '命令に従わないなど悪質な違反を、捜査機関に告発する' },
  ],
};
const GY_EXTEND = { id: 'extend', n: '期日を延長する', cost: 0.3, d: '改善計画を出させ、是正の期日を延ばす。工事などに時間がかかる正当な理由があるとき' };
/* 措置ごとの、期日までに直す確率 [基本, 遵法意識による上乗せ] */
const GY_FIXP = { shido: [0.35, 0.45], kankoku: [0.6, 0.35], meirei: [0.9, 0.1], koto: [0.3, 0.45], shiteki: [0.55, 0.35], keikoku: [0.75, 0.2] };
/* 時間がかかるので「改善計画」が出ることがある項目と、その内容 */
const GY_PLAN_TXT = {
  jikahou: '設備業者と工事の契約を結び、来月に設置する（契約書の写しを提出）', machine: '安全装置を発注し、納品を待っている（注文書の写しを提出）',
  kiken: '危険物倉庫を借りる契約を結び、来月までに移す（契約書の写しを提出）', taisei: '担当者が来月の講習を受ける予定（受講票の写しを提出）',
  bouka: '防火管理講習を来月受ける予定（受講票の写しを提出）', otmax: '2人を採用し、来月から配置する（採用通知の写しを提出）',
  fall: '足場の手すりを発注済みで、来週に納品される（注文書の写しを提出）', tenken: '点検業者と契約し、来月に点検する（契約書の写しを提出）',
};
const GY_ACC_K = 0.25;   // 1人・1か月の事故の起きやすさのうち、休業4日以上になる割合
/* 案件の種類 */
const GY_CASE = {
  death: { n: '死亡災害', act: '災害時監督', cost: 8, must: true },
  report: { n: '休業4日以上の労働災害', act: '災害調査', cost: 4, optional: true },
  complaint: { n: '労働者からの申告', act: '申告監督', cost: 3, must: true },
  claim: { n: '労災保険の請求（業務上かの判断）', act: '請求の調査', cost: 1, must: true },
  claimX: { n: '労災保険の請求（過労・精神障害）', act: '請求の調査', cost: 6, must: true },
  hidden: { n: '労災かくしの疑い', act: '調査', cost: 3, must: true },
  fire: { n: '火災', act: '火災原因調査', cost: 3, must: true },
  tip: { n: '違反の通報', act: '立入検査', cost: 2, must: true },
};
/* 判断が必要な労災請求（ふつうのけが・通勤災害） */
const GY_CLAIMS = [
  { t: '作業中、機械の点検をしていて手を挟まれた', ok: true, cat: '業務災害', ex: '会社の指揮命令の下で仕事をしていて（業務遂行性）、仕事に伴う危険が現実になった（業務起因性）。業務災害です。' },
  { t: '昼休みに会社の階段で転倒した。階段の手すりが壊れたままだった', ok: true, cat: '業務災害', ex: '休憩中の私的な行為による災害は原則として業務外ですが、事業場の施設・設備の欠陥（壊れた手すり）が原因なら業務災害になります。' },
  { t: '昼休みに外の飲食店へ昼食を食べに行く途中、歩道で転倒した', ok: false, cat: '業務災害', ex: '休憩時間に事業場の外で私的な行為（外食）をしていて起きた災害は、会社の管理下にないので業務外です。' },
  { t: '出張先で、泊まったホテルの浴室で滑って転倒した', ok: true, cat: '業務災害', ex: '出張中は移動や宿泊も含めて事業主の支配下にあるとされ、積極的な私的行為でなければ業務上と認められます。' },
  { t: '出張先で、仕事のあとに繁華街で飲酒し、酔って階段から転落した', ok: false, cat: '業務災害', ex: '出張中でも、飲酒や遊興など積極的な私的行為をしている間の災害は業務外です。' },
  { t: '帰り道に夕食の材料を買うためスーパーに寄り、いつもの道に戻ってから自転車で転倒した', ok: true, cat: '通勤災害', ex: '日用品の購入など日常生活上必要な行為のための最小限の寄り道なら、通常の経路に戻った後は再び通勤と認められます。' },
  { t: '仕事帰りに映画館で映画を見て、その帰り道に交通事故にあった', ok: false, cat: '通勤災害', ex: '通勤の経路をそれたり中断したりした後は、日常生活上必要な行為でない限り通勤と認められません。映画鑑賞は当たりません。' },
  { t: '同僚とお金の貸し借りでもめ、休憩中に殴られてけがをした', ok: false, cat: '業務災害', ex: '私的な恨みによる暴行は、仕事に伴う危険が現実になったものではないので業務外です。' },
  { t: '接客中に客から言いがかりをつけられ、殴られてけがをした', ok: true, cat: '業務災害', ex: '仕事上のトラブルが原因の暴行は、業務に伴う危険が現実になったものとして業務上と認められます。' },
  { t: '参加が自由な社内の運動会でアキレス腱を切った', ok: false, cat: '業務災害', ex: '参加が任意のレクリエーション行事は業務外です（会社が参加を強制し、出勤扱いにしていれば業務上とされることがあります）。' },
  { t: 'テレワーク中、自宅でトイレから作業場所に戻り、椅子に座ろうとして転倒した', ok: true, cat: '業務災害', ex: 'テレワークでも、業務に付随する行為（トイレなど）から作業に戻るときの災害は業務災害と認められます（厚生労働省が示している例）。' },
  { t: '台風の日に、上司の指示で店の看板を固定していて脚立から落ちた', ok: true, cat: '業務災害', ex: '上司の指示による作業中の災害なので業務上です。悪天候でも仕事中であることに変わりはありません。' },
];

function isG() { return !!(G && G.mode === 'gyosei'); }
function gyA() { return GY_AGENCY[G.agency]; }
function gyTypesOf(ag) { const i = ag === 'labor' ? 0 : 1; return Object.keys(GY_TYPES).filter(k => GY_TYPES[k].w[i] > 0); }
function gyApplies(e, item) {
  const t = GY_TYPES[e.t];
  const it = LAW_ITEMS[item];
  if (!it || it.ag !== G.agency) return false;
  if (it.gy && !it.gy.includes(e.t)) return false;
  if (it.ag === 'labor' && !e.emp) return false;
  switch (item) {
    case 'minwage': return ['ret', 'food', 'care', 'clean', 'hotel'].includes(e.t);
    case 'taisei': return e.emp >= 10;
    case 'unpaid': return ['ret', 'food', 'care', 'trans', 'it', 'hotel', 'clean', 'con'].includes(e.t);
    case 'bouka': return (t.spec && e.cap >= 30) || e.cap >= 50;
    case 'jikahou': return (t.spec && e.cap >= 50) || ['zakkyo', 'hotel', 'care', 'hosp'].includes(e.t);
    case 'boen': return t.spec;
    default: return true;
  }
}
function gyItemsOf(e) { return gyA().items.filter(k => gyApplies(e, k)); }
/* 違反と遵法意識による、労働災害・火災の起きやすさ（倍） */
function gyAccMul(e) { return gyViolList(e).reduce((s, k) => s * (1 + ((LAW_ITEMS[k].acc || 1) - 1) * 1.5), 1) * (1.5 - e.cult) * (e.patrol && e.patrol > G.m ? 0.8 : 1); }
function gyFireMul(e) { return gyViolList(e).reduce((s, k) => s * (1 + ((LAW_ITEMS[k].fire || 1) - 1) * 1.3), 1) * (1.4 - 0.7 * e.cult); }
function gyViolList(e) { return Object.keys(e.v).filter(k => e.v[k]); }
function gyEnt(id) { return G.ents.find(e => e.id === id); }
function gyCap() { return G.staff * gyA().days; }
function gyLeft() { return Math.round((gyCap() - G.used) * 10) / 10; }
function gyMaxUse() { return Math.floor(gyCap() * 1.5); }
function gyCanUse(d) { return G.used + d <= gyMaxUse() + 1e-9; }
function gyUse(d) { G.used = Math.round((G.used + d) * 10) / 10; }
function gyNews(t, k = 'info') { G.news.unshift({ m: G.m, t, k }); if (G.news.length > 200) G.news.length = 200; }
function gyFy() { gyNewFy(); return G.fys[fyOf(G.m)]; }
function gyMeasOf(id) { return id === 'extend' ? GY_EXTEND : GY_MEAS[G.agency].find(x => x.id === id); }
function gyRank(id) { return id === 'extend' ? -1 : GY_MEAS[G.agency].findIndex(x => x.id === id); }

/* ---------- 新しいゲーム ---------- */
function gyNewGame(o) {
  const seed = (o.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0;
  const A = GY_AGENCY[o.agency];
  G = {
    mode: 'gyosei', version: GY_SAVE_VERSION, rs: seed, seed, agency: o.agency, diff: o.diff || 'normal', chief: o.chief || '汐見 太郎', m: 0, startedM: 0, termYears: o.term ?? 5,
    staff: A.staff, ents: [], cases: [], dec: [], plan: { insp: [], camp: null }, used: 0, seq: 0, news: [], months: [], fys: {}, quiz: { asked: 0, correct: 0 },
    focus: null, pendingModals: [], flags: {}, over: null, camps: {},
  };
  const types = gyTypesOf(o.agency);
  const wi = o.agency === 'labor' ? 0 : 1;
  const cultMean = { high: 0.68, normal: 0.55, low: 0.42 }[G.diff] || 0.55;
  const used = new Set();
  for (let i = 0; i < 72; i++) {
    const tk = i < types.length ? types[i] : wpick(types, types.map(k => GY_TYPES[k].w[wi]));
    const t = GY_TYPES[tk];
    let n, guard = 0;
    do { n = `${pick(GY_PRE)}${pick(t.suf)}`; } while (used.has(n) && guard++ < 50);
    used.add(n);
    const emp = t.emp[1] ? Math.round(Math.exp(uni(Math.log(t.emp[0]), Math.log(t.emp[1])))) : 0;
    const cap = tk === 'zakkyo' ? randInt(60, 400) : tk === 'apart' ? randInt(40, 300) : Math.round(emp * (t.spec ? uni(2.5, 6) : 1.1));
    const e = { id: 'E' + (++G.seq), n: t.pre + n, t: tk, emp, cap, cult: clamp(cultMean + randn() * 0.18, 0.08, 0.97), v: {}, st: {}, lastInsp: -randInt(6, 60), insp: 0, acc: 0, fires: 0, found: 0, hide: [], hist: [], pub: false };
    for (const k of gyItemsOf(e)) {
      let p = GY_VBASE[k] * (1 - e.cult) * 1.7;
      if (k === 'otmax' && ['trans', 'con', 'it', 'care'].includes(tk)) p *= 1.6;
      if (k === 'hinan' && ['ret', 'zakkyo', 'whl'].includes(tk)) p *= 1.5;
      if (k === 'jikahou' && tk === 'zakkyo') p *= 2.5;
      if (chance(p)) e.v[k] = 1;
    }
    // 着任前2年の記録（署の記録に残っている労働災害・火災）
    if (o.agency === 'labor' && e.emp) e.acc = poisson(t.acc * e.emp * gyAccMul(e) * GY_ACC_K * 24);
    if (o.agency === 'fire' && t.fire) e.fires = poisson(t.fire * gyFireMul(e) * 24);
    G.ents.push(e);
  }
  G.base = gyBaseline();
  gyNewFy();
  gyNews(`${G.chief}氏が${A.n}の署長に着任。管内の${A.unit}は${G.ents.length}か所、${A.staffN}は${A.staff}人`, 'info');
  return G;
}
/* 着任前年の実績（評価の基準） */
function gyBaseline() {
  const viol = sum(G.ents, e => gyViolList(e).length) / G.ents.length;
  if (G.agency === 'labor') {
    let acc = 0, death = 0;
    for (const e of G.ents) {
      const t = GY_TYPES[e.t];
      const a = t.acc * e.emp * gyAccMul(e) * 12 * GY_ACC_K;
      acc += a; death += a * t.death * (e.v.fall || e.v.machine ? 2 : 1);
    }
    return { acc4: Math.max(4, Math.round(acc * 0.85)), death: Math.round(death * 10) / 10, viol };
  }
  let fires = 0, fd = 0;
  for (const e of G.ents) {
    const t = GY_TYPES[e.t];
    const mul = gyFireMul(e);
    fires += t.fire * mul * 12 * 1.08; fd += t.fire * mul * 12 * 0.16 * t.fd;
  }
  return { fires: Math.max(3, Math.round(fires)), death: Math.round(fd * 10) / 10, viol };
}
function gyNewFy() {
  const fy = fyOf(G.m);
  if (G.fys[fy]) return;
  G.fys[fy] = { fy, acc4: 0, accAll: 0, death: 0, hidden: 0, hiddenFound: 0, fires: 0, fireBig: 0, fireDeath: 0, insp: 0, inspPlan: 0, inspFocus: 0, found: 0, fixed: 0, notFixed: 0,
    soken: 0, meirei: 0, koukai: 0, overreach: 0, lenient: 0, decided: 0, std: 0, claims: 0, claimWrong: 0, appealLost: 0, complaints: 0, recovered: 0, camps: 0, staffOt: 0, backlog: 0, used: 0, cap: 0, focus: null };
  const prev = G.focus;
  const cand = GY_FOCUS_CAND[G.agency].filter(k => k !== prev && G.ents.some(e => e.t === k));
  G.focus = cand.length ? pick(cand) : prev;
  G.fys[fy].focus = G.focus;
  if (G.m > G.startedM) gyNews(`${gyA().parent}が今年度の重点を示しました：${GY_FOCUS[G.focus]}`, 'info');
}

/* ---------- 案件 ---------- */
function gyAddCase(type, e, data = {}) {
  const c = { id: 'C' + (++G.seq), type, ent: e ? e.id : null, m: G.m, status: 'new', data };
  G.cases.unshift(c);
  // 済んだ案件は古いものから消す（判断待ちから参照される案件は残す）
  const done = G.cases.filter(x => x.status === 'done' || x.status === 'filed');
  if (done.length > 150) { const drop = new Set(done.slice(150).map(x => x.id)); G.cases = G.cases.filter(x => !drop.has(x.id)); }
  return c;
}
function gyCase(id) { return G.cases.find(x => x.id === id); }
function gyCaseCost(c) { return c.type === 'fire' && c.data.big ? 6 : GY_CASE[c.type].cost; }
/* 案件に着手する（今月の人日を使い、月末に結果が出る） */
function gyAssign(id) {
  const c = gyCase(id);
  if (!c || c.status !== 'new') return false;
  const cost = gyCaseCost(c);
  if (!gyCanUse(cost)) return false;
  gyUse(cost);
  c.status = 'assigned';
  c.am = G.m;
  return true;
}
function gyUnassign(id) {
  const c = gyCase(id);
  if (!c || c.status !== 'assigned' || c.am !== G.m) return false;
  gyUse(-gyCaseCost(c));
  c.status = 'new';
  return true;
}
/* 監督（立入検査）の計画 */
function gyPlanToggle(id) {
  const i = G.plan.insp.indexOf(id);
  const cost = gyA().inspCost;
  if (i >= 0) { G.plan.insp.splice(i, 1); gyUse(-cost); return true; }
  if (!gyEnt(id) || !gyCanUse(cost)) return false;
  G.plan.insp.push(id);
  gyUse(cost);
  return true;
}
/* 啓発（集団指導・講習会など） */
const GY_CAMPS = {
  labor: [
    { id: 'seminar', n: '集団指導（説明会）', cost: 4, d: '選んだ業種の事業場を集めて、法令と手続きを説明する。遵法意識が上がり、届出や健康診断などが自主的に改善される。', typed: true },
    { id: 'patrol', n: '安全パトロール', cost: 6, d: '選んだ業種の現場を回り、危険な作業や設備を指導する。墜落防止や機械の安全が改善され、4か月ほど労災が減る。', typed: true },
    { id: 'ot', n: '過重労働の解消キャンペーン', cost: 3, d: '長時間労働と残業代の不払いをなくすよう呼びかける（11月は過労死等防止啓発月間）。', typed: false },
  ],
  fire: [
    { id: 'seminar', n: '防火管理講習会', cost: 4, d: '選んだ用途の建物の関係者に、防火管理者の選任と消防計画の作り方を説明する。防火管理が自主的に改善される。', typed: true },
    { id: 'drill', n: '避難訓練の合同実施', cost: 4, d: '選んだ用途の建物の訓練を後押しする。訓練をしていない建物の多くが訓練をする。', typed: true },
    { id: 'pr', n: '火災予防運動の広報', cost: 3, d: '点検報告や避難通路の確保を広く呼びかける（春と秋に全国火災予防運動がある）。', typed: false },
  ],
};
function gyCampOf(id) { return GY_CAMPS[G.agency].find(x => x.id === id); }
function gySetCamp(id, type) {
  if (G.plan.camp) { gyUse(-gyCampOf(G.plan.camp.id).cost); G.plan.camp = null; }
  if (!id) return true;
  const c = gyCampOf(id);
  if (!c || !gyCanUse(c.cost)) return false;
  gyUse(c.cost);
  G.plan.camp = { id, type: c.typed ? (type || G.focus) : null };
  return true;
}
/* リスクの目安（1〜5）。違反そのものは見えないので、業種・規模・最後の監督からの期間・記録から推し量る */
function gyRiskScore(e) {
  const t = GY_TYPES[e.t];
  const base = G.agency === 'labor' ? t.acc * Math.max(1, e.emp) * 40 + t.death * 12 : t.fire * 300 + t.fd * 5 + (t.spec ? 0.4 : 0);
  const since = Math.min(60, G.m - e.lastInsp) / 30;
  const rec = gyRecordFlags(e).length * 0.5 + Math.min(3, e.acc) * 0.35 + Math.min(3, e.fires) * 0.5 + Math.min(4, e.found) * 0.15 + (e.soken ? 0.3 : 0);
  return base * (0.6 + since) + rec;
}
/* リスクの段階（管内での順位：上位1割が5、3割までが4、5割5分までが3、8割までが2） */
let gyRiskCache = { key: '', map: null };
function gyRiskLevel(e) {
  const key = `${G.seed}:${G.m}:${G.seq}:${G.dec.length}:${G.ents.length}`;
  if (gyRiskCache.key !== key) {
    const arr = G.ents.map(x => [x.id, gyRiskScore(x)]).sort((a, b) => b[1] - a[1]);
    const map = {};
    arr.forEach(([id], i) => { const p = i / arr.length; map[id] = p < 0.1 ? 5 : p < 0.3 ? 4 : p < 0.55 ? 3 : p < 0.8 ? 2 : 1; });
    gyRiskCache = { key, map };
  }
  return gyRiskCache.map[e.id] || 1;
}
/* 届出の記録から分かること */
function gyRecordFlags(e) { return Object.keys(GY_RECORD).filter(k => e.v[k] && gyApplies(e, k) && !(e.st[k] && e.st[k].open)); }
function gyViolTotal() { return sum(G.ents, e => gyViolList(e).length); }
function gyBacklog() {
  const old = G.cases.filter(c => c.status === 'new' && !GY_CASE[c.type].optional && G.m - c.m >= 2).length;
  return old + G.dec.filter(d => G.m - d.m >= 2).length;
}

/* ---------- 月末の処理 ---------- */
function gyAdvance() {
  if (G.over) return null;
  const fy = gyFy();
  const rep = { m: G.m, insp: [], cases: [], fixed: 0, follow: 0, newCases: [], camp: G.plan.camp ? Object.assign({}, G.plan.camp) : null, used: G.used, cap: gyCap() };
  // 1) 今月の監督（立入検査）
  for (const id of G.plan.insp) {
    const e = gyEnt(id);
    if (e) { fy.inspPlan++; if (e.t === G.focus) fy.inspFocus++; rep.insp.push({ e: e.id, items: gyInspect(e, gyA().inspKind) }); }
  }
  // 2) 着手した案件
  for (const c of G.cases.filter(x => x.status === 'assigned')) { gyWorkCase(c); rep.cases.push(c.id); }
  // 3) 啓発
  if (G.plan.camp) { gyRunCamp(G.plan.camp); fy.camps++; }
  // 4) 事業場の変化、是正の期日、審査請求
  gyDynamics();
  const dl = gyDeadlines();
  rep.fixed = dl.fixed; rep.follow = dl.follow;
  gyAppeals();
  gyExpireCases();
  // 5) 新しい出来事（労災・火災・申告・請求・通報）
  const seq0 = G.seq;
  gyEvents();
  rep.newCases = G.cases.filter(c => +c.id.slice(1) > seq0).map(c => c.id);
  // 6) 記録
  fy.used += G.used; fy.cap += gyCap();
  fy.staffOt += Math.max(0, G.used - gyCap()) * 8 / G.staff;
  fy.backlog += gyBacklog();
  G.months.push({ m: G.m, used: G.used, cap: gyCap(), acc4: fy.acc4, fires: fy.fires, viol: gyViolTotal() });
  if (G.months.length > 120) G.months.shift();
  // 7) 年度末の評価
  if (calMonth(G.m) === 3) {
    const n = fyOf(G.m);
    fy.violEnd = gyViolTotal() / G.ents.length;
    fy.eval = gyEvaluate(n);
    gyAfterEval(fy);
    G.pendingModals.push({ type: 'gEval', fy: n });
  }
  G.m++;
  G.used = 0;
  G.plan = { insp: [], camp: null };
  if (calMonth(G.m) === 4) gyNewFy();
  if (G.termYears && G.m >= G.startedM + G.termYears * 12 && !G.termEnded) { G.termEnded = true; G.pendingModals.push({ type: 'gTerm' }); }
  return rep;
}
/* 監督（立入検査）：違反は見つかる確率で見つかり、措置の判断待ちに積まれる */
function gyInspect(e, kind, focusItem) {
  const fy = gyFy();
  fy.insp++;
  e.lastInsp = G.m;
  e.insp++;
  const finds = [];
  for (const k of gyViolList(e)) {
    if (k === 'report' || (e.st[k] && e.st[k].open)) continue;
    let p = LAW_ITEMS[k].det;
    if (focusItem === k) p = Math.max(p, 0.95);
    if (chance(p)) finds.push(k);
  }
  // 労災かくしの痕跡（出勤簿の空白、救急の記録など）
  if (G.agency === 'labor' && e.hide.length && !e.v.report && chance(kind === '災害時監督' || kind === '災害調査' ? 0.5 : 0.3)) { e.v.report = 1; finds.push('report'); fy.hiddenFound++; }
  e.hist.unshift({ m: G.m, t: `${kind}：${finds.length ? `違反 ${finds.length}件（${finds.map(k => LAW_ITEMS[k].s).join('・')}）` : '違反なし'}` });
  if (e.hist.length > 24) e.hist.length = 24;
  for (const k of finds) {
    e.found++;
    fy.found++;
    if (!G.dec.some(d => d.ent === e.id && d.item === k)) G.dec.push({ id: 'D' + (++G.seq), type: 'finding', ent: e.id, item: k, m: G.m, kind, lvl: 0, repeat: !!(e.st[k] && e.st[k].fixedM !== undefined) });
  }
  return finds;
}
/* 着手した案件の結果 */
function gyWorkCase(c) {
  const e = gyEnt(c.ent);
  c.status = 'done';
  c.doneM = G.m;
  switch (c.type) {
    case 'death': case 'report': {
      const fs = gyInspect(e, c.type === 'death' ? '災害時監督' : '災害調査');
      const cause = fs.filter(k => LAW_ITEMS[k].danger);
      c.result = fs.length ? `法令違反 ${fs.length}件（${fs.map(k => LAW_ITEMS[k].s).join('・')}）${cause.length ? `。${LAW_ITEMS[cause[0]].s}の不備が災害の原因になった` : ''}` : '災害の原因になった法令違反は見つからなかった（作業手順の見直しを指導した）';
      e.cult = clamp(e.cult + 0.06, 0, 0.98);
      break;
    }
    case 'complaint': {
      const it = LAW_ITEMS[c.data.item];
      gyInspect(e, '申告監督', c.data.item);
      if (e.v[c.data.item]) {
        c.result = `申告の内容（${it.s}）を確認した`;
        if (c.data.item === 'unpaid') { c.data.amt = niceAmount(uni(80e4, 500e4) * Math.max(1, e.emp / 25)); c.result += `（不払いの残業代 約${fmtYen(c.data.amt)}）`; }
      } else c.result = '申告の内容を裏づける事実は確認できなかった（申告者に結果を説明した）';
      break;
    }
    case 'claim': case 'claimX':
      c.status = 'decide';
      c.result = c.type === 'claimX' ? '労働時間の記録と出来事を調べた' : '請求書・医師の証明・事業主の証明を確かめた';
      G.dec.push({ id: 'D' + (++G.seq), type: 'claim', ent: e.id, case: c.id, m: G.m });
      break;
    case 'hidden': {
      if (e.hide.length && !e.v.report) {
        c.result = `${ymLabel(e.hide[0])}に休業4日以上の労働災害が起きていたのに、労働者死傷病報告を出していなかった（労災かくし）`;
        e.v.report = 1; e.found++;
        const fy = gyFy();
        fy.found++; fy.hiddenFound++;
        if (!G.dec.some(d => d.ent === e.id && d.item === 'report')) G.dec.push({ id: 'D' + (++G.seq), type: 'finding', ent: e.id, item: 'report', m: G.m, kind: '労災かくしの調査', lvl: 0 });
      } else c.result = e.v.report ? 'すでに把握している労災かくしだった' : '報告もれは確認できなかった（休業3日以内で、四半期ごとの報告に含まれていた）';
      break;
    }
    case 'fire': {
      const fs = gyInspect(e, '火災後の立入検査');
      c.result = `出火原因：${c.data.cause}。${fs.length ? `消防法令の違反 ${fs.length}件（${fs.map(k => LAW_ITEMS[k].s).join('・')}）` : '消防法令の違反はなかった'}`;
      e.cult = clamp(e.cult + 0.06, 0, 0.98);
      break;
    }
    case 'tip': {
      gyInspect(e, '通報による立入検査', c.data.item);
      c.result = e.v[c.data.item] ? `通報の内容（${LAW_ITEMS[c.data.item].s}）を確認した` : '通報の内容は確認できなかった';
      break;
    }
    default: break;
  }
}
/* 啓発の効果 */
function gyRunCamp(cp) {
  const C = gyCampOf(cp.id);
  const tgt = G.ents.filter(e => !cp.type || e.t === cp.type);
  const fix = (e, k, p) => { if (e.v[k] && !(e.st[k] && e.st[k].open) && chance(p)) delete e.v[k]; };
  for (const e of tgt) {
    if (cp.id === 'seminar') {
      e.cult = clamp(e.cult + 0.04, 0, 0.98);
      for (const k of ['taisei', 'kenshin', 'contract', 'r36', 'chem', 'yukyu', 'hoken', 'bouka', 'kunren', 'tenken']) fix(e, k, 0.04 + 0.1 * e.cult);
    }
    if (cp.id === 'patrol') { e.patrol = G.m + 4; for (const k of ['machine', 'fall', 'chem']) fix(e, k, 0.15); }
    if (cp.id === 'ot') { for (const k of ['otmax', 'unpaid', 'r36']) fix(e, k, 0.04 + 0.08 * e.cult); }
    if (cp.id === 'drill') { fix(e, 'kunren', 0.35); fix(e, 'hinan', 0.12); }
    if (cp.id === 'pr') { for (const k of ['tenken', 'hinan', 'shokaki', 'boen']) fix(e, k, 0.03 + 0.06 * e.cult); }
  }
  G.camps = G.camps || {};
  G.camps[cp.id] = G.m;
  gyNews(`${C.n}を行いました${cp.type ? `（${GY_TYPES[cp.type].n}の${tgt.length}か所）` : '（管内全体）'}`, 'good');
}
/* 事業場の変化：点検や健診を怠りがちになる・自分で直す */
function gyDynamics() {
  const mo = calMonth(G.m);
  for (const e of G.ents) {
    for (const k of gyItemsOf(e)) {
      if (e.st[k] && e.st[k].open) continue; // 是正の期日待ち
      if (!e.v[k]) { if (chance((GY_PERIODIC[k] ? 0.009 : 0.004) * (1 - e.cult) * 1.6)) e.v[k] = 1; }
      else if (chance(0.006 + 0.012 * e.cult)) delete e.v[k];
    }
    // 10月に最低賃金が上がると、時給を上げ忘れる事業場が出る
    if (mo === 10 && gyApplies(e, 'minwage') && !e.v.minwage && chance(0.12 * (1 - e.cult) + 0.02)) e.v.minwage = 1;
    e.cult = clamp(e.cult + (0.55 - e.cult) * 0.004, 0.05, 0.98); // 長い目で見ると元の水準へ戻る
  }
  if (G.agency === 'labor' && mo === 10) gyNews('汐見県の最低賃金が改定されました。時給を上げ忘れた事業場がないか、申告や監督で確かめます', 'info');
}
/* 措置をした違反の期日：直したか */
function gyDeadlines() {
  const fy = gyFy();
  let fixed = 0, follow = 0;
  for (const e of G.ents) for (const k of Object.keys(e.st)) {
    const s = e.st[k];
    if (!s.open || G.m < s.due) continue;
    s.open = false;
    let ok = !e.v[k];
    if (!ok) {
      const [a, b] = GY_FIXP[s.meas] || [0.5, 0.3];
      let p = Math.min(0.98, a + b * e.cult);
      if (s.weak) p *= 0.7;
      if (s.gf) p = Math.max(p, 0.92);
      ok = chance(p);
    }
    if (ok) {
      delete e.v[k];
      if (k === 'report') e.hide = [];
      if (k === 'jikahou') e.pub = false;
      if (k === 'unpaid') fy.recovered += niceAmount(uni(60e4, 400e4) * Math.max(1, e.emp / 25));
      s.fixedM = G.m;
      fy.fixed++; fixed++;
      e.hist.unshift({ m: G.m, t: `${LAW_ITEMS[k].s}：是正報告（直した）` });
      continue;
    }
    fy.notFixed++; follow++;
    const gf = !!GY_PLAN_TXT[k] && !s.gf && chance(0.2 + 0.35 * e.cult);
    G.dec.push({ id: 'D' + (++G.seq), type: 'follow', ent: e.id, item: k, m: G.m, lvl: s.lvl, prev: s.meas, goodFaith: gf, kind: gyA().follow });
    e.hist.unshift({ m: G.m, t: `${LAW_ITEMS[k].s}：期日までに直さなかった` });
  }
  return { fixed, follow };
}
/* 新しい出来事 */
function gyEvents() {
  const fy = gyFy();
  const mo = calMonth(G.m);
  for (const e of G.ents) {
    const t = GY_TYPES[e.t];
    const viol = gyViolList(e);
    if (G.agency === 'labor' && e.emp) {
      if (chance(t.acc * e.emp * gyAccMul(e) * GY_ACC_K)) {
        const death = chance(t.death * (e.v.fall || e.v.machine ? 2 : 1));
        fy.accAll++;
        if (!death && e.cult < 0.45 && chance(0.4)) { e.hide.unshift(G.m); if (e.hide.length > 5) e.hide.length = 5; fy.hidden++; }
        else {
          e.acc++; fy.acc4++;
          const text = gyAccText(e, death);
          if (death) {
            fy.death++;
            const c = gyAddCase('death', e, { text });
            G.pendingModals.push({ type: 'gSaigai', id: c.id });
            gyNews(`【死亡災害】${e.n}で、労働者が${text}`, 'bad');
          } else gyAddCase('report', e, { text });
        }
      }
      // 過労・精神障害の労災請求
      if ((e.v.otmax || e.v.unpaid) && chance(0.003 * Math.max(1, e.emp / 30))) gyAddCase('claimX', e, gyClaimFacts(chance(0.5)));
      // 労働者からの申告
      for (const k of viol) {
        const it = LAW_ITEMS[k];
        if (it.compl && !(e.st[k] && e.st[k].open) && chance(it.compl * Math.max(0.6, e.emp / 30))) {
          if (!G.cases.some(c => c.type === 'complaint' && c.ent === e.id && c.data.item === k && c.status !== 'done')) { gyAddCase('complaint', e, { item: k, who: pick(['在職中の労働者', '退職した労働者', '労働者の家族']) }); fy.complaints++; }
          break;
        }
      }
      // 労災かくしが、健康保険の照会や労災の請求から疑われる
      if (e.hide.length && !e.v.report && chance(0.035) && !G.cases.some(c => c.type === 'hidden' && c.ent === e.id && c.status !== 'done')) gyAddCase('hidden', e, { from: pick(['健康保険組合からの照会（仕事中のけがを健康保険で治療していた）', '本人からの相談（会社に「労災にしないでくれ」と言われた）', '病院からの連絡（仕事中のけがだと本人が話した）']) });
    }
    if (G.agency === 'fire' && t.fire) {
      const mul = gyFireMul(e) * ([12, 1, 2, 3].includes(mo) ? 1.3 : 0.85);
      if (chance(t.fire * mul)) {
        const big = chance(Math.min(0.6, 0.16 * (e.v.tenken ? 1.5 : 1) * (e.v.shokaki ? 1.3 : 1) * (e.v.kunren ? 1.2 : 1)));
        const dmul = viol.reduce((s, k) => s * (LAW_ITEMS[k].death || 1), 1);
        const deaths = big && chance(Math.min(0.8, t.fd * dmul)) ? randInt(1, 3) : 0;
        e.fires++; fy.fires++;
        if (big) fy.fireBig++;
        fy.fireDeath += deaths;
        const cause = pick({ food: ['厨房のダクト火災', 'こんろの消し忘れ'], ret: ['惣菜調理場のフライヤー', '放火（段ボールへの火付け）'], zakkyo: ['飲食店の厨房', '放火', '電気配線'], apart: ['たばこの不始末', 'ストーブ', '電気配線'], hotel: ['電気配線', 'たばこの不始末'], care: ['電気配線', '暖房器具'], hosp: ['電気配線'], mfgm: ['研削の火花', '電気設備'], mfgf: ['フライヤー', '乾燥機'], whl: ['フォークリフトの充電器', '電気配線'], trans: ['車両の電気系統'] }[e.t] || ['電気配線']);
        const c = gyAddCase('fire', e, { big, deaths, cause });
        if (deaths) G.pendingModals.push({ type: 'gSaigai', id: c.id });
        gyNews(`【火災】${e.n}（${t.use}）で${big ? '火災' : 'ぼや'}${deaths ? `。${deaths}人が亡くなった` : big ? '。けが人が出た' : ''}`, 'bad');
      }
      for (const k of ['hinan', 'jikahou', 'kunren']) {
        if (e.v[k] && !(e.st[k] && e.st[k].open) && chance(0.004 * (k === 'hinan' ? 1.5 : 1)) && !G.cases.some(c => c.type === 'tip' && c.ent === e.id && c.status !== 'done')) {
          gyAddCase('tip', e, { item: k, from: k === 'hinan' ? '利用者からの通報（階段に荷物が積まれている）' : k === 'jikahou' ? '近所の人からの通報（火災報知器が見当たらない）' : '従業員からの相談（避難訓練をしたことがない）' });
          break;
        }
      }
    }
  }
  // 業務上かの判断が必要な労災請求（月に1件ほど）
  if (G.agency === 'labor') {
    const ws = G.ents.filter(e => e.emp);
    for (let i = poisson(0.9); i > 0; i--) { const e = pick(ws); const s = pick(GY_CLAIMS); gyAddCase('claim', e, { kind: 'normal', truth: s.ok, text: s.t, cat: s.cat, ex: s.ex }); }
  }
}
function gyAccText(e, death) {
  if (death) return pick({ mfgm: ['プレス機械に挟まれて死亡した', 'フォークリフトにひかれて死亡した'], mfgf: ['ミキサーに巻き込まれて死亡した'], con: ['足場から墜落して死亡した', '屋根の明かり窓を踏み抜いて墜落し、死亡した'], trans: ['荷台から転落して死亡した', '荷崩れの下敷きになって死亡した'], clean: ['窓の清掃中に墜落して死亡した'], whl: ['フォークリフトにひかれて死亡した'] }[e.t] || ['転落して死亡した']);
  return pick({ mfgm: ['プレス機械に手を挟まれた', '旋盤に巻き込まれた', 'フォークリフトに接触した'], mfgf: ['ミキサーに手を巻き込まれた', '床で滑って転倒した', 'スライサーで手を切った'], con: ['足場から墜落した', '脚立から転落した', '落ちてきた資材に当たった'], trans: ['荷台から転落した', '荷崩れで負傷した', '荷物の積み下ろしで腰を痛めた'], ret: ['脚立から転落した', '床で滑って転倒した', '重い荷物で腰を痛めた'], food: ['油でやけどをした', '包丁で手を切った', '床で滑って転倒した'], care: ['入浴の介助で腰を痛めた', '廊下で転倒した'], hotel: ['階段で転倒した', '重い荷物で腰を痛めた'], it: ['階段で転倒した'], clean: ['窓の清掃中に転落した', '洗剤で薬傷を負った', '脚立から転落した'], whl: ['フォークリフトに接触した', '荷崩れで負傷した'] }[e.t] || ['転倒した']);
}
/* 過労・精神障害の請求の事実関係（調査で明らかになる） */
function gyClaimFacts(mental) {
  if (!mental) {
    const r = rand();
    if (r < 0.4) { const a = chance(0.5); return { kind: 'karo', truth: true, m1: a ? randInt(102, 138) : randInt(60, 95), avg: a ? randInt(55, 85) : randInt(82, 98), disease: pick(['くも膜下出血', '心筋梗塞', '脳梗塞']) }; }
    if (r < 0.55) return { kind: 'karo', truth: true, m1: randInt(84, 96), avg: randInt(70, 79), extra: '深夜を含む不規則な勤務が続き、月の半分以上は泊まりがけの出張だった', disease: pick(['心筋梗塞', '脳出血']) };
    return { kind: 'karo', truth: false, m1: randInt(30, 70), avg: randInt(25, 60), disease: pick(['くも膜下出血', '心筋梗塞', '脳梗塞']) };
  }
  const strong = ['上司から、人格を否定する暴言を何か月も繰り返し受けていた（パワーハラスメント）', '発病の直前の1か月に、約170時間の時間外労働をした', '仕事中に、同僚が死亡する事故を目の前で見た', '発病前の2か月続けて、月120時間を超える時間外労働をした'];
  const mid = ['配置転換で、慣れない仕事を担当することになった', '顧客から強いクレームを受けた（対応は上司が引き取った）', '仕事の量が増え、時間外労働が月20時間ほど増えた', '上司と仕事の進め方で意見が合わないことがあった', '同僚とうまくいかないことがあった'];
  const truth = chance(0.5);
  const ev = truth ? [pick(strong), pick(mid)] : [pick(mid), pick(mid.slice(2))];
  return { kind: 'mental', truth, events: [...new Set(ev)], disease: pick(['うつ病', '適応障害']) };
}
/* 審査請求で取り消される（不支給の誤り） */
function gyAppeals() {
  const fy = gyFy();
  for (const c of G.cases) if (c.appealM === G.m) {
    fy.appealLost++;
    const e = gyEnt(c.ent);
    gyNews(`審査請求で、${e ? e.n : ''}の労働者の労災を不支給とした決定が取り消されました（認定基準に照らすと業務上だった）`, 'bad');
  }
}
/* 処理しないまま時間がたった案件 */
function gyExpireCases() {
  for (const c of G.cases) {
    if (c.status !== 'new') continue;
    const age = G.m - c.m;
    if (GY_CASE[c.type].optional && age >= 3) { c.status = 'filed'; c.result = '調査はせず、労働者死傷病報告の書面だけで処理した'; continue; }
    if (c.type === 'complaint' && age === 3) gyNews(`${gyEnt(c.ent).n}の労働者から「申告したのに監督署が動かない」と苦情が出ています`, 'bad');
  }
}

/* ---------- 判断 ---------- */
/* 通常の運用で選ぶ措置（学習用の目安）と理由 */
function gyStd(d) {
  const it = LAW_ITEMS[d.item];
  const order = GY_MEAS[G.agency].map(x => x.id);
  if (d.type === 'follow') {
    if (d.goodFaith) return { id: 'extend', why: '工事や採用などに時間がかかる正当な理由があり、改善計画も出ている。期日を延ばして見守るのが妥当です。' };
    if (G.agency === 'labor') {
      if (d.prev === 'shido') return { id: 'kankoku', why: '指導票で改善を求めても直さなかった。法違反として是正勧告に進みます。' };
      if (d.prev === 'meirei') return { id: 'soken', why: '使用停止等命令（行政処分）に従わなかった。命令違反として送検します。' };
      if (d.lvl >= 2 || it.sev >= 3) return { id: 'soken', why: it.sev >= 3 ? '重大な違反で、是正勧告に従わず、再監督でも直っていない。送検して刑事責任を問います。' : '是正勧告を繰り返しても直さない。悪質として送検します。' };
      return { id: 'kankoku', why: '是正勧告の期日までに直さなかった。再監督で改めて是正勧告し、短い期日を示します（それでも直さなければ送検）。' };
    }
    const nx = order[Math.min(order.length - 1, Math.max(0, order.indexOf(d.prev)) + 1)];
    return { id: nx, why: { shiteki: '口頭指導で直らなかった。立入検査結果通知書で違反を指摘します。', keikoku: '違反を指摘しても改修しない。命令の前の段階として警告します。', meirei: '警告に従わない。措置命令（使用停止命令）を出し、標識を付けて公示します。', kokuhatsu: '命令に従わない。悪質な違反として告発します。' }[nx] };
  }
  if (G.agency === 'labor') {
    if (d.item === 'report') return { id: 'soken', why: '労災かくしは、災害の事実を隠して再発防止の機会を失わせる悪質な違反です。原則として送検します。' };
    if (it.danger && d.kind === '災害時監督') return { id: 'soken', why: '死亡災害の原因になった安全措置の違反は、刑事責任を問うために送検します（危険な状態は同時に止めさせます）。' };
    if (it.danger && d.kind === '災害調査') return { id: 'meirei', why: '労働災害が起きた危険な設備・作業がそのままになっている。使用停止等命令で止めさせ、改善させます。' };
    if (d.repeat && it.meas === 'shido') return { id: 'kankoku', why: '前にも指導した事項を繰り返している（再違反）。是正勧告に進みます。' };
    return it.meas === 'shido' ? { id: 'shido', why: 'すぐに重大な危険につながる違反ではない。指導票で改善を求めます。' } : { id: 'kankoku', why: '法違反がはっきりしている。違反した条項と是正期日を書いた是正勧告書を交付します。' };
  }
  let id = it.meas;
  if (d.repeat) id = order[Math.min(3, order.indexOf(id) + 1)];
  return { id, why: d.repeat ? '前にも指摘した違反を繰り返している（再違反）。いつもより1段階重い措置にします。' : { koto: 'その場で直せる軽い事項です。口頭で指導します。', shiteki: '点検や届出など、改修に時間がかかる違反です。立入検査結果通知書で指摘し、改修の計画を報告させます。', keikoku: '人の命に関わる重大な違反です。最初から警告し、従わなければ命令に進みます。' }[id] || '通常の措置です。' };
}
/* 措置を決める。戻り値の verdict：ok（標準どおり）・light（軽すぎ）・heavy（重すぎ） */
function gyDecide(id, mid) {
  const d = G.dec.find(x => x.id === id);
  if (!d || d.type === 'claim') return null;
  const e = gyEnt(d.ent);
  const it = LAW_ITEMS[d.item];
  const M = gyMeasOf(mid);
  if (!M || (mid === 'extend' && d.type !== 'follow')) return null;
  if (M.danger && !it.danger) return { err: 'danger' };
  if (!gyCanUse(M.cost)) return { err: 'cap' };
  gyUse(M.cost);
  G.dec = G.dec.filter(x => x.id !== id);
  const std = gyStd(d);
  const fy = gyFy();
  fy.decided++;
  let verdict;
  if (mid === std.id) { verdict = 'ok'; fy.std++; }
  else if (gyRank(mid) < gyRank(std.id)) { verdict = 'light'; fy.lenient++; }
  else { verdict = 'heavy'; fy.overreach++; }
  G.quiz.asked++;
  if (verdict === 'ok') G.quiz.correct++;
  const lvl = (d.lvl || 0) + 1;
  if (mid === 'soken' || mid === 'kokuhatsu') {
    fy.soken++;
    delete e.v[d.item];
    if (d.item === 'report') e.hide = [];
    if (d.item === 'jikahou') e.pub = false;
    e.st[d.item] = { lvl, meas: mid, open: false, m: G.m, fixedM: G.m };
    e.cult = clamp(e.cult + 0.25, 0, 0.98);
    e.soken = (e.soken || 0) + 1;
    gyNews(mid === 'soken' ? `${e.n}と代表者を、${it.law}違反の疑いで書類送検しました（${it.s}）${verdict === 'heavy' && it.sev === 1 ? '。軽い違反だったため、検察は起訴を見送る見込みです' : ''}` : `${e.n}の関係者を、消防法違反で告発しました（${it.s}）`, 'info');
  } else if (mid === 'extend') {
    const prev = e.st[d.item] || {};
    e.st[d.item] = Object.assign({}, prev, { open: true, due: G.m + 2, lvl: d.lvl || 1, meas: d.prev || prev.meas || 'kankoku', weak: !d.goodFaith, gf: !!d.goodFaith, m: G.m });
  } else {
    const due = G.m + (mid === 'meirei' ? 1 : it.sev >= 3 ? 2 : 3);
    e.st[d.item] = { lvl, meas: mid, open: true, due, weak: verdict === 'light', m: G.m };
    if (mid === 'meirei') fy.meirei++;
    e.cult = clamp(e.cult + (mid === 'shido' || mid === 'koto' ? 0.01 : 0.03), 0, 0.98);
    if (d.item === 'jikahou' && !e.pub) { e.pub = true; fy.koukai++; gyNews(`${e.n}を、重大な消防法令違反のある建物として公表しました（自動火災報知設備の未設置）`, 'info'); }
    if (mid === 'meirei' && G.agency === 'fire') gyNews(`${e.n}に命令を出し、建物に標識を付けて公示しました（${it.s}）`, 'info');
  }
  e.hist.unshift({ m: G.m, t: `${it.s}：${M.n}` });
  return { verdict, std, M };
}
/* 労災の支給・不支給 */
function gyDecideClaim(id, pay) {
  const d = G.dec.find(x => x.id === id);
  if (!d || d.type !== 'claim') return null;
  const c = gyCase(d.case);
  const fy = gyFy();
  G.dec = G.dec.filter(x => x.id !== id);
  fy.claims++;
  const ok = pay === !!c.data.truth;
  c.decision = pay ? '支給' : '不支給';
  c.status = 'done';
  G.quiz.asked++;
  if (ok) G.quiz.correct++;
  else {
    fy.claimWrong++;
    if (!pay) c.appealM = G.m + randInt(4, 8);
  }
  return { ok, truth: !!c.data.truth, c };
}

/* ---------- 年度の評価 ---------- */
function gyEvaluate(fyN) {
  const f = G.fys[fyN];
  const parts = [];
  if (G.agency === 'labor') {
    const base = G.base.acc4;
    const r = f.acc4 / Math.max(1, base);
    parts.push({ n: '休業4日以上の労働災害', pts: Math.round(clamp(interp(r, [[0.6, 25], [0.85, 20], [1, 14], [1.2, 6], [1.5, 0]]), 0, 25)), max: 25, note: `${f.acc4}件（目安 ${base}件）` });
    parts.push({ n: '死亡災害', pts: f.death === 0 ? 15 : f.death === 1 ? 7 : 0, max: 15, note: `${f.death}人` });
  } else {
    const base = G.base.fires;
    const r = f.fires / Math.max(1, base);
    parts.push({ n: '火災の件数', pts: Math.round(clamp(interp(r, [[0.5, 25], [0.8, 20], [1, 14], [1.3, 6], [1.8, 0]]), 0, 25)), max: 25, note: `${f.fires}件（目安 ${base}件）` });
    parts.push({ n: '火災による死者', pts: f.fireDeath === 0 ? 15 : f.fireDeath === 1 ? 7 : 0, max: 15, note: `${f.fireDeath}人` });
  }
  const target = Math.round(G.ents.length * 0.4);
  const fN = G.ents.filter(e => e.t === f.focus).length;
  const fTarget = Math.max(1, Math.ceil(fN * 0.5));
  parts.push({ n: `計画した${gyA().insp}`, pts: Math.round(clamp(f.inspPlan / target * 10, 0, 10)), max: 10, note: `${f.inspPlan}件（目標 ${target}件。${G.agency === 'labor' ? '災害・申告による監督' : '火災・通報による立入検査'}は別に ${f.insp - f.inspPlan}件）` });
  parts.push({ n: '重点の取り組み', pts: Math.round(clamp(f.inspFocus / fTarget * 5, 0, 5)), max: 5, note: `${GY_TYPES[f.focus] ? GY_TYPES[f.focus].n : ''}への${gyA().insp} ${f.inspFocus}件（目標 ${fTarget}件）` });
  const fixR = f.fixed + f.notFixed ? f.fixed / (f.fixed + f.notFixed) : 1;
  parts.push({ n: '違反の是正率', pts: Math.round(clamp(interp(fixR, [[0.5, 0], [0.7, 6], [0.85, 11], [0.95, 15]]), 0, 15)), max: 15, note: `${fmtPct(fixR * 100, 0)}（期日までに直した ${f.fixed}件・直さなかった ${f.notFixed}件）` });
  const fair = Math.max(0, 15 - f.lenient * 1.5 - f.overreach * 1.5 - f.appealLost * 3 - f.claimWrong * 1);
  parts.push({ n: '措置と判断の適正さ', pts: Math.round(fair), max: 15, note: `標準どおり ${f.std}／${f.decided}件・軽すぎ ${f.lenient}・重すぎ ${f.overreach}${G.agency === 'labor' ? `・労災の判断の誤り ${f.claimWrong}${f.appealLost ? `（審査請求で取消 ${f.appealLost}）` : ''}` : ''}` });
  const ot = f.staffOt / 12;
  const bl = f.backlog / 12;
  parts.push({ n: '案件の処理と職員の働き方', pts: Math.round(Math.max(0, 10 - bl * 2 - Math.max(0, ot - 45) * 0.25)), max: 10, note: `2か月以上の未処理 平均${fmtNum(bl, 1)}件・職員の残業 月平均${fmtNum(ot, 0)}時間` });
  parts.push({ n: G.agency === 'labor' ? '集団指導・安全パトロールなど' : '講習会・訓練・広報', pts: Math.min(5, f.camps * 2), max: 5, note: `${f.camps}回` });
  const total = sum(parts, p => p.pts);
  const rank = total >= 85 ? 'S' : total >= 70 ? 'A' : total >= 55 ? 'B' : total >= 40 ? 'C' : 'D';
  return { parts, total, rank, hidden: f.hidden, hiddenFound: f.hiddenFound, viol: f.violEnd };
}
function gyAfterEval(f) {
  const A = gyA();
  if (f.eval.rank === 'S' && G.staff < A.staff + 2) { G.staff++; gyNews(`${A.parent}が、${A.n}の${A.staffN}を1人増やしました（来年度から${G.staff}人）`, 'good'); }
  else if (f.eval.rank === 'D') gyNews(`${A.parentHead}から、${A.n}の業務の進め方について指導がありました`, 'bad');
}

/* ---------- 保存 ---------- */
function gySaveMeta() { return JSON.stringify({ co: GY_AGENCY[G.agency].n, ceo: G.chief, m: G.m, ag: G.agency, at: Date.now(), over: !!G.over }); }
function gyDeserialize(s) {
  if (s.version !== GY_SAVE_VERSION || !s.ents) throw new Error('セーブデータの形式が違います');
  G = s;
  G.pendingModals = G.pendingModals || [];
  G.flags = G.flags || {};
  G.camps = G.camps || {};
  return G;
}
function gyCheck() {
  const out = [];
  if (!(G.used >= -1e-6)) out.push('人日がマイナス ' + G.used);
  for (const e of G.ents) for (const k of Object.keys(e.v)) if (!LAW_ITEMS[k]) out.push(`不明な違反 ${k}`);
  for (const d of G.dec) {
    if (!gyEnt(d.ent)) out.push(`判断待ちの事業場がない ${d.id}`);
    if (d.type === 'claim' && !gyCase(d.case)) out.push(`判断待ちの案件がない ${d.id}`);
  }
  for (const id of G.plan.insp) if (!gyEnt(id)) out.push(`計画の事業場がない ${id}`);
  return out;
}
