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
import { dayOfHistoricalDate } from "../data/weekDays.js";
import { coursesOpenInWeek } from "../data/jraMeetingSchedule.js";
import { drawShapeAtCourse } from "../data/courses.js";
import { gradedRacesForYear, hasGradedRaceData } from "../data/gradedRacesByYear.js";
import { classIndex } from "../data/classes.js";
import { gradedRaceNumberPreference, openStakesNumberPreference } from "../data/raceNumbers.js";
import { createCardSlots, freeNumbers, placeInSlot, featureCount, assignGeneralClasses } from "./cardSlots.js";
import {
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
 *   distance: number, fillyOnly: boolean, source: string, day: string, raceNumber: number, name?: string,
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
  // ⭐第13弾§22：先に「開いている競馬場×土日」の枠を作り（1枠＝1日の本数ちょうど。`racesPerDay`）、
  // 重賞→オープン特別→一般競走の順に番号つきで埋める（`domain/cardSlots.js`）。
  const slots = createCardSlots(openCourses, year);
  const slotByKey = new Map(slots.map((slot) => [slot.key, slot]));

  // ①重賞（実データ）：データが持つ競馬場・日（`day`）の枠へ置く。番号は年代で決まる
  // （`data/raceNumbers.js`：〜1981年9R／1982〜97年11R・G1は10R／1998年〜11R）。
  // グレード表記の無い年（〜1983年）はオープン以上の一括扱い（`classId: "open"`）にする——グレードそのものが
  // 1984年より前は史実にも付いていない（`tools/build-graded-races.mjs`）。
  // ⭐同じ枠に2本目の重賞が来たら次の番号（10R）へ。重なりはデータ側で減らしてある
  // （`tools/build-graded-races.mjs`の`spreadOverlappingGradedRaces`・`arch/race-program.md`§1）。
  const gradedToday = hasGradedRaceData(year) ? gradedRacesForYear(year).filter((r) => r.week === thisWeek) : [];
  const gradedByPriority = [...gradedToday].sort((a, b) => gradedPriority(a) - gradedPriority(b));
  for (const r of gradedByPriority) {
    const day = r.day ?? dayOfHistoricalDate(r.historicalDate);
    // 古いデータなどで、その日その競馬場の枠が無いときは、同じ日で重賞・特別の少ない枠へ置く。
    const slot =
      slotByKey.get(`${r.courseId}|${day}`) ??
      slots.filter((x) => x.day === day).sort((x, y) => featureCount(x) - featureCount(y))[0];
    const race = {
      raceId: r.id,
      classId: r.grade ?? "open",
      courseId: slot.courseId,
      surface: r.surface,
      distance: r.distance,
      fillyOnly: r.fillyOnly,
      source: RACE_SOURCE.GRADED,
      day: slot.day,
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
    };
    race.raceNumber = placeInSlot(slot, race, gradedRaceNumberPreference(year, isG1Like(r)));
  }

  // ②オープン特別：年の推定本数（`estimateOpenStakesCount`）を52週へ確率配分する。
  // ⚠️実データが無い推定値（`arch/race-program.md`§3）——`classId`は`open`。
  // ⭐置く枠は、重賞・オープン特別がいちばん少ない枠（同数なら乱数）。メインの番号が空いていればそこへ。
  const openStakesCountThisYear = estimateOpenStakesCount(gradedCountForYear(year));
  const openStakesToday = stochasticRound(openStakesCountThisYear / WEEKS_PER_YEAR, rand01);
  for (let i = 0; i < openStakesToday; i += 1) {
    const fewest = Math.min(...slots.map(featureCount));
    const candidates = slots.filter((slot) => featureCount(slot) === fewest && freeNumbers(slot).length > 0);
    if (candidates.length === 0) break;
    const slot = pick(rand01, candidates);
    const { surface, distance, fillyOnly } = drawShapeFor(rand01, slot.courseId);
    const number = openStakesNumberPreference(year).find((n) => n <= slot.size && slot.races[n - 1] == null);
    const raceId = `${year}-w${thisWeek}-${slot.courseId}-${slot.day}-${number}`;
    slot.races[number - 1] = {
      raceId,
      raceNumber: number,
      classId: "open",
      courseId: slot.courseId,
      surface,
      distance,
      fillyOnly,
      source: RACE_SOURCE.OPEN_STAKES,
      day: slot.day,
      fieldSize: fieldSizeForRace(saveSeed, raceId),
    };
  }

  // ③一般競走（新馬〜3勝クラス）：残りの空き枠すべて（開いている競馬場×2日×1日の本数から、
  // 重賞・オープン特別を引いた残り。`arch/race-program.md`§10）。クラスは従来どおりの割合で空き枠の数だけ
  // 引き、並びの型（`data/raceNumbers.js`）に沿って番号へ割り振る。
  const generalSlotCount = slots.reduce((sum, slot) => sum + freeNumbers(slot).length, 0);
  const classes = Array.from({ length: generalSlotCount }, () => drawGeneralRaceClass(rand01, thisWeek));
  const assigned = assignGeneralClasses(slots, year, classes, rand01);
  for (const { slot, number, classId } of assigned) {
    const { surface, distance, fillyOnly } = drawShapeFor(rand01, slot.courseId);
    const raceId = `${year}-w${thisWeek}-${slot.courseId}-${slot.day}-${number}`;
    slot.races[number - 1] = {
      raceId,
      raceNumber: number,
      classId,
      courseId: slot.courseId,
      surface,
      distance,
      fillyOnly,
      source: RACE_SOURCE.GENERAL,
      day: slot.day,
      fieldSize: fieldSizeForRace(saveSeed, raceId),
    };
  }

  // 並び＝土曜の競馬場順→日曜の競馬場順、各日は1Rから。
  return slots.flatMap((slot) => slot.races.filter((race) => race != null));
}

/** 番号を先に取る順（G1→G2→G3→格付け無し）。 */
function gradedPriority(r) {
  if (isG1Like(r)) return 0;
  return { g2: 1, g3: 2 }[r.grade] ?? 3;
}

/** G1か。1983年までは「1984年にG1だった」レース（`g1Like`）も数える（`tools/build-graded-races.mjs`）。 */
function isG1Like(r) {
  return r.grade === "g1" || r.g1Like === true;
}

/** オープン以上（重賞・オープン特別）をまとめて指す索引の鍵（第10弾・`domain/rotation.js`用）。 */
export const OPEN_AND_ABOVE_BUCKET = "open+";

/**
 * 馬のクラスidから、`buildYearIndex`が使う索引の鍵を出す。オープン以上
 * （`open`・`listed`・`g3`・`g2`・`g1`）は`OPEN_AND_ABOVE_BUCKET`にまとめる——
 * 馬の`classId`は`open`止まりだが（`domain/horseClass.js`・クラスは収得賞金で決まる）、
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
