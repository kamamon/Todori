'use strict';
/* =========================================================
 *  01_data.js : マスターデータ
 * ========================================================= */

const CITY_NAME = '汐見市';
const DEFAULT_BANK = '汐見みらい銀行';
const OLD_UNION = '汐見信用組合';
const TAX_RATE = 0.30;
const DEP_INSURANCE_RATE = 0.00033; // 預金保険料率（年）
const BASE_SALARY = 550e4;          // 行員1人あたり年間給与（賞与込み）
const TERM_YEARS = 10;              // 任期（年）

/* ---------- 勘定科目 ----------
 * type: A=資産 CA=評価勘定(貸倒引当金) L=負債 E=純資産 R=収益 X=費用 */
const ACCT = {
  cash:        { code: '1000', name: '現金', type: 'A' },
  boj:         { code: '1010', name: '日銀預け金', type: 'A' },
  callLoan:    { code: '1020', name: 'コールローン', type: 'A' },
  securities:  { code: '1100', name: '有価証券', type: 'A' },
  loans:       { code: '1200', name: '貸出金', type: 'A' },
  tangible:    { code: '1300', name: '有形固定資産', type: 'A' },
  intangible:  { code: '1310', name: '無形固定資産', type: 'A' },
  otherAssets: { code: '1400', name: 'その他資産', type: 'A' },
  allowance:   { code: '1900', name: '貸倒引当金', type: 'CA' },
  depOrd:      { code: '2000', name: '普通預金', type: 'L' },
  depTime:     { code: '2010', name: '定期預金', type: 'L' },
  callMoney:   { code: '2100', name: 'コールマネー', type: 'L' },
  bojBorrow:   { code: '2110', name: '借用金（日銀借入）', type: 'L' },
  taxPayable:  { code: '2200', name: '未払法人税等', type: 'L' },
  divPayable:  { code: '2210', name: '未払配当金', type: 'L' },
  otherLiab:   { code: '2300', name: 'その他負債', type: 'L' },
  capital:     { code: '3000', name: '資本金', type: 'E' },
  prefCapital: { code: '3005', name: '優先株式（公的資金）', type: 'E' },
  capSurplus:  { code: '3010', name: '資本剰余金', type: 'E' },
  retained:    { code: '3020', name: '利益剰余金', type: 'E' },
  intLoans:    { code: '4000', name: '貸出金利息', type: 'R', grp: 'fund' },
  intSec:      { code: '4010', name: '有価証券利息配当金', type: 'R', grp: 'fund' },
  intCall:     { code: '4020', name: 'コールローン利息', type: 'R', grp: 'fund' },
  intBoj:      { code: '4030', name: '預け金利息', type: 'R', grp: 'fund' },
  fees:        { code: '4100', name: '役務取引等収益', type: 'R', grp: 'fee' },
  bondGain:    { code: '4200', name: '国債等債券売却益', type: 'R', grp: 'oth' },
  recoveries:  { code: '4300', name: '償却債権取立益', type: 'R', grp: 'ordOth' },
  provRev:     { code: '4310', name: '貸倒引当金戻入益', type: 'R', grp: 'ordOth' },
  otherInc:    { code: '4400', name: 'その他の経常収益', type: 'R', grp: 'ordOth' },
  extraGain:   { code: '4500', name: '特別利益', type: 'R', grp: 'extra' },
  intDep:      { code: '5000', name: '預金利息', type: 'X', grp: 'fund' },
  intCallM:    { code: '5010', name: 'コールマネー利息', type: 'X', grp: 'fund' },
  intBorrow:   { code: '5020', name: '借用金利息', type: 'X', grp: 'fund' },
  feeExp:      { code: '5100', name: '役務取引等費用', type: 'X', grp: 'fee' },
  bondLoss:    { code: '5200', name: '国債等債券売却損', type: 'X', grp: 'oth' },
  personnel:   { code: '5300', name: '人件費', type: 'X', grp: 'opex' },
  premises:    { code: '5310', name: '物件費', type: 'X', grp: 'opex' },
  taxes:       { code: '5320', name: '税金', type: 'X', grp: 'opex' },
  depreciation:{ code: '5330', name: '減価償却費', type: 'X', grp: 'opex' },
  depInsurance:{ code: '5340', name: '預金保険料', type: 'X', grp: 'opex' },
  provExp:     { code: '5400', name: '貸倒引当金繰入額', type: 'X', grp: 'ordOth' },
  writeoff:    { code: '5410', name: '貸出金償却', type: 'X', grp: 'ordOth' },
  otherExp:    { code: '5420', name: 'その他の経常費用', type: 'X', grp: 'ordOth' },
  extraLoss:   { code: '5500', name: '特別損失', type: 'X', grp: 'extra' },
  incomeTax:   { code: '5900', name: '法人税等', type: 'X', grp: 'tax' },
};
const ACCT_KEYS = Object.keys(ACCT);
const REV_KEYS = ACCT_KEYS.filter(k => ACCT[k].type === 'R');
const EXP_KEYS = ACCT_KEYS.filter(k => ACCT[k].type === 'X');

