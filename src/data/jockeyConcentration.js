// NPC騎手への騎乗の集まり方（αの表）。純データ＋純関数のみ（JSX無し）。
// `domain/jockeyBooking.js`が、騎手を選ぶ重み exp(α × 腕) のαをここから引く。
//
// ⭐αが大きいほど腕の良い騎手に騎乗が集まり、最多勝が大きくなる（0なら腕を見ずに散る）。
// 実際の最多勝利騎手は年によって変わる（1970〜1990年で63〜138勝。Wikipedia「リーディングジョッキー」の表・
// `devlog/wave12.md`§15）ので、年ごとにαを置く。
// ⭐2026-10-11に較正（`devlog/wave12.md`§17）：1974年・世界3通り（g-a・g-b・g-c）でαを変えたときの
// NPC騎手の最多勝（3通りの平均）を測り、その年の実際の最多勝に合うαを折れ線で逆引きした。
// 測った対応：α2→54勝／3→68／4→84／6→91／8→105／12→115／16→118。
// ⚠️**最多勝はα=12（約115勝）で頭打ち**（16でも118勝で、勝ちが1つもない騎手が23〜30人に増える）。
// 実際の最多勝が115勝を超える年（1977・78・85〜90年）はα=12に止めた＝その年は実際より少なく出る。

/** 年 -> α（コメントはその年の実際の最多勝）。 */
export const JOCKEY_CONCENTRATION_ALPHA_BY_YEAR = Object.freeze({
  1970: 4.6, // 86勝
  1971: 6.1, // 92
  1972: 8.0, // 105
  1973: 3.8, // 80
  1974: 5.1, // 88
  1975: 4.6, // 86
  1976: 8.4, // 106
  1977: 12, // 126（届かない）
  1978: 12, // 131（届かない）
  1979: 2.6, // 63
  1980: 3.3, // 72
  1981: 6.6, // 95
  1982: 7.9, // 104
  1983: 7.9, // 104
  1984: 7.3, // 100
  1985: 12, // 118（届かない）
  1986: 12, // 117（届かない）
  1987: 12, // 138（届かない）
  1988: 12, // 132（届かない）
  1989: 12, // 133（届かない）
  1990: 12, // 116（届かない）
});

/** 表より前の年に使う値（表の最初の年1970年と同じ）。 */
export const DEFAULT_JOCKEY_CONCENTRATION_ALPHA = 4.6;

/**
 * その年のα。表にある最後の年より後の年は、表の最後の年の値を使う
 * （1991年以降の実際の最多勝はまだ調べていない）。
 * @param {number} year
 * @returns {number}
 */
export function concentrationAlphaForYear(year) {
  const years = Object.keys(JOCKEY_CONCENTRATION_ALPHA_BY_YEAR).map(Number).sort((a, b) => a - b);
  if (years.length === 0) return DEFAULT_JOCKEY_CONCENTRATION_ALPHA;
  const direct = JOCKEY_CONCENTRATION_ALPHA_BY_YEAR[year];
  if (direct != null) return direct;
  if (year > years[years.length - 1]) return JOCKEY_CONCENTRATION_ALPHA_BY_YEAR[years[years.length - 1]];
  return DEFAULT_JOCKEY_CONCENTRATION_ALPHA;
}
