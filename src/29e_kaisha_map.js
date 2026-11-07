'use strict';
/* =========================================================
 *  29e_kaisha_map.js : 拠点と地図（都道府県・海外の国）
 *   ・本社と事業所の所在地（都道府県）。最低賃金・地価・災害の起きやすさ・事業所税が所在地で変わる
 *   ・土地の購入（仲介手数料・登録免許税・不動産取得税）、建物の建設、固定資産税・都市計画税、地価の変動
 *   ・自然災害（地震・台風・豪雨・大雪）と地震保険
 *   ・海外の国（法人税率・付加価値税・配当の源泉税・賃金の水準・守るべき法律）
 *  出典：地価は令和8年（2026年7月1日）都道府県地価調査の基準地の用途別平均（国土交通省のオープンデータからの集計）、
 *  最低賃金は令和8年度の地域別最低賃金（厚生労働省の答申・2026年9月公表）、人口は令和7年国勢調査の速報、
 *  賃金は令和7年賃金構造基本統計調査（きまって支給する現金給与額）。災害の起きやすさは地震調査研究推進本部の
 *  長期評価（2026年1月）などからの目安（0〜3）。ゲームの目安で、正確な値ではない
 * ========================================================= */

/* [コード, 名前, 短い名前, 地方, 列, 行, 住宅地, 商業地, 工業地（円/㎡）, 住宅地の前年比%, 最低賃金（円）, 人口（万人）, 賃金（千円）, 地震, 台風, 雪, 水害, 大都市] */
const KS_PREF_RAW = [
  [1, '北海道', '北海道', 'hk', 12, 0, 24997, 135817, 17973, -0.3, 1131, 498.5, 322.8, 2, 0, 3, 1, 1],
  [2, '青森県', '青森', 'th', 12, 1, 16538, 35791, 13062, -0.5, 1090, 114.0, 282.4, 2, 1, 3, 1, 0],
  [3, '岩手県', '岩手', 'th', 12, 2, 26772, 45918, 12876, -0.7, 1090, 112.6, 301.1, 3, 1, 2, 2, 0],
  [4, '宮城県', '宮城', 'th', 12, 3, 55650, 385859, 35368, 0.0, 1098, 222.7, 342.3, 3, 1, 1, 2, 1],
  [5, '秋田県', '秋田', 'th', 11, 2, 13648, 26011, 7357, -0.4, 1090, 88.2, 294.8, 1, 0, 3, 2, 0],
  [6, '山形県', '山形', 'th', 11, 3, 20042, 41201, 10414, -0.5, 1092, 99.3, 293.5, 1, 0, 3, 2, 0],
  [7, '福島県', '福島', 'th', 11, 4, 24247, 50263, 14334, -0.7, 1094, 171.2, 318.4, 2, 1, 2, 2, 0],
  [8, '茨城県', '茨城', 'kt', 12, 5, 37183, 78946, 23911, 1.3, 1136, 279.1, 362.3, 2, 2, 0, 2, 0],
  [9, '栃木県', '栃木', 'kt', 11, 5, 34495, 69504, 18193, 0.0, 1125, 186.5, 350.8, 2, 1, 1, 2, 0],
  [10, '群馬県', '群馬', 'kt', 10, 5, 31566, 76531, 21813, -0.2, 1120, 186.8, 338.6, 1, 1, 1, 1, 0],
  [11, '埼玉県', '埼玉', 'kt', 10, 6, 129831, 385131, 79623, 1.6, 1196, 728.7, 357.0, 3, 2, 0, 2, 1],
  [12, '千葉県', '千葉', 'kt', 12, 6, 101451, 359334, 107176, 3.4, 1195, 625.9, 371.4, 3, 2, 0, 2, 1],
  [13, '東京都', '東京', 'kt', 11, 6, 506749, 3006654, 413315, 5.8, 1280, 1424.6, 448.5, 3, 2, 0, 2, 1],
  [14, '神奈川県', '神奈川', 'kt', 10, 7, 213285, 829005, 149397, 3.1, 1279, 919.4, 402.9, 3, 2, 0, 2, 1],
  [15, '新潟県', '新潟', 'cb', 10, 4, 25746, 79346, 18870, -0.8, 1108, 206.8, 316.7, 2, 0, 3, 2, 1],
  [16, '富山県', '富山', 'cb', 9, 4, 31278, 86114, 14460, -0.2, 1119, 98.6, 329.7, 1, 0, 3, 1, 0],
  [17, '石川県', '石川', 'cb', 8, 4, 50913, 136715, 20267, 0.3, 1113, 108.8, 331.7, 2, 0, 3, 1, 0],
  [18, '福井県', '福井', 'cb', 7, 5, 30590, 62719, 12600, -0.4, 1112, 72.9, 326.4, 2, 0, 3, 1, 0],
  [19, '山梨県', '山梨', 'cb', 9, 6, 23055, 44546, 15465, -0.6, 1113, 78.0, 348.2, 2, 1, 1, 1, 0],
  [20, '長野県', '長野', 'cb', 9, 5, 26216, 55643, 22572, 0.7, 1117, 195.5, 334.8, 2, 0, 2, 1, 0],
  [21, '岐阜県', '岐阜', 'cb', 8, 5, 33337, 93867, 22034, -0.7, 1121, 189.1, 340.1, 2, 1, 1, 2, 0],
  [22, '静岡県', '静岡', 'cb', 9, 7, 64946, 149384, 46996, -0.1, 1154, 346.9, 345.8, 3, 2, 0, 2, 1],
  [23, '愛知県', '愛知', 'cb', 8, 6, 122706, 533719, 66851, 1.3, 1195, 744.9, 380.4, 3, 2, 0, 2, 1],
  [24, '三重県', '三重', 'kk', 8, 7, 29798, 63800, 21694, -0.3, 1143, 169.5, 356.9, 3, 2, 0, 2, 0],
  [25, '滋賀県', '滋賀', 'kk', 7, 6, 50069, 107040, 30631, 0.6, 1136, 139.2, 362.1, 2, 1, 1, 1, 0],
  [26, '京都府', '京都', 'kk', 6, 6, 121473, 1068518, 116516, 1.2, 1180, 250.3, 366.8, 2, 1, 1, 2, 1],
  [27, '大阪府', '大阪', 'kk', 6, 7, 173358, 1451996, 139600, 3.0, 1231, 876.5, 376.5, 3, 2, 0, 2, 1],
  [28, '兵庫県', '兵庫', 'kk', 5, 6, 121601, 379913, 76512, 1.4, 1172, 532.4, 369.1, 2, 2, 1, 2, 1],
  [29, '奈良県', '奈良', 'kk', 7, 7, 53872, 193897, 47925, -0.8, 1107, 126.9, 350.6, 2, 1, 0, 1, 0],
  [30, '和歌山県', '和歌山', 'kk', 6, 8, 35342, 83743, 20087, -0.5, 1101, 86.4, 329.5, 3, 3, 0, 2, 0],
  [31, '鳥取県', '鳥取', 'cg', 4, 6, 18968, 43957, 13116, -0.6, 1090, 52.4, 299.1, 1, 1, 2, 2, 0],
  [32, '島根県', '島根', 'cg', 3, 6, 20211, 37325, 13528, -1.0, 1092, 62.9, 311.7, 1, 1, 2, 2, 0],
  [33, '岡山県', '岡山', 'cg', 4, 7, 31014, 113334, 20177, -0.2, 1104, 180.9, 332.2, 1, 1, 0, 3, 1],
  [34, '広島県', '広島', 'cg', 3, 7, 63755, 262616, 47828, 0.5, 1141, 268.3, 351.9, 1, 2, 1, 3, 1],
  [35, '山口県', '山口', 'cg', 2, 7, 26565, 45487, 20120, 0.0, 1101, 126.4, 338.9, 1, 2, 0, 2, 0],
  [36, '徳島県', '徳島', 'sk', 5, 8, 28599, 56214, 18832, -1.2, 1103, 67.5, 327.9, 3, 2, 0, 2, 0],
  [37, '香川県', '香川', 'sk', 4, 8, 33056, 75090, 16020, -0.3, 1092, 90.8, 340.2, 2, 2, 0, 1, 0],
  [38, '愛媛県', '愛媛', 'sk', 3, 8, 34173, 93503, 21459, -1.0, 1093, 126.0, 316.8, 2, 2, 0, 2, 0],
  [39, '高知県', '高知', 'sk', 4, 9, 31882, 70611, 15090, -0.5, 1086, 64.3, 306.7, 3, 3, 0, 2, 0],
  [40, '福岡県', '福岡', 'ks', 1, 8, 78348, 512288, 57736, 2.1, 1114, 508.2, 342.7, 1, 2, 0, 3, 1],
  [41, '佐賀県', '佐賀', 'ks', 0, 8, 23836, 50153, 26300, 1.1, 1095, 78.1, 305.8, 1, 2, 0, 3, 0],
  [42, '長崎県', '長崎', 'ks', 0, 9, 26485, 109300, 22935, 0.1, 1087, 123.2, 308.1, 1, 3, 0, 2, 0],
  [43, '熊本県', '熊本', 'ks', 1, 9, 33386, 168408, 24976, 0.8, 1092, 167.8, 317.1, 2, 2, 0, 3, 1],
  [44, '大分県', '大分', 'ks', 2, 8, 28913, 59292, 17098, 1.2, 1096, 107.7, 318.5, 2, 2, 0, 2, 0],
  [45, '宮崎県', '宮崎', 'ks', 2, 9, 25350, 44934, 13297, 0.3, 1085, 101.9, 287.6, 3, 3, 0, 2, 0],
  [46, '鹿児島県', '鹿児島', 'ks', 1, 10, 28190, 83337, 40440, -1.0, 1090, 151.3, 313.1, 2, 3, 0, 2, 0],
  [47, '沖縄県', '沖縄', 'ks', 0, 11, 79345, 232998, 144600, 5.3, 1086, 146.8, 294.8, 1, 3, 0, 1, 0],
];
const KS_PREF_REG = { hk: '北海道', th: '東北', kt: '関東', cb: '中部', kk: '近畿', cg: '中国', sk: '四国', ks: '九州・沖縄' };
const KS_PREF_RISKNOTE = {
  hk: '千島海溝・根室沖の巨大地震と津波、豪雪と暴風雪',
  th: '宮城県沖の地震（30年確率80〜90%程度以上）と三陸の津波、日本海側の豪雪、豪雨',
  kt: '首都直下地震、台風・高潮、荒川などの大規模な水害、富士山・浅間山の噴火',
  cb: '南海トラフ地震（東海）、内陸の活断層、日本海側の豪雪、伊勢湾の高潮',
  kk: '南海トラフ地震と津波（大阪湾・紀伊半島）、上町断層帯、紀伊半島の豪雨',
  cg: '西日本豪雨のような豪雨と土砂災害、台風、山陰の豪雪',
  sk: '南海トラフ地震（最大の被害が想定される地域）と津波、台風',
  ks: '日向灘〜南海トラフの地震、台風、線状降水帯の豪雨、阿蘇・桜島の噴火',
};
const KS_PREFS = {};
(function () {
  let w = 0, p = 0;
  for (const r of KS_PREF_RAW) { w += r[12] * r[11]; p += r[11]; }
  const avgW = w / p;
  for (const r of KS_PREF_RAW) {
    KS_PREFS[r[0]] = { c: r[0], n: r[1], s: r[2], reg: r[3], x: r[4], y: r[5], land: { res: r[6], com: r[7], ind: r[8] }, trend: r[9], mw: r[10], pop: r[11], wage: r[12], wIdx: +(r[12] / avgW).toFixed(3), risk: { eq: r[13], ty: r[14], sn: r[15], fl: r[16] }, city: !!r[17] };
  }
})();
const KS_LAND_USE = { com: '商業地', ind: '工業地', res: '住宅地' };
/* 用途地域（土地の用途ごとに、建てられるもの） */
const KS_ZONE = {
  com: { n: '商業地域・近隣商業地域', ok: ['hq', 'shop', 'office', 'hotel'], ng: '大きな工場は建てられない（危険の少ない小規模なものだけ）' },
  ind: { n: '工業地域・準工業地域', ok: ['hq', 'factory', 'warehouse', 'office', 'shop'], ng: '工業地域には学校・病院・ホテルを建てられない' },
  res: { n: '住居系の地域（第一種住居地域など）', ok: ['dorm', 'shop', 'office'], ng: '工場・倉庫業の倉庫は原則として建てられない。店舗・事務所は床面積の上限がある' },
};
const KS_BLDG_KIND = {
  hq: { n: '本社ビル', cost: 42e4, far: 2.5, life: 50, lead: 12, desc: '鉄筋コンクリート造の事務所。耐用年数50年。本社の機能をまとめる' },
  office: { n: '事務所・営業所', cost: 38e4, far: 1.5, life: 50, lead: 9, desc: '事業の事務所。耐用年数50年' },
  shop: { n: '店舗', cost: 32e4, far: 0.8, life: 39, lead: 8, desc: '鉄骨造の店舗。耐用年数39年（このゲームの目安）' },
  factory: { n: '工場', cost: 28e4, far: 0.6, life: 31, lead: 12, desc: '鉄骨造の工場。耐用年数31年（このゲームの目安）。敷地9,000㎡以上か建築面積3,000㎡以上は工場立地法の届出（90日前）' },
  warehouse: { n: '倉庫・物流センター', cost: 24e4, far: 0.8, life: 31, lead: 10, desc: '鉄骨造の倉庫。耐用年数31年（このゲームの目安）' },
  hotel: { n: '宿泊施設', cost: 45e4, far: 2, life: 39, lead: 14, desc: '鉄筋コンクリート造のホテル' },
  dorm: { n: '社員寮・社宅', cost: 30e4, far: 1.5, life: 47, lead: 9, desc: '従業員の寮。家賃の一部を徴収すれば福利厚生（賃貸料相当額の50%以上で非課税）' },
};

