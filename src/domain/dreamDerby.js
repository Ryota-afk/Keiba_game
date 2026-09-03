// 夢のダービー（ARCHITECTURE.md §11「導入（最初の3分）」）。
// 「夢の中でトップジョッキーとして日本ダービーに騎乗→ゴールすると夢から覚めて
// 競馬学校の卒業式」。勝つ。ただし選択によっては負ける（負けてもすぐ覚めて先へ進む）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/`の他ファイルだけに依存）。
//
// ⚠️「仮」の位置づけ：本物のレースsim（消耗式・レース傾向・判断カードの正式な効果量）は
// ⑦（`claude-opus-5`）で確定する。ここでは`raceOutcome.js`の仮の強さ指標を流用し、
// 判断カード2回（`domain/judgmentCard.js`）の選択を仮のボーナスとして加える。

import { generateHorse } from "./horse.js";
import { nextGrade } from "../data/grades.js";
import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { horseStrengthScore } from "./raceOutcome.js";
import { drawSituation, resolveChoice } from "./judgmentCard.js";

export const DREAM_FIELD_SIZE = 18; // 実態どおり最大18頭（日本ダービー相当）
export const DREAM_HORSE_KEY = "dream-horse";

const BOOSTED_GRADE_STEPS = 2; // 記号能力を2段引き上げる（上限S）
const BOOSTED_NUMERIC_MIN = 70; // 数値能力（速度・スタミナ）の下限（0〜100スケール中）

/**
 * 夢の中の馬を生成する。⭐架空馬で、後にプレイヤーの主戦馬の父になる
 * （配合が実装されるまで意味を持たない。IDだけ残しておけば後の弾で回収できる）。
 * 「トップジョッキーとして乗る」体験に合わせ、能力を強めに補正する。
 * 自己完結の純関数。
 */
export function generateDreamHorse(saveSeed) {
  const base = generateHorse(saveSeed, DREAM_HORSE_KEY);
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "dream-horse-bias");
  const boostedAbilities = { ...base.abilities };
  boostedAbilities.speed = Math.round(BOOSTED_NUMERIC_MIN + rand01() * (100 - BOOSTED_NUMERIC_MIN));
  boostedAbilities.stamina = Math.round(BOOSTED_NUMERIC_MIN + rand01() * (100 - BOOSTED_NUMERIC_MIN));
  for (const key of ["sharpness", "grit", "flexibility", "wisdom", "health", "power", "mentalStrength"]) {
    let grade = base.abilities[key];
    for (let i = 0; i < BOOSTED_GRADE_STEPS; i += 1) grade = nextGrade(grade);
    boostedAbilities[key] = grade;
  }
  return { ...base, abilities: boostedAbilities };
}

/** 夢の中の相手馬17頭を生成する（実際のNPC馬データが無いため通常どおり手続き的に生成）。 */
export function generateDreamRivals(saveSeed) {
  return Array.from({ length: DREAM_FIELD_SIZE - 1 }, (_, i) =>
    generateHorse(saveSeed, `dream-rival-${i}`)
  );
}

/** 判断カードの状況を2つ引く（道中・直線。ARCHITECTURE.md §5「回数」）。 */
export function drawDreamDerbySituations(saveSeed) {
  return {
    midRace: drawSituation(saveSeed, DREAM_HORSE_KEY, "midRace"),
    stretch: drawSituation(saveSeed, DREAM_HORSE_KEY, "stretch"),
  };
}

/**
 * 夢のダービーの結果を決める。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {object} dreamHorse - `generateDreamHorse`が返した馬
 * @param {object[]} rivals - `generateDreamRivals`が返した17頭
 * @param {{ midRace: string, stretch: string }} choiceIds - プレイヤーが選んだ択のID
 * @returns {{ position: number, fieldSize: number, won: boolean }}
 */
export function resolveDreamDerby(saveSeed, dreamHorse, rivals, choiceIds) {
  const situations = drawDreamDerbySituations(saveSeed);
  const cardBonus =
    resolveChoice(situations.midRace, choiceIds.midRace) +
    resolveChoice(situations.stretch, choiceIds.stretch);

  const rand01 = streamRandom(saveSeed, RNG_STREAMS.SIM, DREAM_HORSE_KEY, "final");
  const noise = (rand01() - 0.5) * 10;
  const ownScore = horseStrengthScore(dreamHorse, null) + cardBonus + noise;
  const rivalScores = rivals.map((rival) => horseStrengthScore(rival, null));
  const position = rivalScores.filter((s) => s > ownScore).length + 1;

  return { position, fieldSize: DREAM_FIELD_SIZE, won: position === 1 };
}
