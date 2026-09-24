// 週の番組表（`arch/race-program.md`§10・通しプレイ①の指摘「レースのクラス分けと実際の
// レースが結びついていない」の解消）。
// ⭐**週のレースはここが1回だけ組む。** 依頼（`weeklyRequests.js`）・NPCのレース
// （`npcWeeklyRace.js`／`npcGradedRace.js`）・出馬表（`entryListPreview.js`）は、
// すべてこの一覧の中の1レース（`raceId`）を指す。同じ`(saveSeed, week)`からは必ず
// 同じ一覧が返る（`core/rng.js`の`RNG_STREAMS.CARD`）ので、月曜の依頼一覧と週末に
// 実際に行われるレースは食い違わない。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";
import { weekOfYear, WEEKS_PER_YEAR, yearForWeek } from "../data/calendar.js";
import { DAY, weekdayOfDateString } from "../data/weekDays.js";
import { coursesOpenInWeek } from "../data/jraMeetingSchedule.js";
import { drawShapeAtCourse } from "../data/courses.js";
import { gradedRacesForYear, hasGradedRaceData } from "../data/gradedRacesByYear.js";
import { classIndex } from "../data/classes.js";
import {
  racesPerDay,
  estimateOpenStakesCount,
  drawGeneralRaceShape,
  SURFACE_SHARE,
  DISTANCE_SHARE_TURF,
  DISTANCE_SHARE_DIRT,
  drawGeneralRaceClass,
  drawFieldSize,
  GRADED_MAX_FIELD_SIZE,
} from "../data/raceProgram.js";

// 重賞データが無い年の仮の重賞本数（`domain/npcWeeklyRace.js`と同じ、1974〜1987年の
// 実測本数84〜100の中央値）。年ごとの実データが揃ったら`gradedRacesForYear`に置き換わる。
export const FALLBACK_GRADED_COUNT = 90;

export const RACE_SOURCE = Object.freeze({
  GRADED: "graded", // 重賞（実データ）
  OPEN_STAKES: "openStakes", // オープン特別（推定本数を52週へ確率配分）
  GENERAL: "general", // 一般競走（新馬〜3勝クラス）
});

function gradedCountForYear(year) {
  return hasGradedRaceData(year) ? gradedRacesForYear(year).length : FALLBACK_GRADED_COUNT;
}

/** 週あたりの目標本数を確率的に丸める（例：0.4本／週なら40%の週だけ1本組む）。 */
function stochasticRound(value, rand01) {
  const floor = Math.floor(value);
  const frac = value - floor;
  return rand01() < frac ? floor + 1 : floor;
}


// ⭐その競馬場で実際に行われる馬場×距離から引く（`data/courses.js`の`drawShapeAtCourse`）。
// ⚠️**これが無いと、競馬場と距離を別々に抽選するので札幌で芝3600mのレースが組まれる**
// （実際には行われない距離。`devlog/wave08.md`§9）。
// ⚠️`profile`を持たない競馬場（今は地方・海外だけ）は、従来どおり全国の割合から引く。
const SHARES = {
  surfaceShare: SURFACE_SHARE,
  distanceShare: { turf: DISTANCE_SHARE_TURF, dirt: DISTANCE_SHARE_DIRT },
};
function drawShapeFor(rand01, courseId) {
  const shape = drawShapeAtCourse(rand01, courseId, SHARES);
  const fallback = drawGeneralRaceShape(rand01);
  return shape ? { ...shape, fillyOnly: fallback.fillyOnly } : fallback;
}

/**
 * ⭐その重賞が土曜・日曜どちらだったかを、史実の日付から決める（2026-09-17。`TODO.md` #86）。
 * `data/gradedRacesByYear.js`の各レースは`historicalDate`（例："1976-09-12"）を持つ
 * ——推測ではなく実データから曜日が計算できる。
 *
 * 実測（1972〜1989年の重賞1,400本・日付の欠けは0本。`devlog/wave09.md`§9）：
 * 日曜92.4%・土曜3.9%・平日（月〜金）合計3.7%。
 * ⚠️**平日3.7%の置き場所だけは実データが無い決定**——本作は土曜・日曜しか持たないため、
 * 多数派（日曜）へ寄せる。
 */
