// 馬名の重複回避に使う「使用済みの名前」の集合（`arch/horse.md`「馬の名前」）。
// 純ロジック（JSX無し。`data/`だけに依存）。
//
// ⭐使用済み＝①現役の名簿にいる馬の名前 ②史実馬の名前 ③実在の競走馬の名前。②③があるので、
// 架空馬が実在の馬と同じ名前になることは無い（「史実の名馬は実名、ゲーム内で生まれた馬は架空」）。
// ⚠️②は日本ダービー優勝馬（`DERBY_WINNERS`）と能力表（`DERBY_HORSE_ABILITIES`）の名前。
// 史実馬を名簿に入れる仕組みができたら、その馬は①に入るので追加の作業は要らない。
// ⚠️③は優駿達の蹄跡の重賞結果表に載る全馬名（`generated/realHorseNames.json`・
// `tools/build-real-horse-names.mjs`で作る）＋確認済みの実在馬（`BLOCKED_HORSE_NAMES`）。

import { DERBY_WINNERS } from "../data/derbyWinners.js";
import { DERBY_HORSE_ABILITIES } from "../data/derbyHorseAbilities.js";
import { BLOCKED_HORSE_NAMES } from "../data/blockedHorseNames.js";
import REAL_HORSE_NAMES from "../data/generated/realHorseNames.json" with { type: "json" };

/** 史実馬・実在馬の名前（読み取り専用。毎回の組み立てを避けるためモジュールで1回だけ作る）。 */
const REAL_AND_HISTORICAL_NAMES = Object.freeze([
  ...new Set([
    ...DERBY_WINNERS.map((r) => r.horse),
    ...Object.keys(DERBY_HORSE_ABILITIES),
    ...REAL_HORSE_NAMES,
    ...BLOCKED_HORSE_NAMES,
  ]),
]);

/**
 * 新しい馬の名前を引くときに避ける名前の集合を作る。`generateHorse`の`opts.usedNames`に渡す
 * （`generateHorse`が引いた名前をこの集合へ追加するので、同じ集合を使い回せば、
 * 同じ回で生成する馬どうしの重複も避けられる）。
 * @param {Iterable<{ name: string }>} [horses] - 現役の馬（`roster.horses`）
 * @returns {Set<string>}
 */
export function createUsedHorseNames(horses = []) {
  const used = new Set(REAL_AND_HISTORICAL_NAMES);
  for (const horse of horses) used.add(horse.name);
  return used;
}
