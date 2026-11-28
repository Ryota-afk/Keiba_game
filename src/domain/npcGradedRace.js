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
// ⭐⭐2026-11-28（`devlog/wave14.md`§18・§19）：プレイヤーが乗る重賞もここで走らせる（プレイヤーの馬も
// 出られる馬の1頭として同じ枠に入り、違いは騎手がプレイヤーなことだけ。`riders`・`domain/raceRun.js`）。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { weekOfYear } from "../data/calendar.js";
import { gradedRacesForYear, hasGradedRaceData } from "../data/gradedRacesByYear.js";
import { canRaceOnSurface, preferSuitedRunners } from "../data/surfaceAptitude.js";
import { shutokuForGradedRace } from "../data/shutokuPrize.js";
import { gradedTierOf } from "../data/gradedTier.js";
import { GRADED_MAX_FIELD_SIZE } from "../data/raceProgram.js";
import {
  appendRaceResultWithEarnings,
  canDebutThisWeek,
  isAgeSexEligible,
  placePrizeShare,
} from "./horse.js";
import { shutokuOf, withReclassedClass } from "./horseClass.js";
import { isSidelined } from "./fall.js";
import { PRIORITY_ENTRY_RANK_CUTOFF } from "./entryPriority.js";
import { runFieldRace, applyFall } from "./raceRun.js";
import { horseAfterRace, bodyKgFields } from "./horseForm.js";

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
 * ⭐**トライアルの`trialFor`は`tools/build-graded-races.mjs`が`FIXED_G1_WEEK`のキー（本番の正式名・
 * 例：「優駿牝馬」「東京優駿」「NHKマイルカップ」）に直してある**（2026-10-13。それまでは「オークス」
 * のような通称のままだった）。本番レースの実際の`name`は「優駿牝馬（オークス）」のように
 * 正式名＋通称の括弧付きなので、文字列の完全一致ではなく**部分文字列**で当てる
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
 * ⭐今週の重賞それぞれの出走馬を決める（走らせる前の段階）。自己完結の純関数。
 * `runNpcGradedRaces`が使う出走枠と**同じもの**——週の最初に騎手を割り当てる
 * （`domain/jockeyBooking.js`）ために、走らせる前に同じ枠を求められるよう切り出した。
 * 出走馬は今週の初めのロースター（`horses`）だけで決まる（同じ週の別のレースの結果には
 * 依存しない。同じ週の複数の重賞に同じ馬が2回出ないよう、選ばれた馬は次のレースの
 * 候補から除く）。引数の意味は`runNpcGradedRaces`と同じ。
 * @returns {{ race: object, entries: object[], fieldSize: number }[]} 今週行われる重賞
 *   （出走が成立したものだけ。並びは`gradedRacesForYear`の順＝走らせる順）
 */
export function planNpcGradedFields(week, year, horses, trialResults) {
  if (!hasGradedRaceData(year)) return [];

  const thisWeek = weekOfYear(week);
  const gradedRacesThisYear = gradedRacesForYear(year);
  const racesToday = gradedRacesThisYear.filter((r) => r.week === thisWeek);
  if (racesToday.length === 0) return [];

  const racedHorseIds = new Set();
  const planned = [];

  // 出走候補プール（収得賞金が0円でない＝1勝以上・引退していない・今週まだ走っていない・怪我をしていない）。
  // ⚠️レースごとに候補を毎回作り直す——同じ週の複数の重賞に同じ馬が2回出ないよう、
  // 選ばれた馬は`racedHorseIds`へ積んで次のレースの候補から除く。
  for (const race of racesToday) {
    const priorityIds = priorityIdsForRace(gradedRacesThisYear, race, trialResults[year]);

    const candidates = [];
    for (const horse of horses) {
      if (horse.isRetired) continue;
      if (racedHorseIds.has(horse.id)) continue;
      if (isSidelined(horse)) continue;
      if (!(shutokuOf(horse) > 0)) continue; // 重賞は収得賞金が0円でない馬なら出られる（未出走・未勝利は除く）
      if (!canRaceOnSurface(horse.surfaceAptitude, race.surface)) continue;
      if (race.fillyOnly && horse.gender !== "filly") continue;
      if (!canDebutThisWeek(horse, week, year)) continue;
      // ⭐第11弾（`devlog/wave11.md`§12）：実データの年齢・性別条件（`race.condition`）。
      // 優先出走権を持つ馬もここは免除しない——トライアルを勝った馬でも年齢が
      // 合わなければ本番には出られない（実データの`condition`自体がそう決めている）。
      if (!isAgeSexEligible(horse, race.condition, year)) continue;
      // ⭐計画（`horse.plan`）は問わない：出られる馬すべてが候補で、定員を超えたら
      // 優先出走権→収得賞金の多い順で決める（第13弾・`design/jra-entry-rules.md`§2）。
      candidates.push(horse);
    }
    if (candidates.length < MIN_FIELD_SIZE) continue; // 出走できる馬が少なすぎる週はレースが成立しない

    const fieldSize = Math.min(MAX_FIELD_SIZE, candidates.length);
    // ⭐優先出走権の馬を先に（収得賞金の多い順）、残りを収得賞金の多い順に並べ、その馬場に向いた馬
    // （◎か○）を先に（足りなければ△で埋める・`data/surfaceAptitude.js`の`preferSuitedRunners`）。
    // ⚠️収得賞金は同額の馬が多い（400万・500万…）ので、同額なら獲得賞金の多い順で割る。
    const byShutokuDesc = (a, b) => shutokuOf(b) - shutokuOf(a) || b.record.earnings - a.record.earnings;
    const entries = candidates.filter((h) => priorityIds.has(h.id)).sort(byShutokuDesc);
    const rest = candidates.filter((h) => !priorityIds.has(h.id)).sort(byShutokuDesc);
    const need = fieldSize - entries.length;
    if (need > 0) entries.push(...preferSuitedRunners(rest, race.surface, need).slice(0, need));
    entries.length = Math.min(entries.length, fieldSize);
    for (const h of entries) racedHorseIds.add(h.id);
    planned.push({ race, entries, fieldSize: entries.length });
  }
  return planned;
}

