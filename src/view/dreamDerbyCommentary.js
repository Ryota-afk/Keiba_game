// 夢のダービー：実況テキストの組み立て（JSX・DOM無し、純関数のみ）。
// dream-derby-mock2.html（合意済みモック）のfieldOrder/fmtTime/commentaryVars/sayを移植。
// ⚠️`say()`のDOM書き込み（pushMessage）はscreens/dreamDerbyEngine.jsへ分離し、
// ここには「どの行を選び、どう埋めるか」のテキスト決定だけを残す。
// ⚠️`commentaryVars`のうち、モックが持っていた未使用キー`time`（実際の結果と無関係な
// 固定文字列"2分24秒0"）は削除した——どのCOMMENTARYテンプレートも参照しておらず、
// 実装では本物のゴールタイムがレースsimから得られるため、無関係な固定値を
// 残すとかえって誤解を招く（CLAUDE.md §5「死んでいるコードは削除」）。
// ⭐2026-09-07（devlog/wave04.md §32）：`pickCommentaryLine`を「条件（`when`）を満たす行だけの
// 中から選ぶ」形に変えた。`COMMENTARY`の各行は{ text, when? }（`data/dreamDerbyCommentary.js`）。
// あわせて`commentaryVars`に条件判定用の変数（`selfBand`/`moverName`等）を追加した。

import { COMMENTARY } from "../data/dreamDerbyCommentary.js";
import { TOTAL_DISTANCE } from "../data/dreamDerbyCourse.js";
import { viewHash01 } from "./dreamDerbyRace.js";

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
 * @param {Array<{num:number,name:string,isSelf:boolean,jockeyName:(string|null),trainerName:(string|null)}>} entries
 *   ⚠️`jockeyName`（2026-09-06追加、もじり名）は2026-09-07から`commentaryVars`の
 *   `moverJockey`/`leaderJockey`がここで返る要素から読む（`fieldOrder`自体は素通しするだけ）。
 * @param {(num:number) => number} distanceOfNum - 指定した時刻での馬番→距離(m)
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
 * ⚠️2026-09-06に`remain`（残り距離）と`split1000`（1000m通過）の出どころを引数へ移した——
 * それまでは全馬共通の仮ペース（`distanceAtTime`／`timeAtDistance`）から計算していたが、
 * レースsimを入れたことで実際の通過距離・通過時刻が取れるようになったため。
 * ⭐2026-09-07（devlog/wave04.md §32）：条件付き実況のための変数を追加した。
 * - `selfBand`：`positionBandOf`の結果をそのまま入れる（`when`条件の「先頭でないとき」等に使う）。
 * - `moverName`/`moverNum`/`moverJockey`/`moverIsSelf`：直近5秒（`t`から`t-5`まで）で
 *   順位を3つ以上上げた馬（無ければ最も上げた馬）。閾値未満なら全部null。`ctx.distanceOfNumAt`
 *   （時刻を指定できる距離関数。フレームごとの差分ではなくsimの時系列から直接引く）が
 *   渡されないとき（未使用の呼び出し元）は常にnull。
 * - `leaderJockey`：現在の先頭馬の`jockeyName`（先頭が自分の馬ならnull＝`entries`が
 *   自分にはjockeyNameを持たせていないことをそのまま利用）。
 * - `leadGap2nd`：先頭と2番手の距離差(m)。「独走」判定（`homage`）・叩き合い判定（`stretchMid`）に使う。
 * - `leadGap`：`leadGap2nd`を「クビ」「1馬身」等の言葉にしたもの（`gap`と同じ換算。2026-09-09追加）。
 * - `remain`：先頭の馬を基準に、100メートル単位に丸めた残り距離
 *   （2026-09-09に自分の馬基準・1メートル単位から直した。`devlog/wave06.md`§65）。
 * - `selfRankNum`：`selfRank`の数値版（文字列の`selfRank`はテンプレート埋め込み専用）。
 * ⚠️`outsider`/`insider`（3番手・4番手の馬名を「内外」と偽って呼んでいた変数）は
 * 2026-09-07に削除した——新しい実況コーパスはどちらも参照しない（実際の内外はsimに無い。
 * devlog/wave04.md §32「変えた理由のある行」）。
 * @param {number} t - 経過秒
 * @param {object} ctx
 * @param {Array<{num:number,name:string,isSelf:boolean,jockeyName:(string|null)}>} ctx.entries
 * @param {{num:number,name:string}} ctx.selfEntry
 * @param {(num:number) => number} ctx.distanceOfNum - 現在時刻tでの馬番→距離(m)
 * @param {(num:number, t:number) => number} [ctx.distanceOfNumAt] - 任意時刻tでの馬番→距離(m)。
 *   `moverName`検出に使う（t-5時点の隊列を求めるため）。省略時はmover系が常にnull。
 * @param {number|null} ctx.split1000Seconds - 先頭が1000mを通過した時刻(秒)。未通過はnull
 */
