// 出馬表の画面（案E・`design/mocks/entry-list-v2.html`で合意）。
// 競馬新聞の馬柱を横に並べ、1頭が1列・上から新しい順に直近5走を表示する。
// 質問25＝(ア)：月曜の依頼の段階から見せ、金曜の確定で枠番と人気が付く。
// ⚠️今回はプレイヤー自身の鞍（`mount`）1つぶんの出馬表を表示する。重賞・オープン特別の
// 単独の出馬表（プレイヤーが乗っていないレース）は別途。

import React, { useMemo } from "react";
import { previewEntryField } from "../domain/entryListPreview.js";
import { assignStablePrimaryJockeys, jockeyIdForHorse } from "../domain/jockeyAssignment.js";
import { GENDER_LABEL, STANDARD_WEIGHT } from "../domain/horse.js";
import { classDisplayName } from "../data/classes.js";
import { buildEntryColumn, buildEntryListHeader } from "../view/entryListView.js";
import "./EntryListScreen.css";

/**
 * @param {{ saveSeed: number|string, week: number, currentYear: number, player: object,
 *           roster: object, horse: object, mount: { horseId: string, surface: string,
 *           courseId?: string, distanceBand?: string }, onClose?: () => void }} props
 */
export function EntryListScreen({ saveSeed, week, currentYear, player, roster, horse, mount, onClose }) {
  const jockeyById = useMemo(() => new Map(roster.npcJockeys.map((j) => [j.id, j])), [roster.npcJockeys]);
  const primaryJockeyByStable = useMemo(
    () => assignStablePrimaryJockeys(roster.stables, roster.npcJockeys),
    [roster.stables, roster.npcJockeys]
  );

  const field = useMemo(
    () => previewEntryField(saveSeed, week, horse, mount, roster.horses),
    [saveSeed, week, horse, mount, roster.horses]
  );

  const columns = useMemo(
    () =>
      field.map((entry) => {
        const isSelf = entry.id === horse.id;
        const jockeyName = isSelf
          ? player.jockey.name
          : jockeyById.get(jockeyIdForHorse(entry, primaryJockeyByStable))?.name ?? "騎手未定";
        const genderLabel = GENDER_LABEL[entry.gender] ?? entry.gender;
        const age = entry.bornYear != null ? currentYear - entry.bornYear : null;
        const weight = STANDARD_WEIGHT[entry.gender] ?? 57.0;
        return buildEntryColumn(entry, { isSelf, jockeyName }, genderLabel, age ?? "?", weight);
      }),
    [field, horse.id, player.jockey.name, jockeyById, primaryJockeyByStable, currentYear]
  );

  const header = useMemo(
    () =>
      buildEntryListHeader({
        classId: horse.classId,
        raceName: classDisplayName(horse.classId),
        courseId: mount.courseId ?? null,
        surface: mount.surface,
        distanceBand: mount.distanceBand ?? null,
        fieldSize: field.length,
      }),
    [horse.classId, mount.courseId, mount.surface, mount.distanceBand, field.length]
  );

  return (
    <div className="entry-list-screen">
      <header className="els-head">
        {header.gradeLabel && <div className="els-grade">{header.gradeLabel}</div>}
        <h1 className="els-name">{header.name}</h1>
        <div className="els-where">{header.whereLine}</div>
      </header>

      <div className="els-scroller">
        <div className="els-cols">
          {columns.map((col) => (
            <div key={col.horseId} className={`els-col els-w${col.waku}${col.isSelf ? " els-self" : ""}`}>
              <div className="els-top">
                <span className="els-waku">{col.waku}</span>
                <span className="els-num">{col.postNumber}</span>
                {col.popularity != null && <span className="els-pop">{col.popularity}番人気</span>}
              </div>
              <div className="els-horsename">{col.name}</div>
              <div className="els-rider">{col.riderLine}</div>
              {col.history.length === 0 ? (
                <div className="els-race els-first">初出走</div>
              ) : (
                col.history.map((row, i) => (
                  <div className="els-race" key={i}>
                    <b>{row.raceName}</b>
                    {row.dateLabel} {row.courseName} {row.trackLabel}
                    <br />
                    <span className={`els-fin${row.won ? " els-win" : ""}`}>{row.finishLabel}</span>
                    {row.fieldSize != null && `/${row.fieldSize}頭`}
                    {row.popularity != null && ` ${row.popularity}人気`}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {onClose && (
        <button type="button" className="els-close" onClick={onClose}>
          閉じる
        </button>
      )}
    </div>
  );
}
