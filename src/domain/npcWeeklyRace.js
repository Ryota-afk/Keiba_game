// NPC全馬（プレイヤーが乗らなかった残り）の毎週レース処理。
// 質問14＝(A)「現役馬を全部持ち毎週ローテを回す」の本実装（`arch/race-program.md`§7・
// `tools/bench-weekloop.mjs`のクラス×馬場別キュー方式を実データの形へ移植した）。
//
// ⭐2026-09-15：レースの中身（クラス・競馬場・馬場・距離）を、`domain/weeklyCard.js`が
// 組んだその週の番組表からそのまま引くように変えた（`arch/race-program.md`§10）。
// それまではクラスごとの目標本数をこのファイルの中で毎週計算し直し、競馬場・馬場・距離も
// ここで独立に無作為抽選していた——依頼側（`weeklyRequests.js`旧`fridayConfirmation.js`）が
// 同じ抽選をさらに別に行っていたため、プレイヤーの依頼とNPCのレースが同じ「番組表」を
// 見ていない状態だった（通しプレイ①の指摘）。
//
// ⚠️**着順の決め方は仮**（`raceOutcome.js`のhorseStrengthScoreをそのまま使う強さ比べ）。
// 本物のsim（`src/sim/`にsurface・jockeyを通す）への置き換えは`claude-opus-5`の担当
// （CLAUDE.md §2・`devlog/wave07.md`実装の順③）。
// ⚠️**このファイルは一般競走＋オープン特別だけを扱う。** 重賞のNPC出走（史実の実データ・
// 優先出走権が絡む）は`domain/npcGradedRace.js`が別に行う。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { drawFieldSize } from "../data/raceProgram.js";
import { buildWeeklyCard, RACE_SOURCE } from "./weeklyCard.js";
import { canRaceOnSurface } from "../data/surfaceAptitude.js";
import {
  classAfterWin,
  classAfterDebutLoss,
  pickRotationIntervalWeeks,
  isDueForNextRace,
  canDebutThisWeek,
  appendRaceResult,
} from "./horse.js";
import { horseStrengthScore } from "./raceOutcome.js";
import { checkFall, applyInjuryToHorse, isSidelined } from "./fall.js";
import { rollFractureRetirement } from "./retirement.js";
import { rollActualCondition } from "./weather.js";

/**
 * 一般競走（新馬〜3勝クラス）＋オープン特別のNPC週次レースを全部走らせる。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週（折り返さない。`player.currentWeek`と同じ数え方）
 * @param {number} year - 番組表の実測値を引くための暦年（`player.currentYear`）
 * @param {object[]} horses - ロースター全馬
 * @param {Set<string>} [excludeHorseIds] - 今週プレイヤーが乗った馬（対象外にする）
 * @param {Set<string>} [excludeRaceIds] - 今週プレイヤーが乗ったレース（同じレースが
 *   二重に開催されないよう、週の番組表からその枠を外す）
 * @returns {{ horses: object[], racesRun: number, startsRun: number }}
 */
export function runNpcWeeklyRaces(
  saveSeed,
  week,
  year,
  horses,
  excludeHorseIds = new Set(),
  excludeRaceIds = new Set()
) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, week);
  const card = buildWeeklyCard(saveSeed, week, year).filter(
    (race) => race.source !== RACE_SOURCE.GRADED && !excludeRaceIds.has(race.raceId)
  );

  const horseById = new Map(horses.map((h) => [h.id, h]));
  const poolByClass = new Map();
  for (const horse of horses) {
    if (horse.isRetired) continue;
    if (excludeHorseIds.has(horse.id)) continue;
    if (isSidelined(horse)) continue; // 離脱中（怪我）は出走候補にしない
    if (!isDueForNextRace(horse, week)) continue;
    if (!canDebutThisWeek(horse, week, year)) continue; // 2歳の解禁前
    if (!poolByClass.has(horse.classId)) poolByClass.set(horse.classId, []);
    poolByClass.get(horse.classId).push(horse);
  }

  let racesRun = 0;
  let startsRun = 0;

  for (const race of card) {
    const classPool = poolByClass.get(race.classId);
    if (!classPool || classPool.length < 5) continue; // 出走頭数の最小（`FIELD_SIZE_BUCKETS`）に届かない

    // 収得賞金の多い順（質問15「条件戦も同じ」）。同額（新馬戦など多くは0円）に
    // ごく小さな乱数を足して割り切る——厳密な同額順のままだと、同額どうしが毎週
    // 同じ並び順のまま固定され、後ろに並んだ馬がいつまでも出走できなくなる。
    const eligible = classPool
      .filter((h) => canRaceOnSurface(h.surfaceAptitude, race.surface))
      .filter((h) => !race.fillyOnly || h.gender === "filly")
      .map((h) => ({ h, key: h.record.earnings + rand01() * 0.001 }))
      .sort((a, b) => b.key - a.key)
      .map((x) => x.h);
    if (eligible.length < 5) continue;

    const desired = drawFieldSize(rand01);
    const fieldSize = Math.min(desired, eligible.length);
    const field = eligible.slice(0, fieldSize); // 既に収得賞金の多い順＝人気順の仮の指標
    const popularityByHorseId = new Map(field.map((h, i) => [h.id, i + 1]));
    const fieldIds = new Set(field.map((h) => h.id));
    poolByClass.set(race.classId, classPool.filter((h) => !fieldIds.has(h.id)));
    const condition = rollActualCondition(saveSeed, week, race.courseId);

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
        record: appendRaceResult(h.record, h.classId, {
          position,
          fieldSize,
          popularity: popularityByHorseId.get(h.id) ?? null,
          week,
          year,
          courseId: race.courseId,
          surface: race.surface,
          distance: race.distance,
          condition,
        }),
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

  return {
    horses: horses.map((h) => horseById.get(h.id) ?? h),
    racesRun,
    startsRun,
  };
}
