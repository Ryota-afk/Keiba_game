// 厩舎（調教師）の生成（ARCHITECTURE.md §6「調教師」）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { pickGrade } from "../data/grades.js";
import { generateModeledName } from "../data/humanNames.js";

// 得意分野（芝ダート・距離）。⚠️厩舎ごとに1つ持つ（見せ方の1段目に使う。§6）。
export const SPECIALTIES = Object.freeze([
  "turf-sprint", // 芝・短距離
  "turf-mile", // 芝・マイル
  "turf-stayer", // 芝・長距離
  "dirt-sprint", // ダート・短距離
  "dirt-mile", // ダート・マイル
  "dirt-stayer", // ダート・長距離
]);

// 管理頭数（平均40頭。上限は貸付馬房数の2.5倍。§6「調教師」）。
export const AVERAGE_HORSE_CAPACITY = 40;
export const MAX_HORSE_CAPACITY = Math.round(AVERAGE_HORSE_CAPACITY * 2.5);

/**
 * 厩舎（調教師）を1件生成する。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {string|number} key - 一意なキー（例: 厩舎の通し番号）
 */
export function generateStable(saveSeed, key) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "stable", key);
  return {
    id: `stable-${key}`,
    trainerName: generateModeledName(rand01),
    specialty: SPECIALTIES[Math.floor(rand01() * SPECIALTIES.length)],
    // 4軸のうち3軸（得意分野は上のspecialtyで別枠に持つ）。
    abilities: {
      developing: pickGrade(rand01), // 育てる力
      scouting: pickGrade(rand01), // 見抜く力
      conditioning: pickGrade(rand01), // 仕上げ
    },
    capacity: AVERAGE_HORSE_CAPACITY,
    horseIds: [], // 所属する馬（呼び出し側が管理頭数の上限内で追加する）
    isActive: true, // 引退した調教師はfalseにする（世代交代）
  };
}

// 信頼値の見せ方は3段（§6「調教師」）：1段目＝得意分野／2段目＝育てる力／
// 3段目＝見抜く力・仕上げ・特性。⚠️閾値の具体値は実装の弾で置く（ARCHITECTURE.md §15）。
export const TRUST_DISCLOSURE_TIERS = Object.freeze([
  { tier: 1, reveals: ["specialty"] },
  { tier: 2, reveals: ["abilities.developing"] },
  { tier: 3, reveals: ["abilities.scouting", "abilities.conditioning"] },
]);
