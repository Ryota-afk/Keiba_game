// 平日の行動（7種類・ARCHITECTURE.md §7「平日の行動（7種類）」「出会いの4経路」）。
// どのランクで解禁されるかは§8の表をそのまま定数化する。

export const WEEKDAY_ACTIONS = Object.freeze({
  TRAIN: "train", // 朝の調教で乗る
  PITCH: "pitch", // 自分から売り込む
  VISIT_FARM: "visitFarm", // 牧場・セリを見に行く
  MEET_PEOPLE: "meetPeople", // 人に会う
  BUILD_BODY: "buildBody", // 体を作る
  REST: "rest", // 休む
  SHOP: "shop", // 買い物に行く
});

// どのランクから使えるか（ARCHITECTURE.md §8「騎手ランク（6段）と報酬」の「増える行動」列）。
export const ACTION_UNLOCK_RANK = Object.freeze({
  [WEEKDAY_ACTIONS.TRAIN]: "rookie",
  [WEEKDAY_ACTIONS.PITCH]: "rookie",
  [WEEKDAY_ACTIONS.REST]: "rookie",
  [WEEKDAY_ACTIONS.SHOP]: "young",
  [WEEKDAY_ACTIONS.MEET_PEOPLE]: "midCareer",
  [WEEKDAY_ACTIONS.BUILD_BODY]: "veteran",
  [WEEKDAY_ACTIONS.VISIT_FARM]: "elite",
});

// 相手（対象の厩舎・馬主）を必要としない3つ（§7：常に選べる）。
export const NO_PARTNER_ACTIONS = Object.freeze([
  WEEKDAY_ACTIONS.BUILD_BODY,
  WEEKDAY_ACTIONS.REST,
  WEEKDAY_ACTIONS.SHOP,
]);
