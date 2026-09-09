// 夢のダービー：実況文の全コーパス。
// ⚠️文言は変えない（CLAUDE.md §7）。2026-09-07（devlog/wave04.md §32）に、状況を見ず
// 無作為に引いていた形から、行ごとに「いつ出してよいか」の条件（`when`）を持つ形へ書き直した。
// 各行は{ text, when? }。`when`が無ければ常に候補（条件なし）。`when(vars)`は
// `view/dreamDerbyCommentary.js`の`commentaryVars`が返すオブジェクトだけを見て真偽を返す、
// 引数だけを参照する自己完結の述語関数（CLAUDE.md §5「引数だけを参照する自己完結の
// 小さな述語関数」）。文言そのものはFableが書きCLAUDE.md §7の基準で検査済みの確定稿を
// 一言一句そのまま転記（devlog/wave04.md §32の設計に基づく）。
// 往年の名実況のもじりの元ネタは design/meijikkyou-sources.md を参照（1本ずつ検証済み。
// 元ネタを確認できないものは入れていない）。

import { TRACK_NAME, STRAIGHT_LENGTH, STRAIGHT_HAS_HILL, THIRD_CORNER_HAS_HILL } from "./dreamDerbyCourse.js";

/** `vars.selfBand`が指定した区分のどれかに一致するか。 */
const bandIn = (vars, ...bands) => bands.includes(vars.selfBand);
/** 直近5秒で順位を3つ以上上げた馬（mover）がいるか。 */
const hasMover = (vars) => !!vars.moverName;
/** moverがいて、かつそれが自分の馬ではないか。 */
const moverIsOther = (vars) => !!vars.moverName && !vars.moverIsSelf;
/** moverがいて、かつそれが自分の馬か。 */
const moverIsSelf = (vars) => !!vars.moverName && !!vars.moverIsSelf;
/** 先頭と2番手の差が1馬身（2.4m）未満か（叩き合いの判定）。 */
const isCloseLead = (vars) => vars.leadGap2nd != null && vars.leadGap2nd < 2.4;

// ⚠️「第92回」は入れない（2026-09-08にユーザー決定・案A）。回数を書くと年が確定してしまい、
// タイトル画面で選んだ開始年と矛盾する。⚠️レース番号は**第11レース**——2024年・2025年の
// 日本ダービーはどちらも東京11R（JRA公式の結果ページで確認）。⭐2010年は10Rで、
// 実装当初の「第10レース」は古い年の値だった（2026-09-08にユーザーが指摘）。
/** レースの1行目の頭に置く記号。⭐この記号で始まる行だけ、画面側が
 * 「記号は最初から出す／続きの文字はぼやけた状態から浮かぶ」という描き方をする
 * （`screens/DreamDerbyScreen.jsx`の`.lead-fade`）。⚠️他の行の頭に付けないこと。 */
export const DREAM_FADE_MARK = "───…";

