import React, { useState } from "react";
import "./TitleScreen.css";
import { START_YEARS } from "../data/startYears.js";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "../data/difficulty.js";

// タイトル画面（案A・CLAUDE.md §8の手順で2026-09-06に確定）。
// 見本：/tmp/.../scratchpad/title-A.html / title-A-sel.html。
// 経緯は devlog/wave02.md ⑤ を参照。
//
// 開始年（`data/startYears.js`）・難易度（`data/difficulty.js`）を選ぶまで
// 「騎手になる」は押せない（選ばせる操作を最初の判断にする）。

// 馬の帯（画面下部・高さ96px）を走る3頭。SVGの中身はtitle-track-block.html/
// title-track-css.cssのままJSXへ書き直しただけで、座標・色・アニメーションは
// 変えていない。
function TitleHorse({ className = "", coat, coatDark, silk }) {
  return (
    <div
      className={`title-horse ${className}`.trim()}
      style={{ "--coat": coat, "--coat-dark": coatDark, "--silk": silk }}
    >
      <svg className="title-horse__svg" viewBox="0 0 44 32" aria-hidden="true">
        <ellipse className="title-horse__shadow" cx="21" cy="30.5" rx="16" ry="1.8" />
        <g className="title-horse__body">
          <rect className="coat-dark" x="33" y="11" width="4" height="3" />
          <rect className="coat-dark" x="36" y="10" width="5" height="3" />
          <rect className="coat-dark" x="40" y="9" width="4" height="2" />
          <g className="f1">
            <g transform="rotate(-42 30 21)">
              <rect className="coat" x="28" y="21" width="4" height="9" />
              <rect className="hoof" x="28" y="28.5" width="4" height="2" />
            </g>
            <g transform="rotate(-26 25.5 21)">
              <rect className="coat-dark" x="24" y="21" width="3" height="8" />
              <rect className="hoof" x="24" y="27.5" width="3" height="2" />
            </g>
            <g transform="rotate(42 12 21)">
              <rect className="coat" x="10" y="21" width="4" height="9" />
              <rect className="hoof" x="10" y="28.5" width="4" height="2" />
            </g>
            <g transform="rotate(26 15.5 21)">
              <rect className="coat-dark" x="14" y="21" width="3" height="8" />
              <rect className="hoof" x="14" y="27.5" width="3" height="2" />
            </g>
          </g>
          <g className="f2">
            <g transform="rotate(-6 30 21)">
              <rect className="coat" x="28" y="21" width="4" height="9" />
              <rect className="hoof" x="28" y="28.5" width="4" height="2" />
            </g>
            <g transform="rotate(4 25.5 21)">
              <rect className="coat-dark" x="24" y="21" width="3" height="8" />
              <rect className="hoof" x="24" y="27.5" width="3" height="2" />
            </g>
            <g transform="rotate(6 12 21)">
              <rect className="coat" x="10" y="21" width="4" height="9" />
              <rect className="hoof" x="10" y="28.5" width="4" height="2" />
            </g>
            <g transform="rotate(-4 15.5 21)">
              <rect className="coat-dark" x="14" y="21" width="3" height="8" />
              <rect className="hoof" x="14" y="27.5" width="3" height="2" />
            </g>
          </g>
          <g className="f3">
            <g transform="rotate(32 30 21)">
              <rect className="coat" x="28" y="21" width="4" height="9" />
              <rect className="hoof" x="28" y="28.5" width="4" height="2" />
            </g>
            <g transform="rotate(16 25.5 21)">
              <rect className="coat-dark" x="24" y="21" width="3" height="8" />
              <rect className="hoof" x="24" y="27.5" width="3" height="2" />
            </g>
            <g transform="rotate(-32 12 21)">
              <rect className="coat" x="10" y="21" width="4" height="9" />
              <rect className="hoof" x="10" y="28.5" width="4" height="2" />
            </g>
            <g transform="rotate(-16 15.5 21)">
              <rect className="coat-dark" x="14" y="21" width="3" height="8" />
              <rect className="hoof" x="14" y="27.5" width="3" height="2" />
            </g>
          </g>
          <rect className="coat" x="10" y="12" width="22" height="10" />
          <rect className="coat" x="32" y="13" width="2" height="6" />
          <rect className="coat" x="9" y="13" width="2" height="5" />
          <rect className="coat-dark" x="12" y="20" width="18" height="2" />
          <rect className="coat" x="8" y="10" width="5" height="4" />
          <rect className="coat" x="5" y="8" width="5" height="5" />
          <rect className="coat" x="0" y="6" width="7" height="4" />
          <rect className="coat" x="0" y="9" width="4" height="2" />
          <rect className="coat-dark" x="5" y="4" width="2" height="3" />
          <rect className="coat-dark" x="8" y="8" width="4" height="2" />
          <rect className="coat-dark" x="11" y="10" width="3" height="2" />
          <rect className="eye" x="1.5" y="7" width="1.5" height="1.5" />
          <rect className="boot" x="22" y="18" width="3" height="5" />
          <rect className="silk" x="19" y="8" width="6" height="6" />
          <rect className="silk" x="15" y="5" width="5" height="5" />
          <rect className="silk" x="11" y="7" width="5" height="2" />
          <rect className="silk" x="13" y="1" width="6" height="4" />
          <rect className="skin" x="12" y="3" width="2" height="3" />
        </g>
      </svg>
    </div>
  );
}

