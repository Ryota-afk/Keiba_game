// 収得賞金（クラスを決める賞金）の積み方と、クラスの決まり方（2024年度JRA「競馬番組 一般事項」
// 「別に定める事項」の表。`design/jra-entry-rules.md`§1〜§3・`devlog/wave13.md`§7）。
// ⚠️獲得賞金（`record.earnings`・番付・人気・騎手の割り当てに使う）とは別の数値——
// こちらは`record.shutokuPrize`に持ち、クラスと重賞の出走資格・出走順だけが読む。
// 純データ＋純関数（JSX無し。`data/`の他ファイルだけに依存）。

import { buildCalendarSkeleton, weekOfYear } from "./calendar.js";
import { gradedRacesForYear } from "./gradedRacesByYear.js";
import { DERBY_PURSE_2026 } from "./raceProgram.js";

const MAN = 10_000;

/** 収得賞金は「1着だけ」積む。一般競走（新馬〜3勝クラス）・オープン特別の1着の額（2024年）。 */
export const SHUTOKU_BY_GENERAL_CLASS = Object.freeze({
  shinba: 400 * MAN,
  maiden: 400 * MAN,
  win1: 500 * MAN,
  win2: 600 * MAN,
  win3: 900 * MAN,
});
/** オープン特別（重賞でないオープン競走）の1着の額。年齢で違う（2歳600万・3歳1,000万・古馬1,200万）。 */
export const SHUTOKU_OPEN_STAKES = Object.freeze({ age2: 600 * MAN, age3: 1000 * MAN, older: 1200 * MAN });
/** 2歳のG1・G2以外の重賞：1着1,600万・2着600万（年代によらず2024年の額）。 */
export const SHUTOKU_2YO_MINOR_GRADED = Object.freeze({ first: 1600 * MAN, second: 600 * MAN });

// 重賞の額は「2024年のダービー1着賞金÷その年のダービー1着賞金」で2024年の水準へ直す。
// ⚠️内部の値（画面には出さない）。2着の本賞金は1着の0.4倍（今のゲームの配分比）。
const SECOND_PLACE_PRIZE_SHARE = 0.4;
const ROUND_UNIT = 100_000; // 10万円未満切り捨て

const derbyPrizeCache = new Map();
function derbyPrize(year) {
  if (!derbyPrizeCache.has(year)) {
    const derby = gradedRacesForYear(year).find((r) => r.name.includes("東京優駿"));
    derbyPrizeCache.set(year, derby?.prize1 ?? DERBY_PURSE_2026);
  }
  return derbyPrizeCache.get(year);
}

// 1984年より前は格付け（G1・G2…）が無いので、1984年のG1の名前で「G1に当たるか」を判定する。
const G1_NAME_KEYS = Object.freeze([
  "天皇賞", "有馬記念", "朝日杯3歳", "阪神3歳ステークス", "エリザベス女王杯", "ジャパンカップ",
  "菊花賞", "マイルチャンピオンシップ", "東京優駿", "優駿牝馬", "桜花賞", "皐月賞", "宝塚記念", "安田記念",
]);
function isG1Like(race, year) {
  if (year >= 1984) return race.grade === "g1";
  if (race.trialFor || race.name.includes("トライアル")) return false;
  return G1_NAME_KEYS.some((k) => race.name.includes(k));
}
function isG2Like(race, year) {
  return year >= 1984 && race.grade === "g2";
}

/**
 * 一般競走・オープン特別の1着が積む収得賞金（円）。1着以外は0。
 * @param {string} raceClassId - レースのクラス（shinba〜win3・open＝オープン特別）
 * @param {number} age - 馬齢
 * @param {number} position - 着順
 */
export function shutokuForGeneralRace(raceClassId, age, position) {
  if (position !== 1) return 0;
  const fixed = SHUTOKU_BY_GENERAL_CLASS[raceClassId];
  if (fixed != null) return fixed;
  if (age <= 2) return SHUTOKU_OPEN_STAKES.age2;
  if (age === 3) return SHUTOKU_OPEN_STAKES.age3;
  return SHUTOKU_OPEN_STAKES.older;
}

/**
 * 重賞の1着・2着が積む収得賞金（円）。3着以下は0。
 * @param {{ name: string, grade?: string|null, prize1?: number|null, trialFor?: string|null }} race
 * @param {number} year - レースの暦年
 * @param {number} position - 着順
 * @param {number} age - 馬齢
 */
export function shutokuForGradedRace(race, year, position, age) {
  if (position > 2) return 0;
  const major = isG1Like(race, year) || isG2Like(race, year);
  if (age <= 2 && !major) {
    return position === 1 ? SHUTOKU_2YO_MINOR_GRADED.first : SHUTOKU_2YO_MINOR_GRADED.second;
  }
  const share = position === 1 ? 1 : SECOND_PLACE_PRIZE_SHARE;
  const scaled = (race.prize1 ?? 0) * share * (DERBY_PURSE_2026 / derbyPrize(year));
  return Math.floor(scaled / 2 / ROUND_UNIT) * ROUND_UNIT;
}

