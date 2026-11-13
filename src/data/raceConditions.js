// 重賞の実データが持つ`condition`文字列（例："3歳以上 ハンデ"）を読む純関数
// （第11弾・`devlog/wave11.md`§12・CLAUDE.md §10「機能追加とバランス計測はセット」）。
//
// ⚠️読むのは年齢（「N歳」＝ちょうどN歳・「N歳以上」＝N歳以上）と性別
// （「牡牝」＝牡と牝だけ・セン不可／「牝」＝牝だけ）の2つだけ。
// ⚠️**読まない（今回は通す）**：「除◯◯1着馬」（実測18件・4歳以上牡牝の重賞のみ）・
// 「父内国産」（実測28件）・負担重量の種別（ハンデ／別定／定量／馬齢——着順には関わるが
// 出走資格には関わらない）。実測は`src/data/generated/gradedRaces.*.json`1972〜1987年・
// 1,400本の全件走査（`devlog/wave11.md`§12）。
//
// 純データ＋純関数のみ（JSX無し）。馬を読む判定（`horse.bornYear`・`horse.gender`）は
// `domain/horse.js`の`isAgeSexEligible`に置く（このファイルは文字列だけを読む）。

/**
 * @param {string|null|undefined} condition - 例："3歳牡牝 定量"・"4歳以上 ハンデ"・
 *   "4歳以上牡牝（除天皇賞1着馬） 定量"。`null`は「一般競走」等、年齢・性別条件のデータを
 *   持たないレース（グレード表記の無い年の重賞を含む）。
 * @returns {{ minAge: number|null, maxAge: number|null,
 *   sexes: ("colt"|"filly"|"gelding")[]|null }} `sexes`が`null`なら性別の制限なし。
 *   `maxAge`が`null`なら上限なし（「N歳以上」）。`condition`が`null`なら全項目`null`
 *   （制限なし）。
 */
export function parseRaceCondition(condition) {
  if (!condition) return { minAge: null, maxAge: null, sexes: null };

  const ageMatch = condition.match(/(\d+)歳(以上)?/);
  let minAge = null;
  let maxAge = null;
  if (ageMatch) {
    const age = Number(ageMatch[1]);
    minAge = age;
    maxAge = ageMatch[2] ? null : age; // 「以上」が無ければちょうどその歳
  }

  // ⚠️「牡牝」は「牝」を部分文字列として含むため、必ず「牡牝」を先に見る。
  let sexes = null;
  if (condition.includes("牡牝")) sexes = ["colt", "filly"];
  else if (condition.includes("牝")) sexes = ["filly"];

  return { minAge, maxAge, sexes };
}
