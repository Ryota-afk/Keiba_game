// 週の番組表（`arch/race-program.md`§10・通しプレイ①の指摘「レースのクラス分けと実際の
// レースが結びついていない」の解消）。
// ⭐**週のレースはここが1回だけ組む。** 依頼（`weeklyRequests.js`）・NPCのレース
// （`npcWeeklyRace.js`／`npcGradedRace.js`）・出馬表（`entryListPreview.js`）は、
// すべてこの一覧の中の1レース（`raceId`）を指す。同じ`(saveSeed, week)`からは必ず
// 同じ一覧が返る（`core/rng.js`の`RNG_STREAMS.CARD`）ので、月曜の依頼一覧と週末に
// 実際に行われるレースは食い違わない。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";
import { weekOfYear, WEEKS_PER_YEAR } from "../data/calendar.js";
import { DAY, weekdayOfDateString } from "../data/weekDays.js";
import { coursesOpenInWeek } from "../data/jraMeetingSchedule.js";
import { drawShapeAtCourse } from "../data/courses.js";
import { gradedRacesForYear, hasGradedRaceData } from "../data/gradedRacesByYear.js";
import {
  racesPerDay,
  estimateOpenStakesCount,
  drawGeneralRaceShape,
  SURFACE_SHARE,
  DISTANCE_SHARE_TURF,
  DISTANCE_SHARE_DIRT,
  drawGeneralRaceClass,
} from "../data/raceProgram.js";

// 重賞データが無い年の仮の重賞本数（`domain/npcWeeklyRace.js`と同じ、1974〜1987年の
// 実測本数84〜100の中央値）。年ごとの実データが揃ったら`gradedRacesForYear`に置き換わる。
export const FALLBACK_GRADED_COUNT = 90;

export const RACE_SOURCE = Object.freeze({
  GRADED: "graded", // 重賞（実データ）
  OPEN_STAKES: "openStakes", // オープン特別（推定本数を52週へ確率配分）
  GENERAL: "general", // 一般競走（新馬〜3勝クラス）
});

function gradedCountForYear(year) {
  return hasGradedRaceData(year) ? gradedRacesForYear(year).length : FALLBACK_GRADED_COUNT;
}

/** 週あたりの目標本数を確率的に丸める（例：0.4本／週なら40%の週だけ1本組む）。 */
function stochasticRound(value, rand01) {
  const floor = Math.floor(value);
  const frac = value - floor;
  return rand01() < frac ? floor + 1 : floor;
}


// ⭐その競馬場で実際に行われる馬場×距離から引く（`data/courses.js`の`drawShapeAtCourse`）。
// ⚠️**これが無いと、競馬場と距離を別々に抽選するので札幌で芝3600mのレースが組まれる**
// （実際には行われない距離。`devlog/wave08.md`§9）。
// ⚠️`profile`を持たない競馬場（今は地方・海外だけ）は、従来どおり全国の割合から引く。
const SHARES = {
  surfaceShare: SURFACE_SHARE,
  distanceShare: { turf: DISTANCE_SHARE_TURF, dirt: DISTANCE_SHARE_DIRT },
};
function drawShapeFor(rand01, courseId) {
  const shape = drawShapeAtCourse(rand01, courseId, SHARES);
  const fallback = drawGeneralRaceShape(rand01);
  return shape ? { ...shape, fillyOnly: fallback.fillyOnly } : fallback;
}

/**
 * ⭐その重賞が土曜・日曜どちらだったかを、史実の日付から決める（2026-09-17。`TODO.md` #86）。
 * `data/gradedRacesByYear.js`の各レースは`historicalDate`（例："1976-09-12"）を持つ
 * ——推測ではなく実データから曜日が計算できる。
 *
 * 実測（1972〜1989年の重賞1,400本・日付の欠けは0本。`devlog/wave09.md`§9）：
 * 日曜92.4%・土曜3.9%・平日（月〜金）合計3.7%。
 * ⚠️**平日3.7%の置き場所だけは実データが無い決定**——本作は土曜・日曜しか持たないため、
 * 多数派（日曜）へ寄せる。
 */
