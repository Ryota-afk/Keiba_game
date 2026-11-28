// 騎手人生のまとめの画面（`screens/CareerEndScreen.jsx`）に出す行と文字列を組む。純関数（JSX無し）。
// 入力は`buildCareerSummary`（`view/careerSummaryView.js`）の戻り値。画面は計算せず、ここの値を並べるだけ。
// 見本：`design/mocks/career-end-v1.html`の案A／要素と取得元：`design/mocks/career-end-v1-spec.md`§2・§3。

import { formatOkuManYen } from "./yearEndView.js";
import { shortRaceName } from "./raceNameView.js";

const G1_ERA_START = 1984; // グレード制の最初の年。これより前の最上位の勝ちは「大レース」と呼ぶ（年末のまとめと同じ2語）
const TIERS = ["g1", "g2", "g3"];
const AXIS_EVERY = 10; // 横軸に年を書く間隔（1年目・11年目・21年目）と、最後の年

const num = (n) => (n ?? 0).toLocaleString("ja-JP");

/** 縦の目盛りの刻み。30年ぶんの勝ち数は10刻みで足りる。多い年があるときだけ粗くする。 */
function tickStep(top) {
  if (top <= 60) return 10;
  if (top <= 120) return 20;
  return 50;
}

/**
 * @param {ReturnType<import("./careerSummaryView.js").buildCareerSummary>} s
 * @returns {{
 *   name: string, rankLabel: string, span: string|null, g1Label: string,
 *   chart: { max: number, ticks: number[],
 *     bars: { year: number, tone: "g1"|"graded"|"plain", wins: number, label: string }[],
 *     axis: { index: number, year: number, edge: "first"|"last"|null }[],
 *     legend: { tone: "g1"|"graded", label: string }[] },
 *   years: { head: string, isBest: boolean, off: boolean, wins: string, starts: string, graded: string|null }[],
 *   initialIndex: number,
 *   totals: { label: string, value: string, sub: string|null }[],
 *   tiers: { tier: "g1"|"g2"|"g3", heading: string, rows: { key: string, year: string, race: string, horse: string|null }[] }[],
 *   mounts: { key: string, name: string, isMain: boolean, rides: string, graded: string|null }[] }}
 *   `chart.bars[i]`と`years[i]`は同じ年。`span`＝「1994年〜2023年　18歳〜47歳」（開始年が分からなければnull）。
 */
export function careerEndView(s) {
  const hasOldBigRace = s.gradedWinList.some((w) => w.tier === "g1" && w.year < G1_ERA_START);
  const g1Label = hasOldBigRace ? "大レース・G1" : "G1";

  const top = Math.max(0, ...s.byYear.map((y) => y.wins));
  const step = tickStep(top);
  const max = Math.max(step, Math.ceil(top / step) * step);
  const ticks = [];
  for (let v = step; v <= max; v += step) ticks.push(v);

  const toneOf = (y) => (y.g1Wins > 0 ? "g1" : y.gradedWins > 0 ? "graded" : "plain");
  const bars = s.byYear.map((y) => ({
    year: y.year,
    tone: toneOf(y),
    wins: y.wins,
    label: y.starts > 0 ? `${y.year}年 ${y.wins}勝` : `${y.year}年 騎乗なし`,
  }));
  const last = s.byYear.length - 1;
  const axis = s.byYear
    .map((y, index) => ({ index, year: y.year, edge: index === 0 ? "first" : index === last ? "last" : null }))
    .filter((a) => a.edge || (a.index % AXIS_EVERY === 0 && last - a.index >= AXIS_EVERY / 2));
  const legend = [];
  if (bars.some((b) => b.tone === "g1")) legend.push({ tone: "g1", label: `${g1Label}を勝った年` });
  if (bars.some((b) => b.tone === "graded")) legend.push({ tone: "graded", label: "重賞を勝った年" });

  const years = s.byYear.map((y) => ({
    head: `${y.year}年・${y.age}歳`,
    isBest: s.bestYear?.year === y.year,
    off: y.starts === 0,
    wins: `${y.wins}勝`,
    starts: `${num(y.starts)}戦`,
    graded: y.gradedWins > 0 ? `重賞${y.gradedWins}勝${y.g1Wins > 0 ? `（${g1Label} ${y.g1Wins}勝）` : ""}` : null,
  }));
  const bestIndex = s.bestYear ? s.byYear.findIndex((y) => y.year === s.bestYear.year) : -1;

  const t = s.totals;
  const totals = [
    { label: "通算", value: `${num(t.starts)}戦 ${num(t.wins)}勝`, sub: null },
    { label: "勝率", value: `${(t.winRate * 100).toFixed(1)}%`, sub: null },
    { label: "重賞", value: `${num(t.gradedWins)}勝`, sub: t.g1Wins > 0 ? `${g1Label} ${t.g1Wins}勝` : null },
    { label: "稼いだお金", value: formatOkuManYen(t.income), sub: null },
  ];

  const tiers = TIERS.map((tier) => {
    const rows = s.gradedWinList
      .filter((w) => w.tier === tier)
      .map((w, i) => ({
        key: `${w.year}-${w.week ?? ""}-${i}`,
        year: `${w.year}年`,
        race: shortRaceName(w.raceName),
        horse: w.horseName ?? null,
      }));
    const head = tier === "g1" ? g1Label : tier.toUpperCase();
    return { tier, heading: `${head}　${rows.length}勝`, rows };
  }).filter((g) => g.rows.length > 0);

  const mounts = s.mainMounts.map((m) => ({
    key: m.horseId,
    name: m.name ?? "—",
    isMain: m.isMain,
    rides: `${num(m.rides)}回`,
    graded: m.gradedWins > 0 ? `重賞${m.gradedWins}勝` : null,
  }));

  const id = s.identity;
  return {
    name: id.name,
    rankLabel: s.rank.label,
    span:
      id.startYear == null ? null : `${id.startYear}年〜${id.endYear}年　${id.debutAge}歳〜${id.lastAge}歳`,
    g1Label,
    chart: { max, ticks, bars, axis, legend },
    years,
    initialIndex: Math.max(0, bestIndex),
    totals,
    tiers,
    mounts,
  };
}
