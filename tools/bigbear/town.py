import json,math,random,collections
import numpy as np
random.seed(7)
lat0,lon0=34.2535,-116.92
kx=111320*math.cos(math.radians(lat0));kz=110574
M=json.load(open('grid_meta.json'));sd=np.load('grid_sd.npy')
def G(p):return ((p['lon']-lon0)*kx-M['cxr'])*M['scale'],((-(p['lat']-lat0)*kz)-M['czr'])*M['scale']
def SD(x,z):
    i=(x-M['x0'])/M['cell'];j=(z-M['z0'])/M['cell']
    if i<0 or j<0 or i>=M['NX'] or j>=M['NZ']: return 999
    return float(sd[int(max(0,min(M['NZ']-1,j))),int(max(0,min(M['NX']-1,i)))])
rows=json.load(open('blds_game.json'))
# select: commercial spacing 14; houses: lakefront band spacing 24, behind 44, limit
sel=[];occ={}
def free(x,z,sp):
    cx,cz=int(x//sp),int(z//sp)
    for a in(-1,0,1):
        for b in(-1,0,1):
            for (px,pz) in occ.get((cx+a,cz+b,sp),[]):
                if (px-x)**2+(pz-z)**2<sp*sp:return False
    return True
def put(x,z,sp):occ.setdefault((int(x//sp),int(z//sp),sp),[]).append((x,z))
rows=[r for r in rows if r[3]>4 and r[2]!='x']
com=[r for r in rows if r[2]=='c'];hou=[r for r in rows if r[2]=='h']
for x,z,c,s in com:
    if free(x,z,13): put(x,z,13); sel.append((x,z,1))
random.shuffle(hou)
cap=700
for x,z,c,s in sorted(hou,key=lambda r:r[3]>=127):   # lakefront first
    sp=24 if s<90 else 40
    if s>=127: sp=52
    if len(sel)>=cap+len(com):break
    if free(x,z,sp): put(x,z,sp); sel.append((x,z,0))
print('selected',len(sel),'commercial',sum(1 for s in sel if s[2]))
# roads
R=json.load(open('roads.json'))['elements']
roads=[]
for e in R:
    t=e['tags'];h=t['highway'];nm=t.get('name','')
    if h=='residential' or h=='unclassified' and nm not in('Pine Knot Avenue',): continue
    pts=[G(p) for p in e['geometry']]
    # resample to ~14 m spacing
    out=[pts[0]]
    for p in pts[1:]:
        while math.hypot(p[0]-out[-1][0],p[1]-out[-1][1])>16:
            dx,dz=p[0]-out[-1][0],p[1]-out[-1][1];L=math.hypot(dx,dz);out.append((out[-1][0]+dx/L*14,out[-1][1]+dz/L*14))
        out.append(p)
    # keep runs inside the map and on land (except the Stanfield causeway / dam bridge)
    keepwater=nm in('Stanfield Cutoff','Big Bear Bridge') 
    run=[]
    for x,z in out:
        ok=abs(x)<2380 and abs(z)<2380 and (SD(x,z)>5 or keepwater and SD(x,z)>-400)
        if ok:run.append((round(x),round(z)))
        else:
            if len(run)>1:roads.append((h,nm,run))
            run=[]
    if len(run)>1:roads.append((h,nm,run))
print('roads',len(roads),sum(len(r[2]) for r in roads),collections.Counter(r[1] for r in roads).most_common(8))
js="// Big Bear Lake settlement data (OpenStreetMap, 2026-11): building centres [x, z, 1 = shop/hotel] and main roads (game metres). Baked by tools/bigbear/town.py.\n"
js+="export const BB_BUILDINGS = "+json.dumps([[round(x),round(z),c] for x,z,c in sel],separators=(',',':'))+";\n"
js+="export const BB_ROADS = "+json.dumps([[('P' if h in('primary','trunk') else 'S' if h=='secondary' else 'T'),nm,[v for p in run for v in p]] for h,nm,run in roads],separators=(',',':'))+";\n"
open('bigbearTown.js','w').write(js);print(len(js))
