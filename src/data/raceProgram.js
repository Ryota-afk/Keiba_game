// 番組表の数値（1日の中身・出走頭数・馬場・距離・賞金）。正本は`arch/race-program.md`。
// ⭐すべて2026-09-12〜15にユーザーが決定した値をそのまま定数化する（決定Aの結果）。
// ⚠️ここにある割合・分布は「1日の一般競走をどう組み立てるか」の生成用であり、
// 実在の日付・競馬場ごとの史実カードではない（史実の一般競走の日別データは取れていない
// ため、実測した統計的な配分から毎回その場で1日ぶんを組み立てる。`arch/race-program.md`§3）。
//
// 純データ＋純関数のみ（JSX無し）。乱数は呼び出し側が`core/rng.js`の
// `streamRandom`/`weightedPick`で用意して渡す。

import { weightedPick } from "../core/rng.js";

/** 1日の基本競走数（Wikipedia「中央競馬」。`arch/race-program.md`§2）。 */
export function racesPerDay(year) {
  return year <= 1997 ? 11 : 12;
}

/**
 * オープン以上（重賞＋オープン特別）を除いた残りのレースを、5クラスへ配る割合。
 * ⚠️2026年の平地の実測（`arch/race-program.md`§3の元表）から出した値。
 * 合計は100（万一の丸め誤差は`weightedPick`が自動で正規化する）。
 */
export const NON_OPEN_CLASS_SHARE = Object.freeze({
  shinba: 10.2, // 新馬
  maiden: 38.0, // 未勝利
  win1: 29.7, // 1勝クラス
  win2: 15.0, // 2勝クラス
  win3: 7.1, // 3勝クラス
});

/**
 * オープン以上の本数をオープン特別と重賞にどう割るかの比（質問9のユーザーの制約：
 * 「オープン・リステッド・重賞は2026年の型で増やさない」＝その年の重賞の実数を先に
 * 固定し、オープン特別はその比率で決める）。
 * ⚠️根拠なし——2026年のオープン以上270本のうち重賞が約130本・オープン特別が約140本
 * だった比をそのまま借りている（`arch/race-program.md`§3）。馬ごとの戦績表を
 * 取り終えたら実測して置き換える。
 */
export const OPEN_STAKES_TO_GRADED_RATIO = 140 / 130; // ≒1.07

/** 芝・ダートの比（質問11＝(B)。2026年の実測に合わせる。`arch/race-program.md`§4）。 */
export const SURFACE_SHARE = Object.freeze({ turf: 50.2, dirt: 49.8 });

/** 芝の距離の割合（2026年の平地の実測。`arch/race-program.md`§5）。 */
export const DISTANCE_SHARE_TURF = Object.freeze({
  1000: 1.6,
  1200: 18.1,
  1400: 9.6,
  1500: 1.6,
  1600: 17.7,
  1800: 16.4,
  2000: 22.3,
  2200: 4.3,
  2400: 4.0,
  2500: 0.9,
  2600: 2.6,
  3000: 0.8, // 「3,000以上」をまとめてこの値で代表させる
});

/** ダートの距離の割合（同上）。 */
export const DISTANCE_SHARE_DIRT = Object.freeze({
  1000: 3.4,
  1150: 2.8,
  1200: 19.4,
  1300: 1.2,
  1400: 16.2,
  1600: 5.8,
  1700: 12.6,
  1800: 31.3,
  1900: 2.5,
  2000: 1.2,
  2100: 2.3,
  2400: 1.3, // 「2,400以上」をまとめてこの値で代表させる
});

/**
 * 出走頭数の分布（史実の馬24頭・527走の実測。`arch/race-program.md`§7）。
 * `[最小, 最大, 割合]`の配列。18頭立ては3.2%しかない——出馬表の画面は10頭前後を前提に作る。
 */
export const FIELD_SIZE_BUCKETS = Object.freeze([
  [5, 8, 30.6],
  [9, 12, 38.0],
  [13, 16, 23.3],
  [17, 18, 3.2],
  [19, 26, 4.9],
]);

/** 牝馬だけのレースの割合（2026年の番組表の実測。`arch/race-program.md`§6）。 */
export const FILLIES_ONLY_SHARE = 0.11;

