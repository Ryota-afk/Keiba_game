// 今週のすべてのレースの出走枠を、世界の決まりどおりに1回だけ組む（`devlog/wave14.md`§18・§19）。
// 重賞（`npcGradedRace.js`）→一般競走・オープン特別（`npcWeeklyRace.js`）の順。重賞に出る馬は一般競走から外す。
// ⭐**プレイヤーが乗るレースも、他のレースと同じこの枠の1つ。** 週の最初の騎乗の割り当て
// （`domain/weekBooking.js`）・月曜の騎乗依頼（`domain/weeklyRequests.js`）・出馬表
// （`domain/entryListPreview.js`）・走らせる側（`weekLoop.js`・`bootstrap.js`）は、すべてこの関数が
// 返した同じ枠を見る。同じ名簿・同じ週からは必ず同じ枠になる。
// 純ロジック（JSX無し）。

import { planNpcGradedFields } from "./npcGradedRace.js";
import { planNpcWeeklyFields } from "./npcWeeklyRace.js";
import { drawPostOrder } from "./postDraw.js";

/**
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週
 * @param {number} year
 * @param {object[]} horses - ロースター全馬（週の初めの状態）
 * @param {object} [trialResults] - `roster.trialResults`（重賞の優先出走権の材料）
 * @returns {{ gradedFields: { race: object, entries: object[], fieldSize: number }[],
 *   weeklyFields: { race: object, field: object[], fieldSize: number }[], gradedRacedHorseIds: Set<string> }}
 */
export function planWeekFields(saveSeed, week, year, horses, trialResults = {}) {
  // ⭐誰が出るかは今までの順で決め、決まった後に馬番だけを抽選にする（`domain/postDraw.js`）。
  const gradedFields = planNpcGradedFields(week, year, horses, trialResults).map((f) => ({
    ...f,
    entries: drawPostOrder(saveSeed, `${year}-w${week}-${f.race.id}`, f.entries),
  }));
  const gradedRacedHorseIds = new Set();
  for (const f of gradedFields) for (const h of f.entries) gradedRacedHorseIds.add(h.id);
  const weeklyFields = planNpcWeeklyFields(saveSeed, week, year, horses, gradedRacedHorseIds);
  return { gradedFields, weeklyFields, gradedRacedHorseIds };
}

/**
 * 今週の出走枠から、馬idごとに「どのレースのどの枠に入るか」を引く表を作る。
 * @returns {Map<string, { raceId: string, field: object[] }>}
 */
export function fieldIndexByHorse({ gradedFields, weeklyFields }) {
  const index = new Map();
  for (const f of gradedFields) for (const h of f.entries) index.set(h.id, { raceId: f.race.id, field: f.entries });
  for (const f of weeklyFields) for (const h of f.field) index.set(h.id, { raceId: f.race.raceId, field: f.field });
  return index;
}
