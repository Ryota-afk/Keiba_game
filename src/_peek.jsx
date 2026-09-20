// 一時的な確認用の入口（撮り終えたら消す）
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/type.css";
import "./styles/space.css";
import "./styles/motion.css";
import "./screens/DreamDerbyScreen.css";
import { GraduationScreen } from "./screens/GraduationScreen.jsx";
import { WAKE_LINES } from "./data/dreamDerbyCommentary.js";
import dreamSrc from "./screens/DreamDerbyScreen.jsx?raw";

const roomSvg = dreamSrc.slice(dreamSrc.indexOf("<svg viewBox=\"0 0 390 300\""), dreamSrc.indexOf("</svg>", dreamSrc.indexOf("<svg viewBox=\"0 0 390 300\"")) + 6);

function Room() {
  return (
    <div className="dream-derby-screen">
      <div className="dream-derby-screen__frame">
        <div className="race-top">
          <div className="room-scene active" dangerouslySetInnerHTML={{ __html: roomSvg }} />
        </div>
        <div className="race-bottom">
          <div className="wake-panel active">
            <div className="wake-lines">
              {WAKE_LINES.map((t, i) => (<p key={i} className="msg-line">{t}</p>))}
            </div>
            <button type="button" className="next-btn">卒業式へ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const which = new URLSearchParams(location.search).get("s") || "room";
createRoot(document.getElementById("root")).render(
  which === "room" ? <Room /> : (
    <GraduationScreen saveSeed={12345} startYear={1974} difficulty="normal" dreamChoiceIds={{}} onComplete={() => {}} />
  )
);
