// 夢のダービー：レース描画に使う純粋計算のみ（JSX・DOM無し。Node単体テスト可能）。
// dream-derby-mock2.html（合意済みモック）の対応関数を移植。
//
// ⚠️2026-09-06に`distanceAtTime`・`timeAtDistance`・`gapMetersAt`を削除した。
// 各馬の通過距離はレースsim（`src/sim/raceSim.js`）が返す時系列がただ1つの出どころになり、
// 「典型的なレースペース＋演出の揺らぎ」という代役は要らなくなった
// （`gapMetersAt`は80秒以降が横ばいで、馬が所定の位置に止まって見える原因だった）。
// ⭐ここに残るのは座標変換・カメラ・カーブ・内外の演出だけで、着順に触れるものは無い。
// `viewHash01`は演出専用のハッシュで、着順を決める`core/rng.js`のストリームとは別系統
// （前作`Roadrace_Game`は両者を共有して集団が規則的に動いて見えた）。

import {
  VIEW_SPAN,
  ANCHOR_SELF,
  ANCHOR_LEADER,
  PRESTART_GATE_X,
  DRAW_X0,
  DRAW_X1,
  TRACK_W,
  N_SEG,
  CURVE_SECTIONS,
} from "../data/dreamDerbyCourse.js";

/** 演出専用の疑似乱数ハッシュ（結果RNGとは別ストリーム。0以上1未満）。 */
export function viewHash01(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function clamp01(v) {
  return Math.max(0.03, Math.min(0.97, v));
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

/**
 * カメラの目標（追う対象の距離・画面上のアンカー・基準となるレース進行の距離）。
 * ⚠️`base`は「レース進行そのもの」を表す共通の物差しで、先頭馬の距離を使う
 * （2026-09-06にレースsimへ差し替えるまでは全馬共通の仮ペース`distanceAtTime(t)`だった）。
 * 追う対象を切り替えたときだけ`distance`が跳び`base`が跳ばないので、`stepCamera`が
 * その差を「跳び」として拾って減衰させられる。
 * @param {"self"|"leader"} mode
 * @param {object} state
 * @param {boolean} state.raceStarted
 * @param {number} state.selfDistance - 自分の馬の現在距離(m)
 * @param {number} state.leaderDistance - 先頭馬の現在距離(m)
 */
export function cameraTargetFor(mode, { raceStarted, selfDistance, leaderDistance }) {
  const anchor = mode === "leader" ? ANCHOR_LEADER : ANCHOR_SELF;
  if (!raceStarted) {
    return { distance: (anchor - PRESTART_GATE_X) * VIEW_SPAN, anchor, base: 0 };
  }
  const distance = mode === "leader" ? leaderDistance : selfDistance;
  return { distance, anchor, base: leaderDistance };
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
