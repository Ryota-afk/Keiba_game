// 毛色の遺伝・創始馬の割合・ベスト体重の平均のテスト（⑭ step1・`devlog/wave13.md`§25）。
// 使い方： node --test tools/test-horse-looks.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { streamRandom } from "../src/core/rng.js";
import { COAT_SHARE_2024, COAT_IDS, WHITE_MUTATION_RATE } from "../src/data/coat.js";
import {
  drawFounderGenes,
  coatFromGenes,
  inheritGenes,
  drawHorseLooks,
  bestKg,
  baseKgByAge,
  roundTo2kg,
  ensureHorseLooks,
  hasHorseLooks,
} from "../src/domain/horseLooks.js";
import { generateHorse } from "../src/domain/horse.js";

const rng = (tag) => streamRandom("test", "generation", tag);
const CHESTNUT_FAMILY = new Set(["chestnut", "liverChestnut"]);

test("創始馬の毛色の割合が2024年と±1ポイント以内（10万頭）", () => {
  const r = rng("founder");
  const n = 100000;
  const count = Object.fromEntries(COAT_IDS.map((c) => [c, 0]));
  for (let i = 0; i < n; i += 1) count[coatFromGenes(drawFounderGenes(r), r)] += 1;
  for (const id of COAT_IDS) {
    const got = (count[id] / n) * 100;
    assert.ok(Math.abs(got - COAT_SHARE_2024[id]) <= 1, `${id}: ${got.toFixed(2)}% vs ${COAT_SHARE_2024[id]}%`);
  }
});

test("遺伝：栗毛系の両親からは栗毛系だけ／芦毛の子には芦毛遺伝子を持つ親が必ず居る／白毛の子には白毛遺伝子の親が必ず居る", () => {
  const r = rng("inherit");
  let chestnutPairs = 0;
  let grayFoals = 0;
  let whiteFoals = 0;
  let mutants = 0;
  for (let i = 0; i < 200000; i += 1) {
    const sire = drawFounderGenes(r);
    const dam = drawFounderGenes(r);
    const foal = inheritGenes(r, sire, dam);
    if (foal.g) {
      grayFoals += 1;
      assert.ok(sire.g || dam.g);
    }
    if (foal.w) {
      whiteFoals += 1;
      if (!sire.w && !dam.w) mutants += 1; // 突然変異（`WHITE_MUTATION_RATE`）以外では親に白毛遺伝子が必要
    }
    // 白毛・芦毛が隠れていない栗毛系の両親（e=0）→子もe=0（見た目が白毛・芦毛でなければ栗毛系）
    const parentsChestnut = sire.e === 0 && dam.e === 0 && !sire.g && !dam.g && !sire.w && !dam.w;
    if (parentsChestnut) {
      chestnutPairs += 1;
      assert.equal(foal.e, 0);
      if (!foal.w) assert.ok(CHESTNUT_FAMILY.has(coatFromGenes(foal, r))); // 白毛の突然変異だけは別
    }
  }
  assert.ok(mutants / 200000 < WHITE_MUTATION_RATE * 2, `突然変異が多すぎる: ${mutants}`);
  assert.ok(chestnutPairs > 1000, `栗毛系どうしの組が少なすぎる: ${chestnutPairs}`);
  assert.ok(grayFoals > 1000 && whiteFoals >= 1);
});

test("遺伝：両親が白毛でも子はWWにならない（w=1のまま）・芦毛の親が居なければ芦毛は出ない", () => {
  const r = rng("lethal");
  const w = { e: 1, a: 1, g: 0, w: 1 };
  for (let i = 0; i < 100; i += 1) assert.equal(inheritGenes(r, w, w).w, 1);
  const plain = { e: 2, a: 2, g: 0, w: 0 };
  for (let i = 0; i < 1000; i += 1) assert.equal(inheritGenes(r, plain, plain).g, 0);
});

test("generateHorse：見た目の欄が入り、同じシードなら同じ・親の遺伝子が効く", () => {
  const h = generateHorse("s", 1);
  assert.ok(hasHorseLooks(h));
  assert.deepEqual(generateHorse("s", 1).coatGenes, h.coatGenes);
  const chest = { e: 0, a: 2, g: 0, w: 0 };
  for (let i = 0; i < 50; i += 1) {
    const foal = generateHorse("s", `f${i}`, { sireGenes: chest, damGenes: chest });
    assert.ok(CHESTNUT_FAMILY.has(foal.coat));
  }
});

test("ensureHorseLooks：欄の無い馬に補い、あれば変えない", () => {
  const { coat, coatGenes, markings, frameKg, ...old } = generateHorse("s", 2);
  const fixed = ensureHorseLooks(old, "s");
  assert.ok(hasHorseLooks(fixed));
  assert.equal(ensureHorseLooks(fixed, "s"), fixed);
});

test("ベスト体重：性×年齢の平均が2024年の表に合い、年の境目で段差が出ない", () => {
  const table = { colt: [472, 480, 489, 492], filly: [446, 450, 464, 468] };
  for (const [g, vals] of Object.entries(table)) {
    vals.forEach((v, i) => assert.equal(baseKgByAge(g, 2 + i + 0.5), v));
  }
  assert.equal(baseKgByAge("gelding", 3.5), 477);
  assert.ok(Math.abs(baseKgByAge("colt", 3.999) - baseKgByAge("colt", 4.001)) < 0.1);
  assert.equal(roundTo2kg(481), 482);
});

test("ベスト体重：性×年齢ごとの平均（年の平均は表どおり±2kg）", () => {
  const r = rng("kg");
  const n = 6000;
  const table = { colt: [472, 480, 489, 492], filly: [446, 450, 464, 468] };
  for (const gender of ["colt", "filly"]) {
    for (let age = 2; age <= 5; age += 1) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) {
        const horse = { gender, bornYear: 2000, ...drawHorseLooks(r), surfaceAptitude: { turf: "○", dirt: "○" } };
        // 年の52週の平均（季節は平均0）
        const week = 1 + (i % 52);
        sum += bestKg(horse, 2000 + age, week);
      }
      const mean = sum / n;
      assert.ok(Math.abs(mean - table[gender][age - 2]) <= 2, `${gender}${age}歳 ${mean.toFixed(1)}`);
    }
  }
});
