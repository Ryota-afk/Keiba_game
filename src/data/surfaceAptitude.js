// 芝・ダートの適性（`arch/horse.md`「⭐ 芝・ダートの適性」・質問12＝(イ)／質問13＝(A)）。
// ウイポに合わせた◎＞○＞△＞×の4段階を芝・ダート別々に持つ。
// 純データ＋純関数のみ（JSX無し）。

export const SURFACE_APTITUDE_SCALE = Object.freeze(["×", "△", "○", "◎"]);

/** ◎○△×を0(×)〜3(◎)の数値に変換する。比較・計算に使う。 */
export function surfaceAptitudeIndex(level) {
  const idx = SURFACE_APTITUDE_SCALE.indexOf(level);
  return idx < 0 ? 0 : idx;
}

// 一様乱数を2回引いて平均する（釣鐘型）。`data/grades.js`の`avg3`と同じ考え方だが
// 段数が4つしか無いため2回で足りる。
function avg2(rand01) {
  return (rand01() + rand01()) / 2;
}

function pickBellLevel(rand01) {
  return Math.min(
    SURFACE_APTITUDE_SCALE.length - 1,
    Math.floor(SURFACE_APTITUDE_SCALE.length * avg2(rand01))
  );
}

/**
 * 芝適性・ダート適性を1組生成する。⭐**恒久ルール：架空馬の適性は時代に合わせない**
 * （`arch/horse.md`）——史実の主流だった馬場・距離を考慮せず、この関数だけで決まる。
 *
 * 「芝得意とダート得意をほぼ半々」（番組表の芝50.2%・ダート49.8%）を満たすため、
 * 先にどちらを得意側にするかを50.2/49.8で引き、その面の段が必ずもう一方以上になる
 * ように振り分ける（互角＝両方おなじ段のときはそのまま）。
 * @param {() => number} rand01
 * @returns {{ turf: string, dirt: string }}
 */
export function generateSurfaceAptitude(rand01) {
  const dominantIsTurf = rand01() < 0.502;
  const levelA = pickBellLevel(rand01);
  const levelB = pickBellLevel(rand01);
  const dominantLevel = Math.max(levelA, levelB);
  const otherLevel = Math.min(levelA, levelB);
  const turfLevel = dominantIsTurf ? dominantLevel : otherLevel;
  const dirtLevel = dominantIsTurf ? otherLevel : dominantLevel;
  return {
    turf: SURFACE_APTITUDE_SCALE[turfLevel],
    dirt: SURFACE_APTITUDE_SCALE[dirtLevel],
  };
}

/** その馬場に出してよいか（×の馬場には出さない。`arch/horse.md`「×の扱い」）。 */
export function canRaceOnSurface(surfaceAptitude, surface) {
  return surfaceAptitude[surface] !== "×";
}

/**
 * 芝ダ適性の係数。脚の総量（`sim/stamina.js`の`staminaCapacity`）に、距離適性と同じ場所で
 * 掛ける（2026-09-16のユーザー決定・`devlog/wave08.md`§2）。
 * ⚠️**数値に根拠は無い（仮値）。** ○と△の1着率の差を実測して直す。
 * ×は出走しない（`canRaceOnSurface`が止める）ので、万一渡された場合の保険の値。
 */
export const SURFACE_FACTOR = Object.freeze({ "◎": 1.0, "○": 0.94, "△": 0.86, "×": 0.7 });

/**
 * その馬・その馬場の係数を引く。
 * @param {{turf: string, dirt: string}} surfaceAptitude
 * @param {string} surface - "turf" | "dirt"
 */
export function surfaceFactorFor(surfaceAptitude, surface) {
  return SURFACE_FACTOR[surfaceAptitude?.[surface]] ?? 1; // 未設定は割引なし
}
