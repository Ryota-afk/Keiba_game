// 卒業式画面の文言（`devlog/wave02.md`「確定した文言と表記」・案A-2/B-1/C-2で確定）。
// ⚠️Fableサブエージェントの候補から、教官のセリフでUIの物差しを説明する行と、
// 得意分野の説明を繰り返す一言は削った（同ファイル参照）。
// ⚠️`design/mocks/graduation-mock2.html`から一言一句そのまま移植した
// （CLAUDE.md §7「文言を変えない」）。

import { DISTANCE_BAND_LABELS, SURFACE_LABELS } from "./aptitudeLabels.js";

/** 段1：システムの声（トースト）。 */
export const NAME_PROMPT_TEXT = "名前を教えてください。";

/** 段2：式典の読み上げ4行（A-2）。フルネームを差し込む。 */
export function ceremonyLines(fullName) {
  return [
    `「卒業証書授与、${fullName}」`,
    "返事をして、壇上に上がる。",
    "両手で受け取る。夢で握っていた手綱と違って、証書は軽い。",
    "「おめでとう。今日から、君は騎手だ」",
  ];
}

/**
 * 段3：成績表の読み上げ4行（B-1）。
 * ⚠️「B、A、Sは一つもない」「もう片方はDにも届いていない」は`generateSchoolRecord`の
 * 生成規則（最高値は必ずD・残りは必ずG〜E）に基づき、どの距離帯・馬場が最高であっても
 * 常に成り立つ（`domain/graduation.js`参照）。
 */
export function reportLines(schoolRecord) {
  return [
    `「距離は${DISTANCE_BAND_LABELS[schoolRecord.topDistance]}がD。ほかは、それより下だ」`,
    `「馬場は${SURFACE_LABELS[schoolRecord.topSurface]}がD。もう片方は、Dにも届いていない」`,
    "「B、A、Sは一つもない。今の君に、得意と呼べるものは、まだない」",
    "「ただし、この二つのDは君が三年かけて出した数字だ。この表を持って、厩舎へ行け」",
  ];
}

/**
 * 段3：夢の記録に対する2択（C-2）。`accept`＝あの乗り方を信じる／`reject`＝一から覚え直す。
 * `strategyLabel`は導出戦法の日本語表記（`data/aptitudeLabels.js`の`STRATEGY_LABELS`）。
 */
export function dreamRecordChoices(strategyLabel) {
  return [
    {
      id: "accept",
      label: "夢の乗り方を信じてみる",
      hint: `${strategyLabel}が武器になる。代わりに、ほかの三つに穴ができる`,
    },
    {
      id: "reject",
      label: "一から覚え直す",
      hint: "四つとも同じ、平凡な適性になる。穴は無いが、武器も無い",
    },
  ];
}

/** 段4：厩舎を選んだ後の確定行。 */
export function stableConfirmedLine(trainerFamilyName) {
  return `${trainerFamilyName}厩舎に所属が決まった。`;
}

export const STABLE_OFFER_HEADING = "声をかけてきた厩舎";
