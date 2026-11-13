// 今週の騎乗依頼（月曜）の画面の表示データを組む純関数。
// 見本：`design/mocks/week-offers-v3.html`（案2・レースが主役・2026-09-17に合意）と
// `design/mocks/week-offers-v4.html`（案B・行を押すと「乗る」と「出馬表」が開く）。
// DOM無し・JSX無し（Node単体で検証できる）。`domain/`はimportしない
// （CLAUDE.md §5「data→core/sim→domain/state/view→…」）。

import { buildCalendarSkeleton, weekOfYear } from "../data/calendar.js";
import { findCourse } from "../data/courses.js";
import { classDisplayName } from "../data/classes.js";
import { SURFACE_LABELS } from "../data/aptitudeLabels.js";
import { SURFACE_APTITUDE_SCALE } from "../data/surfaceAptitude.js";
import { DAY } from "../data/weekDays.js";

const CALENDAR = buildCalendarSkeleton();

/** 「1976年 1月1週」の形。`absoluteWeek`は折り返さない絶対週（`player.currentWeek`）。 */
export function formatWeekLabel(year, absoluteWeek) {
  const entry = CALENDAR[weekOfYear(absoluteWeek) - 1];
  return `${year}年 ${entry.month}月${entry.weekOfMonth}週`;
}

/** 芝・ダートの相性（◎○△×）を、画面のSVG記号のidに対応させる。 */
export const SURFACE_MARK_ID = Object.freeze({
  "◎": "wk-m2",
  "○": "wk-m1",
  "△": "wk-m3",
  "×": "wk-mx",
});

/** その馬の、そのレースの面（芝／ダート）に対する相性の記号id。 */
export function surfaceMarkId(horse, surface) {
  const level = horse.surfaceAptitude?.[surface] ?? SURFACE_APTITUDE_SCALE[1];
  return SURFACE_MARK_ID[level] ?? SURFACE_MARK_ID["△"];
}

/** 「0戦0勝」の形。 */
export function recordLabel(horse) {
  return `${horse.record.starts}戦${horse.record.wins}勝`;
}

/**
 * レースの見出し。芝／ダートの字・距離・格（新馬〜GI）。重賞・オープン特別で名前が
 * あるレースは格の代わりに名前を出す（格は名前の後ろに小さく）。
 * @returns {{ surfaceLabel: string, distanceLabel: string, classLabel: string }}
 */
export function raceHeadline(race) {
  const classLabel = classDisplayName(race.classId);
  return {
    surfaceLabel: SURFACE_LABELS[race.surface] ?? race.surface,
    // 表の列見出し（幅32px）。「ダート」は3文字で2行に折れるので、競馬の新聞・出馬表で
    // 通っている1文字の「ダ」にする（「芝」はそのまま）。大見出しは`surfaceLabel`のまま。
    surfaceColumnLabel: race.surface === "dirt" ? "ダ" : SURFACE_LABELS[race.surface] ?? race.surface,
    distanceLabel: `${race.distance}m`,
    classLabel: race.raceName ? `${race.raceName} ${classLabel}` : classLabel,
  };
}

/**
 * 依頼一覧を「日 → 競馬場 → レース → 頼まれた馬」の入れ子に組む。
 * 並び順は依頼一覧そのものの順（質の高い順・`weeklyRequests.js`）を保つ：
 * 競馬場は最初に現れた順、レースも最初に現れた順、馬もその順。
 * @param {object[]} requests - `generateWeeklyRequests`の戻り値
 * @returns {{ sat: CourseGroup[], sun: CourseGroup[] }}
 *   CourseGroup = { courseId, courseName, count, races: RaceGroup[] }
 *   RaceGroup = { raceId, surface, distance, classId, raceName, grade, fillyOnly, requests: object[] }
 */
export function groupRequestsByDay(requests) {
  const result = { [DAY.SAT]: [], [DAY.SUN]: [] };
  for (const request of requests) {
    const day = request.day === DAY.SUN ? DAY.SUN : DAY.SAT;
    let course = result[day].find((c) => c.courseId === request.courseId);
    if (!course) {
      course = {
        courseId: request.courseId,
        courseName: findCourse(request.courseId)?.name ?? request.courseId,
        count: 0,
        races: [],
      };
      result[day].push(course);
    }
    course.count += 1;
    let race = course.races.find((r) => r.raceId === request.raceId);
    if (!race) {
      race = {
        raceId: request.raceId,
        surface: request.surface,
        distance: request.distance,
        classId: request.classId,
        raceName: request.raceName ?? null,
        grade: request.grade ?? null,
        fillyOnly: request.fillyOnly,
        requests: [],
      };
      course.races.push(race);
    }
    race.requests.push(request);
  }
  return result;
}

/**
 * 「行けない競馬場」の説明文。1日1場なので、その日に別の競馬場で乗る馬を決めたら、
 * この競馬場の依頼には乗れない（見本：「土曜は京都へ行きます。中山の依頼には乗れません。」）。
 */
export function lockedCourseMessage(day, goingCourseId, thisCourseId) {
  const dayLabel = day === DAY.SUN ? "日曜" : "土曜";
  const going = findCourse(goingCourseId)?.name ?? goingCourseId;
  const here = findCourse(thisCourseId)?.name ?? thisCourseId;
  return `${dayLabel}は${going}へ行きます。${here}の依頼には乗れません。`;
}

/** その日に依頼が無いときの文（見本：「日曜は依頼がありません。」）。 */
export function emptyDayMessage(day) {
  return day === DAY.SUN ? "日曜は依頼がありません。" : "土曜は依頼がありません。";
}

/** 週に依頼が1件も来なかったときの文（見本と同じ）。 */
export const EMPTY_WEEK_MESSAGE = "今週は依頼が来ませんでした。";
