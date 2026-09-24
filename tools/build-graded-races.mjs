// 優駿達の蹄跡の結果表（`data-src/ahonoora/YYYY.json.gz`）から、ゲーム用の重賞データを作る。
// ⚠️正本の決め方は`arch/race-program.md`§1・`devlog/wave07.md`「質問20・21」。
//
// 手順（1年ぶんにつき）：
//   1. 障害・アラブを除く（質問5・G採用の決定。isArab、名前に「障害」を含むものを除外）
//   2. 名前の末尾の (GI)/(GII)/(GIII) を切り離してgradeにする（1984年より前は無いのでnull）。
//      ⚠️グレードは1984年から画面に出す（G表記そのものは今回も1984年以降にしか付いていない）
//   3. 名前の「（〜トライアル）」からトライアル対応表を作る（質問15）
//   4. 週を決める：平地G1・24本の固定名に一致すれば`FIXED_G1_WEEK`の週と、その週の
//      同じ枠の競馬場（`FIXED_G1_COURSE`）を使う。トライアル（`trialFor`を持つレース）は、
//      本番からの史実の日数の間隔を週数に丸め、本番の固定週からその週数ぶん引いた週に置く
//      （`trialWeekFromTarget`。⭐2026-09-24追加・`devlog/wave11.md`§15「訂正：京都新聞杯と
//      菊花賞が同じ週」。トライアルの史実の日付をそのまま`weekOfYearFromDate`に通すと、
//      年によっては本番の史実の日付が固定週より遅く、トライアルの週が本番に追いつく・
//      追い越すことがあった）。それ以外の一般の重賞は実際の日付から週を出す。
//      競馬場はその週に開いていなければ同じ地区の開いている場へ移す（質問21＝(ア)）。
//   5. 牝馬限定かどうかを条件欄（「牝」を含み「牡」を含まない）から決める。
//
// 出力：`src/data/generated/gradedRaces.<year>.json`（1年ぶん）。
//
// 使い方： node tools/build-graded-races.mjs [開始年] [終了年]
//   例： node tools/build-graded-races.mjs 1974 1987

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const { FIXED_G1_WEEK, weekOfYearFromDate, resolveMeetingCourse } = await import(
  path.join(ROOT, "src/data/jraMeetingSchedule.js")
);
const { findCourseByName } = await import(path.join(ROOT, "src/data/courses.js"));

// 平地G1・24本の、現行の固定開催場（`arch/race-program.md`§1・`jraMeetingSchedule.js`の
// 週割りと矛盾しないことを確認済み——`devlog/wave07.md`実装ログ参照）。
const FIXED_G1_COURSE = {
  "フェブラリーステークス": "tokyo",
  "高松宮記念": "chukyo",
  "大阪杯": "hanshin",
  "桜花賞": "hanshin",
  "皐月賞": "nakayama",
  "天皇賞（春）": "kyoto",
  "NHKマイルカップ": "tokyo",
  "ヴィクトリアマイル": "tokyo",
  "優駿牝馬": "tokyo",
  "東京優駿": "tokyo",
  "安田記念": "tokyo",
  "宝塚記念": "hanshin",
  "スプリンターズステークス": "nakayama",
  "秋華賞": "kyoto",
  "菊花賞": "kyoto",
  "天皇賞（秋）": "tokyo",
  "エリザベス女王杯": "kyoto",
  "マイルチャンピオンシップ": "kyoto",
  "ジャパンカップ": "tokyo",
  "チャンピオンズカップ": "chukyo",
  "阪神ジュベナイルフィリーズ": "hanshin",
  "朝日杯フューチュリティステークス": "hanshin",
  "有馬記念": "nakayama",
  "ホープフルステークス": "nakayama",
};

// 史実の名前ゆれ→現行名（`FIXED_G1_WEEK`のキー）への対応。「接頭辞を1つ外す」
// 「そのまま」のどちらでも解決しない、名前そのものが変わった重賞だけ載せる
// （`devlog/wave06.md`の実測「名前が違う」表）。⚠️「報知杯 阪神4歳牝馬特別」は
// 阪神JFの旧名ではない——毎年3月に走る桜花賞トライアルの名前で、実際の阪神JFの
// 旧名は「阪神3歳ステークス」（12月・2歳）だけ。名前が似ているために一度誤って
// 別名扱いした（2026-09-15・build時に発見・修正）。
const HISTORICAL_NAME_ALIASES = {
  "高松宮杯": "高松宮記念",
  "阪神3歳ステークス": "阪神ジュベナイルフィリーズ",
  "朝日杯3歳ステークス": "朝日杯フューチュリティステークス",
};