/**
 * 2歳戦が解禁される週（暦週・1〜52）。史実の馬24頭のデビュー月の実測（6月が最も早い）に
 * 合わせ、`jraMeetingSchedule.js`の月→週マッピングで6月の最初の週を採る。
 * ⚠️6月は週23〜26（`jraMeetingSchedule.js`参照）。
 */
export const TWO_YEAR_OLD_DEBUT_WEEK = 23;

/**
 * 条件戦の1着賞金（円）。⚠️**仮の値**（2026年の中央値を、日本ダービー1着の比で割った値。
 * `arch/race-program.md`§8）。収得賞金の順番付けにしか使わない——絶対額がずれても
 * 順番は変わらない。
 */
export const PROVISIONAL_FIRST_PRIZE_1974 = Object.freeze({
  shinba: 870_000,
  maiden: 770_000,
  win1: 1_090_000,
  win2: 2_110_000,
  win3: 2_490_000,
});

/** 日本ダービー1着賞金の比（他の年へ換算するときに使う。年ごとの実データが要る）。 */
export const DERBY_PURSE_1974 = 40_000_000;
export const DERBY_PURSE_2026 = 300_000_000;
export const PURSE_SCALE_1974 = DERBY_PURSE_1974 / DERBY_PURSE_2026; // ≒1/7.5

/**
 * その年の重賞の本数から、オープン特別の本数を仮で置く。
 * @param {number} gradedCount - その年に実在した重賞（平地・サラブレッドのみ）の本数
 * @returns {number}
 */
export function estimateOpenStakesCount(gradedCount) {
  return Math.round(gradedCount * OPEN_STAKES_TO_GRADED_RATIO);
}

/**
 * 1年ぶんの、クラスごとの一般競走（新馬〜3勝クラス）の本数を出す。
 * @param {number} year
 * @param {number} totalMeetingDays - その年の開催日数（`jraMeetingSchedule.js`から。仮288）
 * @param {number} gradedCount - その年の重賞の本数
 * @returns {{ counts: Record<string, number>, openStakesCount: number, totalRaces: number }}
 */
export function buildYearlyClassCounts(year, totalMeetingDays, gradedCount) {
  const totalRaces = totalMeetingDays * racesPerDay(year);
  const openStakesCount = estimateOpenStakesCount(gradedCount);
  const nonOpenTotal = Math.max(0, totalRaces - gradedCount - openStakesCount);
  const shareTotal = Object.values(NON_OPEN_CLASS_SHARE).reduce((a, b) => a + b, 0);
  const counts = {};
  let assigned = 0;
  const keys = Object.keys(NON_OPEN_CLASS_SHARE);
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      counts[key] = nonOpenTotal - assigned; // 端数は最後のクラス（3勝クラス）へ寄せる
      return;
    }
    const n = Math.round((nonOpenTotal * NON_OPEN_CLASS_SHARE[key]) / shareTotal);
    counts[key] = n;
    assigned += n;
  });
  return { counts, openStakesCount, totalRaces };
}

/** 一般競走1本ぶんの、クラス以外の中身（馬場・距離・牝馬限定か）を乱数で決める。 */
export function drawGeneralRaceShape(rand01) {
  const surface = weightedPick(rand01, SURFACE_SHARE);
  const distanceShare = surface === "turf" ? DISTANCE_SHARE_TURF : DISTANCE_SHARE_DIRT;
  const distance = Number(weightedPick(rand01, distanceShare));
  const fillyOnly = rand01() < FILLIES_ONLY_SHARE;
  return { surface, distance, fillyOnly };
}

/** 出走頭数を実測の分布から引く。 */
export function drawFieldSize(rand01) {
  const total = FIELD_SIZE_BUCKETS.reduce((sum, [, , p]) => sum + p, 0);
  let x = rand01() * total;
  for (const [lo, hi, p] of FIELD_SIZE_BUCKETS) {
    x -= p;
    if (x <= 0) return lo + Math.floor(rand01() * (hi - lo + 1));
  }
  const [lo, hi] = FIELD_SIZE_BUCKETS[FIELD_SIZE_BUCKETS.length - 1];
  return lo + Math.floor(rand01() * (hi - lo + 1));
}

/** 一般競走のクラスを重みどおりに1つ引く。 */
export function drawGeneralRaceClass(rand01) {
  return weightedPick(rand01, NON_OPEN_CLASS_SHARE);
}