/* ---------- 業種 ----------
 * gm=売上総利益率 opm=営業利益率 ar/inv/ap=回転日数 ppe=有形固定資産/売上
 * dep=償却率 beta=景気感応度 trend=基調成長率 spe=従業員1人あたり売上 re=不動産保有確率 size=売上中央値 */
const INDUSTRIES = [
  { id: 'mfg', name: '製造業', gm: 0.24, opm: 0.045, ar: 72, inv: 48, ap: 52, ppe: 0.38, dep: 0.11, beta: 1.3, trend: 0.01, spe: 2400e4, re: 0.6, size: 7e8 },
  { id: 'con', name: '建設業', gm: 0.19, opm: 0.04, ar: 78, inv: 28, ap: 68, ppe: 0.14, dep: 0.12, beta: 1.2, trend: 0.005, spe: 2800e4, re: 0.45, size: 5e8 },
  { id: 'whl', name: '卸売業', gm: 0.14, opm: 0.022, ar: 58, inv: 30, ap: 48, ppe: 0.06, dep: 0.10, beta: 1.0, trend: 0.0, spe: 7000e4, re: 0.4, size: 12e8 },
  { id: 'ret', name: '小売業', gm: 0.30, opm: 0.028, ar: 8, inv: 38, ap: 32, ppe: 0.22, dep: 0.10, beta: 0.8, trend: -0.005, spe: 1900e4, re: 0.35, size: 4e8 },
  { id: 'food', name: '飲食業', gm: 0.64, opm: 0.035, ar: 5, inv: 5, ap: 18, ppe: 0.32, dep: 0.12, beta: 1.1, trend: 0.0, spe: 650e4, re: 0.2, size: 1.6e8 },
  { id: 'trn', name: '運輸業', gm: 0.21, opm: 0.038, ar: 50, inv: 3, ap: 30, ppe: 0.48, dep: 0.14, beta: 1.0, trend: 0.005, spe: 1500e4, re: 0.5, size: 4.5e8 },
  { id: 're', name: '不動産業', gm: 0.33, opm: 0.15, ar: 10, inv: 160, ap: 20, ppe: 1.4, dep: 0.04, beta: 1.4, trend: 0.01, spe: 5000e4, re: 0.95, size: 3e8 },
  { id: 'it', name: '情報通信業', gm: 0.42, opm: 0.075, ar: 62, inv: 5, ap: 25, ppe: 0.08, dep: 0.18, beta: 0.8, trend: 0.04, spe: 1400e4, re: 0.1, size: 3e8 },
  { id: 'med', name: '医療・福祉', gm: 0.30, opm: 0.055, ar: 60, inv: 6, ap: 30, ppe: 0.55, dep: 0.07, beta: 0.4, trend: 0.02, spe: 800e4, re: 0.5, size: 3e8 },
  { id: 'htl', name: '宿泊業', gm: 0.68, opm: 0.07, ar: 10, inv: 3, ap: 20, ppe: 1.6, dep: 0.06, beta: 1.6, trend: 0.01, spe: 1000e4, re: 0.85, size: 4e8 },
  { id: 'agr', name: '農業', gm: 0.26, opm: 0.04, ar: 30, inv: 60, ap: 30, ppe: 0.75, dep: 0.09, beta: 0.5, trend: 0.0, spe: 1300e4, re: 0.75, size: 1.6e8 },
];
const IND = Object.fromEntries(INDUSTRIES.map(i => [i.id, i]));

