'use strict';
/* =========================================================
 *  29d_kaisha_hr.js : 方針と人事（経営方針・重点実施事項・目標・福利厚生・従業員満足度・障害者雇用）
 *   ・経営方針（経営理念）と、毎年の重点実施事項（3つまで）、目標（KPI）を決め、決算で達成を振り返る
 *   ・福利厚生と手当：実在の制度（出張手当・住宅手当・食事補助・企業型DC など）を選ぶ。費用は勘定科目に
 *     記帳し、従業員の所得税の扱い（非課税の要件）も確かめられる
 *   ・従業員満足度：賃金・賞与・福利厚生・残業・労災・方針で動き、離職・労災・採用の費用・お客さまの満足に効く
 *  福利厚生の税の扱いは、国税庁の資料などによる（2026年11月時点）。費用はゲームの目安
 * ========================================================= */

/* ---------- 経営方針（経営理念） ---------- */
/* eff：効果の倍率（demand 需要・quit 離職・acc 労災・shrink 棚卸減耗・food 食中毒・leak 漏えい・energy 電気代・fuel 燃料・hire 採用の費用・bcp 災害の被害・viol 不祥事・ot 残業）
   es：従業員満足度への効果（点）  costR：売上高に対する毎月の費用の割合（acct の科目）  costH：1人あたりの毎月の費用 */
const KS_CREEDS = [
  { id: 'customer', n: '顧客第一', d: 'お客さまの満足を何より優先する。現場の判断で応えられる仕組みをつくる', eff: { demand: 1.01 }, es: 0 },
  { id: 'quality', n: '品質第一', d: '不良とクレームを減らし、ブランドを守る。検査と改善に手間をかける', eff: { shrink: 0.94, food: 0.8, leak: 0.85, acc: 0.97 }, es: 1, costR: 0.001, acct: 'fees' },
  { id: 'growth', n: '成長重視', d: '売上とシェアを広げ、新しい事業に投資する。社員には負荷がかかる', eff: { demand: 1.02 }, es: -2, costR: 0.002, acct: 'ads' },
  { id: 'finance', n: '財務の健全性', d: '自己資本比率と手元の資金を重視し、無理な投資と借入をしない', eff: { demand: 0.995 }, es: 0, bank: 4 },
  { id: 'people', n: '人的資本経営', d: '人材を資本ととらえ、育成と処遇に投資する', eff: { quit: 0.85, acc: 0.95 }, es: 6, costH: 5000, acct: 'recruit' },
  { id: 'local', n: '地域密着', d: '地域の雇用・取引先・自治体との関係を大切にする', eff: { demand: 1.006 }, es: 2, bank: 2 },
  { id: 'innov', n: '技術革新', d: '研究開発とDXに投資し、競争の優位をつくる', eff: { demand: 1.008, shrink: 0.98 }, es: 1, costR: 0.003, acct: 'rnd' },
  { id: 'green', n: '環境・脱炭素', d: 'CO2の削減・再生可能エネルギー・環境に配慮した製品', eff: { energy: 0.94, fuel: 0.97 }, es: 1, costR: 0.0008, acct: 'fees' },
  { id: 'holder', n: '株主還元', d: '配当と自社株買いを重視する。株価は上がりやすいが、社員の評価は下がりがち', eff: {}, es: -1, ipo: 1.05 },
  { id: 'comply', n: 'コンプライアンス重視', d: '法令の順守と内部統制、不祥事の防止を徹底する', eff: { acc: 0.93, leak: 0.85, viol: 0.6 }, es: 1, costR: 0.0005, acct: 'fees' },
  { id: 'es', n: '従業員の働きがい', d: '働きやすさとエンゲージメントを重視する', eff: { quit: 0.9, ot: 0.95 }, es: 5, costH: 3000, acct: 'fukuri' },
  { id: 'risk', n: 'ガバナンス・リスク管理', d: '取締役会の実効性、事業継続計画（BCP）、情報セキュリティ', eff: { leak: 0.85, bcp: 0.75, viol: 0.8 }, es: 0, costR: 0.0006, acct: 'fees' },
];
const KS_CREED_BY = Object.fromEntries(KS_CREEDS.map(x => [x.id, x]));

