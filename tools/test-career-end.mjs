// キャリアの最終年・重賞の勝ち鞍の一覧・終わりの画面のデータ・開始年の判定のテスト（`devlog/wave13b.md`§35）。
// 使い方： node --test tools/test-career-end.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapRoster, assertStartYearData } from "../src/domain/bootstrap.js";
import { createPlayer } from "../src/domain/player.js";
import { advanceWeek } from "../src/domain/weekLoop.js";
import { isCareerOver, endCareer } from "../src/domain/careerEnd.js";
import { createEmptyPlayerRecord, applyRideToRecord } from "../src/domain/playerRecord.js";
import { buildCareerSummary } from "../src/view/careerSummaryView.js";
import { START_YEARS } from "../src/data/startYears.js";
import { CAREER_YEARS, lastCareerYear } from "../src/data/career.js";
import { MAIN_TIMELINE_START_WEEK } from "../src/data/calendar.js";
import { hasGradedRaceData } from "../src/data/gradedRacesByYear.js";

const SEED = 7;
const YEAR = 2023;
const FINAL_WEEK_2023 = MAIN_TIMELINE_START_WEEK + 51; // 2023年の最終週（絶対週）
const { roster } = bootstrapRoster(SEED, YEAR);
const playerAt = (startYear, extra = {}) => ({
  ...createPlayer(SEED, { startYear: YEAR }),
  startYear,
  currentYear: YEAR,
  currentWeek: FINAL_WEEK_2023,
  ...extra,
});

test("開始年の3本はすべて判定を通り、30年目も重賞データの範囲に収まる", () => {
  let last = 1972;
  while (hasGradedRaceData(last + 1)) last += 1;
  for (const y of START_YEARS) {
    assert.ok(assertStartYearData(y), `${y}`);
    assert.ok(lastCareerYear(y) <= last, `${y}+${CAREER_YEARS - 1}=${lastCareerYear(y)} <= ${last}`);
  }
});

test("最後の年の最終週だけ yearEnd.careerEnd が真（その前の年・手前の週では偽）", () => {
  const atEnd = advanceWeek(SEED, roster, playerAt(1994)); // 1994+29=2023
  assert.equal(atEnd.yearEnd.year, 2023);
  assert.equal(atEnd.yearEnd.careerEnd, true);
  assert.equal(isCareerOver(atEnd.player), true, "最後の年を過ぎた年に居る＝終わり扱い（つづきからの保険）");
  const notYet = advanceWeek(SEED, roster, playerAt(1995)); // 最後は2024年
  assert.equal(notYet.yearEnd.careerEnd, false);
  assert.equal(isCareerOver(notYet.player), false);
  const midYear = advanceWeek(SEED, roster, playerAt(1994, { currentWeek: FINAL_WEEK_2023 - 1 }));
  assert.equal(midYear.yearEnd, null);
});

test("advanceWeekは終わったキャリアを進めない", () => {
  const afterEnd = advanceWeek(SEED, roster, playerAt(1994)).player;
  assert.throws(() => advanceWeek(SEED, roster, afterEnd), /キャリアは終わって/);
  assert.throws(() => advanceWeek(SEED, roster, endCareer(playerAt(1995))), /キャリアは終わって/);
});

test("重賞を勝つと gradedWinList に積まれる（負け・一般競走は積まない・古い記録は空扱い）", () => {
  const base = { aptitudeKeys: [], year: 1990, horseId: "h1" };
  const detail = { week: 20, horseName: "テスト", courseId: "tokyo", distance: 2400, surface: "turf" };
  let r = createEmptyPlayerRecord();
  r = applyRideToRecord(r, { ...base, won: true, grade: "g1", raceName: "日本ダービー", tier: "g1", detail });
  r = applyRideToRecord(r, { ...base, won: false, grade: "g1", raceName: "天皇賞", tier: "g1", detail });
  r = applyRideToRecord(r, { ...base, won: true, grade: null, raceName: null, detail });
  assert.equal(r.gradedWinList.length, 1);
  assert.deepEqual(r.gradedWinList[0], {
    year: 1990, week: 20, raceName: "日本ダービー", tier: "g1", horseId: "h1",
    horseName: "テスト", courseId: "tokyo", distance: 2400, surface: "turf",
  });
  const { gradedWinList, ...old } = createEmptyPlayerRecord();
  const r2 = applyRideToRecord(old, { ...base, won: true, grade: "g3", raceName: "X賞", tier: "g3" });
  assert.equal(r2.gradedWinList.length, 1);
});

test("buildCareerSummary：空の騎手でも落ちず、勝ち鞍のある騎手は並びと合計が合う", () => {
  const empty = buildCareerSummary({ player: createPlayer(SEED, { startYear: 1994 }), roster });
  assert.equal(empty.totals.starts, 0);
  assert.equal(empty.totals.winRate, 0);
  assert.equal(empty.bestYear, null);
  assert.equal(empty.byYear.length, CAREER_YEARS);
  assert.equal(empty.byYear[0].age, 18);
  assert.equal(empty.byYear[CAREER_YEARS - 1].age, 47);
  assert.deepEqual(empty.gradedWinList, []);

  let player = createPlayer(SEED, { startYear: 1994 });
  let rec = player.record;
  const mk = (year, tier, raceName, won = true) =>
    (rec = applyRideToRecord(rec, {
      won, grade: tier, raceName, tier, year, horseId: "hA", income: 100, prize: 1000, aptitudeKeys: [],
      detail: { week: 10, horseName: "アルファ" },
    }));
  mk(1996, "g3", "A賞");
  mk(1996, "g1", "B記念");
  mk(1999, "g2", "C杯");
  mk(1999, "g1", "D賞", false);
  player = { ...player, record: rec, mainMounts: { hA: { rides: 7, hasWon: true, isMain: true, horseName: "アルファ" } } };
  const s = buildCareerSummary({ player, roster });
  assert.deepEqual(s.gradedWinList.map((w) => w.raceName), ["B記念", "C杯", "A賞"]);
  assert.equal(s.totals.starts, 4);
  assert.equal(s.totals.wins, 3);
  assert.equal(s.totals.gradedWins, 3);
  assert.equal(s.totals.g1Wins, 1);
  assert.equal(s.totals.income, 400);
  assert.equal(s.bestYear.year, 1996);
  assert.equal(s.mainMounts[0].name, "アルファ");
  assert.equal(s.mainMounts[0].gradedWins, 3);
});
