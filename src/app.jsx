import React, { useState } from "react";
import { TitleScreen } from "./screens/TitleScreen.jsx";

// 画面遷移の起点。⚠️夢のダービー・卒業式の画面はまだ無い（⑤の続き）。
// タイトルの選択結果だけを受け取り、次の画面ができるまでは確認表示に留める。
export function App() {
  const [started, setStarted] = useState(null);

  if (started) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        <p>
          {started.year}年・{started.difficulty} で開始（夢のダービー画面は未実装）
        </p>
      </main>
    );
  }

  return <TitleScreen onStart={(year, difficulty) => setStarted({ year, difficulty })} />;
}
