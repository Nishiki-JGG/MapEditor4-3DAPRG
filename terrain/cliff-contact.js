// 崖の表示境界を使う、配置後段の密着処理。編集地形と元の部品は変更しない。
(() => {
'use strict';
const cache=new WeakMap(),triangleCache=new WeakMap(),profileCache=new WeakMap(),visualMaskCache=new WeakMap(), EPS=1e-7;
function tri(a,b,c){
 const e=b.map((v,i)=>v-a[i]),f=c.map((v,i)=>v-a[i]),n=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];
 const d00=e.reduce((s,v,i)=>s+v*e[i],0),d01=e.reduce((s,v,i)=>s+v*f[i],0),d11=f.reduce((s,v,i)=>s+v*f[i],0),den=d00*d11-d01*d01;
 return{a,e,f,n,inv:Math.abs(den)>1e-14?1/den:0,d00,d01,d11,minY:Math.min(a[1],b[1],c[1]),maxY:Math.max(a[1],b[1],c[1]),bounds:[Math.min(a[0],b[0],c[0]),Math.max(a[0],b[0],c[0]),Math.min(a[2],b[2],c[2]),Math.max(a[2],b[2],c[2])],stamp:0};
}
function triangles(g){const it=triangleSteps(g);let r;do{r=it.next();}while(!r.done);return r.value;}
function* triangleSteps(g){const p=g.attributes.position,ix=g.index,version=p.version+'/'+(ix?.version??0),saved=triangleCache.get(g);if(saved?.version===version)return saved.list;const list=[];for(let i=0;i<(ix?ix.count:p.count);i+=3){if(i%384===0)yield;const vs=[];for(let k=0;k<3;k++){const j=ix?ix.getX(i+k):i+k;vs.push([p.getX(j),p.getY(j),p.getZ(j)]);}const t=tri(...vs);if(t.inv){t.face=g.userData.sourceFaceIds?.[i/3]??i/3;t.vertices=vs;list.push(t);}}triangleCache.set(g,{version,list});return list;}
function ray(t,o,d){const nd=t.n[0]*d[0]+t.n[1]*d[1]+t.n[2]*d[2];if(Math.abs(nd)<EPS)return null;const dist=(t.n[0]*(t.a[0]-o[0])+t.n[1]*(t.a[1]-o[1])+t.n[2]*(t.a[2]-o[2]))/nd;
 if(dist<0)return null;const q=o.map((v,i)=>v+d[i]*dist-t.a[i]),d20=q.reduce((s,v,i)=>s+v*t.e[i],0),d21=q.reduce((s,v,i)=>s+v*t.f[i],0),u=(t.d11*d20-t.d01*d21)*t.inv,v=(t.d00*d21-t.d01*d20)*t.inv;
 return u>=-EPS&&v>=-EPS&&u+v<=1+EPS?dist:null;
}
function samples(g,dense=false){
 let pair=cache.get(g);if(!pair){pair={};cache.set(g,pair);}const key=dense?'fine':'coarse';if(pair[key])return pair[key];
 g.computeBoundingBox();const b=g.userData.contactSampleBounds||g.boundingBox,ts=triangles(g),back=[],front=[],frontFaceIds=[],nx=dense?9:5,ny=dense?7:5;
 for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
  const x=(b.min.x+b.max.x)/2+(ix/(nx-1)*2-1)*(b.max.x-b.min.x)*.44,y=b.min.y+(.1+.8*iy/(ny-1))*(b.max.y-b.min.y),o=[x,y,b.min.z-.1],hits=[],hitFaces=[];
  for(const t of ts){const h=ray(t,o,[0,0,1]);if(h!==null){hits.push(h);hitFaces.push(t.face);}}if(!hits.length)continue;
  back.push([x,y,o[2]+Math.min(...hits)]);front.push([x,y,o[2]+Math.max(...hits)]);frontFaceIds.push(hitFaces[hits.indexOf(Math.max(...hits))]);
 }
 return pair[key]={geometry:g,back,front,frontFaceIds,minY:b.min.y,height:b.max.y-b.min.y,width:b.max.x-b.min.x};
}
class Surface {
 constructor(geometries,deferred=false){if(!deferred){const it=this.prepareSteps(geometries);while(!it.next().done){}}}
 static async prepare(geometries,job){const surface=new Surface(null,true);await TDPreparation.run(surface.prepareSteps(geometries),job);return surface;}
 *prepareSteps(geometries){this.stamp=0;this.viewReferences=new Map();this.exposureReferences=new Map();this.cells=new Map();this.stats={triangles:0,rays:0};this.allTriangles=[];for(const g of geometries)this.allTriangles=this.allTriangles.concat(yield* triangleSteps(g));this.sourceTriangles=triangles(geometries[0]);this.adjacency=new Map();const edges=new Map();let step=0;for(const t of this.sourceTriangles){if((++step&127)===0)yield;for(let i=0;i<3;i++){const v=t.vertices[i],w=t.vertices[(i+1)%3],s=v.join(','),r=w.join(','),k=s<r?s+'|'+r:r+'|'+s;if(!edges.has(k))edges.set(k,[]);edges.get(k).push(t.face);}}for(const ids of edges.values())for(const id of ids){if((++step&127)===0)yield;if(!this.adjacency.has(id))this.adjacency.set(id,new Set());for(const other of ids)if(other!==id)this.adjacency.get(id).add(other);}for(const t of this.allTriangles){if((++step&127)===0)yield;this.stats.triangles++;const b=t.bounds;for(let x=Math.floor(b[0]);x<=Math.floor(b[1]);x++)for(let z=Math.floor(b[2]);z<=Math.floor(b[3]);z++){const k=x+','+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(t);}}}


