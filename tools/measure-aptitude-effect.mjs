// 適性（芝ダ・道悪・騎手）が着順にどれだけ効いているかを測る。
// ⭐`arch/race-sim.md`冒頭「最大の逆転要因は適性」が実際に成立しているかの検算。
// 使い方： node tools/measure-aptitude-effect.mjs [レース数]

import { runRaceSim, buildPlan } from "../src/sim/index.js";
import { createInitialRoster } from "../src/domain/career.js";
import { deriveFavoredStrategy } from "../src/domain/strategy.js";
import { streamRandom, RNG_STREAMS } from "../src/core/rng.js";

const RACES = Number(process.argv[2]) || 2000;
const FIELD_SIZE = 12;

const roster = createInitialRoster("aptitude-measure");
const pool = roster.horses.slice(0, 600);
const jockeys = roster.npcJockeys;

/** 適性ごとの着順を集計する箱。 */
function newTally() {
  return new Map();
}
function add(tally, key, position, fieldSize) {
  if (!tally.has(key)) tally.set(key, { n: 0, wins: 0, sumPos: 0 });
  const t = tally.get(key);
  t.n += 1;
  t.wins += position === 1 ? 1 : 0;
  t.sumPos += position / fieldSize; // 頭数で割った相対順位（0に近いほど上位）
}
function report(title, tally, order) {
  console.log(`\n${title}`);
  console.log("  値    出走数   1着率   相対順位（0=1着・1=最下位）");
  for (const key of order) {
    const t = tally.get(key);
    if (!t) continue;
    console.log(
      `  ${String(key).padEnd(4)} ${String(t.n).padStart(7)}  ${((100 * t.wins) / t.n).toFixed(1).padStart(5)}%  ${(
        t.sumPos / t.n
      ).toFixed(3)}`
    );
  }
}

function run({ surface, condition, useJockey }) {
  const surfaceTally = newTally();
  const mudTally = newTally();
  const jockeyTally = newTally();

  for (let r = 0; r < RACES; r += 1) {
    const rand01 = streamRandom("measure", RNG_STREAMS.SIM, "pick", surface, condition, r);
    // 出走馬をプールから無作為に選ぶ（×の馬場は実際の出走選抜と同じく外す）
    const field = [];
    let guard = 0;
    while (field.length < FIELD_SIZE && guard < 500) {
      guard += 1;
      const horse = pool[Math.floor(rand01() * pool.length)];
      if (horse.surfaceAptitude[surface] === "×") continue;
      if (field.some((h) => h.id === horse.id)) continue;
      field.push(horse);
    }
    if (field.length < FIELD_SIZE) continue;

    const entries = field.map((horse, i) => ({
      num: i + 1,
      horse,
      isSelf: false,
      jockey: useJockey ? jockeys[Math.floor(rand01() * jockeys.length)] : undefined,
    }));
    const plan = buildPlan(entries, (e) => deriveFavoredStrategy(e.horse), 1);
    const result = runRaceSim({
      seed: "measure",
      raceKey: `${surface}-${condition}-${r}`,
      distance: 2000,
      surface,
      condition,
      entries,
      plan,
    });

    result.order.forEach((entryIndex, idx) => {
      const e = entries[entryIndex];
      const position = idx + 1;
      add(surfaceTally, e.horse.surfaceAptitude[surface], position, FIELD_SIZE);
      add(mudTally, e.horse.mudAptitude, position, FIELD_SIZE);
      if (e.jockey) {
        const band =
          e.jockey.aptitudes["surface:" + surface] ?? "D";
        add(jockeyTally, band, position, FIELD_SIZE);
      }
    });
  }
  return { surfaceTally, mudTally, jockeyTally };
}

console.log(`${RACES}レース×${FIELD_SIZE}頭・2000mで測る（プール600頭・騎手160人）`);

const turfGood = run({ surface: "turf", condition: "good", useJockey: true });
report("【芝・良】馬の芝適性ごと", turfGood.surfaceTally, ["◎", "○", "△"]);
report("【芝・良】馬の道悪適性ごと（良馬場なので差が出ないのが正しい）", turfGood.mudTally, ["◎", "○", "△", "×"]);
report("【芝・良】騎手の芝適性ごと", turfGood.jockeyTally, ["S", "A", "B", "C", "D", "E", "F", "G"]);

const turfHeavy = run({ surface: "turf", condition: "heavy", useJockey: true });
report("【芝・不良】馬の道悪適性ごと", turfHeavy.mudTally, ["◎", "○", "△", "×"]);
