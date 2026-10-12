// 優駿達の蹄跡の結果表（`data-src/ahonoora/YYYY.json.gz`）から、実在の競走馬の名前の一覧を作る。
// 目的：ゲーム内で生まれる架空馬が実在馬と同じ名前にならないようにする
// （`domain/horseNames.js`の`createUsedHorseNames`が読む。`arch/horse.md`「馬の名前」）。
//
// ⚠️出典は優駿達の蹄跡（承認済みの3本目の出典・`design/rights-check.md`§8）の結果表だけ。他のサイトは使わない。
// 年が増えたら（1988〜2024年がパイプラインで追加される）、このスクリプトを再実行するだけでよい。
//
// 名前の整え方：空白を除く／(外)(地)[外]など括弧書きの印を除く／長音の別字形（―・－・ｰ）を「ー」へ。
// 整える前の綴りも別に残す（実在馬の綴りが揺れていても、どちらでも避けられるように）。
//
// 出力：`src/data/generated/realHorseNames.json`（重複なし・ソート済みの文字列配列）。
// 使い方： node tools/build-real-horse-names.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "data-src/ahonoora");
const OUT = path.join(ROOT, "src/data/generated/realHorseNames.json");

const MARKS = /[(（\[［【][^)）\]］】]*[)）\]］】]/g; // (外) (地) [外] 等
const LONG_VOWEL_VARIANTS = /[―－ｰ─—]/g;

/** 印・空白を除いた馬名。 */
export function normalizeHorseName(raw) {
  return String(raw)
    .replace(MARKS, "")
    .replace(/[\s　]+/g, "")
    .replace(LONG_VOWEL_VARIANTS, "ー");
}

const files = readdirSync(SRC_DIR).filter((f) => /^\d{4}\.json\.gz$/.test(f)).sort();
const names = new Set();
const years = [];
let entryCount = 0;
let rawDistinct = new Set();
for (const f of files) {
  const races = JSON.parse(gunzipSync(readFileSync(path.join(SRC_DIR, f))).toString("utf8"));
  years.push(f.slice(0, 4));
  for (const race of races) {
    for (const e of race.entries ?? []) {
      if (!e.name) continue;
      entryCount += 1;
      const raw = e.name.replace(/[\s　]+/g, "");
      rawDistinct.add(raw);
      names.add(raw);
      const norm = normalizeHorseName(e.name);
      if (norm) names.add(norm);
    }
  }
}

const sorted = [...names].sort();
writeFileSync(OUT, `${JSON.stringify(sorted)}\n`);

const katakanaOnly = sorted.filter((n) => /^[ァ-ヶー]+$/.test(n));
console.log(`年: ${years[0]}〜${years[years.length - 1]}（${years.length}年ぶん）`);
console.log(`出走行: ${entryCount}／綴りの種類（整える前）: ${rawDistinct.size}／出力した名前: ${sorted.length}（うちカタカナと長音だけ: ${katakanaOnly.length}）`);
console.log(`書き出し: ${path.relative(ROOT, OUT)}`);
