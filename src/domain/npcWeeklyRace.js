// NPC全馬（プレイヤーが乗らなかった残り）の毎週レース処理。
// 質問14＝(A)「現役馬を全部持ち毎週ローテを回す」の本実装（`arch/race-program.md`§7・
// `tools/bench-weekloop.mjs`のクラス×馬場別キュー方式を実データの形へ移植した）。
//
// ⭐2026-09-15：レースの中身（クラス・競馬場・馬場・距離）を、`domain/weeklyCard.js`が
// 組んだその週の番組表からそのまま引くように変えた（`arch/race-program.md`§10）。
// ⭐2026-09-16：着順を本物のsim（`src/sim/`）で決めるようにした（`devlog/wave08.md`）。
// ⭐⭐**2026-09-17（第10弾）：出走登録を`horse.plan`ベースへ作り直した**（`devlog/wave10.md`）。
// 以前は「クラスが合う・出走間隔が来ている馬」を毎週クラス別プールから機械的に集めていたが、
// `isDueForNextRace`は走らせるほど全頭が「出走できる状態」のまま積み上がる欠陥があった
// （`devlog/wave09.md`§15）。今は**そのレースを目標か前哨戦にしている馬だけ**が登録される
// ——`domain/rotation.js`の`planNextTarget`が事前に決めた計画を読むだけで、ここでは
// 「合う馬を探す」処理そのものが要らなくなった。
// ⚠️**このファイルは一般競走＋オープン特別だけを扱う。** 重賞のNPC出走（史実の実データ・
// 優先出走権が絡む）は`domain/npcGradedRace.js`が別に行う。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { drawFieldSize } from "../data/raceProgram.js";
import { buildWeeklyCard, RACE_SOURCE } from "./weeklyCard.js";
import { classAfterWin, classAfterDebutLoss, appendRaceResult, weeksSinceLastRace } from "./horse.js";
import { runRaceSim, buildPlan } from "../sim/index.js";
import { deriveFavoredStrategy } from "./strategy.js";
import { checkFall, applyInjuryToHorse, isSidelined } from "./fall.js";
import { rollFractureRetirement } from "./retirement.js";
import { rollActualCondition } from "./weather.js";
import { computePopularity } from "./popularity.js";

// 登録が集まらない週はレースが成立しない（`FIELD_SIZE_BUCKETS`の最小5頭に合わせる）。
const MIN_FIELD_SIZE = 5;

/**
 * 計画（`horse.plan`）を読んで、今週の各レースに登録している馬を`raceId`ごとに束ねる。
 * @param {object[]} horses
 * @param {Set<string>} excludeHorseIds - 今週プレイヤーが乗った馬
 * @returns {Map<string, object[]>}
 */
function groupByPlannedRace(horses, excludeHorseIds) {
  const byRaceId = new Map();
  for (const horse of horses) {
    if (horse.isRetired || excludeHorseIds.has(horse.id) || isSidelined(horse) || !horse.plan) continue;
    const { targetRaceId, prepRaceId } = horse.plan;
    for (const raceId of [targetRaceId, prepRaceId]) {
      if (!raceId) continue;
      if (!byRaceId.has(raceId)) byRaceId.set(raceId, []);
      byRaceId.get(raceId).push(horse);
    }
  }
  return byRaceId;
}

/**
 * 一般競走（新馬〜3勝クラス）＋オープン特別のNPC週次レースを全部走らせる。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週（折り返さない。`player.currentWeek`と同じ数え方）
 * @param {number} year - 番組表の実測値を引くための暦年（`player.currentYear`）
 * @param {object[]} horses - ロースター全馬
 * @param {Set<string>} [excludeHorseIds] - 今週プレイヤーが乗った馬（対象外にする）
 * @param {Set<string>} [excludeRaceIds] - 今週プレイヤーが乗ったレース（同じレースが
 *   二重に開催されないよう、週の番組表からその枠を外す）
 * @param {(horse: object) => object|undefined} [getJockey] - 馬に乗る騎手を引く関数。
 *   ⚠️渡さないと全馬が騎手無し（適性の倍率1.0）になる——プレイヤーの鞍だけ騎手が乗る
 *   状態を作らないため、呼び出し側は必ず渡すこと。
 * @param {object[]} [stables] - ロースター全厩舎（人気の材料「厩舎の強さ」に使う。
 *   渡さないと中間値扱い）
 * @returns {{ horses: object[], racesRun: number, startsRun: number }}
 */
