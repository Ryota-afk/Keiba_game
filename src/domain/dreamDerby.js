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
import { resolveChoice } from "./judgmentCard.js";
import { T_FINISH } from "../data/dreamDerbyCourse.js";
import { DERBY_WINNERS, KENSHO_DERBY_WINNERS } from "../data/derbyWinners.js";
import { displayJockeyName, displayTrainerName } from "../data/derbyPeopleNames.js";

export const DREAM_FIELD_SIZE = 18; // 実態どおり最大18頭（日本ダービー相当）
export const DREAM_HORSE_KEY = "dream-horse";

const BOOSTED_GRADE_STEPS = 2; // 記号能力を2段引き上げる（上限S）
const BOOSTED_NUMERIC_MIN = 70; // 数値能力（速度・スタミナ）の下限（0〜100スケール中）

// ⚠️「仮」の換算定数（正式なレースsim実装・⑦・claude-opus-5で消耗式に置き換える）。
// スコア差→着差(m)・タイムの換算はここでは単純な線形近似にとどめる。
const PAR_SCORE = 60; // horseStrengthScoreの基準点（仮の「平均的な強さ」）
const SECONDS_PER_SCORE_POINT = 0.012; // 仮：スコア1点あたりのゴールタイム短縮(秒)
const METERS_PER_SCORE_POINT = 0.3; // 仮：隣接順位間のスコア差→着差(m)換算
const MIN_ADJACENT_GAP_M = 0.3; // 「アタマ」未満には縮まらない下限
const GOAL_TIME_MIN = 141.0; // 2:21.0（実測の良馬場帯より少し速いが「仮」として許容する上下限）
const GOAL_TIME_MAX = 148.0; // 2:28.0
const LAST_3F_BASE = 35.0; // 秒。実測の良馬場帯（34.6〜35.5）の中央値を基準にする
const LAST_3F_MIN = 33.5;
const LAST_3F_MAX = 37.0;
const LAST_4F_OFFSET = 11.8; // 秒。上がり3F・4Fの差はおおむね一定として近似する（仮）

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** 秒数→"2:24.0"表記（結果掲示板のゴールタイム表示用）。 */
function formatGoalTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

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

/**
 * 夢の相手馬17頭ぶんの元データ（`data/derbyWinners.js`の行）を決める。自己完結の純関数。
 * ⭐ユーザー決定：JRA顕彰馬9頭は毎回固定＋残り8頭は保存データ（`saveSeed`）ごとに抽選。
 * ⚠️抽選では「騎手が既に選ばれた馬（顕彰馬9頭を含む）と重ならない」ことだけを条件にする
 * （同じ騎手の馬は引かない。騎手の差し替えはしない）。
 * ⚠️武豊のように顕彰馬の騎手と重なる馬（例：スペシャルウィーク等5頭）は、この条件により
 * 原理的に一度も引かれない（devlog計測で確認済み）。
 * @param {number|string} saveSeed
 * @returns {import("../data/derbyWinners.js").DerbyWinnerRecord[]} 17件（顕彰馬9件＋抽選8件）
 */
export function pickDreamRivalRecords(saveSeed) {
  const recordByHorseName = new Map(DERBY_WINNERS.map((r) => [r.horse, r]));
  const kenshoRecords = KENSHO_DERBY_WINNERS.map((horseName) => recordByHorseName.get(horseName));
  const usedJockeys = new Set(kenshoRecords.map((r) => r.jockey));
  const kenshoHorseNames = new Set(KENSHO_DERBY_WINNERS);
  const candidates = DERBY_WINNERS.filter((r) => !kenshoHorseNames.has(r.horse));

  const picked = [];
  const RIVAL_DRAW_COUNT = 8;
  for (let i = 0; i < RIVAL_DRAW_COUNT; i += 1) {
    const available = candidates.filter((r) => !usedJockeys.has(r.jockey) && !picked.includes(r));
    // ⚠️起きないはずだが（候補34頭に対し8頭しか引かないため枯渇しない）、万一available.length===0
    // なら引けた分で止める（設計どおり。17頭に満たない場合が起き得る）。
    if (available.length === 0) break;
    const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "dream-rivals-pick", i);
    const chosen = available[Math.floor(rand01() * available.length) % available.length];
    picked.push(chosen);
    usedJockeys.add(chosen.jockey);
  }
  return [...kenshoRecords, ...picked];
}

/**
 * 夢の中の相手馬17頭を生成する。⚠️2026-09-06に手続き的な仮名生成から、史実の日本ダービー
 * 優勝馬（実名）へ差し替えた（顕彰馬9頭固定＋残り8頭抽選、`pickDreamRivalRecords`）。
 * 能力値は`generateHorse`のまま＝まだ「仮」（本物のレースsimは別の弾で作る。史実馬の能力を
 * 戦績から導くのもその弾でやる）。名前だけを実名に、騎手・調教師名は実名の人物なので
 * `derbyPeopleNames.js`のもじり変換を経由した表示名に差し替える。
 * @param {number|string} saveSeed
 * @returns {object[]} 17頭（`generateHorse`の形＋`jockeyName`/`trainerName`/`derbyYear`）
 */