/* ---------- 年度の重点実施事項（3つまで） ---------- */
const KS_PRIS = [
  { id: 'raise', n: '賃上げ（ベースアップ）と初任給の引き上げ', d: '給与を3%引き上げる（毎年の人件費が増える）。従業員満足度が大きく上がり、採用もしやすくなる', es: 6, eff: { hire: 0.9, quit: 0.9 }, onStart: () => { G.wageLv = +((G.wageLv || 1) * 1.03).toFixed(4); } },
  { id: 'hire', n: '採用の強化（新卒・中途・外国人材）', d: '採用の担当と広告を増やす。採用の費用が下がる', eff: { hire: 0.8 }, es: 1, costH: 3000, acct: 'recruit' },
  { id: 'train', n: '人材育成とリスキリング', d: '研修と資格の取得を支える。離職とミスが減る', eff: { quit: 0.85, shrink: 0.97, acc: 0.95 }, es: 3, costH: 4000, acct: 'recruit' },
  { id: 'newbiz', n: '新しい商品・サービスの開発', d: '研究開発に投資する。半年後から需要が少し増える', eff: { demand: 1.015 }, delay: 6, costR: 0.002, acct: 'rnd' },
  { id: 'dx', n: 'DXの推進（業務のデジタル化・AI）', d: 'システムと業務の見直し。ロス・電気代・漏えいの危険が減る', eff: { shrink: 0.95, energy: 0.98, leak: 0.9, ot: 0.95 }, es: 1, costR: 0.0015, acct: 'fees' },
  { id: 'prod', n: '生産性の向上（業務改善・省人化）', d: '5Sと業務の標準化。残業とロスが減る', eff: { ot: 0.9, shrink: 0.96 }, costR: 0.001, acct: 'fees' },
  { id: 'sales', n: '営業力の強化・販路の拡大', d: '営業の人員と広告を増やす。需要が増える', eff: { demand: 1.02 }, es: -1, costR: 0.002, acct: 'ads' },
  { id: 'cost', n: '原価の低減（購買の見直し・仕入先との交渉）', d: '仕入先と交渉して、2か月後から仕入の割戻し（0.8%）を受ける。仕入高から差し引く', rebate: 0.008, delay: 2, costR: 0.0005, acct: 'fees' },
  { id: 'fin', n: '財務基盤の強化（借入金の削減・自己資本の積み増し）', d: '銀行との関係がよくなる（借入の審査で評価される）', bank: 3 },
  { id: 'esg', n: 'ESG・脱炭素の取り組み', d: '省エネと再生可能エネルギー。電気代が減り、評判が少し上がる', eff: { energy: 0.95, demand: 1.004 }, costR: 0.0008, acct: 'fees' },
  { id: 'health', n: '健康経営（健診・ストレスチェック・メンタルヘルス）', d: '健康経営優良法人の認定をめざす。労災と離職が減る', eff: { acc: 0.9, quit: 0.92 }, es: 3, costH: 2500, acct: 'fukuri' },
  { id: 'diversity', n: 'ダイバーシティ（女性活躍・障害者雇用・シニア）', d: '多様な人が働ける職場づくり。障害者雇用も進めやすくなる', es: 2, costH: 1500, acct: 'recruit', dis: true },
  { id: 'workstyle', n: '働き方改革（残業の削減・有給の取得・テレワーク）', d: '残業が減り、満足度が上がる。仕事の量の調整で需要が少し減ることも', eff: { ot: 0.85, demand: 0.997 }, es: 4 },
  { id: 'family', n: '両立の支援（男性の育休・介護との両立）', d: '育児・介護と仕事の両立を支える。離職が減る', eff: { quit: 0.93 }, es: 3, costH: 1500, acct: 'fukuri' },
  { id: 'comply', n: '内部統制・コンプライアンス・ハラスメントの防止', d: '研修と相談窓口。不祥事とハラスメントの危険が減る', eff: { viol: 0.65, leak: 0.9 }, es: 1, costR: 0.0005, acct: 'fees' },
  { id: 'bcp', n: 'BCP（事業継続計画）と防災', d: '災害の被害と、営業が止まる期間を小さくする', eff: { bcp: 0.6 }, costR: 0.0004, acct: 'fees' },
  { id: 'succ', n: '事業承継と後継者の育成', d: '経営幹部を育てる。銀行の評価も少し上がる', es: 1, bank: 1, costR: 0.0003, acct: 'recruit' },
];
const KS_PRI_BY = Object.fromEntries(KS_PRIS.map(x => [x.id, x]));

/* ---------- 目標（KPI） ---------- */
const KS_GOALS = {
  sales: { n: '売上高', u: 'yen', up: true },
  ord: { n: '経常利益', u: 'yen', up: true },
  ordm: { n: '経常利益率', u: '%', up: true },
  eqr: { n: '自己資本比率', u: '%', up: true },
  grade: { n: '銀行の格付', u: 'g', up: false },
  acc: { n: '休業4日以上の労働災害', u: '件', up: false },
  ot: { n: '1人の月の残業時間（年の平均）', u: 'h', up: false },
  es: { n: '従業員満足度（期末）', u: 'pt', up: true },
  viol: { n: '立入検査の指摘', u: '件', up: false },
  cash: { n: '期末の現預金', u: 'yen', up: true },
};

/* ---------- 福利厚生と手当 ---------- */
/* base：すでに給与・経費に含まれている基本の制度（費用は増えない）。lv：段階（0 なし）。
   cost(h, x)：1人あたりの毎月の費用（段階 x）。share：対象になる人の割合。tax：従業員の所得税（非課税の要件）。
   acct：会社の勘定科目（salary＝課税される手当として給与に含める）。es・eff：効果 */
