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
 * ⚠️⚠️**両方×にはしない**（2026-09-17に発見・`devlog/wave09.md`§16）。`canRaceOnSurface`は
 * 芝もダートも×だとどちらもfalseを返すため、その馬はどのレースにも出走できず一生を終える
 * （確率計算：×の段になる確率0.125の2乗＝1.56%・実測139頭）。**得意なほう
 * （`dominantLevel`）だけを×(0)→△(1)へ底上げする**——苦手なほうは×のままでよい
 * （出走できる面が1つあれば十分なため）。両方が×の乱数を引いたときだけ発動するので、
 * 発動率は上と同じ約1.56%。
 * @param {() => number} rand01
 * @returns {{ turf: string, dirt: string }}
 */
export function generateSurfaceAptitude(rand01) {
  const dominantIsTurf = rand01() < 0.502;
  const levelA = pickBellLevel(rand01);
  const levelB = pickBellLevel(rand01);
  const dominantLevelRaw = Math.max(levelA, levelB);
  const dominantLevel = dominantLevelRaw === 0 ? 1 : dominantLevelRaw; // ×(0)は△(1)へ底上げ
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

/** その馬場を得意としているか（◎か○）。△は「出られるが向いていない」。 */
export function isSuitedToSurface(surfaceAptitude, surface) {
  const level = surfaceAptitude?.[surface];
  return level === "◎" || level === "○";
}

/**
 * ⭐その馬場に向いた馬を先に、足りなければ△の馬で埋める。
 * ⚠️**これが無いと、芝が苦手な馬が毎週そのまま芝のレースに出てくる。**
 * 2026-09-16にウイポの実測（`design/winning-post-surface-aptitude.md`）へ係数を
 * 合わせたところ、△の馬は12頭立てで平均8〜10着まで落ちるようになった。その状態で
 * 出走馬の4割強が△のままだと、勝ち上がる馬が「能力の高い馬」ではなく「馬場が
 * 合っていた馬」になり、クラスが能力を分けなくなる（実測：重賞の出走馬の能力平均が
 * 0.5181→0.4954まで下がり、未勝利の0.4784とほとんど差が無くなった）。
 * ⭐実際の競馬でも、陣営は芝が苦手な馬を芝には使わない。
 * @param {object[]} horses - 既に希望の順（収得賞金の多い順など）に並んでいること
 * @param {string} surface - "turf" | "dirt"
 * @param {number} needed - 欲しい頭数
 * @returns {object[]} 並び順を保ったまま、向いた馬を前に寄せた一覧
 */
export function preferSuitedRunners(horses, surface, needed) {
  const suited = horses.filter((h) => isSuitedToSurface(h.surfaceAptitude, surface));
  if (suited.length >= needed) return suited;
  const rest = horses.filter((h) => !isSuitedToSurface(h.surfaceAptitude, surface));
  return [...suited, ...rest];
}

/**
 * 芝ダ適性の係数。脚の総量（`sim/stamina.js`の`staminaCapacity`）に、距離適性と同じ場所で
 * 掛ける（2026-09-16のユーザー決定・`devlog/wave08.md`§2）。
 * ⭐**2026-09-16にウイニングポストの実測へ合わせた**（`design/winning-post-surface-aptitude.md`・
 * ユーザーが出典を提示）。合わせ方は`tools/measure-aptitude-vs-speed.mjs`——能力がまったく
 * 同じ16頭（◎○△×を4頭ずつ）に芝2000mを走らせ、適性ごとの平均着順を出典と突き合わせる。
 *
 * | 適性 | このsim | 出典（ウイポ） |
 * |---|---|---|
 * | ◎ | 3.43着 | 3.6着 |
 * | ○ | 5.86着 | 6.0着 |
 * | △ | 11.32着 | 11.1着 |
 * | × | 13.40着 | 13.3着 |
 *
 * ⚠️**◎○△×は等間隔ではない。○と△の間だけが他の2つの約2倍開く**（出典の実測。
 * このsimでも◎○2.43着・○△5.46着・△×2.08着）。⚠️係数を触ったら必ず上のツールで測り直す。
 * ⚠️2026-09-16の午前は◎1.00／○0.94／△0.86で、同じ測り方だと◎6.94着・○7.29着・△8.30着
 * ＝適性がほとんど効いていなかった（`devlog/wave08.md`§8）。
 * ×は出走しない（`canRaceOnSurface`が止める）ので、万一渡された場合の保険の値。
 */
export const SURFACE_FACTOR = Object.freeze({ "◎": 1.0, "○": 0.50, "△": 0.27, "×": 0.21 });

/**
 * その馬・その馬場の係数を引く。
 * @param {{turf: string, dirt: string}} surfaceAptitude
 * @param {string} surface - "turf" | "dirt"
 */
export function surfaceFactorFor(surfaceAptitude, surface) {
  return SURFACE_FACTOR[surfaceAptitude?.[surface]] ?? 1; // 未設定は割引なし
}