// 賞金団体名・記念冠など、本体の名前の前に付く「外してよい接頭辞」。
// ⚠️`.includes()`のような部分一致は使わない——「京王杯スプリンターズステークス」が
// 「スプリンターズステークス」を部分文字列に含んでしまうような、無関係の別レースを
// 誤って同一視する事故を避けるため、常に「接頭辞を取り除いた残り全体」の完全一致で確かめる。
const REMOVABLE_PREFIXES = [
  "天皇賞競走施行50周年記念 ",
  "農林水産省賞典 ",
  "農林省賞典 ",
  "サンケイスポーツ賞 ",
  "サンケイ",
  "読売杯 ",
  "読売 ",
];

// 末尾に付く「愛称の（〜）」で、本体の名前とは別に確定週の名寄せに使わないもの
// （東京優駿（日本ダービー）→東京優駿、優駿牝馬（オークス）→優駿牝馬、
//   有馬記念（グランプリ）→有馬記念）。
const REMOVABLE_SUFFIXES = [/（オークス）$/, /（日本ダービー）$/, /（グランプリ）$/];

function stripGrade(rawName) {
  // ⚠️括弧が半角(GIII)と全角（GIII）の両方で出てくる（2026-09-15・build時に発見）。
  const m = rawName.match(/^(.*?)\s*[（(](GI{1,3})[）)]\s*$/);
  if (!m) return { name: rawName.trim(), grade: null };
  const gradeMap = { GI: "g1", GII: "g2", GIII: "g3" };
  return { name: m[1].trim(), grade: gradeMap[m[2]] };
}

function extractTrialTarget(name) {
  // 例："フジテレビ賞 スプリングステークス （皐月賞トライアル）" → "皐月賞"
  const m = name.match(/（([^（）]*?)トライアル）/);
  if (!m) return null;
  return m[1].trim();
}

function isFillyOnly(condition) {
  if (!condition) return false;
  return condition.includes("牝") && !condition.includes("牡");
}

// トライアルの`trialFor`（例："オークス"）は本番の通称であって、`FIXED_G1_WEEK`の
// キー（本番の正式名。例："優駿牝馬"）と文字列が一致しないことがある
// （`domain/npcGradedRace.js`の`priorityIdsForRace`が`race.name.includes(t.trialFor)`という
// 部分一致で解決しているのと同じ理由）。ここでは週の逆算に使うため、実データに出てくる
// 5種類の`trialFor`だけを正式名へ変換する（他は`trialFor`自身がそのままキーと一致する）。
const TRIAL_TARGET_TO_FIXED_NAME = {
  "オークス": "優駿牝馬",
};

/**
 * トライアルの週を、本番（`FIXED_G1_WEEK`固定）から逆算する
 * （`devlog/wave11.md`§15「訂正：京都新聞杯と菊花賞が同じ週」の直し）。
 * ⚠️**なぜ必要か**：本番G1は史実の日付を無視して`FIXED_G1_WEEK`の固定週に置くが、
 * トライアルは史実の日付をそのまま`weekOfYearFromDate`に通していた。年によっては
 * 本番の史実の日付が現行の固定週より遅く、その差の分だけトライアルの週が本番の週に
 * 追いつき、同じ週（1976〜1978・1983・1984年）や本番より後（1972年の4組）になっていた。
 * ここでは「トライアルは本番の何日前に走ったか」という史実の**間隔**だけを使い、
 * 本番の固定週からその週数ぶん引いた週に置き直す——本番の史実の日付そのものは使わない。
 * @param {string} trialFor - トライアルの`trialFor`（例："菊花賞"）
 * @param {string} trialDate - トライアルの史実の日付（"YYYY-MM-DD"）
 * @param {Map<string, string>} fixedDateByName - `FIXED_G1_WEEK`のキー→その年の史実の日付
 * @returns {number|null} 求まらなければ`null`（呼び出し側が`weekOfYearFromDate`へ後退する）
 */
