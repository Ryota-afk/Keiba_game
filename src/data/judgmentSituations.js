// 判断カードの状況5類型（ARCHITECTURE.md §5「判断カード」「状況の5類型」）。
// ⚠️択の効果量（基準幅×賢さ×度胸×疲労、上限=適性1段ぶん）はレースsim本実装
// （⑦・`claude-opus-5`）で消耗式・レース傾向と一緒に確定する。ここでは第2弾（Sonnet）の
// 範囲として、5類型それぞれに3つの択と「仮の効果量」だけを置く。⑦で正式な計算式に
// 差し替える（`domain/raceOutcome.js`と同じ「仮」の位置づけ）。

export const SITUATIONS = Object.freeze([
  "boxed", // 包まれた
  "gapAhead", // 前が開いた
  "gapFar", // 前が遠い
  "horsePulling", // 馬が引っ張る
  "settled", // 隊列が落ち着いた
]);

// 各状況2〜4択（ARCHITECTURE.md §5「択の数｜状況で2〜4」）。
// choiceの`effect`は仮のボーナス値（`domain/raceOutcome.js`のスコアに加算する）。
// 道中の共通4択（前・中団・後方）。「どれだけ前へ動くか」の1本の並び。
// ⚠️`aggression`の中立値0.35＝カードを選ばなかったとき。「内で待つ」はここちょうど。
const DREAM_MID_CHOICES = Object.freeze([
  { id: "makuru", label: "まくっていく", aggression: 0.75, forward: true },
  { id: "moveOutside", label: "外に出す", aggression: 0.5, forward: true },
  { id: "holdInside", label: "内で待つ", aggression: 0.35, forward: false },
  { id: "dropBack", label: "位置を下げる", aggression: 0.15, forward: false },
]);

export const SITUATION_CHOICES = Object.freeze({
  boxed: [
    { id: "wait", label: "じっと待つ", effect: 0 },
    { id: "forceOut", label: "強引に進路を切り開く", effect: 3 },
    { id: "pullBack", label: "一度下げて外へ回す", effect: -1 },
  ],
  gapAhead: [
    { id: "goNow", label: "迷わず突く", effect: 4 },
    { id: "holdPosition", label: "位置を守ったまま様子を見る", effect: 0 },
  ],
  gapFar: [
    { id: "chase", label: "早めに動いて追いかける", effect: 2 },
    { id: "stayPatient", label: "我慢して直線に賭ける", effect: 0 },
    { id: "switchOut", label: "外に出して見晴らしを取る", effect: 1 },
  ],
  horsePulling: [
    { id: "letGo", label: "行きたがるまま行かせる", effect: 2 },
    { id: "holdBack", label: "なだめて抑える", effect: -1 },
  ],
  settled: [
    { id: "keepRhythm", label: "そのままの流れに乗る", effect: 1 },
    { id: "pickUpPace", label: "早めにペースを上げる", effect: 2 },
    { id: "saveForLater", label: "直線に脚を残す", effect: 0 },
  ],
  // ⚠️夢のダービー専用の固定演出（`SITUATIONS`には追加しない＝将来の通常レースの
  // ランダム抽選には混ざらない）。残り1200m地点（"dreamMid*"）／最終直線入り
  // （"dreamStretch*"）の2箇所に必ず出るが、そのとき自分の馬がどこを走っているか
  // （`view/dreamDerbyCommentary.js`の`positionBandOf`）で択の組が変わる
  // （ARCHITECTURE.md §12「判断カードは位置で分ける」。2026-09-06にユーザー合意）。
  // `effect`は他の状況と同じ「仮」の位置づけ。
  // ⚠️`forward`（道中）／`early`（直線）はプレイヤーの択から戦法（脚質）を導く2軸タグ
  // （`domain/graduation.js`の`strategyFromDreamChoices`が使う）。持たせないと、
  // どの状況のカードが出たかに関わらず脚質を決められない。
  // ⭐2026-09-08に作り直した（ユーザー決定「案A」・`devlog/wave05.md`§57）。
  // **前・中団・後方は同じ4択**（`DREAM_MID_CHOICES`）、**先頭だけ別**。
  // ⚠️先頭で「まくっていく」は前に馬がいないので成り立たない、が分ける理由。
  // ⚠️`aggression`は`sim/raceSim.js`の`midAggressionOf`が直接読む値（0〜1）。
  // ⭐**中立値は0.35**（カードを選ばなかった状態）。位置を動かさない択はこの値ちょうどにする
  // ——⚠️それ以前は`forward: false`の択が一律0.15で、**「内で待つ」を選ぶと中団から
  // 8.1番手ぶん下がっていた**（71回中71回・最大11番手。`devlog/wave05.md`§54）。
  // ⚠️`forward`は卒業式の戦法4分類（`domain/graduation.js`）が読むタグで、simは読まない。
  dreamMidLead: [
    { id: "pushPace", label: "後続を離す", aggression: 0.75, forward: true },
    { id: "keepGoing", label: "このまま行く", aggression: 0.35, forward: false },
    { id: "easeOff", label: "息を入れる", aggression: 0.25, forward: false },
    { id: "sitBack", label: "控える", aggression: 0.1, forward: false },
  ],
  dreamMidFront: DREAM_MID_CHOICES,
  dreamMidPack: DREAM_MID_CHOICES,
  dreamMidRear: DREAM_MID_CHOICES,
  dreamStretchLead: [
    // 先頭のまま直線へ。
    { id: "pushNow", label: "すぐ追い出す", effect: 1, early: true },
    { id: "holdABit", label: "もう少し持つ", effect: 0, early: false },
    { id: "moveToRail", label: "内に寄せる", effect: 0, early: false },
    { id: "driftOut", label: "外に出す", effect: 0, early: false },
  ],
  dreamStretchFront: [
    { id: "drawLevelNow", label: "早めに仕掛ける", effect: 1, early: true },
    { id: "swingOutside", label: "外へ出す", effect: 2, early: false },
    { id: "passInside", label: "内から抜く", effect: 3, early: true },
    { id: "waitMore", label: "もう少し待つ", effect: 0, early: false },
  ],
  dreamStretchPack: [
    // ⚠️中団はIDも元の`dreamStretch`と同じ4つを再利用（理由は上のdreamMidPackと同じ）。
    { id: "goNow", label: "ここで追い出す", effect: 1, early: true },
    { id: "waitFurlong", label: "もう少し待つ", effect: 0, early: false },
    { id: "sweepOutside", label: "外から一気に", effect: 2, early: true },
    { id: "railRun", label: "内を突く", effect: 4, early: true },
  ],
  dreamStretchRear: [
    { id: "wideSweepRear", label: "大外から", effect: 2, early: true },
    { id: "splitRailRear", label: "内を突く", effect: 4, early: true },
    { id: "pushNowRear", label: "今すぐ追い出す", effect: 1, early: true },
    { id: "saveToEnd", label: "最後まで脚を残す", effect: 0, early: false },
  ],
});
