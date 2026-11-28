// 夢のダービー：馬＋騎手のドット絵風SVGマークアップと配色決定（JSX・DOM無し、純関数のみ）。
// 騎手・脚の3コマ・枠・勝負服はdream-derby-mock2.html、馬の形と毛色・白い模様は
// design/mocks/horse-sprite-v1.html案C（2026-11-28にユーザーが選んだ）を移植。

import { viewHash01 } from "./dreamDerbyRace.js";
import {
  COAT_PALETTE, COAT_HI_MIX, GRAY_COAT, LEGACY_COAT_IDS, MARKING_WHITE, NOSE_PINK, PALE_HOOF_COLOR,
  HOOF_COLOR, EYE_COLOR, WAKU_COLORS, FRAME_SIZES, SILK_COLORS, SELF_SILK_COLOR,
} from "../data/dreamDerbyVisuals.js";

/** 2色を混ぜる（"#rrggbb"どうし。t=0でa、t=1でb）。 */
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** 馬に`coat`が無いときの毛色（馬番から昔の5色のどれかを決める。演出専用のハッシュ）。 */
export function legacyCoatIdFor(num) {
  const i = Math.floor(viewHash01(num * 31 + 5) * LEGACY_COAT_IDS.length);
  return LEGACY_COAT_IDS[Math.min(i, LEGACY_COAT_IDS.length - 1)];
}

/** 芦毛の色：年齢で濃い側から白い側へ混ぜる。元が栗毛系（`coatGenes.e === 0`）なら赤みの灰。 */
function grayPalette(age, coatGenes) {
  const G = GRAY_COAT;
  const t = Math.max(0, Math.min(1, (age - G.youngAge) / (G.whiteAge - G.youngAge)));
  const dark = coatGenes && coatGenes.e === 0 ? G.red : G.plain;
  const body = mixHex(dark.body, G.whiteBody, t);
  const mane = mixHex(dark.mane, G.whiteMane, t);
  return {
    body,
    shade: mixHex(mixHex(dark.body, "#000000", G.shadeDarken), G.whiteShade, t),
    mane,
    tail: mane,
    leg: t < G.legUntil ? mixHex(dark.mane, body, t) : null,
    muzzle: G.muzzle,
    hi: mixHex(body, "#ffffff", G.hiMix),
    hoof: HOOF_COLOR,
    dapple: t < G.dappleUntil ? mixHex(body, "#ffffff", G.dappleMix) : null,
  };
}

/**
 * 馬の見た目から、絵の各部分の色を決める。
 * @param {{coat?:string, coatGenes?:{e:number}, age?:number}} look - `coat`は`data/coat.js`の`COAT_IDS`。
 *   `age`は芦毛の白さにだけ使う（無ければ3歳）。知らない毛色は鹿毛として描く。
 * @returns {{body:string, shade:string, mane:string, tail:string, leg:string|null, muzzle:string,
 *   hi:string, hoof:string, dapple:string|null}}
 */
export function coatPaletteFor(look) {
  if (look.coat === "gray") return grayPalette(look.age ?? 3, look.coatGenes);
  const p = COAT_PALETTE[look.coat] || COAT_PALETTE.bay;
  return {
    ...p,
    hi: p.hi || mixHex(p.body, "#ffffff", p.hiMix ?? COAT_HI_MIX),
    hoof: p.hoof || HOOF_COLOR,
    dapple: null,
  };
}

/**
 * 出走馬1頭の見た目（毛色・白い模様・年齢）を取り出す。
 * 年齢は`entry.age`、無ければ`entry.raceYear − horse.bornYear`、それも無ければ3歳。
 * `horse.coat`が無い馬は馬番から昔の5色のどれかにする。
 */
export function lookForEntry(entry) {
  const h = entry.horse || {};
  const age = entry.age ?? (entry.raceYear != null && h.bornYear != null ? entry.raceYear - h.bornYear : 3);
  return {
    coat: h.coat || legacyCoatIdFor(entry.num),
    coatGenes: h.coatGenes,
    age,
    face: h.markings?.face || "none",
    legs: h.markings?.legs || [0, 0, 0, 0],
  };
}

/** 馬番から枠番(0-indexed)を決める（[2,2,2,3,3,2,2,2]の均等割り）。 */
export function frameFor(num) {
  let acc = 0;
  for (let f = 0; f < FRAME_SIZES.length; f++) {
    acc += FRAME_SIZES[f];
    if (num <= acc) return f;
  }
  return FRAME_SIZES.length - 1;
}

/** 勝負服の色。自分の馬は固定でマゼンタ。 */
export function silkFor(entry) {
  if (entry.isSelf) return SELF_SILK_COLOR;
  return SILK_COLORS[Math.floor(viewHash01(entry.num * 13 + 9) * SILK_COLORS.length) % SILK_COLORS.length];
}