export function commentaryVars(t, { entries, selfEntry, distanceOfNum, distanceOfNumAt, split1000Seconds }) {
  const order = fieldOrder(entries, distanceOfNum);
  const rank = order.findIndex((e) => e.isSelf) + 1;
  const name = (i) => (order[i] ? order[i].name : "");
  const leaderD = distanceOfNum(order[0].num);
  const meterToWord = (m) =>
    m < 0.5 ? "クビ" :
    m < 2.4 ? "1馬身" :
    m < 4.8 ? "2馬身" :
    m < 9.6 ? `${Math.round(m / 2.4)}馬身` : "大きく";
  const gapM = leaderD - distanceOfNum(selfEntry.num);
  const gapWord = meterToWord(gapM);
  const leadGap2nd = order.length > 1 ? leaderD - distanceOfNum(order[1].num) : 0;
  const leadGap = meterToWord(leadGap2nd);
  const selfBand = positionBandOf(rank, entries.length);

  // 直近5秒（t-5〜t）で順位を3つ以上上げた馬（mover）。複数いれば最も上げた馬。無ければnull。
  let moverName = null;
  let moverNum = null;
  let moverJockey = null;
  let moverIsSelf = false;
  if (distanceOfNumAt) {
    const prevT = Math.max(0, t - 5);
    const prevOrder = fieldOrder(entries, (num) => distanceOfNumAt(num, prevT));
    const prevRankByNum = new Map(prevOrder.map((e, i) => [e.num, i + 1]));
    let bestGain = 0;
    let bestEntry = null;
    order.forEach((e, i) => {
      const prevRank = prevRankByNum.get(e.num);
      if (prevRank == null) return;
      const gain = prevRank - (i + 1);
      if (gain > bestGain) {
        bestGain = gain;
        bestEntry = e;
      }
    });
    if (bestEntry && bestGain >= 3) {
      moverName = bestEntry.name;
      moverNum = String(bestEntry.num);
      moverJockey = bestEntry.jockeyName ?? null;
      moverIsSelf = bestEntry.isSelf;
    }
  }

  return {
    self: selfEntry.name, selfNum: String(selfEntry.num), selfRank: String(rank), selfRankNum: rank,
    leader: name(0), second: name(1), third: name(2), fourth: name(3), last: name(order.length - 1),
    leaderJockey: order[0].jockeyName ?? null,
    order5: order.slice(0, 5).map((e) => e.name).join("、"),
    field: String(entries.length),
    // ⚠️2026-09-09に先頭基準・100m単位へ直した（`devlog/wave06.md`§65）。以前は自分の馬の
    // 残り距離を1m単位で出していた。
    remain: String(Math.max(0, Math.round((TOTAL_DISTANCE - leaderD) / 100) * 100)),
    split1000: fmtTime(split1000Seconds ?? 0),
    split1000Seconds: split1000Seconds ?? null,
    gap: gapWord, winner: name(0),
    chaser: name(1),
    // 発走前の紹介用：馬番順の先頭6頭（「1番〇〇、2番〇〇…」）と大外の馬
    lineup6: entries.slice(0, 6).map((e) => `${e.num}番${e.name}`).join("、"),
    lastNum: String(entries[entries.length - 1].num), lastName: entries[entries.length - 1].name,
    selfBand, leadGap2nd, leadGap,
    moverName, moverNum, moverJockey, moverIsSelf,
  };
}

// 実況スロットごとの「直前に出した行」の記憶（3回連続どころか2連続の同じ文言も出さないための状態）。
// ⚠️モジュール単位の可変状態——`resetCommentaryHistory()`をレース開始のたびに呼んで空にする
// （呼ばないと前のレースの記憶が新しいレースの最初の1行に薄く影響する。実害は無いが紛らわしい）。
const recentTextBySlot = new Map();

/** レース開始のたびに呼ぶ。直前レースの「直前に出した行」の記憶をリセットする。 */
export function resetCommentaryHistory() {
  recentTextBySlot.clear();
}

/**
 * 実況スロットから1行選び、変数を埋め込んだテキストを返す。
 * 条件（`when`）を満たす行が1つも無ければnull（呼び出し側は何も言わない）。
 * @param {string} slot - "start"等の単純スロット、または"choiceReact.holdInside"のような複合スロット
 * @param {object} vars - commentaryVarsの返り値（必要ならextraVarsをObject.assignして渡す）
 * @param {number} sayCount - これまでにsayを呼んだ回数（行選択の疑似乱数シード）
 */
export function pickCommentaryLine(slot, vars, sayCount) {
  const key = slot.indexOf(".") >= 0 ? slot.split(".")[1] : slot;
  const pool = slot.indexOf(".") >= 0 ? COMMENTARY.choiceReact[slot.split(".")[1]] : COMMENTARY[slot];
  if (!pool || pool.length === 0) return null;
  const eligible = pool.filter((line) => !line.when || line.when(vars));
  if (eligible.length === 0) return null;
  let idx = Math.floor(viewHash01(sayCount * 7.31 + 0.5) * eligible.length) % eligible.length;
  // 同じスロットで直前と同じ文言が続かないよう、当たったら次の候補にずらす（2択以上あるとき）。
  if (eligible.length > 1 && eligible[idx].text === recentTextBySlot.get(key)) {
    idx = (idx + 1) % eligible.length;
  }
  const line = eligible[idx];
  recentTextBySlot.set(key, line.text);
  return line.text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
