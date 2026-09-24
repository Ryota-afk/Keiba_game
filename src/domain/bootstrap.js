// 開始前の事前シミュレーション（`arch/race-program.md`§11・質問22の一般化）。
// ⭐開始年Yの2年前(Y-2)からY-1年末まで104週、プレイヤー無しでレースを走らせ、
// クラス・戦績・収得賞金・年齢・繁殖プールが揃った状態でキャリアを始められるようにする。
// これが無いと、開始時点の全馬が「新馬・0戦・生年不明」のまま第1週を迎えてしまう
// （通しプレイ①の指摘「全員初出走」）。
// 純ロジック（JSX無し。`data/`・`core/`・同じ`domain/`内の他ファイルだけに依存）。

import { streamRandom, RNG_STREAMS, weightedPick } from "../core/rng.js";
import { createInitialRoster } from "./career.js";
import { runNpcGradedRaces } from "./npcGradedRace.js";
import { runNpcWeeklyRaces } from "./npcWeeklyRace.js";
import { advanceInjuryByWeek } from "./fall.js";
import {
  assignStablePrimaryJockeys,
  assignHorsePrimaryJockeys,
  jockeyIdForHorse,
} from "./jockeyAssignment.js";
import { processYearBoundary } from "./yearBoundary.js";
import { WEEKS_PER_YEAR, BOOTSTRAP_YEARS, BOOTSTRAP_WEEKS } from "../data/calendar.js";
import { hasGradedRaceData } from "../data/gradedRacesByYear.js";
import { buildYearIndex } from "./weeklyCard.js";
import { replanStaleHorses, ROTATION_SEARCH_WEEKS } from "./rotation.js";

// Y−2時点の馬齢分布。104週（2年）ぶん歳を取った後の開始年Yの分布が、1974年の実測
// （重賞に出た405頭：2歳13%・3歳45%・4歳22%・5歳14%・6歳5%・7歳以上1%）に近づくよう、
// **実測の年齢からそのまま2を引いた値**で置く（`arch/race-program.md`§11・
// `devlog/wave07.md`「計測」で実測して確定。当初は2/3/4/5/6歳=35/30/20/10/5%という
// 根拠の無い値を置いていたが、これは開始年Yでの分布ではなくY−2時点の分布だったため、
// 2年歳を取った後は4〜8歳に寄ってしまい、実測の主力である2・3歳（合計58%）が
// 開始時点に1頭も存在しないという不整合が実測で判明し、直した）。
export const INITIAL_AGE_SHARE = Object.freeze({ 0: 13, 1: 45, 2: 22, 3: 14, 4: 6, 5: 1 });

/**
 * 開始年に、104週ぶんの重賞データ（Y−2〜Y）が揃っているか。
 * 揃っていない年はタイトル画面で開始年として選べないようにする
 * （通しプレイ①「全員初出走」のような静かな壊れ方を、起動時の明示的な拒否に変える）。
 */
export function assertStartYearData(startYear) {
  for (let y = startYear - BOOTSTRAP_YEARS; y <= startYear; y += 1) {
    if (!hasGradedRaceData(y)) return false;
  }
  return true;
}

/** 初期ロースターの全馬に、Y−2時点の馬齢から逆算した生年を割り当てる。 */
function assignInitialBornYears(saveSeed, horses, bootstrapStartYear) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "bootstrap-age");
  return horses.map((horse) => {
    const age = Number(weightedPick(rand01, INITIAL_AGE_SHARE));
    return { ...horse, bornYear: bootstrapStartYear - age };
  });
}

/**
 * 事前シミュレーションの1週ぶん（プレイヤー無し）。`domain/weekLoop.js`の`advanceWeek`から
 * プレイヤーの依頼・鞍・脚質・信頼の処理を除いた形——NPCのレースと離脱・主戦の割当だけを進める。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週（1始まり。ここでは折り返さず104まで進む）
 * @param {number} year - 暦年
 * @param {{ stables: object[], horses: object[], npcJockeys: object[], trialResults?: object }} roster
 * @returns {{ roster: object }}
 */
