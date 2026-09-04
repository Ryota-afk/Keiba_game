// 夢のダービー：レース描画に使う純粋計算のみ（JSX・DOM無し。Node単体テスト可能）。
// dream-derby-mock2.html（合意済みモック）の対応関数を移植。
//
// ⚠️`gapMetersAt`はモックから設計を変えてある。モックは「残り1200m地点」から最終着差
// （finishGap＝レース結果そのもの）へ収束を始めるが、その時刻は直線の判断カード（結果に
// 影響する選択）がまだ選ばれていない瞬間と同じだった。実装では、確定した結果が必要になる
// 前に結果を要求しない——最終着差への収束は`confirmedAt`（直線カードで選んだ瞬間）から
// 始める。それ以前の隊列の見え方は、結果と無関係な演出専用の揺らぎ（`viewHash01`）だけで
// 動かす。`viewHash01`は着順を決める乱数（`core/rng.js`のストリーム）とは完全に別のハッシュ
// 源であり、Roadrace_Gameの教訓（演出乱数と結果乱数を共有すると規則性が透けて見える）を
// 踏まえて分離してある。

import {
  TOTAL_DISTANCE,
  DIST_CHECKPOINTS,
  VIEW_SPAN,
  ANCHOR_SELF,
  ANCHOR_LEADER,
  PRESTART_GATE_X,
  DRAW_X0,
  DRAW_X1,
  TRACK_W,
  N_SEG,
  CURVE_SECTIONS,
  T_TUT_CAMERA,
  T_TUT_DISPLAY,
  T_TUT_SPEED,
  T_FINISH,
} from "../data/dreamDerbyCourse.js";

