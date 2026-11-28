// 馬番の抽選（`domain/postDraw.js`・`devlog/wave16.md`§3）のテスト。
// 使い方： node --test tools/test-post-draw.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapRoster } from "../src/domain/bootstrap.js";
import { planWeekFields } from "../src/domain/weekFields.js";
import { planNpcGradedFields } from "../src/domain/npcGradedRace.js";
import { planNpcWeeklyFields } from "../src/domain/npcWeeklyRace.js";
import { drawPostOrder } from "../src/domain/postDraw.js";
import { setRaceObserver } from "../src/domain/raceRun.js";
import { runNpcWeeklyRaces } from "../src/domain/npcWeeklyRace.js";

const SEED = "post-draw-test";
const YEAR = 1994;
const { roster } = bootstrapRoster(SEED, YEAR);
const ids = (hs) => hs.map((h) => h.id);

/** 出走枠が1つ以上ある週を探す。 */
function weeksWithFields(limit = 12) {
  const out = [];
  for (let week = 1; week < 80 && out.length < limit; week += 1) {
    const f = planWeekFields(SEED, week, YEAR, roster.horses, roster.trialResults ?? {});
    if (f.weeklyFields.length > 0) out.push({ week, f });
  }
  return out;
}

test("同じレースは何度呼んでも同じ馬番・入力の並びに依らない", () => {
  const field = roster.horses.slice(0, 14);
  const a = drawPostOrder(SEED, "k", field);
  assert.deepEqual(ids(drawPostOrder(SEED, "k", field)), ids(a));
  assert.deepEqual(ids(drawPostOrder(SEED, "k", [...field].reverse())), ids(a));
  assert.deepEqual(ids(drawPostOrder(SEED, "k", a)), ids(a)); // かけ直しても変わらない
  assert.notDeepEqual(ids(drawPostOrder(SEED, "k2", field)), ids(a)); // レースが違えば別の抽選
});

test("馬番は1〜頭数の並べ替え（同じ馬が2回出ない・欠けない）", () => {
  for (const n of [5, 12, 18]) {
    const field = roster.horses.slice(0, n);
    const drawn = drawPostOrder(SEED, "x", field);
    assert.equal(drawn.length, n);
    assert.deepEqual(new Set(ids(drawn)), new Set(ids(field)));
  }
});

test("出走する顔ぶれは抽選の前後で同じ（並びだけが変わる）", () => {
  let checked = 0;
  for (const { week, f } of weeksWithFields()) {
    const rawGraded = planNpcGradedFields(week, YEAR, roster.horses, roster.trialResults ?? {});
    assert.equal(rawGraded.length, f.gradedFields.length);
    rawGraded.forEach((raw, i) => {
      assert.deepEqual(new Set(ids(raw.entries)), new Set(ids(f.gradedFields[i].entries)));
      checked += 1;
    });
    // 一般競走は計画の時点で抽選済み。計画に渡した除外（重賞に出た馬）を同じにして比べる。
    const rawWeekly = planNpcWeeklyFields(SEED, week, YEAR, roster.horses, f.gradedRacedHorseIds);
    assert.deepEqual(rawWeekly.map((r) => r.race.raceId), f.weeklyFields.map((r) => r.race.raceId));
    rawWeekly.forEach((raw, i) => {
      assert.equal(raw.fieldSize, f.weeklyFields[i].fieldSize);
      assert.deepEqual(new Set(ids(raw.field)), new Set(ids(f.weeklyFields[i].field)));
      checked += 1;
    });
  }
  assert.ok(checked > 0);
});

test("走らせる側の馬番＝出馬表の並び（計画の枠の並び）・馬番は1〜頭数", () => {
  let seen = 0;
  for (const { week, f } of weeksWithFields(6)) {
    const planned = new Map(f.weeklyFields.map((x) => [x.race.raceId, ids(x.field)]));
    const raw = new Map();
    setRaceObserver(({ race, entries }) => raw.set(race.raceId, entries));
    runNpcWeeklyRaces(SEED, week, YEAR, roster.horses, f.gradedRacedHorseIds, undefined, new Map(), f.weeklyFields);
    setRaceObserver(null);
    for (const [raceId, entries] of raw) {
      assert.deepEqual(entries.map((e) => e.num), entries.map((_, i) => i + 1));
      const order = entries.map((e) => e.horse.id);
      // 落馬した馬は走らないので、計画の並びからその馬を除いた順と同じ
      assert.deepEqual(order, planned.get(raceId).filter((id) => order.includes(id)));
      seen += 1;
    }
  }
  assert.ok(seen > 0);
});
