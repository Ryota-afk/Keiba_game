// 騎手の生成・適性の成長・スキル習得（ARCHITECTURE.md §4「騎手」・§8「騎手ランク」）。
// NPC騎手（I）とプレイヤー騎手の両方がこの生成関数を使う——プレイヤー専用の分岐は作らない
// （§6「NPC騎手」：⚠️プレイヤーと同じ規則で鞍を得る）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { pickGrade, nextGrade } from "../data/grades.js";
import { APTITUDE_KEYS } from "../data/aptitudeCategories.js";
import { pickHumanName } from "./humanNaming.js";
import { RANK_LADDER, rankIndex, rankSpec } from "../data/ranks.js";

// 新人ランクの度胸・体力の下限（`devlog/wave02.md` V4「両方とも乱数・下限だけ設ける」）。
// ⭐**NPC騎手にも同じ下限を適用する**（§6「NPC騎手にプレイヤー専用の分岐を作らない」）。
export const ROOKIE_MIN_STAT = 40;

/**
 * 騎手を1人生成する。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {string|number} key
 * @param {{ rank?: string, stableId?: string|null, usedNames?: Set<string>,
 *           familyName?: string, givenName?: string, aptitudes?: object }} [opts] -
 *   `usedNames`を渡すと騎手名の重複を避ける（2026-09-04・`domain/career.js`が渡す）。
 *   `familyName`/`givenName`を渡すと、その名前で生成する（プレイヤーが式典前に入力した名前。
 *   `domain/graduation.js`の`createGraduatedJockey`が渡す）。`aptitudes`を渡すと
 *   ランダム抽選をせずそのまま使う（卒業式の成績表＋夢の記録から作った10個）。
 */
export function generateJockey(saveSeed, key, opts = {}) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "jockey", key);
  const aptitudes =
    opts.aptitudes ?? Object.fromEntries(APTITUDE_KEYS.map((k) => [k, pickGrade(rand01)]));
  const rank = opts.rank ?? RANK_LADDER[0];
  const isRookie = rankIndex(rank) === 0;
  const courage = Math.floor(rand01() * 100); // 度胸：判断カードの効き幅
  const physicalStamina = Math.floor(rand01() * 100); // 体力：落馬しにくさ・疲労の溜まりにくさ
  const name =
    opts.familyName && opts.givenName
      ? `${opts.familyName}${opts.givenName}`
      : pickHumanName(saveSeed, "jockey", key, opts.usedNames).fullName;
  return {
    id: `jockey-${key}`,
    name,
    rank,
    aptitudes, // 戦法4・距離4・馬場2＝10（G〜S）
    courage: isRookie ? Math.max(ROOKIE_MIN_STAT, courage) : courage,
    physicalStamina: isRookie ? Math.max(ROOKIE_MIN_STAT, physicalStamina) : physicalStamina,
    skills: [], // 習得済みスキルのID一覧
    stableId: opts.stableId ?? null, // 所属厩舎（§6「所属厩舎の決まり方」）
    isActive: true, // 引退したらfalse（世代交代）
  };
}

/** 騎手を引退させる。純関数。世代交代で新規デビューの騎手と入れ替える想定。 */
export function retireJockey(jockey) {
  return { ...jockey, isActive: false };
}

/**
 * スキルを1つ習得する。純関数——枠（ランクのskillSlots）を超えたら習得せず元の騎手を返す。
 * ⚠️前作の実測バグ（枠の数が効果の発動と無関係だった）の再発防止：
 * 「習得できる数」自体をここで機械的に絞る。効果の適用側（sim）も枠を経由した
 * `skills`配列だけを見ること。
 */
export function learnSkill(jockey, skillId) {
  if (jockey.skills.includes(skillId)) return jockey;
  const spec = rankSpec(jockey.rank);
  const cap = spec ? spec.skillSlots : 0;
  if (jockey.skills.length >= cap) return jockey;
  return { ...jockey, skills: [...jockey.skills, skillId] };
}

/**
 * 適性を1段伸ばす（§4「適性の成長」：乗った分だけ伸びるが総量に上限。上限はランクで上がる）。
 * 純関数——Sへ上げようとしてランクの上限（aptitudeSCap）に達していれば据え置く。
 */
export function growAptitude(jockey, aptitudeKey, cap = rankSpec(jockey.rank)?.aptitudeSCap ?? 0) {
  const current = jockey.aptitudes[aptitudeKey];
  const next = nextGrade(current);
  if (next === current) return jockey; // 既に上限（S）
  if (next === "S") {
    const sCount = Object.values(jockey.aptitudes).filter((g) => g === "S").length;
    if (sCount >= cap) return jockey; // ⚠️Sにできる数の上限に達している
  }
  return { ...jockey, aptitudes: { ...jockey.aptitudes, [aptitudeKey]: next } };
}
