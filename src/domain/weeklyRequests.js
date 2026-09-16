// 月曜の騎乗依頼一覧の生成（ARCHITECTURE.md §2「週の流れ」・§3「出走馬の決定（H）」）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⭐依頼は`domain/weeklyCard.js`が組んだその週の番組表から、クラス一致・馬場に出られる・
// 牝馬限定の条件が合うレースを1つ選んで結びつく（`arch/race-program.md`§10）。合う物が
// 無い馬は依頼にならない。⚠️2026-09-15までは競馬場・馬場・距離をレースと無関係に
// 手続き的に仮生成しており（`fridayConfirmation.js`の旧`resolveRaceContext`）、開催の
// 無い競馬場が依頼に出る不整合があった（通しプレイ①の指摘）。

import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";
import { isDueForNextRace, canDebutThisWeek } from "./horse.js";
import { trustFor } from "./player.js";
import { rankIndex } from "../data/ranks.js";
import { gradeToNumber } from "../data/grades.js";
import { canRaceOnSurface } from "../data/surfaceAptitude.js";
import { isEligibleForRaceClass } from "../data/classes.js";
import { buildWeeklyCard } from "./weeklyCard.js";

// 乗れる鞍数（暫定・ARCHITECTURE.md §15「依頼の件数」）。週末に乗れる競馬場は1つなので、
// その1場での想定レース数として仮に置く。
export const RIDABLE_SLOTS_PER_WEEK = 3;
// 依頼は乗れる鞍数より多く来る（§2「週の流れ」：新人でも選択が成立する数にする）。
export const REQUEST_COUNT_MULTIPLIER = 2;

/** その週に出走候補となる馬（H：出走馬の決定）。引退馬・2歳の解禁前は除く。 */
export function horsesDueThisWeek(horses, week, year) {
  return horses.filter(
    (horse) => !horse.isRetired && isDueForNextRace(horse, week) && canDebutThisWeek(horse, week, year)
  );
}

/**
 * その馬が出られるレースを週の番組表から1つ選ぶ。合う物が無ければ`null`。
 * 複数合う場合は`(saveSeed, week, horse.id)`から決まる乱数で1つに絞る
 * （月曜に見せた依頼と週末のレースを一致させるため、呼ぶたびに同じ結果になる）。
 */
function matchRaceForHorse(saveSeed, week, card, horse) {
  const matches = card.filter(
    (race) =>
      isEligibleForRaceClass(horse.classId, race.classId) &&
      canRaceOnSurface(horse.surfaceAptitude, race.surface) &&
      (!race.fillyOnly || horse.gender === "filly")
  );
  if (matches.length === 0) return null;
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.REQUESTS, week, horse.id, "race-pick");
  return pick(rand01, matches);
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
 * @param {{ trainerTrust: object, jockey: object, currentYear: number }} player
 * @returns {{ horseId: string, stableId: string, ownerId: string, quality: number,
 *   isFromOwnStable: boolean, raceId: string, classId: string, courseId: string,
 *   surface: string, distance: number, fillyOnly: boolean, raceName: string|null,
 *   grade: string|null }[]}
 */
export function generateWeeklyRequests(saveSeed, week, roster, player) {
  const stableById = new Map(roster.stables.map((s) => [s.id, s]));
  const year = player.currentYear;
  const card = buildWeeklyCard(saveSeed, week, year);
  const dueHorses = horsesDueThisWeek(roster.horses, week, year);
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.REQUESTS, week);

  const candidates = [];
  for (const horse of dueHorses) {
    const race = matchRaceForHorse(saveSeed, week, card, horse);
    if (!race) continue; // 合う物が無い馬は依頼にならない（`arch/race-program.md`§10）
    const stable = stableById.get(horse.stableId);
    const trust = trustFor(player.trainerTrust, horse.stableId);
    const quality =
      requestQuality(stable, trust, player.jockey.rank) * (0.5 + rand01()); // 少しの揺らぎ
    candidates.push({
      horseId: horse.id,
      stableId: horse.stableId,
      ownerId: horse.ownerId,
      quality,
      isFromOwnStable: horse.stableId === player.jockey.stableId,
      raceId: race.raceId,
      classId: race.classId,
      courseId: race.courseId,
      surface: race.surface,
      distance: race.distance,
      fillyOnly: race.fillyOnly,
      raceName: race.name ?? null,
      grade: race.grade ?? null,
    });
  }

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
