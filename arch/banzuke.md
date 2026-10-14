# 番付のデータ（`devlog/wave12.md`§15・§18・§19）

競馬界全体の今年の顔ぶれ。画面（週の「番付」タブ）は`buildBanzuke`の戻り値をそのまま描く。
この節は**データ側**の正本。ユーザー決定：並べる順＝今年の獲得賞金・各10頭・前の年の番付も見られる。

## 材料（どこに何を持つか）
| 欄 | 持ち主 | 更新するところ |
|---|---|---|
| `horse.record.yearStats` = `{ year, earnings, starts, wins, turf, dirt, distanceSum, lastBigWinName }` | 馬 | `domain/horse.js`の`appendRaceResultWithEarnings`が、レースを積むたびに`domain/horseYearStats.js`の`bumpYearStats`で更新 |
| `player.record.byYear[year].horseIds` | プレイヤー | `domain/playerRecord.js`の`applyRideToRecord`（引数`horseId`。重複なし・落馬した鞍の馬も入る） |
| `roster.lastYearBanzuke` | ロースター | 年の終わりに1年分だけ保存（下記） |
| `jockey.winsByYear[year]`（NPC騎手） | 騎手 | 本編は`weekLoop.js`、事前シミュレーションは`bootstrap.js`の`runBootstrapWeek`が`domain/npcJockeyWins.js`の`countWinnerJockeys`→`recordJockeyWins`で積む |

- ⭐**`yearStats`はレースの年（`historyEntry.year`）が変わったら0から数え直す**（`bumpYearStats`）。年が分からない呼び出しは今ある欄の年のまま積む。
  古いセーブ（欄が無い馬）でも落ちない（無ければここで初めて作る）。番付側は`yearStats.year === 今年`の馬だけ見る。
- ⭐**`lastBigWinName`＝今年勝った一番新しい重賞の名前**。「重賞かどうか」は`grade`ではなくレース名の有無（1983年以前は`grade`が全部null・
  `devlog/wave12.md`§10）。NPCの重賞（`npcGradedRace.js`）は`isGraded=true`で`race.name`が入る。プレイヤーが乗った重賞の鞍は
  `weekResults.js`が`mount.raceName`を第4引数で渡す（⚠️賞金と`gradedWins`は従来どおりクラス基準のまま——プレイヤーが乗った重賞の鞍の賞金は
  重賞の1着賞金ではなく一般競走の額で積まれる、という既存の不整合は直していない）。
- `starts/wins`は今年の戦数・勝ち数、`turf/dirt`は今年走った馬場の回数、`distanceSum/starts`が今年の平均距離。

## 番付を組む純関数（`view/banzukeView.js`）
`buildBanzuke({ roster, player, year })` → `{ year, boards: [{ id, label, rows }], jockeys: { rows, self } }`。
表の定義（id・画面表記・10頭・1800m・3歳）は`data/banzukeBoards.js`。`player`が`null`（事前シミュレーション）なら
「自分が乗った馬」「主戦」は全部false・`jockeys.self`はnull。

- 行：`{ rank, horseId, name, earnings, starts, wins, lastBigWinName, riddenByPlayer, isMainMount }`。順位＝今年の賞金の多い順、同額は馬idの順。
  `riddenByPlayer`＝`player.record.byYear[year].horseIds`に入っているか、`isMainMount`＝`player.mainMounts[horseId]?.isMain`。
- 入る馬：今年1戦以上・今年の獲得賞金が0より大きい・`bornYear`のある3歳以上。2歳は入れない。
- 分け方（今年走った馬場：`dirt > turf`ならダート、同数は芝）：3歳×芝→牡馬・騸馬は`3yo-colt`、牝馬は`3yo-filly`／3歳×ダート→`3yo-dirt`／
  4歳以上×芝→今年の平均距離が1800m以下なら`older-mile`、超えたら`older-classic`（牝馬はさらに`older-filly`にも入る）／4歳以上×ダート→`older-dirt`。
- 騎手：NPC騎手（全員）とプレイヤーを今年の勝ち数の多い順（同数は名前の順）に並べた上位10人＋`self: { rank, wins, of }`（10位より下でも出る）。
- ⚠️`view/`は`domain/`をimportしない層。年齢は`year - bornYear`をここで直接書いている（`domain/retirement.js`の`horseAge`と同じ式）。

## 前の年の番付の保存と取り出し
- **保存**：年が替わる週の終わりに、終わったばかりの年の番付を`roster.lastYearBanzuke`へ入れる（上書き＝1年分だけ）。
  本編は`weekLoop.js`の`advanceWeek`（`week % 52 === 0`のとき、年の繰り上げの直前に`buildBanzuke`）、事前シミュレーションは
  `bootstrap.js`の年の境目（`processYearBoundary`の直前）。⚠️**年の区切りの処理で馬が名簿から抜ける前に作る**（保存した番付は
  名前・賞金を自分で持つので、後から馬が消えても見られる）。
- **取り出し**：`lastYearBanzuke(roster)`（無ければnull＝古いセーブ）。本編1年目の1月は事前シミュレーション2年目（開始年−1）の番付。
- 保存の形はプレーンな数値・文字列・真偽・nullだけ（JSON往復で壊れない）。セーブ（`state/saveGame.js`）は`roster`ごと保存するので変更なし
  （`SAVE_SCHEMA_VERSION`も据え置き。古いセーブは`lastYearBanzuke`が無いだけで動く）。
- ⭐`processYearBoundary`は事前シミュレーションに加えて**本編の`advanceWeek`でも年の最終週に走る**（2026-10-12・`TODO.md` #122）。
  番付の保存はどちらも`processYearBoundary`の前（馬が抜ける前の顔ぶれで作る）。本編の最終週の結果画面は`advanceWeek`の戻り値の
  `weekEndHorses`（区切り前の馬）を使う。保存した番付は名前・賞金を自分で持つので、引退・繁殖入りで名簿から消えた馬も見られる。

## 触ると壊れるところ
- `appendRaceResultWithEarnings`の戻り値に`yearStats`が増えた：`record`の形を決め打ちで比較している箇所があれば注意。
- `runBootstrapWeek`がNPC騎手の`winsByYear`を積むようになった（乱数は使わないので世界は変わらない）。