const KS_WF = [
  { id: 'commute', cat: '手当', n: '通勤手当', base: true, acct: 'travel', tax: '公共交通機関は月15万円まで非課税。マイカー・自転車は片道の距離で月4,200円〜38,700円まで非課税（2025年4月以後の改正。2km未満は課税）。所得税は非課税でも、社会保険料の計算（報酬）には含まれる', d: '通勤の費用を払う。ほとんどの会社にある基本の手当' },
  { id: 'trip', cat: '手当', n: '出張手当（日当）と宿泊料', lvs: ['旅費規程なし（実費だけ精算）', '日当 2,000円・宿泊 1泊1万円まで', '日当 3,000円・宿泊 1泊1.2万円まで'], cost: (h, x) => ksTripDays() * [0, 2000, 3000][x] + ksTripDays() * 0.4 * [0, 1000, 2000][x], acct: 'travel', es: [0, 2, 3], tax: '旅費規程に基づき、出張に通常必要な額（同業・同規模の会社と比べて妥当な額。役員と社員で極端な差がない）なら非課税。規程がないのに定額で払うと給与として課税される。会社は旅費交通費で処理する', d: '出張の日数に応じて定額の日当を払い、宿泊は上限の範囲で精算する' },
  { id: 'house', cat: '手当', n: '住宅手当', lvs: ['なし', '月1万円', '月2万円'], cost: (h, x) => [0, 1e4, 2e4][x], share: 0.5, acct: 'salary', es: [0, 3, 5], eff: { quit: [1, 0.96, 0.93] }, tax: '全額が給与として課税され、社会保険料の対象にもなる（会社の法定福利費も増える）', d: '賃貸住宅に住む社員に、家賃の一部を手当として払う。若手の定着に効く' },
  { id: 'family', cat: '手当', n: '家族手当', lvs: ['なし', '子1人1万円', '配偶者5,000円＋子1人1万円'], cost: (h, x) => [0, 7000, 9000][x], share: 0.45, acct: 'salary', es: [0, 2, 3], tax: '給与として課税（社会保険料の対象）。最近は配偶者の手当を減らし、子の手当を手厚くする会社が多い', d: '扶養する家族に応じて払う' },
  { id: 'single', cat: '手当', n: '単身赴任手当', lvs: ['なし', '月4万円（帰省の旅費は実費）'], cost: (h, x) => [0, 4e4][x], share: 0.02, acct: 'salary', es: [0, 1], need: () => ksHrMultiSite(), tax: '手当は給与として課税。会社が帰省の旅費を実費で精算する分は、妥当な範囲で非課税', d: '転勤で家族と離れて暮らす社員の二重生活を支える（拠点が複数の会社）' },
  { id: 'qual', cat: '手当', n: '資格手当', lvs: ['なし', '月5,000円〜1万円'], cost: (h, x) => [0, 8000][x], share: 0.25, acct: 'salary', es: [0, 2], eff: { shrink: [1, 0.98], acc: [1, 0.97] }, tax: '給与として課税', d: '仕事に役立つ資格を持つ社員に毎月払う。技能を高める動機になる' },
  { id: 'remote', cat: '手当', n: '在宅勤務手当', lvs: ['なし', '月3,000円（定額）', '通信費・電気代の実費（業務分）を精算'], cost: (h, x) => [0, 3000, 2500][x], share: () => ksHrRemoteShare(), acct: ['salary', 'salary', 'fukuri'], es: [0, 2, 2], tax: '定額で払う手当は給与として課税。業務に使った通信費・電気代を合理的に計算して実費で精算する分は非課税', d: 'テレワークの光熱費・通信費を補う。人の力で稼ぐ事業で効果が大きい' },
  { id: 'shataku', cat: '住宅', n: '借上社宅', lvs: ['なし', '若手と転勤者に（家賃の半分を会社が負担）'], cost: (h, x) => [0, 4e4][x], share: 0.1, acct: 'fukuri', es: [0, 4], eff: { quit: [1, 0.93], hire: [1, 0.92] }, tax: '社員から「賃貸料相当額」（固定資産税の課税標準額などから計算）の50%以上を家賃として受け取れば、会社の負担分は課税されない。社宅の家賃を会社が払う分は地代家賃・福利厚生費', d: '会社が借りた住宅を社員に貸す。採用と定着に大きく効く' },
  { id: 'meal', cat: '食事', n: '食事補助（食事券・置き社食）', lvs: ['なし', '月3,500円', '月7,500円（非課税の上限）'], cost: (h, x) => [0, 3500, 7500][x], acct: 'fukuri', es: [0, 2, 3], tax: '社員が食事の価額の半分以上を負担し、会社の負担が月7,500円以下（税抜）なら非課税。2026年4月から上限が月3,500円から7,500円に引き上げられた。深夜勤務の夜食代は1回650円まで', d: '昼食代の一部を会社が負担する。費用が小さく満足度が高い' },
  { id: 'canteen', cat: '食事', n: '社員食堂', lvs: ['なし', '委託で運営（1食あたり200円を会社が負担）'], cost: (h, x) => [0, 4400][x], acct: 'fukuri', es: [0, 3], eff: { acc: [1, 0.98] }, need: () => ksHeadcount() >= 100, tax: '食事補助と同じ要件（社員の負担が半分以上・会社の負担が月7,500円以下）なら非課税', d: '社内の食堂。従業員100人以上から' },
  { id: 'dock', cat: '健康', n: '人間ドックの補助', lvs: ['なし', '35歳以上に年3万円'], cost: (h, x) => [0, 1500][x], acct: 'fukuri', es: [0, 2], eff: { acc: [1, 0.97], quit: [1, 0.98] }, tax: '一定の年齢以上の全員を対象に、会社が医療機関に直接払えば非課税（役員だけなどは給与になる）', d: '法定の健康診断に上乗せして、詳しい検査の費用を出す' },
  { id: 'flu', cat: '健康', n: 'インフルエンザの予防接種', lvs: ['なし', '全員に会社負担'], cost: (h, x) => [0, 350][x], acct: 'fukuri', es: [0, 1], eff: { acc: [1, 0.99] }, tax: '全員が対象なら非課税', d: '冬の欠勤を減らす' },
  { id: 'eap', cat: '健康', n: 'メンタルヘルスの外部相談窓口（EAP）', lvs: ['なし', 'あり'], cost: (h, x) => [0, 400][x], acct: 'fukuri', es: [0, 2], eff: { quit: [1, 0.95] }, tax: '相談の利用は非課税', d: 'カウンセラーに匿名で相談できる。休職と離職を防ぐ（ストレスチェックと組み合わせる）' },
  { id: 'gym', cat: '健康', n: 'スポーツクラブの法人会員', lvs: ['なし', 'あり'], cost: (h, x) => [0, 1200][x], acct: 'fukuri', es: [0, 1], tax: '全員が同じ条件で使えるなら非課税', d: '健康づくりを支える' },
  { id: 'nursery', cat: '育児・介護', n: '企業主導型保育所の利用（企業枠）', lvs: ['なし', '提携して企業枠を確保'], cost: (h, x) => [0, 900][x], acct: 'fukuri', es: [0, 2], eff: { quit: [1, 0.95] }, tax: '会社が施設に払う利用料の負担は、一定の条件で課税されない（現金で渡すと給与）', d: '子育て中の社員の復職を支える。女性の定着に大きく効く' },
  { id: 'sitter', cat: '育児・介護', n: 'ベビーシッターの補助', lvs: ['なし', 'あり'], cost: (h, x) => [0, 600][x], acct: 'fukuri', es: [0, 1], tax: '会社が事業者に直接払う仕組みなら非課税になる場合がある（現金で渡すと給与）', d: '急な残業や病児のときに使える' },
  { id: 'leave', cat: '育児・介護', n: '育児休業の給付の上乗せ（男性の育休を後押し）', lvs: ['なし', 'あり'], cost: (h, x) => [0, 700][x], acct: 'salary', es: [0, 2], eff: { quit: [1, 0.97] }, tax: '会社の上乗せは給与として課税（育児休業給付は非課税）', d: '雇用保険の給付に上乗せして、休業中の収入を補う。男性の育休の取得が増える' },
  { id: 'care', cat: '育児・介護', n: '介護の支援（相談窓口・介護休暇の上乗せ）', lvs: ['なし', 'あり'], cost: (h, x) => [0, 300][x], acct: 'fukuri', es: [0, 1], eff: { quit: [1, 0.98] }, tax: '相談などのサービスは非課税、現金の給付は課税', d: '親の介護による離職（介護離職）を防ぐ' },
  { id: 'holiday', cat: '休暇', n: '特別休暇（リフレッシュ・アニバーサリー・誕生日）', lvs: ['なし', '年3日'], cost: (h, x) => [0, ksHrAvgWage() * 3 / 250 * 0.5][x], acct: 'misc', es: [0, 3], tax: '休んだ日の給与は通常どおり課税（休暇そのものは課税されない）。費用は休む人の仕事を埋める分', d: '年次有給休暇とは別の有給の休暇' },
  { id: 'hourly', cat: '休暇', n: '時間単位の年次有給休暇', lvs: ['なし', 'あり（年5日分まで。労使協定）'], cost: () => 0, acct: 'misc', es: [0, 1], tax: '費用はかからない', d: '通院や学校の行事に1時間単位で休める' },
  { id: 'zaikei', cat: '資産形成・退職', n: '財形貯蓄', lvs: ['なし', 'あり'], cost: (h, x) => [0, 150][x], acct: 'fukuri', es: [0, 1], tax: '財形年金・財形住宅は元利合計550万円まで利子が非課税（一般財形は課税）。会社は給与からの天引きと事務', d: '給与から天引きで積み立てる' },
  { id: 'esop', cat: '資産形成・退職', n: '社員持株会の奨励金（拠出額の10%）', lvs: ['なし', 'あり'], cost: (h, x) => [0, 700][x], acct: 'salary', es: [0, 1], eff: { quit: [1, 0.98] }, need: () => ksForm(G) === 'kk', tax: '奨励金は給与として課税', d: '社員が自社の株を少しずつ買う。会社が上乗せする（株式会社だけ）' },
  { id: 'dc', cat: '資産形成・退職', n: '企業型確定拠出年金（企業型DC）', lvs: ['なし', '月5,000円', '月1万円'], cost: (h, x) => [0, 5000, 1e4][x], acct: 'fukuri', es: [0, 3, 4], eff: { quit: [1, 0.95, 0.92], hire: [1, 0.97, 0.95] }, tax: '会社の掛金は給与にならず非課税で、社会保険料の対象にもならない。運用益も非課税で、受け取るときに課税。拠出の上限は2026年12月から月6.2万円（企業年金とiDeCoの共通枠）', d: '会社が掛金を出し、社員が自分で運用する退職金の制度' },
  { id: 'chutai', cat: '資産形成・退職', n: '中小企業退職金共済（中退共）', lvs: ['なし', '月5,000円', '月1万円'], cost: (h, x) => [0, 5000, 1e4][x], acct: 'fukuri', es: [0, 2, 3], eff: { quit: [1, 0.96, 0.94] }, need: () => ksHrSmall(), tax: '会社の掛金は全額が損金。社員は退職のときに退職所得として課税（退職所得控除がある）', d: '中小企業のための外部に積み立てる退職金（資本金3億円以下または従業員300人以下など）' },
  { id: 'cert', cat: '自己啓発', n: '資格取得の支援（受験料・講習費・合格祝い金）', lvs: ['なし', 'あり'], cost: (h, x) => [0, 1500][x], acct: 'recruit', es: [0, 2], eff: { shrink: [1, 0.98], acc: [1, 0.97] }, tax: '仕事に必要な資格なら非課税。仕事に関係のない資格は給与として課税', d: '技能と意欲を高める' },
  { id: 'study', cat: '自己啓発', n: '研修・書籍・語学の補助', lvs: ['なし', 'あり'], cost: (h, x) => [0, 2500][x], acct: 'recruit', es: [0, 2], eff: { quit: [1, 0.97] }, tax: '仕事に関係する研修・書籍なら非課税', d: '社外のセミナーや書籍の費用を出す' },
  { id: 'trip2', cat: 'レクリエーション', n: '社員旅行', lvs: ['なし', '年1回（1人6万円）'], cost: (h, x) => [0, 5000][x], acct: 'fukuri', es: [0, 1], tax: '4泊5日以内（海外は現地の滞在日数）、参加が全体の50%以上、会社の負担が1人10万円程度までなら非課税。行かない人にお金を渡すと給与になる', d: '若手には人気がないこともある' },
  { id: 'club', cat: 'レクリエーション', n: '懇親会・部活動の補助', lvs: ['なし', 'あり'], cost: (h, x) => [0, 1000][x], acct: 'fukuri', es: [0, 1], tax: '社会通念の範囲なら非課税（社外の人との飲食は交際費）', d: 'チームの結束を高める' },
  { id: 'keicho', cat: '慶弔・保険', n: '慶弔見舞金', base: true, acct: 'fukuri', tax: '慶弔の規程に基づく社会通念上相当な額は非課税', d: '結婚・出産・弔事・災害のお祝いやお見舞い。ほとんどの会社にある' },
  { id: 'gltd', cat: '慶弔・保険', n: '団体保険・GLTD（長期の所得補償）', lvs: ['なし', 'あり'], cost: (h, x) => [0, 800][x], acct: 'insur', es: [0, 2], tax: '会社が保険料を負担し全員が加入するなら、給与にならない（受け取る給付金は非課税）', d: '病気やけがで長く働けなくなったときの収入を補う' },
  { id: 'kinzoku', cat: '慶弔・保険', n: '永年勤続の表彰', lvs: ['なし', '10年ごとに記念品・旅行'], cost: (h, x) => [0, 300][x], acct: 'fukuri', es: [0, 1], tax: '勤続10年以上で、おおむね10年以上の間隔、社会通念上相当な記念品・旅行なら非課税（現金や商品券は課税）', d: '長く勤めた人をたたえる' },
  { id: 'cafeteria', cat: '働き方・その他', n: '福利厚生の代行サービス（カフェテリアプラン）', lvs: ['なし', 'あり'], cost: (h, x) => [0, 800][x], acct: 'fukuri', es: [0, 2], eff: { hire: [1, 0.97] }, tax: '会社が会費を負担し、全員が同じ条件で使えるなら原則として非課税（特定の人に現金のポイントを渡すと給与）', d: '宿泊・レジャー・育児・介護などの割引のメニューを外部の会社が用意する。中小企業で使いやすい' },
];
const KS_WF_BY = Object.fromEntries(KS_WF.map(x => [x.id, x]));
const KS_WF_CATS = ['手当', '住宅', '食事', '健康', '育児・介護', '休暇', '資産形成・退職', '自己啓発', 'レクリエーション', '慶弔・保険', '働き方・その他'];
/* 出張の日数（1人・1か月）：事業の型で違う */
const KS_TRIP_DAYS = { trade: 1.6, build: 1.2, pro: 1.4, subs: 0.8, mfg: 0.6, cap: 0.4, trans: 0.5, shop: 0.2, rest: 0.15 };
function ksTripDays() {
  const us = ksActiveUnits();
  const h = Math.max(1, ksHeadcount());
  return us.length ? sum(us, u => ksUnitHead(u) * (KS_TRIP_DAYS[ksS(u).eng] || 0.5)) / h : 0.5;
}
function ksHrRemoteShare() { const us = ksActiveUnits(); const h = Math.max(1, ksHeadcount()); return us.length ? sum(us, u => ksUnitHead(u) * (['pro', 'subs'].includes(ksS(u).eng) ? 0.6 : 0.08)) / h : 0.3; }
function ksHrAvgWage() { const us = ksActiveUnits(); const h = Math.max(1, ksHeadcount()); return us.length ? sum(us, u => sum(ksS(u).roles, r => (u.staff[r.id] || 0) * ksRoleWage(r, u))) / h : 30e4; }
function ksHrSmall() { return (G.bal.capital || 0) <= 3e8 || ksHeadcount() <= 300; }
function ksHrMultiSite() { return !!(G.loc && new Set([G.loc.hq, ...ksActiveUnits().map(u => (typeof ksUnitPref === 'function' ? ksUnitPref(u) : 0))]).size > 1); }
function ksWfShare(W) { return typeof W.share === 'function' ? W.share() : W.share ?? 1; }
function ksWfLv(id) { return (G.hr && G.hr.wf[id]) || 0; }
function ksWfAvail(W) { return !W.need || W.need(); }
/* 1か月の費用（会社全体） */
function ksWfCostMonth(W, lv = ksWfLv(W.id)) {
  if (W.base || !lv || !ksWfAvail(W)) return 0;
  const h = ksHeadcount();
  return Math.round(h * ksWfShare(W) * W.cost(h, lv));
}
function ksWfAcct(W, lv) { return Array.isArray(W.acct) ? W.acct[lv] : W.acct; }

