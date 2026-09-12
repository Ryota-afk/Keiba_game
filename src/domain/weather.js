// 天候・馬場状態（ARCHITECTURE.md §5「コースと出走頭数」：
// 「週×競馬場の乱数で天候が決まり、金曜に予報が見える」「予報が外れる確率を置く」）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS, weightedPick } from "../core/rng.js";
import { TRACK_CONDITIONS, TRACK_CONDITION_WEIGHTS } from "../data/trackConditions.js";

// 予報の的中率（暫定・ARCHITECTURE.md §15「天候予報が外れる割合」＝Q13で測る対象）。
export const FORECAST_ACCURACY = 0.85;

/** その週・その競馬場の実際の馬場状態を決める。自己完結の純関数。 */
export function rollActualCondition(saveSeed, week, courseId) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.WEATHER, week, courseId);
  return weightedPick(rand01, TRACK_CONDITION_WEIGHTS);
}

/**
 * 金曜に見える予報を作る。的中率`FORECAST_ACCURACY`で実際の状態と一致し、
 * 外れる場合は他の状態からランダムに1つを示す。
 * ⚠️実際の状態のロールとは別のストリーム消費（"forecast"キー）を使うことで、
 * 「予報を見た／見なかった」がプレイヤーの他の判断の乱数消費に影響しない。
 */
export function generateForecast(saveSeed, week, courseId) {
  const actual = rollActualCondition(saveSeed, week, courseId);
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.WEATHER, week, courseId, "forecast");
  if (rand01() < FORECAST_ACCURACY) {
    return { actual, forecast: actual, willBeWrong: false };
  }
  const others = TRACK_CONDITIONS.filter((c) => c !== actual);
  const forecast = others[Math.floor(rand01() * others.length) % others.length];
  return { actual, forecast, willBeWrong: true };
}
