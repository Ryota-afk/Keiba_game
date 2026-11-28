// 馬番の抽選（`devlog/wave16.md`§2 Q8・JRA用語辞典「枠順」：枠順は出馬投票の締め切り後の抽選で決まる）。
// ⭐誰が出走するか（絞り込み）は今までの順で決め、決まった顔ぶれの馬番だけをここで抽選にする。
// ⚠️入力の並びに依らず同じ結果になるよう、馬idで並べてから引く（＝何度かけても同じ。`runFieldRace`でも
// 保険としてかけ直すが、計画の段階で既にかけてあれば何も変わらない）。
// 純ロジック（JSX無し）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";

/**
 * 出走馬を抽選で並べ替える（先頭が1番）。
 * @template {{ id: string }} T
 * @param {number|string} saveSeed
 * @param {string} raceKey - レースごとに固定のキー（`${year}-w${week}-${レースid}`）
 * @param {T[]} field
 * @returns {T[]} 新しい配列
 */
export function drawPostOrder(saveSeed, raceKey, field) {
  const arr = [...field].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.POST_DRAW, raceKey);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand01() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
