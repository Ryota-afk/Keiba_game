// 馬の見た目：毛色（遺伝）・白い模様・ベスト体重（`devlog/wave13.md`§25 ⑭ step1・`arch/horse.md`
// 「毛色・白い模様・ベスト体重」）。純ロジック（JSX無し。`data/`・`core/`だけに依存）。
// ⚠️毛色・模様は能力と無関係（`design/horse-appearance-facts.md`§1.4）。結果に効かせない。
// ⚠️調子・当日の体重はここに無い（step2）。ここは「一生変わらない値」と「ベスト体重」だけ。

import { streamRandom, RNG_STREAMS, weightedPickFromValue } from "../core/rng.js";
import {
  COAT_SHARE_2024,
  FACE_MARKING_SHARE,
  LEG_WHITE_COUNT_SHARE,
  LEG_WHITE_HEIGHT_SHARE,
  LEG_COUNT,
  BODY_KG_BASE,
  GELDING_KG_OFFSET,
  BODY_KG_MIN_AGE,
  BODY_KG_MAX_AGE,
  SEASONAL_KG_AMPLITUDE,
  SEASONAL_PEAK_TROUGH_WEEK,
  SURFACE_KG_OFFSET,
  FRAME_KG_SD,
  FRAME_KG_LIMIT_SD,
  WHITE_MUTATION_RATE,
} from "../data/coat.js";
import { surfaceAptitudeIndex } from "../data/surfaceAptitude.js";
import { WEEKS_PER_YEAR } from "../data/calendar.js";

// ---------------------------------------------------------------------------
// 親の居ない馬（初期ロースター・親が繁殖プールに居ない補充）の遺伝子の頻度
// ---------------------------------------------------------------------------
// 遺伝子座は4つ（`coatGenes`）：e＝E（栗毛以外にする遺伝子）の数0〜2／a＝A（青毛にしない遺伝子）の数0〜2／
// g＝芦毛遺伝子を持つか（0|1）／w＝白毛遺伝子を持つか（0|1。WWは致死なのでヘテロだけ）。
// 毛色の決まり：w=1→白毛／g=1→芦毛／e=0（ee）→栗毛系／a=0（aa）→青毛／それ以外→鹿毛系。
// 2024年の割合（`COAT_SHARE_2024`・%）が出るよう、座ごとに独立として逆算する：
//   白毛：P(w=1)=pw=0.07%
//   芦毛：白毛でない馬の中の割合 pg = 6.2%/(1−pw)  ⇒ 全体の芦毛＝(1−pw)·pg＝6.2%
//   残り（白毛でも芦毛でもない馬）の中の割合は、栗毛系20.0%・青毛0.7%・鹿毛系73.0%（合計93.7%）を
//   93.7%で割って正規化：ee＝0.2134・青毛＝0.00747・鹿毛系＝0.7791
//   栗毛系：P(ee)=(1−pE)² ＝0.2134 ⇒ Eの頻度 pE＝1−√0.2134＝0.538
//   青毛：P(aa)·(1−P(ee))＝0.00747 ⇒ P(aa)＝0.00950 ⇒ Aの頻度 pA＝1−√0.00950＝0.903
//   （aaでeeの馬は栗毛。栗毛系の中のaは見えないので、eとaは独立に引いてよい）
// 鹿毛系の中の鹿毛・黒鹿毛・青鹿毛、栗毛系の中の栗毛・栃栗毛は遺伝の違いが分かっていない
// （`horse-appearance-facts.md`§1.3）ので、生まれたときに2024年の比（46.1:19.9:7.0／19.9:0.1）で引き、
// 引いた毛色そのものを`coat`に保存する。
function computeFounderFrequencies() {
  const s = COAT_SHARE_2024;
  const pw = s.white / 100;
  const pg = s.gray / 100 / (1 - pw);
  const chestnutFamily = s.chestnut + s.liverChestnut;
  const bayFamily = s.bay + s.darkBay + s.brown;
  const base = chestnutFamily + s.black + bayFamily;
  const pEe = chestnutFamily / base;
  const pBlackGivenNotEe = s.black / base / (1 - pEe);
  return {
    pw,
    pg,
    pE: 1 - Math.sqrt(pEe),
    pA: 1 - Math.sqrt(pBlackGivenNotEe),
  };
}
export const FOUNDER_GENE_FREQUENCY = Object.freeze(computeFounderFrequencies());

