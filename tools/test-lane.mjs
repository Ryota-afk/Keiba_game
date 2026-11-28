// 内外（馬の横の位置）のテスト（`devlog/wave16.md`§6・`arch/race-sim.md`「内外」）。
// 使い方： node --test tools/test-lane.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { runRaceSim, resumeRaceSim, buildPlan, LANE_WIDTH } from "../src/sim/index.js";
import { courseShapeFor } from "../src/data/raceCourseShapes.js";
import { generateHorse } from "../src/domain/horse.js";
import {
  generateDreamHorse,
  generateDreamRivals,
  assignPostPositions,
  startDreamDerbySim,
  forkDreamDerbySim,
} from "../src/domain/dreamDerby.js";

const field = (seed, nums) => nums.map((num) => ({ num, horse: generateHorse(seed, `lane-${num}`) }));

/** 全ステップで、縦に重なる（鼻先の差が1馬身未満）組が横にも重なっていない（差が1頭分未満）か。 */
function overlapsOf(sim, nums) {
  let count = 0;
  for (let s = 0; s <= sim.lastStep; s += 1) {
    const t = s * sim.dt;
    for (let a = 0; a < nums.length; a += 1) {
      for (let b = a + 1; b < nums.length; b += 1) {
        const dd = Math.abs(sim.distanceOf(nums[a], t) - sim.distanceOf(nums[b], t));
        const dx = Math.abs(sim.lateralOf(nums[a], t) - sim.lateralOf(nums[b], t));
        if (dd < 2.4 - 1e-3 && dx < LANE_WIDTH - 1e-3) count += 1;
      }
    }
  }
  return count;
}

test("コーナーで外の馬ほど距離が伸びる量＝角度×内ラチからの距離", () => {
  // 発走直後から90度のコーナー（0〜200m）。コーナー中は内へ切り込まないので、横の位置はゲートのまま。
  const course = { corners: [{ from: 0, to: 200, angle: Math.PI / 2, corner: 1 }], width: { min: 30, max: 30 }, finalStraight: 400 };
  const entries = field("lane-geo", [1, 5]);
  const sim = runRaceSim({
    seed: "lane-geo", raceKey: "geo", distance: 1200, surface: "turf", entries, course,
    plan: buildPlan(entries, () => "senko", null),
  });
  const xOuter = 4 * LANE_WIDTH;
  assert.ok(Math.abs(sim.lateralOf(5, 0) - xOuter) < 1e-5); // 時系列はFloat32で持つ
  assert.equal(sim.extraMeters[0], 0); // 内ラチ沿いの馬は余分に走らない
  // 境目のステップの分だけずれる（1ステップ≒4m×κx）。
  assert.ok(Math.abs(sim.extraMeters[1] - (Math.PI / 2) * xOuter) < 0.2, `余分な距離 ${sim.extraMeters[1]}`);
});

test("ゲートの位置は馬番から（走らない馬の馬番は欠番のまま）", () => {
  const entries = field("lane-gate", [1, 2, 4, 7]);
  const sim = runRaceSim({
    seed: "lane-gate", raceKey: "gate", distance: 1600, surface: "turf", courseId: "tokyo", entries,
    plan: buildPlan(entries, () => "sashi", null),
  });
  [0, 1, 3, 6].forEach((k, i) => assert.ok(Math.abs(sim.lateralOf([1, 2, 4, 7][i], 0) - k * LANE_WIDTH) < 1e-5));
});

test("縦にも横にも重ならない（夢のダービー30本・東京以外の多頭数10本）", () => {
  for (let k = 0; k < 30; k += 1) {
    const seed = `lane-ov${k}`;
    const entries = assignPostPositions(seed, generateDreamHorse(seed), generateDreamRivals(seed));
    assert.equal(overlapsOf(startDreamDerbySim(seed, entries), entries.map((e) => e.num)), 0, seed);
  }
  for (let k = 0; k < 10; k += 1) {
    const nums = Array.from({ length: 16 }, (_, i) => i + 1);
    const entries = field(`lane-ov-n${k}`, nums);
    const sim = runRaceSim({
      seed: `lane-ov-n${k}`, raceKey: "ov", distance: [1200, 1800, 2000, 2500][k % 4], surface: k % 2 ? "dirt" : "turf",
      courseId: ["nakayama", "hanshin", "kokura", "fukushima", "kyoto"][k % 5], entries,
      plan: buildPlan(entries, (e) => ["nige", "senko", "sashi", "oikomi"][e.num % 4], null),
    });
    assert.equal(overlapsOf(sim, nums), 0, `n${k}`);
  }
});

test("同じ入力なら同じ結果（横の位置も）", () => {
  const seed = "lane-det";
  const entries = assignPostPositions(seed, generateDreamHorse(seed), generateDreamRivals(seed));
  const a = startDreamDerbySim(seed, entries);
  const b = startDreamDerbySim(seed, entries);
  for (let s = 0; s <= a.lastStep; s += 4) {
    for (const e of entries) {
      assert.equal(a.distanceOf(e.num, s * a.dt), b.distanceOf(e.num, s * b.dt));
      assert.equal(a.lateralOf(e.num, s * a.dt), b.lateralOf(e.num, s * b.dt));
    }
  }
  assert.deepEqual(a.blockedSeconds, b.blockedSeconds);
});

test("判断カードのフォーク前は、縦も横も1cmも変わらない", () => {
  for (let k = 0; k < 10; k += 1) {
    const seed = `lane-fork${k}`;
    const entries = assignPostPositions(seed, generateDreamHorse(seed), generateDreamRivals(seed));
    const base = startDreamDerbySim(seed, entries);
    const selfNum = entries.find((e) => e.isSelf).num;
    const tFork = base.timeAtDistanceOf(selfNum, 1200);
    const forked = forkDreamDerbySim(base, tFork, "mid", "dreamMidPack", "makuru");
    for (let t = 0; t < tFork - base.dt; t += base.dt) {
      for (const e of entries) {
        assert.equal(forked.distanceOf(e.num, t), base.distanceOf(e.num, t));
        assert.equal(forked.lateralOf(e.num, t), base.lateralOf(e.num, t));
      }
    }
    // 直線のフォークも同じ（道中のフォークの上にさらに重ねる）。
    const tStretch = forked.timeAtDistanceOf(selfNum, 1874);
    const again = resumeRaceSim(forked, tStretch, { phase: "stretch", early: true, effect: 1 });
    for (let t = 0; t < tStretch - base.dt; t += base.dt) {
      for (const e of entries) assert.equal(again.lateralOf(e.num, t), forked.lateralOf(e.num, t));
    }
  }
});

test("コースの形：東京芝2400mは直線525.9m・4つのコーナーで360度、ゴール側の最後のコーナーの出口が直線の入口", () => {
  const sh = courseShapeFor("tokyo", "turf", 2400);
  assert.equal(sh.corners.length, 4);
  assert.ok(Math.abs(sh.corners.reduce((a, c) => a + c.angle, 0) - 2 * Math.PI) < 1e-9);
  assert.ok(Math.abs(sh.corners[3].to - (2400 - 525.9)) < 1e-6);
  // 発走地点（ゴールまで2400−2083.1m）より前に1コーナーは来ない。
  assert.ok(sh.corners[0].from > 2400 - 2083.1);
});
