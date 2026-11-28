// キャリアの終わりの画面に渡すデータを組む（`devlog/wave13b.md`§35）。純関数（JSX無し）。
// 画面は計算せず、ここで組んだ値を並べるだけ。

import { CAREER_END_AGE, DEBUT_AGE, lastCareerYear } from "../data/career.js";
import { RANK_LABELS } from "../data/ranks.js";

const TIER_ORDER = { g1: 0, g2: 1, g3: 2 };
const TOP_MOUNTS = 5;

/**
 * @param {{ player: object, roster?: { horses?: object[] } }} args
 *   `roster.horses`＝名前を引くのに使う（引退して名簿に居ない馬は`mainMounts[].horseName`・勝ち鞍の一覧の名前で補う）
 * @returns {{
 *   identity: { name: string, debutAge: number, endAge: number, startYear: number|null, endYear: number|null },
 *   totals: { starts: number, wins: number, winRate: number, gradedWins: number, g1Wins: number,
 *     bigRaceWins: number, income: number, prize: number },
 *   byYear: { year: number, age: number|null, starts: number, wins: number, gradedWins: number,
 *     g1Wins: number, income: number }[],
 *   bestYear: { year: number, age: number|null, wins: number, starts: number }|null,
 *   gradedWinList: { year: number, week: number|null, raceName: string, tier: "g1"|"g2"|"g3", horseId: string|null,
 *     horseName: string|null, courseId: string|null, distance: number|null, surface: string|null }[],
 *   mainMounts: { horseId: string, name: string|null, rides: number, isMain: boolean, hasWon: boolean,
 *     gradedWins: number }[],
 *   rank: { id: string|null, label: string },
 *   money: number }}
 *   `winRate`＝0〜1（出走0なら0）。`byYear`＝開始年から最後の年まで毎年（乗らなかった年も0で並ぶ）。
 *   `bestYear`＝最も勝った年（同数は早い年。1勝もなければnull）。`gradedWinList`＝G1→G2→G3、同じ格は年・週の順。
 *   `mainMounts`＝乗った回数の多い上位5頭（同数は主戦→重賞の勝ち数→id）。
 */
export function buildCareerSummary({ player, roster }) {
  const record = player.record ?? {};
  const byYearRaw = record.byYear ?? {};
  const years = Object.keys(byYearRaw).map(Number);
  const startYear = player.startYear ?? (years.length ? Math.min(...years) : null);
  const endYear = startYear != null ? lastCareerYear(startYear) : years.length ? Math.max(...years) : null;

  const byYear = [];
  if (startYear != null) {
    for (let year = startYear; year <= endYear; year += 1) {
      const b = byYearRaw[year] ?? {};
      byYear.push({
        year,
        age: DEBUT_AGE + (year - startYear),
        starts: b.starts ?? 0,
        wins: b.wins ?? 0,
        gradedWins: b.gradedWins ?? 0,
        g1Wins: b.g1Wins ?? 0,
        income: b.income ?? 0,
      });
    }
  }

  let bestYear = null;
  for (const y of byYear) {
    if (y.wins > 0 && (bestYear == null || y.wins > bestYear.wins)) {
      bestYear = { year: y.year, age: y.age, wins: y.wins, starts: y.starts };
    }
  }

  const list = [...(record.gradedWinList ?? [])].sort(
    (a, b) =>
      (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.year - b.year || (a.week ?? 0) - (b.week ?? 0)
  );
  const g1Wins = list.filter((w) => w.tier === "g1").length;

  let income = 0;
  let prize = 0;
  for (const b of Object.values(byYearRaw)) {
    income += b.income ?? 0;
    prize += b.prize ?? 0;
  }
  const starts = record.starts ?? 0;
  const wins = record.wins ?? 0;

  const nameById = new Map();
  for (const w of list) if (w.horseId && w.horseName) nameById.set(w.horseId, w.horseName);
  for (const h of roster?.horses ?? []) nameById.set(h.id, h.name);
  const gradedByHorse = new Map();
  for (const w of list) gradedByHorse.set(w.horseId, (gradedByHorse.get(w.horseId) ?? 0) + 1);
  const mainMounts = Object.entries(player.mainMounts ?? {})
    .map(([horseId, m]) => ({
      horseId,
      name: nameById.get(horseId) ?? m.horseName ?? null,
      rides: m.rides ?? 0,
      isMain: !!m.isMain,
      hasWon: !!m.hasWon,
      gradedWins: gradedByHorse.get(horseId) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.rides - a.rides ||
        Number(b.isMain) - Number(a.isMain) ||
        b.gradedWins - a.gradedWins ||
        (a.horseId < b.horseId ? -1 : 1)
    )
    .slice(0, TOP_MOUNTS);

  const rankId = player.jockey?.rank ?? null;
  return {
    identity: {
      name: player.jockey?.name ?? "",
      debutAge: DEBUT_AGE,
      endAge: CAREER_END_AGE,
      startYear,
      endYear,
    },
    totals: {
      starts,
      wins,
      winRate: starts > 0 ? wins / starts : 0,
      gradedWins: record.gradedWins ?? 0,
      g1Wins,
      bigRaceWins: record.bigRaceWins ?? 0,
      income,
      prize,
    },
    byYear,
    bestYear,
    gradedWinList: list,
    mainMounts,
    rank: { id: rankId, label: RANK_LABELS[rankId] ?? "" },
    money: player.money ?? 0,
  };
}

