// レース名を短くする（`devlog/wave13b.md`§35・2026-11-28のユーザー決定「冠と添え書きを外す」）。純関数（JSX無し）。
// 重賞データ（`data/generated/gradedRaces.*.json`の`name`）は「冠 冠 レース名 （添え書き）」の形で、
// 区切りは空白。決まりは3つだけ：
//   1. 空白で区切る。
//   2. 丸ごと括弧の区切り（「（皐月賞トライアル）」）は添え書きなので捨てる。
//      ⚠️レース名にくっついた括弧（「東京優駿（日本ダービー）」「天皇賞（春）」「金杯（東）」
//      「共同通信杯（トキノミノル記念）」）は名前の一部なので残る。
//   3. 残った最後の区切りがレース名。その前（冠・記念の添え名）は捨てる。
//      ⚠️最後の区切りが数字で始まるとき（「4歳牝馬特別」「3歳牝馬ステークス」）は冠を外すと
//      別のレースと見分けられなくなるので、直前の区切りを1つだけ付けて残す
//      （「サンケイスポーツ賞4歳牝馬特別」と「報知杯4歳牝馬特別」は別のレース）。
// 空白の無い名前（「デイリー杯2歳ステークス」「産経大阪杯」「皐月賞」「CBC賞」）は何も変えない。
// 全件の検査：`tools/test-race-name.mjs`（重賞データに出てくる名前すべて）。

const NOTE_ONLY = /^（.*）$/;
const STARTS_WITH_DIGIT = /^[0-9０-９]/;

/**
 * @param {string|null|undefined} name 重賞データのレース名
 * @returns {string} 冠と添え書きを外した名前（空なら空文字）
 */
export function shortRaceName(name) {
  const parts = String(name ?? "")
    .split(/[\s　]+/)
    .filter((p) => p && !NOTE_ONLY.test(p));
  if (parts.length === 0) return "";
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && STARTS_WITH_DIGIT.test(last)) return parts[parts.length - 2] + last;
  return last;
}
