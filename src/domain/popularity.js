// 人気（1番人気〜）を「公開されている情報」だけから作る（2026-09-20のユーザー決定）。
// ⚠️⚠️馬の本当の能力（`horse.abilities`）は使わない——人気が「正解表示」になると、
// プレイヤーは上位人気の馬に乗るだけでよくなり、このゲームの柱（プレイヤー自身の判断に
// 意味があること・CLAUDE.md 0.①）が壊れる。
// ⚠️人気は表示専用。レースの着順は`sim/`が能力から別に決めており、ここでの並びは
// 何にも使われない（`raceOutcome.js`・`npcWeeklyRace.js`・`npcGradedRace.js`が結果へ
// 「乗せるだけ」）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { classIndex, CLASS_LADDER } from "../data/classes.js";
import { gradeToNumber, GRADE_SCALE } from "../data/grades.js";
import { rankIndex, RANK_LADDER } from "../data/ranks.js";

const CLASS_MAX_INDEX = CLASS_LADDER.length - 1;
const GRADE_MAX_INDEX = GRADE_SCALE.length - 1;
const RANK_MAX_INDEX = RANK_LADDER.length - 1;

// 収得賞金を対数で0〜1に潰す基準。「これくらい稼げば見るからに強い」の目安として、
// 日本ダービー1着賞金の仮の値（`data/raceProgram.js`の`DERBY_PURSE_1974`＝4000万円）を使う
// ——条件戦の1着賞金（数百万円）の何倍も稼いでいれば、対数の上でほぼ頭打ち（1.0）にする。
const EARNINGS_REFERENCE = 40_000_000;

// 材料ごとの重み（合計1.0）。「戦績・クラス・賞金」の3つは同じ根（実際に走った結果）を
// 見ているので合計0.70、残り3つ（厩舎・騎手・血統）は「まだ勝っていない馬でも見えている
// 前評判」として合計0.30に割り振った。⚠️新馬戦（全馬0戦）は戦績・クラス・賞金が
// 全馬で並ぶ（後述`recordScore`は0戦なら0固定・クラスは新馬で共通・賞金は0で共通）ため、
// 新馬戦の並びは実質この0.30ぶん＋揺らぎだけで決まる——これが「新馬戦でも並びが決まる」
// という要求（ユーザー決定）の実装箇所。
const WEIGHTS = Object.freeze({
  record: 0.35, // 戦績（勝率・連対率・前走の着順）
  classLevel: 0.2, // クラス
  earnings: 0.15, // 収得賞金
  stable: 0.1, // 厩舎の強さ
  jockey: 0.12, // 鞍上の騎手のランク
  pedigree: 0.08, // 血統（父の現役時代の戦績）
});

// 揺らぎ（乱数）の振れ幅。台形分布（一様乱数2回の差）で±この値まで振れる。
// ⚠️この値だけは「置いた値」ではなく**実測で合わせ込んだ値**（`devlog`の測定スクリプト
// 参照。1番人気の勝率が実データ（優駿達の蹄跡・1972〜1980年重賞899レース）の目安
// 「30〜35%」に収まるよう、0.1刻みで振って探索した）。
const NOISE_SPAN = 0.55;

/** 戦績（勝率0.4・連対率0.3・前走の着順0.3）。0戦の馬は0（新馬戦は全馬これで並ぶ）。 */
function recordScore(horse) {
  const r = horse.record;
  if (!r || r.starts === 0) return 0;
  const winRate = r.wins / r.starts;
  const placeRate = (r.wins + r.seconds + r.thirds) / r.starts;
  const last = r.recentFinishes?.[0];
  const lastFinishScore =
    last && last.fieldSize > 1
      ? Math.max(0, 1 - (last.position - 1) / (last.fieldSize - 1))
      : 0;
  return winRate * 0.4 + placeRate * 0.3 + lastFinishScore * 0.3;
}

