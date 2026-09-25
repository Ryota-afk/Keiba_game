// プレイヤーの鞍1つぶんのレース解決。
// ⭐2026-09-16：着順を本物のsim（`src/sim/`）で決めるようにした（`devlog/wave08.md`）。
// それまでは`horseStrengthScore`（能力を1つの数値に潰した強さ比べ）だった。
// ⚠️`horseStrengthScore`自体は人気の並び（`domain/dreamDerby.js`）でまだ使う。
// 純ロジック（JSX無し。`core/`・`data/`・`domain/`の他ファイルだけに依存）。
//
// ⚠️2026-09-15：相手馬を`syntheticRivalScore`で数値だけ手続き生成していたのをやめ、
// ロースターの実在の馬（名前・騎手・戦績を持つ）から実際の出走枠を組むようにした
// （出馬表の画面（案E）が実在の相手馬を必要とするため。`TODO.md`旧#23の指摘の解消）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { runRaceSim, buildPlan } from "../sim/index.js";
import { gradeToNumber } from "../data/grades.js";
import { drawFieldSize } from "../data/raceProgram.js";
import { canRaceOnSurface } from "../data/surfaceAptitude.js";
import { deriveFavoredStrategy } from "./strategy.js";
import { isSidelined } from "./fall.js";
import { computePopularity } from "./popularity.js";
import { isAgeSexEligible } from "./horse.js";

/** 馬の強さを1つの数値にまとめる（仮の指標。⑦の消耗式に置き換える）。 */
export function horseStrengthScore(horse, declaredStrategy) {
  const a = horse.abilities;
  const gradeSum = [a.sharpness, a.grit, a.flexibility, a.power]
    .map(gradeToNumber)
    .reduce((sum, v) => sum + v, 0); // 0〜60（記号4軸×0〜15）
  let score = a.speed * 0.5 + a.stamina * 0.3 + gradeSum * 2;
  if (declaredStrategy && declaredStrategy === deriveFavoredStrategy(horse)) {
    score += 5; // 得意脚質どおりに乗ったときの仮ボーナス
  }
  return score;
}

/**
 * 実際のロースターから、1頭（`anchorHorse`）を必ず含む出走枠を組む。自己完結の純関数。
 * `domain/npcWeeklyRace.js`・`domain/npcGradedRace.js`と同じ「収得賞金の多い順＋小さな
 * 乱数で同額を割り切る」選抜を使う（質問15「条件戦も同じ」）。
 * @param {() => number} rand01
 * @param {object} anchorHorse - 必ず出走枠に入る馬（プレイヤーの鞍の馬）
 * @param {string} surface
 * @param {object[]} allHorses - ロースター全馬
 * @param {number} fieldSizeTarget - 目標の出走頭数（実際の頭数は候補が少なければこれより減る）
 * @param {string|null} [condition] - 重賞の年齢・性別条件（`devlog/wave11.md`§12）。
 *   `anchorHorse`自身には適用しない（既に`horse.plan`の段階で条件を満たしている前提）——
 *   相手馬の絞り込みにだけ使う。
 * @param {number|null} [year] - `condition`の年齢を数える暦年（そのレースが実際に開催される年）
 * @returns {object[]} 出走馬の配列（`anchorHorse`を含む。並び順は収得賞金の多い順＝人気順）
 */
export function assembleRealField(rand01, anchorHorse, surface, allHorses, fieldSizeTarget, condition = null, year = null) {
  const candidates = allHorses
    .filter(
      (h) =>
        h.id !== anchorHorse.id &&
        !h.isRetired &&
        !isSidelined(h) &&
        h.classId === anchorHorse.classId &&
        canRaceOnSurface(h.surfaceAptitude, surface) &&
        isAgeSexEligible(h, condition, year)
    )
    .map((h) => ({ h, key: h.record.earnings + rand01() * 0.001 }));
  const rivalCount = Math.max(0, fieldSizeTarget - 1);
  const rivals = candidates
    .sort((a, b) => b.key - a.key)
    .slice(0, rivalCount)
    .map((x) => x.h);
  return [...[anchorHorse, ...rivals]].sort((a, b) => b.record.earnings - a.record.earnings);
}

