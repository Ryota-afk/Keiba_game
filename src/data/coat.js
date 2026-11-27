// 馬の見た目の元データ：毛色・白い模様・ベスト体重の表
// （`devlog/wave13.md`§25 ⑭・`design/horse-appearance-facts.md`§1〜§3）。リテラルのみ（JSX・ロジック無し）。

// 毛色8種（JRAの決まり）。表示名。
export const COAT_IDS = Object.freeze([
  "bay", "darkBay", "brown", "black", "chestnut", "liverChestnut", "gray", "white",
]);
export const COAT_LABEL = Object.freeze({
  bay: "鹿毛",
  darkBay: "黒鹿毛",
  brown: "青鹿毛",
  black: "青毛",
  chestnut: "栗毛",
  liverChestnut: "栃栗毛",
  gray: "芦毛",
  white: "白毛",
});

// 2024年のJRA全レース45,667出走の割合（%・確認済み・`horse-appearance-facts.md`§1.2(b)）。
export const COAT_SHARE_2024 = Object.freeze({
  bay: 46.1,
  darkBay: 19.9,
  brown: 7.0,
  black: 0.7,
  chestnut: 19.9,
  liverChestnut: 0.1,
  gray: 6.2,
  white: 0.07,
});

// 白毛の突然変異（親に白毛遺伝子が無い子が白毛になる確率）。⚠️**根拠なし（仮）**：白毛は突然変異でも
// 生まれる（W白毛。日本最初のハクタイユー）が頻度の出典は無い。これが無いと、白毛遺伝子を持つ親が
// 繁殖から消えた時点で白毛が二度と出ない（22年の計測で2024年の0.07%→0.0〜0.1%に落ちた）。0.0005では5世代で0.23%まで増えたので0.0002に下げた。
export const WHITE_MUTATION_RATE = 0.0002;

// ⚠️白い模様の割合は**根拠なし（仮）**：承認済みの出典に頻度の数字が無く、こちらで置いた値
// （2026-11-27・ユーザー決定「割合はこちらで置く」）。名前そのものはJRA用語辞典で確認済み。
// 顔の白斑（%）。starSnip＝星と鼻白の組み合わせ（星鼻白）／strip＝作／bald＝白面。
export const FACE_MARKING_SHARE = Object.freeze({
  none: 35,
  star: 25,
  blaze: 15, // 流星
  strip: 10, // 作
  starSnip: 7, // 星鼻白
  snip: 5, // 鼻白
  bald: 3, // 白面
});
export const FACE_MARKING_LABEL = Object.freeze({
  none: "なし",
  star: "星",
  blaze: "流星",
  strip: "作",
  starSnip: "星鼻白",
  snip: "鼻白",
  bald: "白面",
});

// 脚の白い本数（%・⚠️根拠なし・仮）。
export const LEG_WHITE_COUNT_SHARE = Object.freeze({ 0: 45, 1: 25, 2: 17, 3: 8, 4: 5 });
// 白い脚1本の高さ（1=微白・2=中・3=長白の3段）の割合（%・⚠️根拠なし・仮。本作で置いた値）。
export const LEG_WHITE_HEIGHT_SHARE = Object.freeze({ 1: 50, 2: 30, 3: 20 });
export const LEG_WHITE_HEIGHT_LABEL = Object.freeze({ 1: "微白", 2: "中", 3: "長白" });
export const LEG_COUNT = 4; // 左前・右前・左後・右後

// ベスト体重の性×年齢の平均（kg・2024年・`horse-appearance-facts.md`§3.2）。
// 年齢は馬齢（年−生年）。5歳以上は同じ値。セン馬は牡の−3kg（2024年のセン479.9kg−牡482.8kg）。
export const BODY_KG_BASE = Object.freeze({
  colt: Object.freeze({ 2: 472, 3: 480, 4: 489, 5: 492 }),
  filly: Object.freeze({ 2: 446, 3: 450, 4: 464, 5: 468 }),
});
export const GELDING_KG_OFFSET = -3;
export const BODY_KG_MIN_AGE = 2;
export const BODY_KG_MAX_AGE = 5;

// 季節の増減（±kg）。牡・セン：1月が重く8月が軽い／牝：10月が重く3月が軽い。幅±4kg
// （2024年の4歳以上牡の最軽7月485.3kg・最重12月493.7kgの差8.4kgの半分を丸めた）。
// ⚠️週は1〜52（`data/calendar.js`の暦。1月＝1〜4週・8月＝31〜34週付近・10月＝40〜43週・3月＝9〜13週）。
export const SEASONAL_KG_AMPLITUDE = 4;
export const SEASONAL_PEAK_TROUGH_WEEK = Object.freeze({
  colt: Object.freeze({ peak: 2, trough: 31 }),
  gelding: Object.freeze({ peak: 2, trough: 31 }),
  filly: Object.freeze({ peak: 41, trough: 11 }),
});

// 馬場の傾き：ダート寄りの馬は+6kg・芝寄りは−6kg（2024年の芝464.9kg・ダート477.1kgの差12kgの半分）。
export const SURFACE_KG_OFFSET = 6;

// ベスト体重の個体差（frameKg）の標準偏差。⭐⑭ step2で27→26に下げた：当日の体重（ベスト体重＋太め−細さ＋
// その日の揺れ・`domain/horseForm.js`）の同じ性×年齢の中の標準偏差が2024年（24.5〜29.0kg）に合う値
// （52週×2本の実測25.1〜29.4kg・`devlog/wave13b.md`§28）。
export const FRAME_KG_SD = 26;
export const FRAME_KG_LIMIT_SD = 3; // 正規乱数を±3SDで切る
