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

/** `vars.selfBand`が指定した区分のどれかに一致するか。 */
const bandIn = (vars, ...bands) => bands.includes(vars.selfBand);
/** 直近5秒で順位を3つ以上上げた馬（mover）がいるか。 */
const hasMover = (vars) => !!vars.moverName;
/** moverがいて、かつそれが自分の馬ではないか。 */
const moverIsOther = (vars) => !!vars.moverName && !vars.moverIsSelf;
/** moverがいて、かつそれが自分の馬か。 */
const moverIsSelf = (vars) => !!vars.moverName && !!vars.moverIsSelf;

export const COMMENTARY = {
  intro: [
    { text: "東京競馬場、第10レース。第92回日本ダービー、芝2400メートル。" },
    { text: "天候は晴れ。馬場は良。{field}頭がスタンド前の発走地点へ向かっています。" },
    { text: "府中の芝2400。3歳馬{field}頭、一生に一度のダービーです。" },
    { text: "第92回日本ダービー。出走{field}頭。良馬場。" },
  ],
  fieldIntro: [
    { text: "出走馬です。{lineup6}。そして{selfNum}番{self}。鞍上は、今日デビューする新人。以上{field}頭。" },
    { text: "{lineup6}。{selfNum}番{self}には競馬学校を出たばかりの新人が乗ります。" },
    { text: "枠順です。{lineup6}と続きます。{selfNum}番{self}、鞍上は初騎乗の新人です。" },
  ],
  gateIn: [
    { text: "奇数馬から枠入りです。" },
    { text: "大外{lastNum}番{lastName}が最後に入りました。" },
    { text: "全馬ゲートイン。係員が離れます。" },
    { text: "{field}頭が収まった。スタンドが静かになる。" },
    { text: "枠入り完了。" },
    { text: "まもなく発走です。" },
  ],
  start: [
    { text: "スタートしました。揃った出です。" },
    { text: "ゲートが開いた。出遅れはありません。" },
    // 自分が先頭でない（先頭なら「{leader}が好スタート、{self}も」が同じ馬になる）
    { text: "一斉にスタート。{leader}が好スタート、{self}も五分に出た。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "スタート。{self}、まずまずの出。" },
    // 先頭2頭に自分が入っていると「押して前へ」が自分の選択と食い違う
    { text: "内から{leader}、{second}が押して前へ。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "発走。{leader}が行く構え。{self}は馬なり。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "スタート切った。最初のコーナーまで位置取り争いです。" },
    { text: "揃ったスタート。{self}、無理はしていません。" },
    { text: "緊張の一瞬であります。ゲートが開いた、どっと出ました{field}頭！" }, // 名実況のもじり・元ネタ6
  ],
  earlyOrder: [
    { text: "先頭{leader}。2番手{second}、3番手{third}。{self}は{selfRank}番手。" },
    { text: "隊列が決まりました。{order5}。{self}は{selfRank}番手。" },
    { text: "前から{leader}、{second}、{third}。{self}は{selfRank}番手でじっとしています。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "{leader}が先頭に立った。{second}が2番手、{third}。{self}は{selfRank}番手。" },
    { text: "先頭{leader}。{second}、{third}、{fourth}。{self}は{selfRank}番手で追走。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "{order5}。{self}は{selfRank}番手、前の馬の真後ろ。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "{leader}が引っ張ります。{second}が控えて、{self}は{selfRank}番手。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "前は{leader}、{second}。{self}が{selfRank}番手。最後方{last}。", when: (v) => bandIn(v, "mid") },
    { text: "{leader}が先頭。{self}は{selfRank}番手、馬群の中です。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "{order5}という並び。{self}、{selfRank}番手。" },
  ],
  corner12: [
    { text: "1コーナー。先頭は{leader}。" },
    { text: "1コーナーから2コーナー。{leader}がペースを作ります。" },
    { text: "1コーナー。{self}は{selfRank}番手のまま我慢。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "2コーナーです。{self}、{selfRank}番手。行きたがってはいません。" },
    { text: "1コーナーで{moverNum}番{moverName}が上がってきた。", when: hasMover },
    { text: "2コーナー。{moverName}が前へ行きます。", when: hasMover },
    { text: "{moverNum}番{moverName}が上がる。{moverJockey}が押していきます。", when: (v) => hasMover(v) && !!v.moverJockey },
    { text: "2コーナーを回って向正面。先頭{leader}、{self}は{selfRank}番手。" },
  ],
  backstretch: [
    // `split1000Seconds`がnullでない（未通過だと"0:00"が出る）
    { text: "1000メートル通過{split1000}。", when: (v) => v.split1000Seconds != null },
    { text: "向正面。1000メートル{split1000}で通過。", when: (v) => v.split1000Seconds != null },
    { text: "向正面の半ば。先頭{leader}、2番手{second}。{self}は{selfRank}番手。" },
    { text: "向正面。{moverNum}番{moverName}が上がってきました。", when: hasMover },
    { text: "1000メートル{split1000}。ここから3コーナーへ。", when: (v) => v.split1000Seconds != null },
    { text: "残り{remain}メートル。先頭{leader}。" },
    { text: "向正面。{moverName}が動いた。", when: hasMover },
    // 先頭が相手馬（先頭が自分の馬ならjockeyNameはnull）
    { text: "向正面。先頭は{leader}、鞍上{leaderJockey}。", when: (v) => !!v.leaderJockey },
    { text: "1000メートル{split1000}。{self}は{selfRank}番手。", when: (v) => v.split1000Seconds != null },
    { text: "向正面で{moverNum}番{moverName}が上がっていきます。", when: hasMover },
  ],
  selfMid: [
    { text: "{self}、先頭。2番手に{second}。", when: (v) => bandIn(v, "lead") },
    { text: "先頭は{self}。新人が引っ張っています。", when: (v) => bandIn(v, "lead") },
    { text: "{self}、{selfRank}番手。先頭{leader}のすぐ後ろ。", when: (v) => bandIn(v, "front") },
    { text: "{selfRank}番手の{self}。前に{leader}。", when: (v) => bandIn(v, "front") },
    { text: "{self}、{selfRank}番手。前に馬がいて動けない。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "{self}は{selfRank}番手の内。前が壁。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "{selfRank}番手の{self}。囲まれて進路がない。", when: (v) => bandIn(v, "mid") },
    { text: "{self}、馬群の中で我慢。{selfRank}番手。", when: (v) => bandIn(v, "mid") },
    { text: "{self}、{selfRank}番手。前は遠い。", when: (v) => bandIn(v, "rear") },
    { text: "{self}は後方{selfRank}番手。先頭は{leader}。", when: (v) => bandIn(v, "rear") },
  ],
  corner3: [
    { text: "3コーナー。ここから上り坂。" },
    { text: "3コーナー。{moverNum}番{moverName}が上がってきた。", when: hasMover },
    { text: "3コーナー。先頭{leader}、2番手{second}。" },
    { text: "3コーナーの坂。{self}は{selfRank}番手。" },
    { text: "3コーナーで{moverName}が動いた。鞍上の手が動いています。", when: hasMover },
    { text: "残り{remain}メートル。3コーナー。各馬、鞭が入り始めた。" },
    { text: "3コーナーから4コーナー。{leader}、{second}。{self}は{selfRank}番手。" },
    { text: "3コーナー。後ろから{moverName}が来た。", when: hasMover },
  ],
  corner4: [
    { text: "4コーナー。先頭{leader}。" },
    { text: "4コーナーを回る。{leader}が先頭のまま直線へ。{self}は{selfRank}番手。" },
    { text: "4コーナー。{moverName}が上がってきた。", when: hasMover },
    { text: "4コーナー、先頭{leader}。2番手{second}。" },
    { text: "残り{remain}メートル。4コーナー。{self}は{selfRank}番手。" },
    { text: "4コーナーを回って府中の直線へ。" },
    { text: "4コーナーで{moverNum}番{moverName}が上がってきた。", when: hasMover },
    { text: "4コーナー。{self}は{selfRank}番手。" },
  ],
  stretchEntry: [
    { text: "直線に入った。先頭{leader}。" },
    { text: "さあ直線。残り500。{leader}が先頭、{chaser}が追う。" },
    { text: "直線に向いた。府中の長い直線。" },
    { text: "最後の直線。{leader}、{chaser}。{self}は{selfRank}番手。" },
    { text: "直線、坂を上る。{leader}がまだ先頭。" },
    { text: "各馬直線へ。先頭{leader}。{self}、{selfRank}番手。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "直線です。残り500。先頭{leader}。" },
    { text: "直線に入った。{leader}、{chaser}、{third}。{self}は{selfRank}番手。" },
    { text: "直線に向いて鞭が入る。先頭{leader}。" },
    { text: "残り500。歓声が大きくなる。" },
  ],
  stretchMid: [
    { text: "残り200。先頭{leader}、{chaser}。" },
    { text: "残り200。{leader}が粘る、{chaser}が迫る、{self}も来た。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "坂を上ってあと200。先頭{leader}。{self}が{selfRank}番手から追い込む。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "残り200メートル。{moverNum}番{moverName}が来た！", when: moverIsOther },
    { text: "あと200。{leader}、{chaser}、{third}。" },
    { text: "残り200を切って{self}が伸びてきた。", when: moverIsSelf },
    { text: "先頭{leader}。{chaser}が追う。{self}はどうだ。", when: (v) => bandIn(v, "front", "mid", "rear") },
    { text: "残り200。前は{leader}、{chaser}。後ろから{self}。", when: (v) => bandIn(v, "mid", "rear") },
    { text: "あと200。{self}が伸びる。", when: moverIsSelf },
    { text: "残り200。{leader}が粘り込む。{moverName}が来る。", when: moverIsOther },
    { text: "ゴールまで200。先頭{leader}。{self}が{selfRank}番手まで上がった。", when: moverIsSelf },
    { text: "残り200。{self}が先頭。後ろから{chaser}。", when: (v) => bandIn(v, "lead") },
  ],
  finish: [
    { text: "ゴールイン。1着{winner}。" },
    { text: "{winner}、先頭でゴール。" },
    // `{gap}`は自分と先頭の差なので、自分が2着のときだけ「1着との差」として正しい
    { text: "ゴール。{winner}が{gap}差で1着。", when: (v) => v.selfRankNum === 2 },
    { text: "{winner}、1着。2着{chaser}。" },
    { text: "決まった。{winner}が先頭でゴールを通過。" },
    { text: "ゴールイン。{winner}です。" },
    { text: "{winner}がゴールを駆け抜けた。ダービー馬が決まりました。" },
    { text: "ゴール。{winner}。" },
  ],
  finishSelfWin: [
    { text: "{self}、先頭でゴール。ダービー馬は{self}。" },
    { text: "{self}が抜け出した。{self}、ダービー制覇。" },
    { text: "{self}、1着。新人が日本ダービーを勝ちました。" },
    { text: "ゴール、{self}。スタンドが揺れています。" },
    { text: "{self}が先頭でゴール板を通過。{field}頭の中で1着。" },
    { text: "{self}、1着。鞍上が拳を上げた。" },
  ],
  finishSelfLose: [
    { text: "1着{winner}。{self}は{selfRank}着。" },
    { text: "{winner}がゴール。{self}は届かず{selfRank}着。" },
    { text: "ゴールイン。{winner}。{self}は{selfRank}着に終わりました。" },
    { text: "{winner}、1着。{self}、{selfRank}着。" },
    { text: "決まった。{winner}が1着。{self}は{selfRank}着でゴール。" },
    { text: "{winner}が先頭でゴール。{self}は2着。あと{gap}。", when: (v) => v.selfRankNum === 2 },
  ],
  // ⚠️往年の名実況の「もじり」（ユーザー指示：伝わる程度に言い換える。一言一句は使わない）。
  // ⚠️⚠️1本ずつ元ネタを design/meijikkyou-sources.md の表に対応させてある（末尾の番号）。
  // 元ネタを確認できないものはここに入れない。実在の馬名・騎手名・アナウンサー名は出さない。
  // ⚠️評価語を含む元ネタ9・10の2本は不採用（2026-09-06に本体で決定。devlog/wave04.md §32参照）。
  homage: [
    { text: "世界中のファンよ見てくれ、これが日本近代競馬の結実だ！" }, // 元ネタ1
    { text: "あなたの、そして私たちの夢が、いま府中を走っています。" }, // 元ネタ2
    // 先頭と2番手の差が3馬身（7.2m）以上
    { text: "後ろからは、な〜んにも来ない！{leader}、独走だ！", when: (v) => v.leadGap2nd != null && v.leadGap2nd >= 7.2 }, // 元ネタ3
    { text: "大地が弾んで{leader}だ！" }, // 元ネタ4
    { text: "どんなもんだい、{leader}！" }, // 元ネタ5
    { text: "{leader}にムチが入った。ムチ一閃、ぐんぐん出ます。" }, // 元ネタ7
    { text: "初夏の府中で、{field}頭が夢を懸けて走る。" }, // 元ネタ11
    { text: "{chaser}なら大丈夫だ！" }, // 元ネタ12
  ],
  homageWin: [
    { text: "堂々抜け出した！新人騎手、ダービー制覇！" }, // 元ネタ8
    { text: "後ろからは、な〜んにも来ない！{self}、1着でゴールイン！" }, // 元ネタ3
    { text: "世界中のファンよ見てくれ。新人がいまダービーを勝った！" }, // 元ネタ1
    { text: "どんなもんだい、{self}！" }, // 元ネタ5
  ],
  choiceReact: {
    // ===== 中団（Pack）。`domain/judgmentCard.js`の`dreamMidPack`/`dreamStretchPack`が
    // 元の（位置分岐導入前の）ID をそのまま使うため、このIDだけ道中・直線の両方から引かれる。
    holdInside: [
      { text: "{self}、内で待つ構え。進路が開くのを待ちます。" },
      { text: "{self}は動きません。{selfRank}番手の内で、じっと我慢。" },
      { text: "{self}、内に潜ったまま。脚を溜める判断です。" },
      { text: "内で我慢する{self}。前が開くかどうかは、前の馬次第です。" },
    ],
    takeOutside: [
      { text: "{self}、外に持ち出しました。進路を確保します。" },
      { text: "{self}が外へ。{selfRank}番手から、外に出して進路を取りました。" },
      { text: "外に出した{self}。外を回るぶん距離は長くなりますが、前は開いています。" },
      { text: "{self}、馬群の外へ。もう前をふさがれる心配はありません。" },
    ],
    dropBack: [
      { text: "{self}、一列下げて外へ回します。" },
      { text: "{self}が下げました。{selfRank}番手まで下がって、外に持ち出す構え。" },
      { text: "位置を下げた{self}。外から自由に動ける形を取りました。" },
      { text: "{self}、後ろに下げて外へ。追い出すのは遅くなりますが、進路は開けました。" },
    ],
    splitField: [
      { text: "{self}、馬群を割って前へ。" },
      { text: "{self}が馬群の間を突いて上がっていく。" },
      { text: "馬群を割る{self}。狭いところを抜けて{selfRank}番手へ。" },
      { text: "{self}、内と外の馬の間へ。強気の騎乗です。" },
    ],
    goNow: [
      { text: "{self}、ここで追い出した。早めの仕掛けです。" },
      { text: "{self}が動いた。直線の入り口で先頭を奪いにいきます。" },
      { text: "{self}、鞭が入った。一気に前へ。" },
      { text: "早めに仕掛けた{self}。ここから長い、府中の直線です。" },
    ],
    waitFurlong: [
      { text: "{self}、まだ動かない。脚を溜めて、あと1ハロン待ちます。" },
      { text: "{self}は我慢。前の馬の後ろで、追い出しを遅らせています。" },
      { text: "{self}、手綱を抑えたまま。仕掛けを我慢する判断です。" },
      { text: "まだ追い出さない{self}。残り200まで、脚を温存します。" },
    ],
    sweepOutside: [
      { text: "{self}、大外に持ち出した。一気に来ます。" },
      { text: "{self}が外へ。馬場の外を回って、最後の脚に懸けました。" },
      { text: "外に出した{self}。進路は開いています。あとは、この馬の脚がどれだけ残っているか。" },
      { text: "{self}、大外から。距離は長くなりますが、前は空いています。" },
    ],
    railRun: [
      { text: "{self}、内をすくいます。最短距離を突く判断。" },
      { text: "{self}が内へ。ラチ沿いの狭いところを突いてきます。" },
      { text: "内をすくう{self}。前が開けば、一番短い道です。" },
      { text: "{self}、内ラチ沿い。前が開かなければ、そこで止まります。" },
    ],
    // ===== 先頭・前・後方×道中・直線の新規24択（devlog/wave04.md §32）。
    // 1択につき2行（本筋の遅延を避けるための意図的な縮小。先送りではない）。
    keepGoing: [
      { text: "{self}、このまま先頭。" },
      { text: "{self}が引っ張ります。ペースは変えない。" },
    ],
    easeOff: [
      { text: "{self}、少し緩めた。2番手{second}が近づく。" },
      { text: "先頭{self}、手綱を緩めた。" },
    ],
    pickUpPace: [
      { text: "{self}がペースを上げた。後ろを離しにかかる。" },
      { text: "先頭{self}、ここで速くした。" },
    ],
    lookBack: [
      { text: "{self}、後ろを見た。2番手は{second}。" },
      { text: "新人が振り返った。後ろとの差を確かめています。" },
    ],
    stayAsIs: [
      { text: "{self}、{selfRank}番手のまま。" },
      { text: "{self}は動かず。{leader}の後ろ。" },
    ],
    drawLevel: [
      { text: "{self}が{leader}に並びかける。" },
      { text: "{self}、前へ。{leader}に並んだ。" },
    ],
    moveOutside: [
      { text: "{self}、外に出した。" },
      { text: "{self}が外へ。前は開いています。" },
    ],
    waitInside: [
      { text: "{self}、内で待つ。前は{leader}。" },
      { text: "内で我慢の{self}。{selfRank}番手。" },
    ],
    moveUpOutside: [
      { text: "{self}、外から上がっていく。" },
      { text: "後方から{self}が動いた。外を回って前へ。" },
    ],
    waitInsideRear: [
      { text: "{self}、後方の内で待つ。" },
      { text: "{self}は{selfRank}番手のまま内で待ちます。" },
    ],
    moveEarly: [
      { text: "{self}が早めに動いた。{selfRank}番手から前へ。" },
      { text: "後方の{self}、ここで動く。" },
    ],
    waitToEnd: [
      { text: "{self}、まだ動かない。直線まで待ちます。" },
      { text: "{self}は後ろで待つ構え。" },
    ],
    pushNow: [
      { text: "{self}、追い出した。先頭で押し切りにかかる。" },
      { text: "先頭{self}に鞭が入った。" },
    ],
    holdABit: [
      { text: "{self}、まだ追わない。先頭のまま。" },
      { text: "先頭{self}、手綱を持ったまま。後ろは{chaser}。" },
    ],
    moveToRail: [
      { text: "{self}、内に寄せた。一番短い道を行く。" },
      { text: "先頭{self}が内へ。後ろから{chaser}。" },
    ],
    driftOut: [
      { text: "{self}、外に出した。先頭のまま。" },
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
      { text: "内から抜きにかかる{self}。開かなければ止まる。" },
    ],
    waitMore: [
      { text: "{self}、まだ待つ。{leader}の後ろ。" },
      { text: "{self}は追い出しを待つ。あと少し。" },
    ],
    wideSweepRear: [
      { text: "{self}、大外に出した。" },
      { text: "後方から{self}が大外へ。距離は長い。" },
    ],
    splitRailRear: [
      { text: "{self}、内へ。狭いところを突く。" },
      { text: "後方の{self}が内を突く。開くかどうか。" },
    ],
    pushNowRear: [
      { text: "{self}に鞭。後方から追い出した。" },
      { text: "{self}、追い出した。前は遠い。" },
    ],
    saveToEnd: [
      { text: "{self}、まだ追わない。" },
      { text: "{self}は最後まで待つ。残り200で勝負。" },
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
