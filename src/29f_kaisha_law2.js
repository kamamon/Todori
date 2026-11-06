'use strict';
/* =========================================================
 *  29f_kaisha_law2.js : 会社の法令の追加（会社法・税・社会保険・雇用・取引・環境・海外）、
 *  法改正の年表、新しい出来事（取引先の倒産・労働組合・内部通報・税務調査・補助金 など）、年間の予定
 *  法令の内容と日付は 2026年11月時点の公表資料による（会社法・法人税法・地方税法・労働施策総合推進法・
 *  育児・介護休業法・女性活躍推進法・障害者雇用促進法・中小受託取引適正化法（取適法）・フリーランス法・
 *  公益通報者保護法・景品表示法・廃棄物処理法・省エネ法・工場立地法 など）。罰則は上限の目安
 * ========================================================= */

Object.assign(LAW_AG, {
  corp: { n: '法務局・裁判所（会社法の過料）', s: '法務局', icon: '登' },
  tax: { n: '税務署', s: '税務署', icon: '税' },
  muni: { n: '市町村（税務課）', s: '市町村', icon: '市' },
  nenkin: { n: '年金事務所', s: '年金事務所', icon: '年' },
  kintou: { n: '労働局（雇用環境・均等部）', s: '労働局', icon: '均' },
  hw: { n: 'ハローワーク（公共職業安定所）', s: 'ハローワーク', icon: '職' },
  ftc: { n: '公正取引委員会・中小企業庁', s: '公取委', icon: '公' },
  caa: { n: '消費者庁', s: '消費者庁', icon: '費' },
  env: { n: '県・市（環境・都市計画）', s: '県・市', icon: '環' },
  foreign: { n: '海外の当局（進出先の国）', s: '海外の当局', icon: '外' },
});
Object.assign(LAW_ITEMS, {
  agm: { n: '定時株主総会を開いていない（計算書類の承認・役員の選任）', s: '株主総会', ag: 'corp', sev: 1, det: 0.5, law: '会社法296条・438条（懈怠は976条の過料）', tk: 'agm',
    rule: '株式会社（特例有限会社を含む）は、毎事業年度の終了後、一定の時期（通常は3か月以内）に定時株主総会を開き、計算書類（貸借対照表・損益計算書など）の承認を受ける。役員の任期が満了したら選任する。',
    how: '決算の後、招集通知（公開会社は2週間前・非公開の取締役会設置会社は1週間前）を送り、6月に総会を開く。議事録を作って本店に10年保存する。', pen: '100万円以下の過料（取締役個人）', meas: 'shido' },
  kokoku: { n: '決算公告をしていない', s: '決算公告', ag: 'corp', sev: 1, det: 0.3, law: '会社法440条・939条（懈怠は976条2号の過料）', tk: 'kessanKokoku',
    rule: '株式会社は、定時株主総会の後すぐに貸借対照表（大会社は損益計算書も）を、官報・日刊新聞・電子公告のどれかで公告する。合同会社・特例有限会社と、有価証券報告書を出す上場会社は不要。',
    how: '官報に貸借対照表の要旨を載せる（1枠 約7万円）か、自社のホームページで5年間公開する（電子公告）。', pen: '100万円以下の過料', meas: 'shido' },
  yakuin: { n: '役員の任期が切れたのに変更の登記をしていない', s: '役員の変更登記', ag: 'corp', sev: 1, det: 0.6, law: '会社法332条・915条（懈怠は976条1号の過料）', tk: 'yakuinTouki',
    rule: '取締役の任期は原則2年（株式の譲渡を制限する非公開会社は定款で10年まで）。再任でも、変わってから2週間以内に変更の登記をする。12年登記がないと、休眠会社としてみなし解散になる。',
    how: '任期の満了の総会で選任し、司法書士に登記を頼む（登録免許税は資本金1億円以下は1万円、超えると3万円）。', pen: '100万円以下の過料', meas: 'shido' },
  kansa: { n: '大会社なのに会計監査人の監査を受けていない', s: '会計監査人', ag: 'corp', sev: 2, det: 0.8, law: '会社法2条6号・328条', tk: 'bigCompany',
    rule: '資本金5億円以上または負債の合計200億円以上の大会社は、会計監査人（監査法人・公認会計士）を置き、計算書類の監査を受ける。取締役会は内部統制システムの基本方針を決める（362条5項）。',
    how: '監査法人と契約し、期末の監査を受ける。', pen: '100万円以下の過料。監査のない計算書類は承認の効力に問題が出る', meas: 'shido' },
  nencho: { n: '年末調整・法定調書の提出を怠っている', s: '年末調整', ag: 'tax', sev: 1, det: 0.7, law: '所得税法190条・225条・226条', tk: 'nencho',
    rule: '給与を払う会社は、12月に社員の1年間の所得税を精算し（年末調整）、1月31日までに源泉徴収票・法定調書合計表を税務署に、給与支払報告書を市町村に出す。',
    how: '扶養控除などの申告書を集め、12月の給与で過不足を精算する。', pen: '1年以下の拘禁刑または50万円以下の罰金（不提出・虚偽）。不納付加算税10%', meas: 'shido' },
  shokyaku: { n: '償却資産の申告をしていない', s: '償却資産の申告', ag: 'muni', sev: 1, det: 0.5, law: '地方税法383条・386条', tk: 'shokyakuShisan',
    rule: '1月1日に事業用の機械・備品などを持つ会社は、1月31日までに市町村に償却資産を申告する（課税標準150万円未満は課税されない）。土地・建物とあわせて固定資産税（1.4%）がかかる。',
    how: '固定資産台帳から、1月1日の資産の一覧を作って申告する。', pen: '10万円以下の過料（不申告）。さかのぼって課税される', meas: 'shido' },
  denchou: { n: '電子取引のデータを保存していない', s: '電子帳簿保存法', ag: 'tax', sev: 1, det: 0.6, law: '電子帳簿保存法7条', tk: 'denchou',
    rule: '2024年1月から、メールやネットで受け取った請求書・領収書などの電子データは、紙に印刷せずにデータのまま、検索できるように保存する。',
    how: '受け取った電子データを決まった場所に、日付・金額・取引先で検索できるように保存する（システムか、ファイル名と索引簿）。', pen: '青色申告の承認の取消しのおそれ。隠蔽・仮装があると重加算税が10%加重', meas: 'shido' },
  santei: { n: '算定基礎届を出していない', s: '算定基礎届', ag: 'nenkin', sev: 1, det: 0.8, law: '健康保険法41条・厚生年金保険法21条', tk: 'santei',
    rule: '毎年7月10日までに、4〜6月の給与から社会保険料の基準（標準報酬月額）を決めなおす届けを出す。通勤手当も報酬に含める。',
    how: '給与計算のデータから届けを作り、電子申請で出す。', pen: '6か月以下の拘禁刑または50万円以下の罰金。過去にさかのぼって保険料を徴収', meas: 'shido' },
  shaho: { n: 'パート・アルバイトを社会保険に加入させていない', s: '社会保険の適用', ag: 'nenkin', sev: 2, det: 0.8, law: '健康保険法3条・厚生年金保険法12条（年金制度改正法 2025年）', tk: 'shahoKakudai',
    rule: '週20時間以上働くパート・アルバイトは、会社の規模（被保険者数）が基準以上なら社会保険に加入させる。基準は51人以上で、2027年10月から36人以上、2029年10月から21人以上、2032年10月から11人以上、2035年10月に撤廃。',
    how: '対象の人を洗い出して資格取得届を出す。会社も保険料の半分（約15%）を負担する。', pen: 'さかのぼって最大2年分の保険料を徴収', meas: 'shido' },
  harass: { n: 'ハラスメントの防止措置をしていない（パワハラ・セクハラ・カスハラ）', s: 'ハラスメントの防止', ag: 'kintou', sev: 2, det: 0.7, compl: 0.01, law: '労働施策総合推進法30条の2（2026年10月から カスタマーハラスメント・求職者へのセクハラの対策も義務）', tk: 'harassment',
    rule: '会社は、職場のパワーハラスメント・セクシュアルハラスメント・妊娠出産等のハラスメントを防ぐため、方針の明確化と周知、相談窓口、事後の迅速な対応をしなければならない。2026年10月から、お客さまからの著しい迷惑行為（カスタマーハラスメント）と、就職活動中の学生などへのセクハラの対策も義務になった。',
    how: '就業規則に方針を書き、相談窓口を置き、毎年研修をする。カスハラの対応方針と、店舗・窓口での対応の手順を決める。', pen: '助言・指導・勧告、従わないと企業名の公表。報告を拒むと20万円以下の過料', meas: 'shido' },
  ikuji: { n: '育児・介護休業法の対応が古い（規程・個別の意向確認・柔軟な働き方）', s: '育児・介護の両立', ag: 'kintou', sev: 1, det: 0.7, compl: 0.005, law: '育児・介護休業法（2025年4月・10月改正）', tk: 'ikukyu',
    rule: '2025年4月から子の看護等休暇が小学校3年生まで広がり、介護の個別の周知・意向確認が義務になった。2025年10月から、3歳から小学校に入るまでの子を育てる社員に、柔軟な働き方の措置（始業時刻の変更・テレワーク・短時間勤務など5つのうち2つ以上）を用意する。常時300人超は男性の育児休業の取得率を公表する。',
    how: '育児・介護休業規程を改定し、対象の社員に個別に制度を知らせて意向を聞く。', pen: '勧告と企業名の公表、報告を拒むと20万円以下の過料', meas: 'shido' },
  josei: { n: '女性活躍推進法の行動計画・情報公表をしていない（101人以上）', s: '女性活躍の行動計画', ag: 'kintou', sev: 1, det: 0.7, law: '女性活躍推進法8条・20条（2026年4月改正）', tk: 'joseiKatsuyaku',
    rule: '常時101人以上の会社は、女性の活躍の行動計画を作って届け出て、情報を公表する。2026年4月から、男女の賃金の差異と女性管理職の比率の公表も101人以上の会社の義務になった。次世代法の行動計画（101人以上）も届け出る。',
    how: '採用・管理職・賃金の男女の状況を把握し、目標と取り組みを決めて届け出る。', pen: '勧告と企業名の公表、報告を拒むと20万円以下の過料', meas: 'shido' },
  shogai: { n: '障害者の法定雇用率を満たしていない', s: '障害者雇用', ag: 'hw', sev: 1, det: 0.9, law: '障害者雇用促進法43条（2026年7月から民間の法定雇用率2.7%）', tk: 'shogaiKoyo',
    rule: '常用の労働者が37.5人以上の会社は、その2.7%以上の障害のある人を雇う（2026年7月から。それまでは40人以上で2.5%）。100人を超える会社は、足りない人数1人あたり月5万円の納付金を納める。超えて雇えば調整金（月2.9万円）。毎年6月1日の状況をハローワークに報告する。',
    how: '障害のある人の採用と、職場の環境（仕事の切り出し・ジョブコーチ）を整える。', pen: '雇入れ計画の作成命令、改善しなければ企業名の公表', meas: 'shido' },
  koyou65: { n: '65歳までの雇用確保の措置がない', s: '高年齢者の雇用', ag: 'hw', sev: 1, det: 0.7, law: '高年齢者雇用安定法9条（70歳までの就業確保は努力義務）', tk: 'koureisha',
    rule: '定年を65歳未満にしている会社は、65歳までの雇用を確保する（定年の引き上げ・継続雇用制度・定年の廃止のどれか）。70歳までの就業の確保は努力義務。',
    how: '継続雇用制度（定年後の再雇用）を就業規則に定める。', pen: '指導・勧告、従わないと企業名の公表', meas: 'shido' },
  stress: { n: 'ストレスチェックをしていない', s: 'ストレスチェック', ag: 'labor', sev: 1, det: 0.85, law: '労働安全衛生法66条の10（50人未満の事業場は2028年4月から義務）', tk: 'stressCheck',
    rule: '常時50人以上の事業場は、年1回、医師・保健師などによるストレスチェックを行い、高ストレスの人が希望すれば医師の面接指導を受けさせる。2028年4月から50人未満の事業場も義務になる。',
    how: '実施者（医師・保健師）と委託先を決め、毎年実施して、集団分析で職場を改善する。', pen: '50人以上の事業場は労働基準監督署に結果を報告（報告しないと50万円以下の罰金）', meas: 'kankoku' },
  heat: { n: '熱中症の対策（体制・手順・周知）をしていない', s: '熱中症の対策', ag: 'labor', sev: 2, det: 0.8, acc: 1.15, law: '労働安全衛生規則612条の2（2025年6月1日施行）', tk: 'heatStroke',
    rule: '暑さ指数（WBGT）28度以上または気温31度以上の環境で、連続1時間以上または1日4時間を超えて働かせるときは、熱中症の人を見つけて報告する体制、症状が出た人への手順を決めて、関係者に周知する。',
    how: '夏の前に、報告の連絡先・応急の手順・WBGT計・休憩所を整え、朝礼などで周知する。', pen: '6か月以下の拘禁刑または50万円以下の罰金', meas: 'kankoku' },
  toriteki: { n: '取適法（旧下請法）の義務を守っていない（書面・60日以内の支払・手形・価格協議）', s: '取適法', ag: 'ftc', sev: 2, det: 0.6, law: '中小受託取引適正化法（取適法。2026年1月1日施行の下請法の改正）', tk: 'toriteki',
    rule: '中小の取引先（中小受託事業者）に製造・修理・運送・情報成果物の作成・役務を委託するときは、取引の条件を書面（電子でもよい）で示し、受け取った日から60日以内に払う。2026年1月から手形での支払いは禁止、取引先から価格の協議を求められたら応じる義務（一方的な価格の決定の禁止）、従業員の数の基準（製造委託などは委託側300人超）が加わり、運送の委託も対象になった。',
    how: '発注書のひな型・支払いのサイト・価格改定の協議の記録を毎年点検し、購買の担当に研修する。', pen: '勧告と企業名の公表。書面を交付しないなどは50万円以下の罰金', meas: 'shido' },
  freelance: { n: 'フリーランス法の義務を守っていない', s: 'フリーランス法', ag: 'ftc', sev: 1, det: 0.5, law: '特定受託事業者に係る取引の適正化等に関する法律（2024年11月1日施行）', tk: 'freelance',
    rule: '従業員を雇わない個人（フリーランス）に仕事を頼むときは、取引の条件を書面などで示し、60日以内に報酬を払う。募集の情報を正しく出し、ハラスメントの相談体制を整え、6か月以上の継続の契約を途中で解除するときは30日前に予告する。',
    how: '発注の書面とひな型を整え、業務委託の担当に研修する。', pen: '勧告・命令・公表、命令に違反すると50万円以下の罰金', meas: 'shido' },
  koueki: { n: '公益通報（内部通報）の体制を整えていない（300人超）', s: '公益通報の体制', ag: 'caa', sev: 2, det: 0.6, law: '公益通報者保護法11条（2026年12月1日施行の改正で、通報を理由とする解雇・懲戒に刑事罰）', tk: 'kouekiTsuho',
    rule: '常時300人を超える会社は、内部通報の窓口と、調査・是正の体制、通報した人を守る仕組みを整え、担当者を決める（300人以下は努力義務）。2026年12月から、通報を理由に解雇・懲戒すると刑事罰になり、通報から1年以内の解雇・懲戒は通報を理由とするものと推定される。フリーランスも保護の対象に加わった。',
    how: '社内と社外（法律事務所）の窓口を置き、規程を作って毎年周知する。', pen: '助言・指導・勧告・公表。報告を拒むと20万円以下の過料。担当者の守秘義務違反は30万円以下の罰金', meas: 'shido' },
  keihyo: { n: '広告の表示（景品表示法・ステマ規制）を点検していない', s: '広告の表示', ag: 'caa', sev: 2, det: 0.4, law: '景品表示法5条（ステルスマーケティングの規制は2023年10月から）', tk: 'keihyo',
    rule: '実際よりよく見せる表示（優良誤認・有利誤認）と、広告であることを隠した広告（ステマ）は禁止。違反すると措置命令と、対象の売上の3%の課徴金。',
    how: '広告・ホームページ・SNSの投稿の依頼を毎年点検し、「広告」「PR」の表示を徹底する。', pen: '措置命令と課徴金（売上の3%）。故意の優良誤認・有利誤認は100万円以下の罰金', meas: 'shido' },
  haiki: { n: '産業廃棄物の管理票（マニフェスト）の報告をしていない', s: '産業廃棄物', ag: 'env', sev: 2, det: 0.6, law: '廃棄物処理法12条の3・12条の6', tk: 'manifest',
    rule: '産業廃棄物を出す会社は、許可のある業者と書面で委託の契約をし、管理票（マニフェスト）を交付して処理を確かめ、毎年6月30日までに前年度の交付の状況を都道府県に報告する。',
    how: '委託の契約書と許可証の写しを5年保存し、電子マニフェストで交付と返送を管理する。', pen: '委託の基準の違反は3年以下の拘禁刑または300万円以下の罰金。不法投棄は会社に3億円以下の罰金', meas: 'shido' },
  shoene: { n: '省エネ法・温対法の定期報告をしていない', s: '省エネ法の報告', ag: 'env', sev: 1, det: 0.6, law: '省エネ法・地球温暖化対策推進法（年間のエネルギー使用量が原油換算1,500kl以上）', tk: 'shoene',
    rule: 'エネルギーを年1,500kl（原油換算）以上使う特定事業者は、エネルギー管理統括者を選び、毎年7月末までに定期報告書と中長期計画書を出す（温室効果ガスの排出量の報告もあわせて）。',
    how: 'エネルギーの使用量を事業所ごとに集計して、電子で報告する。', pen: '勧告・公表・命令、命令に違反すると罰金。報告をしないと50万円以下の罰金', meas: 'shido' },
  kojo: { n: '工場立地法の届出をしていない', s: '工場立地法', ag: 'env', sev: 1, det: 0.8, law: '工場立地法6条（敷地9,000㎡以上または建築面積3,000㎡以上の製造業など）', tk: 'kojoRicchi',
    rule: '大きな工場を新しく建てるときは、着工の90日前までに市町村に届け出る。敷地の20%以上を緑地、25%以上を環境施設にする（地域の条例で変わる）。',
    how: '工場の配置の計画を作り、緑地の面積を確保して届け出る。', pen: '勧告・変更命令、届出をしないと罰金', meas: 'shido' },
  tp: { n: '海外子会社との取引の価格（移転価格）を検討していない', s: '移転価格', ag: 'tax', sev: 2, det: 0.5, law: '租税特別措置法66条の4（移転価格税制）', tk: 'transferPricing',
    rule: '海外の関係会社との取引（経営指導料・製品の売買・貸付の利息など）は、関係のない会社どうしと同じ価格（独立企業間価格）でなければならない。国外関連取引が前期50億円以上または無形資産の取引が3億円以上の会社は、ローカルファイルを申告期限までに作る。',
    how: '料率の根拠（同じような取引の相場・かかった費用）を文書にまとめる。', pen: '移転価格課税（所得の更正）と過少申告加算税。二重課税になることも', meas: 'shido' },
});
/* 海外の国ごとの法令（KS_COUNTRIES の laws から） */
for (const [cc, C] of Object.entries(KS_COUNTRIES)) {
  LAW_ITEMS['f_' + cc] = { n: `${C.n}の法令の対応を怠っている（${C.laws.map(l => l[0]).join('・')}）`, s: `${C.n}の法令`, ag: 'foreign', sev: 2, det: 0.6, law: C.laws.map(l => l[0]).join('・'), tk: 'foreignLaw',
    rule: C.laws.map(l => `【${l[0]}】${l[1]}。`).join(''), how: `現地の弁護士・会計事務所と毎年の点検をし、駐在員と現地の社員に研修をして記録を残す。${C.n}の主なリスク：${C.risk}。`, pen: C.laws.map(l => `${l[0]}：${l[2]}`).join('。'), meas: 'shido' };
}