function trialWeekFromTarget(trialFor, trialDate, fixedDateByName) {
  const canonicalTarget = TRIAL_TARGET_TO_FIXED_NAME[trialFor] ?? trialFor;
  const targetWeek = FIXED_G1_WEEK[canonicalTarget];
  const targetDate = fixedDateByName.get(canonicalTarget);
  if (targetWeek == null || !targetDate) return null; // この年に本番のデータが無い（保険）
  const [ty, tm, td] = targetDate.split("-").map(Number);
  const [ry, rm, rd] = trialDate.split("-").map(Number);
  const gapDays = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(ry, rm - 1, rd)) / 86_400_000
  );
  const weeksBefore = Math.max(1, Math.round(gapDays / 7)); // 同じ週・後の週にしない
  return targetWeek - weeksBefore;
}

/**
 * トライアル注記のあるレースは対象外にした上で、次の順に**完全一致**だけで確かめる：
 * ①そのまま ②末尾の愛称カッコを外した形 ③接頭辞を1つ外した形（そのまま／別名表）。
 * 部分一致は使わない——似た別のレースを誤って同一視する事故を防ぐため
 * （2026-09-15・「京王杯スプリンターズステークス」に類する取り違えを避ける設計）。
 */
function resolveFixedName(nameNoGrade, trialFor) {
  if (trialFor) return null;

  const candidates = [nameNoGrade];
  for (const suffix of REMOVABLE_SUFFIXES) {
    if (suffix.test(nameNoGrade)) candidates.push(nameNoGrade.replace(suffix, ""));
  }

  for (const candidate of candidates) {
    if (FIXED_G1_WEEK[candidate] != null) return candidate;
    if (HISTORICAL_NAME_ALIASES[candidate] != null) return HISTORICAL_NAME_ALIASES[candidate];
    for (const prefix of REMOVABLE_PREFIXES) {
      if (!candidate.startsWith(prefix)) continue;
      const stripped = candidate.slice(prefix.length);
      if (FIXED_G1_WEEK[stripped] != null) return stripped;
      if (HISTORICAL_NAME_ALIASES[stripped] != null) return HISTORICAL_NAME_ALIASES[stripped];
    }
  }
  return null;
}

function buildYear(year) {
  const gzPath = path.join(ROOT, "data-src/ahonoora", `${year}.json.gz`);
  if (!existsSync(gzPath)) {
    console.log(`  skip ${year}（${gzPath} が無い）`);
    return null;
  }
  const raw = JSON.parse(gunzipSync(readFileSync(gzPath)).toString("utf-8"));
  const races = [];
  let skippedNoCourse = 0;

  // ①1回目の通し：名前・グレード・トライアル対応だけを解決する（週はまだ決めない）。
  // ⚠️トライアルの週（②）が本番の史実の日付を必要とするため、本番側を先に全部
  // 解決してからでないとトライアル側を計算できない——1回のループでは順不同になる。
  const parsed = [];
  for (const r of raw) {
    if (r.isArab) continue;
    if (r.name.includes("障害")) continue;
    // タマツバキ記念はisArabフラグが付かない旧書式のアラブのレース（README参照）。
    if (r.name.includes("タマツバキ")) continue;

    const { name: nameNoGrade, grade: parsedGrade } = stripGrade(r.name);
    const trialFor = extractTrialTarget(nameNoGrade);
    const fixedName = resolveFixedName(nameNoGrade, trialFor);
    parsed.push({ r, nameNoGrade, parsedGrade, trialFor, fixedName });
  }

  // ②本番（`fixedName`が解決したレース）の、この年の史実の日付を集める。
  const fixedDateByName = new Map();
  for (const p of parsed) {
    if (p.fixedName) fixedDateByName.set(p.fixedName, p.r.date);
  }

  for (const { r, nameNoGrade, parsedGrade, trialFor, fixedName } of parsed) {
    const [y, m, d] = r.date.split("-").map(Number);
    let week;
    let courseId;
    if (fixedName) {
      week = FIXED_G1_WEEK[fixedName];
      courseId = FIXED_G1_COURSE[fixedName];
    } else {
      // ⭐トライアルは、本番からの史実の間隔で週を逆算する（`trialWeekFromTarget`）。
      // 本番のデータがこの年に無い、あるいはトライアル以外の一般の重賞は、
      // 従来どおり史実の日付をそのまま週に変換する。
      week = (trialFor && trialWeekFromTarget(trialFor, r.date, fixedDateByName)) ?? weekOfYearFromDate(y, m, d);
      const historicalCourseId = findCourseByName(r.course);
      if (!historicalCourseId) {
        skippedNoCourse += 1;
        continue;
      }
      courseId = resolveMeetingCourse(historicalCourseId, week);
    }

    // ⚠️IDは`bareName`（トライアル注記を落とした名前）ではなく`nameNoGrade`から作る。
    // 「天皇賞（春）」「天皇賞（秋）」のように季節の注記だけが違う同名異レースがあり、
    // `bareName`まで落とすと年内でIDが衝突する（2026-09-15・build時に発見・修正）。
    races.push({
      id: `${year}-${nameNoGrade.replace(/[\s（）]/g, "")}`,
      name: nameNoGrade,
      grade: year >= 1984 ? parsedGrade : null, // グレードは1984年から出す
      week,
      courseId,
      surface: r.surface, // "turf" | "dirt"
      distance: r.distance,
      prize1: r.prize1 ?? null,
      trialFor,
      fillyOnly: isFillyOnly(r.condition),
      condition: r.condition ?? null,
      historicalDate: r.date,
      historicalCourse: r.course,
    });
  }

  if (skippedNoCourse) {
    console.log(`  ${year}: 競馬場名を解決できず${skippedNoCourse}本を除外`);
  }
  return races;
}

