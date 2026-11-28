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
// ⭐⭐**2026-11-28（`devlog/wave14.md`§18・§19）：プレイヤーが乗るレースもここで走らせる。** プレイヤーの
// 馬も「そのレースを計画で選んだ馬の1頭」として同じ枠に入り、違いは騎手がプレイヤーなことだけ
// （`riders`。`domain/raceRun.js`）。プレイヤーのレースを世界から外す仕組みは無い。
// ⚠️**このファイルは一般競走＋オープン特別だけを扱う。** 重賞のNPC出走（史実の実データ・
// 優先出走権が絡む）は`domain/npcGradedRace.js`が別に行う。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { drawFieldSize } from "../data/raceProgram.js";
import { buildWeeklyCard, RACE_SOURCE } from "./weeklyCard.js";
import { appendRaceResult, weeksSinceLastRace } from "./horse.js";
import { withReclassedClass } from "./horseClass.js";
import { shutokuForGeneralRace } from "../data/shutokuPrize.js";
import { isSidelined } from "./fall.js";
import { runFieldRace, applyFall } from "./raceRun.js";
import { horseAfterRace, bodyKgFields } from "./horseForm.js";

// 登録が集まらない週はレースが成立しない（`FIELD_SIZE_BUCKETS`の最小5頭に合わせる）。
const MIN_FIELD_SIZE = 5;

/**
 * 計画（`horse.plan`）を読んで、今週の各レースに登録している馬を`raceId`ごとに束ねる。
 * @param {object[]} horses
 * @param {Set<string>} excludeHorseIds - 今週すでに別のレース（重賞）へ出る馬
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
 * ⭐今週の一般競走・オープン特別それぞれの出走馬を決める（走らせる前の段階）。自己完結の純関数。
 * `runNpcWeeklyRaces`が使う出走枠と**同じもの**——週の最初に騎手を割り当てる
 * （`domain/jockeyBooking.js`）ために、走らせる前に同じ枠を求められるよう切り出した。
 * ⚠️乱数（`RNG_STREAMS.NPC_RACE`）は番組表の順に1本の列を消費する。走らせる側が
 * 同じ列を二重に消費しないよう、必ず一方（走らせる側が渡された枠を使う）だけが引く。
 * 引数の意味は`runNpcWeeklyRaces`と同じ。
 * @returns {{ race: object, field: object[], fieldSize: number }[]} 出走が成立したレース
 *   （並びは番組表の順＝走らせる順）。`field`の並びは馬番の元
 */
export function planNpcWeeklyFields(
  saveSeed,
  week,
  year,
  horses,
  excludeHorseIds = new Set()
) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, week);
  const card = buildWeeklyCard(saveSeed, week, year).filter((race) => race.source !== RACE_SOURCE.GRADED);
  const byRaceId = groupByPlannedRace(horses, excludeHorseIds);
  const planned = [];

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
    planned.push({ race, field, fieldSize });
  }
  return planned;
}

/**
 * 一般競走（新馬〜3勝クラス）＋オープン特別の週次レースを全部走らせる（プレイヤーが乗るレースを含む）。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週（折り返さない。`player.currentWeek`と同じ数え方）
 * @param {number} year - 番組表の実測値を引くための暦年（`player.currentYear`）
 * @param {object[]} horses - ロースター全馬
 * @param {Set<string>} [excludeHorseIds] - 今週すでに重賞へ出た馬（同じ週に2つのレースへ出ない）
 * @param {(horse: object) => object|undefined} [getJockey] - 馬に乗るNPC騎手を引く関数。
 *   ⚠️渡さないと全馬が騎手無し（適性の倍率1.0）になる——呼び出し側は必ず渡すこと。
 * @param {Map<string, number>} [stableStrengthById] - 厩舎idごとの強さ（0〜1・
 *   `domain/popularity.js`の`computeStableStrengthById`で週1回まとめて作った値。
 *   渡さないと中間値扱い）
 * @param {{ race: object, field: object[], fieldSize: number }[]} [plannedFields] - 先に
 *   `planNpcWeeklyFields`で求めた出走枠。渡せば同じ計算を繰り返さない（渡さなければここで求める）
 * @param {Map<string, import("./raceRun.js").Rider>} [riders] - プレイヤーが乗る馬（馬id→騎乗）。
 *   その馬の騎手がプレイヤーになる以外、他の馬と何も変わらない
 * @returns {{ horses: object[], racesRun: number, startsRun: number, riderResults: Map<string, object> }}
 *   `riderResults`＝`riders`の馬ごとの結果（`{ raceId, fell, fall?, position?, fieldSize?, popularity?,
 *   finisherIds?, dayById?, horseAfter }`）。走らなかった（枠に入らなかった）馬は含まれない
 */
