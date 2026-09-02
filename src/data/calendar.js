// レースカレンダーの雛形（ARCHITECTURE.md §3「レースカレンダー」）。
// ⭐1年分を月・週・曜日で固定して30年使い回す。
//
// ⚠️実在の番組表そのもの（一般競走は年約3,325・JRA重賞は年約130の実際の月週割り当て・
// 地方ダートグレードの実開催日）はまだ取得できていない
// （ARCHITECTURE.md §15「1年分の番組表」＝未解決）。
// このファイルは「箱」だけを作る：52週の器と、各週が持てるスロットの形。
// 中身（どの週にどの競馬場・重賞が乗るか）は実データが揃い次第 `gradedRaces.js` 等と
// 突き合わせて埋める。

export const WEEKS_PER_YEAR = 52;

// ⚠️どの月が5週になるかは実カレンダー依存（曜日の並び・うるう年で年ごとに変わる）。
// ここでは四半期の最後（3・6・9・12月）を仮に5週として48+4=52に揃える。
// 実データ取得後、対象年ごとの実際の並びに差し替える。
const FIVE_WEEK_MONTHS = Object.freeze([3, 6, 9, 12]);

/**
 * 52週の雛形を作る。自己完結の純関数（引数を取らず、毎回同じ形を返す）。
 * 各週は {weekNo, month, weekOfMonth, meetings} を持つ。
 * meetings はその週末に開催される競馬場IDの配列で、実データが無い間は空のまま。
 * @returns {{weekNo:number, month:number, weekOfMonth:number, meetings:string[]}[]}
 */
export function buildCalendarSkeleton() {
  const weeks = [];
  let weekNo = 1;
  for (let month = 1; month <= 12; month += 1) {
    const weeksInMonth = FIVE_WEEK_MONTHS.includes(month) ? 5 : 4;
    for (let weekOfMonth = 1; weekOfMonth <= weeksInMonth; weekOfMonth += 1) {
      weeks.push({ weekNo, month, weekOfMonth, meetings: [] });
      weekNo += 1;
    }
  }
  return weeks;
}