export const COMMENTARY = {
  // ⭐レースで最初に出る1行。**4行とも`DREAM_FADE_MARK`で始め、言葉の途中から書く**
  // （2026-09-08にユーザー決定・見本の案D2）。⚠️狙いは「番号を隠す」ことではなく
  // **夢が途中から聞こえ始める**こと。記号のあとに`.lead-fade`で文字がぼやけた状態から
  // 1.6秒かけて浮かぶ（`DreamDerbyScreen.jsx`／`.css`）。
  // ⚠️競馬場とレース番号はレース前の画面に大きく出ているので、ここから落としてよい。
  intro: [
    { text: `${DREAM_FADE_MARK}回日本ダービー、芝2400メートル。` },
    { text: `${DREAM_FADE_MARK}馬場は良。{field}頭がスタンド前の発走地点へ向かっています。` },
    { text: `${DREAM_FADE_MARK}芝2400。3歳馬{field}頭、一生に一度のダービーです。` },
    { text: `${DREAM_FADE_MARK}出走{field}頭。良馬場。` },
  ],
  fieldIntro: [
    { text: "出走馬です。{lineup6}。そして{selfNum}番{self}。1番人気に応えられるか。以上{field}頭。" },
  ],
  gateIn: [
    { text: "順調に枠入りが進んでいます。体勢整った。" },
    { text: "大外{lastNum}番{lastName}が最後に入りました。" },
    { text: "全馬ゲートイン。係員が離れます。" },
    { text: "{field}頭が収まった。スタンドが静かになる。" },
    { text: "枠入り完了。" },
    { text: "まもなく発走です。" },
  ],
  start: [
    { text: "スタートしました。揃った飛び出し。" },
    { text: "ゲートが開いた。揃ったスタートになりました。" },
    { text: "一斉にスタート。{leader}が好スタート。内から{second}。" },
    { text: "スタート。{last}がやや遅れた。" },
    // 先頭2頭に自分が入っていると「押して前へ」が自分の選択と食い違う
    { text: "内から{leader}、{second}が押して前へ。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "スタート、{leader}が行く構え。{self}もいいスタートです。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "スタート。さぁどの馬がハナを切って行くんでしょうか。" },
    { text: "揃ったスタート。まず{leader}が前へ。" },
    { text: "緊張の一瞬であります。ゲートが開いた、どっと出ました{field}頭！" }, // 名実況のもじり・元ネタ6
  ],
  earlyOrder: [
    { text: "先頭{leader}。2番手{second}、3番手{third}。" },
    { text: "隊列固まって、{order5}。" },
    { text: "前から{leader}、{second}、{third}。" },
    { text: "{leader}が先頭に立った。{second}が2番手、{third}。" },
    { text: "先頭{leader}。{second}、{third}、{fourth}と続く。" },
    { text: "{order5}。最後方{last}。" },
    { text: "{leader}が引っ張ります。{second}が控えて2番手。" },
    { text: "前は{leader}、{second}。後ろは{last}。" },
    { text: "{leader}がハナ。{second}が2番手で折り合っている。" },
    { text: "{order5}という並び。" },
  ],
  corner12: [
    { text: "1コーナー。先頭は{leader}。" },
    { text: "1コーナーから2コーナー。{leader}がペースを作ります。" },
    { text: "1コーナー。{self}は{selfRank}番手で折り合いをつけている。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "1コーナーから2コーナー。{self}は{selfRank}番手。" },
    { text: "1コーナーで{moverNum}番{moverName}が上がってきた。", when: hasMover },
    { text: "1コーナーから2コーナー。{moverName}が前へ行きます。", when: hasMover },
    { text: "{moverNum}番{moverName}が上がる。{moverJockey}が押していきます。", when: (v) => hasMover(v) && !!v.moverJockey },
    { text: "2コーナーを回って向正面。先頭{leader}、2番手{second}。" },
  ],
  backstretch: [
    // `split1000Seconds`がnullでない（未通過だと"0:00"が出る）
    { text: "1000メートル通過{split1000}。", when: (v) => v.split1000Seconds != null },
    { text: "向正面。1000メートル{split1000}で通過。", when: (v) => v.split1000Seconds != null },
    { text: "向正面の半ば。先頭{leader}、2番手{second}。後ろは{last}。" },
    { text: "向正面。{moverNum}番{moverName}が上がってきました。", when: hasMover },
    { text: "残り{remain}メートル。先頭{leader}。" },
    { text: "向正面。{moverName}が動いた。", when: hasMover },
    // 先頭が相手馬（先頭が自分の馬ならjockeyNameはnull）
    { text: "向正面。先頭は{leader}、鞍上{leaderJockey}。", when: (v) => !!v.leaderJockey },
    { text: "1000メートル{split1000}。{leaderJockey}が刻んでいます。", when: (v) => v.split1000Seconds != null && !!v.leaderJockey },
    { text: "向正面で{moverNum}番{moverName}が上がっていきます。", when: hasMover },
  ],
  selfMid: [
    { text: "{self}、先頭。2番手に{second}。", when: (v) => bandIn(v, "lead") },
    { text: "先頭は{self}。2番手に{second}。", when: (v) => bandIn(v, "lead") },
    { text: "{self}、{selfRank}番手。先頭{leader}をみるような形。", when: (v) => bandIn(v, "front") },
    { text: "{selfRank}番手の{self}。前に{leader}。", when: (v) => bandIn(v, "front") },
    { text: "{self}、{selfRank}番手。さぁここからどう動くか。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "{self}は{selfRank}番手の内。落ち着いてレースを進めています。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "{selfRank}番手の{self}。どこから動いていくか。", when: (v) => bandIn(v, "mid") },
    { text: "{self}、馬群の中で我慢。{selfRank}番手。", when: (v) => bandIn(v, "mid") },
    { text: "{self}、{selfRank}番手。後方からレースを進める。", when: (v) => bandIn(v, "rear") },
    { text: "{self}は後方{selfRank}番手。先頭は{leader}。", when: (v) => bandIn(v, "rear") },
  ],
  corner3: [
    { text: "3コーナー。ここから上り坂。", when: () => THIRD_CORNER_HAS_HILL },
    { text: "3コーナー。{moverNum}番{moverName}が上がってきた。", when: hasMover },
    { text: "3コーナー。先頭{leader}、2番手{second}。" },
    { text: "3コーナーの坂。{leader}が先頭で上る。", when: () => THIRD_CORNER_HAS_HILL },
    { text: "3コーナーで{moverName}が動いた。", when: hasMover },
    { text: "残り{remain}メートル。3コーナー。各馬動き始めた。" },
    { text: "3コーナーから4コーナー。{leader}、{second}、{third}。" },
    { text: "3コーナー。後ろから{moverName}が早めに上がっていった。", when: hasMover },
  ],
  corner4: [
    { text: "4コーナー。先頭{leader}。" },
    { text: "4コーナーを回る。{leader}が先頭のまま直線へ。{chaser}が続く。" },
    { text: "4コーナー。{moverName}が上がってきた。", when: hasMover },
    { text: "4コーナー、先頭{leader}。2番手{second}。" },
    { text: "残り{remain}メートル。4コーナー。{leader}のリードは{leadGap}。" },
    { text: "4コーナーを回って府中の直線へ。", when: () => TRACK_NAME === "東京" },
    { text: "4コーナーで{moverNum}番{moverName}が上がってきた。", when: hasMover },
    { text: "4コーナー。{self}は{selfRank}番手。" },
  ],
  stretchEntry: [
    { text: "直線に入った。先頭{leader}。" },
    { text: "さあ直線。残り500。{leader}が先頭、{chaser}が追う。", when: () => STRAIGHT_LENGTH >= 500 },
    { text: "直線に向いた。府中の長い直線。", when: () => TRACK_NAME === "東京" },
    { text: "最後の直線。{leader}、{chaser}、その後ろに{third}。" },
    { text: "直線、坂を上る。{leader}がまだ先頭。", when: () => STRAIGHT_HAS_HILL },
    { text: "各馬直線へ。先頭{leader}。リードは{leadGap}。" },
    { text: "直線です。残り500。先頭{leader}。", when: () => STRAIGHT_LENGTH >= 500 },
    { text: "直線に入った。{leader}、{chaser}、{third}。" },
    { text: "直線に向いて鞭が入る。先頭{leader}。" },
    { text: "残り500。歓声が大きくなる。", when: () => STRAIGHT_LENGTH >= 500 },
  ],
  stretchMid: [
    { text: "残り200。先頭{leader}、{chaser}。" },
    { text: "残り200。{leader}が粘る、{chaser}が迫る。" },
    { text: "坂を上ってあと200。先頭{leader}。{moverName}が追い込む。", when: hasMover },
    { text: "残り200メートル。{moverNum}番{moverName}が来た！", when: moverIsOther },
    { text: "あと200。{leader}、{chaser}、{third}。" },
    { text: "残り200を切って{self}が伸びてきた。", when: moverIsSelf },
    { text: "先頭{leader}。{chaser}が追う。{third}はどうだ。" },
    { text: "残り200。前は{leader}、{chaser}。後ろから{moverName}。", when: hasMover },
    { text: "あと200。{self}が伸びる。", when: moverIsSelf },
    { text: "残り200。{leader}が粘り込む。{moverName}が来る。", when: moverIsOther },
    { text: "ゴールまで200。{leader}と{chaser}の叩き合い。", when: isCloseLead },
    { text: "残り200。{leader}が先頭。後ろから{chaser}、{third}。" },
  ],
  finish: [
    { text: "ゴールイン。1着{winner}。" },
    { text: "{winner}、先頭でゴール。" },
    // `{gap}`は自分と先頭の差なので、自分が2着のときだけ「1着との差」として正しい
    { text: "ゴール。{winner}が{gap}差で1着。", when: (v) => v.selfRankNum === 2 },
    { text: "{winner}、1着。2着{chaser}。" },
    { text: "決まった。{winner}が先頭でゴールを通過。" },
    { text: "ゴールイン。{winner}です。" },
    { text: "{winner}がゴールを駆け抜けた。今年の3歳馬の頂点が決まりました。" },
    { text: "ゴール。{winner}。" },
  ],
  finishSelfWin: [
    { text: "{self}、先頭でゴール。ダービー馬は{self}。" },
    { text: "{self}が抜け出した。{self}、ダービー制覇。" },
    { text: "{self}、1着。見事日本ダービーを制しました。" },
    { text: "ゴール、{self}。スタンドが揺れています。" },
    { text: "{self}が先頭でゴール板を通過。" },
    { text: "{self}、1着。鞍上が拳を上げた。" },
  ],
  finishSelfLose: [
    { text: "1着{winner}。{self}は{selfRank}着。" },
    { text: "{winner}がゴール。{self}は届かず{selfRank}着。" },
    { text: "ゴールイン。{winner}。{self}は{selfRank}着に終わりました。" },
    { text: "{winner}、1着。{self}、{selfRank}着。" },
    { text: "決まった。{winner}が1着。{self}は{selfRank}着でゴール。" },
    { text: "{winner}が先頭でゴール。{self}は2着。", when: (v) => v.selfRankNum === 2 },
  ],
  // ⚠️往年の名実況の「もじり」（ユーザー指示：伝わる程度に言い換える。一言一句は使わない）。
  // ⚠️⚠️1本ずつ元ネタを design/meijikkyou-sources.md の表に対応させてある（末尾の番号）。
  // 元ネタを確認できないものはここに入れない。実在の馬名・騎手名・アナウンサー名は出さない。
  // ⚠️評価語を含む元ネタ9・10の2本は不採用（2026-09-06に本体で決定。devlog/wave04.md §32参照）。
  homage: [
    { text: "世界のファンよ見てくれ、これが日本近代競馬の結実だ！" }, // 元ネタ1
    { text: "あなたの、そして私たちの夢が、いま府中を走っています。" }, // 元ネタ2
    // 先頭と2番手の差が4馬身（9.6m）以上
    { text: "後ろからは、な〜んにも来ない！{leader}、独走だ！", when: (v) => v.leadGap2nd != null && v.leadGap2nd >= 9.6 }, // 元ネタ3
    { text: "大地が弾んで{leader}だ！" }, // 元ネタ4
    { text: "どんなもんだい、{leader}！" }, // 元ネタ5
    { text: "{leader}にムチが入った。ムチ一閃、ぐんぐん出ます。" }, // 元ネタ7
    { text: "初夏の府中で、{field}頭が夢を懸けて走る。", when: () => TRACK_NAME === "東京" }, // 元ネタ11
  ],
  homageWin: [
    { text: "堂々抜け出した！ダービー制覇！" }, // 元ネタ8
    { text: "後ろからは、な〜んにも来ない！{self}、1着でゴールイン！" }, // 元ネタ3
    { text: "どんなもんだい、{self}！" }, // 元ネタ5
  ],
  choiceReact: {
    // ===== 道中の8択（2026-09-08にユーザーと合意。`devlog/wave05.md`§57）。
    // 前・中団・後方は同じ4択なので、この4キーが3つの位置から引かれる。
    makuru: [
      { text: "{self}、上がっていった。" },
      { text: "動いた。{self}、外から一気に。" },
      { text: "{self}が{selfRank}番手から前へ。まくっていく。" },
      { text: "{self}、大きく位置を上げにいく。" },
    ],
    moveOutside: [
      { text: "{self}、外へ。" },
      { text: "{self}が外に持ち出した。" },
      { text: "外に出した{self}。" },
      { text: "{self}、馬群の外へ。" },
    ],
    holdInside: [
      { text: "{self}、動かない。" },
      { text: "{self}は内で我慢。{selfRank}番手のまま。" },
      { text: "内にいる{self}。脚を溜めているか。" },
      { text: "{self}、じっとしている。前が開くか。" },
    ],
    dropBack: [
      { text: "{self}、下げた。" },
      { text: "{self}、位置を下げます。{selfRank}番手。" },
      { text: "一列下げた{self}。早いと見たか。" },
      { text: "{self}、後ろへ。大丈夫か。" },
    ],
    pushPace: [
      { text: "{self}、後ろを離しにかかる。" },
      { text: "{self}、これは大逃げの形。" },
    ],
    keepGoing: [
      { text: "{self}、このまま先頭。" },
      { text: "{self}が引っ張ります。" },
    ],
    easeOff: [
      { text: "{self}、少し息を入れたか。" },
      { text: "先頭{self}、まだ長手綱。2番手は{second}。" },
    ],
    sitBack: [
      { text: "{self}、控えた。先頭を譲ります。" },
      { text: "{self}が下がる。前は{second}。" },
    ],

    // ===== 中団（Pack）。`domain/judgmentCard.js`の`dreamMidPack`/`dreamStretchPack`が
    // 元の（位置分岐導入前の）ID をそのまま使うため、このIDだけ道中・直線の両方から引かれる。
    goNow: [
      { text: "{self}、ここで追い出した。早めに仕掛けた。" },
      { text: "{self}が動いた。先頭を奪いにいく。" },
      { text: "{self}、鞭が入った。一気に前へ。" },
      { text: "早めに仕掛けた{self}。ここから長い、府中の直線です。", when: () => TRACK_NAME === "東京" },
    ],
    waitFurlong: [
      { text: "{self}、まだ動かない。" },
      { text: "{self}は我慢。" },
      { text: "{self}、手綱を抑えたまま。" },
      { text: "まだ追い出さない{self}。" },
    ],
    sweepOutside: [
      { text: "{self}、大外に持ち出した。" },
      { text: "{self}が外へ。馬場の外を回って、届くかどうか。" },
      { text: "外に出した{self}。進路は開いている。" },
      { text: "{self}、大外から。" },
    ],
    railRun: [
      { text: "{self}、内をすくう。" },
      { text: "{self}が内へ。ラチ沿いの狭いところを突いていく。" },
      { text: "内をすくった{self}。" },
      { text: "{self}、内ラチ沿い。" },
    ],
    // ===== 先頭・前・後方×道中・直線の新規24択（devlog/wave04.md §32）。
    // 1択につき2行（本筋の遅延を避けるための意図的な縮小。先送りではない）。
    pushNow: [
      { text: "{self}、追い出した。先頭で押し切りにかかる。" },
      { text: "先頭{self}に鞭が入った。" },
    ],
    holdABit: [
      { text: "{self}、まだ追わない。先頭のまま。" },
      { text: "先頭{self}、手綱を持ったまま。後ろは{chaser}。" },
    ],
    moveToRail: [
      { text: "{self}、内に寄せた。インを突いて行く。" },
      { text: "先頭{self}が内へ。後ろから{chaser}。" },
    ],
    driftOut: [
      { text: "{self}、外に出した。" },
      { text: "先頭{self}が外へ。内が空いた。" },
    ],
    drawLevelNow: [
      { text: "{self}、{leader}に並びかける。" },
      { text: "{self}が並んだ。先頭争い。" },
    ],
    swingOutside: [
      { text: "{self}、外へ出した。" },
      { text: "{self}が外に持ち出す。前が開いた。" },
    ],
    passInside: [
      { text: "{self}、内から。{leader}の内を突く。" },
      { text: "内から抜きにかかる{self}。" },
    ],
    waitMore: [
      { text: "{self}、まだ待つ。{leader}の後ろ。" },
      { text: "{self}はまだ追い出しを待つ。" },
    ],
    wideSweepRear: [
      { text: "{self}、大外に出した。" },
      { text: "後方から{self}が大外へ。" },
    ],
    splitRailRear: [
      { text: "{self}、内へ。狭いところを突く。" },
      { text: "後方の{self}が内を突く。開くかどうか。" },
    ],
    pushNowRear: [
      { text: "{self}に鞭。追い出した。" },
      { text: "{self}、追い出した。さぁ届くか。" },
    ],
    saveToEnd: [
      { text: "{self}、まだ追わない。" },
      { text: "{self}はまだ追わない。ここから届くのか。" },
    ],
  },
};

// 暗転〜目覚めのメッセージ（親に起こされ、卒業式の日だと知らされる場面）
export const WAKE_LINES = [
  "「起きなさい。もう7時過ぎてる」",
  "「……ん」",
  "「今日は卒業式でしょう。競馬学校の」",
  "「わかってる」",
];
