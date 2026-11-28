# 馬のページ（rawh/*.html）の全戦績から、出走頭数・出走間隔・年間出走数を測る。
# ⚠️行の列数は14と15の2通りある（15は4列目が空）。「N頭」の列を探して読むこと。
import re,glob,collections,statistics,datetime
JRA=set("札幌 函館 福島 新潟 東京 中山 中京 京都 阪神 小倉".split())
def parse(p):
    b=re.sub(r"<(script|style)[^>]*>.*?</\1>","",open(p,"rb").read().decode("shift_jis","replace"),flags=re.S|re.I)
    out=[];y=None
    for r in re.findall(r"<tr[^>]*>(.*?)(?=<tr|</table)",b,flags=re.S|re.I):
        c=[re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",x)).strip() for x in re.split(r"<t[dh][^>]*>",r,flags=re.I)[1:]]
        if len(c)<13: continue
        m=re.match(r"(?:(\d{4})\.\s*)?(\d{1,2})\.\s*(\d{1,2})$",c[0])
        if not m: continue
        if m.group(1): y=int(m.group(1))
        if y is None: continue
        try: d=datetime.date(y,int(m.group(2)),int(m.group(3)))
        except: continue
        tou=next((int(re.match(r"(\d+)頭",x).group(1)) for x in c[3:6] if re.match(r"\d+頭",x)),None)
        out.append((d,c[1],c[2],tou))
    return out
if __name__=="__main__":
    allr=[];fields=[];gaps=[];peryear={};span={}
    for p in sorted(glob.glob("rawh/*.html")):
        rs=parse(p); allr+=rs; prev=None; cnt=collections.Counter()
        for d,co,nm,tou in rs:
            if co not in JRA: continue
            if tou: fields.append((d.year,tou))
            if prev: gaps.append((d-prev).days/7)
            prev=d; cnt[d.year]+=1
        peryear[p]=cnt
        ys=[d.year for d,_,_,_ in rs]
        if ys: span[p]=(min(ys),max(ys))
    jra=[r for r in allr if r[1] in JRA]
    v=[x for _,x in fields]
    print("馬",len(peryear),"総出走",len(allr),"JRA",len(jra),"頭数が読めた",len(v),"区間",len(gaps),"年の範囲",min(r[0].year for r in allr),"-",max(r[0].year for r in allr))
    print("頭数: 平均",round(statistics.mean(v),2),"中央値",statistics.median(v),"最小",min(v),"最大",max(v),"／18頭以上",sum(1 for x in v if x>=18),f"({100*sum(1 for x in v if x>=18)/len(v):.1f}%)")
    print("分布:",sorted(collections.Counter(v).items()))
    print("間隔(週): 平均",round(statistics.mean(gaps),2),"中央値",round(statistics.median(gaps),2),"8週以内",f"{100*sum(1 for x in gaps if x<=8)/len(gaps):.1f}%")
    print("間隔の分布:",sorted(collections.Counter(min(int(x),20) for x in gaps).items()))
    full=[n for p,c in peryear.items() for y,n in c.items() if span[p][0]<y<span[p][1]]
    allpy=[n for c in peryear.values() for n in c.values()]
    print("年間出走数（丸1年現役の年だけ）: n",len(full),"平均",round(statistics.mean(full),2),"中央値",statistics.median(full))
    print("年間出走数（デビュー年・引退年も含む）: n",len(allpy),"平均",round(statistics.mean(allpy),2),"中央値",statistics.median(allpy))
    careers=[sum(c.values()) for c in peryear.values()]
    print("JRAの生涯出走数: 平均",round(statistics.mean(careers),1),"中央値",statistics.median(careers))
