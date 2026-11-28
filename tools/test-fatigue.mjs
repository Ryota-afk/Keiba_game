// 疲労の式のテスト（`devlog/wave14.md`§6・§7）。
// 使い方： node --test tools/test-fatigue.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { perRideFatigue, fatigueAfterRides, applyWeeklyFatigue, fatiguePenaltyFactor, FATIGUE_RECOVERY_PER_WEEK } from "../src/domain/fatigue.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("1鞍の疲労：体力0で9.6・50で約8・99で6.4、体力が無ければ50とみなす", () => {
  near(perRideFatigue(0), 9.6);
  near(perRideFatigue(50), 8 * (1.2 - (0.4 * 50) / 99));
  assert.ok(Math.abs(perRideFatigue(50) - 7.9838) < 1e-3);
  near(perRideFatigue(99), 6.4);
  near(perRideFatigue(undefined), perRideFatigue(50));
});

test("週の回復は35", () => assert.equal(FATIGUE_RECOVERY_PER_WEEK, 35));

test("週6鞍（体力50）：少しずつたまり、約6週で70を超える", () => {
  let f = 0; const hist = [];
  for (let w = 0; w < 8; w++) { f = fatigueAfterRides(f, 6, 50); hist.push(f); }
  assert.ok(hist[4] < 70 && hist[5] >= 70, hist.join(","));
  assert.ok(hist.every((x, i) => i === 0 || x > hist[i - 1]));
});

test("週4鞍（体力50）：たまらない（0のまま）", () => {
  let f = 0;
  for (let w = 0; w < 10; w++) f = fatigueAfterRides(f, 4, 50);
  assert.equal(f, 0);
});

test("クランプ：0未満にならず100を超えない。applyWeeklyFatigueは同じ値", () => {
  assert.equal(fatigueAfterRides(0, 0, 50), 0);
  assert.equal(fatigueAfterRides(99, 15, 0), 100);
  assert.equal(applyWeeklyFatigue(40, 6, 20), fatigueAfterRides(40, 6, 20));
});

test("能力の低下：50以下は0・75で10%・100で20%", () => {
  assert.equal(fatiguePenaltyFactor(0), 1);
  assert.equal(fatiguePenaltyFactor(50), 1);
  near(fatiguePenaltyFactor(75), 0.9);
  near(fatiguePenaltyFactor(100), 0.8);
});
