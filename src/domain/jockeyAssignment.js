// 主戦騎手の割り当て（質問23＝(ウ)・2026-09-15にユーザー決定・`devlog/wave07.md`）。
// 純ロジック（JSX無し。`data/`だけに依存）。
//
// ⚠️**簡略化した実装**：質問23の原文は「条件戦の馬＝厩舎の主戦→2番目に信頼する騎手→
// 空いている騎手の勝率順」という3段階のフォールバックを想定しているが、NPC騎手と厩舎の
// あいだの「信頼」（プレイヤー-厩舎間の`trainerTrust`とは別物）も、NPC騎手ごとの勝率も、
// 今のところどちらも実装されていない（勝率を測るには着順に騎手の能力が反映されている
// 必要があるが、それは`src/sim/`側の未実装項目——`devlog/wave07.md`「未定のまま実装に
// 入るもの」#2）。ここでは`jockey.rank`（ランク）を代理指標として使い、
// 「所属厩舎の騎手→ランクが高い順の騎手」という2段階に単純化する。
// ⚠️**1日8鞍の仮上限は反映しない**——レース処理が「週」単位で「日」を持たず、かつ
// 騎手の騎乗数を消費する経路（着順の計算に騎手の能力を使う仕組み）がまだ無いため、
// 上限を設けても何も変わらない。`src/sim/`に騎手の能力を通す弾で一緒に実装する。

import { rankIndex } from "../data/ranks.js";
import { classIndex } from "../data/classes.js";

// オープン以上に上がった時点で馬ごとの主戦を持つ（`arch/horse.md`「所属厩舎の決まり方」）。
const MIN_OWN_JOCKEY_CLASS_INDEX = classIndex("open");

function rankedActiveJockeys(npcJockeys) {
  return [...npcJockeys].filter((j) => j.isActive).sort((a, b) => rankIndex(b.rank) - rankIndex(a.rank));
}

/**
 * 厩舎ごとの主戦騎手を決める。純関数。
 * 所属騎手（`jockey.stableId`が一致するNPC騎手）がいればそれを使い、いなければ
 * ランク最上位のNPC騎手を割り当てる——⭐複数の厩舎が同じ騎手を共有してよい
 * （史実でも1人の騎手が複数の厩舎の馬に乗る。`devlog/wave07.md`穴5の実測：
 * 「厩舎の重賞騎乗の6割が1人」＝完全専属ではない）。
 * @param {object[]} stables
 * @param {object[]} npcJockeys
 * @returns {Map<string,string|null>} 厩舎id -> 主戦騎手id
 */
export function assignStablePrimaryJockeys(stables, npcJockeys) {
  const jockeyByStableId = new Map();
  for (const jockey of npcJockeys) {
    if (!jockey.isActive || !jockey.stableId) continue;
    if (!jockeyByStableId.has(jockey.stableId)) jockeyByStableId.set(jockey.stableId, jockey);
  }
  const fallback = rankedActiveJockeys(npcJockeys)[0] ?? null;

  const primaryByStable = new Map();
  for (const stable of stables) {
    const own = jockeyByStableId.get(stable.id);
    primaryByStable.set(stable.id, (own ?? fallback)?.id ?? null);
  }
  return primaryByStable;
}

/**
 * 馬ごとの主戦騎手を割り当てる。純関数——引数を書き換えず新しい配列を返す。
 * オープン以上に上がった時点で、まだ`primaryJockeyId`が無ければ付ける
 * （§6「オープンに上がった時点で付く」）。条件戦の馬は厩舎の主戦をそのつど使うだけで、
 * 馬自身には持たせない（`primaryJockeyId`は`null`のまま）。
 * @param {object[]} horses
 * @param {Map<string,string|null>} primaryJockeyByStable - `assignStablePrimaryJockeys`の返り値
 * @param {object[]} npcJockeys
 * @returns {object[]}
 */
export function assignHorsePrimaryJockeys(horses, primaryJockeyByStable, npcJockeys) {
  const ranked = rankedActiveJockeys(npcJockeys);
  const topJockeyId = ranked[0]?.id ?? null;
  return horses.map((horse) => {
    if (horse.isRetired) return horse;
    if (horse.primaryJockeyId) return horse; // 既に付いている
    if (classIndex(horse.classId) < MIN_OWN_JOCKEY_CLASS_INDEX) return horse;
    const primaryJockeyId = primaryJockeyByStable.get(horse.stableId) ?? topJockeyId;
    return { ...horse, primaryJockeyId };
  });
}

/**
 * その馬が今乗るべき騎手のidを引く（条件戦は厩舎の主戦・オープン以上は馬自身の主戦）。
 * 表示・sim側の受け渡しに使う純関数。
 * @param {object} horse
 * @param {Map<string,string|null>} primaryJockeyByStable
 */
export function jockeyIdForHorse(horse, primaryJockeyByStable) {
  if (classIndex(horse.classId) >= MIN_OWN_JOCKEY_CLASS_INDEX && horse.primaryJockeyId) {
    return horse.primaryJockeyId;
  }
  return primaryJockeyByStable.get(horse.stableId) ?? null;
}
