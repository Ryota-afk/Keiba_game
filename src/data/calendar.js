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

// 事前シミュレーション（`domain/bootstrap.js`）が無表示で進める期間。開始年Yの2年前から
// Y-1年末までの104週。本編（`player.currentWeek`）はこの続きの週から始まる
// （⭐2026-09-20のユーザー決定。理由：`domain/weeklyCard.js`の番組表は`(週, 年)`の絶対週から
// 作られるため、本編を週1から始めると、事前シミュレーションで既に立てた馬の出走計画
// （`horse.plan.targetWeek`＝事前シミュレーションの絶対週）が指すレースと、本編の同じ絶対週の
// レースが別物になってしまう。週を1へ戻さず続きから始めれば計画がそのまま使える）。
// ⚠️`data/`は`domain/`より下位層なので、この定数の正本はここに置き`domain/bootstrap.js`側が
// 読みにいく（逆方向のimportは依存の向きに反する）。
export const BOOTSTRAP_YEARS = 2;
export const BOOTSTRAP_WEEKS = BOOTSTRAP_YEARS * WEEKS_PER_YEAR; // 104
export const MAIN_TIMELINE_START_WEEK = BOOTSTRAP_WEEKS + 1; // 105

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

/**
 * `player.currentWeek`（キャリア開始から折り返さず数え続ける絶対週）を、暦の中の
 * 1〜52（`buildCalendarSkeleton`の`weekNo`）へ変換する。
 * ⚠️`currentWeek`自体は折り返さない（`domain/weekLoop.js`のコメント参照）——
 * 折り返すのはこの関数が返す値だけ。
 */
export function weekOfYear(absoluteWeek) {
  return ((absoluteWeek - 1) % WEEKS_PER_YEAR) + 1;
}

/**
 * 任意の絶対週の暦年を求める（第10弾・ローテーションが52週先まで番組表を見るために追加）。
 * `domain/weekLoop.js`の`wrapsToNextYear`（`week % WEEKS_PER_YEAR === 0`で繰り上げ）と
 * 同じ規則——52で割り切れる週で年が変わる（週52は今年・週53は来年）。
 * @param {number} absoluteWeek - 求めたい週
 * @param {number} referenceWeek - 年が分かっている基準の絶対週（例：`player.currentWeek`）
 * @param {number} referenceYear - `referenceWeek`の暦年（例：`player.currentYear`）
 */
export function yearForWeek(absoluteWeek, referenceWeek, referenceYear) {
  const refYearIndex = Math.floor((referenceWeek - 1) / WEEKS_PER_YEAR);
  const yearIndex = Math.floor((absoluteWeek - 1) / WEEKS_PER_YEAR);
  return referenceYear + (yearIndex - refYearIndex);
}
