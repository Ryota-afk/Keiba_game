// 夢のダービー：馬体色・勝負服・枠番色の定数群（リテラルのみ）。
// SILK_COLORS/WAKU_COLORS/FRAME_SIZESはdream-derby-mock2.html（合意済みモック）の転記。

// ===== 馬の毛色（8毛色×役割）。`design/mocks/horse-sprite-v1.html`案C（2026-11-28にユーザーが選んだ）の表。 =====
// 色の値はすべて目で選んだもの。出典（JRAの毛色の定義）が決めているのは「どこが黒いか／明るいか」だけ。
// body=胴・首・頭・脚の上半分／shade=腹の影・耳／mane=たてがみ／tail=尾／leg=脚の下半分（nullは胴と同じ）／
// muzzle=鼻先／hi=背と頬の明るい線（無ければ胴を白へ`hiMix`だけ寄せる）／hoof=蹄（無ければ`HOOF_COLOR`）。
// 芦毛はここに無い（年齢で色が変わる。下の`GRAY_COAT`）。キーは`data/coat.js`の`COAT_IDS`。
export const COAT_PALETTE = {
  bay: { body: "#8a5a32", shade: "#5a3a1e", mane: "#1e1612", tail: "#1e1612", leg: "#1e1612", muzzle: "#2a1c14" },
  darkBay: { body: "#4f3322", shade: "#301e13", mane: "#120d0a", tail: "#120d0a", leg: "#120d0a", muzzle: "#3a2618" },
  brown: { body: "#2b211c", shade: "#1a1310", mane: "#0d0a09", tail: "#0d0a09", leg: "#0d0a09", muzzle: "#6b4a30" },
  black: { body: "#1d1b1e", shade: "#0e0d10", mane: "#0a090b", tail: "#0a090b", leg: null, muzzle: "#0e0d10", hi: "#33313a" },
  chestnut: { body: "#b0682f", shade: "#7a4520", mane: "#c98f52", tail: "#c98f52", leg: null, muzzle: "#7a4520" },
  liverChestnut: { body: "#6e4126", shade: "#4a2a16", mane: "#5a3520", tail: "#5a3520", leg: null, muzzle: "#4a2a16" },
  white: { body: "#f3f0e9", shade: "#cfc9bd", mane: "#fbfaf6", tail: "#fbfaf6", leg: null, muzzle: "#e6b3a6", hoof: "#cdbfa8", hiMix: 0.6 },
};
/** 背と頬の明るい線：胴の色を白へ寄せる割合（毛色の表に`hi`も`hiMix`も無いとき）。 */
export const COAT_HI_MIX = 0.2;

// 芦毛：年齢で濃い側→白い側へ混ぜる（`youngAge`歳が一番濃く、`whiteAge`歳でほぼ白。馬ごとの差は付けない）。
// ⚠️年齢の数字は根拠なし（2026-11-28のユーザー決定。出典は「進度は個体によりまちまち」としか書いていない）。
// 濃い側は元の毛色で2通り：`coatGenes.e === 0`（栗毛系）なら`red`、それ以外は`plain`。⚠️斑はJRAの本文に無い。
export const GRAY_COAT = {
  youngAge: 2,
  whiteAge: 8,
  plain: { body: "#6c6f76", mane: "#35363b" },
  red: { body: "#8f6f62", mane: "#5e4338" },
  whiteBody: "#ebe9e4",
  whiteShade: "#b8b4ac",
  whiteMane: "#e0ddd6",
  muzzle: "#3e3e42",
  shadeDarken: 0.3, // 濃い側の影＝濃い側の胴を黒へこれだけ寄せた色
  hiMix: 0.25,
  legUntil: 0.8, // 混ぜ具合がこれ未満の間だけ脚の下半分を濃く塗る
  dappleUntil: 0.75, // 混ぜ具合がこれ未満の間だけ斑を描く（6歳まで）
  dappleMix: 0.5,
};

/** 白い模様の色・白面と白毛の鼻の桃色・白い脚の蹄の色・ふつうの蹄の色・目の色。 */
export const MARKING_WHITE = "#f6f3ec";
export const NOSE_PINK = "#e6a89c";
export const PALE_HOOF_COLOR = "#c9b89c";
export const HOOF_COLOR = "#221a14";
export const EYE_COLOR = "#111";

/** 馬に`coat`が無いときだけ使う：馬番から決める昔の5色の並び（鹿毛・黒鹿毛・栗毛・芦毛・青毛）。 */
export const LEGACY_COAT_IDS = ["bay", "darkBay", "chestnut", "gray", "black"];

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
