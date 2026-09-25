// 今週の騎乗依頼（月曜）の画面。本筋3・手順②（2026-09-17・Fable）。
// 見本：`design/mocks/week-offers-v3.html`（案2・レースが主役・1レース＝1つの表）と
//       `design/mocks/week-offers-v4.html`（案B・行を押すとその行の下に「乗る」と「出馬表」が
//       開く。「この週を進める」は一覧の末尾）。ユーザーの直し：「自分の厩舎」→「所属厩舎」。
// 操作の決まり（見本の台本と`domain/fridayConfirmation.js`の制約をそのまま画面で守る）：
//   ・乗れるのは週`RIDABLE_SLOTS_PER_WEEK`鞍。決めた分だけ「あと◯件」が減る
//   ・同じレースには1頭だけ——決めた表の残りの行は薄くなる
//   ・1日1場——その日に別の競馬場で決めると、他の競馬場のタブは薄くなり、押すと理由が出る
//   ・薄い行は押しても開かない。開く行は同時に1つ
// 乗る馬・行く競馬場はプレイヤーの選択をそのまま`advanceWeek`へ渡す（`chooseMounts`・
// `chooseCourse`）。何も決めなければ、その日はどこへも行かない。

import React, { useMemo, useRef, useState } from "react";
import { advanceWeek } from "../domain/weekLoop.js";
import { writeSave } from "../state/saveGame.js";
import { generateWeeklyRequests, RIDABLE_SLOTS_PER_WEEK } from "../domain/weeklyRequests.js";
import { isMainMount } from "../domain/mainMount.js";
import { isSidelined } from "../domain/fall.js";
import { deriveFavoredStrategy } from "../domain/strategy.js";
import { GENDER_LABEL } from "../domain/horse.js";
import { NOTIFICATION_TYPES } from "../domain/notifications.js";
import { buildWeekResultSummary } from "../domain/weekResultSummary.js";
import { DAY } from "../data/weekDays.js";
import { INJURY_LABELS } from "../data/injuryLabels.js";
import { STRATEGY_LABELS } from "../data/aptitudeLabels.js";
import {
  formatWeekLabel,
  groupRequestsByDay,
  raceHeadline,
  recordLabel,
  surfaceMarkId,
  lockedCourseMessage,
  emptyDayMessage,
  EMPTY_WEEK_MESSAGE,
} from "../view/weekOffersView.js";
import { EntryListScreen } from "./EntryListScreen.jsx";
import { WeekResultScreen } from "./WeekResultScreen.jsx";
import "./WeekScreen.css";

const DAY_LABEL = Object.freeze({ [DAY.SAT]: "土曜", [DAY.SUN]: "日曜" });

/** 芝・ダートの相性4段。同じ20px枠・同じ2pxの線で描く（フォントの字形だと○が△より小さく見える）。 */
function SurfaceMarkDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="wk-m2" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      </symbol>
      <symbol id="wk-m1" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </symbol>
      <symbol id="wk-m3" viewBox="0 0 20 20">
        <path d="M10 2.5 L18.5 17.5 L1.5 17.5 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </symbol>
      <symbol id="wk-mx" viewBox="0 0 20 20">
        <path d="M3 3 L17 17 M17 3 L3 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </symbol>
    </svg>
  );
}

/**
 * 先週の出来事を1行の文にする。⭐悪い知らせだけを出す段（2026-09-20のユーザー決定・
 * `devlog/wave10.md`§10）：怪我・主戦の座を失った・疲れの警告・信頼が下がった、の4つ。
 * 信頼が上がった知らせ（`delta > 0`）はここでは出さない——知らせ自体は`domain/`が
 * 従来どおり組み立てている（画面に出すかどうかだけをここで決める）。
 * ⚠️「大きく下がりました」とは書かない：この知らせが出る下がり幅は2
 * （`DECLINE_MAIN_MOUNT_TRUST_LOSS`）で、他の要因の「大きく動いた」境目（4）に届かない。
 * @returns {string|null} 出さない知らせはnull
 */