const BAY_FAMILY_SHARE = Object.freeze({ bay: COAT_SHARE_2024.bay, darkBay: COAT_SHARE_2024.darkBay, brown: COAT_SHARE_2024.brown });
const CHESTNUT_FAMILY_SHARE = Object.freeze({ chestnut: COAT_SHARE_2024.chestnut, liverChestnut: COAT_SHARE_2024.liverChestnut });

/** 遺伝子型から毛色を決める。鹿毛系・栗毛系の中の細かい色だけ乱数で引く（rand01は2回目以降は使わない）。 */
export function coatFromGenes(genes, rand01) {
  if (genes.w) return "white";
  if (genes.g) return "gray";
  if (genes.e === 0) return weightedPickFromValue(CHESTNUT_FAMILY_SHARE, rand01());
  if (genes.a === 0) return "black";
  return weightedPickFromValue(BAY_FAMILY_SHARE, rand01());
}

/**
 * 毛色から、それが出る遺伝子型を作る（実在馬の毛色を決め打ちするとき用）。
 * 白毛→w=1／芦毛→g=1／栗毛系→e=0／青毛→e≥1・a=0／鹿毛系→e≥1・a≥1。残りの座は創始馬の頻度で引く。
 * ⚠️鹿毛・黒鹿毛・青鹿毛（栗毛・栃栗毛）の違いは遺伝子に無い（`coatFromGenes`が乱数で引く）ので、
 * `coatFromGenes(genes)`が返すのは同じ系の色。決め打ちした色そのものは`horse.coat`へ保存すること。
 * @param {string} coat
 * @param {() => number} rand01 - 能力などとは別の乱数列
 */
export function genesForCoat(coat, rand01) {
  const f = FOUNDER_GENE_FREQUENCY;
  const count = (p) => (rand01() < p ? 1 : 0) + (rand01() < p ? 1 : 0);
  const drawAtLeast1 = (p) => {
    const n = count(p);
    return n === 0 ? (rand01() < 0.5 ? 1 : 2) : n; // 0を除いて引き直す代わりに、頻度に依らず1か2
  };
  const g = { e: count(f.pE), a: count(f.pA), g: 0, w: 0 };
  if (coat === "white") g.w = 1;
  else if (coat === "gray") g.g = 1;
  else if (coat === "chestnut" || coat === "liverChestnut") g.e = 0;
  else if (coat === "black") { g.e = drawAtLeast1(f.pE); g.a = 0; }
  else if (coat === "bay" || coat === "darkBay" || coat === "brown") { g.e = drawAtLeast1(f.pE); g.a = drawAtLeast1(f.pA); }
  else throw new Error(`unknown coat: ${coat}`);
  return g;
}

/** 親の居ない馬の遺伝子を引く（上の頻度どおり）。 */
export function drawFounderGenes(rand01) {
  const f = FOUNDER_GENE_FREQUENCY;
  const count = (p) => (rand01() < p ? 1 : 0) + (rand01() < p ? 1 : 0);
  return {
    e: count(f.pE),
    a: count(f.pA),
    g: rand01() < f.pg ? 1 : 0,
    w: rand01() < f.pw ? 1 : 0,
  };
}

/**
 * 父母の遺伝子から子の遺伝子を引く（メンデルの法則）。親は座ごとに片方の対立遺伝子を1つ渡す。
 * e・a：親がE/Aを持つ数÷2の確率でE/Aを渡す。g：持つ親はヘテロとして1/2で渡し、1つでも受ければ芦毛。
 * w：同じくヘテロ1/2（親が無ければ突然変異`WHITE_MUTATION_RATE`）。⚠️両親とも白毛遺伝子を持つとき、WWは致死なので「生まれた子」はWw（w=1）に条件づける。
 * ⭐結果として：栗毛系同士（e=0とe=0）の子はe=0だけ／g=1の子は必ず親にg=1が居る／w=1の子は必ず親にw=1が居る。
 */