/* ---------- 海外の国 ---------- */
/* cit 法人税率（実効の目安%）・vat 付加価値税%・wht 日本の親会社への配当の源泉税（租税条約の親子間の目安%）・
   wk 製造業ワーカーの月給（米ドルの目安）・st 事務スタッフの月給・rent オフィス賃料（米ドル/㎡・月）
   laws: [名前, 中身, 違反したとき]。数字はゲームの目安（2026年。国や条件で違う） */
const KS_COUNTRIES = {
  us: { n: '米国', reg: 'na', x: 2, y: 1, cur: 'usd', cit: 27, vat: '州の売上税 0〜10%', wht: 0, wk: 4000, st: 5000, rent: 45, mw: '連邦7.25ドル/時（州・市で高い。カリフォルニアは16ドル超）',
    laws: [['FCPA（海外腐敗行為防止法）', '外国の公務員への贈賄の禁止と、帳簿・内部統制の義務', '法人は違反1件200万ドル以下、または利益の2倍の罰金'], ['輸出管理規則（EAR）', '米国の技術・部品を含む製品の再輸出も規制される', '違反1件あたり約37万ドル以上、または取引額の2倍の制裁金'], ['OSHA（労働安全衛生）', '労働災害の記録と安全基準', '重大な違反1件約1.6万ドル、故意・反復で約16万ドル']],
    risk: '関税・通商政策の変動、訴訟、人件費の高さ' },
  ca: { n: 'カナダ', reg: 'na', x: 2, y: 0, cur: 'usd', cit: 26.5, vat: 'GST5%（州でHST13〜15%）', wht: 5, wk: 3200, st: 3900, rent: 35, mw: '州ごとに約17〜18カナダドル/時',
    laws: [['外国公務員腐敗防止法（CFPOA）', '外国の公務員への贈賄の禁止', '罰金は上限なし、個人は最長14年の禁錮'], ['ケベック州のフランス語憲章', 'ケベック州ではフランス語の使用義務', '罰金と契約の効力の問題'], ['サプライチェーンの強制労働の報告法', '強制労働・児童労働の防止の報告', '報告の懈怠に罰金']],
    risk: '米国経済への依存、人件費の高さ、州ごとの規制の違い' },
  mx: { n: 'メキシコ', reg: 'na', x: 2, y: 2, cur: 'usd', cit: 30, vat: 'IVA16%', wht: 5, wk: 580, st: 1100, rent: 25, mw: '2026年 一般地域 日額315.04ペソ（前年比13%増）',
    laws: [['業務委託（アウトソーシング）の規制', '2021年の改正で人材派遣を禁止、専門サービスだけ認める', '罰金と、委託先の従業員を直接雇用したものとみなされる'], ['従業員への利益分配（PTU）', '課税所得の10%を従業員に配る', '未払いは労働当局の制裁'], ['USMCAの原産地規則', '米国に無税で輸出するための部品の現地調達率', '関税の負担']],
    risk: '治安、USMCAの見直しと対米関税、電力などのインフラ、ペソの変動' },
  br: { n: 'ブラジル', reg: 'la', x: 3, y: 4, cur: 'usd', cit: 34, vat: '複雑（ICMS・IPI・PIS/COFINS。2026年から新税IBS/CBSへの移行）', wht: 10, wk: 550, st: 1200, rent: 30, mw: '2026年 月1,621レアル',
    laws: [['クリーン企業法（腐敗防止）', '贈賄に対する会社の責任', '売上高の最大20%の制裁金'], ['一般データ保護法（LGPD）', '個人データの保護', '売上高の2%（1件最大5,000万レアル）'], ['労働法（CLT）', '解雇のときの勤続期間基金（FGTS）の40%の上乗せなど', '労働訴訟が非常に多い']],
    risk: '税務の複雑さ（ブラジル・コスト）、為替の変動、労働訴訟' },
  gb: { n: '英国', reg: 'eu', x: 5, y: 0, cur: 'eur', cit: 25, vat: 'VAT20%', wht: 0, wk: 3000, st: 3800, rent: 60, mw: '全国生活賃金 約12.71ポンド/時（2026年4月）',
    laws: [['贈収賄法（Bribery Act）', '贈賄の防止の手続を怠った会社も処罰される', '会社の罰金は上限なし'], ['現代奴隷法', '売上3,600万ポンド以上は、強制労働の防止の声明を毎年公表', '命令と評判の低下'], ['英国GDPR', '個人データの保護', '最大1,750万ポンドまたは全世界の売上高の4%']],
    risk: 'EU離脱の後の手続の費用、物価と人件費の上昇' },
  de: { n: 'ドイツ', reg: 'eu', x: 6, y: 0, cur: 'eur', cit: 30, vat: 'VAT19%', wht: 0, wk: 4000, st: 4500, rent: 40, mw: '2026年 13.90ユーロ/時（2027年は14.60ユーロの予定）',
    laws: [['サプライチェーン注意義務法（LkSG）', '従業員1,000人以上は、取引先の人権・環境のリスクを調べる', '最大800万ユーロまたは売上高の2%'], ['事業所委員会（共同決定）', '従業員5人以上で設置でき、人事・労働時間・解雇に共同決定権', '無視した解雇は無効'], ['GDPR（EU一般データ保護規則）', '個人データの保護', '最大2,000万ユーロまたは全世界の売上高の4%']],
    risk: 'エネルギー価格と産業の競争力、労務の硬直性、手続の遅さ' },
  fr: { n: 'フランス', reg: 'eu', x: 5, y: 1, cur: 'eur', cit: 25.8, vat: 'TVA20%', wht: 0, wk: 3200, st: 3800, rent: 60, mw: 'SMIC 約12.02ユーロ/時（2026年1月）',
    laws: [['サパンⅡ法', '従業員500人超かつ売上1億ユーロ超は、腐敗防止のプログラムが義務', '会社に最大100万ユーロ'], ['注意義務法', '親会社に人権・環境のデューデリジェンスの義務', '損害賠償の責任'], ['GDPR（EU一般データ保護規則）', '個人データの保護（CNILの制裁）', '最大2,000万ユーロまたは全世界の売上高の4%']],
    risk: 'ストライキ、解雇規制の厳しさ、財政と政治の不安定' },
  cn: { n: '中国', reg: 'asia', x: 9, y: 1, cur: 'usd', cit: 25, vat: '増値税13%（業種で9%・6%）', wht: 10, wk: 1000, st: 1250, rent: 42, mw: '上海 月2,740元（2025年7月）',
    laws: [['外商投資法', 'ネガティブリスト方式で外資の参入を規制。国家安全審査', '投資の停止・撤回の命令'], ['個人情報保護法・データ安全法', 'データを国外に移すには、安全評価・標準契約・認証のどれか', '最大5,000万元または前年の売上高の5%'], ['反スパイ法（2023年改正）', '資料の持ち出しや調査の活動に注意', '社員の拘束のおそれ'], ['労働契約法', '経済補償金（勤続1年につき1か月分）、無固定期間の契約', '違法な解雇は2倍の賠償']],
    risk: '米中の対立と輸出管理、反スパイ法、不動産と内需の低迷' },
  hk: { n: '香港', reg: 'asia', x: 9, y: 2, cur: 'usd', cit: 16.5, vat: 'なし', wht: 0, wk: 2000, st: 2900, rent: 100, mw: '42.1香港ドル/時（2025年5月）',
    laws: [['国家安全維持法・国安条例', 'データ・資金の扱いに注意', '刑事罰'], ['汚職防止条例（POBO）', '民間の贈収賄も処罰', '最高で禁錮10年'], ['雇用条例・強制積立金（MPF）', '退職年金の積立の義務', '罰金']],
    risk: '地政学・制裁のリスク、地価と賃料の高さ' },
  tw: { n: '台湾', reg: 'asia', x: 10, y: 2, cur: 'usd', cit: 20, vat: '営業税5%', wht: 10, wk: 1200, st: 1450, rent: 30, mw: '2026年 月29,500台湾ドル・時給190台湾ドル',
    laws: [['外国人投資条例', '半導体などの分野は投資審査', '投資の取消し'], ['労働基準法', '退職金（新制度は月給の6%以上を積み立てる）と法定労働時間', '罰金と公表'], ['輸出管理（先端半導体）', '機微な技術の管理', '罰金と刑事罰']],
    risk: '台湾海峡の地政学リスク、電力の安定、地震' },
  kr: { n: '韓国', reg: 'asia', x: 10, y: 1, cur: 'usd', cit: 26.4, vat: 'VAT10%', wht: 5, wk: 2800, st: 3300, rent: 35, mw: '2026年 時給10,320ウォン',
    laws: [['重大災害処罰法', '死亡災害で経営責任者に1年以上の懲役または10億ウォン以下の罰金', '経営者個人の刑事責任'], ['勤労基準法（週52時間）', '労働時間の上限と退職金', '罰金と懲役'], ['個人情報保護法', '個人データの保護', '売上高の最大3%']],
    risk: '労働組合の強さ、北朝鮮のリスク、ウォンの変動' },
  sg: { n: 'シンガポール', reg: 'asia', x: 9, y: 4, cur: 'usd', cit: 17, vat: 'GST9%', wht: 0, wk: 1800, st: 2900, rent: 80, mw: '法定の最低賃金はない（業種別の累進賃金モデル）',
    laws: [['個人情報保護法（PDPA）', '個人データの保護とデータ保護責任者', '最大100万シンガポールドルまたは国内の売上高の10%'], ['雇用法・外国人雇用法', '就労ビザ（EP）の点数制（COMPASS）', '罰金と雇用の停止'], ['腐敗行為防止法（PCA）', '贈収賄の禁止', '罰金10万シンガポールドル以下または禁錮5年']],
    risk: '賃料と人件費の高さ、地域統括拠点としての競争' },
  th: { n: 'タイ', reg: 'asia', x: 8, y: 3, cur: 'usd', cit: 20, vat: 'VAT7%', wht: 10, wk: 500, st: 800, rent: 25, mw: '日額337〜400バーツ（地域で違う）',
    laws: [['外国人事業法', '外資は原則49%まで。投資委員会（BOI）の認可で外資100%も可', '罰金と事業の停止'], ['BOIの恩典', '法人税の免除（最長8年）・機械の輸入関税の免除', '条件を守らないと恩典の取消し'], ['労働者保護法', '解雇の補償金（勤続に応じて最大400日分）', '補償金の支払い']],
    risk: '政情の不安定、最低賃金の上昇、洪水' },
  vn: { n: 'ベトナム', reg: 'asia', x: 9, y: 3, cur: 'usd', cit: 20, vat: 'VAT10%（2026年末まで8%の軽減）', wht: 0, wk: 340, st: 580, rent: 50, mw: '第1地域 月5,310,000ドン（2026年1月から）',
    laws: [['労働法・外国人の労働許可', '駐在員には労働許可（ワークパーミット）が要る', '無許可の雇用は罰金と国外退去'], ['投資法・企業法', '条件つきの事業分野（外資の出資の上限）', '投資登録の取消し'], ['サイバーセキュリティ法・個人データ保護法（2026年施行）', 'データの国内保存', '罰金'], ['社会保険', '会社の負担は賃金の約21.5%', '追徴と罰金']],
    risk: '賃金の上昇、行政手続の遅さ、電力不足、離職率の高さ' },
  id: { n: 'インドネシア', reg: 'asia', x: 10, y: 4, cur: 'usd', cit: 22, vat: 'VAT12%（実質11%）', wht: 10, wk: 400, st: 600, rent: 22, mw: 'ジャカルタ 月5,726,876ルピア（2026年）',
    laws: [['投資のポジティブリスト', '外資の事業分野と出資の上限', '事業許可の取消し'], ['雇用創出法（オムニバス法）', '非正規雇用と解雇の補償の見直し（再整備中）', '補償金の支払い'], ['個人データ保護法', '個人データの保護', '最大で売上高の2%']],
    risk: '政策の予見しにくさ、規制の変更、労働組合のデモ、為替' },
  ph: { n: 'フィリピン', reg: 'asia', x: 10, y: 3, cur: 'usd', cit: 25, vat: 'VAT12%', wht: 10, wk: 350, st: 580, rent: 28, mw: 'マニラ首都圏 日額780ペソ（2026年7月から）',
    laws: [['外国投資ネガティブリスト', '小売・メディアなどで外資を制限', '事業の停止'], ['CREATE MORE法（経済特区）', '経済特区の企業は法人税5%などの優遇', '条件違反で優遇の取消し'], ['労働法', '13か月目の給与の支払い、違法な解雇は復職とバックペイ', '支払い命令']],
    risk: '台風などの自然災害、インフラ、南シナ海の地政学' },
  my: { n: 'マレーシア', reg: 'asia', x: 8, y: 4, cur: 'usd', cit: 24, vat: '売上税5〜10%・サービス税6〜8%', wht: 0, wk: 580, st: 1050, rent: 20, mw: '月1,700リンギット（2025年2月から）',
    laws: [['ブミプトラ政策', '業種によって現地資本の比率を求められる', '許認可の制限'], ['雇用法（2022年改正）', '週45時間', '罰金'], ['腐敗防止法 17A条', '会社の腐敗の責任（防止の手続の有無）', '賄賂の額の10倍以上または100万リンギット以上の罰金']],
    risk: '外国人労働者に頼る人手不足、政策の変動、為替' },
  in: { n: 'インド', reg: 'sa', x: 8, y: 2, cur: 'usd', cit: 25.17, vat: 'GST 5%・18%の2段階（2025年の改革）', wht: 10, wk: 280, st: 580, rent: 25, mw: '州・業種ごとに違う',
    laws: [['会社法のCSR義務', '純利益（3年平均）の2%をCSRに使う（純資産50億ルピー以上・売上100億ルピー以上・純利益5億ルピー以上のどれか）', '未使用分の基金への拠出と罰金'], ['労働法典（4法典・2025年11月施行）', '基本給を総報酬の50%以上に。解雇・閉鎖の許可は300人以上', '罰金と刑事罰'], ['デジタル個人データ保護法（DPDP）', '個人データの保護', '最大2,500億ルピー']],
    risk: '州ごとの規制の違い、土地の取得と行政の遅れ、遡っての税務調査' },
  ae: { n: 'アラブ首長国連邦', reg: 'me', x: 7, y: 2, cur: 'usd', cit: 9, vat: 'VAT5%', wht: 0, wk: 800, st: 1850, rent: 80, mw: '法定の最低賃金はない',
    laws: [['法人税法（2023年導入）', '課税所得37.5万ディルハム超に9%。大きな多国籍企業には国内ミニマム課税15%（2025年）', '罰金'], ['エミラティゼーション', '従業員50人以上は、UAE国民の雇用比率を毎年引き上げる', '不足1人あたりの拠出金'], ['資金洗浄対策・経済実体規制', '実体のある事業の報告', '罰金と許認可の停止']],
    risk: '中東の地政学リスク、夏の猛暑による労働時間の制限、就労ビザ' },
  au: { n: 'オーストラリア', reg: 'oc', x: 11, y: 5, cur: 'usd', cit: 30, vat: 'GST10%', wht: 0, wk: 3800, st: 4600, rent: 100, mw: '全国最低賃金 24.95豪ドル/時（2025年7月。毎年7月に改定）',
    laws: [['現代奴隷法', '年間売上1億豪ドル以上は、強制労働の防止の声明を提出', '公表と評判の低下'], ['公正労働法（Fair Work Act）', '最低賃金・産業別協約（アワード）・不当解雇', '罰金と未払い賃金の支払い'], ['プライバシー法（2024年改正）', '個人データの保護', '重大な違反は最大5,000万豪ドル']],
    risk: '資源価格と中国向け貿易への依存、人件費の高さ' },
};
const KS_REG_COUNTRY_DEFAULT = { asia: 'cn', na: 'us', eu: 'de', sw: 'in' };
const KS_REGION_OF = { na: 'na', la: 'na', eu: 'eu', asia: 'asia', sa: 'sw', me: 'sw', oc: 'asia' };

