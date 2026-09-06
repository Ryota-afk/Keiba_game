// 夢のダービー：東京芝2400mの距離・時刻・描画座標の定数群。
// dream-derby-mock2.html（合意済みモック）の値をそのまま転記。

export const TOTAL_DISTANCE = 2400;

// 局面の節目は距離で持つ（時刻はレースsimが返す通過距離から都度求める）。
// ⚠️2026-09-06にレースsimへ差し替えた際、時刻→距離の対応表（DIST_CHECKPOINTS）と
// 隊列演出の節目（GAP_T）を削除した。simのペースはレースごとに変わるので、
// 「典型的なレースペース」を仮定した対応表はもう使えない。
export const D_FINAL_STRETCH = 1874; // 4コーナーを回り最後の直線に入る地点
export const D_MID_CARD = 1200; // 道中の判断カード（残り1200m＝レースのちょうど半分）

// チュートリアル発火の時刻定数（レース時計に対する秒）。
// ⚠️発火そのものは`beginRace`からの連鎖（`screens/dreamDerbyEngine.js`）で、この定数は
// 「何秒あたりに出す想定か」の記録として残している。消すと想定値が失われる。
export const T_TUT_CAMERA = 10;
export const T_TUT_DISPLAY = 26;
export const T_TUT_SPEED = 40;

// カメラ・世界座標
export const VIEW_SPAN = 32;
export const ANCHOR_SELF = 0.34;
export const ANCHOR_LEADER = 0.78;
export const PRESTART_GATE_X = 0.08;

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
