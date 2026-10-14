// 騎手の適性の成長（ARCHITECTURE.md §4「適性の成長」・`devlog/wave12.md`§9決定①）。
// 純ロジック（JSX無し。`data/`・同じ`domain/`内の`jockey.js`だけに依存）。
//
// 落馬していない鞍ごとに、その鞍の3つ（走り方・距離帯・馬場）に経験がたまる。1鞍＝1、
// 勝った鞍は3倍、主戦の馬（乗る前の時点で`isMain`）なら走り方だけ2倍（掛け算あり）。
// 経験が1段分の必要量に届くと段が上がるが、適性10個の合計がランクの上限
// （`aptitudeTotalCap`）に届いていれば、同じ種類の中で一番長く乗っていない適性を
// 1段下げてから上げる。下げられるものが無ければ上げない（経験は捨てずに保持）。

import { APTITUDE_KEYS, distanceBandOf } from "../data/aptitudeCategories.js";
import { gradeToNumber, nextGrade, prevGrade, MAX_GRADE } from "../data/grades.js";
import { rankSpec } from "../data/ranks.js";
import {
  WIN_XP_MULTIPLIER,
  MAIN_MOUNT_STRATEGY_XP_MULTIPLIER,
  requiredXpForStep,
} from "../data/aptitudeGrowth.js";
import { growAptitude } from "./jockey.js";

function categoryOf(key) {
  return key.split(":")[0];
}

function aptitudeTotal(aptitudes) {
  return APTITUDE_KEYS.reduce((sum, k) => sum + gradeToNumber(aptitudes[k]), 0);
}

/**
 * 合計の上限に届いたときに1段下げる先を選ぶ。純関数。
 * 同じ種類（`excludeKey`と同じ接頭辞）の中で、`excludeKey`以外・段がG(0)ではないものから、
 * 最後に乗った週が一番古いもの（一度も乗っていない＝`-Infinity`は最古扱い）。同じなら
 * `APTITUDE_KEYS`の並び順で先のもの。降格先が無ければ`null`。
 */
function pickDowngradeCandidate(jockey, excludeKey) {
  const category = categoryOf(excludeKey);
  const candidates = APTITUDE_KEYS.filter(
    (k) => categoryOf(k) === category && k !== excludeKey && jockey.aptitudes[k] !== "G"
  );
  if (candidates.length === 0) return null;
  const lastWeekOf = (k) => jockey.aptitudeLastWeek?.[k] ?? -Infinity;
  candidates.sort((a, b) => {
    const diff = lastWeekOf(a) - lastWeekOf(b);
    if (diff !== 0) return diff;
    return APTITUDE_KEYS.indexOf(a) - APTITUDE_KEYS.indexOf(b);
  });
  return candidates[0];
}

/**
 * 1つの適性キーを1段上げようとする。純関数。
 * ⚠️**最高評価にできる数の上限（既存の`aptitudeSCap`・`growAptitude`）を先に確認する**——
 * 先に確認しないと、その上限で結局上げられないのに合計の上限のために他の適性を
 * 無駄に下げてしまう。
 * @returns {{ jockey: object, applied: boolean, changes: {key:string, from:string, to:string}[] }}
 */
function attemptLevelUp(jockey, key) {
  const current = jockey.aptitudes[key];
  const next = nextGrade(current);
  if (next === current) return { jockey, applied: false, changes: [] }; // 既に最高評価（S+）

  if (next === MAX_GRADE) {
    const cap = rankSpec(jockey.rank)?.aptitudeSCap ?? 0;
    const sCount = Object.values(jockey.aptitudes).filter((g) => g === MAX_GRADE).length;
    if (sCount >= cap) return { jockey, applied: false, changes: [] }; // S上限で上げられない
  }

  const totalCap = rankSpec(jockey.rank)?.aptitudeTotalCap ?? Infinity;
  const changes = [];
  let workingJockey = jockey;
  if (aptitudeTotal(jockey.aptitudes) + 1 > totalCap) {
    const downgradeKey = pickDowngradeCandidate(jockey, key);
    if (!downgradeKey) return { jockey, applied: false, changes: [] }; // 下げる先が無い→上げない
    const from = jockey.aptitudes[downgradeKey];
    const to = prevGrade(from);
    workingJockey = { ...jockey, aptitudes: { ...jockey.aptitudes, [downgradeKey]: to } };
    changes.push({ key: downgradeKey, from, to });
  }

  const grown = growAptitude(workingJockey, key);
  if (grown === workingJockey) return { jockey, applied: false, changes: [] }; // 保険（通常は起きない）
  changes.push({ key, from: current, to: next });
  return { jockey: grown, applied: true, changes };
}

/**
 * 1つの適性キーへ経験を加え、必要なだけ段を上げる（1鞍で複数段上がることもある）。純関数。
 * @param {object} jockey
 * @param {string} key
 * @param {number} xpGain
 * @param {number} week - 最後に乗った週として記録する（段が上がらなくても記録する）
 */
function applyXpToKey(jockey, key, xpGain, week) {
  let nextJockey = {
    ...jockey,
    aptitudeXp: { ...(jockey.aptitudeXp ?? {}), [key]: (jockey.aptitudeXp?.[key] ?? 0) + xpGain },
    aptitudeLastWeek: { ...(jockey.aptitudeLastWeek ?? {}), [key]: week },
  };
  const changes = [];
  while (nextJockey.aptitudes[key] !== MAX_GRADE) {
    const threshold = requiredXpForStep(gradeToNumber(nextJockey.aptitudes[key]));
    const xp = nextJockey.aptitudeXp[key];
    if (xp < threshold) break;
    const result = attemptLevelUp(nextJockey, key);
    if (!result.applied) break; // 上げられない（合計上限で降格先が無い等）→経験は保持して打ち切る
    // ⚠️必要量を引いた残りは持ち越す（次の鞍のぶんと合算される）。捨てない。
    nextJockey = { ...result.jockey, aptitudeXp: { ...result.jockey.aptitudeXp, [key]: xp - threshold } };
    changes.push(...result.changes);
  }
  return { jockey: nextJockey, changes };
}

/**
 * 1鞍の経験をまとめて適用する。純関数。落馬した鞍では呼ばないこと（呼び出し側が判定する）。
 * @param {object} jockey
 * @param {{ strategy: string, distance: number, surface: string, won: boolean,
 *   isMainMount: boolean, week: number }} ride - `isMainMount`は**乗る前**の時点での主戦判定
 * @returns {{ jockey: object, changes: {key:string, from:string, to:string}[] }} `changes`は
 *   上がった・下がった適性を全部含む（上がった分だけ知りたい場合は`to`が`from`より高いものを見る）
 */
export function applyRideExperience(jockey, { strategy, distance, surface, won, isMainMount, week }) {
  const band = distanceBandOf(distance);
  const targets = [
    { key: `strategy:${strategy}`, isStrategy: true },
    { key: `distance:${band}`, isStrategy: false },
    { key: `surface:${surface}`, isStrategy: false },
  ];

  let nextJockey = jockey;
  const allChanges = [];
  for (const { key, isStrategy } of targets) {
    let xpGain = 1;
    if (won) xpGain *= WIN_XP_MULTIPLIER;
    if (isStrategy && isMainMount) xpGain *= MAIN_MOUNT_STRATEGY_XP_MULTIPLIER;
    const { jockey: grown, changes } = applyXpToKey(nextJockey, key, xpGain, week);
    nextJockey = grown;
    allChanges.push(...changes);
  }
  return { jockey: nextJockey, changes: allChanges };
}
