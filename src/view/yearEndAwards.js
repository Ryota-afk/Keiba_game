// 年末のまとめ（年度代表馬・各部門の受賞馬・騎手の部門）を選ぶ純関数
// （`devlog/wave13.md`§9・§10・`design/mocks/year-end-v1-spec.md`§3）。JSX無し・`domain/`を読まない
// （`data/`だけに依存）。引数は`domain/yearEnd.js`が渡す。
//
// ⭐馬の選び方（ユーザー決定Q3）：その部門で数えるレースのうち**重賞を今年1つ以上勝っている**馬が候補。
// 上から順に比べ、差がついたところで決める：①今年のG1の勝ち数（1983年までは1984年にG1だったレース）→
// ②重賞の着順の点数（`GRADED_POINTS`）→③今年の獲得賞金（`yearStats.earnings`）→④馬idの順（同時受賞は出さない）。
// 候補が1頭もいない部門は「該当馬なし」（`none: true`）。
// ⚠️②の点の値に根拠は無い（G2の1着＝G1の2着、くらいの釣り合いで置いた暫定）。
// ⚠️短距離・ダートの部門も③は今年の獲得賞金の全体（芝ダ別の内訳は馬に持っていない）。

import { g1LabelForYear } from "../data/gradedTier.js";

/** 重賞の着順の点数（G1の1着は①の勝ち数で数えるのでここには無い）。⚠️暫定。 */
export const GRADED_POINTS = Object.freeze({
  g1: Object.freeze({ 2: 6, 3: 4 }),
  g2: Object.freeze({ 1: 6, 2: 3, 3: 2 }),
  g3: Object.freeze({ 1: 4, 2: 2, 3: 1 }),
});

/** 最高勝率騎手の条件の騎乗数（ユーザー決定Q5）。 */
export const MIN_STARTS_FOR_WIN_RATE = 50;

/** 賞の名前。1986年まで「優駿賞」・1987年から「JRA賞」。 */
export function awardTitleForYear(year) {
  return year <= 1986 ? "優駿賞" : "JRA賞";
}

const TIER_RANK = Object.freeze({ g1: 3, g2: 2, g3: 1 });

/**
 * 部門の一覧（その年にある部門だけ）。年度代表馬は別に選ぶ（`selectHorseAwards`）。
 * @returns {{ id: string, label: string, ageGroup?: 2|3|4, sex?: "male"|"female", filter?: "sprint"|"dirt" }[]}
 */
export function awardCategoriesForYear(year) {
  const list = [
    { id: "age2m", label: "最優秀2歳牡馬", ageGroup: 2, sex: "male" },
    { id: "age2f", label: "最優秀2歳牝馬", ageGroup: 2, sex: "female" },
    { id: "age3m", label: "最優秀3歳牡馬", ageGroup: 3, sex: "male" },
    { id: "age3f", label: "最優秀3歳牝馬", ageGroup: 3, sex: "female" },
    { id: "age4m", label: "最優秀4歳以上牡馬", ageGroup: 4, sex: "male" },
    { id: "age4f", label: "最優秀4歳以上牝馬", ageGroup: 4, sex: "female" },
  ];
  if (year >= 1981) list.push({ id: "sprint", label: "最優秀短距離馬", filter: "sprint" });
  if (year >= 1984) list.push({ id: "dirt", label: "最優秀ダートホース", filter: "dirt" });
  return list;
}

function ageGroupOf(age) {
  return age <= 2 ? 2 : age === 3 ? 3 : 4;
}
const sexOf = (horse) => (horse.gender === "filly" ? "female" : "male");

/** この部門で数える重賞の記録かどうか。 */
function countsFor(category, entry, age) {
  if (category.filter === "sprint") return age >= 3 && entry.surface === "turf" && (entry.distance ?? 9999) <= 1600;
  if (category.filter === "dirt") return age >= 3 && entry.surface === "dirt";
  return true;
}

