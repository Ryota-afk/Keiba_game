// 馬1頭ぶんのセーブの大きさを、戦績の持ち方3通り×2形式で測る（決定D）。
// 実測（2026-09-15）：詰めた形で 全22走460／直近5走222／集計だけ155バイト。
//   16,000頭で 7.02／3.39／2.37MB。項目名を持つ普通の形だと25.7／13.8／10.1MB。
// ⚠️localStorageは5MBまで。全22走は入らない。
// 使い方： node tools/bench-savesize.mjs
const base = {
  id: "h-12345", name: "サクラハヤテオー", gender: "牡", growthType: "late",
  bloodlineFamily: "ND", sireId: "h-00123", damId: "h-00456", bornYear: 1971,
  stableId: "s-088", ownerId: "o-042", isHistorical: false, isRetired: false,
  classId: "win2",
  abilities: { speed: 78, stamina: 64, sharpness: 61, grit: 55, flexibility: 70,
               wisdom: 52, health: 66, power: 58, mentalStrength: 61 },
  surfaceAptitude: { turf: 3, dirt: 1 },
  adaptability: { burst: 4, endurance: 2, attrition: 1 },
  lastRaceWeek: 812, earnings: 12400000,
  disclosure: { openedA: ["speed", "stamina"], openedB: ["wisdom"], missA: 1, missB: 0 },
};
const summary = { starts: 22, wins: 5, seconds: 4, thirds: 3 };
const one = (i) => ({ w: 700 + i * 4, r: "r-1974-088", pos: 1 + (i % 9), field: 11 });
const variants = {
  "(ア) 1走ずつ全部（生涯22走）": { ...base, record: { ...summary, history: Array.from({length:22}, (_,i)=>one(i)) } },
  "(イ) 集計＋直近5走": { ...base, record: { ...summary, recent: Array.from({length:5}, (_,i)=>one(i)) } },
  "(ウ) 集計だけ": { ...base, record: summary },
};
const KEEP = 16000;   // 残す頭数（現役5,800＋繁殖の延べ＋プレイヤーが乗った馬）
for (const [k, v] of Object.entries(variants)) {
  const b = new TextEncoder().encode(JSON.stringify(v)).length;
  console.log(`${k}: 1頭 ${b}バイト → ${KEEP}頭で ${(b*KEEP/1024/1024).toFixed(2)}MB`);
}

// 詰めた形：キー名を持たない配列にする
const packed = (hist) => [
  12345, "サクラハヤテオー", 0, 2, 1, 123, 456, 1971, 88, 42, 0, 0, 3,
  [78,64,61,55,70,52,66,58,61], [3,1], [4,2,1], 812, 12400000,
  [[0,1],[2]], [1,0], [22,5,4,3], hist,
];
const hist22 = Array.from({length:22},(_,i)=>[700+i*4, 88, 1+(i%9), 11]);
const hist5 = hist22.slice(0,5);
for (const [k, v] of [["(ア)詰めた形・全22走", packed(hist22)],
                      ["(イ)詰めた形・直近5走", packed(hist5)],
                      ["(ウ)詰めた形・集計だけ", packed(null)]]) {
  const b = new TextEncoder().encode(JSON.stringify(v)).length;
  console.log(`${k}: 1頭 ${b}バイト → ${KEEP}頭で ${(b*KEEP/1024/1024).toFixed(2)}MB`);
}