 // 線分の両端を担当する地形面から作る。試料が地中でも符号付き距離を返す。
 patch(anchor,u,width){
  const key=anchor.join(',')+'/'+u.join(',')+'/'+width;if(this.patchKey===key)return this.patchValue;
  const terrain=this.sourceTriangles,allowed=t=>{const q=t.bounds,cx=(q[0]+q[1])/2-anchor[0],cz=(q[2]+q[3])/2-anchor[1],nn=Math.hypot(...t.n);return Math.abs(-u[1]*cx+u[0]*cz)<width*.7+.8&&Math.abs(u[0]*cx+u[1]*cz)<2.5;};
  const candidates=terrain.filter(allowed),steep=t=>{const n=Math.hypot(...t.n);return t.n[1]/n<.72&&t.n[0]*u[0]+t.n[2]*u[1]<-.1*n;};let seed=null,score=Infinity;for(const t of candidates){if(!steep(t))continue;const d=Math.hypot((t.bounds[0]+t.bounds[1])/2-anchor[0],(t.bounds[2]+t.bounds[3])/2-anchor[1]);if(d<score){seed=t;score=d;}}
  const ids=new Set(),queue=seed?[seed]:[],byFace=new Map(candidates.map(t=>[t.face,t]));for(let i=0;i<queue.length;i++){const t=queue[i];if(ids.has(t.face))continue;ids.add(t.face);for(const id of this.adjacency.get(t.face)||[]){const other=byFace.get(id);if(other&&steep(other)&&!ids.has(id))queue.push(other);}}
  // 緩い肩は担当する急斜面の一周だけ。平坦な台地を渡って次の崖へ接続しない。
  for(const id of [...ids])for(const adjacent of this.adjacency.get(id)||[]){const t=byFace.get(adjacent);if(t&&t.n[0]*u[0]+t.n[2]*u[1]<-EPS)ids.add(adjacent);}
  const ts=this.allTriangles.filter(t=>ids.has(t.face)&&allowed(t));let lo=Infinity,hi=-Infinity,minY=Infinity,maxY=-Infinity;for(const t of ts)for(const v of t.vertices){const d=(v[0]-anchor[0])*u[0]+(v[2]-anchor[1])*u[1];lo=Math.min(lo,d);hi=Math.max(hi,d);minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);}
  const patch={ts,lo:lo-.1,hi:hi+.1,minY,maxY,ids:ids.size};this.patchKey=key;return this.patchValue=patch;
 }
 boundary(p,u,anchor,width){
  this.stats.rays++;const patch=this.patch(anchor,u,width);if(!patch.ts.length)return null;
  const along=(p[0]-anchor[0])*u[0]+(p[2]-anchor[1])*u[1],offset=patch.lo-along,o=[p[0]+u[0]*offset,p[1],p[2]+u[1]*offset],d=[u[0],0,u[1]];let best=Infinity;
  for(const t of patch.ts){if(p[1]<t.minY-EPS||p[1]>t.maxY+EPS||t.n[0]*u[0]+t.n[2]*u[1]>=-EPS)continue;const h=ray(t,o,d);if(h!==null&&h<=patch.hi-patch.lo)best=Math.min(best,h);}
  return Number.isFinite(best)?best+offset:null;
 }

 occluded(origin,end){const delta=end.map((v,i)=>v-origin[i]),length=Math.hypot(...delta);if(length<EPS)return false;const d=delta.map(v=>v/length),stamp=++this.stamp;let x=Math.floor(origin[0]),z=Math.floor(origin[2]),travel=0;const sx=d[0]>=0?1:-1,sz=d[2]>=0?1:-1,dx=Math.abs(d[0])>EPS?Math.abs(1/d[0]):Infinity,dz=Math.abs(d[2])>EPS?Math.abs(1/d[2]):Infinity;let tx=Number.isFinite(dx)?((sx>0?x+1:x)-origin[0])/d[0]:Infinity,tz=Number.isFinite(dz)?((sz>0?z+1:z)-origin[2])/d[2]:Infinity;while(travel<length){for(const t of this.cells.get(x+','+z)||[]){if(t.stamp===stamp)continue;t.stamp=stamp;const h=ray(t,origin,d);if(h!==null&&h<length-.002)return true;}if(tx<tz){travel=tx;tx+=dx;x+=sx;}else{travel=tz;tz+=dz;z+=sz;}}return false;}

 height(x,z){let h=-Infinity;for(const t of this.cells.get(Math.floor(x)+','+Math.floor(z))||[]){const d=ray(t,[x,1001,z],[0,-1,0]);if(d!==null)h=Math.max(h,1001-d);}return h;}
}
function world(p,v){const c=Math.cos(p[3]),s=Math.sin(p[3]),k=p[4];return[p[1]+(v[0]*c+v[2]*s)*k,p[7]+v[1]*k*(p[6]??1),p[2]+(-v[0]*s+v[2]*c)*k];}
function exposure(surface,p,sp){const bands=[{n:0,air:0},{n:0,air:0},{n:0,air:0}];for(const v of sp.front){const t=(v[1]-sp.minY)/sp.height,k=t<.34?0:t>.66?2:1,w=world(p,v),h=surface.height(w[0],w[2]);bands[k].n++;if(Number.isFinite(h)&&w[1]>h+.005)bands[k].air++;}return bands.map(b=>b.n?b.air/b.n:0);}
function sectionSegments(surface,w,u,anchor,width){const out=[],patch=surface.patch(anchor,u,width),lateral=v=>-u[1]*(v[0]-w[0])+u[0]*(v[2]-w[2]);for(const t of patch.ts){if(t.n[0]*u[0]+t.n[2]*u[1]>=-EPS)continue;const points=[];for(let i=0;i<3;i++){const a=t.vertices[i],b=t.vertices[(i+1)%3],da=lateral(a),db=lateral(b);if(Math.abs(da)<1e-7)points.push(a);if(da*db<0)points.push(a.map((x,k)=>x+(b[k]-x)*da/(da-db)));}if(points.length>=2)out.push({a:points[0],b:points[1],n:t.n,face:t.face});}return out;}
function sectionRanges(surface,w,u,anchor,width){const q=sectionSegments(surface,w,u,anchor,width).map(s=>[Math.min(s.a[1],s.b[1]),Math.max(s.a[1],s.b[1])]).sort((a,b)=>a[0]-b[0]),out=[];for(const r of q){const last=out.at(-1);if(last&&r[0]<=last[1]+1e-7)last[1]=Math.max(last[1],r[1]);else out.push(r);}return out;}
function sectionRange(surface,w,u,anchor,width){const q=sectionRanges(surface,w,u,anchor,width);return q.length?[q[0][0],q.at(-1)[1]]:[Infinity,-Infinity];}
function nearestRear(surface,w,u,anchor,width){let best=null;for(const seg of sectionSegments(surface,w,u,anchor,width)){const d=seg.b.map((v,i)=>v-seg.a[i]),dd=d.reduce((s,v)=>s+v*v,0),t=Math.max(0,Math.min(1,w.reduce((sum,v,i)=>sum+(v-seg.a[i])*d[i],0)/(dd||1))),q=seg.a.map((v,i)=>v+d[i]*t),len=Math.hypot(...seg.n),target=q.map((v,i)=>v-seg.n[i]/len*.08),delta=target.map((v,i)=>v-w[i]),distance=Math.hypot(...delta);if(delta[1]>.0001||delta[0]*u[0]+delta[2]*u[1]<-.0001||Math.abs(-u[1]*delta[0]+u[0]*delta[2])>.20001||distance>1.2)continue;if(!best||distance<best.distance)best={delta,distance,face:seg.face};}return best;}

