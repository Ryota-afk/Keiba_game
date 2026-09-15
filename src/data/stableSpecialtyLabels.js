// 厩舎の得意分野8種類の画面表記（`devlog/wave02.md`「厩舎の一言は廃止し、得意分野の
// 表示自体を短い文にする」の決定）。
// ⚠️距離帯の書き方は「メートルのみ」（ARCHITECTURE.md §3「距離帯の画面表記」・
// 全画面共通のルール）：`〜1400m`／`1400〜1800m`／`1800〜2400m`／`2400m〜`。
// ⚠️`domain/stable.js`の`SPECIALTIES`の文字列キーをそのまま持つ（data/はdomain/を
// importしない——CLAUDE.md §5の依存の向きを守るため、キーをここへ複製している）。

export const SPECIALTY_LABELS = Object.freeze({
  "turf-sprint": "芝の〜1400mが専門",
  "turf-mile": "芝の1400〜1800mが専門",
  "turf-intermediate": "芝の1800〜2400mが専門",
  "turf-long": "芝の2400m〜が専門",
  "dirt-sprint": "ダートの〜1400mが専門",
  "dirt-mile": "ダートの1400〜1800mが専門",
  "dirt-intermediate": "ダートの1800〜2400mが専門",
  "dirt-long": "ダートの2400m〜が専門",
});

/** 得意分野のキーから画面表記を引く。未知のキーはキーをそのまま返す（フェイルセーフ）。 */
export function specialtyLabel(specialty) {
  return SPECIALTY_LABELS[specialty] ?? specialty;
}

// 得意分野の馬場・距離帯（判定用）。`domain/stable.js`の`SPECIALTIES`と対にして使う。
export const SPECIALTY_SURFACE = Object.freeze({
  "turf-sprint": "turf",
  "turf-mile": "turf",
  "turf-intermediate": "turf",
  "turf-long": "turf",
  "dirt-sprint": "dirt",
  "dirt-mile": "dirt",
  "dirt-intermediate": "dirt",
  "dirt-long": "dirt",
});

export const SPECIALTY_DISTANCE_BAND = Object.freeze({
  "turf-sprint": "sprint",
  "turf-mile": "mile",
  "turf-intermediate": "intermediate",
  "turf-long": "long",
  "dirt-sprint": "sprint",
  "dirt-mile": "mile",
  "dirt-intermediate": "intermediate",
  "dirt-long": "long",
});
