// 馬の「今年の成績」（番付の材料・`arch/banzuke.md`）。
// 純ロジック（JSX無し・他のファイルに依存しない）。`domain/horse.js`の`appendRaceResultWithEarnings`が
// レースを1つ積むたびにこれを呼び、`record.yearStats`を更新する。
//
// ⚠️**レースの年が変わったら0から数え直す**（`year`が違えば前の年の欄を捨てる）。
// 古いセーブ（`yearStats`を持たない馬）はここで初めて作られる。年が分からないレース
// （呼び出し側が`year`を渡さなかった場合）は、今ある欄の年のまま積む。

/**
 * @typedef {{ raceName: string, tier: "g1"|"g2"|"g3", position: number, surface: string|null,
 *   distance: number|null }} GradedEntry
 * @typedef {{ year: number|null, earnings: number, starts: number, wins: number,
 *   turf: number, dirt: number, distanceSum: number, lastBigWinName: string|null,
 *   graded: GradedEntry[] }} YearStats
 * ⭐`graded`＝今年走った重賞の記録（年末の賞の材料・`devlog/wave13.md`§10）。重賞に出るたびに1件
 * （1頭年数件）。`tier`は1983年までは「1984年にG1だった名前」だけg1・他はg3（`data/gradedTier.js`）。
 * 古いセーブ（欄が無い馬）は`?? []`で補って読むこと。
 */

/** 0戦の欄。 */
export function emptyYearStats(year = null) {
  return { year, earnings: 0, starts: 0, wins: 0, turf: 0, dirt: 0, distanceSum: 0, lastBigWinName: null };
}

function gradedEntry(entry, tier) {
  return {
    raceName: entry.raceName,
    tier,
    position: entry.position,
    surface: entry.surface ?? null,
    distance: entry.distance ?? null,
  };
}

/**
 * レース1つぶんを今年の成績へ積む。純関数——引数を書き換えず新しい欄を返す。
 * @param {YearStats|undefined} prev - `record.yearStats`（古いセーブでは無い）
 * @param {{ position: number, year?: number, surface?: string|null, distance?: number|null }} entry
 * @param {number} earningsGain - このレースの賞金（円）
 * @param {string|null} bigRaceName - 重賞なら、そのレース名（それ以外はnull）。⚠️「重賞かどうか」は
 *   `grade`ではなくレース名の有無で決める（1983年以前は`grade`が全部null・`devlog/wave12.md`§10）
 * @param {"g1"|"g2"|"g3"|null} [gradedTier] - 重賞なら、その格（`graded`へ1件積む）。一般競走はnull
 */
export function bumpYearStats(prev, entry, earningsGain, bigRaceName, gradedTier = null) {
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
    // 重賞に出ていない馬には欄を作らない（セーブの大きさのため。読む側は`?? []`で補う）
    ...(gradedTier && entry.raceName
      ? { graded: [...(base.graded ?? []), gradedEntry(entry, gradedTier)] }
      : base.graded?.length
        ? { graded: base.graded }
        : {}),
  };
}
