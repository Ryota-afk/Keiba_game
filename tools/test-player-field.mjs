// プレイヤーが乗るレースも、世界のほかのレースと同じ仕組みで出走枠を組み、走らせること
// （`devlog/wave14.md`§18・§19）のテスト。
// 使い方： node --test tools/test-player-field.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapRoster } from "../src/domain/bootstrap.js";
import { createPlayer } from "../src/domain/player.js";
import { advanceWeek } from "../src/domain/weekLoop.js";
import { prepareWeek } from "../src/domain/weekPrepare.js";
import { planWeekFields } from "../src/domain/weekFields.js";
import { runNpcWeeklyRaces } from "../src/domain/npcWeeklyRace.js";
import { previewEntryField } from "../src/domain/entryListPreview.js";
import { generateWeeklyRequests } from "../src/domain/weeklyRequests.js";
import { buildWeeklyCard, RACE_SOURCE } from "../src/domain/weeklyCard.js";
import { isSidelined } from "../src/domain/fall.js";

const SEED = "player-field-test";
const YEAR = 1994;

function setup() {
  const { roster } = bootstrapRoster(SEED, YEAR);
  const player = createPlayer(SEED, { stableId: roster.stables[0].id, startYear: YEAR });
  return { roster, player };
}

/** 重賞が無く、一般競走が1本以上ある週を探す。 */
function findQuietWeek(roster, player) {
  for (let week = player.currentWeek; week < player.currentWeek + 52; week += 1) {
    const graded = planWeekFields(SEED, week, YEAR, roster.horses, roster.trialResults ?? {}).gradedFields;
    const race = buildWeeklyCard(SEED, week, YEAR).find((r) => r.source !== RACE_SOURCE.GRADED);
    if (graded.length === 0 && race) return { week, race };
  }
  throw new Error("該当する週が見つからない");
}

test("そのレースを計画で選んだ馬だけが相手になる（選ばなかった同じクラスの馬は入らない）", () => {
  const { roster, player } = setup();
  const { week, race } = findQuietWeek(roster, player);
  const alive = roster.horses.filter((h) => !h.isRetired && !isSidelined(h));
  const chosen = alive.slice(0, 8);
  const chosenIds = new Set(chosen.map((h) => h.id));
  const horses = roster.horses.map((h) => ({
    ...h,
    plan: chosenIds.has(h.id) ? { targetWeek: week, targetRaceId: race.raceId, prepWeek: null, prepRaceId: null } : null,
  }));
  const { weeklyFields } = planWeekFields(SEED, week, YEAR, horses, roster.trialResults ?? {});
  const f = weeklyFields.find((x) => x.race.raceId === race.raceId);
  assert.ok(f, "レースが成立する");
  assert.deepEqual(new Set(f.field.map((h) => h.id)), chosenIds);
  // 同じクラスで選ばなかった馬は入らない
  assert.ok(alive.some((h) => !chosenIds.has(h.id) && h.classId === chosen[0].classId));
});

test("登録が5頭に届かないレースは成立しない（プレイヤーの馬が1頭選んでいても同じ）", () => {
  const { roster, player } = setup();
  const { week, race } = findQuietWeek(roster, player);
  const alive = roster.horses.filter((h) => !h.isRetired && !isSidelined(h));
  const chosenIds = new Set(alive.slice(0, 4).map((h) => h.id));
  const horses = roster.horses.map((h) => ({
    ...h,
    plan: chosenIds.has(h.id) ? { targetWeek: week, targetRaceId: race.raceId, prepWeek: null, prepRaceId: null } : null,
  }));
  const { weeklyFields } = planWeekFields(SEED, week, YEAR, horses, roster.trialResults ?? {});
  assert.equal(weeklyFields.find((x) => x.race.raceId === race.raceId), undefined);
  // 依頼も来ない
  const requests = generateWeeklyRequests(SEED, week, { ...roster, horses }, player);
  assert.equal(requests.filter((r) => r.raceId === race.raceId).length, 0);
});

