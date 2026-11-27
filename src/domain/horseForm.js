// 調子（見えない0〜100の軸）と当日の馬体重（⑭ step2・`devlog/wave13.md`§25 §2・`arch/horse.md`「出来」）。
// 純ロジック（JSX無し。`data/`・`core/`・`domain/horseLooks.js`・`domain/horse.js`の一部だけに依存）。
//
// ⭐状態の軸は1本だけ（`design/winning-post-race-model.md`K3）。馬に持たせるのは
// `horse.form = { startsSinceRest, fatKg }`の2つの数だけで、調子そのもの（0〜100）は出走の日に
// 前走からの週数と合わせてその場で計算する（毎週全馬を更新しない＝週の処理が重くならない）。
// - `startsSinceRest`：休み明けから何走したか（小数。前走から空いた週だけ戻る＝`recoverForm`）
// - `fatKg`：前走が終わった時点で残っている太め（kg）
//
// ⚠️乱数は専用の列（`RNG_STREAMS.FORM`・週×馬id）。既存の列（sim・人気・落馬）の消費は1つも変えない。
// ⚠️同じ`(saveSeed, week, horse)`なら必ず同じ当日の状態になる——週の画面（調教後の体重）と
// レースの日（当日の体重・走り）が同じ値を使う前提。馬の状態は週の途中で変わらない（1週1走）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { weekOfYear } from "../data/calendar.js";
import { gradeToNumber } from "../data/grades.js";
import { bestKg, roundTo2kg } from "./horseLooks.js";
import {
  FORM_CURVE,
  FORM_PEAK_STARTS,
  HEALTH_LEVEL_SPAN,
  HEALTH_DECLINE_MIN,
  HEALTH_DECLINE_MAX,
  RECOVERY_PER_WEEK_BASE,
  RECOVERY_PER_WEEK_HEALTH,
  RECOVERY_GRACE_WEEKS,
  REST_RESET_WEEKS,
  SHORT_GAP_LEVEL_PENALTY,
  DAY_LEVEL_SD_MAX,
  DAY_LEVEL_SD_MIN,
  FAT_MAX_KG,
  FAT_GRACE_WEEKS,
  FAT_TAU_WEEKS,
  FAT_KEEP_AFTER_RACE,
  THIN_FROM_STARTS,
  THIN_PER_START_KG,
  THIN_MAX_KG,
  CONSECUTIVE_THIN_KG,
  DAY_KG_SD,
  TRAINING_KG_OFFSET_MAX,
  FORM_FACTOR_SPAN,
  FORM_LEVEL_CENTER,
  WEIGHT_FREE_KG,
  WEIGHT_FACTOR_PER_KG,
  WEIGHT_FACTOR_MAX_LOSS,
  ULTIMATE_LEVEL,
  ULTIMATE_MAX_DEV_KG,
  ULTIMATE_BONUS,
} from "../data/horseForm.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const norm15 = (grade) => gradeToNumber(grade) / 15;

