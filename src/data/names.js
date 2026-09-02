// 架空馬の名前の語彙表（ARCHITECTURE.md §3「馬の名前」）。
// ⭐大口馬主だけ冠名を持つ（「冠名＋語幹」）。小口の馬は語幹の組み合わせ。
// ⚠️ここに挙げる語は全てこのゲームのために作った架空の語（実在の馬主・馬名の丸写しではない）。
// 語彙が少ないと同じ名前が並ぶため（devlog/wave01e.md A7）、実装が進んだら随時増やす。

// 大口馬主の冠名（例：「サンレイ○○」のように語幹の前に付く）。
export const OWNER_PREFIXES = Object.freeze([
  "サンレイ",
  "ヒシ",
  "コスモ",
  "タイセイ",
  "レイクロス",
  "アカネ",
  "オーロラ",
  "ゴールド",
  "セイウン",
  "フウリン",
  "ヤマト",
  "リュウジン",
]);

// 語幹（小口馬は2つ組み合わせる。大口馬主は冠名の後に1つだけ付く）。
export const NAME_STEMS = Object.freeze([
  "ウィング",
  "スター",
  "ライト",
  "ドリーム",
  "ヴィクトリー",
  "ブレイズ",
  "フェザー",
  "シャドウ",
  "サンダー",
  "ミスティ",
  "クレスト",
  "エコー",
  "インパクト",
  "パルス",
  "レガシー",
  "ノヴァ",
  "ブリーズ",
  "グロリア",
  "テンペスト",
  "オパール",
]);

/**
 * 架空馬の名前を作る。自己完結の純関数（引数のみを参照。乱数は呼び出し側が渡す）。
 * @param {() => number} rand01 - 0以上1未満の乱数を返す関数（呼び出し側のRNGを渡す）
 * @param {{ ownerPrefix?: string }} [opts] - 大口馬主の場合は冠名を渡す
 * @returns {string}
 */
export function generateHorseName(rand01, opts = {}) {
  const pick = (list) => list[Math.floor(rand01() * list.length) % list.length];
  if (opts.ownerPrefix) {
    return `${opts.ownerPrefix}${pick(NAME_STEMS)}`;
  }
  const a = pick(NAME_STEMS);
  let b = pick(NAME_STEMS);
  // 同じ語幹の重複を避ける（語彙内で1回だけ引き直し。それでも重複したら許容する）。
  if (b === a) b = pick(NAME_STEMS);
  return `${a}${b}`;
}
