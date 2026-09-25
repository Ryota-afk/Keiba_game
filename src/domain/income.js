// 騎手の収入（ARCHITECTURE.md §8「騎手の収入」）。純ロジック（JSX無し。`data/`だけに依存）。
// ⭐2本立てが対立を作る：騎乗手当は乗った鞍数に比例し、進上金は勝った時だけ跳ねる。

import { GRADED_CLASSES } from "../data/classes.js";
import { MOUNT_ALLOWANCE } from "../data/mountAllowance.js";
import { PLACEHOLDER_PURSE_BY_CLASS, JOCKEY_PRIZE_SHARE } from "../data/prizeMoney.js";

/** 騎乗手当（着順に関係なく乗れば出る）。 */
export function mountAllowanceFor(classId) {
  if (classId === "g1") return MOUNT_ALLOWANCE.g1;
  if (GRADED_CLASSES.includes(classId)) return MOUNT_ALLOWANCE.otherGraded;
  return MOUNT_ALLOWANCE.other;
}

/** 進上金（本賞金の5%。勝ったときだけ）。⚠️暫定の賞金額を使用（`data/prizeMoney.js`）。 */
export function prizeShareFor(classId, won) {
  if (!won) return 0;
  const purse = PLACEHOLDER_PURSE_BY_CLASS[classId] ?? 0;
  return Math.round(purse * JOCKEY_PRIZE_SHARE);
}

/** その鞍でその週に得る収入の合計。 */
export function rideIncome(classId, won) {
  return mountAllowanceFor(classId) + prizeShareFor(classId, won);
}
