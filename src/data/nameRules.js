// 卒業式の名前入力（姓・名）で許可する文字の判定。CLAUDE.md §5に従い、
// リテラルと純関数だけを置く（JSX・外部状態を参照しない）。
//
// ⚠️フォントが実際にその字を持っているかは検査しない（端末ごとに搭載フォントが
// 違い、当てにならないと確認済み）。Unicodeのコードポイント範囲だけで判定する。
//
// ⚠️JavaScriptの文字列はUTF-16。サロゲートペア（U+FFFFを超える文字、𠮷など）を
// 1文字と誤って数えないよう、この2関数は必ず「コードポイント単位」で扱うこと。

export const MAX_FAMILY_NAME = 4;
export const MAX_GIVEN_NAME = 4;

/**
 * 1コードポイントが名前に使ってよい文字かどうかを判定する。
 * @param {string} ch - 1コードポイント分の文字（サロゲートペアなら2 UTF-16単位）
 * @returns {boolean}
 */
export function isAllowedNameChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;

  // サロゲートペア（U+10000以上）はここで一括して弾く。「𠮷」等の人名用漢字も
  // 含まれるが、フォント依存の表示崩れを避けるため対象外とする。
  if (cp > 0xffff) return false;

  // U+3005「々」：踊り字。「佐々木」など人名で頻出するが、CJK統合漢字の範囲
  // （U+4E00–U+9FFF）に含まれないため、個別に許可しないと弾かれてしまう。
  if (cp === 0x3005) return true;

  // ひらがな U+3041–U+309F
  if (cp >= 0x3041 && cp <= 0x309f) return true;

  // カタカナ U+30A1–U+30FF（長音記号ー U+30FC、小書きのケ「ヶ」U+30F6を含む。
  // 「サトウ」のウ、「渋谷区千駄ヶ谷」のような地名由来の人名で使われる）
  if (cp >= 0x30a1 && cp <= 0x30ff) return true;

  // CJK統合漢字 U+4E00–U+9FFF：常用漢字・人名用漢字の大半はここに入る
  if (cp >= 0x4e00 && cp <= 0x9fff) return true;

  // CJK互換漢字 U+FA00–U+FA6D：「﨑」（山﨑の﨑・U+FA11）など、統合漢字に
  // 正規化されない人名用の異体字がここに入っている
  if (cp >= 0xfa00 && cp <= 0xfa6d) return true;

  return false;
}

/**
 * 許可されない文字を取り除き、コードポイント単位でmax文字までに切る。
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
export function sanitizeName(value, max) {
  const chars = [...value].filter(isAllowedNameChar);
  return chars.slice(0, max).join("");
}
