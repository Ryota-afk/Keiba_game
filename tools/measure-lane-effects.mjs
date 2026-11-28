// 内外（馬の横の位置）が結果をどう動かしたかを測る（`devlog/wave16.md`§6・CLAUDE.md §10）。
// 世界の全レース（プレイヤーの鞍も含む）を1974年開始で回し、
// ①コース別の馬番（内枠・外枠）ごとの勝率 ②コーナーで余分に走った距離の分布（脚質別・馬番別）
// ③詰まっていた秒数の分布（脚質別・直線入口の筋別） ④直線入口の筋ごとの勝率 を出す。
// ⚠️横の位置を持たない古いsimで回したときは①だけを出す（前後の比較用）。
// 使い方： node tools/measure-lane-effects.mjs [週数=52] [シード数=4]
import { bootstrapRoster } from "../src/domain/bootstrap.js";
import { createPlayer } from "../src/domain/player.js";
import { advanceWeek } from "../src/domain/weekLoop.js";
import { setRaceObserver } from "../src/domain/raceRun.js";

const WEEKS = Number(process.argv[2] ?? 52);
const SEEDS = Number(process.argv[3] ?? 4);
const YEAR = 1974;
const STRATS = ["nige", "senko", "sashi", "oikomi"];
const LANE = 1.1;
// 馬番の組（内枠1〜4・5〜8・9〜12・13〜）。
const postGroup = (num) => (num <= 4 ? 0 : num <= 8 ? 1 : num <= 12 ? 2 : 3);
const POST_LABEL = ["1〜4番", "5〜8番", "9〜12番", "13番〜"];
// 直線入口（残り600m）の筋＝内ラチから何頭目（1＝ラチ沿い）。
const laneIndex = (x) => Math.min(5, Math.floor(x / LANE + 0.5) + 1);

const byCourse = {}; // key -> { races, post: [{runs,wins,exp}x4] }
const extraByStrat = Object.fromEntries(STRATS.map((s) => [s, []]));
const extraByPost = [[], [], [], []];
const blockedByStrat = Object.fromEntries(STRATS.map((s) => [s, { total: [], stretch: [] }]));
const byLane = Array.from({ length: 6 }, () => ({ runs: 0, wins: 0, exp: 0, stretchBlocked: [] }));
// ⑤ 直線入口で中団（順位が頭数の1/3〜2/3）かつラチ沿い（1頭目）の馬が、直線で詰まった割合（ユーザー決定Q3の目安4割と見比べる）。
const midRail = { runs: 0, blocked: 0, wins: 0, exp: 0 };
let races = 0;
let hasLane = false;
let simMs = 0;

setRaceObserver(({ race, entries, plan, sim }) => {
  races += 1;
  const n = entries.length;
  const key = `${race.courseId}:${race.surface}:${race.distance}`;
  const c = (byCourse[key] ??= { races: 0, post: Array.from({ length: 4 }, () => ({ runs: 0, wins: 0, exp: 0 })) });
  c.races += 1;
  const winnerNum = entries[sim.winnerIndex].num;
  for (const e of entries) {
    const p = c.post[postGroup(e.num)];
    p.runs += 1;
    p.exp += 1 / n;
    if (e.num === winnerNum) p.wins += 1;
  }
  if (!sim.lateralOf) return;
  hasLane = true;
  const tLead = sim.timeAtDistanceOf(winnerNum, race.distance - 600);
  const rankAt = new Map();
  if (tLead != null) {
    entries
      .map((e) => [e.num, sim.distanceOf(e.num, tLead)])
      .sort((a, b) => b[1] - a[1])
      .forEach(([num], k) => rankAt.set(num, k));
  }
  entries.forEach((e, i) => {
    const s = plan.strategies[e.num];
    extraByStrat[s]?.push(sim.extraMeters[i]);
    extraByPost[postGroup(e.num)].push(sim.extraMeters[i]);
    blockedByStrat[s]?.total.push(sim.blockedSeconds[i]);
    blockedByStrat[s]?.stretch.push(sim.blockedStretchSeconds[i]);
    const tIn = sim.timeAtDistanceOf(e.num, race.distance - 600);
    if (tIn != null) {
      const l = byLane[laneIndex(sim.lateralOf(e.num, tIn))];
      l.runs += 1;
      l.exp += 1 / n;
      if (e.num === winnerNum) l.wins += 1;
      l.stretchBlocked.push(sim.blockedStretchSeconds[i]);
      const rk = rankAt.get(e.num);
      if (rk != null && rk >= n / 3 && rk < (2 * n) / 3 && laneIndex(sim.lateralOf(e.num, tIn)) === 1) {
        midRail.runs += 1;
        midRail.exp += 1 / n;
        if (sim.blockedStretchSeconds[i] > 0) midRail.blocked += 1;
        if (e.num === winnerNum) midRail.wins += 1;
      }
    }
  });
});