/* ---------- 所在地 ---------- */
const KS_HOME_PREF = 22; // 何も選ばないときの本社（汐見市は静岡県の港町という設定）
function ksMapInit(o = {}) {
  if (G.loc) return;
  const hq = +(o.pref || KS_HOME_PREF);
  G.loc = { hq: KS_PREFS[hq] ? hq : KS_HOME_PREF, units: {}, lands: [], seq: 0, eqIns: false, mwIdx: 1, idx: {}, dis: [], cc: o.cc || 'jp', intlCC: {} };
  G.loc.home = G.loc.hq; // 事業の採算（キャリブレーション）の基準の所在地
  for (const u of ksActiveUnits()) G.loc.units[u.id] = G.loc.hq;
  // 以前の版のセーブデータ：最低賃金とパートの時間はそのまま（本社の都道府県の額を今の最低賃金に合わせる）
  if (o.load && G.law && G.law.minWage) { G.loc.mwIdx = G.law.minWage / KS_PREFS[G.loc.hq].mw; return; }
  // パートの時給を、所在地の最低賃金に合わせて決めなおす（就任のときに1割強ほど上）
  if (G.law) for (const u of ksActiveUnits()) {
    if (!u.partH) continue;
    const mw = ksMinWageOf(u);
    for (const r of ksS(u).roles) if (u.partH[r.id]) u.partH[r.id] = clamp(Math.round(r.wage * G.eco.wageIdx / (mw * uni2(1.09, 1.15))), 40, 130);
  }
  if (G.law) G.law.minWage = ksMinWageOf(null);
}
function ksUnitPref(u) { return (G.loc && u && G.loc.units[u.id]) || (G.loc ? G.loc.hq : KS_HOME_PREF); }
function ksPrefName(p) { return KS_PREFS[p] ? KS_PREFS[p].n : ''; }
/* 最低賃金（令和8年度の額に、その後の改定の倍率を掛ける） */
function ksMinWageOf(u) {
  if (!G.loc) return G.law ? G.law.minWage : KS_MINWAGE_START;
  const p = u ? ksUnitPref(u) : G.loc.hq;
  return Math.round(KS_PREFS[p].mw * (G.loc.mwIdx || 1));
}
/* 事業を新しく加えたとき（本社と同じ都道府県に置く） */
function ksMapAddUnit(u, pref) { if (!G.loc) return; G.loc.units[u.id] = +(pref || G.loc.hq); }
/* 地価（今の1㎡あたり） */
function ksLandPrice(p, use) {
  const P = KS_PREFS[p];
  const idx = (G.loc && G.loc.idx[p] && G.loc.idx[p][use]) || 1;
  return Math.round(P.land[use] * idx * (G.eco.priceIdx ? Math.pow(G.eco.priceIdx / 0.95, 0.5) : 1));
}
/* 土地の取得の費用：仲介手数料（3%＋6万円）は土地の取得価額に含め、登録免許税（評価額の1.5%）・
   不動産取得税（宅地は評価額の1/2に3%）は租税公課。評価額は時価のおよそ7割 */
