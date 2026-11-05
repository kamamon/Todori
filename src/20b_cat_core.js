'use strict';
/* =========================================================
 *  20b_cat_core.js : 業種カタログ（最初からあった6業種）
 *   数字は以前の業種ごとのエンジンと同じ。キャリブレーションはしない（calib: false）
 * ========================================================= */
KS_CAT_ADD([
  {
    sec: 'I2', grp: '飲食料品小売業', eng: 'shop', bm: 'ret', icon: '店', season: 'retail', calib: false,
    d: '地域の食品スーパー。客数×客単価で売上が決まる。現金商売で、仕入は掛け。在庫と廃棄ロスの管理がカギ。',
    prod: ['生鮮食品', '日配品', '惣菜', '加工食品'], cust: ['近所の家庭', '単身者'],
    p: { stores: 1, cust: 1250, spend: 1050, gm: 0.255, inv: 12, card: 0.38, rent: 110e4, fit: 8000e4, eqc: 3300e4, dep: 3000e4, staff: [6, 20], wage: [27e4, 10.5e4], util: 62e4, waste: 0.008, eqn: ['冷蔵・冷凍ケース', 'レジ・POSシステム'], rn: ['正社員（店長・売場）', 'パート・アルバイト'] },
    laws: ['haccp'], items: ['食品スーパー'],
  },
  {
    sec: 'M2', grp: '洋食店', eng: 'rest', bm: 'food', icon: '食', season: 'food', calib: false,
    d: '洋食店を2店舗。客数×客単価、食材原価率と人件費（FL比率）、家賃の重さを体験。日銭が入る商売。',
    prod: ['ハンバーグ', 'オムライス', 'ビーフシチュー'], cust: ['家族連れ', '会社員'],
    p: { shops: 2, cust: 132, spend: 1900, fq: 0.31, rent: 85e4, fit: 2350e4, eqc: 850e4, dep: 600e4, staff: [3, 8], wage: [27e4, 8.5e4], days: 26, card: 0.45, eqn: ['厨房機器'], rn: ['正社員（店長・調理）', 'アルバイト（ホール・調理補助）'] },
    laws: ['haccp'], items: ['洋食レストラン'],
  },
  {
    sec: 'E', grp: '金属製品製造業（受託加工）', eng: 'mfg', bm: 'mfg', icon: '工', season: 'mfg', calib: false,
    d: '機械加工の町工場。受注・稼働率・加工賃、製造原価報告書、機械の減価償却と設備資金の借入を体験。',
    prod: ['シャフト', 'フランジ', '精密部品'], cust: ['機械メーカー', '自動車部品メーカー'],
    p: { mode: 'job', price: 6000, mat: 3200, base: 2150, office: 4, wage: 30e4 },
    eq: ['lathe:10'], aux: [], laws: ['machine', 'chem'], items: ['金属部品の切削加工（町工場）'],
  },
  {
    sec: 'D', grp: '住宅建築工事業', eng: 'build', bm: 'con', icon: '建', season: 'con', calib: false,
    d: '住宅やリフォームを請け負う工務店。見積・受注、工事完成基準、未成工事支出金と前受金、つなぎ資金を体験。',
    prod: ['注文住宅', 'リフォーム', '店舗の改装'], cust: ['個人', '地元の企業', '汐見市'],
    p: { proj: ['house:36', 'reform:50', 'shop:11', 'public:3'], inq: 5, margin: 0.22, site: 4, office: 3, wage: [36e4, 28e4], rent: 25e4 },
    eq: [], laws: ['fall', 'kyoka'], items: ['工務店（注文住宅・リフォーム）'],
  },
  {
    sec: 'I', grp: '飲食料品卸売業', eng: 'trade', bm: 'whl', icon: '卸', season: 'whl', calib: false,
    d: 'スーパーや飲食店に食品を卸す。薄い粗利と大きな売上、売掛金と買掛金のバランス、取引先の与信と貸倒れを体験。',
    prod: ['加工食品', '冷凍食品', '調味料'], cust: ['スーパー', '飲食店', '給食センター'],
    p: { gm: 0.125, inv: 18, custN: 31, custSize: 290e4, terms2: 0.4, trucks: 6, staff: [4, 7, 2], rent: 80e4, wh: '冷蔵' },
    laws: ['alcohol'], items: ['業務用食品卸'],
  },
  {
    sec: 'G', grp: '受託開発ソフトウェア業', eng: 'pro', bm: 'it', icon: '情', season: 'it', calib: false,
    d: 'エンジニアの人月で稼ぐ受託開発。稼働率と人月単価、労務費（原価）、採用と離職、自社サービス（ソフトウェア資産）を体験。',
    prod: ['業務システム', 'Webサービス'], cust: ['地元の企業', '自治体'],
    p: { rate: 80e4, wage: 38e4, n: 20, sales: 3, exp: 2e4, sub: true, product: true, rent: 100e4, eqn: ['開発用パソコン'], rn: ['エンジニア', '営業・管理'] },
    laws: ['privacy'], items: ['ソフトウェア受託開発'],
  },
]);
