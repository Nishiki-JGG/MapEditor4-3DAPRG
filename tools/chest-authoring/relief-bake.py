import bpy, math, json, os, time
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
from pathlib import Path
out=Path(os.environ['CHEST_BAKE_OUT']);out.mkdir(exist_ok=True,parents=True)
start=time.time();bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=128
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.025;scene.render.bake.max_ray_distance=.050;scene.render.bake.margin=8
# Two real front-facing supports: bent hasp and one right-hand shoulder.
patches=[dict(name='hasp',xmin=-.059,xmax=.059,ymin=.401,ymax=.550,uv=[.025,.025,.54,.49],nx=128,ny=176),dict(name='right_scroll',xmin=.172,xmax=.368,ymin=.389,ymax=.467,uv=[.025,.55,.54,.735],nx=164,ny=96),dict(name='left_scroll',xmin=-.368,xmax=-.172,ymin=.389,ymax=.467,uv=[.025,.795,.54,.975],nx=164,ny=96)]
patches.append(dict(name='lid_crown',xmin=-.114,xmax=.114,ymin=-.045,ymax=.342,uv=[.60,.025,.975,.975],nx=144,ny=224))
lid_rows=[(-.045,.085),(0,.114),(.0325,.112),(.065,.098),(.0975,.066),(.13,.054),(.1625,.054),(.195,.054),(.2275,.054),(.26,.054),(.2925,.054),(.325,.054),(.342,.050)]
def lid_height(z):
 if z>.325:return .622+(.604-.622)*(z-.325)/.017+.0045
 # Match the existing final low lid-band polygon segments exactly.
 k=math.floor((z+.325)/.0325);a=-.325+k*.0325;b=a+.0325;t=(z-a)/.0325
 return .622+.110*((1-t)*math.cos(a/.325*math.pi/2)+t*math.cos(b/.325*math.pi/2))+.0045
crest_rows=[(.401,.032),(.435,.053),(.495,.059),(.518,.055),(.550,.039)]
right_poly=[(.174,.463),(.327,.463),(.363,.442),(.363,.402),(.340,.395),(.287,.428),(.180,.428)]
def boundary(p):
 if p['name']=='lid_crown':return [(-w,z) for z,w in lid_rows]+[(w,z) for z,w in reversed(lid_rows)]
 if p['name']=='hasp':return [(-w,y) for y,w in crest_rows]+[(w,y) for y,w in reversed(crest_rows)]
 return [(x if p['name']=='right_scroll' else -x,y) for x,y in right_poly]
def polygon_edge(p,u,v):
 pts=[((x-p['xmin'])/(p['xmax']-p['xmin']),(y-p['ymin'])/(p['ymax']-p['ymin'])) for x,y in boundary(p)];inside=False;j=len(pts)-1
 for i,(x,y) in enumerate(pts):
  xx,yy=pts[j]
  if (y>v)!=(yy>v) and u<(xx-x)*(v-y)/(yy-y)+x:inside=not inside
  j=i
 return dist(u,v,pts+[pts[0]]) if inside else 0

def surface(p,u,v):
 x=p['xmin']+(p['xmax']-p['xmin'])*u;y=p['ymin']+(p['ymax']-p['ymin'])*v
 if p['name']=='lid_crown':return x,lid_height(y),y
 z=.397 if p['name']=='hasp' else .361
 if p['name']=='hasp' and y>.495:z-=.011*(y-.495)/.061
 return x,y,z
def dist(x,y,points):
 best=10
 for (ax,ay),(bx,by) in zip(points,points[1:]):
  dx=bx-ax;dy=by-ay;t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));best=min(best,math.hypot(x-ax-dx*t,y-ay-dy*t))
 return best
def ridge(u,v,pts,width,height):
 t=dist(u,v,pts)/width;return height*max(0,1-t*t)**1.5
def leaf(u,v,ax,ay,bx,by,width,height):
 dx=bx-ax;dy=by-ay;length=math.hypot(dx,dy);q=((u-ax)*dx+(v-ay)*dy)/(length*length);t=abs((u-ax)*dy-(v-ay)*dx)/length
 if q<=0 or q>=1:return 0
 half=width*math.sin(math.pi*q)**.85
 if t>=half:return 0
 # Convex shoulder, sloping flank, narrow recessed vein. No light direction is encoded.
 dome=height*math.sin(math.pi*q)**.55*(1-(t/half)**1.8)
 vein=.0012*math.exp(-(t/.012)**2)*math.sin(math.pi*q)
 return max(0,dome-vein)
