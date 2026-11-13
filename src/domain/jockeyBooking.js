// NPC騎手の騎乗の割り当て（`devlog/wave12.md`§15・2026-09-28のユーザー決定）。
// 週の最初に、その週の全レースの出走馬へ、日ごとに騎手を決める。純関数（JSX無し。
// `data/`・`core/`・同じ`domain/`内の`jockeyArm.js`・`jockeyAssignment.js`だけに依存）。
//
// ⭐決め方：
//   ・馬は公開の成績（`horse.record.earnings`＝獲得賞金）の多い順に、1頭ずつ割り当てる
//     ＝良い馬から先に良い騎手が付く。
//   ・候補は、その日の騎乗数が`DAILY_RIDE_CAP`未満で、同じレースにまだ乗っていない現役NPC騎手。
//   ・重み＝exp(α×腕)×（所属厩舎の騎手／その馬の主戦なら`STABLE_JOCKEY_WEIGHT_MULTIPLIER`、
//     そうでなければ1）。腕＝その鞍の距離帯と馬場の適性（`jockeyArmForMount`）。
//   ・乱数は`RNG_STREAMS.JOCKEY_BOOKING`（週・日・レース・馬idで固定）。
//   ・候補が0人なら、その馬の厩舎の主戦に戻す（上限は超えるが、騎手のいない馬は作らない）。
// ⚠️**同じ馬が複数のレースの一覧に出てくることがある**（土曜と日曜をまたぐこともある。
// プレイヤーの鞍の相手馬を拾う`domain/raceOutcome.js`の`assembleRealField`は出走計画と無関係に
// 「同クラスの収得賞金上位」を拾うため、NPC側の出走馬と重なる）。**馬idごとに1回に
// まとめて割り当てる**（放置すると1日の騎乗数を二重に数える）。土曜で決まった馬は日曜で
// 抽選し直さず同じ騎手を使い、日曜のレース枠にも載っていれば、土曜に決める時点で
// 「そのレースにはこの騎手が既にいる」と予約する（日曜の騎乗数には数えない）。

import { streamRandom, RNG_STREAMS, weightedPickIndex } from "../core/rng.js";
import { DAY } from "../data/weekDays.js";
import { distanceBandOf } from "../data/aptitudeCategories.js";
import { jockeyArmForMount, jockeyOverallArm, STABLE_JOCKEY_WEIGHT_MULTIPLIER } from "./jockeyArm.js";
import { jockeyIdForHorse } from "./jockeyAssignment.js";

export { jockeyArmForMount, jockeyOverallArm, STABLE_JOCKEY_WEIGHT_MULTIPLIER };

// 1人の騎手の1日の騎乗上限（`ARCHITECTURE.md`「NPC騎手と厩舎の結びつき」の仮置き。根拠なし）。
export const DAILY_RIDE_CAP = 8;

/**
 * @typedef {{ raceId: string, distance: number, surface: string, horses: object[] }} BookingField
 *   1レースぶんの出走馬（プレイヤーが乗る馬は含めない）。
 * @typedef {{ ridesByJockey: Map<string, number>, jockeysByRace: Map<string, Set<string>> }} BookingState
 *   1日ぶんの割り当ての状態（騎手ごとの騎乗数・レースごとの既に乗っている騎手）。
 */

/** 何も割り当てていない1日の始まりの状態。 */
export function createBookingState() {
  return { ridesByJockey: new Map(), jockeysByRace: new Map() };
}

/** 状態のコピー（Mapは複製、レースごとのSetは中身を共有したまま——書き込み側が差し替える）。 */
function cloneState(state) {
  return { ridesByJockey: new Map(state.ridesByJockey), jockeysByRace: new Map(state.jockeysByRace) };
}

/**
 * 状態へ「このレース群にこの騎手が乗る」を**書き込む**（引数の状態を書き換える内部関数。
 * 呼ぶ側が先に`cloneState`した自分の状態にだけ使う）。レースごとのSetは差し替えるので、
 * 元の状態とSetを共有していても元は変わらない。
 */
function recordBooking(state, jockeyId, raceIds, countRide) {
  if (countRide) state.ridesByJockey.set(jockeyId, (state.ridesByJockey.get(jockeyId) ?? 0) + 1);
  for (const raceId of raceIds) {
    const set = new Set(state.jockeysByRace.get(raceId) ?? []);
    set.add(jockeyId);
    state.jockeysByRace.set(raceId, set);
  }
}

/**
 * 割り当ての文脈（週・α・騎手の一覧）を作る。`expArmFor`は(距離帯,馬場)ごとに
 * 全騎手のexp(α×腕)を1回だけ計算して使い回す（馬1頭ごとに騎手126人ぶんのexpを
 * 引き直さないため）。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {object[]} npcJockeys
 * @param {number} alpha
 * @param {Map<string,string|null>} stableJockeys - `assignStablePrimaryJockeys`の返り値
 */
