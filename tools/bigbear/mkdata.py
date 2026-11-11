import json,base64,numpy as np
M=json.load(open('grid_meta.json'));q=np.load('grid_qf.npy');sd=np.load('grid_sd.npy')
D=json.load(open('dem.json'));e=np.array(D['elev'],float)
rel=np.round(e-2057.5).astype(np.int16)
# check lake surface in DEM near the lake centre
print('dem rel min/max',rel.min(),rel.max())
ks=0.4
out=f"""// Big Bear Lake survey data, baked by tools/bigbear (see docs/big-bear-research.md).
// Depth grid: BBMWD 2008 multibeam hydrographic survey (colour-ramp read off the chart and fitted onto the OpenStreetMap shoreline);
// land DEM: SRTM 30 m sampled every 200 m. Game metres = real metres x {ks}.
const dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const BBG = {{ nx: {M['NX']}, nz: {M['NZ']}, x0: {M['x0']:.2f}, z0: {M['z0']:.2f}, cell: {M['cell']}, q: dec('{base64.b64encode(q.tobytes()).decode()}'), sd: new Int8Array(dec('{base64.b64encode(sd.tobytes()).decode()}').buffer) }};   // q: depth in 0.1 m (land nodes copy the nearest water); sd: signed distance to the shoreline in game metres, + on land
export const BBD = {{ n: {D['N']}, step: {D['step']*ks:.1f}, e: new Int16Array(dec('{base64.b64encode(rel.tobytes()).decode()}').buffer) }};   // metres above the lake surface (2057.5 m), 61 x 61 posts
"""
open('bigbearData.js','w').write(out);print(len(out))
