// レースsim本体（`arch/race-sim.md`／`devlog/wave04.md`§27）。
// 純関数のみ（DOM・JSX無し＝Node単体で計測できる）。依存は`data/`・`core/`・`sim/`だけ。
//
// ⭐4段のモデル：発走 → 位置取り → 道中 → 直線。
//   1. 発走：`dash = 0.5×speed + 0.3×power + 0.2×精神力 + 乱数`で加速の速さが決まる
//   2. 位置取り：宣言脚質ごとの「先頭からの目標差(m)」へ寄る
//   3. 道中：レース傾向が全馬共通のペースを決め、ペースが各馬の消耗を決める。
//      ⭐同じ速度で走っていても1秒あたりに減る脚が馬ごとに違う（`sim/stamina.js`）
//   4. 直線：残りの脚と瞬発力で出せる速度が決まる。脚が尽きた馬は基準速度を下回る（垂れる）
//
// ⚠️着順に効く乱数は`RNG_STREAMS.SIM`だけを使う。演出（隊列の揺らぎ・内外）に使う
// `viewHash01`（`view/dreamDerbyRace.js`）とは完全に別系統にすること——前作`Roadrace_Game`は
// 着順用のハッシュを演出へ流用して集団が規則的に動いて見えた（`arch/race-sim.md`）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { parSecondsFor } from "../data/parTimes.js";
import { surfaceFactorFor } from "../data/surfaceAptitude.js";
import { mudFactorFor } from "../data/mudAptitude.js";
import { decideRaceTrend, paceMultiplierAt, trendAdaptationOf, DERBY_TREND_BASE } from "./pace.js";
import {
  normalizedAbilities,
  staminaAptitude,
  distanceAptitude,
  staminaCapacity,
  weightFactor,
  positionFactor,
  drainPerSecond,
  shortfallOf,
  gradeNorm,
  REFERENCE_WEIGHT_KG,
} from "./stamina.js";

/** 適正距離を下回るレースで、道中の目標位置を後ろへずらす量(m)。`shortfall`1.0のときの値
 * （`devlog/wave04.md`§40-2）。 */
const SHORT_LAG_METERS = 12;
/** 上のずれが最大になるまでの秒数（発走から数えて）。 */
const SHORT_LAG_SECONDS = 25;
/** 適正距離を下回るレースで、直線の最高速度から引く量。`shortfall`1.0のときの値。 */
const SHORT_VMAX_LOSS = 0.02;

/** 道中の判断カードを選んでから、目標の位置がそこまで動ききるまでの秒数
 * （`devlog/wave05.md`§51・2026-09-08にユーザーが20秒で合意）。
 * ⚠️0にすると目標が1ステップで別の値に入れ替わり、馬は速度の上限
 * （`vField * 1.13`＝周りより毎秒2.13mまで）に張り付いたまま新しい位置まで走る。
 * ⭐**動く量はこの秒数を変えても1cmも変わらない。変わるのは寄っていく速さだけ。**
 * 実測（中団の4択・12通りの乱数の中央値）：0秒だと「間を割る」が20.1m前へ寄るのに
 * 90%到達11.6秒・寄る速さ32px/s、20秒だと17.7秒・20px/s。⚠️12秒以下では前へ行く択の
 * 寄る速さが1px/sも変わらない（目標のほうが馬より速く動くので上限に張り付いたままになる）。
 * ⚠️直線の択には掛けない——直線は「追い出すまでの待ち時間」（`delay`）が同じ役目を
 * 既に持っているため。
 * ⚠️⚠️**この倍率は下の`effortMul`にも掛かる**（＝まだ動いていないうちは余分な消耗も
 * 払わない）。そのぶん前へ行く択が安くなり、勝率が動く：200通りの乱数で
 * 「型に合わせる」66.0%→72.5%、「型を外す」16.0%→16.5%（`devlog/wave05.md`§52）。
 * 目安の7〜8割の内側に収まっているのでこの形を採った。⚠️`effortMul`だけ満額に戻すと
 * 68.5%／17.0%になるが、まだ速く走っていない馬に満額の消耗を課すことになる。 */
const CARD_RAMP_SECONDS = 20;

/** 道中の判断カードが目標の位置を動かす量(m)＝`積極性の中立値からの差 × この値`。
 * ⚠️2026-09-08に62→18へ下げた（`devlog/wave05.md`§57）。62は目標差が逃げ3〜追込29mだった
 * ころの値で、⭐**帯を0〜24mへ圧縮したあとは「まくっていく」も「外に出す」もどちらも
 * 1番手まで行ってしまい、2つの択の結果が同じになっていた**（実測：両方とも中央値で
 * 5番手ぶん前・直線入口1.0番手）。18頭が24mに並ぶので1番手あたり約1.3m。
 * ⭐**22mは16通り（道中4×直線4）を全部試して決めた値**——一番良い選び方70.0%／
 * 適当に選ぶ50.5%／一番悪い選び方21.0%で、目安（7〜8割／2〜3割）の内側に入る。
 * ⚠️18mだと66.0%／21.0%（上が足りない）、26mだと75.0%／17.0%（下が足りない）。 */
const CARD_MOVE_METERS = 22;

/** サンプル間隔(秒)。2400mなら約600ステップ。 */
export const SIM_DT = 0.25;
/** 打ち切り時間(秒)。全馬がゴールしたらそこで止める。
 * ⚠️2026-09-16に210→300へ上げた。⭐**210秒ではダート3200mが打ち切られていた**
 * （狙い216.3秒に対して出た値がちょうど210.0秒。`tools/measure-sim-times.mjs`で発見）。
 * 芝3600mの基準タイムは232.3秒で、弱いメンバーだとさらに遅くなるため余裕を取る。
 * ⚠️積分は全馬がゴールした時点で抜けるので、計算量はほぼ増えない（増えるのは
 * `Float32Array(頭数×ステップ数)`の確保だけ。実測で事前シミュレーションは変わらず）。 */
