// 金曜の確定（ARCHITECTURE.md §2「週の流れ」：競馬場→鞍→脚質→予報。
// §2「1日1場」——2026-09-16にユーザーが「週末に1つ」から変更を決定）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⚠️2026-09-15までここに、依頼へ競馬場・馬場・距離帯を無作為に割り当てる`resolveRaceContext`
// があった（`fridayConfirmation.js`旧版）。開催の無い競馬場が依頼に出る不整合の原因だった
// （通しプレイ①の指摘）。今は`weeklyRequests.js`が`domain/weeklyCard.js`の週の番組表から
// レースを結びつけた状態で依頼を返すため、ここでは「その中から場を選ぶ」処理だけを持つ。
//
// ⚠️⚠️**2026-09-17に「週末に1つ」から「1日1場」へ変更**（`devlog/wave09.md`§1③）。
// 土曜・日曜それぞれ独立に競馬場を1つ選べる。`courseByDay`は`{ sat: courseId|null,
// sun: courseId|null }`の形（どちらかが`null`ならその日は行かない＝依頼を全部諦める）。

import { RIDABLE_SLOTS_PER_WEEK } from "./weeklyRequests.js";
import { DAY } from "../data/weekDays.js";

/**
 * その週に候補となっている競馬場を、土曜・日曜別に返す（重複無し）。
 * @param {{day:string, courseId:string}[]} requests
 * @returns {{ sat: string[], sun: string[] }}
 */
export function courseIdsAvailable(requests) {
  const result = { [DAY.SAT]: [], [DAY.SUN]: [] };
  for (const day of [DAY.SAT, DAY.SUN]) {
    result[day] = [...new Set(requests.filter((r) => r.day === day).map((r) => r.courseId))];
  }
  return result;
}

/** 指定した日・競馬場の依頼だけを取り出す。 */
export function mountsAtCourse(requests, day, courseId) {
  return requests.filter((r) => r.day === day && r.courseId === courseId);
}

/**
 * 既定の乗る馬の選び方（`chooseMounts`を渡さないヘッドレス実行での既定動作。
 * `tools/measure-trust-growth.mjs`のような計測ツールが従来どおり動き続けるようにする）。
 * 質の高い順に、同じレースは1頭だけ残して`maxSlots`まで選ぶ。
 * ⭐**計測ツールが「既定の選び方のまま、誰が選ばれたかも見たい」場合はこれを直接使う**
 * （`chooseMounts`へ薄いラッパーとして渡せば、挙動を変えずに結果を観測できる）。
 * @param {{raceId:string, quality:number}[]} candidates
 * @param {number} maxSlots
 * @returns {object[]}
 */
export function defaultChooseMounts(candidates, maxSlots) {
  // 同じraceIdが複数あれば、質の高いほうだけを残す（1レース1頭）。
  const bestByRace = new Map();
  for (const mount of candidates) {
    const current = bestByRace.get(mount.raceId);
    if (!current || mount.quality > current.quality) bestByRace.set(mount.raceId, mount);
  }
  return [...bestByRace.values()].sort((a, b) => b.quality - a.quality).slice(0, maxSlots);
}

/**
 * 金曜に騎乗を確定する。⭐**1日1場**——土曜・日曜それぞれで競馬場を1つずつ選べる
 * （`courseByDay`のどちらかが`null`ならその日は行かない）。選ばなかった日・競馬場の
 * 依頼は自動的に諦めることになる（§2「主戦2頭が別々の競馬場で走る週は片方を諦める」）。
 * ⭐**乗る馬を選ぶのはプレイヤーの判断**（2026-09-17に`chooseMounts`を追加・
 * `devlog/wave09.md`§12・`devlog/wave10.md`§8）。`chooseMounts`を渡さなければ
 * `defaultChooseMounts`（質の高い順の自動選択）を使う——ヘッドレスの計測ツールはこちら。
 * ⚠️⚠️**同じレースには1頭にしか乗れない**（2026-09-17に追加）。依頼の41%は別の依頼と
 * 同じレースに重なる（`devlog/wave09.md`§3の実測）。⭐**画面側が選ばせないようにするのが
 * 先だが、`chooseMounts`が返した一覧にも安全網をかける**——同じ`raceId`が複数あれば
 * 先に出てきたほうだけを残し、`maxSlots`件を超えた分は切り捨てる。
 * @param {{raceId:string, day:string, courseId:string, quality:number}[]} requests
 * @param {{ sat: string|null, sun: string|null }} courseByDay - 土曜・日曜に選んだ競馬場
 * @param {number} [maxSlots]
 * @param {(candidates: object[], maxSlots: number) => object[]} [chooseMounts] - プレイヤーが
 *   選んだ依頼を返す関数。`candidates`は選んだ場の依頼一覧（`raceId`の重複あり得る）。
 */
export function confirmMounts(requests, courseByDay, maxSlots = RIDABLE_SLOTS_PER_WEEK, chooseMounts) {
  const candidates = [DAY.SAT, DAY.SUN]
    .filter((day) => courseByDay[day])
    .flatMap((day) => mountsAtCourse(requests, day, courseByDay[day]));

  const selected = chooseMounts ? chooseMounts(candidates, maxSlots) : defaultChooseMounts(candidates, maxSlots);

  // 安全網：同じraceIdが複数あれば先勝ちで1頭にし、maxSlotsを超えた分は切り捨てる。
  const seenRaceIds = new Set();
  const deduped = [];
  for (const mount of selected) {
    if (seenRaceIds.has(mount.raceId)) continue;
    seenRaceIds.add(mount.raceId);
    deduped.push(mount);
  }

  return deduped.slice(0, maxSlots).map((mount) => ({ ...mount, declaredStrategy: null })); // 脚質は`declareStrategy`で別途宣言する
}
