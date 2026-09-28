// `tools/build-graded-races.mjs`が作った`src/data/generated/gradedRaces.*.json`の検算。
// 実装のたびに壊れていないかを確かめる自己チェック（テストランナーが無いプロジェクトの代替）。
// 使い方： node tools/verify-graded-races.mjs

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "src/data/generated");

const files = readdirSync(DIR).filter((f) => /^gradedRaces\.\d{4}\.json$/.test(f));
let problems = 0;

for (const file of files.sort()) {
  const year = Number(file.match(/(\d{4})/)[1]);
  const races = JSON.parse(readFileSync(path.join(DIR, file), "utf-8"));

  const ids = races.map((r) => r.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) {
    console.log(`✗ ${year}: 重複ID`, [...new Set(dupIds)]);
    problems += 1;
  }

  const badWeek = races.filter((r) => !(r.week >= 1 && r.week <= 52));
  if (badWeek.length) {
    console.log(`✗ ${year}: 週が1〜52の外`, badWeek.map((r) => r.name));
    problems += 1;
  }

  if (year >= 1984) {
    const noGrade = races.filter((r) => r.grade == null);
    if (noGrade.length) {
      console.log(`✗ ${year}: グレードが無い（1984年以降は全部あるはず）`, noGrade.map((r) => r.name));
      problems += 1;
    }
  } else {
    const hasGrade = races.filter((r) => r.grade != null);
    if (hasGrade.length) {
      console.log(`✗ ${year}: グレードが付いている（1984年より前は付かないはず）`, hasGrade.map((r) => r.name));
      problems += 1;
    }
  }

  const noCourse = races.filter((r) => !r.courseId);
  if (noCourse.length) {
    console.log(`✗ ${year}: 競馬場idが無い`, noCourse.map((r) => r.name));
    problems += 1;
  }
}

console.log(problems === 0 ? `OK：${files.length}年ぶん、問題なし` : `NG：${problems}件の問題`);
process.exit(problems === 0 ? 0 : 1);
