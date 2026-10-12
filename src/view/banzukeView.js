// 番付（競馬界全体の今年の顔ぶれ）を組む純関数（`arch/banzuke.md`・`devlog/wave12.md`§15・§18・§19）。
// JSX無し・`data/`だけに依存（Node単体で試せる）。画面（`screens/`）はこの戻り値をそのまま描く。
//
// ⚠️馬の年齢は`domain/retirement.js`の`horseAge`と同じ`year - bornYear`をここで直接書く
// （`view/`は`domain/`をimportしない層の約束。`domain/weekLoop.js`・`bootstrap.js`が
// 年の終わりにこれを呼んで`roster.lastYearBanzuke`へ保存する）。

import {
  BANZUKE_BOARDS,
  BANZUKE_JOCKEY_LABEL,
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

// ───────── 画面（`screens/Banzuke.jsx`）のための表示用の小さな純関数 ─────────
// 見本：`design/mocks/banzuke-v1.html`「案C 顔ぶれ」。JSXに計算を書かないためにここへ置く。

/** 騎手の板のid（馬の番付7つは`BANZUKE_BOARDS`のid）。 */
export const BANZUKE_JOCKEY_BOARD_ID = "jockeys";

/** 最初に開いたとき選んでおく板（見本の1枚目と同じ古馬王道）。 */
export const BANZUKE_DEFAULT_BOARD_ID = "older-classic";

/** 賞金を万円に切り捨てて「8,350万円」の形にする。 */
export function formatManYen(earnings) {
  const man = Math.floor((earnings ?? 0) / 10000);
  return `${String(man).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}万円`;
}

/** 行の戦績「4戦2勝」。 */
export function banzukeRecordLabel(row) {
  return `${row.starts}戦${row.wins}勝`;
}

/** 馬名の右に添える印。主戦なら「主戦」だけ、乗った馬なら「乗った馬」、どちらでもなければnull。 */
export function banzukeMarkLabel(row) {
  if (row.isMainMount) return "主戦";
  if (row.riddenByPlayer) return "乗った馬";
  return null;
}

/** 番付がまだ空か（馬の番付が全部0頭で、騎手も誰も勝っていない＝今年まだ1レースも無い）。 */
export function isBanzukeEmpty(banzuke) {
  if (!banzuke) return true;
  const noHorses = banzuke.boards.every((b) => b.rows.length === 0);
  const noWins = banzuke.jockeys.rows.every((r) => r.wins === 0);
  return noHorses && noWins;
}

/**
 * 板8枚の中身（1位だけ）。`top`が無い板は名前だけ出して中は「—」。
 * @returns {{ id: string, label: string, top: { name: string, value: string }|null }[]}
 */
export function banzukeBoardTops(banzuke) {
  const horses = banzuke.boards.map((b) => ({
    id: b.id,
    label: b.label,
    top: b.rows[0] ? { name: b.rows[0].name, value: formatManYen(b.rows[0].earnings) } : null,
  }));
  const j = banzuke.jockeys.rows[0];
  horses.push({
    id: BANZUKE_JOCKEY_BOARD_ID,
    label: BANZUKE_JOCKEY_LABEL,
    top: j && j.wins > 0 ? { name: j.name, value: `${j.wins}勝` } : null,
  });
  return horses;
}

/**
 * 押した板の一覧（見本の`.c-list`）。馬の番付は10頭（足りなければある分だけ）、騎手は10人＋
 * 10位より下でも自分の行（`self`）。`playerName`は自分の行の名前（保存した番付は名前を持たない）。
 * @returns {{ label: string, orderLabel: string,
 *   rows: { key: string, rank: number, name: string, record: string|null, value: string,
 *     mark: string|null, bigWin: string|null, isPlayer: boolean }[],
 *   self: { rank: number, name: string, value: string }|null }|null}
 */
export function banzukeListFor(banzuke, boardId, playerName) {
  if (boardId === BANZUKE_JOCKEY_BOARD_ID) {
    const { rows, self } = banzuke.jockeys;
    return {
      label: BANZUKE_JOCKEY_LABEL,
      orderLabel: "勝ち数の多い順",
      rows: rows.map((r) => ({
        key: `${r.rank}-${r.name}`,
        rank: r.rank,
        name: r.name,
        record: null,
        value: `${r.wins}勝`,
        mark: null,
        bigWin: null,
        isPlayer: r.isPlayer === true,
      })),
      self:
        self && self.rank > BANZUKE_ROWS
          ? { rank: self.rank, name: playerName ?? "", value: `${self.wins}勝` }
          : null,
    };
  }
  const board = banzuke.boards.find((b) => b.id === boardId);
  if (!board) return null;
  return {
    label: board.label,
    orderLabel: "賞金の多い順",
    rows: board.rows.map((r) => ({
      key: r.horseId,
      rank: r.rank,
      name: r.name,
      record: banzukeRecordLabel(r),
      value: formatManYen(r.earnings),
      mark: banzukeMarkLabel(r),
      bigWin: r.lastBigWinName ?? null,
      isPlayer: false,
    })),
    self: null,
  };
}