function ksLandQuote(p, use, area) {
  const price = Math.round(ksLandPrice(p, use) * area / 1e4) * 1e4;
  const broker = Math.round((price * 0.03 + 6e4) * 1.1 / 1e3) * 1e3;
  const assess = price * 0.7;
  const reg = Math.round(assess * (G.m <= 35 ? 0.015 : 0.02) / 100) * 100;
  const acq = Math.round(assess * 0.5 * 0.03 / 100) * 100;
  const yearTax = Math.round(assess * 0.7 * (0.014 + (KS_PREFS[p].city ? 0.003 : 0.002)) / 100) * 100;
  return { price, broker, reg, acq, cost: price + broker, taxes: reg + acq, total: price + broker + reg + acq, yearTax, assess: Math.round(assess) };
}
function ksBuyLand(p, use, area) {
  const q = ksLandQuote(p, use, area);
  if (ksB('cash') < q.total) return { ok: false, why: '現預金が足りません' };
  const a = ksNewAsset({ n: `土地（${ksPrefName(p)}・${KS_LAND_USE[use]}${fmtNum(area, 0)}㎡）`, acct: 'land', cost: q.cost, life: 0, part: 'S', u: 'HQ' });
  ksPost('landBuy', [['land', q.cost, 0], ['cash', 0, q.cost]], { u: 'HQ', cf: 'capex', desc: `土地の購入（${ksPrefName(p)}・${fmtNum(area, 0)}㎡。仲介手数料を含む）` });
  ksPost('landTax', [['dues', q.taxes, 0], ['cash', 0, q.taxes]], { u: 'HQ', cf: 'exp', desc: '登録免許税と不動産取得税（租税公課）' });
  const L = { id: 'D' + (++G.loc.seq), pref: +p, use, area, cost: q.cost, m: G.m, asset: a.id, bldg: null };
  G.loc.lands.push(L);
  ksNews(`${ksPrefName(p)}の${KS_LAND_USE[use]}${fmtNum(area, 0)}㎡を${fmtYen(q.price)}で買いました（仲介手数料 ${fmtYen(q.broker)}・登録免許税と不動産取得税 ${fmtYen(q.taxes)}）`, 'good');
  return { ok: true, land: L, q };
}
function ksLandValue(L) { return Math.round(ksLandPrice(L.pref, L.use) * L.area); }
function ksBldgQuote(L, kind) {
  const K = KS_BLDG_KIND[kind];
  const floor = Math.round(L.area * K.far);
  const cost = Math.round(floor * K.cost * (G.eco.priceIdx ? G.eco.priceIdx / 0.95 : 1) / 1e5) * 1e5;
  const assess = cost * 0.6;
  const taxes = Math.round((assess * 0.004 + assess * 0.04) / 100) * 100; // 保存登記の登録免許税0.4%・不動産取得税4%
  return { floor, cost, taxes, life: K.life, lead: K.lead, yearTax: Math.round(assess * 0.017 / 100) * 100 };
}
/* 建物を建てる。uid を指定すると、その事業の施設になり、家賃（賃借の費用）が減る */
function ksBuildOnLand(landId, kind, uid) {
  const L = G.loc.lands.find(x => x.id === landId);
  if (!L || L.bldg) return { ok: false, why: '建てられる土地がありません' };
  const K = KS_BLDG_KIND[kind];
  if (!KS_ZONE[L.use].ok.includes(kind)) return { ok: false, why: `${KS_ZONE[L.use].n}には${K.n}を建てられません（都市計画法・建築基準法の用途地域）` };
  const q = ksBldgQuote(L, kind);
  if (ksB('cash') < q.cost + q.taxes) return { ok: false, why: '現預金が足りません' };
  const a = ksBuyAsset({ n: `${K.n}（${ksPrefName(L.pref)}）`, acct: 'bldg', cost: q.cost, life: K.life, part: kind === 'factory' ? 'C' : 'S', u: uid && ksUnit(uid) ? uid : 'HQ', openM: G.m + q.lead });
  ksPost('bldgTax', [['dues', q.taxes, 0], ['cash', 0, q.taxes]], { u: 'HQ', cf: 'exp', desc: '建物の登録免許税と不動産取得税（租税公課）' });
  L.bldg = { kind, asset: a.id, uid: uid || null, openM: G.m + q.lead, floor: q.floor, cost: q.cost };
  if (uid) G.loc.units[uid] = L.pref;
  if (kind === 'hq') G.loc.hq = L.pref;
  ksNews(`${ksPrefName(L.pref)}の土地に${K.n}（延床${fmtNum(q.floor, 0)}㎡）の建設を始めました。${ymLabel(G.m + q.lead)}に完成の予定（それまでは建設仮勘定）`, 'good');
  return { ok: true, q };
}
/* 自社の建物で営業している事業の家賃（賃借）の倍率 */
function ksOwnSiteF(u) {
  if (!G.loc || !u) return 1;
  return G.loc.lands.some(L => L.bldg && L.bldg.uid === u.id && L.bldg.openM <= G.m) ? 0.15 : 1;
}
function ksSellLand(landId) {
  const L = G.loc.lands.find(x => x.id === landId);
  if (!L) return { ok: false };
  const price = Math.round(ksLandValue(L) * 0.97 / 1e4) * 1e4;
  const a = G.assets.find(x => x.id === L.asset);
  let gain = 0;
  if (L.bldg) {
    const b = G.assets.find(x => x.id === L.bldg.asset);
    if (b && b.soldM === undefined) { const bp = Math.round(Math.max(0, b.cost - b.booked) * 0.85 / 1e4) * 1e4; gain += ksSellAsset(b, bp); }
  }
  if (a && a.soldM === undefined) gain += ksSellAsset(a, price);
  G.loc.lands = G.loc.lands.filter(x => x !== L);
  ksNews(`${ksPrefName(L.pref)}の土地${L.bldg ? 'と建物' : ''}を売りました（土地 ${fmtYen(price)}・売却損益 ${fmtYen(gain)}）`, gain >= 0 ? 'good' : 'bad');
  return { ok: true, price, gain };
}

