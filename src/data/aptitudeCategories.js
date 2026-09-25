// 騎手の適性10個の内訳（ARCHITECTURE.md §4「騎手」）。
// 戦法4・距離4・馬場2＝10。金曜の作戦（脚質の指定）・レースsimの傾向判定など
// 複数の層が同じ分類を参照するため、ここに1箇所だけ持つ。

export const STRATEGIES = Object.freeze(["nige", "senko", "sashi", "oikomi"]); // 逃げ/先行/差し/追込
export const DISTANCE_BANDS = Object.freeze(["sprint", "mile", "intermediate", "long"]); // 〜1400/1401-1800/1801-2400/2401〜
export const SURFACES = Object.freeze(["turf", "dirt"]); // 芝/ダート

/** 騎手の適性10個のキー一覧（`strategy:nige`のように接頭辞で分類を示す）。 */
export const APTITUDE_KEYS = Object.freeze([
  ...STRATEGIES.map((s) => `strategy:${s}`),
  ...DISTANCE_BANDS.map((d) => `distance:${d}`),
  ...SURFACES.map((s) => `surface:${s}`),
]);
