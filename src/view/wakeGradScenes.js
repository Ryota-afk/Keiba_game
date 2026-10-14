// 夢から覚めた後の3場面の絵（目覚めの部屋・名前入力の校門・卒業式の壇上）。
// 130×100マスの方眼にドット絵として描き、SVGのマークアップ文字列を返す（JSX・DOM無し、純関数のみ）。
// `design/mocks/wake-room-v1.html`案C・`grad-school-v1.html`案C・`grad-ceremony-v1.html`案Aを
// 2026-09-20にユーザーが選び、`design/mocks/wake-grad-scenes.js`（原型）から移した。
// 馬の形は`view/dreamDerbySprite.js`のレース画面の馬と共有する（HORSE_TAIL／HORSE_LEGS／HORSE_BODY）。
// 130:100は390×300の枠と同じ比。枠の比が違うときは`xMidYMid slice`で中央を残して端を切る。

import { HORSE_TAIL, HORSE_LEGS, HORSE_BODY, HORSE_HOOF_COLOR, HORSE_EYE_COLOR } from "./dreamDerbySprite.js";

export const SCENE_COLS = 130;
export const SCENE_ROWS = 100;

// ===== 色（1文字＝1色。文字地図で使う） =====
const C = {
  k: "#2a2119", // 輪郭
  f: "#f0c8a0", // 肌
  h: "#3a2a1a", // 髪（茶）
  H: "#1c1712", // 髪（黒）
  w: "#f5f1e4", // 白い布
  n: "#2b3d55", // 学生服の紺
  a: "#7f97a6", // 母のブラウス
  s: "#4a4a52", // 背広
  r: "#c8322e", // 赤
  b: "#8a5a2b", // 馬体（鹿毛）
  d: "#5c3a1c", // 馬体の濃い所（たてがみ・尾）
  p: "#f3b7c8", // 桜
  P: "#e58aa6", // 桜の濃い所
  t: "#c9d6e8", // 掛け布団
  T: "#a9bbd6", // 掛け布団の影
  y: "#ffd83d", // 黄（校旗の紋）
};

// ===== 文字地図のスプライト =====
const SPR = {
  mother: [
    "..khhhhk..",
    ".khhhhhhk.",
    ".khhhhhhk.",
    ".kffffffk.",
    ".kffffffk.",
    ".kfkffkfk.",
    ".kffffffk.",
    "..kfkkfk..",
    "...kffk...",
    ".kkwaawkk.",
    "kwwkwwkwwk",
    "kwwkwwkwwk",
    "kwwkwwkwwk",
    "kffkwwkffk",
    "..kwwwwk..",
    "..kwwwwk..",
    "..kwwwwk..",
    "..kwwwwk..",
    "..knnnnk..",
    "..knnknnk.",
    "..kkk.kkk.",
  ],
  student: [
    "..kHHHHk..",
    ".kHHHHHHk.",
    ".kHHHHHHk.",
    ".kHfHfHHk.",
    ".kffffffk.",
    ".kfkffkfk.",
    ".kffffffk.",
    "..kffffk..",
    "...kffk...",
    ".kknwwnkk.",
    "knnknnknnk",
    "knnknnknnk",
    "knnknnknnk",
    "kffknnkffk",
    "...knnk...",
    "..knnnnk..",
    "..knnnnk..",
    "..knnknnk.",
    "..knnknnk.",
    "..kkk.kkk.",
  ],
  studentBack: [
    "..kHHHHk..",
    ".kHHHHHHk.",
    ".kHHHHHHk.",
    ".kHHHHHHk.",
    ".kHHHHHHk.",
    "..kHHHHk..",
    "...kffk...",
    ".kknnnnkk.",
    "knnknnknnk",
    "knnknnknnk",
    "knnknnknnk",
    "kffknnkffk",
    "...knnk...",
    "..knnnnk..",
    "..knnnnk..",
    "..knnknnk.",
    "..knnknnk.",
    "..kkk.kkk.",
  ],
  instructor: [
    "..khhhhk..",
    ".khhhhhhk.",
    ".khhhhhhk.",
    ".khfffhhk.",
    ".kffffffk.",
    ".kfkffkfk.",
    ".kffffffk.",
    "..kffffk..",
    "...kffk...",
    ".kkswrskk.",
    "kssksrkssk",
    "kssksskssk",
    "kssksskssk",
    "kffksskffk",
    "...kssk...",
    "..kssssk..",
    "..kssssk..",
    "..ksskssk.",
    "..ksskssk.",
    "..kkk.kkk.",
  ],
  clock: [
    "..kkkkk..",
    ".kwwwwwk.",
    "kwwwkwwwk",
    "kwwwkwwwk",
    "kwwwkwwwk",
    "kwwkwwwwk",
    "kwkwwwwwk",
    ".kwwwwwk.",
    "..kkkkk..",
  ],
  hinomaru: [
    "wwwwwwwwww",
    "wwwwrrwwww",
    "wwwrrrrwww",
    "wwwrrrrwww",
    "wwwwrrwwww",
    "wwwwwwwwww",
  ],
  sakura: [
    ".....kkkkkk.....",
    "...kkppppppkk...",
    "..kppppwppppppk.",
    ".kpppppppPppppk.",
    "kppwppppppppppPk",
    "kpppppPpppwppppk",
    "kPpppppppppppppk",
    "kppppPppppPppppk",
    ".kpppppppppppPk.",
    ".kkPpppppppppkk.",
    "...kkppppppkk...",
    ".....kkddkk.....",
    "......kddk......",
    "......kddk......",
    ".....kddddk.....",
  ],
  // 学校の紋（馬の頭の影絵。門柱の上に載せる）
  crest: [
    ".k...k.",
    "kdk.kdk",
    "kdddddk",
    ".kdddk.",
    ".kdddk.",
    "..kkk..",
  ],
};

