import React from "react";
import { buildCareerSummary } from "../view/careerSummaryView.js";

// ⚠️仮の画面（動線を通すためだけ）。見た目はデザイナー（Fable）が差し替える（`devlog/wave13b.md`§35）。
// 値は`view/careerSummaryView.js`の`buildCareerSummary`が組んだものを並べるだけ。

export function CareerEndScreen({ player, roster, onBackToTitle }) {
  const s = buildCareerSummary({ player, roster });
  const yen = (n) => `${n.toLocaleString()}円`;
  return (
    <main style={{ padding: 16 }}>
      <h1>{s.identity.name}　騎手人生のまとめ</h1>
      <p>
        {s.identity.startYear}年（{s.identity.debutAge}歳）〜{s.identity.endYear}年（{s.identity.endAge}歳）／{s.rank.label}
      </p>
      <p>
        {s.totals.starts}戦{s.totals.wins}勝（勝率{(s.totals.winRate * 100).toFixed(1)}%）／重賞{s.totals.gradedWins}勝／
        G1・大レース{s.totals.g1Wins}勝／収入{yen(s.totals.income)}／所持金{yen(s.money)}
      </p>
      {s.bestYear && (
        <p>
          最も勝った年：{s.bestYear.year}年（{s.bestYear.age}歳）{s.bestYear.wins}勝
        </p>
      )}
      <h2>主な乗り馬</h2>
      <ul>
        {s.mainMounts.map((m) => (
          <li key={m.horseId}>
            {m.name ?? "—"}　{m.rides}回{m.isMain ? "（主戦）" : ""}　重賞{m.gradedWins}勝
          </li>
        ))}
      </ul>
      <h2>重賞の勝ち鞍</h2>
      <ul>
        {s.gradedWinList.map((w, i) => (
          <li key={i}>
            {w.year}年 {w.raceName}（{w.tier.toUpperCase()}）{w.horseName ?? ""}
          </li>
        ))}
      </ul>
      <h2>年ごとの成績</h2>
      <ul>
        {s.byYear.map((y) => (
          <li key={y.year}>
            {y.year}年（{y.age}歳）{y.starts}戦{y.wins}勝　重賞{y.gradedWins}勝
          </li>
        ))}
      </ul>
      <button type="button" onClick={onBackToTitle}>
        タイトルへ
      </button>
    </main>
  );
}
