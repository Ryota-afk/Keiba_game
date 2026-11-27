// 年末のまとめと引退した馬の画面に渡すデータを組む（`devlog/wave13.md`§9・§10・
// `design/mocks/year-end-v1-spec.md`）。`domain/weekLoop.js`の`advanceWeek`が、年の最終週（`week % 52 === 0`）に
// 1回だけ呼ぶ。JSX無し。`weekResultSummary.js`と同じく、画面は計算せずここで組んだ値を並べるだけ。
//
// ⚠️**呼ぶ位置**：年の区切りの処理（`processYearBoundary`）で馬が名簿から抜ける**前**の顔ぶれ
// （`advancedHorses`）を渡す。引退した馬の名前・戦績もそこから引く。

import { buildCalendarSkeleton } from "../data/calendar.js";
import { g1LabelForYear } from "../data/gradedTier.js";
import { selectHorseAwards, selectJockeyAwards } from "../view/yearEndAwards.js";
import { isMainMount } from "./mainMount.js";

const CALENDAR = buildCalendarSkeleton();

/** 暦の週（1〜52）→「9月2週」。 */
function monthWeekLabel(weekOfYear) {
  const e = CALENDAR[weekOfYear - 1];
  return `${e.month}月${e.weekOfMonth}週`;
}

function yearBucket(player, year) {
  const b = player.record?.byYear?.[year];
  if (!b) return null;
  return {
    starts: b.starts ?? 0,
    wins: b.wins ?? 0,
    gradedWins: b.gradedWins ?? 0,
    g1Wins: b.g1Wins ?? 0,
    income: b.income ?? 0,
    prize: b.prize ?? 0,
  };
}

/**
 * 終わった年のまとめ（画面①）。
 * @param {{ year: number, horses: object[], npcJockeys: object[], player: object,
 *   gradedLog: { year: number, rows: object[] }|null }} args
 *   `player`＝その年の最後の週の結果まで積んだプレイヤー（`currentYear`は繰り上げる前）
 * @returns {{ year: number, title: string, g1Label: string, representative: object, awards: object[],
 *   jockeyAwards: object[], player: object, g1Races: object[] }}
 *   `representative`・`awards`＝`view/yearEndAwards.js`の`selectHorseAwards`。`jockeyAwards`＝同`selectJockeyAwards`。
 *   `player`＝`{ starts, wins, gradedWins, g1Wins, income, prize, last: 前の年の同じ値|null }`（1年目の`last`はnull）。
 *   `g1Races`＝行われたG1（1983年までは大レース）の勝ち馬を行われた順に（行われなかった年・レースは載らない）
 */
export function buildYearEndSummary({ year, horses, npcJockeys, player, gradedLog }) {
  const ridden = new Set(player.record?.byYear?.[year]?.horseIds ?? []);
  const markOf = (horseId) => (isMainMount(player.mainMounts ?? {}, horseId) ? "main" : ridden.has(horseId) ? "rode" : null);
  const horseAwards = selectHorseAwards({ year, horses, markOf });

  const mine = yearBucket(player, year) ?? { starts: 0, wins: 0, gradedWins: 0, g1Wins: 0, income: 0, prize: 0 };
  const jockeyAwards = selectJockeyAwards({
    year,
    npcJockeys,
    player: { name: player.jockey.name, wins: mine.wins, starts: mine.starts, prize: mine.prize },
  });

  const rows = gradedLog?.year === year ? gradedLog.rows : [];
  const g1Races = rows
    .filter((r) => r.tier === "g1")
    .sort((a, b) => a.week - b.week)
    .map((r) => ({
      raceName: r.raceName,
      weekLabel: monthWeekLabel(r.week),
      winnerName: r.winnerName,
      jockeyName: r.jockeyName,
      byPlayer: r.byPlayer,
      playerRode: r.playerRode,
      playerPosition: r.playerPosition,
    }));

  return {
    year,
    ...horseAwards,
    jockeyAwards,
    player: { ...mine, last: yearBucket(player, year - 1) },
    g1Races,
    g1RacesLabel: g1LabelForYear(year),
  };
}

/**
 * 引退した馬（画面②）。年の区切りで引退を処理した馬のうち、(a)引退した時点でプレイヤーの主戦だった馬、
 * (b)生涯で1度でもG1を勝った馬（1983年までは1984年にG1だったレース）。それに加えて、その年に未勝利のまま
 * 地方へ移ったプレイヤーの主戦の馬（`leftForLocal`）。載せる馬が居なければ空配列（画面を出さない・ユーザー決定Q7）。
 * @param {{ year: number, horses: object[], retiredHorseIds: string[], leftForLocal: {horseId: string}[],
 *   breedingPool: { sires: object[], broodmares: object[] }|undefined, mainMounts: object }} args
 *   `horses`＝年の区切りの前の全馬。`breedingPool`＝区切りの後のもの（新しく繁殖に上がった馬の行き先を引く）
 * @returns {{ horseId: string, name: string, gender: string, age: number, starts: number, wins: number,
 *   g1Wins: { raceName: string, year: number|null }[], playerRides: number, isMain: boolean,
 *   destination: "sire"|"broodmare"|"local"|null }[]}
 *   並びは主戦の馬（乗った回数の多い順）→G1の勝ち数の多い順→生涯の獲得賞金の多い順
 */
export function buildRetiredHorses({ year, horses, retiredHorseIds, leftForLocal, breedingPool, mainMounts }) {
  const byId = new Map(horses.map((h) => [h.id, h]));
  const sireIds = new Set((breedingPool?.sires ?? []).map((h) => h.id));
  const damIds = new Set((breedingPool?.broodmares ?? []).map((h) => h.id));
  const localIds = new Set(leftForLocal.map((x) => x.horseId));

  const ids = new Set(retiredHorseIds);
  for (const id of localIds) ids.add(id);

  const cards = [];
  for (const id of ids) {
    const horse = byId.get(id);
    if (!horse) continue;
    const isMain = isMainMount(mainMounts, id);
    const g1Wins = horse.record?.g1Wins ?? [];
    const toLocal = localIds.has(id);
    // 地方へ移った馬は、その時点で主戦だった馬だけ（`leftForLocal`が主戦に絞って渡す）。それ以外は(a)(b)
    if (!toLocal && !isMain && g1Wins.length === 0) continue;
    cards.push({
      horseId: id,
      name: horse.name,
      gender: horse.gender,
      age: horse.bornYear != null ? year - horse.bornYear : null,
      starts: horse.record?.starts ?? 0,
      wins: horse.record?.wins ?? 0,
      g1Wins,
      playerRides: mainMounts[id]?.rides ?? 0,
      isMain: isMain || toLocal,
      destination: toLocal ? "local" : sireIds.has(id) ? "sire" : damIds.has(id) ? "broodmare" : null,
      earnings: horse.record?.earnings ?? 0,
    });
  }
  cards.sort(
    (a, b) =>
      Number(b.isMain) - Number(a.isMain) ||
      (a.isMain && b.isMain ? b.playerRides - a.playerRides : 0) ||
      b.g1Wins.length - a.g1Wins.length ||
      b.earnings - a.earnings ||
      (a.horseId < b.horseId ? -1 : 1)
  );
  return cards;
}
