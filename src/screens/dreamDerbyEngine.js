// 夢のダービー：レース画面のDOM/タイマー駆動エンジン（DOM・タイマー依存、JSX無し）。
// dream-derby-mock2.html（合意済みモック）を移植。ARCHITECTURE.md §5の設計方針どおり、
// 60fpsで書き換わる要素（馬18頭・マーカー・SVG境界・カメラ/ズーム）はReactの外——
// `requestAnimationFrame`ループでrefから取ったDOM要素へ直接書き込む。可変状態はすべて
// このファクトリ関数のクロージャ内に閉じ込め、`destroy()`で対称に破棄する
// （React 18 StrictModeの開発時二重マウントでも汚染されないように）。
// Reactが持つ低頻度UI（実況欄・チュートリアル文言・判断カードの開閉・結果オーバーレイ・
// 暗転〜目覚めの各段階・タブ切替・表示/速度モードのラベル）は`callbacks`経由で伝える。
//
// ⚠️モックからの設計変更点（承認済み計画の「解決した設計判断」1番）：
// モックは「残り1200m」から最終着差（finishGapで自分は常に0＝常に勝つ前提）へ収束を
// 始めていたが、その瞬間はまだ直線の判断カード（結果に影響する）が選ばれていない。
// この実装では、直線カードの選択が確定した瞬間（`pickCardChoice`のstretch分岐）で
// 初めて`runDreamDerbyRace`を呼び、以後の隊列収束をその結果に基づかせる。自分が負ける
// こともある（`domain/dreamDerby.js`のコメントどおり「選択によっては負ける」）。

import {
  TOTAL_DISTANCE,
  T_FINAL_STRETCH,
  T_FINISH,
  VIEW_SPAN,
  DRAW_X0,
  DRAW_X1,
  TRACK_W,
  BROWN_TOP,
  RAIL1_Y,
  HEDGE_TOP,
  RAIL2_Y,
  TURF_TOP,
  STRIPE_H,
  TURF_BOTTOM_MARGIN,
  AMP_MAX,
  POST_SPACING_M,
  BUMP_SPACING_M,
} from "../data/dreamDerbyCourse.js";
import { WAKE_LINES } from "../data/dreamDerbyCommentary.js";
import { marginLabelFor } from "../data/raceMargins.js";
import {
  distanceAtTime,
  timeAtDistance,
  viewHash01,
  clamp01,
  gateY,
  laneY,
  isCurvingAt,
  zoomForSpread,
  cameraTargetFor,
  stepCamera,
  worldFixedFraction,
  curveY,
  curveRow,
  bandPath,
  formatPoint,
  gapMetersAt,
} from "../view/dreamDerbyRace.js";
import { horseSvgMarkup, coatFor, silkFor, capColorFor, gaitPhaseFor } from "../view/dreamDerbySprite.js";
import { fieldOrder, commentaryVars, pickCommentaryLine, fmtStamp } from "../view/dreamDerbyCommentary.js";
import { choicesFor } from "../domain/judgmentCard.js";
import { runDreamDerbyRace } from "../domain/dreamDerby.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 夢のダービーのレース進行エンジンを作る。
 * @param {object} opts
 * @param {object} opts.refs - 呼び出し側（DreamDerbyScreen.jsx）が`useEffect`内で解決した
 *   実DOM要素（`ref.current`）の束。`start()`が呼ばれる時点で全て非nullであること。
 *   { worldZoom, boundary:{brownPath,hedgePath,railPath1,railPath2,postsGroup,hedgeBumps,turfStripes},
 *     startGate, goalPost, selfTrackMarker, distMarkersWrap, markerStrip,
 *     raceDistance, raceTime, device, btnCamera, btnDisplay, btnSpeed }
 * @param {number|string} opts.saveSeed
 * @param {{num:number,name:string,isSelf:boolean,horse:object}[]} opts.entries - 馬番昇順（`assignPostPositions`の出力）
 * @param {object} opts.dreamHorse - `generateDreamHorse`の出力
 * @param {object[]} opts.rivals - `generateDreamRivals`の出力
 * @param {object} opts.callbacks - Reactのstateセッターの束（下記参照）
 */
