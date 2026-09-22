// 馬の生成・成長・クラス昇降（ARCHITECTURE.md §3「能力（9軸）」「⭐適応能力」
// 「馬の一生」「出走馬の決定（H）」「クラスの昇降（J）」）。
// 純ロジック（JSX無し。`data/`・`core/`だけに依存）。

import { streamRandom, RNG_STREAMS, pick, weightedPickFromValue } from "../core/rng.js";
import { CLASS_LADDER, classIndex, classDisplayName } from "../data/classes.js";
import { generateHorseName } from "../data/names.js";
import { pickGradeBellCurve } from "../data/grades.js";
import { generateSurfaceAptitude } from "../data/surfaceAptitude.js";
import { generateMudAptitude } from "../data/mudAptitude.js";
import {
  PROVISIONAL_FIRST_PRIZE_1974,
  TWO_YEAR_OLD_DEBUT_WEEK,
  MIXED_DISTANCE_SHARE,
} from "../data/raceProgram.js";
import { weekOfYear } from "../data/calendar.js";

// ⭐架空馬のスピードの上限（`devlog/wave04.md`§40・ユーザー決定「(2)b」）。史実の
// ダービー馬51頭は65〜92なので、この上限（理論上の最大に近い値で71〜72）なら
// 架空馬が史実馬を上回ることはない。一様乱数ではなく3回引いて平均する（釣鐘型）。
const FICTIONAL_SPEED_BASE = 6;
const FICTIONAL_SPEED_SPAN = 66;

// ⚠️この値はユーザーが実測を見て決める。仮の値（`devlog/wave11.md`§7・§10）。
// 確率STAMINA_PROGRAM_FITで「番組表の距離の分布から距離を引いてスタミナへ写す」新しい
// 引き方を使い、残りの確率で従来どおりの一様分布（0〜99）にする。1.0なら全馬が新しい
// 引き方、0.0なら従来どおり。⚠️`sim/stamina.js`の`optimalDistance`の式には触らない
// （ダービー馬51頭で較正済み）——ここで変えるのは架空馬のスタミナの引き方だけ。
// 史実馬のスタミナはウイポの値を直接読み込むので、この値を変えても影響しない。
export const STAMINA_PROGRAM_FIT = 1.0;

// `optimalDistance`（`sim/stamina.js`）の逆写像：
// optimalDistance = round((1100 + stamina/100×2000) / 100) × 100 なので
// stamina = (distance - 1100) / 20。
const STAMINA_DISTANCE_OFFSET = 1100;
const STAMINA_DISTANCE_SCALE = 20;
const STAMINA_JITTER_SPAN = 10; // ±5

function clampStamina(v) {
  return Math.max(0, Math.min(99, v));
}

export { GRADE_SCALE } from "../data/grades.js";

export const GENDERS = Object.freeze(["colt", "filly", "gelding"]); // 牡・牝・セン

// 画面表記（出馬表の馬柱など）。⚠️斤量（負担重量）は未実装——牡・セン57.0／牝55.0の
// 定量を仮に置く（`arch/race-program.md`に斤量そのものの規則は無い。着順の計算にも
// まだ使っていない表示専用の値）。
export const GENDER_LABEL = Object.freeze({ colt: "牡", filly: "牝", gelding: "セン" });
export const STANDARD_WEIGHT = Object.freeze({ colt: 57.0, filly: 55.0, gelding: 57.0 });

export const GROWTH_TYPES = Object.freeze([
  "early", // 早熟：2歳後半〜3歳前半にピーク
  "normal", // 標準
  "late", // 晩成：4歳後半以降にピーク
  "sustained", // 持続：ピークが長く続く
]);

// 血統の系統（適応能力の由来）。
export const BLOODLINE_FAMILIES = Object.freeze({
  JAPAN: "japan", // 日本型 → 瞬発
  EUROPE: "europe", // 欧州型 → 持久
  AMERICA: "america", // 米国型 → 消耗
});

const ADAPTABILITY_KEY_BY_FAMILY = Object.freeze({
  [BLOODLINE_FAMILIES.JAPAN]: "burst",
  [BLOODLINE_FAMILIES.EUROPE]: "endurance",
  [BLOODLINE_FAMILIES.AMERICA]: "attrition",
});

