// 記号評価のスケール（G〜S）。ARCHITECTURE.md §3「表示形式はウイポ基準」＝
// 抽象的な等級の枠組みのみを参照した独自スケール（実データの数値は丸写ししていない）。
// 馬の9軸のうち7つ・調教師の能力など、複数のdomainファイルが共有する。

export const GRADE_SCALE = Object.freeze(["G", "F", "E", "D", "C", "B", "A", "S"]);

/** rand01からG〜Sの等級を1つ引く。自己完結の純関数。 */
export function pickGrade(rand01) {
  return GRADE_SCALE[Math.floor(rand01() * GRADE_SCALE.length)];
}
