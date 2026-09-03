// 仮sim（ARCHITECTURE.md §5「レースsim」の本実装は⑦・`claude-opus-5`で行う）。
// ここでは週の進行と各種処理（信頼・金・主戦判定・開示・疲労・落馬）を先に回すための
// 仮の着順決定だけを行う。消耗差・レース傾向・適応能力の成長といった⑦の中身は含まない。
// 純ロジック（JSX無し。`core/`・`domain/strategy.js`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { gradeToNumber } from "../data/grades.js";
import { deriveFavoredStrategy } from "./strategy.js";

// 出走頭数の幅（実態どおり最大18頭。ARCHITECTURE.md §5「コースと出走頭数」）。
export const MIN_FIELD_SIZE = 6;
export const MAX_FIELD_SIZE = 18;

/** 馬の強さを1つの数値にまとめる（仮の指標。⑦の消耗式に置き換える）。 */
function horseStrengthScore(horse, declaredStrategy) {
  const a = horse.abilities;
  const gradeSum = [a.sharpness, a.grit, a.flexibility, a.power]
    .map(gradeToNumber)
    .reduce((sum, v) => sum + v, 0); // 0〜28
  let score = a.speed * 0.5 + a.stamina * 0.3 + gradeSum * 2;
  if (declaredStrategy && declaredStrategy === deriveFavoredStrategy(horse)) {
    score += 5; // 得意脚質どおりに乗ったときの仮ボーナス
  }
  return score;
}

/** 他の出走馬の強さを手続き的に仮生成する（実際の相手馬データが無いため）。 */
function syntheticRivalScore(rand01) {
  const speed = rand01() * 100;
  const stamina = rand01() * 100;
  const gradeSum = Array.from({ length: 4 }, () => Math.floor(rand01() * 8)).reduce(
    (sum, v) => sum + v,
    0
  );
  return speed * 0.5 + stamina * 0.3 + gradeSum * 2;
}

/**
 * 仮simでレースを1つ走らせ、着順を決める。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {{ horseId: string, declaredStrategy?: string|null }} mount
 * @param {object} horse
 * @returns {{ position: number, fieldSize: number, won: boolean }}
 */
export function runPlaceholderRace(saveSeed, week, mount, horse) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.SIM, week, mount.horseId);
  const fieldSize =
    MIN_FIELD_SIZE + Math.floor(rand01() * (MAX_FIELD_SIZE - MIN_FIELD_SIZE + 1));
  const noise = (rand01() - 0.5) * 10;
  const ownScore = horseStrengthScore(horse, mount.declaredStrategy) + noise;
  const rivalScores = Array.from({ length: fieldSize - 1 }, () => syntheticRivalScore(rand01));
  const position = rivalScores.filter((s) => s > ownScore).length + 1;
  return { position, fieldSize, won: position === 1 };
}