function createInitialAdaptability(bloodlineFamily) {
  const base = { burst: 0, endurance: 0, attrition: 0 };
  const dominant = ADAPTABILITY_KEY_BY_FAMILY[bloodlineFamily];
  if (dominant) base[dominant] = 1; // 血統の系統ぶんだけ初期値を持つ。残り2つは0からレースで育つ
  return base;
}

/**
 * 架空馬を1頭生成する。自己完結の純関数（saveSeedとkeyの組み合わせから決定的）。
 * @param {number|string} saveSeed
 * @param {string|number} key - 一意なキー（例: `${生成年}-${連番}`）
 * @param {{ ownerPrefix?: string, sireId?: string|null, damId?: string|null,
 *           bloodlineFamily?: string, bornYear?: number,
 *           stableId?: string|null, ownerId?: string|null }} [opts]
 */
export function generateHorse(saveSeed, key, opts = {}) {
  const rand01 = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "horse", key);
  const gender = pick(rand01, GENDERS);
  const growthType = pick(rand01, GROWTH_TYPES);
  const bloodlineFamily = opts.bloodlineFamily ?? pick(rand01, Object.values(BLOODLINE_FAMILIES));
  // スピードは釣鐘型（3回引いて平均）で、史実馬（65〜92）を上回らない上限にする
  // （上のFICTIONAL_SPEED_BASE/SPANの説明を参照）。⚠️スタミナはこの対象外——強さの軸
  // ではなく距離の位置を決める軸なので、上限を切ると長距離適性の架空馬が生まれなくなる
  // （`devlog/wave04.md`§40）。スタミナは後天的に伸びない軸でもある（§3「能力の成長」）。
  const speed = Math.round(FICTIONAL_SPEED_BASE + FICTIONAL_SPEED_SPAN * ((rand01() + rand01() + rand01()) / 3));

  // ⭐架空馬のスタミナ（＝得意距離）の引き方（`STAMINA_PROGRAM_FIT`・`devlog/wave11.md`§7・§10）。
  // ⚠️⚠️乱数はつまみの値によらず必ず3回消費する（①つまみ判定・②距離のくじ引き・
  // ③ゆらぎ）。一様側を選んだときも②の値をそのまま`Math.floor(x*100)`に使うことで、
  // つまみを動かしても他の能力（瞬発力・勝負根性など、この後に続く）が1つもズレない
  // ようにしている——3通りの比較を「スタミナ以外も違う別世界どうしの比較」にしないため。
  const staminaFitRoll = rand01(); // ①
  const staminaDistanceRoll = rand01(); // ②
  const staminaJitterRoll = rand01(); // ③
  const stamina =
    staminaFitRoll < STAMINA_PROGRAM_FIT
      ? clampStamina(
          Math.round(
            (Number(weightedPickFromValue(MIXED_DISTANCE_SHARE, staminaDistanceRoll)) -
              STAMINA_DISTANCE_OFFSET) /
              STAMINA_DISTANCE_SCALE +
              (staminaJitterRoll * STAMINA_JITTER_SPAN - STAMINA_JITTER_SPAN / 2),
          ),
        )
      : Math.floor(staminaDistanceRoll * 100); // 従来どおりの一様分布（②の値を流用）

  const abilities = {
    speed,
    stamina,
    sharpness: pickGradeBellCurve(rand01), // 瞬発力
    grit: pickGradeBellCurve(rand01), // 勝負根性
    flexibility: pickGradeBellCurve(rand01), // 柔軟性
    wisdom: pickGradeBellCurve(rand01), // 賢さ
    health: pickGradeBellCurve(rand01), // 健康
    power: pickGradeBellCurve(rand01), // パワー
    mentalStrength: pickGradeBellCurve(rand01), // 精神力
  };
  const name = opts.ownerPrefix
    ? generateHorseName(rand01, { ownerPrefix: opts.ownerPrefix })
    : generateHorseName(rand01);

  return {
    id: `horse-${key}`,
    name,
    gender,
    growthType,
    bloodlineFamily,
    sireId: opts.sireId ?? null,
    damId: opts.damId ?? null,
    bornYear: opts.bornYear ?? null,
    stableId: opts.stableId ?? null,
    ownerId: opts.ownerId ?? null,
    isHistorical: false,
    isRetired: false, // 引退したらtrue（年齢・成績・怪我。世代交代）
    classId: CLASS_LADDER[0], // 新馬からスタート
    abilities,
    // 芝・ダートの適性（`arch/horse.md`「⭐ 芝・ダートの適性」）。◎○△×を面ごとに持つ。
    // ⭐恒久ルール：時代に合わせない（血統は除く）——`generateSurfaceAptitude`だけで決まる。
    surfaceAptitude: generateSurfaceAptitude(rand01),
    // 道悪適性（重い馬場の得手不得手・`data/mudAptitude.js`）。⚠️芝ダ適性と違い、×でも
    // 出走は止めない——雨は選べないので、苦手な馬が重馬場に当たる事故そのものがゲームになる。
    mudAptitude: generateMudAptitude(rand01),
    // 通算成績（収得賞金の順位付け・引退判定に使う。`arch/horse.md`「引退」「出走馬の決定」）。
    // ⚠️`earnings`は収得賞金（円）。実際の獲得賞金（プレイヤーの手取り）とは別の数値。
    // `recentFinishes`は新しい順の直近戦績（着順・レース名・日付等の詳細つき。引退判定②
    // 「直近6走で1度も5着以内が無ければ引退」と、出馬表の馬柱の両方に使う）。
    // `gradedWins`は重賞の勝ち鞍数（引退規則④「重賞を1つでも勝った牡馬は種牡馬」の判定に使う。
    // `domain/npcGradedRace.js`が重賞を勝つたびに積む）。
    record: { starts: 0, wins: 0, seconds: 0, thirds: 0, earnings: 0, gradedWins: 0, recentFinishes: [] },
    // 馬ごとの主戦騎手（質問23＝(ウ)）。オープン以上に上がった時点で付く（`domain/
    // jockeyAssignment.js`）。条件戦の馬はnullのまま——厩舎の主戦をそのつど使う。
    primaryJockeyId: null,
    adaptability: createInitialAdaptability(bloodlineFamily),
    // ⭐**第10弾（2026-09-17）でローテーションを作り直した**（`devlog/wave10.md`）。
    // `lastRaceWeek`・`nextRaceIntervalWeeks`（前走からの週数で機械的に引く方式）は廃止し、
    // 目標のレースから逆算する`plan`に置き換えた。`domain/rotation.js`の`planNextTarget`が
    // 決め、`replanStaleHorses`が毎週立て直す。生成直後は`null`（次に呼ばれたときに立つ）。
    plan: null,
    // 能力の開示（§3「能力の開示（確率式）」）。2プールそれぞれの開示済み項目と
    // 連続で開かなかった回数を持つ。詳細は`domain/disclosure.js`。
    disclosure: {
      trainingRevealed: [],
      raceRevealed: [],
      trainingMissStreak: 0,
      raceMissStreak: 0,
    },
    // 落馬・怪我による離脱（§6「落馬・怪我」）。詳細は`domain/fall.js`。
    injury: { type: null, weeksRemaining: 0 },
  };
}

