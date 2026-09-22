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
import { aptitudeParamsOf, distanceAptitudeFrom } from "../sim/stamina.js";
import { eligibleBucketsForHorseClass } from "./weeklyCard.js";
import { canDebutThisWeek, weeksSinceLastRace } from "./horse.js";
import { isSidelined } from "./fall.js";
import { streamRandom, RNG_STREAMS } from "../core/rng.js";

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

/** 索引から、その馬が出られるクラス・面のレース一覧を集める（週の昇順・重複無し）。
 * ⭐第11弾・案B-1（`devlog/wave11.md`§7）：新馬クラスの馬は`eligibleBucketsForHorseClass`が
 * 返す複数のバケツ（新馬戦＋未勝利戦）を見る。 */
function collectCandidates(horse, yearIndex, week) {
  const buckets = eligibleBucketsForHorseClass(horse.classId);
  const minWeek = week + ROTATION_MIN_LEAD_WEEKS;
  const maxWeek = week + ROTATION_SEARCH_WEEKS;
  const result = [];
  for (const surface of candidateSurfaces(horse)) {
    for (const bucket of buckets) {
      const races = yearIndex.byBucketSurface.get(`${bucket}|${surface}`) ?? [];
      for (const race of races) {
        if (race.week < minWeek || race.week > maxWeek) continue;
        if (race.fillyOnly && horse.gender !== "filly") continue;
        result.push(race);
      }
    }
  }
  return result;
}

/**
 * その候補レースに、まだ枠が残っているか。⭐第11弾（`devlog/wave11.md`§7）：
 * `remaining`に載っていないレース（重賞・`fieldSize`を持たないレース）は定員の対象外
 * ＝常に枠ありとして扱う（`weeklyCard.js`の`fieldSizeForRace`のコメント参照）。
 * @param {Map<string, number>|null} remaining
 * @param {string} raceId
 */
function hasCapacity(remaining, raceId) {
  if (!remaining || !remaining.has(raceId)) return true;
  return remaining.get(raceId) > 0;
}

/** 目標候補としての点数。格・賞金を主に、距離・馬場の適性で減点し、遠い週をわずかに減点する。
 * ⚠️`aptParams`は`aptitudeParamsOf(horse)`の値——**1頭につき1回だけ求めて使い回すこと**
 * （`TODO.md` #98。候補1件ごとに求め直すと、1頭あたり数百回の同じ計算になる）。 */
function scoreAsTarget(race, horse, aptParams, week) {
  const distMismatch = 1 - distanceAptitudeFrom(aptParams, race.distance);
  const surfaceMismatch = isSuitedToSurface(horse.surfaceAptitude, race.surface) ? 0 : 1;
  return (
    classIndex(race.classId) * RANK_WEIGHT +
    (race.prize1 ?? 0) * PRIZE_WEIGHT -
    distMismatch * DISTANCE_MISMATCH_WEIGHT -
    surfaceMismatch * SURFACE_MISMATCH_PENALTY -
    (race.week - week) * FAR_WEEK_WEIGHT
  );
}

/** 前哨戦の候補としての点数。目標の`PREP_LEAD_WEEKS`週前に近いほど・距離適性が高いほど良い。
 * ⚠️`aptParams`は`scoreAsTarget`と同じ——1頭につき1回だけ求めた値を渡す。 */