/* ---------- 汐見市の地区 ----------
 * pop=人口 firms=事業所数 income=所得水準 sav=貯蓄性向 compet=競争の激しさ rent=支店賃料(月)
 * mix=業種構成 timeShare=定期預金比率 mort=住宅需要 trend=人口の自然増減(年%) */
const DISTRICTS = [
  { id: 'chuo', name: '中央区', desc: '市役所とオフィスが集まる都心。競合行がひしめく。', pop: 78000, firms: 6200, income: 1.15, sav: 1.0, compet: 1.6, rent: 200e4,
    mix: { whl: 3, it: 2, re: 3, med: 1, ret: 1, con: 1 }, timeShare: 0.38, mort: 0.6, trend: -0.2,
    poly: [[245, 122], [400, 170], [418, 300], [300, 322], [232, 262], [200, 200]], label: [318, 230] },
  { id: 'ekimae', name: '駅前・商店街', desc: '汐見駅を中心とした商業地。飲食・小売が多い。', pop: 52000, firms: 4100, income: 1.0, sav: 1.0, compet: 1.3, rent: 150e4,
    mix: { ret: 4, food: 4, re: 2, med: 1, whl: 1 }, timeShare: 0.40, mort: 0.8, trend: -0.4,
    poly: [[400, 170], [545, 140], [600, 172], [602, 290], [418, 300]], label: [505, 245] },
  { id: 'kowan', name: '港湾地区', desc: '汐見港の物流拠点。運輸・卸売業が集まる。', pop: 31000, firms: 2300, income: 0.95, sav: 0.95, compet: 1.0, rent: 90e4,
    mix: { trn: 4, whl: 3, mfg: 2, con: 1 }, timeShare: 0.42, mort: 0.6, trend: -0.6,
    poly: [[300, 322], [418, 300], [602, 290], [640, 405], [560, 432], [262, 428]], label: [452, 372] },
  { id: 'kogyo', name: '臨海工業団地', desc: '製造業の集積地。設備投資の需要が大きい。', pop: 24000, firms: 1500, income: 1.0, sav: 0.95, compet: 0.9, rent: 70e4,
    mix: { mfg: 6, con: 2, trn: 2 }, timeShare: 0.40, mort: 0.7, trend: -0.5,
    poly: [[20, 212], [200, 200], [232, 262], [300, 322], [262, 428], [20, 440]], label: [130, 330] },
  { id: 'newtown', name: '北部ニュータウン', desc: '子育て世帯が多い住宅地。住宅ローンの需要が旺盛。', pop: 96000, firms: 1600, income: 1.1, sav: 1.0, compet: 1.2, rent: 90e4,
    mix: { ret: 2, med: 2, con: 2, food: 1 }, timeShare: 0.42, mort: 1.8, trend: 0.3,
    poly: [[232, 20], [540, 20], [545, 140], [400, 170], [245, 122]], label: [392, 82] },
  { id: 'gakuen', name: '学園都市', desc: '大学と研究所の街。IT・医療系の起業が多い。', pop: 41000, firms: 1200, income: 1.05, sav: 0.9, compet: 1.0, rent: 80e4,
    mix: { it: 5, med: 3, food: 2 }, timeShare: 0.30, mort: 1.2, trend: 0.2,
    poly: [[600, 172], [652, 272], [780, 282], [780, 420], [640, 405], [602, 290]], label: [692, 345] },
  { id: 'onsen', name: '汐見温泉郷', desc: '山あいの温泉街。観光需要に業績が左右される。', pop: 14000, firms: 900, income: 0.85, sav: 1.1, compet: 0.7, rent: 45e4,
    mix: { htl: 6, food: 3, ret: 1, agr: 1 }, timeShare: 0.55, mort: 0.5, trend: -1.2,
    poly: [[20, 20], [232, 20], [245, 122], [200, 200], [20, 212]], label: [118, 112] },
  { id: 'denen', name: '東部田園地帯', desc: '農業が盛んで高齢化が進む。定期預金の厚い地盤。', pop: 38000, firms: 1400, income: 0.9, sav: 1.35, compet: 0.8, rent: 35e4,
    mix: { agr: 5, con: 2, mfg: 1, food: 1 }, timeShare: 0.62, mort: 0.6, trend: -1.4,
    poly: [[540, 20], [780, 20], [780, 282], [652, 272], [600, 172], [545, 140]], label: [672, 128] },
];
const DIST = Object.fromEntries(DISTRICTS.map(d => [d.id, d]));