/* ---------- 初期化（就任のとき：先代の制度を引き継ぐ） ---------- */
function ksHrInit(o = {}) {
  if (G.hr) return;
  const cond = G.cond || 'normal';
  const big = ksHeadcount() >= 100;
  const wf = {};
  // 先代の制度：会社の状態と規模で、いくつかの手当と制度がある
  wf.trip = cond === 'bad' ? 0 : 1;
  wf.house = cond === 'bad' ? 0 : 1;
  wf.family = cond === 'good' ? 2 : 1;
  wf.dock = cond === 'good' || big ? 1 : 0;
  wf.flu = cond === 'good' ? 1 : 0;
  wf.chutai = ksHrSmall() && cond !== 'bad' ? 1 : 0;
  wf.dc = big && cond !== 'bad' ? 1 : 0;
  wf.club = 1;
  wf.kinzoku = cond === 'good' ? 1 : 0;
  G.hr = { creed: o.creed || (cond === 'good' ? 'customer' : cond === 'bad' ? 'finance' : 'local'), creedM: G.m, pri: { fy: fyOf(G.m), list: [], m: {} }, goals: { fy: fyOf(G.m), list: [] }, goalsHist: [], wf, es: 50, esHist: [], mt: {}, dis: 0, disNeed: 0 };
  // 先代の制度の費用は、すでに経費に含まれていたものとして扱う（キャリブレーション後の利益率を変えないため）
  G.hr.wfBase = Object.assign({}, wf);
  G.hr.es = ksHrEsTarget() + (cond === 'good' ? 4 : cond === 'bad' ? -6 : 0);
  // 障害者雇用（法定雇用率2.7%・37.5人以上）
  G.hr.dis = Math.floor(ksHrDisNeed() * (cond === 'good' ? 1 : cond === 'bad' ? 0.4 : 0.75));
  ksHrDefaultGoals();
}
/* 障害者の法定雇用の人数（2026年7月から2.7%。常用の労働者37.5人以上） */
function ksHrDisRate() { return G.m >= 3 ? 0.027 : 0.025; }
function ksHrDisNeed() { const h = ksHeadcount(); return h >= (ksHrDisRate() >= 0.027 ? 37.5 : 40) ? Math.floor(h * ksHrDisRate()) : 0; }
function ksHrDefaultGoals() {
  const fy = fyOf(G.m);
  const b = G.budget && G.budget.fy === fy ? G.budget.lines : null;
  const L = ksLastFY();
  const list = [];
  if (b) { list.push({ k: 'sales', v: Math.round(b.sales / 1e6) * 1e6 }); list.push({ k: 'ord', v: Math.round(Math.max(b.ord, L ? L.pl.ord * 1.03 : 0) / 1e6) * 1e6 }); }
  else if (L) { list.push({ k: 'sales', v: Math.round(L.pl.sales * 1.03 / 1e6) * 1e6 }); list.push({ k: 'ord', v: Math.round(Math.max(1e6, L.pl.ord * 1.05) / 1e6) * 1e6 }); }
  list.push({ k: 'acc', v: 0 });
  G.hr.goals = { fy, list, set: false };
}

