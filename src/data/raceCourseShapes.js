// レースごとのコースの形（コーナーの区間と幅員）。`devlog/wave16.md`§6・正本は`design/jra-courses.md`。
// 純データ＋自己完結の小さな組み立て関数だけ（JSX無し・Node単体で動く）。
//
// ⭐レースの距離の座標（発走地点＝0・ゴール＝距離。内ラチ沿いの距離）で、コーナーの区間
// `[{ from, to, angle, corner }]`（1つ90度。途中から発走するときは走るぶんだけの角度）と幅員を返す。
// ⚠️コーナーの半径は持たない——外を回る損は「角度 × 内ラチからの横の距離」で決まり、半径に依らない
// （`sim/raceSim.js`の`d += v·dt/(1+κ·x)`、κ＝角度÷区間の長さ）。
//
// ⭐1周の形（A＝最内柵のコース）を5つの区間で持つ：
//   ゴール →(F)→ 1コーナー入口 →(C12＝1・2コーナー 180度)→ 向正面(B) →(C34＝3・4コーナー 180度)→ 最後の直線(S) → ゴール
//   lap ＝ F + C12 + B + C34 + S。
// レースの形は、ゴールから距離ぶん逆に辿って作る（ゴールの地点は全距離で同じ。発走地点が距離で変わる）。
//
// 出典の印（`provisional`）：
//   ・lap（周長）・S（最後の直線）・幅員＝JRA公式のコースデータ表（J1）。確かめた値。
//   ・F（ゴール→1コーナー）＝「1コーナーまで○m」の記述（J4・J5・J6）から逆算した値。記述の無い場は仮。
//   ・C12・C34・B（コーナーと向正面の長さの配分）＝承認済みの出典に無い。**仮**。既定は
//     「向正面＝ホームの直線（S+F）と同じ長さの楕円」。「3コーナーまで○m」の記述がある場はそこから決めた。
// ⚠️**これは今のJRAのコースで、本作の1970〜80年代のコースではない**（阪神の外回りは2006年・新潟の外回りは
// 2001年・中京の今の形は2012年から）。当時の形は承認済みの出典から取れていない。

/** 1コーナー＝90度（JRA用語辞典「コーナー」・Wikipedia「競馬場」）。 */
const QUARTER = Math.PI / 2;

/** 1周の形が分からないコースに使う一般形（仮）。地方・海外・未知のid。 */
const GENERIC_LAYOUT = Object.freeze({
  lap: 1600, S: 300, F: 60, width: [20, 20], provisional: ["lap", "S", "F", "corners", "width"],
});

/**
 * 対称の楕円（向正面＝S＋F）として、残りをコーナー2つ（各180度）に割り振る。
 * @returns {{C12:number,B:number,C34:number}}
 */
function symmetric(lap, S, F) {
  const B = S + F;
  const C = (lap - S - F - B) / 2;
  return { C12: C, B, C34: C };
}

/**
 * 1周の形。キー＝`${courseId}:${surface}:${loop}`（loop＝inner／outer／main）。
 * `facts`は確かめに使った出典の記述（`tools/check-course-shapes.mjs`が突き合わせる）。
 */
