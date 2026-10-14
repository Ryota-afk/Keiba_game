// 道悪適性（重い馬場の得手不得手）。2026-09-16にユーザーが「馬に道悪適性を足して効かせる」を
// 選んで決まった（`devlog/wave08.md`§2）。⭐これで`arch/race-sim.md`の「重馬場ならこの馬、と
// 選べる」が成立する——金曜の予報を見て、道悪の得意な馬の鞍を選ぶ判断が生まれる。
//
// ⚠️**芝ダ適性（`surfaceAptitude.js`）とは×の意味が違う。** 芝ダの×は「その馬場に出さない」
// （出走そのものを止める）。道悪の×は**出走は止めない**——雨は選べないので、苦手な馬が
// 重馬場に当たってしまう事故そのものがゲームになる。×は割引が一番大きいだけ。
//
// 純データ＋純関数のみ（JSX無し）。

export const MUD_APTITUDE_SCALE = Object.freeze(["×", "△", "○", "◎"]);

/**
 * 馬場状態×道悪適性の係数。脚の総量（`sim/stamina.js`の`staminaCapacity`）に掛ける
 * ——距離適性・芝ダ適性と同じ場所（2026-09-16のユーザー決定）。
 * ⚠️**数値に根拠は無い（仮値）。** 重馬場での◎と×の1着率の差を実測して直す
 * （`devlog/wave08.md`の計測）。良馬場は全馬1.00＝道悪適性が一切効かない。
 */
export const MUD_FACTOR = Object.freeze({
  good: Object.freeze({ "◎": 1.0, "○": 1.0, "△": 1.0, "×": 1.0 }),
  yielding: Object.freeze({ "◎": 1.0, "○": 0.99, "△": 0.97, "×": 0.95 }),
  soft: Object.freeze({ "◎": 1.0, "○": 0.98, "△": 0.95, "×": 0.91 }),
  heavy: Object.freeze({ "◎": 1.0, "○": 0.97, "△": 0.93, "×": 0.87 }),
});

/** 一様乱数を2回引いて平均する（釣鐘型）。`surfaceAptitude.js`の`avg2`と同じ考え方。 */
function avg2(rand01) {
  return (rand01() + rand01()) / 2;
}

/**
 * 道悪適性を1つ生成する。釣鐘型（実質 ×12.5%・△37.5%・○37.5%・◎12.5%）。
 * ⚠️割合に根拠は無い——「道悪巧者は少数」という実際の競馬の感覚に合わせた仮の形。
 * @param {() => number} rand01
 * @returns {string} ◎○△× のいずれか
 */
export function generateMudAptitude(rand01) {
  const level = Math.min(
    MUD_APTITUDE_SCALE.length - 1,
    Math.floor(MUD_APTITUDE_SCALE.length * avg2(rand01))
  );
  return MUD_APTITUDE_SCALE[level];
}

/**
 * その馬・その馬場状態の係数を引く。
 * @param {string} mudAptitude - ◎○△×。未設定（史実馬など）は割引なし（1.0）
 * @param {string} condition - good|yielding|soft|heavy
 * @returns {number}
 */
export function mudFactorFor(mudAptitude, condition) {
  const table = MUD_FACTOR[condition] ?? MUD_FACTOR.good;
  return table[mudAptitude] ?? 1; // 未設定は割引なし
}
