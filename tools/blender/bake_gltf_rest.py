# Read-only glTF reader for the 'Rigged hand' download (Elena FF, CC-BY-SA-4.0): pulls the raw bind-pose
# mesh, weights and joint bind matrices out of scene.gltf/scene.bin into an .npz for build_hands_v2.py.
# No code from the archive is run; this only parses JSON + the binary buffer.
# Usage:  python -I tools/blender/bake_gltf_rest.py <extracted_dir> <out.npz>   (needs numpy)
import json, sys, numpy as np
src, out = sys.argv[1], sys.argv[2]
g = json.load(open(src + '/scene.gltf')); bin_ = open(src + '/scene.bin', 'rb').read()
CT = {5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}; NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); st = bv.get('byteStride', n*dt.itemsize)
    off = bv.get('byteOffset',0)+a.get('byteOffset',0)
    arr = np.ndarray((a['count'], n), dtype=dt, buffer=bin_, offset=off, strides=(st, dt.itemsize))
    return arr.copy()
def quat(q):
    x,y,z,w = q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
nodes = g['nodes']; parent = {}
for i, n in enumerate(nodes):
    for c in n.get('children', []): parent[c] = i
def local(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
    M = np.eye(4); M[:3,:3] = quat(n.get('rotation',[0,0,0,1])) @ np.diag(n.get('scale',[1,1,1])); M[:3,3] = n.get('translation',[0,0,0]); return M
cache = {}
def world(i):
    if i not in cache: cache[i] = (world(parent[i]) if i in parent else np.eye(4)) @ local(nodes[i])
    return cache[i]
mi = [i for i,n in enumerate(nodes) if 'mesh' in n][0]
skin = g['skins'][g['nodes'][mi]['skin']]
J = skin['joints']; ibm = acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
prim = g['meshes'][nodes[mi]['mesh']]['primitives'][0]
P = acc(prim['attributes']['POSITION']).astype(float); N = acc(prim['attributes']['NORMAL']).astype(float)
JI = acc(prim['attributes']['JOINTS_0']).astype(int); W = acc(prim['attributes']['WEIGHTS_0']).astype(float)
if W.dtype.kind != 'f' or W.max() > 1.5: W = W / 65535.0
UV = acc(prim['attributes']['TEXCOORD_0']).astype(float); IDX = acc(prim['indices']).reshape(-1,3).astype(int)
sm = np.stack([world(j) @ ibm[k] for k, j in enumerate(J)])
Ph = np.c_[P, np.ones(len(P))]
out_p = np.zeros_like(P); out_n = np.zeros_like(N)
for k in range(4):
    M = sm[JI[:,k]]
    out_p += W[:,k:k+1] * np.einsum('nij,nj->ni', M, Ph)[:,:3]
    out_n += W[:,k:k+1] * np.einsum('nij,nj->ni', M[:,:3,:3], N)
out_n /= np.linalg.norm(out_n, axis=1, keepdims=True)
jw = np.stack([world(j) for j in J])
np.savez(out, rawpos=P, rawnrm=N, ibm=ibm, pos=out_p, nrm=out_n, ji=JI, w=W, uv=UV, idx=IDX, jmat=jw, jnames=np.array([nodes[j]['name'] for j in J]), jparent=np.array([J.index(parent[j]) if parent.get(j) in J else -1 for j in J]))
print('raw', P.min(0), P.max(0)); print('bbox', out_p.min(0), out_p.max(0), 'wsum', W.sum(1).min(), W.sum(1).max())
