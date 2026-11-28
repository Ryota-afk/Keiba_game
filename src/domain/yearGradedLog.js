// その年に行われた重賞の結果の記録（年末のまとめの「G1の勝ち馬」の材料・`devlog/wave13.md`§10）。
// ⭐2026-11-28：プレイヤーが乗って負けた重賞の勝ち馬を別に積む仕組み（E2）は撤去した——プレイヤーの重賞も
// 世界の重賞として走るので、勝ち馬の勝ちは他の重賞と同じに積まれる（`devlog/wave14.md`§19）。純ロジック（JSX無し）。
//
// ⭐なぜ別に持つか：重賞の勝ち馬は、そのレースを走った馬の`record.recentFinishes[0]`にしか残らず、年の最終週の
// 後に引退して名簿から抜けると名前も騎手も引けなくなる。週ごとに勝ち馬の名前・騎手の名前を行として写して
// おく（年が替わるまで）。⚠️`roster.yearGradedLog = { year, rows }`。年が替わったら（`advanceWeek`が）捨てる。

import { gradedRacesForYear } from "../data/gradedRacesByYear.js";
import { gradedTierOf } from "../data/gradedTier.js";
import { weekOfYear } from "../data/calendar.js";

/**
 * 1行ぶん：1つの重賞の結果。
 * @typedef {{ raceId: string, raceName: string, tier: "g1"|"g2"|"g3", week: number, courseId: string,
 *   surface: string, distance: number, winnerId: string, winnerName: string, jockeyName: string,
 *   byPlayer: boolean, playerRode: boolean, playerPosition: number|null, raceNumber: number|null }} GradedLogRow
 * `raceNumber`＝その日の何レース目か（第13弾§22。番組表の番号。渡されなければ`null`）。
 * `week`＝暦の週（1〜52）。`byPlayer`＝勝った馬にプレイヤーが乗っていた。`playerRode`＝このレースにプレイヤーが
 * 乗っていた（勝っても負けても）。`playerPosition`＝そのときの着順（落馬は`null`）。
 */

/**
 * 今週行われた重賞の結果を行にする。勝ち馬は、今週1着の馬の`recentFinishes[0]`（レース名が今週の重賞の名前と
 * 同じもの）から引く。NPCが走ったレースもプレイヤーが乗って勝ったレース（E1の修正後は名前が残る）も、
 * プレイヤーが乗って負けたレース（`applyLostPlayerRaceWinners`で勝ち馬に積み済み）も同じ引き方。
 * @param {{ year: number, week: number, horses: object[], rides: object[],
 *   riddenHorseIds: Set<string>, playerJockeyName: string,
 *   jockeyNameById: Map<string, string>, raceNumberById?: Map<string, number> }} args - `week`は絶対週。`horses`は今週の結果を積んだ全馬。
 *   `raceNumberById`＝その週の番組表の重賞idごとのレース番号（`domain/weeklyCard.js`の`raceNumber`）
 * @returns {GradedLogRow[]} 行われた重賞だけ（勝ち馬が見つかったもの）
 */
export function buildGradedLogRows({
  year,
  week,
  horses,
  rides,
  riddenHorseIds,
  playerJockeyName,
  jockeyNameById,
  raceNumberById = new Map(),
}) {
  const w = weekOfYear(week);
  const races = gradedRacesForYear(year).filter((r) => r.week === w);
  if (races.length === 0) return [];
  const byName = new Map(races.map((r) => [r.name, r]));
  const winnerByRaceName = new Map();
  for (const horse of horses) {
    const last = horse.record?.recentFinishes?.[0];
    if (!last || last.week !== week || last.position !== 1) continue;
    if (byName.has(last.raceName) && !winnerByRaceName.has(last.raceName)) winnerByRaceName.set(last.raceName, horse);
  }
  const rows = [];
  for (const race of races) {
    const winner = winnerByRaceName.get(race.name);
    if (!winner) continue; // 行われなかった
    const byPlayer = riddenHorseIds.has(winner.id);
    const ride = rides.find((r) => r.raceId === race.id);
    const jockeyId = winner.record.recentFinishes[0].jockeyId;
    rows.push({
      raceId: race.id,
      raceName: race.name,
      tier: gradedTierOf(race, year),
      week: w,
      courseId: race.courseId,
      surface: race.surface,
      distance: race.distance,
      raceNumber: raceNumberById.get(race.id) ?? null,
      winnerId: winner.id,
      winnerName: winner.name,
      jockeyName: byPlayer ? playerJockeyName : (jockeyNameById.get(jockeyId) ?? ""),
      byPlayer,
      playerRode: !!ride,
      playerPosition: ride && !ride.fell ? ride.position : null,
    });
  }
  return rows;
}

/** 年ごとの記録へ今週の行を足す（年が違えば捨てて作り直す）。純関数。 */
export function appendGradedLog(log, year, rows) {
  const base = log && log.year === year ? log.rows : [];
  if (rows.length === 0 && log && log.year === year) return log;
  return { year, rows: [...base, ...rows] };
}
