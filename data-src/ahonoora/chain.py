# 取得を1本の処理で順に続ける：結果表1974〜2024 → 結果表1968〜1973 → 馬のページ。
import subprocess,sys,os
R=os.path.dirname(os.path.abspath(__file__))
for args in (["fetch.py","1974","2024"],["fetch.py","1968","1973"],["fetch_horses.py"],["fetch_trainers.py"]):
    subprocess.run([sys.executable]+args,cwd=R)
