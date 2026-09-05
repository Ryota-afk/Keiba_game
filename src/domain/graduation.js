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

// 夢のダービーの道中カード（`data/judgmentSituations.js`の`dreamMid`）を
// 「前へ行く」／「動かない」の2軸に分ける（戦法4の写像・1軸目）。
// ⚠️正本に明示の対応表は無く、実装時に決めた解釈（`devlog/wave02.md`に記録）。
const MID_CHOICE_AXIS = Object.freeze({
  splitField: "forward", // 馬群を割って前へ
  takeOutside: "forward", // 外に持ち出す
  holdInside: "hold", // 内で我慢して進路を待つ
  dropBack: "hold", // 一列下げて外へ回す
});

// 夢のダービーの直線カード（`dreamStretch`）を「早く仕掛ける」／「溜める」の2軸に分ける
// （戦法4の写像・2軸目）。
const STRETCH_CHOICE_AXIS = Object.freeze({
  goNow: "early", // ここから追い出す
  sweepOutside: "early", // 外へ持ち出して一気に
  waitFurlong: "hold", // あと1ハロン脚を溜める
  railRun: "hold", // 内をすくう
});

// 2軸×2軸→戦法4（`devlog/wave02.md`「道中×直線の2×2」）。
// forward+early=逃げ（前へ出て早く動く＝先頭を守り続ける）／
// forward+hold=先行（前めの位置を取り、動くタイミングは待つ）／
// hold+early=差し（下げた位置から早めに動く）／hold+hold=追込（下げて最後まで溜める）。
const STRATEGY_BY_AXES = Object.freeze({
  "forward:early": "nige",
  "forward:hold": "senko",
  "hold:early": "sashi",
  "hold:hold": "oikomi",
});

/**
 * 夢のダービーの道中・直線の選択から戦法を導く。
 * @param {{ midRace?: string|null, stretch?: string|null }} choiceIds
 * @returns {"nige"|"senko"|"sashi"|"oikomi"}
 */
export function strategyFromDreamChoices(choiceIds) {
  const midAxis = MID_CHOICE_AXIS[choiceIds?.midRace] ?? "hold";
  const stretchAxis = STRETCH_CHOICE_AXIS[choiceIds?.stretch] ?? "hold";
  return STRATEGY_BY_AXES[`${midAxis}:${stretchAxis}`];
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
