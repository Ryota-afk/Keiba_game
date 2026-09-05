// 難易度（4段・ARCHITECTURE.md §9「難易度（悪魔の釜）」）。
// 呼び名は2026-09-03にユーザーが確定（CLAUDE.md §8の手順で候補提示→選択）。
// ⚠️効く対象（相手の強さ・賞金/信頼の倍率）の具体的な数値は未定（ARCHITECTURE.md §15）。

export const DIFFICULTIES = Object.freeze(["easy", "normal", "hard", "brutal"]);

export const DIFFICULTY_LABELS = Object.freeze({
  easy: "やさしい",
  normal: "ふつう",
  hard: "きびしい",
  brutal: "過酷",
});

export const DEFAULT_DIFFICULTY = "normal";