def curl(cx,cy,rx,ry,start,turn,steps=48):
 return [(cx+rx*(1-.58*i/steps)*math.cos(start+turn*i/steps),cy+ry*(1-.58*i/steps)*math.sin(start+turn*i/steps)) for i in range(steps+1)]
def relief(p,u,v):
 edge=polygon_edge(p,u,v);fade=max(0,min(1,edge/.035));h=0
 if p['name']=='hasp':
  # Broad crowned palmette, two lower C returns, small recessed border. Keyhole below is clear.
  h=ridge(u,v,[(.5,.07),(.5,.35),(.5,.66),(.5,.92)],.026,.0045)
  for ax,ay,bx,by,w,hh in [(.5,.50,.5,.94,.115,.0075),(.49,.46,.16,.84,.13,.0068),(.51,.46,.84,.84,.13,.0068),(.47,.37,.15,.61,.105,.0058),(.53,.37,.85,.61,.105,.0058),(.48,.22,.24,.42,.09,.0048),(.52,.22,.76,.42,.09,.0048)]:h=max(h,leaf(u,v,ax,ay,bx,by,w,hh))
  for sign in [-1,1]:
   pts=curl(.5+sign*.17,.29,.22,.19,0 if sign>0 else math.pi,sign*math.pi*1.8)
   h=max(h,ridge(u,v,pts,.025,.0040))
  h=max(h,ridge(u,v,[(.20,.81),(.29,.87),(.37,.83),(.50,.96),(.63,.83),(.71,.87),(.80,.81)],.016,.0022))
 elif p['name']=='lid_crown':
  # A continuous crown grows from the ruby saddle down the central strap into the hasp.
  h=ridge(u,v,[(.5,.29),(.5,.44),(.5,.65),(.5,.91)],.020,.0036)
  for args in [(.5,.41,.5,.61,.068,.0062),(.49,.48,.32,.67,.072,.006),(.51,.48,.68,.67,.072,.006),(.49,.62,.32,.79,.068,.0058),(.51,.62,.68,.79,.068,.0058),(.49,.76,.36,.91,.058,.005),(.51,.76,.64,.91,.058,.005)]:h=max(h,leaf(u,v,*args))
  # Paired C returns embrace the foot of the ruby without covering the red stone.
  for sign in [-1,1]:
   h=max(h,ridge(u,v,[(.5+sign*.37,.085),(.5+sign*.40,.16),(.5+sign*.34,.24),(.5+sign*.24,.29),(.5+sign*.15,.34),(.5,.40)],.018,.0045))
   h=max(h,leaf(u,v,.5+sign*.22,.28,.5+sign*.37,.15,.045,.0046))
  h=max(h,ridge(u,v,[(.36,.91),(.5,.96),(.64,.91)],.014,.0024))
 else:
  # Opposed S stems lead from the centre toward the corner. Two compositions, not copied sprigs.
  if p['name']=='left_scroll':u=1-u
  left=p['name']=='left_scroll'
  stem=[(.03,.72),(.16,.78),(.34,.80),(.48,.72),(.61,.58),(.74,.40),(.90,.26)]
  h=ridge(u,v,stem,.026,.0043)
  h=max(h,ridge(u,v,curl(.75,.42,.20,.26,-.6,math.pi*1.65),.023,.0048))
  leaves=[(.12,.77,.32,.96,.09,.0055),(.30,.79,.49,.95,.085,.0058),(.40,.75,.62,.89,.075,.0052),(.54,.62,.78,.71,.075,.005),(.64,.52,.84,.61,.065,.0045)]
  if left:leaves=[(.12,.77,.27,.97,.09,.0058),(.29,.79,.47,.96,.085,.006),(.45,.73,.66,.88,.08,.0052),(.58,.60,.79,.72,.08,.0054),(.69,.43,.83,.53,.06,.0042)]
  for args in leaves:h=max(h,leaf(u,v,*args))
  h=max(h,ridge(u,v,[(.13,.71),(.24,.60),(.36,.61),(.42,.70)],.014,.002))
 # Two small continuous border ridges with a clean lower groove; no fixed highlight.
 border=.0012*math.exp(-((edge-.028)/.010)**2)+.0007*math.exp(-((edge-.050)/.008)**2)
 return max(h*fade,border)*fade

