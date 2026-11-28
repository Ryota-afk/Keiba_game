// モーションリファレンス（https://motion-reference.takayustudio.jp/ ・たかゆ / TakayuStudio）を
// 引く道具。ゲームに動きを足す・直すときの参考を、名前・用途・感触から探す（`design/motion-reference.md`）。
//
// 使い方：
//   node tools/motion-ref.mjs --refresh          サイトを開き直して一覧を取り直す（初回は自動で行う）
//   node tools/motion-ref.mjs --cats             分類の一覧
//   node tools/motion-ref.mjs --cat entrance     分類で絞る
//   node tools/motion-ref.mjs --id fade-slide    1件を詳しく
//   node tools/motion-ref.mjs 紙吹雪 着地        言葉で探す（名前・用途・感触・説明を見る。複数語はすべて含むもの）
//
// ⚠️サイトのデータはリポジトリに入れない（利用条件の記載が無く「個人学習用リファレンス」とあるため、
// 再配布しない）。一覧はOSの一時フォルダ（`keiba-motion-ref.json`）にだけ置く。ゲームへ持ち込むのは
// 秒数・イージングなどの値と考え方だけで、サイトの実装コードをそのまま貼らない。
// ⚠️サイトの一覧はページのJavaScriptが組み立てるため、Chromium（Playwright）で開いて読む。
// Playwrightはこのリポジトリの依存に入れていない（配信のビルドが重くなるため）。グローバルに入っている
// ものを使う（このクラウド環境では`npm root -g`に入っている）。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const SITE = "https://motion-reference.takayustudio.jp/";
const CACHE = path.join(os.tmpdir(), "keiba-motion-ref.json");
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

// イージング名→CSSの`cubic-bezier`（easings.net の表）。ゲームの`src/styles/motion.css`は
// `cubic-bezier`で書くので、ここで変換して出す。弾む（elastic・bounce）・ばね・物理は1本の
// `cubic-bezier`では表せないので出さない（サイトの「配分」を見て`@keyframes`で組む）。
const CSS_EASING = {
  linear: "linear",
  easeInSine: "cubic-bezier(0.12, 0, 0.39, 0)", easeOutSine: "cubic-bezier(0.61, 1, 0.88, 1)", easeInOutSine: "cubic-bezier(0.37, 0, 0.63, 1)",
  easeInQuad: "cubic-bezier(0.11, 0, 0.5, 0)", easeOutQuad: "cubic-bezier(0.5, 1, 0.89, 1)", easeInOutQuad: "cubic-bezier(0.45, 0, 0.55, 1)",
  easeInCubic: "cubic-bezier(0.32, 0, 0.67, 0)", easeOutCubic: "cubic-bezier(0.33, 1, 0.68, 1)", easeInOutCubic: "cubic-bezier(0.65, 0, 0.35, 1)",
  easeInQuart: "cubic-bezier(0.5, 0, 0.75, 0)", easeOutQuart: "cubic-bezier(0.25, 1, 0.5, 1)", easeInOutQuart: "cubic-bezier(0.76, 0, 0.24, 1)",
  easeInQuint: "cubic-bezier(0.64, 0, 0.78, 0)", easeOutQuint: "cubic-bezier(0.22, 1, 0.36, 1)", easeInOutQuint: "cubic-bezier(0.83, 0, 0.17, 1)",
  easeInExpo: "cubic-bezier(0.7, 0, 0.84, 0)", easeOutExpo: "cubic-bezier(0.16, 1, 0.3, 1)", easeInOutExpo: "cubic-bezier(0.87, 0, 0.13, 1)",
  easeInCirc: "cubic-bezier(0.55, 0, 1, 0.45)", easeOutCirc: "cubic-bezier(0, 0.55, 0.45, 1)", easeInOutCirc: "cubic-bezier(0.85, 0, 0.15, 1)",
  easeInBack: "cubic-bezier(0.36, 0, 0.66, -0.56)", easeOutBack: "cubic-bezier(0.34, 1.56, 0.64, 1)", easeInOutBack: "cubic-bezier(0.68, -0.6, 0.32, 1.6)",
};

