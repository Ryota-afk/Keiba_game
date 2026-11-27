// 週の番組表の「競馬場×日×レース番号」の枠（第13弾§22・`arch/race-program.md`§11）。
// `domain/weeklyCard.js`が使う。枠は「その週に開いている競馬場×土日」ごとにその年の1日の本数
// （`racesPerDay`）ちょうどあり、重賞・オープン特別・一般競走の順に、番号を優先順で埋めていく。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { weightedPickIndex } from "../core/rng.js";
import { racesPerDay } from "../data/raceProgram.js";
import { DAY } from "../data/weekDays.js";
import { TEMPLATE_CLASS_COUNT_BY_ROW, TEMPLATE_FLOOR_WEIGHT, templateRowFor } from "../data/raceNumbers.js";

/** 一般競走のクラスを番号へ割り振る順。制約の強い（置ける番号が少ない）クラスから先に置く。 */
const GENERAL_CLASS_ORDER = ["shinba", "win3", "win2", "maiden", "win1"];

/**
 * 開いている競馬場×土日の枠を作る。並びは土曜の競馬場順→日曜の競馬場順。
 * @param {string[]} courseIds - その週に開いている競馬場
 * @param {number} year
 * @returns {{ key: string, courseId: string, day: string, size: number, races: (object|null)[] }[]}
 *   `races[i]`＝(i+1)Rに置いたレース（空ならnull）
 */
export function createCardSlots(courseIds, year) {
  const size = racesPerDay(year);
  const slots = [];
  for (const day of [DAY.SAT, DAY.SUN]) {
    for (const courseId of courseIds) {
      slots.push({ key: `${courseId}|${day}`, courseId, day, size, races: Array(size).fill(null) });
    }
  }
  return slots;
}

/** 枠の中の、まだ空いている番号（1始まり）。 */
export function freeNumbers(slot) {
  const free = [];
  for (let i = 0; i < slot.races.length; i += 1) if (slot.races[i] == null) free.push(i + 1);
  return free;
}

/**
 * 優先順（番号の並び）の最初の空きへレースを置く。
 * @returns {number|null} 置いた番号（空きが1つも無ければnull）
 */
export function placeInSlot(slot, race, preference) {
  for (const number of preference) {
    if (number >= 1 && number <= slot.size && slot.races[number - 1] == null) {
      slot.races[number - 1] = race;
      return number;
    }
  }
  const any = freeNumbers(slot)[0];
  if (any == null) return null;
  slot.races[any - 1] = race;
  return any;
}

/** 重賞・オープン特別がすでに置かれている本数（オープン特別の置き場所を散らすのに使う）。 */
export function featureCount(slot) {
  return slot.races.filter((r) => r != null).length;
}

/**
 * 空いている枠すべてに、引いておいた一般競走のクラスを並びの型どおりに割り振る。
 * 方法：クラスを`GENERAL_CLASS_ORDER`の順に、まだ空いている枠から「型の本数＋下駄」を重みにして
 * 1つずつ選ぶ。⚠️クラスの割合（`drawGeneralRaceClass`）は変えない——割り振る前に引いた分をそのまま並べるだけ。
 * @param {object[]} slots
 * @param {number} year
 * @param {string[]} classes - 空き枠と同じ数だけ引いたクラスid
 * @param {() => number} rand01
 * @returns {{ slot: object, number: number, classId: string }[]} 空き枠の順（土曜の競馬場順→日曜…、番号の昇順）
 */
export function assignGeneralClasses(slots, year, classes, rand01) {
  const open = [];
  for (const slot of slots) for (const number of freeNumbers(slot)) open.push({ slot, number, classId: null });
  const ordered = [...classes].sort((a, b) => GENERAL_CLASS_ORDER.indexOf(a) - GENERAL_CLASS_ORDER.indexOf(b));
  const remaining = open.map((_, i) => i);
  for (const classId of ordered) {
    const weights = remaining.map((i) => {
      const row = TEMPLATE_CLASS_COUNT_BY_ROW[templateRowFor(year, open[i].number) - 1];
      return (row[classId] ?? 0) + TEMPLATE_FLOOR_WEIGHT;
    });
    const at = weightedPickIndex(rand01, weights);
    if (at < 0) break;
    open[remaining[at]].classId = classId;
    remaining.splice(at, 1);
  }
  return open;
}
