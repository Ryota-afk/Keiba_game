// 週の進行の最小画面（第2弾の範囲：「デビュー→1年目の終わり」を人が通せる形まで）。
// ⚠️見た目は仮（ARCHITECTURE.md「第2弾の範囲」）。騎乗依頼を面で見せる本番のUI
// （`design/mocks/week-offers-v3.html`の案2で2026-09-17に合意済み）は、見た目の実装を
// Fableが担当する本筋3・手順5でここへ移す（CLAUDE.md §8・`devlog/wave09.md`§9）。
// ここは土日それぞれの競馬場選択・1レース1頭・断るコストなど、本筋3で決まった
// 背後のロジックが正しく動くことだけを満たす仮の見た目のまま。

import React, { useMemo, useState } from "react";
import { advanceWeek } from "../domain/weekLoop.js";
import { generateWeeklyRequests, RIDABLE_SLOTS_PER_WEEK } from "../domain/weeklyRequests.js";
import { courseIdsAvailable } from "../domain/fridayConfirmation.js";
import { DAY } from "../data/weekDays.js";
import { weekOfYear } from "../data/calendar.js";
import { findCourse } from "../data/courses.js";
import { NOTIFICATION_TYPES } from "../domain/notifications.js";
import { RANK_LABELS } from "../data/ranks.js";
import { INJURY_LABELS } from "../data/injuryLabels.js";
import { SURFACE_LABELS } from "../data/aptitudeLabels.js";
import { classDisplayName } from "../data/classes.js";
import { EntryListScreen } from "./EntryListScreen.jsx";

function notificationText(n, horsesById, stablesById) {
  const horseName = (id) => horsesById.get(id)?.name ?? id;
  switch (n.type) {
    case NOTIFICATION_TYPES.LOST_MAIN_MOUNT:
      return `主戦の座を失った：${horseName(n.horseId)}`;
    case NOTIFICATION_TYPES.INJURY:
      return `落馬・怪我：${horseName(n.horseId)}（${INJURY_LABELS[n.injuryType] ?? n.injuryType}・${n.weeksOut}週間乗れません）`;
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
  const [selectedCourseByDay, setSelectedCourseByDay] = useState({ [DAY.SAT]: null, [DAY.SUN]: null });
  // 出馬表を開いている依頼（質問25＝(ア)：月曜の依頼の段階から見せる）。
  const [entryListRequest, setEntryListRequest] = useState(null);

  const horsesById = useMemo(() => new Map(roster.horses.map((h) => [h.id, h])), [roster]);
  const stablesById = useMemo(() => new Map(roster.stables.map((s) => [s.id, s])), [roster]);

  const week = player.currentWeek;
  const requests = useMemo(
    () => generateWeeklyRequests(saveSeed, week, roster, player),
    [saveSeed, week, roster, player]
  );
  const coursesByDay = useMemo(() => courseIdsAvailable(requests), [requests]);
  // ⭐**1日1場**（2026-09-16のユーザー決定）——土曜・日曜それぞれで競馬場を選べる。
  // 選んだ場が今週の一覧に無ければ、その日の最初の候補に戻す。
  const courseByDay = {
    [DAY.SAT]:
      selectedCourseByDay[DAY.SAT] && coursesByDay[DAY.SAT].includes(selectedCourseByDay[DAY.SAT])
        ? selectedCourseByDay[DAY.SAT]
        : coursesByDay[DAY.SAT][0] ?? null,
    [DAY.SUN]:
      selectedCourseByDay[DAY.SUN] && coursesByDay[DAY.SUN].includes(selectedCourseByDay[DAY.SUN])
        ? selectedCourseByDay[DAY.SUN]
        : coursesByDay[DAY.SUN][0] ?? null,
  };

  const yearCompleted = player.currentYear > startYear;

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

  function handleAdvance() {
    const res = advanceWeek(saveSeed, roster, player, {
      chooseCourse: () => courseByDay,
    });
    setRoster(res.roster);
    setPlayer(res.player);
    setLog((prev) => [{ week, year: player.currentYear, notifications: res.notifications }, ...prev]);
    setSelectedCourseByDay({ [DAY.SAT]: null, [DAY.SUN]: null });
  }

  return (
    <main
      style={{
        // ⚠️外枠`.screen-stack`（styles/motion.css）は黒地。ここが透明だと黒地に黒文字になる
        // （2026-09-06に人間の通しプレイで「週メニューが真っ黒」と報告された）。
        // 暗転の覆い（`.m6-cover`）と同じクリーム色を敷き、縦にあふれた分はこの画面の中でスクロールさせる。
        background: "#f2ede0",
        color: "#1c1712",
        minHeight: "100dvh",
        boxSizing: "border-box",
        overflowY: "auto",
        padding: 24,
        fontFamily: "\"M PLUS 1p\", sans-serif",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 20 }}>
        {player.currentYear}年 {weekOfYear(week)}週目
      </h1>
      <p>
        騎手：{player.jockey.name}（{RANK_LABELS[player.jockey.rank] ?? player.jockey.rank}） ／ 所持金：{player.money.toLocaleString()}円
      </p>

      {yearCompleted && (
        <p style={{ background: "#dff5df", padding: 12, fontWeight: "bold" }}>
          1年目が終わりました。（第2弾の範囲はここまで）
        </p>
      )}

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15 }}>今週の依頼（{requests.length}件・乗れるのは{RIDABLE_SLOTS_PER_WEEK}鞍）</h2>
        <ul>
          {requests.map((r) => {
            const horse = horsesById.get(r.horseId);
            const stable = stablesById.get(r.stableId);
            const course = findCourse(r.courseId);
            const raceLabel = r.raceName ?? classDisplayName(r.classId);
            return (
              <li key={r.horseId}>
                {horse?.name} （{stable?.trainerName}厩舎） — {raceLabel}
                {r.grade ? `（${r.grade.toUpperCase()}）` : ""}{" "}
                {r.day === DAY.SAT ? "土曜" : "日曜"} {course?.name ?? r.courseId}{" "}
                {SURFACE_LABELS[r.surface] ?? r.surface}
                {r.distance}m{" "}
                <button type="button" onClick={() => setEntryListRequest(r)}>
                  出馬表を見る
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {[DAY.SAT, DAY.SUN].map((day) =>
        coursesByDay[day].length > 1 ? (
          <section key={day}>
            <h2 style={{ fontSize: 15 }}>
              {day === DAY.SAT ? "土曜" : "日曜"}に行く競馬場を選ぶ
            </h2>
            {coursesByDay[day].map((cid) => (
              <label key={cid} style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name={`course-${day}`}
                  checked={courseByDay[day] === cid}
                  onChange={() =>
                    setSelectedCourseByDay((prev) => ({ ...prev, [day]: cid }))
                  }
                />
                {findCourse(cid)?.name ?? cid}
              </label>
            ))}
          </section>
        ) : null
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