async function refresh() {
  const require = createRequire(execSync("npm root -g").toString().trim() + "/");
  const { chromium } = require("playwright");
  const browser = await chromium.launch(fs.existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
  try {
    const page = await browser.newPage();
    await page.goto(SITE, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction(() => (window.MOTION_LIBRARY || []).length > 0, null, { timeout: 30000 });
    const data = await page.evaluate(() => {
      const cats = (window.MOTION_CATEGORIES || []).map((c) => ({ id: c.id, label: c.label }));
      for (const c of window.MOTION_ATLAS_CATEGORIES || []) {
        if (!cats.some((x) => x.id === c.id)) cats.push({ id: c.id, label: c.label });
      }
      const items = (window.MOTION_LIBRARY || []).map((m) => {
        return {
          id: m.id,
          category: m.category,
          title: m.title,
          // ⚠️`duration`はデモの繰り返し全体の長さ（例：fade-slideで2400ms）。動きそのものの時間は
          // `motionDuration`（同600ms＝サイトの「時間」欄・「配分」の終点と一致）。
          duration: m.motionDuration ?? m.duration,
          easing: m.easing,
          feelings: m.feelings || [],
          usages: m.usages || [],
          description: m.description || "",
          focus: m.focus || "",
          caution: m.caution || "",
          tips: m.tips || [],
          recipe: m.recipe || "",
          trigger: m.trigger || "",
          reduced: m.reduced || "",
        };
      });
      return { cats, items };
    });
    const payload = { fetchedAt: new Date().toISOString(), site: SITE, ...data };
    fs.writeFileSync(CACHE, JSON.stringify(payload));
    return payload;
  } finally {
    await browser.close();
  }
}

async function load(force) {
  if (!force && fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  console.error(`サイトを開いて一覧を取っています（${SITE}）…`);
  return refresh();
}

function urlOf(id) {
  return `${SITE}#motion=${encodeURIComponent(id)}`;
}

function printShort(m, catLabel) {
  const css = CSS_EASING[m.easing];
  const ease = css && css !== m.easing ? `${m.easing}（${css}）` : m.easing;
  console.log(`${m.id}｜${m.title}｜${catLabel}｜${m.duration}ms｜${ease}`);
  if (m.usages.length || m.feelings.length) {
    console.log(`    用途：${m.usages.join("・") || "—"}　感触：${m.feelings.join("・") || "—"}`);
  }
}

function printLong(m, catLabel) {
  printShort(m, catLabel);
  const rows = [
    ["説明", m.description],
    ["見るところ", m.focus],
    ["きっかけ", m.trigger],
    ["配分", m.recipe],
    ["注意", m.caution],
    ["動きを減らす場合", m.reduced],
    ["真似するとき", m.tips.join(" / ")],
    ["URL", urlOf(m.id)],
  ];
  for (const [k, v] of rows) if (v) console.log(`    ${k}：${v}`);
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const data = await load(flag("--refresh"));
const catLabel = Object.fromEntries(data.cats.map((c) => [c.id, c.label]));

if (flag("--cats")) {
  const counts = {};
  for (const m of data.items) counts[m.category] = (counts[m.category] ?? 0) + 1;
  for (const c of data.cats) console.log(`${c.id}｜${c.label}｜${counts[c.id] ?? 0}件`);
  console.log(`計${data.items.length}件（取得：${data.fetchedAt}）`);
} else if (valueOf("--id")) {
  const m = data.items.find((x) => x.id === valueOf("--id"));
  if (!m) {
    console.error(`見つかりません：${valueOf("--id")}`);
    process.exit(1);
  }
  printLong(m, catLabel[m.category] ?? m.category);
} else {
  const cat = valueOf("--cat");
  const words = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--cat");
  const hits = data.items.filter((m) => {
    if (cat && m.category !== cat) return false;
    const text = [m.id, m.title, ...m.usages, ...m.feelings, m.description, catLabel[m.category] ?? ""].join(" ");
    return words.every((w) => text.toLowerCase().includes(w.toLowerCase()));
  });
  if (!cat && words.length === 0 && !flag("--refresh")) {
    console.log("使い方はファイル冒頭のコメントを参照（--cats／--cat 分類id／--id モーションid／言葉）");
  } else {
    for (const m of hits) printShort(m, catLabel[m.category] ?? m.category);
    console.log(`${hits.length}件`);
  }
}
