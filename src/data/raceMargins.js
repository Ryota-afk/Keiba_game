// 着差ラベル（実際の競馬で使われる表記）とメートル換算。
// dream-derby-mock2.html（合意済みモック）のMARGIN_POOL/MARGIN_METERSをそのまま転記。

export const MARGIN_POOL = [
  "クビ", "アタマ", "1/2", "3/4", "1", "1.1/4", "1.1/2", "2", "2.1/2",
  "3", "3.1/2", "4", "5", "6", "8", "10", "大差",
];

export const MARGIN_METERS = {
  "クビ": 0.6, "アタマ": 0.3, "1/2": 1.2, "3/4": 1.8, "1": 2.4, "1.1/4": 3.0,
  "1.1/2": 3.6, "2": 4.8, "2.1/2": 6.0, "3": 7.2, "3.1/2": 8.4, "4": 9.6,
  "5": 12.0, "6": 14.4, "8": 19.2, "10": 24.0, "大差": 30,
};

// メートル差→最も近い着差ラベルへの逆引き（掲示板表示用。モックには無い新規関数）。
const LABELS_BY_METERS = Object.keys(MARGIN_METERS).sort(
  (a, b) => MARGIN_METERS[a] - MARGIN_METERS[b]
);

export function marginLabelFor(meters) {
  if (meters <= 0) return "-";
  let closest = LABELS_BY_METERS[0];
  let closestDiff = Math.abs(MARGIN_METERS[closest] - meters);
  for (const label of LABELS_BY_METERS) {
    const diff = Math.abs(MARGIN_METERS[label] - meters);
    if (diff < closestDiff) {
      closest = label;
      closestDiff = diff;
    }
  }
  return closest;
}
