// 卒業式（キャラ作成）のロジック（`devlog/wave02.md`「卒業式の弾——確定した設計」）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⭐この画面で決まるのは「今の自分」ではなく「これからどんな騎手になるか」——
// 声をかけてくる厩舎の得意分野を成績表とわざと噛み合わせないことで、どの厩舎を
// 選んでも最初は不利な鞍に乗ることになる（MAGI・アウフヘーベンの結論）。

import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";
import { DISTANCE_BANDS, SURFACES, STRATEGIES } from "../data/aptitudeCategories.js";

// 成績表の最高評価（V3-b「最高D・残りG〜E」）。最高値を1つだけ立てて同点処理を不要にする。
export const SCHOOL_RECORD_TOP_GRADE = "D";
const LOW_GRADE_POOL = Object.freeze(["G", "F", "E"]);

function pickLowGrade(rand01) {
  return LOW_GRADE_POOL[Math.floor(rand01() * LOW_GRADE_POOL.length) % LOW_GRADE_POOL.length];
}

/**
 * 競馬学校の成績表を作る（V1「距離4・馬場2だけ。saveSeedから生成。プレイヤーは選べない」）。
 * 距離4のうち1つがD・残り3つがG〜E。馬場2のうち1つがD・もう1つがG〜E。
 * @param {number|string} saveSeed
 * @returns {{ distances: object, surfaces: object, topDistance: string, topSurface: string }}
 */
export function generateSchoolRecord(saveSeed) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "graduation", "school-record");
  const topDistance = pick(rand01, DISTANCE_BANDS);
  const distances = {};
  for (const band of DISTANCE_BANDS) {
    distances[band] = band === topDistance ? SCHOOL_RECORD_TOP_GRADE : pickLowGrade(rand01);
  }
  const topSurface = pick(rand01, SURFACES);
  const surfaces = {};
  for (const surface of SURFACES) {
    surfaces[surface] = surface === topSurface ? SCHOOL_RECORD_TOP_GRADE : pickLowGrade(rand01);
  }
  return { distances, surfaces, topDistance, topSurface };
}

// 夢のダービーの判断カードは残り1200m時点の自分の位置（`view/dreamDerbyCommentary.js`の
// `positionBandOf`）で択の組が変わる（ARCHITECTURE.md §12「判断カードは位置で分ける」・
// 2026-09-06にユーザー合意）。位置区分をそのまま脚質の基準段にする——
// 先頭0＝逃げ／前1＝先行／中団2＝差し／後方3＝追込（`data/aptitudeCategories.js`の
// `STRATEGIES`と同じ並び）。
const DREAM_BAND_BASE = Object.freeze({ lead: 0, front: 1, mid: 2, rear: 3 });

/**
 * 夢のダービーの道中・直線の選択から戦法を導く。
 * 残り1200m時点の位置を基準段にし、道中の選択（前へ行く/動かない）で±1、
 * 直線の選択（早く仕掛ける/溜める）で±0.5して四捨五入、0〜3にクランプする。
 * @param {{ midBand?: "lead"|"front"|"mid"|"rear"|null, midForward?: boolean,
 *   stretchEarly?: boolean }} choiceIds - `screens/dreamDerbyEngine.js`が
 *   選んだ択のタグ（`data/judgmentSituations.js`の各択が持つ`forward`/`early`）から詰める。
 *   位置区分が取れない場合（想定外の呼び出し）は後方＝追込を基準にする。
 * @returns {"nige"|"senko"|"sashi"|"oikomi"}
 */
export function strategyFromDreamChoices(choiceIds) {
  const base = DREAM_BAND_BASE[choiceIds?.midBand] ?? DREAM_BAND_BASE.rear;
  const midDelta = choiceIds?.midForward ? -1 : 1;
  const stretchDelta = choiceIds?.stretchEarly ? -0.5 : 0.5;
  const idx = Math.min(3, Math.max(0, Math.round(base + midDelta + stretchDelta)));
  return STRATEGIES[idx];
}

export const DREAM_RECORD_CHOICES = Object.freeze(["accept", "reject"]); // 受け入れる／決別する

/**
 * 戦法4個の適性を、夢の記録への向き合い方から作る。
 * 「受け入れる」＝導出戦法がD・他3つがG〜E。「決別する」＝4つとも固定でE
 * （合計8で、受け入れの合計3〜9と拮抗する。`devlog/wave02.md`）。
 * @param {() => number} rand01
 * @param {"nige"|"senko"|"sashi"|"oikomi"} derivedStrategy
 * @param {"accept"|"reject"} dreamRecordChoice
 */
export function strategyAptitudesFromDreamChoice(rand01, derivedStrategy, dreamRecordChoice) {
  const aptitudes = {};
  for (const s of STRATEGIES) {
    if (dreamRecordChoice === "reject") {
      aptitudes[`strategy:${s}`] = "E";
    } else {
      aptitudes[`strategy:${s}`] = s === derivedStrategy ? SCHOOL_RECORD_TOP_GRADE : pickLowGrade(rand01);
    }
  }
  return aptitudes;
}

export const STABLE_OFFER_COUNT = 3; // V6「3件」

function pickN(rand01, list, n) {
  const pool = [...list];
  const result = [];
  for (let i = 0; i < n && pool.length > 0; i += 1) {
    const idx = Math.floor(rand01() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

/**
 * 卒業式で見せる厩舎3件を選ぶ（V3-a「完全一致（馬場も距離も合う）だけ除外し、残りは乱数」）。
 * 候補が`STABLE_OFFER_COUNT`未満になったら除外条件を無視して補充する（empty state）。
 * @param {number|string} saveSeed
 * @param {object[]} stables - `roster.stables`
 * @param {{ topDistance: string, topSurface: string }} schoolRecord
 * @returns {object[]}
 */
export function offerStables(saveSeed, stables, schoolRecord) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "graduation", "stable-offer");
  const activeStables = stables.filter((s) => s.isActive);
  const exactMatchSpecialty = `${schoolRecord.topSurface}-${schoolRecord.topDistance}`;
  const eligible = activeStables.filter((s) => s.specialty !== exactMatchSpecialty);
  const pool = eligible.length < STABLE_OFFER_COUNT ? activeStables : eligible;
  return pickN(rand01, pool, STABLE_OFFER_COUNT);
}

/**
 * 卒業式の全ての判断を、`createPlayer`にそのまま渡せる形にまとめる。
 * @param {number|string} saveSeed
 * @param {{ distances: object, surfaces: object }} schoolRecord - `generateSchoolRecord`の出力
 * @param {{ midRace?: string|null, stretch?: string|null }} dreamChoiceIds - 夢のダービーの2択
 * @param {"accept"|"reject"} dreamRecordChoice
 * @returns {{ aptitudes: object, derivedStrategy: string }}
 */
export function buildGraduatedAptitudes(saveSeed, schoolRecord, dreamChoiceIds, dreamRecordChoice) {
  const derivedStrategy = strategyFromDreamChoices(dreamChoiceIds);
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "graduation", "strategy-aptitude");
  const strategyAptitudes = strategyAptitudesFromDreamChoice(rand01, derivedStrategy, dreamRecordChoice);
  const aptitudes = {
    ...strategyAptitudes,
    "distance:sprint": schoolRecord.distances.sprint,
    "distance:mile": schoolRecord.distances.mile,
    "distance:intermediate": schoolRecord.distances.intermediate,
    "distance:long": schoolRecord.distances.long,
    "surface:turf": schoolRecord.surfaces.turf,
    "surface:dirt": schoolRecord.surfaces.dirt,
  };
  return { aptitudes, derivedStrategy };
}
