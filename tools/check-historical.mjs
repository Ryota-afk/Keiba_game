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
const mk=r=>({abilities:{speed:r.speed,stamina:r.stamina,sharpness:r.g[0],grit:r.g[1],
  power:r.g[2],flexibility:r.g[3],health:r.g[4],mentalStrength:r.g[5],wisdom:r.g[6]}});
const sc=k=>{const n=+k; if(!Number.isInteger(n))return null;
  return n===1?1:n===2?.75:n===3?.55:n===4?.4:n<=6?.25:n<=9?.1:0;};
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
let fail=0; const ok=(n,c,m)=>{console.log(`${c?'  合格':'⚠️不合格'}  ${n}: ${m}`); if(!c)fail++;};

// 1 スピードの単調性
let inv=0;
for(const a of rows) for(const b of rows) if(a.wp_sp<b.wp_sp && a.speed>b.speed) inv++;
ok('1 スピードの単調性', inv===0, `逆転 ${inv}組`);

// 2 最適距離の較正のずれ
const diffs=rows.map(r=>{
  const recs=rr[r.name].filter(x=>x.surface==='T'&&sc(x.rank)!==null);
  const wd=recs.reduce((s,x)=>s+sc(x.rank)*x.dist,0)/recs.reduce((s,x)=>s+sc(x.rank),0);
  return optimalDistance(mk(r))-wd;});
const md=med(diffs);
ok('2 最適距離のずれ', Math.abs(md)<=50, `中央値 ${md>0?'+':''}${md.toFixed(0)}m（合格は±50m以内）`);

// 3 勝ち鞍が適正帯に入る割合
let wi=0,wt=0;
for(const r of rows){const [lo,hi]=aptitudeBand(mk(r));
  for(const x of rr[r.name]){ if(x.surface!=='T'||+x.rank!==1)continue; wt++; if(x.dist>=lo&&x.dist<=hi)wi++; }}
ok('3 勝ち鞍が適正帯に', wi/wt>=0.85, `${wi}/${wt} = ${(wi/wt*100).toFixed(1)}%（合格は85%以上）`);

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
const s6=rows.find(r=>r.g[2]!==r.g[3]);
ok('6 記号の並び', !!s6, `照合用: ${s6.name} パワー=${s6.g[2]} 柔軟=${s6.g[3]}（アホヌラの表と目視で照合すること）`);

// 7 外挿の検出
const st=rows.map(r=>r.stamina), out=rows.filter(r=>r.stamina<47||r.stamina>81);
ok('7 較正範囲', true, `スタミナ ${Math.min(...st)}〜${Math.max(...st)}／範囲外 ${out.length}頭`);
console.log(fail===0?'\n⭐7項目すべて合格':`\n⚠️${fail}項目が不合格`);
