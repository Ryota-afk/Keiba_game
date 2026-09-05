// 月曜の騎乗依頼一覧の生成（ARCHITECTURE.md §2「週の流れ」・§3「出走馬の決定（H）」）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⚠️「仮」の位置づけ（devlog/wave02.md④）：実際のJRA重賞出走表・番組表はまだ実データが
// 無い（`data/gradedRaces.js`は空）。ここでは「厩舎に属する、次走が近い馬」から依頼を
// 起こす一般競走相当の流れだけを実装し、史実ローテーションとの突き合わせは⑦で行う。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { isDueForNextRace } from "./horse.js";
import { trustFor } from "./player.js";
import { rankIndex } from "../data/ranks.js";
import { gradeToNumber } from "../data/grades.js";

// 乗れる鞍数（暫定・ARCHITECTURE.md §15「依頼の件数」）。週末に乗れる競馬場は1つなので、
// その1場での想定レース数として仮に置く。
export const RIDABLE_SLOTS_PER_WEEK = 3;
// 依頼は乗れる鞍数より多く来る（§2「週の流れ」：新人でも選択が成立する数にする）。
export const REQUEST_COUNT_MULTIPLIER = 2;

/** その週に出走候補となる馬（H：出走馬の決定）。引退馬は除く。 */
export function horsesDueThisWeek(horses, week) {
  return horses.filter((horse) => !horse.isRetired && isDueForNextRace(horse, week));
}

/** 厩舎の強さ＝3軸（育てる力・見抜く力・仕上げ）の平均をG〜Sの数値(0〜7)で表す。 */
function stableStrength(stable) {
  const values = Object.values(stable.abilities).map(gradeToNumber);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 依頼の質＝調教師の信頼 × ランク × 厩舎の強さ（§2「週の流れ」）。
 * ⚠️係数・重みは暫定（ARCHITECTURE.md §15）。実装が進んだら計測して調整する。
 */
export function requestQuality(stable, trainerTrust, playerRank) {
  const trustFactor = 1 + trainerTrust / 10; // 信頼0でも最低限の質は付く
  const rankFactor = 1 + rankIndex(playerRank);
  return trustFactor * rankFactor * stableStrength(stable);
}

/**
 * 月曜の騎乗依頼一覧を作る。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {{ horses: object[], stables: object[] }} roster
 * @param {{ trainerTrust: object, jockey: object }} player
 * @returns {{ horseId: string, stableId: string, ownerId: string, quality: number,
 *             isFromOwnStable: boolean }[]}
 */
export function generateWeeklyRequests(saveSeed, week, roster, player) {
  const stableById = new Map(roster.stables.map((s) => [s.id, s]));
  const dueHorses = horsesDueThisWeek(roster.horses, week);
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.REQUESTS, week);

  const candidates = dueHorses.map((horse) => {
    const stable = stableById.get(horse.stableId);
    const trust = trustFor(player.trainerTrust, horse.stableId);
    const quality =
      requestQuality(stable, trust, player.jockey.rank) * (0.5 + rand01()); // 少しの揺らぎ
    return {
      horseId: horse.id,
      stableId: horse.stableId,
      ownerId: horse.ownerId,
      quality,
      isFromOwnStable: horse.stableId === player.jockey.stableId,
    };
  });

  const requestCount = RIDABLE_SLOTS_PER_WEEK * REQUEST_COUNT_MULTIPLIER;

  // 所属厩舎の馬は優先的に回る（断れる、という性質は選択側=呼び出し元が扱う）が、
  // ⚠️上限を付けないと所属頭数（40頭前後）がそのまま依頼件数になり、他厩舎が
  // 締め出される（2026-09-04・実測で判明。`TODO.md` #16）。所属枠も`requestCount`で
  // 頭打ちにする——枠を独立に確保するのではなく、質の高い順に他厩舎と同じ上限を共有する。
  const own = candidates
    .filter((c) => c.isFromOwnStable)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, requestCount);
  const others = candidates
    .filter((c) => !c.isFromOwnStable)
    .sort((a, b) => b.quality - a.quality);

  const fillCount = Math.max(0, requestCount - own.length);
  return [...own, ...others.slice(0, fillCount)].sort((a, b) => b.quality - a.quality);
}
