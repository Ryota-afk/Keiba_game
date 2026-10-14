# 優駿達の蹄跡（ahonoora.com）から1974〜2024年の中央重賞の結果表ページを取る。
# 1ページごとに1秒待つ。失敗は3/6/12/24/48秒待って最大5回やり直す。取得済みは飛ばす（再開可能）。
import re, sys, time, os, urllib.request
BASE="https://ahonoora.com/"; OUT=os.path.join(os.path.dirname(__file__),"raw")
UA={"User-Agent":"Mozilla/5.0 (Keiba_game data fetch; contact via GitHub Ryota-afk/Keiba_game)"}
def get(path):
    for i,wait in enumerate([3,6,12,24,48]):
        try:
            req=urllib.request.Request(BASE+path,headers=UA)
            with urllib.request.urlopen(req,timeout=30) as r: return r.read()
        except Exception as e:
            log(f"  retry{i+1} {path}: {e}"); time.sleep(wait)
    return None
def log(s):
    with open(os.path.join(os.path.dirname(__file__),"fetch.log"),"a") as f: f.write(s+"\n")
def fetch_to(path, dest):
    if os.path.exists(dest): return open(dest,"rb").read()
    b=get(path); time.sleep(1.0)
    if b is None: log(f"FAIL {path}"); return None
    open(dest,"wb").write(b); return b
y0,y1=int(sys.argv[1]),int(sys.argv[2])
total=0
for y in range(y0,y1+1):
    ydir=os.path.join(OUT,str(y)); os.makedirs(ydir,exist_ok=True)
    g=fetch_to(f"grade_{y}.html", os.path.join(ydir,f"grade_{y}.html"))
    if g is None: continue
    t=g.decode("shift_jis","replace")
    links=[]
    for row in re.findall(r"<tr[^>]*>(.*?)(?=<tr|</table)",t,flags=re.S|re.I):
        if not re.search(r"<td[^>]*>\s*\d\d/\d\d",row,flags=re.I): continue
        hs=[h for h in re.findall(r"href=['\"]?([^'\" >]+)",row,flags=re.I) if str(y) in h]
        if hs: links.append(hs[0])
    log(f"{y}: {len(links)} races")
    for h in links:
        if fetch_to(h, os.path.join(ydir,h)) is not None: total+=1
log(f"DONE {y0}-{y1}: {total} race pages")
