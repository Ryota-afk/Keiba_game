// 人（騎手・調教師・馬主）の名前の語彙表（ARCHITECTURE.md §10「実在競馬」
// 「人（騎手・調教師・馬主）はもじる」）。
// ⚠️音節を組み合わせるだけの完全な架空の生成——実在の人物名の丸写しではない。
//
// ⚠️2026-09-04に姓＋名の漢字へ作り直した。旧実装はカタカナ音節16種類を2つ繋げるだけで
// 256通りしかなく、実測で厩舎190件中51件の調教師名が重複していた
// （`devlog/wave02.md`「⚠️人名の生成を作り直すことにした」）。姓40×名40＝1600通りに
// 増やした（Fableサブエージェントが作成。実在の競馬関係者の氏名は避けさせたが、
// 姓単体は日本のありふれた姓であり一致は避けられない——権利の判断はしない。
// `design/rights-check.md`の方針）。
// ⚠️**同名は完全には消えない**（誕生日のパラドックス）。重複回避は`domain/humanNaming.js`が
// 別途行う。

export const FAMILY_NAMES = Object.freeze([
  "藤野", "桐山", "早坂", "三宅", "神谷", "梶原", "片岡", "瀬川", "白石", "秋元",
  "高梨", "桑原", "沖田", "柳沢", "芦田", "真鍋", "大森", "今井", "羽田", "島崎",
  "塚本", "野沢", "浅野", "前川", "井口", "篠原", "黒田", "平尾", "遠藤", "植村",
  "大島", "土屋", "谷口", "桜井", "岸本", "永井", "河合", "天野", "吉岡", "児玉",
]);

export const GIVEN_NAMES = Object.freeze([
  "和之", "隆司", "健吾", "拓也", "直樹", "慎太郎", "雅人", "光一", "修平", "正和",
  "亮介", "智也", "翔太", "康平", "剛志", "敏夫", "昭夫", "一郎", "茂", "浩二",
  "信也", "竜也", "春樹", "明彦", "英治", "太一", "尚人", "章", "徹", "秀樹",
  "忠雄", "貴之", "誠", "遼", "順平", "悟", "健太", "雄大", "伸一", "勇",
]);

/**
 * もじった人名を1つ作る。自己完結の純関数（引数のみを参照。乱数は呼び出し側が渡す）。
 * ⚠️このファイルは`data/`なので`core/rng.js`をimportしない（CLAUDE.md §5の依存の向き）。
 * 独立した乱数ストリームでの重複回避は`domain/humanNaming.js`の`pickHumanName`が行う。
 * @param {() => number} rand01
 * @returns {{ familyName: string, givenName: string, fullName: string }}
 */
export function generateModeledName(rand01) {
  const pick = (list) => list[Math.floor(rand01() * list.length) % list.length];
  const familyName = pick(FAMILY_NAMES);
  const givenName = pick(GIVEN_NAMES);
  return { familyName, givenName, fullName: `${familyName}${givenName}` };
}