/* ---------- 法令のやること（追加） ---------- */
const ksIsKK = () => ksForm(G) === 'kk';
const ksIsBigCo = () => (G.bal.capital || 0) >= 5e8 || ksLiab() >= 200e8;
const ksUsesSubcon = () => ksActiveUnits().some(u => ['mfg', 'build', 'trans', 'pro'].includes(ksS(u).eng));
const ksHasEngIn = list => ksActiveUnits().some(u => list.includes(ksS(u).eng));
const ksPartRolesN = () => (typeof ksPartRoles === 'function' ? ksPartRoles().length : 0);
function ksForeignCountries() {
  const out = new Set();
  if (G.grow) for (const it of Object.values(G.grow.intl || {})) for (const [r, x] of Object.entries(it)) if (x.st >= 2) out.add(x.cc || KS_REG_COUNTRY_DEFAULT[r]);
  if (G.country && G.country !== 'jp') out.add(G.country);
  return [...out].filter(cc => KS_COUNTRIES[cc]);
}
KS_LAW_TASKS.push(
  { id: 'agm', item: 'agm', freq: 'fy', dueMo: 6, fromMo: 4, n: '定時株主総会（計算書類の承認・役員の選任）', acct: 'fees', cost: () => (typeof ksListed === 'function' && ksListed() ? 800e4 : 2e4), applies: () => ksForm(G) !== 'gk', why: '決算の後、6月に定時株主総会を開き、計算書類の承認を受ける（上場会社は招集通知の印刷・会場・IRの費用がかかる）。合同会社は不要。' },
  { id: 'kokoku', item: 'kokoku', freq: 'fy', dueMo: 7, fromMo: 6, n: '決算公告（官報に貸借対照表の要旨）', acct: 'ads', cost: () => 7.4e4, applies: () => ksIsKK() && !(typeof ksListed === 'function' && ksListed()), why: '株式会社は株主総会の後に決算を公告する。合同会社・特例有限会社と、有価証券報告書を出す上場会社は不要。' },
  { id: 'yakuin', item: 'yakuin', freq: 'span', span: 24, n: '役員の変更登記（任期の満了・再任）', acct: 'fees', cost: () => ((G.bal.capital || 0) > 1e8 ? 3e4 : 1e4) + 5e4, applies: () => ksIsKK(), why: '取締役の任期（原則2年）が満了したら、再任でも2週間以内に変更の登記をする（登録免許税と司法書士の報酬）。' },
  { id: 'kansa', item: 'kansa', freq: 'fy', dueMo: 5, fromMo: 4, n: '会計監査人（監査法人）の監査（大会社）', acct: 'fees', cost: () => Math.max(1500e4, ksAnnualSales() * 0.0004), applies: ksIsBigCo, why: '資本金5億円以上または負債200億円以上の大会社は、会計監査人の監査を受ける。' },
  { id: 'nencho', item: 'nencho', freq: 'fy', dueMo: 1, fromMo: 11, n: '年末調整と法定調書・給与支払報告書（1月31日まで）', acct: 'fees', cost: () => ksHeadcount() * 800 + 1e4, applies: () => ksHeadcount() > 0, why: '12月の給与で所得税を精算し、1月31日までに源泉徴収票などを税務署と市町村に出す（税理士・社会保険労務士への報酬）。' },
  { id: 'shokyaku', item: 'shokyaku', freq: 'fy', dueMo: 1, fromMo: 12, n: '償却資産の申告（1月31日まで・市町村）', acct: 'fees', cost: () => 3e4, applies: () => ksActiveAssets().some(a => ['mach', 'equip', 'veh'].includes(a.acct)), why: '1月1日に持っている機械・備品などを市町村に申告する。固定資産税（1.4%）の基準になる。' },
  { id: 'denchou', item: 'denchou', freq: 'once', n: '電子帳簿保存法（電子取引のデータの保存）の仕組み', acct: 'fees', cost: () => 15e4 + ksHeadcount() * 1000, why: 'メールやネットで受け取った請求書・領収書は、データのまま検索できるように保存する（2024年1月から）。' },
  { id: 'santei', item: 'santei', freq: 'fy', dueMo: 7, fromMo: 6, n: '社会保険の算定基礎届（7月10日まで）', acct: 'fees', cost: () => ksHeadcount() * 300 + 1e4, applies: () => ksHeadcount() > 0, why: '4〜6月の給与から社会保険料の基準（標準報酬月額）を決めなおす。' },
  { id: 'shaho', item: 'shaho', freq: 'once', n: 'パート・アルバイトの社会保険の加入（適用拡大）', acct: 'fees', cost: () => 10e4, applies: () => ksPartRolesN() > 0 && ksHeadcount() >= ksShahoThreshold(), why: '週20時間以上のパート・アルバイトを社会保険に加入させる。会社も保険料の半分を負担する（このあと毎月の法定福利費が増える）。' },
  { id: 'harass', item: 'harass', freq: 'year', n: 'ハラスメントの防止（方針・相談窓口・研修。カスハラの対策を含む）', acct: 'recruit', cost: () => 3e4 + ksHeadcount() * 300, applies: () => ksHeadcount() > 0, why: 'パワハラ・セクハラの防止に加え、2026年10月からカスタマーハラスメントと求職者へのセクハラの対策も義務。' },
  { id: 'ikuji', item: 'ikuji', freq: 'year', n: '育児・介護休業の規程と個別の意向確認・柔軟な働き方の措置', acct: 'fees', cost: () => 2e4 + ksHeadcount() * 100, applies: () => ksHeadcount() > 0, why: '2025年4月・10月の改正への対応。300人超は男性の育児休業の取得率を公表する。' },
  { id: 'josei', item: 'josei', freq: 'year', n: '女性活躍・次世代育成の行動計画と情報の公表（101人以上）', acct: 'fees', cost: () => 20e4, applies: () => ksHeadcount() >= 101, why: '行動計画を届け出て、男女の賃金の差異・女性管理職の比率（2026年4月から101人以上）などを公表する。' },
  { id: 'shogai', item: 'shogai', freq: 'fy', dueMo: 7, fromMo: 6, n: '障害者の雇用状況の報告（6月1日の状況）', acct: 'fees', cost: () => 2e4, applies: () => ksHeadcount() >= 37.5, why: '常用の労働者37.5人以上の会社は、毎年6月1日の障害者の雇用の状況をハローワークに報告する。' },
  { id: 'koyou65', item: 'koyou65', freq: 'once', n: '65歳までの継続雇用制度（就業規則）', acct: 'fees', cost: () => 5e4, applies: () => ksHeadcount() > 0, why: '定年を65歳未満にしている会社は、継続雇用などで65歳まで雇用を確保する。' },
  { id: 'stress', item: 'stress', freq: 'year', n: 'ストレスチェックと集団分析', acct: 'fukuri', cost: () => ksHeadcount() * 600 + 5e4, applies: () => ksHeadcount() >= 50 || G.m >= 24, why: '年1回、医師・保健師などがストレスチェックを行う（50人未満の事業場も2028年4月から義務）。' },
  { id: 'heat', item: 'heat', freq: 'fy', dueMo: 6, fromMo: 4, n: '熱中症の対策（報告の体制・手順・WBGT計・周知）', acct: 'safety', cost: () => 8e4 + ksHeadcount() * 400, applies: () => ksHasEngIn(['build', 'mfg', 'trans', 'trade', 'cap']), why: '2025年6月から義務。暑い環境で働く現場は、夏の前に体制と手順を整えて周知する。' },
  { id: 'toriteki', item: 'toriteki', freq: 'year', n: '取適法（発注書面・60日以内の支払・手形の禁止・価格協議）の点検', acct: 'fees', cost: () => 15e4, applies: () => ksUsesSubcon() && ((G.bal.capital || 0) > 1e7 || ksHeadcount() > 100), why: '2026年1月から下請法が取適法に変わり、手形の禁止と価格の協議の義務が加わった。' },
  { id: 'freelance', item: 'freelance', freq: 'year', n: 'フリーランスへの発注の点検（条件の明示・60日以内の支払）', acct: 'fees', cost: () => 8e4, applies: () => ksHasEngIn(['pro', 'subs', 'build']), why: '個人に仕事を頼むときの義務（2024年11月から）。' },
  { id: 'koueki', item: 'koueki', freq: 'year', n: '内部通報（公益通報）の窓口と規程・研修', acct: 'fees', cost: () => 40e4 + ksHeadcount() * 300, applies: () => ksHeadcount() > 300, why: '300人超は体制の整備が義務。2026年12月の改正で、通報を理由とする解雇・懲戒に刑事罰。' },
  { id: 'keihyo', item: 'keihyo', freq: 'year', n: '広告の表示の点検（景品表示法・ステマ規制）', acct: 'fees', cost: () => 3e4, applies: () => ksHasEngIn(['shop', 'rest', 'subs', 'cap']), why: 'お客さま向けの広告・SNS・口コミの依頼が、実際よりよく見せていないか、広告と分かるかを確かめる。' },
  { id: 'haiki', item: 'haiki', freq: 'fy', dueMo: 6, fromMo: 4, n: '産業廃棄物の管理票（マニフェスト）の交付状況の報告（6月30日）', acct: 'fees', cost: () => 5e4, applies: () => ksHasEngIn(['mfg', 'build', 'rest']), why: '前年度に交付したマニフェストの状況を都道府県に報告する。' },
  { id: 'shoene', item: 'shoene', freq: 'fy', dueMo: 7, fromMo: 5, n: '省エネ法・温対法の定期報告（7月末）', acct: 'fees', cost: () => 30e4, applies: () => ksAnnualSales() >= 100e8 && ksHasEngIn(['mfg', 'cap', 'trans']), why: 'エネルギーを年1,500kl（原油換算）以上使う特定事業者の報告。' },
  { id: 'kojo', item: 'kojo', freq: 'once', n: '工場立地法の届出（大きな工場）', acct: 'fees', cost: () => 20e4, applies: () => !!(G.loc && G.loc.lands.some(L => L.bldg && L.bldg.kind === 'factory' && L.area >= 9000)), why: '敷地9,000㎡以上の工場は、着工の90日前までに届け出て、緑地を確保する。' },
  { id: 'tp', item: 'tp', freq: 'fy', dueMo: 6, fromMo: 4, n: '海外子会社との取引の価格（移転価格）の文書', acct: 'fees', cost: () => 80e4, applies: () => !!(G.group && ksSubs(G).some(s => s.cc && s.cc !== 'jp')), why: '経営指導料などの料率が、関係のない会社どうしの相場と同じかを文書で説明できるようにする。' },
);
/* 海外の国ごとの法令の点検（拠点や子会社がある国） */
const ksLicTasks0L2 = ksLicTasks;
ksLicTasks = function () {
  const out = ksLicTasks0L2();
  for (const cc of ksForeignCountries()) {
    const C = KS_COUNTRIES[cc];
    out.push({ id: 'f_' + cc, item: 'f_' + cc, freq: 'year', n: `${C.n}の法令の点検と研修（${C.laws.slice(0, 2).map(l => l[0].replace(/（.*?）/g, '')).join('・')} など）`, acct: 'fees', cost: () => Math.max(150e4, ksAnnualSales() * 0.0004), why: `${C.n}に拠点がある。${C.laws.map(l => `${l[0]}：${l[1]}`).join('。')}。` });
  }
  return out;
};
/* 会社の形・人数で、そもそも関係のない法令は違反にしない */
const ksLawViolations0L2 = ksLawViolations;
ksLawViolations = function () {
  const v = ksLawViolations0L2();
  for (const x of ksLawTasks()) if (x.st === 'over' && x.t.item && x.t.item.startsWith('f_')) v.add(x.t.item);
  if (G.hr && G.hr.disNeed > 0 && G.hr.dis < G.hr.disNeed) v.add('shogai');
  return v;
};
/* 社会保険の適用拡大の基準（被保険者の数） */
function ksShahoThreshold() { return G.m >= 114 ? 0 : G.m >= 78 ? 11 : G.m >= 42 ? 21 : G.m >= 18 ? 36 : 51; }