/* ---------- 毎月 ---------- */
const KS_DIS = {
  eq: { n: '地震', p: [0, 0.0004, 0.0008, 0.0016], dmg: [0.05, 0.25], stop: [0.55, 0.85], months: 3, ins: 'eq' },
  ty: { n: '台風', p: [0, 0.0015, 0.003, 0.006], season: [7, 8, 9, 10], dmg: [0.01, 0.06], stop: [0.85, 0.95], months: 1, ins: 'fire' },
  fl: { n: '豪雨・水害', p: [0, 0.0012, 0.0025, 0.005], season: [6, 7, 8, 9], dmg: [0.02, 0.1], stop: [0.75, 0.92], months: 2, ins: 'fire' },
  sn: { n: '大雪', p: [0, 0.002, 0.004, 0.008], season: [12, 1, 2], dmg: [0.003, 0.02], stop: [0.9, 0.97], months: 1, ins: 'fire' },
};
function ksMapMonth(ctx) {
  const Lc = G.loc;
  const mo = ctx.mo;
  ksMapInsMonth();
  // 最低賃金の改定（10月）は法令の画面で（ksMinWageRevise）
  // 地価の変動（7月1日の地価調査）
  if (mo === 7) for (const p of Object.keys(KS_PREFS)) {
    const P = KS_PREFS[p];
    const x = Lc.idx[p] || (Lc.idx[p] = { res: 1, com: 1, ind: 1 });
    const t = P.trend / 100;
    const n = uni2(-0.01, 0.01);
    x.res *= 1 + t + n; x.com *= 1 + t * 1.8 + 0.012 + n; x.ind *= 1 + t + 0.02 + n;
  }
  // 固定資産税・都市計画税（買った土地と建てた建物。6・9・12・2月の4回）
  if ([6, 9, 12, 2].includes(mo) && Lc.lands.length) {
    let tax = 0;
    for (const L of Lc.lands) {
      tax += ksLandQuote(L.pref, L.use, L.area).yearTax;
      if (L.bldg && L.bldg.openM <= G.m) tax += ksBldgQuote(L, L.bldg.kind).yearTax;
    }
    tax = Math.round(tax / 4 / 100) * 100;
    if (tax > 0) ksPost('propTax', [['dues', tax, 0], ['cash', 0, tax]], { u: 'HQ', cf: 'exp', desc: '固定資産税・都市計画税（4期に分けて納付）' });
  }
  // 地震保険（地震危険補償特約）の保険料
  if (Lc.eqIns) {
    const v = sum(ksActiveAssets().filter(a => ['bldg', 'mach', 'equip'].includes(a.acct)), a => a.cost - a.booked);
    const prem = Math.round(v * 0.0012 / 12 / 100) * 100;
    if (prem > 0) ksPost('eqIns', [['insur', prem, 0], ['cash', 0, prem]], { u: 'HQ', cf: 'exp', desc: '地震保険（地震危険補償特約）の保険料' });
  }
  // 自然災害（事業所のある都道府県ごと）
  if (G.isSub && G.country && G.country !== 'jp') return;
  const prefs = [...new Set([Lc.hq, ...ksActiveUnits().map(ksUnitPref)])];
  for (const p of prefs) {
    const P = KS_PREFS[p];
    for (const [k, D] of Object.entries(KS_DIS)) {
      if (D.season && !D.season.includes(mo)) continue;
      const lvl = P.risk[k];
      if (!lvl || !chance2(D.p[lvl])) continue;
      ksMapDisaster(p, k);
    }
  }
  Lc.stops = (Lc.stops || []).filter(x => x.until > G.m);
}
function ksMapDisaster(p, k) {
  const D = KS_DIS[k], Lc = G.loc;
  const us = ksActiveUnits().filter(u => ksUnitPref(u) === +p);
  const assets = ksActiveAssets().filter(a => ['bldg', 'mach', 'equip', 'veh'].includes(a.acct) && (us.some(u => u.id === a.u) || ((!a.u || a.u === 'HQ') && +p === Lc.hq)));
  const base = sum(assets, a => a.cost - a.booked) + sum(us, u => sum(KS_ENGINE[ksS(u).eng].stockCount(u) || [], it => it.book));
  const bcp = typeof ksHrF === 'function' ? ksHrF(null, 'bcp') : 1;
  const loss = Math.round(Math.max(base * uni2(D.dmg[0], D.dmg[1]) * bcp, 50e4) / 1e4) * 1e4;
  ksPost('disaster', [['disaster', loss, 0], ['cash', 0, loss]], { u: 'HQ', cf: 'other', desc: `${ksPrefName(p)}の${D.n}の被害の復旧` });
  let ins = 0;
  if (D.ins === 'eq' && Lc.eqIns) ins = Math.round(loss * 0.5 / 1e4) * 1e4;
  if (D.ins === 'fire' && G.law && G.law.policy.fireIns) ins = Math.round(loss * 0.7 / 1e4) * 1e4;
  if (ins > 0) { G.loc.insQ = G.loc.insQ || []; G.loc.insQ.push({ m: G.m + 2, amt: ins, n: D.n }); }
  const stop = uni2(D.stop[0], D.stop[1]);
  const until = G.m + D.months;
  Lc.stops = Lc.stops || [];
  for (const u of us) Lc.stops.push({ u: u.id, f: 1 - (1 - stop) * bcp, until });
  Lc.dis.unshift({ m: G.m, pref: +p, k, loss, ins });
  if (Lc.dis.length > 30) Lc.dis.length = 30;
  if (G.isSub) return;
  ksNews(`【災害】${ksPrefName(p)}で${D.n}。${us.length ? `${us.map(ksUName).join('・')}の営業に影響し、` : ''}建物・設備の復旧に${fmtYen(loss)}かかりました（災害による損失：特別損失）。${ins ? `保険金${fmtYen(ins)}が2か月後に入ります（受取保険金：特別利益）` : D.ins === 'eq' ? '火災保険では地震の損害は補償されません（地震危険補償特約が必要）' : '保険に入っていないので、補償はありません'}`, 'bad');
  if (typeof G.pendingModals !== 'undefined') G.pendingModals.push({ type: 'kDisaster', pref: +p, k, loss, ins });
}
/* 保険金の入金 */
function ksMapInsMonth() {
  const q = (G.loc && G.loc.insQ) || [];
  for (const x of q.filter(y => y.m <= G.m)) {
    ksPost('insRecv', [['cash', x.amt, 0], ['insRecv', 0, x.amt]], { u: 'HQ', cf: 'other', desc: `${x.n}の被害の保険金` });
    ksNews(`${x.n}の被害の保険金${fmtYen(x.amt)}が入金されました（受取保険金：特別利益）`, 'good');
  }
  if (G.loc) G.loc.insQ = q.filter(y => y.m > G.m);
}
/* 災害で営業が止まっている事業の需要の倍率 */
function ksMapDemandF(u) {
  if (!G.loc || !u) return 1;
  let f = ksLocF(u, 'demand');
  if (!G.loc.stops) return f;
  for (const x of G.loc.stops) if (x.u === u.id && x.until > G.m) f *= x.f;
  return f;
}
/* 最低賃金の改定（10月）：都道府県ごとの額に、全国の引き上げ率を掛ける */
function ksMinWageRevise() {
  const L = G.law;
  const r = uni(0.035, 0.055);
  G.loc.mwIdx = (G.loc.mwIdx || 1) * (1 + r);
  L.minWage = ksMinWageOf(null);
  if (!ksPartRoles().length || G.isSub) return;
  const gap = ksMinWageGap();
  const prefs = [...new Set(ksPartRoles().map(x => ksUnitPref(x.u)))];
  ksNews(`最低賃金が改定されました（${prefs.map(p => `${ksPrefName(p)} 時給${Math.round(KS_PREFS[p].mw * G.loc.mwIdx)}円`).join('・')}。全国の平均で${fmtNum(r * 100, 1)}%の引き上げ）。${gap > 0 ? 'パート・アルバイトの時給が下回っている事業があります。引き上げが必要です' : 'パート・アルバイトの時給は上回っています'}`, gap > 0 ? 'bad' : 'info');
}
/* 最低賃金の判定を、事業所の都道府県ごとに */
ksMinWageGap = function () {
  let gap = -99;
  for (const x of ksPartRoles()) gap = Math.max(gap, ksMinWageOf(x.u) - ksPartHourly(x));
  return gap;
};
ksRaisePartWage = function () {
  for (const x of ksPartRoles()) {
    const mw = ksMinWageOf(x.u), h = ksPartHourly(x);
    if (h < mw + 10) x.u.partAdj = (x.u.partAdj || 1) * (mw + 10) / h;
  }
  G.law.done.minwage = G.m;
  ksLawFixFindings('minwage');
};
/* 家賃：自社の建物で営業している事業は、賃借の費用が減る */
const ksPayRent0 = ksPayRent;
ksPayRent = function (u, amt) { return ksPayRent0(u, amt * ksOwnSiteF(u) * ksLocF(u, 'rent')); };

