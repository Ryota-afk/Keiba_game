// 重賞の「格」（g1／g2／g3）を年代をまたいで1つの言い方で引く（年末の賞・G1の一覧・引退した馬が使う。
// `devlog/wave13.md`§10）。純関数（JSX無し。`data/`の重賞データの形だけを知る）。
//
// ⭐1984年からは実データの`grade`（g1／g2／g3。格付け前の「重賞」だけの年は`null`＝g3扱い）。
// ⭐1983年までは格付けが無いので、`tools/build-graded-races.mjs`が「1984年にG1だった名前」に付けた
// `g1Like: true`をG1扱いにし、それ以外の重賞はすべてg3と同じ扱いにする（ユーザー決定Q2）。

/** 画面・記録で使う格。 */
export const GRADED_TIERS = Object.freeze(["g1", "g2", "g3"]);

/**
 * 重賞の格。
 * @param {{ grade?: string|null, g1Like?: boolean }|null|undefined} race - `gradedRacesForYear`の1件
 * @param {number} year - レースの暦年
 * @returns {"g1"|"g2"|"g3"}
 */
export function gradedTierOf(race, year) {
  if (year >= 1984) return race?.grade === "g1" || race?.grade === "g2" ? race.grade : "g3";
  return race?.g1Like ? "g1" : "g3";
}

/** 1983年までは「G1」ではなく「大レース」と呼ぶ（ユーザー決定Q2）。 */
export function g1LabelForYear(year) {
  return year >= 1984 ? "G1" : "大レース";
}
