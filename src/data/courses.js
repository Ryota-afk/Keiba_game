// 競馬場のデータ（JRA10場・地方・海外）。
//
// ⚠️史実の場所・回り方向は公知の事実。
// ⭐JRA10場は`profile`に施行距離（芝・ダート別）を持つ（2026-09-16に追加。下の説明）。
// ⚠️直線長・坂・小回りといった**コースの形**はまだ持っていない（simは一律値で補う）。
// 収蔵済みの`design/jra-course-geometry.md`には入っているので、simが使うときに足す。

/** 割合の表に載っていない距離にも与える最小の重み（0.3％相当）。 */
const MIN_DISTANCE_WEIGHT = 0.3;

export const TURN = Object.freeze({ RIGHT: "right", LEFT: "left" });
export const REGION = Object.freeze({ JRA: "jra", NAR: "nar", OVERSEAS: "overseas" });

/**
 * ⭐競馬場ごとの施行距離（`profile`）。2026-09-16に入れた。
 *
 * ⚠️**これが無いと、競馬場と距離を別々に抽選するので札幌で芝3600mのレースが組まれる**
 * （`domain/weeklyCard.js`。実際には行われない距離。`devlog/wave08.md`§9）。
 *
 * **出どころ**：`design/jra-course-geometry.md`（JRA公式のコース図から2026-09-03に収蔵）。
 * ⚠️**これは今のJRAの距離表で、本作が扱う1970〜80年代の表ではない。** 年ごとの施行距離は
 * 承認済みの出典（`design/rights-check.md`）から取れていない。⭐そこで、手元にある史実の
 * 重賞データ（1972〜1989年・`data/gradedRacesByYear.js`）に実際に出てくる距離を足して
 * 和集合にした（例：東京の芝1200mは今の表に無いが1970年代には行われている）。
 * ⚠️逆に、今の表にしか無い距離（東京の芝2300m・中京の芝1600mなど改修後のもの）は
 * 残したままなので、当時は行われていない距離がいくつか混じる。
 * ⚠️**福島のダートだけは出典から取れていない**（`design/jra-course-geometry.md`の
 * 「全体所見」に未取得と明記）。他の小回り4場と同じ形を仮に置いた。
 */

// JRA10場。
export const JRA_COURSES = Object.freeze([
  {
    id: "sapporo", name: "札幌", region: REGION.JRA, turn: TURN.RIGHT,
    profile: { turf: [1000, 1200, 1500, 1800, 2000, 2600], dirt: [1000, 1200, 1700, 2000, 2400] },
  },
  {
    id: "hakodate", name: "函館", region: REGION.JRA, turn: TURN.RIGHT,
    profile: { turf: [1000, 1200, 1700, 1800, 2000, 2600], dirt: [1000, 1700, 2000, 2400] },
  },
  {
    id: "fukushima", name: "福島", region: REGION.JRA, turn: TURN.RIGHT,
    // ⚠️ダートは出典から取れていない（仮）。芝は史実の1800/2000/2400/2500mを含む。
    profile: {
      turf: [1000, 1200, 1700, 1800, 2000, 2400, 2500, 2600],
      dirt: [1000, 1150, 1700, 2400],
    },
  },
  {
    id: "niigata", name: "新潟", region: REGION.JRA, turn: TURN.LEFT,
    profile: {
      turf: [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400],
      dirt: [1000, 1200, 1700, 1800, 2500],
    },
  },
  {
    id: "tokyo", name: "東京", region: REGION.JRA, turn: TURN.LEFT,
    profile: {
      turf: [1200, 1400, 1600, 1800, 2000, 2200, 2300, 2400, 2500, 2600, 3200, 3400],
      dirt: [1200, 1300, 1400, 1600, 1700, 2100, 2400],
    },
  },
  {
    id: "nakayama", name: "中山", region: REGION.JRA, turn: TURN.RIGHT,
    profile: {
      turf: [1200, 1400, 1600, 1800, 2000, 2200, 2400, 2500, 2600, 3200, 3600, 4000],
      dirt: [1000, 1200, 1700, 1800, 2100, 2400, 2500],
    },
  },
  {
    id: "chukyo", name: "中京", region: REGION.JRA, turn: TURN.LEFT,
    profile: {
      turf: [1200, 1300, 1400, 1600, 1800, 2000, 2200, 3000],
      dirt: [1200, 1400, 1800, 1900, 2200, 2500],
    },
  },
  {
    id: "kyoto", name: "京都", region: REGION.JRA, turn: TURN.RIGHT,
    profile: {
      turf: [1100, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 3000, 3200],
      dirt: [1000, 1100, 1200, 1400, 1700, 1800, 1900, 2600],
    },
  },
  {
    id: "hanshin", name: "阪神", region: REGION.JRA, turn: TURN.RIGHT,
    profile: {
      turf: [1200, 1400, 1600, 1800, 2000, 2200, 2400, 2500, 3000, 3100, 3200],
      dirt: [1400, 1600, 1800, 2400, 2600],
    },
  },
  {
    id: "kokura", name: "小倉", region: REGION.JRA, turn: TURN.RIGHT,
    profile: {
      turf: [1000, 1200, 1700, 1800, 2000, 2400, 2600],
      dirt: [1000, 1700, 2400],
    },
  },
]);

