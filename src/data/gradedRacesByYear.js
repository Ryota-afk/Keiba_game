// `tools/build-graded-races.mjs`が作る。手で書き足さない。
// 年ごとの重賞データを、素のstatic import（Node単体でもVite単体でも読める形）で束ねる。

import gradedRaces1974 from "./generated/gradedRaces.1974.json" with { type: "json" };
import gradedRaces1975 from "./generated/gradedRaces.1975.json" with { type: "json" };
import gradedRaces1976 from "./generated/gradedRaces.1976.json" with { type: "json" };
import gradedRaces1977 from "./generated/gradedRaces.1977.json" with { type: "json" };
import gradedRaces1978 from "./generated/gradedRaces.1978.json" with { type: "json" };
import gradedRaces1979 from "./generated/gradedRaces.1979.json" with { type: "json" };
import gradedRaces1980 from "./generated/gradedRaces.1980.json" with { type: "json" };
import gradedRaces1981 from "./generated/gradedRaces.1981.json" with { type: "json" };
import gradedRaces1982 from "./generated/gradedRaces.1982.json" with { type: "json" };
import gradedRaces1983 from "./generated/gradedRaces.1983.json" with { type: "json" };
import gradedRaces1984 from "./generated/gradedRaces.1984.json" with { type: "json" };
import gradedRaces1985 from "./generated/gradedRaces.1985.json" with { type: "json" };
import gradedRaces1986 from "./generated/gradedRaces.1986.json" with { type: "json" };
import gradedRaces1987 from "./generated/gradedRaces.1987.json" with { type: "json" };

export const GRADED_RACES_BY_YEAR = Object.freeze({
  1974: gradedRaces1974,
  1975: gradedRaces1975,
  1976: gradedRaces1976,
  1977: gradedRaces1977,
  1978: gradedRaces1978,
  1979: gradedRaces1979,
  1980: gradedRaces1980,
  1981: gradedRaces1981,
  1982: gradedRaces1982,
  1983: gradedRaces1983,
  1984: gradedRaces1984,
  1985: gradedRaces1985,
  1986: gradedRaces1986,
  1987: gradedRaces1987,
});

/** その年の重賞データ。無ければ空配列。 */
export function gradedRacesForYear(year) {
  return GRADED_RACES_BY_YEAR[year] ?? [];
}

/** その年のデータを取得済みかどうか。 */
export function hasGradedRaceData(year) {
  return GRADED_RACES_BY_YEAR[year] != null;
}
