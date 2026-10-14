// 夢のダービー：馬体色・勝負服・枠番色の定数群。
// dream-derby-mock2.html（合意済みモック）のCOAT_COLORS/SILK_COLORS/WAKU_COLORS/FRAME_SIZESを
// そのまま転記。

export const COAT_COLORS = [
  { name: "鹿毛", hex: "#8a5a32", dark: "#5a3a1e" },
  { name: "黒鹿毛", hex: "#4a3020", dark: "#2e1c12" },
  { name: "栗毛", hex: "#b0682f", dark: "#7a4520" },
  { name: "芦毛", hex: "#dedcd4", dark: "#a8a49c" },
  { name: "青毛", hex: "#2e2420", dark: "#1a1410" },
];

// 枠番の色（JRAの実際の慣習に合わせた8色の帽色パレット）
export const WAKU_COLORS = [
  { bg: "#ffffff", fg: "#1c1712" }, // 1枠 白
  { bg: "#1c1712", fg: "#ffffff" }, // 2枠 黒
  { bg: "#d0342c", fg: "#ffffff" }, // 3枠 赤
  { bg: "#2f6fe0", fg: "#ffffff" }, // 4枠 青
  { bg: "#f2c230", fg: "#1c1712" }, // 5枠 黄
  { bg: "#2f9e52", fg: "#ffffff" }, // 6枠 緑
  { bg: "#ef8a1e", fg: "#1c1712" }, // 7枠 橙
  { bg: "#e0399a", fg: "#ffffff" }, // 8枠 桃
];

// 18頭を8枠に割り振る頭数（3・4枠だけ3頭、他は2頭）
export const FRAME_SIZES = [2, 2, 2, 3, 3, 2, 2, 2];

// 勝負服の色（馬主の色。自分の馬はこのパレットを使わずマゼンタ固定＝dreamDerbySprite.js側）
export const SILK_COLORS = [
  "#f28c1e", "#f2d21e", "#2f6fe0", "#2fb2a6", "#d0342c", "#3aa64a",
  "#8e44ad", "#f5f5f5", "#1c1c1c", "#7ad6de", "#ff7ab6", "#a0522d",
];

// 自分の馬の勝負服色（固定・マゼンタ）
export const SELF_SILK_COLOR = "#e0399a";
