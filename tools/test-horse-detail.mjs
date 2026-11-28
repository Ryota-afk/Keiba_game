// 馬の詳しい画面のデータ・開示プール・「自分」の印のテスト（`devlog/wave13b.md`§33）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateHorse, GENDER_LABEL, weeksSinceLastRace } from "../src/domain/horse.js";
import { RACE_POOL, TRAINING_POOL } from "../src/data/disclosurePools.js";
import { attemptReveal, revealedCount, isPoolFullyRevealed } from "../src/domain/disclosure.js";
import { buildHorseDetail } from "../src/view/horseDetailView.js";
import { trainingWeightFor } from "../src/domain/horseForm.js";
import { horseAge } from "../src/domain/retirement.js";
import { isMainMount } from "../src/domain/mainMount.js";
import { deriveFavoredStrategy } from "../src/domain/strategy.js";

const SEED = 99;
const horse0 = () => ({ ...generateHorse(SEED, "hd"), bornYear: 1991, stableId: "s1" });
const deps = { trainingWeightFor, weeksSinceLastRace, horseAge, isMainMount, deriveFavoredStrategy, genderLabel: GENDER_LABEL };
const player = { currentYear: 1995, currentWeek: 200, mainMounts: {} };
const race = { courseId: "hanshin", raceNumber: 9, surface: "turf", distance: 2000, classId: "win3" };

test("プールの大きさ", () => {
  assert.equal(RACE_POOL.length, 6);
  assert.equal(TRAINING_POOL.length, 3);
  assert.ok(!RACE_POOL.includes("reserve") && !TRAINING_POOL.includes("strategy"));
});

test("古いセーブのreserve・strategyは数えず、二重に開けない", () => {
  const h = horse0();
  const old = { ...h, disclosure: { ...h.disclosure, raceRevealed: ["reserve", "speed"], trainingRevealed: ["strategy"] } };
  assert.equal(revealedCount(old, "race"), 1);
  assert.equal(revealedCount(old, "training"), 0);
  let cur = old;
  for (let w = 0; w < 200; w++) cur = attemptReveal(SEED, w, cur, "race");
  assert.ok(isPoolFullyRevealed(cur, "race"));
  assert.equal(cur.disclosure.raceRevealed.filter((k) => k === "speed").length, 1);
});

test("騎手がプレイヤーの鞍の記録にだけbyPlayerが付く（走らせる仕組みは世界の同じもの）", () => {
  for (const file of ["npcWeeklyRace.js", "npcGradedRace.js"]) {
    const src = readFileSync(new URL(`../src/domain/${file}`, import.meta.url), "utf8");
    assert.match(src, /riders\.has\(h\.id\) \? \{ byPlayer: true \} : \{\}/);
  }
  const results = readFileSync(new URL("../src/domain/weekResults.js", import.meta.url), "utf8");
  assert.doesNotMatch(results, /byPlayer/);
});

test("初出走の馬：全部「？」", () => {
  const h = horse0();
  const d = buildHorseDetail({ horse: h, race, player, saveSeed: SEED, stable: { trainerName: "塚本遼" }, deps });
  assert.equal(d.raceKnown, 0);
  assert.equal(d.raceTotal, 6);
  assert.equal(d.trainingTotal, 3);
  assert.ok(d.raceItems.every((i) => !i.known && i.value === null));
  assert.equal(d.weight.intervalText, "初出走");
  assert.deepEqual(d.runs, []);
  assert.equal(d.recordText, "0戦0勝");
  assert.equal(d.strategy.known, true);
  assert.equal(d.context.raceLabel, "阪神 9R");
  assert.equal(d.identity.trainer, "塚本遼");
});

test("開いた項目がある馬", () => {
  const h = horse0();
  const run = { position: 1, fieldSize: 16, popularity: 3, week: 190, year: 1995, courseId: "hanshin", surface: "turf", distance: 2000, condition: "good", raceName: "3勝クラス", bodyKg: 440, bodyKgDiff: -2, byPlayer: true };
  const hh = { ...h, disclosure: { ...h.disclosure, raceRevealed: ["idealDistance", "speed"] },
    record: { ...h.record, starts: 1, wins: 1, recentFinishes: [run] } };
  const d = buildHorseDetail({ horse: hh, race, player, saveSeed: SEED, deps });
  assert.equal(d.raceKnown, 2);
  const ideal = d.raceItems.find((i) => i.key === "idealDistance");
  assert.match(ideal.value, /^\d+〜\d+m$/);
  assert.equal(ideal.raceDistance, 2000);
  assert.equal(d.raceItems.find((i) => i.key === "speed").value, h.abilities.speed);
  assert.equal(d.runs[0].byPlayer, true);
  assert.equal(d.runs[0].bodyKgDiffText, "−2");
  assert.equal(d.recordText, "1戦1勝");
});