const LAYOUTS = (() => {
  const L = {};
  const put = (key, o) => {
    const parts = o.C12 != null ? { C12: o.C12, B: o.B, C34: o.C34 } : symmetric(o.lap, o.S, o.F);
    const total = o.F + parts.C12 + parts.B + parts.C34 + o.S;
    L[key] = Object.freeze({ ...o, ...parts, closes: Math.abs(total - o.lap) < 0.5 });
  };
  // ===== 芝 =====
  // 札幌：F＝2000mの「1コーナーまで約380m」（J5札幌記念）−（2000−1640.9）。
  // 対称形のC＝533.4は、1200mの「3コーナーまで約400m」（J5キーンランドC）から出る534.0と合う。
  put("sapporo:turf:main", { lap: 1640.9, S: 266.1, F: 20.9, width: [25, 27], provisional: ["corners"] });
  // 函館：F＝2000mの「1コーナーまで約470m」（J5函館記念）から。対称形のC＝454.6、1200mの「3コーナーまで約490m」からは447.9。
  put("hakodate:turf:main", { lap: 1626.6, S: 262.1, F: 96.6, width: [29, 29], provisional: ["corners"] });
  // 福島：F＝2000mの「1コーナーまでA505.3m」（J6福島記念）から105.3、1800mの「約300m」（J5）から100.0。平均を取らず確かな方。
  put("fukushima:turf:main", { lap: 1600, S: 292.0, F: 105.3, width: [25, 27], provisional: ["corners"] });
  // 新潟：内回りはFの記述なし（仮）。外回りは1・2コーナーとFを内回りと共有、3・4コーナーは
  // 1600mの「3コーナーまで500m以上」（J5関屋記念）から上限の441m。
  put("niigata:turf:inner", { lap: 1623, S: 358.7, F: 90, width: [25, 25], provisional: ["F", "corners"] });
  {
    const inner = symmetric(1623, 358.7, 90);
    const C34 = 1600 - 500 - 658.7;
    put("niigata:turf:outer", {
      lap: 2223, S: 658.7, F: 90, width: [25, 25], C12: inner.C12, C34, B: 2223 - 658.7 - 90 - inner.C12 - C34,
      provisional: ["F", "corners"],
    });
  }
  // 東京：Fの記述なし（2400mは発走が坂を上りきったあたり＝ゴールまで316.9m。1コーナーまでは不明）。仮に100m。
  // 対称形で1600m＝2コーナー付近・1800m＝1〜2コーナーの間・2000m＝1コーナー奥（J4・J6）と合う。
  put("tokyo:turf:main", { lap: 2083.1, S: 525.9, F: 100, width: [31, 41], provisional: ["F", "corners"] });
  // 中山内回り：F＝2000mの「1コーナーまでA404.9m」（J4皐月賞）から72.0（1800mの「約200m」からは67.1）。
  put("nakayama:turf:inner", { lap: 1667.1, S: 310, F: 72, width: [20, 32], provisional: ["corners"] });
  // 中山外回り：3・4コーナー＝1200mの「3コーナーまでA275.1m」（J4スプリンターズS）から614.9。1・2コーナーは内回りと同じ（仮）。
  {
    const inner = symmetric(1667.1, 310, 72);
    const C34 = 1200 - 275.1 - 310;
    put("nakayama:turf:outer", {
      lap: 1839.7, S: 310, F: 72, width: [24, 32], C12: inner.C12, C34, B: 1839.7 - 310 - 72 - inner.C12 - C34,
      provisional: ["corners"],
    });
  }
  // 中京：3・4コーナー＝1200mの「3コーナーまでA315.5m」（J4高松宮記念）から472.0。
  // F＝1600mの「約200mで本線に合流し2コーナーへ」（J5中京記念）と、1・2コーナー＝3・4コーナーの仮定から69.9。
  {
    const C34 = 1200 - 315.5 - 412.5;
    const C12 = C34;
    const B = 1600 - 412.5 - C34 - 200 - C12 / 2;
    put("chukyo:turf:main", {
      lap: 1705.9, S: 412.5, F: 1705.9 - 412.5 - C34 - C12 - B, width: [28, 30], C12, B, C34,
      provisional: ["corners"],
    });
  }
  // 京都内回り：F＝2000mの「1コーナーまでA308.7m」（J4秋華賞）から91.5。3・4コーナー＝1200mの「最初のコーナーまでA316.2m」（J6京阪杯）から555.4。
  // 1・2コーナーと向正面は残りを半分ずつ（仮）。
  {
    const C34 = 1200 - 316.2 - 328.4;
    const rest = 1782.8 - 328.4 - 91.5 - C34;
    put("kyoto:turf:inner", {
      lap: 1782.8, S: 328.4, F: 91.5, width: [27, 38], C12: rest / 2, B: rest / 2, C34, provisional: ["corners"],
    });
  }
  // 京都外回り：3・4コーナー＝1600mの「3コーナーまで約700m」（J4マイルCS）から496.3。残りは半分ずつ（仮）。
  {
    const C34 = 1600 - 700 - 403.7;
    const rest = 1894.3 - 403.7 - 91.5 - C34;
    put("kyoto:turf:outer", {
      lap: 1894.3, S: 403.7, F: 91.5, width: [24, 38], C12: rest / 2, B: rest / 2, C34, provisional: ["corners"],
    });
  }
  // 阪神内回り：F＝2200mの「1コーナーまでA530.5m」（J4宝塚記念）から19.5。コーナーは各460m（仮）。
  put("hanshin:turf:inner", {
    lap: 1689, S: 356.5, F: 19.5, width: [24, 28], C12: 460, C34: 460, B: 1689 - 356.5 - 19.5 - 920,
    provisional: ["corners"],
  });
  // 阪神外回り：1・2コーナーは内回りと同じ460m（仮）、3・4コーナーは「ゆったり」（J1阪）から600m（仮）。
  // 1600mの「3コーナーまで400m以上」（J4桜花賞）は満たす（526m）。
  put("hanshin:turf:outer", {
    lap: 2089, S: 473.6, F: 19.5, width: [24, 29], C12: 460, C34: 600, B: 2089 - 473.6 - 19.5 - 460 - 600,
    provisional: ["corners"],
  });
  // 小倉：F＝2000mの「1コーナーまで約470m」（J5）から85.1。
  put("kokura:turf:main", { lap: 1615.1, S: 293, F: 85.1, width: [30, 30], provisional: ["corners"] });

  // ===== ダート =====（Fは記述のある中京・京都だけ。他は仮に60m）
  put("sapporo:dirt:main", { lap: 1487, S: 264.3, F: 60, width: [20, 20], provisional: ["F", "corners"] });
  put("hakodate:dirt:main", { lap: 1475.8, S: 260.3, F: 60, width: [20, 20], provisional: ["F", "corners"] });
  put("fukushima:dirt:main", { lap: 1444.6, S: 295.7, F: 60, width: [20, 25], provisional: ["F", "corners"] });
  put("niigata:dirt:main", { lap: 1472.5, S: 353.9, F: 60, width: [20, 20], provisional: ["F", "corners"] });
  // 東京ダート：3・4コーナー＝1600mの「3コーナーまで約640m」（J4フェブラリーS）から458.4。1・2コーナーも同じ（仮）。
  {
    const C34 = 1600 - 640 - 501.6;
    put("tokyo:dirt:main", {
      lap: 1899, S: 501.6, F: 60, width: [25, 25], C12: C34, C34, B: 1899 - 501.6 - 60 - 2 * C34,
      provisional: ["F", "corners"],
    });
  }
  put("nakayama:dirt:main", { lap: 1493, S: 308, F: 60, width: [20, 25], provisional: ["F", "corners"] });
  // 中京ダート：F＝1800mの「1コーナーまで291.8m」（J4チャンピオンズC）から21.8。
  put("chukyo:dirt:main", { lap: 1530, S: 410.7, F: 21.8, width: [25, 25], provisional: ["corners"] });
  // 京都ダート：F＝1800mの「1コーナーまで285.8m」（J6みやこS）から93.4。
  put("kyoto:dirt:main", { lap: 1607.6, S: 329.1, F: 93.4, width: [25, 25], provisional: ["corners"] });
  put("hanshin:dirt:main", { lap: 1517.6, S: 352.7, F: 60, width: [22, 25], provisional: ["F", "corners"] });
  put("kokura:dirt:main", { lap: 1445.4, S: 291.3, F: 60, width: [24, 24], provisional: ["F", "corners"] });
  return Object.freeze(L);
})();