/* ---------- 都市開発プロジェクト ---------- */
const PROJECTS = [
  { id: 'chuo1', d: 'chuo', name: '中央区再開発「汐見セントラルタワー」', spc: '汐見中央再開発株式会社', cost: 90e8, months: 30, risk: 3,
    fx: { firms: 260, pop: 1800, vit: 10, land: 0.08 }, icon: 'tower' },
  { id: 'ekimae1', d: 'ekimae', name: '駅ビル建替え・商店街リノベーション', spc: '汐見駅前開発株式会社', cost: 45e8, months: 24, risk: 3,
    fx: { firms: 180, pop: 600, vit: 14, land: 0.06, ind: { ret: 0.15, food: 0.15 } }, icon: 'mall' },
  { id: 'kowan1', d: 'kowan', name: '国際物流センター建設', spc: '汐見港ロジスティクス株式会社', cost: 60e8, months: 24, risk: 4,
    fx: { firms: 120, pop: 1200, vit: 15, land: 0.05, ind: { trn: 0.3, whl: 0.15 } }, icon: 'warehouse' },
  { id: 'kogyo1', d: 'kogyo', name: '工業団地第2期造成・半導体関連企業誘致', spc: '汐見臨海産業開発株式会社', cost: 75e8, months: 36, risk: 4,
    fx: { firms: 90, pop: 2800, vit: 18, land: 0.06, ind: { mfg: 0.3 } }, icon: 'factory' },
  { id: 'newtown1', d: 'newtown', name: '北部ニュータウン第3期 宅地分譲', spc: '汐見北部住宅開発株式会社', cost: 50e8, months: 30, risk: 3,
    fx: { firms: 60, pop: 6000, vit: 8, land: 0.05, mort: 0.6 }, icon: 'houses' },
  { id: 'gakuen1', d: 'gakuen', name: 'サイエンスパーク・起業支援施設', spc: '汐見サイエンスパーク株式会社', cost: 30e8, months: 24, risk: 4,
    fx: { firms: 140, pop: 900, vit: 15, land: 0.05, ind: { it: 0.3 } }, icon: 'lab' },
  { id: 'onsen1', d: 'onsen', name: '温泉郷リゾートホテル誘致・観光拠点整備', spc: '汐見温泉リゾート開発株式会社', cost: 40e8, months: 24, risk: 5,
    fx: { firms: 50, pop: 400, vit: 22, land: 0.07, ind: { htl: 0.35, food: 0.15 } }, icon: 'hotel' },
  { id: 'denen1', d: 'denen', name: '道の駅・6次産業化拠点の整備', spc: '汐見アグリパーク株式会社', cost: 18e8, months: 18, risk: 4,
    fx: { firms: 70, pop: 200, vit: 12, land: 0.03, ind: { agr: 0.3 } }, icon: 'market' },
  { id: 'chuo2', d: 'chuo', name: '市庁舎移転・官民複合施設（PFI）', spc: '汐見シビックPFI株式会社', cost: 132e8, months: 36, risk: 2, req: 'chuo1',
    fx: { firms: 300, pop: 2500, vit: 10, land: 0.06 }, icon: 'civic' },
  { id: 'ekimae2', d: 'ekimae', name: '新幹線新駅の開業・駅前広場整備', spc: '汐見新駅まちづくり株式会社', cost: 156e8, months: 36, risk: 3, req: 'ekimae1',
    fx: { firms: 350, pop: 4000, vit: 15, land: 0.1, city: 3 }, icon: 'station' },
  { id: 'kowan2', d: 'kowan', name: 'クルーズ船ターミナル整備', spc: '汐見ポートターミナル株式会社', cost: 54e8, months: 24, risk: 5, req: 'kowan1',
    fx: { firms: 80, pop: 300, vit: 12, land: 0.04, ind: { htl: 0.2, ret: 0.1 } }, icon: 'ship' },
  { id: 'kogyo2', d: 'kogyo', name: '次世代電池工場の誘致', spc: '汐見バッテリーパーク株式会社', cost: 180e8, months: 36, risk: 5, req: 'kogyo1',
    fx: { firms: 60, pop: 4500, vit: 20, land: 0.07, ind: { mfg: 0.3 } }, icon: 'factory' },
  { id: 'newtown2', d: 'newtown', name: '大型商業施設・総合病院の開業', spc: '汐見北部タウンセンター株式会社', cost: 84e8, months: 30, risk: 3, req: 'newtown1',
    fx: { firms: 160, pop: 3000, vit: 10, land: 0.05, ind: { ret: 0.1, med: 0.2 } }, icon: 'mall' },
  { id: 'gakuen2', d: 'gakuen', name: '大学病院・医療研究センター', spc: '汐見メディカルリサーチ株式会社', cost: 96e8, months: 30, risk: 2, req: 'gakuen1',
    fx: { firms: 90, pop: 2200, vit: 12, land: 0.05, ind: { med: 0.3 } }, icon: 'hospital' },
  { id: 'onsen2', d: 'onsen', name: '温泉街の街並み再生・観光DX', spc: '汐見温泉まちづくり株式会社', cost: 24e8, months: 18, risk: 4, req: 'onsen1',
    fx: { firms: 60, pop: 300, vit: 12, land: 0.04, ind: { htl: 0.2 } }, icon: 'hotel' },
  { id: 'denen2', d: 'denen', name: '大規模スマート農業団地', spc: '汐見スマートアグリ株式会社', cost: 42e8, months: 24, risk: 5, req: 'denen1',
    fx: { firms: 40, pop: 500, vit: 12, land: 0.03, ind: { agr: 0.3 } }, icon: 'farm' },
];
const PROJ = Object.fromEntries(PROJECTS.map(p => [p.id, p]));