function measure(surface,p,sp,u,anchor){
 const g=sp.geometry,P=g.attributes.position,c=Math.cos(p[3]),s=Math.sin(p[3]),scale=p[4],sy=p[6]??1,tangent=[-u[1],u[0]],ts=triangles(g);let t0=Infinity,t1=-Infinity,a0=Infinity,a1=-Infinity,y0=Infinity,y1=-Infinity;
 for(let i=0;i<P.count;i++){const w=world(p,[P.getX(i),P.getY(i),P.getZ(i)]),t=w[0]*tangent[0]+w[2]*tangent[1],a=w[0]*u[0]+w[2]*u[1];t0=Math.min(t0,t);t1=Math.max(t1,t);a0=Math.min(a0,a);a1=Math.max(a1,a);y0=Math.min(y0,w[1]);y1=Math.max(y1,w[1]);}
 let max=-Infinity,contact=0,unknown=0,n=0,exempt=0;const gaps=[],details=[];const nx=sp.back.length>30?9:5,ny=sp.back.length>30?7:5,d=[(u[0]*c-u[1]*s)/scale,0,(u[0]*s+u[1]*c)/scale];
 for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
  const t=(t0+t1)/2+(ix/(nx-1)*2-1)*(t1-t0)*.44,y=y0+(.1+.8*iy/(ny-1))*(y1-y0),a=a0-.1,origin=[u[0]*a+tangent[0]*t,y,u[1]*a+tangent[1]*t],dx=origin[0]-p[1],dz=origin[2]-p[2],o=[(dx*c-dz*s)/scale,(y-p[7])/(scale*sy),(dx*s+dz*c)/scale];let hit=-Infinity;
  for(const tri of ts){const q=ray(tri,o,d);if(q!==null)hit=Math.max(hit,q);}if(!Number.isFinite(hit)||y<y0+.105)continue;
  const w=[origin[0]+u[0]*hit,y,origin[2]+u[1]*hit],range=sectionRange(surface,w,u,anchor,t1-t0);if(Number.isFinite(range[0])&&(y<range[0]+.02||y>range[1]-.02)){exempt++;continue;}
  n++;const gap=surface.boundary(w,u,anchor,t1-t0);if(gap===null){unknown++;continue;}gaps.push(gap);details.push({point:w,target:[w[0]+u[0]*gap,w[1],w[2]+u[1]*gap],gap});max=Math.max(max,gap);if(gap<=.02)contact++;
 }
 const result={n,unknown,max,contact:n?contact/n:0,exempt,axis:'terrain-normal'};Object.defineProperty(result,'gaps',{value:gaps});Object.defineProperty(result,'details',{value:details});return result;
}

