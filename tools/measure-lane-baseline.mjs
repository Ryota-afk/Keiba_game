// 内外（馬の左右の位置）を入れる前後の比較に使う、レースの結果の基準値（`devlog/wave16.md`§3・CLAUDE.md §10）。
// 世界の全レース（プレイヤーが乗る鞍も含む）を、1974年開始・初期値s1〜s3・26週ぶん回して、
// ①馬番ごとの勝率 ②脚質ごとの勝率 ③勝ちタイム（距離ごとの中央値）④プレイヤーの勝率 を出す。
// ⚠️勝率の「期待値」は 1/頭数 の平均（運だけなら全馬番がこの値になる）。馬番ごとに「勝率÷期待値」も出す。
// 使い方： node tools/measure-lane-baseline.mjs [週数=26] [シード数=3]
import { bootstrapRoster } from "../src/domain/bootstrap.js";
import { createPlayer } from "../src/domain/player.js";
import { advanceWeek } from "../src/domain/weekLoop.js";
import { setRaceObserver } from "../src/domain/raceRun.js";

const WEEKS = Number(process.argv[2] ?? 26);
const SEEDS = Number(process.argv[3] ?? 3);
const YEAR = 1974;
const STRATS = ["nige", "senko", "sashi", "oikomi"];

const byNum = Array.from({ length: 19 }, () => ({ runs: 0, wins: 0, exp: 0 }));
const byStrat = Object.fromEntries(STRATS.map((s) => [s, { runs: 0, wins: 0, exp: 0 }]));
const times = {}; // `${surface}${distance}` -> number[]
const self = { runs: 0, wins: 0, exp: 0 };
let races = 0, starts = 0;

setRaceObserver(({ race, entries, plan, sim }) => {
  races += 1;
  const n = entries.length;
  const winner = entries[sim.winnerIndex];
  starts += n;
  for (const e of entries) {
    const b = byNum[e.num] ?? (byNum[e.num] = { runs: 0, wins: 0, exp: 0 });
    b.runs += 1; b.exp += 1 / n;
    const s = byStrat[plan.strategies[e.num]];
    if (s) { s.runs += 1; s.exp += 1 / n; }
    if (e.isSelf) { self.runs += 1; self.exp += 1 / n; }
  }
  byNum[winner.num].wins += 1;
  const ws = byStrat[plan.strategies[winner.num]];
  if (ws) ws.wins += 1;
  if (winner.isSelf) self.wins += 1;
  (times[`${race.surface}${race.distance}`] ??= []).push(sim.winnerTime);
});

for (let k = 1; k <= SEEDS; k += 1) {
  const seed = `s${k}`;
  let { roster } = bootstrapRoster(seed, YEAR);
  let player = createPlayer(seed, { stableId: roster.stables[0].id, startYear: YEAR });
  for (let w = 0; w < WEEKS; w += 1) {
    const res = advanceWeek(seed, roster, player);
    roster = res.roster; player = res.player;
  }
}
setRaceObserver(null);

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "-");
console.log(`1974年開始・s1〜s${SEEDS}・${WEEKS}週：${races}レース・延べ${starts}走`);
console.log("\n馬番  出走    勝ち   勝率   期待(1/頭数の平均)  勝率÷期待");
for (let i = 1; i < byNum.length; i += 1) {
  const b = byNum[i]; if (!b || !b.runs) continue;
  console.log(`${String(i).padStart(3)}${String(b.runs).padStart(8)}${String(b.wins).padStart(7)}${pct(b.wins, b.runs).padStart(8)}${pct(b.exp, b.runs).padStart(14)}${(b.wins / b.exp).toFixed(2).padStart(14)}`);
}
console.log("\n脚質     出走    勝ち   勝率   期待   勝率÷期待");
for (const s of STRATS) {
  const b = byStrat[s];
  console.log(`${s.padEnd(8)}${String(b.runs).padStart(6)}${String(b.wins).padStart(7)}${pct(b.wins, b.runs).padStart(8)}${pct(b.exp, b.runs).padStart(8)}${(b.wins / b.exp).toFixed(2).padStart(9)}`);
}
console.log(`\nプレイヤー  出走${self.runs}  勝ち${self.wins}  勝率${pct(self.wins, self.runs)}  期待${pct(self.exp, self.runs)}`);
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log("\n勝ちタイムの中央値（馬場+距離  本数  秒）");
for (const k of Object.keys(times).sort()) console.log(`  ${k.padEnd(10)}${String(times[k].length).padStart(5)}  ${med(times[k]).toFixed(1)}`);
