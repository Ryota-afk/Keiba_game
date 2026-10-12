// 馬名の重複回避に使う「使用済みの名前」の集合（`arch/horse.md`「馬の名前」）。
// 純ロジック（JSX無し。`data/`だけに依存）。
//
// ⭐使用済み＝①現役の名簿にいる馬の名前 ②史実馬の名前。②があるので、架空馬が史実の名馬と
// 同じ名前になることは無い（「史実の名馬は実名、ゲーム内で生まれた馬は架空」）。
// ⚠️②は今のところ日本ダービー優勝馬（`DERBY_WINNERS`）と能力表（`DERBY_HORSE_ABILITIES`）の
// 名前。史実馬を名簿に入れる仕組みができたら、その馬は①に入るので追加の作業は要らない。

import { DERBY_WINNERS } from "../data/derbyWinners.js";
import { DERBY_HORSE_ABILITIES } from "../data/derbyHorseAbilities.js";

/** 史実馬の名前（読み取り専用。毎回の複製を避けるためモジュールで1回だけ作る）。 */
const HISTORICAL_HORSE_NAMES = Object.freeze([
  ...new Set([...DERBY_WINNERS.map((r) => r.horse), ...Object.keys(DERBY_HORSE_ABILITIES)]),
]);

/**
 * 新しい馬の名前を引くときに避ける名前の集合を作る。`generateHorse`の`opts.usedNames`に渡す
 * （`generateHorse`が引いた名前をこの集合へ追加するので、同じ集合を使い回せば、
 * 同じ回で生成する馬どうしの重複も避けられる）。
 * @param {Iterable<{ name: string }>} [horses] - 現役の馬（`roster.horses`）
 * @returns {Set<string>}
 */
export function createUsedHorseNames(horses = []) {
  const used = new Set(HISTORICAL_HORSE_NAMES);
  for (const horse of horses) used.add(horse.name);
  return used;
}
