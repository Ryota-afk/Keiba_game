// 馬場・距離ごとの基準タイム（史実の重賞1,121本の勝ちタイムの中央値・1972〜1987年）。
// 測り方と再実行は`tools/measure-par-times.mjs`。
//
// ⚠️**何のために要るか**：`src/sim/raceSim.js`のゴールタイム正規化は2400m前提
// （141.5〜147.5秒）で固定されており、1200mでも3200mでも勝ちタイムが141.5〜147.5秒に
// 丸められていた（2026-09-16・実測で発見。1200mが141.5秒＝実際の約2倍）。
// 正規化の窓をこの表で距離に比例させる。
// ⚠️2400m（芝）の比を1.00にしてあるので、**夢のダービーの時間は1ミリ秒も変わらない**。
//
// 純データ＋純関数のみ（JSX無し）。

/** 芝の基準タイム（秒）。キーは距離(m)。コメントは実データの本数。 */
export const PAR_SECONDS_TURF = Object.freeze({
  1200: 70.8, // 61本
  1400: 83.7, // 47本
  1600: 95.9, // 184本
  1800: 109.9, // 189本
  2000: 122.3, // 317本
  2200: 134.6, // 34本
  2400: 148.9, // 122本
  2500: 155.6, // 45本
  3000: 188.8, // 26本
  3200: 202.6, // 40本
  3600: 232.3, // 12本
});

/**
 * ダートの速さが芝の何倍か。⚠️**本数が少ない**——同じ距離で比べられたのは1200m
 * （ダート15本・芝61本＝0.970）と2000m（ダート15本・芝317本＝0.985）の2点だけで、
 * その平均。1970〜80年代の重賞はほぼ芝だったため、これ以上は今の出典から取れない。
 * ⚠️距離ごとの違い（ダートは短距離ほど芝との差が大きい）は、この1つの比では表せていない。
 */
export const DIRT_SPEED_RATIO = 0.978;

/** 正規化の基準にする距離・馬場（ここを1.00として他の距離を比で決める）。 */
export const REFERENCE_DISTANCE = 2400;
export const REFERENCE_SURFACE = "turf";

const TURF_DISTANCES = Object.keys(PAR_SECONDS_TURF)
  .map(Number)
  .sort((a, b) => a - b);

/** 芝の、その距離での速さ(m/s)。表の外は両端の傾きで延長する。 */
function turfSpeedAt(distance) {
  const speedOf = (d) => d / PAR_SECONDS_TURF[d];
  const first = TURF_DISTANCES[0];
  const last = TURF_DISTANCES[TURF_DISTANCES.length - 1];

  if (distance <= first) {
    // 表の下（1200m未満）は、1200mと1400mの傾きで延長する。⚠️実データの外側。
    const slope = (speedOf(TURF_DISTANCES[1]) - speedOf(first)) / (TURF_DISTANCES[1] - first);
    return speedOf(first) + slope * (distance - first);
  }
  if (distance >= last) return speedOf(last); // 表の上（3600m超）は頭打ちにする

  for (let i = 0; i < TURF_DISTANCES.length - 1; i += 1) {
    const lo = TURF_DISTANCES[i];
    const hi = TURF_DISTANCES[i + 1];
    if (distance >= lo && distance <= hi) {
      const t = (distance - lo) / (hi - lo);
      return speedOf(lo) + t * (speedOf(hi) - speedOf(lo));
    }
  }
  return speedOf(last);
}

/**
 * その馬場・距離の基準タイム（秒）。
 * @param {string} surface - "turf" | "dirt"
 * @param {number} distance - m
 * @returns {number} 秒
 */
export function parSecondsFor(surface, distance) {
  const speed = turfSpeedAt(distance) * (surface === "dirt" ? DIRT_SPEED_RATIO : 1);
  return distance / speed;
}

/**
 * 2400m（芝）を1.00としたときの、その馬場・距離の基準タイムの比。
 * `sim/raceSim.js`がゴールタイム正規化の窓に掛ける。
 */
export function parRatioFor(surface, distance) {
  return parSecondsFor(surface, distance) / parSecondsFor(REFERENCE_SURFACE, REFERENCE_DISTANCE);
}