/* ---------- 法改正の年表（2026年4月 = m:0） ---------- */
const KS_LAW_TL = [
  { m: -3, t: '取適法（中小受託取引適正化法）の施行', d: '下請法が改正されて取適法に。手形での支払いの禁止、価格の協議に応じる義務、従業員の数の基準、運送の委託の追加。', past: true },
  { m: 0, t: '女性活躍推進法の改正（公表の拡大）', d: '男女の賃金の差異と女性管理職の比率の公表が、101人以上の会社の義務に。', past: true },
  { m: 0, t: '食事補助の非課税の上限の引き上げ', d: '会社が負担する食事代の非課税の上限が、月3,500円から7,500円に（社員の負担が半分以上のとき）。', past: true },
  { m: 0, t: '子ども・子育て支援金の徴収の開始', d: '医療保険の保険料に上乗せして徴収（2026年度は報酬の0.23%を労使で折半）。会社の法定福利費が少し増える。', past: true },
  { m: 3, t: '障害者の法定雇用率の引き上げ（2.7%）', d: '民間の会社の法定雇用率が2.5%から2.7%に。対象は常用の労働者37.5人以上の会社に広がった。', past: true },
  { m: 6, t: '最低賃金の改定（全国の加重平均1,177円）', d: '2026年度の地域別最低賃金は全国の加重平均で1,177円（前年度より56円高い）。最高は東京の1,280円、最低は宮崎の1,085円。2026年10月から12月にかけて順に発効。', past: true },
  { m: 6, t: 'カスタマーハラスメントの対策の義務化', d: '労働施策総合推進法の改正で、お客さまからの著しい迷惑行為への対策と、就職活動中の学生などへのセクハラの対策が会社の義務に。', past: true },
  { m: 8, t: '公益通報者保護法の改正の施行', d: '通報を理由とする解雇・懲戒に刑事罰。通報から1年以内の解雇・懲戒は通報を理由とするものと推定。フリーランスも保護の対象に。', past: true },
  { m: 8, t: '企業型DC・iDeCoの拠出の上限の改正', d: '会社員の企業型確定拠出年金とiDeCoの拠出の上限が、企業年金との共通の枠で月6.2万円に。', past: true },
  { m: 12, t: '新しい年度：重点実施事項と目標を決める', d: '4月は新しい期の始まり。予算とあわせて、今年度の重点実施事項（3つまで）と目標を決めましょう。', cal: true },
  { m: 18, t: '社会保険の適用拡大（36人以上の会社）', d: '週20時間以上のパート・アルバイトを社会保険に加入させる会社の規模の基準が、51人以上から36人以上に下がる（年金制度改正法）。', apply: 'shaho' },
  { m: 24, t: 'ストレスチェックの義務の拡大（50人未満の事業場）', d: '労働安全衛生法の改正で、従業員50人未満の事業場もストレスチェックが義務に（令和10年4月1日施行）。', apply: 'stress' },
  { m: 27, t: '個人情報保護法の課徴金制度（予定）', d: '2026年7月に公布された改正で、悪質な違反に課徴金を課す制度が入る（公布から2年以内に政令で定める日）。' },
  { m: 36, t: '土地の登録免許税の軽減の期限', d: '土地の売買の所有権の移転の登記の税率（本則2%）を1.5%にする特例は、2029年3月31日まで（令和8年度の税制改正で3年延長）。', apply: 'landReg' },
  { m: 42, t: '社会保険の適用拡大（21人以上の会社）', d: '短時間労働者の社会保険の会社の規模の基準が21人以上に。', apply: 'shaho' },
  { m: 78, t: '社会保険の適用拡大（11人以上の会社）', d: '短時間労働者の社会保険の会社の規模の基準が11人以上に。', apply: 'shaho' },
  { m: 114, t: '社会保険の適用拡大（規模の基準の撤廃）', d: '会社の規模にかかわらず、週20時間以上のパート・アルバイトは社会保険に加入する。', apply: 'shaho' },
];
const KS_LAW_TL_FOREIGN = [
  { m: 9, cc: 'vn', t: 'ベトナムの付加価値税の軽減の終了（予定）', d: '2026年末までの8%の軽減が終わり、標準の10%に戻る予定。' },
  { m: 9, cc: 'mx', t: 'メキシコの週40時間制への移行（報道）', d: '週48時間から40時間への段階的な短縮が始まると報じられている。人件費が上がる。' },
  { m: 9, cc: 'de', t: 'EUのサステナビリティ報告（CSRD）', d: '従業員1,000人超かつ売上4.5億ユーロ超の会社は、2027年1月以後に始まる年度から報告の対象（2026年3月のオムニバスで縮小）。' },
  { m: 9, cc: 'fr', t: 'EUのサステナビリティ報告（CSRD）', d: '従業員1,000人超かつ売上4.5億ユーロ超の会社は、2027年1月以後に始まる年度から報告の対象。' },
];
function ksLaw2Init() {
  if (!G.law) return;
  G.law.tl = G.law.tl || {};
  for (const x of KS_LAW_TL) if (x.m <= G.m) G.law.tl[x.m + ':' + x.t] = true;
  // 就任のときにすでに社会保険に加入させていたパート・アルバイトの保険料は、人件費に含まれている
  if (G.law.shahoBase === undefined) G.law.shahoBase = ksPartRolesN() > 0 && ksHeadcount() >= ksShahoThreshold();
}
function ksLaw2Month(ctx) {
  const L = G.law;
  // 年表の法改正
  for (const x of KS_LAW_TL.concat(KS_LAW_TL_FOREIGN)) {
    if (x.m !== G.m) continue;
    const key = x.m + ':' + x.t;
    if (L.tl[key]) continue;
    L.tl[key] = true;
    if (x.cc && !ksForeignCountries().includes(x.cc)) continue;
    if (x.apply === 'shaho' && !(ksPartRolesN() > 0 && ksHeadcount() >= ksShahoThreshold())) continue;
    if (x.apply === 'stress' && ksHeadcount() >= 50) continue;
    if (!G.isSub) ksNews(`【法改正】${x.t}：${x.d}`, x.cal ? 'info' : 'bad');
  }
  // 社会保険の適用拡大のあとの、パート・アルバイトの社会保険料（会社の負担）
  if (L.done.shaho !== undefined && !L.shahoBase && ksPartRolesN() > 0) {
    let pay = 0;
    for (const x of ksPartRoles()) pay += ksRoleWage(x.r, x.u) * (x.u.staff[x.r.id] || 0) * 0.5 * 0.15;
    pay = Math.round(pay);
    if (pay > 0) ksPost('shahoPart', [['welfare', pay, 0], ['cash', 0, pay]], { u: 'HQ', cf: 'payroll', desc: 'パート・アルバイトの社会保険料（会社の負担。適用拡大）' });
  }
  ksLaw2Inspections(ksLawViolations());
}
/* 追加の役所の立入検査・調査 */
const KS_INSP2 = { corp: 0.003, muni: 0.004, nenkin: 0.006, kintou: 0.006, hw: 0.006, ftc: 0.004, caa: 0.003, env: 0.004, foreign: 0.006, tax: 0 };
function ksLaw2Inspections(viol) {
  const L = G.law;
  if (G.isSub && !G.law) return;
  // 関係のある役所だけ（その役所の法令のやることがある会社）
  const rel = new Set(ksLawTasks().map(x => LAW_ITEMS[x.t.item] && LAW_ITEMS[x.t.item].ag).filter(Boolean));
  if (G.hr && G.hr.disNeed > 0) rel.add('hw');
  for (const [ag, p0] of Object.entries(KS_INSP2)) {
    if (!p0 || !rel.has(ag)) continue;
    if (L.insp.some(x => x.ag === ag && x.status === 'open')) continue;
    const items = [...viol].filter(v => LAW_ITEMS[v] && LAW_ITEMS[v].ag === ag);
    // 違反がなくても調査は来る（違反があると来やすい）
    const p = items.length ? p0 * 2.5 * (typeof ksHrF === 'function' ? ksHrF(null, 'viol') : 1) : p0 * 0.5;
    if (!chance2(p)) continue;
    const kind = { corp: '過料の通知（裁判所）', muni: '税務課の調査', nenkin: '事業所の調査', kintou: '報告の求め・指導', hw: '雇用状況の指導', ftc: '書面調査・立入検査', caa: '調査', env: '立入検査', foreign: '現地の当局の調査' }[ag];
    const finds = items.filter(v => chance2(LAW_ITEMS[v].det)).map(v => ({ item: v, kind: 'shido', fixed: false }));
    const ins = { id: ++L.seq, m: G.m, ag, kind, finds, due: G.m + 2, status: finds.length ? 'open' : 'closed', stage: 0, why: '' };
    L.insp.unshift(ins);
    if (L.insp.length > 30) L.insp.length = 30;
    if (G.isSub) continue;
    // 罰金・過料・追徴（すぐに払うもの）
    let fine = 0;
    for (const f of finds) {
      if (ag === 'corp') fine += randInt(3, 20) * 1e4;
      if (ag === 'muni') fine += 5e4;
      if (ag === 'nenkin') fine += Math.round(ksPayrollEstimate().total * 0.03);
      if (ag === 'foreign') fine += Math.round(clamp(ksAnnualSales() * uni2(0.0015, 0.006), 300e4, 20e8) / 1e4) * 1e4;
      if (ag === 'caa' && f.item === 'keihyo') fine += Math.round(ksAnnualSales() * 0.03 * uni2(0.02, 0.1) / 1e4) * 1e4;
    }
    if (fine > 0) ksPost('law2_fine', [[ag === 'nenkin' ? 'welfare' : 'fines', fine, 0], ['cash', 0, fine]], { u: 'HQ', cf: 'other', desc: `${LAW_AG[ag].n}：${ag === 'nenkin' ? '社会保険料の追徴' : '過料・罰金・制裁金'}` });
    ksNews(`【${LAW_AG[ag].n}】${kind}がありました。${finds.length ? `指摘 ${finds.length}件（${finds.map(f => LAW_ITEMS[f.item].s).join('・')}）${fine ? `。${ag === 'nenkin' ? '保険料の追徴' : '過料・罰金'} ${fmtYen(fine)}` : ''}` : '指摘はありませんでした'}`, finds.length ? 'bad' : 'good');
    G.pendingModals.push({ type: 'kInsp', id: ins.id });
  }
}
/* 指摘の直し方（追加の項目） */
const ksLawFindingFix0L2 = ksLawFindingFix;
ksLawFindingFix = function (item) {
  if (item === 'shogai') { if (G.hr) { const need = Math.max(0, G.hr.disNeed - G.hr.dis); if (need) ksHrHireDis(need); } ksLawFixFindings('shogai'); return; }
  return ksLawFindingFix0L2(item);
};

