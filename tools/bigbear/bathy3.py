import numpy as np, json, math
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS=None
im=Image.open('bath/b150.png').convert('RGB');W,H=im.size
A=np.asarray(im).astype(np.int16)
x0=7515+215
ys=np.arange(2113,2466); lut=A[ys,x0].astype(np.int16); depth_lut=(ys-2113)/352*70
# classify at 1/2 res for speed
S=2
B=A[::S,::S]; h,w=B.shape[:2]
flat=B.reshape(-1,3)
# nearest LUT via chunking
best=np.zeros(len(flat),np.int16);dist=np.zeros(len(flat),np.float32)
L=lut.astype(np.float32)
for i in range(0,len(flat),400000):
    c=flat[i:i+400000].astype(np.float32)
    d=((c[:,None,:]-L[None,:,:])**2).sum(2)
    k=d.argmin(1);best[i:i+400000]=k;dist[i:i+400000]=np.sqrt(d[np.arange(len(c)),k])
dep=depth_lut[best].reshape(h,w);ok=(dist<40).reshape(h,w)
# exclusion regions (fractions)
yy,xx=np.mgrid[0:h,0:w];fx=xx/w;fy=yy/h
excl=((fx<0.125)&(fy<0.40))|((fx>0.895)&(fy>0.343))|((fx>0.77)&(fy>0.70))|(fy<0.08)
mask=ok&~excl
np.save('bath/dep.npy',np.where(mask,dep,np.nan).astype(np.float32))
Image.fromarray((mask*255).astype(np.uint8)).save('bath/mask.png')
ys_,xs_=np.where(mask);print('mask bbox px',xs_.min(),xs_.max(),ys_.min(),ys_.max(),'n',mask.sum(),'size',w,h)
