// 所属厩舎の馬が1レースあたりの上限の枠を先に取ること（#105）と、GIは通算31勝が要ること
// （`devlog/wave14.md`§4）のテスト。
// 使い方： node --test tools/test-request-priority.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapRoster } from "../src/domain/bootstrap.js";
import { createPlayer } from "../src/domain/player.js";
import { generateWeeklyRequests } from "../src/domain/weeklyRequests.js";
import { buildWeeklyCard, RACE_SOURCE } from "../src/domain/weeklyCard.js";
import { canRideGradedRace, G1_RIDE_MIN_CAREER_WINS } from "../src/domain/rideEligibility.js";
import { gradedRaceById } from "../src/data/shutokuPrize.js";
import { gradedTierOf } from "../src/data/gradedTier.js";
import { rankSpec } from "../src/data/ranks.js";

const SEED = "priority-test";
const YEAR = 1994;

function setup() {
  const { roster } = bootstrapRoster(SEED, YEAR);
  const player = createPlayer(SEED, { stableId: roster.stables[0].id, startYear: YEAR });
  return { roster, player };
}

/** 馬を作り替えて、指定の週・レースを目標にする。 */
function planned(horse, id, stableId, ownerId, week, raceId) {
  return { ...horse, id, stableId, ownerId, isRetired: false, plan: { targetWeek: week, targetRaceId: raceId, prepWeek: null, prepRaceId: null } };
}

/** 重賞でない（一般競走）レースがある週を探す。 */
function findWeekWithRace(player, predicate) {
  for (let week = player.currentWeek; week < player.currentWeek + 52; week += 1) {
    const race = buildWeeklyCard(SEED, week, YEAR).find(predicate);
    if (race) return { week, race };
  }
  throw new Error("該当する週が見つからない");
}

test("所属厩舎の馬は、質が低くても1レースあたりの上限の枠を先に取る", () => {
  const { roster, player } = setup();
  const max = rankSpec(player.jockey.rank).maxRequestsPerRace;
  const { week, race } = findWeekWithRace(player, (r) => r.source !== RACE_SOURCE.GRADED);
  const own = player.jockey.stableId;
  const others = roster.stables.filter((s) => s.id !== own).slice(0, max + 2);
  const base = roster.horses[0];
  // 他厩舎の馬は上限より多く（質を高くするため信頼を50にする）、所属厩舎の馬は2頭（信頼0）
  const horses = [
    ...others.map((s, i) => planned(base, `o${i}`, s.id, base.ownerId, week, race.raceId)),
    planned(base, "mine1", own, base.ownerId, week, race.raceId),
    planned(base, "mine2", own, base.ownerId, week, race.raceId),
  ];
  const trainerTrust = Object.fromEntries(others.map((s) => [s.id, 50]));
  const result = generateWeeklyRequests(SEED, week, { ...roster, horses }, { ...player, trainerTrust }).filter(
    (r) => r.raceId === race.raceId
  );
  assert.equal(result.length, max);
  assert.deepEqual(result.filter((r) => r.isFromOwnStable).map((r) => r.horseId).sort(), ["mine1", "mine2"]);
});

test("所属厩舎の候補が上限より多いときは、所属厩舎の中で質の高い順に上限の頭数", () => {
  const { roster, player } = setup();
  const max = rankSpec(player.jockey.rank).maxRequestsPerRace;
  const { week, race } = findWeekWithRace(player, (r) => r.source !== RACE_SOURCE.GRADED);
  const own = player.jockey.stableId;
  const other = roster.stables.find((s) => s.id !== own);
  const base = roster.horses[0];
  const horses = [
    ...Array.from({ length: max + 2 }, (_, i) => planned(base, `mine${i}`, own, base.ownerId, week, race.raceId)),
    planned(base, "other", other.id, base.ownerId, week, race.raceId),
  ];
  const result = generateWeeklyRequests(SEED, week, { ...roster, horses }, { ...player, trainerTrust: { [other.id]: 50 } }).filter(
    (r) => r.raceId === race.raceId
  );
  assert.equal(result.length, max);
  assert.ok(result.every((r) => r.isFromOwnStable));
});

test("canRideGradedRace：GIは通算31勝が要る・GII/GIIIと、格を渡さないときは信頼だけ", () => {
  const { roster, player } = setup();
  const horse = roster.horses[0];
  const trusted = {
    ...player,
    trainerTrust: { [horse.stableId]: 8 },
    ownerTrust: { [horse.ownerId]: 3 },
  };
  const withWins = (wins) => ({ ...trusted, record: { ...trusted.record, wins } });
  assert.equal(G1_RIDE_MIN_CAREER_WINS, 31);
  assert.equal(canRideGradedRace(withWins(30), horse, "g1"), false);
  assert.equal(canRideGradedRace(withWins(31), horse, "g1"), true);
  assert.equal(canRideGradedRace(withWins(0), horse, "g2"), true);
  assert.equal(canRideGradedRace(withWins(0), horse, "g3"), true);
  assert.equal(canRideGradedRace(withWins(0), horse), true);
  // 信頼が足りなければ勝利数があっても乗れない
  assert.equal(canRideGradedRace({ ...player, record: { ...player.record, wins: 99 } }, horse, "g1"), false);
});

test("GIの依頼は通算31勝まで来ない（GII・GIIIは信頼だけで来る）", () => {
  const { roster, player } = setup();
  const own = player.jockey.stableId;
  const base = roster.horses[0];
  const trusted = { ...player, trainerTrust: { [own]: 20 }, ownerTrust: { [base.ownerId]: 20 } };
  const find = (tier) => {
    for (let week = player.currentWeek; week < player.currentWeek + 52; week += 1) {
      const race = buildWeeklyCard(SEED, week, YEAR).find((r) => {
        if (r.source !== RACE_SOURCE.GRADED) return false;
        const g = gradedRaceById(YEAR, r.raceId);
        return g && gradedTierOf(g, YEAR) === tier;
      });
      if (race) return { week, race };
    }
    throw new Error(`${tier}の週が見つからない`);
  };
  const ask = ({ week, race }, wins) =>
    generateWeeklyRequests(SEED, week, { ...roster, horses: [planned(base, "h", own, base.ownerId, week, race.raceId)] }, {
      ...trusted,
      record: { ...trusted.record, wins },
    }).filter((r) => r.raceId === race.raceId).length;
  const g1 = find("g1");
  assert.equal(ask(g1, 30), 0);
  assert.equal(ask(g1, 31), 1);
  const g3 = find("g3");
  assert.equal(ask(g3, 0), 1);
});
