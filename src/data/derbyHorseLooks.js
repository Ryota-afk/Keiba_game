// 日本ダービー歴代優勝馬51頭の見た目（毛色・白い模様）。リテラルのみ（JSX・ロジック無し）。
// 馬名は`derbyWinners.js`の`horse`と同一。毛色IDは`coat.js`の`COAT_IDS`と同じ。
//
// ⚠️⚠️このファイルの内容は、Wikipediaの記事から取った値を含むため、出典元のライセンスを
// そのまま引き継ぐ。このファイル1つだけがその対象で、他の`src/`ファイルには及ばない。
//
// 出典（承認済みの2つだけ。`design/rights-check.md`）：
//   (1) Wikipedia日本語版 各馬の記事のinfobox「色」「斑」欄
//       https://ja.wikipedia.org/wiki/<馬名>（同名の別項目がある馬は「<馬名> (競走馬)」）
//   (2) 優駿達の蹄跡（アホヌラゲーム館）各馬のページの「毛色」
//       https://www.ahonoora.com/
//   取得日：2026-11-28
//   毛色は(1)(2)で全51頭が一致（不一致0件）。(1)に「色」欄が無い場合は(2)で補う。
// ライセンス：クリエイティブ・コモンズ 表示-継承 4.0 国際 (CC BY-SA 4.0)
//   https://creativecommons.org/licenses/by-sa/4.0/deed.ja
//
// markings：Wikipediaのinfobox「斑」欄が空でない馬だけ文字列（脚注・リンク記法を除いた本文）。空なら null。
// 「（顔）」は顔の白斑、「（他）」は顔以外の白斑。

export const DERBY_HORSE_LOOKS = {
  "コーネルランサー": { coat: "chestnut", markings: null },
  "カブラヤオー": { coat: "darkBay", markings: null },
  "クライムカイザー": { coat: "darkBay", markings: null },
  "ラッキールーラ": { coat: "darkBay", markings: null },
  "サクラショウリ": { coat: "bay", markings: null },
  "カツラノハイセイコ": { coat: "darkBay", markings: null },
  "オペックホース": { coat: "chestnut", markings: null },
  "カツトップエース": { coat: "liverChestnut", markings: null },
  "バンブーアトラス": { coat: "bay", markings: null },
  "ミスターシービー": { coat: "darkBay", markings: null },
  "シンボリルドルフ": { coat: "bay", markings: null },
  "シリウスシンボリ": { coat: "bay", markings: null },
  "ダイナガリバー": { coat: "bay", markings: null },
  "メリーナイス": { coat: "chestnut", markings: null },
  "サクラチヨノオー": { coat: "bay", markings: null },
  "ウィナーズサークル": { coat: "gray", markings: null },
  "アイネスフウジン": { coat: "darkBay", markings: null },
  "トウカイテイオー": { coat: "bay", markings: null },
  "ミホノブルボン": { coat: "chestnut", markings: "（顔）流星鼻梁白断鼻小白・珠目上（他）右髪中・初地・右後一白" },
  "ウイニングチケット": { coat: "darkBay", markings: null },
  "ナリタブライアン": { coat: "darkBay", markings: "星額刺毛鼻梁鼻白・珠目上" },
  "タヤスツヨシ": { coat: "darkBay", markings: null },
  "フサイチコンコルド": { coat: "bay", markings: null },
  "サニーブライアン": { coat: "bay", markings: null },
  "スペシャルウィーク": { coat: "darkBay", markings: null },
  "アドマイヤベガ": { coat: "bay", markings: null },
  "アグネスフライト": { coat: "chestnut", markings: null },
  "ジャングルポケット": { coat: "bay", markings: null },
  "タニノギムレット": { coat: "bay", markings: null },
  "ネオユニヴァース": { coat: "bay", markings: null },
  "キングカメハメハ": { coat: "bay", markings: null },
  "ディープインパクト": { coat: "bay", markings: null },
  "メイショウサムソン": { coat: "bay", markings: "（顔）額鼻梁刺毛鼻梁白鼻大白上唇大白（他）右前小白、右後一白" },
  "ウオッカ": { coat: "bay", markings: null },
  "ディープスカイ": { coat: "chestnut", markings: null },
  "ロジユニヴァース": { coat: "bay", markings: null },
  "エイシンフラッシュ": { coat: "darkBay", markings: null },
  "オルフェーヴル": { coat: "chestnut", markings: null },
  "ディープブリランテ": { coat: "bay", markings: null },
  "キズナ": { coat: "brown", markings: null },
  "ワンアンドオンリー": { coat: "darkBay", markings: null },
  "ドゥラメンテ": { coat: "bay", markings: null },
  "マカヒキ": { coat: "bay", markings: null },
  "レイデオロ": { coat: "bay", markings: null },
  "ワグネリアン": { coat: "bay", markings: null },
  "ロジャーバローズ": { coat: "bay", markings: null },
  "コントレイル": { coat: "brown", markings: null },
  "シャフリヤール": { coat: "darkBay", markings: null },
  "ドウデュース": { coat: "bay", markings: null },
  "タスティエーラ": { coat: "bay", markings: null },
  "ダノンデサイル": { coat: "chestnut", markings: null },
};
