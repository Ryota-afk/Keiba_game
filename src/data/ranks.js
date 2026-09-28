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

/** 画面表記。⚠️画面にランクidを出さない（2026-09-07・09-15の通しプレイで「rookie」が見えた。`TODO.md` #65）。 */
export const RANK_LABELS = Object.freeze({
  rookie: "新人",
  young: "若手",
  midCareer: "中堅",
  veteran: "実力派",
  elite: "一流",
  top: "トップ",
});

/**
 * ⚠️⚠️**重賞に乗れるかの判定にランクを使わないこと**（2026-09-16にユーザーが決定）。
 * ⭐**行き止まりになっていた**——中堅へ上がる条件が`gradedWin`（重賞を勝つ）なのに、
 * 判定表は「G3・G2に乗るには中堅が要る」としていた。重賞に乗れないと中堅になれない。
 * ⭐**解き方**：重賞に乗れるかは**その厩舎の調教師への信頼と、その馬の馬主への信頼**で決める
 * （ARCHITECTURE.md §6）。ランクは平日の枠・スキル枠・適性の上限だけを決める。
 * ⚠️実際の競馬でも、調教師と馬主が信用すれば若手に重賞の鞍が回る。
 */

/**
 * ランクごとの仕様（昇格条件・平日の枠・スキル枠・適性の上限＝Sにできる数・
 * 1レースあたりの依頼数の上限）。
 * ⚠️`maxRequestsPerRace`は2026-09-20にユーザーが決定（同じレースに依頼が集中しすぎる
 * 問題の対策・`src/domain/weeklyRequests.js`）。
 * ⚠️`aptitudeTotalCap`は2026-09-27にユーザーが決定（適性10個の段の合計の上限。
 * `devlog/wave12.md`§9・§10・`domain/aptitudeGrowth.js`）。固定値ではなくランクで広がる
 * （キャリアの終わりまで伸び続けるようにするため）。⭐最初の45〜115を、伸びる速さの較正後に
 * 50〜125へ広げた（45〜115のままだと若手が2年目の途中で頭打ちになった・実測）。
 */
export const RANK_SPECS = Object.freeze({
  rookie: { promotionRequirement: null, weekdaySlots: 1, skillSlots: 2, aptitudeSCap: 2, maxRequestsPerRace: 3, aptitudeTotalCap: 50 },
  young: { promotionRequirement: "firstWin", weekdaySlots: 1, skillSlots: 3, aptitudeSCap: 2, maxRequestsPerRace: 3, aptitudeTotalCap: 65 },
  midCareer: { promotionRequirement: "gradedWin", weekdaySlots: 2, skillSlots: 4, aptitudeSCap: 3, maxRequestsPerRace: 3, aptitudeTotalCap: 80 },
  veteran: { promotionRequirement: "g1Win", weekdaySlots: 2, skillSlots: 5, aptitudeSCap: 4, maxRequestsPerRace: 4, aptitudeTotalCap: 95 },
  elite: { promotionRequirement: "topWinner", weekdaySlots: 3, skillSlots: 6, aptitudeSCap: 4, maxRequestsPerRace: 4, aptitudeTotalCap: 110 },
  top: { promotionRequirement: "arcDeTriompheWin", weekdaySlots: 3, skillSlots: 8, aptitudeSCap: 5, maxRequestsPerRace: 5, aptitudeTotalCap: 125 },
});

export function rankIndex(rankId) {
  return RANK_LADDER.indexOf(rankId);
}

export function rankSpec(rankId) {
  return RANK_SPECS[rankId] ?? null;
}
