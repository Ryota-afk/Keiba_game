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

  // 障害（ゲームに出さない）が混ざっていないか。1999年から障害の重賞は名前に「障害」を含まない（「小倉サマージャンプ」）。
  const jumps = races.filter((r) => /障害|ジャンプ|[ＪJ]・G/.test(r.name));
  if (jumps.length) {
    console.log(`✗ ${year}: 障害が混ざっている`, jumps.map((r) => r.name));
    problems += 1;
  }

  // 平地の重賞は1着賞金が読めているはず（億の表記・旧書式の取りこぼしで0円にならない）。
  const noPrize = races.filter((r) => !(r.prize1 > 0));
  if (noPrize.length) {
    console.log(`✗ ${year}: 1着賞金が無い`, noPrize.map((r) => r.name));
    problems += 1;
  }

  // 名前にグレード表記（(GI)・(JpnII)…）や全角の英数字が残っていないか。
  const dirtyName = races.filter((r) => /[（(]\s*(GI|Jpn)/.test(r.name) || /[Ａ-Ｚａ-ｚ０-９]/.test(r.name));
  if (dirtyName.length) {
    console.log(`✗ ${year}: 名前にグレード表記か全角英数が残っている`, dirtyName.map((r) => r.name));
    problems += 1;
  }

  // 距離・馬場の型。
  const badShape = races.filter((r) => !(r.distance >= 1000 && r.distance <= 4000) || !["turf", "dirt"].includes(r.surface));
  if (badShape.length) {
    console.log(`✗ ${year}: 距離か馬場が不正`, badShape.map((r) => `${r.name}(${r.surface} ${r.distance})`));
    problems += 1;
  }

  // トライアルの`trialFor`は、同じ年の本番の名前に含まれ（ゲーム側の`name.includes(trialFor)`と同じ判定）、
  // トライアルの週が本番の週より前でなければならない。
  for (const t of races.filter((r) => r.trialFor)) {
    const targets = races.filter((r) => r.id !== t.id && !r.trialFor && r.name.includes(t.trialFor));
    if (targets.length === 0) {
      console.log(`✗ ${year}: トライアルの本番が同じ年に無い`, `${t.name} → ${t.trialFor}`);
      problems += 1;
    } else if (!targets.some((g) => t.week < g.week)) {
      console.log(`✗ ${year}: トライアルが本番より前の週でない`, `${t.name}(w${t.week}) → ${targets.map((g) => `${g.name}(w${g.week})`)}`);
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
