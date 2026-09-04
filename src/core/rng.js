// C4の乱数実装（ARCHITECTURE.md §6「セーブとやり直し（C4）」・devlog/wave01.md §15-4）。
//
// ⭐乱数の目は「週 × 馬」などのキーから導出して固定する。同じキーで呼べば必ず同じ結果
// （＝リロードしても同じ馬に乗れば同じ結果。運はやり直せず、判断だけやり直せる）。
//
// ⚠️§15-4が挙げる3つの必須点への対応：
//   1. 種は「週」ではなく「週 × 馬」等の組み合わせから導出する
//      → `streamRandom` の `keyParts` に week・horseId等を渡す
//   2. 乱数ストリームを用途ごとに分ける（1本の列を順に消費すると、プレイヤーが違う
//      行動をした時点で消費順序がずれ、運まで変わる）
//      → 1本の列を「消費」する設計そのものを採らない。呼び出しごとに
//        (用途, キー) から独立したハッシュ種を作り直すので、他の呼び出しの有無や
//        順序が一切結果に影響しない（消費順序という概念自体が存在しない）
//   3. 週の種をセーブに含める
//      → セーブには `saveSeed`（キャリア開始時に1回だけ引く基底シード）だけを持てばよい。
//        週ごとの値は保存不要——`saveSeed`と`week`から毎回同じものを再導出できる

/** 文字列から32bit整数ハッシュを作る（FNV-1a）。 */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32：32bit整数シードから0以上1未満の乱数を生成する軽量PRNG。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand01() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 用途名の定数（タイプミスでストリームが混ざる事故を防ぐ）。
export const RNG_STREAMS = Object.freeze({
  FALL: "fall", // 落馬判定
  REVEAL: "reveal", // 能力の開示判定
  STAND_IN: "standIn", // 代打の空き（ARCHITECTURE.md §2「代打騎乗」で明示された別ストリーム）
  WEATHER: "weather", // 天候（週×競馬場）
  SIM: "sim", // レースsim
  RIVAL: "rival", // 他の騎手の動き（NPC騎手の依頼選択など）
  GENERATION: "generation", // 馬・厩舎・馬主・NPC騎手などエンティティの生成
  REQUESTS: "requests", // 週次の騎乗依頼一覧の生成
  PITCH: "pitch", // 自分から売り込む（成功判定）
});

/**
 * 用途ごとに独立した乱数生成器を作る。自己完結の純関数（同じ引数なら常に同じ生成器）。
 * @param {number|string} saveSeed - セーブに保存する基底シード（キャリア開始時に1回だけ決める）
 * @param {string} stream - `RNG_STREAMS` のいずれか
 * @param {...(string|number)} keyParts - 週・馬IDなど、結果を固定するキー
 * @returns {() => number} rand01 - 呼ぶたびに0以上1未満の乱数を返す関数
 */
export function streamRandom(saveSeed, stream, ...keyParts) {
  const key = `${saveSeed}:${stream}:${keyParts.join(":")}`;
  return mulberry32(fnv1a(key));
}

/** rand01からlistの要素を1つ選ぶ。 */
export function pick(rand01, list) {
  return list[Math.floor(rand01() * list.length) % list.length];
}

/** rand01から重み付きで1つ選ぶ。weights は {キー: 重み} の形。 */
export function weightedPick(rand01, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let x = rand01() * total;
  for (const [key, w] of entries) {
    x -= w;
    if (x <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** rand01から確率pで真を返す（p=0.008なら0.8%の確率）。 */
export function chance(rand01, p) {
  return rand01() < p;
}

/**
 * キャリア開始時に1回だけ発行する基底シード（セーブに保存する値そのもの）。
 * ⚠️セーブに保存するのはこの1個の値だけでよい——週ごと・馬ごとの乱数は
 * `streamRandom(saveSeed, stream, ...keyParts)`でその都度再導出できる。
 */
export function createSaveSeed() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}
