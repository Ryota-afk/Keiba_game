#!/usr/bin/env node
// Stopフック：応答を終える前に、最後に書いた文章が日本語かを数える（CLAUDE.md §15）。
// 2026-11-27〜28に報告と質問を英語で4回送ってしまった再発対策（`devlog/wave13b.md`§34）。
// 入力：Claude Codeが標準入力に渡すJSON。Stop（`transcript_path`・`stop_hook_active`）と、
// PreToolUseのAskUserQuestion（`tool_name`・`tool_input.questions`）の両方で使う。
// 判定：最後のassistantの文章（text）で、仮名・漢字の数 ÷（仮名・漢字＋英字）が0.3未満で、
//       英字が40字以上あるときだけ止めて、日本語で書き直すよう伝える。コードやファイル名の英字は
//       日本語の文章に混ざっていても比率を下げきらないので、日本語の報告は止まらない。
import fs from "node:fs";

const JA = /[぀-ヿ㐀-鿿ｦ-ﾟ]/g;
const EN = /[A-Za-z]/g;
const MIN_EN = 40;
const MIN_RATIO = 0.3;

function lastAssistantText(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, "utf8").trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type !== "assistant") continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    const text = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (text.trim()) return text;
  }
  return "";
}

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(input || "{}");
  } catch {
    process.exit(0);
  }
  // PreToolUseフック（AskUserQuestion）：質問・選択肢の文を数える
  const isAsk = payload.tool_name === "AskUserQuestion";
  let text = "";
  if (isAsk) {
    const qs = payload.tool_input?.questions ?? [];
    text = qs
      .flatMap((q) => [q.question, q.header, ...(q.options ?? []).flatMap((o) => [o.label, o.description])])
      .filter(Boolean)
      .join("\n");
  } else {
    if (payload.stop_hook_active || !payload.transcript_path) process.exit(0);
    try {
      text = lastAssistantText(payload.transcript_path);
    } catch {
      process.exit(0);
    }
  }
  // コードブロックとURLは数えない
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/https?:\/\/\S+/g, "");
  const ja = (prose.match(JA) || []).length;
  const en = (prose.match(EN) || []).length;
  if (en < MIN_EN || ja / (ja + en) >= MIN_RATIO) process.exit(0);
  if (isAsk) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            "質問と選択肢が英語で書かれています（CLAUDE.md §15）。日本語で書き直してからAskUserQuestionを呼び直してください。",
        },
      })
    );
    process.exit(0);
  }
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        "最後の返答が英語で書かれています（CLAUDE.md §15：ユーザーへの報告とAskUserQuestionは必ず日本語）。同じ内容を日本語で書き直して送ってください。",
    })
  );
});
