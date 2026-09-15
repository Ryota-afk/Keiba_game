// 評判（ARCHITECTURE.md §6「信頼」：全体に1つ。信頼の上位数件の平均。3本の線はここに引く）。
// ⚠️合計にしてはいけない——190件に広く浅く出入りするだけで上がり、主戦の座（1頭に
// 5回乗る）と逆のインセンティブになる。上位数件の平均なら深い関係を数本持つことが
// 評価され、主戦の座と同じ方向を向く。
// 純ロジック（JSX無し。外部依存なし）。

// 上位何件を平均するか（暫定・ARCHITECTURE.md §15「評判の上位件数」）。
export const REPUTATION_TOP_N = 5;

// 評判の3本の線（暫定・降順）。1本目を割る＝難易度が1段下がる／2本目＝依頼が来なくなる／
// 3本目＝引退勧告（§6）。⚠️具体値は未定（実装の弾で置く）。
export const REPUTATION_LINES = Object.freeze([30, 15, 0]);

/** 信頼マップ（trainerTrust・ownerTrust）から評判を計算する。上位N件の平均。 */
export function computeReputation(trainerTrust, ownerTrust, topN = REPUTATION_TOP_N) {
  const values = [...Object.values(trainerTrust), ...Object.values(ownerTrust)].sort(
    (a, b) => b - a
  );
  const top = values.slice(0, topN);
  if (top.length === 0) return 0;
  return top.reduce((sum, v) => sum + v, 0) / top.length;
}

/** 評判の変化で新しく割った線の番号（1〜3）を返す。割っていなければnull。 */
export function reputationLineCrossed(before, after) {
  for (let i = 0; i < REPUTATION_LINES.length; i += 1) {
    const line = REPUTATION_LINES[i];
    if (before >= line && after < line) return i + 1;
  }
  return null;
}
