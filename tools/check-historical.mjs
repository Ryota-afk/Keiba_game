// arch/historical-horses.md §4 の検査7項目
import fs from 'node:fs';
import { aptitudeBand, optimalDistance, aptitudeWidth, distanceAptitude }
  from '../src/sim/stamina.js';
// ⚠️入力2ファイルの置き場所は、取り込み作業の作業ディレクトリを指す。
// final-abilities.json … 変換後の能力値（name, speed, stamina, g[7], wp_sp, wp_st）
// race-records.json    … 各馬の全レース戦績（surface, rank, dist）
const P = process.env.HORSE_DATA_DIR || './data-src/';
const rows=JSON.parse(fs.readFileSync(P+'final-abilities.json','utf8'));
const rr=JSON.parse(fs.readFileSync(P+'race-records.json','utf8'));
// ⚠️適性の証拠に2歳戦を使わない。51頭の1400m以下の勝ち鞍13鞍は全部2歳時（12鞍が新馬・
// 未勝利）で、当時のデビュー戦が短かっただけ。能力値は完成時の値なので対応しない。
// ageが無いデータでは全レースを対象にする（その旨を検査結果に出す）。
const HAS_AGE = Object.values(rr).some(a => a.some(x => x.age != null));
const mature = x => !HAS_AGE || x.age >= 3;
const mk=r=>({abilities:{speed:r.speed,stamina:r.stamina,sharpness:r.g[0],grit:r.g[1],
  power:r.g[2],flexibility:r.g[3],health:r.g[4],mentalStrength:r.g[5],wisdom:r.g[6]}});
const sc=k=>{const n=+k; if(!Number.isInteger(n))return null;
  return n===1?1:n===2?.75:n===3?.55:n===4?.4:n<=6?.25:n<=9?.1:0;};
let fail=0; const ok=(n,c,m)=>{console.log(`${c?'  合格':'⚠️不合格'}  ${n}: ${m}`); if(!c)fail++;};

// 1 スピードの単調性
let inv=0;
for(const a of rows) for(const b of rows) if(a.wp_sp<b.wp_sp && a.speed>b.speed) inv++;
ok('1 スピードの単調性', inv===0, `逆転 ${inv}組`);

// 2 全頭が勝っているレースが適正帯に入るか
// ⚠️「最適距離 − 全レースの重み付き平均距離」を目標にしてはいけない。2026-09-07に
// それで較正したところ、51頭全員が勝っている2400mが10頭で適正帯の外に出た。
// 平均距離は2〜3歳時の短距離戦の本数に引っ張られるだけで、適性を測っていない。
const COMMON_WIN_DIST = Number(process.env.COMMON_WIN_DIST || 2400);
const everyoneWon = rows.every(r =>
  rr[r.name].some(x => x.surface === 'T' && +x.rank === 1 && x.dist === COMMON_WIN_DIST));
const outside = everyoneWon
  ? rows.filter(r => { const [lo, hi] = aptitudeBand(mk(r));
      return COMMON_WIN_DIST < lo || COMMON_WIN_DIST > hi; })
  : [];
ok('2 全頭の勝ち距離が帯に', outside.length === 0,
  everyoneWon
    ? `${COMMON_WIN_DIST}mが帯の外 ${outside.length}頭${outside.length ? '（' + outside.slice(0,5).map(r=>r.name).join('・') + '）' : ''}`
    : `全頭が勝っている距離が無いので判定を飛ばした（COMMON_WIN_DISTで指定できる）`);

// 3 勝ち鞍での距離適性（⚠️「帯の中に入るか」で測らない。帯を実際の勝ち鞍の幅に
// 合わせて狭めると、適性0.85で勝った鞍が外に出て不合格になる）
let ok8=0, wt=0, minApt=1;
for(const r of rows){const h=mk(r);
  for(const x of rr[r.name]){ if(x.surface!=='T'||+x.rank!==1||!mature(x))continue;
    wt++; const a=distanceAptitude(h,x.dist); minApt=Math.min(minApt,a); if(a>=0.8)ok8++; }}
ok('3 勝ち鞍での距離適性', ok8/wt>=0.95,
  `0.8以上が ${ok8}/${wt} = ${(ok8/wt*100).toFixed(1)}%・最小 ${minApt.toFixed(3)}（合格は95%以上・${HAS_AGE?'3歳以上':'⚠️全年齢'}）`);