/**
 * 内回り・外回りのある場の、距離→どちらを使うか（J1の発走距離一覧の「内」「外」）。
 * 一覧に無い距離（史実の距離）と「内外」両方の距離は仮に決めた（`provisional`に"loop"が付く）。
 */
const LOOP_BY_DISTANCE = Object.freeze({
  "nakayama:turf": { outer: [1200, 1600, 2200, 2600, 4000], inner: [1800, 2000, 2500, 3600], guess: { 3200: "outer" } },
  "kyoto:turf": { inner: [1100, 1200, 2000], outer: [1600, 1800, 2200, 2400, 3000, 3200], guess: { 1400: "outer" } },
  "hanshin:turf": { inner: [1200, 2000, 2200, 3000, 3200], outer: [1600, 1800, 2400, 2600], guess: { 1400: "inner" } },
  "niigata:turf": { inner: [1200, 2200, 2400], outer: [1600, 1800, 3000, 3200], guess: { 1400: "inner", 2000: "outer" } },
});

/**
 * 発走地点の記述（距離ごと）。`pocket`＝引き込み線（ポケット）からの発走で、発走地点に掛かる
 * コーナーの切れ端は走らない（直線として扱う）。`firstCorner`＝最初に走るコーナーの番号（引き込み線が
 * 本線に合流するまでのコーナーは走らない）。
 * `firstCornerAt`＝出典の「最初のコーナーまで」（突き合わせ用。`atLeast`＝「○m以上」の記述）。
 * ⚠️`firstCorner`をポケット以外にも付けたもの（中山2000・中京1200・阪神2200）は、1周の形から辿ると発走地点が
 * コーナーの出口に数十m掛かるが、出典は「直線入口付近」「向正面」「4コーナー付近」と書いているので、その切れ端を走らないことにした（仮）。
 */