function dayOfGradedRace(historicalDate) {
  if (!historicalDate) return DAY.SUN; // 保険（実測では0件だが、欠けていた場合の既定値）
  const weekday = weekdayOfDateString(historicalDate);
  return weekday === DAY.SAT ? DAY.SAT : DAY.SUN;
}

/**
 * ⭐第11弾（`devlog/wave11.md`§7・CLAUDE.md §10「定員」）：レースの定員を、
 * 番組表を組む時点で1回だけ決める。`raceId`だけをキーにした専用ストリーム
 * （`RNG_STREAMS.FIELD_SIZE`）を使うので、同じ`raceId`なら何度呼んでも同じ値になる
 * ——`domain/rotation.js`（計画を立てる側）と`domain/npcWeeklyRace.js`（実際に走らせる側）が
 * 必ず同じ定員を見る。⚠️走る瞬間に引き直さないこと（以前はここが無く、`npcWeeklyRace.js`が
 * 走る瞬間に`drawFieldSize`を引き直していたため、計画を立てる側は「何頭入るか」を
 * 知りようが無かった）。
 * @param {number|string} saveSeed
 * @param {string} raceId
 * @returns {number}
 */
function fieldSizeForRace(saveSeed, raceId) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.FIELD_SIZE, raceId);
  return drawFieldSize(rand01);
}

// ⭐**第10弾（2026-09-17）で追加したメモ化**（`devlog/wave10.md`§3.2）。
// `buildYearIndex`が52週ぶんの番組表を毎週組み直すため、同じ`(saveSeed, week, year)`が
// 週をまたいで何度も呼ばれる（窓が1週ずつ動くだけで51週ぶんが重複する）。
// ⚠️**実測：メモ化を入れる前は事前シミュレーション104週が約26秒**——`buildWeeklyCard`が
// 純関数（同じ引数なら常に同じ結果）であることを利用してキャッシュを足した。
// 呼び出し側から見た挙動は変わらない（純関数のまま）。
const weeklyCardCache = new Map();

/**
 * その週1週間ぶんの番組表を組む。自己完結の純関数——同じ引数なら常に同じ一覧を返す。
 * @param {number|string} saveSeed
 * @param {number} week - 絶対週（`player.currentWeek`と同じ数え方）
 * @param {number} year - 番組表の実測値・実データを引くための暦年（`player.currentYear`）
 * @returns {{ raceId: string, classId: string, courseId: string, surface: string,
 *   distance: number, fillyOnly: boolean, source: string, day: string, name?: string,
 *   grade?: string|null, prize1?: number|null, fieldSize: number,
 *   condition?: string|null, trialFor?: string|null }[]} `fieldSize`は重賞
 *   （`RACE_SOURCE.GRADED`）も含め全レースが持つ（第11弾で重賞にも計画段階の定員を追加・
 *   `devlog/wave11.md`§12）——重賞は`GRADED_MAX_FIELD_SIZE`固定、一般競走・オープン特別は
 *   `fieldSizeForRace`が`raceId`ごとに1回だけ引く。`condition`・`trialFor`は重賞だけが持つ
 *   （実データの年齢・性別条件と、トライアル→本番の対応。`domain/horse.js`の
 *   `isAgeSexEligible`・`domain/npcGradedRace.js`の優先出走権が読む）。
 */
export function buildWeeklyCard(saveSeed, week, year) {
  const cacheKey = `${saveSeed}|${week}|${year}`;
  const cached = weeklyCardCache.get(cacheKey);
  if (cached) return cached;
  const races = buildWeeklyCardUncached(saveSeed, week, year);
  weeklyCardCache.set(cacheKey, races);
  return races;
}

