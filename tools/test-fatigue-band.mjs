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
    now, next, nowPenalty: 1 - fatiguePenaltyFactor(now), penalty: 1 - fatiguePenaltyFactor(next),
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

// ── 今週の値（`devlog/wave14.md`§16・見本`design/mocks/fatigue-week-v2.html`案A） ──
test("今週62・6鞍：今週は「−5%」で危険ではない、来週75は「−10%」で危険。下の言葉は両方つく", () => {
  const v = view(62, 6);
  assert.equal(v.nowText, "62");
  assert.equal(v.nowPenaltyText, "−5%");
  assert.equal(v.isNowDanger, false);
  assert.equal(v.penaltyText, "−10%");
  assert.equal(v.isDanger, true);
  assert.equal(v.isAnyPenaltyZone, true);
  assert.equal(v.isAnyDanger, true);
});

test("今週75・0鞍：今週は「−10%」で危険、来週40は能力の項目なし。「落馬しやすい」は今週のぶんでつく", () => {
  const v = view(75, 0);
  assert.equal(v.nowPenaltyText, "−10%");
  assert.equal(v.isNowDanger, true);
  assert.equal(v.nextText, "40");
  assert.equal(v.penaltyText, "");
  assert.equal(v.isDanger, false);
  assert.equal(v.isAnyDanger, true);
  assert.equal(v.isAnyPenaltyZone, false);
});

test("今週40・6鞍：今週は能力の項目なし、来週53は「−1%」で「能力が落ちる」だけつく", () => {
  const v = view(40, 6);
  assert.equal(v.nowPenaltyText, "");
  assert.equal(v.isNowPenalized, false);
  assert.equal(v.nextText, "53");
  assert.equal(v.penaltyText, "−1%");
  assert.equal(v.isAnyPenaltyZone, true);
  assert.equal(v.isAnyDanger, false);
});

test("今週の境目：ちょうど50は出さない、51は「−1%」＋「未満」、ちょうど70は危険、100は上限の下がり幅", () => {
  const at = (now) => fatigueBandView({
    now, next: 0, nowPenalty: 1 - fatiguePenaltyFactor(now), penalty: 0,
    penaltyStart: FATIGUE_PENALTY_START, dangerThreshold: FATIGUE_DANGER_THRESHOLD, max: FATIGUE_MAX,
  });
  assert.equal(at(FATIGUE_PENALTY_START).nowPenaltyText, "");
  const just = at(FATIGUE_PENALTY_START + 1);
  assert.equal(just.nowPenaltyNum, "−1%");
  assert.equal(just.nowPenaltyTail, "未満");
  assert.equal(just.nowPenaltyText, "−1%未満");
  assert.equal(at(FATIGUE_DANGER_THRESHOLD).isNowDanger, true);
  assert.equal(at(FATIGUE_DANGER_THRESHOLD - 0.4).isNowDanger, false);
  assert.equal(at(FATIGUE_MAX).nowPenaltyText, `−${Math.round(FATIGUE_MAX_PENALTY * 100)}%`);
  assert.equal(at(0).nowText, "0");
  assert.equal(at(0).isAnyDanger, false);
  assert.equal(at(0).isAnyPenaltyZone, false);
});
