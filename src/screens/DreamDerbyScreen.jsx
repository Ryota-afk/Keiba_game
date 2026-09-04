// 夢のダービー画面（CLAUDE.md §8の手順で確定した`dream-derby-mock2.html`を移植）。
// 60fpsで書き換わる要素（馬・マーカー・SVG境界・カメラ/ズーム）は`dreamDerbyEngine.js`が
// refから取ったDOM要素へ直接書き込む。ここが持つのは低頻度UI（実況欄・チュートリアル・
// 判断カード・タブ・結果オーバーレイ・暗転〜目覚め）のstateだけ。詳細はARCHITECTURE.md §5・
// devlog/wave02.mdを参照。

import React, { useEffect, useMemo, useRef, useState } from "react";
import { generateDreamHorse, generateDreamRivals, assignPostPositions } from "../domain/dreamDerby.js";
import { createDreamDerbyEngine } from "./dreamDerbyEngine.js";
import "./DreamDerbyScreen.css";

const DISPLAY_STATES = ["馬名", "馬番", "非表示"];
const DISPLAY_MODES = ["name", "number", "hidden"];
const SPEED_STATES = ["×1", "×2", "×4"];
const SPEED_SCALES = [1, 2, 4];
const CAMERA_STATES = ["自分", "先頭"];

