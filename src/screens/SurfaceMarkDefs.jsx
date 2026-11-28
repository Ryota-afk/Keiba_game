// 芝・ダートの相性4段（◎○△×）の線画。同じ20px枠・同じ2pxの線で描く（フォントの字形だと○が△より小さく見える）。
// 週の画面と馬の詳しい画面が、画面の先頭に1回置いて`<use href="#wk-m1">`で引く（idは`view/weekOffersView.js`の`SURFACE_MARK_ID`）。

import React from "react";

export function SurfaceMarkDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="wk-m2" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      </symbol>
      <symbol id="wk-m1" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </symbol>
      <symbol id="wk-m3" viewBox="0 0 20 20">
        <path d="M10 2.5 L18.5 17.5 L1.5 17.5 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </symbol>
      <symbol id="wk-mx" viewBox="0 0 20 20">
        <path d="M3 3 L17 17 M17 3 L3 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </symbol>
    </svg>
  );
}
