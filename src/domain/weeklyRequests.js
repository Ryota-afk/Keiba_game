// 月曜の騎乗依頼一覧の生成（ARCHITECTURE.md §2「週の流れ」・§3「出走馬の決定（H）」）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⭐⭐**2026-09-17（第10弾）：`horse.plan`ベースへ作り直した**（`devlog/wave10.md`）。
// 以前は「出走間隔が来ている馬」に、週の番組表から合うレースを乱数で1つ選んで結びつけて
// いたが、`domain/rotation.js`の`planNextTarget`が既に「目標のレース」を決めているので、
// ここでは**今週が目標か前哨戦の馬から、その決まったレースをそのまま引く**だけになった。
// ⚠️重賞は`canRideGradedRace`が通らないと依頼に出さない（2026-09-16のユーザー決定・
// `domain/rideEligibility.js`）——NPC騎手が乗ってレース自体は行われるが、プレイヤーへは
// 見せない。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { trustFor } from "./player.js";
import { rankIndex, rankSpec } from "../data/ranks.js";
import { gradeToNumber } from "../data/grades.js";
import { buildWeeklyCard, RACE_SOURCE } from "./weeklyCard.js";
import { canRideGradedRace } from "./rideEligibility.js";

// 乗れる鞍数（2026-09-17にユーザーが決定・`devlog/wave10.md`§2）。
export const RIDABLE_SLOTS_PER_WEEK = 6;
// 依頼は乗れる鞍数より多く来る（§2「週の流れ」：新人でも選択が成立する数にする）。
export const REQUEST_COUNT_MULTIPLIER = 2;

/** その週に依頼の候補となる馬（H・第10弾）。計画が今週を目標か前哨戦にしている馬。 */
export function horsesDueThisWeek(horses, week) {
  return horses.filter(
    (horse) =>
      !horse.isRetired && horse.plan && (horse.plan.targetWeek === week || horse.plan.prepWeek === week)
  );
}

/**
 * その馬が今週出走を計画しているレースを、週の番組表から引く。
 * @returns {object|null} 見つからなければ`null`（通常は起きないはずの整合性エラー）
 */
function plannedRaceThisWeek(card, horse, week) {
  const raceId =
    horse.plan.targetWeek === week
      ? horse.plan.targetRaceId
      : horse.plan.prepWeek === week
        ? horse.plan.prepRaceId
        : null;
  if (!raceId) return null;
  return card.find((race) => race.raceId === raceId) ?? null;
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
 *   day: string, surface: string, distance: number, fillyOnly: boolean,
 *   raceName: string|null, grade: string|null, condition: string|null }[]} `condition`は
 *   重賞（実データの年齢・性別条件）だけ持つ——`raceOutcome.js`の`assembleRealField`が
 *   相手馬を集めるときに読む（`devlog/wave11.md`§12）。
 */
export function generateWeeklyRequests(saveSeed, week, roster, player) {
  const stableById = new Map(roster.stables.map((s) => [s.id, s]));
  const year = player.currentYear;
  const card = buildWeeklyCard(saveSeed, week, year);
  const dueHorses = horsesDueThisWeek(roster.horses, week);
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.REQUESTS, week);

  const candidates = [];
  for (const horse of dueHorses) {
    const race = plannedRaceThisWeek(card, horse, week);
    if (!race) continue; // 整合性エラー（通常は起きない）——依頼にしない
    if (race.source === RACE_SOURCE.GRADED && !canRideGradedRace(player, horse)) continue;
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
      day: race.day,
      surface: race.surface,
      distance: race.distance,
      fillyOnly: race.fillyOnly,
      raceName: race.name ?? null,
      grade: race.grade ?? null,
      condition: race.condition ?? null,
    });
  }

  const requestCount = RIDABLE_SLOTS_PER_WEEK * REQUEST_COUNT_MULTIPLIER;

  // 1レースあたりの依頼数をランクの上限で絞る（2026-09-20にユーザーが決定）。
  // 同じraceIdの候補がその上限を超えたら、quality の低い方から落とす。
  // ⚠️ここで`candidates`を絞ってから下のown/others選定に渡すことで、落ちた分は
  // （候補が十分にあれば）他のレースの候補が自動的に繰り上がり、合計は
  // 引き続き`requestCount`に近づく——ownとothersの選び方自体は変えない。
  const maxPerRace = rankSpec(player.jockey.rank)?.maxRequestsPerRace ?? Infinity;
  const byRace = new Map();
  for (const c of candidates) {
    if (!byRace.has(c.raceId)) byRace.set(c.raceId, []);
    byRace.get(c.raceId).push(c);
  }
  const cappedCandidates = [];
  for (const raceCandidates of byRace.values()) {
    raceCandidates.sort((a, b) => b.quality - a.quality);
    cappedCandidates.push(...raceCandidates.slice(0, maxPerRace));
  }

  // 所属厩舎の馬は優先的に回る（断れる、という性質は選択側=呼び出し元が扱う）が、
  // ⚠️⚠️**上限を`requestCount`と同じにすると、所属厩舎の馬が`requestCount`頭以上
  // 出走候補になった時点で依頼が100%所属厩舎になる**（2026-09-17に実測で発見・
  // `devlog/wave09.md`§14）。`TODO.md` #94（上限をいくつにするかは未決）。
  const own = cappedCandidates
    .filter((c) => c.isFromOwnStable)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, requestCount);
  const others = cappedCandidates
    .filter((c) => !c.isFromOwnStable)
    .sort((a, b) => b.quality - a.quality);

  const fillCount = Math.max(0, requestCount - own.length);
  return [...own, ...others.slice(0, fillCount)].sort((a, b) => b.quality - a.quality);
}