/* ---------- 従業員満足度 ---------- */
function ksHrEsParts() {
  const H = G.hr;
  const parts = [];
  let wfp = 0;
  for (const W of KS_WF) { if (W.base || !ksWfAvail(W)) continue; const lv = ksWfLv(W.id); if (lv && W.es) wfp += W.es[lv] || 0; }
  parts.push(['福利厚生と手当', Math.round(wfp * 0.8 * 10) / 10]);
  parts.push(['給与の水準', Math.round(((G.wageLv || 1) - 1) * 150 * 10) / 10]);
  parts.push(['賞与の水準', Math.round(((G.bonusLv ?? 1) - 1) * 30 * 10) / 10]);
  const C = KS_CREED_BY[H.creed];
  if (C && C.es) parts.push([`経営方針（${C.n}）`, C.es]);
  const pe = sum(ksHrPris(), P => P.es || 0);
  if (pe) parts.push(['重点実施事項', pe]);
  const ot = G.law ? (G.law.otNow ?? 20) : 20;
  if (ot > 25) parts.push(['残業の多さ', -Math.round((ot - 25) * 0.6 * 10) / 10]);
  const acc = G.law ? G.law.acc.filter(a => G.m - a.m < 6 && (a.days >= 4 || a.sev === 'death')).length : 0;
  if (acc) parts.push(['最近の労働災害', -4 * acc]);
  if (G.law && G.law.policy) { const s = G.law.policy.safety; if (s === 0) parts.push(['安全への取り組みが弱い', -5]); if (s === 2) parts.push(['安全への手厚い取り組み', 3]); if (!G.law.policy.yukyu) parts.push(['有給休暇が取りにくい', -4]); }
  if (G.law) { const v = ksLawViolations().size; if (v) parts.push(['法令違反のある職場', -1.5 * v]); }
  if (H.layoffM !== undefined && G.m - H.layoffM < 12) parts.push(['人員の削減', -6]);
  if (H.goodYear && G.m - H.goodYear < 12) parts.push(['目標の達成', 3]);
  for (const x of (H.esTmp || [])) if (x.until > G.m) parts.push([x.n, x.v]);
  if (H.cutM !== undefined && G.m - H.cutM < 6) parts.push(['制度の縮小', -5]);
  return parts;
}
/* 満足度の目標：要素の合計に、効き目の逓減をかける（足すほど上がりにくい） */
function ksHrEsTarget() { const s = sum(ksHrEsParts(), p => p[1]); return clamp(50 + 45 * Math.tanh(s / 45), 5, 95); }
/* 効果の倍率（key：quit・acc・demand・shrink・food・leak・energy・fuel・hire・bcp・viol・ot） */
function ksHrF(u, key) {
  const H = G.hr;
  if (!H) return 1;
  let f = 1;
  const es = H.es;
  if (key === 'quit') f *= clamp(1.6 - es / 100 * 1.2, 0.6, 1.5);
  else if (key === 'acc') f *= clamp(1.15 - es * 0.003, 0.85, 1.15);
  else if (key === 'hire') f *= clamp(1.4 - es / 100 * 0.8, 0.7, 1.4);
  else if (key === 'demand' && u && ['shop', 'rest', 'cap', 'subs', 'trans'].includes(ksS(u).eng)) f *= 1 + (es - 50) * 0.0004;
  else if (['shrink', 'food', 'leak'].includes(key)) f *= clamp(1.1 - es * 0.002, 0.9, 1.1);
  const C = KS_CREED_BY[H.creed];
  if (C && C.eff && C.eff[key] !== undefined) f *= C.eff[key];
  for (const P of ksHrPris()) {
    if (!P.eff || P.eff[key] === undefined) continue;
    if (P.delay && G.m - ((H.pri.m || {})[P.id] ?? G.m) < P.delay) continue;
    f *= P.eff[key];
  }
  for (const W of KS_WF) {
    if (W.base || !W.eff || !W.eff[key] || !ksWfAvail(W)) continue;
    const lv = ksWfLv(W.id);
    if (lv) f *= W.eff[key][lv] ?? 1;
  }
  return f;
}
function ksHrPris() { const H = G.hr; return H && H.pri && H.pri.fy === fyOf(G.m) ? H.pri.list.map(id => KS_PRI_BY[id]).filter(Boolean) : []; }

