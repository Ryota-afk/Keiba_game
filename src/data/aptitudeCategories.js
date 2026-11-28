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

/**
 * 距離（メートル）を距離帯へ変換する。純関数。
 * ⚠️⚠️**`src/sim/raceSim.js`の`jockeyAptitudeFactor`と同じ境目にすること**
 * （`sprint`≦1400／`mile`≦1800／`intermediate`≦2400／それ以上`long`）。`src/sim/`は
 * 変更しないため、境目を変えるときは両方を手で揃える（2026-09-27・`domain/aptitudeGrowth.js`
 * が鞍の経験を積む距離帯の判定に使う）。
 */
export function distanceBandOf(distance) {
  if (distance <= 1400) return "sprint";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "intermediate";
  return "long";
}