export function createBookingContext(saveSeed, week, npcJockeys, alpha, stableJockeys) {
  const jockeys = npcJockeys.filter((j) => j.isActive);
  const cache = new Map();
  /** @returns {number[]} jockeysと同じ並びのexp(α×腕) */
  function expArmFor(distance, surface) {
    const key = `${distanceBandOf(distance)}|${surface}`;
    let table = cache.get(key);
    if (!table) {
      table = jockeys.map((j) => Math.exp(alpha * jockeyArmForMount(j, distance, surface)));
      cache.set(key, table);
    }
    return table;
  }
  // 候補の重みと元の添字を詰める作業用の配列（馬1頭ごとに確保し直さない）。
  const weightBuffer = new Float64Array(jockeys.length);
  const indexBuffer = new Int32Array(jockeys.length);
  return { saveSeed, week, alpha, jockeys, stableJockeys, expArmFor, weightBuffer, indexBuffer };
}

/**
 * 1頭の馬に乗る騎手を1人選ぶ（状態は読むだけ）。
 * @returns {{ jockeyId: string|null, usedFallback: boolean }}
 */
function pickJockey(ctx, state, { day, horse, raceIds, distance, surface }) {
  const expArm = ctx.expArmFor(distance, surface);
  const ownJockeyId = jockeyIdForHorse(horse, ctx.stableJockeys);
  // その馬が載っているレースに既に乗っている騎手の集合（馬1頭につき1回だけ引く）。
  const busySets = [];
  for (const raceId of raceIds) {
    const set = state.jockeysByRace.get(raceId);
    if (set) busySets.push(set);
  }
  const { jockeys, weightBuffer, indexBuffer } = ctx;
  let candidateCount = 0;
  for (let i = 0; i < jockeys.length; i += 1) {
    const jockey = jockeys[i];
    if ((state.ridesByJockey.get(jockey.id) ?? 0) >= DAILY_RIDE_CAP) continue;
    let busy = false;
    for (const set of busySets) {
      if (set.has(jockey.id)) {
        busy = true;
        break;
      }
    }
    if (busy) continue;
    const isOwn = (jockey.stableId != null && jockey.stableId === horse.stableId) || jockey.id === ownJockeyId;
    weightBuffer[candidateCount] = expArm[i] * (isOwn ? STABLE_JOCKEY_WEIGHT_MULTIPLIER : 1);
    indexBuffer[candidateCount] = i;
    candidateCount += 1;
  }
  if (candidateCount === 0) {
    // 全員が上限か、同じレースに乗っている——厩舎の主戦に戻す
    return { jockeyId: ownJockeyId, usedFallback: true };
  }
  const rand01 = streamRandom(ctx.saveSeed, RNG_STREAMS.JOCKEY_BOOKING, ctx.week, day, raceIds[0], horse.id);
  const picked = weightedPickIndex(rand01, weightBuffer, candidateCount);
  return { jockeyId: jockeys[indexBuffer[picked]].id, usedFallback: false };
}

/**
 * 1頭の馬に乗る騎手を1人決める。状態は書き換えず、新しい状態を返す。
 * @param {ReturnType<typeof createBookingContext>} ctx
 * @param {BookingState} state
 * @param {{ day: string, horse: object, raceIds: string[], distance: number, surface: string }} args
 *   `raceIds`＝この馬が載っているレース（通常1つ。重なって2つ以上載ることもある）。
 *   乱数のキーと腕の計算には先頭のレースを使う。
 * @returns {{ jockeyId: string|null, state: BookingState, usedFallback: boolean }}
 */
export function bookJockeyForHorse(ctx, state, args) {
  const { jockeyId, usedFallback } = pickJockey(ctx, state, args);
  if (jockeyId == null) return { jockeyId: null, state, usedFallback };
  const next = cloneState(state);
  recordBooking(next, jockeyId, args.raceIds, true);
  return { jockeyId, state: next, usedFallback };
}

/** 獲得賞金の多い順・同額なら馬idの順（＝良い馬から先に騎手を選ぶ順）。 */
function compareByEarningsThenId(a, b) {
  const ea = a.horse.record?.earnings ?? 0;
  const eb = b.horse.record?.earnings ?? 0;
  if (ea !== eb) return eb - ea;
  return a.horse.id < b.horse.id ? -1 : a.horse.id > b.horse.id ? 1 : 0;
}

/**
 * 出走馬を馬idごとに1回へまとめる（同じ馬が複数のレースの一覧に出てくることがある）。
 * 馬が最初に出てくる日（土曜が先）・その日のレースでの距離と馬場・週のうちに載っている
 * 全レースのidを持つ。
 * @param {{ sat?: BookingField[], sun?: BookingField[] }} fieldsByDay
 * @returns {Map<string, { horse: object, firstDay: string, raceIds: string[], distance: number, surface: string }>}
 */
