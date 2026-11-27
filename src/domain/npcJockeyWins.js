// NPC騎手の年間勝ち数（ARCHITECTURE.md §8「一流＝最多勝利騎手」の判定材料）。
// 純ロジック（JSX無し。外部依存なし）。
//
// ⚠️「最多勝利騎手」の判定にはNPC騎手の年間勝ち数が要るが、今は数えていなかった
// （`devlog/wave12.md`§9）。`domain/weekLoop.js`が週末に、その週の一般競走・重賞の勝ち馬から
// 騎手を特定して（`domain/jockeyAssignment.js`の`jockeyIdForHorse`）、ここで積む。

/**
 * その週に勝ったNPC騎手ぶんの勝ち数を、まとめて積む。純関数——引数の配列を書き換えず
 * 新しい配列を返す。1人ずつ`map`し直すのではなく、1回の`map`で全員分処理する
 * （NPC騎手数×勝者数のO(n*m)を避ける）。
 * @param {object[]} npcJockeys
 * @param {Map<string, number>} jockeyIdCounts - 騎手id -> その週の勝ち数
 * @param {number} year
 * @returns {object[]}
 */
export function recordJockeyWins(npcJockeys, jockeyIdCounts, year) {
  if (jockeyIdCounts.size === 0) return npcJockeys;
  return npcJockeys.map((jockey) => {
    const gain = jockeyIdCounts.get(jockey.id);
    if (!gain) return jockey;
    const winsByYear = jockey.winsByYear ?? {};
    return { ...jockey, winsByYear: { ...winsByYear, [year]: (winsByYear[year] ?? 0) + gain } };
  });
}

/** ある年のNPC騎手の最多勝ち数（1人もいなければ0）。 */
export function maxNpcWinsInYear(npcJockeys, year) {
  let max = 0;
  for (const jockey of npcJockeys) {
    const wins = jockey.winsByYear?.[year] ?? 0;
    if (wins > max) max = wins;
  }
  return max;
}

/**
 * その週に勝った馬を探し、乗っていた騎手idごとの勝ち数を数える（`recordJockeyWins`の入力）。
 * 「今週勝った」は`horse.record.recentFinishes[0]`が今週・1着かどうかで判定する
 * （`npcWeeklyRace.js`/`npcGradedRace.js`は勝者一覧を返さないため）。`weekLoop.js`（本編）と
 * `bootstrap.js`（事前シミュレーション）の両方が使う。
 * @param {object[]} horses - その週のレースが終わった後の全馬
 * @param {number} week - 絶対週
 * @param {Set<string>|null} excludeHorseIds - 数えない馬（プレイヤーが乗った馬）
 * @param {(horse: object) => string|undefined} jockeyIdOf
 * @returns {Map<string, number>}
 */
export function countWinnerJockeys(horses, week, excludeHorseIds, jockeyIdOf) {
  const counts = new Map();
  for (const horse of horses) {
    if (excludeHorseIds?.has(horse.id)) continue;
    const last = horse.record?.recentFinishes?.[0];
    if (!last || last.week !== week || last.position !== 1) continue;
    const jockeyId = jockeyIdOf(horse);
    if (!jockeyId) continue;
    counts.set(jockeyId, (counts.get(jockeyId) ?? 0) + 1);
  }
  return counts;
}

/**
 * ⭐NPC騎手の年ごとの騎乗数・獲得賞金の材料を、その週の分だけ数える（年末の賞「最高勝率」「最多獲得賞金」。
 * `devlog/wave13.md`§10）。騎乗数＝今週走った馬（`record.recentFinishes[0].week`が今週）＋プレイヤーが乗った
 * 重賞の相手馬（`extraStarterIds`。負けた側は記録に残らないため別に渡す）。賞金＝その馬の獲得賞金
 * （`record.earnings`）の今週の増え。プレイヤーが乗った馬は数えない（`excludeHorseIds`）。
 * ⚠️プレイヤーが乗った重賞の相手馬は、勝った馬の賞金だけ数える（2着以下の記録は馬に積んでいないため）。
 * @param {object[]} horsesBefore - 今週の初めの馬（賞金の増えを引くための元の値）
 * @param {object[]} horsesAfter - 今週のレースが終わった後の全馬
 * @param {number} week - 絶対週
 * @param {Set<string>} excludeHorseIds - 数えない馬（プレイヤーが乗った馬）
 * @param {Set<string>} extraStarterIds - 記録は無いが今週走った馬（プレイヤーが乗った重賞の相手馬）
 * @param {(horse: object) => string|undefined} jockeyIdOf
 * @returns {{ starts: Map<string, number>, prize: Map<string, number> }} 騎手id -> 今週の値
 */
export function countJockeyRideStats(horsesBefore, horsesAfter, week, excludeHorseIds, extraStarterIds, jockeyIdOf) {
  const earningsBefore = new Map(horsesBefore.map((h) => [h.id, h.record?.earnings ?? 0]));
  const starts = new Map();
  const prize = new Map();
  const counted = new Set();
  const bump = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);
  for (const horse of horsesAfter) {
    if (excludeHorseIds.has(horse.id)) continue;
    const ran = horse.record?.recentFinishes?.[0]?.week === week;
    if (!ran && !extraStarterIds.has(horse.id)) continue;
    const jockeyId = jockeyIdOf(horse);
    if (!jockeyId) continue;
    counted.add(horse.id);
    bump(starts, jockeyId, 1);
    const gain = (horse.record?.earnings ?? 0) - (earningsBefore.get(horse.id) ?? 0);
    if (ran && gain > 0) bump(prize, jockeyId, gain);
  }
  return { starts, prize };
}

/**
 * `countJockeyRideStats`の結果を騎手の年ごとの欄（`startsByYear`・`prizeByYear`）へ積む。純関数。
 * 今週1回の`map`で全員分処理する（`recordJockeyWins`と同じ形）。
 */
export function recordJockeyRideStats(npcJockeys, stats, year) {
  if (stats.starts.size === 0 && stats.prize.size === 0) return npcJockeys;
  return npcJockeys.map((jockey) => {
    const s = stats.starts.get(jockey.id);
    const p = stats.prize.get(jockey.id);
    if (!s && !p) return jockey;
    const next = { ...jockey };
    if (s) next.startsByYear = { ...(jockey.startsByYear ?? {}), [year]: (jockey.startsByYear?.[year] ?? 0) + s };
    if (p) next.prizeByYear = { ...(jockey.prizeByYear ?? {}), [year]: (jockey.prizeByYear?.[year] ?? 0) + p };
    return next;
  });
}
