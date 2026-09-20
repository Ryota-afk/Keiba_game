// 週末レースの結果処理（ARCHITECTURE.md §2「週の流れ」の「結果」・§1「必ず知らせる6項目」）。
// 1つの確定した鞍（mount）について、落馬判定→仮sim→収入→信頼→評判→主戦判定→開示の
// 順に処理し、更新後のplayer・horseと、この鞍から出た通知を返す。
// 純ロジック（JSX無し。`domain/`の他ファイルを組み合わせる合成レイヤー）。
//
// ⚠️「仮」の位置づけ：`raceOutcome.js`が仮simである以上、ここも仮の結果処理である。
// ⑦でレースsim本実装に差し替わっても、この合成レイヤーの形（何の後に何を処理するか）
// 自体は流用できるはず。

import { runPlaceholderRace } from "./raceOutcome.js";
import { nextClassAfterRace, appendRaceResult } from "./horse.js";
import { checkFall, applyInjuryToHorse } from "./fall.js";
import { rollActualCondition } from "./weather.js";
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
 * @param {{ horseId: string, declaredStrategy?: string|null, courseId?: string, surface?: string,
 *           distance?: number, raceId?: string }} mount
 * @param {object[]} allHorses - ロースター全馬（実在の相手馬を組むために使う）
 * @param {(horse: object) => object|undefined} [getJockey] - 相手馬に乗るNPC騎手を引く関数
 * @returns {{ player: object, horse: object, notifications: object[], raced: boolean,
 *   ride: { horseId: string, horseName: string, raceId: string|null|undefined,
 *     raceName: string|null|undefined, courseId: string|null|undefined,
 *     surface: string|null|undefined, distance: number|null|undefined,
 *     classId: string|null|undefined, grade: string|null|undefined, fell: boolean,
 *     position: number|null, fieldSize: number|null, popularity: number|null,
 *     won: boolean, income: number, injuryType?: "fracture"|"bruise", weeksOut?: number } }}
 */
export function processMountResult(saveSeed, week, player, horse, mount, allHorses, getJockey) {
  const notifications = [];
  // 画面へ渡す「この鞍で何が起きたか」——`mount`（依頼側の実データ）と、この先で
  // 計算される結果・収入を1つにまとめる。値そのものは元々計算済みのものをそのまま乗せるだけ。
  const rideBase = {
    horseId: horse.id,
    horseName: horse.name,
    raceId: mount.raceId ?? null,
    raceName: mount.raceName ?? null,
    courseId: mount.courseId ?? null,
    surface: mount.surface ?? null,
    distance: mount.distance ?? null,
    classId: mount.classId ?? null,
    grade: mount.grade ?? null,
  };

  // 落馬を先に判定する（落馬すればそのレースは走らない）。
  const fall = checkFall(saveSeed, week, horse.id, horse.abilities.health, player.fatigue);
  if (fall.fell) {
    notifications.push(injuryNotification(horse.id, fall.injuryType, fall.weeksOut));
    return {
      player,
      horse: applyInjuryToHorse(horse, fall),
      notifications,
      raced: false,
      ride: {
        ...rideBase,
        fell: true,
        position: null,
        fieldSize: null,
        popularity: null,
        won: false,
        income: 0, // 落馬した鞍には騎乗料が出ない（下の`rideIncome`呼び出しに到達しないため）
        injuryType: fall.injuryType,
        weeksOut: fall.weeksOut,
      },
    };
  }

  const fatigueFactor = fatiguePenaltyFactor(player.fatigue);
  // ⚠️馬場状態はここで1回だけ決め、simにも戦績にも同じ値を渡す（別々に引くとズレる）。
  const condition = mount.courseId ? rollActualCondition(saveSeed, week, mount.courseId) : "good";
  const result = runPlaceholderRace(saveSeed, week, mount, horse, allHorses, {
    jockeyPenalty: fatigueFactor,
    playerJockey: player.jockey,
    getJockey,
    condition,
  });

  const income = rideIncome(horse.classId, result.won); // この鞍1件ぶんの騎乗料（画面へも渡す）
  let nextPlayer = { ...player, money: player.money + income };

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
  // ⭐第10弾（2026-09-17）：目標レースを走り終えたら計画は完了（`null`にして
  // `domain/rotation.js`の`replanStaleHorses`に次の計画を立て直させる）。
  // 前哨戦を走っただけなら、計画（目標）はそのまま持ち越す（`devlog/wave10.md`）。
  const wasTarget = horse.plan?.targetRaceId === mount.raceId;
  nextHorse = {
    ...nextHorse,
    plan: wasTarget ? null : horse.plan,
    // クラスの昇降（J）：勝てば1段（新馬の勝ちは1勝クラスへ）、新馬を負ければ未勝利へ。
    // ⚠️2026-09-04まで呼び出し元が無く、全馬が新馬のまま固定されていた。
    classId: nextClassAfterRace(horse.classId, result.won),
    // 通算成績：`domain/npcWeeklyRace.js`のNPC馬と同じ形で積む（2026-09-15までは
    // プレイヤーが乗った馬だけ通算成績が更新されず、収得賞金順の出走選抜や引退判定で
    // NPC馬とズレる不整合があった）。⭐距離は`mount.distance`（週の番組表・実データが
    // 決めた具体的なメートル数。`arch/race-program.md`§10）をそのまま使う。
    record: appendRaceResult(horse.record, horse.classId, {
      position: result.position,
      fieldSize: result.fieldSize,
      popularity: result.popularity,
      week,
      year: player.currentYear,
      courseId: mount.courseId ?? null,
      surface: mount.surface ?? null,
      distance: mount.distance ?? null,
      condition,
    }),
  };

  const ride = {
    ...rideBase,
    fell: false,
    position: result.position,
    fieldSize: result.fieldSize,
    popularity: result.popularity,
    won: result.won,
    income,
  };

  return { player: nextPlayer, horse: nextHorse, notifications, raced: true, result, ride };
}