/** 馬を引退させる。純関数——引数を書き換えず新しいオブジェクトを返す。 */
export function retireHorse(horse) {
  return { ...horse, isRetired: true };
}

/**
 * 適応能力を育てる（§3「育つ経路：同じ傾向のレースに出る／判断カードで対応する作戦を選ぶ」）。
 * 純関数——引数のadaptabilityを書き換えず、新しいオブジェクトを返す。
 * @param {{burst:number,endurance:number,attrition:number}} adaptability
 * @param {"burst"|"endurance"|"attrition"} raceTrendKey - そのレースの傾向
 * @param {number} amount - 育つ量（実装の弾で確定する速さ。ARCHITECTURE.md §15）
 */
export function growAdaptability(adaptability, raceTrendKey, amount) {
  return { ...adaptability, [raceTrendKey]: adaptability[raceTrendKey] + amount };
}

// オープン以上（リステッド・G3・G2・G1）は勝利数だけで上がらない
//（⚠️出走条件は未定・ARCHITECTURE.md §15「オープン以上の出走条件」）。
// ⚠️2026-09-04にクラスを10段へ広げた際に確認：`open`の直後に`listed`を挿し込んだので
// `open`の序列上の位置（インデックス）は変わらず、この定数を変更する必要はない。
// `listed`は`g3`/`g2`/`g1`と同じく「勝利数の自動昇級では到達しない」側に留まる
// ——これは新しい制約ではなく、g3以上が既に持っていた制約に`listed`が合流しただけ。
// 到達の条件（任される線・§6）は第4弾（`TODO.md` #24）で設計する。
const WIN_PROMOTION_CAP = "open";