test("プレイヤーが乗る馬も同じ枠の1頭で、違いは騎手と記録の印だけ（byPlayerは乗った馬だけ）", () => {
  const { roster, player } = setup();
  const { week, race } = findQuietWeek(roster, player);
  const alive = roster.horses.filter((h) => !h.isRetired && !isSidelined(h));
  const chosen = alive.slice(0, 8);
  const chosenIds = new Set(chosen.map((h) => h.id));
  const horses = roster.horses.map((h) => ({
    ...h,
    plan: chosenIds.has(h.id) ? { targetWeek: week, targetRaceId: race.raceId, prepWeek: null, prepRaceId: null } : null,
  }));
  const rider = chosen[0];
  const riders = new Map([[rider.id, { jockey: player.jockey, jockeyPenalty: 1, strategy: null, fatigue: 0 }]]);
  const withRider = runNpcWeeklyRaces(SEED, week, YEAR, horses, new Set(), undefined, new Map(), undefined, riders);
  const without = runNpcWeeklyRaces(SEED, week, YEAR, horses, new Set(), undefined, new Map(), undefined, new Map());
  const result = withRider.riderResults.get(rider.id);
  assert.ok(result, "乗った馬の結果が返る");
  assert.ok(result.fell || (result.position >= 1 && result.position <= result.fieldSize));
  const after = withRider.horses.find((h) => h.id === rider.id);
  if (!result.fell) assert.equal(after.record.recentFinishes[0].byPlayer, true);
  for (const h of withRider.horses) {
    if (h.id === rider.id) continue;
    assert.notEqual(h.record.recentFinishes?.[0]?.byPlayer, true);
  }
  // 同じレースが同じ頭数で走る（外す仕組みは無い）
  assert.equal(withRider.racesRun, without.racesRun);
  assert.ok(without.horses.find((h) => h.id === rider.id).record.starts >= 0);
});

test("同じ馬が同じ週に2つのレースへ出ない（52週）", () => {
  const { roster, player } = setup();
  for (let week = player.currentWeek; week < player.currentWeek + 52; week += 1) {
    const { gradedFields, weeklyFields } = planWeekFields(SEED, week, YEAR, roster.horses, roster.trialResults ?? {});
    const seen = new Set();
    for (const f of gradedFields) for (const h of f.entries) assert.ok(!seen.has(h.id) && seen.add(h.id), `週${week}`);
    for (const f of weeklyFields) for (const h of f.field) assert.ok(!seen.has(h.id) && seen.add(h.id), `週${week}`);
  }
});

test("騎乗依頼は出走枠に入った馬だけ・出馬表と実際に走る枠が同じ", () => {
  let { roster, player } = setup();
  let checked = 0;
  for (let i = 0; i < 26; i += 1) {
    const week = player.currentWeek;
    const weekRoster = prepareWeek(roster, player).roster;
    const fields = planWeekFields(SEED, week, player.currentYear, weekRoster.horses, weekRoster.trialResults ?? {});
    const fieldOf = new Map();
    for (const f of fields.gradedFields) fieldOf.set(f.race.id, f.entries);
    for (const f of fields.weeklyFields) fieldOf.set(f.race.raceId, f.field);
    const requests = generateWeeklyRequests(SEED, week, weekRoster, player);
    for (const r of requests) {
      assert.ok(fieldOf.get(r.raceId)?.some((h) => h.id === r.horseId), "依頼の馬はそのレースの出走枠にいる");
    }
    let fieldsByDay = null;
    const res = advanceWeek(SEED, roster, player, { onJockeyBooking: (info) => { fieldsByDay = info.fieldsByDay; } });
    const booked = new Map();
    for (const day of Object.values(fieldsByDay)) for (const f of day) booked.set(f.raceId, f.horses.map((h) => h.id));
    for (const ride of res.rides) {
      const horse = weekRoster.horses.find((h) => h.id === ride.horseId);
      const preview = previewEntryField(SEED, week, horse, { horseId: horse.id, raceId: ride.raceId }, weekRoster.horses, player.currentYear, weekRoster.trialResults ?? {});
      const previewIds = preview.map((h) => h.id);
      assert.ok(previewIds.includes(horse.id), "出馬表にプレイヤーの馬がいる");
      // 騎手の割り当て（プレイヤーの馬を除く）と、出馬表（プレイヤーの馬を除く）が同じ顔ぶれ
      assert.deepEqual([...previewIds.filter((id) => id !== horse.id)].sort(), [...booked.get(ride.raceId)].sort());
      if (!ride.fell) assert.ok(ride.fieldSize <= previewIds.length && ride.fieldSize >= previewIds.length - 3);
      checked += 1;
    }
    roster = res.roster;
    player = res.player;
  }
  assert.ok(checked > 0);
});
