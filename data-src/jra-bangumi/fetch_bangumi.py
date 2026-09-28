# JRA公式の番組表PDF（2026年・開催ごと）を取得する。1秒あけ・再試行あり・再開可能。
import re,os,time,urllib.request
B="https://www.jra.go.jp/keiba/program/2026/pdf/bangumi/"
OUT="jra_bangumi"
names="""chukyo1 chukyo2 chukyo3 chukyo4 fukushima1 fukushima2 fukushima3
hakodate1-1 hakodate1-2 hanshin1 hanshin2 hanshin3 hanshin4 hanshin5
kokura1-1 kokura1-2 kokura2 kyoto1 kyoto2 kyoto3-1 kyoto3-2 kyoto4-1 kyoto4-2 kyoto5
nakayama1 nakayama2 nakayama3 nakayama4 nakayama5 niigata1 niigata2 niigata3 niigata4
sapporo1 sapporo2 tokyo1 tokyo2-1 tokyo2-2 tokyo3 tokyo4-1 tokyo4-2 tokyo5""".split()
os.makedirs(OUT,exist_ok=True)
for n in names:
    p=os.path.join(OUT,n+".pdf")
    if os.path.exists(p) and os.path.getsize(p)>1000: continue
    for a in range(5):
        try:
            r=urllib.request.Request(B+n+".pdf",headers={"User-Agent":"Mozilla/5.0"})
            d=urllib.request.urlopen(r,timeout=60).read()
            open(p,"wb").write(d); print("ok",n,len(d),flush=True); break
        except Exception as e:
            print("  retry%d %s: %s"%(a+1,n,e),flush=True); time.sleep(3*2**a)
    time.sleep(1)
print("done",len(os.listdir(OUT)))
