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
import { careerEndView } from "../src/view/careerEndView.js";
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
  assert.equal(empty.identity.lastAge, 47, "見出しの歳は最後の年の行と同じ");
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

test("よく乗った馬は重賞の勝ち数→乗った回数の順で上位5頭", () => {
  let player = createPlayer(SEED, { startYear: 1994 });
  let rec = player.record;
  const win = (horseId) =>
    (rec = applyRideToRecord(rec, {
      won: true, grade: "g3", raceName: "A賞", tier: "g3", year: 1995, horseId, aptitudeKeys: [],
      detail: { week: 10, horseName: horseId },
    }));
  win("h2");
  win("h2");
  win("h5");
  const mainMounts = {
    h1: { rides: 60, horseName: "h1" },
    h2: { rides: 5, horseName: "h2" },
    h3: { rides: 50, horseName: "h3" },
    h4: { rides: 40, horseName: "h4" },
    h5: { rides: 3, horseName: "h5" },
    h6: { rides: 30, horseName: "h6" },
    h7: { rides: 20, horseName: "h7" },
  };
  const s = buildCareerSummary({ player: { ...player, record: rec, mainMounts }, roster });
  assert.deepEqual(s.mainMounts.map((m) => m.horseId), ["h2", "h5", "h1", "h3", "h4"]);
});

test("careerEndView：グラフ・最初に選ぶ年・G1の呼び方・レース名・空のとき", () => {
  const empty = careerEndView(buildCareerSummary({ player: createPlayer(SEED, { startYear: 1994 }), roster }));
  assert.equal(empty.span, "1994年〜2023年　18歳〜47歳");
  assert.equal(empty.chart.max, 10);
  assert.deepEqual(empty.chart.ticks, [10]);
  assert.equal(empty.chart.bars.length, CAREER_YEARS);
  assert.deepEqual(empty.chart.axis.map((a) => a.year), [1994, 2004, 2014, 2023]);
  assert.deepEqual(empty.chart.legend, []);
  assert.equal(empty.initialIndex, 0);
  assert.equal(empty.years[0].off, true);
  assert.deepEqual(empty.tiers, []);
  assert.deepEqual(empty.mounts, []);
  assert.deepEqual(empty.totals.map((t) => t.value), ["0戦 0勝", "0.0%", "0勝", "0万円"]);

  const build = (startYear, wins) => {
    let player = createPlayer(SEED, { startYear });
    let rec = player.record;
    for (const [year, tier, raceName] of wins)
      rec = applyRideToRecord(rec, {
        won: true, grade: tier, raceName, tier, year, horseId: "hA", income: 5000000, aptitudeKeys: [],
        detail: { week: 10, horseName: "アルファ" },
      });
    rec = applyRideToRecord(rec, { won: false, grade: null, raceName: null, year: startYear, horseId: "hA", aptitudeKeys: [] });
    return careerEndView(buildCareerSummary({ player: { ...player, record: rec }, roster }));
  };
  const modern = build(1994, [
    [1996, "g2", "フジテレビ賞 スプリングステークス （皐月賞トライアル）"],
    [1996, "g1", "農林水産省賞典 安田記念"],
    [1999, "g3", "CBC賞"],
  ]);
  assert.equal(modern.g1Label, "G1");
  assert.equal(modern.initialIndex, 2, "最も勝った年（1996年）");
  assert.equal(modern.years[2].head, "1996年・20歳");
  assert.equal(modern.years[2].isBest, true);
  assert.equal(modern.years[2].graded, "重賞2勝（G1 1勝）");
  assert.equal(modern.years[5].graded, "重賞1勝");
  assert.equal(modern.years[0].off, false);
  assert.equal(modern.years[0].graded, null);
  assert.deepEqual(modern.chart.bars.slice(0, 6).map((b) => b.tone), ["plain", "plain", "g1", "plain", "plain", "graded"]);
  assert.deepEqual(modern.chart.legend.map((l) => l.label), ["G1を勝った年", "重賞を勝った年"]);
  assert.deepEqual(modern.tiers.map((g) => g.heading), ["G1　1勝", "G2　1勝", "G3　1勝"]);
  assert.deepEqual(modern.tiers.map((g) => g.rows[0].race), ["安田記念", "スプリングステークス", "CBC賞"]);
  assert.equal(modern.totals[2].sub, "G1 1勝");
  assert.equal(modern.totals[3].value, "1,500万円");

  const old = build(1974, [[1983, "g1", "皐月賞"]]);
  assert.equal(old.g1Label, "大レース・G1");
  assert.equal(old.tiers[0].heading, "大レース・G1　1勝");
  assert.equal(build(1974, [[1984, "g1", "皐月賞"]]).g1Label, "G1");
});
