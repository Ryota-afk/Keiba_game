// 競馬場のデータ（JRA10場・地方・海外）。
//
// ⚠️史実の場所・回り方向は公知の事実。距離・直線長・坂・小回りなどの詳しいコース
// プロファイル（ARCHITECTURE.md §5「コースと出走頭数」がsimで使う値）は未取得
// （ARCHITECTURE.md §15）。取得できるまで `profile: null` とし、simは仮の一律値で
// 補う（sim側の責務。ここではデータだけを持つ）。

export const TURN = Object.freeze({ RIGHT: "right", LEFT: "left" });
export const REGION = Object.freeze({ JRA: "jra", NAR: "nar", OVERSEAS: "overseas" });

// JRA10場。
export const JRA_COURSES = Object.freeze([
  { id: "sapporo", name: "札幌", region: REGION.JRA, turn: TURN.RIGHT, profile: null },
  { id: "hakodate", name: "函館", region: REGION.JRA, turn: TURN.RIGHT, profile: null },
  { id: "fukushima", name: "福島", region: REGION.JRA, turn: TURN.RIGHT, profile: null },
  { id: "niigata", name: "新潟", region: REGION.JRA, turn: TURN.LEFT, profile: null },
  { id: "tokyo", name: "東京", region: REGION.JRA, turn: TURN.LEFT, profile: null },
  { id: "nakayama", name: "中山", region: REGION.JRA, turn: TURN.RIGHT, profile: null },
  { id: "chukyo", name: "中京", region: REGION.JRA, turn: TURN.LEFT, profile: null },
  { id: "kyoto", name: "京都", region: REGION.JRA, turn: TURN.RIGHT, profile: null },
  { id: "hanshin", name: "阪神", region: REGION.JRA, turn: TURN.RIGHT, profile: null },
  { id: "kokura", name: "小倉", region: REGION.JRA, turn: TURN.RIGHT, profile: null },
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