function tallyOf(entries) {
  let g1Wins = 0;
  let points = 0;
  let anyWin = false;
  for (const e of entries) {
    if (e.position === 1) anyWin = true;
    if (e.tier === "g1" && e.position === 1) g1Wins += 1;
    else points += GRADED_POINTS[e.tier]?.[e.position] ?? 0;
  }
  return { g1Wins, points, anyWin };
}

function compareCandidates(a, b) {
  return (
    b.tally.g1Wins - a.tally.g1Wins ||
    b.tally.points - a.tally.points ||
    b.earnings - a.earnings ||
    (a.horse.id < b.horse.id ? -1 : a.horse.id > b.horse.id ? 1 : 0)
  );
}

function pickBest(candidates) {
  let best = null;
  for (const c of candidates) if (best === null || compareCandidates(c, best) < 0) best = c;
  return best;
}

/** 受賞馬の1行（画面へ渡す形）。 */
function awardRow(id, label, cand, year, ctx) {
  const { horse, entries, tally } = cand;
  const wins = entries.filter((e) => e.position === 1);
  const g1Names = wins.filter((e) => e.tier === "g1").map((e) => e.raceName);
  let highlight; // 今年勝ったG1。無ければ一番格の高い重賞1つ
  if (g1Names.length > 0) highlight = { tier: "g1", raceNames: g1Names };
  else {
    const top = [...wins].sort((x, y) => TIER_RANK[y.tier] - TIER_RANK[x.tier])[0];
    highlight = { tier: top.tier, raceNames: [top.raceName] };
  }
  const ys = horse.record.yearStats;
  return {
    id,
    label,
    none: false,
    horseId: horse.id,
    name: horse.name,
    gender: horse.gender,
    age: year - horse.bornYear,
    starts: ys.starts,
    wins: ys.wins,
    earnings: ys.earnings,
    g1Wins: tally.g1Wins,
    highlight,
    mark: ctx.markOf(horse.id),
  };
}

/**
 * 馬の部門の受賞馬と年度代表馬。
 * @param {{ year: number, horses: object[], markOf: (horseId: string) => "main"|"rode"|null }} args
 *   `horses`＝年の区切りで抜ける前の全馬。`markOf`＝自分の主戦なら"main"・今年乗った馬なら"rode"
 * @returns {{ title: string, g1Label: string, representative: object, awards: object[] }}
 *   `representative`＝年度代表馬。`awards`＝部門ごとの受賞馬（部門が無い年は載らない・受賞馬が居なければ`none: true`）
 */
export function selectHorseAwards({ year, horses, markOf }) {
  const ctx = { markOf };
  // 今年の重賞の記録を持つ馬だけ（`yearStats.year`が今年のもの）
  const pool = [];
  for (const horse of horses) {
    const ys = horse.record?.yearStats;
    if (!ys || ys.year !== year || !ys.graded?.length || horse.bornYear == null) continue;
    pool.push({ horse, age: year - horse.bornYear, graded: ys.graded, earnings: ys.earnings });
  }

  const awards = [];
  const winners = [];
  for (const category of awardCategoriesForYear(year)) {
    const candidates = [];
    for (const p of pool) {
      if (category.ageGroup != null && ageGroupOf(p.age) !== category.ageGroup) continue;
      if (category.sex != null && sexOf(p.horse) !== category.sex) continue;
      if ((category.filter === "sprint" || category.filter === "dirt") && p.age < 3) continue;
      const entries = p.graded.filter((e) => countsFor(category, e, p.age));
      const tally = tallyOf(entries);
      if (!tally.anyWin) continue; // 重賞を1つも勝っていない馬は候補にならない
      candidates.push({ horse: p.horse, entries, tally, earnings: p.earnings });
    }
    const best = pickBest(candidates);
    if (!best) awards.push({ id: category.id, label: category.label, none: true });
    else {
      awards.push(awardRow(category.id, category.label, best, year, ctx));
      winners.push(best.horse.id);
    }
  }

  // 年度代表馬：受賞馬の中で、年間の全重賞で数え直した1位
  const winnerSet = new Set(winners);
  const repCandidates = pool
    .filter((p) => winnerSet.has(p.horse.id))
    .map((p) => ({ horse: p.horse, entries: p.graded, tally: tallyOf(p.graded), earnings: p.earnings }));
  const repBest = pickBest(repCandidates);
  const representative = repBest
    ? awardRow("representative", "年度代表馬", repBest, year, ctx)
    : { id: "representative", label: "年度代表馬", none: true };

  return { title: awardTitleForYear(year), g1Label: g1LabelForYear(year), representative, awards };
}

