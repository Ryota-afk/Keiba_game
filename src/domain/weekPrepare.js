// 週の初めの処理（クラスの決め直し・未勝利のまま3歳の9月7日を迎えた馬を中央から外す）。
// ⭐第13弾（`devlog/wave13.md`§17）：週の画面と`advanceWeek`が**同じ名簿・同じ依頼一覧**を
// 見るために、この処理を1か所へ出した。画面は進める前の名簿に対してこれを呼んでから依頼を
// 作り、`advanceWeek`も入口で同じ関数を呼ぶ。⚠️どちらも未処理の名簿から呼んで同じ結果になる
// （決定的）。処理済みの名簿へもう一度呼んでも何も起きない（外れた馬は`isRetired`・クラスは同じ値）。
// 純ロジック（JSX無し）。

import { reclassAndRetireMaidens } from "./horseClass.js";
import { isMainMount } from "./mainMount.js";
import { withJockeyDefaults } from "./jockey.js";

/**
 * @param {{ horses: object[], npcJockeys: object[] }} roster
 * @param {object} player - `currentWeek`・`currentYear`・`mainMounts`を持つ
 * @returns {{ roster: object, player: object, leftForLocal: {horseId:string, horseName:string}[] }}
 *   `leftForLocal`＝この処理で新しく中央を去った、プレイヤーの主戦の馬。`player`には
 *   `leftForLocalThisYear`へ貯めたものを載せて返す（年末の「引退した馬」用）。
 */
export function prepareWeek(roster, player) {
  const week = player.currentWeek;
  const reclassed = reclassAndRetireMaidens(roster.horses, week, player.currentYear);
  const nextRoster = {
    ...roster,
    horses: reclassed.horses,
    npcJockeys: roster.npcJockeys.map(withJockeyDefaults),
  };
  const leftForLocal = reclassed.leftForLocal
    .filter((h) => isMainMount(player.mainMounts ?? {}, h.id))
    .map((h) => ({ horseId: h.id, horseName: h.name }));
  let nextPlayer = player;
  if (leftForLocal.length > 0) {
    nextPlayer = {
      ...player,
      leftForLocalThisYear: [
        ...(player.leftForLocalThisYear ?? []),
        ...leftForLocal.map((x) => ({ ...x, year: player.currentYear, week })),
      ],
    };
  }
  return { roster: nextRoster, player: nextPlayer, leftForLocal };
}
