// 年末のまとめ・引退した馬の画面（`screens/YearEndScreen.jsx`）のための表示用の純関数。
// 見本：`design/mocks/year-end-v1.html`（まとめ＝案A・引退した馬＝案B）。JSXに計算を書かないためにここへ置く。
// データは`domain/yearEnd.js`が組んだ値（`advanceWeek`の`yearEnd`）をそのまま受け取る。JSX無し・`data/`にも依存しない。

const GENDER_LABEL = { colt: "牡", filly: "牝", gelding: "セン" };

/** 馬の部門の行の左に出す短い名前（見出しが「部門ごとの最優秀馬」なので「最優秀」を繰り返さない）。 */
const AWARD_SHORT_LABEL = {
  age2m: "2歳牡馬",
  age2f: "2歳牝馬",
  age3m: "3歳牡馬",
  age3f: "3歳牝馬",
  age4m: "4歳以上牡馬",
  age4f: "4歳以上牝馬",
  sprint: "短距離",
  dirt: "ダート",
};

/** 騎手の部門の行の左に出す短い名前（見出しが「騎手」）。 */
const JOCKEY_SHORT_LABEL = { mostWins: "最多勝利", bestWinRate: "最高勝率", mostPrize: "最多獲得賞金" };

const MARK_LABEL = { main: "主戦", rode: "乗った馬" }; // 番付（`banzukeView.js`）と同じ言葉

const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 円を万円に切り捨てて「336万円」「2億5,649万円」「3億円」の形にする。 */
export function formatOkuManYen(yen) {
  const man = Math.floor((yen ?? 0) / 10000);
  const oku = Math.floor(man / 10000);
  const rest = man % 10000;
  if (oku === 0) return `${comma(rest)}万円`;
  if (rest === 0) return `${comma(oku)}億円`;
  return `${comma(oku)}億${comma(rest)}万円`;
}

export function genderLabel(gender) {
  return GENDER_LABEL[gender] ?? "";
}

/** 馬名の右に添える印（「主戦」「乗った馬」・無ければnull）。 */
export function yearEndMarkLabel(mark) {
  return MARK_LABEL[mark] ?? null;
}

/** 年度代表馬の板。受賞馬が居ない年は`{ none: true }`。 */
export function representativeView(rep) {
  if (!rep || rep.none) return { none: true };
  return {
    none: false,
    name: rep.name,
    mark: yearEndMarkLabel(rep.mark),
    sub: `${rep.age}歳${genderLabel(rep.gender)}馬・${rep.starts}戦${rep.wins}勝・${formatOkuManYen(rep.earnings)}`,
    races: rep.highlight.raceNames,
  };
}

/** 馬の部門の行。 */
export function awardRowsView(awards) {
  return awards.map((a) => ({
    id: a.id,
    label: AWARD_SHORT_LABEL[a.id] ?? a.label,
    none: !!a.none,
    name: a.none ? null : a.name,
    mark: a.none ? null : yearEndMarkLabel(a.mark),
    races: a.none ? [] : a.highlight.raceNames,
  }));
}

function jockeyValueLabel(id, value) {
  if (id === "mostWins") return `${value}勝`;
  if (id === "bestWinRate") return `${(value * 100).toFixed(1)}%`;
  return formatOkuManYen(value);
}

/**
 * 騎手の部門の行。`self`＝受賞者の下に添える自分の行（自分が受賞者なら出さない＝null）。
 * 最高勝率で条件の騎乗数に届かない年は`self.rank`が「対象外」・値は出さない。
 */
export function jockeyRowsView(jockeyAwards) {
  return jockeyAwards.map((j) => {
    const won = j.winner?.isPlayer === true;
    return {
      id: j.id,
      label: JOCKEY_SHORT_LABEL[j.id] ?? j.label,
      winnerName: j.winner?.name ?? "",
      winnerValue: j.winner ? jockeyValueLabel(j.id, j.winner.value) : "",
      winnerIsPlayer: won,
      self: won
        ? null
        : j.player.eligible
        ? { rank: `${j.player.rank}位`, value: jockeyValueLabel(j.id, j.player.value) }
        : { rank: "対象外", value: "" },
    };
  });
}

/**
 * 「自分の1年」の3枚の板（戦績・重賞・稼いだお金）。`sub`＝値の下の行（戦数）・`last`＝前の年の値（1年目はnull）。
 * `hot`＝重賞を勝った年だけ値を黄にする。
 */
export function playerYearTiles(p) {
  const last = p.last;
  return [
    { id: "record", label: "戦績", value: `${p.wins}勝`, sub: `${p.starts}戦`, last: last ? `${last.wins}勝` : null, hot: false },
    { id: "graded", label: "重賞", value: `${p.gradedWins}勝`, sub: null, last: last ? `${last.gradedWins}勝` : null, hot: p.gradedWins > 0 },
    { id: "income", label: "稼いだお金", value: formatOkuManYen(p.income), sub: null, last: last ? formatOkuManYen(last.income) : null, hot: false },
  ];
}

/**
 * G1（1983年までは大レース）の勝ち馬の行。`isMine`＝自分が乗って勝った行。
 * `selfResult`＝自分が乗って負けた行に添える着順（「5着」「落馬」）。乗っていなければnull。
 */
export function g1RowsView(g1Races) {
  return g1Races.map((r, i) => ({
    key: `${i}-${r.raceName}`,
    weekLabel: r.weekLabel,
    raceName: r.raceName,
    winnerName: r.winnerName,
    jockeyName: r.jockeyName,
    isMine: !!r.byPlayer,
    selfResult: r.playerRode && !r.byPlayer ? (r.playerPosition != null ? `${r.playerPosition}着` : "落馬") : null,
  }));
}

const DESTINATION_TEXT = {
  sire: "種牡馬になります",
  broodmare: "繁殖牝馬になります",
  local: "地方へ移りました",
};

/** 引退した馬の札（並びは`buildRetiredHorses`が決めた順のまま）。 */
export function retiredCardsView(retired) {
  return retired.map((h) => ({
    horseId: h.horseId,
    top: [h.age != null ? `${h.age}歳` : null, genderLabel(h.gender), `${h.starts}戦${h.wins}勝`].filter(Boolean).join("・"),
    isMain: !!h.isMain,
    name: h.name,
    g1Lines: h.g1Wins.map((w) => (w.year != null ? `${w.year}年 ${w.raceName}` : w.raceName)),
    rides: h.playerRides > 0 ? `${h.playerRides}回乗りました` : null,
    destination: DESTINATION_TEXT[h.destination] ?? null,
  }));
}
