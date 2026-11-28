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
import { planWeekFields, fieldIndexByHorse } from "./weekFields.js";
import { canRideGradedRace } from "./rideEligibility.js";
import { gradedRaceById } from "../data/shutokuPrize.js";
import { gradedTierOf } from "../data/gradedTier.js";

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
 *   day: string, raceNumber: number|null, surface: string, distance: number, fillyOnly: boolean,
 *   raceName: string|null, grade: string|null, condition: string|null }[]} `condition`は
 *   重賞（実データの年齢・性別条件）だけ持つ（`devlog/wave11.md`§12）。
 *   ⭐依頼になるのは今週の出走枠（`domain/weekFields.js`）に入った馬だけ（`devlog/wave14.md`§19）。
 */
export function generateWeeklyRequests(saveSeed, week, roster, player) {
  const stableById = new Map(roster.stables.map((s) => [s.id, s]));
  const year = player.currentYear;
  const card = buildWeeklyCard(saveSeed, week, year);
  const dueHorses = horsesDueThisWeek(roster.horses, week);
  // ⭐**依頼になるのは「実際に出走できる馬」だけ**（2026-11-28のユーザー決定・`devlog/wave14.md`§18・§19）。
  // 今週の出走枠を、走らせる側・騎手の割り当て・出馬表と同じ関数（`domain/weekFields.js`）で組み、
  // その枠に入った馬にだけ依頼が来る（登録が5頭に届かない・出たい馬が多くて絞られた馬には来ない）。
  const fieldIndex = fieldIndexByHorse(planWeekFields(saveSeed, week, year, roster.horses, roster.trialResults ?? {}));

  const candidates = [];
  for (const horse of dueHorses) {
    const entry = fieldIndex.get(horse.id);
    if (!entry) continue; // 出走枠に入らない馬には依頼が来ない
    const race = card.find((r) => r.raceId === entry.raceId);
    if (!race) continue; // 整合性エラー（通常は起きない）——依頼にしない
    // ⭐重賞の門：信頼に加えて、GIは通算31勝が要る（`rideEligibility.js`）。GIかどうかは番組表の依頼に
    // `g1Like`が無いので実データを引いて判定する（`weekResults.js`の`gradedTierForRide`と同じ引き方）。
    if (race.source === RACE_SOURCE.GRADED) {
      const gradedRace = gradedRaceById(year, race.raceId);
      const tier = gradedRace ? gradedTierOf(gradedRace, year) : (race.grade ?? "g3");
      if (!canRideGradedRace(player, horse, tier)) continue;
    }
    const stable = stableById.get(horse.stableId);
    const trust = trustFor(player.trainerTrust, horse.stableId);
    const quality =
      requestQuality(stable, trust, player.jockey.rank) * (0.5 + streamRandom(saveSeed, RNG_STREAMS.REQUESTS, week, horse.id)()); // 少しの揺らぎ（⭐第13弾：馬ごとに固定。他の馬が名簿から抜けても揺らぎが変わらない）
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
      raceNumber: race.raceNumber ?? null, // 第13弾§22：その日の何レース目か（1〜12）
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
  // 同じraceIdの候補がその上限を超えたら落とす。
  // ⭐**所属厩舎の馬が先に枠を取る**（2026-11-28にユーザーが決定・`devlog/wave14.md`§4・#105）：
  // 各レースの中で所属厩舎の候補を先（その中は質の順）、他厩舎を後（質の順）に並べて上位`maxPerRace`を残す。
  // 以前は質だけで並べていたため、所属厩舎の馬の多くが優先される前に落ちていた。
  // ⚠️所属厩舎の候補が上限より多いレースでは、所属厩舎の中で質の高い順に上限の頭数。
  // ここで絞ってから下のown/others選定に渡すことで、落ちた分は（候補が十分にあれば）
  // 他のレースの候補が自動的に繰り上がる——ownとothersの選び方自体は変えない。
  const maxPerRace = rankSpec(player.jockey.rank)?.maxRequestsPerRace ?? Infinity;
  const byRace = new Map();
  for (const c of candidates) {
    if (!byRace.has(c.raceId)) byRace.set(c.raceId, []);
    byRace.get(c.raceId).push(c);
  }
  const cappedCandidates = [];
  for (const raceCandidates of byRace.values()) {
    raceCandidates.sort(
      (a, b) => Number(b.isFromOwnStable) - Number(a.isFromOwnStable) || b.quality - a.quality
    );
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
