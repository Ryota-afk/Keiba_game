// 架空馬に付けない名前のうち、優駿達の蹄跡の結果表（`generated/realHorseNames.json`）に載っていない、
// 実在すると確認できた馬の名前。2026-10-12に、生成される名前を調べて見つけた（ユーザー承認・`devlog/wave12.md`§31）。
// ⚠️結果表に載る馬はスクリプト（`tools/build-real-horse-names.mjs`）が自動で拾うので、ここには足さない。
export const BLOCKED_HORSE_NAMES = Object.freeze([
  "オーロラライト",
  "オーロラサンダー",
  "オーロラストーム",
  "オーロラエンブレム",
  "フウリングレイス",
  "リュウジンハーバー",
]);
