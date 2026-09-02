// クラス（9段・ARCHITECTURE.md §3「クラス（9段）」）。
// ⚠️ここは内部の序列のみ。画面に出す言葉はCLAUDE.md §8のUI手順で別に決める
// （「未勝利」「1勝クラス」は競馬を知らない人に伝わらない開発語彙）。

export const CLASS_LADDER = Object.freeze([
  "shinba", // 新馬
  "maiden", // 未勝利
  "win1", // 1勝クラス
  "win2", // 2勝クラス
  "win3", // 3勝クラス
  "open", // オープン
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
