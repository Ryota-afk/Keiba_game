// 1レースを走らせる共通の部品（一般競走・オープン特別の`npcWeeklyRace.js`と重賞の`npcGradedRace.js`が使う）。
// ⭐2026-11-28（`devlog/wave14.md`§18・§19）：プレイヤーが乗るレースも、世界のほかのレースと
// **同じこの関数で走らせる**。違いは「その馬の騎手がプレイヤーである」ことだけで、それは`riders`
// （馬id → { jockey, jockeyPenalty, strategy, fatigue }）として、NPC騎手の`getJockey`と同じ入口から渡す。
// 純ロジック（JSX無し）。

import { runRaceSim, buildPlan } from "../sim/index.js";
import { deriveFavoredStrategy } from "./strategy.js";
import { checkFall, applyInjuryToHorse } from "./fall.js";
import { rollFractureRetirement } from "./retirement.js";
import { rollActualCondition } from "./weather.js";
import { computePopularity } from "./popularity.js";
import { raceDayFormsFor } from "./horseForm.js";
import { drawPostOrder } from "./postDraw.js";

/**
 * @typedef {{ jockey: object, jockeyPenalty?: number, strategy?: string|null, fatigue?: number }} Rider
 *   プレイヤーが乗る馬の騎乗。`jockey`＝プレイヤーの騎手、`jockeyPenalty`＝疲労による腕の倍率、
 *   `strategy`＝宣言した脚質（無ければ馬の得意脚質）、`fatigue`＝落馬の判定に使う疲労。
 */

let raceObserver = null;
/**
 * 計測の道具用：1レース走らせるたびに`{ raceKey, race, entries, plan, sim, condition }`を渡す（`tools/measure-*.mjs`）。
 * ゲームの計算には一切関わらない（観測するだけ）。`null`で解除。
 */
export function setRaceObserver(fn) {
  raceObserver = fn;
}

/**
 * 出走枠を走らせる。落馬した馬は走らない（`fallen`へ。怪我の反映は`applyFall`）。
 * @param {{ saveSeed: number|string, week: number, year: number, raceKey: string, popularityKey: string,
 *   race: { courseId: string, distance: number, surface: string }, field: object[],
 *   getJockey?: (h: object) => object|undefined, riders?: Map<string, Rider>,
 *   horseById: Map<string, object>, stableStrengthById: Map<string, number> }} args
 * @returns {{ condition: string, fieldSize: number, finishers: { h: object, position: number }[],
 *   fallen: { h: object, fall: object }[], popularityByHorseId: Map<string, number>, dayById: Map<string, object> }}
 */
export function runFieldRace({
  saveSeed,
  week,
  year,
  raceKey,
  popularityKey,
  race,
  field,
  getJockey,
  riders = new Map(),
  horseById,
  stableStrengthById,
}) {
  const condition = rollActualCondition(saveSeed, week, race.courseId);
  const fallen = [];
  const runners = [];
  // ⭐馬番は抽選（`domain/postDraw.js`）。計画の段階で引いてあれば並びは変わらない（同じ関数・同じキー）。
  for (const h of drawPostOrder(saveSeed, raceKey, field)) {
    const fall = checkFall(saveSeed, week, h.id, h.abilities.health, riders.get(h.id)?.fatigue ?? 0);
    if (fall.fell) fallen.push({ h, fall });
    else runners.push(h);
  }
  if (runners.length < 2) {
    return { condition, fieldSize: runners.length, finishers: [], fallen, popularityByHorseId: new Map(), dayById: new Map() };
  }
  const jockeyOf = (h) => riders.get(h.id)?.jockey ?? getJockey?.(h);
  // ⚠️`runners`の並び（馬番。抽選済み）はそのまま使い、人気は別の並びとして「公開されている情報」だけから
  // 作る（`domain/popularity.js`。2026-09-20のユーザー決定）。
  const popularityByHorseId = computePopularity(saveSeed, week, popularityKey, runners, horseById, stableStrengthById, jockeyOf);
  // ⭐調子と当日の馬体重（`domain/horseForm.js`）：倍率をsimの入口で渡し、体重を戦績に残す。
  const dayById = raceDayFormsFor(runners, saveSeed, week, year);
  const entries = runners.map((h, i) => {
    const rider = riders.get(h.id);
    return {
      num: i + 1,
      horse: h,
      isSelf: !!rider,
      jockey: jockeyOf(h),
      jockeyPenalty: rider?.jockeyPenalty ?? 1,
      formFactor: dayById.get(h.id).factor,
    };
  });
  const plan = buildPlan(
    entries,
    (e) => riders.get(e.horse.id)?.strategy || deriveFavoredStrategy(e.horse),
    entries.find((e) => e.isSelf)?.num ?? 1
  );
  const sim = runRaceSim({
    seed: saveSeed,
    raceKey,
    distance: race.distance,
    surface: race.surface,
    condition,
    entries,
    plan,
  });
  raceObserver?.({ raceKey, race, entries, plan, sim, condition });
  const finishers = sim.order.map((entryIndex, idx) => ({ h: entries[entryIndex].horse, position: idx + 1 }));
  return { condition, fieldSize: runners.length, finishers, fallen, popularityByHorseId, dayById };
}

/** 落馬の結果を馬へ反映する（怪我。骨折は引退することがある）。純関数。 */
export function applyFall(saveSeed, week, horse, fall) {
  let updated = applyInjuryToHorse(horse, fall);
  if (fall.injuryType === "fracture" && rollFractureRetirement(saveSeed, week, horse.id)) {
    updated = { ...updated, isRetired: true };
  }
  return updated;
}