/* ---------- 方針・重点・目標・福利厚生を決める ---------- */
function ksHrSetCreed(id) { if (!KS_CREED_BY[id] || G.hr.creed === id) return false; G.hr.creed = id; G.hr.creedM = G.m; ksNews(`経営方針を「${KS_CREED_BY[id].n}」にしました`, 'info'); return true; }
function ksHrSetPris(list) {
  const H = G.hr, fy = fyOf(G.m);
  const ids = [...new Set(list)].filter(id => KS_PRI_BY[id]).slice(0, 3);
  if (H.pri.fy !== fy) H.pri = { fy, list: [], m: {} };
  for (const id of ids) {
    if (H.pri.list.includes(id)) continue;
    H.pri.m[id] = G.m;
    const P = KS_PRI_BY[id];
    if (P.onStart) P.onStart();
  }
  H.pri.list = ids;
  H.pri.set = true;
}
function ksHrSetGoals(list) {
  const H = G.hr, fy = fyOf(G.m);
  H.goals = { fy, list: list.filter(x => KS_GOALS[x.k]).slice(0, 5).map(x => ({ k: x.k, v: +x.v })), set: true };
}
function ksHrSetWf(id, lv) {
  const W = KS_WF_BY[id];
  if (!W || W.base) return false;
  const max = (W.lvs || []).length - 1;
  lv = clamp(Math.round(+lv || 0), 0, max);
  const old = ksWfLv(id);
  if (old === lv) return false;
  G.hr.wf[id] = lv;
  if (lv < old) G.hr.cutM = G.m; // 制度を減らすと、しばらく満足度が下がる
  return true;
}
/* いまの制度で増える費用（就任のときの制度に比べて。1か月） */
function ksWfExtraMonth() {
  let s = 0;
  for (const W of KS_WF) {
    if (W.base) continue;
    s += ksWfCostMonth(W, ksWfLv(W.id)) - ksWfCostMonth(W, Math.min(ksWfLv(W.id), (G.hr.wfBase || {})[W.id] || 0));
  }
  return Math.round(s);
}

