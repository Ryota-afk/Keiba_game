// 能力の開示（ARCHITECTURE.md §3「能力の開示（確率式）」）。
// ⭐馬を知り切るには両方やる必要がある：調教に通い、かつレースで自分で乗る。
// ⚠️預けた鞍・馬に任せた鞍では開示が進まない（呼び出し側が「自分で判断した鞍」だけで
// この関数を呼ぶことで表現する）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import {
  TRAINING_POOL,
  RACE_POOL,
  REVEAL_BASE_P,
  REVEAL_STREAK_BONUS,
  REVEAL_CAP,
} from "../data/disclosurePools.js";

const POOL_CONFIG = Object.freeze({
  training: { pool: TRAINING_POOL, revealedKey: "trainingRevealed", streakKey: "trainingMissStreak" },
  race: { pool: RACE_POOL, revealedKey: "raceRevealed", streakKey: "raceMissStreak" },
});

/**
 * 開示を1回試みる。純関数——引数のhorseを書き換えず新しいオブジェクトを返す。
 * プールが開き切っていれば何もしない。⚠️各プールの「初回のみ確率1.0」は
 * プールごとに独立して適用する（ARCHITECTURE.mdはプール分割後の再計算が必要と
 * 明記しているのみで、初回条件をプール単位にするか馬単位にするかは明記していない
 * ——ここではプール単位という解釈で実装した）。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {object} horse
 * @param {"training"|"race"} poolName
 */
export function attemptReveal(saveSeed, week, horse, poolName) {
  const { pool, revealedKey, streakKey } = POOL_CONFIG[poolName];
  const revealed = horse.disclosure[revealedKey];
  const remaining = pool.filter((item) => !revealed.includes(item));
  if (remaining.length === 0) return horse; // このプールは開き切っている

  const streak = horse.disclosure[streakKey];
  const isFirstAttempt = revealed.length === 0 && streak === 0;
  const p = isFirstAttempt
    ? 1.0
    : Math.min(REVEAL_CAP, REVEAL_BASE_P + REVEAL_STREAK_BONUS * streak);

  const rand01 = streamRandom(saveSeed, RNG_STREAMS.REVEAL, week, horse.id, poolName);
  if (rand01() < p) {
    const item = remaining[Math.floor(rand01() * remaining.length)];
    return {
      ...horse,
      disclosure: {
        ...horse.disclosure,
        [revealedKey]: [...revealed, item],
        [streakKey]: 0,
      },
    };
  }
  return {
    ...horse,
    disclosure: { ...horse.disclosure, [streakKey]: streak + 1 },
  };
}

/** そのプールが開き切っているか（両プールとも開いて初めて「知り切った」）。 */
export function isPoolFullyRevealed(horse, poolName) {
  const { pool, revealedKey } = POOL_CONFIG[poolName];
  return horse.disclosure[revealedKey].length >= pool.length;
}
