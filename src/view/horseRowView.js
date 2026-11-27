// 馬の行に出す文字（性齢・体重と前走比・前走からの間隔）と、週の結果の「曜日ごと」の組み立て。
// 見本：`design/mocks/week-result-v2.html`の案A 時刻表（2026-11-27にユーザーが選んだ）。
// 週の画面と週の結果が同じ書き方を使うために1か所に置く。DOM無し・JSX無し。`data/`だけに依存
// （`domain/`はimportしない。体重を出す関数は画面から渡してもらう）。

import { DAY } from "../data/weekDays.js";

/** 「牝3」「セン5」。年齢が分からなければ性だけ。 */
export function sexAgeLabel(genderLabel, age) {
  return `${genderLabel ?? ""}${Number.isFinite(age) ? age : ""}`;
}

/** 体重の増減：「+6」「−6」（全角のマイナス）「±0」。JRAの書き方（`design/horse-appearance-facts.md`§3.1）。 */
export function kgDiffText(diff) {
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `−${-diff}`;
  return "±0";
}

/**
 * 体重と前走比：「416（−16）」。`unit`に"kg"を渡すと「416kg（−16）」。
 * 初出走は増減の代わりに「（初出走）」。前走の体重が分からなければ体重だけ。体重が無ければ空文字。
 * @param {number|null|undefined} kg
 * @param {number|null|undefined} diff
 * @param {{ debut?: boolean, unit?: string }} [opts]
 */
export function bodyWeightText(kg, diff, { debut = false, unit = "" } = {}) {
  if (!Number.isFinite(kg)) return "";
  if (debut) return `${kg}${unit}（初出走）`;
  if (!Number.isFinite(diff)) return `${kg}${unit}`;
  return `${kg}${unit}（${kgDiffText(diff)}）`;
}

/**
 * 前走からの間隔をJRAの書き方で（2026-11-27のユーザー決定）：前走の週と今週を数えない。
 * 1週後＝「連闘」、2週後＝「中1週」、7週後＝「中6週」。初出走（`Infinity`）・分からないときは空文字。
 * @param {number} weeksSince - `weeksSinceLastRace(horse, week)`（`domain/horse.js`）
 */
export function intervalLabel(weeksSince) {
  if (!Number.isFinite(weeksSince) || weeksSince < 1) return "";
  return weeksSince === 1 ? "連闘" : `中${weeksSince - 1}週`;
}

/** 初出走か（`weeksSinceLastRace`が`Infinity`）。 */
export function isDebut(weeksSince) {
  return weeksSince === Infinity;
}

/**
 * 調教後の体重。`getter`は`domain/horseForm.js`の`trainingWeightFor(horse, year, week, seed)`
 * （戻り値`{kg, diff}`）を画面から渡す。関数がまだ無い・値が返らないときはnull（画面は体重の列ごと出さない）。
 * @returns {{ kg: number, diff: number|null }|null}
 */
export function trainingWeightView(getter, horse, year, week, seed) {
  if (typeof getter !== "function" || !horse) return null;
  const w = getter(horse, year, week, seed);
  if (!w || !Number.isFinite(w.kg)) return null;
  return { kg: w.kg, diff: Number.isFinite(w.diff) ? w.diff : null };
}

const DAY_LABEL = Object.freeze({ [DAY.SAT]: "土曜", [DAY.SUN]: "日曜" });
const byRaceNumber = (a, b) => (a.raceNumber ?? 99) - (b.raceNumber ?? 99);

/**
 * 週の結果の鞍を「土曜→日曜」「レース番号の小さい順」に組む。
 * 曜日の無い古い記録が混じっていたら、曜日に分けず1つにまとめる（見出し無し・渡された順のまま）。
 * @param {object[]} rides - `buildWeekResultSummary`の`rides`
 * @returns {{ dayLabel: string|null, courseName: string|null, emptyText: string|null, rides: object[] }[]}
 */
export function groupRidesByDay(rides) {
  if (rides.length === 0) return [];
  if (rides.some((r) => r.day !== DAY.SAT && r.day !== DAY.SUN)) {
    return [{ dayLabel: null, courseName: null, emptyText: null, rides: [...rides] }];
  }
  return [DAY.SAT, DAY.SUN].map((day) => {
    const dayRides = rides.filter((r) => r.day === day).sort(byRaceNumber);
    return {
      dayLabel: DAY_LABEL[day],
      courseName: dayRides[0]?.courseName ?? null,
      emptyText: dayRides.length === 0 ? `${DAY_LABEL[day]}は乗りませんでした。` : null,
      rides: dayRides,
    };
  });
}
