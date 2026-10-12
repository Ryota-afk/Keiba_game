// 架空馬の名前の語彙表（ARCHITECTURE.md §3「馬の名前」）。
// ⭐大口馬主だけ冠名を持つ（「冠名＋語幹」）。小口の馬は語幹の組み合わせ。
// ⚠️ここに挙げる語は全てこのゲームのために作った架空の語（実在の馬主・馬名の丸写しではない）。
// 語彙が少ないと同じ名前が並ぶため（devlog/wave01e.md A7）、実装が進んだら随時増やす。

// 大口馬主の冠名（例：「サンレイ○○」のように語幹の前に付く）。
export const OWNER_PREFIXES = Object.freeze([
  "サンレイ",
  "ヒシ",
  "コスモ",
  "タイセイ",
  "レイクロス",
  "アカネ",
  "オーロラ",
  "ゴールド",
  "セイウン",
  "フウリン",
  "ヤマト",
  "リュウジン",
]);

// 語幹（小口馬は2つ組み合わせる。大口馬主は冠名の後に1つだけ付く）。
export const NAME_STEMS = Object.freeze([
  "ウィング",
  "スター",
  "ライト",
  "ドリーム",
  "ヴィクトリー",
  "ブレイズ",
  "フェザー",
  "シャドウ",
  "サンダー",
  "ミスティ",
  "クレスト",
  "エコー",
  "インパクト",
  "パルス",
  "レガシー",
  "ノヴァ",
  "ブリーズ",
  "グロリア",
  "テンペスト",
  "オパール",
  // ⭐2026-10-12に153語を足した（`TODO.md` #120・`devlog/wave12.md`§28。ユーザー承認済みの一覧）。
  // 空・天気
  "シエロ", "ソレイユ", "ネーヴェ", "フロスト", "レインボー", "イリス", "ゲイル", "ストーム", "ヴェント", "ミストラル", "シロッコ", "ゼファー", "ラファーガ", "ホライズン", "アルバ",
  // 星・天体
  "ステラ", "エトワール", "アステル", "ルーナ", "セレーネ", "コメット", "ネビュラ", "ヘリオス", "プレアデス", "ミーティア",
  // 光・輝き
  "ルーチェ", "ルミエール", "シャイン", "グロウ", "スパーク", "プリズム", "ブリッツ", "グリント",
  // 海・水辺
  "マリン", "オーシャン", "マーレ", "オンダ", "ウェーブ", "タイド", "ラグーン", "ハーバー", "セイル", "ドルフィン",
  // 宝石・金属
  "ルビー", "トパーズ", "ガーネット", "アメジスト", "ジェイド", "コーラル", "スピネル", "ベリル", "アンバー", "オニキス", "ラピス", "ペリドット", "プラチナ", "シルバー", "コバルト", "ジュエル",
  // 花・植物
  "リリー", "ダリア", "カメリア", "マグノリア", "ジャスミン", "ラベンダー", "ミモザ", "フリージア", "ライラック", "ヴィオラ", "アネモネ", "ガーベラ", "オーキッド", "ブロッサム", "フィオーレ", "フルール", "オリーブ", "クローバー", "メイプル", "ウィロー",
  // 色
  "ネロ", "ビアンコ", "ロッソ", "アズール", "ヴェルデ", "ブラン", "ノワール", "シアン", "インディゴ", "クリムゾン",
  // 音楽
  "ソナタ", "ロンド", "ワルツ", "セレナーデ", "アリア", "ノクターン", "ボレロ", "メロディ", "ハーモニー", "カデンツァ", "ラプソディ", "バラード", "オペラ", "アレグロ", "プレスト", "ビバーチェ", "エチュード", "マエストロ", "ビート",
  // 速さ・力・勇気
  "ラピッド", "ダッシュ", "ジェット", "ロケット", "アロー", "ブレイブ", "ヴァラー", "フォルテ", "フォース", "マッハ", "ストライド", "ヴォラーレ", "チャージ", "アクセル", "スピリット", "ハート",
  // 神話・生きもの
  "タイタン", "アテナ", "ミネルバ", "グリフォン", "イーグル", "ホーク", "ウルフ",
  // ふつうの名詞・言葉
  "ランタン", "トロフィー", "ブーケ", "リボン", "コンパス", "ロマン", "ギフト", "エール", "グレイス", "パレード", "フェスタ", "ボヤージュ", "クエスト", "サーガ", "キャロル", "エンブレム", "バトン", "フラッグ", "エニグマ", "ベルベット", "ショコラ", "ミント",
]);

// JRAの規則：馬名は9文字以内（`Array.from(name).length`で数える。「ー」も小書きのカナも1文字）。
// 9文字を超える組み合わせは作らない（`generateHorseName`）。
export const HORSE_NAME_MAX_CHARS = 9;

// 重複しない名前が引けるまでに、乱数で引き直す回数の上限。これを超えたら全組み合わせを
// 順に調べる（下の`scanForUnused`）。⚠️上限を大きくするほど「空きがまばらなとき」の乱数消費が増える。
const MAX_RANDOM_ATTEMPTS = 50;

