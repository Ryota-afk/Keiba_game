// 卒業式画面（`design/mocks/graduation-mock2.html`をReactへ移植。CLAUDE.md §8手順で確定）。
// 60fpsの描画が要らない画面なので、DreamDerbyScreenの「エンジン」パターンは使わず、
// 通常のReact state＋setTimeoutで行を1つずつ足していく。

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createInitialRoster } from "../domain/career.js";
import {
  generateSchoolRecord,
  offerStables,
  strategyFromDreamChoices,
  SCHOOL_RECORD_TOP_GRADE,
} from "../domain/graduation.js";
import { completeGraduation } from "../controllers/careerController.js";
import { GRADE_SCALE } from "../data/grades.js";
import {
  MAX_FAMILY_NAME,
  MAX_GIVEN_NAME,
  isAllowedNameChar,
  sanitizeName,
} from "../data/nameRules.js";
import { DISTANCE_BANDS, SURFACES } from "../data/aptitudeCategories.js";
import { DISTANCE_BAND_LABELS, SURFACE_LABELS, STRATEGY_LABELS } from "../data/aptitudeLabels.js";
import { specialtyLabel } from "../data/stableSpecialtyLabels.js";
import {
  NAME_PROMPT_TEXT,
  ceremonyLines,
  reportLines,
  DREAM_RECORD_INTRO,
  dreamRecordChoices,
  stableConfirmedLine,
  STABLE_OFFER_HEADING,
} from "../data/graduationText.js";
import { cssMs, scheduleOnce, afterNextPaint } from "./motionTiming.js";
import { schoolSceneMarkup, ceremonySceneMarkup } from "../view/wakeGradScenes.js";
import "./GraduationScreen.css";

const LINE_INTERVAL_MS = 700;

function gradePercent(grade) {
  return (GRADE_SCALE.indexOf(grade) / (GRADE_SCALE.length - 1)) * 100;
}

function ScoreRow({ label, grade }) {
  const isTop = grade === SCHOOL_RECORD_TOP_GRADE;
  const pct = gradePercent(grade);
  return (
    <div className="score-row">
      <div className="score-name">{label}</div>
      <div className="score-bar-wrap">
        <div className="score-track" />
        <div className={`score-fill${isTop ? " is-top" : ""}`} style={{ width: `${pct}%` }} />
        <span className={`score-grade${isTop ? " is-top" : ""}`} style={{ left: `${pct}%` }}>
          {grade}
        </span>
      </div>
    </div>
  );
}

// 上半分の絵。組み立ては`view/wakeGradScenes.js`（名前入力＝案C「校門と桜」・卒業式＝案A「講堂の壇上」）。
// 純関数なので読み込み時に1回だけ組み立てる。
const SCHOOL_SCENE_SVG = schoolSceneMarkup();
const CEREMONY_SCENE_SVG = ceremonySceneMarkup();

function SchoolScene() {
  return <div className="grad-scene" dangerouslySetInnerHTML={{ __html: SCHOOL_SCENE_SVG }} />;
}

function CeremonyScene() {
  return <div className="grad-scene" dangerouslySetInnerHTML={{ __html: CEREMONY_SCENE_SVG }} />;
}

