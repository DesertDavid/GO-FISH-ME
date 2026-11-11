import json,math
d=json.load(open('lake.json'));r=d['elements'][0]
lat0,lon0=34.2535,-116.92
kx=111320*math.cos(math.radians(lat0));kz=110574
P=lambda p:((p['lon']-lon0)*kx,-(p['lat']-lat0)*kz)
ways=[(m['role'],[P(p) for p in m['geometry']]) for m in r['members']]
outer=[w for ro,w in ways if ro=='outer'];inner=[w for ro,w in ways if ro=='inner']
# chain outers
segs=[list(w) for w in outer];ring=segs.pop(0)
def close(a,b):return math.hypot(a[0]-b[0],a[1]-b[1])<0.5
while segs:
    for i,s in enumerate(segs):
        if close(ring[-1],s[0]):ring+=s[1:];segs.pop(i);break
        if close(ring[-1],s[-1]):ring+=s[::-1][1:];segs.pop(i);break
    else:print('gap',len(segs),ring[-1],[ (s[0],s[-1]) for s in segs]);break
def area(p):return abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))/2
print('outer pts',len(ring),'closed',close(ring[0],ring[-1]),'area km2',area(ring)/1e6,'acres',area(ring)/4046.86)
xs=[p[0] for p in ring];zs=[p[1] for p in ring]
print('x',min(xs),max(xs),'z',min(zs),max(zs))
for w in inner:
    cx=sum(p[0] for p in w)/len(w);cz=sum(p[1] for p in w)/len(w);print('island',round(cx),round(cz),'area m2',round(area(w)),len(w))
json.dump({'ring':ring,'inner':inner,'lat0':lat0,'lon0':lon0},open('ring.json','w'))
