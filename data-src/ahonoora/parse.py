# raw/{year}/*.html（結果表ページ）→ parsed/{year}.json
import re, os, json, sys, glob
ROOT=os.path.dirname(os.path.abspath(__file__))
def txt(s): return re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",s)).strip()
def parse_race(path, year):
    t=open(path,"rb").read().decode("shift_jis","replace")
    body=re.sub(r"<(script|style)[^>]*>.*?</\1>","",t,flags=re.S|re.I)
    mh=re.search(r"<t[dh][^>]*>\s*着順",body); i=mh.start() if mh else body.find("着順"); head=txt(body[:i])
    head=head.split("アホヌラゲーム館")[-1].strip()
    race={"file":os.path.basename(path),"year":year,"raw_head":head[:200]}
    h=head.split("馬名をクリック")[0]
    def g(p,s=h,flags=0):
        m=re.search(p,s,flags); return m
    m=g(r"第(\d+)回"); race["round"]=int(m.group(1)) if m else None
    m=g(r"(\d{4})[/.]\s*(\d{1,2})[/.]\s*(\d{1,2})")
    race["date"]=f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else None
    # レース名：「第N回 」の直後から日付または「■」まで
    m=g(r"第\d+回\s*(.+?)\s*(?:■|\d{4}[/.])")
    race["name"]=m.group(1).strip() if m else None
    m=g(r"(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)(?:競馬場)?\s*(\d+)?R?")
    race["course"]=m.group(1) if m else None; race["raceNo"]=int(m.group(2)) if (m and m.group(2)) else None
    m=g(r"(芝|ダート|ダ|障害|障)\s*(\d{3,4})\s*(?:m|メートル)(?:（(左|右|直)[^）]*）)?")
    race["surface"]={"芝":"turf","ダ":"dirt","ダート":"dirt"}.get(m.group(1),"jump") if m else None
    race["distance"]=int(m.group(2)) if m else None; race["turn"]=m.group(3) if m else None
    m=g(r"(晴|曇|小雨|雨|小雪|雪)\s+(良|稍重|重|不良)"); race["weather"]=m.group(1) if m else None; race["track"]=m.group(2) if m else None
    m=g(r"R\s+(.*?)\s+(?:芝|ダ|障)"); race["condition"]=m.group(1).strip() if m else None
    m=g(r"本賞金（万円）\s*1着([\d,]+)") or g(r"本賞金\s*1着([\d,]+)万円")
    race["prize1"]=int(m.group(1).replace(",",""))*10000 if m else None
    race["isArab"]=("アラブ" in h) or ("アラブ" in (race["condition"] or ""))
    if not (race["date"] and race["course"] and race["distance"]): race["parse_error"]="head"
    rows=[]
    for r in re.findall(r"<tr[^>]*>(.*?)(?=<tr|</table)",body[i-200:],flags=re.S|re.I):
        cells=re.split(r"<t[dh][^>]*>",r,flags=re.I)[1:]
        if len(cells)<10: continue
        c=[txt(x) for x in cells]
        if not re.match(r"\d+着|取消|除外|中止",c[0]): continue
        href=re.search(r"href=['\"]?([^'\" >]+)",cells[3],flags=re.I)
        rows.append({"pos":c[0],"waku":c[1],"num":c[2],"name":c[3],"horseHref":href.group(1) if href else None,
                     "sexAge":c[4],"weight":c[5],"jockey":c[6],"trainer":c[7],"timeOrMargin":c[8],"pop":c[9]})
    race["entries"]=rows
    if not rows: race["parse_error"]=race.get("parse_error","")+"rows"
    return race
years=sys.argv[1:] or sorted(os.listdir(os.path.join(ROOT,"raw")))
os.makedirs(os.path.join(ROOT,"parsed"),exist_ok=True)
for y in years:
    files=sorted(f for f in glob.glob(os.path.join(ROOT,"raw",y,"*.html")) if not os.path.basename(f).startswith("grade_"))
    races=[parse_race(f,int(y)) for f in files]
    json.dump(races,open(os.path.join(ROOT,"parsed",f"{y}.json"),"w"),ensure_ascii=False,indent=0)
    errs=[r["file"] for r in races if "parse_error" in r]
    print(y,"races",len(races),"entries",sum(len(r["entries"]) for r in races),"errors",len(errs),errs[:5])