/* ---------- 所在地による賃金・家賃・需要の違い ----------
   事業の採算は、就任のとき（子会社は設立のとき）の本社の都道府県（G.loc.home）を基準に合わせてある。
   ほかの都道府県に置いた事業は、賃金の水準・商業地の地価（家賃）・お客さまの所得と人の多さで、費用と需要が変わる。
   海外の子会社は、その国の賃金の水準（日本との比）で人件費が変わる */
const KS_PREF_AVG = (() => { let w = 0, p = 0, c = 0; for (const P of Object.values(KS_PREFS)) { w += P.wage * P.pop; c += Math.log(P.land.com) * P.pop; p += P.pop; } return { wage: w / p, com: Math.exp(c / p) }; })();
const KS_JP_WAGE_USD = 2550; // 日本の月給の目安（米ドル）
function ksCountryWageR(cc) { const C = KS_COUNTRIES[cc]; return C ? (C.wk + C.st) / 2 / KS_JP_WAGE_USD : 1; }
function ksLocF(u, key) {
  if (!G || !G.loc || !u || !G.loc.units[u.id]) return 1;
  const eng = ksS(u).eng;
  if (G.country && G.country !== 'jp') {
    const r = ksCountryWageR(G.country);
    if (key === 'wage') return Math.pow(r, 0.35);
    if (key === 'demand') return ['shop', 'rest'].includes(eng) ? Math.pow(r, 0.3) : 1;
    return 1;
  }
  const P = KS_PREFS[G.loc.units[u.id]], R = KS_PREFS[(G.loc.uhome && G.loc.uhome[u.id]) || G.loc.home || G.loc.hq];
  if (!P || !R || P === R) return 1;
  if (key === 'wage') return Math.pow(P.wage / R.wage, 0.7);
  if (key === 'rent') return Math.pow(P.land.com / R.land.com, 0.2);
  if (key === 'demand') return ['shop', 'rest'].includes(eng) ? Math.pow(P.wage / R.wage, 0.7) * Math.pow(P.land.com / R.land.com, 0.05) : 1;
  return 1;
}
/* 人件費：所在地の賃金の水準を掛ける */
const ksRoleWageM0 = ksRoleWage;
ksRoleWage = function (r, u) { const w = ksRoleWageM0(r, u); return u && G && G.loc ? w * ksLocF(u, 'wage') : w; };
/* 都道府県の比べやすい数字（基準の所在地と比べた倍率） */
function ksPrefCompare(p) {
  const P = KS_PREFS[p], R = KS_PREFS[(G.loc && (G.loc.home || G.loc.hq)) || KS_HOME_PREF];
  return { wage: Math.pow(P.wage / R.wage, 0.7), rent: Math.pow(P.land.com / R.land.com, 0.2), demand: Math.pow(P.wage / R.wage, 0.7) * Math.pow(P.land.com / R.land.com, 0.05) };
}

