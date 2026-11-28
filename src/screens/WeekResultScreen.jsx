// 週の結果の画面（「この週を進める」の後に1枚だけ挟む）。
// 乗った鞍の段の見本：`design/mocks/week-result-v2.html`の「案A 時刻表」（2026-11-27にユーザーが選んだ）
//   ——土曜→日曜に分け、レース番号の小さい順に1鞍1行。左にレース番号、右に着順。
//   行の中身：馬名／レースの条件（週の画面と同じ書き方）／性齢・毛色・当日の体重（前走比）。
// それ以外の段（上部・主戦・信頼・能力・重賞）は`design/mocks/week-result-v1.html`（2026-09-25）のまま。
// 中身はユーザーが選んだ5つ：乗った鞍の結果／稼いだお金と所持金／主戦の進み具合／
// 調教師からの信頼の変化（言葉で出す。数字は出さない）／その週の重賞の勝ち馬。
// データは`domain/weekResultSummary.js`の`buildWeekResultSummary`が作る（この画面は計算しない）。
// ⚠️落馬した鞍は着順の場所に「落馬」と出すだけ。怪我の週数・主戦を失った知らせは週の画面の
// 「先週の出来事」が出すので、ここでは言い直さない（CLAUDE.md §7）。

import React from "react";
import { buildGrowthLines } from "../view/jockeyProfileView.js";
import { raceNumberLabel } from "../view/raceNumberView.js";
import { sexAgeLabel, bodyWeightText, groupRidesByDay } from "../view/horseRowView.js";
import { GENDER_LABEL } from "../domain/horse.js";
import { COAT_LABEL } from "../data/coat.js";
import { MAIN_MOUNT_RIDES_REQUIRED } from "../domain/mainMount.js";
import "./WeekResultScreen.css";