/* ---------- 店舗 ---------- */
const BRANCH_TYPES = {
  hq:    { name: '本店', capex: 0, rentMul: 0, ops: 5, sales: 0, presence: 1.0, vaultCap: 0, atms: 4, cashBase: 1.0e8, months: 0 },
  full:  { name: '支店', capex: 3.0e8, rentMul: 1, ops: 4, sales: 2, presence: 1.0, vaultCap: 2e8, atms: 3, cashBase: 0.6e8, months: 3 },
  small: { name: '出張所', capex: 0.8e8, rentMul: 0.4, ops: 2, sales: 1, presence: 0.45, vaultCap: 0.6e8, atms: 2, cashBase: 0.2e8, months: 2 },
};
const ATM_CAPEX = 1200e4, ATM_MAINT = 5e4, ATM_CASH = 800e4;

/* ---------- 金庫・警備 ---------- */
const VAULT_LEVELS = [
  null,
  { lv: 1, name: '小型金庫', cap: 10e8, cost: 0, months: 0, maint: 30e4 },
  { lv: 2, name: '中型金庫', cap: 30e8, cost: 1.5e8, months: 1, maint: 60e4 },
  { lv: 3, name: '大型金庫室', cap: 100e8, cost: 5e8, months: 2, maint: 150e4 },
  { lv: 4, name: '地下大金庫', cap: 300e8, cost: 15e8, months: 3, maint: 400e4 },
  { lv: 5, name: '自動化キャッシュセンター', cap: 1000e8, cost: 40e8, months: 4, maint: 900e4 },
];
const SECURITY_LEVELS = [
  { lv: 0, name: '機械警備', cost: 0, maint: 50e4, risk: 1.0 },
  { lv: 1, name: '常駐警備員の配置', cost: 0.2e8, maint: 280e4, risk: 0.55 },
  { lv: 2, name: '生体認証・時限ロック', cost: 1.5e8, maint: 380e4, risk: 0.3 },
  { lv: 3, name: '統合セキュリティセンター', cost: 5e8, maint: 750e4, risk: 0.12 },
];

