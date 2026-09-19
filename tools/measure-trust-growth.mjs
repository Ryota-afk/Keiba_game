// 週の通しで「信頼が積み上がるか」「鞍が埋まるか」を測る（本筋3 段6・CLAUDE.md §10）。
// ⚠️段3（断るコスト）・段4（重賞に乗れる判定）は信頼の増減に触るので、定数を動かしたら
// 必ずこれを走らせ直すこと（`devlog/wave09.md`§9 段6）。
//
// 使い方： node tools/measure-trust-growth.mjs [週数] [シード数]
//   既定は52週・5シード。3年で測るなら `node tools/measure-trust-growth.mjs 156 10`。
//
// ⚠️**週番号は`player.currentWeek`から読む。** ループ変数を週として渡すと、`advanceWeek`が
// 内部で進める週とずれる（2026-09-17に実際にこれで誤った結論を出した）。
//
// ⚠️⚠️**断るコストの検出方法を2026-09-17に直した**（`devlog/wave10.md`§9）。
// 以前は`bigTrustChange`通知（差が`BIG_TRUST_CHANGE_THRESHOLD`(4)以上のときだけ出る）を
// 数えていたが、断るコスト`DECLINE_MAIN_MOUNT_TRUST_LOSS`は2で、単発では通知の閾値に
// 届かない。⭐**通知が0件でも、断るコスト自体は発動している場合がある**——この取り違えで
// 「断るコストが1度も発動しなかった」という誤った結論を出しかけた。今は`defaultChooseMounts`を
// `chooseMounts`へ薄いラッパーで渡し、誰が実際に乗ったかを直接観測して、主戦の馬の依頼が
// 来たのに乗らなかった回数を数える（`declineOfMainMountCount`）。挙動は従来と完全に同じ
// （`defaultChooseMounts`を呼ぶだけ）——観測を増やしただけで選び方は変えていない。

import { bootstrapRoster } from "../src/domain/bootstrap.js";
import { createPlayer } from "../src/domain/player.js";
import { advanceWeek } from "../src/domain/weekLoop.js";
import { generateWeeklyRequests, RIDABLE_SLOTS_PER_WEEK } from "../src/domain/weeklyRequests.js";
import { courseIdsAvailable, confirmMounts, defaultChooseMounts } from "../src/domain/fridayConfirmation.js";
import { DAY } from "../src/data/weekDays.js";
import { isMainMount } from "../src/domain/mainMount.js";
import { isSidelined } from "../src/domain/fall.js";

const WEEKS = Number(process.argv[2] ?? 52);
const SEEDS = Number(process.argv[3] ?? 5);
const START_YEAR = 1976;

/**
 * その週に確定できる鞍数の上限。⚠️1日1場・1レース1頭・最大3鞍の3つの制約の下で、
 * 土曜と日曜の競馬場の組み合わせを全部試して一番多く乗れる数を返す（プレイヤーが
 * 最善に選んだ場合の天井）。既定の選び方がこれに届くかを比べるための基準。
 */
function bestFillableMounts(requests) {
  const byDay = courseIdsAvailable(requests);
  const satOptions = [null, ...byDay[DAY.SAT]];
  const sunOptions = [null, ...byDay[DAY.SUN]];
  let best = 0;
  for (const sat of satOptions) {
    for (const sun of sunOptions) {
      const n = confirmMounts(requests, { [DAY.SAT]: sat, [DAY.SUN]: sun }).length;
      if (n > best) best = n;
    }
  }
  return best;
}

function summarize(values) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return { min: Math.min(...values), max: Math.max(...values), avg: sum / values.length };
}

