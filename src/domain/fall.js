// 落馬・怪我（ARCHITECTURE.md §6「落馬・怪我」）。
// 「基準p=0.008/鞍を、馬の健康・騎手の体力・疲労で増減させる」
// 「⚠️落馬の判定は『目を固定して、閾値を疲労で動かす』形にする。
//   『落馬するかどうか』自体を先に決めるとC4が壊れる」（§6）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { gradeToNumber } from "../data/grades.js";

export const BASE_FALL_P = 0.008; // 暫定
export const FRACTURE_WEEKS = 13; // 骨折（暫定）
export const BRUISE_WEEKS = 2; // 打撲（暫定）
export const FRACTURE_SHARE = 0.3; // ⚠️骨折と打撲の内訳は未記載。暫定で骨折30%・打撲70%とする

/**
 * 落馬を判定する。自己完結の純関数——C4を満たすため「目（roll）」を1回だけ固定して引き、
 * 健康・疲労で変わるのは比較する閾値の側だけにする。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {string} horseId
 * @param {string} horseHealth - 馬の「健康」（G〜S）
 * @param {number} playerFatigue - プレイヤーの疲労（0〜100）
 * @returns {{ fell: boolean, injuryType?: "fracture"|"bruise", weeksOut?: number }}
 */
export function checkFall(saveSeed, week, horseId, horseHealth, playerFatigue) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.FALL, week, horseId);
  const roll = rand01(); // ⚠️目はここで1回だけ固定する

  const healthRelief = gradeToNumber(horseHealth) / 14; // 0（G）〜0.5（S）。健康なほど下がる
  const fatigueRisk = playerFatigue / 200; // 0〜0.5。疲労が高いほど上がる
  const threshold = BASE_FALL_P * (1 + fatigueRisk) * (1 - healthRelief);

  if (roll >= threshold) return { fell: false };

  const injuryType = rand01() < FRACTURE_SHARE ? "fracture" : "bruise";
  const weeksOut = injuryType === "fracture" ? FRACTURE_WEEKS : BRUISE_WEEKS;
  return { fell: true, injuryType, weeksOut };
}

/** 落馬の結果を馬に反映する。純関数。落馬していなければ元のhorseを返す。 */
export function applyInjuryToHorse(horse, fallResult) {
  if (!fallResult.fell) return horse;
  return { ...horse, injury: { type: fallResult.injuryType, weeksRemaining: fallResult.weeksOut } };
}

/** 離脱中かどうか。 */
export function isSidelined(horse) {
  return horse.injury.weeksRemaining > 0;
}

/** 週が1つ進むごとに離脱期間を1減らす。純関数。 */
export function advanceInjuryByWeek(horse) {
  if (horse.injury.weeksRemaining <= 0) return horse;
  const weeksRemaining = horse.injury.weeksRemaining - 1;
  return {
    ...horse,
    injury: weeksRemaining <= 0 ? { type: null, weeksRemaining: 0 } : { ...horse.injury, weeksRemaining },
  };
}
