// 9軸それぞれが着順を何着ぶん動かすかを測る（CLAUDE.md §10）。
//
// ⭐測り方：同じ乱数・同じ出走馬で2回走らせ、**1頭の1軸だけ**を最低（G／0）と
// 最高（S+／100）に入れ替えて、その馬の着順がどれだけ動いたかを取る。
// 他の馬も他の軸も同じなので、その軸だけの効き目が出る。
//
// ⚠️`arch/horse.md`の9軸の表と突き合わせること。設計上「着順を動かさない」と決めている軸
// （賢さ＝判断カードの効き幅／健康＝落馬・離脱・疲労／精神力＝遠征）が0に近いのは正常。
// ⚠️パワーは「坂と重馬場」担当なので、馬場状態を変えて測らないと本来の値は出ない。
//
// 使い方： node tools/measure-ability-axes.mjs [レース数] [距離] [馬場] [馬場状態]

import { runRaceSim, buildPlan } from "../src/sim/index.js";
import { createInitialRoster } from "../src/domain/career.js";
import { deriveFavoredStrategy } from "../src/domain/strategy.js";
import { streamRandom, RNG_STREAMS } from "../src/core/rng.js";
import { canRaceOnSurface } from "../src/data/surfaceAptitude.js";

const RACES = Number(process.argv[2] ?? 800);
const DISTANCE = Number(process.argv[3] ?? 1800);
const SURFACE = process.argv[4] ?? "turf";
const CONDITION = process.argv[5] ?? "good";
const FIELD_SIZE = 12;

const NUMERIC = ["speed", "stamina"];
const AXES = [
  ["speed", "スピード"],
  ["stamina", "スタミナ"],
  ["sharpness", "瞬発力"],
  ["grit", "勝負根性"],
  ["flexibility", "柔軟性"],
  ["wisdom", "賢さ"],
  ["health", "健康"],
  ["power", "パワー"],
  ["mentalStrength", "精神力"],
];

const roster = createInitialRoster("axes");
const pool = roster.horses.filter((h) => canRaceOnSurface(h.surfaceAptitude, SURFACE)).slice(0, 600);
const jockeys = roster.npcJockeys;

function positionOf(entries, plan, key, targetIdx, value) {
  const patched = entries.map((e, i) =>
    i === targetIdx ? { ...e, horse: { ...e.horse, abilities: { ...e.horse.abilities, [key]: value } } } : e
  );
  const sim = runRaceSim({
    seed: "axes",
    raceKey: `${key}-${targetIdx}-${DISTANCE}`,
    distance: DISTANCE,
    surface: SURFACE,
    condition: CONDITION,
    entries: patched,
    plan,
  });
  return sim.order.indexOf(targetIdx) + 1;
}

const result = new Map();
for (let r = 0; r < RACES; r += 1) {
  const rand01 = streamRandom("axes", RNG_STREAMS.SIM, "pick", DISTANCE, SURFACE, r);
  const field = [];
  let guard = 0;
  while (field.length < FIELD_SIZE && guard++ < 400) {
    const h = pool[Math.floor(rand01() * pool.length)];
    if (!field.some((x) => x.id === h.id)) field.push(h);
  }
  if (field.length < FIELD_SIZE) continue;
  const entries = field.map((h, i) => ({
    num: i + 1,
    horse: h,
    jockey: jockeys[Math.floor(rand01() * jockeys.length)],
  }));
  const plan = buildPlan(entries, (e) => deriveFavoredStrategy(e.horse), null);
  const target = Math.floor(rand01() * FIELD_SIZE);
  for (const [key] of AXES) {
    const lo = NUMERIC.includes(key) ? 1 : "G";
    const hi = NUMERIC.includes(key) ? 100 : "S+";
    const posLo = positionOf(entries, plan, key, target, lo);
    const posHi = positionOf(entries, plan, key, target, hi);
    if (!result.has(key)) result.set(key, { n: 0, sum: 0 });
    const s = result.get(key);
    s.n += 1;
    s.sum += posLo - posHi; // 正＝その軸が高いほど着順が良い
  }
}

console.log(
  `${SURFACE === "dirt" ? "ダート" : "芝"}${DISTANCE}m・${CONDITION}・${FIELD_SIZE}頭立て・${RACES}レース`
);
console.log("その軸だけを最低(G)から最高(S+)に上げたとき、その馬の着順が何着上がるか\n");
for (const [key, name] of AXES) {
  const s = result.get(key);
  if (!s) continue;
  console.log("  " + name.padEnd(8), (s.sum / s.n).toFixed(2).padStart(6) + "着");
}
