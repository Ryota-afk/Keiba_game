// 出走馬の決定（`arch/horse.md`「出走馬の決定（H）」・質問15＝(イ)・`devlog/wave06.md`）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。
//
// 規則：**収得賞金の多い順＋優先出走権**（トライアル上位に本番の出走権）。
// 対応表（どのトライアルがどの本番に効くか）はレース名に埋め込まれており
// （`tools/build-graded-races.mjs`が生成する`trialFor`フィールド）、この関数自体は
// 「誰が優先出走権を持つか（`priorityHorseIds`）」を受け取るだけで、対応表を知らない。

// 優先出走権を何着まで与えるか。⚠️**仮の値**（根拠：JRAの規則をそのまま借りた。
// `devlog/wave07.md`「未定のまま実装に入るもの」#3——上位何着までかは未定のまま
// 実装に入ったため、JRAの規則3着までを仮値として置く）。
export const PRIORITY_ENTRY_RANK_CUTOFF = 3;

/**
 * トライアルの着順（1着から順に並んだ馬idの配列）から、優先出走権を持つ馬idの集合を作る。
 * @param {string[]} trialFinishOrder
 * @returns {Set<string>}
 */
export function priorityEntrantsFromTrialResult(trialFinishOrder) {
  return new Set(trialFinishOrder.slice(0, PRIORITY_ENTRY_RANK_CUTOFF));
}

/**
 * 希望した馬から出走馬を決める。優先出走権を持つ馬を先に確保し、残り枠を
 * 収得賞金の多い順で埋める（希望馬・条件戦も同じ規則。`devlog/wave06.md`質問15）。
 * @param {{ id: string, record: { earnings: number } }[]} candidates - 出走を希望する馬
 * @param {number} fieldSize - 出走枠（`raceProgram.js`の`drawFieldSize`等で決めた頭数）
 * @param {Set<string>} [priorityHorseIds] - 優先出走権を持つ馬のid
 * @returns {{ entries: object[], excluded: object[] }}
 */
export function determineEntries(candidates, fieldSize, priorityHorseIds = new Set()) {
  const byEarningsDesc = (a, b) => b.record.earnings - a.record.earnings;
  const priority = candidates.filter((h) => priorityHorseIds.has(h.id)).sort(byEarningsDesc);
  const rest = candidates.filter((h) => !priorityHorseIds.has(h.id)).sort(byEarningsDesc);
  const combined = [...priority, ...rest];
  return {
    entries: combined.slice(0, fieldSize),
    excluded: combined.slice(fieldSize),
  };
}