export function groupFieldsByHorse(fieldsByDay) {
  const byHorse = new Map();
  for (const day of [DAY.SAT, DAY.SUN]) {
    for (const field of fieldsByDay[day] ?? []) {
      for (const horse of field.horses) {
        let entry = byHorse.get(horse.id);
        if (!entry) {
          entry = { horse, firstDay: day, raceIds: [], distance: field.distance, surface: field.surface };
          byHorse.set(horse.id, entry);
        }
        entry.raceIds.push(field.raceId);
      }
    }
  }
  return byHorse;
}

/**
 * ある1日のぶんを割り当てる。その日が最初の出走日の馬だけを、獲得賞金の多い順に決める。
 * @param {ReturnType<typeof createBookingContext>} ctx
 * @param {string} day - `DAY.SAT`|`DAY.SUN`
 * @param {ReturnType<typeof groupFieldsByHorse>} byHorse - 週の全出走馬（`groupFieldsByHorse`）
 * @param {BookingState} state - `ridesByJockey`はその日の騎乗数、`jockeysByRace`は週を通した
 *   「そのレースに既に乗っている騎手」
 * @returns {{ jockeyByHorseId: Map<string,string>, state: BookingState, fallbackCount: number }}
 *   `jockeyByHorseId`はこの日に決まった馬だけ
 */
export function bookJockeysForDay(ctx, day, byHorse, state) {
  const today = [...byHorse.values()].filter((e) => e.firstDay === day).sort(compareByEarningsThenId);
  const jockeyByHorseId = new Map();
  // ⚠️1頭ごとに状態を複製すると、その日に載る数百頭ぶん全レースの表を毎回写すことになる。
  // 受け取った状態は書き換えず、この日のぶんの作業用コピーを1つだけ作って書き込む。
  const current = cloneState(state);
  let fallbackCount = 0;
  for (const entry of today) {
    const { jockeyId, usedFallback } = pickJockey(ctx, current, { day, ...entry });
    if (jockeyId) {
      jockeyByHorseId.set(entry.horse.id, jockeyId);
      recordBooking(current, jockeyId, entry.raceIds, true);
    }
    if (usedFallback) fallbackCount += 1;
  }
  return { jockeyByHorseId, state: current, fallbackCount };
}

/**
 * 1週間ぶん（土曜→日曜）を割り当てる。
 * ⚠️**土曜で決まった馬は日曜で抽選し直さず同じ騎手を使う。** その馬が日曜のレース枠にも
 * 載っていれば、土曜に決める時点で「日曜のそのレースにもこの騎手がいる」と予約する
 * （`bookJockeyForHorse`は馬の載っている全レースを見る）ので、日曜のレースで同じ騎手が
 * 2頭に重なることは起きない。日曜の騎乗数には数えない（騎乗数は最初の出走日だけ）。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週
 * @param {{ sat?: BookingField[], sun?: BookingField[] }} fieldsByDay
 * @param {object[]} npcJockeys
 * @param {number} alpha - 腕への集まりやすさ（`data/jockeyConcentration.js`）
 * @param {Map<string,string|null>} stableJockeys - `assignStablePrimaryJockeys`の返り値
 * @returns {{ jockeyByHorseId: Map<string,string>, ridesByDay: Record<string, Map<string,number>>,
 *   jockeysByRace: Map<string, Set<string>>, fallbackCount: number }}
 *   `ridesByDay`・`jockeysByRace`は計測用（日ごとの騎手別の騎乗数・レースごとに乗っている騎手）
 */
export function bookJockeysForWeek(saveSeed, week, fieldsByDay, npcJockeys, alpha, stableJockeys) {
  const ctx = createBookingContext(saveSeed, week, npcJockeys, alpha, stableJockeys);
  const byHorse = groupFieldsByHorse(fieldsByDay);
  const jockeyByHorseId = new Map();
  const ridesByDay = {};
  let jockeysByRace = new Map();
  let fallbackCount = 0;
  for (const day of [DAY.SAT, DAY.SUN]) {
    // 騎乗数は日が変わればまっさらから数える。レースの中の騎手は週を通して持ち越す。
    const state = { ridesByJockey: new Map(), jockeysByRace };
    const res = bookJockeysForDay(ctx, day, byHorse, state);
    for (const [horseId, jockeyId] of res.jockeyByHorseId) jockeyByHorseId.set(horseId, jockeyId);
    ridesByDay[day] = res.state.ridesByJockey;
    jockeysByRace = res.state.jockeysByRace;
    fallbackCount += res.fallbackCount;
  }
  return { jockeyByHorseId, ridesByDay, jockeysByRace, fallbackCount };
}
