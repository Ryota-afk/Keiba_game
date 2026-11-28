// 馬の詳しい画面（週の画面で依頼の行を開き「馬を見る」を押すと開く。2026-11-28・Fable）。
// 見本：`design/mocks/horse-detail-v1.html`「案A 能力表」（ユーザーが選んだ）。決定は`devlog/wave13b.md`§33。
// 主役＝レースで乗って分かった能力（適距離の帯の図と5つの枠）。まだ分からない項目は暗い枠に「？」。
// 並び：依頼のレース → 絵・馬名・性齢・毛色・クラス・調教師 → 体重・前走から・脚質・相性 →
//       レースで乗って分かること（6）→ 朝の調教で分かること（3）→ 戦績（新しい順・最大6走）→ 乗る／閉じる。
// データは`view/horseDetailView.js`の`buildHorseDetail`が組む（この画面は計算しない）。絵は`view/dreamDerbySprite.js`の立ち姿。
// ⚠️週の画面（`WeekScreen.jsx`）が、週の画面の代わりにこの1枚を出す（出馬表と同じ出し方）。

import React, { useMemo } from "react";
import { buildHorseDetail } from "../view/horseDetailView.js";
import { standingHorseSvg } from "../view/dreamDerbySprite.js";
import { trainingWeightFor } from "../domain/horseForm.js";
import { GENDER_LABEL, weeksSinceLastRace } from "../domain/horse.js";
import { horseAge } from "../domain/retirement.js";
import { isMainMount } from "../domain/mainMount.js";
import { deriveFavoredStrategy } from "../domain/strategy.js";
import { SurfaceMarkDefs } from "./SurfaceMarkDefs.jsx";
import "./HorseDetail.css";