/**
 * 勝利数で1段上がる。降級なし（J）。オープンで頭打ちにする。
 * ⚠️新馬（shinba）を勝つと未勝利（maiden）を飛ばして1勝クラスへ進む（史実どおり——
 * 新馬戦の勝ち馬は未勝利戦を経由しない）。2026-09-04にクラス昇降を`weekResults.js`へ
 * 繋ぐ際に見つけて直した：`CLASS_LADDER`の並び上、機械的な+1段では新馬の勝ちが
 * 未勝利へ進んでしまっていた。
 */
export function classAfterWin(currentClassId) {
  const capIdx = classIndex(WIN_PROMOTION_CAP);
  if (currentClassId === "shinba") {
    const win1Idx = classIndex("win1");
    return win1Idx <= capIdx ? "win1" : currentClassId;
  }
  const idx = classIndex(currentClassId);
  if (idx < 0 || idx >= capIdx) return currentClassId;
  return CLASS_LADDER[idx + 1];
}

/** 新馬戦を勝てずに終えると未勝利へ移る（勝てば`classAfterWin`で1勝クラスへ）。 */
export function classAfterDebutLoss(currentClassId) {
  return currentClassId === "shinba" ? "maiden" : currentClassId;
}

/** レース結果からクラスの昇降先を1つで決める。純関数。 */
export function nextClassAfterRace(currentClassId, won) {
  return won ? classAfterWin(currentClassId) : classAfterDebutLoss(currentClassId);
}

// 着順ごとの賞金配分（1着を1とした比率）。⚠️仮（JRAの本賞金配分の目安を簡略化した値。
// `PROVISIONAL_FIRST_PRIZE_1974`自体も収得賞金の順番付けにしか使わない仮の額——
// `arch/race-program.md`§8）。
const PLACE_PRIZE_SHARE = Object.freeze([1, 0.4, 0.25]);

// 引退判定②で見る直近走数（`arch/horse.md`「②成績：直近6走で1度も5着以内が無ければ引退」）。
export const RECENT_FINISHES_WINDOW = 6;

/** 着順から賞金配分比を引く（1着を1とした比率）。プレイヤー・NPC・重賞のどの経路でも使う。 */
export function placePrizeShare(position) {
  return PLACE_PRIZE_SHARE[position - 1] ?? 0;
}

/** 一般競走（新馬〜3勝クラス）のクラス・着順で得られる収得賞金（円）。 */
export function earningsForResult(classId, position) {
  const prizeBase = PROVISIONAL_FIRST_PRIZE_1974[classId] ?? 0;
  return prizeBase * placePrizeShare(position);
}

/**
 * レース結果を通算成績へ積む、最も基本の形。純関数——新しいrecordを返す。
 * `appendRaceResult`（一般競走用）・`domain/npcGradedRace.js`（重賞用・実際の`prize1`を渡す）の
 * 両方がこれを共通で呼ぶ。
 * ⚠️`recentFinishes`は「直近◯走」の詳細を持つ——**生涯の全レースではない**（質問16は生涯の
 * 全レースを持つ決定だが、5,250頭超が常時それを保持するとメモリを圧迫するため、実装では
 * 直近`RECENT_FINISHES_WINDOW`走だけを持つ形にした。生涯の全レースはセーブ層
 * （IndexedDB・未実装）で追記型に持たせる想定——`TODO.md`へ棚上げ）。
 * @param {{starts:number,wins:number,seconds:number,thirds:number,earnings:number,
 *          gradedWins:number,recentFinishes:object[]}} record
 * @param {{ position: number, fieldSize?: number, popularity?: number|null,
 *           raceName?: string, week?: number, year?: number, courseId?: string|null,
 *           surface?: string|null, distance?: number|null, distanceBand?: string|null,
 *           condition?: string|null }} historyEntry - `position`（着順・1始まり）は必須、
 *   他は出馬表の馬柱に出す表示用の詳細（分かる範囲でよい）
 * @param {number} earningsGain - このレースで得た収得賞金（円）
 * @param {boolean} [isGraded] - 重賞（g1/g2/g3）を勝った場合に`gradedWins`を積む
 */