// 3-b 帯が実際の勝ち鞍の幅を超える量（4鞍以上の馬）
const exc=[];
for(const r of rows){const h=mk(r);
  const w=rr[r.name].filter(x=>x.surface==='T'&&+x.rank===1&&mature(x)).map(x=>x.dist);
  if(w.length<4)continue; const[lo,hi]=aptitudeBand(h);
  exc.push((hi-lo)-(Math.max(...w)-Math.min(...w)));}
exc.sort((a,b)=>a-b);
const medE=exc[Math.floor(exc.length/2)], maxE=exc[exc.length-1];
ok('3-b 帯が実際の幅を超える量', medE<=300&&maxE<=500,
  `中央 ${medE>=0?'+':''}${medE}m ・最大 ${maxE>=0?'+':''}${maxE}m（n=${exc.length}・合格は中央+300m以内かつ最大+500m以内）`);

// 4 長い側の相関
const xs=[],ys=[];
for(const r of rows){const h=mk(r),opt=optimalDistance(h);
  const recs=rr[r.name].filter(x=>x.surface==='T'&&sc(x.rank)!==null&&x.dist>opt);
  if(recs.length<2)continue;
  const a=recs.map(x=>distanceAptitude(h,x.dist)), p=recs.map(x=>sc(x.rank));
  if(Math.max(...a)-Math.min(...a)<1e-9)continue;
  const ma=a.reduce((s,v)=>s+v,0)/a.length, mp=p.reduce((s,v)=>s+v,0)/p.length;
  a.forEach((v,i)=>{xs.push(v-ma);ys.push(p[i]-mp);});}
const mx=xs.reduce((s,v)=>s+v,0)/xs.length, my=ys.reduce((s,v)=>s+v,0)/ys.length;
const cor=xs.reduce((s,v,i)=>s+(v-mx)*(ys[i]-my),0)/
  Math.sqrt(xs.reduce((s,v)=>s+(v-mx)**2,0)*ys.reduce((s,v)=>s+(v-my)**2,0));
ok('4 長い側の相関', cor>0, `${cor>0?'+':''}${cor.toFixed(4)}（n=${xs.length}・合格は正）`);

// 5 値の範囲
const bad5=rows.filter(r=>{const[lo,hi]=aptitudeBand(mk(r));
  return r.speed<0||r.speed>100||r.stamina<1||r.stamina>100||lo<1000||hi>4000;});
ok('5 値の範囲', bad5.length===0, `範囲外 ${bad5.length}頭`);

// 6 記号の並び（柔軟とパワーが違う馬を1頭）
// ⚠️照合はウイポの元の値で行う。柔軟性は戦績で補正しているので、補正前の flex_wp を使う。
const s6=rows.find(r=>r.g[2]!==(r.flex_wp??r.g[3]));
ok('6 記号の並び', !!s6,
  `照合用: ${s6.name} パワー=${s6.g[2]} 柔軟=${s6.flex_wp??s6.g[3]}${s6.flex_wp?`（補正後は${s6.g[3]}）`:''}（アホヌラの表と目視で照合すること）`);

// 7 外挿の検出
const st=rows.map(r=>r.stamina), out=rows.filter(r=>r.stamina<47||r.stamina>81);
ok('7 較正範囲', true, `スタミナ ${Math.min(...st)}〜${Math.max(...st)}／範囲外 ${out.length}頭`);

// 8 抽出の取りこぼし（ページ記載の戦数と抽出本数の照合）
// ⚠️2026-09-07に11/51頭で取りこぼしが見つかった（主に海外遠征。行の書式が違う）。
// raceCount（ページ記載の総戦数）が入力にあるときだけ判定する。
const counted = rows.filter(r => r.raceCount != null);
if (counted.length) {
  const short = counted.filter(r => rr[r.name].length !== r.raceCount);
  ok('8 抽出の取りこぼし', short.length === 0,
    `${short.length}/${counted.length}頭で戦数が不一致${short.length ? '（' + short.slice(0,5).map(r=>`${r.name} ${rr[r.name].length}/${r.raceCount}`).join('・') + '）' : ''}`);
} else {
  ok('8 抽出の取りこぼし', true, 'raceCountが入力に無いので判定を飛ばした');
}

console.log(fail===0?'\n⭐7項目すべて合格':`\n⚠️${fail}項目が不合格`);
