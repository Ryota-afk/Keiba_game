// 「強い芝馬がダートでも無双するか」を測る（CLAUDE.md §10）。
//
// ⭐ダートのレースだけを走らせ、出走馬を「能力の高さ」×「ダート適性」で分けて
// 平均着順を出す。⚠️見るのは1つ——**能力が上位の△の馬が、能力が中位の◎の馬より
// 前で終わっていないか。** そうなっていたら、適性が能力に負けている＝
// 芝が得意なだけの強い馬がダートでも勝ててしまう。
//
// 使い方： node tools/measure-surface-aptitude.mjs [レース数] [馬場]

import { runRaceSim, buildPlan } from "../src/sim/index.js";
import { normalizedAbilities, distanceAptitude } from "../src/sim/stamina.js";
import { canRaceOnSurface } from "../src/data/surfaceAptitude.js";
import { createInitialRoster } from "../src/domain/career.js";
import { deriveFavoredStrategy } from "../src/domain/strategy.js";
import { streamRandom, RNG_STREAMS } from "../src/core/rng.js";

const RACES = Number(process.argv[2] ?? 3000);
const SURFACE = process.argv[3] ?? "dirt";
const FIELD_SIZE = 12;
const DISTANCE = 1800;


// ⭐「このレースでのその馬の強さ」＝6軸の平均 × その距離の距離適性。
// ⚠️距離適性を掛けないと測れない。実測（ダート1800m・24,000頭ぶん）で着順との相関は
// 距離適性が−0.708、6軸の平均に入っている持久力は**+0.323**（＝1800mでは持久力が高いほど
// 着順が悪い。適正距離が伸びて1800mが短すぎる馬になるため）。距離適性を掛けずに
// 「能力の高い馬」を選ぶと、実際には「長距離向きで1800mに合っていない馬」を選んでしまう。
const abilityOf = (horse) => {
  const a = normalizedAbilities(horse);
  const raw = (a.speed + a.stamina + a.sharpness + a.grit + a.power + a.mentalStrength) / 6;
  return raw * distanceAptitude(horse, DISTANCE);
};

const roster = createInitialRoster("surface-apt");
const pool = roster.horses.filter((h) => canRaceOnSurface(h.surfaceAptitude, SURFACE)).slice(0, 800);
const sorted = [...pool].map(abilityOf).sort((a, b) => a - b);
// 能力を5等分する境目。
const cut = [0.2, 0.4, 0.6, 0.8].map((p) => sorted[Math.floor(sorted.length * p)]);
const tierOf = (h) => {
  const v = abilityOf(h);
  let t = 0;
  for (const c of cut) if (v >= c) t += 1;
  return t; // 0=下位20% … 4=上位20%
};

const sum = new Map(); // "tier|適性" → {n, pos}
for (let r = 0; r < RACES; r += 1) {
  const rand01 = streamRandom("surface-apt", RNG_STREAMS.SIM, "pick", SURFACE, r);
  const field = [];
  let guard = 0;
  while (field.length < FIELD_SIZE && guard < 500) {
    guard += 1;
    const h = pool[Math.floor(rand01() * pool.length)];
    if (field.some((x) => x.id === h.id)) continue;
    field.push(h);
  }
  if (field.length < FIELD_SIZE) continue;
  const entries = field.map((h, i) => ({ num: i + 1, horse: h }));
  const plan = buildPlan(entries, (e) => deriveFavoredStrategy(e.horse), null);
  const sim = runRaceSim({
    seed: "surface-apt",
    raceKey: `${SURFACE}-${r}`,
    distance: DISTANCE,
    surface: SURFACE,
    entries,
    plan,
  });
  sim.order.forEach((idx, pos) => {
    const key = `${tierOf(field[idx])}|${field[idx].surfaceAptitude[SURFACE]}`;
    if (!sum.has(key)) sum.set(key, { n: 0, pos: 0 });
    const s = sum.get(key);
    s.n += 1;
    s.pos += pos + 1;
  });
}

const TIER_NAME = ["強さ 下位20%", "強さ 40%", "強さ 中位", "強さ 60%", "強さ 上位20%"];
const LEVELS = ["◎", "○", "△"];
console.log(`${SURFACE === "dirt" ? "ダート" : "芝"}${DISTANCE}m・${FIELD_SIZE}頭立て・${RACES}レース`);
console.log("                 " + LEVELS.map((l) => `${SURFACE === "dirt" ? "ダ" : "芝"}${l}`.padStart(8)).join(""));
for (let t = 4; t >= 0; t -= 1) {
  const cells = LEVELS.map((l) => {
    const s = sum.get(`${t}|${l}`);
    return s && s.n >= 100 ? (s.pos / s.n).toFixed(2).padStart(8) : "—".padStart(8);
  });
  console.log(TIER_NAME[t].padEnd(16) + cells.join(""));
}
const cell = (t, l) => {
  const s = sum.get(`${t}|${l}`);
  return s && s.n >= 100 ? s.pos / s.n : null;
};
const topBest = cell(4, "◎");
const topWorst = cell(4, "△");
const midBest = cell(2, "◎");
if (topBest != null && topWorst != null) {
  console.log(
    `\n⭐同じ強さの帯（上位20%）の中で、${SURFACE === "dirt" ? "ダート" : "芝"}◎と△の差 ＝ ` +
      `${(topWorst - topBest).toFixed(2)}着（◎${topBest.toFixed(2)}着・△${topWorst.toFixed(2)}着）。` +
      `\n  ここが小さいほど「不得意な馬場でも強い馬が勝つ」状態。`
  );
}
if (topWorst != null && midBest != null) {
  console.log(
    `⭐上位20%の△＝${topWorst.toFixed(2)}着 ／ 中位の◎＝${midBest.toFixed(2)}着 → ` +
      (topWorst < midBest
        ? `強い馬は不得意な馬場でも中位の得意な馬より${(midBest - topWorst).toFixed(2)}着前`
        : `強い馬は不得意な馬場だと中位の得意な馬より${(topWorst - midBest).toFixed(2)}着後ろ`)
  );
}
