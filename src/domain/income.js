// 騎手の収入（ARCHITECTURE.md §8「騎手の収入」）。純ロジック（JSX無し。`data/`だけに依存）。
// ⭐2本立てが対立を作る：騎乗手当は乗った鞍数に比例し、進上金は勝った時だけ跳ねる。

import { GRADED_CLASSES } from "../data/classes.js";
import { MOUNT_ALLOWANCE } from "../data/mountAllowance.js";
import { JOCKEY_PRIZE_SHARE } from "../data/prizeMoney.js";

/** 騎乗手当（着順に関係なく乗れば出る）。 */
export function mountAllowanceFor(classId) {
  if (classId === "g1") return MOUNT_ALLOWANCE.g1;
  if (GRADED_CLASSES.includes(classId)) return MOUNT_ALLOWANCE.otherGraded;
  return MOUNT_ALLOWANCE.other;
}

/**
 * 進上金（その鞍で馬が取った本賞の5%。1〜5着に出る。6着以下・落馬は本賞0なので0）。
 * @param {number} horsePrizeGain - その鞍で馬の獲得賞金へ積んだ額（円）。`domain/weekResults.js`の`prizeGain`
 *   （一般競走は`earningsForResult`・重賞は実際の`prize1`×着順の配分）をそのまま渡す。
 */
export function prizeShareFor(horsePrizeGain) {
  return Math.round(horsePrizeGain * JOCKEY_PRIZE_SHARE);
}

/** その鞍でその週に得る収入の合計（騎乗手当＋進上金）。 */
export function rideIncome(classId, horsePrizeGain) {
  return mountAllowanceFor(classId) + prizeShareFor(horsePrizeGain);
}