export function runNpcWeeklyRaces(
  saveSeed,
  week,
  year,
  horses,
  excludeHorseIds = new Set(),
  excludeRaceIds = new Set(),
  getJockey = undefined,
  stables = []
) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, week);
  const card = buildWeeklyCard(saveSeed, week, year).filter(
    (race) => race.source !== RACE_SOURCE.GRADED && !excludeRaceIds.has(race.raceId)
  );

  const horseById = new Map(horses.map((h) => [h.id, h]));
  const stableById = new Map(stables.map((s) => [s.id, s]));
  const getJockeyForHorse = (h) => getJockey?.(h);
  const byRaceId = groupByPlannedRace(horses, excludeHorseIds);

  let racesRun = 0;
  let startsRun = 0;

  for (const race of card) {
    const registered = byRaceId.get(race.raceId);
    if (!registered || registered.length < MIN_FIELD_SIZE) continue; // 登録が集まらなかった

    // ⭐第11弾・案B-2（`devlog/wave11.md`§7）：収得賞金の多い順→前走から空いた週数の
    // 多い順へ変えた。賞金は3着までしか付かないため「走らないと賞金が付かない・賞金が
    // 無いと走れない」の輪になっていた（同じ未勝利戦での通過率が賞金>0で76.3%・賞金=0で
    // 6.6%・11.5倍差）。⚠️重賞（`domain/npcGradedRace.js`）はここでは変えない——
    // 重賞は収得賞金順のままが自然（史実の出走投票も収得賞金が基準）。
    // ⚠️未出走の馬は`weeksSinceLastRace`が`Infinity`を返すため、同値どうしの割り振りは
    // 「まず週数が同じか見て、同じならごく小さな乱数で比べる」の2段にする——`Infinity`に
    // 有限の乱数を足しても`Infinity`のままで割り切れない。厳密な同値順のままだと、
    // 同値どうしが毎週同じ並び順のまま固定され、後ろに並んだ馬がいつまでも出走できなくなる。
    const ordered = registered
      .map((h) => ({ h, weeks: weeksSinceLastRace(h, week), rand: rand01() }))
      .sort((a, b) => (a.weeks !== b.weeks ? b.weeks - a.weeks : b.rand - a.rand))
      .map((x) => x.h);

    // ⭐第11弾（`devlog/wave11.md`§7）：定員はもう走る瞬間に引き直さない。
    // `domain/weeklyCard.js`が番組表を組む時点で決めた`race.fieldSize`をそのまま使う
    // ——目標を立てる側（`domain/rotation.js`）と実際に走らせる側が同じ定員を見ないと、
    // 計画段階の「残り枠」が意味を持たなくなる。
    const desired = race.fieldSize ?? drawFieldSize(rand01); // 保険：本来undefinedにはならないはず
    const fieldSize = Math.min(desired, ordered.length);
    const field = ordered.slice(0, fieldSize); // 出走馬（並び＝前走から空いた週数の多い順。馬番の元）
    // ⚠️**枠から漏れた馬（`ordered.slice(fieldSize)`）はここでは何もしない。**
    // `plan`をそのままにしておけば、目標だった馬は`domain/rotation.js`の`isPlanStale`が
    // 「今週で期限切れ」と判定して次の計画を立て直す（前哨戦止まりの馬は目標がまだ先なので
    // 立て直さない＝前哨戦を1回逃しても目標へ向かい続ける）。
    // ⚠️`field`の並び（馬番の元）はそのまま使い、人気は別の並びとして「公開されている
    // 情報」だけから作る（`domain/popularity.js`。2026-09-20のユーザー決定）。
    const popularityByHorseId = computePopularity(
      saveSeed,
      week,
      race.raceId,
      field,
      horseById,
      stableById,
      getJockeyForHorse
    );
    const condition = rollActualCondition(saveSeed, week, race.courseId);

    // 本物のsimで着順を決める（消耗・レース傾向・位置取り・適性・騎手）。
    const simEntries = field.map((h, i) => ({ num: i + 1, horse: h, jockey: getJockey?.(h) }));
    const plan = buildPlan(simEntries, (e) => deriveFavoredStrategy(e.horse), 1);
    const sim = runRaceSim({
      seed: saveSeed,
      raceKey: `${year}-w${week}-${race.raceId}`,
      distance: race.distance,
      surface: race.surface,
      condition,
      entries: simEntries,
      plan,
    });

    sim.order.map((entryIndex) => ({ h: simEntries[entryIndex].horse })).forEach(({ h }, idx) => {
      const position = idx + 1;
      const won = position === 1;
      const nextClassId = won ? classAfterWin(h.classId) : classAfterDebutLoss(h.classId);
      const wasTarget = h.plan?.targetRaceId === race.raceId;

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
        // 目標レースを走り終えたら計画は完了——`null`にして次の計画待ちにする
        // （`domain/rotation.js`の`replanStaleHorses`が週の締めくくりで立て直す）。
        // 前哨戦を走っただけなら、計画（目標）はそのまま持ち越す。
        plan: wasTarget ? null : h.plan,
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
