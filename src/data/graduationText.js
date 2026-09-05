// 卒業式画面の文言（`devlog/wave02.md`「確定した文言と表記」・案A-2/B-1/C-2で確定）。
// ⚠️Fableサブエージェントの候補から、教官のセリフでUIの物差しを説明する行と、
// 得意分野の説明を繰り返す一言は削った（同ファイル参照）。
// ⚠️`design/mocks/graduation-mock2.html`から一言一句そのまま移植した
// （CLAUDE.md §7「文言を変えない」）。

/** 段1：システムの声（トースト）。 */
export const NAME_PROMPT_TEXT = "名前を教えてください。";

/** 段2：式典の読み上げ4行（A-2）。フルネームを差し込む。 */
export function ceremonyLines(fullName) {
  return [
    `「卒業証書授与、${fullName}」`,
    "返事をして、壇上に上がる。",
    "両手で受け取る。夢で握っていた手綱と違って、証書は軽い。",
    "「今日から、君は騎手だ」",
  ];
}

/**
 * 段3：教官のセリフ4行。
 * ⚠️成績表（`.scoreboard`）は画面に既に出ているため、記号の読み上げはしない
 * （CLAUDE.md §7「画面に既に出ている情報を、セリフや文章で言い直さない」）。
 * ⚠️`schoolRecord`は現在このセリフでは使わないが、呼び出し側
 * （`GraduationScreen.jsx`）を壊さないよう引数はそのまま残す。
 */
export function reportLines(schoolRecord) {
  return [
    "「卒業、おめでとう。」",
    "「三年前、お前は馬に触るのも怖がっていたな」",
    "「ここから先は、俺は何も言えん」",
    "「声をかけてきた厩舎がある。自分で選べ」",
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
