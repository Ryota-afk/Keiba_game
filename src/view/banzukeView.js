// 番付（競馬界全体の今年の顔ぶれ）を組む純関数（`arch/banzuke.md`・`devlog/wave12.md`§15・§18・§19）。
// JSX無し・`data/`だけに依存（Node単体で試せる）。画面（`screens/`）はこの戻り値をそのまま描く。
//
// ⚠️馬の年齢は`domain/retirement.js`の`horseAge`と同じ`year - bornYear`をここで直接書く
// （`view/`は`domain/`をimportしない層の約束。`domain/weekLoop.js`・`bootstrap.js`が
// 年の終わりにこれを呼んで`roster.lastYearBanzuke`へ保存する）。

import {
  BANZUKE_BOARDS,
  BANZUKE_ROWS,
  BANZUKE_MILE_MAX_AVG_DISTANCE,
  BANZUKE_THREE_YEAR_OLD_AGE,
} from "../data/banzukeBoards.js";

/** 馬の今年の成績から、入る番付のid（0〜2個）を決める。 */
function boardIdsFor(horse, stats, year) {
  if (horse.bornYear == null) return [];
  const age = year - horse.bornYear;
  if (age < BANZUKE_THREE_YEAR_OLD_AGE) return []; // 2歳以下は入れない
  // 今年多く走ったほうの馬場（同数なら芝）
  const isDirt = stats.dirt > stats.turf;
  if (age === BANZUKE_THREE_YEAR_OLD_AGE) {
    if (isDirt) return ["3yo-dirt"];
    return [horse.gender === "filly" ? "3yo-filly" : "3yo-colt"]; // 牡馬・騸馬は牡馬の番付
  }
  if (isDirt) return ["older-dirt"];
  const avgDistance = stats.distanceSum / stats.starts;
  const ids = [avgDistance <= BANZUKE_MILE_MAX_AVG_DISTANCE ? "older-mile" : "older-classic"];
  if (horse.gender === "filly") ids.push("older-filly");
  return ids;
}

/** 賞金の多い順、同額は馬idの順。 */
function byEarningsThenId(a, b) {
  if (b.earnings !== a.earnings) return b.earnings - a.earnings;
  return a.horseId < b.horseId ? -1 : a.horseId > b.horseId ? 1 : 0;
}

/** 勝ち数の多い順、同数は名前の順。 */
function byWinsThenName(a, b) {
  if (b.wins !== a.wins) return b.wins - a.wins;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/**
 * 番付を組む。
 * @param {{ roster: { horses: object[], npcJockeys?: object[] },
 *   player?: { jockey?: { name: string }, record?: object, mainMounts?: object }|null, year: number }} args
 *   `player`が無い（事前シミュレーション）と、「自分が乗った馬」「主戦」は全部false・`jockeys.self`はnull
 * @returns {{ year: number,
 *   boards: { id: string, label: string, rows: { rank: number, horseId: string, name: string,
 *     earnings: number, starts: number, wins: number, lastBigWinName: string|null,
 *     riddenByPlayer: boolean, isMainMount: boolean }[] }[],
 *   jockeys: { rows: { rank: number, name: string, wins: number, isPlayer: boolean }[],
 *     self: { rank: number, wins: number, of: number }|null } }}
 */
export function buildBanzuke({ roster, player, year }) {
  const ridden = new Set(player?.record?.byYear?.[year]?.horseIds ?? []);
  const mainMounts = player?.mainMounts ?? {};

  const candidates = new Map(BANZUKE_BOARDS.map((b) => [b.id, []]));
  for (const horse of roster.horses) {
    const stats = horse.record?.yearStats;
    // 今年1戦もしていない馬・今年の獲得賞金0の馬は入れない
    if (!stats || stats.year !== year || stats.starts <= 0 || stats.earnings <= 0) continue;
    for (const boardId of boardIdsFor(horse, stats, year)) {
      candidates.get(boardId).push({
        horseId: horse.id,
        name: horse.name,
        earnings: stats.earnings,
        starts: stats.starts,
        wins: stats.wins,
        lastBigWinName: stats.lastBigWinName ?? null,
        riddenByPlayer: ridden.has(horse.id),
        isMainMount: mainMounts[horse.id]?.isMain === true,
      });
    }
  }
  const boards = BANZUKE_BOARDS.map(({ id, label }) => ({
    id,
    label,
    rows: candidates
      .get(id)
      .sort(byEarningsThenId)
      .slice(0, BANZUKE_ROWS)
      .map((row, i) => ({ rank: i + 1, ...row })),
  }));

  // 騎手：NPC騎手とプレイヤーを今年の勝ち数の多い順に並べる
  const entries = (roster.npcJockeys ?? []).map((j) => ({
    name: j.name,
    wins: j.winsByYear?.[year] ?? 0,
    isPlayer: false,
  }));
  if (player?.jockey) {
    entries.push({ name: player.jockey.name, wins: player.record?.byYear?.[year]?.wins ?? 0, isPlayer: true });
  }
  entries.sort(byWinsThenName);
  const ranked = entries.map((e, i) => ({ rank: i + 1, ...e }));
  const selfRow = ranked.find((e) => e.isPlayer);
  return {
    year,
    boards,
    jockeys: {
      rows: ranked.slice(0, BANZUKE_ROWS),
      self: selfRow ? { rank: selfRow.rank, wins: selfRow.wins, of: ranked.length } : null,
    },
  };
}

/**
 * 前の年の番付（年の終わりに保存したもの）を返す。保存が無ければ（古いセーブ・まだ1年も終わって
 * いない）null。
 */
export function lastYearBanzuke(roster) {
  return roster?.lastYearBanzuke ?? null;
}
