// 週の進行の主ループ（ARCHITECTURE.md §2「週の流れ」）。
// 月曜の依頼一覧→（平日行動は呼び出し側/UIが扱う）→金曜の確定→仮sim→結果処理を
// 1回の呼び出しで進める合成レイヤー。純ロジック（JSX無し。`domain/`の他ファイルを
// 組み合わせる）。
//
// ⚠️「仮」の位置づけ：レース文脈・着順は仮sim（`raceOutcome.js`）に依存する。
// コース選択・脚質宣言は本来プレイヤーの判断だが、ここでは`options`で差し込み関数を
// 渡せるようにし、渡されなければ既定の振る舞い（最有力コース・得意脚質どおり）を使う
// ——UIが無くてもヘッドレスに週を進められるようにするため（⑥計測ツールの土台）。

import { generateWeeklyRequests, RIDABLE_SLOTS_PER_WEEK, horsesDueThisWeek } from "./weeklyRequests.js";
import { WEEKS_PER_YEAR } from "../data/calendar.js";
import {
  resolveWeekRaceContexts,
  courseIdsAvailable,
  confirmMounts,
} from "./fridayConfirmation.js";
import { declareStrategy, deriveFavoredStrategy } from "./strategy.js";
import { processMountResult } from "./weekResults.js";
import { applyWeeklyFatigue, crossedDangerThreshold } from "./fatigue.js";
import { advanceInjuryByWeek, isSidelined } from "./fall.js";
import { isMainMount, loseMainMountToRival } from "./mainMount.js";
import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import {
  fatigueDangerNotification,
  lostMainMountNotification,
  newRequestNotification,
} from "./notifications.js";

// 主戦の座を持つが今週乗らなかった馬に、他騎手が勝つ確率（暫定。仮simの平均勝率
// （約1/12＝8.3%）に近い値を置く。ARCHITECTURE.md §15の数値の一つとして実測して調整する）。
export const RIVAL_WIN_PROBABILITY = 0.08;

/**
 * 週を1つ進める。
 * @param {number|string} saveSeed
 * @param {{ stables: object[], owners: object[], horses: object[], npcJockeys: object[] }} roster
 * @param {object} player
 * @param {{
 *   previousRequestHorseIds?: Set<string>,
 *   chooseCourse?: (courseIds: string[], requestsWithContext: object[]) => string,
 *   chooseStrategy?: (mount: object, horse: object) => string,
 *   maxMounts?: number,
 * }} [options]
 * @returns {{ roster: object, player: object, notifications: object[], requestHorseIds: Set<string> }}
 */
