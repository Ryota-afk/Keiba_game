// レース傾向（ARCHITECTURE.md §5 →`arch/race-sim.md`「⭐⭐レース傾向（前作の罠への答え・2段目）」）。
// 純関数のみ（DOM・JSX無し＝Node単体で計測できる）。依存は`data/`と`core/`だけ。
//
// ⭐このファイルが担うのは1つだけ——「馬群の中の相互作用を1つの変数に集約する」こと。
// 出走馬の脚質構成（逃げ馬の頭数・先行馬の頭数・出走頭数）から、そのレースが
// 瞬発戦／持久戦／消耗戦／総合戦のどれになるかと、その強度（究極>超>無印）を決める。
// 決まった傾向は「道中の全馬共通のペース倍率」と「各馬の適応度」の2経路で着順に効く。

import { streamRandom, RNG_STREAMS, weightedPick } from "../core/rng.js";

/** レース傾向のキー。`domain/horse.js`の`adaptability`のキーと揃えてある（balancedだけ適応が無い）。 */
export const TREND_KEYS = Object.freeze(["burst", "endurance", "attrition", "balanced"]);

/** 強度（0=無印／1=超／2=究極）。強いほどペースの偏りが大きく、適応度の差が開く。 */
export const TREND_INTENSITY_MAX = 2;

/**
 * レースごとの「なりやすさ」の重み。日本ダービーは瞬発戦●
 * （`design/winning-post-race-model.md`「大レース傾向」）なのでburstを厚くする。
 */
export const DERBY_TREND_BASE = Object.freeze({
  burst: 3.0,
  endurance: 1.0,
  attrition: 0.6,
  balanced: 1.0,
});

/**
 * 脚質構成からペースの速さの指標を出す。正なら速い（消耗・持久寄り）、負なら遅い（瞬発寄り）。
 * @param {string[]} strategies - 出走各馬の宣言脚質（"nige"|"senko"|"sashi"|"oikomi"）
 * @returns {number} -1.2〜1.6
 */
export function paceScoreOf(strategies) {
  const fieldSize = strategies.length || 1;
  let nige = 0;
  let senko = 0;
  for (const s of strategies) {
    if (s === "nige") nige += 1;
    else if (s === "senko") senko += 1;
  }
  // ⚠️基準を「頭数の25%」に置いているのは、今の`domain/strategy.js`の`deriveFavoredStrategy`が
  // 4脚質をほぼ均等（各25%）に配るため。実際の競馬の逃げ馬は1〜3頭で、この導出は現実より
  // 逃げ馬が多い。脚質の導出を実態に寄せたら、この基準値も一緒に直すこと。
  const raw =
    1.8 * (nige / fieldSize - 0.25) +
    0.7 * (senko / fieldSize - 0.25) +
    0.035 * (fieldSize - 16);
  return Math.max(-1.2, Math.min(1.6, raw));
}

/**
 * そのレースの傾向を決める。自己完結の純関数（seed・raceKeyが同じなら常に同じ結果）。
 * ⚠️着順に効く乱数なので`RNG_STREAMS.SIM`を使う（演出用の`viewHash01`とは別系統）。
 * @param {object} opts
 * @param {number|string} opts.seed
 * @param {string} opts.raceKey
 * @param {string[]} opts.strategies
 * @param {object} [opts.base] - レースごとの「なりやすさ」。既定は`DERBY_TREND_BASE`
 * @returns {{ key: string, intensity: number, paceScore: number, share: number }}
 */
export function decideRaceTrend({ seed, raceKey, strategies, base = DERBY_TREND_BASE }) {
  const paceScore = paceScoreOf(strategies);
  const weights = {
    burst: base.burst * Math.exp(-0.9 * paceScore),
    endurance: base.endurance * Math.exp(0.5 * paceScore),
    attrition: base.attrition * Math.exp(0.9 * paceScore),
    balanced: base.balanced,
  };
  const total = TREND_KEYS.reduce((sum, k) => sum + weights[k], 0);
  const rand01 = streamRandom(seed, RNG_STREAMS.SIM, raceKey, "trend");
  const key = weightedPick(rand01, weights);
  const share = weights[key] / total;
  const intensity = share >= 0.55 ? 2 : share >= 0.38 ? 1 : 0;
  return { key, intensity, paceScore, share };
}

