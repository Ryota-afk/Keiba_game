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
import { rankIndex, RANK_LADDER } from "../data/ranks.js";

const CLASS_MAX_INDEX = CLASS_LADDER.length - 1;
const RANK_MAX_INDEX = RANK_LADDER.length - 1;

// 厩舎の「強さ」を勝率・連対率へ寄せて均すshrinkage（ベイズ的縮小推定）の強さ。
// 単位は「仮想の出走数」——厩舎の実際の出走数がこれを大きく上回れば厩舎固有の値が
// 支配的になり、下回れば全体平均へ強く引き戻される。
// ⚠️190厩舎・約5,000頭（1厩舎あたり平均26頭）で、TODO #110の目標（1頭が年6〜10戦）を
// 踏まえると、「所属馬1頭が1年でこなす出走数の上限」程度＝**30走**を選んだ——
// これより出走数が少ない厩舎（走らせている馬が少ない・所属馬が若い等）は、
// 数字が暴れないよう全体平均寄りに均される。
const STABLE_SHRINKAGE_STARTS = 30;

// 収得賞金を対数で0〜1に潰す基準。「これくらい稼げば見るからに強い」の目安として、
// 日本ダービー1着賞金の仮の値（`data/raceProgram.js`の`DERBY_PURSE_1974`＝4000万円）を使う
// ——条件戦の1着賞金（数百万円）の何倍も稼いでいれば、対数の上でほぼ頭打ち（1.0）にする。
const EARNINGS_REFERENCE = 40_000_000;

// 材料ごとの重み（合計1.0）。⚠️**この配分自体が実測で合わせ込んだ値**
// （saveSeed=year1-a/b/c・1974年開始・事前シミュレーション104週＋本編52週で計測。
// スクリプトは`/home/user/Keiba_game`の外・スクラッチパッドに置いた——リポジトリには残していない）。
// 「戦績」を単独で最重要（0.50）にしたのは、勝率・連対率・前走着順が「過去に何度も
// 走った結果の積み重ね」であり、実際のsimの着順と最もよく噛み合ったため
// （測定：戦績の重みを0.35→0.65まで振ったところ、0.45〜0.55の範囲でほぼ横ばいで
// 頭打ちになり、それ以上重くしても1番人気の勝率は上がらなかった）。残り5つは
// 「まだ勝っていない馬でも見えている前評判」として0.50を分け合う。
// ⚠️新馬戦（全馬0戦）は戦績・クラス・賞金が全馬で並ぶ（`recordScore`は0戦なら0固定・
// クラスは新馬で共通・賞金は0で共通）ため、新馬戦の並びは実質「厩舎・騎手・血統＋揺らぎ」
// （重み0.38ぶん）だけで決まる——これが「新馬戦でも並びが決まる」という要求
// （ユーザー決定）の実装箇所。実測でも新馬戦だけの1番人気の勝率は11.5%と、それ以外の
// レース（30.4%）よりはっきり低く出た——新馬戦の人気は「当てにならない前評判」に
// なっている（意図どおり）。
const WEIGHTS = Object.freeze({
  record: 0.5, // 戦績（勝率・連対率・前走の着順）
  classLevel: 0.12, // クラス
  earnings: 0.08, // 収得賞金
  stable: 0.08, // 厩舎の強さ
  jockey: 0.14, // 鞍上の騎手のランク
  pedigree: 0.08, // 血統（父の現役時代の戦績）
});

// 揺らぎ（乱数）の振れ幅。台形分布（一様乱数2回の差）で±この値まで振れる。
// ⚠️この値も実測で合わせ込んだ値。揺らぎを0（完全に決定的な並び）にしても1番人気の
// 勝率は約30%止まりだった——「公開情報だけ」を材料にした時点で、このsimに対する
// 予測力はここが天井（実際のレースがそれだけ拮抗・波乱含みという設計そのものが効いている）。
// 揺らぎを0.1刻みで増やすと1番人気の勝率は素直に下がっていったため、天井から大きく
// 削り過ぎない値（0.05）を選んだ——揺らぎが「無い」わけではなく、僅差の馬どうしの
// 前後を入れ替える程度に働く。
const NOISE_SPAN = 0.05;

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

/**
 * 厩舎の強さ（その厩舎の現役馬が実際に挙げた成績・週1回`computeStableStrengthById`で
 * 事前計算した値）。厩舎が引けなければ中間値。
 */
function stableScore(horse, stableStrengthById) {
  return stableStrengthById.get(horse.stableId) ?? 0.5;
}