// 地方（NAR）競馬場：⚠️ダートグレード61を開催する全場の一覧はまだ揃っていない
// （`design/rights-check.md`——NAR公式は転載が許諾制、Wikipediaでの裏取りが要る）。
// ここには素性の確実な代表場のみを仮置きする。回り方向は未検証のため持たない。
export const NAR_COURSES = Object.freeze([
  { id: "oi", name: "大井", region: REGION.NAR, turn: null, profile: null },
  { id: "funabashi", name: "船橋", region: REGION.NAR, turn: null, profile: null },
  { id: "kawasaki", name: "川崎", region: REGION.NAR, turn: null, profile: null },
  { id: "urawa", name: "浦和", region: REGION.NAR, turn: null, profile: null },
  { id: "kasamatsu", name: "笠松", region: REGION.NAR, turn: null, profile: null },
  { id: "nagoya", name: "名古屋", region: REGION.NAR, turn: null, profile: null },
  { id: "sonoda", name: "園田", region: REGION.NAR, turn: null, profile: null },
  { id: "kochi", name: "高知", region: REGION.NAR, turn: null, profile: null },
  { id: "saga", name: "佐賀", region: REGION.NAR, turn: null, profile: null },
  { id: "monbetsu", name: "門別", region: REGION.NAR, turn: null, profile: null },
]);

// 海外（ARCHITECTURE.md §3「レースカレンダー」の20〜30の対象地域）。
export const OVERSEAS_COURSES = Object.freeze([
  { id: "meydan", name: "メイダン", country: "UAE", region: REGION.OVERSEAS, profile: null },
  { id: "sha-tin", name: "シャティン", country: "香港", region: REGION.OVERSEAS, profile: null },
  { id: "longchamp", name: "ロンシャン", country: "フランス", region: REGION.OVERSEAS, profile: null },
  { id: "ascot", name: "アスコット", country: "イギリス", region: REGION.OVERSEAS, profile: null },
]);

export const ALL_COURSES = Object.freeze([
  ...JRA_COURSES,
  ...NAR_COURSES,
  ...OVERSEAS_COURSES,
]);

/** idから競馬場データを引く。無ければnull。 */
export function findCourse(courseId) {
  return ALL_COURSES.find((c) => c.id === courseId) ?? null;
}

/** 日本語名（結果表の表記）から競馬場idを引く。無ければnull。 */
export function findCourseByName(name) {
  return ALL_COURSES.find((c) => c.name === name)?.id ?? null;
}

/**
 * ⭐その競馬場で行われる馬場×距離の組から1つ引く。
 * 割合は`data/raceProgram.js`の実測表（`SURFACE_SHARE`・`DISTANCE_SHARE_*`）をそのまま使い、
 * **その競馬場に無い距離を取り除いてから正規化する**。
 * ⚠️`profile`を持たない競馬場（地方・海外）は`null`を返す——呼び出し側が従来の抽選に戻す。
 * @param {() => number} rand01
 * @param {string} courseId
 * @param {{surfaceShare: object, distanceShare: {turf: object, dirt: object}}} shares
 * @returns {{surface: string, distance: number}|null}
 */
export function drawShapeAtCourse(rand01, courseId, shares) {
  const course = findCourse(courseId);
  if (!course?.profile) return null;

  // その競馬場に距離が1つ以上ある馬場だけを残す。
  const surfaces = ["turf", "dirt"].filter((sf) => (course.profile[sf] ?? []).length > 0);
  if (surfaces.length === 0) return null;
  const surfaceWeights = surfaces.map((sf) => shares.surfaceShare[sf] ?? 0);
  const surfaceTotal = surfaceWeights.reduce((a, b) => a + b, 0);
  if (surfaceTotal <= 0) return null;
  let x = rand01() * surfaceTotal;
  let surface = surfaces[surfaces.length - 1];
  for (let i = 0; i < surfaces.length; i += 1) {
    x -= surfaceWeights[i];
    if (x <= 0) {
      surface = surfaces[i];
      break;
    }
  }

  // その馬場の距離のうち、この競馬場にある物だけを割合どおりに引く。
  // ⚠️割合の表に無い距離（例：中山の芝4000m）は重み0になるので、**必ず0より大きい下駄**を
  // 履かせる。履かせないと、割合の表に載っている距離しか一生選ばれない。
  const list = course.profile[surface];
  const share = shares.distanceShare[surface] ?? {};
  const weights = list.map((d) => (share[d] ?? 0) + MIN_DISTANCE_WEIGHT);
  const total = weights.reduce((a, b) => a + b, 0);
  let y = rand01() * total;
  for (let i = 0; i < list.length; i += 1) {
    y -= weights[i];
    if (y <= 0) return { surface, distance: list[i] };
  }
  return { surface, distance: list[list.length - 1] };
}
