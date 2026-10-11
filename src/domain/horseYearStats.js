// 馬の「今年の成績」（番付の材料・`arch/banzuke.md`）。
// 純ロジック（JSX無し・他のファイルに依存しない）。`domain/horse.js`の`appendRaceResultWithEarnings`が
// レースを1つ積むたびにこれを呼び、`record.yearStats`を更新する。
//
// ⚠️**レースの年が変わったら0から数え直す**（`year`が違えば前の年の欄を捨てる）。
// 古いセーブ（`yearStats`を持たない馬）はここで初めて作られる。年が分からないレース
// （呼び出し側が`year`を渡さなかった場合）は、今ある欄の年のまま積む。

/**
 * @typedef {{ year: number|null, earnings: number, starts: number, wins: number,
 *   turf: number, dirt: number, distanceSum: number, lastBigWinName: string|null }} YearStats
 */

/** 0戦の欄。 */
export function emptyYearStats(year = null) {
  return { year, earnings: 0, starts: 0, wins: 0, turf: 0, dirt: 0, distanceSum: 0, lastBigWinName: null };
}

/**
 * レース1つぶんを今年の成績へ積む。純関数——引数を書き換えず新しい欄を返す。
 * @param {YearStats|undefined} prev - `record.yearStats`（古いセーブでは無い）
 * @param {{ position: number, year?: number, surface?: string|null, distance?: number|null }} entry
 * @param {number} earningsGain - このレースの賞金（円）
 * @param {string|null} bigRaceName - 重賞なら、そのレース名（それ以外はnull）。⚠️「重賞かどうか」は
 *   `grade`ではなくレース名の有無で決める（1983年以前は`grade`が全部null・`devlog/wave12.md`§10）
 */
export function bumpYearStats(prev, entry, earningsGain, bigRaceName) {
  const year = entry.year ?? prev?.year ?? null;
  const base = prev && prev.year === year ? prev : emptyYearStats(year);
  const won = entry.position === 1;
  const isDirt = entry.surface === "dirt";
  return {
    year,
    earnings: base.earnings + earningsGain,
    starts: base.starts + 1,
    wins: base.wins + (won ? 1 : 0),
    turf: base.turf + (isDirt ? 0 : 1),
    dirt: base.dirt + (isDirt ? 1 : 0),
    distanceSum: base.distanceSum + (entry.distance ?? 0),
    lastBigWinName: won && bigRaceName ? bigRaceName : base.lastBigWinName,
  };
}