export function inheritGenes(rand01, sireGenes, damGenes) {
  const passAllele = (n) => (rand01() < n / 2 ? 1 : 0);
  const e = passAllele(sireGenes.e) + passAllele(damGenes.e);
  const a = passAllele(sireGenes.a) + passAllele(damGenes.a);
  const gray = (sireGenes.g && rand01() < 0.5) || (damGenes.g && rand01() < 0.5);
  let white;
  if (sireGenes.w && damGenes.w) white = true; // WWは致死→生まれた子はWw
  else if (sireGenes.w || damGenes.w) white = rand01() < 0.5;
  else white = rand01() < WHITE_MUTATION_RATE; // 突然変異（`data/coat.js`）
  return { e, a, g: gray ? 1 : 0, w: white ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// 白い模様（⚠️割合は根拠なし・仮。`data/coat.js`）。親とは無関係に引く
// ---------------------------------------------------------------------------
export function drawMarkings(rand01) {
  const face = weightedPickFromValue(FACE_MARKING_SHARE, rand01());
  const whiteLegCount = Number(weightedPickFromValue(LEG_WHITE_COUNT_SHARE, rand01()));
  const legs = new Array(LEG_COUNT).fill(0);
  // 白い脚を一様に選ぶ（重複なし）
  const order = [0, 1, 2, 3];
  for (let i = 0; i < whiteLegCount; i += 1) {
    const j = i + Math.floor(rand01() * (order.length - i));
    [order[i], order[j]] = [order[j], order[i]];
    legs[order[i]] = Number(weightedPickFromValue(LEG_WHITE_HEIGHT_SHARE, rand01()));
  }
  return { face, legs };
}

// ---------------------------------------------------------------------------
// ベスト体重の個体差（frameKg）
// ---------------------------------------------------------------------------
function normal01(rand01) {
  const u = Math.max(rand01(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand01());
}

export function drawFrameKg(rand01) {
  const z = Math.max(-FRAME_KG_LIMIT_SD, Math.min(FRAME_KG_LIMIT_SD, normal01(rand01)));
  return Math.round(z * FRAME_KG_SD * 10) / 10;
}

/**
 * 見た目の一式（coat・coatGenes・markings・frameKg）を引く。
 * @param {() => number} rand01 - ⚠️能力などとは別の乱数列（`looksRandomFor`）を渡すこと
 * @param {{ sireGenes?: object|null, damGenes?: object|null }} [parents] - 片方だけ分かるときは、
 *   分からない側を親の居ない馬として引く
 */
export function drawHorseLooks(rand01, parents = {}) {
  const { sireGenes, damGenes } = parents;
  let coatGenes;
  if (sireGenes || damGenes) {
    coatGenes = inheritGenes(rand01, sireGenes ?? drawFounderGenes(rand01), damGenes ?? drawFounderGenes(rand01));
  } else {
    coatGenes = drawFounderGenes(rand01);
  }
  const coat = coatFromGenes(coatGenes, rand01);
  return { coat, coatGenes, markings: drawMarkings(rand01), frameKg: drawFrameKg(rand01) };
}

/** 見た目用の乱数列。⚠️能力・適性・名前の列とは別（同じシードで既存の値が変わらないようにするため）。 */
export function looksRandomFor(saveSeed, horseId) {
  return streamRandom(saveSeed, RNG_STREAMS.GENERATION, "horse-looks", horseId);
}

/** 見た目の欄が揃っているか。 */
export function hasHorseLooks(horse) {
  return !!(horse.coat && horse.coatGenes && horse.markings && horse.frameKg != null);
}

/**
 * 古いセーブの馬（見た目の欄が無い）に、見た目を補う。純関数（揃っていればそのまま返す）。
 * 親の遺伝子は読まない（親が名簿に居ないことがあるため）＝親の居ない馬として引く。
 * 同じ`(saveSeed, horse.id)`なら常に同じ結果。
 */
export function ensureHorseLooks(horse, saveSeed) {
  if (hasHorseLooks(horse)) return horse;
  return { ...horse, ...drawHorseLooks(looksRandomFor(saveSeed, horse.id)) };
}

/** 名簿（現役の馬・繁殖プール）の全馬に`ensureHorseLooks`をかける。セーブを読み込んだ直後に1回呼ぶ。 */
export function ensureRosterLooks(roster, saveSeed) {
  const fix = (h) => ensureHorseLooks(h, saveSeed);
  return {
    ...roster,
    horses: roster.horses.map(fix),
    ...(roster.breedingPool
      ? {
          breedingPool: {
            ...roster.breedingPool,
            sires: roster.breedingPool.sires.map(fix),
            broodmares: roster.breedingPool.broodmares.map(fix),
          },
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// ベスト体重
// ---------------------------------------------------------------------------

/** 週1〜52の季節の増減（kg）。ピーク週とボトム週の間を半周期のコサインでつなぐ（平均はほぼ0）。 */
export function seasonalKg(gender, week) {
  const { peak, trough } = SEASONAL_PEAK_TROUGH_WEEK[gender] ?? SEASONAL_PEAK_TROUGH_WEEK.colt;
  const mod = (x) => ((x % WEEKS_PER_YEAR) + WEEKS_PER_YEAR) % WEEKS_PER_YEAR;
  const rise = mod(peak - trough); // ボトムからピークまでの週数
  const fall = WEEKS_PER_YEAR - rise;
  const sinceTrough = mod(week - trough);
  if (sinceTrough < rise) return -SEASONAL_KG_AMPLITUDE * Math.cos((Math.PI * sinceTrough) / rise);
  return SEASONAL_KG_AMPLITUDE * Math.cos((Math.PI * (sinceTrough - rise)) / fall);
}

/** 性×年齢の平均（kg）。年齢（小数）は各馬齢の年の真ん中で表の値になり、間は直線でつなぐ（年の境目で段差が出ない）。 */
export function baseKgByAge(gender, ageYears) {
  const table = BODY_KG_BASE[gender === "filly" ? "filly" : "colt"];
  const offset = gender === "gelding" ? GELDING_KG_OFFSET : 0;
  const t = Math.max(BODY_KG_MIN_AGE + 0.5, Math.min(BODY_KG_MAX_AGE + 0.5, ageYears));
  const lo = Math.min(BODY_KG_MAX_AGE - 1, Math.max(BODY_KG_MIN_AGE, Math.floor(t - 0.5)));
  const frac = t - (lo + 0.5);
  return table[lo] + (table[lo + 1] - table[lo]) * frac + offset;
}

/** 芝ダの傾きによる増減（kg）：ダート寄り+6・芝寄り−6・同じなら0。 */
export function surfaceKg(horse) {
  const apt = horse.surfaceAptitude;
  if (!apt) return 0;
  const diff = surfaceAptitudeIndex(apt.dirt) - surfaceAptitudeIndex(apt.turf);
  return Math.sign(diff) * SURFACE_KG_OFFSET;
}

export function roundTo2kg(kg) {
  return Math.round(kg / 2) * 2;
}

/**
 * ベスト体重（kg・丸める前）＝性×年齢の平均＋個体差（frameKg）＋季節＋芝ダの傾き。
 * @param {object} horse - `gender`・`bornYear`・`frameKg`・`surfaceAptitude`
 * @param {number} year - 暦年
 * @param {number} week - 暦の中の週（1〜52。`weekOfYear`）
 */
export function bestKg(horse, year, week) {
  const age = (year - (horse.bornYear ?? year - 4)) + (week - 0.5) / WEEKS_PER_YEAR;
  return baseKgByAge(horse.gender, age) + (horse.frameKg ?? 0) + seasonalKg(horse.gender, week) + surfaceKg(horse);
}

/** ベスト体重を2kg刻みにしたもの（画面・記録に出す形）。 */
export function bestKgRounded(horse, year, week) {
  return roundTo2kg(bestKg(horse, year, week));
}