lowverts=[];lowfaces=[];lowuv=[];high=[];ranges=[]
for p in patches:
 # Low uses the same explicit final triangles as export; the bend is a true support fold.
 offset=len(lowverts);first=len(lowfaces)
 if p['name'] in ['hasp','lid_crown']:
  rows=crest_rows if p['name']=='hasp' else lid_rows
  for y,width in rows:
   for x in [-width,width]:
    u=(x-p['xmin'])/(p['xmax']-p['xmin']);v=(y-p['ymin'])/(p['ymax']-p['ymin']);lowverts.append(surface(p,u,v));lowuv.append((p['uv'][0]+u*(p['uv'][2]-p['uv'][0]),p['uv'][1]+v*(p['uv'][3]-p['uv'][1])))
  for j in range(len(rows)-1):
   a=offset+j*2;tris=[(a,a+1,a+3),(a,a+3,a+2)];lowfaces.extend([tuple(reversed(t)) for t in tris] if p['name']=='lid_crown' else tris)
 else:
  poly=boundary(p)
  if sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))<0:poly.reverse()
  vec=[Vector((x,y,0)) for x,y in poly]
  for x,y in poly:
   u=(x-p['xmin'])/(p['xmax']-p['xmin']);v=(y-p['ymin'])/(p['ymax']-p['ymin']);lowverts.append(surface(p,u,v));lowuv.append((p['uv'][0]+u*(p['uv'][2]-p['uv'][0]),p['uv'][1]+v*(p['uv'][3]-p['uv'][1])))
  for tri in tessellate_polygon([vec]):lowfaces.append(tuple(offset+(v if isinstance(v,int) else vec.index(v)) for v in tri))
 ranges.append(dict(name=p['name'],first=first,count=len(lowfaces)-first))

 verts=[];faces=[];nx=p['nx'];ny=p['ny']
 for j in range(ny+1):
  for i in range(nx+1):
   u=i/nx;v=j/ny;x,y,z=surface(p,u,v);h=relief(p,u,v)+.00005
   if p['name']=='lid_crown':
    if z<=.325:y=.622+.110*math.cos(z/.325*math.pi/2)+.0045
    dz=.00001;slope=(lid_height(z+dz)-lid_height(z-dz))/(2*dz);normal=Vector((0,1,-slope)).normalized();verts.append((x,y+normal.y*h,z+normal.z*h))
   else:verts.append((x,y,z+h))
 for j in range(ny):
  for i in range(nx):
   a=j*(nx+1)+i;faces.extend([(a,a+1,a+nx+2),(a,a+nx+2,a+nx+1)])
 if p['name']=='lid_crown':faces=[tuple(reversed(f)) for f in faces]
 mesh=bpy.data.meshes.new(p['name']+'_detail');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(p['name']+'_HIGH',mesh);scene.collection.objects.link(obj)
 for poly in mesh.polygons:poly.use_smooth=True
 high.append(obj)
mesh=bpy.data.meshes.new('final_low_triangles');mesh.from_pydata(lowverts,[],lowfaces);mesh.update();uvlayer=mesh.uv_layers.new(name='UVMap')
for poly in mesh.polygons:
 for li in poly.loop_indices:uvlayer.data[li].uv=lowuv[mesh.loops[li].vertex_index]
# Explicit final low split normals: smooth curved lid only, retain the front end fold.
custom=[]
for poly in mesh.polygons:
 is_lid=poly.index>=ranges[-1]['first'];fold=is_lid and any(mesh.vertices[mesh.loops[li].vertex_index].co.z>.32501 for li in poly.loop_indices)
 for li in poly.loop_indices:
  co=mesh.vertices[mesh.loops[li].vertex_index].co
  if is_lid and not fold:custom.append(Vector((0,1,.110/.325*math.pi/2*math.sin(co.z/.325*math.pi/2))).normalized())
  else:custom.append(poly.normal.copy())
 if is_lid:poly.use_smooth=True
mesh.normals_split_custom_set(custom)
low=bpy.data.objects.new('central_and_right_LOW',mesh);scene.collection.objects.link(low);mat=bpy.data.materials.new('bake_target');mat.use_nodes=True;low.data.materials.append(mat);node=mat.node_tree.nodes.new('ShaderNodeTexImage');mat.node_tree.nodes.active=node
stats={}
for kind,name in [('NORMAL','relief-normal'),('AO','relief-ao')]:
 image=bpy.data.images.new(name,width=512,height=512,alpha=False);image.colorspace_settings.name='Non-Color';node.image=image
 bpy.ops.object.select_all(action='DESELECT');low.select_set(True)
 for obj in high:obj.select_set(True)
 bpy.context.view_layer.objects.active=low
 if kind=='NORMAL':scene.render.bake.normal_space='TANGENT'
 bpy.ops.object.bake(type=kind);image.filepath_raw=str(out/(name+'.png'));image.file_format='PNG';image.save();stats[name]=dict(bytes=(out/(name+'.png')).stat().st_size)
