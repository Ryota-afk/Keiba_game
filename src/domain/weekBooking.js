// 週の最初の「NPC騎手の騎乗の割り当て」を、本編（`domain/weekLoop.js`）と事前シミュレーション
// （`domain/bootstrap.js`）で同じ手順にするための合成レイヤー（`devlog/wave12.md`§15）。
// 純ロジック（JSX無し）。
//
// 手順：①今週の重賞・一般競走の出走枠を決める（走らせる前に`planNpcGradedFields`・
// `planNpcWeeklyFields`）→②プレイヤーの鞍の相手馬を足す→③日ごとにまとめて
// `jockeyBooking.js`の`bookJockeysForWeek`を1回呼ぶ。出走枠は走らせる側へそのまま渡す
// （同じ枠を2度求めない・乱数の列を二重に消費しない）。

import { buildWeeklyCard } from "./weeklyCard.js";
import { planNpcGradedFields } from "./npcGradedRace.js";
import { planNpcWeeklyFields } from "./npcWeeklyRace.js";
import { bookJockeysForWeek } from "./jockeyBooking.js";
import { DAY } from "../data/weekDays.js";

/**
 * @param {{
 *   saveSeed: number|string, week: number, year: number, horses: object[],
 *   excludeHorseIds?: Set<string>, excludeRaceIds?: Set<string>, trialResults?: object,
 *   playerFields?: { raceId: string, day: string, distance: number, surface: string, horses: object[] }[],
 *   npcJockeys: object[], alpha: number, stableJockeys: Map<string,string|null>
 * }} args - `excludeHorseIds`＝今週プレイヤーが乗る馬、`excludeRaceIds`＝プレイヤーが乗るレース。
 *   `playerFields`＝プレイヤーの鞍ごとの出走枠（相手馬）。プレイヤーの馬は騎手を割り当てない
 *   （プレイヤー自身が騎手）ので、`excludeHorseIds`の馬はここで取り除かれる
 * @returns {{ gradedFields: object[], weeklyFields: object[], gradedRacedHorseIds: Set<string>,
 *   booking: ReturnType<typeof bookJockeysForWeek>, fieldsByDay: object }}
 *   `gradedFields`・`weeklyFields`はそれぞれ`runNpcGradedRaces`・`runNpcWeeklyRaces`の
 *   `plannedFields`にそのまま渡す。`booking.jockeyByHorseId`＝馬id -> 騎手id
 */
export function planWeekWithBookings({
  saveSeed,
  week,
  year,
  horses,
  excludeHorseIds = new Set(),
  excludeRaceIds = new Set(),
  trialResults = {},
  playerFields = [],
  npcJockeys,
  alpha,
  stableJockeys,
}) {
  const gradedFields = planNpcGradedFields(week, year, horses, excludeHorseIds, excludeRaceIds, trialResults);
  const gradedRacedHorseIds = new Set();
  for (const f of gradedFields) for (const h of f.entries) gradedRacedHorseIds.add(h.id);

  // 重賞に出る馬は一般競走から外す（`weekLoop.js`の`npcExcluded`と同じ）。
  const npcExcluded = new Set([...excludeHorseIds, ...gradedRacedHorseIds]);
  const weeklyFields = planNpcWeeklyFields(saveSeed, week, year, horses, npcExcluded, excludeRaceIds);

  // 重賞の`race`（実データ）は日を持たないので、同じ週の番組表（重賞も載っている）から引く。
  const dayByRaceId = new Map(buildWeeklyCard(saveSeed, week, year).map((r) => [r.raceId, r.day]));
  const fieldsByDay = { [DAY.SAT]: [], [DAY.SUN]: [] };
  const push = (day, raceId, distance, surface, fieldHorses) => {
    const bucket = day === DAY.SAT ? fieldsByDay[DAY.SAT] : fieldsByDay[DAY.SUN];
    bucket.push({
      raceId,
      distance,
      surface,
      horses: fieldHorses.filter((h) => !excludeHorseIds.has(h.id)),
    });
  };
  for (const f of gradedFields) push(dayByRaceId.get(f.race.id), f.race.id, f.race.distance, f.race.surface, f.entries);
  for (const f of weeklyFields) push(f.race.day, f.race.raceId, f.race.distance, f.race.surface, f.field);
  for (const f of playerFields) push(f.day, f.raceId, f.distance, f.surface, f.horses);

  const booking = bookJockeysForWeek(saveSeed, week, fieldsByDay, npcJockeys, alpha, stableJockeys);
  return { gradedFields, weeklyFields, gradedRacedHorseIds, booking, fieldsByDay };
}