export function advanceWeek(saveSeed, roster, player, options = {}) {
  const week = player.currentWeek;
  const notifications = [];
  const horsesById = new Map(roster.horses.map((h) => [h.id, h]));

  // 月曜：依頼一覧
  const requests = generateWeeklyRequests(saveSeed, week, roster, player);
  const requestHorseIds = new Set(requests.map((r) => r.horseId));
  if (options.previousRequestHorseIds) {
    for (const horseId of requestHorseIds) {
      if (!options.previousRequestHorseIds.has(horseId)) {
        const horse = horsesById.get(horseId);
        notifications.push(newRequestNotification(horseId, horse?.stableId));
      }
    }
  }

  // 金曜：競馬場→鞍→脚質の確定
  const withCtx = resolveWeekRaceContexts(saveSeed, week, requests);
  const courses = courseIdsAvailable(withCtx);
  const chosenCourse = courses.length
    ? options.chooseCourse
      ? options.chooseCourse(courses, withCtx)
      : courses[0]
    : null;
  const maxMounts = options.maxMounts ?? RIDABLE_SLOTS_PER_WEEK;
  const confirmedRaw = chosenCourse ? confirmMounts(withCtx, chosenCourse, maxMounts) : [];
  const mounts = confirmedRaw
    .filter((m) => !isSidelined(horsesById.get(m.horseId))) // 離脱中は乗れない
    .map((m) => {
      const horse = horsesById.get(m.horseId);
      const strategyId = options.chooseStrategy
        ? options.chooseStrategy(m, horse)
        : deriveFavoredStrategy(horse);
      return declareStrategy(m, strategyId);
    });

  // 結果処理
  let nextPlayer = player;
  const fatigueBefore = nextPlayer.fatigue;
  for (const mount of mounts) {
    const horse = horsesById.get(mount.horseId);
    const res = processMountResult(saveSeed, week, nextPlayer, horse, mount);
    nextPlayer = res.player;
    horsesById.set(horse.id, res.horse);
    notifications.push(...res.notifications);
  }
  nextPlayer = { ...nextPlayer, fatigue: applyWeeklyFatigue(fatigueBefore, mounts.length) };
  if (crossedDangerThreshold(fatigueBefore, nextPlayer.fatigue)) {
    notifications.push(fatigueDangerNotification(nextPlayer.fatigue));
  }

  // 主戦の座を持つが今週乗らなかった馬：他騎手が勝てば失う（§6「主戦の座」）。
  const riddenThisWeek = new Set(mounts.map((m) => m.horseId));
  const dueHorseIds = new Set(horsesDueThisWeek(roster.horses, week).map((h) => h.id));
  for (const horseId of Object.keys(nextPlayer.mainMounts)) {
    if (!isMainMount(nextPlayer.mainMounts, horseId)) continue;
    if (riddenThisWeek.has(horseId)) continue;
    if (!dueHorseIds.has(horseId)) continue; // 今週走っていなければ奪われようがない
    const rand01 = streamRandom(saveSeed, RNG_STREAMS.RIVAL, week, horseId);
    if (rand01() < RIVAL_WIN_PROBABILITY) {
      nextPlayer = {
        ...nextPlayer,
        mainMounts: loseMainMountToRival(nextPlayer.mainMounts, horseId),
      };
      notifications.push(lostMainMountNotification(horseId));
    }
  }

  // 全馬の離脱期間を1週進める（乗ったかどうかに関わらず）。
  const advancedHorses = roster.horses.map((h) => {
    let horse = horsesById.get(h.id) ?? h;
    // プレイヤーが乗らなかった、出走可能だった馬もNPC騎手が乗って走ったものとして扱う
    // （2026-09-04・実測で判明。`TODO.md` #16）。⚠️プレイヤーが乗った馬しか
    // `lastRaceWeek`が進まないと、乗らなかった馬が永久に「出走待ち」のまま積み上がり、
    // 数週で全馬7,600頭が候補になってしまう。離脱中（怪我）の馬は対象外。
    if (dueHorseIds.has(horse.id) && !riddenThisWeek.has(horse.id) && !isSidelined(horse)) {
      horse = { ...horse, lastRaceWeek: week };
    }
    return advanceInjuryByWeek(horse);
  });

  // ⚠️`currentWeek`は折り返さない絶対値のまま進める（ARCHITECTURE.md §1「1年分を
  // 週×競馬場で固定して30年使い回す」の対象は番組表の中身であって、週カウンタそのもの
  // ではない）。`isDueForNextRace`が「currentWeek - lastRaceWeek」の差分で出走間隔を
  // 判定するため、年境界で1へ戻すと差分が負に転落し、年をまたいだ馬が二度と出走候補に
  // ならなくなる（2026-09-04・実測で発見。折り返す実装を先に書いて自分で壊した）。
  // 年は52週ごとに繰り上げる。週×競馬場の暦を引くときは`weekOfYear`で1〜52へ変換する。
  const wrapsToNextYear = week % WEEKS_PER_YEAR === 0;
  nextPlayer = {
    ...nextPlayer,
    currentWeek: week + 1,
    currentYear: wrapsToNextYear ? nextPlayer.currentYear + 1 : nextPlayer.currentYear,
  };

  return {
    roster: { ...roster, horses: advancedHorses },
    player: nextPlayer,
    notifications,
    requestHorseIds,
  };
}
