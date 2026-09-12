// 主戦の座（ARCHITECTURE.md §6「主戦の座」）。
// 「同じ馬に5回乗り、その間に1勝すると主戦。5回は累積・間に他騎手が乗ってもリセット
// しない。失うのは他騎手が乗って勝ったときだけ。」
// 純ロジック（JSX無し。外部依存なし）。

export const MAIN_MOUNT_RIDES_REQUIRED = 5;

/**
 * 自分がその馬に乗った結果を記録する。純関数。
 * @param {object} mainMounts - horseId -> { rides, hasWon, isMain }
 * @param {string} horseId
 * @param {boolean} won
 */
export function recordRide(mainMounts, horseId, won) {
  const current = mainMounts[horseId] ?? { rides: 0, hasWon: false, isMain: false };
  const rides = current.rides + 1;
  const hasWon = current.hasWon || won;
  // ⚠️既に主戦なら再判定しない（下の`loseMainMountToRival`が明示的にfalseへ落とすまで維持）。
  // まだ主戦でない場合のみ、累積5回＋1勝の条件を満たした瞬間に主戦になる。
  const isMain = current.isMain || (rides >= MAIN_MOUNT_RIDES_REQUIRED && hasWon);
  return { ...mainMounts, [horseId]: { rides, hasWon, isMain } };
}

/**
 * 他騎手がその馬に乗って勝ち、主戦の座を失う。純関数。
 * ⚠️実装上の解釈（ARCHITECTURE.mdは「失う」とだけ書き、再び主戦に戻る条件は
 * 明記していない）：`rides`（乗った回数の実績）は消さないが、`hasWon`は取り消す——
 * 「1勝」の実績そのものが他騎手のものになった、という扱い。次に自分が勝てば
 * （5回の条件は既に満たしているため）即座に主戦へ復帰できる。
 */
export function loseMainMountToRival(mainMounts, horseId) {
  const current = mainMounts[horseId];
  if (!current || !current.isMain) return mainMounts; // 主戦でなければ失いようがない
  return { ...mainMounts, [horseId]: { ...current, isMain: false, hasWon: false } };
}

/** その馬が現在主戦かどうか。 */
export function isMainMount(mainMounts, horseId) {
  return mainMounts[horseId]?.isMain ?? false;
}
