// 馬のクラス（新馬〜オープン）の決め直しと、未勝利馬の中央からの退場
// （第13弾・`devlog/wave13.md`§7・`design/jra-entry-rules.md`§1〜§3）。
// クラスは勝った回数ではなく、収得賞金（`record.shutokuPrize`）・馬齢・時期で決まる
// （表は`data/shutokuPrize.js`の`classByShutoku`）。毎週の初めと、レースの後に決め直す。
// 純ロジック（JSX無し。`data/`だけに依存）。

import { weekOfYear } from "../data/calendar.js";
import {
  classByShutoku,
  SHUTOKU_STARTING_BY_CLASS,
  MAIDEN_LEAVE_WEEK,
} from "../data/shutokuPrize.js";

/**
 * 馬の収得賞金（円）。欄を持たない馬（古いセーブ）は現在のクラスから開始値を決める
 * （`SHUTOKU_STARTING_BY_CLASS`）。
 */
export function shutokuOf(horse) {
  return horse.record?.shutokuPrize ?? SHUTOKU_STARTING_BY_CLASS[horse.classId] ?? 0;
}

/** 馬齢（年−生年）。生年が無い馬はnull。 */
function ageOf(horse, year) {
  return horse.bornYear == null ? null : year - horse.bornYear;
}

/**
 * その馬のいまのクラス。生年が無い馬（年齢が分からない）は今のクラスのまま。
 * @param {object} horse
 * @param {number} absWeek - 絶対週
 * @param {number} year - 暦年
 */
export function classForHorse(horse, absWeek, year) {
  const age = ageOf(horse, year);
  if (age == null) return horse.classId;
  return classByShutoku({
    shutoku: shutokuOf(horse),
    age,
    absWeek,
    starts: horse.record?.starts ?? 0,
  });
}

/** レース後など、1頭のクラスだけを決め直す（変わらなければ同じオブジェクトを返す）。 */
export function withReclassedClass(horse, absWeek, year) {
  const classId = classForHorse(horse, absWeek, year);
  return classId === horse.classId ? horse : { ...horse, classId };
}

/** 未勝利（収得賞金0円）のまま、3歳の9月7日以降を迎えたか（＝中央を去る）。 */
function mustLeaveForLocal(horse, absWeek, year) {
  const age = ageOf(horse, year);
  if (horse.isHistorical || age == null || age < 3) return false;
  if (shutokuOf(horse) > 0) return false;
  return age > 3 || weekOfYear(absWeek) >= MAIDEN_LEAVE_WEEK;
}

/**
 * 週の初めの処理：全馬のクラスを決め直し、未勝利のまま3歳の9月7日を迎えた馬を中央から外す
 * （地方へ移った扱い。`isRetired: true`＋`leftForLocal: true`にして名簿に残す——年の区切りで
 * 普通の引退と同じく数えられ、新しい2歳が補充される。繁殖入りはしない。
 * `domain/yearBoundary.js`）。収得賞金の欄が無い馬はここで補う。
 * @returns {{ horses: object[], leftForLocal: object[] }} `leftForLocal`＝今回外れた馬
 */
export function reclassAndRetireMaidens(horses, absWeek, year) {
  const leftForLocal = [];
  const next = horses.map((h) => {
    if (h.isRetired) return h;
    let horse = h;
    if (h.record && h.record.shutokuPrize == null) {
      horse = { ...h, record: { ...h.record, shutokuPrize: shutokuOf(h) } };
    }
    if (mustLeaveForLocal(horse, absWeek, year)) {
      const gone = { ...horse, isRetired: true, leftForLocal: true };
      leftForLocal.push(gone);
      return gone;
    }
    return withReclassedClass(horse, absWeek, year);
  });
  return { horses: next, leftForLocal };
}
