// 自分の能力の画面（`screens/JockeyProfile.jsx`）と、週の結果の「能力」の段
// （`screens/WeekResultScreen.jsx`）の表示データを組む純関数。
// 見本：`design/mocks/jockey-profile-v1.html`「案C 梯子」（2026-09-27にユーザーが選んだ）。
// DOM無し・JSX無し（Node単体で検証できる）。`domain/`はimportしない
// （CLAUDE.md §5「data→core/sim→domain/state/view→…」）。
//
// ⚠️ここは読むだけ——段が上がる・下がる計算そのものは`domain/aptitudeGrowth.js`が持つ。
// 「次に上がると下がります」の印は、あちらの`pickDowngradeCandidate`と同じ並べ方
// （同じ種類の中で最後に乗った週が一番古いもの・一度も乗っていなければ最古・同じなら
// `APTITUDE_KEYS`の順）で選ぶ。⚠️あちらは「上がるもの自身」を除いて選ぶが、どれが上がるかは
// 乗るまで決まらないので、画面では種類ごとに一番古いものへ印を付ける（見本どおり）。

import { GRADE_SCALE, MAX_GRADE, gradeToNumber } from "../data/grades.js";
import { APTITUDE_KEYS, STRATEGIES, DISTANCE_BANDS, SURFACES } from "../data/aptitudeCategories.js";
import { requiredXpForStep } from "../data/aptitudeGrowth.js";
import { RANK_LABELS, RANK_SPECS } from "../data/ranks.js";
import { STRATEGY_LABELS, DISTANCE_BAND_LABELS, SURFACE_LABELS } from "../data/aptitudeLabels.js";

/** 梯子の段数（G〜S+の16段）。 */
export const LADDER_STEPS = GRADE_SCALE.length;

/** 3つのまとまり（走り方・距離・馬場）。画面の並び順そのもの。 */
export const APTITUDE_GROUPS = Object.freeze([
  { category: "strategy", label: "走り方", keys: STRATEGIES.map((s) => `strategy:${s}`) },
  { category: "distance", label: "距離", keys: DISTANCE_BANDS.map((d) => `distance:${d}`) },
  { category: "surface", label: "馬場", keys: SURFACES.map((s) => `surface:${s}`) },
]);

/** 適性キー（`strategy:nige`）の画面表記（「逃げ」「1400〜1800m」「芝」）。 */
export function aptitudeLabel(key) {
  const [category, id] = key.split(":");
  if (category === "strategy") return STRATEGY_LABELS[id] ?? id;
  if (category === "distance") return DISTANCE_BAND_LABELS[id] ?? id;
  if (category === "surface") return SURFACE_LABELS[id] ?? id;
  return key;
}

/** 「4.2%」の形。0戦なら「—」。 */
export function winRateLabel(starts, wins) {
  if (!starts) return "—";
  return `${((wins / starts) * 100).toFixed(1)}%`;
}

/**
 * 次の段まであと何鞍か（勝ちの3倍・主戦の2倍は数えない。1鞍＝1として切り上げ）。
 * S+なら`null`（画面は「これ以上上がりません」）。
 */
export function ridesToNextStep(grade, xp) {
  if (grade === MAX_GRADE) return null;
  const need = requiredXpForStep(gradeToNumber(grade));
  return Math.max(1, Math.ceil(need - (xp ?? 0)));
}

/** 次の段の埋まり具合（0〜1）。S+なら0。 */
export function nextStepProgress(grade, xp) {
  if (grade === MAX_GRADE) return 0;
  const need = requiredXpForStep(gradeToNumber(grade));
  return Math.max(0, Math.min(1, (xp ?? 0) / need));
}

/** 適性10個の段の合計（G=0〜S+=15の和）。 */
export function aptitudeTotal(aptitudes) {
  return APTITUDE_KEYS.reduce((sum, k) => sum + gradeToNumber(aptitudes?.[k]), 0);
}

/**
 * 合計が上限に届いているとき、種類ごとに「次に上がると下がる」適性を1つ選ぶ。
 * Gは下がらないので除く。届いていなければ空。
 * @returns {Map<string, string>} category -> key
 */
export function pickDropMarks(jockey, isFull) {
  const marks = new Map();
  if (!isFull) return marks;
  const lastWeekOf = (k) => jockey.aptitudeLastWeek?.[k] ?? -Infinity;
  for (const group of APTITUDE_GROUPS) {
    const candidates = group.keys.filter((k) => jockey.aptitudes[k] !== GRADE_SCALE[0]);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => {
      const diff = lastWeekOf(a) - lastWeekOf(b);
      if (diff !== 0) return diff;
      return APTITUDE_KEYS.indexOf(a) - APTITUDE_KEYS.indexOf(b);
    });
    marks.set(group.category, candidates[0]);
  }
  return marks;
}

