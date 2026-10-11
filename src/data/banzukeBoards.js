// 番付の表の定義（`arch/banzuke.md`・`devlog/wave12.md`§19）。リテラルのみ（ロジックは`view/banzukeView.js`）。
// 並べる順は今年の獲得賞金。各番付10頭。

/** 馬の番付7つ。`id`は固定値（セーブ・画面が参照する）、`label`は画面の表記。この並びが画面の並び。 */
export const BANZUKE_BOARDS = Object.freeze([
  Object.freeze({ id: "3yo-colt", label: "3歳牡馬" }),
  Object.freeze({ id: "3yo-filly", label: "3歳牝馬" }),
  Object.freeze({ id: "3yo-dirt", label: "3歳ダート" }),
  Object.freeze({ id: "older-classic", label: "古馬王道" }),
  Object.freeze({ id: "older-mile", label: "古馬マイル短距離" }),
  Object.freeze({ id: "older-filly", label: "古馬牝馬" }),
  Object.freeze({ id: "older-dirt", label: "古馬ダート" }),
]);

/** 8つ目の番付（騎手の勝ち数）の画面表記。 */
export const BANZUKE_JOCKEY_LABEL = "騎手の勝ち数";

/** 1つの番付に出す頭数（騎手は人数）。 */
export const BANZUKE_ROWS = 10;

/** 古馬（4歳以上）の芝で、今年の平均距離がこれ以下ならマイル・短距離の番付、超えたら王道の番付（m）。 */
export const BANZUKE_MILE_MAX_AVG_DISTANCE = 1800;

/** 3歳。これより若い馬（2歳）は番付に入れない。 */
export const BANZUKE_THREE_YEAR_OLD_AGE = 3;
