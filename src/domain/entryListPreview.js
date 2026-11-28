// 出馬表のプレビュー。⭐2026-11-28（`devlog/wave14.md`§18・§19）：プレイヤーが乗るレースの出走枠は、
// 世界のほかのレースと同じ出走枠（`domain/weekFields.js`）の1つ。ここはその枠を、走らせる前に
// そのまま見せるだけ（走らせる側・騎手の割り当て・騎乗依頼と同じ関数の結果なので、必ず一致する）。
// 質問25＝(ア)「出馬表は月曜の依頼の段階から見せ、金曜の確定で枠番と人気が付く」の実装土台。
// 純ロジック（JSX無し。`data/`・同じ`domain/`内の他ファイルだけに依存）。

import { planWeekFields, fieldIndexByHorse } from "./weekFields.js";
import { assignPostPositions } from "../data/postPosition.js";

/**
 * 1つのレースの出走枠を、着順を決めずに返す。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {object} horse - プレイヤーが乗る馬
 * @param {{ horseId: string, raceId?: string }} mount
 * @param {object[]} allHorses - ロースター全馬（週の初めの状態）
 * @param {number} year - 暦年
 * @param {object} [trialResults] - `roster.trialResults`
 * @returns {(object & { postNumber: number, waku: number })[]} 出走馬（馬番・枠番つき）。
 *   その馬が今週どのレースにも出走枠を持たなければ空
 */
export function previewEntryField(saveSeed, week, horse, mount, allHorses, year, trialResults = {}) {
  const index = fieldIndexByHorse(planWeekFields(saveSeed, week, year, allHorses, trialResults));
  const entry = index.get(horse.id);
  if (!entry || (mount.raceId && entry.raceId !== mount.raceId)) return [];
  return assignPostPositions(entry.field);
}