/* ---------- システム ---------- */
const SYSTEMS = {
  core: { name: '勘定系システム', desc: '預金・融資の記帳を担う基幹システム。容量を超えると障害が頻発し、新規口座が開けなくなる。', levels: [
    null,
    { name: '旧式オンラインシステム', cap: 40000, maint: 300e4 },
    { name: '第3次オンラインシステム', cap: 150000, cost: 6e8, months: 6, maint: 500e4 },
    { name: 'オープン勘定系システム', cap: 500000, cost: 18e8, months: 9, maint: 1000e4 },
    { name: 'クラウドネイティブ勘定系', cap: 2000000, cost: 45e8, months: 12, maint: 1800e4 },
  ] },
  credit: { name: '融資審査システム', desc: '決算書のスコアリング、粉飾の兆候検知、AI審査を提供する。', levels: [
    { name: '導入なし（手計算）', maint: 0 },
    { name: '財務スコアリング', cost: 0.8e8, months: 2, maint: 60e4 },
    { name: '粉飾検知モジュール', cost: 2.5e8, months: 3, maint: 180e4 },
    { name: 'AI審査エンジン', cost: 4.5e8, months: 4, maint: 400e4 },
  ] },
  digital: { name: 'デジタルチャネル', desc: 'ネットバンキングとアプリ。預金獲得力と事務効率が上がる一方、サイバー攻撃の標的にもなる。', levels: [
    { name: '導入なし', maint: 0 },
    { name: 'インターネットバンキング', cost: 1.5e8, months: 3, maint: 100e4 },
    { name: 'スマホアプリ', cost: 4e8, months: 4, maint: 350e4 },
    { name: 'フルデジタルバンク（全国から口座開設）', cost: 8e8, months: 6, maint: 800e4 },
  ] },
  cyber: { name: 'サイバーセキュリティ', desc: '不正アクセスや情報漏えいのリスクを下げる。', levels: [
    { name: '基本対策のみ', maint: 30e4 },
    { name: 'SOCによる24時間監視', cost: 0.8e8, months: 2, maint: 200e4 },
    { name: 'ゼロトラスト・アーキテクチャ', cost: 3e8, months: 3, maint: 500e4 },
    { name: 'CSIRT・脅威インテリジェンス', cost: 8e8, months: 4, maint: 1000e4 },
  ] },
  aml: { name: 'マネロン・不正取引検知', desc: '犯罪収益の移転や特殊詐欺口座を検知する。金融庁が重視する分野。', levels: [
    { name: '目視確認のみ', maint: 0 },
    { name: '取引モニタリング', cost: 0.6e8, months: 2, maint: 100e4 },
    { name: 'AI不正検知', cost: 2e8, months: 3, maint: 300e4 },
    { name: '統合AMLプラットフォーム', cost: 5e8, months: 4, maint: 600e4 },
  ] },
  audit: { name: '内部監査支援', desc: '支店の月次報告を自動分析し、行員の不正の兆候を知らせる。', levels: [
    { name: '紙ベースの監査', maint: 0 },
    { name: '支店モニタリング', cost: 0.5e8, months: 2, maint: 80e4 },
    { name: '不正兆候スコアリング', cost: 1.8e8, months: 3, maint: 250e4 },
  ] },
};
const SYS_KEYS = Object.keys(SYSTEMS);

/* ---------- 人員 ---------- */
const STAFF_ROLES = {
  sales:  { name: '営業（渉外）', desc: '融資案件の発掘、預金・投信の獲得' },
  credit: { name: '審査', desc: '決算書分析と実地調査。1人あたり月10人日' },
  ops:    { name: '事務・窓口', desc: '口座管理と窓口業務。不足すると事務ミスと待ち時間が増える' },
  comp:   { name: '管理・監査', desc: 'コンプライアンス、内部監査、リスク管理' },
};
const HIRE_COST = 60e4;