export function generateDreamRivals(saveSeed) {
  const records = pickDreamRivalRecords(saveSeed);
  return records.map((record, i) => {
    const base = generateHorse(saveSeed, `dream-rival-${i}`);
    return {
      ...base,
      name: record.horse,
      jockeyName: displayJockeyName(record.jockey),
      trainerName: displayTrainerName(record.trainer),
      derbyYear: record.year,
    };
  });
}

/**
 * 18頭に馬番（枠順）を割り当てる。saveSeedから独立したRNGストリームでシャッフルする
 * （実データの生成名をアルファベット順に並べると不自然に見えるため、モックの簡易実装
 * ＝名前のアルファベット順は使わない）。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {object} dreamHorse - `generateDreamHorse`が返した馬
 * @param {object[]} rivals - `generateDreamRivals`が返した17頭
 * @returns {{ num: number, name: string, isSelf: boolean, horse: object,
 *   jockeyName: string|null, trainerName: string|null }[]} 馬番昇順
 *   ⚠️`jockeyName`/`trainerName`は相手馬（`rivals`）だけが持つ値をそのまま素通しする
 *   （もじり変換済み。実名ではない）。自分の馬（`isSelf: true`）はどちらも`null`。
 */
export function assignPostPositions(saveSeed, dreamHorse, rivals) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, DREAM_HORSE_KEY, "post-position");
  const pool = [
    { horse: dreamHorse, isSelf: true },
    ...rivals.map((horse) => ({ horse, isSelf: false })),
  ];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand01() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.map((p, i) => ({
    num: i + 1,
    name: p.horse.name,
    isSelf: p.isSelf,
    horse: p.horse,
    jockeyName: p.horse.jockeyName ?? null,
    trainerName: p.horse.trainerName ?? null,
  }));
}

/**
 * 夢のダービーの結果を決める。全18頭ぶんの着順・着差(m)・仮のゴールタイム/上がり3F・4Fを
 * 返す。自己完結の純関数。
 * ⚠️呼ぶタイミングに注意：直線の判断カードの選択が最終着差に影響するため、その選択が
 * 確定する前（=`choiceIds.stretch`が決まる前）にこの関数を呼んではならない
 * （screens/dreamDerbyEngine.jsは直線カードの選択が確定した瞬間にだけ呼ぶ）。
 * @param {number|string} saveSeed
 * @param {object} dreamHorse - `generateDreamHorse`が返した馬
 * @param {object[]} rivals - `generateDreamRivals`が返した17頭
 * @param {{ midRace: string, midSituationId: string, stretch: string, stretchSituationId: string }} choiceIds
 *   - プレイヤーが選んだ択のIDと、そのとき出ていた状況キー（`data/judgmentSituations.js`の
 *   `dreamMidLead`等。位置によって出る択の組が違うため、択IDだけでは効果量を引けない。
 *   `screens/dreamDerbyEngine.js`が`domain/judgmentCard.js`の`dreamSituationId`で組み立てて詰める）
 * @returns {{
 *   fieldSize: number, position: number, won: boolean, marginMeters: number,
 *   goalTimeSeconds: number, goalTimeLabel: string, last3F: string, last4F: string,
 *   rows: { pos: number, horseId: string, name: string, isSelf: boolean, marginMeters: number }[]
 * }}
 */
export function runDreamDerbyRace(saveSeed, dreamHorse, rivals, choiceIds) {
  const cardBonus =
    resolveChoice(choiceIds.midSituationId, choiceIds.midRace) +
    resolveChoice(choiceIds.stretchSituationId, choiceIds.stretch);

  const rand01 = streamRandom(saveSeed, RNG_STREAMS.SIM, DREAM_HORSE_KEY, "final");
  const noise = (rand01() - 0.5) * 10;
  const selfScore = horseStrengthScore(dreamHorse, null) + cardBonus + noise;

  const ranked = [
    { horse: dreamHorse, isSelf: true, score: selfScore },
    ...rivals.map((horse) => ({ horse, isSelf: false, score: horseStrengthScore(horse, null) })),
  ].sort((a, b) => b.score - a.score);

  let cumMeters = 0;
  const rows = ranked.map((entry, i) => {
    if (i > 0) {
      const gap = Math.max(MIN_ADJACENT_GAP_M, (ranked[i - 1].score - entry.score) * METERS_PER_SCORE_POINT);
      cumMeters += gap;
    }
    return { pos: i + 1, horseId: entry.horse.id, name: entry.horse.name, isSelf: entry.isSelf, marginMeters: cumMeters };
  });

  const winnerScore = ranked[0].score;
  const goalTimeSeconds = clamp(
    T_FINISH - (winnerScore - PAR_SCORE) * SECONDS_PER_SCORE_POINT,
    GOAL_TIME_MIN,
    GOAL_TIME_MAX
  );
  const last3F = clamp(LAST_3F_BASE - (winnerScore - PAR_SCORE) * 0.02, LAST_3F_MIN, LAST_3F_MAX);
  const last4F = last3F + LAST_4F_OFFSET;

  const selfRow = rows.find((r) => r.isSelf);

  return {
    fieldSize: DREAM_FIELD_SIZE,
    position: selfRow.pos,
    won: selfRow.pos === 1,
    marginMeters: selfRow.marginMeters,
    goalTimeSeconds,
    goalTimeLabel: formatGoalTime(goalTimeSeconds),
    last3F: last3F.toFixed(1),
    last4F: last4F.toFixed(1),
    rows,
  };
}
