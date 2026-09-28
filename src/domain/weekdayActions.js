// 平日の行動の効果（ARCHITECTURE.md §7「得る側の環」「出会いの4経路」・
// §8「継続的な支出」の「人に会う」部分）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/player.js`だけに依存）。
//
// ⚠️7種類のうち、ARCHITECTURE.mdが効果を明記しているのは3つ（朝の調教で乗る／
// 自分から売り込む／人に会う）だけ。残り3つ（体を作る／買い物に行く／牧場・セリを
// 見に行く）は§15が明示的に「未定」としている（買い物＝ショップの価格が未定、
// 牧場・セリ＝デビュー前の馬を押さえる効果が未定、体を作る＝効果そのものの記載が無い）。
// ここでは架空の数値を作らず、それらを明示的なプレースホルダーとして実装する。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { adjustTrust } from "./player.js";
import { rankIndex } from "../data/ranks.js";
import { ACTION_UNLOCK_RANK } from "../data/weekdayActions.js";

/** そのランクでその行動が解禁されているか。 */
export function isActionUnlocked(actionId, rank) {
  const unlockRank = ACTION_UNLOCK_RANK[actionId];
  if (!unlockRank) return false;
  return rankIndex(rank) >= rankIndex(unlockRank);
}

// 朝の調教で乗ると、通うこと自体で信頼が少し上がる（暫定・ARCHITECTURE.md §15）。
export const TRAIN_TRUST_GAIN = 1;

/** 朝の調教で乗る（自分の所属厩舎・信頼が少し上がる）。純関数。 */
export function trainAtOwnStable(player) {
  if (!player.jockey.stableId) return player;
  return {
    ...player,
    trainerTrust: adjustTrust(player.trainerTrust, player.jockey.stableId, TRAIN_TRUST_GAIN),
  };
}

/**
 * 自分から売り込む（干されたときの出口。§7「出会いの4経路」）。
 * ⚠️信頼を要求しない・消費しない（信頼を使うのは「無理を通す」ときだけ。§6）。
 * 成功率はランクと評判で決まる（⚠️係数は暫定・実装が進んだら計測して調整する）。
 * 成功しても即座に依頼は増えない——「来週の依頼一覧に1件乗る」という結果を返すので、
 * 呼び出し側（週の進行）が次週の依頼生成にこれを反映する。
 * @returns {{ success: boolean, targetStableId: string }}
 */
export function pitchForRide(saveSeed, week, player, targetStableId) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.PITCH, week, targetStableId);
  const baseChance = 0.3;
  const rankBonus = rankIndex(player.jockey.rank) * 0.1;
  const reputationBonus = Math.min(0.3, player.reputation / 100);
  const chance = Math.min(0.9, baseChance + rankBonus + reputationBonus);
  return { success: rand01() < chance, targetStableId };
}

// 人に会うのに要る費用（暫定・ARCHITECTURE.md §15）。⚠️払うだけでは信頼は上がらない
// ——行動枠を使って初めて信頼が積まれる（§8「継続的な支出」）。
export const MEET_PEOPLE_COST = 5000;
export const MEET_PEOPLE_TRUST_GAIN = 1;

/**
 * 人に会う（馬主への信頼の副の上げ方。§6「馬主への信頼」）。
 * 金が無ければ行動そのものが取れない。純関数——取れない場合は元のplayerを返す。
 * @returns {{ player: object, success: boolean }}
 */
export function meetOwner(player, ownerId) {
  if (player.money < MEET_PEOPLE_COST) {
    return { player, success: false };
  }
  return {
    player: {
      ...player,
      money: player.money - MEET_PEOPLE_COST,
      ownerTrust: adjustTrust(player.ownerTrust, ownerId, MEET_PEOPLE_TRUST_GAIN),
    },
    success: true,
  };
}

// ⚠️プレースホルダー：ARCHITECTURE.md §15が効果を「未定」としている3つ。
// 行動枠を消費すること自体は成立させるが、数値効果は付けない
// （架空の数値を書かない。CLAUDE.md §0.5「データの丸写しはしない」の逆側の徹底と同じ理由）。

/** 体を作る。⚠️効果未定（ARCHITECTURE.mdに記載なし）。プレースホルダー。 */
export function buildBody(player) {
  return player;
}

/** 買い物に行く。⚠️ショップの価格・品目が未定（§15）。プレースホルダー。 */
export function goShopping(player) {
  return player;
}

/** 牧場・セリを見に行く。⚠️「デビュー前の馬を押さえる」効果が未定（§15）。プレースホルダー。 */
export function visitFarm(player) {
  return player;
}

/** 休む。⚠️疲労システムが未実装のため、現時点では効果が無い。実装が進んだら疲労回復を実装する。 */
export function rest(player) {
  return player;
}
