// 判断カードの「状況ごとの最善の択の割合」を測る（`devlog/wave16.md`§1-0・§3。内外を入れる前後の比較に使う）。
// 1鞍ごとに、その状況で出る択を全部走らせ（同じ鞍のsimを択の時点でフォーク）、どの択が一番良い着順だったかを数える。
// 最善が複数の択で同着のときは、その択どうしで1/個数ずつ分ける。着順は択ごとの平均着順でも出す。
// 道中は「直線はカード無し」、直線は「道中はカード無し」の状態から測る（夢のダービーの鞍）。
// 見方：状況ごとに「最善になった割合」が一番多い択でも低く、どの択も0にならなければ、正解が表示されていない。
// 使い方： node tools/measure-card-oracle.mjs [鞍の数=200]
import { generateDreamHorse, generateDreamRivals, assignPostPositions, startDreamDerbySim, forkDreamDerbySim } from "../src/domain/dreamDerby.js";
import { choicesFor, dreamSituationId } from "../src/domain/judgmentCard.js";
import { positionBandOf, fieldOrder } from "../src/view/dreamDerbyCommentary.js";
import { D_MID_CARD, D_FINAL_STRETCH } from "../src/data/dreamDerbyCourse.js";

const N = Number(process.argv[2] ?? 200);
const rank = (sim, entries, t) => fieldOrder(entries, (n) => sim.distanceOf(n, t)).findIndex((e) => e.isSelf) + 1;
const posOf = (sim, entries) => sim.order.indexOf(entries.findIndex((e) => e.isSelf)) + 1;

// 状況id -> { n: 出た鞍数, tie: 最善が複数の鞍数, opts: { ラベル -> { best, positions[] } } }
const stats = { mid: {}, stretch: {} };

function measure(phase, sit, base, t, entries) {
  const results = choicesFor(sit).map((c) => ({
    label: c.label,
    pos: posOf(forkDreamDerbySim(base, t, phase, sit, c.id), entries),
  }));
  const s = (stats[phase][sit] ??= { n: 0, tie: 0, opts: {} });
  s.n += 1;
  const best = Math.min(...results.map((r) => r.pos));
  const winners = results.filter((r) => r.pos === best);
  if (winners.length > 1) s.tie += 1;
  for (const r of results) {
    const o = (s.opts[r.label] ??= { best: 0, positions: [] });
    o.positions.push(r.pos);
    if (r.pos === best) o.best += 1 / winners.length;
  }
}

for (let i = 0; i < N; i += 1) {
  const seed = `w${i}`;
  const entries = assignPostPositions(seed, generateDreamHorse(seed), generateDreamRivals(seed));
  const selfNum = entries.find((e) => e.isSelf).num;
  const base = startDreamDerbySim(seed, entries);
  const tMid = base.timeAtDistanceOf(selfNum, D_MID_CARD);
  measure("mid", dreamSituationId("mid", positionBandOf(rank(base, entries, tMid), entries.length)), base, tMid, entries);
  const tStr = base.timeAtDistanceOf(selfNum, D_FINAL_STRETCH);
  measure("stretch", dreamSituationId("stretch", positionBandOf(rank(base, entries, tStr), entries.length)), base, tStr, entries);
}

const pct = (x, n) => ((x / n) * 100).toFixed(1) + "%";
const titles = { mid: "道中（直線はカード無し）", stretch: "直線（道中はカード無し）" };
console.log(`夢のダービー ${N}鞍（シード w0〜w${N - 1}）`);
for (const phase of ["mid", "stretch"]) {
  console.log(`\n${titles[phase]}`);
  for (const sit of Object.keys(stats[phase]).sort()) {
    const s = stats[phase][sit];
    console.log(`  ${sit}  出た${s.n}鞍  最善が複数の択で同着 ${s.tie}鞍(${pct(s.tie, s.n)})`);
    for (const [label, o] of Object.entries(s.opts)) {
      const avg = o.positions.reduce((a, b) => a + b, 0) / o.positions.length;
      console.log(`    ${label.padEnd(14)}最善になった割合${pct(o.best, s.n).padStart(7)}  平均着順${avg.toFixed(2)}  1着${pct(o.positions.filter((p) => p === 1).length, s.n)}`);
    }
  }
}
