// 必ず知らせる6項目（ARCHITECTURE.md §1「必ず知らせる6項目（飛んだ週でも通知する）」）。
// 純ロジック（JSX無し。外部依存なし）。
//
// ⚠️2番（預けた鞍で自分の馬が勝ったこと）だけは、この時点でまだ組み立てられない。
// 「預ける」仕組み自体が未実装のため（§3 D4）。1・4・5・6は`domain/weekLoop.js`
// （週の進行の主ループ）が組み立てる。

export const NOTIFICATION_TYPES = Object.freeze({
  LOST_MAIN_MOUNT: "lostMainMount", // 1
  ENTRUSTED_WIN: "entrustedWin", // 2
  INJURY: "injury", // 3
  BIG_TRUST_CHANGE: "bigTrustChange", // 4
  NEW_REQUEST: "newRequest", // 5
  FATIGUE_DANGER: "fatigueDanger", // 6
});

// 「信頼が大きく動いた」と見なす変化幅（暫定）。
// ⚠️実測で判明：`weekResults.js`の1回の勝利で動く最大幅は4（RIDE_TRAINER_TRUST_GAIN 1 +
// WIN_TRAINER_TRUST_GAIN 3）。閾値を5のままにすると、勝っても絶対にこの通知が発火しない
// （104週のシミュレーションで実測0件）。勝利を「大きく動いた」に含める意図で4に下げた。
export const BIG_TRUST_CHANGE_THRESHOLD = 4;

export function injuryNotification(horseId, injuryType, weeksOut) {
  return { type: NOTIFICATION_TYPES.INJURY, horseId, injuryType, weeksOut };
}

export function bigTrustChangeNotification(targetType, targetId, delta) {
  return { type: NOTIFICATION_TYPES.BIG_TRUST_CHANGE, targetType, targetId, delta };
}

export function fatigueDangerNotification(fatigue) {
  return { type: NOTIFICATION_TYPES.FATIGUE_DANGER, fatigue };
}

export function lostMainMountNotification(horseId) {
  return { type: NOTIFICATION_TYPES.LOST_MAIN_MOUNT, horseId };
}

export function newRequestNotification(horseId, stableId) {
  return { type: NOTIFICATION_TYPES.NEW_REQUEST, horseId, stableId };
}

/** 信頼の変化幅が「大きく動いた」と言える大きさか。 */
export function isBigTrustChange(delta) {
  return Math.abs(delta) >= BIG_TRUST_CHANGE_THRESHOLD;
}
