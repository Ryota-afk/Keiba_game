// 週の画面の「疲労の帯」に出す文字と位置を組む純関数（見本：`design/mocks/fatigue-week-v1.html`案A）。
// DOM無し・JSX無し。`domain/`はimportしない——境目の値（50・70・100）と能力の下がり幅は、
// 画面（`screens/WeekScreen.jsx`）が`domain/fatigue.js`から取って渡す。ここに式や値を書き写さない。

const pct = (value, max) => (max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);

/**
 * @param {object} p
 * @param {number} p.now 今の疲労（`player.fatigue`）
 * @param {number} p.next 来週の疲労（`fatigueAfterRides`の戻り値）
 * @param {number} p.penalty 来週の疲労での能力の下がり幅（0〜1。`1 − fatiguePenaltyFactor(next)`）
 * @param {number} p.penaltyStart 能力が下がり始める疲労（`FATIGUE_PENALTY_START`）
 * @param {number} p.dangerThreshold 落馬しやすくなる疲労（`FATIGUE_DANGER_THRESHOLD`）
 * @param {number} p.max 疲労の上限（`FATIGUE_MAX`）
 * @returns {{ nowText: string, nextText: string, isDanger: boolean, isPenalized: boolean,
 *   penaltyText: string, nowPct: number, nextPct: number, startPct: number, dangerPct: number }}
 *   `penaltyText`は能力が下がらないとき空文字（その項目ごと出さない）。`*Pct`は帯の左端からの位置（0〜100）。
 */
export function fatigueBandView({ now, next, penalty, penaltyStart, dangerThreshold, max }) {
  const isDanger = next >= dangerThreshold;
  const isPenalized = next > penaltyStart;
  let penaltyText = "";
  if (isPenalized) {
    const rounded = Math.round(penalty * 100);
    penaltyText = rounded < 1 ? "−1%未満" : `−${rounded}%`;
  }
  return {
    nowText: String(Math.round(now)),
    nextText: String(Math.round(next)),
    isDanger,
    isPenalized,
    penaltyText,
    nowPct: pct(now, max),
    nextPct: pct(next, max),
    startPct: pct(penaltyStart, max),
    dangerPct: pct(dangerThreshold, max),
  };
}
