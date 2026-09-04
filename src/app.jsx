import React, { useState } from "react";
import { TitleScreen } from "./screens/TitleScreen.jsx";
import { DreamDerbyScreen } from "./screens/DreamDerbyScreen.jsx";
import { createSaveSeed } from "./core/rng.js";

// 画面遷移の起点。⚠️卒業式以降の画面はまだ無い（第2弾の続き）。
// タイトルの選択後は夢のダービーへ進み、「卒業式へ」を押した先は次の画面ができるまで
// 確認表示に留める。
export function App() {
  const [career, setCareer] = useState(null); // { saveSeed, year, difficulty }
  const [graduated, setGraduated] = useState(false);

  if (career && graduated) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        <p>今日、競馬学校を卒業する。（卒業式の画面は未実装）</p>
      </main>
    );
  }

  if (career) {
    return <DreamDerbyScreen saveSeed={career.saveSeed} onGraduate={() => setGraduated(true)} />;
  }

  return (
    <TitleScreen onStart={(year, difficulty) => setCareer({ saveSeed: createSaveSeed(), year, difficulty })} />
  );
}
