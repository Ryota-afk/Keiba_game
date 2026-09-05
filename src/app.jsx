import React, { useEffect, useState } from "react";
import "./styles/type.css";
import "./styles/motion.css";
import { TitleScreen } from "./screens/TitleScreen.jsx";
import { DreamDerbyScreen } from "./screens/DreamDerbyScreen.jsx";
import { GraduationScreen } from "./screens/GraduationScreen.jsx";
import { WeekScreen } from "./screens/WeekScreen.jsx";
import { createSaveSeed } from "./core/rng.js";
import { cssMs, scheduleOnce, afterNextPaint } from "./screens/motionTiming.js";
import { generateDreamHorse, generateDreamRivals, assignPostPositions } from "./domain/dreamDerby.js";
import { commentaryVars, pickCommentaryLine } from "./view/dreamDerbyCommentary.js";

// 画面遷移の起点。タイトル→夢のダービー→卒業式→週の進行（1年目の終わりまで）。
// ⚠️週の進行画面（WeekScreen）は見た目が仮（ARCHITECTURE.md「第2弾の範囲」）。
// 騎乗依頼を面で見せる本番のUIは第3弾・第4弾へ送った（`TODO.md` #23・#24）。
//
// ⚠️画面と画面のあいだの動き（6箇所）はここで管理する。`phase`が「今どの画面を
// 出しているか」に加えて「今どの遷移の途中か」も表す。値・秒数は`styles/motion.css`が
// 正本（このファイルはgetComputedStyle経由で読むだけで、生の数値は持たない）。
//
// phase: "title" | "m1" | "derby" | "m2" | "grad" | "m6" | "week"
//   m1 = タイトル→夢のダービー（黒フェード＋実況1行目）
//   m2 = 目覚め→卒業式（縦スライド、夢のダービー画面と卒業式画面が両方マウントされる）
//   m6 = 卒業式→週の画面（白フェード）

/**
 * 黒画面に出す実況の1行目を選ぶ。dreamDerbyEngine.jsのstart()が呼ぶ
 * `say("intro", 0)`と全く同じ計算（sayCount=0固定・saveSeedから作った同じentries）を
 * 再現しているので、レース画面に入った後の実況欄1行目と一致する。
 */
function pickDerbyIntroLine(saveSeed) {
  const dreamHorse = generateDreamHorse(saveSeed);
  const rivals = generateDreamRivals(saveSeed);
  const entries = assignPostPositions(saveSeed, dreamHorse, rivals);
  const selfEntry = entries.find((e) => e.isSelf) ?? entries[0];
  const vars = commentaryVars(0, { entries, selfEntry, distanceOfNum: () => 0 });
  return pickCommentaryLine("intro", vars, 0);
}

