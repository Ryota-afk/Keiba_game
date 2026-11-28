// 今週の騎乗依頼（月曜）の画面。本筋3・手順②（2026-09-17・Fable）。
// 見本：`design/mocks/week-offers-v3.html`（案2・レースが主役・1レース＝1つの表）と
//       `design/mocks/week-offers-v4.html`（案B・行を押すとその行の下に「乗る」と「出馬表」が
//       開く。「この週を進める」は一覧の末尾）。ユーザーの直し：「自分の厩舎」→「所属厩舎」。
// 操作の決まり（見本の台本と`domain/fridayConfirmation.js`の制約をそのまま画面で守る）：
//   ・乗れるのは週`RIDABLE_SLOTS_PER_WEEK`鞍。決めた分だけ「あと◯件」が減る
//   ・同じレースには1頭だけ——決めた表の残りの行は薄くなる
//   ・1日1場——その日に別の競馬場で決めると、他の競馬場のタブは薄くなり、押すと理由が出る
//   ・薄い行は押しても開かない。開く行は同時に1つ
//   ・開いた行の「馬を見る」で馬の詳しい画面（`HorseDetail.jsx`・案A 能力表・2026-11-28）へ。
//     そこの「乗る」は行の「乗る」と同じ`togglePick`。閉じると、開く前に見ていた位置へ戻る
// 行の中身は`design/mocks/week-result-v2.html`の案A 時刻表（2026-11-27にユーザーが選んだ）：
//   1段目＝馬名・性齢・毛色・調教後の体重（前走比）・前走からの間隔（「中6週」「連闘」「初出走」）。
//   2段目＝主戦・戦績・走り方・芝ダの相性／調教師。レースの見出しの上に「京都 6R」。レースは番号順。
// 乗る馬・行く競馬場はプレイヤーの選択をそのまま`advanceWeek`へ渡す（`chooseMounts`・
// `chooseCourse`）。何も決めなければ、その日はどこへも行かない。

import React, { useMemo, useRef, useState } from "react";
import { advanceWeek } from "../domain/weekLoop.js";
import { writeSave } from "../state/saveGame.js";
import { prepareWeek } from "../domain/weekPrepare.js";
import { generateWeeklyRequests, RIDABLE_SLOTS_PER_WEEK } from "../domain/weeklyRequests.js";
import { isMainMount } from "../domain/mainMount.js";
import { isSidelined } from "../domain/fall.js";
import { deriveFavoredStrategy } from "../domain/strategy.js";
import { GENDER_LABEL, weeksSinceLastRace } from "../domain/horse.js";
import { horseAge } from "../domain/retirement.js";
import { NOTIFICATION_TYPES } from "../domain/notifications.js";
import { buildWeekResultSummary } from "../domain/weekResultSummary.js";
import { DAY } from "../data/weekDays.js";
import { INJURY_LABELS } from "../data/injuryLabels.js";
import { STRATEGY_LABELS } from "../data/aptitudeLabels.js";
import { COAT_LABEL } from "../data/coat.js";
import {
  sexAgeLabel,
  bodyWeightText,
  intervalLabel,
  isDebut,
  trainingWeightView,
} from "../view/horseRowView.js";
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
import { YearEndSummaryScreen, RetiredHorsesScreen } from "./YearEndScreen.jsx";
import { JockeyProfile } from "./JockeyProfile.jsx";
import { Banzuke } from "./Banzuke.jsx";
import { HorseDetail } from "./HorseDetail.jsx";
import { SurfaceMarkDefs } from "./SurfaceMarkDefs.jsx";
import "./WeekScreen.css";

// 調教後の体重（`domain/horseForm.js`の`trainingWeightFor`。`view/horseRowView.js`の`trainingWeightView`が受ける）。
import { trainingWeightFor } from "../domain/horseForm.js";
const HAS_TRAINING_WEIGHT = typeof trainingWeightFor === "function";

