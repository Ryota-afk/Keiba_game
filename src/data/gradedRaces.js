// 重賞出走表の索引（ARCHITECTURE.md §3「重賞出走表（1つの表が4つの仕事をする）」）。
//
// ⭐1つの表が4つの仕事をする：
//   1. 史実ローテーション——どの馬がどの重賞に出たか
//   2. 実名の線——重賞に出た馬＝実名にする馬
//   3. 成長型と能力の推定材料——何歳のどの重賞で何着だったか
//   4. カレンダーの材料——どの重賞がいつ行われたか
//
// ⚠️年約130重賞×30年の実データ（約3,900レース・出走馬レコード約54,600件）は
// まだ取得していない（ARCHITECTURE.md §15＝未取得）。
// 取得元はJRA公式HTML（`jra.go.jp/datafile/seiseki/replay/YYYY/jyusyo.html`・2002〜）と
// Wikipedia（〜2001・CC BY-SA 4.0・出典表示が要る）の2本（design/rights-check.md §6）。
// ⚠️創設年・開催月週を記憶だけで埋めない——一次資料と突き合わせていない数値は
// 「史実」として扱えない（CLAUDE.md §0.5「データの丸写しはしない」の逆側の徹底：
// 検証していない値を史実として書かない）。
//
// このファイルは行の形（スキーマ）だけを定義する。中身は取得後に別データファイル
// （例：`gradedRaces.data.js` または出典付きJSON）として追加し、ここでマージする。

/**
 * @typedef {Object} GradedRaceEntry
 * @property {string} id             - レースの一意ID（例: "japan-derby"）
 * @property {string} name           - 実名（重賞名）
 * @property {"g1"|"g2"|"g3"} grade
 * @property {string} courseId       - `courses.js` のid
 * @property {number|null} foundingYear - 創設年（未取得の間はnull）
 * @property {{month:number, weekOfMonth:number}|null} slot - カレンダー上の位置（未取得の間はnull）
 * @property {string} source         - 出典（例: "jra-official" | "wikipedia"）
 */

/** @type {GradedRaceEntry[]} */
export const GRADED_RACES = Object.freeze([]);

/** idから重賞データを引く。無ければnull。 */
export function findGradedRace(id) {
  return GRADED_RACES.find((r) => r.id === id) ?? null;
}

/** 指定した週（month, weekOfMonth）に行われる重賞の一覧。 */
export function gradedRacesInWeek(month, weekOfMonth) {
  return GRADED_RACES.filter(
    (r) => r.slot && r.slot.month === month && r.slot.weekOfMonth === weekOfMonth
  );
}
