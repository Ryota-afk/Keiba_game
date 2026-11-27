// 調子（見えない0〜100の軸）と当日の馬体重の定数（⑭ step2・`devlog/wave13.md`§25 §2・`arch/horse.md`「出来」）。
// リテラルだけ。計算は`domain/horseForm.js`。
// ⚠️印の無い値も含め、ほとんどが「根拠なし（計測で合わせた値）」。どれに何を合わせたかは各行に書く。

// ---------------------------------------------------------------------------
// 調子
// ---------------------------------------------------------------------------

// 休み明けからの走数（`startsSinceRest`。休むと小数で減る）→調子の基準値。間は直線でつなぐ。
// ⭐形（2026-09-12のユーザー決定）：休み明けが一番低い→2〜3走したあたり（s=2〜3）が頂点→使うほど落ちる。
// ⚠️値そのものは根拠なし（形だけが決定）。
export const FORM_CURVE = Object.freeze([
  [0, 36],
  [1, 52],
  [2, 64],
  [3, 66],
  [4, 61],
  [6, 53],
  [9, 44],
  [14, 38],
]);
export const FORM_PEAK_STARTS = 3; // 頂点の走数（ここから先が「使い減り」）

// 健康（0〜1）が効く3か所（⚠️根拠なし）。
export const HEALTH_LEVEL_SPAN = 16; // 頂点の高さ：健康0.5との差×16（休み明けの1走目はその半分）
export const HEALTH_DECLINE_MIN = 0.7; // 使い減りの速さ：健康1.0で0.7倍、健康0で1.3倍
export const HEALTH_DECLINE_MAX = 1.3;
export const RECOVERY_PER_WEEK_BASE = 0.15; // 前走から`RECOVERY_GRACE_WEEKS`を超えた週ごとに、走数がこれだけ戻る
export const RECOVERY_PER_WEEK_HEALTH = 0.25; // ＋健康×0.25（健康が高いほど戻りが速い）
export const RECOVERY_GRACE_WEEKS = 2;
// この週数以上空いたら「休み明け」として走数を0に戻す（⚠️根拠なし。「中9週」＝10週空いた）。
export const REST_RESET_WEEKS = 10;

// 間隔を詰めたときの調子の減点（⚠️根拠なし）。連闘（1週）−6・中1週（2週）−2。
export const SHORT_GAP_LEVEL_PENALTY = Object.freeze({ 1: -6, 2: -2 });

// 当日の揺れ（標準偏差・調子の点）。賢さ（0〜1）が高いほど狭い：賢さ0で12・賢さ1で4（⚠️根拠なし）。
export const DAY_LEVEL_SD_MAX = 12;
export const DAY_LEVEL_SD_MIN = 4;

// ---------------------------------------------------------------------------
// 当日の馬体重（ベスト体重＋太め−細さ＋その日の揺れ。2kg刻み）
// ---------------------------------------------------------------------------

// 太め：前走から`FAT_GRACE_WEEKS`を超えて空いた分だけ`FAT_MAX_KG`へ近づく（時定数`FAT_TAU_WEEKS`）。
// 1走ごとに`FAT_KEEP_AFTER_RACE`倍へ減る。⚠️どれも根拠なし（2024年の増減の分布§3.3に合わせて置いた）。
export const FAT_MAX_KG = 6;
export const FAT_GRACE_WEEKS = 3;
export const FAT_TAU_WEEKS = 14;
export const FAT_KEEP_AFTER_RACE = 0.5;

// 細さ：休み明けから`THIN_FROM_STARTS`走を超えて使うと1走ごとに増える。連闘はさらに細くなる（⚠️根拠なし）。
export const THIN_FROM_STARTS = 4;
export const THIN_PER_START_KG = 0.5;
export const THIN_MAX_KG = 4;
export const CONSECUTIVE_THIN_KG = 2;

// その日の揺れ（輸送・飼い葉・排糞。調子と無関係）の標準偏差（kg）。⚠️根拠なし（§3.3の±0kg 15.5%に近づけた・実測13.8%）。
export const DAY_KG_SD = 2.8;

// 調教後の体重（週の画面）＝当日の体重＋ずれ。ずれは−4〜＋4kgの2kg刻み・平均0（⚠️向きも大きさも出典なし・2026-11-27のユーザー決定で仮置き）。
export const TRAINING_KG_OFFSET_MAX = 4;

// ---------------------------------------------------------------------------
// 走りへの掛け方（スピード・瞬発力・勝負根性の3つだけ・`arch/horse.md`「出来」）
// ---------------------------------------------------------------------------
// 倍率＝1＋FORM_FACTOR_SPAN×(調子−FORM_LEVEL_CENTER)/50 − WEIGHT_FACTOR_PER_KG×max(0, |ずれ|−WEIGHT_FREE_KG) ＋究極仕上げ。
// ⭐目標（ユーザー決定）：同じ馬で一番良い状態の勝率が一番悪い状態の約2倍。値は計測で決めた（`devlog/wave13b.md`§28）：
// 同じ馬・同じレースで倍率だけを出走の倍率の上位5%／下位5%の値に置き換えると、勝率15.9〜16.6%／8.2〜8.6%＝1.93倍（2世界・実測）。
// ⚠️simの能力の効きは鈍い（倍率1.10／0.90で勝率は1.5倍しか開かない・実測）ので、この幅が要る。
// 調子の中心＝出走の日の調子の中央値（実測44）。ここで倍率が1になる。
export const FORM_LEVEL_CENTER = 44;
export const FORM_FACTOR_SPAN = 0.36;
export const WEIGHT_FREE_KG = 2;
export const WEIGHT_FACTOR_PER_KG = 0.016;
export const WEIGHT_FACTOR_MAX_LOSS = 0.16;
// 究極仕上げ：調子が上位2割（出走の調子の分布の上位20%の境目＝実測57〜58）で、ずれが±2kg以内（出走の約12%）。
// 上乗せ0.05は根拠なし（上の2倍の目標の中で、上位5%の倍率の一部として置いた）。
export const ULTIMATE_LEVEL = 58;
export const ULTIMATE_MAX_DEV_KG = 2;
export const ULTIMATE_BONUS = 0.05;
