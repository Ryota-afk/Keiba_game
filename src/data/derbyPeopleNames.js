// 史実の日本ダービー優勝馬に騎乗した騎手・調教した調教師の「もじった表示名」対応表。
// `data/derbyWinners.js`が持つのは実在の人物の実名で、⚠️実名をそのまま画面や実況に出さない
// （design/rights-check.md）。表示するときは必ずこのファイルの`displayJockeyName`/
// `displayTrainerName`を経由する。
//
// ⚠️このファイルの2つの対応表（`PARODY_JOCKEY_NAMES`・`PARODY_TRAINER_NAMES`）は
// 現時点では空。もじった名前は別の担当が作成中で、後からここへ追記される。
// 対応表に無い実名を渡された場合、`displayJockeyName`/`displayTrainerName`は"？"を返す
// （実名へフォールバックしない＝実名が画面に出る経路をここで作らない）。

/** 実名（`derbyWinners.js`の`jockey`）→もじった表示名。 */
export const PARODY_JOCKEY_NAMES = Object.freeze({});

/** 実名（`derbyWinners.js`の`trainer`）→もじった表示名。 */
export const PARODY_TRAINER_NAMES = Object.freeze({});

const UNKNOWN_DISPLAY_NAME = "？";

/**
 * 騎手の実名→もじった表示名。対応表に無ければ"？"（実名は返さない）。
 * @param {string} realJockeyName - `derbyWinners.js`の`jockey`
 * @returns {string}
 */
export function displayJockeyName(realJockeyName) {
  return PARODY_JOCKEY_NAMES[realJockeyName] ?? UNKNOWN_DISPLAY_NAME;
}

/**
 * 調教師の実名→もじった表示名。対応表に無ければ"？"（実名は返さない）。
 * @param {string} realTrainerName - `derbyWinners.js`の`trainer`
 * @returns {string}
 */
export function displayTrainerName(realTrainerName) {
  return PARODY_TRAINER_NAMES[realTrainerName] ?? UNKNOWN_DISPLAY_NAME;
}
