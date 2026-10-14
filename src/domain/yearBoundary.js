// 年の区切りの処理（穴4・`devlog/wave07.md`「穴4（年の区切りの処理順）」）。
// 第52週の週末の結果処理が終わった直後、第1週の月曜の前に呼ぶ想定。
// 純ロジック（JSX無し。`domain/`の他ファイルを組み合わせる合成レイヤー）。
//
// 8ステップのうち、このファイルが実装するのは①②③④（馬に関する処理）だけ：
// ⚠️**⑤調教師の引退と開業・⑥騎手の引退と新人は未実装**——`ARCHITECTURE.md`が要求する
// 「史実の調教師・騎手の開業年／引退年」データがまだ取得できていない（`arch/horse.md`
// 「データ源」の表で「史実の馬主・調教師｜未取得」）。実データが無いまま数を動かすと
// 実測に基づかない churn を作ってしまうため、今回は現状の厩舎・NPC騎手をそのまま維持する。
// ⚠️**⑦主戦の付け直しは`domain/jockeyAssignment.js`（質問23＝(ウ)）が別途担当**。
// ⚠️**⑧既存の年次処理（難易度変更・引退勧告・ランク判定）はプレイヤー側の既存の仕組みで、
// 本筋2（馬・レース）のスコープ外**——ここでは呼ばない。
//
// ⭐呼び出し元は2つ：開始前の事前シミュレーション（`domain/bootstrap.js`・プレイヤー無し）と、
// 本編の年の最終週（`domain/weekLoop.js`の`advanceWeek`・2026-10-12・`TODO.md` #122）。
// 本編ではプレイヤーが乗った馬を名簿に残す③の例外が初めて働く。

import { shouldRetire, selectBreedingHorses } from "./retirement.js";
import { generateHorse } from "./horse.js";
import { createUsedHorseNames } from "./horseNames.js";
import { streamRandom, RNG_STREAMS, pick } from "../core/rng.js";

// 新しい馬が名簿に入る年の馬齢（2歳。馬齢は`年 - 生年`）。
const NEW_FOAL_AGE_AT_ARRIVAL = 2;

/**
 * 年の区切りを1つ処理する。自己完結の純関数。
 * @param {number|string} saveSeed
 * @param {number} newYear - これから始まる年（例：1975年始まりの処理なら1975）
 * @param {{ horses: object[], breedingPool?: { sires: object[], broodmares: object[] } }} roster
 * @param {object} player - `mainMounts`からプレイヤーが乗った馬を判定する
 * @param {{ orphanFoals?: boolean }} [options] - `orphanFoals`＝繁殖プールに父か母が居なくても
 *   新馬を補充する（本編用。既定は偽＝事前シミュレーションの従来の挙動）
 * @returns {{ roster: object, retiredHorseIds: string[], stats: { retired: number, discarded: number,
 *             keptRetired: number, newSires: number, newBroodmares: number, newFoals: number } }}
 *   `retiredHorseIds`＝この区切りで引退を処理した馬（繁殖入り・捨てた・残した、全部）のid
 */
