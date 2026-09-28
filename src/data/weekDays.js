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
