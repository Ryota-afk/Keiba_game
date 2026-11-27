// 毛色・ベスト体重・セーブの大きさの計測（⑭ step1・CLAUDE.md §10・`devlog/wave13.md`§25）。
// 使い方： node tools/measure-horse-looks.mjs [開始年=1990] [年数=20] [シード=12345]
//   1) 初期ロースター（開始時）の毛色の割合
//   2) 事前シミュレーション2年＋続けて年の区切りを繰り返した後の毛色の割合（遺伝でどれだけ動くか）
//   3) 性×年齢ごとのベスト体重の平均と標準偏差（2024年の表と並べる）
//   4) 1頭あたりのセーブの増え方（JSON.stringifyの長さ）
import { createInitialRoster } from "../src/domain/career.js";
import { runBootstrapWeek } from "../src/domain/bootstrap.js";
import { processYearBoundary } from "../src/domain/yearBoundary.js";
import { COAT_IDS, COAT_LABEL, COAT_SHARE_2024 } from "../src/data/coat.js";
import { bestKg } from "../src/domain/horseLooks.js";
import { WEEKS_PER_YEAR } from "../src/data/calendar.js";

const startYear = Number(process.argv[2] ?? 1990);
const years = Number(process.argv[3] ?? 20);
const seed = Number(process.argv[4] ?? 12345);

function shares(horses) {
  const c = Object.fromEntries(COAT_IDS.map((id) => [id, 0]));
  for (const h of horses) c[h.coat] += 1;
  return Object.fromEntries(COAT_IDS.map((id) => [id, (c[id] / horses.length) * 100]));
}
function printShares(title, horses) {
  const s = shares(horses);
  console.log(`\n## ${title}（${horses.length}頭）`);
  console.log("毛色\t割合%\t2024年%");
  for (const id of COAT_IDS) console.log(`${COAT_LABEL[id]}\t${s[id].toFixed(2)}\t${COAT_SHARE_2024[id]}`);
}

const initial = createInitialRoster(seed);
printShares("初期ロースター", initial.horses);

// ベスト体重（初期ロースターに生年を割り当てた上で、各年齢の馬の年平均を測る）
const rows = [];
for (const gender of ["colt", "filly", "gelding"]) {
  for (let age = 2; age <= 5; age += 1) {
    const vals = [];
    initial.horses
      .filter((h) => h.gender === gender)
      .forEach((h) => {
        const horse = { ...h, bornYear: 2000 };
        for (let w = 1; w <= WEEKS_PER_YEAR; w += 4) vals.push(bestKg(horse, 2000 + age, w));
      });
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    rows.push({ gender, age, n: initial.horses.filter((h) => h.gender === gender).length, mean: mean.toFixed(1), sd: sd.toFixed(1) });
  }
}
console.log("\n## ベスト体重（kg・性×年齢）");
console.table(rows);

// セーブの大きさ
const stripped = initial.horses.map(({ coat, coatGenes, markings, frameKg, ...h }) => h);
const before = JSON.stringify(stripped).length;
const after = JSON.stringify(initial.horses).length;
console.log(`\n## セーブの大きさ（馬${initial.horses.length}頭）\n前 ${before}B → 後 ${after}B／1頭あたり +${((after - before) / initial.horses.length).toFixed(1)}B`);

// 遺伝で動くか：事前シミュレーション（2年）＋続けて`years`年
let roster = { ...initial };
// 初期の生年（bootstrap.jsと同じ割り当てを避け、ここでは簡易に全馬へ開始年−(0〜5)を付ける）
roster = { ...roster, horses: roster.horses.map((h, i) => ({ ...h, bornYear: startYear - 2 - (i % 6) })) };
let year = startYear - 2;
const totalYears = 2 + years;
const t0 = Date.now();
for (let y = 0; y < totalYears; y += 1) {
  for (let week = 1; week <= WEEKS_PER_YEAR; week += 1) {
    roster = runBootstrapWeek(seed, y * WEEKS_PER_YEAR + week, year, roster, {}).roster;
  }
  const yb = processYearBoundary(seed, year + 1, roster, { mainMounts: {} });
  roster = { ...roster, horses: yb.roster.horses, breedingPool: yb.roster.breedingPool };
  year += 1;
  if (y === 1 || y === totalYears - 1 || y % 5 === 4) {
    const s = shares(roster.horses);
    console.log(
      `${y + 1}年後 ${(Date.now() - t0) / 1000}s 現役${roster.horses.length}頭 ` +
        COAT_IDS.map((id) => `${COAT_LABEL[id]}${s[id].toFixed(1)}`).join(" ")
    );
  }
}
printShares(`${totalYears}年後の現役馬`, roster.horses);
const pool = [...roster.breedingPool.sires, ...roster.breedingPool.broodmares];
printShares("繁殖プール", pool);
