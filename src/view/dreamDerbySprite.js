// 夢のダービー：馬＋騎手のドット絵風SVGマークアップと配色決定（JSX・DOM無し、純関数のみ）。
// dream-derby-mock2.html（合意済みモック）のhorseSvg/leg/legPose/coatFor/silkFor/frameForを移植。

import { viewHash01 } from "./dreamDerbyRace.js";
import { COAT_COLORS, WAKU_COLORS, FRAME_SIZES, SILK_COLORS, SELF_SILK_COLOR } from "../data/dreamDerbyVisuals.js";

/** 馬番から馬体色を決める（演出専用のハッシュ。結果には影響しない）。 */
export function coatFor(num) {
  const i = Math.floor(viewHash01(num * 31 + 5) * COAT_COLORS.length);
  return COAT_COLORS[Math.min(i, COAT_COLORS.length - 1)];
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

// 脚1本＝股関節から下に伸びる矩形＋蹄。角度は時計回りが正（右向きの馬では脚先が後ろへ）。
function leg(x, y, w, h, angle, px, py) {
  return `<g transform="rotate(${angle} ${px} ${py})"><rect class="coat" x="${x}" y="${y}" width="${w}" height="${h}"/>` +
    `<rect fill="#221a14" x="${x}" y="${y + h - 1.5}" width="${w}" height="2"/></g>`;
}

function legPose(cls, hind1, hind2, front1, front2) {
  return `<g class="${cls}">` +
    leg(7, 23, 4, 9, hind1, 9, 23) + leg(11, 23, 3, 8, hind2, 12.5, 23) +
    leg(21, 23, 4, 9, front1, 23, 23) + leg(25, 23, 3, 8, front2, 26.5, 23) +
    `</g>`;
}

/**
 * ドット絵風の馬＋騎手のSVGマークアップ（20×18マス相当。viewBox 40×36、右向き）。
 * 脚は3コマ（伸び→浮き→畳み。CSS側の`steps()`アニメーションで切り替える）。
 * @param {{num:number}} entry
 */
export function horseSvgMarkup(entry) {
  const r = rect;
  return `<svg class="hs-svg" viewBox="0 0 40 36" aria-hidden="true">` +
    `<ellipse class="hs-shadow" cx="19" cy="34" rx="15" ry="3"/>` +
    `<ellipse class="hs-ring" cx="19" cy="34" rx="17" ry="4.5"/>` +
    `<g class="hs-body-g">` +
    // 尻尾
    r("coat-dark", 2, 13, 4, 9) + r("coat-dark", 1, 20, 3, 3) +
    // 脚：股関節（後=9,23 / 前=23,23）を軸に回転させた3コマ。伸び→浮き→畳み
    legPose("f1", 42, 26, -42, -26) + legPose("f2", 6, -4, -6, 4) + legPose("f3", -32, -16, 32, 16) +
    // 胴・首・頭
    r("coat", 5, 13, 22, 11) + r("coat-dark", 7, 22, 18, 2) +
    r("coat", 24, 7, 7, 10) + r("coat", 27, 5, 6, 6) +
    r("coat-dark", 24, 5, 4, 5) + r("coat-dark", 22, 9, 3, 3) +
    r("coat", 30, 6, 9, 7) + r("coat-dark", 36, 9, 4, 4) + r("coat-dark", 30, 3, 3, 3) +
    `<rect fill="#111" x="34" y="8" width="2" height="2"/>` +
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