export function processYearBoundary(saveSeed, newYear, roster, player, options = {}) {
  const previousYear = newYear - 1;
  const riddenByPlayer = new Set(Object.keys(player.mainMounts ?? {}));

  // ①引退判定
  const retiring = [];
  const staying = [];
  const carried = [];
  for (const horse of roster.horses) {
    if (horse.retiredYear != null) {
      // 前の年の区切りで「プレイヤーが乗った」ために残した引退馬。もう処理済みなので
      // 毎年引退の数に数え直さず、繁殖入りの候補にも入れ直さない（そのまま名簿に残す）。
      carried.push(horse);
    } else if (!horse.isRetired && shouldRetire(horse, previousYear)) {
      retiring.push({ ...horse, isRetired: true });
    } else if (horse.isRetired) {
      retiring.push(horse); // 既に引退済み（骨折等で年内に引退した馬）もここで一緒に処理する
    } else {
      staying.push(horse);
    }
  }

  // ②繁殖入り（史実馬は対象外——史実馬の繁殖入りは史実の血統表に従うべきで、
  // ゲーム内の収得賞金順の抽選では決めない）。
  const fictionalRetiring = retiring.filter((h) => !h.isHistorical);
  const { sireIds, broodmareIds } = selectBreedingHorses(fictionalRetiring);
  const sireIdSet = new Set(sireIds);
  const broodmareIdSet = new Set(broodmareIds);
  const newSires = fictionalRetiring.filter((h) => sireIdSet.has(h.id));
  const newBroodmares = fictionalRetiring.filter((h) => broodmareIdSet.has(h.id));

  // ③捨てる：引退して繁殖に上がらなかった馬は名簿から外す。⚠️プレイヤーが乗った馬は残す
  // （`arch/horse.md`「保存の規則」）。
  // 残す馬には`retiredYear`（引退を処理した年）を付け、次の年の区切りで二重に処理しない目印にする。
  const keptRetired = retiring
    .filter((h) => !sireIdSet.has(h.id) && !broodmareIdSet.has(h.id) && riddenByPlayer.has(h.id))
    .map((h) => ({ ...h, retiredYear: previousYear }));
  const discardedCount = retiring.length - newSires.length - newBroodmares.length - keptRetired.length;
  // 現役名簿（`horses`配列）から抜ける頭数＝捨てた馬＋繁殖入りした馬（種牡馬・繁殖牝馬も
  // 現役の名簿からは抜けるため、補充の対象に含める。`keptRetired`は名簿に残るので除く）。
  // ⚠️2026-09-15：最初の実装ではdiscardedCountだけを補充していたため、繁殖入りした頭数の
  // ぶん現役頭数が毎年純減し続けるバグがあった（実測：3年で7,600→7,323）。
  const departedCount = discardedCount + newSires.length + newBroodmares.length;

  const breedingPool = {
    sires: [...(roster.breedingPool?.sires ?? []), ...newSires],
    broodmares: [...(roster.breedingPool?.broodmares ?? []), ...newBroodmares],
  };

  // ④新しい2歳の生成。⚠️**仮の形**：現役名簿から抜けた頭数ぶんだけ補充し、現役頭数を
  // 一定に保つ。父母は繁殖プールからランダムに1組選ぶが、⚠️**能力の遺伝（ニック・
  // インブリード・系統確立などの配合の枠組み）は未実装**——`generateHorse`が能力を毎回
  // 新規に振るだけで、親の能力を子へ反映していない。配合を作り込む弾で差し替える
  // （`TODO.md`へ棚上げ）。史実馬の新規投入（その年の結果表に出る馬）は史実馬インポートの
  // 仕組みが無いため未実装。
  const foalRand = streamRandom(saveSeed, RNG_STREAMS.GENERATION, "foal", newYear);
  const newFoals = [];
  // 馬名の重複回避：名簿に残る馬（現役＋プレイヤーが乗って残した引退馬）と史実馬の名前を避ける。
  // 同じ年の新馬どうしも避けるよう、集合を使い回す（`generateHorse`が足す）。
  const usedHorseNames = createUsedHorseNames([...staying, ...carried, ...keptRetired]);
  // 繁殖プールに父か母のどちらかが居ないとき：`orphanFoals`が偽（既定＝事前シミュレーション）
  // なら新馬を作らない（従来どおり）。真（本編）なら、居ない側の親は無しにして必ず補充する
  // ——本編は2歳の供給が途切れると3歳クラシックの出走馬が空になるため
  // （2026-10-12・`devlog/wave12.md`§29）。厩舎・馬主は親の所属を引き、親が居なければ乱数で選ぶ。
  const canBreed = breedingPool.sires.length > 0 && breedingPool.broodmares.length > 0;
  if (canBreed || (options.orphanFoals && roster.stables?.length > 0 && roster.owners?.length > 0)) {
    for (let i = 0; i < departedCount; i += 1) {
      const sire = breedingPool.sires.length > 0 ? pick(foalRand, breedingPool.sires) : null;
      const dam = breedingPool.broodmares.length > 0 ? pick(foalRand, breedingPool.broodmares) : null;
      const parentStableId = dam?.stableId ?? sire?.stableId ?? null;
      const parentOwnerId = dam?.ownerId ?? sire?.ownerId ?? null;
      newFoals.push(
        generateHorse(saveSeed, `foal-${newYear}-${i}`, {
          sireId: sire?.id ?? null,
          damId: dam?.id ?? null,
          ...(sire ? { bloodlineFamily: sire.bloodlineFamily } : {}),
          // ⭐新しい2歳：生年は「その年に2歳になる年」。馬齢は`年 - 生年`（`retirement.js`の
          // `horseAge`）で数え、2歳戦は6月から（`domain/horse.js`の`canDebutThisWeek`）。
          // ⚠️`newYear`をそのまま入れると0歳になり、出走できるまで2年間名簿の中で眠る
          // （2026-10-12に本編へ繋いだ実測で発見・3歳が1頭も居ない年が出た）。
          bornYear: newYear - NEW_FOAL_AGE_AT_ARRIVAL,
          stableId: parentStableId ?? pick(foalRand, roster.stables).id,
          ownerId: parentOwnerId ?? pick(foalRand, roster.owners).id,
          usedNames: usedHorseNames,
        })
      );
    }
  }

  return {
    retiredHorseIds: retiring.map((h) => h.id),
    roster: {
      ...roster,
      horses: [...staying, ...carried, ...keptRetired, ...newFoals],
      breedingPool,
    },
    stats: {
      retired: retiring.length,
      discarded: discardedCount,
      keptRetired: keptRetired.length,
      newSires: newSires.length,
      newBroodmares: newBroodmares.length,
      departedCount,
      newFoals: newFoals.length,
    },
  };
}
