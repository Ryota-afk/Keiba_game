// キャリアの終わりの判定（ARCHITECTURE.md §1）。純ロジック（JSX無し）。
// ⭐`player.startYear`（新規キャリアで`createPlayer`が持つ）と`data/career.js`の`CAREER_YEARS`から、
// 最後のキャリア年＝`startYear + CAREER_YEARS − 1`を出す。最後の年の最終週（`week % 52 === 0`）を進めると
// `advanceWeek`の返す`yearEnd.careerEnd`が真になり、年末の画面を閉じたあと`endCareer`で`player.careerEnded`を立てる。

import { lastCareerYear } from "../data/career.js";

/** 最後のキャリア年。`startYear`が分からない古いセーブはnull（終わりの判定をしない）。 */
export function lastYearOf(player) {
  return player.startYear != null ? lastCareerYear(player.startYear) : null;
}

/** もうキャリアが終わっているか（フラグ済み、または最後の年を過ぎた年に居る）。 */
export function isCareerOver(player) {
  if (player.careerEnded) return true;
  const last = lastYearOf(player);
  return last != null && player.currentYear > last;
}

/** 年末の画面を閉じたあとに呼ぶ。純関数。 */
export function endCareer(player) {
  return { ...player, careerEnded: true };
}
