// 厩舎（調教師）の生成（ARCHITECTURE.md §6「調教師」）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { pickGrade } from "../data/grades.js";
import { pickHumanName } from "./humanNaming.js";

// 得意分野（芝ダート×距離4＝8種類）。⚠️厩舎ごとに1つ持つ（見せ方の1段目に使う。§6）。
// ⚠️2026-09-04に6→8へ増やし、騎手の適性の距離帯（`data/aptitudeCategories.js`の
// `DISTANCE_BANDS`：sprint/mile/intermediate/long）と同じ軸に揃えた。以前は
// `intermediate`に対応する厩舎が無く、日本ダービー（2400m）の距離帯の受け皿が
// 存在しなかった（`devlog/wave02.md`）。⭐乱数の消費は1回のまま（配列長が変わるだけ）
// なので、後続の`abilities`3軸の抽選はずれない（実測で確認済み）。
export const SPECIALTIES = Object.freeze([
  "turf-sprint", // 芝・〜1400m
  "turf-mile", // 芝・1400〜1800m
  "turf-intermediate", // 芝・1800〜2400m
  "turf-long", // 芝・2400m〜
  "dirt-sprint", // ダート・〜1400m
  "dirt-mile", // ダート・1400〜1800m
  "dirt-intermediate", // ダート・1800〜2400m
  "dirt-long", // ダート・2400m〜
]);

// 管理頭数（平均40頭。上限は貸付馬房数の2.5倍。§6「調教師」）。
export const AVERAGE_HORSE_CAPACITY = 40;
export const MAX_HORSE_CAPACITY = Math.round(AVERAGE_HORSE_CAPACITY * 2.5);

/**
 * 厩舎（調教師）を1件生成する。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {string|number} key - 一意なキー（例: 厩舎の通し番号）
 * @param {{ usedNames?: Set<string> }} [opts] - `usedNames`を渡すと調教師名の重複を避ける
 *   （2026-09-04・`domain/career.js`がロースター生成時に渡す）
 */
export function generateStable(saveSeed, key, opts = {}) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "stable", key);
  const trainerNameParts = pickHumanName(saveSeed, "stable", key, opts.usedNames);
  return {
    id: `stable-${key}`,
    trainerName: trainerNameParts.fullName,
    trainerFamilyName: trainerNameParts.familyName, // 「○○厩舎」の表示に使う
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
/** 厩舎（調教師）を引退させる。純関数。世代交代で新規開業の厩舎と入れ替える想定。 */
export function retireStable(stable) {
  return { ...stable, isActive: false };
}

export const TRUST_DISCLOSURE_TIERS = Object.freeze([
  { tier: 1, reveals: ["specialty"] },
  { tier: 2, reveals: ["abilities.developing"] },
  { tier: 3, reveals: ["abilities.scouting", "abilities.conditioning"] },
]);