/**
 * ある年・その週に行われる重賞を全部走らせる（プレイヤーが乗る重賞を含む）。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週
 * @param {number} year - `player.currentYear`
 * @param {object[]} horses - ロースター全馬
 * @param {object} trialResults - `{ [year]: { [レース名]: string[] } }`（優先出走権の材料。
 *   トライアルの上位（`entryPriority.js`の`PRIORITY_ENTRY_RANK_CUTOFF`まで）の馬idを、
 *   レース名をキーに年ごとに持つ）
 * @param {(horse: object) => object|undefined} [getJockey] - 馬に乗るNPC騎手を引く関数
 * @param {Map<string, number>} [stableStrengthById] - 厩舎idごとの強さ（0〜1・
 *   `domain/popularity.js`の`computeStableStrengthById`で週1回まとめて作った値。
 *   渡さないと中間値扱い）
 * @param {{ race: object, entries: object[], fieldSize: number }[]} [plannedFields] - 先に
 *   `planNpcGradedFields`で求めた出走枠。渡せば同じ計算を繰り返さない（渡さなければここで求める）
 * @param {Map<string, import("./raceRun.js").Rider>} [riders] - プレイヤーが乗る馬（馬id→騎乗）
 * @returns {{ horses: object[], trialResults: object, racedHorseIds: Set<string>,
 *             racesRun: number, startsRun: number, riderResults: Map<string, object> }}
 *   `riderResults`の形は`runNpcWeeklyRaces`と同じ
 */
export function runNpcGradedRaces(
  saveSeed,
  week,
  year,
  horses,
  trialResults,
  getJockey,
  stableStrengthById = new Map(),
  plannedFields = undefined,
  riders = new Map()
) {
  const fields = plannedFields ?? planNpcGradedFields(week, year, horses, trialResults);
  if (fields.length === 0) {
    return { horses, trialResults, racedHorseIds: new Set(), racesRun: 0, startsRun: 0, riderResults: new Map() };
  }

  const horseById = new Map(horses.map((h) => [h.id, h]));
  const riderResults = new Map();
  const racedHorseIds = new Set();
  let nextTrialResults = trialResults;
  let racesRun = 0;
  let startsRun = 0;

  for (const { race, entries } of fields) {
    // ⚠️`entries`の並び（優先出走権→収得賞金順・馬番の元）はそのまま使う。
    const run = runFieldRace({
      saveSeed,
      week,
      year,
      raceKey: `${year}-w${week}-${race.id}`,
      popularityKey: race.id,
      race,
      field: entries,
      getJockey,
      riders,
      horseById,
      stableStrengthById,
    });
    const { condition, fieldSize, dayById, popularityByHorseId } = run;
    const finisherIds = run.finishers.map((f) => f.h.id);
    for (const h of entries) racedHorseIds.add(h.id); // 落馬した馬も今週は別のレースに出ない

    for (const { h, fall } of run.fallen) {
      const updated = applyFall(saveSeed, week, h, fall);
      horseById.set(h.id, updated);
      if (riders.has(h.id)) riderResults.set(h.id, { raceId: race.id, fell: true, fall, horseAfter: updated });
    }

    const topFinishers = [];
    run.finishers.forEach(({ h, position }) => {
      topFinishers.push(h.id);
      const earningsGain = (race.prize1 ?? 0) * placePrizeShare(position);
      const age = h.bornYear != null ? year - h.bornYear : 4;
      const wasTarget = h.plan?.targetRaceId === race.id;
      const day = dayById.get(h.id);

      let updated = {
        ...horseAfterRace(h, day),
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
            ...(riders.has(h.id) ? { byPlayer: true } : {}), // 「自分」の印（騎手がプレイヤーの鞍）
            ...bodyKgFields(day),
          },
          earningsGain,
          true,
          undefined,
          shutokuForGradedRace(race, year, position, age),
          gradedTierOf(race, year)
        ),
        // 目標だったなら計画は完了（`null`にして次の計画待ちに）。優先出走権で
        // 出た馬（自分の計画外の重賞）や前哨戦を走っただけの馬は計画をそのまま持ち越す。
        plan: wasTarget ? null : h.plan,
      };

      updated = withReclassedClass(updated, week, year);

      horseById.set(h.id, updated);
      if (riders.has(h.id)) {
        riderResults.set(h.id, {
          raceId: race.id,
          fell: false,
          position,
          fieldSize,
          popularity: popularityByHorseId.get(h.id) ?? null,
          finisherIds,
          dayById,
          horseAfter: updated,
        });
      }
      startsRun += 1;
    });
    if (run.finishers.length > 0) racesRun += 1;

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
    riderResults,
  };
}