function normal01(rand01) {
  const u = Math.max(rand01(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand01());
}

/** 古いセーブ（`form`が無い馬）の既定値。走ったことがある馬は「休み明けから2走目」として扱う（⚠️根拠なし）。 */
export function formStateOf(horse) {
  if (horse.form) return horse.form;
  return { startsSinceRest: (horse.record?.starts ?? 0) > 0 ? 2 : 0, fatKg: 0 };
}

/**
 * 休み（前走から`gapWeeks`空いた）による戻り。週ごとの戻りと休み明けをまとめて閉じた形で計算する。
 * 純関数。`gapWeeks`が`Infinity`（1度も走っていない）なら初出走＝休み明けと同じ扱い。
 * @returns {{ startsSinceRest: number, fatKg: number, rested: boolean }} 出走の日の時点の値
 */
export function recoverForm(state, gapWeeks, health01) {
  if (!Number.isFinite(gapWeeks)) return { startsSinceRest: 0, fatKg: 0, rested: true };
  const rested = gapWeeks >= REST_RESET_WEEKS;
  const perWeek = RECOVERY_PER_WEEK_BASE + RECOVERY_PER_WEEK_HEALTH * health01;
  const startsSinceRest = rested ? 0 : Math.max(0, state.startsSinceRest - perWeek * Math.max(0, gapWeeks - RECOVERY_GRACE_WEEKS));
  const idle = Math.max(0, gapWeeks - FAT_GRACE_WEEKS);
  const fatKg = FAT_MAX_KG - (FAT_MAX_KG - state.fatKg) * Math.exp(-idle / FAT_TAU_WEEKS);
  return { startsSinceRest, fatKg, rested };
}

/** 休み明けからの走数と健康から、調子の基準値（揺れの前）を出す。 */
export function baseFormLevel(startsSinceRest, health01) {
  // 使い減り（頂点より先）は健康が高いほど緩い＝走数の進みを縮める
  const declineScale = HEALTH_DECLINE_MAX - (HEALTH_DECLINE_MAX - HEALTH_DECLINE_MIN) * health01;
  const s = startsSinceRest <= FORM_PEAK_STARTS ? startsSinceRest : FORM_PEAK_STARTS + (startsSinceRest - FORM_PEAK_STARTS) * declineScale;
  let level = FORM_CURVE[FORM_CURVE.length - 1][1];
  for (let i = 1; i < FORM_CURVE.length; i += 1) {
    const [s1, v1] = FORM_CURVE[i];
    if (s <= s1) {
      const [s0, v0] = FORM_CURVE[i - 1];
      level = v0 + ((v1 - v0) * (s - s0)) / (s1 - s0);
      break;
    }
  }
  const healthWeight = Math.min(1, 0.5 + startsSinceRest); // 休み明けの1走目は半分
  return level + HEALTH_LEVEL_SPAN * (health01 - 0.5) * healthWeight;
}

/** 調子とベスト体重からのずれ（kg）から、スピード・瞬発力・勝負根性に掛ける倍率を作る。 */
export function formFactorOf(level, devKg) {
  const weightLoss = Math.min(WEIGHT_FACTOR_MAX_LOSS, WEIGHT_FACTOR_PER_KG * Math.max(0, Math.abs(devKg) - WEIGHT_FREE_KG));
  const ultimate = isUltimate(level, devKg);
  return 1 + (FORM_FACTOR_SPAN * (level - FORM_LEVEL_CENTER)) / 50 - weightLoss + (ultimate ? ULTIMATE_BONUS : 0);
}

/** 究極仕上げ：調子が上位2割（`ULTIMATE_LEVEL`以上）で、ずれが±2kg以内。 */
export function isUltimate(level, devKg) {
  return level >= ULTIMATE_LEVEL && Math.abs(devKg) <= ULTIMATE_MAX_DEV_KG;
}

/** 前走の当日の体重（kg）。記録が無い（初出走・古い記録）ならnull。 */
export function previousBodyKg(horse) {
  return horse.record?.recentFinishes?.[0]?.bodyKg ?? null;
}

/**
 * 前走比（kg）。⚠️画面との取り決め（2026-11-27）：**nullは初出走だけ**。前走の体重が分からない
 * （古いセーブの記録）ときは`undefined`（欄を省く）。
 */
export function bodyKgDiffFrom(horse, bodyKg) {
  const starts = horse.record?.starts ?? 0;
  if (starts === 0 || !horse.record?.recentFinishes?.length) return null;
  const prev = previousBodyKg(horse);
  return prev == null ? undefined : bodyKg - prev;
}

function gapWeeksOf(horse, week) {
  if (!horse.record?.starts || !horse.record.recentFinishes?.length) return Infinity;
  const lastWeek = horse.record.recentFinishes[0].week;
  return lastWeek == null ? Infinity : week - lastWeek;
}

/**
 * 出走の日の状態。純関数（同じ引数なら常に同じ結果）。
 * @param {object} horse - 出走前の馬（`form`・`record.recentFinishes`・`abilities`・見た目の欄）
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週
 * @param {number} year - 暦年
 * @returns {{ level: number, bodyKg: number, bodyKgDiff: number|null, bestKg: number, devKg: number,
 *   factor: number, ultimate: boolean, gapWeeks: number, startsSinceRest: number, fatKg: number,
 *   trainingOffsetKg: number }}
 */
export function raceDayForm(horse, saveSeed, week, year) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.FORM, week, horse.id);
  // ⚠️消費の順番を固定（調子の揺れ→体重の揺れ→調教後のずれ）
  const levelZ = normal01(rand01);
  const kgZ = normal01(rand01);
  const trainingOffsetKg = 2 * Math.round(((rand01() * 2 - 1) * TRAINING_KG_OFFSET_MAX) / 2); // −4〜＋4の2kg刻み・平均0

  const health01 = norm15(horse.abilities?.health);
  const wisdom01 = norm15(horse.abilities?.wisdom);
  const gapWeeks = gapWeeksOf(horse, week);
  const rec = recoverForm(formStateOf(horse), gapWeeks, health01);

  const daySd = DAY_LEVEL_SD_MAX - (DAY_LEVEL_SD_MAX - DAY_LEVEL_SD_MIN) * wisdom01;
  const level = clamp(baseFormLevel(rec.startsSinceRest, health01) + (SHORT_GAP_LEVEL_PENALTY[gapWeeks] ?? 0) + daySd * levelZ, 0, 100);

  const thin =
    Math.min(THIN_MAX_KG, THIN_PER_START_KG * Math.max(0, rec.startsSinceRest - THIN_FROM_STARTS)) +
    (gapWeeks === 1 ? CONSECUTIVE_THIN_KG : 0);
  const best = roundTo2kg(bestKg(horse, year, weekOfYear(week)));
  const bodyKg = roundTo2kg(bestKg(horse, year, weekOfYear(week)) + rec.fatKg - thin + DAY_KG_SD * kgZ);
  const devKg = bodyKg - best;
  return {
    level,
    bodyKg,
    bodyKgDiff: bodyKgDiffFrom(horse, bodyKg),
    bestKg: best,
    devKg,
    factor: formFactorOf(level, devKg),
    ultimate: isUltimate(level, devKg),
    gapWeeks,
    startsSinceRest: rec.startsSinceRest,
    fatKg: rec.fatKg,
    trainingOffsetKg,
  };
}