const DEPS = Object.freeze({
  trainingWeightFor,
  weeksSinceLastRace,
  horseAge,
  isMainMount,
  deriveFavoredStrategy,
  genderLabel: GENDER_LABEL,
});
const UNKNOWN = "？";
const pct = (ratio) => `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;

function Mark({ id }) {
  return (
    <svg className="hd-sym" aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

/** 適距離の枠：1000〜4000mの帯に、分かっている幅（黄）と今回のレースの距離の印。 */
function DistanceBox({ item }) {
  const span = item.axisMax - item.axisMin;
  const at = (m) => (m - item.axisMin) / span;
  return (
    <div className={["hd-dist", item.known ? "" : "is-q"].join(" ").trim()}>
      <div className="hd-dist__hd">
        <span className="hd-dist__l">{item.label}</span>
        <span className="hd-dist__v">{item.known ? item.value : UNKNOWN}</span>
      </div>
      <div className="hd-dist__bar">
        <div className="hd-dist__track" />
        {item.known && (
          <div className="hd-dist__band" style={{ left: pct(at(item.lo)), width: pct(at(item.hi) - at(item.lo)) }} />
        )}
        {item.raceDistance != null && (
          <div className="hd-dist__now" style={{ left: pct(at(item.raceDistance)) }}>
            今回
          </div>
        )}
        <div className="hd-dist__ax">
          <span>{item.axisMin}m</span>
          <span>2000</span>
          <span>3000</span>
          <span>{item.axisMax}m</span>
        </div>
      </div>
    </div>
  );
}

function AbilityCell({ item, small }) {
  return (
    <div className={["hd-ab", item.known ? "" : "is-q", small ? "is-s" : ""].join(" ").trim()}>
      <div className="hd-ab__l">{item.label}</div>
      <div className="hd-ab__v">{item.known ? item.value : UNKNOWN}</div>
      {!small && (
        <div className="hd-ab__m">
          <i style={{ width: item.known ? pct(item.ratio) : 0 }} />
        </div>
      )}
    </div>
  );
}

function Run({ run }) {
  return (
    <div className={["hd-run", run.won ? "is-win" : ""].join(" ").trim()}>
      <span className="hd-run__pos">
        {run.position}
        <small>着</small>
      </span>
      <span className="hd-run__where">
        {run.courseName} <b className={`hd-sf is-${run.surface}`}>{run.surfaceLabel}</b>
        {run.distance != null && `${run.distance}m`} {run.goingLabel}
      </span>
      <span className="hd-run__kg">
        {run.bodyKg != null && (
          <>
            <b>{run.bodyKg}</b>
            {run.bodyKgDiffText && `（${run.bodyKgDiffText}）`}
          </>
        )}
      </span>
      <span className="hd-run__sub">
        {run.dateLabel}　{run.raceName}
        {run.popularity != null && run.fieldSize != null && `　${run.popularity}番人気／${run.fieldSize}頭`}
        {run.byPlayer && <span className="hd-mk">　自分</span>}
      </span>
    </div>
  );
}

/**
 * @param {{ horse: object, request: object, player: object, saveSeed: number|string,
 *   stable: { trainerName?: string }|null, isPicked: boolean, onTogglePick: () => void, onClose: () => void }} props
 */
export function HorseDetail({ horse, request, player, saveSeed, stable, isPicked, onTogglePick, onClose }) {
  const d = useMemo(
    () => buildHorseDetail({ horse, request, player, saveSeed, stable, deps: DEPS }),
    [horse, request, player, saveSeed, stable]
  );
  const picture = useMemo(
    () =>
      standingHorseSvg({
        coat: horse.coat,
        coatGenes: horse.coatGenes,
        age: horseAge(horse, player.currentYear),
        face: horse.markings?.face,
        legs: horse.markings?.legs,
      }),
    [horse, player.currentYear]
  );
  const c = d.context;
  const id = d.identity;
  const [distance, ...cells] = d.raceItems;
  const kgDiff = !d.weight.isDebut && d.weight.kg != null ? d.weight.text.replace(`${d.weight.kg}kg`, "") : "";

  return (
    <main className="horse-detail">
      <SurfaceMarkDefs />

      <div className="hd-ctx">
        {c.weekLabel}
        {c.raceLabel && <span className="hd-ctx__d">　{c.raceLabel}</span>}
        {"　"}
        <b className={`hd-sf is-${c.surface}`}>{c.surfaceLabel}</b>
        <span className="hd-ctx__d">{c.distanceLabel}</span>　{c.classLabel}
      </div>

      <div className="hd-top">
        <div className="hd-pic" dangerouslySetInnerHTML={{ __html: picture }} />
        <div>
          <h1 className="hd-name">
            {id.name}
            {id.isMain && <span className="hd-mk">主戦</span>}
          </h1>
          <div className="hd-id">
            <span>
              <b>{id.sexAge}</b>
            </span>
            <span>
              <b>{id.coatLabel}</b>
            </span>
            <span>{id.classLabel}</span>
          </div>
          <div className="hd-id">
            <span>
              {id.trainer}
              {id.isOwnStable && "　所属厩舎"}
            </span>
          </div>
        </div>
      </div>

      <div className="hd-facts">
        <div className="hd-fact">
          <small>調教後の体重</small>
          {d.weight.kg != null ? (
            <span className="hd-num">
              {d.weight.kg}kg<i>{kgDiff}</i>
            </span>
          ) : (
            "—"
          )}
        </div>
        <div className="hd-fact">
          <small>前走から</small>
          {d.weight.intervalText}
        </div>
        <div className="hd-fact">
          <small>脚質</small>
          {d.strategy.label}
        </div>
        <div className="hd-fact">
          <small>相性</small>芝<Mark id={d.surfaceAptitude.turf} />
          {"　ダート"}
          <Mark id={d.surfaceAptitude.dirt} />
        </div>
      </div>

      <section className="hd-sec">
        <h2 className="hd-h">
          <span>レースで乗って分かること</span>
          <span className="hd-h__n">
            <b>{d.raceKnown}</b>／{d.raceTotal}
          </span>
        </h2>
        <DistanceBox item={distance} />
        <div className="hd-grid is-c5">
          {cells.map((item) => (
            <AbilityCell key={item.key} item={item} />
          ))}
        </div>
      </section>

      <section className="hd-sec">
        <h2 className="hd-h">
          <span>朝の調教で分かること</span>
          <span className="hd-h__n">
            <b>{d.trainingKnown}</b>／{d.trainingTotal}
          </span>
        </h2>
        <div className="hd-grid is-c3">
          {d.trainingItems.map((item) => (
            <AbilityCell key={item.key} item={item} small />
          ))}
        </div>
      </section>

      <section className="hd-sec">
        <h2 className="hd-h">
          <span>戦績</span>
          <span className="hd-h__n">{d.recordText}</span>
        </h2>
        {d.runs.length > 0 ? (
          d.runs.map((run, i) => <Run key={i} run={run} />)
        ) : (
          <div className="hd-empty">まだ走っていません。</div>
        )}
      </section>

      <div className="hd-foot">
        <button type="button" className="hd-btn" onClick={onTogglePick}>
          {isPicked ? "外す" : "乗る"}
        </button>
        <button type="button" className="hd-lnk" onClick={onClose}>
          閉じる
        </button>
      </div>
    </main>
  );
}
