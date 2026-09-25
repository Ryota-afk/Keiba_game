// 馬場・距離ごとの「基準タイム」を史実の重賞の勝ちタイムから測る。
// ⚠️`src/sim/raceSim.js`のゴールタイム正規化は2400m前提（141.5〜147.5秒）で固定されており、
// 1200mでも3200mでも勝ちタイムが141.5〜147.5秒に丸められていた（2026-09-16・実測で発見）。
// その窓を距離に比例させるための基準値をここで作る。
//
// 出力：`src/data/parTimes.js`に貼る表（標準出力）。⚠️自動で書き込まない——数が少ない
// 距離（ダートなど）をどう埋めるかは人が判断する必要があるため。
//
// 使い方： node tools/measure-par-times.mjs

import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "data-src/ahonoora");

const MIN_SAMPLES = 8; // これ未満の距離は表に載せない（中央値が1〜2本で決まってしまうため）

function parseSeconds(text) {
  // 「1:47.6」＝1分47.6秒。着差の欄（「クビ」「1.1/2」等）は弾く。
  const m = /^(\d+):(\d{1,2})\.(\d)$/.exec((text ?? "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 10;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function collect() {
  const buckets = new Map(); // `${surface}:${distance}` → 秒の配列
  let races = 0;
  let years = [];
  for (const file of readdirSync(SRC_DIR).filter((f) => /^\d{4}\.json\.gz$/.test(f)).sort()) {
    const raw = JSON.parse(gunzipSync(readFileSync(path.join(SRC_DIR, file))).toString("utf-8"));
    for (const race of raw) {
      if (race.isArab) continue;
      if ((race.name ?? "").includes("障害")) continue;
      if (!race.distance || !race.surface) continue;
      const winner = (race.entries ?? []).find((e) => e.pos === "1着");
      if (!winner) continue;
      const seconds = parseSeconds(winner.timeOrMargin);
      if (seconds == null) continue;
      const key = `${race.surface}:${race.distance}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(seconds);
      races += 1;
      years.push(race.year);
    }
  }
  return { buckets, races, minYear: Math.min(...years), maxYear: Math.max(...years) };
}

function main() {
  const { buckets, races, minYear, maxYear } = collect();
  console.log(`勝ちタイムを読めたレース：${races}本（${minYear}〜${maxYear}年）`);
  console.log("⚠️1988年以降はタイムの書式が違い読めていない（この表は1987年までの実データ）。\n");

  const rows = [...buckets.entries()]
    .map(([key, values]) => {
      const [surface, distance] = key.split(":");
      return { surface, distance: Number(distance), n: values.length, median: median(values) };
    })
    .filter((r) => r.n >= MIN_SAMPLES)
    .sort((a, b) => (a.surface === b.surface ? a.distance - b.distance : a.surface < b.surface ? -1 : 1));

  console.log("馬場   距離   本数   中央値(秒)   速さ(m/s)");
  for (const r of rows) {
    console.log(
      `${r.surface.padEnd(5)} ${String(r.distance).padStart(5)} ${String(r.n).padStart(5)}   ${r.median
        .toFixed(1)
        .padStart(8)}   ${(r.distance / r.median).toFixed(2).padStart(7)}`
    );
  }

  // 芝に対するダートの速さの比（ダートは本数が少ないので、同じ距離の芝と比べた比だけを取る）。
  const bySurface = { turf: new Map(), dirt: new Map() };
  for (const r of rows) bySurface[r.surface]?.set(r.distance, r);
  const ratios = [];
  for (const [distance, dirtRow] of bySurface.dirt) {
    const turfRow = bySurface.turf.get(distance);
    if (!turfRow) continue;
    ratios.push({
      distance,
      ratio: (distance / dirtRow.median) / (distance / turfRow.median),
      dirtN: dirtRow.n,
      turfN: turfRow.n,
    });
  }
  if (ratios.length) {
    console.log("\nダート／芝の速さの比（同じ距離で比べた値）");
    for (const r of ratios) {
      console.log(`  ${r.distance}m： ${r.ratio.toFixed(3)}（ダート${r.dirtN}本・芝${r.turfN}本）`);
    }
    const mean = ratios.reduce((s, r) => s + r.ratio, 0) / ratios.length;
    console.log(`  平均： ${mean.toFixed(3)}`);
  }

  console.log("\n--- `src/data/parTimes.js`へ貼る形 ---");
  const turfRows = rows.filter((r) => r.surface === "turf");
  console.log("export const PAR_SECONDS_TURF = Object.freeze({");
  for (const r of turfRows) console.log(`  ${r.distance}: ${r.median.toFixed(1)}, // ${r.n}本`);
  console.log("});");
}

main();
