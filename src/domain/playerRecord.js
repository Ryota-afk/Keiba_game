// プレイヤー騎手の通算成績（ARCHITECTURE.md §4「騎手」・`devlog/wave12.md`§9決定②）。
// 純ロジック（JSX無し。`data/`だけに依存）。ランク昇格の判定材料（`domain/jockeyRank.js`）と、
// いつか作る「自分の能力を見る画面」の両方がこれを読む。

import { EIGHT_GREAT_RACE_NAMES } from "../data/eightGreatRaces.js";

/** 初期状態の通算成績。自己完結の純関数。 */
export function createEmptyPlayerRecord() {
  return {
    starts: 0,
    wins: 0,
    gradedWins: 0, // 重賞（`grade`有り）を勝った数
    bigRaceWins: 0, // G1、または1984年より前は八大競走を勝った数
    byYear: {}, // year -> { starts, wins }
    byAptitude: {}, // 適性キー（strategy:.../distance:.../surface:...） -> { starts, wins }
  };
}

function bumpBucket(bucket, won) {
  const current = bucket ?? { starts: 0, wins: 0 };
  return { starts: current.starts + 1, wins: current.wins + (won ? 1 : 0) };
}

/**
 * 1鞍ぶんの結果を通算成績へ積む。純関数——引数の`record`を書き換えず新しいオブジェクトを返す。
 * ⚠️**落馬した鞍も1戦に数える（勝ちではない）**——`domain/weekLoop.js`は落馬した鞍でも
 * この関数を呼ぶこと（経験（`domain/aptitudeGrowth.js`）とは扱いが違う点に注意）。
 * @param {object} record - `createEmptyPlayerRecord`の形
 * @param {{ won: boolean, grade: string|null|undefined, raceName: string|null|undefined,
 *   year: number, aptitudeKeys: string[] }} ride - `aptitudeKeys`はその鞍で宣言した3つ
 *   （`strategy:...`・`distance:...`・`surface:...`）
 */
export function applyRideToRecord(record, { won, grade, raceName, year, aptitudeKeys }) {
  // ⚠️「重賞かどうか」は`grade`ではなく`raceName`の有無で判定する——`grade`（G1/G2/G3）は
  // 1984年より前は格付け制度そのものが無く全部nullだが、`raceName`は`weeklyCard.js`の
  // 重賞（`RACE_SOURCE.GRADED`）だけが持つ値で、年代を問わず「重賞」を指す
  // （`src/data/generated/gradedRaces.YYYY.json`そのものが1972年から重賞データである）。
  // `grade`のみで判定すると1984年より前の重賞勝ちが1件も数えられず、後述の`g1Win`条件を
  // 満たしても`gradedWin`（中堅への条件）が一度も満たせないまま行き止まりになってしまう。
  const isGradedWin = won && !!raceName;
  // G1、または1984年より前は八大競走の勝利を「大レース勝ち」に数える
  // （ARCHITECTURE.md §8・`data/eightGreatRaces.js`）。
  const isBigRaceWin = won && (grade === "g1" || (year < 1984 && EIGHT_GREAT_RACE_NAMES.has(raceName)));

  const byYear = { ...record.byYear, [year]: bumpBucket(record.byYear[year], won) };
  let byAptitude = record.byAptitude;
  for (const key of aptitudeKeys) {
    byAptitude = { ...byAptitude, [key]: bumpBucket(byAptitude[key], won) };
  }

  return {
    starts: record.starts + 1,
    wins: record.wins + (won ? 1 : 0),
    gradedWins: record.gradedWins + (isGradedWin ? 1 : 0),
    bigRaceWins: record.bigRaceWins + (isBigRaceWin ? 1 : 0),
    byYear,
    byAptitude,
  };
}
