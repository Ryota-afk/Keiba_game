// 優駿達の蹄跡の結果表（`data-src/ahonoora/YYYY.json.gz`）から、ゲーム用の重賞データを作る。
// ⚠️正本の決め方は`arch/race-program.md`§1・`devlog/wave07.md`「質問20・21」。
//
// 手順（1年ぶんにつき）：
//   1. 障害・アラブ・解析に失敗した行を除く（`isJumpRace`：surface=jump／名前に「障害」「ジャンプ」／
//      （Ｊ・G…）／見出しの「m（障害」。除外した本数は年ごとにログに出す）
//   2. 名前の (GI)/(GII)/(GIII)・(JpnI〜III)（2007〜）を切り離してgradeにする（名前の途中にあってもよい）。
//      ⚠️グレードは1984年から画面に出す（G表記そのものは今回も1984年以降にしか付いていない）
//   3. 名前の「（〜トライアル）」からトライアル対応表を作る（質問15）。入れ子のかっこも読み、
//      対象は`FIXED_G1_WEEK`のキーへ名寄せする（オークス→優駿牝馬・ダービー→東京優駿・ＮＨＫ→NHK）
//   4. 週を決める：平地G1・24本の固定名に一致し、**かつその年にG1だった**（1984年から＝解析したグレードがg1、
//      1983年まで＝1984年にG1だった名前）なら`FIXED_G1_WEEK`の週と、その週の同じ枠の競馬場
//      （`FIXED_G1_COURSE`）を使う（2026-10-13・`devlog/wave12.md`§27）。G2以下だった年は、名前が同じでも
//      その年の実際の日付で置く。トライアル（`trialFor`を持つレース）は、
//      本番からの史実の日数の間隔を週数に丸め、本番の固定週からその週数ぶん引いた週に置く
//      （`trialWeekFromTarget`。⭐2026-09-24追加・`devlog/wave11.md`§15「訂正：京都新聞杯と
//      菊花賞が同じ週」）。それ以外の一般の重賞は実際の日付から週を出す。
//      競馬場はその週に開いていなければ同じ地区の開いている場へ移す（質問21＝(ア)）。
//   5. 牝馬限定かどうかを条件欄（「牝」を含み「牡」を含まない）から決める。
//   6. 1着賞金が読めない旧書式の平地の重賞は、同名の一番近い年の値を賞金の中央値の比で換算して埋める（`prize1Estimated: true`）。
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

// 史実の名前ゆれ→現行名（`FIXED_G1_WEEK`のキー）への対応。「接頭辞を外す」「そのまま」のどちらでも
// 解決しない、名前そのものが変わった重賞だけ載せる（`devlog/wave06.md`の実測「名前が違う」表）。
// ⚠️「報知杯 阪神4歳牝馬特別」は阪神JFの旧名ではない——毎年3月に走る桜花賞トライアルの名前で、
// 実際の阪神JFの旧名は「阪神3歳ステークス」（〜1990・牡牝混合）→「阪神3歳牝馬ステークス」（1991〜2000）。
// ⚠️**この表は「その年にG1だったとき」にしか効かない**（`isG1ThisYear`・2026-10-13）。高松宮杯は
// 1995年までG2（7月・中京2000m）で、その年は別名にせず、その年の日付で置く。
const HISTORICAL_NAME_ALIASES = {
  "高松宮杯": "高松宮記念",
  "阪神3歳ステークス": "阪神ジュベナイルフィリーズ",
  "阪神3歳牝馬ステークス": "阪神ジュベナイルフィリーズ",
  "朝日杯3歳ステークス": "朝日杯フューチュリティステークス",
  "産経大阪杯": "大阪杯",
  "サンケイ大阪杯": "大阪杯",
};

// 賞金団体名・記念冠など、本体の名前の前に付く「外してよい接頭辞」（空白で区切られていないもの）。
// ⚠️`.includes()`のような部分一致は使わない——「京王杯スプリンターズステークス」が
// 「スプリンターズステークス」を部分文字列に含んでしまうような、無関係の別レースを
// 誤って同一視する事故を避けるため、常に「接頭辞を取り除いた残り全体」の完全一致で確かめる。
// 空白で区切られた前置き（「日本中央競馬会創立50周年記念 天皇賞（秋）」「悠仁親王殿下御誕生慶祝 天皇賞（秋）」
// 「農林水産省賞典 〜」など）は、`candidateNames`が「後ろのまとまりだけ」を全部試すので載せなくてよい。
const REMOVABLE_PREFIXES = ["サンケイ"];

