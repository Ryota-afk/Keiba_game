// 史実ダービー馬51頭の能力値（ウイニングポストの値を土台に、優駿達の蹄跡の
// 全レース戦績で細かい差をつけたもの。変換式・較正の根拠は`arch/historical-horses.md`）。
// ⚠️史実馬の追加はこのファイルの形式を踏襲し、`tools/check-historical.mjs`の
// 検査8項目に全部合格してから追加すること（`arch/historical-horses.md`§6）。
//
// ⚠️2026-09-07にユーザーが確認・承認した（CLAUDE.md §17・`devlog/wave05.md`§47）。
//
// キーは`data/derbyWinners.js`の`horse`（優勝馬名）と完全一致する。

/**
 * @typedef {{
 *   speed: number,          // 0〜100
 *   stamina: number,        // 1〜100
 *   sharpness: string,      // 瞬発力（G〜S+の16段）
 *   grit: string,           // 勝負根性
 *   power: string,          // パワー
 *   flexibility: string,    // 柔軟性（実際の勝ち鞍の幅で戦績補正済み）
 *   health: string,         // 健康
 *   mentalStrength: string, // 精神力
 *   wisdom: string,         // 賢さ
 *   legStyle: "nige"|"senko"|"sashi"|"oikomi", // 参考値。今はsimに未接続
 *                           // （脚質は`domain/strategy.js`の`deriveFavoredStrategy`が
 *                           // 能力値から導く。史実の脚質をsimへ反映するかは未決定）
 *   derived: boolean,       // trueならウイポ未収録で全レース戦績から導いた値
 * }} HistoricalHorseAbilities
 */