// ===== 描画の道具 =====
function painter() {
  const parts = [];
  const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
  return {
    // 単色の矩形（マス単位）
    r(x, y, w, h, c) {
      parts.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${c}"/>`);
    },
    poly(points, c) {
      parts.push(`<polygon points="${points.map(([px, py]) => `${num(px)},${num(py)}`).join(" ")}" fill="${c}"/>`);
    },
    ell(cx, cy, rx, ry, c) {
      parts.push(`<ellipse cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" fill="${c}"/>`);
    },
    // 文字地図のスプライト。scaleでマスの大きさを変える
    s(name, x, y, opt = {}) {
      const map = SPR[name];
      const sc = opt.scale || 1;
      const w = map[0].length;
      for (let j = 0; j < map.length; j++) {
        for (let i = 0; i < w; i++) {
          const ch = map[j][i];
          if (ch === ".") continue;
          this.r(x + i * sc, y + j * sc, sc, sc, C[ch]);
        }
      }
    },
    // レース画面と同じ形の馬（`view/dreamDerbySprite.js`の40×36・右向き。脚は立ち姿）
    horse(x, y, opt = {}) {
      const sc = opt.scale || 1;
      const fill = { coat: opt.coat || C.b, dark: opt.dark || C.d, eye: HORSE_EYE_COLOR };
      const put = (c, rx, ry, rw, rh) => this.r(x + (opt.flip ? 40 - rx - rw : rx) * sc, y + ry * sc, rw * sc, rh * sc, c);
      for (const [role, rx, ry, rw, rh] of HORSE_TAIL) put(fill[role], rx, ry, rw, rh);
      for (const [lx, ly, lw, lh] of HORSE_LEGS) {
        put(fill.coat, lx, ly, lw, lh);
        put(HORSE_HOOF_COLOR, lx, ly + lh - 1.5, lw, 2);
      }
      for (const [role, rx, ry, rw, rh] of HORSE_BODY) put(fill[role], rx, ry, rw, rh);
    },
    svg() {
      return (
        `<svg viewBox="0 0 ${SCENE_COLS} ${SCENE_ROWS}" preserveAspectRatio="xMidYMid slice" ` +
        `shape-rendering="crispEdges" aria-hidden="true">${parts.join("")}</svg>`
      );
    },
  };
}

