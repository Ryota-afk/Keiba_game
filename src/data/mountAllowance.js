// 騎乗手当（着順に関係なく乗れば出る。ARCHITECTURE.md §8「騎手の収入」）。
// ⚠️現在の額。1974・1984年は別（未定・実装の弾で置く）。

export const MOUNT_ALLOWANCE = Object.freeze({
  g1: 64500,
  otherGraded: 44500, // その他重賞（G2・G3）
  other: 27500,
});
