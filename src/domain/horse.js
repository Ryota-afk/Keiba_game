// 馬の生成・成長・クラス昇降（ARCHITECTURE.md §3「能力（9軸）」「⭐適応能力」
// 「馬の一生」「出走馬の決定（H）」「クラスの昇降（J）」）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";
import { CLASS_LADDER, classIndex } from "../data/classes.js";
import { generateHorseName } from "../data/names.js";
import { pickGrade } from "../data/grades.js";

export { GRADE_SCALE } from "../data/grades.js";

export const GENDERS = Object.freeze(["colt", "filly", "gelding"]); // 牡・牝・セン

export const GROWTH_TYPES = Object.freeze([
  "early", // 早熟：2歳後半〜3歳前半にピーク
  "normal", // 標準
  "late", // 晩成：4歳後半以降にピーク
  "sustained", // 持続：ピークが長く続く
]);

// 血統の系統（適応能力の由来）。
export const BLOODLINE_FAMILIES = Object.freeze({
  JAPAN: "japan", // 日本型 → 瞬発
  EUROPE: "europe", // 欧州型 → 持久
  AMERICA: "america", // 米国型 → 消耗
});

const ADAPTABILITY_KEY_BY_FAMILY = Object.freeze({
  [BLOODLINE_FAMILIES.JAPAN]: "burst",
  [BLOODLINE_FAMILIES.EUROPE]: "endurance",
  [BLOODLINE_FAMILIES.AMERICA]: "attrition",
});

function createInitialAdaptability(bloodlineFamily) {
  const base = { burst: 0, endurance: 0, attrition: 0 };
  const dominant = ADAPTABILITY_KEY_BY_FAMILY[bloodlineFamily];
  if (dominant) base[dominant] = 1; // 血統の系統ぶんだけ初期値を持つ。残り2つは0からレースで育つ
  return base;
}

/**
 * 架空馬を1頭生成する。自己完結の純関数（saveSeedとkeyの組み合わせから決定的）。
 * @param {number|string} saveSeed
 * @param {string|number} key - 一意なキー（例: `${生成年}-${連番}`）
 * @param {{ ownerPrefix?: string, sireId?: string|null, damId?: string|null,
 *           bloodlineFamily?: string, bornYear?: number,
 *           stableId?: string|null, ownerId?: string|null, lastRaceWeek?: number|null }} [opts]
 */
export function generateHorse(saveSeed, key, opts = {}) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "horse", key);
  const gender = pick(rand01, GENDERS);
  const growthType = pick(rand01, GROWTH_TYPES);
  const bloodlineFamily = opts.bloodlineFamily ?? pick(rand01, Object.values(BLOODLINE_FAMILIES));
  const abilities = {
    // スピード・スタミナのみ数値（0〜100）。⚠️スタミナは後天的に伸びない軸（§3「能力の成長」）。
    speed: Math.floor(rand01() * 100),
    stamina: Math.floor(rand01() * 100),
    sharpness: pickGrade(rand01), // 瞬発力
    grit: pickGrade(rand01), // 勝負根性
    flexibility: pickGrade(rand01), // 柔軟性
    wisdom: pickGrade(rand01), // 賢さ
    health: pickGrade(rand01), // 健康
    power: pickGrade(rand01), // パワー
    mentalStrength: pickGrade(rand01), // 精神力
  };
  const name = opts.ownerPrefix
    ? generateHorseName(rand01, { ownerPrefix: opts.ownerPrefix })
    : generateHorseName(rand01);

  return {
    id: `horse-${key}`,
    name,
    gender,
    growthType,
    bloodlineFamily,
    sireId: opts.sireId ?? null,
    damId: opts.damId ?? null,
    bornYear: opts.bornYear ?? null,
    stableId: opts.stableId ?? null,
    ownerId: opts.ownerId ?? null,
    isHistorical: false,
    isRetired: false, // 引退したらtrue（年齢・成績・怪我。世代交代）
    classId: CLASS_LADDER[0], // 新馬からスタート
    abilities,
    adaptability: createInitialAdaptability(bloodlineFamily),
    // 前走の週。⚠️新規キャリア開始時は`opts.lastRaceWeek`で散らす（career.js参照）——
    // 全頭nullのままだと初週に全馬が一斉に出走候補になってしまう。
    lastRaceWeek: opts.lastRaceWeek ?? null,
  };
}

/** 馬を引退させる。純関数——引数を書き換えず新しいオブジェクトを返す。 */
export function retireHorse(horse) {
  return { ...horse, isRetired: true };
}

/**
 * 適応能力を育てる（§3「育つ経路：同じ傾向のレースに出る／判断カードで対応する作戦を選ぶ」）。
 * 純関数——引数のadaptabilityを書き換えず、新しいオブジェクトを返す。
 * @param {{burst:number,endurance:number,attrition:number}} adaptability
 * @param {"burst"|"endurance"|"attrition"} raceTrendKey - そのレースの傾向
 * @param {number} amount - 育つ量（実装の弾で確定する速さ。ARCHITECTURE.md §15）
 */
export function growAdaptability(adaptability, raceTrendKey, amount) {
  return { ...adaptability, [raceTrendKey]: adaptability[raceTrendKey] + amount };
}

// オープン以上（G3・G2・G1）は勝利数だけで上がらない
//（⚠️出走条件は未定・ARCHITECTURE.md §15「オープン以上の出走条件」）。
const WIN_PROMOTION_CAP = "open";

/** 勝利数で1段上がる。降級なし（J）。オープンで頭打ちにする。 */
export function classAfterWin(currentClassId) {
  const capIdx = classIndex(WIN_PROMOTION_CAP);
  const idx = classIndex(currentClassId);
  if (idx < 0 || idx >= capIdx) return currentClassId;
  return CLASS_LADDER[idx + 1];
}

/** 新馬戦を勝てずに終えると未勝利へ移る（勝てば`classAfterWin`で1勝クラスへ）。 */
export function classAfterDebutLoss(currentClassId) {
  return currentClassId === "shinba" ? "maiden" : currentClassId;
}

// 1頭あたり年6.3走＝約8週に1回（H・ARCHITECTURE.md §3「出走馬の決定」の実測値）。
export const RACE_INTERVAL_WEEKS = 8;

/** その馬が次走の候補として挙がる週かどうか（H・仮の簡易版。調教師の選定は別途domainに置く）。 */
export function isDueForNextRace(horse, currentWeek) {
  if (horse.lastRaceWeek == null) return true;
  return currentWeek - horse.lastRaceWeek >= RACE_INTERVAL_WEEKS;
}