/* ---------- 新しい出来事 ---------- */
/* 一時的な効果（需要など）：G.evt.mods = [{ u, key, f, until }] */
function ksEvtF(u, key) {
  if (!G.evt || !G.evt.mods) return 1;
  let f = 1;
  for (const x of G.evt.mods) if (x.key === key && x.until > G.m && (!x.u || (u && x.u === u.id))) f *= x.f;
  return f;
}
function ksEvtMod(u, key, f, months) { G.evt = G.evt || { mods: [], log: [], cnt: {} }; G.evt.mods.push({ u: u ? u.id : null, key, f, until: G.m + months }); }
const KS_B2B = ['mfg', 'build', 'trade', 'pro'];
const KS_EVT2 = {
  bankrupt: { t: '取引先の倒産', p: () => (ksHasEngIn(KS_B2B) ? 0.006 : 0), auto: true,
    run: () => {
      const custs = [...new Set(G.ar.filter(x => x.cust).map(x => x.cust))];
      if (!custs.length) return null;
      const c = pick2(custs);
      const amt = Math.round(sum(G.ar.filter(x => x.cust === c), x => x.amt));
      if (amt < 50e4) return null;
      const ratio = uni2(0.6, 1);
      ksWriteOffAR(c, ratio);
      return { body: `売掛金のある取引先（${c}）が倒産しました。売掛金${fmtYen(amt)}のうち約${Math.round(ratio * 100)}%が回収できず、貸倒損失（または貸倒引当金の取り崩し）になります。取引先の信用状態を見て、取引の上限（与信の枠）を決めておくことが大切です。`, tone: 'bad' };
    } },
  bigorder: { t: '大口の引き合い', p: () => (ksHasEngIn(KS_B2B) ? 0.005 : 0),
    body: () => '大きな取引先から、半年間いつもの1割増しの注文を出したいという話が来ました。受ければ売上は伸びますが、現場の残業が増えます。',
    ch: [['受ける（6か月、需要が1割増。残業が増える）', () => { for (const u of ksActiveUnits().filter(u => KS_B2B.includes(ksS(u).eng))) { ksEvtMod(u, 'demand', 1.1, 6); ksEvtMod(u, 'ot', 1.2, 6); } return '注文を受けました。人員の手当てと残業の管理に気をつけましょう'; }],
      ['断る', () => '今回は見送りました']] },
  pricecut: { t: '主な取引先からの値下げの要請', p: () => (ksHasEngIn(['mfg', 'trade', 'build']) ? 0.004 : 0),
    body: () => '主な取引先から「来期から納入の価格を2%下げてほしい」と求められました。取適法では、取引先が一方的に価格を決めることは禁止されていますが、協議の結果として下げるのは自由です。',
    ch: [['受け入れる（1年、売上が2%減る）', () => { for (const u of ksActiveUnits().filter(u => KS_B2B.includes(ksS(u).eng))) ksEvtMod(u, 'demand', 0.98, 12); return '値下げを受け入れました'; }],
      ['原価の根拠を示して協議する（費用50万円。半分の確率で据え置き）', () => { ksPayCash('fees', 50e4, 'evt'); if (chance2(0.5)) return '協議の結果、価格は据え置きになりました'; for (const u of ksActiveUnits().filter(u => KS_B2B.includes(ksS(u).eng))) ksEvtMod(u, 'demand', 0.985, 12); return '協議の結果、1.5%の値下げで合意しました'; }],
      ['断る（取引が減るおそれ）', () => { if (chance2(0.5)) { for (const u of ksActiveUnits().filter(u => KS_B2B.includes(ksS(u).eng))) ksEvtMod(u, 'demand', 0.93, 6); return '取引先は注文の一部を他社に移しました'; } return '取引先は引き下がりました'; }]] },
  union: { t: '労働組合の結成と団体交渉', p: () => (G.hr && G.hr.es < 42 && ksHeadcount() >= 30 ? 0.01 : 0),
    body: () => `従業員が労働組合を結成し、賃上げ（3%）と残業の削減を求めて団体交渉を申し入れてきました。会社は正当な理由なく団体交渉を断れません（労働組合法7条：不当労働行為）。従業員満足度は${fmtNum(G.hr.es, 0)}点です。`,
    ch: [['3%の賃上げに応じる', () => { G.wageLv = +((G.wageLv || 1) * 1.03).toFixed(4); G.hr.es += 6; return '賃上げに応じました。人件費は増えますが、職場は落ち着きました'; }],
      ['1.5%で妥結する', () => { G.wageLv = +((G.wageLv || 1) * 1.015).toFixed(4); G.hr.es += 2; return '1.5%の賃上げで妥結しました'; }],
      ['応じない', () => { G.hr.es -= 6; if (chance2(0.5)) { for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.9, 1); return 'ストライキが起き、1か月の営業に響きました'; } return '交渉は物別れに終わりました。満足度が下がっています'; }]] },
  poach: { t: '中心の社員の引き抜き', p: () => (G.hr && G.hr.es < 47 && ksHeadcount() >= 10 ? 0.008 : 0), auto: true,
    run: () => { const u = pick2(ksActiveUnits()); if (!u) return null; ksEvtMod(u, 'demand', 0.96, 3); return { body: `${ksUName(u)}の中心の社員が、競合の会社に引き抜かれました。3か月ほど仕事の質が落ちます。満足度（今 ${fmtNum(G.hr.es, 0)}点）が低いと、人が辞めやすくなります。`, tone: 'bad' }; } },
  whistle: { t: '内部通報（ハラスメントの訴え）', p: () => (ksHeadcount() >= 20 ? 0.004 * (typeof ksHrF === 'function' ? ksHrF(null, 'viol') : 1) : 0),
    body: () => '内部通報の窓口に、管理職によるパワーハラスメントの訴えが届きました。公益通報者保護法では、通報した人に不利益な扱いをしてはいけません（2026年12月から刑事罰）。',
    ch: [['外部の弁護士に調査を頼む（費用150万円）', () => { ksPayCash('fees', 150e4, 'evt'); G.hr.es += 2; return '調査の結果、事実を確認して処分と再発防止をしました。職場の信頼が少し戻りました'; }],
      ['社内で穏便に済ませる', () => { if (chance2(0.35)) { G.hr.es -= 6; for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.96, 3); return '対応の遅れが報道され、評判が下がりました。満足度も下がっています'; } G.hr.es -= 2; return '表立った問題にはなりませんでしたが、職場の空気は悪くなりました'; }]] },
  enjo: { t: 'SNSでの炎上', p: () => (ksHasEngIn(['shop', 'rest', 'subs', 'cap']) ? 0.003 : 0),
    body: () => '店舗での対応を撮った動画がSNSで広まり、批判が集まっています。',
    ch: [['すぐに謝罪し、再発防止を発表する（費用100万円）', () => { ksPayCash('ads', 100e4, 'evt'); for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.98, 2); return '謝罪と再発防止で、騒ぎは2か月ほどで落ち着きました'; }],
      ['事実と違うと反論する', () => { if (chance2(0.5)) { for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.92, 3); return '反論がさらに批判を呼び、客足が落ちました'; } return '反論が受け入れられ、騒ぎは収まりました'; }]] },
  cyber: { t: 'サイバー攻撃（ランサムウェア）', p: () => 0.002 * (typeof ksHrF === 'function' ? ksHrF(null, 'leak') : 1), auto: true,
    run: () => { const loss = Math.round(Math.max(200e4, ksAnnualSales() * uni2(0.001, 0.004)) / 1e4) * 1e4; ksPayCash('fees', loss, 'evt'); for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.9, 1); return { body: `ランサムウェアに感染し、システムが止まりました。復旧と調査に${fmtYen(loss)}かかり、1か月の営業に響きました。個人データが漏れたおそれがあれば、個人情報保護委員会への報告（速報3〜5日・確報30日）と本人への通知が要ります。DX・コンプライアンスへの取り組みで危険を減らせます。`, tone: 'bad' }; } },
  taxaudit: { t: '税務調査', p: () => (ksAnnualSales() > 1e8 ? 0.008 : 0.003) * (G.group && ksSubs(G).some(s => s.cc && s.cc !== 'jp') ? 1.6 : 1), auto: true,
    run: () => {
      const L = ksLastFY();
      if (!L) return null;
      let base = Math.max(0, L.pl.pretax) * uni2(0.01, 0.05);
      const notes = ['売上の計上の時期（期ずれ）の確認'];
      // 海外子会社の経営指導料が高いと、移転価格の指摘
      if (G.group) for (const s of ksSubs(G)) if (s.cc && s.cc !== 'jp' && s.fee > 0.03) { base += ksWith(s.st, ksAnnualSales) * (s.fee - 0.03) * 0.3; notes.push(`${s.name}の経営指導料の料率（${(s.fee * 100).toFixed(1)}%）の根拠`); }
      if (G.law && G.law.done.tp === undefined && G.group && ksSubs(G).some(s => s.cc && s.cc !== 'jp')) { base *= 1.5; notes.push('移転価格の文書がない'); }
      const add = Math.round(base * 0.3);
      const kasan = Math.round(add * 0.1), entai = Math.round(add * 0.03);
      const tot = Math.round((add + kasan + entai) / 1e4) * 1e4;
      if (tot < 10e4) return { body: `税務署の調査がありました（${notes.join('・')}）。特に問題はなく、追徴はありませんでした。日ごろの正しい記帳の成果です。`, tone: 'good' };
      ksPost('taxAudit', [['taxExp', add, 0], ['fines', kasan + entai, 0], ['cash', 0, add + kasan + entai]], { u: 'HQ', cf: 'tax', desc: '税務調査の追徴（本税・過少申告加算税・延滞税）' });
      return { body: `税務署の調査で、${notes.join('・')}について指摘を受けました。本税${fmtYen(add)}と過少申告加算税（10%）・延滞税を合わせて${fmtYen(tot)}を納めます（本税は法人税等、加算税・延滞税は損金にならない）。`, tone: 'bad' };
    } },
  subsidy: { t: '補助金の公募', p: () => (ksHasEngIn(['mfg', 'pro', 'subs', 'shop', 'rest']) ? 0.006 : 0),
    body: () => '国の補助金（中小企業の省力化・生産性向上の投資の補助金）の公募が始まりました。採択されると、設備投資の半分（上限1,250万円）を後から受け取れます。申請には事業計画書が必要です。',
    ch: [['専門家に頼んで申請する（費用60万円。採択はおよそ6割）', () => { ksPayCash('fees', 60e4, 'evt'); if (chance2(0.6)) { G.evt = G.evt || { mods: [] }; G.evt.subsidy = { m: G.m + 6, amt: Math.round(clamp(ksAnnualSales() * 0.01, 300e4, 1250e4) / 1e4) * 1e4 }; return `採択されました。投資の後、${ymLabel(G.m + 6)}ごろに補助金が入る予定です`; } return '今回は不採択でした'; }],
      ['申請しない', () => '今回は申請しませんでした']] },
  csraudit: { t: '取引先からのCSR調達の監査', p: () => (ksHasEngIn(['mfg', 'trade']) ? 0.004 : 0), auto: true,
    run: () => {
      const good = G.hr && (['comply', 'quality', 'risk'].includes(G.hr.creed) || ksHrPris().some(p => ['comply', 'esg'].includes(p.id)));
      const viol = ksLawViolations().size;
      if (good && viol <= 1) { for (const u of ksActiveUnits().filter(u => ['mfg', 'trade'].includes(ksS(u).eng))) ksEvtMod(u, 'demand', 1.02, 12); return { body: '大手の取引先から、人権・環境・法令順守の取り組み（CSR調達）の監査を受けました。取り組みが評価され、取引が増えます。', tone: 'good' }; }
      for (const u of ksActiveUnits().filter(u => ['mfg', 'trade'].includes(ksS(u).eng))) ksEvtMod(u, 'demand', 0.97, 6);
      return { body: `大手の取引先から、人権・環境・法令順守の取り組み（CSR調達）の監査を受けました。${viol ? `法令の違反（${viol}件）があり、` : ''}改善を求められ、一部の取引が止まりました。`, tone: 'bad' };
    } },
  material: { t: '原材料の急な値上がり', p: () => (ksHasEngIn(['mfg', 'rest', 'build']) ? 0.004 : 0), auto: true,
    run: () => { G.eco.matIdx = +(G.eco.matIdx * 1.06).toFixed(4); G.evt.matRev = { f: Math.pow(1.06, 1 / 12), n: 12 }; return { body: '世界の需給の逼迫で、原材料の相場が6%ほど上がりました。仕入の価格が上がり、利益が減ります。相場は1年ほどかけて落ち着いていきますが、その間は販売の価格への転嫁と、取引先との価格の協議（取適法で協議に応じる義務がある）が大切です。', tone: 'bad' }; } },
  subscandal: { t: '子会社の不祥事', p: () => (G.group && ksSubs(G).length ? 0.003 * ksSubs(G).length * (typeof ksHrF === 'function' ? ksHrF(null, 'viol') : 1) : 0),
    body: () => { const s = pick2(ksSubs(G)); G.evt = G.evt || { mods: [] }; G.evt.cur = s.id; return `子会社の${s.name}で、品質の検査データの改ざんが見つかりました。グループ全体の信頼が問われています。`; },
    ch: [['第三者委員会を設けて調べ、公表する（費用1,000万円）', () => { ksPayCash('fees', 1000e4, 'evt'); for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.99, 3); const s = ksSubById(G.evt.cur, G); if (s) ksWith(s.st, () => { for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.92, 6); }); return '調査の結果を公表し、再発防止を約束しました。影響は小さく抑えられました'; }],
      ['子会社の中で処理する', () => { const s = ksSubById(G.evt.cur, G); if (chance2(0.5)) { for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.95, 6); if (s) ksWith(s.st, () => { for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.8, 9); }); return '後から報道され、グループ全体の評判が大きく下がりました'; } if (s) ksWith(s.st, () => { for (const u of ksActiveUnits()) ksEvtMod(u, 'demand', 0.95, 6); }); return '大きな問題にはなりませんでした'; }]] },
  overseas: { t: '進出先の国の出来事', p: () => (ksForeignCountries().length ? 0.004 * ksForeignCountries().length : 0), auto: true,
    run: () => {
      const cc = pick2(ksForeignCountries());
      const C = KS_COUNTRIES[cc];
      const loss = Math.round(Math.max(100e4, ksAnnualSales() * uni2(0.0005, 0.002)) / 1e4) * 1e4;
      ksPayCash('fees', loss, 'evt');
      return { body: `${C.n}で、規制の変更と行政の手続の遅れ（${C.risk}）がありました。現地の対応に${fmtYen(loss)}かかりました。`, tone: 'bad' };
    } },
};
function ksEvt2Month(ctx) {
  if (G.isSub) return;
  G.evt = G.evt || { mods: [], log: [], cnt: {} };
  G.evt.mods = (G.evt.mods || []).filter(x => x.until > G.m);
  // 原材料の急な値上がりは、1年ほどかけて落ち着く
  if (G.evt.matRev && G.evt.matRev.n > 0) { G.eco.matIdx = +(G.eco.matIdx / G.evt.matRev.f).toFixed(4); G.evt.matRev.n--; }
  // 補助金の入金
  if (G.evt.subsidy && G.evt.subsidy.m <= G.m) {
    const a = G.evt.subsidy.amt;
    ksPost('subsidy', [['cash', a, 0], ['miscInc', 0, a]], { u: 'HQ', cf: 'other', desc: '補助金の入金（国庫補助金）' });
    ksNews(`補助金${fmtYen(a)}が入金されました（雑収入。設備の補助金は、特別利益として圧縮記帳することも多い）`, 'good');
    G.evt.subsidy = null;
  }
  // 1か月に1つまで
  for (const [id, E] of Object.entries(KS_EVT2)) {
    const last = G.evt.cnt[id];
    if (last !== undefined && G.m - last < 12) continue;
    const p = E.p();
    if (!p || !chance2(p)) continue;
    G.evt.cnt[id] = G.m;
    if (E.auto) {
      const r = E.run();
      if (!r) continue;
      ksNews(`【${E.t}】${r.body}`, r.tone || 'info');
      G.pendingModals.push({ type: 'kEvt', id, body: r.body, tone: r.tone });
    } else {
      G.pendingModals.push({ type: 'kEvt', id, body: E.body(), choose: true });
    }
    break;
  }
}
/* 選んだ対応を実行する（画面から。ボットは最初の選択肢） */
function ksEvtChoose(id, i) {
  G.evt = G.evt || { mods: [], log: [], cnt: {} };
  G.evt.mods = G.evt.mods || [];
  const E = KS_EVT2[id];
  if (!E || !E.ch || !E.ch[i]) return '';
  const msg = E.ch[i][1]();
  if (G.hr) G.hr.es = clamp(G.hr.es, 5, 95);
  G.evt.log = G.evt.log || [];
  G.evt.log.unshift({ m: G.m, id, t: E.t, ch: E.ch[i][0], msg });
  if (G.evt.log.length > 30) G.evt.log.length = 30;
  ksNews(`【${E.t}】${E.ch[i][0]}：${msg}`, 'info');
  return msg;
}
/* 一時的な効果を、事業の計算に組み込む */
const ksUpgradeFE0 = ksUpgradeF;
ksUpgradeF = function (u, key) { return ksUpgradeFE0(u, key) * (G && G.evt ? ksEvtF(u, key) : 1); };
const ksOtHoursUE0 = ksOtHoursU;
ksOtHoursU = function (u) { return ksOtHoursUE0(u) * (G && G.evt ? ksEvtF(u, 'ot') : 1); };

