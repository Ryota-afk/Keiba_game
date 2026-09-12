// 騎手ランク（6段・ARCHITECTURE.md §8「騎手ランク（6段）と報酬」）。
// ⚠️枠・スキル枠・適性上限の具体値は暫定（ARCHITECTURE.md §15）。

export const RANK_LADDER = Object.freeze([
  "rookie", // 新人
  "young", // 若手
  "midCareer", // 中堅
  "veteran", // 実力派
  "elite", // 一流
  "top", // トップ
]);

/** ランクごとの仕様（昇格条件・平日の枠・スキル枠・適性の上限＝Sにできる数）。 */
export const RANK_SPECS = Object.freeze({
  rookie: { promotionRequirement: null, weekdaySlots: 1, skillSlots: 2, aptitudeSCap: 2 },
  young: { promotionRequirement: "firstWin", weekdaySlots: 1, skillSlots: 3, aptitudeSCap: 2 },
  midCareer: { promotionRequirement: "gradedWin", weekdaySlots: 2, skillSlots: 4, aptitudeSCap: 3 },
  veteran: { promotionRequirement: "g1Win", weekdaySlots: 2, skillSlots: 5, aptitudeSCap: 4 },
  elite: { promotionRequirement: "topWinner", weekdaySlots: 3, skillSlots: 6, aptitudeSCap: 4 },
  top: { promotionRequirement: "arcDeTriompheWin", weekdaySlots: 3, skillSlots: 8, aptitudeSCap: 5 },
});

export function rankIndex(rankId) {
  return RANK_LADDER.indexOf(rankId);
}

export function rankSpec(rankId) {
  return RANK_SPECS[rankId] ?? null;
}
