// `tools/build-graded-races.mjs`が作る。手で書き足さない。
// 年ごとの重賞データを、素のstatic import（Node単体でもVite単体でも読める形）で束ねる。

import gradedRaces1972 from "./generated/gradedRaces.1972.json" with { type: "json" };
import gradedRaces1973 from "./generated/gradedRaces.1973.json" with { type: "json" };
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
import gradedRaces1988 from "./generated/gradedRaces.1988.json" with { type: "json" };
import gradedRaces1989 from "./generated/gradedRaces.1989.json" with { type: "json" };
import gradedRaces1990 from "./generated/gradedRaces.1990.json" with { type: "json" };
import gradedRaces1991 from "./generated/gradedRaces.1991.json" with { type: "json" };
import gradedRaces1992 from "./generated/gradedRaces.1992.json" with { type: "json" };
import gradedRaces1993 from "./generated/gradedRaces.1993.json" with { type: "json" };
import gradedRaces1994 from "./generated/gradedRaces.1994.json" with { type: "json" };
import gradedRaces1995 from "./generated/gradedRaces.1995.json" with { type: "json" };
import gradedRaces1996 from "./generated/gradedRaces.1996.json" with { type: "json" };
import gradedRaces1997 from "./generated/gradedRaces.1997.json" with { type: "json" };
import gradedRaces1998 from "./generated/gradedRaces.1998.json" with { type: "json" };
import gradedRaces1999 from "./generated/gradedRaces.1999.json" with { type: "json" };
import gradedRaces2000 from "./generated/gradedRaces.2000.json" with { type: "json" };
import gradedRaces2001 from "./generated/gradedRaces.2001.json" with { type: "json" };
import gradedRaces2002 from "./generated/gradedRaces.2002.json" with { type: "json" };
import gradedRaces2003 from "./generated/gradedRaces.2003.json" with { type: "json" };
import gradedRaces2004 from "./generated/gradedRaces.2004.json" with { type: "json" };
import gradedRaces2005 from "./generated/gradedRaces.2005.json" with { type: "json" };
import gradedRaces2006 from "./generated/gradedRaces.2006.json" with { type: "json" };
import gradedRaces2007 from "./generated/gradedRaces.2007.json" with { type: "json" };
import gradedRaces2008 from "./generated/gradedRaces.2008.json" with { type: "json" };
import gradedRaces2009 from "./generated/gradedRaces.2009.json" with { type: "json" };
import gradedRaces2010 from "./generated/gradedRaces.2010.json" with { type: "json" };
import gradedRaces2011 from "./generated/gradedRaces.2011.json" with { type: "json" };
import gradedRaces2012 from "./generated/gradedRaces.2012.json" with { type: "json" };
import gradedRaces2013 from "./generated/gradedRaces.2013.json" with { type: "json" };
import gradedRaces2014 from "./generated/gradedRaces.2014.json" with { type: "json" };
import gradedRaces2015 from "./generated/gradedRaces.2015.json" with { type: "json" };
import gradedRaces2016 from "./generated/gradedRaces.2016.json" with { type: "json" };
import gradedRaces2017 from "./generated/gradedRaces.2017.json" with { type: "json" };
import gradedRaces2018 from "./generated/gradedRaces.2018.json" with { type: "json" };
import gradedRaces2019 from "./generated/gradedRaces.2019.json" with { type: "json" };
import gradedRaces2020 from "./generated/gradedRaces.2020.json" with { type: "json" };
import gradedRaces2021 from "./generated/gradedRaces.2021.json" with { type: "json" };
import gradedRaces2022 from "./generated/gradedRaces.2022.json" with { type: "json" };
import gradedRaces2023 from "./generated/gradedRaces.2023.json" with { type: "json" };
import gradedRaces2024 from "./generated/gradedRaces.2024.json" with { type: "json" };

export const GRADED_RACES_BY_YEAR = Object.freeze({
  1972: gradedRaces1972,
  1973: gradedRaces1973,
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
  1988: gradedRaces1988,
  1989: gradedRaces1989,
  1990: gradedRaces1990,
  1991: gradedRaces1991,
  1992: gradedRaces1992,
  1993: gradedRaces1993,
  1994: gradedRaces1994,
  1995: gradedRaces1995,
  1996: gradedRaces1996,
  1997: gradedRaces1997,
  1998: gradedRaces1998,
  1999: gradedRaces1999,
  2000: gradedRaces2000,
  2001: gradedRaces2001,
  2002: gradedRaces2002,
  2003: gradedRaces2003,
  2004: gradedRaces2004,
  2005: gradedRaces2005,
  2006: gradedRaces2006,
  2007: gradedRaces2007,
  2008: gradedRaces2008,
  2009: gradedRaces2009,
  2010: gradedRaces2010,
  2011: gradedRaces2011,
  2012: gradedRaces2012,
  2013: gradedRaces2013,
  2014: gradedRaces2014,
  2015: gradedRaces2015,
  2016: gradedRaces2016,
  2017: gradedRaces2017,
  2018: gradedRaces2018,
  2019: gradedRaces2019,
  2020: gradedRaces2020,
  2021: gradedRaces2021,
  2022: gradedRaces2022,
  2023: gradedRaces2023,
  2024: gradedRaces2024,
});

/** その年の重賞データ。無ければ空配列。 */
export function gradedRacesForYear(year) {
  return GRADED_RACES_BY_YEAR[year] ?? [];
}

/** その年のデータを取得済みかどうか。 */
export function hasGradedRaceData(year) {
  return GRADED_RACES_BY_YEAR[year] != null;
}
