// 夢のダービー（ARCHITECTURE.md §11「導入（最初の3分）」）。
// 「夢の中でトップジョッキーとして日本ダービーに騎乗→ゴールすると夢から覚めて
// 競馬学校の卒業式」。勝つ。ただし選択によっては負ける（負けてもすぐ覚めて先へ進む）。
// 純ロジック（JSX無し。`data/`・`core/`・`sim/`・`domain/`の他ファイルだけに依存）。
//
// ⭐2026-09-06にレースsim（`src/sim/`）へ差し替えた。着順・着差・ゴールタイム・上がりは
// すべて`runRaceSim`が返す距離の時系列から出す（それ以前の線形換算の仮定数は削除した）。

import { generateHorse } from "./horse.js";
import { nextGrade } from "../data/grades.js";
import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { choicesFor } from "./judgmentCard.js";
import { deriveFavoredStrategy } from "./strategy.js";
import { TOTAL_DISTANCE, D_FINAL_STRETCH, D_MID_CARD } from "../data/dreamDerbyCourse.js";
import { runRaceSim, resumeRaceSim, buildPlan } from "../sim/index.js";
import { DERBY_WINNERS, KENSHO_DERBY_WINNERS } from "../data/derbyWinners.js";
import { DERBY_HORSE_ABILITIES } from "../data/derbyHorseAbilities.js";
import { displayJockeyName, displayTrainerName } from "../data/derbyPeopleNames.js";

export const DREAM_FIELD_SIZE = 18; // 実態どおり最大18頭（日本ダービー相当）
export const DREAM_HORSE_KEY = "dream-horse";
export const DREAM_RACE_KEY = "dream-derby";

// ⭐夢の馬の補正（`devlog/wave04.md`§28-3の勝率の目安に合わせて計測で決めた値）。
// 強くしすぎると判断カードが飾りになり（何を選んでも勝つ）、弱くすると2回とも合わせても
// 勝てなくなる。⚠️変えたら必ず勝率を測り直すこと。
// ⚠️2026-09-07の記号8段→16段化で、元の「3段」を単純に据え置くと引き上げ幅が
// 3/7=42.9%→3/15=20%に半減し、夢の馬が弱くなってしまう。1段の重みが半分になった分だけ
// 段数を約2.14倍（15/7）して同じ引き上げ幅を保つ：3→6段（6/15=40%、元は3/7=42.9%）。
const BOOSTED_GRADE_STEPS = 6; // 記号能力を6段引き上げる（上限S+）
// ⭐2026-09-07：相手17頭の能力値は`data/derbyHorseAbilities.js`の実データに差し替えた
// （ウイニングポストの値を戦績で補正したもの。ユーザー確認済み・CLAUDE.md §17・
// `devlog/wave05.md`§47）。それ以前の`RIVAL_GRADE_STEPS`/`RIVAL_SPEED_MIN`/
// `RIVAL_STAMINA_MIN`（手続き的な底上げ）は不要になったため削除した。
// ⚠️2026-09-07に相手データの実装後に測り直した（`devlog/wave05.md`§48）。旧80は
// 「旧式でのディープインパクトと同値」で決めた値で、実データの相手（65〜92）に対しては
// 弱すぎた。「型に合わせる／外す」（devlog §28-3と同じ方法。持久力が18頭の中央値以上なら
// 前で運んで早く仕掛ける）で測ると、80では両方合わせて69.7%・両方外して14.3%。
// 85にすると74.3%／14.0%——目安（7〜8割／2〜3割）の上側にほぼ届く。
// ⚠️外したときの下限（14%前後）は80〜92のどの値でもほぼ動かず、目安の2〜3割までは
// 上げられなかった（相手が実データの強豪ぞろいになったため。`devlog/wave05.md`§48）。
const BOOSTED_SPEED_MIN = 85; // スピードの下限（0〜100スケール中）
// ⚠️スタミナの下限は低いままにする。ここを70に上げると夢の馬の持久力の幅が消え、
// **直線で早く仕掛けるか待つかの正解が全seedで同じ**になり、判断カードが一択に潰れる（実測）。
const BOOSTED_STAMINA_MIN = 60;

const GOAL_TIME_MIN = 141.0; // 2:21.0
const GOAL_TIME_MAX = 148.0; // 2:28.0

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
  boostedAbilities.speed = Math.round(BOOSTED_SPEED_MIN + rand01() * (100 - BOOSTED_SPEED_MIN));
  boostedAbilities.stamina = Math.round(BOOSTED_STAMINA_MIN + rand01() * (100 - BOOSTED_STAMINA_MIN));
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
 * ⭐2026-09-07：能力値は`data/derbyHorseAbilities.js`の実データ（ウイニングポストの値を
 * 戦績で補正したもの）に差し替えた。ユーザー確認済み（CLAUDE.md §17）。
 * 名前は実名、騎手・調教師名は実名の人物なので`derbyPeopleNames.js`のもじり変換を
 * 経由した表示名に差し替える。
 * @param {number|string} saveSeed
 * @returns {object[]} 17頭（`generateHorse`の形＋`jockeyName`/`trainerName`/`derbyYear`）
 */