/** クラス（新馬〜G1の10段）をそのまま0〜1へ。 */
function classScore(horse) {
  return classIndex(horse.classId) / CLASS_MAX_INDEX;
}

/** 収得賞金を対数で0〜1へ（`EARNINGS_REFERENCE`を参照）。 */
function earningsScore(horse) {
  const earnings = horse.record?.earnings ?? 0;
  return Math.min(1, Math.log1p(earnings) / Math.log1p(EARNINGS_REFERENCE));
}

/** 厩舎の強さ（育てる力・見抜く力・仕上げの平均）。厩舎が引けなければ中間値。 */
function stableScore(horse, stableById) {
  const stable = stableById.get(horse.stableId);
  if (!stable) return 0.5;
  const { developing, scouting, conditioning } = stable.abilities;
  const avg = (gradeToNumber(developing) + gradeToNumber(scouting) + gradeToNumber(conditioning)) / 3;
  return avg / GRADE_MAX_INDEX;
}

/** 鞍上の騎手のランク（新人〜トップの6段）。騎手が引けなければ中間値。 */
function jockeyScore(jockey) {
  if (!jockey) return 0.5;
  return rankIndex(jockey.rank) / RANK_MAX_INDEX;
}

/**
 * 血統（父の現役時代の戦績）。父の情報が引けない（`sireId`が無い・未取得）馬は中間値
 * ——初期ロースターの大半がこれ（配合で生まれた馬だけ`sireId`を持つ。§0.5「配合要素」は
 * 別弾）。父自身の収得賞金（対数）と重賞勝ち数（3勝で頭打ち）を半々で見る。
 */
function pedigreeScore(horse, horseById) {
  if (!horse.sireId) return 0.5;
  const sire = horseById.get(horse.sireId);
  if (!sire) return 0.5;
  const gradedWinScore = Math.min(1, (sire.record?.gradedWins ?? 0) / 3);
  return earningsScore(sire) * 0.5 + gradedWinScore * 0.5;
}

/**
 * 出走馬の人気を「公開されている情報」だけから作る。自己完結の純関数
 * （同じ引数なら常に同じ結果）。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週
 * @param {string} raceKey - このレースを一意に特定する文字列（週の中で重複しないこと。
 *   揺らぎの乱数の種に使う）
 * @param {object[]} field - 人気を付ける出走馬。⚠️**この配列の並び順は変えない**
 *   （呼び出し側が馬番として使っている場合があるため。ここでは並びを読むだけ）
 * @param {Map<string, object>} horseById - ロースター全馬のMap（父の戦績を引くために使う。
 *   引退済みの馬も含めること——種牡馬は引退後も名簿に残る）
 * @param {Map<string, object>} stableById - ロースター全厩舎のMap
 * @param {(horse: object) => object|undefined} getJockeyForHorse - その馬に乗る騎手を引く関数
 *   （プレイヤーの鞍は自分の騎手、それ以外はNPC騎手を返すこと）
 * @returns {Map<string, number>} 馬idごとの人気（1が一番人気）
 */
export function computePopularity(saveSeed, week, raceKey, field, horseById, stableById, getJockeyForHorse) {
  const scored = field.map((horse) => {
    const jockey = getJockeyForHorse(horse);
    const publicScore =
      recordScore(horse) * WEIGHTS.record +
      classScore(horse) * WEIGHTS.classLevel +
      earningsScore(horse) * WEIGHTS.earnings +
      stableScore(horse, stableById) * WEIGHTS.stable +
      jockeyScore(jockey) * WEIGHTS.jockey +
      pedigreeScore(horse, horseById) * WEIGHTS.pedigree;
    const rand01 = streamRandom(saveSeed, RNG_STREAMS.POPULARITY, week, raceKey, horse.id);
    const noise = (rand01() - rand01()) * NOISE_SPAN; // 台形分布・±NOISE_SPAN
    return { id: horse.id, score: publicScore + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  return new Map(scored.map((s, i) => [s.id, i + 1]));
}