function scoreAsPrep(race, aptParams, targetWeek) {
  const idealWeek = targetWeek - PREP_LEAD_WEEKS;
  const weekGap = Math.abs(race.week - idealWeek);
  const distMismatch = 1 - distanceAptitudeFrom(aptParams, race.distance);
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
function pickPrepRace(candidates, target, aptParams) {
  const before = candidates.filter((r) => r.raceId !== target.raceId && r.week < target.week);
  if (before.length === 0) return null;
  const notHarder = before.filter((r) => classIndex(r.classId) <= classIndex(target.classId));
  const pool = notHarder.length > 0 ? notHarder : before;
  let best = pool[0];
  let bestScore = scoreAsPrep(best, aptParams, target.week);
  for (const race of pool.slice(1)) {
    const s = scoreAsPrep(race, aptParams, target.week);
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
 * @param {Map<string, number>|null} [remaining] - ⭐第11弾（`devlog/wave11.md`§7）：
 *   レースごとの残り枠の表（`replanStaleHorses`が週のはじめに1つ作り、馬ごとに使い回す・
 *   消費した分はこの関数の外で減らす）。省略すると定員を見ずに決める（従来どおり）。
 * @returns {{ targetRaceId: string, targetWeek: number, prepRaceId: string|null,
 *   prepWeek: number|null, returnWeek: number }|null} 候補が1つも無ければ`null`
 */
export function planNextTarget(horse, yearIndex, week, remaining = null) {
  const candidates = collectCandidates(horse, yearIndex, week).filter((r) => hasCapacity(remaining, r.raceId));
  if (candidates.length === 0) return null;

  // ⭐距離適性のもと（最適距離・適性の幅）は、比べる距離が変わっても同じ値になる。
  // 1頭につき1回だけ求めて使い回す（`TODO.md` #98の性能問題の原因がここだった）。
  // ⚠️**配列を作らない形（候補を1件ずつ渡す書き方）も試したが速くならなかった**
  // ——`devlog/wave10.md`§6に実測を残してある。
  const aptParams = aptitudeParamsOf(horse);

  let target = candidates[0];
  let bestScore = scoreAsTarget(target, horse, aptParams, week);
  for (const race of candidates.slice(1)) {
    const s = scoreAsTarget(race, horse, aptParams, week);
    if (s > bestScore) {
      target = race;
      bestScore = s;
    }
  }

  const prep = pickPrepRace(candidates, target, aptParams);
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
 * ⭐第11弾（`devlog/wave11.md`§7）：`yearIndex`に載っている`fieldSize`付きのレース
 * （一般競走・オープン特別。重賞は対象外＝`hasCapacity`と同じ理由）を集め、
 * レースごとの「残り枠」の表を作る。既に計画を持っている馬（今週立て直さない馬）の
 * ぶんをあらかじめ引いておく——立て直す馬に配る前に、既存の予約を反映させるため。
 * ⚠️⚠️**設計判断：前哨戦（`prepRaceId`）も目標（`targetRaceId`）と同じ枠を消費する。**
 * 理由：実際に走らせる側（`domain/npcWeeklyRace.js`の`groupByPlannedRace`）は、
 * その週が目標の馬と前哨戦の馬を**同じレースの登録として合算**している。計画を立てる側
 * だけ前哨戦を無視すると、走る側で合算されたときに定員を超える登録がまた起こる
 * （このバグを直すのが今回の目的そのもの）。
 * @param {{ byBucketSurface: Map<string, object[]> }} yearIndex
 * @param {object[]} horses - ロースター全馬（立て直す馬・立て直さない馬の両方）
 * @param {Set<string>} staleIds - 今週立て直す馬のid（このぶんは数えない）
 * @returns {Map<string, number>} raceId → 残り枠
 */
function buildCapacityTable(yearIndex, horses, staleIds) {
  const remaining = new Map();
  for (const races of yearIndex.byBucketSurface.values()) {
    for (const race of races) {
      if (race.fieldSize == null) continue; // 重賞：定員の対象外
      if (!remaining.has(race.raceId)) remaining.set(race.raceId, race.fieldSize);
    }
  }
  for (const h of horses) {
    if (staleIds.has(h.id) || !h.plan) continue;
    for (const raceId of [h.plan.targetRaceId, h.plan.prepRaceId]) {
      if (raceId && remaining.has(raceId)) remaining.set(raceId, remaining.get(raceId) - 1);
    }
  }
  return remaining;
}

/**
 * 計画が古くなっている馬に、新しい計画を立て直す（週次のNPCレース処理の締めくくりに
 * 呼ぶ・`devlog/wave10.md`§3.5「除外された馬は、その週のうちに目標を組み直す」）。
 * ⭐**これが無いと#95（走りたい馬が積み上がる）が再発する。**
 * 離脱中（怪我）の馬は対象外——治ってから次に呼ばれたときに拾われる。
 *
 * ⭐⭐**第11弾（`devlog/wave11.md`§7）：1頭ずつ独立に決めていたのを、その週のぶんを
 * まとめて配る形に変えた。** 前走から空いた週数の多い順（未出走は最優先）に並べ、
 * レースごとの残り枠が尽きるまで順に取らせる——同じ条件の馬が同じレースへ全員殺到し、
 * 他のレースが空になる問題（`devlog/wave11.md`§3）に対応する。
 * ⚠️同値（未出走どうしなど）はごく小さな乱数で割る——厳密な同値順のままだと、同値どうしが
 * 毎週同じ並び順のまま固定され、後ろに並んだ馬がいつまでも先に選べなくなる
 * （`domain/npcWeeklyRace.js`の並べ替えと同じ理由）。
 * @param {number|string} saveSeed
 * @param {object[]} horses
 * @param {{ byBucketSurface: Map<string, object[]> }} yearIndex
 * @param {number} week
 * @param {number} year
 * @returns {object[]}
 */
export function replanStaleHorses(saveSeed, horses, yearIndex, week, year) {
  const staleIds = new Set();
  const staleHorses = [];
  for (const h of horses) {
    if (h.isRetired || isSidelined(h)) continue;
    if (!isPlanStale(h, week)) continue;
    if (h.record.starts === 0 && !canDebutThisWeek(h, week, year)) continue; // 2歳の解禁前
    staleIds.add(h.id);
    staleHorses.push(h);
  }
  if (staleHorses.length === 0) return horses;

  // ⚠️未出走の馬は`weeksSinceLastRace`が`Infinity`を返すため、`+ rand01()*0.001`という
  // 足し算での同値割りは効かない（`Infinity + 有限値`はやはり`Infinity`）。同値かどうかを
  // 先に見てから乱数で比べる2段の比較にする。
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.ROTATION_PLAN, week);
  const ordered = staleHorses
    .map((h) => ({ h, weeks: weeksSinceLastRace(h, week), rand: rand01() }))
    .sort((a, b) => (a.weeks !== b.weeks ? b.weeks - a.weeks : b.rand - a.rand))
    .map((x) => x.h);

  const remaining = buildCapacityTable(yearIndex, horses, staleIds);

  const byId = new Map(horses.map((h) => [h.id, h]));
  for (const horse of ordered) {
    const plan = planNextTarget(horse, yearIndex, week, remaining);
    if (!plan) continue; // 候補（残り枠のあるもの）が無ければ計画無しのまま（次週また試す）
    byId.set(horse.id, { ...horse, plan });
    for (const raceId of [plan.targetRaceId, plan.prepRaceId]) {
      if (raceId && remaining.has(raceId)) remaining.set(raceId, remaining.get(raceId) - 1);
    }
  }
  return horses.map((h) => byId.get(h.id) ?? h);
}