/** 走った後の`form`（1走ぶん進め、太めを減らす）。純関数——新しい`horse`を返す。 */
export function horseAfterRace(horse, day) {
  return {
    ...horse,
    form: {
      startsSinceRest: Math.round((day.startsSinceRest + 1) * 100) / 100,
      fatKg: Math.round(day.fatKg * FAT_KEEP_AFTER_RACE * 10) / 10,
    },
  };
}

/** 戦績の1行（`recentFinishes`）と鞍の記録に足す体重の欄。前走比が分からない（undefined）ときは欄を省く。 */
export function bodyKgFields(day) {
  return day.bodyKgDiff === undefined ? { bodyKg: day.bodyKg } : { bodyKg: day.bodyKg, bodyKgDiff: day.bodyKgDiff };
}

/**
 * 週の画面に出す「調教後の体重」と前走比。その週のレースの日の体重＋ずれ（`TRAINING_KG_OFFSET_MAX`・2kg刻み）。
 * ⚠️引数の順は画面との取り決め（2026-11-27）：`trainingWeightFor(horse, player.currentYear, player.currentWeek, saveSeed)`。
 * `week`は絶対週（`player.currentWeek`）。その週に走る予定の馬に使う（走る日の状態から作るため）。
 * @returns {{ kg: number, diff: number|null|undefined }} `diff`：nullは初出走だけ・前走の体重が分からなければundefined
 */
export function trainingWeightFor(horse, year, week, saveSeed) {
  const day = raceDayForm(horse, saveSeed, week, year);
  const kg = day.bodyKg + day.trainingOffsetKg;
  return { kg, diff: bodyKgDiffFrom(horse, kg) };
}

/**
 * 出走馬の当日の状態をまとめて作る（レースの入口で1回）。`Map<horseId, day>`。
 * @param {object[]} horses
 */
export function raceDayFormsFor(horses, saveSeed, week, year) {
  return new Map(horses.map((h) => [h.id, raceDayForm(h, saveSeed, week, year)]));
}
