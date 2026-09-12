// 夢のダービー：レース画面のDOM/タイマー駆動エンジン（DOM・タイマー依存、JSX無し）。
// dream-derby-mock2.html（合意済みモック）を移植。ARCHITECTURE.md §5の設計方針どおり、
// 60fpsで書き換わる要素（馬18頭・マーカー・SVG境界・カメラ/ズーム）はReactの外——
// `requestAnimationFrame`ループでrefから取ったDOM要素へ直接書き込む。可変状態はすべて
// このファクトリ関数のクロージャ内に閉じ込め、`destroy()`で対称に破棄する
// （React 18 StrictModeの開発時二重マウントでも汚染されないように）。
// Reactが持つ低頻度UI（実況欄・チュートリアル文言・判断カードの開閉・結果オーバーレイ・
// 暗転〜目覚めの各段階・タブ切替・表示/速度モードのラベル）は`callbacks`経由で伝える。
//
// ⭐2026-09-06にレースsim（`src/sim/`）へ差し替えた。エンジンは自分で隊列を作らず、
// simが返す各馬の通過距離の時系列を読んで描くだけになった。
//   ・発走時に`startDreamDerbySim`を1回呼び、その結果を`sim`に持つ
//   ・判断カードを選んだ瞬間に`forkDreamDerbySim`でその時刻から先だけを計算し直す
//     （⚠️それ以前の数値は変わらない＝既に見せた隊列と矛盾しない）
//   ・局面の節目は時刻ではなく「自分の馬の通過距離」で判定する
//     （simのペースはレースごとに変わるので、固定の時刻表はもう使えない）
// ⚠️以前は`view/dreamDerbyRace.js`の`gapMetersAt`（6つの固定時刻の乱数を直線で結んだ演出）で
// 隊列を動かしており、80秒以降は横ばい＝馬が所定の位置に止まって見えた。その関数は削除した。

import {
  TOTAL_DISTANCE,
  D_FINAL_STRETCH,
  D_MID_CARD,
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
  viewHash01,
  clamp01,
  gateY,
  laneY,
  isCurvingAt,
  cameraTargetFor,
  stepCamera,
  worldFixedFraction,
  curveY,
  curveRow,
  bandPath,
  formatPoint,
} from "../view/dreamDerbyRace.js";
import { horseSvgMarkup, coatFor, silkFor, capColorFor, gaitPhaseFor } from "../view/dreamDerbySprite.js";
import {
  fieldOrder,
  commentaryVars,
  pickCommentaryLine,
  resetCommentaryHistory,
  fmtStamp,
  positionBandOf,
  positionLabelFor,
} from "../view/dreamDerbyCommentary.js";
import { choicesFor, dreamSituationId } from "../domain/judgmentCard.js";
import { startDreamDerbySim, forkDreamDerbySim, dreamDerbyResult } from "../domain/dreamDerby.js";

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
 * @param {{num:number,name:string,isSelf:boolean,horse:object,jockeyName:(string|null),trainerName:(string|null)}[]} opts.entries - 馬番昇順（`assignPostPositions`の出力。
 *   ⚠️`jockeyName`/`trainerName`は2026-09-06に相手馬へ追加された（史実の日本ダービー優勝馬の
 *   もじり名。実名ではない）。今はまだどの実況テンプレートも参照していない（持たせるだけ）
 * @param {object} opts.callbacks - Reactのstateセッターの束（下記参照）
 */
