// 馬の詳しい画面（案A 能力表・`design/mocks/horse-detail-v1-spec.md`・`devlog/wave13b.md`§33）の表示データを組む純関数。
// DOM無し・JSX無し。`domain/`はimportしない——domainの関数（体重・間隔・馬齢・主戦・脚質）は`deps`で画面から渡す。

import { classDisplayName } from "../data/classes.js";
import { findCourse } from "../data/courses.js";
import { COAT_LABEL } from "../data/coat.js";
import { SURFACE_LABELS, STRATEGY_LABELS } from "../data/aptitudeLabels.js";
import { TRACK_CONDITION_LABEL } from "../data/trackConditions.js";
import { approximateDate } from "../data/jraMeetingSchedule.js";
import { weekOfYear } from "../data/calendar.js";
import { gradeToNumber } from "../data/grades.js";
import { RACE_POOL, TRAINING_POOL } from "../data/disclosurePools.js";
import { aptitudeBand, APT_MIN_DISTANCE, APT_MAX_DISTANCE } from "../sim/stamina.js";
import { courseRaceLabel } from "./raceNumberView.js";
import { formatWeekLabel, raceHeadline, recordLabel, surfaceMarkId } from "./weekOffersView.js";
import { sexAgeLabel, bodyWeightText, kgDiffText, intervalLabel, isDebut, trainingWeightView } from "./horseRowView.js";

const RACE_LABELS = Object.freeze({
  idealDistance: "適距離",
  speed: "スピード",
  sharpness: "瞬発力",
  grit: "勝負根性",
  flexibility: "柔軟性",
  power: "パワー",
});
const TRAINING_LABELS = Object.freeze({ wisdom: "賢さ", health: "健康", mentalStrength: "精神力" });

const two = (n) => String(n).padStart(2, "0");

function runView(e) {
  const { year, month, day } = approximateDate(e.year, weekOfYear(e.week));
  const course = e.courseId ? findCourse(e.courseId)?.name ?? e.courseId : null;
  const kg = Number.isFinite(e.bodyKg) ? e.bodyKg : null;
  return {
    dateLabel: `${two(year % 100)}.${two(month)}.${two(day)}`,
    courseName: course,
    surface: e.surface ?? null,
    surfaceLabel: e.surface ? SURFACE_LABELS[e.surface] ?? e.surface : "",
    distance: e.distance ?? null,
    goingLabel: e.condition ? TRACK_CONDITION_LABEL[e.condition] ?? e.condition : "",
    raceName: e.raceName ?? "—",
    position: e.position,
    won: e.position === 1,
    fieldSize: e.fieldSize ?? null,
    popularity: e.popularity ?? null,
    bodyKg: kg,
    bodyKgDiff: Number.isFinite(e.bodyKgDiff) ? e.bodyKgDiff : null,
    bodyKgDiffText: Number.isFinite(e.bodyKgDiff) ? kgDiffText(e.bodyKgDiff) : "",
    bodyText: bodyWeightText(kg, e.bodyKgDiff, { unit: "kg" }),
    byPlayer: e.byPlayer === true,
  };
}

/**
 * @param {{ horse: object, request?: object|null, race?: object|null, player: { currentYear: number,
 *   currentWeek: number, mainMounts?: object }, saveSeed: number|string, stable?: { trainerName?: string }|null,
 *   deps: { trainingWeightFor: Function, weeksSinceLastRace: Function, horseAge: Function,
 *   isMainMount: Function, deriveFavoredStrategy: Function, genderLabel: Record<string,string> } }} args
 *   `race`は依頼のレース（`request`でもよい：courseId・raceNumber・surface・distance・classId・raceName）
 */
export function buildHorseDetail({ horse, request = null, race = null, player, saveSeed, stable = null, deps }) {
  const year = player.currentYear;
  const week = player.currentWeek;
  const r = race ?? request;
  const head = r ? raceHeadline(r) : null;
  const revealedRace = new Set(horse.disclosure?.raceRevealed ?? []);
  const revealedTraining = new Set(horse.disclosure?.trainingRevealed ?? []);
  const a = horse.abilities;

  const weight = trainingWeightView(deps.trainingWeightFor, horse, year, week, saveSeed);
  const since = deps.weeksSinceLastRace(horse, week);
  const debut = isDebut(since);

  const [bandLo, bandHi] = aptitudeBand(horse);
  const raceItems = RACE_POOL.map((key) => {
    const known = revealedRace.has(key);
    if (key === "idealDistance") {
      return {
        key, label: RACE_LABELS[key], known,
        value: known ? `${bandLo}〜${bandHi}m` : null,
        ratio: null,
        lo: known ? bandLo : null,
        hi: known ? bandHi : null,
        raceDistance: r?.distance ?? null,
        axisMin: APT_MIN_DISTANCE,
        axisMax: APT_MAX_DISTANCE,
      };
    }
    const raw = a[key];
    return {
      key, label: RACE_LABELS[key], known,
      value: known ? raw : null,
      ratio: known ? (key === "speed" ? raw / 100 : gradeToNumber(raw) / 15) : null,
    };
  });

  const trainingItems = TRAINING_POOL.map((key) => {
    const known = revealedTraining.has(key);
    return {
      key, label: TRAINING_LABELS[key], known,
      value: known ? a[key] : null,
      ratio: known ? gradeToNumber(a[key]) / 15 : null,
    };
  });

  const favored = deps.deriveFavoredStrategy(horse);
  const finishes = horse.record?.recentFinishes ?? [];

  return {
    context: {
      weekLabel: formatWeekLabel(year, week),
      raceLabel: r ? courseRaceLabel(r.courseId, r.raceNumber) : "",
      surface: r?.surface ?? null,
      surfaceLabel: head?.surfaceLabel ?? "",
      surfaceColumnLabel: head?.surfaceColumnLabel ?? "",
      distance: r?.distance ?? null,
      distanceLabel: head?.distanceLabel ?? "",
      classLabel: head?.classLabel ?? "",
    },
    identity: {
      name: horse.name,
      sexAge: sexAgeLabel(deps.genderLabel?.[horse.gender] ?? horse.gender, deps.horseAge(horse, year)),
      coatLabel: COAT_LABEL[horse.coat] ?? "",
      classLabel: classDisplayName(horse.classId),
      trainer: stable?.trainerName ?? "",
      isOwnStable: request?.isFromOwnStable === true,
      isMain: !!deps.isMainMount(player.mainMounts ?? {}, horse.id),
    },
    weight: {
      kg: weight?.kg ?? null,
      diff: weight?.diff ?? null,
      text: weight ? bodyWeightText(weight.kg, weight.diff, { unit: "kg" }) : "",
      intervalText: debut ? "初出走" : intervalLabel(since),
      isDebut: debut,
    },
    surfaceAptitude: {
      turf: surfaceMarkId(horse, "turf"),
      dirt: surfaceMarkId(horse, "dirt"),
    },
    raceItems,
    raceKnown: raceItems.filter((i) => i.known).length,
    raceTotal: RACE_POOL.length,
    trainingItems,
    trainingKnown: trainingItems.filter((i) => i.known).length,
    trainingTotal: TRAINING_POOL.length,
    strategy: { key: favored, label: STRATEGY_LABELS[favored] ?? favored, known: true },
    recordText: recordLabel(horse),
    runs: finishes.map(runView),
  };
}
