import numpy as np, json, math
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
dep=np.load('bath/dep.npy'); h,w=dep.shape
m=~np.isnan(dep)
fx=np.arange(w)[None,:]/w; fy=np.arange(h)[:,None]/h
m&=~((fx>0.84)&(fx<0.9)&(fy>0.55))
# close gaps (contour lines) and fill
m2=ndi.binary_closing(m,iterations=3); m2=ndi.binary_fill_holes(m2)
m2=ndi.binary_opening(m2,iterations=2)
lab,n=ndi.label(m2);sizes=ndi.sum(m2,lab,range(1,n+1));m2=lab==(1+np.argmax(sizes))
np.save('bath/lakemask.npy',m2)
ys,xs=np.where(m2);print('bbox',xs.min(),xs.max(),ys.min(),ys.max(),m2.sum())
R=json.load(open('ring.json'));ring=np.array(R['ring'])  # x east m, z south m
def raster(sc,th,tx,ty,f=4):
    # map ring (m) -> px (at half-res), then /f
    c,s=math.cos(th),math.sin(th)
    px=(ring[:,0]*c-ring[:,1]*s)/sc+tx; py=(ring[:,0]*s+ring[:,1]*c)/sc+ty
    img=Image.new('L',(w//f,h//f),0);ImageDraw.Draw(img).polygon(list(zip(px/f,py/f)),fill=1)
    return np.asarray(img).astype(bool)
f=4
t=np.asarray(Image.fromarray(m2.astype(np.uint8)*255).resize((w//f,h//f),Image.BILINEAR))>127
def iou(p):
    r=raster(*p);return (r&t).sum()/max(1,(r|t).sum())
cx=(xs.min()+xs.max())/2;cy=(ys.min()+ys.max())/2
ocx=(ring[:,0].min()+ring[:,0].max())/2;ocy=(ring[:,1].min()+ring[:,1].max())/2
sc0=(ring[:,0].max()-ring[:,0].min())/(xs.max()-xs.min())
p=[sc0,0.0,cx-ocx/sc0,cy-ocy/sc0];print('init',p,iou(p))
step=[0.05*sc0,0.02,20,20]
best=iou(p)
for it in range(60):
    imp=False
    for k in range(4):
        for sgn in(1,-1):
            q=list(p);q[k]+=sgn*step[k];v=iou(q)
            if v>best+1e-5:best=v;p=q;imp=True
    if not imp:
        step=[s*0.5 for s in step]
        if step[2]<0.3:break
print('fit',p,'iou',best)
json.dump({'p':p,'iou':best,'w':w,'h':h},open('bath/fit.json','w'))
r=raster(*p,f=f);out=np.zeros(r.shape+(3,),np.uint8);out[...,0]=r*255;out[...,1]=t*255;Image.fromarray(out).save('bath/fit.png')