export function createDreamDerbyEngine({ refs, saveSeed, entries, dreamHorse, rivals, callbacks }) {
  const selfEntry = entries.find((e) => e.isSelf);
  const numByHorseId = new Map(entries.map((e) => [e.horse.id, e.num]));

  // ===== 可変状態（すべてこのクロージャ内。モジュールスコープには置かない） =====
  let rafId = null;
  let pendingTimers = [];
  let raceSeconds = 0;
  let clockRunning = false;
  let lastTick = 0;
  let raceStarted = false;
  let cameraMode = "self";
  let speedScale = 1;
  let camState = null;
  let camLastNow = null;
  let curvature = 0;
  let targetCurving = false;
  let zoomCurrent = 1;
  let sayCount = 0;
  let judgmentTutorialShown = false;
  let tutorialActive = false;
  let tutorialDismissHandler = () => hideTutorialInternal();
  let activeButtonTutorial = null; // { kind: "camera"|"display", onPress(label) }
  let pendingCard = null; // { kind: "mid"|"stretch", choices }
  const choiceIds = { midRace: null, stretch: null };
  let finished = false; // ゴール処理（doFinish）が既に走ったか。連打対策（devlog参照）
  let raceResult = null; // runDreamDerbyRaceの出力（直線カード確定後にだけ入る）
  let confirmedAt = null; // 直線カードで選んだ時刻(秒)
  let marginByNum = new Map(); // 馬番 -> 最終着差(m)。raceResult確定後にだけ埋まる
  let lastPositions = {};
  const sprites = new Map(); // 馬番 -> HTMLElement
  const chips = new Map(); // 馬番 -> HTMLElement
  const distMarkerEls = []; // { el, distance }

  function raceTimeout(fn, delay) {
    const id = setTimeout(fn, delay);
    pendingTimers.push(id);
    return id;
  }
  function clearPendingTimers() {
    pendingTimers.forEach((id) => clearTimeout(id));
    pendingTimers = [];
  }

  // ===== 距離・カメラ =====
  function distanceOf(num, t) {
    const margin = marginByNum.has(num) ? marginByNum.get(num) : null;
    return distanceAtTime(t) + gapMetersAt(num, t, { marginMeters: margin, confirmedAt });
  }
  function currentLeaderNum(t) {
    let best = selfEntry.num;
    let bestD = distanceOf(selfEntry.num, t);
    entries.forEach((e) => {
      if (e.isSelf) return;
      const d = distanceOf(e.num, t);
      if (d > bestD) {
        bestD = d;
        best = e.num;
      }
    });
    return best;
  }
  function currentLeaderEntry() {
    let best = null;
    let bestX = -1;
    entries.forEach((e) => {
      const p = lastPositions[e.num];
      if (p && p.x > bestX) {
        bestX = p.x;
        best = e;
      }
    });
    return best;
  }
  function snapCamera() {
    camState = null;
  }
  function currentCameraState(t) {
    const now = performance.now();
    const target = cameraTargetFor(cameraMode, {
      raceStarted,
      t,
      selfDistance: distanceOf(selfEntry.num, t),
      leaderDistance: distanceOf(currentLeaderNum(t), t),
    });
    const dt = camState ? (now - camLastNow) / 1000 : 0;
    camLastNow = now;
    const { rendered, next } = stepCamera(camState, target, dt);
    camState = next;
    return rendered;
  }

  // ===== 描画（毎フレーム） =====
  function positionWorldFixedEl(el, distance, cameraDistance, anchor) {
    const frac = worldFixedFraction(distance, cameraDistance, anchor);
    if (frac === null) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    el.style.left = `${frac * 100}%`;
  }
  function layout(positions) {
    lastPositions = positions;
    for (const [numStr, { x, y }] of Object.entries(positions)) {
      const el = sprites.get(Number(numStr));
      if (!el) continue;
      el.style.left = `${x * 100}%`;
      el.style.top = `${y * 100}%`;
    }
    const ordered = Object.entries(positions)
      .map(([numStr, p]) => ({ num: Number(numStr), x: clamp01(p.cx ?? p.x) }))
      .sort((a, b) => a.x - b.x);
    let lastX = -1;
    let stack = 0;
    for (const { num, x } of ordered) {
      const chip = chips.get(num);
      if (!chip) continue;
      const px = x * TRACK_W;
      stack = px - lastX < 11 ? (stack + 1) % 3 : 0;
      lastX = px;
      chip.style.left = `${4 + x * 92}%`;
      chip.style.top = `${50 + (stack === 1 ? 18 : stack === 2 ? -18 : 0)}%`;
    }
    applyCameraFocus();
  }
  function applyCameraFocus() {
    sprites.forEach((el) => el.classList.remove("is-leader-focus"));
    if (cameraMode !== "leader") return;
    const leader = currentLeaderEntry();
    if (leader && !leader.isSelf) sprites.get(leader.num).classList.add("is-leader-focus");
  }
  function zoomForSpreadAt(t) {
    let minD = Infinity;
    let maxD = -Infinity;
    entries.forEach((e) => {
      const d = distanceOf(e.num, t);
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
    });
    return zoomForSpread(maxD - minD);
  }
  function updateBoundary(cameraDistance, anchor) {
    curvature += (Number(targetCurving) - curvature) * 0.06;
    if (Math.abs(curvature) < 0.001) curvature = 0;
    const amp = curvature * AMP_MAX;

    const rowHedgeTop = curveRow(HEDGE_TOP, amp);
    const rowTurfTop = curveRow(TURF_TOP, amp);

    refs.boundary.brownPath.setAttribute(
      "d",
      bandPath(
        [
          [DRAW_X0, BROWN_TOP],
          [DRAW_X1, BROWN_TOP],
        ],
        rowHedgeTop
      )
    );
    refs.boundary.hedgePath.setAttribute("d", bandPath(rowHedgeTop, rowTurfTop));
    refs.boundary.railPath1.setAttribute("d", `M${curveRow(RAIL1_Y, amp).map(formatPoint).join(" L")}`);
    refs.boundary.railPath2.setAttribute("d", `M${curveRow(RAIL2_Y, amp).map(formatPoint).join(" L")}`);

    const pxPerM = TRACK_W / VIEW_SPAN;
    const worldAtX = (x) => cameraDistance + (x / TRACK_W - anchor) * VIEW_SPAN;
    const screenX = (worldD) => anchor * TRACK_W + (worldD - cameraDistance) * pxPerM;

    refs.boundary.postsGroup.innerHTML = "";
    for (let k = Math.floor(worldAtX(DRAW_X0) / POST_SPACING_M); ; k += 1) {
      const x = screenX(k * POST_SPACING_M);
      if (x > DRAW_X1) break;
      const y = curveY(RAIL1_Y, amp, x / TRACK_W);
      const tick = document.createElementNS(SVG_NS, "line");
      tick.setAttribute("class", "post-tick");
      tick.setAttribute("x1", x.toFixed(1));
      tick.setAttribute("x2", x.toFixed(1));
      tick.setAttribute("y1", (y - 3).toFixed(1));
      tick.setAttribute("y2", (y + 4).toFixed(1));
      refs.boundary.postsGroup.appendChild(tick);
    }
    refs.boundary.hedgeBumps.innerHTML = "";
    for (let k = Math.floor(worldAtX(DRAW_X0) / BUMP_SPACING_M); ; k += 1) {
      const x = screenX((k + 0.5) * BUMP_SPACING_M);
      if (x > DRAW_X1) break;
      const y = curveY(HEDGE_TOP, amp, x / TRACK_W);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("class", "hedge-bump");
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("r", "3.2");
      refs.boundary.hedgeBumps.appendChild(c);
    }

    refs.boundary.turfStripes.innerHTML = "";
    const base = document.createElementNS(SVG_NS, "path");
    base.setAttribute("fill", "#1DD919");
    base.setAttribute(
      "d",
      bandPath(rowTurfTop, [
        [DRAW_X0, TURF_BOTTOM_MARGIN],
        [DRAW_X1, TURF_BOTTOM_MARGIN],
      ])
    );
    refs.boundary.turfStripes.appendChild(base);
    const stripeCount = Math.ceil((TURF_BOTTOM_MARGIN - TURF_TOP) / STRIPE_H);
    for (let k = 1; k < stripeCount; k += 2) {
      const top = TURF_TOP + k * STRIPE_H;
      const bot = Math.min(top + STRIPE_H, TURF_BOTTOM_MARGIN);
      const band = document.createElementNS(SVG_NS, "path");
      band.setAttribute("fill", "#1CC617");
      band.setAttribute("d", bandPath(curveRow(top, amp), curveRow(bot, amp)));
      refs.boundary.turfStripes.appendChild(band);
    }
  }
  function renderWorld(t) {
    const { distance: cameraDistance, anchor } = currentCameraState(t);
    const positions = {};
    const spread = clamp01(t / 3);
    entries.forEach((e, i) => {
      const d = distanceOf(e.num, t);
      const rowGateY = gateY(i, entries.length);
      const y = rowGateY + (laneY(e.num, t, { isSelf: e.isSelf }) - rowGateY) * spread;
      positions[e.num] = {
        x: Math.max(-0.4, Math.min(1.4, anchor + (d - cameraDistance) / VIEW_SPAN)),
        y,
        cx: 0.5 + (d - cameraDistance) / (VIEW_SPAN * 3),
      };
    });
    layout(positions);
    positionWorldFixedEl(refs.startGate, 0, cameraDistance, anchor);
    distMarkerEls.forEach((m) => positionWorldFixedEl(m.el, m.distance, cameraDistance, anchor));
    positionWorldFixedEl(refs.goalPost, TOTAL_DISTANCE, cameraDistance, anchor);
    targetCurving = isCurvingAt(cameraDistance);
    zoomCurrent += (zoomForSpreadAt(t) - zoomCurrent) * 0.03;
    refs.worldZoom.style.transform = `scale(${zoomCurrent.toFixed(3)})`;
    const selfCx = positions[selfEntry.num] ? clamp01(positions[selfEntry.num].cx) : 0.5;
    refs.selfTrackMarker.style.left = `${4 + selfCx * 92}%`;
    updateBoundary(cameraDistance, anchor);
  }
  function updateHudDom() {
    const d = distanceAtTime(raceSeconds);
    refs.raceDistance.textContent = `残り${Math.max(0, Math.round(TOTAL_DISTANCE - d))}m`;
    const min = Math.floor(raceSeconds / 60);
    const sec = (raceSeconds % 60).toFixed(1).padStart(4, "0");
    refs.raceTime.textContent = `${min}:${sec}`;
  }

  // ===== レース内時計 =====
  function pauseClock() {
    clockRunning = false;
  }
  function resumeClock() {
    if (raceStarted) {
      lastTick = performance.now();
      clockRunning = true;
    }
  }
  function checkMilestones() {
    for (const m of milestones) {
      if (!m.fired && raceSeconds >= m.at) {
        m.fired = true;
        m.fn();
        if (!clockRunning) return;
      }
    }
  }
  function tickClock(now) {
    if (clockRunning) {
      const deltaSec = (now - lastTick) / 1000;
      raceSeconds = Math.min(T_FINISH, raceSeconds + deltaSec * speedScale);
      updateHudDom();
      renderWorld(raceSeconds);
      checkMilestones();
    }
    lastTick = now;
    rafId = requestAnimationFrame(tickClock);
  }

  // ===== 実況 =====
  function say(slot, t, extraVars) {
    const vars = Object.assign(
      commentaryVars(t, { entries, selfEntry, distanceOfNum: (num) => distanceOf(num, t) }),
      extraVars || {}
    );
    const text = pickCommentaryLine(slot, vars, sayCount);
    if (text == null) return;
    sayCount += 1;
    callbacks.appendMessage(text, fmtStamp(t));
  }

  // ===== チュートリアル（ゲーム世界の外側から出るシステムUIの声） =====
  function showTutorialInternal({ text, atTop, progressText, requireButton, anchorEl }) {
    pauseClock();
    let left;
    let arrowX;
    if (atTop && anchorEl && refs.device) {
      const dev = refs.device.getBoundingClientRect();
      const b = anchorEl.getBoundingClientRect();
      const cx = b.left + b.width / 2 - dev.left;
      const W = 250;
      left = Math.max(8, Math.min(TRACK_W - W - 8, cx - 30));
      arrowX = cx - left - 5;
    }
    tutorialActive = true;
    tutorialDismissHandler = () => hideTutorialInternal();
    callbacks.setTutorial({
      text,
      atTop: !!atTop,
      progressText: progressText || null,
      requireButton: !!requireButton,
      left,
      arrowX,
    });
  }
  function hideTutorialInternal() {
    tutorialActive = false;
    callbacks.setTutorial(null);
  }
  function showJudgmentTutorialOnce() {
    if (judgmentTutorialShown) return;
    judgmentTutorialShown = true;
    showTutorialInternal({ text: "選んだ行動で、レースが変わります", atTop: false });
    tutorialDismissHandler = () => hideTutorialInternal();
  }
  function tutCameraMilestone() {
    callbacks.setRaceStageLabel("道中");
    showTutorialInternal({
      text: "押してみてください",
      atTop: true,
      requireButton: true,
      anchorEl: refs.btnCamera,
    });
    activeButtonTutorial = {
      kind: "camera",
      onPress: (label) => {
        const leader = currentLeaderEntry();
        const text =
          label === "先頭" && leader && !leader.isSelf
            ? `画面が先頭の「${leader.name}」を追いかけます。`
            : `画面が自分の「${selfEntry.name}」に戻ります。`;
        callbacks.setTutorial((prev) => (prev ? { ...prev, text } : prev));
        raceTimeout(() => {
          hideTutorialInternal();
          resumeClock();
          raceTimeout(tutDisplayMilestone, 1500);
        }, 1400);
      },
    };
  }
  function tutDisplayMilestone() {
    let pressCount = 0;
    showTutorialInternal({
      text: "3回押してみてください",
      atTop: true,
      progressText: "0/3",
      requireButton: true,
      anchorEl: refs.btnDisplay,
    });
    activeButtonTutorial = {
      kind: "display",
      onPress: (label) => {
        pressCount += 1;
        callbacks.setTutorial((prev) =>
          prev ? { ...prev, progressText: `${pressCount}/3`, text: `表示が「${label}」になりました。` } : prev
        );
        if (pressCount >= 3) {
          activeButtonTutorial = null;
          raceTimeout(() => {
            hideTutorialInternal();
            resumeClock();
            raceTimeout(tutSpeedMilestone, 1500);
          }, 1200);
        }
      },
    };
  }
  function tutSpeedMilestone() {
    showTutorialInternal({
      text: "押すと速くなります",
      atTop: true,
      requireButton: true,
      anchorEl: refs.btnSpeed,
    });
    activeButtonTutorial = {
      kind: "speed",
      onPress: (label) => {
        const text = `${label}になりました`;
        callbacks.setTutorial((prev) => (prev ? { ...prev, text } : prev));
        raceTimeout(() => {
          hideTutorialInternal();
          resumeClock();
        }, 1200);
      },
    };
  }

  // ===== 判断カード =====
  function showCardInternal(kind, label, situation, choices) {
    pauseClock();
    pendingCard = { kind, choices };
    callbacks.setCard({ label, situation, choices });
  }
  function pickCardChoice(choiceId) {
    if (!pendingCard) return;
    const kind = pendingCard.kind;
    hideTutorialInternal();
    raceTimeout(() => {
      callbacks.setCard(null);
      pendingCard = null;
      if (kind === "mid") {
        choiceIds.midRace = choiceId;
      } else {
        choiceIds.stretch = choiceId;
        raceResult = runDreamDerbyRace(saveSeed, dreamHorse, rivals, choiceIds);
        callbacks.setChoiceIds({ ...choiceIds }); // 卒業式の戦法4の写像に使う（devlog/wave02.md）
        confirmedAt = raceSeconds;
        marginByNum = new Map(raceResult.rows.map((r) => [numByHorseId.get(r.horseId), r.marginMeters]));
      }
      say(`choiceReact.${choiceId}`, raceSeconds);
      resumeClock();
    }, 500);
  }

  // ===== 節目（残り1200m＝道中の判断カード、最終直線入り＝直線の判断カード） =====
  function milestoneCardMid() {
    callbacks.setRaceStageLabel("道中");
    say("selfMid", raceSeconds);
    showCardInternal("mid", "残り1200m", "前が壁", choicesFor("dreamMid"));
    showJudgmentTutorialOnce();
  }
  function enterFinalStretch() {
    callbacks.setRaceStageLabel("直線");
    callbacks.setSprinting(true);
    say("stretchEntry", raceSeconds);
  }
  function milestoneCardStretch() {
    showCardInternal("stretch", "直線に入った", "どこで追い出すか", choicesFor("dreamStretch"));
  }

  // ===== 掲示板・ゴール =====
  function buildConfetti() {
    const colors = ["#ffd83d", "#2f7fe6", "#e0399a", "#7ad6de", "#eaff6b"];
    return Array.from({ length: 28 }, (_, i) => ({
      left: Math.random() * 100,
      background: colors[i % colors.length],
      duration: 1400 + Math.random() * 900,
      delay: Math.random() * 400,
    }));
  }
  function doFinish() {
    if (finished) return;
    finished = true;
    clockRunning = false;
    raceSeconds = T_FINISH;
    updateHudDom();
    renderWorld(raceSeconds);
    callbacks.setRaceStageLabel("ゴール");
    say("finish", raceSeconds);
    if (raceResult.won) {
      say(viewHash01(raceSeconds * 3 + 11) < 0.6 ? "homageWin" : "finishSelfWin", raceSeconds);
    } else {
      say("finishSelfLose", raceSeconds);
    }
    const result = raceResult;
    const boardRows = result.rows.slice(0, 5).map((r) => ({
      pos: r.pos,
      num: numByHorseId.get(r.horseId),
      name: r.name,
      margin: marginLabelFor(r.marginMeters),
      isSelf: r.isSelf,
    }));
    raceTimeout(() => {
      callbacks.setResultData({
        position: result.position,
        fieldSize: result.fieldSize,
        rows: boardRows,
        splitsText: `タイム ${result.goalTimeLabel}　上がり4F ${result.last4F}　上がり3F ${result.last3F}`,
      });
      callbacks.setConfetti(buildConfetti());
      callbacks.setResultActive(true);
      raceTimeout(() => wakeUpSequence(), 3200);
    }, 1100);
  }

  // ===== 暗転 → 家の室内で親に起こされる =====
  function wakeUpSequence() {
    callbacks.setResultActive(false);
    callbacks.setBlackoutActive(true);
    raceTimeout(() => {
      callbacks.setWakeActive(true);
      callbacks.setGraduateVisible(false);
      raceTimeout(() => callbacks.setBlackoutActive(false), 400);
      WAKE_LINES.forEach((text, i) => {
        raceTimeout(() => {
          callbacks.appendWakeLine(text);
          if (i === WAKE_LINES.length - 1) raceTimeout(() => callbacks.setGraduateVisible(true), 700);
        }, 1000 + i * 1100);
      });
    }, 900);
  }

  // ===== 節目の一覧（局面は距離で決め、`timeAtDistance`で時刻に逆算する） =====
  const milestones = [
    { at: 0.6, fired: false, fn: () => say("start", raceSeconds) },
    { at: 5, fired: false, fn: () => say("earlyOrder", raceSeconds) },
    { at: timeAtDistance(350), fired: false, fn: () => say("corner12", raceSeconds) },
    { at: timeAtDistance(700), fired: false, fn: () => say("selfMid", raceSeconds) },
    { at: timeAtDistance(1000), fired: false, fn: () => say("backstretch", raceSeconds) },
    { at: timeAtDistance(1200), fired: false, fn: milestoneCardMid },
    { at: timeAtDistance(1400), fired: false, fn: () => say("earlyOrder", raceSeconds) },
    { at: timeAtDistance(1500), fired: false, fn: () => say("corner3", raceSeconds) },
    { at: timeAtDistance(1750), fired: false, fn: () => say("corner4", raceSeconds) },
    { at: T_FINAL_STRETCH, fired: false, fn: enterFinalStretch },
    { at: T_FINAL_STRETCH, fired: false, fn: milestoneCardStretch },
    { at: timeAtDistance(2050), fired: false, fn: () => say("homage", raceSeconds) },
    { at: timeAtDistance(2200), fired: false, fn: () => say("stretchMid", raceSeconds) },
    { at: T_FINISH, fired: false, fn: doFinish },
  ];

  // ===== 発走 =====
  function beginRace() {
    if (raceStarted) return;
    raceStarted = true;
    say("gateIn", 0);
    callbacks.setActiveTab("messages");
    callbacks.setIntroActive(false);
    raceTimeout(() => resumeClock(), 550);
    raceTimeout(tutCameraMilestone, 3000);
  }

  // ===== 左下の丸ボタン3つ（カメラ・表示・速度）。表示切替そのものはReact側のCSSクラスで行い、
  // ここでは実際に描画へ影響する副作用（カメラ対象・レース内時計の速度）とチュートリアルの
  // 「実際に押させて確かめる」フックだけを扱う。 =====
  function pressCameraButton(label) {
    cameraMode = label === "先頭" ? "leader" : "self";
    applyCameraFocus();
    if (activeButtonTutorial && activeButtonTutorial.kind === "camera") {
      const cb = activeButtonTutorial.onPress;
      activeButtonTutorial = null;
      cb(label);
    }
  }
  function pressDisplayButton(label) {
    if (activeButtonTutorial && activeButtonTutorial.kind === "display") {
      activeButtonTutorial.onPress(label);
    }
  }
  function pressSpeedButton(scale, label) {
    speedScale = scale;
    if (activeButtonTutorial && activeButtonTutorial.kind === "speed") {
      const cb = activeButtonTutorial.onPress;
      activeButtonTutorial = null;
      cb(label);
    }
  }
  function dismissTutorial() {
    tutorialDismissHandler();
  }

  // ===== 起動・破棄 =====
  function start() {
    entries.forEach((e) => {
      const el = document.createElement("div");
      el.className = `horse-sprite${e.isSelf ? " is-self" : ""}`;
      const coat = coatFor(e.num);
      el.style.setProperty("--coat", coat.hex);
      el.style.setProperty("--coat-dark", coat.dark);
      el.style.setProperty("--silk", silkFor(e));
      el.style.setProperty("--cap", capColorFor(e.num).bg);
      el.style.setProperty("--ph", `${gaitPhaseFor(e.num).toFixed(3)}s`);
      el.innerHTML =
        horseSvgMarkup(e) +
        `<span class="hs-spark"></span>` +
        `<span class="hs-name">${e.name}</span><span class="hs-numlabel">${e.num}</span>`;
      refs.worldZoom.appendChild(el);
      sprites.set(e.num, el);
    });
    entries.forEach((e) => {
      const chip = document.createElement("div");
      chip.className = `marker-chip${e.isSelf ? " is-self" : ""}`;
      chip.textContent = String(e.num);
      const waku = capColorFor(e.num);
      chip.style.background = waku.bg;
      chip.style.color = waku.fg;
      refs.markerStrip.appendChild(chip);
      chips.set(e.num, chip);
    });
    for (let d = 0; d < TOTAL_DISTANCE; d += 200) {
      const el = document.createElement("div");
      el.className = "dist-marker";
      el.textContent = String((TOTAL_DISTANCE - d) / 100);
      refs.distMarkersWrap.appendChild(el);
      distMarkerEls.push({ el, distance: d });
    }
    renderWorld(0);
    updateHudDom();
    say("intro", 0);
    say("fieldIntro", 0);
    raceTimeout(beginRace, 3200);
    lastTick = performance.now();
    rafId = requestAnimationFrame(tickClock);
  }
  function destroy() {
    if (rafId != null) cancelAnimationFrame(rafId);
    clearPendingTimers();
    sprites.clear();
    chips.clear();
    distMarkerEls.length = 0;
    refs.worldZoom.replaceChildren();
    refs.markerStrip.replaceChildren();
    refs.distMarkersWrap.replaceChildren();
    refs.boundary.postsGroup.replaceChildren();
    refs.boundary.hedgeBumps.replaceChildren();
    refs.boundary.turfStripes.replaceChildren();
  }

  return {
    start,
    destroy,
    beginRace,
    pickCardChoice,
    dismissTutorial,
    pressCameraButton,
    pressDisplayButton,
    pressSpeedButton,
  };
}
