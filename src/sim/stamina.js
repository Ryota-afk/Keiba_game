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

/** 記号評価（G〜S+・16段）を0..1へ。 */
export function gradeNorm(grade) {
  return gradeToNumber(grade) / 15;
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

/** 距離適性の式`1/(1+APT_A×x²)`の係数。
 * ⚠️**この値は実測で決まっていない。** 51頭745レースで0.25〜2.0を振っても、距離と成績の
 * 相関は0.18前後でほとんど動かなかった（`devlog/wave04.md`§43）。3200mでの着順差も
 * 0.35や0.25にして0.7着しか変わらない。⭐**罰の強さのつまみとしては働いていない**ので、
 * 触るなら`APT_UNDER_SCALE`か幅の式のほうを動かすこと。 */
const APT_A = 0.5;
/** 適正距離より短い方向の幅の倍率。
 * ⚠️⚠️**1頭に合わせて決めないこと**（一度ディープインパクト1頭から逆算して失敗した）。
 * ⭐1.2は**3歳以上の勝ち鞍**で決めた値：1.6だと適正帯の下限が1400m以下になる馬が
 * 51頭中33頭も出るが、3歳以上の勝ち鞍に1400m以下は1鞍も無い。1.2にすると2頭まで減り、
 * 勝ち鞍が適正帯に入る割合は98.3%を保つ（3000m級に限れば93%→100%）。
 * ⚠️**柔軟性の幅の式（`aptitudeWidth`）を動かしても、この問題は直らない**（実測）。
 * 手順は`arch/historical-horses.md`§2。 */
const APT_UNDER_SCALE = 1.2;
/** 適性が0.9になるxの値（`1/(1+APT_A×x²)=0.9`を解いたもの）。適正帯の表示にも使う。 */
const APT_X90 = Math.sqrt((1 / 0.9 - 1) / APT_A);
/** `shortfallOf`が1に達するのに必要な、幅に対する外れ幅の割合（スピード0のとき）。 */
const SHORTFALL_FULL_BASE = 0.45;
/** スピード1.0のとき、上の割合がどれだけ小さくなるか（＝速い馬ほど1に達しやすい）。 */
const SHORTFALL_FULL_SPEED = 0.45;
/** `shortfallOf`の上限。1.0で頭打ちにすると1000m級で複数の馬が同値に張り付く
 * （`devlog/wave04.md`§40-2）。 */
const SHORTFALL_MAX = 1.5;

/**
 * その馬の適正距離の中央値（m・**100m単位**）。⭐スタミナが決める
 * （`design/winning-post-race-model.md`）。
 * ⚠️2026-09-07にユーザー指示で100m単位へ丸めた。⭐**丸めてもスタミナ1点の効きは消えない**
 * ——スタミナは`staminaCapacity`（消耗の分母）にも直接入っており、そちらは1点ごとに
 * 0.0042動く。丸めで止まるのは適正距離の側だけ（`devlog/wave04.md`§42）。
 */
export function optimalDistance(horse) {
  // ⚠️⚠️**この値を「全レースの重み付き平均距離」に合わせてはいけない。**
  // 2026-09-07に一度`900 + 18×スタミナ`へ較正したが、⭐**ダービー馬51頭のうち10頭で
  // 2400mが適正帯の外に出た**（51頭全員が2400mを勝っているのに）。平均距離は
  // 2〜3歳時の1600〜2000m戦の本数に引っ張られるだけで、適性を測っていない。
  // ⭐**合わせる先は3歳以上の勝ち鞍**。⚠️2歳戦を入れてはいけない——51頭の1400m以下の
  // 勝ち鞍13鞍は**全部2歳時**で、うち12鞍が新馬・未勝利戦だった。当時のデビュー戦が
  // 短かっただけで、完成後の距離適性の証拠にならない（能力値はウイポの完成時の値）。
  // 3歳以上の最短の勝ち鞍は1600mで、1400m以下は1鞍も無い。
  const raw = 1100 + normalizedAbilities(horse).stamina * 2000; // 1100〜3100m
  return Math.round(raw / 100) * 100;
}

/** 適正距離が取りうる下限（m）。JRAの最短が1000m。 */
const APT_MIN_DISTANCE = 1000;
/** 適正距離が取りうる上限（m）。 */
const APT_MAX_DISTANCE = 4000;

/** その馬の適正距離の「幅」（m）。⭐柔軟性が決める。
 * ⚠️2026-09-07にユーザー指示で上限を1300m→1600mへ広げた。 */
export function aptitudeWidth(horse) {
  return 400 + normalizedAbilities(horse).flexibility * 1200; // 400〜1600m
}

/** 適正帯の下端（丸める前・m）。短距離側の不利がここから立ち上がる（`shortfallOf`と共有）。
 * ⚠️`APT_MIN_DISTANCE`で頭打ちにする——表示と、不利が始まる距離を同じ数字から出すため。 */
function aptitudeLowerBound(horse) {
  const raw = optimalDistance(horse) - APT_X90 * APT_UNDER_SCALE * aptitudeWidth(horse);
  return Math.max(APT_MIN_DISTANCE, raw);
}

/**
 * その馬の距離適性（1.0が完全に噛み合った状態）。
 * ⭐スタミナが最適距離を、柔軟性がその「幅」を決める。
 * ⭐**非対称**：短い方向は`APT_UNDER_SCALE`倍の幅で緩やかに、長い方向はそのまま厳しく。
 * ⚠️2026-09-07に下限0.7のクランプを撤廃した（`devlog/wave04.md`§40-2：16段のうち
 * 下から12段が0.700に潰れ、3200mで柔軟性G〜S+の着順差が0.00着になっていた）。
 * @param {object} horse
 * @param {number} raceDistance - m
 * @returns {number} 0超〜1.0
 */
export function distanceAptitude(horse, raceDistance) {
  const optimal = optimalDistance(horse);
  const width = aptitudeWidth(horse);
  const over = raceDistance > optimal;
  const x = over
    ? (raceDistance - optimal) / width
    : (optimal - raceDistance) / (width * APT_UNDER_SCALE);
  return 1 / (1 + APT_A * x * x);
}

/**
 * 消耗（脚の総量）に使う適性。⚠️2026-09-07：短い側では1.0固定にする
 * （`devlog/wave04.md`§40-2）。短い距離での不利は`shortfallOf`が道中の位置取りと
 * 直線の最高速度に反映する担当で、脚の総量まで削ると「短距離なのに息が上がる」逆の絵になる。
 * @returns {number} 0超〜1.0
 */
export function staminaAptitude(horse, raceDistance) {
  return raceDistance <= optimalDistance(horse) ? 1 : distanceAptitude(horse, raceDistance);
}

/**
 * 適正帯（表示用・100m単位）。最適距離自体も100m単位（`optimalDistance`）。
 * ⚠️帯の端は`APT_MIN_DISTANCE`〜`APT_MAX_DISTANCE`で頭打ちにする。
 * @returns {[number, number]} [下限, 上限]（m）
 */
export function aptitudeBand(horse) {
  const optimal = optimalDistance(horse);
  const width = aptitudeWidth(horse);
  const lo = aptitudeLowerBound(horse);
  const hi = Math.min(APT_MAX_DISTANCE, optimal + APT_X90 * width);
  return [Math.round(lo / 100) * 100, Math.round(hi / 100) * 100];
}

/**
 * 適正帯の下限をどれだけ下回るか（0＝下回っていない）。道中の位置取りと直線の
 * 最高速度に効かせる（`sim/raceSim.js`）。⚠️丸める前の下限を使う——表示の丸めが
 * 不利の発生距離とずれないようにするため。
 * @returns {number} 0〜`SHORT_MAX`
 */
export function shortfallOf(horse, raceDistance) {
  const lo = aptitudeLowerBound(horse);
  if (raceDistance >= lo) return 0;
  const width = aptitudeWidth(horse);
  const speedNorm = normalizedAbilities(horse).speed;
  const raw = (lo - raceDistance) / width / (SHORTFALL_FULL_BASE + SHORTFALL_FULL_SPEED * speedNorm);
  return Math.min(SHORTFALL_MAX, raw);
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
