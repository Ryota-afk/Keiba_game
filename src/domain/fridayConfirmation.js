// 金曜の確定（ARCHITECTURE.md §2「週の流れ」：競馬場→鞍→脚質→予報。
// §2「週末に乗れる競馬場は1つ」）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⚠️2026-09-15までここに、依頼へ競馬場・馬場・距離帯を無作為に割り当てる`resolveRaceContext`
// があった（`fridayConfirmation.js`旧版）。開催の無い競馬場が依頼に出る不整合の原因だった
// （通しプレイ①の指摘）。今は`weeklyRequests.js`が`domain/weeklyCard.js`の週の番組表から
// レースを結びつけた状態で依頼を返すため、ここでは「その中から1場を選ぶ」処理だけを持つ。

import { RIDABLE_SLOTS_PER_WEEK } from "./weeklyRequests.js";

/** その週に候補となっている競馬場の一覧（重複無し）。 */
export function courseIdsAvailable(requests) {
  return [...new Set(requests.map((r) => r.courseId))];
}

/** 指定した競馬場の依頼だけを取り出す。 */
export function mountsAtCourse(requests, courseId) {
  return requests.filter((r) => r.courseId === courseId);
}

/**
 * 金曜に騎乗を確定する。⚠️週末に乗れる競馬場は1つ——`courseId`を1つ選ぶと、
 * 他の競馬場の依頼は自動的に諦めることになる（§2「主戦2頭が別場で走る週は
 * 片方を諦める」）。質の高い順に、乗れる鞍数（暫定）までを確定する。
 * @param {{courseId:string, quality:number}[]} requests
 * @param {string} courseId - プレイヤーが選んだ競馬場
 * @param {number} [maxSlots]
 */
export function confirmMounts(requests, courseId, maxSlots = RIDABLE_SLOTS_PER_WEEK) {
  return mountsAtCourse(requests, courseId)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, maxSlots)
    .map((mount) => ({ ...mount, declaredStrategy: null })); // 脚質は`declareStrategy`で別途宣言する
}
