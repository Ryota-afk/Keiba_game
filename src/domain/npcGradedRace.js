// 重賞のNPC週次レース（`gradedRacesByYear.js`の実データを使う）。
// `domain/npcWeeklyRace.js`（一般競走・新馬〜3勝クラス）の重賞版。
//
// ⚠️**オープン特別は対象外**。実データが無く（`arch/race-program.md`§3の1.07倍推定値しか
// 無い）、実装するには推定生成の設計が要る——重賞の実データだけを先に本筋2へ入れる
// （2026-09-15にユーザーが選んだ優先順位）。
// ⚠️**着順の決め方は仮**（`raceOutcome.js`のhorseStrengthScoreをそのまま使う強さ比べ）。
// 本物のsimへの置き換えは`claude-opus-5`の担当（CLAUDE.md §2）。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { weekOfYear } from "../data/calendar.js";
import { gradedRacesForYear, hasGradedRaceData } from "../data/gradedRacesByYear.js";
import { canRaceOnSurface } from "../data/surfaceAptitude.js";
import { classIndex } from "../data/classes.js";
import { appendRaceResultWithEarnings, pickRotationIntervalWeeks, isDueForNextRace, placePrizeShare } from "./horse.js";
import { horseStrengthScore } from "./raceOutcome.js";
import { checkFall, applyInjuryToHorse, isSidelined } from "./fall.js";
import { rollFractureRetirement } from "./retirement.js";
import { determineEntries, PRIORITY_ENTRY_RANK_CUTOFF } from "./entryPriority.js";

// オープン以上（重賞に出られる最低クラス）。`arch/horse.md`「クラス（10段）」。
const MIN_ENTRY_CLASS_INDEX = classIndex("open");
// 出走頭数の上限（JRAの実際の上限。史実の1レースごとの実頭数はまだ取れていないため、
// 「収得賞金の多い順で上限まで埋める」という仮の形にする）。
const MAX_FIELD_SIZE = 18;
const MIN_FIELD_SIZE = 5;

/**
 * トライアルの`trialFor`（`extractTrialTarget`が「（オークストライアル）」等から抜き出した
 * 通称・例：「オークス」）と、本番レースの実際の`name`（正式名＋通称の括弧付き・例：
 * 「優駿牝馬（オークス）」）は文字列として一致しない。⚠️`tools/build-graded-races.mjs`が
 * `name`をグレード表記だけ剥がして保存し、季節・通称の括弧は残す仕様のため
 * （`arch/horse.md`の質問15の記録でも「オークス」という通称で書かれている）。
 * ここでは年内のレース名から`trialFor`を**部分文字列として含む**ものを1件だけ探す
 * ——年内の重賞は最大100本程度・トライアル対応は年4〜5組だけなので、誤マッチのリスクは
 * `tools/build-graded-races.mjs`の固定週G1照合（24本から探す）ほど高くない。
 */
function findTrialResultKey(trialResultsForYear, trialFor) {
  if (!trialResultsForYear) return null;
  return Object.keys(trialResultsForYear).find((name) => name.includes(trialFor)) ?? null;
}

/**
 * ある年・その週に行われる重賞を全部走らせる。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週
 * @param {number} year - `player.currentYear`
 * @param {object[]} horses - ロースター全馬
 * @param {Set<string>} excludeHorseIds - 今週プレイヤーが乗った馬
 * @param {object} trialResults - `{ [year]: { [レース名]: string[] } }`（優先出走権の材料。
 *   トライアルの上位（`entryPriority.js`の`PRIORITY_ENTRY_RANK_CUTOFF`まで）の馬idを、
 *   レース名をキーに年ごとに持つ）
 * @returns {{ horses: object[], trialResults: object, racedHorseIds: Set<string>,
 *             racesRun: number, startsRun: number }}
 */
