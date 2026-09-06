// 消耗（脚の減り方）の計算（`arch/race-sim.md`「⭐⭐能力差が着順に変わる場所」）。
// 純関数のみ（DOM・JSX無し）。依存は`data/`だけ。
//
// ⭐この式が本作のレースsimの心臓部。「道中は隊列で流れて速度差が出ないが、
// 同じ速度を保つのに使うスタミナが馬ごとに違う」——差は道中に溜まり、直線で開く。
// 前作`Roadrace_Game`が10年見落とした「集団内では全員が同速で能力が捨てられる」罠への答え。

import { gradeToNumber } from "../data/grades.js";

/** 定量58kg（日本ダービーはGⅠなので定量。`arch/race-sim.md`「斤量」）。 */
export const REFERENCE_WEIGHT_KG = 58;
/** 斤量の基準（この重さのとき係数1.0）。 */
export const NEUTRAL_WEIGHT_KG = 55;
/**
 * 1kgあたりの消耗増（2400m基準の仮値）。⚠️距離が長いほど1kgが効く
 * （`arch/race-sim.md`：JRAの年齢減量表が1400m未満7kg・2200m以上10kgと差をつけている）。
 * ⚠️斤量システム本体は未実装（`TODO.md` #20）。ここでは項だけ用意し、全馬58kg固定で通す。
 */
export const WEIGHT_DRAIN_PER_KG = 0.012;

/** 消耗の基準量（1秒あたり・係数がすべて1.0のとき）。 */
export const DRAIN_BASE = 0.0030;

/** 記号評価（G〜S）を0..1へ。 */
export function gradeNorm(grade) {
  return gradeToNumber(grade) / 7;
}

/** 馬の9軸を0..1の数値へ揃える（simの計算式が使う形）。 */
export function normalizedAbilities(horse) {
  const a = horse.abilities;
  return {
    speed: a.speed / 100,
    stamina: a.stamina / 100,
    sharpness: gradeNorm(a.sharpness),
    grit: gradeNorm(a.grit),
    flexibility: gradeNorm(a.flexibility),
    wisdom: gradeNorm(a.wisdom),
    health: gradeNorm(a.health),
    power: gradeNorm(a.power),
    mentalStrength: gradeNorm(a.mentalStrength),
  };
}

/**
 * その馬の距離適性（1.0が完全に噛み合った状態）。
 * ⭐スタミナが最適距離を、柔軟性がその「幅」を決める（`design/winning-post-race-model.md`）。
 * ⭐**非対称**：最適より短い方向には寛容、長い方向には厳しい（同資料の「上限を超えると
 * 途端に厳しくなり、直線辺りで垂れてしまう」）。
 * @param {object} horse
 * @param {number} raceDistance - m
 * @returns {number} 0.55〜1.0
 */
export function distanceAptitude(horse, raceDistance) {
  const n = normalizedAbilities(horse);
  const optimal = 1000 + n.stamina * 2000; // 1000〜3000m
  const width = 400 + n.flexibility * 900; // ±400〜1300m
  const over = raceDistance > optimal;
  const x = Math.min(1.5, Math.abs(raceDistance - optimal) / (over ? width : width * 1.6));
  return Math.max(0.7, Math.min(1, 1 - 0.5 * x * x));
}

/**
 * 消耗式の分母（＝その馬が「同じ速度を保つ」ときの余裕）。
 * `arch/race-sim.md`／`devlog/wave04.md`§27の式そのまま：0.4 + 0.6 × スタミナ × 距離適性 × 傾向への適応。
 * @returns {number} 0.4〜1.0
 */
export function staminaCapacity({ staminaNorm, distanceApt, trendAdaptation }) {
  // ⚠️スタミナには下駄（0.3）を履かせる。素の0〜1をそのまま掛けると、スタミナの低い馬が
  // 道中の半ばで脚を使い切って100m以上ちぎれ、18頭が1画面に収まらなくなる（実測で確認）。
  const sta = 0.3 + 0.7 * Math.max(0, Math.min(1, staminaNorm));
  return 0.4 + 0.6 * sta * distanceApt * trendAdaptation;
}

/** 斤量係数（重いほど消耗が大きい）。距離が長いほど1kgが効く。 */
export function weightFactor(weightKg, raceDistance) {
  const distanceScale = 0.6 + 0.4 * (raceDistance / 2400);
  return 1 + WEIGHT_DRAIN_PER_KG * (weightKg - NEUTRAL_WEIGHT_KG) * distanceScale;
}

/**
 * 位置係数（先頭に近いほど消耗が大きい＝風を受ける）。
 * @param {number} gapBehindLeader - 先頭との差(m)
 */
export function positionFactor(gapBehindLeader) {
  const x = Math.max(0, Math.min(1, gapBehindLeader / 30));
  return 1.18 - 0.28 * x;
}

/**
 * 1秒あたりの脚の減り（0..1の`energy`から引く量）。
 * ⭐速度の3乗で効く——道中で前に行けば行くほど、直線で追えば追うほど加速度的に減る。
 * @param {object} opts
 * @param {number} opts.paceRatio - その馬の現在速度 ÷ 基準速度
 * @param {number} opts.positionFactor
 * @param {number} opts.weightFactor
 * @param {number} opts.capacity - `staminaCapacity`の値
 * @param {number} [opts.effortMultiplier] - 判断カードの積極性による上乗せ（1.0が中立）
 */
export function drainPerSecond({
  paceRatio,
  positionFactor: pos,
  weightFactor: wt,
  capacity,
  effortMultiplier = 1,
}) {
  const p = Math.max(0, paceRatio);
  return (DRAIN_BASE * p * p * p * pos * wt * effortMultiplier) / capacity;
}