function notificationText(n, horsesById, stablesById) {
  const horseName = (id) => horsesById.get(id)?.name ?? id;
  switch (n.type) {
    case NOTIFICATION_TYPES.LOST_MAIN_MOUNT:
      return `${horseName(n.horseId)}の主戦を他の騎手に取られました。`;
    case NOTIFICATION_TYPES.INJURY:
      return `${horseName(n.horseId)}が${INJURY_LABELS[n.injuryType] ?? n.injuryType}しました。${n.weeksOut}週間乗れません。`;
    case NOTIFICATION_TYPES.BIG_TRUST_CHANGE: {
      if (n.delta >= 0) return null;
      const who =
        n.targetType === "trainer" ? `${stablesById.get(n.targetId)?.trainerName ?? n.targetId}調教師` : "馬主";
      return `${who}からの信頼が下がりました。`;
    }
    case NOTIFICATION_TYPES.FATIGUE_DANGER:
      return "疲れがたまっています。落馬しやすくなっています。";
    default:
      return null;
  }
}

/**
 * @param {{ saveSeed: number|string, startYear: number, initialRoster: object,
 *           initialPlayer: object }} props
 */
export function WeekScreen({ saveSeed, startYear, initialRoster, initialPlayer }) {
  const [roster, setRoster] = useState(initialRoster);
  const [player, setPlayer] = useState(initialPlayer);
  const [lastNotifications, setLastNotifications] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); // null＝依頼のある最初の日
  const [viewCourseByDay, setViewCourseByDay] = useState({ [DAY.SAT]: null, [DAY.SUN]: null });
  const [pickedHorseIds, setPickedHorseIds] = useState(() => new Set());
  const [openHorseId, setOpenHorseId] = useState(null);
  const [entryListRequest, setEntryListRequest] = useState(null);
  const [weekResult, setWeekResult] = useState(null);
  const rootRef = useRef(null);

  const horsesById = useMemo(() => new Map(roster.horses.map((h) => [h.id, h])), [roster]);
  const stablesById = useMemo(() => new Map(roster.stables.map((s) => [s.id, s])), [roster]);

  const week = player.currentWeek;
  const requests = useMemo(
    () => generateWeeklyRequests(saveSeed, week, roster, player),
    [saveSeed, week, roster, player]
  );
  const byDay = useMemo(() => groupRequestsByDay(requests), [requests]);
  const requestByHorseId = useMemo(() => new Map(requests.map((r) => [r.horseId, r])), [requests]);

  // その日に「行く」と決まった競馬場＝その日に乗る馬を決めた競馬場（1日1場）。
  const goingCourseByDay = useMemo(() => {
    const going = { [DAY.SAT]: null, [DAY.SUN]: null };
    for (const horseId of pickedHorseIds) {
      const r = requestByHorseId.get(horseId);
      if (r) going[r.day] = r.courseId;
    }
    return going;
  }, [pickedHorseIds, requestByHorseId]);

  // 決めた表（同じレース）のraceId
  const pickedRaceIds = useMemo(() => {
    const ids = new Set();
    for (const horseId of pickedHorseIds) {
      const r = requestByHorseId.get(horseId);
      if (r) ids.add(r.raceId);
    }
    return ids;
  }, [pickedHorseIds, requestByHorseId]);

  const slotsLeft = RIDABLE_SLOTS_PER_WEEK - pickedHorseIds.size;
  const weekHasRequests = requests.length > 0;

  const day =
    selectedDay ?? (byDay[DAY.SAT].length > 0 || byDay[DAY.SUN].length === 0 ? DAY.SAT : DAY.SUN);
  const coursesToday = byDay[day];
  const viewCourseId =
    viewCourseByDay[day] && coursesToday.some((c) => c.courseId === viewCourseByDay[day])
      ? viewCourseByDay[day]
      : coursesToday[0]?.courseId ?? null;
  const viewCourse = coursesToday.find((c) => c.courseId === viewCourseId) ?? null;
  const goingToday = goingCourseByDay[day];
  const viewIsLocked = goingToday != null && viewCourseId != null && viewCourseId !== goingToday;

  const yearCompleted = player.currentYear > startYear;

  function rowState(request) {
    const horse = horsesById.get(request.horseId);
    const isPicked = pickedHorseIds.has(request.horseId);
    const sidelined = horse ? isSidelined(horse) : false;
    const raceTaken = pickedRaceIds.has(request.raceId) && !isPicked;
    const dayTaken = goingCourseByDay[request.day] != null && goingCourseByDay[request.day] !== request.courseId;
    const full = slotsLeft <= 0 && !isPicked;
    return { isPicked, isOff: !isPicked && (sidelined || raceTaken || dayTaken || full), sidelined };
  }

  function togglePick(horseId) {
    setPickedHorseIds((prev) => {
      const next = new Set(prev);
      if (next.has(horseId)) next.delete(horseId);
      else next.add(horseId);
      return next;
    });
    setOpenHorseId(null);
  }

  function handleAdvance() {
    const res = advanceWeek(saveSeed, roster, player, {
      chooseCourse: () => ({ [DAY.SAT]: goingCourseByDay[DAY.SAT], [DAY.SUN]: goingCourseByDay[DAY.SUN] }),
      chooseMounts: (candidates) => candidates.filter((c) => pickedHorseIds.has(c.horseId)),
    });
    // ⭐週を進めた直後の結果画面（案C 掲示板・2026-09-25のユーザー決定）へ渡すデータを、
    // 進める前のplayer（`beforePlayer`）と進めた後の結果からここで組む。
    const summary = buildWeekResultSummary({
      beforePlayer: player,
      afterPlayer: res.player,
      afterRoster: res.roster,
      rides: res.rides,
      week: player.currentWeek,
      year: player.currentYear,
    });
    setRoster(res.roster);
    setPlayer(res.player);
    setLastNotifications(res.notifications);
    // ⭐週を進めるたびに自動で保存する（本筋4・`TODO.md` #13）。失敗しても
    // プレイは止めない（`writeSave`は例外を投げない）。
    writeSave(saveSeed, startYear, res.roster, res.player);
    setPickedHorseIds(new Set());
    setOpenHorseId(null);
    setSelectedDay(null);
    setViewCourseByDay({ [DAY.SAT]: null, [DAY.SUN]: null });
    setWeekResult(summary);
    // 「この週を進める」は一覧の一番下にあるので、結果画面は先頭から見せる。
    document.querySelector(".screen-pane--week")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }

  function handleWeekResultNext() {
    setWeekResult(null);
    // 週が変わったら一覧の先頭へ戻す（前の週の位置のままだと見出しが画面の外に残る）。
    // ⚠️結果画面を出している間は`rootRef`の`<main>`（週の画面側）がアンマウントされて
    // いるため、`rootRef`ではなく`app.jsx`側の安定した親（`.screen-pane--week`）を
    // クラスで探す（既存の`handleAdvance`の`rootRef.current?.closest(".screen-pane")`と
    // 同じ狙い・同じ対象を、参照ではなくクラス名で引く形に変えただけ）。
    document.querySelector(".screen-pane--week")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }

  if (weekResult) {
    return <WeekResultScreen summary={weekResult} onNext={handleWeekResultNext} />;
  }

  if (entryListRequest) {
    const entryHorse = horsesById.get(entryListRequest.horseId);
    return (
      <EntryListScreen
        saveSeed={saveSeed}
        week={week}
        currentYear={player.currentYear}
        player={player}
        roster={roster}
        horse={entryHorse}
        mount={entryListRequest}
        onClose={() => setEntryListRequest(null)}
      />
    );
  }

  const notes = lastNotifications
    .map((n) => notificationText(n, horsesById, stablesById))
    .filter(Boolean);

  return (
    <main className="week-screen" ref={rootRef}>
      <SurfaceMarkDefs />

      <div className="wk-hd">
        <div className="wk-hd__week">{formatWeekLabel(player.currentYear, week)}</div>
        <div className="wk-hd__left">
          あと<b>{slotsLeft}</b>件
        </div>
      </div>

      {notes.length > 0 && (
        <div className="wk-notes is-bad">
          {notes.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      )}

      {yearCompleted && <div className="wk-notes">1年目が終わりました。</div>}

      <div className="wk-days">
        {[DAY.SAT, DAY.SUN].map((d) => (
          <button
            key={d}
            type="button"
            className={[d === day ? "is-on" : "", byDay[d].length === 0 ? "is-zero" : ""].join(" ").trim()}
            onClick={() => {
              setSelectedDay(d);
              setOpenHorseId(null);
            }}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>

      {!weekHasRequests && <div className="wk-empty">{EMPTY_WEEK_MESSAGE}</div>}

      {weekHasRequests && coursesToday.length === 0 && <div className="wk-empty">{emptyDayMessage(day)}</div>}

      {coursesToday.length > 0 && (
        <div className="wk-courses">
          {coursesToday.map((c) => {
            const locked = goingToday != null && c.courseId !== goingToday;
            return (
              <button
                key={c.courseId}
                type="button"
                className={[c.courseId === viewCourseId ? "is-on" : "", locked ? "is-lock" : ""].join(" ").trim()}
                onClick={() => {
                  setViewCourseByDay((prev) => ({ ...prev, [day]: c.courseId }));
                  setOpenHorseId(null);
                }}
              >
                {c.courseName}
                <span className="wk-courses__n">{c.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {viewIsLocked && (
        <div className="wk-empty is-lock">{lockedCourseMessage(day, goingToday, viewCourseId)}</div>
      )}

      {viewCourse &&
        viewCourse.races.map((race) => {
          const head = raceHeadline(race);
          return (
            <React.Fragment key={race.raceId}>
              <div className="wk-race">
                <div className="wk-race__big">
                  <span className="wk-race__sf">{head.surfaceLabel}</span>
                  {head.distanceLabel}
                  <span className="wk-race__cls">{head.classLabel}</span>
                </div>
              </div>
              <div className="wk-t">
                <div className="wk-th">
                  <span>馬名</span>
                  <span>性</span>
                  <span>走り方</span>
                  <span className="wk-c">{head.surfaceColumnLabel}</span>
                  <span className="wk-tr">調教師</span>
                </div>
                {race.requests.map((request) => {
                  const horse = horsesById.get(request.horseId);
                  const stable = stablesById.get(request.stableId);
                  const { isPicked, isOff, sidelined } = rowState(request);
                  const isOpen = openHorseId === request.horseId;
                  const isMain = isMainMount(player.mainMounts, request.horseId);
                  const className = ["wk-r", isPicked ? "is-on" : "", isOff ? "is-off" : "", isOpen ? "is-open" : ""]
                    .join(" ")
                    .trim();
                  const openRow = () => {
                    if (isOff) return;
                    setOpenHorseId((prev) => (prev === request.horseId ? null : request.horseId));
                  };
                  return (
                    <div
                      key={request.horseId}
                      className={className}
                      role="button"
                      tabIndex={isOff ? -1 : 0}
                      aria-disabled={isOff || undefined}
                      aria-expanded={isOpen}
                      onClick={openRow}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openRow();
                        }
                      }}
                    >
                      <span className="wk-r__name">
                        {horse?.name ?? request.horseId}
                        <small>
                          {isMain && <span className="wk-r__main">主戦</span>}
                          {isPicked ? "乗ります" : horse ? recordLabel(horse) : ""}
                        </small>
                      </span>
                      <span>{horse ? GENDER_LABEL[horse.gender] ?? horse.gender : ""}</span>
                      <span>{horse ? STRATEGY_LABELS[deriveFavoredStrategy(horse)] : ""}</span>
                      <svg className="wk-r__sym" aria-hidden="true">
                        <use href={`#${horse ? surfaceMarkId(horse, race.surface) : "wk-m3"}`} />
                      </svg>
                      <span className="wk-r__tr">
                        {stable?.trainerName ?? ""}
                        {request.isFromOwnStable && <small>所属厩舎</small>}
                      </span>
                      {sidelined && !isPicked && (
                        <span className="wk-r__warn is-muted">
                          {INJURY_LABELS[horse.injury.type] ?? "怪我"}であと{horse.injury.weeksRemaining}週間乗れません
                        </span>
                      )}
                      {isMain && !isPicked && !sidelined && <span className="wk-r__warn">断ると信頼が下がります</span>}
                      <span className="wk-r__acts">
                        <button
                          type="button"
                          className="wk-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePick(request.horseId);
                          }}
                        >
                          {isPicked ? "外す" : "乗る"}
                        </button>
                        <button
                          type="button"
                          className="wk-lnk"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntryListRequest(request);
                          }}
                        >
                          出馬表
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}

      <div className={["wk-adv", !weekHasRequests || coursesToday.length === 0 ? "is-tight" : ""].join(" ").trim()}>
        <button type="button" className="wk-btn" onClick={handleAdvance}>
          この週を進める
        </button>
      </div>
    </main>
  );
}