// 道中の共通ペース倍率のアンカー（u＝レース全体の進捗0..1）。
// 直線（u>0.75）は各馬が自分の脚で走るので、この表は道中までを支配する。
const PACE_ANCHORS = Object.freeze({
  // 瞬発戦：道中は遅く、最後だけ上がる
  burst: [[0, 1.03], [0.25, 0.96], [0.55, 0.93], [0.75, 0.97], [1, 1.0]],
  // 持久戦：中盤からずっと上がり続ける
  endurance: [[0, 0.99], [0.25, 0.98], [0.55, 1.02], [0.75, 1.06], [1, 1.05]],
  // 消耗戦：スタートから速く、後半は落ちる
  attrition: [[0, 1.08], [0.25, 1.06], [0.55, 1.02], [0.75, 0.99], [1, 0.97]],
  // 総合戦：平坦
  balanced: [[0, 1.01], [0.25, 1.0], [0.55, 1.0], [0.75, 1.0], [1, 1.0]],
});

// 各プロファイルのレース全体の平均（台形積分）。⚠️これで割ってから使うことで、
// 「傾向が違ってもレース全体の平均ペースは1.0」に揃える。揃えないと瞬発戦（道中が遅い）だけ
// 勝ちタイムが6秒遅くなり、ゴールタイムの帯（141〜148秒）に収まらなくなる（実測）。
const PACE_MEAN = Object.fromEntries(
  Object.entries(PACE_ANCHORS).map(([key, anchors]) => {
    let sum = 0;
    for (let i = 1; i < anchors.length; i += 1) {
      sum += ((anchors[i - 1][1] + anchors[i][1]) / 2) * (anchors[i][0] - anchors[i - 1][0]);
    }
    return [key, sum];
  })
);

/**
 * 道中の全馬共通のペース倍率（1.0＝基準タイムどおり）。
 * @param {{key:string,intensity:number}} trend
 * @param {number} u - レース全体の進捗（0..1）
 */
export function paceMultiplierAt(trend, u) {
  const key = PACE_ANCHORS[trend.key] ? trend.key : "balanced";
  const anchors = PACE_ANCHORS[key];
  const x = Math.max(0, Math.min(1, u));
  let p = anchors[anchors.length - 1][1];
  for (let i = 1; i < anchors.length; i += 1) {
    const [ua, va] = anchors[i - 1];
    const [ub, vb] = anchors[i];
    if (x <= ub) {
      p = va + (vb - va) * ((x - ua) / (ub - ua));
      break;
    }
  }
  return 1 + (p / PACE_MEAN[key] - 1) * (0.7 + 0.35 * trend.intensity);
}

/**
 * その馬のレース傾向への適応度（1.0が標準）。`domain/horse.js`の`adaptability`
 * （burst/endurance/attritionの3つ。血統から初期値1つ、残りはレースで育つ）を読む。
 * 総合戦（balanced）は3つの平均を見る。
 * ⚠️強度が高いほど適応の有無で差が開く（究極>超>無印）。
 * @param {object} horse
 * @param {{key:string,intensity:number}} trend
 * @returns {number} 0.75〜1.0（適応の上限は当面2とみなす）
 */
export function trendAdaptationOf(horse, trend) {
  const a = horse.adaptability ?? { burst: 0, endurance: 0, attrition: 0 };
  const raw =
    trend.key === "balanced" ? (a.burst + a.endurance + a.attrition) / 3 : (a[trend.key] ?? 0);
  const norm = Math.max(0, Math.min(1, raw / 2)); // 適応能力の当面の上限を2として正規化
  const spread = 0.16 + 0.1 * trend.intensity;
  return 1 + (norm - 0.5) * spread;
}
