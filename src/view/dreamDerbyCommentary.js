// 夢のダービー：実況テキストの組み立て（JSX・DOM無し、純関数のみ）。
// dream-derby-mock2.html（合意済みモック）のfieldOrder/fmtTime/commentaryVars/sayを移植。
// ⚠️`say()`のDOM書き込み（pushMessage）はscreens/dreamDerbyEngine.jsへ分離し、
// ここには「どの行を選び、どう埋めるか」のテキスト決定だけを残す。
// ⚠️`commentaryVars`のうち、モックが持っていた未使用キー`time`（実際の結果と無関係な
// 固定文字列"2分24秒0"）は削除した——どのCOMMENTARYテンプレートも参照しておらず、
// 実装では本物のゴールタイムが`runDreamDerbyRace`から得られるため、無関係な固定値を
// 残すとかえって誤解を招く（CLAUDE.md §5「死んでいるコードは削除」）。

import { COMMENTARY } from "../data/dreamDerbyCommentary.js";
import { TOTAL_DISTANCE } from "../data/dreamDerbyCourse.js";
import { viewHash01, distanceAtTime, timeAtDistance } from "./dreamDerbyRace.js";

/** 経過秒→「m分s秒」表記（実況の通過タイム表示用）。 */
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s2 = sec - m * 60;
  return m > 0 ? `${m}分${s2.toFixed(1).replace(".", "秒")}` : `${s2.toFixed(1).replace(".", "秒")}`;
}

/** 実況欄のタイムスタンプ表記（"m:ss"）。発走前（t<=0）は空文字。 */
export function fmtStamp(t) {
  if (t <= 0) return "";
  const min = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/**
 * 現在時刻tでの着順（距離降順）。
 * @param {Array<{num:number,name:string,isSelf:boolean}>} entries
 * @param {(num:number) => number} distanceOfNum - 馬番→現在距離(m)
 */
export function fieldOrder(entries, distanceOfNum) {
  return entries
    .map((e) => ({ e, d: distanceOfNum(e.num) }))
    .sort((a, b) => b.d - a.d)
    .map((x) => x.e);
}

/**
 * 現在順位から判断カードの位置区分を決める（ARCHITECTURE.md §12「判断カードは位置で分ける」）。
 * 頭数固定（18頭）にせず、そのレースの頭数に対する相対順位で区切る。
 * 10頭未満（このレースでは起きないが将来の再利用に備える）は区切りを狭める。
 * @param {number} rank - 1始まりの現在順位
 * @param {number} fieldSize - 出走頭数
 * @returns {"lead"|"front"|"mid"|"rear"}
 */
export function positionBandOf(rank, fieldSize) {
  if (rank <= 1) return "lead";
  if (fieldSize < 10) {
    if (rank <= 3) return "front";
    if (rank > fieldSize - 2) return "rear";
    return "mid";
  }
  if (rank <= 4) return "front";
  if (rank > fieldSize - 4) return "rear";
  return "mid";
}

/**
 * 判断カードの状況欄に出す事実だけの文言（ARCHITECTURE.md §12「状況の文は書かない」）。
 * 形容・推測は付けない。先頭のときだけ「先頭」、それ以外は「N番手」。
 * ⚠️内外（レーン）は出さない——`view/dreamDerbyRace.js`の`laneY`は着順と無関係な
 * 演出専用の乱数で、自分の馬は常に画面中央固定（0.47）のため、内外を区別する材料が無い。
 * @param {"lead"|"front"|"mid"|"rear"} band
 * @param {number} rank - 1始まりの現在順位
 */
export function positionLabelFor(band, rank) {
  return band === "lead" ? "先頭" : `${rank}番手`;
}

/**
 * 実況テンプレートの{placeholder}を埋めるための変数一式。
 * @param {number} t - 経過秒
 * @param {object} ctx
 * @param {Array<{num:number,name:string,isSelf:boolean}>} ctx.entries
 * @param {{num:number,name:string}} ctx.selfEntry
 * @param {(num:number) => number} ctx.distanceOfNum
 */
export function commentaryVars(t, { entries, selfEntry, distanceOfNum }) {
  const order = fieldOrder(entries, distanceOfNum);
  const rank = order.findIndex((e) => e.isSelf) + 1;
  const name = (i) => (order[i] ? order[i].name : "");
  const leaderD = distanceOfNum(order[0].num);
  const gapM = leaderD - distanceOfNum(selfEntry.num);
  const gapWord =
    gapM < 0.5 ? "クビ" :
    gapM < 2.4 ? "1馬身" :
    gapM < 4.8 ? "2馬身" :
    gapM < 9.6 ? `${Math.round(gapM / 2.4)}馬身` : "大きく";
  return {
    self: selfEntry.name, selfNum: String(selfEntry.num), selfRank: String(rank),
    leader: name(0), second: name(1), third: name(2), fourth: name(3), last: name(order.length - 1),
    order5: order.slice(0, 5).map((e) => e.name).join("、"),
    field: String(entries.length),
    remain: String(Math.max(0, Math.round(TOTAL_DISTANCE - distanceAtTime(t)))),
    split1000: fmtTime(timeAtDistance(1000)),
    gap: gapWord, winner: selfEntry.name,
    chaser: name(1), outsider: name(2), insider: name(3),
    // 発走前の紹介用：馬番順の先頭6頭（「1番〇〇、2番〇〇…」）と大外の馬
    lineup6: entries.slice(0, 6).map((e) => `${e.num}番${e.name}`).join("、"),
    lastNum: String(entries[entries.length - 1].num), lastName: entries[entries.length - 1].name,
  };
}

/**
 * 実況スロットから1行選び、変数を埋め込んだテキストを返す。プールが無ければnull。
 * @param {string} slot - "start"等の単純スロット、または"choiceReact.holdInside"のような複合スロット
 * @param {object} vars - commentaryVarsの返り値（必要ならextraVarsをObject.assignして渡す）
 * @param {number} sayCount - これまでにsayを呼んだ回数（行選択の疑似乱数シード）
 */
export function pickCommentaryLine(slot, vars, sayCount) {
  const pool = slot.indexOf(".") >= 0 ? COMMENTARY.choiceReact[slot.split(".")[1]] : COMMENTARY[slot];
  if (!pool || pool.length === 0) return null;
  const line = pool[Math.floor(viewHash01(sayCount * 7.31 + 0.5) * pool.length) % pool.length];
  return line.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
