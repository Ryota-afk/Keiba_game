// 調子と当日の馬体重のテスト（⑭ step2・`devlog/wave13b.md`§28・`arch/horse.md`「出来」）。
// 使い方： node --test tools/test-horse-form.mjs   （または npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateHorse } from "../src/domain/horse.js";
import {
  raceDayForm,
  horseAfterRace,
  bodyKgFields,
  trainingWeightFor,
  recoverForm,
  baseFormLevel,
  formFactorOf,
  isUltimate,
  formStateOf,
} from "../src/domain/horseForm.js";
import { FORM_LEVEL_CENTER, REST_RESET_WEEKS, ULTIMATE_LEVEL, ULTIMATE_BONUS } from "../src/data/horseForm.js";

const SEED = 4242;
const YEAR = 1990;
const WEEK = 200; // 絶対週
const fresh = () => ({ ...generateHorse(SEED, "form-test"), bornYear: YEAR - 3 });
const raced = (horse, week, bodyKg) => ({
  ...horse,
  record: {
    ...horse.record,
    starts: 1,
    recentFinishes: [{ position: 3, week, ...(bodyKg != null ? { bodyKg } : {}) }],
  },
});

test("同じ馬・同じ週なら当日の状態は同じ（週の画面とレースの日で一致する）", () => {
  const h = fresh();
  assert.deepEqual(raceDayForm(h, SEED, WEEK, YEAR), raceDayForm(h, SEED, WEEK, YEAR));
});

test("当日の体重・調教後の体重は2kg刻み", () => {
  for (let w = WEEK; w < WEEK + 60; w += 1) {
    const h = raced(fresh(), w - 4, 480);
    assert.equal(raceDayForm(h, SEED, w, YEAR).bodyKg % 2, 0);
    assert.equal(trainingWeightFor(h, YEAR, w, SEED).kg % 2, 0);
  }
});

test("前走比：初出走はnull・前走の体重が記録に無い（古いセーブ）ときはundefined（欄を省く）", () => {
  const debut = raceDayForm(fresh(), SEED, WEEK, YEAR);
  assert.equal(debut.bodyKgDiff, null);
  assert.ok("bodyKgDiff" in bodyKgFields(debut));
  const unknown = raceDayForm(raced(fresh(), WEEK - 4, null), SEED, WEEK, YEAR);
  assert.equal(unknown.bodyKgDiff, undefined);
  assert.equal("bodyKgDiff" in bodyKgFields(unknown), false);
  const known = raceDayForm(raced(fresh(), WEEK - 4, 470), SEED, WEEK, YEAR);
  assert.equal(known.bodyKgDiff, known.bodyKg - 470);
  const tw = trainingWeightFor(raced(fresh(), WEEK - 4, 470), YEAR, WEEK, SEED);
  assert.equal(tw.diff, tw.kg - 470);
  assert.equal(trainingWeightFor(fresh(), YEAR, WEEK, SEED).diff, null);
});

test("調教後の体重は当日の体重から±4kg以内", () => {
  for (let w = WEEK; w < WEEK + 200; w += 1) {
    const h = raced(fresh(), w - 3, 480);
    assert.ok(Math.abs(trainingWeightFor(h, YEAR, w, SEED).kg - raceDayForm(h, SEED, w, YEAR).bodyKg) <= 4);
  }
});

test("調子の形：休み明けが一番低く、2〜3走で頂点、使い続けると落ちる", () => {
  const lv = [0, 1, 2, 3, 4, 6, 9, 14].map((s) => baseFormLevel(s, 0.5));
  assert.ok(lv[0] < lv[1] && lv[1] < lv[2] && lv[2] <= lv[3]);
  assert.ok(lv[3] > lv[4] && lv[4] > lv[5] && lv[5] > lv[6]);
  // 健康が高いほど頂点が高く、使い減りが緩い
  assert.ok(baseFormLevel(3, 1) > baseFormLevel(3, 0));
  assert.ok(baseFormLevel(9, 1) - baseFormLevel(3, 1) > baseFormLevel(9, 0) - baseFormLevel(3, 0));
});

test("休み：REST_RESET_WEEKS以上空くと休み明けに戻り、太めが付く", () => {
  const r = recoverForm({ startsSinceRest: 5, fatKg: 0 }, REST_RESET_WEEKS, 0.5);
  assert.equal(r.startsSinceRest, 0);
  assert.ok(r.fatKg > 0);
  const short = recoverForm({ startsSinceRest: 5, fatKg: 0 }, 3, 0.5);
  assert.ok(short.startsSinceRest < 5 && short.startsSinceRest > 4);
  // 健康が高いほど戻りが速い
  assert.ok(recoverForm({ startsSinceRest: 5, fatKg: 0 }, 6, 1).startsSinceRest < recoverForm({ startsSinceRest: 5, fatKg: 0 }, 6, 0).startsSinceRest);
});

test("走った後：走数が1進み、太めが減る", () => {
  const h = raced(fresh(), WEEK - 20, 470);
  const day = raceDayForm(h, SEED, WEEK, YEAR);
  const after = horseAfterRace(h, day);
  assert.equal(after.form.startsSinceRest, Math.round((day.startsSinceRest + 1) * 100) / 100);
  assert.ok(after.form.fatKg < day.fatKg);
});

test("倍率：中心で1・ずれ±2kg以内なら体重の減点なし・究極仕上げは上乗せ", () => {
  assert.equal(formFactorOf(FORM_LEVEL_CENTER, 0), 1);
  assert.ok(formFactorOf(FORM_LEVEL_CENTER, 10) < 1);
  assert.equal(formFactorOf(FORM_LEVEL_CENTER, 2), formFactorOf(FORM_LEVEL_CENTER, -2));
  assert.ok(isUltimate(ULTIMATE_LEVEL, 2) && !isUltimate(ULTIMATE_LEVEL, 4) && !isUltimate(ULTIMATE_LEVEL - 1, 0));
  const justBelow = formFactorOf(ULTIMATE_LEVEL - 1e-9, 0);
  assert.ok(formFactorOf(ULTIMATE_LEVEL, 0) - justBelow > ULTIMATE_BONUS * 0.99);
});

test("古いセーブ（formが無い馬）は既定値で動く", () => {
  const h = raced(fresh(), WEEK - 4, 470);
  delete h.form;
  assert.deepEqual(formStateOf(h), { startsSinceRest: 2, fatKg: 0 });
  assert.ok(Number.isFinite(raceDayForm(h, SEED, WEEK, YEAR).factor));
});
