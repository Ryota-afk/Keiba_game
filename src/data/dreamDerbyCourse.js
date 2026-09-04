// 夢のダービー：東京芝2400mの距離・時刻・描画座標の定数群。
// dream-derby-mock2.html（合意済みモック）の値をそのまま転記。

export const TOTAL_DISTANCE = 2400;

// 実測に基づく時刻→距離のチェックポイント（区間ごとに線形補間）。
// 2:24.0（144.0秒）のゴールタイムと、実際のコーナー2区間に合わせてある。
export const DIST_CHECKPOINTS = [
  { t: 0, d: 0 },
  { t: 15, d: 250 }, // 1コーナーへ
  { t: 33, d: 550 }, // 2コーナーを回りバックストレッチへ
  { t: 60, d: 1000 }, // バックストレッチ
  { t: 90, d: 1500 }, // 3コーナーへ上り坂
  { t: 112, d: 1874 }, // 4コーナーを回り最後の直線へ（=T_FINAL_STRETCH）
  { t: 144, d: TOTAL_DISTANCE }, // ゴール（=T_FINISH）
];

// チュートリアル発火の時刻定数
export const T_TUT_CAMERA = 10;
export const T_TUT_DISPLAY = 26;
export const T_TUT_SPEED = 40;
// 判断カード（道中・直線）の時刻は距離から逆算する（DIST_CHECKPOINTS参照）
export const T_FINAL_STRETCH = 112;
export const T_FINISH = 144; // 2:24.0

// カメラ・世界座標
export const VIEW_SPAN = 32;
export const ANCHOR_SELF = 0.34;
export const ANCHOR_LEADER = 0.78;
export const PRESTART_GATE_X = 0.08;

// 隊列演出（着順とは無関係な揺らぎ）の補間時刻。GAP_T[6]=T_FINAL_STRETCH以降は
// 直線の判断カードで選んだ後にしか確定しない最終着差へ収束させる（view/dreamDerbyRace.js）。
export const GAP_T = [0, T_TUT_CAMERA, T_TUT_DISPLAY, T_TUT_SPEED, 72, 80, T_FINAL_STRETCH, 128, T_FINISH];

// SVG境界（茶の地・柵・生垣・芝・芝の縞）の描画座標定数。
// 全レイヤーが同じ湾曲 dy(u) を共有する1枚のSVG座標系。
export const TRACK_W = 390;
export const TRACK_H = 270;
export const DRAW_X0 = -160;
export const DRAW_X1 = 550;
export const DRAW_Y0 = -120;
export const DRAW_Y1 = 390; // SVGの描画範囲（表示枠より広い）
export const BROWN_TOP = DRAW_Y0;
export const RAIL1_Y = 34;
export const HEDGE_TOP = 41;
export const RAIL2_Y = 60;
export const TURF_TOP = 62;
export const STRIPE_H = 14;
export const TURF_BOTTOM_MARGIN = DRAW_Y1;
export const AMP_MAX = 16; // 湾曲の最大沈み込み(px)
export const N_SEG = 44; // カーブの折れ線分割数
export const POST_SPACING_M = 2.5; // 支柱の間隔（コース上の距離）
export const BUMP_SPACING_M = 1.6; // 生垣の房の間隔（コース上の距離）

// コースが湾曲する区間（1〜2コーナー・3〜4コーナー）
export const CURVE_SECTIONS = [
  { from: 220, to: 580 },
  { from: 1450, to: 1900 },
];