const DAY_LABEL = Object.freeze({ [DAY.SAT]: "土曜", [DAY.SUN]: "日曜" });
// 土曜・日曜の隣の3つ目のタブ。押すと依頼一覧の代わりに自分の能力（`JockeyProfile`）が開く
// （案C 梯子・2026-09-27のユーザー決定）。下の「この週を進める」はそのまま。
const PROFILE_TAB_LABEL = "自分";
// 4つ目のタブ。押すと競馬界全体の今年の顔ぶれ（`Banzuke`・案C 顔ぶれ・2026-10-11のユーザー決定）が開く。
// 開き方は「自分」と同じ（土曜・日曜を押せば依頼一覧に戻り、週を進めたら閉じる）。
const BANZUKE_TAB_LABEL = "番付";
const SIDE_TAB = Object.freeze({ PROFILE: "profile", BANZUKE: "banzuke" });

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
  const [detailHorseId, setDetailHorseId] = useState(null); // 馬の詳しい画面を開いている馬（null＝閉じている）
  const scrollBeforeDetail = useRef(0);
  const [weekResult, setWeekResult] = useState(null);
  // 年の最後の週だけ：結果画面のあとに出す年末の2枚（`advanceWeek`の`yearEnd`）。
  // `yearEndStep`＝今どちらを出しているか（null＝出していない／"summary"＝年末のまとめ／"retired"＝引退した馬）。
  const [yearEnd, setYearEnd] = useState(null);
  const [yearEndStep, setYearEndStep] = useState(null);
  const [sideTab, setSideTab] = useState(null); // 「自分」「番付」のどちらが開いているか（null＝依頼一覧）
  const sideOpen = sideTab != null; // 依頼一覧の代わりに別のタブが開いているか
  const rootRef = useRef(null);

  // ⭐週の初めの処理（未勝利のまま3歳の9月を迎えた馬が地方へ移る等）を済ませた名簿。
  // `advanceWeek`も同じ処理をしてから依頼を作るので、画面に出た依頼がそのまま走る。
  const weekRoster = useMemo(() => prepareWeek(roster, player).roster, [roster, player]);
  const horsesById = useMemo(() => new Map(weekRoster.horses.map((h) => [h.id, h])), [weekRoster]);
  const stablesById = useMemo(() => new Map(roster.stables.map((s) => [s.id, s])), [roster]);

  const week = player.currentWeek;
  const requests = useMemo(
    () => generateWeeklyRequests(saveSeed, week, weekRoster, player),
    [saveSeed, week, weekRoster, player]
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

  const weekPane = () => document.querySelector(".screen-pane--week");
  function openDetail(horseId) {
    scrollBeforeDetail.current = weekPane()?.scrollTop ?? 0;
    setDetailHorseId(horseId);
    weekPane()?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }
  // 閉じたら、開く前に見ていた行の位置へ戻す（一覧の先頭へ飛ぶと、見ていたレースを探し直すことになる）。
  function closeDetail() {
    setDetailHorseId(null);
    const top = scrollBeforeDetail.current;
    requestAnimationFrame(() => weekPane()?.scrollTo(0, top));
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
      // 最終週は年の区切りで引退した馬が名簿から抜けているので、抜ける前の馬を渡す
      // （その週の重賞の勝ち馬が引退馬でも結果を出せるように）。
      afterRoster: { ...res.roster, horses: res.weekEndHorses },
      rides: res.rides,
      week: player.currentWeek,
      year: player.currentYear,
      growth: res.growth, // 結果画面の「能力」の段（上がった・下がった適性・ランク）
    });
    setRoster(res.roster);
    setPlayer(res.player);
    setLastNotifications(res.notifications);
    // ⭐週を進めるたびに自動で保存する（本筋4・`TODO.md` #13）。失敗しても
    // プレイは止めない（`writeSave`は例外を投げない）。
    writeSave(saveSeed, startYear, res.roster, res.player);
    setPickedHorseIds(new Set());
    setOpenHorseId(null);
    setDetailHorseId(null);
    setSelectedDay(null);
    setSideTab(null);
    setViewCourseByDay({ [DAY.SAT]: null, [DAY.SUN]: null });
    setWeekResult(summary);
    setYearEnd(res.yearEnd ?? null);
    // 「この週を進める」は一覧の一番下にあるので、結果画面は先頭から見せる。
    document.querySelector(".screen-pane--week")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }

  function scrollPaneToTop() {
    document.querySelector(".screen-pane--week")?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }

  // 年末のまとめ →（載せる馬が居る年だけ）引退した馬 → 1月の最初の週
  function handleYearEndNext() {
    if (yearEndStep === "summary" && yearEnd.retired.length > 0) setYearEndStep("retired");
    else {
      setYearEndStep(null);
      setYearEnd(null);
    }
    scrollPaneToTop();
  }

  function handleWeekResultNext() {
    setWeekResult(null);
    if (yearEnd) setYearEndStep("summary"); // 年の最後の週は、週の画面へ戻る前に年末の2枚を挟む
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

  if (yearEnd && yearEndStep === "summary") {
    return (
      <YearEndSummaryScreen
        summary={yearEnd.summary}
        playerName={player.jockey.name}
        nextLabel={yearEnd.retired.length > 0 ? "次へ" : `${yearEnd.year + 1}年へ`}
        onNext={handleYearEndNext}
      />
    );
  }
  if (yearEnd && yearEndStep === "retired") {
    return <RetiredHorsesScreen year={yearEnd.year} retired={yearEnd.retired} onNext={handleYearEndNext} />;
  }

  if (entryListRequest) {
    const entryHorse = horsesById.get(entryListRequest.horseId);
    return (
      <EntryListScreen
        saveSeed={saveSeed}
        week={week}
        currentYear={player.currentYear}
        player={player}
        roster={weekRoster}
        horse={entryHorse}
        mount={entryListRequest}
        onClose={() => setEntryListRequest(null)}
      />
    );
  }

  const detailRequest = detailHorseId ? requestByHorseId.get(detailHorseId) : null;
  const detailHorse = detailRequest ? horsesById.get(detailRequest.horseId) : null;
  if (detailRequest && detailHorse) {
    return (
      <HorseDetail
        horse={detailHorse}
        request={detailRequest}
        player={player}
        saveSeed={saveSeed}
        stable={stablesById.get(detailRequest.stableId) ?? null}
        isPicked={pickedHorseIds.has(detailRequest.horseId)}
        onTogglePick={() => {
          togglePick(detailRequest.horseId);
          closeDetail();
        }}
        onClose={closeDetail}
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

      <div className="wk-days">
        {[DAY.SAT, DAY.SUN].map((d) => (
          <button
            key={d}
            type="button"
            className={[!sideOpen && d === day ? "is-on" : "", byDay[d].length === 0 ? "is-zero" : ""]
              .join(" ")
              .trim()}
            onClick={() => {
              setSelectedDay(d);
              setSideTab(null);
              setOpenHorseId(null);
            }}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
        <button
          type="button"
          className={sideTab === SIDE_TAB.PROFILE ? "is-on" : ""}
          onClick={() => {
            setSideTab(SIDE_TAB.PROFILE);
            setOpenHorseId(null);
          }}
        >
          {PROFILE_TAB_LABEL}
        </button>
        <button
          type="button"
          className={sideTab === SIDE_TAB.BANZUKE ? "is-on" : ""}
          onClick={() => {
            setSideTab(SIDE_TAB.BANZUKE);
            setOpenHorseId(null);
          }}
        >
          {BANZUKE_TAB_LABEL}
        </button>
      </div>

      {sideTab === SIDE_TAB.PROFILE && <JockeyProfile player={player} stables={roster.stables} />}
      {sideTab === SIDE_TAB.BANZUKE && <Banzuke roster={roster} player={player} />}

      {!sideOpen && !weekHasRequests && <div className="wk-empty">{EMPTY_WEEK_MESSAGE}</div>}

      {!sideOpen && weekHasRequests && coursesToday.length === 0 && (
        <div className="wk-empty">{emptyDayMessage(day)}</div>
      )}

      {!sideOpen && coursesToday.length > 0 && (
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

      {!sideOpen && viewIsLocked && (
        <div className="wk-empty is-lock">{lockedCourseMessage(day, goingToday, viewCourseId)}</div>
      )}

      {!sideOpen &&
        viewCourse &&
        viewCourse.races.map((race) => {
          const head = raceHeadline(race);
          return (
            <React.Fragment key={race.raceId}>
              <div className="wk-race">
                <div className="wk-race__big">
                  {race.raceLabel && <span className="wk-race__no">{race.raceLabel}</span>}
                  <span className={`wk-race__sf is-${race.surface}`}>{head.surfaceLabel}</span>
                  {head.distanceLabel}
                  <span className="wk-race__cls">{head.classLabel}</span>
                </div>
              </div>
              <div className={["wk-t", HAS_TRAINING_WEIGHT ? "" : "is-nokg"].join(" ").trim()}>
                <div className="wk-th">
                  <span>馬名</span>
                  <span>性齢</span>
                  <span>毛色</span>
                  {HAS_TRAINING_WEIGHT && <span className="wk-n">調教後</span>}
                  <span className="wk-n">前走から</span>
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
                  const since = horse ? weeksSinceLastRace(horse, week) : null;
                  const weight = trainingWeightView(trainingWeightFor, horse, player.currentYear, week, saveSeed);
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
                      <span className="wk-r__name">{horse?.name ?? request.horseId}</span>
                      <b>
                        {horse
                          ? sexAgeLabel(GENDER_LABEL[horse.gender] ?? horse.gender, horseAge(horse, player.currentYear))
                          : ""}
                      </b>
                      <b>{horse ? COAT_LABEL[horse.coat] ?? "" : ""}</b>
                      {/* 初出走は、増減の代わりに「前走から」の列へ「初出走」と書く（体重は数字だけ） */}
                      {HAS_TRAINING_WEIGHT && (
                        <b className="wk-n">{weight ? bodyWeightText(weight.kg, isDebut(since) ? null : weight.diff) : ""}</b>
                      )}
                      <b className="wk-n">{isDebut(since) ? "初出走" : intervalLabel(since)}</b>
                      <span className="wk-r__l2">
                        <span>
                          {isMain && <span className="wk-r__main">主戦</span>}
                          <span>{isPicked ? "乗ります" : horse ? recordLabel(horse) : ""}</span>
                          <span>{horse ? STRATEGY_LABELS[deriveFavoredStrategy(horse)] : ""}</span>
                          <span>
                            {head.surfaceColumnLabel}
                            <svg className="wk-r__sym" aria-hidden="true">
                              <use href={`#${horse ? surfaceMarkId(horse, race.surface) : "wk-m3"}`} />
                            </svg>
                          </span>
                        </span>
                        <span>
                          {stable?.trainerName ?? ""}
                          {request.isFromOwnStable && "　所属厩舎"}
                        </span>
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
                        <button
                          type="button"
                          className="wk-lnk"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(request.horseId);
                          }}
                        >
                          馬を見る
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })}

      <div
        className={["wk-adv", !sideOpen && (!weekHasRequests || coursesToday.length === 0) ? "is-tight" : ""]
          .join(" ")
          .trim()}
      >
        <button type="button" className="wk-btn" onClick={handleAdvance}>
          この週を進める
        </button>
      </div>
    </main>
  );
}
