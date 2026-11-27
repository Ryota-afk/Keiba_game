// レース番号の表示文字列（週の画面・結果画面・出馬表で同じ書き方を使う）。
// 第13弾§22。DOM無し・JSX無し（Node単体で検証できる）。`data/`だけに依存。

import { findCourse } from "../data/courses.js";

/**
 * 「3R」。番号が無い（古い記録など）ときは空文字。
 * @param {number|null|undefined} raceNumber
 */
export function raceNumberLabel(raceNumber) {
  return Number.isInteger(raceNumber) && raceNumber >= 1 ? `${raceNumber}R` : "";
}

/**
 * 「小倉 3R」。番号が無いときは競馬場名だけ。競馬場が分からなければ番号だけ。
 * @param {string|null|undefined} courseId
 * @param {number|null|undefined} raceNumber
 */
export function courseRaceLabel(courseId, raceNumber) {
  const course = courseId ? findCourse(courseId)?.name ?? courseId : "";
  return [course, raceNumberLabel(raceNumber)].filter(Boolean).join(" ");
}