export function createDreamDerbyEngine({ refs, saveSeed, entries, callbacks }) {
  const selfEntry = entries.find((e) => e.isSelf);
  const numByHorseId = new Map(entries.map((e) => [e.horse.id, e.num]));
  // ⭐レースの実体。発走前に1本走らせておき、判断カードのたびにフォークで差し替える。
  let sim = startDreamDerbySim(saveSeed, entries);

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
  let sayCount = 0;
  let judgmentTutorialShown = false;
  let tutorialActive = false;
  let tutorialDismissHandler = () => hideTutorialInternal();
  let activeButtonTutorial = null; // { kind: "camera"|"display", onPress(label) }
  let pendingCard = null; // { kind: "mid"|"stretch", choices }
  // ⚠️`midBand`/`midForward`/`stretchEarly`は戦法4の写像に使う（`domain/graduation.js`の
  // `strategyFromDreamChoices`）。`midSituationId`/`stretchSituationId`は最終着差の計算
  // （`domain/dreamDerby.js`の`resolveChoice`）に使う——位置によって択の組が違うため、
  // 択IDだけでは効果量を引けない。
  const choiceIds = {
    midRace: null,
    midSituationId: null,
    midBand: null,
    midForward: null,
    stretch: null,
    stretchSituationId: null,
    stretchEarly: null,
  };
  let finished = false; // ゴール処理（doFinish）が既に走ったか。連打対策（devlog参照）
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
  /** 馬番numのt秒時点の通過距離(m)。⭐出どころはレースsimの時系列ただ1つ。 */
  function distanceOf(num, t) {
    return sim.distanceOf(num, t);
  }
  /** レースが終わる時刻(秒)＝勝ち馬のゴール時刻。フォークで動くので毎回simから読む。 */
  function raceEndTime() {
    return sim.winnerTime;
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
    let minD = Infinity;
    let maxD = -Infinity;
    entries.forEach((e, i) => {
      const d = distanceOf(e.num, t);
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
      const rowGateY = gateY(i, entries.length);
      const y = rowGateY + (laneY(e.num, t, { isSelf: e.isSelf }) - rowGateY) * spread;
      positions[e.num] = {
        x: Math.max(-0.4, Math.min(1.4, anchor + (d - cameraDistance) / VIEW_SPAN)),
        y,
        cx: 0.5 + (d - cameraDistance) / (VIEW_SPAN * 3),
      };
    });
    layout(positions);
    // ⭐発走直後は全馬がほぼ同じ距離に固まり、馬名/馬番のラベルが互いに重なって読めなくなる
    // （2026-09-08にユーザーの通しプレイで発覚・`TODO.md` #66）。`t < 3`という固定時間で
    // 切ったところ、実測で3秒経っても隊列の幅がまだ4.3m（`TARGET_GAP_BAND`が効き切るには
    // 15〜20秒かかる。1レース分の例で実測）で重なりが残っていた。
    // ⭐**隊列の実際の幅（最大−最小のm）で判定する**——15mという境目は、
    // 撤去済みの`zoomForSpread`が使っていた値をそのまま引き継いだだけで、
    // `positionFactor`（`sim/stamina.js`。範囲は0〜30m）とは無関係。
    // ⚠️根拠は理屈ではなく実見：この値でスクリーンショットを撮り、ラベルが
    // 重ならずに読めることを確かめた（画面上は12.2px/m換算で15mが183px）。
    // ⚠️出馬表タブに同じ情報（馬番・馬名）が既にあるので、消しても発走直後の
    // 数秒だけは大きな支障がないはず（この間はどの馬か見分ける必要が薄い場面）。
    refs.worldZoom.classList.toggle("is-crowded", maxD - minD < 15);
    positionWorldFixedEl(refs.startGate, 0, cameraDistance, anchor);
    distMarkerEls.forEach((m) => positionWorldFixedEl(m.el, m.distance, cameraDistance, anchor));
    positionWorldFixedEl(refs.goalPost, TOTAL_DISTANCE, cameraDistance, anchor);
    targetCurving = isCurvingAt(cameraDistance);
    const selfCx = positions[selfEntry.num] ? clamp01(positions[selfEntry.num].cx) : 0.5;
    refs.selfTrackMarker.style.left = `${4 + selfCx * 92}%`;
    updateBoundary(cameraDistance, anchor);
  }
  function updateHudDom() {
    const d = distanceOf(selfEntry.num, raceSeconds);
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
  // 節目は「自分の馬の通過距離」（atD）か「レース時計の秒」（at）のどちらかで発火する。
  function checkMilestones() {
    const selfDistance = distanceOf(selfEntry.num, raceSeconds);
    for (const m of milestones) {
      if (m.fired) continue;
      const reached = m.isFinish
        ? raceSeconds >= raceEndTime()
        : m.atD != null
          ? selfDistance >= m.atD
          : raceSeconds >= m.at;
      if (!reached) continue;
      m.fired = true;
      m.fn();
      if (!clockRunning) return;
    }
  }
  function tickClock(now) {
    if (clockRunning) {
      const deltaSec = (now - lastTick) / 1000;
      raceSeconds = Math.min(raceEndTime(), raceSeconds + deltaSec * speedScale);
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
      commentaryVars(t, {
        entries,
        selfEntry,
        distanceOfNum: (num) => distanceOf(num, t),
        // ⭐`moverName`検出用（直近5秒前の隊列を求める。devlog/wave04.md §32）。
        // `distanceOf(num, t)`はsimの時系列をそのまま引くだけなので、tを変えて呼べば
        // 任意時刻の距離が取れる。
        distanceOfNumAt: distanceOf,
        split1000Seconds: sim.split1000,
      }),
      extraVars || {}
    );
    const text = pickCommentaryLine(slot, vars, sayCount);
    if (text == null) return;
    sayCount += 1;
    callbacks.appendMessage(text, fmtStamp(t));
  }

  // ===== チュートリアル（ゲーム世界の外側から出るシステムUIの声） =====
  function showTutorialInternal({ text, atTop, progressText, requireButton, anchorEl, anchorAbove }) {
    pauseClock();
    let left;
    let arrowX;
    let top;
    let bottom;
    if (atTop && anchorEl && refs.device) {
      const dev = refs.device.getBoundingClientRect();
      const b = anchorEl.getBoundingClientRect();
      const cx = b.left + b.width / 2 - dev.left;
      // 吹き出しの左端をボタンの左端に揃える（2026-09-06にユーザーが「細くしてボタンの真上に」と決定）。
      // 中央合わせにすると、左端のボタン（中心x=25〜105px）では必ず枠の左端に張り付くため。
      // ⚠️幅Wは`.tutorial-toast.at-top`の`width`と同じ値にすること。
      const W = 220;
      left = Math.max(8, Math.min(dev.width - W - 8, b.left - dev.left));
      arrowX = cx - left;
      top = b.bottom - dev.top + 8;
    }
    if (anchorAbove && refs.device) {
      // 高さを問わず「anchorAboveの直上」に置くため、topではなくbottomで指定する
      // （吹き出しの実測の高さが分からなくても、上へ伸びるだけで済む）。
      const dev = refs.device.getBoundingClientRect();
      const b = anchorAbove.getBoundingClientRect();
      bottom = Math.max(16, dev.bottom - b.top + 8);
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
      top,
      bottom,
    });
  }
  function hideTutorialInternal() {
    tutorialActive = false;
    callbacks.setTutorial(null);
  }
  function showJudgmentTutorialOnce() {
    if (judgmentTutorialShown) return;
    judgmentTutorialShown = true;
    // カード最下部の選択肢「下げて外へ」に吹き出しがかぶらないよう、判断カードの
    // 直上（.card-panelの上端）に出す。bottomの値はanchorAbove経由で都度計算する。
    showTutorialInternal({
      text: "選んだ行動で、レースが変わります",
      atTop: false,
      anchorAbove: refs.cardPanel,
    });
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
    const chosen = pendingCard.choices.find((c) => c.id === choiceId);
    hideTutorialInternal();
    raceTimeout(() => {
      callbacks.setCard(null);
      pendingCard = null;
      if (kind === "mid") {
        choiceIds.midRace = choiceId;
        choiceIds.midForward = !!chosen?.forward;
        // ⭐選んだ瞬間から先だけを計算し直す。この時刻より前の距離は1つも変わらない。
        sim = forkDreamDerbySim(sim, raceSeconds, "mid", choiceIds.midSituationId, choiceId);
      } else {
        choiceIds.stretch = choiceId;
        choiceIds.stretchEarly = !!chosen?.early;
        sim = forkDreamDerbySim(sim, raceSeconds, "stretch", choiceIds.stretchSituationId, choiceId);
        callbacks.setChoiceIds({ ...choiceIds }); // 卒業式の戦法4の写像に使う（devlog/wave02.md）
      }
      say(`choiceReact.${choiceId}`, raceSeconds);
      resumeClock();
    }, 500);
  }

  // ===== 節目（残り1200m＝道中の判断カード、最終直線入り＝直線の判断カード） =====
  // 今の自分の順位（距離降順の何番目か）を、その時刻の隊列から出す。
  function currentSelfRank(t) {
    const order = fieldOrder(entries, (num) => distanceOf(num, t));
    return order.findIndex((e) => e.isSelf) + 1;
  }
  function milestoneCardMid() {
    callbacks.setRaceStageLabel("道中");
    say("selfMid", raceSeconds);
    const rank = currentSelfRank(raceSeconds);
    const band = positionBandOf(rank, entries.length);
    choiceIds.midBand = band;
    const situationId = dreamSituationId("mid", band);
    choiceIds.midSituationId = situationId;
    showCardInternal("mid", "残り1200m", positionLabelFor(band, rank), choicesFor(situationId));
    // showCardInternalのsetCard()はReactの状態更新なので、直後だと.card-panelはまだ
    // display:noneのまま（再描画前）。位置計算（anchorAbove）がその高さ0の矩形を
    // 拾ってしまわないよう、描画が済む次のフレームまで待ってから吹き出しを出す。
    requestAnimationFrame(() => requestAnimationFrame(() => showJudgmentTutorialOnce()));
  }
  function enterFinalStretch() {
    callbacks.setRaceStageLabel("直線");
    callbacks.setSprinting(true);
    say("stretchEntry", raceSeconds);
  }
  function milestoneCardStretch() {
    const rank = currentSelfRank(raceSeconds);
    const band = positionBandOf(rank, entries.length);
    const situationId = dreamSituationId("stretch", band);
    choiceIds.stretchSituationId = situationId;
    showCardInternal("stretch", "最後の直線", positionLabelFor(band, rank), choicesFor(situationId));
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
    raceSeconds = raceEndTime();
    updateHudDom();
    renderWorld(raceSeconds);
    callbacks.setRaceStageLabel("ゴール");
    say("finish", raceSeconds);
    const raceResult = dreamDerbyResult(sim, entries);
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

  // ===== 節目の一覧 =====
  // ⭐`atD`＝自分の馬の通過距離(m)で発火／`at`＝レース時計の秒で発火。
  // ⚠️距離の節目を時刻に固定し直さないこと——simのペースはレースごとに変わる。
  const milestones = [
    { at: 0.6, fired: false, fn: () => say("start", raceSeconds) },
    { at: 5, fired: false, fn: () => say("earlyOrder", raceSeconds) },
    { atD: 350, fired: false, fn: () => say("corner12", raceSeconds) },
    { atD: 700, fired: false, fn: () => say("selfMid", raceSeconds) },
    { atD: 1000, fired: false, fn: () => say("backstretch", raceSeconds) },
    { atD: D_MID_CARD, fired: false, fn: milestoneCardMid },
    { atD: 1400, fired: false, fn: () => say("earlyOrder", raceSeconds) },
    { atD: 1500, fired: false, fn: () => say("corner3", raceSeconds) },
    { atD: 1750, fired: false, fn: () => say("corner4", raceSeconds) },
    { atD: D_FINAL_STRETCH, fired: false, fn: enterFinalStretch },
    { atD: D_FINAL_STRETCH, fired: false, fn: milestoneCardStretch },
    { atD: 2050, fired: false, fn: () => say("homage", raceSeconds) },
    { atD: 2200, fired: false, fn: () => say("stretchMid", raceSeconds) },
    { at: 0, fired: false, isFinish: true, fn: doFinish },
  ];

  // ===== 発走 =====
  function beginRace() {
    if (raceStarted) return;
    raceStarted = true;
    callbacks.setActiveTab("messages");
    callbacks.setIntroActive(false);
    // ⭐夢の入りの1行はここで出す（`devlog/wave05.md`§59）。⚠️`start()`で出していたころは
    // レース前の画面（不透明・`inset: 0`）の裏で浮かび上がりが終わり、⭐**プレイヤーが
    // 画面をタップしたときには既に3行目まで積まれていて、小さく薄い行になっていた。**
    // 浮かび上がる1.6秒のあいだ、この行を最新行（大きい白文字）のままにする。
    say("intro", 0);
    raceTimeout(() => {
      say("fieldIntro", 0);
      say("gateIn", 0);
    }, 1700);
    raceTimeout(() => resumeClock(), 2250);
    raceTimeout(tutCameraMilestone, 4700);
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
    resetCommentaryHistory(); // 前のレースの「直前に出した行」の記憶を持ち越さない
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
    // ⚠️実況の1行目は`beginRace`で出す（レース前の画面の裏で流れてしまうため）。
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
