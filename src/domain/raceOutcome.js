// 馬の強さを1つの数値にまとめる指標（`horseStrengthScore`）だけを持つ。
// ⭐2026-11-28：プレイヤーの鞍だけ別に相手馬を集めて走らせていた経路（`assembleRealField`・
// `assemblePlayerMountField`・`runPlaceholderRace`）は撤去した——プレイヤーが乗るレースも、世界のほかの
// レースと同じ仕組み（`domain/weekFields.js`・`npcWeeklyRace.js`・`npcGradedRace.js`・`raceRun.js`）で
// 組んで走らせる（`devlog/wave14.md`§18・§19）。
// ⚠️`horseStrengthScore`は人気の並び（`domain/dreamDerby.js`）でまだ使う。
// 純ロジック（JSX無し。`data/`・`domain/`の他ファイルだけに依存）。

import { gradeToNumber } from "../data/grades.js";
import { deriveFavoredStrategy } from "./strategy.js";

/** 馬の強さを1つの数値にまとめる（仮の指標。⑦の消耗式に置き換える）。 */
export function horseStrengthScore(horse, declaredStrategy) {
  const a = horse.abilities;
  const gradeSum = [a.sharpness, a.grit, a.flexibility, a.power]
    .map(gradeToNumber)
    .reduce((sum, v) => sum + v, 0); // 0〜60（記号4軸×0〜15）
  let score = a.speed * 0.5 + a.stamina * 0.3 + gradeSum * 2;
  if (declaredStrategy && declaredStrategy === deriveFavoredStrategy(horse)) {
    score += 5; // 得意脚質どおりに乗ったときの仮ボーナス
  }
  return score;
}
