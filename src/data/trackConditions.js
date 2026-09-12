// 馬場状態（ARCHITECTURE.md §5「コースと出走頭数」：良・稍重・重・不良を持つ）。

export const TRACK_CONDITIONS = Object.freeze(["good", "yielding", "soft", "heavy"]); // 良/稍重/重/不良

// 実際の発生確率（暫定・ARCHITECTURE.md §15。実データが無いため、晴れの日が多い
// という一般的な傾向だけを反映した仮の重み。実測して調整する）。
export const TRACK_CONDITION_WEIGHTS = Object.freeze({
  good: 0.6,
  yielding: 0.25,
  soft: 0.1,
  heavy: 0.05,
});
