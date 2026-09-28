# 引退中央調教師名鑑（trainers.html）の185人のページを取る。再開可能・1秒待ち。
import re,os,time,urllib.request
ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(ROOT,"rawt"); os.makedirs(OUT,exist_ok=True)
UA={"User-Agent":"Mozilla/5.0 (Keiba_game data fetch; contact via GitHub Ryota-afk/Keiba_game)"}
def get(p):
    for w in (3,6,12,24,48):
        try:
            with urllib.request.urlopen(urllib.request.Request("https://ahonoora.com/"+p,headers=UA),timeout=30) as r: return r.read()
        except Exception: time.sleep(w)
    return None
idx=os.path.join(OUT,"trainers.html")
if not os.path.exists(idx): open(idx,"wb").write(get("trainers.html")); time.sleep(1)
t=open(idx,"rb").read().decode("shift_jis","replace")
hrefs=sorted(set(h for h in re.findall(r"href=['\"]?([^'\" >]+)",t,flags=re.I) if h.startswith("tr_")))
n=0
for h in hrefs:
    d=os.path.join(OUT,h)
    if os.path.exists(d): continue
    b=get(h); time.sleep(1.0)
    if b: open(d,"wb").write(b); n+=1
open(os.path.join(ROOT,"fetch_trainers.log"),"a").write(f"targets {len(hrefs)} fetched {n}\n")
