// キャリアの長さ（ARCHITECTURE.md §1「デビュー18歳・上限48歳（30年）」の単一の正本）。
// 開始年から数えて30年目の年末の画面のあとで、キャリアは終わる（`domain/careerEnd.js`）。

export const CAREER_YEARS = 30;
export const DEBUT_AGE = 18;
export const CAREER_END_AGE = DEBUT_AGE + CAREER_YEARS; // 48

/** 最後のキャリア年（開始年が1994なら2023）。 */
export function lastCareerYear(startYear) {
  return startYear + CAREER_YEARS - 1;
}