/** @type {Record<string, HistoricalHorseAbilities>} */
export const DERBY_HORSE_ABILITIES = Object.freeze({
  "コーネルランサー": { speed: 73, stamina: 47, sharpness: "C", grit: "B+", power: "C+", flexibility: "C+", health: "D+", mentalStrength: "C+", wisdom: "C", legStyle: "senko", derived: false }, // 1974
  "カブラヤオー": { speed: 81, stamina: 54, sharpness: "B+", grit: "S", power: "A+", flexibility: "B", health: "B", mentalStrength: "D+", wisdom: "E", legStyle: "nige", derived: false }, // 1975
  "クライムカイザー": { speed: 72, stamina: 57, sharpness: "B+", grit: "C", power: "C+", flexibility: "C+", health: "C+", mentalStrength: "D+", wisdom: "C", legStyle: "sashi", derived: false }, // 1976
  "ラッキールーラ": { speed: 70, stamina: 48, sharpness: "D+", grit: "B+", power: "B", flexibility: "C", health: "B", mentalStrength: "C+", wisdom: "D", legStyle: "senko", derived: false }, // 1977
  "サクラショウリ": { speed: 73, stamina: 64, sharpness: "B", grit: "A", power: "C+", flexibility: "C+", health: "D+", mentalStrength: "C", wisdom: "B", legStyle: "senko", derived: false }, // 1978
  "カツラノハイセイコ": { speed: 78, stamina: 71, sharpness: "B+", grit: "D+", power: "B+", flexibility: "S+", health: "D+", mentalStrength: "B", wisdom: "C+", legStyle: "sashi", derived: false }, // 1979
  "オペックホース": { speed: 66, stamina: 53, sharpness: "D+", grit: "B+", power: "B", flexibility: "C+", health: "A", mentalStrength: "C+", wisdom: "B", legStyle: "senko", derived: false }, // 1980
  "カツトップエース": { speed: 77, stamina: 50, sharpness: "B", grit: "A", power: "B+", flexibility: "C+", health: "E+", mentalStrength: "D+", wisdom: "B", legStyle: "nige", derived: false }, // 1981
  "バンブーアトラス": { speed: 76, stamina: 50, sharpness: "A+", grit: "B+", power: "B", flexibility: "B+", health: "F+", mentalStrength: "C+", wisdom: "D+", legStyle: "sashi", derived: false }, // 1982
  "ミスターシービー": { speed: 83, stamina: 69, sharpness: "S", grit: "B+", power: "B+", flexibility: "S+", health: "B", mentalStrength: "B", wisdom: "B+", legStyle: "oikomi", derived: false }, // 1983
  "シンボリルドルフ": { speed: 92, stamina: 76, sharpness: "B+", grit: "S", power: "A+", flexibility: "S+", health: "B", mentalStrength: "B+", wisdom: "S", legStyle: "senko", derived: false }, // 1984
  "シリウスシンボリ": { speed: 69, stamina: 59, sharpness: "B", grit: "B+", power: "B", flexibility: "D+", health: "D+", mentalStrength: "A", wisdom: "A", legStyle: "senko", derived: false }, // 1985
  "ダイナガリバー": { speed: 77, stamina: 69, sharpness: "D+", grit: "A", power: "B+", flexibility: "B", health: "D+", mentalStrength: "B+", wisdom: "B+", legStyle: "senko", derived: false }, // 1986
  "メリーナイス": { speed: 77, stamina: 53, sharpness: "B+", grit: "B+", power: "B+", flexibility: "D+", health: "D+", mentalStrength: "B+", wisdom: "B+", legStyle: "senko", derived: false }, // 1987
  "サクラチヨノオー": { speed: 78, stamina: 49, sharpness: "D+", grit: "B+", power: "A", flexibility: "C", health: "F+", mentalStrength: "B+", wisdom: "A", legStyle: "senko", derived: false }, // 1988
  "ウィナーズサークル": { speed: 70, stamina: 62, sharpness: "B", grit: "D+", power: "A", flexibility: "E+", health: "F+", mentalStrength: "D", wisdom: "A", legStyle: "sashi", derived: false }, // 1989
  "アイネスフウジン": { speed: 81, stamina: 51, sharpness: "D+", grit: "B+", power: "A", flexibility: "C+", health: "D+", mentalStrength: "D+", wisdom: "A+", legStyle: "nige", derived: false }, // 1990
  "トウカイテイオー": { speed: 88, stamina: 68, sharpness: "A+", grit: "A+", power: "B+", flexibility: "D", health: "F+", mentalStrength: "A+", wisdom: "S", legStyle: "senko", derived: false }, // 1991
  "ミホノブルボン": { speed: 87, stamina: 60, sharpness: "B+", grit: "S", power: "A+", flexibility: "B", health: "C", mentalStrength: "B", wisdom: "B+", legStyle: "nige", derived: false }, // 1992
  "ウイニングチケット": { speed: 77, stamina: 65, sharpness: "A+", grit: "B+", power: "B+", flexibility: "D", health: "D+", mentalStrength: "C+", wisdom: "B", legStyle: "sashi", derived: false }, // 1993
  "ナリタブライアン": { speed: 91, stamina: 73, sharpness: "S", grit: "B+", power: "A+", flexibility: "S+", health: "C", mentalStrength: "A+", wisdom: "D+", legStyle: "sashi", derived: false }, // 1994
  "タヤスツヨシ": { speed: 75, stamina: 56, sharpness: "A", grit: "D+", power: "B+", flexibility: "C+", health: "B", mentalStrength: "D+", wisdom: "A", legStyle: "oikomi", derived: false }, // 1995
  "フサイチコンコルド": { speed: 76, stamina: 70, sharpness: "A+", grit: "D+", power: "A+", flexibility: "C", health: "F+", mentalStrength: "B+", wisdom: "B+", legStyle: "sashi", derived: false }, // 1996
  "サニーブライアン": { speed: 73, stamina: 62, sharpness: "D+", grit: "A+", power: "B+", flexibility: "D+", health: "C", mentalStrength: "B", wisdom: "B+", legStyle: "nige", derived: false }, // 1997
  "スペシャルウィーク": { speed: 86, stamina: 78, sharpness: "S", grit: "B+", power: "B+", flexibility: "S+", health: "B+", mentalStrength: "A+", wisdom: "S", legStyle: "sashi", derived: false }, // 1998
  "アドマイヤベガ": { speed: 82, stamina: 68, sharpness: "A+", grit: "B+", power: "A", flexibility: "E+", health: "D+", mentalStrength: "B+", wisdom: "B+", legStyle: "oikomi", derived: false }, // 1999
  "アグネスフライト": { speed: 71, stamina: 62, sharpness: "A", grit: "B+", power: "B", flexibility: "B", health: "F+", mentalStrength: "C+", wisdom: "B", legStyle: "oikomi", derived: false }, // 2000
  "ジャングルポケット": { speed: 80, stamina: 72, sharpness: "S", grit: "B+", power: "B+", flexibility: "C+", health: "B+", mentalStrength: "B+", wisdom: "B+", legStyle: "sashi", derived: false }, // 2001
  "タニノギムレット": { speed: 81, stamina: 51, sharpness: "A+", grit: "D+", power: "B+", flexibility: "B", health: "C", mentalStrength: "B+", wisdom: "B+", legStyle: "sashi", derived: false }, // 2002
  "ネオユニヴァース": { speed: 78, stamina: 64, sharpness: "A+", grit: "D+", power: "B+", flexibility: "B", health: "D+", mentalStrength: "B+", wisdom: "B+", legStyle: "sashi", derived: false }, // 2003
  "キングカメハメハ": { speed: 90, stamina: 57, sharpness: "A+", grit: "B+", power: "S", flexibility: "B", health: "D+", mentalStrength: "B+", wisdom: "S", legStyle: "sashi", derived: false }, // 2004
  "ディープインパクト": { speed: 92, stamina: 81, sharpness: "S", grit: "B+", power: "A+", flexibility: "S+", health: "B+", mentalStrength: "S", wisdom: "S", legStyle: "sashi", derived: false }, // 2005
  "メイショウサムソン": { speed: 80, stamina: 74, sharpness: "B+", grit: "B+", power: "B+", flexibility: "S+", health: "S", mentalStrength: "D+", wisdom: "D+", legStyle: "senko", derived: false }, // 2006
  "ウオッカ": { speed: 83, stamina: 51, sharpness: "S", grit: "B+", power: "B+", flexibility: "B", health: "S", mentalStrength: "D+", wisdom: "B+", legStyle: "sashi", derived: false }, // 2007
  "ディープスカイ": { speed: 78, stamina: 52, sharpness: "A+", grit: "B+", power: "B+", flexibility: "B", health: "B+", mentalStrength: "B+", wisdom: "A+", legStyle: "sashi", derived: false }, // 2008
  "ロジユニヴァース": { speed: 72, stamina: 60, sharpness: "C", grit: "B+", power: "A+", flexibility: "E+", health: "F+", mentalStrength: "C", wisdom: "C", legStyle: "senko", derived: false }, // 2009
  "エイシンフラッシュ": { speed: 77, stamina: 74, sharpness: "B+", grit: "D+", power: "A+", flexibility: "B", health: "B", mentalStrength: "B", wisdom: "D+", legStyle: "sashi", derived: false }, // 2010
  "オルフェーヴル": { speed: 88, stamina: 73, sharpness: "S", grit: "D+", power: "A+", flexibility: "S+", health: "B", mentalStrength: "S", wisdom: "A+", legStyle: "oikomi", derived: false }, // 2011
  "ディープブリランテ": { speed: 79, stamina: 57, sharpness: "D+", grit: "A", power: "A+", flexibility: "E+", health: "C+", mentalStrength: "C+", wisdom: "B", legStyle: "senko", derived: false }, // 2012
  "キズナ": { speed: 78, stamina: 70, sharpness: "A+", grit: "D+", power: "A+", flexibility: "B", health: "D+", mentalStrength: "A+", wisdom: "B+", legStyle: "sashi", derived: false }, // 2013
  "ワンアンドオンリー": { speed: 71, stamina: 62, sharpness: "B+", grit: "D+", power: "B+", flexibility: "D", health: "B", mentalStrength: "C+", wisdom: "B", legStyle: "oikomi", derived: false }, // 2014
  "ドゥラメンテ": { speed: 84, stamina: 58, sharpness: "A+", grit: "D+", power: "A+", flexibility: "C", health: "D+", mentalStrength: "B", wisdom: "A+", legStyle: "sashi", derived: false }, // 2015
  "マカヒキ": { speed: 74, stamina: 61, sharpness: "A+", grit: "B+", power: "B+", flexibility: "D", health: "D+", mentalStrength: "A+", wisdom: "B", legStyle: "sashi", derived: false }, // 2016
  "レイデオロ": { speed: 78, stamina: 67, sharpness: "A+", grit: "B+", power: "B+", flexibility: "D", health: "D+", mentalStrength: "C+", wisdom: "B", legStyle: "sashi", derived: false }, // 2017
  "ワグネリアン": { speed: 74, stamina: 59, sharpness: "A", grit: "B", power: "B", flexibility: "E", health: "C+", mentalStrength: "C", wisdom: "C", legStyle: "sashi", derived: false }, // 2018
  "ロジャーバローズ": { speed: 73, stamina: 67, sharpness: "D+", grit: "A", power: "B", flexibility: "D+", health: "F+", mentalStrength: "D", wisdom: "C", legStyle: "senko", derived: true }, // 2019
  "コントレイル": { speed: 87, stamina: 72, sharpness: "A+", grit: "A+", power: "B+", flexibility: "A", health: "C+", mentalStrength: "A+", wisdom: "A+", legStyle: "senko", derived: false }, // 2020
  "シャフリヤール": { speed: 74, stamina: 64, sharpness: "A+", grit: "E", power: "B", flexibility: "C", health: "E+", mentalStrength: "A", wisdom: "B", legStyle: "sashi", derived: false }, // 2021
  "ドウデュース": { speed: 82, stamina: 61, sharpness: "A+", grit: "B", power: "A", flexibility: "C", health: "E+", mentalStrength: "C+", wisdom: "B+", legStyle: "sashi", derived: false }, // 2022
  "タスティエーラ": { speed: 72, stamina: 74, sharpness: "C+", grit: "A+", power: "B+", flexibility: "C", health: "C", mentalStrength: "A+", wisdom: "A", legStyle: "senko", derived: false }, // 2023
  "ダノンデサイル": { speed: 80, stamina: 67, sharpness: "A+", grit: "A+", power: "B+", flexibility: "D", health: "C+", mentalStrength: "A", wisdom: "B", legStyle: "senko", derived: false }, // 2024
});