export const MAX_SIM_SECONDS = 300;
/** 基準タイム(秒)＝この距離を倍率1.0のペースで走ったときの所要時間。2400mで2:24.0。
 * ⚠️2026-09-16に基準速度の決め方が変わり、この定数はもう`vPar`を決めていない
 * （`fieldSpeedFactor`と`data/parTimes.js`が決める）。⭐まだ`sim/pace.js`の
 * レース傾向の表示・`domain/`の仮の換算が参照しているので残してある。 */
export const PAR_SECONDS_PER_2400 = 146;

/** ゴールタイムの安全網の幅（基準タイムに対する倍率）。
 * ⚠️2026-09-16まで、ここは141.5〜147.5秒という**狭い帯**で、実測すると芝2000mの300本が
 * **300本とも発動**し、勝ちタイムが全部121.15秒（幅0.00秒）になっていた
 * ——つまり正規化が勝ちタイムを決めており、simが出した値は捨てられていた。
 * ⭐今は基準速度の側が出走馬の強さでタイムを決めるので、ここは
 * 「ありえない値だけを弾く」ためだけに置く。実測で発動率0%であることを確かめること
 * （`devlog/wave08.md`§6）。 */
export const SAFETY_TIME_MIN_RATIO = 0.90;
export const SAFETY_TIME_MAX_RATIO = 1.14;

/** ⭐出走馬の強さが基準速度を何倍にするか（2026-09-16のユーザー決定・`devlog/wave08.md`§6）。
 * `FIELD_LEVEL_REF`＝重賞の出走馬の平均能力（実測0.5195・104週の事前シミュレーション89本）。
 * ここを1.00の基準に置く＝**重賞の勝ちタイムが`data/parTimes.js`の実データに一致する**。
 * `FIELD_SPEED_SPAN`は「芝2000mで重賞と新馬・未勝利の勝ちタイム差を約4秒にする」という
 * ユーザー決定から逆算した値（実測3.99秒。較正は同§6。⚠️§7で芝ダ適性を広げたとき
 * 3.85秒に縮んだので0.43→0.46に戻した——**適性の係数を触ったらここも測り直す**）。 */
export const FIELD_LEVEL_REF = 0.39;
export const FIELD_SPEED_SPAN = 0.165;
/** 倍率の上下限。⚠️出走頭数が5頭のレースは平均がぶれるので、端を切る。 */
export const FIELD_FACTOR_MIN = 0.93;
export const FIELD_FACTOR_MAX = 1.05;

/** simが実際に出す勝ちタイムを、狙った基準タイムに合わせるための2つの較正値。
 * ⭐`勝ちタイム ≒ 発走の遅れ + 距離 / (効率 × vPar)`。
 * 発走の遅れ＝ゲートから走行速度に達するまでに失う時間、効率＝道中と直線を通した
 * 平均速度が`vPar`の何倍か。⚠️どちらも**simの中身を変えたら測り直す**
 * （`tools/measure-sim-times.mjs`。狙いとのずれが1%を超えたら`SIM_SPEED_EFFICIENCY`を
 * `現在値 ÷ ずれ率`に置き換える）。 */
const SIM_START_OVERHEAD_SECONDS = 1.8;
const SIM_SPEED_EFFICIENCY = 0.961;

const DASH_SECONDS = 3.6; // 発走の加速区間（一番遅い馬が走行速度に届くまで）
const STRETCH_METERS = 600; // 最終直線として扱う残り距離
const ACCEL_LIMIT = 1.2; // m/s^2（レース中の加速。位置を上げる・追い出すときの上限）
// ⚠️発走の加速だけは別（実測で7m/s²前後。ゲートから2〜3秒で走行速度に達する）。
// レース中と同じ1.2m/s²にすると走行速度に達するまで14秒かかり、⭐**全馬が基準ペースより
// 110m遅れたまま最後まで戻らない**（勝ちタイムが4秒遅くなる原因だった）。
const START_ACCEL_LIMIT = 8;
const DECEL_LIMIT = 1.6; // m/s^2
const KICK_RAMP_SECONDS = 3.0; // 直線で追い出してから全開になるまで
/** 直線の判断カードが「追い出すまでの待ち時間」を動かす幅（秒／積極性の振れ1.0あたり）。
 * ⚠️2026-09-16に9.0→24.0へ上げた。理由は2つとも同じ弾で直した欠陥の後始末
 * （`devlog/wave08.md`§6）——⭐**カードが積分の中で早く発動していた**バグを直した
 * （実測30通りの平均で道中1.73秒・直線2.70秒）
 * ことと、基準速度が実データに合って道中の消耗が減ったことで、カードの効きが落ち、
 * 一番良い選び方の1着率が57.5%まで下がっていた（`tools/measure-card-winrate.mjs 200`）。
 * 24.0で**69.5%／一番悪い27.5%**。⚠️変更前（4fc07e7）は同じ測り方で59.5%／17.0%だったので、
 * この弾で目安（7〜8割／2〜3割）に近づいた（上は0.5ポイント足りない）。 */
const STRETCH_CARD_DELAY_SPAN = 24.0;

