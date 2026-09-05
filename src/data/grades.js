// 記号評価のスケール（G〜S）。ARCHITECTURE.md §3「表示形式はウイポ基準」＝
// 抽象的な等級の枠組みのみを参照した独自スケール（実データの数値は丸写ししていない）。
// 馬の9軸のうち7つ・調教師の能力など、複数のdomainファイルが共有する。

export const GRADE_SCALE = Object.freeze(["G", "F", "E", "D", "C", "B", "A", "S"]);

/** rand01からG〜Sの等級を1つ引く。自己完結の純関数。 */
export function pickGrade(rand01) {
  return GRADE_SCALE[Math.floor(rand01() * GRADE_SCALE.length)];
}

/** 等級を1段上げる。既にSなら変わらない。自己完結の純関数。 */
export function nextGrade(grade) {
  const idx = GRADE_SCALE.indexOf(grade);
  if (idx < 0 || idx >= GRADE_SCALE.length - 1) return grade;
  return GRADE_SCALE[idx + 1];
}

/** 等級を0(G)〜7(S)の数値に変換する。計算式で使うための変換。 */
export function gradeToNumber(grade) {
  const idx = GRADE_SCALE.indexOf(grade);
  return idx < 0 ? 0 : idx;
}
