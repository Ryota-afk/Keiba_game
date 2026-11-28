// 重賞に乗れるかどうかの判定（`ARCHITECTURE.md`§6・2026-09-16にユーザーが決定）。
// ⭐**騎手ランクは使わない。** 調教師への信頼と馬主への信頼の両方が要る
// （`src/data/ranks.js`のコメント。中堅の昇格条件が「重賞を勝つ」なのに重賞に乗るには
// 中堅が要る、という行き止まりを解くための決定）。
// 純ロジック（JSX無し。`domain/player.js`だけに依存）。

import { trustFor } from "./player.js";

// ⚠️**閾値は暫定値（実測を見た上での決定・絶対の正解ではない）**。`domain/weekResults.js`の
// `RIDE_TRAINER_TRUST_GAIN`(1)・`WIN_TRAINER_TRUST_GAIN`(3)・`WIN_OWNER_TRUST_GAIN`(3)から、
// 「新人でも数か月ほど鞍を重ねれば届く高さ」を狙って置いた。
// ⭐**馬主の信頼は最初`6`で置いたが高すぎた**——勝ちは希少で多くの馬主に分散するため、
// 厩舎の信頼より上がりにくい。`3`（勝ち1回ぶん）に下げて再測定。
// ⭐**実測（156週＝3年・10シードの通し。`devlog/wave09.md`§10）**：
// 重賞の依頼が初めて出た週は10通り中8通りで到達（平均89週）・2通りは3年以内に到達せず
// （信頼は届いていたが対象馬向けの重賞と番組表の巡り合わせが噛み合わなかった。バグではない）。
export const GRADED_RIDE_TRAINER_TRUST_THRESHOLD = 8;
export const GRADED_RIDE_OWNER_TRUST_THRESHOLD = 3;

// ⭐GIには通算31勝しないと乗れない（2026-11-28にユーザーが決定）。
// 出典：Wikipedia日本語版「見習騎手」——「JRAの内規により…通算勝利度数が31回に満たない騎手はGIおよび
// JpnI競走に騎乗することができない」。GII・GIIIには勝利数の下限が無い（同記事の記述なし）。
// ⚠️この内規ができた年は確認できていない（2005年には運用されていた）。**開始年に関係なく全年代に適用する**
// （1974・1984・1994のどの開始年でも、1983年までの「大レース」＝`g1Like`も含めてGI扱い）。
// 数える勝利数は`player.record.wins`（`domain/playerRecord.js`の通算勝利数）。
export const G1_RIDE_MIN_CAREER_WINS = 31;

/**
 * その馬の重賞に乗れるか。⚠️ランクは見ない。
 * @param {object} player
 * @param {{stableId: string, ownerId: string}} horse
 * @param {"g1"|"g2"|"g3"} [tier] - そのレースの格（`data/gradedTier.js`の`gradedTierOf`）。
 *   省略すると信頼だけで判定する（GIの通算勝利数の条件は見ない）。
 * @returns {boolean}
 */
export function canRideGradedRace(player, horse, tier) {
  if (tier === "g1" && (player.record?.wins ?? 0) < G1_RIDE_MIN_CAREER_WINS) return false;
  return (
    trustFor(player.trainerTrust, horse.stableId) >= GRADED_RIDE_TRAINER_TRUST_THRESHOLD &&
    trustFor(player.ownerTrust, horse.ownerId) >= GRADED_RIDE_OWNER_TRUST_THRESHOLD
  );
}
