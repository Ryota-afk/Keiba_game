// 週末レースの結果処理（ARCHITECTURE.md §2「週の流れ」の「結果」・§1「必ず知らせる6項目」）。
// 1つの確定した鞍（mount）について、落馬判定→仮sim→収入→信頼→評判→主戦判定→開示の
// 順に処理し、更新後のplayer・horseと、この鞍から出た通知を返す。
// 純ロジック（JSX無し。`domain/`の他ファイルを組み合わせる合成レイヤー）。
//
// ⚠️「仮」の位置づけ：`raceOutcome.js`が仮simである以上、ここも仮の結果処理である。
// ⑦でレースsim本実装に差し替わっても、この合成レイヤーの形（何の後に何を処理するか）
// 自体は流用できるはず。

import { runPlaceholderRace } from "./raceOutcome.js";
import { checkFall, applyInjuryToHorse } from "./fall.js";
import { fatiguePenaltyFactor } from "./fatigue.js";
import { rideIncome } from "./income.js";
import { adjustTrust, trustFor } from "./player.js";
import { recordRide } from "./mainMount.js";
import { attemptReveal } from "./disclosure.js";
import { computeReputation } from "./reputation.js";
import { injuryNotification, bigTrustChangeNotification, isBigTrustChange } from "./notifications.js";

export const RIDE_TRAINER_TRUST_GAIN = 1; // 日常の鞍そのもの（乗るだけで少し上がる）
export const WIN_TRAINER_TRUST_GAIN = 3; // 勝つとさらに上がる
export const WIN_OWNER_TRUST_GAIN = 3; // 「その馬主の馬で結果を出す」（§6）

/**
 * 1つの確定した鞍を処理する。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {object} player
 * @param {object} horse
 * @param {{ horseId: string, declaredStrategy?: string|null }} mount
 * @returns {{ player: object, horse: object, notifications: object[], raced: boolean }}
 */
export function processMountResult(saveSeed, week, player, horse, mount) {
  const notifications = [];

  // 落馬を先に判定する（落馬すればそのレースは走らない）。
  const fall = checkFall(saveSeed, week, horse.id, horse.abilities.health, player.fatigue);
  if (fall.fell) {
    notifications.push(injuryNotification(horse.id, fall.injuryType, fall.weeksOut));
    return {
      player,
      horse: applyInjuryToHorse(horse, fall),
      notifications,
      raced: false,
    };
  }

  const fatigueFactor = fatiguePenaltyFactor(player.fatigue);
  const result = runPlaceholderRace(saveSeed, week, mount, horse, fatigueFactor);

  let nextPlayer = { ...player, money: player.money + rideIncome(horse.classId, result.won) };

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
    mainMounts: recordRide(nextPlayer.mainMounts, horse.id, result.won),
  };

  // 開示：プレイヤーが自分で判断した鞍なので、レースプールが進む（§3「能力の開示」）。
  let nextHorse = attemptReveal(saveSeed, week, horse, "race");
  nextHorse = { ...nextHorse, lastRaceWeek: week };

  return { player: nextPlayer, horse: nextHorse, notifications, raced: true, result };
}