/** 所持金の表示。週の画面でも同じ形にする（3,395,000円）。 */
function formatMoney(n) {
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

/**
 * @param {object} props
 * @param {(year:number, difficulty:string)=>void} props.onStart - 新しく始める
 * @param {boolean} [props.hasSave] - 保存した記録があるか。偽なら記録の1枚を出さず、確認も出さない
 * @param {()=>void} [props.onContinue] - 保存した記録から再開する
 * @param {{name:string, weekLabel:string, money:number}|null} [props.saveSummary] -
 *   記録の1枚に出す値。name＝騎手の姓名（姓＋名を続けて）、weekLabel＝「1974年 4月4週」の形
 *   （`view/weekOffersView.js`の`formatWeekLabel`）、money＝所持金の数値（ここで「3,395,000円」にする）
 */
export function TitleScreen({ onStart, hasSave = false, onContinue, saveSummary = null }) {
  const [year, setYear] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  // 保存がある状態で「騎手になる」を押したときの上書きの確認（案B・`design/mocks/title-continue-v2.html`）
  const [confirming, setConfirming] = useState(false);
  const ready = year != null && difficulty != null;
  const showContinue = hasSave && saveSummary != null;

  function handleStart() {
    if (!ready) return;
    if (hasSave) {
      setConfirming(true);
      return;
    }
    onStart?.(year, difficulty);
  }

  function handleWipe() {
    setConfirming(false);
    onStart?.(year, difficulty);
  }

  return (
    <main className="title-screen">
      <div className="title-screen__field" aria-hidden="true" />

      <div className="title-screen__content">
        <h1 className="title-screen__title">
          ファースト
          <br />
          ジョッキー
        </h1>

        <div className="title-screen__window">
          <div className="title-screen__row">
            <div className="title-screen__row-label">はじまる年</div>
            <div className="title-screen__opts title-screen__opts--3" role="group" aria-label="はじまる年">
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
            <div className="title-screen__opts title-screen__opts--2" role="group" aria-label="難しさ">
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

        {showContinue && (
          <button type="button" className="title-screen__continue" onClick={() => onContinue?.()}>
            <span className="title-screen__continue-left">
              <span className="title-screen__continue-verb">つづきから</span>
              <span className="title-screen__continue-sub">
                <span className="title-screen__continue-name">{saveSummary.name}</span>
                {"\u3000"}
                <span className="title-screen__continue-week">{saveSummary.weekLabel}</span>
              </span>
            </span>
            <span className="title-screen__continue-money">{formatMoney(saveSummary.money)}</span>
          </button>
        )}
      </div>

      <div className="title-screen__track" aria-hidden="true">
        <div className="title-screen__rail" />
        <TitleHorse coat="#8a5a32" coatDark="#5a3a1e" silk="#d0342c" />
        <TitleHorse className="title-horse--2" coat="#4a3020" coatDark="#2e1c12" silk="#f5f5f5" />
        <TitleHorse className="title-horse--3" coat="#b0682f" coatDark="#7a4520" silk="#8e44ad" />
      </div>

      {/* 上書きの確認。`.title-screen__content`の中ではなくここに置く（中に置くと馬の帯を覆えない） */}
      {confirming && (
        <div className="title-screen__modal" role="dialog" aria-modal="true" aria-labelledby="title-confirm-msg">
          <div className="title-screen__modal-box">
            <p className="title-screen__confirm-msg" id="title-confirm-msg">
              今の記録を消して、新しく始めますか。
            </p>
            <div className="title-screen__confirm-btns">
              <button type="button" className="title-screen__ghost" onClick={() => setConfirming(false)}>
                いいえ
              </button>
              <button type="button" className="title-screen__start" data-ready="true" onClick={handleWipe}>
                はい
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