function direction(ctx,p){const e=.4,cg=[(ctx.height(p[1]+e,p[2])-ctx.height(p[1]-e,p[2]))/(2*e),(ctx.height(p[1],p[2]+e)-ctx.height(p[1],p[2]-e))/(2*e)],l=Math.hypot(...cg),center=l>EPS?cg.map(v=>v/l):[-Math.sin(p[3]),-Math.cos(p[3])],width=samples(ctx.types[p[0]].geo).width*p[4];let gx=0,gz=0;
 for(const t of [-.4,-.2,0,.2,.4]){const x=p[1]-center[1]*width*t,z=p[2]+center[0]*width*t;gx+=ctx.height(x+e,z)-ctx.height(x-e,z);gz+=ctx.height(x,z+e)-ctx.height(x,z-e);}
 const n=Math.hypot(gx,gz);return n>EPS&&(gx*center[0]+gz*center[1])/n>.35?[gx/n,gz/n]:center;}
function seat(ctx,p,u){let top=ctx.height(p[1],p[2]),bottom=top;for(let d=.25;d<=2.5;d+=.25){top=Math.max(top,ctx.height(p[1]+u[0]*d,p[2]+u[1]*d));bottom=Math.min(bottom,ctx.height(p[1]-u[0]*d,p[2]-u[1]*d));}
 const sp=samples(ctx.types[p[0]].geo),low=Math.max(bottom,ctx.water-.6),height=top-low+.1;p[6]=height/(sp.height*p[4]);p[7]=low-.1-sp.minY*p[4]*p[6];return p;
}
function fitOne(ctx,surface,original){
 const anchor=[original[1],original[2]],u=direction(ctx,original),geo=ctx.types[original[0]].geo,sp=samples(geo),fine=samples(geo,true),reference=exposure(surface,original,fine);
 const yaw=Math.atan2(-u[0],-u[1]);let best=null,reason='no-feasible-pose';
 function candidate(degrees,moved){
  const p=original.slice();p[3]=yaw+degrees*Math.PI/180;p[1]+=u[0]*moved;p[2]+=u[1]*moved;seat(ctx,p,u);
  const coarse=measure(surface,p,sp,u,anchor);if(coarse.unknown||coarse.n<8||coarse.contact<.9||coarse.max>.12){reason=coarse.unknown?'missing-local-boundary':'back-gap';return;}
  const m=measure(surface,p,fine,u,anchor);if(m.unknown||m.n<20||m.contact<.9||m.max>.12){reason=m.unknown?'missing-final-boundary':'back-gap';return;}
  const exposed=exposure(surface,p,fine);if(exposed.some((v,i)=>i>0&&v<reference[i]-.2)){reason='front-buried';return;}
  if(ctx.protected(p)){reason='protected-area';return;}
  const verified=verifyReadability(ctx,surface,original,p,new THREE.Matrix4(),u,fine);if(verified.ratios[1]<.8||verified.ratios[2]<.8){reason='front-visibility';return;}
  const score=moved+Math.abs(degrees)*.002;if(!best||score<best.score)best={p,score,back:m,exposed,reference,moved,degrees,verifiedVisibility:verified};
 }
 for(const degrees of [0,4,-4,8,-8,12,-12])for(let k=0;k<=4;k++)candidate(degrees,k*.1);
 if(best){const coarse=best;for(let k=-4;k<=4;k++){const move=coarse.moved+k*.02;if(move>=0&&move<=.4)candidate(coarse.degrees,move);}}
 return best?{ok:true,...best}:{ok:false,reason};
}
// 正面を共有する頂点は固定し、背面の同座標コピーだけを同量だけ延長する。
// 元の面構成を保ったまま、幅軸まわりの傾きと接地だけを変える。
function leanGeometry(ctx,p,u,degrees,factor){
 const source=ctx.types[p[0]].geo;source.computeBoundingBox();const box=source.boundingBox,k=p[4],sy=p[6]??1,foot=p[7]+box.min.y*k*sy,centerY=foot+(box.max.y-box.min.y)*k*sy*factor*.5;
 const pose=new THREE.Matrix4().compose(new THREE.Vector3(p[1],p[7],p[2]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]),new THREE.Vector3(k,k*sy,k)),stretch=new THREE.Matrix4().makeTranslation(0,foot,0).multiply(new THREE.Matrix4().makeScale(1,factor,1)).multiply(new THREE.Matrix4().makeTranslation(0,-foot,0)),rotation=new THREE.Matrix4().makeTranslation(p[1],centerY,p[2]).multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(u[1],0,-u[0]),degrees*Math.PI/180)).multiply(new THREE.Matrix4().makeTranslation(-p[1],-centerY,-p[2])),matrix=pose.clone().invert().multiply(rotation).multiply(stretch).multiply(pose),g=source.clone();
 for(const name of Object.keys(g.attributes))if(g.attributes[name].isInstancedBufferAttribute)g.deleteAttribute(name);g.applyMatrix4(matrix);g.computeBoundingBox();const lift=foot-(p[7]+g.boundingBox.min.y*k*sy);g.translate(0,lift/(k*sy),0);matrix.premultiply(new THREE.Matrix4().makeTranslation(0,lift/(k*sy),0));g.computeBoundingBox();g.computeBoundingSphere();return{geometry:g,matrix,foot,lift};
}
function trackedExposure(surface,original,p,matrix,sp){let ref=surface.exposureReferences.get(original);if(!ref){const counts=[0,0,0],points=[];for(const point of sp.front){const t=(point[1]-sp.minY)/sp.height,band=t<.34?0:t>.66?2:1,old=world(original,point);if(old[1]<=surface.height(old[0],old[2])+.005)continue;counts[band]++;points.push({point,band});}ref={counts,points};surface.exposureReferences.set(original,ref);}const visible=[0,0,0],v=new THREE.Vector3();for(const q of ref.points){v.fromArray(q.point).applyMatrix4(matrix);const w=world(p,[v.x,v.y,v.z]);if(w[1]>surface.height(w[0],w[2])+.005)visible[q.band]++;}return{counts:ref.counts,visible,ratios:ref.counts.map((n,i)=>n?visible[i]/n:1),basis:'original front sample IDs and original visible points; bands frozen before transform'};}

