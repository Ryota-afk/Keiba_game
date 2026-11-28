// 年末の2枚の画面：①年末のまとめ（`YearEndSummaryScreen`）と②引退した馬（`RetiredHorsesScreen`）。
// 年の最後の週の結果画面のあとに`WeekScreen.jsx`が順に出す（②は載せる馬が居る年だけ）。
// 見本：`design/mocks/year-end-v1.html`の①案A（年度代表馬が主役）・②案B（1頭1枚の札）
// （`devlog/wave12.md`§36・`devlog/wave13.md`§9のユーザー決定）。
// データは`advanceWeek`の`yearEnd = { year, summary, retired }`（`domain/yearEnd.js`）。
// 文字列づくりは`view/yearEndView.js`。この画面は計算しない。

import React from "react";
import {
  representativeView,
  awardRowsView,
  jockeyRowsView,
  playerYearTiles,
  g1RowsView,
  retiredCardsView,
} from "../view/yearEndView.js";
import "./YearEndScreen.css";

/** 勝ったレース名を「・」でつなぐ。折り返しはレース名の途中ではなく、名前と名前のあいだで起こす。 */
function RaceNames({ names }) {
  return names.map((name, i) => (
    <span className="ye-race" key={name}>
      {name}
      {i < names.length - 1 ? "・" : ""}
    </span>
  ));
}

/**
 * ①年末のまとめ。
 * @param {{ summary: object, playerName: string, nextLabel: string, onNext: () => void }} props
 *   `summary`＝`buildYearEndSummary`の戻り値。`nextLabel`＝②が続く年は「次へ」・続かない年は「◯◯年へ」
 */
export function YearEndSummaryScreen({ summary, playerName, nextLabel, onNext }) {
  const rep = representativeView(summary.representative);
  const awards = awardRowsView(summary.awards);
  const jockeys = jockeyRowsView(summary.jockeyAwards);
  const tiles = playerYearTiles(summary.player);
  const g1 = g1RowsView(summary.g1Races);
  return (
    <main className="year-end">
      <h1 className="ye-hd">
        {summary.year}年 {summary.title}
      </h1>

      <div className="ye-hero ye-in" style={{ "--i": 0 }}>
        <div className="ye-hero__k">年度代表馬</div>
        {rep.none ? (
          <div className="ye-hero__nm is-none">該当馬なし</div>
        ) : (
          <>
            <div className="ye-hero__nm">
              {rep.name}
              {rep.mark && <span className="ye-mk">{rep.mark}</span>}
            </div>
            <div className="ye-hero__sub">{rep.sub}</div>
            <div className="ye-hero__w">
              <RaceNames names={rep.races} />
            </div>
          </>
        )}
      </div>

      <section className="ye-sec">
        <h2>部門ごとの最優秀馬</h2>
        {awards.map((a, i) => (
          <div className="ye-aw ye-in" key={a.id} style={{ "--i": i + 1 }}>
            <span className="ye-aw__k">{a.label}</span>
            {a.none ? (
              <span className="ye-aw__nm is-none">該当馬なし</span>
            ) : (
              <>
                <span className="ye-aw__nm">
                  {a.name}
                  {a.mark && <span className="ye-mk">{a.mark}</span>}
                </span>
                <span className="ye-aw__w">
                  <RaceNames names={a.races} />
                </span>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="ye-sec">
        <h2>騎手</h2>
        {jockeys.map((j) => (
          <div className={["ye-jk", j.winnerIsPlayer ? "is-me" : ""].join(" ").trim()} key={j.id}>
            <span className="ye-jk__k">{j.label}</span>
            <span className="ye-jk__nm">{j.winnerName}</span>
            <span className="ye-jk__v">{j.winnerValue}</span>
            {j.self && (
              <span className="ye-jk__me">
                <span>
                  <b>{playerName}</b>
                  {j.self.rank}
                </span>
                <span>{j.self.value}</span>
              </span>
            )}
          </div>
        ))}
      </section>

      <section className="ye-sec">
        <h2>{playerName}の1年</h2>
        <div className="ye-mine">
          {tiles.map((t) => (
            <div className="ye-mine__b" key={t.id}>
              <div className="ye-mine__k">{t.label}</div>
              <div className={["ye-mine__v", t.hot ? "is-hot" : ""].join(" ").trim()}>{t.value}</div>
              <div className="ye-mine__p">{t.sub}</div>
              {t.last && <div className="ye-mine__p">前の年 {t.last}</div>}
            </div>
          ))}
        </div>
      </section>

      {g1.length > 0 && (
        <section className="ye-sec">
          <h2>{summary.g1Label}の勝ち馬</h2>
          {g1.map((r) => (
            <div className={["ye-g1", r.isMine ? "is-me" : ""].join(" ").trim()} key={r.key}>
              <div className="ye-g1__l">
                <div className="ye-g1__race">
                  <span>{r.weekLabel}</span>
                  {r.raceName}
                </div>
                <div className="ye-g1__win">{r.winnerName}</div>
              </div>
              <div className="ye-g1__jk">
                {r.selfResult && (
                  <span className="ye-g1__self">
                    {playerName} {r.selfResult}
                  </span>
                )}
                {r.jockeyName}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="ye-foot">
        <button type="button" className="ye-btn" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </main>
  );
}

/**
 * ②引退した馬。
 * @param {{ year: number, retired: object[], onNext: () => void }} props
 *   `retired`＝`buildRetiredHorses`の戻り値（主戦の馬が先・1頭以上）
 */
export function RetiredHorsesScreen({ year, retired, onNext }) {
  const cards = retiredCardsView(retired);
  return (
    <main className="year-end">
      <h1 className="ye-hd">{year}年に引退した馬</h1>

      <div className="ye-cards">
        {cards.map((c, i) => (
          <div className="ye-card ye-in" key={c.horseId} style={{ "--i": i }}>
            <div className="ye-card__top">
              <span>{c.top}</span>
              {c.isMain && <b>主戦</b>}
            </div>
            <div className="ye-card__nm">{c.name}</div>
            {c.g1Lines.map((line) => (
              <div className="ye-card__g1" key={line}>
                {line}
              </div>
            ))}
            {(c.rides || c.destination) && (
              <div className="ye-card__ft">
                {c.rides && <b>{c.rides}</b>}
                {c.destination && <span>{c.destination}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ye-foot">
        <button type="button" className="ye-btn" onClick={onNext}>
          {year + 1}年へ
        </button>
      </div>
    </main>
  );
}