function buildWeeklyCardUncached(saveSeed, week, year) {
  const thisWeek = weekOfYear(week);
  const openCourses = coursesOpenInWeek(thisWeek);
  if (openCourses.length === 0) return []; // 開催が無い週（原則無いはずだが念のため）

  const rand01 = streamRandom(saveSeed, RNG_STREAMS.CARD, week);
  const races = [];

  // ①重賞（実データ）：そのままカードへ。グレード表記の無い年（〜1983年）は
  // オープン以上の一括扱い（`classId: "open"`）にする——グレードそのものが
  // 1984年より前は史実にも付いていない（`tools/build-graded-races.mjs`）。
  const gradedToday = hasGradedRaceData(year) ? gradedRacesForYear(year).filter((r) => r.week === thisWeek) : [];
  for (const r of gradedToday) {
    races.push({
      raceId: r.id,
      classId: r.grade ?? "open",
      courseId: r.courseId,
      surface: r.surface,
      distance: r.distance,
      fillyOnly: r.fillyOnly,
      source: RACE_SOURCE.GRADED,
      day: dayOfGradedRace(r.historicalDate),
      name: r.name,
      grade: r.grade,
      prize1: r.prize1,
      // ⭐第11弾（`devlog/wave11.md`§12）：重賞にも計画段階の定員を持たせる。
      // `domain/npcGradedRace.js`の`MAX_FIELD_SIZE`と同じ値（`GRADED_MAX_FIELD_SIZE`＝18）を
      // 1箇所（`data/raceProgram.js`）から共有する——走らせる側と計画を立てる側が
      // 違う定員を見ると、計画段階で18頭に絞った意味が走る段階で失われる。
      fieldSize: GRADED_MAX_FIELD_SIZE,
      // ⭐年齢・性別条件（`domain/horse.js`の`isAgeSexEligible`が読む）とトライアル対応
      // （`domain/npcGradedRace.js`の優先出走権が読む）。一般競走・オープン特別は
      // どちらも持たない（実データが無い）。
      condition: r.condition ?? null,
      trialFor: r.trialFor ?? null,
    });
  }

  // ②オープン特別：年の推定本数（`estimateOpenStakesCount`）を52週へ確率配分する。
  // ⚠️実データが無い推定値（`arch/race-program.md`§3）——`classId`は`open`。
  const openStakesCountThisYear = estimateOpenStakesCount(gradedCountForYear(year));
  const openStakesToday = stochasticRound(openStakesCountThisYear / WEEKS_PER_YEAR, rand01);
  for (let i = 0; i < openStakesToday; i += 1) {
    const courseId = pick(rand01, openCourses);
    const { surface, distance, fillyOnly } = drawShapeFor(rand01, courseId);
    const raceId = `${year}-w${thisWeek}-open-${i}`;
    races.push({
      raceId,
      classId: "open",
      courseId,
      surface,
      distance,
      fillyOnly,
      source: RACE_SOURCE.OPEN_STAKES,
      day: pick(rand01, [DAY.SAT, DAY.SUN]),
      fieldSize: fieldSizeForRace(saveSeed, raceId),
    });
  }

  // ③一般競走（新馬〜3勝クラス）：その週に開いている競馬場×2日×1日のレース数から、
  // 重賞・オープン特別の本数を引いた残り（`arch/race-program.md`§10）。
  const totalSlotsThisWeek = openCourses.length * 2 * racesPerDay(year);
  const generalSlots = Math.max(0, totalSlotsThisWeek - gradedToday.length - openStakesToday);
  for (let i = 0; i < generalSlots; i += 1) {
    const classId = drawGeneralRaceClass(rand01);
    const courseId = pick(rand01, openCourses);
    const { surface, distance, fillyOnly } = drawShapeFor(rand01, courseId);
    const raceId = `${year}-w${thisWeek}-gen-${i}`;
    races.push({
      raceId,
      classId,
      courseId,
      surface,
      distance,
      fillyOnly,
      source: RACE_SOURCE.GENERAL,
      day: pick(rand01, [DAY.SAT, DAY.SUN]),
      fieldSize: fieldSizeForRace(saveSeed, raceId),
    });
  }

  return races;
}