/**
 * プレイヤーの鞍1つぶんのレースを走らせ、着順を決める。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {{ horseId: string, declaredStrategy?: string|null, surface?: string,
 *           distance?: number, raceId?: string }} mount
 * @param {object} horse
 * @param {object[]} allHorses - ロースター全馬（相手馬を実在の馬から組むために使う）
 * @param {{ jockeyPenalty?: number, playerJockey?: object, getJockey?: (h:object)=>object|undefined,
 *           condition?: string, stableStrengthById?: Map<string, number>, year?: number }} [options]
 *   - `jockeyPenalty`：疲労による騎手の能力低下の倍率（1で無補正）。§6「疲労」が奪う3つのうち
 *     「騎手の能力が落ちる」をここで反映する
 *   - `playerJockey`：プレイヤー自身の騎手。渡さないと適性の倍率が1.0になる
 *   - `getJockey`：相手馬に乗るNPC騎手を引く関数
 *   - `condition`：馬場状態（good|yielding|soft|heavy）
 *   - `stableStrengthById`：厩舎idごとの強さ（0〜1・`domain/popularity.js`の
 *     `computeStableStrengthById`で週1回まとめて作った値。人気の材料「厩舎の強さ」に使う。
 *     渡さないと中間値扱い）
 *   - `year`：このレースが実際に開催される暦年。`mount.condition`（重賞の年齢・性別条件）の
 *     年齢を数えるのに使う（`devlog/wave11.md`§12）。渡さないと年齢の条件を見ない
 *     （`horse.js`の`isAgeSexEligible`の仕様どおり）
 * @returns {{ position: number, fieldSize: number, won: boolean, field: object[],
 *             popularity: number }}
 */
export function runPlaceholderRace(saveSeed, week, mount, horse, allHorses, options = {}) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.SIM, week, mount.horseId);
  const fieldSizeTarget = drawFieldSize(rand01);
  const field = assembleRealField(
    rand01,
    horse,
    mount.surface,
    allHorses,
    fieldSizeTarget,
    mount.condition ?? null,
    options.year ?? null
  );
  const fieldSize = field.length;
  const getJockeyForHorse = (h) => (h.id === horse.id ? options.playerJockey : options.getJockey?.(h));
  // ⚠️`field`の並び（収得賞金の多い順＝馬番の元）はそのまま使い、人気は別の並びとして
  // 「公開されている情報」だけから作る（`domain/popularity.js`。2026-09-20のユーザー決定）。
  const horseById = new Map(allHorses.map((h) => [h.id, h]));
  const stableStrengthById = options.stableStrengthById ?? new Map();
  const popularityByHorseId = computePopularity(
    saveSeed,
    week,
    mount.raceId ?? mount.horseId,
    field,
    horseById,
    stableStrengthById,
    getJockeyForHorse
  );
  const popularity = popularityByHorseId.get(horse.id);

  const entries = field.map((h, i) => ({
    num: i + 1,
    horse: h,
    isSelf: h.id === horse.id,
    jockey: getJockeyForHorse(h),
    // 疲労はプレイヤーの鞍にだけ乗る（NPC騎手の疲労は持っていない）。
    jockeyPenalty: h.id === horse.id ? options.jockeyPenalty ?? 1 : 1,
  }));
  const plan = buildPlan(entries, (e) =>
    e.isSelf && mount.declaredStrategy ? mount.declaredStrategy : deriveFavoredStrategy(e.horse)
  , entries.find((e) => e.isSelf)?.num ?? 1);

  const sim = runRaceSim({
    seed: saveSeed,
    raceKey: `player-${week}-${mount.raceId ?? mount.horseId}`,
    distance: mount.distance ?? 2000,
    surface: mount.surface ?? "turf",
    condition: options.condition ?? "good",
    entries,
    plan,
  });

  const selfEntryIndex = entries.findIndex((e) => e.isSelf);
  const position = sim.order.indexOf(selfEntryIndex) + 1;
  return { position, fieldSize, won: position === 1, field, popularity };
}