export function DreamDerbyScreen({ saveSeed, onGraduate }) {
  const dreamHorse = useMemo(() => generateDreamHorse(saveSeed), [saveSeed]);
  const rivals = useMemo(() => generateDreamRivals(saveSeed), [saveSeed]);
  const entries = useMemo(() => assignPostPositions(saveSeed, dreamHorse, rivals), [saveSeed, dreamHorse, rivals]);

  const [introActive, setIntroActive] = useState(true);
  const [messages, setMessages] = useState([]);
  const [tutorial, setTutorial] = useState(null);
  const [card, setCardState] = useState(null);
  const [pickedChoiceId, setPickedChoiceId] = useState(null);
  const [raceStageLabel, setRaceStageLabel] = useState("スタート");
  const [skipEnabled, setSkipEnabled] = useState(false);
  const [sprinting, setSprinting] = useState(false);
  const [displayI, setDisplayI] = useState(0);
  const [speedI, setSpeedI] = useState(0);
  const [cameraI, setCameraI] = useState(0);
  const [activeTab, setActiveTab] = useState("entries");
  const [resultActive, setResultActive] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [wakeActive, setWakeActive] = useState(false);
  const [wakeLines, setWakeLines] = useState([]);
  const [graduateVisible, setGraduateVisible] = useState(false);
  const [choiceIds, setChoiceIds] = useState(null); // 卒業式の戦法4の写像に使う（devlog/wave02.md）

  const engineRef = useRef(null);
  const deviceRef = useRef(null);
  const worldZoomRef = useRef(null);
  const brownPathRef = useRef(null);
  const hedgePathRef = useRef(null);
  const railPath1Ref = useRef(null);
  const railPath2Ref = useRef(null);
  const postsGroupRef = useRef(null);
  const hedgeBumpsRef = useRef(null);
  const turfStripesRef = useRef(null);
  const startGateRef = useRef(null);
  const goalPostRef = useRef(null);
  const selfTrackMarkerRef = useRef(null);
  const distMarkersWrapRef = useRef(null);
  const markerStripRef = useRef(null);
  const raceDistanceRef = useRef(null);
  const raceTimeRef = useRef(null);
  const btnCameraRef = useRef(null);
  const btnDisplayRef = useRef(null);
  const btnSpeedRef = useRef(null);
  const tabPanelsRef = useRef(null);
  const wakeLinesRef = useRef(null);

  useEffect(() => {
    const refs = {
      worldZoom: worldZoomRef.current,
      boundary: {
        brownPath: brownPathRef.current,
        hedgePath: hedgePathRef.current,
        railPath1: railPath1Ref.current,
        railPath2: railPath2Ref.current,
        postsGroup: postsGroupRef.current,
        hedgeBumps: hedgeBumpsRef.current,
        turfStripes: turfStripesRef.current,
      },
      startGate: startGateRef.current,
      goalPost: goalPostRef.current,
      selfTrackMarker: selfTrackMarkerRef.current,
      distMarkersWrap: distMarkersWrapRef.current,
      markerStrip: markerStripRef.current,
      raceDistance: raceDistanceRef.current,
      raceTime: raceTimeRef.current,
      device: deviceRef.current,
      btnCamera: btnCameraRef.current,
      btnDisplay: btnDisplayRef.current,
      btnSpeed: btnSpeedRef.current,
    };
    const callbacks = {
      appendMessage: (text, stamp) => setMessages((prev) => [...prev, { text, stamp }]),
      setTutorial: (v) => setTutorial(v),
      setCard: (v) => {
        setCardState(v);
        setPickedChoiceId(null);
      },
      setRaceStageLabel: (v) => setRaceStageLabel(v),
      setSkipEnabled: (v) => setSkipEnabled(v),
      setSprinting: (v) => setSprinting(v),
      setActiveTab: (v) => setActiveTab(v),
      setIntroActive: (v) => setIntroActive(v),
      setResultActive: (v) => setResultActive(v),
      setResultData: (v) => setResultData(v),
      setConfetti: (v) => setConfetti(v),
      setBlackoutActive: (v) => setBlackoutActive(v),
      setWakeActive: (v) => setWakeActive(v),
      appendWakeLine: (text) => setWakeLines((prev) => [...prev, text]),
      setGraduateVisible: (v) => setGraduateVisible(v),
      setChoiceIds: (v) => setChoiceIds(v),
    };
    const engine = createDreamDerbyEngine({ refs, saveSeed, entries, dreamHorse, rivals, callbacks });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSeed]);

  useEffect(() => {
    if (tabPanelsRef.current) tabPanelsRef.current.scrollTop = tabPanelsRef.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (wakeLinesRef.current) wakeLinesRef.current.scrollTop = wakeLinesRef.current.scrollHeight;
  }, [wakeLines]);

  const displayMode = DISPLAY_MODES[displayI];
  const trackScrollClass = `track-scroll display-${displayMode}${sprinting ? " is-sprinting" : ""}`;

  function handleDisplayClick() {
    const next = (displayI + 1) % DISPLAY_STATES.length;
    setDisplayI(next);
    engineRef.current?.pressDisplayButton(DISPLAY_STATES[next]);
  }
  function handleSpeedClick() {
    const next = (speedI + 1) % SPEED_STATES.length;
    setSpeedI(next);
    engineRef.current?.setSpeedScale(SPEED_SCALES[next]);
  }
  function handleCameraClick() {
    const next = (cameraI + 1) % CAMERA_STATES.length;
    setCameraI(next);
    engineRef.current?.pressCameraButton(CAMERA_STATES[next]);
  }
  function handleChoiceClick(choiceId) {
    setPickedChoiceId(choiceId);
    engineRef.current?.pickCardChoice(choiceId);
  }

  const tutorialClass = `tutorial-toast${tutorial ? " active" : ""}${tutorial?.atTop ? " at-top" : ""}`;
  const tutorialStyle =
    tutorial?.atTop && tutorial.left != null
      ? { "--toast-left": `${tutorial.left}px`, "--arrow-x": `${tutorial.arrowX}px` }
      : undefined;

  return (
    <div className="dream-derby-screen">
      <div className="dream-derby-screen__frame" ref={deviceRef}>
        <div className="race-top">
          <div className="marker-strip" ref={markerStripRef} />
          <div
            className={trackScrollClass}
            style={{ "--gallop": `${(0.3 / SPEED_SCALES[speedI]).toFixed(3)}s` }}
          >
            <div className="world-zoom" ref={worldZoomRef}>
              <svg className="track-boundary" viewBox="-160 -120 710 510" preserveAspectRatio="none">
                <rect x="-160" y="-120" width="710" height="510" fill="#000" />
                <path ref={brownPathRef} fill="#63513A" />
                <g ref={turfStripesRef} />
                <path ref={hedgePathRef} fill="#308005" />
                <g ref={hedgeBumpsRef} />
                <path ref={railPath1Ref} stroke="#A7AF9A" strokeWidth="1.6" fill="none" />
                <path ref={railPath2Ref} stroke="#A7AF9A" strokeWidth="1.6" fill="none" />
                <g ref={postsGroupRef} />
              </svg>
              <div className="start-gate" ref={startGateRef} />
              <div ref={distMarkersWrapRef} />
              <svg className="goal-post" ref={goalPostRef} viewBox="0 0 46 130" preserveAspectRatio="none">
                <path
                  d="M8 130 V56 A15 15 0 0 1 38 56 V130"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d="M8 130 V56 A15 15 0 0 1 38 56 V130"
                  fill="none"
                  stroke="#2f6fe0"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <line x1="23" y1="130" x2="23" y2="46" stroke="#1c1712" strokeWidth="4" />
              </svg>
              {/* 馬のスプライトはdreamDerbyEngine.jsが直接DOMへ追加する */}
            </div>
            <div className="self-track-marker" ref={selfTrackMarkerRef} />
            <div className="hud-distance">
              <span className="hud-stage">{raceStageLabel}</span>
              <span className="hud-readout" ref={raceDistanceRef}>
                残り2400m
              </span>
              <span className="hud-time" ref={raceTimeRef}>
                0:00.0
              </span>
            </div>
            <div className="cycle-buttons">
              <button type="button" className="cycle-btn" ref={btnDisplayRef} onClick={handleDisplayClick}>
                {DISPLAY_STATES[displayI]}
              </button>
              <button type="button" className="cycle-btn" ref={btnSpeedRef} onClick={handleSpeedClick}>
                {SPEED_STATES[speedI]}
              </button>
              <button type="button" className="cycle-btn" ref={btnCameraRef} onClick={handleCameraClick}>
                {CAMERA_STATES[cameraI]}
              </button>
            </div>
          </div>

          <div
            className={`intro-overlay${introActive ? " active" : ""}`}
            onClick={() => engineRef.current?.beginRace()}
          >
            <div className="intro-eyebrow">東京競馬場　第10レース</div>
            <p className="intro-line">
              第92回 日本ダービー。
              <br />
              芝2400メートル、3歳馬18頭。
            </p>
          </div>

          <div className={`result-overlay${resultActive ? " active" : ""}`}>
            <div className="confetti">
              {confetti?.map((p, i) => (
                <span
                  key={i}
                  className="confetti-piece"
                  style={{
                    left: `${p.left}%`,
                    background: p.background,
                    animationDuration: `${p.duration}ms`,
                    animationDelay: `${p.delay}ms`,
                  }}
                />
              ))}
            </div>
            {resultData && (
              <>
                <div className="result-position">{resultData.position}着</div>
                <div className="result-of">{resultData.fieldSize}頭中</div>
                <div className="result-board">
                  <div className="result-board-row result-board-head">
                    <span>着</span>
                    <span>馬番</span>
                    <span>馬名</span>
                    <span>着差</span>
                  </div>
                  {resultData.rows.map((r) => (
                    <div key={r.num} className={`result-board-row${r.isSelf ? " is-self" : ""}`}>
                      <span>{r.pos}</span>
                      <span>{r.num}</span>
                      <span className="result-board-name">{r.name}</span>
                      <span>{r.margin}</span>
                    </div>
                  ))}
                  <div className="result-splits">{resultData.splitsText}</div>
                </div>
                <p className="result-flavor">{resultData.flavor}</p>
              </>
            )}
          </div>

          <div className={`room-scene${wakeActive ? " active" : ""}`}>
            <svg viewBox="0 0 390 300" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y="0" width="390" height="244" fill="#cbb794" />
              <rect x="0" y="244" width="390" height="8" fill="#a8956f" />
              <rect x="0" y="252" width="390" height="48" fill="#9a6a3c" />
              <rect x="0" y="272" width="390" height="3" fill="#875a30" />
              <rect x="206" y="28" width="126" height="110" fill="#f2ede0" />
              <rect x="212" y="34" width="114" height="98" fill="#a8daf2" />
              <rect x="212" y="108" width="114" height="24" fill="#7fc06a" />
              <rect x="265" y="34" width="6" height="98" fill="#f2ede0" />
              <rect x="212" y="78" width="114" height="6" fill="#f2ede0" />
              <polygon points="212,138 326,138 372,252 156,252" fill="#fff6c8" opacity="0.3" />
              <rect x="188" y="20" width="20" height="132" fill="#e3ded0" />
              <rect x="330" y="20" width="20" height="132" fill="#e3ded0" />
              <rect x="195" y="20" width="4" height="132" fill="#d3ccbb" />
              <rect x="337" y="20" width="4" height="132" fill="#d3ccbb" />
              <rect x="38" y="34" width="66" height="50" fill="#f2ede0" />
              <rect x="44" y="40" width="54" height="38" fill="#dfe9d8" />
              <rect x="54" y="54" width="26" height="13" fill="#6b4a2a" />
              <rect x="76" y="48" width="10" height="9" fill="#6b4a2a" />
              <rect x="56" y="67" width="4" height="10" fill="#6b4a2a" />
              <rect x="72" y="67" width="4" height="10" fill="#6b4a2a" />
              <rect x="22" y="140" width="16" height="112" fill="#6b4a2a" />
              <rect x="22" y="216" width="212" height="36" fill="#7d5730" />
              <rect x="38" y="198" width="192" height="20" fill="#c9d6e8" />
              <rect x="96" y="188" width="122" height="12" fill="#c9d6e8" />
              <rect x="126" y="180" width="72" height="9" fill="#bccbe0" />
              <rect x="42" y="184" width="52" height="16" fill="#f5f1e4" />
              <rect x="54" y="166" width="26" height="18" fill="#f0c8a0" />
              <rect x="52" y="159" width="30" height="9" fill="#3a2a1a" />
              <rect x="52" y="166" width="6" height="9" fill="#3a2a1a" />
              <rect x="240" y="212" width="44" height="40" fill="#7d5730" />
              <rect x="248" y="188" width="28" height="24" fill="#f2ede0" />
              <rect x="252" y="192" width="20" height="16" fill="#3a3a3a" />
              <rect x="261" y="195" width="2" height="7" fill="#f2ede0" />
              <rect x="261" y="199" width="7" height="2" fill="#f2ede0" />
              <rect x="313" y="112" width="30" height="12" fill="#4a3423" />
              <rect x="316" y="120" width="26" height="22" fill="#f0c8a0" />
              <rect x="311" y="118" width="6" height="16" fill="#4a3423" />
              <rect x="341" y="118" width="6" height="16" fill="#4a3423" />
              <rect x="308" y="142" width="42" height="34" fill="#7f97a6" />
              <rect x="312" y="176" width="34" height="46" fill="#e8e2d4" />
              <rect x="298" y="148" width="10" height="44" fill="#7f97a6" />
              <rect x="350" y="148" width="10" height="44" fill="#7f97a6" />
              <rect x="298" y="192" width="10" height="9" fill="#f0c8a0" />
              <rect x="350" y="192" width="10" height="9" fill="#f0c8a0" />
              <rect x="316" y="222" width="11" height="26" fill="#4a5a66" />
              <rect x="332" y="222" width="11" height="26" fill="#4a5a66" />
              <rect x="313" y="246" width="15" height="6" fill="#2e2620" />
              <rect x="331" y="246" width="15" height="6" fill="#2e2620" />
            </svg>
          </div>
        </div>

        <div className="race-bottom">
          <div className="tabbar" style={{ display: wakeActive ? "none" : "" }}>
            <button
              type="button"
              className={activeTab === "entries" ? "active" : ""}
              onClick={() => setActiveTab("entries")}
            >
              出馬表
            </button>
            <button
              type="button"
              className={activeTab === "messages" ? "active" : ""}
              onClick={() => setActiveTab("messages")}
            >
              実況
            </button>
            <button
              type="button"
              className="skip-btn"
              disabled={!skipEnabled}
              onClick={() => engineRef.current?.skip()}
            >
              スキップ
            </button>
          </div>
          <div className="tab-panels" ref={tabPanelsRef} style={{ display: wakeActive ? "none" : "" }}>
            <div className={`tab-panel${activeTab === "entries" ? " active" : ""}`}>
              {entries.map((e) => (
                <div key={e.num} className={`entry-row${e.isSelf ? " is-self" : ""}`}>
                  <span className="entry-num">{e.num}</span>
                  <span>{e.name}</span>
                </div>
              ))}
            </div>
            <div className={`tab-panel${activeTab === "messages" ? " active" : ""}`}>
              {messages.map((m, i) => (
                <p key={i} className={`msg-line${i === messages.length - 1 ? " is-latest" : ""}`}>
                  {m.stamp ? <span className="msg-time">{m.stamp}</span> : null}
                  {m.text}
                </p>
              ))}
            </div>
          </div>

          <div className={`card-panel${card ? " active" : ""}`}>
            {card && (
              <>
                <div className="card-label">{card.label}</div>
                <div className="card-situation">{card.situation}</div>
                <div className="card-choices">
                  {card.choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`card-choice${pickedChoiceId === c.id ? " is-picked" : ""}`}
                      disabled={pickedChoiceId != null}
                      onClick={() => handleChoiceClick(c.id)}
                    >
                      {c.label}
                      {c.hint ? <span className="card-choice-hint">{c.hint}</span> : null}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={`wake-panel${wakeActive ? " active" : ""}`}>
            <div className="wake-lines" ref={wakeLinesRef}>
              {wakeLines.map((text, i) => (
                <p key={i} className="msg-line">
                  {text}
                </p>
              ))}
            </div>
            <button
              type="button"
              className="next-btn"
              style={{ display: graduateVisible ? "" : "none" }}
              onClick={() =>
                onGraduate({
                  dreamHorseId: dreamHorse.id,
                  choiceIds,
                  won: resultData?.position === 1,
                })
              }
            >
              卒業式へ
            </button>
          </div>
        </div>

        <div className={`blackout${blackoutActive ? " active" : ""}`} />

        <div className={tutorialClass} style={tutorialStyle}>
          <span className="tutorial-toast-label">
            {tutorial?.progressText ? (
              <span className="tutorial-toast-progress">{tutorial.progressText}</span>
            ) : null}
          </span>
          <div className="tutorial-toast-body">
            <p className="tutorial-toast-text">{tutorial?.text}</p>
            {tutorial && !tutorial.requireButton ? (
              <button
                type="button"
                className="tutorial-toast-dismiss"
                onClick={() => engineRef.current?.dismissTutorial()}
              >
                わかった
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
