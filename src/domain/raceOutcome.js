// 仮sim（ARCHITECTURE.md §5「レースsim」の本実装は⑦・`claude-opus-5`で行う）。
// ここでは週の進行と各種処理（信頼・金・主戦判定・開示・疲労・落馬）を先に回すための
// 仮の着順決定だけを行う。消耗差・レース傾向・適応能力の成長といった⑦の中身は含まない。
// 純ロジック（JSX無し。`core/`・`data/`・`domain/`の他ファイルだけに依存）。
//
// ⚠️2026-09-15：相手馬を`syntheticRivalScore`で数値だけ手続き生成していたのをやめ、
// ロースターの実在の馬（名前・騎手・戦績を持つ）から実際の出走枠を組むようにした
// （出馬表の画面（案E）が実在の相手馬を必要とするため。`TODO.md`旧#23の指摘の解消）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { gradeToNumber } from "../data/grades.js";
import { drawFieldSize } from "../data/raceProgram.js";
import { canRaceOnSurface } from "../data/surfaceAptitude.js";
import { deriveFavoredStrategy } from "./strategy.js";
import { isSidelined } from "./fall.js";

/** 馬の強さを1つの数値にまとめる（仮の指標。⑦の消耗式に置き換える）。 */
export function horseStrengthScore(horse, declaredStrategy) {
  const a = horse.abilities;
  const gradeSum = [a.sharpness, a.grit, a.flexibility, a.power]
    .map(gradeToNumber)
    .reduce((sum, v) => sum + v, 0); // 0〜60（記号4軸×0〜15）
  let score = a.speed * 0.5 + a.stamina * 0.3 + gradeSum * 2;
  if (declaredStrategy && declaredStrategy === deriveFavoredStrategy(horse)) {
    score += 5; // 得意脚質どおりに乗ったときの仮ボーナス
  }
  return score;
}

/**
 * 実際のロースターから、1頭（`anchorHorse`）を必ず含む出走枠を組む。自己完結の純関数。
 * `domain/npcWeeklyRace.js`・`domain/npcGradedRace.js`と同じ「収得賞金の多い順＋小さな
 * 乱数で同額を割り切る」選抜を使う（質問15「条件戦も同じ」）。
 * @param {() => number} rand01
 * @param {object} anchorHorse - 必ず出走枠に入る馬（プレイヤーの鞍の馬）
 * @param {string} surface
 * @param {object[]} allHorses - ロースター全馬
 * @param {number} fieldSizeTarget - 目標の出走頭数（実際の頭数は候補が少なければこれより減る）
 * @returns {object[]} 出走馬の配列（`anchorHorse`を含む。並び順は収得賞金の多い順＝人気順）
 */
export function assembleRealField(rand01, anchorHorse, surface, allHorses, fieldSizeTarget) {
  const candidates = allHorses
    .filter(
      (h) =>
        h.id !== anchorHorse.id &&
        !h.isRetired &&
        !isSidelined(h) &&
        h.classId === anchorHorse.classId &&
        canRaceOnSurface(h.surfaceAptitude, surface)
    )
    .map((h) => ({ h, key: h.record.earnings + rand01() * 0.001 }));
  const rivalCount = Math.max(0, fieldSizeTarget - 1);
  const rivals = candidates
    .sort((a, b) => b.key - a.key)
    .slice(0, rivalCount)
    .map((x) => x.h);
  return [...[anchorHorse, ...rivals]].sort((a, b) => b.record.earnings - a.record.earnings);
}

/**
 * 仮simでレースを1つ走らせ、着順を決める。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} week
 * @param {{ horseId: string, declaredStrategy?: string|null, surface?: string }} mount
 * @param {object} horse
 * @param {object[]} allHorses - ロースター全馬（相手馬を実在の馬から組むために使う）
 * @param {number} [fatiguePenaltyFactor] - 疲労による騎手の能力低下の係数（1で無補正）。
 *   §6「疲労」が奪う3つのうち「騎手の能力が落ちる」をここで反映する。
 * @param {number} [bonus] - 加算ボーナス（仮）。判断カードの選択などを反映する
 *   （§5「判断カード」の正式な効果量は⑦で確定。それまでの仮の差し込み口）。
 * @returns {{ position: number, fieldSize: number, won: boolean, field: object[],
 *             popularity: number }}
 */
export function runPlaceholderRace(saveSeed, week, mount, horse, allHorses, fatiguePenaltyFactor = 1, bonus = 0) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.SIM, week, mount.horseId);
  const fieldSizeTarget = drawFieldSize(rand01);
  const field = assembleRealField(rand01, horse, mount.surface, allHorses, fieldSizeTarget);
  const fieldSize = field.length;
  // 並びは既に収得賞金の多い順（人気順の仮の指標。質問19・`devlog/wave07.md`「未定」#6）。
  const popularity = field.findIndex((h) => h.id === horse.id) + 1;

  const scored = field
    .map((h) => {
      const isAnchor = h.id === horse.id;
      const base = horseStrengthScore(h, isAnchor ? mount.declaredStrategy : null);
      const factor = isAnchor ? fatiguePenaltyFactor : 1;
      const extra = isAnchor ? bonus : 0;
      return { h, score: base * factor + (rand01() - 0.5) * 30 + extra };
    })
    .sort((a, b) => b.score - a.score);

  const position = scored.findIndex((s) => s.h.id === horse.id) + 1;
  return { position, fieldSize, won: position === 1, field, popularity };
}
