// 出馬表（案E・`design/mocks/entry-list-v2.html`）の表示データを組む純関数。
// DOM無し・JSX無し（Node単体で検証できる）。`domain/`はimportしない——
// 出走枠を決める仕事（`domain/entryListPreview.js`）と、決まった枠を表示用に整形する
// 仕事（このファイル）を分ける（CLAUDE.md §5「data→core/sim→domain/state/view→…」）。

import { classDisplayName } from "../data/classes.js";
import { findCourse } from "../data/courses.js";
import { SURFACE_LABELS, DISTANCE_BAND_LABELS } from "../data/aptitudeLabels.js";
import { TRACK_CONDITION_LABEL } from "../data/trackConditions.js";
import { approximateDate } from "../data/jraMeetingSchedule.js";
import { weekOfYear } from "../data/calendar.js";

function twoDigits(n) {
  return String(n).padStart(2, "0");
}

/** 直近戦績1件を馬柱の1レースぶんに整形する。 */
function formatHistoryRow(entry) {
  // ⚠️`entry.week`は折り返さない絶対週（`domain/weekLoop.js`の数え方）。`approximateDate`は
  // 1〜52の暦週を受け取るため、必ず`weekOfYear`で変換してから渡す（2026-09-15・人間の
  // 目視確認で「同じ日付が違うレースに複数付く」バグとして発見・修正）。
  const { year, month, day } = approximateDate(entry.year, weekOfYear(entry.week));
  const dateLabel = `${twoDigits(year % 100)}.${twoDigits(month)}.${twoDigits(day)}`;
  const courseName = entry.courseId ? findCourse(entry.courseId)?.name ?? entry.courseId : "—";
  const surfaceLabel = entry.surface ? SURFACE_LABELS[entry.surface] ?? entry.surface : "";
  const distanceLabel = entry.distance != null ? `${entry.distance}m` : DISTANCE_BAND_LABELS[entry.distanceBand] ?? "";
  const conditionLabel = entry.condition ? TRACK_CONDITION_LABEL[entry.condition] ?? entry.condition : "";
  const won = entry.position === 1;
  return {
    raceName: entry.raceName ?? "—",
    dateLabel,
    courseName,
    trackLabel: `${surfaceLabel}${distanceLabel} ${conditionLabel}`.trim(),
    finishLabel: `${entry.position}着`,
    fieldSize: entry.fieldSize ?? null,
    popularity: entry.popularity ?? null,
    won,
  };
}

/**
 * 1頭ぶんの馬柱データを組む。
 * @param {object} entry - `domain/entryListPreview.js`の出走馬（馬番・枠番つき）
 * @param {{ isSelf: boolean, jockeyName: string }} riderInfo
 * @param {string} genderLabel - 牡／牝／セン
 * @param {number} age - 馬齢
 * @param {number} weight - 斤量（負担重量）
 * @returns {object}
 */
export function buildEntryColumn(entry, riderInfo, genderLabel, age, weight) {
  return {
    horseId: entry.id,
    waku: entry.waku,
    postNumber: entry.postNumber,
    isSelf: riderInfo.isSelf,
    name: entry.name,
    popularity: entry.popularity ?? null,
    riderLine: `${genderLabel}${age} ${weight.toFixed(1)} ${riderInfo.jockeyName}`,
    history: (entry.record?.recentFinishes ?? []).slice(0, 5).map(formatHistoryRow),
  };
}

/**
 * レース見出しを組む。
 * @param {{ raceName: string, grade?: string|null, courseId?: string|null, surface: string,
 *           distance?: number|null, distanceBand?: string|null, condition?: string|null,
 *           fieldSize: number, classId?: string, prize1?: number|null }} race
 */
export function buildEntryListHeader(race) {
  const courseName = race.courseId ? findCourse(race.courseId)?.name ?? race.courseId : "";
  const surfaceLabel = SURFACE_LABELS[race.surface] ?? race.surface;
  const distanceLabel =
    race.distance != null ? `${race.distance}m` : DISTANCE_BAND_LABELS[race.distanceBand] ?? "";
  return {
    name: race.raceName ?? (race.classId ? classDisplayName(race.classId) : "レース"),
    gradeLabel: race.grade ? race.grade.toUpperCase() : null,
    whereLine: `${courseName} ${surfaceLabel}${distanceLabel}　${race.fieldSize}頭`.trim(),
    conditionLabel: race.condition ? TRACK_CONDITION_LABEL[race.condition] ?? race.condition : null,
  };
}