function propMatrix(p){return new THREE.Matrix4().compose(new THREE.Vector3(p[1],p[7],p[2]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]),new THREE.Vector3(p[4],p[4]*(p[6]??1),p[4]));}
function selfOccluded(geometry,origin,point){const d=point.map((v,i)=>v-origin[i]);for(const t of triangles(geometry)){const h=ray(t,origin,d);if(h!==null&&h<.9998)return true;}return false;}
function verifyReadability(ctx,surface,original,p,matrix,u,sp){let ref=surface.viewReferences.get(original);const v=new THREE.Vector3();if(!ref){const center=original[7]+(sp.minY+sp.height*.5)*original[4]*(original[6]??1),camera=[original[1]-u[0]*8,center+6,original[2]-u[1]*8],inverse=propMatrix(original).invert(),origin=v.fromArray(camera).applyMatrix4(inverse).toArray(),points=[],counts=[0,0,0];for(let i=0;i<sp.front.length;i++){const point=sp.front[i],r=(point[1]-sp.minY)/sp.height,band=r<.34?0:r>.66?2:1;if(!band||selfOccluded(sp.geometry,origin,point))continue;const w=world(original,point);if(surface.occluded(camera,w))continue;points.push({point,band,face:sp.frontFaceIds[i]});counts[band]++;}ref={camera,points,counts};surface.viewReferences.set(original,ref);}
 const transform=propMatrix(p).multiply(matrix),inverse=transform.clone().invert(),origin=v.fromArray(ref.camera).applyMatrix4(inverse).toArray(),visible=[0,0,0];for(const q of ref.points){if(selfOccluded(sp.geometry,origin,q.point))continue;const w=v.fromArray(q.point).applyMatrix4(transform).toArray();if(!surface.occluded(ref.camera,w))visible[q.band]++;}
 return{counts:ref.counts,visible,ratios:ref.counts.map((n,i)=>n?visible[i]/n:1),camera:ref.camera,originalFaceIds:[...new Set(ref.points.map(q=>q.face))],basis:'Frozen original middle/upper face IDs and source-visible points; exact same camera rays against mesh and terrain/relief'};
}
function* leanWork(ctx,surface,original){
 const source=ctx.types[original[0]].geo,sp=samples(source,true),u=direction(ctx,original),anchor=[original[1],original[2]],candidates=[];let last={ok:false,reason:'no-readable-pose'};
 for(const yawOffset of [0,4,-4,8,-8,12,-12])for(const factor of [1,1.08,1.16])for(const degrees of [0,5,10,15,20,25,30])for(const move of [0,.1,.2,.3,.4])candidates.push({factor,degrees,move,yawOffset,score:degrees*Math.PI/180*.8+(factor-1)*.7+move+Math.abs(yawOffset)*.01});candidates.sort((a,b)=>a.score-b.score);
 const patch=surface.patch(anchor,u,sp.width*original[4]);let ny=0,nu=0;for(const t of patch.ts){const n=Math.hypot(...t.n),dot=-(t.n[0]*u[0]+t.n[2]*u[1]);if(t.n[1]/n<.72&&dot>EPS){ny+=t.n[1]/n;nu+=dot/n;}}const targetTilt=Math.min(30,Math.max(0,Math.atan2(ny,nu)*180/Math.PI)),targetYaw=Math.max(-12,Math.min(12,(Math.atan2(-u[0],-u[1])-original[3])*180/Math.PI));candidates.sort((a,b)=>(Math.abs(a.degrees-targetTilt)*.025+Math.abs(a.yawOffset-targetYaw)*.01+(a.factor-1)*.7+a.move)-(Math.abs(b.degrees-targetTilt)*.025+Math.abs(b.yawOffset-targetYaw)*.01+(b.factor-1)*.7+b.move));
 const variants=new Map();try{for(const candidate of candidates){yield 0;const{factor,degrees,yawOffset}=candidate;let move=candidate.move;const key=factor+'/'+degrees+'/'+yawOffset;let variant=variants.get(key);if(!variant){const basis=original.slice();basis[3]+=yawOffset*Math.PI/180;variant=leanGeometry(ctx,basis,u,degrees,factor);const atZero=basis;variant.back=measure(surface,atZero,samples(variant.geometry,true),u,anchor);let out=0;const vp=variant.geometry.attributes.position,op=source.attributes.position;for(let j=0;j<vp.count;j++){const a=world(original,[op.getX(j),op.getY(j),op.getZ(j)]),b=world(atZero,[vp.getX(j),vp.getY(j),vp.getZ(j)]);out=Math.max(out,-((b[0]-a[0])*u[0]+(b[2]-a[2])*u[1]));}variant.outward=out;variants.set(key,variant);}if(move===0&&variant.back.n>=8&&!variant.back.unknown){const sorted=variant.back.gaps.slice().sort((a,b)=>a-b),required=Math.max(0,variant.back.max-.12,sorted[Math.ceil(variant.back.n*.9)-1]-.02);move=Math.ceil((required-1e-9)/.02)*.02;if(move>.400001)continue;}const g=variant.geometry,p=original.slice();p[3]+=yawOffset*Math.PI/180;p[1]+=u[0]*move;p[2]+=u[1]*move;
  const outward=Math.max(0,variant.outward-move),back={...variant.back,max:variant.back.max-move,contact:variant.back.n?variant.back.gaps.filter(g=>g-move<=.02).length/variant.back.n:0};if(ctx.nearMiss&&!back.unknown&&back.n>=8&&back.contact>=.9&&back.max>.12&&back.max<=.25&&outward<=.6&&!ctx.protected(p,g)){const v=trackedExposure(surface,original,p,variant.matrix,sp);if(v.ratios[1]>=.8&&v.ratios[2]>=.8)ctx.nearMiss({p:p.slice(),back,tilt:degrees,stretch:factor,yawOffset,visibility:v,points:variant.back.details.map(d=>({point:[d.point[0]+u[0]*move,d.point[1],d.point[2]+u[1]*move],target:d.target,gap:d.gap-move})).filter(d=>d.gap>.12)});}if(back.unknown||back.n<8||back.contact<.9||back.max>.12){last={ok:false,reason:back.unknown?'pose-missing-boundary':'pose-contact',back,tilt:degrees,stretch:factor,moved:move};continue;}if(outward>.6||ctx.protected(p,g))continue;
  const visible=trackedExposure(surface,original,p,variant.matrix,sp);if(visible.ratios[1]<.8||visible.ratios[2]<.8)continue;
  const verified=verifyReadability(ctx,surface,original,p,variant.matrix,u,sp);if(verified.ratios[1]<.8||verified.ratios[2]<.8)continue;
  const adopted=g.clone();for(const name of Object.keys(adopted.attributes))if(adopted.attributes[name].isInstancedBufferAttribute)adopted.deleteAttribute(name);
  return{ok:true,p,geometry:adopted,back,moved:move,tilt:degrees,stretch:factor,yawOffset,outward,trackedVisibility:visible,verifiedVisibility:verified,affine:Array.from(variant.matrix.elements),topologyPreserved:true};
 }}finally{for(const v of variants.values())v.geometry.dispose();}return last;
}
function consume(iterator){let r;do{r=iterator.next();}while(!r.done);return r.value;}
function fitLean(ctx,surface,p){return consume(leanWork(ctx,surface,p));}
function* progressOf(iterator,n){try{let r;do{r=iterator.next();if(!r.done)yield n;}while(!r.done);return r.value;}finally{iterator.return();}}
function span(ctx,p,tangent,geometry=ctx.types[p[0]].geo){const g=geometry.attributes.position;let lo=Infinity,hi=-Infinity;for(let i=0;i<g.count;i++){const w=world(p,[g.getX(i),g.getY(i),g.getZ(i)]),q=w[0]*tangent[0]+w[2]*tangent[1];lo=Math.min(lo,q);hi=Math.max(hi,q);}return[lo,hi];}
function unionCoverage(old,intervals){const q=intervals.map(a=>[Math.max(old[0],a[0]),Math.min(old[1],a[1])]).filter(a=>a[1]>a[0]).sort((a,b)=>a[0]-b[0]);let length=0,end=-Infinity,maxGap=0;for(const[a,b]of q){if(end>-Infinity)maxGap=Math.max(maxGap,a-end);length+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}return{coverage:length/(old[1]-old[0]),maxGap};}
function* replacementWork(ctx,surface,p,progress=0){
 const u=direction(ctx,p),tangent=[-u[1],u[0]],old=span(ctx,p,tangent),width=old[1]-old[0],type=ctx.types.findIndex(t=>t.id==='cliff_joint');if(type<0)return null;const reference=exposure(surface,p,samples(ctx.types[p[0]].geo,true));
 for(const count of [1,2]){if(count===1&&p[0]===type)continue;const parts=[],s=(width/count+(count===2?.12:0))/samples(ctx.types[type].geo).width,center=(old[0]+old[1])/2-p[1]*tangent[0]-p[2]*tangent[1];let failed=false;
  for(let i=0;i<count;i++){const q=p.slice(),offset=center+width*((i+.5)/count-.5);q[0]=type;q[4]=s;q[1]+=tangent[0]*offset;q[2]+=tangent[1]*offset;if(i)q[8]=null;seat(ctx,q,direction(ctx,q));let f=fitOne(ctx,surface,q);if(!f.ok)f=yield* progressOf(leanWork(ctx,surface,q),progress);if(!f.ok){failed=true;break;}parts.push(f);}
  if(!failed){const intervals=parts.map(f=>span(ctx,f.p,tangent,f.geometry||ctx.types[type].geo)),coverage=unionCoverage(old,intervals),exposed=[0,0,0];for(const f of parts){const e=exposure(surface,f.p,samples(ctx.types[type].geo,true));for(let j=0;j<3;j++)exposed[j]+=e[j]/parts.length;}
   if(coverage.coverage>=.99&&coverage.maxGap<=.12&&exposed[1]>=Math.max(reference[1]-.2,reference[1]*.8)&&exposed[2]>=Math.max(reference[2]-.2,reference[2]*.8))return{ok:true,parts,coverage,...{reference,exposed}};
  }
  for(const f of parts)f.geometry?.dispose();
 }
 return null;
}

