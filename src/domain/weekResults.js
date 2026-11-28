// 週末レースの結果処理（ARCHITECTURE.md §2「週の流れ」の「結果」・§1「必ず知らせる6項目」）。
// 1つの確定した鞍（mount）について、**世界のレースの結果**（`domain/npcWeeklyRace.js`・
// `npcGradedRace.js`が他の馬と同じ仕組みで走らせたもの。⭐2026-11-28・`devlog/wave14.md`§19）を読み、
// 収入→信頼→評判→主戦判定→開示の順に処理して、更新後のplayer・horseと、この鞍から出た通知を返す。
// プレイヤーのためにレースを走らせることはしない（走らせた結果を読むだけ）。
// 純ロジック（JSX無し。`domain/`の他ファイルを組み合わせる合成レイヤー）。

import { gradedRaceById } from "../data/shutokuPrize.js";
import { gradedTierOf } from "../data/gradedTier.js";
import { rideIncome } from "./income.js";
import { adjustTrust, trustFor } from "./player.js";
import { recordRide } from "./mainMount.js";
import { attemptReveal } from "./disclosure.js";
import { computeReputation } from "./reputation.js";
import { injuryNotification, bigTrustChangeNotification, isBigTrustChange } from "./notifications.js";
import { raceDayForm, bodyKgFields } from "./horseForm.js";

function gradedTierForRide(mount, year) {
  const race = gradedRaceById(year, mount.raceId);
  return race ? gradedTierOf(race, year) : (mount.grade ?? "g3");
}

export const RIDE_TRAINER_TRUST_GAIN = 1; // 日常の鞍そのもの（乗るだけで少し上がる）
export const WIN_TRAINER_TRUST_GAIN = 3; // 勝つとさらに上がる
export const WIN_OWNER_TRUST_GAIN = 3; // 「その馬主の馬で結果を出す」（§6）

/**
 * 1つの確定した鞍を処理する。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {object} player
 * @param {object} horseBefore - その週の初めの馬
 * @param {{ horseId: string, declaredStrategy?: string|null, courseId?: string, surface?: string,
 *           distance?: number, raceId?: string }} mount
 * @param {object} run - その馬の結果（`runNpcWeeklyRaces`・`runNpcGradedRaces`の`riderResults`の1件。
 *   レースの後の馬`horseAfter`〈戦績・クラス・計画・怪我は反映済み〉・着順・人気を持つ）
 * @returns {{ player: object, horse: object, notifications: object[], raced: boolean,
 *   ride: { horseId: string, horseName: string, raceId: string|null|undefined,
 *     raceName: string|null|undefined, courseId: string|null|undefined,
 *     surface: string|null|undefined, distance: number|null|undefined,
 *     classId: string|null|undefined, grade: string|null|undefined, fell: boolean,
 *     position: number|null, fieldSize: number|null, popularity: number|null,
 *     won: boolean, income: number, prize: number, tier?: string,
 *     injuryType?: "fracture"|"bruise", weeksOut?: number } }}
 */