/** 実データの重賞をidで引く（プレイヤーが乗った重賞の収得賞金に使う）。無ければnull。 */
export function gradedRaceById(year, raceId) {
  return gradedRacesForYear(year).find((r) => r.id === raceId) ?? null;
}

// ---- クラスの決まり方 ----
// 暦の週（1〜52）で表す。6月1日＝6月の第1週、9月7日＝9月の第2週（`buildCalendarSkeleton`の週割り）。
const calendarWeekOf = (month, weekOfMonth) =>
  buildCalendarSkeleton().find((w) => w.month === month && w.weekOfMonth === weekOfMonth).weekNo;
/** 2歳の夏の期間の終わりの翌週（9月7日〜）。第36週。 */
export const TWO_YEAR_OLD_AUTUMN_WEEK = calendarWeekOf(9, 2);
/** 3歳の夏（6月1日〜）。第22週。 */
export const THREE_YEAR_OLD_SUMMER_WEEK = calendarWeekOf(6, 1);
/**
 * 降級（4歳馬の収得賞金を半分にする）を行う最後の年。⭐出典：Wikipedia日本語版「日本の競馬の競走体系」
 * ——2006〜2019年春は4歳馬が夏季開催（6月1日）を迎えた時点で収得賞金が半額になり、
 * 2019年の夏季開催から廃止。年代ごとの細かい数字は承認済みの出典に無いので、2018年までは
 * どの年代にも同じ形を当てはめる（`devlog/wave14.md`§12）。
 */
export const DEMOTION_LAST_YEAR = 2018;
/** 降級の対象の馬齢（満4歳）。時期は`THREE_YEAR_OLD_SUMMER_WEEK`（6月1日の週）以降。 */
export const DEMOTION_AGE = 4;
/** 降級で残す割合（半分）。 */
export const DEMOTION_KEEP_RATIO = 0.5;

/** 3歳の9月7日（第36週）。未勝利のまま迎えた馬は中央を去る。 */
export const MAIDEN_LEAVE_WEEK = TWO_YEAR_OLD_AUTUMN_WEEK;

/** 収得賞金の境（超えると上のクラス）。 */
export const SHUTOKU_CLASS_LIMIT = Object.freeze({ win1: 500 * MAN, win2: 1000 * MAN, win3: 1600 * MAN });

/**
 * 収得賞金・馬齢・時期からクラスを決める（2024年の「該当する競走条件」の表）。
 * @param {{ shutoku: number, age: number, absWeek: number, starts: number }} p
 * @returns {"shinba"|"maiden"|"win1"|"win2"|"win3"|"open"}
 */
export function classByShutoku({ shutoku, age, absWeek, starts }) {
  const w = weekOfYear(absWeek);
  if (!(shutoku > 0)) return starts === 0 ? "shinba" : "maiden";
  if (age <= 2) {
    if (w < TWO_YEAR_OLD_AUTUMN_WEEK) return "open"; // 2歳の夏は1勝でオープン
    return shutoku <= SHUTOKU_CLASS_LIMIT.win1 ? "win1" : "open";
  }
  if (age === 3 && w < THREE_YEAR_OLD_SUMMER_WEEK) {
    return shutoku <= SHUTOKU_CLASS_LIMIT.win1 ? "win1" : "open"; // 3歳の5月31日まで
  }
  if (shutoku <= SHUTOKU_CLASS_LIMIT.win1) return "win1";
  if (shutoku <= SHUTOKU_CLASS_LIMIT.win2) return "win2";
  if (shutoku <= SHUTOKU_CLASS_LIMIT.win3) return "win3";
  return "open";
}

/**
 * 収得賞金の欄を持たない馬（古いセーブ）の開始値。現在のクラスから決める：
 * 新馬・未勝利＝0／1勝＝400万（新馬・未勝利1勝ぶん）／2勝＝900万（＋1勝クラス500万）／
 * 3勝＝1,500万（＋2勝クラス600万）／オープン以上＝2,400万（＋3勝クラス900万）。
 * いずれも「そのクラスに上がる最短の勝ち方」の合計で、1勝ごとに1クラス上がる昇級に合わせた値。
 */
export const SHUTOKU_STARTING_BY_CLASS = Object.freeze({
  shinba: 0,
  maiden: 0,
  win1: 400 * MAN,
  win2: 900 * MAN,
  win3: 1500 * MAN,
  open: 2400 * MAN,
  listed: 2400 * MAN,
  g3: 2400 * MAN,
  g2: 2400 * MAN,
  g1: 2400 * MAN,
});