export function appendRaceResultWithEarnings(record, historyEntry, earningsGain, isGraded = false) {
  const { position } = historyEntry;
  const won = position === 1;
  return {
    starts: record.starts + 1,
    wins: record.wins + (won ? 1 : 0),
    seconds: record.seconds + (position === 2 ? 1 : 0),
    thirds: record.thirds + (position === 3 ? 1 : 0),
    earnings: record.earnings + earningsGain,
    gradedWins: (record.gradedWins ?? 0) + (won && isGraded ? 1 : 0),
    recentFinishes: [historyEntry, ...(record.recentFinishes ?? [])].slice(0, RECENT_FINISHES_WINDOW),
  };
}

/**
 * 一般競走（新馬〜3勝クラス）用のレース結果の積み方。
 * @param {string} classId - レース時点のクラス（賞金額の参照に使う。馬柱の「レース名」にも使う）
 * @param {object} historyEntry - `position`必須。`raceName`を省略すると`classId`の表記で埋める
 */
export function appendRaceResult(record, classId, historyEntry) {
  const entry = { raceName: classDisplayName(classId), ...historyEntry };
  return appendRaceResultWithEarnings(record, entry, earningsForResult(classId, entry.position), false);
}

// ⚠️**ローテーションの間隔を機械的に引く旧方式（`pickRotationIntervalWeeks`・
// `isDueForNextRace`・`ROTATION_INTERVAL_MIN/MAX_WEEKS`）は第10弾で撤去した**
// （2026-09-17・`devlog/wave10.md`）。目標のレースから逆算する`domain/rotation.js`の
// `planNextTarget`・`isPlanStale`・`replanStaleHorses`に置き換わった。

/**
 * 2歳馬は第`TWO_YEAR_OLD_DEBUT_WEEK`週より前は出走候補にしない
 * （`arch/race-program.md`§10「2歳戦解禁」の判定・通しプレイ①の指摘の解消）。
 * ⚠️生年（`horse.bornYear`）が無い馬は年齢が分からないので通す——事前シミュレーション
 * （設計③・未実装）が全馬に生年を付けるまでの間の暫定。
 */
export function canDebutThisWeek(horse, week, year) {
  if (horse.bornYear == null) return true;
  const age = year - horse.bornYear;
  if (age < 2) return false; // 0歳・1歳はまだ出走できない
  if (age > 2) return true;
  return weekOfYear(week) >= TWO_YEAR_OLD_DEBUT_WEEK;
}

/**
 * 前走（直近の出走）から何週空いたか。⭐第11弾・案B-2（`devlog/wave11.md`§7）：
 * `domain/npcWeeklyRace.js`の出走選抜と`domain/rotation.js`の計画のまとめ配り、
 * 両方がこれで並べる。⚠️**1度も走っていない馬は`Infinity`**（一番の優先）——
 * そうしないと「走らないと実績が付かない・実績が無いと走れない」の輪から一生出られない
 * （`devlog/wave10.md`§17・`devlog/wave11.md`§7の主因）。
 * @param {object} horse
 * @param {number} week - 絶対週（「今週」）
 * @returns {number}
 */
export function weeksSinceLastRace(horse, week) {
  if (horse.record.starts === 0 || !horse.record.recentFinishes?.length) return Infinity;
  const lastWeek = horse.record.recentFinishes[0].week;
  return lastWeek == null ? Infinity : week - lastWeek;
}