export function generateDreamRivals(saveSeed) {
  const records = pickDreamRivalRecords(saveSeed);
  return records.map((record, i) => {
    const base = generateHorse(saveSeed, `dream-rival-${i}`);
    const real = DERBY_HORSE_ABILITIES[record.horse];
    // ⚠️`data/derbyHorseAbilities.js`は`data/derbyWinners.js`の51頭全員を必ず含む
    // （名前キーの一致は`tools/check-historical.mjs`の検査対象外。作成時に突き合わせ済み）。
    const abilities = {
      speed: real.speed,
      stamina: real.stamina,
      sharpness: real.sharpness,
      grit: real.grit,
      flexibility: real.flexibility,
      wisdom: real.wisdom,
      health: real.health,
      power: real.power,
      mentalStrength: real.mentalStrength,
    };
    return {
      ...base,
      abilities,
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
 * 発走時のレースsimを1本走らせる（既定の作戦＝全馬が自分の得意脚質、プレイヤーはカード未選択）。
 * 判断カードを選んだ瞬間に`forkDreamDerbySim`でその時刻から先を計算し直す。
 * @param {number|string} saveSeed
 * @param {{num:number,horse:object,isSelf:boolean}[]} entries - `assignPostPositions`の出力
 * @returns {object} `runRaceSim`の戻り値
 */
export function startDreamDerbySim(saveSeed, entries) {
  const selfNum = entries.find((e) => e.isSelf).num;
  const plan = buildPlan(entries, (e) => deriveFavoredStrategy(e.horse), selfNum);
  return runRaceSim({
    seed: saveSeed,
    raceKey: DREAM_RACE_KEY,
    distance: TOTAL_DISTANCE,
    entries,
    plan,
  });
}

/**
 * 選んだ択のタグ（`data/judgmentSituations.js`の`forward`/`early`/`effect`）を取り出す。
 * @param {string} situationId
 * @param {string} choiceId
 */
export function choiceTagsOf(situationId, choiceId) {
  const choice = choicesFor(situationId).find((c) => c.id === choiceId);
  return {
    forward: !!choice?.forward,
    early: !!choice?.early,
    effect: choice?.effect ?? 0,
  };
}

/**
 * 判断カードの選択を反映して`tFork`以降を計算し直す。⚠️`tFork`以前の数値は変わらない
 * （それまでに画面へ見せた隊列と矛盾させないため）。
 * @param {object} sim - `startDreamDerbySim`または前回の`forkDreamDerbySim`の戻り値
 * @param {number} tFork - 選んだ時刻(秒)
 * @param {"mid"|"stretch"} phase
 * @param {string} situationId
 * @param {string} choiceId
 */
export function forkDreamDerbySim(sim, tFork, phase, situationId, choiceId) {
  return resumeRaceSim(sim, tFork, { phase, ...choiceTagsOf(situationId, choiceId) });
}

/**
 * simの結果を結果掲示板が使う形にまとめる。⚠️戻り値の形は差し替え前と同じ
 * （`screens/dreamDerbyEngine.js`のdoFinishと`screens/DreamDerbyScreen.jsx`が読む）。
 * @param {object} sim - `runRaceSim`の戻り値
 * @param {{num:number,horse:object,isSelf:boolean,name:string}[]} entries
 * @returns {{
 *   fieldSize: number, position: number, won: boolean, marginMeters: number,
 *   goalTimeSeconds: number, goalTimeLabel: string, last3F: string, last4F: string,
 *   rows: { pos: number, horseId: string, name: string, isSelf: boolean, marginMeters: number }[]
 * }}
 */
export function dreamDerbyResult(sim, entries) {
  const rows = sim.order.map((idx, i) => ({
    pos: i + 1,
    horseId: entries[idx].horse.id,
    name: entries[idx].name,
    isSelf: entries[idx].isSelf,
    marginMeters: sim.marginMeters[idx],
  }));
  const selfRow = rows.find((r) => r.isSelf);
  const goalTimeSeconds = clamp(sim.winnerTime, GOAL_TIME_MIN, GOAL_TIME_MAX);
  return {
    fieldSize: entries.length,
    position: selfRow.pos,
    won: selfRow.pos === 1,
    marginMeters: selfRow.marginMeters,
    goalTimeSeconds,
    goalTimeLabel: formatGoalTime(goalTimeSeconds),
    last3F: sim.last3F.toFixed(1),
    last4F: sim.last4F.toFixed(1),
    rows,
  };
}

/**
 * 夢のダービーを頭から最後まで走らせる（画面を通さない一括版。計測とテストで使う）。
 * 画面（`screens/dreamDerbyEngine.js`）は`startDreamDerbySim`→`forkDreamDerbySim`→
 * `dreamDerbyResult`の3段に分けて呼ぶ。
 * @param {number|string} saveSeed
 * @param {object} dreamHorse - `generateDreamHorse`が返した馬
 * @param {object[]} rivals - `generateDreamRivals`が返した17頭
 * @param {{ midRace: string, midSituationId: string, stretch: string, stretchSituationId: string }} choiceIds
 */
export function runDreamDerbyRace(saveSeed, dreamHorse, rivals, choiceIds) {
  const entries = assignPostPositions(saveSeed, dreamHorse, rivals);
  const selfNum = entries.find((e) => e.isSelf).num;
  let sim = startDreamDerbySim(saveSeed, entries);
  if (choiceIds?.midSituationId && choiceIds?.midRace) {
    const tMid = sim.timeAtDistanceOf(selfNum, D_MID_CARD) ?? 0;
    sim = forkDreamDerbySim(sim, tMid, "mid", choiceIds.midSituationId, choiceIds.midRace);
  }
  if (choiceIds?.stretchSituationId && choiceIds?.stretch) {
    const tStr = sim.timeAtDistanceOf(selfNum, D_FINAL_STRETCH) ?? 0;
    sim = forkDreamDerbySim(sim, tStr, "stretch", choiceIds.stretchSituationId, choiceIds.stretch);
  }
  return { ...dreamDerbyResult(sim, entries), sim, entries };
}
