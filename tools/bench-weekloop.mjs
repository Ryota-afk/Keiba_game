// 質問14＝(A)「現役馬を全部持って毎週ローテを回す」の時間を測る。
// ⚠️これは下限の値——実際の1頭の判断には距離の照合・芝ダの適性・厩舎のローテの型・
//   出走登録が加わる。実測：30年で1,523ms（1週0.98ms・1年51ms）。
// 使い方： node tools/bench-weekloop.mjs
// 現役5,800頭を毎週まわし、61レースに割り当てて強さ比べで着順を決める。
const N_HORSES = 5800, WEEKS = 52 * 30, RACES_PER_WEEK = 61;
const CLASSES = 6;           // 新馬・未勝利・1勝・2勝・3勝・オープン以上
const SURFACES = 2;
// クラスごとの1日あたり本数（arch/race-program.md）を週の本数に割り直す
const CLASS_W = [1.06, 3.95, 3.09, 1.56, 0.74, 0.60];
const CLASS_P = CLASS_W.map(w => w / 11);
const CLASS_P0 = CLASS_P;  // 馬のクラスの分布もレースの分布に合わせる
const FIELD_BUCKETS = [[5,8,0.306],[9,12,0.380],[13,16,0.233],[17,18,0.032],[19,26,0.049]];

let seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pickField() {
  const r = rnd(); let acc = 0;
  for (const [lo, hi, p] of FIELD_BUCKETS) { acc += p; if (r < acc) return lo + Math.floor(rnd() * (hi - lo + 1)); }
  return 10;
}
// 馬
const cls = new Uint8Array(N_HORSES), sur = new Uint8Array(N_HORSES);
const str = new Float32Array(N_HORSES), earn = new Float32Array(N_HORSES);
const last = new Int32Array(N_HORSES), rest = new Uint8Array(N_HORSES);
for (let i = 0; i < N_HORSES; i++) {
  { const x = rnd(); let acc = 0; cls[i] = CLASSES - 1;
    for (let j = 0; j < CLASSES; j++) { acc += CLASS_P0[j]; if (x < acc) { cls[i] = j; break; } } }
  sur[i] = rnd() < 0.5 ? 0 : 1;
  str[i] = rnd() * 100;
  last[i] = -Math.floor(rnd() * 12);
  rest[i] = 2 + Math.floor(rnd() * 6);   // 次走までの週（2〜7）
}
const t0 = Date.now();
let ran = 0, races = 0;
const byKey = [];                          // (class,surface) ごとの待ち行列
for (let k = 0; k < CLASSES * SURFACES; k++) byKey.push([]);
for (let w = 0; w < WEEKS; w++) {
  for (let k = 0; k < byKey.length; k++) byKey[k].length = 0;
  for (let i = 0; i < N_HORSES; i++) {
    if (w - last[i] >= rest[i]) byKey[cls[i] * SURFACES + sur[i]].push(i);
  }
  for (let r = 0; r < RACES_PER_WEEK; r++) {
    // そのレースのクラスと馬場を引く
    const x = rnd(); let acc = 0, c = CLASSES - 1;
    for (let j = 0; j < CLASSES; j++) { acc += CLASS_P[j]; if (x < acc) { c = j; break; } }
    const s = rnd() < 0.502 ? 0 : 1;
    const q = byKey[c * SURFACES + s];
    if (q.length < 5) continue;
    const size = Math.min(pickField(), q.length);
    // 収得賞金の多い順に並べて上から取る（JRAの規則）
    q.sort((a, b) => earn[b] - earn[a]);
    const field = q.splice(0, size);
    // 強さ比べで着順を決める
    const sc = field.map(i => str[i] + (rnd() - 0.5) * 30);
    let best = 0;
    for (let j = 1; j < field.length; j++) if (sc[j] > sc[best]) best = j;
    for (let j = 0; j < field.length; j++) {
      const i = field[j];
      last[i] = w; rest[i] = 2 + Math.floor(rnd() * 6);
      earn[i] += j === best ? 100 : 10;
      // 昇級は測定では起こさない（クラスの分布を実際の番組表どおりに保つため）
      ran++;
    }
    races++;
  }
}
const ms = Date.now() - t0;
console.log(`30年＝${WEEKS}週・${races}レース・延べ${ran}走： ${ms}ms`);
console.log(`1週あたり ${(ms / WEEKS).toFixed(2)}ms ／ 1年あたり ${(ms / 30).toFixed(0)}ms`);