function Scoreboard({ schoolRecord }) {
  return (
    <div className="scoreboard">
      <div className="score-head">
        <div className="score-label">成績表</div>
        <div className="score-scale">
          <span>{GRADE_SCALE[0]}</span>
          <span className="score-scale-line" />
          <span>{GRADE_SCALE[GRADE_SCALE.length - 1]}</span>
        </div>
      </div>
      <div className="score-groups">
        <div className="score-group">
          {DISTANCE_BANDS.map((band) => (
            <ScoreRow key={band} label={DISTANCE_BAND_LABELS[band]} grade={schoolRecord.distances[band]} />
          ))}
        </div>
        <div className="score-group">
          {SURFACES.map((surface) => (
            <ScoreRow key={surface} label={SURFACE_LABELS[surface]} grade={schoolRecord.surfaces[surface]} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ saveSeed: number|string, startYear: number, difficulty: string,
 *           dreamChoiceIds: { midRace?: string|null, stretch?: string|null },
 *           onComplete: (state: { roster: object, player: object }) => void }} props
 */
export function GraduationScreen({ saveSeed, startYear, difficulty, dreamChoiceIds, initialRoster, onComplete }) {
  // ⭐開始前の事前シミュレーション（`domain/bootstrap.js`・`arch/race-program.md`§11）が
  // 夢のダービーの間に裏で組んだロースターを使う——クラス・戦績・収得賞金・年齢・繁殖プールが
  // 揃った状態でキャリアが始まる（通しプレイ①「全員初出走」の解消）。`initialRoster`が
  // まだ来ていなければ（呼び出し元が渡していない・タイミングの都合）、素の`createInitialRoster`
  // にフォールバックする（従来どおりの「全員初出走」の状態。安全網であって本来の経路ではない）。
  const roster = useMemo(() => initialRoster ?? createInitialRoster(saveSeed), [initialRoster, saveSeed]);
  const schoolRecord = useMemo(() => generateSchoolRecord(saveSeed), [saveSeed]);
  const stableOffers = useMemo(
    () => offerStables(saveSeed, roster.stables, schoolRecord),
    [saveSeed, roster, schoolRecord]
  );
  const derivedStrategy = useMemo(
    () => strategyFromDreamChoices(dreamChoiceIds),
    [dreamChoiceIds]
  );

  const [stage, setStage] = useState("name"); // name | ceremony | report | stable
  const [familyName, setFamilyName] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyNameHadRejected, setFamilyNameHadRejected] = useState(false);
  const [givenNameHadRejected, setGivenNameHadRejected] = useState(false);
  const [ceremonyShown, setCeremonyShown] = useState([]);
  const [ceremonyNextVisible, setCeremonyNextVisible] = useState(false);
  const [reportShown, setReportShown] = useState([]);
  const [reportChoicesVisible, setReportChoicesVisible] = useState(false);
  const [dreamRecordChoice, setDreamRecordChoice] = useState(null);
  const [pickedStableId, setPickedStableId] = useState(null);
  const timersRef = useRef([]);

  // ③名前入力→式典：上半分だけのクロスフェード。
  const [topTransition, setTopTransition] = useState(null); // { from: "name" } の間だけ有効
  const [topFadeActive, setTopFadeActive] = useState(false);
  // ④式典→成績表：下半分だけが下から入る。
  const [reportEnterActive, setReportEnterActive] = useState(false);
  // ⑤成績表→厩舎選び：下半分だけの左右スライド。
  const [bottomSwap, setBottomSwap] = useState(null); // { from: "report" } の間だけ有効
  const [bottomSwapActive, setBottomSwapActive] = useState(false);

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function revealLines(lines, setShown, onDone) {
    clearTimers();
    setShown([]);
    lines.forEach((line, i) => {
      const t = setTimeout(() => {
        setShown((prev) => [...prev, line]);
        if (i === lines.length - 1 && onDone) {
          timersRef.current.push(setTimeout(onDone, LINE_INTERVAL_MS));
        }
      }, LINE_INTERVAL_MS * i);
      timersRef.current.push(t);
    });
  }

  const fullName = `${familyName}${givenName}`;
  const nameFilled = familyName.trim().length > 0 && givenName.trim().length > 0;
  const showNameWarning = familyNameHadRejected || givenNameHadRejected;

  // 文字種の判定（漢字・ひらがな・カタカナ以外を弾く）と、文字数上限だけに
  // 当たったとき（案内を出さない）を区別する。空欄に戻ったら案内もリセットする。
  function handleNameInput(raw, max, setValue, setHadRejected) {
    if (raw === "") {
      setValue("");
      setHadRejected(false);
      return;
    }
    const hasDisallowedChar = [...raw].some((c) => !isAllowedNameChar(c));
    if (hasDisallowedChar) setHadRejected(true);
    setValue(sanitizeName(raw, max));
  }

  function goCeremony() {
    setTopTransition({ from: "name" });
    setTopFadeActive(false);
    setStage("ceremony");
    revealLines(ceremonyLines(fullName), setCeremonyShown, () => setCeremonyNextVisible(true));
  }

  function goReport() {
    setStage("report");
    setReportEnterActive(false);
    revealLines(reportLines(schoolRecord), setReportShown, () => setReportChoicesVisible(true));
  }

  function pickDreamRecordChoice(id) {
    if (dreamRecordChoice) return;
    setDreamRecordChoice(id);
    timersRef.current.push(
      setTimeout(() => {
        setBottomSwap({ from: "report" });
        setBottomSwapActive(false);
        setStage("stable");
      }, 500)
    );
  }

  // ③上半分だけのクロスフェード（name→ceremony）の段取り。
  useEffect(() => {
    if (!topTransition) return undefined;
    if (!topFadeActive) return afterNextPaint(() => setTopFadeActive(true));
    return scheduleOnce(() => {
      setTopTransition(null);
      setTopFadeActive(false);
    }, cssMs("--m3-dur"));
  }, [topTransition, topFadeActive]);

  // ④下半分だけが下から入る（ceremony→report）の段取り。
  useEffect(() => {
    if (stage !== "report" || reportEnterActive) return undefined;
    return afterNextPaint(() => setReportEnterActive(true));
  }, [stage, reportEnterActive]);

  // ⑤下半分だけの左右スライド（report→stable）の段取り。
  useEffect(() => {
    if (!bottomSwap) return undefined;
    if (!bottomSwapActive) return afterNextPaint(() => setBottomSwapActive(true));
    return scheduleOnce(() => {
      setBottomSwap(null);
      setBottomSwapActive(false);
    }, cssMs("--m5-dur"));
  }, [bottomSwap, bottomSwapActive]);

  /** grad-top内の中身をstageから決める（③のクロスフェードで新旧2枚を同時に呼ぶ）。 */
  function renderTop(s) {
    if (s === "name") return <SchoolScene />;
    if (s === "ceremony") return <CeremonyScene />;
    return <Scoreboard schoolRecord={schoolRecord} />;
  }

  /** 「report」段の下半分の中身（④の入場・⑤のスライドで枠だけ差し替えて呼ぶ）。 */
  function renderReportBottom() {
    return (
      <>
        <div className="grad-lines">
          {reportShown.map((text, i) => (
            <p key={i} className="grad-msg-line">
              {text}
            </p>
          ))}
        </div>
        {reportChoicesVisible && (
          <>
            <div className="grad-section-heading">{DREAM_RECORD_INTRO}</div>
            <div className="grad-choices">
              {dreamRecordChoices(STRATEGY_LABELS[derivedStrategy]).map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`grad-card-choice${dreamRecordChoice === choice.id ? " is-picked" : ""}${
                    dreamRecordChoice && dreamRecordChoice !== choice.id ? " is-disabled" : ""
                  }`}
                  onClick={() => pickDreamRecordChoice(choice.id)}
                >
                  {choice.label}
                  <span className="grad-card-choice-hint">{choice.hint}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  /** 「stable」段の下半分の中身（⑤のスライドで枠だけ差し替えて呼ぶ）。 */
  function renderStableBottom() {
    return (
      <div className="grad-lines">
        <div className="grad-section-heading">{STABLE_OFFER_HEADING}</div>
        <div className="grad-choices">
          {stableOffers.map((stable) => (
            <button
              key={stable.id}
              type="button"
              className={`grad-card-choice${pickedStableId === stable.id ? " is-picked" : ""}${
                pickedStableId && pickedStableId !== stable.id ? " is-disabled" : ""
              }`}
              onClick={() => pickStable(stable.id)}
            >
              {stable.trainerName}
              <span className="grad-card-choice-hint">{specialtyLabel(stable.specialty)}</span>
            </button>
          ))}
        </div>
        {pickedStable && (
          <p className="grad-msg-line" style={{ marginTop: 10 }}>
            {stableConfirmedLine(pickedStable.trainerFamilyName)}
          </p>
        )}
      </div>
    );
  }

  function pickStable(stableId) {
    if (pickedStableId) return;
    setPickedStableId(stableId);
    const { player } = completeGraduation(saveSeed, {
      schoolRecord,
      dreamChoiceIds,
      dreamRecordChoice,
      familyName,
      givenName,
      stableId,
      startYear,
      difficulty,
      usedNames: roster.usedJockeyNames,
    });
    // 選んだ厩舎の頭数へ所属関係の表示は今回のスコープでは扱わない（第2弾の範囲）。
    timersRef.current.push(setTimeout(() => onComplete({ roster, player }), 900));
  }

  const pickedStable = pickedStableId ? stableOffers.find((s) => s.id === pickedStableId) : null;

  return (
    <div className="graduation-screen">
      <div className="grad-top">
        {topTransition ? (
          <>
            <div className={`grad-top-layer${topFadeActive ? " grad-top-layer--out" : ""}`}>
              {renderTop(topTransition.from)}
            </div>
            <div className={`grad-top-layer${topFadeActive ? " grad-top-layer--in" : " grad-top-layer--in-start"}`}>
              {renderTop(stage)}
            </div>
          </>
        ) : (
          renderTop(stage)
        )}
      </div>

      <div className="grad-bottom">
        {stage === "name" && (
          <div className="grad-panel">
            <div className="grad-system-toast">{NAME_PROMPT_TEXT}</div>
            <div className="grad-name-form">
              <div className="grad-name-field">
                <label htmlFor="graduationFamilyName">姓</label>
                <input
                  id="graduationFamilyName"
                  type="text"
                  maxLength={MAX_FAMILY_NAME}
                  autoComplete="off"
                  value={familyName}
                  onChange={(e) =>
                    handleNameInput(e.target.value, MAX_FAMILY_NAME, setFamilyName, setFamilyNameHadRejected)
                  }
                />
              </div>
              <div className="grad-name-field">
                <label htmlFor="graduationGivenName">名</label>
                <input
                  id="graduationGivenName"
                  type="text"
                  maxLength={MAX_GIVEN_NAME}
                  autoComplete="off"
                  value={givenName}
                  onChange={(e) =>
                    handleNameInput(e.target.value, MAX_GIVEN_NAME, setGivenName, setGivenNameHadRejected)
                  }
                />
              </div>
            </div>
            {showNameWarning && <p className="grad-name-warning">使える文字は、漢字・ひらがな・カタカナです</p>}
            <div className="grad-next-wrap">
              <button type="button" className="grad-next-btn" disabled={!nameFilled} onClick={goCeremony}>
                次へ
              </button>
            </div>
            <div className="grad-panel-spacer" />
          </div>
        )}

        {stage === "ceremony" && (
          <div className="grad-panel">
            <div className="grad-lines">
              {ceremonyShown.map((text, i) => (
                <p key={i} className="grad-msg-line">
                  {text}
                </p>
              ))}
            </div>
            <div className="grad-next-wrap">
              {ceremonyNextVisible && (
                <button type="button" className="grad-next-btn" onClick={goReport}>
                  次へ
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "report" && !bottomSwap && (
          <div className={`grad-panel${reportEnterActive ? " grad-panel--enter-active" : " grad-panel--enter-start"}`}>
            {renderReportBottom()}
          </div>
        )}

        {stage === "stable" && !bottomSwap && <div className="grad-panel">{renderStableBottom()}</div>}

        {bottomSwap && (
          <>
            <div className={`grad-panel grad-panel--swap-out${bottomSwapActive ? " is-active" : ""}`}>
              {renderReportBottom()}
            </div>
            <div className={`grad-panel grad-panel--swap-in${bottomSwapActive ? " is-active" : ""}`}>
              {renderStableBottom()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
