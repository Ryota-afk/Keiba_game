// 落馬・怪我の種類の画面表記（種類そのものは`domain/fall.js`が決める：fracture／bruise）。
// ⚠️画面に種類idを出さない（通しプレイで「fracture」が見えた。`TODO.md` #65）。

export const INJURY_LABELS = Object.freeze({
  fracture: "骨折",
  bruise: "打撲",
});
