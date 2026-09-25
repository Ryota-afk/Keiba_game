// 人名（厩舎の調教師・馬主・騎手）の重複回避つき生成。
// ⚠️2026-09-04に新設：以前は各エンティティ生成関数が自分自身のrand01で
// `generateModeledName`を呼んでおり、名前の語彙が増える（消費回数が変わる）たびに
// 後続の抽選（得意分野・能力など）がずれた（実測で確認・`devlog/wave02.md`）。
// ここで名前だけの独立した乱数ストリームを作ることで、エンティティ本体の抽選と
// 完全に切り離す。純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { generateModeledName } from "../data/humanNames.js";

// 姓40×名40＝1600通り。使用済み回避のやり直し上限（`devlog/wave02.md`実測：
// 350人規模でユニーク311・重複35組——上限に達する前にほぼ必ず見つかる）。
const MAX_NAME_ATTEMPTS = 20;

/**
 * 名前を1つ引く。純関数ではあるが、`usedNames`を渡すと破壊的にその中へ追加する
 * （呼び出し側がロースター生成のループで使い切りの集合として渡す想定）。
 * @param {number|string} saveSeed
 * @param {"stable"|"owner"|"jockey"} entityType - 種類ごとに独立したストリームにする
 *   （厩舎の`key=7`と馬主の`key=7`が同じ名前ストリームを踏まないため）
 * @param {string|number} key
 * @param {Set<string>} [usedNames] - 渡すと、この中に無いフルネームが出るまで引き直す
 * @returns {{ familyName: string, givenName: string, fullName: string }}
 */
export function pickHumanName(saveSeed, entityType, key, usedNames) {
  let candidate = null;
  for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
    const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "human-name", entityType, key, attempt);
    candidate = generateModeledName(rand01);
    if (!usedNames || !usedNames.has(candidate.fullName)) break;
  }
  usedNames?.add(candidate.fullName);
  return candidate;
}