function runOneSeed(saveSeed) {
  const { roster: bootRoster } = bootstrapRoster(saveSeed, START_YEAR);
  let roster = bootRoster;
  let player = createPlayer(saveSeed, { stableId: roster.stables[0].id, startYear: START_YEAR });

  let ceilingSum = 0;
  let weeksWithGradedOffer = 0;
  let firstGradedOfferWeek = null;
  let declineOfMainMountCount = 0;
  let weeksCounted = 0;

  while (player.currentWeek <= WEEKS) {
    const week = player.currentWeek; // ⚠️ループ変数ではなくここから読む
    const requests = generateWeeklyRequests(saveSeed, week, roster, player);

    ceilingSum += bestFillableMounts(requests);
    if (requests.some((r) => r.grade != null)) {
      weeksWithGradedOffer += 1;
      if (firstGradedOfferWeek === null) firstGradedOfferWeek = week;
    }

    // ⭐`defaultChooseMounts`を薄いラッパーで渡し、選び方は変えずに誰が選ばれたかを観測する。
    // ⚠️`weekLoop.js`の実際の断るコスト判定は「選ばれて、かつ離脱中でない馬」だけを
    // 乗ったとみなす（`mounts = confirmedRaw.filter((m) => !isSidelined(...))`）。
    // ここも同じ条件で揃えないと、離脱中で選ばれた主戦馬を「乗った」と誤って数えてしまう
    // （2026-09-17の検証で見つかった見落とし・`devlog/wave10.md`§9）。
    const horsesByIdThisWeek = new Map(roster.horses.map((h) => [h.id, h]));
    let selectedHorseIds = new Set();
    const res = advanceWeek(saveSeed, roster, player, {
      chooseMounts: (candidates, maxSlots) => {
        const selected = defaultChooseMounts(candidates, maxSlots);
        selectedHorseIds = new Set(
          selected.filter((m) => !isSidelined(horsesByIdThisWeek.get(m.horseId))).map((m) => m.horseId)
        );
        return selected;
      },
    });

    // 主戦の馬に依頼が来たのに（＝主戦のまま）今週乗らなかった回数を直接数える
    // （通知には頼らない——理由は冒頭のコメント）。
    for (const r of requests) {
      if (selectedHorseIds.has(r.horseId)) continue; // 乗った
      if (!isMainMount(player.mainMounts, r.horseId)) continue; // 主戦以外は対象外
      declineOfMainMountCount += 1;
    }

    roster = res.roster;
    player = res.player;
    weeksCounted += 1;
  }

  const trainerTrusts = Object.values(player.trainerTrust);
  const ownerTrusts = Object.values(player.ownerTrust);
  return {
    saveSeed,
    weeksCounted,
    ceilingAvg: ceilingSum / weeksCounted,
    weeksWithGradedOffer,
    firstGradedOfferWeek,
    declineOfMainMountCount,
    trainer: summarize(trainerTrusts),
    owner: summarize(ownerTrusts),
    trainerNegative: trainerTrusts.filter((v) => v < 0).length,
    ownerNegative: ownerTrusts.filter((v) => v < 0).length,
    trainerCount: trainerTrusts.length,
    ownerCount: ownerTrusts.length,
  };
}

console.log(`${WEEKS}週 × ${SEEDS}通りの初期値（${START_YEAR}年開始・乗れる上限${RIDABLE_SLOTS_PER_WEEK}鞍）\n`);
console.log("初期値  埋まる上限  重賞依頼の週  初の重賞  厩舎信頼(最大/平均/相手数)  馬主信頼(最大/平均/相手数)  負の相手");

const rows = [];
for (let i = 0; i < SEEDS; i += 1) {
  const row = runOneSeed(`trust-${i}`);
  rows.push(row);
  console.log(
    `${String(i + 1).padStart(4)}  ` +
      `${row.ceilingAvg.toFixed(2).padStart(10)}  ` +
      `${String(row.weeksWithGradedOffer).padStart(12)}  ` +
      `${String(row.firstGradedOfferWeek ?? "無し").padStart(8)}  ` +
      `${row.trainer.max.toFixed(0).padStart(6)}/${row.trainer.avg.toFixed(1).padStart(6)}/${String(row.trainerCount).padStart(4)}  ` +
      `${row.owner.max.toFixed(0).padStart(8)}/${row.owner.avg.toFixed(1).padStart(6)}/${String(row.ownerCount).padStart(4)}  ` +
      `${String(row.trainerNegative + row.ownerNegative).padStart(6)}`
  );
}

const avg = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
console.log("\n--- まとめ ---");
console.log(`1週に埋められる鞍数の上限の平均：${avg((r) => r.ceilingAvg).toFixed(2)}鞍（上限${RIDABLE_SLOTS_PER_WEEK}鞍）`);
console.log(`厩舎への信頼：最大の平均${avg((r) => r.trainer.max).toFixed(1)}・相手数の平均${avg((r) => r.trainerCount).toFixed(1)}`);
console.log(`馬主への信頼：最大の平均${avg((r) => r.owner.max).toFixed(1)}・相手数の平均${avg((r) => r.ownerCount).toFixed(1)}`);
console.log(`信頼が負に落ちた相手：合計${rows.reduce((a, r) => a + r.trainerNegative + r.ownerNegative, 0)}件`);
console.log(`主戦の馬の依頼を断った回数：合計${rows.reduce((a, r) => a + r.declineOfMainMountCount, 0)}件`);
const reached = rows.filter((r) => r.firstGradedOfferWeek !== null);
console.log(
  `重賞の依頼に届いた初期値：${reached.length}/${rows.length}通り` +
    (reached.length > 0
      ? `（届いた分の平均${(reached.reduce((a, r) => a + r.firstGradedOfferWeek, 0) / reached.length).toFixed(0)}週）`
      : "")
);