export function runNpcGradedRaces(saveSeed, week, year, horses, excludeHorseIds, trialResults) {
  if (!hasGradedRaceData(year)) {
    return { horses, trialResults, racedHorseIds: new Set(), racesRun: 0, startsRun: 0 };
  }

  const thisWeek = weekOfYear(week);
  const racesToday = gradedRacesForYear(year).filter((r) => r.week === thisWeek);
  if (racesToday.length === 0) {
    return { horses, trialResults, racedHorseIds: new Set(), racesRun: 0, startsRun: 0 };
  }

  const horseById = new Map(horses.map((h) => [h.id, h]));
  const racedHorseIds = new Set();
  let nextTrialResults = trialResults;
  let racesRun = 0;
  let startsRun = 0;

  // 出走候補プール（オープン以上・引退していない・今週まだ走っていない・出走間隔が来ている）。
  // ⚠️レースごとに候補を毎回作り直す——同じ週の複数の重賞に同じ馬が2回出ないよう、
  // 選ばれた馬は`racedHorseIds`へ積んで次のレースの候補から除く。
  for (const race of racesToday) {
    const rand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, "graded", week, race.id);

    const trialKey = race.trialFor ? findTrialResultKey(nextTrialResults[year], race.trialFor) : null;
    const priorityIds = new Set(trialKey ? nextTrialResults[year][trialKey] : []);

    const candidates = [];
    for (const horse of horses) {
      if (horse.isRetired) continue;
      if (excludeHorseIds.has(horse.id) || racedHorseIds.has(horse.id)) continue;
      if (isSidelined(horse)) continue;
      if (classIndex(horse.classId) < MIN_ENTRY_CLASS_INDEX) continue;
      if (!canRaceOnSurface(horse.surfaceAptitude, race.surface)) continue;
      if (race.fillyOnly && horse.gender !== "filly") continue;
      if (!isDueForNextRace(horse, week) && !priorityIds.has(horse.id)) continue;
      candidates.push(horse);
    }
    if (candidates.length < MIN_FIELD_SIZE) continue; // 出走できる馬が少なすぎる週はレースが成立しない

    const fieldSize = Math.min(MAX_FIELD_SIZE, candidates.length);
    const { entries } = determineEntries(candidates, fieldSize, priorityIds);

    const scored = entries
      .map((h) => ({ h, score: horseStrengthScore(h, null) + (rand01() - 0.5) * 30 }))
      .sort((a, b) => b.score - a.score);

    const topFinishers = [];
    scored.forEach(({ h }, idx) => {
      const position = idx + 1;
      topFinishers.push(h.id);
      const earningsGain = (race.prize1 ?? 0) * placePrizeShare(position);
      const intervalRand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, "interval", week, h.id);

      let updated = {
        ...h,
        record: appendRaceResultWithEarnings(h.record, position, earningsGain, true),
        lastRaceWeek: week,
        nextRaceIntervalWeeks: pickRotationIntervalWeeks(intervalRand01),
      };

      const fall = checkFall(saveSeed, week, h.id, h.abilities.health, 0);
      if (fall.fell) {
        updated = applyInjuryToHorse(updated, fall);
        if (fall.injuryType === "fracture" && rollFractureRetirement(saveSeed, week, h.id)) {
          updated = { ...updated, isRetired: true };
        }
      }

      horseById.set(h.id, updated);
      racedHorseIds.add(h.id);
      startsRun += 1;
    });
    racesRun += 1;

    // このレースがどこかの本番の「トライアル」なら、上位（優先出走権の対象）を記録する
    // （質問15：対応表はレース名にそのまま入っている。`trialFor`は本番側が持つ）。
    nextTrialResults = {
      ...nextTrialResults,
      [year]: {
        ...(nextTrialResults[year] ?? {}),
        [race.name]: topFinishers.slice(0, PRIORITY_ENTRY_RANK_CUTOFF),
      },
    };
  }

  return {
    horses: horses.map((h) => horseById.get(h.id) ?? h),
    trialResults: nextTrialResults,
    racedHorseIds,
    racesRun,
    startsRun,
  };
}
