// 降級（4歳の夏に収得賞金を半分にする）のテスト（`devlog/wave14.md`§12・§13）。
// 使い方： node --test tools/test-demotion.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoteIfDue, reclassAndRetireMaidens } from "../src/domain/horseClass.js";
import { THREE_YEAR_OLD_SUMMER_WEEK } from "../src/data/shutokuPrize.js";

const W = THREE_YEAR_OLD_SUMMER_WEEK; // 第22週
const horse = (born, shutoku, extra = {}) => ({
  id: "h", bornYear: born, classId: "win2", isRetired: false,
  record: { starts: 8, shutokuPrize: shutoku }, ...extra,
});
const abs = (yearIndex, w) => yearIndex * 52 + w;

test("満4歳・6月1日の週で半分になる（端数は切り捨て）", () => {
  const h = demoteIfDue(horse(1990, 1_000_001), abs(2, W), 1994);
  assert.equal(h.record.shutokuPrize, 500_000);
  assert.equal(h.record.demotedYear, 1994);
});
test("その週より前（5月）は何もしない", () => {
  const h = horse(1990, 1000_0000);
  assert.equal(demoteIfDue(h, abs(2, W - 1), 1994), h);
});
test("同じ週に2回・翌週以降に呼んでも1回だけ", () => {
  const once = demoteIfDue(horse(1990, 1000_0000), abs(2, W), 1994);
  assert.equal(demoteIfDue(once, abs(2, W), 1994), once);
  assert.equal(demoteIfDue(once, abs(2, W + 10), 1994), once);
  assert.equal(once.record.shutokuPrize, 500_0000);
});
test("6月1日の週を過ぎてから初めて呼んでも1回半分になる（取りこぼさない）", () => {
  assert.equal(demoteIfDue(horse(1990, 1000_0000), abs(2, 40), 1994).record.shutokuPrize, 500_0000);
});
test("満3歳・満5歳はならない", () => {
  for (const born of [1991, 1989]) {
    const h = horse(born, 1000_0000);
    assert.equal(demoteIfDue(h, abs(2, W), 1994), h);
  }
});
test("2019年はならない・2018年はなる", () => {
  const h = horse(2015, 1000_0000);
  assert.equal(demoteIfDue(h, abs(2, W), 2019), h);
  assert.equal(demoteIfDue(horse(2014, 1000_0000), abs(2, W), 2018).record.shutokuPrize, 500_0000);
});
test("収得賞金0は変わらない", () => {
  const h = horse(1990, 0);
  assert.equal(demoteIfDue(h, abs(2, W), 1994), h);
});
test("翌年（満5歳）はもう半分にならない", () => {
  const once = demoteIfDue(horse(1990, 1000_0000), abs(2, W), 1994);
  assert.equal(demoteIfDue(once, abs(3, W), 1995), once);
});
test("古いセーブ（収得賞金の欄が無い）でも動く：クラスから開始値を補って半分", () => {
  const h = { id: "h", bornYear: 1990, classId: "win3", isRetired: false, record: { starts: 9 } };
  assert.equal(demoteIfDue(h, abs(2, W), 1994).record.shutokuPrize, 750_0000);
});
test("半分にした後のクラス：1,600万→800万で3勝→2勝、週をまたいで二重にならない", () => {
  const h = horse(1990, 1500_0000, { classId: "win3" });
  const r1 = reclassAndRetireMaidens([h], abs(2, W), 1994).horses[0];
  assert.equal(r1.record.shutokuPrize, 750_0000);
  assert.equal(r1.classId, "win2");
  const r2 = reclassAndRetireMaidens([r1], abs(2, W), 1994).horses[0];
  assert.equal(r2.record.shutokuPrize, 750_0000);
  assert.equal(r2.classId, "win2");
});
test("1,000万超は半分でも500万超なので2勝のまま、500万以下に落ちれば1勝", () => {
  const a = reclassAndRetireMaidens([horse(1990, 1200_0000, { classId: "win3" })], abs(2, W), 1994).horses[0];
  assert.equal(a.classId, "win2");
  const b = reclassAndRetireMaidens([horse(1990, 900_0000, { classId: "win2" })], abs(2, W), 1994).horses[0];
  assert.equal(b.record.shutokuPrize, 450_0000);
  assert.equal(b.classId, "win1");
});
