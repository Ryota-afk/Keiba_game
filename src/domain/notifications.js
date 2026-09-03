// 必ず知らせる6項目（ARCHITECTURE.md §1「必ず知らせる6項目（飛んだ週でも通知する）」）。
// 純ロジック（JSX無し。外部依存なし）。
//
// ⚠️6項目のうち、この時点で組み立てられるのは3・4・6のみ：
//   1. 主戦の座を失ったこと ── 検出には「プレイヤーが乗っていない週でも、主戦の座を
//      持つ馬にNPC騎手が勝ったら失う」判定が要る。今は確定した鞍（自分が乗る鞍）の
//      結果しか処理していないため、まだ組み立てられない（週の進行の主ループを書く
//      ときに追加する）。
//   2. 預けた鞍で自分の馬が勝ったこと ── 「預ける」仕組み自体が未実装（§3 D4）。
//   5. 新しい依頼が来たこと ── 週次の依頼一覧どうしの差分から出せるはずだが、
//      「先週の一覧」を保持する場所（state/セーブ）が無いとまだ比較できない。
// 3件とも実装しない理由をここに明記し、`TODO.md`へは上げない
// （まだ「その弾で直しきれない」段階ではなく、依存する仕組みが後続で実装される予定のため）。

export const NOTIFICATION_TYPES = Object.freeze({
  LOST_MAIN_MOUNT: "lostMainMount", // 1
  ENTRUSTED_WIN: "entrustedWin", // 2
  INJURY: "injury", // 3
  BIG_TRUST_CHANGE: "bigTrustChange", // 4
  NEW_REQUEST: "newRequest", // 5
  FATIGUE_DANGER: "fatigueDanger", // 6
});

// 「信頼が大きく動いた」と見なす変化幅（暫定）。
export const BIG_TRUST_CHANGE_THRESHOLD = 5;

export function injuryNotification(horseId, injuryType, weeksOut) {
  return { type: NOTIFICATION_TYPES.INJURY, horseId, injuryType, weeksOut };
}

export function bigTrustChangeNotification(targetType, targetId, delta) {
  return { type: NOTIFICATION_TYPES.BIG_TRUST_CHANGE, targetType, targetId, delta };
}

export function fatigueDangerNotification(fatigue) {
  return { type: NOTIFICATION_TYPES.FATIGUE_DANGER, fatigue };
}

/** 信頼の変化幅が「大きく動いた」と言える大きさか。 */
export function isBigTrustChange(delta) {
  return Math.abs(delta) >= BIG_TRUST_CHANGE_THRESHOLD;
}
