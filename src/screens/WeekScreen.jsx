// 週の進行の最小画面（第2弾の範囲：「デビュー→1年目の終わり」を人が通せる形まで）。
// ⚠️見た目は仮（ARCHITECTURE.md「第2弾の範囲」）。騎乗依頼を面で見せる本番のUI
// （`design/mocks/riding-offers-v2.html`）は番組表と同じく第3弾・第4弾へ送った
// （`TODO.md` #23・#24）。ここは「週を進めれば何が起きるかが分かる」ことだけを満たす。

import React, { useMemo, useState } from "react";
import { advanceWeek } from "../domain/weekLoop.js";
import { generateWeeklyRequests, RIDABLE_SLOTS_PER_WEEK } from "../domain/weeklyRequests.js";
import { resolveWeekRaceContexts, courseIdsAvailable } from "../domain/fridayConfirmation.js";
import { weekOfYear } from "../data/calendar.js";
import { findCourse } from "../data/courses.js";
import { NOTIFICATION_TYPES } from "../domain/notifications.js";

function notificationText(n, horsesById, stablesById) {
  const horseName = (id) => horsesById.get(id)?.name ?? id;
  switch (n.type) {
    case NOTIFICATION_TYPES.LOST_MAIN_MOUNT:
      return `主戦の座を失った：${horseName(n.horseId)}`;
    case NOTIFICATION_TYPES.INJURY:
      return `落馬・怪我：${horseName(n.horseId)}（${n.injuryType}・${n.weeksOut}週離脱）`;
    case NOTIFICATION_TYPES.BIG_TRUST_CHANGE: {
      const targetName =
        n.targetType === "trainer" ? stablesById.get(n.targetId)?.trainerName ?? n.targetId : n.targetId;
      return `信頼が大きく動いた：${targetName}（${n.delta > 0 ? "+" : ""}${n.delta}）`;
    }
    case NOTIFICATION_TYPES.NEW_REQUEST:
      return `新しい依頼：${horseName(n.horseId)}`;
    case NOTIFICATION_TYPES.FATIGUE_DANGER:
      return `疲労が危険水域（${n.fatigue}）`;
    default:
      return JSON.stringify(n);
  }
}

/**
 * @param {{ saveSeed: number|string, startYear: number, initialRoster: object,
 *           initialPlayer: object }} props
 */
export function WeekScreen({ saveSeed, startYear, initialRoster, initialPlayer }) {
  const [roster, setRoster] = useState(initialRoster);
  const [player, setPlayer] = useState(initialPlayer);
  const [log, setLog] = useState([]); // { week, year, notifications: [] }[]
  const [selectedCourse, setSelectedCourse] = useState(null);

  const horsesById = useMemo(() => new Map(roster.horses.map((h) => [h.id, h])), [roster]);
  const stablesById = useMemo(() => new Map(roster.stables.map((s) => [s.id, s])), [roster]);

  const week = player.currentWeek;
  const requests = useMemo(
    () => generateWeeklyRequests(saveSeed, week, roster, player),
    [saveSeed, week, roster, player]
  );
  const withCtx = useMemo(
    () => resolveWeekRaceContexts(saveSeed, week, requests),
    [saveSeed, week, requests]
  );
  const courses = useMemo(() => courseIdsAvailable(withCtx), [withCtx]);
  const chosenCourse = selectedCourse && courses.includes(selectedCourse) ? selectedCourse : courses[0] ?? null;

  const yearCompleted = player.currentYear > startYear;

  function handleAdvance() {
    const res = advanceWeek(saveSeed, roster, player, {
      chooseCourse: chosenCourse ? () => chosenCourse : undefined,
    });
    setRoster(res.roster);
    setPlayer(res.player);
    setLog((prev) => [{ week, year: player.currentYear, notifications: res.notifications }, ...prev]);
    setSelectedCourse(null);
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20 }}>
        {player.currentYear}年 {weekOfYear(week)}週目
      </h1>
      <p>
        騎手：{player.jockey.name}（{player.jockey.rank}） ／ 所持金：{player.money.toLocaleString()}円
      </p>

      {yearCompleted && (
        <p style={{ background: "#dff5df", padding: 12, fontWeight: "bold" }}>
          1年目が終わりました。（第2弾の範囲はここまで）
        </p>
      )}

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15 }}>今週の依頼（{requests.length}件・乗れるのは{RIDABLE_SLOTS_PER_WEEK}鞍）</h2>
        <ul>
          {withCtx.map((r) => {
            const horse = horsesById.get(r.horseId);
            const stable = stablesById.get(r.stableId);
            const course = findCourse(r.courseId);
            return (
              <li key={r.horseId}>
                {horse?.name} （{stable?.trainerName}厩舎） — {course?.name ?? r.courseId} {r.surface}
                {r.distanceBand}
              </li>
            );
          })}
        </ul>
      </section>

      {courses.length > 1 && (
        <section>
          <h2 style={{ fontSize: 15 }}>行く競馬場を選ぶ（週末に乗れるのは1つ）</h2>
          {courses.map((cid) => (
            <label key={cid} style={{ marginRight: 12 }}>
              <input
                type="radio"
                name="course"
                checked={chosenCourse === cid}
                onChange={() => setSelectedCourse(cid)}
              />
              {findCourse(cid)?.name ?? cid}
            </label>
          ))}
        </section>
      )}

      <button type="button" onClick={handleAdvance} style={{ marginTop: 16, padding: "10px 20px" }}>
        この週を進める
      </button>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15 }}>これまでの通知</h2>
        {log.length === 0 && <p>まだありません。</p>}
        {log.map((entry, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>
              {entry.year}年 {weekOfYear(entry.week)}週目
            </strong>
            {entry.notifications.length === 0 ? (
              <p>特になし。</p>
            ) : (
              <ul>
                {entry.notifications.map((n, j) => (
                  <li key={j}>{notificationText(n, horsesById, stablesById)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