const t0 = performance.now();
for (let k = 1; k <= SEEDS; k += 1) {
  const seed = `s${k}`;
  let { roster } = bootstrapRoster(seed, YEAR);
  let player = createPlayer(seed, { stableId: roster.stables[0].id, startYear: YEAR });
  for (let w = 0; w < WEEKS; w += 1) {
    const res = advanceWeek(seed, roster, player);
    roster = res.roster;
    player = res.player;
  }
}
simMs = performance.now() - t0;
setRaceObserver(null);

const q = (xs, p) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : NaN);
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "-");
const pct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(0) + "%" : "-");

console.log(`1974年開始・s1〜s${SEEDS}・${WEEKS}週：${races}レース（${(simMs / 1000).toFixed(1)}秒）`);
console.log("\n① コース別・馬番の組ごとの勝率÷期待（本数80以上のコース。括弧は勝ち数）");
console.log(`  コース                    本数   ${POST_LABEL.map((l) => l.padStart(12)).join("")}`);
for (const [key, c] of Object.entries(byCourse).sort((a, b) => b[1].races - a[1].races)) {
  if (c.races < 80) continue;
  console.log(
    `  ${key.padEnd(24)}${String(c.races).padStart(6)}  ` +
      c.post.map((p) => (p.runs ? `${(p.wins / p.exp).toFixed(2)}(${p.wins})` : "-").padStart(12)).join("")
  );
}
if (!hasLane) process.exit(0);

console.log("\n② コーナーで余分に走った距離(m)：中央値／90%点／最大");
for (const s of STRATS) {
  const xs = extraByStrat[s];
  console.log(`  ${s.padEnd(7)} ${String(xs.length).padStart(7)}走  ${f1(q(xs, 0.5)).padStart(6)} ${f1(q(xs, 0.9)).padStart(6)} ${f1(q(xs, 1)).padStart(6)}`);
}
POST_LABEL.forEach((l, g) => {
  const xs = extraByPost[g];
  console.log(`  ${l.padEnd(7)} ${String(xs.length).padStart(7)}走  ${f1(q(xs, 0.5)).padStart(6)} ${f1(q(xs, 0.9)).padStart(6)} ${f1(q(xs, 1)).padStart(6)}`);
});

console.log("\n③ 詰まっていた秒数：レース全体の平均／直線で詰まった割合／直線で詰まった馬の中央値・90%点");
for (const s of STRATS) {
  const b = blockedByStrat[s];
  const st = b.stretch.filter((v) => v > 0);
  console.log(
    `  ${s.padEnd(7)} 平均${f1(mean(b.total)).padStart(6)}秒  直線で詰まった${pct(share(b.stretch, (v) => v > 0)).padStart(5)}  中央値${f1(q(st, 0.5)).padStart(5)}秒  90%点${f1(q(st, 0.9)).padStart(5)}秒`
  );
}

console.log("\n④ 直線入口（残り600m）の筋ごと：走った数・勝率÷期待・直線で詰まった割合");
for (let l = 1; l <= 5; l += 1) {
  const b = byLane[l];
  console.log(
    `  ${l === 5 ? "5頭目〜" : l + "頭目"}  ${String(b.runs).padStart(7)}走  勝率÷期待${(b.wins / b.exp).toFixed(2).padStart(6)}（${b.wins}勝）  直線で詰まった${pct(share(b.stretchBlocked, (v) => v > 0)).padStart(5)}`
  );
}
console.log(
  `\n⑤ 直線入口で中団・ラチ沿いの馬：${midRail.runs}走  直線で詰まった${pct(midRail.blocked / midRail.runs)}  勝率÷期待${(midRail.wins / midRail.exp).toFixed(2)}（${midRail.wins}勝）`
);
