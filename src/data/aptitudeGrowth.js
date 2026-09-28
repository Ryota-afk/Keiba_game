// 適性の成長にかかわる定数（ARCHITECTURE.md §4「適性の成長」・`devlog/wave12.md`§9決定）。
// 純データ＋自己完結の小さな純関数（JSX無し。外部依存なし）。

// 1段上げるのに要る経験の基準値。⭐2026-09-27に較正済み（`devlog/wave12.md`§10：土日1鞍・世界3通りで
// 2年後の一番よく乗る距離帯が6〜10段・平均8）。目標は「一番よく乗る距離帯が2年目の終わりに
// NPC騎手の平均（7.2〜7.7段）へ追いつく」（`devlog/wave12.md`§9）。
export const BASE_XP_PER_STEP = 8;

// 勝った鞍の経験倍率（普通の鞍の3倍。根拠なし・ユーザー決定）。
export const WIN_XP_MULTIPLIER = 3;

// 主戦の馬（乗る前の時点で`isMain`）の鞍は、走り方（strategy）の経験だけ2倍
// （距離帯・馬場は普通のまま）。勝ちと重なれば掛け算（`WIN_XP_MULTIPLIER`と併用）。
export const MAIN_MOUNT_STRATEGY_XP_MULTIPLIER = 2;

// 必要経験の傾き：段が上がるほど1段に要る経験が増える（今の段÷この値だけ増える）。
export const XP_STEP_SLOPE = 4;

/**
 * ある段（0=G〜15=S+）から1段上げるのに要る経験。自己完結の純関数。
 * 必要経験 = `BASE_XP_PER_STEP` × (1 + 今の段 / `XP_STEP_SLOPE`)。
 */
export function requiredXpForStep(gradeNumber, base = BASE_XP_PER_STEP) {
  return base * (1 + gradeNumber / XP_STEP_SLOPE);
}