function rect(cls, x, y, w, h) {
  return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
}

// ===== 馬の形（40×36マス・右向き）。レース画面と、目覚め〜卒業式の背景（`view/wakeGradScenes.js`）が
// 同じ形を共有する。⚠️ここを変えると両方の馬が変わる。
// 形は`design/mocks/horse-sprite-v1.html`案C（頭＝28..39×4..13、鼻先＝35..40×8..13、目＝33,7）。
// 役割は body／shade／mane／tail／muzzle／hi（`coatPaletteFor`の返り値のキー）。 =====
export const HORSE_HOOF_COLOR = HOOF_COLOR;
export const HORSE_EYE_COLOR = EYE_COLOR;
/** 尻尾（脚より先に描く）。[役割, x, y, w, h]。 */
export const HORSE_TAIL = [
  ["tail", 2, 13, 4, 9],
  ["tail", 1, 20, 3, 3],
];
/**
 * 脚4本（立ち姿のとき）。[x, y, w, h, 股関節x, 股関節y, `markings.legs`の添字]。蹄は各脚の下端1.5マスから高さ2。
 * ⚠️左右（CLAUDE.md §6）：馬は右向き＝見えているのは馬の右側。太く長い脚（幅4・高さ9、x=7とx=21）が
 * 手前＝右脚、細く短い脚（幅3・高さ8、x=11とx=25）が奥＝左脚。x=21・25が前脚（頭の側）。
 * `markings.legs`＝[左前, 右前, 左後, 右後]なので、並び順に 3（右後）・2（左後）・1（右前）・0（左前）。
 */
export const HORSE_LEGS = [
  [7, 23, 4, 9, 9, 23, 3],
  [11, 23, 3, 8, 12.5, 23, 2],
  [21, 23, 4, 9, 23, 23, 1],
  [25, 23, 3, 8, 26.5, 23, 0],
];
/** 脚の下半分（鹿毛の仲間と若い芦毛が黒く塗る所）の高さ。脚の下端から。 */
export const HORSE_LEG_LOW = 4.5;
/** 脚の白の高さ（マス）。添字＝`markings.legs`の値（0=白なし・1=微白・2=中・3=長白）。蹄の上端から上へ。 */
export const HORSE_SOCK_HEIGHT = [0, 1.5, 3.2, 5.5];
/** 胴・腹の影・背の明るい線（脚より後に描く）。[役割, x, y, w, h]。 */
export const HORSE_BODY = [
  ["body", 5, 13, 22, 11],
  ["shade", 7, 22, 18, 2],
  ["hi", 6, 13, 6, 1.5],
];
/** 芦毛の斑（腰に3つ・肩に2つ。胴の後・首の前に描く）。[x, y, w, h]。 */
export const HORSE_DAPPLES = [
  [7, 15.5, 2, 2], [10, 18, 1.5, 1.5], [6.5, 19.5, 1.5, 1.5], [23, 14, 1.5, 1.5], [24.5, 17, 2, 2],
];
/** 首・たてがみ・頭・鼻先・耳・頬の明るい線（胴の後に描く）。[役割, x, y, w, h]。 */
export const HORSE_HEAD = [
  ["body", 24, 7, 7, 10],
  ["body", 27, 4, 6, 7],
  ["mane", 24, 4, 4, 6],
  ["mane", 22, 9, 3, 3],
  ["body", 28, 4, 11, 9],
  ["muzzle", 35, 9, 5, 4],
  ["body", 35, 8, 5, 1.5],
  ["shade", 28, 1, 3, 3],
  ["hi", 29, 10.5, 5, 1.2],
];
/** 目（顔の白より後に描く）。[x, y, w, h]。 */
export const HORSE_EYE = [33, 7, 2, 2];
/** 顔の白7種（頭の後・目の前に描く）。キーは`markings.face`。[x, y, w, h]の並び。 */
export const HORSE_FACE = {
  none: [],
  star: [[31, 4, 2.5, 2]],
  blaze: [[31, 4, 2.5, 2], [33.5, 4, 3, 1.2], [36.5, 4.6, 1.5, 1]],
  strip: [[31, 4, 8, 1.5], [38.5, 5.5, 1.5, 3.5]],
  snip: [[38, 8, 2, 2.5]],
  starSnip: [[31, 4, 2.5, 2], [38, 8, 2, 2.5]],
  bald: [[30.5, 4, 8.5, 3.2], [35, 7.2, 5, 4.3]],
};
/** 白面と白毛の鼻の桃色。[x, y, w, h]。 */
export const HORSE_NOSE_PINK = [38.5, 10.5, 1.5, 2.5];