/* ---------- 毎月 ---------- */
function ksHrMonth(ctx) {
  const H = G.hr;
  const fy = fyOf(G.m);
  // 年度が変わったら重点実施事項と目標を新しくする
  if (H.pri.fy !== fy) { H.priLast = H.pri; H.pri = { fy, list: [], m: {} }; }
  if (H.goals.fy !== fy) ksHrDefaultGoals();
  // 従業員満足度
  const t = ksHrEsTarget();
  H.es = +(H.es * 0.85 + t * 0.15).toFixed(1);
  H.esHist.push(H.es);
  if (H.esHist.length > 24) H.esHist.shift();
  const mt = H.mt[fy] || (H.mt[fy] = { ot: 0, n: 0 });
  mt.ot += G.law ? (G.law.otNow ?? 0) : 0; mt.n++;
  // 福利厚生の費用（就任のときより手厚くした分だけ。課税される手当は給与と社会保険料に含める）
  const us = ksActiveUnits();
  const head = Math.max(1, ksHeadcount());
  for (const W of KS_WF) {
    if (W.base) continue;
    const lv = ksWfLv(W.id), b = Math.min(lv, (H.wfBase || {})[W.id] || 0);
    const extra = ksWfCostMonth(W, lv) - ksWfCostMonth(W, b);
    if (extra <= 0) continue;
    const acct = ksWfAcct(W, lv);
    for (const u of us) {
      const n = ksUnitHead(u);
      if (!n) continue;
      const amt = Math.round(extra * n / head);
      if (amt <= 0) continue;
      if (acct === 'salary') {
        const lab = sum(ksS(u).roles.filter(r => r.cost === 'labor'), r => u.staff[r.id] || 0) / n;
        const a1 = Math.round(amt * lab), a2 = amt - a1, wf = Math.round(amt * 0.15);
        ksPost('wf_' + W.id, [['labor', a1, 0], ['salary', a2, 0], ['welfare', wf, 0], ['cash', 0, amt + wf]], { u: u.id, key: u.id, cf: 'payroll' });
      } else ksPost('wf_' + W.id, [[acct, amt, 0], ['cash', 0, amt]], { u: u.id, key: u.id, cf: 'exp' });
    }
  }
  // 経営方針・重点実施事項の費用
  const sales = (G.flow || {}).sales || 0;
  const items = [KS_CREED_BY[H.creed], ...ksHrPris()].filter(Boolean);
  for (const P of items) {
    const c = Math.round((P.costR ? sales * P.costR : 0) + (P.costH ? head * P.costH : 0));
    if (c > 0) ksPost('hrPol', [[P.acct || 'fees', c, 0], ['cash', 0, c]], { u: 'HQ', key: P.id, cf: 'exp', desc: `${P.n}の取り組みの費用` });
  }
  // 原価の低減：仕入の割戻し（仕入高から差し引く）
  for (const P of ksHrPris()) {
    if (!P.rebate || G.m - (H.pri.m[P.id] ?? G.m) < (P.delay || 0)) continue;
    const f = G.flow || {};
    for (const k of ['purch', 'matPurch']) {
      const v = Math.round((f[k] || 0) * P.rebate);
      if (v > 0) ksPost('rebate', [['cash', v, 0], [k, 0, v]], { u: 'HQ', key: k, cf: 'collect', desc: '仕入割戻し（原価の低減の取り組み）' });
    }
  }
  // 障害者雇用：支援の費用（ジョブコーチ・職場の環境）と、納付金・調整金（5月に申告）
  if (H.dis > 0) ksPost('disSup', [['fukuri', Math.round(H.dis * 1e4), 0], ['cash', 0, Math.round(H.dis * 1e4)]], { u: 'HQ', cf: 'exp', desc: '障害のある社員の職場の支援' });
  H.disNeed = ksHrDisNeed();
  const ds = H.disMt || (H.disMt = { short: 0, over: 0 });
  if (head > 100) { ds.short += Math.max(0, H.disNeed - H.dis); ds.over += Math.max(0, H.dis - H.disNeed); }
  if (ctx.mo === 5 && (ds.short || ds.over)) {
    const pay = Math.round(ds.short * 5e4), recv = Math.round(Math.min(ds.over, 120) * 2.9e4 + Math.max(0, ds.over - 120) * 2.3e4);
    if (pay > 0) { ksPost('disLevy', [['dues', pay, 0], ['cash', 0, pay]], { u: 'HQ', cf: 'exp', desc: '障害者雇用納付金（法定雇用率に足りない人数×月5万円）' }); if (!G.isSub) ksNews(`障害者雇用納付金${fmtYen(pay)}を納めました（法定雇用率${(ksHrDisRate() * 100).toFixed(1)}%に足りない人数1人あたり月5万円）`, 'bad'); }
    if (recv > 0) { ksPost('disAdj', [['cash', recv, 0], ['miscInc', 0, recv]], { u: 'HQ', cf: 'other', desc: '障害者雇用調整金（法定雇用率を超えて雇用した人数×月2.9万円）' }); if (!G.isSub) ksNews(`障害者雇用調整金${fmtYen(recv)}を受け取りました（雑収入）`, 'good'); }
    H.disMt = { short: 0, over: 0 };
  }
}
/* 障害のある人を雇う（採用と職場の環境づくり） */
function ksHrHireDis(n = 1) {
  const cost = Math.round(n * 50e4 * (KS_PRI_BY.diversity && ksHrPris().some(p => p.id === 'diversity') ? 0.7 : 1));
  ksPost('disHire', [['recruit', cost, 0], ['cash', 0, cost]], { u: 'HQ', cf: 'exp', desc: '障害のある人の採用と職場の環境づくり' });
  G.hr.dis += n;
  return cost;
}