// ===== 共通の部品 =====
// 学校の校舎（横長の連続窓・2階建て・玄関のひさし・屋上の時計）
function schoolBuilding(p, x, y, w) {
  const h = 34;
  p.r(x - 2, y, w + 4, 3, "#8a8378"); // 屋上のふち
  p.r(x, y + 3, w, h - 3, "#e3dccb"); // 壁
  p.r(x, y + 15, w, 2, "#c9c0ad"); // 階の境の横帯
  p.r(x, y + h - 3, w, 3, "#c9c0ad"); // 基礎の帯
  // 連続窓（2階・1階）。窓枠は物の縦成分なので縦線の決まりの対象外
  for (const wy of [y + 6, y + 19]) {
    p.r(x + 4, wy, w - 8, 7, "#b9cad6");
    p.r(x + 4, wy + 3, w - 8, 1, "#e3dccb");
    for (let i = x + 4; i < x + w - 4; i += 8) p.r(i + 7, wy, 1, 7, "#e3dccb");
  }
  // 玄関（真ん中）とひさし
  const dx = x + Math.floor(w / 2) - 6;
  p.r(dx, y + 21, 12, 10, "#e3dccb");
  p.r(dx + 1, y + 22, 10, 9, "#3b2f24");
  p.r(dx - 3, y + 18, 18, 3, "#8a8378");
  // 屋上の時計塔
  const cx = x + Math.floor(w / 2);
  p.r(cx - 7, y - 10, 14, 10, "#e3dccb");
  p.r(cx - 8, y - 11, 16, 2, "#8a8378");
  p.s("clock", cx - 4, y - 9);
}
function cloud(p, x, y, w) {
  p.r(x, y + 2, w, 3, "#ffffff");
  p.r(x + 3, y, w - 6, 2, "#ffffff");
  p.r(x + 1, y + 5, w - 2, 1, "#ffffff");
}
function sky(p, y1, y2) {
  p.r(0, y1, SCENE_COLS, y2 - y1, "#8fc6e0");
  p.r(0, y1, SCENE_COLS, Math.floor((y2 - y1) / 2), "#7fb8d8");
}
// 窓の外（朝日・丘・放牧地の柵）。x,y,w,hは窓ガラスの内側
function outside(p, x, y, w, h) {
  p.r(x, y, w, h, "#a8daf2");
  p.r(x, y, w, Math.floor(h * 0.3), "#96cfee");
  // 朝日
  p.r(x + 4, y + 3, 5, 5, "#fff0a0");
  p.r(x + 5, y + 2, 3, 7, "#fff0a0");
  p.r(x + 3, y + 4, 7, 3, "#fff0a0");
  // 遠くの丘（2段）
  p.poly([[x, y + h * 0.55], [x + w * 0.35, y + h * 0.38], [x + w * 0.7, y + h * 0.5], [x + w, y + h * 0.42], [x + w, y + h], [x, y + h]], "#8fbf6a");
  p.poly([[x, y + h * 0.66], [x + w * 0.5, y + h * 0.56], [x + w, y + h * 0.64], [x + w, y + h], [x, y + h]], "#6faa50");
  // 放牧地の柵（横木2本と短い柱）
  const fy = y + h * 0.78;
  p.r(x, fy, w, 1, "#f5f1e4");
  p.r(x, fy + 3, w, 1, "#f5f1e4");
  for (let i = x + 2; i < x + w; i += 7) p.r(i, fy - 1, 1, 6, "#f5f1e4");
}

// ===== ① 目覚めの部屋（案C：布団の中から見上げる。天井・覗き込む母・窓の明かり） =====
export function roomSceneMarkup() {
  const p = painter();
  // 天井板（横目）
  p.r(0, 0, SCENE_COLS, 58, "#d9c39a");
  for (let y = 8; y < 58; y += 12) p.r(0, y, SCENE_COLS, 2, "#b99a6a");
  // 天井の照明（丸い蛍光灯とひも）
  p.ell(64, 18, 22, 8, "#f2ede0");
  p.ell(64, 18, 16, 5, "#fff7dc");
  p.r(63, 26, 2, 12, "#9c9488");
  p.r(62, 38, 4, 3, "#c8322e");
  // 壁（天井との境に回り縁）
  p.r(0, 58, SCENE_COLS, 42, "#dccaa2");
  p.r(0, 58, SCENE_COLS, 3, "#5a3d20");
  // 窓（朝の光。布団のふちに隠れる）
  p.r(0, 62, 34, 30, "#f2ede0");
  outside(p, 0, 64, 31, 26);
  p.r(15, 64, 2, 26, "#f2ede0");
  // 覗き込む母（顔が大きい。天井まで頭が入る）
  p.s("mother", 72, 26, { scale: 3.4 });
  // 手前：自分の掛け布団のふち
  p.r(0, 84, SCENE_COLS, 16, C.t);
  p.r(0, 84, SCENE_COLS, 4, "#f5f1e4");
  p.r(0, 92, SCENE_COLS, 1, C.T);
  return p.svg();
}

