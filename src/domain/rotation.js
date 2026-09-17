// ローテーション：各馬が目標のレースを持ち、そこから逆算して前哨戦・帰厩・放牧を組む
// （第10弾・`devlog/wave10.md`）。
//
// ⚠️2026-09-17にユーザーが指摘して作り直した：「調教師は馬の適性にあわせてローテーションを
// 組む」。以前の`pickRotationIntervalWeeks`（2〜7週の乱数）を撤廃し、`arch/horse.md`
// 「各馬が次走の目標を持ち、調教師が決める」を実装する。
//
// `horse.plan = { targetRaceId, targetWeek, prepRaceId, prepWeek, returnWeek }`。
// `plan === null`は未計画（次に`planNextTarget`を呼ぶべき状態）。
// 純ロジック（JSX無し。`data/`・`sim/`・同じ`domain/`内の他ファイルだけに依存）。

import { classIndex } from "../data/classes.js";
import { canRaceOnSurface, isSuitedToSurface } from "../data/surfaceAptitude.js";
import { distanceAptitude } from "../sim/stamina.js";
import { yearIndexBucketFor } from "./weeklyCard.js";
import { canDebutThisWeek } from "./horse.js";
import { isSidelined } from "./fall.js";

// ⭐2026-09-17にユーザーが決定（`devlog/wave10.md`§2）。
export const ROTATION_SEARCH_WEEKS = 52; // 目標を探す範囲
export const ROTATION_MIN_LEAD_WEEKS = 3; // これより近い週は目標にしない
export const PREP_LEAD_WEEKS = 6; // 前哨戦は本番の何週前を狙うか
export const RETURN_LEAD_WEEKS = 3; // 帰厩は前哨戦の何週前か

// ⚠️⚠️**以下の重みはすべて根拠のない仮の値**（`devlog/wave10.md`§3.3・§3.4）。
// 実装後に1頭あたりの年間出走回数（狙い6.3走）を測って合わせ直すこと。
const RANK_WEIGHT = 100; // クラスの段が1つ上がるごとの加点
const PRIZE_WEIGHT = 1e-6; // 1着賞金1億円あたりの加点（同じ段の中の格差を見る）
const DISTANCE_MISMATCH_WEIGHT = 50; // 距離適性が0（最悪）のときの減点
const SURFACE_MISMATCH_PENALTY = 20; // 得意でない面（△止まり）のレースを選んだときの減点
const FAR_WEEK_WEIGHT = 0.3; // 1週遠いごとの減点（近い目標から埋まるようにする）

/** その馬が出られる面（×は除く）を、得意な順に並べる。 */
function candidateSurfaces(horse) {
  return ["turf", "dirt"]
    .filter((s) => canRaceOnSurface(horse.surfaceAptitude, s))
    .sort((a, b) => {
      const aSuited = isSuitedToSurface(horse.surfaceAptitude, a) ? 1 : 0;
      const bSuited = isSuitedToSurface(horse.surfaceAptitude, b) ? 1 : 0;
      return bSuited - aSuited;
    });
}

/** 索引から、その馬が出られるクラス・面のレース一覧を集める（週の昇順・重複無し）。 */
function collectCandidates(horse, yearIndex, week) {
  const bucket = yearIndexBucketFor(horse.classId);
  const minWeek = week + ROTATION_MIN_LEAD_WEEKS;
  const maxWeek = week + ROTATION_SEARCH_WEEKS;
  const result = [];
  for (const surface of candidateSurfaces(horse)) {
    const races = yearIndex.byBucketSurface.get(`${bucket}|${surface}`) ?? [];
    for (const race of races) {
      if (race.week < minWeek || race.week > maxWeek) continue;
      if (race.fillyOnly && horse.gender !== "filly") continue;
      result.push(race);
    }
  }
  return result;
}

/** 目標候補としての点数。格・賞金を主に、距離・馬場の適性で減点し、遠い週をわずかに減点する。 */
function scoreAsTarget(race, horse, week) {
  const distMismatch = 1 - distanceAptitude(horse, race.distance);
  const surfaceMismatch = isSuitedToSurface(horse.surfaceAptitude, race.surface) ? 0 : 1;
  return (
    classIndex(race.classId) * RANK_WEIGHT +
    (race.prize1 ?? 0) * PRIZE_WEIGHT -
    distMismatch * DISTANCE_MISMATCH_WEIGHT -
    surfaceMismatch * SURFACE_MISMATCH_PENALTY -
    (race.week - week) * FAR_WEEK_WEIGHT
  );
}

