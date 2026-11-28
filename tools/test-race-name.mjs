// レース名を短くする決まり（`src/view/raceNameView.js`）のテスト（`devlog/wave13b.md`§35）。
// 重賞データ（1972〜2024年）に出てくる名前すべてに通し、全件の「前 → 後」を見られるようにする。
// 使い方： node --test tools/test-race-name.mjs   （または npm test）
//          node tools/test-race-name.mjs --list  で全件の「前 → 後」を出す
import { test } from "node:test";
import assert from "node:assert/strict";
import { GRADED_RACES_BY_YEAR } from "../src/data/gradedRacesByYear.js";
import { shortRaceName } from "../src/view/raceNameView.js";

const NAMES = [...new Set(Object.values(GRADED_RACES_BY_YEAR).flatMap((races) => races.map((r) => r.name)))].sort();

if (process.argv.includes("--list")) {
  for (const n of NAMES) console.log(`${n} → ${shortRaceName(n)}`);
}

test("ユーザーが決めた例のとおりに短くなる", () => {
  const cases = {
    "フジテレビ賞 スプリングステークス （皐月賞トライアル）": "スプリングステークス",
    "報知杯 弥生賞 （皐月賞トライアル）": "弥生賞",
    "農林水産省賞典 安田記念": "安田記念",
    "第50回日本ダービー記念 NHK杯": "NHK杯",
    "東京優駿（日本ダービー）": "東京優駿（日本ダービー）",
    "優駿牝馬（オークス）": "優駿牝馬（オークス）",
    "天皇賞（春）": "天皇賞（春）",
    "共同通信杯（トキノミノル記念）": "共同通信杯（トキノミノル記念）",
    // 冠が2つ・記念の添え名つき
    "東北関東大震災 被災地支援競馬 スプリングステークス （皐月賞トライアル）": "スプリングステークス",
    "JRA創立40周年記念 産経賞 オールカマー": "オールカマー",
    "農林水産省賞典 安田伊左衛門生誕150周年記念 安田記念": "安田記念",
    "皇太子殿下御成婚奉祝 東京優駿（日本ダービー）": "東京優駿（日本ダービー）",
    "敬宮愛子親王殿下御誕生慶祝 有馬記念（グランプリ）": "有馬記念（グランプリ）",
    "スポーツニッポン賞 金杯（西）": "金杯（西）",
    "農林省賞典 京都記念（春）": "京都記念（春）",
    "NHK賞 きさらぎ賞": "きさらぎ賞",
    "東海テレビ杯 金鯱賞": "金鯱賞",
    "デイリー杯 クイーンカップ": "クイーンカップ",
    "読売 スプリンターズステークス": "スプリンターズステークス",
    // 「賞」「杯」で終わる名前・空白の無い名前は変えない
    "皐月賞": "皐月賞",
    "菊花賞": "菊花賞",
    "宝塚記念": "宝塚記念",
    "CBC賞": "CBC賞",
    "きさらぎ賞": "きさらぎ賞",
    "NHK杯": "NHK杯",
    "デイリー杯2歳ステークス": "デイリー杯2歳ステークス",
    "産経大阪杯": "産経大阪杯",
    "読売マイラーズカップ": "読売マイラーズカップ",
    // 数字で始まる名前は冠を1つ残す（冠を外すと別のレースと同じ名前になる）
    "サンケイスポーツ賞 4歳牝馬特別 （オークストライアル）": "サンケイスポーツ賞4歳牝馬特別",
    "報知杯 4歳牝馬特別 （桜花賞トライアル）": "報知杯4歳牝馬特別",
    "テレビ東京賞 3歳牝馬ステークス": "テレビ東京賞3歳牝馬ステークス",
    "報知杯 阪神4歳牝馬特別 （桜花賞トライアル）": "阪神4歳牝馬特別",
  };
  for (const [from, to] of Object.entries(cases)) {
    assert.ok(NAMES.includes(from), `重賞データにある名前：${from}`);
    assert.equal(shortRaceName(from), to);
  }
  assert.equal(shortRaceName(null), "");
  assert.equal(shortRaceName(""), "");
});

test("重賞データの名前すべて：空にならず、空白・トライアルの添え書きが残らず、元の名前の一部である", () => {
  assert.ok(NAMES.length >= 280, `名前の種類 ${NAMES.length}`);
  for (const n of NAMES) {
    const s = shortRaceName(n);
    assert.ok(s.length > 0, n);
    assert.ok(!/\s/.test(s), `空白が残っている：${n} → ${s}`);
    assert.ok(!/トライアル）/.test(s), `添え書きが残っている：${n} → ${s}`);
    assert.ok(n.replace(/\s+/g, "").includes(s), `元の名前に無い文字列：${n} → ${s}`);
    assert.equal(shortRaceName(s), s, `もう1度通しても変わらない：${s}`);
    if (!/\s/.test(n)) assert.equal(s, n, `空白の無い名前は変えない：${n}`);
  }
});

test("同じ年に、短くした名前が重なる別のレースは無い", () => {
  for (const [year, races] of Object.entries(GRADED_RACES_BY_YEAR)) {
    const seen = new Map();
    for (const r of races) {
      const s = shortRaceName(r.name);
      assert.ok(!seen.has(s), `${year}年：「${seen.get(s)}」と「${r.name}」がどちらも「${s}」になる`);
      seen.set(s, r.name);
    }
  }
});
