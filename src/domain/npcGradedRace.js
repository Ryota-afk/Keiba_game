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
import { GRADED_MAX_FIELD_SIZE } from "../data/raceProgram.js";
import {
  appendRaceResultWithEarnings,
  canDebutThisWeek,
  isAgeSexEligible,
  placePrizeShare,
} from "./horse.js";
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
// 「優先出走権→収得賞金の多い順で上限まで埋める」という仮の形にする）。
// ⭐第11弾（`devlog/wave11.md`§12）：`domain/weeklyCard.js`が計画段階の定員に使う値と
// 同じ1箇所（`data/raceProgram.js`）から取る——2箇所に18を書かない。
const MAX_FIELD_SIZE = GRADED_MAX_FIELD_SIZE;
const MIN_FIELD_SIZE = 5;

/**
 * 本番レース`race`の優先出走権の対象馬idを、同じ年のトライアル結果から集める
 * （第11弾・`devlog/wave11.md`§12「訂正」で探す向きを直した）。
 *
 * ⚠️⚠️**実データの`trialFor`はトライアル側が持つ**（例：「京都新聞杯 （菊花賞トライアル）」の
 * `trialFor`は`"菊花賞"`。本番の「菊花賞」自身の`trialFor`は`null`）。
 * ⭐**トライアルの`trialFor`（`extractTrialTarget`が「（オークストライアル）」等から抜き出した
 * 通称・例：「オークス」）と、本番レースの実際の`name`（正式名＋通称の括弧付き・例：
 * 「優駿牝馬（オークス）」）は文字列として一致しない。** `tools/build-graded-races.mjs`が
 * `name`をグレード表記だけ剥がして保存し、季節・通称の括弧は残す仕様のため
 * （`arch/horse.md`の質問15の記録でも「オークス」という通称で書かれている）。
 * ここでは同じ年の重賞から、`trialFor`が本番の`name`に**部分文字列として含まれ**、
 * 本番自身ではなく、本番より前の週に行われたレースを全部探し、その結果
 * （`trialResultsForYear[T.name]`＝そのレースの上位3頭）の和集合を返す
 * ——1つの本番に複数のトライアルが対応することもあるため（例：皐月賞にはスプリング
 * ステークス以外のトライアルもある）、1件だけ探して終わりにしない。
 * @param {object[]} gradedRacesThisYear - `gradedRacesForYear(year)`（実データ）
 * @param {object} race - 今から走らせる本番レース
 * @param {Record<string, string[]>|undefined} trialResultsForYear - `trialResults[year]`
 * @returns {Set<string>}
 */
function priorityIdsForRace(gradedRacesThisYear, race, trialResultsForYear) {
  const ids = new Set();
  if (!trialResultsForYear) return ids;
  for (const t of gradedRacesThisYear) {
    if (t.id === race.id) continue; // 自分自身は除く
    if (!t.trialFor) continue; // トライアルでないレースは対象外
    if (!race.name.includes(t.trialFor)) continue; // この本番のトライアルではない
    if (!(t.week < race.week)) continue; // 本番より後（または同じ週）のレースは対象外
    for (const id of trialResultsForYear[t.name] ?? []) ids.add(id);
  }
  return ids;
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
  const gradedRacesThisYear = gradedRacesForYear(year);
  const racesToday = gradedRacesThisYear.filter((r) => r.week === thisWeek);
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
    const priorityIds = priorityIdsForRace(gradedRacesThisYear, race, nextTrialResults[year]);

    const candidates = [];
    for (const horse of horses) {
      if (horse.isRetired) continue;
      if (excludeHorseIds.has(horse.id) || racedHorseIds.has(horse.id)) continue;
      if (isSidelined(horse)) continue;
      if (classIndex(horse.classId) < MIN_ENTRY_CLASS_INDEX) continue;
      if (!canRaceOnSurface(horse.surfaceAptitude, race.surface)) continue;
      if (race.fillyOnly && horse.gender !== "filly") continue;
      if (!canDebutThisWeek(horse, week, year)) continue;
      // ⭐第11弾（`devlog/wave11.md`§12）：実データの年齢・性別条件（`race.condition`）。
      // 優先出走権を持つ馬もここは免除しない——トライアルを勝った馬でも年齢が
      // 合わなければ本番には出られない（実データの`condition`自体がそう決めている）。
      if (!isAgeSexEligible(horse, race.condition, year)) continue;
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

    // 走ったレースが何であれ、上位（優先出走権の対象）を記録しておく——このレース自身が
    // 別の本番のトライアルなら（`trialFor`を持つなら）、`priorityIdsForRace`が次にその
    // 本番を走らせるときにここを`race.name`（＝自分の名前）で引きに来る。
    // ⚠️`trialFor`はトライアル側が持つ（本番側は`null`。上の`priorityIdsForRace`のコメント参照）。
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