export function App() {
  const [career, setCareer] = useState(null); // { saveSeed, year, difficulty }
  const [dreamResult, setDreamResult] = useState(null); // { dreamHorseId, choiceIds, won }
  const [gameState, setGameState] = useState(null); // { roster, player }

  const [phase, setPhase] = useState("title");

  // ①タイトル→夢のダービー
  const [m1Step, setM1Step] = useState(null); // mount|coverIn|wait|textIn|hold|textOut|reveal
  const [introLine, setIntroLine] = useState("");
  const [derbyReady, setDerbyReady] = useState(false);

  // ②目覚め→卒業式
  const [m2Active, setM2Active] = useState(false);

  // ⑥卒業式→週の画面
  const [m6Step, setM6Step] = useState(null); // mount|coverIn|hold|coverOut
  const [weekReady, setWeekReady] = useState(false);

  function handleStart(year, difficulty) {
    const saveSeed = createSaveSeed();
    setCareer({ saveSeed, year, difficulty });
    setIntroLine(pickDerbyIntroLine(saveSeed));
    setDerbyReady(false);
    setPhase("m1");
    setM1Step("mount");
  }

  function handleGraduate(payload) {
    setDreamResult(payload);
    setM2Active(false);
    setPhase("m2");
  }

  function handleGraduationComplete(state) {
    setGameState(state);
    setWeekReady(false);
    setPhase("m6");
    setM6Step("mount");
  }

  // ----- ①タイトル→夢のダービーの段取り -----
  useEffect(() => {
    if (phase !== "m1") return undefined;
    if (m1Step === "mount") return afterNextPaint(() => setM1Step("coverIn"));
    if (m1Step === "coverIn") return scheduleOnce(() => setM1Step("wait"), cssMs("--m1-cover-in-dur"));
    if (m1Step === "wait") return scheduleOnce(() => setM1Step("textIn"), cssMs("--m1-wait-dur"));
    if (m1Step === "textIn") return scheduleOnce(() => setM1Step("hold"), cssMs("--m1-text-in-dur"));
    if (m1Step === "hold") return scheduleOnce(() => setM1Step("textOut"), cssMs("--m1-hold-dur"));
    if (m1Step === "textOut") {
      return scheduleOnce(() => {
        setDerbyReady(true);
        setM1Step("reveal");
      }, cssMs("--m1-text-out-dur"));
    }
    if (m1Step === "reveal") {
      return scheduleOnce(() => {
        setPhase("derby");
        setM1Step(null);
      }, cssMs("--m1-cover-out-dur"));
    }
    return undefined;
  }, [phase, m1Step]);

  // ----- ②目覚め→卒業式の段取り -----
  useEffect(() => {
    if (phase !== "m2") return undefined;
    if (!m2Active) return afterNextPaint(() => setM2Active(true));
    return scheduleOnce(() => {
      setPhase("grad");
      setM2Active(false);
    }, cssMs("--m2-dur"));
  }, [phase, m2Active]);

  // ----- ⑥卒業式→週の画面の段取り -----
  useEffect(() => {
    if (phase !== "m6") return undefined;
    if (m6Step === "mount") return afterNextPaint(() => setM6Step("coverIn"));
    if (m6Step === "coverIn") return scheduleOnce(() => setM6Step("hold"), cssMs("--m6-cover-in-dur"));
    if (m6Step === "hold") {
      return scheduleOnce(() => {
        setWeekReady(true);
        setM6Step("coverOut");
      }, cssMs("--m6-hold-dur"));
    }
    if (m6Step === "coverOut") {
      return scheduleOnce(() => {
        setPhase("week");
        setM6Step(null);
      }, cssMs("--m6-cover-out-dur"));
    }
    return undefined;
  }, [phase, m6Step]);

  const titleMounted = phase === "title" || phase === "m1";
  const derbyMounted = (phase === "m1" && derbyReady) || phase === "derby" || phase === "m2";
  const gradMounted = phase === "m2" || phase === "grad" || (phase === "m6" && !weekReady);
  const weekMounted = (phase === "m6" && weekReady) || phase === "week";

  const derbyPaneClass = phase === "m2" && m2Active ? "screen-pane pane-m2-exit" : "screen-pane";
  const gradPaneClass =
    phase === "m2" ? `screen-pane ${m2Active ? "pane-m2-enter-active" : "pane-m2-enter-start"}` : "screen-pane";

  // ⚠️"mount"は素のクラス（base値のまま1フレーム描画するためのフレッシュマウント対策。
  // motionTiming.jsのafterNextPaint参照）。ここでtransitionクラスを付けると、
  // 初回マウントの瞬間にtransitionが発火せずポップして見える。
  const m1CoverClass =
    m1Step === "mount" ? "m1-cover" : m1Step === "reveal" ? "m1-cover m1-cover--out" : "m1-cover m1-cover--in";
  const m1TextClass =
    m1Step === "textIn" || m1Step === "hold"
      ? "m1-text m1-text--in"
      : m1Step === "textOut" || m1Step === "reveal"
      ? "m1-text m1-text--out"
      : "m1-text";

  const m6CoverClass =
    m6Step === "mount" ? "m6-cover" : m6Step === "coverOut" ? "m6-cover m6-cover--out" : "m6-cover m6-cover--in";

  return (
    <div className="screen-stack">
      {titleMounted && (
        <div className="screen-pane">
          <TitleScreen onStart={handleStart} />
        </div>
      )}

      {derbyMounted && career && (
        <div className={derbyPaneClass}>
          <DreamDerbyScreen saveSeed={career.saveSeed} onGraduate={handleGraduate} />
        </div>
      )}

      {gradMounted && career && dreamResult && (
        <div className={gradPaneClass}>
          <GraduationScreen
            saveSeed={career.saveSeed}
            startYear={career.year}
            difficulty={career.difficulty}
            dreamChoiceIds={dreamResult.choiceIds}
            onComplete={handleGraduationComplete}
          />
        </div>
      )}

      {weekMounted && career && gameState && (
        <div className="screen-pane">
          <WeekScreen
            saveSeed={career.saveSeed}
            startYear={career.year}
            initialRoster={gameState.roster}
            initialPlayer={gameState.player}
          />
        </div>
      )}

      {phase === "m1" && m1Step != null && (
        <>
          <div className={m1CoverClass} />
          <div className={m1TextClass}>{introLine}</div>
        </>
      )}

      {phase === "m6" && m6Step != null && <div className={m6CoverClass} />}
    </div>
  );
}