# One intrinsic linear RGB + roughness-alpha texture: only lid relief and adjacent plate are sampled.
finish=bpy.data.images.new('finish-colour-roughness',width=512,height=512,alpha=True);finish.colorspace_settings.name='Non-Color';pixels=[]
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
p=patches[-1]
for yy in range(512):
 for xx in range(512):
  U=(xx+.5)/512;V=(yy+.5)/512;rgb=(.48514994,.25415209,.03560131);rough=.4
  if p['uv'][0]<=U<=p['uv'][2] and p['uv'][1]<=V<=p['uv'][3]:
   u=(U-p['uv'][0])/(p['uv'][2]-p['uv'][0]);v=(V-p['uv'][1])/(p['uv'][3]-p['uv'][1]);h=relief(p,u,v);wear=smooth(.0015,.006,h);cloud=(math.sin(u*5.3+v*2.1)+math.sin(u*3.1-v*6.7+.8))*.5
   rgb=tuple(a+(b-a)*wear for a,b in zip((.365,.185,.034),(.56,.315,.068)));rgb=tuple(c*(1+.025*cloud) for c in rgb);rough=.55-.31*wear+.025*cloud
  elif .37<=U<=.55 and .04<=V<=.48:
   u=(U-.37)/.18;v=(V-.04)/.44;cloud=(math.sin(u*5.3+v*2.1)+math.sin(u*3.1-v*6.7+.8)+.6*math.sin(u*8.4+v*4.1+2.7))/2.6
   rgb=tuple(c*(1+.055*cloud) for c in (.405,.220,.050));rough=.57+.09*cloud
  pixels.extend((*rgb,rough))
finish.pixels.foreach_set(pixels);finish.filepath_raw=str(out/'finish-colour-roughness.png');finish.file_format='PNG';finish.save();stats['finish-colour-roughness']=dict(bytes=(out/'finish-colour-roughness.png').stat().st_size,encoding='linear RGB intrinsic colour; linear A roughness')
mesh.calc_tangents(uvmap='UVMap');data=dict(position=[],normal=[],uv=[],tangent=[],ranges=ranges)
for poly in mesh.polygons:
 for li in poly.loop_indices:
  loop=mesh.loops[li];data['position']+=list(mesh.vertices[loop.vertex_index].co);data['normal']+=list(loop.normal);data['uv']+=list(uvlayer.data[li].uv);data['tangent']+=list(loop.tangent)+[loop.bitangent_sign]
data['support']=[]
for p in [patches[0],patches[-1]]:
 outline=[]
 for x,y in boundary(p):outline.append(surface(p,(x-p['xmin'])/(p['xmax']-p['xmin']),(y-p['ymin'])/(p['ymax']-p['ymin'])))
 for i,a in enumerate(outline):
  b=outline[(i+1)%len(outline)]
  if p['name']=='lid_crown':
   aa=(a[0],a[1]-.021,a[2]);bb=(b[0],b[1]-.021,b[2]);tri=[a,bb,b,a,aa,bb]
  else:
   aa=(a[0],a[1],a[2]-.010);bb=(b[0],b[1],b[2]-.010);tri=[a,b,bb,a,bb,aa]
  for v in tri:data['support']+=list(v)
(out/'low.json').write_text(json.dumps(data,separators=(',',':')))
for obj in high:obj.hide_render=True;obj.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'relief-study.blend'))
report=dict(blender=bpy.app.version_string,seconds=time.time()-start,high_triangles=sum(len(o.data.polygons) for o in high),low_triangles=len(mesh.polygons),maps=stats,blend_bytes=(out/'relief-study.blend').stat().st_size,patches=patches,normal_convention='Blender Mikk tangent XYZ, PNG non-colour, explicit exported tangents; ordinary Web product shader, Native source/static only')
(out/'bake-report.json').write_text(json.dumps(report,indent=2));print('CHEST64_BAKE',json.dumps(report))