export function runNpcWeeklyRaces(
  saveSeed,
  week,
  year,
  horses,
  excludeHorseIds = new Set(),
  getJockey = undefined,
  stableStrengthById = new Map(),
  plannedFields = undefined,
  riders = new Map()
) {
  const fields = plannedFields ?? planNpcWeeklyFields(saveSeed, week, year, horses, excludeHorseIds);

  const horseById = new Map(horses.map((h) => [h.id, h]));
  const riderResults = new Map();

  let racesRun = 0;
  let startsRun = 0;

  for (const { race, field } of fields) {
    const run = runFieldRace({
      saveSeed,
      week,
      year,
      raceKey: `${year}-w${week}-${race.raceId}`,
      popularityKey: race.raceId,
      race,
      field,
      getJockey,
      riders,
      horseById,
      stableStrengthById,
    });
    const { condition, fieldSize, dayById, popularityByHorseId } = run;
    const finisherIds = run.finishers.map((f) => f.h.id);

    // 落馬した馬は走らない（怪我の反映だけ）。
    for (const { h, fall } of run.fallen) {
      const updated = applyFall(saveSeed, week, h, fall);
      horseById.set(h.id, updated);
      if (riders.has(h.id)) riderResults.set(h.id, { raceId: race.raceId, fell: true, fall, horseAfter: updated });
    }

    run.finishers.forEach(({ h, position }) => {
      // ⭐収得賞金は1着だけ積む（`data/shutokuPrize.js`）。クラスはレース後に収得賞金・馬齢・
      // 時期から決め直す（`domain/horseClass.js`）。⚠️オープン特別は`race.classId`が`open`。
      const age = h.bornYear != null ? year - h.bornYear : 4;
      const wasTarget = h.plan?.targetRaceId === race.raceId;
      const day = dayById.get(h.id);

      let updated = {
        ...horseAfterRace(h, day),
        record: appendRaceResult(
          h.record,
          h.classId,
          {
            position,
            fieldSize,
            popularity: popularityByHorseId.get(h.id) ?? null,
            week,
            year,
            courseId: race.courseId,
            surface: race.surface,
            distance: race.distance,
            condition,
            ...(riders.has(h.id) ? { byPlayer: true } : {}), // 「自分」の印（騎手がプレイヤーの鞍）
            ...bodyKgFields(day),
          },
          null,
          shutokuForGeneralRace(race.classId, age, position)
        ),
        // 目標レースを走り終えたら計画は完了——`null`にして次の計画待ちにする
        // （`domain/rotation.js`の`replanStaleHorses`が週の締めくくりで立て直す）。
        // 前哨戦を走っただけなら、計画（目標）はそのまま持ち越す。
        plan: wasTarget ? null : h.plan,
      };

      updated = withReclassedClass(updated, week, year);

      horseById.set(h.id, updated);
      if (riders.has(h.id)) {
        riderResults.set(h.id, {
          raceId: race.raceId,
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
  }

  return {
    horses: horses.map((h) => horseById.get(h.id) ?? h),
    racesRun,
    startsRun,
    riderResults,
  };
}
