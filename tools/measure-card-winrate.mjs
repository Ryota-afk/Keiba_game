// 夢のダービーの判断カードの1着率を測る（CLAUDE.md §10「機能追加と計測はセット」）。
//
// ⭐何を測るか：道中4択×直線4択＝16通りの選び方それぞれについて、シード（ゲーム開始）を
// 変えながら夢のダービーを走らせ、プレイヤーの馬が1着になった割合を出す。
// ⭐目安は**一番良い選び方7〜8割・一番悪い選び方2〜3割**（`devlog/wave05.md`§57で確定）。
// ここが7割を切ると「うまく選んでも勝てない」、3割を上回ると「適当でも勝てる」になる。
//
// ⚠️simの中身（基準速度・消耗・カードの移動量）を触ったら毎回これを回すこと。
// 使い方： node tools/measure-card-winrate.mjs [シードの数]

import {
  generateDreamHorse,
  generateDreamRivals,
  assignPostPositions,
  startDreamDerbySim,
  forkDreamDerbySim,
} from "../src/domain/dreamDerby.js";
import { choicesFor, dreamSituationId } from "../src/domain/judgmentCard.js";
import { positionBandOf, fieldOrder } from "../src/view/dreamDerbyCommentary.js";
import { D_MID_CARD, D_FINAL_STRETCH } from "../src/data/dreamDerbyCourse.js";

const SEEDS = Number(process.argv[2] ?? 200);

/** その馬が距離`d`を通過した時刻(秒)。 */
function timeAt(sim, num, d) {
  return sim.timeAtDistanceOf(num, d) ?? 0;
}

function selfRankAt(sim, entries, t) {
  const order = fieldOrder(entries, (num) => sim.distanceOf(num, t));
  return order.findIndex((e) => e.isSelf) + 1;
}

function runOne(seed, midIdx, stretchIdx) {
  const entries = assignPostPositions(seed, generateDreamHorse(seed), generateDreamRivals(seed));
  const selfNum = entries.find((e) => e.isSelf).num;
  let sim = startDreamDerbySim(seed, entries);

  const tMid = timeAt(sim, selfNum, D_MID_CARD);
  const midBand = positionBandOf(selfRankAt(sim, entries, tMid), entries.length);
  const midSit = dreamSituationId("mid", midBand);
  const midChoices = choicesFor(midSit);
  sim = forkDreamDerbySim(sim, tMid, "mid", midSit, midChoices[midIdx % midChoices.length].id);

  const tStr = timeAt(sim, selfNum, D_FINAL_STRETCH);
  const strBand = positionBandOf(selfRankAt(sim, entries, tStr), entries.length);
  const strSit = dreamSituationId("stretch", strBand);
  const strChoices = choicesFor(strSit);
  sim = forkDreamDerbySim(sim, tStr, "stretch", strSit, strChoices[stretchIdx % strChoices.length].id);

  const selfIdx = entries.findIndex((e) => e.isSelf);
  return sim.order[0] === selfIdx;
}

const rates = [];
for (let m = 0; m < 4; m += 1) {
  for (let s = 0; s < 4; s += 1) {
    let win = 0;
    for (let i = 0; i < SEEDS; i += 1) if (runOne(`w${i}`, m, s)) win += 1;
    rates.push({ m, s, rate: (win / SEEDS) * 100 });
  }
}
rates.sort((a, b) => b.rate - a.rate);
console.log(`シード${SEEDS}通り × 16通りの選び方`);
for (const r of rates) {
  console.log(`  道中${r.m + 1}・直線${r.s + 1}  ${r.rate.toFixed(1)}%`);
}
const avg = rates.reduce((x, r) => x + r.rate, 0) / rates.length;
console.log(
  `\n一番良い選び方 ${rates[0].rate.toFixed(1)}%  ／  適当に選ぶ ${avg.toFixed(1)}%  ／  ` +
    `一番悪い選び方 ${rates[rates.length - 1].rate.toFixed(1)}%  （目安：7〜8割／—／2〜3割）`
);
