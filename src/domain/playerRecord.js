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
    // year -> { starts, wins, horseIds, gradedWins, g1Wins, income, prize }（horseIds＝その年に乗った馬のid・重複なし。
    // 番付の「自分が乗った馬」。⭐gradedWins＝重賞の勝ち数・g1Wins＝G1〈1983年までは1984年にG1だったレース〉の勝ち数・
    // income＝騎乗手当＋進上金・prize＝乗った馬が稼いだ獲得賞金。年末のまとめが使う。古いセーブは`?? 0`で読む）
    byYear: {},
    // 重賞を勝った鞍の通算の一覧（勝った順）。{ year, week(暦の週1〜52), raceName, tier(g1|g2|g3), horseId, horseName,
    // courseId, distance, surface }。古いセーブは欄が無い→`?? []`で読む。キャリア終わりの画面が使う
    gradedWinList: [],
    byAptitude: {}, // 適性キー（strategy:.../distance:.../surface:...） -> { starts, wins }
  };
}

function bumpBucket(bucket, won) {
  const current = bucket ?? { starts: 0, wins: 0 };
  return { starts: current.starts + 1, wins: current.wins + (won ? 1 : 0) };
}

// 年ごとの欄。`horseIds`は古いセーブ（欄が無い年）でも落ちないよう`?? []`で補う。
function bumpYearBucket(bucket, won, horseId, extra) {
  const current = bucket ?? { starts: 0, wins: 0 };
  const horseIds = current.horseIds ?? [];
  return {
    starts: current.starts + 1,
    wins: current.wins + (won ? 1 : 0),
    horseIds: horseId == null || horseIds.includes(horseId) ? horseIds : [...horseIds, horseId],
    gradedWins: (current.gradedWins ?? 0) + (extra.gradedWin ? 1 : 0),
    g1Wins: (current.g1Wins ?? 0) + (extra.g1Win ? 1 : 0),
    income: (current.income ?? 0) + (extra.income ?? 0),
    prize: (current.prize ?? 0) + (extra.prize ?? 0),
  };
}

/**
 * 1鞍ぶんの結果を通算成績へ積む。純関数——引数の`record`を書き換えず新しいオブジェクトを返す。
 * ⚠️**落馬した鞍も1戦に数える（勝ちではない）**——`domain/weekLoop.js`は落馬した鞍でも
 * この関数を呼ぶこと（経験（`domain/aptitudeGrowth.js`）とは扱いが違う点に注意）。
 * @param {object} record - `createEmptyPlayerRecord`の形
 * @param {{ won: boolean, grade: string|null|undefined, raceName: string|null|undefined,
 *   year: number, aptitudeKeys: string[], horseId?: string, tier?: string|null, income?: number,
 *   prize?: number, detail?: { week: number, horseName?: string, courseId?: string|null, distance?: number|null,
 *   surface?: string|null }|null }} ride - `aptitudeKeys`はその鞍で宣言した3つ
 *   （`strategy:...`・`distance:...`・`surface:...`）。`horseId`はその年に乗った馬の一覧
 *   （`byYear[year].horseIds`）に積む。⭐`tier`＝重賞の格（`data/gradedTier.js`。1983年までの「G1扱い」を含む。
 *   年ごとの`g1Wins`に使う。⚠️`bigRaceWins`〈昇格の条件〉は従来どおり八大競走で数える）。`income`＝その鞍の収入、
 *   `prize`＝その馬がその鞍で稼いだ獲得賞金（年ごとの欄へ）。
 *   ⭐`detail`＝重賞を勝ったとき`gradedWinList`へ積む材料（週は暦の週1〜52）
 */
export function applyRideToRecord(record, { won, grade, raceName, year, aptitudeKeys, horseId, tier = null, income = 0, prize = 0, detail = null }) {
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

  const byYear = {
    ...record.byYear,
    [year]: bumpYearBucket(record.byYear[year], won, horseId, {
      gradedWin: isGradedWin,
      g1Win: isGradedWin && tier === "g1",
      income,
      prize,
    }),
  };
  let byAptitude = record.byAptitude;
  for (const key of aptitudeKeys) {
    byAptitude = { ...byAptitude, [key]: bumpBucket(byAptitude[key], won) };
  }

  return {
    starts: record.starts + 1,
    wins: record.wins + (won ? 1 : 0),
    gradedWins: record.gradedWins + (isGradedWin ? 1 : 0),
    gradedWinList: isGradedWin
      ? [
          ...(record.gradedWinList ?? []),
          {
            year,
            week: detail?.week ?? null,
            raceName,
            tier: tier ?? "g3",
            horseId: horseId ?? null,
            horseName: detail?.horseName ?? null,
            courseId: detail?.courseId ?? null,
            distance: detail?.distance ?? null,
            surface: detail?.surface ?? null,
          },
        ]
      : record.gradedWinList ?? [],
    bigRaceWins: record.bigRaceWins + (isBigRaceWin ? 1 : 0),
    byYear,
    byAptitude,
  };
}
