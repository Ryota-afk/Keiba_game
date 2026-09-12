# parsed/*.json の horseHref（アラブ系レースだけの馬を除く）から馬のページを取る。再開可能・1秒待ち。
import json,glob,os,re,time,urllib.request
ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(ROOT,"rawh"); os.makedirs(OUT,exist_ok=True)
UA={"User-Agent":"Mozilla/5.0 (Keiba_game data fetch; contact via GitHub Ryota-afk/Keiba_game)"}
def log(s):
    with open(os.path.join(ROOT,"fetch_horses.log"),"a") as f: f.write(s+"\n")
hrefs=[]
for f in sorted(glob.glob(os.path.join(ROOT,"parsed","*.json"))):
    for r in json.load(open(f)):
        if r.get("isArab"): continue
        for e in r["entries"]:
            h=e.get("horseHref")
            if h and h not in hrefs: hrefs.append(h)
log(f"targets {len(hrefs)}")
n=0
for h in hrefs:
    dest=os.path.join(OUT,h)
    if os.path.exists(dest): continue
    for w in (3,6,12,24,48):
        try:
            with urllib.request.urlopen(urllib.request.Request("https://ahonoora.com/"+h,headers=UA),timeout=30) as r: b=r.read(); break
        except Exception as ex: log(f"  retry {h}: {ex}"); time.sleep(w)
    else: log(f"FAIL {h}"); continue
    open(dest,"wb").write(b); n+=1; time.sleep(1.0)
log(f"DONE fetched {n}")