export function processMountResult(saveSeed, week, player, horseBefore, mount, run) {
  const horse = horseBefore;
  const horseAfter = run.horseAfter;
  const notifications = [];
  // 画面へ渡す「この鞍で何が起きたか」——`mount`（依頼側の実データ）と、この先で
  // 計算される結果・収入を1つにまとめる。値そのものは元々計算済みのものをそのまま乗せるだけ。
  const rideBase = {
    horseId: horse.id,
    horseName: horse.name,
    raceId: mount.raceId ?? null,
    raceName: mount.raceName ?? null,
    day: mount.day ?? null,
    raceNumber: mount.raceNumber ?? null, // 第13弾§22：その日の何レース目か（古い記録には無い）
    courseId: mount.courseId ?? null,
    surface: mount.surface ?? null,
    distance: mount.distance ?? null,
    classId: mount.classId ?? null,
    grade: mount.grade ?? null,
    // ⭐⑭：性・馬齢・毛色と、当日の馬体重・前走比（`domain/horseForm.js`）。前走比は初出走・前走の体重が
    // 記録に無いときnull。⚠️当日の体重はレースの前に量る値なので、落馬した鞍にも付ける。
    gender: horse.gender ?? null,
    age: horse.bornYear != null ? player.currentYear - horse.bornYear : null,
    coat: horse.coat ?? null,
    ...bodyKgFields(raceDayForm(horse, saveSeed, week, player.currentYear)),
  };

  // 落馬した馬は走っていない（世界のレースで落馬の判定を受け、怪我が`horseAfter`に反映済み）。
  if (run.fell) {
    notifications.push(injuryNotification(horse.id, run.fall.injuryType, run.fall.weeksOut));
    return {
      player,
      horse: horseAfter,
      notifications,
      raced: false,
      ride: {
        ...rideBase,
        fell: true,
        position: null,
        fieldSize: null,
        popularity: null,
        won: false,
        prize: 0,
        income: 0, // 落馬した鞍には騎乗料が出ない
        injuryType: run.fall.injuryType,
        weeksOut: run.fall.weeksOut,
      },
    };
  }

  const result = {
    position: run.position,
    fieldSize: run.fieldSize,
    won: run.position === 1,
    popularity: run.popularity,
    finisherIds: run.finisherIds,
  };
  let nextPlayer = { ...player };

  // 調教師への信頼：乗るだけで少し、勝てばさらに（§6「調教師への信頼」＝日常の鞍）。
  const trainerBefore = trustFor(nextPlayer.trainerTrust, horse.stableId);
  let trainerTrust = adjustTrust(nextPlayer.trainerTrust, horse.stableId, RIDE_TRAINER_TRUST_GAIN);
  if (result.won) trainerTrust = adjustTrust(trainerTrust, horse.stableId, WIN_TRAINER_TRUST_GAIN);
  const trainerAfter = trustFor(trainerTrust, horse.stableId);
  nextPlayer = { ...nextPlayer, trainerTrust };
  if (isBigTrustChange(trainerAfter - trainerBefore)) {
    notifications.push(
      bigTrustChangeNotification("trainer", horse.stableId, trainerAfter - trainerBefore)
    );
  }

  // 馬主への信頼：「その馬主の馬で結果を出す」＝勝ったときだけ（§6「馬主への信頼」）。
  if (result.won) {
    const ownerBefore = trustFor(nextPlayer.ownerTrust, horse.ownerId);
    const ownerTrust = adjustTrust(nextPlayer.ownerTrust, horse.ownerId, WIN_OWNER_TRUST_GAIN);
    const ownerAfter = trustFor(ownerTrust, horse.ownerId);
    nextPlayer = { ...nextPlayer, ownerTrust };
    if (isBigTrustChange(ownerAfter - ownerBefore)) {
      notifications.push(bigTrustChangeNotification("owner", horse.ownerId, ownerAfter - ownerBefore));
    }
  }

  nextPlayer = {
    ...nextPlayer,
    reputation: computeReputation(nextPlayer.trainerTrust, nextPlayer.ownerTrust),
    mainMounts: recordRide(nextPlayer.mainMounts, horse.id, result.won, horse.name),
  };

  // 開示：プレイヤーが自分で判断した鞍なので、レースプールが進む（§3「能力の開示」）。
  const nextHorse = attemptReveal(saveSeed, week, horseAfter, "race");
  // この鞍でその馬が稼いだ獲得賞金（円・`ride.prize`＝最多獲得賞金騎手の材料）。
  const prizeGain = horseAfter.record.earnings - horse.record.earnings;
  // この鞍1件ぶんの収入（画面・年間成績へも渡す）。進上金＝馬が今取った本賞（`prizeGain`）の5%
  const income = rideIncome(horse.classId, prizeGain);
  nextPlayer = { ...nextPlayer, money: nextPlayer.money + income };

  const ride = {
    ...rideBase,
    fell: false,
    position: result.position,
    fieldSize: result.fieldSize,
    popularity: result.popularity,
    won: result.won,
    income,
    prize: prizeGain, // その馬が稼いだ獲得賞金（円）。落馬した鞍は0
    ...(mount.raceName ? { tier: gradedTierForRide(mount, player.currentYear) } : {}),
  };

  return { player: nextPlayer, horse: nextHorse, notifications, raced: true, result, ride };
}
