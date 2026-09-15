// JRAの52週の開催の並び（質問20＝(イ)・2026-09-15にユーザー決定）。
// ⭐**毎年固定して使う**。中身は`design/jra-race-calendar.md`（Wikipedia「中央競馬」原文）を
// `devlog/wave06.md`§67「52週の並びを組んだ」で52週へ落とした表そのもの。
// 検算済み：関東13＋関西13＋第3場10＝36開催／場・週末の延べ144＝288日／
// 3場の週40＋2場の週12＝52週／年3,456レース（1998年以降の1日12競走のとき）。
//
// 純データ＋純関数のみ（JSX無し）。

/** 地区（質問21＝(ア)で使う。並びに無い競馬場の重賞を同じ地区の開いている場へ移す）。 */
export const REGION_BY_COURSE = Object.freeze({
  tokyo: "kanto",
  nakayama: "kanto",
  fukushima: "kanto",
  niigata: "kanto",
  kyoto: "kansai",
  hanshin: "kansai",
  chukyo: "kansai",
  kokura: "kansai",
  sapporo: "hokkaido",
  hakodate: "hokkaido",
});

/**
 * 13の開催ブロック。`kanto`/`kansai`/`third`はそれぞれ`courses.js`のid、
 * `weeks`は`[開始週, 終了週]`（1〜52・両端含む）。
 */
export const MEETING_BLOCKS = Object.freeze([
  { kanto: "nakayama", kantoWeeks: [1, 4], kansai: "kyoto", kansaiWeeks: [1, 4], third: null, thirdWeeks: null },
  { kanto: "tokyo", kantoWeeks: [5, 8], kansai: "kyoto", kansaiWeeks: [5, 7], third: "kokura", thirdWeeks: [4, 9] },
  { kanto: "nakayama", kantoWeeks: [9, 12], kansai: "hanshin", kansaiWeeks: [8, 12], third: "chukyo", thirdWeeks: [10, 13] },
  { kanto: "nakayama", kantoWeeks: [13, 16], kansai: "hanshin", kansaiWeeks: [13, 17], third: "fukushima", thirdWeeks: [14, 17] },
  { kanto: "tokyo", kantoWeeks: [17, 22], kansai: "kyoto", kansaiWeeks: [18, 22], third: "niigata", thirdWeeks: [18, 21] },
  { kanto: "tokyo", kantoWeeks: [23, 26], kansai: "hanshin", kansaiWeeks: [23, 26], third: null, thirdWeeks: [22, 24] },
  { kanto: "fukushima", kantoWeeks: [27, 30], kansai: "kokura", kansaiWeeks: [27, 30], third: "hakodate", thirdWeeks: [25, 28] },
  { kanto: "niigata", kantoWeeks: [31, 33], kansai: "chukyo", kansaiWeeks: [31, 33], third: "sapporo", thirdWeeks: [29, 32] },
  { kanto: "niigata", kantoWeeks: [34, 35], kansai: "chukyo", kansaiWeeks: [34, 35], third: "sapporo", thirdWeeks: [33, 36] },
  { kanto: "nakayama", kantoWeeks: [36, 39], kansai: "hanshin", kansaiWeeks: [36, 39], third: null, thirdWeeks: [37, 42] },
  { kanto: "tokyo", kantoWeeks: [40, 44], kansai: "kyoto", kansaiWeeks: [40, 44], third: "niigata", thirdWeeks: [43, 44] },
  { kanto: "tokyo", kantoWeeks: [45, 48], kansai: "kyoto", kansaiWeeks: [45, 48], third: "fukushima", thirdWeeks: [45, 48] },
  { kanto: "nakayama", kantoWeeks: [49, 52], kansai: "hanshin", kansaiWeeks: [49, 52], third: "chukyo", thirdWeeks: [49, 52] },
]);

export const WEEKS_PER_YEAR = 52;
export const MEETING_DAYS_PER_YEAR = 288; // 検算済み（原文の年間最大と一致）

function inRange(week, range) {
  return range != null && week >= range[0] && week <= range[1];
}

/**
 * 指定した暦週（1〜52）に開いている競馬場のid一覧（最大3場）。
 * @param {number} week
 * @returns {string[]}
 */
export function coursesOpenInWeek(week) {
  const open = new Set();
  for (const block of MEETING_BLOCKS) {
    if (inRange(week, block.kantoWeeks)) open.add(block.kanto);
    if (inRange(week, block.kansaiWeeks)) open.add(block.kansai);
    if (block.third && inRange(week, block.thirdWeeks)) open.add(block.third);
  }
  return [...open];
}

/** その地区で、指定した週に開いている競馬場（無ければnull）。 */
export function openCourseInRegion(week, region) {
  const open = coursesOpenInWeek(week).filter((id) => REGION_BY_COURSE[id] === region);
  return open[0] ?? null;
}

/**
 * 月ごとの週数（`devlog/wave06.md`§67の「月ごとの週数」の決定）。
 * 3・5・8・10月が5週、残りが4週で合計52。
 */
export const WEEKS_PER_MONTH = Object.freeze([4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4]);

