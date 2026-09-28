// 出馬表のプレビュー（`raceOutcome.js`の`runPlaceholderRace`が実際に使うのと同じ乱数列で
// 出走枠だけを組み、まだ着順は決めない）。質問25＝(ア)「出馬表は月曜の依頼の段階から見せ、
// 金曜の確定で枠番と人気が付く」の実装土台。
// ⚠️同じ`(saveSeed, week, mount.horseId)`から同じ乱数列を導出するため、月曜に見せた枠と
// 実際にレースを解決するときの枠は必ず一致する（呼ぶ回数・順序が結果に影響しないという
// `core/rng.js`の設計どおり）。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { drawFieldSize } from "../data/raceProgram.js";
import { assembleRealField } from "./raceOutcome.js";
import { assignPostPositions } from "../data/postPosition.js";

/**
 * プレイヤーの鞍1つぶんの出走枠を、着順を決めずに組む。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {object} horse - プレイヤーが乗る馬
 * @param {{ horseId: string, surface: string, condition?: string|null }} mount
 * @param {object[]} allHorses - ロースター全馬
 * @param {number} [year] - このレースが実際に開催される暦年。`mount.condition`（重賞の
 *   年齢・性別条件）の年齢を数えるのに使う（`devlog/wave11.md`§12）。`runPlaceholderRace`が
 *   実際に着順を決めるときと同じ枠になるよう、`raceOutcome.js`の`assembleRealField`へ
 *   そのまま渡す。
 * @returns {(object & { postNumber: number, waku: number })[]} 出走馬（馬番・枠番つき）
 */
export function previewEntryField(saveSeed, week, horse, mount, allHorses, year = null) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.SIM, week, mount.horseId);
  const fieldSizeTarget = drawFieldSize(rand01);
  const field = assembleRealField(
    rand01,
    horse,
    mount.surface,
    allHorses,
    fieldSizeTarget,
    mount.condition ?? null,
    year
  );
  return assignPostPositions(field);
}
