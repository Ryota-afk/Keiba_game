// simが出す勝ちタイムが「狙いのタイム」に合っているかを測る（CLAUDE.md §10）。
//
// ⭐狙いのタイム＝`data/parTimes.js`の基準タイム ÷ 出走馬の強さの倍率。
// simは`vPar = 距離 ÷ (SIM_SPEED_EFFICIENCY × (狙い − SIM_START_OVERHEAD_SECONDS))`で走るので、
// この2つの較正値が合っていれば「出た値／狙い」が全距離で1.000になる。
// ⚠️**simの中身（消耗・発走の加速・直線の伸び）を触ったら毎回これを回す。**
// ずれ率が1%を超えたら`SIM_SPEED_EFFICIENCY`を`現在値 ÷ ずれ率`に置き換えて測り直す。
//
// 使い方： node tools/measure-sim-times.mjs [1距離あたりのレース数]

import { runRaceSim, buildPlan, fieldSpeedFactor } from "../src/sim/index.js";
import { parSecondsFor } from "../src/data/parTimes.js";
import { generateHorse } from "../src/domain/horse.js";


const RACES = Number(process.argv[2] ?? 60);
const STRATEGIES = ["nige", "senko", "sashi", "oikomi"];

function runOne(seed, distance, surface, size = 12) {
  const entries = [];
  for (let i = 0; i < size; i += 1) {
    entries.push({ num: i + 1, horse: generateHorse(`${seed}-h${i}`, { bornYear: 1974 }) });
  }
  const plan = buildPlan(entries, (e) => STRATEGIES[e.num % 4], null);
  const sim = runRaceSim({ seed, raceKey: `${seed}-${distance}`, distance, surface, entries, plan });
  const factor = fieldSpeedFactor(entries, surface, distance);
  return {
    winnerTime: sim.winnerTime,
    target: parSecondsFor(surface, distance) / factor,
    safety: Math.abs(sim.timeScale - 1) > 1e-9,
  };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log(`1距離あたり${RACES}レース（12頭立て・架空馬）`);
console.log("馬場 距離   狙いの中央  出た値の中央  ずれ    ずれ率   安全網の発動");
for (const surface of ["turf", "dirt"]) {
  for (const distance of [1200, 1600, 2000, 2400, 3200]) {
    const rows = [];
    for (let i = 0; i < RACES; i += 1) rows.push(runOne(`m${i}`, distance, surface));
    const err = median(rows.map((r) => r.winnerTime - r.target));
    const ratio = median(rows.map((r) => r.winnerTime / r.target));
    console.log(
      `${surface.padEnd(5)}${String(distance).padStart(5)}` +
        median(rows.map((r) => r.target)).toFixed(1).padStart(12) +
        median(rows.map((r) => r.winnerTime)).toFixed(1).padStart(14) +
        err.toFixed(2).padStart(8) +
        ratio.toFixed(4).padStart(9) +
        `${rows.filter((r) => r.safety).length}/${RACES}`.padStart(10)
    );
  }
}
