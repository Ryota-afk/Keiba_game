// 馬主の生成（ARCHITECTURE.md §3「馬の名前」・§6「馬主への信頼」）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { pickHumanName } from "./humanNaming.js";
import { OWNER_PREFIXES } from "../data/names.js";

/** その馬主が大口かどうか（冠名を持つ）。⚠️閾値は実装の弾で置く暫定値（ARCHITECTURE.md §15）。 */
export function isMajorOwner(ownerHorseCount, threshold = 5) {
  return ownerHorseCount >= threshold;
}

/**
 * 馬主を1人生成する。自己完結の純関数。
 * 大口かどうかは持ち馬の数で決まるため、生成時点では呼び出し側が`isMajor`を渡す
 * （最初は無所有なので`isMajorOwner(0)`はfalse。後から`isMajorOwner(horseIds.length)`で
 * 再判定し、大口に転じたら冠名を持たせ直す）。
 * @param {number|string} saveSeed
 * @param {string|number} key
 * @param {{ isMajor?: boolean, usedNames?: Set<string> }} [opts] - `usedNames`を渡すと
 *   馬主名の重複を避ける（2026-09-04・`domain/career.js`が渡す）
 */
export function generateOwner(saveSeed, key, opts = {}) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "owner", key);
  const displayName = pickHumanName(saveSeed, "owner", key, opts.usedNames).fullName; // 馬主本人の名前（もじる）
  const ownerPrefix = opts.isMajor
    ? OWNER_PREFIXES[Math.floor(rand01() * OWNER_PREFIXES.length)]
    : null; // 大口馬主だけ冠名を持つ（§3）
  return {
    id: `owner-${key}`,
    displayName,
    ownerPrefix,
    horseIds: [],
  };
}
