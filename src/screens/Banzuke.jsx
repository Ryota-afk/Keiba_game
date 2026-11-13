// 番付の画面（週の画面の「番付」タブの中身。2026-10-11・Fable）。
// 見本：`design/mocks/banzuke-v1.html`「案C 顔ぶれ」（ユーザーが選んだ）。
// まず8つの番付の1位だけを板8枚（2列）で見せ、押した板の10頭（騎手は10人＋10位より下でも自分の行）を
// その下に出す。板は押すものなので、選んだ板は青（この画面で青はここだけ）。
// データは`view/banzukeView.js`の`buildBanzuke`（今年）と`lastYearBanzuke`（前の年）。この画面は計算しない
// （万円・戦績・印・空かどうかは同じファイルの表示用の純関数）。
// ⭐前の年の番付：見本に無い部品（ユーザー決定「前の年の番付も見られるようにする」）。年の行の右に
//   「前の年を見る」「今年に戻る」の札を置く。前の年の番付が無いとき（古いセーブ）は札ごと出さない。
//   札は押すものだが、青は選んだ板の1か所に絞るため、競馬場の札（`.wk-courses`）の「押せるが選んでいない」
//   見た目（panel2の面・薄い文字）にそろえた。
// ⚠️週の画面（`WeekScreen.jsx`）の中で出すので、<main>・上部の週の見出し・下の帯は持たない。

import React, { useMemo, useState } from "react";
import {
  buildBanzuke,
  lastYearBanzuke,
  isBanzukeEmpty,
  banzukeBoardTops,
  banzukeListFor,
  BANZUKE_DEFAULT_BOARD_ID,
} from "../view/banzukeView.js";
import "./Banzuke.css";

const EMPTY_MESSAGE = "今年の番付は、今週末のレースから始まります。";
const SHOW_LAST_YEAR_LABEL = "前の年を見る";
const SHOW_THIS_YEAR_LABEL = "今年に戻る";
const EMPTY_ORDER_LABEL = "賞金の多い順";

/**
 * @param {{ roster: object, player: object }} props
 */
export function Banzuke({ roster, player }) {
  const [boardId, setBoardId] = useState(BANZUKE_DEFAULT_BOARD_ID);
  const [showLastYear, setShowLastYear] = useState(false);

  const thisYear = useMemo(
    () => buildBanzuke({ roster, player, year: player.currentYear }),
    [roster, player]
  );
  const lastYear = useMemo(() => lastYearBanzuke(roster), [roster]);
  const banzuke = showLastYear && lastYear ? lastYear : thisYear;

  const empty = isBanzukeEmpty(banzuke);
  const tops = useMemo(() => banzukeBoardTops(banzuke), [banzuke]);
  const list = useMemo(
    () => (empty ? null : banzukeListFor(banzuke, boardId, player.jockey?.name)),
    [banzuke, boardId, empty, player]
  );

  return (
    <div className="banzuke">
      <div className="bz-yr">
        <b>{banzuke.year}年</b>
        {lastYear ? (
          <button type="button" className="bz-yr__sw" onClick={() => setShowLastYear((v) => !v)}>
            {showLastYear ? SHOW_THIS_YEAR_LABEL : SHOW_LAST_YEAR_LABEL}
          </button>
        ) : (
          empty && <span>{EMPTY_ORDER_LABEL}</span>
        )}
      </div>

      {empty && <div className="bz-empty">{EMPTY_MESSAGE}</div>}

      <div className="bz-grid">
        {tops.map((b) => (
          <button
            key={b.id}
            type="button"
            className={["bz-bd", !empty && b.id === boardId ? "is-on" : ""].join(" ").trim()}
            aria-pressed={!empty && b.id === boardId}
            disabled={empty}
            onClick={() => setBoardId(b.id)}
          >
            <span className="bz-bd__k">{b.label}</span>
            <span className="bz-bd__nm">{b.top ? b.top.name : "—"}</span>
            <span className={["bz-bd__ea", b.top ? "" : "is-none"].join(" ").trim()}>{b.top ? b.top.value : ""}</span>
          </button>
        ))}
      </div>

      {list && (
        <div className="bz-list" key={`${banzuke.year}-${boardId}`}>
          <h3>
            {list.label}
            <span>{list.orderLabel}</span>
          </h3>
          {list.rows.map((r, i) => (
            <div
              key={r.key}
              className={["bz-r", i === 0 ? "is-top" : "", r.isPlayer ? "is-me" : ""].join(" ").trim()}
              style={{ "--i": i }}
            >
              <span className="bz-r__rk">{r.rank}</span>
              <span className="bz-r__nm">
                {r.name}
                {r.mark && <span className="bz-r__mk">{r.mark}</span>}
              </span>
              <span className="bz-r__rc">{r.record ?? ""}</span>
              <span className="bz-r__ea">{r.value}</span>
              {r.bigWin && <span className="bz-r__l2">{r.bigWin}</span>}
            </div>
          ))}
          {list.self && (
            <div className="bz-me">
              <div className="bz-r is-me" style={{ "--i": list.rows.length }}>
                <span className="bz-r__rk">{list.self.rank}</span>
                <span className="bz-r__nm">{list.self.name}</span>
                <span className="bz-r__rc" />
                <span className="bz-r__ea">{list.self.value}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