/** 演出専用の疑似乱数ハッシュ（結果RNGとは別ストリーム。0以上1未満）。 */
export function viewHash01(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function clamp01(v) {
  return Math.max(0.03, Math.min(0.97, v));
}

/** 経過秒→通過距離(m)。DIST_CHECKPOINTSの区間で線形補間。 */
export function distanceAtTime(t) {
  for (let i = 1; i < DIST_CHECKPOINTS.length; i++) {
    const a = DIST_CHECKPOINTS[i - 1];
    const b = DIST_CHECKPOINTS[i];
    if (t <= b.t) return a.d + (b.d - a.d) * ((t - a.t) / (b.t - a.t));
  }
  return TOTAL_DISTANCE;
}

/** 通過距離(m)→経過秒。distanceAtTimeの逆変換（判断カードの発火タイミング算出に使う）。 */
export function timeAtDistance(dist) {
  for (let i = 1; i < DIST_CHECKPOINTS.length; i++) {
    const a = DIST_CHECKPOINTS[i - 1];
    const b = DIST_CHECKPOINTS[i];
    if (dist <= b.d) return a.t + (b.t - a.t) * ((dist - a.d) / (b.d - a.d));
  }
  return T_FINISH;
}

const PRE_CONFIRM_T = [0, T_TUT_CAMERA, T_TUT_DISPLAY, T_TUT_SPEED, 72, 80];

/**
 * 「典型的なレースペース」（distanceAtTime）を基準にした、そのレーンのギャップ(m)。
 * 自分の馬も含め全馬に同じ式を使う——⚠️モックは自分の馬のギャップを常に0に固定していた
 * （＝自分は必ず勝つ前提の飾り）。実装では選択次第で自分が負けることもあるため、
 * 「勝ち馬のmarginMetersが0」という一般化された基準に統一し、自分だけを特別扱いしない。
 * 自分の馬がカメラの基準（アンカー）になる場合、画面上の自分の位置は常にアンカー位置
 * そのものになるため、この関数が返す値そのものは自分の画面位置には影響しない
 * （先頭カメラモードや上端マーカー帯での相対位置にのみ影響する）。
 * @param {number} num - 馬番
 * @param {number} t - 経過秒
 * @param {object} opts
 * @param {number|null} [opts.marginMeters] - 直線カード確定後の最終着差(m)。勝ち馬は0。未確定はnull
 * @param {number|null} [opts.confirmedAt] - 直線カードで選んだ時刻(秒)。未確定はnull
 */
export function gapMetersAt(num, t, { marginMeters = null, confirmedAt = null } = {}) {
  const mid = (seed) => viewHash01(num * 17 + seed) * 28 - 6;
  const preVals = [0, mid(2), mid(3), mid(4), mid(5), mid(6)];
  const cosmeticAt = (time) => {
    if (time <= PRE_CONFIRM_T[0]) return preVals[0];
    for (let i = 1; i < PRE_CONFIRM_T.length; i++) {
      if (time <= PRE_CONFIRM_T[i]) {
        const a = PRE_CONFIRM_T[i - 1];
        const b = PRE_CONFIRM_T[i];
        return preVals[i - 1] + (preVals[i] - preVals[i - 1]) * ((time - a) / (b - a));
      }
    }
    return preVals[preVals.length - 1]; // 直線カードの選択待ちの間は横ばい
  };
  if (marginMeters == null || confirmedAt == null || t < confirmedAt) {
    return cosmeticAt(t);
  }
  if (t >= T_FINISH) return -marginMeters;
  const startVal = cosmeticAt(confirmedAt);
  const frac = (t - confirmedAt) / (T_FINISH - confirmedAt);
  return startVal + (-marginMeters - startVal) * frac;
}

/** 発走前〜直後、ゲート内での縦位置（idx番目の馬、fieldSize頭中）。 */
export function gateY(idx, fieldSize) {
  return 0.12 + (idx / (fieldSize - 1)) * 0.78;
}

/** 道中の隊列内での縦位置（着順とは無関係な演出。自分の馬は画面中央固定）。 */
export function laneY(num, t, { isSelf }) {
  if (isSelf) return 0.47;
  const period = 9;
  const idx = Math.floor(t / period);
  const frac = (t % period) / period;
  const a = viewHash01(num * 23 + idx * 5);
  const b = viewHash01(num * 23 + (idx + 1) * 5);
  const eased = a + (b - a) * frac;
  return 0.32 + eased * 0.30;
}

/** その距離地点がコーナー（湾曲区間）かどうか。 */
export function isCurvingAt(d) {
  return CURVE_SECTIONS.some((s) => d >= s.from && d <= s.to);
}

/** 馬群の広がり(m)からカメラのズーム倍率を求める（広いほど引く）。 */
export function zoomForSpread(spreadMeters) {
  const z = 1 - clamp01((spreadMeters - 15) / 120) * 0.34;
  return Math.max(0.66, Math.min(1, z));
}

/**
 * カメラの目標（追う対象の距離・画面上のアンカー・基準となるレース進行の距離）。
 * @param {"self"|"leader"} mode
 * @param {object} state
 * @param {boolean} state.raceStarted
 * @param {number} state.t - 経過秒
 * @param {number} state.selfDistance - 自分の馬の現在距離(m)
 * @param {number} state.leaderDistance - 先頭馬の現在距離(m)
 */
export function cameraTargetFor(mode, { raceStarted, t, selfDistance, leaderDistance }) {
  const anchor = mode === "leader" ? ANCHOR_LEADER : ANCHOR_SELF;
  if (!raceStarted) {
    return { distance: (anchor - PRESTART_GATE_X) * VIEW_SPAN, anchor, base: 0 };
  }
  const distance = mode === "leader" ? leaderDistance : selfDistance;
  return { distance, anchor, base: distanceAtTime(t) };
}

/**
 * カメラの一次遅れ（時定数0.45秒）の1フレームぶんの計算。前状態が無ければ即座に目標へ合わせる。
 * レース進行（`target.base`の変化）で説明できる分は遅れなく追い、それ以外の「跳び」だけを
 * 減衰オフセットで吸収する（速度に依らず定常誤差ゼロにするための設計。ARCHITECTURE.md§5）。
 * @param {null|{distance:number,anchor:number,base:number,offset:number,anchorOffset:number}} prevState
 * @param {{distance:number,anchor:number,base:number}} target
 * @param {number} dtSeconds
 */
export function stepCamera(prevState, target, dtSeconds) {
  if (!prevState) {
    return {
      rendered: { distance: target.distance, anchor: target.anchor },
      next: { ...target, offset: 0, anchorOffset: 0 },
    };
  }
  const dt = Math.min(0.1, dtSeconds);
  const jump = (target.distance - prevState.distance) - (target.base - prevState.base);
  let offset = prevState.offset - jump;
  let anchorOffset = prevState.anchorOffset - (target.anchor - prevState.anchor);
  const decay = Math.exp(-dt / 0.45);
  offset *= decay;
  anchorOffset *= decay;
  return {
    rendered: { distance: target.distance + offset, anchor: target.anchor + anchorOffset },
    next: { distance: target.distance, anchor: target.anchor, base: target.base, offset, anchorOffset },
  };
}

/** コース上に固定された物（ゲート・距離標識・ゴール標識）の画面上の位置（0..1）。範囲外はnull。 */
export function worldFixedFraction(distance, cameraDistance, anchor) {
  const frac = anchor + (distance - cameraDistance) / VIEW_SPAN;
  if (frac < -0.4 || frac > 1.4) return null;
  return frac;
}

// ===== 走路の湾曲（茶の地・柵・生垣・芝・芝の縞が共有する座標系） =====

/** 湾曲した1点のy座標。ratio: 画面内の横位置(0..1)。両端が高く中央が沈む放物線。 */
export function curveY(baseY, amp, ratio) {
  const v = 2 * ratio - 1;
  return baseY + amp * (1 - v * v);
}

/** 湾曲した横一列の折れ線（[x,y]の配列）。 */
export function curveRow(baseY, amp) {
  const pts = [];
  for (let i = 0; i <= N_SEG; i++) {
    const x = DRAW_X0 + ((DRAW_X1 - DRAW_X0) * i) / N_SEG;
    pts.push([x, curveY(baseY, amp, x / TRACK_W)]);
  }
  return pts;
}

/** 1点[x,y]をSVG path座標の"x,y"表記にする。 */
export function formatPoint(p) {
  return `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
}

/** 上端の折れ線と下端の折れ線から、帯（塗りつぶし面）のSVG path dを組み立てる。 */
export function bandPath(topRow, botRow) {
  return `M${topRow.map(formatPoint).join(" L")} L${botRow.slice().reverse().map(formatPoint).join(" L")} Z`;
}
