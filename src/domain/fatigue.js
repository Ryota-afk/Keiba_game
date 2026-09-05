// 疲労（ARCHITECTURE.md §6「疲労」：その週に何鞍乗ったかで決まる。奪うものは3つ——
// 判断カードの効きが落ちる／騎手の能力が落ちる／落馬率が上がる）。
// 純ロジック（JSX無し。外部依存なし）。
//
// ⚠️「判断カードの効きが落ちる」は判断カード自体がまだ実装されていない
// （ARCHITECTURE.md §5「判断カード」は第2弾の範囲外）ため未実装。
// 「騎手の能力が落ちる」は`fatiguePenaltyFactor`として`raceOutcome.js`に渡す。
// 「落馬率が上がる」は`domain/fall.js`が`fatigue`を受け取って閾値を動かす。

export const FATIGUE_MAX = 100;
export const FATIGUE_PER_RIDE = 8; // 暫定（ARCHITECTURE.md §15「疲労の増減」）
export const FATIGUE_RECOVERY_PER_WEEK = 5; // 暫定
export const FATIGUE_DANGER_THRESHOLD = 70; // ⚠️必ず知らせる6項目の「6. 疲労が危険水域に入ったこと」

/** その週の乗鞍数から疲労を更新する。純関数。0〜100にクランプする。 */
export function applyWeeklyFatigue(fatigue, rideCount) {
  const next = fatigue + rideCount * FATIGUE_PER_RIDE - FATIGUE_RECOVERY_PER_WEEK;
  return Math.max(0, Math.min(FATIGUE_MAX, next));
}

/** 疲労が危険水域に新しく入ったか（通知の6番目の判定に使う）。 */
export function crossedDangerThreshold(fatigueBefore, fatigueAfter) {
  return fatigueBefore < FATIGUE_DANGER_THRESHOLD && fatigueAfter >= FATIGUE_DANGER_THRESHOLD;
}

/** 疲労による騎手の能力低下の係数（暫定：疲労100で最大20%減）。 */
export function fatiguePenaltyFactor(fatigue) {
  return 1 - Math.min(0.2, fatigue / (FATIGUE_MAX * 5));
}
