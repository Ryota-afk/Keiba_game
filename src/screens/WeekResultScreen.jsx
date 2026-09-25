// 週の結果の画面（「この週を進める」の後に1枚だけ挟む）。
// 見本：`design/mocks/week-result-v1.html`の「案C 掲示板」（2026-09-25にユーザーが選んだ）。
// ⚠️見た目はOpus 5.5が担当した（Fableの残量切れ。CLAUDE.md §2・`arch/ui-fable.md`§2のユーザー決定）。
// 中身はユーザーが選んだ5つ：乗った鞍の結果／稼いだお金と所持金／主戦の進み具合／
// 調教師からの信頼の変化（言葉で出す。数字は出さない）／その週の重賞の勝ち馬。
// データは`domain/weekResultSummary.js`の`buildWeekResultSummary`が作る（この画面は計算しない）。
// ⚠️落馬した鞍は板に「落馬」と出すだけ。怪我の週数・主戦を失った知らせは週の画面の
// 「先週の出来事」が出すので、ここでは言い直さない（CLAUDE.md §7）。

import React from "react";
import "./WeekResultScreen.css";

const yen = (n) => `${n.toLocaleString("ja-JP")}円`;
const signedYen = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("ja-JP")}円`;
const surfaceLabel = (s) => (s === "dirt" ? "ダート" : "芝");

const TRUST_WORDS = {
  bigUp: "大きく上がりました",
  up: "少し上がりました",
  down: "下がりました",
  bigDown: "大きく下がりました",
};

function mainMountText(m) {
  if (m.status === "became") return "主戦になりました";
  if (!m.needsWin) return `あと${m.ridesLeft}回乗れば主戦`;
  if (m.ridesLeft === 0) return "1勝すれば主戦";
  return `あと${m.ridesLeft}回乗って、1勝すれば主戦`;
}

function Board({ ride }) {
  return (
    <div className={["wr-board", ride.won ? "is-win" : ""].join(" ").trim()}>
      <div className="wr-board__top">
        <span>{ride.courseName}</span>
        {!ride.fell && <span>{ride.popularity}番人気</span>}
      </div>
      {ride.fell ? (
        <div className="wr-board__pos is-fell">落馬</div>
      ) : (
        <div className="wr-board__pos">
          {ride.position}
          <small>着／{ride.fieldSize}頭立て</small>
        </div>
      )}
      <div className="wr-board__name">{ride.horseName}</div>
      <div className="wr-board__race">
        <span className={`wr-sf is-${ride.surface}`}>{surfaceLabel(ride.surface)}</span>
        {ride.distance}m {ride.className}
      </div>
    </div>
  );
}

export function WeekResultScreen({ summary, onNext }) {
  const { weekLabel, moneyGained, moneyAfter, rides, mainMounts, trust, graded } = summary;
  return (
    <main className="week-result">
      <div className="wr-hd">
        <div className="wr-hd__week">{weekLabel}</div>
        <div className="wr-hd__money">
          今週<b>{signedYen(moneyGained)}</b>
          所持金 {yen(moneyAfter)}
        </div>
      </div>

      {rides.length > 0 ? (
        <div className="wr-boards">
          {rides.map((r, i) => (
            <Board key={`${r.horseId}-${i}`} ride={r} />
          ))}
        </div>
      ) : (
        <p className="wr-empty">今週は乗りませんでした。</p>
      )}

      {mainMounts.length > 0 && (
        <section className="wr-sec">
          <h2>主戦</h2>
          {mainMounts.map((m) => (
            <div className="wr-line" key={m.horseId}>
              <span>{m.horseName}</span>
              <span className={m.status === "became" ? "wr-line__v is-hot" : "wr-line__v"}>{mainMountText(m)}</span>
            </div>
          ))}
        </section>
      )}

      {trust.length > 0 && (
        <section className="wr-sec">
          <h2>調教師からの信頼</h2>
          {trust.map((t) => (
            <div className="wr-line" key={t.stableId}>
              <span>{t.trainerName}調教師</span>
              <span className="wr-line__v">{TRUST_WORDS[t.change]}</span>
            </div>
          ))}
        </section>
      )}

      {graded.length > 0 && (
        <section className="wr-sec">
          <h2>今週の重賞</h2>
          {graded.map((g) => (
            <div className="wr-graded" key={g.raceName}>
              <div>
                <div className="wr-graded__race">
                  {g.raceName}・{g.courseName}
                </div>
                <div className="wr-graded__winner">{g.winnerName}</div>
              </div>
              <div className="wr-graded__jockey">
                {g.jockeyName}
                <br />
                {g.popularity}番人気
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="wr-foot">
        <button type="button" className="wr-btn" onClick={onNext}>
          次の週へ
        </button>
      </div>
    </main>
  );
}
