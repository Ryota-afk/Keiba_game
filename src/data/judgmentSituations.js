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
  // ⚠️`dreamMid`/`dreamStretch`は「夢のダービー」専用の固定演出（`SITUATIONS`には
  // 追加しない＝将来の通常レースのランダム抽選には混ざらない）。残り1200m地点／
  // 最終直線入りの2箇所に必ず出る。`effect`は他の状況と同じ「仮」の位置づけ。
  dreamMid: [
    { id: "holdInside", label: "内で我慢して進路を待つ", effect: 0, hint: "脚は溜まる。前が開かなければそのまま終わる" },
    { id: "takeOutside", label: "外に持ち出す", effect: 1, hint: "進路は確保できる。外を回るぶん距離が長くなる" },
    { id: "dropBack", label: "一列下げて外へ回す", effect: -1, hint: "自由に動ける。追い出すのが遅くなる" },
    { id: "splitField", label: "馬群を割って前へ", effect: 3, hint: "位置は取れる。ぶつかれば馬が怯む" },
  ],
  dreamStretch: [
    { id: "goNow", label: "ここから追い出す", effect: 1, hint: "先に動いて先頭を奪える。ゴール前で脚が止まる" },
    { id: "waitFurlong", label: "あと1ハロン脚を溜める", effect: 0, hint: "最後まで脚が残る。前が止まらなければ届かない" },
    { id: "sweepOutside", label: "外へ持ち出して一気に", effect: 2, hint: "進路は開く。外を回るぶん距離が長い" },
    { id: "railRun", label: "内をすくう", effect: 4, hint: "最短距離。前が開かなければ詰まる" },
  ],
});
