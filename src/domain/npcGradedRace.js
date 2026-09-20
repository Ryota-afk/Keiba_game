// 重賞のNPC週次レース（`gradedRacesByYear.js`の実データを使う）。
// `domain/npcWeeklyRace.js`（一般競走・新馬〜3勝クラス）の重賞版。
//
// ⚠️**オープン特別は対象外**。実データが無く（`arch/race-program.md`§3の1.07倍推定値しか
// 無い）、実装するには推定生成の設計が要る——重賞の実データだけを先に本筋2へ入れる
// （2026-09-15にユーザーが選んだ優先順位）。
// ⭐2026-09-16：着順を本物のsim（`src/sim/`）で決めるようにした（`devlog/wave08.md`）。
// ⭐⭐**2026-09-17（第10弾）：出走登録を`horse.plan`ベースへ作り直した**（`devlog/wave10.md`・
// `domain/npcWeeklyRace.js`と同じ変更）。トライアルの優先出走権（`priorityIds`）は
// これまでどおり計画とは無関係に効く——トライアル上位馬は目標がこの重賞でなくても入れる。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { weekOfYear } from "../data/calendar.js";
import { gradedRacesForYear, hasGradedRaceData } from "../data/gradedRacesByYear.js";
import { canRaceOnSurface, preferSuitedRunners } from "../data/surfaceAptitude.js";
import { classIndex } from "../data/classes.js";
import { appendRaceResultWithEarnings, canDebutThisWeek, placePrizeShare } from "./horse.js";
import { runRaceSim, buildPlan } from "../sim/index.js";
import { deriveFavoredStrategy } from "./strategy.js";
import { checkFall, applyInjuryToHorse, isSidelined } from "./fall.js";
import { rollFractureRetirement } from "./retirement.js";
import { determineEntries, PRIORITY_ENTRY_RANK_CUTOFF } from "./entryPriority.js";
import { rollActualCondition } from "./weather.js";
import { computePopularity } from "./popularity.js";

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
 * @param {(horse: object) => object|undefined} [getJockey] - 馬に乗る騎手を引く関数
 * @param {object[]} [stables] - ロースター全厩舎（人気の材料「厩舎の強さ」に使う。
 *   渡さないと中間値扱い）
 * @returns {{ horses: object[], trialResults: object, racedHorseIds: Set<string>,
 *             racesRun: number, startsRun: number }}
 */
export function runNpcGradedRaces(
  saveSeed,
  week,
  year,
  horses,
  excludeHorseIds,
  trialResults,
  getJockey,
  stables = []
) {
  if (!hasGradedRaceData(year)) {
    return { horses, trialResults, racedHorseIds: new Set(), racesRun: 0, startsRun: 0 };
  }

  const thisWeek = weekOfYear(week);
  const racesToday = gradedRacesForYear(year).filter((r) => r.week === thisWeek);
  if (racesToday.length === 0) {
    return { horses, trialResults, racedHorseIds: new Set(), racesRun: 0, startsRun: 0 };
  }

  const horseById = new Map(horses.map((h) => [h.id, h]));
  const stableById = new Map(stables.map((s) => [s.id, s]));
  const getJockeyForHorse = (h) => getJockey?.(h);
  const racedHorseIds = new Set();
  let nextTrialResults = trialResults;
  let racesRun = 0;
  let startsRun = 0;

  // 出走候補プール（オープン以上・引退していない・今週まだ走っていない・出走間隔が来ている）。
  // ⚠️レースごとに候補を毎回作り直す——同じ週の複数の重賞に同じ馬が2回出ないよう、
  // 選ばれた馬は`racedHorseIds`へ積んで次のレースの候補から除く。
  for (const race of racesToday) {
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
      if (!canDebutThisWeek(horse, week, year)) continue;
      // ⭐計画（`horse.plan`）がこの重賞を目標か前哨戦にしているか。トライアルの
      // 優先出走権を持つ馬は、計画がこの重賞でなくても入れる（従来どおり）。
      const isPlanned =
        horse.plan && (horse.plan.targetRaceId === race.id || horse.plan.prepRaceId === race.id);
      if (!isPlanned && !priorityIds.has(horse.id)) continue;
      candidates.push(horse);
    }
    if (candidates.length < MIN_FIELD_SIZE) continue; // 出走できる馬が少なすぎる週はレースが成立しない

    const fieldSize = Math.min(MAX_FIELD_SIZE, candidates.length);
    // ⭐その馬場に向いた馬（◎か○）を先に。足りなければ△で埋める
    // （`data/surfaceAptitude.js`の`preferSuitedRunners`）。
    // ⚠️優先出走権を持つ馬はここで落とさない——`determineEntries`が先に入れる。
    const suited = preferSuitedRunners(candidates, race.surface, fieldSize);
    const withPriority = [
      ...suited,
      ...candidates.filter((h) => priorityIds.has(h.id) && !suited.includes(h)),
    ];
    const { entries } = determineEntries(withPriority, fieldSize, priorityIds);
    // ⚠️`entries`の並び（優先出走権→収得賞金順・馬番の元）はそのまま使い、人気は別の並びとして
    // 「公開されている情報」だけから作る（`domain/popularity.js`。2026-09-20のユーザー決定）。
    const popularityByHorseId = computePopularity(
      saveSeed,
      week,
      race.id,
      entries,
      horseById,
      stableById,
      getJockeyForHorse
    );
    const condition = rollActualCondition(saveSeed, week, race.courseId);

    // 本物のsimで着順を決める（消耗・レース傾向・位置取り・適性・騎手）。
    const simEntries = entries.map((h, i) => ({ num: i + 1, horse: h, jockey: getJockey?.(h) }));
    const plan = buildPlan(simEntries, (e) => deriveFavoredStrategy(e.horse), 1);
    const sim = runRaceSim({
      seed: saveSeed,
      raceKey: `${year}-w${week}-${race.id}`,
      distance: race.distance,
      surface: race.surface,
      condition,
      entries: simEntries,
      plan,
    });

    const topFinishers = [];
    sim.order.map((entryIndex) => ({ h: simEntries[entryIndex].horse })).forEach(({ h }, idx) => {
      const position = idx + 1;
      topFinishers.push(h.id);
      const earningsGain = (race.prize1 ?? 0) * placePrizeShare(position);
      const wasTarget = h.plan?.targetRaceId === race.id;

      let updated = {
        ...h,
        record: appendRaceResultWithEarnings(
          h.record,
          {
            position,
            fieldSize,
            popularity: popularityByHorseId.get(h.id) ?? null,
            raceName: race.name,
            week,
            year,
            courseId: race.courseId,
            surface: race.surface,
            distance: race.distance,
            condition,
          },
          earningsGain,
          true
        ),
        // 目標だったなら計画は完了（`null`にして次の計画待ちに）。優先出走権で
        // 出た馬（自分の計画外の重賞）や前哨戦を走っただけの馬は計画をそのまま持ち越す。
        plan: wasTarget ? null : h.plan,
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
