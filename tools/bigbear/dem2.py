import json,math,urllib.request,time
M=json.load(open('grid_meta.json'));lat0,lon0=M['lat0'],M['lon0']
kx=111320*math.cos(math.radians(lat0));kz=110574
N=61;step=200.0;pts=[]
for j in range(N):
    for i in range(N):
        rx=M['cxr']+(i-30)*step; rz=M['czr']+(j-30)*step
        pts.append((lat0-rz/kz, lon0+rx/kx))
out=[None]*len(pts)
for k in range(0,len(pts),100):
    ch=pts[k:k+100]
    u='https://api.opentopodata.org/v1/srtm30m?locations='+'|'.join('%.5f,%.5f'%p for p in ch)
    for t in range(8):
        try:
            r=json.load(urllib.request.urlopen(u,timeout=40))['results']
            for q,e in enumerate(r): out[k+q]=e['elevation']
            break
        except Exception as e:print('retry',k,e);time.sleep(6)
    time.sleep(1.3)
miss=sum(v is None for v in out);print('missing',miss)
json.dump({'N':N,'step':step,'elev':out},open('dem.json','w'))
