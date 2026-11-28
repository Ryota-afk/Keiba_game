// 騎手人生のまとめ（30年目の年末の画面のあと。終わったセーブを「つづきから」で開いたときもここ）。
// 見本：`design/mocks/career-end-v1.html`の案A（30年の勝ち数のグラフが主役。`devlog/wave13b.md`§35のユーザー決定）。
// 要素と取得元：`design/mocks/career-end-v1-spec.md`§2・§3。
// データは`view/careerSummaryView.js`、行と文字列づくりは`view/careerEndView.js`。この画面は計算しない。
// 押すものは「タイトルへ」1つ。グラフは押す・なぞると、その年の成績が下の行に出る（最初は最も勝った年）。

import React, { useMemo, useState } from "react";
import { buildCareerSummary } from "../view/careerSummaryView.js";
import { careerEndView } from "../view/careerEndView.js";
import "./CareerEndScreen.css";

const TONE_CLASS = { g1: " is-g1", graded: " is-gr", plain: "" };

/** 30本の棒。指の横位置から年を選ぶ（縦のスクロールは止めない）。キーボードでは棒1本ずつに移れる。 */
function YearChart({ chart, selected, onSelect }) {
  const n = chart.bars.length;
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || n === 0) return;
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    onSelect(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div className="ce-ch" style={{ "--max": chart.max, "--n": n }}>
      <div className="ce-ch__plot">
        <div className="ce-ch__rules" aria-hidden="true">
          {chart.ticks.map((v) => (
            <i key={v} style={{ "--v": v }}>
              <span>{v}</span>
            </i>
          ))}
        </div>
        <div
          className="ce-ch__bars"
          onPointerDown={pick}
          onPointerMove={(e) => (e.buttons || e.pointerType === "touch") && pick(e)}
        >
          {chart.bars.map((b, i) => (
            <button
              type="button"
              key={b.year}
              className={`ce-ch__col${i === selected ? " is-sel" : ""}`}
              aria-label={b.label}
              aria-pressed={i === selected}
              onFocus={() => onSelect(i)}
            >
              {b.wins > 0 && <i className={`ce-ch__bar${TONE_CLASS[b.tone]}`} style={{ "--v": b.wins, "--i": i }} />}
            </button>
          ))}
        </div>
      </div>
      <div className="ce-ch__x" aria-hidden="true">
        {chart.axis.map((a) => (
          <span key={a.year} className={a.edge ? `is-${a.edge}` : undefined} style={{ "--i": a.index }}>
            {a.year}
          </span>
        ))}
      </div>
      {chart.legend.length > 0 && (
        <div className="ce-ch__lg">
          {chart.legend.map((l) => (
            <span key={l.tone}>
              <i className={TONE_CLASS[l.tone].trim()} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ player: object, roster: object, onBackToTitle: () => void }} props
 */
export function CareerEndScreen({ player, roster, onBackToTitle }) {
  const v = useMemo(() => careerEndView(buildCareerSummary({ player, roster })), [player, roster]);
  const [selected, setSelected] = useState(v.initialIndex);
  const year = v.years[selected];
  return (
    <main className="career-end">
      <header className="ce-hd">
        {v.name && <h1 className="ce-hd__nm">{v.name}</h1>}
        {(v.rankLabel || v.span) && (
          <div className="ce-hd__sub">
            {v.rankLabel && <b>{v.rankLabel}</b>}
            {v.span}
          </div>
        )}
      </header>

      <section className="ce-board">
        <h2 className="ce-board__k">1年ごとの勝ち数</h2>
        <YearChart chart={v.chart} selected={selected} onSelect={setSelected} />
        {year && (
          <div className="ce-rd" aria-live="polite">
            <div className="ce-rd__k">
              {year.head}
              {year.isBest && <span className="ce-mk">最も勝った年</span>}
            </div>
            <div className="ce-rd__v">
              {year.off ? (
                <b className="is-none">騎乗なし</b>
              ) : (
                <>
                  <b>{year.wins}</b>
                  <span>{year.starts}</span>
                  {year.graded && <span className="ce-rd__g">{year.graded}</span>}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <dl className="ce-sec ce-sec--tight">
        {v.totals.map((t) => (
          <div className="ce-tr" key={t.label}>
            <dt className="ce-tr__k">{t.label}</dt>
            <dd className="ce-tr__v">
              {t.value}
              {t.sub && <span>{t.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {v.tiers.map((g) => (
        <section className="ce-sec" key={g.tier}>
          <h2>{g.heading}</h2>
          {g.rows.map((w) => (
            <div className={`ce-gw${g.tier === "g1" ? " is-strong" : ""}`} key={w.key}>
              <span className="ce-gw__y">{w.year}</span>
              <span className="ce-gw__r">{w.race}</span>
              <span className="ce-gw__h">{w.horse}</span>
            </div>
          ))}
        </section>
      ))}

      {v.mounts.length > 0 && (
        <section className="ce-sec">
          <h2>よく乗った馬</h2>
          {v.mounts.map((m) => (
            <div className="ce-mt" key={m.key}>
              <div className="ce-mt__nm">
                {m.name}
                {m.isMain && <span className="ce-mk">主戦</span>}
              </div>
              <div className="ce-mt__v">
                {m.rides}
                {m.graded && <span>{m.graded}</span>}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="ce-foot">
        <button type="button" className="ce-btn" onClick={onBackToTitle}>
          タイトルへ
        </button>
      </div>
    </main>
  );
}
