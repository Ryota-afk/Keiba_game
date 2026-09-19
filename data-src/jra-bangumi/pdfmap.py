# JRA番組表PDF：埋め込みフォントにToUnicodeが無く文字化けするので、
# 数字（U+030C〜U+0315）と、番組表に出てくる語の対応表で読む。
import pypdf
DIG={chr(0x30c+i):str(i) for i in range(10)}
WORDS={'৽അ':'新馬','ະউར':'未勝利','Φʔϓϯ':'オープン','߹ࠞ':'混合','໒':'牝','ࢦ':'指',
 'ผఆ':'別定','μ':'ダ','ࣳ':'芝','উΫϥε':'勝クラス','঩':'障','ো':'障','ఆྔ':'定量','അྸ':'馬齢',
 'ϋϯσ':'ハンデ','ಛࢦ':'特指','ࡀ':'歳','Ҏ':'以','্':'上','Ҏ্':'以上','ฏ':'平','஍':'地','ڝ':'競','૸':'走',
 'छ':'種','ผ':'別','ܭ':'計','Ұൠ':'一般','ಛผ':'特別','ઍԁ':'千円'}
def dec(t):
    t=''.join(DIG.get(c,c) for c in t).replace('ɼ',',')
    for a,b in WORDS.items(): t=t.replace(a,b)
    return t
def cells(path,page):
    out=[]
    def v(text,cm,tm,fd,fs):
        s=text.strip()
        if s: out.append((round(tm[5],1),round(tm[4],1),dec(s)))
    pypdf.PdfReader(path).pages[page].extract_text(visitor_text=v)
    return out
