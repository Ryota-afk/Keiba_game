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
  dreamMidLead: [
    // 先頭（1番手）。前へ出るのは「ペースを上げる」だけ、残りは今の位置を動かさない。
    { id: "keepGoing", label: "このまま行く", effect: 0, forward: false },
    { id: "easeOff", label: "少し緩める", effect: -1, forward: false },
    { id: "pickUpPace", label: "ペースを上げる", effect: 2, forward: true },
    { id: "lookBack", label: "後ろを見る", effect: 0, forward: false },
  ],
  dreamMidFront: [
    // 前（2〜4番手）。
    { id: "stayAsIs", label: "このまま", effect: 0, forward: false },
    { id: "drawLevel", label: "並びかける", effect: 1, forward: true },
    { id: "moveOutside", label: "外に出す", effect: 1, forward: true },
    { id: "waitInside", label: "内で待つ", effect: 0, forward: false },
  ],
  dreamMidPack: [
    // 中団。⚠️IDは元の（位置分岐を導入する前の）`dreamMid`と同じ4つを再利用している——
    // `data/dreamDerbyCommentary.js`の`choiceReact.holdInside`等（選択直後の反応実況）が
    // このIDで引かれるため、IDを変えると中団の反応実況だけ静かに消える
    // （実況の文言そのものは変えない、という依頼の範囲を守るため）。
    { id: "holdInside", label: "内で待つ", effect: 0, forward: false },
    { id: "takeOutside", label: "外へ出す", effect: 1, forward: true },
    { id: "dropBack", label: "下げて外へ", effect: -1, forward: true },
    { id: "splitField", label: "間を割る", effect: 3, forward: true },
  ],
  dreamMidRear: [
    // 後方（最後方寄り）。
    { id: "moveUpOutside", label: "外から上がる", effect: 2, forward: true },
    { id: "waitInsideRear", label: "内で待つ", effect: 0, forward: false },
    { id: "moveEarly", label: "早めに動く", effect: 1, forward: true },
    { id: "waitToEnd", label: "最後まで待つ", effect: -1, forward: false },
  ],
  dreamStretchLead: [
    // 先頭のまま直線へ。
    { id: "pushNow", label: "すぐ追い出す", effect: 1, early: true },
    { id: "holdABit", label: "もう少し持つ", effect: 0, early: false },
    { id: "moveToRail", label: "内に寄せる", effect: 0, early: false },
    { id: "driftOut", label: "外に出す", effect: 0, early: false },
  ],
  dreamStretchFront: [
    { id: "drawLevelNow", label: "今並びかける", effect: 1, early: true },
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