const yen = (n) => `${n.toLocaleString("ja-JP")}円`;
const signedYen = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("ja-JP")}円`;

const TRUST_WORDS = {
  bigUp: "大きく上がりました",
  up: "少し上がりました",
  down: "少し下がりました",
  bigDown: "大きく下がりました",
};

// 主戦の段は数で出す（2026-11-28のユーザー決定・`devlog/wave15.md`§4の2B）：「騎乗 1／5　勝ち 0／1」。
// 条件は`domain/mainMount.js`（合わせて5回乗る・その間に1回勝つ）。5回を超えて乗っても「5／5」で止める。
function mainMountText(m) {
  if (m.status === "became") return "主戦になりました";
  const rides = MAIN_MOUNT_RIDES_REQUIRED - m.ridesLeft;
  return `騎乗 ${rides}／${MAIN_MOUNT_RIDES_REQUIRED}　勝ち ${m.needsWin ? 0 : 1}／1`;
}

/**
 * 馬の1行：「牝3　鹿毛　418kg（−14）」。無い項目は飛ばす（性齢・毛色・体重は
 * `buildWeekResultSummary`が`gender`・`age`・`coat`・`bodyKg`・`bodyKgDiff`を足すまでは空）。
 * `bodyKgDiff`がnull＝初出走（増減の代わりに「初出走」）。undefined＝前走の体重が分からない（体重だけ）。
 */
function horseLine(ride) {
  const sexAge = ride.gender ? sexAgeLabel(GENDER_LABEL[ride.gender] ?? ride.gender, ride.age) : "";
  const coat = ride.coat ? COAT_LABEL[ride.coat] ?? ride.coat : "";
  const weight = bodyWeightText(ride.bodyKg, ride.bodyKgDiff, { debut: ride.bodyKgDiff === null, unit: "kg" });
  return [sexAge, coat, weight].filter(Boolean).join("　");
}

function RideRow({ ride }) {
  const head = ride.headline;
  const sub = horseLine(ride);
  return (
    <div className="wr-ride">
      <div className="wr-ride__no">{raceNumberLabel(ride.raceNumber)}</div>
      <div className="wr-ride__mid">
        <div className="wr-ride__name">{ride.horseName}</div>
        <div className="wr-ride__sub">
          <span className={`wr-sf is-${ride.surface}`}>{head.surfaceLabel}</span>
          {head.distanceLabel} {head.classLabel}
        </div>
        {sub && <div className="wr-ride__sub">{sub}</div>}
      </div>
      <div>
        {ride.fell ? (
          <div className="wr-ride__pos is-fell">落馬</div>
        ) : (
          <>
            <div className={["wr-ride__pos", ride.won ? "is-win" : ""].join(" ").trim()}>
              {ride.position}
              <small>着</small>
            </div>
            <div className="wr-ride__pop">
              {ride.popularity}番人気／{ride.fieldSize}頭
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WeekResultScreen({ summary, onNext }) {
  const { weekLabel, moneyGained, moneyAfter, rides, mainMounts, trust, graded } = summary;
  // 「能力」の段（案C 梯子・2026-09-27）：上がった適性は黄、下がった適性は弱い文字＋理由の一言、
  // ランクが上がったら「◯◯に上がりました」。何も動かなかった週は段ごと出さない。
  const growth = buildGrowthLines(summary.growth);
  const hasGrowth = growth.rankLine != null || growth.lines.length > 0;
  return (
    <main className="week-result">
      <div className="wr-hd">
        <div className="wr-hd__week">{weekLabel}</div>
        <div className="wr-hd__money">
          今週<b>{signedYen(moneyGained)}</b>
          所持金 {yen(moneyAfter)}
        </div>
      </div>

      {rides.length === 0 && <p className="wr-empty">今週は乗りませんでした。</p>}
      {groupRidesByDay(rides).map((group, gi) => (
        <React.Fragment key={group.dayLabel ?? gi}>
          {group.dayLabel && (
            <h2 className="wr-day">
              {group.dayLabel}
              {group.courseName && <span>{group.courseName}</span>}
            </h2>
          )}
          {group.emptyText ? (
            <p className="wr-empty is-day">{group.emptyText}</p>
          ) : (
            <div className="wr-rides">
              {group.rides.map((r, i) => (
                <RideRow key={`${r.horseId}-${i}`} ride={r} />
              ))}
            </div>
          )}
        </React.Fragment>
      ))}

      {mainMounts.length > 0 && (
        <section className="wr-sec">
          <h2>主戦</h2>
          {mainMounts.map((m) => (
            <div className="wr-line" key={m.horseId}>
              <span>{m.horseName}</span>
              <span className={m.status === "became" ? "wr-line__v is-hot" : "wr-line__v"}>{mainMountText(m)}</span>
            </div>
          ))}
        </section>
      )}

      {trust.length > 0 && (
        <section className="wr-sec">
          <h2>調教師からの信頼</h2>
          {trust.map((t) => (
            <div className="wr-line" key={t.stableId}>
              <span>{t.trainerName}調教師</span>
              <span className="wr-line__v">{TRUST_WORDS[t.change]}</span>
            </div>
          ))}
        </section>
      )}

      {hasGrowth && (
        <section className="wr-sec">
          <h2>能力</h2>
          {growth.rankLine && (
            <div className="wr-line">
              <span className="wr-line__hot">{growth.rankLine}</span>
            </div>
          )}
          {growth.lines.map((g) => (
            <div className="wr-line" key={g.key}>
              <span className="wr-line__l">
                {g.label}
                {g.reason && <small>{g.reason}</small>}
              </span>
              <span className={["wr-line__gch", g.up ? "is-up" : "is-down"].join(" ")}>
                {g.from} → {g.to}
              </span>
            </div>
          ))}
        </section>
      )}

      {graded.length > 0 && (
        <section className="wr-sec">
          <h2>今週の重賞</h2>
          {graded.map((g) => (
            <div className="wr-graded" key={g.raceName}>
              <div>
                <div className="wr-graded__race">
                  {g.raceName}・{g.courseName}
                </div>
                <div className="wr-graded__winner">{g.winnerName}</div>
              </div>
              <div className="wr-graded__jockey">
                {g.jockeyName}
                <br />
                {g.popularity}番人気
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="wr-foot">
        <button type="button" className="wr-btn" onClick={onNext}>
          次の週へ
        </button>
      </div>
    </main>
  );
}