/**
 * 厩舎ごとの「強さ」（0〜1）を、**その厩舎の現役馬が実際に挙げた成績**から作る。
 * ⚠️`stable.abilities`（育てる力・見抜く力・仕上げ）は画面のどこにも出ていない
 * 隠しパラメータなので使わない（2026-09-22のユーザー決定・`TODO.md` #109）。
 *
 * 厩舎に所属する現役馬（引退していない馬）の`horse.record`（starts/wins/seconds/thirds）を
 * 合計し、勝率0.5＋連対率0.5で1つの値にする。少数の出走しかない厩舎は数字が暴れる
 * （0走→勝率が定義できない・1走1勝→勝率100%になる等）ため、全体平均へ寄せる
 * shrinkage（`STABLE_SHRINKAGE_STARTS`のコメント参照）を掛ける：
 *   winRate  = (wins + K・avgWinRate)  / (starts + K)
 *   placeRate = (place + K・avgPlaceRate) / (starts + K)
 * 出走が1つも無い厩舎（K・avgWinRate / K = avgWinRate）はちょうど全体平均になる。
 *
 * ⚠️**週に1回、呼び出し側（`domain/weekLoop.js`の`advanceWeek`・`domain/bootstrap.js`の
 * `runBootstrapWeek`）でまとめて計算し、その週の全レースへ使い回すこと。** レースごとに
 * 呼び直すと、190厩舎×全馬の集計を週内のレース数ぶん繰り返すことになり重い。
 * @param {object[]} horses - ロースター全馬（引退済みも含めてよい。ここで現役だけに絞る）
 * @param {Map<string, object>} stableById - ロースター全厩舎のMap（結果に載せる厩舎idの一覧に使う）
 * @returns {Map<string, number>} 厩舎idごとの強さ（0〜1）
 */
export function computeStableStrengthById(horses, stableById) {
  const totalsByStable = new Map();
  let sumStarts = 0;
  let sumWins = 0;
  let sumPlace = 0; // 連対（1〜2着）＋3着＝勝ち＋連対率の分子と同じ定義（`recordScore`のplaceRateに揃える）
  for (const horse of horses) {
    if (horse.isRetired || !horse.stableId) continue;
    const r = horse.record;
    if (!r || r.starts === 0) continue;
    const place = r.wins + r.seconds + r.thirds;
    const t = totalsByStable.get(horse.stableId) ?? { starts: 0, wins: 0, place: 0 };
    t.starts += r.starts;
    t.wins += r.wins;
    t.place += place;
    totalsByStable.set(horse.stableId, t);
    sumStarts += r.starts;
    sumWins += r.wins;
    sumPlace += place;
  }
  const avgWinRate = sumStarts > 0 ? sumWins / sumStarts : 0.5;
  const avgPlaceRate = sumStarts > 0 ? sumPlace / sumStarts : 0.5;

  const result = new Map();
  for (const stableId of stableById.keys()) {
    const t = totalsByStable.get(stableId) ?? { starts: 0, wins: 0, place: 0 };
    const denom = t.starts + STABLE_SHRINKAGE_STARTS;
    const winRate = (t.wins + STABLE_SHRINKAGE_STARTS * avgWinRate) / denom;
    const placeRate = (t.place + STABLE_SHRINKAGE_STARTS * avgPlaceRate) / denom;
    result.set(stableId, Math.min(1, Math.max(0, winRate * 0.5 + placeRate * 0.5)));
  }
  return result;
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
 * @param {Map<string, number>} stableStrengthById - 厩舎idごとの強さ（0〜1・
 *   `computeStableStrengthById`で週1回まとめて作った値をそのまま渡す。厩舎idが
 *   引けなければ中間値0.5）
 * @param {(horse: object) => object|undefined} getJockeyForHorse - その馬に乗る騎手を引く関数
 *   （プレイヤーの鞍は自分の騎手、それ以外はNPC騎手を返すこと）
 * @returns {Map<string, number>} 馬idごとの人気（1が一番人気）
 */
export function computePopularity(
  saveSeed,
  week,
  raceKey,
  field,
  horseById,
  stableStrengthById,
  getJockeyForHorse
) {
  const scored = field.map((horse) => {
    const jockey = getJockeyForHorse(horse);
    const publicScore =
      recordScore(horse) * WEIGHTS.record +
      classScore(horse) * WEIGHTS.classLevel +
      earningsScore(horse) * WEIGHTS.earnings +
      stableScore(horse, stableStrengthById) * WEIGHTS.stable +
      jockeyScore(jockey) * WEIGHTS.jockey +
      pedigreeScore(horse, horseById) * WEIGHTS.pedigree;
    const rand01 = streamRandom(saveSeed, RNG_STREAMS.POPULARITY, week, raceKey, horse.id);
    const noise = (rand01() - rand01()) * NOISE_SPAN; // 台形分布・±NOISE_SPAN
    return { id: horse.id, score: publicScore + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  return new Map(scored.map((s, i) => [s.id, i + 1]));
}