/* ---------- 決算：目標を振り返る ---------- */
function ksHrGoalActual(k, fy) {
  const st = G.fys[fy];
  const s = st ? ksToBankFS(st) : null;
  const mt = G.hr.mt[fy] || { ot: 0, n: 0 };
  switch (k) {
    case 'sales': return st.pl.sales;
    case 'ord': return st.pl.ord;
    case 'ordm': return st.pl.sales ? st.pl.ord / st.pl.sales * 100 : 0;
    case 'eqr': return s && s.TA ? s.EQ / s.TA * 100 : 0;
    case 'grade': return G.grade;
    case 'acc': return G.law ? G.law.acc.filter(a => fyOf(a.m) === fy && (a.days >= 4 || a.sev === 'death')).length : 0;
    case 'ot': return mt.n ? mt.ot / mt.n : 0;
    case 'es': return G.hr.es;
    case 'viol': return G.law ? sum(G.law.insp.filter(x => fyOf(x.m) === fy), x => x.finds.length) : 0;
    case 'cash': return ksB('cash');
    default: return 0;
  }
}
function ksHrAfterClose(fy) {
  const H = G.hr;
  if (!H || !G.fys[fy] || !H.goals || H.goals.fy !== fy) return;
  const res = H.goals.list.map(x => {
    const D = KS_GOALS[x.k];
    const a = ksHrGoalActual(x.k, fy);
    const ok = D.up ? a >= x.v : a <= x.v;
    return { k: x.k, v: x.v, a, ok };
  });
  const n = res.filter(r => r.ok).length;
  H.goalsHist.unshift({ fy, res, pri: (H.pri && H.pri.fy === fy ? H.pri.list : []).slice(), creed: H.creed });
  if (H.goalsHist.length > 12) H.goalsHist.length = 12;
  if (res.length && n >= Math.ceil(res.length / 2)) {
    H.goodYear = G.m;
    for (const b of Object.values(G.banks || {})) b.rel = Math.min(100, (b.rel || 50) + 3);
  }
  if (!G.isSub && res.length) ksNews(`${ksFyLabel(fy)}の目標：${res.length}項目のうち${n}項目を達成しました（${res.map(r => `${KS_GOALS[r.k].n}${r.ok ? '○' : '×'}`).join('・')}）`, n >= res.length / 2 ? 'good' : 'bad');
}

/* ---------- 効果の倍率を、事業の計算に組み込む ---------- */
const ksUpgradeFH0 = ksUpgradeF;
ksUpgradeF = function (u, key) {
  let f = ksUpgradeFH0(u, key);
  if (G && G.hr && u) f *= ksHrF(u, key);
  if (key === 'demand' && typeof ksMapDemandF === 'function' && G && G.loc) f *= ksMapDemandF(u);
  return f;
};
const ksOtHoursUH0 = ksOtHoursU;
ksOtHoursU = function (u) { return ksOtHoursUH0(u) * (G.hr ? ksHrF(u, 'ot') : 1); };
/* 事業を新しく加えたとき：所在地を登録する */
const ksLawAddUnitH0 = ksLawAddUnit;
ksLawAddUnit = function (u) {
  ksLawAddUnitH0(u);
  if (G.loc && !G.loc.units[u.id]) G.loc.units[u.id] = (u.prefInit && KS_PREFS[u.prefInit] ? +u.prefInit : 0) || G.loc.hq;
};
