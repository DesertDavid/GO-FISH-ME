import numpy as np, json, math, base64
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
dep=np.load('bath/dep.npy'); fit=json.load(open('bath/fit.json')); sc,th,tx,ty=fit['p']
R=json.load(open('ring.json'));ring=np.array(R['ring']);inner=[np.array(w) for w in R['inner']]
SCALE=0.4; CELL=8.0   # game m per cell
cxr=(ring[:,0].min()+ring[:,0].max())/2; czr=(ring[:,1].min()+ring[:,1].max())/2
G=lambda p:((p[...,0]-cxr)*SCALE,(p[...,1]-czr)*SCALE)
gx0=(ring[:,0].min()-cxr)*SCALE-40; gx1=(ring[:,0].max()-cxr)*SCALE+40
gz0=(ring[:,1].min()-czr)*SCALE-40; gz1=(ring[:,1].max()-czr)*SCALE+40
NX=int((gx1-gx0)/CELL)+1; NZ=int((gz1-gz0)/CELL)+1
print('grid',NX,NZ,'origin',gx0,gz0)
# OSM water mask on grid
img=Image.new('L',(NX,NZ),0);d=ImageDraw.Draw(img)
toc=lambda P:[((( (p[0]-cxr)*SCALE)-gx0)/CELL,(((p[1]-czr)*SCALE)-gz0)/CELL) for p in P]
d.polygon(toc(ring),fill=1)
for w in inner:d.polygon(toc(w),fill=0)
water=np.asarray(img).astype(bool)
# survey depth fill (feet)
valid=~np.isnan(dep)
idx=ndi.distance_transform_edt(~valid,return_distances=False,return_indices=True)
filled=dep[idx[0],idx[1]]
c,s=math.cos(th),math.sin(th)
X,Z=np.meshgrid(gx0+np.arange(NX)*CELL,gz0+np.arange(NZ)*CELL)
rx=X/SCALE+cxr; rz=Z/SCALE+czr
px=(rx*c-rz*s)/sc+tx; py=(rx*s+rz*c)/sc+ty
H,W=dep.shape
sample=ndi.map_coordinates(filled,[np.clip(py,0,H-1),np.clip(px,0,W-1)],order=1)
# nearest-valid-distance penalty: where survey had no data far from valid pixels, fade toward shallow
dist_valid=ndi.distance_transform_edt(~valid)
dv=ndi.map_coordinates(dist_valid,[np.clip(py,0,H-1),np.clip(px,0,W-1)],order=1)
ft=sample
m=water
ft=np.where(m,ft,0)
# smooth within water (normalised convolution)
wf=m.astype(float);num=ndi.gaussian_filter(ft*wf,0.8);den=ndi.gaussian_filter(wf,0.8)
sm_=np.where(den>1e-3,num/np.maximum(den,1e-3),0)
depth_m=np.where(m,np.maximum(sm_*0.3048,0.25),0)
# ensure shore taper: cells adjacent to land at most 1.2 m
dl=ndi.distance_transform_edt(m)*CELL
depth_m=np.where(m,np.minimum(depth_m,0.3+dl*0.4),0)  # max slope ~5 deg near shore keeps beaches
q=np.clip(np.round(depth_m*10),0,255).astype(np.uint8); q[m&(q==0)]=1
print('max depth m',q.max()/10,'water cells',m.sum(),'area km2 (game)',m.sum()*CELL**2/1e6,'real km2',m.sum()*CELL**2/SCALE**2/1e6)
# stats by x
for fr in np.linspace(0.05,0.95,10):
    col=q[:,int(NX*fr)];print(round(gx0+fr*NX*CELL),'max depth',col.max()/10)
json.dump({'NX':NX,'NZ':NZ,'x0':gx0,'z0':gz0,'cell':CELL,'scale':SCALE,'cxr':cxr,'czr':czr,'lat0':R['lat0'],'lon0':R['lon0']},open('grid_meta.json','w'))
open('grid.b64','w').write(base64.b64encode(q.tobytes()).decode())
np.save('grid_q.npy',q)
v=(np.where(q>0,255-q.astype(int)*10,40)).clip(0,255).astype(np.uint8)
Image.fromarray(v).resize((NX*2,NZ*2)).save('grid_prev.png')

# ---- signed distance to the real shoreline (game metres; + on land, - in water), from a 2 m raster of the OSM outline
F=4; PX=CELL/F
img2=Image.new('L',(NX*F,NZ*F),0);d2=ImageDraw.Draw(img2)
toc2=lambda P:[(((p[0]-cxr)*SCALE-gx0)/PX,((p[1]-czr)*SCALE-gz0)/PX) for p in P]
d2.polygon(toc2(ring),fill=1)
for w in inner:d2.polygon(toc2(w),fill=0)
wat=np.asarray(img2).astype(bool)
sd=(ndi.distance_transform_edt(~wat)-ndi.distance_transform_edt(wat))*PX   # +land / -water
sdn=sd[::F,::F][:NZ,:NX]
sd8=np.clip(np.round(sdn),-127,127).astype(np.int8)
np.save('grid_sd.npy',sd8);print('sd',sd8.shape,sd8.min(),sd8.max())
# fill land nodes with the nearest water depth so bilinear sampling is smooth across the shoreline
idx=ndi.distance_transform_edt(q==0,return_distances=False,return_indices=True)
qf=q[idx[0],idx[1]];np.save('grid_qf.npy',qf)
