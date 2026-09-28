// 引退（`arch/horse.md`「⭐ 引退」・質問18＝(ウ)／質問24＝(ア)・計測済み）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/horse.js`だけに依存）。
//
// 架空馬は4つの規則を持つ：①年齢 ②成績 ③怪我 ④繁殖入り。
// ①②③はここ（1頭ずつ判定できる）。④は年に引退する全馬をまとめて収得賞金順に選ぶ必要が
// あるため、年境界の処理（`domain/yearBoundary.js`）側に置く——`selectBreedingHorses`は
// その入力（「今年引退する牡馬・牝馬」の配列）を受け取るだけの純関数としてここに置く。
// 史実馬は史実どおり（最終出走の年を過ぎたら引退）。

import { streamRandom, RNG_STREAMS, chance } from "../core/rng.js";
import { RECENT_FINISHES_WINDOW } from "./horse.js";

// ①年齢：8歳の終わりで必ず引退（1974年の重賞馬405頭の最高齢が8歳・実測）。
export const MAX_AGE_YEARS = 8;
// ②成績：直近6走で1度も5着以内が無ければ引退（`RECENT_FINISHES_WINDOW`と同じ本数）。
export const WINLESS_STREAK_LIMIT = RECENT_FINISHES_WINDOW;
export const WINLESS_STREAK_RANK_CUTOFF = 5;
// ③怪我：骨折した馬の3割が引退。⚠️根拠なし（測る材料が無い・`arch/horse.md`）。
export const FRACTURE_RETIRE_SHARE = 0.3;
// ④繁殖入り：重賞勝ち牡馬は5歳の終わりに種牡馬（年25頭まで・収得賞金順）。
export const SIRE_RETIREMENT_AGE = 5;
export const SIRE_CAP_PER_YEAR = 25;
// 牝馬：引退した牝馬から収得賞金上位425頭/年を繁殖牝馬に。
export const BROODMARE_CAP_PER_YEAR = 425;

/** 馬齢（`bornYear`が無ければ判定できないのでnull）。 */
export function horseAge(horse, currentYear) {
  return horse.bornYear == null ? null : currentYear - horse.bornYear;
}

/** ①年齢による強制引退。 */
export function isPastMaxAge(horse, currentYear) {
  const age = horseAge(horse, currentYear);
  return age != null && age >= MAX_AGE_YEARS;
}

/**
 * ②成績不振による引退。`recentFinishes`（新しい順の直近戦績・`{position,...}`の配列）の
 * 直近`WINLESS_STREAK_LIMIT`走がすべて`WINLESS_STREAK_RANK_CUTOFF`着より下なら引退。
 * 走数が足りなければ判定しない。
 */
export function isWinlessStreakOver(recentFinishes) {
  if (!recentFinishes || recentFinishes.length < WINLESS_STREAK_LIMIT) return false;
  return recentFinishes
    .slice(0, WINLESS_STREAK_LIMIT)
    .every((entry) => entry.position > WINLESS_STREAK_RANK_CUTOFF);
}

/** ③骨折による引退抽選（骨折した瞬間に1回だけ判定する。呼び出し側は骨折時にこれを呼ぶ）。 */
export function rollFractureRetirement(saveSeed, week, horseId) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.NPC_RACE, "fractureRetire", week, horseId);
  return chance(rand01, FRACTURE_RETIRE_SHARE);
}

/**
 * 架空馬の①②による引退判定（③は骨折時に`rollFractureRetirement`で判定済み・
 * ④は`selectBreedingHorses`で別途）。
 */
export function shouldRetireFictionalHorse(horse, currentYear) {
  if (horse.isRetired) return true;
  if (isPastMaxAge(horse, currentYear)) return true;
  if (isWinlessStreakOver(horse.record?.recentFinishes)) return true;
  return false;
}

/**
 * 史実馬：最終出走の年（`historicalFinalYear`）を過ぎたら引退。
 * ⚠️史実馬の生年・引退年データの取り込みは別のパイプライン（`arch/horse.md`「史実の拘束力」
 * ・未実装）。`historicalFinalYear`が無い間は判定しない（何もしない＝安全側）。
 */
export function shouldRetireHistoricalHorse(horse, currentYear) {
  if (horse.isRetired) return true;
  if (horse.historicalFinalYear == null) return false;
  return currentYear > horse.historicalFinalYear;
}

/** 史実馬・架空馬を振り分けて引退判定する。年境界処理から呼ぶ想定。 */
export function shouldRetire(horse, currentYear) {
  return horse.isHistorical
    ? shouldRetireHistoricalHorse(horse, currentYear)
    : shouldRetireFictionalHorse(horse, currentYear);
}

/**
 * ④繁殖入り。その年に引退する馬から種牡馬・繁殖牝馬を選ぶ。純関数。
 * @param {object[]} retiringHorses - その年に引退する架空馬（史実馬は対象外）
 * @returns {{ sireIds: string[], broodmareIds: string[] }}
 */
export function selectBreedingHorses(retiringHorses) {
  const eligibleSires = retiringHorses.filter(
    (h) => h.gender === "colt" && (h.record?.gradedWins ?? 0) >= 1
  );
  const sireIds = eligibleSires
    .sort((a, b) => b.record.earnings - a.record.earnings)
    .slice(0, SIRE_CAP_PER_YEAR)
    .map((h) => h.id);

  const eligibleMares = retiringHorses.filter((h) => h.gender === "filly");
  const broodmareIds = eligibleMares
    .sort((a, b) => b.record.earnings - a.record.earnings)
    .slice(0, BROODMARE_CAP_PER_YEAR)
    .map((h) => h.id);

  return { sireIds, broodmareIds };
}