// `src/data/gradedRacesByYear.js`（読み込み口）を、実際にある年ぶんのJSONから作り直す。
// ⚠️`import.meta.glob`のようなVite専用の仕組みは使わない——`data/`はNode単体で読める
// ことを保つ規律（CLAUDE.md §5）があるため、素のstatic importを年ぶん列挙する。
function writeLoader(years, outDir) {
  const lines = [
    "// `tools/build-graded-races.mjs`が作る。手で書き足さない。",
    "// 年ごとの重賞データを、素のstatic import（Node単体でもVite単体でも読める形）で束ねる。",
    "",
  ];
  for (const year of years) {
    lines.push(`import gradedRaces${year} from "./generated/gradedRaces.${year}.json" with { type: "json" };`);
  }
  lines.push("", "export const GRADED_RACES_BY_YEAR = Object.freeze({");
  for (const year of years) lines.push(`  ${year}: gradedRaces${year},`);
  lines.push("});", "");
  lines.push("/** その年の重賞データ。無ければ空配列。 */");
  lines.push("export function gradedRacesForYear(year) {");
  lines.push("  return GRADED_RACES_BY_YEAR[year] ?? [];");
  lines.push("}");
  lines.push("");
  lines.push("/** その年のデータを取得済みかどうか。 */");
  lines.push("export function hasGradedRaceData(year) {");
  lines.push("  return GRADED_RACES_BY_YEAR[year] != null;");
  lines.push("}");
  lines.push("");
  writeFileSync(path.join(ROOT, "src/data/gradedRacesByYear.js"), lines.join("\n"));
}

function main() {
  const [startArg, endArg] = process.argv.slice(2);
  const start = Number(startArg) || 1974;
  const end = Number(endArg) || start;
  const outDir = path.join(ROOT, "src/data/generated");
  mkdirSync(outDir, { recursive: true });

  const index = {};
  for (let year = start; year <= end; year += 1) {
    const races = buildYear(year);
    if (races == null) continue;
    const outPath = path.join(outDir, `gradedRaces.${year}.json`);
    writeFileSync(outPath, JSON.stringify(races, null, 1));
    index[year] = races.length;
    console.log(`${year}: ${races.length}本 → ${path.relative(ROOT, outPath)}`);
  }

  // 既にある年ぶん全部（今回の範囲外も含む）を数え直し、読み込み口を作り直す。
  const existingYears = existsSync(outDir)
    ? readdirSync(outDir)
        .map((f) => f.match(/^gradedRaces\.(\d{4})\.json$/))
        .filter(Boolean)
        .map((m) => Number(m[1]))
        .sort((a, b) => a - b)
    : [];
  writeLoader(existingYears, outDir);
  console.log(`gradedRacesByYear.js を作り直した（${existingYears.length}年ぶん）`);

  // 索引も既にある年ぶん全部で作り直す（今回の範囲だけで上書きすると他の年が消える）。
  const fullIndex = {};
  for (const year of existingYears) {
    fullIndex[year] = index[year] ?? JSON.parse(readFileSync(path.join(outDir, `gradedRaces.${year}.json`), "utf8")).length;
  }
  writeFileSync(path.join(outDir, "gradedRaces.index.json"), JSON.stringify(fullIndex, null, 1));
  console.log("index:", fullIndex);
}

main();