/* ---------- 本社・事業所を移す ---------- */
function ksUnitBldgs(u) { return ksUA(u).filter(a => a.acct === 'bldg' && !a.cip); }
/* 事業所の移転の見込み。自社の建物（店舗・工場・施設）は、前の場所で中古として売り（帳簿の価額の3割ほど）、
   移した先で新しく建てる（もとの取得価額の6割ほど。設備の更新を含む） */
function ksMoveUnitQuote(u, p) {
  if (!u || u.closedM) return { ok: false, why: '事業がありません' };
  if (!KS_PREFS[p]) return { ok: false, why: '移す先を選んでください' };
  if (ksUnitPref(u) === +p) return { ok: false, why: 'すでにこの都道府県にあります' };
  if (ksUA(u).some(a => a.cip)) return { ok: false, why: '建設中の設備がある事業は、完成してから移します' };
  if (G.loc.lands.some(L => L.bldg && L.bldg.uid === u.id)) return { ok: false, why: '自社の土地の建物で営業している事業は、土地と建物を売ってから移します' };
  const book = sum(ksUA(u).filter(a => ['mach', 'equip', 'veh'].includes(a.acct)), a => a.cost - a.booked);
  const head = ksUnitHead(u);
  const move = Math.round((book * 0.05 + 30e4) / 1e4) * 1e4; // 設備の移設・運搬
  const people = Math.round(head * 25e4 / 1e4) * 1e4; // 転勤の手当・引っ越しの費用と、辞めた人の分の採用
  const restore = Math.round((ksUnitSales12(u) * 0.004 + 50e4) / 1e4) * 1e4; // 前の場所の原状回復と、新しい場所の内装
  const B = ksUnitBldgs(u);
  const bBook = sum(B, a => a.cost - a.booked);
  const bSale = Math.round(bBook * 0.3 / 1e4) * 1e4;
  const bNew = Math.round(sum(B, a => a.cost) * 0.6 * clamp((G.eco.priceIdx || 0.95) / 0.95, 0.9, 1.4) / 1e5) * 1e5;
  const C = ksPrefCompare(p), C0 = ksPrefCompare(ksUnitPref(u));
  const exp = move + people + restore;
  return { ok: true, move, people, restore, exp, bBook, bSale, bLoss: bBook - bSale, bNew, nB: B.length, total: exp + bNew - bSale, head, wage: C.wage / C0.wage, rent: C.rent / C0.rent, demand: ['shop', 'rest'].includes(ksS(u).eng) ? C.demand / C0.demand : 1, mw: Math.round(KS_PREFS[p].mw * (G.loc.mwIdx || 1)) };
}
function ksMoveUnit(uid, p) {
  const u = ksUnit(uid);
  const q = ksMoveUnitQuote(u, +p);
  if (!q.ok) return q;
  if (ksB('cash') < q.total + 1e6) return { ok: false, why: '現預金が足りません' };
  const from = ksUnitPref(u);
  ksPost('moveUnit', [['moveExp', q.exp, 0], ['cash', 0, q.exp]], { u: u.id, cf: 'other', desc: `${ksUName(u)}の移転（${ksPrefName(from)}→${ksPrefName(p)}）` });
  // 前の場所の建物を売り、移した先に建てる
  const B = ksUnitBldgs(u);
  if (B.length) {
    const tot = sum(B, a => a.cost - a.booked) || 1;
    const life = Math.round(sum(B, a => a.life * a.cost) / Math.max(1, sum(B, a => a.cost))) || 30;
    const part = B[0].part || 'S';
    G.curU = u.id;
    let left = q.bSale;
    B.forEach((a, i) => { const pr = i === B.length - 1 ? left : Math.round(q.bSale * (a.cost - a.booked) / tot / 1e4) * 1e4; left -= pr; ksSellAsset(a, Math.max(0, pr)); });
    if (q.bNew > 0) ksBuyAsset({ n: `${ksUName(u)}の建物（${ksPrefName(p)}）`, acct: 'bldg', cost: q.bNew, life, part, u: u.id });
    G.curU = null;
  }
  G.loc.units[u.id] = +p;
  // 移転の月は営業が落ちる
  G.loc.stops = G.loc.stops || [];
  G.loc.stops.push({ u: u.id, f: 0.6, until: G.m + 1 });
  // パート・アルバイトの時給を、移した先の最低賃金より下げない
  if (G.law && typeof ksPartRoles === 'function') for (const x of ksPartRoles().filter(y => y.u === u)) { const mw = ksMinWageOf(u), h = ksPartHourly(x); if (h < mw + 10) u.partAdj = (u.partAdj || 1) * (mw + 10) / h; }
  if (G.hr) { G.hr.esTmp = (G.hr.esTmp || []).filter(x => x.until > G.m); G.hr.esTmp.push({ n: `${ksUName(u)}の移転`, v: -Math.round(Math.min(6, 1 + q.head / Math.max(1, ksHeadcount()) * 10) * 10) / 10, until: G.m + 6 }); }
  if (!G.isSub) ksNews(`${ksUName(u)}を${ksPrefName(from)}から${ksPrefName(p)}に移しました（移転の費用 ${fmtYen(q.exp)}：特別損失${q.nB ? `。前の建物を${fmtYen(q.bSale)}で売り（売却損 ${fmtYen(q.bLoss)}）、移した先に${fmtYen(q.bNew)}で建てました` : ''}）。事業所の移転の届出（労働基準監督署・ハローワーク・年金事務所・税務署）も出します`, 'info');
  return { ok: true, q };
}
function ksMoveHQQuote(p) {
  if (!KS_PREFS[p]) return { ok: false, why: '移す先を選んでください' };
  if (G.loc.hq === +p) return { ok: false, why: 'すでに本社があります' };
  const staff = G.group && G.group.hd && G.group.hq ? G.group.hq.staff : Math.max(3, Math.round(ksHeadcount() * 0.06));
  const reg = 6e4; // 本店移転の登記（管轄の外への移転：旧所在地と新所在地で3万円ずつ）
  const fee = 8e4; // 司法書士の報酬・定款の変更
  const move = Math.round((150e4 + staff * 25e4) / 1e4) * 1e4;
  return { ok: true, reg, fee, move, staff, total: reg + fee + move };
}
function ksMoveHQ(p) {
  const q = ksMoveHQQuote(+p);
  if (!q.ok) return q;
  if (ksB('cash') < q.total) return { ok: false, why: '現預金が足りません' };
  const from = G.loc.hq;
  ksPost('moveHQ', [['moveExp', q.move, 0], ['dues', q.reg, 0], ['fees', q.fee, 0], ['cash', 0, q.total]], { u: 'HQ', cf: 'other', desc: `本社の移転（${ksPrefName(from)}→${ksPrefName(p)}）・本店移転の登記` });
  G.loc.hq = +p;
  if (G.law) G.law.minWage = ksMinWageOf(null);
  if (G.hr) { G.hr.esTmp = (G.hr.esTmp || []).filter(x => x.until > G.m); G.hr.esTmp.push({ n: '本社の移転', v: -2, until: G.m + 6 }); }
  if (!G.isSub) ksNews(`本社を${ksPrefName(from)}から${ksPrefName(p)}に移しました（費用 ${fmtYen(q.total)}）。2週間以内に本店移転の登記（登録免許税は旧・新の法務局で3万円ずつ）をし、税務署・都道府県・市町村に異動の届出を出します`, 'info');
  return { ok: true, q };
}