/* ---------- 年間の予定（社長のカレンダー） ---------- */
const KS_CAL = [
  [4, '新しい期の始まり。予算・重点実施事項・目標を決める（入社式・新入社員の配属）'],
  [4, '前期末の未払費用・前払費用の再振替'],
  [5, '法人税・消費税の申告と納付（決算から2か月以内）'],
  [5, '障害者雇用納付金の申告（100人超）'],
  [6, '定時株主総会（計算書類の承認・役員の選任）と決算公告'],
  [6, '夏の賞与・労働保険の年度更新（6月1日〜7月10日）・熱中症の対策'],
  [6, '産業廃棄物の管理票の報告（6月30日）・障害者の雇用状況の報告'],
  [7, '社会保険の算定基礎届（7月10日まで）・省エネ法の定期報告（7月末）'],
  [7, '地価調査（7月1日の地価）・全国安全週間'],
  [9, '防災の日（9月1日）の訓練'],
  [10, '最低賃金の改定（パート・アルバイトの時給の確認）・内定式'],
  [11, '年末調整の準備（扶養控除の申告書を集める）'],
  [12, '冬の賞与・年末調整'],
  [1, '償却資産の申告・法定調書・給与支払報告書（1月31日まで）'],
  [2, '春の賃上げの交渉（春闘）の準備・来期の予算の検討'],
  [3, '決算（実地棚卸・減価償却・引当金・税金）・36協定の締結と届出'],
];
function ksCalendar(fromM = G.m, n = 12) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const m = fromM + k, mo = calMonth(m);
    const items = KS_CAL.filter(x => x[0] === mo).map(x => ({ t: x[1], kind: 'cal' }));
    for (const x of KS_LAW_TL) if (x.m === m) items.push({ t: `【法改正】${x.t}`, kind: 'law' });
    if (G.law) for (const x of ksLawTasks()) {
      if (x.st === 'ok') continue;
      const f = ksTaskFreq(x.t);
      if (f === 'fy' && x.t.dueMo === mo) items.push({ t: `期限：${x.name}`, kind: x.st === 'over' ? 'over' : 'due' });
    }
    if (items.length) out.push({ m, items });
  }
  return out;
}