/* ---------- 債務者区分 ---------- */
const CLS = [
  { name: '正常先', short: '正常', rate: 0.003 },
  { name: '要注意先', short: '要注意', rate: 0.03 },
  { name: '要管理先', short: '要管理', rate: 0.15 },
  { name: '破綻懸念先', short: '破綻懸念', rate: 0.70 },
  { name: '実質破綻先', short: '実質破綻', rate: 1.0 },
  { name: '破綻先', short: '破綻', rate: 1.0 },
];
/* 行内格付 → 年間デフォルト率（%） */
const GRADE_PD = [null, 0.03, 0.08, 0.15, 0.3, 0.5, 0.9, 1.6, 3.2, 7.0, 15.0];
const GRADE_THRESH = [96, 91, 83, 74, 64, 55, 45, 36, 24]; // スコア → 格付1..10
/* 格付ごとの貸出スプレッド（短期市場金利に上乗せ、%） */
const GRADE_SPREAD = [null, 0.6, 0.72, 0.86, 1.02, 1.22, 1.48, 1.9, 2.55, 3.5, 4.9];

/* ---------- 住宅ローン申込者の職業 ---------- */
const OCCUPATIONS = [
  { id: 'listed', name: '会社員（上場企業）', inc: [550, 1100], risk: 0.6, w: 22 },
  { id: 'sme', name: '会社員（中小企業）', inc: [380, 700], risk: 1.0, w: 30 },
  { id: 'civil', name: '公務員', inc: [480, 850], risk: 0.4, w: 16 },
  { id: 'doctor', name: '医師', inc: [1100, 2200], risk: 0.7, w: 4 },
  { id: 'self', name: '自営業', inc: [350, 1300], risk: 1.8, w: 12 },
  { id: 'contract', name: '契約社員・派遣社員', inc: [260, 430], risk: 2.4, w: 8 },
  { id: 'nurse', name: '看護師・医療職', inc: [420, 650], risk: 0.7, w: 8 },
];
const PROPERTY_TYPES = ['新築マンション', '中古マンション', '新築戸建て', '中古戸建て', '注文住宅'];

/* ---------- 名前素材 ---------- */
const FAMILY_NAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川', '前田', '岡田', '長谷川', '藤田', '後藤', '近藤', '村上', '遠藤', '青木', '坂本', '福田', '太田', '西村', '藤井', '金子', '岡本', '藤原', '中野', '三浦', '原田', '中川', '松田', '竹内', '小野', '田村', '中山', '和田', '石田', '森田', '上田', '内田', '柴田', '酒井', '宮崎', '横山', '高木', '安藤', '宮本', '大野', '小島', '工藤', '谷口', '今井', '高田', '丸山', '増田', '杉山', '村田', '大塚', '小山', '平野', '野口', '武田', '松井', '千葉', '岩崎', '菅原', '木下', '久保', '野村', '松尾', '新井', '桜井', '浅野', '大西', '矢野'];
const GIVEN_NAMES = ['一郎', '健一', '誠', '浩', '隆', '修', '大輔', '拓也', '直樹', '翔太', '陽介', '和也', '健太', '剛', '博之', '正人', '康弘', '茂', '勝', '聡', '徹', '亮', '悠斗', '蓮', '美穂', '恵子', '裕子', '真由美', '直子', '由美子', '智子', '陽子', '明美', '久美子', '恵美', 'さくら', '彩', '優子', '千尋', '舞', '奈々', '香織'];
const CO_PREFIX = ['北斗', '大和', '東邦', '丸山', '高砂', '若葉', '旭', '朝日', '光陽', '三協', '日進', '富士', '菱和', '青葉', '白鳥', '港南', '汐見', '潮風', '平和', '共栄', '協和', '大成', '新和', '千代田', '明和', '一心', '誠和', '昭和', '栄光', '太陽', '明星', '双葉', '鶴見', '松風', '竹林', '桜木', '岬', '海翔', '浜崎', '山城', '川島', '森下', '石原', '中央', '東洋', '西海', '南洋', '北辰', '常盤', '瑞穂', '豊和', '長栄', '泰平', '宝山', '金城', '銀河', '翠嶺', '紅葉', '白銀'];
const CO_CORE = {
  mfg: ['精工', '製作所', '工業', '金属工業', '化成', '電機', '精密', '鋳造', '機械', '樹脂工業', '製菓', '食品工業'],
  con: ['建設', '工務店', '土木', '組', '建工', '設備工業', '塗装', '住設'],
  whl: ['商事', '物産', '商会', '通商', '産業', '資材'],
  ret: ['商店', 'ストアー', '薬局', '家具店', 'スーパー', '電器', '酒店'],
  food: ['フーズ', '食堂', 'ダイニング', '珈琲店', '寿司', '麺業', '飯店'],
  trn: ['運輸', '物流', '運送', '交通', 'ロジテック', '倉庫'],
  re: ['不動産', '地所', 'エステート', '住宅販売', 'ハウジング', '開発'],
  it: ['システムズ', 'テクノロジーズ', 'ソフトウェア', 'ネットワークス', 'データ', 'ラボ'],
  med: ['メディカル', 'ケアサービス', '介護サービス', 'ヘルスケア', '調剤薬局'],
  htl: ['ホテル', '観光', '旅館', 'リゾート', '温泉'],
  agr: ['農園', 'ファーム', 'アグリ', '牧場', '園芸'],
};