// ---- 騎手の部門 ----

/** 並びの1人分から順位（自分より厳密に良い人数＋1）を引く。同点は同順位。 */
function rankOf(sorted, target, better) {
  let strictlyBetter = 0;
  for (const e of sorted) if (e !== target && better(e, target)) strictlyBetter += 1;
  return strictlyBetter + 1;
}

/**
 * 騎手の部門（最多勝利・最高勝率・最多獲得賞金）と、自分の順位。
 * @param {{ year: number, npcJockeys: object[],
 *   player: { name: string, wins: number, starts: number, prize: number } }} args
 *   NPC騎手は`winsByYear`・`startsByYear`・`prizeByYear`の`year`の値を読む（無ければ0）
 * @returns {{ id: string, label: string, winner: object, player: { rank: number|null, value: number, eligible: boolean },
 *   top: object[], ofCount: number }[]} `winner`＝`{ name, isPlayer, value, wins, starts }`
 *   （自分が1位なら自分の行そのもの）。`top`＝上位3人。最高勝率で自分が条件の騎乗数に届かなければ
 *   `player.eligible: false`・`rank: null`（「対象外」）。`value`は勝率なら0〜1の小数・賞金なら円
 */
export function selectJockeyAwards({ year, npcJockeys, player }) {
  const me = { id: "player", name: player.name, isPlayer: true, wins: player.wins, starts: player.starts, prize: player.prize };
  const all = [
    ...npcJockeys.map((j) => ({
      id: j.id,
      name: j.name,
      isPlayer: false,
      wins: j.winsByYear?.[year] ?? 0,
      starts: j.startsByYear?.[year] ?? 0,
      prize: j.prizeByYear?.[year] ?? 0,
    })),
    me,
  ];
  const idOrder = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const specs = [
    {
      id: "mostWins",
      label: "最多勝利騎手",
      pool: all,
      value: (e) => e.wins,
      // 同数なら騎乗数の少ない方（＝勝率の高い方）
      better: (a, b) => a.wins > b.wins || (a.wins === b.wins && a.starts < b.starts),
    },
    {
      id: "bestWinRate",
      label: "最高勝率騎手",
      pool: all.filter((e) => e.starts >= MIN_STARTS_FOR_WIN_RATE),
      value: (e) => (e.starts > 0 ? e.wins / e.starts : 0),
      better: (a, b) => {
        const ra = a.wins / a.starts;
        const rb = b.wins / b.starts;
        return ra > rb || (ra === rb && a.wins > b.wins);
      },
    },
    {
      id: "mostPrize",
      label: "最多獲得賞金騎手",
      pool: all,
      value: (e) => e.prize,
      better: (a, b) => a.prize > b.prize,
    },
  ];

  return specs.map((spec) => {
    const sorted = [...spec.pool].sort((a, b) => (spec.better(a, b) ? -1 : spec.better(b, a) ? 1 : idOrder(a, b)));
    const inPool = sorted.includes(me);
    const rank = inPool ? rankOf(sorted, me, spec.better) : null;
    // 自分が同率1位なら受賞は自分の行（NPCの同率に譲らない）
    const winnerEntry = rank === 1 ? me : sorted[0];
    const row = (e) => ({ name: e.name, isPlayer: e.isPlayer, value: spec.value(e), wins: e.wins, starts: e.starts });
    return {
      id: spec.id,
      label: spec.label,
      winner: winnerEntry ? row(winnerEntry) : null,
      player: { rank, value: spec.value(me), eligible: inPool },
      top: sorted.slice(0, 3).map(row),
      ofCount: sorted.length,
    };
  });
}
