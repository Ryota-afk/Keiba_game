// 騎手ランクの昇格判定（ARCHITECTURE.md §8「騎手ランク」・`devlog/wave12.md`§9決定）。
// 純ロジック（JSX無し。`data/`だけに依存）。

import { RANK_LADDER, rankIndex, rankSpec } from "../data/ranks.js";

/**
 * @param {string|null|undefined} requirement - `data/ranks.js`の`promotionRequirement`
 * @param {object} record - `domain/playerRecord.js`の`player.record`
 * @param {boolean} isTopWinnerThisYear - その年の最多勝利騎手か（年末にだけ意味を持つ）
 */
function meetsPromotionRequirement(requirement, record, isTopWinnerThisYear) {
  switch (requirement) {
    case "firstWin":
      return record.wins >= 1;
    case "gradedWin":
      return record.gradedWins >= 1;
    case "g1Win":
      // ⚠️1984年より前は`grade`制度そのものが無いため、`record.bigRaceWins`
      // （G1または八大競走の勝ち・`domain/playerRecord.js`）で代用する（ARCHITECTURE.md §8）。
      return record.bigRaceWins >= 1;
    case "topWinner":
      return isTopWinnerThisYear === true;
    case "arcDeTriompheWin":
      return false; // 凱旋門賞（まだゲームに無いので常に不成立。ARCHITECTURE.md §8）
    default:
      return false;
  }
}

/**
 * ランクの梯子を今のランクから1段ずつ確認し、満たしている限り上げ続ける。純関数。
 * 1回の呼び出しで複数段上がることもある（例：G1勝利と最多勝利騎手が同じ週に重なった場合）。
 * 実績は取り消されない——満たした条件は`record`側に積まれたまま減らないため、この関数自体は
 * 後退しない。
 * @param {string} rank - 今のランク
 * @param {object} record - `domain/playerRecord.js`の`player.record`
 * @param {boolean} [isTopWinnerThisYear] - ⚠️年末（週の折返し）にだけ意味を持つ値。それ以外の
 *   週は`false`を渡すこと（「一流」の1つ下（実力派）に留まっている限り評価されないので実害は無い）。
 * @returns {{ rank: string, changes: {from:string, to:string}[] }} `changes`は上がった順の一覧
 *   （0件なら昇格なし）
 */
export function checkRankPromotions(rank, record, isTopWinnerThisYear = false) {
  let current = rank;
  const changes = [];
  for (;;) {
    const nextRank = RANK_LADDER[rankIndex(current) + 1];
    if (!nextRank) break; // すでにトップ
    const requirement = rankSpec(nextRank)?.promotionRequirement;
    if (!meetsPromotionRequirement(requirement, record, isTopWinnerThisYear)) break;
    changes.push({ from: current, to: nextRank });
    current = nextRank;
  }
  return { rank: current, changes };
}
