// 画面遷移の秒数を`styles/motion.css`のCSSカスタムプロパティから読む小さなユーティリティ。
// ⚠️生の秒数をJS側に複製しない（CLAUDE.md §8）。motion.cssの値を変えれば、
// このファイル経由でapp.jsx/GraduationScreen.jsxのスケジューリングも自動的に追従する。
// `prefers-reduced-motion: reduce`が有効な端末ではmotion.css側の変数が0msへ
// 上書きされるので、ここも素直に0msを返す（動きに弱い人への配慮）。

/**
 * CSSカスタムプロパティ（例："--m1-cover-in-dur"）の値をミリ秒で返す。
 * @param {string} varName - `:root`に定義されたカスタムプロパティ名
 * @param {number} [fallbackMs] - 値が読めなかった場合のフォールバック
 */
export function cssMs(varName, fallbackMs = 0) {
  if (typeof document === "undefined") return fallbackMs;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return fallbackMs;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fallbackMs;
  return raw.endsWith("ms") ? n : n * 1000;
}

/** setTimeoutを予約し、effectのクリーンアップとして使えるクリア関数を返す。 */
export function scheduleOnce(fn, ms) {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
}

/**
 * 「要素をまず見えない位置/透明度でマウントし、次のペイント後に本来の値へ
 * 遷移させる」ための2段rAF。フレッシュマウント直後にクラスを変えても
 * transitionは発火しない（前の状態が無いため）ので、1フレーム分の実際の
 * 描画を挟んでからクラスを切り替える。
 * @param {() => void} onReady - 2段rAF後に呼ぶ（ここで遷移先クラスへ切り替える）
 * @returns {() => void} cleanup
 */
export function afterNextPaint(onReady) {
  let raf2;
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(onReady);
  });
  return () => {
    cancelAnimationFrame(raf1);
    if (raf2 != null) cancelAnimationFrame(raf2);
  };
}
