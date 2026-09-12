// 金曜の確定（ARCHITECTURE.md §2「週の流れ」：競馬場→鞍→脚質→予報。
// §2「週末に乗れる競馬場は1つ」）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⚠️「仮」の位置づけ（devlog/wave02.md④）：実際の番組表・重賞出走表がまだ無いため、
// 各依頼にどの競馬場・馬場・距離帯のレースが付くかを手続き的に仮生成する。⑦で
// 実データ（史実ローテーション）に差し替える。

import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";
import { JRA_COURSES } from "../data/courses.js";
import { SURFACES, DISTANCE_BANDS } from "../data/aptitudeCategories.js";
import { RIDABLE_SLOTS_PER_WEEK } from "./weeklyRequests.js";

/**
 * 依頼にレースの文脈（競馬場・馬場・距離帯）を仮に割り当てる。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {{ horseId: string }} request
 */
export function resolveRaceContext(saveSeed, week, request) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.REQUESTS, week, request.horseId, "race-context");
  return {
    ...request,
    courseId: pick(rand01, JRA_COURSES).id,
    surface: pick(rand01, SURFACES),
    distanceBand: pick(rand01, DISTANCE_BANDS),
  };
}

/** 依頼一覧にレースの文脈を割り当てた版を返す。 */
export function resolveWeekRaceContexts(saveSeed, week, requests) {
  return requests.map((r) => resolveRaceContext(saveSeed, week, r));
}

/** その週に候補となっている競馬場の一覧（重複無し）。 */
export function courseIdsAvailable(requestsWithContext) {
  return [...new Set(requestsWithContext.map((r) => r.courseId))];
}

/** 指定した競馬場の依頼だけを取り出す。 */
export function mountsAtCourse(requestsWithContext, courseId) {
  return requestsWithContext.filter((r) => r.courseId === courseId);
}

/**
 * 金曜に騎乗を確定する。⚠️週末に乗れる競馬場は1つ——`courseId`を1つ選ぶと、
 * 他の競馬場の依頼は自動的に諦めることになる（§2「主戦2頭が別場で走る週は
 * 片方を諦める」）。質の高い順に、乗れる鞍数（暫定）までを確定する。
 * @param {{courseId:string, quality:number}[]} requestsWithContext
 * @param {string} courseId - プレイヤーが選んだ競馬場
 * @param {number} [maxSlots]
 */
export function confirmMounts(requestsWithContext, courseId, maxSlots = RIDABLE_SLOTS_PER_WEEK) {
  return mountsAtCourse(requestsWithContext, courseId)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, maxSlots)
    .map((mount) => ({ ...mount, declaredStrategy: null })); // 脚質は`declareStrategy`で別途宣言する
}