function dayOfGradedRace(historicalDate) {
  if (!historicalDate) return DAY.SUN; // 保険（実測では0件だが、欠けていた場合の既定値）
  const weekday = weekdayOfDateString(historicalDate);
  return weekday === DAY.SAT ? DAY.SAT : DAY.SUN;
}

/**
 * その週1週間ぶんの番組表を組む。自己完結の純関数——同じ引数なら常に同じ一覧を返す。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週（`player.currentWeek`と同じ数え方）
 * @param {number} year - 番組表の実測値・実データを引くための暦年（`player.currentYear`）
 * @returns {{ raceId: string, classId: string, courseId: string, surface: string,
 *   distance: number, fillyOnly: boolean, source: string, day: string, name?: string,
 *   grade?: string|null, prize1?: number|null }[]}
 */
export function buildWeeklyCard(saveSeed, week, year) {
  const thisWeek = weekOfYear(week);
  const openCourses = coursesOpenInWeek(thisWeek);
  if (openCourses.length === 0) return []; // 開催が無い週（原則無いはずだが念のため）

  const rand01 = streamRandom(saveSeed, RNG_STREAMS.CARD, week);
  const races = [];

  // ①重賞（実データ）：そのままカードへ。グレード表記の無い年（〜1983年）は
  // オープン以上の一括扱い（`classId: "open"`）にする——グレードそのものが
  // 1984年より前は史実にも付いていない（`tools/build-graded-races.mjs`）。
  const gradedToday = hasGradedRaceData(year) ? gradedRacesForYear(year).filter((r) => r.week === thisWeek) : [];
  for (const r of gradedToday) {
    races.push({
      raceId: r.id,
      classId: r.grade ?? "open",
      courseId: r.courseId,
      surface: r.surface,
      distance: r.distance,
      fillyOnly: r.fillyOnly,
      source: RACE_SOURCE.GRADED,
      day: dayOfGradedRace(r.historicalDate),
      name: r.name,
      grade: r.grade,
      prize1: r.prize1,
    });
  }

  // ②オープン特別：年の推定本数（`estimateOpenStakesCount`）を52週へ確率配分する。
  // ⚠️実データが無い推定値（`arch/race-program.md`§3）——`classId`は`open`。
  const openStakesCountThisYear = estimateOpenStakesCount(gradedCountForYear(year));
  const openStakesToday = stochasticRound(openStakesCountThisYear / WEEKS_PER_YEAR, rand01);
  for (let i = 0; i < openStakesToday; i += 1) {
    const courseId = pick(rand01, openCourses);
    const { surface, distance, fillyOnly } = drawShapeFor(rand01, courseId);
    races.push({
      raceId: `${year}-w${thisWeek}-open-${i}`,
      classId: "open",
      courseId,
      surface,
      distance,
      fillyOnly,
      source: RACE_SOURCE.OPEN_STAKES,
      day: pick(rand01, [DAY.SAT, DAY.SUN]),
    });
  }

  // ③一般競走（新馬〜3勝クラス）：その週に開いている競馬場×2日×1日のレース数から、
  // 重賞・オープン特別の本数を引いた残り（`arch/race-program.md`§10）。
  const totalSlotsThisWeek = openCourses.length * 2 * racesPerDay(year);
  const generalSlots = Math.max(0, totalSlotsThisWeek - gradedToday.length - openStakesToday);
  for (let i = 0; i < generalSlots; i += 1) {
    const classId = drawGeneralRaceClass(rand01);
    const courseId = pick(rand01, openCourses);
    const { surface, distance, fillyOnly } = drawShapeFor(rand01, courseId);
    races.push({
      raceId: `${year}-w${thisWeek}-gen-${i}`,
      classId,
      courseId,
      surface,
      distance,
      fillyOnly,
      source: RACE_SOURCE.GENERAL,
      day: pick(rand01, [DAY.SAT, DAY.SUN]),
    });
  }

  return races;
}
