// クラス（10段・arch/horse.md §3「クラス（10段）」）。
// ⚠️ここは内部の序列のみ。画面に出す言葉はCLAUDE.md §7の明示的な例外として
// JRAの呼び方をそのまま使う（`arch/horse.md`の表が正本）。
// ⚠️2026-09-04に9段→10段へ修正：`listed`（リステッド）が抜けていた
// （JRA公式「レースのクラス分け」— GⅠ・GⅡ・GⅢ・リステッド・オープン特別…の順）。

export const CLASS_LADDER = Object.freeze([
  "shinba", // 新馬
  "maiden", // 未勝利
  "win1", // 1勝クラス
  "win2", // 2勝クラス
  "win3", // 3勝クラス
  "open", // オープン特別
  "listed", // リステッド
  "g3",
  "g2",
  "g1",
]);

export const GRADED_CLASSES = Object.freeze(["g3", "g2", "g1"]);

/** クラスの序列上の位置（0始まり）。不明なクラスは-1。 */
export function classIndex(classId) {
  return CLASS_LADDER.indexOf(classId);
}

/** オープン以上（重賞）かどうか。 */
export function isGraded(classId) {
  return GRADED_CLASSES.includes(classId);
}

/** aがbより上のクラスか。 */
export function isHigherClass(a, b) {
  return classIndex(a) > classIndex(b);
}
