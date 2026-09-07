// 記号評価のスケール（G〜S+）。ARCHITECTURE.md §3「表示形式はウイポ基準」＝
// 抽象的な等級の枠組みのみを参照した独自スケール（実データの数値は丸写ししていない）。
// 馬の9軸のうち7つ・調教師の能力など、複数のdomainファイルが共有する。
//
// ⚠️2026-09-07にユーザー決定で8段→16段へ拡張した（`design/rights-check.md`§9：史実馬の
// 能力値をウイニングポストから取り込むことになり、ウイポの記号が`+`付き16段のため。
// 8段に畳むと`+`を落としてBに集まり差が消える——実測：ダービー馬50頭中、根性B+が23頭・
// パワーB+が22頭）。
// ⚠️**同じ`saveSeed`で生成される馬は変わる**（`pickGrade`が引く一様乱数の分母が
// 8→16になるため。乱数の分布そのものは変えていない＝平均は変わらない）。
export const GRADE_SCALE = Object.freeze([
  "G", "G+", "F", "F+", "E", "E+", "D", "D+", "C", "C+", "B", "B+", "A", "A+", "S", "S+",
]);

/** 最高評価（スケールの末尾）。「Sが上限」という決め打ちをしたい呼び出し側はこれを使う。 */
export const MAX_GRADE = GRADE_SCALE[GRADE_SCALE.length - 1];

/** rand01からG〜S+の等級を1つ引く。自己完結の純関数。 */
export function pickGrade(rand01) {
  return GRADE_SCALE[Math.floor(rand01() * GRADE_SCALE.length)];
}

/** 等級を1段上げる。既に最高評価（S+）なら変わらない。自己完結の純関数。 */
export function nextGrade(grade) {
  const idx = GRADE_SCALE.indexOf(grade);
  if (idx < 0 || idx >= GRADE_SCALE.length - 1) return grade;
  return GRADE_SCALE[idx + 1];
}

/** 等級を0(G)〜15(S+)の数値に変換する。計算式で使うための変換。 */
export function gradeToNumber(grade) {
  const idx = GRADE_SCALE.indexOf(grade);
  return idx < 0 ? 0 : idx;
}