/** オープン以上（重賞・オープン特別）をまとめて指す索引の鍵（第10弾・`domain/rotation.js`用）。 */
export const OPEN_AND_ABOVE_BUCKET = "open+";

/**
 * 馬のクラスidから、`buildYearIndex`が使う索引の鍵を出す。オープン以上
 * （`open`・`listed`・`g3`・`g2`・`g1`）は`OPEN_AND_ABOVE_BUCKET`にまとめる——
 * 馬の`classId`は`open`止まりだが（`domain/horse.js`の`WIN_PROMOTION_CAP`）、
 * `isEligibleForRaceClass`と同じ規則で「オープン以上ならどの格でも出走資格がある」。
 * @param {string} classId
 */
export function yearIndexBucketFor(classId) {
  const openIdx = classIndex("open");
  return classIndex(classId) >= openIdx ? OPEN_AND_ABOVE_BUCKET : classId;
}

/**
 * ⭐第11弾・案B-1（`devlog/wave11.md`§7）：`domain/rotation.js`が候補レースを集めるとき、
 * 馬のクラスから「見にいくバケツ」を1つ以上返す。新馬クラスの馬は新馬戦「と」未勝利戦の
 * 両方を見る（`data/classes.js`の`isEligibleForRaceClass`と同じ規則）。
 * ⚠️**設計判断**：レース側の索引キー（`yearIndexBucketFor`・レースは自分のクラスの
 * バケツにだけ入る）は変えず、**馬の側が複数のバケツを見る**形にした——レースを
 * 「出走資格のある馬のクラスの数だけ」複数のバケツへ二重登録するより、索引の作り方
 * （`buildYearIndex`）を単純なまま保てる。
 * @param {string} classId - 馬の`classId`
 * @returns {string[]}
 */
export function eligibleBucketsForHorseClass(classId) {
  const own = yearIndexBucketFor(classId);
  return classId === "shinba" ? [own, yearIndexBucketFor("maiden")] : [own];
}

/**
 * ⭐**目標レースからの逆算（第10弾・`devlog/wave10.md`）のために、指定した週から先
 * `weeksAhead`週ぶんの番組表を1回だけ組み、クラス×馬場で索引を作る。**
 * ⚠️**性能の要**（`devlog/wave10.md`§3.2）：素朴に「馬ごとに52週分の番組表を毎回組み直す」
 * と1週あたり数百万回の照合になる。この関数を週に1回だけ呼び、返った索引を
 * その週の全馬の`planNextTarget`呼び出しで使い回すこと。
 * @param {number|string} saveSeed
 * @param {number} startWeek - 索引の起点となる絶対週（通常は「今週」）
 * @param {number} startYear - `startWeek`の暦年（`player.currentYear`）
 * @param {number} [weeksAhead] - 何週先まで組むか（既定52＝ユーザー決定・`devlog/wave10.md`§2）
 * @returns {{ byBucketSurface: Map<string, object[]> }} `${bucket}|${surface}`をキーに、
 *   週の昇順に並んだレースの配列を持つ索引
 */
export function buildYearIndex(saveSeed, startWeek, startYear, weeksAhead = 52) {
  const byBucketSurface = new Map();
  for (let i = 0; i < weeksAhead; i += 1) {
    const week = startWeek + i;
    const year = yearForWeek(week, startWeek, startYear);
    const card = buildWeeklyCard(saveSeed, week, year);
    for (const race of card) {
      const bucket = yearIndexBucketFor(race.classId);
      const key = `${bucket}|${race.surface}`;
      if (!byBucketSurface.has(key)) byBucketSurface.set(key, []);
      byBucketSurface.get(key).push({ ...race, week, year });
    }
  }
  return { byBucketSurface };
}
