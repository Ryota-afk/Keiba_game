// 騎手の「腕」（その鞍・その馬への向き）と、騎手を選ぶときの重み。純ロジック（JSX無し）。
// `domain/jockeyBooking.js`（日ごとの騎乗の割り当て）と`domain/jockeyAssignment.js`
// （オープン以上の馬の主戦）が共有する——2つのファイルが互いをimportしないよう、
// 共通部分だけをここに置く（依存は下向き一方通行・CLAUDE.md §5）。

import { APTITUDE_KEYS, distanceBandOf } from "../data/aptitudeCategories.js";
import { GRADE_SCALE, gradeToNumber } from "../data/grades.js";

// 等級の数値（0=G〜15=S+）を0〜1へ直す分母。
const MAX_GRADE_NUMBER = GRADE_SCALE.length - 1;

// 所属厩舎の騎手・その馬の主戦なら、選ばれる重みを何倍にするか。
// ⚠️仮の値で根拠は無い（`devlog/wave12.md`§15のユーザー決定「βは仮に3」）。
export const STABLE_JOCKEY_WEIGHT_MULTIPLIER = 3;

/**
 * その鞍に対する騎手の腕（0〜1）。鞍の距離帯と馬場の適性（`gradeToNumber`／15）の平均。
 * ⚠️戦法（逃げ・先行…）は含めない——乗る馬の脚質は割り当ての後に決まるため。
 * @param {{ aptitudes?: Record<string,string> }} jockey
 * @param {number} distance - メートル
 * @param {"turf"|"dirt"} surface
 * @returns {number}
 */
export function jockeyArmForMount(jockey, distance, surface) {
  const apt = jockey.aptitudes ?? {};
  const distanceGrade = gradeToNumber(apt[`distance:${distanceBandOf(distance)}`]);
  const surfaceGrade = gradeToNumber(apt[`surface:${surface}`]);
  return (distanceGrade + surfaceGrade) / 2 / MAX_GRADE_NUMBER;
}

/**
 * 騎手の総合の腕（0〜1）。適性10個（`APTITUDE_KEYS`）の平均。
 * 鞍が決まっていない場面（オープンに上がった馬に主戦を初めて付けるとき）に使う。
 */
export function jockeyOverallArm(jockey) {
  const apt = jockey.aptitudes ?? {};
  let sum = 0;
  for (const key of APTITUDE_KEYS) sum += gradeToNumber(apt[key]);
  return sum / APTITUDE_KEYS.length / MAX_GRADE_NUMBER;
}

/**
 * 選ばれる重み＝exp(α×腕)×（所属厩舎の騎手／その馬の主戦なら`STABLE_JOCKEY_WEIGHT_MULTIPLIER`、
 * そうでなければ1）。
 */
export function jockeyChoiceWeight(alpha, arm, isOwnJockey) {
  return Math.exp(alpha * arm) * (isOwnJockey ? STABLE_JOCKEY_WEIGHT_MULTIPLIER : 1);
}
