import React, { useState } from "react";
import "./styles/type.css";
import { TitleScreen } from "./screens/TitleScreen.jsx";
import { DreamDerbyScreen } from "./screens/DreamDerbyScreen.jsx";
import { GraduationScreen } from "./screens/GraduationScreen.jsx";
import { WeekScreen } from "./screens/WeekScreen.jsx";
import { createSaveSeed } from "./core/rng.js";

// 画面遷移の起点。タイトル→夢のダービー→卒業式→週の進行（1年目の終わりまで）。
// ⚠️週の進行画面（WeekScreen）は見た目が仮（ARCHITECTURE.md「第2弾の範囲」）。
// 騎乗依頼を面で見せる本番のUIは第3弾・第4弾へ送った（`TODO.md` #23・#24）。
export function App() {
  const [career, setCareer] = useState(null); // { saveSeed, year, difficulty }
  const [dreamResult, setDreamResult] = useState(null); // { dreamHorseId, choiceIds, won }
  const [gameState, setGameState] = useState(null); // { roster, player }

  if (career && gameState) {
    return (
      <WeekScreen
        saveSeed={career.saveSeed}
        startYear={career.year}
        initialRoster={gameState.roster}
        initialPlayer={gameState.player}
      />
    );
  }

  if (career && dreamResult) {
    return (
      <GraduationScreen
        saveSeed={career.saveSeed}
        startYear={career.year}
        difficulty={career.difficulty}
        dreamChoiceIds={dreamResult.choiceIds}
        onComplete={(state) => setGameState(state)}
      />
    );
  }

  if (career) {
    return <DreamDerbyScreen saveSeed={career.saveSeed} onGraduate={(payload) => setDreamResult(payload)} />;
  }

  return (
    <TitleScreen onStart={(year, difficulty) => setCareer({ saveSeed: createSaveSeed(), year, difficulty })} />
  );
}
