// 週の画面の「疲労の帯」に出す文字と位置を組む純関数（見本：`design/mocks/fatigue-week-v2.html`案A）。
// DOM無し・JSX無し。`domain/`はimportしない——境目の値（50・70・100）と能力の下がり幅は、
// 画面（`screens/WeekScreen.jsx`）が`domain/fatigue.js`から取って渡す。ここに式や値を書き写さない。

const pct = (value, max) => (max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);

/** 能力の下がり幅の文字。下がらないときは空文字。四捨五入で0%なら「−1%」＋「未満」。 */
function penaltyParts(isPenalized, penalty) {
  if (!isPenalized) return { num: "", tail: "" };
  const rounded = Math.round(penalty * 100);
  return rounded < 1 ? { num: "−1%", tail: "未満" } : { num: `−${rounded}%`, tail: "" };
}

/**
 * @param {object} p
 * @param {number} p.now 今週（今）の疲労（`player.fatigue`）
 * @param {number} p.next 来週の疲労（`fatigueAfterRides`の戻り値）
 * @param {number} p.nowPenalty 今週の疲労での能力の下がり幅（0〜1。`1 − fatiguePenaltyFactor(now)`）
 * @param {number} p.penalty 来週の疲労での能力の下がり幅（0〜1。`1 − fatiguePenaltyFactor(next)`）
 * @param {number} p.penaltyStart 能力が下がり始める疲労（`FATIGUE_PENALTY_START`）
 * @param {number} p.dangerThreshold 落馬しやすくなる疲労（`FATIGUE_DANGER_THRESHOLD`）
 * @param {number} p.max 疲労の上限（`FATIGUE_MAX`）
 * @returns {object}
 *   今週：`nowText`・`isNowDanger`・`isNowPenalized`・`nowPenaltyText`（＝`nowPenaltyNum`＋`nowPenaltyTail`）
 *   来週：`nextText`・`isDanger`・`isPenalized`・`penaltyText`（＝`penaltyNum`＋`penaltyTail`）
 *   `*PenaltyText`は能力が下がらないとき空文字（その項目ごと出さない）。`*Tail`は「未満」か空文字。
 *   帯の下の言葉：`isAnyPenaltyZone`＝どちらかの週が「能力が落ちる」の区間（下がり始め超〜危険未満）、
 *   `isAnyDanger`＝どちらかの週が危険以上。`*Pct`は帯の左端からの位置（0〜100）。
 */
export function fatigueBandView({ now, next, nowPenalty = 0, penalty, penaltyStart, dangerThreshold, max }) {
  const isDanger = next >= dangerThreshold;
  const isPenalized = next > penaltyStart;
  const isNowDanger = now >= dangerThreshold;
  const isNowPenalized = now > penaltyStart;
  const nextPen = penaltyParts(isPenalized, penalty);
  const nowPen = penaltyParts(isNowPenalized, nowPenalty);
  return {
    nowText: String(Math.round(now)),
    nextText: String(Math.round(next)),
    isDanger,
    isPenalized,
    penaltyText: nextPen.num + nextPen.tail,
    penaltyNum: nextPen.num,
    penaltyTail: nextPen.tail,
    isNowDanger,
    isNowPenalized,
    nowPenaltyText: nowPen.num + nowPen.tail,
    nowPenaltyNum: nowPen.num,
    nowPenaltyTail: nowPen.tail,
    isAnyPenaltyZone: (isPenalized && !isDanger) || (isNowPenalized && !isNowDanger),
    isAnyDanger: isDanger || isNowDanger,
    nowPct: pct(now, max),
    nextPct: pct(next, max),
    startPct: pct(penaltyStart, max),
    dangerPct: pct(dangerThreshold, max),
  };
}