// 末尾に付く「愛称の（〜）」で、本体の名前とは別に確定週の名寄せに使わないもの
// （東京優駿（日本ダービー）→東京優駿、優駿牝馬（オークス）→優駿牝馬、有馬記念（グランプリ）→有馬記念）。
const REMOVABLE_SUFFIXES = [/（オークス）$/, /（日本ダービー）$/, /（グランプリ）$/];

/** トライアルの対象の愛称→`FIXED_G1_WEEK`のキー。それ以外は名寄せ後の文字列がそのまま対象名になる。 */
const TRIAL_TARGET_ALIASES = {
  "オークス": "優駿牝馬",
  "ダービー": "東京優駿",
  "日本ダービー": "東京優駿",
};

const FULLWIDTH_ALNUM = /[Ａ-Ｚａ-ｚ０-９]/g;
/** 全角の英数字だけを半角にする（ＮＨＫマイルカップ→NHKマイルカップ）。かっこ・カナは触らない。 */
function halfWidthAlnum(s) {
  return s.replace(FULLWIDTH_ALNUM, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 名寄せ用の鍵：互換正規化（全角英数→半角・半角かな→全角）→かっこを全角に→空白を1つに。 */
function matchKey(s) {
  return s
    .normalize("NFKC")
    .replace(/\(/g, "（")
    .replace(/\)/g, "）")
    .replace(/\s+/g, " ")
    .trim();
}

// グレード表記：(GI)(GII)(GIII)・(JpnI)(JpnII)(JpnIII)（2007〜）・(Ｊ・GI)…（障害・1999〜）。
// 半角・全角かっこの両方があり、名前の途中にも現れる（「サファイヤステークス (GIII) （エリザベス女王杯トライアル）」）。
const GRADE_RE = /[（(]\s*(?:[ＪJ]・)?(GI{1,3}|JpnI{1,3})\s*[）)]/;
const GRADE_MAP = { GI: "g1", GII: "g2", GIII: "g3", JpnI: "g1", JpnII: "g2", JpnIII: "g3" };

function stripGrade(rawName) {
  const m = rawName.match(GRADE_RE);
  if (!m) return { name: rawName.replace(/\s+/g, " ").trim(), grade: null };
  const name = (rawName.slice(0, m.index) + " " + rawName.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  return { name, grade: GRADE_MAP[m[1]] };
}

/**
 * 障害（ゲームに出さない）か。次のどれかなら障害：
 *  ①`surface === "jump"`（parse.pyが見出しの「芝3930m（障害）」から付ける）②名前に「障害」③名前に「ジャンプ」
 *  ④グレードが（Ｊ・G…）⑤見出しに「m（障害」。⚠️1999年から障害の重賞は「小倉サマージャンプ」のように
 *  名前に「障害」を含まない（2026-10-13）。
 */
function isJumpRace(r) {
  const name = r.name ?? "";
  return (
    r.surface === "jump" ||
    name.includes("障害") ||
    name.includes("ジャンプ") ||
    /[ＪJ]・G/.test(name) ||
    /m\s*（\s*障害/.test(r.raw_head ?? "")
  );
}

/**
 * 「（〜トライアル）」の〜を取り出す。入れ子のかっこ（「（天皇賞（秋）トライアル）」）も読む。
 * 名寄せ（全角英数→半角・愛称→正式名）して返す。無ければnull。
 */
function extractTrialTarget(name) {
  const s = name.replace(/\(/g, "（").replace(/\)/g, "）");
  const marker = "トライアル）";
  const i = s.indexOf(marker);
  if (i < 0) return null;
  let depth = 1; // 閉じかっこ（marker末尾）の分
  for (let j = i - 1; j >= 0; j -= 1) {
    if (s[j] === "）") depth += 1;
    else if (s[j] === "（") {
      depth -= 1;
      if (depth === 0) {
        const inner = matchKey(s.slice(j + 1, i));
        return TRIAL_TARGET_ALIASES[inner] ?? inner;
      }
    }
  }
  return null;
}

function isFillyOnly(condition) {
  if (!condition) return false;
  return condition.includes("牝") && !condition.includes("牡");
}

/**
 * トライアルの週を、本番（`FIXED_G1_WEEK`固定）から逆算する
 * （`devlog/wave11.md`§15「訂正：京都新聞杯と菊花賞が同じ週」の直し）。
 * ⚠️**なぜ必要か**：本番G1は史実の日付を無視して`FIXED_G1_WEEK`の固定週に置くが、
 * トライアルは史実の日付をそのまま`weekOfYearFromDate`に通していた。年によっては
 * 本番の史実の日付が現行の固定週より遅く、その差の分だけトライアルの週が本番の週に
 * 追いつき、同じ週（1976〜1978・1983・1984年）や本番より後（1972年の4組）になっていた。
 * ここでは「トライアルは本番の何日前に走ったか」という史実の**間隔**だけを使い、
 * 本番の固定週からその週数ぶん引いた週に置き直す——本番の史実の日付そのものは使わない。
 * @param {string} trialFor - トライアルの`trialFor`（`FIXED_G1_WEEK`のキーに名寄せ済み。例："菊花賞"）
 * @param {string} trialDate - トライアルの史実の日付（"YYYY-MM-DD"）
 * @param {Map<string, string>} fixedDateByName - その年にG1だった`FIXED_G1_WEEK`のキー→その年の史実の日付
 * @returns {number|null} 求まらなければ`null`（呼び出し側が`weekOfYearFromDate`へ後退する）
 */
function trialWeekFromTarget(trialFor, trialDate, fixedDateByName) {
  const targetWeek = FIXED_G1_WEEK[trialFor];
  const targetDate = fixedDateByName.get(trialFor);
  if (targetWeek == null || !targetDate) return null; // この年に本番がG1として無い（保険）
  const [ty, tm, td] = targetDate.split("-").map(Number);
  const [ry, rm, rd] = trialDate.split("-").map(Number);
  const gapDays = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(ry, rm - 1, rd)) / 86_400_000
  );
  const weeksBefore = Math.max(1, Math.round(gapDays / 7)); // 同じ週・後の週にしない
  return targetWeek - weeksBefore;
}

/**
 * 名前から「`FIXED_G1_WEEK`のキー候補」を作る。完全一致だけで確かめる（部分一致は使わない）：
 * 名寄せ（`matchKey`）→末尾の愛称かっこを外した形→それぞれについて「空白で区切られた後ろのまとまり」を全部
 * （「日本中央競馬会創立50周年記念 天皇賞（秋）」→「天皇賞（秋）」）→空白の無い接頭辞を外した形。
 */
function candidateNames(nameNoGrade) {
  const key = matchKey(nameNoGrade);
  const bases = [key];
  for (const suffix of REMOVABLE_SUFFIXES) {
    if (suffix.test(key)) bases.push(key.replace(suffix, ""));
  }
  const out = [];
  for (const base of bases) {
    const tokens = base.split(" ");
    for (let i = 0; i < tokens.length; i += 1) {
      const tail = tokens.slice(i).join(" ");
      out.push(tail);
      for (const prefix of REMOVABLE_PREFIXES) {
        if (tail.startsWith(prefix)) out.push(tail.slice(prefix.length));
      }
    }
  }
  return out;
}

/**
 * 名前が現行のG1の名前（`FIXED_G1_WEEK`のキー）のどれかか。トライアルは対象外。
 * ⚠️これは「名前が合うか」だけ。その年にG1だったかは`isG1ThisYear`が決める。
 * @returns {string|null} `FIXED_G1_WEEK`のキー
 */
function resolveFixedName(nameNoGrade, trialFor) {
  if (trialFor) return null;
  for (const candidate of candidateNames(nameNoGrade)) {
    if (FIXED_G1_WEEK[candidate] != null) return candidate;
    if (HISTORICAL_NAME_ALIASES[candidate] != null) return HISTORICAL_NAME_ALIASES[candidate];
  }
  return null;
}

// ---- 年ごとの元データ（キャッシュ）-----------------------------------------------------------
const rawCache = new Map();
function loadRaw(year) {
  if (rawCache.has(year)) return rawCache.get(year);
  const gzPath = path.join(ROOT, "data-src/ahonoora", `${year}.json.gz`);
  const raw = existsSync(gzPath) ? JSON.parse(gunzipSync(readFileSync(gzPath)).toString("utf-8")) : null;
  rawCache.set(year, raw);
  return raw;
}

/** 解析に失敗した行（日付・競馬場・距離・名前のどれかが無い）。例外にせず除外して数える。 */
function isBrokenRow(r) {
  return !r.name || !r.date || !r.course || !r.distance || r.parse_error != null;
}

/** 平地のサラブレッドの重賞か（アラブ・障害・解析失敗を除いたもの）。 */
function isFlatThoroughbred(r) {
  if (isBrokenRow(r) || r.isArab || isJumpRace(r)) return false;
  // タマツバキ記念はisArabフラグが付かない旧書式のアラブのレース（README参照）。
  return !r.name.includes("タマツバキ");
}

// 1984年より前は格付けが無い。「その年にG1だったか」は、1984年にG1だった名前で代用する
// （皐月賞・ダービー・天皇賞・有馬記念…は1984年にG1。高松宮杯・スプリンターズSは1984年はG2・G3）。
let g1At1984 = null;
function g1NamesAt1984() {
  if (g1At1984) return g1At1984;
  g1At1984 = new Set();
  for (const r of loadRaw(1984) ?? []) {
    if (!isFlatThoroughbred(r)) continue;
    const { name, grade } = stripGrade(r.name);
    if (grade !== "g1") continue;
    const fixed = resolveFixedName(name, extractTrialTarget(name));
    if (fixed) g1At1984.add(fixed);
  }
  return g1At1984;
}

/**
 * ⭐その年に、その名前のレースがG1だったか（2026-10-13・ユーザー決定`devlog/wave12.md`§27）。
 * G1だった年だけ今の週・競馬場（`FIXED_G1_WEEK`／`FIXED_G1_COURSE`）に置き、G2以下の年は
 * その年の実際の日付から置く。1984年から：解析したグレードがg1か。1983年まで：1984年にG1だったか。
 */
function isG1ThisYear(year, fixedName, parsedGrade) {
  return year >= 1984 ? parsedGrade === "g1" : g1NamesAt1984().has(fixedName);
}

/** その年の平地の重賞の1着賞金の中央値（賞金の物価の目安。年を越えて同名のレースの賞金を換算するのに使う）。 */
function medianPrize1(year) {
  const v = (loadRaw(year) ?? [])
    .filter((r) => r.prize1 != null && isFlatThoroughbred(r))
    .map((r) => r.prize1)
    .sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

/**
 * 1着賞金が見出しから読めなかった（旧書式のページ）平地の重賞は、同じ名前のレースの前後の年のうち
 * 一番近い年の値を、2つの年の賞金の中央値の比で換算して埋める（100万円単位に丸める）。
 * ⚠️近い年の値をそのまま使うと、1972年の賞金（中央値1,000万円）に1983年の2,600万円が入る。
 * 埋めたレースには`prize1Estimated: true`を付ける。同名の年が無ければnull。
 */
function estimatePrize1(nameKey, year) {
  for (let d = 1; d <= 20; d += 1) {
    for (const y of [year - d, year + d]) {
      for (const r of loadRaw(y) ?? []) {
        if (r.prize1 == null || !isFlatThoroughbred(r)) continue;
        if (matchKey(stripGrade(r.name).name) !== nameKey) continue;
        const here = medianPrize1(year);
        const there = medianPrize1(y);
        const scaled = here && there ? r.prize1 * (here / there) : r.prize1;
        return Math.round(scaled / 1_000_000) * 1_000_000;
      }
    }
  }
  return null;
}

// 出典のページに格付けが書かれていない（が、実際にはG3として行われた）年。1998年の共同通信杯は
// 雪で芝からダートに替えて行われ、結果表の名前にだけ「(GIII)」が無い（前年・翌年は(GIII)）。
const GRADE_OVERRIDES = {
  "1998:共同通信杯4歳ステークス（トキノミノル記念）": "g3",
};

/** 直近の`buildYear`が除外した本数（ログ用）。 */
const lastExcluded = { jump: 0, arab: 0, broken: 0 };

function buildYear(year) {
  const raw = loadRaw(year);
  if (raw == null) {
    console.log(`  skip ${year}（data-src/ahonoora/${year}.json.gz が無い）`);
    return null;
  }
  const races = [];
  let skippedNoCourse = 0;
  lastExcluded.jump = 0;
  lastExcluded.arab = 0;
  lastExcluded.broken = 0;

  // ①1回目の通し：名前・グレード・トライアル対応だけを解決する（週はまだ決めない）。
  // ⚠️トライアルの週（②）が本番の史実の日付を必要とするため、本番側を先に全部
  // 解決してからでないとトライアル側を計算できない——1回のループでは順不同になる。
  const parsed = [];
  for (const r of raw) {
    if (isBrokenRow(r)) {
      lastExcluded.broken += 1;
      console.log(`  ${year}: 解析できない行を除外 ${r.file}（${r.parse_error ?? "欠けた項目"}）`);
      continue;
    }
    if (isJumpRace(r)) {
      lastExcluded.jump += 1;
      continue;
    }
    if (r.isArab || r.name.includes("タマツバキ")) {
      lastExcluded.arab += 1;
      continue;
    }

    const stripped = stripGrade(r.name);
    const nameNoGrade = stripped.name;
    const parsedGrade = stripped.grade ?? GRADE_OVERRIDES[`${year}:${matchKey(nameNoGrade)}`] ?? null;
    const trialFor = extractTrialTarget(nameNoGrade);
    const candidateFixedName = resolveFixedName(nameNoGrade, trialFor);
    // ⭐G1だった年だけ今の週・競馬場を使う。そうでない年はfixedNameをnullにして普通の重賞として置く。
    const fixedName =
      candidateFixedName && isG1ThisYear(year, candidateFixedName, parsedGrade) ? candidateFixedName : null;
    parsed.push({ r, nameNoGrade, parsedGrade, trialFor, fixedName });
  }

  // ②本番（`fixedName`が解決したレース）の、この年の史実の日付を集める。
  const fixedDateByName = new Map();
  for (const p of parsed) {
    if (!p.fixedName) continue;
    if (fixedDateByName.has(p.fixedName)) {
      console.log(`  ${year}: 「${p.fixedName}」に当たるレースが2本ある（${p.r.name}）`);
      p.fixedName = null; // 先に見つけた方だけを固定週に置く
      continue;
    }
    fixedDateByName.set(p.fixedName, p.r.date);
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

    // ⚠️IDは`bareName`（トライアル注記を落とした名前）ではなく名前そのものから作る。
    // 「天皇賞（春）」「天皇賞（秋）」のように季節の注記だけが違う同名異レースがあり、
    // `bareName`まで落とすと年内でIDが衝突する（2026-09-15・build時に発見・修正）。
    const name = halfWidthAlnum(nameNoGrade);
    let prize1 = r.prize1 ?? null;
    let prize1Estimated = false;
    if (prize1 == null) {
      prize1 = estimatePrize1(matchKey(nameNoGrade), year);
      prize1Estimated = prize1 != null;
    }
    races.push({
      id: `${year}-${name.replace(/[\s（）]/g, "")}`,
      name,
      grade: year >= 1984 ? parsedGrade : null, // グレードは1984年から出す
      week,
      courseId,
      surface: r.surface, // "turf" | "dirt"
      distance: r.distance,
      prize1,
      ...(prize1Estimated ? { prize1Estimated: true } : {}),
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
    const g1 = races.filter((r) => r.grade === "g1").length;
    console.log(
      `${year}: ${races.length}本（G1 ${g1}）／除外 障害${lastExcluded.jump}・アラブ${lastExcluded.arab}・解析失敗${lastExcluded.broken} → ${path.relative(ROOT, outPath)}`
    );
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
