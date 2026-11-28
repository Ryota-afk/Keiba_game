// 週の最初の「NPC騎手の騎乗の割り当て」を、本編（`domain/weekLoop.js`）と事前シミュレーション
// （`domain/bootstrap.js`）で同じ手順にするための合成レイヤー（`devlog/wave12.md`§15）。
// 純ロジック（JSX無し）。
//
// 手順：①今週のすべてのレースの出走枠を決める（`domain/weekFields.js`。プレイヤーが乗るレースも
// 他のレースと同じ枠）→②日ごとにまとめて`jockeyBooking.js`の`bookJockeysForWeek`を1回呼ぶ。
// プレイヤーが乗る馬の騎手はプレイヤー自身なので、割り当ての対象から外すだけ（それ以外の違いは無い）。
// 出走枠は走らせる側へそのまま渡す（同じ枠を2度求めない）。

import { buildWeeklyCard } from "./weeklyCard.js";
import { planWeekFields } from "./weekFields.js";
import { bookJockeysForWeek } from "./jockeyBooking.js";
import { DAY } from "../data/weekDays.js";

/**
 * @param {{
 *   saveSeed: number|string, week: number, year: number, horses: object[],
 *   playerHorseIds?: Set<string>, trialResults?: object,
 *   npcJockeys: object[], alpha: number, stableJockeys: Map<string,string|null>
 * }} args - `playerHorseIds`＝今週プレイヤーが乗る馬。騎手がプレイヤー自身なので、NPC騎手を割り当てない
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
  playerHorseIds = new Set(),
  trialResults = {},
  npcJockeys,
  alpha,
  stableJockeys,
}) {
  const { gradedFields, weeklyFields, gradedRacedHorseIds } = planWeekFields(saveSeed, week, year, horses, trialResults);

  // 重賞の`race`（実データ）は日を持たないので、同じ週の番組表（重賞も載っている）から引く。
  const dayByRaceId = new Map(buildWeeklyCard(saveSeed, week, year).map((r) => [r.raceId, r.day]));
  const fieldsByDay = { [DAY.SAT]: [], [DAY.SUN]: [] };
  const push = (day, raceId, distance, surface, fieldHorses) => {
    const bucket = day === DAY.SAT ? fieldsByDay[DAY.SAT] : fieldsByDay[DAY.SUN];
    bucket.push({
      raceId,
      distance,
      surface,
      horses: fieldHorses.filter((h) => !playerHorseIds.has(h.id)),
    });
  };
  for (const f of gradedFields) push(dayByRaceId.get(f.race.id), f.race.id, f.race.distance, f.race.surface, f.entries);
  for (const f of weeklyFields) push(f.race.day, f.race.raceId, f.race.distance, f.race.surface, f.field);

  const booking = bookJockeysForWeek(saveSeed, week, fieldsByDay, npcJockeys, alpha, stableJockeys);
  return { gradedFields, weeklyFields, gradedRacedHorseIds, booking, fieldsByDay };
}
