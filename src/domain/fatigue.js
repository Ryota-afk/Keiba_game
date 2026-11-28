// 疲労（ARCHITECTURE.md §6「疲労」：その週に何鞍乗ったかで決まる。奪うものは3つ——
// 判断カードの効きが落ちる／騎手の能力が落ちる／落馬率が上がる）。
// 純ロジック（JSX無し。外部依存なし）。
//
// ⚠️「判断カードの効きが落ちる」は判断カード自体がまだ実装されていない
// （ARCHITECTURE.md §5「判断カード」は第2弾の範囲外）ため未実装。
// 「騎手の能力が落ちる」は`fatiguePenaltyFactor`として`raceOutcome.js`に渡す。
// 「落馬率が上がる」は`domain/fall.js`が`fatigue`を受け取って閾値を動かす。

export const FATIGUE_MAX = 100;
// 以下の定数は、設計の狙いから置いた仮の値（実際の騎手のデータは無い）。`devlog/wave14.md`§6。
export const FATIGUE_PER_RIDE = 8; // 体力が中間（約50）のときの1鞍の疲労。体力で±20%動く
export const FATIGUE_RECOVERY_PER_WEEK = 35; // 週6鞍で少しずつたまり、週4鞍以下ではたまらない
export const FATIGUE_PENALTY_START = 50; // 疲労がこれ以下なら能力は落ちない
export const FATIGUE_MAX_PENALTY = 0.2; // 疲労100での能力の低下
export const FATIGUE_DANGER_THRESHOLD = 70; // ⚠️必ず知らせる6項目の「6. 疲労が危険水域に入ったこと」
export const DEFAULT_PHYSICAL_STAMINA = 50; // 体力が無い古いセーブ用

function staminaOf(physicalStamina) {
  return Number.isFinite(physicalStamina) ? physicalStamina : DEFAULT_PHYSICAL_STAMINA;
}

/** 1鞍の疲労＝8 ×（1.2 − 0.4 × 体力 ÷ 99）。体力0で9.6、99で6.4。小数のまま返す。純関数。 */
export function perRideFatigue(physicalStamina) {
  return FATIGUE_PER_RIDE * (1.2 - (0.4 * staminaOf(physicalStamina)) / 99);
}

/** 来週の疲労＝clamp(今の疲労 ＋ 鞍数×1鞍の疲労 − 回復, 0, 100)。画面の見込み表示にも使う。純関数。 */
export function fatigueAfterRides(fatigue, rideCount, physicalStamina) {
  const next = fatigue + rideCount * perRideFatigue(physicalStamina) - FATIGUE_RECOVERY_PER_WEEK;
  return Math.max(0, Math.min(FATIGUE_MAX, next));
}

/** その週の乗鞍数から疲労を更新する。純関数。0〜100にクランプする。 */
export function applyWeeklyFatigue(fatigue, rideCount, physicalStamina) {
  return fatigueAfterRides(fatigue, rideCount, physicalStamina);
}

/** 疲労が危険水域に新しく入ったか（通知の6番目の判定に使う）。 */
export function crossedDangerThreshold(fatigueBefore, fatigueAfter) {
  return fatigueBefore < FATIGUE_DANGER_THRESHOLD && fatigueAfter >= FATIGUE_DANGER_THRESHOLD;
}

/** 疲労による騎手の能力低下の係数。50以下は1、50を超えた分だけ直線で下がり、100で0.8。 */
export function fatiguePenaltyFactor(fatigue) {
  const over = Math.max(0, fatigue - FATIGUE_PENALTY_START);
  return 1 - (FATIGUE_MAX_PENALTY * Math.min(over, FATIGUE_MAX - FATIGUE_PENALTY_START)) / (FATIGUE_MAX - FATIGUE_PENALTY_START);
}
