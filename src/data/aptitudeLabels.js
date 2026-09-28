// 騎手の適性10個（`data/aptitudeCategories.js`）の画面表記。
// ⚠️距離帯は「メートルのみ」（ARCHITECTURE.md §3「距離帯の画面表記」・全画面共通のルール）。
// 「マイル」は画面に出さない——4区分のうち`mile`だけが初見に伝わらない競馬用語のため。

export const DISTANCE_BAND_LABELS = Object.freeze({
  sprint: "〜1400m",
  mile: "1400〜1800m",
  intermediate: "1800〜2400m",
  long: "2400m〜",
});

export const SURFACE_LABELS = Object.freeze({
  turf: "芝",
  dirt: "ダート",
});

// 戦法4（逃げ／先行／差し／追込）。⚠️この言葉自体が競馬用語だが、他の言い方が
// まだ決まっていない（`TODO.md`のC1「戦法名の画面表記」・未解決）。当面はこのまま使う。
export const STRATEGY_LABELS = Object.freeze({
  nige: "逃げ",
  senko: "先行",
  sashi: "差し",
  oikomi: "追込",
});