function fitReplacement(ctx,surface,p){return consume(replacementWork(ctx,surface,p));}
function* work(ctx,props){
 const started=performance.now(),surface=new Surface(ctx.geometries),indexMs=performance.now()-started,main=new Set(['cliff','cliff_split','cliff_shoulder','cliff_joint']),result=[],records=[],fits=[];let changed=0,delivered=false;
 try{for(let i=0;i<props.length;i++){
  const p=props[i],t=ctx.types[p[0]];if(p[5]!==1||!main.has(t.id)){result.push(p);continue;}
  const sp=samples(t.geo,true),u=direction(ctx,p),base=measure(surface,p,sp,u,[p[1],p[2]]);let f;
  if(!ctx.protected(p,t.geo)&&!base.unknown&&base.n>=8&&base.contact>=.9&&base.max<=.12)f={ok:true,p:p.slice(),back:base,unchanged:true};
  else{f=fitOne(ctx,surface,p);if(!f.ok)f=yield* progressOf(leanWork(ctx,surface,p),records.length);}
  if(f.ok){result.push(f.p);if(f.geometry)fits.push({p:f.p,geometry:f.geometry,affine:f.affine,original:p});if(!f.unchanged)changed++;records.push({id:p[8]??i,old:p.slice(0,9),next:f.p.slice(0,9),ok:true,method:f.geometry?'rigid-lean':f.unchanged?'already-contact':'pose',back:f.back,tilt:f.tilt||0,stretch:f.stretch||1,outward:f.outward||0,trackedVisibility:f.trackedVisibility,verifiedVisibility:f.verifiedVisibility,topologyPreserved:f.topologyPreserved||false,moved:f.moved||0,angleChange:f.angleChange||0});}
  else{const replacement=yield* replacementWork(ctx,surface,p,records.length);if(replacement){for(const part of replacement.parts){result.push(part.p);if(part.geometry)fits.push({p:part.p,geometry:part.geometry,affine:part.affine,original:p});}changed++;records.push({id:p[8]??i,old:p.slice(0,9),nextParts:replacement.parts.map(p=>p.p),ok:true,method:replacement.parts.length===2?'two-joints':'one-joint',coverage:replacement.coverage,reference:replacement.reference,exposed:replacement.exposed});}else{result.push(p);records.push({id:p[8]??i,old:p.slice(0,9),ok:false,method:'kept-original',reason:f.reason,back:f.back,attempts:f.attempts?.map(a=>({shift:a.shift,angleChange:a.angleChange,reason:a.reason,maxMove:a.maxMove,back:a.back}))});}}
  yield records.length;
 }delivered=true;return{props:result,fits,stats:{indexMs,totalMs:performance.now()-started,changed,total:records.length,unresolved:records.filter(r=>!r.ok).length,keptOriginal:records.filter(r=>!r.ok).length,alreadyContact:records.filter(r=>r.method==='already-contact').length,surface:surface.stats,records}};
 }finally{if(!delivered)for(const f of fits)f.geometry.dispose();}
}

function fit(ctx,props){const it=work(ctx,props);let r;do{r=it.next();}while(!r.done);return r.value;}
async function fitAsync(ctx,props){const it=work(ctx,props);let r,chunk=performance.now(),validated=0;do{if(ctx.valid&&performance.now()-validated>50){validated=performance.now();if(!ctx.valid()){it.return();throw Error('cliff-contact-cancelled');}}r=it.next();if(!r.done&&performance.now()-chunk>12){if(ctx.progress)ctx.progress(r.value);await new Promise(resolve=>setTimeout(resolve,0));chunk=performance.now();}}while(!r.done);return r.value;}
window.TDCliffContact={Surface,samples,world,measure,exposure,fit,fitAsync,fitOne,fitLean,fitBack:fitLean,leanGeometry,trackedExposure,fitReplacement,unionCoverage,direction,seat,sectionRanges,nearestRear};
})();
