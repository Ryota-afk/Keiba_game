// 判断カード（ARCHITECTURE.md §5「判断カード」）。純ロジック（JSX無し。`data/`・`core/`だけに依存）。
// ⚠️「仮」の位置づけ：正式な効果量（基準幅×賢さ×度胸×疲労）はレースsim本実装
// （⑦・`claude-opus-5`）で確定する。ここでは状況を引く／択を解決する骨組みだけを持つ。

import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";
import { SITUATIONS, SITUATION_CHOICES } from "../data/judgmentSituations.js";

/**
 * 判断カードの状況を1つ引く（道中・直線で計2回。ARCHITECTURE.md §5「回数」）。
 * 自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {string|number} raceKey - そのレースを一意に識別するキー（週×馬など）
 * @param {"midRace"|"stretch"} checkpoint
 */
export function drawSituation(saveSeed, raceKey, checkpoint) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.SIM, raceKey, "card", checkpoint);
  return pick(rand01, SITUATIONS);
}

/** その状況で選べる択の一覧。 */
export function choicesFor(situationId) {
  return SITUATION_CHOICES[situationId] ?? [];
}

/** 選んだ択の効果量（仮）を取り出す。 */
export function resolveChoice(situationId, choiceId) {
  const choice = choicesFor(situationId).find((c) => c.id === choiceId);
  return choice?.effect ?? 0;
}
