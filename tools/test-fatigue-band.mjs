// 週の画面の「疲労の帯」の文字づくりのテスト（`devlog/wave14.md`§9）。
// 使い方： node --test tools/test-fatigue-band.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fatigueAfterRides, fatiguePenaltyFactor,
  FATIGUE_PENALTY_START, FATIGUE_DANGER_THRESHOLD, FATIGUE_MAX, FATIGUE_MAX_PENALTY,
} from "../src/domain/fatigue.js";
import { fatigueBandView } from "../src/view/fatigueBandView.js";

const view = (now, rides, stamina = 50) => {
  const next = fatigueAfterRides(now, rides, stamina);
  return fatigueBandView({
    now, next, penalty: 1 - fatiguePenaltyFactor(next),
    penaltyStart: FATIGUE_PENALTY_START, dangerThreshold: FATIGUE_DANGER_THRESHOLD, max: FATIGUE_MAX,
  });
};

test("疲労0・0鞍：今0・来週0、能力の項目は出さない", () => {
  const v = view(0, 0);
  assert.equal(v.nowText, "0");
  assert.equal(v.nextText, "0");
  assert.equal(v.penaltyText, "");
  assert.equal(v.isDanger, false);
  assert.equal(v.nextPct, 0);
});

test("疲労62・体力50：0鞍は27、3鞍は51で「−1%未満」、6鞍は75で「−10%」と危険", () => {
  assert.equal(view(62, 0).nextText, "27");
  const three = view(62, 3);
  assert.equal(three.nextText, "51");
  assert.equal(three.penaltyText, "−1%未満");
  assert.equal(three.isDanger, false);
  const six = view(62, 6);
  assert.equal(six.nextText, "75");
  assert.equal(six.penaltyText, "−10%");
  assert.equal(six.isDanger, true);
});

test("来週がちょうど50なら能力の項目は出さず、ちょうど70なら危険", () => {
  const at = (next) => fatigueBandView({
    now: 0, next, penalty: 1 - fatiguePenaltyFactor(next),
    penaltyStart: FATIGUE_PENALTY_START, dangerThreshold: FATIGUE_DANGER_THRESHOLD, max: FATIGUE_MAX,
  });
  assert.equal(at(FATIGUE_PENALTY_START).penaltyText, "");
  assert.equal(at(FATIGUE_DANGER_THRESHOLD).isDanger, true);
  assert.equal(at(FATIGUE_DANGER_THRESHOLD - 0.4).isDanger, false);
  assert.equal(at(FATIGUE_MAX).penaltyText, `−${Math.round(FATIGUE_MAX_PENALTY * 100)}%`);
});

test("帯の上の位置は上限に対する割合（境目は50%と70%）", () => {
  const v = view(62, 6);
  assert.equal(v.startPct, 50);
  assert.equal(v.dangerPct, 70);
  assert.equal(v.nowPct, 62);
  assert.ok(v.nextPct > 74 && v.nextPct < 76);
});
