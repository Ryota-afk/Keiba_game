# 日付の列にある「距離（芝/ダ）」を全部数える。本賞金の列（右端）は除く。
import pdfmap,re,collections,glob,os,pypdf,json
PAT=re.compile(r'^(\d)\s*,\s*(\d)\s*(\d)\s*(\d)$')
def cells_of(path):
    out=[]
    for pg in [0]:
        c=pdfmap.cells(path,pg)
        # 丸数字の列（日付の列）の範囲を求める
        cir=sorted(set(round(x) for y,x,t in c if y>1100 and len(t)==1 and 0x1d00<ord(t)<0x1dff))
        if len(cir)<2: continue
        pitch=cir[1]-cir[0]; lo=cir[0]-pitch*0.55; hi=cir[-1]+pitch*0.55
        # 表の下端（「各日本賞金計」の行）より下は数えない
        foot=max([y for y,x,t in c if x<lo*0.45 and t=='計']+[-1e9])
        by=collections.defaultdict(list)
        for y,x,t in c: by[round(y)].append((x,t))
        for y,v in by.items():
            for x,t in v:
                m=PAT.match(t.strip())
                if not m or not (lo<=x<=hi) or y<foot+15: continue
                d=int(''.join(m.groups()))
                if not (800<=d<=4200): continue
                sur=None
                for x2,t2 in v:
                    if x+12<=x2<=x+40:
                        if 'ダ' in t2: sur='ダート'
                        elif '芝' in t2: sur='芝'
                out.append((d,sur or '?'))
    return out
if __name__=='__main__':
    tot=collections.Counter()
    for p in sorted(glob.glob('jra_bangumi/*.pdf')):
        for d,s in cells_of(p): tot[(s,d)]+=1
    n=sum(tot.values()); print('総数',n)
    bys=collections.Counter()
    for (s,d),v in tot.items(): bys[s]+=v
    print('馬場',bys, {k:round(100*v/n,1) for k,v in bys.items()})
    for s in ['芝','ダート','?']:
        print('---',s)
        print(sorted([(d,v) for (ss,d),v in tot.items() if ss==s]))