/* ---------- 海外展開の国 ---------- */
function ksIntlCountries(r) { return Object.entries(KS_COUNTRIES).filter(([, C]) => KS_REGION_OF[C.reg] === r).map(([cc]) => cc); }
function ksIntlCC(r) { return (G.loc && G.loc.intlCC && G.loc.intlCC[r]) || KS_REG_COUNTRY_DEFAULT[r]; }
const ksIntlRegisterM0 = ksIntlRegister;
ksIntlRegister = function (uid, r) {
  const prev = (G.grow.intl[uid] || {})[r];
  const cc0 = prev && prev.cc;
  const msg = ksIntlRegisterM0(uid, r);
  const x = G.grow.intl[uid][r];
  x.cc = cc0 || ksIntlCC(r);
  const C = KS_COUNTRIES[x.cc];
  return C ? msg.replace(KS_REGIONS[r].n, `${KS_REGIONS[r].n}（${C.n}）`) : msg;
};
/* 海外の拠点（地図に出す）：[{ cc, kind, n, st }] */
function ksForeignSites() {
  const out = [];
  if (G.grow) for (const [uid, it] of Object.entries(G.grow.intl || {})) {
    const u = ksUnit(uid);
    if (!u || u.closedM) continue;
    for (const [r, x] of Object.entries(it)) if (x.st >= 1 && KS_INTL_ST[x.st]) out.push({ cc: x.cc || KS_REG_COUNTRY_DEFAULT[r], kind: 'intl', n: `${ksUName(u)}：${KS_INTL_ST[x.st].n(u)}`, st: x.st, since: x.m });
  }
  if (G.group) for (const s of G.group.subs) if (!s.gone && s.cc && s.cc !== 'jp') out.push({ cc: s.cc, kind: 'sub', n: s.name, st: 4, id: s.id, since: s.since });
  return out;
}
Object.assign(KS_JNOTE, {
  landBuy: ['土地の購入', '土地は減価償却しない固定資産です。仲介手数料は土地の取得価額に含めます。'],
  landTax: ['登録免許税・不動産取得税', '土地の取得のときの税金は租税公課（費用）にできます。'],
  bldgTax: ['建物の登録免許税・不動産取得税', '建物の取得のときの税金は租税公課（費用）にできます。'],
  propTax: ['固定資産税・都市計画税', '1月1日に持つ土地・建物にかかる市町村の税金です。年4回に分けて納め、租税公課（販管費）にします。'],
  eqIns: ['地震保険の保険料', '火災保険では地震・噴火・津波の損害は補償されないので、地震危険補償特約を付けます。'],
  insRecv: ['保険金の受取', '災害の保険金は受取保険金（特別利益）です。災害による損失と同じ期に計上されるとは限りません。'],
  moveUnit: ['事業所の移転', '移転の費用は、大きなものは事務所移転費用（特別損失）にします。'],
  moveHQ: ['本社の移転', '移転の費用は事務所移転費用（特別損失）、登記の登録免許税は租税公課、司法書士の報酬は支払手数料です。'],
  hrPol: ['経営方針・重点実施事項の費用', '取り組みにかかる外部の費用です。'],
  rebate: ['仕入割戻し', '仕入先から受ける割戻しは、仕入高から差し引きます。'],
  disLevy: ['障害者雇用納付金', '法定雇用率に足りない人数1人あたり月5万円。租税公課として費用になります。'],
  disAdj: ['障害者雇用調整金', '法定雇用率を超えて雇用した分の調整金は雑収入です。'],
});
