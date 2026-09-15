// NPC全馬（プレイヤーが乗らなかった残り）の毎週レース処理。
// 質問14＝(A)「現役馬を全部持ち毎週ローテを回す」の本実装（`arch/race-program.md`§7・
// `tools/bench-weekloop.mjs`のクラス×馬場別キュー方式を実データの形へ移植した）。
//
// ⚠️**着順の決め方は仮**（`raceOutcome.js`のhorseStrengthScoreをそのまま使う強さ比べ）。
// 本物のsim（`src/sim/`にsurface・jockeyを通す）への置き換えは`claude-opus-5`の担当
// （CLAUDE.md §2・`devlog/wave07.md`実装の順③）。
// ⚠️**このファイルは一般競走（新馬〜3勝クラス）だけを扱う。** 重賞・オープン特別のNPC出走
// （史実ローテーション・優先出走権が絡む）は別途、後続の増分で作る。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { streamRandom, RNG_STREAMS, weightedPick } from "../core/rng.js";
import { WEEKS_PER_YEAR } from "../data/calendar.js";
import {
  buildYearlyClassCounts,
  drawFieldSize,
  SURFACE_SHARE,
  NON_OPEN_CLASS_SHARE,
} from "../data/raceProgram.js";
import { MEETING_DAYS_PER_YEAR } from "../data/jraMeetingSchedule.js";
import { gradedRacesForYear, hasGradedRaceData } from "../data/gradedRacesByYear.js";
import { canRaceOnSurface } from "../data/surfaceAptitude.js";
import {
  classAfterWin,
  classAfterDebutLoss,
  pickRotationIntervalWeeks,
  isDueForNextRace,
  appendRaceResult,
} from "./horse.js";
import { horseStrengthScore } from "./raceOutcome.js";
import { checkFall, applyInjuryToHorse, isSidelined } from "./fall.js";
import { rollFractureRetirement } from "./retirement.js";

// 重賞データが無い年の仮の重賞本数（`tools/build-graded-races.mjs`で作った1974〜1987年の
// 実測本数84〜100の中央値）。年ごとの実データが揃ったら`gradedRacesForYear`に置き換わる。
const FALLBACK_GRADED_COUNT = 90;

const GENERAL_CLASS_KEYS = Object.keys(NON_OPEN_CLASS_SHARE); // shinba, maiden, win1, win2, win3

function gradedCountForYear(year) {
  return hasGradedRaceData(year) ? gradedRacesForYear(year).length : FALLBACK_GRADED_COUNT;
}

/** 週あたりの目標レース数を確率的に丸める（例：0.4本／週なら40%の週だけ1本走る）。 */
function stochasticRound(value, rand01) {
  const floor = Math.floor(value);
  const frac = value - floor;
  return rand01() < frac ? floor + 1 : floor;
}

/**
 * 一般競走（新馬〜3勝クラス）のNPC週次レースを全部走らせる。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週（折り返さない。`player.currentWeek`と同じ数え方）
 * @param {number} year - 番組表の実測値を引くための暦年（`player.currentYear`）
 * @param {object[]} horses - ロースター全馬
 * @param {Set<string>} [excludeHorseIds] - 今週プレイヤーが乗った馬（対象外にする）
 * @returns {{ horses: object[], racesRun: number, startsRun: number }}
 */
export function runNpcWeeklyRaces(saveSeed, week, year, horses, excludeHorseIds = new Set()) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, week);
  const { counts } = buildYearlyClassCounts(year, MEETING_DAYS_PER_YEAR, gradedCountForYear(year));

  const horseById = new Map(horses.map((h) => [h.id, h]));
  const queueByClass = new Map(GENERAL_CLASS_KEYS.map((k) => [k, []]));
  for (const horse of horses) {
    if (horse.isRetired) continue;
    if (excludeHorseIds.has(horse.id)) continue;
    if (isSidelined(horse)) continue; // 離脱中（怪我）は出走候補にしない
    if (!isDueForNextRace(horse, week)) continue;
    const queue = queueByClass.get(horse.classId);
    if (queue) queue.push(horse);
  }

  let racesRun = 0;
  let startsRun = 0;

  for (const classKey of GENERAL_CLASS_KEYS) {
    let queue = queueByClass.get(classKey);
    if (queue.length === 0) continue;
    const targetRaces = stochasticRound((counts[classKey] ?? 0) / WEEKS_PER_YEAR, rand01);

    for (let r = 0; r < targetRaces; r += 1) {
      if (queue.length < 5) break; // 出走頭数の最小（`FIELD_SIZE_BUCKETS`）に届かない

      const surface = weightedPick(rand01, SURFACE_SHARE);
      // 収得賞金の多い順（質問15「条件戦も同じ」）。同額（新馬戦など多くは0円）に
      // ごく小さな乱数を足して割り切る——厳密な同額順のままだと、同額どうしが毎週
      // 同じ並び順のまま固定され、後ろに並んだ馬がいつまでも出走できなくなる。
      const eligible = queue
        .filter((h) => canRaceOnSurface(h.surfaceAptitude, surface))
        .map((h) => ({ h, key: h.record.earnings + rand01() * 0.001 }))
        .sort((a, b) => b.key - a.key)
        .map((x) => x.h);
      if (eligible.length < 5) continue;

      const desired = drawFieldSize(rand01);
      const fieldSize = Math.min(desired, eligible.length);
      const field = eligible.slice(0, fieldSize);
      const fieldIds = new Set(field.map((h) => h.id));
      queue = queue.filter((h) => !fieldIds.has(h.id));
      queueByClass.set(classKey, queue);

      // 強さ比べで着順を決める（⚠️仮sim。`raceOutcome.js`のhorseStrengthScoreをそのまま使う）。
      const scored = field
        .map((h) => ({ h, score: horseStrengthScore(h, null) + (rand01() - 0.5) * 30 }))
        .sort((a, b) => b.score - a.score);

      scored.forEach(({ h }, idx) => {
        const position = idx + 1;
        const won = position === 1;
        const nextClassId = won ? classAfterWin(h.classId) : classAfterDebutLoss(h.classId);
        const intervalRand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, "interval", week, h.id);

        let updated = {
          ...h,
          classId: nextClassId,
          record: appendRaceResult(h.record, h.classId, position),
          lastRaceWeek: week,
          nextRaceIntervalWeeks: pickRotationIntervalWeeks(intervalRand01),
        };

        // 落馬・怪我（⚠️簡略化：この週の着順そのものには反映せず、次週以降の離脱と
        // 引退判定③の材料だけに使う。`arch/horse.md`「⭐ 落馬・怪我」は本来プレイヤーの
        // 鞍を主眼にした仕組みだが、引退規則③「骨折した馬の3割が引退」を成立させるには
        // NPCの馬にも骨折が起こる必要があるため、ここでも`fall.js`の判定をそのまま使う）。
        const fall = checkFall(saveSeed, week, h.id, h.abilities.health, 0);
        if (fall.fell) {
          updated = applyInjuryToHorse(updated, fall);
          if (fall.injuryType === "fracture" && rollFractureRetirement(saveSeed, week, h.id)) {
            updated = { ...updated, isRetired: true };
          }
        }

        horseById.set(h.id, updated);
        startsRun += 1;
      });
      racesRun += 1;
    }
  }

  return {
    horses: horses.map((h) => horseById.get(h.id) ?? h),
    racesRun,
    startsRun,
  };
}
