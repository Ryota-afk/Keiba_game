# 番組表PDFの左端「種別（計）」列を読む。
# 日付の列は丸数字 ᶃᶄᶅ… で始まる。左列の右端＝最初の丸数字x − 列の幅×0.55。
# 検算：種別の（計）の合計＝丸数字の個数（開催日数）×12。
import pdfmap,glob,os,collections,json,pypdf,re
def page_info(path,page):
    c=pdfmap.cells(path,page)
    cir=sorted(set((round(x),t) for y,x,t in c if y>1100 and len(t)==1 and 0x1d00<ord(t)<0x1dff))
    if len(cir)<2: return None
    xs=[x for x,_ in cir]; pitch=xs[1]-xs[0]; edge=xs[0]-pitch*0.55
    m=collections.defaultdict(list)
    for y,x,t in c:
        if x<edge: m[round(y)].append((x,t))
    names=[]
    for y,v in m.items():
        s=''.join(t for x,t in sorted(v) if x>=edge*0.40)
        # 年齢の文字が同じ行に混ざることがあるので、含まれているかで判定する
        k=None
        if '新馬' in s: k='新馬'
        elif '未勝利' in s: k='未勝利'
        elif re.search(r'[123]勝クラス',s): k=re.search(r'[123]勝クラス',s).group(0)
        elif 'オープン' in s: k='オープン'
        if k: names.append((y,k))
    rows=[]
    for y,s in sorted(names,key=lambda p:-p[0]):
        # （N）の N は、この行の下 5〜22pt にある数字のうち最も左のもの。
        # 右側に付く小さい数字は注釈の番号なので、左端を取れば混ざらない。
        # （計）の列だけを見る（左に寄っている年齢の数字を拾わないため）
        cand=sorted([(x,t.replace(' ','')) for yy,v in m.items() if 5<y-yy<22 for x,t in v
                     if x>=edge*0.70 and t.replace(' ','').isdigit()])
        if cand: rows.append((y,s,int(cand[0][1])))
    ages=sorted([(y,t) for y,v in m.items() for x,t in v if edge*0.33<=x<=edge*0.50 and t in set('234歳以上')],key=lambda p:-p[0])
    cl=[]
    for y,t in ages:
        if t in '234' or not cl: cl.append([(y,t)])
        else: cl[-1].append((y,t))
    secs=[(''.join(t for _,t in g),g[0][0],g[-1][0]) for g in cl]
    jy=[y for y,v in m.items() for x,t in v if x<edge*0.33 and t=='障']
    jtop=max(jy)+20 if jy else -1e9
    res=[]
    for y,s,n in rows:
        sec='?'
        for i,(nm,y0,y1) in enumerate(secs):
            hi=1e9 if i==0 else (secs[i-1][2]+y0)/2
            lo=(y1+secs[i+1][1])/2 if i+1<len(secs) else -1e9
            if lo<y<=hi: sec=nm; break
        res.append(('障害' if y<jtop else '平地', sec, s, n))
    return max(ord(t) for _,t in cir)-0x1D82, res
if __name__=='__main__':
    tot=collections.Counter(); per={}; bad=[]; days=0
    for p in sorted(glob.glob('jra_bangumi/*.pdf')):
        rows=[]; d=0
        for pg in range(len(pypdf.PdfReader(p).pages)):
            r=page_info(p,pg)
            if r: d=max(d,r[0]); rows+=r[1]
        s=sum(n for *_,n in rows)
        # 「〜-1」「〜-2」に分かれた開催は、-1 側に開催全体の（計）が載っている。
        # 日数は -2 側の丸数字の最大が開催全体の日数なので、そちらを使う。
        base=os.path.basename(p)
        if base.endswith('-1.pdf'):
            q=p[:-6]+'-2.pdf'
            if os.path.exists(q):
                dd=0
                for pg in range(len(pypdf.PdfReader(q).pages)):
                    r2=page_info(q,pg)
                    if r2: dd=max(dd,r2[0])
                if dd: d=dd
        if base.endswith('-2.pdf') and os.path.exists(p[:-6]+'-1.pdf'):
            continue
        per[base]=dict(days=d,total=s,rows=rows)
        if d and s!=d*12: bad.append((base,d,s,d*12))
        if d and s==d*12:
            days+=d
            for a,b,c2,n in rows: tot[(a,b,c2)]+=n
    print('検算に通らない開催（ファイル, 日数, 読めた合計, あるべき合計）:')
    for b in bad: print('  ',b)
    print('検算に通った日数',days,'／レース',sum(tot.values()))
    for k,v in sorted(tot.items()): print(k,v)
    json.dump(per,open('bangumi_parsed.json','w'),ensure_ascii=False,indent=1)
