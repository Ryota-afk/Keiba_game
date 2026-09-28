// 日本ダービー（東京優駿）歴代優勝馬データ（1974〜2024年・51頭）。
// domain/dreamDerby.js §「相手馬」で、夢のダービーの相手17頭（顕彰馬9頭固定＋残り8頭を
// 保存データごとに抽選）の元データとして使う（詳細はARCHITECTURE.md §11）。
//
// ⚠️⚠️このファイルの内容（`DERBY_WINNERS`の各行）は、出典元のライセンスをそのまま引き継ぐ。
// このファイル1つだけがそのライセンスの対象で、他の`src/`ファイルには及ばない
// （design/rights-check.md §6の決定「wikiを使おう」）。
//
// 出典：Wikipedia日本語版「東京優駿」
//   https://ja.wikipedia.org/wiki/東京優駿
//   取得日：2026-09-06
// ライセンス：クリエイティブ・コモンズ 表示-継承 4.0 国際 (CC BY-SA 4.0)
//   https://creativecommons.org/licenses/by-sa/4.0/deed.ja
//
// ⚠️馬名・レース結果そのものは事実であり著作権の対象外（ギャロップレーサー事件・最高裁
// 平成16年2月13日判決、design/rights-check.md §1）。ここでCC BY-SAの対象として扱うのは
// Wikipediaの記事から書き起こした「歴代優勝馬の一覧」という編集された表そのもの。
//
// ⚠️騎手名・調教師名は実在の人物であり、このファイルの値をそのまま画面や実況に出さない
// こと。表示するときは`data/derbyPeopleNames.js`の`displayJockeyName`/`displayTrainerName`
// を必ず経由する（対応表が空のうちは「？」が出る）。

/**
 * @typedef {{
 *   year: number,      // 施行年（西暦）
 *   kai: number,        // 回数（第◯回東京優駿）
 *   horse: string,       // 優勝馬名（実名。ゲーム内にそのまま表示してよい）
 *   jockey: string,      // 騎手名（実名。画面に直接出さない。もじり変換を経由する）
 *   trainer: string,     // 調教師名（実名。画面に直接出さない。もじり変換を経由する）
 *   owner: string,       // 馬主名（実名。現時点では未使用）
 *   time: string,        // 勝ちタイム（"分:秒.コンマ秒"表記）
 * }} DerbyWinnerRecord
 */

