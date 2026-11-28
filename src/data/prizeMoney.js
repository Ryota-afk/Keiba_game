// 騎手の進上金の割合（ARCHITECTURE.md §8「騎手の収入」）。
// 本賞金の配分は馬主80%・調教師10%・騎手（進上金）5%・厩務員5%。
// ⭐騎手の進上金は、その鞍で馬が取った本賞（`domain/horse.js`の`earningsForResult`・重賞は実際の`prize1`）の5%。
// 1〜5着に出る（`devlog/wave14.md`§1）。旧`PLACEHOLDER_PURSE_BY_CLASS`（クラス別の仮の賞金表）は撤去した。

export const JOCKEY_PRIZE_SHARE = 0.05; // 進上金5%