// 宣言脚質ごとの「先頭からの目標差(m)」の**帯**（`data/aptitudeCategories.js`のSTRATEGIESと同じ並び）。
// ⭐2026-09-08に1点（逃げ3／先行9／差し19／追込29）から帯へ変えた（`devlog/wave05.md`§56）。
// ⚠️**1点だと同じ脚質の馬が全部同じ場所を目標にし、隊列が脚質の数だけの塊になる**
// （実測：逃げ7.6頭が前後5.5m・差し10.0頭が5.9mの中に入っていた）。
// ⚠️同時に全体を圧縮した（ユーザー決定の案(c)）——⭐画面に映るのは`VIEW_SPAN = 32`mなので、
// 旧29mでは追込が画面の外に出ていた。帯の上端24mなら収まる。
// ⚠️2026-09-08に3倍へ広げた（`devlog/wave05.md`§63）。旧0〜24mでは**18頭が20mに収まり、
// 画面（`VIEW_SPAN` 32m）にレース中ずっと全頭が入って迫力が無く、馬名も重なっていた**
// （ユーザーの2回目の通しプレイ）。0〜72mなら道中の幅は約56mで画面の1.8倍になる。
const TARGET_GAP_BAND = Object.freeze({
  nige: [0, 12], senko: [12, 30], sashi: [30, 51], oikomi: [51, 72],
});
/** 帯の中のどこに入るかを決めるときの、精神力の重み（残りは馬ごとに1回引く値）。 */
const BAND_MENTAL_WEIGHT = 0.4;

/** 位置を守る強さ（`POSITION_GAIN`）の下限と幅。賢い馬ほどぴたりと位置を守る。
 * ⚠️2026-09-08まで全馬0.3の固定値だった＝**ずれたときの戻り方が18頭とも同一**で、
 * 動きの形に馬ごとの違いが出なかった（`devlog/wave05.md`§54）。 */
const POSITION_GAIN_MIN = 0.15;
const POSITION_GAIN_SPAN = 0.3;

/** 道中の揺れ。⚠️2026-09-08まで`2.5 × sin(2π(t/周期 + 位相))`の**正弦波1本**だった
 * ＝画面上で30px幅の往復運動になり、ユーザーから「楕円状の動き」と指摘された。
 * ⭐0.25秒ごとに前の値を`WANDER_KEEP`だけ残す形に変えた（向きが変わるまで約3秒）。 */
const WANDER_KEEP = 0.92;
const WANDER_KICK = 1.4; // 一様乱数3つの和−1.5（ばらつき0.5）に掛ける。定常のばらつきは約1.8m

/** 道中に馬が自分から位置を変える（仕掛け）。⚠️2026-09-08まで**無かった**——
 * 道中80秒で順位が1頭あたり1.33番しか動かず、その場で震えているだけに見えていた。 */
const MOVE_ZONE_FROM = 1000; // この距離を過ぎてから
const MOVE_ZONE_TO = 1700; //  この距離までの間で仕掛ける
const MOVE_RAMP_SECONDS = 15; // 仕掛けてから動ききるまで
const MAX_MOVES = 2; // 1頭が道中に仕掛ける回数の上限

/** 直線で出せる速さのうち、能力（瞬発力・スピード・勝負根性・パワー）の部分に掛ける倍率。
 * ⚠️2026-09-08に1→0.30へ下げた（`devlog/wave05.md`§63）。⭐**能力4項だけで18頭の間に
 * 5.9%＝1.99秒の差が付いていた**のに対し、JRAの日本ダービー10年ぶんの実データでは
 * **上り3F上位5頭の中の差は0.3秒**（34秒に対し0.9%）。6.6倍広く、上位が僅差にならなかった。 */
const STRETCH_ABILITY_SCALE = 0.30;
/** 直線で出せる速さの下限（`vPar`に対する倍率）。⚠️これが無いと、脚が尽きた馬が
 * 直線でほぼ止まり、上り3Fが55秒などになる（`MAX_SIM_SECONDS`で打ち切られる）。
 * 0.825は実データの最遅の上り42.1秒（2016年）＝`vPar`の0.867倍を下回る値として置いた。 */
const STRETCH_VMAX_FLOOR = 0.825;

/** 直線で「脚が尽きて垂れる」境目。⚠️⚠️**0.25のまま動かさないこと**（2026-09-08に掃引して確定）。
 * ⭐ユーザーは案(a)「この境目を上げて前で行った馬を垂れさせる」を選んだが、実測すると
 * **判断カードが意味を失った**：0.25→0.70で「型に合わせる」68.3%→18.3%・「型を外す」も18.3%
 * ＝どちらを選んでも同じになる。理由は、境目を上げると`vMaxMul`の中で残りの脚の傾きが
 * 0.2→0.5になり、瞬発力(0.075)・スピード(0.045)・パワー(0.05)を飲み込むため。
 * ⭐**そして(a)は不要だった**——部品1〜5と目標差の圧縮(c)だけで、道中の位置と着順の関係は
 * ほぼ消えた（道中1〜3番手10.08着・16〜18番手10.42着）。詳細は`devlog/wave05.md`§56。 */
const GASSED_THRESHOLD = 0.49;
// 直線で追い出すまでの待ち時間(秒)。逃げほど早く、追込ほど遅い。
const KICK_DELAY_BY_STRATEGY = Object.freeze({ nige: 0.5, senko: 1.2, sashi: 2.0, oikomi: 2.8 });

// 判断カードの積極性（0..1）。中立値＝カードを選んでいない状態。
export const NEUTRAL_MID_AGGRESSION = 0.35;
export const NEUTRAL_STRETCH_AGGRESSION = 0.4;

/**
 * 道中の択の積極性（0〜1）。⭐**`data/judgmentSituations.js`の`aggression`をそのまま読む。**
 * ⚠️2026-09-08にこの形へ変えた（`devlog/wave05.md`§57）。それ以前は`forward`（前へ行く）を
 * 主・`effect`を従とする式で、`forward: false`の択が一律0.15になっていた。
 * ⭐中立値（カード未選択）は0.35なので、**位置を動かさないはずの択が中立値を下回り、
 * 中団で「内で待つ」を選ぶと8.1番手ぶん下がっていた**（71回中71回・最大11番手）。
 * ⚠️`aggression`を持たない択（通常レースの`SITUATIONS`）は従来の式で計算する。
 * @param {{aggression?:number, forward?:boolean, effect?:number}} move
 */