export function runBootstrapWeek(saveSeed, week, year, roster) {
  // 本物のsimは騎手の適性も見るので、事前シミュレーションでも騎手を乗せる。
  const jockeyById = new Map(roster.npcJockeys.map((j) => [j.id, j]));
  const primaryJockeyByStable = assignStablePrimaryJockeys(roster.stables, roster.npcJockeys);
  const getJockey = (horse) => jockeyById.get(jockeyIdForHorse(horse, primaryJockeyByStable)) ?? undefined;

  const gradedResult = runNpcGradedRaces(
    saveSeed,
    week,
    year,
    roster.horses,
    new Set(),
    new Set(), // 事前シミュレーションにプレイヤーはいない
    roster.trialResults ?? {},
    getJockey,
    roster.stables
  );
  // ⚠️第11弾（`devlog/wave11.md`§12）：重賞で走った馬を一般競走の除外に渡す。
  // ⭐`domain/weekLoop.js`の本編ループは既に`gradedResult.racedHorseIds`を除外に
  // 入れていた（同じ週に重賞と一般競走の2つへ出ないため）が、ここ（事前シミュレーション）は
  // 空の`Set`を渡していて働いていなかった。
  const npcResult = runNpcWeeklyRaces(
    saveSeed,
    week,
    year,
    gradedResult.horses,
    gradedResult.racedHorseIds,
    new Set(),
    getJockey,
    roster.stables
  );

  // ⭐第10弾：計画が今週で期限切れ・まだ計画の無い馬に、次の計画を立て直す
  // （本編と同じ仕組み・`domain/weekLoop.js`と対称）。⭐本編は事前シミュレーションの
  // 続きの週（`MAIN_TIMELINE_START_WEEK`＝105）から始まるので、ここで立てた計画の
  // `targetWeek`（絶対週）はそのまま本編でも通用する——本編へ渡す前にリセットする
  // 必要は無い（2026-09-20のユーザー決定）。
  const yearIndex = buildYearIndex(saveSeed, week, year, ROTATION_SEARCH_WEEKS);
  const replannedHorses = replanStaleHorses(saveSeed, npcResult.horses, yearIndex, week, year);

  const advancedHorses = replannedHorses.map((h) => advanceInjuryByWeek(h));
  const jockeyedHorses = assignHorsePrimaryJockeys(advancedHorses, primaryJockeyByStable, roster.npcJockeys);
  return { roster: { ...roster, horses: jockeyedHorses, trialResults: gradedResult.trialResults } };
}

/**
 * 開始年Yの2年前から104週ぶんのロースターを組む。自己完結の純関数
 * （同じ`(saveSeed, startYear)`なら常に同じロースターになる）。
 * ⚠️104週ぶんの馬オブジェクトの複製が乗るため実測で約2秒かかる（`devlog/wave07.md`
 * 「計測」）。UIから使うときは`bootstrapRosterAsync`でコマ切れにして呼ぶこと。
 * @param {number|string} saveSeed
 * @param {number} startYear
 * @returns {{ roster: object }}
 */
export function bootstrapRoster(saveSeed, startYear) {
  const bootstrapStartYear = startYear - BOOTSTRAP_YEARS;
  const initial = createInitialRoster(saveSeed);
  let roster = { ...initial, horses: assignInitialBornYears(saveSeed, initial.horses, bootstrapStartYear) };

  let year = bootstrapStartYear;
  for (let week = 1; week <= BOOTSTRAP_WEEKS; week += 1) {
    roster = runBootstrapWeek(saveSeed, week, year, roster).roster;
    if (week % WEEKS_PER_YEAR === 0) {
      const yb = processYearBoundary(saveSeed, year + 1, roster, { mainMounts: {} });
      roster = { ...roster, horses: yb.roster.horses, breedingPool: yb.roster.breedingPool };
      year += 1;
    }
  }

  return { roster };
}

/**
 * `bootstrapRoster`と同じ結果を、コマ切れに実行する版。ブラウザで使うとき、104週を
 * 一度に回して描画を止めてしまわないよう、`weeksPerChunk`週ごとに`yield`関数へ制御を返す
 * （夢のダービーの実況・アニメーションのフレームを挟めるようにするため）。
 * @param {number|string} saveSeed
 * @param {number} startYear
 * @param {{ weeksPerChunk?: number, yield?: () => Promise<void> }} [options]
 * @returns {Promise<{ roster: object }>}
 */
export async function bootstrapRosterAsync(saveSeed, startYear, options = {}) {
  // ⚠️1週あたりの処理は実測43.5ms（本物のsimに置き換えた後・`devlog/wave08.md`§5）。
  // 8週ずつ回すと1回の塊が350msになり、夢のダービーの描画が目に見えて止まる。
  // 2週ずつ（約90ms）に細かくした。⚠️刻むほど`setTimeout`の往復が増える（104週で約0.2秒）。
  const weeksPerChunk = options.weeksPerChunk ?? 2;
  const yieldToRender = options.yield ?? (() => new Promise((resolve) => setTimeout(resolve, 0)));

  const bootstrapStartYear = startYear - BOOTSTRAP_YEARS;
  const initial = createInitialRoster(saveSeed);
  let roster = { ...initial, horses: assignInitialBornYears(saveSeed, initial.horses, bootstrapStartYear) };

  let year = bootstrapStartYear;
  for (let week = 1; week <= BOOTSTRAP_WEEKS; week += 1) {
    roster = runBootstrapWeek(saveSeed, week, year, roster).roster;
    if (week % WEEKS_PER_YEAR === 0) {
      const yb = processYearBoundary(saveSeed, year + 1, roster, { mainMounts: {} });
      roster = { ...roster, horses: yb.roster.horses, breedingPool: yb.roster.breedingPool };
      year += 1;
    }
    if (week % weeksPerChunk === 0) {
      await yieldToRender();
    }
  }

  return { roster };
}
