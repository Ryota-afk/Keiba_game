// 脚質（ARCHITECTURE.md §3「脚質と適距離は導出値」・§5「金曜の作戦＝脚質の指定」）。
// 純ロジック（JSX無し。`data/`だけに依存）。

import { STRATEGIES } from "../data/aptitudeCategories.js";
import { gradeToNumber } from "../data/grades.js";

// ⭐脚質を決める点数の係数と境目（2026-09-08・`devlog/wave05.md`§56）。
// 実在のダービー馬51頭の`legStyle`と9軸の相関を測って形を決めた：
// **瞬発力 +0.625／勝負根性 −0.606**（後ろで走る度合いとの相関）が突出しており、
// スピード−スタミナは−0.223と従。よって主軸は「瞬発力 − 勝負根性」。
// ⚠️境目は**架空馬の内訳が実在51頭の割合に近づく**ように決めた（4000頭で
// 逃げ9.5/先行32.9/差し46.1/追込11.6%。実在51頭は9.8/33.3/45.1/11.8%）。
// ⚠️スピードとスタミナの生の値は集団ごとに散らばりが違う（実在馬はスピード65〜92・
// 架空馬は6〜72）ので、主軸には使わず0.1倍の傾きとしてだけ効かせる。
const LEG_SPEED_TILT = 10; // (スピード−スタミナ)÷100 に掛ける
const LEG_CUTS = Object.freeze([-5.5, 0, 7]); // 未満で 逃げ／先行／差し、以上で追込

/**
 * 馬の得意脚質を導く。⭐**架空馬のための式**——史実馬は`data/derbyHorseAbilities.js`の
 * `legStyle`（実際に使っていた脚質）を直接使う（`domain/dreamDerby.js`）。
 * ⚠️2026-09-08に書き直した。それ以前は「スピード≧スタミナなら前へ行く」＋
 * 「瞬発力＞勝負根性なら差し寄り」の2分岐で、⭐**夢のダービーの18頭が逃げ42.1%・
 * 先行2.1%・差し55.4%・追込0.4%に偏り、隊列が2つの塊にしかならなかった**
 * （`devlog/wave05.md`§54）。実在51頭への的中も56.9%（新式は64.7%）。
 * @param {object} horse - `domain/horse.js`の`generateHorse`が返す馬
 * @returns {"nige"|"senko"|"sashi"|"oikomi"}
 */
export function deriveFavoredStrategy(horse) {
  const a = horse.abilities;
  // 大きいほど後ろで走る
  const score =
    gradeToNumber(a.sharpness) - gradeToNumber(a.grit) - (LEG_SPEED_TILT * (a.speed - a.stamina)) / 100;
  if (score < LEG_CUTS[0]) return "nige";
  if (score < LEG_CUTS[1]) return "senko";
  if (score < LEG_CUTS[2]) return "sashi";
  return "oikomi";
}

/**
 * 鞍（確定した騎乗）に脚質を宣言する。馬の得意脚質から外してもよい（§5）。
 * 純関数——不正な脚質idを渡すとエラーではなく元のmountを返す。
 */
export function declareStrategy(mount, strategyId) {
  if (!STRATEGIES.includes(strategyId)) return mount;
  return { ...mount, declaredStrategy: strategyId };
}