const START_FACTS = Object.freeze({
  "sapporo:turf:1200": { pocket: true, firstCorner: 3, firstCornerAt: 400, src: "J5キーンランドC（2コーナー奥のポケット・3コーナーまで約400m）" },
  "sapporo:turf:2000": { pocket: true, firstCorner: 1, firstCornerAt: 380, src: "J5札幌記念（4コーナー奥のポケット・約380m）" },
  "hakodate:turf:1200": { pocket: true, firstCorner: 3, firstCornerAt: 490, src: "J5函館スプリントS（2コーナー奥のポケット・約490m）" },
  "hakodate:turf:2000": { pocket: true, firstCorner: 1, firstCornerAt: 470, src: "J5函館記念（4コーナー奥のポケット・約470m）" },
  "fukushima:turf:1200": { pocket: true, firstCorner: 3, src: "W競（2コーナーのポケット）" },
  "fukushima:turf:1800": { firstCornerAt: 300, src: "J5福島牝馬S（スタンド前・約300m）" },
  "fukushima:turf:2000": { pocket: true, firstCorner: 1, firstCornerAt: 505.3, src: "J6福島記念（4コーナー奥のポケット・A505.3m）" },
  "niigata:turf:1600": { firstCornerAt: 500, atLeast: true, src: "J5関屋記念（3コーナーまで500m以上）" },
  "niigata:turf:2000": { pocket: true, firstCorner: 3, src: "W競（2コーナーのポケット）" },
  "tokyo:turf:1600": { pocket: true, firstCorner: 3, src: "J4安田記念（2コーナー付近）" },
  "tokyo:turf:1800": { pocket: true, firstCorner: 2, src: "J6東スポ杯（1〜2コーナーの中間のポケット）" },
  "tokyo:turf:2000": { pocket: true, firstCorner: 2, src: "J4天皇賞秋（1コーナー奥・2コーナーで合流）" },
  "nakayama:turf:1200": { firstCornerAt: 275.1, src: "J4スプリンターズS（A275.1m）" },
  "nakayama:turf:1600": { pocket: true, firstCorner: 2, src: "W競（1コーナーの外・2コーナーで合流）" },
  "nakayama:turf:1800": { firstCornerAt: 200, src: "J5中山記念（約200m）" },
  "nakayama:turf:2000": { firstCorner: 1, firstCornerAt: 404.9, src: "J4皐月賞（A404.9m）" },
  "chukyo:turf:1200": { firstCorner: 3, firstCornerAt: 315.5, src: "J4高松宮記念（A315.5m）" },
  "chukyo:turf:1600": { pocket: true, firstCorner: 2, src: "J5中京記念（1〜2コーナーの間の引き込み線・約200mで合流）" },
  "kyoto:turf:1200": { firstCornerAt: 316.2, src: "J6京阪杯（A316.2m）" },
  "kyoto:turf:1600": { pocket: true, firstCorner: 3, firstCornerAt: 700, src: "J4マイルCS（2コーナー奥の引き込み線・約700m）" },
  "kyoto:turf:2000": { firstCornerAt: 308.7, src: "J4秋華賞（A308.7m）" },
  "kyoto:turf:2400": { pocket: true, firstCorner: 1, src: "W競（4コーナーのポケット）" },
  "hanshin:turf:1600": { firstCornerAt: 400, atLeast: true, src: "J4桜花賞（3コーナーまで400m以上）" },
  "hanshin:turf:1800": { pocket: true, firstCorner: 3, src: "W競（2コーナーのポケット）" },
  "hanshin:turf:2200": { firstCorner: 1, firstCornerAt: 530.5, src: "J4宝塚記念（A530.5m）" },
  "kokura:turf:1200": { pocket: true, firstCorner: 3, src: "J1小（2コーナー奥のポケット）" },
  "kokura:turf:2000": { pocket: true, firstCorner: 1, firstCornerAt: 470, src: "J5（4コーナー奥のポケット・約470m）" },
  "tokyo:dirt:1600": { pocket: true, firstCorner: 3, firstCornerAt: 640, src: "J4フェブラリーS（2コーナー奥・3コーナーまで約640m）" },
  "chukyo:dirt:1800": { firstCornerAt: 291.8, src: "J4チャンピオンズC（291.8m）" },
  "kyoto:dirt:1800": { firstCornerAt: 285.8, src: "J6みやこS（285.8m）" },
});