const nameLength = (name) => Array.from(name).length;

// 語幹の文字数（語彙は変わらないので、モジュールの読み込み時に1回だけ数える）。
// ⚠️名前を作るたびに`Array.from`で数えると、5,000頭の生成で目に見えて遅くなる。
const STEM_LENGTHS = NAME_STEMS.map(nameLength);

/**
 * 架空馬の名前を作る。自己完結の純関数（引数のみを参照。乱数は呼び出し側が渡す）。
 *
 * 規則（`arch/horse.md`「馬の名前」）：
 * - ⭐**9文字以内**（`HORSE_NAME_MAX_CHARS`）。超える組み合わせは候補から除く。
 * - ⭐`opts.usedNames`（現役馬と史実馬の名前の集合）にある名前は出さない。
 *   大口馬主の冠名つきは「冠名＋語幹」だけを候補にする。冠名が長くて入る語幹が1つも
 *   無い、または冠名＋語幹が全て使用済みのときは、冠名なしの「語幹＋語幹」へ落とす。
 * - 「語幹＋語幹」は同じ語幹どうしを組み合わせない。
 * - 乱数で最大`MAX_RANDOM_ATTEMPTS`回引き直し、それでも見つからなければ、乱数で決めた
 *   位置から全組み合わせを順に調べて最初の空きを返す（語彙が埋まりかけでも必ず空きを拾える）。
 * - ⚠️全組み合わせが使用済みのときだけ、9文字以内の使用済みの名前を返す（重複を許す）。
 *   9文字以内の組み合わせが1つも無い語彙のときは、最短の組み合わせを返す（規則違反）。
 *
 * `usedNames`は書き換えない（追加は呼び出し側＝`domain/horse.js`の`generateHorse`が行う）。
 * @param {() => number} rand01 - 0以上1未満の乱数を返す関数（呼び出し側のRNGを渡す）
 * @param {{ ownerPrefix?: string, usedNames?: Set<string> }} [opts] - 大口馬主の場合は冠名を渡す
 * @returns {string}
 */
export function generateHorseName(rand01, opts = {}) {
  const used = opts.usedNames;
  const pickIndex = (length) => Math.floor(rand01() * length) % length;
  const stems = NAME_STEMS;
  const n = stems.length;

  let duplicateOk = null; // 使用済みだが9文字以内の名前（最後の手段）
  let shortest = null; // 9文字以内が1つも無いときの最短の名前
  let shortestLength = Infinity;
  // 空いていればtrue。⚠️`len`は2つの部品の文字数の和（連結してもコードポイント数は変わらない）。
  const consider = (name, len) => {
    if (len <= HORSE_NAME_MAX_CHARS) {
      if (!used || !used.has(name)) return true;
      if (duplicateOk === null) duplicateOk = name;
    } else if (len < shortestLength) {
      shortest = name;
      shortestLength = len;
    }
    return false;
  };

  // 冠名つき：入る語幹だけを候補にする。
  const prefix = opts.ownerPrefix;
  if (prefix) {
    const prefixLength = nameLength(prefix);
    const fitting = [];
    for (let i = 0; i < n; i += 1) {
      if (prefixLength + STEM_LENGTHS[i] <= HORSE_NAME_MAX_CHARS) fitting.push(i);
    }
    if (fitting.length > 0) {
      for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt += 1) {
        const i = fitting[pickIndex(fitting.length)];
        const name = `${prefix}${stems[i]}`;
        if (consider(name, prefixLength + STEM_LENGTHS[i])) return name;
      }
      const offset = pickIndex(fitting.length);
      for (let k = 0; k < fitting.length; k += 1) {
        const i = fitting[(offset + k) % fitting.length];
        const name = `${prefix}${stems[i]}`;
        if (consider(name, prefixLength + STEM_LENGTHS[i])) return name;
      }
    }
    // 冠名つきが取れなければ、冠名なしの「語幹＋語幹」へ（下）。
  }

  // 語幹＋語幹（同じ語幹どうしは組まない）。
  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt += 1) {
    const a = pickIndex(n);
    const b = pickIndex(n);
    if (a === b) continue;
    const name = `${stems[a]}${stems[b]}`;
    if (consider(name, STEM_LENGTHS[a] + STEM_LENGTHS[b])) return name;
  }
  // 順に調べる：n×n通りを、乱数で決めた位置から1周する。
  const total = n * n;
  const start = pickIndex(total);
  for (let k = 0; k < total; k += 1) {
    const idx = (start + k) % total;
    const a = Math.floor(idx / n);
    const b = idx % n;
    if (a === b) continue;
    const name = `${stems[a]}${stems[b]}`;
    if (consider(name, STEM_LENGTHS[a] + STEM_LENGTHS[b])) return name;
  }
  return duplicateOk ?? shortest ?? `${stems[0]}${stems[n > 1 ? 1 : 0]}`;
}
