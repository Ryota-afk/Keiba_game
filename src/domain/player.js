// プレイヤー騎手の状態（ARCHITECTURE.md §6「信頼」・§8「騎手ランク」）。
// 純ロジック（JSX無し。`data/`・`domain/jockey.js`だけに依存）。
// ⚠️セーブ形式そのもの（localStorageへの読み書き）は`state/`が別途持つ。ここは
// 「プレイヤー状態とは何か」という形と、初期値を作る関数だけを持つ。

import { generateJockey } from "./jockey.js";
import { RANK_LADDER } from "../data/ranks.js";

// 初期所持金（暫定・ARCHITECTURE.md §15「暫定・未定の数値」）。
export const STARTING_MONEY = 100000;

/**
 * 新人騎手のプレイヤー状態を作る。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {{ stableId?: string|null, startYear?: number }} [opts]
 */
export function createPlayer(saveSeed, opts = {}) {
  const jockey = generateJockey(saveSeed, "player", {
    rank: RANK_LADDER[0],
    stableId: opts.stableId ?? null,
  });
  return {
    jockey,
    money: STARTING_MONEY,
    trainerTrust: {}, // stableId -> 信頼値（0始まり。関わったことのある相手だけ持つ）
    ownerTrust: {}, // ownerId -> 信頼値
    reputation: 0, // 評判（信頼の上位数件の平均。実装の弾で計算方法を確定）
    mainMounts: {}, // horseId -> { rides: number, hasWon: boolean }（主戦の座の進捗）
    currentWeek: 1,
    currentYear: opts.startYear ?? 1974,
  };
}

/** 信頼マップから特定の相手への信頼値を取り出す（関わったことが無ければ0）。 */
export function trustFor(trustMap, id) {
  return trustMap[id] ?? 0;
}

/** 信頼値を加算する。純関数——引数のtrustMapを書き換えず新しいオブジェクトを返す。 */
export function adjustTrust(trustMap, id, delta) {
  return { ...trustMap, [id]: trustFor(trustMap, id) + delta };
}
