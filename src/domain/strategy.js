// 脚質（ARCHITECTURE.md §3「脚質と適距離は導出値」・§5「金曜の作戦＝脚質の指定」）。
// 純ロジック（JSX無し。`data/`だけに依存）。

import { STRATEGIES } from "../data/aptitudeCategories.js";
import { gradeToNumber } from "../data/grades.js";

/**
 * 馬の得意脚質を導く。⚠️暫定のヒューリスティック（ARCHITECTURE.md §3は
 * 「瞬発力と勝負根性の大小が脚質を決める」とだけ述べ、4区分への具体的な変換式は
 * 書いていない）。瞬発力(sharpness)と勝負根性(grit)の差で「差し寄り／追込寄り」を、
 * スピード(speed)とスタミナ(stamina)の差で「逃げ寄り／先行寄り」を決める簡易版。
 * 実装が進んだら計測（Q11：9軸それぞれが着順を何着ぶん動かしたか）で見直す。
 * @param {object} horse - `domain/horse.js`の`generateHorse`が返す馬
 * @returns {"nige"|"senko"|"sashi"|"oikomi"}
 */
export function deriveFavoredStrategy(horse) {
  const sharpness = gradeToNumber(horse.abilities.sharpness);
  const grit = gradeToNumber(horse.abilities.grit);
  const frontRunning = horse.abilities.speed >= horse.abilities.stamina; // 前に行きたいか
  const closingType = sharpness > grit; // 瞬発力が勝つなら差し・追込寄り

  if (!closingType) return frontRunning ? "nige" : "senko";
  return frontRunning ? "sashi" : "oikomi";
}

/**
 * 鞍（確定した騎乗）に脚質を宣言する。馬の得意脚質から外してもよい（§5）。
 * 純関数——不正な脚質idを渡すとエラーではなく元のmountを返す。
 */
export function declareStrategy(mount, strategyId) {
  if (!STRATEGIES.includes(strategyId)) return mount;
  return { ...mount, declaredStrategy: strategyId };
}