/**
 * 画面の表示データを組む。
 * @param {{ player: object, stables: object[] }} args - `player`はセーブのプレイヤー
 *   （古いセーブで`record`・`aptitudeXp`が無くても落ちない）。`stables`は`roster.stables`。
 */
export function buildJockeyProfile({ player, stables }) {
  const jockey = player.jockey;
  const rank = jockey.rank;
  const stable = (stables ?? []).find((s) => s.id === jockey.stableId) ?? null;
  const record = player.record ?? {};
  const byYear = record.byYear?.[player.currentYear] ?? { starts: 0, wins: 0 };
  const total = aptitudeTotal(jockey.aptitudes);
  const cap = RANK_SPECS[rank]?.aptitudeTotalCap ?? Infinity;
  const isFull = total >= cap;
  const rankLabel = RANK_LABELS[rank] ?? rank;
  const dropMarks = pickDropMarks(jockey, isFull);

  const groups = APTITUDE_GROUPS.map((group) => {
    const top = Math.max(...group.keys.map((k) => gradeToNumber(jockey.aptitudes[k])));
    const rows = group.keys.map((key) => {
      const grade = jockey.aptitudes[key];
      const step = gradeToNumber(grade);
      const xp = jockey.aptitudeXp?.[key] ?? 0;
      const rec = record.byAptitude?.[key] ?? { starts: 0, wins: 0 };
      const ridesLeft = ridesToNextStep(grade, xp);
      return {
        key,
        label: aptitudeLabel(key),
        grade,
        step,
        isTop: step === top,
        willDrop: dropMarks.get(group.category) === key,
        progress: nextStepProgress(grade, xp),
        ridesLeft,
        nextLabel: ridesLeft == null ? "これ以上上がりません" : `あと${ridesLeft}鞍`,
        recordLabel: `${rec.starts ?? 0}戦${rec.wins ?? 0}勝`,
      };
    });
    return { category: group.category, label: group.label, rows };
  });

  return {
    name: jockey.name,
    rankLabel,
    stableLabel: stable ? `${stable.trainerFamilyName ?? stable.trainerName}厩舎` : "",
    career: {
      starts: record.starts ?? 0,
      wins: record.wins ?? 0,
      winRate: winRateLabel(record.starts ?? 0, record.wins ?? 0),
      gradedWins: record.gradedWins ?? 0,
      yearStarts: byYear.starts ?? 0,
      yearWins: byYear.wins ?? 0,
    },
    total,
    cap,
    isFull,
    capNote: isFull
      ? `${rankLabel}のあいだは、これ以上増えません`
      : `${rankLabel}のあいだに、あと ${cap - total} 増やせます`,
    groups,
  };
}

/**
 * 週の結果の「能力」の段。同じ週に同じ適性が何度も動いたら1行にまとめる
 * （最初の`from`→最後の`to`。結局同じなら出さない）。上がった行を先に、下がった行を後に。
 * @param {{ aptitudeChanges: {key:string, from:string, to:string}[],
 *   rankChange: {from:string, to:string}|null }} growth
 * @returns {{ rankLine: string|null, lines: {key:string, label:string, from:string, to:string,
 *   up:boolean, reason:string|null}[] }}
 */
export function buildGrowthLines(growth) {
  const changes = growth?.aptitudeChanges ?? [];
  const merged = new Map();
  for (const c of changes) {
    const cur = merged.get(c.key);
    if (cur) cur.to = c.to;
    else merged.set(c.key, { key: c.key, from: c.from, to: c.to });
  }
  const lines = [];
  for (const m of merged.values()) {
    const up = gradeToNumber(m.to) > gradeToNumber(m.from);
    const down = gradeToNumber(m.to) < gradeToNumber(m.from);
    if (!up && !down) continue;
    lines.push({
      key: m.key,
      label: aptitudeLabel(m.key),
      from: m.from,
      to: m.to,
      up,
      reason: down ? "これ以上は増やせないため" : null,
    });
  }
  lines.sort((a, b) => (a.up === b.up ? 0 : a.up ? -1 : 1));
  const rankChange = growth?.rankChange ?? null;
  const rankLine = rankChange ? `${RANK_LABELS[rankChange.to] ?? rankChange.to}に上がりました` : null;
  return { rankLine, lines };
}
