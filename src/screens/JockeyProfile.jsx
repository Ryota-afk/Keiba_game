// 自分の能力の画面（週の画面の「自分」タブの中身。2026-09-27・Fable）。
// 見本：`design/mocks/jockey-profile-v1.html`「案C 梯子」（ユーザーが選んだ）。
// 主役＝適性10個の梯子（G〜S+の16段。卒業式の成績表と同じ形）。次の段は、たまった分だけ薄く埋まる。
// 梯子の上に、同じマスを上限の数だけ並べて合計を見せる（見本：`design/mocks/aptitude-cap-v1.html`「案B」・2026-11-27）。
// 合計がランクの上限に届いていれば、マスが全部黄色になり、種類ごとに次に下がる段を黄色の枠にする。
// データは`view/jockeyProfileView.js`の`buildJockeyProfile`が組む（この画面は計算しない）。
// ⚠️週の画面（`WeekScreen.jsx`）の中で出すので、<main>・上部の週の見出し・下の帯は持たない。

import React, { useMemo } from "react";
import { buildJockeyProfile, LADDER_STEPS } from "../view/jockeyProfileView.js";
import "./JockeyProfile.css";

function Ladder({ row }) {
  const cells = [];
  for (let i = 0; i < LADDER_STEPS; i += 1) {
    let cls = "";
    let style;
    if (i < row.step) {
      cls = ["is-on", row.isTop ? "is-top" : "", row.willDrop && i === row.step - 1 ? "is-risk" : ""]
        .join(" ")
        .trim();
    } else if (i === row.step && row.ridesLeft != null) {
      cls = "is-next";
      style = { "--p": `${Math.round(row.progress * 100)}%` };
    }
    cells.push(<i key={i} className={cls || undefined} style={style} />);
  }
  return <div className="jp-lad">{cells}</div>;
}

/**
 * @param {{ player: object, stables: object[] }} props
 */
export function JockeyProfile({ player, stables }) {
  const p = useMemo(() => buildJockeyProfile({ player, stables }), [player, stables]);
  const c = p.career;
  return (
    <div className="jockey-profile">
      <div className="jp-head">
        <div className="jp-head__name">{p.name}</div>
        <div className="jp-head__who">
          <b>{p.rankLabel}</b>
          {p.stableLabel}
        </div>
      </div>

      <div className="jp-career">
        <div className="jp-career__l">
          <b>
            {c.starts}戦 {c.wins}勝
          </b>
          <span>勝率 {c.winRate}</span>
          <span>重賞 {c.gradedWins}勝</span>
        </div>
        <div className="jp-career__yr">
          今年 {c.yearStarts}戦 {c.yearWins}勝
        </div>
      </div>

      {p.hasCap && (
        <div className="jp-sum">
          <div className="jp-sum__h">
            <span>適性の合計</span>
            <span className={["jp-sum__n", p.isFull ? "is-full" : ""].join(" ").trim()}>
              <b>{p.total}</b>
              <span>／{p.cap}</span>
            </span>
          </div>
          <div className={["jp-sum__cells", p.isFull ? "is-full" : ""].join(" ").trim()}>
            {p.gaugeGroups.map((cells, gi) => (
              <div key={gi}>
                {cells.map((on, i) => (
                  <i key={i} className={on ? "is-on" : undefined} />
                ))}
              </div>
            ))}
          </div>
          <div className="jp-sum__f">
            <span>{p.freeLabel}</span>
            <span>{p.capLabel}</span>
          </div>
        </div>
      )}
      {p.fullNote && <div className="jp-note">{p.fullNote}</div>}
      <div className="jp-scale">
        <span>G</span>
        <i />
        <span>S+</span>
      </div>

      {p.groups.map((g) => (
        <section className="jp-grp" key={g.category}>
          <h3>{g.label}</h3>
          {g.rows.map((row) => (
            <div className="jp-row" key={row.key}>
              <div className="jp-row__l1">
                <span className="jp-row__nm">
                  {row.label}
                  {row.dropNote && <small>{row.dropNote}</small>}
                </span>
                <span>{row.recordLabel}</span>
              </div>
              <div className="jp-row__l2">
                <Ladder row={row} />
                <span className={["jp-row__gr", row.isTop ? "is-top" : ""].join(" ").trim()}>{row.grade}</span>
                <span className={["jp-row__nx", row.ridesLeft == null ? "is-max" : ""].join(" ").trim()}>
                  {row.nextLabel}
                </span>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
