// 人（騎手・調教師・馬主）の名前の語彙表（ARCHITECTURE.md §10「実在競馬」
// 「人（騎手・調教師・馬主）はもじる」）。
// ⚠️音節を組み合わせるだけの完全な架空の生成——実在の人物名の丸写しではない。

const NAME_SYLLABLES = Object.freeze([
  "ヤマ",
  "カワ",
  "モリ",
  "タニ",
  "ハシ",
  "オカ",
  "イケ",
  "ダイ",
  "スギ",
  "ウメ",
  "アラ",
  "シバ",
  "ホシ",
  "ノダ",
  "ミヤ",
  "セキ",
]);

/**
 * もじった人名を1つ作る。自己完結の純関数（引数のみを参照。乱数は呼び出し側が渡す）。
 * @param {() => number} rand01
 * @returns {string}
 */
export function generateModeledName(rand01) {
  const pick = (list) => list[Math.floor(rand01() * list.length) % list.length];
  return `${pick(NAME_SYLLABLES)}${pick(NAME_SYLLABLES)}`;
}