// ===== ② 名前入力の建物（案C：校門と桜。門柱の奥に校舎、生徒が門を入る） =====
export function schoolSceneMarkup() {
  const p = painter();
  sky(p, 0, 50);
  cloud(p, 50, 6, 24);
  p.r(0, 46, SCENE_COLS, 30, "#57a24b"); // 芝
  schoolBuilding(p, 40, 14, 50);
  p.r(56, 48, 18, 28, "#d8c9a6"); // 校舎までの砂利道
  p.horse(111, 40, { scale: 0.4 }); // 遠くの放牧の馬
  p.r(0, 76, SCENE_COLS, 24, "#8a8a86"); // 道路
  p.r(0, 88, SCENE_COLS, 1, "#f5f1e4");
  // 門柱（石積み・横目地）
  for (const gx of [22, 96]) {
    p.r(gx, 36, 12, 44, "#c9c0ad");
    for (let gy = 40; gy < 80; gy += 6) p.r(gx, gy, 12, 1, "#a19a8a");
    p.r(gx - 1, 34, 14, 2, "#8a8378");
    p.s("crest", gx + 2, 27);
  }
  p.r(23, 44, 10, 16, "#f5f1e4"); // 表札（文字は読めない大きさの彫り）
  for (const ty of [47, 50, 53, 56]) p.r(25, ty, 6, 1, "#8a8378");
  // 桜
  p.s("sakura", 0, 20);
  p.s("sakura", 110, 20);
  for (const [px, py] of [[10, 80], [30, 90], [50, 84], [90, 94], [110, 82], [120, 90], [70, 78]]) p.r(px, py, 1, 1, C.p);
  // 門を入る生徒（学生服・かばん）
  p.s("student", 60, 62);
  p.r(69, 76, 5, 4, "#5a3d20");
  return p.svg();
}

// ===== ③ 卒業式（案A：講堂の壇上。紅白幕・日の丸と校旗・演台・前に立つ本人・後ろに椅子の列） =====
export function ceremonySceneMarkup() {
  const p = painter();
  p.r(0, 0, SCENE_COLS, SCENE_ROWS, "#efe8d3");
  p.r(0, 0, SCENE_COLS, 6, "#3b2f24"); // 天井の際
  // 紅白幕（幕そのものの縞。仕切りの縦線ではない）
  for (let x = 0; x < SCENE_COLS; x += 16) {
    p.r(x, 6, 8, 34, "#c8322e");
    p.r(x + 8, 6, 8, 34, "#f5f1e4");
  }
  p.r(0, 6, SCENE_COLS, 2, "#2a2119");
  // 壇（前面と上面）
  p.r(0, 40, SCENE_COLS, 12, "#d8b96a");
  p.r(0, 52, SCENE_COLS, 6, "#8a6a44");
  p.r(0, 58, SCENE_COLS, 1, "#5a3d20");
  // 旗（日の丸と校旗）
  p.r(16, 14, 1, 28, "#9c9488");
  p.s("hinomaru", 17, 15);
  p.r(112, 14, 1, 28, "#9c9488");
  p.r(103, 15, 9, 6, "#3a5a3a");
  p.r(106, 17, 3, 2, C.y);
  // 演台と教官
  p.s("instructor", 60, 18);
  p.r(52, 32, 26, 16, "#7d5730");
  p.r(50, 30, 30, 3, "#a5824e");
  p.r(60, 33, 10, 2, "#f5f1e4"); // 卒業証書
  // 床（板の横目）
  p.r(0, 59, SCENE_COLS, 41, "#c9a874");
  for (let y = 66; y < SCENE_ROWS; y += 8) p.r(0, y, SCENE_COLS, 1, "#b8956a");
  // 本人（壇の前に立つ・後ろ姿）
  p.s("studentBack", 60, 54);
  // 椅子の列に座る同期（後ろ姿）
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3; i++) {
      for (const side of [10, 80]) {
        const x = side + i * 14;
        const y = 72 + row * 14;
        p.s("studentBack", x, y - 12);
        p.r(x - 1, y, 12, 6, "#5a3d20"); // 椅子の背
      }
    }
  }
  return p.svg();
}