function fillRect(fill, x, y, w, h) {
  return `<rect fill="${fill}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
}

// 脚1本＝股関節から下に伸びる矩形＋（脚の下半分の濃い色）＋（白）＋蹄。角度は時計回りが正（右向きの馬では脚先が後ろへ）。
function leg([x, y, w, h, px, py, mi], angle, pal, look) {
  const white = HORSE_SOCK_HEIGHT[look.legs[mi]] || 0;
  const hoofTop = y + h - 1.5;
  return `<g transform="rotate(${angle} ${px} ${py})">` + fillRect(pal.body, x, y, w, h) +
    (pal.leg ? fillRect(pal.leg, x, y + h - HORSE_LEG_LOW, w, HORSE_LEG_LOW) : "") +
    (white ? fillRect(MARKING_WHITE, x, hoofTop - white, w, white) : "") +
    fillRect(white ? PALE_HOOF_COLOR : pal.hoof, x, hoofTop, w, 2) + `</g>`;
}

function legPose(cls, pal, look, ...angles) {
  return `<g class="${cls}">` + HORSE_LEGS.map((l, i) => leg(l, angles[i], pal, look)).join("") + `</g>`;
}

/**
 * ドット絵風の馬＋騎手のSVGマークアップ（20×18マス相当。viewBox 40×36、右向き）。
 * 脚は3コマ（伸び→浮き→畳み。CSS側の`steps()`アニメーションで切り替える）。
 * 毛色・顔の白・脚の白・芦毛の白さは`entry.horse`から決める（`lookForEntry`）。色は直接`fill`に書く
 * （CSS変数は勝負服`--silk`と帽子`--cap`だけ）。
 * @param {{num:number, horse?:object, age?:number}} entry
 */
export function horseSvgMarkup(entry) {
  const r = rect;
  const look = lookForEntry(entry);
  const pal = coatPaletteFor(look);
  const part = ([role, x, y, w, h]) => fillRect(pal[role], x, y, w, h);
  const pink = look.face === "bald" || look.coat === "white";
  return `<svg class="hs-svg" viewBox="0 0 40 36" aria-hidden="true">` +
    `<ellipse class="hs-shadow" cx="19" cy="34" rx="15" ry="3"/>` +
    `<ellipse class="hs-ring" cx="19" cy="34" rx="17" ry="4.5"/>` +
    `<g class="hs-body-g">` +
    // 尻尾
    HORSE_TAIL.map(part).join("") +
    // 脚：股関節（後=9,23 / 前=23,23）を軸に回転させた3コマ。伸び→浮き→畳み
    legPose("f1", pal, look, 42, 26, -42, -26) + legPose("f2", pal, look, 6, -4, -6, 4) +
    legPose("f3", pal, look, -32, -16, 32, 16) +
    // 胴 →（芦毛の斑）→ 首・頭 → 顔の白 →（鼻の桃色）→ 目
    HORSE_BODY.map(part).join("") +
    (pal.dapple ? HORSE_DAPPLES.map((d) => fillRect(pal.dapple, ...d)).join("") : "") +
    HORSE_HEAD.map(part).join("") +
    (HORSE_FACE[look.face] || []).map((f) => fillRect(MARKING_WHITE, ...f)).join("") +
    (pink ? fillRect(NOSE_PINK, ...HORSE_NOSE_PINK) : "") +
    fillRect(EYE_COLOR, ...HORSE_EYE) +
    // ゼッケン（青地に白の馬番）
    `<rect fill="#1d3fb0" x="14" y="15" width="7" height="7"/>` +
    `<text x="17.5" y="20.6" font-size="5.5" font-weight="700" font-family="M PLUS 1 Code, monospace" fill="#fff" text-anchor="middle">${entry.num}</text>` +
    // 騎手（ブーツ・勝負服・前傾の上体・腕・帽子・顔）
    `<rect fill="#222" x="12" y="19" width="3" height="5"/>` +
    r("silk", 11, 8, 7, 8) + r("silk", 16, 5, 6, 6) + r("silk", 21, 7, 5, 3) +
    r("cap", 17, 1, 7, 5) + `<rect fill="#f0c8a0" x="23" y="3" width="2" height="3"/>` +
    `</g></svg>`;
}

/** 馬番→枠番の帽色（マーカーチップ・SVGの--cap変数に使う）。 */
export function capColorFor(num) {
  return WAKU_COLORS[frameFor(num)];
}

/** 馬番→歩様アニメーションの位相オフセット（CSSの--ph変数用、秒・負値）。 */
export function gaitPhaseFor(num) {
  return -viewHash01(num * 7 + 3) * 0.24;
}
