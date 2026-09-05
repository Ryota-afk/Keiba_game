// 能力の開示（確率式・ARCHITECTURE.md §3「能力の開示（確率式）」）。
// プールが2つに分かれている。⚠️「適距離」「脚質」「底」は導出値であり`horse.abilities`の
// 生の項目名とは一致しない。開示システムはこれらを「開示済みかどうか」を追う項目キー
// として扱う（値の計算式はここでは定義しない。CLAUDE.md §0.5の逆側の徹底と同じ理由で、
// 定義されていない導出式を勝手に作らない）。

export const TRAINING_POOL = Object.freeze(["wisdom", "health", "strategy", "mentalStrength"]); // 賢さ・健康・脚質・精神力
export const RACE_POOL = Object.freeze([
  "idealDistance", // 適距離
  "speed",
  "sharpness", // 瞬発力
  "grit", // 勝負根性
  "reserve", // 底
  "flexibility", // 柔軟性
  "power",
]);

// 確率式（暫定・ARCHITECTURE.md §15「確率開示の速度」）。
export const REVEAL_BASE_P = 0.55;
export const REVEAL_STREAK_BONUS = 0.15;
export const REVEAL_CAP = 0.95;
