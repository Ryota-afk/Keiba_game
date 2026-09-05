// 画面が複数のdomain関数を組み合わせて呼ぶ箇所をまとめる合成レイヤー
// （CLAUDE.md §5「依存は必ず下向き一方通行：data → core/sim → domain/state/view →
// controllers → screens → app」）。
// ⚠️2026-09-04に新設：それまで`src/controllers/`が存在せず、`domain/career.js`・
// `domain/weekLoop.js`等が画面から一度も呼ばれていなかった。

import { buildGraduatedAptitudes } from "../domain/graduation.js";
import { createPlayer } from "../domain/player.js";

/**
 * 卒業式の全ての判断（成績表・夢の記録への向き合い方・名前・所属厩舎）から、
 * プレイヤーの初期状態を作る。
 * @param {number|string} saveSeed
 * @param {{ schoolRecord: object, dreamChoiceIds: object, dreamRecordChoice: "accept"|"reject",
 *           familyName: string, givenName: string, stableId: string,
 *           startYear: number, difficulty: string, usedNames?: Set<string> }} input
 * @returns {{ player: object, derivedStrategy: string }}
 */
export function completeGraduation(saveSeed, input) {
  const { schoolRecord, dreamChoiceIds, dreamRecordChoice, familyName, givenName, stableId, startYear, difficulty, usedNames } =
    input;
  const { aptitudes, derivedStrategy } = buildGraduatedAptitudes(
    saveSeed,
    schoolRecord,
    dreamChoiceIds,
    dreamRecordChoice
  );
  const player = createPlayer(saveSeed, {
    stableId,
    startYear,
    difficulty,
    familyName,
    givenName,
    aptitudes,
    usedNames,
  });
  return { player, derivedStrategy };
}