function loopFor(courseId, surface, distance) {
  const table = LOOP_BY_DISTANCE[`${courseId}:${surface}`];
  if (!table) return { loop: "main", guessed: false };
  if (table.inner.includes(distance)) return { loop: "inner", guessed: false };
  if (table.outer.includes(distance)) return { loop: "outer", guessed: false };
  return { loop: table.guess?.[distance] ?? "inner", guessed: true };
}

/**
 * 1周の形をゴールから`distance`ぶん逆に辿り、レースの距離の座標でコーナーの区間を返す。
 * @returns {{from:number,to:number,angle:number,corner:number}[]} 発走地点に近い順
 */
function walkCorners(layout, distance) {
  // ゴールから逆向きに並べた区間（[長さ, コーナー番号の組 or null]）。1周ぶんを繰り返す。
  const backward = [
    [layout.S, null],
    [layout.C34, [4, 3]],
    [layout.B, null],
    [layout.C12, [2, 1]],
    [layout.F, null],
  ];
  const out = [];
  let end = distance; // 今見ている区間の終わり（レースの座標）
  for (let guard = 0; end > 0 && guard < 50; guard += 1) {
    const [len, corners] = backward[guard % backward.length];
    const start = end - len;
    if (corners) {
      // 180度を90度ずつ2つに分ける（後ろ半分が番号の大きいコーナー）。
      const half = len / 2;
      const pieces = [
        { from: end - half, to: end, corner: corners[0] },
        { from: start, to: end - half, corner: corners[1] },
      ];
      for (const p of pieces) {
        if (p.to <= 0) continue;
        const from = Math.max(0, p.from);
        out.push({ from, to: p.to, angle: QUARTER * ((p.to - from) / (p.to - p.from)), corner: p.corner, partial: p.from < 0 });
      }
    }
    end = start;
  }
  return out.sort((a, b) => a.from - b.from);
}

const cache = new Map();

/**
 * そのレースのコースの形。
 * @param {string} courseId - `data/courses.js`のid（JRA10場以外は一般形の仮）
 * @param {"turf"|"dirt"} surface
 * @param {number} distance - m
 * @returns {{ key:string, loop:string, distance:number, corners:{from:number,to:number,angle:number,corner:number}[],
 *   width:{min:number,max:number}, finalStraight:number, provisional:string[], startFact:object|null }}
 */
export function courseShapeFor(courseId, surface, distance) {
  const key = `${courseId}:${surface}:${distance}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let shape;
  if (courseId === "niigata" && surface === "turf" && distance <= 1000) {
    // 新潟の芝直線1000m（J1新「国内初となる直線コース」）。コーナー無し。
    shape = {
      key, loop: "straight", distance, corners: [], width: { min: 25, max: 25 }, finalStraight: distance,
      provisional: [], startFact: null,
    };
  } else {
    const { loop, guessed } = loopFor(courseId, surface, distance);
    const layout = LAYOUTS[`${courseId}:${surface}:${loop}`] ?? GENERIC_LAYOUT;
    const fact = START_FACTS[key] ?? null;
    let corners = walkCorners(layout, distance);
    if (fact?.pocket) {
      // ポケット発走：発走地点に掛かるコーナーの切れ端は走らない。
      corners = corners.filter((c) => !c.partial);
    }
    if (fact?.firstCorner) {
      // 引き込み線が本線に合流するまでのコーナーは走らない。最初に走るコーナーの番号（出典の記述）から先だけ残す。
      const at = corners.findIndex((c) => c.corner === fact.firstCorner);
      if (at > 0) corners = corners.slice(at);
    }
    shape = {
      key,
      loop,
      distance,
      corners: corners.map(({ from, to, angle, corner }) => Object.freeze({ from, to, angle, corner })),
      width: { min: layout.width[0], max: layout.width[1] },
      finalStraight: Math.min(layout.S, distance),
      provisional: [...(layout.provisional ?? []), ...(guessed ? ["loop"] : []), ...(layout === GENERIC_LAYOUT ? ["generic"] : [])],
      startFact: fact,
    };
  }
  Object.freeze(shape.corners);
  Object.freeze(shape);
  cache.set(key, shape);
  return shape;
}

/** 競馬場の分からないレース（計測の道具・地方・海外）に使う一般形（仮）。 */
export function genericCourseShape(distance) {
  return courseShapeFor("generic", "turf", distance);
}

/** 突き合わせの道具用（`tools/check-course-shapes.mjs`）。 */
export const COURSE_LAYOUTS = LAYOUTS;
export const COURSE_START_FACTS = START_FACTS;