/** 前哨戦の候補としての点数。目標の`PREP_LEAD_WEEKS`週前に近いほど・距離適性が高いほど良い。 */
function scoreAsPrep(race, horse, targetWeek) {
  const idealWeek = targetWeek - PREP_LEAD_WEEKS;
  const weekGap = Math.abs(race.week - idealWeek);
  const distMismatch = 1 - distanceAptitude(horse, race.distance);
  return -weekGap * 2 - distMismatch * DISTANCE_MISMATCH_WEIGHT;
}

/**
 * 前哨戦を選ぶ。⭐**2026-09-17にユーザーが決定：必ず1つ挙げる。**
 * ⚠️⚠️**例外：目標より前の週に候補が無ければ`null`を返す**（デビュー戦を目標にした
 * 新馬など、そもそも「前哨戦」に使えるレースが存在しない場合）。前哨戦は必ず
 * `target.week`より前の週でなければならない——同じ週に2つのレースには出られない。
 * 目標より格が下（同格を含む）のレースを優先し、無ければ目標より格が上でも構わず
 * 一番近い週のレースを選ぶ。
 * @returns {object|null}
 */
function pickPrepRace(candidates, target, horse) {
  const before = candidates.filter((r) => r.raceId !== target.raceId && r.week < target.week);
  if (before.length === 0) return null;
  const notHarder = before.filter((r) => classIndex(r.classId) <= classIndex(target.classId));
  const pool = notHarder.length > 0 ? notHarder : before;
  let best = pool[0];
  let bestScore = scoreAsPrep(best, horse, target.week);
  for (const race of pool.slice(1)) {
    const s = scoreAsPrep(race, horse, target.week);
    if (s > bestScore) {
      best = race;
      bestScore = s;
    }
  }
  return best;
}

/**
 * その馬の次の計画を立てる（目標→前哨戦→帰厩の逆算）。自己完結の純関数。
 * @param {object} horse
 * @param {{ byBucketSurface: Map<string, object[]> }} yearIndex - `weeklyCard.js`の`buildYearIndex`
 * @param {number} week - 計画を立てる時点の絶対週（「今週」）
 * @returns {{ targetRaceId: string, targetWeek: number, prepRaceId: string|null,
 *   prepWeek: number|null, returnWeek: number }|null} 候補が1つも無ければ`null`
 */
export function planNextTarget(horse, yearIndex, week) {
  const candidates = collectCandidates(horse, yearIndex, week);
  if (candidates.length === 0) return null;

  let target = candidates[0];
  let bestScore = scoreAsTarget(target, horse, week);
  for (const race of candidates.slice(1)) {
    const s = scoreAsTarget(race, horse, week);
    if (s > bestScore) {
      target = race;
      bestScore = s;
    }
  }

  const prep = pickPrepRace(candidates, target, horse);
  const prepWeek = prep ? prep.week : null;
  const returnWeek = (prepWeek ?? target.week) - RETURN_LEAD_WEEKS;

  return {
    targetRaceId: target.raceId,
    targetWeek: target.week,
    prepRaceId: prep ? prep.raceId : null,
    prepWeek,
    returnWeek,
  };
}

/**
 * その馬の計画が古くなっている（立て直しが要る）かどうか。`<=`であること（`<`ではない）
 * に注意——`targetWeek === week`は「今週その馬の目標レースがあった週」を指す。
 * 実際に走って結果処理で`plan: null`にされた馬はこの関数を素通りするが、
 * ⚠️**出走枠から除外された馬・出走できるほど登録が集まらず開催されなかったレースの馬は
 * `plan`が書き換わらないまま残る**——その両方を「今週のうちに立て直す」ため`<=`にしてある
 * （`devlog/wave10.md`§3.5「除外された馬は、その週のうちに目標を組み直す」）。
 */
export function isPlanStale(horse, week) {
  return horse.plan == null || horse.plan.targetWeek <= week;
}

/**
 * 計画が古くなっている馬に、新しい計画を立て直す（週次のNPCレース処理の締めくくりに
 * 呼ぶ・`devlog/wave10.md`§3.5「除外された馬は、その週のうちに目標を組み直す」）。
 * ⭐**これが無いと#95（走りたい馬が積み上がる）が再発する。**
 * 離脱中（怪我）の馬は対象外——治ってから次に呼ばれたときに拾われる。
 * @param {object[]} horses
 * @param {{ byBucketSurface: Map<string, object[]> }} yearIndex
 * @param {number} week
 * @param {number} year
 * @returns {object[]}
 */
export function replanStaleHorses(horses, yearIndex, week, year) {
  return horses.map((h) => {
    if (h.isRetired || isSidelined(h)) return h;
    if (!isPlanStale(h, week)) return h;
    if (h.record.starts === 0 && !canDebutThisWeek(h, week, year)) return h; // 2歳の解禁前
    const plan = planNextTarget(h, yearIndex, week);
    return plan ? { ...h, plan } : h; // 候補が無ければ計画無しのまま（次週また試す）
  });
}
