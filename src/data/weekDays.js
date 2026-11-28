// 土曜・日曜の値と、史実の日付文字列から曜日を出す小さな純関数
// （`domain/weeklyCard.js`が2026-09-17に追加。`TODO.md` #86）。
// 純データ＋純関数のみ（JSX無し）。

export const DAY = Object.freeze({ SAT: "sat", SUN: "sun" });

const WEEKDAY_BY_INDEX = Object.freeze([
  "sun", "mon", "tue", "wed", "thu", "fri", "sat", // Date#getUTCDay()の0〜6と対応
]);

/**
 * "1976-09-12"のような日付文字列から曜日を返す（"sun"|"mon"|...|"sat"）。
 * ⚠️`new Date(str)`のタイムゾーン依存を避けるため、`T00:00:00Z`を付けてUTCで解く。
 * @param {string} dateString - "YYYY-MM-DD"
 * @returns {string}
 */
export function weekdayOfDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return WEEKDAY_BY_INDEX[date.getUTCDay()];
}

/**
 * ⭐重賞が土曜・日曜どちらに置かれるかを、史実の日付から決める（`domain/weeklyCard.js`から移した。
 * `tools/build-graded-races.mjs`が重賞の日を重ならないよう振り直すときにも同じ規則を使うため）。
 * 実測（1972〜1989年の重賞1,400本。`devlog/wave09.md`§9）：日曜92.4%・土曜3.9%・平日3.7%。
 * ⚠️平日の置き場所だけは実データが無い決定——土日しか持たない本作では多数派（日曜）へ寄せる。
 * @param {string|null|undefined} historicalDate - "YYYY-MM-DD"
 * @returns {"sat"|"sun"}
 */
export function dayOfHistoricalDate(historicalDate) {
  if (!historicalDate) return DAY.SUN;
  return weekdayOfDateString(historicalDate) === DAY.SAT ? DAY.SAT : DAY.SUN;
}