/** @type {DerbyWinnerRecord[]} */
export const DERBY_WINNERS = Object.freeze([
  { year: 1974, kai: 41, horse: "コーネルランサー", jockey: "中島啓之", trainer: "勝又忠", owner: "久保谷唯三", time: "2:27.4" },
  { year: 1975, kai: 42, horse: "カブラヤオー", jockey: "菅原泰夫", trainer: "茂木為二郎", owner: "加藤よし子", time: "2:28.0" },
  { year: 1976, kai: 43, horse: "クライムカイザー", jockey: "加賀武見", trainer: "佐藤嘉秋", owner: "（有）三登", time: "2:27.6" },
  { year: 1977, kai: 44, horse: "ラッキールーラ", jockey: "伊藤正徳", trainer: "尾形藤吉", owner: "吉原貞敏", time: "2:28.7" },
  { year: 1978, kai: 45, horse: "サクラショウリ", jockey: "小島太", trainer: "久保田彦之", owner: "（株）さくらコマース", time: "2:27.8" },
  { year: 1979, kai: 46, horse: "カツラノハイセイコ", jockey: "松本善登", trainer: "庄野穂積", owner: "（株）桂土地", time: "2:27.3" },
  { year: 1980, kai: 47, horse: "オペックホース", jockey: "郷原洋行", trainer: "佐藤勇", owner: "（株）ホース産業", time: "2:27.8" },
  { year: 1981, kai: 48, horse: "カツトップエース", jockey: "大崎昭一", trainer: "菊池一雄", owner: "勝本正男", time: "2:28.5" },
  { year: 1982, kai: 49, horse: "バンブーアトラス", jockey: "岩元市三", trainer: "布施正", owner: "竹田辰一", time: "2:26.5" },
  { year: 1983, kai: 50, horse: "ミスターシービー", jockey: "吉永正人", trainer: "松山康久", owner: "千明牧場", time: "2:29.5" },
  { year: 1984, kai: 51, horse: "シンボリルドルフ", jockey: "岡部幸雄", trainer: "野平祐二", owner: "シンボリ牧場", time: "2:29.3" },
  { year: 1985, kai: 52, horse: "シリウスシンボリ", jockey: "加藤和宏", trainer: "二本柳俊夫", owner: "和田共弘", time: "2:31.0" },
  { year: 1986, kai: 53, horse: "ダイナガリバー", jockey: "増沢末夫", trainer: "松山吉三郎", owner: "（有）社台レースホース", time: "2:28.9" },
  { year: 1987, kai: 54, horse: "メリーナイス", jockey: "根本康広", trainer: "橋本輝雄", owner: "浦房子", time: "2:27.8" },
  { year: 1988, kai: 55, horse: "サクラチヨノオー", jockey: "小島太", trainer: "境勝太郎", owner: "（株）さくらコマース", time: "2:26.3" },
  { year: 1989, kai: 56, horse: "ウィナーズサークル", jockey: "郷原洋行", trainer: "松山康久", owner: "栗山博", time: "2:28.8" },
  { year: 1990, kai: 57, horse: "アイネスフウジン", jockey: "中野栄治", trainer: "加藤修甫", owner: "小林正明", time: "2:25.3" },
  { year: 1991, kai: 58, horse: "トウカイテイオー", jockey: "安田隆行", trainer: "松元省一", owner: "内村正則", time: "2:25.9" },
  { year: 1992, kai: 59, horse: "ミホノブルボン", jockey: "小島貞博", trainer: "戸山為夫", owner: "（有）ミホノインターナショナル", time: "2:27.8" },
  { year: 1993, kai: 60, horse: "ウイニングチケット", jockey: "柴田政人", trainer: "伊藤雄二", owner: "太田美實", time: "2:25.5" },
  { year: 1994, kai: 61, horse: "ナリタブライアン", jockey: "南井克巳", trainer: "大久保正陽", owner: "山路秀則", time: "2:25.7" },
  { year: 1995, kai: 62, horse: "タヤスツヨシ", jockey: "小島貞博", trainer: "鶴留明雄", owner: "横瀬寛一", time: "2:27.3" },
  { year: 1996, kai: 63, horse: "フサイチコンコルド", jockey: "藤田伸二", trainer: "小林稔", owner: "関口房朗", time: "2:26.1" },
  { year: 1997, kai: 64, horse: "サニーブライアン", jockey: "大西直宏", trainer: "中尾銑治", owner: "宮崎守保", time: "2:25.9" },
  { year: 1998, kai: 65, horse: "スペシャルウィーク", jockey: "武豊", trainer: "白井寿昭", owner: "臼田浩義", time: "2:25.8" },
  { year: 1999, kai: 66, horse: "アドマイヤベガ", jockey: "武豊", trainer: "橋田満", owner: "近藤利一", time: "2:25.3" },
  { year: 2000, kai: 67, horse: "アグネスフライト", jockey: "河内洋", trainer: "長浜博之", owner: "渡辺孝男", time: "2:26.2" },
  { year: 2001, kai: 68, horse: "ジャングルポケット", jockey: "角田晃一", trainer: "渡辺栄", owner: "齊藤四方司", time: "2:27.0" },
  { year: 2002, kai: 69, horse: "タニノギムレット", jockey: "武豊", trainer: "松田国英", owner: "谷水雄三", time: "2:26.2" },
  { year: 2003, kai: 70, horse: "ネオユニヴァース", jockey: "M.デムーロ", trainer: "瀬戸口勉", owner: "（有）社台レースホース", time: "2:28.5" },
  { year: 2004, kai: 71, horse: "キングカメハメハ", jockey: "安藤勝己", trainer: "松田国英", owner: "金子真人", time: "2:23.3" },
  { year: 2005, kai: 72, horse: "ディープインパクト", jockey: "武豊", trainer: "池江泰郎", owner: "金子真人", time: "2:23.3" },
  { year: 2006, kai: 73, horse: "メイショウサムソン", jockey: "石橋守", trainer: "瀬戸口勉", owner: "松本好雄", time: "2:27.9" },
  { year: 2007, kai: 74, horse: "ウオッカ", jockey: "四位洋文", trainer: "角居勝彦", owner: "谷水雄三", time: "2:24.5" },
  { year: 2008, kai: 75, horse: "ディープスカイ", jockey: "四位洋文", trainer: "昆貢", owner: "深見敏男", time: "2:26.7" },
  { year: 2009, kai: 76, horse: "ロジユニヴァース", jockey: "横山典弘", trainer: "萩原清", owner: "久米田正明", time: "2:33.7" },
  { year: 2010, kai: 77, horse: "エイシンフラッシュ", jockey: "内田博幸", trainer: "藤原英昭", owner: "平井豊光", time: "2:26.9" },
  { year: 2011, kai: 78, horse: "オルフェーヴル", jockey: "池添謙一", trainer: "池江泰寿", owner: "（有）サンデーレーシング", time: "2:30.5" },
  { year: 2012, kai: 79, horse: "ディープブリランテ", jockey: "岩田康誠", trainer: "矢作芳人", owner: "（有）サンデーレーシング", time: "2:23.8" },
  { year: 2013, kai: 80, horse: "キズナ", jockey: "武豊", trainer: "佐々木晶三", owner: "前田晋二", time: "2:24.3" },
  { year: 2014, kai: 81, horse: "ワンアンドオンリー", jockey: "横山典弘", trainer: "橋口弘次郎", owner: "前田幸治", time: "2:24.6" },
  { year: 2015, kai: 82, horse: "ドゥラメンテ", jockey: "M.デムーロ", trainer: "堀宣行", owner: "（有）サンデーレーシング", time: "2:23.2" },
  { year: 2016, kai: 83, horse: "マカヒキ", jockey: "川田将雅", trainer: "友道康夫", owner: "（株）金子真人ホールディングス", time: "2:24.0" },
  { year: 2017, kai: 84, horse: "レイデオロ", jockey: "C.ルメール", trainer: "藤沢和雄", owner: "（有）キャロットファーム", time: "2:26.9" },
  { year: 2018, kai: 85, horse: "ワグネリアン", jockey: "福永祐一", trainer: "友道康夫", owner: "（株）金子真人ホールディングス", time: "2:23.6" },
  { year: 2019, kai: 86, horse: "ロジャーバローズ", jockey: "浜中俊", trainer: "角居勝彦", owner: "猪熊広次", time: "2:22.6" },
  { year: 2020, kai: 87, horse: "コントレイル", jockey: "福永祐一", trainer: "矢作芳人", owner: "前田晋二", time: "2:24.1" },
  { year: 2021, kai: 88, horse: "シャフリヤール", jockey: "福永祐一", trainer: "藤原英昭", owner: "（有）サンデーレーシング", time: "2:22.5" },
  { year: 2022, kai: 89, horse: "ドウデュース", jockey: "武豊", trainer: "友道康夫", owner: "（株）キーファーズ", time: "2:21.9" },
  { year: 2023, kai: 90, horse: "タスティエーラ", jockey: "D.レーン", trainer: "堀宣行", owner: "（有）キャロットファーム", time: "2:25.2" },
  { year: 2024, kai: 91, horse: "ダノンデサイル", jockey: "横山典弘", trainer: "安田翔伍", owner: "（株）ダノックス", time: "2:24.3" },
]);

// JRA顕彰馬9頭（domain/dreamDerby.js §「相手馬」で毎回固定で入れる）。
// ⚠️馬名は`DERBY_WINNERS`内の`horse`と完全一致させること（`pickDreamRivalRecords`が
// この配列を使って`DERBY_WINNERS`から行を引く）。
export const KENSHO_DERBY_WINNERS = Object.freeze([
  "ミスターシービー",
  "シンボリルドルフ",
  "トウカイテイオー",
  "ナリタブライアン",
  "キングカメハメハ",
  "ディープインパクト",
  "ウオッカ",
  "オルフェーヴル",
  "コントレイル",
]);
