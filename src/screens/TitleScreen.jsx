import React, { useState } from "react";
import "./TitleScreen.css";
import { START_YEARS } from "../data/startYears.js";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "../data/difficulty.js";

// タイトル画面（CLAUDE.md §8の手順で2026-09-03に確定した「本馬場」案）。
// 経緯は devlog/wave02.md ⑤ を参照。
//
// 開始年（`data/startYears.js`）・難易度（`data/difficulty.js`）を選ぶまで
// 「騎手になる」は押せない（選ばせる操作を最初の判断にする）。

export function TitleScreen({ onStart }) {
  const [year, setYear] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const ready = year != null && difficulty != null;

  function handleStart() {
    if (!ready) return;
    onStart?.(year, difficulty);
  }

  return (
    <main className="title-screen">
      <div className="title-screen__field" aria-hidden="true" />
      <div className="title-screen__rail" aria-hidden="true" />
      <div className="title-screen__horses" aria-hidden="true">
        <div className="title-screen__horse" />
        <div className="title-screen__horse title-screen__horse--2" />
        <div className="title-screen__horse title-screen__horse--3" />
        <div className="title-screen__horse title-screen__horse--4" />
      </div>

      <div className="title-screen__content">
        <h1 className="title-screen__title">ファーストジョッキー</h1>

        <div className="title-screen__window">
          <div className="title-screen__row">
            <div className="title-screen__row-label">はじまる年</div>
            <div className="title-screen__opts" role="group" aria-label="はじまる年">
              {START_YEARS.map((y) => (
                <button
                  key={y}
                  type="button"
                  className="title-screen__opt"
                  aria-pressed={year === y}
                  onClick={() => setYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="title-screen__row">
            <div className="title-screen__row-label">難しさ</div>
            <div className="title-screen__opts" role="group" aria-label="難しさ">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="title-screen__opt title-screen__opt--text"
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(d)}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="title-screen__foot">
          <button
            type="button"
            className="title-screen__start"
            data-ready={ready}
            disabled={!ready}
            onClick={handleStart}
          >
            騎手になる
          </button>
        </div>
      </div>
    </main>
  );
}