/* ---------- 融資の資金使途 ---------- */
const PURPOSES = {
  wc:      { name: '運転資金（増加運転資金）', term: [24, 60], repay: 'equal', mult: [1.0, 2.5] },
  season:  { name: '短期運転資金（季節資金）', term: [6, 12], repay: 'bullet', mult: [0.5, 1.2] },
  capex:   { name: '設備資金', term: [60, 144], repay: 'equal', mult: [0, 0] },
  refi:    { name: '借換資金（他行肩代わり）', term: [48, 96], repay: 'equal', mult: [0, 0] },
  deficit: { name: '赤字補填資金', term: [24, 60], repay: 'equal', mult: [0.5, 1.5] },
};

/* ---------- 景気局面 ---------- */
const REGIMES = {
  boom:      { name: '好況', gdp: 2.6, cpi: 2.6, unemp: 2.3, def: 0.7, demand: 1.25, land: 4.0, stock: 12 },
  expansion: { name: '回復・拡大', gdp: 1.4, cpi: 2.0, unemp: 2.6, def: 0.85, demand: 1.1, land: 1.5, stock: 6 },
  slowdown:  { name: '減速', gdp: 0.2, cpi: 1.2, unemp: 3.0, def: 1.15, demand: 0.9, land: 0, stock: -4 },
  recession: { name: '景気後退', gdp: -1.8, cpi: 0.2, unemp: 3.9, def: 1.8, demand: 0.7, land: -4, stock: -15 },
  crisis:    { name: '金融危機', gdp: -4.2, cpi: -0.6, unemp: 4.8, def: 3.0, demand: 0.5, land: -10, stock: -35 },
};
const REGIME_TRANS = {
  boom:      [['boom', 0.955], ['slowdown', 0.04], ['crisis', 0.005]],
  expansion: [['expansion', 0.955], ['boom', 0.025], ['slowdown', 0.018], ['crisis', 0.002]],
  slowdown:  [['slowdown', 0.9], ['expansion', 0.055], ['recession', 0.04], ['crisis', 0.005]],
  recession: [['recession', 0.9], ['expansion', 0.085], ['crisis', 0.015]],
  crisis:    [['crisis', 0.85], ['recession', 0.15]],
};

const DIFFICULTY = {
  easy:   { name: 'やさしい', fraud: 0.09, crisis: 0.5, capital: 1.25, fsa: 0.7 },
  normal: { name: 'ふつう', fraud: 0.16, crisis: 1.0, capital: 1.0, fsa: 1.0 },
  hard:   { name: 'きびしい', fraud: 0.24, crisis: 1.6, capital: 0.85, fsa: 1.3 },
};

/* ---------- 銀行の規模クラス（総資産） ---------- */
const BANK_CLASSES = [
  { min: 0, name: '小規模金融機関' },
  { min: 1000e8, name: '信用金庫クラス' },
  { min: 3000e8, name: '第二地銀クラス' },
  { min: 1e12, name: '地方銀行クラス' },
  { min: 3e12, name: '有力地銀クラス' },
  { min: 10e12, name: '広域地銀グループ' },
  { min: 30e12, name: 'メガバンク級' },
];
const RATINGS = ['AA+', 'AA', 'AA−', 'A+', 'A', 'A−', 'BBB+', 'BBB', 'BBB−', 'BB+', 'BB', 'B', 'CCC'];
const RATING_SCORE = [90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 32];
