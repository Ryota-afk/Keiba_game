// 1日のレース番号（1R〜12R）の並べ方（第13弾§22・`devlog/wave13.md`§20のユーザー決定）。
// 正本は`arch/race-program.md`§11。出典と数え方は`design/jra-race-order-and-pace.md`§3。
// 純データ＋純関数のみ（JSX無し）。

import { racesPerDay } from "./raceProgram.js";

/**
 * 並びの型の年代（ユーザー決定「年代に合わせる」）。
 * A：〜1981年（1日11本・重賞は9R）／B：1982〜1997年（11本・重賞は11R・G1は10R）／C：1998年〜（12本・重賞は11R）。
 */
export function raceOrderEra(year) {
  if (year <= 1981) return "A";
  if (year <= 1997) return "B";
  return "C";
}

/**
 * 2024年の一般競走のクラス×レース番号の本数（JRA公式の番組表から数えた。282開催日・平地。
 * `design/jra-race-order-and-pace.md`§3.3）。⭐**重みとして使う**（クラスを番号へ割り振るとき、
 * 本数の多い番号ほど選ばれやすい）。列＝新馬・未勝利・1勝・2勝・3勝。重賞・オープンは別に置くので含めない。
 * 行は1R〜12R。
 */
export const TEMPLATE_CLASS_COUNT_BY_ROW = Object.freeze([
  { shinba: 0, maiden: 247, win1: 2, win2: 0, win3: 0 }, // 1R
  { shinba: 6, maiden: 269, win1: 7, win2: 0, win3: 0 }, // 2R
  { shinba: 19, maiden: 239, win1: 24, win2: 0, win3: 0 }, // 3R
  { shinba: 54, maiden: 145, win1: 21, win2: 0, win3: 0 }, // 4R
  { shinba: 161, maiden: 88, win1: 19, win2: 0, win3: 0 }, // 5R
  { shinba: 51, maiden: 92, win1: 135, win2: 2, win3: 2 }, // 6R
  { shinba: 0, maiden: 40, win1: 228, win2: 10, win3: 1 }, // 7R
  { shinba: 0, maiden: 1, win1: 196, win2: 70, win3: 0 }, // 8R
  { shinba: 0, maiden: 3, win1: 119, win2: 115, win3: 24 }, // 9R
  { shinba: 0, maiden: 3, win1: 14, win2: 124, win3: 114 }, // 10R
  { shinba: 0, maiden: 0, win1: 2, win2: 16, win3: 56 }, // 11R（メイン。重賞・オープンが無い日の一般競走）
  { shinba: 0, maiden: 1, win1: 144, win2: 120, win3: 11 }, // 12R（平場の1勝・2勝）
]);

/** 重みに足す下駄。型に本数が0でも、クラスが余ったときにどこかの枠へ入れるため。 */
export const TEMPLATE_FLOOR_WEIGHT = 3;

/**
 * 「その日のN番目のレース」が、2024年の型（12本）のどの行にあたるか（1〜12）。
 * 11本の日は12Rを無くして詰める：Wikipedia「中央競馬」の「特別競走は原則として第9-11競走
 * （11競走の場合は第8-10競走）」に合わせ、特別（2024年の9R・10R）を8R・9R・10Rへ寄せる。
 * 〜1981年はメインが9Rなので、メインの行（11）を9Rへ置き、10R・11Rはそのあとの2勝3勝・平場の行にする。
 * ⚠️〜1981年の10R・11Rの中身、1982〜97年の型は、承認済みの出典に日ごとの番組表が無い——推測（`devlog/wave13.md`§22）。
 * @param {number} year
 * @param {number} number - 1始まりのレース番号
 * @returns {number} 型の行（1〜12）
 */
export function templateRowFor(year, number) {
  const era = raceOrderEra(year);
  if (era === "C") return Math.min(12, number);
  if (number <= 7) return number;
  if (era === "A") return [0, 0, 0, 0, 0, 0, 0, 0, 9, 11, 10, 12][number] ?? 12; // 8→9行・9→メイン行・10→10行・11→平場行
  // B：1982〜97年（11本）。8・9・10を特別、11をメイン
  return [0, 0, 0, 0, 0, 0, 0, 0, 9, 10, 10, 11][number] ?? 11;
}

/**
 * 重賞を置くレース番号の優先順（先頭が定位置、空いていなければ次）。
 * ユーザー決定：〜1981年は9R／1982〜97年は11R（G1は10R）／1998年〜は11R。
 * 同じ競馬場・同じ日に2本目の重賞が来たら10R（先頭が10Rのとき＝1982〜97年のG1と、その日のもう1本は11R）。
 * @param {number} year
 * @param {boolean} isG1 - G1（1983年までは「1984年にG1だった」もの）
 * @returns {number[]}
 */
export function gradedRaceNumberPreference(year, isG1) {
  const n = racesPerDay(year);
  const era = raceOrderEra(year);
  const list = era === "A" ? [9, 10, 8] : era === "B" ? (isG1 ? [10, 11, 9] : [11, 10, 9]) : [11, 10, 9];
  return [...list, ...Array.from({ length: n }, (_, i) => n - i)]; // 全部埋まっていたら後ろの番号から探す
}

/**
 * オープン特別を置くレース番号の優先順。重賞の日はメインが埋まっているので、次の特別の番号へ寄る。
 * 〜1981年：9R・10R・8R／1982年〜：11R・10R・9R（1998年〜は12本だが同じ）。
 */
export function openStakesNumberPreference(year) {
  const n = racesPerDay(year);
  const list = raceOrderEra(year) === "A" ? [9, 10, 8] : [11, 10, 9];
  return [...list, ...Array.from({ length: n }, (_, i) => n - i)];
}