/** 月（1〜12）の最初の週番号を返す。 */
export function firstWeekOfMonth(month) {
  let w = 1;
  for (let m = 1; m < month; m += 1) w += WEEKS_PER_MONTH[m - 1];
  return w;
}

/**
 * 暦週（1〜52）から、月と「その月の第何週目か」を出す（`weekOfYearFromDate`の逆引き）。
 * @param {number} week
 * @returns {{ month: number, weekOfMonth: number }}
 */
export function monthAndWeekOfMonth(week) {
  let w = week;
  for (let month = 1; month <= 12; month += 1) {
    if (w <= WEEKS_PER_MONTH[month - 1]) return { month, weekOfMonth: w };
    w -= WEEKS_PER_MONTH[month - 1];
  }
  return { month: 12, weekOfMonth: WEEKS_PER_MONTH[11] };
}

/**
 * 出馬表の日付欄に出す近似日付（`{ year, month, day }`）。⚠️実際のカレンダーとは
 * 一致しない——週番号から「その月の第何週目か」だけを使い、日は`(週目-1)*7+1`で
 * 仮に決める（実データの正確な開催日はまだ取れていない・`arch/horse.md`「レースカレンダー」）。
 */
export function approximateDate(year, week) {
  const { month, weekOfMonth } = monthAndWeekOfMonth(week);
  const day = Math.min(28, (weekOfMonth - 1) * 7 + 1);
  return { year, month, day };
}

/**
 * 実際の日付（year, month, day）を、その年の暦週（1〜52）へ変換する。
 * ⚠️史実の重賞データを52週の並びに載せるための近似——「1月1日を第1週として
 * 7日ごとに数える」（`devlog/wave06.md`〜`wave07.md`で史実の突き合わせに使った方法と同じ）。
 * 53週目に当たる日（うるう年など）は52週に丸める。
 */
export function weekOfYearFromDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor((d - jan1) / 86_400_000);
  const week = Math.floor(days / 7) + 1;
  return Math.min(WEEKS_PER_YEAR, week);
}

/**
 * 質問21＝(ア)：並びの上でその週に競馬場が開いていなければ、同じ地区の開いている
 * 競馬場へ移す。開いている場が無ければ（地区の3場とも開いていない週）元の競馬場を返す。
 * @param {string} originalCourseId - 史実の競馬場id
 * @param {number} week - その重賞を置く週
 * @returns {string} 実際に使う競馬場id
 */
export function resolveMeetingCourse(originalCourseId, week) {
  const open = coursesOpenInWeek(week);
  if (open.includes(originalCourseId)) return originalCourseId;
  const region = REGION_BY_COURSE[originalCourseId];
  const sameRegionOpen = openCourseInRegion(week, region);
  return sameRegionOpen ?? originalCourseId;
}

/**
 * 平地G1・24本の固定週（`devlog/wave06.md`§67「G1の週」。原文が週を指定している
 * 26レースのうち平地24本。障害2本＝中山グランドジャンプ・中山大障害はゲームに出さない
 * ため含めない）。名前は2026年の呼び方。年ごとの実データ側の名寄せは
 * `tools/build-graded-races.mjs`が行う。
 */
export const FIXED_G1_WEEK = Object.freeze({
  "フェブラリーステークス": 8,
  "高松宮記念": 13,
  "大阪杯": 14,
  "桜花賞": 15,
  "皐月賞": 16,
  "天皇賞（春）": 18,
  "NHKマイルカップ": 19,
  "ヴィクトリアマイル": 20,
  "優駿牝馬": 21, // オークス
  "東京優駿": 22, // 日本ダービー
  "安田記念": 23,
  "宝塚記念": 24,
  "スプリンターズステークス": 39,
  "秋華賞": 42,
  "菊花賞": 43,
  "天皇賞（秋）": 44,
  "エリザベス女王杯": 46,
  "マイルチャンピオンシップ": 47,
  "ジャパンカップ": 48,
  "チャンピオンズカップ": 49,
  "阪神ジュベナイルフィリーズ": 50,
  "朝日杯フューチュリティステークス": 51,
  "有馬記念": 52,
  "ホープフルステークス": 52,
});

/** すべてのブロックの検算（開発時の自己チェック用）。 */
export function verifyMeetingBlocks() {
  let kantoDays = 0;
  let kansaiDays = 0;
  let thirdDays = 0;
  let kantoMeetings = 0;
  let kansaiMeetings = 0;
  let thirdMeetings = 0;
  for (const block of MEETING_BLOCKS) {
    kantoDays += (block.kantoWeeks[1] - block.kantoWeeks[0] + 1) * 2;
    kansaiDays += (block.kansaiWeeks[1] - block.kansaiWeeks[0] + 1) * 2;
    kantoMeetings += 1;
    kansaiMeetings += 1;
    if (block.third) {
      thirdDays += (block.thirdWeeks[1] - block.thirdWeeks[0] + 1) * 2;
      thirdMeetings += 1;
    }
  }
  const totalDays = kantoDays + kansaiDays + thirdDays;
  const totalMeetings = kantoMeetings + kansaiMeetings + thirdMeetings;
  return { kantoDays, kansaiDays, thirdDays, totalDays, totalMeetings };
}
