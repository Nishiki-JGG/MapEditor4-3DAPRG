"""Convert the authored 20-prop glTF package to the existing shared mesh contract.
Usage: python import_cave_decor.py <model20 directory> <editor repository>
Only explicit model/exports and textures/props inputs are read; no scene/background.
"""
import base64, hashlib, json, math, struct, sys
from pathlib import Path

source, repo = map(Path, sys.argv[1:3])
meta = json.loads((source / 'props.json').read_text(encoding='utf-8'))
assets, definitions, sources = [], [], []
def read(p):
    b = p.read_bytes()
    sources.append(dict(file=p.relative_to(source).as_posix(), sha256=hashlib.sha256(b).hexdigest()))
    return b
read(source / 'props.json')
for row in meta['props']:
    g = json.loads(read(source / row['gltf']))
    assert len(g['nodes']) == len(g['meshes']) == 1
    assert set(g['nodes'][0]) <= {'mesh', 'name'}, 'Unexpected node transform'
    buffers = [read(source / 'model/exports' / b['uri']) for b in g['buffers']]
    def accessor(ix):
        a = g['accessors'][ix]; v = g['bufferViews'][a['bufferView']]
        n = dict(SCALAR=1,VEC2=2,VEC3=3,VEC4=4)[a['type']]
        fmt = {5126:'f',5123:'H',5125:'I'}[a['componentType']]
        size = struct.calcsize('<'+fmt*n); stride = v.get('byteStride',size)
        start = v.get('byteOffset',0)+a.get('byteOffset',0)
        return [list(struct.unpack_from('<'+fmt*n,buffers[v['buffer']],start+i*stride)) for i in range(a['count'])]
    prim = g['meshes'][0]['primitives']; assert len(prim)==1 and prim[0].get('mode',4)==4
    prim=prim[0]; at=prim['attributes']
    pos=accessor(at['POSITION']); normal=accessor(at['NORMAL']); uv=accessor(at['TEXCOORD_0'])
    indices=[x[0] for x in accessor(prim['indices'])]
    assert len(indices)//3==row['triangles']
    # glTF right handed -> shared Unity left handed. UV top-left -> bottom-left.
    for p in pos: p[2]*=-1
    for p in normal: p[2]*=-1
    for p in uv: p[1]=1-p[1]
    for i in range(0,len(indices),3): indices[i+1],indices[i+2]=indices[i+2],indices[i+1]
    lo=[min(p[i] for p in pos) for i in range(3)]; hi=[max(p[i] for p in pos) for i in range(3)]
    ident='cnd'+str(row['id']).zfill(3)
    flat=lambda a:[round(v,7) for p in a for v in p]
    a=dict(id=ident,assetKey='tdj/'+ident,version=1,positions=flat(pos),normals=flat(normal),uv=flat(uv),
           colors=[1]*(len(pos)*3),triangles=indices,pivot=[0,0,0],
           material=dict(texture='cave-decor-atlas-v1',lighting='lambert',baseColor=[1,1,1,1],alphaCutoff=.5,doubleSided=True))
    moving=row['id'] in [1,2,3,16,17]
    height=max(.01,hi[1]-lo[1]); radius=max(.15,max(math.hypot(p[0],p[2]) for p in pos))
    if moving:
        a['motionWeights']=[round(v,6) for p in pos for v in [max(0,min(1,(p[1]-lo[1])/height))**1.4]*2]
        a['wind']=dict(minY=0,maxY=height,maxDisplacementMetres=min(.08,height*.13),uvMin=-1,phaseOffset=row['id']*.47,maxCombinedDisplacementMetres=.15)
        a['contact']=dict(version=1,radius=radius,minY=0,maxY=height,maxDisplacementMetres=.10)
    assets.append(a)
    definitions.append(dict(id=ident,name=row['name'],mount=row['mount'],minY=lo[1],height=height,radius=radius,moving=moving))
assert len(assets)==20 and sum(len(a['triangles'])//3 for a in assets)==1123
png=read(source/'textures/props/UL_Atlas_BC_512.png')
texture=dict(id='cave-decor-atlas-v1',width=512,height=512,png=base64.b64encode(png).decode(),colorSpace='sRGB',wrap='clamp',filter='trilinear',mipmaps=True,anisotropy=2)
payload=dict(assets=assets,textures=[texture],definitions=definitions)
out=repo/'props/shared/cave-decor-data.js'
out.write_text('// Authored cave decoration meshes and atlas. No purchased or background assets.\nwindow.TDCaveDecorData = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(repo/'docs/CAVE_DECOR_PROVENANCE.json').write_text(json.dumps(dict(kind='authored mesh and procedural texture',package='CaveNature20 UltraLite r003',sourceFiles=sources,triangles=1123,excluded=['background scene','purchased assets'],adaptation='Coordinate/UV conversion only; shared diffuse material uses original base color. Normal/ORM source maps are not used by the diffuse renderer.'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(models=len(assets),triangles=1123,dataBytes=out.stat().st_size)))