export function midAggressionOf(move) {
  if (typeof move?.aggression === "number") return Math.max(0, Math.min(1, move.aggression));
  const base = move?.forward ? 0.55 : 0.15;
  return Math.max(0, Math.min(1, base + (move?.effect ?? 0) * 0.08));
}

/** 直線の択の積極性。`early`（早く仕掛ける）が主。 */
export function stretchAggressionOf(move) {
  const base = move?.early ? 0.6 : 0.2;
  return Math.max(0, Math.min(1, base + (move?.effect ?? 0) * 0.09));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 騎手の度胸から、判断カードで覆せる量の倍率を出す。度胸50で1.0（中立）。
 * ⚠️係数（0.7＋0.6×）は馬の賢さと同じ形を借りた仮値。根拠は無い。
 * 騎手が渡らなければ1.0（夢のダービー＝トップジョッキー・度胸の差を作らない）。
 */
function courageScale(jockey) {
  if (!jockey || typeof jockey.courage !== "number") return 1;
  return 0.7 + 0.6 * clamp(jockey.courage / 100, 0, 1);
}

/** 騎手の適性が脚の総量に掛かる幅。1±この値の半分。⚠️根拠は無い（較正で決めた値）。
 * ⭐0.12で始めたが、**対照実験で0.14着しか動かず騎手が飾りだった**ため0.30へ上げた
 * （`devlog/wave08.md`§3の計測）。騎手の段位は中央に寄って分布するので、
 * 幅の数字ほどには実効の差が出ない。
 * ⭐**2026-09-16に0.30→0.70へ上げた**（ユーザー決定「騎手の効き幅を馬の1.5倍に」）。
 * 対照実験で0.35着→**0.89着**。同じ実験での馬の芝ダ適性は0.57着なので1.56倍
 * （`devlog/wave08.md`§6-6）。⚠️§3の「馬の適性より小さく保つ」はこの決定で逆になった。 */
const JOCKEY_EFFECT_SPAN = 0.7;

/**
 * 騎手の適性3つ（今日の脚質・距離帯・馬場）の平均から、脚の総量に掛ける倍率を出す。
 * 2026-09-16のユーザー決定「適性3つ＋度胸」。騎手が渡らなければ1.0。
 */
function jockeyAptitudeFactor(jockey, strategy, distance, surface) {
  if (!jockey?.aptitudes) return 1;
  const band =
    distance <= 1400 ? "sprint" : distance <= 1800 ? "mile" : distance <= 2400 ? "intermediate" : "long";
  const keys = [`strategy:${strategy}`, `distance:${band}`, `surface:${surface}`];
  let sum = 0;
  let n = 0;
  for (const key of keys) {
    const grade = jockey.aptitudes[key];
    if (grade == null) continue;
    sum += gradeNorm(grade);
    n += 1;
  }
  if (n === 0) return 1;
  return 1 + JOCKEY_EFFECT_SPAN * (sum / n - 0.5);
}

/**
 * ⭐そのレースの出走馬の強さ（0〜1）。simが実際に読む6軸の平均を、出走馬全部で平均する。
 * ⚠️賢さ・丈夫さ・柔軟性は入れない——この3つは速度そのものを決めていないため。
 * ⚠️**「一番強い馬」ではなく「出走馬の平均」を使う**。実測すると、一番強い馬の能力は
 * 未勝利0.5976・重賞0.6180で差が0.02しかないが（強い馬は未勝利戦にも紛れている）、
 * 出走馬の平均は0.4779と0.5195で差が0.042ある。クラスの差がタイムに出るのは平均のほう。
 */
export function fieldLevelOf(entries, surface, distance) {
  let sum = 0;
  for (const e of entries) {
    const a = normalizedAbilities(e.horse);
    const raw = (a.speed + a.stamina + a.sharpness + a.grit + a.power + a.mentalStrength) / 6;
    // ⭐**そのレースでの強さ**にする——6軸の平均だけでは足りない。
    // ⚠️距離適性を掛けないと、長距離向きの馬ばかりの1600mのレースが「強いメンバー」に
    // 見えてしまう（実測：着順との相関は距離適性が−0.708で他の全部を上回る）。
    // ⚠️芝ダ適性を掛けないと、その馬場に向いていない馬の集まりが速く走ることになる。
    sum += raw * distanceAptitude(e.horse, distance) * surfaceFactorFor(e.horse.surfaceAptitude, surface);
  }
  return entries.length > 0 ? sum / entries.length : FIELD_LEVEL_REF;
}

/** 出走馬の強さから、基準速度に掛ける倍率を出す。重賞の平均で1.00になる。 */
export function fieldSpeedFactor(entries, surface, distance) {
  const level = fieldLevelOf(entries, surface, distance);
  return clamp(
    1 + FIELD_SPEED_SPAN * (level - FIELD_LEVEL_REF),
    FIELD_FACTOR_MIN,
    FIELD_FACTOR_MAX
  );
}

/**
 * レースを1本走らせる。自己完結の純関数（同じ入力なら常に同じ結果）。
 * @param {object} input
 * @param {number|string} input.seed - `saveSeed`
 * @param {string} input.raceKey - そのレースを一意に識別するキー
 * @param {number} [input.distance] - m
 * @param {{num:number,horse:object,isSelf?:boolean}[]} input.entries - 馬番昇順
 * @param {object} input.plan - 作戦。`{ selfNum, strategies: {馬番:脚質}, moves: [{at,phase,forward,early,effect}] }`
 * @param {number} [input.fieldFactor] - 基準速度に掛ける倍率を、出走馬から計算せずに直に渡す。
 *   ⚠️夢のダービーだけが使う（史実馬の能力値は架空馬と別の物差しなので、
 *   `fieldSpeedFactor`の較正範囲の外に出る。`devlog/wave08.md`§6）
 * @param {number} [input.timeScale] - ゴールタイム正規化の倍率。フォーク時に基準の値を引き継ぐ
 * @param {object} [input.trendBase] - レース傾向の「なりやすさ」
 * @returns {object} 下記の`result`
 */
export function runRaceSim(input) {
  const {
    seed,
    raceKey = "race",
    distance = 2400,
    surface = "turf",
    condition = "good",
    // ⚠️適性の係数（芝ダ・道悪・騎手）を効かせるか。既定はON。
    // 夢のダービーだけOFFにしている——史実馬の芝ダ適性がランダムに振られたままで、
    // ダービー馬が「芝×」になる状態のため（`devlog/wave08.md`§4）。
    aptitudeFactors = true,
    entries,
    plan,
    trendBase = DERBY_TREND_BASE,
  } = input;
  const n = entries.length;
  const dtRaw = SIM_DT;
  // ⭐基準速度(m/s)。⚠️2026-09-16まで全レース共通の固定値（16.44m/s）だった
  // ——実測すると芝2000mの300本の勝ちタイムの幅が**0.00秒**、生タイムと出走馬の能力平均の
  // 相関は**0.085**（ほぼ無相関）で、強い馬が揃っても弱い馬が揃ってもタイムが同じだった。
  // 今は「その馬場・距離の基準タイム（史実）」を「出走馬の強さ」で割ったものを狙う。
  const fieldFactor = input.fieldFactor ?? fieldSpeedFactor(entries, surface, distance);
  const targetSeconds = parSecondsFor(surface, distance) / fieldFactor;
  const vPar =
    distance / (SIM_SPEED_EFFICIENCY * Math.max(targetSeconds - SIM_START_OVERHEAD_SECONDS, 1));
  // ⭐ステップ数はこのレースの狙いのタイムから決める（距離が短いほど配列が小さくて済む）。
  // 打ち切りは`MAX_SIM_SECONDS`。1.6倍の余裕は、全馬が距離不足で垂れても届く幅として置いた。
  const steps = Math.ceil(Math.min(MAX_SIM_SECONDS, targetSeconds * 1.6) / dtRaw) + 1;
  const dStretch = distance - STRETCH_METERS;

  const strategyList = entries.map((e) => plan.strategies[e.num] ?? "senko");
  const trend = decideRaceTrend({ seed, raceKey, strategies: strategyList, base: trendBase });

  // ===== 各馬の固定パラメータ =====
  const traits = entries.map((e, i) => {
    const rand01 = streamRandom(seed, RNG_STREAMS.SIM, raceKey, "horse", e.num);
    const ab = normalizedAbilities(e.horse);
    const staminaApt = staminaAptitude(e.horse, distance);
    const shortfall = shortfallOf(e.horse, distance);
    const adapt = trendAdaptationOf(e.horse, trend);
    // ⭐適性の係数3つ（2026-09-16のユーザー決定・`devlog/wave08.md`§2）。
    // 距離適性と同じ場所＝脚の総量に掛ける。`arch/race-sim.md`冒頭「最大の逆転要因は
    // 適性（距離・馬場・戦法）。騎手の適性10個と馬の適性が同じレースに掛かる」。
    const surfaceFactor = aptitudeFactors ? surfaceFactorFor(e.horse.surfaceAptitude, surface) : 1;
    const mudFactor = aptitudeFactors ? mudFactorFor(e.horse.mudAptitude, condition) : 1;
    // ⚠️`jockeyPenalty`は疲労（`domain/fatigue.js`）。1で無補正。
    const jockeyFactor = aptitudeFactors
      ? jockeyAptitudeFactor(e.jockey, strategyList[i], distance, surface) * (e.jockeyPenalty ?? 1)
      : 1;
    const capacity = staminaCapacity({
      staminaNorm: ab.stamina,
      distanceApt: staminaApt * surfaceFactor * mudFactor * jockeyFactor,
      trendAdaptation: adapt,
    });
    const strategy = strategyList[i];
    const dash = 0.5 * ab.speed + 0.3 * ab.power + 0.2 * ab.mentalStrength + (rand01() - 0.5) * 0.3;
    return {
      num: e.num,
      isSelf: !!e.isSelf,
      ab,
      staminaApt,
      shortfall,
      adapt,
      capacity,
      strategy,
      dash: clamp(dash, 0, 1),
      // ⚠️発走の加速に要する秒数（2.1〜3.6秒）。⚠️**下限をSTART_ACCEL_LIMITで届く時間
      // （約2.05秒）より短くしないこと**——短くすると加速度の上限側が効いて全馬が
      // まったく同じ加速をし、発走の差が消える（実測で全18頭の距離が小数点以下まで一致した）。
      accelSeconds: 3.6 - 1.5 * clamp(dash, 0, 1),
      // 判断カードで覆せる量の倍率。`arch/race-sim.md`「覆せる量＝基準幅×馬の賢さ×騎手の度胸×疲労」。
      // ⚠️疲労はまだ入っていない（プレイヤーの疲労は`domain/weekResults.js`が別に扱う）。
      // 騎手が渡らないレース（夢のダービー＝トップジョッキー）は度胸の項が1.0になる。
      cardScale: (0.7 + 0.6 * ab.wisdom) * courageScale(e.jockey),
      // 部品2：脚質の帯の中の1点。精神力が高いほど帯の前寄りに付ける。
      baseGap: (() => {
        const [lo, hi] = TARGET_GAP_BAND[strategy] ?? TARGET_GAP_BAND.sashi;
        const frac = (1 - BAND_MENTAL_WEIGHT) * rand01() + BAND_MENTAL_WEIGHT * (1 - ab.mentalStrength);
        return lo + (hi - lo) * frac;
      })(),
      // 部品3：位置を守る強さ。
      posGain: POSITION_GAIN_MIN + POSITION_GAIN_SPAN * ab.wisdom,
      // 部品4：揺れを引く乱数（積分の中で毎ステップ消費する。⚠️消費の順番が変わると
      // `resumeRaceSim`のフォーク前が一致しなくなるので、位相に関わらず必ず引くこと）。
      wanderRand: streamRandom(seed, RNG_STREAMS.SIM, raceKey, "wander", e.num),
      // 部品5：道中の仕掛け。回数は0/1/2、地点はMOVE_ZONE_FROM〜TOの間。
      moves: (() => {
        const r = rand01();
        const count = r < 0.3 ? 0 : r < 0.8 ? 1 : 2;
        const front = strategy === "nige" || strategy === "senko";
        const out = [];
        for (let k = 0; k < count; k += 1) {
          const at = MOVE_ZONE_FROM + (MOVE_ZONE_TO - MOVE_ZONE_FROM) * rand01();
          // 前で運ぶ馬はまれに下げるだけ。後ろの馬は前へ上がる（負＝目標差が縮む＝前へ）。
          const size = 0.7 + 0.6 * ab.mentalStrength;
          const delta = front
            ? (rand01() < 0.2 ? (2 + 3 * rand01()) * size : -(1 + 2 * rand01()) * size)
            : -(3 + 6 * rand01()) * size;
          out.push({ at, delta });
        }
        return out.sort((a, b) => a.at - b.at);
      })(),
      kickDelay: (KICK_DELAY_BY_STRATEGY[strategy] ?? 2) + (rand01() - 0.5) * 0.8,
      weight: weightFactor(REFERENCE_WEIGHT_KG, distance),
    };
  });

  // ===== プレイヤーの判断カード（フォークで差し替わる部分） =====
  const selfIndex = entries.findIndex((e) => e.num === plan.selfNum);
  const midMove = (plan.moves ?? []).find((m) => m.phase === "mid") ?? null;
  const stretchMove = (plan.moves ?? []).find((m) => m.phase === "stretch") ?? null;
  const midAggression = midMove ? midAggressionOf(midMove) : NEUTRAL_MID_AGGRESSION;
  const stretchAggression = stretchMove ? stretchAggressionOf(stretchMove) : NEUTRAL_STRETCH_AGGRESSION;
  const midMoveAt = midMove ? midMove.at : Infinity;
  const stretchMoveAt = stretchMove ? stretchMove.at : Infinity;

  // ===== 積分 =====
  const dist = new Float32Array(n * steps);
  const d = new Float64Array(n);
  const v = new Float64Array(n);
  const energy = new Float64Array(n).fill(1);
  const stretchEnterT = new Array(n).fill(null);
  const energyAtStretch = new Float64Array(n);
  const finishTime = new Array(n).fill(null);
  // 適正距離を下回るレースで道中に後ろへずれた量(m)。道中でのみ更新し、直線に入ってからは
  // 最後の値を保持する（`sim/stamina.js`の`shortfallOf`・`devlog/wave04.md`§40-2）。
  const lagNow = new Float64Array(n);
  // 部品4の揺れの現在値と、部品5の仕掛けが始まった時刻（-1＝まだ始まっていない）。
  const wanderNow = new Float64Array(n);
  const moveStartT = new Float64Array(n * MAX_MOVES).fill(-1);
  let dRef = 0;
  let lastStep = steps - 1;

  for (let s = 0; s < steps; s += 1) {
    const t = s * dtRaw;
    let leaderD = -Infinity;
    for (let i = 0; i < n; i += 1) {
      dist[i * steps + s] = d[i];
      if (d[i] > leaderD) leaderD = d[i];
    }
    if (leaderD >= distance + 60) {
      lastStep = s;
      for (let k = s + 1; k < steps; k += 1) {
        for (let i = 0; i < n; i += 1) dist[i * steps + k] = dist[i * steps + s];
      }
      break;
    }

    const uRef = clamp(dRef / distance, 0, 1);
    const paceMul = paceMultiplierAt(trend, uRef);
    const vField = vPar * paceMul;
    const vCruise = vPar * paceMultiplierAt(trend, 0.78);

    for (let i = 0; i < n; i += 1) {
      const tr = traits[i];
      const isSelf = i === selfIndex;
      // ⚠️位相に関わらず毎ステップ必ず引く（乱数の消費順を固定してフォークを一致させる）。
      wanderNow[i] =
        WANDER_KEEP * wanderNow[i] +
        WANDER_KICK * (tr.wanderRand() + tr.wanderRand() + tr.wanderRand() - 1.5);
      let effortMul = 1;
      let vWant;

      if (d[i] >= dStretch) {
        if (stretchEnterT[i] == null) {
          stretchEnterT[i] = t;
          energyAtStretch[i] = energy[i];
        }
        const aggression = isSelf && t >= stretchMoveAt ? stretchAggression : null;
        // 積極性からの振れ幅は賢さ倍率（cardScale）を通す。中立値からの差だけが動く。
        const swing = aggression != null ? (aggression - NEUTRAL_STRETCH_AGGRESSION) * tr.cardScale : 0;
        const delay = aggression != null ? 3.0 - STRETCH_CARD_DELAY_SPAN * swing : tr.kickDelay;
        const kickT = stretchEnterT[i] + Math.max(0, delay);
        const effort = clamp((t - kickT) / KICK_RAMP_SECONDS, 0, 1);
        // ⭐直線で出せる速度＝基準＋瞬発力＋スピード＋**残りの脚**＋勝負根性。
        // 脚の係数が一番大きい＝道中に溜まった消耗の差が、ここで着順に変わる。
        // ⚠️パワーは坂で効く（`design/winning-post-race-model.md`「重馬場と坂」）。
        // 東京の直線には高低差2mの坂がある。これを入れないとパワーは発走の加速にしか
        // 使われず、1段動かしても平均着順が0.000しか動かない「飾りの軸」になる（実測）。
        const e = clamp(energy[i], 0, 1);
        // ⭐脚が0.25を切ると落ち方が急になる（垂れる）。⚠️ここが線形だと「早く仕掛ける」の
        // 損得が全ての馬で同じになり、直線の択が馬の状態と無関係な一択に潰れる（実測）。
        const gassed = Math.max(0, GASSED_THRESHOLD - e);
        // ⚠️適正距離を下回るレースでは、道中ついていけないだけでなく直線の伸びそのものが
        // 足りない（`sim/stamina.js`の`shortfallOf`・`devlog/wave04.md`§40-2）。
        const vMaxMul =
          0.805 +
          STRETCH_ABILITY_SCALE *
            (0.075 * tr.ab.sharpness + 0.045 * tr.ab.speed + 0.03 * tr.ab.grit + 0.05 * tr.ab.power) +
          0.10 * e -
          0.55 * gassed +
          0.02 * swing -
          SHORT_VMAX_LOSS * tr.shortfall;
        vWant = vCruise + effort * (vPar * Math.max(STRETCH_VMAX_FLOOR, vMaxMul) - vCruise);
        // ⚠️早く仕掛けるほど脚の減りが跳ね上がる（1.2倍の係数）。ここを小さくすると
        // 「早く仕掛ける」が全部の位置で最善になり、直線の択が選択でなくなる（実測）。
        if (aggression != null) effortMul = 1 + 0.7 * swing;
      } else if (t < DASH_SECONDS) {
        vWant = vField * clamp(t / tr.accelSeconds, 0, 1);
      } else {
        const aggression = isSelf && t >= midMoveAt ? midAggression : NEUTRAL_MID_AGGRESSION;
        // 選んだ瞬間に目標を切り替えず、CARD_RAMP_SECONDSかけて少しずつ動かす。
        const cardRamp =
          isSelf && t >= midMoveAt ? clamp((t - midMoveAt) / CARD_RAMP_SECONDS, 0, 1) : 1;
        const swing =
          (aggression - NEUTRAL_MID_AGGRESSION) * (isSelf ? tr.cardScale : 1) * cardRamp;
        // 適正距離を下回るレースでは、道中のペースについていけず後ろへ下がる
        // （`sim/stamina.js`の`shortfallOf`・`devlog/wave04.md`§40-2）。⚠️速度のクランプ
        // （0.86〜1.13倍）には触らない——触ると隊列が固まる（下のコメント参照）。
        const lag =
          tr.shortfall > 0
            ? SHORT_LAG_METERS * tr.shortfall * clamp((t - DASH_SECONDS) / SHORT_LAG_SECONDS, 0, 1)
            : 0;
        lagNow[i] = lag;
        // 部品5：仕掛けた地点を通過したら、そこからMOVE_RAMP_SECONDSかけて目標を動かす。
        let moveOffset = 0;
        for (let k = 0; k < tr.moves.length; k += 1) {
          const key = i * MAX_MOVES + k;
          if (moveStartT[key] < 0 && d[i] >= tr.moves[k].at) moveStartT[key] = t;
          if (moveStartT[key] >= 0) {
            moveOffset += tr.moves[k].delta * clamp((t - moveStartT[key]) / MOVE_RAMP_SECONDS, 0, 1);
          }
        }
        const targetGap = tr.baseGap + wanderNow[i] + lag + moveOffset - swing * CARD_MOVE_METERS;
        // ⚠️目標差を0で頭打ちにしないこと。0にすると**逃げ馬が全頭まったく同じ位置に重なり、
        // 画面上で1頭も動かなくなる**（実測：7頭が50秒間ぴったり0.00m差）。前に出る余地を残す。
        const err = dRef - Math.max(-8, targetGap) - d[i];
        vWant = clamp(vField + tr.posGain * err, vField * 0.86, vField * 1.13);
        if (isSelf) effortMul = 1 + 1.2 * swing;
      }

      // 道中の脚切れは「隊列から少しずつ落ちる」形にする（直線の垂れはvMaxMulが担う）。
      // ⚠️⚠️**上限は位置取りのクランプ（1.13倍）と同じにしておくこと。** ここを1.02倍などに
      // 下げると、⭐**全馬が上限に張り付いて同じ速度で走り、隊列が固まって1頭も動かなくなる**
      // （実測で7頭の距離が50秒間ぴったり一致した）。脚が0.3を切ったときだけ効かせる。
      // ⚠️逆に下限を深くすると、脚を使い切った馬が道中で100m以上ちぎれて画面から消える。
      if (t >= DASH_SECONDS && d[i] < dStretch) {
        vWant = Math.min(vWant, vField * (0.94 + 0.19 * clamp(energy[i] / 0.3, 0, 1)));
      }
      const accelLimit = t < DASH_SECONDS ? START_ACCEL_LIMIT : ACCEL_LIMIT;
      const dv = clamp(vWant - v[i], -DECEL_LIMIT * dtRaw, accelLimit * dtRaw);
      v[i] += dv;
      if (v[i] < 0) v[i] = 0;

      const prevD = d[i];
      d[i] += v[i] * dtRaw;
      if (finishTime[i] == null && d[i] >= distance) {
        const frac = v[i] > 0 ? (distance - prevD) / (v[i] * dtRaw) : 0;
        finishTime[i] = t + clamp(frac, 0, 1) * dtRaw;
      }

      energy[i] -= drainPerSecond({
        paceRatio: v[i] / vPar,
        // 適正距離を下回るレースで下がったぶんは、風よけの得として打ち消す
        // （そのままだと下がったことで脚が温存され、不利が21%目減りする。`devlog/wave04.md`§40-2）。
        positionFactor: positionFactor(leaderD - prevD - lagNow[i]),
        weightFactor: tr.weight,
        capacity: tr.capacity,
        effortMultiplier: effortMul,
      }) * dtRaw;
      if (energy[i] < 0) energy[i] = 0;
    }
    dRef += vField * dtRaw;
  }

  for (let i = 0; i < n; i += 1) {
    if (finishTime[i] == null) finishTime[i] = MAX_SIM_SECONDS;
  }

  // ===== ゴールタイムの安全網（`devlog/wave04.md`§28-1・`devlog/wave08.md`§6） =====
  // ⚠️⚠️**ここは普段働かない。** 勝ちタイムを決めるのは上の`vPar`（＝基準タイム÷出走馬の
  // 強さ）であって、この節ではない。ここは「発走で全馬が出遅れた」「全馬が距離不足で
  // 垂れた」といった、狙いから1割以上外れた値だけを弾く。
  // ⚠️倍率はレース開始時（フォーク前）に1度だけ決め、以後のフォークは同じ倍率を使い回す
  // ——フォークのたびに倍率が変わると、既に見せた時刻の隊列と矛盾する。
  const rawWinner = Math.min(...finishTime);
  const timeScale =
    input.timeScale ??
    clamp(
      rawWinner,
      targetSeconds * SAFETY_TIME_MIN_RATIO,
      targetSeconds * SAFETY_TIME_MAX_RATIO
    ) / (rawWinner || 1);
  const dt = dtRaw * timeScale;
  const scaledFinish = finishTime.map((x) => x * timeScale);

  const order = entries.map((_, i) => i).sort((a, b) => scaledFinish[a] - scaledFinish[b]);
  const winnerIndex = order[0];
  const winnerTime = scaledFinish[winnerIndex];

  const indexByNum = new Map(entries.map((e, i) => [e.num, i]));

  function distanceAtStepTime(i, t) {
    const x = clamp(t / dt, 0, lastStep);
    const s0 = Math.floor(x);
    const s1 = Math.min(lastStep, s0 + 1);
    const f = x - s0;
    return dist[i * steps + s0] * (1 - f) + dist[i * steps + s1] * f;
  }
  function distanceOf(num, t) {
    const i = indexByNum.get(num);
    if (i == null) return 0;
    return distanceAtStepTime(i, t);
  }
  /** その馬がその距離を通過した時刻(秒)。届かなければnull。 */
  function timeAtDistanceOf(num, target) {
    const i = indexByNum.get(num);
    if (i == null) return null;
    for (let s = 1; s <= lastStep; s += 1) {
      const a = dist[i * steps + s - 1];
      const b = dist[i * steps + s];
      if (b >= target) {
        const f = b > a ? (target - a) / (b - a) : 0;
        return (s - 1 + f) * dt;
      }
    }
    return null;
  }

  const winnerNum = entries[winnerIndex].num;
  const tAt = (m) => timeAtDistanceOf(winnerNum, m);
  const last3F = winnerTime - (tAt(distance - 600) ?? winnerTime);
  const last4F = winnerTime - (tAt(distance - 800) ?? winnerTime);
  const split1000 = tAt(1000) ?? 0;

  // 着差(m)＝勝ち馬がゴールした瞬間の、勝ち馬との距離差（実際の競馬の定義そのもの）。
  const marginMeters = entries.map((_, i) =>
    Math.max(0, distance - distanceAtStepTime(i, winnerTime))
  );

  return {
    dt,
    steps,
    lastStep,
    fieldSize: n,
    trend,
    distanceOf,
    timeAtDistanceOf,
    finishTime: scaledFinish,
    order,
    winnerIndex,
    winnerNum,
    winnerTime,
    marginMeters,
    last3F,
    last4F,
    split1000,
    energyLeft: Array.from(energy),
    energyAtStretch: Array.from(energyAtStretch),
    timeScale,
    input: { ...input, timeScale },
  };
}

/**
 * 判断カードの選択を反映して、`tFork`以降だけを計算し直す（前作`Roadrace_Game`の`resumeSim`と同じ形）。
 * ⭐`tFork`以前の数値は変わらない——同じ乱数・同じ作戦で同じ計算を通るため、
 * フォーク前の距離の時系列はビット単位で一致する（それまでに画面へ見せた隊列と矛盾しない）。
 * @param {object} base - `runRaceSim`の戻り値
 * @param {number} tFork - 選択した時刻(秒)
 * @param {{phase:"mid"|"stretch", forward?:boolean, early?:boolean, effect?:number}} patch
 */
export function resumeRaceSim(base, tFork, patch) {
  const prev = base.input;
  // ⚠️⚠️`tFork`は**画面の時計**（正規化後）の秒数だが、積分の中の`t`は正規化前の秒数。
  // そのまま`at`に入れると、カードを選んだ時刻が積分の中ではずれた場所になる
  // （2026-09-16に実測で発見。それまで正規化の倍率が常に0.98前後だった（実測30通りの平均0.9767）ので、道中のカードは
  // 積分の中で早く発動していた（実測30通りの平均で道中1.73秒・直線2.70秒）
  // ＝カードの効きが実際より強く出ていた。
  // `devlog/wave08.md`§6）。ここで正規化前の秒数に戻す。
  const rawFork = tFork / (base.timeScale || 1);
  const moves = [
    ...(prev.plan.moves ?? []).filter((m) => m.phase !== patch.phase),
    { ...patch, at: rawFork },
  ];
  return runRaceSim({ ...prev, plan: { ...prev.plan, moves }, timeScale: base.timeScale });
}

/**
 * 既定の作戦（全馬が得意脚質・プレイヤーはカード未選択）の`plan`を組み立てる。
 * @param {{num:number,isSelf?:boolean}[]} entries
 * @param {(entryIndexOrNum:any) => string} strategyOf - 馬番→脚質
 * @param {number} selfNum
 */
export function buildPlan(entries, strategyOf, selfNum) {
  const strategies = {};
  for (const e of entries) strategies[e.num] = strategyOf(e);
  return { selfNum, strategies, moves: [] };
}
