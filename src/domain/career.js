// 新しいキャリアの初期ロースター生成（ARCHITECTURE.md §3「馬の供給」・§6「調教師」
// 「NPC騎手」）。厩舎・馬主・馬・NPC騎手を実数規模で生成し、所属関係を結ぶ。
// 純ロジック（JSX無し。`domain/`内の各生成関数を組み合わせる合成レイヤー）。

import { streamRandom, RNG_STREAMS } from "../core/rng.js";
import { generateStable } from "./stable.js";
import { generateOwner, isMajorOwner } from "./owner.js";
import { generateHorse, ROTATION_INTERVAL_MAX_WEEKS } from "./horse.js";
import { generateJockey } from "./jockey.js";

// JRAの実数（ARCHITECTURE.md §3「馬の供給」・§6「調教師」「NPC騎手」）。
// ⚠️⚠️**2026-09-17にユーザーが決定**：190厩舎×40頭は現代のJRAの規模で、1976年の
// レース供給（年2,860本・1976年の実測）に対して現役馬が多すぎた（`devlog/wave10.md`§2）。
// **150厩舎×35頭＝5,250頭**へ縮小する（5,250頭×年6.3走＝33,075出走／収容力31,517出走で
// 超過5%・許容範囲）。
export const STABLE_COUNT = 150;
export const OWNER_COUNT = 100;
export const HORSE_COUNT = 5250; // 150厩舎 × 平均35頭
// ⚠️NPC_JOCKEY_COUNTは`devlog/wave10.md`§2で「未定」としていたが、厩舎数と同じ比率
// （160/190）で比例縮小した（150×160/190≈126.3→126）。根拠：厩舎数が減ればその厩舎に
// 出入りする騎手の需要も比例して減ると見込んだだけで、実測に基づく値ではない。
export const NPC_JOCKEY_COUNT = 126;

/**
 * 新しいキャリアの初期ロースターを作る。自己完結の純関数
 * （同じsaveSeedなら常に同じロースターになる）。
 * @param {number|string} saveSeed
 * @returns {{ stables: object[], owners: object[], horses: object[], npcJockeys: object[] }}
 */
export function createInitialRoster(saveSeed) {
  // 人名の重複回避（2026-09-04）：厩舎・馬主・NPC騎手はそれぞれ別集合で使用済み名を
  // 追跡する（種類をまたいだ重複—例えば調教師と馬主が同姓同名—までは避けない）。
  const usedTrainerNames = new Set();
  const usedOwnerNames = new Set();
  const usedJockeyNames = new Set();

  const stables = Array.from({ length: STABLE_COUNT }, (_, i) =>
    generateStable(saveSeed, i, { usedNames: usedTrainerNames })
  );

  // 馬主の持ち馬数に偏りを持たせる（§3「馬主を実数の1/20に減らした」＝実態より大口になる設計）。
  // 重みをrand01^2で歪ませ、少数の馬主に多くの馬が集まるようにする。
  const weightRand = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "owner-weights");
  const ownerWeights = Array.from({ length: OWNER_COUNT }, () => weightRand() ** 2 + 0.01);
  const totalWeight = ownerWeights.reduce((sum, w) => sum + w, 0);

  function pickOwnerIndex(r) {
    let x = r * totalWeight;
    for (let i = 0; i < ownerWeights.length; i += 1) {
      x -= ownerWeights[i];
      if (x <= 0) return i;
    }
    return ownerWeights.length - 1;
  }

  // 馬ごとに所属厩舎（round-robinで均等＝190×40=7,600がちょうど埋まる）と
  // 馬主（重み付き乱数）を先に決める。決めてから馬を生成するのは、大口馬主の
  // 冠名を名前生成に渡す必要があるため（§3「馬の名前」）。
  const ownerAssignRand = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "horse-owner-assign");
  const stableIdxByHorse = [];
  const ownerIdxByHorse = [];
  const ownerHorseCounts = new Array(OWNER_COUNT).fill(0);
  for (let i = 0; i < HORSE_COUNT; i += 1) {
    const stableIdx = i % STABLE_COUNT;
    const ownerIdx = pickOwnerIndex(ownerAssignRand());
    stableIdxByHorse.push(stableIdx);
    ownerIdxByHorse.push(ownerIdx);
    ownerHorseCounts[ownerIdx] += 1;
  }

  // 大口／小口の閾値は平均持ち馬数を使う（固定の暫定値5だと、この規模の分布では
  // ほぼ全員が閾値を超えてしまい「全馬主に冠名」と同じ単調さになる。実測で確認）。
  const averageHorsesPerOwner = HORSE_COUNT / OWNER_COUNT;
  const owners = Array.from({ length: OWNER_COUNT }, (_, i) =>
    generateOwner(saveSeed, i, {
      isMajor: isMajorOwner(ownerHorseCounts[i], averageHorsesPerOwner),
      usedNames: usedOwnerNames,
    })
  );

  // ⚠️`lastRaceWeek`を全頭nullのままにすると、キャリア開始の第1週に全馬が一斉に
  // 出走候補になってしまう（`domain/weeklyRequests.js`で実測して判明）。
  // 30年続く世界には元々「出走してからの経過週」がばらけた馬がいるはずなので、
  // 開始時点で`-0`〜`-(ROTATION_INTERVAL_MAX_WEEKS-1)`週の範囲に均等に散らしておく。
  const lastRaceWeekRand = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "horse-stagger");
  const horses = Array.from({ length: HORSE_COUNT }, (_, i) => {
    const stable = stables[stableIdxByHorse[i]];
    const owner = owners[ownerIdxByHorse[i]];
    const staggerOffset = Math.floor(lastRaceWeekRand() * ROTATION_INTERVAL_MAX_WEEKS);
    return generateHorse(saveSeed, i, {
      stableId: stable.id,
      ownerId: owner.id,
      ownerPrefix: owner.ownerPrefix ?? undefined,
      lastRaceWeek: 1 - ROTATION_INTERVAL_MAX_WEEKS + staggerOffset,
    });
  });

  // 所属関係（horseIds）を埋める。
  const stableById = new Map(stables.map((s) => [s.id, { ...s, horseIds: [] }]));
  const ownerById = new Map(owners.map((o) => [o.id, { ...o, horseIds: [] }]));
  for (const horse of horses) {
    stableById.get(horse.stableId).horseIds.push(horse.id);
    ownerById.get(horse.ownerId).horseIds.push(horse.id);
  }

  // NPC騎手は各厩舎に1人ずつ紐付ける仮の割り当て（⚠️実際の所属決定はより複雑になりうる。
  // §6「所属厩舎の決まり方」参照。ここでは週の進行を動かすための最小限）。
  const npcJockeys = Array.from({ length: NPC_JOCKEY_COUNT }, (_, i) =>
    generateJockey(saveSeed, `npc-${i}`, {
      stableId: stables[i % STABLE_COUNT].id,
      usedNames: usedJockeyNames,
    })
  );

  return {
    stables: [...stableById.values()],
    owners: [...ownerById.values()],
    horses,
    npcJockeys,
    // プレイヤーの騎手名がNPC騎手と重ならないよう、卒業式で`createPlayer`に渡す
    // （2026-09-04）。
    usedJockeyNames,
  };
}
