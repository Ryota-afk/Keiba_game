// ウイニングポストの馬場適性の実測（`design/winning-post-surface-aptitude.md`）を、
// 本作のsimで同じやり方で再現する（CLAUDE.md §10）。
//
// ⭐調査1：能力がまったく同じ馬を16頭（◎○△×を4頭ずつ）走らせ、適性ごとの平均着順を取る。
//   出典側の値：◎3.6着・○6.0着・△11.1着・×13.3着（差は◎○2.4／○△5.1／△×2.2）。
//   ⚠️出典はグラフだけで数表が無く、上の4つは差の3つから逆算した値。
// ⭐調査2：低いほうの適性の馬のスピードを何ポイント足せば互角になるか（9頭対9頭）。
//   出典側の値：◎○が+3／○△が+4／△×が+2。
//   ⚠️⚠️**この換算は本作にそのまま当てはまらない**——本作のスピードは1項目だけを
//   G→S+に振り切っても芝1800mで2.09着しか動かないため（`devlog/wave08.md`§7-1）。
//   合わせに行くのは調査1のほう。
//
// 使い方： node tools/measure-aptitude-vs-speed.mjs [レース数]

import { runRaceSim, buildPlan } from "../src/sim/index.js";
import { streamRandom, RNG_STREAMS } from "../src/core/rng.js";

const RACES = Number(process.argv[2] ?? 600);
const DISTANCE = 2000;
const SURFACE = "turf";
const LEVELS = ["◎", "○", "△", "×"];

/** 出典と同じ「スピード70（B相当）・サブパラすべてB」の馬を1頭作る。 */
function baseHorse(id, level, speed = 70) {
  return {
    id,
    abilities: {
      speed,
      stamina: 70,
      sharpness: "B",
      grit: "B",
      flexibility: "B",
      wisdom: "B",
      health: "B",
      power: "B",
      mentalStrength: "B",
    },
    surfaceAptitude: { turf: level, dirt: level },
    mudAptitude: "○",
  };
}

/** 出典と同じ「脚質は自在」に近づけるため、4脚質を均等に割り当てる。 */
const STRATEGIES = ["nige", "senko", "sashi", "oikomi"];

function runField(seed, horses) {
  const entries = horses.map((h, i) => ({ num: i + 1, horse: h }));
  const plan = buildPlan(entries, (e) => STRATEGIES[(e.num - 1) % 4], null);
  const sim = runRaceSim({
    seed,
    raceKey: `apt-${seed}`,
    distance: DISTANCE,
    surface: SURFACE,
    condition: "good",
    entries,
    plan,
  });
  const pos = new Array(horses.length);
  sim.order.forEach((idx, p) => {
    pos[idx] = p + 1;
  });
  return pos;
}

// ===== 調査1：16頭（4段×4頭）の平均着順 =====
const sum1 = new Map(LEVELS.map((l) => [l, { n: 0, pos: 0 }]));
for (let r = 0; r < RACES; r += 1) {
  const rand01 = streamRandom("apt", RNG_STREAMS.SIM, "shuffle", r);
  // 枠順ランダム：4段×4頭をシャッフルしてから並べる。
  const slots = [];
  for (const l of LEVELS) for (let k = 0; k < 4; k += 1) slots.push(l);
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand01() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const horses = slots.map((l, i) => baseHorse(`h${r}-${i}`, l));
  const pos = runField(`apt-${r}`, horses);
  slots.forEach((l, i) => {
    const s = sum1.get(l);
    s.n += 1;
    s.pos += pos[i];
  });
}
console.log(`調査1：能力が同じ16頭（◎○△×を4頭ずつ）・芝2000m・良・${RACES}レース`);
console.log("  適性   このsimの平均着順   出典（ウイポ）");
const REF1 = { "◎": 3.6, "○": 6.0, "△": 11.1, "×": 13.3 };
const got = {};
for (const l of LEVELS) {
  const s = sum1.get(l);
  got[l] = s.pos / s.n;
  console.log(`   ${l}    ${got[l].toFixed(2).padStart(10)}着   ${REF1[l].toFixed(1).padStart(8)}着`);
}
console.log("  隣どうしの差   このsim   出典");
const PAIRS = [["◎", "○", 2.4], ["○", "△", 5.1], ["△", "×", 2.2]];
for (const [a, b, ref] of PAIRS) {
  console.log(`   ${a}と${b}      ${(got[b] - got[a]).toFixed(2).padStart(6)}着   ${ref.toFixed(1)}着`);
}

// ===== 調査2：スピードに換算するとどれだけか（9頭対9頭） =====
console.log(`\n調査2：低いほうの適性にスピードを足して互角になる点（9頭対9頭・${RACES}レース）`);
for (const [hi, lo, ref] of PAIRS) {
  const line = [];
  let crossed = null;
  for (let d = 0; d <= 8; d += 1) {
    let sumHi = 0;
    let sumLo = 0;
    for (let r = 0; r < RACES; r += 1) {
      const horses = [];
      for (let k = 0; k < 9; k += 1) horses.push(baseHorse(`a${r}-${k}`, hi, 70));
      for (let k = 0; k < 9; k += 1) horses.push(baseHorse(`b${r}-${k}`, lo, 70 + d));
      const pos = runField(`sp-${hi}${lo}-${d}-${r}`, horses);
      for (let k = 0; k < 9; k += 1) sumHi += pos[k];
      for (let k = 9; k < 18; k += 1) sumLo += pos[k];
    }
    const mHi = sumHi / (RACES * 9);
    const mLo = sumLo / (RACES * 9);
    line.push(`+${d}:${(mLo - mHi).toFixed(1)}`);
    if (crossed === null && mLo <= mHi) crossed = d;
  }
  console.log(`   ${hi}対${lo}  ${line.join(" ")}`);
  console.log(`     → 互角になるスピード差 ${crossed === null ? "+8より大" : "+" + crossed}（出典 +${ref === 2.4 ? 3 : ref === 5.1 ? 4 : 2}）`);
}
