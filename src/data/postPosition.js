// 馬番・枠番（出馬表の表示用。質問25「金曜の確定で枠番と人気が付く」）。
// ⚠️実際のJRAは抽選で馬番を決めるが、今は抽選の仕組みを持たないため、渡された並び順
// （収得賞金順＝仮の人気順）をそのまま馬番の順に使う——着順やゲーム内の判定には使わない、
// 表示専用の値。
// 純データ＋純関数のみ（JSX無し）。

const GATE_COUNT = 8; // 枠番は1〜8（JRA共通）。

/**
 * 出走頭数`fieldSize`のとき、馬番`postNumber`（1始まり）がどの枠番（1〜8）になるかを返す。
 * 8頭ずつをできるだけ均等に分け、余りは若い枠から1頭ずつ多く割り当てる
 * （例：18頭なら1〜2枠が3頭・3〜8枠が... の形にはならず、1枠から順に埋まる素直な分割）。
 */
export function wakuForPostNumber(postNumber, fieldSize) {
  const base = Math.floor(fieldSize / GATE_COUNT);
  const extra = fieldSize % GATE_COUNT;
  let cursor = 0;
  for (let gate = 1; gate <= GATE_COUNT; gate += 1) {
    const gateSize = gate <= extra ? base + 1 : base;
    if (postNumber <= cursor + gateSize) return gate;
    cursor += gateSize;
  }
  return GATE_COUNT;
}

/**
 * 出走馬の配列（既に何らかの順で並んでいる）に、馬番・枠番を振る。純関数。
 * @param {object[]} entries
 * @returns {(object & { postNumber: number, waku: number })[]}
 */
export function assignPostPositions(entries) {
  const fieldSize = entries.length;
  return entries.map((entry, i) => {
    const postNumber = i + 1;
    return { ...entry, postNumber, waku: wakuForPostNumber(postNumber, fieldSize) };
  });
}
