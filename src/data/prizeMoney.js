// 賞金（ARCHITECTURE.md §8「騎手の収入」：本賞金の配分は馬主80%・調教師10%・
// 騎手（進上金）5%・厩務員5%）。
// ⚠️クラスごとの賞金額そのものは未定（ARCHITECTURE.md §15「疲労の増減・各クラスの
// 賞金…は実装の弾で置く」）。ここでは大まかな桁だけを踏襲した暫定値を置く
// （実際のJRA賞金体系を丸写ししたものではない。実装が進んだら計測して調整する）。

export const JOCKEY_PRIZE_SHARE = 0.05; // 進上金5%

export const PLACEHOLDER_PURSE_BY_CLASS = Object.freeze({
  shinba: 3000000,
  maiden: 3000000,
  win1: 5000000,
  win2: 7000000,
  win3: 10000000,
  open: 15000000,
  g3: 30000000,
  g2: 50000000,
  g1: 100000000,
});
