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

// 画面に出す言葉（`arch/horse.md`「クラス（10段）」の表・CLAUDE.md §7の明示的な例外）。
export const CLASS_DISPLAY_NAME = Object.freeze({
  shinba: "新馬",
  maiden: "未勝利",
  win1: "1勝クラス",
  win2: "2勝クラス",
  win3: "3勝クラス",
  open: "オープン特別",
  listed: "リステッド",
  g3: "GIII",
  g2: "GII",
  g1: "GI",
});

/** クラスidから画面表記を引く。不明なクラスはidをそのまま返す。 */
export function classDisplayName(classId) {
  return CLASS_DISPLAY_NAME[classId] ?? classId;
}

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

/**
 * 馬（`horseClassId`）がそのクラスのレース（`raceClassId`）に出られるか
 * （`arch/race-program.md`§10・`domain/weeklyCard.js`が組む週の番組表の判定に使う）。
 * ⚠️オープン以上（オープン特別・リステッド・g3・g2・g1）は、馬の側の勝利昇級が
 * `open`で頭打ちになる（`domain/horse.js`の`WIN_PROMOTION_CAP`）ため、「オープン以上の
 * レースは、馬がオープン以上であれば出られる」という判定にする（`domain/npcGradedRace.js`の
 * `MIN_ENTRY_CLASS_INDEX`と同じ考え方）。
 * ⭐**第11弾・案B-1（`devlog/wave11.md`§7）**：新馬クラスの馬は新馬戦「と」未勝利戦の
 * 両方に出られる（新馬2,481頭に対し新馬戦は年307本しか無く、未勝利戦626本が空いていた）。
 * ⚠️**逆（未勝利クラスの馬が新馬戦に出る）はしない**——新馬戦は未出走馬だけのレース。
 * それ以外（1勝〜3勝クラス）は引き続き完全一致だけ出られる。
 */
export function isEligibleForRaceClass(horseClassId, raceClassId) {
  const openIdx = classIndex("open");
  if (classIndex(raceClassId) >= openIdx) return classIndex(horseClassId) >= openIdx;
  if (horseClassId === "shinba" && raceClassId === "maiden") return true;
  return horseClassId === raceClassId;
}
