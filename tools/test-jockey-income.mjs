// 馬の本賞（5着まで）と騎手の収入（騎乗手当＋進上金5%）のテスト（`devlog/wave14.md`§1・§2）。
// 使い方： node --test tools/test-jockey-income.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { placePrizeShare, earningsForResult } from "../src/domain/horse.js";
import { rideIncome, prizeShareFor, mountAllowanceFor } from "../src/domain/income.js";
import { JOCKEY_PRIZE_SHARE } from "../src/data/prizeMoney.js";
import { PROVISIONAL_FIRST_PRIZE_1974 } from "../src/data/raceProgram.js";
import { bootstrapRoster } from "../src/domain/bootstrap.js";
import { createPlayer } from "../src/domain/player.js";
import { advanceWeek } from "../src/domain/weekLoop.js";

test("本賞は5着まで（100・40・25・15・10%）、6着以下は0", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 18].map(placePrizeShare), [1, 0.4, 0.25, 0.15, 0.1, 0, 0]);
});

test("進上金の割合は5%", () => assert.equal(JOCKEY_PRIZE_SHARE, 0.05));

test("一般競走（1勝クラス）：1〜6着の収入＝騎乗手当＋馬の本賞の5%", () => {
  const first = PROVISIONAL_FIRST_PRIZE_1974.win1;
  const allowance = mountAllowanceFor("win1");
  const expected = [1, 2, 3, 4, 5, 6].map((p) => allowance + Math.round(first * [1, 0.4, 0.25, 0.15, 0.1, 0][p - 1] * 0.05));
  const actual = [1, 2, 3, 4, 5, 6].map((p) => rideIncome("win1", earningsForResult("win1", p)));
  assert.deepEqual(actual, expected);
  assert.equal(actual[5], allowance); // 6着は騎乗手当だけ
  assert.ok(actual[1] > allowance && actual[4] > allowance); // 2〜5着にも進上金
});

test("重賞（G1・1着賞金2億円）：1〜6着の収入", () => {
  const prize1 = 200000000;
  const got = [1, 2, 3, 4, 5, 6].map((p) => rideIncome("g1", prize1 * placePrizeShare(p)));
  assert.deepEqual(got, [64500 + 10000000, 64500 + 4000000, 64500 + 2500000, 64500 + 1500000, 64500 + 1000000, 64500]);
});

test("落馬（本賞0）は進上金0", () => assert.equal(prizeShareFor(0), 0));

test("通し：騎乗ごとに 収入−騎乗手当 ＝ round(5% × 馬の獲得賞金)。落馬は収入0", () => {
  let { roster } = bootstrapRoster(7, 1994);
  let player = createPlayer(7, { startYear: 1994 });
  let checked = 0, nonWinShare = 0;
  for (let w = 0; w < 12; w++) {
    const res = advanceWeek(7, roster, player, {
      chooseMounts: (cands) => {
        const seen = new Set(); const dayCourse = {};
        return cands.filter((c) => {
          dayCourse[c.day] ??= c.courseId;
          if (dayCourse[c.day] !== c.courseId || seen.has(c.raceId) || seen.size >= 6) return false;
          seen.add(c.raceId); return true;
        });
      },
    });
    roster = res.roster; player = res.player;
    for (const r of res.rides ?? []) {
      if (r.fell) { assert.equal(r.income, 0); continue; }
      const horse = roster.horses.find((h) => h.id === r.horseId);
      const base = r.income - Math.round(r.prize * 0.05);
      // 騎乗手当はどのクラスの額のどれかに一致する
      assert.ok([64500, 44500, 27500].includes(base), `手当の額が不正: ${base}`);
      assert.ok(horse);
      if (r.position > 5) assert.equal(r.income, base);
      if (r.position >= 2 && r.position <= 5 && r.prize > 0) nonWinShare++;
      checked++;
    }
  }
  assert.ok(checked > 30);
  assert.ok(nonWinShare > 0, "2〜5着の鞍が標本に無い");
});
