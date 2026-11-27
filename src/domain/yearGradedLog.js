// その年に行われた重賞の結果の記録（年末のまとめの「G1の勝ち馬」の材料・`devlog/wave13.md`§10）と、
// プレイヤーが乗って負けた重賞の勝ち馬の記録（E2）。純ロジック（JSX無し）。
//
// ⭐なぜ別に持つか：重賞の勝ち馬は、そのレースを走った馬の`record.recentFinishes[0]`にしか残らず、年の最終週の
// 後に引退して名簿から抜けると名前も騎手も引けなくなる。週ごとに勝ち馬の名前・騎手の名前を行として写して
// おく（年が替わるまで）。⚠️`roster.yearGradedLog = { year, rows }`。年が替わったら（`advanceWeek`が）捨てる。

import { gradedRacesForYear } from "../data/gradedRacesByYear.js";
import { gradedTierOf } from "../data/gradedTier.js";
import { weekOfYear } from "../data/calendar.js";
import { shutokuForGradedRace } from "../data/shutokuPrize.js";
import { appendRaceResultWithEarnings } from "./horse.js";
import { withReclassedClass } from "./horseClass.js";

/**
 * 1行ぶん：1つの重賞の結果。
 * @typedef {{ raceId: string, raceName: string, tier: "g1"|"g2"|"g3", week: number, courseId: string,
 *   surface: string, distance: number, winnerId: string, winnerName: string, jockeyName: string,
 *   byPlayer: boolean, playerRode: boolean, playerPosition: number|null }} GradedLogRow
 * `week`＝暦の週（1〜52）。`byPlayer`＝勝った馬にプレイヤーが乗っていた。`playerRode`＝このレースにプレイヤーが
 * 乗っていた（勝っても負けても）。`playerPosition`＝そのときの着順（落馬は`null`）。
 */

/**
 * プレイヤーが乗って負けた重賞の勝ち馬（相手馬の1頭）の記録を、その馬へ積む（E2）。
 * 相手馬はその場で組まれ、結果はプレイヤーの馬にしか書かれなかったため、勝ち馬の勝ちがどこにも残らなかった。
 * ⚠️積むのは勝った馬だけ（2着以下は記録しない＝その馬の出走・着順は残らない）。純関数。
 * @param {object[]} horses - 今週のレースが終わった後の全馬
 * @param {object[]} rides - プレイヤーが今週乗った鞍（`weekResults.js`の`ride`。`winnerHorseId`・`raceId`を持つ）
 * @param {number} week - 絶対週
 * @param {number} year
 * @param {(horse: object) => string|undefined} jockeyIdOf
 * @returns {object[]} 勝ち馬を更新した全馬（該当が無ければ引数と同じ配列）
 */
export function applyLostPlayerRaceWinners(horses, rides, week, year, jockeyIdOf) {
  const lost = rides.filter((r) => !r.fell && r.raceName && r.winnerHorseId && !r.won);
  if (lost.length === 0) return horses;
  const updates = new Map();
  for (const ride of lost) {
    const race = gradedRacesForYear(year).find((r) => r.id === ride.raceId);
    const horse = horses.find((h) => h.id === ride.winnerHorseId);
    if (!race || !horse) continue;
    const age = horse.bornYear != null ? year - horse.bornYear : 4;
    const jockeyId = jockeyIdOf(horse);
    let updated = {
      ...horse,
      record: appendRaceResultWithEarnings(
        horse.record,
        {
          position: 1,
          fieldSize: ride.fieldSize,
          popularity: null,
          raceName: race.name,
          week,
          year,
          courseId: race.courseId,
          surface: race.surface,
          distance: race.distance,
          ...(jockeyId ? { jockeyId } : {}),
        },
        race.prize1 ?? 0,
        true,
        undefined,
        shutokuForGradedRace(race, year, 1, age),
        gradedTierOf(race, year)
      ),
      plan: horse.plan?.targetRaceId === race.id ? null : horse.plan,
    };
    updated = withReclassedClass(updated, week, year);
    updates.set(horse.id, updated);
  }
  if (updates.size === 0) return horses;
  return horses.map((h) => updates.get(h.id) ?? h);
}

/**
 * 今週行われた重賞の結果を行にする。勝ち馬は、今週1着の馬の`recentFinishes[0]`（レース名が今週の重賞の名前と
 * 同じもの）から引く。NPCが走ったレースもプレイヤーが乗って勝ったレース（E1の修正後は名前が残る）も、
 * プレイヤーが乗って負けたレース（`applyLostPlayerRaceWinners`で勝ち馬に積み済み）も同じ引き方。
 * @param {{ year: number, week: number, horses: object[], rides: object[],
 *   riddenHorseIds: Set<string>, playerJockeyName: string,
 *   jockeyNameById: Map<string, string> }} args - `week`は絶対週。`horses`は今週の結果を積んだ全馬
 * @returns {GradedLogRow[]} 行われた重賞だけ（勝ち馬が見つかったもの）
 */
export function buildGradedLogRows({ year, week, horses, rides, riddenHorseIds, playerJockeyName, jockeyNameById }) {
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
