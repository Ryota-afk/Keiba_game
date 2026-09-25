// 週の結果画面（`screens/WeekResultScreen.jsx`）に渡すデータを組む純関数
// （ARCHITECTURE.md §2「週の流れ」・2026-09-25のユーザー決定「案C 掲示板」）。
// `advanceWeek`（`domain/weekLoop.js`）が返した値から、画面が必要とする形へ整えるだけの
// 合成レイヤー。JSX無し。
//
// ⚠️`view/weekOffersView.js`の`formatWeekLabel`をそのまま使う（週表記の書式を2箇所に
// 持たないため）。`view/`側は`domain/`をimportしない一方通行を守ったままなので、
// `domain → view`のこの1本の参照はサイクルにならない。

import { formatWeekLabel } from "../view/weekOffersView.js";
import { findCourse } from "../data/courses.js";
import { classDisplayName } from "../data/classes.js";
import { gradedRacesForYear } from "../data/gradedRacesByYear.js";
import { weekOfYear } from "../data/calendar.js";
import { MAIN_MOUNT_RIDES_REQUIRED, isMainMount } from "./mainMount.js";
import { trustFor } from "./player.js";
import { assignStablePrimaryJockeys, jockeyIdForHorse } from "./jockeyAssignment.js";

// 「信頼が大きく動いた」を言葉で表すときの境目。⚠️根拠の無い仮の値
// （2026-09-25・ユーザーに根拠が無いと伝えた上で、それでも言葉で出すことが決まった）。
// `domain/notifications.js`の`BIG_TRUST_CHANGE_THRESHOLD`（通知を出すかどうかの境目・4）
// とは別物——あちらは「知らせるかどうか」、こちらは「大きい／小さいをどの言葉にするか」。
export const TRUST_BIG_CHANGE_WORD = 5;

function trustChangeWord(delta) {
  if (delta >= TRUST_BIG_CHANGE_WORD) return "bigUp";
  if (delta > 0) return "up";
  if (delta <= -TRUST_BIG_CHANGE_WORD) return "bigDown";
  return "down"; // delta < 0（0はここへ来る前に呼び出し側で除外する）
}

/**
 * その週の重賞のうち、実際に行われたもの（1着の馬が見つかったもの）だけを組む。
 * ⚠️騎手の決め方は`domain/npcGradedRace.js`の`runNpcGradedRaces`が実際にレースへ渡す
 * 騎手（`getJockey(h)` = `jockeyById.get(jockeyIdForHorse(h, stableJockeys))`、
 * `stableJockeys = assignStablePrimaryJockeys(roster.stables, roster.npcJockeys)`）と
 * 同じ経路で求める。プレイヤーがその馬に乗った週はプレイヤー自身が騎手なので、
 * `rides`（この週プレイヤーが乗った鞍）にその馬がいればプレイヤーの名前を使う。
 */
function buildGradedResults(afterRoster, afterPlayer, rides, week, year) {
  const racesThisWeek = gradedRacesForYear(year).filter((r) => r.week === weekOfYear(week));
  if (racesThisWeek.length === 0) return [];

  const stableJockeys = assignStablePrimaryJockeys(afterRoster.stables, afterRoster.npcJockeys);
  const jockeyById = new Map(afterRoster.npcJockeys.map((j) => [j.id, j]));
  const riddenHorseIds = new Set(rides.map((r) => r.horseId));

  const results = [];
  for (const race of racesThisWeek) {
    const winner = afterRoster.horses.find((h) => {
      const last = h.record?.recentFinishes?.[0];
      return last && last.week === week && last.raceName === race.name && last.position === 1;
    });
    if (!winner) continue; // 行われなかった（候補不足等）

    const jockeyName = riddenHorseIds.has(winner.id)
      ? afterPlayer.jockey.name
      : jockeyById.get(jockeyIdForHorse(winner, stableJockeys))?.name ?? "";

    const last = winner.record.recentFinishes[0];
    results.push({
      raceName: race.name,
      courseName: findCourse(race.courseId)?.name ?? race.courseId,
      surface: race.surface,
      distance: race.distance,
      winnerName: winner.name,
      jockeyName,
      popularity: last.popularity ?? null,
      fieldSize: last.fieldSize ?? null,
    });
  }
  return results;
}

/**
 * 週の結果画面に渡すデータを組む。純関数。
 * @param {{ beforePlayer: object, afterPlayer: object, afterRoster: object,
 *   rides: object[], week: number, year: number }} args - `week`・`year`は進める前の
 *   絶対週・暦年（`beforePlayer.currentWeek`・`beforePlayer.currentYear`）。
 *   `rides`・`afterPlayer`・`afterRoster`は`advanceWeek`の戻り値の`rides`・`player`・`roster`。
 */
export function buildWeekResultSummary({ beforePlayer, afterPlayer, afterRoster, rides, week, year }) {
  const horseById = new Map(afterRoster.horses.map((h) => [h.id, h]));

  const rideSummaries = rides.map((ride) => ({
    horseId: ride.horseId,
    horseName: ride.horseName,
    courseName: findCourse(ride.courseId)?.name ?? ride.courseId,
    surface: ride.surface,
    distance: ride.distance,
    className: ride.raceName ?? classDisplayName(ride.classId),
    fell: ride.fell,
    position: ride.position,
    fieldSize: ride.fieldSize,
    popularity: ride.popularity,
    won: ride.won,
    income: ride.income,
  }));

  const mainMounts = [];
  for (const ride of rides) {
    if (ride.fell) continue; // 落馬した鞍は対象外
    if (isMainMount(beforePlayer.mainMounts, ride.horseId)) continue; // 既に主戦だった馬は対象外
    const entry = afterPlayer.mainMounts[ride.horseId] ?? { rides: 0, hasWon: false, isMain: false };
    mainMounts.push({
      horseId: ride.horseId,
      horseName: ride.horseName,
      status: entry.isMain ? "became" : "progress",
      ridesLeft: Math.max(0, MAIN_MOUNT_RIDES_REQUIRED - entry.rides),
      needsWin: !entry.hasWon,
    });
  }

  const stableIds = new Set();
  for (const ride of rides) {
    const stableId = horseById.get(ride.horseId)?.stableId;
    if (stableId) stableIds.add(stableId);
  }
  const stableById = new Map(afterRoster.stables.map((s) => [s.id, s]));
  const trust = [];
  for (const stableId of stableIds) {
    const before = trustFor(beforePlayer.trainerTrust, stableId);
    const after = trustFor(afterPlayer.trainerTrust, stableId);
    const delta = after - before;
    if (delta === 0) continue;
    trust.push({
      stableId,
      trainerName: stableById.get(stableId)?.trainerName ?? stableId,
      delta,
      change: trustChangeWord(delta),
    });
  }

  return {
    weekLabel: formatWeekLabel(year, week),
    moneyGained: afterPlayer.money - beforePlayer.money,
    moneyAfter: afterPlayer.money,
    rides: rideSummaries,
    mainMounts,
    trust,
    graded: buildGradedResults(afterRoster, afterPlayer, rides, week, year),
  };
}
